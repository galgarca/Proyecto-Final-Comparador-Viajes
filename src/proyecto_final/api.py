"""API local de Rumbo con recuperación, fuentes y documentos de demostración."""

from contextlib import asynccontextmanager
from datetime import date
import logging
import os
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator
from starlette.concurrency import run_in_threadpool

from .rag import ConfigurationError, Criterion, ProviderError, ROOT, TravelRAG, normalize

logger = logging.getLogger(__name__)


class ConversationTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rol: Literal["user", "assistant"] = Field(validation_alias=AliasChoices("rol", "role"))
    contenido: str = Field(min_length=1, max_length=4000, validation_alias=AliasChoices("contenido", "content"))


class QuestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pregunta: str = Field(min_length=1, max_length=2000)
    historial: list[ConversationTurn] = Field(default_factory=list, max_length=20)

    @field_validator("pregunta")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("La pregunta no puede estar vacía")
        return value.strip()


class Trip(BaseModel):
    model_config = ConfigDict(extra="forbid")
    origen: str
    destino: str
    fecha_inicio: date
    fecha_fin: date
    adultos: int
    noches: int
    moneda: Literal["EUR"]
    datos_simulados: Literal[True]


class Offer(Trip):
    id: str
    nombre: str
    zona: str
    estrellas: int
    valoracion: float
    numero_valoraciones: int
    precio_total: float
    precio_por_persona: float
    regimen: str
    cancelacion_hotel_gratuita: bool
    equipaje_facturado_kg_por_adulto: int
    registros: list[str]


class Source(BaseModel):
    id: str
    documento: str
    titulo: str
    portal: str
    tipo: str
    fragmento: str
    similitud: float
    url: str


class Answer(BaseModel):
    respuesta: str
    fuentes: list[Source]
    estado: Literal["respondida", "sin_datos"]
    oferta: Offer | None
    criterio: Criterion | None
    modelo_consultado: bool
    motivo: str | None
    datos_simulados: Literal[True]


class Document(Trip):
    id: str
    oferta_id: str
    titulo: str
    portal: str
    tipo: Literal["hotel", "flight", "extras"]
    tipo_nombre: str
    importe: float
    fragmento: str
    contenido: str
    documento: str


class DocumentList(BaseModel):
    documentos: list[Document]
    total: int
    total_general: int
    portales: list[str]
    ofertas: int
    conjunto_datos: str
    datos_simulados: Literal[True]


def create_app(service: TravelRAG | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        rag = service or TravelRAG()
        application.state.rag = rag
        try:
            await run_in_threadpool(rag.initialize)
        except (ConfigurationError, ProviderError) as exc:
            logger.warning("Índice pendiente (%s). Documentos y preguntas sin cobertura disponibles.", type(exc).__name__)
        yield
        rag.close()

    application = FastAPI(
        title="Rumbo API", version="0.2.0",
        description="RAG local de ofertas ficticias con embeddings persistentes y citas literales.",
        lifespan=lifespan,
    )

    @application.exception_handler(ConfigurationError)
    async def configuration_error(request: Request, exc: ConfigurationError):
        return JSONResponse(status_code=503, content={"detail": {
            "codigo": "configuracion_openai", "mensaje": str(exc),
        }})

    @application.exception_handler(ProviderError)
    async def provider_error(request: Request, exc: ProviderError):
        return JSONResponse(status_code=502, content={"detail": {
            "codigo": "proveedor_o_fuentes_invalidas", "mensaje": str(exc),
        }})

    @application.get("/api/health", tags=["Sistema"])
    def health(request: Request):
        rag = request.app.state.rag
        return {"status": "ok", "service": "rumbo-api", "rag": rag.status(),
                "openai_configurado": bool(os.getenv("OPENAI_API_KEY", "").strip())}

    @application.post("/api/preguntar", response_model=Answer, tags=["Asistente"])
    def preguntar(body: QuestionRequest, request: Request):
        return request.app.state.rag.ask(body.pregunta, [turn.model_dump() for turn in body.historial])

    @application.get("/api/documentos", response_model=DocumentList, tags=["Documentos"])
    def documentos(
        request: Request,
        q: str = Query(default="", max_length=200),
        tipo: Literal["hotel", "flight", "extras"] | None = None,
        portal: str | None = Query(default=None, max_length=100),
        orden: Literal["oferta", "importe_asc", "importe_desc", "portal"] = "oferta",
    ):
        rag = request.app.state.rag
        documents = [doc for doc in rag.documents
                     if (tipo is None or doc["tipo"] == tipo)
                     and (portal is None or normalize(doc["portal"]) == normalize(portal))
                     and normalize(q) in normalize(" ".join(str(value) for value in doc.values()))]
        if orden.startswith("importe_"):
            documents.sort(key=lambda doc: doc["importe"], reverse=orden == "importe_desc")
        elif orden == "portal":
            documents.sort(key=lambda doc: doc["portal"])
        return {"documentos": documents, "total": len(documents), "total_general": len(rag.documents),
                "portales": sorted({doc["portal"] for doc in rag.documents}), "ofertas": len(rag.offers),
                "conjunto_datos": "DEMO-MAL-2027", "datos_simulados": True}

    @application.get("/api/documentos/{document_id}", response_model=Document, tags=["Documentos"])
    def documento(document_id: str, request: Request):
        document = request.app.state.rag.docs_by_id.get(document_id)
        if document is None:
            raise HTTPException(status_code=404, detail="El registro no existe.")
        return document

    @application.get("/api/maquetas", response_class=FileResponse, include_in_schema=False)
    def maquetas():
        return FileResponse(ROOT / "maquetas.html", media_type="text/html", headers={"Cache-Control": "no-cache"})

    return application


app = create_app()
