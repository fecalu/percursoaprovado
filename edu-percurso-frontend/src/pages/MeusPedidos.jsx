import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pedidoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import {
  formatDataCurta,
  formatDataHoraCurta,
  formatPagamentoDetalhe,
  formatPagamentoStatus,
  formatSituacaoPedido,
  formatPlanoDuracao,
  formatSolicitacaoCancelamentoStatus,
  getSituacaoPedidoBadgeClass,
  resolveSituacaoPedido,
} from '../utils/formatters'

const MOTIVOS_CANCELAMENTO = [
  'Comprei o local errado',
  'Não vou mais fazer a prova nesse local',
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

function formatResumoAluno(item) {
  const situacao = resolveSituacaoPedido(
    item.status,
    item.solicitacaoCancelamentoStatus,
    item.paymentStatus,
    item.assinaturaInicioEm
  )

  if (situacao === 'SOLICITACAO_EM_ANALISE') {
    return 'Sua solicitação foi enviada e está em análise.'
  }
  if (situacao === 'REEMBOLSO_PENDENTE') {
    return 'Sua solicitação foi aprovada. O acesso foi encerrado e o reembolso está em andamento.'
  }
  if (situacao === 'REEMBOLSADO') {
    return 'O valor foi devolvido ao seu meio de pagamento.'
  }
  if (situacao === 'ESTORNADO') {
    return 'O pagamento foi estornado pelo meio de pagamento.'
  }
  if (situacao === 'PAGAMENTO_MANTIDO') {
    return 'Sua solicitação foi negada e o acesso continua ativo.'
  }
  return ''
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
      show('Solicitação enviada com sucesso. Agora ela aparece para análise do atendimento.')
      fecharSolicitacao()
      await carregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao enviar solicitação de cancelamento.', 'error')
    } finally {
      setSolicitandoId('')
    }
  }

  const resumoOperacional = useMemo(() => {
    return pedidos.reduce((acc, item) => {
      const situacao = resolveSituacaoPedido(
        item.status,
        item.solicitacaoCancelamentoStatus,
        item.paymentStatus,
        item.assinaturaInicioEm
      )

      if (situacao === 'AGUARDANDO_PAGAMENTO') acc.aguardandoPagamento += 1
      if (situacao === 'ACESSO_LIBERADO' || situacao === 'PAGAMENTO_MANTIDO') acc.acessoAtivo += 1
      if (situacao === 'SOLICITACAO_EM_ANALISE') acc.emAnalise += 1
      if (situacao === 'REEMBOLSO_PENDENTE' || situacao === 'REEMBOLSADO' || situacao === 'ESTORNADO') {
        acc.reembolso += 1
      }
      if (situacao === 'PEDIDO_CANCELADO') acc.cancelados += 1

      return acc
    }, {
      aguardandoPagamento: 0,
      acessoAtivo: 0,
      emAnalise: 0,
      reembolso: 0,
      cancelados: 0,
    })
  }, [pedidos])

  if (loading) return <div className="spinner" />

  return (
    <>
      {ToastEl}
      <div className="student-shell student-shell--compact">
        <section className="student-library-head">
          <div>
            <div className="page-title">Meus pagamentos</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Acompanhe seus pedidos, retome pagamentos pendentes e envie solicitações de cancelamento dentro do prazo.
            </p>
          </div>

          <div className="student-kpi-strip">
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{resumoOperacional.aguardandoPagamento}</span>
              <span className="student-kpi-pill-label">Aguardando pagamento</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{resumoOperacional.acessoAtivo}</span>
              <span className="student-kpi-pill-label">Com acesso ativo</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{resumoOperacional.cancelados}</span>
              <span className="student-kpi-pill-label">Cancelados</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{resumoOperacional.reembolso + resumoOperacional.emAnalise}</span>
              <span className="student-kpi-pill-label">Reembolso</span>
            </div>
          </div>
        </section>
      </div>

      {resumoOperacional.aguardandoPagamento > 0 && (
        <div className="student-filter-card student-filter-card--inline" style={{ marginBottom: '1.5rem' }}>
          <div className="student-filter-copy-wrap">
            <div className="student-filter-title">Como liberar seu acesso</div>
            <div className="student-filter-copy">Se houver pedido pendente, o caminho continua simples e automático.</div>
          </div>
          <div className="student-help-steps">
            <div className="student-help-step">1. Clique em Pagar agora no pedido pendente.</div>
            <div className="student-help-step">2. Finalize o checkout no Mercado Pago usando Pix ou cartão.</div>
            <div className="student-help-step">3. Depois da confirmação, seu acesso aparece em Meus acessos e na Biblioteca.</div>
          </div>
        </div>
      )}

      {pedidos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Você ainda não iniciou nenhuma compra.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Ver locais de prova
            </button>
          </div>
        </div>
      ) : (
        <div className="student-stack">
          {pedidos.map(item => (
            <div key={item.id} className="student-order-card">
              <div className="student-order-main">
                <div className="student-card-top">
                  <span className={`badge ${getSituacaoPedidoBadgeClass(item.status, item.solicitacaoCancelamentoStatus, item.paymentStatus, item.assinaturaInicioEm)}`}>
                    {formatSituacaoPedido(item.status, item.solicitacaoCancelamentoStatus, item.paymentStatus, item.assinaturaInicioEm)}
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
                      <span className="student-detail-label">Solicitação</span>
                      <span className="student-detail-value">{formatSolicitacaoCancelamentoStatus(item.solicitacaoCancelamentoStatus)}</span>
                    </div>
                  )}
                </div>

                {item.status === 'PAGO' && item.podeSolicitarCancelamento && (
                  <div className="student-inline-note" style={{ marginTop: '0.9rem' }}>
                    Você pode solicitar cancelamento até {formatDataHoraCurta(item.prazoCancelamentoExpiraEm)}.
                  </div>
                )}

                {item.status === 'PAGO' && !item.podeSolicitarCancelamento && !item.solicitacaoCancelamentoStatus && item.prazoCancelamentoExpiraEm && (
                  <div className="student-inline-note" style={{ marginTop: '0.9rem' }}>
                    O prazo de 7 dias para solicitar cancelamento desse pagamento já expirou.
                  </div>
                )}

                {formatResumoAluno(item) && (
                  <div className="request-inline-status" style={{ marginTop: '0.9rem' }}>
                    {item.solicitacaoCancelamentoStatus && (
                      <span className={`badge ${getSolicitacaoBadgeClass(item.solicitacaoCancelamentoStatus)}`}>
                        {formatSolicitacaoCancelamentoStatus(item.solicitacaoCancelamentoStatus)}
                      </span>
                    )}
                    <div className="mini-copy">{formatResumoAluno(item)}</div>
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
            </div>
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
              Esse pedido pode ser solicitado até {formatDataHoraCurta(pedidoSolicitacao.prazoCancelamentoExpiraEm)}.
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
              <span className="form-label">Observação</span>
              <textarea
                rows="4"
                placeholder="Se quiser, explique rapidamente o motivo da solicitação."
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
                {solicitandoId === pedidoSolicitacao.id ? 'Enviando...' : 'Confirmar solicitação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
