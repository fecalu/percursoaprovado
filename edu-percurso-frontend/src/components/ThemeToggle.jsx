import { useTheme } from '../context/ThemeContext'

const IconSun = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="10" cy="10" r="3.2" />
    <path d="M10 2.4v2.1M10 15.5v2.1M17.6 10h-2.1M4.5 10H2.4M15.4 4.6l-1.5 1.5M6.1 13.9l-1.5 1.5M15.4 15.4l-1.5-1.5M6.1 6.1L4.6 4.6" />
  </svg>
)

const IconMoon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M13.8 2.9a6.8 6.8 0 1 0 3.3 12.7A7.3 7.3 0 0 1 13.8 2.9Z" />
  </svg>
)

export default function ThemeToggle({ compact = false, iconOnly = false }) {
  const { theme, toggleTheme, isLight } = useTheme()

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? ' theme-toggle--compact' : ''}${iconOnly ? ' theme-toggle--icon-only' : ''}`}
      onClick={toggleTheme}
      aria-label={isLight ? 'Ativar tema escuro' : 'Ativar tema claro'}
      title={isLight ? 'Ativar tema escuro' : 'Ativar tema claro'}
    >
      <span className="theme-toggle-icon">
        {isLight ? <IconMoon /> : <IconSun />}
      </span>
      <span className="theme-toggle-label" aria-hidden={iconOnly}>
        {theme === 'light' ? 'Tema claro' : 'Tema escuro'}
      </span>
    </button>
  )
}
