import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RevealSection from '../components/RevealSection'
import { assinaturaService } from '../services/api'
import { formatAssinaturaStatus, formatDataCurta, formatPlanoDuracao } from '../utils/formatters'
import { formatarDiasRestantes } from '../utils/student'

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
      <RevealSection className="student-shell" delay={30}>
        <section className="student-hero">
          <div>
            <div className="page-title">Meus acessos</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Veja quais locais de prova estao liberados, ate quando sua validade vai e o que voce pode abrir agora.
            </p>
          </div>
          <div className="student-kpi-grid student-kpi-grid--compact">
            <div className="student-kpi-card">
              <div className="student-kpi-label">Acessos ativos</div>
              <div className="student-kpi-value">{ativas.length}</div>
              <div className="student-kpi-copy">liberados agora</div>
            </div>
            <div className="student-kpi-card">
              <div className="student-kpi-label">Acessos encerrados</div>
              <div className="student-kpi-value">{historico.length}</div>
              <div className="student-kpi-copy">compras anteriores</div>
            </div>
          </div>
        </section>
      </RevealSection>

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
        <div className="student-grid" style={{ marginBottom: '2rem' }}>
          {ativas.map(item => (
            <RevealSection key={item.id} className="student-card active-plan" delay={70}>
              <div className="student-card-top">
                <span className="badge badge-green">Ativo</span>
                <span className="student-card-copy">{formatarDiasRestantes(item.fimEm)}</span>
              </div>
              <div className="student-card-title">{item.localProvaNome}</div>
              <div className="student-card-copy">Acesso liberado no plano {item.planoNome}.</div>
              <div className="student-detail-list">
                <div className="student-detail-item">
                  <span className="student-detail-label">Periodo</span>
                  <span className="student-detail-value">{formatPlanoDuracao(item.duracaoDias)}</span>
                </div>
                <div className="student-detail-item">
                  <span className="student-detail-label">Inicio</span>
                  <span className="student-detail-value">{formatDataCurta(item.inicioEm)}</span>
                </div>
                <div className="student-detail-item">
                  <span className="student-detail-label">Fim</span>
                  <span className="student-detail-value">{formatDataCurta(item.fimEm)}</span>
                </div>
              </div>
              <div className="student-card-actions">
                <button className="btn btn-primary" onClick={() => navigate('/biblioteca')}>
                  Abrir biblioteca
                </button>
                <button className="btn btn-ghost" onClick={() => navigate('/meu-progresso')}>
                  Ver progresso
                </button>
              </div>
            </RevealSection>
          ))}
        </div>
      )}

      {historico.length > 0 && (
        <section className="content-section">
          <div className="section-title-row">
            <div>
              <div className="section-heading">Acessos encerrados</div>
              <div className="section-copy">Historico de acessos que ja terminaram ou foram cancelados.</div>
            </div>
          </div>
          <div className="student-stack">
            {historico.map(item => (
              <div key={item.id} className="student-stack-card">
                <div>
                  <div className="table-name">{item.localProvaNome}</div>
                  <div className="mini-copy">{item.planoNome}</div>
                </div>
                <div className="student-detail-item">
                  <span className="student-detail-label">Validade final</span>
                  <span className="student-detail-value">{formatDataCurta(item.fimEm)}</span>
                </div>
                <div>
                  <span className={`badge ${item.status === 'CANCELADA' ? 'badge-red' : 'badge-gray'}`}>
                    {formatAssinaturaStatus(item.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
