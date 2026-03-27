import { useEffect, useState } from 'react'
import { localProvaService, uploadService } from '../services/api'
import { useToast } from '../hooks/useToast'
import { formatStatusComercialLocal } from '../utils/formatters'
import { resolveMediaUrl } from '../utils/media'

const VAZIO = {
  nome: '',
  slug: '',
  descricao: '',
  cidade: 'Sao Luis',
  statusComercial: 'RASCUNHO',
  mensagemPublica: '',
  imagemPrincipalUrl: '',
  imagemCardUrl: '',
  tituloComercial: '',
  subtituloComercial: '',
  boxTitulo: '',
  boxItem1: '',
  boxItem2: '',
  boxItem3: '',
  boxObservacao: '',
  ordemExibicao: 0,
  ativo: true,
}

function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data
  const status = error?.response?.status

  if (status === 403) {
    return 'Sua sessao de administrador expirou ou nao tem permissao para esta acao. Entre novamente.'
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

export default function AdminLocais() {
  const [locais, setLocais] = useState([])
  const [form, setForm] = useState(VAZIO)
  const [edicaoId, setEdicaoId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const [extrasAbertos, setExtrasAbertos] = useState(false)
  const { show, ToastEl } = useToast()

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    try {
      setLocais(await localProvaService.listar({ todos: true }))
    } finally {
      setLoading(false)
    }
  }

  function editar(local) {
    setEdicaoId(local.id)
    setExtrasAbertos(Boolean(
      local.descricao ||
      local.boxTitulo ||
      local.boxItem1 ||
      local.boxItem2 ||
      local.boxItem3 ||
      local.boxObservacao
    ))
    setForm({
      nome: local.nome || '',
      slug: local.slug || '',
      descricao: local.descricao || '',
      cidade: local.cidade || 'Sao Luis',
      statusComercial: local.statusComercial || 'RASCUNHO',
      mensagemPublica: local.mensagemPublica || '',
      imagemPrincipalUrl: local.imagemPrincipalUrl || '',
      imagemCardUrl: local.imagemCardUrl || '',
      tituloComercial: local.tituloComercial || '',
      subtituloComercial: local.subtituloComercial || '',
      boxTitulo: local.boxTitulo || '',
      boxItem1: local.boxItem1 || '',
      boxItem2: local.boxItem2 || '',
      boxItem3: local.boxItem3 || '',
      boxObservacao: local.boxObservacao || '',
      ordemExibicao: local.ordemExibicao ?? 0,
      ativo: local.ativo ?? true,
    })
  }

  function resetar() {
    setEdicaoId(null)
    setExtrasAbertos(false)
    setForm(VAZIO)
  }

  async function enviarImagemPrincipal(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setEnviandoImagem(true)
    try {
      const uploaded = await uploadService.enviarThumbnail(file)
      setForm(current => ({ ...current, imagemPrincipalUrl: uploaded.url }))
      show('Imagem principal enviada com sucesso.')
    } catch (error) {
      show(getApiErrorMessage(error, 'Nao foi possivel enviar a imagem.'), 'error')
    } finally {
      setEnviandoImagem(false)
      event.target.value = ''
    }
  }

  async function enviarImagemCard(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setEnviandoImagem(true)
    try {
      const uploaded = await uploadService.enviarThumbnail(file)
      setForm(current => ({ ...current, imagemCardUrl: uploaded.url }))
      show('Imagem do card enviada com sucesso.')
    } catch (error) {
      show(getApiErrorMessage(error, 'Nao foi possivel enviar a imagem do card.'), 'error')
    } finally {
      setEnviandoImagem(false)
      event.target.value = ''
    }
  }

  async function salvar(event) {
    event.preventDefault()
    const nome = form.nome.trim()

    if (!nome) {
      show('Informe o nome do local.', 'error')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        ...form,
        nome,
        slug: form.slug.trim(),
        ordemExibicao: Number(form.ordemExibicao) || 0,
      }
      if (edicaoId) {
        await localProvaService.atualizar(edicaoId, payload)
        show('Local atualizado com sucesso.')
      } else {
        await localProvaService.criar(payload)
        show('Local criado com sucesso.')
      }
      resetar()
      await carregar()
    } catch (error) {
      show(getApiErrorMessage(error, 'Erro ao salvar local.'), 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(local) {
    if (!confirm(`Excluir o local "${local.nome}"?`)) return
    try {
      await localProvaService.excluir(local.id)
      show('Local excluido com sucesso.')
      if (edicaoId === local.id) resetar()
      await carregar()
    } catch (error) {
      show(getApiErrorMessage(error, 'Erro ao excluir local.'), 'error')
    }
  }

  const exibirMensagemPublica = form.statusComercial !== 'DISPONIVEL' || Boolean(form.mensagemPublica)

  return (
    <>
      {ToastEl}
      <div className="page-title">Locais de prova</div>
      <p className="page-sub">Cadastre os locais oficiais, defina a visibilidade comercial e controle quando cada um pode ser vendido.</p>

      <div className="admin-grid">
        <div className="card">
          <div className="section-heading">{edicaoId ? 'Editar local' : 'Novo local'}</div>
          <div className="admin-inline-note" style={{ marginTop: '0.55rem' }}>
            <strong>Obrigatorio:</strong> nome. <strong>Recomendado:</strong> cidade, status e textos da vitrine.
          </div>
          <form onSubmit={salvar} style={{ marginTop: '1rem' }}>
            <div className="section-title-row" style={{ marginBottom: '0.75rem' }}>
              <div>
                <div className="section-heading" style={{ fontSize: 18 }}>Identidade e status</div>
                <div className="section-copy">Esses campos definem o local, a ordem e se ele pode aparecer ou vender no site.</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input
                  className="form-input"
                  value={form.nome}
                  onChange={e => setForm(current => ({ ...current, nome: e.target.value }))}
                  placeholder="Ex.: Cohatrac / Cohab"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slug</label>
                <input
                  className="form-input"
                  value={form.slug}
                  onChange={e => setForm(current => ({ ...current, slug: e.target.value }))}
                  placeholder="Opcional, pode deixar em branco"
                />
                <div className="mini-copy">Se deixar vazio, o sistema gera automaticamente a partir do nome.</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cidade</label>
                <input
                  className="form-input"
                  value={form.cidade}
                  onChange={e => setForm(current => ({ ...current, cidade: e.target.value }))}
                  placeholder="Ex.: Sao Luis"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status comercial</label>
                <select className="form-select" value={form.statusComercial} onChange={e => setForm(current => ({ ...current, statusComercial: e.target.value }))}>
                  <option value="RASCUNHO">Rascunho</option>
                  <option value="EM_BREVE">Em breve</option>
                  <option value="DISPONIVEL">Disponivel</option>
                  <option value="PAUSADO">Pausado</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ordem</label>
                <input
                  className="form-input"
                  type="number"
                  value={form.ordemExibicao}
                  onChange={e => setForm(current => ({ ...current, ordemExibicao: e.target.value }))}
                />
                <div className="mini-copy">Menor numero aparece primeiro na home.</div>
              </div>
              <div className="form-group">
                <label className="form-label">Situacao do local</label>
                <label className="admin-inline-check">
                  <input type="checkbox" checked={form.ativo} onChange={e => setForm(current => ({ ...current, ativo: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  <span>Local ativo</span>
                </label>
                <div className="mini-copy">Se desativar, o local deixa de aparecer publicamente mesmo que o status esteja disponivel.</div>
              </div>
            </div>
            <div className="section-title-row" style={{ marginBottom: '0.75rem' }}>
              <div>
                <div className="section-heading" style={{ fontSize: 18 }}>Apresentacao do local</div>
                <div className="section-copy">Defina a imagem e os textos principais que aparecem na home e na pagina publica do local.</div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Upload da imagem principal</label>
              <input
                className="form-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={enviarImagemPrincipal}
                disabled={enviandoImagem}
              />
              <div className="mini-copy">
                {enviandoImagem ? 'Enviando imagem...' : 'Use uma imagem horizontal para acompanhar a apresentacao do local.'}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">URL da imagem principal</label>
              <input
                className="form-input"
                value={form.imagemPrincipalUrl}
                onChange={e => setForm(current => ({ ...current, imagemPrincipalUrl: e.target.value }))}
                placeholder="/media/thumbnails/... ou https://..."
              />
            </div>
            {form.imagemPrincipalUrl && (
              <div className="admin-image-preview">
                <img src={resolveMediaUrl(form.imagemPrincipalUrl)} alt={`Preview de ${form.nome || 'local de prova'}`} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Upload da imagem do card da home</label>
              <input
                className="form-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={enviarImagemCard}
                disabled={enviandoImagem}
              />
              <div className="mini-copy">
                Use uma imagem horizontal so para o card de Escolha o seu local.
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">URL da imagem do card da home</label>
              <input
                className="form-input"
                value={form.imagemCardUrl}
                onChange={e => setForm(current => ({ ...current, imagemCardUrl: e.target.value }))}
                placeholder="/media/thumbnails/... ou https://..."
              />
            </div>
            {form.imagemCardUrl && (
              <div className="admin-image-preview">
                <img src={resolveMediaUrl(form.imagemCardUrl)} alt={`Preview do card de ${form.nome || 'local de prova'}`} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Titulo comercial</label>
              <input
                className="form-input"
                value={form.tituloComercial}
                onChange={e => setForm(current => ({ ...current, tituloComercial: e.target.value }))}
                placeholder="Ex.: Prepare-se melhor para a prova no Cohatrac"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Subtitulo comercial</label>
              <textarea
                className="form-textarea"
                value={form.subtituloComercial}
                onChange={e => setForm(current => ({ ...current, subtituloComercial: e.target.value }))}
                placeholder="Ex.: Veja os percursos mais frequentes, pontos de atencao e erros que mais tiram pontos nesse local."
              />
            </div>
            {exibirMensagemPublica && (
              <div className="form-group">
                <label className="form-label">Mensagem publica de status</label>
                <textarea
                  className="form-textarea"
                  value={form.mensagemPublica}
                  onChange={e => setForm(current => ({ ...current, mensagemPublica: e.target.value }))}
                  placeholder="Ex.: Estamos finalizando os videos deste local."
                />
                <div className="mini-copy">Use esse texto quando o local estiver em breve ou pausado.</div>
              </div>
            )}

            <div className="admin-inline-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setExtrasAbertos(valor => !valor)}>
                {extrasAbertos ? 'Esconder campos opcionais' : 'Mostrar campos opcionais'}
              </button>
            </div>

            {extrasAbertos && (
              <div className="admin-locais-extra-stack">
                <div className="section-title-row" style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Campos opcionais</div>
                    <div className="section-copy">Use esses campos apenas se quiser refinar a pagina do local ou manter um texto de apoio interno.</div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Descricao de apoio</label>
                  <textarea
                    className="form-textarea"
                    value={form.descricao}
                    onChange={e => setForm(current => ({ ...current, descricao: e.target.value }))}
                    placeholder="Texto secundario de apoio para o local."
                  />
                </div>
                <div className="section-title-row" style={{ marginBottom: '0.75rem' }}>
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Caixa ao lado dos planos</div>
                    <div className="section-copy">Essa caixa ajuda a explicar o valor do acesso quando o aluno estiver escolhendo um plano.</div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Titulo da caixa</label>
                  <input
                    className="form-input"
                    value={form.boxTitulo}
                    onChange={e => setForm(current => ({ ...current, boxTitulo: e.target.value }))}
                    placeholder="Ex.: O que voce vai encontrar neste acesso"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Item 1</label>
                    <input
                      className="form-input"
                      value={form.boxItem1}
                      onChange={e => setForm(current => ({ ...current, boxItem1: e.target.value }))}
                      placeholder="Ex.: Percursos mais frequentes"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Item 2</label>
                    <input
                      className="form-input"
                      value={form.boxItem2}
                      onChange={e => setForm(current => ({ ...current, boxItem2: e.target.value }))}
                      placeholder="Ex.: Simulacao completa da prova"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Item 3</label>
                  <input
                    className="form-input"
                    value={form.boxItem3}
                    onChange={e => setForm(current => ({ ...current, boxItem3: e.target.value }))}
                    placeholder="Ex.: Erros que mais tiram pontos"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Observacao da caixa</label>
                  <textarea
                    className="form-textarea"
                    value={form.boxObservacao}
                    onChange={e => setForm(current => ({ ...current, boxObservacao: e.target.value }))}
                    placeholder="Ex.: Acesso liberado automaticamente apos a confirmacao do pagamento."
                  />
                </div>
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : edicaoId ? 'Salvar alteracoes' : 'Criar local'}</button>
              {edicaoId && <button className="btn btn-ghost" type="button" onClick={resetar}>Cancelar</button>}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="section-heading">Locais cadastrados</div>
          {loading ? (
            <div className="spinner" />
          ) : (
            <div className="stack-list">
              {locais.map(local => (
                <div key={local.id} className="stack-row">
                  <div>
                    <div className="table-name">{local.nome}</div>
                    <div className="mini-copy">{local.cidade} - /{local.slug}</div>
                    {local.mensagemPublica && <div className="mini-copy">{local.mensagemPublica}</div>}
                    {local.tituloComercial && <div className="mini-copy">{local.tituloComercial}</div>}
                  </div>
                  <div className="table-actions">
                    <span className={`badge ${local.ativo ? 'badge-green' : 'badge-gray'}`}>{local.ativo ? 'Ativo' : 'Inativo'}</span>
                    <span className={`badge ${local.statusComercial === 'DISPONIVEL' ? 'badge-green' : local.statusComercial === 'EM_BREVE' ? 'badge-warn' : local.statusComercial === 'PAUSADO' ? 'badge-red' : 'badge-gray'}`}>
                      {formatStatusComercialLocal(local.statusComercial)}
                    </span>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => editar(local)}>Editar</button>
                    <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => excluir(local)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
