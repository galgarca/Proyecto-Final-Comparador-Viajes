<script lang="ts">
  import { errorMessage, getDocument } from '../api'
  import { dateLabel, money } from '../format'
  import type { DocumentRecord, RecordSelection } from '../types'
  import Icon from './Icon.svelte'

  let { selection, onclose }: { selection: RecordSelection | null; onclose: () => void } = $props()
  let dialog = $state<HTMLDialogElement>()
  let record = $state<DocumentRecord | null>(null)
  let loading = $state(false)
  let error = $state('')
  let retry = $state(0)
  let copyStatus = $state('')

  $effect(() => {
    const id = selection?.id
    const version = retry
    if (!dialog) return
    if (!id) { if (dialog.open) dialog.close(); return }
    if (!dialog.open) dialog.showModal()
    const controller = new AbortController()
    record = null; loading = true; error = ''; copyStatus = ''
    getDocument(id, controller.signal).then((value) => {
      if (!controller.signal.aborted) record = value
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) error = errorMessage(reason)
    }).finally(() => { if (!controller.signal.aborted) loading = false })
    void version
    return () => controller.abort()
  })

  function backdrop(event: MouseEvent) {
    if (event.target !== dialog || !dialog) return
    const bounds = dialog.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close()
  }

  async function copy() {
    if (!record) return
    try { await navigator.clipboard.writeText(`${record.id} · ${record.portal}\n${record.contenido}`); copyStatus = 'Registro copiado.' }
    catch { copyStatus = 'Selecciona el texto del registro para copiarlo manualmente.' }
  }
</script>

<dialog bind:this={dialog} class="document-dialog" aria-labelledby="document-title" onclose={onclose} onclick={backdrop}>
  <div class="modal-head"><div><div class="eyebrow">EL ORIGEN DEL DATO</div><h2 id="document-title">{record?.titulo ?? (loading ? 'Cargando registro…' : 'Detalle del registro')}</h2></div><button class="close-modal" type="button" aria-label="Cerrar registro" onclick={() => dialog?.close()}><Icon name="close" size={17} /></button></div>
  <div class="modal-body" aria-busy={loading}>
    {#if loading}<div class="modal-skeleton" role="status"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><p>Cargando el documento original…</p></div>
    {:else if error}<div class="error-panel" role="alert"><Icon name="info" /><div><p>{error}</p><button type="button" class="btn" onclick={() => retry++}>Volver a intentar</button></div></div>
    {:else if record}<span class="badge sand"><Icon name="info" size={13} />Registro ficticio · demostración</span><dl class="modal-meta"><div><dt>Referencia</dt><dd>{record.id}</dd></div><div><dt>Portal representado</dt><dd>{record.portal}</dd></div><div><dt>Tipo</dt><dd>{record.tipo_nombre}</dd></div><div><dt>Importe · {record.adultos} adultos</dt><dd>{money(record.importe)}</dd></div><div><dt>Fechas del viaje</dt><dd>{dateLabel(record.fecha_inicio)} — {dateLabel(record.fecha_fin)}</dd></div><div><dt>Procedencia</dt><dd>{record.documento}</dd></div></dl><h3>{selection?.quote ? 'Fragmento citado en la respuesta' : 'Fragmento del registro'}</h3><blockquote class="record-excerpt">{selection?.quote ?? record.fragmento}</blockquote><h3>Contenido completo del registro</h3><p class="record-full">{record.contenido}</p><div class="local-note"><Icon name="shield" size={16} /><p>Datos simulados para este viaje. Esta ficha no procede de una consulta en tiempo real al portal.</p></div>{/if}
    <p class="copy-status" role="status">{copyStatus}</p>
  </div>
  <div class="modal-bottom"><button class="btn" type="button" onclick={() => dialog?.close()}>Cerrar</button>{#if record}<button class="btn primary" type="button" onclick={copy}><Icon name="copy" size={15} />Copiar registro</button>{/if}</div>
</dialog>
