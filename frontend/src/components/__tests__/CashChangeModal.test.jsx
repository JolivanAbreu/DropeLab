import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CashChangeModal from '../CashChangeModal';

describe('CashChangeModal', () => {
  it('pergunta primeiro se precisa de troco', () => {
    render(<CashChangeModal total={100} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Vai precisar de troco?')).toBeInTheDocument();
  });

  it('responder "Não" confirma sem troco (chama onConfirm com null)', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<CashChangeModal total={100} onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Não' }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('responder "Sim" mostra o campo pra digitar o valor', async () => {
    const user = userEvent.setup();
    render(<CashChangeModal total={100} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Sim' }));
    expect(screen.getByPlaceholderText('Ex.: 100,00')).toBeInTheDocument();
  });

  it('calcula e mostra o troco em tempo real enquanto digita um valor válido', async () => {
    const user = userEvent.setup();
    render(<CashChangeModal total={100} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Sim' }));
    await user.type(screen.getByPlaceholderText('Ex.: 100,00'), '150');

    expect(screen.getByText(/Troco: R\$\s*50,00/)).toBeInTheDocument();
  });

  it('rejeita valor menor que o total do pedido', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<CashChangeModal total={100} onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Sim' }));
    await user.type(screen.getByPlaceholderText('Ex.: 100,00'), '50');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(screen.getByText(/igual ou maior que o total/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirma com valor válido, chamando onConfirm com o valor digitado', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<CashChangeModal total={100} onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Sim' }));
    await user.type(screen.getByPlaceholderText('Ex.: 100,00'), '200');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onConfirm).toHaveBeenCalledWith(200);
  });

  it('aceita valor igual ao total (sem sobra, mas válido)', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<CashChangeModal total={100} onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Sim' }));
    await user.type(screen.getByPlaceholderText('Ex.: 100,00'), '100');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onConfirm).toHaveBeenCalledWith(100);
  });

  it('botão cancelar chama onCancel', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<CashChangeModal total={100} onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByText(/cancelar e escolher outra forma/i));
    expect(onCancel).toHaveBeenCalled();
  });
});
