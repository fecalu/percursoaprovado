import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'

import Home from './pages/Home'
import LocalDetalhe from './pages/LocalDetalhe'
import CheckoutResultado from './pages/CheckoutResultado'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Biblioteca from './pages/Biblioteca'
import Player from './pages/Player'
import MeusAcessos from './pages/MeusAcessos'
import MeusPedidos from './pages/MeusPedidos'
import MeuProgresso from './pages/MeuProgresso'
import AdminDashboard from './pages/AdminDashboard'
import AdminPedidos from './pages/AdminPedidos'
import AdminPercursos from './pages/AdminPercursos'
import AdminPercursoForm from './pages/AdminPercursoForm'
import AdminLocais from './pages/AdminLocais'
import AdminPlanos from './pages/AdminPlanos'
import AdminAssinaturas from './pages/AdminAssinaturas'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/locais/:slug" element={<LocalDetalhe />} />
          <Route path="/checkout/:status" element={<CheckoutResultado />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/biblioteca" element={<PrivateRoute><Biblioteca /></PrivateRoute>} />
          <Route path="/percursos" element={<Navigate to="/biblioteca" replace />} />
          <Route path="/conteudos/:id" element={<PrivateRoute><Player /></PrivateRoute>} />
          <Route path="/percursos/:id" element={<PrivateRoute><Player /></PrivateRoute>} />
          <Route path="/meus-acessos" element={<PrivateRoute><MeusAcessos /></PrivateRoute>} />
          <Route path="/meus-pedidos" element={<PrivateRoute><MeusPedidos /></PrivateRoute>} />
          <Route path="/meu-progresso" element={<PrivateRoute><MeuProgresso /></PrivateRoute>} />

          <Route path="/admin" element={<PrivateRoute adminOnly><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/pedidos" element={<PrivateRoute adminOnly><AdminPedidos /></PrivateRoute>} />
          <Route path="/admin/percursos" element={<PrivateRoute adminOnly><AdminPercursos /></PrivateRoute>} />
          <Route path="/admin/percursos/novo" element={<PrivateRoute adminOnly><AdminPercursoForm /></PrivateRoute>} />
          <Route path="/admin/percursos/:id/editar" element={<PrivateRoute adminOnly><AdminPercursoForm /></PrivateRoute>} />
          <Route path="/admin/locais" element={<PrivateRoute adminOnly><AdminLocais /></PrivateRoute>} />
          <Route path="/admin/planos" element={<PrivateRoute adminOnly><AdminPlanos /></PrivateRoute>} />
          <Route path="/admin/assinaturas" element={<PrivateRoute adminOnly><AdminAssinaturas /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
