# Proyecto Final Comparador Viajes

Aplicación local que recomienda vacaciones por relación calidad-precio, menor
precio o servicios incluidos. El chat conserva el historial, muestra las fuentes
de cada respuesta e indica «No consta» cuando la información no está documentada.
Incluye buscador de documentos, detalle, comparación y ofertas guardadas.

## Datos y tecnología

Los datos son **inventados pero realistas**: nueve registros locales inspirados
en Booking.com, KAYAK y lastminute.com, definidos en `maquetas.html` y preparados
en `datos/` mediante `preparar_datos.py`. No son ofertas reales ni disponibilidad
en directo; la aplicación no permite reservar.

Servidor Python con FastAPI y RAG, índice de embeddings persistente y respuestas
estructuradas. Interfaz Svelte con TypeScript y Vite. Modelos configurables en
`.env`: `gpt-6-luna` para respuestas y `text-embedding-3-small` para embeddings.
La clave se utiliza únicamente en Python; el navegador solo consulta `/api`.

## Arranque local

Necesitas Python 3.12, uv y una versión de Node.js compatible con Vite (el proyecto
se ha comprobado con Node.js 24). Desde la raíz:

```powershell
uv sync --frozen
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Añade tu `OPENAI_API_KEY` a `.env`. Si ese archivo ya existe, conserva su contenido.
Arranca el servidor en una terminal:

```powershell
uv run servidor.py
```

En otra terminal, desde la raíz:

```powershell
cd web
npm.cmd ci
npm.cmd run dev
```

Abre **http://127.0.0.1:5173/**. Python escucha en el puerto 8000 y Vite reenvía
`/api` a ese servidor. `npm.cmd` evita la restricción de PowerShell para `npm.ps1`;
en otros terminales puedes usar `npm`. El primer índice necesita acceso a OpenAI;
los siguientes arranques reutilizan `rag/indice.npz`. `.env` no se incluye en Git.

## Preguntas comprobadas

Viaje: Madrid–Mallorca, 12–19 de junio de 2027, dos adultos y hasta 1.800 €.
Las preguntas siguientes se probaron en una misma conversación:

1. «Del 12 al 19 de junio de 2027, somos 2 adultos, salimos de Madrid y tenemos
   hasta 1.800 € para Mallorca. ¿Qué oferta tiene la mejor relación calidad-precio?»
   → Marina Verde, **1.384 €**.
2. «Con las mismas fechas, los 2 adultos, Mallorca y el presupuesto de 1.800 €,
   ¿cuál tiene el mejor precio?» → Brisa de Palma, **1.068 €**.
3. «Y con las mismas fechas, viajeros, destino y presupuesto, ¿qué oferta es la
   más completa?» → Bahía Serena Resort, **1.764 €**.
4. «¿Marina Verde admite perros y cuánto cuesta llevar el mío?» → **No consta**,
   sin consultar al modelo para completar ese dato.

Las fuentes citadas se contrastaron con `datos/documentos.json`. Las peticiones
de ejemplo están en `ejemplos/`; las respuestas reales y las comprobaciones,
en `capturas/comprobacion.json`.

## Entregable y comprobaciones

- [Entregable PDF — 14 páginas A4](entregable.pdf).
- [Versión HTML](entregable.html), con imágenes relativas en [capturas/](capturas/).
- [Instrucciones de las capturas con Edge](web/README.md#entregable-y-capturas).

```powershell
uv run python -m unittest discover -s tests -v
cd web
npm.cmd run check
npm.cmd run build
```

Con la aplicación arrancada, desde la raíz puedes repetir las capturas con
`node web/capturas.mjs` y generar el PDF con `node web/generar-entregable.mjs`.
Se utiliza `playwright-core` y Microsoft Edge instalado, sin descargar navegadores.
