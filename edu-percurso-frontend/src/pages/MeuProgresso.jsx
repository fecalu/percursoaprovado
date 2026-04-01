import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      <div className="student-shell student-shell--compact">
        <section className="student-library-head">
          <div>
            <div className="page-title">Meu progresso</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Acompanhe o que você iniciou, concluiu e o que ainda falta revisar com mais calma.
            </p>
          </div>

          <div className="student-kpi-strip">
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{concluidos}</span>
              <span className="student-kpi-pill-label">Concluídos</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{emAndamento}</span>
              <span className="student-kpi-pill-label">Em andamento</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{formatDuracaoMinutos(totalAssistido)}</span>
              <span className="student-kpi-pill-label">Total assistido</span>
            </div>
          </div>
        </section>
      </div>

      {itens.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Você ainda não assistiu nenhum conteúdo.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/biblioteca')}>
              Ver biblioteca
            </button>
          </div>
        </div>
      ) : (
        <section className="content-section">
          <div className="section-title-row">
            <div>
              <div className="section-heading">Conteúdos acompanhados</div>
              <div className="section-copy">Volte rapidamente para o que ainda falta revisar ou reveja o que já concluiu.</div>
            </div>
          </div>

          <div className="student-stack">
          {itens.map(item => {
            const pct = item.duracaoTotal
              ? Math.min(100, Math.round(item.segundosAssistidos / item.duracaoTotal * 100))
              : 0

            return (
              <div key={item.percursoId} className="student-progress-card">
                <div className="student-progress-main">
                  <div className="table-name">{item.percursoTitulo}</div>
                  <div className="student-progress-copy">
                    {item.concluido
                      ? 'Conteúdo concluído. Você pode rever quando quiser.'
                      : pct > 0
                        ? `Você já assistiu ${pct}% desse conteúdo.`
                        : 'Ainda não iniciado.'}
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
                    ? <span className="badge badge-green">Concluído</span>
                    : <span className="badge badge-gray">{pct}%</span>
                  }
                  <button className="btn btn-primary" onClick={() => navigate(`/conteudos/${item.percursoId}`)}>
                    {item.concluido ? 'Rever conteúdo' : pct > 0 ? 'Continuar' : 'Começar'}
                  </button>
                </div>
              </div>
            )
          })}
          </div>
        </section>
      )}
    </>
  )
}
