import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrderDetail from '../OrderDetail';
import { AuthProvider } from '../../context/AuthContext';
import { mockFetchFor, loginAs } from '../../test/renderWithProviders';

function renderOrderDetail(orderId) {
  return render(
    <MemoryRouter initialEntries={[`/pedidos/${orderId}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/pedidos/:id" element={<OrderDetail />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

const BASE_ORDER = {
  id: 'o1', orderNumber: 'BOS-2026-000001', status: 'aguardando_pagamento', createdAt: '2026-09-01T10:00:00Z',
  subtotal: 100, discount: 0, shippingCost: 0, total: 100,
  user: { name: 'Cliente Teste', email: 'c@t.com', phone: '85999998888' },
  items: [], address: null,
};

describe('OrderDetail (painel) — forma de pagamento na entrega', () => {
  beforeEach(() => {
    localStorage.clear();
    loginAs({ id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' });
  });

  it('mostra a forma de pagamento escolhida (cartão de crédito)', async () => {
    global.fetch = vi.fn(mockFetchFor([['admin/orders/o1', { ...BASE_ORDER, paymentMethod: 'credit_card' }]]));
    renderOrderDetail('o1');
    expect(await screen.findByText('Cartão de crédito')).toBeInTheDocument();
  });

  it('pagamento em dinheiro sem troco mostra "Sem troco"', async () => {
    global.fetch = vi.fn(mockFetchFor([['admin/orders/o1', { ...BASE_ORDER, paymentMethod: 'cash', changeFor: null }]]));
    renderOrderDetail('o1');
    expect(await screen.findByText('Dinheiro')).toBeInTheDocument();
    expect(await screen.findByText('Sem troco')).toBeInTheDocument();
  });

  it('pagamento em dinheiro com troco mostra o valor exato que o entregador precisa levar', async () => {
    global.fetch = vi.fn(mockFetchFor([['admin/orders/o1', { ...BASE_ORDER, total: 60, paymentMethod: 'cash', changeFor: 100 }]]));
    renderOrderDetail('o1');
    expect(await screen.findByText(/troco pra/i)).toBeInTheDocument();
    // total 60, pago com 100 -> troco de 40
    expect(await screen.findByText(/levar.*40,00.*de troco/i)).toBeInTheDocument();
  });

  it('mostra Pix como forma de pagamento', async () => {
    global.fetch = vi.fn(mockFetchFor([['admin/orders/o1', { ...BASE_ORDER, paymentMethod: 'pix' }]]));
    renderOrderDetail('o1');
    expect(await screen.findByText('Pix')).toBeInTheDocument();
  });
});
