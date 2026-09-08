import { render as rtlRender } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { WishlistProvider } from '../context/WishlistContext';
import { AuthModalProvider } from '../context/AuthModalContext';

/**
 * Render com todos os providers reais da loja (não mocks) — mesma pilha que
 * o App.jsx monta de verdade, pra testar componentes exatamente como se
 * comportam em produção. `route` define a URL inicial simulada.
 */
export function renderWithProviders(ui, { route = '/' } = {}) {
  return rtlRender(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <AuthModalProvider>{ui}</AuthModalProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

/**
 * Mock simples de fetch — recebe uma lista de [trecho-da-URL, dado] e
 * responde ao primeiro que bater; qualquer outra URL recebe uma resposta
 * genérica vazia, pra nunca travar um componente que busca dados extras
 * não relevantes pro teste em questão.
 */
export function mockFetchFor(routes) {
  return async (url) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    for (const [matcher, data] of routes) {
      if (path.includes(matcher)) return { ok: true, status: 200, json: async () => data };
    }
    return { ok: true, status: 200, json: async () => ({ items: [], subtotal: 0, discount: 0 }) };
  };
}
