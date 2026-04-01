export function extractAuthError(error, fallback = 'Não foi possível concluir a autenticação.') {
  const data = error?.response?.data

  if (typeof data?.erro === 'string' && data.erro.trim()) {
    return data.erro
  }

  if (data && typeof data === 'object') {
    const firstMessage = Object.values(data).find(value => typeof value === 'string' && value.trim())
    if (firstMessage) {
      return firstMessage
    }
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    if (error.message === 'Network Error') {
      return 'Não foi possível conectar ao servidor. Recarregue a página e tente novamente.'
    }
    return error.message
  }

  return fallback
}
