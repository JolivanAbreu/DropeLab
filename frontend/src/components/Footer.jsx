import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';

function SocialIcon({ children, href }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-lg text-white transition-transform hover:-translate-y-0.5">
      {children}
    </a>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      await api.post('/newsletter/subscribe', { email }, { auth: false });
      setStatus('done');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof ApiError ? err.message : 'Não foi possível inscrever. Tente de novo.');
    }
  }

  if (status === 'done') {
    return <p className="mt-3.5 text-xs font-bold text-tag">Inscrito! Fica de olho no seu e-mail ✓</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3.5 flex flex-col gap-2.5">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Seu e-mail"
        className="rounded border border-[#444444] bg-[#2a2a2a] px-3.5 py-2.5 text-xs text-white placeholder:text-white/40 outline-none focus:border-tag"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="rounded bg-white py-2.5 text-[11px] font-black uppercase tracking-wide text-[#111111] hover:bg-white/90 disabled:opacity-60"
      >
        {status === 'loading' ? 'Enviando...' : 'Inscrever'}
      </button>
      {status === 'error' && <p className="text-[11px] text-danger">{errorMsg}</p>}
    </form>
  );
}

export default function Footer() {
  return (
    <footer className="mt-10 rounded-t-xl bg-[#1c1c1c] px-5 pb-5 pt-10 text-white sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 pb-8 sm:grid-cols-4">
        <div>
          <h3 className="text-[13px] font-black uppercase tracking-wide">Minha Conta</h3>
          <ul className="mt-3.5 flex flex-col gap-2">
            <li><Link to="/minha-conta/pedidos" className="text-xs text-[#aaaaaa] hover:text-white">Meus Pedidos</Link></li>
            <li><Link to="/minha-conta" className="text-xs text-[#aaaaaa] hover:text-white">Meu Perfil</Link></li>
            <li><Link to="/minha-conta/favoritos" className="text-xs text-[#aaaaaa] hover:text-white">Meus Favoritos</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-[13px] font-black uppercase tracking-wide">Loja</h3>
          <ul className="mt-3.5 flex flex-col gap-2">
            <li><Link to="/produtos" className="text-xs text-[#aaaaaa] hover:text-white">Vestuário</Link></li>
            <li><Link to="/produtos" className="text-xs text-[#aaaaaa] hover:text-white">Acessórios</Link></li>
            <li><Link to="/carrinho" className="text-xs text-[#aaaaaa] hover:text-white">Minha Sacola</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-[13px] font-black uppercase tracking-wide">Ajuda e suporte</h3>
          <ul className="mt-3.5 flex flex-col gap-2">
            <li><Link to="/guia-de-medidas" className="text-xs text-[#aaaaaa] hover:text-white">Guia de Medidas</Link></li>
            <li className="text-xs text-[#aaaaaa]">Trocas e devoluções</li>
            <li className="text-xs text-[#aaaaaa]">Prazos de entrega</li>
          </ul>
        </div>
        <div>
          <h3 className="text-[13px] font-black uppercase tracking-wide">Newsletter</h3>
          <NewsletterForm />
          <div className="mt-3.5 flex gap-4">
            <SocialIcon href="https://www.instagram.com/_dravennx">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
            </SocialIcon>
            <SocialIcon href="https://tiktok.com">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" /></svg>
            </SocialIcon>
            <SocialIcon href="https://wa.me">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.9 11.9L4 20l4.2-1.1a7.9 7.9 0 0 0 3.8 1h.01a7.94 7.94 0 0 0 5.6-13.58zm-5.55 12.2h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.44-.16-.25a6.6 6.6 0 0 1 10.4-8.1 6.55 6.55 0 0 1 1.94 4.66 6.6 6.6 0 0 1-6.74 6.54zm3.62-4.94c-.2-.1-1.17-.58-1.35-.64-.18-.07-.32-.1-.45.1-.13.19-.51.64-.63.78-.12.13-.23.15-.43.05-.2-.1-.83-.31-1.58-.98a5.9 5.9 0 0 1-1.09-1.36c-.11-.2-.01-.3.09-.4.09-.09.2-.23.3-.35.1-.11.13-.19.2-.32.06-.13.03-.24-.02-.34-.05-.1-.45-1.08-.62-1.48-.16-.39-.33-.33-.45-.34h-.39c-.13 0-.34.05-.52.24-.18.19-.68.66-.68 1.62 0 .95.7 1.87.79 2 .1.13 1.38 2.1 3.34 2.95.47.2.83.32 1.12.41.47.15.9.13 1.24.08.38-.06 1.17-.48 1.33-.94.17-.46.17-.85.12-.94-.05-.09-.18-.14-.38-.24z" /></svg>
            </SocialIcon>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl border-t border-white/10 pt-5 text-center text-[11px] text-[#777777]">
        © {new Date().getFullYear()} DRAVENNX® — Todos os direitos reservados.
      </div>
    </footer>
  );
}
