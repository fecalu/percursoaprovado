function parseDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function assinaturaEstaLiberadaAgora(item, agora = new Date()) {
  if (!item) return false
  if (item.status !== 'ATIVA' || item.paymentStatus !== 'PAGO') return false

  const inicio = parseDate(item.inicioEm)
  const fim = parseDate(item.fimEm)
  const agoraMs = agora.getTime()

  if (inicio && inicio.getTime() > agoraMs) return false
  if (fim && fim.getTime() < agoraMs) return false

  return true
}

export function filtrarAssinaturasLiberadasAgora(assinaturas = [], agora = new Date()) {
  return assinaturas.filter(item => assinaturaEstaLiberadaAgora(item, agora))
}
