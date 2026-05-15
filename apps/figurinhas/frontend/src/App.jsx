import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'

const normalizedBase = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')
const apiBase = `${normalizedBase}/api`

const categoryOptions = [
  { value: 'JOGADOR', label: 'Jogador' },
  { value: 'GOLEIRO', label: 'Goleiro' },
  { value: 'DEFESA', label: 'Defesa' },
  { value: 'MEIO', label: 'Meio' },
  { value: 'ATAQUE', label: 'Ataque' },
  { value: 'COMISSAO', label: 'Comissão' },
  { value: 'ESCUDO', label: 'Escudo' },
  { value: 'ESPECIAL', label: 'Especial' }
]

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
    let detail = 'Não foi possível concluir a operação.'
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

function formatOcrConfidence(confidence) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return 'sem leitura'
  }
  return `${Math.round(confidence)}%`
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
            Catálogo
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

  useEffect(() => {
    let ignore = false
    async function loadCollections() {
      setBusy(true)
      setError('')
      try {
        const data = await apiFetch('/collections')
        if (ignore) return
        setCollections(data)
        setSelectedCollectionSlug(current => current || data[0]?.slug || '')
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
    loadCollections()
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

  const selectedCollection = useMemo(
    () => collections.find(collection => collection.slug === selectedCollectionSlug) || null,
    [collections, selectedCollectionSlug]
  )

  const selectedCount = selectedIds.length

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

  return (
    <section className="fig-public-layout">
      <aside className="fig-sidebar-panel">
        <div className="fig-panel-header">
          <p className="fig-kicker">Coleções publicadas</p>
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
          {!busy && collections.length === 0 ? <p className="fig-empty-note">Nenhuma coleção publicada ainda.</p> : null}
        </div>
      </aside>

      <div className="fig-content-panel">
        <div className="fig-hero">
          <div>
            <p className="fig-kicker">Seleção rápida</p>
            <h2>{selectedCollection?.name || 'Selecione uma coleção'}</h2>
            <p>{selectedCollection?.description || 'Marque os jogadores que você precisa e gere um PDF final.'}</p>
          </div>
          <div className="fig-hero-actions">
            <button type="button" className="fig-secondary-button" onClick={() => setSelectedIds(stickers.map(sticker => sticker.id))}>
              Selecionar todas
            </button>
            <button type="button" className="fig-secondary-button" onClick={() => setSelectedIds([])}>
              Limpar seleção
            </button>
            <button
              type="button"
              className="fig-primary-button"
              disabled={!selectedCollectionSlug || selectedCount === 0 || exporting}
              onClick={handleExport}
            >
              {exporting ? 'Gerando PDF...' : `Gerar PDF (${selectedCount})`}
            </button>
          </div>
        </div>

        <div className="fig-toolbar">
          <label className="fig-field">
            <span>Buscar jogador</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ex.: Vinícius" />
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

        {error ? <p className="fig-error-banner">{error}</p> : null}
        {busy ? <p className="fig-empty-note">Carregando figurinhas...</p> : null}

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
                <span>{categoryOptions.find(option => option.value === sticker.category)?.label || sticker.category}</span>
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

  async function fetchCollections(activeCollectionId = selectedCollectionId) {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/admin/collections', {
        headers: buildAdminHeaders(token)
      })
      setCollections(data)
      const nextId = activeCollectionId || data[0]?.id || null
      setSelectedCollectionId(nextId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchCollections()
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
      setMessage('Coleção criada.')
      await fetchCollections(created.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingCollection(false)
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
      setMessage('PDF enviado e páginas renderizadas.')
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
      const pageSummary = data.page_results
        .map(result => `P${result.page_number}: ${result.detected_count}`)
        .join(' | ')
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
      setMessage('Figurinha excluída.')
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
      setMessage(status === 'PUBLICADA' ? 'Coleção publicada.' : 'Coleção movida para rascunho.')
      await fetchCollections(selectedCollectionId)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!token) {
    return (
      <section className="fig-auth-panel">
        <form className="fig-form-card" onSubmit={handleLogin}>
          <p className="fig-kicker">Admin</p>
          <h2>Acesso de gestão</h2>
          <p>Use a senha compartilhada desse miniapp para gerenciar as coleções.</p>
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
          <p className="fig-kicker">Coleções</p>
          <h2>Catálogo</h2>
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
            <span>Descrição</span>
            <textarea
              value={createForm.description}
              onChange={event => setCreateForm(current => ({ ...current, description: event.target.value }))}
              rows="3"
              placeholder="Selecione os jogadores e gere seu PDF."
            />
          </label>
          <button type="submit" className="fig-primary-button" disabled={savingCollection}>
            {savingCollection ? 'Salvando...' : 'Criar coleção'}
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
            <p className="fig-kicker">Gestão da coleção</p>
            <h2>{selectedCollection?.name || 'Selecione uma coleção'}</h2>
            <p>Suba o PDF, mapeie as áreas de corte e publique quando o catálogo estiver pronto.</p>
          </div>
          <div className="fig-hero-actions">
            <button type="button" className="fig-secondary-button" onClick={() => handlePublish('RASCUNHO')} disabled={!selectedCollection}>
              Voltar para rascunho
            </button>
            <button type="button" className="fig-primary-button" onClick={() => handlePublish('PUBLICADA')} disabled={!selectedCollection}>
              Publicar coleção
            </button>
            <button type="button" className="fig-secondary-button" onClick={() => setToken('')}>
              Sair
            </button>
          </div>
        </div>

        {message ? <p className="fig-success-banner">{message}</p> : null}
        {error ? <p className="fig-error-banner">{error}</p> : null}
        {loading ? <p className="fig-empty-note">Carregando dados da coleção...</p> : null}

        {selectedCollection ? (
          <>
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
                <strong>Páginas</strong>
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
                      Página {page.page_number}
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
                      <img src={apiFileUrl(currentPage.image_path)} alt={`Página ${currentPage.page_number}`} />
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
                    <p className="fig-helper-text">Clique e arraste sobre a página para desenhar a área da figurinha.</p>
                  </div>
                ) : (
                  <p className="fig-empty-note">Suba um PDF para começar a mapear as páginas.</p>
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
                      <span>Código</span>
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
                    <span>Ativa na vitrine pública</span>
                  </label>

                  <div className="fig-hero-actions">
                    <button type="button" className="fig-secondary-button" onClick={resetStickerForm}>
                      Limpar formulário
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
                          Página {sticker.page_number} · {categoryOptions.find(option => option.value === sticker.category)?.label || sticker.category}
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
