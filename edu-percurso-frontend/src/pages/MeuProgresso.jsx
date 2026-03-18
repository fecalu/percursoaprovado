import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RevealSection from '../components/RevealSection'
import { progressoService } from '../services/api'
import { formatDuracaoMinutos } from '../utils/formatters'

export default function MeuProgresso() {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    progressoService.meu()
      .then(setItens)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner" />

  const concluidos = itens.filter(item => item.concluido).length
  const emAndamento = itens.filter(item => !item.concluido && item.segundosAssistidos > 0).length
  const totalAssistido = itens.reduce((acc, item) => acc + (item.segundosAssistidos || 0), 0)

  return (
    <>
      <RevealSection className="student-shell" delay={30}>
        <section className="student-hero">
          <div>
            <div className="page-title">Meu progresso</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Acompanhe os conteudos que voce iniciou ou concluiu e volte rapidamente para o que ainda falta revisar.
            </p>
          </div>
          <div className="student-kpi-grid">
            <div className="student-kpi-card">
              <div className="student-kpi-label">Concluidos</div>
              <div className="student-kpi-value">{concluidos}</div>
              <div className="student-kpi-copy">conteudos</div>
            </div>
            <div className="student-kpi-card">
              <div className="student-kpi-label">Em andamento</div>
              <div className="student-kpi-value">{emAndamento}</div>
              <div className="student-kpi-copy">conteudos</div>
            </div>
            <div className="student-kpi-card">
              <div className="student-kpi-label">Total assistido</div>
              <div className="student-kpi-value">{formatDuracaoMinutos(totalAssistido)}</div>
              <div className="student-kpi-copy">de estudo</div>
            </div>
          </div>
        </section>
      </RevealSection>

      {itens.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Voce ainda nao assistiu nenhum conteudo.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/biblioteca')}>
              Ver biblioteca
            </button>
          </div>
        </div>
      ) : (
        <div className="student-stack">
          {itens.map(item => {
            const pct = item.duracaoTotal
              ? Math.min(100, Math.round(item.segundosAssistidos / item.duracaoTotal * 100))
              : 0

            return (
              <RevealSection key={item.percursoId} className="student-progress-card" delay={50}>
                <div className="student-progress-main">
                  <div className="table-name">{item.percursoTitulo}</div>
                  <div className="student-progress-copy">
                    {item.concluido
                      ? 'Conteudo concluido. Voce pode rever quando quiser.'
                      : pct > 0
                        ? `Voce ja assistiu ${pct}% desse conteudo.`
                        : 'Ainda nao iniciado.'}
                  </div>
                  <div className="student-progress-meta">
                    <span>{formatDuracaoMinutos(item.segundosAssistidos)} assistidos</span>
                    <span>{formatDuracaoMinutos(item.duracaoTotal)} no total</span>
                  </div>
                  {!item.concluido && pct > 0 && (
                    <div className="student-progress-bar">
                      <div className="student-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <div className="student-progress-side">
                  {item.concluido
                    ? <span className="badge badge-green">Concluido</span>
                    : <span className="badge badge-gray">{pct}%</span>
                  }
                  <button className="btn btn-primary" onClick={() => navigate(`/conteudos/${item.percursoId}`)}>
                    {item.concluido ? 'Rever conteudo' : pct > 0 ? 'Continuar' : 'Comecar'}
                  </button>
                </div>
              </RevealSection>
            )
          })}
        </div>
      )}
    </>
  )
}
