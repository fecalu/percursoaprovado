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
      } else {
        await cancelamentoService.negar(solicitacaoAtiva.id, { observacaoAdmin })
        show('Solicitacao negada com sucesso.')
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

  const pendentes = useMemo(() => pedidos.filter(item => item.status === 'PENDENTE'), [pedidos])
  const pagos = useMemo(() => pedidos.filter(item => item.status === 'PAGO'), [pedidos])
  const cancelados = useMemo(() => pedidos.filter(item => item.status === 'CANCELADO'), [pedidos])
  const solicitacoesAbertas = useMemo(
    () => solicitacoes.filter(item => item.status === 'ABERTA' || item.status === 'ERRO_PROCESSAMENTO'),
    [solicitacoes]
  )
  const solicitacoesAprovadas = useMemo(() => solicitacoes.filter(item => item.status === 'APROVADA'), [solicitacoes])
  const solicitacoesNegadas = useMemo(() => solicitacoes.filter(item => item.status === 'NEGADA'), [solicitacoes])
  const historicoSolicitacoes = useMemo(
    () => solicitacoes.filter(item => item.status === 'APROVADA' || item.status === 'NEGADA'),
    [solicitacoes]
  )

  return (
    <>
      {ToastEl}
      <div className="page-title">Pedidos e pagamentos</div>
      <p className="page-sub">Acompanhe a aprovacao dos pagamentos e analise solicitacoes de cancelamento dentro da regra de 7 dias.</p>

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
        <div className="stat-card">
          <div className="stat-label">Solicitacoes abertas</div>
          <div className="stat-value">{solicitacoesAbertas.length}</div>
          <div className="stat-sub">aguardando analise</div>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : (
        <>
          <div className="student-filter-card" style={{ marginBottom: '1.5rem' }}>
            <div className="section-heading">Solicitacoes de cancelamento e reembolso</div>
            <div className="mini-copy" style={{ marginTop: '0.75rem' }}>
              O aluno so consegue abrir a solicitacao em ate 7 dias apos a confirmacao do pagamento. A aprovacao aqui cancela o acesso no sistema; o reembolso do gateway continua manual por enquanto.
            </div>
            <div className="student-kpi-grid student-kpi-grid--compact" style={{ marginTop: '1rem' }}>
              <div className="student-kpi-card">
                <div className="student-kpi-label">Em analise</div>
                <div className="student-kpi-value">{solicitacoesAbertas.length}</div>
              </div>
              <div className="student-kpi-card">
                <div className="student-kpi-label">Aprovadas</div>
                <div className="student-kpi-value">{solicitacoesAprovadas.length}</div>
              </div>
              <div className="student-kpi-card">
                <div className="student-kpi-label">Negadas</div>
                <div className="student-kpi-value">{solicitacoesNegadas.length}</div>
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
                    Solicitações já processadas saem da fila principal e ficam registradas aqui.
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
                        <span className={`badge ${getSolicitacaoBadgeClass(item.status)}`}>
                          {formatSolicitacaoCancelamentoStatus(item.status)}
                        </span>
                        <div className="mini-copy">
                          {item.processadoEm ? `Processado em ${formatDataHoraCurta(item.processadoEm)}` : 'Sem data de processamento'}
                        </div>
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
                    <span className={`badge ${getSituacaoPedidoBadgeClass(item.status, item.solicitacaoCancelamentoStatus, item.paymentStatus)}`}>
                      {formatSituacaoPedido(item.status, item.solicitacaoCancelamentoStatus, item.paymentStatus)}
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
                      <span className="mini-copy">
                        {item.status === 'PAGO' ? `Acesso liberado em ${formatDataCurta(item.pagoEm)}` : 'Sem acao disponivel'}
                      </span>
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
              {acaoSolicitacao === 'APROVAR' ? 'Aprovar solicitacao' : 'Negar solicitacao'}
            </div>
            <div className="mini-copy" style={{ marginTop: '0.6rem' }}>
              {solicitacaoAtiva.usuarioNome} - {solicitacaoAtiva.localProvaNome}
            </div>
            <div className="mini-copy">Pedido: {solicitacaoAtiva.pedidoReferencia}</div>
            {solicitacaoAtiva.paymentId && <div className="mini-copy">ID do pagamento: {solicitacaoAtiva.paymentId}</div>}
            <div className="mini-copy">Motivo informado: {solicitacaoAtiva.motivo}</div>
            {acaoSolicitacao === 'APROVAR' && (
              <div className="mini-copy">
                Ao aprovar, o acesso desse local sera cancelado no sistema e o reembolso segue para tratamento manual.
              </div>
            )}

            <label className="form-group" style={{ marginTop: '1rem' }}>
              <span className="form-label">Observacao interna</span>
              <textarea
                rows="4"
                placeholder={acaoSolicitacao === 'APROVAR' ? 'Ex.: reembolso combinado pelo atendimento.' : 'Explique resumidamente por que a solicitacao foi negada.'}
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
                className={acaoSolicitacao === 'APROVAR' ? 'btn btn-primary' : 'btn btn-danger'}
                onClick={processarSolicitacao}
                disabled={processandoId === solicitacaoAtiva.id}
              >
                {processandoId === solicitacaoAtiva.id
                  ? 'Processando...'
                  : acaoSolicitacao === 'APROVAR'
                    ? 'Confirmar aprovacao'
                    : 'Confirmar negativa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
