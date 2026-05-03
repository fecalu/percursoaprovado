function parseDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function diffInDays(targetDate, agora = new Date()) {
  if (!targetDate) return null
  return Math.ceil((targetDate.getTime() - agora.getTime()) / 86400000)
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

export function assinaturaEstaAgendada(item, agora = new Date()) {
  if (!item) return false
  if (item.status === 'CANCELADA' || item.paymentStatus !== 'PAGO') return false

  const inicio = parseDate(item.inicioEm)
  return Boolean(inicio && inicio.getTime() > agora.getTime())
}

export function filtrarAssinaturasAgendadas(assinaturas = [], agora = new Date()) {
  return assinaturas.filter(item => assinaturaEstaAgendada(item, agora))
}

export function getRenovacaoAgendadaPorLocal(assinaturas = [], localProvaId, agora = new Date()) {
  return filtrarAssinaturasAgendadas(assinaturas, agora)
    .filter(item => String(item.localProvaId) === String(localProvaId))
    .sort((a, b) => new Date(a.inicioEm || 0) - new Date(b.inicioEm || 0))[0] || null
}

export function assinaturaPodeSerRenovada(item, assinaturas = [], janelaDias = 15, agora = new Date()) {
  if (!assinaturaEstaLiberadaAgora(item, agora)) return false
  if (getRenovacaoAgendadaPorLocal(assinaturas, item.localProvaId, agora)) return false

  const fim = parseDate(item.fimEm)
  const diasAteFim = diffInDays(fim, agora)
  return diasAteFim !== null && diasAteFim >= 0 && diasAteFim <= janelaDias
}
