<script lang="ts">
  import Icon from './Icon.svelte'
  let { text, ondocuments }: { text: string; ondocuments: () => void } = $props()
</script>

<div class="no-data" data-testid="no-data">
  <div class="no-data-tag"><Icon name="info" size={14} />Sin evidencia disponible</div>
  <h3>{text}</h3>
  <p>Los registros disponibles no permiten confirmar esa información. Para darte una respuesta fiable, necesitamos una fuente que la respalde.</p>
  <button class="btn" type="button" onclick={ondocuments}>Revisar los datos disponibles <Icon name="arrow" size={15} /></button>
</div>
<p class="absence-note"><Icon name="shield" size={14} />Sin fuentes para esta pregunta. No se han completado los datos con suposiciones.</p>
