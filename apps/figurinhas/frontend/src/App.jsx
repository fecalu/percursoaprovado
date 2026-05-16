import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'

const normalizedBase = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')
const apiBase = `${normalizedBase}/api`

const categoryOptions = [
  { value: 'JOGADOR', label: 'Jogador' },
  { value: 'GOLEIRO', label: 'Goleiro' },
  { value: 'DEFESA', label: 'Defesa' },
  { value: 'MEIO', label: 'Meio' },
  { value: 'ATAQUE', label: 'Ataque' },
  { value: 'COMISSAO', label: 'Comissao' },
  { value: 'ESCUDO', label: 'Escudo' },
  { value: 'ESPECIAL', label: 'Especial' }
]

const orderStatusLabels = {
  AGUARDANDO_PIX: 'Aguardando Pix',
  PIX_CONFIRMADO: 'Pix confirmado',
  EM_PRODUCAO: 'Em producao',
  PRONTO_PARA_RETIRADA: 'Pronto para retirada',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado'
}

const serviceTypeLabels = {
  IMPRESSAO: 'So imprimir para mim',
  IMPRESSAO_PACOTINHOS: 'Completo: imprimir, cortar e montar'
}

const STICKERS_PER_SHEET = 16

function useAdminToken() {
  const [token, setToken] = useState(() => window.localStorage.getItem('figurinhas_admin_token') || '')

  useEffect(() => {
    if (token) {
      window.localStorage.setItem('figurinhas_admin_token', token)
    } else {
      window.localStorage.removeItem('figurinhas_admin_token')
    }
  }, [token])

  return [token, setToken]
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options)
  if (!response.ok) {
    let detail = 'Nao foi possivel concluir a operacao.'
    try {
      const payload = await response.json()
      detail = payload.detail || detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.blob()
}

function apiFileUrl(relativePath) {
  return `${apiBase}/files/${relativePath}`
}

function buildAdminHeaders(token, extra = {}) {
  return {
    'X-Admin-Token': token,
    ...extra
  }
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format((cents || 0) / 100)
}

function formatDateTime(value) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatOcrConfidence(confidence) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return 'sem leitura'
  }
  return `${Math.round(confidence)}%`
}

function categoryLabel(category) {
  return categoryOptions.find(option => option.value === category)?.label || category
}

function moneyInputFromCents(cents) {
  return ((cents || 0) / 100).toFixed(2)
}

function centsFromInput(value) {
  const normalized = Number(String(value).replace(',', '.'))
  if (Number.isNaN(normalized)) {
    return 0
  }
  return Math.round(normalized * 100)
}

function downloadBlob(blob, fileName) {
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

function triggerFileDownload(downloadPath) {
  if (!downloadPath) return
  window.location.href = `${apiBase}${downloadPath}`
}

function Layout({ children }) {
  return (
    <div className="fig-app-shell">
      <header className="fig-topbar">
        <div>
          <p className="fig-kicker">Miniapp</p>
          <h1>Figurinhas</h1>
        </div>
        <nav className="fig-nav">
          <NavLink to="/" className={({ isActive }) => `fig-nav-link${isActive ? ' is-active' : ''}`}>
            Catalogo
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => `fig-nav-link${isActive ? ' is-active' : ''}`}>
            Admin
          </NavLink>
        </nav>
      </header>
      <main className="fig-main">{children}</main>
    </div>
  )
}

function PublicPage() {
  const [albums, setAlbums] = useState([])
  const [selectedAlbumSlug, setSelectedAlbumSlug] = useState('')
  const [selectedCollectionSlug, setSelectedCollectionSlug] = useState('')
  const [stickers, setStickers] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [selectedStickers, setSelectedStickers] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [serviceConfig, setServiceConfig] = useState(null)
  const [quote, setQuote] = useState(null)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [donationModalOpen, setDonationModalOpen] = useState(false)
  const [previewPage, setPreviewPage] = useState(0)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderResult, setOrderResult] = useState(null)
  const [pendingDownloadPath, setPendingDownloadPath] = useState('')
  const [pendingDownloadFileName, setPendingDownloadFileName] = useState('')
  const [pixCopied, setPixCopied] = useState(false)
  const [orderForm, setOrderForm] = useState({
    service_type: 'IMPRESSAO',
    customer_name: '',
    customer_whatsapp: '',
    notes: ''
  })
  const selectedAlbum = useMemo(
    () => albums.find(album => album.slug === selectedAlbumSlug) || null,
    [albums, selectedAlbumSlug]
  )
  const availableCollections = selectedAlbum?.collections || []
  const selectedCollection = useMemo(
    () => availableCollections.find(collection => collection.slug === selectedCollectionSlug) || null,
    [availableCollections, selectedCollectionSlug]
  )
  const selectedIds = useMemo(() => selectedStickers.map(sticker => sticker.id), [selectedStickers])
  const selectedCountByCollection = useMemo(
    () =>
      selectedStickers.reduce((accumulator, sticker) => {
        accumulator[sticker.collection_slug] = (accumulator[sticker.collection_slug] || 0) + 1
        return accumulator
      }, {}),
    [selectedStickers]
  )
  const selectedStickerItems = selectedStickers
  const previewSheets = useMemo(() => {
    const sheets = []
    for (let index = 0; index < selectedStickerItems.length; index += STICKERS_PER_SHEET) {
      sheets.push(selectedStickerItems.slice(index, index + STICKERS_PER_SHEET))
    }
    return sheets
  }, [selectedStickerItems])
  const previewPageCount = Math.max(1, Math.ceil(previewSheets.length / 2))
  const clampedPreviewPage = Math.min(previewPage, previewPageCount - 1)
  const visiblePreviewSheets = previewSheets.slice(clampedPreviewPage * 2, clampedPreviewPage * 2 + 2)
  const selectedCollectionsSummary = useMemo(
    () =>
      availableCollections
        .filter(collection => selectedCountByCollection[collection.slug])
        .map(collection => ({
          slug: collection.slug,
          name: collection.name,
          count: selectedCountByCollection[collection.slug]
        })),
    [availableCollections, selectedCountByCollection]
  )

  useEffect(() => {
    let ignore = false
    async function loadBootstrap() {
      setBusy(true)
      setError('')
      try {
        const [collectionsData, serviceData] = await Promise.all([
          apiFetch('/albums'),
          apiFetch('/service-config')
        ])
        if (ignore) return
        setAlbums(collectionsData)
        setSelectedAlbumSlug(current => current || collectionsData[0]?.slug || '')
        setServiceConfig(serviceData)
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      } finally {
        if (!ignore) {
          setBusy(false)
        }
      }
    }
    loadBootstrap()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!selectedCollectionSlug) {
      setStickers([])
      return
    }

    let ignore = false
    async function loadStickers() {
      setBusy(true)
      setError('')
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (category) params.set('category', category)
      const query = params.toString() ? `?${params.toString()}` : ''
      try {
        const data = await apiFetch(`/collections/${selectedCollectionSlug}/stickers${query}`)
        if (ignore) return
        setStickers(data)
        setSelectedStickers(current =>
          current.filter(sticker => sticker.collection_slug !== selectedCollectionSlug || data.some(item => item.id === sticker.id))
        )
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      } finally {
        if (!ignore) {
          setBusy(false)
        }
      }
    }
    loadStickers()
    return () => {
      ignore = true
    }
  }, [selectedCollectionSlug, search, category])

  useEffect(() => {
    if (!selectedAlbumSlug || selectedIds.length === 0 || !serviceConfig?.service_enabled) {
      setQuote(null)
      setOrderFormOpen(false)
      return
    }

    let ignore = false
    async function loadQuote() {
      setQuoteBusy(true)
      try {
        const data = await apiFetch('/orders/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            album_slug: selectedAlbumSlug,
            sticker_ids: selectedIds
          })
        })
        if (ignore) return
        setQuote(data)
      } catch (err) {
        if (!ignore) {
          setQuote(null)
          setError(err.message)
        }
      } finally {
        if (!ignore) {
          setQuoteBusy(false)
        }
      }
    }
    loadQuote()
    return () => {
      ignore = true
    }
  }, [selectedAlbumSlug, selectedIds, serviceConfig?.service_enabled])

  useEffect(() => {
    setOrderResult(null)
  }, [selectedAlbumSlug, selectedIds])

  useEffect(() => {
    if (quote && !quote.pack_eligible && orderForm.service_type === 'IMPRESSAO_PACOTINHOS') {
      setOrderForm(current => ({ ...current, service_type: 'IMPRESSAO' }))
    }
  }, [quote, orderForm.service_type])

  useEffect(() => {
    if (!orderFormOpen) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOrderFormOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [orderFormOpen])

  useEffect(() => {
    if (!donationModalOpen) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setDonationModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [donationModalOpen])

  useEffect(() => {
    if (!orderFormOpen) {
      setPreviewPage(0)
    }
  }, [orderFormOpen])

  useEffect(() => {
    if (!donationModalOpen) {
      setPixCopied(false)
    }
  }, [donationModalOpen])

  useEffect(() => {
    setPreviewPage(current => Math.min(current, previewPageCount - 1))
  }, [previewPageCount])

  useEffect(() => {
    if (!selectedAlbum) {
      setSelectedCollectionSlug('')
      return
    }
    setSelectedCollectionSlug(current =>
      availableCollections.some(collection => collection.slug === current) ? current : availableCollections[0]?.slug || ''
    )
  }, [selectedAlbum, availableCollections])

  function toggleSelection(stickerId) {
    const sticker = stickers.find(item => item.id === stickerId)
    if (!sticker) return

    setSelectedStickers(current =>
      current.some(item => item.id === stickerId)
        ? current.filter(item => item.id !== stickerId)
        : [
            ...current,
            {
              ...sticker,
              collection_slug: selectedCollectionSlug,
              collection_name: selectedCollection?.name || ''
            }
          ]
    )
  }

  async function handleExport() {
    if (!selectedAlbumSlug || selectedIds.length === 0) return
    setExporting(true)
    setError('')
    try {
      const data = await apiFetch('/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          album_slug: selectedAlbumSlug,
          sticker_ids: selectedIds
        })
      })
      if (serviceConfig?.donation_enabled && serviceConfig?.pix_key) {
        setPendingDownloadPath(data.download_path)
        setPendingDownloadFileName(data.file_name)
        setDonationModalOpen(true)
      } else {
        triggerFileDownload(data.download_path)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  async function handleCopyPixKey() {
    if (!serviceConfig?.pix_key) return
    try {
      await navigator.clipboard.writeText(serviceConfig.pix_key)
      setPixCopied(true)
    } catch {
      setError('Nao foi possivel copiar a chave Pix automaticamente.')
    }
  }

  function handleDonationDownload() {
    const downloadPath = pendingDownloadPath
    setDonationModalOpen(false)
    setPendingDownloadPath('')
    setPendingDownloadFileName('')
    triggerFileDownload(downloadPath)
  }

  async function handleCreateOrder(event) {
    event.preventDefault()
    if (!selectedAlbumSlug || selectedIds.length === 0) return
    setOrderSubmitting(true)
    setError('')
    try {
      const data = await apiFetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          album_slug: selectedAlbumSlug,
          sticker_ids: selectedIds,
          ...orderForm
        })
      })
      setOrderResult(data)
      setOrderFormOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setOrderSubmitting(false)
    }
  }

  return (
    <section className="fig-public-layout">
      <aside className="fig-sidebar-panel">
        <div className="fig-panel-header">
          <p className="fig-kicker">Albuns publicados</p>
          <h2>Escolha a edicao</h2>
        </div>
        <div className="fig-collection-list">
          {albums.map(album => (
            <button
              key={album.id}
              type="button"
              className={`fig-collection-button${album.slug === selectedAlbumSlug ? ' is-active' : ''}`}
              onClick={() => {
                setSelectedAlbumSlug(album.slug)
                setSelectedCollectionSlug('')
                setSelectedStickers([])
                setSearch('')
                setCategory('')
              }}
            >
              <strong>{album.name}</strong>
              <span>{album.published_collection_count} selecoes publicadas</span>
            </button>
          ))}
          {!busy && albums.length === 0 ? <p className="fig-empty-note">Nenhum album publicado ainda.</p> : null}
        </div>

        {selectedAlbum ? (
          <div className="fig-sidebar-subsection">
            <div className="fig-panel-header fig-panel-header--compact">
              <p className="fig-kicker">Selecoes</p>
              <h3>{selectedAlbum.name}</h3>
            </div>
            <div className="fig-collection-list fig-collection-list--nested">
              {availableCollections.map(collection => (
                <button
                  key={collection.id}
                  type="button"
                  className={`fig-collection-button fig-collection-button--compact${
                    collection.slug === selectedCollectionSlug ? ' is-active' : ''
                  }`}
                  onClick={() => setSelectedCollectionSlug(collection.slug)}
                >
                  <strong>{collection.name}</strong>
                  <span>
                    {selectedCountByCollection[collection.slug]
                      ? `${selectedCountByCollection[collection.slug]} marcada(s)`
                      : `${collection.sticker_count} figurinhas`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="fig-sidebar-summary">
          <div className="fig-inline-meta">
            <strong>{selectedIds.length}</strong>
            <span>figurinhas no PDF</span>
          </div>
          {selectedCollectionsSummary.length > 0 ? (
            <div className="fig-summary-chip-list">
              {selectedCollectionsSummary.map(collection => (
                <span key={collection.slug} className="fig-summary-chip">
                  {collection.name} {collection.count}
                </span>
              ))}
            </div>
          ) : (
            <p className="fig-empty-note">Monte sua selecao misturando quantas selecoes quiser dentro do album.</p>
          )}
        </div>
      </aside>

      <div className="fig-content-panel">
        <div className="fig-hero">
          <div>
            <p className="fig-kicker">Selecao rapida</p>
            <h2>{selectedCollection?.name || selectedAlbum?.name || 'Selecione um album'}</h2>
            <p>
              {selectedCollection
                ? `Agora voce esta em ${selectedCollection.name}. Marque as figurinhas e misture selecoes desse album no mesmo PDF.`
                : selectedAlbum?.description || 'Marque os jogadores que voce precisa e gere seu PDF.'}
            </p>
            {selectedCollection ? (
              <div className="fig-hero-meta-row">
                <span className="fig-mini-chip">Album: {selectedAlbum?.name}</span>
                <span className="fig-mini-chip">{selectedCollection.sticker_count} figurinhas publicadas</span>
              </div>
            ) : null}
          </div>
          <div className="fig-hero-actions">
            <button
              type="button"
              className="fig-secondary-button"
              onClick={() =>
                setSelectedStickers(current => {
                  const selectedById = new Map(current.map(sticker => [sticker.id, sticker]))
                  stickers.forEach(sticker => {
                    selectedById.set(sticker.id, {
                      ...sticker,
                      collection_slug: selectedCollectionSlug,
                      collection_name: selectedCollection?.name || ''
                    })
                  })
                  return Array.from(selectedById.values())
                })
              }
            >
              Selecionar todas
            </button>
            <button type="button" className="fig-secondary-button" onClick={() => setSelectedStickers([])}>
              Limpar selecao
            </button>
            {serviceConfig?.service_enabled ? (
              <button
                type="button"
                className="fig-secondary-button"
                disabled={selectedIds.length === 0 || !(quote?.service_enabled ?? serviceConfig?.service_enabled)}
                onClick={() => setOrderFormOpen(true)}
              >
                Quero que voce prepare para mim
              </button>
            ) : null}
            <button
              type="button"
              className="fig-primary-button"
              disabled={!selectedAlbumSlug || selectedIds.length === 0 || exporting}
              onClick={handleExport}
            >
              {exporting ? 'Gerando PDF...' : `Gerar PDF gratis (${selectedIds.length})`}
            </button>
          </div>
        </div>

        <div className="fig-toolbar">
          <label className="fig-field">
            <span>Buscar jogador</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ex.: Vinicius" />
          </label>
          <label className="fig-field">
            <span>Categoria</span>
            <select value={category} onChange={event => setCategory(event.target.value)}>
              <option value="">Todas</option>
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {orderResult ? (
          <section className="fig-success-panel">
            <p className="fig-kicker">Pedido criado</p>
            <h3>{orderResult.reference_code}</h3>
            <div className="fig-quote-grid">
              <div className="fig-quote-item">
                <strong>{serviceTypeLabels[orderResult.service_type]}</strong>
                <span>servico escolhido</span>
              </div>
              <div className="fig-quote-item">
                <strong>{formatCurrency(orderResult.total_price_cents)}</strong>
                <span>total do pedido</span>
              </div>
              <div className="fig-quote-item">
                <strong>{orderStatusLabels[orderResult.status]}</strong>
                <span>status atual</span>
              </div>
              <div className="fig-quote-item">
                <strong>{orderResult.sheet_count}</strong>
                <span>folhas reservadas</span>
              </div>
            </div>
            <p>
              Envie o Pix e me passe o codigo <strong>{orderResult.reference_code}</strong>.
            </p>
            <p>
              Chave Pix: <strong>{orderResult.pix_key || 'a configurar'}</strong>
              {orderResult.pix_holder ? ` · ${orderResult.pix_holder}` : ''}
            </p>
            {orderResult.pickup_note ? <p>{orderResult.pickup_note}</p> : null}
          </section>
        ) : null}

        {error ? <p className="fig-error-banner">{error}</p> : null}
        {busy ? <p className="fig-empty-note">Carregando figurinhas...</p> : null}
        {serviceConfig?.service_enabled && quoteBusy && selectedIds.length > 0 ? (
          <p className="fig-empty-note">Calculando folhas e servicos...</p>
        ) : null}

        <div className="fig-sticker-grid">
          {stickers.map(sticker => (
            <button
              key={sticker.id}
              type="button"
              className={`fig-sticker-card${selectedIds.includes(sticker.id) ? ' is-selected' : ''}`}
              onClick={() => toggleSelection(sticker.id)}
            >
              <div className="fig-sticker-card-media">
                <img src={apiFileUrl(sticker.preview_path)} alt={sticker.name} />
                {!selectedIds.includes(sticker.id) ? <span className="fig-sticker-card-hint">Toque para marcar</span> : null}
              </div>
              <div className="fig-sticker-card-body">
                <strong>{sticker.name}</strong>
                <span>{categoryLabel(sticker.category)}</span>
              </div>
            </button>
          ))}
        </div>
        {!busy && stickers.length === 0 ? <p className="fig-empty-note">Nenhuma figurinha encontrada para esse filtro.</p> : null}
      </div>

      {orderFormOpen && quote ? (
        <div className="fig-modal-backdrop" onClick={() => setOrderFormOpen(false)}>
          <div className="fig-modal-shell" onClick={event => event.stopPropagation()}>
            <div className="fig-modal-header">
              <div>
                <p className="fig-kicker">Servico opcional</p>
                <h3>Quer que eu prepare tudo para voce?</h3>
              </div>
              <button type="button" className="fig-modal-close" onClick={() => setOrderFormOpen(false)}>
                Fechar
              </button>
            </div>

            <section className="fig-service-card fig-service-card--modal">
              <div className="fig-service-card-header">
                <div>
                  <p className="fig-kicker">Resumo rapido</p>
                  <h3>Seu pedido de impressao</h3>
                </div>
                <span className={`fig-service-badge${quote.service_enabled ? ' is-ready' : ''}`}>
                  {quote.service_enabled ? 'Disponivel' : 'Em configuracao'}
                </span>
              </div>

              <div className="fig-helper-strip fig-helper-strip--tight">
                <strong>Cada folha comporta ate 16 figurinhas.</strong>
                <span>
                  Sua selecao atual ocupa {quote.sheet_count} folha(s) no total.
                </span>
              </div>

              <div className="fig-quote-grid">
                <div className="fig-quote-item">
                  <strong>{quote.item_count}</strong>
                  <span>figurinhas selecionadas</span>
                </div>
                <div className="fig-quote-item">
                  <strong>{quote.sheet_count}</strong>
                  <span>folhas para imprimir</span>
                </div>
                <div className="fig-quote-item">
                  <strong>{formatCurrency(quote.print_total_cents)}</strong>
                  <span>so impressao das folhas</span>
                </div>
                <div className="fig-quote-item">
                  <strong>{quote.pack_eligible ? formatCurrency(quote.pack_total_cents || 0) : '--'}</strong>
                  <span>
                    {quote.pack_eligible
                      ? `${quote.pack_count} pacotinho(s) montado(s)`
                      : `pacotinhos de ${quote.pack_size}`}
                  </span>
                </div>
              </div>

              <div className="fig-service-notes">
                <p>
                  <strong>Servico 1:</strong> impressao por folha: <strong>{formatCurrency(quote.print_price_cents)}</strong>
                </p>
                <p>
                  <strong>Servico 2:</strong> montagem de cada pacotinho com corte e separacao de {quote.pack_size} figurinhas:{' '}
                  <strong>{formatCurrency(quote.pack_price_cents)}</strong>
                </p>
                {!quote.pack_eligible ? (
                  <p className="fig-warning-text">
                    Para eu montar os pacotinhos, a quantidade precisa fechar em grupos de {quote.pack_size}.
                    Sua selecao atual precisa de mais {quote.pack_size - quote.pack_remainder} figurinha(s).
                  </p>
                ) : null}
                {quote.pickup_note ? <p>{quote.pickup_note}</p> : null}
              </div>

              <div className="fig-sheet-preview-section">
                <div className="fig-sheet-preview-head">
                  <strong>Miniatura da distribuicao</strong>
                  <span>{previewSheets.length} folha(s) gerada(s)</span>
                </div>
                <div className="fig-sheet-preview-strip">
                  {visiblePreviewSheets.map((sheet, visibleIndex) => {
                    const sheetIndex = clampedPreviewPage * 2 + visibleIndex
                    return (
                      <div key={`sheet-${sheetIndex + 1}`} className="fig-sheet-preview-card">
                        <div className="fig-sheet-preview-meta">
                          <strong>Folha {sheetIndex + 1}</strong>
                          <span>{sheet.length}/{STICKERS_PER_SHEET}</span>
                        </div>
                        <div className="fig-sheet-preview-grid">
                          {Array.from({ length: STICKERS_PER_SHEET }).map((_, slotIndex) => {
                            const sticker = sheet[slotIndex]
                            return (
                              <div
                                key={`sheet-${sheetIndex + 1}-slot-${slotIndex + 1}`}
                                className={`fig-sheet-preview-slot${sticker ? ' is-filled' : ''}`}
                              >
                                {sticker ? <img src={apiFileUrl(sticker.preview_path)} alt={sticker.name} /> : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {previewSheets.length > 2 ? (
                  <div className="fig-sheet-preview-pagination">
                    <button
                      type="button"
                      className="fig-sheet-preview-arrow"
                      onClick={() => setPreviewPage(current => Math.max(current - 1, 0))}
                      disabled={clampedPreviewPage === 0}
                      aria-label="Ver folhas anteriores"
                    >
                      &#9664;
                    </button>
                    <span className="fig-sheet-preview-page-indicator">
                      Folhas {clampedPreviewPage * 2 + 1}-
                      {Math.min(clampedPreviewPage * 2 + visiblePreviewSheets.length, previewSheets.length)} de{' '}
                      {previewSheets.length}
                    </span>
                    <button
                      type="button"
                      className="fig-sheet-preview-arrow"
                      onClick={() => setPreviewPage(current => Math.min(current + 1, previewPageCount - 1))}
                      disabled={clampedPreviewPage >= previewPageCount - 1}
                      aria-label="Ver proximas folhas"
                    >
                      &#9654;
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <form className="fig-form-card fig-order-form fig-order-form--modal" onSubmit={handleCreateOrder}>
              <div className="fig-panel-header">
                <p className="fig-kicker">Pedido local</p>
                <h3>Escolha como voce quer receber</h3>
              </div>

              <div className="fig-order-options">
                <label className={`fig-order-option${orderForm.service_type === 'IMPRESSAO' ? ' is-active' : ''}`}>
                  <input
                    type="radio"
                    name="service_type"
                    value="IMPRESSAO"
                    checked={orderForm.service_type === 'IMPRESSAO'}
                    onChange={event => setOrderForm(current => ({ ...current, service_type: event.target.value }))}
                  />
                  <div>
                    <strong>So imprimir para mim</strong>
                    <span>{quote.sheet_count} folha(s) impressa(s) - {formatCurrency(quote.print_total_cents)}</span>
                  </div>
                </label>

                <label
                  className={`fig-order-option${
                    orderForm.service_type === 'IMPRESSAO_PACOTINHOS' ? ' is-active' : ''
                  }${!quote.pack_eligible ? ' is-disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name="service_type"
                    value="IMPRESSAO_PACOTINHOS"
                    checked={orderForm.service_type === 'IMPRESSAO_PACOTINHOS'}
                    disabled={!quote.pack_eligible}
                    onChange={event => setOrderForm(current => ({ ...current, service_type: event.target.value }))}
                  />
                  <div>
                    <strong>Completo: imprimir, cortar e montar</strong>
                    <span>
                      {quote.pack_eligible
                        ? `${quote.pack_count} pacotinho(s) - ${formatCurrency(quote.pack_total_cents || 0)}`
                        : `Disponivel so quando fechar grupos de ${quote.pack_size}`}
                    </span>
                  </div>
                </label>
              </div>

              <div className="fig-form-grid">
                <label className="fig-field">
                  <span>Nome</span>
                  <input
                    value={orderForm.customer_name}
                    onChange={event => setOrderForm(current => ({ ...current, customer_name: event.target.value }))}
                    required
                  />
                </label>
                <label className="fig-field">
                  <span>WhatsApp</span>
                  <input
                    value={orderForm.customer_whatsapp}
                    onChange={event => setOrderForm(current => ({ ...current, customer_whatsapp: event.target.value }))}
                    required
                  />
                </label>
                <label className="fig-field">
                  <span>Observacao (opcional)</span>
                  <input
                    value={orderForm.notes}
                    onChange={event => setOrderForm(current => ({ ...current, notes: event.target.value }))}
                    placeholder="Ex.: alguma orientacao sobre o pedido"
                  />
                </label>
              </div>

              <div className="fig-helper-strip">
                <strong>Pagamento via Pix.</strong>{' '}
                <span>
                  Chave: {quote.pix_key || 'a configurar'}
                  {quote.pix_holder ? ` · ${quote.pix_holder}` : ''}
                </span>
              </div>

              <div className="fig-hero-actions">
                <button type="button" className="fig-secondary-button" onClick={() => setOrderFormOpen(false)}>
                  Fechar
                </button>
                <button
                  type="submit"
                  className="fig-primary-button"
                  disabled={orderSubmitting || !quote.service_enabled}
                >
                  {orderSubmitting ? 'Criando pedido...' : 'Confirmar pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {donationModalOpen && serviceConfig ? (
        <div className="fig-modal-backdrop" onClick={() => setDonationModalOpen(false)}>
          <div className="fig-modal-shell fig-modal-shell--donation" onClick={event => event.stopPropagation()}>
            <div className="fig-modal-header">
              <div>
                <p className="fig-kicker">Apoio opcional</p>
                <h3>Se quiser, voce pode apoiar o projeto via Pix</h3>
              </div>
              <button type="button" className="fig-modal-close" onClick={() => setDonationModalOpen(false)}>
                Fechar
              </button>
            </div>

            <section className="fig-form-card fig-donation-modal-card">
              <div className="fig-service-notes">
                <p>{serviceConfig.donation_message || 'O download continua gratuito mesmo sem doacao.'}</p>
              </div>

              <div className="fig-quote-grid fig-quote-grid--donation">
                <div className="fig-quote-item">
                  <strong>{selectedIds.length}</strong>
                  <span>figurinhas no arquivo</span>
                </div>
                <div className="fig-quote-item">
                  <strong>{quote?.sheet_count || previewSheets.length || 1}</strong>
                  <span>folha(s) gerada(s)</span>
                </div>
                <div className="fig-quote-item">
                  <strong>Pix</strong>
                  <span>apoio opcional</span>
                </div>
              </div>

              <div className="fig-helper-strip fig-helper-strip--donation">
                <div>
                  <strong>Chave Pix</strong>
                  <span>{serviceConfig.pix_key || 'a configurar'}{serviceConfig.pix_holder ? ` · ${serviceConfig.pix_holder}` : ''}</span>
                </div>
                <button type="button" className="fig-secondary-button" onClick={handleCopyPixKey}>
                  {pixCopied ? 'Chave copiada' : 'Copiar chave Pix'}
                </button>
              </div>

              <div className="fig-hero-actions">
                <button type="button" className="fig-secondary-button" onClick={() => setDonationModalOpen(false)}>
                  Agora nao
                </button>
                <button type="button" className="fig-primary-button" onClick={handleDonationDownload}>
                  {pendingDownloadFileName ? `Baixar ${pendingDownloadFileName}` : 'Baixar PDF agora'}
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  )
}


function AdminPage() {
  const [token, setToken] = useAdminToken()
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [albums, setAlbums] = useState([])
  const [selectedAlbumId, setSelectedAlbumId] = useState(null)
  const [collections, setCollections] = useState([])
  const [selectedCollectionId, setSelectedCollectionId] = useState(null)
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [pages, setPages] = useState([])
  const [stickers, setStickers] = useState([])
  const [currentPageId, setCurrentPageId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [savingCollection, setSavingCollection] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [albumForm, setAlbumForm] = useState({ name: '', slug: '', description: '', sort_order: '0' })
  const [createForm, setCreateForm] = useState({ album_id: '', name: '', slug: '', description: '', sort_order: '0' })
  const [albumStructureMode, setAlbumStructureMode] = useState('edit')
  const [collectionStructureMode, setCollectionStructureMode] = useState('edit')
  const [selectedAlbumForm, setSelectedAlbumForm] = useState({ name: '', slug: '', description: '', sort_order: '0' })
  const [selectedCollectionForm, setSelectedCollectionForm] = useState({
    name: '',
    slug: '',
    description: '',
    sort_order: '0'
  })
  const [savingAlbum, setSavingAlbum] = useState(false)
  const [savingAlbumEdit, setSavingAlbumEdit] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [processingAuto, setProcessingAuto] = useState(false)
  const [editingStickerId, setEditingStickerId] = useState(null)
  const [stickerForm, setStickerForm] = useState({
    name: '',
    code: '',
    category: 'JOGADOR',
    sort_order: 0,
    x_ratio: '',
    y_ratio: '',
    width_ratio: '',
    height_ratio: '',
    active: true
  })
  const [draftRect, setDraftRect] = useState(null)
  const [selectionRect, setSelectionRect] = useState(null)
  const [dragState, setDragState] = useState(null)
  const [serviceForm, setServiceForm] = useState({
    service_enabled: false,
    donation_enabled: false,
    pack_size: '7',
    print_price: '0.00',
    pack_price: '0.00',
    pix_key: '',
    pix_holder: '',
    donation_message: '',
    pickup_note: ''
  })
  const [savingService, setSavingService] = useState(false)
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [adminView, setAdminView] = useState('structure')
  const [collectionAlbumTargetId, setCollectionAlbumTargetId] = useState('')
  const [orderAdminForm, setOrderAdminForm] = useState({
    status: 'AGUARDANDO_PIX',
    admin_notes: ''
  })
  const [savingOrder, setSavingOrder] = useState(false)
  const [savingCollectionEdit, setSavingCollectionEdit] = useState(false)

  async function fetchCollections(activeCollectionId = selectedCollectionId) {
    if (!token) return
    setLoading(true)
    try {
      const data = await apiFetch('/admin/collections', {
        headers: buildAdminHeaders(token)
      })
      setCollections(data)
      const nextId = activeCollectionId || data[0]?.id || null
      setSelectedCollectionId(nextId)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAlbums(activeAlbumId = selectedAlbumId) {
    if (!token) return
    const data = await apiFetch('/admin/albums', {
      headers: buildAdminHeaders(token)
    })
    setAlbums(data)
    const nextId = activeAlbumId || data[0]?.id || null
    setSelectedAlbumId(nextId)
    setCreateForm(current => ({
      ...current,
      album_id: String(current.album_id || nextId || ''),
    }))
  }

  async function fetchServiceConfig() {
    if (!token) return
    const data = await apiFetch('/admin/service-config', {
      headers: buildAdminHeaders(token)
    })
    setServiceForm({
      service_enabled: data.service_enabled,
      donation_enabled: data.donation_enabled,
      pack_size: String(data.pack_size),
      print_price: moneyInputFromCents(data.print_price_cents),
      pack_price: moneyInputFromCents(data.pack_price_cents),
      pix_key: data.pix_key || '',
      pix_holder: data.pix_holder || '',
      donation_message: data.donation_message || '',
      pickup_note: data.pickup_note || ''
    })
  }

  async function fetchOrders(activeOrderId = selectedOrderId) {
    if (!token) return
    const data = await apiFetch('/admin/orders', {
      headers: buildAdminHeaders(token)
    })
    setOrders(data)
    setSelectedOrderId(current => activeOrderId || current || data[0]?.id || null)
  }

  useEffect(() => {
    if (!token) return
    let ignore = false
    async function bootstrap() {
      setError('')
      try {
        await Promise.all([fetchAlbums(), fetchCollections(), fetchServiceConfig(), fetchOrders()])
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      }
    }
    bootstrap()
    return () => {
      ignore = true
    }
  }, [token])

  useEffect(() => {
    if (!token || !selectedCollectionId) {
      setSelectedCollection(null)
      setPages([])
      setStickers([])
      return
    }

    let ignore = false
    async function fetchCollectionDetail() {
      setLoading(true)
      setError('')
      try {
        const [collection, pagesData, stickersData] = await Promise.all([
          apiFetch(`/admin/collections/${selectedCollectionId}`, { headers: buildAdminHeaders(token) }),
          apiFetch(`/admin/collections/${selectedCollectionId}/pages`, { headers: buildAdminHeaders(token) }),
          apiFetch(`/admin/collections/${selectedCollectionId}/stickers`, { headers: buildAdminHeaders(token) })
        ])
        if (ignore) return
        setSelectedCollection(collection)
        setPages(pagesData)
        setStickers(stickersData)
        setCurrentPageId(current => current || pagesData[0]?.id || null)
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }
    fetchCollectionDetail()
    return () => {
      ignore = true
    }
  }, [token, selectedCollectionId])

  const currentPage = useMemo(() => pages.find(page => page.id === currentPageId) || null, [pages, currentPageId])
  const selectedAlbum = useMemo(() => albums.find(album => album.id === selectedAlbumId) || null, [albums, selectedAlbumId])
  const filteredCollections = useMemo(
    () => collections.filter(collection => !selectedAlbumId || collection.album_id === selectedAlbumId),
    [collections, selectedAlbumId]
  )
  const currentPageStickers = useMemo(
    () => stickers.filter(sticker => sticker.page_id === currentPageId),
    [stickers, currentPageId]
  )
  const editingSticker = useMemo(
    () => stickers.find(sticker => sticker.id === editingStickerId) || null,
    [stickers, editingStickerId]
  )
  const selectedOrder = useMemo(
    () => orders.find(order => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  )

  useEffect(() => {
    if (!selectedOrder) return
    setOrderAdminForm({
      status: selectedOrder.status,
      admin_notes: selectedOrder.admin_notes || ''
    })
  }, [selectedOrder])

  useEffect(() => {
    if (!filteredCollections.length) {
      setSelectedCollectionId(null)
      return
    }

    if (!filteredCollections.some(collection => collection.id === selectedCollectionId)) {
      setSelectedCollectionId(filteredCollections[0]?.id || null)
      setCurrentPageId(null)
      resetStickerForm()
    }
  }, [filteredCollections, selectedCollectionId])

  useEffect(() => {
    if (!selectedCollection) return
    setCollectionAlbumTargetId(String(selectedCollection.album_id || ''))
  }, [selectedCollection])

  useEffect(() => {
    if (!selectedAlbum) {
      setSelectedAlbumForm({ name: '', slug: '', description: '', sort_order: '0' })
      return
    }
    setSelectedAlbumForm({
      name: selectedAlbum.name || '',
      slug: selectedAlbum.slug || '',
      description: selectedAlbum.description || '',
      sort_order: String(selectedAlbum.sort_order ?? 0)
    })
  }, [selectedAlbum])

  useEffect(() => {
    if (!selectedCollection) {
      setSelectedCollectionForm({ name: '', slug: '', description: '', sort_order: '0' })
      return
    }
    setSelectedCollectionForm({
      name: selectedCollection.name || '',
      slug: selectedCollection.slug || '',
      description: selectedCollection.description || '',
      sort_order: String(selectedCollection.sort_order ?? 0)
    })
  }, [selectedCollection])

  useEffect(() => {
    if (!selectedCollection && (adminView === 'collection' || adminView === 'mapping')) {
      setAdminView('structure')
    }
  }, [adminView, selectedCollection])

  useEffect(() => {
    if (selectedAlbum) {
      setAlbumStructureMode('edit')
    }
  }, [selectedAlbumId])

  useEffect(() => {
    if (selectedCollection) {
      setCollectionStructureMode('edit')
    }
  }, [selectedCollectionId])

  useEffect(() => {
    if (albumForm.name || albumForm.slug || albumForm.description) return
    const nextOrder = albums.reduce((maxValue, album) => Math.max(maxValue, Number(album.sort_order || 0)), 0) + 1
    setAlbumForm(current => ({ ...current, sort_order: String(nextOrder) }))
  }, [albums, albumForm.name, albumForm.slug, albumForm.description])

  useEffect(() => {
    if (createForm.name || createForm.slug || createForm.description) return
    const nextOrder =
      filteredCollections.reduce((maxValue, collection) => Math.max(maxValue, Number(collection.sort_order || 0)), 0) + 1
    setCreateForm(current => ({
      ...current,
      album_id: String(selectedAlbumId || current.album_id || ''),
      sort_order: String(nextOrder)
    }))
  }, [filteredCollections, selectedAlbumId, createForm.name, createForm.slug, createForm.description])

  function resetStickerForm() {
    setEditingStickerId(null)
    setStickerForm({
      name: '',
      code: '',
      category: 'JOGADOR',
      sort_order: currentPageStickers.length + 1,
      x_ratio: '',
      y_ratio: '',
      width_ratio: '',
      height_ratio: '',
      active: true
    })
    setDraftRect(null)
  }

  async function handleLogin(event) {
    event.preventDefault()
    setAuthError('')
    try {
      const data = await apiFetch('/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      setToken(data.token)
      setPassword('')
    } catch (err) {
      setAuthError(err.message)
    }
  }

  async function handleCreateAlbum(event) {
    event.preventDefault()
    setSavingAlbum(true)
    setError('')
    setMessage('')
    try {
      const created = await apiFetch('/admin/albums', {
        method: 'POST',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...albumForm,
          sort_order: Number(albumForm.sort_order || 0)
        })
      })
      setAlbumForm({ name: '', slug: '', description: '', sort_order: '0' })
      setAlbumStructureMode('edit')
      setMessage('Album criado.')
      await fetchAlbums(created.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingAlbum(false)
    }
  }

  async function handleCreateCollection(event) {
    event.preventDefault()
    setSavingCollection(true)
    setError('')
    setMessage('')
    try {
      const created = await apiFetch('/admin/collections', {
        method: 'POST',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...createForm,
          sort_order: Number(createForm.sort_order || 0)
        })
      })
      setCreateForm(current => ({ ...current, name: '', slug: '', description: '', sort_order: '0' }))
      setCollectionStructureMode('edit')
      setMessage('Colecao criada.')
      setSelectedAlbumId(created.album_id || selectedAlbumId)
      await fetchCollections(created.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingCollection(false)
    }
  }

  async function handleUpdateAlbum(event) {
    event.preventDefault()
    if (!selectedAlbumId) return
    setSavingAlbumEdit(true)
    setError('')
    setMessage('')
    try {
      const updated = await apiFetch(`/admin/albums/${selectedAlbumId}`, {
        method: 'PUT',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...selectedAlbumForm,
          sort_order: Number(selectedAlbumForm.sort_order || 0)
        })
      })
      setMessage('Album atualizado.')
      await Promise.all([fetchAlbums(updated.id), fetchCollections(selectedCollectionId)])
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingAlbumEdit(false)
    }
  }

  async function handleUpdateCollection(event) {
    event.preventDefault()
    if (!selectedCollectionId) return
    setSavingCollectionEdit(true)
    setError('')
    setMessage('')
    try {
      const updated = await apiFetch(`/admin/collections/${selectedCollectionId}`, {
        method: 'PUT',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...selectedCollectionForm,
          sort_order: Number(selectedCollectionForm.sort_order || 0)
        })
      })
      setMessage('Colecao atualizada.')
      await Promise.all([fetchAlbums(updated.album_id || selectedAlbumId), fetchCollections(updated.id)])
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingCollectionEdit(false)
    }
  }

  function handleStartCreateAlbum() {
    const nextOrder = albums.reduce((maxValue, album) => Math.max(maxValue, Number(album.sort_order || 0)), 0) + 1
    setAlbumForm({ name: '', slug: '', description: '', sort_order: String(nextOrder) })
    setAlbumStructureMode('create')
  }

  function handleStartCreateCollection() {
    const nextOrder =
      filteredCollections.reduce((maxValue, collection) => Math.max(maxValue, Number(collection.sort_order || 0)), 0) + 1
    setCreateForm({
      album_id: String(selectedAlbumId || ''),
      name: '',
      slug: '',
      description: '',
      sort_order: String(nextOrder)
    })
    setCollectionStructureMode('create')
  }

  async function handleAssignCollectionAlbum() {
    if (!selectedCollectionId || !collectionAlbumTargetId) return
    setError('')
    setMessage('')
    try {
      const updated = await apiFetch(`/admin/collections/${selectedCollectionId}/album`, {
        method: 'PUT',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ album_id: Number(collectionAlbumTargetId) })
      })
      setMessage('Colecao movida para o album escolhido.')
      setSelectedAlbumId(updated.album_id || null)
      await Promise.all([fetchAlbums(updated.album_id || null), fetchCollections(updated.id)])
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSaveServiceConfig(event) {
    event.preventDefault()
    setSavingService(true)
    setError('')
    setMessage('')
    try {
      await apiFetch('/admin/service-config', {
        method: 'PUT',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          service_enabled: serviceForm.service_enabled,
          donation_enabled: serviceForm.donation_enabled,
          pack_size: Number(serviceForm.pack_size || 7),
          print_price_cents: centsFromInput(serviceForm.print_price),
          pack_price_cents: centsFromInput(serviceForm.pack_price),
          pix_key: serviceForm.pix_key,
          pix_holder: serviceForm.pix_holder,
          donation_message: serviceForm.donation_message,
          pickup_note: serviceForm.pickup_note
        })
      })
      setMessage('Configuracoes de impressao atualizadas.')
      await fetchServiceConfig()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingService(false)
    }
  }

  async function handlePdfUpload(event) {
    const file = event.target.files?.[0]
    if (!file || !selectedCollectionId) return
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      await apiFetch(`/admin/collections/${selectedCollectionId}/upload-pdf`, {
        method: 'POST',
        headers: buildAdminHeaders(token),
        body: formData
      })
      setMessage('PDF enviado e paginas renderizadas.')
      await fetchCollections(selectedCollectionId)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function handleAutoDetect(scope) {
    if (!selectedCollectionId) return
    if (scope === 'current' && !currentPageId) return
    setProcessingAuto(true)
    setError('')
    setMessage('')
    try {
      const params = new URLSearchParams()
      params.set('replace_existing', 'true')
      if (scope === 'current') {
        params.set('page_id', String(currentPageId))
      }
      const data = await apiFetch(`/admin/collections/${selectedCollectionId}/auto-detect?${params.toString()}`, {
        method: 'POST',
        headers: buildAdminHeaders(token)
      })
      const pageSummary = data.page_results.map(result => `P${result.page_number}: ${result.detected_count}`).join(' | ')
      setMessage(
        data.detected_count > 0
          ? `Automacao gerou ${data.detected_count} recortes. ${pageSummary}`
          : 'A automacao nao encontrou uma grade compativel nessa selecao.'
      )
      await fetchCollections(selectedCollectionId)
      if (scope === 'current' && currentPageId) {
        setCurrentPageId(currentPageId)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setProcessingAuto(false)
    }
  }

  function handleImagePointerDown(event) {
    if (!currentPage) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const startX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width)
    const startY = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height)
    setDragState({ startX, startY, width: bounds.width, height: bounds.height })
    setSelectionRect({ left: startX, top: startY, width: 0, height: 0 })
  }

  function handleImagePointerMove(event) {
    if (!dragState) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const currentX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width)
    const currentY = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height)
    const left = Math.min(dragState.startX, currentX)
    const top = Math.min(dragState.startY, currentY)
    const width = Math.abs(currentX - dragState.startX)
    const height = Math.abs(currentY - dragState.startY)
    setSelectionRect({ left, top, width, height })
  }

  function finalizeSelection() {
    if (!dragState || !selectionRect || selectionRect.width < 12 || selectionRect.height < 12) {
      setDragState(null)
      setSelectionRect(null)
      return
    }
    const xRatio = selectionRect.left / dragState.width
    const yRatio = selectionRect.top / dragState.height
    const widthRatio = selectionRect.width / dragState.width
    const heightRatio = selectionRect.height / dragState.height
    setDraftRect({ xRatio, yRatio, widthRatio, heightRatio })
    setStickerForm(current => ({
      ...current,
      x_ratio: xRatio.toFixed(6),
      y_ratio: yRatio.toFixed(6),
      width_ratio: widthRatio.toFixed(6),
      height_ratio: heightRatio.toFixed(6)
    }))
    setDragState(null)
    setSelectionRect(null)
  }

  function loadStickerForEdit(sticker) {
    setEditingStickerId(sticker.id)
    setCurrentPageId(sticker.page_id)
    setStickerForm({
      name: sticker.name,
      code: sticker.code || '',
      category: sticker.category,
      sort_order: sticker.sort_order,
      x_ratio: String(sticker.x_ratio),
      y_ratio: String(sticker.y_ratio),
      width_ratio: String(sticker.width_ratio),
      height_ratio: String(sticker.height_ratio),
      active: sticker.active
    })
    setDraftRect({
      xRatio: sticker.x_ratio,
      yRatio: sticker.y_ratio,
      widthRatio: sticker.width_ratio,
      heightRatio: sticker.height_ratio
    })
  }

  function applyOcrSuggestion() {
    if (!editingSticker?.ocr_name_suggested) return
    setStickerForm(current => ({ ...current, name: editingSticker.ocr_name_suggested }))
  }

  async function handleStickerSubmit(event) {
    event.preventDefault()
    if (!selectedCollectionId || !currentPageId) return
    setError('')
    setMessage('')
    const payload = {
      collection_id: selectedCollectionId,
      page_id: currentPageId,
      name: stickerForm.name,
      code: stickerForm.code || null,
      category: stickerForm.category,
      sort_order: Number(stickerForm.sort_order || 0),
      x_ratio: Number(stickerForm.x_ratio),
      y_ratio: Number(stickerForm.y_ratio),
      width_ratio: Number(stickerForm.width_ratio),
      height_ratio: Number(stickerForm.height_ratio),
      active: stickerForm.active
    }

    try {
      const endpoint = editingStickerId ? `/admin/stickers/${editingStickerId}` : '/admin/stickers'
      const method = editingStickerId ? 'PUT' : 'POST'
      await apiFetch(endpoint, {
        method,
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(editingStickerId ? { ...payload, collection_id: undefined } : payload)
      })
      setMessage(editingStickerId ? 'Figurinha atualizada.' : 'Figurinha cadastrada.')
      await fetchCollections(selectedCollectionId)
      resetStickerForm()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteSticker(stickerId) {
    if (!window.confirm('Excluir essa figurinha?')) return
    setError('')
    setMessage('')
    try {
      await apiFetch(`/admin/stickers/${stickerId}`, {
        method: 'DELETE',
        headers: buildAdminHeaders(token)
      })
      setMessage('Figurinha excluida.')
      await fetchCollections(selectedCollectionId)
      if (editingStickerId === stickerId) {
        resetStickerForm()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handlePublish(status) {
    if (!selectedCollectionId) return
    setError('')
    setMessage('')
    try {
      await apiFetch(`/admin/collections/${selectedCollectionId}/publish`, {
        method: 'POST',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status })
      })
      setMessage(status === 'PUBLICADA' ? 'Colecao publicada.' : 'Colecao movida para rascunho.')
      await fetchCollections(selectedCollectionId)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUpdateOrder(event) {
    event.preventDefault()
    if (!selectedOrderId) return
    setSavingOrder(true)
    setError('')
    setMessage('')
    try {
      await apiFetch(`/admin/orders/${selectedOrderId}`, {
        method: 'PUT',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(orderAdminForm)
      })
      setMessage('Pedido atualizado.')
      await fetchOrders(selectedOrderId)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingOrder(false)
    }
  }

  async function handleDownloadOrder(order) {
    try {
      const blob = await apiFetch(order.export_download_path, {
        headers: buildAdminHeaders(token)
      })
      downloadBlob(blob, `${order.reference_code}.pdf`)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!token) {
    return (
      <section className="fig-auth-panel">
        <form className="fig-form-card" onSubmit={handleLogin}>
          <p className="fig-kicker">Admin</p>
          <h2>Acesso de gestao</h2>
          <p>Use a senha compartilhada desse miniapp para gerenciar as colecoes e pedidos.</p>
          <label className="fig-field">
            <span>Senha</span>
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} />
          </label>
          {authError ? <p className="fig-error-banner">{authError}</p> : null}
          <button type="submit" className="fig-primary-button">
            Entrar
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="fig-admin-layout">
      <aside className="fig-sidebar-panel">
        <div className="fig-panel-header">
          <p className="fig-kicker">Albuns</p>
          <h2>Estrutura</h2>
        </div>
        <div className="fig-collection-list">
          {albums.map(album => (
            <button
              key={album.id}
              type="button"
              className={`fig-collection-button${album.id === selectedAlbumId ? ' is-active' : ''}`}
              onClick={() => {
                setSelectedAlbumId(album.id)
                setCreateForm(current => ({ ...current, album_id: String(album.id) }))
                setCurrentPageId(null)
                resetStickerForm()
                setAdminView('structure')
              }}
            >
              <strong>{album.name}</strong>
              <span>
                Ordem {album.sort_order} · {album.collection_count} colecoes · {album.published_collection_count} publicadas
              </span>
            </button>
          ))}
        </div>

        <div className="fig-panel-header fig-admin-section-head">
          <p className="fig-kicker">Colecoes</p>
          <h3>{selectedAlbum?.name || 'Escolha um album'}</h3>
        </div>
        <div className="fig-collection-list">
          {filteredCollections.map(collection => (
            <button
              key={collection.id}
              type="button"
              className={`fig-collection-button${collection.id === selectedCollectionId ? ' is-active' : ''}`}
              onClick={() => {
                setSelectedCollectionId(collection.id)
                setCurrentPageId(null)
                resetStickerForm()
                setAdminView('collection')
              }}
            >
              <strong>{collection.name}</strong>
              <span>
                Ordem {collection.sort_order} · {collection.status === 'PUBLICADA' ? 'Publicada' : 'Rascunho'} ·{' '}
                {collection.sticker_count} figurinhas
              </span>
            </button>
          ))}
          {selectedAlbumId && filteredCollections.length === 0 ? (
            <p className="fig-empty-note">Nenhuma colecao cadastrada nesse album ainda.</p>
          ) : null}
        </div>
      </aside>

      <div className="fig-content-panel fig-admin-content">
        <div className="fig-admin-header">
          <div>
            <p className="fig-kicker">Gestao</p>
            <h2>{selectedCollection?.name || selectedAlbum?.name || 'Selecione um album'}</h2>
            <p>Organize a estrutura do album, o atendimento local e o mapeamento sem abrir tudo ao mesmo tempo.</p>
          </div>
          <div className="fig-hero-actions">
            <button type="button" className="fig-secondary-button" onClick={() => setToken('')}>
              Sair
            </button>
          </div>
        </div>

        <div className="fig-admin-section-tabs">
          <button
            type="button"
            className={`fig-admin-section-tab${adminView === 'structure' ? ' is-active' : ''}`}
            onClick={() => setAdminView('structure')}
          >
            Estrutura
          </button>
          <button
            type="button"
            className={`fig-admin-section-tab${adminView === 'atendimento' ? ' is-active' : ''}`}
            onClick={() => setAdminView('atendimento')}
          >
            Atendimento
          </button>
          <button
            type="button"
            className={`fig-admin-section-tab${adminView === 'collection' ? ' is-active' : ''}`}
            onClick={() => selectedCollection && setAdminView('collection')}
            disabled={!selectedCollection}
          >
            Colecao
          </button>
          <button
            type="button"
            className={`fig-admin-section-tab${adminView === 'mapping' ? ' is-active' : ''}`}
            onClick={() => selectedCollection && setAdminView('mapping')}
            disabled={!selectedCollection}
          >
            Mapeamento
          </button>
        </div>

        {message ? <p className="fig-success-banner">{message}</p> : null}
        {error ? <p className="fig-error-banner">{error}</p> : null}
        {loading ? <p className="fig-empty-note">Carregando dados da colecao...</p> : null}

        {adminView === 'structure' ? (
          <section className="fig-admin-panel-grid">
            <form
              className="fig-form-card"
              onSubmit={albumStructureMode === 'create' ? handleCreateAlbum : handleUpdateAlbum}
            >
              <div className="fig-panel-header">
                <p className="fig-kicker">Album</p>
                <h3>{albumStructureMode === 'create' ? 'Criar novo album' : 'Editar album selecionado'}</h3>
              </div>
              <p className="fig-empty-note">
                {albumStructureMode === 'create'
                  ? 'Crie uma nova edicao principal para agrupar selecoes.'
                  : 'Use a lateral para escolher o album e ajustar nome, slug e ordem.'}
              </p>
              <div className="fig-form-grid">
                <label className="fig-field">
                  <span>Nome</span>
                  <input
                    value={albumStructureMode === 'create' ? albumForm.name : selectedAlbumForm.name}
                    onChange={event =>
                      albumStructureMode === 'create'
                        ? setAlbumForm(current => ({ ...current, name: event.target.value }))
                        : setSelectedAlbumForm(current => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Copa 2026"
                  />
                </label>
                <label className="fig-field">
                  <span>Slug</span>
                  <input
                    value={albumStructureMode === 'create' ? albumForm.slug : selectedAlbumForm.slug}
                    onChange={event =>
                      albumStructureMode === 'create'
                        ? setAlbumForm(current => ({ ...current, slug: event.target.value }))
                        : setSelectedAlbumForm(current => ({ ...current, slug: event.target.value }))
                    }
                    placeholder="copa-2026"
                  />
                </label>
                <label className="fig-field">
                  <span>Ordem na barra lateral</span>
                  <input
                    type="number"
                    min="0"
                    value={albumStructureMode === 'create' ? albumForm.sort_order : selectedAlbumForm.sort_order}
                    onChange={event =>
                      albumStructureMode === 'create'
                        ? setAlbumForm(current => ({ ...current, sort_order: event.target.value }))
                        : setSelectedAlbumForm(current => ({ ...current, sort_order: event.target.value }))
                    }
                    placeholder="0"
                  />
                </label>
                <label className="fig-field fig-field--full">
                  <span>Descricao</span>
                  <textarea
                    value={albumStructureMode === 'create' ? albumForm.description : selectedAlbumForm.description}
                    onChange={event =>
                      albumStructureMode === 'create'
                        ? setAlbumForm(current => ({ ...current, description: event.target.value }))
                        : setSelectedAlbumForm(current => ({ ...current, description: event.target.value }))
                    }
                    rows="3"
                    placeholder="Edicao principal para agrupar as selecoes."
                  />
                </label>
              </div>
              <div className="fig-hero-actions">
                <button type="button" className="fig-secondary-button" onClick={handleStartCreateAlbum}>
                  Novo album
                </button>
                {albumStructureMode === 'create' ? (
                  <button type="button" className="fig-secondary-button" onClick={() => setAlbumStructureMode('edit')}>
                    Voltar para edicao
                  </button>
                ) : null}
                <button
                  type="submit"
                  className="fig-primary-button"
                  disabled={albumStructureMode === 'create' ? savingAlbum : savingAlbumEdit || !selectedAlbum}
                >
                  {albumStructureMode === 'create'
                    ? savingAlbum
                      ? 'Salvando...'
                      : 'Criar album'
                    : savingAlbumEdit
                      ? 'Salvando...'
                      : 'Salvar album'}
                </button>
              </div>
            </form>

            <form
              className="fig-form-card"
              onSubmit={collectionStructureMode === 'create' ? handleCreateCollection : handleUpdateCollection}
            >
              <div className="fig-panel-header">
                <p className="fig-kicker">Selecao</p>
                <h3>{collectionStructureMode === 'create' ? 'Criar nova selecao' : 'Editar selecao selecionada'}</h3>
              </div>
              <p className="fig-empty-note">
                {collectionStructureMode === 'create'
                  ? 'A nova selecao ja nasce dentro do album escolhido.'
                  : 'Aqui voce pode corrigir nome, slug e ordem da selecao.'}
              </p>
              <div className="fig-form-grid">
                <label className="fig-field">
                  <span>Album</span>
                  <select
                    value={collectionStructureMode === 'create' ? createForm.album_id : collectionAlbumTargetId}
                    onChange={event =>
                      collectionStructureMode === 'create'
                        ? setCreateForm(current => ({ ...current, album_id: event.target.value }))
                        : setCollectionAlbumTargetId(event.target.value)
                    }
                  >
                    <option value="">Selecione</option>
                    {albums.map(album => (
                      <option key={album.id} value={album.id}>
                        {album.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fig-field">
                  <span>Nome</span>
                  <input
                    value={collectionStructureMode === 'create' ? createForm.name : selectedCollectionForm.name}
                    onChange={event =>
                      collectionStructureMode === 'create'
                        ? setCreateForm(current => ({ ...current, name: event.target.value }))
                        : setSelectedCollectionForm(current => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Brasil"
                  />
                </label>
                <label className="fig-field">
                  <span>Slug</span>
                  <input
                    value={collectionStructureMode === 'create' ? createForm.slug : selectedCollectionForm.slug}
                    onChange={event =>
                      collectionStructureMode === 'create'
                        ? setCreateForm(current => ({ ...current, slug: event.target.value }))
                        : setSelectedCollectionForm(current => ({ ...current, slug: event.target.value }))
                    }
                    placeholder="brasil"
                  />
                </label>
                <label className="fig-field">
                  <span>Ordem na barra lateral</span>
                  <input
                    type="number"
                    min="0"
                    value={collectionStructureMode === 'create' ? createForm.sort_order : selectedCollectionForm.sort_order}
                    onChange={event =>
                      collectionStructureMode === 'create'
                        ? setCreateForm(current => ({ ...current, sort_order: event.target.value }))
                        : setSelectedCollectionForm(current => ({ ...current, sort_order: event.target.value }))
                    }
                    placeholder="0"
                  />
                </label>
                <label className="fig-field fig-field--full">
                  <span>Descricao</span>
                  <textarea
                    value={collectionStructureMode === 'create' ? createForm.description : selectedCollectionForm.description}
                    onChange={event =>
                      collectionStructureMode === 'create'
                        ? setCreateForm(current => ({ ...current, description: event.target.value }))
                        : setSelectedCollectionForm(current => ({ ...current, description: event.target.value }))
                    }
                    rows="3"
                    placeholder="Selecao publicada dentro do album."
                  />
                </label>
              </div>
              <div className="fig-hero-actions">
                {collectionStructureMode === 'edit' ? (
                  <button
                    type="button"
                    className="fig-secondary-button"
                    disabled={!collectionAlbumTargetId || Number(collectionAlbumTargetId) === selectedCollection?.album_id}
                    onClick={handleAssignCollectionAlbum}
                  >
                    Salvar album
                  </button>
                ) : null}
                <button type="button" className="fig-secondary-button" onClick={handleStartCreateCollection}>
                  Nova selecao
                </button>
                {collectionStructureMode === 'create' ? (
                  <button
                    type="button"
                    className="fig-secondary-button"
                    onClick={() => setCollectionStructureMode('edit')}
                  >
                    Voltar para edicao
                  </button>
                ) : null}
                <button
                  type="submit"
                  className="fig-primary-button"
                  disabled={
                    collectionStructureMode === 'create'
                      ? savingCollection || !createForm.album_id
                      : savingCollectionEdit || !selectedCollection
                  }
                >
                  {collectionStructureMode === 'create'
                    ? savingCollection
                      ? 'Salvando...'
                      : 'Criar colecao'
                    : savingCollectionEdit
                      ? 'Salvando...'
                      : 'Salvar colecao'}
                </button>
              </div>
              {collectionStructureMode === 'edit' && !selectedCollection ? (
                <p className="fig-empty-note">Escolha uma colecao na lateral para editar nome, slug e ordem.</p>
              ) : null}
              {albumStructureMode === 'edit' && !selectedAlbum ? (
                <p className="fig-empty-note">Escolha um album na lateral para editar nome, slug e ordem.</p>
              ) : null}
            </form>

            <form className="fig-form-card">
              <div className="fig-panel-header">
                <p className="fig-kicker">Como usar</p>
                <h3>Fluxo mais simples</h3>
              </div>
              <div className="fig-helper-strip fig-helper-strip--compact">
                <div>
                  <strong>1.</strong>
                  <span>Escolha o album na lateral.</span>
                </div>
              </div>
              <div className="fig-helper-strip fig-helper-strip--compact">
                <div>
                  <strong>2.</strong>
                  <span>Escolha a selecao na lateral para corrigir nome, slug e ordem.</span>
                </div>
              </div>
              <div className="fig-helper-strip fig-helper-strip--compact">
                <div>
                  <strong>3.</strong>
                  <span>Use os botoes `Novo album` ou `Nova selecao` quando quiser cadastrar mais itens.</span>
                </div>
              </div>
              <div className="fig-helper-strip fig-helper-strip--compact">
                <div>
                  <strong>4.</strong>
                  <span>Quanto menor a ordem, mais acima ele aparece na barra lateral publica.</span>
                </div>
              </div>
              <p className="fig-empty-note">Exemplo: Brasil = 1, Alemanha = 2, Argentina = 3.</p>
            </form>
          </section>
        ) : null}

        {adminView === 'atendimento' ? (
        <section className="fig-admin-summary-grid">
            <form className="fig-form-card" onSubmit={handleSaveServiceConfig}>
              <div className="fig-panel-header">
                <p className="fig-kicker">Configuracao publica</p>
                <h3>Doacao e servico manual</h3>
              </div>

              <label className="fig-checkbox">
                <input
                  type="checkbox"
                  checked={serviceForm.donation_enabled}
                  onChange={event => setServiceForm(current => ({ ...current, donation_enabled: event.target.checked }))}
                />
                <span>Mostrar apoio opcional via Pix apos gerar o PDF gratis</span>
              </label>

              <label className="fig-checkbox">
                <input
                  type="checkbox"
                  checked={serviceForm.service_enabled}
                  onChange={event => setServiceForm(current => ({ ...current, service_enabled: event.target.checked }))}
                />
                <span>Ativar pedidos manuais de impressao e montagem</span>
              </label>

              <div className="fig-form-grid">
                <label className="fig-field fig-field--full">
                  <span>Mensagem do modal de apoio</span>
                  <textarea
                    value={serviceForm.donation_message}
                    onChange={event => setServiceForm(current => ({ ...current, donation_message: event.target.value }))}
                    rows="3"
                    placeholder="Se este material te ajudou, voce pode apoiar o projeto com uma doacao via Pix. O download continua gratuito."
                  />
                </label>
                <label className="fig-field">
                  <span>Figurinhas em cada pacotinho</span>
                  <input
                  type="number"
                  min="1"
                  value={serviceForm.pack_size}
                  onChange={event => setServiceForm(current => ({ ...current, pack_size: event.target.value }))}
                />
              </label>
              <label className="fig-field">
                <span>Preco por folha (R$)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={serviceForm.print_price}
                  onChange={event => setServiceForm(current => ({ ...current, print_price: event.target.value }))}
                />
              </label>
              <label className="fig-field">
                <span>Preco da montagem por pacotinho (R$)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={serviceForm.pack_price}
                  onChange={event => setServiceForm(current => ({ ...current, pack_price: event.target.value }))}
                />
              </label>
              <label className="fig-field">
                <span>Chave Pix</span>
                <input
                  value={serviceForm.pix_key}
                  onChange={event => setServiceForm(current => ({ ...current, pix_key: event.target.value }))}
                />
              </label>
              <label className="fig-field">
                <span>Nome do recebedor</span>
                <input
                  value={serviceForm.pix_holder}
                  onChange={event => setServiceForm(current => ({ ...current, pix_holder: event.target.value }))}
                />
              </label>
                <label className="fig-field">
                  <span>Observacao do servico manual</span>
                  <input
                    value={serviceForm.pickup_note}
                    onChange={event => setServiceForm(current => ({ ...current, pickup_note: event.target.value }))}
                  />
              </label>
            </div>

            <div className="fig-hero-actions">
              <button type="submit" className="fig-primary-button" disabled={savingService}>
                {savingService ? 'Salvando...' : 'Salvar configuracoes'}
              </button>
            </div>
          </form>

          <section className="fig-form-card">
            <div className="fig-panel-header">
              <p className="fig-kicker">Pedidos</p>
              <h3>Retirada local</h3>
            </div>

            <div className="fig-order-layout">
              <div className="fig-order-list">
                {orders.map(order => (
                  <button
                    key={order.id}
                    type="button"
                    className={`fig-order-list-item${order.id === selectedOrderId ? ' is-active' : ''}`}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <strong>{order.reference_code}</strong>
                    <span>{order.customer_name}</span>
                    <span>{serviceTypeLabels[order.service_type]}</span>
                    <span>
                      {formatCurrency(order.total_price_cents)} · {orderStatusLabels[order.status]}
                    </span>
                  </button>
                ))}
                {orders.length === 0 ? <p className="fig-empty-note">Nenhum pedido criado ainda.</p> : null}
              </div>

              {selectedOrder ? (
                <div className="fig-order-detail">
                  <div className="fig-inline-meta">
                    <strong>{selectedOrder.customer_name}</strong>
                    <span>{selectedOrder.customer_whatsapp}</span>
                  </div>
                  <div className="fig-inline-meta">
                    <strong>{serviceTypeLabels[selectedOrder.service_type]}</strong>
                    <span>
                      {selectedOrder.item_count} figurinhas · {selectedOrder.sheet_count} folha(s)
                    </span>
                  </div>
                  {selectedOrder.pack_count > 0 ? (
                    <div className="fig-inline-meta">
                      <strong>{selectedOrder.pack_count} pacotinho(s)</strong>
                      <span>{selectedOrder.pack_size} figurinhas em cada pacotinho</span>
                    </div>
                  ) : null}
                  {selectedOrder.notes ? (
                    <div className="fig-inline-meta">
                      <strong>Observacao do cliente</strong>
                      <span>{selectedOrder.notes}</span>
                    </div>
                  ) : null}

                  <form className="fig-order-admin-form" onSubmit={handleUpdateOrder}>
                    <label className="fig-field">
                      <span>Status</span>
                      <select
                        value={orderAdminForm.status}
                        onChange={event => setOrderAdminForm(current => ({ ...current, status: event.target.value }))}
                      >
                        {Object.entries(orderStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fig-field">
                      <span>Notas internas</span>
                      <textarea
                        rows="4"
                        value={orderAdminForm.admin_notes}
                        onChange={event => setOrderAdminForm(current => ({ ...current, admin_notes: event.target.value }))}
                      />
                    </label>
                    <div className="fig-hero-actions">
                      <button type="button" className="fig-secondary-button" onClick={() => handleDownloadOrder(selectedOrder)}>
                        Baixar PDF do pedido
                      </button>
                      <button type="submit" className="fig-primary-button" disabled={savingOrder}>
                        {savingOrder ? 'Salvando...' : 'Atualizar pedido'}
                      </button>
                    </div>
                  </form>

                  <div className="fig-selected-stickers">
                    {selectedOrder.selected_stickers.map(sticker => (
                      <span key={`${selectedOrder.id}-${sticker.id}`} className="fig-selection-chip">
                        {sticker.collection_name} · {sticker.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </section>
        ) : null}

        {selectedCollection && (adminView === 'collection' || adminView === 'mapping') ? (
          <>
            <div className="fig-admin-header fig-admin-section-head">
              <div>
                <p className="fig-kicker">Gestao da colecao</p>
                <h3>{selectedCollection.name}</h3>
                <p>
                  Album atual: <strong>{selectedCollection.album_name || 'Sem album'}</strong>. Suba o PDF, mapeie as
                  areas de corte e publique quando o catalogo estiver pronto.
                </p>
              </div>
              <div className="fig-hero-actions">
                <label className="fig-field fig-field--compact">
                  <span>Mover para album</span>
                  <select
                    value={collectionAlbumTargetId}
                    onChange={event => setCollectionAlbumTargetId(event.target.value)}
                  >
                    {albums.map(album => (
                      <option key={album.id} value={album.id}>
                        {album.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="fig-secondary-button"
                  disabled={!collectionAlbumTargetId || Number(collectionAlbumTargetId) === selectedCollection.album_id}
                  onClick={handleAssignCollectionAlbum}
                >
                  Salvar album
                </button>
                <button type="button" className="fig-secondary-button" onClick={() => handlePublish('RASCUNHO')}>
                  Voltar para rascunho
                </button>
                <button type="button" className="fig-primary-button" onClick={() => handlePublish('PUBLICADA')}>
                  Publicar colecao
                </button>
              </div>
            </div>

            <div className="fig-toolbar">
              <label className="fig-field">
                <span>PDF original</span>
                <input type="file" accept="application/pdf" onChange={handlePdfUpload} disabled={uploading} />
              </label>
              <div className="fig-inline-meta">
                <strong>Status</strong>
                <span>{selectedCollection.status === 'PUBLICADA' ? 'Publicado' : 'Rascunho'}</span>
              </div>
              <div className="fig-inline-meta">
                <strong>Paginas</strong>
                <span>{selectedCollection.page_count}</span>
              </div>
              <div className="fig-inline-meta">
                <strong>Figurinhas</strong>
                <span>{selectedCollection.sticker_count}</span>
              </div>
            </div>

            <div className="fig-auto-actions">
              <div className="fig-helper-strip">
                A automacao usa o layout padrao do PDF para criar recortes, tenta sugerir nomes com OCR e deixa a
                revisao final mais leve.
              </div>
              <div className="fig-hero-actions">
                <button
                  type="button"
                  className="fig-secondary-button"
                  disabled={!currentPageId || processingAuto}
                  onClick={() => handleAutoDetect('current')}
                >
                  {processingAuto ? 'Processando...' : 'Processar pagina atual'}
                </button>
                <button
                  type="button"
                  className="fig-primary-button"
                  disabled={pages.length === 0 || processingAuto}
                  onClick={() => handleAutoDetect('all')}
                >
                  {processingAuto ? 'Processando...' : 'Processar todas as paginas'}
                </button>
              </div>
            </div>

            {adminView === 'mapping' ? (
            <div className="fig-admin-workspace">
              <section className="fig-page-panel">
                <div className="fig-page-selector">
                  {pages.map(page => (
                    <button
                      key={page.id}
                      type="button"
                      className={`fig-page-tab${page.id === currentPageId ? ' is-active' : ''}`}
                      onClick={() => {
                        setCurrentPageId(page.id)
                        resetStickerForm()
                      }}
                    >
                      Pagina {page.page_number}
                    </button>
                  ))}
                </div>

                {currentPage ? (
                  <div className="fig-page-image-shell">
                    <div
                      className="fig-page-image-frame"
                      onPointerDown={handleImagePointerDown}
                      onPointerMove={handleImagePointerMove}
                      onPointerUp={finalizeSelection}
                      onPointerLeave={() => {
                        if (dragState) finalizeSelection()
                      }}
                    >
                      <img src={apiFileUrl(currentPage.image_path)} alt={`Pagina ${currentPage.page_number}`} />
                      {currentPageStickers.map(sticker => (
                        <div
                          key={sticker.id}
                          className={`fig-sticker-overlay${editingStickerId === sticker.id ? ' is-editing' : ''}`}
                          style={{
                            left: `${sticker.x_ratio * 100}%`,
                            top: `${sticker.y_ratio * 100}%`,
                            width: `${sticker.width_ratio * 100}%`,
                            height: `${sticker.height_ratio * 100}%`
                          }}
                          title={sticker.name}
                        />
                      ))}
                      {selectionRect ? (
                        <div
                          className="fig-sticker-overlay is-drafting"
                          style={{
                            left: `${selectionRect.left}px`,
                            top: `${selectionRect.top}px`,
                            width: `${selectionRect.width}px`,
                            height: `${selectionRect.height}px`
                          }}
                        />
                      ) : null}
                      {draftRect ? (
                        <div
                          className="fig-sticker-overlay is-preview"
                          style={{
                            left: `${draftRect.xRatio * 100}%`,
                            top: `${draftRect.yRatio * 100}%`,
                            width: `${draftRect.widthRatio * 100}%`,
                            height: `${draftRect.heightRatio * 100}%`
                          }}
                        />
                      ) : null}
                    </div>
                    <p className="fig-helper-text">Clique e arraste sobre a pagina para desenhar a area da figurinha.</p>
                  </div>
                ) : (
                  <p className="fig-empty-note">Suba um PDF para comecar a mapear as paginas.</p>
                )}
              </section>

              <section className="fig-form-card fig-mapper-form">
                <div className="fig-panel-header">
                  <p className="fig-kicker">Recorte atual</p>
                  <h3>{editingStickerId ? 'Editar figurinha' : 'Nova figurinha'}</h3>
                </div>

                {editingSticker ? (
                  <div className="fig-helper-strip fig-helper-strip--compact">
                    <div>
                      <strong>{editingSticker.detected_automatically ? 'Recorte automatico.' : 'Recorte manual.'}</strong>
                      <span>
                        {editingSticker.ocr_name_suggested
                          ? ` OCR sugeriu ${editingSticker.ocr_name_suggested} (${formatOcrConfidence(editingSticker.ocr_confidence)}).`
                          : ' OCR ainda nao encontrou um nome confiavel.'}
                      </span>
                    </div>
                    {editingSticker.ocr_name_suggested && editingSticker.ocr_name_suggested !== stickerForm.name ? (
                      <button type="button" className="fig-inline-link" onClick={applyOcrSuggestion}>
                        Usar sugestao
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <form onSubmit={handleStickerSubmit}>
                  <div className="fig-form-grid">
                    <label className="fig-field">
                      <span>Nome</span>
                      <input value={stickerForm.name} onChange={event => setStickerForm(current => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label className="fig-field">
                      <span>Codigo</span>
                      <input value={stickerForm.code} onChange={event => setStickerForm(current => ({ ...current, code: event.target.value }))} />
                    </label>
                    <label className="fig-field">
                      <span>Categoria</span>
                      <select value={stickerForm.category} onChange={event => setStickerForm(current => ({ ...current, category: event.target.value }))}>
                        {categoryOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fig-field">
                      <span>Ordem</span>
                      <input
                        type="number"
                        min="0"
                        value={stickerForm.sort_order}
                        onChange={event => setStickerForm(current => ({ ...current, sort_order: event.target.value }))}
                      />
                    </label>
                    <label className="fig-field">
                      <span>X</span>
                      <input value={stickerForm.x_ratio} onChange={event => setStickerForm(current => ({ ...current, x_ratio: event.target.value }))} />
                    </label>
                    <label className="fig-field">
                      <span>Y</span>
                      <input value={stickerForm.y_ratio} onChange={event => setStickerForm(current => ({ ...current, y_ratio: event.target.value }))} />
                    </label>
                    <label className="fig-field">
                      <span>Largura</span>
                      <input value={stickerForm.width_ratio} onChange={event => setStickerForm(current => ({ ...current, width_ratio: event.target.value }))} />
                    </label>
                    <label className="fig-field">
                      <span>Altura</span>
                      <input value={stickerForm.height_ratio} onChange={event => setStickerForm(current => ({ ...current, height_ratio: event.target.value }))} />
                    </label>
                  </div>

                  <label className="fig-checkbox">
                    <input
                      type="checkbox"
                      checked={stickerForm.active}
                      onChange={event => setStickerForm(current => ({ ...current, active: event.target.checked }))}
                    />
                    <span>Ativa na vitrine publica</span>
                  </label>

                  <div className="fig-hero-actions">
                    <button type="button" className="fig-secondary-button" onClick={resetStickerForm}>
                      Limpar formulario
                    </button>
                    {editingStickerId ? (
                      <button type="button" className="fig-secondary-button" onClick={() => handleDeleteSticker(editingStickerId)}>
                        Excluir
                      </button>
                    ) : null}
                    <button type="submit" className="fig-primary-button" disabled={!currentPageId}>
                      {editingStickerId ? 'Atualizar figurinha' : 'Salvar figurinha'}
                    </button>
                  </div>
                </form>

                <div className="fig-sticker-list">
                  {stickers.map(sticker => (
                    <button key={sticker.id} type="button" className="fig-sticker-list-item" onClick={() => loadStickerForEdit(sticker)}>
                      <img src={apiFileUrl(sticker.preview_path)} alt={sticker.name} />
                      <div>
                        <strong>{sticker.name}</strong>
                        <span>
                          Pagina {sticker.page_number} · {categoryLabel(sticker.category)}
                        </span>
                        <span className="fig-ocr-note">
                          {sticker.detected_automatically ? 'Auto' : 'Manual'}
                          {sticker.ocr_name_suggested
                            ? ` · OCR ${sticker.ocr_name_suggested} (${formatOcrConfidence(sticker.ocr_confidence)})`
                            : sticker.ocr_processed_at
                              ? ' · OCR sem leitura'
                              : ' · OCR pendente'}
                        </span>
                      </div>
                    </button>
                  ))}
                  {stickers.length === 0 ? <p className="fig-empty-note">Nenhuma figurinha cadastrada ainda.</p> : null}
                </div>
              </section>
            </div>
            ) : null}
          </>
        ) : null}
        {!selectedCollection && (adminView === 'collection' || adminView === 'mapping') ? (
          <section className="fig-form-card fig-admin-empty-state">
            <p className="fig-kicker">Colecao necessaria</p>
            <h3>Escolha uma colecao na lateral para continuar</h3>
            <p>Depois disso voce pode subir o PDF, publicar a selecao e fazer o mapeamento dos recortes.</p>
          </section>
        ) : null}
      </div>
    </section>
  )
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PublicPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Layout>
  )
}
