import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from '../Header';
import { renderWithProviders, mockFetchFor } from '../../test/renderWithProviders';

describe('Header', () => {
  beforeEach(() => {
    global.fetch = vi.fn(mockFetchFor([['wishlist', []]]));
  });

  it('renderiza os links de navegação Vestuário e Acessórios (na barra desktop)', async () => {
    renderWithProviders(<Header />, { route: '/produtos' });
    const vestuarioLinks = await screen.findAllByText('Vestuário');
    const desktopLink = vestuarioLinks.find((el) => el.className.includes('nav-hover-underline'));
    expect(desktopLink).toBeTruthy();

    const acessoriosLinks = screen.getAllByText('Acessórios');
    expect(acessoriosLinks.length).toBeGreaterThan(0);
  });

  it('o logo da loja está presente e leva pra home', async () => {
    renderWithProviders(<Header />);
    const logos = await screen.findAllByText('DRAVENNX');
    logos.forEach((logo) => {
      expect(logo.closest('a')).toHaveAttribute('href', '/');
    });
  });

  it('"Meus pedidos" (versão desktop) tem as classes "hidden" e "lg:inline-flex" — regressão do bug de CSS sem camada que fazia o link nunca sumir de verdade em telas pequenas', async () => {
    renderWithProviders(<Header />);
    const links = await screen.findAllByText('Meus pedidos');
    const desktopLink = links.find((el) => el.closest('a')?.className.includes('nav-hover-underline'));
    expect(desktopLink).toBeTruthy();
    const anchor = desktopLink.closest('a');
    expect(anchor.className).toContain('hidden');
    expect(anchor.className).toContain('lg:inline-flex');
  });

  it('o ícone do carrinho (sacola) é um link clicável pro carrinho, não só um dropdown', async () => {
    renderWithProviders(<Header />);
    const cartLinks = await screen.findAllByRole('link');
    const cartLink = cartLinks.find((a) => a.getAttribute('href') === '/carrinho');
    expect(cartLink).toBeTruthy();
  });

  it('mostra a bolinha de indicador quando há itens na wishlist de um cliente logado', async () => {
    localStorage.setItem('bos_access_token', 'token-fake');
    localStorage.setItem('bos_user', JSON.stringify({ id: 'u1', name: 'Cliente Teste', email: 'c@t.com', role: 'customer' }));
    global.fetch = vi.fn(mockFetchFor([['wishlist', [{ id: 'w1', productId: 'p1' }]]]));

    const { container } = renderWithProviders(<Header />);
    await screen.findAllByText('DRAVENNX');
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('.bg-tag')).toBeTruthy();

    localStorage.clear();
  });
});

describe('Header — menu mobile (hambúrguer)', () => {
  beforeEach(() => {
    global.fetch = vi.fn(mockFetchFor([['wishlist', []]]));
  });

  async function openMobileMenu() {
    const user = userEvent.setup();
    const result = renderWithProviders(<Header />);
    const openButton = await screen.findByLabelText('Abrir menu');
    await user.click(openButton);
    return result;
  }

  it('separa a seção "Loja" da seção "Minha conta", cada uma com seu próprio título', async () => {
    await openMobileMenu();
    expect(await screen.findByText('Loja')).toBeInTheDocument();
    expect(await screen.findByText('Minha conta')).toBeInTheDocument();
  });

  it('cliente logado vê o próprio nome e um botão de sair só com ícone (sem o texto "Sair")', async () => {
    localStorage.setItem('bos_access_token', 'token-fake');
    localStorage.setItem('bos_user', JSON.stringify({ id: 'u1', name: 'Cliente Teste', email: 'c@t.com', role: 'customer' }));

    await openMobileMenu();

    expect(await screen.findByText('Cliente Teste')).toBeInTheDocument();
    const logoutButton = await screen.findByLabelText('Sair da conta');
    expect(logoutButton.textContent.trim()).toBe(''); // só ícone, nenhum texto "Sair" visível

    localStorage.clear();
  });

  it('visitante (não logado) vê um convite pra entrar, sem nome nenhum', async () => {
    await openMobileMenu();
    expect(await screen.findByText(/entrar \/ criar conta/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Sair da conta')).not.toBeInTheDocument();
  });

  it('não existe mais a fileira de ícones no rodapé do menu (removida a pedido)', async () => {
    const { container } = await openMobileMenu();
    await screen.findByText('Loja');
    // A fileira antiga usava "justify-around" como marcador único dela — se
    // sumiu do DOM, a remoção foi aplicada de verdade, não só escondida.
    expect(container.querySelector('.justify-around')).toBeNull();
  });
});
