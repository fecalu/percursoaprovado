import { createContext, useContext, useState, useCallback } from 'react'
import { authService } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const persistAuth = useCallback(data => {
    const userData = {
      nome: data.nome,
      role: data.role,
      provider: data.provider || 'LOCAL',
    }
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const login = useCallback(async (email, senha) => {
    const data = await authService.login({ email, senha })
    persistAuth(data)
    return data.role
  }, [persistAuth])

  const loginWithGoogle = useCallback(async (code, redirectUri, aceitouTermos = false) => {
    const data = await authService.googleLogin({ code, redirectUri, aceitouTermos })
    persistAuth(data)
    return data.role
  }, [persistAuth])

  const register = useCallback(async (nome, email, senha, aceitouTermos) => {
    const data = await authService.register({ nome, email, senha, aceitouTermos })
    persistAuth(data)
    return data.role
  }, [persistAuth])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, register, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
