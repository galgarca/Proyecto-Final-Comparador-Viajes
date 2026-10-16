import type { Answer, DocumentList, DocumentRecord, DocumentType, HistoryTurn } from './types'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error('Ruta de API no permitida')
  let response: Response
  try {
    response = await fetch(path, { ...options, headers: { Accept: 'application/json', ...options.headers } })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'No se puede conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.')
  }
  if (!response.ok) {
    const message = response.status === 503
      ? 'El asistente no está disponible. Comprueba la configuración del servidor o inténtalo de nuevo.'
      : response.status === 502
        ? 'No se ha podido verificar la respuesta. Inténtalo de nuevo en unos instantes.'
        : response.status === 422
          ? 'Revisa la pregunta: debe tener entre 1 y 2.000 caracteres y un historial válido.'
          : response.status === 404
            ? 'No encontramos este registro. Puede que ya no esté disponible.'
            : 'No se ha podido completar la consulta. Inténtalo de nuevo.'
    throw new ApiError(response.status, message)
  }
  try {
    return await response.json() as T
  } catch {
    throw new ApiError(502, 'El servidor ha devuelto una respuesta que no se puede leer.')
  }
}

export function askQuestion(pregunta: string, historial: HistoryTurn[], signal?: AbortSignal) {
  return request<Answer>('/api/preguntar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pregunta, historial }), signal,
  })
}

export function getDocuments(options: {
  q?: string; tipo?: DocumentType; portal?: string;
  orden?: 'oferta' | 'importe_asc' | 'importe_desc' | 'portal';
} = {}, signal?: AbortSignal) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(options)) if (value) query.set(key, value)
  return request<DocumentList>(`/api/documentos${query.size ? '?' + query.toString() : ''}`, { signal })
}

export function getDocument(id: string, signal?: AbortSignal) {
  return request<DocumentRecord>(`/api/documentos/${encodeURIComponent(id)}`, { signal })
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo ha fallado al completar la consulta. Inténtalo de nuevo.'
}
