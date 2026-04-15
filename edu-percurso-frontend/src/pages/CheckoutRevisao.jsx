import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { interpolateSiteText, resolveCheckoutPageConfig } from '../data/sitePageDefaults'
import { useToast } from '../hooks/useToast'
import { configuracaoSiteService, localProvaService, pedidoService, planoService } from '../services/api'
import { formatTrilhaPlano, getBadgeClassTrilhaPlano, getResumoTrilhaPlano } from '../utils/formatters'
import { createCheckoutMonitor, notifyCheckoutMonitor, saveCheckoutMonitor } from '../utils/checkoutMonitor'

function fmtMoeda(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((centavos || 0) / 100)
}

function formatPlanoDuracao(duracaoDias) {
  if (!duracaoDias) return 'Período escolhido'
  if (duracaoDias === 30) return '1 mês'
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

function getCheckoutPadraoPorTrilha(checkoutPageContent, trilhaCodigo) {
  const base = {
    kicker: checkoutPageContent.kickerPadrao,
    titulo: checkoutPageContent.tituloPadrao,
    subtitulo: checkoutPageContent.subtituloPadrao,
    beneficiosTitulo: checkoutPageContent.beneficiosTituloPadrao,
    beneficios: checkoutPageContent.beneficiosListaPadrao,
    ajudaTitulo: checkoutPageContent.ajudaTituloPadrao,
    ajudaTexto: checkoutPageContent.ajudaTextoPadrao,
    confianca: checkoutPageContent.confiancaListaPadrao,
    resumoKicker: checkoutPageContent.resumoKickerPadrao,
    resumoTexto: checkoutPageContent.resumoTextoPadrao,
    precoLabel: checkoutPageContent.precoLabelPadrao,
    precoTexto: checkoutPageContent.precoTextoPadrao,
    seguroTexto: checkoutPageContent.seguroTextoPadrao,
  }

  if (trilhaCodigo === 'comecando_do_zero') {
    return {
      ...base,
      kicker: 'Jornada completa para sua aprovacao',
      titulo: 'Comece com mais clareza e siga uma jornada organizada ate a prova',
      subtitulo: 'Esse plano foi pensado para quem quer sair do zero, entender o caminho certo e chegar mais preparado no dia da prova.',
      beneficiosTitulo: 'O que voce leva nesse plano',
      beneficios: [
        'Mais contexto para estudar sem se perder logo no inicio',
        'Uma jornada mais clara ate a etapa pratica e a revisao final',
        'Conteudo para avancar com mais seguranca em cada fase',
      ],
      ajudaTitulo: 'Quando esse plano faz mais sentido',
      ajudaTexto: 'Ideal para quem ainda esta organizando os primeiros passos e quer um caminho mais completo ate a prova.',
      confianca: [
        'Plano pensado para quem quer mais orientacao desde o inicio',
        'Acesso para estudar no seu ritmo e voltar quantas vezes precisar',
        'Jornada organizada para chegar na prova com mais confianca',
      ],
      resumoKicker: 'Plano para quem quer comecar do zero',
      resumoTexto: 'Voce recebe um plano pensado para acompanhar sua jornada desde os primeiros passos ate a reta final da prova.',
      precoLabel: 'Investimento para a jornada completa',
      precoTexto: 'Pagamento unico para o periodo escolhido',
      seguroTexto: 'Compra segura para quem quer estudar com direcao desde o inicio.',
    }
  }

  if (trilhaCodigo === 'reta_final_prova') {
    return {
      ...base,
      kicker: 'Foco total na reta final da prova',
      titulo: 'Revise com mais estrategia e chegue mais seguro para a prova pratica',
      subtitulo: 'Esse plano foi pensado para quem ja passou pelas etapas iniciais e agora quer focar em pratica, percurso e revisao.',
      beneficiosTitulo: 'O que voce leva nessa reta final',
      beneficios: [
        'Mais foco em pratica, percursos e pontos de atencao',
        'Revisao mais objetiva do que realmente pesa perto da prova',
        'Um caminho mais direto para ganhar confianca antes do exame',
      ],
      ajudaTitulo: 'Quando esse plano faz mais sentido',
      ajudaTexto: 'Ideal para quem ja esta perto da prova e quer revisar com objetividade, sem voltar para as etapas iniciais.',
      confianca: [
        'Plano focado em revisao pratica e reta final',
        'Acesso para rever percurso, pegadinhas e pontos de atencao',
        'Jornada mais objetiva para chegar mais afiado no dia da prova',
      ],
      resumoKicker: 'Plano para a reta final',
      resumoTexto: 'Voce recebe um plano focado no que mais pesa agora: percurso, pegadinhas, revisao e confianca para o dia da prova.',
      precoLabel: 'Investimento para a reta final',
      precoTexto: 'Pagamento unico para o periodo escolhido',
      seguroTexto: 'Compra segura para quem quer revisar com foco na etapa final da prova.',
    }
  }

  return base
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
      { label: 'Jornada', value: formatTrilhaPlano(plano.trilhaNome, plano.trilhaCodigo) },
      { label: 'Acesso', value: formatPlanoDuracao(plano.duracaoDias) },
      { label: 'Pagamento', value: 'Pix ou cartão' },
    ]
  }, [local, plano])

  const trilhaPlano = useMemo(() => {
    if (!plano) return null

    return {
      nome: formatTrilhaPlano(plano.trilhaNome, plano.trilhaCodigo),
      badgeClass: getBadgeClassTrilhaPlano(plano.trilhaCodigo),
      resumo: getResumoTrilhaPlano(plano.trilhaCodigo),
    }
  }, [plano])

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
    const checkoutDefaults = getCheckoutPadraoPorTrilha(checkoutPageContent, plano.trilhaCodigo)

    const usarCustom = Boolean(plano.usarCheckoutPersonalizado)
    const obterTexto = (valor, fallback) => {
      if (!usarCustom || !String(valor || '').trim()) return interpolateSiteText(fallback, contexto)
      return interpolateSiteText(valor, contexto)
    }

    return {
      kicker: obterTexto(plano.checkoutKicker, checkoutDefaults.kicker),
      titulo: obterTexto(plano.checkoutTitulo, checkoutDefaults.titulo),
      subtitulo: obterTexto(plano.checkoutSubtitulo, checkoutDefaults.subtitulo),
      beneficiosTitulo: obterTexto(plano.checkoutBeneficiosTitulo, checkoutDefaults.beneficiosTitulo),
      beneficios: parseLinhasCheckout(plano.checkoutBeneficiosTexto, checkoutDefaults.beneficios, contexto),
      ajudaTitulo: obterTexto(plano.checkoutAjudaTitulo, checkoutDefaults.ajudaTitulo),
      ajudaTexto: obterTexto(plano.checkoutAjudaTexto, checkoutDefaults.ajudaTexto),
      confianca: parseLinhasCheckout(plano.checkoutConfiancaTexto, checkoutDefaults.confianca, contexto),
      resumoKicker: obterTexto(plano.checkoutResumoKicker, checkoutDefaults.resumoKicker),
      resumoTexto: obterTexto(plano.checkoutResumoTexto, checkoutDefaults.resumoTexto || `Material do local de prova com acesso por ${duracaoFormatada}.`),
      precoLabel: obterTexto(plano.checkoutPrecoLabel, checkoutDefaults.precoLabel),
      precoTexto: obterTexto(plano.checkoutPrecoTexto, checkoutDefaults.precoTexto),
      seguroTexto: obterTexto(plano.checkoutSeguroTexto, checkoutDefaults.seguroTexto),
    }
  }, [configCheckout, local, plano])

  async function continuarParaPagamento() {
    if (!plano || !local) return

    if (!user) {
      navigate('/login', {
        state: {
          returnTo: `/checkout/revisao/${localSlug}/${planoId}`,
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
          show('Checkout aberto em outra aba. Vamos acompanhar a confirmação por aqui.')
          navigate(`/locais/${localSlug}`)
          return
        }

        show('Seu navegador bloqueou a nova aba. Vamos abrir o checkout nesta mesma página.')
        window.location.href = pedido.checkoutUrl
        return
      }

      if (abaCheckout) abaCheckout.close()
      show('Pedido criado com sucesso.')
      setTimeout(() => navigate('/meus-pedidos'), 500)
    } catch (error) {
      if (abaCheckout) abaCheckout.close()
      const mensagem = error.response?.data?.erro || 'Não foi possível iniciar a compra.'
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
        <div className="empty-state">Não foi possível encontrar esse plano para revisão da compra.</div>
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

          {trilhaPlano && (
            <div className="checkout-review-journey">
              <span className={`badge ${trilhaPlano.badgeClass}`}>{trilhaPlano.nome}</span>
              <div className="checkout-review-journey-copy">{trilhaPlano.resumo}</div>
            </div>
          )}

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

          {trilhaPlano && (
            <div className="checkout-review-summary-journey">
              <span className={`badge ${trilhaPlano.badgeClass}`}>{trilhaPlano.nome}</span>
              <span>{trilhaPlano.resumo}</span>
            </div>
          )}

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
