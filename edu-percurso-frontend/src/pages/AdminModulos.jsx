import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoriaService, grupoAcessoService, percursoService, uploadService } from '../services/api'
import { useToast } from '../hooks/useToast'
import { resolveMediaUrl } from '../utils/media'

const FORMATOS_MODULO = [
  {
    value: 'AULAS',
    title: 'Aulas',
    copy: 'Abre direto na lista de videos, como hoje.',
  },
  {
    value: 'GUIA',
    title: 'Guia pratico',
    copy: 'Mostra blocos rapidos de orientacao no lugar das aulas.',
  },
  {
    value: 'MISTO',
    title: 'Misto',
    copy: 'Mostra o guia primeiro e as aulas como complemento.',
  },
]

const GUIA_ICONE_OPTIONS = [
  { value: 'check', label: 'Checklist' },
  { value: 'documento', label: 'Documento' },
  { value: 'local', label: 'Local' },
  { value: 'carro', label: 'Carro' },
  { value: 'alerta', label: 'Atencao' },
  { value: 'tempo', label: 'Horario' },
]

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
    formatoExperiencia: 'AULAS',
    gruposAcessoIds: [],
    guiaBlocos: [],
  }
}

function criarBlocoGuiaVazio(total = 0) {
  return {
    titulo: '',
    descricao: '',
    textoDetalhado: '',
    imagemUrl: '',
    imagemLegenda: '',
    icone: 'check',
    ordemExibicao: String(total + 1),
    itensVisuais: [],
  }
}

function criarItemVisualGuiaVazio(total = 0) {
  return {
    titulo: '',
    descricao: '',
    imagemUrl: '',
    imagemLegenda: '',
    ordemExibicao: String(total + 1),
  }
}

function normalizarItensVisuaisGuia(itens = []) {
  return [...itens]
    .sort((a, b) => (Number(a.ordemExibicao) || 0) - (Number(b.ordemExibicao) || 0))
    .map((item, index) => ({
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      imagemUrl: item.imagemUrl || '',
      imagemLegenda: item.imagemLegenda || '',
      ordemExibicao: String(item.ordemExibicao ?? index + 1),
    }))
}

function normalizarGuiaBlocos(blocos = []) {
  return [...blocos]
    .sort((a, b) => (Number(a.ordemExibicao) || 0) - (Number(b.ordemExibicao) || 0))
    .map((bloco, index) => ({
      titulo: bloco.titulo || '',
      descricao: bloco.descricao || '',
      textoDetalhado: bloco.textoDetalhado || '',
      imagemUrl: bloco.imagemUrl || '',
      imagemLegenda: bloco.imagemLegenda || '',
      icone: bloco.icone || 'check',
      ordemExibicao: String(bloco.ordemExibicao ?? index + 1),
      itensVisuais: normalizarItensVisuaisGuia(bloco.itensVisuais || []),
    }))
}

function prepararItensVisuaisGuiaPayload(itens = []) {
  return itens
    .map((item, index) => ({
      titulo: item.titulo.trim(),
      descricao: item.descricao.trim() || null,
      imagemUrl: item.imagemUrl.trim() || null,
      imagemLegenda: item.imagemLegenda.trim() || null,
      ordemExibicao: Number(item.ordemExibicao) || index + 1,
    }))
    .filter(item => item.titulo)
}

function prepararGuiaBlocosPayload(blocos = []) {
  return blocos
    .map((bloco, index) => ({
      titulo: bloco.titulo.trim(),
      descricao: bloco.descricao.trim() || null,
      textoDetalhado: bloco.textoDetalhado.trim() || null,
      imagemUrl: bloco.imagemUrl.trim() || null,
      imagemLegenda: bloco.imagemLegenda.trim() || null,
      icone: bloco.icone || 'check',
      ordemExibicao: Number(bloco.ordemExibicao) || index + 1,
      itensVisuais: prepararItensVisuaisGuiaPayload(bloco.itensVisuais),
    }))
    .filter(bloco => bloco.titulo)
}

function moduloTemGuia(formato) {
  return formato === 'GUIA' || formato === 'MISTO'
}

function extrairGrupoAcessoIds(categoria = {}) {
  if (Array.isArray(categoria.gruposAcessoIds)) {
    return categoria.gruposAcessoIds
  }

  if (Array.isArray(categoria.gruposAcesso)) {
    return categoria.gruposAcesso.map(grupo => grupo.id).filter(Boolean)
  }

  return []
}

function formatarUsoModulo(totalAulas) {
  if (!totalAulas) return 'Módulo vazio'
  return totalAulas === 1 ? '1 aula vinculada' : `${totalAulas} aulas vinculadas`
}

export default function AdminModulos() {
  const navigate = useNavigate()
  const [categorias, setCategorias] = useState([])
  const [gruposAcesso, setGruposAcesso] = useState([])
  const [form, setForm] = useState(criarFormularioVazio())
  const [edicaoId, setEdicaoId] = useState(null)
  const [categoriaDestinoId, setCategoriaDestinoId] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [movendo, setMovendo] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [uploadingGuiaField, setUploadingGuiaField] = useState('')
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
      const [categoriasResp, percursosResp, gruposResp] = await Promise.all([
        categoriaService.listar(),
        percursoService.listar({ todos: true }),
        grupoAcessoService.listar(),
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
      setGruposAcesso(gruposResp)

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
      formatoExperiencia: categoria.formatoExperiencia || 'AULAS',
      gruposAcessoIds: extrairGrupoAcessoIds(categoria),
      guiaBlocos: normalizarGuiaBlocos(categoria.guiaBlocos || []),
    })
  }

  function resetar(listaAtual = categorias) {
    setEdicaoId(null)
    setCategoriaDestinoId('')
    setForm(criarFormularioVazio(listaAtual))
  }

  function alternarGrupoAcesso(grupoId) {
    setForm(current => {
      const idsAtuais = Array.isArray(current.gruposAcessoIds) ? current.gruposAcessoIds : []
      const possuiGrupo = idsAtuais.includes(grupoId)

      return {
        ...current,
        gruposAcessoIds: possuiGrupo
          ? idsAtuais.filter(idAtual => idAtual !== grupoId)
          : [...idsAtuais, grupoId],
      }
    })
  }

  async function salvar(event) {
    event.preventDefault()
    const nome = form.nome.trim()

    if (!nome) {
      show('Informe o nome do módulo.', 'error')
      return
    }

    const guiaBlocosPayload = moduloTemGuia(form.formatoExperiencia)
      ? prepararGuiaBlocosPayload(form.guiaBlocos)
      : []

    if (guiaBlocosPayload.length && (!Array.isArray(form.gruposAcessoIds) || form.gruposAcessoIds.length === 0)) {
      show('Selecione ao menos um grupo de acesso para liberar este guia.', 'error')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        nome,
        descricao: form.descricao.trim() || null,
        ordemExibicao: Number(form.ordemExibicao) || 0,
        formatoExperiencia: form.formatoExperiencia || 'AULAS',
        gruposAcessoIds: moduloTemGuia(form.formatoExperiencia) ? form.gruposAcessoIds : [],
        guiaBlocos: guiaBlocosPayload,
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

  function atualizarBlocoGuia(index, campo, valor) {
    setForm(current => ({
      ...current,
      guiaBlocos: current.guiaBlocos.map((bloco, blocoIndex) => (
        blocoIndex === index ? { ...bloco, [campo]: valor } : bloco
      )),
    }))
  }

  function adicionarBlocoGuia() {
    setForm(current => ({
      ...current,
      guiaBlocos: [...current.guiaBlocos, criarBlocoGuiaVazio(current.guiaBlocos.length)],
    }))
  }

  function removerBlocoGuia(index) {
    setForm(current => ({
      ...current,
      guiaBlocos: current.guiaBlocos.filter((_, blocoIndex) => blocoIndex !== index),
    }))
  }

  function atualizarItemVisualGuia(blocoIndex, itemIndex, campo, valor) {
    setForm(current => ({
      ...current,
      guiaBlocos: current.guiaBlocos.map((bloco, blocoAtualIndex) => (
        blocoAtualIndex === blocoIndex
          ? {
              ...bloco,
              itensVisuais: bloco.itensVisuais.map((item, itemAtualIndex) => (
                itemAtualIndex === itemIndex ? { ...item, [campo]: valor } : item
              )),
            }
          : bloco
      )),
    }))
  }

  function adicionarItemVisualGuia(blocoIndex) {
    setForm(current => ({
      ...current,
      guiaBlocos: current.guiaBlocos.map((bloco, blocoAtualIndex) => (
        blocoAtualIndex === blocoIndex
          ? {
              ...bloco,
              itensVisuais: [...bloco.itensVisuais, criarItemVisualGuiaVazio(bloco.itensVisuais.length)],
            }
          : bloco
      )),
    }))
  }

  function removerItemVisualGuia(blocoIndex, itemIndex) {
    setForm(current => ({
      ...current,
      guiaBlocos: current.guiaBlocos.map((bloco, blocoAtualIndex) => (
        blocoAtualIndex === blocoIndex
          ? {
              ...bloco,
              itensVisuais: bloco.itensVisuais.filter((_, itemAtualIndex) => itemAtualIndex !== itemIndex),
            }
          : bloco
      )),
    }))
  }

  async function handleBlocoGuiaImagemUpload(index, event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingGuiaField(`guia-imagem-${index}`)

    try {
      const resposta = await uploadService.enviarImagem(file)
      atualizarBlocoGuia(index, 'imagemUrl', resposta.url || '')
      show('Imagem do guia enviada com sucesso.')
    } catch (error) {
      show(getApiErrorMessage(error, 'Nao foi possivel enviar a imagem do guia.'), 'error')
    } finally {
      setUploadingGuiaField('')
      event.target.value = ''
    }
  }

  async function handleItemVisualGuiaImagemUpload(blocoIndex, itemIndex, event) {
    const file = event.target.files?.[0]
    if (!file) return

    const fieldKey = `guia-item-imagem-${blocoIndex}-${itemIndex}`
    setUploadingGuiaField(fieldKey)

    try {
      const resposta = await uploadService.enviarImagem(file)
      atualizarItemVisualGuia(blocoIndex, itemIndex, 'imagemUrl', resposta.url || '')
      show('Imagem do item visual enviada com sucesso.')
    } catch (error) {
      show(getApiErrorMessage(error, 'Nao foi possivel enviar a imagem do item visual.'), 'error')
    } finally {
      setUploadingGuiaField('')
      event.target.value = ''
    }
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

            <div className="form-group">
              <label className="form-label">Formato do modulo</label>
              <div className="admin-modulos-format-grid">
                {FORMATOS_MODULO.map(opcao => (
                  <button
                    key={opcao.value}
                    type="button"
                    className={`admin-modulos-format-option${form.formatoExperiencia === opcao.value ? ' is-active' : ''}`}
                    onClick={() => setForm(current => ({
                      ...current,
                      formatoExperiencia: opcao.value,
                      guiaBlocos: moduloTemGuia(opcao.value) && current.guiaBlocos.length === 0
                        ? [criarBlocoGuiaVazio(0)]
                        : current.guiaBlocos,
                    }))}
                  >
                    <strong>{opcao.title}</strong>
                    <span>{opcao.copy}</span>
                  </button>
                ))}
              </div>
            </div>

            {moduloTemGuia(form.formatoExperiencia) && (
              <div className="form-group">
                <label className="form-label">Grupos que liberam o guia</label>
                <div className="section-copy" style={{ marginBottom: '0.7rem' }}>
                  O modulo ainda organiza as aulas. Esta selecao define quais planos tambem enxergam o guia pratico quando ele nao tiver aulas vinculadas.
                </div>

                {gruposAcesso.length ? (
                  <div className="admin-access-grid">
                    {gruposAcesso.map(grupo => {
                      const selecionado = form.gruposAcessoIds.includes(grupo.id)

                      return (
                        <label key={grupo.id} className={`admin-access-item${selecionado ? ' is-selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selecionado}
                            onChange={() => alternarGrupoAcesso(grupo.id)}
                          />
                          <div className="admin-access-item-body">
                            <div className="admin-access-item-title-row">
                              <span className="admin-access-item-title">{grupo.nome}</span>
                              {!grupo.ativo && <span className="card-tag">Inativo</span>}
                            </div>
                            <div className="admin-access-item-copy">
                              {grupo.descricao?.trim() || grupo.codigo}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div className="admin-inline-note">
                    <strong>Nenhum grupo de acesso cadastrado.</strong>
                    <span> Crie primeiro os grupos para poder liberar guias por plano.</span>
                  </div>
                )}

                <div className="mini-copy" style={{ marginTop: '0.55rem' }}>
                  Liberando agora: {gruposAcesso.filter(grupo => form.gruposAcessoIds.includes(grupo.id)).map(grupo => grupo.nome).join(', ') || 'nenhum grupo marcado ainda.'}
                </div>
              </div>
            )}

            {moduloTemGuia(form.formatoExperiencia) ? (
              <div className="admin-modulos-guide-editor">
                <div className="admin-modulos-guide-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 17 }}>Guia pratico</div>
                    <div className="section-copy">Crie passos curtos para o aluno consultar rapido dentro da Biblioteca.</div>
                  </div>
                  <button className="btn btn-ghost" type="button" onClick={adicionarBlocoGuia}>
                    Adicionar bloco
                  </button>
                </div>

                {form.guiaBlocos.length ? (
                  <div className="admin-modulos-guide-list">
                    {form.guiaBlocos.map((bloco, index) => (
                      <div key={index} className="admin-modulos-guide-block">
                        <div className="admin-modulos-guide-block-head">
                          <span>Bloco {index + 1}</span>
                          <button className="btn btn-ghost" type="button" onClick={() => removerBlocoGuia(index)}>
                            Remover
                          </button>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Titulo do bloco</label>
                          <input
                            className="form-input"
                            value={bloco.titulo}
                            onChange={event => atualizarBlocoGuia(index, 'titulo', event.target.value)}
                            placeholder="Ex.: Antes de sair de casa"
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Descricao curta</label>
                          <textarea
                            className="form-textarea admin-modulos-guide-textarea"
                            value={bloco.descricao}
                            onChange={event => atualizarBlocoGuia(index, 'descricao', event.target.value)}
                            placeholder="Explique de forma objetiva o que o aluno precisa fazer."
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Texto introdutorio do passo</label>
                          <textarea
                            className="form-textarea admin-modulos-guide-detail-textarea"
                            value={bloco.textoDetalhado}
                            onChange={event => atualizarBlocoGuia(index, 'textoDetalhado', event.target.value)}
                            placeholder="Opcional. Esse texto aparece no topo do modal antes do checklist visual."
                          />
                        </div>

                        <div className="admin-modulos-guide-media-grid">
                          <div className="form-group">
                            <label className="form-label">Imagem principal do passo</label>
                            <div className="question-media-stack admin-modulos-guide-upload-stack">
                              <input
                                className="form-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={event => handleBlocoGuiaImagemUpload(index, event)}
                                disabled={uploadingGuiaField === `guia-imagem-${index}`}
                              />
                              <div className="mini-copy">
                                {uploadingGuiaField === `guia-imagem-${index}`
                                  ? 'Enviando imagem...'
                                  : 'Opcional. Se este passo nao tiver checklist visual, essa imagem vira a ilustracao principal do modal.'}
                              </div>
                              {bloco.imagemUrl ? (
                                <div className="question-media-preview-wrap">
                                  <img
                                    src={resolveMediaUrl(bloco.imagemUrl)}
                                    alt={bloco.imagemLegenda || bloco.titulo || `Preview do bloco ${index + 1}`}
                                    className="question-media-preview question-media-preview--option admin-modulos-guide-image-preview"
                                  />
                                  <button
                                    className="btn btn-ghost"
                                    type="button"
                                    onClick={() => atualizarBlocoGuia(index, 'imagemUrl', '')}
                                  >
                                    Remover imagem
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Imagem principal (URL)</label>
                            <input
                              className="form-input"
                              value={bloco.imagemUrl}
                              onChange={event => atualizarBlocoGuia(index, 'imagemUrl', event.target.value)}
                              placeholder="https://..."
                            />
                            <div className="mini-copy">Aceita `/media/...` ou uma URL externa publica.</div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Legenda da imagem</label>
                            <input
                              className="form-input"
                              value={bloco.imagemLegenda}
                              onChange={event => atualizarBlocoGuia(index, 'imagemLegenda', event.target.value)}
                              placeholder="Ex.: Exemplo de documento aceito"
                            />
                          </div>
                        </div>

                        <div className="admin-modulos-guide-items-editor">
                          <div className="admin-modulos-guide-items-head">
                            <div>
                              <div className="section-heading" style={{ fontSize: 15 }}>Checklist visual</div>
                              <div className="section-copy">Monte varios itens pequenos com imagem e texto, como um passo a passo visual.</div>
                            </div>
                            <button className="btn btn-ghost" type="button" onClick={() => adicionarItemVisualGuia(index)}>
                              Adicionar item visual
                            </button>
                          </div>

                          {bloco.itensVisuais.length ? (
                            <div className="admin-modulos-guide-items-list">
                              {bloco.itensVisuais.map((item, itemIndex) => (
                                <div key={`${index}-${itemIndex}`} className="admin-modulos-guide-item-card">
                                  <div className="admin-modulos-guide-item-head">
                                    <span>Item visual {itemIndex + 1}</span>
                                    <button className="btn btn-ghost" type="button" onClick={() => removerItemVisualGuia(index, itemIndex)}>
                                      Remover item
                                    </button>
                                  </div>

                                  <div className="form-row">
                                    <div className="form-group">
                                      <label className="form-label">Titulo do item</label>
                                      <input
                                        className="form-input"
                                        value={item.titulo}
                                        onChange={event => atualizarItemVisualGuia(index, itemIndex, 'titulo', event.target.value)}
                                        placeholder="Ex.: Identidade original"
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label">Ordem</label>
                                      <input
                                        className="form-input"
                                        type="number"
                                        min="0"
                                        value={item.ordemExibicao}
                                        onChange={event => atualizarItemVisualGuia(index, itemIndex, 'ordemExibicao', event.target.value)}
                                      />
                                    </div>
                                  </div>

                                  <div className="form-group">
                                    <label className="form-label">Texto curto</label>
                                    <textarea
                                      className="form-textarea admin-modulos-guide-item-textarea"
                                      value={item.descricao}
                                      onChange={event => atualizarItemVisualGuia(index, itemIndex, 'descricao', event.target.value)}
                                      placeholder="Ex.: RG/CNH original com foto e em bom estado."
                                    />
                                  </div>

                                  <div className="admin-modulos-guide-media-grid admin-modulos-guide-media-grid--items">
                                    <div className="form-group">
                                      <label className="form-label">Upload da imagem do item</label>
                                      <div className="question-media-stack admin-modulos-guide-upload-stack">
                                        <input
                                          className="form-input"
                                          type="file"
                                          accept="image/png,image/jpeg,image/webp"
                                          onChange={event => handleItemVisualGuiaImagemUpload(index, itemIndex, event)}
                                          disabled={uploadingGuiaField === `guia-item-imagem-${index}-${itemIndex}`}
                                        />
                                        <div className="mini-copy">
                                          {uploadingGuiaField === `guia-item-imagem-${index}-${itemIndex}`
                                            ? 'Enviando imagem...'
                                            : 'O upload preenche a URL automaticamente. Se preferir, cole um link manual.'}
                                        </div>
                                        {item.imagemUrl ? (
                                          <div className="question-media-preview-wrap">
                                            <img
                                              src={resolveMediaUrl(item.imagemUrl)}
                                              alt={item.imagemLegenda || item.titulo || `Preview do item ${itemIndex + 1}`}
                                              className="question-media-preview question-media-preview--option admin-modulos-guide-image-preview"
                                            />
                                            <button
                                              className="btn btn-ghost"
                                              type="button"
                                              onClick={() => atualizarItemVisualGuia(index, itemIndex, 'imagemUrl', '')}
                                            >
                                              Remover imagem
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="form-group">
                                      <label className="form-label">Imagem do item (URL)</label>
                                      <input
                                        className="form-input"
                                        value={item.imagemUrl}
                                        onChange={event => atualizarItemVisualGuia(index, itemIndex, 'imagemUrl', event.target.value)}
                                        placeholder="https://..."
                                      />
                                      <div className="mini-copy">Aceita `/media/...` ou uma URL publica.</div>
                                    </div>

                                    <div className="form-group">
                                      <label className="form-label">Legenda da imagem</label>
                                      <input
                                        className="form-input"
                                        value={item.imagemLegenda}
                                        onChange={event => atualizarItemVisualGuia(index, itemIndex, 'imagemLegenda', event.target.value)}
                                        placeholder="Ex.: Documento valido e legivel"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="admin-modulos-guide-empty">
                              Nenhum item visual criado ainda. Use essa area para montar checklists com varias imagens pequenas dentro do modal.
                            </div>
                          )}
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Tipo visual</label>
                            <select
                              className="form-select"
                              value={bloco.icone}
                              onChange={event => atualizarBlocoGuia(index, 'icone', event.target.value)}
                            >
                              {GUIA_ICONE_OPTIONS.map(opcao => (
                                <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Ordem</label>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={bloco.ordemExibicao}
                              onChange={event => atualizarBlocoGuia(index, 'ordemExibicao', event.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="admin-modulos-guide-empty">
                    Nenhum bloco criado ainda. Use "Adicionar bloco" para montar o guia deste modulo.
                  </div>
                )}
              </div>
            ) : null}

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
                      disabled={!categoriaDestinoId || movendo || salvando || excluindo || Boolean(uploadingGuiaField)}
                    >
                      {movendo ? 'Movendo...' : `Mover ${categoriaEmEdicao.totalAulas} aula(s)`}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={salvando || movendo || excluindo || Boolean(uploadingGuiaField)}>
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
                  disabled={excluindo || salvando || movendo || Boolean(uploadingGuiaField)}
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
