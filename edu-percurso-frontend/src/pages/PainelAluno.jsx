import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ContentThumbnail from '../components/ContentThumbnail'
import { assinaturaService, pedidoService, percursoService, progressoService, trilhaService } from '../services/api'
import {
  formatDataCurta,
  formatDataHoraCurta,
  formatDuracaoMinutos,
  formatPlanoDuracao,
  formatTrilhaPlano,
  getResumoTrilhaPlano,
  resolveSituacaoPedido,
} from '../utils/formatters'
import {
  compararTexto,
  escolherConteudoAcao,
  montarTrilhasAluno,
  ordenarConteudos,
  resolverStatusConteudo,
  resumirConteudo,
} from '../utils/trilhas'

function pluralizar(total, singular, plural) {
  return `${total} ${total === 1 ? singular : plural}`
}

function getPainelCopyPorTrilha(trilhaCodigo) {
  if (trilhaCodigo === 'comecando_do_zero') {
    return 'Seu painel esta organizado para quem quer comecar do zero, com uma jornada mais completa e atalhos para cada etapa.'
  }

  if (trilhaCodigo === 'reta_final_prova') {
    return 'Seu painel esta organizado para a reta final, com foco em pratica, percursos, pegadinhas e revisao objetiva.'
  }

  return 'Continue do ponto certo, enxergue sua jornada e encontre rapido o que estudar agora.'
}

export default function PainelAluno() {
  const navigate = useNavigate()
  const [assinaturas, setAssinaturas] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [conteudos, setConteudos] = useState([])
  const [progresso, setProgresso] = useState([])
  const [trilhas, setTrilhas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true

    Promise.allSettled([
      assinaturaService.minhas(),
      pedidoService.minhas(),
      percursoService.listar(),
      progressoService.meu(),
      trilhaService.listar(),
    ])
      .then(([assinaturasResp, pedidosResp, conteudosResp, progressoResp, trilhasResp]) => {
        if (!ativo) return
        if (assinaturasResp.status === 'fulfilled') setAssinaturas(assinaturasResp.value)
        if (pedidosResp.status === 'fulfilled') setPedidos(pedidosResp.value)
        if (conteudosResp.status === 'fulfilled') setConteudos(conteudosResp.value)
        if (progressoResp.status === 'fulfilled') setProgresso(progressoResp.value)
        if (trilhasResp.status === 'fulfilled') setTrilhas(trilhasResp.value)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  const assinaturasAtivas = useMemo(
    () => assinaturas.filter(item => item.status === 'ATIVA' && item.paymentStatus === 'PAGO'),
    [assinaturas]
  )

  const pedidosPendentes = useMemo(
    () => pedidos.filter(item => resolveSituacaoPedido(item.status, item.solicitacaoCancelamentoStatus, item.paymentStatus) === 'AGUARDANDO_PAGAMENTO'),
    [pedidos]
  )

  const conteudoMap = useMemo(() => new Map(conteudos.map(item => [item.id, item])), [conteudos])
  const progressoMap = useMemo(() => new Map(progresso.map(item => [item.percursoId, item])), [progresso])

  const ultimoAcessoAtivo = useMemo(() => {
    return [...assinaturasAtivas]
      .sort((a, b) => new Date(b.inicioEm || b.criadoEm || 0) - new Date(a.inicioEm || a.criadoEm || 0))[0] || null
  }, [assinaturasAtivas])

  const ultimoPedidoPendente = useMemo(() => {
    return [...pedidosPendentes]
      .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0))[0] || null
  }, [pedidosPendentes])

  const resumoGeral = useMemo(() => {
    const concluidos = conteudos.filter(item => resolverStatusConteudo(item, progressoMap.get(item.id)).concluido).length
    const emAndamento = conteudos.filter(item => {
      const status = resolverStatusConteudo(item, progressoMap.get(item.id))
      return status.iniciado && !status.concluido
    }).length

    return {
      totalConteudos: conteudos.length,
      concluidos,
      emAndamento,
      modulos: new Set(
        conteudos.map(item => `${item.localProvaId || 'geral'}:${item.categoriaId || 'sem-modulo'}`)
      ).size,
    }
  }, [conteudos, progressoMap])

  const ultimoConteudoEmAndamento = useMemo(() => {
    return progresso
      .map(item => ({
        progresso: item,
        conteudo: conteudoMap.get(item.percursoId),
      }))
      .filter(item => item.conteudo)
      .filter(item => {
        const status = resolverStatusConteudo(item.conteudo, item.progresso)
        return status.iniciado && !status.concluido
      })
      .sort((a, b) => new Date(b.progresso.ultimaVez || 0) - new Date(a.progresso.ultimaVez || 0))[0] || null
  }, [conteudoMap, progresso])

  const modulosRapidos = useMemo(() => {
    const mapa = new Map()

    conteudos.forEach(item => {
      const chave = `${item.localProvaId || 'geral'}:${item.categoriaId || 'sem-modulo'}`
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          titulo: item.categoriaNome || 'Sem modulo',
          contexto: item.localProvaNome || 'Geral',
          ordemExibicao: item.categoriaOrdemExibicao ?? Number.MAX_SAFE_INTEGER,
          itens: [],
        })
      }

      mapa.get(chave).itens.push(item)
    })

    return Array.from(mapa.values())
      .map(modulo => {
        const itensOrdenados = [...modulo.itens].sort(ordenarConteudos)
        const concluidos = itensOrdenados.filter(item => resolverStatusConteudo(item, progressoMap.get(item.id)).concluido).length
        const emAndamento = itensOrdenados.some(item => {
          const status = resolverStatusConteudo(item, progressoMap.get(item.id))
          return status.iniciado && !status.concluido
        })
        const percentual = itensOrdenados.length > 0
          ? Math.round((concluidos / itensOrdenados.length) * 100)
          : 0
        const itemAcao = escolherConteudoAcao(itensOrdenados, progressoMap)

        return {
          ...modulo,
          itens: itensOrdenados,
          concluidos,
          percentual,
          emAndamento,
          itemAcao,
          duracaoTotal: itensOrdenados.reduce((acc, item) => acc + (item.duracaoSegundos || 0), 0),
        }
      })
      .sort((a, b) => {
        if (a.emAndamento !== b.emAndamento) return a.emAndamento ? -1 : 1
        if ((a.contexto === 'Geral') !== (b.contexto === 'Geral')) return a.contexto === 'Geral' ? 1 : -1
        if (a.ordemExibicao !== b.ordemExibicao) return a.ordemExibicao - b.ordemExibicao
        if (a.contexto !== b.contexto) return compararTexto(a.contexto, b.contexto)
        return compararTexto(a.titulo, b.titulo)
      })
  }, [conteudos, progressoMap])

  const jornada = useMemo(() => {
    if (!ultimoAcessoAtivo) {
      return {
        perfil: null,
        etapas: [],
        etapaAtual: null,
        concluidas: 0,
      }
    }

    const { trilhaPrincipal } = montarTrilhasAluno(
      trilhas,
      conteudos,
      progressoMap,
      ultimoAcessoAtivo?.trilhaCodigo || null
    )

    if (!trilhaPrincipal) {
      return {
        perfil: null,
        etapas: [],
        etapaAtual: null,
        concluidas: 0,
      }
    }

    return {
      perfil: trilhaPrincipal.perfil,
      etapas: trilhaPrincipal.etapas,
      etapaAtual: trilhaPrincipal.etapaAtual,
      concluidas: trilhaPrincipal.concluidas,
    }
  }, [conteudos, progressoMap, trilhas, ultimoAcessoAtivo?.trilhaCodigo])

  const jornadaMapa = useMemo(() => {
    if (!ultimoAcessoAtivo) {
      return {
        etapas: [],
        liberadas: 0,
        bloqueadas: 0,
        concluidas: 0,
      }
    }

    const { trilhaPrincipal } = montarTrilhasAluno(
      trilhas,
      conteudos,
      progressoMap,
      ultimoAcessoAtivo?.trilhaCodigo || null,
      {
        incluirEtapasBloqueadas: true,
        usarMapaCompleto: true,
      }
    )

    if (!trilhaPrincipal) {
      return {
        etapas: [],
        liberadas: 0,
        bloqueadas: 0,
        concluidas: 0,
      }
    }

    return {
      etapas: trilhaPrincipal.etapas,
      liberadas: trilhaPrincipal.liberadas,
      bloqueadas: trilhaPrincipal.bloqueadas,
      concluidas: trilhaPrincipal.concluidas,
    }
  }, [conteudos, progressoMap, trilhas, ultimoAcessoAtivo?.trilhaCodigo])

  const copyPainelPerfil = useMemo(() => {
    return getPainelCopyPorTrilha(ultimoAcessoAtivo?.trilhaCodigo || null)
  }, [ultimoAcessoAtivo?.trilhaCodigo])
  const resumoTrilhaAtiva = useMemo(() => {
    if (!ultimoAcessoAtivo?.trilhaCodigo) return null

    return {
      nome: formatTrilhaPlano(ultimoAcessoAtivo.trilhaNome, ultimoAcessoAtivo.trilhaCodigo),
      resumo: getResumoTrilhaPlano(ultimoAcessoAtivo.trilhaCodigo),
    }
  }, [ultimoAcessoAtivo?.trilhaCodigo, ultimoAcessoAtivo?.trilhaNome])

  const destaquePrincipal = useMemo(() => {
    if (ultimoConteudoEmAndamento?.conteudo) {
      const conteudo = ultimoConteudoEmAndamento.conteudo
      const progressoAtual = ultimoConteudoEmAndamento.progresso
      const status = resolverStatusConteudo(conteudo, progressoAtual)

      return {
        badgeClass: 'badge-green',
        badgeLabel: 'Continue de onde parou',
        kicker: `${conteudo.localProvaNome || 'Geral'} • ${conteudo.categoriaNome || 'Sem modulo'}`,
        title: conteudo.titulo,
        copy: `${resumirConteudo(conteudo)} ${status.percentual > 0 ? `Voce ja assistiu ${status.percentual}% dessa aula.` : ''}`.trim(),
        meta: progressoAtual?.ultimaVez ? `Ultima vez: ${formatDataHoraCurta(progressoAtual.ultimaVez)}` : `Valido ate ${formatDataCurta(ultimoAcessoAtivo?.fimEm)}`,
        primaryLabel: 'Continuar aula',
        primaryAction: () => navigate(`/conteudos/${conteudo.id}`),
        secondaryLabel: 'Abrir biblioteca',
        secondaryAction: () => navigate('/biblioteca'),
        conteudo,
        resumo: [
          `${conteudo.localProvaNome || 'Conteudo geral'}`,
          `${conteudo.categoriaNome || 'Sem modulo'}`,
          formatDuracaoMinutos(conteudo.duracaoSegundos),
        ],
      }
    }

    if (jornada.etapaAtual?.itemAcao) {
      const conteudo = jornada.etapaAtual.itemAcao

      return {
        badgeClass: 'badge-blue',
        badgeLabel: 'Seu proximo passo',
        kicker: jornada.etapaAtual.titulo,
        title: conteudo.titulo,
        copy: `${jornada.etapaAtual.resumo} Abra essa aula e avance no ritmo certo para a sua prova.`,
        meta: ultimoAcessoAtivo ? `Plano ativo ate ${formatDataCurta(ultimoAcessoAtivo.fimEm)}` : 'Sua conta esta pronta para estudar',
        primaryLabel: 'Comecar agora',
        primaryAction: () => navigate(`/conteudos/${conteudo.id}`),
        secondaryLabel: 'Abrir minha trilha',
        secondaryAction: () => navigate('/minha-trilha'),
        conteudo,
        resumo: [
          `${conteudo.localProvaNome || 'Geral'}`,
          `${conteudo.categoriaNome || 'Sem modulo'}`,
          formatDuracaoMinutos(conteudo.duracaoSegundos),
        ],
      }
    }

    if (ultimoPedidoPendente) {
      return {
        badgeClass: 'badge-warn',
        badgeLabel: 'Pagamento pendente',
        kicker: ultimoPedidoPendente.localProvaNome,
        title: 'Finalize sua compra para liberar o material',
        copy: `Existe um pedido do plano ${ultimoPedidoPendente.planoNome} aguardando confirmacao. Assim que o pagamento entrar, sua biblioteca fica liberada automaticamente.`,
        meta: 'Assim que confirmar, o acesso aparece aqui no painel.',
        primaryLabel: 'Ver pagamentos',
        primaryAction: () => navigate('/meus-pedidos'),
        secondaryLabel: 'Ver local',
        secondaryAction: () => navigate(`/locais/${ultimoPedidoPendente.localProvaSlug}`),
        conteudo: null,
        resumo: [
          ultimoPedidoPendente.localProvaNome,
          ultimoPedidoPendente.planoNome,
          'Aguardando pagamento',
        ],
      }
    }

    if (ultimoAcessoAtivo) {
      const resumoTrilha = getResumoTrilhaPlano(ultimoAcessoAtivo.trilhaCodigo)
      const nomeTrilha = formatTrilhaPlano(ultimoAcessoAtivo.trilhaNome, ultimoAcessoAtivo.trilhaCodigo)

      return {
        badgeClass: 'badge-green',
        badgeLabel: 'Acesso ativo',
        kicker: `${ultimoAcessoAtivo.localProvaNome} • ${nomeTrilha}`,
        title: 'Sua biblioteca ja esta liberada',
        copy: `${resumoTrilha} Seu plano ${ultimoAcessoAtivo.planoNome} esta valendo por ${formatPlanoDuracao(ultimoAcessoAtivo.duracaoDias)}.`,
        meta: `Valido ate ${formatDataCurta(ultimoAcessoAtivo.fimEm)}`,
        primaryLabel: 'Abrir biblioteca',
        primaryAction: () => navigate('/biblioteca'),
        secondaryLabel: 'Ver meus acessos',
        secondaryAction: () => navigate('/meus-acessos'),
        conteudo: null,
        resumo: [
          ultimoAcessoAtivo.localProvaNome,
          ultimoAcessoAtivo.planoNome,
          formatPlanoDuracao(ultimoAcessoAtivo.duracaoDias),
        ],
      }
    }

    return {
      badgeClass: 'badge-blue',
      badgeLabel: 'Comece agora',
      kicker: 'Sua conta esta pronta',
      title: 'Escolha um local e libere seu material',
      copy: 'Quando voce contratar um plano, o painel vai reunir sua trilha, seus modulos e os atalhos mais rapidos para estudar sem perder tempo.',
      meta: 'Tudo o que voce comprar e acompanhar aparece aqui.',
      primaryLabel: 'Ver locais disponiveis',
      primaryAction: () => navigate('/'),
      secondaryLabel: pedidos.length > 0 ? 'Ver meus pagamentos' : 'Conhecer a biblioteca',
      secondaryAction: () => navigate(pedidos.length > 0 ? '/meus-pedidos' : '/biblioteca'),
      conteudo: null,
      resumo: [
        'Escolha seu local',
        'Libere o plano',
        'Comece a estudar',
      ],
    }
  }, [jornada.etapaAtual, jornada.perfil, navigate, pedidos.length, ultimoAcessoAtivo, ultimoConteudoEmAndamento, ultimoPedidoPendente])

  const cardsLocais = useMemo(() => {
    return assinaturasAtivas.map(acesso => {
      const itensLocal = conteudos
        .filter(item => item.localProvaId === acesso.localProvaId)
        .sort(ordenarConteudos)

      const modulos = new Set(itensLocal.map(item => item.categoriaId || `sem-${item.id}`)).size
      const concluidos = itensLocal.filter(item => resolverStatusConteudo(item, progressoMap.get(item.id)).concluido).length
      const itemAcao = escolherConteudoAcao(itensLocal, progressoMap)

      return {
        id: acesso.id,
        title: acesso.localProvaNome,
        meta: `Valido ate ${formatDataCurta(acesso.fimEm)}`,
        copy: itensLocal.length
          ? `${pluralizar(itensLocal.length, 'aula liberada', 'aulas liberadas')} neste local, organizadas em ${pluralizar(modulos, 'modulo', 'modulos')}.`
          : 'Seu acesso esta ativo, mas este local ainda nao possui aulas liberadas na biblioteca.',
        ctaLabel: itemAcao ? 'Abrir proxima aula' : 'Ver meus acessos',
        ctaAction: () => navigate(itemAcao ? `/conteudos/${itemAcao.id}` : '/meus-acessos'),
        secondaryLabel: 'Ver local',
        secondaryAction: () => navigate(`/locais/${acesso.localProvaSlug}`),
        chips: [
          `${concluidos}/${itensLocal.length || 0} concluidas`,
          `${modulos} modulos`,
          acesso.planoNome,
        ],
      }
    })
  }, [assinaturasAtivas, conteudos, navigate, progressoMap])

  const cardsConta = useMemo(() => {
    return [
      {
        id: 'biblioteca',
        badgeClass: resumoGeral.totalConteudos > 0 ? 'badge-green' : 'badge-gray',
        badgeLabel: resumoGeral.totalConteudos > 0 ? 'Material liberado' : 'Sem material agora',
        title: 'Biblioteca',
        meta: resumoGeral.totalConteudos > 0
          ? `${pluralizar(resumoGeral.modulos, 'modulo', 'modulos')} para abrir rapido`
          : 'Ela aparece assim que houver um plano ativo',
        copy: resumoGeral.totalConteudos > 0
          ? `Voce ja tem ${pluralizar(resumoGeral.totalConteudos, 'aula liberada', 'aulas liberadas')}, com ${pluralizar(resumoGeral.concluidos, 'conteudo concluido', 'conteudos concluidos')}.`
          : 'Assim que um plano estiver ativo, sua biblioteca vira o centro do seu estudo.',
        ctaLabel: resumoGeral.totalConteudos > 0 ? 'Abrir biblioteca' : 'Ver locais',
        ctaAction: () => navigate(resumoGeral.totalConteudos > 0 ? '/biblioteca' : '/'),
      },
      {
        id: 'acessos',
        badgeClass: assinaturasAtivas.length > 0 ? 'badge-blue' : 'badge-gray',
        badgeLabel: assinaturasAtivas.length > 0 ? 'Em andamento' : 'Sem acesso ativo',
        title: 'Meus acessos',
        meta: assinaturasAtivas.length > 0
          ? pluralizar(assinaturasAtivas.length, 'acesso ativo', 'acessos ativos')
          : 'Veja validade e historico',
        copy: 'Consulte quais locais estao liberados, por quanto tempo cada acesso continua valendo e o que ja foi encerrado.',
        ctaLabel: 'Ver acessos',
        ctaAction: () => navigate('/meus-acessos'),
      },
      {
        id: 'pagamentos',
        badgeClass: pedidosPendentes.length > 0 ? 'badge-warn' : 'badge-blue',
        badgeLabel: pedidosPendentes.length > 0 ? 'Pagamento pendente' : 'Tudo organizado',
        title: 'Pagamentos',
        meta: pedidosPendentes.length > 0
          ? pluralizar(pedidosPendentes.length, 'pedido aguardando', 'pedidos aguardando')
          : `${pedidos.length} pedidos no historico`,
        copy: 'Acompanhe compras, pagamentos pendentes, pedidos concluidos e qualquer solicitacao ligada ao seu acesso.',
        ctaLabel: 'Ver pagamentos',
        ctaAction: () => navigate('/meus-pedidos'),
      },
    ]
  }, [assinaturasAtivas.length, navigate, pedidos.length, pedidosPendentes.length, resumoGeral])

  if (loading) return <div className="spinner" />

  return (
    <div className="student-dashboard-page">
      <div className="student-shell student-shell--compact">
        <section className="student-library-head">
          <div>
            <div className="page-title">Seu painel</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              {copyPainelPerfil}
            </p>
            {resumoTrilhaAtiva && (
              <div className="student-inline-note" style={{ marginTop: '0.7rem' }}>
                <strong>{resumoTrilhaAtiva.nome}.</strong> <span>{resumoTrilhaAtiva.resumo}</span>
              </div>
            )}
          </div>

          <div className="student-kpi-strip">
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{assinaturasAtivas.length}</span>
              <span className="student-kpi-pill-label">Acessos ativos</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{resumoGeral.emAndamento}</span>
              <span className="student-kpi-pill-label">Aulas em andamento</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{resumoGeral.concluidos}</span>
              <span className="student-kpi-pill-label">Concluidas</span>
            </div>
          </div>
        </section>
      </div>

      <section className="student-grid student-dashboard-lead-grid">
        <article className="student-card student-dashboard-hero-card student-dashboard-continue-card">
          <div className="student-dashboard-continue-shell">
            <div className="student-dashboard-continue-main">
              <div className="student-card-top">
                <span className={`badge ${destaquePrincipal.badgeClass}`}>{destaquePrincipal.badgeLabel}</span>
                <span className="student-dashboard-hero-meta">{destaquePrincipal.meta}</span>
              </div>

              <div className="student-dashboard-kicker">{destaquePrincipal.kicker}</div>
              <div className="student-card-title">{destaquePrincipal.title}</div>
              <div className="student-card-copy student-dashboard-hero-copy">{destaquePrincipal.copy}</div>

              <div className="student-dashboard-inline-points">
                {destaquePrincipal.resumo.map(item => (
                  <span key={item} className="student-dashboard-inline-pill">{item}</span>
                ))}
              </div>

              <div className="student-card-actions">
                <button className="btn btn-primary" onClick={destaquePrincipal.primaryAction}>
                  {destaquePrincipal.primaryLabel}
                </button>
                <button className="btn btn-ghost" onClick={destaquePrincipal.secondaryAction}>
                  {destaquePrincipal.secondaryLabel}
                </button>
              </div>
            </div>

            <div className="student-dashboard-thumb-shell">
              {destaquePrincipal.conteudo ? (
                <ContentThumbnail
                  thumbnailUrl={destaquePrincipal.conteudo.thumbnailUrl}
                  titulo={destaquePrincipal.conteudo.titulo}
                  videoUrl={destaquePrincipal.conteudo.videoUrl}
                />
              ) : (
                <div className="student-dashboard-thumb-fallback">
                  <div className="student-dashboard-thumb-copy">
                    {jornada.perfil?.badge || 'Percurso Aprovado'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="student-card student-dashboard-journey-card student-dashboard-journey-map-card">
          <div className="student-card-top">
            <span className={`badge ${assinaturasAtivas.length > 0 ? (jornada.perfil?.tone || 'badge-blue') : 'badge-gray'}`}>
              {assinaturasAtivas.length > 0 ? (jornada.perfil?.badge || 'Sua jornada') : 'Jornada bloqueada'}
            </span>
            <span className="student-dashboard-card-meta">
              {assinaturasAtivas.length > 0
                ? (jornadaMapa.etapas.length > 0
                    ? `${jornadaMapa.liberadas}/${jornadaMapa.etapas.length} etapas liberadas`
                    : 'Sua trilha aparece aqui conforme seu plano libera os grupos.')
                : 'Sem acesso ativo'}
            </span>
          </div>

          <div className="student-card-title">
            {assinaturasAtivas.length > 0 ? 'Sua trilha completa' : 'Sua trilha aparece quando o acesso for liberado'}
          </div>
          <div className="student-card-copy">
            {assinaturasAtivas.length > 0
              ? 'Tudo o que existe na sua jornada aparece aqui. O que seu plano ainda nao libera fica bloqueado, para voce enxergar com clareza o que ja esta disponivel e o que vem depois.'
              : 'Para evitar confusao, o painel nao mostra etapas, modulos ou trilhas completas antes de existir um plano pago e ativo na sua conta.'}
          </div>
          {assinaturasAtivas.length > 0 && (jornada.perfil?.copy || jornadaMapa.etapas.length > 0) && (
            <div className="student-inline-note">
              {jornada.perfil?.copy || 'Quando novos blocos forem liberados no seu plano, eles deixam de ficar bloqueados e entram na sua trilha automaticamente.'}
            </div>
          )}

          {assinaturasAtivas.length > 0 ? (
            jornadaMapa.etapas.length > 0 ? (
              <>
                <div className="student-dashboard-inline-points student-dashboard-inline-points--tight" style={{ marginTop: '0.95rem' }}>
                  <span className="student-dashboard-inline-pill">{pluralizar(jornadaMapa.liberadas, 'etapa liberada', 'etapas liberadas')}</span>
                  <span className="student-dashboard-inline-pill">{pluralizar(jornadaMapa.bloqueadas, 'etapa bloqueada', 'etapas bloqueadas')}</span>
                  <span className="student-dashboard-inline-pill">{pluralizar(jornadaMapa.concluidas, 'etapa concluida', 'etapas concluidas')}</span>
                </div>

                <div className="student-journey-map">
                  {jornadaMapa.etapas.map((etapa, index) => {
                    const toneClass = etapa.statusChave === 'concluida'
                      ? 'is-complete'
                      : etapa.statusChave === 'atual'
                        ? 'is-current'
                        : etapa.statusChave === 'em_andamento'
                          ? 'is-active'
                          : etapa.statusChave === 'bloqueada'
                            ? 'is-locked'
                            : 'is-open'

                    const etapaResumo = etapa.bloqueado
                      ? `${etapa.resumo} Esta parte ainda nao esta liberada no seu plano atual.`
                      : etapa.resumo

                    const bubbleMeta = etapa.bloqueado
                      ? 'Bloqueado no seu plano atual'
                      : `${etapa.concluidos}/${etapa.itens.length} aulas concluidas`

                    const BubbleTag = etapa.bloqueado ? 'div' : 'button'
                    const bubbleProps = etapa.bloqueado
                      ? {}
                      : {
                          type: 'button',
                          onClick: () => etapa.itemAcao && navigate(`/conteudos/${etapa.itemAcao.id}`),
                        }

                    return (
                      <div
                        key={etapa.id}
                        className={`student-journey-node ${index % 2 === 0 ? 'is-right' : 'is-left'} ${toneClass}`.trim()}
                      >
                        {index % 2 !== 0 && (
                          <BubbleTag className="student-journey-bubble" {...bubbleProps}>
                            <div className="student-journey-bubble-top">
                              <span className={`student-journey-badge student-journey-badge--${etapa.statusChave}`}>{etapa.statusLabel}</span>
                              <span className="student-journey-bubble-meta">{bubbleMeta}</span>
                            </div>
                            <div className="student-journey-bubble-title">{etapa.titulo}</div>
                            <div className="student-journey-bubble-copy">{etapaResumo}</div>
                            <div className="student-dashboard-inline-points student-dashboard-inline-points--tight">
                              <span className="student-dashboard-inline-pill">
                                {etapa.bloqueado ? 'Etapa bloqueada' : pluralizar(etapa.itens.length, 'aula', 'aulas')}
                              </span>
                              {!etapa.bloqueado && etapa.duracaoTotal > 0 && (
                                <span className="student-dashboard-inline-pill">{formatDuracaoMinutos(etapa.duracaoTotal)}</span>
                              )}
                            </div>
                          </BubbleTag>
                        )}

                        <button
                          type="button"
                          className="student-journey-orb"
                          disabled={etapa.bloqueado || !etapa.itemAcao}
                          onClick={() => etapa.itemAcao && navigate(`/conteudos/${etapa.itemAcao.id}`)}
                          aria-label={etapa.bloqueado ? `${etapa.titulo} bloqueado` : `Abrir etapa ${etapa.titulo}`}
                        >
                          <span className="student-journey-orb-index">{etapa.concluido ? 'OK' : index + 1}</span>
                        </button>

                        {index % 2 === 0 && (
                          <BubbleTag className="student-journey-bubble" {...bubbleProps}>
                            <div className="student-journey-bubble-top">
                              <span className={`student-journey-badge student-journey-badge--${etapa.statusChave}`}>{etapa.statusLabel}</span>
                              <span className="student-journey-bubble-meta">{bubbleMeta}</span>
                            </div>
                            <div className="student-journey-bubble-title">{etapa.titulo}</div>
                            <div className="student-journey-bubble-copy">{etapaResumo}</div>
                            <div className="student-dashboard-inline-points student-dashboard-inline-points--tight">
                              <span className="student-dashboard-inline-pill">
                                {etapa.bloqueado ? 'Etapa bloqueada' : pluralizar(etapa.itens.length, 'aula', 'aulas')}
                              </span>
                              {!etapa.bloqueado && etapa.duracaoTotal > 0 && (
                                <span className="student-dashboard-inline-pill">{formatDuracaoMinutos(etapa.duracaoTotal)}</span>
                              )}
                            </div>
                          </BubbleTag>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="student-card-actions">
                  <button className="btn btn-ghost" onClick={() => navigate('/minha-trilha')}>
                    Abrir minha trilha
                  </button>
                </div>
              </>
            ) : (
              <div className="student-dashboard-empty-note">
                Assim que seu plano liberar conteudos, o painel passa a mostrar os proximos passos da sua jornada aqui.
              </div>
            )
          ) : (
            <div className="student-card-actions">
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                Ver locais de prova
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/meus-pedidos')}>
                Ver pagamentos
              </button>
            </div>
          )}
        </article>
      </section>

      {modulosRapidos.length > 0 && (
        <section className="content-section">
          <div className="section-title-row">
            <div>
              <div className="section-heading">Encontre rapido o que voce precisa</div>
              <div className="section-copy">
                Modulos visuais para bater o olho, achar o tema certo e entrar direto na proxima aula.
              </div>
            </div>

            <button className="btn btn-ghost" onClick={() => navigate('/biblioteca')}>
              Ver biblioteca completa
            </button>
          </div>

          <div className="student-module-quick-grid">
            {modulosRapidos.slice(0, 8).map(modulo => {
              const itemAcao = modulo.itemAcao
              const ctaLabel = modulo.concluidos === modulo.itens.length
                ? 'Rever modulo'
                : modulo.emAndamento
                  ? 'Continuar modulo'
                  : 'Comecar modulo'

              return (
                <article key={modulo.chave} className="student-card student-quick-module-card">
                  <div className="student-card-top">
                    <span className={`badge ${modulo.contexto === 'Geral' ? 'badge-blue' : 'badge-green'}`}>{modulo.contexto}</span>
                    <span className="student-dashboard-card-meta">
                      {modulo.concluidos}/{modulo.itens.length} concluidas
                    </span>
                  </div>

                  <div className="student-quick-module-title">{modulo.titulo}</div>
                  <div className="student-card-copy">
                    {modulo.contexto === 'Geral'
                      ? 'Conteudo util para qualquer aluno, sem depender de um local especifico.'
                      : `Conteudo pratico organizado para ${modulo.contexto}.`}
                  </div>

                  <div className="student-dashboard-inline-points">
                    <span className="student-dashboard-inline-pill">{pluralizar(modulo.itens.length, 'aula', 'aulas')}</span>
                    <span className="student-dashboard-inline-pill">{formatDuracaoMinutos(modulo.duracaoTotal)}</span>
                  </div>

                  <div className="student-progress-bar">
                    <div className="student-progress-fill" style={{ width: `${modulo.percentual}%` }} />
                  </div>

                  <div className="student-card-actions">
                    <button className="btn btn-primary" onClick={() => navigate(itemAcao ? `/conteudos/${itemAcao.id}` : '/biblioteca')}>
                      {ctaLabel}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <section className="content-section">
        <div className="section-title-row">
          <div>
            <div className="section-heading">Seu local de prova e sua conta</div>
            <div className="section-copy">
              Veja o que esta liberado agora e acompanhe pagamentos, acessos e atalhos importantes sem se perder.
            </div>
          </div>
        </div>

        <div className="student-grid student-dashboard-support-grid">
          {cardsLocais.map(card => (
            <article key={card.id} className="student-card student-dashboard-support-card student-dashboard-local-card">
              <div className="student-card-top">
                <span className="badge badge-green">Local ativo</span>
                <span className="student-dashboard-card-meta">{card.meta}</span>
              </div>
              <div className="student-card-title">{card.title}</div>
              <div className="student-card-copy">{card.copy}</div>
              <div className="student-dashboard-inline-points">
                {card.chips.map(item => (
                  <span key={item} className="student-dashboard-inline-pill">{item}</span>
                ))}
              </div>
              <div className="student-card-actions">
                <button className="btn btn-primary" onClick={card.ctaAction}>
                  {card.ctaLabel}
                </button>
                <button className="btn btn-ghost" onClick={card.secondaryAction}>
                  {card.secondaryLabel}
                </button>
              </div>
            </article>
          ))}

          {cardsConta.map(card => (
            <article key={card.id} className="student-card student-dashboard-support-card">
              <div className="student-card-top">
                <span className={`badge ${card.badgeClass}`}>{card.badgeLabel}</span>
                <span className="student-dashboard-card-meta">{card.meta}</span>
              </div>
              <div className="student-card-title">{card.title}</div>
              <div className="student-card-copy">{card.copy}</div>
              <div className="student-card-actions">
                <button className="btn btn-primary" onClick={card.ctaAction}>
                  {card.ctaLabel}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
