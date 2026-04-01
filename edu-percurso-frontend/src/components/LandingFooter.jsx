import { Link, useLocation } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import RevealSection from './RevealSection'
import { useAuth } from '../context/AuthContext'

const EMAIL_SUPORTE = 'suporte@percursoaprovado.com.br'

function buildMailto(subject) {
  return `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(subject)}`
}

function FooterIcon({ children, label, href }) {
  return (
    <a className="landing-footer-icon-link" href={href} aria-label={label} title={label}>
      {children}
    </a>
  )
}

export default function LandingFooter({ sectionPrefix = '' }) {
  const { user, isAdmin } = useAuth()
  const location = useLocation()
  const prefix = sectionPrefix || ''
  const areaLink = isAdmin ? '/admin' : user ? '/biblioteca' : '/login'
  const areaLabel = isAdmin ? 'Painel administrativo' : 'Área do aluno'
  const estaForaDaHome = location.pathname !== '/'
  const locaisHref = prefix ? `${prefix}#locais-disponiveis` : estaForaDaHome ? '/#locais-disponiveis' : '#locais-disponiveis'
  const ajudaHref = prefix ? `${prefix}#saiba-mais` : estaForaDaHome ? '/#saiba-mais' : '#saiba-mais'

  return (
    <RevealSection as="footer" className="landing-footer" delay={180} eager>
      <div className="landing-footer-main">
        <div className="landing-footer-brand">
          <Link className="landing-footer-brand-link" to="/">
            <BrandLogo variant="landing" />
          </Link>
          <p className="landing-footer-brand-copy">
            Ajudando futuros motoristas a conquistarem sua CNH com confiança e preparação técnica.
          </p>
          <div className="landing-footer-icon-row">
            <FooterIcon label="Ir para os locais de prova" href={locaisHref}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="10" r="2.3" fill="currentColor" />
              </svg>
            </FooterIcon>
            <FooterIcon label="Falar com suporte" href={buildMailto('Contato Percurso Aprovado')}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 6.75h16v10.5H4z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="m5 8 7 5 7-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </FooterIcon>
            <FooterIcon label={areaLabel} href={areaLink}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7a6 6 0 0 1 12 0"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </FooterIcon>
          </div>
        </div>

        <div className="landing-footer-column">
          <div className="landing-footer-heading">Plataforma</div>
          <div className="landing-footer-links">
            <a href={ajudaHref}>Como Funciona</a>
            <a href={locaisHref}>Locais de Prova</a>
            <a href={locaisHref}>Preços</a>
            <Link to={areaLink}>{areaLabel}</Link>
          </div>
        </div>

        <div className="landing-footer-column">
          <div className="landing-footer-heading">Suporte</div>
          <div className="landing-footer-links">
            <a href={ajudaHref}>Central de Ajuda</a>
            <a href={ajudaHref}>Dúvidas Frequentes</a>
            <a href={buildMailto('Contato Percurso Aprovado')}>Contato</a>
          </div>
        </div>

        <div className="landing-footer-column">
          <div className="landing-footer-heading">Legal</div>
          <div className="landing-footer-links">
            <Link to="/termos-de-uso">Termos de Uso</Link>
            <Link to="/politica-de-privacidade">Política de Privacidade</Link>
            <a href={buildMailto('Dúvidas sobre reembolso')}>Garantia de Reembolso</a>
          </div>
        </div>
      </div>

      <div className="landing-footer-bottom">
        <span>&copy; 2026 Percurso Aprovado. Todos os direitos reservados.</span>
        <span>Feito com cuidado para a sua aprovação</span>
      </div>
    </RevealSection>
  )
}
