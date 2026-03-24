import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import { localProvaService, pedidoService, planoService } from '../services/api'
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

const BENEFICIOS = [
  'Percursos mais frequentes do local',
  'Pontos de atencao nos trechos mais importantes',
  'Videos e apoios explicativos',
  'Baliza, embreagem e revisao pratica',
]

const CONFIANCA = [
  'Liberacao automatica apos a confirmacao',
  'Pagamento processado com seguranca pelo Mercado Pago',
  'O acesso aparece na sua biblioteca assim que o pagamento for aprovado',
]

export default function CheckoutRevisao() {
  const { localSlug, planoId } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { show, ToastEl } = useToast()
  const [loading, setLoading] = useState(true)
  const [local, setLocal] = useState(null)
  const [plano, setPlano] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true

    Promise.all([localProvaService.buscar(localSlug), planoService.listar({ localSlug })])
      .then(([localResp, planosResp]) => {
        if (!ativo) return
        setLocal(localResp)
        const planoEncontrado = planosResp.find(item => String(item.id) === String(planoId)) || null
        setPlano(planoEncontrado)
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

  if (!local || !plano) {
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
          <div className="hero-kicker">Revise seu acesso antes de pagar</div>
          <h1 className="checkout-review-title">Voce esta a um passo de liberar o material do seu local de prova.</h1>
          <p className="checkout-review-subtitle">
            Revise o que esta incluido, confirme o periodo escolhido e siga para o pagamento com mais clareza.
          </p>

          <div className="checkout-review-section">
            <div className="checkout-review-section-title">O que voce vai receber</div>
            <div className="checkout-review-list">
              {BENEFICIOS.map(item => (
                <div key={item} className="checkout-review-list-item">
                  <span className="checkout-review-list-dot" />
                  <span>{item}</span>
                </div>
              ))}
              <div className="checkout-review-list-item">
                <span className="checkout-review-list-dot" />
                <span>Acesso por 1 local, durante {formatPlanoDuracao(plano.duracaoDias)}</span>
              </div>
            </div>
          </div>

          <div className="checkout-review-section">
            <div className="checkout-review-section-title">Como isso ajuda antes da prova</div>
            <p className="checkout-review-support">
              O objetivo nao e decorar rua. E chegar mais preparado para entender o padrao da avaliacao, reduzir
              surpresa e dirigir com mais criterio no dia da prova.
            </p>
          </div>

          <div className="checkout-review-trust">
            {CONFIANCA.map(item => (
              <div key={item} className="checkout-review-trust-item">
                <span className="checkout-review-trust-dot" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="checkout-review-summary">
          <div className="checkout-review-summary-kicker">Resumo da compra</div>
          <div className="checkout-review-summary-title">{local.nome}</div>
          <div className="checkout-review-summary-copy">
            Material do local de prova com acesso por {formatPlanoDuracao(plano.duracaoDias)}.
          </div>

          <div className="checkout-review-summary-grid">
            {resumoItens.map(item => (
              <div key={item.label} className="checkout-review-summary-row">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="checkout-review-price-card">
            <div className="checkout-review-price-label">Total</div>
            <div className="checkout-review-price-value">{fmtMoeda(plano.precoCentavos)}</div>
            <div className="checkout-review-price-copy">Pagamento unico pelo periodo escolhido</div>
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

          <div className="checkout-review-secure">Pagamento seguro com Mercado Pago</div>
        </aside>
      </section>
    </div>
  )
}
