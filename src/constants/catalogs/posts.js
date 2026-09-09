export const POST_VISIBILITY_KEYS = Object.freeze({
  HIDDEN: 'oculto',
  PRIVATE: 'privado',
  PUBLIC: 'publico',
})

export const POST_TYPE_KEYS = Object.freeze({
  NEWS: 'noticia',
  ARTICLE: 'articulo',
})

export const POST_VISIBILITY = Object.freeze([
  {
    key: POST_VISIBILITY_KEYS.HIDDEN,
    label: 'Oculto',
  },
  {
    key: POST_VISIBILITY_KEYS.PRIVATE,
    label: 'Privado',
  },
  {
    key: POST_VISIBILITY_KEYS.PUBLIC,
    label: 'Público',
  },
])

export const POST_PUBLIC_VISIBILITY_VALUES = Object.freeze([
  POST_VISIBILITY_KEYS.PUBLIC,
  'Publico',
  'Público',
])

export const POST_TYPES = Object.freeze([
  {
    key: POST_TYPE_KEYS.NEWS,
    label: 'Noticia',
  },
  {
    key: POST_TYPE_KEYS.ARTICLE,
    label: 'Artículo',
  },
])

export const POST_NEWS_TYPE_VALUES = Object.freeze([
  POST_TYPE_KEYS.NEWS,
  'Noticia',
])

export const POST_VISIBILITY_LABELS = Object.freeze(
  Object.fromEntries(POST_VISIBILITY.map((option) => [option.key, option.label])),
)

export const POST_TYPE_LABELS = Object.freeze(
  Object.fromEntries(POST_TYPES.map((option) => [option.key, option.label])),
)

export function normalizePostVisibility(value, fallback = POST_VISIBILITY_KEYS.HIDDEN) {
  const normalizedValue = String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return POST_VISIBILITY_LABELS[normalizedValue] ? normalizedValue : fallback
}

export function getPostVisibilityLabel(value) {
  return POST_VISIBILITY_LABELS[normalizePostVisibility(value)] || 'Sin estado'
}

export function normalizePostType(value, fallback = POST_TYPE_KEYS.NEWS) {
  const normalizedValue = String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return POST_TYPE_LABELS[normalizedValue] ? normalizedValue : fallback
}

export function getPostTypeLabel(value) {
  if (!value) return 'Sin tipo'

  const normalizedValue = normalizePostType(value, '')
  return POST_TYPE_LABELS[normalizedValue] || String(value)
}
