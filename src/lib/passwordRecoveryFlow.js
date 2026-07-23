const PASSWORD_RECOVERY_PENDING_KEY = 'thrunius:password-recovery-pending'
const PASSWORD_RECOVERY_PENDING_MAX_AGE_MS = 60 * 60 * 1000

function getSessionStorage() {
  if (typeof window === 'undefined') return null
  return window.sessionStorage
}

export function rememberPasswordRecoveryRequest() {
  try {
    getSessionStorage()?.setItem(PASSWORD_RECOVERY_PENDING_KEY, String(Date.now()))
  } catch {
    // sessionStorage can be unavailable in strict privacy modes.
  }
}

export function forgetPasswordRecoveryRequest() {
  try {
    getSessionStorage()?.removeItem(PASSWORD_RECOVERY_PENDING_KEY)
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

export function hasRecentPasswordRecoveryRequest() {
  try {
    const requestedAt = Number(getSessionStorage()?.getItem(PASSWORD_RECOVERY_PENDING_KEY) || 0)
    return requestedAt > 0 && Date.now() - requestedAt < PASSWORD_RECOVERY_PENDING_MAX_AGE_MS
  } catch {
    return false
  }
}
