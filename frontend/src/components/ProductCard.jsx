import { useState } from 'react';
import { Link } from 'react-router-dom';
import ProductMedia from './ProductMedia';
import { StarDisplay } from './StarRating';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuthModal } from '../context/AuthModalContext';
import { formatPrice } from '../lib/format';
import { focalPointToCss } from '../lib/imageFocal';

// Card de produto — imagem 3:4 com slider, selo do admin, botão "Adicionar" sempre visível.
export default function ProductCard({ product }) {
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const { isFavorite, toggle } = useWishlist();
  const { openLoginModal } = useAuthModal();

  const [activeImg, setActiveImg] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const images = product.images || [];
  const firstVariant = product.variants?.[0];
  const buyableVariant = product.variants?.find((v) => v.stockQuantity > 0);
  const outOfStock = !buyableVariant;
  const favorite = isFavorite(product.id);

  function showImage(index, e) {
    e.preventDefault();
    e.stopPropagation();
    if (images.length === 0) return;
    setActiveImg((index + images.length) % images.length);
  }

  function handleFavoriteClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    toggle(product.id);
  }

  async function handleAddClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    if (!buyableVariant || adding) return;
    setAdding(true);
    try {
      await addItem(buyableVariant.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Link to={`/produtos/${product.slug}`} className="group block overflow-hidden rounded bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-canvas">
        {images.length > 0 ? (
          images.map((img, i) => (
            <img
              key={img.id || i}
              src={img.url}
              alt={`${product.name} — foto ${i + 1}`}
              style={{ objectPosition: focalPointToCss(product.imageFocalPoint) }}
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${i === activeImg ? 'opacity-100' : 'opacity-0'}`}
            />
          ))
        ) : (
          <ProductMedia product={product} color={firstVariant?.color} className="h-full w-full" />
        )}

        {product.badgeLabel && (
          <div className="absolute left-2.5 top-2.5 z-10 bg-black px-1.5 py-1 text-xs font-black uppercase text-white">
            {product.badgeLabel}
          </div>
        )}

        {images.length > 1 && (
          <>
            <div className={`absolute left-2.5 z-10 flex flex-col gap-1.5 ${product.badgeLabel ? 'top-[42px]' : 'top-2.5'}`}>
              {images.map((img, i) => (
                <button
                  key={img.id || i}
                  onClick={(e) => showImage(i, e)}
                  aria-label={`Ver foto ${i + 1}`}
                  className={`h-3.5 w-3.5 rounded-full border-[1.5px] border-ink transition-colors ${i === activeImg ? 'bg-ink' : 'bg-white'}`}
                />
              ))}
            </div>
            <button
              onClick={(e) => showImage(activeImg - 1, e)}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 z-10 flex h-[38px] w-[26px] -translate-y-1/2 items-center justify-center rounded border border-black/20 bg-white/45 text-xs text-ink opacity-0 transition-opacity group-hover:opacity-80"
            >
              ‹
            </button>
            <button
              onClick={(e) => showImage(activeImg + 1, e)}
              aria-label="Próxima foto"
              className="absolute right-2 top-1/2 z-10 flex h-[38px] w-[26px] -translate-y-1/2 items-center justify-center rounded border border-black/20 bg-white/45 text-xs text-ink opacity-0 transition-opacity group-hover:opacity-80"
            >
              ›
            </button>
          </>
        )}

        {outOfStock && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-ink/85 py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-white">
            Esgotado
          </div>
        )}
      </div>

      <div className="px-2.5 pb-3.5 pt-2.5">
        <div className="mb-1.5 flex items-start justify-between gap-1.5">
          <h2 className="text-[11px] font-black uppercase leading-tight text-ink">{product.name}</h2>
          <button onClick={handleFavoriteClick} aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} className="shrink-0 text-sm leading-none">
            <span className={favorite ? 'text-danger' : 'text-[#222222]'}>{favorite ? '★' : '☆'}</span>
          </button>
        </div>

        {product.reviewCount > 0 && (
          <div className="mb-1 flex items-center gap-1.5">
            <StarDisplay value={product.avgRating} />
            <span className="font-mono text-[10px] text-ink-soft">({product.reviewCount})</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[13px] font-black text-black">{formatPrice(product.basePrice)}</span>
        </div>

        <button
          onClick={handleAddClick}
          disabled={adding || outOfStock}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded bg-ink py-2.5 font-mono text-[10px] font-black uppercase tracking-wide text-white transition-colors hover:bg-tag hover:text-ink disabled:cursor-default disabled:bg-canvas disabled:text-ink-soft"
        >
          {added ? 'adicionado ✓' : adding ? 'adicionando...' : outOfStock ? 'indisponível' : 'adicionar'}
        </button>
      </div>
    </Link>
  );
}
