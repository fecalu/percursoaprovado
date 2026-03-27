import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  cloneLocalPageConfig,
  createEmptyLocalPageConfig,
  interpolateSiteText,
  LOCAL_PAGE_DEFAULTS,
  resolveLocalPageConfig,
} from '../data/sitePageDefaults'
import { useToast } from '../hooks/useToast'
import { configuracaoSiteService } from '../services/api'

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

function buildSaibaMaisPayload(itens) {
  return (Array.isArray(itens) ? itens : [])
    .map(item => ({
      titulo: String(item?.titulo || '').trim(),
      copy: String(item?.copy || '').trim(),
      pontos: String(item?.pontosTexto || '')
        .split('\n')
        .map(ponto => ponto.trim())
        .filter(Boolean),
    }))
    .filter(item => item.titulo && (item.copy || item.pontos.length > 0))
}

function buildPayload(form) {
  return {
    heroFallbackTitulo: form.heroFallbackTitulo.trim(),
    heroFallbackSubtituloDisponivel: form.heroFallbackSubtituloDisponivel.trim(),
    heroFallbackSubtituloIndisponivel: form.heroFallbackSubtituloIndisponivel.trim(),
    secaoPlanosTitulo: form.secaoPlanosTitulo.trim(),
    secaoPlanosSubtitulo: form.secaoPlanosSubtitulo.trim(),
    secaoPlanosFaixa1: form.secaoPlanosFaixa1.trim(),
    secaoPlanosFaixa2: form.secaoPlanosFaixa2.trim(),
    secaoPlanosFaixa3: form.secaoPlanosFaixa3.trim(),
    boxFallbackTitulo: form.boxFallbackTitulo.trim(),
    boxFallbackItem1: form.boxFallbackItem1.trim(),
    boxFallbackItem2: form.boxFallbackItem2.trim(),
    boxFallbackItem3: form.boxFallbackItem3.trim(),
    boxFallbackObservacao: form.boxFallbackObservacao.trim(),
    saibaMaisTitulo: form.saibaMaisTitulo.trim(),
    saibaMaisSubtitulo: form.saibaMaisSubtitulo.trim(),
    saibaMaisItens: buildSaibaMaisPayload(form.saibaMaisItens),
  }
}

function createFormState(config = {}) {
  const base = cloneLocalPageConfig(config)

  return {
    ...base,
    saibaMaisItens: Array.isArray(base.saibaMaisItens)
      ? base.saibaMaisItens.map(item => ({
        titulo: item.titulo || '',
        copy: item.copy || '',
        pontosTexto: Array.isArray(item.pontos) ? item.pontos.join('\n') : '',
      }))
      : [],
  }
}

export default function AdminPaginaLocal() {
  const [form, setForm] = useState(createFormState())
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState(null)
  const { show, ToastEl } = useToast()

  useEffect(() => {
    let ativo = true

    configuracaoSiteService.buscarAdmin()
      .then(response => {
        if (!ativo) return
        setForm(createFormState(response?.localPage))
        setAtualizadoEm(response?.atualizadoEm || null)
      })
      .catch(error => {
        if (!ativo) return
        show(error.response?.data?.erro || 'Nao foi possivel carregar a configuracao da pagina do local.', 'error')
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [show])

  const preview = useMemo(() => resolveLocalPageConfig(form), [form])
  const previewContext = useMemo(() => ({
    local: 'Cohatrac / Cohab',
    cidade: 'Sao Luis',
    descricao: 'Conteudo pratico organizado para esse local.',
    mensagem: 'As vendas desse local estao temporariamente pausadas.',
  }), [])

  function atualizarCampo(field, value) {
    setForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  function adicionarSaibaMais() {
    setForm(current => ({
      ...current,
      saibaMaisItens: [...current.saibaMaisItens, { titulo: '', copy: '', pontosTexto: '' }],
    }))
  }

  function atualizarSaibaMais(index, field, value) {
    setForm(current => ({
      ...current,
      saibaMaisItens: current.saibaMaisItens.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )),
    }))
  }

  function removerSaibaMais(index) {
    setForm(current => ({
      ...current,
      saibaMaisItens: current.saibaMaisItens.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function copiarPadraoAtual() {
    setForm(createFormState(LOCAL_PAGE_DEFAULTS))
    show('Os textos padrao atuais da pagina do local foram copiados para o formulario.')
  }

  function restaurarFallback() {
    setForm(createFormState())
    show('Os campos foram limpos. Se salvar assim, a pagina volta a usar os fallbacks do codigo.')
  }

  async function salvar(event) {
    event.preventDefault()
    setSalvando(true)

    try {
      const response = await configuracaoSiteService.atualizarLocalPage(buildPayload(form))
      setForm(createFormState(response?.localPage))
      setAtualizadoEm(response?.atualizadoEm || null)
      show('Configuracao da pagina do local salva com sucesso.')
    } catch (error) {
      show(error.response?.data?.erro || 'Nao foi possivel salvar a configuracao da pagina do local.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Paginas - Pagina do local</div>
      <p className="page-sub">
        Controle os textos base da pagina do local sem mexer no dado proprio de cada local ou na copy comercial de cada plano.
      </p>

      <div className="admin-grid admin-grid--planos">
        <div className="card">
          <div className="section-heading">Configuracao da pagina do local</div>
          <div className="admin-inline-note" style={{ marginTop: '0.55rem' }}>
            Campos vazios continuam usando o fallback do codigo. O local ainda pode sobrescrever partes especificas.
          </div>

          {loading ? (
            <div className="spinner" />
          ) : (
            <form onSubmit={salvar} style={{ marginTop: '1rem' }}>
              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Hero padrao</div>
                    <div className="section-copy">
                      Esses textos entram quando o local nao tem titulo ou subtitulo comercial proprio.
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo fallback</label>
                  <input
                    className="form-input"
                    value={form.heroFallbackTitulo}
                    onChange={event => atualizarCampo('heroFallbackTitulo', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.heroFallbackTitulo}
                  />
                  <div className="mini-copy">Variaveis: {'{local}'}, {'{cidade}'}, {'{descricao}'}, {'{mensagem}'}</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Subtitulo fallback quando o local esta disponivel</label>
                  <textarea
                    className="form-textarea"
                    value={form.heroFallbackSubtituloDisponivel}
                    onChange={event => atualizarCampo('heroFallbackSubtituloDisponivel', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.heroFallbackSubtituloDisponivel}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Subtitulo fallback quando a compra estiver bloqueada</label>
                  <textarea
                    className="form-textarea"
                    value={form.heroFallbackSubtituloIndisponivel}
                    onChange={event => atualizarCampo('heroFallbackSubtituloIndisponivel', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.heroFallbackSubtituloIndisponivel}
                  />
                </div>
              </div>

              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Secao de planos</div>
                    <div className="section-copy">
                      Titulo, subtitulo e faixa de apoio usados no bloco principal de escolha dos planos.
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo da secao</label>
                  <input
                    className="form-input"
                    value={form.secaoPlanosTitulo}
                    onChange={event => atualizarCampo('secaoPlanosTitulo', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.secaoPlanosTitulo}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subtitulo da secao</label>
                  <textarea
                    className="form-textarea"
                    value={form.secaoPlanosSubtitulo}
                    onChange={event => atualizarCampo('secaoPlanosSubtitulo', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.secaoPlanosSubtitulo}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Faixa 1</label>
                    <input
                      className="form-input"
                      value={form.secaoPlanosFaixa1}
                      onChange={event => atualizarCampo('secaoPlanosFaixa1', event.target.value)}
                      placeholder={LOCAL_PAGE_DEFAULTS.secaoPlanosFaixa1}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Faixa 2</label>
                    <input
                      className="form-input"
                      value={form.secaoPlanosFaixa2}
                      onChange={event => atualizarCampo('secaoPlanosFaixa2', event.target.value)}
                      placeholder={LOCAL_PAGE_DEFAULTS.secaoPlanosFaixa2}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Faixa 3</label>
                  <input
                    className="form-input"
                    value={form.secaoPlanosFaixa3}
                    onChange={event => atualizarCampo('secaoPlanosFaixa3', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.secaoPlanosFaixa3}
                  />
                </div>
              </div>

              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Caixa lateral fallback</div>
                    <div className="section-copy">
                      Essa caixa so entra quando o local nao tiver uma caixa propria cadastrada.
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo</label>
                  <input
                    className="form-input"
                    value={form.boxFallbackTitulo}
                    onChange={event => atualizarCampo('boxFallbackTitulo', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.boxFallbackTitulo}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Item 1</label>
                    <input
                      className="form-input"
                      value={form.boxFallbackItem1}
                      onChange={event => atualizarCampo('boxFallbackItem1', event.target.value)}
                      placeholder={LOCAL_PAGE_DEFAULTS.boxFallbackItem1}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Item 2</label>
                    <input
                      className="form-input"
                      value={form.boxFallbackItem2}
                      onChange={event => atualizarCampo('boxFallbackItem2', event.target.value)}
                      placeholder={LOCAL_PAGE_DEFAULTS.boxFallbackItem2}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Item 3</label>
                  <input
                    className="form-input"
                    value={form.boxFallbackItem3}
                    onChange={event => atualizarCampo('boxFallbackItem3', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.boxFallbackItem3}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Observacao</label>
                  <textarea
                    className="form-textarea"
                    value={form.boxFallbackObservacao}
                    onChange={event => atualizarCampo('boxFallbackObservacao', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.boxFallbackObservacao}
                  />
                </div>
              </div>

              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Saiba mais</div>
                    <div className="section-copy">
                      Esses blocos de apoio aparecem abaixo da escolha dos planos.
                    </div>
                  </div>
                  <button className="btn btn-ghost" type="button" onClick={adicionarSaibaMais}>
                    Adicionar bloco
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo da secao</label>
                  <input
                    className="form-input"
                    value={form.saibaMaisTitulo}
                    onChange={event => atualizarCampo('saibaMaisTitulo', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.saibaMaisTitulo}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subtitulo da secao</label>
                  <textarea
                    className="form-textarea"
                    value={form.saibaMaisSubtitulo}
                    onChange={event => atualizarCampo('saibaMaisSubtitulo', event.target.value)}
                    placeholder={LOCAL_PAGE_DEFAULTS.saibaMaisSubtitulo}
                  />
                </div>

                <div className="page-config-faq-list">
                  {form.saibaMaisItens.length === 0 && (
                    <div className="mini-copy">Nenhum bloco personalizado ainda.</div>
                  )}

                  {form.saibaMaisItens.map((item, index) => (
                    <div key={`${index}-${item.titulo}`} className="page-config-faq-item">
                      <div className="page-config-faq-head">
                        <div className="section-heading" style={{ fontSize: 16 }}>
                          Bloco {index + 1}
                        </div>
                        <button className="btn btn-danger" type="button" onClick={() => removerSaibaMais(index)}>
                          Remover
                        </button>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Titulo</label>
                        <input
                          className="form-input"
                          value={item.titulo}
                          onChange={event => atualizarSaibaMais(index, 'titulo', event.target.value)}
                          placeholder="Ex.: O que voce vai encontrar"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Texto</label>
                        <textarea
                          className="form-textarea"
                          value={item.copy}
                          onChange={event => atualizarSaibaMais(index, 'copy', event.target.value)}
                          placeholder="Texto principal desse bloco."
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Pontos (1 por linha)</label>
                        <textarea
                          className="form-textarea"
                          value={item.pontosTexto}
                          onChange={event => atualizarSaibaMais(index, 'pontosTexto', event.target.value)}
                          placeholder="Primeiro ponto&#10;Segundo ponto&#10;Terceiro ponto"
                        />
                      </div>
                    </div>
                  ))}
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
            <div className="page-config-preview-badge">Preparacao por local de prova</div>
            <div className="page-config-preview-title">
              {interpolateSiteText(preview.heroFallbackTitulo, previewContext)}
            </div>
            <div className="page-config-preview-copy">
              {interpolateSiteText(preview.heroFallbackSubtituloDisponivel, previewContext)}
            </div>

            <div className="page-config-preview-section">
              <div className="page-config-preview-section-title">{preview.secaoPlanosTitulo}</div>
              <div className="page-config-preview-copy">{preview.secaoPlanosSubtitulo}</div>
              <div className="page-config-preview-actions">
                {[preview.secaoPlanosFaixa1, preview.secaoPlanosFaixa2, preview.secaoPlanosFaixa3]
                  .filter(Boolean)
                  .map(item => (
                    <span key={item} className="btn btn-ghost btn-sm">{item}</span>
                  ))}
              </div>
            </div>

            <div className="page-config-preview-section">
              <div className="page-config-preview-section-title">{preview.boxFallbackTitulo}</div>
              <div className="page-config-preview-faq-list">
                {[preview.boxFallbackItem1, preview.boxFallbackItem2, preview.boxFallbackItem3]
                  .filter(Boolean)
                  .map(item => (
                    <div key={item} className="page-config-preview-faq-item">
                      <strong>{item}</strong>
                    </div>
                  ))}
              </div>
              {preview.boxFallbackObservacao && (
                <div className="page-config-preview-copy">{preview.boxFallbackObservacao}</div>
              )}
            </div>

            <div className="page-config-preview-section">
              <div className="page-config-preview-section-title">{preview.saibaMaisTitulo}</div>
              <div className="page-config-preview-copy">{preview.saibaMaisSubtitulo}</div>
              <div className="page-config-preview-faq-list">
                {preview.saibaMaisItens.slice(0, 3).map(item => (
                  <div key={item.titulo} className="page-config-preview-faq-item">
                    <strong>{item.titulo}</strong>
                    {item.copy && <span>{item.copy}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="checkout-admin-block">
            <div className="section-heading" style={{ fontSize: 18 }}>O que continua fora daqui</div>
            <div className="mini-copy" style={{ marginTop: '0.55rem' }}>
              O local continua controlando imagem principal, caixa lateral propria, titulo/subtitulo especificos e status comercial. O plano continua controlando selo, resumo, texto e destaque da vitrine.
            </div>
            <div className="admin-inline-actions" style={{ marginTop: '1rem' }}>
              <Link className="btn btn-ghost btn-sm" to="/admin/locais">
                Abrir locais
              </Link>
              <Link className="btn btn-ghost btn-sm" to="/admin/planos">
                Abrir planos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
