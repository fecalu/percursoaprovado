import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { percursoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import { formatDuracaoMinutos, formatTipoConteudo } from '../utils/formatters'

export default function AdminPercursos() {
  const [percursos, setPercursos] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { show, ToastEl } = useToast()
  const moduloId = searchParams.get('moduloId') || ''
  const moduloNome = searchParams.get('moduloNome') || ''

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

  const percursosFiltrados = useMemo(() => {
    if (!moduloId) return percursos
    return percursos.filter(item => item.categoriaId === moduloId)
  }, [percursos, moduloId])

  async function excluir(id, titulo) {
    if (!confirm(`Excluir a aula "${titulo}"?`)) return

    try {
      await percursoService.excluir(id)
      setPercursos(prev => prev.filter(item => item.id !== id))
      show('Aula excluida com sucesso.')
    } catch {
      show('Erro ao excluir aula.', 'error')
    }
  }

  if (loading) return <div className="spinner" />

  return (
    <>
      {ToastEl}
      <div className="admin-page-head">
        <div>
          <div className="page-title">{moduloId ? 'Aulas do módulo' : 'Aulas'}</div>
          {moduloId ? (
            <div className="mini-copy" style={{ marginTop: 6 }}>
              {moduloNome ? `Filtrando por módulo: ${moduloNome}` : 'Filtrando pela seleção vinda da tela de módulos.'}
            </div>
          ) : null}
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/percursos/novo')}>
          + Nova aula
        </button>
      </div>
      <p className="page-sub">Gerencie aulas gerais e aulas vinculadas a cada local, organizando tudo por modulo.</p>

      {moduloId ? (
        <div className="admin-inline-note" style={{ marginBottom: '1rem' }}>
          <strong>{percursosFiltrados.length}</strong> aula(s) encontrada(s) neste módulo.
          <button
            className="btn btn-ghost"
            type="button"
            style={{ marginLeft: '0.85rem' }}
            onClick={() => setSearchParams({})}
          >
            Limpar filtro
          </button>
        </div>
      ) : null}

      {percursosFiltrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          {moduloId ? 'Nenhuma aula encontrada para este módulo.' : 'Nenhuma aula cadastrada ainda.'}
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-head" style={{ gridTemplateColumns: '2fr 1.1fr 1.1fr 1fr 0.8fr 140px' }}>
            <span>Aula</span>
            <span>Modulo</span>
            <span>Escopo</span>
            <span>Tipo</span>
            <span>Duracao</span>
            <span>Acoes</span>
          </div>
          {percursosFiltrados.map(item => (
            <div key={item.id} className="table-row" style={{ gridTemplateColumns: '2fr 1.1fr 1.1fr 1fr 0.8fr 140px' }}>
              <div>
                <div className="table-name">{item.titulo}</div>
                <div className="mini-copy">{item.ativo ? 'Aula ativa' : 'Aula inativa'}</div>
                <span className={`badge ${item.ativo ? 'badge-green' : 'badge-gray'}`} style={{ marginTop: 4 }}>
                  {item.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <span className="table-cat">{item.categoriaNome || 'Sem modulo'}</span>
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
