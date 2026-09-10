import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Field, { inputClass } from '../components/Field';
import Button from '../components/Button';
import { ErrorNotice } from '../components/States';
import { ApiError } from '../api/client';
import { maskPhone } from '../lib/masks';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.redirectTo || '/';

  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar sua conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16 sm:px-8">
      <h1 className="font-display text-5xl">Criar conta</h1>
      <p className="mt-2 text-sm text-ink-soft">Rapidinho — só o essencial pra você comprar.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label="Nome completo">
          <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="E-mail">
          <input type="email" required className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Telefone">
          <input inputMode="numeric" placeholder="(00) 00000-0000" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} />
        </Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres">
          <input type="password" required className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>

        <ErrorNotice message={error} />

        <Button type="submit" variant="tag" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Criando conta...' : 'Criar conta'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        Já tem conta?{' '}
        <Link to="/entrar" state={{ redirectTo }} className="text-ink underline decoration-dotted hover:text-tag">
          Entrar
        </Link>
      </p>
    </div>
  );
}
