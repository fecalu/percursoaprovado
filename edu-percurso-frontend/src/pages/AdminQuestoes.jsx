import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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

const TEMAS_POR_MODALIDADE = {
  TEORICO: [
    'PLACAS',
    'LEGISLACAO',
    'DIRECAO_DEFENSIVA',
    'PRIMEIROS_SOCORROS',
    'MECANICA_BASICA',
    'MEIO_AMBIENTE_CIDADANIA',
  ],
  PRATICO: [
    'BALIZA',
    'CONTROLE_DO_VEICULO',
    'LADEIRA',
    'PREFERENCIA',
    'CONVERSOES',
    'ESTACIONAMENTO',
    'FALTAS_ELIMINATORIAS',
    'CONDUTA_NA_PROVA',
  ],
}

const MODALIDADES = {
  teoricas: {
    codigo: 'TEORICO',
    titulo: 'Questoes teoricas',
    subtitulo: 'Cadastre as questoes do simulado teorico, defina o gabarito e inclua a explicacao em texto ou video.',
  },
  praticas: {
    codigo: 'PRATICO',
    titulo: 'Questoes praticas',
    subtitulo: 'Cadastre as questoes do simulado pratico, com foco em leitura de situacao, criterio de avaliacao e conduta de prova.',
  },
}

const STATUS = ['RASCUNHO', 'PUBLICADA', 'ARQUIVADA']
const ITENS_POR_PAGINA = 50

function resumirEnunciado(texto) {
  if (!texto) return ''
  if (texto.length <= 145) return texto
  return `${texto.slice(0, 142)}...`
}

export default function AdminQuestoes() {
  const { modalidadeSlug = 'teoricas' } = useParams()
  const navigate = useNavigate()
  const { show, ToastEl } = useToast()
  const [questoes, setQuestoes] = useState([])
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const [loading, setLoading] = useState(true)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const modalidadeAtual = MODALIDADES[modalidadeSlug] || MODALIDADES.teoricas
  const temasDisponiveis = TEMAS_POR_MODALIDADE[modalidadeAtual.codigo] || []

  const totalPaginas = Math.max(1, Math.ceil(questoes.length / ITENS_POR_PAGINA))
  const inicioPaginacao = (paginaAtual - 1) * ITENS_POR_PAGINA
  const fimPaginacao = inicioPaginacao + ITENS_POR_PAGINA

  const questoesPaginadas = useMemo(
    () => questoes.slice(inicioPaginacao, fimPaginacao),
    [fimPaginacao, inicioPaginacao, questoes]
  )

  const paginasVisiveis = useMemo(() => {
    const paginaInicial = Math.max(1, paginaAtual - 2)
    const paginaFinal = Math.min(totalPaginas, paginaAtual + 2)
    const paginas = []

    for (let pagina = paginaInicial; pagina <= paginaFinal; pagina += 1) {
      paginas.push(pagina)
    }

    return paginas
  }, [paginaAtual, totalPaginas])

  useEffect(() => {
    setFiltros(FILTROS_INICIAIS)
    carregar(FILTROS_INICIAIS)
  }, [modalidadeAtual.codigo])

  useEffect(() => {
    setPaginaAtual(current => Math.min(current, totalPaginas))
  }, [totalPaginas])

  async function carregar(params = filtros) {
    try {
      setLoading(true)
      setQuestoes(await questaoService.listarAdmin({
        ...params,
        modalidade: modalidadeAtual.codigo,
      }))
      setPaginaAtual(1)
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

      <div className="admin-page-head">
        <div className="page-title">{modalidadeAtual.titulo}</div>
        <button className="btn btn-primary" onClick={() => navigate(`/admin/questoes/${modalidadeSlug}/nova`)}>
          + Nova questao
        </button>
      </div>
      <p className="page-sub">{modalidadeAtual.subtitulo}</p>

      <form className="card question-filters" onSubmit={handleFiltrar} style={{ marginBottom: '1.5rem' }}>
        <input
          className="form-input"
          placeholder="Buscar por enunciado ou explicacao..."
          value={filtros.busca}
          onChange={event => setFiltro('busca', event.target.value)}
        />

        <select className="form-select" value={filtros.tema} onChange={event => setFiltro('tema', event.target.value)}>
          <option value="">Todos os temas</option>
          {temasDisponiveis.map(tema => (
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
        <>
          <div className="admin-list-toolbar">
            <div className="mini-copy admin-list-toolbar-copy">
              Exibindo <strong>{inicioPaginacao + 1}</strong> a <strong>{Math.min(fimPaginacao, questoes.length)}</strong> de <strong>{questoes.length}</strong> questoes
            </div>
            <div className="mini-copy admin-list-toolbar-copy">
              Pagina <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
            </div>
          </div>

          <div className="table-wrap questoes-admin-table-wrap">
          <div className="table-head questoes-admin-table-head">
            <span>Questao</span>
            <span>Tema</span>
            <span>Dificuldade</span>
            <span>Status</span>
            <span>Acoes</span>
          </div>

          {questoesPaginadas.map(item => (
            <div key={item.id} className="table-row questoes-admin-row">
              <div className="questoes-admin-cell questoes-admin-cell--questao">
                <div className="table-name question-row-title" title={item.enunciado}>
                  {resumirEnunciado(item.enunciado)}
                </div>
                <div className="mini-copy">{item.alternativas.length} alternativas cadastradas</div>
                <div className="question-inline-meta">
                  {item.videoUrl && <span className="badge badge-blue">Com video</span>}
                  <span className="badge badge-gray">Ordem {item.ordemExibicao ?? 0}</span>
                </div>
              </div>

              <div className="questoes-admin-cell">
                <span className="questoes-admin-label">Tema</span>
                <span className="table-cat">{formatTemaQuestao(item.tema)}</span>
              </div>

              <div className="questoes-admin-cell">
                <span className="questoes-admin-label">Dificuldade</span>
                <span className="table-cat">{formatDificuldadeQuestao(item.dificuldade)}</span>
              </div>

              <div className="questoes-admin-cell">
                <span className="questoes-admin-label">Status</span>
                <span className={`badge ${getStatusQuestaoBadgeClass(item.status)}`}>
                  {formatStatusQuestao(item.status)}
                </span>
              </div>

              <div className="table-actions questoes-admin-actions">
                <span className="questoes-admin-label">Acoes</span>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => navigate(`/admin/questoes/${modalidadeSlug}/${item.id}/editar`)}
                >
                  Editar
                </button>

                {item.status === 'PUBLICADA' ? (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => arquivar(item.id)}
                  >
                    Arquivar
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => publicar(item.id)}
                  >
                    Publicar
                  </button>
                )}

                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={() => excluir(item.id, item.enunciado)}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}

          </div>

          {totalPaginas > 1 && (
            <div className="admin-pagination">
              <button
                className="btn btn-ghost"
                type="button"
                disabled={paginaAtual === 1}
                onClick={() => setPaginaAtual(current => Math.max(1, current - 1))}
              >
                Anterior
              </button>

              <div className="admin-pagination-pages">
                {paginasVisiveis.map(pagina => (
                  <button
                    key={pagina}
                    className={`admin-pagination-page ${pagina === paginaAtual ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setPaginaAtual(pagina)}
                  >
                    {pagina}
                  </button>
                ))}
              </div>

              <button
                className="btn btn-ghost"
                type="button"
                disabled={paginaAtual === totalPaginas}
                onClick={() => setPaginaAtual(current => Math.min(totalPaginas, current + 1))}
              >
                Proxima
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
