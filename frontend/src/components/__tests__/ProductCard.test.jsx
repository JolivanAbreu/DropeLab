import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductCard from '../ProductCard';
import { useAuthModal } from '../../context/AuthModalContext';
import { renderWithProviders, mockFetchFor } from '../../test/renderWithProviders';

function LoginModalProbe() {
  const { isOpen } = useAuthModal();
  return <span data-testid="login-modal-state">{isOpen ? 'aberto' : 'fechado'}</span>;
}

const PRODUCT_EM_ESTOQUE = {
  id: 'p1',
  name: 'Camiseta Teste',
  slug: 'camiseta-teste',
  basePrice: '89.90',
  badgeLabel: null,
  reviewCount: 0,
  images: [{ id: 'i1', url: 'https://exemplo.com/foto1.jpg' }, { id: 'i2', url: 'https://exemplo.com/foto2.jpg' }],
  variants: [{ id: 'v1', color: 'Preto', stockQuantity: 5 }],
};

function loginAs(user) {
  localStorage.setItem('bos_access_token', 'token-fake');
  localStorage.setItem('bos_user', JSON.stringify(user));
}

describe('ProductCard', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn(mockFetchFor([['wishlist', []]]));
  });

  it('mostra nome e preço formatado', () => {
    renderWithProviders(<ProductCard product={PRODUCT_EM_ESTOQUE} />);
    expect(screen.getByText('Camiseta Teste')).toBeInTheDocument();
    expect(screen.getByText(/89,90/)).toBeInTheDocument();
  });

  it('mostra o selo (badgeLabel) quando o admin configurou um', () => {
    renderWithProviders(<ProductCard product={{ ...PRODUCT_EM_ESTOQUE, badgeLabel: 'NOVO' }} />);
    expect(screen.getByText('NOVO')).toBeInTheDocument();
  });

  it('não mostra selo quando o produto não tem um', () => {
    renderWithProviders(<ProductCard product={PRODUCT_EM_ESTOQUE} />);
    expect(screen.queryByText('NOVO')).not.toBeInTheDocument();
  });

  it('mostra "Esgotado" e desabilita o botão quando nenhuma variação tem estoque', () => {
    const productSemEstoque = { ...PRODUCT_EM_ESTOQUE, variants: [{ id: 'v1', color: 'Preto', stockQuantity: 0 }] };
    renderWithProviders(<ProductCard product={productSemEstoque} />);
    expect(screen.getByText('Esgotado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /indisponível/i })).toBeDisabled();
  });

  it('produto com estoque mostra o botão "adicionar" habilitado', () => {
    renderWithProviders(<ProductCard product={PRODUCT_EM_ESTOQUE} />);
    expect(screen.getByRole('button', { name: /^adicionar$/i })).toBeEnabled();
  });

  it('clicar em favoritar sem estar logado abre o modal de login, sem chamar a API de favoritos', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <ProductCard product={PRODUCT_EM_ESTOQUE} />
        <LoginModalProbe />
      </>
    );

    expect(screen.getByTestId('login-modal-state')).toHaveTextContent('fechado');
    await user.click(screen.getByRole('button', { name: /adicionar aos favoritos/i }));
    expect(screen.getByTestId('login-modal-state')).toHaveTextContent('aberto');
  });

  it('clicar em "adicionar" sem estar logado abre o modal de login, sem chamar a API do carrinho', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <ProductCard product={PRODUCT_EM_ESTOQUE} />
        <LoginModalProbe />
      </>
    );

    await user.click(screen.getByRole('button', { name: /^adicionar$/i }));
    expect(screen.getByTestId('login-modal-state')).toHaveTextContent('aberto');
    const cartCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes('/cart/items'));
    expect(cartCalls).toHaveLength(0);
  });

  it('clicar em "adicionar" logado chama a API do carrinho e mostra confirmação', async () => {
    loginAs({ id: 'u1', name: 'Cliente', email: 'c@t.com', role: 'customer' });
    global.fetch = vi.fn(mockFetchFor([
      ['wishlist', []],
      ['cart/items', { id: 'ci1' }],
    ]));
    const user = userEvent.setup();
    renderWithProviders(<ProductCard product={PRODUCT_EM_ESTOQUE} />);

    await user.click(screen.getByRole('button', { name: /^adicionar$/i }));

    expect(await screen.findByText(/adicionado/i)).toBeInTheDocument();
    const cartCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes('/cart/items'));
    expect(cartCalls.length).toBeGreaterThan(0);
  });

  it('clicar na segunda bolinha troca a foto ativa', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductCard product={PRODUCT_EM_ESTOQUE} />);

    const secondDot = screen.getByRole('button', { name: 'Ver foto 2' });
    await user.click(secondDot);

    const secondImage = screen.getByAltText('Camiseta Teste — foto 2');
    expect(secondImage.className).toContain('opacity-100');
  });

  it('não mostra bolinhas de navegação quando só há uma foto', () => {
    const productComUmaFoto = { ...PRODUCT_EM_ESTOQUE, images: [PRODUCT_EM_ESTOQUE.images[0]] };
    renderWithProviders(<ProductCard product={productComUmaFoto} />);
    expect(screen.queryByRole('button', { name: 'Ver foto 2' })).not.toBeInTheDocument();
  });

  it('mostra a média de avaliação só quando há avaliações', () => {
    const productComAvaliacao = { ...PRODUCT_EM_ESTOQUE, reviewCount: 3, avgRating: 4.5 };
    renderWithProviders(<ProductCard product={productComAvaliacao} />);
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });
});
