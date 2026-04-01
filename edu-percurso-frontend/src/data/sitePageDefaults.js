export const HOME_PAGE_DEFAULTS = {
  heroKicker: 'Preparação prática por local de prova',
  heroTitulo: 'Descubra os percursos mais frequentes da sua prova prática.',
  heroSubtitulo:
    'Prepare-se com mais confiança usando vídeos reais, simulações e orientações baseadas nos trajetos mais recorrentes e no que mais pesa na avaliação.',
  heroBotaoPrimarioTexto: 'Escolher meu local de prova',
  heroBotaoSecundarioTexto: 'Ver como funciona',
  heroVideoUrl: '',
  heroVideoTitulo: 'Demonstração da plataforma',
  secaoLocaisTitulo: 'Escolha seu local de prova',
  secaoLocaisSubtitulo:
    'Temos o mapeamento dos principais polos já disponíveis. Encontre o seu e comece a estudar com mais critério.',
  faqTitulo: 'Dúvidas comuns antes da compra',
  faqSubtitulo:
    'Abra apenas o que você quiser consultar e mantenha a página mais leve para navegar.',
  faqItens: [
    {
      pergunta: 'Como funciona a plataforma?',
      resposta:
        'Você escolhe o local da sua prova, libera o acesso e revisa os percursos mais frequentes, pontos de atenção e módulos práticos antes do exame.',
    },
    {
      pergunta: 'Isso garante o trajeto exato da minha prova?',
      resposta:
        'Não. O foco é mostrar os percursos mais frequentes observados na prática para você chegar menos surpreso e mais preparado.',
    },
    {
      pergunta: 'Comprei um local. Tenho acesso aos outros?',
      resposta:
        'Cada compra libera apenas um local de prova, pelo período escolhido. Se quiser outro local, a compra é separada.',
    },
    {
      pergunta: 'O que acontece depois do pagamento?',
      resposta:
        'Assim que o Mercado Pago confirma o pagamento, o acesso é liberado automaticamente na sua conta.',
    },
  ],
  ctaFinalKicker: 'Comece pelo seu local',
  ctaFinalTitulo: 'Quanto antes você estudar o padrão da prova, mais seguro chega no dia.',
  ctaFinalTexto:
    'Escolha o local de prova, veja o que já está liberado e comece a revisar com mais critério, menos ansiedade e mais confiança.',
  ctaFinalBotaoPrimarioTexto: 'Ver locais liberados',
  ctaFinalBotaoSecundarioTexto: 'Criar conta e acompanhar',
}

export const LOCAL_PAGE_DEFAULTS = {
  heroFallbackTitulo: 'Prepare-se melhor para a prova em {local}.',
  heroFallbackSubtituloDisponivel:
    'Escolha o período que combina melhor com sua data de prova e com o ritmo em que você quer revisar.',
  heroFallbackSubtituloIndisponivel: '{descricao} {mensagem}',
  secaoPlanosTitulo: 'Escolha o tempo certo para estudar esse local',
  secaoPlanosSubtitulo:
    'Compare duração, contexto e preço antes de seguir para o checkout.',
  secaoPlanosFaixa1: 'Pagamento único',
  secaoPlanosFaixa2: 'Liberação automática após a confirmação',
  secaoPlanosFaixa3: '1 local por compra',
  boxFallbackTitulo: 'O que você vai encontrar neste acesso',
  boxFallbackItem1: 'Percursos mais frequentes e simulação da prova',
  boxFallbackItem2: 'Baliza, embreagem e erros que mais tiram pontos',
  boxFallbackItem3: 'Acesso organizado para revisar no seu ritmo',
  boxFallbackObservacao:
    'O acesso aparece automaticamente na sua conta assim que o pagamento for confirmado.',
  saibaMaisTitulo: 'Saiba mais sobre esse acesso',
  saibaMaisSubtitulo:
    'Abra apenas os detalhes que você quiser consultar depois de olhar os planos.',
  saibaMaisItens: [
    {
      titulo: 'O que você vai encontrar',
      copy:
        'Esse acesso foi organizado para mostrar o que mais ajuda antes da prova, sem excesso de informação aberta de uma vez.',
      pontos: [
        'Percursos mais frequentes e simulação da prova',
        'Baliza, embreagem e erros que mais tiram pontos',
      ],
    },
    {
      titulo: 'Como isso ajuda no dia da prova',
      copy:
        'O foco não é decorar rua. É dirigir com mais leitura, menos surpresa e mais critério durante a avaliação.',
      pontos: [
        'Menos surpresa ao entender como a prova costuma acontecer',
        'Mais leitura da avaliação para saber o que exige mais atenção',
        'Mais confiança para dirigir com calma, critério e preparo',
      ],
    },
    {
      titulo: 'Compra e liberação',
      copy:
        'A compra é simples e o acesso aparece automaticamente assim que o pagamento é confirmado.',
      pontos: [
        'Compra única sem renovação automática',
        'Pagamento por Pix ou cartão via Mercado Pago',
        'Liberação automática após a confirmação',
      ],
    },
  ],
}

export const CHECKOUT_PAGE_DEFAULTS = {
  kickerPadrao: 'Revise seu acesso antes de pagar',
  tituloPadrao: 'Você está a um passo de liberar o material do seu local de prova.',
  subtituloPadrao:
    'Revise o que está incluído, confirme o período escolhido e siga para o pagamento com mais clareza.',
  beneficiosTituloPadrao: 'O que você vai receber',
  beneficiosListaPadrao: [
    'Percursos mais frequentes do local',
    'Pontos de atenção nos trechos mais importantes',
    'Vídeos e apoios explicativos',
    'Baliza, embreagem e revisão prática',
  ],
  ajudaTituloPadrao: 'Como isso ajuda antes da prova',
  ajudaTextoPadrao:
    'O objetivo não é decorar rua. É chegar mais preparado para entender o padrão da avaliação, reduzir surpresa e dirigir com mais critério no dia da prova.',
  confiancaListaPadrao: [
    'Liberação automática após a confirmação',
    'Pagamento processado com segurança pelo Mercado Pago',
    'O acesso aparece na sua biblioteca assim que o pagamento for aprovado',
  ],
  resumoKickerPadrao: 'Resumo da compra',
  resumoTextoPadrao: 'Material do local de prova com acesso por {duracao}.',
  precoLabelPadrao: 'Total',
  precoTextoPadrao: 'Pagamento único pelo período escolhido',
  seguroTextoPadrao: 'Pagamento seguro com Mercado Pago',
}

function asString(value) {
  return typeof value === 'string' ? value : ''
}

function normalizeFaqItems(items) {
  if (!Array.isArray(items)) return []

  return items
    .map(item => ({
      pergunta: asString(item?.pergunta),
      resposta: asString(item?.resposta),
    }))
    .filter(item => item.pergunta.trim() && item.resposta.trim())
}

function normalizeSaibaMaisItems(items) {
  if (!Array.isArray(items)) return []

  return items
    .map(item => ({
      titulo: asString(item?.titulo),
      copy: asString(item?.copy),
      pontos: Array.isArray(item?.pontos)
        ? item.pontos.map(ponto => asString(ponto).trim()).filter(Boolean)
        : [],
    }))
    .filter(item => item.titulo.trim() && (item.copy.trim() || item.pontos.length > 0))
}

function normalizeStringList(items) {
  if (!Array.isArray(items)) return []
  return items.map(item => asString(item).trim()).filter(Boolean)
}

export function createEmptyHomePageConfig() {
  return {
    heroKicker: '',
    heroTitulo: '',
    heroSubtitulo: '',
    heroBotaoPrimarioTexto: '',
    heroBotaoSecundarioTexto: '',
    heroVideoUrl: '',
    heroVideoTitulo: '',
    secaoLocaisTitulo: '',
    secaoLocaisSubtitulo: '',
    faqTitulo: '',
    faqSubtitulo: '',
    faqItens: [],
    ctaFinalKicker: '',
    ctaFinalTitulo: '',
    ctaFinalTexto: '',
    ctaFinalBotaoPrimarioTexto: '',
    ctaFinalBotaoSecundarioTexto: '',
  }
}

export function createEmptyLocalPageConfig() {
  return {
    heroFallbackTitulo: '',
    heroFallbackSubtituloDisponivel: '',
    heroFallbackSubtituloIndisponivel: '',
    secaoPlanosTitulo: '',
    secaoPlanosSubtitulo: '',
    secaoPlanosFaixa1: '',
    secaoPlanosFaixa2: '',
    secaoPlanosFaixa3: '',
    boxFallbackTitulo: '',
    boxFallbackItem1: '',
    boxFallbackItem2: '',
    boxFallbackItem3: '',
    boxFallbackObservacao: '',
    saibaMaisTitulo: '',
    saibaMaisSubtitulo: '',
    saibaMaisItens: [],
  }
}

export function createEmptyCheckoutPageConfig() {
  return {
    kickerPadrao: '',
    tituloPadrao: '',
    subtituloPadrao: '',
    beneficiosTituloPadrao: '',
    beneficiosListaPadrao: [],
    ajudaTituloPadrao: '',
    ajudaTextoPadrao: '',
    confiancaListaPadrao: [],
    resumoKickerPadrao: '',
    resumoTextoPadrao: '',
    precoLabelPadrao: '',
    precoTextoPadrao: '',
    seguroTextoPadrao: '',
  }
}

export function cloneHomePageConfig(config = {}) {
  return {
    ...createEmptyHomePageConfig(),
    ...config,
    faqItens: Array.isArray(config?.faqItens)
      ? config.faqItens.map(item => ({
        pergunta: asString(item?.pergunta),
        resposta: asString(item?.resposta),
      }))
      : [],
  }
}

export function cloneLocalPageConfig(config = {}) {
  return {
    ...createEmptyLocalPageConfig(),
    ...config,
    saibaMaisItens: Array.isArray(config?.saibaMaisItens)
      ? config.saibaMaisItens.map(item => ({
        titulo: asString(item?.titulo),
        copy: asString(item?.copy),
        pontos: Array.isArray(item?.pontos)
          ? item.pontos.map(ponto => asString(ponto))
          : [],
      }))
      : [],
  }
}

export function cloneCheckoutPageConfig(config = {}) {
  return {
    ...createEmptyCheckoutPageConfig(),
    ...config,
    beneficiosListaPadrao: Array.isArray(config?.beneficiosListaPadrao)
      ? config.beneficiosListaPadrao.map(item => asString(item))
      : [],
    confiancaListaPadrao: Array.isArray(config?.confiancaListaPadrao)
      ? config.confiancaListaPadrao.map(item => asString(item))
      : [],
  }
}

export function resolveHomePageConfig(config = {}) {
  const faqItens = normalizeFaqItems(config?.faqItens)

  return {
    heroKicker: asString(config?.heroKicker).trim() || HOME_PAGE_DEFAULTS.heroKicker,
    heroTitulo: asString(config?.heroTitulo).trim() || HOME_PAGE_DEFAULTS.heroTitulo,
    heroSubtitulo: asString(config?.heroSubtitulo).trim() || HOME_PAGE_DEFAULTS.heroSubtitulo,
    heroBotaoPrimarioTexto:
      asString(config?.heroBotaoPrimarioTexto).trim() || HOME_PAGE_DEFAULTS.heroBotaoPrimarioTexto,
    heroBotaoSecundarioTexto:
      asString(config?.heroBotaoSecundarioTexto).trim() || HOME_PAGE_DEFAULTS.heroBotaoSecundarioTexto,
    heroVideoUrl: asString(config?.heroVideoUrl).trim(),
    heroVideoTitulo: asString(config?.heroVideoTitulo).trim() || HOME_PAGE_DEFAULTS.heroVideoTitulo,
    secaoLocaisTitulo:
      asString(config?.secaoLocaisTitulo).trim() || HOME_PAGE_DEFAULTS.secaoLocaisTitulo,
    secaoLocaisSubtitulo:
      asString(config?.secaoLocaisSubtitulo).trim() || HOME_PAGE_DEFAULTS.secaoLocaisSubtitulo,
    faqTitulo: asString(config?.faqTitulo).trim() || HOME_PAGE_DEFAULTS.faqTitulo,
    faqSubtitulo: asString(config?.faqSubtitulo).trim() || HOME_PAGE_DEFAULTS.faqSubtitulo,
    faqItens: faqItens.length ? faqItens : HOME_PAGE_DEFAULTS.faqItens,
    ctaFinalKicker: asString(config?.ctaFinalKicker).trim() || HOME_PAGE_DEFAULTS.ctaFinalKicker,
    ctaFinalTitulo: asString(config?.ctaFinalTitulo).trim() || HOME_PAGE_DEFAULTS.ctaFinalTitulo,
    ctaFinalTexto: asString(config?.ctaFinalTexto).trim() || HOME_PAGE_DEFAULTS.ctaFinalTexto,
    ctaFinalBotaoPrimarioTexto:
      asString(config?.ctaFinalBotaoPrimarioTexto).trim() || HOME_PAGE_DEFAULTS.ctaFinalBotaoPrimarioTexto,
    ctaFinalBotaoSecundarioTexto:
      asString(config?.ctaFinalBotaoSecundarioTexto).trim() || HOME_PAGE_DEFAULTS.ctaFinalBotaoSecundarioTexto,
  }
}

export function resolveLocalPageConfig(config = {}) {
  const saibaMaisItens = normalizeSaibaMaisItems(config?.saibaMaisItens)

  return {
    heroFallbackTitulo:
      asString(config?.heroFallbackTitulo).trim() || LOCAL_PAGE_DEFAULTS.heroFallbackTitulo,
    heroFallbackSubtituloDisponivel:
      asString(config?.heroFallbackSubtituloDisponivel).trim() || LOCAL_PAGE_DEFAULTS.heroFallbackSubtituloDisponivel,
    heroFallbackSubtituloIndisponivel:
      asString(config?.heroFallbackSubtituloIndisponivel).trim() || LOCAL_PAGE_DEFAULTS.heroFallbackSubtituloIndisponivel,
    secaoPlanosTitulo:
      asString(config?.secaoPlanosTitulo).trim() || LOCAL_PAGE_DEFAULTS.secaoPlanosTitulo,
    secaoPlanosSubtitulo:
      asString(config?.secaoPlanosSubtitulo).trim() || LOCAL_PAGE_DEFAULTS.secaoPlanosSubtitulo,
    secaoPlanosFaixa1:
      asString(config?.secaoPlanosFaixa1).trim() || LOCAL_PAGE_DEFAULTS.secaoPlanosFaixa1,
    secaoPlanosFaixa2:
      asString(config?.secaoPlanosFaixa2).trim() || LOCAL_PAGE_DEFAULTS.secaoPlanosFaixa2,
    secaoPlanosFaixa3:
      asString(config?.secaoPlanosFaixa3).trim() || LOCAL_PAGE_DEFAULTS.secaoPlanosFaixa3,
    boxFallbackTitulo:
      asString(config?.boxFallbackTitulo).trim() || LOCAL_PAGE_DEFAULTS.boxFallbackTitulo,
    boxFallbackItem1:
      asString(config?.boxFallbackItem1).trim() || LOCAL_PAGE_DEFAULTS.boxFallbackItem1,
    boxFallbackItem2:
      asString(config?.boxFallbackItem2).trim() || LOCAL_PAGE_DEFAULTS.boxFallbackItem2,
    boxFallbackItem3:
      asString(config?.boxFallbackItem3).trim() || LOCAL_PAGE_DEFAULTS.boxFallbackItem3,
    boxFallbackObservacao:
      asString(config?.boxFallbackObservacao).trim() || LOCAL_PAGE_DEFAULTS.boxFallbackObservacao,
    saibaMaisTitulo:
      asString(config?.saibaMaisTitulo).trim() || LOCAL_PAGE_DEFAULTS.saibaMaisTitulo,
    saibaMaisSubtitulo:
      asString(config?.saibaMaisSubtitulo).trim() || LOCAL_PAGE_DEFAULTS.saibaMaisSubtitulo,
    saibaMaisItens: saibaMaisItens.length ? saibaMaisItens : LOCAL_PAGE_DEFAULTS.saibaMaisItens,
  }
}

export function resolveCheckoutPageConfig(config = {}) {
  const beneficios = normalizeStringList(config?.beneficiosListaPadrao)
  const confianca = normalizeStringList(config?.confiancaListaPadrao)

  return {
    kickerPadrao: asString(config?.kickerPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.kickerPadrao,
    tituloPadrao: asString(config?.tituloPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.tituloPadrao,
    subtituloPadrao: asString(config?.subtituloPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.subtituloPadrao,
    beneficiosTituloPadrao:
      asString(config?.beneficiosTituloPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.beneficiosTituloPadrao,
    beneficiosListaPadrao: beneficios.length ? beneficios : CHECKOUT_PAGE_DEFAULTS.beneficiosListaPadrao,
    ajudaTituloPadrao:
      asString(config?.ajudaTituloPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.ajudaTituloPadrao,
    ajudaTextoPadrao:
      asString(config?.ajudaTextoPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.ajudaTextoPadrao,
    confiancaListaPadrao: confianca.length ? confianca : CHECKOUT_PAGE_DEFAULTS.confiancaListaPadrao,
    resumoKickerPadrao:
      asString(config?.resumoKickerPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.resumoKickerPadrao,
    resumoTextoPadrao:
      asString(config?.resumoTextoPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.resumoTextoPadrao,
    precoLabelPadrao:
      asString(config?.precoLabelPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.precoLabelPadrao,
    precoTextoPadrao:
      asString(config?.precoTextoPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.precoTextoPadrao,
    seguroTextoPadrao:
      asString(config?.seguroTextoPadrao).trim() || CHECKOUT_PAGE_DEFAULTS.seguroTextoPadrao,
  }
}

export function interpolateSiteText(template, context = {}) {
  return String(template || '')
    .replaceAll('{local}', asString(context.local))
    .replaceAll('{cidade}', asString(context.cidade))
    .replaceAll('{descricao}', asString(context.descricao))
    .replaceAll('{mensagem}', asString(context.mensagem))
    .replaceAll('{plano}', asString(context.plano))
    .replaceAll('{duracao}', asString(context.duracao))
    .replaceAll('{preco}', asString(context.preco))
    .replaceAll(/\s+/g, ' ')
    .trim()
}
