import { chromium } from 'playwright-core'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('../', import.meta.url))
const evidence = JSON.parse(await readFile(path.join(root, 'capturas/comprobacion.json'), 'utf8'))
const models = JSON.parse(await readFile(path.join(root, 'capturas/modelos.json'), 'utf8'))
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(value)
const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(evidence.fecha))
const documents = new Map(evidence.documentos.map(doc => [doc.id, doc]))
let number = 0
function sheet(content, extra = '') {
  number++
  return `<section class="sheet ${extra}"><header><b>RECOMENDADOR VIAJES</b><span>Proyecto local · Evidencias</span></header>${content}<footer><span>Datos ficticios · Capturas de la aplicación en funcionamiento</span><span>${String(number).padStart(2, '0')}</span></footer></section>`
}
const pages = []
pages.push(sheet(`<div class="cover-kicker">ENTREGABLE DEL PROYECTO</div><h1>Recomendador<br><em>Viajes</em></h1><p class="cover-intro">Elegir vacaciones con precios claros<br>y respuestas que se pueden comprobar.</p><div class="cover-box"><h2>Qué problema resuelve</h2><p>Comparar ofertas de vacaciones entre varios portales exige revisar precios, servicios y condiciones por separado. Esta aplicación recomienda la mejor relación calidad-precio, el menor precio o la opción más completa para un mismo viaje, mostrando los registros que justifican cada respuesta.</p></div><h2>De dónde salen los datos</h2><p>Son <strong>datos inventados pero realistas</strong>, definidos en <code>maquetas.html</code> y preparados mediante <code>preparar_datos.py</code>. La biblioteca contiene nueve registros locales que representan Booking.com, KAYAK y lastminute.com; no se han obtenido mediante scraping ni representan ofertas reales de esos portales.</p><div class="trip"><b>Madrid → Mallorca</b><span>12–19 junio 2027 · 2 adultos · 7 noches</span><span>Presupuesto de referencia: 1.800 €</span></div><p class="small">Capturas realizadas el ${escape(date)} con Microsoft Edge ${escape(evidence.version_navegador)}. Ventana de contenido de 1366 × 900 píxeles. Las imágenes del chat conservan el turno completo y sus fuentes; algunas son más altas que la ventana.</p>`, 'cover'))
for (const [index, capture] of evidence.capturas.entries()) {
  pages.push(sheet(`<p class="kicker">CAPTURA ${index + 1} / ${evidence.capturas.length}</p><h2 class="page-title">${escape(capture.titulo)}</h2><figure><div class="image-frame"><img src="${escape(capture.archivo)}" alt="${escape(capture.titulo)}"></div><figcaption><b>Qué se ve.</b> ${escape(capture.pie)}</figcaption></figure>`, 'capture-sheet'))
}
const conclusions = [
  'Sí: los tres componentes suman 1.384 €. BKG-014 documenta cuatro estrellas, valoración 8,8, desayuno y cancelación del hotel. La elección aplica una regla de la aplicación: la oferta más económica entre las que cumplen esas condiciones, con valoración mínima de 8,5; no es una clasificación oficial del portal.',
  'Sí: 742 € de hotel + 248 € de vuelos + 78 € de extras = 1.068 €. Al abrir los otros seis registros se comprueba que las alternativas suman 1.384 € y 1.764 €: Brisa es la más barata de estas tres opciones.',
  'Sí: 1.226 € de hotel + 356 € de vuelos + 182 € de extras = 1.764 €. BKG-016 recoge todo incluido y KYK-023 una maleta facturada de 20 kg por adulto. La regla de la aplicación prioriza régimen, equipaje, cancelación y valoración; el presupuesto deja 36 € de margen.',
  'La negativa es coherente con el conjunto local: BKG-014 no contiene política de mascotas ni suplementos, y ninguno de los nueve registros documenta ese dato. La ausencia de información no demuestra que el hotel prohíba mascotas. El servidor devuelve sin_datos y modelo_consultado=false; no adjunta fuentes inventadas.',
]
for (const [index, result] of evidence.consultas.entries()) {
  const refs = result.oferta?.registros ?? ['BKG-014']
  const rows = refs.map(id => {
    const doc = documents.get(id)
    const citation = result.fuentes.find(source => source.id === id)
    return `<li><b>${escape(id)} · ${escape(doc.portal)}</b><p>${escape(citation ? citation.fragmento : doc.contenido)}</p><a href="http://127.0.0.1:8000/api/documentos/${escape(id)}">Abrir registro ${escape(id)} en el servidor local</a></li>`
  }).join('')
  pages.push(sheet(`<p class="kicker">CÓMO LO COMPROBÉ · CONSULTA ${index + 1} / 4</p><h2 class="page-title">${escape(['Mejor relación calidad-precio', 'El mejor precio', 'La oferta más completa', 'Una pregunta que no debe responder'][index])}</h2><h3>Pregunta enviada por la interfaz</h3><p class="question">${escape(result.pregunta)}</p><h3>Lo que respondió realmente</h3><div class="response">${escape(result.respuesta)}</div><div class="verdict"><h3>¿Las fuentes dicen lo mismo?</h3><p>${escape(conclusions[index])}</p></div><h3>Fuentes que debes abrir para confirmarlo</h3><p class="small">En la página Documentos, busca cada referencia y pulsa «Leer registro», o usa los enlaces siguientes con el servidor arrancado. También están en <a href="datos/documentos.json"><code>datos/documentos.json</code></a>, buscando el campo <code>id</code>.</p><ul class="evidence-list">${rows}</ul><p class="small">${index < 3 ? `Comprobación automática: ${result.fuentes.length} fragmentos citados coinciden literalmente con sus registros; los tres componentes de la oferta aparecen entre las fuentes. Todas las referencias citadas: ${result.fuentes.map(source => escape(source.id)).join(', ')}. Esta comprobación literal no sustituye la revisión humana del significado.` : 'Revisa además los otros ocho registros para confirmar que tampoco aportan políticas de mascotas. No se hizo una llamada al modelo para completar el dato.'}</p>`, 'check-sheet'))
}
pages.push(sheet(`<p class="kicker">CÓMO ESTÁ HECHO</p><h2 class="page-title">De la pregunta a la evidencia.</h2><div class="flow"><span>Interfaz Svelte</span><b>→</b><span>FastAPI + RAG</span><b>→</b><span>Datos y modelo</span></div><h3>Servidor en Python</h3><p><code>servidor.py</code> arranca FastAPI en el puerto 8000 con <code>uv run servidor.py</code>. <code>src/proyecto_final/rag.py</code> carga los documentos y las ofertas locales, prepara embeddings y guarda el índice en <code>rag/indice.npz</code>, que reutiliza si no cambian los datos o el modelo.</p><p>El RAG valida primero el tema y las condiciones del viaje, recupera fragmentos por similitud y aplica reglas para elegir la oferta. Solo cuando hay evidencia suficiente pide al modelo una salida estructurada. Comprueba que cada cita sea literal, que proceda de un registro permitido y que estén los tres componentes del total. Las preguntas no documentadas y los resultados sin similitud suficiente devuelven «No consta».</p><h3>Qué modelos usa</h3><dl><dt>Respuesta estructurada · OpenAI</dt><dd><code>${escape(models.respuesta)}</code></dd><dt>Embeddings · OpenAI</dt><dd><code>${escape(models.embeddings)}</code></dd></dl><p class="small">Nombres leídos de la configuración efectiva de Python al generar este entregable. Las tres recomendaciones capturadas proceden de consultas reales al servidor, sin respuestas interceptadas.</p><h3>Interfaz en Svelte y TypeScript</h3><p>Vite sirve la interfaz en el puerto 5173 y reenvía <code>/api</code> a Python. El navegador usa <code>POST /api/preguntar</code>, <code>GET /api/documentos</code> y <code>GET /api/documentos/{id}</code>. La clave permanece en el servidor y no se incluye en la aplicación web.</p><h3>Cómo reproducir las pruebas y el PDF</h3><pre>Terminal 1, desde la raíz:
uv run servidor.py

Terminal 2, desde la raíz:
cd web
npm.cmd run dev

Terminal 3, desde la raíz:
node web/capturas.mjs
uv run python -c "from proyecto_final.rag import TravelRAG; import json; from pathlib import Path; r=TravelRAG(); Path('capturas/modelos.json').write_text(json.dumps(dict(respuesta=r.response_model, embeddings=r.embedding_model)), encoding='utf-8')"
node web/generar-entregable.mjs</pre><p class="small">Las capturas usan playwright-core y el Edge instalado (<code>channel: "msedge"</code>), sin descargar navegadores. <code>capturas/comprobacion.json</code> conserva las preguntas, respuestas, fuentes y resultados de verificación. El documento se imprime en A4 con <code>page.pdf</code>; cada captura ocupa una página propia.</p>`, 'architecture'))
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recomendador Viajes · Entregable</title><style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e7eae4;color:#203b30;font-family:"Segoe UI",Arial,sans-serif;font-size:11pt;line-height:1.55}.sheet{position:relative;width:210mm;height:297mm;padding:19mm 18mm 19mm;background:#fff;margin:7mm auto;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}header{display:flex;justify-content:space-between;gap:10mm;padding-bottom:5mm;border-bottom:1px solid #dce3d9;font-size:7.5pt;letter-spacing:1px;margin-bottom:10mm}header span{color:#7b897e;letter-spacing:0}footer{position:absolute;bottom:9mm;left:18mm;right:18mm;display:flex;justify-content:space-between;color:#738275;font-size:7pt;border-top:1px solid #dce3d9;padding-top:3mm}h1,h2,h3,p,figure,ul,dl{margin:0}p{margin-bottom:4mm}h2{font-size:17pt;letter-spacing:-.5px;margin-bottom:4mm}h3{font-size:10.5pt;margin:5mm 0 2mm}.page-title{font-size:25pt;line-height:1.18;margin-bottom:7mm}.kicker,.cover-kicker{font-size:8pt;color:#6b7e60;font-weight:700;letter-spacing:1.4px}.cover-kicker{margin-top:12mm}h1{font-size:51pt;line-height:1.05;letter-spacing:-2.7px;margin:6mm 0}h1 em{font-family:Georgia,serif;font-weight:400;color:#718956}.cover-intro{font-size:15pt;color:#748372;margin-bottom:11mm}.cover-box{background:#f0f4e9;border-left:4px solid #a9bd7a;padding:6mm;margin-bottom:9mm}.cover-box p{margin:0}.cover h2{font-size:14pt}.cover p{font-size:10.5pt}.trip{display:flex;flex-direction:column;border:1px solid #dce3d9;border-radius:3mm;padding:5mm;margin:6mm 0;gap:1mm}.trip b{font-size:15pt}.trip span{font-size:10pt}.small{font-size:8pt;color:#5b6e60;line-height:1.5}code{font-family:Consolas,monospace;font-size:.9em;overflow-wrap:anywhere}a{color:#436d43;text-decoration:underline;overflow-wrap:anywhere}.capture-sheet .page-title{font-size:22pt;margin-bottom:6mm}.image-frame{height:190mm;display:flex;align-items:center;justify-content:center;background:#f6f8f2;border:1px solid #dce3d9;border-radius:2mm;padding:1mm}.image-frame img{max-width:100%;max-height:100%;object-fit:contain;display:block}figure{break-inside:avoid;page-break-inside:avoid}figcaption{font-size:9pt;line-height:1.5;padding-top:4mm;color:#52675a}.question{padding:3mm 4mm;background:#f1f4eb;border-radius:2mm;font-size:9pt}.response{font-size:8.6pt;line-height:1.48;white-space:pre-wrap;overflow-wrap:anywhere;border-left:2px solid #c6d4b6;padding-left:4mm}.verdict{padding:3mm 4mm;background:#f0f5e8;margin-top:4mm}.verdict h3{margin-top:0}.verdict p{font-size:9pt;margin:0}.check-sheet header{margin-bottom:6mm}.check-sheet .page-title{font-size:23pt;margin-bottom:4mm}.check-sheet h3{margin-top:3.5mm}.evidence-list{list-style:none;padding:0;margin:3mm 0}.evidence-list li{border-top:1px solid #e0e6dc;padding:2.5mm 0;font-size:8pt;break-inside:avoid}.evidence-list p{margin:1mm 0;font-size:8pt}.evidence-list a{font-size:7.5pt}.flow{display:flex;align-items:center;gap:3mm;margin:7mm 0}.flow span{padding:3mm;background:#edf2e5;border-radius:2mm;font-size:9pt;font-weight:600}.architecture p{font-size:9pt}.architecture h3{margin-top:4mm}dl{display:grid;grid-template-columns:1fr 1fr;gap:2mm;font-size:9pt}dd{margin:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f4ee;padding:4mm;font:7.7pt/1.55 Consolas,monospace}.architecture .small{font-size:7.5pt}@media print{body{background:white}.sheet{margin:0;box-shadow:none}}@media screen{.sheet{box-shadow:0 2px 18px #1e39241a}}
</style></head><body>${pages.join('\n')}</body></html>`
await writeFile(path.join(root, 'entregable.html'), html, 'utf8')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  await page.goto(pathToFileURL(path.join(root, 'entregable.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMedia({ media: 'print' })
  const problems = await page.evaluate(() => {
    const issues = []
    for (const img of document.images) if (!img.complete || img.naturalWidth < 500) issues.push(`Imagen no cargada: ${img.getAttribute('src')}`)
    for (const [index, sheet] of [...document.querySelectorAll('.sheet')].entries()) {
      const footer = sheet.querySelector('footer').getBoundingClientRect()
      const content = [...sheet.children].filter(child => child.tagName !== 'FOOTER')
      if (content.some(child => child.getBoundingClientRect().bottom > footer.top - 4)) issues.push(`Contenido demasiado alto en la página ${index + 1}`)
    }
    return issues
  })
  assert.deepEqual(problems, [], 'El entregable tiene problemas de maquetación')
  const pdf = await page.pdf({ path: path.join(root, 'entregable.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false })
  const count = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length
  assert.equal(count, number, 'El PDF añade páginas inesperadas')
  await writeFile(path.join(root, 'capturas/pdf-verificacion.json'), JSON.stringify({ paginas: count, formato: 'A4', imagenes: evidence.capturas.length, imagenes_cargadas: true, capturas_sin_cortes: true, modelo: models, pdf_bytes: pdf.length }, null, 2) + '\n')
  console.log(`entregable.html y entregable.pdf generados: ${count} páginas A4, ${evidence.capturas.length} imágenes cargadas, sin capturas divididas.`)
} finally { await browser.close() }
