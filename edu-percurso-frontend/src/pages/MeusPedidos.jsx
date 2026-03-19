import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RevealSection from '../components/RevealSection'
import { pedidoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import {
  formatDataCurta,
  formatDataHoraCurta,
  formatPagamentoDetalhe,
  formatPagamentoStatus,
  formatPedidoStatus,
  formatPlanoDuracao,
  formatSolicitacaoCancelamentoStatus,
} from '../utils/formatters'

const MOTIVOS_CANCELAMENTO = [
  'Comprei o local errado',
  'Nao vou mais fazer a prova nesse local',
  'Tive problema no acesso',
  'Outro motivo',
]

function fmtMoeda(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((centavos || 0) / 100)
}

function getSolicitacaoBadgeClass(status) {
  if (status === 'ABERTA') return 'badge-warn'
  if (status === 'APROVADA') return 'badge-blue'
  if (status === 'NEGADA') return 'badge-red'
  return 'badge-gray'
}

export default function MeusPedidos() {
  const navigate = useNavigate()
  const { show, ToastEl } = useToast()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelandoId, setCancelandoId] = useState('')
  const [solicitandoId, setSolicitandoId] = useState('')
  const [pedidoSolicitacao, setPedidoSolicitacao] = useState(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState(MOTIVOS_CANCELAMENTO[0])
  const [observacaoCancelamento, setObservacaoCancelamento] = useState('')

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

  function abrirSolicitacao(item) {
    setPedidoSolicitacao(item)
    setMotivoCancelamento(MOTIVOS_CANCELAMENTO[0])
    setObservacaoCancelamento('')
  }

  function fecharSolicitacao() {
    setPedidoSolicitacao(null)
    setMotivoCancelamento(MOTIVOS_CANCELAMENTO[0])
    setObservacaoCancelamento('')
  }

  async function enviarSolicitacaoCancelamento() {
    if (!pedidoSolicitacao) return

    setSolicitandoId(pedidoSolicitacao.id)
    try {
      await pedidoService.solicitarCancelamento(pedidoSolicitacao.id, {
        motivo: motivoCancelamento,
        observacaoAluno: observacaoCancelamento,
      })
      show('Solicitacao enviada com sucesso. Agora ela aparece para analise do atendimento.')
      fecharSolicitacao()
      await carregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao enviar solicitacao de cancelamento.', 'error')
    } finally {
      setSolicitandoId('')
    }
  }

  const pendentes = useMemo(() => pedidos.filter(item => item.status === 'PENDENTE'), [pedidos])
  const pagos = useMemo(() => pedidos.filter(item => item.status === 'PAGO'), [pedidos])
  const cancelados = useMemo(() => pedidos.filter(item => item.status === 'CANCELADO'), [pedidos])
  const solicitacoesEmAnalise = useMemo(
    () => pedidos.filter(item => item.solicitacaoCancelamentoStatus === 'ABERTA'),
    [pedidos]
  )

  if (loading) return <div className="spinner" />

  return (
    <>
      {ToastEl}
      <RevealSection className="student-shell" delay={30}>
        <section className="student-hero">
          <div>
            <div className="page-title">Meus pagamentos</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Acompanhe seus pagamentos, retome pedidos pendentes e envie solicitacoes de cancelamento dentro do prazo de 7 dias.
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
            <div className="student-kpi-card">
              <div className="student-kpi-label">Solicitacoes abertas</div>
              <div className="student-kpi-value">{solicitacoesEmAnalise.length}</div>
              <div className="student-kpi-copy">em analise</div>
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
                  {item.solicitacaoCancelamentoStatus && (
                    <div className="student-detail-item">
                      <span className="student-detail-label">Solicitacao</span>
                      <span className="student-detail-value">{formatSolicitacaoCancelamentoStatus(item.solicitacaoCancelamentoStatus)}</span>
                    </div>
                  )}
                </div>

                {item.status === 'PAGO' && item.podeSolicitarCancelamento && (
                  <div className="student-inline-note" style={{ marginTop: '0.9rem' }}>
                    Voce pode solicitar cancelamento ate {formatDataHoraCurta(item.prazoCancelamentoExpiraEm)}.
                  </div>
                )}

                {item.status === 'PAGO' && !item.podeSolicitarCancelamento && !item.solicitacaoCancelamentoStatus && item.prazoCancelamentoExpiraEm && (
                  <div className="student-inline-note" style={{ marginTop: '0.9rem' }}>
                    O prazo de 7 dias para solicitar cancelamento desse pagamento ja expirou.
                  </div>
                )}

                {item.solicitacaoCancelamentoStatus && (
                  <div className="request-inline-status" style={{ marginTop: '0.9rem' }}>
                    <span className={`badge ${getSolicitacaoBadgeClass(item.solicitacaoCancelamentoStatus)}`}>
                      {formatSolicitacaoCancelamentoStatus(item.solicitacaoCancelamentoStatus)}
                    </span>
                    <div className="mini-copy">
                      {item.solicitacaoCancelamentoStatus === 'ABERTA' && 'Sua solicitacao foi enviada e agora esta em analise.'}
                      {item.solicitacaoCancelamentoStatus === 'APROVADA' && 'Sua solicitacao foi aprovada e o acesso desse local foi encerrado.'}
                      {item.solicitacaoCancelamentoStatus === 'NEGADA' && 'Sua solicitacao foi analisada e nao foi aprovada.'}
                    </div>
                  </div>
                )}
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
                  <>
                    {item.solicitacaoCancelamentoStatus !== 'APROVADA' ? (
                      <button className="btn btn-primary" onClick={() => navigate('/biblioteca')}>
                        Abrir biblioteca
                      </button>
                    ) : (
                      <button className="btn btn-ghost" onClick={() => navigate(`/locais/${item.localProvaSlug}`)}>
                        Ver local
                      </button>
                    )}

                    {item.podeSolicitarCancelamento && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => abrirSolicitacao(item)}
                        disabled={solicitandoId === item.id}
                      >
                        {solicitandoId === item.id ? 'Enviando...' : 'Solicitar cancelamento'}
                      </button>
                    )}
                  </>
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

      {pedidoSolicitacao && (
        <div className="request-modal-backdrop" onClick={fecharSolicitacao}>
          <div className="request-modal-card" onClick={event => event.stopPropagation()}>
            <div className="section-heading">Solicitar cancelamento</div>
            <div className="mini-copy" style={{ marginTop: '0.6rem' }}>
              Pedido {pedidoSolicitacao.referencia} - {pedidoSolicitacao.localProvaNome}
            </div>
            <div className="mini-copy">
              Esse pedido pode ser solicitado ate {formatDataHoraCurta(pedidoSolicitacao.prazoCancelamentoExpiraEm)}.
            </div>

            <label className="form-group" style={{ marginTop: '1rem' }}>
              <span className="form-label">Motivo</span>
              <select value={motivoCancelamento} onChange={event => setMotivoCancelamento(event.target.value)}>
                {MOTIVOS_CANCELAMENTO.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="form-group">
              <span className="form-label">Observacao</span>
              <textarea
                rows="4"
                placeholder="Se quiser, explique rapidamente o motivo da solicitacao."
                value={observacaoCancelamento}
                onChange={event => setObservacaoCancelamento(event.target.value)}
              />
            </label>

            <div className="request-modal-actions">
              <button className="btn btn-ghost" onClick={fecharSolicitacao}>
                Fechar
              </button>
              <button
                className="btn btn-danger"
                onClick={enviarSolicitacaoCancelamento}
                disabled={solicitandoId === pedidoSolicitacao.id}
              >
                {solicitandoId === pedidoSolicitacao.id ? 'Enviando...' : 'Confirmar solicitacao'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
