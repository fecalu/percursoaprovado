import { createContext, useContext, useState, useCallback } from 'react'
import { authService } from '../services/api'
import { safeLocalStorageGetItem, safeLocalStorageRemoveItem, safeLocalStorageSetItem } from '../utils/browserStorage'

const AuthContext = createContext(null)

function loadStoredUser() {
  try {
    const stored = safeLocalStorageGetItem('user')
    return stored ? JSON.parse(stored) : null
  } catch {
    safeLocalStorageRemoveItem('token')
    safeLocalStorageRemoveItem('user')
    return null
  }
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
    persistAuth(data)
    return data.role
  }, [persistAuth])

  const register = useCallback(async (nome, email, senha, aceitouTermos) => {
    const data = await authService.register({ nome, email, senha, aceitouTermos })
    persistAuth(data)
    return data.role
  }, [persistAuth])

  const logout = useCallback(() => {
    safeLocalStorageRemoveItem('token')
    safeLocalStorageRemoveItem('user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, register, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
