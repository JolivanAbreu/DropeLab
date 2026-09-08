import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import StatusPill from '../components/StatusPill';
import { LoadingBlock, EmptyState, ErrorNotice } from '../components/States';
import { inputClass } from '../components/Field';
import { formatDate } from '../lib/format';

const ROLE_LABELS = { customer: 'Cliente', operator: 'Operador', admin: 'Administrador' };
const ROLE_TONE = { customer: 'neutral', operator: 'warn', admin: 'lime' };

function ResetPasswordAction({ user, onDone }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const data = await api.post(`/admin/users/${user.id}/reset-password`);
      setResult(data);
      onDone?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar a senha.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-md border border-line bg-canvas p-3 text-xs">
        <p>Senha temporária para <strong>{result.email}</strong>:</p>
        <p className="mt-1 select-all rounded bg-white px-2 py-1 font-mono text-sm text-ink">{result.temporaryPassword}</p>
        <p className="mt-2 text-ink-soft">Repasse por telefone/WhatsApp — não fica salva em nenhum lugar depois desta tela. Oriente a pessoa a trocar a senha assim que entrar.</p>
        <button onClick={() => { setResult(null); setOpen(false); }} className="mt-2 text-ink-soft underline decoration-dotted hover:text-tag">fechar</button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-ink-soft underline decoration-dotted hover:text-tag">
        Redefinir senha
      </button>
    );
  }

  return (
    <div className="rounded-md border border-line bg-canvas p-3 text-xs">
      <p>Gerar uma nova senha temporária para <strong>{user.name}</strong>? A senha atual deixa de funcionar imediatamente.</p>
      {error && <p className="mt-1 text-danger-bg">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={confirm} disabled={busy}>{busy ? 'Gerando...' : 'Confirmar'}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  function load(query = search, roleFilter = role) {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    if (roleFilter) params.set('role', roleFilter);
    api.get(`/admin/users?${params.toString()}`)
      .then(setResult)
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchSubmit(e) {
    e.preventDefault();
    load(search, role);
  }

  async function handleRoleChange(user, newRole) {
    if (user.id === currentUser?.id) return; // nunca deveria chegar aqui — a UI já esconde essa opção
    setError('');
    setSavingId(user.id);
    try {
      await api.put(`/admin/users/${user.id}/role`, { role: newRole });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível alterar o perfil.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <p className="mt-1 text-sm text-ink-soft">{result?.total ?? '—'} usuários cadastrados</p>
      </div>

      <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-wrap gap-2">
        <input
          className={`${inputClass} max-w-sm`}
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={`${inputClass} w-44`} value={role} onChange={(e) => { setRole(e.target.value); load(search, e.target.value); }}>
          <option value="">Todos os perfis</option>
          <option value="customer">Cliente</option>
          <option value="operator">Operador</option>
          <option value="admin">Administrador</option>
        </select>
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>

      <div className="mt-4"><ErrorNotice message={error} /></div>

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        {loading && <div className="p-6"><LoadingBlock label="Carregando usuários" /></div>}
        {!loading && result?.data?.length === 0 && <div className="p-6"><EmptyState title="Nenhum usuário encontrado" /></div>}

        {!loading && result?.data?.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Cadastro</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((user) => {
                const isSelf = user.id === currentUser?.id;
                return (
                <tr key={user.id} className="border-b border-line align-top last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3 font-medium">{user.name}{isSelf && <span className="ml-1 text-xs text-ink-soft">(você)</span>}</td>
                  <td className="px-4 py-3 text-ink-soft">{user.email}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill label={ROLE_LABELS[user.role]} tone={ROLE_TONE[user.role]} />
                      {isSelf ? (
                        <span className="text-xs text-ink-soft" title="Não é possível alterar o próprio perfil por aqui">
                          — seu perfil
                        </span>
                      ) : (
                        <select
                          className="rounded border border-line bg-white px-1.5 py-1 text-xs"
                          value={user.role}
                          disabled={savingId === user.id}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                        >
                          <option value="customer">Cliente</option>
                          <option value="operator">Operador</option>
                          <option value="admin">Administrador</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ResetPasswordAction user={user} onDone={() => {}} />
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
