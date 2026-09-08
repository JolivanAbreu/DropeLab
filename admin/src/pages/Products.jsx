import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import StatusPill from '../components/StatusPill';
import { LoadingBlock, EmptyState } from '../components/States';
import { inputClass } from '../components/Field';
import { formatPrice } from '../lib/format';

export default function Products() {
  const { isAdmin } = useAuth();
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [pricePercent, setPricePercent] = useState('');

  function load(query = '') {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    api.get(`/admin/products?${params.toString()}`)
      .then((data) => { setResult(data); setSelected(new Set()); })
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchSubmit(e) {
    e.preventDefault();
    load(search);
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!result?.data) return;
    setSelected((prev) => (prev.size === result.data.length ? new Set() : new Set(result.data.map((p) => p.id))));
  }

  async function handleBulkActive(active) {
    setBulkError('');
    setBulkBusy(true);
    try {
      await api.post('/admin/products/bulk-active', { ids: [...selected], active });
      load(search);
    } catch {
      setBulkError('Não foi possível concluir a ação em massa.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkPrice(e) {
    e.preventDefault();
    setBulkError('');
    const percentage = Number(pricePercent);
    if (Number.isNaN(percentage) || percentage === 0) {
      setBulkError('Digite um percentual válido (ex.: 10 ou -15).');
      return;
    }
    setBulkBusy(true);
    try {
      await api.post('/admin/products/bulk-price', { ids: [...selected], percentage });
      setShowPriceForm(false);
      setPricePercent('');
      load(search);
    } catch {
      setBulkError('Não foi possível reajustar os preços. Confira se o percentual não é muito negativo.');
    } finally {
      setBulkBusy(false);
    }
  }

  const allSelected = result?.data?.length > 0 && selected.size === result.data.length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Produtos</h1>
          <p className="mt-1 text-sm text-ink-soft">{result?.total ?? '—'} produtos cadastrados</p>
        </div>
        {isAdmin && <Button as={Link} to="/produtos/novo">+ Novo produto</Button>}
      </div>

      <form onSubmit={handleSearchSubmit} className="mt-6 flex gap-2">
        <input
          className={`${inputClass} max-w-sm`}
          placeholder="Buscar por nome ou slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>

      {isAdmin && selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-ink bg-canvas-alt px-4 py-3">
          <span className="text-sm font-semibold">{selected.size} selecionado(s)</span>
          <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => handleBulkActive(true)}>Ativar</Button>
          <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => handleBulkActive(false)}>Desativar</Button>
          <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => setShowPriceForm((v) => !v)}>Reajustar preço</Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-ink-soft underline decoration-dotted hover:text-tag">
            limpar seleção
          </button>
        </div>
      )}

      {showPriceForm && (
        <form onSubmit={handleBulkPrice} className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">Percentual (ex.: 10 para +10%, -15 para -15%)</label>
            <input
              type="number" step="0.01" required
              className={`${inputClass} w-48`}
              placeholder="10"
              value={pricePercent}
              onChange={(e) => setPricePercent(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={bulkBusy}>{bulkBusy ? 'Aplicando...' : `Aplicar a ${selected.size} produto(s)`}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowPriceForm(false)}>Cancelar</Button>
        </form>
      )}

      {bulkError && <p className="mt-3 text-xs font-semibold text-danger-bg">{bulkError}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        {loading && <div className="p-6"><LoadingBlock label="Carregando produtos" /></div>}

        {!loading && result?.data?.length === 0 && (
          <div className="p-6"><EmptyState title="Nenhum produto encontrado" /></div>
        )}

        {!loading && result?.data?.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                {isAdmin && (
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar todos" />
                  </th>
                )}
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Variações</th>
                <th className="px-4 py-3">Estoque total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((product) => {
                const totalStock = product.variants?.reduce((sum, v) => sum + v.stockQuantity, 0) || 0;
                return (
                  <tr key={product.id} className={`border-b border-line last:border-0 hover:bg-canvas ${selected.has(product.id) ? 'bg-canvas-alt' : ''}`}>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleOne(product.id)} aria-label={`Selecionar ${product.name}`} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {product.images?.[0]?.url ? (
                        <img src={product.images[0].url} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-canvas-alt" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/produtos/${product.id}`} className="font-medium hover:text-tag">{product.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{product.category?.name || '—'}</td>
                    <td className="px-4 py-3 font-mono">{formatPrice(product.basePrice)}</td>
                    <td className="px-4 py-3 text-ink-soft">{product.variants?.length || 0}</td>
                    <td className="px-4 py-3 font-mono">
                      {totalStock === 0 ? <span className="font-bold text-danger-bg">0</span> : totalStock}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill label={product.active ? 'Ativo' : 'Inativo'} tone={product.active ? 'lime' : 'neutral'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/produtos/${product.id}`}>
                        <Button variant="secondary" size="sm">Editar</Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
