import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

function InstagramIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// Prioriza posts curados pelo admin; sem nenhum, cai pras fotos recentes do catálogo.
export default function InstagramSection() {
  const [items, setItems] = useState(null); // null = carregando

  useEffect(() => {
    api.get('/instagram-posts', { auth: false })
      .then((posts) => {
        if (posts.length > 0) {
          setItems(posts.map((p) => ({ key: p.id, href: p.postUrl, external: true, url: p.imageUrl, label: p.caption || 'Ver post' })));
          return;
        }
        api.get('/products?sort=newest', { auth: false })
          .then((data) => {
            const withPhotos = (data.data || [])
              .filter((p) => p.images?.[0]?.url)
              .slice(0, 6)
              .map((p) => ({ key: p.slug, href: `/produtos/${p.slug}`, external: false, url: p.images[0].url, label: p.name }));
            setItems(withPhotos);
          })
          .catch(() => setItems([]));
      })
      .catch(() => setItems([]));
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="my-6 rounded-lg bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] text-white">
            <InstagramIcon size={22} />
          </div>
          <div>
            <h3 className="text-[15px] font-black uppercase text-[#111111]">@_dravennx</h3>
            <p className="text-[11px] text-ink-soft">Siga a gente e marque #DRAVENNX pra aparecer na vitrine</p>
          </div>
        </div>
        <a
          href="https://www.instagram.com/_dravennx"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-2.5 text-[11px] font-black uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
        >
          <InstagramIcon size={14} /> Seguir no Instagram
        </a>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {items.map((item) => {
          const content = (
            <>
              <img src={item.url} alt={item.label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-108" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 p-2 text-center opacity-0 backdrop-blur-0 transition-all duration-200 group-hover:bg-black/55 group-hover:opacity-100 group-hover:backdrop-blur-[1px]">
                <span className="text-[10px] font-bold uppercase text-white">{item.label}</span>
              </div>
            </>
          );
          const className = 'group relative block aspect-square overflow-hidden rounded-md bg-canvas';
          return item.external ? (
            <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>
          ) : (
            <Link key={item.key} to={item.href} className={className}>{content}</Link>
          );
        })}
      </div>
    </section>
  );
}
