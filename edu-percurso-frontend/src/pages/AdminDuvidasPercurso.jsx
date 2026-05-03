import { useEffect, useMemo, useState } from 'react'
import { duvidaPercursoService, localProvaService, percursoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import {
  formatDataHoraCurta,
  formatStatusDuvidaPercurso,
  getStatusDuvidaPercursoBadgeClass,
} from '../utils/formatters'

const FILTROS_INICIAIS = {
  busca: '',
  localProvaId: '',
  percursoId: '',
  status: '',
}

const STATUS_OPTIONS = [
  'PENDENTE_MODERACAO',
  'PUBLICADA',
  'RESPONDIDA',
  'RESOLVIDA',
  'OCULTA',
]

function formatarTimestamp(segundos) {
  const total = Math.max(0, Math.floor(Number(segundos) || 0))
  const minutos = Math.floor(total / 60)
  const resto = total % 60
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
}

function montarFormulario(detalhe) {
  return {
    timestampSegundos: detalhe?.timestampSegundos ?? 0,
    titulo: detalhe?.titulo || '',
    descricao: detalhe?.descricao || '',
    status: detalhe?.status || 'PENDENTE_MODERACAO',
    respostaOficial: detalhe?.respostaOficial || '',
    janelaRelacionadaSegundos: detalhe?.janelaRelacionadaSegundos ?? 15,
  }
}

export default function AdminDuvidasPercurso() {
  const { show, ToastEl } = useToast()
  const [duvidas, setDuvidas] = useState([])
  const [percursos, setPercursos] = useState([])
  const [locais, setLocais] = useState([])
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(montarFormulario())
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregarTudo()
  }, [])

  async function carregarTudo(preferSelectedId) {
    setLoading(true)
    try {
      const [duvidasResp, percursosResp, locaisResp] = await Promise.all([
        duvidaPercursoService.listarAdmin(),
        percursoService.listar({ todos: true }),
        localProvaService.listar({ todos: true }),
      ])

      setDuvidas(Array.isArray(duvidasResp) ? duvidasResp : [])
      setPercursos(Array.isArray(percursosResp) ? percursosResp : [])
      setLocais(Array.isArray(locaisResp) ? locaisResp : [])

      const proximoId = preferSelectedId === null
        ? ''
        : preferSelectedId || duvidasResp?.[0]?.id || ''

      setSelectedId(proximoId)
      const detalhe = (duvidasResp || []).find(item => item.id === proximoId) || null
      setForm(montarFormulario(detalhe))
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao carregar as duvidas do percurso.', 'error')
    } finally {
      setLoading(false)
    }
  }

  function selecionar(item) {
    setSelectedId(item.id)
    setForm(montarFormulario(item))
  }

  async function salvar(event) {
    event.preventDefault()
    if (!selectedId) return

    setSalvando(true)
    try {
      await duvidaPercursoService.atualizarAdmin(selectedId, {
        ...form,
        timestampSegundos: Number(form.timestampSegundos || 0),
        janelaRelacionadaSegundos: Number(form.janelaRelacionadaSegundos || 15),
      })
      show('Duvida atualizada com sucesso.')
      await carregarTudo(selectedId)
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao salvar a duvida.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const duvidasFiltradas = useMemo(() => {
    const termoBusca = filtros.busca.trim().toLowerCase()

    return duvidas.filter(item => {
      if (filtros.localProvaId && item.localProvaId !== filtros.localProvaId) return false
      if (filtros.percursoId && item.percursoId !== filtros.percursoId) return false
      if (filtros.status && item.status !== filtros.status) return false

      if (!termoBusca) return true

      const textoBusca = [
        item.autorNome,
        item.percursoTitulo,
        item.localProvaNome,
        item.titulo,
        item.descricao,
        item.respostaOficial,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return textoBusca.includes(termoBusca)
    })
  }, [duvidas, filtros])

  const detalheSelecionado = duvidas.find(item => item.id === selectedId) || null
  const resumo = useMemo(() => ({
    pendentes: duvidas.filter(item => item.status === 'PENDENTE_MODERACAO').length,
    respondidas: duvidas.filter(item => item.status === 'RESPONDIDA' || item.status === 'RESOLVIDA').length,
    publicadas: duvidas.filter(item => item.status === 'PUBLICADA').length,
  }), [duvidas])

  return (
    <>
      {ToastEl}
      <div className="page-title">Duvidas por trecho</div>
      <p className="page-sub">
        Modere as duvidas dos alunos, publique respostas oficiais e acompanhe quais trechos mais geram atrito no percurso.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Pendentes</div>
          <div className="stat-value">{resumo.pendentes}</div>
          <div className="stat-sub">Aguardando moderacao</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Publicadas</div>
          <div className="stat-value">{resumo.publicadas}</div>
          <div className="stat-sub">Sem resposta oficial</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Respondidas</div>
          <div className="stat-value">{resumo.respondidas}</div>
          <div className="stat-sub">Ja reaproveitaveis</div>
        </div>
      </div>

      <div className="admin-stack-layout">
        <div className="card">
          <div className="section-title-row">
            <div>
              <div className="section-heading">Fila de duvidas</div>
              <p className="section-copy">
                {duvidasFiltradas.length} {duvidasFiltradas.length === 1 ? 'duvida encontrada' : 'duvidas encontradas'}
              </p>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => carregarTudo(selectedId || undefined)}>
              Atualizar
            </button>
          </div>

          <div className="assinaturas-filter-grid">
            <div className="form-group">
              <label className="form-label">Buscar</label>
              <input
                className="form-input"
                value={filtros.busca}
                placeholder="Autor, titulo, percurso ou resposta"
                onChange={event => setFiltros(current => ({ ...current, busca: event.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Local</label>
              <select
                className="form-select"
                value={filtros.localProvaId}
                onChange={event => setFiltros(current => ({ ...current, localProvaId: event.target.value }))}
              >
                <option value="">Todos os locais</option>
                {locais.map(local => (
                  <option key={local.id} value={local.id}>{local.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Percurso</label>
              <select
                className="form-select"
                value={filtros.percursoId}
                onChange={event => setFiltros(current => ({ ...current, percursoId: event.target.value }))}
              >
                <option value="">Todos os percursos</option>
                {percursos.map(percurso => (
                  <option key={percurso.id} value={percurso.id}>{percurso.titulo}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={filtros.status}
                onChange={event => setFiltros(current => ({ ...current, status: event.target.value }))}
              >
                <option value="">Todos</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{formatStatusDuvidaPercurso(status)}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="spinner" />
          ) : duvidasFiltradas.length === 0 ? (
            <div className="empty-state">Nenhuma duvida encontrada com os filtros atuais.</div>
          ) : (
            <div className="table-wrap" style={{ marginTop: '1rem' }}>
              <div className="table-head assinaturas-table-head">
                <div>Trecho</div>
                <div>Autor</div>
                <div>Percurso</div>
                <div>Status</div>
                <div>Abrir</div>
              </div>

              {duvidasFiltradas.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`table-row assinaturas-table-row table-button-row ${selectedId === item.id ? 'is-selected' : ''}`}
                  onClick={() => selecionar(item)}
                >
                  <div>
                    <div className="table-name">{formatarTimestamp(item.timestampSegundos)}</div>
                    <div className="mini-copy">{item.titulo}</div>
                  </div>

                  <div>
                    <div className="table-name">{item.autorNomeAbreviado || item.autorNome}</div>
                    <div className="mini-copy">{formatDataHoraCurta(item.criadaEm)}</div>
                  </div>

                  <div>
                    <div className="table-name">{item.percursoTitulo}</div>
                    <div className="mini-copy">{item.localProvaNome || 'Percurso geral'}</div>
                  </div>

                  <div>
                    <span className={`badge ${getStatusDuvidaPercursoBadgeClass(item.status)}`}>
                      {formatStatusDuvidaPercurso(item.status)}
                    </span>
                    <div className="mini-copy" style={{ marginTop: 6 }}>
                      {item.quantidadeApoios || 0} apoios
                    </div>
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
              <div className="section-heading">Detalhes e moderacao</div>
              <p className="section-copy">Ajuste o texto, publique, responda ou oculte a duvida.</p>
            </div>
          </div>

          {!detalheSelecionado ? (
            <div className="empty-state" style={{ padding: '2.5rem 1rem 1rem' }}>
              Selecione uma duvida na fila para revisar.
            </div>
          ) : (
            <>
              <div className="assinatura-detail-grid">
                <div className="player-meta-card">
                  <div className="player-meta-label">Trecho</div>
                  <div className="player-meta-value">{formatarTimestamp(detalheSelecionado.timestampSegundos)}</div>
                  <div className="mini-copy">Criada em {formatDataHoraCurta(detalheSelecionado.criadaEm)}</div>
                </div>
                <div className="player-meta-card">
                  <div className="player-meta-label">Autor</div>
                  <div className="player-meta-value">{detalheSelecionado.autorNome}</div>
                  <div className="mini-copy">{detalheSelecionado.quantidadeApoios || 0} apoios</div>
                </div>
                <div className="player-meta-card">
                  <div className="player-meta-label">Percurso</div>
                  <div className="player-meta-value">{detalheSelecionado.percursoTitulo}</div>
                  <div className="mini-copy">{detalheSelecionado.localProvaNome || 'Percurso geral'}</div>
                </div>
                <div className="player-meta-card">
                  <div className="player-meta-label">Status atual</div>
                  <div className="player-meta-value">
                    <span className={`badge ${getStatusDuvidaPercursoBadgeClass(detalheSelecionado.status)}`}>
                      {formatStatusDuvidaPercurso(detalheSelecionado.status)}
                    </span>
                  </div>
                  <div className="mini-copy">
                    {detalheSelecionado.respondidaPorNome
                      ? `Resposta por ${detalheSelecionado.respondidaPorNome}`
                      : 'Ainda sem resposta oficial'}
                  </div>
                </div>
              </div>

              <form onSubmit={salvar} style={{ marginTop: '1.25rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Trecho em segundos</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      value={form.timestampSegundos}
                      onChange={event => setForm(current => ({ ...current, timestampSegundos: event.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={form.status}
                      onChange={event => setForm(current => ({ ...current, status: event.target.value }))}
                    >
                      {STATUS_OPTIONS.map(status => (
                        <option key={status} value={status}>{formatStatusDuvidaPercurso(status)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo da duvida</label>
                  <input
                    className="form-input"
                    value={form.titulo}
                    onChange={event => setForm(current => ({ ...current, titulo: event.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descricao do aluno</label>
                  <textarea
                    className="form-textarea"
                    value={form.descricao}
                    onChange={event => setForm(current => ({ ...current, descricao: event.target.value }))}
                    placeholder="Ajuste o texto para manter a duvida clara antes de publicar."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Resposta oficial</label>
                  <textarea
                    className="form-textarea"
                    value={form.respostaOficial}
                    onChange={event => setForm(current => ({ ...current, respostaOficial: event.target.value }))}
                    placeholder="Explique a resposta que vai ajudar os proximos alunos nesse mesmo trecho."
                  />
                </div>

                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar moderacao'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setForm(montarFormulario(detalheSelecionado))}
                  >
                    Desfazer alteracoes
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
