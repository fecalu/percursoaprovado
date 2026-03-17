import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { pedidoService } from '../services/api'

function useQuery() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

const MENSAGENS = {
  sucesso: {
    titulo: 'Pagamento em confirmacao',
    texto: 'Recebemos o retorno do Mercado Pago e estamos confirmando seu pagamento.',
  },
  pendente: {
    titulo: 'Pagamento pendente',
    texto: 'Seu pagamento ainda esta em analise ou aguardando confirmacao.',
  },
  falha: {
    titulo: 'Pagamento nao concluido',
    texto: 'Voce pode tentar novamente pelo seu historico de pagamentos.',
  },
}

export default function CheckoutResultado() {
  const { status } = useParams()
  const query = useQuery()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const paymentId = query.get('payment_id') || query.get('collection_id')
  const externalReference = query.get('external_reference')
  const mensagem = MENSAGENS[status] || MENSAGENS.falha

  useEffect(() => {
    if (!user || !paymentId || !externalReference || status !== 'sucesso') return

    setLoading(true)
    pedidoService.sincronizarRetorno({ paymentId, externalReference })
      .catch(error => {
        setErro(error.response?.data?.erro || 'Ainda estamos aguardando a confirmacao do pagamento.')
      })
      .finally(() => setLoading(false))
  }, [externalReference, paymentId, status, user])

  return (
    <div className="landing-page">
      <section className="hero-shell fade-in">
        <div className="hero-copy">
          <div className="hero-kicker">Checkout</div>
          <h1 className="hero-title">{mensagem.titulo}</h1>
          <p className="hero-subtitle">{mensagem.texto}</p>

          {paymentId && (
            <div className="mini-copy" style={{ marginTop: '1rem' }}>
              Pagamento: {paymentId}
            </div>
          )}
          {externalReference && (
            <div className="mini-copy">
              Pedido: {externalReference}
            </div>
          )}
          {loading && (
            <div className="mini-copy" style={{ marginTop: '0.75rem' }}>
              Confirmando seu pagamento...
            </div>
          )}
          {erro && (
            <div className="mini-copy" style={{ marginTop: '0.75rem', color: 'var(--danger)' }}>
              {erro}
            </div>
          )}

          <div className="hero-actions">
            {user ? (
              <>
                <button className="btn btn-primary" onClick={() => navigate('/meus-pedidos')}>
                  Ver meus pagamentos
                </button>
                <button className="btn btn-ghost" onClick={() => navigate('/meus-acessos')}>
                  Ver meus acessos
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-primary" to="/login">
                  Entrar
                </Link>
                <Link className="btn btn-ghost" to="/">
                  Voltar ao inicio
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-panel-title">Proximos passos</div>
          <div className="hero-list">
            <div className="hero-list-item">Se o pagamento for aprovado, seu acesso sera liberado automaticamente.</div>
            <div className="hero-list-item">Se ainda estiver pendente, acompanhe o status em Meus pagamentos.</div>
            <div className="hero-list-item">Se o checkout foi interrompido, voce pode retomar o pagamento pela area Meus pagamentos.</div>
          </div>
        </div>
      </section>
    </div>
  )
}
