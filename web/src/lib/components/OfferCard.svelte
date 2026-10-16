<script lang="ts">
  import Artwork from './Artwork.svelte'
  import Icon from './Icon.svelte'
  import { capitalized, criterionLabel, money, rating, sceneFor } from '../format'
  import type { Criterion, Offer } from '../types'
  let { offer, criterion = null, saved = false, ondetail, onsave }: {
    offer: Offer; criterion?: Criterion | null; saved?: boolean;
    ondetail: (offer: Offer) => void; onsave: (offer: Offer) => void;
  } = $props()
</script>

<article class="offer-card">
  <div class="offer-visual"><Artwork kind={sceneFor(offer)} /><span class="badge green">{criterion ? criterionLabel(criterion) : 'Tu opción recomendada'}</span><span class="illustration-caption">Ilustración</span></div>
  <div class="offer-body">
    <div class="offer-top"><div><div class="offer-place"><Icon name="pin" size={13} />{offer.zona}</div><h3 class="offer-name">{offer.nombre}</h3><div class="offer-stars" aria-label={`${offer.estrellas} estrellas`}>{'★'.repeat(Math.min(5, Math.max(0, offer.estrellas)))}</div></div><button class="heart" type="button" aria-label={`${saved ? 'Quitar de guardadas' : 'Guardar'} ${offer.nombre}`} aria-pressed={saved} onclick={() => onsave(offer)}><Icon name="heart" size={16} /></button></div>
    <div class="rating"><b>{rating(offer.valoracion)}</b><strong>{offer.valoracion >= 9 ? 'Fantástico' : offer.valoracion >= 8 ? 'Muy bien' : 'Bien'}</strong><span>· {offer.numero_valoraciones} valoraciones simuladas</span></div>
    <div class="offer-inclusions"><span><Icon name="cup" size={14} />{capitalized(offer.regimen)}</span><span><Icon name="bag" size={14} />{offer.equipaje_facturado_kg_por_adulto ? `${offer.equipaje_facturado_kg_por_adulto} kg / adulto` : 'Sin maleta facturada'}</span><span><Icon name={offer.cancelacion_hotel_gratuita ? 'shield' : 'info'} size={14} />{offer.cancelacion_hotel_gratuita ? 'Hotel cancelable' : 'Hotel no reembolsable'}</span></div>
    <div class="offer-bottom"><div><div class="price">{money(offer.precio_total)}<small>en total</small></div><div class="price-description">{offer.adultos} adultos · {offer.noches} noches · {money(offer.precio_por_persona)} / persona</div></div><button class="btn primary" type="button" onclick={() => ondetail(offer)}>Ver detalle <Icon name="arrow" size={15} /></button></div>
  </div>
</article>
