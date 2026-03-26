import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'

function extractRegisterError(error) {
  const data = error.response?.data

  if (typeof data?.erro === 'string' && data.erro.trim()) {
    return data.erro
  }

  if (data && typeof data === 'object') {
    const firstMessage = Object.values(data).find(value => typeof value === 'string' && value.trim())
    if (firstMessage) {
      return firstMessage
    }
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    if (error.message === 'Network Error') {
      return 'Nao foi possivel conectar ao servidor. Recarregue a pagina e tente novamente.'
    }
    return error.message
  }

  return 'Erro ao criar conta. Tente novamente.'
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nome: '', email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (form.senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setErro('')
    setLoading(true)
    try {
      await register(form.nome, form.email, form.senha)
      navigate('/painel', { replace: true })
    } catch (error) {
      console.error('Falha ao criar conta', error)
      setErro(extractRegisterError(error))
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

          {erro && <div className="form-error" style={{ marginBottom: '1rem' }}>{erro}</div>}

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-footer">
          Ja tem conta? <Link to="/login">Entrar</Link>
        </div>
      </div>
    </div>
  )
}
