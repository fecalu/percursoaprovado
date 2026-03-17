import { useEffect, useMemo, useState } from 'react'
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

export default function AdminPedidos() {
  const { show, ToastEl } = useToast()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [processandoId, setProcessandoId] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    try {
      setPedidos(await pedidoService.listarAdmin())
    } finally {
      setLoading(false)
    }
  }

  async function cancelar(id) {
    setProcessandoId(id)
    try {
      await pedidoService.cancelarAdmin(id)
      show('Pedido cancelado com sucesso.')
      await carregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao cancelar pedido.', 'error')
    } finally {
      setProcessandoId('')
    }
  }

  const pendentes = useMemo(() => pedidos.filter(item => item.status === 'PENDENTE'), [pedidos])
  const pagos = useMemo(() => pedidos.filter(item => item.status === 'PAGO'), [pedidos])
  const cancelados = useMemo(() => pedidos.filter(item => item.status === 'CANCELADO'), [pedidos])

  return (
    <>
      {ToastEl}
      <div className="page-title">Pedidos e pagamentos</div>
      <p className="page-sub">Acompanhe a aprovacao dos pagamentos e o envio automatico dos acessos.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Aguardando pagamento</div>
          <div className="stat-value">{pendentes.length}</div>
          <div className="stat-sub">checkout iniciado</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pagos</div>
          <div className="stat-value">{pagos.length}</div>
          <div className="stat-sub">com acesso liberado</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cancelados</div>
          <div className="stat-value">{cancelados.length}</div>
          <div className="stat-sub">pedidos encerrados</div>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : pedidos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Nenhum pedido recebido ainda.
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-head" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr 190px' }}>
            <span>Compra</span>
            <span>Referencia</span>
            <span>Valor</span>
            <span>Situacao</span>
            <span>Acoes</span>
          </div>
          {pedidos.map(item => (
            <div key={item.id} className="table-row" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr 190px' }}>
              <div>
                <div className="table-name">{item.localProvaNome}</div>
                <div className="mini-copy">{item.planoNome} - {formatPlanoDuracao(item.duracaoDias)}</div>
                <div className="mini-copy">Criado em {formatDataCurta(item.criadoEm)}</div>
                {item.paymentId && <div className="mini-copy">ID do pagamento: {item.paymentId}</div>}
                {item.paymentStatus && (
                  <div className="mini-copy">
                    Status do pagamento: {formatPagamentoStatus(item.paymentStatus)}
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
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => cancelar(item.id)}
                    disabled={processandoId === item.id}
                  >
                    {processandoId === item.id ? 'Processando...' : 'Cancelar'}
                  </button>
                ) : (
                  <span className="mini-copy">{item.status === 'PAGO' ? `Acesso liberado em ${formatDataCurta(item.pagoEm)}` : 'Sem acao disponivel'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
