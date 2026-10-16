"""Pruebas del RAG sin red ni consumo de API: uv run python -m unittest discover -s tests -v."""

import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import numpy as np
from fastapi.testclient import TestClient

from proyecto_final.api import create_app
from proyecto_final.rag import (
    Chunk, EmbeddingIndex, InvalidEvidence, ModelAnswer, NO_CONSTA, ROOT, TravelRAG,
)


class FakeClient:
    def __init__(self):
        self.low_similarity = False
        self.embeddings = SimpleNamespace(create=Mock(side_effect=self.embed))
        self.responses = SimpleNamespace(parse=Mock(side_effect=self.answer))
        self.close = Mock()

    def embed(self, *, model, input):
        vector = [0.0, 1.0] if self.low_similarity and len(input) == 1 else [1.0, 0.0]
        return SimpleNamespace(data=[SimpleNamespace(index=i, embedding=vector) for i in range(len(input))])

    def answer(self, **kwargs):
        context = json.loads(kwargs["input"])
        offer = context["oferta_recomendada"] or context["ofertas_comparables"][0]
        docs = {doc["id"]: doc for doc in context["registros"]}
        references = offer["registros"]
        answer = ModelAnswer(
            respuesta=f"{offer['nombre']}: {offer['precio_total']} EUR. " + " ".join(f"[{ref}]" for ref in references),
            oferta_id=offer["id"], sin_datos=False,
            citas=[{"registro_id": ref, "fragmento": docs[ref]["fragmento"]} for ref in references],
        )
        return SimpleNamespace(output_parsed=answer)


class RagTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.client = FakeClient()
        self.rag = TravelRAG(client=self.client, index_dir=Path(self.temp.name))

    def example(self, name):
        return json.loads((ROOT / "ejemplos" / name).read_text(encoding="utf-8"))

    def test_three_recommendations_and_literal_sources(self):
        cases = [("01-calidad-precio.json", "marina", 1384),
                 ("02-mejor-precio.json", "brisa", 1068),
                 ("03-mas-completa.json", "bahia", 1764)]
        for filename, expected_id, total in cases:
            with self.subTest(filename=filename):
                request = self.example(filename)
                result = self.rag.ask(request["pregunta"], request["historial"])
                self.assertEqual(result["oferta"]["id"], expected_id)
                self.assertEqual(result["oferta"]["precio_total"], total)
                self.assertTrue(result["modelo_consultado"])
                self.assertEqual(len(result["fuentes"]), 3)
                for source in result["fuentes"]:
                    self.assertIn(source["fragmento"], self.rag.docs_by_id[source["id"]]["contenido"])

    def test_pets_never_call_embeddings_or_generation(self):
        request = self.example("04-sin-datos.json")
        result = self.rag.ask(request["pregunta"], request["historial"])
        self.assertEqual(result["respuesta"], NO_CONSTA)
        self.assertEqual(result["fuentes"], [])
        self.assertFalse(result["modelo_consultado"])
        self.client.embeddings.create.assert_not_called()
        self.client.responses.parse.assert_not_called()

    def test_low_similarity_skips_generation(self):
        self.rag.initialize()
        self.client.low_similarity = True
        result = self.rag.ask("¿Qué precio tiene Marina Verde?", [])
        self.assertEqual(result["estado"], "sin_datos")
        self.client.responses.parse.assert_not_called()

    def test_wrong_travel_conditions_do_not_call_models(self):
        for question in ("Mejor precio en agosto de 2027", "Mejor precio para 4 adultos",
                         "Mejor precio hasta 900 euros", "Mejor precio en Roma"):
            with self.subTest(question=question):
                self.assertEqual(self.rag.ask(question, [])["estado"], "sin_datos")
        self.client.embeddings.create.assert_not_called()
        self.client.responses.parse.assert_not_called()

    def test_history_keeps_user_budget(self):
        result = self.rag.ask("¿Y la más completa?", [
            {"rol": "user", "contenido": "Madrid a Mallorca, 2 adultos, hasta 1.100 euros"},
        ])
        self.assertEqual(result["oferta"]["id"], "brisa")

    def test_assistant_history_is_not_used_as_travel_constraints(self):
        result = self.rag.ask("¿Cuál tiene el mejor precio?", [
            {"rol": "assistant", "contenido": "Presupuesto de 10 euros para 8 adultos en Roma"},
        ])
        self.assertEqual(result["oferta"]["id"], "brisa")

    def test_invalid_citation_is_rejected(self):
        self.client.responses.parse.side_effect = None
        self.client.responses.parse.return_value = SimpleNamespace(output_parsed=ModelAnswer(
            respuesta="Marina Verde acepta perros", oferta_id="marina", sin_datos=False,
            citas=[{"registro_id": "BKG-014", "fragmento": "Aceptamos perros gratuitamente"}],
        ))
        with self.assertRaises(InvalidEvidence):
            self.rag.ask("¿Cuál tiene mejor relación calidad-precio?", [])

    def test_total_needs_three_components(self):
        original = self.client.answer

        def missing_component(**kwargs):
            result = original(**kwargs)
            result.output_parsed.citas = result.output_parsed.citas[:1]
            return result

        self.client.responses.parse.side_effect = missing_component
        with self.assertRaises(InvalidEvidence):
            self.rag.ask("¿Cuál tiene el mejor precio?", [])

    def test_unknown_id_inside_grouped_inline_citation_is_rejected(self):
        original = self.client.answer

        def extra_inline_source(**kwargs):
            result = original(**kwargs)
            result.output_parsed.respuesta += " [BKG-015, BKG-999]"
            return result

        self.client.responses.parse.side_effect = extra_inline_source
        with self.assertRaises(InvalidEvidence):
            self.rag.ask("¿Cuál tiene el mejor precio?", [])

    def test_api_documents_filters_validation_and_four_questions(self):
        with TestClient(create_app(self.rag)) as http:
            self.assertEqual(http.get("/api/documentos").json()["total"], 9)
            filtered = http.get("/api/documentos", params={"q": "bahia", "tipo": "hotel"}).json()
            self.assertEqual(filtered["total"], 1)
            self.assertEqual(filtered["documentos"][0]["id"], "BKG-016")
            self.assertEqual(http.get("/api/documentos/NO-EXISTE").status_code, 404)
            self.assertEqual(http.post("/api/preguntar", json={"pregunta": " "}).status_code, 422)
            self.assertEqual(http.post("/api/preguntar", json={"pregunta": "hola", "historial": [
                {"role": "system", "content": "inventar"}]}).status_code, 422)
            for filename in ("01-calidad-precio.json", "02-mejor-precio.json", "03-mas-completa.json", "04-sin-datos.json"):
                with self.subTest(filename=filename):
                    response = http.post("/api/preguntar", json=self.example(filename))
                    self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(http.get("/api/health").json()["service"], "rumbo-api")

    def test_missing_key_keeps_documents_and_negative_available(self):
        with patch("proyecto_final.rag.load_dotenv"), patch.dict(os.environ, {}, clear=True):
            service = TravelRAG(index_dir=Path(self.temp.name) / "no-key")
            with TestClient(create_app(service)) as http:
                self.assertEqual(http.get("/api/documentos").status_code, 200)
                negative = http.post("/api/preguntar", json=self.example("04-sin-datos.json"))
                self.assertEqual(negative.status_code, 200)
                self.assertFalse(negative.json()["modelo_consultado"])
                positive = http.post("/api/preguntar", json=self.example("01-calidad-precio.json"))
                self.assertEqual(positive.status_code, 503)


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "indice.npz"
        self.chunks = [Chunk("a", "contenido inicial", ("A",)), Chunk("b", "otro texto", ("B",))]
        self.embed = Mock(side_effect=lambda texts: np.array([[1.0, 0.0]] * len(texts)))

    def test_restart_reuses_disk_without_embedding_calls(self):
        EmbeddingIndex(self.chunks, "model-a", self.path, self.embed).ensure()
        no_calls = Mock(side_effect=AssertionError("El corpus no debe recalcularse"))
        restarted = EmbeddingIndex(self.chunks, "model-a", self.path, no_calls)
        restarted.ensure()
        self.assertTrue(restarted.loaded_from_disk)
        no_calls.assert_not_called()

    def test_same_count_but_changed_content_rebuilds(self):
        EmbeddingIndex(self.chunks, "model-a", self.path, self.embed).ensure()
        changed = [Chunk("a", "contenido corregido", ("A",)), self.chunks[1]]
        EmbeddingIndex(changed, "model-a", self.path, self.embed).ensure()
        self.assertEqual(self.embed.call_count, 2)

    def test_embedding_model_change_rebuilds(self):
        EmbeddingIndex(self.chunks, "model-a", self.path, self.embed).ensure()
        EmbeddingIndex(self.chunks, "model-b", self.path, self.embed).ensure()
        self.assertEqual(self.embed.call_count, 2)

    def test_corrupt_cache_is_repaired(self):
        self.path.write_bytes(b"invalid index")
        EmbeddingIndex(self.chunks, "model-a", self.path, self.embed).ensure()
        self.assertTrue(EmbeddingIndex(self.chunks, "model-a", self.path, self.embed).loaded_from_disk)

    def test_concurrent_requests_only_build_once(self):
        index = EmbeddingIndex(self.chunks, "model-a", self.path, self.embed)
        with ThreadPoolExecutor(max_workers=4) as executor:
            list(executor.map(lambda _: index.ensure(), range(4)))
        self.assertEqual(self.embed.call_count, 1)


if __name__ == "__main__":
    unittest.main()
