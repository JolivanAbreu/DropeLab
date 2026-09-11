import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import StatusPill from '../components/StatusPill';
import Button from '../components/Button';
import { inputClass } from '../components/Field';
import { LoadingBlock, EmptyState } from '../components/States';
import { formatPrice, formatDateTime, ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '../lib/format';

const PAYMENT_METHOD_LABELS = {
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  cash: 'Dinheiro',
  pix: 'Pix',
  pix_antecipado: 'Pix antecipado',
};

const STATUS_FILTERS = [
  ['', 'Todos'],
  ['aguardando_pagamento', 'Aguardando pagamento'],
  ['pago', 'Pago'],
  ['em_separacao', 'Em separação'],
  ['enviado', 'Enviado'],
  ['entregue', 'Entregue'],
  ['cancelado', 'Cancelado'],
];

export default function Orders() {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    api.get(`/admin/orders?${params.toString()}`).then(setResult).finally(() => setLoading(false));
  }, [status, search]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <p className="mt-1 text-sm text-ink-soft">{result?.total ?? '—'} pedidos</p>
      </div>

      <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-wrap gap-2">
        <input
          className={`${inputClass} max-w-sm`}
          placeholder="Buscar por número do pedido, nome ou e-mail..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Button type="submit" variant="secondary">Buscar</Button>
        {search && <Button type="button" variant="ghost" onClick={clearSearch}>Limpar busca</Button>}
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${status === value ? 'border-ink bg-ink text-white' : 'border-line text-ink-soft hover:border-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        {loading && <div className="p-6"><LoadingBlock label="Carregando pedidos" /></div>}
        {!loading && result?.data?.length === 0 && (
          <div className="p-6">
            <EmptyState title="Nenhum pedido encontrado" description={search ? `Nada encontrado para "${search}".` : undefined} />
          </div>
        )}

        {!loading && result?.data?.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((order) => (
                <tr key={order.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3">
                    <Link to={`/pedidos/${order.id}`} className="font-mono font-medium hover:text-tag">{order.orderNumber}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <p>{order.user?.name || '—'}</p>
                    <p className="text-xs text-ink-soft">{order.user?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDateTime(order.createdAt)}</td>
                  <td className="px-4 py-3 font-mono">{formatPrice(order.total)}</td>
                  <td className="px-4 py-3">
                    <p>{PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}</p>
                    {order.paymentMethod === 'cash' && Number(order.changeFor) > 0 && (
                      <p className="text-xs text-ink-soft">troco: {formatPrice(Number(order.changeFor) - Number(order.total))}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill label={ORDER_STATUS_LABELS[order.status]} tone={ORDER_STATUS_TONE[order.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
