import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RevealSection from '../components/RevealSection'
import { pedidoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import {
  formatDataCurta,
  formatPagamentoDetalhe,
  formatPagamentoStatus,
  formatPedidoStatus,
  formatPlanoDuracao,
} from '../utils/formatters'

function fmtMoeda(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((centavos || 0) / 100)
}

export default function MeusPedidos() {
  const navigate = useNavigate()
  const { show, ToastEl } = useToast()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelandoId, setCancelandoId] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    try {
      setPedidos(await pedidoService.minhas())
    } finally {
      setLoading(false)
    }
  }

  async function cancelarPedido(id) {
    setCancelandoId(id)
    try {
      await pedidoService.cancelar(id)
      show('Pedido cancelado com sucesso.')
      await carregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao cancelar pedido.', 'error')
    } finally {
      setCancelandoId('')
    }
  }

  const pendentes = useMemo(() => pedidos.filter(item => item.status === 'PENDENTE'), [pedidos])
  const pagos = useMemo(() => pedidos.filter(item => item.status === 'PAGO'), [pedidos])
  const cancelados = useMemo(() => pedidos.filter(item => item.status === 'CANCELADO'), [pedidos])

  if (loading) return <div className="spinner" />

  return (
    <>
      {ToastEl}
      <RevealSection className="student-shell" delay={30}>
        <section className="student-hero">
          <div>
            <div className="page-title">Meus pagamentos</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Acompanhe seus pagamentos, retome pedidos pendentes e veja quando o acesso ja foi liberado.
            </p>
          </div>
          <div className="student-kpi-grid">
            <div className="student-kpi-card">
              <div className="student-kpi-label">Aguardando pagamento</div>
              <div className="student-kpi-value">{pendentes.length}</div>
              <div className="student-kpi-copy">prontos para pagar</div>
            </div>
            <div className="student-kpi-card">
              <div className="student-kpi-label">Aprovados</div>
              <div className="student-kpi-value">{pagos.length}</div>
              <div className="student-kpi-copy">com acesso liberado</div>
            </div>
            <div className="student-kpi-card">
              <div className="student-kpi-label">Cancelados</div>
              <div className="student-kpi-value">{cancelados.length}</div>
              <div className="student-kpi-copy">sem acesso liberado</div>
            </div>
          </div>
        </section>
      </RevealSection>

      {pendentes.length > 0 && (
        <div className="student-filter-card" style={{ marginBottom: '1.5rem' }}>
          <div className="section-heading">Como liberar seu acesso</div>
          <div className="mini-copy" style={{ marginTop: '0.75rem' }}>
            1. Clique em Pagar agora no pedido pendente.
          </div>
          <div className="mini-copy">
            2. Finalize o checkout no Mercado Pago usando Pix ou cartao de credito.
          </div>
          <div className="mini-copy">
            3. Depois da confirmacao do pagamento, seu acesso aparece automaticamente em Meus acessos e na Biblioteca.
          </div>
        </div>
      )}

      {pedidos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Voce ainda nao iniciou nenhuma compra.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Ver locais de prova
            </button>
          </div>
        </div>
      ) : (
        <div className="student-stack">
          {pedidos.map(item => (
            <RevealSection key={item.id} className="student-order-card" delay={50}>
              <div className="student-order-main">
                <div className="student-card-top">
                  <span className={`badge ${item.status === 'PAGO' ? 'badge-green' : item.status === 'CANCELADO' ? 'badge-red' : 'badge-gray'}`}>
                    {formatPedidoStatus(item.status)}
                  </span>
                  <span className="student-card-copy">{fmtMoeda(item.valorCentavos)}</span>
                </div>
                <div className="student-card-title">{item.localProvaNome}</div>
                <div className="student-card-copy">{item.planoNome} - {formatPlanoDuracao(item.duracaoDias)}</div>
                <div className="student-detail-list">
                  <div className="student-detail-item">
                    <span className="student-detail-label">Pedido</span>
                    <span className="student-detail-value">{item.referencia}</span>
                  </div>
                  <div className="student-detail-item">
                    <span className="student-detail-label">Criado em</span>
                    <span className="student-detail-value">{formatDataCurta(item.criadoEm)}</span>
                  </div>
                  {item.paymentStatus && (
                    <div className="student-detail-item">
                      <span className="student-detail-label">Pagamento</span>
                      <span className="student-detail-value">
                        {formatPagamentoStatus(item.paymentStatus)}
                        {item.paymentStatusDetail ? ` (${formatPagamentoDetalhe(item.paymentStatusDetail)})` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="student-card-actions">
                {item.status === 'PENDENTE' ? (
                  <>
                    {item.checkoutUrl && (
                      <a className="btn btn-primary" href={item.checkoutUrl}>
                        Pagar agora
                      </a>
                    )}
                    <button
                      className="btn btn-danger"
                      onClick={() => cancelarPedido(item.id)}
                      disabled={cancelandoId === item.id}
                    >
                      {cancelandoId === item.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  </>
                ) : item.status === 'PAGO' ? (
                  <button className="btn btn-primary" onClick={() => navigate('/biblioteca')}>
                    Abrir biblioteca
                  </button>
                ) : (
                  <button className="btn btn-ghost" onClick={() => navigate(`/locais/${item.localProvaSlug}`)}>
                    Ver local
                  </button>
                )}
              </div>
            </RevealSection>
          ))}
        </div>
      )}
    </>
  )
}
