import { useEffect, useState } from 'react'
import { assinaturaService, planoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import { formatDataCurta } from '../utils/formatters'

export default function AdminAssinaturas() {
  const [assinaturas, setAssinaturas] = useState([])
  const [planos, setPlanos] = useState([])
  const [form, setForm] = useState({ usuarioEmail: '', planoId: '' })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const { show, ToastEl } = useToast()

  useEffect(() => {
    Promise.all([
      assinaturaService.listarAdmin(),
      planoService.listar({ todos: true }),
    ])
      .then(([assinaturasResp, planosResp]) => {
        setAssinaturas(assinaturasResp)
        setPlanos(planosResp)
        if (!form.planoId && planosResp[0]) {
          setForm(current => ({ ...current, planoId: planosResp[0].id }))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function recarregar() {
    setAssinaturas(await assinaturaService.listarAdmin())
  }

  async function ativar(event) {
    event.preventDefault()
    setSalvando(true)

    try {
      await assinaturaService.criarAdmin(form)
      show('Assinatura ativada com sucesso.')
      setForm(current => ({ ...current, usuarioEmail: '' }))
      await recarregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao ativar assinatura.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function cancelar(assinatura) {
    if (!confirm(`Cancelar a assinatura de ${assinatura.localProvaNome}?`)) return

    try {
      await assinaturaService.cancelarAdmin(assinatura.id)
      show('Assinatura cancelada com sucesso.')
      await recarregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao cancelar assinatura.', 'error')
    }
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Assinaturas</div>
      <p className="page-sub">Ative manualmente um plano para um aluno e acompanhe os acessos vigentes.</p>

      <div className="admin-grid">
        <div className="card">
          <div className="section-heading">Ativar assinatura</div>
          <form onSubmit={ativar} style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">E-mail do aluno</label>
              <input className="form-input" type="email" value={form.usuarioEmail} onChange={event => setForm(current => ({ ...current, usuarioEmail: event.target.value }))} required />
            </div>

            <div className="form-group">
              <label className="form-label">Plano</label>
              <select className="form-select" value={form.planoId} onChange={event => setForm(current => ({ ...current, planoId: event.target.value }))}>
                {planos.map(plano => (
                  <option key={plano.id} value={plano.id}>
                    {plano.localProvaNome} - {plano.nome}
                  </option>
                ))}
              </select>
            </div>

            <button className="btn btn-primary" type="submit" disabled={salvando}>
              {salvando ? 'Ativando...' : 'Ativar assinatura'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="section-heading">Assinaturas cadastradas</div>
          {loading ? (
            <div className="spinner" />
          ) : (
            <div className="stack-list">
              {assinaturas.map(item => (
                <div key={item.id} className="stack-row">
                  <div>
                    <div className="table-name">{item.localProvaNome}</div>
                    <div className="mini-copy">{item.planoNome} - fim em {formatDataCurta(item.fimEm)}</div>
                  </div>
                  <div className="table-actions">
                    <span className={`badge ${item.status === 'ATIVA' ? 'badge-green' : item.status === 'CANCELADA' ? 'badge-red' : 'badge-gray'}`}>
                      {item.status}
                    </span>
                    <span className={`badge ${item.paymentStatus === 'PAGO' ? 'badge-green' : 'badge-gray'}`}>
                      {item.paymentStatus}
                    </span>
                    {item.status === 'ATIVA' && (
                      <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => cancelar(item)}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
