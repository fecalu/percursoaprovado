import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RevealSection from '../components/RevealSection'
import { percursoService, progressoService } from '../services/api'
import { formatDuracaoMinutos, formatTipoConteudo } from '../utils/formatters'

function getEmbedUrl(url) {
  if (!url) return null

  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0`
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }

  return null
}

export default function Player() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [percurso, setPercurso] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [concluido, setConcluido] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const timerRef = useRef(null)
  const secondsRef = useRef(0)

  useEffect(() => {
    setLoading(true)
    setErro('')
    setPercurso(null)
    setConcluido(false)
    secondsRef.current = 0
    clearInterval(timerRef.current)
    timerRef.current = null

    Promise.all([percursoService.buscar(id), progressoService.meu()])
      .then(([percursoResp, progressoResp]) => {
        setPercurso(percursoResp)

        const progressoAtual = progressoResp.find(item => item.percursoId === id)
        if (progressoAtual) {
          setConcluido(Boolean(progressoAtual.concluido))
          secondsRef.current = progressoAtual.segundosAssistidos || 0
        }
      })
      .catch(error => {
        setErro(error.response?.data?.erro || 'Nao foi possivel carregar esse conteudo.')
        setPercurso(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  function iniciarContagem() {
    if (timerRef.current) return
    timerRef.current = setInterval(() => {
      secondsRef.current += 5
    }, 5000)
  }

  async function marcarConcluido() {
    setSalvando(true)
    try {
      const progresso = await progressoService.salvar({
        percursoId: id,
        segundosAssistidos: percurso.duracaoSegundos || secondsRef.current,
        concluido: true,
      })
      setConcluido(Boolean(progresso.concluido))
      secondsRef.current = progresso.segundosAssistidos || secondsRef.current
    } finally {
      setSalvando(false)
    }
  }

  useEffect(() => () => clearInterval(timerRef.current), [])

  if (loading) return <div className="spinner" />

  if (!percurso) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">!</div>
        {erro || 'Conteudo nao encontrado.'}
        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={() => navigate('/biblioteca')}>
            Voltar para a biblioteca
          </button>
        </div>
      </div>
    )
  }

  const embedUrl = getEmbedUrl(percurso.videoUrl)

  return (
    <>
      <button className="back-link" onClick={() => navigate('/biblioteca')}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        Voltar para a biblioteca
      </button>

      <RevealSection className="student-shell" delay={30}>
        <div className="player-wrap">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={percurso.titulo}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={iniciarContagem}
            />
          ) : (
            <div className="player-placeholder">
              <div className="big-play">
                <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                  <path d="M7 5l9 5-9 5V5z" fill="#2de09a" />
                </svg>
              </div>
              <div className="player-url">{percurso.videoUrl}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                URL nao reconhecida como YouTube ou Vimeo.
              </div>
            </div>
          )}
        </div>

        <div className="player-layout">
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 10 }}>
              <div className="card-tag">{formatTipoConteudo(percurso.tipoConteudo)}</div>
              {percurso.categoriaNome && <div className="card-tag">{percurso.categoriaNome}</div>}
              <div className="card-tag">{percurso.localProvaNome || 'Modulo geral'}</div>
            </div>

            <h1 className="player-title">{percurso.titulo}</h1>

            <p className="player-copy">
              {percurso.resumo || percurso.descricao || 'Conteudo sem resumo cadastrado.'}
            </p>

            {percurso.descricao && percurso.resumo && (
              <p className="player-secondary-copy">
                {percurso.descricao}
              </p>
            )}

            <div className="player-meta-grid">
              <div className="player-meta-card">
                <div className="player-meta-label">Tipo</div>
                <div className="player-meta-value">{formatTipoConteudo(percurso.tipoConteudo)}</div>
              </div>
              <div className="player-meta-card">
                <div className="player-meta-label">Local</div>
                <div className="player-meta-value">{percurso.localProvaNome || 'Geral'}</div>
              </div>
              <div className="player-meta-card">
                <div className="player-meta-label">Duracao</div>
                <div className="player-meta-value">{formatDuracaoMinutos(percurso.duracaoSegundos)}</div>
              </div>
            </div>
          </div>

          <div className="player-side-card">
            <div className="player-side-title">Seu andamento</div>
            <div className="player-side-copy">
              {concluido
                ? 'Esse conteudo ja foi marcado como concluido. Se quiser, voce pode rever quantas vezes precisar.'
                : 'Quando terminar, marque como concluido para acompanhar melhor sua preparacao.'}
            </div>
            {concluido ? (
              <span className="badge badge-green" style={{ fontSize: 13, padding: '6px 14px', width: 'fit-content' }}>
                Concluido
              </span>
            ) : (
              <button className="btn btn-primary" onClick={marcarConcluido} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Marcar como concluido'}
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => navigate('/meu-progresso')}>
              Ver meu progresso
            </button>
          </div>
        </div>
      </RevealSection>
    </>
  )
}
