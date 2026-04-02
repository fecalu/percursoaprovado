import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const location = useLocation()

  useLayoutEffect(() => {
    if (location.hash) {
      const elementId = location.hash.replace('#', '')
      const target = document.getElementById(elementId)
      if (target) {
        target.scrollIntoView()
        return
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search, location.hash])

  return null
}
