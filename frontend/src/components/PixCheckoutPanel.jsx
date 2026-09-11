import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import Button from './Button';
import { formatPrice } from '../lib/format';

const POLL_INTERVAL_MS = 4000;

/**
 * Mostra o QR Code Pix gerado pro pedido e fica consultando o status
 * automaticamente (a cada 4s) até confirmar o pagamento — o cliente não
 * precisa clicar em nada, só escanear e esperar. Usado exclusivamente pra
 * pedidos com frete por transportadora real (Correios/Melhor Envio), onde
 * não existe entregador pra combinar pagamento na entrega.
 */
export default function PixCheckoutPanel({ orderId, total, onConfirmed }) {
  const [pixData, setPixData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.post('/payments/pix', { order_id: orderId })
      .then(setPixData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível gerar a cobrança Pix.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!pixData || pixData.status === 'approved') return undefined;
    const interval = setInterval(async () => {
      try {
        const result = await api.get(`/payments/pix/${orderId}/status`);
        if (result.status === 'approved') {
          clearInterval(interval);
          onConfirmed();
        }
      } catch {
        // falha pontual de rede na consulta não deve travar o polling
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pixData, orderId, onConfirmed]);

  function handleCopy() {
    navigator.clipboard.writeText(pixData.pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <p className="text-sm text-ink-soft">Gerando cobrança Pix...</p>;
  }

  if (error) {
    return <p className="text-sm font-bold text-danger">{error}</p>;
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-ink-soft">
        Este pedido tem frete por transportadora — sem entregador pra combinar pagamento, por isso o Pix precisa ser
        pago <strong>antes</strong> do envio. Total: <strong>{formatPrice(total)}</strong>
      </p>

      {pixData?.pixQrCode && (
        <img
          src={`data:image/png;base64,${pixData.pixQrCode}`}
          alt="QR Code Pix"
          className="mx-auto h-56 w-56 rounded-lg border border-line"
        />
      )}

      {pixData?.pixCopyPaste && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-ink-soft">Ou copie o código</p>
          <div className="flex gap-2">
            <input readOnly className="min-w-0 flex-1 truncate rounded border border-line px-3 py-2 text-xs" value={pixData.pixCopyPaste} />
            <Button type="button" variant="secondary" onClick={handleCopy}>{copied ? 'Copiado ✓' : 'Copiar'}</Button>
          </div>
        </div>
      )}

      <p className="animate-pulse text-xs text-ink-soft">Aguardando confirmação do pagamento...</p>
    </div>
  );
}
