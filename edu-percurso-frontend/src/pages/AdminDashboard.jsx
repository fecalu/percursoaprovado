import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assinaturaService, localProvaService, pedidoService, percursoService, planoService } from '../services/api'
import { formatTipoConteudo } from '../utils/formatters'

export default function AdminDashboard() {
  const [percursos, setPercursos] = useState([])
  const [locais, setLocais] = useState([])
  const [planos, setPlanos] = useState([])
  const [assinaturas, setAssinaturas] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      percursoService.listar(true),
      localProvaService.listar({ todos: true }),
      planoService.listar({ todos: true }),
      assinaturaService.listarAdmin(),
      pedidoService.listarAdmin(),
    ])
      .then(([percursosResp, locaisResp, planosResp, assinaturasResp, pedidosResp]) => {
        setPercursos(percursosResp)
        setLocais(locaisResp)
        setPlanos(planosResp)
        setAssinaturas(assinaturasResp)
        setPedidos(pedidosResp)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner" />

  const conteudosAtivos = percursos.filter(item => item.ativo).length
  const locaisAtivos = locais.filter(item => item.ativo).length
  const planosAtivos = planos.filter(item => item.ativo).length
  const assinaturasAtivas = assinaturas.filter(item => item.status === 'ATIVA' && item.paymentStatus === 'PAGO').length
  const pedidosPendentes = pedidos.filter(item => item.status === 'PENDENTE').length
  const conteudosGerais = percursos.filter(item => !item.localProvaId).length
  const recentes = [...percursos]
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
    .slice(0, 5)
  const resumoPorLocal = Object.entries(
    percursos
      .filter(item => item.localProvaNome)
      .reduce((acc, item) => {
        acc[item.localProvaNome] = (acc[item.localProvaNome] || 0) + 1
        return acc
      }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <>
      <div className="page-title">Dashboard</div>
      <p className="page-sub">Visao geral dos locais, planos, pagamentos, acessos e conteudos da plataforma.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total de conteudos</div>
          <div className="stat-value">{percursos.length}</div>
          <div className="stat-sub">{conteudosGerais} gerais e {Math.max(0, percursos.length - conteudosGerais)} por local</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Locais ativos</div>
          <div className="stat-value">{locaisAtivos}</div>
          <div className="stat-sub">{locais.length} cadastrados</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Planos ativos</div>
          <div className="stat-value">{planosAtivos}</div>
          <div className="stat-sub">{planos.length} cadastrados</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pagamentos pendentes</div>
          <div className="stat-value">{pedidosPendentes}</div>
          <div className="stat-sub">{assinaturasAtivas} acessos ativos</div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 15 }}>
              Conteudos recentes
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => navigate('/admin/percursos')}>
              Ver todos
            </button>
          </div>

          {recentes.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 14, textAlign: 'center', padding: '2rem' }}>
              Nenhum conteudo cadastrado ainda.
            </div>
          ) : (
            <div className="stack-list">
              {recentes.map(item => (
                <div
                  key={item.id}
                  className="stack-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/percursos/${item.id}/editar`)}
                >
                  <div>
                    <div className="table-name">{item.titulo}</div>
                    <div className="mini-copy">
                      {(item.localProvaNome || 'Geral')} - {formatTipoConteudo(item.tipoConteudo)}
                    </div>
                  </div>
                  <span className={`badge ${item.ativo ? 'badge-green' : 'badge-gray'}`}>
                    {item.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 15 }}>
            Cobertura por local
          </div>
          <div className="mini-copy" style={{ marginTop: 6 }}>
            Use esse resumo para identificar onde ainda faltam videos de percurso ou simulacao.
          </div>

          <div className="stack-list">
            <div className="stack-row">
              <div>
                <div className="table-name">Conteudo geral</div>
                <div className="mini-copy">Baliza, embreagem, erros e olhar do examinador.</div>
              </div>
              <span className="badge badge-gray">{conteudosGerais}</span>
            </div>

            {resumoPorLocal.length === 0 ? (
              <div className="mini-copy">Nenhum local possui conteudos vinculados ainda.</div>
            ) : resumoPorLocal.map(([nome, quantidade]) => (
              <div key={nome} className="stack-row">
                <div className="table-name">{nome}</div>
                <span className="badge badge-green">{quantidade}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/admin/percursos/novo')}>
            + Novo conteudo
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/admin/pedidos')}>
            Ver pagamentos
          </button>
        </div>
      </div>
    </>
  )
}
