import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Field, { inputClass } from '../components/Field';
import Button from '../components/Button';
import { ErrorNotice, LoadingBlock } from '../components/States';
import { maskCPF, maskPhone } from '../lib/masks';

const ROLE_LABELS = { customer: 'Cliente', operator: 'Operador', admin: 'Administrador' };

export default function MyAccount() {
  const { setUser } = useAuth();
  const [profile, setProfile] = useState(null);

  const [form, setForm] = useState({ name: '', phone: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
  const [emailError, setEmailError] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    api.get('/account').then((data) => {
      setProfile(data);
      setForm({ name: data.name, phone: maskPhone(data.phone || '') });
    });
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

  if (!profile) return <LoadingBlock label="Carregando conta" />;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Minha conta</h1>
      <p className="mt-1 text-sm text-ink-soft">{ROLE_LABELS[profile.role] || profile.role}</p>

      <section className="mt-6 rounded-lg border border-line bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Dados pessoais</h2>
        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <Field label="Nome completo">
            <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <input inputMode="numeric" placeholder="(00) 00000-0000" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} />
          </Field>
          <Field label="E-mail" hint="Use a seção abaixo para trocar seu e-mail.">
            <input disabled className={`${inputClass} cursor-not-allowed opacity-60`} value={profile.email} readOnly />
          </Field>
          <Field label="CPF" hint="Documento fixo, não pode ser alterado.">
            <input disabled className={`${inputClass} cursor-not-allowed opacity-60`} value={maskCPF(profile.cpf || '')} readOnly />
          </Field>
          <ErrorNotice message={profileError} />
          {profileSaved && <p className="text-xs text-tag">Dados atualizados ✓</p>}
          <Button type="submit" disabled={savingProfile}>{savingProfile ? 'Salvando...' : 'Salvar alterações'}</Button>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Trocar e-mail</h2>
        <p className="mt-1 text-sm text-ink-soft">E-mail atual: {profile.email}</p>
        <form onSubmit={handleChangeEmail} className="mt-4 space-y-4">
          <Field label="Novo e-mail">
            <input type="email" required className={inputClass} value={emailForm.newEmail} onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })} />
          </Field>
          <Field label="Senha atual" hint="Confirme sua senha para trocar o e-mail">
            <input type="password" required className={inputClass} value={emailForm.currentPassword} onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })} />
          </Field>
          <ErrorNotice message={emailError} />
          {emailSaved && <p className="text-xs text-tag">E-mail atualizado ✓</p>}
          <Button type="submit" variant="secondary" disabled={savingEmail}>{savingEmail ? 'Salvando...' : 'Trocar e-mail'}</Button>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Trocar senha</h2>
        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <Field label="Senha atual">
            <input type="password" required className={inputClass} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
          </Field>
          <Field label="Nova senha" hint="Mínimo de 8 caracteres">
            <input type="password" required className={inputClass} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
          </Field>
          <Field label="Confirmar nova senha">
            <input type="password" required className={inputClass} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
          </Field>
          <ErrorNotice message={passwordError} />
          {passwordSaved && <p className="text-xs text-tag">Senha atualizada ✓</p>}
          <Button type="submit" variant="secondary" disabled={savingPassword}>{savingPassword ? 'Salvando...' : 'Trocar senha'}</Button>
        </form>
      </section>

      <TwoFactorSection profile={profile} onProfileChange={setProfile} />
    </div>
  );
}

function TwoFactorSection({ profile, onProfileChange }) {
  const [step, setStep] = useState('idle'); // idle | setup | backup-codes
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [disabling, setDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState('');

  async function handleStartSetup() {
    setError('');
    setBusy(true);
    try {
      const result = await api.post('/account/2fa/setup');
      setQrCode(result.qr_code);
      setSecret(result.secret);
      setStep('setup');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar a ativação.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmSetup(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api.post('/account/2fa/confirm', { code });
      setBackupCodes(result.backup_codes);
      setStep('backup-codes');
      onProfileChange((prev) => ({ ...prev, twoFactorEnabled: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Código inválido.');
    } finally {
      setBusy(false);
    }
  }

  function handleFinish() {
    setStep('idle');
    setQrCode(null);
    setSecret(null);
    setCode('');
    setBackupCodes(null);
  }

  async function handleDisable(e) {
    e.preventDefault();
    setDisableError('');
    setBusy(true);
    try {
      await api.post('/account/2fa/disable', { current_password: disablePassword });
      onProfileChange((prev) => ({ ...prev, twoFactorEnabled: false }));
      setDisabling(false);
      setDisablePassword('');
    } catch (err) {
      setDisableError(err instanceof ApiError ? err.message : 'Não foi possível desativar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-line bg-white p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Autenticação de dois fatores</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Uma camada extra de segurança no login — depois da senha, também pede um código de um app autenticador
        (Google Authenticator, Authy, etc.).
      </p>

      {step === 'idle' && (
        <div className="mt-4">
          {profile.twoFactorEnabled ? (
            <>
              <p className="text-xs font-bold text-tag">Ativado ✓</p>
              {!disabling ? (
                <button onClick={() => setDisabling(true)} className="mt-2 font-mono text-xs text-ink-soft underline decoration-dotted hover:text-danger-bg">
                  Desativar
                </button>
              ) : (
                <form onSubmit={handleDisable} className="mt-3 max-w-xs space-y-2.5">
                  <Field label="Confirme sua senha para desativar">
                    <input type="password" required className={inputClass} value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
                  </Field>
                  <ErrorNotice message={disableError} />
                  <div className="flex gap-2.5">
                    <Button type="submit" variant="secondary" disabled={busy}>{busy ? 'Desativando...' : 'Confirmar'}</Button>
                    <Button type="button" variant="ghost" onClick={() => { setDisabling(false); setDisablePassword(''); setDisableError(''); }}>Cancelar</Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <Button variant="secondary" onClick={handleStartSetup} disabled={busy}>{busy ? 'Gerando...' : 'Ativar 2FA'}</Button>
          )}
          {error && <p className="mt-2 text-xs text-danger-bg">{error}</p>}
        </div>
      )}

      {step === 'setup' && (
        <form onSubmit={handleConfirmSetup} className="mt-4 max-w-xs space-y-4">
          <div>
            <p className="text-xs font-medium text-ink-soft">1. Escaneie com seu app autenticador</p>
            {qrCode && <img src={qrCode} alt="QR Code do 2FA" className="mt-2 h-40 w-40 rounded border border-line" />}
            <p className="mt-2 break-all font-mono text-[10px] text-ink-soft">Ou digite manualmente: {secret}</p>
          </div>
          <Field label="2. Digite o código gerado pelo app">
            <input required autoFocus inputMode="numeric" maxLength={6} className={`${inputClass} text-center font-mono text-lg tracking-widest`} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <ErrorNotice message={error} />
          <div className="flex gap-2.5">
            <Button type="submit" disabled={busy}>{busy ? 'Confirmando...' : 'Confirmar e ativar'}</Button>
            <Button type="button" variant="ghost" onClick={handleFinish}>Cancelar</Button>
          </div>
        </form>
      )}

      {step === 'backup-codes' && backupCodes && (
        <div className="mt-4 max-w-sm">
          <p className="text-xs font-bold text-tag">2FA ativado com sucesso ✓</p>
          <p className="mt-2 text-xs text-ink-soft">
            Guarde estes códigos de backup em um lugar seguro — cada um funciona uma única vez e serve pra entrar
            caso você perca acesso ao app autenticador. Eles não aparecem de novo depois desta tela.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-canvas p-3 font-mono text-xs">
            {backupCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
          <Button className="mt-4" onClick={handleFinish}>Já guardei, concluir</Button>
        </div>
      )}
    </section>
  );
}
