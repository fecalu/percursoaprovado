import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { useAuth } from '../context/AuthContext'
import { extractAuthError } from '../utils/authErrors'
import { resolveAuthDestination } from '../utils/authRedirects'
import { consumeSessionExpiredNotice } from '../utils/authSession'

export default function Login() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [sessionNotice] = useState(() => (
    consumeSessionExpiredNotice() ? 'Sua sessao expirou. Entre novamente para continuar.' : ''
  ))
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  async function handleGoogleCode(code) {
    setErro('')
    setGoogleLoading(true)
    try {
      const role = await loginWithGoogle(code, window.location.origin)
      navigate(resolveAuthDestination(role, location.state, location.search), { replace: true })
    } catch (error) {
      setErro(extractAuthError(error, 'Não foi possível entrar com Google.'))
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const role = await login(form.email, form.senha)
      navigate(resolveAuthDestination(role, location.state, location.search), { replace: true })
    } catch (error) {
      setErro(extractAuthError(error, 'Erro ao entrar. Verifique suas credenciais.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        <BrandLogo variant="auth" />
        <h1 className="auth-heading">Bem-vindo de volta</h1>
        <p className="auth-sub">Entre para acessar seus locais de prova e módulos de apoio.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input
              className="form-input"
              type="password"
              placeholder="Sua senha"
              value={form.senha}
              onChange={event => setForm(current => ({ ...current, senha: event.target.value }))}
              required
            />
          </div>

          <div className="auth-meta-row">
            <Link className="auth-inline-link" to={`/forgot-password${location.search}`} state={location.state}>
              Esqueci minha senha
            </Link>
          </div>

          {sessionNotice && <div className="form-error" style={{ marginBottom: '1rem' }}>{sessionNotice}</div>}
          {erro && <div className="form-error" style={{ marginBottom: '1rem' }}>{erro}</div>}

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading || googleLoading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {googleClientId && (
          <>
            <div className="auth-divider">
              <span>ou continue com Google</span>
            </div>
            <div className="auth-social-stack">
              <GoogleAuthButton
                clientId={googleClientId}
                onCode={handleGoogleCode}
                disabled={loading || googleLoading}
                onError={message => setErro(message)}
              />
              {googleLoading && <div className="auth-google-status">Entrando com Google...</div>}
              <div className="auth-google-status">Primeiro acesso? Use a tela Criar conta para entrar com Google.</div>
            </div>
          </>
        )}

        <div className="auth-footer">
          Não tem conta? <Link to={`/register${location.search}`} state={location.state}>Criar conta gratuita</Link>
        </div>
      </div>
    </div>
  )
}
