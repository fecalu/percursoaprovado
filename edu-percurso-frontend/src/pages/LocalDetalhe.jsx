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

function getPlanoIndicacao(duracaoDias) {
  if (duracaoDias <= 30) return 'Ideal para quem vai fazer a prova em breve.'
  if (duracaoDias <= 90) return 'Bom para revisar com calma nas proximas semanas.'
  if (duracaoDias <= 180) return 'Mais tempo para praticar, revisar e voltar quando precisar.'
  return 'Acesso mais longo para uma preparacao estendida.'
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
          <div className="hero-kicker">Preparacao por local de prova</div>
          <div style={{ marginTop: '0.9rem' }}>
            <span className={`badge ${getStatusBadgeClass(local.statusComercial)}`}>
              {formatStatusComercialLocal(local.statusComercial)}
            </span>
          </div>
          <h1 className="hero-title">Prepare-se melhor para a prova em {local.nome}.</h1>
          <p className="hero-subtitle">
            {compraLiberada
              ? `Veja como a prova costuma acontecer nesse local, conheca os trechos mais recorrentes, os pontos de atencao e os erros que mais tiram pontos. ${local.descricao || ''}`.trim()
              : `${local.descricao || ''} ${mensagemDisponibilidade}`.trim()}
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to={user ? (isAdmin ? '/admin' : '/biblioteca') : '/register'}>
              {user ? (isAdmin ? 'Abrir administracao' : 'Ir para minha biblioteca') : 'Criar conta para comprar'}
            </Link>
            <Link className="btn btn-ghost" to={user ? (isAdmin ? '/admin/pedidos' : '/meus-pedidos') : '/login'}>
              {user ? 'Ver meus pagamentos' : 'Entrar'}
            </Link>
          </div>
          <div className="mini-copy" style={{ marginTop: '1rem', maxWidth: 680 }}>
            Os conteudos refletem experiencia real, observacao pratica e os percursos mais frequentes desse local.
            O trajeto da avaliacao pode variar.
          </div>
          <div className="hero-proof-grid">
            <div className="hero-proof-chip">Trechos mais recorrentes desse local</div>
            <div className="hero-proof-chip">Conteudo direto para reduzir surpresa e ansiedade</div>
            <div className="hero-proof-chip">Liberacao automatica apos confirmacao do pagamento</div>
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-panel-title">O que voce vai encontrar</div>
          <div className="hero-list">
            <div className="hero-list-item">Percursos mais frequentes e pontos de atencao desse local.</div>
            <div className="hero-list-item">Simulacao completa para entender como a prova costuma acontecer.</div>
            <div className="hero-list-item">Baliza e embreagem para dirigir com mais controle.</div>
            <div className="hero-list-item">Erros que mais tiram pontos e o que costuma ser avaliado.</div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="page-title">{compraLiberada ? 'Escolha seu periodo de acesso' : 'Disponibilidade do local'}</div>
        <p className="page-sub">
          {compraLiberada
            ? 'Tenha acesso ao preparo completo desse local durante a validade escolhida.'
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
                <div className="plan-highlight">{getPlanoIndicacao(plano.duracaoDias)}</div>
                <div className="plan-copy">
                  Acesso ao preparo desse local, com percursos mais frequentes, simulacao e modulos gerais
                  para chegar com menos surpresa e mais confianca no dia da prova.
                </div>
                <div className="plan-meta">Validade: {formatPlanoDuracao(plano.duracaoDias)}</div>
                <div className="plan-meta">Pague com Pix ou cartao de credito pelo Mercado Pago.</div>
                <div className="plan-meta">Compra unica, sem renovacao automatica.</div>
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
