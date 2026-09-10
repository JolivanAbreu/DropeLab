import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ProductMedia from '../components/ProductMedia';
import { LoadingBlock, EmptyState } from '../components/States';
import Button from '../components/Button';
import { formatPrice, formatDate, STATUS_LABELS, STATUS_COLORS } from '../lib/format';

// Pagamento acontece na entrega — "pago" só é alcançado depois de
// "entregue" (nunca antes), então já é considerado concluído, não "em andamento".
const IN_PROGRESS = ['aguardando_pagamento', 'em_separacao', 'enviado'];
const DONE = ['entregue', 'pago', 'cancelado', 'reembolsado'];

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('todos');

  useEffect(() => {
    api.get('/orders').then(setOrders).catch(() => setOrders([]));
  }, []);

  const filtered = useMemo(() => {
    if (!orders) return [];
    if (filter === 'andamento') return orders.filter((o) => IN_PROGRESS.includes(o.status));
    if (filter === 'concluidos') return orders.filter((o) => DONE.includes(o.status));
    return orders;
  }, [orders, filter]);

  if (orders === null) return <div className="mx-auto max-w-7xl px-2.5 py-10 sm:px-4"><LoadingBlock label="Carregando pedidos" /></div>;

  const countAndamento = orders.filter((o) => IN_PROGRESS.includes(o.status)).length;
  const countConcluidos = orders.filter((o) => DONE.includes(o.status)).length;

  return (
    <div className="mx-auto max-w-7xl px-2.5 py-4 sm:px-4">
      <div className="rounded-lg bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-4">
          <h1 className="flex items-center gap-2.5 text-[22px] font-black uppercase text-[#111111]">📦 Meus Pedidos</h1>
          <div className="flex flex-wrap gap-2">
            {[
              ['todos', `Todos (${orders.length})`],
              ['andamento', `Em andamento (${countAndamento})`],
              ['concluidos', `Concluídos (${countConcluidos})`],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-[20px] px-4 py-2 font-mono text-[11px] font-black uppercase transition-colors ${
                  filter === value ? 'bg-[#111111] text-white' : 'bg-[#f0f0f2] text-[#555555] hover:bg-[#111111] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {orders.length === 0 && (
          <div className="mt-6">
            <EmptyState title="Nenhum pedido ainda" description="Seus pedidos aparecem aqui assim que você finalizar uma compra." action={<Button as={Link} to="/produtos" variant="tag">Ver produtos</Button>} />
          </div>
        )}

        <div className="mt-5 flex flex-col gap-5">
          {filtered.map((order) => (
            <div key={order.id} className="overflow-hidden rounded-lg border border-line transition-shadow hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line bg-[#f8f8fa] px-4.5 py-3.5">
                <div className="flex flex-wrap items-center gap-5">
                  <span className="text-[13px] font-black text-[#111111]">PEDIDO #{order.orderNumber}</span>
                  <span className="text-[11px] font-semibold text-ink-soft">📅 Realizado em {formatDate(order.createdAt)}</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-[10px] font-black uppercase ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="flex flex-col gap-4 p-4.5">
                {order.items?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="h-[75px] w-[60px] shrink-0 overflow-hidden rounded bg-canvas">
                        <ProductMedia product={item.variant?.product} color={item.variant?.color} className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-[#111111]">{item.variant?.product?.name || 'Produto'}</h4>
                        <p className="mt-1 text-[11px] font-semibold text-ink-soft">
                          Tamanho: <strong className="text-[#111111]">{item.variant?.size}</strong> · Cor: <strong className="text-[#111111]">{item.variant?.color}</strong> · Qtd: <strong className="text-[#111111]">{item.quantity}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-[13px] font-black text-[#111111]">{formatPrice(item.unitPrice * item.quantity)}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line px-4.5 py-3.5">
                <p className="text-[13px] text-[#333333]">Total do pedido: <strong className="text-[15px] text-[#111111]">{formatPrice(order.total)}</strong></p>
                <Button as={Link} to={`/minha-conta/pedidos/${order.id}`} size="sm">👁 Ver Detalhes</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
