import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Field, { inputClass } from '../components/Field';
import Button from '../components/Button';
import { ErrorNotice, LoadingBlock } from '../components/States';
import { maskCPF, maskPhone } from '../lib/masks';

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
}

export default function Account() {
  const { setUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [address, setAddress] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
  const [emailError, setEmailError] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    api.get('/account').then((data) => {
      setProfile(data);
      setForm({ name: data.name, phone: maskPhone(data.phone || '') });
    });
    api.get('/addresses').then((list) => setAddress(list[0] || null)).catch(() => setAddress(null));
  }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError('');
    setProfileSaved(false);
    setSavingProfile(true);
    try {
      const updated = await api.put('/account', form);
      setProfile(updated);
      setUser({ name: updated.name });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangeEmail(e) {
    e.preventDefault();
    setEmailError('');
    setEmailSaved(false);

    if (!emailForm.newEmail || !emailForm.currentPassword) {
      setEmailError('Preencha o novo e-mail e sua senha atual.');
      return;
    }

    setSavingEmail(true);
    try {
      const updated = await api.put('/account/email', {
        new_email: emailForm.newEmail,
        current_password: emailForm.currentPassword,
      });
      setProfile(updated);
      setUser({ email: updated.email });
      setEmailForm({ newEmail: '', currentPassword: '' });
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2500);
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : 'Não foi possível trocar o e-mail.');
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('A confirmação não coincide com a nova senha.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/account/password', {
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setSavingPassword(false);
    }
  }

  if (!profile) return <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8"><LoadingBlock label="Carregando conta" /></div>;

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-5 rounded-lg bg-white p-5 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-5">
          <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-full border-[3px] border-tag bg-ink text-2xl font-black text-white">
            {initials(profile.name)}
          </div>
          <div>
            <h1 className="text-lg font-black uppercase">{profile.name}</h1>
            <p className="mt-1 text-xs text-ink-soft">{profile.email}{profile.phone ? ` · ${maskPhone(profile.phone)}` : ''}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-md bg-danger-bg px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white hover:opacity-90"
        >
          Sair da conta
        </button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-lg bg-white p-5 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
          <h2 className="border-b-2 border-ink pb-3 text-xs font-black uppercase tracking-wide text-[#111111]">Dados pessoais</h2>
          <form onSubmit={handleSaveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nome completo">
                <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </div>
            <Field label="Telefone / WhatsApp">
              <input inputMode="numeric" placeholder="(00) 00000-0000" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} />
            </Field>
            <Field label="CPF" hint="Documento fixo">
              <input disabled className={`${inputClass} cursor-not-allowed opacity-60`} value={maskCPF(profile.cpf || '')} readOnly />
            </Field>
            <div className="sm:col-span-2">
              <Field label="E-mail" hint="Use a seção ao lado para trocar seu e-mail">
                <input disabled className={`${inputClass} cursor-not-allowed opacity-60`} value={profile.email} readOnly />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <ErrorNotice message={profileError} />
              {profileSaved && <p className="text-xs font-bold text-tag-dark">Dados atualizados ✓</p>}
              <Button type="submit" disabled={savingProfile} className="mt-2">
                {savingProfile ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        </section>

        <div className="flex flex-col gap-5">
          <section className="rounded-lg bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
            <h2 className="border-b-2 border-ink pb-2 text-xs font-black uppercase tracking-wide text-[#111111]">Endereço principal</h2>
            {address ? (
              <p className="mt-3 text-xs leading-relaxed text-ink-soft">
                <strong className="text-ink">{address.street}, {address.number}</strong>
                {address.complement && ` — ${address.complement}`}<br />
                {address.neighborhood} — {address.city}/{address.state}<br />
                CEP: {address.zip}
              </p>
            ) : (
              <p className="mt-3 text-xs text-ink-soft">Nenhum endereço cadastrado ainda.</p>
            )}
            <Button as={Link} to="/minha-conta/enderecos" variant="secondary" size="sm" className="mt-3 w-full justify-center">
              {address ? 'Gerenciar endereços' : 'Cadastrar endereço'}
            </Button>
          </section>

          <section className="rounded-lg bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
            <h2 className="border-b-2 border-ink pb-2 text-xs font-black uppercase tracking-wide text-[#111111]">Trocar e-mail</h2>
            <form onSubmit={handleChangeEmail} className="mt-3 space-y-3">
              <Field label="Novo e-mail">
                <input type="email" required className={inputClass} value={emailForm.newEmail} onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })} />
              </Field>
              <Field label="Senha atual">
                <input type="password" required className={inputClass} value={emailForm.currentPassword} onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })} />
              </Field>
              <ErrorNotice message={emailError} />
              {emailSaved && <p className="text-xs font-bold text-tag-dark">E-mail atualizado ✓</p>}
              <Button type="submit" variant="secondary" size="sm" disabled={savingEmail} className="w-full justify-center">
                {savingEmail ? 'Salvando...' : 'Trocar e-mail'}
              </Button>
            </form>
          </section>

          <section className="rounded-lg bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
            <h2 className="border-b-2 border-ink pb-2 text-xs font-black uppercase tracking-wide text-[#111111]">Segurança</h2>
            <form onSubmit={handleChangePassword} className="mt-3 space-y-3">
              <Field label="Senha atual">
                <input type="password" required placeholder="••••••••" className={inputClass} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
              </Field>
              <Field label="Nova senha" hint="Mínimo de 8 caracteres">
                <input type="password" required className={inputClass} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
              </Field>
              <Field label="Confirmar nova senha">
                <input type="password" required className={inputClass} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
              </Field>
              <ErrorNotice message={passwordError} />
              {passwordSaved && <p className="text-xs font-bold text-tag-dark">Senha atualizada ✓</p>}
              <Button type="submit" variant="secondary" size="sm" disabled={savingPassword} className="w-full justify-center">
                {savingPassword ? 'Salvando...' : 'Atualizar senha'}
              </Button>
            </form>
          </section>

          <PrivacySection />
        </div>
      </div>
    </div>
  );
}

function PrivacySection() {
  const { logout } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const [confirming, setConfirming] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    setExporting(true);
    setExportError('');
    try {
      const data = await api.get('/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus-dados-dravennx-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Não foi possível exportar seus dados agora.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(e) {
    e.preventDefault();
    setDeleteError('');
    setDeleting(true);
    try {
      await api.delete('/account', { body: { current_password: deletePassword } });
      logout();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir a conta agora.');
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
      <h2 className="border-b-2 border-ink pb-2 text-xs font-black uppercase tracking-wide text-[#111111]">Privacidade e dados</h2>

      <div className="mt-3">
        <p className="text-xs text-ink-soft">
          Baixe uma cópia de tudo que guardamos sobre você — perfil, endereços, pedidos, avaliações e favoritos.
        </p>
        <Button variant="secondary" size="sm" className="mt-2.5" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Preparando...' : 'Baixar meus dados'}
        </Button>
        <ErrorNotice message={exportError} />
      </div>

      <div className="mt-5 rounded-md border border-danger/30 bg-danger/5 p-3.5">
        <p className="text-xs font-black uppercase text-danger">Excluir minha conta</p>
        <p className="mt-1 text-xs text-ink-soft">
          Seus dados pessoais (nome, e-mail, CPF, telefone) são apagados e o login para de funcionar. Pedidos já
          feitos continuam existindo por exigência fiscal, mas deixam de estar associados a você. Essa ação não
          pode ser desfeita.
        </p>

        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="mt-2.5 font-mono text-xs font-black uppercase text-danger underline decoration-dotted">
            Quero excluir minha conta
          </button>
        ) : (
          <form onSubmit={handleDelete} className="mt-3 space-y-2.5">
            <Field label="Confirme sua senha para excluir">
              <input type="password" required className={inputClass} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
            </Field>
            <ErrorNotice message={deleteError} />
            <div className="flex gap-2.5">
              <button type="submit" disabled={deleting} className="rounded-md bg-danger px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white hover:opacity-90 disabled:opacity-60">
                {deleting ? 'Excluindo...' : 'Sim, excluir de vez'}
              </button>
              <button type="button" onClick={() => { setConfirming(false); setDeletePassword(''); setDeleteError(''); }} className="rounded-md border border-line px-4 py-2 text-[11px] font-black uppercase tracking-wide text-ink-soft hover:border-ink">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
