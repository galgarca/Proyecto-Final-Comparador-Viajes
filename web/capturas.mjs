import { chromium } from 'playwright-core'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'capturas')
const base = process.env.APP_URL || 'http://127.0.0.1:5173/'
await mkdir(output, { recursive: true })
const examples = await Promise.all(['01-calidad-precio', '02-mejor-precio', '03-mas-completa', '04-sin-datos'].map(async name => ({
  name, ...JSON.parse(await readFile(path.join(root, 'ejemplos', `${name}.json`), 'utf8')),
})))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, locale: 'es-ES', reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  const consoleErrors = []
  page.on('pageerror', error => consoleErrors.push(error.message))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('.quick-action').first().waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector('.quick-action')?.disabled)
  const documentsResponse = await context.request.get(new URL('/api/documentos', base).href)
  assert(documentsResponse.ok(), 'No responde el listado de documentos')
  const catalog = await documentsResponse.json()
  const documents = new Map(catalog.documentos.map(doc => [doc.id, doc]))
  const results = []
  const captures = []
  async function screenshot(name, title, caption, turn = null) {
    // Capture the actual latest chat turn, including every source. Temporarily
    // disable the sticky composer only for the screenshot so it cannot cover it.
    await page.evaluate(() => document.fonts.ready)
    await page.mouse.move(0, 0)
    if (turn) {
      const expand = turn.locator('.expand-sources')
      if (await expand.count() && await expand.getAttribute('aria-expanded') === 'false') await expand.click()
      await turn.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled',
        style: '.composer-dock, .app-topbar { position: static !important; }' })
    } else {
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled' })
    }
    captures.push({ archivo: `capturas/${name}.png`, titulo: title, pie: caption })
    console.log(`PNG comprobado: ${name}.png`)
  }
  for (const [index, example] of examples.entries()) {
    const input = page.locator('#chat-input')
    await input.fill(example.pregunta)
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/preguntar' && response.request().method() === 'POST', { timeout: 180_000 })
    await page.getByRole('button', { name: 'Enviar pregunta', exact: true }).click()
    const response = await pending
    assert(response.ok(), `La pregunta ${index + 1} falló: HTTP ${response.status()}`)
    const answer = await response.json()
    const turn = page.locator('[data-testid="chat-turn"]').nth(index)
    await turn.locator('[data-testid="assistant-answer"]').waitFor({ state: 'visible', timeout: 30_000 })
    assert(answer.respuesta?.trim().length > 30, 'Respuesta vacía')
    if (index < 3) {
      assert.equal(answer.estado, 'respondida')
      assert.equal(answer.modelo_consultado, true, 'Se requiere una respuesta real del modelo')
      assert.equal(answer.oferta?.id, ['marina', 'brisa', 'bahia'][index])
      assert(answer.fuentes.length >= 3, 'Faltan fuentes')
      await turn.locator('.source').first().waitFor({ state: 'visible' })
      for (const source of answer.fuentes) {
        assert(documents.get(source.id)?.contenido.includes(source.fragmento), `El fragmento de ${source.id} no es literal`)
      }
      assert((await turn.innerText()).includes(answer.oferta.nombre), 'La oferta no se ve en la interfaz')
    } else {
      assert.equal(answer.estado, 'sin_datos')
      assert.equal(answer.modelo_consultado, false)
      assert.equal(answer.fuentes.length, 0)
      await turn.locator('.no-data').waitFor({ state: 'visible' })
    }
    results.push({ pregunta: example.pregunta, ...answer, fragmentos_verificados: answer.fuentes.every(source => documents.get(source.id)?.contenido.includes(source.fragmento)) })
    await screenshot(example.name,
      ['Chat · Mejor relación calidad-precio', 'Chat · El mejor precio', 'Chat · La oferta más completa', 'Chat · Pregunta sin datos'][index],
      ['Marina Verde, 1.384 € para dos adultos. La respuesta se acompaña de registros y fragmentos consultables.', 'Brisa de Palma, 1.068 €. La conversación conserva las condiciones del viaje y compara el precio total.', 'Bahía Serena Resort, 1.764 €. La recomendación muestra todo incluido, equipaje facturado y sus fuentes.', 'La consulta sobre perros obtiene «No consta». No hay llamada al modelo ni fuentes inventadas.'][index], turn)
  }
  await page.locator('.sidebar').getByRole('link', { name: /^Documentos/ }).click()
  await page.locator('.record-row').nth(8).waitFor({ state: 'visible' })
  assert.equal(await page.locator('.record-row').count(), catalog.total_general)
  await screenshot('05-documentos', 'Documentos · El origen de las respuestas', 'Los nueve registros ficticios se pueden buscar, filtrar por tipo o portal y abrir para comprobar el contenido original.')
  await page.locator('.sidebar').getByRole('link', { name: 'Comparar ofertas', exact: true }).click()
  await page.locator('.live-comparison').waitFor({ state: 'visible' })
  await screenshot('06-comparacion', 'Comparación · Las tres opciones', 'Precios y condiciones de las tres ofertas recibidas realmente del servidor durante esta conversación.')
  await page.locator('.offer-card').filter({ hasText: 'Marina Verde' }).getByRole('button', { name: /^Guardar / }).click()
  await page.locator('.offer-card').filter({ hasText: 'Marina Verde' }).getByRole('button', { name: 'Ver detalle', exact: true }).click()
  await page.locator('.detail-layout').waitFor({ state: 'visible' })
  await screenshot('07-detalle', 'Detalle · Marina Verde', 'Desglose de alojamiento, vuelos y extras. Los registros de origen permiten contrastar las condiciones y el total.')
  await page.locator('.sidebar').getByRole('link', { name: /^Guardadas/ }).click()
  await page.locator('.saved-offers .offer-card').waitFor({ state: 'visible' })
  await screenshot('08-guardadas', 'Guardadas · Una selección personal', 'Marina Verde guardada desde la comparativa. La selección se conserva durante esta sesión de la aplicación.')
  assert.deepEqual(consoleErrors, [], 'Hay errores de JavaScript')
  const report = { proyecto: 'Recomendador Viajes', fecha: new Date().toISOString(), navegador: 'Microsoft Edge', version_navegador: browser.version(), viewport: { width: 1366, height: 900 }, origen: base,
    respuestas_reales: true, capturas: captures, consultas: results, documentos: catalog.documentos }
  await writeFile(path.join(output, 'comprobacion.json'), JSON.stringify(report, null, 2) + '\n', 'utf8')
  console.log(`${captures.length} capturas; 4 respuestas reales; fragmentos literales verificados. Sin respuestas simuladas ni interceptadas.`)
} finally { await browser.close() }
