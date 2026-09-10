import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import Field, { inputClass } from './Field';
import Button from './Button';
import { ErrorNotice } from './States';
import { ApiError } from '../api/client';
import { maskPhone } from '../lib/masks';

const emptyLogin = { email: '', password: '' };
const emptyRegister = { name: '', email: '', password: '', phone: '' };

export default function LoginModal() {
  const { login, register } = useAuth();
  const { isOpen, redirectTo, closeLoginModal } = useAuthModal();
  const navigate = useNavigate();

  const [tab, setTab] = useState('login');
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  function handleClose() {
    setTab('login');
    setLoginForm(emptyLogin);
    setRegisterForm(emptyRegister);
    setError('');
    closeLoginModal();
  }

  function switchTab(next) {
    setTab(next);
    setError('');
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      handleClose();
      if (redirectTo) navigate(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setError('');
    if (registerForm.password.length < 8) {
      setError('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await register(registerForm);
      handleClose();
      if (redirectTo) navigate(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar sua conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[250] flex items-start justify-center overflow-y-auto bg-black/75 p-5 py-10 backdrop-blur-[4px] sm:items-center sm:py-5"
      onClick={handleClose}
    >
      <div
        className="my-auto w-full max-w-[450px] rounded-lg bg-white p-6 shadow-[0_10px_25px_rgba(0,0,0,0.3)] sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex border-b-2 border-line">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 border-b-2 py-2.5 text-xs font-black uppercase tracking-wide transition-colors ${
              tab === 'login' ? '-mb-0.5 border-tag text-[#111111]' : 'border-transparent text-[#777777] hover:text-[#111111]'
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => switchTab('register')}
            className={`flex-1 border-b-2 py-2.5 text-xs font-black uppercase tracking-wide transition-colors ${
              tab === 'register' ? '-mb-0.5 border-tag text-[#111111]' : 'border-transparent text-[#777777] hover:text-[#111111]'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <Field label="E-mail">
              <input
                type="email" required autoFocus className={inputClass}
                value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              />
            </Field>
            <Field label="Senha">
              <input
                type="password" required className={inputClass}
                value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </Field>
            <p className="text-right">
              <Link to="/esqueci-a-senha" onClick={handleClose} className="font-mono text-[11px] uppercase text-ink-soft underline decoration-dotted hover:text-tag-dark">
                Esqueci a senha
              </Link>
            </p>

            <ErrorNotice message={error} />

            <Button type="submit" variant="tag" className="w-full justify-center" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar na conta'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleClose} className="w-full justify-center">
              Cancelar
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <Field label="Nome completo">
              <input required className={inputClass} value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} />
            </Field>
            <Field label="E-mail">
              <input type="email" required className={inputClass} value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <input inputMode="numeric" placeholder="(00) 00000-0000" className={inputClass} value={registerForm.phone} onChange={(e) => setRegisterForm({ ...registerForm, phone: maskPhone(e.target.value) })} />
            </Field>
            <Field label="Senha" hint="Mínimo de 8 caracteres">
              <input type="password" required minLength={8} className={inputClass} value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
            </Field>

            <ErrorNotice message={error} />

            <Button type="submit" variant="tag" className="w-full justify-center" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleClose} className="w-full justify-center">
              Cancelar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
