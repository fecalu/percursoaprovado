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

  return (
    <>
      <div className="page-title">Meu progresso</div>
      <p className="page-sub">Acompanhe os conteudos que voce iniciou ou concluiu.</p>

      <div className="stats-grid" style={{ maxWidth: 500 }}>
        <div className="stat-card">
          <div className="stat-label">Concluidos</div>
          <div className="stat-value">{concluidos}</div>
          <div className="stat-sub">conteudos</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Em andamento</div>
          <div className="stat-value">{emAndamento}</div>
          <div className="stat-sub">conteudos</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total assistido</div>
          <div className="stat-value">{formatDuracaoMinutos(itens.reduce((acc, item) => acc + (item.segundosAssistidos || 0), 0))}</div>
          <div className="stat-sub">de estudo</div>
        </div>
      </div>

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
        <div className="table-wrap">
          <div className="table-head" style={{ gridTemplateColumns: '2.5fr 1fr 1fr 120px' }}>
            <span>Conteudo</span>
            <span>Tempo</span>
            <span>Duracao</span>
            <span>Status</span>
          </div>
          {itens.map(item => {
            const pct = item.duracaoTotal
              ? Math.min(100, Math.round(item.segundosAssistidos / item.duracaoTotal * 100))
              : 0

            return (
              <div
                key={item.percursoId}
                className="table-row"
                style={{ gridTemplateColumns: '2.5fr 1fr 1fr 120px', cursor: 'pointer' }}
                onClick={() => navigate(`/conteudos/${item.percursoId}`)}
              >
                <div>
                  <div className="table-name">{item.percursoTitulo}</div>
                  {pct > 0 && !item.concluido && (
                    <div className="progress-wrap" style={{ maxWidth: 200, marginTop: 6 }}>
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <span className="table-cat">{formatDuracaoMinutos(item.segundosAssistidos)}</span>
                <span className="table-dur">{formatDuracaoMinutos(item.duracaoTotal)}</span>
                <span>
                  {item.concluido
                    ? <span className="badge badge-green">Concluido</span>
                    : <span className="badge badge-gray">{pct}%</span>
                  }
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
