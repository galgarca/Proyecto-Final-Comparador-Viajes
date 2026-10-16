<script lang="ts">
  import Icon from './Icon.svelte'
  import type { RecordSelection, Source } from '../types'
  let { sources, onrecord }: { sources: Source[]; onrecord: (record: RecordSelection) => void } = $props()
  let expanded = $state(false)
  let visible = $derived(expanded ? sources : sources.slice(0, 3))
</script>

{#if sources.length}
  <div class="response-sources">
    <div class="sources-heading"><Icon name="link" size={14} /><span>Fuentes de esta respuesta</span><span class="source-total">{sources.length} registros</span></div>
    <div class="source-grid">
      {#each visible as source, index (source.id)}
        <button class="source" type="button" aria-label={`Leer registro ${source.id}`} onclick={() => onrecord({ id: source.id, quote: source.fragmento })}>
          <span class="source-top"><span class="source-n">{index + 1}</span><span class="source-portal">{source.portal}</span><Icon name="up-right" size={13} /></span>
          <span class="source-id">{source.id} · {source.titulo}</span>
          <q class="source-quote">{source.fragmento}</q>
          <span class="source-read">Leer registro completo <span aria-hidden="true">↗</span></span>
        </button>
      {/each}
    </div>
    {#if sources.length > 3}<button type="button" class="btn text expand-sources" aria-expanded={expanded} onclick={() => expanded = !expanded}>{expanded ? 'Mostrar menos fuentes' : `Ver las ${sources.length - 3} fuentes restantes`}<Icon name="chevron" size={14} /></button>{/if}
  </div>
{/if}
