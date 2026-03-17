import { createContext, useContext, useState, useCallback } from 'react'
import { authService } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const login = useCallback(async (email, senha) => {
    const data = await authService.login({ email, senha })
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify({ nome: data.nome, role: data.role }))
    setUser({ nome: data.nome, role: data.role })
    return data.role
  }, [])

  const register = useCallback(async (nome, email, senha) => {
    const data = await authService.register({ nome, email, senha })
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify({ nome: data.nome, role: data.role }))
    setUser({ nome: data.nome, role: data.role })
    return data.role
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
