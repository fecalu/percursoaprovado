import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import RevealSection from '../components/RevealSection'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { localProvaService, planoService } from '../services/api'
import { formatStatusComercialLocal } from '../utils/formatters'
import { resolveMediaUrl } from '../utils/media'

function fmtMoeda(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((centavos || 0) / 100)
}

function getStatusBadgeClass(statusComercial) {
  if (statusComercial === 'DISPONIVEL') return 'badge-green'
  if (statusComercial === 'EM_BREVE') return 'badge-warn'
  if (statusComercial === 'PAUSADO') return 'badge-red'
  return 'badge-gray'
}

function getSpotlightCardClass(statusComercial) {
  if (statusComercial === 'DISPONIVEL') return 'spotlight-card--available'
  if (statusComercial === 'EM_BREVE') return 'spotlight-card--soon'
  if (statusComercial === 'PAUSADO') return 'spotlight-card--paused'
  return 'spotlight-card--draft'
}

function getCardLinha(local) {
  if (local.statusComercial === 'DISPONIVEL') {
    return 'Percursos mais frequentes, pontos de atencao e revisao pratica desse local.'
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

function getLocalSortValue(statusComercial) {
  if (statusComercial === 'DISPONIVEL') return 0
  if (statusComercial === 'EM_BREVE') return 1
  if (statusComercial === 'PAUSADO') return 2
  return 3
}

const HERO_BENEFICIOS = [
  'Percurso real do local',
  'Pontos de atencao no video',
  'Baliza e embreagem',
]

const MODULOS_DESTAQUE = [
  {
    titulo: 'Percurso real',
    copy: 'Veja os trajetos mais frequentes observados na pratica para reduzir surpresa no dia da prova.',
  },
  {
    titulo: 'Pontos de atencao',
    copy: 'Entenda onde o percurso pede mais cuidado e revise cada trecho com mais criterio.',
  },
  {
    titulo: 'Baliza e embreagem',
    copy: 'Revise os movimentos que mais exigem controle antes de repetir no carro no dia da prova.',
  },
]

const PASSOS = [
  {
    titulo: 'Escolha seu local',
    copy: 'Selecione o local onde voce vai fazer a prova e veja os planos disponiveis para aquele acesso.',
  },
  {
    titulo: 'Libere seu acesso',
    copy: 'Finalize o pagamento com Pix ou cartao e receba a liberacao automaticamente na sua conta.',
  },
  {
    titulo: 'Revise com mais criterio',
    copy: 'Estude os percursos, os pontos de atencao e os modulos praticos no seu ritmo antes da prova.',
  },
]

const FAQ = [
  {
    pergunta: 'Isso garante o trajeto exato da minha prova?',
    resposta:
      'Nao. O foco e mostrar os percursos mais frequentes observados na pratica para voce chegar menos surpreso e mais preparado.',
  },
  {
    pergunta: 'Comprei um local. Tenho acesso aos outros?',
    resposta:
      'Nao. Cada compra libera apenas um local, pelo periodo escolhido. Se quiser outro local, a compra e separada.',
  },
  {
    pergunta: 'Por quanto tempo posso revisar?',
    resposta:
      'Durante todo o periodo do plano escolhido, com liberdade para voltar ao conteudo quando quiser.',
  },
]

export default function Home() {
  const { user, isAdmin } = useAuth()
  const [locais, setLocais] = useState([])
  const [planos, setPlanos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([localProvaService.listar(), planoService.listar()])
      .then(([locaisResp, planosResp]) => {
        setLocais(locaisResp)
        setPlanos(planosResp)
      })
      .finally(() => setLoading(false))
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
      const diffStatus = getLocalSortValue(a.statusComercial) - getLocalSortValue(b.statusComercial)
      if (diffStatus !== 0) return diffStatus
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
    })
  }, [locais])

  return (
    <div className="landing-page landing-page--eager landing-page--home">
      <section className="landing-topbar fade-in">
        <Link className="landing-topbar-brand" to="/">
          <BrandLogo variant="landing" showTagline />
        </Link>

        <div className="landing-topbar-nav" aria-label="Navegacao principal">
          <a className="landing-topbar-link" href="#como-funciona">Como funciona</a>
          <a className="landing-topbar-link" href="#locais-disponiveis">Locais</a>
          <a className="landing-topbar-link" href="#faq">Perguntas</a>
        </div>

        <div className="landing-topbar-actions">
          <ThemeToggle compact />
          {user ? (
            <>
              <Link className="btn btn-ghost btn-sm" to={isAdmin ? '/admin/pedidos' : '/meus-acessos'}>
                {isAdmin ? 'Pedidos' : 'Meus acessos'}
              </Link>
              <Link className="btn btn-primary btn-sm" to={isAdmin ? '/admin' : '/painel'}>
                {isAdmin ? 'Abrir painel' : 'Meu painel'}
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
          <h1 className="hero-title">Passe mais preparado na prova pratica do seu local.</h1>
          <p className="hero-subtitle">
            Revise o que mais pesa na avaliacao com um acesso organizado por local, sem precisar
            procurar informacao solta antes do dia da prova.
          </p>

          <div className="hero-bullet-grid">
            {HERO_BENEFICIOS.map(item => (
              <div key={item} className="hero-bullet-item">
                <span className="hero-bullet-dot" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="hero-actions">
            <a className="btn btn-primary" href="#locais-disponiveis">
              Escolher meu local
            </a>
            <a className="btn btn-ghost" href="#como-funciona">
              Ver como funciona
            </a>
          </div>
        </div>
      </section>

      <RevealSection as="section" className="landing-section" id="locais-disponiveis" delay={80} eager>
        <div className="section-title-row">
          <div>
            <div className="section-heading">Escolha o seu local de prova</div>
            <div className="section-copy">Veja o que ja esta disponivel para revisar com mais confianca antes da prova.</div>
          </div>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : locaisOrdenados.length === 0 ? (
          <div className="empty-state">Nenhum local de prova cadastrado ainda.</div>
        ) : (
          <div className="spotlight-grid">
            {locaisOrdenados.map(local => {
              const planosLocal = planosPorLocal.get(local.slug) || []
              const planoInicial = planosLocal[0]
              const estaDisponivel = local.statusComercial === 'DISPONIVEL'
              const metaPrincipal = estaDisponivel
                ? planoInicial ? `A partir de ${fmtMoeda(planoInicial.precoCentavos)}` : 'Planos em breve'
                : local.statusComercial === 'PAUSADO' ? 'Vendas pausadas' : 'Compra bloqueada'
              const imagemLocal = resolveMediaUrl(local.imagemCardUrl || local.imagemPrincipalUrl)

              return (
                <RevealSection
                  key={local.id}
                  as={Link}
                  to={`/locais/${local.slug}`}
                  className={`spotlight-card ${getSpotlightCardClass(local.statusComercial)}`}
                  delay={100}
                  eager
                >
                  <div className="spotlight-top">
                    <div className="spotlight-city">{local.cidade}</div>
                    <span className={`badge ${getStatusBadgeClass(local.statusComercial)}`}>
                      {formatStatusComercialLocal(local.statusComercial)}
                    </span>
                  </div>
                  <div className={`spotlight-mark ${imagemLocal ? 'spotlight-mark--image' : 'spotlight-mark--empty'}`}>
                    {imagemLocal ? (
                      <img
                        src={imagemLocal}
                        alt={`Imagem do local ${local.nome}`}
                        className="spotlight-mark-image"
                      />
                    ) : (
                      <div className="spotlight-mark-fallback">{local.nome}</div>
                    )}
                  </div>
                  <div className="spotlight-main">
                    {estaDisponivel && <div className="spotlight-eyebrow">Liberado para compra</div>}
                    <div className="spotlight-title">{local.nome}</div>
                    <div className="spotlight-copy">{getCardLinha(local)}</div>
                  </div>
                  {!estaDisponivel && local.mensagemPublica && (
                    <div className="mini-copy">{local.mensagemPublica}</div>
                  )}
                  <div className="spotlight-footer">
                    <span className={`spotlight-footer-meta ${estaDisponivel ? 'spotlight-footer-meta--available' : ''}`}>
                      {metaPrincipal}
                    </span>
                    <div className={`spotlight-cta ${estaDisponivel ? 'spotlight-cta--available' : ''}`}>
                      <span>{getCardCta(local)}</span>
                      <span className="spotlight-cta-arrow">{'->'}</span>
                    </div>
                  </div>
                </RevealSection>
              )
            })}
          </div>
        )}
      </RevealSection>

      <RevealSection as="section" className="landing-section" delay={120} eager>
        <div className="section-title-row">
          <div>
            <div className="section-heading">O que voce encontra dentro do acesso</div>
            <div className="section-copy">
              So o que realmente ajuda antes da prova, de forma mais clara e objetiva.
            </div>
          </div>
        </div>

        <div className="signal-grid">
          {MODULOS_DESTAQUE.map(item => (
            <div key={item.titulo} className="signal-card">
              <div className="signal-title">{item.titulo}</div>
              <div className="signal-copy">{item.copy}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      <RevealSection as="section" className="landing-section" id="como-funciona" delay={140} eager>
        <div className="section-title-row">
          <div>
            <div className="section-heading">Como funciona</div>
            <div className="section-copy">O caminho foi pensado para ser simples, direto e util antes do dia da prova.</div>
          </div>
        </div>

        <div className="story-grid">
          {PASSOS.map((item, index) => (
            <div key={item.titulo} className="story-card">
              <div className="story-step">{index + 1}</div>
              <div className="story-title">{item.titulo}</div>
              <div className="story-copy">{item.copy}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      <RevealSection as="section" className="landing-section" id="faq" delay={160} eager>
        <div className="section-title-row">
          <div>
            <div className="section-heading">Saiba mais antes de comprar</div>
            <div className="section-copy">Respostas curtas para as duvidas que mais aparecem antes da decisao.</div>
          </div>
        </div>

        <div className="learn-more-list">
          {FAQ.map(item => (
            <details key={item.pergunta} className="learn-more-item">
              <summary className="learn-more-summary">
                <span className="learn-more-title">{item.pergunta}</span>
                <span className="learn-more-toggle">Abrir</span>
              </summary>

              <div className="learn-more-body">
                <div className="learn-more-copy">{item.resposta}</div>
              </div>
            </details>
          ))}
        </div>
      </RevealSection>

      <RevealSection as="section" className="landing-cta" delay={180} eager>
        <div>
          <div className="landing-cta-kicker">Comece pelo seu local</div>
          <div className="landing-cta-title">Escolha seu local e comece a revisar hoje.</div>
          <div className="landing-cta-copy">
            Veja os planos disponiveis e organize sua revisao pratica com mais clareza antes da prova.
          </div>
        </div>
        <div className="landing-cta-actions">
          {user ? (
            <Link className="btn btn-primary" to={isAdmin ? '/admin/locais' : '/painel'}>
              {isAdmin ? 'Gerenciar locais' : 'Abrir meu painel'}
            </Link>
          ) : (
            <a className="btn btn-primary" href="#locais-disponiveis">
              Ver locais liberados
            </a>
          )}
          <Link className="btn btn-ghost" to={user ? (isAdmin ? '/admin/assinaturas' : '/meus-acessos') : '/register'}>
            {user ? (isAdmin ? 'Ver assinaturas' : 'Ver meus acessos') : 'Criar conta'}
          </Link>
        </div>
      </RevealSection>
    </div>
  )
}
