import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

  return 'Nao foi possivel atualizar a senha agora. Tente novamente.'
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [form, setForm] = useState({ novaSenha: '', confirmarSenha: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')
    setSucesso('')

    if (!token) {
      setErro('Link de redefinicao invalido ou incompleto.')
      return
    }

    if (form.novaSenha.length < 6) {
      setErro('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (form.novaSenha !== form.confirmarSenha) {
      setErro('As senhas nao conferem.')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword({ token, novaSenha: form.novaSenha })
      setSucesso('Senha atualizada com sucesso. Voce ja pode entrar com a nova senha.')
      setTimeout(() => navigate('/login', { replace: true }), 1200)
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
        <h1 className="auth-heading">Criar nova senha</h1>
        <p className="auth-sub">Defina uma nova senha para voltar a acessar sua conta.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nova senha</label>
            <input
              className="form-input"
              type="password"
              placeholder="Minimo 6 caracteres"
              value={form.novaSenha}
              onChange={event => setForm(current => ({ ...current, novaSenha: event.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar nova senha</label>
            <input
              className="form-input"
              type="password"
              placeholder="Repita sua nova senha"
              value={form.confirmarSenha}
              onChange={event => setForm(current => ({ ...current, confirmarSenha: event.target.value }))}
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
            {loading ? 'Salvando nova senha...' : 'Salvar nova senha'}
          </button>
        </form>

        <div className="auth-footer">
          Voltou a lembrar? <Link to="/login">Entrar</Link>
        </div>
      </div>
    </div>
  )
}
