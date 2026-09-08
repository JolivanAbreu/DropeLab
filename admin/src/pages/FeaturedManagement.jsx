import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { inputClass } from '../components/Field';
import { ErrorNotice, LoadingBlock, EmptyState } from '../components/States';

const SLOT_LABELS = {
  '': 'Nenhum',
  banner: 'Banner principal',
  destaque: 'Fileira de destaques',
};

/**
 * Visão central de "onde cada produto aparece na home" — complementa (não
 * substitui) o campo já existente dentro do formulário de cada produto:
 * aqui dá pra ver e trocar de uma vez todos os produtos marcados, sem
 * precisar abrir cada um individualmente pra descobrir quem está em quê.
 */
export default function FeaturedManagement() {
  const [products, setProducts] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  function load(query = search) {
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    api.get(`/admin/products?${params.toString()}`).then((res) => setProducts(res.data));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchSubmit(e) {
    e.preventDefault();
    load(search);
  }

  async function updateProduct(product, patch) {
    setError('');
    setSavingId(product.id);
    try {
      await api.put(`/admin/products/${product.id}`, patch);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...patch } : p)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSavingId(null);
    }
  }

  const bannerProducts = products?.filter((p) => p.featuredSlot === 'banner') || [];
  const destaqueProducts = products?.filter((p) => p.featuredSlot === 'destaque') || [];

  if (products === null) return <LoadingBlock label="Carregando produtos" />;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Destaques da home</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Escolha quais produtos aparecem no banner principal e na fileira de destaques da loja.
      </p>

      {bannerProducts.length > 1 && (
        <p className="mt-3 rounded-md border border-line bg-canvas-alt px-3 py-2 text-xs text-ink-soft">
          {bannerProducts.length} produtos estão marcados como "Banner principal" — a loja só mostra o
          mais recente. Deixe só um marcado pra evitar confusão.
        </p>
      )}

      <form onSubmit={handleSearchSubmit} className="mt-6 flex gap-2">
        <input
          className={`${inputClass} max-w-sm`}
          placeholder="Buscar produto por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-ink">Buscar</button>
      </form>

      <div className="mt-4"><ErrorNotice message={error} /></div>

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        {products.length === 0 ? (
          <div className="p-6"><EmptyState title="Nenhum produto encontrado" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Aparece em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-line align-top last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images?.[0]?.url ? (
                        <img src={product.images[0].url} alt="" className="h-12 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-10 rounded bg-canvas-alt" />
                      )}
                      <Link to={`/produtos/${product.id}`} className="font-medium hover:text-tag">{product.name}</Link>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded border border-line bg-white px-2 py-1.5 text-xs"
                      value={product.featuredSlot || ''}
                      disabled={savingId === product.id}
                      onChange={(e) => updateProduct(product, { featuredSlot: e.target.value || null })}
                    >
                      {Object.entries(SLOT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/produtos/${product.id}`} className="font-mono text-xs text-ink-soft underline decoration-dotted hover:text-tag">
                      ajustar foto
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-soft">
        {destaqueProducts.length} produto(s) na fileira de destaques da home.
      </p>
    </div>
  );
}
