import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import RevealSection from '../components/RevealSection'
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

function getCardResumo(local, planosLocal) {
  if (local.statusComercial === 'DISPONIVEL') {
    if (planosLocal.length > 0) {
      return 'Veja os detalhes desse local, escolha seu plano e libere o acesso automaticamente apos o pagamento.'
    }

    return 'Conteudo desse local ja liberado para compra e estudo.'
  }

  if (local.statusComercial === 'EM_BREVE') {
    return 'Esse local aparece no site para voce acompanhar, mas a compra so sera liberada quando o preparo estiver pronto.'
  }

  if (local.statusComercial === 'PAUSADO') {
    return 'O local continua cadastrado, mas a venda foi pausada temporariamente.'
  }

  return 'Local em configuracao administrativa.'
}

function getCardCta(local) {
  if (local.statusComercial === 'DISPONIVEL') return 'Ver planos e detalhes'
  if (local.statusComercial === 'EM_BREVE') return 'Acompanhar esse local'
  if (local.statusComercial === 'PAUSADO') return 'Ver status do local'
  return 'Abrir detalhes'
}

const FAIXA_CONFIANCA = [
  'Percursos mais frequentes observados na pratica',
  '1 local por compra, com acesso por periodo',
  'Pagamento por Pix ou cartao, com liberacao automatica',
]

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

  return (
    <div className="landing-page landing-page--eager">
      <section className="hero-shell hero-shell--single fade-in">
        <div className="hero-copy">
          <div className="hero-kicker">Preparacao pratica por local de prova</div>
          <h1 className="hero-title">Descubra os percursos mais frequentes da sua prova pratica.</h1>
          <p className="hero-subtitle">
            Prepare-se com mais confianca usando videos reais, simulacoes e orientacoes baseadas
            nos trajetos mais recorrentes e no que mais pesa na avaliacao.
          </p>
          <div className="hero-actions">
            {user ? (
              <Link className="btn btn-primary" to={isAdmin ? '/admin' : '/biblioteca'}>
                {isAdmin ? 'Abrir painel' : 'Ir para minha biblioteca'}
              </Link>
            ) : (
              <a className="btn btn-primary" href="#locais-disponiveis">
                Escolher meu local de prova
              </a>
            )}
            <Link className="btn btn-ghost" to={user ? (isAdmin ? '/admin/planos' : '/meus-acessos') : '/register'}>
              {user ? 'Ver meus acessos' : 'Criar conta e acompanhar'}
            </Link>
          </div>
          <div className="mini-copy" style={{ marginTop: '1rem', maxWidth: 680 }}>
            Os conteudos sao baseados em experiencia real, observacao pratica e analise dos percursos mais frequentes.
            O trajeto pode variar no dia da avaliacao.
          </div>
          <div className="hero-proof-grid">
            <div className="hero-proof-chip hero-proof-chip--strong">Mais confianca no dia da prova</div>
            <div className="hero-proof-chip">1 local por compra, com acesso por periodo</div>
            <div className="hero-proof-chip">Pagamento por Pix ou cartao</div>
          </div>
        </div>
      </section>

      <RevealSection as="section" className="landing-section" id="locais-disponiveis" delay={80} eager>
        <div className="page-title">Locais de prova</div>
        <p className="page-sub">Escolha o seu local e veja o que ja esta disponivel para estudar com mais confianca.</p>

        {loading ? (
          <div className="spinner" />
        ) : locais.length === 0 ? (
          <div className="empty-state">Nenhum local de prova cadastrado ainda.</div>
        ) : (
          <div className="card-grid">
            {locais.map(local => {
              const planosLocal = planosPorLocal.get(local.slug) || []
              const planoInicial = planosLocal[0]
              const estaDisponivel = local.statusComercial === 'DISPONIVEL'
              const rodapeEsquerdo = estaDisponivel
                ? `${planosLocal.length} ${planosLocal.length === 1 ? 'plano' : 'planos'}`
                : formatStatusComercialLocal(local.statusComercial)
              const rodapeDireito = estaDisponivel
                ? planoInicial ? `A partir de ${fmtMoeda(planoInicial.precoCentavos)}` : 'Planos em breve'
                : local.statusComercial === 'PAUSADO' ? 'Vendas pausadas' : 'Compra bloqueada'
              const destaqueLocal = estaDisponivel
                ? 'Compra liberada agora'
                : local.statusComercial === 'EM_BREVE'
                  ? 'Preparacao em andamento'
                  : local.statusComercial === 'PAUSADO'
                    ? 'Liberacao temporariamente pausada'
                    : 'Disponivel somente para administracao'
              const resumoCard = getCardResumo(local, planosLocal)
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
                  <div className="spotlight-brand-copy">
                    <div className="spotlight-accent">{destaqueLocal}</div>
                    <div className="spotlight-title">{local.nome}</div>
                  </div>
                  <div className="spotlight-desc">{local.descricao}</div>
                  <div className="spotlight-summary">{resumoCard}</div>
                  {!estaDisponivel && local.mensagemPublica && (
                    <div className="mini-copy">{local.mensagemPublica}</div>
                  )}
                  <div className="spotlight-footer">
                    <div className="spotlight-meta-block">
                      <span className="spotlight-meta-label">{rodapeEsquerdo}</span>
                      <span className="spotlight-meta-value">{rodapeDireito}</span>
                    </div>
                    <div className="spotlight-cta">
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

      <RevealSection as="section" className="landing-inline-strip" delay={100} eager>
        {FAIXA_CONFIANCA.map(item => (
          <div key={item} className="landing-inline-chip">
            {item}
          </div>
        ))}
      </RevealSection>

      <RevealSection as="section" className="landing-section" delay={120} eager>
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
