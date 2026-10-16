<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { askQuestion, errorMessage, getDocuments } from './lib/api'
  import { capitalized, dateLabel, money, rating } from './lib/format'
  import type { ChatTurn, Criterion, DocumentList, HistoryTurn, Offer, RecordSelection, View } from './lib/types'
  import Artwork from './lib/components/Artwork.svelte'
  import DetailView from './lib/components/DetailView.svelte'
  import DocumentDialog from './lib/components/DocumentDialog.svelte'
  import DocumentsView from './lib/components/DocumentsView.svelte'
  import Icon from './lib/components/Icon.svelte'
  import NoData from './lib/components/NoData.svelte'
  import OfferCard from './lib/components/OfferCard.svelte'
  import ResponseText from './lib/components/ResponseText.svelte'
  import Sources from './lib/components/Sources.svelte'
  import SvgSprite from './lib/components/SvgSprite.svelte'

  let view = $state<View>('chat')
  let catalog = $state<DocumentList | null>(null)
  let catalogLoading = $state(true)
  let catalogError = $state('')
  let turns = $state<ChatTurn[]>([])
  let draft = $state('')
  let knownOffers = $state<Offer[]>([])
  let offerCriteria = $state<Record<string, Criterion | null>>({})
  let savedIds = $state<string[]>([])
  let selectedOffer = $state<Offer | null>(null)
  let recordSelection = $state<RecordSelection | null>(null)
  let notice = $state('')
  let mainElement = $state<HTMLElement>()
  let composer = $state<HTMLTextAreaElement>()
  let nextId = 1
  let requestController: AbortController | null = null
  let catalogController: AbortController | null = null
  let noticeTimer: ReturnType<typeof setTimeout>
  let busy = $derived(turns.some((turn) => turn.status === 'pending'))
  let trip = $derived(catalog?.documentos[0])
  let savedOffers = $derived(knownOffers.filter((offer) => savedIds.includes(offer.id)))
  const referenceBudget = 1800
  const viewHashes: Record<View, string> = { chat: 'asistente', documents: 'documentos', compare: 'comparar', saved: 'guardadas', detail: 'detalle' }
  const titles: Record<View, string> = { chat: 'Asistente de viajes', documents: 'Documentos y registros', compare: 'Comparar ofertas', saved: 'Tus ofertas guardadas', detail: 'Detalle de la oferta' }
  const choices: { criterion: Criterion; label: string; icon: string; description: string; question: string }[] = [
    { criterion: 'calidad_precio', label: 'Calidad · precio', icon: 'spark', description: 'Equilibra valoración, servicios y flexibilidad.', question: '¿Qué oferta tiene la mejor relación calidad-precio?' },
    { criterion: 'precio', label: 'El mejor precio', icon: 'wallet', description: 'Encuentra el total más bajo para vuestro viaje.', question: 'Con las mismas fechas, viajeros, destino y presupuesto, ¿cuál tiene el mejor precio?' },
    { criterion: 'completa', label: 'La más completa', icon: 'sun', description: 'Más servicios y menos cosas que organizar.', question: 'Y con las mismas fechas, viajeros, destino y presupuesto, ¿qué oferta es la más completa?' },
  ]

  async function loadCatalog() {
    catalogController?.abort()
    const controller = new AbortController()
    catalogController = controller
    catalogLoading = true; catalogError = ''
    try { catalog = await getDocuments({}, controller.signal) }
    catch (error) { if (!controller.signal.aborted) catalogError = errorMessage(error) }
    finally { if (!controller.signal.aborted) catalogLoading = false }
  }

  function viewFromHash(): View {
    const match = (Object.keys(viewHashes) as View[]).find((key) => viewHashes[key] === window.location.hash.slice(1))
    return match === 'detail' && !selectedOffer ? 'compare' : match ?? 'chat'
  }

  onMount(() => {
    view = viewFromHash()
    void loadCatalog()
    const syncNavigation = () => { view = viewFromHash(); window.scrollTo({ top: 0 }); void tick().then(() => mainElement?.focus({ preventScroll: true })) }
    window.addEventListener('hashchange', syncNavigation)
    window.addEventListener('popstate', syncNavigation)
    return () => {
      window.removeEventListener('hashchange', syncNavigation)
      window.removeEventListener('popstate', syncNavigation)
      requestController?.abort(); catalogController?.abort(); clearTimeout(noticeTimer)
    }
  })

  function navigate(next: View) {
    view = next
    window.history.pushState(null, '', `#${viewHashes[next]}`)
    window.scrollTo({ top: 0 })
    void tick().then(() => mainElement?.focus({ preventScroll: true }))
  }

  function navClick(event: MouseEvent, next: View) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault(); navigate(next)
  }

  function toast(message: string) {
    notice = message; clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => notice = '', 3500)
  }

  function toggleSave(offer: Offer) {
    const exists = savedIds.includes(offer.id)
    savedIds = exists ? savedIds.filter((id) => id !== offer.id) : [...savedIds, offer.id]
    toast(exists ? 'Oferta eliminada de tus guardadas.' : 'Oferta guardada para esta sesión.')
  }

  function showDetail(offer: Offer) { selectedOffer = offer; navigate('detail') }
  function showRecord(record: RecordSelection) { recordSelection = record }

  function history(): HistoryTurn[] {
    const reference: HistoryTurn[] = trip ? [{ rol: 'user', contenido: `Viaje de referencia: origen ${trip.origen}, destino ${trip.destino}, fechas ${trip.fecha_inicio} a ${trip.fecha_fin}, ${trip.adultos} adultos, ${trip.noches} noches, presupuesto de ${referenceBudget} euros.` }] : []
    const completed = turns.filter((turn) => turn.status === 'success' && turn.answer).slice(-9)
    return [...reference, ...completed.flatMap((turn): HistoryTurn[] => [
      { rol: 'user', contenido: turn.question },
      { rol: 'assistant', contenido: turn.answer!.respuesta.slice(0, 4000) },
    ])]
  }

  async function send(question: string, retryId?: number) {
    const text = question.trim()
    if (!text || text.length > 2000 || busy || !catalog) return
    const previous = history()
    const id = retryId ?? nextId++
    if (retryId !== undefined) turns = turns.map((turn) => turn.id === id ? { ...turn, status: 'pending', error: undefined } : turn)
    else turns = [...turns, { id, question: text, status: 'pending' }]
    draft = ''
    const controller = new AbortController()
    requestController = controller
    await tick()
    document.getElementById(`turn-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    try {
      const answer = await askQuestion(text, previous, controller.signal)
      turns = turns.map((turn) => turn.id === id ? { ...turn, status: 'success', answer } : turn)
      if (answer.oferta) {
        const offer = answer.oferta
        knownOffers = [...knownOffers.filter((item) => item.id !== offer.id), offer]
        offerCriteria = { ...offerCriteria, [offer.id]: answer.criterio }
      }
    } catch (error) {
      if (!controller.signal.aborted) turns = turns.map((turn) => turn.id === id ? { ...turn, status: 'error', error: errorMessage(error) } : turn)
    } finally { if (requestController === controller) requestController = null }
  }

  function askChoice(question: string) { if (view !== 'chat') navigate('chat'); void send(question) }
  function resetConversation() {
    if (busy) return
    turns = []; draft = ''; navigate('chat')
    void tick().then(() => composer?.focus({ preventScroll: true }))
  }

  function submit(event: SubmitEvent) { event.preventDefault(); void send(draft) }
  function composerKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault(); void send(draft)
    }
  }
</script>

<svelte:head><title>Rumbo · {titles[view]}</title><meta name="description" content="Elige tus vacaciones con recomendaciones basadas en documentos, precios claros y fuentes consultables." /></svelte:head>

<SvgSprite />
<a class="skip-link" href="#main" onclick={(event) => { event.preventDefault(); mainElement?.focus() }}>Saltar al contenido</a>
<div class="app-shell live-app">
  <aside class="sidebar" aria-label="Navegación principal">
    <a class="brand" href="#asistente" onclick={(event) => navClick(event, 'chat')} aria-label="Rumbo, ir al asistente"><Icon name="logo" size={33} />rumbo.</a>
    <button class="new-trip" type="button" disabled={busy} onclick={resetConversation}><Icon name="plus" size={17} />Nueva conversación</button>
    <p class="nav-label">TU ESPACIO</p>
    <nav aria-label="Secciones de Rumbo"><a class="nav-link" class:active={view === 'chat'} href="#asistente" aria-current={view === 'chat' ? 'page' : undefined} onclick={(event) => navClick(event, 'chat')}><Icon name="chat" />Asistente</a><a class="nav-link" class:active={view === 'documents'} href="#documentos" aria-current={view === 'documents' ? 'page' : undefined} onclick={(event) => navClick(event, 'documents')}><Icon name="file" />Documentos<span class="nav-count">{catalog?.total_general ?? '—'}</span></a><a class="nav-link" class:active={view === 'compare' || view === 'detail'} href="#comparar" aria-current={view === 'compare' ? 'page' : undefined} onclick={(event) => navClick(event, 'compare')}><Icon name="grid" />Comparar ofertas</a><a class="nav-link" class:active={view === 'saved'} href="#guardadas" aria-current={view === 'saved' ? 'page' : undefined} onclick={(event) => navClick(event, 'saved')}><Icon name="heart" />Guardadas<span class="nav-count">{savedOffers.length}</span></a></nav>
    <div class="sidebar-divider"></div><p class="nav-label">TU VIAJE DE REFERENCIA</p><a class="trip-link" href="#asistente" onclick={(event) => navClick(event, 'chat')}><span class="dot"></span>{trip?.destino ?? 'Preparando viaje…'}<small>{trip ? trip.fecha_inicio.slice(0, 4) : ''}</small></a>
    <div class="side-bottom"><div class="side-tip"><Icon name="shield" /><b>Viaja con más claridad.</b><p>Cada recomendación enlaza a los datos que la respaldan.</p></div><div class="side-footer"><span class="dot"></span>Entorno de demostración</div></div>
  </aside>

  <main class="app-body" id="main" tabindex="-1" bind:this={mainElement}>
    <header class="app-topbar"><a class="brand mobile-brand" href="#asistente" onclick={(event) => navClick(event, 'chat')}><Icon name="logo" size={25} />rumbo.</a><div class="breadcrumb"><span>{view === 'documents' ? 'Biblioteca' : 'Tu viaje'}</span><span aria-hidden="true">/</span><b>{titles[view]}</b></div><div class="top-actions"><span class="demo-tag"><span class="dot"></span>Datos simulados</span><div class="avatar" aria-label="Tu espacio de viaje">TÚ</div></div></header>
    <nav class="mobile-navigation" aria-label="Secciones de Rumbo para móvil"><a class:active={view === 'chat'} href="#asistente" onclick={(event) => navClick(event, 'chat')}><Icon name="chat" size={16} />Asistente</a><a class:active={view === 'documents'} href="#documentos" onclick={(event) => navClick(event, 'documents')}><Icon name="file" size={16} />Documentos</a><a class:active={view === 'compare' || view === 'detail'} href="#comparar" onclick={(event) => navClick(event, 'compare')}><Icon name="grid" size={16} />Comparar</a><a class:active={view === 'saved'} href="#guardadas" onclick={(event) => navClick(event, 'saved')} aria-label={`Guardadas, ${savedOffers.length} ofertas`}><Icon name="heart" size={16} /><span class="mobile-saved-label">Guardadas</span><span>{savedOffers.length}</span></a></nav>
    <div class="app-content">
      {#if view === 'chat'}
        <section aria-labelledby="chat-title" class="chat-page">
          <div class="hero"><div class="hero-copy"><div class="eyebrow">TU PRÓXIMA BUENA IDEA</div><h1 id="chat-title">Más vacaciones.<br /><em>Menos pestañas.</em></h1><p>Cuéntanos tu plan. Encontramos la oferta que encaja contigo.</p></div><Artwork kind="hero" class="hero-art" label="Ilustración de una escapada junto al mar" /></div>
          {#if trip}<div class="trip-context" aria-label="Viaje y presupuesto de referencia"><div class="context-item"><Icon name="pin" /><div><span>DESDE {trip.origen.toLocaleUpperCase('es')}</span><strong>{trip.destino}, España</strong></div></div><div class="context-item"><Icon name="calendar" /><div><span>FECHAS · {trip.noches} NOCHES</span><strong>{dateLabel(trip.fecha_inicio)} — {dateLabel(trip.fecha_fin)}</strong></div></div><div class="context-item"><Icon name="users" /><div><span>VIAJEROS</span><strong>{trip.adultos} adultos</strong></div></div><div class="context-item"><Icon name="wallet" /><div><span>PRESUPUESTO DE PARTIDA</span><strong>Hasta {money(referenceBudget)}</strong></div></div></div>{:else if catalogLoading}<div class="context-loading" role="status"><span class="skeleton"></span>Cargando las condiciones del viaje…</div>{/if}
          {#if catalogError}<div class="error-panel" role="alert"><Icon name="info" /><div><strong>No hemos podido consultar los datos del viaje.</strong><p>{catalogError}</p><button class="btn" type="button" onclick={loadCatalog}>Volver a conectar</button></div></div>{/if}
          {#if turns.length}
            <div class="chat-toolbar"><div class="criteria" aria-label="Pedir otra comparativa">{#each choices as choice}<button class="criterion" type="button" disabled={busy || !catalog} onclick={() => askChoice(choice.question)}>{choice.label}</button>{/each}</div><span class="muted"><Icon name="file" size={14} />{catalog?.total_general ?? '—'} registros disponibles</span></div>
          {:else}
            <div class="welcome-card"><div class="welcome-title"><span class="assistant-icon"><Icon name="spark" /></span><div><h2>Un viaje. Tres formas de elegir.</h2><p>¿Qué quieres priorizar en vuestra escapada?</p></div></div><div class="quick-actions">{#each choices as choice}<button class="quick-action" type="button" disabled={!catalog || busy} onclick={() => askChoice(choice.question)}><span class="round-icon"><Icon name={choice.icon} /></span><strong>{choice.label}</strong><span>{choice.description}</span><Icon name="arrow" size={17} /></button>{/each}</div><p class="welcome-foot"><Icon name="shield" size={14} />Recibirás una recomendación con los registros y fragmentos que la justifican.</p></div>
          {/if}
          <div class="conversation" role="log" aria-label="Conversación con Rumbo" aria-live="polite" aria-relevant="additions text" aria-busy={busy}>
            {#each turns as turn (turn.id)}
              <article class="turn" id={`turn-${turn.id}`} data-testid="chat-turn"><div class="user-message"><div class="user-bubble">{turn.question}</div><div class="avatar" aria-label="Tu mensaje">TÚ</div></div><div class="assistant-label"><span class="assistant-icon"><Icon name="spark" size={17} /></span>Rumbo <span>· Tu asistente de viajes</span></div><div class="assistant-content">
                {#if turn.status === 'pending'}<div class="thinking" role="status"><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Buscando en los registros de tu viaje…</span></div>
                {:else if turn.status === 'error'}<div class="error-panel" role="alert"><Icon name="info" /><div><strong>No hemos podido completar esta consulta.</strong><p>{turn.error}</p>{#if turn.id === turns[turns.length - 1]?.id}<button class="btn" type="button" disabled={busy} onclick={() => send(turn.question, turn.id)}>Reintentar pregunta <Icon name="arrow" size={14} /></button>{/if}</div></div>
                {:else if turn.answer}<div data-testid="assistant-answer" data-estado={turn.answer.estado}>{#if turn.answer.estado === 'sin_datos'}<NoData text={turn.answer.respuesta} ondocuments={() => navigate('documents')} />{:else}<ResponseText text={turn.answer.respuesta} sources={turn.answer.fuentes} onrecord={showRecord} />{#if turn.answer.oferta}<OfferCard offer={turn.answer.oferta} criterion={turn.answer.criterio} saved={savedIds.includes(turn.answer.oferta.id)} ondetail={showDetail} onsave={toggleSave} />{/if}<Sources sources={turn.answer.fuentes} onrecord={showRecord} /><div class="response-footer"><span><Icon name="shield" size={13} />Basado en {turn.answer.fuentes.length} registros</span><span><Icon name="users" size={13} />Importes para todo el grupo</span></div>{/if}</div>{/if}
              </div></article>
            {/each}
          </div>
          <div class="composer-dock"><div class="mini-prompts"><button class="mini-prompt" type="button" disabled={busy || !catalog} onclick={() => send('¿Marina Verde admite perros y cuánto cuesta llevar el mío?')}>¿Puedo llevar a mi perro?</button><button class="mini-prompt" type="button" onclick={() => navigate('documents')}>Explorar las fuentes <Icon name="up-right" size={12} /></button>{#if turns.length}<button class="mini-prompt" type="button" disabled={busy} onclick={resetConversation}>Nueva conversación</button>{/if}</div><form class="chat-composer" onsubmit={submit}><label class="sr-only" for="chat-input">Tu pregunta sobre las ofertas de vacaciones</label><div class="composer-row"><Icon name="spark" /><textarea id="chat-input" bind:this={composer} bind:value={draft} onkeydown={composerKeydown} placeholder="Pregunta algo más sobre tu viaje…" rows="2" maxlength="2000" required disabled={!catalog} aria-describedby="composer-help"></textarea><button class="composer-send" type="submit" aria-label="Enviar pregunta" disabled={busy || !catalog || !draft.trim()}><Icon name="send" size={20} /></button></div><div class="composer-meta" id="composer-help"><span><Icon name="shield" size={12} />Respuestas basadas en los datos disponibles</span><span>{draft.length ? `${draft.length}/2000 · ` : ''}Intro para enviar · Mayús + Intro para otra línea</span></div></form><p class="disclaimer">Ofertas ficticias · Sin disponibilidad en tiempo real · No permite reservar.</p></div>
        </section>
      {:else if view === 'documents'}<DocumentsView initial={catalog} onrecord={showRecord} />
      {:else if view === 'detail' && selectedOffer}<DetailView offer={selectedOffer} documents={catalog?.documentos ?? []} saved={savedIds.includes(selectedOffer.id)} onback={() => navigate('chat')} onrecord={showRecord} onsave={toggleSave} />
      {:else if view === 'compare'}
        <section aria-labelledby="compare-title"><div class="section-heading"><div><div class="eyebrow">ELIGE CON TODOS LOS DATOS</div><h1 id="compare-title">Las opciones, frente a frente.</h1><p>Las ofertas que ha recomendado Rumbo durante esta sesión.</p></div></div>{#if knownOffers.length}<div class="compare-cards">{#each knownOffers as offer (offer.id)}<OfferCard {offer} criterion={offerCriteria[offer.id]} saved={savedIds.includes(offer.id)} ondetail={showDetail} onsave={toggleSave} />{/each}</div><div class="comparison-wrap"><table class="live-comparison"><caption class="sr-only">Comparación de las ofertas consultadas</caption><thead><tr><th scope="col">Vuestro viaje</th>{#each knownOffers as offer}<th scope="col">{offer.nombre}</th>{/each}</tr></thead><tbody><tr><th scope="row">Fechas</th>{#each knownOffers as offer}<td>{dateLabel(offer.fecha_inicio)}<br />{dateLabel(offer.fecha_fin)}</td>{/each}</tr><tr><th scope="row">Viajeros</th>{#each knownOffers as offer}<td>{offer.adultos} adultos · {offer.noches} noches</td>{/each}</tr><tr><th scope="row">Valoración simulada</th>{#each knownOffers as offer}<td>{rating(offer.valoracion)} / 10</td>{/each}</tr><tr><th scope="row">Régimen</th>{#each knownOffers as offer}<td>{capitalized(offer.regimen)}</td>{/each}</tr><tr><th scope="row">Maleta facturada / adulto</th>{#each knownOffers as offer}<td>{offer.equipaje_facturado_kg_por_adulto ? `${offer.equipaje_facturado_kg_por_adulto} kg` : 'No incluida'}</td>{/each}</tr><tr><th scope="row">Cancelación del hotel</th>{#each knownOffers as offer}<td>{offer.cancelacion_hotel_gratuita ? 'Gratuita, según registro' : 'No reembolsable'}</td>{/each}</tr><tr><th scope="row">Total del grupo</th>{#each knownOffers as offer}<td class="comparison-price">{money(offer.precio_total)}</td>{/each}</tr></tbody></table></div>{:else}<div class="empty-state spacious"><span class="round-icon"><Icon name="grid" size={27} /></span><h2>Tu comparativa empieza con una pregunta.</h2><p>Consulta una recomendación y podrás revisar aquí sus precios y condiciones.</p></div>{/if}<div class="comparison-actions"><h2>Explora otra forma de elegir</h2><div class="mini-prompts">{#each choices as choice}<button class="btn" type="button" disabled={busy || !catalog} onclick={() => askChoice(choice.question)}><Icon name={choice.icon} size={16} />{choice.label}<Icon name="arrow" size={14} /></button>{/each}</div></div></section>
      {:else if view === 'saved'}
        <section aria-labelledby="saved-title"><div class="section-heading"><div><div class="eyebrow">TUS PRÓXIMAS BUENAS IDEAS</div><h1 id="saved-title">Las que te han hecho parar.</h1><p>Tus ofertas guardadas durante esta sesión.</p></div></div>{#if savedOffers.length}<div class="saved-offers">{#each savedOffers as offer (offer.id)}<OfferCard {offer} criterion={offerCriteria[offer.id]} saved={true} ondetail={showDetail} onsave={toggleSave} />{/each}</div>{:else}<div class="empty-state spacious"><span class="round-icon"><Icon name="heart" size={27} /></span><h2>Aún no tienes ofertas guardadas.</h2><p>Pulsa el corazón de una recomendación para encontrarla aquí.</p><button class="btn primary" type="button" onclick={() => navigate('chat')}>Ir al asistente <Icon name="arrow" size={16} /></button></div>{/if}</section>
      {/if}
    </div>
  </main>
</div>
<DocumentDialog selection={recordSelection} onclose={() => recordSelection = null} />
<div class="toast" class:visible={Boolean(notice)} role="status">{notice}</div>
