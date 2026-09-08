import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import Layout from '../Layout';
import { renderWithProviders, loginAs } from '../../test/renderWithProviders';

function renderLayoutAt(route) {
  return renderWithProviders(
    <Routes>
      <Route element={<Layout />}>
        <Route path={route} element={<div>Conteúdo da página</div>} />
      </Route>
    </Routes>,
    { route }
  );
}

describe('Layout — menu do painel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('admin vê as 4 seções: Vendas, Catálogo, Vitrine da loja, Administração', async () => {
    loginAs({ id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' });
    renderLayoutAt('/pedidos');

    expect((await screen.findAllByText('Vendas')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Catálogo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vitrine da loja').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Administração').length).toBeGreaterThan(0);
  });

  it('operador NÃO vê a seção Administração nem itens exclusivos de admin', async () => {
    loginAs({ id: 'u2', name: 'Operador', email: 'o@t.com', role: 'operator' });
    renderLayoutAt('/pedidos');

    await screen.findAllByText('Vendas');
    expect(screen.queryByText('Administração')).not.toBeInTheDocument();
    expect(screen.queryByText('Log de auditoria')).not.toBeInTheDocument();
    expect(screen.queryByText('Cupons')).not.toBeInTheDocument();
  });

  it('recolher uma seção sem a rota atual esconde os itens dela', async () => {
    loginAs({ id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' });
    const user = userEvent.setup();
    renderLayoutAt('/pedidos');

    await screen.findAllByText('Destaques');
    const vitrineButtons = screen.getAllByRole('button', { name: /vitrine da loja/i });
    await user.click(vitrineButtons[0]);

    expect(screen.queryByText('Destaques')).not.toBeInTheDocument();
  });

  it('clicar de novo reabre a seção recolhida', async () => {
    loginAs({ id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' });
    const user = userEvent.setup();
    renderLayoutAt('/pedidos');

    await screen.findAllByText('Destaques');
    const vitrineButtons = screen.getAllByRole('button', { name: /vitrine da loja/i });
    await user.click(vitrineButtons[0]);
    expect(screen.queryByText('Destaques')).not.toBeInTheDocument();

    await user.click(vitrineButtons[0]);
    expect(screen.getAllByText('Destaques').length).toBeGreaterThan(0);
  });

  it('a seção que contém a rota atual nunca esconde seus itens, mesmo clicando pra recolher', async () => {
    loginAs({ id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' });
    const user = userEvent.setup();
    renderLayoutAt('/pedidos');

    await screen.findAllByText('Pedidos');
    const vendasButtons = screen.getAllByRole('button', { name: /^vendas$/i });
    await user.click(vendasButtons[0]);

    expect(screen.getAllByText('Pedidos').length).toBeGreaterThan(0);
  });

  it('lembra o estado de recolhido entre remontagens (persistido no localStorage)', async () => {
    loginAs({ id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' });
    const user = userEvent.setup();
    const { unmount } = renderLayoutAt('/pedidos');

    await screen.findAllByText('Destaques');
    const vitrineButtons = screen.getAllByRole('button', { name: /vitrine da loja/i });
    await user.click(vitrineButtons[0]);
    expect(screen.queryByText('Destaques')).not.toBeInTheDocument();

    unmount();
    renderLayoutAt('/pedidos');
    await screen.findAllByText('Pedidos');
    expect(screen.queryByText('Destaques')).not.toBeInTheDocument();
  });

  it('renderiza o conteúdo da rota atual dentro do layout', async () => {
    loginAs({ id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' });
    renderLayoutAt('/pedidos');
    expect(await screen.findByText('Conteúdo da página')).toBeInTheDocument();
  });
});
