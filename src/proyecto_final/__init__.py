def main() -> None:
    """Arranca el servidor local de desarrollo."""
    import uvicorn

    uvicorn.run(
        "proyecto_final.api:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )
