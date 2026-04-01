import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'
import { resolveAuthDestination } from '../utils/authRedirects'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { extractAuthError } from '../utils/authErrors'

export default function Register() {
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ nome: '', email: '', senha: '', aceitouTermos: false })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
  const termosHref = '/termos-de-uso'
  const privacidadeHref = '/politica-de-privacidade'

  async function handleGoogleCode(code) {
    if (!form.aceitouTermos) {
      setErro('Para criar sua conta, aceite os Termos de Uso e a Política de Privacidade.')
      return
    }
    setErro('')
    setGoogleLoading(true)
    try {
      const role = await loginWithGoogle(code, window.location.origin, true)
      navigate(resolveAuthDestination(role, location.state), { replace: true })
    } catch (error) {
      setErro(extractAuthError(error, 'Não foi possível criar sua conta com Google.'))
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (form.senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (!form.aceitouTermos) {
      setErro('Para criar sua conta, aceite os Termos de Uso e a Política de Privacidade.')
      return
    }

    setErro('')
    setLoading(true)
    try {
      const role = await register(form.nome, form.email, form.senha, true)
      navigate(resolveAuthDestination(role, location.state), { replace: true })
    } catch (error) {
      console.error('Falha ao criar conta', error)
      setErro(extractAuthError(error, 'Erro ao criar conta. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        <BrandLogo variant="auth" />
        <h1 className="auth-heading">Criar conta</h1>
        <p className="auth-sub">Crie sua conta para acompanhar o local real da sua prova.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nome completo</label>
            <input
              className="form-input"
              placeholder="Seu nome"
              value={form.nome}
              onChange={event => setForm(current => ({ ...current, nome: event.target.value }))}
              required
            />
          </div>

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
              placeholder="Minimo 6 caracteres"
              value={form.senha}
              onChange={event => setForm(current => ({ ...current, senha: event.target.value }))}
              required
            />
          </div>

          <label className="auth-consent-check">
            <input
              type="checkbox"
              checked={form.aceitouTermos}
              onChange={event => setForm(current => ({ ...current, aceitouTermos: event.target.checked }))}
              disabled={loading || googleLoading}
            />
            <span>
              Li e aceito os{' '}
              <a href={termosHref} target="_blank" rel="noreferrer">
                Termos de Uso
              </a>{' '}
              e a{' '}
              <a href={privacidadeHref} target="_blank" rel="noreferrer">
                Política de Privacidade
              </a>
              .
            </span>
          </label>

          {erro && <div className="form-error" style={{ marginBottom: '1rem' }}>{erro}</div>}

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading || googleLoading}
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
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
                disabled={loading || googleLoading || !form.aceitouTermos}
                onError={message => setErro(message)}
              />
              {googleLoading && <div className="auth-google-status">Conectando com Google...</div>}
            </div>
          </>
        )}

        <div className="auth-footer">
          Já tem conta? <Link to="/login" state={location.state}>Entrar</Link>
        </div>
      </div>
    </div>
  )
}
