export default function BrandLogo({ variant = 'sidebar', showTagline = false }) {
  return (
    <div className={`brand-logo brand-logo--${variant}`}>
      <svg
        className="brand-logo-mark"
        viewBox="-28 -6 776 262"
        role="img"
        aria-label="Percurso Aprovado"
      >
        <g fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round">
          <path d="M105 56h98" />
          <path d="M517 56h98" />
        </g>
        <text
          x="360"
          y="72"
          textAnchor="middle"
          fill="currentColor"
          fontSize="38"
          fontFamily="DM Sans, Arial, sans-serif"
          letterSpacing="6"
          fontWeight="500"
        >
          PERCURSO
        </text>
        <text
          x="360"
          y="178"
          textAnchor="middle"
          fill="currentColor"
          fontSize="122"
          fontFamily="Rockwell, Roboto Slab, Georgia, serif"
          fontWeight="700"
          letterSpacing="1"
        >
          APROVADO
        </text>
        <path
          d="M135 214C248 216 306 232 360 236C414 232 472 216 585 214C506 228 434 244 360 246C286 244 214 228 135 214Z"
          fill="currentColor"
        />
      </svg>
      {showTagline && <div className="brand-logo-tagline">Locais reais de prova</div>}
    </div>
  )
}
