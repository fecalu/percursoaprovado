import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const url = config.url || ''
  const isPublicAuthRoute = url.startsWith('/auth/')
  const token = localStorage.getItem('token')
  if (token && !isPublicAuthRoute) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
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
  register: data => api.post('/auth/register', data).then(response => response.data),
}

export const percursoService = {
  listar: arg => api.get(`/percursos${toSearchParams(normalizarArgsListar(arg))}`).then(response => response.data),
  buscar: id => api.get(`/percursos/${id}`).then(response => response.data),
  criar: data => api.post('/percursos', data).then(response => response.data),
  atualizar: (id, data) => api.put(`/percursos/${id}`, data).then(response => response.data),
  excluir: id => api.delete(`/percursos/${id}`),
}

export const categoriaService = {
  listar: () => api.get('/categorias').then(response => response.data),
  criar: data => api.post('/categorias', data).then(response => response.data),
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

export const planoService = {
  listar: params => api.get(`/planos${toSearchParams(params)}`).then(response => response.data),
  criar: data => api.post('/planos', data).then(response => response.data),
  atualizar: (id, data) => api.put(`/planos/${id}`, data).then(response => response.data),
  excluir: id => api.delete(`/planos/${id}`),
}

export const assinaturaService = {
  minhas: () => api.get('/assinaturas/minhas').then(response => response.data),
  listarAdmin: () => api.get('/admin/assinaturas').then(response => response.data),
  criarAdmin: data => api.post('/admin/assinaturas', data).then(response => response.data),
  cancelarAdmin: id => api.post(`/admin/assinaturas/${id}/cancelar`),
}

export const pedidoService = {
  minhas: () => api.get('/pedidos').then(response => response.data),
  criar: data => api.post('/pedidos', data).then(response => response.data),
  sincronizarRetorno: data => api.post('/pedidos/sincronizar-retorno', data).then(response => response.data),
  cancelar: id => api.post(`/pedidos/${id}/cancelar`),
  listarAdmin: () => api.get('/admin/pedidos').then(response => response.data),
  cancelarAdmin: id => api.post(`/admin/pedidos/${id}/cancelar`),
}

export default api
