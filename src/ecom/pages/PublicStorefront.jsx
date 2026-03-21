import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, MessageCircle, ArrowRight, ShoppingBag } from 'lucide-react';
import { useSubdomain } from '../hooks/useSubdomain';
import { useStoreData } from '../hooks/useStoreData';
import { useStoreCart } from '../hooks/useStoreCart';

const fmt = (n, cur = 'XAF') =>
  `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

// ── Header ───────────────────────────────────────────────────────────────────
const StorefrontHeader = ({ store, cartCount, prefix }) => (
  <header style={{
    position: 'sticky', top: 0, zIndex: 50,
    backgroundColor: 'var(--s-bg)',
    borderBottom: '1px solid var(--s-border)',
    fontFamily: 'var(--s-font)',
  }}>
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '0 24px',
      height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <a href={`${prefix}/`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        {store?.logo ? (
          <img src={store.logo} alt={store?.name} style={{ height: 36, width: 'auto', maxWidth: 120, objectFit: 'contain' }} />
        ) : (
          <span style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: 'var(--s-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, flexShrink: 0,
          }}>
            {(store?.name || 'S')[0].toUpperCase()}
          </span>
        )}
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--s-text)', letterSpacing: '-0.01em' }}>
          {store?.name}
        </span>
      </a>
      <a href={`${prefix}/checkout`} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 18px', borderRadius: 40,
        border: '1.5px solid',
        borderColor: cartCount > 0 ? 'var(--s-primary)' : 'var(--s-border)',
        backgroundColor: cartCount > 0 ? 'var(--s-primary)' : 'transparent',
        color: cartCount > 0 ? '#fff' : 'var(--s-text)',
        textDecoration: 'none', fontWeight: 600, fontSize: 14,
        transition: 'all 0.2s', fontFamily: 'var(--s-font)',
      }}>
        <ShoppingCart size={17} />
        {cartCount > 0 && <span>{cartCount}</span>}
      </a>
    </div>
  </header>
);

// ── Product Card ─────────────────────────────────────────────────────────────
const ProductCard = ({ product, prefix }) => {
  const [hovered, setHovered] = useState(false);
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const pct = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;

  return (
    <a
      href={`${prefix}/product/${product.slug}`}
      style={{ textDecoration: 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        backgroundColor: 'var(--s-bg)', borderRadius: 16, overflow: 'hidden',
        border: '1px solid var(--s-border)',
        boxShadow: hovered ? '0 12px 36px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        transition: 'box-shadow 0.25s, transform 0.25s',
      }}>
        <div style={{ position: 'relative', paddingBottom: '100%', backgroundColor: '#f4f4f5', overflow: 'hidden' }}>
          {product.image ? (
            <img
              src={product.image} alt={product.name} loading="lazy"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                transform: hovered ? 'scale(1.05)' : 'scale(1)', transition: 'transform 0.4s ease',
              }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={40} style={{ color: '#d1d5db' }} />
            </div>
          )}
          {hasDiscount && (
            <span style={{
              position: 'absolute', top: 10, left: 10,
              backgroundColor: '#EF4444', color: '#fff',
              fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
            }}>
              -{pct}%
            </span>
          )}
          {product.stock === 0 && (
            <div style={{
              position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: 20 }}>
                Rupture de stock
              </span>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 16px 18px' }}>
          {product.category && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--s-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {product.category}
            </span>
          )}
          <p style={{
            margin: '5px 0 10px', fontWeight: 600, fontSize: 14.5, color: 'var(--s-text)',
            lineHeight: 1.35, fontFamily: 'var(--s-font)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {product.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--s-primary)', fontFamily: 'var(--s-font)' }}>
              {fmt(product.price, product.currency)}
            </span>
            {hasDiscount && (
              <span style={{ fontSize: 12, color: 'var(--s-text2)', textDecoration: 'line-through' }}>
                {fmt(product.compareAtPrice, product.currency)}
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
};

// ── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ h = 16, w = '100%', r = 8, mb = 0 }) => (
  <div style={{
    height: h, width: w, borderRadius: r, marginBottom: mb,
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
  }} />
);

const ProductSkeleton = () => (
  <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
    <div style={{ paddingBottom: '100%', position: 'relative', backgroundColor: '#f4f4f5' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
      }} />
    </div>
    <div style={{ padding: 16 }}>
      <Skeleton h={10} w="50%" r={6} mb={8} />
      <Skeleton h={14} r={6} mb={6} />
      <Skeleton h={14} w="75%" r={6} mb={12} />
      <Skeleton h={18} w="55%" r={6} />
    </div>
  </div>
);

// ── Footer ───────────────────────────────────────────────────────────────────
const StorefrontFooter = ({ store }) => (
  <footer style={{
    borderTop: '1px solid var(--s-border)', marginTop: 80,
    padding: '48px 24px', fontFamily: 'var(--s-font)',
  }}>
    <div style={{
      maxWidth: 1200, margin: '0 auto',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center',
      justifyContent: 'space-between', gap: 24,
    }}>
      <div>
        <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--s-text)', margin: '0 0 4px' }}>
          {store?.name}
        </p>
        {store?.description && (
          <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
            {store.description}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {store?.whatsapp && (
          <a
            href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`}
            target="_blank" rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 40,
              backgroundColor: '#25D366', color: '#fff',
              textDecoration: 'none', fontWeight: 600, fontSize: 13,
            }}
          >
            <MessageCircle size={15} /> Commander via WhatsApp
          </a>
        )}
        <span style={{ fontSize: 12, color: 'var(--s-text2)' }}>
          Propulsé par{' '}
          <a href="https://scalor.net" target="_blank" rel="noreferrer"
            style={{ color: 'var(--s-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Scalor
          </a>
        </span>
      </div>
    </div>
  </footer>
);

// ── Main ─────────────────────────────────────────────────────────────────────
const PublicStorefront = () => {
  const { subdomain: paramSubdomain } = useParams();
  const { subdomain: detectedSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = paramSubdomain || detectedSubdomain;
  const prefix = isStoreDomain ? '' : (subdomain ? `/store/${subdomain}` : '');

  const { store, products, loading, error } = useStoreData(subdomain);
  const { cartCount } = useStoreCart(subdomain);
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const filtered = activeCategory === 'all' ? products : products.filter(p => p.category === activeCategory);

  useEffect(() => {
    if (store?.name) document.title = store.name;
  }, [store?.name]);

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 48, margin: '0 0 16px' }}>🛍️</p>
        <h2 style={{ color: '#111', fontWeight: 700, margin: '0 0 8px' }}>Boutique introuvable</h2>
        <p style={{ color: '#6B7280', fontSize: 15 }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--s-bg)', fontFamily: 'var(--s-font)', color: 'var(--s-text)' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        *{box-sizing:border-box} body{margin:0;padding:0}
        a:hover{opacity:0.85}
      `}</style>

      <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(56px, 10vw, 100px) 24px clamp(48px, 8vw, 80px)', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {loading ? (
            <div>
              <Skeleton h={52} r={12} mb={16} />
              <Skeleton h={20} w="80%" r={8} mb={8} style={{ margin: '0 auto 8px' }} />
              <Skeleton h={20} w="60%" r={8} mb={36} />
              <Skeleton h={48} w={200} r={28} />
            </div>
          ) : (
            <>
              <h1 style={{
                fontSize: 'clamp(36px, 7vw, 60px)', fontWeight: 900,
                lineHeight: 1.08, color: 'var(--s-text)', margin: '0 0 18px',
                letterSpacing: '-0.03em', fontFamily: 'var(--s-font)',
              }}>
                {store?.name}
              </h1>
              {store?.description && (
                <p style={{
                  fontSize: 'clamp(15px, 2vw, 18px)', color: 'var(--s-text2)',
                  lineHeight: 1.65, margin: '0 0 40px', fontFamily: 'var(--s-font)',
                }}>
                  {store.description}
                </p>
              )}
              <a href="#products" style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                padding: '15px 34px', borderRadius: 40,
                backgroundColor: 'var(--s-primary)', color: '#fff',
                fontWeight: 700, fontSize: 15, textDecoration: 'none',
                letterSpacing: '-0.01em', fontFamily: 'var(--s-font)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.16)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)'; }}
              >
                Découvrir nos produits <ArrowRight size={17} />
              </a>
            </>
          )}
        </div>
      </section>

      {/* Subtle divider line */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <hr style={{ border: 'none', borderTop: '1px solid var(--s-border)', margin: 0 }} />
      </div>

      {/* ── Products ──────────────────────────────────────────────────────── */}
      <section id="products" style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px 80px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 32, flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <h2 style={{
              fontSize: 'clamp(22px, 3.5vw, 30px)', fontWeight: 800,
              color: 'var(--s-text)', margin: 0, letterSpacing: '-0.02em',
              fontFamily: 'var(--s-font)',
            }}>
              Nos Produits
            </h2>
            {!loading && (
              <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: '4px 0 0' }}>
                {filtered.length} article{filtered.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {categories.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['all', ...categories].map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                  padding: '7px 17px', borderRadius: 40,
                  border: '1.5px solid',
                  borderColor: activeCategory === cat ? 'var(--s-primary)' : 'var(--s-border)',
                  backgroundColor: activeCategory === cat ? 'var(--s-primary)' : 'transparent',
                  color: activeCategory === cat ? '#fff' : 'var(--s-text)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--s-font)', transition: 'all 0.15s',
                }}>
                  {cat === 'all' ? 'Tout' : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 20,
        }}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
            : filtered.map(p => <ProductCard key={p._id} product={p} prefix={prefix} />)
          }
        </div>

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '72px 20px' }}>
            <p style={{ fontSize: 40, margin: '0 0 14px' }}>🛍️</p>
            <p style={{ color: 'var(--s-text2)', fontSize: 16 }}>
              Aucun produit disponible pour l'instant.
            </p>
          </div>
        )}
      </section>

      <StorefrontFooter store={store} />
    </div>
  );
};

export default PublicStorefront;
