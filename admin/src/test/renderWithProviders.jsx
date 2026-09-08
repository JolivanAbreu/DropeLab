import { render as rtlRender } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

export function renderWithProviders(ui, { route = '/' } = {}) {
  return rtlRender(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

export function mockFetchFor(routes) {
  return async (url) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    for (const [matcher, data] of routes) {
      if (path.includes(matcher)) return { ok: true, status: 200, json: async () => data };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
}

export function loginAs(user) {
  localStorage.setItem('bos_admin_access_token', 'token-fake');
  localStorage.setItem('bos_admin_user', JSON.stringify(user));
}
