<script lang="ts">
  import type { RecordSelection, Source } from '../types'
  let { text, sources, onrecord }: { text: string; sources: Source[]; onrecord: (record: RecordSelection) => void } = $props()

  function tokenize(paragraph: string) {
    return paragraph.split(/(\*\*[^*]+\*\*|\[[A-Z]+-\d+(?:,\s*[A-Z]+-\d+)*\])/g).filter(Boolean).map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) return { type: 'bold', text: part.slice(2, -2), citations: [] as Source[] }
      if (/^\[[A-Z]+-\d+/.test(part)) {
        const ids = part.slice(1, -1).split(/,\s*/)
        const citations = ids.map((id) => sources.find((source) => source.id === id)).filter((source): source is Source => Boolean(source))
        if (citations.length === ids.length) return { type: 'citations', text: part, citations }
      }
      return { type: 'text', text: part, citations: [] as Source[] }
    })
  }
</script>

<div class="response-text">
  {#each text.split(/\n\s*\n/) as paragraph}
    <p>{#each tokenize(paragraph) as token}{#if token.type === 'bold'}<strong>{token.text}</strong>{:else if token.type === 'citations'}<span class="inline-citations">{#each token.citations as citation}<button type="button" class="inline-citation" title={`${citation.id} · ${citation.portal}`} aria-label={`Leer fuente ${citation.id}, ${citation.portal}`} onclick={() => onrecord({ id: citation.id, quote: citation.fragmento })}>{sources.findIndex((source) => source.id === citation.id) + 1}</button>{/each}</span>{:else}{token.text}{/if}{/each}</p>
  {/each}
</div>
