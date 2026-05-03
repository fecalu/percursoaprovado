const TRILHAS_FALLBACK = [
  {
    id: 'fallback-comecando-do-zero',
    codigo: 'comecando_do_zero',
    nome: 'Comecando do zero',
    descricao: 'Jornada completa para quem quer entender o processo desde o inicio e chegar pronto no dia da prova.',
    ordemExibicao: 1,
    ativo: true,
    etapas: [
      {
        id: 'fallback-primeiros-passos',
        grupoAcessoCodigo: 'primeiros_passos',
        grupoAcessoNome: 'Primeiros passos',
        titulo: 'Primeiros passos',
        resumo: 'Entenda o que resolver logo no inicio do processo.',
        ordemExibicao: 1,
        ativo: true,
      },
      {
        id: 'fallback-documentos-taxas',
        grupoAcessoCodigo: 'documentos_taxas',
        grupoAcessoNome: 'Documentos e taxas',
        titulo: 'Documentos e taxas',
        resumo: 'Confira o que levar, pagar e organizar antes de avancar.',
        ordemExibicao: 2,
        ativo: true,
      },
      {
        id: 'fallback-curso-teorico',
        grupoAcessoCodigo: 'curso_teorico',
        grupoAcessoNome: 'Curso teorico',
        titulo: 'Curso teorico',
        resumo: 'Ganhe base antes de entrar com mais forca na pratica.',
        ordemExibicao: 3,
        ativo: true,
      },
      {
        id: 'fallback-pratica-geral',
        grupoAcessoCodigo: 'pratica_geral',
        grupoAcessoNome: 'Pratica geral',
        titulo: 'Pratica geral',
        resumo: 'Fortalece controle do carro, baliza e confianca geral.',
        ordemExibicao: 4,
        ativo: true,
      },
      {
        id: 'fallback-percursos-local',
        grupoAcessoCodigo: 'percursos_local',
        grupoAcessoNome: 'Percursos do seu local',
        titulo: 'Percursos do seu local',
        resumo: 'Treine exatamente o que costuma aparecer na sua prova.',
        ordemExibicao: 5,
        ativo: true,
      },
      {
        id: 'fallback-pegadinhas-local',
        grupoAcessoCodigo: 'pegadinhas_local',
        grupoAcessoNome: 'Pegadinhas do local',
        titulo: 'Pegadinhas do local',
        resumo: 'Revise os pontos em que mais gente perde pontos.',
        ordemExibicao: 6,
        ativo: true,
      },
      {
        id: 'fallback-revisao-final',
        grupoAcessoCodigo: 'revisao_final',
        grupoAcessoNome: 'Revisao final',
        titulo: 'Revisao final',
        resumo: 'Amarre os pontos mais importantes para a reta final.',
        ordemExibicao: 7,
        ativo: true,
      },
      {
        id: 'fallback-dia-da-prova',
        grupoAcessoCodigo: 'dia_da_prova',
        grupoAcessoNome: 'Dia da prova',
        titulo: 'Dia da prova',
        resumo: 'Organize comportamento, documentos e tranquilidade no dia.',
        ordemExibicao: 8,
        ativo: true,
      },
    ],
  },
  {
    id: 'fallback-reta-final',
    codigo: 'reta_final_prova',
    nome: 'Reta final para a prova',
    descricao: 'Jornada enxuta para quem ja passou pelas etapas iniciais e quer focar na pratica, nos percursos e na revisao final.',
    ordemExibicao: 2,
    ativo: true,
    etapas: [
      {
        id: 'fallback-reta-pratica-geral',
        grupoAcessoCodigo: 'pratica_geral',
        grupoAcessoNome: 'Pratica geral',
        titulo: 'Pratica geral',
        resumo: 'Fortalece controle do carro, baliza e confianca geral.',
        ordemExibicao: 1,
        ativo: true,
      },
      {
        id: 'fallback-reta-percursos',
        grupoAcessoCodigo: 'percursos_local',
        grupoAcessoNome: 'Percursos do seu local',
        titulo: 'Percursos do seu local',
        resumo: 'Treine exatamente o que costuma aparecer na sua prova.',
        ordemExibicao: 2,
        ativo: true,
      },
      {
        id: 'fallback-reta-pegadinhas',
        grupoAcessoCodigo: 'pegadinhas_local',
        grupoAcessoNome: 'Pegadinhas do local',
        titulo: 'Pegadinhas do local',
        resumo: 'Revise os pontos em que mais gente perde pontos.',
        ordemExibicao: 3,
        ativo: true,
      },
      {
        id: 'fallback-reta-revisao',
        grupoAcessoCodigo: 'revisao_final',
        grupoAcessoNome: 'Revisao final',
        titulo: 'Revisao final',
        resumo: 'Amarre os pontos mais importantes para a reta final.',
        ordemExibicao: 4,
        ativo: true,
      },
      {
        id: 'fallback-reta-dia-da-prova',
        grupoAcessoCodigo: 'dia_da_prova',
        grupoAcessoNome: 'Dia da prova',
        titulo: 'Dia da prova',
        resumo: 'Organize comportamento, documentos e tranquilidade no dia.',
        ordemExibicao: 5,
        ativo: true,
      },
    ],
  },
]

export function compararTexto(a = '', b = '') {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

export function normalizarTexto(valor = '') {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function ordenarConteudos(a, b) {
  const ordemA = a?.ordemExibicao ?? 0
  const ordemB = b?.ordemExibicao ?? 0

  if (ordemA !== ordemB) {
    return ordemA - ordemB
  }

  return compararTexto(a?.titulo, b?.titulo)
}

export function resolverStatusConteudo(item, progressoItem) {
  if (!progressoItem) {
    return {
      concluido: false,
      iniciado: false,
      percentual: 0,
    }
  }

  if (progressoItem.concluido) {
    return {
      concluido: true,
      iniciado: true,
      percentual: 100,
    }
  }

  const duracaoTotal = progressoItem.duracaoTotal || item?.duracaoSegundos || 0
  const percentual = duracaoTotal > 0
    ? Math.min(100, Math.round(((progressoItem.segundosAssistidos || 0) / duracaoTotal) * 100))
    : 0

  return {
    concluido: false,
    iniciado: percentual > 0,
    percentual,
  }
}

export function escolherConteudoAcao(itens, progressoMap) {
  const ordenados = [...itens].sort(ordenarConteudos)

  const emAndamento = ordenados.find(item => {
    const status = resolverStatusConteudo(item, progressoMap.get(item.id))
    return status.iniciado && !status.concluido
  })

  if (emAndamento) return emAndamento

  const primeiroNaoConcluido = ordenados.find(item => !resolverStatusConteudo(item, progressoMap.get(item.id)).concluido)
  return primeiroNaoConcluido || ordenados[0] || null
}

export function resumirConteudo(item) {
  return item?.resumo || item?.descricao || 'Conteudo pronto para voce revisar com mais clareza.'
}

function criarMapaConteudosPorGrupo(conteudos) {
  const mapa = new Map()

  conteudos.forEach(item => {
    const codigos = Array.isArray(item.gruposAcessoCodigos) ? item.gruposAcessoCodigos : []
    const nomes = Array.isArray(item.gruposAcessoNomes) ? item.gruposAcessoNomes : []

    codigos.forEach(codigo => {
      const chave = normalizarTexto(codigo)
      const listaAtual = mapa.get(chave) || []
      mapa.set(chave, [...listaAtual, item])
    })

    nomes.forEach(nome => {
      const chave = normalizarTexto(nome)
      const listaAtual = mapa.get(chave) || []
      mapa.set(chave, [...listaAtual, item])
    })
  })

  return mapa
}

function removerDuplicadosPorId(itens) {
  return itens.filter((item, index, array) => array.findIndex(candidate => candidate.id === item.id) === index)
}

function normalizarTrilhasEntrada(trilhas) {
  if (Array.isArray(trilhas) && trilhas.length > 0) {
    return trilhas
  }

  return TRILHAS_FALLBACK
}

function derivarCodigoTrilhaCompleta(codigoPreferido) {
  const codigo = normalizarTexto(codigoPreferido)
  if (!codigo) return null

  if (codigo === 'reta_final_prova') {
    return 'comecando_do_zero'
  }

  if (codigo.startsWith('reta_final_')) {
    return `comecando_do_zero_${codigo.slice('reta_final_'.length)}`
  }

  return codigo
}

function escolherCodigoTrilhaPrincipal(trilhasBase, codigoPreferido, usarMapaCompleto) {
  const codigos = new Set(
    trilhasBase
      .map(item => item?.codigo)
      .filter(Boolean)
  )

  if (usarMapaCompleto) {
    const codigoCompleto = derivarCodigoTrilhaCompleta(codigoPreferido)
    if (codigoCompleto && codigos.has(codigoCompleto)) {
      return codigoCompleto
    }
  }

  if (codigoPreferido && codigos.has(codigoPreferido)) {
    return codigoPreferido
  }

  if (usarMapaCompleto && codigos.has('comecando_do_zero')) {
    return 'comecando_do_zero'
  }

  return null
}

export function resolverPerfilTrilha(trilha) {
  if (!trilha) return null

  if (trilha.codigo === 'comecando_do_zero') {
    return {
      badge: 'Comecando do zero',
      tone: 'badge-green',
      titulo: 'Sua jornada esta montada para acompanhar o processo desde o inicio.',
      copy: 'Voce pode seguir a ordem sugerida abaixo ou entrar direto no modulo que precisa revisar agora.',
    }
  }

  if (trilha.codigo === 'reta_final_prova') {
    return {
      badge: 'Reta final para a prova',
      tone: 'badge-blue',
      titulo: 'Seu plano esta focado na parte pratica e na revisao antes da prova.',
      copy: 'A melhor estrategia agora e revisar seus percursos, pegadinhas e pontos criticos com constancia.',
    }
  }

  return {
    badge: trilha.nome || 'Sua jornada',
    tone: 'badge-blue',
    titulo: trilha.descricao || 'Use a trilha para seguir a melhor ordem e nao se perder no que revisar agora.',
    copy: 'Voce pode seguir a jornada completa ou entrar direto nos modulos que mais fazem sentido para seu momento.',
  }
}

export function montarTrilhasAluno(trilhas, conteudos, progressoMap, codigoPreferido = null, options = {}) {
  const incluirEtapasBloqueadas = options?.incluirEtapasBloqueadas === true
  const usarMapaCompleto = options?.usarMapaCompleto === true
  const trilhasBase = normalizarTrilhasEntrada(trilhas)
  const conteudosPorGrupo = criarMapaConteudosPorGrupo(conteudos)
  const codigoPrincipal = escolherCodigoTrilhaPrincipal(trilhasBase, codigoPreferido, usarMapaCompleto)

  const enriquecidas = trilhasBase
    .filter(item => item?.ativo !== false)
    .map(trilha => {
      const etapasAtivas = Array.isArray(trilha.etapas)
        ? [...trilha.etapas]
          .filter(etapa => etapa?.ativo !== false)
          .sort((a, b) => {
            const ordemA = a?.ordemExibicao ?? Number.MAX_SAFE_INTEGER
            const ordemB = b?.ordemExibicao ?? Number.MAX_SAFE_INTEGER

            if (ordemA !== ordemB) {
              return ordemA - ordemB
            }

            return compararTexto(a?.titulo, b?.titulo)
          })
        : []

      const etapasProcessadas = etapasAtivas
        .map(etapa => {
          const chaves = [
            etapa.grupoAcessoCodigo,
            etapa.grupoAcessoNome,
          ]
            .map(valor => normalizarTexto(valor))
            .filter(Boolean)

          const itens = removerDuplicadosPorId(
            chaves.flatMap(chave => conteudosPorGrupo.get(chave) || [])
          ).sort(ordenarConteudos)

          const disponivel = itens.length > 0
          const concluidos = itens.filter(item => resolverStatusConteudo(item, progressoMap.get(item.id)).concluido).length
          const iniciado = itens.some(item => resolverStatusConteudo(item, progressoMap.get(item.id)).iniciado)
          const duracaoTotal = itens.reduce((acc, item) => acc + (item.duracaoSegundos || 0), 0)

          return {
            ...etapa,
            itens,
            disponivel,
            bloqueado: !disponivel,
            iniciado,
            concluidos,
            concluido: disponivel && concluidos === itens.length,
            itemAcao: escolherConteudoAcao(itens, progressoMap),
            duracaoTotal,
            percentual: itens.length > 0 ? Math.round((concluidos / itens.length) * 100) : 0,
          }
        })
        .filter(etapa => incluirEtapasBloqueadas || etapa.disponivel)

      const etapaAtual = etapasProcessadas.find(item => !item.bloqueado && !item.concluido)
        || etapasProcessadas.find(item => !item.bloqueado)
        || null

      const etapasDisponiveis = etapasProcessadas.map(etapa => {
        let statusChave = 'liberada'
        let statusLabel = 'Liberada'

        if (etapa.bloqueado) {
          statusChave = 'bloqueada'
          statusLabel = 'Bloqueada'
        } else if (etapa.concluido) {
          statusChave = 'concluida'
          statusLabel = 'Concluida'
        } else if (etapaAtual && etapa.id === etapaAtual.id) {
          statusChave = 'atual'
          statusLabel = 'Agora'
        } else if (etapa.iniciado) {
          statusChave = 'em_andamento'
          statusLabel = 'Em andamento'
        }

        return {
          ...etapa,
          statusChave,
          statusLabel,
        }
      })

      const concluidas = etapasDisponiveis.filter(item => item.concluido).length
      const liberadas = etapasDisponiveis.filter(item => !item.bloqueado).length
      const bloqueadas = etapasDisponiveis.filter(item => item.bloqueado).length
      const cobertura = etapasAtivas.length > 0 ? liberadas / etapasAtivas.length : 0

      return {
        ...trilha,
        etapas: etapasDisponiveis,
        etapaAtual,
        concluidas,
        liberadas,
        bloqueadas,
        totalEtapasAtivas: etapasAtivas.length,
        aulas: etapasDisponiveis.reduce((acc, etapa) => acc + etapa.itens.length, 0),
        cobertura,
        perfil: resolverPerfilTrilha(trilha),
      }
    })
    .filter(trilha => trilha.etapas.length > 0)
    .sort((a, b) => {
      const preferidoA = codigoPrincipal && a?.codigo === codigoPrincipal
      const preferidoB = codigoPrincipal && b?.codigo === codigoPrincipal

      if (preferidoA !== preferidoB) {
        return preferidoA ? -1 : 1
      }

      if (a.cobertura !== b.cobertura) return b.cobertura - a.cobertura
      if (a.etapas.length !== b.etapas.length) return b.etapas.length - a.etapas.length

      const ordemA = a?.ordemExibicao ?? Number.MAX_SAFE_INTEGER
      const ordemB = b?.ordemExibicao ?? Number.MAX_SAFE_INTEGER

      if (ordemA !== ordemB) {
        return ordemA - ordemB
      }

      return compararTexto(a?.nome, b?.nome)
    })

  return {
    trilhas: enriquecidas,
    trilhaPrincipal: enriquecidas[0] || null,
  }
}
