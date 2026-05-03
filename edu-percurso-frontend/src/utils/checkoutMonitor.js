import {
  canUseLocalStorage,
  safeLocalStorageGetItem,
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
} from './browserStorage'

const CHECKOUT_STORAGE_KEY = 'checkout_em_andamento'
const CHECKOUT_EVENT_KEY = 'checkout_status_event'
const CHECKOUT_CHANNEL_NAME = 'checkout-status'
const CHECKOUT_MAX_AGE_MS = 1000 * 60 * 60 * 12

function canUseBrowserStorage() {
  return canUseLocalStorage()
}

function parsePayload(rawValue) {
  if (!rawValue) return null

  try {
    return JSON.parse(rawValue)
  } catch {
    return null
  }
}

function isExpired(monitor) {
  const reference = monitor?.completedAt || monitor?.updatedAt || monitor?.startedAt
  if (!reference) return false
  return Date.now() - new Date(reference).getTime() > CHECKOUT_MAX_AGE_MS
}

export function createCheckoutMonitor(pedido, localSlug) {
  return {
    pedidoId: pedido?.id || '',
    referencia: pedido?.referencia || '',
    localSlug: pedido?.localProvaSlug || localSlug || '',
    localNome: pedido?.localProvaNome || '',
    planoNome: pedido?.planoNome || '',
    checkoutUrl: pedido?.checkoutUrl || '',
    status: pedido?.status || 'PENDENTE',
    paymentId: pedido?.paymentId || '',
    paymentStatus: pedido?.paymentStatus || '',
    paymentStatusDetail: pedido?.paymentStatusDetail || '',
    pagoEm: pedido?.pagoEm || '',
    assinaturaInicioEm: pedido?.assinaturaInicioEm || '',
    assinaturaFimEm: pedido?.assinaturaFimEm || '',
    startedAt: pedido?.criadoEm || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: '',
  }
}

export function getCheckoutMonitorStage(monitor) {
  if (!monitor) return 'IDLE'
  if (monitor.status === 'PAGO' || monitor.paymentStatus === 'approved' || monitor.paymentStatus === 'refunded') {
    return 'SUCCESS'
  }
  if (
    monitor.status === 'CANCELADO'
    || monitor.paymentStatus === 'cancelled'
    || monitor.paymentStatus === 'rejected'
    || monitor.paymentStatus === 'charged_back'
  ) {
    return 'FAILED'
  }
  return 'PENDING'
}

export function mergeCheckoutMonitor(currentMonitor, patch = {}) {
  const merged = {
    ...(currentMonitor || {}),
    ...(patch || {}),
    updatedAt: new Date().toISOString(),
  }

  if (getCheckoutMonitorStage(merged) !== 'PENDING' && !merged.completedAt) {
    merged.completedAt = new Date().toISOString()
  }

  return merged
}

export function loadCheckoutMonitor() {
  if (!canUseBrowserStorage()) return null

  const monitor = parsePayload(safeLocalStorageGetItem(CHECKOUT_STORAGE_KEY))
  if (!monitor) return null

  if (isExpired(monitor)) {
    clearCheckoutMonitor()
    return null
  }

  return monitor
}

export function saveCheckoutMonitor(monitor) {
  if (!canUseBrowserStorage() || !monitor) return
  safeLocalStorageSetItem(CHECKOUT_STORAGE_KEY, JSON.stringify(monitor))
}

export function clearCheckoutMonitor() {
  if (!canUseBrowserStorage()) return
  safeLocalStorageRemoveItem(CHECKOUT_STORAGE_KEY)
}

export function notifyCheckoutMonitor(message) {
  if (typeof window === 'undefined' || !message) return

  const payload = {
    ...message,
    emittedAt: new Date().toISOString(),
  }

  if (typeof window.BroadcastChannel !== 'undefined') {
    const channel = new window.BroadcastChannel(CHECKOUT_CHANNEL_NAME)
    channel.postMessage(payload)
    channel.close()
  }

  safeLocalStorageSetItem(CHECKOUT_EVENT_KEY, JSON.stringify(payload))
  safeLocalStorageRemoveItem(CHECKOUT_EVENT_KEY)
}

export function subscribeCheckoutMonitor(listener) {
  if (typeof window === 'undefined') return () => {}

  let channel = null
  const cleanupFns = []

  if (typeof window.BroadcastChannel !== 'undefined') {
    channel = new window.BroadcastChannel(CHECKOUT_CHANNEL_NAME)
    channel.onmessage = event => listener(event.data)
    cleanupFns.push(() => channel.close())
  }

  const storageListener = event => {
    if (event.key !== CHECKOUT_EVENT_KEY || !event.newValue) return
    const payload = parsePayload(event.newValue)
    if (payload) listener(payload)
  }

  window.addEventListener('storage', storageListener)
  cleanupFns.push(() => window.removeEventListener('storage', storageListener))

  return () => cleanupFns.forEach(fn => fn())
}
