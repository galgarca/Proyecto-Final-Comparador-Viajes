<script lang="ts">
  import { onMount } from 'svelte'

  let apiAvailable = $state<boolean | null>(null)

  onMount(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('API unavailable')
        const health: { status: string } = await response.json()
        apiAvailable = health.status === 'ok'
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) apiAvailable = false
      })
    return () => controller.abort()
  })
</script>

<svelte:head>
  <title>Rumbo — Tu próxima escapada</title>
  <meta name="description" content="Prototipo local de Rumbo, el recomendador de vacaciones con fuentes verificables y datos ficticios." />
</svelte:head>

{#if apiAvailable === false}
  <main class="connection-message">
    <h1>Rumbo está esperando al servidor</h1>
    <p>Arranca el servidor Python en el puerto 8000 y recarga esta página.</p>
    <button onclick={() => window.location.reload()}>Volver a intentar</button>
  </main>
{:else if apiAvailable === true}
  <iframe class="rumbo-app" src="/api/maquetas" title="Rumbo: recomendaciones de vacaciones y fuentes de demostración"></iframe>
{:else}
  <main class="connection-message" role="status">Preparando tu próxima escapada…</main>
{/if}