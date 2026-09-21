export const CBK_AREA_KEYS = Object.freeze({
  LENGUAJE: 'lenguaje',
  CIENCIAS_NATURALES: 'ciencias_naturales',
  MATEMATICAS: 'matematicas',
  CIENCIAS_SOCIALES: 'ciencias_sociales',
  INGLES: 'ingles',
})
export const CBK_PREGUNTA_TIPO_KEYS = Object.freeze({ SELECCION_UNICA: 'seleccion_unica' })
export const CBK_PREGUNTA_ESTADO_KEYS = Object.freeze({
  BORRADOR: 'borrador', PUBLICADA: 'publicada', RETIRADA: 'retirada',
})
export const CBK_PROCEDENCIA_KEYS = Object.freeze({
  PROPIA: 'propia', ADAPTADA: 'adaptada', EXTERNA: 'externa',
})
export const CBK_RECURSO_TIPO_KEYS = Object.freeze({ IMAGEN: 'imagen', AUDIO: 'audio' })
export const CBK_DIFICULTAD_KEYS = Object.freeze({ FACIL: 'facil', MEDIA: 'media', DIFICIL: 'dificil' })

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function createCatalog(options) {
  const entries = Object.freeze(options.map((option) => Object.freeze({ ...option })))
  const labels = Object.freeze(Object.fromEntries(entries.map(({ key, label }) => [key, label])))
  const aliases = new Map()
  for (const option of entries) {
    aliases.set(normalizeToken(option.key), option.key)
    aliases.set(normalizeToken(option.label), option.key)
    if (option.valor !== undefined) aliases.set(normalizeToken(option.valor), option.key)
  }
  // No convertir valores desconocidos silenciosamente en una opcion valida.
  const normalize = (value, fallback = '') => aliases.get(normalizeToken(value)) ?? fallback
  return { entries, labels, normalize }
}

// Los IDs de area se obtendran de cbk_areas; no deben inventarse en el frontend.
const areas = createCatalog([
  { key: CBK_AREA_KEYS.LENGUAJE, label: 'Lenguaje' },
  { key: CBK_AREA_KEYS.CIENCIAS_NATURALES, label: 'Ciencias Naturales' },
  { key: CBK_AREA_KEYS.MATEMATICAS, label: 'Matemáticas' },
  { key: CBK_AREA_KEYS.CIENCIAS_SOCIALES, label: 'Ciencias Sociales' },
  { key: CBK_AREA_KEYS.INGLES, label: 'Inglés' },
])
const tiposPregunta = createCatalog([
  { key: CBK_PREGUNTA_TIPO_KEYS.SELECCION_UNICA, label: 'Selección única' },
])
const estadosPregunta = createCatalog([
  { key: CBK_PREGUNTA_ESTADO_KEYS.BORRADOR, label: 'Borrador' },
  { key: CBK_PREGUNTA_ESTADO_KEYS.PUBLICADA, label: 'Publicada' },
  { key: CBK_PREGUNTA_ESTADO_KEYS.RETIRADA, label: 'Retirada' },
])
const procedencias = createCatalog([
  { key: CBK_PROCEDENCIA_KEYS.PROPIA, label: 'Propia' },
  { key: CBK_PROCEDENCIA_KEYS.ADAPTADA, label: 'Adaptada' },
  { key: CBK_PROCEDENCIA_KEYS.EXTERNA, label: 'Externa' },
])
const tiposRecurso = createCatalog([
  { key: CBK_RECURSO_TIPO_KEYS.IMAGEN, label: 'Imagen' },
  { key: CBK_RECURSO_TIPO_KEYS.AUDIO, label: 'Audio' },
])
const dificultades = createCatalog([
  { key: CBK_DIFICULTAD_KEYS.FACIL, label: 'Fácil', valor: 1 },
  { key: CBK_DIFICULTAD_KEYS.MEDIA, label: 'Media', valor: 2 },
  { key: CBK_DIFICULTAD_KEYS.DIFICIL, label: 'Difícil', valor: 3 },
])

export const CBK_AREAS = areas.entries
export const CBK_AREA_LABELS = areas.labels
export const normalizeCbkArea = areas.normalize
export function getCbkAreaLabel(value) {
  return CBK_AREA_LABELS[normalizeCbkArea(value)] || 'Sin área'
}
export const CBK_PREGUNTA_TIPOS = tiposPregunta.entries
export const CBK_PREGUNTA_TIPO_LABELS = tiposPregunta.labels
export const normalizeCbkPreguntaTipo = tiposPregunta.normalize
export function getCbkPreguntaTipoLabel(value) {
  return CBK_PREGUNTA_TIPO_LABELS[normalizeCbkPreguntaTipo(value)] || 'Sin tipo'
}
export const CBK_PREGUNTA_ESTADOS = estadosPregunta.entries
export const CBK_PREGUNTA_ESTADO_LABELS = estadosPregunta.labels
export const normalizeCbkPreguntaEstado = estadosPregunta.normalize
export function getCbkPreguntaEstadoLabel(value) {
  return CBK_PREGUNTA_ESTADO_LABELS[normalizeCbkPreguntaEstado(value)] || 'Sin estado'
}
export const CBK_PROCEDENCIAS = procedencias.entries
export const CBK_PROCEDENCIA_LABELS = procedencias.labels
export const normalizeCbkProcedencia = procedencias.normalize
export function getCbkProcedenciaLabel(value) {
  return CBK_PROCEDENCIA_LABELS[normalizeCbkProcedencia(value)] || 'Sin procedencia'
}
export const CBK_RECURSO_TIPOS = tiposRecurso.entries
export const CBK_RECURSO_TIPO_LABELS = tiposRecurso.labels
export const normalizeCbkRecursoTipo = tiposRecurso.normalize
export function getCbkRecursoTipoLabel(value) {
  return CBK_RECURSO_TIPO_LABELS[normalizeCbkRecursoTipo(value)] || 'Sin recurso'
}
export const CBK_DIFICULTADES = dificultades.entries
export const CBK_DIFICULTAD_LABELS = dificultades.labels
export const CBK_DIFICULTAD_VALORES = Object.freeze(
  Object.fromEntries(CBK_DIFICULTADES.map(({ key, valor }) => [key, valor])),
)
export const normalizeCbkDificultad = dificultades.normalize
export function getCbkDificultadLabel(value) {
  return CBK_DIFICULTAD_LABELS[normalizeCbkDificultad(value)] || 'Sin dificultad'
}
export function getCbkDificultadValor(value, fallback = null) {
  return CBK_DIFICULTAD_VALORES[normalizeCbkDificultad(value)] ?? fallback
}
