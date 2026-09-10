import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import LoginModal from './components/LoginModal';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Catalog from './pages/Catalog';
import SizeGuide from './pages/SizeGuide';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ConfirmEmail from './pages/ConfirmEmail';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Addresses from './pages/Addresses';
import Favorites from './pages/Favorites';
import Account from './pages/Account';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <LoginModal />
      <FloatingWhatsApp />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/produtos" element={<Catalog />} />
          <Route path="/produtos/:slug" element={<ProductDetail />} />
          <Route path="/guia-de-medidas" element={<SizeGuide />} />
          <Route path="/carrinho" element={<Cart />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/criar-conta" element={<Register />} />
          <Route path="/esqueci-a-senha" element={<ForgotPassword />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />
          <Route path="/confirmar-email" element={<ConfirmEmail />} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/minha-conta" element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/minha-conta/pedidos" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/minha-conta/pedidos/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
          <Route path="/minha-conta/enderecos" element={<ProtectedRoute><Addresses /></ProtectedRoute>} />
          <Route path="/minha-conta/favoritos" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
