import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { percursoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import { formatDuracaoMinutos, formatTipoConteudo } from '../utils/formatters'

export default function AdminPercursos() {
  const [percursos, setPercursos] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { show, ToastEl } = useToast()

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    try {
      setPercursos(await percursoService.listar(true))
    } finally {
      setLoading(false)
    }
  }

  async function excluir(id, titulo) {
    if (!confirm(`Excluir "${titulo}"?`)) return

    try {
      await percursoService.excluir(id)
      setPercursos(prev => prev.filter(item => item.id !== id))
      show('Conteudo excluido com sucesso.')
    } catch {
      show('Erro ao excluir conteudo.', 'error')
    }
  }

  if (loading) return <div className="spinner" />

  return (
    <>
      {ToastEl}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <div className="page-title">Conteudos</div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/percursos/novo')}>
          + Novo conteudo
        </button>
      </div>
      <p className="page-sub">Gerencie os videos gerais e os conteudos vinculados a cada local de prova.</p>

      {percursos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Nenhum conteudo cadastrado ainda.
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-head" style={{ gridTemplateColumns: '2.2fr 1.2fr 1.1fr 0.8fr 140px' }}>
            <span>Conteudo</span>
            <span>Local</span>
            <span>Tipo</span>
            <span>Duracao</span>
            <span>Acoes</span>
          </div>
          {percursos.map(item => (
            <div key={item.id} className="table-row" style={{ gridTemplateColumns: '2.2fr 1.2fr 1.1fr 0.8fr 140px' }}>
              <div>
                <div className="table-name">{item.titulo}</div>
                <div className="mini-copy">{item.categoriaNome || 'Sem categoria'}</div>
                <span className={`badge ${item.ativo ? 'badge-green' : 'badge-gray'}`} style={{ marginTop: 4 }}>
                  {item.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <span className="table-cat">{item.localProvaNome || 'Geral'}</span>
              <span className="table-cat">{formatTipoConteudo(item.tipoConteudo)}</span>
              <span className="table-dur">{formatDuracaoMinutos(item.duracaoSegundos)}</span>
              <div className="table-actions">
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={() => navigate(`/admin/percursos/${item.id}/editar`)}
                >
                  Editar
                </button>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={() => excluir(item.id, item.titulo)}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
