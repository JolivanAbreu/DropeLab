import { useState } from 'react';
import Button from './Button';
import { formatPrice } from '../lib/format';

// Troco calculado na hora (valor - total), nunca armazenado separadamente.
export default function CashChangeModal({ total, onConfirm, onCancel }) {
  const [needsChange, setNeedsChange] = useState(null); // null | true | false
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  function handleAmountSubmit(e) {
    e.preventDefault();
    setError('');
    const value = Number(amount.replace(',', '.'));
    if (Number.isNaN(value) || value <= 0) {
      setError('Digite um valor válido.');
      return;
    }
    if (value < total) {
      setError(`O valor precisa ser igual ou maior que o total do pedido (${formatPrice(total)}).`);
      return;
    }
    onConfirm(value);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        {needsChange === null && (
          <>
            <h3 className="text-sm font-black uppercase text-[#111111]">Vai precisar de troco?</h3>
            <p className="mt-2 text-xs text-ink-soft">
              Pagamento em dinheiro na entrega — total do pedido: <strong>{formatPrice(total)}</strong>
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="tag" className="flex-1 justify-center" onClick={() => setNeedsChange(true)}>Sim</Button>
              <Button variant="ghost" className="flex-1 justify-center" onClick={() => onConfirm(null)}>Não</Button>
            </div>
          </>
        )}

        {needsChange === true && (
          <form onSubmit={handleAmountSubmit}>
            <h3 className="text-sm font-black uppercase text-[#111111]">Vai pagar com quanto?</h3>
            <p className="mt-2 text-xs text-ink-soft">
              Total do pedido: <strong>{formatPrice(total)}</strong> — informe a nota/valor que vai usar pra pagar,
              pra o entregador já levar o troco certo.
            </p>
            <input
              autoFocus
              inputMode="decimal"
              placeholder="Ex.: 100,00"
              className="mt-4 w-full rounded-md border border-line px-3 py-2.5 text-sm outline-none focus:border-ink"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {amount && !Number.isNaN(Number(amount.replace(',', '.'))) && Number(amount.replace(',', '.')) >= total && (
              <p className="mt-2 text-xs font-bold text-tag-dark">
                Troco: {formatPrice(Number(amount.replace(',', '.')) - total)}
              </p>
            )}
            {error && <p className="mt-2 text-xs font-bold text-danger">{error}</p>}
            <div className="mt-5 flex gap-3">
              <Button type="submit" variant="tag" className="flex-1 justify-center">Confirmar</Button>
              <Button type="button" variant="ghost" onClick={() => setNeedsChange(null)}>← Voltar</Button>
            </div>
          </form>
        )}

        <button onClick={onCancel} className="mt-4 block w-full text-center text-xs text-ink-soft underline decoration-dotted hover:text-tag-dark">
          Cancelar e escolher outra forma de pagamento
        </button>
      </div>
    </div>
  );
}
