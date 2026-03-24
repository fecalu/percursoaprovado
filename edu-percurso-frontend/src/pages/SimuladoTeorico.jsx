import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { questaoService } from '../services/api'

const MODO_TEMA = 'TEMA'
const MODO_COMPLETO = 'COMPLETO'
const DURACAO_SIMULADO_COMPLETO_SEGUNDOS = 40 * 60
const ACERTOS_MINIMOS_SIMULADO_COMPLETO = 21

function getEmbedUrl(url) {
  if (!url) return null

  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0`
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }

  return null
}

function getAlternativaLabel(ordem, fallbackIndex) {
  const indice = Number.isInteger(ordem) ? ordem : fallbackIndex
  return String.fromCharCode(65 + indice)
}

function formatarTempoRestante(totalSegundos) {
  const minutos = Math.floor(totalSegundos / 60)
  const segundos = totalSegundos % 60
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
}

export default function SimuladoTeorico() {
  const navigate = useNavigate()
  const [modoAtivo, setModoAtivo] = useState(MODO_TEMA)
  const [temas, setTemas] = useState([])
  const [temaAtivo, setTemaAtivo] = useState('')
  const [questoes, setQuestoes] = useState([])
  const [indiceAtual, setIndiceAtual] = useState(0)
  const [alternativaSelecionadaId, setAlternativaSelecionadaId] = useState('')
  const [respostaAtual, setRespostaAtual] = useState(null)
  const [respostasSessao, setRespostasSessao] = useState({})
  const [loadingTemas, setLoadingTemas] = useState(true)
  const [loadingQuestoes, setLoadingQuestoes] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [videoAberto, setVideoAberto] = useState(false)
  const [imagemExpandida, setImagemExpandida] = useState(null)
  const [tempoRestanteSegundos, setTempoRestanteSegundos] = useState(DURACAO_SIMULADO_COMPLETO_SEGUNDOS)
  const [simuladoCompletoIniciado, setSimuladoCompletoIniciado] = useState(false)
  const [simuladoCompletoFinalizado, setSimuladoCompletoFinalizado] = useState(false)
  const [motivoEncerramento, setMotivoEncerramento] = useState('')
  const [simuladoVersao, setSimuladoVersao] = useState(0)
  const [simuladoIdsParaEvitar, setSimuladoIdsParaEvitar] = useState([])

  useEffect(() => {
    let ativo = true
    setLoadingTemas(true)
    setErro('')

    questaoService.listarTemasAluno()
      .then(response => {
        if (!ativo) return
        setTemas(response)
        setTemaAtivo(response[0]?.tema || '')
      })
      .catch(error => {
        if (!ativo) return
        setErro(error.response?.data?.erro || 'Nao foi possivel carregar os temas do simulado.')
      })
      .finally(() => {
        if (ativo) setLoadingTemas(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (modoAtivo === MODO_TEMA && !temaAtivo) {
      setQuestoes([])
      setIndiceAtual(0)
      return
    }

    let ativo = true
    setLoadingQuestoes(true)
    setErro('')
    setQuestoes([])
    setIndiceAtual(0)
    setAlternativaSelecionadaId('')
    setRespostaAtual(null)
    setRespostasSessao({})
    setVideoAberto(false)
    setImagemExpandida(null)
    setTempoRestanteSegundos(DURACAO_SIMULADO_COMPLETO_SEGUNDOS)
    setSimuladoCompletoIniciado(false)
    setSimuladoCompletoFinalizado(false)
    setMotivoEncerramento('')

    const request = modoAtivo === MODO_COMPLETO
      ? questaoService.listarSimuladoCompletoAluno(simuladoIdsParaEvitar)
      : questaoService.listarTreinoAluno({ tema: temaAtivo })

    request
      .then(response => {
        if (!ativo) return
        setQuestoes(response)
      })
      .catch(error => {
        if (!ativo) return
        setErro(
          error.response?.data?.erro
            || (modoAtivo === MODO_COMPLETO
              ? 'Nao foi possivel carregar o simulado completo.'
              : 'Nao foi possivel carregar as questoes desse tema.')
        )
        setQuestoes([])
      })
      .finally(() => {
        if (ativo) setLoadingQuestoes(false)
      })

    return () => {
      ativo = false
    }
  }, [temaAtivo, modoAtivo, simuladoVersao])

  useEffect(() => {
    if (modoAtivo !== MODO_COMPLETO || !simuladoCompletoIniciado || loadingQuestoes || questoes.length === 0 || simuladoCompletoFinalizado) {
      return undefined
    }

    const interval = window.setInterval(() => {
      setTempoRestanteSegundos(valorAtual => {
        if (valorAtual <= 1) {
          window.clearInterval(interval)
          setSimuladoCompletoFinalizado(true)
          setMotivoEncerramento('tempo')
          setRespostaAtual(null)
          setVideoAberto(false)
          setImagemExpandida(null)
          return 0
        }

        return valorAtual - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [modoAtivo, simuladoCompletoIniciado, loadingQuestoes, questoes.length, simuladoCompletoFinalizado])

  const temaAtual = useMemo(
    () => temas.find(item => item.tema === temaAtivo) || null,
    [temas, temaAtivo]
  )

  const totalQuestoes = questoes.length
  const corretasSessao = Object.values(respostasSessao).filter(item => item.correta).length
  const questoesRespondidas = Object.keys(respostasSessao).length
  const treinoConcluido = totalQuestoes > 0 && indiceAtual >= totalQuestoes
  const sessaoConcluida = modoAtivo === MODO_COMPLETO ? (simuladoCompletoFinalizado || treinoConcluido) : treinoConcluido
  const questaoAtual = sessaoConcluida ? null : questoes[indiceAtual]
  const progressoPercentual = totalQuestoes ? Math.round((questoesRespondidas / totalQuestoes) * 100) : 0
  const embedUrl = getEmbedUrl(respostaAtual?.videoUrl)
  const emSimuladoCompleto = modoAtivo === MODO_COMPLETO
  const tituloAtual = emSimuladoCompleto ? 'Simulado completo' : (temaAtual?.temaLabel || 'Tema')
  const rotuloProgresso = emSimuladoCompleto ? 'Progresso no simulado' : 'Progresso no tema'
  const resumoModoCompleto = totalQuestoes > 0
    ? `${totalQuestoes} questoes mistas dos temas publicados`
    : 'Rodada mista com os temas ja publicados'
  const textoConclusao = emSimuladoCompleto
    ? `Voce respondeu ${questoesRespondidas} questoes e acertou ${corretasSessao}. Agora voce pode refazer o simulado completo ou voltar para treinar por tema.`
    : `Voce respondeu ${questoesRespondidas} questoes e acertou ${corretasSessao}. Agora voce pode repetir esse tema ou voltar para a biblioteca.`
  const aprovadoSimuladoCompleto = emSimuladoCompleto && sessaoConcluida && corretasSessao >= ACERTOS_MINIMOS_SIMULADO_COMPLETO
  const questoesNaoRespondidas = Math.max(totalQuestoes - questoesRespondidas, 0)
  const tempoRestanteFormatado = formatarTempoRestante(tempoRestanteSegundos)
  const emSimuladoCompletoEmAndamento = emSimuladoCompleto && simuladoCompletoIniciado && !sessaoConcluida
  const mostrarPainelLateral = !emSimuladoCompleto
  const mostrarFeedbackImediato = !emSimuladoCompletoEmAndamento

  const questoesErradasParaRevisao = useMemo(() => {
    if (!emSimuladoCompleto || !sessaoConcluida || aprovadoSimuladoCompleto) {
      return []
    }

    return questoes
      .map((questao, index) => {
        const resposta = respostasSessao[questao.id]
        if (!resposta || resposta.correta) {
          return null
        }

        return {
          id: questao.id,
          indice: index + 1,
          temaLabel: questao.temaLabel,
          enunciado: questao.enunciado,
          explicacaoCurta: resposta.explicacaoCurta || questao.explicacaoCurta,
          explicacaoDetalhada: resposta.explicacaoDetalhada || questao.explicacaoDetalhada,
          alternativaSelecionadaId: resposta.alternativaSelecionadaId,
          alternativaCorretaId: resposta.alternativaCorretaId,
          alternativaCorretaLabel: resposta.alternativaCorretaLabel,
          alternativaCorretaTexto: resposta.alternativaCorretaTexto,
          alternativas: questao.alternativas,
        }
      })
      .filter(Boolean)
  }, [aprovadoSimuladoCompleto, emSimuladoCompleto, questoes, respostasSessao, sessaoConcluida])

  function reiniciarTema() {
    setIndiceAtual(0)
    setAlternativaSelecionadaId('')
    setRespostaAtual(null)
    setRespostasSessao({})
    setVideoAberto(false)
    setImagemExpandida(null)
    setTempoRestanteSegundos(DURACAO_SIMULADO_COMPLETO_SEGUNDOS)
    setSimuladoCompletoIniciado(false)
    setSimuladoCompletoFinalizado(false)
    setMotivoEncerramento('')
    setErro('')
  }

  function gerarNovoSimulado() {
    const idsAtuais = questoes.map(questao => questao.id)
    setSimuladoIdsParaEvitar(idsAtuais)
    setSimuladoVersao(valorAtual => valorAtual + 1)
  }

  async function responderQuestao() {
    if (!questaoAtual || !alternativaSelecionadaId) {
      setErro('Selecione uma alternativa para continuar.')
      return
    }

    setEnviando(true)
    setErro('')

    try {
      const response = await questaoService.responderAluno(questaoAtual.id, {
        alternativaId: alternativaSelecionadaId,
      })

      setRespostasSessao(prev => ({
        ...prev,
        [questaoAtual.id]: response,
      }))
      setVideoAberto(false)

      if (emSimuladoCompletoEmAndamento) {
        const proximoIndice = indiceAtual + 1
        setIndiceAtual(proximoIndice)
        setAlternativaSelecionadaId('')
        setRespostaAtual(null)
        setImagemExpandida(null)
        return
      }

      setRespostaAtual(response)
    } catch (error) {
      setErro(error.response?.data?.erro || 'Nao foi possivel corrigir essa questao.')
    } finally {
      setEnviando(false)
    }
  }

  function proximaQuestao() {
    if (!questaoAtual) return

    const proximoIndice = indiceAtual + 1
    setIndiceAtual(proximoIndice)
    setAlternativaSelecionadaId('')
    setRespostaAtual(null)
    setVideoAberto(false)
    setImagemExpandida(null)
    setErro('')
  }

  function getEstadoAlternativa(alternativa) {
    if (!respostaAtual) {
      return alternativaSelecionadaId === alternativa.id ? 'is-selected' : ''
    }

    if (emSimuladoCompletoEmAndamento) {
      return alternativa.id === respostaAtual.alternativaSelecionadaId ? 'is-locked' : ''
    }

    if (alternativa.id === respostaAtual.alternativaCorretaId) return 'is-correct'
    if (alternativa.id === respostaAtual.alternativaSelecionadaId && !respostaAtual.correta) return 'is-incorrect'
    return ''
  }

  function abrirImagem(src, alt) {
    setImagemExpandida({ src, alt })
  }

  const alternativaCorretaAtual = useMemo(
    () => questaoAtual?.alternativas?.find(item => item.id === respostaAtual?.alternativaCorretaId) || null,
    [questaoAtual, respostaAtual]
  )

  if (loadingTemas) return <div className="spinner" />

  return (
    <div className="student-shell student-shell--compact">
      <section className="simulado-mode-card">
        <div className="simulado-mode-switch" role="tablist" aria-label="Modos do simulado">
          <button
            type="button"
            className={`simulado-mode-pill ${modoAtivo === MODO_TEMA ? 'is-active' : ''}`}
            onClick={() => setModoAtivo(MODO_TEMA)}
          >
            Treinar por tema
          </button>
          <button
            type="button"
            className={`simulado-mode-pill ${modoAtivo === MODO_COMPLETO ? 'is-active' : ''}`}
            onClick={() => setModoAtivo(MODO_COMPLETO)}
          >
            Simulado completo
          </button>
          <button type="button" className="simulado-mode-pill" disabled>
            Revisar erros
            <span className="simulado-mode-pill-note">Em breve</span>
          </button>
        </div>

        {modoAtivo === MODO_TEMA && temas.length > 0 && (
          <div className="simulado-theme-strip">
            {temas.map(item => (
              <button
                key={item.tema}
                type="button"
                className={`simulado-theme-pill ${item.tema === temaAtivo ? 'is-active' : ''}`}
                onClick={() => setTemaAtivo(item.tema)}
              >
                <span>{item.temaLabel}</span>
                <strong>{item.totalQuestoes}</strong>
              </button>
            ))}
          </div>
        )}

        {modoAtivo === MODO_COMPLETO && (
          <div className="simulado-mode-summary">
            <span className="student-inline-note">Modo ativo</span>
            <strong>{resumoModoCompleto}</strong>
          </div>
        )}
      </section>

      {erro && <div className="alert alert-error">{erro}</div>}

      {!loadingQuestoes && temas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">?</div>
          Ainda nao existem questoes publicadas no simulado teorico.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/biblioteca')}>
              Voltar para a biblioteca
            </button>
          </div>
        </div>
      ) : loadingQuestoes ? (
        <div className="spinner" />
      ) : !questaoAtual && !sessaoConcluida ? (
        <div className="empty-state">
          <div className="empty-state-icon">!</div>
          {emSimuladoCompleto
            ? 'Ainda nao existem questoes suficientes para montar o simulado completo.'
            : 'Nenhuma questao publicada para esse tema no momento.'}
        </div>
      ) : (
        <div className={`simulado-layout ${emSimuladoCompleto ? 'is-complete-mode' : ''} ${emSimuladoCompletoEmAndamento ? 'is-exam-mode' : ''}`}>
          <section className="student-card simulado-question-card">
            {sessaoConcluida ? (
              <div className="simulado-finish-card">
                <span className={`badge ${aprovadoSimuladoCompleto ? 'badge-green' : 'badge-warn'}`}>
                  {emSimuladoCompleto
                    ? (aprovadoSimuladoCompleto ? 'Simulado aprovado' : 'Simulado encerrado')
                    : 'Tema concluido'}
                </span>
                <h2 className="student-card-title">
                  {emSimuladoCompleto
                    ? (aprovadoSimuladoCompleto ? 'Voce atingiu a nota minima' : 'Voce ainda nao atingiu a nota minima')
                    : `Treino finalizado em ${temaAtual?.temaLabel || 'simulado teorico'}`}
                </h2>
                <p className="student-card-copy">{textoConclusao}</p>
                {emSimuladoCompleto && (
                  <div className={`simulado-result-card ${aprovadoSimuladoCompleto ? 'is-pass' : 'is-fail'}`}>
                    <div className="simulado-result-seal">{aprovadoSimuladoCompleto ? 'Trofeu da aprovacao' : 'Hora de revisar'}</div>
                    <div className="simulado-result-copy">
                      {aprovadoSimuladoCompleto
                        ? `Voce fez ${corretasSessao} acertos e ultrapassou a meta minima de ${ACERTOS_MINIMOS_SIMULADO_COMPLETO}.`
                        : `Voce fez ${corretasSessao} acertos e precisava de ${ACERTOS_MINIMOS_SIMULADO_COMPLETO} para passar.`}
                      {motivoEncerramento === 'tempo' && !aprovadoSimuladoCompleto
                        ? ' O tempo de prova terminou antes de voce concluir a rodada.'
                        : ''}
                    </div>
                  </div>
                )}
                <div className="player-meta-grid">
                  <div className="player-meta-card">
                    <div className="player-meta-label">Taxa de acerto</div>
                    <div className="player-meta-value">{totalQuestoes ? `${Math.round((corretasSessao / totalQuestoes) * 100)}%` : '0%'}</div>
                  </div>
                  <div className="player-meta-card">
                    <div className="player-meta-label">Questoes respondidas</div>
                    <div className="player-meta-value">{questoesRespondidas}</div>
                  </div>
                  <div className="player-meta-card">
                    <div className="player-meta-label">{emSimuladoCompleto ? 'Modo' : 'Tema'}</div>
                    <div className="player-meta-value">{tituloAtual}</div>
                  </div>
                  {emSimuladoCompleto && (
                    <>
                      <div className="player-meta-card">
                        <div className="player-meta-label">Minimo para passar</div>
                        <div className="player-meta-value">{ACERTOS_MINIMOS_SIMULADO_COMPLETO}</div>
                      </div>
                      <div className="player-meta-card">
                        <div className="player-meta-label">Nao respondidas</div>
                        <div className="player-meta-value">{questoesNaoRespondidas}</div>
                      </div>
                    </>
                  )}
                </div>
                {emSimuladoCompleto && !aprovadoSimuladoCompleto && (
                  <div className="simulado-review-list">
                    <div className="player-side-title">Questoes para revisar</div>
                    {questoesNaoRespondidas > 0 && (
                      <div className="simulado-review-note">
                        {questoesNaoRespondidas} questoes ficaram sem resposta e contam contra a nota final.
                      </div>
                    )}
                    {questoesErradasParaRevisao.map(item => {
                      const alternativaSelecionada = item.alternativas?.find(alternativa => alternativa.id === item.alternativaSelecionadaId)
                      return (
                        <article key={item.id} className="simulado-review-card">
                          <div className="simulado-review-head">
                            <span className="badge badge-gray">Questao {item.indice}</span>
                            <span className="simulado-review-theme">{item.temaLabel}</span>
                          </div>
                          <h3 className="simulado-review-question">{item.enunciado}</h3>
                          <div className="simulado-review-answer is-wrong">
                            Sua resposta: {alternativaSelecionada
                              ? `${getAlternativaLabel(alternativaSelecionada.ordem)}${alternativaSelecionada.texto ? ` - ${alternativaSelecionada.texto}` : ''}`
                              : 'Nao respondida'}
                          </div>
                          <div className="simulado-review-answer is-right">
                            Correta: {item.alternativaCorretaLabel}
                            {item.alternativaCorretaTexto ? ` - ${item.alternativaCorretaTexto}` : ''}
                          </div>
                          <p className="simulado-review-explanation">{item.explicacaoCurta}</p>
                          {item.explicacaoDetalhada && (
                            <div className="simulado-review-detail">{item.explicacaoDetalhada}</div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
                <div className="student-card-actions">
                  {emSimuladoCompleto ? (
                    <>
                      <button type="button" className="btn btn-primary" onClick={gerarNovoSimulado}>
                        Gerar novo simulado
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={reiniciarTema}>
                        Refazer este simulado
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setModoAtivo(MODO_TEMA)}>
                        Treinar por tema
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-primary" onClick={reiniciarTema}>
                        Refazer tema
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => navigate('/biblioteca')}>
                        Voltar para a biblioteca
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : emSimuladoCompleto && !simuladoCompletoIniciado ? (
              <div className="simulado-intro-card">
                <span className="badge badge-blue">Modo prova</span>
                <h2 className="student-card-title">Simulado completo</h2>
                <p className="student-card-copy">
                  Esta rodada segue o formato de prova: 30 questoes, 40 minutos e minimo de 21 acertos para passar.
                  O tempo comeca a contar quando voce confirmar o inicio.
                </p>
                <div className="simulado-intro-grid">
                  <div className="simulado-intro-rule">
                    <span className="simulado-intro-label">Tempo</span>
                    <strong>40 minutos</strong>
                  </div>
                  <div className="simulado-intro-rule">
                    <span className="simulado-intro-label">Meta</span>
                    <strong>21 acertos</strong>
                  </div>
                  <div className="simulado-intro-rule">
                    <span className="simulado-intro-label">Formato</span>
                    <strong>30 questoes</strong>
                  </div>
                </div>
                <div className="student-help-steps">
                  <div className="student-help-step">1. Legislação de trânsito: 12 questões, usando o bloco combinado de legislação e placas.</div>
                  <div className="student-help-step">2. Direção defensiva: 10 questões, com foco em decisão segura e prevenção.</div>
                  <div className="student-help-step">3. Primeiros socorros, cidadania e meio ambiente, e mecânica básica completam a prova.</div>
                </div>
                <div className="student-card-actions">
                  <button type="button" className="btn btn-primary" onClick={() => setSimuladoCompletoIniciado(true)}>
                    Iniciar prova agora
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setModoAtivo(MODO_TEMA)}>
                    Voltar para treinar por tema
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="student-card-top">
                  <div>
                    <span className="badge badge-blue">{tituloAtual}</span>
                    <h2 className="student-card-title simulado-question-title">
                      Questao {indiceAtual + 1} de {totalQuestoes}
                    </h2>
                    {emSimuladoCompleto && (
                      <div className="simulado-question-meta">Tema da questao: {questaoAtual?.temaLabel || '-'}</div>
                    )}
                  </div>
                  <span className="badge badge-gray">{questaoAtual?.dificuldadeLabel}</span>
                </div>

                <div className="simulado-question-scroll">
                  {emSimuladoCompleto && (
                    <div className="simulado-exam-strip">
                      <div className="simulado-exam-pill">
                        <span className="simulado-exam-pill-label">Tempo restante</span>
                        <strong>{tempoRestanteFormatado}</strong>
                      </div>
                      <div className="simulado-exam-pill">
                        <span className="simulado-exam-pill-label">Minimo para passar</span>
                        <strong>{ACERTOS_MINIMOS_SIMULADO_COMPLETO} acertos</strong>
                      </div>
                      <div className="simulado-exam-pill">
                        <span className="simulado-exam-pill-label">Prova</span>
                        <strong>40 minutos</strong>
                      </div>
                    </div>
                  )}

                  <div className="simulado-question-stage">
                    <p className="student-card-copy simulado-question-copy">{questaoAtual?.enunciado}</p>

                    {questaoAtual?.imagemUrl && (
                      <button
                        type="button"
                        className="simulado-image-button simulado-image-button--question"
                        onClick={() => abrirImagem(questaoAtual.imagemUrl, `Imagem da questao ${indiceAtual + 1}`)}
                      >
                        <img
                          src={questaoAtual.imagemUrl}
                          alt={`Imagem da questao ${indiceAtual + 1}`}
                          className="simulado-question-image"
                        />
                        <span className="simulado-image-caption">Clique para ampliar</span>
                      </button>
                    )}
                  </div>

                  <div className="simulado-answer-stage">
                    <div className="simulado-progress-head">
                      <span className="student-inline-note">{rotuloProgresso}</span>
                      <span className="student-inline-note">{progressoPercentual}% concluido</span>
                    </div>
                    <div className="student-progress-bar">
                      <div className="student-progress-fill" style={{ width: `${progressoPercentual}%` }} />
                    </div>

                    <div className="simulado-option-list">
                      {questaoAtual?.alternativas.map((alternativa, index) => (
                        <button
                          key={alternativa.id}
                          type="button"
                          className={`simulado-option ${getEstadoAlternativa(alternativa)}`}
                          onClick={() => !respostaAtual && setAlternativaSelecionadaId(alternativa.id)}
                          disabled={Boolean(respostaAtual)}
                        >
                          <span className="simulado-option-label">{getAlternativaLabel(alternativa.ordem, index)}</span>
                          <span className="simulado-option-body">
                            {alternativa.imagemUrl && (
                              <img
                                src={alternativa.imagemUrl}
                                alt={`Imagem da alternativa ${getAlternativaLabel(alternativa.ordem, index)}`}
                                className="simulado-option-image"
                                onClick={event => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  abrirImagem(
                                    alternativa.imagemUrl,
                                    `Imagem da alternativa ${getAlternativaLabel(alternativa.ordem, index)}`
                                  )
                                }}
                              />
                            )}
                            {alternativa.texto && (
                              <span className="simulado-option-text">{alternativa.texto}</span>
                            )}
                            {!alternativa.texto && alternativa.imagemUrl && (
                              <span className="simulado-option-text simulado-option-text--muted">
                                Alternativa em imagem
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>

                    {respostaAtual && mostrarFeedbackImediato && (
                      <div className={`simulado-feedback ${respostaAtual.correta ? 'is-correct' : 'is-incorrect'}`}>
                        <strong>{respostaAtual.correta ? 'Resposta correta.' : 'Resposta incorreta.'}</strong>
                        {!respostaAtual.correta && (
                          <span>
                            Alternativa correta: {respostaAtual.alternativaCorretaLabel}
                            {alternativaCorretaAtual?.texto ? ` - ${alternativaCorretaAtual.texto}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="simulado-action-row">
                  {!respostaAtual ? (
                    <button type="button" className="btn btn-primary" onClick={responderQuestao} disabled={enviando}>
                      {enviando ? 'Enviando...' : 'Responder'}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={proximaQuestao}>
                      {indiceAtual + 1 >= totalQuestoes
                        ? (emSimuladoCompleto ? 'Finalizar simulado' : 'Finalizar tema')
                        : 'Proxima questao'}
                    </button>
                  )}

                  <button type="button" className="btn btn-ghost" onClick={reiniciarTema}>
                    {emSimuladoCompleto ? 'Reiniciar prova' : 'Reiniciar tema'}
                  </button>
                </div>
              </>
            )}
          </section>

          {mostrarPainelLateral && (
            <aside className="player-side-card simulado-explainer-card">
            <div className="player-side-title">Explicacao da questao</div>
            {emSimuladoCompleto && !simuladoCompletoIniciado && !sessaoConcluida ? (
              <>
                <div className="player-side-copy">
                  Quando voce iniciar, a prova passa a valer em modo continuo. As explicacoes so entram no resultado final
                  se houver reprovacao.
                </div>
                <div className="player-meta-grid simulado-side-metrics">
                  <div className="player-meta-card">
                    <div className="player-meta-label">Tempo oficial</div>
                    <div className="player-meta-value">40 min</div>
                  </div>
                  <div className="player-meta-card">
                    <div className="player-meta-label">Minimo</div>
                    <div className="player-meta-value">21 acertos</div>
                  </div>
                  <div className="player-meta-card">
                    <div className="player-meta-label">Tentativa</div>
                    <div className="player-meta-value">1 rodada</div>
                  </div>
                </div>
              </>
            ) : !respostaAtual ? (
              <>
                <div className="player-side-copy">
                  Responda a questao para comparar com a explicacao em texto e, se existir, abrir o video explicativo.
                </div>
                <div className="student-help-steps">
                  <div className="student-help-step">1. Escolha a alternativa que voce considera correta.</div>
                  <div className="student-help-step">2. Clique em responder para ver o gabarito.</div>
                  <div className="student-help-step">3. Use a explicacao para entender o ponto principal antes de seguir.</div>
                </div>
              </>
            ) : (
              <>
                <span className={`badge ${respostaAtual.correta ? 'badge-green' : 'badge-warn'}`}>
                  {respostaAtual.correta ? 'Voce acertou' : 'Hora de revisar'}
                </span>
                <div className="player-side-copy">{respostaAtual.explicacaoCurta}</div>
                {respostaAtual.explicacaoDetalhada && (
                  <div className="simulado-explanation-text">{respostaAtual.explicacaoDetalhada}</div>
                )}

                {respostaAtual.videoUrl && (
                  <div className="simulado-video-wrap">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setVideoAberto(prev => !prev)}
                    >
                      {videoAberto ? 'Ocultar video' : 'Ver explicacao em video'}
                    </button>

                    {videoAberto && (
                      embedUrl ? (
                        <div className="simulado-video-frame">
                          <iframe
                            src={embedUrl}
                            title="Explicacao da questao"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <a
                          href={respostaAtual.videoUrl}
                          className="btn btn-primary"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir video em nova aba
                        </a>
                      )
                    )}
                  </div>
                )}
              </>
            )}

            <div className="player-meta-grid simulado-side-metrics">
              <div className="player-meta-card">
                <div className="player-meta-label">{emSimuladoCompleto ? 'Modo atual' : 'Tema atual'}</div>
                <div className="player-meta-value">{tituloAtual}</div>
              </div>
              <div className="player-meta-card">
                <div className="player-meta-label">Respondidas</div>
                <div className="player-meta-value">{questoesRespondidas}</div>
              </div>
              <div className="player-meta-card">
                <div className="player-meta-label">Acertos</div>
                <div className="player-meta-value">{corretasSessao}</div>
              </div>
              {emSimuladoCompleto && (
                <div className="player-meta-card">
                  <div className="player-meta-label">Meta minima</div>
                  <div className="player-meta-value">{ACERTOS_MINIMOS_SIMULADO_COMPLETO}</div>
                </div>
              )}
            </div>
            </aside>
          )}
        </div>
      )}

      {imagemExpandida && (
        <div className="simulado-image-modal" onClick={() => setImagemExpandida(null)}>
          <div className="simulado-image-modal-dialog" onClick={event => event.stopPropagation()}>
            <button
              type="button"
              className="simulado-image-modal-close"
              onClick={() => setImagemExpandida(null)}
            >
              Fechar
            </button>
            <img src={imagemExpandida.src} alt={imagemExpandida.alt} className="simulado-image-modal-img" />
          </div>
        </div>
      )}
    </div>
  )
}
