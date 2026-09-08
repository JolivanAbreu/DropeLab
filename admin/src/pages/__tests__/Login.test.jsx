import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../Login';
import { renderWithProviders } from '../../test/renderWithProviders';

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn();
  });

  it('login sem 2FA entra direto, sem pedir código', async () => {
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ user: { id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' }, access_token: 'at', refresh_token: 'rt' }),
    });
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@dravennx.com');
    await user.type(screen.getByLabelText(/senha/i), 'senha1234');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    await waitFor(() => {
      expect(localStorage.getItem('bos_admin_access_token')).toBe('at');
    });
    expect(screen.queryByText(/verificação em duas etapas/i)).not.toBeInTheDocument();
  });

  it('login com 2FA ativo mostra a tela de código, sem logar direto', async () => {
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ requires_two_factor: true, two_factor_token: 'temp-token-123' }),
    });
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@dravennx.com');
    await user.type(screen.getByLabelText(/senha/i), 'senha1234');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByText(/verificação em duas etapas/i)).toBeInTheDocument();
    expect(localStorage.getItem('bos_admin_access_token')).toBeNull();
  });

  it('completa o login enviando o código na segunda etapa', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ requires_two_factor: true, two_factor_token: 'temp-token-123' }) })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ user: { id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' }, access_token: 'at-final', refresh_token: 'rt-final' }),
      });
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@dravennx.com');
    await user.type(screen.getByLabelText(/senha/i), 'senha1234');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    await screen.findByText(/verificação em duas etapas/i);
    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(localStorage.getItem('bos_admin_access_token')).toBe('at-final');
    });

    const secondCall = global.fetch.mock.calls[1];
    expect(secondCall[0]).toContain('/login/2fa');
    expect(JSON.parse(secondCall[1].body)).toEqual({ two_factor_token: 'temp-token-123', code: '123456' });
  });

  it('"Voltar" na tela de código retorna pra tela de e-mail/senha', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ requires_two_factor: true, two_factor_token: 'temp-token-123' }) });
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@dravennx.com');
    await user.type(screen.getByLabelText(/senha/i), 'senha1234');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    await screen.findByText(/verificação em duas etapas/i);
    await user.click(screen.getByRole('button', { name: /voltar/i }));

    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.queryByText(/verificação em duas etapas/i)).not.toBeInTheDocument();
  });

  it('rejeita login de uma conta de cliente (sem acesso ao painel)', async () => {
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ user: { id: 'u1', name: 'Cliente', email: 'c@t.com', role: 'customer' }, access_token: 'at', refresh_token: 'rt' }),
    });
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/e-mail/i), 'cliente@teste.com');
    await user.type(screen.getByLabelText(/senha/i), 'senha1234');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByText(/não tem acesso ao painel/i)).toBeInTheDocument();
    expect(localStorage.getItem('bos_admin_access_token')).toBeNull();
  });

  it('mostra erro de credenciais inválidas', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'unauthorized', message: 'Credenciais inválidas' }) });
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@dravennx.com');
    await user.type(screen.getByLabelText(/senha/i), 'senhaerrada');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByText(/credenciais inválidas/i)).toBeInTheDocument();
  });
});
