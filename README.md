# Rumbo · Proyecto local

Base de desarrollo para el recomendador de vacaciones: servidor FastAPI con
Python y uv, e interfaz Vite + Svelte + TypeScript. La página inicial muestra
las maquetas originales de Rumbo desde `maquetas.html`, servidas por FastAPI
en `/api/maquetas` a través del proxy de Vite. También se puede abrir el HTML
directamente en el navegador. Es un prototipo con datos ficticios.

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
uv run proyecto-final
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
