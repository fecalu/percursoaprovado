import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactPlayer from 'react-player'
import { percursoService, progressoService } from '../services/api'
import { formatDuracaoMinutos, formatTipoConteudo } from '../utils/formatters'

function formatarTimestamp(segundos) {
  const total = Math.max(0, Math.floor(Number(segundos) || 0))
  const minutos = Math.floor(total / 60)
  const resto = total % 60
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
}

function formatarTipoPonto(tipo) {
  switch (tipo) {
    case 'ERRO_COMUM':
      return 'Erro comum'
    case 'PLACA':
      return 'Placa'
    case 'REFERENCIA_VISUAL':
      return 'Referencia visual'
    case 'OBSERVACAO_EXAMINADOR':
      return 'Observacao do examinador'
    default:
      return 'Dica importante'
  }
}

function formatarModoPonto(modo) {
  switch (modo) {
    case 'AUTOMATICO':
      return 'Abrir detalhe automaticamente'
    case 'APENAS_LISTA':
      return 'So marcador'
    default:
      return 'Aviso com pausa'
  }
}

function extrairNumeroEvento(valor, chave) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (valor && typeof valor[chave] === 'number' && Number.isFinite(valor[chave])) return valor[chave]
  if (valor?.target && typeof valor.target[chave] === 'number' && Number.isFinite(valor.target[chave])) return valor.target[chave]
  if (valor?.currentTarget && typeof valor.currentTarget[chave] === 'number' && Number.isFinite(valor.currentTarget[chave])) {
    return valor.currentTarget[chave]
  }
  return null
}

function clampPercentual(segundos, duracaoSegundos) {
  if (!duracaoSegundos || duracaoSegundos <= 0) return 0
  return Math.max(0, Math.min(100, (Number(segundos || 0) / duracaoSegundos) * 100))
}

function detectarMobile() {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 720
}

export default function Player() {
  const { id } = useParams()
  const navigate = useNavigate()
  const playerRef = useRef(null)
  const attentionDetailRef = useRef(null)
  const previousTimeRef = useRef(0)
  const disparadosIdsRef = useRef(new Set())
  const secondsRef = useRef(0)

  const [percurso, setPercurso] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [concluido, setConcluido] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerErro, setPlayerErro] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [durationSegundos, setDurationSegundos] = useState(0)
  const [pontoAtencaoAtivoId, setPontoAtencaoAtivoId] = useState(null)
  const [promptPontoId, setPromptPontoId] = useState(null)
  const [disparadosIds, setDisparadosIds] = useState([])
  const [isMobileViewport, setIsMobileViewport] = useState(detectarMobile())

  useEffect(() => {
    const atualizarViewport = () => setIsMobileViewport(detectarMobile())
    atualizarViewport()
    window.addEventListener('resize', atualizarViewport)
    window.addEventListener('orientationchange', atualizarViewport)
    return () => {
      window.removeEventListener('resize', atualizarViewport)
      window.removeEventListener('orientationchange', atualizarViewport)
    }
  }, [])

  useEffect(() => {
    if (isMobileViewport) {
      document.body.classList.add('player-mobile-focus')
    } else {
      document.body.classList.remove('player-mobile-focus')
    }

    return () => {
      document.body.classList.remove('player-mobile-focus')
    }
  }, [isMobileViewport])

  useEffect(() => {
    disparadosIdsRef.current = new Set(disparadosIds)
  }, [disparadosIds])

  useEffect(() => {
    setLoading(true)
    setErro('')
    setPercurso(null)
    setConcluido(false)
    setPlayerReady(false)
    setPlayerErro(false)
    setPlaying(false)
    setCurrentTime(0)
    setDurationSegundos(0)
    setPontoAtencaoAtivoId(null)
    setPromptPontoId(null)
    setDisparadosIds([])
    disparadosIdsRef.current = new Set()
    secondsRef.current = 0
    previousTimeRef.current = 0

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

  const pontosAtencaoAtivos = useMemo(() => (
    (percurso?.pontosAtencao || [])
      .filter(item => item.ativo)
      .sort((a, b) => {
        const ordemA = a.ordemExibicao ?? 0
        const ordemB = b.ordemExibicao ?? 0
        if (ordemA !== ordemB) return ordemA - ordemB
        return (a.timestampSegundos ?? 0) - (b.timestampSegundos ?? 0)
      })
  ), [percurso])

  useEffect(() => {
    if (!pontosAtencaoAtivos.length) {
      setPontoAtencaoAtivoId(null)
      return
    }

    setPontoAtencaoAtivoId(current => (
      pontosAtencaoAtivos.some(item => item.id === current)
        ? current
        : pontosAtencaoAtivos[0].id
    ))
  }, [pontosAtencaoAtivos])

  const pontoAtencaoAtivo = pontosAtencaoAtivos.find(item => item.id === pontoAtencaoAtivoId) || null
  const pontoEmPrompt = pontosAtencaoAtivos.find(item => item.id === promptPontoId) || null
  const playerPodeReproduzir = Boolean(percurso?.videoUrl && ReactPlayer.canPlay(percurso.videoUrl))
  const duracaoBase = durationSegundos || percurso?.duracaoSegundos || (pontosAtencaoAtivos.at(-1)?.timestampSegundos || 0) + 30

  function pausarVideo() {
    setPlaying(false)
    if (playerRef.current?.pause) {
      const resultado = playerRef.current.pause()
      if (resultado?.catch) resultado.catch(() => {})
    }
  }

  function iniciarVideo() {
    setPlaying(true)
    if (playerRef.current?.play) {
      const resultado = playerRef.current.play()
      if (resultado?.catch) resultado.catch(() => {})
    }
  }

  function irParaSegundo(segundos) {
    const player = playerRef.current
    if (!player) return

    try {
      player.currentTime = Math.max(0, Number(segundos) || 0)
    } catch (_) {
      // fallback silencioso para provedores que demoram a sincronizar currentTime
    }
  }

  function selecionarPonto(ponto, { rolar = false } = {}) {
    if (!ponto) return
    setPontoAtencaoAtivoId(ponto.id)
    irParaSegundo(ponto.timestampSegundos)
    setCurrentTime(ponto.timestampSegundos)
    setPromptPontoId(null)
    pausarVideo()

    if (rolar) {
      requestAnimationFrame(() => {
        attentionDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }

  function abrirDetalhePonto(ponto, { pausar = true, rolar = false } = {}) {
    if (!ponto) return
    setPontoAtencaoAtivoId(ponto.id)
    setPromptPontoId(null)
    if (pausar) pausarVideo()

    if (rolar) {
      requestAnimationFrame(() => {
        attentionDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }

  function continuarAposPrompt() {
    setPromptPontoId(null)
    iniciarVideo()
  }

  function lidarDisparoPonto(ponto) {
    setDisparadosIds(current => {
      if (current.includes(ponto.id)) return current
      const next = [...current, ponto.id]
      disparadosIdsRef.current = new Set(next)
      return next
    })
    setPontoAtencaoAtivoId(ponto.id)

    if (ponto.modoExibicao === 'APENAS_LISTA') {
      return
    }

    if (!isMobileViewport || ponto.modoExibicao === 'AUTOMATICO') {
      pausarVideo()
    }

    if (ponto.modoExibicao === 'AUTOMATICO') {
      requestAnimationFrame(() => {
        attentionDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }

    setPromptPontoId(ponto.id)
  }

  function handleTimeUpdate(evento) {
    const tempoAtual = extrairNumeroEvento(evento, 'currentTime')
    if (tempoAtual === null) return

    const tempoArredondado = Number(tempoAtual)
    setCurrentTime(tempoArredondado)
    secondsRef.current = Math.max(secondsRef.current, Math.floor(tempoArredondado))

    const tempoAnterior = previousTimeRef.current
    previousTimeRef.current = tempoArredondado

    if (tempoArredondado + 0.75 < tempoAnterior) {
      const rearmados = pontosAtencaoAtivos
        .filter(item => item.timestampSegundos <= tempoArredondado)
        .map(item => item.id)

      setDisparadosIds(rearmados)
      disparadosIdsRef.current = new Set(rearmados)

      if (pontoEmPrompt && pontoEmPrompt.timestampSegundos > tempoArredondado) {
        setPromptPontoId(null)
      }

      return
    }

    if (tempoAtual < 2 && tempoAnterior > 10) {
      setDisparadosIds([])
      disparadosIdsRef.current = new Set()
      setPromptPontoId(null)
      return
    }

    const proximoPonto = pontosAtencaoAtivos.find(item => (
      !disparadosIdsRef.current.has(item.id) &&
      tempoAnterior < item.timestampSegundos &&
      tempoArredondado >= item.timestampSegundos
    ))

    if (proximoPonto) {
      lidarDisparoPonto(proximoPonto)
    }
  }

  function handleDurationChange(evento) {
    const valor = extrairNumeroEvento(evento, 'duration')
    if (valor !== null) {
      setDurationSegundos(Number(valor))
    }
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

  function renderPromptTexto(ponto) {
    if (!ponto) return ''
    if (ponto.modoExibicao === 'AUTOMATICO') {
      return 'Esse detalhe foi aberto automaticamente porque merece mais cuidado neste trecho.'
    }
    return ponto.descricaoCurta || 'Esse trecho tem um detalhe importante para revisar.'
  }

  function renderPainelPontos() {
    if (!pontosAtencaoAtivos.length) return null

    return (
      <>
        {pontoAtencaoAtivo && (
          <div className="attention-point-detail">
            <div className="attention-point-detail-meta">
              <span className="card-tag">{formatarTipoPonto(pontoAtencaoAtivo.tipo)}</span>
              <span className="card-tag">{formatarTimestamp(pontoAtencaoAtivo.timestampSegundos)}</span>
              <span className="card-tag">{formatarModoPonto(pontoAtencaoAtivo.modoExibicao)}</span>
            </div>
            <div className="attention-point-detail-title">{pontoAtencaoAtivo.titulo}</div>
            {(pontoAtencaoAtivo.descricaoCurta || pontoAtencaoAtivo.descricaoDetalhada) && (
              <div className="attention-point-detail-copy">
                {pontoAtencaoAtivo.descricaoCurta || pontoAtencaoAtivo.descricaoDetalhada}
              </div>
            )}
            {pontoAtencaoAtivo.imagemUrl && (
              <img
                src={pontoAtencaoAtivo.imagemUrl}
                alt={pontoAtencaoAtivo.titulo}
                className="attention-point-detail-image"
              />
            )}
            {pontoAtencaoAtivo.descricaoDetalhada && pontoAtencaoAtivo.descricaoDetalhada !== pontoAtencaoAtivo.descricaoCurta && (
              <div className="attention-point-detail-note">{pontoAtencaoAtivo.descricaoDetalhada}</div>
            )}
            <div className="attention-point-detail-actions">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => selecionarPonto(pontoAtencaoAtivo)}
              >
                Ir para este momento
              </button>
              {pontoAtencaoAtivo.videoUrl && (
                <a
                  className="btn btn-ghost"
                  href={pontoAtencaoAtivo.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir video explicativo
                </a>
              )}
            </div>
          </div>
        )}

        <div className="attention-point-list">
          {pontosAtencaoAtivos.map(item => (
            <button
              key={item.id}
              type="button"
              className={`attention-point-item${item.id === pontoAtencaoAtivoId ? ' is-active' : ''}`}
              onClick={() => selecionarPonto(item, { rolar: isMobileViewport })}
            >
              <div className="attention-point-item-time">{formatarTimestamp(item.timestampSegundos)}</div>
              <div className="attention-point-item-body">
                <div className="attention-point-item-title">{item.titulo}</div>
                <div className="attention-point-item-copy">
                  {item.descricaoCurta || formatarModoPonto(item.modoExibicao)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </>
    )
  }

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

  return (
    <>
      <button className="back-link" onClick={() => navigate('/biblioteca')}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        Voltar para a biblioteca
      </button>

      <div className="student-shell student-shell--compact">
        <div className="player-stage-shell">
          <div className="player-wrap">
            {playerPodeReproduzir ? (
              <>
                <ReactPlayer
                  ref={playerRef}
                  className="player-react"
                  src={percurso.videoUrl}
                  width="100%"
                  height="100%"
                  controls
                  playsInline
                  playing={playing}
                  onReady={() => setPlayerReady(true)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={handleDurationChange}
                  onError={() => setPlayerErro(true)}
                  config={{
                    youtube: {
                      rel: 0,
                      modestbranding: 1,
                      playsinline: 1,
                      iv_load_policy: 3,
                      fs: 0,
                      color: 'white',
                    },
                    vimeo: {
                      controls: true,
                      responsive: true,
                    },
                  }}
                />

                {pontoEmPrompt && !isMobileViewport && (
                  <div className="attention-overlay-card">
                    <div className="attention-overlay-meta">
                      <span className="card-tag">{formatarTipoPonto(pontoEmPrompt.tipo)}</span>
                      <span className="card-tag">{formatarTimestamp(pontoEmPrompt.timestampSegundos)}</span>
                    </div>
                    <div className="attention-overlay-title">{pontoEmPrompt.titulo}</div>
                    <div className="attention-overlay-copy">{renderPromptTexto(pontoEmPrompt)}</div>
                    <div className="attention-overlay-actions">
                      <button className="btn btn-primary" type="button" onClick={() => abrirDetalhePonto(pontoEmPrompt, { pausar: true })}>
                        Ver detalhe
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={continuarAposPrompt}>
                        Continuar assistindo
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="player-placeholder">
                <div className="big-play">
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                    <path d="M7 5l9 5-9 5V5z" fill="#2de09a" />
                  </svg>
                </div>
                <div className="player-url">{percurso.videoUrl}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  URL do video nao reconhecida pelo player.
                </div>
              </div>
            )}
          </div>

          {playerPodeReproduzir && (
            <div className="attention-timeline-shell">
              <div className="attention-timeline-header">
                <div className="mini-copy">
                  {playerReady
                    ? `Tempo atual: ${formatarTimestamp(currentTime)}`
                    : 'Carregando player...'}
                </div>
                <div className="mini-copy">{formatarTimestamp(duracaoBase)}</div>
              </div>
              <div className="attention-timeline-bar">
                <div
                  className="attention-timeline-progress"
                  style={{ width: `${clampPercentual(currentTime, duracaoBase)}%` }}
                />
                {pontosAtencaoAtivos.map(item => {
                  const visto = disparadosIds.includes(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`attention-marker${item.id === pontoAtencaoAtivoId ? ' is-active' : ''}${visto ? ' is-seen' : ''}`}
                      style={{ left: `${clampPercentual(item.timestampSegundos, duracaoBase)}%` }}
                      onClick={() => selecionarPonto(item)}
                      title={`${formatarTimestamp(item.timestampSegundos)} - ${item.titulo}`}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {pontoEmPrompt && isMobileViewport && (
            <div className="attention-mobile-sheet">
              <div className="attention-mobile-sheet-card">
                <div className="attention-overlay-meta">
                  <span className="card-tag">{formatarTipoPonto(pontoEmPrompt.tipo)}</span>
                  <span className="card-tag">{formatarTimestamp(pontoEmPrompt.timestampSegundos)}</span>
                </div>
                <div className="attention-overlay-title">{pontoEmPrompt.titulo}</div>
                <div className="attention-overlay-copy">{renderPromptTexto(pontoEmPrompt)}</div>
                <div className="attention-overlay-actions">
                  <button className="btn btn-primary" type="button" onClick={() => abrirDetalhePonto(pontoEmPrompt, { pausar: true, rolar: true })}>
                    Ver detalhe
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => setPromptPontoId(null)}>
                    Agora nao
                  </button>
                </div>
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
                <div className="player-meta-value">{formatDuracaoMinutos(percurso.duracaoSegundos || duracaoBase)}</div>
              </div>
            </div>

            {pontosAtencaoAtivos.length > 0 && (
              <div className="player-attention-inline">
                <div className="player-attention-inline-title">Pontos de atencao deste modulo</div>
                <div className="player-attention-inline-copy">
                  Esse video tem {pontosAtencaoAtivos.length} apoio{pontosAtencaoAtivos.length > 1 ? 's' : ''} com dicas, placas,
                  referencias e observacoes importantes para revisar.
                </div>
              </div>
            )}
          </div>

          <div className="player-side-stack">
            {pontosAtencaoAtivos.length > 0 && (
              <div className="player-side-card" ref={attentionDetailRef}>
                <div className="player-side-title">Pontos de atencao</div>
                <div className="player-side-copy">
                  Os marcadores na timeline mostram onde existem alertas importantes. No celular, voce pode assistir normalmente e abrir a explicacao quando quiser.
                </div>
                {renderPainelPontos()}
              </div>
            )}

            <div className="player-side-card">
              <div className="player-side-title">Seu andamento</div>
              <div className="player-side-copy">
                {concluido
                  ? 'Esse conteudo ja foi marcado como concluido. Se quiser, voce pode rever quantas vezes precisar.'
                  : 'Quando terminar, marque como concluido para acompanhar melhor sua preparacao.'}
              </div>
              {playerErro && (
                <div className="mini-copy" style={{ color: '#b91c1c' }}>
                  O player encontrou dificuldade para carregar esse video. Se o problema persistir, confira a URL no admin.
                </div>
              )}
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
        </div>
      </div>
    </>
  )
}
