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
  if (dias === 30) return '1 mês'
  if (dias === 90) return '3 meses'
  if (dias === 180) return '6 meses'
  if (dias === 365 || dias === 366) return '1 ano'
  if (dias % 30 === 0 && dias < 365) {
    const meses = dias / 30
    return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  }
  return `${dias} dias`
}

export function formatTrilhaPlano(trilhaNome, trilhaCodigo) {
  if (trilhaNome) return trilhaNome

  const labels = {
    comecando_do_zero: 'Comecando do zero',
    reta_final_prova: 'Reta final para a prova',
  }

  if (!trilhaCodigo) return 'Trilha do plano'
  return labels[trilhaCodigo] || trilhaCodigo.replaceAll('_', ' ')
}

export function getResumoTrilhaPlano(trilhaCodigo) {
  if (trilhaCodigo === 'comecando_do_zero') {
    return 'Ideal para quem quer seguir a jornada completa desde o inicio ate o dia da prova.'
  }

  if (trilhaCodigo === 'reta_final_prova') {
    return 'Ideal para quem ja passou pelas etapas iniciais e quer focar em pratica, percurso e revisao.'
  }

  return 'Essa trilha organiza a ordem sugerida de estudo dentro do plano.'
}

export function getBadgeClassTrilhaPlano(trilhaCodigo) {
  if (trilhaCodigo === 'comecando_do_zero') return 'badge-green'
  if (trilhaCodigo === 'reta_final_prova') return 'badge-blue'
  return 'badge-blue'
}

export function getOrdemTrilhaPlano(trilhaCodigo) {
  if (trilhaCodigo === 'comecando_do_zero') return 0
  if (trilhaCodigo === 'reta_final_prova') return 1
  return 9
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

function assinaturaComecaNoFuturo(assinaturaInicioEm) {
  if (!assinaturaInicioEm) return false

  const inicio = new Date(assinaturaInicioEm)
  if (Number.isNaN(inicio.getTime())) return false
  return inicio.getTime() > Date.now()
}

export function resolveSituacaoPedido(status, solicitacaoStatus, paymentStatus, assinaturaInicioEm) {
  if (paymentStatus === 'refunded') return 'REEMBOLSADO'
  if (paymentStatus === 'charged_back') return 'ESTORNADO'
  if (status === 'CANCELADO') return 'PEDIDO_CANCELADO'
  if (status === 'PENDENTE') return 'AGUARDANDO_PAGAMENTO'
  if (solicitacaoStatus === 'ABERTA') return 'SOLICITACAO_EM_ANALISE'
  if (solicitacaoStatus === 'APROVADA') return 'REEMBOLSO_PENDENTE'
  if (solicitacaoStatus === 'NEGADA') return 'PAGAMENTO_MANTIDO'
  if (status === 'PAGO' && assinaturaComecaNoFuturo(assinaturaInicioEm)) return 'RENOVACAO_AGENDADA'
  if (status === 'PAGO') return 'ACESSO_LIBERADO'
  return status || '-'
}

export function formatSituacaoPedido(status, solicitacaoStatus, paymentStatus, assinaturaInicioEm) {
  const situacao = resolveSituacaoPedido(status, solicitacaoStatus, paymentStatus, assinaturaInicioEm)
  const labels = {
    AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
    ACESSO_LIBERADO: 'Acesso liberado',
    RENOVACAO_AGENDADA: 'Renovação agendada',
    SOLICITACAO_EM_ANALISE: 'Solicitação em análise',
    REEMBOLSO_PENDENTE: 'Reembolso pendente',
    PAGAMENTO_MANTIDO: 'Pagamento mantido',
    PEDIDO_CANCELADO: 'Pedido cancelado',
    REEMBOLSADO: 'Reembolsado',
    ESTORNADO: 'Estornado',
  }

  return labels[situacao] || situacao
}

export function getSituacaoPedidoBadgeClass(status, solicitacaoStatus, paymentStatus, assinaturaInicioEm) {
  const situacao = resolveSituacaoPedido(status, solicitacaoStatus, paymentStatus, assinaturaInicioEm)
  if (situacao === 'ACESSO_LIBERADO' || situacao === 'PAGAMENTO_MANTIDO') return 'badge-green'
  if (situacao === 'RENOVACAO_AGENDADA') return 'badge-blue'
  if (situacao === 'SOLICITACAO_EM_ANALISE') return 'badge-warn'
  if (situacao === 'REEMBOLSO_PENDENTE' || situacao === 'REEMBOLSADO' || situacao === 'ESTORNADO') return 'badge-blue'
  if (situacao === 'PEDIDO_CANCELADO') return 'badge-red'
  return 'badge-gray'
}

export function formatSolicitacaoCancelamentoStatus(status) {
  const labels = {
    ABERTA: 'Em análise',
    APROVADA: 'Aprovada no sistema',
    NEGADA: 'Negada',
    ERRO_PROCESSAMENTO: 'Erro no processamento',
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
    DISPONIVEL: 'Disponível',
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
    in_process: 'Em análise',
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
    manual_refund_confirmed: 'reembolso confirmado manualmente',
    pending_waiting_payment: 'aguardando pagamento',
    pending_contingency: 'aguardando confirmação',
    pending_review_manual: 'em análise manual',
    cc_rejected_bad_filled_card_number: 'número do cartão inválido',
    cc_rejected_bad_filled_date: 'validade do cartão inválida',
    cc_rejected_bad_filled_other: 'dados do cartão inválidos',
    cc_rejected_bad_filled_security_code: 'código de segurança inválido',
    cc_rejected_blacklist: 'pagamento recusado',
    cc_rejected_call_for_authorize: 'autorização necessária',
    cc_rejected_card_disabled: 'cartão desabilitado',
    cc_rejected_card_error: 'erro no cartão',
    cc_rejected_duplicated_payment: 'pagamento duplicado',
    cc_rejected_high_risk: 'pagamento recusado',
    cc_rejected_insufficient_amount: 'limite insuficiente',
    cc_rejected_invalid_installments: 'parcelamento inválido',
    cc_rejected_max_attempts: 'tentativas excedidas',
    cc_rejected_other_reason: 'pagamento recusado',
  }

  if (!detail) return ''
  return labels[detail] || detail.replaceAll('_', ' ')
}

export function formatTipoConteudo(tipoConteudo) {
  const labels = {
    PERCURSO_REAL: 'Percurso real do local',
    SIMULACAO_COMPLETA: 'Simulação completa da prova',
    ERROS_REPROVACAO: 'Erros que mais tiram pontos',
    BALIZA: 'Baliza com mais confiança',
    CONTROLE_EMBREAGEM: 'Mais controle de embreagem',
    EXAMINADOR: 'O que costuma ser avaliado',
  }

  if (!tipoConteudo) return 'Conteúdo'
  return labels[tipoConteudo] || tipoConteudo.replaceAll('_', ' ').toLowerCase()
}

export function formatTemaQuestao(tema) {
  const labels = {
    PLACAS: 'Placas',
    LEGISLACAO: 'Legislação',
    DIRECAO_DEFENSIVA: 'Direção defensiva',
    PRIMEIROS_SOCORROS: 'Primeiros socorros',
    MECANICA_BASICA: 'Mecânica básica',
    MEIO_AMBIENTE_CIDADANIA: 'Meio ambiente e cidadania',
    BALIZA: 'Baliza',
    CONTROLE_DO_VEICULO: 'Controle do veiculo',
    LADEIRA: 'Ladeira',
    PREFERENCIA: 'Preferencia',
    CONVERSOES: 'Conversoes',
    ESTACIONAMENTO: 'Estacionamento',
    FALTAS_ELIMINATORIAS: 'Faltas eliminatorias',
    CONDUTA_NA_PROVA: 'Conduta na prova',
  }

  if (!tema) return '-'
  return labels[tema] || tema
}

export function formatModalidadeQuestao(modalidade) {
  const labels = {
    TEORICO: 'Teorica',
    PRATICO: 'Pratica',
  }

  if (!modalidade) return '-'
  return labels[modalidade] || modalidade
}

export function formatDificuldadeQuestao(dificuldade) {
  const labels = {
    FACIL: 'Fácil',
    MEDIA: 'Média',
    DIFICIL: 'Difícil',
  }

  if (!dificuldade) return '-'
  return labels[dificuldade] || dificuldade
}

export function formatStatusQuestao(status) {
  const labels = {
    RASCUNHO: 'Rascunho',
    PUBLICADA: 'Publicada',
    ARQUIVADA: 'Arquivada',
  }

  if (!status) return '-'
  return labels[status] || status
}

export function getStatusQuestaoBadgeClass(status) {
  if (status === 'PUBLICADA') return 'badge-green'
  if (status === 'ARQUIVADA') return 'badge-gray'
  return 'badge-warn'
}

export function formatStatusDuvidaPercurso(status) {
  const labels = {
    PENDENTE_MODERACAO: 'Pendente',
    PUBLICADA: 'Publicada',
    RESPONDIDA: 'Respondida',
    RESOLVIDA: 'Resolvida',
    OCULTA: 'Oculta',
    FUNDIDA: 'Fundida',
  }

  if (!status) return '-'
  return labels[status] || status
}

export function getStatusDuvidaPercursoBadgeClass(status) {
  if (status === 'RESPONDIDA' || status === 'RESOLVIDA') return 'badge-green'
  if (status === 'PUBLICADA') return 'badge-blue'
  if (status === 'OCULTA' || status === 'FUNDIDA') return 'badge-gray'
  return 'badge-warn'
}
