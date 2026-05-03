import { useEffect, useMemo, useState } from 'react'
import { cancelamentoService, pedidoService } from '../services/api'
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

function CopyPaymentButton({ paymentId, onCopy }) {
  if (!paymentId) return null

  return (
    <button
      className="btn btn-ghost"
      style={{ padding: '6px 10px', fontSize: 12 }}
      onClick={() => onCopy(paymentId)}
      type="button"
    >
      Copiar ID
    </button>
  )
}

function formatResultadoSolicitacao(item) {
  if (item.paymentStatus === 'refunded') return 'Reembolsado'
  if (item.paymentStatus === 'charged_back') return 'Estornado'
  if (item.status === 'APROVADA') return 'Reembolso pendente'
  if (item.status === 'NEGADA') return 'Solicitacao negada'
  return formatSolicitacaoCancelamentoStatus(item.status)
}

function getResultadoSolicitacaoBadgeClass(item) {
  if (item.paymentStatus === 'refunded' || item.paymentStatus === 'charged_back') return 'badge-blue'
  if (item.status === 'APROVADA') return 'badge-blue'
  if (item.status === 'NEGADA') return 'badge-red'
  return getSolicitacaoBadgeClass(item.status)
}

function formatResumoAdminPedido(item) {
  const situacao = resolveSituacaoPedido(
    item.status,
    item.solicitacaoCancelamentoStatus,
    item.paymentStatus,
    item.assinaturaInicioEm
  )

  if (situacao === 'AGUARDANDO_PAGAMENTO') return 'Pedido ainda aguardando pagamento.'
  if (situacao === 'RENOVACAO_AGENDADA') return `Renovacao agendada para ${formatDataCurta(item.assinaturaInicioEm)}.`
  if (situacao === 'ACESSO_LIBERADO') return `Acesso liberado em ${formatDataCurta(item.pagoEm)}.`
  if (situacao === 'SOLICITACAO_EM_ANALISE') return 'Aguardando decisao do atendimento.'
  if (situacao === 'REEMBOLSO_PENDENTE') return 'Proximo passo: fazer o reembolso manual no Mercado Pago.'
  if (situacao === 'REEMBOLSADO') return 'Valor devolvido ao cliente.'
  if (situacao === 'ESTORNADO') return 'Pagamento estornado pelo gateway.'
  if (situacao === 'PAGAMENTO_MANTIDO') return 'Solicitacao negada; acesso mantido.'
  if (situacao === 'PEDIDO_CANCELADO') return 'Pedido encerrado antes do pagamento.'
  return 'Sem acao disponivel.'
}

function formatResumoHistorico(item) {
  if (item.reembolsadoEm) {
    return `Reembolsado em ${formatDataHoraCurta(item.reembolsadoEm)}`
  }
  if (item.processadoEm) {
    return `Processado em ${formatDataHoraCurta(item.processadoEm)}`
  }
  return 'Sem data de processamento'
}

function podeMarcarReembolsado(item) {
  return item.status === 'APROVADA' && item.paymentStatus !== 'refunded' && item.paymentStatus !== 'charged_back'
}

export default function AdminPedidos() {
  const { show, ToastEl } = useToast()
  const [pedidos, setPedidos] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [processandoId, setProcessandoId] = useState('')
  const [solicitacaoAtiva, setSolicitacaoAtiva] = useState(null)
  const [acaoSolicitacao, setAcaoSolicitacao] = useState('APROVAR')
  const [observacaoAdmin, setObservacaoAdmin] = useState('')
  const [historicoVisivel, setHistoricoVisivel] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    try {
      const [pedidosResp, solicitacoesResp] = await Promise.all([
        pedidoService.listarAdmin(),
        cancelamentoService.listarAdmin(),
      ])
      setPedidos(pedidosResp)
      setSolicitacoes(solicitacoesResp)
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

  function abrirProcessamentoSolicitacao(item, acao) {
    setSolicitacaoAtiva(item)
    setAcaoSolicitacao(acao)
    setObservacaoAdmin('')
  }

  function fecharProcessamentoSolicitacao() {
    setSolicitacaoAtiva(null)
    setAcaoSolicitacao('APROVAR')
    setObservacaoAdmin('')
  }

  async function processarSolicitacao() {
    if (!solicitacaoAtiva) return

    setProcessandoId(solicitacaoAtiva.id)
    try {
      if (acaoSolicitacao === 'APROVAR') {
        await cancelamentoService.aprovar(solicitacaoAtiva.id, { observacaoAdmin })
        show('Solicitacao aprovada. O acesso desse local foi encerrado no sistema.')
      } else if (acaoSolicitacao === 'NEGAR') {
        await cancelamentoService.negar(solicitacaoAtiva.id, { observacaoAdmin })
        show('Solicitacao negada com sucesso.')
      } else {
        await cancelamentoService.marcarReembolsado(solicitacaoAtiva.id, { observacaoAdmin })
        show('Reembolso marcado como concluido no sistema.')
      }
      fecharProcessamentoSolicitacao()
      await carregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao processar solicitacao.', 'error')
    } finally {
      setProcessandoId('')
    }
  }

  async function copiarPaymentId(paymentId) {
    try {
      await navigator.clipboard.writeText(paymentId)
      show('ID do pagamento copiado.')
    } catch {
      show('Nao foi possivel copiar o ID do pagamento.', 'error')
    }
  }

  const solicitacoesAbertas = useMemo(
    () => solicitacoes.filter(item => item.status === 'ABERTA' || item.status === 'ERRO_PROCESSAMENTO'),
    [solicitacoes]
  )
  const solicitacoesNegadas = useMemo(() => solicitacoes.filter(item => item.status === 'NEGADA'), [solicitacoes])
  const historicoSolicitacoes = useMemo(
    () => solicitacoes.filter(item => item.status === 'APROVADA' || item.status === 'NEGADA'),
    [solicitacoes]
  )
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
      if (situacao === 'REEMBOLSO_PENDENTE') acc.reembolsoPendente += 1
      if (situacao === 'REEMBOLSADO' || situacao === 'ESTORNADO') acc.finalizadosNoGateway += 1

      return acc
    }, {
      aguardandoPagamento: 0,
      acessoAtivo: 0,
      emAnalise: 0,
      reembolsoPendente: 0,
      finalizadosNoGateway: 0,
    })
  }, [pedidos])

  return (
    <>
      {ToastEl}
      <div className="page-title">Pedidos e pagamentos</div>
      <p className="page-sub">Acompanhe a aprovacao dos pagamentos e analise solicitacoes de cancelamento dentro da regra de 7 dias.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Aguardando pagamento</div>
          <div className="stat-value">{resumoOperacional.aguardandoPagamento}</div>
          <div className="stat-sub">checkout iniciado</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Com acesso ativo</div>
          <div className="stat-value">{resumoOperacional.acessoAtivo}</div>
          <div className="stat-sub">sem reembolso em andamento</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Em analise</div>
          <div className="stat-value">{resumoOperacional.emAnalise}</div>
          <div className="stat-sub">aguardando decisao</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Reembolso pendente</div>
          <div className="stat-value">{resumoOperacional.reembolsoPendente}</div>
          <div className="stat-sub">aprovado no sistema</div>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : (
        <>
          <div className="student-filter-card request-summary-card" style={{ marginBottom: '1.5rem' }}>
            <div className="request-summary-head">
              <div>
                <div className="section-heading">Solicitacoes de cancelamento e reembolso</div>
                <div className="mini-copy request-summary-copy">
                  Aprovar encerra o acesso no sistema. Depois, use o ID do pagamento para devolver o valor no Mercado Pago.
                </div>
              </div>
              <div className="request-summary-metrics">
                <div className="request-summary-pill">
                  <span className="request-summary-pill-label">Em analise</span>
                  <strong>{solicitacoesAbertas.length}</strong>
                </div>
                <div className="request-summary-pill">
                  <span className="request-summary-pill-label">Reembolso pendente</span>
                  <strong>{resumoOperacional.reembolsoPendente}</strong>
                </div>
                <div className="request-summary-pill">
                  <span className="request-summary-pill-label">Negadas</span>
                  <strong>{solicitacoesNegadas.length}</strong>
                </div>
              </div>
            </div>
          </div>

          {solicitacoesAbertas.length === 0 ? (
            <div className="student-filter-card request-empty-card" style={{ marginBottom: '1.5rem' }}>
              <div className="section-heading">Solicitacoes pendentes de cancelamento</div>
              <div className="mini-copy" style={{ marginTop: '0.7rem' }}>
                Nenhuma solicitacao pendente no momento.
              </div>
            </div>
          ) : (
            <div className="request-admin-grid" style={{ marginBottom: '1.75rem' }}>
              {solicitacoesAbertas.map(item => (
                <div key={item.id} className="request-admin-card">
                  <div className="request-kind">Solicitacao de cancelamento/reembolso</div>
                  <div className="student-card-top">
                    <span className={`badge ${getSolicitacaoBadgeClass(item.status)}`}>
                      {formatSolicitacaoCancelamentoStatus(item.status)}
                    </span>
                    <span className="student-card-copy">{fmtMoeda(item.valorCentavos)}</span>
                  </div>
                  <div className="student-card-title">{item.localProvaNome}</div>
                  <div className="student-card-copy">{item.planoNome}</div>
                  <div className="student-detail-list">
                    <div className="student-detail-item">
                      <span className="student-detail-label">Aluno</span>
                      <span className="student-detail-value">{item.usuarioNome} - {item.usuarioEmail}</span>
                    </div>
                    <div className="student-detail-item">
                      <span className="student-detail-label">Motivo</span>
                      <span className="student-detail-value">{item.motivo}</span>
                    </div>
                    <div className="student-detail-item">
                      <span className="student-detail-label">Pedido</span>
                      <span className="student-detail-value">{item.pedidoReferencia}</span>
                    </div>
                    {item.paymentId && (
                      <div className="student-detail-item">
                        <span className="student-detail-label">ID do pagamento</span>
                        <span className="student-detail-value">{item.paymentId}</span>
                      </div>
                    )}
                    {item.paymentStatus && (
                      <div className="student-detail-item">
                        <span className="student-detail-label">Status do pagamento</span>
                        <span className="student-detail-value">{formatPagamentoStatus(item.paymentStatus)}</span>
                      </div>
                    )}
                    <div className="student-detail-item">
                      <span className="student-detail-label">Pago em</span>
                      <span className="student-detail-value">{formatDataHoraCurta(item.pagoEm)}</span>
                    </div>
                    <div className="student-detail-item">
                      <span className="student-detail-label">Solicitado em</span>
                      <span className="student-detail-value">{formatDataHoraCurta(item.criadoEm)}</span>
                    </div>
                    {item.observacaoAluno && (
                      <div className="student-detail-item">
                        <span className="student-detail-label">Observacao do aluno</span>
                        <span className="student-detail-value">{item.observacaoAluno}</span>
                      </div>
                    )}
                    {item.observacaoAdmin && (
                      <div className="student-detail-item">
                        <span className="student-detail-label">Observacao interna</span>
                        <span className="student-detail-value">{item.observacaoAdmin}</span>
                      </div>
                    )}
                  </div>
                  <div className="student-card-actions">
                    {item.status === 'ABERTA' ? (
                      <>
                        <CopyPaymentButton paymentId={item.paymentId} onCopy={copiarPaymentId} />
                        <button className="btn btn-primary" onClick={() => abrirProcessamentoSolicitacao(item, 'APROVAR')}>
                          Aprovar
                        </button>
                        <button className="btn btn-danger" onClick={() => abrirProcessamentoSolicitacao(item, 'NEGAR')}>
                          Negar
                        </button>
                      </>
                    ) : (
                      <span className="mini-copy">
                        {item.processadoEm ? `Processado em ${formatDataHoraCurta(item.processadoEm)}` : 'Sem acao disponivel'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {historicoSolicitacoes.length > 0 && (
            <div className="student-filter-card" style={{ marginBottom: '1.5rem' }}>
              <div className="request-history-head">
                <div>
                  <div className="section-heading">Historico de solicitacoes</div>
                  <div className="mini-copy" style={{ marginTop: '0.45rem' }}>
                    Solicitacoes ja processadas saem da fila principal e ficam registradas aqui.
                  </div>
                </div>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setHistoricoVisivel(valor => !valor)}
                >
                  {historicoVisivel ? 'Ocultar historico' : 'Ver historico'}
                </button>
              </div>

              {historicoVisivel && (
                <div className="request-history-list">
                  {historicoSolicitacoes.map(item => (
                    <div key={item.id} className="request-history-row">
                      <div>
                        <div className="table-name">{item.localProvaNome}</div>
                        <div className="request-kind request-kind--inline">Solicitacao de cancelamento/reembolso</div>
                        <div className="mini-copy">{item.usuarioNome} - {item.usuarioEmail}</div>
                        <div className="mini-copy">Pedido {item.pedidoReferencia}{item.paymentId ? ` | ID ${item.paymentId}` : ''}</div>
                      </div>
                      <div className="request-history-meta">
                        <span className={`badge ${getResultadoSolicitacaoBadgeClass(item)}`}>
                          {formatResultadoSolicitacao(item)}
                        </span>
                        <div className="mini-copy">{formatResumoHistorico(item)}</div>
                        {podeMarcarReembolsado(item) && (
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => abrirProcessamentoSolicitacao(item, 'REEMBOLSAR')}
                          >
                            Marcar reembolsado
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {pedidos.length === 0 ? (
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
                    {item.solicitacaoCancelamentoStatus && (
                      <div className="mini-copy">
                        Solicitacao de cancelamento/reembolso: {formatSolicitacaoCancelamentoStatus(item.solicitacaoCancelamentoStatus)}
                      </div>
                    )}
                  </div>
                  <span className="table-cat">{item.referencia}</span>
                  <span className="table-dur">{fmtMoeda(item.valorCentavos)}</span>
                  <span>
                    <span className={`badge ${getSituacaoPedidoBadgeClass(item.status, item.solicitacaoCancelamentoStatus, item.paymentStatus, item.assinaturaInicioEm)}`}>
                      {formatSituacaoPedido(item.status, item.solicitacaoCancelamentoStatus, item.paymentStatus, item.assinaturaInicioEm)}
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
                      <span className="mini-copy">{formatResumoAdminPedido(item)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {solicitacaoAtiva && (
        <div className="request-modal-backdrop" onClick={fecharProcessamentoSolicitacao}>
          <div className="request-modal-card" onClick={event => event.stopPropagation()}>
            <div className="request-kind">Solicitacao de cancelamento/reembolso</div>
            <div className="section-heading">
              {acaoSolicitacao === 'APROVAR'
                ? 'Aprovar solicitacao'
                : acaoSolicitacao === 'NEGAR'
                  ? 'Negar solicitacao'
                  : 'Marcar reembolso concluido'}
            </div>
            <div className="mini-copy" style={{ marginTop: '0.6rem' }}>
              {solicitacaoAtiva.usuarioNome} - {solicitacaoAtiva.localProvaNome}
            </div>
            <div className="mini-copy">Pedido: {solicitacaoAtiva.pedidoReferencia}</div>
            {solicitacaoAtiva.paymentId && <div className="mini-copy">ID do pagamento: {solicitacaoAtiva.paymentId}</div>}
            <div className="mini-copy">Motivo informado: {solicitacaoAtiva.motivo}</div>
            {acaoSolicitacao === 'APROVAR' && (
              <div className="mini-copy">
                Ao aprovar, o acesso desse local sera cancelado no sistema. Em seguida, faca o reembolso manual no Mercado Pago usando o ID do pagamento acima.
              </div>
            )}
            {acaoSolicitacao === 'REEMBOLSAR' && (
              <div className="mini-copy">
                Use esta opcao depois de concluir a devolucao no Mercado Pago. Isso atualiza o pedido para o status Reembolsado no sistema.
              </div>
            )}

            <label className="form-group" style={{ marginTop: '1rem' }}>
              <span className="form-label">Observacao interna</span>
              <textarea
                rows="4"
                placeholder={
                  acaoSolicitacao === 'APROVAR'
                    ? 'Ex.: reembolso combinado pelo atendimento.'
                    : acaoSolicitacao === 'NEGAR'
                      ? 'Explique resumidamente por que a solicitacao foi negada.'
                      : 'Ex.: reembolso feito no Mercado Pago em 19/03 as 11:30.'
                }
                value={observacaoAdmin}
                onChange={event => setObservacaoAdmin(event.target.value)}
              />
            </label>

            <div className="request-modal-actions">
              <CopyPaymentButton paymentId={solicitacaoAtiva.paymentId} onCopy={copiarPaymentId} />
              <button className="btn btn-ghost" onClick={fecharProcessamentoSolicitacao}>
                Fechar
              </button>
              <button
                className={acaoSolicitacao === 'NEGAR' ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={processarSolicitacao}
                disabled={processandoId === solicitacaoAtiva.id}
              >
                {processandoId === solicitacaoAtiva.id
                  ? 'Processando...'
                  : acaoSolicitacao === 'APROVAR'
                    ? 'Confirmar aprovacao'
                    : acaoSolicitacao === 'NEGAR'
                      ? 'Confirmar negativa'
                      : 'Confirmar reembolso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
