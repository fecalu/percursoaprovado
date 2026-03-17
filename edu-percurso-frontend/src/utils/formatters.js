export function formatDuracaoMinutos(segundos) {
  if (!segundos || segundos <= 0) return '-'
  return `${Math.floor(segundos / 60)} min`
}

export function formatDataCurta(valor) {
  if (!valor) return '-'
  return new Date(valor).toLocaleDateString('pt-BR')
}

export function formatDataHoraCurta(valor) {
  if (!valor) return '-'
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatPlanoDuracao(dias) {
  if (!dias || dias <= 0) return '-'
  if (dias === 30) return '1 mes'
  if (dias === 90) return '3 meses'
  if (dias === 180) return '6 meses'
  if (dias === 365 || dias === 366) return '1 ano'
  if (dias % 30 === 0 && dias < 365) {
    const meses = dias / 30
    return `${meses} ${meses === 1 ? 'mes' : 'meses'}`
  }
  return `${dias} dias`
}

export function formatPedidoStatus(status) {
  const labels = {
    PENDENTE: 'Aguardando pagamento',
    PAGO: 'Acesso liberado',
    CANCELADO: 'Cancelado',
  }

  if (!status) return '-'
  return labels[status] || status
}

export function formatAssinaturaStatus(status) {
  const labels = {
    ATIVA: 'Ativo',
    EXPIRADA: 'Expirado',
    CANCELADA: 'Cancelado',
  }

  if (!status) return '-'
  return labels[status] || status
}

export function formatAssinaturaPagamentoStatus(status) {
  const labels = {
    PAGO: 'Pago',
    PENDENTE: 'Pendente',
    FALHOU: 'Falhou',
    REEMBOLSADO: 'Reembolsado',
  }

  if (!status) return '-'
  return labels[status] || status
}

export function formatOrigemAssinatura(origem) {
  const labels = {
    CHECKOUT: 'Checkout',
    MANUAL: 'Manual',
    CORTESIA: 'Cortesia',
  }

  if (!origem) return '-'
  return labels[origem] || origem
}

export function formatStatusComercialLocal(statusComercial) {
  const labels = {
    RASCUNHO: 'Rascunho',
    EM_BREVE: 'Em breve',
    DISPONIVEL: 'Disponivel',
    PAUSADO: 'Pausado',
  }

  if (!statusComercial) return '-'
  return labels[statusComercial] || statusComercial
}

export function formatDiasRestantes(dias, status) {
  if (status === 'CANCELADA') return 'Cancelado'
  if (status === 'EXPIRADA') return 'Expirado'
  if (dias === null || dias === undefined) return '-'
  if (dias === 0) return 'Vence hoje'
  if (dias === 1) return '1 dia'
  return `${dias} dias`
}

export function formatPagamentoStatus(status) {
  const labels = {
    approved: 'Aprovado',
    pending: 'Pendente',
    in_process: 'Em analise',
    authorized: 'Autorizado',
    rejected: 'Recusado',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
    charged_back: 'Estornado',
  }

  if (!status) return '-'
  return labels[status] || status.replaceAll('_', ' ')
}

export function formatPagamentoDetalhe(detail) {
  const labels = {
    accredited: 'pagamento aprovado',
    pending_waiting_payment: 'aguardando pagamento',
    pending_contingency: 'aguardando confirmacao',
    pending_review_manual: 'em analise manual',
    cc_rejected_bad_filled_card_number: 'numero do cartao invalido',
    cc_rejected_bad_filled_date: 'validade do cartao invalida',
    cc_rejected_bad_filled_other: 'dados do cartao invalidos',
    cc_rejected_bad_filled_security_code: 'codigo de seguranca invalido',
    cc_rejected_blacklist: 'pagamento recusado',
    cc_rejected_call_for_authorize: 'autorizacao necessaria',
    cc_rejected_card_disabled: 'cartao desabilitado',
    cc_rejected_card_error: 'erro no cartao',
    cc_rejected_duplicated_payment: 'pagamento duplicado',
    cc_rejected_high_risk: 'pagamento recusado',
    cc_rejected_insufficient_amount: 'limite insuficiente',
    cc_rejected_invalid_installments: 'parcelamento invalido',
    cc_rejected_max_attempts: 'tentativas excedidas',
    cc_rejected_other_reason: 'pagamento recusado',
  }

  if (!detail) return ''
  return labels[detail] || detail.replaceAll('_', ' ')
}

export function formatTipoConteudo(tipoConteudo) {
  const labels = {
    PERCURSO_REAL: 'Percurso real',
    SIMULACAO_COMPLETA: 'Simulacao completa',
    ERROS_REPROVACAO: 'Erros de reprovacao',
    BALIZA: 'Baliza',
    CONTROLE_EMBREAGEM: 'Controle de embreagem',
    EXAMINADOR: 'Olhar do examinador',
  }

  if (!tipoConteudo) return 'Conteudo'
  return labels[tipoConteudo] || tipoConteudo.replaceAll('_', ' ').toLowerCase()
}
