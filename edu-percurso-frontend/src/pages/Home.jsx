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
          <h1 className="hero-title">Veja o trajeto real da sua prova e estude com foco no local onde voce vai fazer o exame.</h1>
          <p className="hero-subtitle">
            Cada compra libera somente 1 local de prova, pela validade escolhida,
            com videos do trajeto real, simulacao completa e modulos de apoio. Pagamento via Pix ou cartao de credito.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to={user ? (isAdmin ? '/admin' : '/biblioteca') : '/register'}>
              {user ? (isAdmin ? 'Abrir painel' : 'Ir para minha biblioteca') : 'Criar conta'}
            </Link>
            <Link className="btn btn-ghost" to={user ? (isAdmin ? '/admin/planos' : '/meus-acessos') : '/login'}>
              {user ? 'Ver meus acessos' : 'Ja tenho conta'}
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-panel-title">Dentro de cada plano voce encontra</div>
          <div className="hero-list">
            <div className="hero-list-item">Percurso real gravado no local do exame.</div>
            <div className="hero-list-item">Simulacao completa da prova pratica.</div>
            <div className="hero-list-item">Baliza, embreagem e modulos de apoio.</div>
            <div className="hero-list-item">Erros que reprovam e o olhar do examinador.</div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="page-title">Locais de prova</div>
        <p className="page-sub">Escolha o local onde voce vai fazer o exame e veja o que ja esta disponivel ou em preparacao.</p>

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

              return (
                <Link key={local.id} to={`/locais/${local.slug}`} className="spotlight-card">
                  <div className="spotlight-city">{local.cidade}</div>
                  <div>
                    <span className={`badge ${getStatusBadgeClass(local.statusComercial)}`}>
                      {formatStatusComercialLocal(local.statusComercial)}
                    </span>
                  </div>
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
