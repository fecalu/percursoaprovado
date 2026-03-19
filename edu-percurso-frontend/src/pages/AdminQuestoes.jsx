import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { questaoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import {
  formatDificuldadeQuestao,
  formatStatusQuestao,
  formatTemaQuestao,
  getStatusQuestaoBadgeClass,
} from '../utils/formatters'

const FILTROS_INICIAIS = {
  busca: '',
  tema: '',
  status: '',
}

const TEMAS = [
  'PLACAS',
  'LEGISLACAO',
  'DIRECAO_DEFENSIVA',
  'PRIMEIROS_SOCORROS',
  'MECANICA_BASICA',
  'MEIO_AMBIENTE_CIDADANIA',
]

const STATUS = ['RASCUNHO', 'PUBLICADA', 'ARQUIVADA']

function resumirEnunciado(texto) {
  if (!texto) return ''
  if (texto.length <= 145) return texto
  return `${texto.slice(0, 142)}...`
}

export default function AdminQuestoes() {
  const navigate = useNavigate()
  const { show, ToastEl } = useToast()
  const [questoes, setQuestoes] = useState([])
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregar(FILTROS_INICIAIS)
  }, [])

  async function carregar(params = filtros) {
    try {
      setLoading(true)
      setQuestoes(await questaoService.listarAdmin(params))
    } finally {
      setLoading(false)
    }
  }

  function setFiltro(field, value) {
    setFiltros(current => ({ ...current, [field]: value }))
  }

  async function handleFiltrar(event) {
    event.preventDefault()
    await carregar(filtros)
  }

  async function limparFiltros() {
    setFiltros(FILTROS_INICIAIS)
    await carregar(FILTROS_INICIAIS)
  }

  async function publicar(id) {
    try {
      await questaoService.publicarAdmin(id)
      show('Questao publicada com sucesso.')
      await carregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao publicar questao.', 'error')
    }
  }

  async function arquivar(id) {
    try {
      await questaoService.arquivarAdmin(id)
      show('Questao arquivada com sucesso.')
      await carregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao arquivar questao.', 'error')
    }
  }

  async function excluir(id, enunciado) {
    if (!confirm(`Excluir esta questao?\n\n${resumirEnunciado(enunciado)}`)) return

    try {
      await questaoService.excluirAdmin(id)
      show('Questao excluida com sucesso.')
      await carregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao excluir questao.', 'error')
    }
  }

  if (loading) return <div className="spinner" />

  return (
    <>
      {ToastEl}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="page-title">Banco de questoes</div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/questoes/nova')}>
          + Nova questao
        </button>
      </div>
      <p className="page-sub">Cadastre as questoes do simulado teorico, defina o gabarito e inclua a explicacao em texto ou video.</p>

      <form className="card question-filters" onSubmit={handleFiltrar} style={{ marginBottom: '1.5rem' }}>
        <input
          className="form-input"
          placeholder="Buscar por enunciado ou explicacao..."
          value={filtros.busca}
          onChange={event => setFiltro('busca', event.target.value)}
        />

        <select className="form-select" value={filtros.tema} onChange={event => setFiltro('tema', event.target.value)}>
          <option value="">Todos os temas</option>
          {TEMAS.map(tema => (
            <option key={tema} value={tema}>{formatTemaQuestao(tema)}</option>
          ))}
        </select>

        <select className="form-select" value={filtros.status} onChange={event => setFiltro('status', event.target.value)}>
          <option value="">Todos os status</option>
          {STATUS.map(status => (
            <option key={status} value={status}>{formatStatusQuestao(status)}</option>
          ))}
        </select>

        <button className="btn btn-primary" type="submit">Filtrar</button>
        <button className="btn btn-ghost" type="button" onClick={limparFiltros}>Limpar</button>
      </form>

      {questoes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">?</div>
          Nenhuma questao encontrada com esses filtros.
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-head" style={{ gridTemplateColumns: '2.7fr 1.1fr 0.8fr 0.95fr 240px' }}>
            <span>Questao</span>
            <span>Tema</span>
            <span>Dificuldade</span>
            <span>Status</span>
            <span>Acoes</span>
          </div>

          {questoes.map(item => (
            <div key={item.id} className="table-row" style={{ gridTemplateColumns: '2.7fr 1.1fr 0.8fr 0.95fr 240px' }}>
              <div>
                <div className="table-name question-row-title">{resumirEnunciado(item.enunciado)}</div>
                <div className="mini-copy">{item.alternativas.length} alternativas cadastradas</div>
                <div className="question-inline-meta">
                  {item.videoUrl && <span className="badge badge-blue">Com video</span>}
                  <span className="badge badge-gray">Ordem {item.ordemExibicao ?? 0}</span>
                </div>
              </div>

              <span className="table-cat">{formatTemaQuestao(item.tema)}</span>
              <span className="table-cat">{formatDificuldadeQuestao(item.dificuldade)}</span>
              <span>
                <span className={`badge ${getStatusQuestaoBadgeClass(item.status)}`}>
                  {formatStatusQuestao(item.status)}
                </span>
              </span>

              <div className="table-actions" style={{ flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={() => navigate(`/admin/questoes/${item.id}/editar`)}
                >
                  Editar
                </button>

                {item.status === 'PUBLICADA' ? (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => arquivar(item.id)}
                  >
                    Arquivar
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => publicar(item.id)}
                  >
                    Publicar
                  </button>
                )}

                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={() => excluir(item.id, item.enunciado)}
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
