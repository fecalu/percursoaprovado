import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assinaturaService, pedidoService } from '../services/api'
import { filtrarAssinaturasLiberadasAgora } from '../utils/access'
import { formatDataCurta, formatPlanoDuracao, resolveSituacaoPedido } from '../utils/formatters'

function pluralizar(total, singular, plural) {
  return `${total} ${total === 1 ? singular : plural}`
}

export default function PainelAluno() {
  const navigate = useNavigate()
  const [assinaturas, setAssinaturas] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true

    Promise.allSettled([assinaturaService.minhas(), pedidoService.minhas()])
      .then(([assinaturasResp, pedidosResp]) => {
        if (!ativo) return
        if (assinaturasResp.status === 'fulfilled') setAssinaturas(assinaturasResp.value)
        if (pedidosResp.status === 'fulfilled') setPedidos(pedidosResp.value)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  const acessosAtivos = useMemo(
    () => filtrarAssinaturasLiberadasAgora(assinaturas),
    [assinaturas]
  )

  const pedidosPendentes = useMemo(
    () => pedidos.filter(item => resolveSituacaoPedido(item.status, item.solicitacaoCancelamentoStatus, item.paymentStatus) === 'AGUARDANDO_PAGAMENTO'),
    [pedidos]
  )

  const ultimoAcessoAtivo = useMemo(() => {
    return [...acessosAtivos]
      .sort((a, b) => new Date(b.inicioEm || b.criadoEm || 0) - new Date(a.inicioEm || a.criadoEm || 0))[0] || null
  }, [acessosAtivos])

  const ultimoPedidoPendente = useMemo(() => {
    return [...pedidosPendentes]
      .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0))[0] || null
  }, [pedidosPendentes])

  const resumoHero = useMemo(() => {
    if (ultimoAcessoAtivo) {
      return {
        badgeClass: 'badge-green',
        badgeLabel: 'Acesso ativo',
        meta: `Válido até ${formatDataCurta(ultimoAcessoAtivo.fimEm)}`,
        title: ultimoAcessoAtivo.localProvaNome,
        copy: `Seu plano ${ultimoAcessoAtivo.planoNome} está liberado por ${formatPlanoDuracao(ultimoAcessoAtivo.duracaoDias)}. Abra sua biblioteca e continue seus estudos do jeito mais rápido.`,
        primaryLabel: 'Abrir biblioteca',
        primaryAction: () => navigate('/biblioteca'),
        secondaryLabel: 'Ver meus acessos',
        secondaryAction: () => navigate('/meus-acessos'),
      }
    }

    if (ultimoPedidoPendente) {
      return {
        badgeClass: 'badge-warn',
        badgeLabel: 'Pagamento pendente',
        meta: ultimoPedidoPendente.localProvaNome,
        title: 'Finalize sua compra para liberar o acesso',
        copy: `Existe um pedido do plano ${ultimoPedidoPendente.planoNome} aguardando confirmação. Assim que o pagamento entrar, o material aparece automaticamente na sua biblioteca.`,
        primaryLabel: 'Ir para pagamentos',
        primaryAction: () => navigate('/meus-pedidos'),
        secondaryLabel: 'Ver local',
        secondaryAction: () => navigate(`/locais/${ultimoPedidoPendente.localProvaSlug}`),
      }
    }

    return {
      badgeClass: 'badge-blue',
      badgeLabel: 'Comece agora',
      meta: 'Sua conta está pronta',
      title: 'Escolha um local e libere seu material',
      copy: 'Quando você contratar um plano, seus conteúdos, pagamentos e acessos ficam organizados aqui no painel para acompanhar tudo com mais clareza.',
      primaryLabel: 'Ver locais disponíveis',
      primaryAction: () => navigate('/'),
      secondaryLabel: pedidos.length > 0 ? 'Ver meus pagamentos' : '',
      secondaryAction: () => navigate('/meus-pedidos'),
    }
  }, [navigate, pedidos.length, ultimoAcessoAtivo, ultimoPedidoPendente])

  const cards = useMemo(() => {
    const totalAcessosAtivos = acessosAtivos.length
    const totalPedidosPendentes = pedidosPendentes.length

    return [
      {
        id: 'biblioteca',
        badgeClass: totalAcessosAtivos > 0 ? 'badge-green' : 'badge-gray',
        badgeLabel: totalAcessosAtivos > 0 ? 'Liberada' : 'Aguardando acesso',
        meta: totalAcessosAtivos > 0 ? pluralizar(totalAcessosAtivos, 'acesso ativo', 'acessos ativos') : 'Sem plano ativo agora',
        title: 'Biblioteca',
        copy: totalAcessosAtivos > 0
          ? 'Acesse todo o material liberado, revise percursos e continue seus estudos sem precisar procurar a próxima etapa.'
          : 'Assim que um plano estiver ativo, sua biblioteca vira o centro do seu estudo com todos os conteúdos liberados.',
        ctaLabel: totalAcessosAtivos > 0 ? 'Abrir biblioteca' : 'Ver locais',
        ctaAction: () => navigate(totalAcessosAtivos > 0 ? '/biblioteca' : '/'),
      },
      {
        id: 'acessos',
        badgeClass: totalAcessosAtivos > 0 ? 'badge-blue' : 'badge-gray',
        badgeLabel: totalAcessosAtivos > 0 ? 'Em andamento' : 'Sem acesso ativo',
        meta: totalAcessosAtivos > 0 ? 'Validades e planos em um só lugar' : 'Veja histórico e validade',
        title: 'Meus acessos',
        copy: 'Consulte quais locais estão liberados, por quanto tempo cada acesso continua valendo e o que já foi encerrado.',
        ctaLabel: 'Ver acessos',
        ctaAction: () => navigate('/meus-acessos'),
      },
      {
        id: 'pagamentos',
        badgeClass: totalPedidosPendentes > 0 ? 'badge-warn' : 'badge-blue',
        badgeLabel: totalPedidosPendentes > 0 ? 'Pagamento pendente' : 'Tudo organizado',
        meta: totalPedidosPendentes > 0 ? pluralizar(totalPedidosPendentes, 'pedido aguardando pagamento', 'pedidos aguardando pagamento') : 'Histórico e comprovações',
        title: 'Meus pagamentos',
        copy: 'Acompanhe compras, pagamentos pendentes, pedidos concluídos e solicitações ligadas ao seu acesso.',
        ctaLabel: 'Ver pagamentos',
        ctaAction: () => navigate('/meus-pedidos'),
      },
    ]
  }, [acessosAtivos.length, navigate, pedidosPendentes.length])

  if (loading) return <div className="spinner" />

  return (
    <div className="student-dashboard-page">
      <div className="student-shell student-shell--compact">
        <section className="student-library-head">
          <div>
            <div className="page-title">Seu painel</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Veja seus acessos, continue seus estudos e acompanhe sua conta em um só lugar.
            </p>
          </div>

          <div className="student-kpi-strip">
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{acessosAtivos.length}</span>
              <span className="student-kpi-pill-label">Acessos ativos</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{pedidosPendentes.length}</span>
              <span className="student-kpi-pill-label">Pagamentos pendentes</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{pedidos.length}</span>
              <span className="student-kpi-pill-label">Pedidos no histórico</span>
            </div>
          </div>
        </section>
      </div>

      <section className="student-card student-dashboard-hero-card">
        <div className="student-dashboard-hero">
          <div className="student-dashboard-hero-body">
            <div className="student-card-top">
              <span className={`badge ${resumoHero.badgeClass}`}>{resumoHero.badgeLabel}</span>
              <span className="student-dashboard-hero-meta">{resumoHero.meta}</span>
            </div>
            <div className="student-card-title">{resumoHero.title}</div>
            <div className="student-card-copy student-dashboard-hero-copy">{resumoHero.copy}</div>
          </div>

          <div className="student-card-actions student-dashboard-hero-actions">
            <button className="btn btn-primary" onClick={resumoHero.primaryAction}>
              {resumoHero.primaryLabel}
            </button>
            {resumoHero.secondaryLabel && (
              <button className="btn btn-ghost" onClick={resumoHero.secondaryAction}>
                {resumoHero.secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="student-grid student-dashboard-grid">
        {cards.map(card => (
          <article key={card.id} className="student-card student-dashboard-card">
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
      </section>
    </div>
  )
}
