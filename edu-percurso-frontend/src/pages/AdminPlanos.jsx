import { useEffect, useMemo, useState } from 'react'
import { CHECKOUT_PAGE_DEFAULTS, interpolateSiteText, resolveCheckoutPageConfig } from '../data/sitePageDefaults'
import { configuracaoSiteService, localProvaService, planoService, trilhaService } from '../services/api'
import { useToast } from '../hooks/useToast'
import { formatPlanoDuracao, formatTrilhaPlano } from '../utils/formatters'

const VAZIO = {
  localProvaId: '',
  trilhaId: '',
  nome: '',
  duracaoDias: 30,
  precoReais: '99,00',
  ativo: true,
  usarCheckoutPersonalizado: false,
  checkoutKicker: '',
  checkoutTitulo: '',
  checkoutSubtitulo: '',
  checkoutBeneficiosTitulo: '',
  checkoutBeneficiosTexto: '',
  checkoutAjudaTitulo: '',
  checkoutAjudaTexto: '',
  checkoutConfiancaTexto: '',
  checkoutResumoKicker: '',
  checkoutResumoTexto: '',
  checkoutPrecoLabel: '',
  checkoutPrecoTexto: '',
  checkoutSeguroTexto: '',
  vitrineSelo: '',
  vitrineResumo: '',
  vitrineTexto: '',
  vitrineMeta: '',
  vitrineRecomendada: 'AUTO',
}

const CHECKOUT_VARIAVEIS = '{local}, {plano}, {duracao}, {preco}'

function fmtMoeda(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((centavos || 0) / 100)
}

function centavosParaReais(centavos) {
  return ((centavos || 0) / 100).toFixed(2).replace('.', ',')
}

function reaisParaCentavos(valor) {
  const texto = String(valor || '').trim()
  if (!texto) return NaN

  let normalizado = texto.replace(/[^\d,.-]/g, '')
  if (normalizado.includes(',')) {
    normalizado = normalizado.replace(/\./g, '').replace(',', '.')
  } else {
    const partes = normalizado.split('.')
    if (partes.length > 2) {
      normalizado = `${partes.slice(0, -1).join('')}.${partes.at(-1)}`
    }
  }

  const numero = Number(normalizado)
  if (!Number.isFinite(numero)) return NaN
  return Math.round(numero * 100)
}

function parseLinhasCheckout(texto, fallback, contexto) {
  const valor = String(texto || '').trim()
  if (!valor) return fallback

  const linhas = valor
    .split('\n')
    .map(item => interpolateSiteText(item.trim(), contexto))
    .filter(Boolean)

  return linhas.length ? linhas : fallback
}

function getCheckoutPadrao(checkoutPageDefaults) {
  return {
    kicker: checkoutPageDefaults.kickerPadrao,
    titulo: checkoutPageDefaults.tituloPadrao,
    subtitulo: checkoutPageDefaults.subtituloPadrao,
    beneficiosTitulo: checkoutPageDefaults.beneficiosTituloPadrao,
    beneficios: checkoutPageDefaults.beneficiosListaPadrao,
    ajudaTitulo: checkoutPageDefaults.ajudaTituloPadrao,
    ajudaTexto: checkoutPageDefaults.ajudaTextoPadrao,
    confianca: checkoutPageDefaults.confiancaListaPadrao,
    resumoKicker: checkoutPageDefaults.resumoKickerPadrao,
    resumoTexto: checkoutPageDefaults.resumoTextoPadrao,
    precoLabel: checkoutPageDefaults.precoLabelPadrao,
    precoTexto: checkoutPageDefaults.precoTextoPadrao,
    seguroTexto: checkoutPageDefaults.seguroTextoPadrao,
  }
}

function getCheckoutPadraoPorTrilha(checkoutPageDefaults, trilhaCodigo) {
  const base = getCheckoutPadrao(checkoutPageDefaults)

  if (trilhaCodigo === 'comecando_do_zero') {
    return {
      ...base,
      kicker: 'Jornada completa para sua aprovacao',
      titulo: 'Comece do zero com um plano que organiza sua jornada ate a prova',
      subtitulo: 'Esse plano foi pensado para quem quer entender os primeiros passos, ganhar seguranca e chegar mais preparado no dia da prova.',
      beneficiosTitulo: 'O que esse plano ajuda voce a construir',
      beneficios: [
        'Entender o caminho desde o inicio, sem ficar perdido',
        'Avancar pela jornada com mais clareza e menos ansiedade',
        'Revisar os percursos e os pontos que mais geram inseguranca',
      ],
      ajudaTitulo: 'Para quem esse plano faz mais sentido',
      ajudaTexto: 'Ideal para quem esta comecando agora, quer um caminho guiado e prefere estudar com mais contexto antes da prova.',
      confianca: [
        'Plano pensado para quem quer mais orientacao desde o inicio',
        'Acesso para estudar no seu ritmo e voltar quantas vezes precisar',
        'Jornada organizada para chegar na prova com mais confianca',
      ],
      resumoKicker: 'Plano indicado para quem quer comecar do zero',
      resumoTexto: 'Voce recebe um plano pensado para acompanhar sua jornada desde os primeiros passos ate a reta final da prova.',
      precoLabel: 'Investimento para a jornada completa',
      precoTexto: 'Pagamento unico para o periodo escolhido',
      seguroTexto: 'Compra segura para quem quer estudar com mais direcao desde o inicio.',
    }
  }

  if (trilhaCodigo === 'reta_final_prova') {
    return {
      ...base,
      kicker: 'Foco total na reta final da prova',
      titulo: 'Revise com mais estrategia e chegue mais seguro para a prova pratica',
      subtitulo: 'Esse plano foi pensado para quem ja passou pelas etapas iniciais e quer concentrar o estudo em pratica, percurso e revisao final.',
      beneficiosTitulo: 'O que esse plano ajuda voce a afiar agora',
      beneficios: [
        'Rever os percursos reais do local de prova',
        'Treinar os pontos de atencao e as pegadinhas mais importantes',
        'Chegar no dia da prova com a revisao mais objetiva',
      ],
      ajudaTitulo: 'Para quem esse plano faz mais sentido',
      ajudaTexto: 'Ideal para quem ja esta na pratica ou perto da prova e quer uma revisao mais direta, sem voltar para as etapas iniciais.',
      confianca: [
        'Plano focado em revisao pratica e reta final',
        'Acesso para rever percurso, pegadinhas e pontos de atencao',
        'Jornada mais objetiva para chegar mais afiado no dia da prova',
      ],
      resumoKicker: 'Plano indicado para a reta final',
      resumoTexto: 'Voce recebe um plano focado no que mais pesa agora: percurso, pegadinhas, revisao e confianca para o dia da prova.',
      precoLabel: 'Investimento para a reta final',
      precoTexto: 'Pagamento unico para o periodo escolhido',
      seguroTexto: 'Compra segura para quem quer revisar com foco na etapa final da prova.',
    }
  }

  return base
}

function getCheckoutBlocosPadrao(checkoutPageDefaults, trilhaCodigo) {
  const defaults = getCheckoutPadraoPorTrilha(checkoutPageDefaults, trilhaCodigo)

  return {
    hero: {
      checkoutKicker: defaults.kicker,
      checkoutTitulo: defaults.titulo,
      checkoutSubtitulo: defaults.subtitulo,
    },
    beneficios: {
      checkoutBeneficiosTitulo: defaults.beneficiosTitulo,
      checkoutBeneficiosTexto: defaults.beneficios.join('\n'),
    },
    apoio: {
      checkoutAjudaTitulo: defaults.ajudaTitulo,
      checkoutAjudaTexto: defaults.ajudaTexto,
    },
    confianca: {
      checkoutConfiancaTexto: defaults.confianca.join('\n'),
    },
    resumo: {
      checkoutResumoKicker: defaults.resumoKicker,
      checkoutResumoTexto: defaults.resumoTexto,
      checkoutPrecoLabel: defaults.precoLabel,
      checkoutPrecoTexto: defaults.precoTexto,
      checkoutSeguroTexto: defaults.seguroTexto,
    },
  }
}

function getVitrinePadraoNeutro(duracaoDias) {
  if (duracaoDias <= 30) {
    return {
      selo: 'Para comecar agora',
      resumo: 'Bom para quem quer revisar logo antes da prova.',
      texto: 'Ideal para quem vai fazer a prova em breve.',
      meta: 'Pagamento unico pelo periodo escolhido',
      recomendada: false,
    }
  }

  if (duracaoDias <= 90) {
    return {
      selo: 'Melhor equilibrio',
      resumo: 'Tempo bom para revisar com calma e voltar quando precisar.',
      texto: 'Bom para revisar com calma nas proximas semanas.',
      meta: 'Pagamento unico pelo periodo escolhido',
      recomendada: true,
    }
  }

  if (duracaoDias <= 180) {
    return {
      selo: 'Mais tempo de preparo',
      resumo: 'Ideal para quem quer estudar com mais folga e repetir o conteudo.',
      texto: 'Mais tempo para praticar, revisar e voltar quando precisar.',
      meta: 'Pagamento unico pelo periodo escolhido',
      recomendada: false,
    }
  }

  return {
    selo: 'Preparacao estendida',
    resumo: 'Acesso longo para quem prefere deixar o conteudo sempre disponivel.',
    texto: 'Acesso mais longo para uma preparacao estendida.',
    meta: 'Pagamento unico pelo periodo escolhido',
    recomendada: false,
  }
}

function getVitrinePadrao(trilhaCodigo, duracaoDias) {
  const base = getVitrinePadraoNeutro(duracaoDias)

  if (trilhaCodigo === 'comecando_do_zero') {
    if (duracaoDias <= 30) {
      return {
        selo: 'Comeco guiado',
        resumo: 'Bom para quem quer sair do zero e ja entrar com direcao na jornada ate a prova.',
        texto: 'Ideal para quem esta comecando agora e quer entender os primeiros passos sem se perder.',
        meta: 'Jornada guiada desde o inicio pelo periodo escolhido',
        recomendada: false,
      }
    }

    if (duracaoDias <= 90) {
      return {
        selo: 'Jornada completa',
        resumo: 'Tempo equilibrado para comecar do zero, praticar com calma e chegar mais seguro na prova.',
        texto: 'Otimo para quem quer acompanhar a jornada completa, da preparacao inicial ate a revisao final.',
        meta: 'Plano pensado para quem quer seguir a trilha completa',
        recomendada: true,
      }
    }

    return {
      selo: 'Comeco com folga',
      resumo: 'Mais tempo para organizar cada etapa, repetir aulas e voltar quando precisar.',
      texto: 'Ideal para quem quer fazer a jornada completa com mais folga e revisar varias vezes.',
      meta: 'Mais tempo para uma jornada completa sem pressa',
      recomendada: false,
    }
  }

  if (trilhaCodigo === 'reta_final_prova') {
    if (duracaoDias <= 30) {
      return {
        selo: 'Reta final',
        resumo: 'Bom para quem ja resolveu as etapas iniciais e quer focar agora na prova pratica.',
        texto: 'Ideal para revisar percurso, pegadinhas e chegar mais afiado para o dia da prova.',
        meta: 'Foco na reta final pelo periodo escolhido',
        recomendada: true,
      }
    }

    if (duracaoDias <= 90) {
      return {
        selo: 'Revisao com calma',
        resumo: 'Mais tempo para praticar, rever os percursos e repetir os pontos mais criticos.',
        texto: 'Otimo para quem ja esta na pratica e quer revisar com mais calma antes da prova.',
        meta: 'Plano de reta final com mais tempo para revisar',
        recomendada: false,
      }
    }

    return {
      selo: 'Acesso estendido',
      resumo: 'Tempo extra para quem prefere manter a reta final disponivel e revisar sempre que precisar.',
      texto: 'Mais tempo para revisar percurso, pegadinhas e pratica sem pressa.',
      meta: 'Reta final estendida pelo periodo escolhido',
      recomendada: false,
    }
  }

  return base
}

function getPosicionamentoTrilha(trilhaCodigo, trilhaNome) {
  if (trilhaCodigo === 'comecando_do_zero') {
    return {
      titulo: 'Plano para quem quer comecar do zero',
      copy: 'Na vitrine, deixe claro que esse plano acompanha desde os primeiros passos ate a prova. Evite uma copy que pareca so revisao final.',
    }
  }

  if (trilhaCodigo === 'reta_final_prova') {
    return {
      titulo: 'Plano para quem ja esta na reta final',
      copy: 'Na vitrine, destaque pratica, percurso, pegadinhas e revisao. Evite vender como jornada completa desde o inicio.',
    }
  }

  return {
    titulo: `Plano da trilha ${formatTrilhaPlano(trilhaNome, trilhaCodigo)}`,
    copy: 'A copy comercial deve refletir o momento do aluno que esse plano atende.',
  }
}

function getPosicionamentoCheckoutTrilha(trilhaCodigo, trilhaNome) {
  if (trilhaCodigo === 'comecando_do_zero') {
    return {
      titulo: 'Checkout para quem ainda esta construindo a jornada',
      copy: 'Na revisao antes de pagar, vale reforcar seguranca, orientacao e a ideia de caminho completo ate a prova.',
    }
  }

  if (trilhaCodigo === 'reta_final_prova') {
    return {
      titulo: 'Checkout para quem quer acelerar a reta final',
      copy: 'Na revisao antes de pagar, vale reforcar praticidade, revisao objetiva e foco no que mais pesa perto da prova.',
    }
  }

  return {
    titulo: `Checkout da trilha ${formatTrilhaPlano(trilhaNome, trilhaCodigo)}`,
    copy: 'A copy do checkout deve conversar com o momento do aluno que esse plano atende.',
  }
}

function boolSelectParaValor(valor) {
  if (valor === true) return 'SIM'
  if (valor === false) return 'NAO'
  return 'AUTO'
}

function valorParaBoolSelect(valor) {
  if (valor === 'SIM') return true
  if (valor === 'NAO') return false
  return null
}

function temTextoPersonalizado(plano) {
  return Boolean(
    plano.checkoutKicker ||
    plano.checkoutTitulo ||
    plano.checkoutSubtitulo ||
    plano.checkoutBeneficiosTitulo ||
    plano.checkoutBeneficiosTexto ||
    plano.checkoutAjudaTitulo ||
    plano.checkoutAjudaTexto ||
    plano.checkoutConfiancaTexto ||
    plano.checkoutResumoKicker ||
    plano.checkoutResumoTexto ||
    plano.checkoutPrecoLabel ||
    plano.checkoutPrecoTexto ||
    plano.checkoutSeguroTexto
  )
}

function temVitrinePersonalizada(plano) {
  return Boolean(
    plano.vitrineSelo ||
    plano.vitrineResumo ||
    plano.vitrineTexto ||
    plano.vitrineMeta ||
    typeof plano.vitrineRecomendada === 'boolean'
  )
}

export default function AdminPlanos() {
  const [locais, setLocais] = useState([])
  const [planos, setPlanos] = useState([])
  const [trilhas, setTrilhas] = useState([])
  const [configCheckout, setConfigCheckout] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [edicaoId, setEdicaoId] = useState(null)
  const [previewModo, setPreviewModo] = useState('desktop')
  const [previewTema, setPreviewTema] = useState('escuro')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const { show, ToastEl } = useToast()

  useEffect(() => {
    Promise.allSettled([
      localProvaService.listar({ todos: true }),
      planoService.listar({ todos: true }),
      trilhaService.listarAdmin(),
      configuracaoSiteService.buscarAdmin(),
    ])
      .then(([locaisResp, planosResp, trilhasResp, configResp]) => {
        const locaisLista = locaisResp.status === 'fulfilled' ? locaisResp.value : []
        const planosLista = planosResp.status === 'fulfilled' ? planosResp.value : []
        const trilhasLista = trilhasResp.status === 'fulfilled' ? trilhasResp.value : []

        setLocais(locaisLista)
        setPlanos(planosLista)
        setTrilhas(trilhasLista)
        setConfigCheckout(configResp.status === 'fulfilled' ? configResp.value?.checkout || null : null)

        if ((!form.localProvaId && locaisLista[0]) || (!form.trilhaId && trilhasLista[0])) {
          setForm(current => ({
            ...current,
            localProvaId: current.localProvaId || locaisLista[0]?.id || '',
            trilhaId: current.trilhaId || trilhasLista[0]?.id || '',
          }))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const locaisMap = useMemo(() => new Map(locais.map(local => [local.id, local])), [locais])
  const localSelecionado = useMemo(() => locaisMap.get(form.localProvaId) || null, [form.localProvaId, locaisMap])
  const trilhaSelecionada = useMemo(() => trilhas.find(item => item.id === form.trilhaId) || null, [form.trilhaId, trilhas])
  const planosOrdenados = useMemo(
    () => [...planos].sort((a, b) => {
      const nomeLocalA = (a.localProvaNome || locaisMap.get(a.localProvaId)?.nome || '').toLowerCase()
      const nomeLocalB = (b.localProvaNome || locaisMap.get(b.localProvaId)?.nome || '').toLowerCase()
      if (nomeLocalA !== nomeLocalB) return nomeLocalA.localeCompare(nomeLocalB)
      return (a.duracaoDias || 0) - (b.duracaoDias || 0)
    }),
    [locaisMap, planos]
  )
  const planosFiltrados = useMemo(
    () => planosOrdenados,
    [planosOrdenados]
  )
  const resumoClassificacao = useMemo(() => ({ total: planos.length }), [planos])
  const vitrineDefaults = useMemo(
    () => getVitrinePadrao(trilhaSelecionada?.codigo, Number(form.duracaoDias) || 0),
    [form.duracaoDias, trilhaSelecionada?.codigo]
  )
  const vitrineDefaultsNeutro = useMemo(
    () => getVitrinePadraoNeutro(Number(form.duracaoDias) || 0),
    [form.duracaoDias]
  )
  const posicionamentoTrilha = useMemo(
    () => getPosicionamentoTrilha(trilhaSelecionada?.codigo, trilhaSelecionada?.nome),
    [trilhaSelecionada?.codigo, trilhaSelecionada?.nome]
  )
  const checkoutPageDefaults = useMemo(
    () => resolveCheckoutPageConfig(configCheckout || CHECKOUT_PAGE_DEFAULTS),
    [configCheckout]
  )
  const checkoutDefaults = useMemo(
    () => getCheckoutPadraoPorTrilha(checkoutPageDefaults, trilhaSelecionada?.codigo),
    [checkoutPageDefaults, trilhaSelecionada?.codigo]
  )
  const posicionamentoCheckout = useMemo(
    () => getPosicionamentoCheckoutTrilha(trilhaSelecionada?.codigo, trilhaSelecionada?.nome),
    [trilhaSelecionada?.codigo, trilhaSelecionada?.nome]
  )
  const checkoutPreview = useMemo(() => {
    const precoCentavos = reaisParaCentavos(form.precoReais)
    const contexto = {
      local: localSelecionado?.nome || 'Local de prova',
      plano: form.nome?.trim() || 'Plano',
      duracao: formatPlanoDuracao(Number(form.duracaoDias) || 0),
      preco: fmtMoeda(Number.isFinite(precoCentavos) ? precoCentavos : 0),
    }
    const usarCustom = Boolean(form.usarCheckoutPersonalizado)
    const obterTexto = (valor, fallback) => {
      if (!usarCustom || !String(valor || '').trim()) return interpolateSiteText(fallback, contexto)
      return interpolateSiteText(valor, contexto)
    }

    return {
      kicker: obterTexto(form.checkoutKicker, checkoutDefaults.kicker),
      titulo: obterTexto(form.checkoutTitulo, checkoutDefaults.titulo),
      subtitulo: obterTexto(form.checkoutSubtitulo, checkoutDefaults.subtitulo),
      beneficiosTitulo: obterTexto(form.checkoutBeneficiosTitulo, checkoutDefaults.beneficiosTitulo),
      beneficios: parseLinhasCheckout(form.checkoutBeneficiosTexto, checkoutDefaults.beneficios, contexto),
      ajudaTitulo: obterTexto(form.checkoutAjudaTitulo, checkoutDefaults.ajudaTitulo),
      ajudaTexto: obterTexto(form.checkoutAjudaTexto, checkoutDefaults.ajudaTexto),
      confianca: parseLinhasCheckout(form.checkoutConfiancaTexto, checkoutDefaults.confianca, contexto),
      resumoKicker: obterTexto(form.checkoutResumoKicker, checkoutDefaults.resumoKicker),
      resumoTexto: obterTexto(form.checkoutResumoTexto, checkoutDefaults.resumoTexto),
      precoLabel: obterTexto(form.checkoutPrecoLabel, checkoutDefaults.precoLabel),
      precoTexto: obterTexto(form.checkoutPrecoTexto, checkoutDefaults.precoTexto),
      seguroTexto: obterTexto(form.checkoutSeguroTexto, checkoutDefaults.seguroTexto),
      precoCentavos: Number.isFinite(precoCentavos) ? precoCentavos : 0,
      contexto,
    }
  }, [checkoutDefaults, checkoutPageDefaults, form, localSelecionado])

  async function recarregarPlanos() {
    setPlanos(await planoService.listar({ todos: true }))
  }

  function editar(plano) {
    setEdicaoId(plano.id)
    setForm({
      localProvaId: plano.localProvaId,
      trilhaId: plano.trilhaId || '',
      nome: plano.nome,
      duracaoDias: plano.duracaoDias,
      precoReais: centavosParaReais(plano.precoCentavos),
      ativo: plano.ativo,
      usarCheckoutPersonalizado: plano.usarCheckoutPersonalizado ?? false,
      checkoutKicker: plano.checkoutKicker || '',
      checkoutTitulo: plano.checkoutTitulo || '',
      checkoutSubtitulo: plano.checkoutSubtitulo || '',
      checkoutBeneficiosTitulo: plano.checkoutBeneficiosTitulo || '',
      checkoutBeneficiosTexto: plano.checkoutBeneficiosTexto || '',
      checkoutAjudaTitulo: plano.checkoutAjudaTitulo || '',
      checkoutAjudaTexto: plano.checkoutAjudaTexto || '',
      checkoutConfiancaTexto: plano.checkoutConfiancaTexto || '',
      checkoutResumoKicker: plano.checkoutResumoKicker || '',
      checkoutResumoTexto: plano.checkoutResumoTexto || '',
      checkoutPrecoLabel: plano.checkoutPrecoLabel || '',
      checkoutPrecoTexto: plano.checkoutPrecoTexto || '',
      checkoutSeguroTexto: plano.checkoutSeguroTexto || '',
      vitrineSelo: plano.vitrineSelo || '',
      vitrineResumo: plano.vitrineResumo || '',
      vitrineTexto: plano.vitrineTexto || '',
      vitrineMeta: plano.vitrineMeta || '',
      vitrineRecomendada: boolSelectParaValor(plano.vitrineRecomendada),
    })
  }

  function resetar() {
    setEdicaoId(null)
    setForm({
      ...VAZIO,
      localProvaId: locais[0]?.id || '',
      trilhaId: trilhas[0]?.id || '',
    })
    setPreviewModo('desktop')
    setPreviewTema('escuro')
  }

  function copiarBlocoPadrao(bloco, modo = 'trilha') {
    const codigoTrilha = modo === 'trilha' ? trilhaSelecionada?.codigo : null
    const valores = getCheckoutBlocosPadrao(checkoutPageDefaults, codigoTrilha)[bloco]
    if (!valores) return

    setForm(current => ({
      ...current,
      ...valores,
    }))
  }

  function aplicarSugestaoCheckout(modo = 'trilha') {
    const codigoTrilha = modo === 'trilha' ? trilhaSelecionada?.codigo : null
    const blocos = getCheckoutBlocosPadrao(checkoutPageDefaults, codigoTrilha)

    setForm(current => ({
      ...current,
      ...blocos.hero,
      ...blocos.beneficios,
      ...blocos.apoio,
      ...blocos.confianca,
      ...blocos.resumo,
    }))
  }

  async function salvar(event) {
    event.preventDefault()

    if (!form.trilhaId) {
      show('Selecione o perfil da jornada deste plano.', 'error')
      return
    }

    setSalvando(true)

    try {
      const precoCentavos = reaisParaCentavos(form.precoReais)
      if (!Number.isFinite(precoCentavos) || precoCentavos < 0) {
        throw new Error('Informe um preco valido em reais.')
      }

      const payload = {
        ...form,
        duracaoDias: Number(form.duracaoDias),
        precoCentavos,
        vitrineRecomendada: valorParaBoolSelect(form.vitrineRecomendada),
      }
      delete payload.precoReais

      if (edicaoId) {
        await planoService.atualizar(edicaoId, payload)
        show('Plano atualizado com sucesso.')
      } else {
        await planoService.criar(payload)
        show('Plano criado com sucesso.')
      }

      resetar()
      await recarregarPlanos()
    } catch (error) {
      show(error.response?.data?.erro || error.message || 'Erro ao salvar plano.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(plano) {
    if (!confirm(`Excluir o plano "${plano.nome}"?`)) return

    try {
      await planoService.excluir(plano.id)
      show('Plano excluido com sucesso.')
      if (edicaoId === plano.id) resetar()
      await recarregarPlanos()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao excluir plano.', 'error')
    }
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Planos</div>
      <p className="page-sub">Gerencie duracao, preco, copy de checkout e vitrine comercial de cada plano.</p>

      <div className="admin-grid admin-grid--planos">
        <div className="card">
          <div className="section-heading">{edicaoId ? 'Editar plano' : 'Novo plano'}</div>
          <form onSubmit={salvar} style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Local de prova</label>
              <select className="form-select" value={form.localProvaId} onChange={event => setForm(current => ({ ...current, localProvaId: event.target.value }))}>
                {locais.map(local => (
                  <option key={local.id} value={local.id}>{local.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Perfil da jornada</label>
              <select className="form-select" value={form.trilhaId} onChange={event => setForm(current => ({ ...current, trilhaId: event.target.value }))}>
                <option value="">Selecione o perfil</option>
                {trilhas.map(trilha => (
                  <option key={trilha.id} value={trilha.id}>{trilha.nome}</option>
                ))}
              </select>
              <div className="mini-copy">
                Esse perfil ajusta os textos comerciais e ajuda a apresentar a jornada, sem limitar os conteudos do plano.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" value={form.nome} onChange={event => setForm(current => ({ ...current, nome: event.target.value }))} required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duracao em dias</label>
                <input className="form-input" type="number" min="1" value={form.duracaoDias} onChange={event => setForm(current => ({ ...current, duracaoDias: event.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Preco em reais</label>
                <input
                  className="form-input"
                  inputMode="decimal"
                  placeholder="Ex.: 99,90"
                  value={form.precoReais}
                  onChange={event => setForm(current => ({ ...current, precoReais: event.target.value }))}
                  required
                />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: '1rem' }}>
              <input type="checkbox" checked={form.ativo} onChange={event => setForm(current => ({ ...current, ativo: event.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <span className="form-label" style={{ margin: 0 }}>Plano ativo</span>
            </label>

            <div className="checkout-admin-block">
              <div className="checkout-admin-block-head">
                <div>
                  <div className="section-heading" style={{ fontSize: 18 }}>Vitrine do plano na pagina do local</div>
                  <div className="section-copy">
                    Esses textos aparecem no card do plano antes do checkout. Se voce deixar vazio, o site usa a sugestao automatica considerando trilha e duracao.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setForm(current => ({
                      ...current,
                      vitrineSelo: vitrineDefaults.selo,
                      vitrineResumo: vitrineDefaults.resumo,
                      vitrineTexto: vitrineDefaults.texto,
                      vitrineMeta: vitrineDefaults.meta,
                      vitrineRecomendada: boolSelectParaValor(vitrineDefaults.recomendada),
                    }))}
                  >
                    Aplicar sugestao da trilha
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setForm(current => ({
                      ...current,
                      vitrineSelo: vitrineDefaultsNeutro.selo,
                      vitrineResumo: vitrineDefaultsNeutro.resumo,
                      vitrineTexto: vitrineDefaultsNeutro.texto,
                      vitrineMeta: vitrineDefaultsNeutro.meta,
                      vitrineRecomendada: boolSelectParaValor(vitrineDefaultsNeutro.recomendada),
                    }))}
                  >
                    Usar sugestao neutra
                  </button>
                </div>
              </div>

              <div className="admin-inline-check" style={{ marginBottom: '1rem' }}>
                <strong>{posicionamentoTrilha.titulo}</strong>
                <span> {posicionamentoTrilha.copy}</span>
              </div>

              <div className="admin-inline-note" style={{ marginBottom: '1rem' }}>
                <strong>Sugestao atual:</strong>
                <span>
                  {' '}
                  selo "{vitrineDefaults.selo}", resumo "{vitrineDefaults.resumo}" e texto principal pensado para {trilhaSelecionada?.nome || 'a trilha selecionada'}.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Selo do card</label>
                <input className="form-input" value={form.vitrineSelo} onChange={event => setForm(current => ({ ...current, vitrineSelo: event.target.value }))} placeholder={`Ex.: ${vitrineDefaults.selo}`} />
              </div>

              <div className="form-group">
                <label className="form-label">Resumo acima do carrossel</label>
                <input className="form-input" value={form.vitrineResumo} onChange={event => setForm(current => ({ ...current, vitrineResumo: event.target.value }))} placeholder={`Ex.: ${vitrineDefaults.resumo}`} />
              </div>

              <div className="form-group">
                <label className="form-label">Texto principal do card</label>
                <textarea className="form-textarea" value={form.vitrineTexto} onChange={event => setForm(current => ({ ...current, vitrineTexto: event.target.value }))} placeholder={`Ex.: ${vitrineDefaults.texto}`} />
              </div>

              <div className="form-group">
                <label className="form-label">Texto auxiliar do card</label>
                <input className="form-input" value={form.vitrineMeta} onChange={event => setForm(current => ({ ...current, vitrineMeta: event.target.value }))} placeholder={`Ex.: ${vitrineDefaults.meta}`} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Destaque do plano</label>
                <select className="form-select" value={form.vitrineRecomendada} onChange={event => setForm(current => ({ ...current, vitrineRecomendada: event.target.value }))}>
                  <option value="AUTO">Usar sugestao automatica</option>
                  <option value="SIM">Marcar como mais escolhido</option>
                  <option value="NAO">Nao marcar</option>
                </select>
              </div>
            </div>

            <div className="checkout-admin-block">
              <div className="checkout-admin-block-head">
                <div>
                  <div className="section-heading" style={{ fontSize: 18 }}>Checkout / Revisao antes de pagar</div>
                  <div className="section-copy">
                    Personalize a copy dessa etapa por plano. Se deixar vazio, o checkout usa a sugestao automatica considerando a trilha principal.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" type="button" onClick={() => aplicarSugestaoCheckout('trilha')}>
                    Aplicar sugestao da trilha
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => aplicarSugestaoCheckout('neutro')}>
                    Usar padrao generico
                  </button>
                </div>
              </div>

              <div className="admin-inline-check" style={{ marginBottom: '1rem' }}>
                <strong>{posicionamentoCheckout.titulo}</strong>
                <span> {posicionamentoCheckout.copy}</span>
              </div>

              <div className="admin-inline-note" style={{ marginBottom: '1rem' }}>
                <strong>Sugestao atual:</strong>
                <span>
                  {' '}
                  kicker "{checkoutDefaults.kicker}", titulo "{checkoutDefaults.titulo}" e resumo final pensados para {trilhaSelecionada?.nome || 'a trilha selecionada'}.
                </span>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  checked={form.usarCheckoutPersonalizado}
                  onChange={event => setForm(current => ({ ...current, usarCheckoutPersonalizado: event.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                <span className="form-label" style={{ margin: 0 }}>Usar texto proprio neste plano</span>
              </label>

              <div className="mini-copy" style={{ marginBottom: '1rem' }}>
                Variaveis disponiveis: {CHECKOUT_VARIAVEIS}
              </div>

              <div className="checkout-admin-blocks">
                <div className="checkout-admin-block">
                  <div className="checkout-admin-block-head">
                    <div className="section-heading" style={{ fontSize: 16 }}>Hero</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" type="button" onClick={() => copiarBlocoPadrao('hero', 'trilha')}>Sugestao da trilha</button>
                      <button className="btn btn-ghost" type="button" onClick={() => copiarBlocoPadrao('hero', 'neutro')}>Padrao generico</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kicker</label>
                    <input className="form-input" value={form.checkoutKicker} onChange={event => setForm(current => ({ ...current, checkoutKicker: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.kicker}`} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Titulo principal</label>
                    <textarea className="form-textarea" value={form.checkoutTitulo} onChange={event => setForm(current => ({ ...current, checkoutTitulo: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.titulo}`} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Subtitulo</label>
                    <textarea className="form-textarea" value={form.checkoutSubtitulo} onChange={event => setForm(current => ({ ...current, checkoutSubtitulo: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.subtitulo}`} />
                  </div>
                </div>

                <div className="checkout-admin-block">
                  <div className="checkout-admin-block-head">
                    <div className="section-heading" style={{ fontSize: 16 }}>Beneficios</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" type="button" onClick={() => copiarBlocoPadrao('beneficios', 'trilha')}>Sugestao da trilha</button>
                      <button className="btn btn-ghost" type="button" onClick={() => copiarBlocoPadrao('beneficios', 'neutro')}>Padrao generico</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Titulo dos beneficios</label>
                    <input className="form-input" value={form.checkoutBeneficiosTitulo} onChange={event => setForm(current => ({ ...current, checkoutBeneficiosTitulo: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.beneficiosTitulo}`} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Beneficios (1 por linha)</label>
                    <textarea className="form-textarea" value={form.checkoutBeneficiosTexto} onChange={event => setForm(current => ({ ...current, checkoutBeneficiosTexto: event.target.value }))} placeholder={checkoutDefaults.beneficios.join('\n')} />
                  </div>
                </div>

                <div className="checkout-admin-block">
                  <div className="checkout-admin-block-head">
                    <div className="section-heading" style={{ fontSize: 16 }}>Apoio</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" type="button" onClick={() => copiarBlocoPadrao('apoio', 'trilha')}>Sugestao da trilha</button>
                      <button className="btn btn-ghost" type="button" onClick={() => copiarBlocoPadrao('apoio', 'neutro')}>Padrao generico</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Titulo da secao de apoio</label>
                    <input className="form-input" value={form.checkoutAjudaTitulo} onChange={event => setForm(current => ({ ...current, checkoutAjudaTitulo: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.ajudaTitulo}`} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Texto de apoio</label>
                    <textarea className="form-textarea" value={form.checkoutAjudaTexto} onChange={event => setForm(current => ({ ...current, checkoutAjudaTexto: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.ajudaTexto}`} />
                  </div>
                </div>

                <div className="checkout-admin-block">
                  <div className="checkout-admin-block-head">
                    <div className="section-heading" style={{ fontSize: 16 }}>Confianca</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" type="button" onClick={() => copiarBlocoPadrao('confianca', 'trilha')}>Sugestao da trilha</button>
                      <button className="btn btn-ghost" type="button" onClick={() => copiarBlocoPadrao('confianca', 'neutro')}>Padrao generico</button>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Itens de confianca (1 por linha)</label>
                    <textarea className="form-textarea" value={form.checkoutConfiancaTexto} onChange={event => setForm(current => ({ ...current, checkoutConfiancaTexto: event.target.value }))} placeholder={checkoutDefaults.confianca.join('\n')} />
                  </div>
                </div>

                <div className="checkout-admin-block checkout-admin-block--full">
                  <div className="checkout-admin-block-head">
                    <div className="section-heading" style={{ fontSize: 16 }}>Resumo e preco</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" type="button" onClick={() => copiarBlocoPadrao('resumo', 'trilha')}>Sugestao da trilha</button>
                      <button className="btn btn-ghost" type="button" onClick={() => copiarBlocoPadrao('resumo', 'neutro')}>Padrao generico</button>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Kicker do resumo</label>
                      <input className="form-input" value={form.checkoutResumoKicker} onChange={event => setForm(current => ({ ...current, checkoutResumoKicker: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.resumoKicker}`} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Label do preco</label>
                      <input className="form-input" value={form.checkoutPrecoLabel} onChange={event => setForm(current => ({ ...current, checkoutPrecoLabel: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.precoLabel}`} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Texto do resumo</label>
                    <textarea className="form-textarea" value={form.checkoutResumoTexto} onChange={event => setForm(current => ({ ...current, checkoutResumoTexto: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.resumoTexto}`} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Texto abaixo do preco</label>
                    <input className="form-input" value={form.checkoutPrecoTexto} onChange={event => setForm(current => ({ ...current, checkoutPrecoTexto: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.precoTexto}`} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Texto de seguranca</label>
                    <input className="form-input" value={form.checkoutSeguroTexto} onChange={event => setForm(current => ({ ...current, checkoutSeguroTexto: event.target.value }))} placeholder={`Ex.: ${checkoutDefaults.seguroTexto}`} />
                  </div>
                </div>
              </div>

              <div className="checkout-admin-preview">
                <div className="checkout-admin-preview-head">
                  <div>
                    <div className="section-heading" style={{ fontSize: 18 }}>Preview</div>
                    <div className="section-copy">
                      Assim essa etapa tende a aparecer para o aluno, com os dados atuais do plano e do local.
                    </div>
                  </div>
                  <div className="checkout-admin-preview-controls">
                    <div className="checkout-admin-preview-control">
                      <span className="checkout-admin-preview-control-label">Tela</span>
                      <div className="checkout-admin-preview-toggle" role="tablist" aria-label="Modo do preview">
                        <button type="button" className={`checkout-admin-preview-toggle-btn ${previewModo === 'desktop' ? 'is-active' : ''}`} onClick={() => setPreviewModo('desktop')}>Desktop</button>
                        <button type="button" className={`checkout-admin-preview-toggle-btn ${previewModo === 'mobile' ? 'is-active' : ''}`} onClick={() => setPreviewModo('mobile')}>Mobile</button>
                      </div>
                    </div>
                    <div className="checkout-admin-preview-control">
                      <span className="checkout-admin-preview-control-label">Tema</span>
                      <div className="checkout-admin-preview-toggle" role="tablist" aria-label="Tema do preview">
                        <button type="button" className={`checkout-admin-preview-toggle-btn ${previewTema === 'escuro' ? 'is-active' : ''}`} onClick={() => setPreviewTema('escuro')}>Escuro</button>
                        <button type="button" className={`checkout-admin-preview-toggle-btn ${previewTema === 'claro' ? 'is-active' : ''}`} onClick={() => setPreviewTema('claro')}>Claro</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`checkout-admin-preview-frame ${previewModo === 'mobile' ? 'is-mobile' : 'is-desktop'} ${previewTema === 'claro' ? 'is-light-theme' : 'is-dark-theme'}`}>
                  <div className={`checkout-review-layout checkout-review-layout--admin-preview ${previewModo === 'mobile' ? 'is-mobile-preview' : 'is-desktop-preview'}`}>
                    <div className="checkout-review-copy">
                      <div className="hero-kicker">{checkoutPreview.kicker}</div>
                      <h2 className="checkout-review-title">{checkoutPreview.titulo}</h2>
                      <p className="checkout-review-subtitle">{checkoutPreview.subtitulo}</p>

                      <div className="checkout-review-section">
                        <div className="checkout-review-section-title">{checkoutPreview.beneficiosTitulo}</div>
                        <div className="checkout-review-list">
                          {checkoutPreview.beneficios.map(item => (
                            <div key={item} className="checkout-review-list-item">
                              <span className="checkout-review-list-dot" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="checkout-review-section">
                        <div className="checkout-review-section-title">{checkoutPreview.ajudaTitulo}</div>
                        <p className="checkout-review-support">{checkoutPreview.ajudaTexto}</p>
                      </div>

                      <div className="checkout-review-trust">
                        {checkoutPreview.confianca.map(item => (
                          <div key={item} className="checkout-review-trust-item">
                            <span className="checkout-review-trust-dot" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <aside className="checkout-review-summary">
                      <div className="checkout-review-summary-kicker">{checkoutPreview.resumoKicker}</div>
                      <div className="checkout-review-summary-title">{localSelecionado?.nome || 'Local de prova'}</div>
                      <div className="checkout-review-summary-copy">{checkoutPreview.resumoTexto}</div>

                      <div className="checkout-review-summary-grid">
                        <div className="checkout-review-summary-row">
                          <span>Local</span>
                          <strong>{localSelecionado?.nome || 'Local de prova'}</strong>
                        </div>
                        <div className="checkout-review-summary-row">
                          <span>Plano</span>
                          <strong>{form.nome || 'Plano'}</strong>
                        </div>
                        <div className="checkout-review-summary-row">
                          <span>Acesso</span>
                          <strong>{checkoutPreview.contexto.duracao}</strong>
                        </div>
                        <div className="checkout-review-summary-row">
                          <span>Pagamento</span>
                          <strong>Pix ou cartao</strong>
                        </div>
                      </div>

                      <div className="checkout-review-price-card">
                        <div className="checkout-review-price-label">{checkoutPreview.precoLabel}</div>
                        <div className="checkout-review-price-value">{fmtMoeda(checkoutPreview.precoCentavos)}</div>
                        <div className="checkout-review-price-copy">{checkoutPreview.precoTexto}</div>
                      </div>

                      <div className="checkout-review-secure">{checkoutPreview.seguroTexto}</div>
                    </aside>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : edicaoId ? 'Salvar alteracoes' : 'Criar plano'}</button>
              {edicaoId && <button className="btn btn-ghost" type="button" onClick={resetar}>Cancelar</button>}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="section-heading">Planos cadastrados</div>
          <div className="admin-inline-note" style={{ marginTop: '0.9rem', marginBottom: '0.9rem' }}>
            <strong>{resumoClassificacao.total}</strong> plano(s) no total.
            <span> O acesso agora e definido por local, duracao, status ativo e pagamento confirmado.</span>
          </div>
          {loading ? (
            <div className="spinner" />
          ) : planosFiltrados.length ? (
            <div className="stack-list">
              {planosFiltrados.map(plano => (
                <div key={plano.id} className="stack-row">
                  <div>
                    <div className="table-name">{plano.nome}</div>
                    <div className="mini-copy">
                      {(locaisMap.get(plano.localProvaId)?.nome || plano.localProvaNome)} - {formatPlanoDuracao(plano.duracaoDias)} - {fmtMoeda(plano.precoCentavos)}
                    </div>
                    {plano.trilhaNome && (
                      <div className="mini-copy" style={{ marginTop: 4 }}>
                        Trilha principal: {plano.trilhaNome}
                      </div>
                    )}
                  </div>
                  <div className="table-actions">
                    <span className={`badge ${plano.ativo ? 'badge-green' : 'badge-gray'}`}>{plano.ativo ? 'Ativo' : 'Inativo'}</span>
                    {plano.trilhaNome && <span className="badge badge-blue">{plano.trilhaNome}</span>}
                    {temVitrinePersonalizada(plano) && <span className="badge badge-blue">Vitrine customizada</span>}
                    {(plano.usarCheckoutPersonalizado || temTextoPersonalizado(plano)) && <span className="badge badge-warn">Checkout customizado</span>}
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => editar(plano)}>Editar</button>
                    <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => excluir(plano)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Nenhum plano encontrado nesse filtro.</div>
          )}
        </div>
      </div>
    </>
  )
}
