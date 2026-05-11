import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { questaoService } from '../services/api'

const DURACAO_SIMULADO_SEGUNDOS = 25 * 60
const ACERTOS_MINIMOS = 14

function getAlternativaLabel(ordem, fallbackIndex) {
  const indice = Number.isInteger(ordem) ? ordem : fallbackIndex
  return String.fromCharCode(65 + indice)
}

function formatarTempoRestante(totalSegundos) {
  const minutos = Math.floor(totalSegundos / 60)
  const segundos = totalSegundos % 60
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
}

export default function SimuladoPratico() {
  const navigate = useNavigate()
  const [questoes, setQuestoes] = useState([])
  const [indiceAtual, setIndiceAtual] = useState(0)
  const [alternativaSelecionadaId, setAlternativaSelecionadaId] = useState('')
  const [respostasSessao, setRespostasSessao] = useState({})
  const [loadingQuestoes, setLoadingQuestoes] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [imagemExpandida, setImagemExpandida] = useState(null)
  const [tempoRestanteSegundos, setTempoRestanteSegundos] = useState(DURACAO_SIMULADO_SEGUNDOS)
  const [simuladoIniciado, setSimuladoIniciado] = useState(false)
  const [simuladoFinalizado, setSimuladoFinalizado] = useState(false)
  const [motivoEncerramento, setMotivoEncerramento] = useState('')
  const [simuladoVersao, setSimuladoVersao] = useState(0)
  const [simuladoIdsParaEvitar, setSimuladoIdsParaEvitar] = useState([])

  useEffect(() => {
    let ativo = true
    setLoadingQuestoes(true)
    setErro('')
    setQuestoes([])
    setIndiceAtual(0)
    setAlternativaSelecionadaId('')
    setRespostasSessao({})
    setImagemExpandida(null)
    setTempoRestanteSegundos(DURACAO_SIMULADO_SEGUNDOS)
    setSimuladoIniciado(false)
    setSimuladoFinalizado(false)
    setMotivoEncerramento('')

    questaoService.listarSimuladoCompletoAluno('PRATICO', simuladoIdsParaEvitar)
      .then(response => {
        if (!ativo) return
        setQuestoes(response)
      })
      .catch(error => {
        if (!ativo) return
        setErro(error.response?.data?.erro || 'Nao foi possivel carregar o simulado pratico.')
        setQuestoes([])
      })
      .finally(() => {
        if (ativo) setLoadingQuestoes(false)
      })

    return () => {
      ativo = false
    }
  }, [simuladoVersao])

  useEffect(() => {
    if (!simuladoIniciado || loadingQuestoes || questoes.length === 0 || simuladoFinalizado) {
      return undefined
    }

    const interval = window.setInterval(() => {
      setTempoRestanteSegundos(valorAtual => {
        if (valorAtual <= 1) {
          window.clearInterval(interval)
          setSimuladoFinalizado(true)
          setMotivoEncerramento('tempo')
          return 0
        }

        return valorAtual - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [simuladoIniciado, loadingQuestoes, questoes.length, simuladoFinalizado])

  const totalQuestoes = questoes.length
  const corretasSessao = Object.values(respostasSessao).filter(item => item.correta).length
  const questoesRespondidas = Object.keys(respostasSessao).length
  const simuladoConcluido = simuladoFinalizado || (totalQuestoes > 0 && indiceAtual >= totalQuestoes)
  const questaoAtual = simuladoConcluido ? null : questoes[indiceAtual]
  const progressoPercentual = totalQuestoes ? Math.round((questoesRespondidas / totalQuestoes) * 100) : 0
  const aprovado = simuladoConcluido && corretasSessao >= ACERTOS_MINIMOS
  const questoesNaoRespondidas = Math.max(totalQuestoes - questoesRespondidas, 0)
  const tempoRestanteFormatado = formatarTempoRestante(tempoRestanteSegundos)

  const questoesErradasParaRevisao = useMemo(() => {
    if (!simuladoConcluido || aprovado) {
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
  }, [aprovado, questoes, respostasSessao, simuladoConcluido])

  function reiniciarSimulado() {
    setIndiceAtual(0)
    setAlternativaSelecionadaId('')
    setRespostasSessao({})
    setImagemExpandida(null)
    setTempoRestanteSegundos(DURACAO_SIMULADO_SEGUNDOS)
    setSimuladoIniciado(false)
    setSimuladoFinalizado(false)
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
      setIndiceAtual(prev => prev + 1)
      setAlternativaSelecionadaId('')
      setImagemExpandida(null)
    } catch (error) {
      setErro(error.response?.data?.erro || 'Nao foi possivel corrigir essa questao.')
    } finally {
      setEnviando(false)
    }
  }

  function abrirImagem(src, alt) {
    setImagemExpandida({ src, alt })
  }

  if (loadingQuestoes) return <div className="spinner" />

  return (
    <div className="student-shell student-shell--compact">
      <section className="simulado-mode-card">
        <div className="simulado-mode-summary">
          <span className="student-inline-note">Modo ativo</span>
          <strong>Simulado pratico completo com 20 questoes publicadas</strong>
        </div>
      </section>

      {erro && <div className="alert alert-error">{erro}</div>}

      {questoes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">?</div>
          Ainda nao existem questoes suficientes para montar o simulado pratico.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/simulado')}>
              Voltar para simulados
            </button>
          </div>
        </div>
      ) : (
        <div className="simulado-layout is-complete-mode is-exam-mode">
          <section className="student-card simulado-question-card">
            {simuladoConcluido ? (
              <div className="simulado-finish-card">
                <span className={`badge ${aprovado ? 'badge-green' : 'badge-warn'}`}>
                  {aprovado ? 'Simulado aprovado' : 'Simulado encerrado'}
                </span>
                <h2 className="student-card-title">
                  {aprovado ? 'Voce atingiu a nota minima' : 'Voce ainda nao atingiu a nota minima'}
                </h2>
                <p className="student-card-copy">
                  Voce respondeu {questoesRespondidas} questoes e acertou {corretasSessao}. Agora voce pode refazer esta
                  prova, gerar uma nova rodada ou voltar para a escolha de simulados.
                </p>

                <div className={`simulado-result-card ${aprovado ? 'is-pass' : 'is-fail'}`}>
                  <div className="simulado-result-seal">{aprovado ? 'Treino de aprovacao' : 'Hora de revisar'}</div>
                  <div className="simulado-result-copy">
                    {aprovado
                      ? `Voce fez ${corretasSessao} acertos e ultrapassou a meta minima de ${ACERTOS_MINIMOS}.`
                      : `Voce fez ${corretasSessao} acertos e precisava de ${ACERTOS_MINIMOS} para passar.`}
                    {motivoEncerramento === 'tempo' && !aprovado
                      ? ' O tempo de prova terminou antes de voce concluir a rodada.'
                      : ''}
                  </div>
                </div>

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
                    <div className="player-meta-label">Modo</div>
                    <div className="player-meta-value">Simulado pratico</div>
                  </div>
                  <div className="player-meta-card">
                    <div className="player-meta-label">Minimo para passar</div>
                    <div className="player-meta-value">{ACERTOS_MINIMOS}</div>
                  </div>
                  <div className="player-meta-card">
                    <div className="player-meta-label">Nao respondidas</div>
                    <div className="player-meta-value">{questoesNaoRespondidas}</div>
                  </div>
                </div>

                {!aprovado && (
                  <div className="simulado-review-list">
                    <div className="player-side-title">Situacoes para revisar</div>
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
                  <button type="button" className="btn btn-primary" onClick={gerarNovoSimulado}>
                    Gerar novo simulado
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={reiniciarSimulado}>
                    Refazer este simulado
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate('/simulado')}>
                    Voltar para simulados
                  </button>
                </div>
              </div>
            ) : !simuladoIniciado ? (
              <div className="simulado-intro-card">
                <span className="badge badge-blue">Modo prova</span>
                <h2 className="student-card-title">Simulado pratico</h2>
                <p className="student-card-copy">
                  Esta rodada reune cenarios de baliza, controle do veiculo, faltas eliminatorias e conduta de prova.
                  Sao 20 questoes, 25 minutos e minimo de 14 acertos para passar.
                </p>
                <div className="simulado-intro-grid">
                  <div className="simulado-intro-rule">
                    <span className="simulado-intro-label">Tempo</span>
                    <strong>25 minutos</strong>
                  </div>
                  <div className="simulado-intro-rule">
                    <span className="simulado-intro-label">Meta</span>
                    <strong>14 acertos</strong>
                  </div>
                  <div className="simulado-intro-rule">
                    <span className="simulado-intro-label">Formato</span>
                    <strong>20 questoes</strong>
                  </div>
                </div>
                <div className="student-help-steps">
                  <div className="student-help-step">1. Baliza e controle do veiculo entram com mais peso nesta rodada.</div>
                  <div className="student-help-step">2. Falta eliminatoria e conduta de prova ajudam a revisar o que reprova mais rapido.</div>
                  <div className="student-help-step">3. Use o resultado para mapear onde sua leitura pratica ainda falha.</div>
                </div>
                <div className="student-card-actions">
                  <button type="button" className="btn btn-primary" onClick={() => setSimuladoIniciado(true)}>
                    Iniciar prova agora
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate('/simulado')}>
                    Voltar para simulados
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="student-card-top">
                  <div>
                    <span className="badge badge-blue">Simulado pratico</span>
                    <h2 className="student-card-title simulado-question-title">
                      Questao {indiceAtual + 1} de {totalQuestoes}
                    </h2>
                    <div className="simulado-question-meta">Tema da questao: {questaoAtual?.temaLabel || '-'}</div>
                  </div>
                  <span className="badge badge-gray">{questaoAtual?.dificuldadeLabel}</span>
                </div>

                <div className="simulado-question-scroll">
                  <div className="simulado-exam-strip">
                    <div className="simulado-exam-pill">
                      <span className="simulado-exam-pill-label">Tempo restante</span>
                      <strong>{tempoRestanteFormatado}</strong>
                    </div>
                    <div className="simulado-exam-pill">
                      <span className="simulado-exam-pill-label">Minimo para passar</span>
                      <strong>{ACERTOS_MINIMOS} acertos</strong>
                    </div>
                    <div className="simulado-exam-pill">
                      <span className="simulado-exam-pill-label">Prova</span>
                      <strong>25 minutos</strong>
                    </div>
                  </div>

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
                      <span className="student-inline-note">Progresso na prova</span>
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
                          className={`simulado-option ${alternativaSelecionadaId === alternativa.id ? 'is-selected' : ''}`}
                          onClick={() => setAlternativaSelecionadaId(alternativa.id)}
                          disabled={enviando}
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
                  </div>
                </div>

                <div className="simulado-action-row">
                  <button type="button" className="btn btn-primary" onClick={responderQuestao} disabled={enviando}>
                    {enviando ? 'Enviando...' : 'Responder'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={reiniciarSimulado}>
                    Reiniciar prova
                  </button>
                </div>
              </>
            )}
          </section>
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
