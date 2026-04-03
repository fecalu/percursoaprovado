import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  assinaturaService,
  cancelamentoService,
  pedidoService,
  usuarioAdminService,
} from '../services/api'
import { formatAssinaturaStatus } from '../utils/formatters'

const PERIOD_OPTIONS = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
]

function fmtMoeda(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((centavos || 0) / 100)
}

function formatDataHoraCompacta(valor) {
  if (!valor) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor)).replace(',', ' •')
}

function getPeriodStart(periodo) {
  const agora = new Date()
  const inicio = new Date(agora)
  inicio.setHours(0, 0, 0, 0)

  if (periodo === 'today') return inicio
  if (periodo === '7d') {
    inicio.setDate(inicio.getDate() - 6)
    return inicio
  }

  inicio.setDate(inicio.getDate() - 29)
  return inicio
}

function isOnOrAfter(valor, inicio) {
  if (!valor) return false
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return false
  return data >= inicio
}

function isPedidoComReceita(item) {
  const paymentStatus = (item.paymentStatus || '').toLowerCase()
  return item.status === 'PAGO' && paymentStatus !== 'refunded' && paymentStatus !== 'charged_back'
}

function sortByDateDesc(a, b) {
  return new Date(b.criadoEm) - new Date(a.criadoEm)
}

function getKpiDeltaLabel(periodo) {
  if (periodo === 'today') return 'no dia'
  if (periodo === '7d') return 'nos últimos 7 dias'
  return 'nos últimos 30 dias'
}

function buildTopRanking(items, getLabel) {
  return Object.values(
    items.reduce((acc, item) => {
      const label = getLabel(item)
      if (!label) return acc

      if (!acc[label]) {
        acc[label] = {
          nome: label,
          quantidade: 0,
          valorCentavos: 0,
        }
      }

      acc[label].quantidade += 1
      acc[label].valorCentavos += item.valorCentavos || 0
      return acc
    }, {})
  )
    .sort((a, b) => b.valorCentavos - a.valorCentavos || b.quantidade - a.quantidade)
    .slice(0, 5)
}

export default function AdminDashboard() {
  const [pedidos, setPedidos] = useState([])
  const [assinaturas, setAssinaturas] = useState([])
  const [cancelamentos, setCancelamentos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [resumoUsuarios, setResumoUsuarios] = useState({
    totalAlunos: 0,
    somenteCadastro: 0,
    comPedido: 0,
    comAssinatura: 0,
  })
  const [periodo, setPeriodo] = useState('7d')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      pedidoService.listarAdmin(),
      assinaturaService.listarAdmin(),
      cancelamentoService.listarAdmin(),
      usuarioAdminService.listar({ busca: '' }),
    ])
      .then(([pedidosResp, assinaturasResp, cancelamentosResp, usuariosResp]) => {
        setPedidos(pedidosResp || [])
        setAssinaturas(assinaturasResp || [])
        setCancelamentos(cancelamentosResp || [])
        setUsuarios(usuariosResp?.usuarios || [])
        setResumoUsuarios(usuariosResp?.resumo || {
          totalAlunos: 0,
          somenteCadastro: 0,
          comPedido: 0,
          comAssinatura: 0,
        })
      })
      .catch(() => {
        setErro('Não foi possível carregar o painel administrativo agora.')
      })
      .finally(() => setLoading(false))
  }, [])

  const inicioPeriodo = useMemo(() => getPeriodStart(periodo), [periodo])
  const kpiDeltaLabel = useMemo(() => getKpiDeltaLabel(periodo), [periodo])

  const pedidosPagosNoPeriodo = useMemo(
    () => pedidos.filter(item => isPedidoComReceita(item) && isOnOrAfter(item.pagoEm || item.criadoEm, inicioPeriodo)),
    [pedidos, inicioPeriodo]
  )

  const faturamentoPeriodo = useMemo(
    () => pedidosPagosNoPeriodo.reduce((acc, item) => acc + (item.valorCentavos || 0), 0),
    [pedidosPagosNoPeriodo]
  )

  const pedidosPendentesPeriodo = useMemo(
    () => pedidos.filter(item => item.status === 'PENDENTE' && isOnOrAfter(item.criadoEm, inicioPeriodo)).length,
    [pedidos, inicioPeriodo]
  )

  const cancelamentosAbertosPeriodo = useMemo(
    () => cancelamentos.filter(item => item.status === 'ABERTA' && isOnOrAfter(item.criadoEm, inicioPeriodo)).length,
    [cancelamentos, inicioPeriodo]
  )

  const novosCadastrosPeriodo = useMemo(
    () => usuarios.filter(item => isOnOrAfter(item.criadoEm, inicioPeriodo)).length,
    [usuarios, inicioPeriodo]
  )

  const pedidosPagosSemAcesso = useMemo(
    () => pedidos.filter(item => isPedidoComReceita(item) && !item.assinaturaId),
    [pedidos]
  )

  const cancelamentosEmAberto = useMemo(
    () => cancelamentos.filter(item => item.status === 'ABERTA'),
    [cancelamentos]
  )

  const assinaturasVencidas = useMemo(
    () => assinaturas.filter(item => item.status === 'EXPIRADA'),
    [assinaturas]
  )

  const assinaturasVencendo = useMemo(
    () => assinaturas.filter(item =>
      item.status === 'ATIVA'
      && item.diasRestantes !== null
      && item.diasRestantes !== undefined
      && item.diasRestantes >= 0
      && item.diasRestantes <= 7
    ),
    [assinaturas]
  )

  const ultimosPedidos = useMemo(
    () => [...pedidos].sort(sortByDateDesc).slice(0, 4),
    [pedidos]
  )

  const ultimosCadastros = useMemo(
    () => [...usuarios].sort(sortByDateDesc).slice(0, 4),
    [usuarios]
  )

  const ultimasAssinaturas = useMemo(
    () => [...assinaturas].sort(sortByDateDesc).slice(0, 4),
    [assinaturas]
  )

  const topLocais = useMemo(
    () => buildTopRanking(pedidos.filter(isPedidoComReceita), item => item.localProvaNome || 'Sem local'),
    [pedidos]
  )

  const topPlanos = useMemo(
    () => buildTopRanking(pedidos.filter(isPedidoComReceita), item => item.planoNome || 'Plano sem nome'),
    [pedidos]
  )

  if (loading) return <div className="spinner" />

  if (erro) {
    return (
      <>
        <div className="page-title">Painel administrativo</div>
        <p className="page-sub">Financeiro, acessos e operação do dia.</p>
        <div className="empty-state">{erro}</div>
      </>
    )
  }

  return (
    <>
      <div className="dashboard-head">
        <div>
          <div className="page-title">Painel administrativo</div>
          <p className="page-sub">Financeiro, acessos e operação do dia.</p>
        </div>

        <div className="dashboard-period-pills">
          {PERIOD_OPTIONS.map(opcao => (
            <button
              key={opcao.id}
              type="button"
              className={`dashboard-period-pill ${periodo === opcao.id ? 'is-active' : ''}`}
              onClick={() => setPeriodo(opcao.id)}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card dashboard-kpi-card">
          <div className="stat-label">Faturamento do período</div>
          <div className="stat-value dashboard-kpi-money">{fmtMoeda(faturamentoPeriodo)}</div>
          <div className="stat-sub">{pedidosPagosNoPeriodo.length} pagamento(s) confirmados {kpiDeltaLabel}</div>
        </div>

        <div className="stat-card dashboard-kpi-card">
          <div className="stat-label">Pedidos pendentes</div>
          <div className="stat-value">{pedidosPendentesPeriodo}</div>
          <div className="stat-sub">Checkout iniciado {kpiDeltaLabel}</div>
        </div>

        <div className="stat-card dashboard-kpi-card">
          <div className="stat-label">Cancelamentos em aberto</div>
          <div className="stat-value">{cancelamentosAbertosPeriodo}</div>
          <div className="stat-sub">Solicitações criadas {kpiDeltaLabel}</div>
        </div>

        <div className="stat-card dashboard-kpi-card">
          <div className="stat-label">Novos cadastros</div>
          <div className="stat-value">{novosCadastrosPeriodo}</div>
          <div className="stat-sub">Novos alunos {kpiDeltaLabel}</div>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--primary">
        <div className="card">
          <div className="section-title-row">
            <div>
              <div className="section-heading">O que precisa de ação</div>
              <p className="section-copy">Fila operacional para manter pagamentos, acessos e cancelamentos sob controle.</p>
            </div>
          </div>

          <div className="stack-list">
            <div className="stack-row">
              <div>
                <div className="table-name">Pagos sem acesso</div>
                <div className="mini-copy">Pedido aprovado, mas ainda sem assinatura vinculada.</div>
              </div>
              <div className="dashboard-metric-inline">
                <span className={`dashboard-action-count ${pedidosPagosSemAcesso.length ? 'is-warn' : 'is-ok'}`}>
                  {pedidosPagosSemAcesso.length}
                </span>
                <button className="dashboard-action-link" type="button" onClick={() => navigate('/admin/pedidos')}>
                  Ver pedidos
                </button>
              </div>
            </div>

            <div className="stack-row">
              <div>
                <div className="table-name">Cancelamentos aguardando análise</div>
                <div className="mini-copy">Pedidos dentro da janela de 7 dias esperando decisão.</div>
              </div>
              <div className="dashboard-metric-inline">
                <span className={`dashboard-action-count ${cancelamentosEmAberto.length ? 'is-warn' : 'is-ok'}`}>
                  {cancelamentosEmAberto.length}
                </span>
                <button className="dashboard-action-link" type="button" onClick={() => navigate('/admin/pedidos')}>
                  Analisar
                </button>
              </div>
            </div>

            <div className="stack-row">
              <div>
                <div className="table-name">Assinaturas vencidas</div>
                <div className="mini-copy">Acompanhamento de quem já perdeu acesso.</div>
              </div>
              <div className="dashboard-metric-inline">
                <span className={`dashboard-action-count ${assinaturasVencidas.length ? 'is-danger' : 'is-ok'}`}>
                  {assinaturasVencidas.length}
                </span>
                <button className="dashboard-action-link" type="button" onClick={() => navigate('/admin/assinaturas')}>
                  Ver assinaturas
                </button>
              </div>
            </div>

            <div className="stack-row">
              <div>
                <div className="table-name">Vencendo em 7 dias</div>
                <div className="mini-copy">Bom momento para ação comercial ou acompanhamento.</div>
              </div>
              <div className="dashboard-metric-inline">
                <span className={`dashboard-action-count ${assinaturasVencendo.length ? 'is-info' : 'is-muted'}`}>
                  {assinaturasVencendo.length}
                </span>
                <button className="dashboard-action-link" type="button" onClick={() => navigate('/admin/assinaturas')}>
                  Acompanhar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title-row">
            <div>
              <div className="section-heading">Movimento recente</div>
              <p className="section-copy">Últimos eventos de compra, acesso e cadastro da base.</p>
            </div>
          </div>

          <div className="dashboard-recent-groups">
            <div className="dashboard-recent-panel dashboard-recent-panel--pedidos">
              <div className="dashboard-list-title">Pedidos</div>
              <div className="stack-list dashboard-stack-compact">
                {ultimosPedidos.length === 0 ? (
                  <div className="mini-copy">Nenhum pedido recente.</div>
                ) : ultimosPedidos.map(item => (
                  <div key={item.id} className="stack-row dashboard-recent-row">
                    <div className="dashboard-recent-main">
                      <div className="table-name dashboard-recent-title">{item.localProvaNome}</div>
                      <div className="mini-copy dashboard-recent-copy">
                        {item.planoNome} • {formatDataHoraCompacta(item.criadoEm)}
                      </div>
                    </div>
                    <span className={`badge ${item.status === 'PAGO' ? 'badge-green' : item.status === 'PENDENTE' ? 'badge-warn' : 'badge-gray'}`}>
                      {item.status === 'PAGO' ? 'Pago' : item.status === 'PENDENTE' ? 'Pendente' : item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-recent-panel dashboard-recent-panel--cadastros">
              <div className="dashboard-list-title">Cadastros</div>
              <div className="stack-list dashboard-stack-compact">
                {ultimosCadastros.length === 0 ? (
                  <div className="mini-copy">Nenhum cadastro recente.</div>
                ) : ultimosCadastros.map(item => (
                  <div key={item.id} className="stack-row dashboard-recent-row">
                    <div className="dashboard-recent-main">
                      <div className="table-name dashboard-recent-title">{item.nome || 'Aluno sem nome'}</div>
                      <div className="mini-copy dashboard-recent-copy">{item.email}</div>
                    </div>
                    <span className="mini-copy dashboard-recent-time">{formatDataHoraCompacta(item.criadoEm)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-recent-panel dashboard-recent-panel--assinaturas">
              <div className="dashboard-list-title">Assinaturas</div>
              <div className="stack-list dashboard-stack-compact">
                {ultimasAssinaturas.length === 0 ? (
                  <div className="mini-copy">Nenhuma assinatura recente.</div>
                ) : ultimasAssinaturas.map(item => (
                  <div key={item.id} className="stack-row dashboard-recent-row">
                    <div className="dashboard-recent-main">
                      <div className="table-name dashboard-recent-title">{item.usuarioNome}</div>
                      <div className="mini-copy dashboard-recent-copy">
                        {item.planoNome} • {item.localProvaNome}
                      </div>
                    </div>
                    <span className={`badge ${item.status === 'ATIVA' ? 'badge-green' : item.status === 'EXPIRADA' ? 'badge-red' : 'badge-gray'}`}>
                      {formatAssinaturaStatus(item.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--secondary">
        <div className="card">
          <div className="section-title-row">
            <div>
              <div className="section-heading">Funil da base</div>
              <p className="section-copy">Leitura rápida do caminho entre cadastro, pedido e acesso liberado.</p>
            </div>
          </div>

          <div className="dashboard-funnel-list">
            <div className="dashboard-funnel-item">
              <div className="dashboard-funnel-value">{resumoUsuarios.totalAlunos}</div>
              <div className="dashboard-funnel-label">Alunos cadastrados</div>
            </div>
            <div className="dashboard-funnel-item">
              <div className="dashboard-funnel-value">{resumoUsuarios.somenteCadastro}</div>
              <div className="dashboard-funnel-label">Só cadastro</div>
            </div>
            <div className="dashboard-funnel-item">
              <div className="dashboard-funnel-value">{resumoUsuarios.comPedido}</div>
              <div className="dashboard-funnel-label">Com pedido</div>
            </div>
            <div className="dashboard-funnel-item">
              <div className="dashboard-funnel-value">{resumoUsuarios.comAssinatura}</div>
              <div className="dashboard-funnel-label">Com assinatura</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title-row">
            <div>
              <div className="section-heading">Locais com mais receita</div>
              <p className="section-copy">Pedidos pagos acumulados por local de prova.</p>
            </div>
          </div>

          <div className="stack-list dashboard-stack-compact">
            {topLocais.length === 0 ? (
              <div className="mini-copy">Nenhum local com receita registrada ainda.</div>
            ) : topLocais.map(item => (
              <div key={item.nome} className="stack-row">
                <div>
                  <div className="table-name">{item.nome}</div>
                  <div className="mini-copy">{item.quantidade} pedido(s) pagos</div>
                </div>
                <span className="badge badge-green">{fmtMoeda(item.valorCentavos)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-title-row">
            <div>
              <div className="section-heading">Planos mais vendidos</div>
              <p className="section-copy">Leitura rápida dos planos que mais convertem em receita.</p>
            </div>
          </div>

          <div className="stack-list dashboard-stack-compact">
            {topPlanos.length === 0 ? (
              <div className="mini-copy">Nenhum plano com receita registrada ainda.</div>
            ) : topPlanos.map(item => (
              <div key={item.nome} className="stack-row">
                <div>
                  <div className="table-name">{item.nome}</div>
                  <div className="mini-copy">{item.quantidade} venda(s) pagas</div>
                </div>
                <span className="badge badge-blue">{fmtMoeda(item.valorCentavos)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title-row">
          <div>
            <div className="section-heading">Acesso rápido</div>
            <p className="section-copy">Entradas diretas para as áreas que o admin tende a abrir todo dia.</p>
          </div>
        </div>

        <div className="dashboard-quick-actions">
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/pedidos')}>Pedidos</button>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/assinaturas')}>Assinaturas</button>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/usuarios')}>Usuários</button>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/percursos')}>Aulas</button>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/modulos')}>Módulos</button>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/planos')}>Planos</button>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/locais')}>Locais</button>
        </div>
      </div>
    </>
  )
}
