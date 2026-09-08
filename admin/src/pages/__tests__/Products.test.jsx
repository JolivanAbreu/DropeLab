import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Products from '../Products';
import { renderWithProviders, mockFetchFor, loginAs } from '../../test/renderWithProviders';

const PRODUCTS_RESULT = {
  data: [
    { id: 'p1', name: 'Camiseta A', basePrice: '100.00', active: true, category: { name: 'Cat' }, variants: [{ stockQuantity: 5 }], images: [] },
    { id: 'p2', name: 'Camiseta B', basePrice: '150.00', active: true, category: { name: 'Cat' }, variants: [{ stockQuantity: 0 }], images: [] },
  ],
  total: 2,
};

describe('Products — seleção e ações em massa', () => {
  beforeEach(() => {
    localStorage.clear();
    loginAs({ id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' });
    global.fetch = vi.fn(mockFetchFor([['admin/products', PRODUCTS_RESULT]]));
  });

  it('lista os produtos', async () => {
    renderWithProviders(<Products />);
    expect(await screen.findByText('Camiseta A')).toBeInTheDocument();
    expect(screen.getByText('Camiseta B')).toBeInTheDocument();
  });

  it('mostra estoque zerado destacado', async () => {
    renderWithProviders(<Products />);
    await screen.findByText('Camiseta B');
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('a barra de ações em massa não aparece sem nada selecionado', async () => {
    renderWithProviders(<Products />);
    await screen.findByText('Camiseta A');
    expect(screen.queryByText(/selecionado/i)).not.toBeInTheDocument();
  });

  it('selecionar um produto mostra a barra de ações com a contagem certa', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Products />);
    await screen.findByText('Camiseta A');

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    expect(await screen.findByText(/1 selecionado/i)).toBeInTheDocument();
  });

  it('"selecionar todos" marca todas as linhas', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Products />);
    await screen.findByText('Camiseta A');

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    expect(await screen.findByText(/2 selecionado/i)).toBeInTheDocument();
  });

  it('ativar em massa chama a API certa com os ids selecionados', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Products />);
    await screen.findByText('Camiseta A');

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: /^ativar$/i }));

    await waitFor(() => {
      const bulkCall = global.fetch.mock.calls.find(([url]) => String(url).includes('bulk-active'));
      expect(bulkCall).toBeTruthy();
      const body = JSON.parse(bulkCall[1].body);
      expect(body).toEqual({ ids: ['p1'], active: true });
    });
  });

  it('abre o formulário de reajuste de preço e envia o percentual certo', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Products />);
    await screen.findByText('Camiseta A');

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: /reajustar preço/i }));

    const input = await screen.findByPlaceholderText('10');
    await user.type(input, '10');
    await user.click(screen.getByRole('button', { name: /aplicar a 1 produto/i }));

    await waitFor(() => {
      const bulkCall = global.fetch.mock.calls.find(([url]) => String(url).includes('bulk-price'));
      expect(bulkCall).toBeTruthy();
      const body = JSON.parse(bulkCall[1].body);
      expect(body).toEqual({ ids: ['p1'], percentage: 10 });
    });
  });

  it('operador não vê os checkboxes de seleção (ações em massa são só de admin)', async () => {
    localStorage.clear();
    loginAs({ id: 'u2', name: 'Operador', email: 'o@t.com', role: 'operator' });
    renderWithProviders(<Products />);
    await screen.findByText('Camiseta A');

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
