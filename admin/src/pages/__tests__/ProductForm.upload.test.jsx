import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductForm from '../ProductForm';
import { AuthProvider } from '../../context/AuthContext';
import { mockFetchFor, loginAs } from '../../test/renderWithProviders';

// Mock do modal de recorte inteiro — o que queremos verificar aqui é a
// LÓGICA DE FILA/ESTADO ao redor dele (quantas vezes onConfirm é chamado
// pra uma única foto selecionada), não o recorte de pixel em si (isso já é
// coberto pela lib de recorte separadamente, e o Canvas real não funciona
// direito em jsdom de qualquer forma).
vi.mock('../../components/ImageCropModal', () => ({
  default: ({ onConfirm }) => (
    <button onClick={() => onConfirm(new File(['conteudo'], 'foto-recortada.jpg', { type: 'image/jpeg' }))}>
      confirmar-recorte-teste
    </button>
  ),
}));

function renderNewProductForm() {
  return render(
    <MemoryRouter initialEntries={['/produtos/novo']}>
      <AuthProvider>
        <Routes>
          <Route path="/produtos/novo" element={<ProductForm />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('ProductForm — upload de imagem no cadastro (regressão de imagem duplicada)', () => {
  let uploadCallCount;

  beforeEach(() => {
    localStorage.clear();
    loginAs({ id: 'u1', name: 'Admin', email: 'a@t.com', role: 'admin' });
    uploadCallCount = 0;
    global.fetch = vi.fn((url, options) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '');
      if (path.includes('/admin/uploads') && options?.method === 'POST') {
        uploadCallCount += 1;
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ url: `http://exemplo.com/foto-${uploadCallCount}.jpg` }) });
      }
      return mockFetchFor([['categories', []]])(url);
    });
  });

  it('selecionar UM arquivo e confirmar o recorte UMA vez resulta em exatamente UMA imagem (não duas)', async () => {
    const user = userEvent.setup();
    renderNewProductForm();

    await screen.findByText(/enviar do computador/i);

    const file = new File(['conteudo-original'], 'foto.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    await user.upload(fileInput, file);

    // Modal (mockado) deve aparecer exatamente uma vez pra essa única foto
    const confirmButtons = await screen.findAllByText('confirmar-recorte-teste');
    expect(confirmButtons).toHaveLength(1);

    await user.click(confirmButtons[0]);

    // Espera a chamada de upload completar
    await waitFor(() => expect(uploadCallCount).toBe(1));

    // O modal de recorte não deve reaparecer depois de confirmar a única foto da fila
    expect(screen.queryByText('confirmar-recorte-teste')).not.toBeInTheDocument();

    // E o upload real (fetch) só deve ter sido chamado UMA vez pra /admin/uploads
    const uploadCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes('/admin/uploads'));
    expect(uploadCalls).toHaveLength(1);
  });

  it('selecionar DOIS arquivos gera duas confirmações de recorte em sequência, uma de cada vez — não simultâneas', async () => {
    const user = userEvent.setup();
    renderNewProductForm();

    await screen.findByText(/enviar do computador/i);

    const file1 = new File(['a'], 'foto1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['b'], 'foto2.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]');

    await user.upload(fileInput, [file1, file2]);

    // Só UM modal de recorte visível por vez, mesmo com 2 arquivos na fila
    let confirmButtons = await screen.findAllByText('confirmar-recorte-teste');
    expect(confirmButtons).toHaveLength(1);

    await user.click(confirmButtons[0]);
    await waitFor(() => expect(uploadCallCount).toBe(1));

    // Depois de confirmar a primeira, a segunda da fila aparece — ainda só uma por vez
    confirmButtons = await screen.findAllByText('confirmar-recorte-teste');
    expect(confirmButtons).toHaveLength(1);

    await user.click(confirmButtons[0]);
    await waitFor(() => expect(uploadCallCount).toBe(2));

    expect(screen.queryByText('confirmar-recorte-teste')).not.toBeInTheDocument();
  });
});
