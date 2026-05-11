import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { questaoService, uploadService } from '../services/api'
import { useToast } from '../hooks/useToast'
import {
  formatDificuldadeQuestao,
  formatModalidadeQuestao,
  formatStatusQuestao,
  formatTemaQuestao,
} from '../utils/formatters'

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
    tituloCriacao: 'Nova questao teorica',
    tituloEdicao: 'Editar questao teorica',
    subtitulo: 'Cadastre a pergunta, o gabarito e a explicacao que vai apoiar o aluno no simulado teorico.',
  },
  praticas: {
    codigo: 'PRATICO',
    tituloCriacao: 'Nova questao pratica',
    tituloEdicao: 'Editar questao pratica',
    subtitulo: 'Cadastre a pergunta, o gabarito e a explicacao que vai apoiar o aluno no simulado pratico.',
  },
}

const DIFICULDADES = ['FACIL', 'MEDIA', 'DIFICIL']
const STATUS = ['RASCUNHO', 'PUBLICADA', 'ARQUIVADA']
const LETRAS = ['A', 'B', 'C', 'D']

function criarAlternativasVazias() {
  return LETRAS.map((_, index) => ({
    texto: '',
    imagemUrl: '',
    correta: index === 0,
    ordem: index,
  }))
}

function getModalidadeSlug(modalidade) {
  return modalidade === 'PRATICO' ? 'praticas' : 'teoricas'
}

function criarFormularioVazio(modalidade) {
  const temas = TEMAS_POR_MODALIDADE[modalidade] || TEMAS_POR_MODALIDADE.TEORICO
  return {
    modalidade,
    enunciado: '',
    imagemUrl: '',
    tema: temas[0],
    dificuldade: 'MEDIA',
    status: 'RASCUNHO',
    explicacaoCurta: '',
    explicacaoDetalhada: '',
    videoUrl: '',
    ordemExibicao: '0',
    alternativas: criarAlternativasVazias(),
  }
}

export default function AdminQuestaoForm() {
  const { modalidadeSlug = 'teoricas', id } = useParams()
  const isEdicao = Boolean(id)
  const navigate = useNavigate()
  const { show, ToastEl } = useToast()
  const modalidadeAtual = MODALIDADES[modalidadeSlug] || MODALIDADES.teoricas

  const [form, setForm] = useState(criarFormularioVazio(modalidadeAtual.codigo))
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState({})
  const [uploadingField, setUploadingField] = useState('')

  useEffect(() => {
    if (!isEdicao) {
      setForm(criarFormularioVazio(modalidadeAtual.codigo))
    }
  }, [isEdicao, modalidadeAtual.codigo])

  useEffect(() => {
    if (!isEdicao) {
      setLoading(false)
      return
    }

    questaoService.buscarAdmin(id)
      .then(response => {
        const alternativas = [...response.alternativas]
          .sort((a, b) => a.ordem - b.ordem)
          .map(item => ({
            texto: item.texto || '',
            imagemUrl: item.imagemUrl || '',
            correta: item.correta,
            ordem: item.ordem,
          }))

        setForm({
          modalidade: response.modalidade || 'TEORICO',
          enunciado: response.enunciado || '',
          imagemUrl: response.imagemUrl || '',
          tema: response.tema || (TEMAS_POR_MODALIDADE[response.modalidade || 'TEORICO']?.[0] || 'LEGISLACAO'),
          dificuldade: response.dificuldade || 'MEDIA',
          status: response.status || 'RASCUNHO',
          explicacaoCurta: response.explicacaoCurta || '',
          explicacaoDetalhada: response.explicacaoDetalhada || '',
          videoUrl: response.videoUrl || '',
          ordemExibicao: String(response.ordemExibicao ?? 0),
          alternativas: alternativas.length > 0 ? alternativas : criarAlternativasVazias(),
        })
      })
      .finally(() => setLoading(false))
  }, [id, isEdicao])

  const respostaCorretaIndex = useMemo(
    () => form.alternativas.findIndex(item => item.correta),
    [form.alternativas]
  )
  const temasDisponiveis = TEMAS_POR_MODALIDADE[form.modalidade] || TEMAS_POR_MODALIDADE.TEORICO
  const modalidadeFormSlug = getModalidadeSlug(form.modalidade)

  function set(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setErros(current => ({ ...current, [field]: undefined }))
  }

  function setAlternativa(index, field, value) {
    setForm(current => ({
      ...current,
      alternativas: current.alternativas.map((item, idx) => (
        idx === index ? { ...item, [field]: value } : item
      )),
    }))
    setErros(current => ({ ...current, alternativas: undefined }))
  }

  function marcarCorreta(index) {
    setForm(current => ({
      ...current,
      alternativas: current.alternativas.map((item, idx) => ({
        ...item,
        correta: idx === index,
      })),
    }))
    setErros(current => ({ ...current, alternativas: undefined }))
  }

  function validar() {
    const novosErros = {}

    if (!form.enunciado.trim()) novosErros.enunciado = 'Campo obrigatorio'
    if (!form.explicacaoCurta.trim()) novosErros.explicacaoCurta = 'Campo obrigatorio'

    const alternativasInvalidas = form.alternativas.some(item => !item.texto.trim() && !item.imagemUrl.trim())
    if (alternativasInvalidas || respostaCorretaIndex < 0) {
      novosErros.alternativas = 'Cada alternativa precisa ter texto, imagem ou os dois. Escolha tambem a correta.'
    }

    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  async function enviarImagem(file, onSuccess, fieldKey, successMessage) {
    if (!file) return

    setUploadingField(fieldKey)
    try {
      const response = await uploadService.enviarImagem(file)
      onSuccess(response.url)
      show(successMessage)
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao enviar imagem.', 'error')
    } finally {
      setUploadingField('')
    }
  }

  async function handleUploadQuestao(event) {
    const file = event.target.files?.[0]
    await enviarImagem(
      file,
      url => set('imagemUrl', url),
      'questao',
      'Imagem da questao enviada com sucesso.'
    )
    event.target.value = ''
  }

  async function handleUploadAlternativa(index, event) {
    const file = event.target.files?.[0]
    await enviarImagem(
      file,
      url => setAlternativa(index, 'imagemUrl', url),
      `alternativa-${index}`,
      `Imagem da alternativa ${LETRAS[index]} enviada com sucesso.`
    )
    event.target.value = ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validar()) return

    setSalvando(true)

    const payload = {
      modalidade: form.modalidade,
      enunciado: form.enunciado.trim(),
      imagemUrl: form.imagemUrl.trim() || null,
      tema: form.tema,
      dificuldade: form.dificuldade,
      status: form.status,
      explicacaoCurta: form.explicacaoCurta.trim(),
      explicacaoDetalhada: form.explicacaoDetalhada.trim() || null,
      videoUrl: form.videoUrl.trim() || null,
      ordemExibicao: Number(form.ordemExibicao) || 0,
      alternativas: form.alternativas.map((item, index) => ({
        texto: item.texto.trim() || null,
        imagemUrl: item.imagemUrl.trim() || null,
        correta: item.correta,
        ordem: index,
      })),
    }

    try {
      if (isEdicao) {
        await questaoService.atualizarAdmin(id, payload)
        show('Questao atualizada com sucesso.')
      } else {
        await questaoService.criarAdmin(payload)
        show('Questao criada com sucesso.')
      }

      setTimeout(() => navigate(`/admin/questoes/${modalidadeFormSlug}`), 700)
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao salvar questao.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div className="spinner" />

  return (
    <>
      {ToastEl}

      <button className="back-link" onClick={() => navigate(`/admin/questoes/${modalidadeFormSlug}`)}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        Voltar
      </button>

      <div className="page-title">{isEdicao ? modalidadeAtual.tituloEdicao : modalidadeAtual.tituloCriacao}</div>
      <p className="page-sub">{modalidadeAtual.subtitulo}</p>

      <div className="card" style={{ maxWidth: 900 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Modalidade</label>
            <input className="form-input" value={formatModalidadeQuestao(form.modalidade)} disabled />
          </div>

          <div className="form-group">
            <label className="form-label">Enunciado *</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 120 }}
              placeholder="Digite a pergunta exatamente como ela deve aparecer no simulado."
              value={form.enunciado}
              onChange={event => set('enunciado', event.target.value)}
            />
            {erros.enunciado && <div className="form-error">{erros.enunciado}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Imagem da questao</label>
            <div className="question-media-stack">
              <input
                className="form-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUploadQuestao}
                disabled={uploadingField === 'questao'}
              />
              <input
                className="form-input"
                placeholder="/media/... ou URL publica da imagem"
                value={form.imagemUrl}
                onChange={event => set('imagemUrl', event.target.value)}
              />
              <div className="mini-copy">
                Upload recomendado para imagens de placas e ilustracoes da pergunta.
                {uploadingField === 'questao' ? ' Enviando imagem...' : ''}
              </div>
              {form.imagemUrl && (
                <div className="question-media-preview-wrap">
                  <img
                    src={form.imagemUrl}
                    alt="Preview da questao"
                    className="question-media-preview"
                  />
                  <button className="btn btn-ghost" type="button" onClick={() => set('imagemUrl', '')}>
                    Remover imagem
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tema</label>
              <select className="form-select" value={form.tema} onChange={event => set('tema', event.target.value)}>
                {temasDisponiveis.map(tema => (
                  <option key={tema} value={tema}>{formatTemaQuestao(tema)}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Dificuldade</label>
              <select className="form-select" value={form.dificuldade} onChange={event => set('dificuldade', event.target.value)}>
                {DIFICULDADES.map(item => (
                  <option key={item} value={item}>{formatDificuldadeQuestao(item)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={event => set('status', event.target.value)}>
                {STATUS.map(item => (
                  <option key={item} value={item}>{formatStatusQuestao(item)}</option>
                ))}
              </select>
            </div>

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
          </div>

          <div className="form-group">
            <label className="form-label">Explicacao curta *</label>
            <textarea
              className="form-textarea"
              placeholder="Resumo curto para mostrar logo depois da resposta."
              value={form.explicacaoCurta}
              onChange={event => set('explicacaoCurta', event.target.value)}
            />
            {erros.explicacaoCurta && <div className="form-error">{erros.explicacaoCurta}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Explicacao detalhada</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 120 }}
              placeholder="Aprofunde a explicacao para revisao do aluno. Esse campo pode ficar vazio no MVP."
              value={form.explicacaoDetalhada}
              onChange={event => set('explicacaoDetalhada', event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Video explicativo</label>
            <input
              className="form-input"
              placeholder="https://youtube.com/watch?v=..."
              value={form.videoUrl}
              onChange={event => set('videoUrl', event.target.value)}
            />
            <div className="mini-copy">Opcional. O aluno so abre o video se quiser consultar a explicacao em apoio.</div>
          </div>

          <div className="form-group">
            <div className="section-heading">Alternativas</div>
            <div className="mini-copy" style={{ marginTop: '0.35rem' }}>
              Preencha as quatro opcoes e marque qual delas e a resposta correta.
            </div>

            <div className="question-option-grid">
              {form.alternativas.map((alternativa, index) => (
                <div key={index} className="question-option-card">
                  <div className="question-option-head">
                    <div className="question-option-label">Alternativa {LETRAS[index]}</div>
                    <label className="question-correct-toggle">
                      <input
                        type="radio"
                        name="alternativa-correta"
                        checked={alternativa.correta}
                        onChange={() => marcarCorreta(index)}
                      />
                      <span>Resposta correta</span>
                    </label>
                  </div>

                  <textarea
                    className="form-textarea"
                    placeholder={`Texto da alternativa ${LETRAS[index]}`}
                    value={alternativa.texto}
                    onChange={event => setAlternativa(index, 'texto', event.target.value)}
                  />

                  <div className="question-media-stack question-media-stack--option">
                    <input
                      className="form-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={event => handleUploadAlternativa(index, event)}
                      disabled={uploadingField === `alternativa-${index}`}
                    />
                    <input
                      className="form-input"
                      placeholder={`Imagem da alternativa ${LETRAS[index]} (opcional)`}
                      value={alternativa.imagemUrl}
                      onChange={event => setAlternativa(index, 'imagemUrl', event.target.value)}
                    />
                    <div className="mini-copy">
                      Use quando a resposta depender de placa, sinalizacao ou figura.
                      {uploadingField === `alternativa-${index}` ? ' Enviando imagem...' : ''}
                    </div>
                    {alternativa.imagemUrl && (
                      <div className="question-media-preview-wrap">
                        <img
                          src={alternativa.imagemUrl}
                          alt={`Preview da alternativa ${LETRAS[index]}`}
                          className="question-media-preview question-media-preview--option"
                        />
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => setAlternativa(index, 'imagemUrl', '')}
                        >
                          Remover imagem
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {erros.alternativas && <div className="form-error">{erros.alternativas}</div>}
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : isEdicao ? 'Salvar alteracoes' : 'Criar questao'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate(`/admin/questoes/${modalidadeFormSlug}`)}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
