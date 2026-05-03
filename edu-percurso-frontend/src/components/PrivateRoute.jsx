import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import { buildReturnTo } from '../utils/authRedirects'
import { hasValidStoredSession } from '../utils/authSession'

export default function PrivateRoute({ children, adminOnly = false }) {
  const { user, isAdmin } = useAuth()
  const location = useLocation()

  if (!user || !hasValidStoredSession()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo: buildReturnTo(location.pathname, location.search, location.hash) }}
      />
    )
  }
  if (adminOnly && !isAdmin) return <Navigate to="/painel" replace />

  return (
    <div className="app-shell">
      <Sidebar />
      <main className={`main-content fade-in ${adminOnly ? 'main-content-admin' : ''}`.trim()}>
        {children}
      </main>
    </div>
  )
}
