import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { categoriaService, localProvaService, percursoService, uploadService } from '../services/api'
import { useToast } from '../hooks/useToast'
import { formatTipoConteudo } from '../utils/formatters'

const VAZIO = {
  titulo: '',
  descricao: '',
  resumo: '',
  videoUrl: '',
  thumbnailUrl: '',
  duracaoSegundos: '',
  categoriaId: '',
  localProvaId: '',
  tipoConteudo: 'PERCURSO_REAL',
  ordemExibicao: '0',
  destaque: false,
  ativo: true,
}

const TIPOS_CONTEUDO = [
  'PERCURSO_REAL',
  'SIMULACAO_COMPLETA',
  'ERROS_REPROVACAO',
  'BALIZA',
  'CONTROLE_EMBREAGEM',
  'EXAMINADOR',
]

export default function AdminPercursoForm() {
  const { id } = useParams()
  const isEdicao = Boolean(id)
  const navigate = useNavigate()
  const { show, ToastEl } = useToast()

  const [form, setForm] = useState(VAZIO)
  const [categorias, setCategorias] = useState([])
  const [locais, setLocais] = useState([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviandoThumbnail, setEnviandoThumbnail] = useState(false)
  const [erros, setErros] = useState({})

  useEffect(() => {
    Promise.all([
      categoriaService.listar(),
      localProvaService.listar({ todos: true }),
      isEdicao ? percursoService.buscar(id) : Promise.resolve(null),
    ])
      .then(([categoriasResp, locaisResp, percursoResp]) => {
        setCategorias(categoriasResp)
        setLocais(locaisResp)

        if (!percursoResp) return

        setForm({
          titulo: percursoResp.titulo || '',
          descricao: percursoResp.descricao || '',
          resumo: percursoResp.resumo || '',
          videoUrl: percursoResp.videoUrl || '',
          thumbnailUrl: percursoResp.thumbnailUrl || '',
          duracaoSegundos: percursoResp.duracaoSegundos ? String(Math.floor(percursoResp.duracaoSegundos / 60)) : '',
          categoriaId: percursoResp.categoriaId || '',
          localProvaId: percursoResp.localProvaId || '',
          tipoConteudo: percursoResp.tipoConteudo || 'PERCURSO_REAL',
          ordemExibicao: String(percursoResp.ordemExibicao ?? 0),
          destaque: percursoResp.destaque ?? false,
          ativo: percursoResp.ativo ?? true,
        })
      })
      .finally(() => setLoading(false))
  }, [id, isEdicao])

  function set(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setErros(current => ({ ...current, [field]: undefined }))
  }

  function validar() {
    const novosErros = {}

    if (!form.titulo.trim()) novosErros.titulo = 'Campo obrigatorio'
    if (!form.videoUrl.trim()) novosErros.videoUrl = 'Campo obrigatorio'

    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  async function handleThumbnailUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setEnviandoThumbnail(true)

    try {
      const resposta = await uploadService.enviarThumbnail(file)
      set('thumbnailUrl', resposta.url)
      show('Thumbnail enviada com sucesso.')
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao enviar thumbnail.', 'error')
    } finally {
      setEnviandoThumbnail(false)
      event.target.value = ''
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validar()) return

    setSalvando(true)

    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      resumo: form.resumo.trim() || null,
      videoUrl: form.videoUrl.trim(),
      thumbnailUrl: form.thumbnailUrl.trim() || null,
      duracaoSegundos: form.duracaoSegundos ? Number(form.duracaoSegundos) * 60 : null,
      categoriaId: form.categoriaId || null,
      localProvaId: form.localProvaId || null,
      tipoConteudo: form.tipoConteudo,
      ordemExibicao: Number(form.ordemExibicao) || 0,
      destaque: form.destaque,
      ativo: form.ativo,
    }

    try {
      if (isEdicao) {
        await percursoService.atualizar(id, payload)
        show('Conteudo atualizado com sucesso.')
      } else {
        await percursoService.criar(payload)
        show('Conteudo criado com sucesso.')
      }

      setTimeout(() => navigate('/admin/percursos'), 800)
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao salvar conteudo.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div className="spinner" />

  const thumbnailPreviewUrl = form.thumbnailUrl.trim()

  return (
    <>
      {ToastEl}
      <button className="back-link" onClick={() => navigate('/admin/percursos')}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        Voltar
      </button>

      <div className="page-title">{isEdicao ? 'Editar conteudo' : 'Novo conteudo'}</div>
      <p className="page-sub">Cadastre videos gerais ou vincule o conteudo a um local de prova especifico.</p>

      <div className="card" style={{ maxWidth: 760 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Titulo *</label>
            <input
              className="form-input"
              placeholder="Ex: Simulacao completa na Vila Palmeira"
              value={form.titulo}
              onChange={event => set('titulo', event.target.value)}
            />
            {erros.titulo && <div className="form-error">{erros.titulo}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo de conteudo</label>
              <select
                className="form-select"
                value={form.tipoConteudo}
                onChange={event => set('tipoConteudo', event.target.value)}
              >
                {TIPOS_CONTEUDO.map(tipo => (
                  <option key={tipo} value={tipo}>{formatTipoConteudo(tipo)}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Local de prova</label>
              <select
                className="form-select"
                value={form.localProvaId}
                onChange={event => set('localProvaId', event.target.value)}
              >
                <option value="">Conteudo geral</option>
                {locais.map(local => (
                  <option key={local.id} value={local.id}>{local.nome}</option>
                ))}
              </select>
              <div className="mini-copy">Deixe em branco para baliza, embreagem e outros modulos gerais.</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select
                className="form-select"
                value={form.categoriaId}
                onChange={event => set('categoriaId', event.target.value)}
              >
                <option value="">Sem categoria</option>
                {categorias.map(categoria => (
                  <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Duracao (minutos)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                placeholder="Ex: 12"
                value={form.duracaoSegundos}
                onChange={event => set('duracaoSegundos', event.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Ordem de exibicao</label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={form.ordemExibicao}
                onChange={event => set('ordemExibicao', event.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Upload da thumbnail</label>
              <input
                className="form-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleThumbnailUpload}
                disabled={enviandoThumbnail}
              />
              <div className="mini-copy">
                Envie JPG, PNG ou WEBP com ate 2 MB.
                {enviandoThumbnail ? ' Enviando imagem...' : ''}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Thumbnail</label>
            <div style={{ display: 'grid', gap: 12 }}>
              <input
                className="form-input"
                placeholder="/media/thumbnails/... ou https://..."
                value={form.thumbnailUrl}
                onChange={event => set('thumbnailUrl', event.target.value)}
              />
              <div className="mini-copy">
                O upload preenche esse campo automaticamente. Se preferir, voce pode usar uma URL externa publica.
              </div>
              {thumbnailPreviewUrl && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div className="mini-copy">Preview atual</div>
                  <img
                    src={thumbnailPreviewUrl}
                    alt="Preview da thumbnail"
                    style={{
                      width: '100%',
                      maxWidth: 320,
                      aspectRatio: '16 / 9',
                      objectFit: 'cover',
                      borderRadius: 16,
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      background: 'rgba(148, 163, 184, 0.08)',
                    }}
                  />
                  <div>
                    <button className="btn btn-ghost" type="button" onClick={() => set('thumbnailUrl', '')}>
                      Remover thumbnail
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Resumo</label>
            <textarea
              className="form-textarea"
              placeholder="Resumo curto para cards e biblioteca."
              value={form.resumo}
              onChange={event => set('resumo', event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descricao</label>
            <textarea
              className="form-textarea"
              placeholder="Explique o que o aluno vai observar nesse video."
              value={form.descricao}
              onChange={event => set('descricao', event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">URL do video * (YouTube ou Vimeo)</label>
            <input
              className="form-input"
              placeholder="https://youtube.com/watch?v=..."
              value={form.videoUrl}
              onChange={event => set('videoUrl', event.target.value)}
            />
            {erros.videoUrl && <div className="form-error">{erros.videoUrl}</div>}
          </div>

          <div className="form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.destaque}
                onChange={event => set('destaque', event.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
              />
              <span className="form-label" style={{ margin: 0 }}>Marcar como destaque</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={event => set('ativo', event.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
              />
              <span className="form-label" style={{ margin: 0 }}>Conteudo ativo</span>
            </label>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={salvando || enviandoThumbnail}>
              {salvando ? 'Salvando...' : enviandoThumbnail ? 'Aguarde o upload...' : isEdicao ? 'Salvar alteracoes' : 'Criar conteudo'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/percursos')}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
