import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Coupons from './pages/Coupons';
import Reports from './pages/Reports';
import Users from './pages/Users';
import MyAccount from './pages/MyAccount';
import Categories from './pages/Categories';
import PromoBannerSettings from './pages/PromoBannerSettings';
import Newsletter from './pages/Newsletter';
import AuditLogPage from './pages/AuditLogPage';
import FeaturedManagement from './pages/FeaturedManagement';
import InstagramGallery from './pages/InstagramGallery';

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
        <Route path="/produtos" element={<Products />} />
        <Route path="/produtos/novo" element={<ProtectedRoute adminOnly><ProductForm /></ProtectedRoute>} />
        <Route path="/produtos/:id" element={<ProtectedRoute adminOnly><ProductForm /></ProtectedRoute>} />
        <Route path="/categorias" element={<ProtectedRoute adminOnly><Categories /></ProtectedRoute>} />
        <Route path="/banner-promocional" element={<ProtectedRoute adminOnly><PromoBannerSettings /></ProtectedRoute>} />
        <Route path="/newsletter" element={<Newsletter />} />
        <Route path="/destaques" element={<ProtectedRoute adminOnly><FeaturedManagement /></ProtectedRoute>} />
        <Route path="/instagram" element={<ProtectedRoute adminOnly><InstagramGallery /></ProtectedRoute>} />
        <Route path="/pedidos" element={<Orders />} />
        <Route path="/pedidos/:id" element={<OrderDetail />} />
        <Route path="/cupons" element={<ProtectedRoute adminOnly><Coupons /></ProtectedRoute>} />
        <Route path="/relatorios" element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
        <Route path="/log-auditoria" element={<ProtectedRoute adminOnly><AuditLogPage /></ProtectedRoute>} />
        <Route path="/minha-conta" element={<MyAccount />} />
      </Route>
    </Routes>
  );
}
