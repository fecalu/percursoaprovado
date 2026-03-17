import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assinaturaService } from '../services/api'
import { formatAssinaturaStatus, formatDataCurta, formatPlanoDuracao } from '../utils/formatters'

export default function MeusAcessos() {
  const navigate = useNavigate()
  const [assinaturas, setAssinaturas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    assinaturaService.minhas()
      .then(setAssinaturas)
      .finally(() => setLoading(false))
  }, [])

  const ativas = useMemo(
    () => assinaturas.filter(item => item.status === 'ATIVA' && item.paymentStatus === 'PAGO'),
    [assinaturas]
  )

  const historico = useMemo(
    () => assinaturas.filter(item => !(item.status === 'ATIVA' && item.paymentStatus === 'PAGO')),
    [assinaturas]
  )

  if (loading) return <div className="spinner" />

  return (
    <>
      <div className="page-title">Meus acessos</div>
      <p className="page-sub">Veja quais locais de prova estao liberados e ate quando sua validade vai.</p>

      <div className="stats-grid" style={{ maxWidth: 700 }}>
        <div className="stat-card">
          <div className="stat-label">Acessos ativos</div>
          <div className="stat-value">{ativas.length}</div>
          <div className="stat-sub">liberados agora</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Acessos encerrados</div>
          <div className="stat-value">{historico.length}</div>
          <div className="stat-sub">compras anteriores</div>
        </div>
      </div>

      {ativas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Voce ainda nao tem nenhum acesso liberado.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Ver locais disponiveis
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/meus-pedidos')} style={{ marginLeft: '0.75rem' }}>
              Ver meus pagamentos
            </button>
          </div>
        </div>
      ) : (
        <div className="plan-grid" style={{ marginBottom: '2rem' }}>
          {ativas.map(item => (
            <div key={item.id} className="plan-card active-plan">
              <div className="plan-badge">Ativo</div>
              <div className="plan-name">{item.localProvaNome}</div>
              <div className="plan-copy">Acesso liberado no plano {item.planoNome}.</div>
              <div className="plan-meta">Validade: {formatPlanoDuracao(item.duracaoDias)}</div>
              <div className="plan-meta">Liberado em: {formatDataCurta(item.inicioEm)}</div>
              <div className="plan-meta">Expira em: {formatDataCurta(item.fimEm)}</div>
              <div style={{ marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={() => navigate('/biblioteca')}>
                  Abrir biblioteca
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {historico.length > 0 && (
        <div className="table-wrap">
          <div className="table-head" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 120px' }}>
            <span>Local</span>
            <span>Plano</span>
            <span>Validade final</span>
            <span>Situacao</span>
          </div>
          {historico.map(item => (
            <div key={item.id} className="table-row" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 120px' }}>
              <div className="table-name">{item.localProvaNome}</div>
              <span className="table-cat">{item.planoNome}</span>
              <span className="table-dur">{formatDataCurta(item.fimEm)}</span>
              <span>
                <span className={`badge ${item.status === 'CANCELADA' ? 'badge-red' : 'badge-gray'}`}>
                  {formatAssinaturaStatus(item.status)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
