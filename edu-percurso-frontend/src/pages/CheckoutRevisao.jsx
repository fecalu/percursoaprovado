import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { interpolateSiteText, resolveCheckoutPageConfig } from '../data/sitePageDefaults'
import { useToast } from '../hooks/useToast'
import { configuracaoSiteService, localProvaService, pedidoService, planoService } from '../services/api'
import { createCheckoutMonitor, notifyCheckoutMonitor, saveCheckoutMonitor } from '../utils/checkoutMonitor'

function fmtMoeda(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((centavos || 0) / 100)
}

function formatPlanoDuracao(duracaoDias) {
  if (!duracaoDias) return 'Periodo escolhido'
  if (duracaoDias === 30) return '1 mes'
  if (duracaoDias === 90) return '3 meses'
  if (duracaoDias === 180) return '6 meses'
  if (duracaoDias === 365) return '12 meses'
  return `${duracaoDias} dias`
}

function parseLinhasCheckout(texto, fallback, contexto) {
  const valor = String(texto || '').trim()
  if (!valor) return fallback

  const linhas = valor
    .split('\n')
    .map(item => interpolateSiteText(item.trim(), contexto))
    .filter(Boolean)

  return linhas.length ? linhas : fallback
}

export default function CheckoutRevisao() {
  const { localSlug, planoId } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { show, ToastEl } = useToast()
  const [loading, setLoading] = useState(true)
  const [local, setLocal] = useState(null)
  const [plano, setPlano] = useState(null)
  const [configCheckout, setConfigCheckout] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true

    Promise.allSettled([
      localProvaService.buscar(localSlug),
      planoService.listar({ localSlug }),
      configuracaoSiteService.buscarPublica(),
    ])
      .then(([localResp, planosResp, configResp]) => {
        if (!ativo) return
        setLocal(localResp.status === 'fulfilled' ? localResp.value : null)
        const planosLista = planosResp.status === 'fulfilled' ? planosResp.value : []
        const planoEncontrado = planosLista.find(item => String(item.id) === String(planoId)) || null
        setPlano(planoEncontrado)
        setConfigCheckout(configResp.status === 'fulfilled' ? configResp.value?.checkout || null : null)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [localSlug, planoId])

  const resumoItens = useMemo(() => {
    if (!plano) return []

    return [
      { label: 'Local', value: local?.nome || '-' },
      { label: 'Plano', value: plano.nome },
      { label: 'Acesso', value: formatPlanoDuracao(plano.duracaoDias) },
      { label: 'Pagamento', value: 'Pix ou cartao' },
    ]
  }, [local, plano])

  const checkoutCopy = useMemo(() => {
    if (!plano || !local) return null

    const duracaoFormatada = formatPlanoDuracao(plano.duracaoDias)
    const contexto = {
      local: local.nome || '',
      plano: plano.nome || '',
      duracao: duracaoFormatada,
      preco: fmtMoeda(plano.precoCentavos),
    }
    const checkoutPageContent = resolveCheckoutPageConfig(configCheckout || {})

    const usarCustom = Boolean(plano.usarCheckoutPersonalizado)
    const obterTexto = (valor, fallback) => {
      if (!usarCustom || !String(valor || '').trim()) return interpolateSiteText(fallback, contexto)
      return interpolateSiteText(valor, contexto)
    }

    return {
      kicker: obterTexto(plano.checkoutKicker, checkoutPageContent.kickerPadrao),
      titulo: obterTexto(plano.checkoutTitulo, checkoutPageContent.tituloPadrao),
      subtitulo: obterTexto(plano.checkoutSubtitulo, checkoutPageContent.subtituloPadrao),
      beneficiosTitulo: obterTexto(plano.checkoutBeneficiosTitulo, checkoutPageContent.beneficiosTituloPadrao),
      beneficios: parseLinhasCheckout(plano.checkoutBeneficiosTexto, checkoutPageContent.beneficiosListaPadrao, contexto),
      ajudaTitulo: obterTexto(plano.checkoutAjudaTitulo, checkoutPageContent.ajudaTituloPadrao),
      ajudaTexto: obterTexto(plano.checkoutAjudaTexto, checkoutPageContent.ajudaTextoPadrao),
      confianca: parseLinhasCheckout(plano.checkoutConfiancaTexto, checkoutPageContent.confiancaListaPadrao, contexto),
      resumoKicker: obterTexto(plano.checkoutResumoKicker, checkoutPageContent.resumoKickerPadrao),
      resumoTexto: obterTexto(plano.checkoutResumoTexto, checkoutPageContent.resumoTextoPadrao || `Material do local de prova com acesso por ${duracaoFormatada}.`),
      precoLabel: obterTexto(plano.checkoutPrecoLabel, checkoutPageContent.precoLabelPadrao),
      precoTexto: obterTexto(plano.checkoutPrecoTexto, checkoutPageContent.precoTextoPadrao),
      seguroTexto: obterTexto(plano.checkoutSeguroTexto, checkoutPageContent.seguroTextoPadrao),
    }
  }, [configCheckout, local, plano])

  async function continuarParaPagamento() {
    if (!plano || !local) return

    if (!user) {
      navigate('/login', {
        state: {
          redirectTo: `/checkout/revisao/${localSlug}/${planoId}`,
        },
      })
      return
    }

    setEnviando(true)
    const abaCheckout = window.open('', '_blank')

    try {
      const pedido = await pedidoService.criar({ planoId: plano.id })
      const monitor = createCheckoutMonitor(pedido, localSlug)
      saveCheckoutMonitor(monitor)
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
          navigate(`/locais/${localSlug}`)
          return
        }

        show('Seu navegador bloqueou a nova aba. Vamos abrir o checkout nesta mesma pagina.')
        window.location.href = pedido.checkoutUrl
        return
      }

      if (abaCheckout) abaCheckout.close()
      show('Pedido criado com sucesso.')
      setTimeout(() => navigate('/meus-pedidos'), 500)
    } catch (error) {
      if (abaCheckout) abaCheckout.close()
      const mensagem = error.response?.data?.erro || 'Nao foi possivel iniciar a compra.'
      show(mensagem, 'error')
      if (mensagem.includes('pedido pendente')) {
        setTimeout(() => navigate('/meus-pedidos'), 800)
      }
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <div className="spinner" />

  if (!local || !plano || !checkoutCopy) {
    return (
      <div className="landing-page landing-page--eager">
        <div className="empty-state">Nao foi possivel encontrar esse plano para revisao da compra.</div>
      </div>
    )
  }

  return (
    <div className="landing-page landing-page--eager">
      {ToastEl}

      <Link className="back-link" to={`/locais/${localSlug}`}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        Voltar e escolher outro plano
      </Link>

      <section className="checkout-review-layout fade-in">
        <div className="checkout-review-copy">
          <div className="hero-kicker">{checkoutCopy.kicker}</div>
          <h1 className="checkout-review-title">{checkoutCopy.titulo}</h1>
          <p className="checkout-review-subtitle">{checkoutCopy.subtitulo}</p>

          <div className="checkout-review-section">
            <div className="checkout-review-section-title">{checkoutCopy.beneficiosTitulo}</div>
            <div className="checkout-review-list">
              {checkoutCopy.beneficios.map(item => (
                <div key={item} className="checkout-review-list-item">
                  <span className="checkout-review-list-dot" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="checkout-review-section">
            <div className="checkout-review-section-title">{checkoutCopy.ajudaTitulo}</div>
            <p className="checkout-review-support">{checkoutCopy.ajudaTexto}</p>
          </div>

          <div className="checkout-review-trust">
            {checkoutCopy.confianca.map(item => (
              <div key={item} className="checkout-review-trust-item">
                <span className="checkout-review-trust-dot" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="checkout-review-summary">
          <div className="checkout-review-summary-kicker">{checkoutCopy.resumoKicker}</div>
          <div className="checkout-review-summary-title">{local.nome}</div>
          <div className="checkout-review-summary-copy">{checkoutCopy.resumoTexto}</div>

          <div className="checkout-review-summary-grid">
            {resumoItens.map(item => (
              <div key={item.label} className="checkout-review-summary-row">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="checkout-review-price-card">
            <div className="checkout-review-price-label">{checkoutCopy.precoLabel}</div>
            <div className="checkout-review-price-value">{fmtMoeda(plano.precoCentavos)}</div>
            <div className="checkout-review-price-copy">{checkoutCopy.precoTexto}</div>
          </div>

          <div className="checkout-review-actions">
            {isAdmin ? (
              <button className="btn btn-ghost" onClick={() => navigate('/admin/planos')}>
                Editar plano
              </button>
            ) : (
              <button className="btn btn-primary" onClick={continuarParaPagamento} disabled={enviando}>
                {user ? (enviando ? 'Abrindo pagamento...' : 'Continuar para pagamento') : 'Entrar para continuar'}
              </button>
            )}

            <Link className="btn btn-ghost" to={`/locais/${localSlug}`}>
              Voltar e escolher outro plano
            </Link>
          </div>

          <div className="checkout-review-secure">{checkoutCopy.seguroTexto}</div>
        </aside>
      </section>
    </div>
  )
}
