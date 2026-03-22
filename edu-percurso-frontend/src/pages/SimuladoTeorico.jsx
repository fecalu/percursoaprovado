import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { questaoService } from '../services/api'

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

export default function SimuladoTeorico() {
  const navigate = useNavigate()
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
    if (!temaAtivo) {
      setQuestoes([])
      setIndiceAtual(0)
      return
    }

    let ativo = true
    setLoadingQuestoes(true)
    setErro('')
    setIndiceAtual(0)
    setAlternativaSelecionadaId('')
    setRespostaAtual(null)
    setRespostasSessao({})
    setVideoAberto(false)
    setImagemExpandida(null)

    questaoService.listarTreinoAluno({ tema: temaAtivo })
      .then(response => {
        if (!ativo) return
        setQuestoes(response)
      })
      .catch(error => {
        if (!ativo) return
        setErro(error.response?.data?.erro || 'Nao foi possivel carregar as questoes desse tema.')
        setQuestoes([])
      })
      .finally(() => {
        if (ativo) setLoadingQuestoes(false)
      })

    return () => {
      ativo = false
    }
  }, [temaAtivo])

  const temaAtual = useMemo(
    () => temas.find(item => item.tema === temaAtivo) || null,
    [temas, temaAtivo]
  )

  const totalQuestoes = questoes.length
  const corretasSessao = Object.values(respostasSessao).filter(item => item.correta).length
  const questoesRespondidas = Object.keys(respostasSessao).length
  const treinoConcluido = totalQuestoes > 0 && indiceAtual >= totalQuestoes
  const questaoAtual = treinoConcluido ? null : questoes[indiceAtual]
  const progressoPercentual = totalQuestoes ? Math.round((questoesRespondidas / totalQuestoes) * 100) : 0
  const embedUrl = getEmbedUrl(respostaAtual?.videoUrl)

  function reiniciarTema() {
    setIndiceAtual(0)
    setAlternativaSelecionadaId('')
    setRespostaAtual(null)
    setRespostasSessao({})
    setVideoAberto(false)
    setImagemExpandida(null)
    setErro('')
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

      setRespostaAtual(response)
      setRespostasSessao(prev => ({
        ...prev,
        [questaoAtual.id]: response,
      }))
      setVideoAberto(false)
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
          <button type="button" className="simulado-mode-pill is-active">
            Treinar por tema
          </button>
          <button type="button" className="simulado-mode-pill" disabled>
            Simulado completo
            <span className="simulado-mode-pill-note">Em breve</span>
          </button>
          <button type="button" className="simulado-mode-pill" disabled>
            Revisar erros
            <span className="simulado-mode-pill-note">Em breve</span>
          </button>
        </div>

        {temas.length > 0 && (
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
      ) : !questaoAtual && !treinoConcluido ? (
        <div className="empty-state">
          <div className="empty-state-icon">!</div>
          Nenhuma questao publicada para esse tema no momento.
        </div>
      ) : (
        <div className="simulado-layout">
          <section className="student-card simulado-question-card">
            {treinoConcluido ? (
              <div className="simulado-finish-card">
                <span className="badge badge-green">Tema concluido</span>
                <h2 className="student-card-title">Treino finalizado em {temaAtual?.temaLabel || 'simulado teorico'}</h2>
                <p className="student-card-copy">
                  Voce respondeu {questoesRespondidas} questoes e acertou {corretasSessao}. Agora voce pode repetir esse tema
                  ou voltar para a biblioteca.
                </p>
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
                    <div className="player-meta-label">Tema</div>
                    <div className="player-meta-value">{temaAtual?.temaLabel || '-'}</div>
                  </div>
                </div>
                <div className="student-card-actions">
                  <button type="button" className="btn btn-primary" onClick={reiniciarTema}>
                    Refazer tema
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate('/biblioteca')}>
                    Voltar para a biblioteca
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="student-card-top">
                  <div>
                    <span className="badge badge-blue">{temaAtual?.temaLabel || 'Tema'}</span>
                    <h2 className="student-card-title simulado-question-title">
                      Questao {indiceAtual + 1} de {totalQuestoes}
                    </h2>
                  </div>
                  <span className="badge badge-gray">{questaoAtual?.dificuldadeLabel}</span>
                </div>

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

                <div className="simulado-progress-head">
                  <span className="student-inline-note">Progresso no tema</span>
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

                {respostaAtual && (
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

                <div className="simulado-action-row">
                  {!respostaAtual ? (
                    <button type="button" className="btn btn-primary" onClick={responderQuestao} disabled={enviando}>
                      {enviando ? 'Corrigindo...' : 'Responder'}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={proximaQuestao}>
                      {indiceAtual + 1 >= totalQuestoes ? 'Finalizar tema' : 'Proxima questao'}
                    </button>
                  )}

                  <button type="button" className="btn btn-ghost" onClick={reiniciarTema}>
                    Reiniciar tema
                  </button>
                </div>
              </>
            )}
          </section>

          <aside className="player-side-card simulado-explainer-card">
            <div className="player-side-title">Explicacao da questao</div>
            {!respostaAtual ? (
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
                <div className="player-meta-label">Tema atual</div>
                <div className="player-meta-value">{temaAtual?.temaLabel || '-'}</div>
              </div>
              <div className="player-meta-card">
                <div className="player-meta-label">Respondidas</div>
                <div className="player-meta-value">{questoesRespondidas}</div>
              </div>
              <div className="player-meta-card">
                <div className="player-meta-label">Acertos</div>
                <div className="player-meta-value">{corretasSessao}</div>
              </div>
            </div>
          </aside>
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
