import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '../utils/browserStorage'

const STORAGE_KEY = 'edu-percurso-theme'

const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  isLight: false,
})

function getPreferredTheme() {
  if (typeof window === 'undefined') return 'dark'

  const storedTheme = safeLocalStorageGetItem(STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme

  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getPreferredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    safeLocalStorageSetItem(STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme(current => (current === 'light' ? 'dark' : 'light')),
    isLight: theme === 'light',
  }), [theme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
