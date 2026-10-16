# Rumbo · Proyecto local

Recomendador de vacaciones con servidor FastAPI, Python y uv, e interfaz
Vite + Svelte + TypeScript. La aplicación implementa las pantallas de
`maquetas.html`: chat con fuentes, aviso de falta de datos, buscador de registros,
detalle de oferta, comparación y ofertas guardadas durante la sesión.
Los datos de viajes son ficticios y están identificados como tales.

## Herramientas

- Node.js 24.20.0 y npm 11.19.0, instalados mediante el ZIP oficial en
  `%LOCALAPPDATA%\Programs\node-v24.20.0-win-x64`, sin administrador.
- Python 3.12, gestionado por uv.
- uv y Git.

Reinicia la terminal o el IDE para recoger el nuevo `PATH` de tu usuario. En una
terminal PowerShell que ya estuviera abierta, puedes actualizarlo así:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
node -v
npm.cmd -v
```

Los ejemplos usan `npm.cmd`, disponible en el paquete oficial de Node.js, porque
la política de PowerShell de este equipo impide ejecutar `npm.ps1`.

## Instalar las dependencias

En la carpeta raíz:

```powershell
uv sync --frozen
```

Para añadir bibliotecas Python se usa `uv add`, nunca `pip`. Las dependencias
incluidas son `openai`, `python-dotenv`, `numpy`, `fastapi` y `uvicorn[standard]`.
El entorno virtual está en `.venv` y las versiones se fijan en `uv.lock`.

En otra terminal, dentro de `web/`:

```powershell
cd web
npm.cmd ci
```

`package-lock.json` fija las dependencias de la interfaz. La creación inicial se
realizó con `npm create vite@latest web -- --template svelte-ts --no-interactive`
y la instalación inicial con `npm install`.

## Arrancar en local

Terminal 1, desde la raíz del proyecto:

```powershell
uv run servidor.py
```

El servidor escucha en `http://127.0.0.1:8000`. La documentación interactiva de
FastAPI está en `http://127.0.0.1:8000/docs`. También se puede arrancar con:

```powershell
uv run uvicorn proyecto_final.api:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2, desde la raíz del proyecto:

```powershell
cd web
npm.cmd run dev
```

Abre `http://127.0.0.1:5173`. Vite reenvía `/api` al servidor Python del puerto
8000 y conserva la ruta, por lo que `/api/health` llega a `/api/health` en FastAPI.
El proxy está configurado en `web/vite.config.ts` y solo se aplica al servidor
de desarrollo. Ambos servidores se detienen con `Ctrl+C` en sus terminales.

Para comprobar la conexión desde una tercera terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://127.0.0.1:5173/api/health
```

Ambas peticiones deben devolver `status: ok` y `service: rumbo-api`.

## Variables de entorno y conexión

El servidor carga `.env` desde la raíz y respeta las variables ya presentes en
el entorno. `.env.example` documenta la configuración sin incluir secretos.
La comprobación de salud no necesita una clave de OpenAI y no llama a servicios
externos.

Por indicación del usuario se usa conexión directa: npm no tiene configurados
`proxy` ni `https-proxy`. No se ha inventado ningún valor de `HTTPS_PROXY` ni se
ha modificado `.env`.

## Comprobaciones de la interfaz

Dentro de `web/`:

```powershell
npm.cmd run check
npm.cmd run build
```

## Git y archivos locales

El `.gitignore` excluye `.env`, `.venv`, `node_modules`, las compilaciones, las
cachés y las bases de datos (`*.db`, `*.sqlite`, `*.sqlite3` y sus archivos
auxiliares). Los archivos de bloqueo de uv y npm sí se versionan.

Todo se ejecuta en este equipo. El proyecto no se ha desplegado ni publicado.

## Servidor RAG

`servidor.py` arranca FastAPI en el puerto **8000**. La lógica está en
`src/proyecto_final/rag.py` y los contratos HTTP en `src/proyecto_final/api.py`.
También sigue disponible el comando `uv run proyecto-final`.

Los datos son ficticios y se copian de los arrays `offers` y `records` de
`maquetas.html` a `datos/ofertas.json` y `datos/documentos.json`. Si cambias las
ofertas de la maqueta, vuelve a generar esos archivos y reinicia el servidor:

```powershell
uv run preparar_datos.py
uv run servidor.py
```

La preparación no consulta Booking.com, KAYAK ni lastminute.com. Conserva los
9 registros, las 3 ofertas y los precios totales para 2 adultos del 12 al 19 de
junio de 2027, con salida de Madrid y destino Mallorca.

### Clave e índice persistente

Pon `OPENAI_API_KEY` en `.env`. `.env.example` contiene los nombres de las
variables opcionales. Reinicia el servidor al cambiar modelo o configuración.
El modelo de respuesta predeterminado es `gpt-6-luna`, como en el `rag.py` de
referencia; se puede cambiar con `OPENAI_MODEL`. El modelo de embeddings es
`text-embedding-3-small`, configurable con `OPENAI_EMBEDDING_MODEL`.

En el primer arranque con clave se calculan embeddings de 12 fragmentos:
9 registros y 3 resúmenes de oferta. Los vectores normalizados y su firma se
guardan de forma atómica en `rag/indice.npz`. En arranques posteriores se carga
ese archivo sin recalcular el corpus. La firma incluye el contenido, los IDs,
el orden y el modelo: una corrección del texto, aunque no cambie el número de
registros, invalida el índice. Los archivos dañados también se reconstruyen.
`rag/` está excluida de Git.

Cada pregunta admitida se vectoriza para buscar por similitud coseno. El umbral
predeterminado es `0.30`, ajustable con `RAG_UMBRAL`. Por debajo del umbral no se
llama al modelo generativo. Los atributos no documentados, como mascotas, ruido
o meteorología, se rechazan antes de llamar a embeddings o generación: compartir
el nombre del hotel no constituye evidencia sobre esos atributos.

Las comparaciones filtran las condiciones del viaje y se calculan sobre las
ofertas que caben en el presupuesto. «Mejor precio» elige la de menor total;
«más completa» prioriza todo incluido, equipaje facturado, flexibilidad del hotel
y valoración. Para «calidad-precio» se escoge la más económica con al menos
4 estrellas, 8,5/10, desayuno y cancelación del hotel; si no hay ninguna, la más
económica disponible. Son criterios explícitos de esta demostración, no una
clasificación universal de hoteles.

El historial mantiene el contexto usando las condiciones de los mensajes del
usuario. Los mensajes del asistente no sustituyen los datos de los documentos.
El modelo recibe solo los registros recuperados y devuelve una estructura
Pydantic mediante Structured Outputs. Las citas se verifican en el servidor:
el ID debe estar entre los registros recuperados y el fragmento debe aparecer
literalmente en su contenido. Un precio total exige fuentes de hotel, vuelos
y extras. Un error de proveedor o una cita inválida devuelve un error HTTP,
sin presentar una respuesta fabricada como válida.

Referencias de implementación: [Structured Outputs de OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs)
y [embeddings de OpenAI](https://developers.openai.com/api/docs/guides/embeddings).

### POST /api/preguntar

Acepta este formato. En los turnos también se admiten los nombres `role` y
`content`; los roles permitidos son `user` y `assistant`.

```json
{
  "pregunta": "¿Y la más completa?",
  "historial": [
    {"rol": "user", "contenido": "Madrid a Mallorca, 12–19 junio 2027, 2 adultos, hasta 1.800 euros"}
  ]
}
```

Devuelve `respuesta`, `fuentes`, `estado`, `oferta`, `criterio`,
`modelo_consultado`, `motivo` y `datos_simulados`. Cada fuente incluye `id`,
`documento`, `titulo`, `portal`, `tipo`, `fragmento`, `similitud` y `url`.
El estado es `respondida` o `sin_datos`. En este último caso, la respuesta es
`No consta en los datos disponibles.`, las fuentes están vacías y la oferta es
`null`. La pregunta sobre mascotas devuelve además `modelo_consultado: false`.

Si falta la clave, documentos y negativas siguen disponibles; una pregunta que
requiere OpenAI devuelve **503** con el código `configuracion_openai`. Los
problemas del proveedor o de validación de citas devuelven **502**. Las entradas
inválidas devuelven **422**. No se devuelven credenciales en las respuestas.

### Comandos curl para las cuatro preguntas

Ejecuta estos comandos desde la raíz del proyecto, con el servidor arrancado.
Los archivos de `ejemplos/` contienen las preguntas exactas de la maqueta; los
seguimientos incluyen los turnos anteriores. Se usan archivos UTF-8 para evitar
los problemas de escapado de JSON de Windows PowerShell. `--noproxy` evita que un proxy global intercepte las peticiones a localhost.

```powershell
# Mejor relación calidad-precio: Marina Verde, 1.384 EUR.
curl.exe --noproxy 127.0.0.1 -sS --fail-with-body --json "@ejemplos/01-calidad-precio.json" http://127.0.0.1:8000/api/preguntar

# Mejor precio, manteniendo el contexto: Brisa de Palma, 1.068 EUR.
curl.exe --noproxy 127.0.0.1 -sS --fail-with-body --json "@ejemplos/02-mejor-precio.json" http://127.0.0.1:8000/api/preguntar

# Más completa: Bahía Serena Resort, 1.764 EUR.
curl.exe --noproxy 127.0.0.1 -sS --fail-with-body --json "@ejemplos/03-mas-completa.json" http://127.0.0.1:8000/api/preguntar

# ¿Marina Verde admite perros y cuánto cuesta llevar el mío? No consta.
curl.exe --noproxy 127.0.0.1 -sS --fail-with-body --json "@ejemplos/04-sin-datos.json" http://127.0.0.1:8000/api/preguntar
```

### GET /api/documentos

Devuelve los documentos con su contenido y metadatos, el total filtrado, el
total general, los portales y el número de ofertas. Admite `q` (ignora acentos),
`tipo` (`hotel`, `flight`, `extras`), `portal` y `orden` (`oferta`, `importe_asc`,
`importe_desc`, `portal`). Los importes son siempre para los dos adultos.
`GET /api/documentos/{id}` devuelve un registro completo; un ID desconocido
devuelve **404**.

```powershell
curl.exe --noproxy 127.0.0.1 -sS http://127.0.0.1:8000/api/documentos
curl.exe --noproxy 127.0.0.1 -sS "http://127.0.0.1:8000/api/documentos?tipo=hotel&q=bahia"
curl.exe --noproxy 127.0.0.1 -sS http://127.0.0.1:8000/api/documentos/BKG-014
```

Los mismos endpoints se pueden consultar en el puerto 5173 a través del proxy
de Vite. La interfaz Svelte utiliza esas rutas para consultar el RAG y los
documentos. `maquetas.html` se conserva como especificación visual.

### Interfaz Svelte

Las tres tarjetas iniciales envían las consultas de ejemplo al pulsarlas.
También puedes escribir tu pregunta; se envía con el historial. Cada respuesta
muestra sus fuentes y permite abrir el registro completo. Si el servidor indica
`sin_datos`, aparece el aviso de falta de evidencia sin inventar fuentes.
Los errores de conexión tienen un estado separado y permiten reintentar.

Documentos permite buscar, filtrar por portal o tipo, ordenar y exportar los
resultados a CSV. Comparar y Guardadas se construyen con las ofertas recibidas
en el chat; las guardadas se conservan mientras la aplicación permanece abierta.

Todas las peticiones de datos del navegador utilizan rutas relativas `/api/`.
La clave se carga únicamente en Python desde el `.env` de la raíz: no se copia
a `web/` ni se expone como una variable `VITE_*`.

Para comprobar tipos y generar la interfaz, desde `web/`:

```powershell
npm.cmd run check
npm.cmd run build
```

`dist/` contiene la compilación. Para desarrollo con el proxy `/api`, utiliza
`npm.cmd run dev`; el proxy no configura por sí solo un servidor de producción.

### Pruebas locales sin consumir API

```powershell
uv run python -m unittest discover -s tests -v
```

Se prueban las tres elecciones, las citas literales y completas, la negativa
sobre mascotas sin llamadas al proveedor, el umbral, el historial, la API, la
ausencia de clave, la reutilización e invalidación de la caché y la construcción
concurrente del índice. Se usan dobles del proveedor y directorios temporales;
no se alteran los embeddings reales ni se hacen llamadas de pago en estas pruebas.
