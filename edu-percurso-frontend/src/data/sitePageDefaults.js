export const HOME_PAGE_DEFAULTS = {
  heroKicker: 'Preparacao pratica por local de prova',
  heroTitulo: 'Descubra os percursos mais frequentes da sua prova pratica.',
  heroSubtitulo:
    'Prepare-se com mais confianca usando videos reais, simulacoes e orientacoes baseadas nos trajetos mais recorrentes e no que mais pesa na avaliacao.',
  heroBotaoPrimarioTexto: 'Escolher meu local de prova',
  heroBotaoSecundarioTexto: 'Ver como funciona',
  heroVideoUrl: '',
  heroVideoTitulo: 'Demonstracao da plataforma',
  secaoLocaisTitulo: 'Escolha seu local de prova',
  secaoLocaisSubtitulo:
    'Temos o mapeamento dos principais polos ja disponiveis. Encontre o seu e comece a estudar com mais criterio.',
  faqTitulo: 'Duvidas comuns antes da compra',
  faqSubtitulo:
    'Abra apenas o que voce quiser consultar e mantenha a pagina mais leve para navegar.',
  faqItens: [
    {
      pergunta: 'Como funciona a plataforma?',
      resposta:
        'Voce escolhe o local da sua prova, libera o acesso e revisa os percursos mais frequentes, pontos de atencao e modulos praticos antes do exame.',
    },
    {
      pergunta: 'Isso garante o trajeto exato da minha prova?',
      resposta:
        'Nao. O foco e mostrar os percursos mais frequentes observados na pratica para voce chegar menos surpreso e mais preparado.',
    },
    {
      pergunta: 'Comprei um local. Tenho acesso aos outros?',
      resposta:
        'Cada compra libera apenas um local de prova, pelo periodo escolhido. Se quiser outro local, a compra e separada.',
    },
    {
      pergunta: 'O que acontece depois do pagamento?',
      resposta:
        'Assim que o Mercado Pago confirma o pagamento, o acesso e liberado automaticamente na sua conta.',
    },
  ],
  ctaFinalKicker: 'Comece pelo seu local',
  ctaFinalTitulo: 'Quanto antes voce estudar o padrao da prova, mais seguro chega no dia.',
  ctaFinalTexto:
    'Escolha o local de prova, veja o que ja esta liberado e comece a revisar com mais criterio, menos ansiedade e mais confianca.',
  ctaFinalBotaoPrimarioTexto: 'Ver locais liberados',
  ctaFinalBotaoSecundarioTexto: 'Criar conta e acompanhar',
}

export const LOCAL_PAGE_DEFAULTS = {
  heroFallbackTitulo: 'Prepare-se melhor para a prova em {local}.',
  heroFallbackSubtituloDisponivel:
    'Escolha o periodo que combina melhor com sua data de prova e com o ritmo em que voce quer revisar.',
  heroFallbackSubtituloIndisponivel: '{descricao} {mensagem}',
  secaoPlanosTitulo: 'Escolha o tempo certo para estudar esse local',
  secaoPlanosSubtitulo:
    'Compare duracao, contexto e preco antes de seguir para o checkout.',
  secaoPlanosFaixa1: 'Pagamento unico',
  secaoPlanosFaixa2: 'Liberacao automatica apos a confirmacao',
  secaoPlanosFaixa3: '1 local por compra',
  boxFallbackTitulo: 'O que voce vai encontrar neste acesso',
  boxFallbackItem1: 'Percursos mais frequentes e simulacao da prova',
  boxFallbackItem2: 'Baliza, embreagem e erros que mais tiram pontos',
  boxFallbackItem3: 'Acesso organizado para revisar no seu ritmo',
  boxFallbackObservacao:
    'O acesso aparece automaticamente na sua conta assim que o pagamento for confirmado.',
  saibaMaisTitulo: 'Saiba mais sobre esse acesso',
  saibaMaisSubtitulo:
    'Abra apenas os detalhes que voce quiser consultar depois de olhar os planos.',
  saibaMaisItens: [
    {
      titulo: 'O que voce vai encontrar',
      copy:
        'Esse acesso foi organizado para mostrar o que mais ajuda antes da prova, sem excesso de informacao aberta de uma vez.',
      pontos: [
        'Percursos mais frequentes e simulacao da prova',
        'Baliza, embreagem e erros que mais tiram pontos',
      ],
    },
    {
      titulo: 'Como isso ajuda no dia da prova',
      copy:
        'O foco nao e decorar rua. E dirigir com mais leitura, menos surpresa e mais criterio durante a avaliacao.',
      pontos: [
        'Menos surpresa ao entender como a prova costuma acontecer',
        'Mais leitura da avaliacao para saber o que exige mais atencao',
        'Mais confianca para dirigir com calma, criterio e preparo',
      ],
    },
    {
      titulo: 'Compra e liberacao',
      copy:
        'A compra e simples e o acesso aparece automaticamente assim que o pagamento e confirmado.',
      pontos: [
        'Compra unica sem renovacao automatica',
        'Pagamento por Pix ou cartao via Mercado Pago',
        'Liberacao automatica apos a confirmacao',
      ],
    },
  ],
}

export const CHECKOUT_PAGE_DEFAULTS = {
  kickerPadrao: 'Revise seu acesso antes de pagar',
  tituloPadrao: 'Voce esta a um passo de liberar o material do seu local de prova.',
  subtituloPadrao:
    'Revise o que esta incluido, confirme o periodo escolhido e siga para o pagamento com mais clareza.',
  beneficiosTituloPadrao: 'O que voce vai receber',
  beneficiosListaPadrao: [
    'Percursos mais frequentes do local',
    'Pontos de atencao nos trechos mais importantes',
    'Videos e apoios explicativos',
    'Baliza, embreagem e revisao pratica',
  ],
  ajudaTituloPadrao: 'Como isso ajuda antes da prova',
  ajudaTextoPadrao:
    'O objetivo nao e decorar rua. E chegar mais preparado para entender o padrao da avaliacao, reduzir surpresa e dirigir com mais criterio no dia da prova.',
  confiancaListaPadrao: [
    'Liberacao automatica apos a confirmacao',
    'Pagamento processado com seguranca pelo Mercado Pago',
    'O acesso aparece na sua biblioteca assim que o pagamento for aprovado',
  ],
  resumoKickerPadrao: 'Resumo da compra',
  resumoTextoPadrao: 'Material do local de prova com acesso por {duracao}.',
  precoLabelPadrao: 'Total',
  precoTextoPadrao: 'Pagamento unico pelo periodo escolhido',
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
