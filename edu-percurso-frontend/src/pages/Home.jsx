import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { localProvaService, planoService } from '../services/api'
import { formatPlanoDuracao, formatStatusComercialLocal } from '../utils/formatters'

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

const COMO_FUNCIONA = [
  {
    passo: '1',
    titulo: 'Escolha seu local',
    descricao: 'Selecione o local onde voce vai fazer a prova e veja o que ja esta liberado para estudar.',
  },
  {
    passo: '2',
    titulo: 'Entenda o padrao da prova',
    descricao: 'Revise os percursos mais frequentes, os pontos de atencao e os erros que mais tiram pontos.',
  },
  {
    passo: '3',
    titulo: 'Chegue com mais confianca',
    descricao: 'Use a simulacao, baliza e embreagem para reduzir ansiedade e dirigir com mais controle.',
  },
]

const GANHOS = [
  {
    titulo: 'Menos surpresa',
    descricao: 'Voce chega para a prova entendendo melhor como ela costuma acontecer no seu local.',
  },
  {
    titulo: 'Mais leitura da avaliacao',
    descricao: 'Aprenda a reconhecer o que costuma exigir mais atencao e o que pesa na prova.',
  },
  {
    titulo: 'Mais confianca ao dirigir',
    descricao: 'O foco nao e decorar rua. E dirigir com mais calma, criterio e preparo no dia do exame.',
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
    <div className="landing-page">
      <section className="hero-shell fade-in">
        <div className="hero-copy">
          <div className="hero-kicker">Preparacao pratica por local de prova</div>
          <h1 className="hero-title">Descubra os percursos mais frequentes da sua prova pratica.</h1>
          <p className="hero-subtitle">
            Prepare-se com mais confianca usando videos reais, simulacoes e orientacoes baseadas
            nos trajetos mais recorrentes, nos pontos de atencao e nos erros que mais tiram pontos.
          </p>
          <div className="hero-actions">
            {user ? (
              <Link className="btn btn-primary" to={isAdmin ? '/admin' : '/biblioteca'}>
                {isAdmin ? 'Abrir painel' : 'Ir para minha biblioteca'}
              </Link>
            ) : (
              <a className="btn btn-primary" href="#locais-disponiveis">
                Escolher meu local agora
              </a>
            )}
            <Link className="btn btn-ghost" to={user ? (isAdmin ? '/admin/planos' : '/meus-acessos') : '/register'}>
              {user ? 'Ver meus acessos' : 'Criar minha conta'}
            </Link>
          </div>
          <div className="mini-copy" style={{ marginTop: '1rem', maxWidth: 680 }}>
            Os conteudos sao baseados em experiencia real, observacao pratica e analise dos percursos mais frequentes.
            O trajeto pode variar no dia da avaliacao.
          </div>
          <div className="hero-proof-grid">
            <div className="hero-proof-chip">Mais confianca no dia da prova</div>
            <div className="hero-proof-chip">1 local por compra, com acesso por periodo</div>
            <div className="hero-proof-chip">Pagamento por Pix ou cartao</div>
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-panel-title">Dentro de cada plano voce encontra</div>
          <div className="hero-list">
            <div className="hero-list-item">Percursos mais frequentes observados na pratica.</div>
            <div className="hero-list-item">Simulacao completa para entender como a prova costuma acontecer.</div>
            <div className="hero-list-item">Baliza, embreagem e apoio para dirigir com mais controle.</div>
            <div className="hero-list-item">Erros que mais tiram pontos e o que costuma ser avaliado.</div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-title-row">
          <div>
            <div className="section-heading">Como funciona</div>
            <div className="section-copy">Um caminho simples para estudar com foco no que mais ajuda antes da prova.</div>
          </div>
        </div>

        <div className="story-grid">
          {COMO_FUNCIONA.map(item => (
            <div key={item.passo} className="story-card">
              <div className="story-step">{item.passo}</div>
              <div className="story-title">{item.titulo}</div>
              <div className="story-copy">{item.descricao}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="section-title-row">
          <div>
            <div className="section-heading">O que voce realmente ganha</div>
            <div className="section-copy">A rota chama atencao. O produto real e a confianca para chegar mais preparado.</div>
          </div>
        </div>

        <div className="signal-grid">
          {GANHOS.map(item => (
            <div key={item.titulo} className="signal-card">
              <div className="signal-title">{item.titulo}</div>
              <div className="signal-copy">{item.descricao}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" id="locais-disponiveis">
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

              return (
                <Link key={local.id} to={`/locais/${local.slug}`} className={`spotlight-card ${getSpotlightCardClass(local.statusComercial)}`}>
                  <div className="spotlight-top">
                    <div className="spotlight-city">{local.cidade}</div>
                    <span className={`badge ${getStatusBadgeClass(local.statusComercial)}`}>
                      {formatStatusComercialLocal(local.statusComercial)}
                    </span>
                  </div>
                  <div className="spotlight-accent">{destaqueLocal}</div>
                  <div className="spotlight-title">{local.nome}</div>
                  <div className="spotlight-desc">{local.descricao}</div>
                  {!estaDisponivel && local.mensagemPublica && (
                    <div className="mini-copy">{local.mensagemPublica}</div>
                  )}
                  {estaDisponivel && planosLocal.length > 0 && (
                    <div className="mini-copy">
                      Planos: {planosLocal.map(plano => formatPlanoDuracao(plano.duracaoDias)).join(', ')}
                    </div>
                  )}
                  <div className="spotlight-footer">
                    <span>{rodapeEsquerdo}</span>
                    <span>{rodapeDireito}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
