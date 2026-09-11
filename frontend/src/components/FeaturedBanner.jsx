import { useState } from 'react';
import { Link } from 'react-router-dom';
import Tag from './Tag';
import Button from './Button';
import { formatPrice } from '../lib/format';
import { focalPointToCss } from '../lib/imageFocal';

// Puxa a foto de um produto real marcado como "Banner principal" — some se nenhum estiver marcado.
export default function FeaturedBanner({ product }) {
  const [hovering, setHovering] = useState(false);
  if (!product) return null;

  const images = product.images || [];
  // Hover troca pra segunda foto, se existir.
  const activeImage = hovering && images[1] ? images[1] : images[0];
  const objectPosition = focalPointToCss(product.imageFocalPoint);

  return (
    <section className="relative overflow-hidden rounded-lg border-2 border-ink bg-canvas">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-4">
        <div className="order-2 lg:order-1">
          <Tag variant="lime">peça em destaque</Tag>
          <h1 className="font-display mt-4 text-[13vw] leading-[0.85] tracking-tight sm:text-6xl md:text-7xl lg:text-6xl xl:text-7xl">
            {product.name}
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-soft">{product.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="font-mono text-2xl">{formatPrice(product.basePrice)}</span>
            <Button as={Link} to={`/produtos/${product.slug}`} variant="tag" size="lg">
              Ver peça →
            </Button>
          </div>
        </div>

        <Link
          to={`/produtos/${product.slug}`}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className="group order-1 block overflow-hidden border-2 border-ink bg-canvas-alt lg:order-2"
        >
          {activeImage ? (
            <img
              key={activeImage.id}
              src={activeImage.url}
              alt={product.name}
              style={{ objectPosition }}
              className="h-[420px] w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-[520px]"
            />
          ) : (
            <div className="flex h-[420px] items-center justify-center font-mono text-xs uppercase text-ink-soft sm:h-[520px]">
              sem foto cadastrada
            </div>
          )}
        </Link>
      </div>
    </section>
  );
}
