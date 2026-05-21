import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import siteLogo from './assets/logo-topo-cutout.png'

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

const customProfileOptions = [
  { value: 'HOMEM', label: 'Homem' },
  { value: 'MULHER', label: 'Mulher' },
  { value: 'CRIANCA', label: 'Crianca' }
]

const customBaseFieldByProfile = {
  HOMEM: 'custom_base_homem_path',
  MULHER: 'custom_base_mulher_path',
  CRIANCA: 'custom_base_crianca_path'
}

const customGenerationModeOptions = [
  { value: 'LAYERS', label: 'Somente montagem manual' },
  { value: 'AI_OPTIONAL', label: 'Montagem manual + IA opcional' }
]

const publicCustomCreationModes = [
  {
    value: 'LAYERS',
    label: 'Montagem manual',
    description: 'Monte sua figurinha agora e ajuste sua foto do seu jeito.'
  },
  {
    value: 'AI_OPTIONAL',
    label: 'Criar com IA',
    description: 'Receba uma versao premium com pagamento antes da geracao.'
  }
]

const customCategoryTypeOptions = [
  { value: 'JOGADOR', label: 'Jogador' }
]

const customPositionTypeOptions = [
  { value: 'ATACANTE', label: 'Atacante' },
  { value: 'MEIA', label: 'Meia' },
  { value: 'ZAGUEIRO', label: 'Zagueiro' },
  { value: 'GOLEIRO', label: 'Goleiro' }
]

const customTemplateLayerTypeOptions = [
  { value: 'BACKGROUND', label: 'Fundo' },
  { value: 'FRAME', label: 'Moldura' },
  { value: 'PHOTO_FRONT', label: 'Camada frontal da foto' },
  { value: 'INFO_PANEL', label: 'Faixa de informacoes' },
  { value: 'OVERLAY', label: 'Overlay extra' },
  { value: 'SHINE', label: 'Brilho/acabamento' }
]

const standardCustomTemplateLayerTypes = ['BACKGROUND', 'INFO_PANEL', 'FRAME', 'PHOTO_FRONT']

const customTemplateTextFieldOptions = [
  { value: 'NAME', label: 'Nome' },
  { value: 'DATE', label: 'Data' },
  { value: 'HEIGHT', label: 'Altura' },
  { value: 'WEIGHT', label: 'Peso' },
  { value: 'CITY_OR_TEAM', label: 'Cidade ou time' }
]

const STICKERS_PER_SHEET = 16
const MANUAL_STICKER_RENDER_BASE_WIDTH = 834
const MANUAL_STICKER_RENDER_BASE_HEIGHT = 1105
const MANUAL_STICKER_PREVIEW_FALLBACK_SCALE = 320 / MANUAL_STICKER_RENDER_BASE_WIDTH

const sourceDocumentStatusLabels = {
  RASCUNHO: 'Rascunho',
  EM_REVISAO: 'Em revisao',
  PUBLICADO: 'Publicado'
}

const sourceDetectedStatusLabels = {
  PENDENTE: 'Pendente',
  ATRIBUIDA: 'Atribuida',
  DESCARTADA: 'Descartada'
}

function useAdminToken() {
  const [token, setTokenState] = useState(() => {
    const raw = window.localStorage.getItem('figurinhas_admin_session')
    if (!raw) return ''
    try {
      const parsed = JSON.parse(raw)
      if (!parsed?.token) return ''
      if (parsed.expires_at && new Date(parsed.expires_at).getTime() <= Date.now()) {
        window.localStorage.removeItem('figurinhas_admin_session')
        return ''
      }
      return parsed.token
    } catch {
      window.localStorage.removeItem('figurinhas_admin_session')
      return ''
    }
  })

  const setToken = useCallback(value => {
    if (!value) {
      window.localStorage.removeItem('figurinhas_admin_session')
      setTokenState('')
      return
    }
    if (typeof value === 'string') {
      window.localStorage.setItem('figurinhas_admin_session', JSON.stringify({ token: value }))
      setTokenState(value)
      return
    }
    const nextToken = value.token || ''
    if (!nextToken) {
      window.localStorage.removeItem('figurinhas_admin_session')
      setTokenState('')
      return
    }
    window.localStorage.setItem(
      'figurinhas_admin_session',
      JSON.stringify({
        token: nextToken,
        expires_at: value.expires_at || null
      })
    )
    setTokenState(nextToken)
  }, [])

  return [token, setToken]
}

function readCookie(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function writeCookie(name, value, days = 180) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
  const secure = window.location?.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`
}

function usePublicSessionToken() {
  const [sessionToken] = useState(() => {
    const storageKey = 'figurinhas_public_session_token'
    const cookieKey = 'figurinhas_public_session_token'
    const current = window.localStorage.getItem(storageKey)
    if (current) {
      if (!readCookie(cookieKey)) {
        writeCookie(cookieKey, current)
      }
      return current
    }
    const cookieValue = readCookie(cookieKey)
    if (cookieValue) {
      window.localStorage.setItem(storageKey, cookieValue)
      return cookieValue
    }
    const generated = window.crypto?.randomUUID?.() || `sessao-${Math.random().toString(36).slice(2)}${Date.now()}`
    window.localStorage.setItem(storageKey, generated)
    writeCookie(cookieKey, generated)
    return generated
  })

  return sessionToken
}

const MY_STICKER_DRAFT_DB_NAME = 'figurinhas-public-drafts'
const MY_STICKER_DRAFT_STORE_NAME = 'assets'

function createMyStickerDraftStorageKey(sessionToken, albumSlug) {
  if (!sessionToken || !albumSlug) return ''
  return `figurinhas_my_sticker_draft:${sessionToken}:${albumSlug}`
}

function createMyStickerDraftAssetKey(sessionToken, albumSlug, assetName) {
  if (!sessionToken || !albumSlug || !assetName) return ''
  return `${sessionToken}:${albumSlug}:${assetName}`
}

function openMyStickerDraftDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null)
      return
    }
    const request = window.indexedDB.open(MY_STICKER_DRAFT_DB_NAME, 1)
    request.onerror = () => reject(request.error || new Error('Nao foi possivel abrir o armazenamento local.'))
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(MY_STICKER_DRAFT_STORE_NAME)) {
        database.createObjectStore(MY_STICKER_DRAFT_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function saveMyStickerDraftAsset(assetKey, file) {
  if (!assetKey) return
  const database = await openMyStickerDraftDb()
  if (!database) return
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(MY_STICKER_DRAFT_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(MY_STICKER_DRAFT_STORE_NAME)
    if (file) {
      store.put(
        {
          blob: file,
          name: file.name || 'arquivo.png',
          type: file.type || 'application/octet-stream',
          lastModified: file.lastModified || Date.now()
        },
        assetKey
      )
    } else {
      store.delete(assetKey)
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Nao foi possivel salvar o rascunho local.'))
    transaction.onabort = () => reject(transaction.error || new Error('Nao foi possivel salvar o rascunho local.'))
  })
  database.close()
}

async function loadMyStickerDraftAsset(assetKey) {
  if (!assetKey) return null
  const database = await openMyStickerDraftDb()
  if (!database) return null
  const record = await new Promise((resolve, reject) => {
    const transaction = database.transaction(MY_STICKER_DRAFT_STORE_NAME, 'readonly')
    const request = transaction.objectStore(MY_STICKER_DRAFT_STORE_NAME).get(assetKey)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('Nao foi possivel ler o rascunho local.'))
  })
  database.close()
  if (!record?.blob) return null
  try {
    return new File([record.blob], record.name || 'arquivo.png', {
      type: record.type || record.blob.type || 'application/octet-stream',
      lastModified: record.lastModified || Date.now()
    })
  } catch {
    return null
  }
}

async function deleteMyStickerDraftAsset(assetKey) {
  if (!assetKey) return
  const database = await openMyStickerDraftDb()
  if (!database) return
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(MY_STICKER_DRAFT_STORE_NAME, 'readwrite')
    transaction.objectStore(MY_STICKER_DRAFT_STORE_NAME).delete(assetKey)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Nao foi possivel limpar o rascunho local.'))
    transaction.onabort = () => reject(transaction.error || new Error('Nao foi possivel limpar o rascunho local.'))
  })
  database.close()
}

async function clearMyStickerDraftAssets(sessionToken, albumSlug) {
  await Promise.all([
    deleteMyStickerDraftAsset(createMyStickerDraftAssetKey(sessionToken, albumSlug, 'photo')),
    deleteMyStickerDraftAsset(createMyStickerDraftAssetKey(sessionToken, albumSlug, 'edited-portrait'))
  ])
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
    const error = new Error(detail)
    error.status = response.status
    throw error
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
    Authorization: `Bearer ${token}`,
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

function normalizeCustomProfileValue(profile) {
  if (profile === 'MENINO' || profile === 'MENINA' || profile === 'CRIANCA') {
    return 'CRIANCA'
  }
  return profile
}

function customProfileLabel(profile) {
  const normalized = normalizeCustomProfileValue(profile)
  return customProfileOptions.find(option => option.value === normalized)?.label || normalized || 'Minha Figurinha'
}

function customPositionLabel(position) {
  return customPositionTypeOptions.find(option => option.value === position)?.label || position || 'Posicao'
}

function sourceDocumentStatusLabel(status) {
  return sourceDocumentStatusLabels[status] || status || 'Rascunho'
}

function sourceDetectedStatusLabel(status) {
  return sourceDetectedStatusLabels[status] || status || 'Pendente'
}

function sourceDocumentTitleFromFile(fileName) {
  return String(fileName || '')
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function customBasePathForProfile(config, profile) {
  if (!config || !profile) return ''
  const normalized = normalizeCustomProfileValue(profile)
  return config[customBaseFieldByProfile[normalized]] || ''
}

function customCategoryLabel(category) {
  return customCategoryTypeOptions.find(option => option.value === category)?.label || category || 'Categoria'
}

function buildCustomTemplateName(profile, position, category = 'JOGADOR') {
  return `${customProfileLabel(profile)} · ${customCategoryLabel(category)} · ${customPositionLabel(position)}`
}

function createEmptyMyStickerForm() {
  return {
    name: '',
    profile_type: 'HOMEM',
    category_type: 'JOGADOR',
    position_type: 'ATACANTE',
    requested_composition_mode: 'LAYERS',
    template_id: '',
    photo_offset_x: '0',
    photo_offset_y: '0',
    photo_scale: '1',
    photo_rotation: '0',
    birth_date_text: '',
    height_text: '',
    weight_text: '',
    city_or_team: '',
    photo: null
  }
}

function createEmptySourceDocumentForm(albumId = '') {
  return {
    album_id: albumId ? String(albumId) : '',
    title: '',
    file: null
  }
}

function createEmptySourceBlockForm() {
  return {
    collection_id: '',
    label: '',
    x: '',
    y: '',
    width: '',
    height: '',
    sort_order: '0'
  }
}

function createEmptyPageLayoutForm() {
  return {
    name: ''
  }
}

const collectionTypeOptions = [
  { value: 'SELECAO', label: 'Selecao' },
  { value: 'ESCUDOS', label: 'Escudos' },
  { value: 'LEGENDS', label: 'Legends' },
  { value: 'ESPECIAL', label: 'Especial' },
  { value: 'PARCEIROS', label: 'Parceiros' },
  { value: 'OUTROS', label: 'Outros' }
]

function defaultCollectionGroupOrder(collectionType) {
  switch (collectionType) {
    case 'ESCUDOS':
      return '2'
    case 'LEGENDS':
      return '3'
    case 'ESPECIAL':
      return '4'
    case 'PARCEIROS':
      return '5'
    case 'OUTROS':
      return '6'
    default:
      return '1'
  }
}

function collectionTypeLabel(collectionType) {
  return (
    collectionTypeOptions.find(option => option.value === collectionType)?.label ||
    collectionType ||
    'Selecao'
  )
}

const publicCollectionGroups = [
  { type: 'SELECAO', label: 'Selecoes' },
  { type: 'ESCUDOS', label: 'Escudos' },
  { type: 'LEGENDS', label: 'Legends' },
  { type: 'ESPECIAL', label: 'Especiais' },
  { type: 'PARCEIROS', label: 'Parceiros' },
  { type: 'OUTROS', label: 'Outros' }
]

function createEmptyCollectionAdminForm(albumId = '') {
  return {
    album_id: albumId ? String(albumId) : '',
    name: '',
    slug: '',
    description: '',
    collection_type: 'SELECAO',
    display_group_order: defaultCollectionGroupOrder('SELECAO'),
    display_item_order: '999',
    sort_order: '0'
  }
}

function normalizeDateInput(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
}

function normalizeHeightInput(value) {
  const cleaned = String(value || '')
    .replace(/\s+/g, '')
    .replace(/m/gi, '')
    .replace(/\./g, ',')
  let output = ''
  let hasComma = false
  for (const character of cleaned) {
    if (/\d/.test(character)) {
      output += character
      continue
    }
    if (character === ',' && !hasComma) {
      output += character
      hasComma = true
    }
  }
  if (!output) return ''
  if (!hasComma) {
    const digitsOnly = output.slice(0, 3)
    if (digitsOnly.length === 3) {
      return `${digitsOnly.slice(0, 1)},${digitsOnly.slice(1)}`
    }
    return digitsOnly
  }
  const [integerPart, decimalPart = ''] = output.split(',')
  const normalizedInteger = integerPart.slice(0, 2)
  return `${normalizedInteger},${decimalPart.slice(0, 2)}`
}

function normalizeWeightInput(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 3)
}

function stripHeightUnit(value) {
  return normalizeHeightInput(String(value || '').replace(/m$/i, ''))
}

function stripWeightUnit(value) {
  return normalizeWeightInput(String(value || '').replace(/kg$/i, ''))
}

function formatHeightForSticker(value) {
  const normalized = normalizeHeightInput(value)
  return normalized ? `${normalized}m` : ''
}

function formatWeightForSticker(value) {
  const normalized = normalizeWeightInput(value)
  return normalized ? `${normalized}kg` : ''
}

function myStickerTextValue(form, fieldName) {
  const dateValue = (normalizeDateInput(form.birth_date_text) || 'DATA').trim() || 'DATA'
  const heightValue = (formatHeightForSticker(form.height_text) || 'ALTURA').trim() || 'ALTURA'
  const weightValue = (formatWeightForSticker(form.weight_text) || 'PESO').trim() || 'PESO'
  const cityValue = (form.city_or_team || 'TIME').trim() || 'TIME'
  switch (fieldName) {
    case 'NAME':
      return (form.name || 'NOME').toUpperCase()
    case 'DATE':
      return `${dateValue} |`
    case 'HEIGHT':
      return `${heightValue} |`
    case 'WEIGHT':
      return weightValue
    case 'CITY_OR_TEAM':
      return cityValue.toUpperCase()
    default:
      return ''
  }
}

function customTemplateSampleTextValue(fieldName) {
  switch (fieldName) {
    case 'NAME':
      return 'SEU NOME'
    case 'DATE':
      return '14-05-1994 |'
    case 'HEIGHT':
      return '1,83m |'
    case 'WEIGHT':
      return '75kg'
    case 'CITY_OR_TEAM':
      return 'TIME'
    default:
      return ''
  }
}

function CustomTemplateStackPreview({ template, alt, className = '' }) {
  const layers = (template?.layers || [])
    .filter(layer => layer.is_active && layer.file_path)
    .sort((left, right) => (left.z_index || 0) - (right.z_index || 0))

  if (!layers.length) {
    return null
  }

  return (
    <div className={`fig-template-stack-preview ${className}`.trim()} aria-label={alt}>
      {layers.map(layer => (
        <img
          key={layer.id || `${layer.layer_type}-${layer.z_index}`}
          src={apiFileUrl(layer.file_path)}
          alt={alt}
          className="fig-template-stack-preview-layer"
          style={{ zIndex: layer.z_index || 0 }}
        />
      ))}
    </div>
  )
}

function createDefaultCustomTemplateLayers() {
  return [
    {
      layer_type: 'BACKGROUND',
      label: '1. Fundo base',
      file_path: '',
      z_index: '0',
      is_active: true
    },
    {
      layer_type: 'INFO_PANEL',
      label: '2. Faixa de informacoes',
      file_path: '',
      z_index: '20',
      is_active: true
    },
    {
      layer_type: 'FRAME',
      label: '3. Moldura principal',
      file_path: '',
      z_index: '40',
      is_active: true
    },
    {
      layer_type: 'PHOTO_FRONT',
      label: '4. Camisa frontal',
      file_path: '',
      z_index: '60',
      is_active: true
    }
  ]
}

function isStandardCustomTemplateLayerType(layerType) {
  return standardCustomTemplateLayerTypes.includes(layerType)
}

function createDefaultCustomTemplateTextSlots() {
  return [
    { field_name: 'NAME', x: '0.10', y: '0.802', width: '0.70', font_size: '20', font_weight: '700', text_align: 'center', color: '#ffffff' },
    { field_name: 'DATE', x: '0.213', y: '0.846', width: '0.18', font_size: '15', font_weight: '700', text_align: 'center', color: '#ffffff' },
    { field_name: 'HEIGHT', x: '0.402', y: '0.846', width: '0.13', font_size: '15', font_weight: '700', text_align: 'center', color: '#ffffff' },
    { field_name: 'WEIGHT', x: '0.529', y: '0.846', width: '0.12', font_size: '15', font_weight: '700', text_align: 'center', color: '#ffffff' },
    { field_name: 'CITY_OR_TEAM', x: '0.105', y: '0.905', width: '0.62', font_size: '15', font_weight: '700', text_align: 'center', color: '#ffffff' }
  ]
}

function createEmptyCustomTemplateTextBulkForm() {
  return {
    delta_x: '0',
    delta_y: '0',
    delta_width: '0',
    delta_font_size: '0',
    font_weight: '',
    text_align: '',
    color: ''
  }
}

function applyStandardCustomTemplateStructure(current) {
  const existingLayersByType = new Map()
  ;(current.layers || []).forEach(layer => {
    if (!existingLayersByType.has(layer.layer_type)) {
      existingLayersByType.set(layer.layer_type, layer)
    }
  })
  const standardLayers = createDefaultCustomTemplateLayers().map(defaultLayer => {
    const existing = existingLayersByType.get(defaultLayer.layer_type)
    return existing
      ? {
          ...defaultLayer,
          ...existing,
          label: existing.label || defaultLayer.label,
          z_index: existing.z_index || defaultLayer.z_index
        }
      : defaultLayer
  })
  const extraLayers = (current.layers || []).filter(
    layer => !standardLayers.some(standardLayer => standardLayer.layer_type === layer.layer_type)
  )
  return {
    ...current,
    layers: [...standardLayers, ...extraLayers],
    text_slots: current.text_slots?.length ? current.text_slots : createDefaultCustomTemplateTextSlots(),
    photo_slot: current.photo_slot || createEmptyCustomTemplateForm().photo_slot
  }
}

function createEmptyCustomTemplateForm() {
  return {
    album_id: '',
    name: '',
    profile_type: 'HOMEM',
    category_type: 'JOGADOR',
    position_type: 'ATACANTE',
    composition_mode: 'LAYERS',
    sort_order: '0',
    is_active: true,
    layers: createDefaultCustomTemplateLayers(),
    photo_slot: {
      x: '0.12',
      y: '0.08',
      width: '0.76',
      height: '0.62',
      default_scale: '1',
      min_scale: '0.7',
      max_scale: '2.4',
      portrait_z_index: '50',
      anchor_x: '0.5',
      anchor_y: '0.5',
      visible_x: '0.08',
      visible_y: '0',
      visible_width: '0.84',
      visible_height: '0.74'
    },
    text_slots: createDefaultCustomTemplateTextSlots(),
    manual_status: createEmptyCustomTemplateManualStatus()
  }
}

function createEmptyCustomTemplateManualStatus() {
  return {
    ready: false,
    missing_count: 3,
    missing_labels: [
      'Fundo',
      'Faixa de informacoes',
      'Moldura ou camada frontal'
    ],
    checks: [
      {
        key: 'photo_slot',
        label: 'Area da foto',
        ready: true,
        detail: 'A foto ja tem uma area padrao inicial para encaixe.'
      },
      {
        key: 'background',
        label: 'Fundo',
        ready: false,
        detail: 'Importe uma imagem de fundo para o modelo.'
      },
      {
        key: 'info_panel',
        label: 'Faixa de informacoes',
        ready: false,
        detail: 'Importe a faixa onde ficam nome, data, altura, peso e cidade/time.'
      },
      {
        key: 'foreground',
        label: 'Moldura ou camada frontal',
        ready: false,
        detail: 'Importe pelo menos uma moldura, camisa frontal, overlay ou brilho.'
      },
      {
        key: 'text_slots',
        label: 'Campos de texto',
        ready: true,
        detail: 'Os campos de texto padrao ja foram preparados sobre a faixa de informacoes.'
      }
    ],
    layer_inventory: [
      { layer_type: 'BACKGROUND', label: 'Fundo', count: 0 },
      { layer_type: 'FRAME', label: 'Moldura', count: 0 },
      { layer_type: 'PHOTO_FRONT', label: 'Camada frontal da foto', count: 0 },
      { layer_type: 'INFO_PANEL', label: 'Faixa de informacoes', count: 0 },
      { layer_type: 'OVERLAY', label: 'Overlay extra', count: 0 },
      { layer_type: 'SHINE', label: 'Brilho/acabamento', count: 0 }
    ]
  }
}

function customTemplateDetailToForm(data) {
  const baseForm = createEmptyCustomTemplateForm()
  return applyStandardCustomTemplateStructure({
    ...baseForm,
    album_id: String(data.album_id || ''),
    name: data.name || '',
    profile_type: normalizeCustomProfileValue(data.profile_type) || 'HOMEM',
    category_type: data.category_type || 'JOGADOR',
    position_type: data.position_type || 'ATACANTE',
    composition_mode: data.composition_mode || 'LAYERS',
    sort_order: String(data.sort_order ?? 0),
    is_active: Boolean(data.is_active),
    layers: (data.layers?.length ? data.layers : baseForm.layers).map(layer => ({
      id: layer.id,
      layer_type: layer.layer_type,
      label: layer.label || '',
      file_path: layer.file_path || '',
      z_index: String(layer.z_index ?? 0),
      is_active: layer.is_active !== false
    })),
    photo_slot: data.photo_slot
      ? {
          x: String(data.photo_slot.x ?? 0),
          y: String(data.photo_slot.y ?? 0),
          width: String(data.photo_slot.width ?? 1),
          height: String(data.photo_slot.height ?? 1),
          default_scale: String(data.photo_slot.default_scale ?? 1),
          min_scale: String(data.photo_slot.min_scale ?? 0.7),
          max_scale: String(data.photo_slot.max_scale ?? 2.4),
          portrait_z_index: String(data.photo_slot.portrait_z_index ?? 50),
          anchor_x: String(data.photo_slot.anchor_x ?? 0.5),
          anchor_y: String(data.photo_slot.anchor_y ?? 0.5),
          visible_x: String(data.photo_slot.visible_x ?? 0),
          visible_y: String(data.photo_slot.visible_y ?? 0),
          visible_width: String(data.photo_slot.visible_width ?? 1),
          visible_height: String(data.photo_slot.visible_height ?? 0.9)
        }
      : baseForm.photo_slot,
    text_slots: (data.text_slots?.length ? data.text_slots : baseForm.text_slots).map(slot => ({
      id: slot.id,
      field_name: slot.field_name,
      x: String(slot.x ?? 0),
      y: String(slot.y ?? 0),
      width: String(slot.width ?? 0),
      font_size: String(slot.font_size ?? 12),
      font_weight: slot.font_weight || '',
      text_align: slot.text_align || '',
      color: slot.color || ''
    })),
    manual_status: data.manual_status || createEmptyCustomTemplateManualStatus()
  })
}

function serviceConfigToForm(data) {
  return {
    service_enabled: data.service_enabled,
    donation_enabled: data.donation_enabled,
    custom_generation_mode: data.custom_generation_mode || 'LAYERS',
    custom_sticker_unlock_enabled: data.custom_sticker_unlock_enabled,
    custom_sticker_unlock_price: moneyInputFromCents(data.custom_sticker_unlock_price_cents),
    custom_sticker_unlock_message: data.custom_sticker_unlock_message || '',
    custom_ai_unlock_enabled: data.custom_ai_unlock_enabled,
    custom_ai_unlock_price: moneyInputFromCents(data.custom_ai_unlock_price_cents),
    custom_ai_unlock_message: data.custom_ai_unlock_message || '',
    pack_size: String(data.pack_size),
    print_price: moneyInputFromCents(data.print_price_cents),
    pack_price: moneyInputFromCents(data.pack_price_cents),
    pix_key: data.pix_key || '',
    pix_holder: data.pix_holder || '',
    donation_message: data.donation_message || '',
    pickup_note: data.pickup_note || '',
    custom_prompt_template: data.custom_prompt_template || '',
    custom_base_homem_path: data.custom_base_homem_path || '',
    custom_base_mulher_path: data.custom_base_mulher_path || '',
    custom_base_crianca_path: data.custom_base_crianca_path || data.custom_base_menino_path || data.custom_base_menina_path || ''
  }
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

function buildSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150)
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
  const location = useLocation()
  const navigate = useNavigate()
  const showingAdmin = location.pathname.startsWith('/admin')

  function handleBrandToggle() {
    navigate(showingAdmin ? '/' : '/admin')
  }

  return (
    <div className="fig-app-shell">
      <header className="fig-topbar">
        <button
          type="button"
          className="fig-topbar-brand"
          aria-label={showingAdmin ? 'Abrir catalogo' : 'Abrir admin'}
          title={showingAdmin ? 'Abrir catalogo' : 'Abrir admin'}
          onClick={handleBrandToggle}
        >
          <img src={siteLogo} alt="Logo do site" className="fig-topbar-logo" />
        </button>
      </header>
      <main className="fig-main">{children}</main>
    </div>
  )
}

function ManualMaskEditorModal({ open, imageDataUrl, originalImageDataUrl, onClose, onApply }) {
  const canvasRef = useRef(null)
  const originalCanvasRef = useRef(null)
  const tempCanvasRef = useRef(null)
  const historyRef = useRef([])
  const drawingRef = useRef(false)
  const lastPointRef = useRef(null)
  const [tool, setTool] = useState('erase')
  const [brushSize, setBrushSize] = useState(24)
  const [ready, setReady] = useState(false)
  const [applying, setApplying] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [historyDepth, setHistoryDepth] = useState(0)

  useEffect(() => {
    if (!originalCanvasRef.current) {
      originalCanvasRef.current = document.createElement('canvas')
    }
    if (!tempCanvasRef.current) {
      tempCanvasRef.current = document.createElement('canvas')
    }
  }, [])

  useEffect(() => {
    if (!open || !imageDataUrl) return undefined
    let cancelled = false
    historyRef.current = []
    setHistoryDepth(0)
    setEditorError('')
    setReady(false)
    setApplying(false)
    setTool('erase')
    setBrushSize(24)

    async function loadEditorImages() {
      try {
        const [currentImage, originalImage] = await Promise.all([
          loadImageFromUrl(imageDataUrl),
          loadImageFromUrl(originalImageDataUrl || imageDataUrl),
        ])
        if (cancelled) return

        const longestSide = Math.max(currentImage.naturalWidth || currentImage.width, currentImage.naturalHeight || currentImage.height, 1)
        const scale = longestSide > 900 ? 900 / longestSide : 1
        const width = Math.max(1, Math.round((currentImage.naturalWidth || currentImage.width) * scale))
        const height = Math.max(1, Math.round((currentImage.naturalHeight || currentImage.height) * scale))

        const canvas = canvasRef.current
        const originalCanvas = originalCanvasRef.current
        const tempCanvas = tempCanvasRef.current
        if (!canvas || !originalCanvas || !tempCanvas) return

        canvas.width = width
        canvas.height = height
        originalCanvas.width = width
        originalCanvas.height = height
        tempCanvas.width = width
        tempCanvas.height = height

        const context = canvas.getContext('2d')
        const originalContext = originalCanvas.getContext('2d')
        if (!context || !originalContext) return

        context.clearRect(0, 0, width, height)
        originalContext.clearRect(0, 0, width, height)
        context.drawImage(currentImage, 0, 0, width, height)
        originalContext.drawImage(originalImage, 0, 0, width, height)
        setReady(true)
      } catch (error) {
        if (cancelled) return
        setEditorError('Nao foi possivel abrir o ajuste fino dessa foto.')
      }
    }

    loadEditorImages()
    return () => {
      cancelled = true
      drawingRef.current = false
      lastPointRef.current = null
    }
  }, [open, imageDataUrl, originalImageDataUrl])

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('image-load-failed'))
      image.src = url
    })
  }

  function mapCanvasPoint(event) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const bounds = canvas.getBoundingClientRect()
    const scaleX = canvas.width / Math.max(bounds.width, 1)
    const scaleY = canvas.height / Math.max(bounds.height, 1)
    return {
      x: Math.min(Math.max((event.clientX - bounds.left) * scaleX, 0), canvas.width),
      y: Math.min(Math.max((event.clientY - bounds.top) * scaleY, 0), canvas.height),
    }
  }

  function pushHistorySnapshot() {
    const canvas = canvasRef.current
    if (!canvas) return
    historyRef.current.push(canvas.toDataURL('image/png'))
    if (historyRef.current.length > 12) {
      historyRef.current.shift()
    }
    setHistoryDepth(historyRef.current.length)
  }

  function drawStroke(fromPoint, toPoint) {
    const canvas = canvasRef.current
    const originalCanvas = originalCanvasRef.current
    const tempCanvas = tempCanvasRef.current
    if (!canvas || !originalCanvas || !tempCanvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    if (tool === 'erase') {
      context.save()
      context.globalCompositeOperation = 'destination-out'
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.lineWidth = brushSize
      context.beginPath()
      context.moveTo(fromPoint.x, fromPoint.y)
      context.lineTo(toPoint.x, toPoint.y)
      context.stroke()
      context.restore()
      return
    }

    const tempContext = tempCanvas.getContext('2d')
    if (!tempContext) return
    tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
    tempContext.save()
    tempContext.lineCap = 'round'
    tempContext.lineJoin = 'round'
    tempContext.lineWidth = brushSize
    tempContext.strokeStyle = '#000000'
    tempContext.beginPath()
    tempContext.moveTo(fromPoint.x, fromPoint.y)
    tempContext.lineTo(toPoint.x, toPoint.y)
    tempContext.stroke()
    tempContext.globalCompositeOperation = 'source-in'
    tempContext.drawImage(originalCanvas, 0, 0)
    tempContext.restore()
    context.drawImage(tempCanvas, 0, 0)
  }

  function handlePointerDown(event) {
    if (!ready || applying) return
    event.preventDefault()
    const point = mapCanvasPoint(event)
    const canvas = canvasRef.current
    if (!point || !canvas) return
    pushHistorySnapshot()
    drawingRef.current = true
    lastPointRef.current = point
    if (canvas.setPointerCapture && event.pointerId !== undefined) {
      canvas.setPointerCapture(event.pointerId)
    }
    drawStroke(point, point)
  }

  function handlePointerMove(event) {
    if (!drawingRef.current) return
    event.preventDefault()
    const point = mapCanvasPoint(event)
    if (!point || !lastPointRef.current) return
    drawStroke(lastPointRef.current, point)
    lastPointRef.current = point
  }

  function finishDrawing(event) {
    if (event) {
      event.preventDefault()
    }
    drawingRef.current = false
    lastPointRef.current = null
  }

  function handleUndo() {
    const canvas = canvasRef.current
    const snapshot = historyRef.current.pop()
    if (!canvas || !snapshot) return
    setHistoryDepth(historyRef.current.length)
    const context = canvas.getContext('2d')
    if (!context) return
    const image = new Image()
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
    image.src = snapshot
  }

  function handleUseOriginal() {
    if (!originalImageDataUrl) return
    onApply({
      dataUrl: originalImageDataUrl,
      file: null,
      usesOriginal: true,
    })
  }

  function handleApply() {
    const canvas = canvasRef.current
    if (!canvas || applying) return
    setApplying(true)
    setEditorError('')
    canvas.toBlob(blob => {
      if (!blob) {
        setApplying(false)
        setEditorError('Nao foi possivel salvar esse ajuste fino.')
        return
      }
      const dataUrl = canvas.toDataURL('image/png')
      const file = new File([blob], 'manual-portrait-adjust.png', { type: 'image/png' })
      onApply({ dataUrl, file, usesOriginal: false })
      setApplying(false)
    }, 'image/png')
  }

  if (!open) return null

  return (
    <div className="fig-mask-editor-backdrop" onClick={onClose}>
      <div className="fig-mask-editor-shell" onClick={event => event.stopPropagation()}>
        <div className="fig-mask-editor-header">
          <div>
            <p className="fig-kicker">Ajuste fino</p>
            <h3>Apague so as rebarbas da foto</h3>
            <p className="fig-mask-editor-copy">Use a borrachinha para tirar ombro, fundo ou sobras que ainda apareceram.</p>
          </div>
          <button type="button" className="fig-modal-close" onClick={onClose}>
            Fechar
          </button>
        </div>

        {editorError ? <p className="fig-error-banner">{editorError}</p> : null}

        <div className="fig-mask-editor-stage">
          <canvas
            ref={canvasRef}
            className="fig-mask-editor-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
            onPointerLeave={finishDrawing}
          />
          {!ready ? <div className="fig-mask-editor-empty">Preparando o ajuste fino...</div> : null}
        </div>

        <div className="fig-mask-editor-toolbar">
          <div className="fig-mask-editor-tools">
            <button
              type="button"
              className={`fig-secondary-button${tool === 'erase' ? ' is-active' : ''}`}
              disabled={!ready || applying}
              onClick={() => setTool('erase')}
            >
              Apagar
            </button>
            <button
              type="button"
              className={`fig-secondary-button${tool === 'restore' ? ' is-active' : ''}`}
              disabled={!ready || applying}
              onClick={() => setTool('restore')}
            >
              Restaurar
            </button>
            <button type="button" className="fig-secondary-button" disabled={!historyDepth || applying} onClick={handleUndo}>
              Desfazer
            </button>
            <button type="button" className="fig-secondary-button" disabled={!ready || applying} onClick={handleUseOriginal}>
              Usar recorte automatico
            </button>
          </div>

          <div className="fig-mask-editor-tools fig-mask-editor-tools--compact">
            <label className="fig-range-field fig-range-field--mask">
              <span>Tamanho do pincel</span>
              <input
                type="range"
                min="10"
                max="64"
                step="2"
                value={brushSize}
                onChange={event => setBrushSize(Number(event.target.value))}
                disabled={!ready || applying}
              />
              <small>{brushSize}px</small>
            </label>
            <button type="button" className="fig-primary-button" disabled={!ready || applying} onClick={handleApply}>
              {applying ? 'Salvando...' : 'Concluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PublicPage() {
  const sessionToken = usePublicSessionToken()
  const [albums, setAlbums] = useState([])
  const [selectedAlbumSlug, setSelectedAlbumSlug] = useState('')
  const [selectedCollectionSlug, setSelectedCollectionSlug] = useState('')
  const [stickers, setStickers] = useState([])
  const [customSticker, setCustomSticker] = useState(null)
  const [customTemplateOptions, setCustomTemplateOptions] = useState([])
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
  const [selectedExportExtras, setSelectedExportExtras] = useState({})
  const [selectedExportExtraApplyAll, setSelectedExportExtraApplyAll] = useState({})
  const [mobileAlbumPickerOpen, setMobileAlbumPickerOpen] = useState(false)
  const [mobilePrintGuideOpen, setMobilePrintGuideOpen] = useState(false)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [mobileCollectionTypeFilter, setMobileCollectionTypeFilter] = useState('SELECAO')
  const [desktopCollectionTypeFilter, setDesktopCollectionTypeFilter] = useState('SELECAO')
  const [donationModalOpen, setDonationModalOpen] = useState(false)
  const [customUnlockModalOpen, setCustomUnlockModalOpen] = useState(false)
  const [customUnlockContext, setCustomUnlockContext] = useState('MANUAL_PDF')
  const [customUnlockStep, setCustomUnlockStep] = useState('choice')
  const [customUnlockData, setCustomUnlockData] = useState(null)
  const [aiUnlockData, setAiUnlockData] = useState(null)
  const [customUnlockBusy, setCustomUnlockBusy] = useState(false)
  const [myStickerModalOpen, setMyStickerModalOpen] = useState(false)
  const [myStickerModeConfirmed, setMyStickerModeConfirmed] = useState(false)
  const [previewPage, setPreviewPage] = useState(0)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [myStickerSubmitting, setMyStickerSubmitting] = useState(false)
  const [orderResult, setOrderResult] = useState(null)
  const [pendingDownloadPath, setPendingDownloadPath] = useState('')
  const [pendingDownloadFileName, setPendingDownloadFileName] = useState('')
  const [pixCopied, setPixCopied] = useState(false)
  const [customUnlockCopied, setCustomUnlockCopied] = useState(false)
  const [myStickerForm, setMyStickerForm] = useState(createEmptyMyStickerForm)
  const [manualCutoutDataUrl, setManualCutoutDataUrl] = useState('')
  const [manualCutoutOriginalDataUrl, setManualCutoutOriginalDataUrl] = useState('')
  const [manualCutoutAssetToken, setManualCutoutAssetToken] = useState('')
  const [manualEditedPortraitFile, setManualEditedPortraitFile] = useState(null)
  const [manualCutoutBusy, setManualCutoutBusy] = useState(false)
  const [manualMaskEditorOpen, setManualMaskEditorOpen] = useState(false)
  const [publicFlowProgress, setPublicFlowProgress] = useState(null)
  const [manualStageElement, setManualStageElement] = useState(null)
  const [manualStageScale, setManualStageScale] = useState(MANUAL_STICKER_PREVIEW_FALLBACK_SCALE)
  const [myStickerDraftHydrated, setMyStickerDraftHydrated] = useState(false)
  const [pendingAiResume, setPendingAiResume] = useState(false)
  const myStickerCameraInputRef = useRef(null)
  const myStickerGalleryInputRef = useRef(null)
  const [orderForm, setOrderForm] = useState({
    service_type: 'IMPRESSAO',
    customer_name: '',
    customer_whatsapp: '',
    notes: ''
  })

  const patchMyStickerDraftStorage = useCallback(
    patch => {
      const draftStorageKey = createMyStickerDraftStorageKey(sessionToken, selectedAlbumSlug)
      if (!draftStorageKey) return
      let currentDraft = {}
      try {
        currentDraft = JSON.parse(window.localStorage.getItem(draftStorageKey) || '{}') || {}
      } catch {
        currentDraft = {}
      }
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          ...currentDraft,
          ...patch,
          updated_at: Date.now()
        })
      )
    },
    [sessionToken, selectedAlbumSlug]
  )

  const setAiResumeIntent = useCallback(
    (enabled, extraPatch = {}) => {
      setPendingAiResume(enabled)
      patchMyStickerDraftStorage({
        pending_ai_resume: enabled,
        ...extraPatch
      })
    },
    [patchMyStickerDraftStorage]
  )

  const persistAiUnlockedDraft = useCallback(() => {
    patchMyStickerDraftStorage({
      custom_unlock_context: 'AI_CREATE',
      custom_unlock_modal_open: false,
      custom_unlock_step: 'choice',
      my_sticker_modal_open: true,
      mode_confirmed: true,
      form: {
        ...myStickerForm,
        photo: null,
        requested_composition_mode: 'AI_OPTIONAL'
      }
    })
  }, [patchMyStickerDraftStorage, myStickerForm])

  function toCustomSelectionItem(sticker) {
    return {
      ...sticker,
      category: sticker.category || 'JOGADOR',
      collection_slug: '__minha_figurinha__',
      collection_name: 'Minha Figurinha'
    }
  }
  const selectedAlbum = useMemo(
    () => albums.find(album => album.slug === selectedAlbumSlug) || null,
    [albums, selectedAlbumSlug]
  )
  const availableCollections = selectedAlbum?.collections || []
  const groupedAvailableCollections = useMemo(
    () =>
      publicCollectionGroups
        .map(group => ({
          ...group,
          items: availableCollections.filter(collection => (collection.collection_type || 'SELECAO') === group.type)
        }))
        .filter(group => group.items.length > 0),
    [availableCollections]
  )
  const activeMobileCollectionGroup = useMemo(
    () =>
      groupedAvailableCollections.find(group => group.type === mobileCollectionTypeFilter) ||
      groupedAvailableCollections[0] ||
      null,
    [groupedAvailableCollections, mobileCollectionTypeFilter]
  )
  const activeDesktopCollectionGroup = useMemo(
    () =>
      groupedAvailableCollections.find(group => group.type === desktopCollectionTypeFilter) ||
      groupedAvailableCollections[0] ||
      null,
    [groupedAvailableCollections, desktopCollectionTypeFilter]
  )
  const selectedCollection = useMemo(
    () => availableCollections.find(collection => collection.slug === selectedCollectionSlug) || null,
    [availableCollections, selectedCollectionSlug]
  )
  const availablePdfExtras = useMemo(
    () => {
      if (!selectedCollection || (selectedCollection.collection_type || 'SELECAO') !== 'OUTROS') {
        return []
      }
      return availableCollections.filter(
        collection =>
          (collection.collection_type || 'SELECAO') === 'OUTROS' &&
          collection.export_mode === 'APPEND_FULL_PDF' &&
          (collection.page_count > 0 || collection.preview_image_path)
      )
    },
    [availableCollections, selectedCollection]
  )
  const showPdfExtrasPanel = selectedCollection?.collection_type === 'OUTROS' && availablePdfExtras.length > 0
  function supportsApplyExtraToAllSheets(collection) {
    if (!collection) return false
    const slug = (collection.slug || '').trim().toLowerCase()
    const name = (collection.name || '').trim().toUpperCase()
    return slug === 'verso' || name === 'VERSO'
  }
  const normalizedSelectedExportExtras = useMemo(
    () =>
      availablePdfExtras
        .map(collection => ({
          collection_id: collection.id,
          apply_to_all_sheets: Boolean(selectedExportExtraApplyAll[collection.id]),
          quantity: (() => {
            if (selectedExportExtraApplyAll[collection.id]) {
              return 0
            }
            const currentQuantity = Math.max(0, Number(selectedExportExtras[collection.id] || 0))
            const maxQuantity = Number(collection.max_quantity_per_order || 0)
            return maxQuantity > 0 ? Math.min(currentQuantity, maxQuantity) : currentQuantity
          })()
        }))
        .filter(item => item.quantity > 0 || item.apply_to_all_sheets),
    [availablePdfExtras, selectedExportExtras, selectedExportExtraApplyAll]
  )
  const selectedExtraCopies = useMemo(
    () =>
      normalizedSelectedExportExtras.reduce(
        (total, item) => total + (item.apply_to_all_sheets ? 1 : item.quantity),
        0
      ),
    [normalizedSelectedExportExtras]
  )
  const selectedIds = useMemo(() => selectedStickers.map(sticker => sticker.id), [selectedStickers])
  const hasExportSelection = selectedIds.length > 0 || selectedExtraCopies > 0
  const exportSelectionCount = selectedIds.length + selectedExtraCopies
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
    () => {
      const grouped = selectedStickers.reduce((accumulator, sticker) => {
        const key = sticker.collection_slug
        if (!accumulator[key]) {
          accumulator[key] = {
            slug: key,
            name: sticker.collection_name,
            count: 0
          }
        }
        accumulator[key].count += 1
        return accumulator
      }, {})

      const ordered = []
      availableCollections.forEach(collection => {
        if (grouped[collection.slug]) {
          ordered.push(grouped[collection.slug])
          delete grouped[collection.slug]
        }
      })
      Object.values(grouped)
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
        .forEach(item => ordered.push(item))
      return ordered
    },
    [availableCollections, selectedStickers]
  )
  const activeCategoryLabel = useMemo(
    () => categoryOptions.find(option => option.value === category)?.label || 'Filtros',
    [category]
  )
  const customStickerSelected = useMemo(
    () => !!customSticker && selectedStickers.some(sticker => sticker.id === customSticker.id),
    [customSticker, selectedStickers]
  )
  const customStickerNeedsManualUnlock = useMemo(
    () =>
      Boolean(
        customSticker &&
          customSticker.composition_mode_used !== 'AI_OPTIONAL' &&
          serviceConfig?.custom_sticker_unlock_enabled
      ),
    [customSticker, serviceConfig?.custom_sticker_unlock_enabled]
  )
  const customStickerNeedsAiUnlock = useMemo(
    () =>
      Boolean(
        customSticker &&
          customSticker.composition_mode_used === 'AI_OPTIONAL' &&
          serviceConfig?.custom_ai_unlock_enabled
      ),
    [customSticker, serviceConfig?.custom_ai_unlock_enabled]
  )
  const customAiUnlockAvailable = Boolean(aiUnlockData?.access_granted)
  const customManualUnlockAvailable = Boolean(customUnlockData?.access_granted)
  const activeUnlockData = customUnlockContext === 'AI_CREATE' ? aiUnlockData : customUnlockData
  const activeUnlockPriceCents =
    customUnlockContext === 'AI_CREATE'
      ? serviceConfig?.custom_ai_unlock_price_cents
      : serviceConfig?.custom_sticker_unlock_price_cents
  const activeUnlockMessage =
    customUnlockContext === 'AI_CREATE'
      ? serviceConfig?.custom_ai_unlock_message ||
        'A criacao com IA e um recurso premium. Pague primeiro para liberar a geracao da sua figurinha.'
      : serviceConfig?.custom_sticker_unlock_message ||
        'Sua figurinha personalizada e um recurso especial. Voce pode baixar gratis sem ela ou liberar o PDF completo por R$ 5,00.'
  const manualUnlockPriceLabel = formatCurrency(serviceConfig?.custom_sticker_unlock_price_cents || 0)
  const aiUnlockPriceLabel = formatCurrency(serviceConfig?.custom_ai_unlock_price_cents || 0)
  const activeUnlockRemainingUses = Math.max(Number(activeUnlockData?.remaining_uses || 0), 0)
  const activeUnlockTotalUses = Math.max(Number(activeUnlockData?.total_uses || 0), 0)
  const activeUnlockUsageLabel =
    customUnlockContext === 'AI_CREATE'
      ? `${activeUnlockRemainingUses} tentativa${activeUnlockRemainingUses === 1 ? '' : 's'} restante${activeUnlockRemainingUses === 1 ? '' : 's'}`
      : `${activeUnlockRemainingUses} uso${activeUnlockRemainingUses === 1 ? '' : 's'} restante${activeUnlockRemainingUses === 1 ? '' : 's'}`
  const activeUnlockCompactUsageLabel =
    customUnlockContext === 'AI_CREATE'
      ? activeUnlockData?.status === 'PAGO'
        ? String(activeUnlockRemainingUses)
        : activeUnlockTotalUses > 0
          ? String(activeUnlockTotalUses)
          : '2'
      : activeUnlockData?.status === 'PAGO'
        ? String(activeUnlockRemainingUses)
        : activeUnlockTotalUses > 0
          ? String(activeUnlockTotalUses)
          : '5'
  const freeSelectedIds = useMemo(
    () => selectedStickers.filter(sticker => sticker.source_type !== 'GENERATED').map(sticker => sticker.id),
    [selectedStickers]
  )
  const currentTemplateOptions = useMemo(
    () =>
      customTemplateOptions.filter(
        template =>
          template.profile_type === myStickerForm.profile_type &&
          template.category_type === (myStickerForm.category_type || 'JOGADOR') &&
          template.position_type === (myStickerForm.position_type || 'ATACANTE')
      ),
    [customTemplateOptions, myStickerForm.profile_type, myStickerForm.category_type, myStickerForm.position_type]
  )
  const currentManualTemplateOptions = useMemo(
    () => currentTemplateOptions.filter(template => template.manual_ready),
    [currentTemplateOptions]
  )
  const manualPreviewTemplate = useMemo(
    () => currentManualTemplateOptions[0] || currentTemplateOptions[0] || null,
    [currentManualTemplateOptions, currentTemplateOptions]
  )
  const manualTemplateExists = currentTemplateOptions.length > 0
  const manualCreationAvailable = currentManualTemplateOptions.length > 0
  const aiCreationAvailable = serviceConfig?.custom_generation_mode === 'AI_OPTIONAL'
  const currentGenerationModeOptions = useMemo(() => {
    const modes = []
    if (manualTemplateExists || serviceConfig?.custom_generation_mode === 'LAYERS') {
      modes.push({
        ...publicCustomCreationModes[0],
        disabled: !manualCreationAvailable,
        description: manualCreationAvailable
          ? 'Monte gratis agora e decida no final se quer baixar com ela no PDF.'
          : manualTemplateExists
            ? 'Esse modelo ainda esta em preparo. Finalize as camadas no administrador.'
            : 'Ainda nao existe um modelo manual cadastrado para esse perfil e posicao.'
      })
    }
    if (aiCreationAvailable) {
      modes.push({
        ...publicCustomCreationModes[1],
        disabled: false
      })
    }
    return modes
  }, [aiCreationAvailable, manualCreationAvailable, manualTemplateExists, serviceConfig?.custom_generation_mode])
  const effectiveTemplateOptions = useMemo(
    () =>
      myStickerForm.requested_composition_mode === 'LAYERS'
        ? currentManualTemplateOptions
        : currentTemplateOptions,
    [currentManualTemplateOptions, currentTemplateOptions, myStickerForm.requested_composition_mode]
  )
  const selectedMyStickerTemplate = useMemo(
    () =>
      effectiveTemplateOptions.find(template => String(template.id) === String(myStickerForm.template_id)) ||
      effectiveTemplateOptions[0] ||
      null,
    [effectiveTemplateOptions, myStickerForm.template_id]
  )
  const aiModePreview = useMemo(
    () => customBasePathForProfile(serviceConfig, myStickerForm.profile_type),
    [myStickerForm.profile_type, serviceConfig]
  )
  const manualPreviewLayers = useMemo(
    () =>
      (selectedMyStickerTemplate?.layers || [])
        .filter(layer => layer.is_active && layer.file_path)
        .sort((left, right) => (left.z_index || 0) - (right.z_index || 0)),
    [selectedMyStickerTemplate]
  )
  const manualPreviewPhotoSlot = selectedMyStickerTemplate?.photo_slot || null
  const manualPreviewTextSlots = useMemo(
    () => (selectedMyStickerTemplate?.text_slots || []).filter(slot => slot.width > 0),
    [selectedMyStickerTemplate]
  )
  const manualPreviewVisibleBox = useMemo(() => {
    if (!manualPreviewPhotoSlot) return null
    const visibleX = Math.min(Math.max(Number(manualPreviewPhotoSlot.visible_x ?? 0), 0), 1)
    const visibleY = Math.min(Math.max(Number(manualPreviewPhotoSlot.visible_y ?? 0), 0), 1)
    const visibleWidth = Math.min(Math.max(Number(manualPreviewPhotoSlot.visible_width ?? 1), 0.01), 1)
    const visibleHeight = Math.min(Math.max(Number(manualPreviewPhotoSlot.visible_height ?? 0.9), 0.01), 1)
    return {
      left: ((manualPreviewPhotoSlot.x || 0) + (manualPreviewPhotoSlot.width || 0) * visibleX) * 100,
      top: ((manualPreviewPhotoSlot.y || 0) + (manualPreviewPhotoSlot.height || 0) * visibleY) * 100,
      width: (manualPreviewPhotoSlot.width || 0) * visibleWidth * 100,
      height: (manualPreviewPhotoSlot.height || 0) * visibleHeight * 100
    }
  }, [manualPreviewPhotoSlot])

  useEffect(() => {
    if (!manualStageElement) {
      setManualStageScale(MANUAL_STICKER_PREVIEW_FALLBACK_SCALE)
      return undefined
    }

    const updateManualStageScale = () => {
      const rect = manualStageElement.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const nextScale = Math.max(
        0.2,
        Math.min(
          rect.width / MANUAL_STICKER_RENDER_BASE_WIDTH,
          rect.height / MANUAL_STICKER_RENDER_BASE_HEIGHT
        )
      )
      setManualStageScale(current => (Math.abs(current - nextScale) < 0.01 ? current : nextScale))
    }

    updateManualStageScale()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateManualStageScale)
      return () => window.removeEventListener('resize', updateManualStageScale)
    }

    const observer = new ResizeObserver(() => updateManualStageScale())
    observer.observe(manualStageElement)
    return () => observer.disconnect()
  }, [manualStageElement])

  function dismissPublicFlowProgress() {
    setPublicFlowProgress(null)
  }

  function syncPublicFlowProgress(job) {
    if (!job) return
    setPublicFlowProgress({
      key: job.job_id,
      title: job.title,
      subtitle: job.subtitle,
      label: job.message || '',
      activeStepIndex: typeof job.step_index === 'number' ? job.step_index : 0,
      isComplete: job.status === 'CONCLUIDO',
      steps: job.steps || []
    })
  }

  async function waitForPublicJob(path, options = {}) {
    let job = await apiFetch(path, options)
    syncPublicFlowProgress(job)

    while (job && (job.status === 'PENDENTE' || job.status === 'PROCESSANDO')) {
      await new Promise(resolve => window.setTimeout(resolve, 700))
      job = await apiFetch(
        `/public-jobs/${encodeURIComponent(job.job_id)}?session_token=${encodeURIComponent(sessionToken)}`
      )
      syncPublicFlowProgress(job)
    }

    if (!job) {
      dismissPublicFlowProgress()
      throw new Error('Nao foi possivel concluir a operacao.')
    }
    if (job.status === 'FALHOU') {
      dismissPublicFlowProgress()
      throw new Error(job.error || job.message || 'Nao foi possivel concluir a operacao.')
    }

    syncPublicFlowProgress(job)
    await new Promise(resolve => window.setTimeout(resolve, 420))
    dismissPublicFlowProgress()
    return job.result
  }

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
        setSelectedAlbumSlug(current =>
          collectionsData.some(album => album.slug === current) ? current : collectionsData[0]?.slug || ''
        )
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
    if (!selectedAlbumSlug) {
      setCustomTemplateOptions([])
      return
    }

    let ignore = false
    async function loadTemplates() {
      try {
        const data = await apiFetch(`/custom-templates?album_slug=${encodeURIComponent(selectedAlbumSlug)}`)
        if (!ignore) {
          setCustomTemplateOptions(data)
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message)
          setCustomTemplateOptions([])
        }
      }
    }
    loadTemplates()
    return () => {
      ignore = true
    }
  }, [selectedAlbumSlug])

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
    if (!selectedAlbumSlug) {
      setCustomSticker(null)
      setCustomUnlockData(null)
      setAiUnlockData(null)
      return
    }

    let ignore = false
    async function loadMySticker() {
      try {
        const data = await apiFetch(`/albums/${selectedAlbumSlug}/my-sticker?session_token=${encodeURIComponent(sessionToken)}`)
        if (ignore) return
        setCustomSticker(data)
        if (data) {
          setMyStickerForm(current => ({
            ...current,
            name: data.name || '',
            profile_type: normalizeCustomProfileValue(data.profile_type) || 'HOMEM',
            category_type: data.custom_category_type || 'JOGADOR',
            position_type: data.custom_position_type || 'ATACANTE',
            requested_composition_mode: data.composition_mode_used || current.requested_composition_mode || 'LAYERS',
            template_id: data.template_id ? String(data.template_id) : '',
            photo_offset_x: String(data.photo_offset_x ?? 0),
            photo_offset_y: String(data.photo_offset_y ?? 0),
            photo_scale: String(data.photo_scale ?? 1),
            photo_rotation: String(data.photo_rotation ?? 0),
            birth_date_text: data.birth_date_text || '',
            height_text: data.height_text || '',
            weight_text: data.weight_text || '',
            city_or_team: data.city_or_team || '',
            photo: null
          }))
        }
      } catch (err) {
        if (!ignore) {
          setCustomSticker(null)
        }
      }
    }
    loadMySticker()
    return () => {
      ignore = true
    }
  }, [selectedAlbumSlug, sessionToken])

  useEffect(() => {
    if (!selectedAlbumSlug || !customSticker || !customStickerNeedsManualUnlock) {
      setCustomUnlockData(null)
      return
    }

    let ignore = false
    async function loadCustomUnlock() {
      try {
        const data = await apiFetch(
          `/albums/${selectedAlbumSlug}/my-sticker-unlock?session_token=${encodeURIComponent(sessionToken)}`
        )
        if (!ignore) {
          setCustomUnlockData(data)
        }
      } catch {
        if (!ignore) {
          setCustomUnlockData(null)
        }
      }
    }
    loadCustomUnlock()
    return () => {
      ignore = true
    }
  }, [selectedAlbumSlug, customSticker, customStickerNeedsManualUnlock, sessionToken])

  useEffect(() => {
    if (!selectedAlbumSlug || !serviceConfig?.custom_ai_unlock_enabled) {
      setAiUnlockData(null)
      return
    }

    let ignore = false
    async function loadAiUnlock() {
      try {
        const data = await apiFetch(
          `/albums/${selectedAlbumSlug}/my-sticker/ai-unlock?session_token=${encodeURIComponent(sessionToken)}`
        )
        if (!ignore) {
          setAiUnlockData(data)
        }
      } catch {
        if (!ignore) {
          setAiUnlockData(null)
        }
      }
    }
    loadAiUnlock()
    return () => {
      ignore = true
    }
  }, [selectedAlbumSlug, serviceConfig?.custom_ai_unlock_enabled, sessionToken])

  useEffect(() => {
    const draftStorageKey = createMyStickerDraftStorageKey(sessionToken, selectedAlbumSlug)
    if (!draftStorageKey) {
      setMyStickerDraftHydrated(true)
      return
    }

    let cancelled = false
    async function restoreMyStickerDraft() {
      setMyStickerDraftHydrated(false)
      try {
        const rawDraft = window.localStorage.getItem(draftStorageKey)
        if (!rawDraft) {
          if (!cancelled) setMyStickerDraftHydrated(true)
          return
        }
        const parsed = JSON.parse(rawDraft)
        const restoredForm = {
          ...createEmptyMyStickerForm(),
          ...(parsed.form || {}),
          photo: null
        }
        const [restoredPhoto, restoredEditedPortrait] = await Promise.all([
          loadMyStickerDraftAsset(createMyStickerDraftAssetKey(sessionToken, selectedAlbumSlug, 'photo')),
          loadMyStickerDraftAsset(createMyStickerDraftAssetKey(sessionToken, selectedAlbumSlug, 'edited-portrait'))
        ])
        if (cancelled) return
        setMyStickerForm(current => ({
          ...current,
          ...restoredForm,
          photo: restoredPhoto || null
        }))
        setMyStickerModeConfirmed(Boolean(parsed.mode_confirmed))
        setManualCutoutDataUrl(parsed.manual_cutout_data_url || '')
        setManualCutoutOriginalDataUrl(parsed.manual_cutout_original_data_url || '')
        setManualCutoutAssetToken(parsed.manual_cutout_asset_token || '')
        setManualEditedPortraitFile(restoredEditedPortrait || null)
        setCustomUnlockContext(parsed.custom_unlock_context || 'MANUAL_PDF')
        setCustomUnlockStep(parsed.custom_unlock_step || 'choice')
        setPendingAiResume(Boolean(parsed.pending_ai_resume))
        const shouldResumeAiAfterReturn = Boolean(parsed.pending_ai_resume)
        if ((parsed.my_sticker_modal_open || shouldResumeAiAfterReturn) && !customSticker) {
          setMyStickerModalOpen(true)
        }
        if (parsed.custom_unlock_modal_open && !shouldResumeAiAfterReturn) {
          setCustomUnlockModalOpen(true)
        }
      } catch {
        window.localStorage.removeItem(draftStorageKey)
      } finally {
        if (!cancelled) {
          setMyStickerDraftHydrated(true)
        }
      }
    }
    restoreMyStickerDraft()
    return () => {
      cancelled = true
    }
  }, [selectedAlbumSlug, sessionToken])

  useEffect(() => {
    if (!myStickerDraftHydrated) return
    const draftStorageKey = createMyStickerDraftStorageKey(sessionToken, selectedAlbumSlug)
    if (!draftStorageKey) return

    const hasMeaningfulDraft =
      Boolean(myStickerForm.photo) ||
      Boolean(manualCutoutAssetToken) ||
      Boolean(myStickerForm.name?.trim()) ||
      Boolean(myStickerModalOpen) ||
      Boolean(customUnlockModalOpen)

    if (!hasMeaningfulDraft) {
      window.localStorage.removeItem(draftStorageKey)
      clearMyStickerDraftAssets(sessionToken, selectedAlbumSlug).catch(() => {})
      return
    }

    const payload = {
      form: {
        ...myStickerForm,
        photo: null
      },
      mode_confirmed: myStickerModeConfirmed,
      my_sticker_modal_open: myStickerModalOpen,
      custom_unlock_modal_open: customUnlockModalOpen,
      custom_unlock_context: customUnlockContext,
      custom_unlock_step: customUnlockStep,
      pending_ai_resume: pendingAiResume,
      manual_cutout_data_url: manualCutoutDataUrl,
      manual_cutout_original_data_url: manualCutoutOriginalDataUrl,
      manual_cutout_asset_token: manualCutoutAssetToken,
      updated_at: Date.now()
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload))
  }, [
    myStickerDraftHydrated,
    sessionToken,
    selectedAlbumSlug,
    myStickerForm,
    myStickerModeConfirmed,
    myStickerModalOpen,
    customUnlockModalOpen,
    customUnlockContext,
    customUnlockStep,
    pendingAiResume,
    manualCutoutDataUrl,
    manualCutoutOriginalDataUrl,
    manualCutoutAssetToken
  ])

  useEffect(() => {
    if (!myStickerDraftHydrated || !selectedAlbumSlug) return
    saveMyStickerDraftAsset(
      createMyStickerDraftAssetKey(sessionToken, selectedAlbumSlug, 'photo'),
      myStickerForm.photo || null
    ).catch(() => {})
  }, [myStickerDraftHydrated, sessionToken, selectedAlbumSlug, myStickerForm.photo])

  useEffect(() => {
    if (!myStickerDraftHydrated || !selectedAlbumSlug) return
    saveMyStickerDraftAsset(
      createMyStickerDraftAssetKey(sessionToken, selectedAlbumSlug, 'edited-portrait'),
      manualEditedPortraitFile || null
    ).catch(() => {})
  }, [myStickerDraftHydrated, sessionToken, selectedAlbumSlug, manualEditedPortraitFile])

  useEffect(() => {
    setMyStickerForm(current => {
      const enabledModeOptions = currentGenerationModeOptions.filter(option => !option.disabled)
      const nextMode = enabledModeOptions.some(option => option.value === current.requested_composition_mode)
        ? current.requested_composition_mode
        : enabledModeOptions[0]?.value || 'LAYERS'
      const templatePool = nextMode === 'LAYERS' ? currentManualTemplateOptions : currentTemplateOptions
      const templateStillValid = current.template_id
        ? templatePool.some(template => String(template.id) === String(current.template_id))
        : false
      const nextTemplateId = templateStillValid
        ? current.template_id
        : templatePool.length === 1
          ? String(templatePool[0].id)
          : ''
      if (nextTemplateId === current.template_id && nextMode === current.requested_composition_mode) {
        return current
      }
      return {
        ...current,
        requested_composition_mode: nextMode,
        template_id: nextTemplateId
      }
    })
  }, [currentGenerationModeOptions, currentManualTemplateOptions, currentTemplateOptions])

  useEffect(() => {
    if (!customUnlockModalOpen || customUnlockStep !== 'payment' || activeUnlockData?.status !== 'PENDENTE') {
      return undefined
    }
    const timer = window.setInterval(() => {
      refreshCustomUnlock(false, customUnlockContext)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [customUnlockModalOpen, customUnlockStep, activeUnlockData?.status, customUnlockContext, selectedAlbumSlug, sessionToken, selectedIds, customStickerSelected])

  useEffect(() => {
    if (!selectedAlbumSlug || !hasExportSelection) {
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
            sticker_ids: selectedIds,
            session_token: sessionToken,
            extras: normalizedSelectedExportExtras
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
  }, [selectedAlbumSlug, hasExportSelection, selectedIds, sessionToken, normalizedSelectedExportExtras])

  useEffect(() => {
    setOrderResult(null)
  }, [selectedAlbumSlug, selectedIds, normalizedSelectedExportExtras])

  useEffect(() => {
    setSelectedExportExtras({})
    setSelectedExportExtraApplyAll({})
  }, [selectedAlbumSlug])

  useEffect(() => {
    setSelectedExportExtras(current => {
      const allowedIds = new Set(availablePdfExtras.map(collection => collection.id))
      const nextEntries = Object.entries(current).filter(([key]) => allowedIds.has(Number(key)))
      if (nextEntries.length === Object.keys(current).length) {
        return current
      }
      return Object.fromEntries(nextEntries)
    })
    setSelectedExportExtraApplyAll(current => {
      const allowedIds = new Set(availablePdfExtras.map(collection => collection.id))
      const nextEntries = Object.entries(current).filter(([key]) => allowedIds.has(Number(key)))
      if (nextEntries.length === Object.keys(current).length) {
        return current
      }
      return Object.fromEntries(nextEntries)
    })
  }, [availablePdfExtras])

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
    if (!customUnlockModalOpen) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape') {
        handleCloseCustomUnlockModal()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [customUnlockModalOpen])

  useEffect(() => {
    if (!myStickerModalOpen) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setMyStickerModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [myStickerModalOpen])

  useEffect(() => {
    if (!mobileAlbumPickerOpen && !mobileFilterOpen) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setMobileAlbumPickerOpen(false)
        setMobileFilterOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [mobileAlbumPickerOpen, mobileFilterOpen])

  useEffect(() => {
    if (!groupedAvailableCollections.length) return
    if (!groupedAvailableCollections.some(group => group.type === mobileCollectionTypeFilter)) {
      setMobileCollectionTypeFilter(groupedAvailableCollections[0].type)
    }
  }, [groupedAvailableCollections, mobileCollectionTypeFilter])

  useEffect(() => {
    if (!groupedAvailableCollections.length) return
    if (!groupedAvailableCollections.some(group => group.type === desktopCollectionTypeFilter)) {
      setDesktopCollectionTypeFilter(groupedAvailableCollections[0].type)
    }
  }, [groupedAvailableCollections, desktopCollectionTypeFilter])

  useEffect(() => {
    if (!selectedCollection?.collection_type) return
    setMobileCollectionTypeFilter(selectedCollection.collection_type)
  }, [selectedCollectionSlug])

  useEffect(() => {
    if (!selectedCollection?.collection_type) return
    setDesktopCollectionTypeFilter(selectedCollection.collection_type)
  }, [selectedCollectionSlug])

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
    if (!customUnlockModalOpen) {
      setCustomUnlockCopied(false)
      setCustomUnlockStep('choice')
    }
  }, [customUnlockModalOpen])

  useEffect(() => {
    if (!myStickerModalOpen || !customSticker) return
    setManualCutoutDataUrl('')
    setManualCutoutOriginalDataUrl('')
    setManualCutoutAssetToken('')
    setManualEditedPortraitFile(null)
    setManualMaskEditorOpen(false)
    setMyStickerModeConfirmed(true)
    setMyStickerForm(current => ({
      name: customSticker.name || current.name || '',
      profile_type: normalizeCustomProfileValue(customSticker.profile_type) || current.profile_type || 'HOMEM',
      category_type: customSticker.custom_category_type || current.category_type || 'JOGADOR',
      position_type: customSticker.custom_position_type || current.position_type || 'ATACANTE',
      template_id: customSticker.template_id ? String(customSticker.template_id) : current.template_id || '',
      photo_offset_x: String(customSticker.photo_offset_x ?? current.photo_offset_x ?? 0),
      photo_offset_y: String(customSticker.photo_offset_y ?? current.photo_offset_y ?? 0),
      photo_scale: String(customSticker.photo_scale ?? current.photo_scale ?? 1),
      photo_rotation: String(customSticker.photo_rotation ?? current.photo_rotation ?? 0),
      birth_date_text: normalizeDateInput(customSticker.birth_date_text || ''),
      height_text: stripHeightUnit(customSticker.height_text || ''),
      weight_text: stripWeightUnit(customSticker.weight_text || ''),
      city_or_team: customSticker.city_or_team || '',
      photo: null
    }))
  }, [myStickerModalOpen, customSticker])

  useEffect(() => {
    if (!customUnlockModalOpen || customUnlockContext !== 'AI_CREATE' || !aiUnlockData?.access_granted) return
    persistAiUnlockedDraft()
    setCustomUnlockModalOpen(false)
    setMyStickerModalOpen(true)
    activateMyStickerMode('AI_OPTIONAL')
  }, [customUnlockModalOpen, customUnlockContext, aiUnlockData?.access_granted, persistAiUnlockedDraft])

  useEffect(() => {
    if (!myStickerDraftHydrated || !aiUnlockData?.access_granted || customSticker) return
    const shouldResumeAiFlow =
      pendingAiResume ||
      customUnlockContext === 'AI_CREATE' ||
      customUnlockModalOpen ||
      myStickerForm.requested_composition_mode === 'AI_OPTIONAL'
    if (!shouldResumeAiFlow) return
    persistAiUnlockedDraft()
    setCustomUnlockModalOpen(false)
    setMyStickerModalOpen(true)
    if (!myStickerModeConfirmed || myStickerForm.requested_composition_mode !== 'AI_OPTIONAL') {
      setMyStickerModeConfirmed(true)
      setMyStickerForm(current => ({
        ...current,
        requested_composition_mode: 'AI_OPTIONAL',
        template_id: current.requested_composition_mode === 'AI_OPTIONAL' ? current.template_id : ''
      }))
    }
  }, [
    myStickerDraftHydrated,
    aiUnlockData?.access_granted,
    customSticker,
    pendingAiResume,
    customUnlockContext,
    customUnlockModalOpen,
    myStickerForm.requested_composition_mode,
    myStickerModeConfirmed,
    persistAiUnlockedDraft
  ])

  useEffect(() => {
    if (
      !pendingAiResume ||
      !myStickerModalOpen ||
      !customAiUnlockAvailable ||
      !myStickerModeConfirmed ||
      myStickerForm.requested_composition_mode !== 'AI_OPTIONAL'
    ) {
      return
    }
    setAiResumeIntent(false, {
      custom_unlock_context: 'AI_CREATE',
      custom_unlock_modal_open: false,
      custom_unlock_step: 'choice',
      my_sticker_modal_open: true,
      mode_confirmed: true
    })
  }, [
    pendingAiResume,
    myStickerModalOpen,
    customAiUnlockAvailable,
    myStickerModeConfirmed,
    myStickerForm.requested_composition_mode,
    setAiResumeIntent
  ])

  useEffect(() => {
    if (!pendingAiResume || !selectedAlbumSlug) return undefined

    let timer = null
    function handleWake() {
      if (document.visibilityState === 'hidden') return
      if (timer) {
        window.clearTimeout(timer)
      }
      timer = window.setTimeout(() => {
        refreshCustomUnlock(false, 'AI_CREATE')
      }, 300)
    }

    window.addEventListener('focus', handleWake)
    document.addEventListener('visibilitychange', handleWake)
    return () => {
      if (timer) {
        window.clearTimeout(timer)
      }
      window.removeEventListener('focus', handleWake)
      document.removeEventListener('visibilitychange', handleWake)
    }
  }, [pendingAiResume, selectedAlbumSlug, sessionToken])

  useEffect(() => {
    if (!customSticker?.id || !selectedAlbumSlug) return
    const draftStorageKey = createMyStickerDraftStorageKey(sessionToken, selectedAlbumSlug)
    if (draftStorageKey) {
      window.localStorage.removeItem(draftStorageKey)
    }
    clearMyStickerDraftAssets(sessionToken, selectedAlbumSlug).catch(() => {})
  }, [customSticker?.id, selectedAlbumSlug, sessionToken])

  useEffect(() => {
    setPreviewPage(current => Math.min(current, previewPageCount - 1))
  }, [previewPageCount])

  useEffect(() => () => setPublicFlowProgress(null), [])

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

  function updateExportExtraQuantity(collectionId, nextQuantity, maxQuantity) {
    setSelectedExportExtras(current => {
      const requested = Math.max(0, Number(nextQuantity || 0))
      const normalized = Number(maxQuantity || 0) > 0 ? Math.min(requested, Number(maxQuantity)) : requested
      if (normalized <= 0) {
        const { [collectionId]: _removed, ...rest } = current
        return rest
      }
      return {
        ...current,
        [collectionId]: normalized
      }
    })
  }

  function toggleExportExtraApplyAll(collectionId, enabled) {
    setSelectedExportExtraApplyAll(current => ({
      ...current,
      [collectionId]: Boolean(enabled)
    }))
    if (enabled) {
      setSelectedExportExtras(current => {
        const { [collectionId]: _removed, ...rest } = current
        return rest
      })
    }
  }

  function toggleCustomStickerSelection() {
    if (!customSticker) return
    const selectionItem = toCustomSelectionItem(customSticker)
    setSelectedStickers(current =>
      current.some(sticker => sticker.id === customSticker.id)
        ? current.filter(sticker => sticker.id !== customSticker.id)
        : [...current.filter(sticker => sticker.source_type !== 'GENERATED'), selectionItem]
    )
  }

  function selectCurrentCollectionStickers() {
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

  function clearSelection() {
    setSelectedStickers([])
  }

  async function handleDeleteMySticker() {
    if (!customSticker || !selectedAlbumSlug) return
    setError('')
    try {
      await apiFetch(
        `/albums/${selectedAlbumSlug}/my-sticker/${customSticker.id}?session_token=${encodeURIComponent(sessionToken)}`,
        { method: 'DELETE' }
      )
      setCustomSticker(null)
      setSelectedStickers(current => current.filter(sticker => sticker.id !== customSticker.id))
      setMyStickerModalOpen(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDownloadMySticker() {
    if (!customSticker?.preview_path) return
    setError('')
    try {
      const blob = await apiFetch(`/files/${customSticker.preview_path}`)
      downloadBlob(blob, `${buildSlug(customSticker.name || 'minha-figurinha') || 'minha-figurinha'}.png`)
    } catch (err) {
      setError(err.message)
    }
  }

  function handleMyStickerPhotoChange(file) {
    setMyStickerForm(current => ({
      ...current,
      photo: file || null,
      photo_offset_x: '0',
      photo_offset_y: '0',
      photo_scale: String(manualPreviewPhotoSlot?.default_scale ?? 1),
      photo_rotation: '0'
    }))
    setManualCutoutDataUrl('')
    setManualCutoutOriginalDataUrl('')
    setManualCutoutAssetToken('')
    setManualEditedPortraitFile(null)
    setManualMaskEditorOpen(false)
  }

  function handleMyStickerPhotoInput(event) {
    const file = event.target.files?.[0] || null
    handleMyStickerPhotoChange(file)
    event.target.value = ''
  }

  function openMyStickerPhotoPicker(source) {
    if (source === 'camera') {
      myStickerCameraInputRef.current?.click()
      return
    }
    myStickerGalleryInputRef.current?.click()
  }

  function activateMyStickerMode(mode) {
    if (mode !== 'AI_OPTIONAL') {
      setAiResumeIntent(false, {
        custom_unlock_context: 'MANUAL_PDF',
        custom_unlock_modal_open: false,
        custom_unlock_step: 'choice'
      })
    }
    setMyStickerModeConfirmed(true)
    setManualCutoutDataUrl('')
    setManualCutoutOriginalDataUrl('')
    setManualCutoutAssetToken('')
    setManualEditedPortraitFile(null)
    setManualMaskEditorOpen(false)
    setMyStickerForm(current => ({
      ...current,
      requested_composition_mode: mode,
      template_id: ''
      }))
  }

  function handleCloseCustomUnlockModal() {
    const shouldClearAiIntent = customUnlockContext === 'AI_CREATE' && !aiUnlockData?.access_granted
    if (shouldClearAiIntent) {
      setAiResumeIntent(false, {
        custom_unlock_context: 'MANUAL_PDF',
        custom_unlock_modal_open: false,
        custom_unlock_step: 'choice'
      })
    }
    setCustomUnlockModalOpen(false)
  }

  function continueUnlockedAiFlow() {
    persistAiUnlockedDraft()
    setCustomUnlockModalOpen(false)
    setMyStickerModalOpen(true)
    setMyStickerModeConfirmed(true)
    setMyStickerForm(current => ({
      ...current,
      requested_composition_mode: 'AI_OPTIONAL',
      template_id: current.requested_composition_mode === 'AI_OPTIONAL' ? current.template_id : ''
    }))
  }

  async function handleChooseMyStickerMode(mode) {
    if (mode === 'AI_OPTIONAL' && serviceConfig?.custom_ai_unlock_enabled) {
      if (customAiUnlockAvailable) {
        activateMyStickerMode(mode)
        return
      }
      await handleStartCustomUnlock('AI_CREATE')
      return
    }
    activateMyStickerMode(mode)
  }

  async function handlePrepareMyStickerCutout() {
    if (!selectedAlbumSlug || !myStickerForm.photo) {
      setError('Escolha uma foto para preparar a montagem manual.')
      return
    }
    setManualCutoutBusy(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('session_token', sessionToken)
      formData.append('photo', myStickerForm.photo)
      const data = await waitForPublicJob(`/albums/${selectedAlbumSlug}/my-sticker-cutout-jobs`, {
        method: 'POST',
        body: formData
      })
      setMyStickerForm(current => ({
        ...current,
        photo_offset_x: '0',
        photo_offset_y: '0',
        photo_scale: String(manualPreviewPhotoSlot?.default_scale ?? 1),
        photo_rotation: '0'
      }))
      const portraitDataUrl = data?.portrait_image_data_url || data?.image_data_url || ''
      setManualCutoutDataUrl(portraitDataUrl)
      setManualCutoutOriginalDataUrl(portraitDataUrl)
      setManualCutoutAssetToken(data?.asset_token || '')
      setManualEditedPortraitFile(null)
      setManualMaskEditorOpen(false)
    } catch (err) {
      setManualCutoutDataUrl('')
      setManualCutoutOriginalDataUrl('')
      setManualCutoutAssetToken('')
      setManualEditedPortraitFile(null)
      setManualMaskEditorOpen(false)
      setError(err.message)
    } finally {
      setManualCutoutBusy(false)
    }
  }

  function handleApplyManualMaskEditor(result) {
    if (!result) return
    if (result.usesOriginal) {
      setManualCutoutDataUrl(manualCutoutOriginalDataUrl)
      setManualEditedPortraitFile(null)
    } else {
      setManualCutoutDataUrl(result.dataUrl || manualCutoutDataUrl)
      setManualEditedPortraitFile(result.file || null)
    }
    setManualMaskEditorOpen(false)
  }

  async function handleSubmitMySticker(event) {
    event.preventDefault()
    if (!selectedAlbumSlug || !myStickerForm.photo) {
      setError('Envie uma foto para criar a sua figurinha.')
      return
    }
    if (myStickerForm.requested_composition_mode === 'LAYERS' && !manualCreationAvailable) {
      setError('Ainda nao existe um modelo manual pronto para esse perfil e posicao.')
      return
    }
    if (
      myStickerForm.requested_composition_mode === 'LAYERS' &&
      effectiveTemplateOptions.length > 1 &&
      !myStickerForm.template_id
    ) {
      setError('Escolha um modelo manual para continuar.')
      return
    }
    if (myStickerForm.requested_composition_mode === 'LAYERS' && !manualCutoutDataUrl) {
      setError('Prepare a foto e ajuste a montagem manual antes de incluir no album.')
      return
    }
    if (
      myStickerForm.requested_composition_mode === 'AI_OPTIONAL' &&
      serviceConfig?.custom_ai_unlock_enabled
    ) {
      if (!customAiUnlockAvailable) {
        try {
          const latestAiUnlock = await apiFetch(
            `/albums/${selectedAlbumSlug}/my-sticker/ai-unlock?session_token=${encodeURIComponent(sessionToken)}`
          )
          setAiUnlockData(latestAiUnlock)
          if (!latestAiUnlock?.access_granted) {
            if (latestAiUnlock?.status === 'PAGO') {
              setError('Seu saldo da criacao com IA acabou. Gere um novo Pix para continuar.')
              setCustomUnlockContext('AI_CREATE')
              setCustomUnlockStep('payment')
              setCustomUnlockModalOpen(true)
              return
            }
            await handleStartCustomUnlock('AI_CREATE')
            return
          }
        } catch {
          await handleStartCustomUnlock('AI_CREATE')
          return
        }
      }
    }

    setMyStickerSubmitting(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('session_token', sessionToken)
      formData.append('name', myStickerForm.name)
      formData.append('profile_type', myStickerForm.profile_type)
      formData.append('category_type', myStickerForm.category_type || 'JOGADOR')
      formData.append('position_type', myStickerForm.position_type || 'ATACANTE')
      formData.append('requested_composition_mode', myStickerForm.requested_composition_mode || 'LAYERS')
      if (myStickerForm.template_id) {
        formData.append('template_id', myStickerForm.template_id)
      }
      if (manualCutoutAssetToken) {
        formData.append('prepared_cutout_token', manualCutoutAssetToken)
      }
      if (manualEditedPortraitFile) {
        formData.append('prepared_portrait', manualEditedPortraitFile, manualEditedPortraitFile.name || 'manual-portrait-adjust.png')
      }
      formData.append('birth_date_text', normalizeDateInput(myStickerForm.birth_date_text))
      formData.append('height_text', formatHeightForSticker(myStickerForm.height_text))
      formData.append('weight_text', formatWeightForSticker(myStickerForm.weight_text))
      formData.append('city_or_team', myStickerForm.city_or_team)
      formData.append('photo_offset_x', myStickerForm.photo_offset_x || '0')
      formData.append('photo_offset_y', myStickerForm.photo_offset_y || '0')
      formData.append('photo_scale', myStickerForm.photo_scale || '1')
      formData.append('photo_rotation', myStickerForm.photo_rotation || '0')
      formData.append('photo', myStickerForm.photo)

      const data = await waitForPublicJob(`/albums/${selectedAlbumSlug}/my-sticker-jobs`, {
        method: 'POST',
        body: formData
      })
      setCustomSticker(data)
      setSelectedStickers(current => [...current.filter(sticker => sticker.source_type !== 'GENERATED'), toCustomSelectionItem(data)])
      setMyStickerForm({
        name: data.name,
        profile_type: normalizeCustomProfileValue(data.profile_type) || 'HOMEM',
        category_type: data.custom_category_type || 'JOGADOR',
        position_type: data.custom_position_type || 'ATACANTE',
        requested_composition_mode: data.composition_mode_used || myStickerForm.requested_composition_mode || 'LAYERS',
        template_id: data.template_id ? String(data.template_id) : '',
        photo_offset_x: String(data.photo_offset_x ?? 0),
        photo_offset_y: String(data.photo_offset_y ?? 0),
        photo_scale: String(data.photo_scale ?? 1),
        photo_rotation: String(data.photo_rotation ?? 0),
        birth_date_text: normalizeDateInput(data.birth_date_text || ''),
        height_text: stripHeightUnit(data.height_text || ''),
        weight_text: stripWeightUnit(data.weight_text || ''),
        city_or_team: data.city_or_team || '',
        photo: null
      })
      setManualCutoutDataUrl('')
      setManualCutoutOriginalDataUrl('')
      setManualCutoutAssetToken('')
      setManualEditedPortraitFile(null)
      setManualMaskEditorOpen(false)
      setMyStickerModalOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setMyStickerSubmitting(false)
    }
  }

  async function requestExport(stickerIds) {
    const data = await waitForPublicJob('/exports/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        album_slug: selectedAlbumSlug,
        sticker_ids: stickerIds,
        session_token: sessionToken,
        extras: normalizedSelectedExportExtras
      })
    })
    if (serviceConfig?.donation_enabled && serviceConfig?.pix_key) {
      setPendingDownloadPath(data.download_path)
      setPendingDownloadFileName(data.file_name)
      setDonationModalOpen(true)
    } else {
      triggerFileDownload(data.download_path)
    }
  }

  async function runExportFlow(stickerIds) {
    setExporting(true)
    setError('')
    try {
      await requestExport(stickerIds)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  async function handleExport() {
    if (!selectedAlbumSlug || !hasExportSelection) return
    if (customStickerSelected && customStickerNeedsManualUnlock) {
      if (customManualUnlockAvailable) {
        await runExportFlow(selectedIds)
        return
      }
      setCustomUnlockContext('MANUAL_PDF')
      setCustomUnlockStep('choice')
      setCustomUnlockModalOpen(true)
      return
    }

    await runExportFlow(selectedIds)
  }

  async function handleExportWithoutMySticker() {
    if (!selectedAlbumSlug || (freeSelectedIds.length === 0 && selectedExtraCopies === 0)) return
    setCustomUnlockModalOpen(false)
    await runExportFlow(freeSelectedIds)
  }

  async function handleStartCustomUnlock(unlockType = 'MANUAL_PDF') {
    if (!selectedAlbumSlug) return
    if (unlockType === 'AI_CREATE') {
      setAiResumeIntent(true, {
        custom_unlock_context: 'AI_CREATE',
        custom_unlock_step: 'payment',
        custom_unlock_modal_open: true,
        my_sticker_modal_open: true,
        mode_confirmed: false,
        form: {
          ...myStickerForm,
          photo: null,
          requested_composition_mode: 'AI_OPTIONAL'
        }
      })
    }
    setCustomUnlockBusy(true)
    setError('')
    try {
      const path =
        unlockType === 'AI_CREATE'
          ? `/albums/${selectedAlbumSlug}/my-sticker/ai-unlock`
          : `/albums/${selectedAlbumSlug}/my-sticker/manual-unlock`
      const data = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken })
      })
      setCustomUnlockContext(unlockType)
      if (unlockType === 'AI_CREATE') {
        setAiUnlockData(data)
      } else {
        setCustomUnlockData(data)
      }
      setCustomUnlockStep('payment')
      if (data.access_granted) {
        if (unlockType === 'AI_CREATE') {
          persistAiUnlockedDraft()
          setCustomUnlockModalOpen(false)
          setMyStickerModalOpen(true)
          activateMyStickerMode('AI_OPTIONAL')
        } else {
          setCustomUnlockModalOpen(false)
          await runExportFlow(selectedIds)
        }
      } else {
        setCustomUnlockModalOpen(true)
      }
    } catch (err) {
      if (unlockType === 'AI_CREATE') {
        setAiResumeIntent(false, {
          custom_unlock_context: 'MANUAL_PDF',
          custom_unlock_modal_open: false,
          custom_unlock_step: 'choice'
        })
      }
      setError(err.message)
    } finally {
      setCustomUnlockBusy(false)
    }
  }

  async function refreshCustomUnlock(showErrors = false, unlockType = customUnlockContext) {
    if (!selectedAlbumSlug) return
    if (unlockType === 'MANUAL_PDF' && (!customStickerSelected || !customStickerNeedsManualUnlock)) return
    try {
      const path =
        unlockType === 'AI_CREATE'
          ? `/albums/${selectedAlbumSlug}/my-sticker/ai-unlock?session_token=${encodeURIComponent(sessionToken)}`
          : `/albums/${selectedAlbumSlug}/my-sticker/manual-unlock?session_token=${encodeURIComponent(sessionToken)}`
      const data = await apiFetch(path)
      if (unlockType === 'AI_CREATE') {
        setAiUnlockData(data)
      } else {
        setCustomUnlockData(data)
      }
      if (data?.access_granted) {
        if (unlockType === 'AI_CREATE') {
          persistAiUnlockedDraft()
          setCustomUnlockModalOpen(false)
          setMyStickerModalOpen(true)
          activateMyStickerMode('AI_OPTIONAL')
        } else {
          setCustomUnlockModalOpen(false)
          await runExportFlow(selectedIds)
        }
      }
    } catch (err) {
      if (showErrors) setError(err.message)
    }
  }

  async function handleCopyPixKey() {
    if (!serviceConfig?.donation_qr_code && !serviceConfig?.pix_key) return
    try {
      await navigator.clipboard.writeText(serviceConfig.donation_qr_code || serviceConfig.pix_key)
      setPixCopied(true)
    } catch {
      setError('Nao foi possivel copiar o codigo Pix automaticamente.')
    }
  }

  async function handleCopyCustomUnlockPix() {
    if (!activeUnlockData?.qr_code) return
    try {
      await navigator.clipboard.writeText(activeUnlockData.qr_code)
      setCustomUnlockCopied(true)
    } catch {
      setError('Nao foi possivel copiar o codigo Pix automaticamente.')
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
    if (!selectedAlbumSlug || !hasExportSelection) return
    setOrderSubmitting(true)
    setError('')
    try {
      const data = await apiFetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          album_slug: selectedAlbumSlug,
          sticker_ids: selectedIds,
          session_token: sessionToken,
          extras: normalizedSelectedExportExtras,
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
                setCustomSticker(null)
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
              <p className="fig-kicker">Colecoes</p>
              <h3>{selectedAlbum.name}</h3>
            </div>
            <div className="fig-sidebar-group-filter">
              {groupedAvailableCollections.map(group => (
                <button
                  key={group.type}
                  type="button"
                  className={`fig-sidebar-group-pill${group.type === activeDesktopCollectionGroup?.type ? ' is-active' : ''}`}
                  onClick={() => setDesktopCollectionTypeFilter(group.type)}
                >
                  {group.label}
                </button>
              ))}
            </div>
            <div className="fig-collection-groups">
              {activeDesktopCollectionGroup ? (
                <div key={activeDesktopCollectionGroup.type} className="fig-collection-group">
                  <div className="fig-collection-group-head">
                    <span>{activeDesktopCollectionGroup.label}</span>
                  </div>
                  <div className="fig-collection-list fig-collection-list--nested">
                    {activeDesktopCollectionGroup.items.map(collection => (
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
        <div className="fig-mobile-only fig-mobile-catalog-shell">
          <div className="fig-mobile-catalog-top">
            <div className="fig-mobile-catalog-copy">
              <p className="fig-kicker">Catalogo</p>
              <h2>{selectedCollection?.name || selectedAlbum?.name || 'Escolha um album'}</h2>
              <p>
                {selectedAlbum
                  ? `${selectedAlbum.name}${selectedCollection ? ` · ${selectedCollection.sticker_count} figurinhas` : ''}`
                  : 'Escolha uma edicao e comece pelas figurinhas.'}
              </p>
            </div>
            <button
              type="button"
              className="fig-secondary-button fig-mobile-top-button"
              onClick={() => setMobilePrintGuideOpen(true)}
            >
              Como imprimir
            </button>
          </div>

          {selectedAlbum ? (
            <div className="fig-mobile-collections-card">
              <div className="fig-mobile-collections-head">
                <div className="fig-mobile-collections-copy">
                  <span className="fig-mobile-collections-label">Colecoes</span>
                  <strong>{selectedCollection?.name || 'Escolha uma colecao'}</strong>
                  <small>{availableCollections.length} colecao(oes) disponivel(is)</small>
                </div>
              </div>

              <div className="fig-mobile-collection-type-strip">
                {groupedAvailableCollections.map(group => (
                  <button
                    key={group.type}
                    type="button"
                    className={`fig-mobile-collection-type-pill${group.type === activeMobileCollectionGroup?.type ? ' is-active' : ''}`}
                    onClick={() => setMobileCollectionTypeFilter(group.type)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>

              {activeMobileCollectionGroup ? (
                <div className="fig-mobile-collection-strip">
                  {activeMobileCollectionGroup.items.map(collection => (
                    <button
                      key={collection.id}
                      type="button"
                      className={`fig-mobile-collection-chip${collection.slug === selectedCollectionSlug ? ' is-active' : ''}`}
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
              ) : null}
            </div>
          ) : null}

          <div className="fig-mobile-summary-row">
            <span className="fig-mobile-summary-pill">
              <strong>{selectedIds.length}</strong>
              <span>no PDF</span>
            </span>
            {selectedCollectionsSummary.slice(0, 2).map(collection => (
              <span key={collection.slug} className="fig-mobile-summary-pill fig-mobile-summary-pill--soft">
                <strong>{collection.count}</strong>
                <span>{collection.name}</span>
              </span>
            ))}
          </div>

          <div className="fig-mobile-inline-actions">
            <button type="button" className="fig-inline-link" onClick={selectCurrentCollectionStickers}>
              Selecionar todas
            </button>
            <button type="button" className="fig-inline-link" onClick={clearSelection}>
              Limpar selecao
            </button>
            <button
              type="button"
              className="fig-inline-link"
              onClick={() => setMyStickerModalOpen(true)}
              disabled={!selectedAlbumSlug}
            >
              {customSticker ? 'Refazer minha figurinha' : 'Minha Figurinha'}
            </button>
          </div>
        </div>

        <div className="fig-hero fig-desktop-only">
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
              onClick={selectCurrentCollectionStickers}
            >
              Selecionar todas
            </button>
            <button type="button" className="fig-secondary-button" onClick={clearSelection}>
              Limpar selecao
            </button>
            <button
              type="button"
              className="fig-secondary-button"
              onClick={() => setMyStickerModalOpen(true)}
              disabled={!selectedAlbumSlug}
            >
              {customSticker ? 'Refazer minha figurinha' : 'Minha Figurinha'}
            </button>
            {serviceConfig?.service_enabled ? (
              <button
                type="button"
                className="fig-secondary-button"
                disabled={!hasExportSelection || !(quote?.service_enabled ?? serviceConfig?.service_enabled)}
                onClick={() => setOrderFormOpen(true)}
              >
                Quero que voce prepare para mim
              </button>
            ) : null}
            <button
              type="button"
              className="fig-primary-button"
              disabled={!selectedAlbumSlug || !hasExportSelection || exporting}
              onClick={handleExport}
            >
              {exporting ? (
                'Gerando PDF...'
              ) : (
                <>
                  <span className="fig-button-main">Gerar PDF gratis ({exportSelectionCount})</span>
                  {quote ? <small className="fig-button-sub">Gera {quote.sheet_count} folha(s)</small> : null}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="fig-toolbar fig-desktop-only">
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

        {showPdfExtrasPanel ? (
          <section className="fig-export-extras-panel">
            <div className="fig-section-block-head">
              <strong>Extras no final do PDF</strong>
              <span>Esses itens entram inteiros no fim do arquivo e voce escolhe quantas copias quer.</span>
            </div>
            <div className="fig-export-extras-list">
              {availablePdfExtras.map(collection => {
                const maxQuantity = Number(collection.max_quantity_per_order || 0)
                const currentQuantity = Number(selectedExportExtras[collection.id] || 0)
                const applyToAllSheets = Boolean(selectedExportExtraApplyAll[collection.id])
                return (
                  <div key={collection.id} className="fig-export-extra-card">
                    {collection.preview_image_path ? (
                      <img
                        className="fig-export-extra-preview"
                        src={apiFileUrl(collection.preview_image_path)}
                        alt={`Preview de ${collection.name}`}
                      />
                    ) : null}
                    <div className="fig-export-extra-card-body">
                      <strong>{collection.name}</strong>
                      <span>PDF completo anexado no final</span>
                      {supportsApplyExtraToAllSheets(collection) ? (
                        <label className="fig-export-extra-toggle">
                          <input
                            type="checkbox"
                            checked={applyToAllSheets}
                            onChange={event => toggleExportExtraApplyAll(collection.id, event.target.checked)}
                          />
                          <span>Aplicar verso em todas as folhas</span>
                        </label>
                      ) : null}
                    </div>
                    <div className="fig-export-extra-stepper">
                      <button
                        type="button"
                        className="fig-secondary-button"
                        onClick={() => updateExportExtraQuantity(collection.id, currentQuantity - 1, maxQuantity)}
                        disabled={applyToAllSheets || currentQuantity <= 0}
                      >
                        -
                      </button>
                      <strong>{currentQuantity}</strong>
                      <button
                        type="button"
                        className="fig-secondary-button"
                        onClick={() => updateExportExtraQuantity(collection.id, currentQuantity + 1, maxQuantity)}
                        disabled={applyToAllSheets || (maxQuantity > 0 && currentQuantity >= maxQuantity)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

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

        {selectedAlbum ? (
          <section className={`fig-custom-card${customSticker ? ' is-ready' : ''}`}>
            <div className="fig-custom-card-copy">
              <div className="fig-custom-card-topline">
                <p className="fig-kicker">Minha Figurinha</p>
                {customSticker ? (
                  <span className={`fig-inline-status-chip${customStickerSelected ? ' is-active' : ''}`}>
                    {customStickerSelected ? 'Incluida no PDF' : 'Fora do PDF'}
                  </span>
                ) : null}
              </div>
              <h3>{customSticker ? 'Sua figurinha ja esta pronta' : 'Leve voce junto no mesmo PDF'}</h3>
              <p>
                {customSticker
                  ? customStickerSelected
                    ? 'Ela ja vai junto com as outras no seu PDF.'
                    : 'Ela esta pronta, mas ainda nao entra no PDF.'
                  : 'Crie sua figurinha no mesmo padrao das outras.'}
              </p>
              <div className="fig-hero-actions">
                <button
                  type="button"
                  className="fig-primary-button"
                  onClick={() => setMyStickerModalOpen(true)}
                  disabled={!selectedAlbumSlug}
                >
                  {customSticker ? 'Refazer minha figurinha' : 'Criar minha figurinha'}
                </button>
                {customSticker ? (
                  <>
                    <button type="button" className="fig-secondary-button" onClick={toggleCustomStickerSelection}>
                      {customStickerSelected ? 'Remover do PDF' : 'Usar no PDF'}
                    </button>
                    <button type="button" className="fig-secondary-button" onClick={handleDeleteMySticker}>
                      Excluir
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {customSticker ? (
              <div className={`fig-custom-preview${customStickerSelected ? ' is-selected' : ''}`}>
                {customStickerSelected ? (
                  <button
                    type="button"
                    className="fig-custom-preview-download"
                    onClick={handleDownloadMySticker}
                  >
                    Baixar
                  </button>
                ) : null}
                <img src={apiFileUrl(customSticker.preview_path)} alt={customSticker.name} />
                <div className="fig-custom-preview-body">
                  <strong>{customSticker.name}</strong>
                  <span>{customProfileLabel(customSticker.profile_type)}</span>
                  <em className={`fig-preview-selection-note${customStickerSelected ? ' is-active' : ''}`}>
                    {customStickerSelected ? 'Ja incluida no PDF atual' : 'Toque em "Usar no PDF" para incluir'}
                  </em>
                  <small>
                    {[customSticker.birth_date_text, customSticker.height_text, customSticker.weight_text, customSticker.city_or_team]
                      .filter(Boolean)
                      .join(' · ') || 'Sem dados extras preenchidos'}
                  </small>
                </div>
              </div>
            ) : null}
          </section>
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

        <div className="fig-mobile-only fig-mobile-bottom-bar">
          <div className="fig-mobile-bottom-copy">
            <strong>{selectedIds.length}</strong>
            <span>{selectedIds.length === 1 ? 'figurinha selecionada' : 'figurinhas selecionadas'}</span>
            {customSticker ? (
              <small className={`fig-mobile-bottom-accent${customStickerSelected ? ' is-active' : ''}`}>
                {customStickerSelected ? 'Minha Figurinha incluida' : 'Minha Figurinha fora do PDF'}
              </small>
            ) : null}
          </div>
          <div className="fig-mobile-bottom-actions">
            {serviceConfig?.service_enabled ? (
              <button
                type="button"
                className="fig-secondary-button fig-mobile-bottom-secondary"
                disabled={!hasExportSelection || !(quote?.service_enabled ?? serviceConfig?.service_enabled)}
                onClick={() => setOrderFormOpen(true)}
              >
                Preparar
              </button>
            ) : null}
            <button
              type="button"
              className="fig-primary-button fig-mobile-bottom-primary"
              disabled={!selectedAlbumSlug || !hasExportSelection || exporting}
              onClick={handleExport}
            >
              {exporting ? (
                'Gerando...'
              ) : (
                <>
                  <span className="fig-button-main">Gerar PDF ({exportSelectionCount})</span>
                  {quote ? <small className="fig-button-sub">Gera {quote.sheet_count} folha(s)</small> : null}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileAlbumPickerOpen ? (
        <div className="fig-modal-backdrop" onClick={() => setMobileAlbumPickerOpen(false)}>
          <div className="fig-modal-shell fig-modal-shell--mobile" onClick={event => event.stopPropagation()}>
            <div className="fig-modal-header">
              <div>
                <p className="fig-kicker">Albuns</p>
                <h3>Escolha a edicao</h3>
              </div>
              <button type="button" className="fig-modal-close" onClick={() => setMobileAlbumPickerOpen(false)}>
                Fechar
              </button>
            </div>
            <div className="fig-mobile-modal-list">
              {albums.map(album => (
                <button
                  key={album.id}
                  type="button"
                  className={`fig-mobile-modal-item${album.slug === selectedAlbumSlug ? ' is-active' : ''}`}
                  onClick={() => {
                    setSelectedAlbumSlug(album.slug)
                    setSelectedCollectionSlug('')
                    setCustomSticker(null)
                    setSelectedStickers([])
                    setSearch('')
                    setCategory('')
                    setMobileAlbumPickerOpen(false)
                  }}
                >
                  <strong>{album.name}</strong>
                  <span>{album.published_collection_count} selecoes publicadas</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {mobilePrintGuideOpen ? (
        <div className="fig-modal-backdrop" onClick={() => setMobilePrintGuideOpen(false)}>
          <div
            className="fig-modal-shell fig-modal-shell--mobile fig-modal-shell--print-guide"
            onClick={event => event.stopPropagation()}
          >
            <div className="fig-modal-header">
              <div>
                <p className="fig-kicker">Impressao</p>
                <h3>Como imprimir</h3>
              </div>
              <button type="button" className="fig-modal-close" onClick={() => setMobilePrintGuideOpen(false)}>
                Fechar
              </button>
            </div>
            <div className="fig-print-guide-card">
              <img
                className="fig-print-guide-image"
                src="/como-imprimir.png"
                alt="Guia de impressao com instrucoes para imprimir as figurinhas corretamente"
              />
            </div>
          </div>
        </div>
      ) : null}

      {mobileFilterOpen ? (
        <div className="fig-modal-backdrop" onClick={() => setMobileFilterOpen(false)}>
          <div className="fig-modal-shell fig-modal-shell--mobile" onClick={event => event.stopPropagation()}>
            <div className="fig-modal-header">
              <div>
                <p className="fig-kicker">Filtros</p>
                <h3>Refinar catalogo</h3>
              </div>
              <button type="button" className="fig-modal-close" onClick={() => setMobileFilterOpen(false)}>
                Fechar
              </button>
            </div>
            <div className="fig-form-grid">
              <label className="fig-field fig-field--full">
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
            <div className="fig-hero-actions">
              <button
                type="button"
                className="fig-secondary-button"
                onClick={() => {
                  setCategory('')
                  setMobileFilterOpen(false)
                }}
              >
                Limpar filtro
              </button>
              <button type="button" className="fig-primary-button" onClick={() => setMobileFilterOpen(false)}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {myStickerModalOpen ? (
        <div className="fig-modal-backdrop" onClick={() => setMyStickerModalOpen(false)}>
          <div className="fig-modal-shell fig-modal-shell--my-sticker fig-modal-shell--public-flow" onClick={event => event.stopPropagation()}>
            <div className="fig-modal-header">
              <div>
                <p className="fig-kicker">Minha Figurinha</p>
                <h3>Crie uma figurinha personalizada</h3>
                <p className="fig-modal-subtitle">Dados, foto e pronto.</p>
              </div>
              <button type="button" className="fig-modal-close" onClick={() => setMyStickerModalOpen(false)}>
                Fechar
              </button>
            </div>

            <form className="fig-form-card fig-order-form fig-order-form--modal" onSubmit={handleSubmitMySticker}>
              <div className="fig-flow-step-row">
                <span className="fig-flow-step is-active">1. Dados</span>
                <span className="fig-flow-step is-active">2. Foto</span>
                <span className="fig-flow-step">3. Criar</span>
              </div>

              <div className="fig-service-notes">
                <p>
                  Envie uma foto com o rosto visivel.
                </p>
              </div>

              <div className="fig-section-block">
                <div className="fig-section-block-head">
                  <strong>Escolha o tipo da figurinha</strong>
                  <span>Defina primeiro o perfil e a posicao. Isso decide quais modelos ficam disponiveis.</span>
                </div>
                <div className="fig-form-grid">
                  <label className="fig-field">
                    <span>Perfil da figurinha</span>
                    <select
                      value={myStickerForm.profile_type}
                      onChange={event => {
                        setMyStickerModeConfirmed(false)
                        setManualCutoutDataUrl('')
                        setManualCutoutAssetToken('')
                        setMyStickerForm(current => ({
                          ...current,
                          profile_type: event.target.value,
                          template_id: ''
                        }))
                      }}
                    >
                      {customProfileOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fig-field">
                    <span>Posicao em campo</span>
                    <select
                      value={myStickerForm.position_type}
                      onChange={event => {
                        setMyStickerModeConfirmed(false)
                        setManualCutoutDataUrl('')
                        setManualCutoutAssetToken('')
                        setMyStickerForm(current => ({
                          ...current,
                          position_type: event.target.value,
                          template_id: ''
                        }))
                      }}
                    >
                      {customPositionTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {currentGenerationModeOptions.length > 0 ? (
                <div className="fig-section-block">
                  <div className="fig-section-block-head">
                    <strong>Como sua figurinha sera criada</strong>
                    <span>
                        {currentGenerationModeOptions.length > 1
                          ? 'Escolha como quer criar sua figurinha.'
                          : 'O modo disponivel para esse perfil aparece logo abaixo.'}
                    </span>
                  </div>
                  <div className="fig-order-choice-grid fig-order-choice-grid--single-mobile">
                    {currentGenerationModeOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.disabled}
                        className={`fig-choice-card${myStickerModeConfirmed && myStickerForm.requested_composition_mode === option.value ? ' is-active' : ''}`}
                        onClick={() => {
                          if (option.disabled) {
                            return
                          }
                          handleChooseMyStickerMode(option.value)
                        }}
                      >
                        <div className="fig-choice-card-visual">
                          <div className="fig-choice-card-preview">
                            {option.value === 'LAYERS' ? (
                              manualPreviewTemplate ? (
                                <CustomTemplateStackPreview
                                  template={manualPreviewTemplate}
                                  alt="Preview do modelo manual"
                                  className="fig-template-stack-preview--choice"
                                />
                              ) : (
                                <div className="fig-choice-card-preview-empty">
                                  <span>Manual</span>
                                </div>
                              )
                            ) : aiModePreview ? (
                              <img src={apiFileUrl(aiModePreview)} alt="Preview da base com IA" />
                            ) : (
                              <div className="fig-choice-card-preview-empty">
                                <span>IA</span>
                              </div>
                            )}
                          </div>
                          <div className="fig-choice-card-price">
                            {option.value === 'LAYERS'
                              ? manualCreationAvailable
                                ? manualUnlockPriceLabel
                                : 'Em preparo'
                              : customAiUnlockAvailable
                                ? 'IA liberada'
                                : aiUnlockPriceLabel}
                          </div>
                        </div>
                        <div className="fig-choice-card-copy">
                          <strong>{option.label}</strong>
                          {option.value === 'LAYERS' ? (
                            <span>
                                {manualCreationAvailable
                                  ? 'Monte sua figurinha, ajuste sua foto com calma e decida depois se quer liberar no PDF.'
                                  : 'Esse modelo manual ainda esta em preparo.'}
                            </span>
                          ) : (
                            <span>
                                {customAiUnlockAvailable
                                  ? `Sua criacao com IA esta liberada. Voce ainda tem ${aiUnlockData?.remaining_uses || 0} tentativa(s) nesta compra.`
                                  : 'Libere a criacao com IA primeiro. Cada pagamento libera 1 geracao e 1 retry.'}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {!manualCreationAvailable && !aiCreationAvailable ? (
                <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight">
                  <div>
                    <strong>Nenhum modo disponivel agora.</strong>
                    <span>Cadastre um modelo manual ou reative a criacao por IA no administrador.</span>
                  </div>
                </div>
              ) : null}

                  {!myStickerModeConfirmed && (manualCreationAvailable || aiCreationAvailable) ? (
                <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight">
                  <div>
                    <strong>Escolha primeiro como quer criar sua figurinha.</strong>
                    <span>Depois disso aparecem os campos, a foto e o passo certo para esse tipo de criacao.</span>
                  </div>
                </div>
              ) : null}

              {!myStickerModeConfirmed && customAiUnlockAvailable ? (
                <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight">
                  <div>
                    <strong>Sua IA ja esta liberada.</strong>
                    <span>Toque em continuar para abrir os campos da criacao com IA.</span>
                  </div>
                  <button type="button" className="fig-primary-button" onClick={continueUnlockedAiFlow}>
                    Continuar com IA
                  </button>
                </div>
              ) : null}

              {myStickerModeConfirmed ? (
              <div className="fig-section-block">
                <div className="fig-section-block-head">
                  <strong>Informacoes da figurinha</strong>
                  <span>Preencha do seu jeito.</span>
                </div>
              <div className="fig-form-grid fig-form-grid--my-sticker">
                <label className="fig-field fig-field--full">
                  <span>Nome</span>
                  <input
                    value={myStickerForm.name}
                    onChange={event => setMyStickerForm(current => ({ ...current, name: event.target.value }))}
                    required
                  />
                </label>
                {effectiveTemplateOptions.length > 1 ? (
                  <label className="fig-field fig-field--full">
                    <span>{myStickerForm.requested_composition_mode === 'LAYERS' ? 'Modelo manual' : 'Base da figurinha'}</span>
                    <select
                      value={myStickerForm.template_id}
                      onChange={event => setMyStickerForm(current => ({ ...current, template_id: event.target.value }))}
                    >
                      <option value="">Escolha um modelo</option>
                      {effectiveTemplateOptions.map(template => (
                        <option key={template.id} value={String(template.id)}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="fig-field fig-field--third">
                  <span>Data</span>
                  <input
                    value={myStickerForm.birth_date_text}
                    onChange={event =>
                      setMyStickerForm(current => ({ ...current, birth_date_text: normalizeDateInput(event.target.value) }))
                    }
                    placeholder="10-06-1999"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </label>
                <label className="fig-field fig-field--third">
                  <span>Altura</span>
                  <div className="fig-input-with-suffix">
                    <input
                      value={myStickerForm.height_text}
                      onChange={event =>
                        setMyStickerForm(current => ({ ...current, height_text: normalizeHeightInput(event.target.value) }))
                      }
                      placeholder="1,70"
                      inputMode="decimal"
                    />
                    <span className="fig-input-suffix">m</span>
                  </div>
                </label>
                <label className="fig-field fig-field--third">
                  <span>Peso</span>
                  <div className="fig-input-with-suffix">
                    <input
                      value={myStickerForm.weight_text}
                      onChange={event =>
                        setMyStickerForm(current => ({ ...current, weight_text: normalizeWeightInput(event.target.value) }))
                      }
                      placeholder="87"
                      inputMode="numeric"
                    />
                    <span className="fig-input-suffix">kg</span>
                  </div>
                </label>
                <label className="fig-field fig-field--full">
                  <span>Cidade ou time</span>
                  <input
                    value={myStickerForm.city_or_team}
                    onChange={event => setMyStickerForm(current => ({ ...current, city_or_team: event.target.value }))}
                    placeholder="Ex.: Fortaleza ou Brasil"
                  />
                </label>
              </div>
              </div>
              ) : null}

              {myStickerModeConfirmed ? (
              <div className="fig-section-block">
                <div className="fig-section-block-head">
                  <strong>Foto e montagem</strong>
                  <span>
                    {myStickerForm.requested_composition_mode === 'LAYERS'
                      ? '2. Ajuste a foto dentro da figurinha e so depois inclua no album.'
                      : 'Confira a base usada pela IA.'}
                  </span>
                </div>

                <label className="fig-field fig-field--full">
                  <span>Foto</span>
                  <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight">
                    <div>
                      <strong>{myStickerForm.photo ? 'Foto selecionada.' : 'Escolha como enviar sua foto.'}</strong>
                      <span>
                        {myStickerForm.photo
                          ? myStickerForm.photo.name
                          : 'No celular, voce pode tirar uma foto agora ou escolher uma imagem da galeria.'}
                      </span>
                    </div>
                    <div className="fig-photo-source-actions">
                      <button
                        type="button"
                        className="fig-secondary-button"
                        onClick={() => openMyStickerPhotoPicker('camera')}
                      >
                        Tirar foto
                      </button>
                      <button
                        type="button"
                        className="fig-secondary-button"
                        onClick={() => openMyStickerPhotoPicker('gallery')}
                      >
                        Galeria
                      </button>
                    </div>
                    <input
                      ref={myStickerCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="fig-hidden-file-input"
                      onChange={handleMyStickerPhotoInput}
                    />
                    <input
                      ref={myStickerGalleryInputRef}
                      type="file"
                      accept="image/*"
                      className="fig-hidden-file-input"
                      onChange={handleMyStickerPhotoInput}
                    />
                  </div>
                </label>

                {myStickerForm.requested_composition_mode === 'LAYERS' ? (
                  <div className="fig-field fig-field--full">
                    <span>Preparar encaixe</span>
                    <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight">
                    <div>
                      <strong>1. Prepare a foto para a figurinha</strong>
                      <span>Vamos remover o fundo e encaixar sua foto para voce ajustar do seu jeito.</span>
                    </div>
                    <div className="fig-photo-source-actions">
                      <button
                        type="button"
                        className="fig-secondary-button"
                        onClick={handlePrepareMyStickerCutout}
                        disabled={!myStickerForm.photo || manualCutoutBusy}
                      >
                        {manualCutoutBusy ? 'Preparando encaixe...' : manualCutoutDataUrl ? 'Preparar de novo' : 'Preparar encaixe na figurinha'}
                      </button>
                      <button
                        type="button"
                        className="fig-secondary-button"
                        onClick={() => setManualMaskEditorOpen(true)}
                        disabled={!manualCutoutDataUrl || manualCutoutBusy}
                      >
                        Ajuste fino
                      </button>
                    </div>
                    </div>
                  </div>
                ) : null}

              {myStickerForm.requested_composition_mode === 'LAYERS' && selectedMyStickerTemplate ? (
                <div className="fig-manual-editor">
                  <div className="fig-manual-editor-preview">
                    <div className="fig-manual-sticker-stage" ref={setManualStageElement}>
                      {manualPreviewLayers.map(layer => (
                        <img
                          key={layer.id || `${layer.layer_type}-${layer.z_index}`}
                          className="fig-manual-stage-layer"
                          src={apiFileUrl(layer.file_path)}
                          alt={layer.label}
                          style={{ zIndex: layer.z_index || 0 }}
                        />
                      ))}
                      {manualCutoutDataUrl && manualPreviewPhotoSlot ? (
                        <div
                          className="fig-manual-stage-portrait"
                          style={{
                            left: `${manualPreviewVisibleBox?.left ?? (manualPreviewPhotoSlot.x || 0) * 100}%`,
                            top: `${manualPreviewVisibleBox?.top ?? (manualPreviewPhotoSlot.y || 0) * 100}%`,
                            width: `${manualPreviewVisibleBox?.width ?? (manualPreviewPhotoSlot.width || 0) * 100}%`,
                            height: `${manualPreviewVisibleBox?.height ?? (manualPreviewPhotoSlot.height || 0) * 100}%`,
                            zIndex: manualPreviewPhotoSlot.portrait_z_index || 30
                          }}
                        >
                          <img
                            src={manualCutoutDataUrl}
                            alt="Foto recortada"
                            style={{
                              left: `calc(${(manualPreviewPhotoSlot.anchor_x ?? 0.5) * 100}% + ${(Number(myStickerForm.photo_offset_x || 0) * 100).toFixed(2)}%)`,
                              top: `calc(${(manualPreviewPhotoSlot.anchor_y ?? 0.5) * 100}% + ${(Number(myStickerForm.photo_offset_y || 0) * 100).toFixed(2)}%)`,
                              transform: `translate(-${(manualPreviewPhotoSlot.anchor_x ?? 0.5) * 100}%, -${(manualPreviewPhotoSlot.anchor_y ?? 0.5) * 100}%) scale(${Number(myStickerForm.photo_scale || 1)}) rotate(${Number(myStickerForm.photo_rotation || 0)}deg)`,
                              transformOrigin: `${(manualPreviewPhotoSlot.anchor_x ?? 0.5) * 100}% ${(manualPreviewPhotoSlot.anchor_y ?? 0.5) * 100}%`
                            }}
                          />
                        </div>
                      ) : null}
                      {manualPreviewTextSlots.map(slot => (
                        <div
                          key={slot.id || slot.field_name}
                          className={`fig-manual-stage-text fig-manual-stage-text--${slot.field_name.toLowerCase()}`}
                          style={{
                            left: `${(slot.x || 0) * 100}%`,
                            top: `${(slot.y || 0) * 100}%`,
                            width: `${(slot.width || 0) * 100}%`,
                            fontSize: `${Math.max(6, (slot.font_size || 12) * manualStageScale)}px`,
                            fontWeight: slot.font_weight || '700',
                            textAlign: slot.text_align || 'left',
                            color: slot.color || '#ffffff',
                            textShadow: `0 ${Math.max(0.6, manualStageScale * 1.4).toFixed(2)}px 0 rgba(0, 0, 0, 0.32)`
                          }}
                        >
                          {myStickerTextValue(myStickerForm, slot.field_name)}
                        </div>
                      ))}
                    </div>
                    {!manualCutoutDataUrl ? (
                      <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight">
                        <div>
                          <strong>Aguardando recorte da foto.</strong>
                          <span>Envie a foto e clique em preparar encaixe para abrir a montagem manual.</span>
                        </div>
                      </div>
                    ) : manualEditedPortraitFile ? (
                      <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight">
                        <div>
                          <strong>Ajuste fino aplicado.</strong>
                          <span>Se ainda sobrar alguma rebarba, abra o ajuste fino de novo e retoque mais um pouco.</span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="fig-photo-adjust-grid fig-photo-adjust-grid--editor">
                    <label className="fig-range-field">
                      <span>Esquerda / direita</span>
                      <input
                        type="range"
                        min="-0.2"
                        max="0.2"
                        step="0.01"
                        value={myStickerForm.photo_offset_x}
                        onChange={event => setMyStickerForm(current => ({ ...current, photo_offset_x: event.target.value }))}
                        disabled={!manualCutoutDataUrl}
                      />
                      <small>{Number(myStickerForm.photo_offset_x || 0).toFixed(2)}</small>
                    </label>
                    <label className="fig-range-field">
                      <span>Cima / baixo</span>
                      <input
                        type="range"
                        min="-0.2"
                        max="0.2"
                        step="0.01"
                        value={myStickerForm.photo_offset_y}
                        onChange={event => setMyStickerForm(current => ({ ...current, photo_offset_y: event.target.value }))}
                        disabled={!manualCutoutDataUrl}
                      />
                      <small>{Number(myStickerForm.photo_offset_y || 0).toFixed(2)}</small>
                    </label>
                    <label className="fig-range-field">
                      <span>Zoom</span>
                      <input
                        type="range"
                        min={String(manualPreviewPhotoSlot?.min_scale ?? 0.7)}
                        max={String(manualPreviewPhotoSlot?.max_scale ?? 2.4)}
                        step="0.01"
                        value={myStickerForm.photo_scale}
                        onChange={event => setMyStickerForm(current => ({ ...current, photo_scale: event.target.value }))}
                        disabled={!manualCutoutDataUrl}
                      />
                      <small>{Number(myStickerForm.photo_scale || 1).toFixed(2)}x</small>
                    </label>
                    <label className="fig-range-field">
                      <span>Girar</span>
                      <input
                        type="range"
                        min="-25"
                        max="25"
                        step="1"
                        value={myStickerForm.photo_rotation}
                        onChange={event => setMyStickerForm(current => ({ ...current, photo_rotation: event.target.value }))}
                        disabled={!manualCutoutDataUrl}
                      />
                      <small>{Number(myStickerForm.photo_rotation || 0).toFixed(0)}°</small>
                    </label>
                  </div>
                </div>
              ) : null}

              {customSticker ? (
                <div className="fig-custom-preview fig-custom-preview--modal">
                  <img src={apiFileUrl(customSticker.preview_path)} alt={customSticker.name} />
                  <div className="fig-custom-preview-body">
                    <strong>{customSticker.name}</strong>
                    <span>
                      Atual: {customProfileLabel(customSticker.profile_type)} • {customPositionLabel(customSticker.custom_position_type)}
                    </span>
                    <small>
                      Recrie se quiser trocar foto ou dados.
                    </small>
                  </div>
                </div>
              ) : null}
              </div>
              ) : null}

              <div className="fig-hero-actions fig-hero-actions--sticky-mobile">
                <button type="button" className="fig-secondary-button" onClick={() => setMyStickerModalOpen(false)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="fig-primary-button"
                  disabled={myStickerSubmitting || manualCutoutBusy || !myStickerModeConfirmed || (!manualCreationAvailable && !aiCreationAvailable)}
                >
                  {myStickerSubmitting ? 'Incluindo figurinha...' : 'Incluir no album'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ManualMaskEditorModal
        open={manualMaskEditorOpen}
        imageDataUrl={manualCutoutDataUrl}
        originalImageDataUrl={manualCutoutOriginalDataUrl || manualCutoutDataUrl}
        onClose={() => setManualMaskEditorOpen(false)}
        onApply={handleApplyManualMaskEditor}
      />

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
                <div className="fig-quote-item">
                  <strong>{quote.extra_page_count}</strong>
                  <span>
                    {quote.selected_extra_count > 0
                      ? `${quote.selected_extra_count} pagina(s) extra(s) ou verso(s)`
                      : 'nenhum extra adicional'}
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
                {quote.extra_page_count > 0 ? (
                  <p>
                    Os extras do tipo <strong>Outros</strong> entram como paginas completas no final do PDF ou como
                    verso intercalado, e ja estao somados no total acima.
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

      {customUnlockModalOpen && serviceConfig ? (
        <div className="fig-modal-backdrop" onClick={handleCloseCustomUnlockModal}>
          <div className="fig-modal-shell fig-modal-shell--donation fig-modal-shell--public-flow" onClick={event => event.stopPropagation()}>
            <div className="fig-modal-header">
              <div>
                <p className="fig-kicker">Minha Figurinha</p>
                <h3>
                  {customUnlockContext === 'AI_CREATE'
                    ? 'Liberar criacao com IA'
                    : customUnlockStep === 'payment'
                      ? 'Libere o PDF completo por Pix'
                      : 'Como voce quer baixar seu PDF?'}
                </h3>
                <p className="fig-modal-subtitle">
                  {customUnlockContext === 'AI_CREATE'
                    ? 'Pague e libere sua criacao com IA.'
                    : customUnlockStep === 'payment'
                      ? 'Pague o Pix para manter sua figurinha no arquivo.'
                      : 'Escolha como quer baixar.'}
                </p>
              </div>
              <button type="button" className="fig-modal-close" onClick={handleCloseCustomUnlockModal}>
                Fechar
              </button>
            </div>

            <section
              className={`fig-form-card fig-donation-modal-card ${
                customUnlockContext === 'AI_CREATE' ? 'fig-donation-modal-card--unlock-ai' : ''
              }`}
            >
              {customUnlockContext === 'MANUAL_PDF' && customUnlockStep === 'choice' ? (
                <>
                  <div className="fig-flow-step-row">
                    <span className="fig-flow-step is-active">1. Escolha</span>
                    <span className="fig-flow-step">2. Pix</span>
                    <span className="fig-flow-step">3. Baixar</span>
                  </div>
                  <div className="fig-service-notes">
                    <p>{activeUnlockMessage}</p>
                  </div>

                  <div className="fig-quote-grid fig-quote-grid--donation">
                    <div className="fig-quote-item">
                      <strong>{freeSelectedIds.length}</strong>
                      <span>gratis sem a personalizada</span>
                    </div>
                    <div className="fig-quote-item">
                      <strong>{selectedIds.length}</strong>
                      <span>com sua figurinha</span>
                    </div>
                    <div className="fig-quote-item">
                      <strong>{formatCurrency(activeUnlockPriceCents)}</strong>
                      <span>para liberar a personalizada</span>
                    </div>
                  </div>

                  <div className="fig-order-choice-grid">
                    <button
                      type="button"
                      className="fig-choice-card"
                      onClick={handleExportWithoutMySticker}
                      disabled={freeSelectedIds.length === 0 && selectedExtraCopies === 0}
                    >
                      <strong>Baixar gratis sem Minha Figurinha</strong>
                      <span>
                        {freeSelectedIds.length > 0 || selectedExtraCopies > 0
                          ? 'Baixa agora sem a personalizada.'
                          : 'Adicione figurinhas ou extras para liberar essa opcao.'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="fig-choice-card fig-choice-card--primary"
                      onClick={() => handleStartCustomUnlock('MANUAL_PDF')}
                      disabled={customUnlockBusy}
                    >
                      <strong>
                        {customUnlockBusy
                          ? 'Gerando Pix...'
                          : `Liberar PDF completo por ${formatCurrency(activeUnlockPriceCents)}`}
                      </strong>
                      <span>Mantem sua figurinha no PDF.</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {customUnlockContext === 'AI_CREATE' ? (
                    <>
                      <div className="fig-unlock-summary-strip fig-unlock-summary-strip--ai">
                        <div className="fig-unlock-summary-pill">
                          <span>Pix</span>
                          <strong>{formatCurrency(activeUnlockData?.amount_cents || activeUnlockPriceCents)}</strong>
                        </div>
                        <div className="fig-unlock-summary-pill">
                          <span>Saldo</span>
                          <strong>
                            {activeUnlockCompactUsageLabel}
                          </strong>
                        </div>
                        <div className="fig-unlock-summary-pill fig-unlock-summary-pill--status">
                          <span>Status</span>
                          <strong>
                            {activeUnlockData?.status === 'PAGO'
                              ? 'Pago'
                              : activeUnlockData?.status === 'EXPIRADO'
                                ? 'Expirado'
                                : activeUnlockData?.status === 'FALHOU'
                                  ? 'Falhou'
                                  : 'Aguardando'}
                          </strong>
                        </div>
                      </div>
                      <div className="fig-service-notes fig-service-notes--unlock-ai">
                        <p>{activeUnlockMessage}</p>
                        <small>1 geracao + 1 retry nesta sessao.</small>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="fig-flow-step-row">
                        <span className="fig-flow-step is-active">1. Escolha</span>
                        <span className="fig-flow-step is-active">2. Pix</span>
                        <span className="fig-flow-step">3. Baixar</span>
                      </div>
                      <div className="fig-service-notes">
                        <p>Escaneie o Pix para liberar sua figurinha no PDF.</p>
                      </div>

                      <div className="fig-unlock-hero-card">
                        <div>
                          <span className="fig-unlock-hero-label">Liberacao</span>
                          <strong>{formatCurrency(activeUnlockData?.amount_cents || activeUnlockPriceCents)}</strong>
                        </div>
                        <div>
                          <span className="fig-unlock-hero-label">Seu saldo</span>
                          <strong>
                            {activeUnlockData?.status === 'PAGO'
                              ? activeUnlockUsageLabel
                              : activeUnlockTotalUses > 0
                                ? `Ate ${activeUnlockTotalUses} usos`
                                : 'Ate 5 usos'}
                          </strong>
                        </div>
                        <div>
                          <span className="fig-unlock-hero-label">Status</span>
                          <strong>
                            {activeUnlockData?.status === 'PAGO'
                              ? 'Pago'
                              : activeUnlockData?.status === 'EXPIRADO'
                                ? 'Expirado'
                                : activeUnlockData?.status === 'FALHOU'
                                  ? 'Falhou'
                                  : 'Aguardando'}
                          </strong>
                        </div>
                      </div>
                    </>
                  )}

                  {customUnlockContext === 'AI_CREATE' ? (
                    <div className="fig-unlock-layout-grid fig-unlock-layout-grid--ai">
                      {activeUnlockData?.qr_code_base64 ? (
                        <div className="fig-payment-qr-card fig-payment-qr-card--ai">
                          <img
                            src={`data:image/png;base64,${activeUnlockData.qr_code_base64}`}
                            alt="QR Code Pix para liberar criacao com IA"
                          />
                        </div>
                      ) : null}
                      <div className="fig-unlock-layout-side">
                        <div className="fig-payment-focus-note fig-payment-focus-note--ai">
                          <strong>Assim que o Pix confirmar, a criacao com IA fica liberada.</strong>
                        </div>

                        <div className="fig-helper-strip fig-helper-strip--donation fig-helper-strip--unlock-ai">
                          <div>
                            <span className="fig-code-block">{activeUnlockData?.qr_code || 'Gerando codigo Pix...'}</span>
                          </div>
                          <button type="button" className="fig-secondary-button" onClick={handleCopyCustomUnlockPix}>
                            {customUnlockCopied ? 'Codigo copiado' : 'Copiar Codigo Pix'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {activeUnlockData?.qr_code_base64 ? (
                        <div className="fig-payment-qr-card">
                          <img
                            src={`data:image/png;base64,${activeUnlockData.qr_code_base64}`}
                            alt="QR Code Pix para liberar Minha Figurinha"
                          />
                        </div>
                      ) : null}

                      <div className="fig-payment-focus-note">
                        <strong>Sua Minha Figurinha entra no PDF assim que o Pix confirmar.</strong>
                        <span>Se preferir, voce ainda pode voltar e baixar gratis sem ela.</span>
                      </div>

                      <div className="fig-helper-strip fig-helper-strip--donation">
                        <div>
                          <span className="fig-code-block">{activeUnlockData?.qr_code || 'Gerando codigo Pix...'}</span>
                        </div>
                        <button type="button" className="fig-secondary-button" onClick={handleCopyCustomUnlockPix}>
                          {customUnlockCopied ? 'Codigo copiado' : 'Copiar Codigo Pix'}
                        </button>
                      </div>
                    </>
                  )}

                  <div
                    className={`fig-hero-actions fig-hero-actions--sticky-mobile ${
                      customUnlockContext === 'AI_CREATE' ? 'fig-hero-actions--single' : ''
                    }`}
                  >
                    {customUnlockContext === 'MANUAL_PDF' ? (
                      <button type="button" className="fig-secondary-button" onClick={() => setCustomUnlockStep('choice')}>
                        Voltar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="fig-primary-button"
                      onClick={() => {
                        if (customUnlockContext === 'AI_CREATE' && activeUnlockData?.access_granted) {
                          continueUnlockedAiFlow()
                          return
                        }
                        if (customUnlockContext === 'AI_CREATE' && activeUnlockData?.status === 'PAGO' && !activeUnlockData?.access_granted) {
                          handleStartCustomUnlock('AI_CREATE')
                          return
                        }
                        refreshCustomUnlock(true, customUnlockContext)
                      }}
                      disabled={customUnlockBusy}
                    >
                      {customUnlockContext === 'AI_CREATE'
                        ? activeUnlockData?.access_granted
                          ? 'Continuar com IA'
                          : activeUnlockData?.status === 'PAGO'
                            ? 'Gerar novo Pix'
                            : 'Verificar pagamento'
                        : activeUnlockData?.status === 'PAGO'
                          ? 'Liberado'
                          : 'Ja paguei, verificar agora'}
                    </button>
                  </div>
                </>
              )}
            </section>
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

            <section className="fig-form-card fig-support-donation-modal-card">
              <div className="fig-service-notes">
                <p>{serviceConfig.donation_message || 'O download continua gratuito mesmo sem doacao.'}</p>
              </div>

              {serviceConfig.donation_qr_code_base64 ? (
                <div className="fig-support-payment-qr-card">
                  <img
                    src={`data:image/png;base64,${serviceConfig.donation_qr_code_base64}`}
                    alt="QR Code Pix para apoio opcional"
                  />
                </div>
              ) : null}

              <div className="fig-helper-strip fig-support-helper-strip">
                <div>
                  <strong>{serviceConfig.donation_qr_code ? 'Pix copia e cola' : 'Chave Pix'}</strong>
                  <span className={serviceConfig.donation_qr_code ? 'fig-support-code-block' : ''}>
                    {serviceConfig.donation_qr_code || serviceConfig.pix_key || 'a configurar'}
                    {!serviceConfig.donation_qr_code && serviceConfig.pix_holder ? ` · ${serviceConfig.pix_holder}` : ''}
                  </span>
                </div>
                <button type="button" className="fig-secondary-button" onClick={handleCopyPixKey}>
                  {pixCopied ? 'Codigo copiado' : serviceConfig.donation_qr_code ? 'Copiar codigo Pix' : 'Copiar chave Pix'}
                </button>
              </div>

              <div className="fig-hero-actions">
                <button type="button" className="fig-primary-button" onClick={handleDonationDownload}>
                  Baixar PDF agora
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {publicFlowProgress ? (
        <div className="fig-public-progress-backdrop" role="presentation">
          <div className="fig-public-progress-card" role="status" aria-live="polite" aria-atomic="true">
            <div className="fig-public-progress-spinner" />
            <p className="fig-kicker">Aguarde</p>
            <h3>{publicFlowProgress.title}</h3>
            <p className="fig-public-progress-copy">{publicFlowProgress.subtitle}</p>
            <div className="fig-public-progress-bar-shell" aria-hidden="true">
              <div className={`fig-public-progress-bar${publicFlowProgress.isComplete ? ' is-complete' : ''}`} />
            </div>
            <div className="fig-public-progress-meta">
              <strong>{publicFlowProgress.label}</strong>
            </div>
            <div className="fig-public-progress-steps">
              {publicFlowProgress.steps?.map((stepLabel, index) => {
                const isDone = publicFlowProgress.isComplete || index < publicFlowProgress.activeStepIndex
                const isActive = !publicFlowProgress.isComplete && index === publicFlowProgress.activeStepIndex
                return (
                  <div
                    key={`${publicFlowProgress.key}-${stepLabel}`}
                    className={`fig-public-progress-step${isDone ? ' is-done' : ''}${isActive ? ' is-active' : ''}`}
                  >
                    <span className="fig-public-progress-step-dot" aria-hidden="true" />
                    <span>{stepLabel}</span>
                  </div>
                )
              })}
            </div>
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
  const [createForm, setCreateForm] = useState(createEmptyCollectionAdminForm)
  const [albumSlugEdited, setAlbumSlugEdited] = useState(false)
  const [createCollectionSlugEdited, setCreateCollectionSlugEdited] = useState(false)
  const [albumSlugManualOpen, setAlbumSlugManualOpen] = useState(false)
  const [createCollectionSlugManualOpen, setCreateCollectionSlugManualOpen] = useState(false)
  const [albumStructureMode, setAlbumStructureMode] = useState('edit')
  const [collectionStructureMode, setCollectionStructureMode] = useState('edit')
  const [selectedAlbumForm, setSelectedAlbumForm] = useState({ name: '', slug: '', description: '', sort_order: '0' })
  const [selectedAlbumSlugEdited, setSelectedAlbumSlugEdited] = useState(false)
  const [selectedAlbumSlugManualOpen, setSelectedAlbumSlugManualOpen] = useState(false)
  const [selectedCollectionForm, setSelectedCollectionForm] = useState(createEmptyCollectionAdminForm)
  const [selectedCollectionSlugEdited, setSelectedCollectionSlugEdited] = useState(false)
  const [selectedCollectionSlugManualOpen, setSelectedCollectionSlugManualOpen] = useState(false)
  const [savingAlbum, setSavingAlbum] = useState(false)
  const [savingAlbumEdit, setSavingAlbumEdit] = useState(false)
  const [deletingAlbum, setDeletingAlbum] = useState(false)
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
    custom_generation_mode: 'LAYERS',
    custom_sticker_unlock_enabled: false,
    custom_sticker_unlock_price: '5.00',
    custom_sticker_unlock_message: '',
    custom_ai_unlock_enabled: false,
    custom_ai_unlock_price: '5.00',
    custom_ai_unlock_message: '',
    pack_size: '7',
    print_price: '0.00',
    pack_price: '0.00',
    pix_key: '',
    pix_holder: '',
    donation_message: '',
    pickup_note: '',
    custom_prompt_template: '',
    custom_base_homem_path: '',
    custom_base_mulher_path: '',
    custom_base_crianca_path: ''
  })
  const [accessSummary, setAccessSummary] = useState({
    visits_today: 0,
    unique_today: 0,
    visits_last_7_days: 0,
    unique_last_7_days: 0
  })
  const [savingService, setSavingService] = useState(false)
  const [sourceDocuments, setSourceDocuments] = useState([])
  const [selectedSourceDocumentId, setSelectedSourceDocumentId] = useState(null)
  const [selectedSourceDocument, setSelectedSourceDocument] = useState(null)
  const [sourceDocumentForm, setSourceDocumentForm] = useState(() => createEmptySourceDocumentForm())
  const [savingSourceDocument, setSavingSourceDocument] = useState(false)
  const [deletingSourceDocument, setDeletingSourceDocument] = useState(false)
  const [loadingSourceDocuments, setLoadingSourceDocuments] = useState(false)
  const [sourceDocumentUploadResetKey, setSourceDocumentUploadResetKey] = useState(0)
  const [selectedSourceDocumentPageId, setSelectedSourceDocumentPageId] = useState(null)
  const [sourcePageInteractionMode, setSourcePageInteractionMode] = useState('detected')
  const [editingSourceBlockId, setEditingSourceBlockId] = useState(null)
  const [sourceBlockForm, setSourceBlockForm] = useState(createEmptySourceBlockForm)
  const [savingSourceBlock, setSavingSourceBlock] = useState(false)
  const [sourceDetectedSelectionRect, setSourceDetectedSelectionRect] = useState(null)
  const [sourceDetectedDragState, setSourceDetectedDragState] = useState(null)
  const [sourceBlockSelectionRect, setSourceBlockSelectionRect] = useState(null)
  const [sourceBlockDragState, setSourceBlockDragState] = useState(null)
  const [sourceBlockDraftRect, setSourceBlockDraftRect] = useState(null)
  const [sourceDetectedStickers, setSourceDetectedStickers] = useState([])
  const [loadingSourceDetectedStickers, setLoadingSourceDetectedStickers] = useState(false)
  const [processingSourceDocumentDetection, setProcessingSourceDocumentDetection] = useState(false)
  const [selectedDetectedStickerIds, setSelectedDetectedStickerIds] = useState([])
  const [sourceDetectedCollectionId, setSourceDetectedCollectionId] = useState('')
  const [assigningDetectedStickers, setAssigningDetectedStickers] = useState(false)
  const [discardingDetectedStickers, setDiscardingDetectedStickers] = useState(false)
  const [unassigningDetectedStickers, setUnassigningDetectedStickers] = useState(false)
  const [processingSourceBlockDetection, setProcessingSourceBlockDetection] = useState(false)
  const [sourceBlockStickers, setSourceBlockStickers] = useState([])
  const [loadingSourceBlockStickers, setLoadingSourceBlockStickers] = useState(false)
  const [duplicatingSourceBlocks, setDuplicatingSourceBlocks] = useState(false)
  const [duplicatingSourceBlock, setDuplicatingSourceBlock] = useState(false)
  const [pageLayoutTemplates, setPageLayoutTemplates] = useState([])
  const [selectedPageLayoutTemplateId, setSelectedPageLayoutTemplateId] = useState(null)
  const [pageLayoutForm, setPageLayoutForm] = useState(createEmptyPageLayoutForm)
  const [savingPageLayoutTemplate, setSavingPageLayoutTemplate] = useState(false)
  const [applyingPageLayoutTemplate, setApplyingPageLayoutTemplate] = useState(false)
  const [deletingPageLayoutTemplate, setDeletingPageLayoutTemplate] = useState(false)
  const [customTemplates, setCustomTemplates] = useState([])
  const [selectedCustomTemplateId, setSelectedCustomTemplateId] = useState(null)
  const [customTemplateForm, setCustomTemplateForm] = useState(createEmptyCustomTemplateForm)
  const [customTemplateTextBulkForm, setCustomTemplateTextBulkForm] = useState(createEmptyCustomTemplateTextBulkForm)
  const [savingCustomTemplate, setSavingCustomTemplate] = useState(false)
  const [uploadingTemplateLayerKey, setUploadingTemplateLayerKey] = useState('')
  const [deletingTemplateLayerKey, setDeletingTemplateLayerKey] = useState('')
  const [importingTemplateBatch, setImportingTemplateBatch] = useState(false)
  const [deletingCustomTemplate, setDeletingCustomTemplate] = useState(false)
  const [uploadingBaseProfile, setUploadingBaseProfile] = useState('')
  const [deletingBaseProfile, setDeletingBaseProfile] = useState('')
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
  const [deletingCollection, setDeletingCollection] = useState(false)
  useEffect(() => {
    if (!error || !/Sessao administrativa/i.test(error)) return
    setToken('')
    setAuthError('Sua sessao expirou. Entre novamente.')
    setError('')
  }, [error, setToken])

  const selectedSourceDocumentSummary =
    sourceDocuments.find(document => document.id === selectedSourceDocumentId) || null
  const selectedSourceDocumentPage =
    selectedSourceDocument?.pages?.find(page => page.id === selectedSourceDocumentPageId) || null
  const selectedSourceDocumentPreviousPage =
    selectedSourceDocument?.pages?.find(page => page.page_number === (selectedSourceDocumentPage?.page_number || 0) - 1) || null
  const selectedSourceBlock =
    selectedSourceDocumentPage?.blocks?.find(block => block.id === editingSourceBlockId) || null
  const selectedSourceDetectedStickers = useMemo(
    () => sourceDetectedStickers.filter(detected => selectedDetectedStickerIds.includes(detected.id)),
    [sourceDetectedStickers, selectedDetectedStickerIds]
  )
  const selectedPendingSourceDetectedStickers = useMemo(
    () => selectedSourceDetectedStickers.filter(detected => detected.status === 'PENDENTE'),
    [selectedSourceDetectedStickers]
  )
  const selectedAssignedSourceDetectedStickers = useMemo(
    () => selectedSourceDetectedStickers.filter(detected => detected.status === 'ATRIBUIDA'),
    [selectedSourceDetectedStickers]
  )
  const pendingSourceDetectedStickers = useMemo(
    () => sourceDetectedStickers.filter(detected => detected.status === 'PENDENTE'),
    [sourceDetectedStickers]
  )
  const assignedSourceDetectedStickers = useMemo(
    () => sourceDetectedStickers.filter(detected => detected.status === 'ATRIBUIDA'),
    [sourceDetectedStickers]
  )
  const selectedPageLayoutTemplate =
    pageLayoutTemplates.find(template => template.id === selectedPageLayoutTemplateId) || null
  const selectedCustomTemplateSummary =
    customTemplates.find(template => template.id === selectedCustomTemplateId) || null
  const suggestedCustomTemplateName =
    customTemplateForm.name.trim() || buildCustomTemplateName(
      customTemplateForm.profile_type,
      customTemplateForm.position_type,
      customTemplateForm.category_type
    )
  const importedTemplateLayerCount = customTemplateForm.layers.filter(layer => layer.file_path).length
  const currentTemplateManualStatus = customTemplateForm.manual_status || createEmptyCustomTemplateManualStatus()
  const indexedCustomTemplateLayers = useMemo(
    () => customTemplateForm.layers.map((layer, index) => ({ layer, index })),
    [customTemplateForm.layers]
  )
  const standardCustomTemplateLayers = useMemo(
    () =>
      standardCustomTemplateLayerTypes
        .map(layerType => indexedCustomTemplateLayers.find(entry => entry.layer.layer_type === layerType))
        .filter(Boolean),
    [indexedCustomTemplateLayers]
  )
  const extraCustomTemplateLayers = useMemo(
    () => indexedCustomTemplateLayers.filter(entry => !isStandardCustomTemplateLayerType(entry.layer.layer_type)),
    [indexedCustomTemplateLayers]
  )
  const customTemplatePreviewLayers = useMemo(
    () =>
      customTemplateForm.layers
        .filter(layer => layer.is_active && layer.file_path)
        .sort((left, right) => Number(left.z_index || 0) - Number(right.z_index || 0)),
    [customTemplateForm.layers]
  )
  const customTemplatePreviewTextSlots = useMemo(
    () =>
      customTemplateForm.text_slots
        .map(slot => ({
          ...slot,
          x: Number(slot.x || 0),
          y: Number(slot.y || 0),
          width: Number(slot.width || 0),
          font_size: Number(slot.font_size || 12)
        }))
        .filter(slot => slot.width > 0),
    [customTemplateForm.text_slots]
  )
  const currentTemplatePreviewPath =
    selectedCustomTemplateSummary?.preview_path ||
    customTemplateForm.layers.find(layer => layer.file_path && layer.is_active)?.file_path ||
    ''

  async function fetchCollectionWorkspace(collectionId, preferredPageId = currentPageId, shouldApply = () => true) {
    if (!token || !collectionId) return
    setLoading(true)
    try {
      const [collection, pagesData, stickersData] = await Promise.all([
        apiFetch(`/admin/collections/${collectionId}`, { headers: buildAdminHeaders(token) }),
        apiFetch(`/admin/collections/${collectionId}/pages`, { headers: buildAdminHeaders(token) }),
        apiFetch(`/admin/collections/${collectionId}/stickers`, { headers: buildAdminHeaders(token) })
      ])
      if (!shouldApply()) return
      setSelectedCollection(collection)
      setPages(pagesData)
      setStickers(stickersData)
      const nextPageId = pagesData.some(page => page.id === preferredPageId) ? preferredPageId : pagesData[0]?.id || null
      setCurrentPageId(nextPageId)
      if (editingStickerId && !stickersData.some(sticker => sticker.id === editingStickerId)) {
        setEditingStickerId(null)
        setDraftRect(null)
      }
    } finally {
      if (!shouldApply()) return
      setLoading(false)
    }
  }

  function updateExportExtraQuantity(collectionId, nextQuantity, maxQuantity) {
    setSelectedExportExtras(current => {
      const requested = Math.max(0, Number(nextQuantity || 0))
      const normalized = Number(maxQuantity || 0) > 0 ? Math.min(requested, Number(maxQuantity)) : requested
      if (normalized <= 0) {
        const { [collectionId]: _removed, ...rest } = current
        return rest
      }
      return {
        ...current,
        [collectionId]: normalized
      }
    })
  }

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
    setServiceForm(serviceConfigToForm(data))
  }

  async function fetchAccessSummary() {
    if (!token) return
    const data = await apiFetch('/admin/access-summary', {
      headers: buildAdminHeaders(token)
    })
    setAccessSummary(data)
  }

  async function fetchSourceDocuments(activeDocumentId = selectedSourceDocumentId, shouldApply = () => true) {
    if (!token || !selectedAlbumId) {
      setSourceDocuments([])
      setSelectedSourceDocumentId(null)
      setSelectedSourceDocument(null)
      return
    }
    setLoadingSourceDocuments(true)
    try {
      const data = await apiFetch(`/admin/source-documents?album_id=${selectedAlbumId}`, {
        headers: buildAdminHeaders(token)
      })
      if (!shouldApply()) return
      setSourceDocuments(data)
      const nextId = data.some(document => document.id === activeDocumentId) ? activeDocumentId : data[0]?.id || null
      setSelectedSourceDocumentId(nextId)
      if (!nextId) {
        setSelectedSourceDocument(null)
      }
    } finally {
      if (!shouldApply()) return
      setLoadingSourceDocuments(false)
    }
  }

  async function fetchSourceDocumentDetailData(documentId = selectedSourceDocumentId, shouldApply = () => true) {
    if (!token || !documentId) {
      setSelectedSourceDocument(null)
      return
    }
    const data = await apiFetch(`/admin/source-documents/${documentId}`, {
      headers: buildAdminHeaders(token)
    })
    if (!shouldApply()) return
    setSelectedSourceDocument(data)
  }

  async function fetchSourceBlockStickers(blockId = editingSourceBlockId, shouldApply = () => true) {
    if (!token || !blockId) {
      setSourceBlockStickers([])
      return
    }
    setLoadingSourceBlockStickers(true)
    try {
      const data = await apiFetch(`/admin/page-selection-blocks/${blockId}/stickers`, {
        headers: buildAdminHeaders(token)
      })
      if (!shouldApply()) return
      setSourceBlockStickers(data)
    } finally {
      if (!shouldApply()) return
      setLoadingSourceBlockStickers(false)
    }
  }

  async function fetchSourceDetectedStickers(pageId = selectedSourceDocumentPageId, shouldApply = () => true) {
    if (!token || !pageId) {
      setSourceDetectedStickers([])
      setSelectedDetectedStickerIds([])
      return
    }
    setLoadingSourceDetectedStickers(true)
    try {
      const data = await apiFetch(`/admin/source-document-pages/${pageId}/detected-stickers`, {
        headers: buildAdminHeaders(token)
      })
      if (!shouldApply()) return
      setSourceDetectedStickers(data)
      setSelectedDetectedStickerIds(current => current.filter(id => data.some(detected => detected.id === id)))
    } finally {
      if (!shouldApply()) return
      setLoadingSourceDetectedStickers(false)
    }
  }

  async function fetchPageLayoutTemplates(activeTemplateId = selectedPageLayoutTemplateId, shouldApply = () => true) {
    if (!token || !selectedAlbumId) {
      setPageLayoutTemplates([])
      setSelectedPageLayoutTemplateId(null)
      return
    }
    const data = await apiFetch(`/admin/page-layout-templates?album_id=${selectedAlbumId}`, {
      headers: buildAdminHeaders(token)
    })
    if (!shouldApply()) return
    setPageLayoutTemplates(data)
    const nextId = data.some(template => template.id === activeTemplateId) ? activeTemplateId : data[0]?.id || null
    setSelectedPageLayoutTemplateId(nextId)
  }

  async function fetchCustomTemplates(activeTemplateId = selectedCustomTemplateId) {
    if (!token || !selectedAlbumId) {
      setCustomTemplates([])
      setSelectedCustomTemplateId(null)
      setCustomTemplateForm(createEmptyCustomTemplateForm())
      return
    }
    const data = await apiFetch(`/admin/custom-templates?album_id=${selectedAlbumId}`, {
      headers: buildAdminHeaders(token)
    })
    setCustomTemplates(data)
    const nextId = data.some(template => template.id === activeTemplateId) ? activeTemplateId : data[0]?.id || null
    setSelectedCustomTemplateId(nextId)
    if (!nextId) {
      setCustomTemplateForm(createEmptyCustomTemplateForm())
    }
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
        await Promise.all([fetchAlbums(), fetchCollections(), fetchServiceConfig(), fetchOrders(), fetchAccessSummary()])
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
    if (!token) return
    fetchCustomTemplates()
  }, [token, selectedAlbumId])

  useEffect(() => {
    if (!token || !selectedAlbumId) {
      setPageLayoutTemplates([])
      setSelectedPageLayoutTemplateId(null)
      return
    }
    let ignore = false
    async function loadPageLayoutTemplates() {
      try {
        await fetchPageLayoutTemplates(selectedPageLayoutTemplateId, () => !ignore)
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      }
    }
    loadPageLayoutTemplates()
    return () => {
      ignore = true
    }
  }, [token, selectedAlbumId])

  useEffect(() => {
    if (!token || !selectedAlbumId) {
      setSourceDocuments([])
      setSelectedSourceDocumentId(null)
      setSelectedSourceDocument(null)
      return
    }
    setSelectedSourceDocument(null)
    let ignore = false
    async function loadSourceDocuments() {
      try {
        await fetchSourceDocuments(selectedSourceDocumentId, () => !ignore)
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      }
    }
    loadSourceDocuments()
    return () => {
      ignore = true
    }
  }, [token, selectedAlbumId])

  useEffect(() => {
    if (!token || !selectedSourceDocumentId) {
      if (!selectedSourceDocumentId) {
        setSelectedSourceDocument(null)
      }
      return
    }
    let ignore = false
    async function loadSourceDocumentDetail() {
      try {
        await fetchSourceDocumentDetailData(selectedSourceDocumentId, () => !ignore)
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      }
    }
    loadSourceDocumentDetail()
    return () => {
      ignore = true
    }
  }, [token, selectedSourceDocumentId])

  useEffect(() => {
    if (!token || !selectedCustomTemplateId) {
      if (!selectedCustomTemplateId) {
        setCustomTemplateForm(current => ({
          ...createEmptyCustomTemplateForm(),
          album_id: String(selectedAlbumId || current.album_id || '')
        }))
      }
      return
    }
    let ignore = false
    async function fetchTemplateDetail() {
      try {
        const data = await apiFetch(`/admin/custom-templates/${selectedCustomTemplateId}`, {
          headers: buildAdminHeaders(token)
        })
        if (ignore) return
        setCustomTemplateForm(customTemplateDetailToForm(data))
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      }
    }
    fetchTemplateDetail()
    return () => {
      ignore = true
    }
  }, [token, selectedCustomTemplateId])

  useEffect(() => {
    if (!selectedCustomTemplateId) {
      setCustomTemplateForm(current => ({
        ...current,
        album_id: String(selectedAlbumId || '')
      }))
    }
  }, [selectedAlbumId, selectedCustomTemplateId])

  useEffect(() => {
    setSourceDocumentForm(current => ({
      ...current,
      album_id: String(selectedAlbumId || current.album_id || '')
    }))
  }, [selectedAlbumId])

  useEffect(() => {
    const nextFilteredCollections = collections.filter(
      collection => !selectedAlbumId || collection.album_id === selectedAlbumId
    )
    if (nextFilteredCollections.some(collection => String(collection.id) === sourceDetectedCollectionId)) {
      return
    }
    setSourceDetectedCollectionId(String(selectedCollectionId || nextFilteredCollections[0]?.id || ''))
  }, [collections, selectedAlbumId, selectedCollectionId, sourceDetectedCollectionId])

  useEffect(() => {
    const pagesList = selectedSourceDocument?.pages || []
    const nextPageId = pagesList.some(page => page.id === selectedSourceDocumentPageId)
      ? selectedSourceDocumentPageId
      : pagesList[0]?.id || null
    setSelectedSourceDocumentPageId(nextPageId)
    setSourcePageInteractionMode('detected')
    setEditingSourceBlockId(null)
    setSourceBlockDraftRect(null)
    setSourceBlockSelectionRect(null)
    setSourceBlockDragState(null)
    setSourceBlockForm(createEmptySourceBlockForm())
    setSourceBlockStickers([])
    setSourceDetectedStickers([])
    setSelectedDetectedStickerIds([])
  }, [selectedSourceDocumentId, selectedSourceDocument?.updated_at])

  useEffect(() => {
    if (!selectedSourceDocumentPage) return
    setPageLayoutForm(current =>
      current.name.trim()
        ? current
        : { name: `Layout pagina ${selectedSourceDocumentPage.page_number}` }
    )
  }, [selectedSourceDocumentPageId])

  useEffect(() => {
    if (!token || !selectedSourceDocumentPageId) {
      setSourceDetectedStickers([])
      setSelectedDetectedStickerIds([])
      return
    }
    let ignore = false
    async function loadDetectedStickers() {
      try {
        await fetchSourceDetectedStickers(selectedSourceDocumentPageId, () => !ignore)
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      }
    }
    loadDetectedStickers()
    return () => {
      ignore = true
    }
  }, [token, selectedSourceDocumentPageId, selectedSourceDocument?.updated_at])

  useEffect(() => {
    if (!token || !editingSourceBlockId) {
      setSourceBlockStickers([])
      return
    }
    let ignore = false
    async function loadBlockStickers() {
      try {
        await fetchSourceBlockStickers(editingSourceBlockId, () => !ignore)
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      }
    }
    loadBlockStickers()
    return () => {
      ignore = true
    }
  }, [token, editingSourceBlockId])

  useEffect(() => {
    if (!token || !selectedCollectionId) {
      setSelectedCollection(null)
      setPages([])
      setStickers([])
      return
    }

    let ignore = false
    async function fetchCollectionDetail() {
      try {
        setError('')
        await fetchCollectionWorkspace(selectedCollectionId, currentPageId, () => !ignore)
        if (ignore) return
      } catch (err) {
        if (!ignore) {
          setError(err.message)
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
  const isAppendOnlyExtraCollection =
    selectedCollection?.collection_type === 'OUTROS' && selectedCollection?.export_mode === 'APPEND_FULL_PDF'
  const isCreatingAlbum = albumStructureMode === 'create'
  const isCreatingCollection = collectionStructureMode === 'create'
  const isCreationLocked = isCreatingAlbum || isCreatingCollection
  const adminTitle = isCreatingAlbum
    ? 'Novo album'
    : isCreatingCollection
      ? 'Nova selecao'
      : selectedCollection?.name || selectedAlbum?.name || 'Selecione um album'
  const adminDescription = isCreatingAlbum
    ? 'Crie uma nova edicao principal sem depender da selecao que estava aberta antes.'
    : isCreatingCollection
      ? `Cadastre uma nova selecao dentro de ${selectedAlbum?.name || 'um album escolhido'}.`
      : 'Organize a estrutura do album, o atendimento local e o mapeamento sem abrir tudo ao mesmo tempo.'

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

    const shouldKeepCollectionDetached = isCreationLocked && selectedCollectionId === null

    if (shouldKeepCollectionDetached) {
      return
    }

    if (!filteredCollections.some(collection => collection.id === selectedCollectionId)) {
      setSelectedCollectionId(filteredCollections[0]?.id || null)
      setCurrentPageId(null)
      resetStickerForm()
    }
  }, [filteredCollections, isCreationLocked, selectedCollectionId])

  useEffect(() => {
    if (!selectedCollection) return
    setCollectionAlbumTargetId(String(selectedCollection.album_id || ''))
  }, [selectedCollection])

  useEffect(() => {
    if (!selectedAlbum) {
      setSelectedAlbumForm({ name: '', slug: '', description: '', sort_order: '0' })
      setSelectedAlbumSlugEdited(false)
      setSelectedAlbumSlugManualOpen(false)
      return
    }
    setSelectedAlbumForm({
      name: selectedAlbum.name || '',
      slug: selectedAlbum.slug || '',
      description: selectedAlbum.description || '',
      sort_order: String(selectedAlbum.sort_order ?? 0)
    })
    setSelectedAlbumSlugEdited(false)
    setSelectedAlbumSlugManualOpen(false)
  }, [selectedAlbum])

  useEffect(() => {
    if (!selectedCollection) {
      setSelectedCollectionForm(createEmptyCollectionAdminForm())
      setSelectedCollectionSlugEdited(false)
      setSelectedCollectionSlugManualOpen(false)
      return
    }
    setSelectedCollectionForm({
      name: selectedCollection.name || '',
      slug: selectedCollection.slug || '',
      description: selectedCollection.description || '',
      collection_type: selectedCollection.collection_type || 'SELECAO',
      display_group_order: String(selectedCollection.display_group_order ?? 1),
      display_item_order: String(selectedCollection.display_item_order ?? 999),
      sort_order: String(selectedCollection.sort_order ?? 0)
    })
    setSelectedCollectionSlugEdited(false)
    setSelectedCollectionSlugManualOpen(false)
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

  function handleAlbumNameChange(value) {
    setAlbumForm(current => ({
      ...current,
      name: value,
      slug: albumSlugEdited ? current.slug : buildSlug(value)
    }))
  }

  function handleAlbumSlugChange(value) {
    setAlbumSlugEdited(true)
    setAlbumForm(current => ({ ...current, slug: buildSlug(value) }))
  }

  function handleAlbumSlugAutoMode() {
    setAlbumSlugEdited(false)
    setAlbumSlugManualOpen(false)
    setAlbumForm(current => ({ ...current, slug: buildSlug(current.name) }))
  }

  function handleCreateCollectionNameChange(value) {
    setCreateForm(current => ({
      ...current,
      name: value,
      slug: createCollectionSlugEdited ? current.slug : buildSlug(value)
    }))
  }

  function handleCreateCollectionSlugChange(value) {
    setCreateCollectionSlugEdited(true)
    setCreateForm(current => ({ ...current, slug: buildSlug(value) }))
  }

  function handleCreateCollectionSlugAutoMode() {
    setCreateCollectionSlugEdited(false)
    setCreateCollectionSlugManualOpen(false)
    setCreateForm(current => ({ ...current, slug: buildSlug(current.name) }))
  }

  function handleSelectedAlbumNameChange(value) {
    setSelectedAlbumForm(current => ({
      ...current,
      name: value,
      slug: selectedAlbumSlugEdited ? current.slug : buildSlug(value)
    }))
  }

  function handleSelectedAlbumSlugChange(value) {
    setSelectedAlbumSlugEdited(true)
    setSelectedAlbumForm(current => ({ ...current, slug: buildSlug(value) }))
  }

  function handleSelectedAlbumSlugAutoMode() {
    setSelectedAlbumSlugEdited(false)
    setSelectedAlbumSlugManualOpen(false)
    setSelectedAlbumForm(current => ({ ...current, slug: buildSlug(current.name) }))
  }

  function handleSelectedCollectionNameChange(value) {
    setSelectedCollectionForm(current => ({
      ...current,
      name: value,
      slug: selectedCollectionSlugEdited ? current.slug : buildSlug(value)
    }))
  }

  function handleSelectedCollectionSlugChange(value) {
    setSelectedCollectionSlugEdited(true)
    setSelectedCollectionForm(current => ({ ...current, slug: buildSlug(value) }))
  }

  function handleSelectedCollectionSlugAutoMode() {
    setSelectedCollectionSlugEdited(false)
    setSelectedCollectionSlugManualOpen(false)
    setSelectedCollectionForm(current => ({ ...current, slug: buildSlug(current.name) }))
  }

  function handleStartNewCustomTemplate() {
    const nextOrder =
      customTemplates.reduce((maxValue, template) => Math.max(maxValue, Number(template.sort_order || 0)), 0) + 1
    setSelectedCustomTemplateId(null)
    setCustomTemplateForm({
      ...createEmptyCustomTemplateForm(),
      album_id: String(selectedAlbumId || ''),
      name: buildCustomTemplateName('HOMEM', 'ATACANTE', 'JOGADOR'),
      sort_order: String(nextOrder)
    })
  }

  function addCustomTemplateLayer() {
    setCustomTemplateForm(current => ({
      ...current,
      layers: [
        ...current.layers,
        {
          layer_type: 'OVERLAY',
          label: 'Overlay extra',
          file_path: '',
          z_index: String((current.layers.length + 1) * 10),
          is_active: true
        }
      ]
    }))
  }

  function removeCustomTemplateLayer(index) {
    setCustomTemplateForm(current => ({
      ...current,
      layers: current.layers.filter((_, itemIndex) => itemIndex !== index)
    }))
  }

  function addCustomTemplateTextSlot() {
    setCustomTemplateForm(current => ({
      ...current,
      text_slots: [
        ...current.text_slots,
        {
          field_name: 'NAME',
          x: '0',
          y: '0',
          width: '0',
          font_size: '12',
          font_weight: '',
          text_align: '',
          color: ''
        }
      ]
    }))
  }

  function removeCustomTemplateTextSlot(index) {
    setCustomTemplateForm(current => ({
      ...current,
      text_slots: current.text_slots.filter((_, itemIndex) => itemIndex !== index)
    }))
  }

  function applyBulkCustomTemplateTextAdjustments() {
    const deltaX = Number(customTemplateTextBulkForm.delta_x || 0)
    const deltaY = Number(customTemplateTextBulkForm.delta_y || 0)
    const deltaWidth = Number(customTemplateTextBulkForm.delta_width || 0)
    const deltaFontSize = Number(customTemplateTextBulkForm.delta_font_size || 0)
    const nextFontWeight = customTemplateTextBulkForm.font_weight.trim()
    const nextTextAlign = customTemplateTextBulkForm.text_align.trim()
    const nextColor = customTemplateTextBulkForm.color.trim()

    setCustomTemplateForm(current => ({
      ...current,
      text_slots: current.text_slots.map(slot => ({
        ...slot,
        x: String(Number(slot.x || 0) + deltaX),
        y: String(Number(slot.y || 0) + deltaY),
        width: String(Math.max(0, Number(slot.width || 0) + deltaWidth)),
        font_size: String(Math.max(1, Number(slot.font_size || 12) + deltaFontSize)),
        font_weight: nextFontWeight || slot.font_weight,
        text_align: nextTextAlign || slot.text_align,
        color: nextColor || slot.color
      }))
    }))
  }

  function resolvePersistedTemplateLayer(persistedTemplate, referenceLayer, referenceIndex, currentLayers) {
    const sourceLayers = currentLayers || customTemplateForm.layers || []
    const ordinal = sourceLayers
      .slice(0, referenceIndex + 1)
      .filter(item => item.layer_type === referenceLayer.layer_type).length - 1
    const candidates = (persistedTemplate?.layers || []).filter(item => item.layer_type === referenceLayer.layer_type)
    return candidates[Math.max(ordinal, 0)] || candidates[0] || null
  }

  async function persistCustomTemplate({ successMessage = '' } = {}) {
    const resolvedAlbumId = Number(customTemplateForm.album_id || selectedAlbumId || 0)
    if (!resolvedAlbumId) {
      throw new Error('Escolha um album antes de criar ou editar um modelo da Minha Figurinha.')
    }
    const payload = {
      album_id: resolvedAlbumId,
      name: suggestedCustomTemplateName,
      profile_type: customTemplateForm.profile_type,
      category_type: customTemplateForm.category_type,
      position_type: customTemplateForm.position_type,
      composition_mode: customTemplateForm.composition_mode,
      sort_order: Number(customTemplateForm.sort_order || 0),
      is_active: customTemplateForm.is_active,
      layers: customTemplateForm.layers.map(layer => ({
        layer_type: layer.layer_type,
        label: layer.label,
        file_path: layer.file_path || null,
        z_index: Number(layer.z_index || 0),
        is_active: layer.is_active
      })),
      photo_slot: customTemplateForm.photo_slot
        ? {
            x: Number(customTemplateForm.photo_slot.x || 0),
            y: Number(customTemplateForm.photo_slot.y || 0),
            width: Number(customTemplateForm.photo_slot.width || 0),
            height: Number(customTemplateForm.photo_slot.height || 0),
            default_scale: Number(customTemplateForm.photo_slot.default_scale || 1),
            min_scale: Number(customTemplateForm.photo_slot.min_scale || 0.7),
            max_scale: Number(customTemplateForm.photo_slot.max_scale || 2.4),
            portrait_z_index: Number(customTemplateForm.photo_slot.portrait_z_index || 30),
            anchor_x: Number(customTemplateForm.photo_slot.anchor_x || 0.5),
            anchor_y: Number(customTemplateForm.photo_slot.anchor_y || 0.5),
            visible_x: Number(customTemplateForm.photo_slot.visible_x || 0),
            visible_y: Number(customTemplateForm.photo_slot.visible_y || 0),
            visible_width: Number(customTemplateForm.photo_slot.visible_width || 1),
            visible_height: Number(customTemplateForm.photo_slot.visible_height || 0.9)
          }
        : null,
      text_slots: customTemplateForm.text_slots.map(slot => ({
        field_name: slot.field_name,
        x: Number(slot.x || 0),
        y: Number(slot.y || 0),
        width: Number(slot.width || 0),
        font_size: Number(slot.font_size || 12),
        font_weight: slot.font_weight || null,
        text_align: slot.text_align || null,
        color: slot.color || null
      }))
    }
    const data = await apiFetch(
      selectedCustomTemplateId ? `/admin/custom-templates/${selectedCustomTemplateId}` : '/admin/custom-templates',
      {
        method: selectedCustomTemplateId ? 'PUT' : 'POST',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      }
    )
    setSelectedCustomTemplateId(data.id)
    setCustomTemplateForm(customTemplateDetailToForm(data))
    await fetchCustomTemplates(data.id)
    if (successMessage) {
      setMessage(successMessage)
    }
    return data
  }

  async function handleSaveCustomTemplate(event) {
    event.preventDefault()
    setSavingCustomTemplate(true)
    setError('')
    setMessage('')
    try {
      await persistCustomTemplate({
        successMessage: selectedCustomTemplateId ? 'Modelo salvo.' : 'Modelo criado.'
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingCustomTemplate(false)
    }
  }

  async function handleCustomTemplateLayerUpload(layer, file, layerIndex) {
    if (!token || !layer || !file) return
    setError('')
    setMessage('')
    let actionKey = ''
    try {
      let templateId = selectedCustomTemplateId
      let targetLayer = layer

      if (!templateId || !layer.id) {
        const persisted = await persistCustomTemplate()
        templateId = persisted.id
        targetLayer = resolvePersistedTemplateLayer(persisted, layer, layerIndex, customTemplateForm.layers)
        if (!targetLayer?.id) {
          throw new Error('Nao consegui preparar essa camada para upload. Tente salvar o modelo e enviar novamente.')
        }
      }

      actionKey = `${templateId}:${targetLayer.id}`
      setUploadingTemplateLayerKey(actionKey)
      const formData = new FormData()
      formData.append('file', file)
      const data = await apiFetch(`/admin/custom-templates/${templateId}/layers/${targetLayer.id}/file`, {
        method: 'POST',
        headers: buildAdminHeaders(token),
        body: formData
      })
      setCustomTemplateForm(customTemplateDetailToForm(data))
      await fetchCustomTemplates(templateId)
      setMessage(
        data.manual_status?.ready
          ? 'Camada enviada. Modelo pronto para montagem manual.'
          : `Camada enviada. Ainda faltam: ${(data.manual_status?.missing_labels || []).join(', ')}.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingTemplateLayerKey('')
    }
  }

  async function handleCustomTemplateLayerDelete(layer, layerIndex) {
    if (!token || !layer?.file_path) return
    setError('')
    setMessage('')
    let actionKey = ''
    try {
      let templateId = selectedCustomTemplateId
      let targetLayer = layer

      if (!templateId || !layer.id) {
        const persisted = await persistCustomTemplate()
        templateId = persisted.id
        targetLayer = resolvePersistedTemplateLayer(persisted, layer, layerIndex, customTemplateForm.layers)
        if (!targetLayer?.id) {
          throw new Error('Nao consegui localizar essa camada para remover a imagem.')
        }
      }

      actionKey = `${templateId}:${targetLayer.id}`
      setDeletingTemplateLayerKey(actionKey)
      const data = await apiFetch(`/admin/custom-templates/${templateId}/layers/${targetLayer.id}/file`, {
        method: 'DELETE',
        headers: buildAdminHeaders(token)
      })
      setCustomTemplateForm(customTemplateDetailToForm(data))
      await fetchCustomTemplates(templateId)
      setMessage(
        data.manual_status?.ready
          ? 'Camada removida e o modelo segue pronto.'
          : `Camada removida. Agora faltam: ${(data.manual_status?.missing_labels || []).join(', ')}.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingTemplateLayerKey('')
    }
  }

  async function handleCustomTemplateBatchImport(fileList) {
    if (!token || !fileList?.length) return
    setImportingTemplateBatch(true)
    setError('')
    setMessage('')
    try {
      const persisted = await persistCustomTemplate()
      const targetTemplateId = persisted.id
      const formData = new FormData()
      Array.from(fileList).forEach(file => {
        formData.append('files', file)
      })
      const data = await apiFetch(`/admin/custom-templates/${targetTemplateId}/import-layers`, {
        method: 'POST',
        headers: buildAdminHeaders(token),
        body: formData
      })
      setCustomTemplateForm(customTemplateDetailToForm(data))
      setSelectedCustomTemplateId(targetTemplateId)
      await fetchCustomTemplates(targetTemplateId)
      setMessage(
        data.manual_status?.ready
          ? 'Pacote importado. Modelo pronto para montagem manual.'
          : `Pacote importado. Ainda faltam: ${(data.manual_status?.missing_labels || []).join(', ')}.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setImportingTemplateBatch(false)
    }
  }

  async function handleDeleteCustomTemplate() {
    if (!token || !selectedCustomTemplateId) return
    const templateName = selectedCustomTemplateSummary?.name || suggestedCustomTemplateName || 'este modelo'
    const confirmed = window.confirm(`Excluir "${templateName}"? Essa acao remove o modelo e as imagens das camadas.`)
    if (!confirmed) return

    setDeletingCustomTemplate(true)
    setError('')
    setMessage('')
    try {
      await apiFetch(`/admin/custom-templates/${selectedCustomTemplateId}`, {
        method: 'DELETE',
        headers: buildAdminHeaders(token)
      })
      setSelectedCustomTemplateId(null)
      await fetchCustomTemplates(null)
      setMessage('Modelo excluido.')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingCustomTemplate(false)
    }
  }

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
      setToken(data)
      setPassword('')
    } catch (err) {
      setAuthError(err.message)
    }
  }

  async function handleLogout() {
    try {
      if (token) {
        await apiFetch('/admin/session', {
          method: 'DELETE',
          headers: buildAdminHeaders(token)
        })
      }
    } catch {
      // ignore logout failures and clear local session anyway
    } finally {
      setToken('')
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
      setAlbumSlugEdited(false)
      setAlbumSlugManualOpen(false)
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
          display_group_order: Number(createForm.display_group_order || 1),
          display_item_order: Number(createForm.display_item_order || 999),
          sort_order: Number(createForm.sort_order || 0)
        })
      })
      setCreateForm(current => ({
        ...createEmptyCollectionAdminForm(current.album_id),
        album_id: current.album_id,
        collection_type: current.collection_type,
        display_group_order: current.display_group_order
      }))
      setCreateCollectionSlugEdited(false)
      setCreateCollectionSlugManualOpen(false)
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

  async function handleDeleteAlbum() {
    if (!selectedAlbumId || !selectedAlbum) return
    const confirmed = window.confirm(
      `Excluir "${selectedAlbum.name}"? Essa acao remove o album, as colecoes, figurinhas, modelos, pedidos e arquivos relacionados.`
    )
    if (!confirmed) return

    const typedName = window.prompt(
      `Para confirmar, digite exatamente o nome do album:\n\n${selectedAlbum.name}`
    )
    if (typedName === null) return
    if (typedName.trim() !== selectedAlbum.name.trim()) {
      window.alert('O nome digitado nao confere. O album nao foi excluido.')
      return
    }

    setDeletingAlbum(true)
    setError('')
    setMessage('')
    try {
      await apiFetch(`/admin/albums/${selectedAlbumId}`, {
        method: 'DELETE',
        headers: buildAdminHeaders(token)
      })
      setSelectedCollectionId(null)
      setSelectedCollection(null)
      setPages([])
      setStickers([])
      setCurrentPageId(null)
      setSelectedCustomTemplateId(null)
      setCustomTemplateForm(createEmptyCustomTemplateForm())
      setSelectedSourceDocumentId(null)
      setSelectedSourceDocument(null)
      setSourceDocuments([])
      resetStickerForm()
      setAdminView('structure')
      setMessage('Album excluido.')
      await Promise.all([fetchAlbums(null), fetchCollections(null)])
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingAlbum(false)
    }
  }

  async function handleCreateSourceDocument(event) {
    event.preventDefault()
    if (!sourceDocumentForm.album_id || !sourceDocumentForm.title.trim() || !sourceDocumentForm.file) {
      setError('Escolha o album, defina um titulo e envie o PDF antes de continuar.')
      return
    }

    setSavingSourceDocument(true)
    setError('')
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('album_id', sourceDocumentForm.album_id)
      formData.append('title', sourceDocumentForm.title.trim())
      formData.append('file', sourceDocumentForm.file)
      const created = await apiFetch('/admin/source-documents', {
        method: 'POST',
        headers: buildAdminHeaders(token),
        body: formData
      })
      setSelectedSourceDocumentId(created.id)
      setSelectedSourceDocument(created)
      setSourceDocumentForm(createEmptySourceDocumentForm(selectedAlbumId || sourceDocumentForm.album_id))
      setSourceDocumentUploadResetKey(current => current + 1)
      await fetchSourceDocuments(created.id)
      setMessage('Documento fonte enviado e paginas renderizadas.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingSourceDocument(false)
    }
  }

  async function handleDeleteSourceDocument() {
    if (!token || !selectedSourceDocumentId || !selectedSourceDocumentSummary) return
    const confirmed = window.confirm(
      `Excluir "${selectedSourceDocumentSummary.title}"? Essa acao remove o PDF e as paginas renderizadas desse documento fonte.`
    )
    if (!confirmed) return

    setDeletingSourceDocument(true)
    setError('')
    setMessage('')
    try {
      await apiFetch(`/admin/source-documents/${selectedSourceDocumentId}`, {
        method: 'DELETE',
        headers: buildAdminHeaders(token)
      })
      const deletedId = selectedSourceDocumentId
      setSelectedSourceDocumentId(null)
      setSelectedSourceDocument(null)
      await fetchSourceDocuments(sourceDocuments.find(document => document.id !== deletedId)?.id || null)
      setMessage('Documento fonte excluido.')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingSourceDocument(false)
    }
  }

  async function handleCreatePageLayoutTemplate(event) {
    event.preventDefault()
    if (!token || !selectedSourceDocumentPage) return
    if (!pageLayoutForm.name.trim()) {
      setError('Dê um nome para o layout mestre antes de salvar.')
      return
    }
    setSavingPageLayoutTemplate(true)
    setError('')
    setMessage('')
    try {
      const created = await apiFetch(`/admin/source-document-pages/${selectedSourceDocumentPage.id}/layout-templates`, {
        method: 'POST',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: pageLayoutForm.name.trim() })
      })
      await fetchPageLayoutTemplates(created.id)
      setPageLayoutForm({ name: '' })
      setMessage(`Layout mestre "${created.name}" salvo.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPageLayoutTemplate(false)
    }
  }

  async function handleApplyPageLayoutTemplate() {
    if (!token || !selectedSourceDocumentPage || !selectedPageLayoutTemplate) return
    const hasExistingBlocks = (selectedSourceDocumentPage.blocks || []).length > 0
    if (hasExistingBlocks) {
      const confirmed = window.confirm(
        `Aplicar o layout mestre "${selectedPageLayoutTemplate.name}"? Os blocos atuais da pagina ${selectedSourceDocumentPage.page_number} serao substituidos.`
      )
      if (!confirmed) return
    }
    setApplyingPageLayoutTemplate(true)
    setError('')
    setMessage('')
    try {
      await apiFetch(
        `/admin/page-layout-templates/${selectedPageLayoutTemplate.id}/apply-to-page/${selectedSourceDocumentPage.id}?replace_existing=true`,
        {
          method: 'POST',
          headers: buildAdminHeaders(token)
        }
      )
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId)
      ])
      resetSourceBlockForm()
      setMessage(`Layout mestre "${selectedPageLayoutTemplate.name}" aplicado na pagina ${selectedSourceDocumentPage.page_number}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setApplyingPageLayoutTemplate(false)
    }
  }

  async function handleDeletePageLayoutTemplate() {
    if (!token || !selectedPageLayoutTemplate) return
    const confirmed = window.confirm(`Excluir o layout mestre "${selectedPageLayoutTemplate.name}"?`)
    if (!confirmed) return
    setDeletingPageLayoutTemplate(true)
    setError('')
    setMessage('')
    try {
      const deletedId = selectedPageLayoutTemplate.id
      await apiFetch(`/admin/page-layout-templates/${deletedId}`, {
        method: 'DELETE',
        headers: buildAdminHeaders(token)
      })
      await fetchPageLayoutTemplates(pageLayoutTemplates.find(template => template.id !== deletedId)?.id || null)
      setMessage('Layout mestre excluido.')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingPageLayoutTemplate(false)
    }
  }

  function resetSourceBlockForm(nextPage = selectedSourceDocumentPage) {
    const nextSortOrder =
      ((nextPage?.blocks || []).reduce((maxValue, block) => Math.max(maxValue, Number(block.sort_order || 0)), 0) || 0) + 1
    setEditingSourceBlockId(null)
    setSourceBlockForm({
      ...createEmptySourceBlockForm(),
      sort_order: String(nextSortOrder)
    })
    setSourceBlockDraftRect(null)
    setSourceBlockSelectionRect(null)
    setSourceBlockDragState(null)
  }

  function detectedStickerIntersectsSelection(detectedSticker, selectionRect, dragState) {
    if (!detectedSticker || detectedSticker.status !== 'PENDENTE') return false
    const left = detectedSticker.x_ratio * dragState.width
    const top = detectedSticker.y_ratio * dragState.height
    const width = detectedSticker.width_ratio * dragState.width
    const height = detectedSticker.height_ratio * dragState.height
    return !(
      left + width < selectionRect.left ||
      left > selectionRect.left + selectionRect.width ||
      top + height < selectionRect.top ||
      top > selectionRect.top + selectionRect.height
    )
  }

  function getSourcePreviewBoxStyle(xRatio, yRatio, widthRatio, heightRatio) {
    return {
      left: `${xRatio * 100}%`,
      top: `${yRatio * 100}%`,
      width: `${widthRatio * 100}%`,
      height: `${heightRatio * 100}%`
    }
  }

  function handleSourcePagePointerDown(event) {
    if (!selectedSourceDocumentPage) return
    if (event.target.closest('.fig-source-detected-overlay, .fig-source-block-overlay')) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const startX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width)
    const startY = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height)
    if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (sourcePageInteractionMode === 'block') {
      setSourceBlockDragState({
        startX,
        startY,
        width: bounds.width,
        height: bounds.height
      })
      setSourceBlockSelectionRect({ left: startX, top: startY, width: 0, height: 0 })
      return
    }
    if (sourcePageInteractionMode !== 'detected') return
    setSourceDetectedDragState({
      startX,
      startY,
      width: bounds.width,
      height: bounds.height,
      appendSelection: event.shiftKey || event.ctrlKey || event.metaKey
    })
    setSourceDetectedSelectionRect({ left: startX, top: startY, width: 0, height: 0 })
  }

  function handleSourcePagePointerMove(event) {
    if (sourcePageInteractionMode === 'block') {
      if (!sourceBlockDragState) return
      const bounds = event.currentTarget.getBoundingClientRect()
      const currentX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width)
      const currentY = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height)
      const left = Math.min(sourceBlockDragState.startX, currentX)
      const top = Math.min(sourceBlockDragState.startY, currentY)
      const width = Math.abs(currentX - sourceBlockDragState.startX)
      const height = Math.abs(currentY - sourceBlockDragState.startY)
      setSourceBlockSelectionRect({ left, top, width, height })
      return
    }
    if (sourcePageInteractionMode !== 'detected' || !sourceDetectedDragState) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const currentX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width)
    const currentY = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height)
    const left = Math.min(sourceDetectedDragState.startX, currentX)
    const top = Math.min(sourceDetectedDragState.startY, currentY)
    const width = Math.abs(currentX - sourceDetectedDragState.startX)
    const height = Math.abs(currentY - sourceDetectedDragState.startY)
    setSourceDetectedSelectionRect({ left, top, width, height })
  }

  function finalizeSourceBlockSelection() {
    if (sourcePageInteractionMode === 'detected') {
      if (
        !sourceDetectedDragState ||
        !sourceDetectedSelectionRect ||
        sourceDetectedSelectionRect.width < 12 ||
        sourceDetectedSelectionRect.height < 12
      ) {
        setSourceDetectedDragState(null)
        setSourceDetectedSelectionRect(null)
        return
      }
      const matchedIds = sourceDetectedStickers
        .filter(detectedSticker => detectedStickerIntersectsSelection(detectedSticker, sourceDetectedSelectionRect, sourceDetectedDragState))
        .map(detectedSticker => detectedSticker.id)
      setSelectedDetectedStickerIds(current =>
        sourceDetectedDragState.appendSelection ? [...new Set([...current, ...matchedIds])] : matchedIds
      )
      setSourceDetectedDragState(null)
      setSourceDetectedSelectionRect(null)
      return
    }
    if (
      sourcePageInteractionMode !== 'block' ||
      !sourceBlockDragState ||
      !sourceBlockSelectionRect ||
      sourceBlockSelectionRect.width < 12 ||
      sourceBlockSelectionRect.height < 12
    ) {
      setSourceBlockDragState(null)
      setSourceBlockSelectionRect(null)
      return
    }
    const xRatio = sourceBlockSelectionRect.left / sourceBlockDragState.width
    const yRatio = sourceBlockSelectionRect.top / sourceBlockDragState.height
    const widthRatio = sourceBlockSelectionRect.width / sourceBlockDragState.width
    const heightRatio = sourceBlockSelectionRect.height / sourceBlockDragState.height
    setSourceBlockDraftRect({
      xRatio,
      yRatio,
      widthRatio,
      heightRatio
    })
    setSourceBlockForm(current => ({
      ...current,
      x: xRatio.toFixed(6),
      y: yRatio.toFixed(6),
      width: widthRatio.toFixed(6),
      height: heightRatio.toFixed(6),
      label: current.label || `Bloco ${current.sort_order || '1'}`
    }))
    setSourceBlockDragState(null)
    setSourceBlockSelectionRect(null)
  }

  function loadSourceBlockForEdit(block) {
    setSourcePageInteractionMode('block')
    setSourceDetectedSelectionRect(null)
    setSourceDetectedDragState(null)
    setEditingSourceBlockId(block.id)
    setSourceBlockForm({
      collection_id: String(block.collection_id || ''),
      label: block.label || '',
      x: String(block.x),
      y: String(block.y),
      width: String(block.width),
      height: String(block.height),
      sort_order: String(block.sort_order || 0)
    })
    setSourceBlockDraftRect({
      xRatio: block.x,
      yRatio: block.y,
      widthRatio: block.width,
      heightRatio: block.height
    })
  }

  async function handleSourceBlockSubmit(event) {
    event.preventDefault()
    if (!selectedSourceDocumentPageId || !sourceBlockForm.collection_id) return
    setSavingSourceBlock(true)
    setError('')
    setMessage('')
    const payload = {
      collection_id: Number(sourceBlockForm.collection_id),
      label: sourceBlockForm.label || null,
      x: Number(sourceBlockForm.x),
      y: Number(sourceBlockForm.y),
      width: Number(sourceBlockForm.width),
      height: Number(sourceBlockForm.height),
      sort_order: Number(sourceBlockForm.sort_order || 0)
    }
    try {
      await apiFetch(
        editingSourceBlockId
          ? `/admin/page-selection-blocks/${editingSourceBlockId}`
          : `/admin/source-document-pages/${selectedSourceDocumentPageId}/blocks`,
        {
          method: editingSourceBlockId ? 'PUT' : 'POST',
          headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        }
      )
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId)
      ])
      setMessage(editingSourceBlockId ? 'Bloco atualizado.' : 'Bloco criado.')
      resetSourceBlockForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingSourceBlock(false)
    }
  }

  async function handleDeleteSourceBlock() {
    if (!token || !editingSourceBlockId || !selectedSourceBlock) return
    const confirmed = window.confirm(`Excluir o bloco "${selectedSourceBlock.label || selectedSourceBlock.collection_name || 'sem nome'}"?`)
    if (!confirmed) return
    setSavingSourceBlock(true)
    setError('')
    setMessage('')
    try {
      await apiFetch(`/admin/page-selection-blocks/${editingSourceBlockId}`, {
        method: 'DELETE',
        headers: buildAdminHeaders(token)
      })
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId)
      ])
      setMessage('Bloco excluido.')
      resetSourceBlockForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingSourceBlock(false)
    }
  }

  async function handleDuplicateSourceBlock() {
    if (!token || !editingSourceBlockId || !selectedSourceBlock) return
    setDuplicatingSourceBlock(true)
    setError('')
    setMessage('')
    try {
      const duplicated = await apiFetch(`/admin/page-selection-blocks/${editingSourceBlockId}/duplicate`, {
        method: 'POST',
        headers: buildAdminHeaders(token)
      })
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId)
      ])
      setEditingSourceBlockId(duplicated.id)
      setSourceBlockForm({
        collection_id: String(duplicated.collection_id || ''),
        label: duplicated.label || '',
        x: String(duplicated.x),
        y: String(duplicated.y),
        width: String(duplicated.width),
        height: String(duplicated.height),
        sort_order: String(duplicated.sort_order || 0)
      })
      setSourceBlockDraftRect({
        xRatio: duplicated.x,
        yRatio: duplicated.y,
        widthRatio: duplicated.width,
        heightRatio: duplicated.height
      })
      setSourceBlockStickers([])
      setMessage('Bloco duplicado. Ajuste a copia como preferir.')
    } catch (err) {
      setError(err.message)
    } finally {
      setDuplicatingSourceBlock(false)
    }
  }

  async function handleDuplicateSourceBlocksFromPreviousPage() {
    if (!token || !selectedSourceDocumentPage) return
    if (!selectedSourceDocumentPreviousPage) {
      setError('Essa pagina ainda nao tem uma pagina anterior com blocos para duplicar.')
      return
    }

    const hasExistingBlocks = (selectedSourceDocumentPage.blocks || []).length > 0
    if (hasExistingBlocks) {
      const confirmed = window.confirm(
        `Duplicar os blocos da pagina ${selectedSourceDocumentPreviousPage.page_number}? Os blocos atuais da pagina ${selectedSourceDocumentPage.page_number} serao substituidos.`
      )
      if (!confirmed) return
    }

    setDuplicatingSourceBlocks(true)
    setError('')
    setMessage('')
    try {
      await apiFetch(
        `/admin/source-document-pages/${selectedSourceDocumentPage.id}/duplicate-previous-blocks?replace_existing=true`,
        {
          method: 'POST',
          headers: buildAdminHeaders(token)
        }
      )
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId)
      ])
      resetSourceBlockForm()
      setMessage(
        `Blocos da pagina ${selectedSourceDocumentPreviousPage.page_number} duplicados para a pagina ${selectedSourceDocumentPage.page_number}.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setDuplicatingSourceBlocks(false)
    }
  }

  async function handleDetectSourceDocumentStickers() {
    if (!token || !selectedSourceDocumentId || !selectedSourceDocument) return
    const assignedCount = Number(selectedSourceDocument.assigned_detected_count || 0)
    const pendingCount = Number(selectedSourceDocument.pending_detected_count || 0)
    const totalDetectedCount = assignedCount + pendingCount
    const warningLines = totalDetectedCount > 0
      ? [
          `Esse documento ja tem ${totalDetectedCount} figurinha(s) detectada(s).`,
          assignedCount > 0
            ? `${assignedCount} atribuida(s) sera(o) desfeita(s) e voltara(o) para pendente.`
            : null,
          pendingCount > 0
            ? `${pendingCount} pendente(s) atual(is) sera(o) substituida(s).`
            : null,
          'A leitura sera refeita do zero em todas as paginas.',
          '',
          'Deseja continuar?'
        ].filter(Boolean)
      : [
          'A leitura automatica sera feita em todas as paginas deste documento.',
          'Deseja continuar?'
        ]
    const confirmed = window.confirm(warningLines.join('\n'))
    if (!confirmed) return
    setProcessingSourceDocumentDetection(true)
    setError('')
    setMessage('')
    try {
      const data = await apiFetch(`/admin/source-documents/${selectedSourceDocumentId}/detect-stickers?replace_existing=true`, {
        method: 'POST',
        headers: buildAdminHeaders(token)
      })
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId),
        selectedSourceDocumentPageId ? fetchSourceDetectedStickers(selectedSourceDocumentPageId) : Promise.resolve()
      ])
      const pageSummary = data.page_results.map(result => `P${result.page_number}: ${result.detected_count}`).join(' | ')
      setMessage(
        data.detected_count > 0
          ? `Documento analisado. ${data.detected_count} figurinha(s) detectada(s). ${pageSummary}`
          : 'Nao encontrei uma grade automatica compativel neste documento ainda.'
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setProcessingSourceDocumentDetection(false)
    }
  }

  const selectedSourceDocumentHasDetectedStickers = Boolean(
    selectedSourceDocument &&
      (Number(selectedSourceDocument.pending_detected_count || 0) > 0 ||
        Number(selectedSourceDocument.assigned_detected_count || 0) > 0)
  )

  function handleToggleSourceDetectedSticker(detectedSticker) {
    if (!detectedSticker || detectedSticker.status === 'DESCARTADA') return
    setSelectedDetectedStickerIds(current =>
      current.includes(detectedSticker.id)
        ? current.filter(id => id !== detectedSticker.id)
        : [...current, detectedSticker.id]
    )
  }

  function handleToggleAllPendingDetectedStickers() {
    if (!pendingSourceDetectedStickers.length) return
    const pendingIds = pendingSourceDetectedStickers.map(detected => detected.id)
    const allSelected = pendingIds.every(id => selectedDetectedStickerIds.includes(id))
    setSelectedDetectedStickerIds(current =>
      allSelected
        ? current.filter(id => !pendingIds.includes(id))
        : [...new Set([...current, ...pendingIds])]
    )
  }

  async function handleAssignSourceDetectedStickers() {
    if (!token || !selectedSourceDocumentId || !selectedPendingSourceDetectedStickers.length || !sourceDetectedCollectionId) return
    setAssigningDetectedStickers(true)
    setError('')
    setMessage('')
    try {
      const data = await apiFetch(`/admin/source-documents/${selectedSourceDocumentId}/assign-detected-stickers`, {
        method: 'POST',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          collection_id: Number(sourceDetectedCollectionId),
          detected_sticker_ids: selectedPendingSourceDetectedStickers.map(detected => detected.id)
        })
      })
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId),
        selectedSourceDocumentPageId ? fetchSourceDetectedStickers(selectedSourceDocumentPageId) : Promise.resolve(),
        Number(sourceDetectedCollectionId) === selectedCollectionId
          ? fetchCollectionWorkspace(selectedCollectionId, currentPageId)
          : fetchCollections(selectedCollectionId)
      ])
      setSelectedDetectedStickerIds([])
      setMessage(
        data.affected_count > 0
          ? `${data.affected_count} figurinha(s) enviada(s) para ${data.collection_name}.`
          : 'Nenhuma figurinha pendente foi enviada nesta etapa.'
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setAssigningDetectedStickers(false)
    }
  }

  async function handleDiscardSourceDetectedStickers() {
    if (!token || !selectedSourceDocumentId || !selectedPendingSourceDetectedStickers.length) return
    const confirmed = window.confirm('Descartar as figurinhas detectadas selecionadas?')
    if (!confirmed) return
    setDiscardingDetectedStickers(true)
    setError('')
    setMessage('')
    try {
      const data = await apiFetch(`/admin/source-documents/${selectedSourceDocumentId}/discard-detected-stickers`, {
        method: 'POST',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          detected_sticker_ids: selectedPendingSourceDetectedStickers.map(detected => detected.id)
        })
      })
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId),
        selectedSourceDocumentPageId ? fetchSourceDetectedStickers(selectedSourceDocumentPageId) : Promise.resolve()
      ])
      setSelectedDetectedStickerIds([])
      setMessage(
        data.affected_count > 0
          ? `${data.affected_count} figurinha(s) descartada(s) da revisao.`
          : 'Nenhuma figurinha pendente foi descartada.'
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setDiscardingDetectedStickers(false)
    }
  }

  async function handleUnassignSourceDetectedStickers() {
    if (!token || !selectedSourceDocumentId || !selectedAssignedSourceDetectedStickers.length) return
    const confirmed = window.confirm('Voltar as figurinhas atribuidas selecionadas para pendente?')
    if (!confirmed) return
    setUnassigningDetectedStickers(true)
    setError('')
    setMessage('')
    try {
      const data = await apiFetch(`/admin/source-documents/${selectedSourceDocumentId}/unassign-detected-stickers`, {
        method: 'POST',
        headers: buildAdminHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          detected_sticker_ids: selectedAssignedSourceDetectedStickers.map(detected => detected.id)
        })
      })
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId),
        selectedSourceDocumentPageId ? fetchSourceDetectedStickers(selectedSourceDocumentPageId) : Promise.resolve(),
        selectedCollectionId ? fetchCollectionWorkspace(selectedCollectionId, currentPageId) : fetchCollections(selectedCollectionId)
      ])
      setSelectedDetectedStickerIds([])
      setMessage(
        data.affected_count > 0
          ? `${data.affected_count} figurinha(s) voltou(aram) para pendente.`
          : 'Nenhuma figurinha atribuida foi alterada.'
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setUnassigningDetectedStickers(false)
    }
  }

  async function handleDetectSourceBlockStickers() {
    if (!token || !editingSourceBlockId || !selectedSourceBlock) return
    setProcessingSourceBlockDetection(true)
    setError('')
    setMessage('')
    try {
      const data = await apiFetch(`/admin/page-selection-blocks/${editingSourceBlockId}/detect-stickers?replace_existing=true`, {
        method: 'POST',
        headers: buildAdminHeaders(token)
      })
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId),
        fetchSourceBlockStickers(editingSourceBlockId),
        selectedCollectionId === selectedSourceBlock.collection_id
          ? fetchCollectionWorkspace(selectedCollectionId, currentPageId)
          : fetchCollections(selectedCollectionId)
      ])
      setMessage(
        data.detected_count > 0
          ? `O bloco gerou ${data.detected_count} figurinha(s) para ${data.collection_name}.`
          : data.reason || 'Esse bloco ainda nao gerou figurinhas detectaveis.'
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setProcessingSourceBlockDetection(false)
    }
  }

  async function handleDeleteSourceBlockSticker(stickerId) {
    if (!token) return
    const confirmed = window.confirm('Excluir essa figurinha detectada do bloco?')
    if (!confirmed) return
    setLoadingSourceBlockStickers(true)
    setError('')
    setMessage('')
    try {
      await apiFetch(`/admin/stickers/${stickerId}`, {
        method: 'DELETE',
        headers: buildAdminHeaders(token)
      })
      await Promise.all([
        fetchSourceDocuments(selectedSourceDocumentId),
        fetchSourceDocumentDetailData(selectedSourceDocumentId),
        fetchSourceBlockStickers(editingSourceBlockId),
        selectedSourceBlock?.collection_id === selectedCollectionId
          ? fetchCollectionWorkspace(selectedCollectionId, currentPageId)
          : fetchCollections(selectedCollectionId)
      ])
      setMessage('Figurinha removida da revisao do bloco.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingSourceBlockStickers(false)
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
          display_group_order: Number(selectedCollectionForm.display_group_order || 1),
          display_item_order: Number(selectedCollectionForm.display_item_order || 999),
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

  async function handleDeleteCollection() {
    if (!selectedCollectionId || !selectedCollection) return
    const confirmed = window.confirm(
      `Excluir "${selectedCollection.name}"? Essa acao remove a colecao, figurinhas, paginas, PDF de origem, exports e pedidos vinculados.`
    )
    if (!confirmed) return

    const typedName = window.prompt(
      `Para confirmar, digite exatamente o nome da colecao:\n\n${selectedCollection.name}`
    )
    if (typedName === null) return
    if (typedName.trim() !== selectedCollection.name.trim()) {
      window.alert('O nome digitado nao confere. A colecao nao foi excluida.')
      return
    }

    setDeletingCollection(true)
    setError('')
    setMessage('')
    try {
      const deletedId = selectedCollectionId
      await apiFetch(`/admin/collections/${deletedId}`, {
        method: 'DELETE',
        headers: buildAdminHeaders(token)
      })
      setSelectedCollectionId(null)
      setSelectedCollection(null)
      setPages([])
      setStickers([])
      setCurrentPageId(null)
      resetStickerForm()
      setMessage('Colecao excluida.')
      await Promise.all([fetchAlbums(selectedAlbumId), fetchCollections(collections.find(collection => collection.id !== deletedId)?.id || null)])
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingCollection(false)
    }
  }

  function handleStartCreateAlbum() {
    const nextOrder = albums.reduce((maxValue, album) => Math.max(maxValue, Number(album.sort_order || 0)), 0) + 1
    setAlbumForm({ name: '', slug: '', description: '', sort_order: String(nextOrder) })
    setAlbumSlugEdited(false)
    setAlbumSlugManualOpen(false)
    setAlbumStructureMode('create')
    setCollectionStructureMode('edit')
    setAdminView('structure')
    setSelectedCollectionId(null)
    setSelectedCollection(null)
    setPages([])
    setStickers([])
    setCurrentPageId(null)
    resetStickerForm()
  }

  function handleStartCreateCollection() {
    const nextOrder =
      filteredCollections.reduce((maxValue, collection) => Math.max(maxValue, Number(collection.sort_order || 0)), 0) + 1
    setCreateForm({
      ...createEmptyCollectionAdminForm(selectedAlbumId || ''),
      sort_order: String(nextOrder)
    })
    setCreateCollectionSlugEdited(false)
    setCreateCollectionSlugManualOpen(false)
    setCollectionStructureMode('create')
    setAlbumStructureMode('edit')
    setAdminView('structure')
    setSelectedCollectionId(null)
    setSelectedCollection(null)
    setPages([])
    setStickers([])
    setCurrentPageId(null)
    resetStickerForm()
  }

  function handleCancelCreation() {
    setAlbumStructureMode('edit')
    setCollectionStructureMode('edit')
    setAlbumSlugManualOpen(false)
    setCreateCollectionSlugManualOpen(false)
    setAdminView('structure')
    setSelectedCollectionId(null)
    setSelectedCollection(null)
    setPages([])
    setStickers([])
    setCurrentPageId(null)
    resetStickerForm()
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
    const normalizedPixKey = String(serviceForm.pix_key || '').trim()
    if (serviceForm.donation_enabled && !normalizedPixKey) {
      setError('Preencha a chave Pix para ativar o apoio opcional apos o PDF gratis.')
      setMessage('')
      return
    }
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
          custom_generation_mode: serviceForm.custom_generation_mode,
          custom_sticker_unlock_enabled: serviceForm.custom_sticker_unlock_enabled,
          custom_sticker_unlock_price_cents: centsFromInput(serviceForm.custom_sticker_unlock_price),
          custom_sticker_unlock_message: serviceForm.custom_sticker_unlock_message,
          custom_ai_unlock_enabled: serviceForm.custom_ai_unlock_enabled,
          custom_ai_unlock_price_cents: centsFromInput(serviceForm.custom_ai_unlock_price),
          custom_ai_unlock_message: serviceForm.custom_ai_unlock_message,
          pack_size: Number(serviceForm.pack_size || 7),
          print_price_cents: centsFromInput(serviceForm.print_price),
          pack_price_cents: centsFromInput(serviceForm.pack_price),
          pix_key: normalizedPixKey,
          pix_holder: serviceForm.pix_holder,
          donation_message: serviceForm.donation_message,
          pickup_note: serviceForm.pickup_note,
          custom_prompt_template: serviceForm.custom_prompt_template
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

  async function handleCustomBaseUpload(profile, file) {
    if (!file) return
    setUploadingBaseProfile(profile)
    setError('')
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await apiFetch(`/admin/service-config/custom-bases/${profile}`, {
        method: 'POST',
        headers: buildAdminHeaders(token),
        body: formData
      })
      setServiceForm(serviceConfigToForm(data))
      setMessage(`Base de ${customProfileLabel(profile).toLowerCase()} atualizada.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingBaseProfile('')
    }
  }

  async function handleCustomBaseDelete(profile) {
    if (!window.confirm(`Remover a base de ${customProfileLabel(profile).toLowerCase()}?`)) return
    setDeletingBaseProfile(profile)
    setError('')
    setMessage('')
    try {
      const data = await apiFetch(`/admin/service-config/custom-bases/${profile}`, {
        method: 'DELETE',
        headers: buildAdminHeaders(token)
      })
      setServiceForm(serviceConfigToForm(data))
      setMessage(`Base de ${customProfileLabel(profile).toLowerCase()} removida.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingBaseProfile('')
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
      await Promise.all([fetchCollections(selectedCollectionId), fetchCollectionWorkspace(selectedCollectionId, null)])
      resetStickerForm()
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
      await Promise.all([
        fetchCollections(selectedCollectionId),
        fetchCollectionWorkspace(selectedCollectionId, scope === 'current' ? currentPageId : currentPageId),
      ])
      resetStickerForm()
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
      await Promise.all([fetchCollections(selectedCollectionId), fetchCollectionWorkspace(selectedCollectionId, currentPageId)])
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
      await Promise.all([fetchCollections(selectedCollectionId), fetchCollectionWorkspace(selectedCollectionId, currentPageId)])
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
      await Promise.all([fetchCollections(selectedCollectionId), fetchCollectionWorkspace(selectedCollectionId, currentPageId)])
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
        <div className="fig-admin-sidebar-actions">
          <button
            type="button"
            className="fig-primary-button fig-admin-sidebar-action"
            disabled={isCreationLocked}
            onClick={() => {
              handleStartCreateAlbum()
              setAdminView('structure')
            }}
          >
            Novo album
          </button>
          <button
            type="button"
            className="fig-secondary-button fig-admin-sidebar-action"
            disabled={!selectedAlbumId || isCreationLocked}
            onClick={() => {
              handleStartCreateCollection()
              setAdminView('structure')
            }}
          >
            Nova selecao
          </button>
          <button
            type="button"
            className="fig-danger-button fig-admin-sidebar-action"
            disabled={!selectedAlbumId || isCreationLocked || deletingAlbum}
            onClick={handleDeleteAlbum}
          >
            {deletingAlbum ? 'Excluindo...' : 'Excluir album'}
          </button>
          {isCreationLocked ? (
            <button type="button" className="fig-secondary-button fig-admin-sidebar-action" onClick={handleCancelCreation}>
              Cancelar criacao
            </button>
          ) : null}
          <p className="fig-admin-sidebar-helper">
            Use os botões acima para criar. A lista abaixo serve só para escolher o que já existe.
          </p>
        </div>
        <div className="fig-collection-list">
          {albums.map(album => (
            <button
              key={album.id}
              type="button"
              className={`fig-collection-button${album.id === selectedAlbumId && !isCreationLocked ? ' is-active' : ''}`}
              disabled={isCreationLocked}
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
          <p className="fig-kicker">Colecoes do album</p>
          <h3>{selectedAlbum?.name || 'Escolha um album'}</h3>
        </div>
        <div className="fig-collection-list">
          {filteredCollections.map(collection => (
            <button
              key={collection.id}
              type="button"
              className={`fig-collection-button${collection.id === selectedCollectionId && !isCreationLocked ? ' is-active' : ''}`}
              disabled={isCreationLocked}
              onClick={() => {
                setSelectedCollectionId(collection.id)
                setCurrentPageId(null)
                resetStickerForm()
                setAdminView('collection')
              }}
            >
              <strong>{collection.name}</strong>
              <span>
                {collectionTypeLabel(collection.collection_type)} · Ordem {collection.sort_order} · {collection.status === 'PUBLICADA' ? 'Publicada' : 'Rascunho'} ·{' '}
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
            <h2>{adminTitle}</h2>
            <p>{adminDescription}</p>
            {isCreationLocked ? (
              <span className="fig-admin-mode-badge">
                Modo criacao {isCreatingAlbum ? 'de album' : 'de selecao'}
              </span>
            ) : null}
          </div>
          <div className="fig-hero-actions">
            <button type="button" className="fig-secondary-button" onClick={handleLogout}>
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
            disabled={isCreationLocked}
          >
            Atendimento
          </button>
          <button
            type="button"
            className={`fig-admin-section-tab${adminView === 'collection' ? ' is-active' : ''}`}
            onClick={() => selectedCollection && setAdminView('collection')}
            disabled={!selectedCollection || isCreationLocked}
          >
            Selecao
          </button>
          <button
            type="button"
            className={`fig-admin-section-tab${adminView === 'mapping' ? ' is-active' : ''}`}
            onClick={() => selectedCollection && setAdminView('mapping')}
            disabled={!selectedCollection || isCreationLocked}
          >
            Mapeamento
          </button>
        </div>

        {message ? <p className="fig-success-banner">{message}</p> : null}
        {error ? <p className="fig-error-banner">{error}</p> : null}
        {loading ? <p className="fig-empty-note">Carregando dados da selecao...</p> : null}

        {adminView === 'structure' ? (
          <>
          <section className={`fig-admin-panel-grid${isCreationLocked ? ' fig-admin-panel-grid--single' : ''}`}>
            {!isCreatingCollection ? (
              <form
                className={`fig-form-card${isCreatingAlbum ? ' fig-form-card--focused' : ''}`}
                onSubmit={isCreatingAlbum ? handleCreateAlbum : handleUpdateAlbum}
              >
                <div className="fig-panel-header">
                  <p className="fig-kicker">{isCreatingAlbum ? 'Novo album' : 'Album'}</p>
                  <h3>{isCreatingAlbum ? 'Crie uma nova edicao principal' : 'Editar album selecionado'}</h3>
                </div>
                <p className="fig-empty-note">
                  {isCreatingAlbum
                    ? 'Esse cadastro fica separado das selecoes existentes para evitar confusao com o que ja estava aberto.'
                    : 'Use a lateral para escolher o album e ajustar nome, slug e ordem.'}
                </p>
                <div className="fig-form-grid">
                  <label className="fig-field">
                    <span>Nome</span>
                    <input
                      value={isCreatingAlbum ? albumForm.name : selectedAlbumForm.name}
                      onChange={event =>
                        isCreatingAlbum
                          ? handleAlbumNameChange(event.target.value)
                          : handleSelectedAlbumNameChange(event.target.value)
                      }
                      placeholder="Copa 2026"
                    />
                  </label>
                  <label className="fig-field">
                    <span>Slug</span>
                    {isCreatingAlbum ? (
                      albumSlugManualOpen ? (
                        <>
                          <input
                            value={albumForm.slug}
                            onChange={event => handleAlbumSlugChange(event.target.value)}
                            placeholder="Gerado automaticamente"
                          />
                          <div className="fig-field-inline-actions">
                            <p className="fig-helper-text">Voce esta ajustando o slug manualmente.</p>
                            <button type="button" className="fig-inline-link" onClick={handleAlbumSlugAutoMode}>
                              Voltar ao automatico
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="fig-field-collapsed">
                          <p className="fig-helper-text">URL: {albumForm.slug || 'sera gerado pelo nome'}</p>
                          <button type="button" className="fig-inline-link" onClick={() => setAlbumSlugManualOpen(true)}>
                            Ajustar slug manualmente
                          </button>
                        </div>
                      )
                    ) : selectedAlbumSlugManualOpen ? (
                      <>
                        <input
                          value={selectedAlbumForm.slug}
                          onChange={event => handleSelectedAlbumSlugChange(event.target.value)}
                          placeholder="Gerado automaticamente"
                        />
                        <div className="fig-field-inline-actions">
                          <p className="fig-helper-text">Voce esta ajustando o slug manualmente.</p>
                          <button type="button" className="fig-inline-link" onClick={handleSelectedAlbumSlugAutoMode}>
                            Voltar ao automatico
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="fig-field-collapsed">
                        <p className="fig-helper-text">URL: {selectedAlbumForm.slug || 'sera gerado pelo nome'}</p>
                        <button type="button" className="fig-inline-link" onClick={() => setSelectedAlbumSlugManualOpen(true)}>
                          Ajustar slug manualmente
                        </button>
                      </div>
                    )}
                  </label>
                  <label className="fig-field">
                    <span>Ordem na barra lateral</span>
                    <input
                      type="number"
                      min="0"
                      value={isCreatingAlbum ? albumForm.sort_order : selectedAlbumForm.sort_order}
                      onChange={event =>
                        isCreatingAlbum
                          ? setAlbumForm(current => ({ ...current, sort_order: event.target.value }))
                          : setSelectedAlbumForm(current => ({ ...current, sort_order: event.target.value }))
                      }
                      placeholder="0"
                    />
                  </label>
                  <label className="fig-field fig-field--full">
                    <span>Descricao</span>
                    <textarea
                      value={isCreatingAlbum ? albumForm.description : selectedAlbumForm.description}
                      onChange={event =>
                        isCreatingAlbum
                          ? setAlbumForm(current => ({ ...current, description: event.target.value }))
                          : setSelectedAlbumForm(current => ({ ...current, description: event.target.value }))
                      }
                      rows="3"
                      placeholder="Edicao principal para agrupar as selecoes."
                    />
                  </label>
                </div>
                <div className="fig-hero-actions">
                  {isCreatingAlbum ? (
                    <button type="button" className="fig-secondary-button" onClick={handleCancelCreation}>
                      Cancelar criacao
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="fig-primary-button"
                    disabled={isCreatingAlbum ? savingAlbum : savingAlbumEdit || !selectedAlbum}
                  >
                    {isCreatingAlbum
                      ? savingAlbum
                        ? 'Salvando...'
                        : 'Criar album'
                      : savingAlbumEdit
                        ? 'Salvando...'
                        : 'Salvar album'}
                  </button>
                </div>
              </form>
            ) : null}

            {!isCreatingAlbum ? (
              <form
                className={`fig-form-card${isCreatingCollection ? ' fig-form-card--focused' : ''}`}
                onSubmit={isCreatingCollection ? handleCreateCollection : handleUpdateCollection}
              >
                <div className="fig-panel-header">
                  <p className="fig-kicker">{isCreatingCollection ? 'Nova colecao' : 'Colecao'}</p>
                  <h3>{isCreatingCollection ? 'Cadastre uma colecao nova' : 'Editar colecao selecionada'}</h3>
                </div>
                <p className="fig-empty-note">
                  {isCreatingCollection
                    ? 'A colecao nasce dentro do album escolhido abaixo e so depois segue para PDF, mapeamento e publicacao.'
                    : 'Aqui voce pode corrigir nome, slug, tipo e ordem da colecao.'}
                </p>
                <div className="fig-form-grid">
                  <label className="fig-field">
                    <span>Album</span>
                    <select
                      value={isCreatingCollection ? createForm.album_id : collectionAlbumTargetId}
                      onChange={event =>
                        isCreatingCollection
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
                      value={isCreatingCollection ? createForm.name : selectedCollectionForm.name}
                      onChange={event =>
                        isCreatingCollection
                          ? handleCreateCollectionNameChange(event.target.value)
                          : handleSelectedCollectionNameChange(event.target.value)
                      }
                      placeholder="Brasil"
                    />
                  </label>
                  <label className="fig-field">
                    <span>Tipo</span>
                    <select
                      value={isCreatingCollection ? createForm.collection_type : selectedCollectionForm.collection_type}
                      onChange={event => {
                        const nextType = event.target.value
                        const nextGroupOrder = defaultCollectionGroupOrder(nextType)
                        if (isCreatingCollection) {
                          setCreateForm(current => ({ ...current, collection_type: nextType, display_group_order: nextGroupOrder }))
                        } else {
                          setSelectedCollectionForm(current => ({ ...current, collection_type: nextType, display_group_order: nextGroupOrder }))
                        }
                      }}
                    >
                      {collectionTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fig-field">
                    <span>Slug</span>
                    {isCreatingCollection ? (
                      createCollectionSlugManualOpen ? (
                        <>
                          <input
                            value={createForm.slug}
                            onChange={event => handleCreateCollectionSlugChange(event.target.value)}
                            placeholder="Gerado automaticamente"
                          />
                          <div className="fig-field-inline-actions">
                            <p className="fig-helper-text">Voce esta ajustando o slug manualmente.</p>
                            <button type="button" className="fig-inline-link" onClick={handleCreateCollectionSlugAutoMode}>
                              Voltar ao automatico
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="fig-field-collapsed">
                          <p className="fig-helper-text">URL: {createForm.slug || 'sera gerado pelo nome'}</p>
                          <button type="button" className="fig-inline-link" onClick={() => setCreateCollectionSlugManualOpen(true)}>
                            Ajustar slug manualmente
                          </button>
                        </div>
                      )
                    ) : selectedCollectionSlugManualOpen ? (
                      <>
                        <input
                          value={selectedCollectionForm.slug}
                          onChange={event => handleSelectedCollectionSlugChange(event.target.value)}
                          placeholder="Gerado automaticamente"
                        />
                        <div className="fig-field-inline-actions">
                          <p className="fig-helper-text">Voce esta ajustando o slug manualmente.</p>
                          <button type="button" className="fig-inline-link" onClick={handleSelectedCollectionSlugAutoMode}>
                            Voltar ao automatico
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="fig-field-collapsed">
                        <p className="fig-helper-text">URL: {selectedCollectionForm.slug || 'sera gerado pelo nome'}</p>
                        <button
                          type="button"
                          className="fig-inline-link"
                          onClick={() => setSelectedCollectionSlugManualOpen(true)}
                        >
                          Ajustar slug manualmente
                        </button>
                      </div>
                    )}
                  </label>
                  <label className="fig-field">
                    <span>Ordem na barra lateral</span>
                    <input
                      type="number"
                      min="0"
                      value={isCreatingCollection ? createForm.sort_order : selectedCollectionForm.sort_order}
                      onChange={event =>
                        isCreatingCollection
                          ? setCreateForm(current => ({ ...current, sort_order: event.target.value }))
                          : setSelectedCollectionForm(current => ({ ...current, sort_order: event.target.value }))
                      }
                      placeholder="0"
                    />
                  </label>
                  <label className="fig-field">
                    <span>Grupo</span>
                    <input
                      type="number"
                      min="0"
                      value={isCreatingCollection ? createForm.display_group_order : selectedCollectionForm.display_group_order}
                      onChange={event =>
                        isCreatingCollection
                          ? setCreateForm(current => ({ ...current, display_group_order: event.target.value }))
                          : setSelectedCollectionForm(current => ({ ...current, display_group_order: event.target.value }))
                      }
                      placeholder="1"
                    />
                  </label>
                  <label className="fig-field">
                    <span>Ordem no grupo</span>
                    <input
                      type="number"
                      min="0"
                      value={isCreatingCollection ? createForm.display_item_order : selectedCollectionForm.display_item_order}
                      onChange={event =>
                        isCreatingCollection
                          ? setCreateForm(current => ({ ...current, display_item_order: event.target.value }))
                          : setSelectedCollectionForm(current => ({ ...current, display_item_order: event.target.value }))
                      }
                      placeholder="999"
                    />
                  </label>
                  <label className="fig-field fig-field--full">
                    <span>Descricao</span>
                    <textarea
                      value={isCreatingCollection ? createForm.description : selectedCollectionForm.description}
                      onChange={event =>
                        isCreatingCollection
                          ? setCreateForm(current => ({ ...current, description: event.target.value }))
                          : setSelectedCollectionForm(current => ({ ...current, description: event.target.value }))
                      }
                      rows="3"
                      placeholder="Selecao publicada dentro do album."
                    />
                  </label>
                </div>
                <div className="fig-hero-actions">
                  {!isCreatingCollection ? (
                    <button
                      type="button"
                      className="fig-secondary-button"
                      disabled={!collectionAlbumTargetId || Number(collectionAlbumTargetId) === selectedCollection?.album_id}
                      onClick={handleAssignCollectionAlbum}
                    >
                      Mover para outro album
                    </button>
                  ) : (
                    <button type="button" className="fig-secondary-button" onClick={handleCancelCreation}>
                      Cancelar criacao
                    </button>
                  )}
                  {!isCreatingCollection ? (
                    <button
                      type="button"
                      className="fig-secondary-button"
                      disabled={deletingCollection || !selectedCollection}
                      onClick={handleDeleteCollection}
                    >
                      {deletingCollection ? 'Excluindo...' : 'Excluir colecao'}
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="fig-primary-button"
                    disabled={
                      isCreatingCollection
                        ? savingCollection || !createForm.album_id
                        : savingCollectionEdit || deletingCollection || !selectedCollection
                    }
                  >
                    {isCreatingCollection
                      ? savingCollection
                        ? 'Salvando...'
                        : 'Criar colecao'
                      : savingCollectionEdit
                        ? 'Salvando...'
                        : 'Salvar colecao'}
                  </button>
                </div>
                {!isCreatingCollection && !selectedCollection ? (
                  <p className="fig-empty-note">Escolha uma selecao na lateral para editar nome, slug e ordem.</p>
                ) : null}
              </form>
            ) : null}

            <div className="fig-form-card fig-form-card--supporting">
              <div className="fig-panel-header">
                <p className="fig-kicker">Como usar</p>
                <h3>{isCreatingAlbum || isCreatingCollection ? 'Fluxo de criacao' : 'Fluxo mais simples'}</h3>
              </div>
              {isCreatingAlbum ? (
                <>
                  <div className="fig-helper-strip fig-helper-strip--compact">
                    <div>
                      <strong>1.</strong>
                      <span>Defina nome, slug e a ordem em que esse album deve aparecer.</span>
                    </div>
                  </div>
                  <div className="fig-helper-strip fig-helper-strip--compact">
                    <div>
                      <strong>2.</strong>
                      <span>Salve primeiro o album. Depois voce cadastra as selecoes dentro dele.</span>
                    </div>
                  </div>
                  <div className="fig-helper-strip fig-helper-strip--compact">
                    <div>
                      <strong>3.</strong>
                      <span>Quando quiser voltar a editar o que ja existe, use Cancelar criacao.</span>
                    </div>
                  </div>
                </>
              ) : isCreatingCollection ? (
                <>
                  <div className="fig-helper-strip fig-helper-strip--compact">
                    <div>
                      <strong>1.</strong>
                      <span>Escolha o album pai da nova selecao.</span>
                    </div>
                  </div>
                  <div className="fig-helper-strip fig-helper-strip--compact">
                    <div>
                      <strong>2.</strong>
                      <span>Preencha nome, slug e a ordem em que ela deve aparecer na barra lateral publica.</span>
                    </div>
                  </div>
                  <div className="fig-helper-strip fig-helper-strip--compact">
                    <div>
                      <strong>3.</strong>
                      <span>Depois de salvar, a selecao fica pronta para receber PDF e mapeamento.</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                      <span>Use Novo album ou Nova selecao quando quiser cadastrar mais itens.</span>
                    </div>
                  </div>
                  <div className="fig-helper-strip fig-helper-strip--compact">
                    <div>
                      <strong>4.</strong>
                      <span>Quanto menor a ordem, mais acima ele aparece na barra lateral publica.</span>
                    </div>
                  </div>
                  <p className="fig-empty-note">Exemplo: Brasil = 1, Alemanha = 2, Argentina = 3.</p>
                </>
              )}
            </div>
          </section>

          <section className="fig-form-card fig-form-card--supporting fig-source-document-shell">
            <div className="fig-panel-header">
              <p className="fig-kicker">Documentos fonte</p>
              <h3>PDFs multipagina para alimentar varias selecoes</h3>
            </div>
            <p className="fig-empty-note">
              Suba um PDF com varias paginas, detecte todas as figurinhas dele e depois so distribua as detectadas para
              as selecoes certas. O bloco manual continua disponivel para apoio.
            </p>

            <div className="fig-source-document-grid">
              <form className="fig-source-document-form" onSubmit={handleCreateSourceDocument}>
                <div className="fig-form-grid fig-source-document-form-grid">
                  <label className="fig-field">
                    <span>Album</span>
                    <select
                      value={sourceDocumentForm.album_id}
                      onChange={event =>
                        setSourceDocumentForm(current => ({
                          ...current,
                          album_id: event.target.value
                        }))
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
                    <span>Titulo do documento</span>
                    <input
                      value={sourceDocumentForm.title}
                      onChange={event =>
                        setSourceDocumentForm(current => ({
                          ...current,
                          title: event.target.value
                        }))
                      }
                      placeholder="Lote 03 · paginas mistas"
                    />
                  </label>

                  <label className="fig-field fig-source-document-upload">
                    <span>PDF multipagina</span>
                    <input
                      key={sourceDocumentUploadResetKey}
                      className="fig-plain-file-input"
                      type="file"
                      accept="application/pdf"
                      onChange={event => {
                        const file = event.target.files?.[0] || null
                        setSourceDocumentForm(current => ({
                          ...current,
                          file,
                          title: current.title || sourceDocumentTitleFromFile(file?.name)
                        }))
                      }}
                    />
                    <small className="fig-helper-text">
                      Use esse fluxo quando um unico PDF tiver varias selecoes espalhadas em paginas diferentes.
                    </small>
                  </label>
                </div>

                <div className="fig-hero-actions fig-source-document-actions">
                  <button
                    type="submit"
                    className="fig-primary-button"
                    disabled={savingSourceDocument || !sourceDocumentForm.album_id || !sourceDocumentForm.title.trim() || !sourceDocumentForm.file}
                  >
                    {savingSourceDocument ? 'Enviando documento...' : 'Enviar documento fonte'}
                  </button>
                </div>
              </form>

              <div className="fig-order-layout fig-order-layout--editor fig-source-document-picker">
                <div className="fig-order-list fig-source-document-list">
                  {loadingSourceDocuments ? (
                    <p className="fig-empty-note">Carregando documentos do album...</p>
                  ) : sourceDocuments.length ? (
                    sourceDocuments.map(document => (
                      <button
                        key={document.id}
                        type="button"
                        className={`fig-order-list-item fig-source-document-list-item${document.id === selectedSourceDocumentId ? ' is-active' : ''}`}
                        onClick={() => setSelectedSourceDocumentId(document.id)}
                      >
                        <strong>{document.title}</strong>
                        <span>{document.page_count} pagina(s) · {document.pending_detected_count || 0} pendente(s)</span>
                        <small>{sourceDocumentStatusLabel(document.status)}</small>
                      </button>
                    ))
                  ) : (
                    <p className="fig-empty-note">
                      {selectedAlbum
                        ? `Ainda nao existe documento fonte em ${selectedAlbum.name}.`
                        : 'Escolha um album para comecar.'}
                    </p>
                  )}
                </div>

                <div className="fig-order-detail fig-source-document-detail">
                  {selectedSourceDocument ? (
                    <>
                      <div className="fig-source-document-toolbar">
                        <div>
                          <strong>{selectedSourceDocument.title}</strong>
                          <span>
                            {selectedSourceDocument.album_name || selectedAlbum?.name || 'Album'} ·{' '}
                            {sourceDocumentStatusLabel(selectedSourceDocument.status)}
                          </span>
                        </div>
                        <div className="fig-hero-actions fig-hero-actions--compact">
                          <button
                            type="button"
                            className="fig-secondary-button"
                            disabled={processingSourceDocumentDetection}
                            onClick={handleDetectSourceDocumentStickers}
                          >
                            {processingSourceDocumentDetection
                              ? 'Detectando...'
                              : selectedSourceDocumentHasDetectedStickers
                                ? 'Redetectar tudo'
                                : 'Detectar todas as figurinhas'}
                          </button>
                          <button
                            type="button"
                            className="fig-inline-link"
                            disabled={deletingSourceDocument}
                            onClick={handleDeleteSourceDocument}
                          >
                            {deletingSourceDocument ? 'Excluindo...' : 'Excluir documento'}
                          </button>
                        </div>
                      </div>

                      <div className="fig-source-document-meta">
                        <div>
                          <span>Paginas</span>
                          <strong>{selectedSourceDocument.page_count}</strong>
                        </div>
                        <div>
                          <span>Blocos</span>
                          <strong>{selectedSourceDocument.block_count}</strong>
                        </div>
                        <div>
                          <span>Pendentes</span>
                          <strong>{selectedSourceDocument.pending_detected_count || 0}</strong>
                        </div>
                        <div>
                          <span>Atribuidas</span>
                          <strong>{selectedSourceDocument.assigned_detected_count || 0}</strong>
                        </div>
                        <div>
                          <span>Criado em</span>
                          <strong>{formatDateTime(selectedSourceDocument.created_at)}</strong>
                        </div>
                      </div>

                      <details className="fig-source-document-advanced">
                        <summary>
                          <div className="fig-source-document-advanced-summary">
                            <strong>Layouts mestres</strong>
                            <span>Salve um desenho pronto da pagina e reaplique em outras parecidas.</span>
                          </div>
                        </summary>
                        <div className="fig-source-document-advanced-body">
                          <div className="fig-order-layout fig-order-layout--editor">
                            <form className="fig-form-card fig-form-card--supporting" onSubmit={handleCreatePageLayoutTemplate}>
                              <div className="fig-panel-header">
                                <p className="fig-kicker">Salvar layout</p>
                                <h3>Guardar blocos da pagina atual</h3>
                              </div>
                              <div className="fig-form-grid">
                                <label className="fig-field">
                                  <span>Nome do layout</span>
                                  <input
                                    value={pageLayoutForm.name}
                                    onChange={event => setPageLayoutForm({ name: event.target.value })}
                                    placeholder="Layout 3 blocos verticais"
                                  />
                                </label>
                              </div>
                              <div className="fig-hero-actions">
                                <button
                                  type="submit"
                                  className="fig-primary-button"
                                  disabled={savingPageLayoutTemplate || !selectedSourceDocumentPage || !(selectedSourceDocumentPage.blocks || []).length}
                                >
                                  {savingPageLayoutTemplate ? 'Salvando layout...' : 'Salvar pagina atual como layout'}
                                </button>
                              </div>
                            </form>

                            <div className="fig-order-layout fig-order-layout--editor">
                              <div className="fig-order-list">
                                {pageLayoutTemplates.length ? (
                                  pageLayoutTemplates.map(template => (
                                    <button
                                      key={template.id}
                                      type="button"
                                      className={`fig-order-list-item${template.id === selectedPageLayoutTemplateId ? ' is-active' : ''}`}
                                      onClick={() => setSelectedPageLayoutTemplateId(template.id)}
                                    >
                                      <strong>{template.name}</strong>
                                      <span>{template.block_count} bloco(s)</span>
                                      <small>{formatDateTime(template.created_at)}</small>
                                    </button>
                                  ))
                                ) : (
                                  <p className="fig-empty-note">Nenhum layout mestre salvo neste album ainda.</p>
                                )}
                              </div>

                              <div className="fig-order-detail">
                                {selectedPageLayoutTemplate ? (
                                  <>
                                    <div className="fig-panel-header fig-panel-header--compact">
                                      <p className="fig-kicker">Layout selecionado</p>
                                      <h3>{selectedPageLayoutTemplate.name}</h3>
                                    </div>
                                    <div className="fig-selected-stickers">
                                      {selectedPageLayoutTemplate.blocks.map(block => (
                                        <span key={block.id} className="fig-selection-chip">
                                          {(block.label || block.collection_name || `Bloco ${block.sort_order}`)} · {Math.round(block.width * 100)}%
                                        </span>
                                      ))}
                                    </div>
                                    <div className="fig-hero-actions">
                                      <button
                                        type="button"
                                        className="fig-secondary-button"
                                        disabled={!selectedSourceDocumentPage || applyingPageLayoutTemplate}
                                        onClick={handleApplyPageLayoutTemplate}
                                      >
                                        {applyingPageLayoutTemplate ? 'Aplicando...' : 'Aplicar na pagina atual'}
                                      </button>
                                      <button
                                        type="button"
                                        className="fig-inline-link fig-inline-link--danger"
                                        disabled={deletingPageLayoutTemplate}
                                        onClick={handleDeletePageLayoutTemplate}
                                      >
                                        {deletingPageLayoutTemplate ? 'Excluindo...' : 'Excluir layout'}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <p className="fig-empty-note">Escolha um layout mestre salvo para aplicar na pagina atual.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </details>

                      <section className="fig-source-pages-strip">
                        <div className="fig-panel-header fig-panel-header--compact">
                          <p className="fig-kicker">Paginas do documento</p>
                          <h3>Escolha uma pagina para revisar</h3>
                        </div>
                        <div className="fig-source-pages-grid">
                          {(selectedSourceDocument.pages || []).map(page => (
                            <button
                              key={page.id}
                              type="button"
                              className={`fig-source-page-card${page.id === selectedSourceDocumentPageId ? ' is-active' : ''}`}
                              onClick={() => {
                                setSelectedSourceDocumentPageId(page.id)
                                setSourcePageInteractionMode('detected')
                                setSourceDetectedSelectionRect(null)
                                setSourceDetectedDragState(null)
                                resetSourceBlockForm(page)
                              }}
                            >
                              <img src={apiFileUrl(page.image_path)} alt={`Pagina ${page.page_number} do documento ${selectedSourceDocument.title}`} />
                              <div className="fig-source-page-card-copy">
                                <strong>Pagina {page.page_number}</strong>
                                <span>{page.blocks?.length || 0} bloco(s) · {page.pending_detected_count || 0} pendente(s)</span>
                                <small>{page.assigned_detected_count || 0} atribuida(s)</small>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>

                      <div className="fig-admin-workspace fig-admin-workspace--source">
                        <section className="fig-page-panel fig-page-panel--source">
                          {selectedSourceDocumentPage ? (
                            <div className="fig-page-panel-header fig-page-panel-header--source">
                              <div className="fig-page-panel-copy">
                                <h3>Pagina {selectedSourceDocumentPage.page_number}</h3>
                                <span className="fig-page-panel-meta">
                                  {selectedSourceDocumentPage.pending_detected_count || 0} pendente(s) ·{' '}
                                  {selectedSourceDocumentPage.assigned_detected_count || 0} atribuida(s) ·{' '}
                                  {(selectedSourceDocumentPage.blocks || []).length} bloco(s)
                                </span>
                              </div>
                              <div className="fig-hero-actions fig-hero-actions--compact fig-source-page-actions">
                                <button
                                  type="button"
                                  className={`fig-secondary-button${sourcePageInteractionMode === 'detected' ? ' is-active' : ''}`}
                                  onClick={() => {
                                    setSourcePageInteractionMode('detected')
                                    setSourceBlockSelectionRect(null)
                                    setSourceBlockDragState(null)
                                    setSourceDetectedSelectionRect(null)
                                    setSourceDetectedDragState(null)
                                  }}
                                >
                                  Detectadas
                                </button>
                                <button
                                  type="button"
                                  className={`fig-secondary-button${sourcePageInteractionMode === 'block' ? ' is-active' : ''}`}
                                  onClick={() => {
                                    setSourcePageInteractionMode('block')
                                    setSourceDetectedSelectionRect(null)
                                    setSourceDetectedDragState(null)
                                  }}
                                >
                                  Bloco manual
                                </button>
                                <button
                                  type="button"
                                  className="fig-secondary-button"
                                  disabled={!selectedSourceDocumentPreviousPage || duplicatingSourceBlocks}
                                  onClick={handleDuplicateSourceBlocksFromPreviousPage}
                                >
                                  {duplicatingSourceBlocks ? 'Duplicando...' : 'Duplicar pagina anterior'}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {selectedSourceDocumentPage ? (
                            <div className="fig-page-image-shell">
                              <div
                                className="fig-page-image-frame"
                                onPointerDown={handleSourcePagePointerDown}
                                onPointerMove={handleSourcePagePointerMove}
                                onPointerUp={finalizeSourceBlockSelection}
                                onPointerCancel={finalizeSourceBlockSelection}
                                onPointerLeave={() => {
                                  if (sourceBlockDragState || sourceDetectedDragState) finalizeSourceBlockSelection()
                                }}
                              >
                                <img
                                  src={apiFileUrl(selectedSourceDocumentPage.image_path)}
                                  alt={`Pagina ${selectedSourceDocumentPage.page_number} do documento ${selectedSourceDocument.title}`}
                                />
                                {sourceDetectedStickers.map(detectedSticker => (
                                  <button
                                    key={detectedSticker.id}
                                    type="button"
                                    className={`fig-source-detected-overlay is-${String(detectedSticker.status || '').toLowerCase()}${selectedDetectedStickerIds.includes(detectedSticker.id) ? ' is-selected' : ''}`}
                                    style={getSourcePreviewBoxStyle(
                                      detectedSticker.x_ratio,
                                      detectedSticker.y_ratio,
                                      detectedSticker.width_ratio,
                                      detectedSticker.height_ratio
                                    )}
                                    onPointerDown={event => {
                                      event.stopPropagation()
                                    }}
                                    onClick={event => {
                                      event.stopPropagation()
                                      handleToggleSourceDetectedSticker(detectedSticker)
                                    }}
                                    title={
                                      detectedSticker.status === 'ATRIBUIDA'
                                        ? detectedSticker.assigned_collection_name || 'Atribuida'
                                        : detectedSticker.ocr_name_suggested || `Detectada ${detectedSticker.id}`
                                    }
                                  >
                                    <span>
                                      {detectedSticker.status === 'ATRIBUIDA'
                                        ? detectedSticker.assigned_collection_name || 'Atribuida'
                                        : detectedSticker.ocr_name_suggested || `#${detectedSticker.id}`}
                                    </span>
                                  </button>
                                ))}
                                {(selectedSourceDocumentPage.blocks || []).map(block => (
                                  <button
                                    key={block.id}
                                    type="button"
                                    className={`fig-source-block-overlay${editingSourceBlockId === block.id ? ' is-editing' : ''}`}
                                    style={getSourcePreviewBoxStyle(block.x, block.y, block.width, block.height)}
                                    onPointerDown={event => {
                                      event.stopPropagation()
                                    }}
                                    onClick={event => {
                                      event.stopPropagation()
                                      loadSourceBlockForEdit(block)
                                    }}
                                    title={block.label || block.collection_name || `Bloco ${block.sort_order}`}
                                  >
                                    <span>{block.label || block.collection_name || `Bloco ${block.sort_order}`}</span>
                                  </button>
                                ))}
                                {sourcePageInteractionMode === 'detected' && sourceDetectedSelectionRect ? (
                                  <div
                                    className="fig-source-detected-selection"
                                    style={{
                                      left: `${sourceDetectedSelectionRect.left}px`,
                                      top: `${sourceDetectedSelectionRect.top}px`,
                                      width: `${sourceDetectedSelectionRect.width}px`,
                                      height: `${sourceDetectedSelectionRect.height}px`
                                    }}
                                  />
                                ) : null}
                                {sourceBlockSelectionRect ? (
                                  <div
                                    className="fig-source-block-overlay is-drafting"
                                    style={{
                                      left: `${sourceBlockSelectionRect.left}px`,
                                      top: `${sourceBlockSelectionRect.top}px`,
                                      width: `${sourceBlockSelectionRect.width}px`,
                                      height: `${sourceBlockSelectionRect.height}px`
                                    }}
                                  />
                                ) : null}
                                {sourceBlockDraftRect ? (
                                  <div
                                    className="fig-source-block-overlay is-preview"
                                    style={getSourcePreviewBoxStyle(
                                      sourceBlockDraftRect.xRatio,
                                      sourceBlockDraftRect.yRatio,
                                      sourceBlockDraftRect.widthRatio,
                                      sourceBlockDraftRect.heightRatio
                                    )}
                                  />
                                ) : null}
                              </div>
                              <p className="fig-helper-text fig-helper-text--compact">
                                {sourcePageInteractionMode === 'detected'
                                  ? 'Clique nas caixas ou arraste uma area para selecionar varias de uma vez.'
                                  : 'Clique e arraste na pagina para marcar uma area manualmente.'}
                              </p>
                            </div>
                          ) : (
                            <p className="fig-empty-note">Escolha uma pagina para comecar a marcar os blocos.</p>
                          )}
                        </section>

                        <div className="fig-source-admin-tools">
                          <section className="fig-form-card fig-mapper-form">
                            <div className="fig-panel-header">
                              <p className="fig-kicker">Detectadas da pagina</p>
                              <h3>Selecionar e enviar</h3>
                            </div>

                            <div className="fig-form-grid">
                              <label className="fig-field">
                                <span>Selecao de destino</span>
                                <select
                                  value={sourceDetectedCollectionId}
                                  onChange={event => setSourceDetectedCollectionId(event.target.value)}
                                >
                                  <option value="">Selecione</option>
                                  {filteredCollections.map(collection => (
                                    <option key={collection.id} value={collection.id}>
                                      {collection.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="fig-selected-stickers">
                              <span className="fig-selection-chip">Pendentes: {pendingSourceDetectedStickers.length}</span>
                              <span className="fig-selection-chip">Selecionadas: {selectedDetectedStickerIds.length}</span>
                              <span className="fig-selection-chip">
                                Atribuidas: {sourceDetectedStickers.filter(detected => detected.status === 'ATRIBUIDA').length}
                              </span>
                            </div>

                            <div className="fig-hero-actions">
                                <button
                                  type="button"
                                  className="fig-secondary-button"
                                  disabled={!pendingSourceDetectedStickers.length}
                                  onClick={handleToggleAllPendingDetectedStickers}
                                >
                                {pendingSourceDetectedStickers.length &&
                                pendingSourceDetectedStickers.every(detected => selectedDetectedStickerIds.includes(detected.id))
                                  ? 'Limpar pendentes'
                                  : 'Selecionar pendentes'}
                              </button>
                              <button
                                type="button"
                                className="fig-secondary-button"
                                disabled={!selectedDetectedStickerIds.length}
                                onClick={() => setSelectedDetectedStickerIds([])}
                              >
                                Limpar selecao
                              </button>
                              <button
                                type="button"
                                className="fig-secondary-button"
                                disabled={
                                  unassigningDetectedStickers ||
                                  !selectedAssignedSourceDetectedStickers.length
                                }
                                onClick={handleUnassignSourceDetectedStickers}
                              >
                                {unassigningDetectedStickers ? 'Voltando...' : 'Voltar para pendente'}
                              </button>
                              <button
                                type="button"
                                className="fig-secondary-button"
                                disabled={discardingDetectedStickers || !selectedPendingSourceDetectedStickers.length}
                                onClick={handleDiscardSourceDetectedStickers}
                              >
                                {discardingDetectedStickers ? 'Descartando...' : 'Descartar'}
                              </button>
                              <button
                                type="button"
                                className="fig-primary-button"
                                disabled={
                                  assigningDetectedStickers ||
                                  !selectedPendingSourceDetectedStickers.length ||
                                  !sourceDetectedCollectionId
                                }
                                onClick={handleAssignSourceDetectedStickers}
                              >
                                {assigningDetectedStickers ? 'Enviando...' : 'Enviar para selecao'}
                              </button>
                            </div>

                            <div className="fig-source-block-review">
                              <div className="fig-panel-header fig-panel-header--compact">
                                <p className="fig-kicker">Revisao</p>
                                <h3>Caixas detectadas</h3>
                              </div>
                              {loadingSourceDetectedStickers ? (
                                <p className="fig-empty-note">Carregando figurinhas detectadas...</p>
                              ) : sourceDetectedStickers.length ? (
                                <div className="fig-sticker-grid fig-source-block-review-grid">
                                  {sourceDetectedStickers.map(detectedSticker => (
                                    <article
                                      key={detectedSticker.id}
                                      className={`fig-sticker-card fig-source-review-card${selectedDetectedStickerIds.includes(detectedSticker.id) ? ' is-selected' : ''}`}
                                    >
                                      <button
                                        type="button"
                                        className="fig-source-review-card-toggle"
                                        onClick={() => handleToggleSourceDetectedSticker(detectedSticker)}
                                        disabled={detectedSticker.status !== 'PENDENTE'}
                                      >
                                        <div className="fig-sticker-card-media">
                                          <img
                                            src={apiFileUrl(detectedSticker.preview_path)}
                                            alt={detectedSticker.ocr_name_suggested || `Detectada ${detectedSticker.id}`}
                                          />
                                        </div>
                                        <div className="fig-sticker-card-body fig-source-review-card-body">
                                          <strong>{detectedSticker.ocr_name_suggested || `Detectada ${detectedSticker.id}`}</strong>
                                          <span>
                                            {categoryLabel(detectedSticker.category)} · {sourceDetectedStatusLabel(detectedSticker.status)}
                                            {detectedSticker.assigned_collection_name ? ` · ${detectedSticker.assigned_collection_name}` : ''}
                                          </span>
                                          <span>
                                            {detectedSticker.ocr_name_suggested
                                              ? `OCR ${detectedSticker.ocr_name_suggested} (${formatOcrConfidence(detectedSticker.ocr_confidence)})`
                                              : detectedSticker.ocr_processed_at
                                                ? 'OCR sem leitura'
                                                : 'Sem OCR'}
                                          </span>
                                        </div>
                                      </button>
                                    </article>
                                  ))}
                                </div>
                              ) : (
                                <p className="fig-empty-note">
                                  Ainda nao existem figurinhas detectadas nessa pagina. Clique em Detectar todas as figurinhas para comecar.
                                </p>
                              )}
                            </div>
                          </section>

                          <details className="fig-admin-advanced fig-source-manual-panel" open={Boolean(editingSourceBlockId)}>
                            <summary>
                              <div className="fig-admin-accordion-summary">
                                <strong>Bloco manual</strong>
                                <span>Use so quando precisar marcar uma area manualmente.</span>
                              </div>
                            </summary>
                            <div className="fig-admin-advanced-body fig-source-manual-panel-body">
                              <form className="fig-source-manual-form" onSubmit={handleSourceBlockSubmit}>
                                <div className="fig-form-grid fig-source-manual-grid">
                                  <label className="fig-field fig-field--third">
                                    <span>Selecao</span>
                                    <select
                                      value={sourceBlockForm.collection_id}
                                      onChange={event =>
                                        setSourceBlockForm(current => ({
                                          ...current,
                                          collection_id: event.target.value,
                                          label:
                                            current.label ||
                                            filteredCollections.find(collection => collection.id === Number(event.target.value))?.name ||
                                            ''
                                        }))
                                      }
                                    >
                                      <option value="">Selecione</option>
                                      {filteredCollections.map(collection => (
                                        <option key={collection.id} value={collection.id}>
                                          {collection.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="fig-field fig-field--third">
                                    <span>Rotulo do bloco</span>
                                    <input
                                      value={sourceBlockForm.label}
                                      onChange={event =>
                                        setSourceBlockForm(current => ({
                                          ...current,
                                          label: event.target.value
                                        }))
                                      }
                                      placeholder="Brasil · bloco 1"
                                    />
                                  </label>

                                  <label className="fig-field fig-field--compact">
                                    <span>Ordem</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={sourceBlockForm.sort_order}
                                      onChange={event =>
                                        setSourceBlockForm(current => ({
                                          ...current,
                                          sort_order: event.target.value
                                        }))
                                      }
                                    />
                                  </label>

                                  <label className="fig-field fig-field--compact">
                                    <span>X</span>
                                    <input value={sourceBlockForm.x} readOnly />
                                  </label>

                                  <label className="fig-field fig-field--compact">
                                    <span>Y</span>
                                    <input value={sourceBlockForm.y} readOnly />
                                  </label>

                                  <label className="fig-field fig-field--compact">
                                    <span>Largura</span>
                                    <input value={sourceBlockForm.width} readOnly />
                                  </label>

                                  <label className="fig-field fig-field--compact">
                                    <span>Altura</span>
                                    <input value={sourceBlockForm.height} readOnly />
                                  </label>
                                </div>

                                <div className="fig-hero-actions">
                                  <button type="button" className="fig-secondary-button" onClick={() => resetSourceBlockForm()}>
                                    Limpar
                                  </button>
                                  {editingSourceBlockId ? (
                                    <button
                                      type="button"
                                      className="fig-secondary-button"
                                      disabled={savingSourceBlock || processingSourceBlockDetection || duplicatingSourceBlock}
                                      onClick={handleDuplicateSourceBlock}
                                    >
                                      {duplicatingSourceBlock ? 'Duplicando...' : 'Duplicar bloco'}
                                    </button>
                                  ) : null}
                                  {editingSourceBlockId ? (
                                    <button
                                      type="button"
                                      className="fig-secondary-button"
                                      disabled={processingSourceBlockDetection || savingSourceBlock}
                                      onClick={handleDetectSourceBlockStickers}
                                    >
                                      {processingSourceBlockDetection ? 'Detectando...' : 'Detectar figurinhas'}
                                    </button>
                                  ) : null}
                                  {editingSourceBlockId ? (
                                    <button
                                      type="button"
                                      className="fig-secondary-button"
                                      disabled={savingSourceBlock}
                                      onClick={handleDeleteSourceBlock}
                                    >
                                      {savingSourceBlock ? 'Excluindo...' : 'Excluir bloco'}
                                    </button>
                                  ) : null}
                                  <button
                                    type="submit"
                                    className="fig-primary-button"
                                    disabled={
                                      savingSourceBlock ||
                                      !selectedSourceDocumentPageId ||
                                      !sourceBlockForm.collection_id ||
                                      !sourceBlockForm.x ||
                                      !sourceBlockForm.width ||
                                      !sourceBlockForm.height
                                    }
                                  >
                                    {savingSourceBlock
                                      ? 'Salvando...'
                                      : editingSourceBlockId
                                        ? 'Salvar bloco'
                                        : 'Criar bloco'}
                                  </button>
                                </div>

                                {editingSourceBlockId ? (
                                  <div className="fig-source-block-review">
                                    <div className="fig-panel-header fig-panel-header--compact">
                                      <p className="fig-kicker">Revisao</p>
                                      <h3>Recortes do bloco</h3>
                                    </div>
                                    {loadingSourceBlockStickers ? (
                                      <p className="fig-empty-note">Carregando recortes detectados...</p>
                                    ) : sourceBlockStickers.length ? (
                                      <div className="fig-sticker-grid fig-source-block-review-grid">
                                        {sourceBlockStickers.map(sticker => (
                                          <article key={sticker.id} className="fig-sticker-card fig-source-review-card">
                                            <div className="fig-sticker-card-media">
                                              <img src={apiFileUrl(sticker.preview_path)} alt={sticker.name} />
                                            </div>
                                            <div className="fig-sticker-card-body fig-source-review-card-body">
                                              <strong>{sticker.name}</strong>
                                              <span>
                                                {categoryLabel(sticker.category)}
                                                {sticker.ocr_name_suggested
                                                  ? ` · OCR ${sticker.ocr_name_suggested} (${formatOcrConfidence(sticker.ocr_confidence)})`
                                                  : sticker.ocr_processed_at
                                                    ? ' · OCR sem leitura'
                                                    : ''}
                                              </span>
                                              <button
                                                type="button"
                                                className="fig-inline-link"
                                                onClick={() => handleDeleteSourceBlockSticker(sticker.id)}
                                              >
                                                Excluir recorte
                                              </button>
                                            </div>
                                          </article>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="fig-empty-note">
                                        Esse bloco ainda nao tem figurinhas geradas. Salve o bloco e clique em Detectar figurinhas.
                                      </p>
                                    )}
                                  </div>
                                ) : null}
                              </form>
                            </div>
                          </details>
                        </div>
                      </div>

                    </>
                  ) : (
                    <p className="fig-empty-note">
                      Escolha um documento fonte na lista para ver as paginas renderizadas e seguir para o editor de blocos.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
          </>
        ) : null}

        {adminView === 'atendimento' ? (
        <section className="fig-admin-summary-grid fig-admin-summary-grid--single">
          <div className="fig-admin-stack">
            <section className="fig-form-card fig-form-card--supporting">
              <div className="fig-panel-header">
                <p className="fig-kicker">Acessos</p>
                <h3>Resumo do site</h3>
              </div>
              <div className="fig-admin-access-grid">
                <article className="fig-admin-access-card">
                  <span className="fig-admin-access-label">Visitas hoje</span>
                  <strong>{accessSummary.visits_today ?? 0}</strong>
                </article>
                <article className="fig-admin-access-card">
                  <span className="fig-admin-access-label">Unicos hoje</span>
                  <strong>{accessSummary.unique_today ?? 0}</strong>
                </article>
                <article className="fig-admin-access-card">
                  <span className="fig-admin-access-label">Visitas 7 dias</span>
                  <strong>{accessSummary.visits_last_7_days ?? 0}</strong>
                </article>
                <article className="fig-admin-access-card">
                  <span className="fig-admin-access-label">Unicos 7 dias</span>
                  <strong>{accessSummary.unique_last_7_days ?? 0}</strong>
                </article>
              </div>
            </section>
            <details className="fig-admin-advanced fig-admin-accordion">
              <summary>
                <div className="fig-admin-accordion-summary">
                  <strong>Configuracao publica e cobranca</strong>
                  <span>Pix, apoio, liberacao da Minha Figurinha e servico manual de retirada.</span>
                </div>
              </summary>
              <div className="fig-admin-advanced-body fig-admin-accordion-body">
            <form className="fig-form-card fig-form-card--supporting" onSubmit={handleSaveServiceConfig}>
              <div className="fig-panel-header">
                <p className="fig-kicker">Configuracao publica</p>
                <h3>Pix, apoio e retirada</h3>
              </div>

              <label className="fig-checkbox">
                <input
                  type="checkbox"
                  checked={serviceForm.donation_enabled}
                  onChange={event => setServiceForm(current => ({ ...current, donation_enabled: event.target.checked }))}
                />
                <span>Mostrar apoio opcional via Pix apos gerar o PDF gratis</span>
              </label>
              <p className="fig-inline-note">Para esse apoio aparecer no publico, a Chave Pix precisa estar preenchida.</p>

              <label className="fig-checkbox">
                <input
                  type="checkbox"
                  checked={serviceForm.custom_sticker_unlock_enabled}
                  onChange={event =>
                    setServiceForm(current => ({ ...current, custom_sticker_unlock_enabled: event.target.checked }))
                  }
                />
                <span>Cobrar no PDF da Minha Figurinha manual</span>
              </label>

              <label className="fig-checkbox">
                <input
                  type="checkbox"
                  checked={serviceForm.custom_ai_unlock_enabled}
                  onChange={event =>
                    setServiceForm(current => ({ ...current, custom_ai_unlock_enabled: event.target.checked }))
                  }
                />
                <span>Cobrar antes de gerar a Minha Figurinha com IA</span>
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
                <label className="fig-field">
                  <span>Modo disponivel no catalogo da Minha Figurinha</span>
                  <select
                    value={serviceForm.custom_generation_mode}
                    onChange={event => setServiceForm(current => ({ ...current, custom_generation_mode: event.target.value }))}
                  >
                    {customGenerationModeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight fig-field--full">
                  <div>
                    <strong>Como isso afeta o cliente</strong>
                    <span>
                      {serviceForm.custom_generation_mode === 'AI_OPTIONAL'
                        ? 'O cliente pode escolher entre Montagem manual e Criar com IA. O manual so aparece quando existir um modelo pronto para aquele perfil e posicao.'
                        : 'O cliente ve somente Montagem manual no catalogo. A opcao com IA fica escondida.'}
                    </span>
                  </div>
                </div>
                <label className="fig-field fig-field--full">
                  <span>Mensagem do modal de apoio</span>
                  <textarea
                    value={serviceForm.donation_message}
                    onChange={event => setServiceForm(current => ({ ...current, donation_message: event.target.value }))}
                    rows="3"
                    placeholder="Se este material te ajudou, voce pode apoiar o projeto com uma doacao via Pix. O download continua gratuito."
                  />
                </label>
                <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight fig-field--full">
                  <div>
                    <strong>Minha Figurinha manual</strong>
                    <span>O cliente monta primeiro e so ve a cobranca no final, quando for baixar o PDF com ela.</span>
                  </div>
                </div>
                <label className="fig-field fig-field--full">
                  <span>Mensagem da cobranca manual</span>
                  <textarea
                    value={serviceForm.custom_sticker_unlock_message}
                    onChange={event =>
                      setServiceForm(current => ({ ...current, custom_sticker_unlock_message: event.target.value }))
                    }
                    rows="3"
                    placeholder="Sua figurinha personalizada e um recurso especial. Voce pode baixar gratis sem ela ou liberar o PDF completo por R$ 5,00."
                  />
                </label>
                <label className="fig-field">
                  <span>Preco da versao manual (R$)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={serviceForm.custom_sticker_unlock_price}
                    onChange={event =>
                      setServiceForm(current => ({ ...current, custom_sticker_unlock_price: event.target.value }))
                    }
                  />
                </label>
                <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight fig-field--full">
                  <div>
                    <strong>Minha Figurinha com IA</strong>
                    <span>Quando ativa, a cobranca aparece antes da geracao. Quem paga aqui nao paga de novo no PDF.</span>
                  </div>
                </div>
                <label className="fig-field fig-field--full">
                  <span>Mensagem da cobranca da IA</span>
                  <textarea
                    value={serviceForm.custom_ai_unlock_message}
                    onChange={event =>
                      setServiceForm(current => ({ ...current, custom_ai_unlock_message: event.target.value }))
                    }
                    rows="3"
                    placeholder="A criacao com IA e um recurso premium. Pague primeiro para liberar a geracao da sua figurinha."
                  />
                </label>
                <label className="fig-field">
                  <span>Preco da versao com IA (R$)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={serviceForm.custom_ai_unlock_price}
                    onChange={event =>
                      setServiceForm(current => ({ ...current, custom_ai_unlock_price: event.target.value }))
                    }
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
              </div>
            </details>

            <details className="fig-admin-advanced fig-admin-accordion">
              <summary>
                <div className="fig-admin-accordion-summary">
                  <strong>Ferramentas manuais</strong>
                  <span>Modelos, camadas e ajustes da montagem manual da Minha Figurinha.</span>
                </div>
              </summary>
              <div className="fig-admin-advanced-body fig-admin-accordion-body">
          <section className="fig-form-card fig-form-card--focused">
            <div className="fig-panel-header">
              <p className="fig-kicker">Minha Figurinha</p>
              <h3>Modelos da Minha Figurinha</h3>
            </div>
            <p className="fig-empty-note">
              O fluxo principal agora e simples: escolha o perfil e a posicao, envie as 4 camadas principais e ajuste
              os textos. O que for secundario fica recolhido.
            </p>

            <div className="fig-order-layout fig-order-layout--editor">
              <div className="fig-order-list">
                <button type="button" className="fig-order-list-item" onClick={handleStartNewCustomTemplate}>
                  <strong>Novo modelo</strong>
                  <span>Comecar outra combinacao</span>
                </button>
                {customTemplates.map(template => (
                  <button
                    key={template.id}
                    type="button"
                    className={`fig-order-list-item${template.id === selectedCustomTemplateId ? ' is-active' : ''}`}
                    onClick={() => setSelectedCustomTemplateId(template.id)}
                  >
                    <strong>{template.name || buildCustomTemplateName(template.profile_type, template.position_type, template.category_type)}</strong>
                    <span>
                      {customProfileLabel(template.profile_type)} ·{' '}
                      {customPositionTypeOptions.find(option => option.value === template.position_type)?.label || template.position_type}
                    </span>
                    <span>
                      {template.is_active ? 'Ativo' : 'Inativo'} · {template.layer_count} camada(s)
                    </span>
                    <span className={`fig-template-status-note${template.manual_ready ? ' is-ready' : ''}`}>
                      {template.manual_ready
                        ? 'Pronto para montagem manual'
                        : template.manual_status?.missing_count
                          ? `Faltam: ${template.manual_status.missing_labels.join(', ')}`
                          : 'Modelo ainda incompleto'}
                    </span>
                  </button>
                ))}
                {customTemplates.length === 0 ? (
                  <p className="fig-empty-note">Nenhum modelo cadastrado ainda.</p>
                ) : null}
              </div>

              <form className="fig-order-detail" onSubmit={handleSaveCustomTemplate}>
                <div className="fig-form-grid">
                  <label className="fig-field">
                    <span>Nome interno</span>
                    <input
                      value={customTemplateForm.name}
                      onChange={event => setCustomTemplateForm(current => ({ ...current, name: event.target.value }))}
                      placeholder="Homem · Jogador · Atacante"
                    />
                  </label>
                  <label className="fig-field">
                    <span>Perfil</span>
                    <select
                      value={customTemplateForm.profile_type}
                      onChange={event =>
                        setCustomTemplateForm(current => {
                          const nextProfile = event.target.value
                          const currentAutoName = buildCustomTemplateName(current.profile_type, current.position_type, current.category_type)
                          return {
                            ...current,
                            profile_type: nextProfile,
                            name: current.name.trim() === currentAutoName.trim()
                              ? buildCustomTemplateName(nextProfile, current.position_type, current.category_type)
                              : current.name
                          }
                        })
                      }
                    >
                      {customProfileOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fig-field fig-template-advanced-field">
                    <span>Categoria</span>
                    <select
                      value={customTemplateForm.category_type}
                      onChange={event => setCustomTemplateForm(current => ({ ...current, category_type: event.target.value }))}
                    >
                      {customCategoryTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fig-field">
                    <span>Posicao</span>
                    <select
                      value={customTemplateForm.position_type}
                      onChange={event =>
                        setCustomTemplateForm(current => {
                          const nextPosition = event.target.value
                          const currentAutoName = buildCustomTemplateName(current.profile_type, current.position_type, current.category_type)
                          return {
                            ...current,
                            position_type: nextPosition,
                            name: current.name.trim() === currentAutoName.trim()
                              ? buildCustomTemplateName(current.profile_type, nextPosition, current.category_type)
                              : current.name
                          }
                        })
                      }
                    >
                      {customPositionTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fig-field fig-template-advanced-field">
                    <span>Modo</span>
                    <select
                      value={customTemplateForm.composition_mode}
                      onChange={event => setCustomTemplateForm(current => ({ ...current, composition_mode: event.target.value }))}
                    >
                      {customGenerationModeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fig-field fig-template-advanced-field">
                    <span>Ordem</span>
                    <input
                      type="number"
                      min="0"
                      value={customTemplateForm.sort_order}
                      onChange={event => setCustomTemplateForm(current => ({ ...current, sort_order: event.target.value }))}
                    />
                  </label>
                  <label className="fig-checkbox fig-field--full">
                    <input
                      type="checkbox"
                      checked={customTemplateForm.is_active}
                      onChange={event => setCustomTemplateForm(current => ({ ...current, is_active: event.target.checked }))}
                    />
                    <span>Modelo ativo para o catalogo</span>
                  </label>
                </div>

                <div className="fig-helper-strip fig-helper-strip--compact">
                  <div>
                    <strong>Nome sugerido</strong>
                    <span>{buildCustomTemplateName(customTemplateForm.profile_type, customTemplateForm.position_type, customTemplateForm.category_type)}</span>
                  </div>
                  <div>
                    <strong>Album</strong>
                    <span>{selectedAlbum?.name || 'Escolha um album na lateral antes de criar o modelo'}</span>
                  </div>
                  <button
                    type="button"
                    className="fig-inline-link"
                    onClick={() => setCustomTemplateForm(current => applyStandardCustomTemplateStructure(current))}
                  >
                    Preparar modelo padrao de 4 camadas
                  </button>
                </div>

                <div className={`fig-template-readiness-card${currentTemplateManualStatus.ready ? ' is-ready' : ''}`}>
                  <div className="fig-template-readiness-header">
                    <div>
                      <strong>{currentTemplateManualStatus.ready ? 'Modelo pronto para montagem manual' : 'O que falta para liberar a montagem manual'}</strong>
                      <span>
                        {currentTemplateManualStatus.ready
                          ? 'Esse modelo ja pode aparecer no catalogo no modo manual.'
                          : currentTemplateManualStatus.missing_labels.length
                            ? currentTemplateManualStatus.missing_labels.join(', ')
                            : 'Salve o modelo e importe as camadas principais.'}
                      </span>
                    </div>
                    <span className={`fig-template-readiness-badge${currentTemplateManualStatus.ready ? ' is-ready' : ''}`}>
                      {currentTemplateManualStatus.ready ? 'Pronto' : `${currentTemplateManualStatus.missing_count} pendencia(s)`}
                    </span>
                  </div>

                  <div className="fig-template-checklist">
                    {currentTemplateManualStatus.checks.map(check => (
                      <div key={check.key} className={`fig-template-check${check.ready ? ' is-ready' : ''}`}>
                        <strong>{check.ready ? 'OK' : 'Falta'}</strong>
                        <div>
                          <span>{check.label}</span>
                          <small>{check.detail}</small>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="fig-template-layer-badges">
                    {currentTemplateManualStatus.layer_inventory.map(layer => (
                      <span
                        key={layer.layer_type}
                        className={`fig-template-layer-badge${layer.count > 0 ? ' is-ready' : ''}`}
                      >
                        {layer.label}: {layer.count}
                      </span>
                    ))}
                  </div>
                </div>

                <details className="fig-admin-advanced">
                  <summary>Importacao em lote (opcional e menos confiavel)</summary>
                  <div className="fig-admin-advanced-body">
                <div className="fig-helper-strip fig-helper-strip--card">
                  {currentTemplatePreviewPath ? (
                    <div className="fig-custom-base-inline fig-custom-base-inline--layer">
                      <div className="fig-custom-base-inline-preview">
                        <img src={apiFileUrl(currentTemplatePreviewPath)} alt={suggestedCustomTemplateName} />
                      </div>
                      <div className="fig-custom-base-inline-copy">
                        <strong>{suggestedCustomTemplateName}</strong>
                        <span>{importedTemplateLayerCount} camada(s) com imagem pronta</span>
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <strong>Importar pacote de camadas</strong>
                    <span>
                      Se o pacote nao reconhecer direito, pode ignorar esta etapa. O fluxo mais seguro agora e salvar o
                      modelo e enviar cada camada logo abaixo: fundo, faixa de informacoes, moldura e camisa frontal.
                    </span>
                  </div>
                  <div className="fig-custom-base-card-actions">
                    <label className="fig-primary-button fig-file-button">
                      {importingTemplateBatch ? 'Importando pacote...' : 'Importar pacote'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        disabled={importingTemplateBatch || savingCustomTemplate}
                        onChange={event => {
                          handleCustomTemplateBatchImport(event.target.files)
                          event.target.value = ''
                        }}
                      />
                    </label>
                    <small>Opcional. O caminho principal agora e camada por camada.</small>
                  </div>
                </div>
                  </div>
                </details>

                <div className="fig-panel-header fig-panel-header--compact">
                  <p className="fig-kicker">Camadas</p>
                  <h3>Pilha visual</h3>
                </div>
                <div className="fig-helper-strip fig-helper-strip--compact">
                  <div>
                    <strong>Ordem esperada</strong>
                    <span>1. Fundo base  2. Faixa de informacoes  3. Moldura principal  4. Camisa frontal</span>
                  </div>
                  <div>
                    <strong>Textos</strong>
                    <span>Nome, data, altura, peso e cidade/time ficam sobre a segunda camada.</span>
                  </div>
                </div>
                {customTemplatePreviewLayers.length ? (
                  <div className="fig-helper-strip fig-helper-strip--card fig-helper-strip--preview">
                    <div className="fig-manual-editor-preview fig-manual-editor-preview--admin">
                      <div className="fig-manual-sticker-stage fig-manual-sticker-stage--admin">
                        {customTemplatePreviewLayers.map(layer => (
                          <img
                            key={layer.id || `${layer.layer_type}-${layer.z_index}`}
                            className="fig-manual-stage-layer"
                            src={apiFileUrl(layer.file_path)}
                            alt={layer.label || suggestedCustomTemplateName}
                            style={{ zIndex: Number(layer.z_index || 0) }}
                          />
                        ))}
                        {customTemplatePreviewTextSlots.map(slot => (
                          <div
                            key={slot.id || slot.field_name}
                            className={`fig-manual-stage-text fig-manual-stage-text--${slot.field_name.toLowerCase()}`}
                            style={{
                              left: `${slot.x * 100}%`,
                              top: `${slot.y * 100}%`,
                              width: `${slot.width * 100}%`,
                              fontSize: `${Math.max(6, slot.font_size)}px`,
                              fontWeight: slot.font_weight || '700',
                              textAlign: slot.text_align || 'left',
                              color: slot.color || '#ffffff'
                            }}
                          >
                            {customTemplateSampleTextValue(slot.field_name)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong>Preview ao vivo</strong>
                      <span>Os textos acima reagem em tempo real enquanto voce ajusta posicao, largura e fonte.</span>
                    </div>
                  </div>
                ) : null}
                <div className="fig-admin-stack">
                  {standardCustomTemplateLayers.map(({ layer, index }) => (
                    <div key={`${layer.id || 'new'}-${index}`} className="fig-helper-strip fig-helper-strip--card fig-template-layer-card">
                      <div className="fig-custom-base-inline fig-custom-base-inline--layer">
                        <div className="fig-custom-base-inline-preview">
                          {layer.file_path ? (
                            <img src={apiFileUrl(layer.file_path)} alt={layer.label || `Camada ${index + 1}`} />
                          ) : (
                            <div className="fig-custom-base-card-empty">
                              <span>Sem imagem</span>
                            </div>
                          )}
                        </div>
                        <div className="fig-custom-base-inline-copy">
                          <strong>{layer.label || 'Camada sem nome'}</strong>
                          <span>
                            {layer.file_path ? 'Imagem enviada' : 'Envie a imagem desta camada'}
                          </span>
                        </div>
                      </div>

                      <div className="fig-custom-base-card-actions">
                        <input
                          className="fig-plain-file-input"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={savingCustomTemplate || uploadingTemplateLayerKey === `${selectedCustomTemplateId}:${layer.id}`}
                          onChange={event => {
                            const file = event.target.files?.[0]
                            handleCustomTemplateLayerUpload(layer, file, index)
                            event.target.value = ''
                          }}
                        />
                        <button
                          type="button"
                          className="fig-inline-link"
                          disabled={!layer.file_path || savingCustomTemplate || deletingTemplateLayerKey === `${selectedCustomTemplateId}:${layer.id}`}
                          onClick={() => handleCustomTemplateLayerDelete(layer, index)}
                        >
                          {deletingTemplateLayerKey === `${selectedCustomTemplateId}:${layer.id}` ? 'Removendo...' : 'Remover imagem'}
                        </button>
                      </div>

                      {!selectedCustomTemplateId || !layer.id ? (
                        <small>Ao enviar a primeira imagem, o modelo e salvo automaticamente.</small>
                      ) : null}
                    </div>
                  ))}
                </div>

                <details className="fig-admin-advanced">
                  <summary>Ajustar textos da faixa (avancado)</summary>
                  <div className="fig-admin-advanced-body">
                <div className="fig-panel-header fig-panel-header--compact">
                  <p className="fig-kicker">Textos</p>
                  <h3>Campos da figurinha</h3>
                </div>
                <div className="fig-helper-strip fig-helper-strip--compact">
                  <div>
                    <strong>Esses textos ficam sobre a faixa de informacoes</strong>
                    <span>Nome, data de nascimento, altura, peso e cidade/time.</span>
                  </div>
                </div>
                <div className="fig-helper-strip fig-helper-strip--card">
                  <div>
                    <strong>Aplicar em lote</strong>
                    <span>Use valores positivos ou negativos para mover todos os textos juntos sem editar campo por campo.</span>
                  </div>
                  <div className="fig-form-grid">
                    <label className="fig-field">
                      <span>Delta X</span>
                      <input
                        type="number"
                        step="0.01"
                        value={customTemplateTextBulkForm.delta_x}
                        onChange={event => setCustomTemplateTextBulkForm(current => ({ ...current, delta_x: event.target.value }))}
                      />
                    </label>
                    <label className="fig-field">
                      <span>Delta Y</span>
                      <input
                        type="number"
                        step="0.01"
                        value={customTemplateTextBulkForm.delta_y}
                        onChange={event => setCustomTemplateTextBulkForm(current => ({ ...current, delta_y: event.target.value }))}
                      />
                    </label>
                    <label className="fig-field">
                      <span>Delta largura</span>
                      <input
                        type="number"
                        step="0.01"
                        value={customTemplateTextBulkForm.delta_width}
                        onChange={event => setCustomTemplateTextBulkForm(current => ({ ...current, delta_width: event.target.value }))}
                      />
                    </label>
                    <label className="fig-field">
                      <span>Delta fonte</span>
                      <input
                        type="number"
                        step="1"
                        value={customTemplateTextBulkForm.delta_font_size}
                        onChange={event => setCustomTemplateTextBulkForm(current => ({ ...current, delta_font_size: event.target.value }))}
                      />
                    </label>
                    <label className="fig-field">
                      <span>Peso para todos</span>
                      <input
                        value={customTemplateTextBulkForm.font_weight}
                        onChange={event => setCustomTemplateTextBulkForm(current => ({ ...current, font_weight: event.target.value }))}
                        placeholder="700"
                      />
                    </label>
                    <label className="fig-field">
                      <span>Alinhamento para todos</span>
                      <input
                        value={customTemplateTextBulkForm.text_align}
                        onChange={event => setCustomTemplateTextBulkForm(current => ({ ...current, text_align: event.target.value }))}
                        placeholder="center"
                      />
                    </label>
                    <label className="fig-field">
                      <span>Cor para todos</span>
                      <input
                        value={customTemplateTextBulkForm.color}
                        onChange={event => setCustomTemplateTextBulkForm(current => ({ ...current, color: event.target.value }))}
                        placeholder="#ffffff"
                      />
                    </label>
                  </div>
                  <div className="fig-custom-base-card-actions">
                    <button type="button" className="fig-secondary-button" onClick={applyBulkCustomTemplateTextAdjustments}>
                      Aplicar em todos
                    </button>
                    <button
                      type="button"
                      className="fig-inline-link"
                      onClick={() => setCustomTemplateTextBulkForm(createEmptyCustomTemplateTextBulkForm())}
                    >
                      Resetar lote
                    </button>
                  </div>
                </div>
                <div className="fig-admin-stack">
                  {customTemplateForm.text_slots.map((slot, index) => (
                    <div key={`${slot.id || 'new'}-${index}`} className="fig-helper-strip fig-helper-strip--card">
                      <div className="fig-form-grid">
                        <label className="fig-field">
                          <span>Campo</span>
                          <select
                            value={slot.field_name}
                            onChange={event =>
                              setCustomTemplateForm(current => ({
                                ...current,
                                text_slots: current.text_slots.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, field_name: event.target.value } : item
                                )
                              }))
                            }
                          >
                            {customTemplateTextFieldOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {[
                          ['x', 'X'],
                          ['y', 'Y'],
                          ['width', 'Largura'],
                          ['font_size', 'Fonte']
                        ].map(([field, label]) => (
                          <label key={field} className="fig-field">
                            <span>{label}</span>
                            <input
                              type="number"
                              step="0.01"
                              value={slot[field]}
                              onChange={event =>
                                setCustomTemplateForm(current => ({
                                  ...current,
                                  text_slots: current.text_slots.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, [field]: event.target.value } : item
                                  )
                                }))
                              }
                            />
                          </label>
                        ))}
                        <label className="fig-field">
                          <span>Peso</span>
                          <input
                            value={slot.font_weight}
                            onChange={event =>
                              setCustomTemplateForm(current => ({
                                ...current,
                                text_slots: current.text_slots.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, font_weight: event.target.value } : item
                                )
                              }))
                            }
                            placeholder="700"
                          />
                        </label>
                        <label className="fig-field">
                          <span>Alinhamento</span>
                          <input
                            value={slot.text_align}
                            onChange={event =>
                              setCustomTemplateForm(current => ({
                                ...current,
                                text_slots: current.text_slots.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, text_align: event.target.value } : item
                                )
                              }))
                            }
                            placeholder="left / center"
                          />
                        </label>
                        <label className="fig-field">
                          <span>Cor</span>
                          <input
                            value={slot.color}
                            onChange={event =>
                              setCustomTemplateForm(current => ({
                                ...current,
                                text_slots: current.text_slots.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, color: event.target.value } : item
                                )
                              }))
                            }
                            placeholder="#ffffff"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                  </div>
                </details>

                <details className="fig-admin-advanced">
                  <summary>Ajustes avancados do modelo</summary>
                  <div className="fig-admin-advanced-body">
                <div className="fig-panel-header fig-panel-header--compact">
                  <p className="fig-kicker">Foto</p>
                  <h3>Area segura da pessoa</h3>
                </div>
                <div className="fig-form-grid">
                  {customTemplateForm.photo_slot ? (
                    <>
                      {[
                        ['x', 'X'],
                        ['y', 'Y'],
                        ['width', 'Largura'],
                        ['height', 'Altura'],
                        ['default_scale', 'Escala padrao'],
                        ['min_scale', 'Escala minima'],
                        ['max_scale', 'Escala maxima'],
                        ['portrait_z_index', 'Ordem da foto'],
                        ['anchor_x', 'Ancora X'],
                        ['anchor_y', 'Ancora Y'],
                        ['visible_x', 'Mascara X'],
                        ['visible_y', 'Mascara Y'],
                        ['visible_width', 'Mascara largura'],
                        ['visible_height', 'Mascara altura']
                      ].map(([field, label]) => (
                        <label key={field} className="fig-field">
                          <span>{label}</span>
                          <input
                            type="number"
                            step={field === 'portrait_z_index' ? '1' : '0.01'}
                            value={customTemplateForm.photo_slot[field]}
                            onChange={event =>
                              setCustomTemplateForm(current => ({
                                ...current,
                                photo_slot: {
                                  ...current.photo_slot,
                                  [field]: event.target.value
                                }
                              }))
                            }
                          />
                        </label>
                      ))}
                    </>
                  ) : null}
                </div>

                <div className="fig-panel-header fig-panel-header--compact">
                  <p className="fig-kicker">Camadas extras</p>
                  <h3>Somente se precisar</h3>
                </div>
                {extraCustomTemplateLayers.length > 0 ? (
                  <div className="fig-admin-stack">
                    {extraCustomTemplateLayers.map(({ layer, index }) => (
                      <div key={`${layer.id || 'extra'}-${index}`} className="fig-helper-strip fig-helper-strip--card fig-template-layer-card">
                        <div className="fig-form-grid">
                          <label className="fig-field">
                            <span>Tipo</span>
                            <select
                              value={layer.layer_type}
                              onChange={event =>
                                setCustomTemplateForm(current => ({
                                  ...current,
                                  layers: current.layers.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, layer_type: event.target.value } : item
                                  )
                                }))
                              }
                            >
                              {customTemplateLayerTypeOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="fig-field">
                            <span>Label</span>
                            <input
                              value={layer.label}
                              onChange={event =>
                                setCustomTemplateForm(current => ({
                                  ...current,
                                  layers: current.layers.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, label: event.target.value } : item
                                  )
                                }))
                              }
                            />
                          </label>
                          <label className="fig-field">
                            <span>Ordem Z</span>
                            <input
                              type="number"
                              min="0"
                              value={layer.z_index}
                              onChange={event =>
                                setCustomTemplateForm(current => ({
                                  ...current,
                                  layers: current.layers.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, z_index: event.target.value } : item
                                  )
                                }))
                              }
                            />
                          </label>
                          <label className="fig-checkbox">
                            <input
                              type="checkbox"
                              checked={layer.is_active}
                              onChange={event =>
                                setCustomTemplateForm(current => ({
                                  ...current,
                                  layers: current.layers.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, is_active: event.target.checked } : item
                                  )
                                }))
                              }
                            />
                            <span>Ativa</span>
                          </label>
                          <div className="fig-field fig-field--full">
                            <div className="fig-custom-base-card-actions">
                              <input
                                className="fig-plain-file-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                disabled={savingCustomTemplate || uploadingTemplateLayerKey === `${selectedCustomTemplateId}:${layer.id}`}
                                onChange={event => {
                                  const file = event.target.files?.[0]
                                  handleCustomTemplateLayerUpload(layer, file, index)
                                  event.target.value = ''
                                }}
                              />
                              <button
                                type="button"
                                className="fig-inline-link"
                                disabled={!layer.file_path || savingCustomTemplate || deletingTemplateLayerKey === `${selectedCustomTemplateId}:${layer.id}`}
                                onClick={() => handleCustomTemplateLayerDelete(layer, index)}
                              >
                                {deletingTemplateLayerKey === `${selectedCustomTemplateId}:${layer.id}` ? 'Removendo...' : 'Remover imagem'}
                              </button>
                              <button type="button" className="fig-inline-link" onClick={() => removeCustomTemplateLayer(index)}>
                                Remover camada extra
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="fig-empty-note">Nenhuma camada extra adicionada.</p>
                )}
                <button type="button" className="fig-secondary-button" onClick={addCustomTemplateLayer}>
                  Adicionar camada extra
                </button>

                <div className="fig-panel-header fig-panel-header--compact">
                  <p className="fig-kicker">Interno</p>
                  <h3>Configuracoes do modelo</h3>
                </div>
                <div className="fig-form-grid">
                  <label className="fig-field">
                    <span>Nome interno</span>
                    <input
                      value={customTemplateForm.name}
                      onChange={event => setCustomTemplateForm(current => ({ ...current, name: event.target.value }))}
                      placeholder="Homem · Jogador · Atacante"
                    />
                  </label>
                  <label className="fig-field">
                    <span>Categoria</span>
                    <select
                      value={customTemplateForm.category_type}
                      onChange={event => setCustomTemplateForm(current => ({ ...current, category_type: event.target.value }))}
                    >
                      {customCategoryTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fig-field">
                    <span>Modo</span>
                    <select
                      value={customTemplateForm.composition_mode}
                      onChange={event => setCustomTemplateForm(current => ({ ...current, composition_mode: event.target.value }))}
                    >
                      {customGenerationModeOptions.map(option => (
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
                      value={customTemplateForm.sort_order}
                      onChange={event => setCustomTemplateForm(current => ({ ...current, sort_order: event.target.value }))}
                    />
                  </label>
                </div>

                  </div>
                </details>

                <div className="fig-hero-actions">
                  <button type="button" className="fig-secondary-button" onClick={handleStartNewCustomTemplate}>
                    Novo modelo
                  </button>
                  <button
                    type="button"
                    className="fig-inline-link fig-inline-link--danger"
                    disabled={!selectedCustomTemplateId || deletingCustomTemplate || savingCustomTemplate}
                    onClick={handleDeleteCustomTemplate}
                  >
                    {deletingCustomTemplate ? 'Excluindo...' : 'Excluir modelo'}
                  </button>
                  <button type="submit" className="fig-primary-button" disabled={savingCustomTemplate || importingTemplateBatch}>
                    {savingCustomTemplate ? 'Salvando...' : selectedCustomTemplateId ? 'Salvar modelo' : 'Criar modelo'}
                  </button>
                </div>
              </form>
            </div>
          </section>
              </div>
            </details>

            <details className="fig-admin-advanced fig-admin-accordion">
              <summary>
                <div className="fig-admin-accordion-summary">
                  <strong>Ferramentas de IA</strong>
                  <span>Bases por perfil e prompt da OpenAI ficam separados da montagem manual.</span>
                </div>
              </summary>
              <div className="fig-admin-advanced-body fig-admin-accordion-body">
          <section className="fig-form-card">
            <div className="fig-panel-header">
              <p className="fig-kicker">Minha Figurinha</p>
              <h3>Bases oficiais por perfil</h3>
            </div>
            <p className="fig-empty-note">
              Envie 3 bases oficiais, uma para homem, mulher e crianca. Aqui fica so a parte que ajuda a IA.
            </p>

            <div className="fig-custom-base-grid">
              {customProfileOptions.map(option => {
                const basePath = serviceForm[customBaseFieldByProfile[option.value]] || ''
                const isUploading = uploadingBaseProfile === option.value
                const isDeleting = deletingBaseProfile === option.value
                return (
                  <article key={option.value} className="fig-custom-base-card">
                    <div className="fig-custom-base-card-head">
                      <div>
                        <strong>{option.label}</strong>
                        <span>{basePath ? 'Base configurada' : 'Base ainda nao enviada'}</span>
                      </div>
                    </div>

                    <div className="fig-custom-base-card-preview">
                      {basePath ? (
                        <img src={apiFileUrl(basePath)} alt={`Base ${option.label}`} />
                      ) : (
                        <div className="fig-custom-base-card-empty">
                          <span>Sem base</span>
                        </div>
                      )}
                    </div>

                    <div className="fig-custom-base-card-actions">
                      <label className="fig-secondary-button fig-file-button">
                        {isUploading ? 'Enviando...' : basePath ? 'Trocar base' : 'Enviar base'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={isUploading}
                          onChange={event => {
                            const file = event.target.files?.[0]
                            handleCustomBaseUpload(option.value, file)
                            event.target.value = ''
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="fig-inline-link"
                        disabled={!basePath || isDeleting}
                        onClick={() => handleCustomBaseDelete(option.value)}
                      >
                        {isDeleting ? 'Removendo...' : 'Remover'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="fig-form-card">
            <div className="fig-panel-header">
              <p className="fig-kicker">Minha Figurinha</p>
              <h3>Prompt da IA</h3>
            </div>
            <p className="fig-empty-note">
              Esse texto orienta a OpenAI na composicao completa da figurinha usando a foto enviada e a base oficial do
              perfil. Se quiser ajustar, mantenha as variaveis abaixo para o sistema continuar montando o prompt
              corretamente.
            </p>
            <label className="fig-field">
              <span>Prompt atual</span>
              <textarea
                rows="8"
                value={serviceForm.custom_prompt_template}
                onChange={event => setServiceForm(current => ({ ...current, custom_prompt_template: event.target.value }))}
              />
            </label>
            <div className="fig-helper-strip fig-helper-strip--compact fig-helper-strip--tight">
              <div>
                <strong>Variaveis disponiveis:</strong>
                <span>
                  {'{name}'}, {'{profile_label}'}, {'{profile_label_lower}'}, {'{birth_date_text}'}, {'{height_text}'}, {'{weight_text}'}, {'{city_or_team}'}, {'{city_hint}'}, {'{base_hint}'}, {'{details_hint}'}
                </span>
              </div>
            </div>
          </section>
              </div>
            </details>
          </div>

          <div className="fig-admin-stack">
          <details className="fig-admin-advanced fig-admin-accordion">
            <summary>
              <div className="fig-admin-accordion-summary">
                <strong>Pedidos e retirada</strong>
                <span>Pedidos locais, status, notas internas e download do PDF do cliente.</span>
              </div>
            </summary>
            <div className="fig-admin-advanced-body fig-admin-accordion-body">
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
            </div>
          </details>
          </div>
        </section>
        ) : null}

        {selectedCollection && (adminView === 'collection' || adminView === 'mapping') ? (
          <>
            <div className="fig-admin-header fig-admin-section-head">
              <div>
                <p className="fig-kicker">{isAppendOnlyExtraCollection ? 'Gestao do extra' : 'Gestao da selecao'}</p>
                <h3>{selectedCollection.name}</h3>
                <p>
                  Album atual: <strong>{selectedCollection.album_name || 'Sem album'}</strong>.{' '}
                  {isAppendOnlyExtraCollection
                    ? 'Suba o PDF completo desse extra e publique para ele aparecer como anexo no final do PDF.'
                    : 'Suba o PDF, mapeie as areas de corte e publique quando o catalogo estiver pronto.'}
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
                  Mover para outro album
                </button>
                <button type="button" className="fig-secondary-button" onClick={() => handlePublish('RASCUNHO')}>
                  Voltar para rascunho
                </button>
                <button type="button" className="fig-primary-button" onClick={() => handlePublish('PUBLICADA')}>
                  {isAppendOnlyExtraCollection ? 'Publicar extra' : 'Publicar selecao'}
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

            {isAppendOnlyExtraCollection ? (
              <div className="fig-helper-strip">
                Esse tipo entra como <strong>PDF inteiro no final</strong>. Nao precisa processar paginas, detectar
                recortes nem mapear figurinhas individuais.
              </div>
            ) : (
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
            )}

            {adminView === 'mapping' ? (
              isAppendOnlyExtraCollection ? (
                <section className="fig-form-card">
                  <div className="fig-panel-header">
                    <p className="fig-kicker">Mapeamento desnecessario</p>
                    <h3>Esse extra ja esta pronto</h3>
                  </div>
                  <p className="fig-empty-note">
                    O tipo <strong>Outros</strong> usa o PDF inteiro como anexo no final do arquivo. Depois de subir o
                    PDF original, basta publicar a colecao.
                  </p>
                </section>
              ) : (
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
              )
            ) : null}
          </>
        ) : null}
        {!selectedCollection && (adminView === 'collection' || adminView === 'mapping') ? (
          <section className="fig-form-card fig-admin-empty-state">
            <p className="fig-kicker">Selecao necessaria</p>
            <h3>Escolha uma selecao na lateral para continuar</h3>
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
