export function buildReturnTo(pathname = '/', search = '', hash = '') {
  const nextPath = `${pathname || '/'}${search || ''}${hash || ''}`.trim()
  return nextPath.startsWith('/') ? nextPath : '/'
}

function isSafeReturnTo(value) {
  return (
    typeof value === 'string'
    && value.trim().startsWith('/')
    && !value.trim().startsWith('/admin')
  )
}

function readReturnToFromSearch(search = '') {
  const params = new URLSearchParams(search || '')
  return params.get('returnTo')?.trim() || ''
}

export function resolveAuthDestination(role, state, search = '') {
  if (role === 'ADMIN') return '/admin'

  const returnTo = typeof state?.returnTo === 'string' ? state.returnTo.trim() : ''
  if (isSafeReturnTo(returnTo)) {
    return returnTo
  }

  const searchReturnTo = readReturnToFromSearch(search)
  if (isSafeReturnTo(searchReturnTo)) {
    return searchReturnTo
  }

  return '/painel'
}
