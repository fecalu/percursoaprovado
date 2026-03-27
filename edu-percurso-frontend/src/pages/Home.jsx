import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import RevealSection from '../components/RevealSection'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { localProvaService, planoService } from '../services/api'
import { resolveMediaUrl } from '../utils/media'

function getCardLinha(local) {
  if (local.statusComercial === 'DISPONIVEL') {
    return 'Percursos mais frequentes e revisao pratica desse local.'
  }

  if (local.statusComercial === 'EM_BREVE') {
    return 'Esse local sera liberado assim que o conteudo estiver pronto.'
  }

  if (local.statusComercial === 'PAUSADO') {
    return 'As vendas desse local estao pausadas no momento.'
  }

  return 'Local em configuracao administrativa.'
}

function getCardCta(local) {
  if (local.statusComercial === 'DISPONIVEL') return 'Ver planos'
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

const SAIBA_MAIS = [
  {
    titulo: 'Como funciona',
    copy: 'Voce nao precisa consumir tudo de uma vez. O fluxo foi pensado para ser simples e objetivo antes da prova.',
    pontos: [
      'Escolha o local onde voce vai fazer a prova.',
      'Veja os percursos mais frequentes, os pontos de atencao e os erros que mais tiram pontos.',
      'Use simulacao, baliza e embreagem para chegar com mais controle e menos ansiedade.',
    ],
  },
  {
    titulo: 'O que esta incluido',
    copy: 'Cada local liberado traz um conjunto de modulos para voce revisar o que mais faz diferenca no exame.',
    pontos: [
      'Percurso real do local e simulacao completa da prova.',
      'Baliza, embreagem e leitura do que costuma ser avaliado.',
      'Apoio pratico para reduzir surpresa e estudar com mais criterio.',
    ],
  },
  {
    titulo: 'O que voce realmente ganha',
    copy: 'A rota chama atencao, mas o produto real e o preparo para chegar mais seguro no dia.',
    pontos: [
      'Menos surpresa ao entender como a prova costuma acontecer no seu local.',
      'Mais leitura da avaliacao para saber o que exige mais atencao.',
      'Mais confianca para dirigir com calma, criterio e preparo.',
    ],
  },
  {
    titulo: 'Perguntas comuns antes da compra',
    perguntas: [
      {
        pergunta: 'Isso garante o trajeto exato da minha prova?',
        resposta:
          'Nao. O foco e mostrar os percursos mais frequentes observados na pratica, para voce chegar mais preparado e menos surpreso.',
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
  },
]

export default function Home() {
  const { user, isAdmin } = useAuth()
  const [locais, setLocais] = useState([])
  const [planos, setPlanos] = useState([])
  const [loading, setLoading] = useState(true)
  const [locaisPagina, setLocaisPagina] = useState(() => getLocaisPorPagina(window.innerWidth))
  const [locaisInicio, setLocaisInicio] = useState(0)

  useEffect(() => {
    Promise.all([localProvaService.listar(), planoService.listar()])
      .then(([locaisResp, planosResp]) => {
        setLocais(locaisResp)
        setPlanos(planosResp)
      })
      .finally(() => setLoading(false))
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

  return (
    <div className="landing-page landing-page--eager landing-page--home">
      <section className="landing-topbar fade-in">
        <Link className="landing-topbar-brand" to="/">
          <BrandLogo variant="landing" showTagline />
        </Link>

        <div className="landing-topbar-actions">
          <ThemeToggle compact />
          {user ? (
            <>
              <Link className="btn btn-ghost btn-sm" to={isAdmin ? '/admin/pedidos' : '/meus-acessos'}>
                {isAdmin ? 'Pedidos' : 'Meus acessos'}
              </Link>
              <Link className="btn btn-primary btn-sm" to={isAdmin ? '/admin' : '/biblioteca'}>
                {isAdmin ? 'Abrir painel' : 'Minha biblioteca'}
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
          <div className="hero-kicker">Preparacao pratica por local de prova</div>
          <h1 className="hero-title">Descubra os percursos mais frequentes da sua prova pratica.</h1>
          <p className="hero-subtitle">
            Prepare-se com mais confianca usando videos reais, simulacoes e orientacoes baseadas
            nos trajetos mais recorrentes e no que mais pesa na avaliacao.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#locais-disponiveis">
              Escolher meu local de prova
            </a>
            <a className="btn btn-ghost" href="#saiba-mais">
              Ver como funciona
            </a>
          </div>
        </div>
      </section>

      <RevealSection as="section" className="landing-section" id="locais-disponiveis" delay={80} eager>
        <div className="home-local-showcase-head">
          <div className="home-local-showcase-copy">
            <div className="home-local-showcase-title">Escolha seu local de prova</div>
            <p className="home-local-showcase-sub">
              Temos o mapeamento dos principais polos ja disponiveis. Encontre o seu e
              comece a estudar com mais criterio.
            </p>
          </div>

          <div className="home-local-showcase-nav" aria-label="Navegacao dos locais de prova">
            <button
              type="button"
              className="home-local-showcase-nav-btn"
              onClick={() => setLocaisInicio(atual => Math.max(0, atual - 1))}
              disabled={locaisInicio === 0}
              aria-label="Ver locais anteriores"
            >
              <span aria-hidden="true">{'<'}</span>
            </button>
            <button
              type="button"
              className="home-local-showcase-nav-btn"
              onClick={() => setLocaisInicio(atual => Math.min(ultimoInicioLocais, atual + 1))}
              disabled={locaisInicio >= ultimoInicioLocais}
              aria-label="Ver proximos locais"
            >
              <span aria-hidden="true">{'>'}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : locaisOrdenados.length === 0 ? (
          <div className="empty-state">Nenhum local de prova cadastrado ainda.</div>
        ) : (
          <div className="home-local-showcase-grid">
            {locaisVisiveis.map(local => {
              const planosLocal = planosPorLocal.get(local.slug) || []
              const planoInicial = planosLocal[0]
              const estaDisponivel = local.statusComercial === 'DISPONIVEL'
              const resumoCard =
                local.subtituloComercial?.trim() ||
                local.mensagemPublica?.trim() ||
                getCardLinha(local)
              const imagemLocal = resolveMediaUrl(local.imagemCardUrl || local.imagemPrincipalUrl)
              const tituloCard = local.tituloComercial?.trim() || local.nome
              const metaPrincipal = estaDisponivel
                ? planosLocal.length > 0
                  ? `${planosLocal.length} ${planosLocal.length === 1 ? 'plano disponivel' : 'planos disponiveis'}`
                  : 'Planos em breve'
                : local.statusComercial === 'PAUSADO'
                  ? 'Vendas pausadas'
                  : local.statusComercial === 'EM_BREVE'
                    ? 'Em breve'
                    : 'Em configuracao'
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
                    {exibirBadge && <span className="home-local-card-badge">Mais procurado</span>}
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
                          d="M8 6.75h8M8 12h8m-8 5.25h5.5M6.5 3.75h11A1.75 1.75 0 0 1 19.25 5.5v13A1.75 1.75 0 0 1 17.5 20.25h-11A1.75 1.75 0 0 1 4.75 18.5v-13A1.75 1.75 0 0 1 6.5 3.75Z"
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
                      <span aria-hidden="true">{'->'}</span>
                    </span>
                  </div>
                </RevealSection>
              )
            })}
          </div>
        )}
      </RevealSection>

      <RevealSection as="section" className="landing-section" id="saiba-mais" delay={120} eager>
        <div className="section-title-row">
          <div>
            <div className="section-heading">Saiba mais antes de comprar</div>
            <div className="section-copy">Abra apenas o que voce quiser consultar e mantenha a pagina mais leve para navegar.</div>
          </div>
        </div>

        <div className="learn-more-list">
          {SAIBA_MAIS.map(item => (
            <details key={item.titulo} className="learn-more-item">
              <summary className="learn-more-summary">
                <span className="learn-more-title">{item.titulo}</span>
                <span className="learn-more-toggle">Abrir</span>
              </summary>

              <div className="learn-more-body">
                {item.copy && <div className="learn-more-copy">{item.copy}</div>}

                {item.pontos && (
                  <div className="learn-more-points">
                    {item.pontos.map(ponto => (
                      <div key={ponto} className="learn-more-point">
                        <span className="learn-more-point-dot" />
                        <span>{ponto}</span>
                      </div>
                    ))}
                  </div>
                )}

                {item.perguntas && (
                  <div className="learn-more-faq">
                    {item.perguntas.map(pergunta => (
                      <div key={pergunta.pergunta} className="learn-more-faq-item">
                        <div className="learn-more-faq-question">{pergunta.pergunta}</div>
                        <div className="learn-more-faq-answer">{pergunta.resposta}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </RevealSection>

      <RevealSection as="section" className="landing-cta" delay={150} eager>
        <div>
          <div className="landing-cta-kicker">Comece pelo seu local</div>
          <div className="landing-cta-title">Quanto antes voce estudar o padrao da prova, mais seguro chega no dia.</div>
          <div className="landing-cta-copy">
            Escolha o local de prova, veja o que ja esta liberado e comece a revisar com mais criterio, menos ansiedade e mais confianca.
          </div>
        </div>
        <div className="landing-cta-actions">
          {user ? (
            <Link className="btn btn-primary" to={isAdmin ? '/admin/locais' : '/biblioteca'}>
              {isAdmin ? 'Gerenciar locais' : 'Abrir minha biblioteca'}
            </Link>
          ) : (
            <a className="btn btn-primary" href="#locais-disponiveis">
              Ver locais liberados
            </a>
          )}
          <Link className="btn btn-ghost" to={user ? (isAdmin ? '/admin/assinaturas' : '/meus-acessos') : '/register'}>
            {user ? (isAdmin ? 'Ver assinaturas' : 'Ver meus acessos') : 'Criar conta e acompanhar'}
          </Link>
        </div>
      </RevealSection>
    </div>
  )
}
