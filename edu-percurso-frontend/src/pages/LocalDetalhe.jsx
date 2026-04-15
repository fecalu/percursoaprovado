import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import LandingFooter from '../components/LandingFooter'
import RevealSection from '../components/RevealSection'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { interpolateSiteText, resolveLocalPageConfig } from '../data/sitePageDefaults'
import { useToast } from '../hooks/useToast'
import { configuracaoSiteService, localProvaService, pedidoService, planoService } from '../services/api'
import {
  formatDataHoraCurta,
  formatPagamentoStatus,
  formatPlanoDuracao,
  formatSituacaoPedido,
  formatStatusComercialLocal,
  formatTrilhaPlano,
  getBadgeClassTrilhaPlano,
  getOrdemTrilhaPlano,
  getResumoTrilhaPlano,
  getSituacaoPedidoBadgeClass,
} from '../utils/formatters'
import {
  clearCheckoutMonitor,
  createCheckoutMonitor,
  getCheckoutMonitorStage,
  loadCheckoutMonitor,
  mergeCheckoutMonitor,
  notifyCheckoutMonitor,
  saveCheckoutMonitor,
  subscribeCheckoutMonitor,
} from '../utils/checkoutMonitor'
import { resolveMediaUrl } from '../utils/media'

function fmtMoeda(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((centavos || 0) / 100)
}

function getStatusBadgeClass(statusComercial) {
  if (statusComercial === 'DISPONIVEL') return 'badge-green'
  if (statusComercial === 'EM_BREVE') return 'badge-warn'
  if (statusComercial === 'PAUSADO') return 'badge-red'
  return 'badge-gray'
}

function getMensagemDisponibilidade(local) {
  if (local?.mensagemPublica) return local.mensagemPublica
  if (local?.statusComercial === 'EM_BREVE') {
    return 'Estamos finalizando os conteúdos desse local. Assim que tudo estiver pronto, a compra será liberada.'
  }
  if (local?.statusComercial === 'PAUSADO') {
    return 'As vendas desse local estão temporariamente pausadas. Tente novamente em outro momento.'
  }
  if (local?.statusComercial === 'RASCUNHO') {
    return 'Esse local ainda está em rascunho e não foi aberto ao público.'
  }
  return ''
}

function getTituloComercial(local, localPageContent) {
  if (local?.tituloComercial?.trim()) return local.tituloComercial.trim()

  return (
    interpolateSiteText(localPageContent?.heroFallbackTitulo, {
      local: local?.nome,
      cidade: local?.cidade,
      descricao: local?.descricao,
    }) || `Prepare-se melhor para a prova em ${local?.nome}.`
  )
}

function getSubtituloComercial(local, compraLiberada, mensagemDisponibilidade, localPageContent) {
  if (local?.subtituloComercial?.trim()) return local.subtituloComercial.trim()

  const contexto = {
    local: local?.nome,
    cidade: local?.cidade,
    descricao: local?.descricao,
    mensagem: mensagemDisponibilidade,
  }

  if (compraLiberada) {
    return (
      interpolateSiteText(localPageContent?.heroFallbackSubtituloDisponivel, contexto)
      || 'Escolha o período que combina melhor com sua data de prova e com o ritmo em que você quer revisar.'
    )
  }

  return (
    interpolateSiteText(localPageContent?.heroFallbackSubtituloIndisponivel, contexto)
    || `${local?.descricao || ''} ${mensagemDisponibilidade}`.trim()
  )
}

function getPlanoIndicacao(duracaoDias) {
  if (duracaoDias <= 30) return 'Ideal para quem vai fazer a prova em breve.'
  if (duracaoDias <= 90) return 'Bom para revisar com calma nas próximas semanas.'
  if (duracaoDias <= 180) return 'Mais tempo para praticar, revisar e voltar quando precisar.'
  return 'Acesso mais longo para uma preparação estendida.'
}

function getPlanoPontosCurtos(duracaoDias) {
  const horizonte =
    duracaoDias <= 30
      ? 'Revisão rápida antes da prova'
      : duracaoDias <= 90
        ? 'Mais tempo para revisar com calma'
        : duracaoDias <= 180
          ? 'Mais folga para repetir o conteúdo'
          : 'Preparação estendida no seu ritmo'

  return ['Percurso real e simulação', 'Baliza, embreagem e erros comuns', horizonte]
}

const COMPRA_SEGURA_ITENS = [
  {
    titulo: 'Compra única',
    descricao: 'Você escolhe o período e paga uma vez, sem renovação automática.',
  },
  {
    titulo: 'Liberação automática',
    descricao: 'Assim que o pagamento é confirmado, o acesso aparece na sua conta.',
  },
  {
    titulo: 'Pix ou cartão',
    descricao: 'Pagamento pelo Mercado Pago com fluxo simples e reconhecido pelo aluno.',
  },
]

const BENEFICIOS_DO_ACESSO = [
  {
    titulo: 'Menos surpresa no dia da prova',
    descricao: 'Você estuda os percursos mais frequentes, os pontos de atenção e como a prova costuma acontecer nesse local.',
  },
  {
    titulo: 'Mais critério ao dirigir',
    descricao: 'O foco é entender o que costuma ser avaliado, os erros que mais tiram pontos e como dirigir com mais consciência.',
  },
  {
    titulo: 'Mais segurança para revisar',
    descricao: 'Você volta ao conteúdo durante o período escolhido e revisa no seu ritmo, sem depender de memória solta.',
  },
]

const HERO_DESTAQUES_LOCAL = [
  'Percursos mais frequentes e simulação da prova',
  'Baliza, embreagem e erros que mais tiram pontos',
]

const CHECKOUT_POLLING_MS = 5000
const PLANO_SHOWCASE_PALETTE = [
  {
    accent: 'rgba(119, 210, 255, 0.34)',
    glow: 'rgba(119, 210, 255, 0.22)',
  },
  {
    accent: 'rgba(45, 224, 154, 0.32)',
    glow: 'rgba(45, 224, 154, 0.2)',
  },
  {
    accent: 'rgba(255, 194, 107, 0.32)',
    glow: 'rgba(255, 194, 107, 0.2)',
  },
  {
    accent: 'rgba(255, 151, 196, 0.32)',
    glow: 'rgba(255, 151, 196, 0.2)',
  },
]

function getCaixaDestaque(local, localPageContent) {
  const itens = [local?.boxItem1, local?.boxItem2, local?.boxItem3]
    .map(item => item?.trim())
    .filter(Boolean)

  const titulo = local?.boxTitulo?.trim()
  const observacao = local?.boxObservacao?.trim()

  if (!titulo && itens.length === 0 && !observacao) {
    const itensFallback = [
      localPageContent?.boxFallbackItem1,
      localPageContent?.boxFallbackItem2,
      localPageContent?.boxFallbackItem3,
    ]
      .map(item => item?.trim())
      .filter(Boolean)

    return {
      titulo: localPageContent?.boxFallbackTitulo?.trim() || 'Destaques deste acesso',
      itens: itensFallback,
      observacao: localPageContent?.boxFallbackObservacao?.trim() || '',
    }
  }

  return {
    titulo: titulo || 'Destaques deste acesso',
    itens,
    observacao,
  }
}

function getPlanoDestaque(duracaoDias) {
  if (duracaoDias <= 30) {
    return {
      selo: 'Para comecar agora',
      resumo: 'Bom para quem quer revisar logo antes da prova.',
      recomendado: false,
    }
  }

  if (duracaoDias <= 90) {
    return {
      selo: 'Melhor equilibrio',
      resumo: 'Tempo bom para revisar com calma e voltar quando precisar.',
      recomendado: false,
    }
  }

  if (duracaoDias <= 180) {
    return {
      selo: 'Mais tempo de preparo',
      resumo: 'Ideal para quem quer estudar com mais folga e repetir o conteúdo.',
      recomendado: false,
    }
  }

  return {
    selo: 'Preparação estendida',
    resumo: 'Acesso longo para quem prefere deixar o conteúdo sempre disponível.',
    recomendado: false,
  }
}

function getPlanoApresentacao(plano) {
  const padrao = getPlanoDestaque(plano?.duracaoDias || 0)
  const trilhaNome = formatTrilhaPlano(plano?.trilhaNome, plano?.trilhaCodigo)

  return {
    selo: plano?.vitrineSelo?.trim() || padrao.selo,
    resumo: plano?.vitrineResumo?.trim() || padrao.resumo,
    recomendado: typeof plano?.vitrineRecomendada === 'boolean' ? plano.vitrineRecomendada : padrao.recomendado,
    texto: plano?.vitrineTexto?.trim() || getPlanoIndicacao(plano?.duracaoDias || 0),
    meta: plano?.vitrineMeta?.trim() || 'Pagamento único pelo período escolhido',
    trilhaNome,
    trilhaResumo: getResumoTrilhaPlano(plano?.trilhaCodigo),
    trilhaBadgeClass: getBadgeClassTrilhaPlano(plano?.trilhaCodigo),
  }
}

function getCodigoTrilhaPlano(plano) {
  return plano?.trilhaCodigo || plano?.trilhaNome || 'trilha_padrao'
}

function isCheckoutDoLocal(monitor, slug) {
  return Boolean(monitor?.localSlug) && monitor.localSlug === slug
}

function isMesmoPedido(monitor, pedido) {
  if (!monitor || !pedido) return false
  if (monitor.pedidoId && pedido.id && monitor.pedidoId === pedido.id) return true
  if (monitor.referencia && pedido.referencia && monitor.referencia === pedido.referencia) return true
  return false
}

function getCheckoutAcompanhamento(monitor) {
  const etapa = getCheckoutMonitorStage(monitor)

  if (etapa === 'SUCCESS') {
    return {
      variant: 'success',
      kicker: 'Pagamento confirmado',
      titulo: 'Pagamento concluído com sucesso',
      texto: 'O Mercado Pago confirmou esse pagamento. Seu acesso deve aparecer automaticamente na sua conta.',
    }
  }

  if (etapa === 'FAILED') {
    return {
      variant: 'danger',
      kicker: 'Pagamento não concluído',
      titulo: 'Ainda não conseguimos confirmar esse pagamento',
      texto: 'Confira o status em Meus pagamentos. Se precisar, você pode retomar ou iniciar uma nova tentativa.',
    }
  }

  return {
    variant: 'pending',
    kicker: 'Pagamento em andamento',
    titulo: 'Estamos aguardando a confirmação do Mercado Pago',
    texto: 'Finalize o checkout na outra aba. Assim que a confirmação chegar, esta tela se atualiza automaticamente.',
  }
}

export default function LocalDetalhe() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { show, ToastEl } = useToast()
  const [local, setLocal] = useState(null)
  const [planos, setPlanos] = useState([])
  const [configLocalPage, setConfigLocalPage] = useState(null)
  const [erroCarregamento, setErroCarregamento] = useState('')
  const [erroPlanos, setErroPlanos] = useState('')
  const [loading, setLoading] = useState(true)
  const [checkoutMonitor, setCheckoutMonitor] = useState(null)
  const [sincronizandoCheckout, setSincronizandoCheckout] = useState(false)
  const [planoAtivoIndex, setPlanoAtivoIndex] = useState(0)
  const [jornadaSelecionada, setJornadaSelecionada] = useState('')
  const checkoutMonitorRef = useRef(null)
  const planoSwipeStartRef = useRef(null)
  const planoSwipeLockRef = useRef(false)
  const planosOrdenados = useMemo(
    () => [...planos].sort((a, b) => a.duracaoDias - b.duracaoDias || a.precoCentavos - b.precoCentavos),
    [planos]
  )
  const jornadasDisponiveis = useMemo(() => {
    const mapa = new Map()

    planosOrdenados.forEach(plano => {
      const codigo = getCodigoTrilhaPlano(plano)
      if (mapa.has(codigo)) return

      mapa.set(codigo, {
        codigo,
        nome: formatTrilhaPlano(plano?.trilhaNome, plano?.trilhaCodigo),
        resumo: getResumoTrilhaPlano(plano?.trilhaCodigo),
        badgeClass: getBadgeClassTrilhaPlano(plano?.trilhaCodigo),
      })
    })

    return Array.from(mapa.values()).sort((a, b) => {
      const ordem = getOrdemTrilhaPlano(a.codigo) - getOrdemTrilhaPlano(b.codigo)
      if (ordem !== 0) return ordem
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [planosOrdenados])
  const planosExibidos = useMemo(() => {
    if (!jornadaSelecionada) return planosOrdenados
    return planosOrdenados.filter(plano => getCodigoTrilhaPlano(plano) === jornadaSelecionada)
  }, [jornadaSelecionada, planosOrdenados])

  useEffect(() => {
    checkoutMonitorRef.current = checkoutMonitor
  }, [checkoutMonitor])

  useEffect(() => {
    let ativo = true

    Promise.allSettled([
      localProvaService.buscar(slug),
      planoService.listar({ localSlug: slug }),
      configuracaoSiteService.buscarPublica(),
    ])
      .then(([localResp, planosResp, configResp]) => {
        if (!ativo) return

        if (localResp.status === 'fulfilled') {
          setLocal(localResp.value)
          setErroCarregamento('')
        } else if (localResp.reason?.response?.status === 404) {
          setLocal(null)
          setErroCarregamento('')
        } else {
          setLocal(null)
          setErroCarregamento('Não foi possível carregar esse local agora. Recarregue a página e tente novamente em instantes.')
        }

        if (planosResp.status === 'fulfilled') {
          setPlanos(planosResp.value)
          setErroPlanos('')
        } else {
          setPlanos([])
          setErroPlanos('Não foi possível carregar os planos desse local agora.')
        }

        setConfigLocalPage(configResp.status === 'fulfilled' ? configResp.value?.localPage || null : null)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [slug])

  useEffect(() => {
    if (planosOrdenados.length === 0) {
      setJornadaSelecionada('')
      return
    }

    const recomendado = planosOrdenados.find(plano => plano?.vitrineRecomendada === true)
    const codigoPreferido = recomendado ? getCodigoTrilhaPlano(recomendado) : jornadasDisponiveis[0]?.codigo || ''

    setJornadaSelecionada(atual => {
      if (atual && jornadasDisponiveis.some(item => item.codigo === atual)) return atual
      return codigoPreferido
    })
  }, [jornadasDisponiveis, planosOrdenados])

  useEffect(() => {
    if (planosExibidos.length === 0) {
      setPlanoAtivoIndex(0)
      return
    }

    const recomendadoIndex = planosExibidos.findIndex(plano => plano?.vitrineRecomendada === true)
    setPlanoAtivoIndex(recomendadoIndex >= 0 ? recomendadoIndex : 0)
  }, [planosExibidos])

  useEffect(() => {
    const monitorSalvo = loadCheckoutMonitor()
    if (isCheckoutDoLocal(monitorSalvo, slug)) {
      setCheckoutMonitor(monitorSalvo)
      return
    }
    setCheckoutMonitor(null)
  }, [slug])

  async function atualizarCheckoutMonitor({ manual = false } = {}) {
    const monitorAtual = checkoutMonitorRef.current || loadCheckoutMonitor()
    if (!isCheckoutDoLocal(monitorAtual, slug)) return

    if (manual) {
      setSincronizandoCheckout(true)
    }

    try {
      const pedidos = await pedidoService.minhas()
      const pedidoAtualizado = pedidos.find(item => isMesmoPedido(monitorAtual, item))

      if (!pedidoAtualizado) return

      const proximoMonitor = mergeCheckoutMonitor(
        monitorAtual,
        createCheckoutMonitor(pedidoAtualizado, monitorAtual.localSlug || slug)
      )
      const etapaAnterior = getCheckoutMonitorStage(monitorAtual)
      const proximaEtapa = getCheckoutMonitorStage(proximoMonitor)

      saveCheckoutMonitor(proximoMonitor)
      setCheckoutMonitor(proximoMonitor)

      if (etapaAnterior !== proximaEtapa) {
        if (proximaEtapa === 'SUCCESS') {
          show('Pagamento confirmado. Seu acesso já deve aparecer na sua conta.')
        }
        if (proximaEtapa === 'FAILED') {
          show('O Mercado Pago ainda não confirmou esse pagamento.', 'error')
        }
      }
    } catch (error) {
      if (manual) {
        show(error.response?.data?.erro || 'Não foi possível atualizar o status do pagamento.', 'error')
      }
    } finally {
      if (manual) {
        setSincronizandoCheckout(false)
      }
    }
  }

  useEffect(() => {
    if (!isCheckoutDoLocal(checkoutMonitor, slug) || getCheckoutMonitorStage(checkoutMonitor) !== 'PENDING') return

    let ativo = true

    async function sincronizarSilenciosamente() {
      if (!ativo) return
      await atualizarCheckoutMonitor()
    }

    sincronizarSilenciosamente()
    const intervalo = window.setInterval(sincronizarSilenciosamente, CHECKOUT_POLLING_MS)

    return () => {
      ativo = false
      window.clearInterval(intervalo)
    }
  }, [checkoutMonitor?.pedidoId, checkoutMonitor?.referencia, checkoutMonitor?.status, checkoutMonitor?.paymentStatus, checkoutMonitor?.localSlug, slug])

  useEffect(() => {
    if (!isCheckoutDoLocal(checkoutMonitor, slug) || getCheckoutMonitorStage(checkoutMonitor) !== 'PENDING') return

    function atualizarAoVoltar() {
      if (document.visibilityState === 'hidden') return
      atualizarCheckoutMonitor()
    }

    window.addEventListener('focus', atualizarAoVoltar)
    document.addEventListener('visibilitychange', atualizarAoVoltar)

    return () => {
      window.removeEventListener('focus', atualizarAoVoltar)
      document.removeEventListener('visibilitychange', atualizarAoVoltar)
    }
  }, [checkoutMonitor?.pedidoId, checkoutMonitor?.referencia, checkoutMonitor?.status, checkoutMonitor?.paymentStatus, checkoutMonitor?.localSlug, slug])

  useEffect(() => {
    return subscribeCheckoutMonitor(message => {
      const monitorSalvo = loadCheckoutMonitor()
      const monitorAtual = checkoutMonitorRef.current || monitorSalvo
      const mesmoPedido =
        (message?.pedidoId && monitorAtual?.pedidoId === message.pedidoId)
        || (message?.referencia && monitorAtual?.referencia === message.referencia)
      const mesmoLocal = message?.localSlug && message.localSlug === slug

      if (!mesmoPedido && !mesmoLocal) return

      if (isCheckoutDoLocal(monitorSalvo, slug)) {
        setCheckoutMonitor(monitorSalvo)
      }

      atualizarCheckoutMonitor()
    })
  }, [slug])

  function fecharAcompanhamentoCheckout() {
    clearCheckoutMonitor()
    setCheckoutMonitor(null)
  }

  function renderAcaoPlano(plano) {
    if (!user) {
      return (
        <Link
          className="btn btn-primary"
          to="/register"
          state={{ returnTo: `/checkout/revisao/${slug}/${plano.id}` }}
        >
          Criar conta e continuar
        </Link>
      )
    }

    if (isAdmin) {
      return (
        <button className="btn btn-ghost" onClick={() => navigate('/admin/planos')}>
          Editar plano
        </button>
      )
    }

    return (
      <button
        className="btn btn-primary"
        onClick={() => navigate(`/checkout/revisao/${slug}/${plano.id}`)}
      >
        Revisar antes de pagar
      </button>
    )
  }

  function irParaPlanoAnterior() {
    setPlanoAtivoIndex(index => Math.max(0, index - 1))
  }

  function irParaProximoPlano() {
    setPlanoAtivoIndex(index => Math.min(planosOrdenados.length - 1, index + 1))
  }

  function iniciarSwipePlanos(clientX) {
    planoSwipeStartRef.current = clientX
    planoSwipeLockRef.current = false
  }

  function finalizarSwipePlanos(clientX) {
    if (planoSwipeStartRef.current == null) return

    const delta = clientX - planoSwipeStartRef.current
    planoSwipeStartRef.current = null

    if (Math.abs(delta) < 44 || planoSwipeLockRef.current) return

    planoSwipeLockRef.current = true
    if (delta < 0) {
      irParaProximoPlano()
      return
    }

    irParaPlanoAnterior()
  }

  function renderPlanoShowcaseCard(plano, cardState, index) {
    const destaquePlano = getPlanoApresentacao(plano)
    const palette = PLANO_SHOWCASE_PALETTE[index % PLANO_SHOWCASE_PALETTE.length]

    return (
      <article
        key={plano.id}
        className={`plan-showcase-card plan-showcase-card--${cardState}`}
        style={{
          '--plan-showcase-accent': palette.accent,
          '--plan-showcase-glow': palette.glow,
        }}
        onClick={() => {
          if (cardState !== 'active') {
            setPlanoAtivoIndex(index)
          }
        }}
      >
        <div className="plan-showcase-card-inner">
          <div className="plan-showcase-card-top">
            <div className="plan-showcase-pill">Acesso</div>
            <div className="plan-showcase-tag">{destaquePlano.selo}</div>
          </div>

          <div className="plan-showcase-visual">
            <div className="plan-showcase-visual-kicker">{local.nome}</div>
            <div className="plan-showcase-visual-highlight">{formatPlanoDuracao(plano.duracaoDias)}</div>
          </div>

          {destaquePlano.recomendado && <div className="plan-showcase-ribbon">Mais escolhido</div>}
          <div className="plan-showcase-name">{plano.nome}</div>
          <div className="plan-showcase-price">{fmtMoeda(plano.precoCentavos)}</div>
          <div className="plan-showcase-journey">
            <span className={`badge ${destaquePlano.trilhaBadgeClass}`}>{destaquePlano.trilhaNome}</span>
          </div>
          <div className="plan-showcase-copy">{destaquePlano.texto}</div>
          <div className="plan-showcase-trilha-copy">{destaquePlano.trilhaResumo}</div>
          <div className="plan-showcase-meta">{destaquePlano.meta}</div>
          <div className="plan-showcase-action" onClick={event => event.stopPropagation()}>
            {renderAcaoPlano(plano)}
          </div>
        </div>
      </article>
    )
  }

  if (loading) return <div className="spinner" />
  if (erroCarregamento) {
    return (
      <div className="empty-state">
        <div>Não foi possível carregar esse local agora.</div>
        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </div>
    )
  }
  if (!local) return <div className="empty-state">Local de prova não encontrado.</div>

  const compraLiberada = local.statusComercial === 'DISPONIVEL'
  const mensagemDisponibilidade = getMensagemDisponibilidade(local)
  const localPageContent = resolveLocalPageConfig(configLocalPage || {})
  const localPageContext = {
    local: local?.nome,
    cidade: local?.cidade,
    descricao: local?.descricao,
    mensagem: mensagemDisponibilidade,
  }
  const tituloComercial = getTituloComercial(local, localPageContent)
  const subtituloComercial = getSubtituloComercial(local, compraLiberada, mensagemDisponibilidade, localPageContent)
  const caixaDestaque = getCaixaDestaque(local, localPageContent)
  const imagemPrincipal = resolveMediaUrl(local.imagemPrincipalUrl)
  const jornadaAtiva = jornadasDisponiveis.find(item => item.codigo === jornadaSelecionada) || null
  const planoAtivo = planosExibidos[Math.min(planoAtivoIndex, Math.max(planosExibidos.length - 1, 0))] || null
  const destaquePlanoAtivo = planoAtivo ? getPlanoApresentacao(planoAtivo) : null
  const planoAnterior = planoAtivoIndex > 0 ? planosExibidos[planoAtivoIndex - 1] : null
  const planoSeguinte = planoAtivoIndex < planosExibidos.length - 1 ? planosExibidos[planoAtivoIndex + 1] : null
  const usarIntroPlanosNoHero = compraLiberada && planosOrdenados.length > 0
  const tituloHero = usarIntroPlanosNoHero
    ? interpolateSiteText(localPageContent.secaoPlanosTitulo, localPageContext)
    : tituloComercial
  const subtituloHero = usarIntroPlanosNoHero
    ? interpolateSiteText(localPageContent.secaoPlanosSubtitulo, localPageContext)
    : subtituloComercial
  const resumoHero = usarIntroPlanosNoHero ? jornadaAtiva?.resumo || destaquePlanoAtivo?.resumo || '' : ''
  const checkoutAcompanhamento = checkoutMonitor ? getCheckoutAcompanhamento(checkoutMonitor) : null
  const checkoutSituacao = checkoutMonitor
    ? formatSituacaoPedido(checkoutMonitor.status, null, checkoutMonitor.paymentStatus)
    : ''
  const checkoutBadgeClass = checkoutMonitor
    ? getSituacaoPedidoBadgeClass(checkoutMonitor.status, null, checkoutMonitor.paymentStatus)
    : 'badge-gray'
  const checkoutEtapa = checkoutMonitor ? getCheckoutMonitorStage(checkoutMonitor) : 'IDLE'
  const saibaMaisLocal = localPageContent.saibaMaisItens
  const secaoPlanosFaixas = [
    localPageContent.secaoPlanosFaixa1,
    localPageContent.secaoPlanosFaixa2,
    localPageContent.secaoPlanosFaixa3,
  ].filter(Boolean)
  const localResumoCompra = [local?.cidade, local?.nome].filter(Boolean).join(' - ')

  return (
    <div className="landing-page landing-page--eager landing-page--local">
      {ToastEl}

      <section className="landing-topbar landing-topbar--simple fade-in">
        <Link className="landing-topbar-brand" to="/">
          <BrandLogo variant="landing" showTagline />
        </Link>

        <div className="landing-topbar-actions">
          <ThemeToggle compact iconOnly />
          {user ? (
            <>
              <Link className="btn btn-ghost btn-sm" to={isAdmin ? '/admin/pedidos' : '/meus-acessos'}>
                {isAdmin ? (
                  'Pedidos'
                ) : (
                  <>
                    <span className="btn-label-full">Meus acessos</span>
                    <span className="btn-label-compact">Acessos</span>
                  </>
                )}
              </Link>
              <Link className="btn btn-primary btn-sm" to={isAdmin ? '/admin' : '/biblioteca'}>
                {isAdmin ? (
                  <>
                    <span className="btn-label-full">Abrir painel</span>
                    <span className="btn-label-compact">Painel</span>
                  </>
                ) : (
                  <>
                    <span className="btn-label-full">Minha biblioteca</span>
                    <span className="btn-label-compact">Biblioteca</span>
                  </>
                )}
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login">
                Entrar
              </Link>
              <Link className="btn btn-primary btn-sm" to="/register">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="hero-shell hero-shell--local hero-shell--single hero-shell--local-compact fade-in">
        <div className="local-hero-floating-meta">
          <span className={`badge ${getStatusBadgeClass(local.statusComercial)}`}>
            {formatStatusComercialLocal(local.statusComercial)}
          </span>
          <span className="hero-inline-copy hero-inline-copy--local">{localResumoCompra}</span>
        </div>
        <div className={`hero-copy ${usarIntroPlanosNoHero ? 'hero-copy--centered' : ''}`}>
          <h1 className="hero-title">{tituloHero}</h1>
          <p className="hero-subtitle">{subtituloHero}</p>
        </div>
      </section>

      {checkoutMonitor && (
        <RevealSection as="section" className="landing-section landing-section--tight" delay={20} eager>
          <div className={`checkout-watch-card checkout-watch-card--${checkoutAcompanhamento.variant}`}>
            <div className="checkout-watch-copy">
              <div className="checkout-watch-kicker">{checkoutAcompanhamento.kicker}</div>
              <div className="checkout-watch-title">{checkoutAcompanhamento.titulo}</div>
              <div className="checkout-watch-text">{checkoutAcompanhamento.texto}</div>
              <div className="checkout-watch-meta">
                <span className={`badge ${checkoutBadgeClass}`}>{checkoutSituacao}</span>
                {checkoutMonitor.referencia && (
                  <span className="checkout-watch-pill">Pedido {checkoutMonitor.referencia}</span>
                )}
                {checkoutMonitor.paymentId && (
                  <span className="checkout-watch-pill">Pagamento {checkoutMonitor.paymentId}</span>
                )}
                {checkoutMonitor.paymentStatus && (
                  <span className="checkout-watch-pill">
                    Mercado Pago: {formatPagamentoStatus(checkoutMonitor.paymentStatus)}
                  </span>
                )}
              </div>
              {checkoutMonitor.pagoEm && (
                <div className="mini-copy" style={{ marginTop: '0.65rem' }}>
                  Confirmado em {formatDataHoraCurta(checkoutMonitor.pagoEm)}.
                </div>
              )}
            </div>

            <div className="checkout-watch-actions">
              {checkoutEtapa === 'PENDING' ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() => atualizarCheckoutMonitor({ manual: true })}
                    disabled={sincronizandoCheckout}
                  >
                    {sincronizandoCheckout ? 'Atualizando...' : 'Atualizar agora'}
                  </button>
                  {checkoutMonitor.checkoutUrl && (
                    <a
                      className="btn btn-ghost"
                      href={checkoutMonitor.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir checkout
                    </a>
                  )}
                  <button className="btn btn-ghost" onClick={() => navigate('/meus-pedidos')}>
                    Ver meus pagamentos
                  </button>
                </>
              ) : (
                <>
                  {checkoutEtapa === 'SUCCESS' ? (
                    <button className="btn btn-primary" onClick={() => navigate('/meus-acessos')}>
                      Ir para meus acessos
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => navigate('/meus-pedidos')}>
                      Ver meus pagamentos
                    </button>
                  )}
                  {checkoutMonitor.checkoutUrl && checkoutEtapa === 'FAILED' && (
                    <a
                      className="btn btn-ghost"
                      href={checkoutMonitor.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir checkout novamente
                    </a>
                  )}
                  <button className="btn btn-ghost" onClick={fecharAcompanhamentoCheckout}>
                    Fechar aviso
                  </button>
                </>
              )}
            </div>
          </div>
        </RevealSection>
      )}

      <RevealSection as="section" className="landing-section landing-section--local-offer" delay={40} eager>
        {!compraLiberada && (
          <>
            <div className="page-title">Disponibilidade do local</div>
            <p className="page-sub">
              Esse local aparece no site, mas a compra fica bloqueada até o administrador liberar as vendas.
            </p>
          </>
        )}

        {compraLiberada && planosOrdenados.length > 0 && (
          <>
            <div className="page-title">Escolha o plano certo para o seu momento</div>
            <p className="page-sub">
              {jornadasDisponiveis.length > 1
                ? 'Neste local, voce encontra planos para quem quer comecar do zero e para quem ja esta focado na reta final da prova.'
                : `Neste local, os planos seguem a jornada ${jornadasDisponiveis[0]?.nome || 'principal'} para a sua preparacao.`}
            </p>
            <div className="local-offer-profiles">
              {jornadasDisponiveis.map(jornada => (
                <span key={jornada.codigo} className={`badge ${jornada.badgeClass}`}>
                  {jornada.nome}
                </span>
              ))}
            </div>
          </>
        )}

        {!compraLiberada ? (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className={`badge ${getStatusBadgeClass(local.statusComercial)}`}>
                {formatStatusComercialLocal(local.statusComercial)}
              </span>
              <span className="table-name">Compra indisponível no momento</span>
            </div>
            <div className="mini-copy" style={{ marginTop: '0.9rem' }}>
              {mensagemDisponibilidade}
            </div>
            {isAdmin && (
              <div style={{ marginTop: '1rem' }}>
                <button className="btn btn-ghost" onClick={() => navigate('/admin/locais')}>
                  Ajustar status do local
                </button>
              </div>
            )}
          </div>
        ) : erroPlanos ? (
          <div className="empty-state">
            <div>{erroPlanos}</div>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>
              Recarregar planos
            </button>
          </div>
        ) : planosOrdenados.length === 0 ? (
          <div className="empty-state">Esse local ainda não possui planos ativos.</div>
        ) : (
          <div className="local-offer-layout">
            <div className="plan-showcase">
              {resumoHero && <div className="local-plan-intro">{resumoHero}</div>}
              {jornadasDisponiveis.length > 1 && (
                <div className="plan-showcase-profile-picker">
                  <div className="plan-showcase-profile-head">
                    <div className="plan-showcase-profile-title">Escolha primeiro o seu momento</div>
                    <div className="plan-showcase-profile-copy">
                      Separe os planos entre quem quer comecar do zero e quem ja esta focado na reta final.
                    </div>
                  </div>

                  <div className="plan-showcase-profile-rail" role="tablist" aria-label="Perfis de jornada">
                    {jornadasDisponiveis.map(jornada => {
                      const quantidadePlanos = planosOrdenados.filter(plano => getCodigoTrilhaPlano(plano) === jornada.codigo).length
                      const estaAtiva = jornada.codigo === jornadaSelecionada

                      return (
                        <button
                          key={jornada.codigo}
                          type="button"
                          className={`plan-showcase-profile-card ${estaAtiva ? 'is-active' : ''}`}
                          onClick={() => setJornadaSelecionada(jornada.codigo)}
                          aria-selected={estaAtiva}
                        >
                          <div className="plan-showcase-profile-top">
                            <span className={`badge ${jornada.badgeClass}`}>{jornada.nome}</span>
                            <span className="plan-showcase-profile-count">
                              {quantidadePlanos} {quantidadePlanos === 1 ? 'plano' : 'planos'}
                            </span>
                          </div>
                          <div className="plan-showcase-profile-summary">{jornada.resumo}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div
                className="plan-showcase-stage"
                onTouchStart={event => iniciarSwipePlanos(event.touches[0]?.clientX ?? 0)}
                onTouchEnd={event => finalizarSwipePlanos(event.changedTouches[0]?.clientX ?? 0)}
              >
                <button
                  type="button"
                  className="plan-showcase-arrow plan-showcase-arrow--prev"
                  onClick={irParaPlanoAnterior}
                  disabled={planoAtivoIndex === 0}
                  aria-label="Ver plano anterior"
                >
                  <span aria-hidden="true">←</span>
                </button>
                {planoAnterior && renderPlanoShowcaseCard(planoAnterior, 'left', planoAtivoIndex - 1)}
                {planoAtivo && renderPlanoShowcaseCard(planoAtivo, 'active', planoAtivoIndex)}
                {planoSeguinte && renderPlanoShowcaseCard(planoSeguinte, 'right', planoAtivoIndex + 1)}
                <button
                  type="button"
                  className="plan-showcase-arrow plan-showcase-arrow--next"
                  onClick={irParaProximoPlano}
                  disabled={planoAtivoIndex === planosExibidos.length - 1}
                  aria-label="Ver próximo plano"
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>

              <div className="plan-showcase-dots" role="tablist" aria-label="Seleção de planos">
                {planosExibidos.map((plano, index) => (
                  <button
                    key={plano.id}
                    type="button"
                    className={`plan-showcase-dot ${index === planoAtivoIndex ? 'is-active' : ''}`}
                    onClick={() => setPlanoAtivoIndex(index)}
                    aria-label={`Selecionar plano de ${formatPlanoDuracao(plano.duracaoDias)}`}
                    aria-selected={index === planoAtivoIndex}
                  />
                ))}
              </div>

              <div className="landing-inline-strip landing-inline-strip--compact plan-showcase-strip">
                {secaoPlanosFaixas.map(item => (
                  <div key={item} className="landing-inline-chip">
                    {interpolateSiteText(item, localPageContext)}
                  </div>
                ))}
              </div>
            </div>
            {caixaDestaque && (
              <aside className="local-offer-box local-offer-box--support">
                <div className="local-offer-box-main">
                  <div className="local-offer-box-copy">
                    <div className="local-offer-box-title">
                      {interpolateSiteText(caixaDestaque.titulo, localPageContext)}
                    </div>
                    {caixaDestaque.itens.length > 0 && (
                      <div className="local-offer-box-list">
                        {caixaDestaque.itens.map(item => (
                          <div key={item} className="local-offer-box-item">
                            <span className="local-offer-box-dot" />
                            <span>{interpolateSiteText(item, localPageContext)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {imagemPrincipal && (
                    <div className="local-offer-box-media">
                      <img
                        src={imagemPrincipal}
                        alt={`Destaque visual do local ${local.nome}`}
                        className="local-offer-box-image"
                      />
                    </div>
                  )}
                </div>
                {caixaDestaque.observacao && (
                  <div className="local-offer-box-note">
                    {interpolateSiteText(caixaDestaque.observacao, localPageContext)}
                  </div>
                )}
              </aside>
            )}
          </div>
        )}
      </RevealSection>

      <RevealSection as="section" className="landing-section" delay={70} eager>
        <div className="section-title-row">
          <div>
            <div className="section-heading">
              {interpolateSiteText(localPageContent.saibaMaisTitulo, localPageContext)}
            </div>
            <div className="section-copy">
              {interpolateSiteText(localPageContent.saibaMaisSubtitulo, localPageContext)}
            </div>
          </div>
        </div>

        <div className="learn-more-list">
          {saibaMaisLocal.map(item => (
            <details key={item.titulo} className="learn-more-item">
              <summary className="learn-more-summary">
                <span className="learn-more-title">{interpolateSiteText(item.titulo, localPageContext)}</span>
                <span className="learn-more-toggle">
                  <span className="learn-more-toggle-open">Abrir</span>
                  <span className="learn-more-toggle-close">Fechar</span>
                </span>
              </summary>

              <div className="learn-more-body">
                <div className="learn-more-copy">{interpolateSiteText(item.copy, localPageContext)}</div>
                <div className="learn-more-points">
                  {item.pontos.map(ponto => (
                    <div key={ponto} className="learn-more-point">
                      <span className="learn-more-point-dot" />
                      <span>{interpolateSiteText(ponto, localPageContext)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </RevealSection>

      <LandingFooter sectionPrefix="/" />
    </div>
  )
}
