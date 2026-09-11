import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import StatusPill from '../components/StatusPill';
import Button from '../components/Button';
import { inputClass } from '../components/Field';
import { ErrorNotice, SuccessNotice, LoadingBlock } from '../components/States';
import { formatPrice, formatDateTime, ORDER_STATUS_LABELS, ORDER_STATUS_TONE, ORDER_NEXT_STATUSES } from '../lib/format';
import { buildCustomerWhatsAppLink } from '../lib/whatsapp';

const PAYMENT_METHOD_LABELS = {
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  cash: 'Dinheiro',
  pix: 'Pix',
  pix_antecipado: 'Pix antecipado (frete por transportadora)',
};

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [nextStatus, setNextStatus] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api.get(`/admin/orders/${id}`).then((data) => {
      setOrder(data);
      setNextStatus('');
      setTrackingCode(data.trackingCode || '');
    });
  }

  useEffect(load, [id]);

  async function handleUpdateStatus(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!nextStatus) return;
    // Código de rastreio só é obrigatório pra frete com rastreamento de
    // verdade (Correios/Melhor Envio) — Uber Flash, 99 e "combinar com o
    // vendedor" nunca têm código de rastreio, então não travam aqui.
    if (nextStatus === 'enviado' && !order.requiresShippingArrangement && !trackingCode) {
      setError('Informe o código de rastreio para marcar como enviado.');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/admin/orders/${id}/status`, { status: nextStatus, trackingCode: nextStatus === 'enviado' ? trackingCode : undefined });
      setSuccess('Status atualizado.');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o status.');
    } finally {
      setSaving(false);
    }
  }

  if (!order) return <LoadingBlock label="Carregando pedido" />;

  const options = ORDER_NEXT_STATUSES[order.status] || [];

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-ink-soft">{formatDateTime(order.createdAt)}</p>
        </div>
        <StatusPill label={ORDER_STATUS_LABELS[order.status]} tone={ORDER_STATUS_TONE[order.status]} />
      </div>

      {order.user && (
        <section className="mt-6 rounded-lg border border-line bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Cliente</h2>
          <div className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
            <p><span className="text-ink-soft">Nome:</span> {order.user.name}</p>
            <p><span className="text-ink-soft">E-mail:</span> {order.user.email}</p>
            <p><span className="text-ink-soft">Telefone:</span> {order.user.phone || '—'}</p>
          </div>

          {order.requiresShippingArrangement && order.shippingContactMethod === 'store' && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs text-ink-soft">
                Este pedido escolheu <strong>frete a combinar</strong> — combine valor e prazo direto com o cliente.
              </p>
              {order.user.phone ? (
                <Button
                  as="a"
                  href={buildCustomerWhatsAppLink(order.user.phone, order)}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  className="mt-2"
                >
                  Contatar no WhatsApp
                </Button>
              ) : (
                <p className="mt-2 text-xs text-ink-soft">Cliente sem telefone cadastrado — contate por e-mail.</p>
              )}
            </div>
          )}

          {order.requiresShippingArrangement && order.shippingContactMethod === 'customer_app' && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs text-ink-soft">
                Este pedido escolheu <strong>{order.shippingMethodName}</strong> — o próprio cliente pede a
                corrida e paga direto no app. Não é preciso combinar nada por aqui.
              </p>
            </div>
          )}
        </section>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Itens</h2>
          <div className="mt-3 space-y-3">
            {order.items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  {item.variant?.product?.images?.[0]?.url ? (
                    <img src={item.variant.product.images[0].url} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-canvas" />
                  )}
                  <div>
                    <p className="font-medium">{item.variant?.product?.name}</p>
                    <p className="text-xs text-ink-soft">{item.variant?.size} · {item.variant?.color} · qtd {item.quantity}</p>
                  </div>
                </div>
                <p className="font-mono">{formatPrice(item.unitPrice * item.quantity)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t border-line pt-3 font-mono text-sm">
            <div className="flex justify-between"><span className="text-ink-soft">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
            {Number(order.discount) > 0 && <div className="flex justify-between"><span className="text-ink-soft">Desconto</span><span>−{formatPrice(order.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-ink-soft">Frete{order.shippingMethodName ? ` (${order.shippingMethodName})` : ''}</span><span>{formatPrice(order.shippingCost)}</span></div>
            <div className="flex justify-between border-t border-line pt-1 font-semibold"><span>Total</span><span>{formatPrice(order.total)}</span></div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Endereço de entrega</h2>
          {order.address ? (
            <p className="mt-3 text-sm">
              {order.address.street}, {order.address.number}
              {order.address.complement && ` — ${order.address.complement}`}
              <br />{order.address.neighborhood}, {order.address.city}/{order.address.state}
              <br />CEP {order.address.zip}
            </p>
          ) : <p className="mt-3 text-sm text-ink-soft">—</p>}

          {order.paymentMethod && (
            <>
              <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Pagamento (na entrega)</h2>
              <p className="mt-2 text-sm">
                {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}
                {order.paymentMethod === 'cash' && (
                  Number(order.changeFor) > 0
                    ? <span className="mt-1 block text-xs font-semibold text-tag-dark">Troco pra {formatPrice(order.changeFor)} — levar {formatPrice(Number(order.changeFor) - Number(order.total))} de troco</span>
                    : <span className="mt-1 block text-xs text-ink-soft">Sem troco</span>
                )}
              </p>
            </>
          )}
        </section>
      </div>

      {options.length > 0 && (
        <section className="mt-6 rounded-lg border border-line bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Atualizar status</h2>
          <form onSubmit={handleUpdateStatus} className="mt-3 flex flex-wrap items-end gap-3">
            <select className={`${inputClass} w-56`} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
              <option value="">Selecione o novo status...</option>
              {options.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
            </select>
            {nextStatus === 'enviado' && (
              <input
                className={`${inputClass} w-56`}
                placeholder={order.requiresShippingArrangement ? 'Código de rastreio (opcional)' : 'Código de rastreio'}
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
              />
            )}
            <Button type="submit" disabled={saving || !nextStatus}>{saving ? 'Salvando...' : 'Atualizar'}</Button>
          </form>
          <div className="mt-3">
            <ErrorNotice message={error} />
            <SuccessNotice message={success} />
          </div>
        </section>
      )}
    </div>
  );
}
