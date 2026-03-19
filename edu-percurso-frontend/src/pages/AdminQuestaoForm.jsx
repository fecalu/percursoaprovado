import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { questaoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import {
  formatDificuldadeQuestao,
  formatStatusQuestao,
  formatTemaQuestao,
} from '../utils/formatters'

const TEMAS = [
  'PLACAS',
  'LEGISLACAO',
  'DIRECAO_DEFENSIVA',
  'PRIMEIROS_SOCORROS',
  'MECANICA_BASICA',
  'MEIO_AMBIENTE_CIDADANIA',
]

const DIFICULDADES = ['FACIL', 'MEDIA', 'DIFICIL']
const STATUS = ['RASCUNHO', 'PUBLICADA', 'ARQUIVADA']
const LETRAS = ['A', 'B', 'C', 'D']

function criarAlternativasVazias() {
  return LETRAS.map((_, index) => ({
    texto: '',
    correta: index === 0,
    ordem: index,
  }))
}

const VAZIO = {
  enunciado: '',
  tema: 'LEGISLACAO',
  dificuldade: 'MEDIA',
  status: 'RASCUNHO',
  explicacaoCurta: '',
  explicacaoDetalhada: '',
  videoUrl: '',
  ordemExibicao: '0',
  alternativas: criarAlternativasVazias(),
}

export default function AdminQuestaoForm() {
  const { id } = useParams()
  const isEdicao = Boolean(id)
  const navigate = useNavigate()
  const { show, ToastEl } = useToast()

  const [form, setForm] = useState(VAZIO)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState({})

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
            correta: item.correta,
            ordem: item.ordem,
          }))

        setForm({
          enunciado: response.enunciado || '',
          tema: response.tema || 'LEGISLACAO',
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

    const alternativasInvalidas = form.alternativas.some(item => !item.texto.trim())
    if (alternativasInvalidas || respostaCorretaIndex < 0) {
      novosErros.alternativas = 'Preencha as quatro alternativas e escolha a correta.'
    }

    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validar()) return

    setSalvando(true)

    const payload = {
      enunciado: form.enunciado.trim(),
      tema: form.tema,
      dificuldade: form.dificuldade,
      status: form.status,
      explicacaoCurta: form.explicacaoCurta.trim(),
      explicacaoDetalhada: form.explicacaoDetalhada.trim() || null,
      videoUrl: form.videoUrl.trim() || null,
      ordemExibicao: Number(form.ordemExibicao) || 0,
      alternativas: form.alternativas.map((item, index) => ({
        texto: item.texto.trim(),
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

      setTimeout(() => navigate('/admin/questoes'), 700)
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

      <button className="back-link" onClick={() => navigate('/admin/questoes')}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        Voltar
      </button>

      <div className="page-title">{isEdicao ? 'Editar questao' : 'Nova questao'}</div>
      <p className="page-sub">Cadastre a pergunta, o gabarito e a explicacao que vai apoiar o aluno no simulado teorico.</p>

      <div className="card" style={{ maxWidth: 900 }}>
        <form onSubmit={handleSubmit}>
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

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tema</label>
              <select className="form-select" value={form.tema} onChange={event => set('tema', event.target.value)}>
                {TEMAS.map(tema => (
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
                </div>
              ))}
            </div>

            {erros.alternativas && <div className="form-error">{erros.alternativas}</div>}
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : isEdicao ? 'Salvar alteracoes' : 'Criar questao'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/admin/questoes')}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
