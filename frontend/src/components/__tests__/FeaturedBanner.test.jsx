import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FeaturedBanner from '../FeaturedBanner';

const PRODUCT = {
  id: 'p1',
  name: 'Peça em Destaque',
  slug: 'peca-destaque',
  description: 'Descrição da peça',
  basePrice: '199.90',
  imageFocalPoint: 'top',
  images: [
    { id: 'i1', url: 'https://exemplo.com/foto-frente.jpg' },
    { id: 'i2', url: 'https://exemplo.com/foto-costas.jpg' },
  ],
};

function renderBanner(product) {
  return render(
    <MemoryRouter>
      <FeaturedBanner product={product} />
    </MemoryRouter>
  );
}

describe('FeaturedBanner', () => {
  it('não renderiza nada quando não há produto em destaque', () => {
    const { container } = renderBanner(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra o nome, preço e descrição do produto', () => {
    renderBanner(PRODUCT);
    expect(screen.getByText('Peça em Destaque')).toBeInTheDocument();
    expect(screen.getByText('Descrição da peça')).toBeInTheDocument();
    expect(screen.getByText(/199,90/)).toBeInTheDocument();
  });

  it('mostra a primeira foto inicialmente', () => {
    renderBanner(PRODUCT);
    const img = screen.getByAltText('Peça em Destaque');
    expect(img.src).toContain('foto-frente.jpg');
  });

  it('aplica o enquadramento da foto (imageFocalPoint) via object-position', () => {
    renderBanner(PRODUCT);
    const img = screen.getByAltText('Peça em Destaque');
    expect(img.style.objectPosition).toBe('center top');
  });

  it('troca pra segunda foto ao passar o mouse, e volta pra primeira ao tirar', async () => {
    const user = userEvent.setup();
    renderBanner(PRODUCT);

    const imageLink = screen.getByAltText('Peça em Destaque').closest('a');
    await user.hover(imageLink);
    expect(screen.getByAltText('Peça em Destaque').src).toContain('foto-costas.jpg');

    await user.unhover(imageLink);
    expect(screen.getByAltText('Peça em Destaque').src).toContain('foto-frente.jpg');
  });

  it('não quebra ao passar o mouse quando o produto só tem uma foto (mantém a mesma)', async () => {
    const user = userEvent.setup();
    const productComUmaFoto = { ...PRODUCT, images: [PRODUCT.images[0]] };
    renderBanner(productComUmaFoto);

    const imageLink = screen.getByAltText('Peça em Destaque').closest('a');
    await user.hover(imageLink);
    expect(screen.getByAltText('Peça em Destaque').src).toContain('foto-frente.jpg');
  });

  it('todos os links do banner levam pra página do produto certo', () => {
    renderBanner(PRODUCT);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link).toHaveAttribute('href', '/produtos/peca-destaque');
    });
  });

  it('mostra aviso quando o produto não tem nenhuma foto cadastrada', () => {
    renderBanner({ ...PRODUCT, images: [] });
    expect(screen.getByText(/sem foto cadastrada/i)).toBeInTheDocument();
  });
});
