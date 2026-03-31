export function buildReturnTo(pathname = '/', search = '', hash = '') {
  const nextPath = `${pathname || '/'}${search || ''}${hash || ''}`.trim()
  return nextPath.startsWith('/') ? nextPath : '/'
}

export function resolveAuthDestination(role, state) {
  if (role === 'ADMIN') return '/admin'

  const returnTo = typeof state?.returnTo === 'string' ? state.returnTo.trim() : ''
  if (returnTo.startsWith('/') && !returnTo.startsWith('/admin')) {
    return returnTo
  }

  return '/painel'
}
