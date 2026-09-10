// Ícones simples em SVG (sem dependência externa), traço fino consistente
// com a estética mono/brutalista da marca — usados no cabeçalho no lugar
// de texto, como em navbars de e-commerce convencionais.

export function UserIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-4 4.2-6 7.5-6s6.1 2 7.5 6" />
    </svg>
  );
}

export function HeartIcon({ className = 'h-5 w-5', filled = false }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 20.2c-.3 0-.6-.1-.8-.3C6.9 16.4 3 13 3 9.1 3 6.3 5.2 4 8 4c1.6 0 3 .8 4 2 1-1.2 2.4-2 4-2 2.8 0 5 2.3 5 5.1 0 3.9-3.9 7.3-8.2 10.8-.2.2-.5.3-.8.3Z" />
    </svg>
  );
}

export function StarIcon({ className = 'h-5 w-5', filled = false }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.9 6.4 20.1l1.4-6.3-4.8-4.3 6.4-.6L12 3Z" strokeLinejoin="round" />
    </svg>
  );
}

export function BagIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 8h12l-1 12.5a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9L6 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

export function SearchIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function BoxIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3.5 8 12 3.5 20.5 8 12 12.5 3.5 8Z" />
      <path d="M3.5 8v8L12 20.5 20.5 16V8" />
      <path d="M12 12.5V20.5" />
    </svg>
  );
}

export function ShirtIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M8 4 4 6.5 6 10l2-1.2V20h8V8.8L18 10l2-3.5L16 4c-.5 1.2-2 2-4 2s-3.5-.8-4-2Z" strokeLinejoin="round" />
    </svg>
  );
}

export function AccessoryIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3 4 9l8 12 8-12-8-6Z" strokeLinejoin="round" />
      <path d="M8.5 9h7M9.5 9 12 3l2.5 6M9.5 9 12 21M14.5 9 12 21" strokeLinejoin="round" />
    </svg>
  );
}

export function LogoutIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M9 4H5.5a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 5.5 20H9" strokeLinecap="round" />
      <path d="M16 16.5 20.5 12 16 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.5 12H10" strokeLinecap="round" />
    </svg>
  );
}
