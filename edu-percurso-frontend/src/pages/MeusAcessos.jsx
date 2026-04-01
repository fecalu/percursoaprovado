import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assinaturaService } from '../services/api'
import { formatAssinaturaStatus, formatDataCurta, formatPlanoDuracao } from '../utils/formatters'
import { formatarDiasRestantes } from '../utils/student'

export default function MeusAcessos() {
  const navigate = useNavigate()
  const [assinaturas, setAssinaturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [historicoAberto, setHistoricoAberto] = useState(false)

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
      <div className="student-shell student-shell--compact">
        <section className="student-library-head">
          <div>
            <div className="page-title">Meus acessos</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Veja quais locais estão liberados, até quando sua validade vai e o que você pode abrir agora.
            </p>
          </div>

          <div className="student-kpi-strip">
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{ativas.length}</span>
              <span className="student-kpi-pill-label">Acessos ativos</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{historico.length}</span>
              <span className="student-kpi-pill-label">Acessos encerrados</span>
            </div>
          </div>
        </section>
      </div>

      {ativas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Você ainda não tem nenhum acesso liberado.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Ver locais disponíveis
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/meus-pedidos')} style={{ marginLeft: '0.75rem' }}>
              Ver meus pagamentos
            </button>
          </div>
        </div>
      ) : (
        <section className="content-section" style={{ marginBottom: '2rem' }}>
          <div className="section-title-row">
            <div>
              <div className="section-heading">Acessos ativos</div>
              <div className="section-copy">Abra a biblioteca do local e acompanhe o que ainda vale revisar.</div>
            </div>
          </div>

          <div className="student-access-grid">
          {ativas.map(item => (
            <div key={item.id} className="student-card student-access-card active-plan">
              <div className="student-card-top">
                <span className="badge badge-green">Ativo</span>
                <span className="student-card-copy">{formatarDiasRestantes(item.fimEm)}</span>
              </div>
              <div className="student-card-title">{item.localProvaNome}</div>
              <div className="student-card-copy">Acesso liberado no plano {item.planoNome}.</div>
              <div className="student-detail-list">
                <div className="student-detail-item">
                  <span className="student-detail-label">Período</span>
                  <span className="student-detail-value">{formatPlanoDuracao(item.duracaoDias)}</span>
                </div>
                <div className="student-detail-item">
                  <span className="student-detail-label">Início</span>
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
            </div>
          ))}
          </div>
        </section>
      )}

      {historico.length > 0 && (
        <section className="library-section-card">
          <button
            type="button"
            className="library-section-toggle"
            onClick={() => setHistoricoAberto(prev => !prev)}
            aria-expanded={historicoAberto}
          >
            <div className="library-section-heading">
              <div className="section-heading">Acessos encerrados</div>
              <div className="section-copy">Histórico de acessos que já terminaram ou foram cancelados.</div>
            </div>

            <div className="library-section-meta">
              <span className="badge badge-blue">{historico.length} acessos</span>
              <span className="library-section-toggle-label">{historicoAberto ? 'Fechar' : 'Abrir'}</span>
            </div>
          </button>

          {historicoAberto && (
            <div className="library-section-body">
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
            </div>
          )}
        </section>
      )}
    </>
  )
}
