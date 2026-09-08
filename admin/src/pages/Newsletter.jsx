import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Button from '../components/Button';
import { LoadingBlock, EmptyState } from '../components/States';
import { formatDate } from '../lib/format';

export default function Newsletter() {
  const [subscribers, setSubscribers] = useState(null);

  useEffect(() => {
    api.get('/admin/newsletter').then(setSubscribers);
  }, []);

  async function handleExport() {
    const token = localStorage.getItem('bos_admin_access_token');
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1';
    const res = await fetch(`${base}/admin/newsletter/export`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (subscribers === null) return <LoadingBlock label="Carregando assinantes" />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Newsletter</h1>
          <p className="mt-1 text-sm text-ink-soft">{subscribers.length} assinante(s) — formulário do rodapé da loja</p>
        </div>
        {subscribers.length > 0 && <Button variant="secondary" onClick={handleExport}>Exportar CSV</Button>}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        {subscribers.length === 0 ? (
          <div className="p-6"><EmptyState title="Ninguém assinou ainda" description="Assim que alguém se inscrever pelo rodapé da loja, aparece aqui." /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Assinou em</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{s.email}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
