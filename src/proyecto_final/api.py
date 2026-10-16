"""API local de Rumbo."""

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

app = FastAPI(
    title="Rumbo API",
    description="Servidor local del recomendador de vacaciones.",
    version="0.1.0",
)


@app.get("/api/health", tags=["Sistema"])
def health() -> dict[str, str]:
    """Comprueba el servidor sin usar credenciales ni servicios externos."""
    return {"status": "ok", "service": "rumbo-api"}


@app.get("/api/maquetas", response_class=FileResponse, include_in_schema=False)
def maquetas() -> FileResponse:
    """Sirve la maqueta local original sin duplicar su contenido."""
    return FileResponse(
        PROJECT_ROOT / "maquetas.html",
        media_type="text/html",
        headers={"Cache-Control": "no-cache"},
    )
