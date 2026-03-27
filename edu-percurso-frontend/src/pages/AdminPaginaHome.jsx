import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  cloneHomePageConfig,
  createEmptyHomePageConfig,
  HOME_PAGE_DEFAULTS,
  resolveHomePageConfig,
} from '../data/sitePageDefaults'
import { useToast } from '../hooks/useToast'
import { configuracaoSiteService } from '../services/api'

function buildFaqPayload(faqItens) {
  return (Array.isArray(faqItens) ? faqItens : [])
    .map(item => ({
      pergunta: String(item?.pergunta || '').trim(),
      resposta: String(item?.resposta || '').trim(),
    }))
    .filter(item => item.pergunta && item.resposta)
}

function buildPayload(form) {
  return {
    heroKicker: form.heroKicker.trim(),
    heroTitulo: form.heroTitulo.trim(),
    heroSubtitulo: form.heroSubtitulo.trim(),
    heroBotaoPrimarioTexto: form.heroBotaoPrimarioTexto.trim(),
    heroBotaoSecundarioTexto: form.heroBotaoSecundarioTexto.trim(),
    heroVideoUrl: form.heroVideoUrl.trim(),
    heroVideoTitulo: form.heroVideoTitulo.trim(),
    secaoLocaisTitulo: form.secaoLocaisTitulo.trim(),
    secaoLocaisSubtitulo: form.secaoLocaisSubtitulo.trim(),
    faqTitulo: form.faqTitulo.trim(),
    faqSubtitulo: form.faqSubtitulo.trim(),
    faqItens: buildFaqPayload(form.faqItens),
    ctaFinalKicker: form.ctaFinalKicker.trim(),
    ctaFinalTitulo: form.ctaFinalTitulo.trim(),
    ctaFinalTexto: form.ctaFinalTexto.trim(),
    ctaFinalBotaoPrimarioTexto: form.ctaFinalBotaoPrimarioTexto.trim(),
    ctaFinalBotaoSecundarioTexto: form.ctaFinalBotaoSecundarioTexto.trim(),
  }
}

function formatarDataAtualizacao(value) {
  if (!value) return 'Ainda sem publicacao personalizada.'

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Configuracao carregada.'
  }
}

export default function AdminPaginaHome() {
  const [form, setForm] = useState(createEmptyHomePageConfig())
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState(null)
  const { show, ToastEl } = useToast()

  useEffect(() => {
    let ativo = true

    configuracaoSiteService.buscarAdmin()
      .then(response => {
        if (!ativo) return
        setForm(cloneHomePageConfig(response?.home))
        setAtualizadoEm(response?.atualizadoEm || null)
      })
      .catch(error => {
        if (!ativo) return
        show(error.response?.data?.erro || 'Nao foi possivel carregar a configuracao da home.', 'error')
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [show])

  const preview = useMemo(() => resolveHomePageConfig(form), [form])

  function atualizarCampo(field, value) {
    setForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  function adicionarFaq() {
    setForm(current => ({
      ...current,
      faqItens: [...current.faqItens, { pergunta: '', resposta: '' }],
    }))
  }

  function atualizarFaq(index, field, value) {
    setForm(current => ({
      ...current,
      faqItens: current.faqItens.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )),
    }))
  }

  function removerFaq(index) {
    setForm(current => ({
      ...current,
      faqItens: current.faqItens.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function copiarPadraoAtual() {
    setForm(cloneHomePageConfig(HOME_PAGE_DEFAULTS))
    show('Os textos padrao atuais foram copiados para o formulario.')
  }

  function restaurarFallback() {
    setForm(createEmptyHomePageConfig())
    show('Os campos foram limpos. Se salvar assim, a home volta a usar os fallbacks do codigo.')
  }

  async function salvar(event) {
    event.preventDefault()
    setSalvando(true)

    try {
      const response = await configuracaoSiteService.atualizarHome(buildPayload(form))
      setForm(cloneHomePageConfig(response?.home))
      setAtualizadoEm(response?.atualizadoEm || null)
      show('Configuracao da home salva com sucesso.')
    } catch (error) {
      show(error.response?.data?.erro || 'Nao foi possivel salvar a configuracao da home.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Paginas - Home</div>
      <p className="page-sub">
        Edite os textos estruturais da home publica sem espalhar copy entre locais, planos e codigo.
      </p>

      <div className="admin-grid admin-grid--planos">
        <div className="card">
          <div className="section-heading">Configuracao da Home</div>
          <div className="admin-inline-note" style={{ marginTop: '0.55rem' }}>
            Preencha apenas o que quiser personalizar. Campo vazio = fallback do codigo.
          </div>

          {loading ? (
            <div className="spinner" />
          ) : (
            <form onSubmit={salvar} style={{ marginTop: '1rem' }}>
              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Hero</div>
                    <div className="section-copy">
                      Essa e a dobra principal da home, com promessa, CTA e opcionalmente um video de demonstracao.
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Kicker</label>
                  <input
                    className="form-input"
                    value={form.heroKicker}
                    onChange={event => atualizarCampo('heroKicker', event.target.value)}
                    placeholder={HOME_PAGE_DEFAULTS.heroKicker}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo principal</label>
                  <textarea
                    className="form-textarea"
                    value={form.heroTitulo}
                    onChange={event => atualizarCampo('heroTitulo', event.target.value)}
                    placeholder={HOME_PAGE_DEFAULTS.heroTitulo}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subtitulo</label>
                  <textarea
                    className="form-textarea"
                    value={form.heroSubtitulo}
                    onChange={event => atualizarCampo('heroSubtitulo', event.target.value)}
                    placeholder={HOME_PAGE_DEFAULTS.heroSubtitulo}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Texto do botao principal</label>
                    <input
                      className="form-input"
                      value={form.heroBotaoPrimarioTexto}
                      onChange={event => atualizarCampo('heroBotaoPrimarioTexto', event.target.value)}
                      placeholder={HOME_PAGE_DEFAULTS.heroBotaoPrimarioTexto}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Texto do botao secundario</label>
                    <input
                      className="form-input"
                      value={form.heroBotaoSecundarioTexto}
                      onChange={event => atualizarCampo('heroBotaoSecundarioTexto', event.target.value)}
                      placeholder={HOME_PAGE_DEFAULTS.heroBotaoSecundarioTexto}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">URL do video de demonstracao</label>
                    <input
                      className="form-input"
                      value={form.heroVideoUrl}
                      onChange={event => atualizarCampo('heroVideoUrl', event.target.value)}
                      placeholder="https://..."
                    />
                    <div className="mini-copy">
                      Se preencher, o botao secundario abre o video em nova guia. Se deixar vazio, ele leva para a secao de duvidas.
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Titulo interno do video</label>
                    <input
                      className="form-input"
                      value={form.heroVideoTitulo}
                      onChange={event => atualizarCampo('heroVideoTitulo', event.target.value)}
                      placeholder={HOME_PAGE_DEFAULTS.heroVideoTitulo}
                    />
                  </div>
                </div>
              </div>

              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Secao de locais</div>
                    <div className="section-copy">
                      Esses textos introduzem a vitrine de locais publicada na home.
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo da secao</label>
                  <input
                    className="form-input"
                    value={form.secaoLocaisTitulo}
                    onChange={event => atualizarCampo('secaoLocaisTitulo', event.target.value)}
                    placeholder={HOME_PAGE_DEFAULTS.secaoLocaisTitulo}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Subtitulo da secao</label>
                  <textarea
                    className="form-textarea"
                    value={form.secaoLocaisSubtitulo}
                    onChange={event => atualizarCampo('secaoLocaisSubtitulo', event.target.value)}
                    placeholder={HOME_PAGE_DEFAULTS.secaoLocaisSubtitulo}
                  />
                </div>
              </div>

              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>FAQ</div>
                    <div className="section-copy">
                      Duvidas comuns da home. Se nao cadastrar nenhuma pergunta, a pagina usa o fallback atual.
                    </div>
                  </div>
                  <button className="btn btn-ghost" type="button" onClick={adicionarFaq}>
                    Adicionar pergunta
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo da secao</label>
                  <input
                    className="form-input"
                    value={form.faqTitulo}
                    onChange={event => atualizarCampo('faqTitulo', event.target.value)}
                    placeholder={HOME_PAGE_DEFAULTS.faqTitulo}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subtitulo da secao</label>
                  <textarea
                    className="form-textarea"
                    value={form.faqSubtitulo}
                    onChange={event => atualizarCampo('faqSubtitulo', event.target.value)}
                    placeholder={HOME_PAGE_DEFAULTS.faqSubtitulo}
                  />
                </div>

                <div className="page-config-faq-list">
                  {form.faqItens.length === 0 && (
                    <div className="mini-copy">Nenhuma pergunta personalizada ainda.</div>
                  )}

                  {form.faqItens.map((item, index) => (
                    <div key={`${index}-${item.pergunta}`} className="page-config-faq-item">
                      <div className="page-config-faq-head">
                        <div className="section-heading" style={{ fontSize: 16 }}>
                          Pergunta {index + 1}
                        </div>
                        <button className="btn btn-danger" type="button" onClick={() => removerFaq(index)}>
                          Remover
                        </button>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Pergunta</label>
                        <input
                          className="form-input"
                          value={item.pergunta}
                          onChange={event => atualizarFaq(index, 'pergunta', event.target.value)}
                          placeholder="Ex.: Isso garante o trajeto exato da minha prova?"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Resposta</label>
                        <textarea
                          className="form-textarea"
                          value={item.resposta}
                          onChange={event => atualizarFaq(index, 'resposta', event.target.value)}
                          placeholder="Explique essa resposta de forma curta e objetiva."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>CTA final</div>
                    <div className="section-copy">
                      Ultimo bloco da home, usado para reforcar a conversao no fim da pagina.
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Kicker</label>
                  <input
                    className="form-input"
                    value={form.ctaFinalKicker}
                    onChange={event => atualizarCampo('ctaFinalKicker', event.target.value)}
                    placeholder={HOME_PAGE_DEFAULTS.ctaFinalKicker}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo</label>
                  <textarea
                    className="form-textarea"
                    value={form.ctaFinalTitulo}
                    onChange={event => atualizarCampo('ctaFinalTitulo', event.target.value)}
                    placeholder={HOME_PAGE_DEFAULTS.ctaFinalTitulo}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Texto de apoio</label>
                  <textarea
                    className="form-textarea"
                    value={form.ctaFinalTexto}
                    onChange={event => atualizarCampo('ctaFinalTexto', event.target.value)}
                    placeholder={HOME_PAGE_DEFAULTS.ctaFinalTexto}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Botao principal</label>
                    <input
                      className="form-input"
                      value={form.ctaFinalBotaoPrimarioTexto}
                      onChange={event => atualizarCampo('ctaFinalBotaoPrimarioTexto', event.target.value)}
                      placeholder={HOME_PAGE_DEFAULTS.ctaFinalBotaoPrimarioTexto}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Botao secundario</label>
                    <input
                      className="form-input"
                      value={form.ctaFinalBotaoSecundarioTexto}
                      onChange={event => atualizarCampo('ctaFinalBotaoSecundarioTexto', event.target.value)}
                      placeholder={HOME_PAGE_DEFAULTS.ctaFinalBotaoSecundarioTexto}
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar configuracao'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={copiarPadraoAtual}>
                  Copiar padrao atual
                </button>
                <button className="btn btn-ghost" type="button" onClick={restaurarFallback}>
                  Restaurar fallback
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <div className="section-heading">Preview e regras</div>
          <div className="mini-copy" style={{ marginTop: '0.45rem' }}>
            Ultima atualizacao: {formatarDataAtualizacao(atualizadoEm)}
          </div>

          <div className="page-config-preview">
            <div className="page-config-preview-badge">{preview.heroKicker}</div>
            <div className="page-config-preview-title">{preview.heroTitulo}</div>
            <div className="page-config-preview-copy">{preview.heroSubtitulo}</div>

            <div className="page-config-preview-actions">
              <span className="btn btn-primary btn-sm">{preview.heroBotaoPrimarioTexto}</span>
              <span className="btn btn-ghost btn-sm">{preview.heroBotaoSecundarioTexto}</span>
            </div>

            <div className="page-config-preview-section">
              <div className="page-config-preview-section-title">{preview.secaoLocaisTitulo}</div>
              <div className="page-config-preview-copy">{preview.secaoLocaisSubtitulo}</div>
            </div>

            <div className="page-config-preview-section">
              <div className="page-config-preview-section-title">{preview.faqTitulo}</div>
              <div className="page-config-preview-copy">{preview.faqSubtitulo}</div>
              <div className="page-config-preview-faq-list">
                {preview.faqItens.slice(0, 3).map(item => (
                  <div key={item.pergunta} className="page-config-preview-faq-item">
                    <strong>{item.pergunta}</strong>
                    <span>{item.resposta}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="page-config-preview-section">
              <div className="page-config-preview-kicker">{preview.ctaFinalKicker}</div>
              <div className="page-config-preview-section-title">{preview.ctaFinalTitulo}</div>
              <div className="page-config-preview-copy">{preview.ctaFinalTexto}</div>
              <div className="page-config-preview-actions">
                <span className="btn btn-primary btn-sm">{preview.ctaFinalBotaoPrimarioTexto}</span>
                <span className="btn btn-ghost btn-sm">{preview.ctaFinalBotaoSecundarioTexto}</span>
              </div>
            </div>
          </div>

          <div className="checkout-admin-block">
            <div className="section-heading" style={{ fontSize: 18 }}>O que continua fora daqui</div>
            <div className="mini-copy" style={{ marginTop: '0.55rem' }}>
              Locais continuam controlando nome, cidade, imagens e textos especificos de cada card. Planos continuam controlando vitrine e checkout por plano.
            </div>
            <div className="admin-inline-actions" style={{ marginTop: '1rem' }}>
              <Link className="btn btn-ghost btn-sm" to="/">
                Ver home publicada
              </Link>
              <Link className="btn btn-ghost btn-sm" to="/admin/locais">
                Abrir locais
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
