import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import LandingFooter from './LandingFooter'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../context/AuthContext'

export default function LegalPageLayout({ title, intro, updatedAt, sections, children }) {
  const { user, isAdmin } = useAuth()

  return (
    <div className="landing-page landing-page--eager landing-page--legal">
      <section className="landing-topbar landing-topbar--simple fade-in">
        <Link className="landing-topbar-brand" to="/">
          <BrandLogo variant="landing" showTagline />
        </Link>

        <div className="landing-topbar-actions">
          <ThemeToggle compact iconOnly />
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

      <section className="hero-shell hero-shell--single hero-shell--legal fade-in">
        <div className="hero-copy hero-copy--legal">
          <div className="hero-kicker">Informações legais</div>
          <h1 className="hero-title">{title}</h1>
          <p className="hero-subtitle">{intro}</p>
          {updatedAt && <div className="hero-inline-copy hero-inline-copy--legal">Atualizado em {updatedAt}</div>}
        </div>
      </section>

      <section className="landing-section landing-section--legal fade-in">
        <article className="legal-card">
          {sections.map(section => (
            <section key={section.title} className="legal-section">
              <h2 className="legal-section-title">{section.title}</h2>
              {section.paragraphs.map(paragraph => (
                <p key={paragraph} className="legal-section-copy">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          {children}
        </article>
      </section>

      <LandingFooter />
    </div>
  )
}
