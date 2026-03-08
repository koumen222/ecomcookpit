import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, ShoppingCart, MessageCircle,
  ShoppingBag, Shield, RotateCcw, Truck, Check, Minus, Plus,
  ChevronDown, ChevronUp, ArrowLeft, Star,
} from 'lucide-react';
import { useSubdomain } from '../hooks/useSubdomain';
import { useStoreProduct } from '../hooks/useStoreData';
import { useStoreCart } from '../hooks/useStoreCart';
import QuickOrderModal from '../components/QuickOrderModal';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

// ── Shared Header ────────────────────────────────────────────────────────────
const StorefrontHeader = ({ store, cartCount, prefix }) => (
  <header style={{
    position: 'sticky', top: 0, zIndex: 50,
    backgroundColor: 'var(--s-bg)', borderBottom: '1px solid var(--s-border)',
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
            width: 36, height: 36, borderRadius: 10, backgroundColor: 'var(--s-primary)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
        padding: '8px 18px', borderRadius: 40, border: '1.5px solid',
        borderColor: cartCount > 0 ? 'var(--s-primary)' : 'var(--s-border)',
        backgroundColor: cartCount > 0 ? 'var(--s-primary)' : 'transparent',
        color: cartCount > 0 ? '#fff' : 'var(--s-text)',
        textDecoration: 'none', fontWeight: 600, fontSize: 14, fontFamily: 'var(--s-font)',
      }}>
        <ShoppingCart size={17} />
        {cartCount > 0 && <span>{cartCount}</span>}
      </a>
    </div>
  </header>
);

// ── Image Gallery ────────────────────────────────────────────────────────────
const ImageGallery = ({ images = [] }) => {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const go = (dir) => setActive(i => Math.max(0, Math.min(images.length - 1, i + dir)));

  // Touch swipe support
  const touchStart = useRef(null);
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
    touchStart.current = null;
  };

  if (!images.length) return (
    <div style={{
      paddingBottom: '100%', position: 'relative', borderRadius: 20,
      backgroundColor: '#f4f4f5', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ShoppingBag size={64} style={{ color: '#d1d5db' }} />
      </div>
    </div>
  );

  return (
    <div>
      {/* Main image */}
      <div
        style={{
          position: 'relative', paddingBottom: '100%', borderRadius: 20,
          backgroundColor: '#f4f4f5', overflow: 'hidden', cursor: 'zoom-in',
        }}
        onClick={() => setZoomed(true)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={images[active]?.url || images[active]}
          alt={images[active]?.alt || ''}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', transition: 'opacity 0.2s',
          }}
        />
        {/* Arrows */}
        {images.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); go(-1); }} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              backgroundColor: 'rgba(255,255,255,0.9)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)', opacity: active === 0 ? 0.3 : 1,
            }}>
              <ChevronLeft size={18} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); go(1); }} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              backgroundColor: 'rgba(255,255,255,0.9)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)', opacity: active === images.length - 1 ? 0.3 : 1,
            }}>
              <ChevronRight size={18} />
            </button>
          </>
        )}
        {/* Dots */}
        {images.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6,
          }}>
            {images.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setActive(i); }} style={{
                width: i === active ? 20 : 7, height: 7, borderRadius: 4,
                border: 'none', backgroundColor: i === active ? 'var(--s-primary)' : 'rgba(255,255,255,0.7)',
                cursor: 'pointer', padding: 0, transition: 'width 0.2s, background 0.2s',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {images.map((img, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              flexShrink: 0, width: 68, height: 68, borderRadius: 12, overflow: 'hidden', padding: 0,
              border: '2.5px solid',
              borderColor: i === active ? 'var(--s-primary)' : 'transparent',
              cursor: 'pointer', transition: 'border-color 0.15s',
              backgroundColor: '#f4f4f5',
            }}>
              <img
                src={img?.url || img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom modal */}
      {zoomed && (
        <div
          onClick={() => setZoomed(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={images[active]?.url || images[active]}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }}
          />
          <button onClick={() => setZoomed(false)} style={{
            position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)',
            border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer',
            width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
      )}
    </div>
  );
};

// ── Product Reviews (Stars) ─────────────────────────────────────────────────
const ProductReviews = ({ rating = 4.5, reviewCount = 128 }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={16}
            fill={i < fullStars ? '#F59E0B' : (i === fullStars && hasHalfStar ? 'url(#halfStar)' : 'transparent')}
            color={i < fullStars || (i === fullStars && hasHalfStar) ? '#F59E0B' : '#D1D5DB'}
            style={{
              clipPath: i === fullStars && hasHalfStar ? 'inset(0 50% 0 0)' : undefined,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--s-text)' }}>
        {rating.toFixed(1)}
      </span>
      <span style={{ fontSize: 13, color: 'var(--s-text2)' }}>
        ({reviewCount} avis)
      </span>
    </div>
  );
};

// ── Description (handles both HTML and markdown) ─────────────────────────────
const ProductDescription = ({ content }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Nettoyer le contenu : enlever les espaces et balises vides
  const cleanContent = content?.toString().trim() || '';
  const hasContent = cleanContent.length > 0 && !/^\s*<[^>]*>\s*<\/[^>]*>\s*$/.test(cleanContent);
  
  if (!hasContent) return null;
  
  const isHTML = /<[^>]+>/.test(cleanContent);
  const isLong = cleanContent.length > 400 || (isHTML && cleanContent.replace(/<[^>]*>/g, '').length > 300);

  const bodyStyle = {
    fontSize: 15, lineHeight: 1.75, color: 'var(--s-text2)',
    fontFamily: 'var(--s-font)',
    overflow: 'hidden',
    maxHeight: !expanded && isLong ? 120 : 'none',
    position: 'relative',
  };

  return (
    <div>
      {isHTML ? (
        <div style={bodyStyle} dangerouslySetInnerHTML={{ __html: cleanContent }} />
      ) : (
        <p style={{ ...bodyStyle, whiteSpace: 'pre-wrap', margin: 0 }}>{cleanContent}</p>
      )}
      {isLong && (
        <button onClick={() => setExpanded(e => !e)} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          color: 'var(--s-primary)', fontWeight: 600, fontSize: 14,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '8px 0', fontFamily: 'var(--s-font)',
        }}>
          {expanded ? (<><ChevronUp size={15} /> Voir moins</>) : (<><ChevronDown size={15} /> Voir plus</>)}
        </button>
      )}
    </div>
  );
};

// ── Trust Badges ─────────────────────────────────────────────────────────────
const TrustBadges = () => (
  <div style={{
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
    marginTop: 24, padding: '20px 0', borderTop: '1px solid var(--s-border)',
  }}>
    {[
      { icon: <Truck size={18} />, text: 'Livraison rapide' },
      { icon: <Shield size={18} />, text: 'Paiement sécurisé' },
      { icon: <RotateCcw size={18} />, text: 'Retours acceptés' },
    ].map(({ icon, text }) => (
      <div key={text} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        textAlign: 'center',
      }}>
        <span style={{ color: 'var(--s-primary)' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}>
          {text}
        </span>
      </div>
    ))}
  </div>
);

// ── Related Products ─────────────────────────────────────────────────────────
const RelatedCard = ({ product, prefix }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <a href={`${prefix}/product/${product.slug}`} style={{ textDecoration: 'none' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{
        borderRadius: 14, overflow: 'hidden', border: '1px solid var(--s-border)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'none', transition: 'all 0.2s',
      }}>
        <div style={{ paddingBottom: '100%', position: 'relative', backgroundColor: '#f4f4f5', overflow: 'hidden' }}>
          {product.image ? (
            <img src={product.image} alt={product.name} loading="lazy"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                transform: hovered ? 'scale(1.04)' : 'scale(1)', transition: 'transform 0.3s' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={32} style={{ color: '#d1d5db' }} />
            </div>
          )}
        </div>
        <div style={{ padding: '12px 14px' }}>
          <p style={{
            margin: '0 0 6px', fontWeight: 600, fontSize: 13.5, color: 'var(--s-text)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            lineHeight: 1.35, fontFamily: 'var(--s-font)',
          }}>
            {product.name}
          </p>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-primary)', fontFamily: 'var(--s-font)' }}>
            {fmt(product.price, product.currency)}
          </span>
        </div>
      </div>
    </a>
  );
};

// ── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ h = 16, w = '100%', r = 8, mb = 0 }) => (
  <div style={{
    height: h, width: w, borderRadius: r, marginBottom: mb,
    background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
  }} />
);

// ── Footer ───────────────────────────────────────────────────────────────────
const StorefrontFooter = ({ store }) => (
  <footer style={{ borderTop: '1px solid var(--s-border)', marginTop: 80, padding: '40px 24px', fontFamily: 'var(--s-font)' }}>
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
      <div>
        <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--s-text)', margin: '0 0 4px' }}>{store?.name}</p>
        {store?.description && <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: 0, maxWidth: 320 }}>{store.description}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {store?.whatsapp && (
          <a href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 40, backgroundColor: '#25D366', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            <MessageCircle size={15} /> Commander via WhatsApp
          </a>
        )}
        <span style={{ fontSize: 12, color: 'var(--s-text2)' }}>
          Propulsé par <a href="https://scalor.net" target="_blank" rel="noreferrer" style={{ color: 'var(--s-primary)', fontWeight: 600, textDecoration: 'none' }}>Scalor</a>
        </span>
      </div>
    </div>
  </footer>
);

// ── Main ─────────────────────────────────────────────────────────────────────
const StoreProductPage = () => {
  const { subdomain: paramSubdomain, slug } = useParams();
  const { subdomain: detectedSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = paramSubdomain || detectedSubdomain;
  const prefix = isStoreDomain ? '' : (subdomain ? `/store/${subdomain}` : '');

  const { store, product, related, loading, error } = useStoreProduct(subdomain, slug);
  const { cartCount, addToCart } = useStoreCart(subdomain);

  const [qty, setQty] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => {
    if (product?.name) document.title = `${product.name} — ${store?.name || ''}`;
  }, [product?.name, store?.name]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({ ...product, image: product.images?.[0]?.url || '' }, qty);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2400);
  };

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 48, margin: '0 0 16px' }}>😕</p>
        <h2 style={{ color: '#111', fontWeight: 700, margin: '0 0 8px' }}>Produit introuvable</h2>
        <p style={{ color: '#6B7280', fontSize: 15 }}>{error}</p>
        <a href={`${prefix}/`} style={{ marginTop: 20, display: 'inline-block', color: 'var(--s-primary)', fontWeight: 600, fontSize: 14 }}>← Retour à la boutique</a>
      </div>
    </div>
  );

  const images = product?.images?.length ? product.images : [];
  const hasDiscount = product?.compareAtPrice && product.compareAtPrice > product.price;
  const pct = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const inStock = !product || product.stock > 0;
  const lowStock = product && product.stock > 0 && product.stock <= 5;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--s-bg)', fontFamily: 'var(--s-font)', color: 'var(--s-text)' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        *{box-sizing:border-box} body{margin:0;padding:0}
        @media(max-width:768px){ .product-grid{ grid-template-columns: 1fr !important; } }
      `}</style>

      <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px' }}>
        <a href={`${prefix}/`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--s-text2)', fontSize: 13.5, textDecoration: 'none',
          fontWeight: 500, fontFamily: 'var(--s-font)',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--s-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--s-text2)'}
        >
          <ArrowLeft size={15} /> Retour à la boutique
        </a>
      </div>

      {/* Product Detail */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 24px 0' }}>
        <div className="product-grid" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start',
        }}>
          {/* ── Left: Gallery ─────────────────────────────────────────────── */}
          <div style={{ position: 'sticky', top: 80 }}>
            {loading ? (
              <div>
                <div style={{ paddingBottom: '100%', position: 'relative', borderRadius: 20, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
                    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  {[0,1,2].map(i => <Sk key={i} h={68} w={68} r={12} />)}
                </div>
              </div>
            ) : (
              <ImageGallery images={images} />
            )}
          </div>

          {/* ── Right: Info ───────────────────────────────────────────────── */}
          <div style={{ paddingBottom: 48 }}>
            {loading ? (
              <div>
                <Sk h={12} w="30%" r={6} mb={12} />
                <Sk h={36} r={8} mb={8} />
                <Sk h={36} w="70%" r={8} mb={24} />
                <Sk h={28} w="40%" r={6} mb={8} />
                <Sk h={20} w="25%" r={6} mb={32} />
                <Sk h={54} r={12} mb={12} />
                <Sk h={54} r={12} mb={24} />
                <Sk h={16} r={6} mb={8} />
                <Sk h={16} w="80%" r={6} mb={8} />
                <Sk h={16} w="60%" r={6} />
              </div>
            ) : product ? (
              <>
                {/* Category */}
                {product.category && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--s-primary)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {product.category}
                  </span>
                )}

                {/* Name */}
                <h1 style={{
                  fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 800,
                  color: 'var(--s-text)', margin: '8px 0 8px',
                  lineHeight: 1.15, letterSpacing: '-0.02em', fontFamily: 'var(--s-font)',
                }}>
                  {product.name}
                </h1>

                {/* Reviews */}
                <ProductReviews rating={product.rating || 4.5} reviewCount={product.reviewCount || 0} />

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--s-primary)', fontFamily: 'var(--s-font)', letterSpacing: '-0.02em' }}>
                    {fmt(product.price, product.currency)}
                  </span>
                  {hasDiscount && (
                    <>
                      <span style={{ fontSize: 17, color: 'var(--s-text2)', textDecoration: 'line-through', fontFamily: 'var(--s-font)' }}>
                        {fmt(product.compareAtPrice, product.currency)}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 20, backgroundColor: '#FEE2E2', color: '#EF4444' }}>
                        -{pct}%
                      </span>
                    </>
                  )}
                </div>

                {/* Stock badge */}
                <div style={{ marginBottom: 24 }}>
                  {!inStock ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', padding: '4px 12px', borderRadius: 20, backgroundColor: '#FEE2E2' }}>
                      Rupture de stock
                    </span>
                  ) : lowStock ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', padding: '4px 12px', borderRadius: 20, backgroundColor: '#FEF3C7' }}>
                      ⚡ Plus que {product.stock} en stock
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#10B981', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Check size={14} /> En stock
                    </span>
                  )}
                </div>

                {/* Quantity selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--s-text2)' }}>Quantité</span>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--s-border)', borderRadius: 40, overflow: 'hidden' }}>
                    <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{
                      width: 38, height: 38, border: 'none', backgroundColor: 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Minus size={14} />
                    </button>
                    <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{qty}</span>
                    <button onClick={() => setQty(q => q + 1)} style={{
                      width: 38, height: 38, border: 'none', backgroundColor: 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  <button
                    onClick={() => setShowOrderModal(true)}
                    disabled={!inStock}
                    style={{
                      width: '100%', padding: '15px 24px', borderRadius: 40, border: 'none',
                      backgroundColor: inStock ? 'var(--s-primary)' : '#d1d5db',
                      color: '#fff', fontWeight: 700, fontSize: 16, cursor: inStock ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                      transition: 'all 0.2s', fontFamily: 'var(--s-font)',
                      boxShadow: inStock ? '0 4px 16px rgba(0,0,0,0.12)' : 'none',
                    }}
                  >
                    <ShoppingCart size={18} /> Commander maintenant
                  </button>

                  {store?.whatsapp && (
                    <button
                      onClick={() => setShowOrderModal(true)}
                      style={{
                        width: '100%', padding: '14px 24px', borderRadius: 40, border: '1.5px solid #25D366',
                        backgroundColor: 'transparent', color: '#25D366',
                        fontWeight: 700, fontSize: 15, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                        fontFamily: 'var(--s-font)', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#25D366'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#25D366'; }}
                    >
                      <MessageCircle size={17} /> Commander via WhatsApp
                    </button>
                  )}
                </div>

                {/* Description */}
                {product.description?.toString().trim() && (
                  <div style={{ marginBottom: 16, paddingTop: 20, borderTop: '1px solid var(--s-border)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--s-text)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Description
                    </h3>
                    <ProductDescription content={product.description} />
                  </div>
                )}

                <TrustBadges />
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Related Products ───────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section style={{ maxWidth: 1200, margin: '64px auto 0', padding: '0 24px' }}>
          <h2 style={{
            fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 800, color: 'var(--s-text)',
            margin: '0 0 24px', letterSpacing: '-0.02em', fontFamily: 'var(--s-font)',
          }}>
            Vous aimerez aussi
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            {related.map(p => <RelatedCard key={p._id} product={p} prefix={prefix} />)}
          </div>
        </section>
      )}

      <StorefrontFooter store={store} />

      {/* Quick Order Modal */}
      {product && (
        <QuickOrderModal
          isOpen={showOrderModal}
          product={product}
          quantity={qty}
          store={store}
          subdomain={subdomain}
          onClose={() => setShowOrderModal(false)}
        />
      )}
    </div>
  );
};

export default StoreProductPage;
