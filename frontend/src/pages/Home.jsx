import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import FeaturedBanner from '../components/FeaturedBanner';
import PromoBanner from '../components/PromoBanner';
import InstagramSection from '../components/InstagramSection';
import { LoadingBlock } from '../components/States';
import { api } from '../api/client';

export default function Home() {
  const [products, setProducts] = useState(null);
  const [bannerProduct, setBannerProduct] = useState(null);
  const [destaqueProducts, setDestaqueProducts] = useState([]);

  useEffect(() => {
    api.get('/products?sort=newest', { auth: false })
      .then((data) => setProducts(data.data))
      .catch(() => setProducts([]));

    api.get('/products/featured?slot=banner', { auth: false })
      .then((data) => setBannerProduct(data[0] || null))
      .catch(() => setBannerProduct(null));

    api.get('/products/featured?slot=destaque', { auth: false })
      .then(setDestaqueProducts)
      .catch(() => setDestaqueProducts([]));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-2.5 py-4 sm:px-4">
      <PromoBanner />

      {bannerProduct && (
        <div className="mt-6">
          <FeaturedBanner product={bannerProduct} />
        </div>
      )}

      {destaqueProducts.length > 0 && (
        <section className="mt-8">
          <h2 className="border-b-2 border-ink pb-2.5 text-[15px] font-black uppercase text-[#111111]">⭐ Destaques</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {destaqueProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 text-center">
        <p className="mb-4 text-xs font-black text-[#222222]">
          Tá com dúvida nas nossas modelagens?{' '}
          <Link to="/guia-de-medidas" className="underline decoration-dotted hover:text-tag-dark">
            clique aqui e saiba mais
          </Link>
        </p>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-ink">Modelagem</p>
      </section>

      <section className="mt-3">
        <h2 className="border-b-2 border-ink pb-2.5 text-[15px] font-black uppercase text-[#111111]">Novidades</h2>
        {products === null && <div className="py-10"><LoadingBlock label="Carregando peças" /></div>}
        {products && products.length === 0 && (
          <p className="py-10 text-center font-mono text-sm text-ink-soft">Nenhum produto publicado ainda.</p>
        )}
        {products && products.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 pb-8 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <InstagramSection />
    </div>
  );
}
