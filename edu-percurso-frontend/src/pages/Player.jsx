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
  const videoExplicativoMountRef = useRef(null)
  const videoExplicativoPlayerRef = useRef(null)
  const attentionDetailRef = useRef(null)
  const previousTimeRef = useRef(0)
  const disparadosIdsRef = useRef(new Set())
  const secondsRef = useRef(0)
  const promptPontoIdRef = useRef(null)
  const pontoEmPromptRef = useRef(null)
  const reproducaoIniciadaRef = useRef(false)
  const playerEstaReproduzindoRef = useRef(false)
  const buscaManualEmAndamentoRef = useRef(false)
  const autoConclusaoEmAndamentoRef = useRef(false)
  const promptAutoCloseInicioTempoRef = useRef(null)
  const promptAutoCloseTempoAssistidoRef = useRef(0)
  const interrupcoesAtivasRef = useRef(true)
  const reativacaoInterrupcoesTempoRef = useRef(null)
  const currentTimeRef = useRef(0)
  const ultimoEstadoInterrupcoesRef = useRef(true)

  const [percurso, setPercurso] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [concluido, setConcluido] = useState(false)
  const [progressoConteudos, setProgressoConteudos] = useState([])
  const [percursosDisponiveis, setPercursosDisponiveis] = useState([])
  const [playerReady, setPlayerReady] = useState(false)
  const [playerErro, setPlayerErro] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [durationSegundos, setDurationSegundos] = useState(0)
  const [pontoAtencaoAtivoId, setPontoAtencaoAtivoId] = useState(null)
  const [pontoExpandidoId, setPontoExpandidoId] = useState(null)
  const [promptPontoId, setPromptPontoId] = useState(null)
  const [disparadosIds, setDisparadosIds] = useState([])
  const [isMobileViewport, setIsMobileViewport] = useState(detectarMobile())
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false)
  const [videoExplicativoAberto, setVideoExplicativoAberto] = useState(false)
  const [explicacaoPontoAbertaId, setExplicacaoPontoAbertaId] = useState(null)
  const [interrupcoesAtivas, setInterrupcoesAtivas] = useState(true)
  const [moduloNavAberta, setModuloNavAberta] = useState(false)

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
      promptAutoCloseInicioTempoRef.current = null
      promptAutoCloseTempoAssistidoRef.current = 0
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
    document.body.classList.add('player-page-wide')
    return () => {
      document.body.classList.remove('player-page-wide')
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
    setProgressoConteudos([])
    setPercursosDisponiveis([])
    setPlayerReady(false)
    setPlayerErro(false)
    setCurrentTime(0)
    setDurationSegundos(0)
    setPontoAtencaoAtivoId(null)
    setPontoExpandidoId(null)
    definirPromptPonto(null)
    setDisparadosIds([])
    setVideoExplicativoAberto(false)
    setExplicacaoPontoAbertaId(null)
    setInterrupcoesAtivas(true)
    setModuloNavAberta(false)
    disparadosIdsRef.current = new Set()
    secondsRef.current = 0
    reproducaoIniciadaRef.current = false
    buscaManualEmAndamentoRef.current = false
    previousTimeRef.current = 0
    autoConclusaoEmAndamentoRef.current = false

    Promise.all([percursoService.buscar(id), progressoService.meu(), percursoService.listar()])
      .then(([percursoResp, progressoResp, percursosResp]) => {
        setPercurso(percursoResp)
        setProgressoConteudos(progressoResp)
        setPercursosDisponiveis(Array.isArray(percursosResp) ? percursosResp : [])

        const progressoAtual = progressoResp.find(item => String(item.percursoId) === String(id))
        if (progressoAtual) {
          setConcluido(Boolean(progressoAtual.concluido))
          secondsRef.current = progressoAtual.segundosAssistidos || 0
          autoConclusaoEmAndamentoRef.current = Boolean(progressoAtual.concluido)
        }
      })
      .catch(error => {
        setErro(error.response?.data?.erro || 'Nao foi possivel carregar esse conteudo.')
        setPercurso(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  const configuracaoPontosAtencao = percurso?.configuracaoPontosAtencao || 'AUTOMATICO'
  const pontosAtencaoOcultos = configuracaoPontosAtencao === 'OCULTAR'
  const pontosAtencaoSempreVisiveis = configuracaoPontosAtencao === 'SEMPRE_MOSTRAR'

  const pontosAtencaoBrutos = useMemo(() => (
    (percurso?.pontosAtencao || [])
      .filter(item => item.ativo)
      .sort((a, b) => {
        const ordemA = a.ordemExibicao ?? 0
        const ordemB = b.ordemExibicao ?? 0
        if (ordemA !== ordemB) return ordemA - ordemB
        return (a.timestampSegundos ?? 0) - (b.timestampSegundos ?? 0)
      })
  ), [percurso])

  const pontosAtencaoAtivos = useMemo(() => (
    pontosAtencaoOcultos ? [] : pontosAtencaoBrutos
  ), [pontosAtencaoBrutos, pontosAtencaoOcultos])

  useEffect(() => {
    const estavaAtiva = ultimoEstadoInterrupcoesRef.current
    interrupcoesAtivasRef.current = interrupcoesAtivas
    ultimoEstadoInterrupcoesRef.current = interrupcoesAtivas

    if (!interrupcoesAtivas) {
      reativacaoInterrupcoesTempoRef.current = null
      return
    }

    if (estavaAtiva === interrupcoesAtivas) {
      return
    }

    const tempoBase = Math.max(0, Number(currentTimeRef.current) || 0)
    reativacaoInterrupcoesTempoRef.current = tempoBase

    const rearmados = pontosAtencaoAtivos
      .filter(item => item.timestampSegundos <= tempoBase)
      .map(item => item.id)

    disparadosIdsRef.current = new Set(rearmados)
    setDisparadosIds(rearmados)
  }, [interrupcoesAtivas, pontosAtencaoAtivos])

  useEffect(() => {
    if (!pontosAtencaoOcultos) return

    setPontoAtencaoAtivoId(null)
    setPontoExpandidoId(null)
    definirPromptPonto(null)
    setVideoExplicativoAberto(false)
    setExplicacaoPontoAbertaId(null)
    setDisparadosIds([])
    disparadosIdsRef.current = new Set()
  }, [pontosAtencaoOcultos])

  useEffect(() => {
    if (!pontosAtencaoAtivos.length) {
      setPontoAtencaoAtivoId(null)
      setPontoExpandidoId(null)
      setExplicacaoPontoAbertaId(null)
      return
    }

    setPontoAtencaoAtivoId(current => (
      pontosAtencaoAtivos.some(item => item.id === current)
        ? current
        : null
    ))
    setPontoExpandidoId(current => (
      pontosAtencaoAtivos.some(item => item.id === current)
        ? current
        : null
    ))
    setExplicacaoPontoAbertaId(current => (
      pontosAtencaoAtivos.some(item => item.id === current)
        ? current
        : null
    ))
  }, [pontosAtencaoAtivos])

  const pontoAtencaoAtivo = pontosAtencaoAtivos.find(item => item.id === pontoAtencaoAtivoId) || null
  const pontoExpandidoAtual = pontosAtencaoAtivos.find(item => item.id === pontoExpandidoId) || null
  const pontoEmPrompt = pontosAtencaoAtivos.find(item => item.id === promptPontoId) || null
  const pontoExplicacaoAtual = pontosAtencaoAtivos.find(item => item.id === explicacaoPontoAbertaId) || null
  const pontoVideoExplicativoAtual = videoExplicativoAberto ? (pontoExpandidoAtual || pontoAtencaoAtivo) : null

  useEffect(() => {
    promptPontoIdRef.current = promptPontoId
    pontoEmPromptRef.current = pontoEmPrompt

    if (!promptPontoId) {
      promptAutoCloseInicioTempoRef.current = null
      promptAutoCloseTempoAssistidoRef.current = 0
    }
  }, [pontoEmPrompt, promptPontoId])

  const fonteVideoExplicativo = useMemo(() => resolverFontePlayer({
    videoProvider: pontoVideoExplicativoAtual?.videoUrl?.includes('mediadelivery.net/embed/') ? 'BUNNY' : undefined,
    videoUrl: pontoVideoExplicativoAtual?.videoUrl,
    videoAssetId: undefined,
  }), [pontoVideoExplicativoAtual?.videoUrl])
  const fontePlayer = useMemo(() => resolverFontePlayer({
    videoProvider: percurso?.videoProvider,
    videoUrl: percurso?.videoUrl,
    videoAssetId: percurso?.videoAssetId,
  }), [percurso?.videoAssetId, percurso?.videoProvider, percurso?.videoUrl])
  const progressoPorPercursoId = useMemo(() => new Map(
    progressoConteudos.map(item => [String(item.percursoId), item])
  ), [progressoConteudos])
  const playerPodeReproduzir = Boolean(fontePlayer)
  const duracaoBase = durationSegundos || percurso?.duracaoSegundos || (pontosAtencaoBrutos.at(-1)?.timestampSegundos || 0) + 30
  const conteudosDoModulo = useMemo(() => {
    if (!percurso) return []

    const ordenarPercursos = (a, b) => {
      const ordemA = a?.ordemExibicao ?? 0
      const ordemB = b?.ordemExibicao ?? 0
      if (ordemA !== ordemB) return ordemA - ordemB

      const criadoEmA = a?.criadoEm ? new Date(a.criadoEm).getTime() : 0
      const criadoEmB = b?.criadoEm ? new Date(b.criadoEm).getTime() : 0
      if (criadoEmA !== criadoEmB) return criadoEmB - criadoEmA

      return String(a?.titulo || '').localeCompare(String(b?.titulo || ''), 'pt-BR')
    }

    const relacionados = percursosDisponiveis.filter(item => {
      if (!item?.id) return false
      if (percurso.localProvaSlug) return item.localProvaSlug === percurso.localProvaSlug
      return !item.localProvaSlug
    })

    if (!relacionados.some(item => String(item.id) === String(percurso.id))) {
      relacionados.push(percurso)
    }

    return [...relacionados].sort(ordenarPercursos)
  }, [percursosDisponiveis, percurso])
  const indiceConteudoAtual = useMemo(() => (
    conteudosDoModulo.findIndex(item => String(item.id) === String(percurso?.id))
  ), [conteudosDoModulo, percurso?.id])
  const exibirAreaPontos = !pontosAtencaoOcultos && (
    pontosAtencaoSempreVisiveis ||
    pontosAtencaoAtivos.length > 0 ||
    conteudosDoModulo.length > 1
  )
  const exibirRailPontosDesktop = !isMobileViewport && exibirAreaPontos
  const exibirVideoInlineMobile = isMobileViewport && videoExplicativoAberto && Boolean(pontoVideoExplicativoAtual) && Boolean(fonteVideoExplicativo)

  function definirPromptPonto(id) {
    promptPontoIdRef.current = id
    promptAutoCloseInicioTempoRef.current = null
    promptAutoCloseTempoAssistidoRef.current = 0
    if (!id) {
      pontoEmPromptRef.current = null
    }
    setPromptPontoId(id)
  }

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

  function voltarParaVideoPrincipal() {
    requestAnimationFrame(() => {
      playerShellRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
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

  function abrirPonto(ponto, { rolar = false } = {}) {
    if (!ponto) return
    promptAutoCloseInicioTempoRef.current = null
    setPontoAtencaoAtivoId(ponto.id)
    setPontoExpandidoId(ponto.id)
    irParaSegundo(ponto.timestampSegundos)
    setCurrentTime(ponto.timestampSegundos)
    definirPromptPonto(null)
    setVideoExplicativoAberto(false)
    setExplicacaoPontoAbertaId(null)
    pausarVideo()

    if (rolar) {
      requestAnimationFrame(() => {
        attentionDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }

  function alternarPonto(ponto, { rolar = false } = {}) {
    if (!ponto) return

    if (pontoExpandidoId === ponto.id) {
      setPontoExpandidoId(null)
      setVideoExplicativoAberto(false)
      setExplicacaoPontoAbertaId(null)
      definirPromptPonto(null)
      return
    }

    abrirPonto(ponto, { rolar })
  }

  function abrirPromptPonto(ponto) {
    if (!ponto) return

    promptAutoCloseInicioTempoRef.current = null

    if (ponto.modoExibicao === 'APENAS_LISTA') {
      abrirPonto(ponto, { rolar: isMobileViewport })
      return
    }

    setPontoAtencaoAtivoId(ponto.id)
    setPontoExpandidoId(null)
    irParaSegundo(ponto.timestampSegundos)
    setCurrentTime(ponto.timestampSegundos)
    setVideoExplicativoAberto(false)
    setExplicacaoPontoAbertaId(null)
    pausarVideo()

    definirPromptPonto(ponto.id)
  }

  function pontoTemExplicacao(ponto) {
    if (!ponto) return false
    return Boolean(
      String(ponto.descricaoCurta || '').trim() ||
      String(ponto.descricaoDetalhada || '').trim() ||
      String(ponto.imagemUrl || '').trim()
    )
  }

  function pontoTemAudio(ponto) {
    if (!ponto) return false
    return Boolean(String(ponto.audioUrl || '').trim())
  }

  function obterRotuloAbrirPonto(ponto) {
    const temExplicacao = pontoTemExplicacao(ponto)
    const temVideo = Boolean(String(ponto?.videoUrl || '').trim())

    if (temExplicacao && temVideo) return 'Abrir ponto'
    if (temVideo) return 'Ver vídeo'
    return 'Ver explicação'
  }

  function fecharVideoExplicativo() {
    setVideoExplicativoAberto(false)
  }

  function fecharExplicacaoPonto() {
    setExplicacaoPontoAbertaId(null)
  }

  function abrirExplicacaoPonto(ponto, { rolar = false, pausar = true } = {}) {
    if (!ponto) return

    promptAutoCloseInicioTempoRef.current = null

    if (isMobileViewport) {
      abrirPonto(ponto, { rolar })
      return
    }

    setPontoAtencaoAtivoId(ponto.id)
    setPontoExpandidoId(null)
    definirPromptPonto(null)
    setVideoExplicativoAberto(false)
    setExplicacaoPontoAbertaId(ponto.id)

    if (pausar) pausarVideo()
  }

  function abrirAudioPonto(ponto, { rolar = false, pausar = true } = {}) {
    if (!ponto) return

    promptAutoCloseInicioTempoRef.current = null

    if (isMobileViewport) {
      abrirPonto(ponto, { rolar })
      return
    }

    setPontoAtencaoAtivoId(ponto.id)
    setPontoExpandidoId(null)
    definirPromptPonto(null)
    setVideoExplicativoAberto(false)
    setExplicacaoPontoAbertaId(ponto.id)

    if (pausar) pausarVideo()
  }

  function abrirVideoPonto(ponto, { pausar = true, rolar = false } = {}) {
    if (!ponto) return
    promptAutoCloseInicioTempoRef.current = null
    setPontoAtencaoAtivoId(ponto.id)
    setPontoExpandidoId(ponto.id)
    definirPromptPonto(null)
    setExplicacaoPontoAbertaId(null)
    if (pausar) pausarVideo()

    const fonte = resolverFontePlayer({
      videoProvider: ponto.videoUrl?.includes('mediadelivery.net/embed/') ? 'BUNNY' : undefined,
      videoUrl: ponto.videoUrl,
      videoAssetId: undefined,
    })

    if (fonte) {
      setVideoExplicativoAberto(true)
      if (rolar) {
        requestAnimationFrame(() => {
          attentionDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
      }
      return
    }

    if (ponto.videoUrl) {
      window.open(ponto.videoUrl, '_blank', 'noopener,noreferrer')
    }
  }

  function continuarAposPrompt() {
    promptAutoCloseInicioTempoRef.current = null
    definirPromptPonto(null)
    iniciarVideo()
  }

  function renderConteudoExpandidoPonto(ponto) {
    if (!ponto) return null

    const textoPonto = ponto.descricaoDetalhada || ponto.descricaoCurta || ''
    const temExplicacao = Boolean(textoPonto.trim() || String(ponto.imagemUrl || '').trim())
    const temAudio = pontoTemAudio(ponto)
    const temVideo = Boolean(String(ponto.videoUrl || '').trim())
    const videoInlineAberto = isMobileViewport && videoExplicativoAberto && pontoExpandidoId === ponto.id && fonteVideoExplicativo

    if (!temExplicacao && !temAudio && !temVideo) return null

    return (
      <div className="attention-point-item-expand">
        {isMobileViewport && (temExplicacao || temAudio) && (
          <div className="attention-point-item-back-row">
            <button
              className="btn btn-primary attention-point-item-back-button"
              type="button"
              onClick={voltarParaVideoPrincipal}
            >
              Voltar para o video
            </button>
          </div>
        )}

        {textoPonto && (
          <div className="attention-point-detail-copy">
            {textoPonto}
          </div>
        )}

        {ponto.imagemUrl && (
          <img
            src={ponto.imagemUrl}
            alt={ponto.titulo}
            className="attention-point-detail-image"
          />
        )}

        {temAudio && (
          <div className="attention-point-detail-audio-wrap">
            <audio
              className="attention-point-detail-audio"
              controls
              preload="none"
              src={ponto.audioUrl}
            />
          </div>
        )}

        {temVideo && (
          <div className="attention-point-item-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                if (videoInlineAberto) {
                  fecharVideoExplicativo()
                  voltarParaVideoPrincipal()
                  return
                }

                abrirVideoPonto(ponto)
              }}
            >
              {videoInlineAberto ? 'Fechar video' : 'Ver video'}
            </button>
          </div>
        )}

        {videoInlineAberto && (
          <div className="attention-point-inline-video">
            <div className="attention-video-modal-player">
              {fonteVideoExplicativo.provider === 'bunny' ? (
                <iframe
                  className="attention-video-modal-frame"
                  src={fonteVideoExplicativo.embedUrl}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  title={ponto.titulo}
                />
              ) : (
                <div
                  ref={videoExplicativoMountRef}
                  className="attention-video-modal-frame"
                  data-plyr-provider={fonteVideoExplicativo.provider}
                  data-plyr-embed-id={fonteVideoExplicativo.embedId}
                />
              )}
            </div>

            {ponto.descricaoCurta && (
              <div className="attention-video-modal-copy">{ponto.descricaoCurta}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  function lidarDisparoPonto(ponto) {
    if (ponto.modoExibicao === 'APENAS_LISTA') {
      setDisparadosIds(current => {
        if (current.includes(ponto.id)) return current
        const next = [...current, ponto.id]
        disparadosIdsRef.current = new Set(next)
        return next
      })
      setPontoAtencaoAtivoId(ponto.id)
      return
    }

    if (!interrupcoesAtivasRef.current) {
      return
    }

    setDisparadosIds(current => {
      if (current.includes(ponto.id)) return current
      const next = [...current, ponto.id]
      disparadosIdsRef.current = new Set(next)
      return next
    })
    setPontoAtencaoAtivoId(ponto.id)

    if (ponto.pausarAoExibir ?? true) {
      pausarVideo()
    }

    if (ponto.modoExibicao === 'AUTOMATICO' && (ponto.pausarAoExibir ?? true)) {
      requestAnimationFrame(() => {
        attentionDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }

    definirPromptPonto(ponto.id)
  }

  function handleTimeUpdate(tempoAtual, { ignorarDisparos = false } = {}) {
    if (typeof tempoAtual !== 'number' || !Number.isFinite(tempoAtual)) return

    const tempoArredondado = Number(tempoAtual)
    setCurrentTime(tempoArredondado)
    currentTimeRef.current = tempoArredondado
    secondsRef.current = Math.max(secondsRef.current, Math.floor(tempoArredondado))

    const tempoAnterior = previousTimeRef.current
    previousTimeRef.current = tempoArredondado

    if (promptPontoIdRef.current) {
      const pontoPromptAtual = pontoEmPromptRef.current
      const deveAutoOcultar =
        pontoPromptAtual?.modoExibicao === 'AUTOMATICO' &&
        Boolean(pontoPromptAtual?.ocultarAutomaticamente ?? true)

      if (deveAutoOcultar) {
        const deltaTempo = tempoArredondado - tempoAnterior
        if (deltaTempo > 0 && deltaTempo <= 2.5) {
          promptAutoCloseTempoAssistidoRef.current += deltaTempo
          const limite = Math.max(3, Math.min(20, Number(pontoPromptAtual?.segundosParaOcultar) || 10))
          if (promptAutoCloseTempoAssistidoRef.current >= limite) {
            definirPromptPonto(null)
          }
        }
      } else {
        promptAutoCloseTempoAssistidoRef.current = 0
      }
    }

    if (!reproducaoIniciadaRef.current) {
      return
    }

    if (ignorarDisparos || buscaManualEmAndamentoRef.current) {
      return
    }

    if (tempoArredondado + 0.75 < tempoAnterior) {
      promptAutoCloseTempoAssistidoRef.current = 0
      const rearmados = pontosAtencaoAtivos
        .filter(item => item.timestampSegundos <= tempoArredondado)
        .map(item => item.id)

      setDisparadosIds(rearmados)
      disparadosIdsRef.current = new Set(rearmados)

      if (pontoEmPromptRef.current && pontoEmPromptRef.current.timestampSegundos > tempoArredondado) {
        definirPromptPonto(null)
      }

      return
    }

    if (tempoArredondado < 2 && tempoAnterior > 10) {
      promptAutoCloseTempoAssistidoRef.current = 0
      setDisparadosIds([])
      disparadosIdsRef.current = new Set()
      definirPromptPonto(null)
      return
    }

    if (tempoArredondado - tempoAnterior > 2.5) {
      return
    }

    if (!concluido && duracaoBase > 0) {
      const margemConclusao = Math.min(2, Math.max(0.8, duracaoBase * 0.01))
      if (tempoArredondado >= duracaoBase - margemConclusao) {
        concluirAutomaticamente(tempoArredondado)
      }
    }

    const tempoBaseDisparo = reativacaoInterrupcoesTempoRef.current ?? tempoAnterior

    const proximoPonto = pontosAtencaoAtivos.find(item => (
      !disparadosIdsRef.current.has(item.id) &&
      tempoBaseDisparo < item.timestampSegundos &&
      tempoArredondado >= item.timestampSegundos
    ))

    if (proximoPonto) {
      reativacaoInterrupcoesTempoRef.current = null
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

          const handlePlay = () => {
            reproducaoIniciadaRef.current = true
            playerEstaReproduzindoRef.current = true
          }
          const handlePause = () => {
            playerEstaReproduzindoRef.current = false
            promptAutoCloseInicioTempoRef.current = null
          }
          const handleError = () => setPlayerErro(true)

          bunnyPlayer.on('ready', handleReady)
          bunnyPlayer.on('timeupdate', handleTime)
          bunnyPlayer.on('play', handlePlay)
          bunnyPlayer.on('pause', handlePause)
          bunnyPlayer.on('error', handleError)

          player = {
            pause: () => bunnyPlayer.pause(),
            play: () => bunnyPlayer.play(),
            destroy: () => {
              if (typeof bunnyPlayer.off === 'function') {
                bunnyPlayer.off('ready', handleReady)
                bunnyPlayer.off('timeupdate', handleTime)
                bunnyPlayer.off('play', handlePlay)
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
        const handleSeek = () => {
          buscaManualEmAndamentoRef.current = true
          handleTimeUpdate(Number(player.currentTime || 0), { ignorarDisparos: true })
        }
        const handleSeeked = () => {
          handleTimeUpdate(Number(player.currentTime || 0), { ignorarDisparos: true })
          window.setTimeout(() => {
            buscaManualEmAndamentoRef.current = false
          }, 0)
        }
        const handlePlay = () => {
          reproducaoIniciadaRef.current = true
          playerEstaReproduzindoRef.current = true
        }
        const handlePause = () => {
          playerEstaReproduzindoRef.current = false
          promptAutoCloseInicioTempoRef.current = null
        }
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
        player.on('play', handlePlay)
        player.on('pause', handlePause)
        player.on('seeking', handleSeek)
        player.on('seeked', handleSeeked)
        player.on('durationchange', handleDuration)
        player.on('loadedmetadata', handleDuration)
        player.on('error', handleError)
        player.on('enterfullscreen', handleEnterFullscreen)
        player.on('exitfullscreen', handleExitFullscreen)

        player._customCleanup = () => {
          player.off('ready', handleReady)
          player.off('timeupdate', handleTime)
          player.off('play', handlePlay)
          player.off('pause', handlePause)
          player.off('seeking', handleSeek)
          player.off('seeked', handleSeeked)
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

  useEffect(() => {
    if (!videoExplicativoAberto || !fonteVideoExplicativo || !videoExplicativoMountRef.current) return
    if (fonteVideoExplicativo.provider === 'bunny') return

    let cancelled = false
    let player = null

    ;(async () => {
      try {
        const [{ default: Plyr }] = await Promise.all([
          import('plyr'),
          import('plyr/dist/plyr.css'),
        ])

        if (cancelled || !videoExplicativoMountRef.current) return

        videoExplicativoMountRef.current.innerHTML = ''
        videoExplicativoMountRef.current.setAttribute('data-plyr-provider', fonteVideoExplicativo.provider)
        videoExplicativoMountRef.current.setAttribute('data-plyr-embed-id', fonteVideoExplicativo.embedId)

        player = new Plyr(videoExplicativoMountRef.current, {
          controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
          keyboard: {
            focused: true,
            global: false,
          },
          tooltips: {
            controls: true,
            seek: true,
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

        videoExplicativoPlayerRef.current = player
      } catch (_) {
        // fallback permanece no link externo se necessario
      }
    })()

    return () => {
      cancelled = true
      if (player) {
        player.destroy()
      }
      videoExplicativoPlayerRef.current = null
    }
  }, [fonteVideoExplicativo, videoExplicativoAberto])

  function aplicarProgressoSalvo(progresso) {
    setConcluido(Boolean(progresso.concluido))
    secondsRef.current = progresso.segundosAssistidos || secondsRef.current
    setProgressoConteudos(current => {
      const restante = current.filter(item => String(item.percursoId) !== String(id))
      return [...restante, progresso]
    })
  }

  async function concluirAutomaticamente(segundosAssistidos) {
    if (!id || concluido || autoConclusaoEmAndamentoRef.current) return

    autoConclusaoEmAndamentoRef.current = true

    try {
      const progresso = await progressoService.salvar({
        percursoId: id,
        segundosAssistidos: Math.max(
          Math.floor(segundosAssistidos || 0),
          Math.floor(percurso?.duracaoSegundos || 0),
          Math.floor(duracaoBase || 0),
          secondsRef.current,
        ),
        concluido: true,
      })
      aplicarProgressoSalvo(progresso)
    } catch (_) {
      autoConclusaoEmAndamentoRef.current = false
    }
  }

  function obterStatusConteudoModulo(item, index) {
    if (String(item.id) === String(percurso?.id)) {
      return { label: 'Atual', classe: 'is-current' }
    }

    if (indiceConteudoAtual >= 0 && index === indiceConteudoAtual + 1) {
      return { label: 'Proximo', classe: 'is-next' }
    }

    const progresso = progressoPorPercursoId.get(String(item.id))
    if (progresso?.concluido) {
      return { label: 'Concluido', classe: 'is-completed' }
    }

    if ((progresso?.segundosAssistidos || 0) > 0) {
      return { label: 'Em andamento', classe: 'is-progress' }
    }

    return null
  }

  function abrirConteudoModulo(item) {
    if (!item?.id || String(item.id) === String(percurso?.id)) return
    definirPromptPonto(null)
    setPontoAtencaoAtivoId(null)
    setPontoExpandidoId(null)
    setVideoExplicativoAberto(false)
    setExplicacaoPontoAbertaId(null)
    pausarVideo()
    navigate(`/conteudos/${item.id}`)
  }

  function renderPromptTexto(ponto) {
    if (!ponto) return ''
    if (ponto.modoExibicao === 'AUTOMATICO') {
      return 'Esse detalhe foi aberto automaticamente porque merece mais cuidado neste trecho.'
    }
    return ponto.descricaoCurta || 'Esse trecho tem um detalhe importante para revisar.'
  }

  function renderAcoesPrompt(ponto, { mobile = false } = {}) {
    if (!ponto) return null

    const temExplicacao = pontoTemExplicacao(ponto)
    const temAudio = pontoTemAudio(ponto)
    const temVideo = Boolean(String(ponto.videoUrl || '').trim())
    const fecharPrompt = mobile ? () => definirPromptPonto(null) : continuarAposPrompt
    const rotuloFechar = mobile ? 'Agora nao' : 'Continuar assistindo'

    return (
      <div className="attention-overlay-actions">
        {(temExplicacao || temAudio) && (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => (mobile ? abrirPonto(ponto, { rolar: true }) : abrirExplicacaoPonto(ponto))}
          >
            Ver explicacao
          </button>
        )}
        {temVideo && (
          <button
            className={`btn ${temExplicacao || temAudio ? 'btn-ghost' : 'btn-primary'}`}
            type="button"
            onClick={() => abrirVideoPonto(ponto, { rolar: mobile })}
          >
            Ver video
          </button>
        )}
        <button className="btn btn-ghost" type="button" onClick={fecharPrompt}>
          {rotuloFechar}
        </button>
      </div>
    )
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

    definirPromptPonto(null)
    setPontoAtencaoAtivoId(null)
    setPontoExpandidoId(null)
    pausarVideo()
    setExplicacaoPontoAbertaId(null)
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

    if (!isMobileViewport) {
      return (
        <div className="attention-point-list">
          {pontosAtencaoAtivos.map(item => {
            const isActive =
              item.id === pontoAtencaoAtivoId ||
              item.id === promptPontoId ||
              item.id === explicacaoPontoAbertaId ||
              item.id === pontoExpandidoId

            return (
              <button
                key={item.id}
                type="button"
                className={`attention-point-item attention-point-item--simple${isActive ? ' is-active' : ''}`}
                onClick={() => abrirPromptPonto(item)}
              >
                <div className="attention-point-item-title attention-point-item-title--simple">{item.titulo}</div>
              </button>
            )
          })}
        </div>
      )
    }

    return (
      <div className="attention-point-list">
        {pontosAtencaoAtivos.map(item => {
          const isActive = item.id === pontoExpandidoId

          return (
            <article
              key={item.id}
              className={`attention-point-item${isActive ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className="attention-point-item-trigger"
                onClick={() => alternarPonto(item, { rolar: isMobileViewport })}
              >
                <div className="attention-point-item-time">{formatarTimestamp(item.timestampSegundos)}</div>
                <div className="attention-point-item-body">
                  <div className="attention-point-item-head">
                    <div className="attention-point-item-title">{item.titulo}</div>
                  </div>
                  {item.descricaoCurta && (
                    <div className="attention-point-item-copy">{item.descricaoCurta}</div>
                  )}
                </div>
              </button>

              {isActive && renderConteudoExpandidoPonto(item)}
            </article>
          )
        })}
      </div>
    )
  }

  function renderCardPontosAtencao() {
    if (!exibirAreaPontos) return null

    return (
      <aside className={`player-attention-rail${!pontosAtencaoAtivos.length ? ' is-empty' : ''}`} ref={attentionDetailRef}>
        <div className="player-attention-rail-head">
          <div className="player-side-title-row">
            <div className="player-side-title">Pontos de atencao</div>
            <span className="player-side-count">{pontosAtencaoAtivos.length}</span>
          </div>
        </div>
        <div className="player-attention-rail-body">
          {pontosAtencaoAtivos.length ? (
            renderPainelPontos()
          ) : (
            <div className="attention-point-empty">
              <div className="attention-point-empty-title">Sem pontos de atencao neste video</div>
            </div>
          )}
        </div>
      </aside>
    )
  }

  function renderNavegacaoModulo() {
    if (conteudosDoModulo.length <= 1) return null

    const posicaoAtual = indiceConteudoAtual >= 0 ? indiceConteudoAtual + 1 : 1
    const resumoModulo = `${posicaoAtual} de ${conteudosDoModulo.length} aulas`
    const aulaAtual = indiceConteudoAtual >= 0 ? conteudosDoModulo[indiceConteudoAtual] : percurso
    const moduloNavExpandida = moduloNavAberta

    return (
      <div className="player-module-nav">
        <div className="player-module-list-shell">
          <button
            type="button"
            className={`player-module-toggle${moduloNavAberta ? ' is-open' : ''}`}
            onClick={() => setModuloNavAberta(current => !current)}
            aria-expanded={moduloNavAberta}
          >
            <div className="player-module-toggle-main">
              <div className="player-module-list-title-row">
                <div className="player-module-list-title">Aulas do modulo</div>
                <span className="player-module-list-count">{resumoModulo}</span>
              </div>
              <div className="player-module-toggle-summary">{aulaAtual?.titulo}</div>
            </div>
            <div className="player-module-toggle-side">
              <span className="player-module-toggle-label">{moduloNavAberta ? 'Ocultar' : 'Ver aulas'}</span>
              <svg
                className="player-module-toggle-chevron"
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 7l5 6 5-6" />
              </svg>
            </div>
          </button>

          {moduloNavExpandida && (
            <div className="player-module-list">
              {conteudosDoModulo.map((item, index) => {
                const isCurrent = String(item.id) === String(percurso?.id)
                const duracaoFormatada = formatDuracaoMinutos(item.duracaoSegundos)

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`player-module-item${isCurrent ? ' is-current' : ''}`}
                    onClick={() => abrirConteudoModulo(item)}
                    disabled={isCurrent}
                  >
                    <div className="player-module-item-index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="player-module-item-body">
                      <div className="player-module-item-title-row">
                        <div className="player-module-item-title">{item.titulo}</div>
                        {duracaoFormatada && (
                          <span className="player-module-item-duration">{duracaoFormatada}</span>
                        )}
                      </div>
                      <div className="player-module-item-meta">
                        <span>{formatTipoConteudo(item.tipoConteudo)}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
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

  const resumoPrincipal = percurso.resumo || percurso.descricao || ''
  const descricaoComplementar = percurso.descricao && percurso.resumo ? percurso.descricao : ''

  return (
    <>
      <button className="back-link" onClick={voltarParaBiblioteca}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        {isPlayerFullscreen ? 'Sair da tela cheia' : 'Voltar para a biblioteca'}
      </button>

      <div className="student-shell student-shell--compact">
        <div className={`player-stage-layout${exibirRailPontosDesktop ? ' has-attention' : ''}`}>
          <div className="player-stage-main">
            <div ref={playerShellRef} className={`player-stage-shell${isPlayerFullscreen ? ' is-fullscreen' : ''}`}>
              <div className="player-stage-head">
                <h1 className="player-title player-title--stage">{percurso.titulo}</h1>
              </div>

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
                        <div className="attention-overlay-title">{pontoEmPrompt.titulo}</div>
                        <div className="attention-overlay-copy">{renderPromptTexto(pontoEmPrompt)}</div>
                        {renderAcoesPrompt(pontoEmPrompt)}
                      </div>
                    )}

                    {!isMobileViewport && pontoExplicacaoAtual && (
                      <div className="player-detail-modal-backdrop" onClick={fecharExplicacaoPonto}>
                        <div
                          className="request-modal-card attention-detail-modal attention-detail-modal--player"
                          onClick={event => event.stopPropagation()}
                        >
                          <div className="attention-detail-modal-head">
                            <div>
                              <div className="card-tag">Explicacao</div>
                              <div className="attention-detail-modal-title">{pontoExplicacaoAtual.titulo}</div>
                            </div>
                            <button
                              type="button"
                              className="simulado-image-modal-close"
                              onClick={fecharExplicacaoPonto}
                            >
                              Fechar
                            </button>
                          </div>

                          <div className="attention-detail-modal-body">
                            {pontoTemAudio(pontoExplicacaoAtual) && (
                              <div className="attention-detail-modal-audio-wrap">
                                <audio
                                  className="attention-detail-modal-audio"
                                  controls
                                  preload="none"
                                  src={pontoExplicacaoAtual.audioUrl}
                                />
                              </div>
                            )}

                            {(pontoExplicacaoAtual.descricaoDetalhada || pontoExplicacaoAtual.descricaoCurta) && (
                              <div className="attention-point-detail-copy">
                                {pontoExplicacaoAtual.descricaoDetalhada || pontoExplicacaoAtual.descricaoCurta}
                              </div>
                            )}

                            {pontoExplicacaoAtual.imagemUrl && (
                              <img
                                src={pontoExplicacaoAtual.imagemUrl}
                                alt={pontoExplicacaoAtual.titulo}
                                className="attention-detail-modal-image"
                              />
                            )}
                          </div>

                          {pontoExplicacaoAtual.videoUrl && (
                            <div className="attention-detail-modal-actions">
                              <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => abrirVideoPonto(pontoExplicacaoAtual)}
                              >
                                Ver video
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!isMobileViewport && videoExplicativoAberto && pontoVideoExplicativoAtual && fonteVideoExplicativo && (
                      <div className="player-video-modal-backdrop" onClick={fecharVideoExplicativo}>
                        <div
                          className="request-modal-card attention-video-modal attention-video-modal--player"
                          onClick={event => event.stopPropagation()}
                        >
                          <div className="attention-video-modal-head">
                            <div>
                              <div className="card-tag">Video explicativo</div>
                              <div className="attention-video-modal-title">{pontoVideoExplicativoAtual.titulo}</div>
                            </div>
                            <button
                              type="button"
                              className="simulado-image-modal-close"
                              onClick={fecharVideoExplicativo}
                            >
                              Fechar
                            </button>
                          </div>

                          <div className="attention-video-modal-player">
                            {fonteVideoExplicativo.provider === 'bunny' ? (
                              <iframe
                                className="attention-video-modal-frame"
                                src={fonteVideoExplicativo.embedUrl}
                                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                                allowFullScreen
                                title={pontoVideoExplicativoAtual.titulo}
                              />
                            ) : (
                              <div
                                ref={videoExplicativoMountRef}
                                className="attention-video-modal-frame"
                                data-plyr-provider={fonteVideoExplicativo.provider}
                                data-plyr-embed-id={fonteVideoExplicativo.embedId}
                              />
                            )}
                          </div>

                          {pontoVideoExplicativoAtual.descricaoCurta && (
                            <div className="attention-video-modal-copy">{pontoVideoExplicativoAtual.descricaoCurta}</div>
                          )}
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
                    <div className="attention-timeline-tools">
                      {pontosAtencaoAtivos.length > 0 && (
                        <label className="player-attention-toggle player-attention-toggle--inline">
                          <input
                            type="checkbox"
                            checked={interrupcoesAtivas}
                            onChange={event => setInterrupcoesAtivas(event.target.checked)}
                          />
                          <span>Exibir pontos automaticamente</span>
                        </label>
                      )}
                      <div className="mini-copy">{formatarTimestamp(duracaoBase)}</div>
                    </div>
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
                          onClick={() => abrirPromptPonto(item)}
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
                    <div className="attention-overlay-title">{pontoEmPrompt.titulo}</div>
                    <div className="attention-overlay-copy">{renderPromptTexto(pontoEmPrompt)}</div>
                    {renderAcoesPrompt(pontoEmPrompt, { mobile: true })}
                  </div>
                </div>
              )}

              {resumoPrincipal && (
                <div className="player-stage-summary">
                  <p className="player-copy player-copy--stage">
                    {resumoPrincipal}
                  </p>
                </div>
              )}
            </div>

            {renderNavegacaoModulo()}
          </div>

          {exibirRailPontosDesktop && renderCardPontosAtencao()}
        </div>

        <div className="player-layout">
          <div>
            {descricaoComplementar && (
              <p className="player-secondary-copy">
                {descricaoComplementar}
              </p>
            )}

          </div>

          {isMobileViewport && (
            <div className="player-side-stack">
              {renderCardPontosAtencao()}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
