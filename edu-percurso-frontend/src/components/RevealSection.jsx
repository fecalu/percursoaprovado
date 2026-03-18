import { useEffect, useRef, useState } from 'react'

export default function RevealSection({ as: Tag = 'div', className = '', delay = 0, style, children, ...props }) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current

    if (!element) {
      return undefined
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -48px 0px',
      },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`reveal-block ${isVisible ? 'is-visible' : ''} ${className}`.trim()}
      style={{ ...(style || {}), '--reveal-delay': `${delay}ms` }}
      {...props}
    >
      {children}
    </Tag>
  )
}
