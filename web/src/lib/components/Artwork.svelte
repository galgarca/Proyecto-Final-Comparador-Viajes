<script lang="ts">
  let { kind = 'coast', label = 'Ilustración de muestra, no es una fotografía del alojamiento', class: className = '' }: {
    kind?: 'marina' | 'brisa' | 'bahia' | 'coast' | 'room' | 'hero'; label?: string; class?: string;
  } = $props()
</script>

<svg class={`artwork ${className}`} viewBox={kind === 'hero' ? '0 0 300 160' : '0 0 400 360'} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
  <use href={kind === 'hero' ? '#hero-scene' : `#scene-${kind}`} />
</svg>
