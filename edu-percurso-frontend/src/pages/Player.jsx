import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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

function clampPercentual(segundos, duracaoSegundos) {
  if (!duracaoSegundos || duracaoSegundos <= 0) return 0
  return Math.max(0, Math.min(100, (Number(segundos || 0) / duracaoSegundos) * 100))
}

function detectarMobile() {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 720
}

function extrairYoutubeId(url = '') {
  const match = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  return match?.[1] || ''
}

function extrairVimeoId(url = '') {
  const match = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return match?.[1] || ''
}

function extrairBunnyVideoId(url = '') {
  const match = String(url).match(/mediadelivery\.net\/embed\/[^/]+\/([^/?#]+)/)
  return match?.[1] || ''
}

function carregarBunnyPlayerJs() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Janela indisponivel'))
  if (window.playerjs) return Promise.resolve(window.playerjs)

  return new Promise((resolve, reject) => {
    const existente = document.querySelector('script[data-bunny-playerjs="true"]')
    if (existente) {
      existente.addEventListener('load', () => resolve(window.playerjs), { once: true })
      existente.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js'
    script.async = true
    script.dataset.bunnyPlayerjs = 'true'
    script.onload = () => resolve(window.playerjs)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function resolverFontePlayer({ videoProvider, videoUrl, videoAssetId }) {
  const provider = String(videoProvider || '').toUpperCase()
  const normalizedUrl = String(videoUrl || '').trim()

  if (provider === 'BUNNY' || normalizedUrl.includes('mediadelivery.net/embed/')) {
    if (!normalizedUrl) return null
    return {
      provider: 'bunny',
      embedId: videoAssetId || extrairBunnyVideoId(normalizedUrl),
      embedUrl: normalizedUrl,
    }
  }

  const youtubeId = extrairYoutubeId(normalizedUrl)
  if (youtubeId) {
    return { provider: 'youtube', embedId: youtubeId }
  }

  const vimeoId = extrairVimeoId(normalizedUrl)
  if (vimeoId) {
    return { provider: 'vimeo', embedId: vimeoId }
  }

  return null
}

async function tentarTravarLandscape() {
  if (!screen.orientation?.lock) return
  try {
    await screen.orientation.lock('landscape')
  } catch (_) {
    // alguns browsers mobile bloqueiam orientation lock mesmo com gesto
  }
}

function liberarOrientationLock() {
  if (!screen.orientation?.unlock) return
  try {
    screen.orientation.unlock()
  } catch (_) {
    // safari/ios podem nao permitir unlock explicito
  }
}

async function sairDoFullscreenAtual() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement
  if (!fullscreenElement) return

  try {
    const waitForExit = new Promise(resolve => {
      let resolved = false
      const finish = () => {
        if (resolved) return
        resolved = true
        document.removeEventListener('fullscreenchange', finish)
        document.removeEventListener('webkitfullscreenchange', finish)
        window.clearTimeout(timeoutId)
        resolve()
      }

      document.addEventListener('fullscreenchange', finish)
      document.addEventListener('webkitfullscreenchange', finish)
      const timeoutId = window.setTimeout(finish, 350)
    })

    if (document.exitFullscreen) {
      await document.exitFullscreen()
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    }

    await waitForExit
  } catch (_) {
    // alguns providers/browsers falham silenciosamente ao sair do fullscreen
  }
}

const PLYR_CONTROLS = [
  'play-large',
  'play',
  'progress',
  'current-time',
  'duration',
  'mute',
  'volume',
  'settings',
  'fullscreen',
]

const PLYR_SETTINGS = ['quality', 'speed']
const PLYR_SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2]
const PLYR_QUALITY_OPTIONS = [2160, 1440, 1080, 720, 576, 480, 360, 240]

export default function Player() {
  const { id } = useParams()
  const navigate = useNavigate()
  const playerShellRef = useRef(null)
  const playerMountRef = useRef(null)
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
  const [currentTime, setCurrentTime] = useState(0)
  const [durationSegundos, setDurationSegundos] = useState(0)
  const [pontoAtencaoAtivoId, setPontoAtencaoAtivoId] = useState(null)
  const [promptPontoId, setPromptPontoId] = useState(null)
  const [disparadosIds, setDisparadosIds] = useState([])
  const [isMobileViewport, setIsMobileViewport] = useState(detectarMobile())
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false)

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
    return () => {
      liberarOrientationLock()
      sairDoFullscreenAtual()
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement
      setIsPlayerFullscreen(Boolean(fullscreenElement && fullscreenElement === playerShellRef.current))

      if (!fullscreenElement) liberarOrientationLock()
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
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
  const fontePlayer = useMemo(() => resolverFontePlayer({
    videoProvider: percurso?.videoProvider,
    videoUrl: percurso?.videoUrl,
    videoAssetId: percurso?.videoAssetId,
  }), [percurso?.videoAssetId, percurso?.videoProvider, percurso?.videoUrl])
  const playerPodeReproduzir = Boolean(fontePlayer)
  const duracaoBase = durationSegundos || percurso?.duracaoSegundos || (pontosAtencaoAtivos.at(-1)?.timestampSegundos || 0) + 30

  function pausarVideo() {
    if (playerRef.current?.pause) {
      try {
        const resultado = playerRef.current.pause()
        if (resultado?.catch) resultado.catch(() => {})
      } catch (_) {
        // ignora pausa em estados intermediarios do provedor
      }
    }
  }

  function iniciarVideo() {
    if (playerRef.current?.play) {
      try {
        const resultado = playerRef.current.play()
        if (resultado?.catch) resultado.catch(() => {})
      } catch (_) {
        // ignora autoplay bloqueado pelo navegador/provedor
      }
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

  function handleTimeUpdate(tempoAtual) {
    if (typeof tempoAtual !== 'number' || !Number.isFinite(tempoAtual)) return

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

    if (tempoArredondado < 2 && tempoAnterior > 10) {
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

  useEffect(() => {
    if (!playerPodeReproduzir || !playerMountRef.current || !fontePlayer) return

    let cancelled = false
    let player = null
    const usarFullscreenNativoNoMobile = detectarMobile()

    setPlayerReady(false)
    setPlayerErro(false)

    ;(async () => {
      try {
        if (cancelled || !playerMountRef.current) return

        if (fontePlayer.provider === 'bunny') {
          const playerjs = await carregarBunnyPlayerJs()
          if (cancelled || !playerMountRef.current) return

          const bunnyPlayer = new playerjs.Player(playerMountRef.current)
          let ultimoTempo = 0
          let ultimoDuration = 0

          const handleReady = () => {
            setPlayerReady(true)
            bunnyPlayer.getDuration(duration => {
              const numericDuration = Number(duration || 0)
              ultimoDuration = numericDuration
              setDurationSegundos(numericDuration)
            })

            if (secondsRef.current > 0) {
              bunnyPlayer.setCurrentTime(secondsRef.current)
              setCurrentTime(secondsRef.current)
            }
          }

          const handleTime = data => {
            const tempoAtual = Number(
              data?.seconds ??
              data?.currentTime ??
              data?.data?.seconds ??
              data?.data?.currentTime ??
              ultimoTempo
            )

            if (Number.isFinite(tempoAtual)) {
              ultimoTempo = tempoAtual
              handleTimeUpdate(tempoAtual)
            }

            const proximaDuracao = Number(data?.duration ?? data?.data?.duration ?? ultimoDuration)
            if (Number.isFinite(proximaDuracao) && proximaDuracao > 0) {
              ultimoDuration = proximaDuracao
              setDurationSegundos(proximaDuracao)
            }
          }

          const handlePause = () => {}
          const handleError = () => setPlayerErro(true)

          bunnyPlayer.on('ready', handleReady)
          bunnyPlayer.on('timeupdate', handleTime)
          bunnyPlayer.on('pause', handlePause)
          bunnyPlayer.on('error', handleError)

          player = {
            pause: () => bunnyPlayer.pause(),
            play: () => bunnyPlayer.play(),
            destroy: () => {
              if (typeof bunnyPlayer.off === 'function') {
                bunnyPlayer.off('ready', handleReady)
                bunnyPlayer.off('timeupdate', handleTime)
                bunnyPlayer.off('pause', handlePause)
                bunnyPlayer.off('error', handleError)
              }
            },
            set currentTime(value) {
              bunnyPlayer.setCurrentTime(Math.max(0, Number(value) || 0))
            },
            get currentTime() {
              return ultimoTempo
            },
          }

          playerRef.current = player
          return
        }

        const [{ default: Plyr }] = await Promise.all([
          import('plyr'),
          import('plyr/dist/plyr.css'),
        ])

        if (cancelled || !playerMountRef.current) return

        playerMountRef.current.innerHTML = ''
        playerMountRef.current.setAttribute('data-plyr-provider', fontePlayer.provider)
        playerMountRef.current.setAttribute('data-plyr-embed-id', fontePlayer.embedId)

        player = new Plyr(playerMountRef.current, {
          controls: PLYR_CONTROLS,
          settings: PLYR_SETTINGS,
          speed: {
            selected: 1,
            options: PLYR_SPEED_OPTIONS,
          },
          quality: {
            default: 1080,
            options: PLYR_QUALITY_OPTIONS,
          },
          keyboard: {
            focused: true,
            global: false,
          },
          tooltips: {
            controls: true,
            seek: true,
          },
          fullscreen: {
            enabled: true,
            fallback: !usarFullscreenNativoNoMobile,
            iosNative: usarFullscreenNativoNoMobile,
          },
          youtube: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            iv_load_policy: 3,
            noCookie: true,
          },
          vimeo: {
            byline: false,
            portrait: false,
            title: false,
            transparent: false,
          },
        })

        if (cancelled) {
          player.destroy()
          return
        }

        playerRef.current = player

        const handleReady = () => {
          setPlayerReady(true)
          setDurationSegundos(Number(player.duration || 0))

          try {
            player.quality = 1080
          } catch (_) {
            // qualidade segue automatica se o provedor nao aceitar troca imediata
          }

          try {
            if (typeof player.embed?.setPlaybackQuality === 'function') {
              player.embed.setPlaybackQuality('hd1080')
            }
          } catch (_) {
            // fallback silencioso para embeds que nao expoem esse controle
          }

          if (secondsRef.current > 0) {
            setTimeout(() => {
              try {
                player.currentTime = secondsRef.current
                setCurrentTime(secondsRef.current)
              } catch (_) {
                // ignora restauracao falha de tempo
              }
            }, 150)
          }
        }

        const handleTime = () => handleTimeUpdate(Number(player.currentTime || 0))
        const handleDuration = () => setDurationSegundos(Number(player.duration || 0))
        const handleError = () => setPlayerErro(true)
        const handleEnterFullscreen = async () => {
          setIsPlayerFullscreen(true)
          await tentarTravarLandscape()
        }
        const handleExitFullscreen = () => {
          setIsPlayerFullscreen(false)
          liberarOrientationLock()
        }

        player.on('ready', handleReady)
        player.on('timeupdate', handleTime)
        player.on('seeking', handleTime)
        player.on('seeked', handleTime)
        player.on('durationchange', handleDuration)
        player.on('loadedmetadata', handleDuration)
        player.on('error', handleError)
        player.on('enterfullscreen', handleEnterFullscreen)
        player.on('exitfullscreen', handleExitFullscreen)

        player._customCleanup = () => {
          player.off('ready', handleReady)
          player.off('timeupdate', handleTime)
          player.off('seeking', handleTime)
          player.off('seeked', handleTime)
          player.off('durationchange', handleDuration)
          player.off('loadedmetadata', handleDuration)
          player.off('error', handleError)
          player.off('enterfullscreen', handleEnterFullscreen)
          player.off('exitfullscreen', handleExitFullscreen)
        }
      } catch (_) {
        if (!cancelled) {
          setPlayerErro(true)
        }
      }
    })()

    return () => {
      cancelled = true
      if (player?._customCleanup) {
        player._customCleanup()
      }
      if (player) {
        player.destroy()
      }
      playerRef.current = null
    }
  }, [fontePlayer, id, playerPodeReproduzir])

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

  async function togglePlayerFullscreen() {
    const shell = playerShellRef.current
    if (!shell) return

    try {
      const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement
      if (fullscreenElement === shell) {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen()
        }
        return
      }

      if (shell.requestFullscreen) {
        await shell.requestFullscreen({ navigationUI: 'hide' })
      } else if (shell.webkitRequestFullscreen) {
        shell.webkitRequestFullscreen()
      }

      await tentarTravarLandscape()
    } catch (_) {
      // falha silenciosa; o fallback continua sendo o fullscreen do provedor
    }
  }

  async function voltarParaBiblioteca() {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement
    if (fullscreenElement) {
      await sairDoFullscreenAtual()
      document.body.classList.remove('player-mobile-focus')
      liberarOrientationLock()
      setIsPlayerFullscreen(false)
      return
    }

    setPromptPontoId(null)
    pausarVideo()
    try {
      if (playerRef.current?._customCleanup) {
        playerRef.current._customCleanup()
      }
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
      }
    } catch (_) {
      // alguns providers podem falhar no destroy durante transicao de rota
    }
    playerRef.current = null
    document.body.classList.remove('player-mobile-focus')
    liberarOrientationLock()
    setIsPlayerFullscreen(false)
    navigate('/biblioteca')
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
      <button className="back-link" onClick={voltarParaBiblioteca}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        {isPlayerFullscreen ? 'Sair da tela cheia' : 'Voltar para a biblioteca'}
      </button>

      <div className="student-shell student-shell--compact">
        <div ref={playerShellRef} className={`player-stage-shell${isPlayerFullscreen ? ' is-fullscreen' : ''}`}>
          <div className="player-wrap">
            {playerPodeReproduzir && fontePlayer?.provider === 'bunny' && isMobileViewport && (
              <button
                type="button"
                className="player-fullscreen-toggle"
                onClick={togglePlayerFullscreen}
              >
                {isPlayerFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              </button>
            )}
            {playerPodeReproduzir ? (
              <>
                {fontePlayer?.provider === 'bunny' ? (
                  <iframe
                    ref={playerMountRef}
                    className="player-react"
                    src={fontePlayer.embedUrl}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    title={percurso.titulo}
                  />
                ) : (
                  <div ref={playerMountRef} className="player-react" />
                )}

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
