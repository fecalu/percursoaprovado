import { useEffect, useMemo, useState } from 'react'
import { grupoAcessoService, percursoService } from '../services/api'
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

function criarFormularioVazio(grupos = []) {
  const proximaOrdem = grupos.reduce((maior, item) => Math.max(maior, Number(item.ordemExibicao) || 0), -1) + 1

  return {
    codigo: '',
    nome: '',
    descricao: '',
    ordemExibicao: String(Math.max(0, proximaOrdem)),
    ativo: true,
  }
}

function formatarUsoGrupo(totalAulas) {
  if (!totalAulas) return 'Grupo sem aulas vinculadas'
  return totalAulas === 1 ? '1 aula vinculada' : `${totalAulas} aulas vinculadas`
}

export default function AdminGruposAcesso() {
  const [grupos, setGrupos] = useState([])
  const [form, setForm] = useState(criarFormularioVazio())
  const [edicaoId, setEdicaoId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const { show, ToastEl } = useToast()

  const grupoEmEdicao = useMemo(
    () => grupos.find(item => item.id === edicaoId) || null,
    [grupos, edicaoId]
  )

  useEffect(() => {
    carregar()
  }, [])

  async function carregar(preferirId = null) {
    try {
      const [gruposResp, percursosResp] = await Promise.all([
        grupoAcessoService.listar(),
        percursoService.listar({ todos: true }),
      ])

      const usoPorGrupo = percursosResp.reduce((acc, percurso) => {
        const ids = Array.isArray(percurso.gruposAcessoIds) ? percurso.gruposAcessoIds : []
        ids.forEach(id => {
          acc[id] = (acc[id] || 0) + 1
        })
        return acc
      }, {})

      const lista = gruposResp.map(grupo => ({
        ...grupo,
        totalAulas: usoPorGrupo[grupo.id] || 0,
      }))

      setGrupos(lista)

      const grupoPreferido = preferirId
        ? lista.find(item => item.id === preferirId)
        : null

      if (grupoPreferido) {
        selecionar(grupoPreferido)
        return
      }

      const grupoAtual = edicaoId
        ? lista.find(item => item.id === edicaoId)
        : null

      if (grupoAtual) {
        selecionar(grupoAtual)
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

  function selecionar(grupo) {
    setEdicaoId(grupo.id)
    setForm({
      codigo: grupo.codigo || '',
      nome: grupo.nome || '',
      descricao: grupo.descricao || '',
      ordemExibicao: String(grupo.ordemExibicao ?? 0),
      ativo: grupo.ativo ?? true,
    })
  }

  function resetar(listaAtual = grupos) {
    setEdicaoId(null)
    setForm(criarFormularioVazio(listaAtual))
  }

  async function salvar(event) {
    event.preventDefault()

    const nome = form.nome.trim()
    const codigo = form.codigo.trim()

    if (!nome) {
      show('Informe o nome do grupo de acesso.', 'error')
      return
    }

    if (!codigo) {
      show('Informe o codigo do grupo de acesso.', 'error')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        nome,
        codigo,
        descricao: form.descricao.trim() || null,
        ordemExibicao: Number(form.ordemExibicao) || 0,
        ativo: form.ativo,
      }

      const resposta = edicaoId
        ? await grupoAcessoService.atualizar(edicaoId, payload)
        : await grupoAcessoService.criar(payload)

      show(edicaoId ? 'Grupo de acesso atualizado com sucesso.' : 'Grupo de acesso criado com sucesso.')
      await carregar(resposta.id)
    } catch (error) {
      show(getApiErrorMessage(error, 'Nao foi possivel salvar o grupo de acesso.'), 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function excluirGrupo() {
    if (!edicaoId) return

    const nomeGrupo = grupoEmEdicao?.nome || form.nome.trim() || 'este grupo de acesso'
    const confirmou = window.confirm(`Excluir o grupo de acesso "${nomeGrupo}"? A exclusao so sera concluida se ele nao estiver vinculado a nenhuma aula.`)

    if (!confirmou) return

    setExcluindo(true)
    try {
      await grupoAcessoService.excluir(edicaoId)
      show('Grupo de acesso excluido com sucesso.')
      setEdicaoId(null)
      await carregar()
    } catch (error) {
      show(getApiErrorMessage(error, 'Nao foi possivel excluir o grupo de acesso.'), 'error')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Grupos de acesso</div>
      <p className="page-sub">Defina a camada de acesso que os planos vao liberar e que as aulas vao usar. Isso controla acesso, nao a exibicao visual.</p>

      <div className="admin-grid">
        <div className="card">
          <div className="admin-page-head">
            <div>
              <div className="section-heading">Lista de grupos</div>
              <div className="section-copy">Use grupos para separar partes da jornada, como documentos, pratica geral, percursos do local e revisao final.</div>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => resetar()}>
              Novo grupo
            </button>
          </div>

          <div className="admin-inline-note" style={{ marginTop: '0.55rem' }}>
            <strong>Total:</strong> {grupos.length} grupo(s). Eles serao a camada que define quem pode ver cada conteudo.
          </div>

          {loading ? (
            <div className="spinner" />
          ) : grupos.length ? (
            <div className="admin-modulos-list">
              {grupos.map(grupo => (
                <button
                  key={grupo.id}
                  type="button"
                  className={`admin-modulos-item${edicaoId === grupo.id ? ' is-active' : ''}`}
                  onClick={() => selecionar(grupo)}
                >
                  <div className="admin-modulos-item-head">
                    <div className="admin-modulos-item-title">{grupo.nome}</div>
                    <span className="card-tag">Ordem {grupo.ordemExibicao ?? 0}</span>
                  </div>
                  <div className="admin-modulos-item-copy">
                    <strong>{grupo.codigo}</strong>
                    {grupo.descricao?.trim() ? ` - ${grupo.descricao}` : ' - Sem descricao definida.'}
                  </div>
                  <div className="mini-copy" style={{ marginTop: '0.4rem' }}>
                    {formatarUsoGrupo(grupo.totalAulas)} • {grupo.ativo ? 'Ativo' : 'Inativo'}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="admin-modulos-empty">
              <div className="section-heading" style={{ fontSize: 18 }}>Nenhum grupo cadastrado</div>
              <div className="section-copy">Crie os grupos iniciais para comecar a separar o acesso por jornada e nao depender so do local.</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title-row" style={{ marginBottom: '0.85rem' }}>
            <div>
              <div className="section-heading">{edicaoId ? 'Editar grupo de acesso' : 'Novo grupo de acesso'}</div>
              <div className="section-copy">O codigo deve ser curto e estavel. O nome pode ser mais humano e orientado para o negocio.</div>
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
                  placeholder="Ex.: Documentos e taxas"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Codigo</label>
                <input
                  className="form-input"
                  value={form.codigo}
                  onChange={event => setForm(current => ({ ...current, codigo: event.target.value }))}
                  placeholder="Ex.: documentos_taxas"
                />
                <div className="mini-copy">Use letras minusculas, numeros e underscore. O backend normaliza esse valor.</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descricao</label>
              <textarea
                className="form-textarea admin-modulos-textarea"
                value={form.descricao}
                onChange={event => setForm(current => ({ ...current, descricao: event.target.value }))}
                placeholder="Explique quando esse grupo deve ser liberado por um plano."
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
                  <span className="mini-copy">Grupo ativo</span>
                </label>
              </div>
            </div>

            <div className="admin-inline-note admin-modulos-preview">
              <strong>Exemplo de uso:</strong>
              <span>Plano do zero &gt; libera {form.nome.trim() || 'este grupo'}</span>
              <span>Aula &gt; entra em {form.nome.trim() || 'este grupo'} para definir quem pode assistir</span>
            </div>

            {edicaoId ? (
              <div className="mini-copy" style={{ marginTop: '0.85rem' }}>
                {grupoEmEdicao?.totalAulas
                  ? `Este grupo esta em uso em ${grupoEmEdicao.totalAulas} aula(s). Ele so pode ser excluido depois que sair dessas aulas.`
                  : 'Este grupo nao esta vinculado a nenhuma aula e pode ser excluido com seguranca.'}
              </div>
            ) : null}

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={salvando || excluindo}>
                {salvando ? 'Salvando...' : edicaoId ? 'Salvar alteracoes' : 'Criar grupo'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => resetar()}>
                Novo grupo
              </button>
              {edicaoId ? (
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={excluirGrupo}
                  disabled={salvando || excluindo}
                >
                  {excluindo ? 'Excluindo...' : 'Excluir grupo'}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
