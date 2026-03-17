import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { percursoService, progressoService } from '../services/api'

function fmtDuracao(segundos) {
  if (!segundos) return '—'
  const m = Math.floor(segundos / 60)
  return `${m} min`
}

export default function Percursos() {
  const [percursos, setPercursos] = useState([])
  const [progresso, setProgresso] = useState({})
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function carregar() {
      try {
        const [p, prog] = await Promise.all([
          percursoService.listar(),
          progressoService.meu(),
        ])
        setPercursos(p)
        const map = {}
        prog.forEach(pr => { map[pr.percursoId] = pr })
        setProgresso(map)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  const filtrados = percursos.filter(p =>
    p.titulo.toLowerCase().includes(filtro.toLowerCase()) ||
    (p.categoriaNome || '').toLowerCase().includes(filtro.toLowerCase())
  )

  if (loading) return <div className="spinner" />

  return (
    <>
      <div className="page-title">Percursos de estudo</div>
      <p className="page-sub">Escolha um percurso e assista ao vídeo para se preparar</p>

      <input
        className="form-input"
        style={{ maxWidth: 340, marginBottom: '1.5rem' }}
        placeholder="Buscar percurso ou categoria..."
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
      />

      {filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">▷</div>
          Nenhum percurso encontrado.
        </div>
      ) : (
        <div className="card-grid">
          {filtrados.map(p => {
            const prog = progresso[p.id]
            const pct = prog && p.duracaoSegundos
              ? Math.min(100, Math.round(prog.segundosAssistidos / p.duracaoSegundos * 100))
              : 0
            return (
              <div
                key={p.id}
                className="percurso-card"
                onClick={() => navigate(`/percursos/${p.id}`)}
              >
                <div className="card-thumb">
                  <div className="card-thumb-overlay" />
                  <div className="play-btn">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M7 5l9 5-9 5V5z" fill="#2de09a"/>
                    </svg>
                  </div>
                </div>
                <div className="card-body">
                  {p.categoriaNome && <div className="card-tag">{p.categoriaNome}</div>}
                  <div className="card-title">{p.titulo}</div>
                  <div className="card-desc">{p.descricao}</div>
                  {pct > 0 && (
                    <div className="progress-wrap">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <div className="card-footer">
                  <span className="card-dur">{fmtDuracao(p.duracaoSegundos)}</span>
                  {prog?.concluido
                    ? <span className="badge badge-green">Concluído</span>
                    : pct > 0
                    ? <span className="badge badge-gray">{pct}% assistido</span>
                    : <span className="card-arrow">Assistir →</span>
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
