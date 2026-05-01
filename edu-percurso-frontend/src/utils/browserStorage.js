function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function canUseLocalStorage() {
  if (!hasLocalStorage()) return false

  try {
    window.localStorage.getItem('__edu_percurso_storage_probe__')
    return true
  } catch {
    return false
  }
}

export function safeLocalStorageGetItem(key) {
  if (!hasLocalStorage()) return null

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeLocalStorageSetItem(key, value) {
  if (!hasLocalStorage()) return false

  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeLocalStorageRemoveItem(key) {
  if (!hasLocalStorage()) return false

  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
