import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { LoadingBlock, ErrorNotice } from '../components/States';
import Button from '../components/Button';
import ProductMedia from '../components/ProductMedia';
import ShippingArrangementNotice from '../components/ShippingArrangementNotice';
import { formatPrice, formatDateTime, STATUS_LABELS, STATUS_COLORS } from '../lib/format';

const CANCELABLE = ['aguardando_pagamento', 'em_separacao'];
const DELETABLE = ['aguardando_pagamento', 'cancelado'];

// Pagamento acontece na entrega — "Pagamento Confirmado" agora é o ÚLTIMO
// passo da linha do tempo (depois de entregue), não mais o segundo.
const TIMELINE_STEPS = [
  { key: 'realizado', label: 'Pedido Realizado', icon: '✓' },
  { key: 'separacao', label: 'Em Separação', icon: '📦' },
  { key: 'transito', label: 'Em Trânsito', icon: '🚚' },
  { key: 'entregue', label: 'Entregue', icon: '🏠' },
  { key: 'pago', label: 'Pagamento Confirmado', icon: '💳' },
];

// A partir do status real do pedido, decide quantos passos da linha do
// tempo já foram completados e qual está "ativo" agora.
function timelineProgress(status) {
  const map = {
    aguardando_pagamento: 0,
    em_separacao: 1,
    enviado: 2,
    entregue: 3,
    pago: 4,
  };
  return map[status] ?? 0;
}

const PAYMENT_METHOD_LABELS = {
  credit_card: 'Cartão de crédito (na entrega)',
  debit_card: 'Cartão de débito (na entrega)',
  cash: 'Dinheiro (na entrega)',
  pix: 'Pix (na entrega)',
};

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  function load() {
    api.get(`/orders/${id}`).then(setOrder);
  }

  useEffect(load, [id]);

  async function handleCancel() {
    setError('');
    setBusy(true);
    try {
      await api.post(`/orders/${id}/cancel`);
      setConfirmingCancel(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cancelar o pedido.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setError('');
    setBusy(true);
    try {
      await api.delete(`/orders/${id}`);
      navigate('/minha-conta/pedidos');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir o pedido.');
      setBusy(false);
    }
  }

  function handleCopyTracking() {
    navigator.clipboard.writeText(order.trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!order) return <div className="mx-auto max-w-7xl px-2.5 py-10 sm:px-4"><LoadingBlock label="Carregando pedido" /></div>;

  const isTerminalBad = ['cancelado', 'reembolsado'].includes(order.status);
  const canCancel = CANCELABLE.includes(order.status);
  const canDelete = DELETABLE.includes(order.status);
  const progress = timelineProgress(order.status);
  const changeAmount = order.changeFor ? Number(order.changeFor) - Number(order.total) : null;

  return (
    <div className="mx-auto max-w-7xl px-2.5 py-4 sm:px-4">
      <button onClick={() => navigate('/minha-conta/pedidos')} className="mb-3 inline-flex items-center gap-2 font-mono text-xs font-black uppercase text-[#333333] hover:text-tag-dark">
        ← Voltar para Meus Pedidos
      </button>

      {location.state?.justCreated && (
        <div className="mb-5 rounded-lg border border-tag-dark bg-lime px-4 py-3 text-sm font-bold">
          Pedido criado — pagamento combinado pra entrega. Obrigado pela compra!
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-lg bg-white p-5.5 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
        <div>
          <h2 className="text-[18px] font-black uppercase text-[#111111]">PEDIDO #{order.orderNumber}</h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">📅 Realizado em {formatDateTime(order.createdAt)}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-[10px] font-black uppercase ${STATUS_COLORS[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {!isTerminalBad && order.status !== 'pago' && (
        <div className="mt-4 rounded-lg bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
          <p className="text-xs font-bold uppercase text-ink-soft">Pagamento combinado pra entrega</p>
          <p className="mt-2 text-sm text-[#333333]">
            {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}
            {order.paymentMethod === 'cash' && (
              changeAmount > 0
                ? ` — troco pra ${formatPrice(order.changeFor)} (troco: ${formatPrice(changeAmount)})`
                : ' — sem troco'
            )}
          </p>
        </div>
      )}

      {!isTerminalBad && (
        <div className="mt-4 rounded-lg bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
          <p className="border-b-2 border-ink pb-3 text-[13px] font-black uppercase text-[#111111]">🚚 Status do Envio</p>

          <div className="relative mt-7 flex items-start justify-between px-1">
            <div className="absolute left-[6%] right-[6%] top-[18px] h-[3px] rounded bg-line" />
            <div
              className="absolute left-[6%] top-[18px] h-[3px] rounded bg-tag transition-all duration-500"
              style={{ width: `${Math.min(progress, 4) / 4 * 88}%` }}
            />
            {TIMELINE_STEPS.map((step, i) => (
              <div key={step.key} className="relative z-[1] flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-[13px] transition-all ${
                    i < progress ? 'border-[#111111] bg-[#111111] text-tag' :
                    i === progress ? 'border-[#111111] bg-tag text-[#111111] shadow-[0_0_0_4px_rgba(0,253,119,0.25)]' :
                    'border-line bg-[#f0f0f2] text-ink-soft'
                  }`}
                >
                  {i < progress ? '✓' : step.icon}
                </div>
                <p className={`max-w-[90px] text-[10px] font-black uppercase leading-tight ${i <= progress ? 'text-[#111111]' : 'text-ink-soft'}`}>{step.label}</p>
              </div>
            ))}
          </div>

          {order.trackingCode && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-line bg-[#f8f8fa] p-4">
              <div>
                <p className="text-[11px] font-bold uppercase text-ink-soft">Código de Rastreio Correios:</p>
                <p className="mt-0.5 text-[15px] font-black tracking-wide text-[#111111]">{order.trackingCode}</p>
              </div>
              <button onClick={handleCopyTracking} className="rounded bg-[#111111] px-4 py-2.5 font-mono text-[11px] font-black uppercase text-white hover:bg-black">
                {copied ? 'copiado ✓' : 'copiar código'}
              </button>
            </div>
          )}
        </div>
      )}

      <ShippingArrangementNotice order={order} />

      <div className="mt-4 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg bg-white p-5 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
          <p className="border-b-2 border-ink pb-3 text-xs font-black uppercase text-[#111111]">🛍 Itens do Pedido</p>
          <div className="mt-4 flex flex-col gap-3">
            {order.items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
                <div className="flex items-center gap-3">
                  <div className="h-[70px] w-14 shrink-0 overflow-hidden rounded bg-canvas">
                    <ProductMedia product={item.variant?.product} color={item.variant?.color} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-[#111111]">{item.variant?.product?.name || 'Produto'}</h4>
                    <p className="mt-1 text-[11px] text-ink-soft">Tamanho: <strong className="text-[#111111]">{item.variant?.size}</strong> · Cor: <strong className="text-[#111111]">{item.variant?.color}</strong></p>
                    <p className="text-[11px] text-ink-soft">Qtd: <strong className="text-[#111111]">{item.quantity}x {formatPrice(item.unitPrice)}</strong></p>
                  </div>
                </div>
                <p className="whitespace-nowrap text-sm font-black text-[#111111]">{formatPrice(item.unitPrice * item.quantity)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {order.address && (
            <div className="rounded-lg bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
              <p className="border-b-2 border-ink pb-2 text-xs font-black uppercase text-[#111111]">🏠 Endereço de Entrega</p>
              <p className="mt-3 text-xs leading-relaxed text-[#444444]">
                <strong className="text-[#111111]">{order.address.street}, {order.address.number}</strong>
                {order.address.complement && ` — ${order.address.complement}`}<br />
                {order.address.neighborhood} — {order.address.city}/{order.address.state}<br />
                CEP: {order.address.zip}
              </p>
            </div>
          )}

          <div className="rounded-lg bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
            <p className="border-b-2 border-ink pb-2 text-xs font-black uppercase text-[#111111]">Pagamento e Resumo</p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between text-[#333333]"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
              {Number(order.discount) > 0 && <div className="flex justify-between text-tag-dark"><span>Desconto</span><span>−{formatPrice(order.discount)}</span></div>}
              <div className="flex justify-between text-[#333333]">
                <span>Frete{order.shippingMethodName ? ` (${order.shippingMethodName})` : ''}</span>
                <span>{Number(order.shippingCost) > 0 ? formatPrice(order.shippingCost) : 'grátis'}</span>
              </div>
              <div className="flex justify-between text-[#333333]"><span>Forma de pagamento</span><span>{PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}</span></div>
              {changeAmount > 0 && (
                <div className="flex justify-between text-[#333333]"><span>Troco pra</span><span>{formatPrice(order.changeFor)}</span></div>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-sm font-black text-[#111111]"><span>Total {order.status === 'pago' ? '(pago)' : ''}</span><span>{formatPrice(order.total)}</span></div>
            </div>
          </div>
        </div>
      </div>

      <ErrorNotice message={error} />

      {(canCancel || canDelete) && (
        <div className="mt-6 space-y-4 rounded-lg bg-white p-5 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
          {canCancel && (
            <div>
              {!confirmingCancel ? (
                <button onClick={() => setConfirmingCancel(true)} className="font-mono text-xs uppercase text-ink-soft underline decoration-dotted hover:text-danger">
                  Cancelar pedido
                </button>
              ) : (
                <div className="rounded-lg border border-danger p-4">
                  <p className="text-sm">Tem certeza que quer cancelar este pedido?</p>
                  <div className="mt-3 flex gap-3">
                    <Button variant="tag" size="sm" onClick={handleCancel} disabled={busy}>{busy ? 'Cancelando...' : 'Sim, cancelar'}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)}>Voltar</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {canDelete && (
            <div>
              {!confirmingDelete ? (
                <button onClick={() => setConfirmingDelete(true)} className="font-mono text-xs uppercase text-ink-soft underline decoration-dotted hover:text-danger">
                  Excluir pedido
                </button>
              ) : (
                <div className="rounded-lg border border-danger p-4">
                  <p className="text-sm">Excluir remove este pedido definitivamente do seu histórico. Não dá pra desfazer.</p>
                  <div className="mt-3 flex gap-3">
                    <Button variant="tag" size="sm" onClick={handleDelete} disabled={busy}>{busy ? 'Excluindo...' : 'Sim, excluir'}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>Voltar</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
