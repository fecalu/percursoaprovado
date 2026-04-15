export function pluralizar(total, singular, plural) {
  return `${total} ${total === 1 ? singular : plural}`
}

export function compararTexto(a = '', b = '') {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

export function normalizarBusca(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function textoContem(termo, ...valores) {
  if (!termo) return true
  return valores.some(valor => normalizarBusca(valor).includes(termo))
}

function ordenarGuiaBlocos(a, b) {
  const ordemA = a?.ordemExibicao ?? 0
  const ordemB = b?.ordemExibicao ?? 0

  if (ordemA !== ordemB) {
    return ordemA - ordemB
  }

  return compararTexto(a?.titulo, b?.titulo)
}

function ordenarGuiaItens(a, b) {
  const ordemA = a?.ordemExibicao ?? 0
  const ordemB = b?.ordemExibicao ?? 0

  if (ordemA !== ordemB) {
    return ordemA - ordemB
  }

  return compararTexto(a?.titulo, b?.titulo)
}

export function normalizarGuiaBlocos(blocos = []) {
  return [...blocos]
    .filter(bloco => bloco?.titulo)
    .sort(ordenarGuiaBlocos)
    .map(bloco => ({
      ...bloco,
      itensVisuais: [...(bloco.itensVisuais || [])]
        .filter(item => item?.titulo)
        .sort(ordenarGuiaItens),
    }))
}

export function obterChaveGuiaBloco(bloco, index) {
  return bloco.id || `${bloco.ordemExibicao ?? index}-${bloco.titulo}`
}

export function formatarIconeGuia(icone) {
  if (!icone || icone === 'check') return '\u2713'

  const mapa = {
    check: '\u2713',
    documento: 'DOC',
    local: 'LOC',
    carro: 'CAR',
    alerta: '!',
    tempo: 'H',
    default: 'OK',
  }

  return mapa[icone] || '\u2713'
}
