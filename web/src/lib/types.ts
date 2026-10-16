export type Criterion = 'calidad_precio' | 'precio' | 'completa'
export type DocumentType = 'hotel' | 'flight' | 'extras'
export type View = 'chat' | 'documents' | 'compare' | 'saved' | 'detail'

export interface Trip {
  origen: string
  destino: string
  fecha_inicio: string
  fecha_fin: string
  adultos: number
  noches: number
  moneda: 'EUR'
  datos_simulados: true
}

export interface Offer extends Trip {
  id: string
  nombre: string
  zona: string
  estrellas: number
  valoracion: number
  numero_valoraciones: number
  precio_total: number
  precio_por_persona: number
  regimen: string
  cancelacion_hotel_gratuita: boolean
  equipaje_facturado_kg_por_adulto: number
  registros: string[]
}

export interface Source {
  id: string
  documento: string
  titulo: string
  portal: string
  tipo: string
  fragmento: string
  similitud: number
  url: string
}

export interface Answer {
  respuesta: string
  fuentes: Source[]
  estado: 'respondida' | 'sin_datos'
  oferta: Offer | null
  criterio: Criterion | null
  modelo_consultado: boolean
  motivo: string | null
  datos_simulados: true
}

export interface DocumentRecord extends Trip {
  id: string
  oferta_id: string
  titulo: string
  portal: string
  tipo: DocumentType
  tipo_nombre: string
  importe: number
  fragmento: string
  contenido: string
  documento: string
}

export interface DocumentList {
  documentos: DocumentRecord[]
  total: number
  total_general: number
  portales: string[]
  ofertas: number
  conjunto_datos: string
  datos_simulados: true
}

export interface HistoryTurn {
  rol: 'user' | 'assistant'
  contenido: string
}

export interface ChatTurn {
  id: number
  question: string
  status: 'pending' | 'success' | 'error'
  answer?: Answer
  error?: string
}

export interface RecordSelection {
  id: string
  quote?: string
}
