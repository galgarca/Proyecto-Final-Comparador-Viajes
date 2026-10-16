<script lang="ts">
  import { errorMessage, getDocuments } from '../api'
  import { money } from '../format'
  import type { DocumentList, DocumentType, RecordSelection } from '../types'
  import Icon from './Icon.svelte'

  let { initial, onrecord }: { initial: DocumentList | null; onrecord: (record: RecordSelection) => void } = $props()
  let result = $state<DocumentList | null>(null)
  let search = $state('')
  let filter = $state<DocumentType | 'all'>('all')
  let portal = $state('')
  let order = $state<'oferta' | 'importe_asc' | 'importe_desc' | 'portal'>('oferta')
  let loading = $state(true)
  let error = $state('')
  let refresh = $state(0)
  let downloadStatus = $state('')
  const filters: { value: DocumentType | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos' }, { value: 'hotel', label: 'Alojamientos' },
    { value: 'flight', label: 'Vuelos' }, { value: 'extras', label: 'Traslados y cargos' },
  ]

  $effect(() => {
    const options = { q: search.trim(), tipo: filter === 'all' ? undefined : filter, portal, orden: order }
    const retries = refresh
    const original = initial
    const controller = new AbortController()
    if (original && !options.q && !options.tipo && !portal && order === 'oferta' && retries === 0) {
      result = original; loading = false; error = ''
      return () => controller.abort()
    }
    loading = true; error = ''
    const timer = setTimeout(() => {
      getDocuments(options, controller.signal).then((data) => {
        if (!controller.signal.aborted) result = data
      }).catch((reason: unknown) => {
        if (!controller.signal.aborted) error = errorMessage(reason)
      }).finally(() => { if (!controller.signal.aborted) loading = false })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  })

  function count(value: DocumentType | 'all') {
    if (!initial) return null
    return value === 'all' ? initial.total_general : initial.documentos.filter((record) => record.tipo === value).length
  }

  function clearFilters() { search = ''; filter = 'all'; portal = ''; order = 'oferta' }

  function download() {
    if (!result?.documentos.length) return
    const cell = (value: unknown) => '"' + String(value).replace(/"/g, '""') + '"'
    const rows: unknown[][] = [['Referencia', 'Título', 'Portal simulado', 'Tipo', 'Importe EUR para dos adultos', 'Contenido']]
    for (const record of result.documentos) rows.push([record.id, record.titulo, record.portal, record.tipo_nombre, record.importe, record.contenido])
    const blob = new Blob(['\uFEFF' + rows.map((row) => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'rumbo-documentos-simulados.csv'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    downloadStatus = `${result.documentos.length} registros exportados.`
  }
</script>

<section class="documents-page" aria-labelledby="documents-title">
  <div class="section-heading"><div><div class="eyebrow">EL ORIGEN DE CADA RESPUESTA</div><h1 id="documents-title">Ofertas con las cartas sobre la mesa.</h1><p>Todo lo que el asistente sabe de tu viaje, en un mismo lugar.</p></div><button class="btn" type="button" onclick={download} disabled={loading || !result?.documentos.length}><Icon name="download" size={16} />Exportar CSV</button></div>
  <div class="stats-row"><div class="stat"><span class="round-icon"><Icon name="file" /></span><div><strong>{initial?.total_general ?? result?.total_general ?? '—'}</strong><p>Registros disponibles</p></div></div><div class="stat"><span class="round-icon"><Icon name="link" /></span><div><strong>{initial?.portales.length ?? result?.portales.length ?? '—'}</strong><p>Portales representados</p></div></div><div class="stat"><span class="round-icon"><Icon name="grid" /></span><div><strong>{initial?.ofertas ?? result?.ofertas ?? '—'}</strong><p>Ofertas comparables</p></div></div></div>
  <div class="search-tools"><label class="search-input" for="record-search"><Icon name="search" size={17} /><input id="record-search" type="search" placeholder="Buscar por hotel, portal o referencia…" maxlength="200" bind:value={search} /></label><label class="sr-only" for="portal-filter">Filtrar por portal</label><select id="portal-filter" class="sort-select" bind:value={portal}><option value="">Todos los portales</option>{#each initial?.portales ?? result?.portales ?? [] as name}<option value={name}>{name}</option>{/each}</select><label class="sr-only" for="record-sort">Ordenar registros</label><select id="record-sort" class="sort-select" bind:value={order}><option value="oferta">Por oferta</option><option value="importe_asc">Importe: menor a mayor</option><option value="importe_desc">Importe: mayor a menor</option><option value="portal">Por portal</option></select></div>
  <div class="filters" role="group" aria-label="Filtrar por tipo de registro">{#each filters as item}<button class:active={filter === item.value} class="filter" type="button" aria-pressed={filter === item.value} onclick={() => filter = item.value}>{item.label}{#if count(item.value) !== null}<span>{count(item.value)}</span>{/if}</button>{/each}{#if search || filter !== 'all' || portal}<button type="button" class="btn text clear-filters" onclick={clearFilters}>Limpiar filtros <Icon name="close" size={13} /></button>{/if}</div>
  {#if error}<div class="error-panel" role="alert"><Icon name="info" /><div><strong>No hemos podido cargar los registros.</strong><p>{error}</p><button class="btn" type="button" onclick={() => refresh++}>Volver a intentar</button></div></div>
  {:else}<div class="record-table-wrap" aria-busy={loading}><table class="record-table"><caption class="sr-only">Documentos disponibles para las recomendaciones de Rumbo</caption><thead><tr><th scope="col">Documento / registro</th><th scope="col">Portal simulado</th><th scope="col">Tipo</th><th scope="col">Importe · grupo</th><th scope="col"><span class="sr-only">Abrir registro</span></th></tr></thead><tbody>
    {#if loading}{#each [1, 2, 3, 4, 5] as placeholder}<tr class="skeleton-row" aria-hidden="true"><td colspan="5"><span class="skeleton" style={`width:${placeholder % 2 ? 82 : 65}%`}></span></td></tr>{/each}
    {:else}{#each result?.documentos ?? [] as record (record.id)}<tr class="record-row"><td><button class="record-name record-name-button" type="button" onclick={() => onrecord({ id: record.id })}><span class="record-icon"><Icon name={record.tipo === 'flight' ? 'plane' : record.tipo === 'extras' ? 'car' : 'file'} size={17} /></span><span><b>{record.titulo}</b><small>{record.id} · {record.adultos} adultos · {record.noches} noches</small></span></button></td><td><span class="portal" class:booking={record.portal === 'Booking.com'} class:kayak={record.portal === 'KAYAK'} class:lastminute={record.portal === 'lastminute.com'}>{record.portal}</span></td><td><span class="badge gray">{record.tipo_nombre}</span></td><td><span class="record-price">{money(record.importe)}</span></td><td><button class="record-view" type="button" aria-label={`Leer registro ${record.id}`} onclick={() => onrecord({ id: record.id })}><Icon name="up-right" size={15} /></button></td></tr>{/each}{/if}
  </tbody></table>{#if !loading && result?.total === 0}<div class="empty-state"><span class="round-icon"><Icon name="search" /></span><h2>No encontramos registros con esos filtros.</h2><p>Prueba otro hotel, una referencia o un portal.</p><button type="button" class="btn" onclick={clearFilters}>Ver todos los registros</button></div>{/if}</div>{/if}
  <div class="table-footer"><span role="status">{loading ? 'Buscando registros…' : error ? 'Registros no disponibles' : `Mostrando ${result?.total ?? 0} de ${result?.total_general ?? 0} registros`}</span><span>{result?.conjunto_datos ?? initial?.conjunto_datos ?? ''}</span></div>
  <span class="sr-only" role="status">{downloadStatus}</span>
  <div class="local-note"><Icon name="info" size={17} /><p><strong>Biblioteca de demostración.</strong> Los portales contextualizan el ejemplo. Las ofertas y los fragmentos son ficticios; no representan disponibilidad real.</p></div>
</section>
