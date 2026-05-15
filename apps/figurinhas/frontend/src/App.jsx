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
  IMPRESSAO: 'So impressao',
  IMPRESSAO_PACOTINHOS: 'Impressao + pacotinhos'
}

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
  const [collections, setCollections] = useState([])
  const [selectedCollectionSlug, setSelectedCollectionSlug] = useState('')
  const [stickers, setStickers] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [serviceConfig, setServiceConfig] = useState(null)
  const [quote, setQuote] = useState(null)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderResult, setOrderResult] = useState(null)
  const [orderForm, setOrderForm] = useState({
    service_type: 'IMPRESSAO',
    customer_name: '',
    customer_whatsapp: '',
    customer_nickname: '',
    notes: ''
  })

  useEffect(() => {
    let ignore = false
    async function loadBootstrap() {
      setBusy(true)
      setError('')
      try {
        const [collectionsData, serviceData] = await Promise.all([
          apiFetch('/collections'),
          apiFetch('/service-config')
        ])
        if (ignore) return
        setCollections(collectionsData)
        setSelectedCollectionSlug(current => current || collectionsData[0]?.slug || '')
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
        setSelectedIds(current => current.filter(id => data.some(sticker => sticker.id === id)))
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
    if (!selectedCollectionSlug || selectedIds.length === 0) {
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
            collection_slug: selectedCollectionSlug,
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
  }, [selectedCollectionSlug, selectedIds])

  useEffect(() => {
    setOrderResult(null)
  }, [selectedCollectionSlug, selectedIds])

  useEffect(() => {
    if (quote && !quote.pack_eligible && orderForm.service_type === 'IMPRESSAO_PACOTINHOS') {
      setOrderForm(current => ({ ...current, service_type: 'IMPRESSAO' }))
    }
  }, [quote, orderForm.service_type])

  const selectedCollection = useMemo(
    () => collections.find(collection => collection.slug === selectedCollectionSlug) || null,
    [collections, selectedCollectionSlug]
  )

  function toggleSelection(stickerId) {
    setSelectedIds(current =>
      current.includes(stickerId) ? current.filter(id => id !== stickerId) : [...current, stickerId]
    )
  }

  async function handleExport() {
    if (!selectedCollectionSlug || selectedIds.length === 0) return
    setExporting(true)
    setError('')
    try {
      const data = await apiFetch('/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_slug: selectedCollectionSlug,
          sticker_ids: selectedIds
        })
      })
      window.location.href = `${apiBase}${data.download_path}`
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  async function handleCreateOrder(event) {
    event.preventDefault()
    if (!selectedCollectionSlug || selectedIds.length === 0) return
    setOrderSubmitting(true)
    setError('')
    try {
      const data = await apiFetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_slug: selectedCollectionSlug,
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
          <p className="fig-kicker">Colecoes publicadas</p>
          <h2>Escolha a base</h2>
        </div>
        <div className="fig-collection-list">
          {collections.map(collection => (
            <button
              key={collection.id}
              type="button"
              className={`fig-collection-button${collection.slug === selectedCollectionSlug ? ' is-active' : ''}`}
              onClick={() => {
                setSelectedCollectionSlug(collection.slug)
                setSelectedIds([])
              }}
            >
              <strong>{collection.name}</strong>
              <span>{collection.sticker_count} figurinhas</span>
            </button>
          ))}
          {!busy && collections.length === 0 ? <p className="fig-empty-note">Nenhuma colecao publicada ainda.</p> : null}
        </div>
      </aside>

      <div className="fig-content-panel">
        <div className="fig-hero">
          <div>
            <p className="fig-kicker">Selecao rapida</p>
            <h2>{selectedCollection?.name || 'Selecione uma colecao'}</h2>
            <p>{selectedCollection?.description || 'Marque os jogadores que voce precisa e gere seu PDF.'}</p>
          </div>
          <div className="fig-hero-actions">
            <button
              type="button"
              className="fig-secondary-button"
              onClick={() => setSelectedIds(stickers.map(sticker => sticker.id))}
            >
              Selecionar todas
            </button>
            <button type="button" className="fig-secondary-button" onClick={() => setSelectedIds([])}>
              Limpar selecao
            </button>
            <button
              type="button"
              className="fig-secondary-button"
              disabled={selectedIds.length === 0 || !(quote?.service_enabled ?? serviceConfig?.service_enabled)}
              onClick={() => setOrderFormOpen(current => !current)}
            >
              Pedir impressao
            </button>
            <button
              type="button"
              className="fig-primary-button"
              disabled={!selectedCollectionSlug || selectedIds.length === 0 || exporting}
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

        {quote ? (
          <section className="fig-service-card">
            <div className="fig-service-card-header">
              <div>
                <p className="fig-kicker">Servico opcional</p>
                <h3>Quer que eu imprima para voce?</h3>
              </div>
              <span className={`fig-service-badge${quote.service_enabled ? ' is-ready' : ''}`}>
                {quote.service_enabled ? 'Disponivel' : 'Em configuracao'}
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
                <span>so impressao</span>
              </div>
              <div className="fig-quote-item">
                <strong>{quote.pack_eligible ? formatCurrency(quote.pack_total_cents || 0) : '--'}</strong>
                <span>{quote.pack_eligible ? `${quote.pack_count} pacotinhos` : `pacotes de ${quote.pack_size}`}</span>
              </div>
            </div>

            <div className="fig-service-notes">
              <p>
                Impressao por folha: <strong>{formatCurrency(quote.print_price_cents)}</strong>
              </p>
              <p>
                Pacotinho de {quote.pack_size} figurinhas:{' '}
                <strong>{formatCurrency(quote.pack_price_cents)}</strong>
              </p>
              {!quote.pack_eligible ? (
                <p className="fig-warning-text">
                  Para montar pacotinhos, escolha {quote.pack_size}, {quote.pack_size * 2}, {quote.pack_size * 3}...
                  Sua selecao atual precisa de mais {quote.pack_size - quote.pack_remainder} figurinha(s).
                </p>
              ) : null}
              {quote.pickup_note ? <p>{quote.pickup_note}</p> : null}
            </div>
          </section>
        ) : null}

        {!quote && serviceConfig && !serviceConfig.service_enabled ? (
          <p className="fig-empty-note">O servico de impressao ainda nao foi ativado no momento.</p>
        ) : null}

        {orderFormOpen && quote ? (
          <form className="fig-form-card fig-order-form" onSubmit={handleCreateOrder}>
            <div className="fig-panel-header">
              <p className="fig-kicker">Pedido manual</p>
              <h3>Pedir impressao comigo</h3>
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
                  <strong>So impressao</strong>
                  <span>{quote.sheet_count} folha(s) · {formatCurrency(quote.print_total_cents)}</span>
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
                  <strong>Impressao + pacotinhos</strong>
                  <span>
                    {quote.pack_eligible
                      ? `${quote.pack_count} pacote(s) · ${formatCurrency(quote.pack_total_cents || 0)}`
                      : `Disponivel so em multiplos de ${quote.pack_size}`}
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
                <span>Apelido (opcional)</span>
                <input
                  value={orderForm.customer_nickname}
                  onChange={event => setOrderForm(current => ({ ...current, customer_nickname: event.target.value }))}
                />
              </label>
              <label className="fig-field">
                <span>Observacao (opcional)</span>
                <input
                  value={orderForm.notes}
                  onChange={event => setOrderForm(current => ({ ...current, notes: event.target.value }))}
                  placeholder="Ex.: separar por primo, sobrinho..."
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
        ) : null}

        {orderResult ? (
          <section className="fig-success-panel">
            <p className="fig-kicker">Pedido criado</p>
            <h3>{orderResult.reference_code}</h3>
            <div className="fig-quote-grid">
              <div className="fig-quote-item">
                <strong>{serviceTypeLabels[orderResult.service_type]}</strong>
                <span>tipo de servico</span>
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
        {quoteBusy && selectedIds.length > 0 ? <p className="fig-empty-note">Calculando folhas e servicos...</p> : null}

        <div className="fig-sticker-grid">
          {stickers.map(sticker => (
            <button
              key={sticker.id}
              type="button"
              className={`fig-sticker-card${selectedIds.includes(sticker.id) ? ' is-selected' : ''}`}
              onClick={() => toggleSelection(sticker.id)}
            >
              <img src={apiFileUrl(sticker.preview_path)} alt={sticker.name} />
              <div className="fig-sticker-card-body">
                <strong>{sticker.name}</strong>
                <span>{categoryLabel(sticker.category)}</span>
              </div>
            </button>
          ))}
        </div>
        {!busy && stickers.length === 0 ? <p className="fig-empty-note">Nenhuma figurinha encontrada para esse filtro.</p> : null}
      </div>
    </section>
  )
}

function AdminPage() {
  const [token, setToken] = useAdminToken()
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
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
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '' })
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
    pack_size: '7',
    print_price: '0.00',
    pack_price: '0.00',
    pix_key: '',
    pix_holder: '',
    pickup_note: ''
  })
  const [savingService, setSavingService] = useState(false)
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [orderAdminForm, setOrderAdminForm] = useState({
    status: 'AGUARDANDO_PIX',
    admin_notes: ''
  })
  const [savingOrder, setSavingOrder] = useState(false)

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

  async function fetchServiceConfig() {
    if (!token) return
    const data = await apiFetch('/admin/service-config', {
      headers: buildAdminHeaders(token)
    })
    setServiceForm({
      service_enabled: data.service_enabled,
      pack_size: String(data.pack_size),
      print_price: moneyInputFromCents(data.print_price_cents),
      pack_price: moneyInputFromCents(data.pack_price_cents),
      pix_key: data.pix_key || '',
      pix_holder: data.pix_holder || '',
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
        await Promise.all([fetchCollections(), fetchServiceConfig(), fetchOrders()])
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

  async function handleCreateCollection(event) {
    event.preventDefault()
    setSavingCollection(true)
    setError('')
    setMessage('')
    try {
      const created = await apiFetch('/admin/collections', {
        method: 'POST',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(createForm)
      })
      setCreateForm({ name: '', slug: '', description: '' })
      setMessage('Colecao criada.')
      await fetchCollections(created.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingCollection(false)
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
          pack_size: Number(serviceForm.pack_size || 7),
          print_price_cents: centsFromInput(serviceForm.print_price),
          pack_price_cents: centsFromInput(serviceForm.pack_price),
          pix_key: serviceForm.pix_key,
          pix_holder: serviceForm.pix_holder,
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
          <p className="fig-kicker">Colecoes</p>
          <h2>Catalogo</h2>
        </div>

        <form className="fig-form-card fig-compact-form" onSubmit={handleCreateCollection}>
          <label className="fig-field">
            <span>Nome</span>
            <input
              value={createForm.name}
              onChange={event => setCreateForm(current => ({ ...current, name: event.target.value }))}
              placeholder="Brasil 2026"
            />
          </label>
          <label className="fig-field">
            <span>Slug</span>
            <input
              value={createForm.slug}
              onChange={event => setCreateForm(current => ({ ...current, slug: event.target.value }))}
              placeholder="brasil-2026"
            />
          </label>
          <label className="fig-field">
            <span>Descricao</span>
            <textarea
              value={createForm.description}
              onChange={event => setCreateForm(current => ({ ...current, description: event.target.value }))}
              rows="3"
              placeholder="Selecione os jogadores e gere seu PDF."
            />
          </label>
          <button type="submit" className="fig-primary-button" disabled={savingCollection}>
            {savingCollection ? 'Salvando...' : 'Criar colecao'}
          </button>
        </form>

        <div className="fig-collection-list">
          {collections.map(collection => (
            <button
              key={collection.id}
              type="button"
              className={`fig-collection-button${collection.id === selectedCollectionId ? ' is-active' : ''}`}
              onClick={() => {
                setSelectedCollectionId(collection.id)
                setCurrentPageId(null)
                resetStickerForm()
              }}
            >
              <strong>{collection.name}</strong>
              <span>
                {collection.status === 'PUBLICADA' ? 'Publicada' : 'Rascunho'} · {collection.sticker_count} figurinhas
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="fig-content-panel fig-admin-content">
        <div className="fig-admin-header">
          <div>
            <p className="fig-kicker">Gestao</p>
            <h2>{selectedCollection?.name || 'Selecione uma colecao'}</h2>
            <p>Gerencie o catalogo, os pedidos impressos e a configuracao do atendimento local.</p>
          </div>
          <div className="fig-hero-actions">
            <button type="button" className="fig-secondary-button" onClick={() => setToken('')}>
              Sair
            </button>
          </div>
        </div>

        {message ? <p className="fig-success-banner">{message}</p> : null}
        {error ? <p className="fig-error-banner">{error}</p> : null}
        {loading ? <p className="fig-empty-note">Carregando dados da colecao...</p> : null}

        <section className="fig-admin-summary-grid">
          <form className="fig-form-card" onSubmit={handleSaveServiceConfig}>
            <div className="fig-panel-header">
              <p className="fig-kicker">Servico pago</p>
              <h3>Impressao e pacotinhos</h3>
            </div>

            <label className="fig-checkbox">
              <input
                type="checkbox"
                checked={serviceForm.service_enabled}
                onChange={event => setServiceForm(current => ({ ...current, service_enabled: event.target.checked }))}
              />
              <span>Ativar pedidos de impressao</span>
            </label>

            <div className="fig-form-grid">
              <label className="fig-field">
                <span>Figurinhas por pacotinho</span>
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
                <span>Preco por pacotinho (R$)</span>
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
                <span>Observacao de retirada</span>
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
              <h3>Impressao local</h3>
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
                      <span>{selectedOrder.pack_size} figurinhas por pacote</span>
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
                        {sticker.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </section>

        {selectedCollection ? (
          <>
            <div className="fig-admin-header fig-admin-section-head">
              <div>
                <p className="fig-kicker">Gestao da colecao</p>
                <h3>{selectedCollection.name}</h3>
                <p>Suba o PDF, mapeie as areas de corte e publique quando o catalogo estiver pronto.</p>
              </div>
              <div className="fig-hero-actions">
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
          </>
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
