import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const IconHome = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l7-5 7 5v9H13v-5H7v5H3V9z" /></svg>
const IconLibrary = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M7 4v12" /><path d="M11 8h3M11 11h3" /></svg>
const IconPass = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="14" height="10" rx="2" /><path d="M7 8h6M7 11h4" /></svg>
const IconCart = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h2l1.2 6h8.8l1.5-4H7.2" /><circle cx="8" cy="15" r="1.2" /><circle cx="14" cy="15" r="1.2" /></svg>
const IconChart = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="10" width="3" height="7" rx="1" /><rect x="8.5" y="6" width="3" height="11" rx="1" /><rect x="14" y="3" width="3" height="14" rx="1" /></svg>
const IconMap = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 2 4-2v12l-4 2-4-2-4 2V6l4-2z" /><path d="M10 6v12" /></svg>
const IconPrice = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 6h10l-1 8H6L5 6z" /><path d="M7 6V4h6v2" /></svg>
const IconList = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h12M4 10h12M4 14h8" /></svg>
const IconPlus = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7" /><path d="M10 7v6M7 10h6" /></svg>

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const initials = user?.nome
    ? user.nome.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase()
    : '?'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-name">EduPercurso</div>
        <div className="logo-sub">Locais reais de prova pratica</div>
      </div>

      {!isAdmin && (
        <nav className="nav-group">
          <div className="nav-label">Aluno</div>
          <NavLink to="/biblioteca" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconLibrary /> Biblioteca
          </NavLink>
          <NavLink to="/meus-acessos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconPass /> Meus acessos
          </NavLink>
          <NavLink to="/meus-pedidos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconCart /> Pagamentos
          </NavLink>
          <NavLink to="/meu-progresso" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconChart /> Meu progresso
          </NavLink>
        </nav>
      )}

      {isAdmin && (
        <nav className="nav-group">
          <div className="nav-label">Administracao</div>
          <NavLink to="/admin" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconHome /> Dashboard
          </NavLink>
          <NavLink to="/admin/percursos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconList /> Conteudos
          </NavLink>
          <NavLink to="/admin/locais" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconMap /> Locais
          </NavLink>
          <NavLink to="/admin/planos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconPrice /> Planos
          </NavLink>
          <NavLink to="/admin/pedidos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconCart /> Pedidos e pagamentos
          </NavLink>
          <NavLink to="/admin/assinaturas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconPass /> Assinaturas
          </NavLink>
          <NavLink to="/admin/percursos/novo" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconPlus /> Novo conteudo
          </NavLink>
        </nav>
      )}

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">{initials}</div>
          <div>
            <div className="user-name">{user?.nome}</div>
            <div className="user-role">{user?.role === 'ADMIN' ? 'Administrador' : 'Aluno'}</div>
          </div>
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          Sair
        </button>
      </div>
    </aside>
  )
}
