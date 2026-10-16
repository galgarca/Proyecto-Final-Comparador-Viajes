<script lang="ts">
  let { name, size = 19, class: className = '' }: { name: string; size?: number; class?: string } = $props()
</script>

<svg class={`icon ${className}`} width={size} height={size} style:width={`${size}px`} style:height={`${size}px`} viewBox="0 0 24 24" aria-hidden="true"><use href={`#i-${name}`} /></svg>
