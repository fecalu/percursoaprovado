export function calcularDiasRestantes(dataFim) {
  if (!dataFim) return null

  const agora = new Date()
  const fim = new Date(dataFim)
  const diff = fim.getTime() - agora.getTime()

  return Math.ceil(diff / 86400000)
}

export function formatarDiasRestantes(dataFim) {
  const dias = calcularDiasRestantes(dataFim)

  if (dias === null) return 'Sem validade informada'
  if (dias < 0) return 'Acesso encerrado'
  if (dias === 0) return 'Expira hoje'
  if (dias === 1) return 'Expira amanha'
  return `${dias} dias restantes`
}
