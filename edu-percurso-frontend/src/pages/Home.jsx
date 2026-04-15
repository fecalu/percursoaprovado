import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import LandingFooter from '../components/LandingFooter'
import RevealSection from '../components/RevealSection'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { HOME_PAGE_DEFAULTS, resolveHomePageConfig } from '../data/sitePageDefaults'
import { configuracaoSiteService, localProvaService, percursoService, planoService } from '../services/api'
import { formatTrilhaPlano, getBadgeClassTrilhaPlano, getOrdemTrilhaPlano } from '../utils/formatters'
import { resolveMediaUrl } from '../utils/media'

function getCardLinha(local) {
  if (local.statusComercial === 'DISPONIVEL') {
    return 'Percursos mais frequentes e revisão prática desse local.'
  }

  if (local.statusComercial === 'EM_BREVE') {
    return 'Esse local será liberado assim que o conteúdo estiver pronto.'
  }

  if (local.statusComercial === 'PAUSADO') {
    return 'As vendas desse local estão pausadas no momento.'
  }

  return 'Local em configuração administrativa.'
}

function getCardCta(local) {
  if (local.statusComercial === 'DISPONIVEL') return 'Ver detalhes'
  if (local.statusComercial === 'EM_BREVE') return 'Acompanhar'
  if (local.statusComercial === 'PAUSADO') return 'Ver status do local'
  return 'Abrir detalhes'
}

function getLocaisPorPagina(width) {
  if (width <= 720) return 1
  if (width <= 1160) return 2
  return 3
}

function getLocalStatusPeso(statusComercial) {
  if (statusComercial === 'DISPONIVEL') return 0
  if (statusComercial === 'EM_BREVE') return 1
  if (statusComercial === 'PAUSADO') return 2
  return 3
}

function getJornadaPublica(codigo) {
  if (codigo === 'comecando_do_zero') {
    return {
      codigo,
      nome: 'Comecando do zero',
      titulo: 'Para quem quer um caminho completo',
      copy: 'Ideal para quem ainda esta organizando os primeiros passos e quer chegar na prova com mais clareza.',
      pontos: [
        'Primeiros passos e orientacao da jornada',
        'Mais contexto para estudar sem se perder',
        'Preparacao completa ate a revisao final',
      ],
    }
  }

  if (codigo === 'reta_final_prova') {
    return {
      codigo,
      nome: 'Reta final para a prova',
      titulo: 'Para quem quer revisar com foco',
      copy: 'Ideal para quem ja passou pelas etapas iniciais e agora quer praticar, rever percursos e ganhar confianca.',
      pontos: [
        'Foco em pratica, percurso e revisao',
        'Menos teoria inicial, mais objetividade',
        'Preparacao mais direta para o dia da prova',
      ],
    }
  }

  return {
    codigo,
    nome: formatTrilhaPlano('', codigo),
    titulo: 'Para um momento especifico da jornada',
    copy: 'Esse perfil organiza o plano de acordo com o momento atual do aluno.',
    pontos: [
      'Plano organizado por jornada',
      'Conteudo alinhado ao momento do aluno',
      'Estudo mais claro antes da prova',
    ],
  }
}

export default function Home() {
  const { user, isAdmin } = useAuth()
  const [locais, setLocais] = useState([])
  const [planos, setPlanos] = useState([])
  const [percursos, setPercursos] = useState([])
  const [configHome, setConfigHome] = useState(null)
  const [erroLocais, setErroLocais] = useState('')
  const [loading, setLoading] = useState(true)
  const [locaisPagina, setLocaisPagina] = useState(() => getLocaisPorPagina(window.innerWidth))
  const [locaisInicio, setLocaisInicio] = useState(0)

  useEffect(() => {
    let ativo = true

    Promise.allSettled([
      localProvaService.listar(),
      planoService.listar(),
      percursoService.listar(),
      configuracaoSiteService.buscarPublica(),
    ])
      .then(([locaisResp, planosResp, percursosResp, configResp]) => {
        if (!ativo) return

        if (locaisResp.status === 'fulfilled') {
          setLocais(locaisResp.value)
          setErroLocais('')
        } else {
          setLocais([])
          setErroLocais('Não foi possível carregar os locais de prova agora. Recarregue a página e tente novamente em instantes.')
        }
        setPlanos(planosResp.status === 'fulfilled' ? planosResp.value : [])
        setPercursos(percursosResp.status === 'fulfilled' ? percursosResp.value : [])
        setConfigHome(configResp.status === 'fulfilled' ? configResp.value?.home || null : null)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    function handleResize() {
      setLocaisPagina(getLocaisPorPagina(window.innerWidth))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const planosPorLocal = useMemo(() => {
    const agrupado = new Map()

    planos.forEach(plano => {
      const lista = agrupado.get(plano.localProvaSlug) || []
      lista.push(plano)
      lista.sort((a, b) => a.duracaoDias - b.duracaoDias)
      agrupado.set(plano.localProvaSlug, lista)
    })

    return agrupado
  }, [planos])

  const percursosPorLocal = useMemo(() => {
    const agrupado = new Map()

    percursos.forEach(percurso => {
      if (!percurso.localProvaSlug) return
      const lista = agrupado.get(percurso.localProvaSlug) || []
      lista.push(percurso)
      agrupado.set(percurso.localProvaSlug, lista)
    })

    return agrupado
  }, [percursos])

  const locaisOrdenados = useMemo(() => {
    return [...locais].sort((a, b) => {
      const ordemA = a.ordemExibicao ?? 0
      const ordemB = b.ordemExibicao ?? 0
      if (ordemA !== ordemB) return ordemA - ordemB

      const pesoStatus = getLocalStatusPeso(a.statusComercial) - getLocalStatusPeso(b.statusComercial)
      if (pesoStatus !== 0) return pesoStatus

      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
    })
  }, [locais])

  const ultimoInicioLocais = Math.max(0, locaisOrdenados.length - locaisPagina)

  useEffect(() => {
    setLocaisInicio(atual => Math.min(atual, ultimoInicioLocais))
  }, [ultimoInicioLocais])

  const locaisVisiveis = useMemo(() => {
    return locaisOrdenados.slice(locaisInicio, locaisInicio + locaisPagina)
  }, [locaisOrdenados, locaisInicio, locaisPagina])

  const localMaisProcuradoId = useMemo(() => {
    return locaisOrdenados.find(local => local.statusComercial === 'DISPONIVEL')?.id || locaisOrdenados[0]?.id
  }, [locaisOrdenados])
  const jornadasPublicas = useMemo(() => {
    const codigosPlanos = Array.from(new Set(planos.map(plano => plano?.trilhaCodigo).filter(Boolean)))
    const codigos = codigosPlanos.length ? codigosPlanos : ['comecando_do_zero', 'reta_final_prova']

    return codigos
      .map(codigo => {
        const base = getJornadaPublica(codigo)
        const totalPlanos = planos.filter(plano => plano?.trilhaCodigo === codigo).length
        return {
          ...base,
          badgeClass: getBadgeClassTrilhaPlano(codigo),
          totalPlanos,
        }
      })
      .sort((a, b) => getOrdemTrilhaPlano(a.codigo) - getOrdemTrilhaPlano(b.codigo))
  }, [planos])

  const homeContent = useMemo(() => resolveHomePageConfig(configHome || HOME_PAGE_DEFAULTS), [configHome])
  const heroBotaoSecundarioProps = homeContent.heroVideoUrl
    ? { href: homeContent.heroVideoUrl, target: '_blank', rel: 'noreferrer' }
    : { href: '#saiba-mais' }

  return (
    <div className="landing-page landing-page--eager landing-page--home">
      <section className="landing-topbar fade-in">
        <Link className="landing-topbar-brand" to="/">
          <BrandLogo variant="landing" showTagline />
        </Link>

        <div className="landing-topbar-actions">
          <ThemeToggle compact iconOnly />
          {user ? (
            <>
              <Link className="btn btn-ghost btn-sm" to={isAdmin ? '/admin/pedidos' : '/meus-acessos'}>
                {isAdmin ? (
                  'Pedidos'
                ) : (
                  <>
                    <span className="btn-label-full">Meus acessos</span>
                    <span className="btn-label-compact">Acessos</span>
                  </>
                )}
              </Link>
              <Link className="btn btn-primary btn-sm" to={isAdmin ? '/admin' : '/biblioteca'}>
                {isAdmin ? (
                  <>
                    <span className="btn-label-full">Abrir painel</span>
                    <span className="btn-label-compact">Painel</span>
                  </>
                ) : (
                  <>
                    <span className="btn-label-full">Minha biblioteca</span>
                    <span className="btn-label-compact">Biblioteca</span>
                  </>
                )}
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login">
                Entrar
              </Link>
              <Link className="btn btn-primary btn-sm" to="/register">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="hero-shell hero-shell--single fade-in">
        <div className="hero-copy">
          <div className="hero-kicker">{homeContent.heroKicker}</div>
          <h1 className="hero-title">{homeContent.heroTitulo}</h1>
          <p className="hero-subtitle">{homeContent.heroSubtitulo}</p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#locais-disponiveis">
              {homeContent.heroBotaoPrimarioTexto}
            </a>
            <a className="btn btn-ghost" {...heroBotaoSecundarioProps} title={homeContent.heroVideoTitulo}>
              {homeContent.heroBotaoSecundarioTexto}
            </a>
          </div>
        </div>
      </section>

      <RevealSection as="section" className="landing-section landing-section--home-journeys" delay={60} eager>
        <div className="section-title-row">
          <div>
            <div className="section-heading">Escolha o caminho certo para o seu momento</div>
            <div className="section-copy">
              Hoje a plataforma ja organiza os planos para quem quer comecar do zero e para quem ja esta focado na reta final da prova.
            </div>
          </div>
        </div>

        <div className="home-journey-grid">
          {jornadasPublicas.map(jornada => (
            <div key={jornada.codigo} className="home-journey-card">
              <div className="home-journey-card-top">
                <span className={`badge ${jornada.badgeClass}`}>{jornada.nome}</span>
                <span className="home-journey-card-count">
                  {jornada.totalPlanos > 0 ? `${jornada.totalPlanos} ${jornada.totalPlanos === 1 ? 'plano' : 'planos'} hoje` : 'perfil em preparacao'}
                </span>
              </div>
              <div className="home-journey-card-title">{jornada.titulo}</div>
              <div className="home-journey-card-copy">{jornada.copy}</div>
              <div className="home-journey-card-points">
                {jornada.pontos.map(item => (
                  <div key={item} className="home-journey-card-point">
                    <span className="home-journey-card-point-dot" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <a className="btn btn-ghost" href="#locais-disponiveis">
                Ver locais e planos
              </a>
            </div>
          ))}
        </div>
      </RevealSection>

      <RevealSection as="section" className="landing-section home-local-showcase-section" id="locais-disponiveis" delay={80} eager>
        <div className="home-local-showcase-shell">
          <div className="home-local-showcase-head">
            <div className="home-local-showcase-copy">
              <div className="home-local-showcase-title">{homeContent.secaoLocaisTitulo}</div>
              <p className="home-local-showcase-sub">{homeContent.secaoLocaisSubtitulo}</p>
            </div>

            <div className="home-local-showcase-nav" aria-label="Navegação dos locais de prova">
              <button
                type="button"
                className="home-local-showcase-nav-btn"
                onClick={() => setLocaisInicio(atual => Math.max(0, atual - 1))}
                disabled={locaisInicio === 0}
                aria-label="Ver locais anteriores"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m14.5 6.5-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="home-local-showcase-nav-btn"
                onClick={() => setLocaisInicio(atual => Math.min(ultimoInicioLocais, atual + 1))}
                disabled={locaisInicio >= ultimoInicioLocais}
                aria-label="Ver próximos locais"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m9.5 6.5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="spinner" />
          ) : erroLocais ? (
            <div className="empty-state">
              <div>{erroLocais}</div>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>
                Tentar novamente
              </button>
            </div>
          ) : locaisOrdenados.length === 0 ? (
            <div className="empty-state">Nenhum local de prova cadastrado ainda.</div>
          ) : (
            <>
              <div className="home-local-showcase-grid">
              {locaisVisiveis.map(local => {
                const totalAulas = (percursosPorLocal.get(local.slug) || []).length
                const estaDisponivel = local.statusComercial === 'DISPONIVEL'
                const resumoCard =
                  local.subtituloComercial?.trim() ||
                  local.mensagemPublica?.trim() ||
                  getCardLinha(local)
                const imagemLocal = resolveMediaUrl(local.imagemCardUrl || local.imagemPrincipalUrl)
                const tituloCard = local.tituloComercial?.trim() || local.nome
                const metaPrincipal = estaDisponivel
                      ? totalAulas > 0
                    ? `${String(totalAulas).padStart(2, '0')} ${totalAulas === 1 ? 'Aula' : 'Aulas'}`
                    : 'Planos em breve'
                  : local.statusComercial === 'PAUSADO'
                    ? 'Vendas pausadas'
                    : local.statusComercial === 'EM_BREVE'
                      ? 'Em breve'
                      : 'Em configuração'
                const exibirBadge = local.id === localMaisProcuradoId && estaDisponivel

                return (
                  <RevealSection
                    key={local.id}
                    as={Link}
                    to={`/locais/${local.slug}`}
                    className={`home-local-card home-local-card--${local.statusComercial.toLowerCase()}`}
                    delay={100}
                    eager
                  >
                    <div
                      className={`home-local-card-image-wrap ${imagemLocal ? 'home-local-card-image-wrap--image' : 'home-local-card-image-wrap--empty'}`}
                    >
                      {exibirBadge && <span className="home-local-card-badge">Mais Procurado</span>}
                      {imagemLocal ? (
                        <img
                          src={imagemLocal}
                          alt={`Imagem do local ${local.nome}`}
                          className="home-local-card-image"
                        />
                      ) : (
                        <div className="home-local-card-fallback">{tituloCard}</div>
                      )}
                    </div>

                    <div className="home-local-card-body">
                      <div className="home-local-card-city">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="10" r="2.4" fill="currentColor" />
                        </svg>
                        <span>{local.cidade || 'Local de prova'}</span>
                      </div>

                      <div className="home-local-card-title">{tituloCard}</div>
                      <div className="home-local-card-copy">{resumoCard}</div>
                    </div>

                    <div className="home-local-card-footer">
                      <span className="home-local-card-meta">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M14.75 7.75 9.5 11.25v-7l5.25 3.5Zm-7.25-3h9A1.75 1.75 0 0 1 18.25 6.5v11A1.75 1.75 0 0 1 16.5 19.25h-9A1.75 1.75 0 0 1 5.75 17.5v-11A1.75 1.75 0 0 1 7.5 4.75Z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>{metaPrincipal}</span>
                      </span>

                      <span className="home-local-card-link">
                        <span>{getCardCta(local)}</span>
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  </RevealSection>
                )
              })}
              </div>

            </>
          )}
        </div>
      </RevealSection>

      <RevealSection as="section" className="landing-section landing-section--home-faq" id="saiba-mais" delay={120} eager>
        <div className="section-title-row">
          <div>
            <div className="section-heading">{homeContent.faqTitulo}</div>
            <div className="section-copy">{homeContent.faqSubtitulo}</div>
          </div>
        </div>

        <div className="learn-more-list">
          {homeContent.faqItens.map(item => (
            <details key={item.pergunta} className="learn-more-item">
              <summary className="learn-more-summary">
                <span className="learn-more-title">{item.pergunta}</span>
                <span className="learn-more-toggle">
                  <span className="learn-more-toggle-open">Abrir</span>
                  <span className="learn-more-toggle-close">Fechar</span>
                </span>
              </summary>

              <div className="learn-more-body">
                <div className="learn-more-copy">{item.resposta}</div>
              </div>
            </details>
          ))}
        </div>
      </RevealSection>

      <RevealSection as="section" className="landing-cta landing-cta--home" delay={150} eager>
        <div>
          <div className="landing-cta-kicker">{homeContent.ctaFinalKicker}</div>
          <div className="landing-cta-title">{homeContent.ctaFinalTitulo}</div>
          <div className="landing-cta-copy">{homeContent.ctaFinalTexto}</div>
        </div>
        <div className="landing-cta-actions">
          {user ? (
            <Link className="btn btn-primary" to={isAdmin ? '/admin/locais' : '/biblioteca'}>
              {isAdmin ? 'Gerenciar locais' : 'Abrir minha biblioteca'}
            </Link>
          ) : (
            <a className="btn btn-primary" href="#locais-disponiveis">
              {homeContent.ctaFinalBotaoPrimarioTexto}
            </a>
          )}
          <Link className="btn btn-ghost" to={user ? (isAdmin ? '/admin/assinaturas' : '/meus-acessos') : '/register'}>
            {user ? (isAdmin ? 'Ver assinaturas' : 'Ver meus acessos') : homeContent.ctaFinalBotaoSecundarioTexto}
          </Link>
        </div>
      </RevealSection>

      <LandingFooter />
    </div>
  )
}
