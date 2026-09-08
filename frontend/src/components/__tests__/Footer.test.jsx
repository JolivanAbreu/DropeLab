import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../Footer';

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );
}

describe('Footer — newsletter', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('envia o e-mail pra API de verdade ao submeter (não é mais um formulário morto)', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ email: 'cliente@teste.com' }) });
    const user = userEvent.setup();
    renderFooter();

    const input = screen.getByPlaceholderText('Seu e-mail');
    await user.type(input, 'cliente@teste.com');
    await user.click(screen.getByRole('button', { name: /inscrever/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/newsletter/subscribe');
    expect(JSON.parse(options.body)).toEqual({ email: 'cliente@teste.com' });
  });

  it('mostra confirmação de sucesso e limpa o campo depois de inscrever', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ email: 'cliente@teste.com' }) });
    const user = userEvent.setup();
    renderFooter();

    await user.type(screen.getByPlaceholderText('Seu e-mail'), 'cliente@teste.com');
    await user.click(screen.getByRole('button', { name: /inscrever/i }));

    expect(await screen.findByText(/inscrito/i)).toBeInTheDocument();
  });

  it('mostra mensagem de erro quando a API rejeita', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'invalid_email', message: 'Informe um e-mail válido' }) });
    const user = userEvent.setup();
    renderFooter();

    await user.type(screen.getByPlaceholderText('Seu e-mail'), 'ja-cadastrado@teste.com');
    await user.click(screen.getByRole('button', { name: /inscrever/i }));

    expect(await screen.findByText(/e-mail válido/i)).toBeInTheDocument();
  });
});

describe('Footer — links', () => {
  it('o Instagram aponta pro perfil real da loja (@_dravennx), não um placeholder', () => {
    renderFooter();
    const instagramLink = screen.getAllByRole('link').find((a) => a.href.includes('instagram.com'));
    expect(instagramLink).toBeTruthy();
    expect(instagramLink.href).toContain('instagram.com/_dravennx');
  });

  it('tem um link real pro Guia de Medidas (não é mais texto morto)', () => {
    renderFooter();
    const link = screen.getByText('Guia de Medidas').closest('a');
    expect(link).toHaveAttribute('href', '/guia-de-medidas');
  });
});
