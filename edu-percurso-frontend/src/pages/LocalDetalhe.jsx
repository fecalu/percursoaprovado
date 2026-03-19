import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import RevealSection from '../components/RevealSection'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import { localProvaService, pedidoService, planoService } from '../services/api'
import {
  formatDataHoraCurta,
  formatPagamentoStatus,
  formatPlanoDuracao,
  formatSituacaoPedido,
  formatStatusComercialLocal,
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
    return 'Estamos finalizando os conteudos desse local. Assim que tudo estiver pronto, a compra sera liberada.'
  }
  if (local?.statusComercial === 'PAUSADO') {
    return 'As vendas desse local estao temporariamente pausadas. Tente novamente em outro momento.'
  }
  if (local?.statusComercial === 'RASCUNHO') {
    return 'Esse local ainda esta em rascunho e nao foi aberto ao publico.'
  }
  return ''
}

function getTituloComercial(local) {
  return local?.tituloComercial?.trim() || `Prepare-se melhor para a prova em ${local?.nome}.`
}

function getSubtituloComercial(local, compraLiberada, mensagemDisponibilidade) {
  if (local?.subtituloComercial?.trim()) return local.subtituloComercial.trim()

  if (compraLiberada) {
    return `Veja como a prova costuma acontecer nesse local, conheca os trechos mais recorrentes e revise o que mais reduz surpresa no dia da avaliacao. ${local?.descricao || ''}`.trim()
  }

  return `${local?.descricao || ''} ${mensagemDisponibilidade}`.trim()
}

function getPlanoIndicacao(duracaoDias) {
  if (duracaoDias <= 30) return 'Ideal para quem vai fazer a prova em breve.'
  if (duracaoDias <= 90) return 'Bom para revisar com calma nas proximas semanas.'
  if (duracaoDias <= 180) return 'Mais tempo para praticar, revisar e voltar quando precisar.'
  return 'Acesso mais longo para uma preparacao estendida.'
}

function getPlanoPontosCurtos(duracaoDias) {
  const horizonte =
    duracaoDias <= 30
      ? 'Revisao rapida antes da prova'
      : duracaoDias <= 90
        ? 'Mais tempo para revisar com calma'
        : duracaoDias <= 180
          ? 'Mais folga para repetir o conteudo'
          : 'Preparacao estendida no seu ritmo'

  return ['Percurso real e simulacao', 'Baliza, embreagem e erros comuns', horizonte]
}

const COMPRA_SEGURA_ITENS = [
  {
    titulo: 'Compra unica',
    descricao: 'Voce escolhe o periodo e paga uma vez, sem renovacao automatica.',
  },
  {
    titulo: 'Liberacao automatica',
    descricao: 'Assim que o pagamento e confirmado, o acesso aparece na sua conta.',
  },
  {
    titulo: 'Pix ou cartao',
    descricao: 'Pagamento pelo Mercado Pago com fluxo simples e reconhecido pelo aluno.',
  },
]

const BENEFICIOS_DO_ACESSO = [
  {
    titulo: 'Menos surpresa no dia da prova',
    descricao: 'Voce estuda os percursos mais frequentes, os pontos de atencao e como a prova costuma acontecer nesse local.',
  },
  {
    titulo: 'Mais criterio ao dirigir',
    descricao: 'O foco e entender o que costuma ser avaliado, os erros que mais tiram pontos e como dirigir com mais consciencia.',
  },
  {
    titulo: 'Mais seguranca para revisar',
    descricao: 'Voce volta ao conteudo durante o periodo escolhido e revisa no seu ritmo, sem depender de memoria solta.',
  },
]

const HERO_DESTAQUES_LOCAL = [
  'Percursos mais frequentes e simulacao da prova',
  'Baliza, embreagem e erros que mais tiram pontos',
]

const CHECKOUT_POLLING_MS = 5000

function getCaixaDestaque(local) {
  const itens = [local?.boxItem1, local?.boxItem2, local?.boxItem3]
    .map(item => item?.trim())
    .filter(Boolean)

  return {
    titulo: local?.boxTitulo?.trim() || 'O que voce vai encontrar neste acesso',
    itens: itens.length > 0
      ? itens
      : ['Percursos mais frequentes', 'Simulacao completa da prova', 'Erros que mais tiram pontos'],
    observacao: local?.boxObservacao?.trim() || 'Acesso liberado automaticamente apos a confirmacao do pagamento.',
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
      recomendado: true,
    }
  }

  if (duracaoDias <= 180) {
    return {
      selo: 'Mais tempo de preparo',
      resumo: 'Ideal para quem quer estudar com mais folga e repetir o conteudo.',
      recomendado: false,
    }
  }

  return {
    selo: 'Preparacao estendida',
    resumo: 'Acesso longo para quem prefere deixar o conteudo sempre disponivel.',
    recomendado: false,
  }
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
      titulo: 'Pagamento concluido com sucesso',
      texto: 'O Mercado Pago confirmou esse pagamento. Seu acesso deve aparecer automaticamente na sua conta.',
    }
  }

  if (etapa === 'FAILED') {
    return {
      variant: 'danger',
      kicker: 'Pagamento nao concluido',
      titulo: 'Ainda nao conseguimos confirmar esse pagamento',
      texto: 'Confira o status em Meus pagamentos. Se precisar, voce pode retomar ou iniciar uma nova tentativa.',
    }
  }

  return {
    variant: 'pending',
    kicker: 'Pagamento em andamento',
    titulo: 'Estamos aguardando a confirmacao do Mercado Pago',
    texto: 'Finalize o checkout na outra aba. Assim que a confirmacao chegar, esta tela se atualiza automaticamente.',
  }
}

export default function LocalDetalhe() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { show, ToastEl } = useToast()
  const [local, setLocal] = useState(null)
  const [planos, setPlanos] = useState([])
  const [loading, setLoading] = useState(true)
  const [solicitandoId, setSolicitandoId] = useState('')
  const [checkoutMonitor, setCheckoutMonitor] = useState(null)
  const [sincronizandoCheckout, setSincronizandoCheckout] = useState(false)
  const checkoutMonitorRef = useRef(null)

  useEffect(() => {
    checkoutMonitorRef.current = checkoutMonitor
  }, [checkoutMonitor])

  useEffect(() => {
    Promise.all([localProvaService.buscar(slug), planoService.listar({ localSlug: slug })])
      .then(([localResp, planosResp]) => {
        setLocal(localResp)
        setPlanos(planosResp)
      })
      .finally(() => setLoading(false))
  }, [slug])

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
          show('Pagamento confirmado. Seu acesso ja deve aparecer na sua conta.')
        }
        if (proximaEtapa === 'FAILED') {
          show('O Mercado Pago ainda nao confirmou esse pagamento.', 'error')
        }
      }
    } catch (error) {
      if (manual) {
        show(error.response?.data?.erro || 'Nao foi possivel atualizar o status do pagamento.', 'error')
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

  async function solicitarPlano(planoId) {
    const abaCheckout = window.open('', '_blank')
    setSolicitandoId(planoId)
    try {
      const pedido = await pedidoService.criar({ planoId })
      const monitor = createCheckoutMonitor(pedido, slug)
      saveCheckoutMonitor(monitor)
      setCheckoutMonitor(monitor)
      notifyCheckoutMonitor({
        pedidoId: monitor.pedidoId,
        referencia: monitor.referencia,
        localSlug: monitor.localSlug,
      })

      if (pedido.checkoutUrl) {
        if (abaCheckout) {
          abaCheckout.opener = null
          abaCheckout.location.href = pedido.checkoutUrl
          show('Checkout aberto em outra aba. Vamos acompanhar a confirmacao por aqui.')
          return
        }

        show('Seu navegador bloqueou a nova aba. Vamos abrir o checkout nesta mesma pagina.')
        window.location.href = pedido.checkoutUrl
        return
      }
      if (abaCheckout) abaCheckout.close()
      show('Pedido criado com sucesso.')
      setTimeout(() => navigate('/meus-pedidos'), 600)
    } catch (error) {
      if (abaCheckout) abaCheckout.close()
      const mensagem = error.response?.data?.erro || 'Nao foi possivel iniciar a compra.'
      show(mensagem, 'error')
      if (mensagem.includes('pedido pendente')) {
        setTimeout(() => navigate('/meus-pedidos'), 900)
      }
    } finally {
      setSolicitandoId('')
    }
  }

  function fecharAcompanhamentoCheckout() {
    clearCheckoutMonitor()
    setCheckoutMonitor(null)
  }

  function renderAcaoPlano(plano) {
    if (!user) {
      return (
        <Link className="btn btn-primary" to="/register">
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
        onClick={() => solicitarPlano(plano.id)}
        disabled={solicitandoId === plano.id}
      >
        {solicitandoId === plano.id ? 'Abrindo pagamento...' : 'Pagar com Mercado Pago'}
      </button>
    )
  }

  if (loading) return <div className="spinner" />
  if (!local) return <div className="empty-state">Local de prova nao encontrado.</div>

  const compraLiberada = local.statusComercial === 'DISPONIVEL'
  const mensagemDisponibilidade = getMensagemDisponibilidade(local)
  const planoInicial = planos[0]
  const tituloComercial = getTituloComercial(local)
  const subtituloComercial = getSubtituloComercial(local, compraLiberada, mensagemDisponibilidade)
  const caixaDestaque = getCaixaDestaque(local)
  const imagemPrincipal = resolveMediaUrl(local.imagemPrincipalUrl)
  const checkoutAcompanhamento = checkoutMonitor ? getCheckoutAcompanhamento(checkoutMonitor) : null
  const checkoutSituacao = checkoutMonitor
    ? formatSituacaoPedido(checkoutMonitor.status, null, checkoutMonitor.paymentStatus)
    : ''
  const checkoutBadgeClass = checkoutMonitor
    ? getSituacaoPedidoBadgeClass(checkoutMonitor.status, null, checkoutMonitor.paymentStatus)
    : 'badge-gray'
  const checkoutEtapa = checkoutMonitor ? getCheckoutMonitorStage(checkoutMonitor) : 'IDLE'
  const saibaMaisLocal = [
    {
      titulo: 'O que voce vai encontrar',
      copy: 'Esse acesso foi organizado para mostrar o que mais ajuda antes da prova, sem excesso de informacao aberta de uma vez.',
      pontos: HERO_DESTAQUES_LOCAL,
    },
    {
      titulo: 'Como isso ajuda no dia da prova',
      copy: 'O foco nao e decorar rua. E dirigir com mais leitura, menos surpresa e mais criterio durante a avaliacao.',
      pontos: BENEFICIOS_DO_ACESSO.map(item => `${item.titulo}: ${item.descricao}`),
    },
    {
      titulo: 'Compra e liberacao',
      copy: 'A compra e simples e o acesso aparece automaticamente assim que o pagamento e confirmado.',
      pontos: COMPRA_SEGURA_ITENS.map(item => `${item.titulo}: ${item.descricao}`),
    },
  ]

  return (
    <div className="landing-page landing-page--eager">
      {ToastEl}
      <Link className="back-link" to="/">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        Voltar para os locais
      </Link>

      <section className="hero-shell hero-shell--local hero-shell--single fade-in">
        <div className="hero-copy">
          <div className="hero-kicker">Preparacao por local de prova</div>
          <div className="local-hero-topline">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center' }}>
              <span className={`badge ${getStatusBadgeClass(local.statusComercial)}`}>
                {formatStatusComercialLocal(local.statusComercial)}
              </span>
              <span className="hero-inline-copy">{local.cidade}</span>
              {compraLiberada && planoInicial && (
                <span className="hero-inline-copy">A partir de {fmtMoeda(planoInicial.precoCentavos)}</span>
              )}
            </div>
          </div>
          <h1 className="hero-title">{tituloComercial}</h1>
          <p className="hero-subtitle">{subtituloComercial}</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to={user ? (isAdmin ? '/admin' : '/biblioteca') : '/register'}>
              {user ? (isAdmin ? 'Abrir administracao' : 'Ver minha biblioteca') : 'Criar conta para comprar'}
            </Link>
            <Link className="btn btn-ghost" to={user ? (isAdmin ? '/admin/pedidos' : '/meus-pedidos') : '/login'}>
              {user ? 'Ver meus pagamentos' : 'Ja tenho conta'}
            </Link>
          </div>
          <div className="mini-copy" style={{ marginTop: '1rem', maxWidth: 680 }}>
            Os conteudos refletem experiencia real, observacao pratica e os percursos mais frequentes desse local.
            O trajeto da avaliacao pode variar.
          </div>
          <div className="hero-proof-grid">
            <div className="hero-proof-chip hero-proof-chip--strong">Trechos mais recorrentes desse local</div>
            <div className="hero-proof-chip">Conteudo direto para reduzir surpresa e ansiedade</div>
          </div>
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

      <RevealSection as="section" className="landing-section" delay={40} eager>
        <div className="page-title">{compraLiberada ? 'Escolha seu periodo de acesso' : 'Disponibilidade do local'}</div>
        <p className="page-sub">
          {compraLiberada
            ? 'Escolha o periodo que combina melhor com sua data de prova e com o ritmo em que voce quer revisar.'
            : 'Esse local aparece no site, mas a compra fica bloqueada ate o administrador liberar as vendas.'}
        </p>

        {!compraLiberada ? (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className={`badge ${getStatusBadgeClass(local.statusComercial)}`}>
                {formatStatusComercialLocal(local.statusComercial)}
              </span>
              <span className="table-name">Compra indisponivel no momento</span>
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
        ) : planos.length === 0 ? (
          <div className="empty-state">Esse local ainda nao possui planos ativos.</div>
        ) : (
          <div className="local-offer-layout">
            <div className="plan-grid">
              {planos.map(plano => {
                const destaquePlano = getPlanoDestaque(plano.duracaoDias)
                const pontosCurtos = getPlanoPontosCurtos(plano.duracaoDias)

                return (
                <div key={plano.id} className={`plan-card ${destaquePlano.recomendado ? 'plan-card--recommended' : ''}`}>
                  <div className="plan-top-row">
                    <div className="plan-badge">{formatPlanoDuracao(plano.duracaoDias)}</div>
                    <div className="plan-mini-tag">{destaquePlano.selo}</div>
                  </div>
                  {destaquePlano.recomendado && <div className="plan-ribbon">Recomendado para a maioria dos alunos</div>}
                  <div className="plan-name">{plano.nome}</div>
                  <div className="plan-price">{fmtMoeda(plano.precoCentavos)}</div>
                  <div className="plan-price-caption">Pagamento unico pelo periodo escolhido</div>
                  <div className="plan-highlight">{getPlanoIndicacao(plano.duracaoDias)}</div>
                  <div className="plan-summary">{destaquePlano.resumo}</div>
                  <div className="plan-copy">
                    Um acesso mais direto para revisar esse local com mais confianca e menos surpresa no dia da prova.
                  </div>
                  <div className="plan-feature-grid">
                    {pontosCurtos.map(item => (
                      <div key={item} className="plan-feature-pill">
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="plan-footer-note">
                    Acesso liberado automaticamente apos a confirmacao do pagamento.
                  </div>
                  <div className="plan-meta-stack">
                    <div className="plan-meta">Validade clara: {formatPlanoDuracao(plano.duracaoDias)}</div>
                    <div className="plan-meta">Pix ou cartao pelo Mercado Pago, sem renovacao automatica.</div>
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    {renderAcaoPlano(plano)}
                  </div>
                  <div className="plan-cta-copy">
                    {user && !isAdmin
                      ? 'O acesso e liberado automaticamente apos a confirmacao do pagamento.'
                      : 'Escolha esse plano para continuar o preparo desse local.'}
                  </div>
                </div>
              )})}
            </div>
            <aside className="local-offer-box">
              {imagemPrincipal && (
                <img
                  src={imagemPrincipal}
                  alt={`Destaque visual do local ${local.nome}`}
                  className="local-offer-box-image"
                />
              )}
              <div className="local-offer-box-kicker">Mais clareza antes da prova</div>
              <div className="local-offer-box-title">{caixaDestaque.titulo}</div>
              <div className="local-offer-box-list">
                {caixaDestaque.itens.map(item => (
                  <div key={item} className="local-offer-box-item">
                    <span className="local-offer-box-dot" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="local-offer-box-note">{caixaDestaque.observacao}</div>
            </aside>
          </div>
        )}
      </RevealSection>

      <RevealSection as="section" className="landing-section" delay={65} eager>
        <div className="landing-inline-strip landing-inline-strip--compact">
          <div className="landing-inline-chip">1 local por compra, com acesso pelo periodo escolhido.</div>
          <div className="landing-inline-chip">Compra unica com liberacao automatica apos a confirmacao do pagamento.</div>
        </div>
      </RevealSection>

      <RevealSection as="section" className="landing-section" delay={70} eager>
        <div className="section-title-row">
          <div>
            <div className="section-heading">Saiba mais sobre esse acesso</div>
            <div className="section-copy">Abra apenas os detalhes que voce quiser consultar depois de olhar os planos.</div>
          </div>
        </div>

        <div className="learn-more-list">
          {saibaMaisLocal.map(item => (
            <details key={item.titulo} className="learn-more-item">
              <summary className="learn-more-summary">
                <span className="learn-more-title">{item.titulo}</span>
                <span className="learn-more-toggle">Abrir</span>
              </summary>

              <div className="learn-more-body">
                <div className="learn-more-copy">{item.copy}</div>
                <div className="learn-more-points">
                  {item.pontos.map(ponto => (
                    <div key={ponto} className="learn-more-point">
                      <span className="learn-more-point-dot" />
                      <span>{ponto}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </RevealSection>
    </div>
  )
}
