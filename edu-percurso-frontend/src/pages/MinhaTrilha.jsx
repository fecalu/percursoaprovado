import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ContentThumbnail from '../components/ContentThumbnail'
import { assinaturaService, categoriaService, percursoService, progressoService } from '../services/api'
import { filtrarAssinaturasLiberadasAgora } from '../utils/access'
import { formatDataCurta, formatDuracaoMinutos } from '../utils/formatters'

const SEM_MODULO_ID = 'sem-modulo'

function pluralizar(total, singular, plural) {
  return `${total} ${total === 1 ? singular : plural}`
}

function compararTexto(a = '', b = '') {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

function ordenarPorOrdemENome(a, b) {
  const ordemA = a?.ordemExibicao ?? Number.MAX_SAFE_INTEGER
  const ordemB = b?.ordemExibicao ?? Number.MAX_SAFE_INTEGER

  if (ordemA !== ordemB) return ordemA - ordemB
  return compararTexto(a?.titulo || a?.nome, b?.titulo || b?.nome)
}

function resolverStatusConteudo(item, progressoItem) {
  if (!progressoItem) {
    return { concluido: false, iniciado: false, percentual: 0 }
  }

  if (progressoItem.concluido) {
    return { concluido: true, iniciado: true, percentual: 100 }
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

function escolherConteudoAcao(itens, progressoMap) {
  const ordenados = [...itens].sort(ordenarPorOrdemENome)
  const emAndamento = ordenados.find(item => {
    const status = resolverStatusConteudo(item, progressoMap.get(item.id))
    return status.iniciado && !status.concluido
  })

  if (emAndamento) return emAndamento
  return ordenados.find(item => !resolverStatusConteudo(item, progressoMap.get(item.id)).concluido) || ordenados[0] || null
}

function resumirConteudo(item) {
  return item?.resumo || item?.descricao || 'Conteudo pronto para voce revisar com mais clareza.'
}

function normalizarGuiaBlocos(blocos = []) {
  return [...blocos]
    .filter(bloco => bloco?.titulo)
    .sort(ordenarPorOrdemENome)
}

function criarBasesModulo(categorias, conteudos) {
  const bases = []
  const idsUsados = new Set()

  categorias
    .map(categoria => ({
      id: categoria.id,
      nome: categoria.nome || 'Modulo sem nome',
      descricao: categoria.descricao || '',
      ordemExibicao: categoria.ordemExibicao ?? Number.MAX_SAFE_INTEGER,
      guiaBlocos: normalizarGuiaBlocos(categoria.guiaBlocos || []),
    }))
    .sort(ordenarPorOrdemENome)
    .forEach(categoria => {
      if (!categoria.id || idsUsados.has(categoria.id)) return
      idsUsados.add(categoria.id)
      bases.push(categoria)
    })

  conteudos.forEach(item => {
    if (!item.categoriaId || idsUsados.has(item.categoriaId)) return

    idsUsados.add(item.categoriaId)
    bases.push({
      id: item.categoriaId,
      nome: item.categoriaNome || 'Modulo sem nome',
      descricao: '',
      ordemExibicao: item.categoriaOrdemExibicao ?? Number.MAX_SAFE_INTEGER,
      guiaBlocos: [],
    })
  })

  if (conteudos.some(item => !item.categoriaId)) {
    bases.push({
      id: SEM_MODULO_ID,
      nome: 'Sem modulo',
      descricao: 'Aulas que ainda precisam ser organizadas em um modulo.',
      ordemExibicao: Number.MAX_SAFE_INTEGER,
      guiaBlocos: [],
    })
  }

  return bases.sort(ordenarPorOrdemENome)
}

function montarJornadaPorModulos(categorias, conteudos, progressoMap, perfil) {
  const conteudosPorModulo = new Map()

  conteudos.forEach(item => {
    const chave = item.categoriaId || SEM_MODULO_ID
    const listaAtual = conteudosPorModulo.get(chave) || []
    conteudosPorModulo.set(chave, [...listaAtual, item])
  })

  const etapas = criarBasesModulo(categorias, conteudos)
    .map((base, index) => {
      const itens = [...(conteudosPorModulo.get(base.id) || [])].sort(ordenarPorOrdemENome)
      const totalGuiaBlocos = base.guiaBlocos.length

      if (itens.length === 0 && totalGuiaBlocos === 0) return null

      const concluidos = itens.filter(item => resolverStatusConteudo(item, progressoMap.get(item.id)).concluido).length
      const iniciado = itens.some(item => resolverStatusConteudo(item, progressoMap.get(item.id)).iniciado)
      const duracaoTotal = itens.reduce((acc, item) => acc + (item.duracaoSegundos || 0), 0)
      const itemAcao = escolherConteudoAcao(itens, progressoMap)
      const guiaDisponivel = totalGuiaBlocos > 0 && base.id !== SEM_MODULO_ID
      const concluido = itens.length > 0 && concluidos === itens.length

      return {
        id: base.id || `modulo-${index}`,
        titulo: base.nome,
        resumo: base.descricao || (guiaDisponivel
          ? 'Guia pratico disponivel para consulta rapida.'
          : 'Aulas organizadas para estudar este modulo.'),
        itens,
        totalGuiaBlocos,
        guiaDisponivel,
        iniciado,
        concluidos,
        concluido,
        itemAcao,
        duracaoTotal,
        percentual: itens.length > 0 ? Math.round((concluidos / itens.length) * 100) : 0,
      }
    })
    .filter(Boolean)

  const etapaAtual = etapas.find(item => !item.concluido) || etapas[0] || null

  return {
    perfil,
    etapas,
    etapaAtual,
    concluidas: etapas.filter(item => item.concluido).length,
    aulas: etapas.reduce((acc, etapa) => acc + etapa.itens.length, 0),
    guias: etapas.reduce((acc, etapa) => acc + etapa.totalGuiaBlocos, 0),
    nome: perfil?.badge || 'Sua jornada',
  }
}

function resolverPerfilSimples(codigoPreferido, acesso) {
  if (codigoPreferido === 'comecando_do_zero') {
    return {
      badge: 'Comecando do zero',
      tone: 'badge-green',
      titulo: 'Sua jornada usa os modulos liberados para guiar seus estudos do inicio ate a prova.',
      copy: 'Siga a ordem sugerida ou entre direto no modulo que precisa revisar agora.',
    }
  }

  if (codigoPreferido === 'reta_final_prova') {
    return {
      badge: 'Reta final para a prova',
      tone: 'badge-blue',
      titulo: 'Sua jornada prioriza os modulos mais importantes para revisao pratica.',
      copy: 'Use os modulos como um checklist de estudo antes da prova.',
    }
  }

  return {
    badge: acesso?.trilhaNome || 'Sua jornada',
    tone: 'badge-blue',
    titulo: 'Sua jornada e montada a partir dos modulos disponiveis na Biblioteca.',
    copy: 'Tudo que estiver liberado para seu acesso aparece organizado aqui em uma ordem mais facil de seguir.',
  }
}

export default function MinhaTrilha() {
  const navigate = useNavigate()
  const [assinaturas, setAssinaturas] = useState([])
  const [conteudos, setConteudos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [progresso, setProgresso] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true

    Promise.allSettled([
      assinaturaService.minhas(),
      percursoService.listar(),
      categoriaService.listar(),
      progressoService.meu(),
    ])
      .then(([assinaturasResp, conteudosResp, categoriasResp, progressoResp]) => {
        if (!ativo) return
        if (assinaturasResp.status === 'fulfilled') setAssinaturas(assinaturasResp.value)
        if (conteudosResp.status === 'fulfilled') setConteudos(conteudosResp.value)
        if (categoriasResp.status === 'fulfilled') setCategorias(categoriasResp.value)
        if (progressoResp.status === 'fulfilled') setProgresso(progressoResp.value)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  const assinaturasAtivas = useMemo(
    () => filtrarAssinaturasLiberadasAgora(assinaturas),
    [assinaturas]
  )

  const trilhaPreferidaCodigo = useMemo(() => {
    return [...assinaturasAtivas]
      .sort((a, b) => new Date(b.inicioEm || b.criadoEm || 0) - new Date(a.inicioEm || a.criadoEm || 0))[0]?.trilhaCodigo || null
  }, [assinaturasAtivas])

  const ultimoAcessoAtivo = useMemo(() => {
    return [...assinaturasAtivas]
      .sort((a, b) => new Date(b.inicioEm || b.criadoEm || 0) - new Date(a.inicioEm || a.criadoEm || 0))[0] || null
  }, [assinaturasAtivas])

  const progressoMap = useMemo(() => new Map(progresso.map(item => [item.percursoId, item])), [progresso])

  const jornada = useMemo(() => {
    if (assinaturasAtivas.length === 0) {
      return {
        perfil: null,
        etapas: [],
        etapaAtual: null,
        concluidas: 0,
        aulas: 0,
        nome: null,
        guias: 0,
      }
    }

    return montarJornadaPorModulos(
      categorias,
      conteudos,
      progressoMap,
      resolverPerfilSimples(trilhaPreferidaCodigo, ultimoAcessoAtivo)
    )
  }, [assinaturasAtivas.length, categorias, conteudos, progressoMap, trilhaPreferidaCodigo, ultimoAcessoAtivo])

  const destaque = useMemo(() => {
    if (!jornada.etapaAtual) return null

    const etapa = jornada.etapaAtual
    const conteudo = etapa.itemAcao
    const guiaUrl = etapa.guiaDisponivel ? `/biblioteca/modulos/${etapa.id}/guia` : '/biblioteca'

    if (!conteudo) {
      return {
        tipo: 'guia',
        url: guiaUrl,
        kicker: etapa.titulo,
        title: etapa.titulo,
        copy: `${etapa.resumo} Abra o guia pratico para consultar o passo a passo visual.`,
        meta: 'Guia pratico',
        resumo: [
          pluralizar(etapa.totalGuiaBlocos, 'passo visual', 'passos visuais'),
          'Checklist',
          'Consulta rapida',
        ],
      }
    }

    return {
      tipo: 'aula',
      url: `/conteudos/${conteudo.id}`,
      conteudo,
      kicker: etapa.titulo,
      title: conteudo.titulo,
      copy: `${etapa.resumo} ${resumirConteudo(conteudo)}`,
      meta: conteudo.localProvaNome || 'Conteudo geral',
      resumo: [
        conteudo.localProvaNome || 'Geral',
        conteudo.categoriaNome || 'Sem modulo',
        formatDuracaoMinutos(conteudo.duracaoSegundos),
      ],
    }
  }, [jornada])

  function navegarEtapa(etapa) {
    if (etapa.itemAcao) {
      navigate(`/conteudos/${etapa.itemAcao.id}`)
      return
    }

    if (etapa.guiaDisponivel) {
      navigate(`/biblioteca/modulos/${etapa.id}/guia`)
      return
    }

    navigate('/biblioteca')
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="student-dashboard-page student-trilha-page">
      <div className="student-shell student-shell--compact">
        <section className="student-library-head student-library-head--guided">
          <div>
            <div className="page-title">Minha trilha</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Veja sua jornada completa, avance etapa por etapa e saiba exatamente o que revisar agora.
            </p>
          </div>

          <div className="student-kpi-strip">
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{jornada.etapas.length}</span>
              <span className="student-kpi-pill-label">Etapas liberadas</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{jornada.concluidas}</span>
              <span className="student-kpi-pill-label">Etapas concluidas</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{jornada.aulas}</span>
              <span className="student-kpi-pill-label">Aulas na jornada</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{jornada.guias}</span>
              <span className="student-kpi-pill-label">Passos visuais</span>
            </div>
          </div>
        </section>

        {assinaturasAtivas.length > 0 && (
          <div className="student-chip-grid student-chip-grid--compact">
            {assinaturasAtivas.map(item => (
              <div key={item.id} className="student-chip student-chip--compact">
                <div className="student-chip-title">{item.localProvaNome}</div>
                <div className="student-chip-copy">Ativo ate {formatDataCurta(item.fimEm)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {assinaturasAtivas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Sua trilha aparece aqui assim que voce tiver um plano ativo.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Ver locais de prova
            </button>
          </div>
        </div>
      ) : jornada.etapas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">?</div>
          Sua jornada ainda esta sendo montada com os modulos liberados para seu acesso.
        </div>
      ) : (
        <>
          <section className="student-grid student-library-journey-grid">
            {destaque && (
              <article className="student-card student-dashboard-hero-card student-library-journey-card">
                <div className="student-dashboard-continue-shell">
                  <div className="student-dashboard-continue-main">
                    <div className="student-card-top">
                      <span className={`badge ${jornada.perfil?.tone || 'badge-blue'}`}>{jornada.perfil?.badge || 'Sua jornada'}</span>
                      <span className="student-dashboard-hero-meta">{destaque.meta}</span>
                    </div>

                    <div className="student-dashboard-kicker">{destaque.kicker}</div>
                    <div className="student-card-title">{destaque.title}</div>
                    <div className="student-card-copy student-dashboard-hero-copy">{destaque.copy}</div>

                    <div className="student-dashboard-inline-points">
                      {destaque.resumo.map(item => (
                        <span key={item} className="student-dashboard-inline-pill">{item}</span>
                      ))}
                    </div>

                    <div className="student-card-actions">
                      <button className="btn btn-primary" onClick={() => navigate(destaque.url)}>
                        {destaque.tipo === 'guia'
                          ? 'Abrir guia'
                          : jornada.etapaAtual?.iniciado && !jornada.etapaAtual?.concluido ? 'Continuar etapa' : 'Comecar etapa'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => navigate('/biblioteca')}>
                        Abrir biblioteca
                      </button>
                    </div>
                  </div>

                  <div className="student-dashboard-thumb-shell">
                    {destaque.conteudo ? (
                      <ContentThumbnail
                        thumbnailUrl={destaque.conteudo.thumbnailUrl}
                        titulo={destaque.conteudo.titulo}
                        videoUrl={destaque.conteudo.videoUrl}
                      />
                    ) : (
                      <div className="student-dashboard-thumb-fallback">
                        <span className="student-dashboard-thumb-copy">Guia pratico</span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )}

            <article className="student-card student-library-profile-card">
              <div className="student-card-top">
                <span className={`badge ${jornada.perfil?.tone || 'badge-blue'}`}>{jornada.perfil?.badge || 'Sua jornada'}</span>
                <span className="student-dashboard-card-meta">
                  {jornada.concluidas}/{jornada.etapas.length} etapas concluidas
                </span>
              </div>

              <div className="student-card-title">Visao geral da jornada</div>
              <div className="student-card-copy">
                {jornada.perfil?.titulo || 'Sua trilha fica organizada aqui para mostrar o que vem antes, agora e depois.'}
              </div>
              {jornada.perfil?.copy && (
                <div className="student-inline-note">{jornada.perfil.copy}</div>
              )}

              <div className="student-dashboard-inline-points">
                <span className="student-dashboard-inline-pill">{pluralizar(jornada.etapas.length, 'etapa', 'etapas')}</span>
                <span className="student-dashboard-inline-pill">{pluralizar(jornada.aulas, 'aula', 'aulas')}</span>
                <span className="student-dashboard-inline-pill">{pluralizar(jornada.guias, 'passo visual', 'passos visuais')}</span>
                <span className="student-dashboard-inline-pill">{pluralizar(assinaturasAtivas.length, 'acesso ativo', 'acessos ativos')}</span>
              </div>

              <div className="student-card-actions">
                <button className="btn btn-primary" onClick={() => navigate('/painel')}>
                  Voltar ao painel
                </button>
              </div>
            </article>
          </section>

          <section className="content-section">
            <div className="section-title-row">
              <div>
                <div className="section-heading">Etapas da sua trilha</div>
                <div className="section-copy">
                  Cada etapa acompanha os modulos da Biblioteca e pode abrir aulas ou guias praticos.
                </div>
              </div>
            </div>

            <div className="student-trilha-step-list">
              {jornada.etapas.map((etapa, index) => {
                const toneClass = etapa.concluido ? 'is-complete' : etapa.id === jornada.etapaAtual?.id ? 'is-current' : etapa.iniciado ? 'is-active' : ''
                const previewTitulos = [
                  ...etapa.itens.slice(0, 2).map(item => item.titulo),
                  etapa.guiaDisponivel ? 'Guia pratico visual' : null,
                ].filter(Boolean)

                return (
                  <article key={etapa.id} className={`student-card student-trilha-step-card ${toneClass}`.trim()}>
                    <div className="student-trilha-step-top">
                      <div className="student-trilha-step-order">Etapa {index + 1}</div>
                      <span className={`badge ${etapa.concluido ? 'badge-green' : etapa.id === jornada.etapaAtual?.id ? 'badge-blue' : 'badge-gray'}`}>
                        {etapa.concluido ? 'Concluida' : etapa.id === jornada.etapaAtual?.id ? 'Agora' : etapa.iniciado ? 'Em andamento' : 'Disponivel'}
                      </span>
                    </div>

                    <div className="student-card-title">{etapa.titulo}</div>
                    <div className="student-card-copy">{etapa.resumo}</div>

                    <div className="student-dashboard-inline-points">
                      <span className="student-dashboard-inline-pill">{pluralizar(etapa.itens.length, 'aula', 'aulas')}</span>
                      {etapa.totalGuiaBlocos > 0 && (
                        <span className="student-dashboard-inline-pill">{pluralizar(etapa.totalGuiaBlocos, 'passo visual', 'passos visuais')}</span>
                      )}
                      {etapa.duracaoTotal > 0 && (
                        <span className="student-dashboard-inline-pill">{formatDuracaoMinutos(etapa.duracaoTotal)}</span>
                      )}
                      {etapa.itens.length > 0 && (
                        <span className="student-dashboard-inline-pill">{etapa.concluidos}/{etapa.itens.length} concluidas</span>
                      )}
                    </div>

                    {etapa.itens.length > 0 && (
                      <div className="student-progress-bar">
                        <div className="student-progress-fill" style={{ width: `${etapa.percentual}%` }} />
                      </div>
                    )}

                    {previewTitulos.length > 0 && (
                      <div className="student-trilha-preview-list">
                        {previewTitulos.map(item => (
                          <span key={item} className="student-dashboard-inline-pill">{item}</span>
                        ))}
                      </div>
                    )}

                    <div className="student-card-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => navegarEtapa(etapa)}
                        disabled={!etapa.itemAcao && !etapa.guiaDisponivel}
                      >
                        {etapa.itemAcao
                          ? etapa.concluido ? 'Rever etapa' : etapa.iniciado ? 'Continuar etapa' : 'Comecar etapa'
                          : 'Abrir guia'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => navigate('/biblioteca')}>
                        Ver modulos
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
