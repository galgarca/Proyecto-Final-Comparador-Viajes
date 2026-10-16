"""Servidor RAG de Rumbo. Arranque: uv run servidor.py"""

import uvicorn

from proyecto_final.api import app


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
