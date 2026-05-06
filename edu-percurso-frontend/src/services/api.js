import axios from 'axios'
import { clearStoredSession, getStoredToken, isJwtExpired, markSessionExpiredNotice, buildLoginRedirectHref } from '../utils/authSession'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const url = config.url || ''
  const isPublicAuthRoute = url.startsWith('/auth/')
  const token = getStoredToken()

  if (!token || isPublicAuthRoute) {
    return config
  }

  if (isJwtExpired(token)) {
    clearStoredSession()
    return config
  }

  config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    const requestUrl = error.config?.url || ''
    const isPublicAuthRoute = requestUrl.startsWith('/auth/')

    if (error.response?.status === 401 && !isPublicAuthRoute) {
      clearStoredSession()
      markSessionExpiredNotice()

      const pathname = window.location.pathname || '/'
      const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname)

      if (!isAuthPage) {
        const href = buildLoginRedirectHref(window.location.pathname, window.location.search, window.location.hash)
        window.location.assign(href)
      }
    }
    return Promise.reject(error)
  }
)

function toSearchParams(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, value)
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

function normalizarArgsListar(arg) {
  if (typeof arg === 'boolean') return { todos: arg }
  return arg || {}
}

export const authService = {
  login: data => api.post('/auth/login', data).then(response => response.data),
  googleLogin: data => api.post('/auth/google/code', data, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  }).then(response => response.data),
  completeGoogleSignup: data => api.post('/auth/google/complete-signup', data).then(response => response.data),
  register: data => api.post('/auth/register', data).then(response => response.data),
  forgotPassword: data => api.post('/auth/forgot-password', data).then(response => response.data),
  resetPassword: data => api.post('/auth/reset-password', data).then(response => response.data),
}

export const percursoService = {
  listar: arg => api.get(`/percursos${toSearchParams(normalizarArgsListar(arg))}`).then(response => response.data),
  buscar: id => api.get(`/percursos/${id}`).then(response => response.data),
  criar: data => api.post('/percursos', data).then(response => response.data),
  atualizar: (id, data) => api.put(`/percursos/${id}`, data).then(response => response.data),
  excluir: id => api.delete(`/percursos/${id}`),
}

export const duvidaPercursoService = {
  listarPublicas: percursoId => api.get(`/percursos/${percursoId}/duvidas`).then(response => response.data),
  criar: (percursoId, data) => api.post(`/percursos/${percursoId}/duvidas`, data).then(response => response.data),
  apoiar: (percursoId, duvidaId) => api.post(`/percursos/${percursoId}/duvidas/${duvidaId}/apoios`),
  removerApoio: (percursoId, duvidaId) => api.delete(`/percursos/${percursoId}/duvidas/${duvidaId}/apoios`),
  listarAdmin: params => api.get(`/admin/duvidas-percurso${toSearchParams(params)}`).then(response => response.data),
  atualizarAdmin: (duvidaId, data) => api.put(`/admin/duvidas-percurso/${duvidaId}`, data).then(response => response.data),
}

export const questaoService = {
  listarAdmin: params => api.get(`/admin/questoes${toSearchParams(params)}`).then(response => response.data),
  buscarAdmin: id => api.get(`/admin/questoes/${id}`).then(response => response.data),
  criarAdmin: data => api.post('/admin/questoes', data).then(response => response.data),
  atualizarAdmin: (id, data) => api.put(`/admin/questoes/${id}`, data).then(response => response.data),
  publicarAdmin: id => api.post(`/admin/questoes/${id}/publicar`).then(response => response.data),
  arquivarAdmin: id => api.post(`/admin/questoes/${id}/arquivar`).then(response => response.data),
  excluirAdmin: id => api.delete(`/admin/questoes/${id}`),
  listarTemasAluno: () => api.get('/questoes/temas').then(response => response.data),
  listarTreinoAluno: params => api.get(`/questoes/treino${toSearchParams(params)}`).then(response => response.data),
  listarSimuladoCompletoAluno: excluirIds => api.get(`/questoes/simulado-completo${toSearchParams({
    excluirIds: Array.isArray(excluirIds) && excluirIds.length ? excluirIds.join(',') : '',
  })}`).then(response => response.data),
  responderAluno: (id, data) => api.post(`/questoes/${id}/responder`, data).then(response => response.data),
}

export const categoriaService = {
  listar: () => api.get('/categorias').then(response => response.data),
  criar: data => api.post('/categorias', data).then(response => response.data),
  atualizar: (id, data) => api.put(`/categorias/${id}`, data).then(response => response.data),
  moverAulas: (id, data) => api.post(`/categorias/${id}/mover-aulas`, data).then(response => response.data),
  excluir: id => api.delete(`/categorias/${id}`),
}

export const grupoAcessoService = {
  listar: () => api.get('/admin/grupos-acesso').then(response => response.data),
  criar: data => api.post('/admin/grupos-acesso', data).then(response => response.data),
  atualizar: (id, data) => api.put(`/admin/grupos-acesso/${id}`, data).then(response => response.data),
  excluir: id => api.delete(`/admin/grupos-acesso/${id}`),
}

export const trilhaService = {
  listar: () => api.get('/trilhas').then(response => response.data),
  listarAdmin: () => api.get('/admin/trilhas').then(response => response.data),
  criar: data => api.post('/admin/trilhas', data).then(response => response.data),
  atualizar: (id, data) => api.put(`/admin/trilhas/${id}`, data).then(response => response.data),
  excluir: id => api.delete(`/admin/trilhas/${id}`),
}

export const progressoService = {
  meu: () => api.get('/progresso/meu').then(response => response.data),
  salvar: data => api.post('/progresso', data).then(response => response.data),
}

export const localProvaService = {
  listar: params => api.get(`/locais-prova${toSearchParams(params)}`).then(response => response.data),
  buscar: slug => api.get(`/locais-prova/${slug}`).then(response => response.data),
  criar: data => api.post('/locais-prova', data).then(response => response.data),
  atualizar: (id, data) => api.put(`/locais-prova/${id}`, data).then(response => response.data),
  excluir: id => api.delete(`/locais-prova/${id}`),
}

export const configuracaoSiteService = {
  buscarPublica: () => api.get('/configuracoes-site').then(response => response.data),
  buscarAdmin: () => api.get('/admin/configuracoes-site').then(response => response.data),
  atualizarHome: data => api.put('/admin/configuracoes-site/home', data).then(response => response.data),
  atualizarLocalPage: data => api.put('/admin/configuracoes-site/local-page', data).then(response => response.data),
  atualizarCheckout: data => api.put('/admin/configuracoes-site/checkout', data).then(response => response.data),
}

export const planoService = {
  listar: params => api.get(`/planos${toSearchParams(params)}`).then(response => response.data),
  criar: data => api.post('/planos', data).then(response => response.data),
  atualizar: (id, data) => api.put(`/planos/${id}`, data).then(response => response.data),
  excluir: id => api.delete(`/planos/${id}`),
}

export const assinaturaService = {
  minhas: () => api.get('/assinaturas/minhas').then(response => response.data),
  listarAdmin: () => api.get('/admin/assinaturas').then(response => response.data),
  detalharAdmin: id => api.get(`/admin/assinaturas/${id}`).then(response => response.data),
  criarAdmin: data => api.post('/admin/assinaturas', data).then(response => response.data),
  atualizarAdmin: (id, data) => api.put(`/admin/assinaturas/${id}`, data).then(response => response.data),
  prorrogarAdmin: (id, data) => api.post(`/admin/assinaturas/${id}/prorrogar`, data).then(response => response.data),
  cancelarAdmin: (id, data) => api.post(`/admin/assinaturas/${id}/cancelar`, data).then(response => response.data),
}

export const usuarioAdminService = {
  listar: params => api.get(`/admin/usuarios${toSearchParams(params)}`).then(response => response.data),
  excluirAlunoTeste: data => api.post('/admin/usuarios/excluir-aluno-teste', data).then(response => response.data),
}

export const uploadService = {
  enviarThumbnail: file => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/uploads/thumbnails', formData).then(response => response.data)
  },
  enviarImagem: file => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/uploads/thumbnails', formData).then(response => response.data)
  },
  enviarAudio: file => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/uploads/audios', formData).then(response => response.data)
  },
  enviarVideoBunny: (file, title) => {
    const formData = new FormData()
    formData.append('file', file)
    if (title) formData.append('title', title)
    return api.post('/uploads/videos/bunny', formData).then(response => response.data)
  },
}

export const pedidoService = {
  minhas: () => api.get('/pedidos').then(response => response.data),
  criar: data => api.post('/pedidos', data).then(response => response.data),
  sincronizarRetorno: data => api.post('/pedidos/sincronizar-retorno', data).then(response => response.data),
  cancelar: id => api.post(`/pedidos/${id}/cancelar`),
  solicitarCancelamento: (id, data) => api.post(`/pedidos/${id}/solicitar-cancelamento`, data).then(response => response.data),
  listarAdmin: () => api.get('/admin/pedidos').then(response => response.data),
  cancelarAdmin: id => api.post(`/admin/pedidos/${id}/cancelar`),
}

export const cancelamentoService = {
  listarAdmin: () => api.get('/admin/cancelamentos').then(response => response.data),
  aprovar: (id, data) => api.post(`/admin/cancelamentos/${id}/aprovar`, data).then(response => response.data),
  negar: (id, data) => api.post(`/admin/cancelamentos/${id}/negar`, data).then(response => response.data),
  marcarReembolsado: (id, data) => api.post(`/admin/cancelamentos/${id}/marcar-reembolsado`, data).then(response => response.data),
}

export default api
