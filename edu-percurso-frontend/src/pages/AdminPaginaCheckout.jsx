import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CHECKOUT_PAGE_DEFAULTS,
  cloneCheckoutPageConfig,
  createEmptyCheckoutPageConfig,
  interpolateSiteText,
  resolveCheckoutPageConfig,
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

function listToText(items) {
  return Array.isArray(items) ? items.join('\n') : ''
}

function buildPayload(form) {
  return {
    kickerPadrao: form.kickerPadrao.trim(),
    tituloPadrao: form.tituloPadrao.trim(),
    subtituloPadrao: form.subtituloPadrao.trim(),
    beneficiosTituloPadrao: form.beneficiosTituloPadrao.trim(),
    beneficiosListaPadrao: String(form.beneficiosListaPadraoTexto || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean),
    ajudaTituloPadrao: form.ajudaTituloPadrao.trim(),
    ajudaTextoPadrao: form.ajudaTextoPadrao.trim(),
    confiancaListaPadrao: String(form.confiancaListaPadraoTexto || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean),
    resumoKickerPadrao: form.resumoKickerPadrao.trim(),
    resumoTextoPadrao: form.resumoTextoPadrao.trim(),
    precoLabelPadrao: form.precoLabelPadrao.trim(),
    precoTextoPadrao: form.precoTextoPadrao.trim(),
    seguroTextoPadrao: form.seguroTextoPadrao.trim(),
  }
}

function createFormState(config = {}) {
  const base = cloneCheckoutPageConfig(config)

  return {
    ...base,
    beneficiosListaPadraoTexto: listToText(base.beneficiosListaPadrao),
    confiancaListaPadraoTexto: listToText(base.confiancaListaPadrao),
  }
}

export default function AdminPaginaCheckout() {
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
        setForm(createFormState(response?.checkout))
        setAtualizadoEm(response?.atualizadoEm || null)
      })
      .catch(error => {
        if (!ativo) return
        show(error.response?.data?.erro || 'Nao foi possivel carregar a configuracao do checkout.', 'error')
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [show])

  const preview = useMemo(() => resolveCheckoutPageConfig(form), [form])
  const previewContext = useMemo(() => ({
    local: 'Cohatrac / Cohab',
    plano: 'Plano intensivo',
    duracao: '3 meses',
    preco: 'R$ 99,90',
  }), [])

  function atualizarCampo(field, value) {
    setForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  function copiarPadraoAtual() {
    setForm(createFormState(CHECKOUT_PAGE_DEFAULTS))
    show('Os textos padrao atuais do checkout foram copiados para o formulario.')
  }

  function restaurarFallback() {
    setForm(createFormState())
    show('Os campos foram limpos. Se salvar assim, o checkout volta a usar os fallbacks do codigo.')
  }

  async function salvar(event) {
    event.preventDefault()
    setSalvando(true)

    try {
      const response = await configuracaoSiteService.atualizarCheckout(buildPayload(form))
      setForm(createFormState(response?.checkout))
      setAtualizadoEm(response?.atualizadoEm || null)
      show('Configuracao do checkout salva com sucesso.')
    } catch (error) {
      show(error.response?.data?.erro || 'Nao foi possivel salvar a configuracao do checkout.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Paginas - Checkout</div>
      <p className="page-sub">
        Defina o texto base da revisao antes de pagar. O plano ainda pode sobrescrever qualquer bloco quando precisar.
      </p>

      <div className="admin-grid admin-grid--planos">
        <div className="card">
          <div className="section-heading">Configuracao do Checkout</div>
          <div className="admin-inline-note" style={{ marginTop: '0.55rem' }}>
            Regra da tela: texto do plano &gt; configuracao desta pagina &gt; fallback do codigo.
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
                      Titulo principal da revisao antes de pagar.
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Kicker</label>
                  <input
                    className="form-input"
                    value={form.kickerPadrao}
                    onChange={event => atualizarCampo('kickerPadrao', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.kickerPadrao}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo</label>
                  <textarea
                    className="form-textarea"
                    value={form.tituloPadrao}
                    onChange={event => atualizarCampo('tituloPadrao', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.tituloPadrao}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Subtitulo</label>
                  <textarea
                    className="form-textarea"
                    value={form.subtituloPadrao}
                    onChange={event => atualizarCampo('subtituloPadrao', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.subtituloPadrao}
                  />
                </div>
              </div>

              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Beneficios</div>
                    <div className="section-copy">
                      Lista principal do que o aluno recebe. Variaveis disponiveis: {'{local}'}, {'{plano}'}, {'{duracao}'}, {'{preco}'}.
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo da secao</label>
                  <input
                    className="form-input"
                    value={form.beneficiosTituloPadrao}
                    onChange={event => atualizarCampo('beneficiosTituloPadrao', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.beneficiosTituloPadrao}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Itens (1 por linha)</label>
                  <textarea
                    className="form-textarea"
                    value={form.beneficiosListaPadraoTexto}
                    onChange={event => atualizarCampo('beneficiosListaPadraoTexto', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.beneficiosListaPadrao.join('\n')}
                  />
                </div>
              </div>

              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Apoio e confianca</div>
                    <div className="section-copy">
                      Textos que reduzem ansiedade e explicam a seguranca do fluxo.
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Titulo da secao de apoio</label>
                  <input
                    className="form-input"
                    value={form.ajudaTituloPadrao}
                    onChange={event => atualizarCampo('ajudaTituloPadrao', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.ajudaTituloPadrao}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Texto de apoio</label>
                  <textarea
                    className="form-textarea"
                    value={form.ajudaTextoPadrao}
                    onChange={event => atualizarCampo('ajudaTextoPadrao', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.ajudaTextoPadrao}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Itens de confianca (1 por linha)</label>
                  <textarea
                    className="form-textarea"
                    value={form.confiancaListaPadraoTexto}
                    onChange={event => atualizarCampo('confiancaListaPadraoTexto', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.confiancaListaPadrao.join('\n')}
                  />
                </div>
              </div>

              <div className="checkout-admin-block">
                <div className="checkout-admin-block-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Resumo e preco</div>
                    <div className="section-copy">
                      Bloco lateral com resumo da compra e mensagem de seguranca.
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kicker do resumo</label>
                    <input
                      className="form-input"
                      value={form.resumoKickerPadrao}
                      onChange={event => atualizarCampo('resumoKickerPadrao', event.target.value)}
                      placeholder={CHECKOUT_PAGE_DEFAULTS.resumoKickerPadrao}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Label do preco</label>
                    <input
                      className="form-input"
                      value={form.precoLabelPadrao}
                      onChange={event => atualizarCampo('precoLabelPadrao', event.target.value)}
                      placeholder={CHECKOUT_PAGE_DEFAULTS.precoLabelPadrao}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Texto do resumo</label>
                  <textarea
                    className="form-textarea"
                    value={form.resumoTextoPadrao}
                    onChange={event => atualizarCampo('resumoTextoPadrao', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.resumoTextoPadrao}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Texto abaixo do preco</label>
                  <input
                    className="form-input"
                    value={form.precoTextoPadrao}
                    onChange={event => atualizarCampo('precoTextoPadrao', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.precoTextoPadrao}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Texto de seguranca</label>
                  <input
                    className="form-input"
                    value={form.seguroTextoPadrao}
                    onChange={event => atualizarCampo('seguroTextoPadrao', event.target.value)}
                    placeholder={CHECKOUT_PAGE_DEFAULTS.seguroTextoPadrao}
                  />
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
            <div className="page-config-preview-badge">
              {interpolateSiteText(preview.kickerPadrao, previewContext)}
            </div>
            <div className="page-config-preview-title">
              {interpolateSiteText(preview.tituloPadrao, previewContext)}
            </div>
            <div className="page-config-preview-copy">
              {interpolateSiteText(preview.subtituloPadrao, previewContext)}
            </div>

            <div className="page-config-preview-section">
              <div className="page-config-preview-section-title">
                {interpolateSiteText(preview.beneficiosTituloPadrao, previewContext)}
              </div>
              <div className="page-config-preview-faq-list">
                {preview.beneficiosListaPadrao.map(item => (
                  <div key={item} className="page-config-preview-faq-item">
                    <strong>{interpolateSiteText(item, previewContext)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="page-config-preview-section">
              <div className="page-config-preview-section-title">
                {interpolateSiteText(preview.ajudaTituloPadrao, previewContext)}
              </div>
              <div className="page-config-preview-copy">
                {interpolateSiteText(preview.ajudaTextoPadrao, previewContext)}
              </div>
              <div className="page-config-preview-faq-list">
                {preview.confiancaListaPadrao.map(item => (
                  <div key={item} className="page-config-preview-faq-item">
                    <strong>{interpolateSiteText(item, previewContext)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="page-config-preview-section">
              <div className="page-config-preview-kicker">
                {interpolateSiteText(preview.resumoKickerPadrao, previewContext)}
              </div>
              <div className="page-config-preview-copy">
                {interpolateSiteText(preview.resumoTextoPadrao, previewContext)}
              </div>
              <div className="page-config-preview-faq-list">
                <div className="page-config-preview-faq-item">
                  <strong>{interpolateSiteText(preview.precoLabelPadrao, previewContext)}</strong>
                  <span>{previewContext.preco}</span>
                </div>
              </div>
              <div className="page-config-preview-copy">
                {interpolateSiteText(preview.precoTextoPadrao, previewContext)}
              </div>
              <div className="page-config-preview-copy">
                {interpolateSiteText(preview.seguroTextoPadrao, previewContext)}
              </div>
            </div>
          </div>

          <div className="checkout-admin-block">
            <div className="section-heading" style={{ fontSize: 18 }}>O que continua fora daqui</div>
            <div className="mini-copy" style={{ marginTop: '0.55rem' }}>
              O plano ainda pode sobrescrever qualquer um desses blocos. Esse modulo so define o padrao global do checkout.
            </div>
            <div className="admin-inline-actions" style={{ marginTop: '1rem' }}>
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
