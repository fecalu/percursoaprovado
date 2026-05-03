import { useEffect, useMemo, useState } from 'react'
import { grupoAcessoService, trilhaService } from '../services/api'
import { useToast } from '../hooks/useToast'

function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data
  const status = error?.response?.status

  if (status === 403) {
    return 'Sua sessao de administrador expirou ou nao tem permissao para esta acao. Entre novamente.'
  }

  if (typeof data?.erro === 'string' && data.erro.trim()) {
    return data.erro
  }

  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message
  }

  if (data && typeof data === 'object') {
    const firstFieldError = Object.values(data).find(value => typeof value === 'string' && value.trim())
    if (firstFieldError) {
      return firstFieldError
    }
  }

  return error?.message || fallback
}

function criarEtapaVazia(grupos = [], etapas = []) {
  const usados = new Set(etapas.map(item => item.grupoAcessoId).filter(Boolean))
  const grupoSugerido = grupos.find(item => item.ativo && !usados.has(item.id))
    || grupos.find(item => !usados.has(item.id))
    || grupos[0]

  const proximaOrdem = etapas.reduce((maior, item) => Math.max(maior, Number(item.ordemExibicao) || 0), 0) + 1

  return {
    id: null,
    grupoAcessoId: grupoSugerido?.id || '',
    titulo: grupoSugerido?.nome || '',
    resumo: grupoSugerido?.descricao || '',
    ordemExibicao: String(proximaOrdem),
    ativo: true,
  }
}

function criarFormularioVazio(trilhas = [], grupos = []) {
  const proximaOrdem = trilhas.reduce((maior, item) => Math.max(maior, Number(item.ordemExibicao) || 0), 0) + 1

  return {
    codigo: '',
    nome: '',
    descricao: '',
    ordemExibicao: String(proximaOrdem),
    ativo: true,
    etapas: grupos.length ? [criarEtapaVazia(grupos)] : [],
  }
}

function formatarUsoTrilha(totalEtapas, ativa) {
  const etapasTexto = totalEtapas === 1 ? '1 etapa' : `${totalEtapas} etapas`
  return `${etapasTexto} - ${ativa ? 'Ativa' : 'Inativa'}`
}

export default function AdminTrilhas() {
  const [trilhas, setTrilhas] = useState([])
  const [grupos, setGrupos] = useState([])
  const [form, setForm] = useState(criarFormularioVazio())
  const [edicaoId, setEdicaoId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const { show, ToastEl } = useToast()

  const trilhaEmEdicao = useMemo(
    () => trilhas.find(item => item.id === edicaoId) || null,
    [trilhas, edicaoId]
  )

  useEffect(() => {
    carregar()
  }, [])

  async function carregar(preferirId = null) {
    try {
      const [trilhasResp, gruposResp] = await Promise.all([
        trilhaService.listarAdmin(),
        grupoAcessoService.listar(),
      ])

      setTrilhas(trilhasResp)
      setGrupos(gruposResp)

      const trilhaPreferida = preferirId
        ? trilhasResp.find(item => item.id === preferirId)
        : null

      if (trilhaPreferida) {
        selecionar(trilhaPreferida, gruposResp)
        return
      }

      const trilhaAtual = edicaoId
        ? trilhasResp.find(item => item.id === edicaoId)
        : null

      if (trilhaAtual) {
        selecionar(trilhaAtual, gruposResp)
        return
      }

      if (trilhasResp.length) {
        selecionar(trilhasResp[0], gruposResp)
        return
      }

      resetar(trilhasResp, gruposResp)
    } finally {
      setLoading(false)
    }
  }

  function selecionar(trilha, gruposDisponiveis = grupos) {
    setEdicaoId(trilha.id)
    setForm({
      codigo: trilha.codigo || '',
      nome: trilha.nome || '',
      descricao: trilha.descricao || '',
      ordemExibicao: String(trilha.ordemExibicao ?? 0),
      ativo: trilha.ativo ?? true,
      etapas: Array.isArray(trilha.etapas) && trilha.etapas.length
        ? trilha.etapas.map(etapa => ({
            id: etapa.id || null,
            grupoAcessoId: etapa.grupoAcessoId || '',
            titulo: etapa.titulo || '',
            resumo: etapa.resumo || '',
            ordemExibicao: String(etapa.ordemExibicao ?? 0),
            ativo: etapa.ativo ?? true,
          }))
        : (gruposDisponiveis.length ? [criarEtapaVazia(gruposDisponiveis)] : []),
    })
  }

  function resetar(listaAtual = trilhas, gruposDisponiveis = grupos) {
    setEdicaoId(null)
    setForm(criarFormularioVazio(listaAtual, gruposDisponiveis))
  }

  function atualizarEtapa(index, campo, valor) {
    setForm(current => ({
      ...current,
      etapas: current.etapas.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        let proximoItem = { ...item, [campo]: valor }
        if (campo === 'grupoAcessoId') {
          const grupoSelecionado = grupos.find(grupo => grupo.id === valor)
          if (grupoSelecionado && !item.titulo.trim()) {
            proximoItem.titulo = grupoSelecionado.nome || item.titulo
          }
        }

        return proximoItem
      }),
    }))
  }

  function adicionarEtapa() {
    if (!grupos.length) {
      show('Cadastre pelo menos um grupo de acesso antes de montar a trilha.', 'error')
      return
    }

    setForm(current => ({
      ...current,
      etapas: [...current.etapas, criarEtapaVazia(grupos, current.etapas)],
    }))
  }

  function removerEtapa(index) {
    setForm(current => {
      const etapas = current.etapas.filter((_, itemIndex) => itemIndex !== index)
      return {
        ...current,
        etapas,
      }
    })
  }

  function moverEtapa(index, direcao) {
    setForm(current => {
      const destino = index + direcao
      if (destino < 0 || destino >= current.etapas.length) {
        return current
      }

      const etapas = [...current.etapas]
      const [etapa] = etapas.splice(index, 1)
      etapas.splice(destino, 0, etapa)

      return {
        ...current,
        etapas: etapas.map((item, itemIndex) => ({
          ...item,
          ordemExibicao: String(itemIndex + 1),
        })),
      }
    })
  }

  async function salvar(event) {
    event.preventDefault()

    const nome = form.nome.trim()
    const codigo = form.codigo.trim()

    if (!nome) {
      show('Informe o nome da trilha.', 'error')
      return
    }

    if (!codigo) {
      show('Informe o codigo da trilha.', 'error')
      return
    }

    if (!form.etapas.length) {
      show('Adicione pelo menos uma etapa na trilha.', 'error')
      return
    }

    for (const etapa of form.etapas) {
      if (!etapa.grupoAcessoId) {
        show('Selecione um grupo de acesso para todas as etapas.', 'error')
        return
      }

      if (!etapa.titulo.trim()) {
        show('Preencha o titulo de todas as etapas.', 'error')
        return
      }
    }

    setSalvando(true)
    try {
      const payload = {
        codigo,
        nome,
        descricao: form.descricao.trim() || null,
        ordemExibicao: Number(form.ordemExibicao) || 0,
        ativo: form.ativo,
        etapas: form.etapas.map((etapa, index) => ({
          id: etapa.id || undefined,
          grupoAcessoId: etapa.grupoAcessoId,
          titulo: etapa.titulo.trim(),
          resumo: etapa.resumo.trim() || null,
          ordemExibicao: Number(etapa.ordemExibicao) || index + 1,
          ativo: etapa.ativo,
        })),
      }

      const resposta = edicaoId
        ? await trilhaService.atualizar(edicaoId, payload)
        : await trilhaService.criar(payload)

      show(edicaoId ? 'Trilha atualizada com sucesso.' : 'Trilha criada com sucesso.')
      await carregar(resposta.id)
    } catch (error) {
      show(getApiErrorMessage(error, 'Nao foi possivel salvar a trilha.'), 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function excluirTrilha() {
    if (!edicaoId) return

    const nomeTrilha = trilhaEmEdicao?.nome || form.nome.trim() || 'esta trilha'
    const confirmou = window.confirm(`Excluir a trilha "${nomeTrilha}"?`)

    if (!confirmou) return

    setExcluindo(true)
    try {
      await trilhaService.excluir(edicaoId)
      show('Trilha excluida com sucesso.')
      setEdicaoId(null)
      await carregar()
    } catch (error) {
      show(getApiErrorMessage(error, 'Nao foi possivel excluir a trilha.'), 'error')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Trilhas</div>
      <p className="page-sub">Organize a ordem recomendada de estudo para cada tipo de aluno. Cada etapa aponta para um grupo de acesso.</p>

      <div className="admin-grid">
        <div className="card">
          <div className="admin-page-head">
            <div>
              <div className="section-heading">Lista de trilhas</div>
              <div className="section-copy">Use trilhas para orientar quem quer seguir um caminho completo, sem tirar os atalhos rapidos da biblioteca.</div>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => resetar()}>
              Nova trilha
            </button>
          </div>

          <div className="admin-inline-note" style={{ marginTop: '0.55rem' }}>
            <strong>Total:</strong> {trilhas.length} trilha(s). A principal sugestao agora e manter pelo menos <strong>Comecando do zero</strong> e <strong>Reta final para a prova</strong>.
          </div>

          {loading ? (
            <div className="spinner" />
          ) : trilhas.length ? (
            <div className="admin-modulos-list">
              {trilhas.map(trilha => (
                <button
                  key={trilha.id}
                  type="button"
                  className={`admin-modulos-item${edicaoId === trilha.id ? ' is-active' : ''}`}
                  onClick={() => selecionar(trilha)}
                >
                  <div className="admin-modulos-item-head">
                    <div className="admin-modulos-item-title">{trilha.nome}</div>
                    <span className="card-tag">Ordem {trilha.ordemExibicao ?? 0}</span>
                  </div>
                  <div className="admin-modulos-item-copy">
                    <strong>{trilha.codigo}</strong>
                    {trilha.descricao?.trim() ? ` - ${trilha.descricao}` : ' - Sem descricao definida.'}
                  </div>
                  <div className="mini-copy" style={{ marginTop: '0.4rem' }}>
                    {formatarUsoTrilha(Array.isArray(trilha.etapas) ? trilha.etapas.length : 0, trilha.ativo)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="admin-modulos-empty">
              <div className="section-heading" style={{ fontSize: 18 }}>Nenhuma trilha cadastrada</div>
              <div className="section-copy">Crie uma trilha para orientar o aluno do primeiro passo ate a prova, ou para focar so na reta final.</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title-row" style={{ marginBottom: '0.85rem' }}>
            <div>
              <div className="section-heading">{edicaoId ? 'Editar trilha' : 'Nova trilha'}</div>
              <div className="section-copy">Defina nome, codigo, ordem e as etapas que vao conduzir o aluno pelos grupos certos.</div>
            </div>
          </div>

          <form onSubmit={salvar}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input
                  className="form-input"
                  value={form.nome}
                  onChange={event => setForm(current => ({ ...current, nome: event.target.value }))}
                  placeholder="Ex.: Comecando do zero"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Codigo</label>
                <input
                  className="form-input"
                  value={form.codigo}
                  onChange={event => setForm(current => ({ ...current, codigo: event.target.value }))}
                  placeholder="Ex.: comecando_do_zero"
                />
                <div className="mini-copy">Use um codigo tecnico curto. O backend normaliza esse valor.</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descricao</label>
              <textarea
                className="form-textarea admin-modulos-textarea"
                value={form.descricao}
                onChange={event => setForm(current => ({ ...current, descricao: event.target.value }))}
                placeholder="Explique em uma frase para quem essa trilha existe."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ordem de exibicao</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={form.ordemExibicao}
                  onChange={event => setForm(current => ({ ...current, ordemExibicao: event.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={event => setForm(current => ({ ...current, ativo: event.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                  />
                  <span className="mini-copy">Trilha ativa</span>
                </label>
              </div>
            </div>

            <div className="admin-inline-note admin-modulos-preview">
              <strong>Como essa trilha aparece:</strong>
              <span>Painel do aluno &gt; Sua trilha &gt; {form.nome.trim() || 'Nome da trilha'}</span>
              <span>Biblioteca &gt; Sua jornada na biblioteca &gt; {form.nome.trim() || 'Nome da trilha'}</span>
            </div>

            <div className="section-title-row admin-trilha-stage-head">
              <div>
                <div className="section-heading">Etapas da trilha</div>
                <div className="section-copy">Cada etapa aponta para um grupo de acesso e ajuda o aluno a entender a ordem recomendada.</div>
              </div>
              <button className="btn btn-ghost" type="button" onClick={adicionarEtapa}>
                Nova etapa
              </button>
            </div>

            {form.etapas.length ? (
              <div className="admin-trilha-stage-list">
                {form.etapas.map((etapa, index) => {
                  const gruposUsados = new Set(
                    form.etapas
                      .filter((_, itemIndex) => itemIndex !== index)
                      .map(item => item.grupoAcessoId)
                      .filter(Boolean)
                  )

                  return (
                    <div key={etapa.id || `nova-etapa-${index}`} className="admin-trilha-stage-card">
                      <div className="admin-trilha-stage-top">
                        <div className="admin-trilha-stage-order">Etapa {index + 1}</div>
                        <div className="admin-trilha-stage-actions">
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => moverEtapa(index, -1)} disabled={index === 0}>
                            Subir
                          </button>
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => moverEtapa(index, 1)} disabled={index === form.etapas.length - 1}>
                            Descer
                          </button>
                          <button className="btn btn-danger btn-sm" type="button" onClick={() => removerEtapa(index)} disabled={form.etapas.length === 1}>
                            Remover
                          </button>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Grupo de acesso</label>
                          <select
                            className="form-select"
                            value={etapa.grupoAcessoId}
                            onChange={event => atualizarEtapa(index, 'grupoAcessoId', event.target.value)}
                          >
                            <option value="">Selecione um grupo</option>
                            {grupos.map(grupo => (
                              <option
                                key={grupo.id}
                                value={grupo.id}
                                disabled={gruposUsados.has(grupo.id)}
                              >
                                {grupo.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Titulo da etapa</label>
                          <input
                            className="form-input"
                            value={etapa.titulo}
                            onChange={event => atualizarEtapa(index, 'titulo', event.target.value)}
                            placeholder="Ex.: Documentos e taxas"
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Resumo</label>
                          <textarea
                            className="form-textarea admin-trilha-stage-textarea"
                            value={etapa.resumo}
                            onChange={event => atualizarEtapa(index, 'resumo', event.target.value)}
                            placeholder="Explique rapidamente o foco desta etapa."
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Ordem</label>
                          <input
                            className="form-input"
                            type="number"
                            min="1"
                            value={etapa.ordemExibicao}
                            onChange={event => atualizarEtapa(index, 'ordemExibicao', event.target.value)}
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44, marginTop: 10 }}>
                            <input
                              type="checkbox"
                              checked={etapa.ativo}
                              onChange={event => atualizarEtapa(index, 'ativo', event.target.checked)}
                              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                            />
                            <span className="mini-copy">Etapa ativa</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="admin-modulos-empty">
                <div className="section-heading" style={{ fontSize: 18 }}>Sem etapas ainda</div>
                <div className="section-copy">Adicione pelo menos uma etapa para que essa trilha possa orientar o aluno.</div>
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={salvando || excluindo}>
                {salvando ? 'Salvando...' : edicaoId ? 'Salvar alteracoes' : 'Criar trilha'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => resetar()}>
                Nova trilha
              </button>
              {edicaoId ? (
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={excluirTrilha}
                  disabled={salvando || excluindo}
                >
                  {excluindo ? 'Excluindo...' : 'Excluir trilha'}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
