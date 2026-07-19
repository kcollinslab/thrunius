export function getAppUrl(path = '') {
  const basePath = import.meta.env.BASE_URL || '/'
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`
  const normalizedPath = String(path).replace(/^\/+/, '')

  return new URL(`${normalizedBasePath}${normalizedPath}`, window.location.origin).toString()
}
