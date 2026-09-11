import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageCropModal from '../ImageCropModal';

// react-easy-crop precisa de carregamento real de imagem (Image.onload) que
// não funciona de forma confiável em jsdom — mocka só o suficiente pra
// simular que o usuário já ajustou o enquadramento (croppedAreaPixels
// definido), que é a pré-condição pro botão de confirmar ficar habilitado.
vi.mock('react-easy-crop', () => ({
  default: function MockCropper({ onCropComplete }) {
    // useEffect (não direto no corpo) — chamar onCropComplete durante o
    // render criaria um objeto novo a cada renderização e um loop infinito.
    useEffect(() => {
      if (onCropComplete) onCropComplete({}, { x: 0, y: 0, width: 100, height: 100 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="cropper-stub" />;
  },
}));

// Simula o tempo real de processamento do canvas (ctx.drawImage + toBlob),
// que não é instantâneo — é justamente essa janela de tempo que permite um
// clique duplo real disparar handleConfirm duas vezes antes do React
// desabilitar o botão.
vi.mock('../../lib/cropImage', () => ({
  getCroppedImageBlob: vi.fn(() => new Promise((resolve) => {
    setTimeout(() => resolve(new File(['conteudo'], 'recortada.jpg', { type: 'image/jpeg' })), 30);
  })),
}));

describe('ImageCropModal — proteção contra clique duplo no confirmar', () => {
  it('clique duplo rápido no "Usar essa imagem" chama onConfirm só UMA vez (regressão de imagem duplicada)', async () => {
    const onConfirm = vi.fn();
    render(<ImageCropModal imageSrc="blob:fake" onCancel={vi.fn()} onConfirm={onConfirm} />);

    const button = await screen.findByRole('button', { name: /usar essa imagem/i });

    // Dispara dois cliques o mais rápido possível, sem esperar o React
    // re-renderizar entre um e outro — é exatamente essa janela que causava
    // o bug antes da correção (o disabled=true só vale a partir do próximo render).
    button.click();
    button.click();

    // Espera a Promise mockada (30ms) resolver antes de checar
    await act(() => new Promise((r) => setTimeout(r, 60)));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('clique único continua funcionando normalmente', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ImageCropModal imageSrc="blob:fake" onCancel={vi.fn()} onConfirm={onConfirm} />);

    const button = await screen.findByRole('button', { name: /usar essa imagem/i });
    await user.click(button);

    await act(() => new Promise((r) => setTimeout(r, 60)));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
