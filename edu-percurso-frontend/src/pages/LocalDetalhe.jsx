import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import { localProvaService, pedidoService, planoService } from '../services/api'
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

function getMensagemDisponibilidade(local) {
  if (local?.mensagemPublica) return local.mensagemPublica
  if (local?.statusComercial === 'EM_BREVE') {
    return 'Estamos finalizando os conteudos desse local. Assim que tudo estiver pronto, a compra sera liberada.'
  }
  if (local?.statusComercial === 'PAUSADO') {
    return 'As vendas desse local estao temporariamente pausadas. Tente novamente em outro momento.'
  }
  if (local?.statusComercial === 'RASCUNHO') {
    return 'Esse local ainda esta em rascunho e nao foi aberto ao publico.'
  }
  return ''
}

export default function LocalDetalhe() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { show, ToastEl } = useToast()
  const [local, setLocal] = useState(null)
  const [planos, setPlanos] = useState([])
  const [loading, setLoading] = useState(true)
  const [solicitandoId, setSolicitandoId] = useState('')

  useEffect(() => {
    Promise.all([localProvaService.buscar(slug), planoService.listar({ localSlug: slug })])
      .then(([localResp, planosResp]) => {
        setLocal(localResp)
        setPlanos(planosResp)
      })
      .finally(() => setLoading(false))
  }, [slug])

  async function solicitarPlano(planoId) {
    setSolicitandoId(planoId)
    try {
      const pedido = await pedidoService.criar({ planoId })
      if (pedido.checkoutUrl) {
        window.location.href = pedido.checkoutUrl
        return
      }
      show('Pedido criado com sucesso.')
      setTimeout(() => navigate('/meus-pedidos'), 600)
    } catch (error) {
      const mensagem = error.response?.data?.erro || 'Nao foi possivel iniciar a compra.'
      show(mensagem, 'error')
      if (mensagem.includes('pedido pendente')) {
        setTimeout(() => navigate('/meus-pedidos'), 900)
      }
    } finally {
      setSolicitandoId('')
    }
  }

  function renderAcaoPlano(plano) {
    if (!user) {
      return (
        <Link className="btn btn-primary" to="/register">
          Criar conta para comprar
        </Link>
      )
    }

    if (isAdmin) {
      return (
        <button className="btn btn-ghost" onClick={() => navigate('/admin/planos')}>
          Gerenciar plano
        </button>
      )
    }

    return (
      <button
        className="btn btn-primary"
        onClick={() => solicitarPlano(plano.id)}
        disabled={solicitandoId === plano.id}
      >
        {solicitandoId === plano.id ? 'Abrindo pagamento...' : 'Comprar acesso'}
      </button>
    )
  }

  if (loading) return <div className="spinner" />
  if (!local) return <div className="empty-state">Local de prova nao encontrado.</div>

  const compraLiberada = local.statusComercial === 'DISPONIVEL'
  const mensagemDisponibilidade = getMensagemDisponibilidade(local)

  return (
    <div className="landing-page">
      {ToastEl}
      <Link className="back-link" to="/">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 4L6 10l7 6" />
        </svg>
        Voltar para os locais
      </Link>

      <section className="hero-shell fade-in">
        <div className="hero-copy">
          <div className="hero-kicker">Local de prova</div>
          <div style={{ marginTop: '0.9rem' }}>
            <span className={`badge ${getStatusBadgeClass(local.statusComercial)}`}>
              {formatStatusComercialLocal(local.statusComercial)}
            </span>
          </div>
          <h1 className="hero-title">{local.nome}</h1>
          <p className="hero-subtitle">
            {local.descricao} {compraLiberada
              ? 'Compre o acesso desse local e estude com o trajeto real, simulacao completa e modulos de apoio durante toda a validade.'
              : mensagemDisponibilidade}
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to={user ? (isAdmin ? '/admin' : '/biblioteca') : '/register'}>
              {user ? (isAdmin ? 'Abrir administracao' : 'Ir para minha biblioteca') : 'Criar conta para comprar'}
            </Link>
            <Link className="btn btn-ghost" to={user ? (isAdmin ? '/admin/pedidos' : '/meus-pedidos') : '/login'}>
              {user ? 'Ver meus pagamentos' : 'Entrar'}
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-panel-title">Esse plano inclui</div>
          <div className="hero-list">
            <div className="hero-list-item">Percurso real do local de prova.</div>
            <div className="hero-list-item">Simulacao completa do exame.</div>
            <div className="hero-list-item">Modulos gerais de baliza e embreagem.</div>
            <div className="hero-list-item">Conteudo orientado pelo olhar do examinador.</div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="page-title">{compraLiberada ? 'Planos disponiveis' : 'Disponibilidade do local'}</div>
        <p className="page-sub">
          {compraLiberada
            ? 'Escolha a validade ideal para o seu momento de preparacao.'
            : 'Esse local aparece no site, mas a compra fica bloqueada ate o administrador liberar as vendas.'}
        </p>

        {!compraLiberada ? (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className={`badge ${getStatusBadgeClass(local.statusComercial)}`}>
                {formatStatusComercialLocal(local.statusComercial)}
              </span>
              <span className="table-name">Compra indisponivel no momento</span>
            </div>
            <div className="mini-copy" style={{ marginTop: '0.9rem' }}>
              {mensagemDisponibilidade}
            </div>
            {isAdmin && (
              <div style={{ marginTop: '1rem' }}>
                <button className="btn btn-ghost" onClick={() => navigate('/admin/locais')}>
                  Ajustar status do local
                </button>
              </div>
            )}
          </div>
        ) : planos.length === 0 ? (
          <div className="empty-state">Esse local ainda nao possui planos ativos.</div>
        ) : (
          <div className="plan-grid">
            {planos.map(plano => (
              <div key={plano.id} className="plan-card">
                <div className="plan-badge">{formatPlanoDuracao(plano.duracaoDias)}</div>
                <div className="plan-name">{plano.nome}</div>
                <div className="plan-price">{fmtMoeda(plano.precoCentavos)}</div>
                <div className="plan-copy">Acesso ao local {local.nome} e aos modulos gerais durante toda a validade escolhida.</div>
                <div className="plan-meta">Validade: {formatPlanoDuracao(plano.duracaoDias)}</div>
                <div className="plan-meta">Pague com Pix ou cartao de credito pelo Mercado Pago.</div>
                <div style={{ marginTop: '1rem' }}>
                  {renderAcaoPlano(plano)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
