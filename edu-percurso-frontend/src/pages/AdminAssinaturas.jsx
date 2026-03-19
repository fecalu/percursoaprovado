import { useEffect, useState } from 'react'
import { assinaturaService, localProvaService, planoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import {
  formatAssinaturaPagamentoStatus,
  formatAssinaturaStatus,
  formatDataHoraCurta,
  formatDiasRestantes,
  formatOrigemAssinatura,
  formatPedidoStatus,
  formatPlanoDuracao,
} from '../utils/formatters'

const FILTROS_INICIAIS = {
  busca: '',
  localId: '',
  status: 'TODOS',
  origem: 'TODOS',
  pagamento: 'TODOS',
}

const ACOES_RAPIDAS = [7, 30]

function nowLocalInputValue() {
  const agora = new Date()
  const offset = agora.getTimezoneOffset()
  return new Date(agora.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function toDateTimeLocalValue(valor) {
  if (!valor) return ''
  return String(valor).slice(0, 16)
}

function montarFormularioInicial(planoId = '') {
  return {
    usuarioEmail: '',
    planoId,
    inicioEm: nowLocalInputValue(),
    origem: 'MANUAL',
    observacaoInterna: '',
  }
}

function montarDetalheForm(detalhe) {
  return {
    fimEm: toDateTimeLocalValue(detalhe?.fimEm),
    origem: detalhe?.origem || 'MANUAL',
    observacaoInterna: detalhe?.observacaoInterna || '',
    prorrogarDias: '7',
    motivoCancelamento: '',
  }
}

function getStatusBadgeClass(status) {
  if (status === 'ATIVA') return 'badge-green'
  if (status === 'EXPIRADA') return 'badge-warn'
  if (status === 'CANCELADA') return 'badge-red'
  return 'badge-gray'
}

function getPagamentoBadgeClass(status) {
  if (status === 'PAGO') return 'badge-green'
  if (status === 'PENDENTE') return 'badge-warn'
  if (status === 'FALHOU' || status === 'REEMBOLSADO') return 'badge-red'
  return 'badge-gray'
}

function getOrigemBadgeClass(origem) {
  if (origem === 'CORTESIA') return 'badge-warn'
  if (origem === 'CHECKOUT') return 'badge-blue'
  if (origem === 'MANUAL') return 'badge-gray'
  return 'badge-gray'
}

export default function AdminAssinaturas() {
  const [assinaturas, setAssinaturas] = useState([])
  const [planos, setPlanos] = useState([])
  const [locais, setLocais] = useState([])
  const [form, setForm] = useState(montarFormularioInicial())
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const [selectedId, setSelectedId] = useState('')
  const [detalhe, setDetalhe] = useState(null)
  const [detalheForm, setDetalheForm] = useState(montarDetalheForm())
  const [loading, setLoading] = useState(true)
  const [detalheLoading, setDetalheLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false)
  const [prorrogando, setProrrogando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const { show, ToastEl } = useToast()

  async function carregarDetalhe(id) {
    if (!id) {
      setDetalhe(null)
      setDetalheForm(montarDetalheForm())
      return
    }

    setDetalheLoading(true)
    try {
      const response = await assinaturaService.detalharAdmin(id)
      setDetalhe(response)
      setDetalheForm(montarDetalheForm(response))
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao carregar detalhes do acesso.', 'error')
    } finally {
      setDetalheLoading(false)
    }
  }

  async function carregarTudo(preferSelectedId) {
    setLoading(true)
    try {
      const [assinaturasResp, planosResp, locaisResp] = await Promise.all([
        assinaturaService.listarAdmin(),
        planoService.listar({ todos: true }),
        localProvaService.listar({ todos: true }),
      ])

      setAssinaturas(assinaturasResp)
      setPlanos(planosResp)
      setLocais(locaisResp)

      setForm(current => {
        const proximoPlanoId = current.planoId || planosResp[0]?.id || ''
        return current.planoId || !planosResp[0]
          ? current
          : montarFormularioInicial(proximoPlanoId)
      })

      const aindaExisteSelecionada = selectedId && assinaturasResp.some(item => item.id === selectedId)
      const assinaturaSelecionadaId =
        preferSelectedId === null
          ? ''
          : preferSelectedId || (aindaExisteSelecionada ? selectedId : assinaturasResp[0]?.id || '')

      setSelectedId(assinaturaSelecionadaId)
      await carregarDetalhe(assinaturaSelecionadaId)
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao carregar assinaturas.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarTudo()
  }, [])

  async function selecionarAssinatura(id) {
    setSelectedId(id)
    await carregarDetalhe(id)
  }

  async function liberarAcesso(event) {
    event.preventDefault()
    setSalvando(true)

    try {
      const response = await assinaturaService.criarAdmin({
        ...form,
        inicioEm: form.inicioEm || null,
      })

      show('Acesso liberado com sucesso.')
      setForm(current => ({
        ...montarFormularioInicial(current.planoId),
        planoId: current.planoId,
        origem: current.origem,
      }))
      await carregarTudo(response.id)
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao liberar acesso.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarDetalhes(event) {
    event.preventDefault()
    if (!detalhe) return

    setSalvandoDetalhe(true)
    try {
      await assinaturaService.atualizarAdmin(detalhe.id, {
        fimEm: detalheForm.fimEm || null,
        origem: detalheForm.origem,
        observacaoInterna: detalheForm.observacaoInterna,
      })
      show('Detalhes do acesso atualizados.')
      await carregarTudo(detalhe.id)
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao atualizar acesso.', 'error')
    } finally {
      setSalvandoDetalhe(false)
    }
  }

  async function prorrogarAcesso(dias) {
    if (!detalhe) return

    const diasSelecionados = Number(dias || detalheForm.prorrogarDias)
    if (!diasSelecionados || diasSelecionados < 1) {
      show('Informe uma quantidade de dias valida para prorrogar o acesso.', 'error')
      return
    }

    setProrrogando(true)
    try {
      await assinaturaService.prorrogarAdmin(detalhe.id, {
        dias: diasSelecionados,
        observacaoInterna: detalheForm.observacaoInterna,
      })
      show(`Acesso prorrogado em ${diasSelecionados} ${diasSelecionados === 1 ? 'dia' : 'dias'}.`)
      await carregarTudo(detalhe.id)
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao prorrogar acesso.', 'error')
    } finally {
      setProrrogando(false)
    }
  }

  async function cancelarAcesso() {
    if (!detalhe) return
    if (!confirm(`Cancelar o acesso de ${detalhe.usuarioNome || detalhe.usuarioEmail}?`)) return

    setCancelando(true)
    try {
      await assinaturaService.cancelarAdmin(detalhe.id, {
        motivoCancelamento: detalheForm.motivoCancelamento,
      })
      show('Acesso cancelado com sucesso.')
      await carregarTudo(detalhe.id)
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao cancelar acesso.', 'error')
    } finally {
      setCancelando(false)
    }
  }

  const termoBusca = filtros.busca.trim().toLowerCase()
  const assinaturasFiltradas = assinaturas.filter(item => {
    if (filtros.localId && item.localProvaId !== filtros.localId) return false
    if (filtros.status !== 'TODOS' && item.status !== filtros.status) return false
    if (filtros.origem !== 'TODOS' && item.origem !== filtros.origem) return false
    if (filtros.pagamento !== 'TODOS' && item.paymentStatus !== filtros.pagamento) return false

    if (!termoBusca) return true

    const textoBusca = [
      item.usuarioNome,
      item.usuarioEmail,
      item.localProvaNome,
      item.planoNome,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return textoBusca.includes(termoBusca)
  })

  const resumo = {
    ativas: assinaturas.filter(item => item.status === 'ATIVA').length,
    expiramSeteDias: assinaturas.filter(item => item.status === 'ATIVA' && item.diasRestantes <= 7).length,
    expiradas: assinaturas.filter(item => item.status === 'EXPIRADA').length,
    canceladas: assinaturas.filter(item => item.status === 'CANCELADA').length,
    cortesiasAtivas: assinaturas.filter(item => item.status === 'ATIVA' && item.origem === 'CORTESIA').length,
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Assinaturas</div>
      <p className="page-sub">
        Gerencie o ciclo completo do acesso: liberacao manual, validade, cancelamento e vinculo com pagamento.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Acessos ativos</div>
          <div className="stat-value">{resumo.ativas}</div>
          <div className="stat-sub">Liberados agora</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expiram em 7 dias</div>
          <div className="stat-value">{resumo.expiramSeteDias}</div>
          <div className="stat-sub">Suporte preventivo</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expiradas</div>
          <div className="stat-value">{resumo.expiradas}</div>
          <div className="stat-sub">Ja sem acesso</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Canceladas</div>
          <div className="stat-value">{resumo.canceladas}</div>
          <div className="stat-sub">Encerradas manualmente</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cortesias ativas</div>
          <div className="stat-value">{resumo.cortesiasAtivas}</div>
          <div className="stat-sub">Acessos especiais</div>
        </div>
      </div>

      <div className="admin-stack-layout">
        <div className="card">
          <div className="section-title-row">
            <div>
              <div className="section-heading">Lista operacional</div>
              <p className="section-copy">
                {assinaturasFiltradas.length} {assinaturasFiltradas.length === 1 ? 'acesso encontrado' : 'acessos encontrados'}
              </p>
            </div>
          </div>

          <div className="assinaturas-filter-grid">
            <div className="form-group">
              <label className="form-label">Buscar aluno</label>
              <input
                className="form-input"
                placeholder="Nome, e-mail, plano ou local"
                value={filtros.busca}
                onChange={event => setFiltros(current => ({ ...current, busca: event.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Local de prova</label>
              <select
                className="form-select"
                value={filtros.localId}
                onChange={event => setFiltros(current => ({ ...current, localId: event.target.value }))}
              >
                <option value="">Todos os locais</option>
                {locais.map(local => (
                  <option key={local.id} value={local.id}>
                    {local.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Status do acesso</label>
              <select
                className="form-select"
                value={filtros.status}
                onChange={event => setFiltros(current => ({ ...current, status: event.target.value }))}
              >
                <option value="TODOS">Todos</option>
                <option value="ATIVA">Ativo</option>
                <option value="EXPIRADA">Expirado</option>
                <option value="CANCELADA">Cancelado</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Origem</label>
              <select
                className="form-select"
                value={filtros.origem}
                onChange={event => setFiltros(current => ({ ...current, origem: event.target.value }))}
              >
                <option value="TODOS">Todas</option>
                <option value="CHECKOUT">Checkout</option>
                <option value="MANUAL">Manual</option>
                <option value="CORTESIA">Cortesia</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Pagamento</label>
              <select
                className="form-select"
                value={filtros.pagamento}
                onChange={event => setFiltros(current => ({ ...current, pagamento: event.target.value }))}
              >
                <option value="TODOS">Todos</option>
                <option value="PAGO">Pago</option>
                <option value="PENDENTE">Pendente</option>
                <option value="FALHOU">Falhou</option>
                <option value="REEMBOLSADO">Reembolsado</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="spinner" />
          ) : assinaturasFiltradas.length === 0 ? (
            <div className="empty-state">Nenhum acesso encontrado com os filtros atuais.</div>
          ) : (
            <div className="table-wrap" style={{ marginTop: '1rem' }}>
              <div className="table-head assinaturas-table-head">
                <div>Aluno</div>
                <div>Local e plano</div>
                <div>Validade</div>
                <div>Origem</div>
                <div>Situacao</div>
                <div>Abrir</div>
              </div>

              {assinaturasFiltradas.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`table-row assinaturas-table-row table-button-row ${selectedId === item.id ? 'is-selected' : ''}`}
                  onClick={() => selecionarAssinatura(item.id)}
                >
                  <div>
                    <div className="table-name">{item.usuarioNome || 'Aluno sem nome'}</div>
                    <div className="mini-copy">{item.usuarioEmail}</div>
                  </div>

                  <div>
                    <div className="table-name">{item.localProvaNome}</div>
                    <div className="mini-copy">
                      {item.planoNome} - {formatPlanoDuracao(item.duracaoDias)}
                    </div>
                  </div>

                  <div>
                    <div className="table-name">{formatDataHoraCurta(item.fimEm)}</div>
                    <div className="mini-copy">
                      Inicio {formatDataHoraCurta(item.inicioEm)} - {formatDiasRestantes(item.diasRestantes, item.status)}
                    </div>
                  </div>

                  <div>
                    <span className={`badge ${getOrigemBadgeClass(item.origem)}`}>
                      {formatOrigemAssinatura(item.origem)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                    <span className={`badge ${getStatusBadgeClass(item.status)}`}>
                      {formatAssinaturaStatus(item.status)}
                    </span>
                    <span className={`badge ${getPagamentoBadgeClass(item.paymentStatus)}`}>
                      {formatAssinaturaPagamentoStatus(item.paymentStatus)}
                    </span>
                  </div>

                  <div className="table-name" style={{ color: 'var(--accent)' }}>Detalhes</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title-row">
            <div>
              <div className="section-heading">Detalhes do acesso</div>
              <p className="section-copy">Ajuste validade, acompanhe pagamento e registre observacoes.</p>
            </div>
            {selectedId && (
              <button className="btn btn-ghost" type="button" onClick={() => carregarDetalhe(selectedId)}>
                Atualizar
              </button>
            )}
          </div>

          {!selectedId ? (
            <div className="empty-state" style={{ padding: '2.5rem 1rem 1rem' }}>
              Selecione um acesso na lista para ver os detalhes.
            </div>
          ) : detalheLoading ? (
            <div className="spinner" />
          ) : detalhe ? (
            <>
              <div className="assinatura-detail-grid">
                <div className="player-meta-card">
                  <div className="player-meta-label">Aluno</div>
                  <div className="player-meta-value">{detalhe.usuarioNome || 'Aluno sem nome'}</div>
                  <div className="mini-copy">{detalhe.usuarioEmail}</div>
                </div>
                <div className="player-meta-card">
                  <div className="player-meta-label">Local e plano</div>
                  <div className="player-meta-value">{detalhe.localProvaNome}</div>
                  <div className="mini-copy">
                    {detalhe.planoNome} - {formatPlanoDuracao(detalhe.duracaoDias)}
                  </div>
                </div>
                <div className="player-meta-card">
                  <div className="player-meta-label">Validade</div>
                  <div className="player-meta-value">{formatDataHoraCurta(detalhe.fimEm)}</div>
                  <div className="mini-copy">
                    Inicio em {formatDataHoraCurta(detalhe.inicioEm)} - {formatDiasRestantes(detalhe.diasRestantes, detalhe.status)}
                  </div>
                </div>
                <div className="player-meta-card">
                  <div className="player-meta-label">Situacao</div>
                  <div className="player-meta-value" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <span className={`badge ${getStatusBadgeClass(detalhe.status)}`}>
                      {formatAssinaturaStatus(detalhe.status)}
                    </span>
                    <span className={`badge ${getPagamentoBadgeClass(detalhe.paymentStatus)}`}>
                      {formatAssinaturaPagamentoStatus(detalhe.paymentStatus)}
                    </span>
                  </div>
                  <div className="mini-copy">
                    Origem {formatOrigemAssinatura(detalhe.origem)}
                  </div>
                </div>
                <div className="player-meta-card">
                  <div className="player-meta-label">Pedido vinculado</div>
                  <div className="player-meta-value">
                    {detalhe.pedidoReferencia || detalhe.pedidoId || 'Sem pedido vinculado'}
                  </div>
                  <div className="mini-copy">
                    {detalhe.pedidoStatus ? formatPedidoStatus(detalhe.pedidoStatus) : 'Criado manualmente'}
                  </div>
                </div>
                <div className="player-meta-card">
                  <div className="player-meta-label">Gateway</div>
                  <div className="player-meta-value">{detalhe.paymentId || 'Sem payment ID'}</div>
                  <div className="mini-copy">
                    {detalhe.gatewayPaymentStatus || 'Sem atualizacao do gateway'}
                    {detalhe.gatewayPaymentStatusDetail ? ` - ${detalhe.gatewayPaymentStatusDetail}` : ''}
                  </div>
                </div>
              </div>

              {detalhe.canceladaEm && (
                <div className="mini-copy" style={{ marginTop: '1rem' }}>
                  Cancelada em {formatDataHoraCurta(detalhe.canceladaEm)}
                  {detalhe.canceladaPorEmail ? ` por ${detalhe.canceladaPorEmail}` : ''}
                  {detalhe.motivoCancelamento ? ` - ${detalhe.motivoCancelamento}` : ''}
                </div>
              )}

              <form onSubmit={salvarDetalhes} style={{ marginTop: '1.25rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nova data final</label>
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={detalheForm.fimEm}
                      onChange={event => setDetalheForm(current => ({ ...current, fimEm: event.target.value }))}
                      disabled={detalhe.status === 'CANCELADA'}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Origem do acesso</label>
                    <select
                      className="form-select"
                      value={detalheForm.origem}
                      onChange={event => setDetalheForm(current => ({ ...current, origem: event.target.value }))}
                    >
                      <option value="CHECKOUT">Checkout</option>
                      <option value="MANUAL">Manual</option>
                      <option value="CORTESIA">Cortesia</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Observacao interna</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Informacoes de suporte, cortesia, ajuste de prazo ou contexto financeiro."
                    value={detalheForm.observacaoInterna}
                    onChange={event => setDetalheForm(current => ({ ...current, observacaoInterna: event.target.value }))}
                  />
                </div>

                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={salvandoDetalhe}>
                    {salvandoDetalhe ? 'Salvando...' : 'Salvar detalhes'}
                  </button>
                </div>
              </form>

              <div className="card" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg3)' }}>
                <div className="section-heading" style={{ fontSize: 16 }}>Validade</div>
                <p className="section-copy">Prorrogue rapidamente ou informe uma quantidade personalizada de dias.</p>

                <div className="form-actions" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
                  {ACOES_RAPIDAS.map(dias => (
                    <button
                      key={dias}
                      className="btn btn-ghost"
                      type="button"
                      disabled={prorrogando || detalhe.status === 'CANCELADA'}
                      onClick={() => prorrogarAcesso(dias)}
                    >
                      +{dias} dias
                    </button>
                  ))}
                </div>

                <div className="form-row" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Prorrogar manualmente</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      value={detalheForm.prorrogarDias}
                      onChange={event => setDetalheForm(current => ({ ...current, prorrogarDias: event.target.value }))}
                      disabled={detalhe.status === 'CANCELADA'}
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={prorrogando || detalhe.status === 'CANCELADA'}
                      onClick={() => prorrogarAcesso()}
                    >
                      {prorrogando ? 'Prorrogando...' : 'Aplicar prorroga'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(224,85,85,0.08)' }}>
                <div className="section-heading" style={{ fontSize: 16 }}>Cancelar acesso</div>
                <p className="section-copy">Encerre o acesso manualmente e registre o motivo para o historico interno.</p>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">Motivo do cancelamento</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Ex.: reembolso aprovado, duplicidade de acesso, erro operacional."
                    value={detalheForm.motivoCancelamento}
                    onChange={event => setDetalheForm(current => ({ ...current, motivoCancelamento: event.target.value }))}
                    disabled={detalhe.status === 'CANCELADA'}
                  />
                </div>

                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={cancelando || detalhe.status === 'CANCELADA'}
                  onClick={cancelarAcesso}
                >
                  {cancelando ? 'Cancelando...' : detalhe.status === 'CANCELADA' ? 'Acesso cancelado' : 'Cancelar acesso'}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: '2.5rem 1rem 1rem' }}>
              Nao foi possivel carregar os detalhes deste acesso.
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-heading">Liberar acesso</div>
          <p className="section-copy">Crie um acesso manual ou de cortesia para um aluno ja cadastrado.</p>

          <form onSubmit={liberarAcesso} style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">E-mail do aluno</label>
              <input
                className="form-input"
                type="email"
                value={form.usuarioEmail}
                onChange={event => setForm(current => ({ ...current, usuarioEmail: event.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Plano</label>
              <select
                className="form-select"
                value={form.planoId}
                onChange={event => setForm(current => ({ ...current, planoId: event.target.value }))}
                required
              >
                <option value="">Selecione um plano</option>
                {planos.map(plano => (
                  <option key={plano.id} value={plano.id}>
                    {plano.localProvaNome} - {plano.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Inicio do acesso</label>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={form.inicioEm}
                  onChange={event => setForm(current => ({ ...current, inicioEm: event.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Origem</label>
                <select
                  className="form-select"
                  value={form.origem}
                  onChange={event => setForm(current => ({ ...current, origem: event.target.value }))}
                >
                  <option value="MANUAL">Manual</option>
                  <option value="CORTESIA">Cortesia</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observacao interna</label>
              <textarea
                className="form-textarea"
                placeholder="Ex.: liberado pelo suporte para reposicao de prazo."
                value={form.observacaoInterna}
                onChange={event => setForm(current => ({ ...current, observacaoInterna: event.target.value }))}
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={salvando}>
              {salvando ? 'Liberando...' : 'Liberar acesso'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
