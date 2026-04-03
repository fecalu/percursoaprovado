import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { categoriaService, localProvaService, percursoService, uploadService } from '../services/api'
import { useToast } from '../hooks/useToast'
import { formatTipoConteudo } from '../utils/formatters'

const VAZIO = {
  titulo: '',
  descricao: '',
  resumo: '',
  videoProvider: 'YOUTUBE',
  videoUrl: '',
  videoAssetId: '',
  thumbnailUrl: '',
  duracaoSegundos: '',
  categoriaId: '',
  localProvaId: '',
  tipoConteudo: 'PERCURSO_REAL',
  ordemExibicao: '0',
  destaque: false,
  ativo: true,
  configuracaoPontosAtencao: 'AUTOMATICO',
  pontosAtencao: [],
}

const TIPOS_CONTEUDO = [
  'PERCURSO_REAL',
  'SIMULACAO_COMPLETA',
  'ERROS_REPROVACAO',
  'BALIZA',
  'CONTROLE_EMBREAGEM',
  'EXAMINADOR',
]

const VIDEO_PROVIDERS = ['YOUTUBE', 'VIMEO', 'BUNNY']
const CONFIGURACOES_PONTOS_ATENCAO = ['AUTOMATICO', 'SEMPRE_MOSTRAR', 'OCULTAR']
const TIPOS_PONTO_ATENCAO = [
  'DICA_IMPORTANTE',
  'ERRO_COMUM',
  'PLACA',
  'REFERENCIA_VISUAL',
  'OBSERVACAO_EXAMINADOR',
]

const MODOS_PONTO_ATENCAO = ['CLIQUE', 'AUTOMATICO', 'APENAS_LISTA']
const ETAPAS_INICIAIS = {
  detalhes: false,
  distribuicao: false,
  video: false,
  pontos: false,
  publicacao: false,
}

function criarPontoAtencaoVazio(ordem = 0) {
  return {
    id: null,
    timestampSegundos: '',
    titulo: '',
    descricaoCurta: '',
    descricaoDetalhada: '',
    tipo: 'DICA_IMPORTANTE',
    imagemUrl: '',
    audioUrl: '',
    videoUrl: '',
    modoExibicao: 'CLIQUE',
    pausarAoExibir: true,
    ocultarAutomaticamente: true,
    segundosParaOcultar: '10',
    ordemExibicao: String(ordem),
    ativo: true,
  }
}

function formatarTimestamp(segundos) {
  const total = Number(segundos) || 0
  const minutos = Math.floor(total / 60)
  const resto = total % 60
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
}

function formatarTipoPonto(tipo) {
  switch (tipo) {
    case 'ERRO_COMUM':
      return 'Erro comum'
    case 'PLACA':
      return 'Placa'
    case 'REFERENCIA_VISUAL':
      return 'Referencia visual'
    case 'OBSERVACAO_EXAMINADOR':
      return 'Observacao do examinador'
    default:
      return 'Dica importante'
  }
}

function formatarModoPonto(modo) {
  switch (modo) {
    case 'AUTOMATICO':
      return 'Automatico'
    case 'APENAS_LISTA':
      return 'Apenas na lista'
    default:
      return 'Clique'
  }
}

function videoExplicativoEhEmbedavel(url) {
  const valor = String(url || '').trim()
  if (!valor) return true
  return /youtube\.com|youtu\.be|vimeo\.com|mediadelivery\.net\/embed\//i.test(valor)
}

function formatarVideoProvider(provider) {
  switch (provider) {
    case 'VIMEO':
      return 'Vimeo'
    case 'BUNNY':
      return 'Bunny Stream'
    default:
      return 'YouTube'
  }
}

function formatarConfiguracaoPontosAtencao(configuracao) {
  switch (configuracao) {
    case 'SEMPRE_MOSTRAR':
      return 'Sempre mostrar'
    case 'OCULTAR':
      return 'Ocultar'
    default:
      return 'Automatico'
  }
}

function ordenarPontosAtencao(a, b) {
  const timestampA = Number(a.timestampSegundos) || 0
  const timestampB = Number(b.timestampSegundos) || 0

  if (timestampA !== timestampB) return timestampA - timestampB

  const ordemA = Number(a.ordemExibicao) || 0
  const ordemB = Number(b.ordemExibicao) || 0

  return ordemA - ordemB
}

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
  const [enviandoVideoBunny, setEnviandoVideoBunny] = useState(false)
  const [uploadingPointField, setUploadingPointField] = useState('')
  const [pontoAtencaoAbertoIndex, setPontoAtencaoAbertoIndex] = useState(null)
  const [etapasAbertas, setEtapasAbertas] = useState(ETAPAS_INICIAIS)
  const [erros, setErros] = useState({})
  const [escopoConteudo, setEscopoConteudoState] = useState('GERAL')
  const [ultimoLocalProvaId, setUltimoLocalProvaId] = useState('')

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

        setEscopoConteudoState(percursoResp.localProvaId ? 'LOCAL' : 'GERAL')
        setUltimoLocalProvaId(percursoResp.localProvaId || '')

        setForm({
          titulo: percursoResp.titulo || '',
          descricao: percursoResp.descricao || '',
          resumo: percursoResp.resumo || '',
          videoProvider: percursoResp.videoProvider || 'YOUTUBE',
          videoUrl: percursoResp.videoUrl || '',
          videoAssetId: percursoResp.videoAssetId || '',
          thumbnailUrl: percursoResp.thumbnailUrl || '',
          duracaoSegundos: percursoResp.duracaoSegundos ? String(Math.floor(percursoResp.duracaoSegundos / 60)) : '',
          categoriaId: percursoResp.categoriaId || '',
          localProvaId: percursoResp.localProvaId || '',
          tipoConteudo: percursoResp.tipoConteudo || 'PERCURSO_REAL',
          ordemExibicao: String(percursoResp.ordemExibicao ?? 0),
          destaque: percursoResp.destaque ?? false,
          ativo: percursoResp.ativo ?? true,
          configuracaoPontosAtencao: percursoResp.configuracaoPontosAtencao || 'AUTOMATICO',
          pontosAtencao: (percursoResp.pontosAtencao || []).map((item, index) => ({
            id: item.id || null,
            timestampSegundos: String(item.timestampSegundos ?? ''),
            titulo: item.titulo || '',
            descricaoCurta: item.descricaoCurta || '',
            descricaoDetalhada: item.descricaoDetalhada || '',
            tipo: item.tipo || 'DICA_IMPORTANTE',
            imagemUrl: item.imagemUrl || '',
            audioUrl: item.audioUrl || '',
            videoUrl: item.videoUrl || '',
            modoExibicao: item.modoExibicao || 'CLIQUE',
            pausarAoExibir: item.pausarAoExibir ?? true,
            ocultarAutomaticamente: item.ocultarAutomaticamente ?? true,
            segundosParaOcultar: String(item.segundosParaOcultar ?? 10),
            ordemExibicao: String(item.ordemExibicao ?? index),
            ativo: item.ativo ?? true,
          })),
        })
        setPontoAtencaoAbertoIndex(null)
      })
      .finally(() => setLoading(false))
  }, [id, isEdicao])

  function set(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setErros(current => ({ ...current, [field]: undefined }))

    if (field === 'localProvaId' && value) {
      setUltimoLocalProvaId(value)
    }
  }

  function setEscopoConteudo(escopo) {
    if (escopo === 'GERAL') {
      if (form.localProvaId) {
        setUltimoLocalProvaId(form.localProvaId)
      }

      setEscopoConteudoState('GERAL')
      set('localProvaId', '')
      return
    }

    setEscopoConteudoState('LOCAL')
    if (!form.localProvaId && ultimoLocalProvaId) {
      set('localProvaId', ultimoLocalProvaId)
    }
  }

  function setPontoAtencao(index, field, value) {
    setForm(current => ({
      ...current,
      pontosAtencao: current.pontosAtencao.map((item, idx) => (
        idx === index ? { ...item, [field]: value } : item
      )),
    }))
    setErros(current => ({ ...current, pontosAtencao: undefined }))
  }

  function adicionarPontoAtencao() {
    const proximoIndex = form.pontosAtencao.length
    setForm(current => ({
      ...current,
      pontosAtencao: [...current.pontosAtencao, criarPontoAtencaoVazio(current.pontosAtencao.length)],
    }))
    setEtapasAbertas(current => ({ ...current, pontos: true }))
    setPontoAtencaoAbertoIndex(proximoIndex)
  }

  function removerPontoAtencao(index) {
    setForm(current => ({
      ...current,
      pontosAtencao: current.pontosAtencao.filter((_, idx) => idx !== index),
    }))
    setPontoAtencaoAbertoIndex(current => {
      if (current == null) return null
      if (current === index) return null
      if (current > index) return current - 1
      return current
    })
  }

  function alternarPontoAtencao(index) {
    setEtapasAbertas(current => ({ ...current, pontos: true }))
    setPontoAtencaoAbertoIndex(current => (current === index ? current : index))
  }

  function alternarEtapa(chave) {
    setEtapasAbertas(current => ({
      ...current,
      [chave]: !current[chave],
    }))
  }

  function validar() {
    const novosErros = {}

    if (!form.titulo.trim()) novosErros.titulo = 'Campo obrigatorio'
    if (form.videoProvider === 'BUNNY') {
      if (!form.videoAssetId.trim() && !form.videoUrl.trim()) {
        novosErros.videoAssetId = 'Informe o Video ID do Bunny ou a URL de embed.'
      }
    } else if (!form.videoUrl.trim()) {
      novosErros.videoUrl = 'Campo obrigatorio'
    }

    setErros(novosErros)

    if (novosErros.titulo) {
      setEtapasAbertas(current => ({ ...current, detalhes: true }))
    }

    if (novosErros.videoUrl || novosErros.videoAssetId) {
      setEtapasAbertas(current => ({ ...current, video: true }))
    }

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

  async function handlePontoImagemUpload(index, event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingPointField(`ponto-${index}`)

    try {
      const resposta = await uploadService.enviarImagem(file)
      setPontoAtencao(index, 'imagemUrl', resposta.url)
      show('Imagem do ponto enviada com sucesso.')
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao enviar imagem do ponto.', 'error')
    } finally {
      setUploadingPointField('')
      event.target.value = ''
    }
  }

  async function handlePontoAudioUpload(index, event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingPointField(`ponto-audio-${index}`)

    try {
      const resposta = await uploadService.enviarAudio(file)
      setPontoAtencao(index, 'audioUrl', resposta.url)
      show('Audio do ponto enviado com sucesso.')
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao enviar audio do ponto.', 'error')
    } finally {
      setUploadingPointField('')
      event.target.value = ''
    }
  }

  async function handleBunnyVideoUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setEnviandoVideoBunny(true)

    try {
      const resposta = await uploadService.enviarVideoBunny(file, form.titulo.trim() || undefined)
      setForm(current => ({
        ...current,
        videoProvider: 'BUNNY',
        videoAssetId: resposta.videoId || '',
        videoUrl: resposta.embedUrl || '',
      }))
      setErros(current => ({
        ...current,
        videoAssetId: undefined,
        videoUrl: undefined,
      }))
      show('Video enviado para o Bunny com sucesso. O processamento pode levar alguns minutos.')
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao enviar video para o Bunny.', 'error')
    } finally {
      setEnviandoVideoBunny(false)
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
      videoProvider: form.videoProvider,
      videoUrl: form.videoUrl.trim(),
      videoAssetId: form.videoProvider === 'BUNNY' ? (form.videoAssetId.trim() || null) : null,
      thumbnailUrl: form.thumbnailUrl.trim() || null,
      duracaoSegundos: form.duracaoSegundos ? Number(form.duracaoSegundos) * 60 : null,
      categoriaId: form.categoriaId || null,
      localProvaId: form.localProvaId || null,
      tipoConteudo: form.tipoConteudo,
      ordemExibicao: Number(form.ordemExibicao) || 0,
      destaque: form.destaque,
      ativo: form.ativo,
      configuracaoPontosAtencao: form.configuracaoPontosAtencao,
      pontosAtencao: form.pontosAtencao
        .filter(item => (
          item.titulo.trim() ||
          item.descricaoCurta.trim() ||
          item.descricaoDetalhada.trim() ||
          item.imagemUrl.trim() ||
          item.audioUrl.trim() ||
          item.videoUrl.trim()
        ))
        .sort(ordenarPontosAtencao)
        .map((item, index) => ({
          id: item.id || null,
          timestampSegundos: Number(item.timestampSegundos) || 0,
          titulo: item.titulo.trim(),
          descricaoCurta: item.descricaoCurta.trim() || null,
          descricaoDetalhada: item.descricaoDetalhada.trim() || null,
          tipo: item.tipo,
          imagemUrl: item.imagemUrl.trim() || null,
          audioUrl: item.audioUrl.trim() || null,
          videoUrl: item.videoUrl.trim() || null,
          modoExibicao: item.modoExibicao,
          pausarAoExibir: item.pausarAoExibir ?? true,
          ocultarAutomaticamente: item.ocultarAutomaticamente ?? true,
          segundosParaOcultar: Number(item.segundosParaOcultar) || 10,
          ordemExibicao: index,
          ativo: item.ativo,
        })),
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

  const pontosAtencaoOrdenados = useMemo(
    () => form.pontosAtencao
      .map((ponto, index) => ({ ponto, index }))
      .sort((a, b) => ordenarPontosAtencao(a.ponto, b.ponto)),
    [form.pontosAtencao]
  )
  const pontoAtencaoSelecionado = pontoAtencaoAbertoIndex != null
    ? form.pontosAtencao[pontoAtencaoAbertoIndex] || null
    : null
  const pontoAtencaoSelecionadoPosicao = pontosAtencaoOrdenados.findIndex(({ index }) => index === pontoAtencaoAbertoIndex) + 1
  const thumbnailPreviewUrl = form.thumbnailUrl.trim()
  const categoriaSelecionada = categorias.find(item => item.id === form.categoriaId) || null
  const localSelecionado = locais.find(item => item.id === form.localProvaId) || null
  const totalPontosCadastrados = form.pontosAtencao.length
  const totalPontosAtivos = form.pontosAtencao.filter(item => item.ativo).length
  const caminhoBiblioteca = escopoConteudo === 'LOCAL'
    ? `Biblioteca > ${localSelecionado?.nome || 'Local especifico'} > ${categoriaSelecionada?.nome || 'Sem modulo'}`
    : `Biblioteca > Modulos gerais > ${categoriaSelecionada?.nome || 'Sem modulo'}`

  useEffect(() => {
    if (!form.pontosAtencao.length) {
      if (pontoAtencaoAbertoIndex != null) setPontoAtencaoAbertoIndex(null)
      return
    }

    const indiceExiste = pontoAtencaoAbertoIndex != null && form.pontosAtencao[pontoAtencaoAbertoIndex]
    if (!indiceExiste) {
      setPontoAtencaoAbertoIndex(pontosAtencaoOrdenados[0]?.index ?? 0)
    }
  }, [form.pontosAtencao, pontoAtencaoAbertoIndex, pontosAtencaoOrdenados])

  function renderEtapaHeader(chave, etapa, titulo, descricao) {
    const aberta = etapasAbertas[chave]

    return (
      <button
        className={`admin-aula-section-toggle${aberta ? ' is-open' : ''}`}
        type="button"
        onClick={() => alternarEtapa(chave)}
        aria-expanded={aberta}
      >
        <div className="admin-aula-section-head">
          <div className="admin-aula-section-kicker">Etapa {etapa}</div>
          <div className="section-heading">{titulo}</div>
          <div className="section-copy">{descricao}</div>
        </div>
        <span className="admin-aula-section-chevron" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 8l5 5 5-5" />
          </svg>
        </span>
      </button>
    )
  }

  function renderPontoAtencaoSelecionado() {
    if (!pontoAtencaoSelecionado) {
      return (
        <div className="attention-admin-empty attention-admin-empty--editor">
          <div className="attention-admin-empty-title">Selecione um ponto</div>
          <div className="mini-copy">Escolha um ponto na coluna ao lado ou crie um novo para editar titulo, tempo, midias e comportamento.</div>
        </div>
      )
    }

    return (
      <>
        <div className="attention-admin-head">
          <div>
            <div className="attention-admin-kicker">Ponto {pontoAtencaoSelecionadoPosicao}</div>
            <div className="attention-admin-title">{pontoAtencaoSelecionado.titulo.trim() || 'Novo ponto de atencao'}</div>
          </div>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => removerPontoAtencao(pontoAtencaoAbertoIndex)}
          >
            Remover
          </button>
        </div>

        <div className="attention-admin-meta">
          <span className="card-tag">{formatarTipoPonto(pontoAtencaoSelecionado.tipo)}</span>
          <span className="card-tag">{formatarModoPonto(pontoAtencaoSelecionado.modoExibicao)}</span>
          <span className="card-tag">{formatarTimestamp(pontoAtencaoSelecionado.timestampSegundos)}</span>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Titulo</label>
            <input
              className="form-input"
              placeholder="Ex: Ponto em que o examinador costuma observar a troca de marcha"
              value={pontoAtencaoSelecionado.titulo}
              onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'titulo', event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tempo no video (segundos)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              placeholder="Ex: 125"
              value={pontoAtencaoSelecionado.timestampSegundos}
              onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'timestampSegundos', event.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select
              className="form-select"
              value={pontoAtencaoSelecionado.tipo}
              onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'tipo', event.target.value)}
            >
              {TIPOS_PONTO_ATENCAO.map(tipo => (
                <option key={tipo} value={tipo}>{formatarTipoPonto(tipo)}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Modo de exibicao</label>
            <select
              className="form-select"
              value={pontoAtencaoSelecionado.modoExibicao}
              onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'modoExibicao', event.target.value)}
            >
              {MODOS_PONTO_ATENCAO.map(modo => (
                <option key={modo} value={modo}>{formatarModoPonto(modo)}</option>
              ))}
            </select>
          </div>
        </div>

        {pontoAtencaoSelecionado.modoExibicao === 'AUTOMATICO' && (
          <div className="form-group">
            <label className="form-label">Ao aparecer automaticamente</label>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pontoAtencaoSelecionado.pausarAoExibir}
                  onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'pausarAoExibir', event.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                <span className="form-label" style={{ margin: 0 }}>Pausar o video ao exibir esse ponto</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pontoAtencaoSelecionado.ocultarAutomaticamente}
                  onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'ocultarAutomaticamente', event.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                <span className="form-label" style={{ margin: 0 }}>Ocultar automaticamente quando o video estiver reproduzindo</span>
              </label>
            </div>
            <div className="mini-copy">
              Se o video estiver pausado, a contagem nao corre. Se o aluno der play, o aviso pode sumir sozinho depois do tempo definido.
            </div>

            {pontoAtencaoSelecionado.ocultarAutomaticamente && (
              <div className="form-row" style={{ marginTop: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ocultar apos (segundos de reproducao)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="3"
                    max="20"
                    value={pontoAtencaoSelecionado.segundosParaOcultar}
                    onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'segundosParaOcultar', event.target.value)}
                  />
                  <div className="mini-copy">Use entre 3 e 20 segundos. O padrao recomendado e 10.</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Descricao curta</label>
          <textarea
            className="form-textarea"
            placeholder="Resumo rapido do ponto importante."
            value={pontoAtencaoSelecionado.descricaoCurta}
            onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'descricaoCurta', event.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Descricao detalhada</label>
          <textarea
            className="form-textarea"
            style={{ minHeight: 110 }}
            placeholder="Detalhe melhor o que o aluno deve observar nesse trecho."
            value={pontoAtencaoSelecionado.descricaoDetalhada}
            onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'descricaoDetalhada', event.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Audio explicativo</label>
          <div className="question-media-stack">
            <input
              className="form-input"
              type="file"
              accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.m4a,.ogg"
              onChange={event => handlePontoAudioUpload(pontoAtencaoAbertoIndex, event)}
              disabled={uploadingPointField === `ponto-audio-${pontoAtencaoAbertoIndex}`}
            />
            <input
              className="form-input"
              placeholder="/media/audios/... ou URL publica do audio"
              value={pontoAtencaoSelecionado.audioUrl}
              onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'audioUrl', event.target.value)}
            />
            <div className="mini-copy">
              Use para uma explicacao falada curta, como se o instrutor comentasse esse trecho.
              {uploadingPointField === `ponto-audio-${pontoAtencaoAbertoIndex}` ? ' Enviando audio...' : ''}
            </div>
            {pontoAtencaoSelecionado.audioUrl && (
              <div className="question-media-preview-wrap question-media-preview-wrap--audio">
                <audio
                  className="question-audio-preview"
                  controls
                  preload="none"
                  src={pontoAtencaoSelecionado.audioUrl}
                />
                <div className="question-audio-actions">
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setPontoAtencao(pontoAtencaoAbertoIndex, 'audioUrl', '')}
                  >
                    Remover audio
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Upload da imagem de apoio</label>
            <div className="question-media-stack">
              <input
                className="form-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={event => handlePontoImagemUpload(pontoAtencaoAbertoIndex, event)}
                disabled={uploadingPointField === `ponto-${pontoAtencaoAbertoIndex}`}
              />
              <input
                className="form-input"
                placeholder="/media/... ou URL publica da imagem"
                value={pontoAtencaoSelecionado.imagemUrl}
                onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'imagemUrl', event.target.value)}
              />
              <div className="mini-copy">
                Use para placas, referencias visuais ou detalhes de um trecho.
                {uploadingPointField === `ponto-${pontoAtencaoAbertoIndex}` ? ' Enviando imagem...' : ''}
              </div>
              {pontoAtencaoSelecionado.imagemUrl && (
                <div className="question-media-preview-wrap">
                  <img
                    src={pontoAtencaoSelecionado.imagemUrl}
                    alt={`Preview do ponto ${pontoAtencaoSelecionadoPosicao}`}
                    className="question-media-preview question-media-preview--option"
                  />
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setPontoAtencao(pontoAtencaoAbertoIndex, 'imagemUrl', '')}
                  >
                    Remover imagem
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Video explicativo opcional</label>
            <input
              className="form-input"
              placeholder="https://youtube.com/watch?v=... ou embed do Bunny"
              value={pontoAtencaoSelecionado.videoUrl}
              onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'videoUrl', event.target.value)}
            />
            <div className="mini-copy">
              Aceita YouTube, Vimeo e Bunny. Quando a URL for compativel, o video abre dentro da plataforma.
            </div>
            {pontoAtencaoSelecionado.videoUrl.trim() && !videoExplicativoEhEmbedavel(pontoAtencaoSelecionado.videoUrl) && (
              <div className="form-error">
                Essa URL nao parece ser de YouTube, Vimeo ou embed do Bunny. Nesse caso, o aluno vai abrir o link fora da plataforma.
              </div>
            )}

            <div className="form-row" style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 28 }}>
                <input
                  type="checkbox"
                  checked={pontoAtencaoSelecionado.ativo}
                  onChange={event => setPontoAtencao(pontoAtencaoAbertoIndex, 'ativo', event.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                <span className="form-label" style={{ margin: 0 }}>Ponto ativo</span>
              </label>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (loading) return <div className="spinner" />

  return (
    <>
      {ToastEl}
      <button className="back-link" onClick={() => navigate('/admin/percursos')}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        Voltar
      </button>

      <div className="page-title">{isEdicao ? 'Editar aula' : 'Nova aula'}</div>
      <p className="page-sub">Cadastre aulas gerais ou vincule o conteudo a um local especifico, organizando tudo por modulo.</p>

      <form onSubmit={handleSubmit} className="admin-aula-layout">
        <aside className="admin-aula-column admin-aula-column--left">
          <div className="card admin-aula-context-card">
            {thumbnailPreviewUrl ? (
              <img
                src={thumbnailPreviewUrl}
                alt="Preview da aula"
                className="admin-aula-context-image"
              />
            ) : (
              <div className="admin-aula-context-placeholder">
                {form.titulo.trim().slice(0, 2).toUpperCase() || 'A'}
              </div>
            )}

            <div className="admin-aula-context-kicker">{isEdicao ? 'Aula em edicao' : 'Nova aula'}</div>
            <div className="admin-aula-context-title">{form.titulo.trim() || 'Defina o titulo da aula'}</div>
            <div className="admin-aula-context-copy">{categoriaSelecionada?.nome || 'Sem modulo'} • {escopoConteudo === 'LOCAL' ? 'Local especifico' : 'Geral'}</div>
          </div>

          <div className="card admin-aula-nav-card">
            <div className="admin-aula-card-title">Fluxo da edicao</div>
            <div className="admin-aula-nav-list">
              <div className="admin-aula-nav-item is-active">Detalhes da aula</div>
              <div className="admin-aula-nav-item">Distribuicao e modulo</div>
              <div className="admin-aula-nav-item">Video, thumbnail e player</div>
              <div className="admin-aula-nav-item">Pontos de atencao</div>
              <div className="admin-aula-nav-item">Publicacao</div>
            </div>
          </div>
        </aside>

        <div className="card admin-aula-summary-bar">
          {thumbnailPreviewUrl ? (
            <img
              src={thumbnailPreviewUrl}
              alt="Preview da aula"
              className="admin-aula-summary-thumb"
            />
          ) : (
            <div className="admin-aula-summary-thumb admin-aula-summary-thumb--placeholder">
              {form.titulo.trim() || 'Sua aula vai aparecer aqui'}
            </div>
          )}

          <div className="admin-aula-summary-main">
            <div className="admin-aula-summary-title">{form.titulo.trim() || 'Titulo da aula'}</div>
            <div className="admin-aula-badge-strip admin-aula-summary-badges">
              <span className="card-tag">{escopoConteudo === 'LOCAL' ? 'Local' : 'Geral'}</span>
              <span className="card-tag">{categoriaSelecionada?.nome || 'Sem modulo'}</span>
              <span className="card-tag">{form.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div className="admin-aula-summary-copy">{form.resumo.trim() || 'Resumo curto para cards e biblioteca.'}</div>
          </div>

          <div className="admin-aula-summary-meta">
            <div className="admin-aula-summary-item admin-aula-summary-item--wide">
              <div className="form-label">Onde aparece</div>
              <div className="mini-copy">{caminhoBiblioteca}</div>
            </div>
            <div className="admin-aula-summary-item">
              <div className="form-label">Video</div>
              <div className="mini-copy">{formatarVideoProvider(form.videoProvider)}</div>
            </div>
            <div className="admin-aula-summary-item">
              <div className="form-label">Duracao</div>
              <div className="mini-copy">{form.duracaoSegundos ? `${form.duracaoSegundos} min` : '-'}</div>
            </div>
            <div className="admin-aula-summary-item">
              <div className="form-label">Local</div>
              <div className="mini-copy">{localSelecionado?.nome || 'Nao se aplica'}</div>
            </div>
            <div className="admin-aula-summary-item">
              <div className="form-label">Pontos</div>
              <div className="mini-copy">{totalPontosAtivos} de {totalPontosCadastrados} ativos</div>
            </div>
          </div>

          <div className="admin-aula-summary-actions">
            <button className="btn btn-primary" type="submit" disabled={salvando || enviandoThumbnail || enviandoVideoBunny}>
              {salvando ? 'Salvando...' : isEdicao ? 'Salvar alteracoes' : 'Criar conteudo'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/percursos')}>
              Cancelar
            </button>
          </div>
        </div>

        <div className="admin-aula-column admin-aula-column--main">
          <div className="card admin-aula-form-card">
          <div className={`admin-aula-section${etapasAbertas.detalhes ? ' is-open' : ''}`}>
            {renderEtapaHeader('detalhes', 1, 'Detalhes da aula', 'Defina o titulo e a base textual antes de configurar modulo, video e pontos de atencao.')}
          {etapasAbertas.detalhes && (
          <div className="admin-aula-section-body">
          <div className="form-group">
            <label className="form-label">Titulo da aula *</label>
            <input
              className="form-input"
              placeholder="Ex: Troca de marcha no cruzamento principal"
              value={form.titulo}
              onChange={event => set('titulo', event.target.value)}
            />
            {erros.titulo && <div className="form-error">{erros.titulo}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Resumo</label>
            <textarea
              className="form-textarea admin-aula-textarea--compact"
              placeholder="Resumo curto para cards e Biblioteca."
              value={form.resumo}
              onChange={event => set('resumo', event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descricao</label>
            <textarea
              className="form-textarea admin-aula-textarea--compact admin-aula-textarea--descricao"
              placeholder="Explique o que o aluno vai observar neste video."
              value={form.descricao}
              onChange={event => set('descricao', event.target.value)}
            />
          </div>
          </div>
          )}
          </div>

          <div className={`admin-aula-section${etapasAbertas.distribuicao ? ' is-open' : ''}`}>
            {renderEtapaHeader('distribuicao', 2, 'Distribuicao e modulo', 'Escolha o escopo da aula, o local quando necessario e o modulo onde ela deve aparecer.')}
          {etapasAbertas.distribuicao && (
          <div className="admin-aula-section-body">

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Escopo do conteudo</label>
              <select
                className="form-select"
                value={escopoConteudo}
                onChange={event => setEscopoConteudo(event.target.value)}
              >
                <option value="GERAL">Geral</option>
                <option value="LOCAL">Local especifico</option>
              </select>
              <div className="mini-copy">Use Geral para aulas que servem para todos os locais de prova.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Local de prova</label>
              <select
                className="form-select"
                value={form.localProvaId}
                onChange={event => set('localProvaId', event.target.value)}
                disabled={escopoConteudo !== 'LOCAL'}
              >
                <option value="">{escopoConteudo === 'LOCAL' ? 'Selecione o local' : 'Nao se aplica'}</option>
                {locais.map(local => (
                  <option key={local.id} value={local.id}>{local.nome}</option>
                ))}
              </select>
              <div className="mini-copy">
                {escopoConteudo === 'LOCAL'
                  ? 'Essa aula aparecera apenas para quem tiver acesso a esse local.'
                  : 'Conteudos gerais nao ficam presos a um local especifico.'}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Modulo</label>
              <select
                className="form-select"
                value={form.categoriaId}
                onChange={event => set('categoriaId', event.target.value)}
              >
                <option value="">Selecione o modulo</option>
                {categorias.map(categoria => (
                  <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
                ))}
              </select>
              <div className="mini-copy">Use o modulo para separar aulas como Percursos, Teorico pratico e Pegadinhas.</div>
            </div>

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
              <div className="mini-copy">Define a ordem da aula dentro do modulo.</div>
            </div>

            <div className="form-group" />
          </div>
          </div>
          )}
          </div>

          <div className={`admin-aula-section${etapasAbertas.video ? ' is-open' : ''}`}>
            {renderEtapaHeader('video', 3, 'Video, thumbnail e player', 'Configure o provedor, a duracao, a imagem da aula e como o player deve apresentar os pontos de atencao.')}
          {etapasAbertas.video && (
          <div className="admin-aula-section-body">

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Provedor do video</label>
              <select
                className="form-select"
                value={form.videoProvider}
                onChange={event => set('videoProvider', event.target.value)}
              >
                {VIDEO_PROVIDERS.map(provider => (
                  <option key={provider} value={provider}>{formatarVideoProvider(provider)}</option>
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

          <div className="form-group">
            <label className="form-label">Pontos de atencao no player</label>
            <select
              className="form-select"
              value={form.configuracaoPontosAtencao}
              onChange={event => set('configuracaoPontosAtencao', event.target.value)}
            >
              {CONFIGURACOES_PONTOS_ATENCAO.map(configuracao => (
                <option key={configuracao} value={configuracao}>
                  {formatarConfiguracaoPontosAtencao(configuracao)}
                </option>
              ))}
            </select>
            <div className="mini-copy">
              Automatico usa a logica normal do player. Sempre mostrar mantem a area de pontos visivel mesmo sem pontos cadastrados neste video. Ocultar remove essa experiencia deste conteudo.
            </div>
          </div>

          <div className="form-row">
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

            <div className="form-group" />
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

          {form.videoProvider === 'BUNNY' ? (
            <>
              <div className="form-group">
                <label className="form-label">Enviar video para o Bunny</label>
                <input
                  className="form-input"
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-msvideo,video/x-matroska"
                  onChange={handleBunnyVideoUpload}
                  disabled={enviandoVideoBunny}
                />
                <div className="mini-copy">
                  Envie o arquivo direto por aqui para preencher o Video ID e a URL de embed automaticamente.
                  {enviandoVideoBunny ? ' Enviando video para o Bunny...' : ''}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Video ID do Bunny *</label>
                  <input
                    className="form-input"
                    placeholder="GUID do video no Bunny Stream"
                    value={form.videoAssetId}
                    onChange={event => set('videoAssetId', event.target.value)}
                  />
                  {erros.videoAssetId && <div className="form-error">{erros.videoAssetId}</div>}
                  <div className="mini-copy">
                    O upload acima preenche esse campo automaticamente. Se preferir, voce pode informar o ID manualmente.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">URL de embed do Bunny</label>
                  <input
                    className="form-input"
                    placeholder="https://iframe.mediadelivery.net/embed/..."
                    value={form.videoUrl}
                    onChange={event => set('videoUrl', event.target.value)}
                  />
                  <div className="mini-copy">
                    Opcional. Use apenas se quiser sobrescrever manualmente a URL de embed.
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">URL do video * ({formatarVideoProvider(form.videoProvider)})</label>
              <input
                className="form-input"
                placeholder={form.videoProvider === 'VIMEO' ? 'https://vimeo.com/...' : 'https://youtube.com/watch?v=...'}
                value={form.videoUrl}
                onChange={event => set('videoUrl', event.target.value)}
              />
              {erros.videoUrl && <div className="form-error">{erros.videoUrl}</div>}
            </div>
          )}
          </div>
          )}
          </div>

          <div className={`admin-aula-section${etapasAbertas.pontos ? ' is-open' : ''}`}>
            {renderEtapaHeader('pontos', 4, 'Pontos de atencao', 'Cadastre alertas, placas, referencias visuais e observacoes do examinador para enriquecer a experiencia do aluno.')}
          {etapasAbertas.pontos && (
          <div className="admin-aula-section-body">

          <div className="form-group">
            <div className="attention-admin-workspace">
              <div className="attention-admin-sidebar">
                <div className="attention-admin-sidebar-head">
                  <div>
                    <div className="form-label">Pontos cadastrados</div>
                    <div className="mini-copy">{totalPontosCadastrados} ponto(s) nesta aula</div>
                  </div>
                  <button className="btn btn-ghost" type="button" onClick={adicionarPontoAtencao}>
                    Novo ponto
                  </button>
                </div>

                <div className="attention-admin-sidebar-list">
                  {pontosAtencaoOrdenados.length ? (
                    pontosAtencaoOrdenados.map(({ ponto, index }, posicaoVisual) => {
                      const isSelecionado = pontoAtencaoAbertoIndex === index

                      return (
                        <button
                          key={ponto.id || index}
                          type="button"
                          className={`attention-admin-list-item${isSelecionado ? ' is-active' : ''}`}
                          onClick={() => alternarPontoAtencao(index)}
                        >
                          <div className="attention-admin-list-item-top">
                            <span className="attention-admin-list-index">Ponto {posicaoVisual + 1}</span>
                            <span className="card-tag">{formatarTimestamp(ponto.timestampSegundos)}</span>
                          </div>
                          <div className="attention-admin-list-title">{ponto.titulo.trim() || 'Novo ponto de atencao'}</div>
                          <div className="attention-admin-list-meta">
                            <span className="card-tag">{formatarTipoPonto(ponto.tipo)}</span>
                            <span className="card-tag">{formatarModoPonto(ponto.modoExibicao)}</span>
                            {!ponto.ativo && <span className="card-tag">Inativo</span>}
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <div className="attention-admin-empty">
                      <div className="attention-admin-empty-title">Nenhum ponto cadastrado</div>
                      <div className="mini-copy">Adicione o primeiro ponto para comecar a guiar o aluno dentro do video.</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="attention-admin-editor">
                {renderPontoAtencaoSelecionado()}
              </div>
              </div>
            </div>
          </div>
          )}
          </div>

          <div className={`admin-aula-section${etapasAbertas.publicacao ? ' is-open' : ''}`}>
            {renderEtapaHeader('publicacao', 5, 'Publicacao', 'Finalize a aula escolhendo se ela deve ficar ativa e se merece destaque na experiencia do aluno.')}
          {etapasAbertas.publicacao && (
          <div className="admin-aula-section-body">
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
          </div>
          )}
          </div>

          <div className="form-actions admin-aula-actions-footer">
            <button className="btn btn-primary" type="submit" disabled={salvando || enviandoThumbnail || enviandoVideoBunny}>
              {salvando ? 'Salvando...' : (enviandoThumbnail || enviandoVideoBunny) ? 'Aguarde o upload...' : isEdicao ? 'Salvar alteracoes' : 'Criar conteudo'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/percursos')}>
              Cancelar
            </button>
          </div>
          </div>
        </div>

        <aside className="admin-aula-column admin-aula-column--right">
          <div className="card admin-aula-side-card admin-aula-side-card--sticky">
            <div className="admin-aula-card-title">Resumo rapido</div>

            {thumbnailPreviewUrl ? (
              <img
                src={thumbnailPreviewUrl}
                alt="Preview da aula"
                className="admin-aula-preview-image"
              />
            ) : (
              <div className="admin-aula-preview-placeholder">
                {form.titulo.trim() || 'Sua aula vai aparecer aqui'}
              </div>
            )}

            <div className="admin-aula-side-title">{form.titulo.trim() || 'Titulo da aula'}</div>
            <div className="admin-aula-side-copy">{form.resumo.trim() || 'Resumo curto para cards e biblioteca.'}</div>

            <div className="admin-aula-badge-strip">
              <span className="card-tag">{escopoConteudo === 'LOCAL' ? 'Local' : 'Geral'}</span>
              <span className="card-tag">{categoriaSelecionada?.nome || 'Sem modulo'}</span>
              <span className="card-tag">{form.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>

            <div className="stack-list">
              <div className="stack-row">
                <div>
                  <div className="form-label">Onde aparece</div>
                  <div className="mini-copy">{caminhoBiblioteca}</div>
                </div>
              </div>
              <div className="stack-row">
                <div>
                  <div className="form-label">Video</div>
                  <div className="mini-copy">{formatarVideoProvider(form.videoProvider)}</div>
                </div>
                <div className="mini-copy">{form.duracaoSegundos ? `${form.duracaoSegundos} min` : '-'}</div>
              </div>
              <div className="stack-row">
                <div>
                  <div className="form-label">Local</div>
                  <div className="mini-copy">{localSelecionado?.nome || 'Nao se aplica'}</div>
                </div>
                <div className="mini-copy">{formatTipoConteudo(form.tipoConteudo)}</div>
              </div>
              <div className="stack-row">
                <div>
                  <div className="form-label">Pontos</div>
                  <div className="mini-copy">{formatarConfiguracaoPontosAtencao(form.configuracaoPontosAtencao)}</div>
                </div>
                <div className="mini-copy">{totalPontosAtivos} de {totalPontosCadastrados} ativos</div>
              </div>
            </div>

            <div className="admin-aula-side-actions">
              <button className="btn btn-primary" type="submit" disabled={salvando || enviandoThumbnail || enviandoVideoBunny}>
                {salvando ? 'Salvando...' : isEdicao ? 'Salvar alteracoes' : 'Criar conteudo'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/percursos')}>
                Cancelar
              </button>
            </div>
          </div>
        </aside>
      </form>
    </>
  )
}
