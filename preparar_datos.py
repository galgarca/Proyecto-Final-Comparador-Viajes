"""Copia los datos ficticios de maquetas.html a JSON, sin ejecutar JavaScript.

Uso: uv run preparar_datos.py
No necesita una clave ni hace peticiones a los portales de viajes.
"""

import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TOKEN = re.compile(r"'(?:\\.|[^'\\])*'|\b[A-Za-z_$][\w$]*(?=\s*:)")


def leer_array(html: str, nombre: str) -> list[dict]:
    match = re.search(rf"const {re.escape(nombre)}\s*=\s*(\[.*?\n\s*\]);", html, re.S)
    if not match:
        raise ValueError(f"No se encuentra el array {nombre} en maquetas.html")

    def convertir(token: re.Match) -> str:
        value = token.group()
        return json.dumps(ast.literal_eval(value) if value.startswith("'") else value, ensure_ascii=False)

    return json.loads(TOKEN.sub(convertir, match.group(1)))


def preparar() -> None:
    html = (ROOT / "maquetas.html").read_text(encoding="utf-8")
    originals = leer_array(html, "records")
    common = {
        "origen": "Madrid", "destino": "Mallorca", "fecha_inicio": "2027-06-12",
        "fecha_fin": "2027-06-19", "adultos": 2, "noches": 7,
        "moneda": "EUR", "datos_simulados": True,
    }
    documents = [
        {
            **common, "id": row["id"], "oferta_id": row["offer"],
            "titulo": row["title"], "portal": row["portal"], "tipo": row["type"],
            "tipo_nombre": row["typeName"], "importe": row["amount"],
            "fragmento": row["quote"], "contenido": row["full"],
            "documento": f"datos/documentos.json#{row['id']}",
        }
        for row in originals
    ]
    by_id = {row["id"]: row for row in documents}
    offers = []
    source_offers = leer_array(html, "offers")
    for source in source_offers:
        hotel, flight, extras = [by_id[ref] for ref in source["refs"]]
        total = sum(by_id[ref]["importe"] for ref in source["refs"])
        if total != source["total"]:
            raise ValueError(f"El total de {source['id']} no coincide con sus registros")
        meal = "todo incluido" if "Todo incluido" in hotel["contenido"] else (
            "desayuno" if "Desayuno incluido" in hotel["contenido"] else "solo alojamiento"
        )
        offers.append({
            **common, "id": source["id"], "nombre": source["name"],
            "zona": source["location"], "estrellas": source["stars"],
            "valoracion": float(source["rating"].replace(",", ".")),
            "numero_valoraciones": source["reviews"], "precio_total": total,
            "precio_por_persona": total / common["adultos"],
            "regimen": meal,
            "cancelacion_hotel_gratuita": bool(re.search(r"Cancelación gratuita|Hotel cancelable", hotel["contenido"])),
            "equipaje_facturado_kg_por_adulto": 20 if "facturada de 20 kg" in flight["contenido"] else 0,
            "registros": source["refs"],
        })
    target = ROOT / "datos"
    target.mkdir(exist_ok=True)
    for filename, payload in (("documentos.json", documents), ("ofertas.json", offers)):
        (target / filename).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    examples = ROOT / "ejemplos"
    examples.mkdir(exist_ok=True)
    history = []
    for filename, source in zip(("01-calidad-precio.json", "02-mejor-precio.json", "03-mas-completa.json"), source_offers):
        request = {"pregunta": source["question"], "historial": history.copy()}
        (examples / filename).write_text(json.dumps(request, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        history.extend([{"rol": "user", "contenido": source["question"]},
                        {"rol": "assistant", "contenido": re.sub(r"<[^>]+>", "", source["intro"])}])
    unsupported = {"pregunta": "¿Marina Verde admite perros y cuánto cuesta llevar el mío?", "historial": history}
    (examples / "04-sin-datos.json").write_text(json.dumps(unsupported, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Preparados {len(documents)} registros y {len(offers)} ofertas ficticias en {target.name}/")
    print("Cuatro peticiones de ejemplo preparadas en ejemplos/")


if __name__ == "__main__":
    preparar()
