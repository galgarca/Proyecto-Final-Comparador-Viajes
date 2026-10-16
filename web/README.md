# Rumbo ? Interfaz local

Aplicaci?n Svelte con TypeScript y Vite, basada en `../maquetas.html`.
Incluye chat con historial y fuentes, aviso de falta de datos, buscador de
documentos, registro completo, detalle de oferta, comparaci?n y guardadas
durante la sesi?n. Los datos de viajes son simulados.

## Arranque

En una terminal, desde la ra?z del proyecto:

```powershell
uv run servidor.py
```

En otra terminal, desde esta carpeta `web/`:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abre http://127.0.0.1:5173/. Python escucha en el puerto 8000 y Vite reenv?a
`/api` a Python mediante `vite.config.ts`. `npm.cmd` evita la restricci?n de
PowerShell para ejecutar `npm.ps1`.

## Conexi?n con el servidor

`src/lib/api.ts` concentra las peticiones y solo admite rutas `/api/`:

- `POST /api/preguntar`: pregunta e historial; respuesta, oferta y fuentes.
- `GET /api/documentos`: b?squeda, filtros, ordenaci?n y metadatos.
- `GET /api/documentos/{id}`: registro completo de una fuente.

La clave permanece en el `.env` de la ra?z y solo la utiliza Python.
No a?adas credenciales a variables `VITE_*`, que se incluyen en el navegador.
El texto del usuario, del modelo y de las fuentes se muestra escapado; las citas
abren registros internos y no enlaces arbitrarios del modelo.

## Comprobaciones

```powershell
npm.cmd run check
npm.cmd run build
```

La compilación se genera en `dist/`. El proxy `/api` pertenece al servidor de
desarrollo; para esta aplicación local utiliza `npm.cmd run dev`.

## Entregable y capturas

`playwright-core` utiliza el Microsoft Edge instalado con `channel: "msedge"`,
sin descargar navegadores. Con Python y Vite arrancados, desde la raíz:

```powershell
node web/capturas.mjs
node web/generar-entregable.mjs
```

El primer script hace consultas reales por la interfaz, comprueba sus fuentes
y guarda ocho PNG y `capturas/comprobacion.json`. Las capturas del chat muestran
el turno completo, con todas sus fuentes desplegadas. Las barras dejan de ser
fijas solo durante la captura para evitar que tapen la respuesta.
La ventana mide 1366 × 900; las imágenes pueden ser más altas para conservar
la información. Las otras capturas muestran la página completa.

El segundo script usa ese registro y `capturas/modelos.json` para generar
`entregable.html` y `entregable.pdf`. Comprueba las imágenes, la maquetación
y el número de páginas. Para actualizar los modelos tras cambiar la
configuración, ejecuta desde la raíz antes de generar el entregable:

```powershell
uv run python -c "from proyecto_final.rag import TravelRAG; import json; from pathlib import Path; r=TravelRAG(); Path('capturas/modelos.json').write_text(json.dumps(dict(respuesta=r.response_model, embeddings=r.embedding_model)), encoding='utf-8')"
```

Al compartir el HTML, conserva a su lado `capturas/` y, para abrir los registros
locales enlazados, `datos/`. El PDF incorpora las imágenes.
