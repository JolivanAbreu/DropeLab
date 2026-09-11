import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PixCheckoutPanel from '../PixCheckoutPanel';

describe('PixCheckoutPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('gera a cobrança ao montar e mostra o QR Code e o código copia-e-cola', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ orderId: 'o1', status: 'pending', pixQrCode: 'BASE64FAKE', pixCopyPaste: '00020126copia-fake' }),
    });

    render(<PixCheckoutPanel orderId="o1" total={135} onConfirmed={vi.fn()} />);

    const img = await screen.findByAltText('QR Code Pix');
    expect(img.src).toContain('BASE64FAKE');
    expect(screen.getByDisplayValue('00020126copia-fake')).toBeInTheDocument();

    const chargeCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes('/payments/pix'));
    expect(chargeCalls).toHaveLength(1);
  });

  it('mostra erro quando a geração da cobrança falha', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 502,
      json: async () => ({ error: 'payment_provider_unavailable', message: 'Não foi possível gerar a cobrança Pix no momento.' }),
    });

    render(<PixCheckoutPanel orderId="o1" total={135} onConfirmed={vi.fn()} />);

    expect(await screen.findByText(/não foi possível gerar a cobrança/i)).toBeInTheDocument();
  });

  it('consulta o status periodicamente e chama onConfirmed quando aprovado', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onConfirmed = vi.fn();

    let statusCallCount = 0;
    global.fetch = vi.fn((url) => {
      const path = String(url);
      if (path.includes('/payments/pix/') && path.includes('/status')) {
        statusCallCount += 1;
        const status = statusCallCount >= 2 ? 'approved' : 'pending';
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status }) });
      }
      return Promise.resolve({
        ok: true, status: 201,
        json: async () => ({ orderId: 'o1', status: 'pending', pixQrCode: 'BASE64FAKE', pixCopyPaste: 'copia-fake' }),
      });
    });

    render(<PixCheckoutPanel orderId="o1" total={135} onConfirmed={onConfirmed} />);
    await vi.waitFor(() => expect(screen.queryByText(/gerando cobrança/i)).not.toBeInTheDocument());

    await vi.advanceTimersByTimeAsync(4100);
    await vi.advanceTimersByTimeAsync(4100);

    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    vi.useRealTimers();
  });
});
