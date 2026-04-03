import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoriaService, percursoService } from '../services/api'
import { useToast } from '../hooks/useToast'

function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data
  const status = error?.response?.status

  if (status === 403) {
    return 'Sua sessão de administrador expirou ou não tem permissão para esta ação. Entre novamente.'
  }

  if (typeof data?.erro === 'string' && data.erro.trim()) {
    return data.erro
  }

  if (data && typeof data === 'object') {
    const firstFieldError = Object.values(data).find(value => typeof value === 'string' && value.trim())
    if (firstFieldError) {
      return firstFieldError
    }
  }

  return error?.message || fallback
}

function criarFormularioVazio(categorias = []) {
  const proximaOrdem = categorias.reduce((maior, item) => Math.max(maior, Number(item.ordemExibicao) || 0), -1) + 1

  return {
    nome: '',
    descricao: '',
    ordemExibicao: String(Math.max(0, proximaOrdem)),
  }
}

function formatarUsoModulo(totalAulas) {
  if (!totalAulas) return 'Módulo vazio'
  return totalAulas === 1 ? '1 aula vinculada' : `${totalAulas} aulas vinculadas`
}

export default function AdminModulos() {
  const navigate = useNavigate()
  const [categorias, setCategorias] = useState([])
  const [form, setForm] = useState(criarFormularioVazio())
  const [edicaoId, setEdicaoId] = useState(null)
  const [categoriaDestinoId, setCategoriaDestinoId] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [movendo, setMovendo] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const { show, ToastEl } = useToast()

  const categoriaEmEdicao = useMemo(
    () => categorias.find(item => item.id === edicaoId) || null,
    [categorias, edicaoId]
  )

  const modulosDestino = useMemo(
    () => categorias.filter(item => item.id !== edicaoId),
    [categorias, edicaoId]
  )

  const categoriaDestino = useMemo(
    () => modulosDestino.find(item => item.id === categoriaDestinoId) || null,
    [modulosDestino, categoriaDestinoId]
  )

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    if (!edicaoId) {
      setCategoriaDestinoId('')
      return
    }

    setCategoriaDestinoId(current => {
      if (current && current !== edicaoId && modulosDestino.some(item => item.id === current)) {
        return current
      }
      return modulosDestino[0]?.id || ''
    })
  }, [edicaoId, modulosDestino])

  async function carregar(preferirId = null) {
    try {
      const [categoriasResp, percursosResp] = await Promise.all([
        categoriaService.listar(),
        percursoService.listar({ todos: true }),
      ])

      const usoPorCategoria = percursosResp.reduce((acc, percurso) => {
        if (!percurso.categoriaId) return acc
        acc[percurso.categoriaId] = (acc[percurso.categoriaId] || 0) + 1
        return acc
      }, {})

      const lista = categoriasResp.map(categoria => ({
        ...categoria,
        totalAulas: usoPorCategoria[categoria.id] || 0,
      }))

      setCategorias(lista)

      const categoriaPreferida = preferirId
        ? lista.find(item => item.id === preferirId)
        : null

      if (categoriaPreferida) {
        selecionar(categoriaPreferida)
        return
      }

      const categoriaAtual = edicaoId
        ? lista.find(item => item.id === edicaoId)
        : null

      if (categoriaAtual) {
        selecionar(categoriaAtual)
        return
      }

      if (lista.length) {
        selecionar(lista[0])
        return
      }

      resetar(lista)
    } finally {
      setLoading(false)
    }
  }

  function selecionar(categoria) {
    setEdicaoId(categoria.id)
    setForm({
      nome: categoria.nome || '',
      descricao: categoria.descricao || '',
      ordemExibicao: String(categoria.ordemExibicao ?? 0),
    })
  }

  function resetar(listaAtual = categorias) {
    setEdicaoId(null)
    setCategoriaDestinoId('')
    setForm(criarFormularioVazio(listaAtual))
  }

  async function salvar(event) {
    event.preventDefault()
    const nome = form.nome.trim()

    if (!nome) {
      show('Informe o nome do módulo.', 'error')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        nome,
        descricao: form.descricao.trim() || null,
        ordemExibicao: Number(form.ordemExibicao) || 0,
      }

      const resposta = edicaoId
        ? await categoriaService.atualizar(edicaoId, payload)
        : await categoriaService.criar(payload)

      show(edicaoId ? 'Módulo atualizado com sucesso.' : 'Módulo criado com sucesso.')
      await carregar(resposta.id)
    } catch (error) {
      show(getApiErrorMessage(error, 'Não foi possível salvar o módulo.'), 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function moverAulasDoModulo() {
    if (!categoriaEmEdicao?.id || !categoriaDestinoId) return

    const totalAulas = categoriaEmEdicao.totalAulas || 0
    const nomeOrigem = categoriaEmEdicao.nome || 'Módulo atual'
    const nomeDestino = categoriaDestino?.nome || 'Módulo de destino'
    const confirmou = window.confirm(`Mover ${totalAulas} aula(s) de "${nomeOrigem}" para "${nomeDestino}"?`)

    if (!confirmou) return

    setMovendo(true)
    try {
      const resposta = await categoriaService.moverAulas(categoriaEmEdicao.id, {
        categoriaDestinoId,
      })

      show(`${resposta.totalAulasMovidas || 0} aula(s) movida(s) para ${resposta.categoriaDestinoNome}.`)
      await carregar(categoriaEmEdicao.id)
    } catch (error) {
      show(getApiErrorMessage(error, 'Não foi possível mover as aulas deste módulo.'), 'error')
    } finally {
      setMovendo(false)
    }
  }

  async function excluirModulo() {
    if (!edicaoId) return

    const nomeModulo = categoriaEmEdicao?.nome || form.nome.trim() || 'este módulo'
    const confirmou = window.confirm(`Excluir o módulo "${nomeModulo}"? A exclusão só será concluída se ele estiver vazio.`)

    if (!confirmou) return

    setExcluindo(true)
    try {
      await categoriaService.excluir(edicaoId)
      show('Módulo excluído com sucesso.')
      setEdicaoId(null)
      await carregar()
    } catch (error) {
      show(getApiErrorMessage(error, 'Não foi possível excluir o módulo.'), 'error')
    } finally {
      setExcluindo(false)
    }
  }

  function verAulasDoModulo() {
    if (!categoriaEmEdicao?.id) return

    const search = new URLSearchParams({
      moduloId: categoriaEmEdicao.id,
      moduloNome: categoriaEmEdicao.nome || '',
    })

    navigate(`/admin/percursos?${search.toString()}`)
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Módulos</div>
      <p className="page-sub">Gerencie os módulos usados em Conteúdos, Biblioteca e Player. Renomear aqui atualiza a apresentação em toda a plataforma.</p>

      <div className="admin-grid">
        <div className="card">
          <div className="admin-page-head">
            <div>
              <div className="section-heading">Lista de módulos</div>
              <div className="section-copy">Selecione um módulo para editar nome, descrição e ordem.</div>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => resetar()}>
              Novo módulo
            </button>
          </div>

          <div className="admin-inline-note" style={{ marginTop: '0.55rem' }}>
            <strong>Total:</strong> {categorias.length} módulo(s). Use nomes curtos e claros, como <strong>Percursos</strong>, <strong>Teórico prático</strong> e <strong>Pegadinhas</strong>.
          </div>

          {loading ? (
            <div className="spinner" />
          ) : categorias.length ? (
            <div className="admin-modulos-list">
              {categorias.map(categoria => (
                <button
                  key={categoria.id}
                  type="button"
                  className={`admin-modulos-item${edicaoId === categoria.id ? ' is-active' : ''}`}
                  onClick={() => selecionar(categoria)}
                >
                  <div className="admin-modulos-item-head">
                    <div className="admin-modulos-item-title">{categoria.nome}</div>
                    <span className="card-tag">Ordem {categoria.ordemExibicao ?? 0}</span>
                  </div>
                  <div className="admin-modulos-item-copy">
                    {categoria.descricao?.trim() || 'Sem descrição definida.'}
                  </div>
                  <div className="mini-copy" style={{ marginTop: '0.4rem' }}>
                    {formatarUsoModulo(categoria.totalAulas)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="admin-modulos-empty">
              <div className="section-heading" style={{ fontSize: 18 }}>Nenhum módulo cadastrado</div>
              <div className="section-copy">Crie o primeiro módulo para começar a organizar conteúdos gerais e conteúdos por local.</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title-row" style={{ marginBottom: '0.85rem' }}>
            <div>
              <div className="section-heading">{edicaoId ? 'Editar módulo' : 'Novo módulo'}</div>
              <div className="section-copy">Esse nome aparece no seletor de aulas, na Biblioteca e no Player.</div>
            </div>
          </div>

          <form onSubmit={salvar}>
            <div className="form-group">
              <label className="form-label">Nome do módulo</label>
              <input
                className="form-input"
                value={form.nome}
                onChange={event => setForm(current => ({ ...current, nome: event.target.value }))}
                placeholder="Ex.: Teórico prático"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Descrição</label>
              <textarea
                className="form-textarea admin-modulos-textarea"
                value={form.descricao}
                onChange={event => setForm(current => ({ ...current, descricao: event.target.value }))}
                placeholder="Explique rapidamente quando esse módulo deve ser usado."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ordem de exibição</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={form.ordemExibicao}
                  onChange={event => setForm(current => ({ ...current, ordemExibicao: event.target.value }))}
                />
                <div className="mini-copy">Menor número aparece primeiro na Biblioteca.</div>
              </div>
              <div className="form-group" />
            </div>

            <div className="admin-inline-note admin-modulos-preview">
              <strong>Prévia de uso:</strong>
              <span>Biblioteca &gt; Módulos gerais &gt; {form.nome.trim() || 'Nome do módulo'}</span>
              <span>Biblioteca &gt; Cohatrac / Cohab &gt; {form.nome.trim() || 'Nome do módulo'}</span>
            </div>

            {edicaoId ? (
              <div className="mini-copy" style={{ marginTop: '0.85rem' }}>
                {categoriaEmEdicao?.totalAulas
                  ? `Este módulo está em uso em ${categoriaEmEdicao.totalAulas} aula(s). Você pode mover tudo para outro módulo antes de excluir.`
                  : 'Este módulo está vazio e pode ser excluído com segurança.'}
              </div>
            ) : null}

            {edicaoId && (categoriaEmEdicao?.totalAulas || 0) > 0 ? (
              <div className="admin-inline-note" style={{ marginTop: '1rem' }}>
                <strong>Mover aulas em lote:</strong>
                <span>Transfira todas as aulas deste módulo para outro módulo e depois exclua o módulo vazio, se quiser.</span>
                <div className="form-row" style={{ marginTop: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Mover para</label>
                    <select
                      className="form-select"
                      value={categoriaDestinoId}
                      onChange={event => setCategoriaDestinoId(event.target.value)}
                    >
                      <option value="">Selecione o módulo de destino</option>
                      {modulosDestino.map(categoria => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, alignSelf: 'end' }}>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={moverAulasDoModulo}
                      disabled={!categoriaDestinoId || movendo || salvando || excluindo}
                    >
                      {movendo ? 'Movendo...' : `Mover ${categoriaEmEdicao.totalAulas} aula(s)`}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={salvando || movendo || excluindo}>
                {salvando ? 'Salvando...' : edicaoId ? 'Salvar alterações' : 'Criar módulo'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => resetar()}>
                Novo módulo
              </button>
              {edicaoId ? (
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={verAulasDoModulo}
                >
                  Ver aulas deste módulo
                </button>
              ) : null}
              {edicaoId ? (
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={excluirModulo}
                  disabled={excluindo || salvando || movendo}
                >
                  {excluindo ? 'Excluindo...' : 'Excluir módulo'}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
