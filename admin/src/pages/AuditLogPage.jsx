import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LoadingBlock, EmptyState } from '../components/States';
import { formatDate } from '../lib/format';

const ACTION_LABELS = {
  'user.role_changed': 'Alterou perfil de usuário',
  'user.password_reset': 'Redefiniu senha de usuário',
  'product.deactivated': 'Desativou produto',
  'product.reactivated': 'Reativou produto',
  'product.deleted_permanently': 'Excluiu produto definitivamente',
  'product.bulk_activated': 'Ativou produtos em massa',
  'product.bulk_deactivated': 'Desativou produtos em massa',
  'product.bulk_price_adjusted': 'Reajustou preço em massa',
  'order.status_changed': 'Alterou status de pedido',
  'coupon.deleted': 'Excluiu cupom',
  'coupon.activated': 'Ativou cupom',
  'coupon.deactivated': 'Desativou cupom',
  'category.deleted': 'Excluiu categoria',
};

function describeDetails(log) {
  const d = log.details || {};
  switch (log.action) {
    case 'user.role_changed': return `${d.targetEmail || ''} → ${d.newRole || ''}`;
    case 'product.bulk_activated':
    case 'product.bulk_deactivated': return `${d.updated ?? d.ids?.length ?? 0} produto(s)`;
    case 'product.bulk_price_adjusted': return `${d.percentage > 0 ? '+' : ''}${d.percentage}% em ${d.updated ?? d.ids?.length ?? 0} produto(s)`;
    case 'order.status_changed': return `Pedido ${d.orderNumber || ''} → ${d.newStatus || ''}`;
    case 'coupon.deleted':
    case 'coupon.activated':
    case 'coupon.deactivated': return d.code || '';
    case 'category.deleted': return d.name || '';
    default: return '';
  }
}

export default function AuditLogPage() {
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get(`/admin/audit-logs?page=${page}`).then(setResult);
  }, [page]);

  if (result === null) return <LoadingBlock label="Carregando log de auditoria" />;

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Log de auditoria</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Registro de ações administrativas sensíveis — quem fez, o quê, e quando. Só visível para administradores.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        {result.data.length === 0 ? (
          <div className="p-6"><EmptyState title="Nenhuma ação registrada ainda" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Quem</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((log) => (
                <tr key={log.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{log.actorName}</p>
                    <p className="text-xs text-ink-soft">{log.actorEmail}</p>
                  </td>
                  <td className="px-4 py-3">{ACTION_LABELS[log.action] || log.action}</td>
                  <td className="px-4 py-3 text-ink-soft">{describeDetails(log)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-ink-soft">Página {page} de {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
