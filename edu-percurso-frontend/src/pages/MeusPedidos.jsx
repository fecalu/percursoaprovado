import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      <div className="page-title">Meus pagamentos</div>
      <p className="page-sub">Acompanhe seus pagamentos e libere seu acesso ao local de prova.</p>

      <div className="stats-grid" style={{ maxWidth: 780 }}>
        <div className="stat-card">
          <div className="stat-label">Aguardando pagamento</div>
          <div className="stat-value">{pendentes.length}</div>
          <div className="stat-sub">prontos para pagar</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Aprovados</div>
          <div className="stat-value">{pagos.length}</div>
          <div className="stat-sub">com acesso liberado</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cancelados</div>
          <div className="stat-value">{cancelados.length}</div>
          <div className="stat-sub">sem acesso liberado</div>
        </div>
      </div>

      {pendentes.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
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
        <div className="table-wrap">
          <div className="table-head" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 140px' }}>
            <span>Local / plano</span>
            <span>Pedido</span>
            <span>Valor</span>
            <span>Situacao</span>
            <span>Acoes</span>
          </div>
          {pedidos.map(item => (
            <div key={item.id} className="table-row" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 140px' }}>
              <div>
                <div className="table-name">{item.localProvaNome}</div>
                <div className="mini-copy">{item.planoNome} - {formatPlanoDuracao(item.duracaoDias)}</div>
                <div className="mini-copy">Criado em {formatDataCurta(item.criadoEm)}</div>
                {item.paymentStatus && (
                  <div className="mini-copy">
                    Pagamento no Mercado Pago: {formatPagamentoStatus(item.paymentStatus)}
                    {item.paymentStatusDetail ? ` (${formatPagamentoDetalhe(item.paymentStatusDetail)})` : ''}
                  </div>
                )}
              </div>
              <span className="table-cat">{item.referencia}</span>
              <span className="table-dur">{fmtMoeda(item.valorCentavos)}</span>
              <span>
                <span className={`badge ${item.status === 'PAGO' ? 'badge-green' : item.status === 'CANCELADO' ? 'badge-red' : 'badge-gray'}`}>
                  {formatPedidoStatus(item.status)}
                </span>
              </span>
              <div className="table-actions">
                {item.status === 'PENDENTE' ? (
                  <>
                    {item.checkoutUrl && (
                      <a
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        href={item.checkoutUrl}
                      >
                        Pagar agora
                      </a>
                    )}
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => cancelarPedido(item.id)}
                      disabled={cancelandoId === item.id}
                    >
                      {cancelandoId === item.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  </>
                ) : item.status === 'PAGO' ? (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => navigate('/biblioteca')}
                  >
                    Abrir biblioteca
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => navigate(`/locais/${item.localProvaSlug}`)}
                  >
                    Ver local
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
