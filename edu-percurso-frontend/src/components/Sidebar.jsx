import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandLogo from './BrandLogo'
import ThemeToggle from './ThemeToggle'

const IconHome = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l7-5 7 5v9H13v-5H7v5H3V9z" /></svg>
const IconLibrary = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M7 4v12" /><path d="M11 8h3M11 11h3" /></svg>
const IconPass = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="14" height="10" rx="2" /><path d="M7 8h6M7 11h4" /></svg>
const IconCart = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h2l1.2 6h8.8l1.5-4H7.2" /><circle cx="8" cy="15" r="1.2" /><circle cx="14" cy="15" r="1.2" /></svg>
const IconChart = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="10" width="3" height="7" rx="1" /><rect x="8.5" y="6" width="3" height="11" rx="1" /><rect x="14" y="3" width="3" height="14" rx="1" /></svg>
const IconMap = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 2 4-2v12l-4 2-4-2-4 2V6l4-2z" /><path d="M10 6v12" /></svg>
const IconPrice = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 6h10l-1 8H6L5 6z" /><path d="M7 6V4h6v2" /></svg>
const IconList = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h12M4 10h12M4 14h8" /></svg>
const IconPlus = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7" /><path d="M10 7v6M7 10h6" /></svg>
const IconQuiz = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2z" /><path d="M8 8a2 2 0 1 1 3.2 1.6c-.7.5-1.2.9-1.2 1.9" /><circle cx="10" cy="13.8" r=".8" fill="currentColor" stroke="none" /></svg>
const IconUser = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="6.5" r="3" /><path d="M4 16c1.5-2.6 3.6-4 6-4s4.5 1.4 6 4" /></svg>
const IconMenu = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6h12M4 10h12M4 14h12" /></svg>
const IconClose = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 5l10 10M15 5L5 15" /></svg>
const IconBrowser = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 7.5h14" /><path d="M6 5.75h.01M8.75 5.75h.01M11.5 5.75h.01" /></svg>

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const initials = user?.nome
    ? user.nome.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase()
    : '?'

  const hideMobileHeader = location.pathname.startsWith('/conteudos/')

  const mobileSectionTitle = useMemo(() => {
    if (isAdmin) {
      if (location.pathname.startsWith('/admin/paginas/')) return 'Site'
      if (location.pathname.startsWith('/admin/percursos')) return 'Aulas'
      if (location.pathname.startsWith('/admin/modulos')) return 'Modulos'
      if (location.pathname.startsWith('/admin/questoes')) return 'Questoes'
      if (location.pathname.startsWith('/admin/locais')) return 'Comercial'
      if (location.pathname.startsWith('/admin/planos')) return 'Comercial'
      if (location.pathname.startsWith('/admin/usuarios')) return 'Operacao'
      if (location.pathname.startsWith('/admin/pedidos')) return 'Operacao'
      if (location.pathname.startsWith('/admin/assinaturas')) return 'Operacao'
      return 'Administracao'
    }

    if (location.pathname.startsWith('/painel')) return 'Painel'
    if (location.pathname.startsWith('/biblioteca')) return 'Biblioteca'
    if (location.pathname.startsWith('/simulado')) return 'Simulado teorico'
    if (location.pathname.startsWith('/meus-acessos')) return 'Meus acessos'
    if (location.pathname.startsWith('/meus-pedidos')) return 'Pagamentos'
    if (location.pathname.startsWith('/meu-progresso')) return 'Meu progresso'
    if (location.pathname.startsWith('/perfil')) return 'Perfil'
    return 'Aluno'
  }, [isAdmin, location.pathname])

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.classList.toggle('mobile-drawer-open', drawerOpen)
    return () => document.body.classList.remove('mobile-drawer-open')
  }, [drawerOpen])

  function handleLogout() {
    setDrawerOpen(false)
    logout()
    navigate('/login')
  }

  function renderStudentNav() {
    return (
      <nav className="nav-group">
        <div className="nav-label">Aluno</div>
        <NavLink to="/painel" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <IconHome /> Painel
        </NavLink>
        <NavLink to="/biblioteca" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <IconLibrary /> Biblioteca
        </NavLink>
        <NavLink to="/simulado" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <IconQuiz /> Simulado teorico
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
        <NavLink to="/perfil" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <IconUser /> Perfil
        </NavLink>
      </nav>
    )
  }

  function renderAdminNav() {
    return (
      <>
        <nav className="nav-group">
          <div className="nav-label">Visao geral</div>
          <NavLink to="/admin" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconHome /> Dashboard
          </NavLink>
        </nav>

        <nav className="nav-group">
          <div className="nav-label">Site</div>
          <NavLink to="/admin/paginas/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconBrowser /> Home
          </NavLink>
          <NavLink to="/admin/paginas/local" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconBrowser /> Pagina do local
          </NavLink>
          <NavLink to="/admin/paginas/checkout" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconBrowser /> Checkout
          </NavLink>
        </nav>

        <nav className="nav-group">
          <div className="nav-label">Conteudo</div>
          <NavLink to="/admin/percursos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconList /> Aulas
          </NavLink>
          <NavLink to="/admin/modulos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconList /> Modulos
          </NavLink>
          <NavLink to="/admin/questoes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconQuiz /> Banco de questoes
          </NavLink>
        </nav>

        <nav className="nav-group">
          <div className="nav-label">Comercial</div>
          <NavLink to="/admin/locais" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconMap /> Locais
          </NavLink>
          <NavLink to="/admin/planos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconPrice /> Planos
          </NavLink>
        </nav>

        <nav className="nav-group">
          <div className="nav-label">Operacao</div>
          <NavLink to="/admin/usuarios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconUser /> Usuarios
          </NavLink>
          <NavLink to="/admin/pedidos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconCart /> Pedidos
          </NavLink>
          <NavLink to="/admin/assinaturas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconPass /> Assinaturas
          </NavLink>
        </nav>
      </>
    )
  }

  return (
    <>
      {!hideMobileHeader && (
        <>
          <div className="mobile-sidebar-bar">
            <div className="mobile-sidebar-title">{mobileSectionTitle}</div>
            <div className="mobile-sidebar-bar-actions">
              <ThemeToggle compact />
              <button type="button" className="mobile-sidebar-trigger" onClick={() => setDrawerOpen(true)}>
                <IconMenu />
                <span>Menu</span>
              </button>
            </div>
          </div>

          <div
            className={`mobile-sidebar-scrim${drawerOpen ? ' is-open' : ''}`}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        </>
      )}

      <aside className="sidebar">
        <div className="logo">
          <BrandLogo variant="sidebar" showTagline />
        </div>

        {!isAdmin ? renderStudentNav() : renderAdminNav()}

        <div className="sidebar-footer">
          <div className="sidebar-theme-row">
            <ThemeToggle />
          </div>
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

      {!hideMobileHeader && (
        <aside className={`mobile-sidebar-drawer${drawerOpen ? ' is-open' : ''}`}>
          <div className="mobile-sidebar-head">
            <div className="mobile-sidebar-brand">
              <BrandLogo variant="sidebar" />
              <div className="mobile-sidebar-kicker">{isAdmin ? 'Area administrativa' : 'Area do aluno'}</div>
            </div>
            <button type="button" className="mobile-sidebar-close" onClick={() => setDrawerOpen(false)}>
              <IconClose />
            </button>
          </div>

          {!isAdmin ? renderStudentNav() : renderAdminNav()}

          <div className="sidebar-footer mobile-sidebar-footer">
            <div className="sidebar-theme-row">
              <ThemeToggle />
            </div>
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
      )}
    </>
  )
}
