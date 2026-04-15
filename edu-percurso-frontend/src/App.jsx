import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import PrivateRoute from './components/PrivateRoute'
import ScrollToTop from './components/ScrollToTop'

import Home from './pages/Home'
import LocalDetalhe from './pages/LocalDetalhe'
import CheckoutRevisao from './pages/CheckoutRevisao'
import CheckoutResultado from './pages/CheckoutResultado'
import Login from './pages/Login'
import Register from './pages/Register'
import TermosDeUso from './pages/TermosDeUso'
import PoliticaPrivacidade from './pages/PoliticaPrivacidade'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import PainelAluno from './pages/PainelAluno'
import MinhaTrilha from './pages/MinhaTrilha'
import PerfilAluno from './pages/PerfilAluno'
import Biblioteca from './pages/Biblioteca'
import BibliotecaGuia from './pages/BibliotecaGuia'
import SimuladoTeorico from './pages/SimuladoTeorico'
import Player from './pages/Player'
import MeusAcessos from './pages/MeusAcessos'
import MeusPedidos from './pages/MeusPedidos'
import MeuProgresso from './pages/MeuProgresso'
import AdminDashboard from './pages/AdminDashboard'
import AdminPedidos from './pages/AdminPedidos'
import AdminPercursos from './pages/AdminPercursos'
import AdminPercursoForm from './pages/AdminPercursoForm'
import AdminModulos from './pages/AdminModulos'
import AdminQuestoes from './pages/AdminQuestoes'
import AdminQuestaoForm from './pages/AdminQuestaoForm'
import AdminLocais from './pages/AdminLocais'
import AdminPlanos from './pages/AdminPlanos'
import AdminAssinaturas from './pages/AdminAssinaturas'
import AdminUsuarios from './pages/AdminUsuarios'
import AdminPaginaHome from './pages/AdminPaginaHome'
import AdminPaginaLocal from './pages/AdminPaginaLocal'
import AdminPaginaCheckout from './pages/AdminPaginaCheckout'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/locais/:slug" element={<LocalDetalhe />} />
            <Route path="/checkout/revisao/:localSlug/:planoId" element={<CheckoutRevisao />} />
            <Route path="/checkout/:status" element={<CheckoutResultado />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/termos-de-uso" element={<TermosDeUso />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/painel" element={<PrivateRoute><PainelAluno /></PrivateRoute>} />
            <Route path="/minha-trilha" element={<PrivateRoute><MinhaTrilha /></PrivateRoute>} />
            <Route path="/biblioteca" element={<PrivateRoute><Biblioteca /></PrivateRoute>} />
            <Route path="/biblioteca/modulos/:moduloId/guia" element={<PrivateRoute><BibliotecaGuia /></PrivateRoute>} />
            <Route path="/simulado" element={<PrivateRoute><SimuladoTeorico /></PrivateRoute>} />
            <Route path="/percursos" element={<Navigate to="/biblioteca" replace />} />
            <Route path="/conteudos/:id" element={<PrivateRoute><Player /></PrivateRoute>} />
            <Route path="/percursos/:id" element={<PrivateRoute><Player /></PrivateRoute>} />
            <Route path="/meus-acessos" element={<PrivateRoute><MeusAcessos /></PrivateRoute>} />
            <Route path="/meus-pedidos" element={<PrivateRoute><MeusPedidos /></PrivateRoute>} />
            <Route path="/meu-progresso" element={<PrivateRoute><MeuProgresso /></PrivateRoute>} />
            <Route path="/perfil" element={<PrivateRoute><PerfilAluno /></PrivateRoute>} />

            <Route path="/admin" element={<PrivateRoute adminOnly><AdminDashboard /></PrivateRoute>} />
            <Route path="/admin/pedidos" element={<PrivateRoute adminOnly><AdminPedidos /></PrivateRoute>} />
            <Route path="/admin/percursos" element={<PrivateRoute adminOnly><AdminPercursos /></PrivateRoute>} />
            <Route path="/admin/percursos/novo" element={<PrivateRoute adminOnly><AdminPercursoForm /></PrivateRoute>} />
            <Route path="/admin/percursos/:id/editar" element={<PrivateRoute adminOnly><AdminPercursoForm /></PrivateRoute>} />
            <Route path="/admin/modulos" element={<PrivateRoute adminOnly><AdminModulos /></PrivateRoute>} />
            <Route path="/admin/questoes" element={<PrivateRoute adminOnly><AdminQuestoes /></PrivateRoute>} />
            <Route path="/admin/questoes/nova" element={<PrivateRoute adminOnly><AdminQuestaoForm /></PrivateRoute>} />
            <Route path="/admin/questoes/:id/editar" element={<PrivateRoute adminOnly><AdminQuestaoForm /></PrivateRoute>} />
            <Route path="/admin/locais" element={<PrivateRoute adminOnly><AdminLocais /></PrivateRoute>} />
            <Route path="/admin/planos" element={<PrivateRoute adminOnly><AdminPlanos /></PrivateRoute>} />
            <Route path="/admin/assinaturas" element={<PrivateRoute adminOnly><AdminAssinaturas /></PrivateRoute>} />
            <Route path="/admin/usuarios" element={<PrivateRoute adminOnly><AdminUsuarios /></PrivateRoute>} />
            <Route path="/admin/paginas/home" element={<PrivateRoute adminOnly><AdminPaginaHome /></PrivateRoute>} />
            <Route path="/admin/paginas/local" element={<PrivateRoute adminOnly><AdminPaginaLocal /></PrivateRoute>} />
            <Route path="/admin/paginas/checkout" element={<PrivateRoute adminOnly><AdminPaginaCheckout /></PrivateRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
