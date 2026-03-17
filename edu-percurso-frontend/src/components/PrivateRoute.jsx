import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'

export default function PrivateRoute({ children, adminOnly = false }) {
  const { user, isAdmin } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/biblioteca" replace />

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content fade-in">
        {children}
      </main>
    </div>
  )
}
