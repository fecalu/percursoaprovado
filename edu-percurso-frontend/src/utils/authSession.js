import { buildReturnTo } from './authRedirects'
import { safeLocalStorageGetItem, safeLocalStorageRemoveItem } from './browserStorage'

const SESSION_EXPIRED_NOTICE_KEY = 'auth_session_expired'

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

export function decodeJwtPayload(token) {
  if (!token || typeof atob !== 'function') return null

  try {
    const [, payload] = token.split('.')
    if (!payload) return null

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

export function getJwtExpirationMs(token) {
  const exp = decodeJwtPayload(token)?.exp
  return Number.isFinite(exp) ? exp * 1000 : null
}

export function isJwtExpired(token, now = Date.now()) {
  const expirationMs = getJwtExpirationMs(token)
  return !expirationMs || now >= expirationMs
}

export function getStoredToken() {
  return safeLocalStorageGetItem('token')
}

export function clearStoredSession() {
  safeLocalStorageRemoveItem('token')
  safeLocalStorageRemoveItem('user')
}

export function readStoredSessionUser() {
  const token = getStoredToken()
  const storedUser = safeLocalStorageGetItem('user')

  if (!token || !storedUser || isJwtExpired(token)) {
    clearStoredSession()
    return null
  }

  try {
    const parsed = JSON.parse(storedUser)
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid user payload')
    return {
      ...parsed,
      provider: parsed.provider || 'LOCAL',
    }
  } catch {
    clearStoredSession()
    return null
  }
}

export function hasValidStoredSession() {
  const token = getStoredToken()
  const storedUser = safeLocalStorageGetItem('user')
  return Boolean(token && storedUser && !isJwtExpired(token))
}

export function markSessionExpiredNotice() {
  if (!canUseSessionStorage()) return

  try {
    window.sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1')
  } catch {
    // Ignore sessionStorage failures and keep auth flow working.
  }
}

export function consumeSessionExpiredNotice() {
  if (!canUseSessionStorage()) return false

  try {
    const shouldShow = window.sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === '1'
    window.sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY)
    return shouldShow
  } catch {
    return false
  }
}

export function buildLoginRedirectHref(pathname, search, hash) {
  const nextPath = buildReturnTo(pathname, search, hash)
  const query = new URLSearchParams()

  if (!nextPath.startsWith('/admin')) {
    query.set('returnTo', nextPath)
  }

  const serialized = query.toString()
  return serialized ? `/login?${serialized}` : '/login'
}
