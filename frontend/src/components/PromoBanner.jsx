import { useEffect, useState } from 'react';
import { ShoppingBag, Shirt } from 'lucide-react';
import { api } from '../api/client';
import { focalPointToCss } from '../lib/imageFocal';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1600&q=80';

// Backend devolve uma copy padrão enquanto o admin não configurar nada.
export default function PromoBanner() {
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    api.get('/promo-banner', { auth: false }).then(setBanner).catch(() => setBanner(null));
  }, []);

  if (!banner) return null;

  const { eyebrow, title, subtitle, description, imageUrl, imageFocalPoint } = banner;

  return (
    <section
      className="relative overflow-hidden rounded-lg bg-cover"
      style={{ backgroundImage: `url(${imageUrl || FALLBACK_IMAGE})`, backgroundPosition: focalPointToCss(imageFocalPoint) }}
    >
      <div className="flex flex-col gap-5 bg-[rgba(18,20,24,0.75)] px-6 py-9 text-white sm:px-8 sm:py-11">
        <div className="max-w-xl">
          {eyebrow && <p className="text-2xl font-black uppercase leading-none tracking-wide sm:text-3xl">{eyebrow}</p>}
          {title && (
            <p className="font-display mt-1 text-5xl font-black uppercase leading-[0.9] tracking-tight text-[#f7eedd] sm:text-7xl">
              {title}
            </p>
          )}
          {subtitle && <p className="mt-2 text-lg font-black uppercase tracking-wide sm:text-2xl">{subtitle}</p>}
        </div>

        {description && (
          <div className="flex flex-wrap items-center gap-3">
            {[ShoppingBag, Shirt, Shirt, Shirt].map((Icon, i) => (
              <div key={i} className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-ink shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
                <Icon size={22} strokeWidth={2} />
              </div>
            ))}
            <p className="max-w-[220px] font-mono text-[11px] leading-tight text-white/85">{description}</p>
          </div>
        )}
      </div>
    </section>
  );
}
