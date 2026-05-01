export const DEFAULT_REQUEST_TIMEOUT_MS = 15000

export function createTimeoutError(message = 'La solicitud tardó demasiado en responder.') {
  const error = new Error(message)
  error.code = 'REQUEST_TIMEOUT'
  return error
}

export function isTimeoutError(error) {
  return error?.code === 'REQUEST_TIMEOUT' || error?.name === 'AbortError' || error?.message?.includes('AbortError')
}

export function withTimeout(promise, options = {}) {
  const {
    timeout = DEFAULT_REQUEST_TIMEOUT_MS,
    message,
    onTimeout,
  } = options

  let timeoutId

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      onTimeout?.()
      reject(createTimeoutError(message))
    }, timeout)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    globalThis.clearTimeout(timeoutId)
  })
}
