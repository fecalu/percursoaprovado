import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authService } from '../services/api'
import { safeLocalStorageSetItem } from '../utils/browserStorage'
import { clearStoredSession, getJwtExpirationMs, getStoredToken, isJwtExpired, markSessionExpiredNotice, readStoredSessionUser } from '../utils/authSession'

const AuthContext = createContext(null)

function loadStoredUser() {
  const token = getStoredToken()
  if (token && isJwtExpired(token)) {
    markSessionExpiredNotice()
  }

  return readStoredSessionUser()
}

function sameUser(current, next) {
  return current?.nome === next?.nome
    && current?.role === next?.role
    && current?.provider === next?.provider
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser)

  const persistAuth = useCallback(data => {
    const userData = {
      nome: data.nome,
      role: data.role,
      provider: data.provider || 'LOCAL',
    }
    safeLocalStorageSetItem('token', data.token)
    safeLocalStorageSetItem('user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const login = useCallback(async (email, senha) => {
    const data = await authService.login({ email, senha })
    persistAuth(data)
    return data.role
  }, [persistAuth])

  const loginWithGoogle = useCallback(async (code, redirectUri, aceitouTermos = false, modoCadastro = false) => {
    const data = await authService.googleLogin({ code, redirectUri, aceitouTermos, modoCadastro })
    if (data?.token) {
      persistAuth(data)
    }
    return data
  }, [persistAuth])

  const completeGoogleSignup = useCallback(async (signupToken, aceitouTermos) => {
    const data = await authService.completeGoogleSignup({ signupToken, aceitouTermos })
    if (data?.token) {
      persistAuth(data)
    }
    return data
  }, [persistAuth])

  const register = useCallback(async (nome, email, senha, aceitouTermos) => {
    const data = await authService.register({ nome, email, senha, aceitouTermos })
    persistAuth(data)
    return data.role
  }, [persistAuth])

  const logout = useCallback(() => {
    clearStoredSession()
    setUser(null)
  }, [])

  const syncStoredSession = useCallback(() => {
    const token = getStoredToken()
    const sessionExpired = Boolean(token) && isJwtExpired(token)
    const nextUser = readStoredSessionUser()

    setUser(current => {
      if (current && !nextUser && sessionExpired) {
        markSessionExpiredNotice()
      }

      return sameUser(current, nextUser) ? current : nextUser
    })
  }, [])

  useEffect(() => {
    function handleFocus() {
      syncStoredSession()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        syncStoredSession()
      }
    }

    function handleStorage(event) {
      if (!event.key || event.key === 'token' || event.key === 'user') {
        syncStoredSession()
      }
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [syncStoredSession])

  useEffect(() => {
    if (!user || typeof window === 'undefined') return undefined

    const expirationMs = getJwtExpirationMs(getStoredToken())
    if (!expirationMs) return undefined

    const timeoutMs = Math.max(expirationMs - Date.now(), 0)
    const timeoutId = window.setTimeout(() => {
      markSessionExpiredNotice()
      clearStoredSession()
      setUser(null)
    }, timeoutMs)

    return () => window.clearTimeout(timeoutId)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, completeGoogleSignup, register, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
