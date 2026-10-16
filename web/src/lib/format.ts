import type { Criterion, Offer } from './types'

export const money = (amount: number) => new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always',
}).format(amount)

export const rating = (value: number) => value.toLocaleString('es-ES', { minimumFractionDigits: 1 })
export const dateLabel = (value: string) => new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(new Date(value + 'T12:00:00Z'))

export const criterionLabel = (criterion: Criterion | null) => ({
  calidad_precio: 'Mejor calidad · precio', precio: 'El precio más bajo', completa: 'La más completa',
})[criterion ?? 'calidad_precio']

export const sceneFor = (offer: Offer): 'marina' | 'brisa' | 'bahia' | 'coast' =>
  offer.id === 'marina' || offer.id === 'brisa' || offer.id === 'bahia' ? offer.id : 'coast'

export const capitalized = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
