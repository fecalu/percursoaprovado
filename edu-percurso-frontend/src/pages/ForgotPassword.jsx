import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import { authService } from '../services/api'

function extractApiError(error) {
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

  return 'Nao foi possivel enviar o link agora. Tente novamente em instantes.'
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')
    setSucesso('')
    setLoading(true)

    try {
      const response = await authService.forgotPassword({ email })
      setSucesso(
        response.mensagem || 'Se esse e-mail estiver cadastrado, enviaremos as instrucoes para redefinir sua senha.'
      )
    } catch (error) {
      setErro(extractApiError(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        <BrandLogo variant="auth" />
        <h1 className="auth-heading">Esqueci minha senha</h1>
        <p className="auth-sub">
          Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link para criar uma nova senha.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={event => setEmail(event.target.value)}
              required
            />
          </div>

          {erro && <div className="form-error" style={{ marginBottom: '1rem' }}>{erro}</div>}
          {sucesso && <div className="form-success" style={{ marginBottom: '1rem' }}>{sucesso}</div>}

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Enviando link...' : 'Enviar link de redefinicao'}
          </button>
        </form>

        <div className="auth-footer">
          Lembrou sua senha? <Link to="/login">Voltar para o login</Link>
        </div>
      </div>
    </div>
  )
}
