import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, ShoppingCart, MessageCircle,
  ShoppingBag, Shield, RotateCcw, Truck, Check,
  ChevronDown, ChevronUp, Star,
} from 'lucide-react';
import { useSubdomain } from '../hooks/useSubdomain';
import { useStoreProduct, injectStoreCssVars, prefetchStoreProduct } from '../hooks/useStoreData';
import { useStoreCart } from '../hooks/useStoreCart';
import QuickOrderModal from '../components/QuickOrderModal';
import TestimonialsCarousel from '../components/TestimonialsCarousel';
import ProductBenefits from '../components/ProductBenefits';
import ConversionBlocks, { UrgencyBadge } from '../components/ConversionBlocks';
import { io } from 'socket.io-client';
import { setDocumentMeta } from '../utils/pageMeta';
import { injectPixelScripts, firePixelEvent } from '../utils/pixelTracking';
import { preloadStoreCheckoutRoute, preloadStoreProductRoute } from '../utils/routePrefetch';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

const normalizeMetaText = (value = '') => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const truncateMetaText = (value = '', max = 180) => {
  if (!value || value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
};

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
      <Link to={`${prefix}/`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
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
      </Link>
      <Link to={`${prefix}/checkout`} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 18px', borderRadius: 40, border: '1.5px solid',
        borderColor: cartCount > 0 ? 'var(--s-primary)' : 'var(--s-border)',
        backgroundColor: cartCount > 0 ? 'var(--s-primary)' : 'transparent',
        color: cartCount > 0 ? '#fff' : 'var(--s-text)',
        textDecoration: 'none', fontWeight: 600, fontSize: 14, fontFamily: 'var(--s-font)',
      }} onMouseEnter={preloadStoreCheckoutRoute} onFocus={preloadStoreCheckoutRoute} onTouchStart={preloadStoreCheckoutRoute}>
        <ShoppingCart size={17} />
        {cartCount > 0 && <span>{cartCount}</span>}
      </Link>
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
      paddingBottom: '100%', position: 'relative',
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
          position: 'relative', paddingBottom: '100%',
          backgroundColor: '#f4f4f5', overflow: 'hidden', cursor: 'zoom-in',
        }}
        onClick={() => setZoomed(true)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={images[active]?.url || images[active]}
          alt={images[active]?.alt || ''}
          loading="eager"
          fetchpriority="high"
          decoding="async"
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
        <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {images.map((img, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              flexShrink: 0, width: 68, height: 68, overflow: 'hidden', padding: 0,
              border: '2.5px solid',
              borderColor: i === active ? 'var(--s-primary)' : 'transparent',
              cursor: 'pointer', transition: 'border-color 0.15s',
              backgroundColor: '#f4f4f5',
            }}>
              <img
                src={img?.url || img} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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

// ── Scrolling Features Component ─────────────────────────────────────────────
const ProductFeatures = ({ features }) => {
  if (!features || features.length === 0) return null;
  
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };
  
  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  };
  
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    return () => el.removeEventListener('scroll', checkScroll);
  }, []);
  
  const iconMap = {
    shield: Shield,
    truck: Truck,
    rotate: RotateCcw,
    check: Check,
    star: Star,
    zap: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  };
  
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      {/* Left arrow */}
      {canScrollLeft && (
        <button 
          onClick={() => scroll('left')}
          style={{
            position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, width: 28, height: 28, borderRadius: '50%', 
            backgroundColor: 'var(--s-bg)', border: '1px solid var(--s-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <ChevronLeft size={16} color="var(--s-text)" />
        </button>
      )}
      
      {/* Scrollable container */}
      <div 
        ref={scrollRef}
        style={{
          display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none',
          msOverflowStyle: 'none', padding: '4px 0',
        }}
      >
        {features.map((feature, idx) => {
          const IconComponent = iconMap[feature.icon] || Check;
          return (
            <div 
              key={idx}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 20,
                backgroundColor: 'var(--s-primary)',
                color: '#fff', fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--s-font)', whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <IconComponent size={14} />
              <span>{feature.text}</span>
            </div>
          );
        })}
      </div>
      
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
      
      {/* Right arrow */}
      {canScrollRight && (
        <button 
          onClick={() => scroll('right')}
          style={{
            position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, width: 28, height: 28, borderRadius: '50%', 
            backgroundColor: 'var(--s-bg)', border: '1px solid var(--s-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <ChevronRight size={16} color="var(--s-text)" />
        </button>
      )}
    </div>
  );
};

// ── Description ──────────────────────────────────────────────────────────────
const optimizeDescriptionHtml = (html = '') => {
  if (!html || typeof DOMParser === 'undefined') return html;

  try {
    const doc = new DOMParser().parseFromString(`<div id="sf-desc-html">${html}</div>`, 'text/html');
    const root = doc.getElementById('sf-desc-html');
    if (!root) return html;

    root.querySelectorAll('img').forEach((img) => {
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      img.setAttribute('fetchpriority', 'low');
    });

    return root.innerHTML.trim();
  } catch {
    return html;
  }
};

const ProductDescription = ({ content }) => {
  const rawContent = content?.toString().trim() || '';
  if (!rawContent) return null;

  const isHTML = /<[^>]+>/.test(rawContent);
  if (!isHTML) {
    return (
      <div
        className="ai-desc"
        style={{
          fontSize: 15,
          lineHeight: 1.75,
          color: 'var(--s-text2)',
          fontFamily: 'var(--s-font)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {rawContent}
      </div>
    );
  }

  const cleanContent = optimizeDescriptionHtml(rawContent);
  const htmlToRender = (cleanContent && cleanContent.trim()) ? cleanContent : rawContent;

  return (
    <div>
      <div
        className="ai-desc"
        style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}
        dangerouslySetInnerHTML={{ __html: htmlToRender }}
      />
    </div>
  );
};

// Extraire Q/R depuis le HTML pour les anciens produits
const extractFaqItemsFromHtml = (html = '') => {
  if (!html || typeof DOMParser === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
    const root = doc.getElementById('r');

    // Trouver le conteneur FAQ (div avec heading "Questions fréquentes")
    const faqContainer = Array.from(root.querySelectorAll('*')).find(el => {
      if (!/^(DIV|SECTION|ARTICLE)$/.test(el.tagName)) return false;
      const h = el.querySelector('h1,h2,h3,h4,h5,h6');
      return h && /questions?\s*fréquentes?|faq/i.test(h.textContent || '');
    });

    const source = faqContainer || root;
    const items = [];

    // Pattern A : éléments de question (h4, h3, p>strong, p>b)
    const questionEls = Array.from(source.querySelectorAll('h4,h3')).filter(el =>
      !/questions?\s*fréquentes?|faq/i.test(el.textContent || '')
    );

    if (questionEls.length) {
      questionEls.forEach(qEl => {
        const q = qEl.textContent?.trim();
        if (!q) return;
        let next = qEl.nextElementSibling;
        while (next && !next.textContent?.trim()) next = next.nextElementSibling;
        const a = next?.textContent?.trim();
        if (q && a) items.push({ question: q, reponse: a });
      });
    }

    // Pattern B : <p><strong>Q?</strong></p> suivi de <p>R.</p>
    if (!items.length) {
      const allP = Array.from(source.querySelectorAll('p')).filter(p => p.textContent?.trim());
      allP.forEach((p, i) => {
        const strong = p.querySelector('strong, b');
        if (strong && p.textContent?.includes('?')) {
          const next = allP[i + 1];
          if (next && !next.querySelector('strong, b')) {
            items.push({ question: p.textContent.trim(), reponse: next.textContent.trim() });
          }
        }
      });
    }

    // Pattern C : alternance paragraphes (impairs = questions, pairs = réponses)
    if (!items.length && faqContainer) {
      const paras = Array.from(faqContainer.querySelectorAll('p')).filter(p => p.textContent?.trim());
      for (let i = 0; i + 1 < paras.length; i += 2) {
        items.push({ question: paras[i].textContent.trim(), reponse: paras[i + 1].textContent.trim() });
      }
    }

    return items;
  } catch { return []; }
};

// ── Collapsible Section ──────────────────────────────────────────────────────
const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: '1px solid var(--s-border)', marginTop: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>
          {title}
        </span>
        {open ? <ChevronUp size={18} color="var(--s-text2)" /> : <ChevronDown size={18} color="var(--s-text2)" />}
      </button>
      {open && (
        <div style={{ paddingBottom: 20 }}>
          {children}
        </div>
      )}
    </div>
  );
};

const ProductFaqAccordion = ({ items = [] }) => {
  const [openIndex, setOpenIndex] = useState(null);

  if (!items.length) return null;

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--s-border)' }}>
      <h2 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 800, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>
        Questions fréquentes
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, index) => {
          const opened = openIndex === index;
          return (
            <div key={`${item.question}-${index}`} style={{ borderRadius: 14, border: '1px solid', overflow: 'hidden', borderColor: opened ? 'var(--s-primary)' : 'var(--s-border)', backgroundColor: opened ? '#FAFFFE' : '#fff' }}>
              <button
                onClick={() => setOpenIndex(opened ? null : index)}
                style={{ width: '100%', padding: '18px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--s-text)', lineHeight: 1.45, fontFamily: 'var(--s-font)' }}>
                  {item.question}
                </span>
                <span style={{ flexShrink: 0, color: opened ? 'var(--s-primary)' : 'var(--s-text2)' }}>
                  {opened ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>
              {opened && (
                <div style={{ padding: '0 18px 18px', fontSize: 14, color: 'var(--s-text2)', lineHeight: 1.7, fontFamily: 'var(--s-font)' }}>
                  {item.answer || item.reponse}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Trust Badges ─────────────────────────────────────────────────────────────
const TrustBadges = ({ compact = false }) => (
  <div className="sf-no-scrollbar" style={{
    display: 'flex', gap: 12,
    marginTop: compact ? 24 : 28,
    padding: compact ? '0 0 4px' : '20px 0 4px',
    borderTop: compact ? 'none' : '1px solid var(--s-border)',
    overflowX: 'auto',
    flexWrap: 'nowrap',
  }}>
    {[
      { icon: <Truck size={16} />, text: 'Livraison rapide' },
      { icon: <Shield size={16} />, text: 'Paiement sécurisé' },
      { icon: <RotateCcw size={16} />, text: 'Retours acceptés' },
    ].map(({ icon, text }) => (
      <div key={text} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 999,
        border: '1px solid var(--s-border)',
        backgroundColor: '#fff',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--s-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}>
          {text}
        </span>
      </div>
    ))}
  </div>
);

// ── Related Products ─────────────────────────────────────────────────────────
const RelatedCard = ({ product, prefix, store, subdomain }) => {
  const [hovered, setHovered] = useState(false);
  const handlePrefetch = () => {
    preloadStoreProductRoute();
    if (subdomain && product?.slug) {
      prefetchStoreProduct(subdomain, product.slug);
    }
  };

  return (
    <Link to={`${prefix}/product/${product.slug}`} style={{ textDecoration: 'none' }}
      onMouseEnter={() => { setHovered(true); handlePrefetch(); }} onMouseLeave={() => setHovered(false)} onFocus={handlePrefetch} onTouchStart={handlePrefetch}>
      <div style={{
        borderRadius: 14, overflow: 'hidden', border: '1px solid var(--s-border)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'none', transition: 'all 0.2s',
      }}>
        <div style={{ paddingBottom: '100%', position: 'relative', backgroundColor: '#f4f4f5', overflow: 'hidden' }}>
          {product.image ? (
            <img src={product.image} alt={product.name} loading="lazy" decoding="async" sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 160px"
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
            {fmt(product.price, product.currency || store?.currency || 'XAF')}
          </span>
        </div>
      </div>
    </Link>
  );
};


// ── Footer ───────────────────────────────────────────────────────────────────
const StorefrontFooter = ({ store }) => (
  <footer style={{ borderTop: '1px solid var(--s-border)', marginTop: 80, padding: '40px 24px', fontFamily: 'var(--s-font)' }}>
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
      <div>
        <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--s-text)', margin: '0 0 4px' }}>{store?.name}</p>
        {store?.description && <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: 0, maxWidth: 320 }}>{store.description}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
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

  const { store, pixels, product, related, error } = useStoreProduct(subdomain, slug);
  const { cartCount } = useStoreCart(subdomain);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showStickyOrderBar, setShowStickyOrderBar] = useState(false);
  const ctaButtonsRef = useRef(null);

  // Inject pixel scripts and fire ViewContent when product loads
  useEffect(() => {
    if (!product || !pixels) return;
    injectPixelScripts(pixels);
    firePixelEvent('ViewContent', {
      content_ids: [product._id || product.slug || ''],
      content_name: product.name || '',
      value: product.price || 0,
      currency: store?.currency || 'XAF',
    });
  }, [product, pixels, store?.currency]);

  useEffect(() => {
    if (!store?.name || !product?.name) return;
    const storeVisual = store.logo || store.banner || product.images?.[0]?.url || '/icon.png';
    setDocumentMeta({
      title: product.seoTitle || `${product.name} — ${store.name}`,
      description: truncateMetaText(
        normalizeMetaText(product.seoDescription || product.description || store.description || `Découvrez ${product.name} chez ${store.name}.`),
        180,
      ),
      image: storeVisual,
      icon: store.logo || storeVisual,
      siteName: store.name,
      appTitle: store.name,
      type: 'product',
    });
  }, [product, store]);

  // Écouter les changements de couleurs en temps réel via Socket.io
  useEffect(() => {
    if (!subdomain) return;
    
    const socketUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.scalor.net';
    const socket = io(`${socketUrl}/store-live`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    
    socket.on('connect', () => {
      console.log('[Store] Socket connecté, joining:', subdomain);
      socket.emit('store:join', { subdomain });
    });
    
    socket.on('theme:update', (themeData) => {
      console.log('[Store] Theme update reçu:', themeData);
      if (themeData) {
        injectStoreCssVars(themeData);
      }
    });
    
    socket.on('connect_error', (err) => {
      console.log('[Store] Socket error:', err.message);
    });
    
    return () => {
      socket.disconnect();
    };
  }, [subdomain]);

  const images = product?.images?.length ? product.images : [];
  const hasDiscount = product?.compareAtPrice && product.compareAtPrice > product.price;
  const pct = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const inStock = !product || product.stock > 0;
  const lowStock = product && product.stock > 0 && product.stock <= 5;
  const sectionToggles = store?.sectionToggles || {};
  const showWhatsappButton = (sectionToggles.showWhatsappButton ?? false) && !!store?.whatsapp;
  const showFaq = sectionToggles.showFaq ?? true;
  const showTrustBadges = sectionToggles.showTrustBadges ?? true;
  const showRelatedProducts = sectionToggles.showRelatedProducts ?? true;

  useEffect(() => {
    if (!product || !inStock) {
      setShowStickyOrderBar(false);
      return;
    }

    const checkStickyVisibility = () => {
      const ctaBox = ctaButtonsRef.current;
      if (!ctaBox) { setShowStickyOrderBar(false); return; }
      const rect = ctaBox.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      setShowStickyOrderBar(!isVisible);
    };

    checkStickyVisibility();
    window.addEventListener('scroll', checkStickyVisibility, { passive: true });
    window.addEventListener('resize', checkStickyVisibility);

    return () => {
      window.removeEventListener('scroll', checkStickyVisibility);
      window.removeEventListener('resize', checkStickyVisibility);
    };
  }, [product, inStock]);

  const openOrderModal = () => {
    if (!inStock) return;
    setShowOrderModal(true);
    firePixelEvent('AddToCart', {
      content_ids: [product?._id || product?.slug || ''],
      content_name: product?.name || '',
      value: product?.price || 0,
      currency: store?.currency || 'XAF',
    });
  };

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 48, margin: '0 0 16px' }}>😕</p>
        <h2 style={{ color: '#111', fontWeight: 700, margin: '0 0 8px' }}>Produit introuvable</h2>
        <p style={{ color: '#6B7280', fontSize: 15 }}>{error}</p>
        <Link to={`${prefix}/`} style={{ marginTop: 20, display: 'inline-block', color: 'var(--s-primary)', fontWeight: 600, fontSize: 14 }}>← Accueil</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--s-bg)', fontFamily: 'var(--s-font)', color: 'var(--s-text)' }}>
      <style>{`
        *{box-sizing:border-box} body{margin:0;padding:0}
        .sf-no-scrollbar { scrollbar-width:none; -ms-overflow-style:none; }
        .sf-no-scrollbar::-webkit-scrollbar { display:none; }
        @keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media(max-width:768px){ .product-grid{ grid-template-columns: 1fr !important; } }
        .ai-desc h3 { font-size:20px; font-weight:800; color:var(--s-text); margin:0 0 12px; line-height:1.3; }
        .ai-desc h3 strong { font-weight:800; }
        .ai-desc p { font-size:15px; line-height:1.75; color:var(--s-text2); margin:0 0 14px; }
        .ai-desc img { width:100% !important; max-width:none !important; aspect-ratio:1 / 1; object-fit:cover; display:block; margin:0 0 0; }
        .ai-desc ul { margin:0; padding:0; list-style:none; }
        .ai-desc ul li { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; font-size:14px; }
        .ai-desc-testimonials { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; }
        @media(max-width:640px){ .ai-desc-testimonials { grid-template-columns:1fr; } }
      `}</style>

      {/* Barre d'annonce */}
      {store?.announcementEnabled && store?.announcement && (
        <div style={{
          backgroundColor: 'var(--s-primary)',
          color: '#fff',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'var(--s-font)',
        }}>
          {store.announcement}
        </div>
      )}

      <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />

      {/* Product Detail */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 24px 0' }}>
        <div className="product-grid" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start',
        }}>
          {/* ── Left: Gallery ─────────────────────────────────────────────── */}
          <div style={{ position: 'sticky', top: 80 }}>
            <ImageGallery images={images} />
          </div>

          {/* ── Right: Info ───────────────────────────────────────────────── */}
          <div style={{ paddingBottom: 48 }}>
            {product ? (
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

                {/* Features/Badges - scrolling list */}
                <ProductFeatures features={product.features} />

                {/* Reviews */}
                <ProductReviews rating={product.rating || 4.5} reviewCount={product.reviewCount || 0} />

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--s-primary)', fontFamily: 'var(--s-font)', letterSpacing: '-0.02em' }}>
                    {fmt(product.price, product.currency || store?.currency || 'XAF')}
                  </span>
                  {hasDiscount && (
                    <>
                      <span style={{ fontSize: 17, color: 'var(--s-text2)', textDecoration: 'line-through', fontFamily: 'var(--s-font)' }}>
                        {fmt(product.compareAtPrice, product.currency || store?.currency || 'XAF')}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 20, backgroundColor: '#FEE2E2', color: '#EF4444' }}>
                        -{pct}%
                      </span>
                    </>
                  )}
                </div>

                {/* Stock badge */}
                <div style={{ marginBottom: 16 }}>
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

                {/* Urgency elements */}
                {product._pageData?.urgency_elements && (
                  <UrgencyBadge
                    stockLimited={product._pageData.urgency_elements.stock_limited}
                    socialProofCount={product._pageData.urgency_elements.social_proof_count}
                    quickResult={product._pageData.urgency_elements.quick_result}
                  />
                )}

                {/* Benefits bullets with emojis */}
                {product._pageData?.benefits_bullets && product._pageData.benefits_bullets.length > 0 && (
                  <ProductBenefits benefits={product._pageData.benefits_bullets} title="💥 Les bénéfices" />
                )}

                {/* CTA Buttons */}
                <div ref={ctaButtonsRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  <button
                    onClick={openOrderModal}
                    disabled={!inStock}
                    onMouseEnter={(e) => {
                      if (inStock) {
                        e.target.style.transform = 'scale(1.05)';
                        e.target.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (inStock) {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                      }
                    }}
                    style={{
                      width: '100%', padding: '15px 24px', borderRadius: 40, border: 'none',
                      backgroundColor: inStock ? 'var(--s-primary)' : '#d1d5db',
                      color: '#fff', fontWeight: 700, fontSize: 16, cursor: inStock ? 'pointer' : 'not-allowed',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', fontFamily: 'var(--s-font)',
                      boxShadow: inStock ? '0 4px 16px rgba(0,0,0,0.12)' : 'none',
                      animation: inStock ? 'glow 2s ease-in-out infinite' : 'none',
                      transform: inStock ? 'scale(1)' : 'scale(0.98)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <ShoppingCart size={18} /> Commander maintenant
                    </div>
                    <span style={{ 
                      fontSize: '12px', 
                      opacity: 0.9, 
                      fontWeight: 500, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 4,
                      animation: 'pulse 2s ease-in-out infinite'
                    }}>
                      <Truck size={10} style={{ 
                        animation: 'bounce 1s ease-in-out infinite'
                      }} /> Paiement à la livraison
                    </span>
                  </button>

                </div>

                {/* Conversion blocks */}
                {product._pageData?.conversion_blocks && product._pageData.conversion_blocks.length > 0 && (
                  <ConversionBlocks blocks={product._pageData.conversion_blocks} />
                )}

                {/* Messages de confiance */}
                {showTrustBadges && <TrustBadges compact />}

                {(() => {
                  const raw = product.description?.toString().trim() || '';
                  const hasHtml = raw && /<[^>]+>/.test(raw);

                  const faqItems = product.faq?.length > 0
                    ? product.faq
                    : (showFaq && hasHtml ? extractFaqItemsFromHtml(raw) : []);
                  const hasFaq = showFaq && faqItems.length > 0;

                  const hasDesc = !!raw?.trim();

                  return (
                    <>
                      {hasDesc && (
                        <div style={{ borderTop: '1px solid var(--s-border)', marginTop: 8, paddingTop: 16, paddingBottom: 8 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--s-text)', fontFamily: 'var(--s-font)', marginBottom: 12 }}>
                            Description du produit
                          </div>
                          <ProductDescription content={raw} />
                        </div>
                      )}
                      {hasFaq && (
                        <div style={{ marginTop: 32 }}>
                          <h2 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 800, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>
                            ❓ Questions fréquentes
                          </h2>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {faqItems.map((item, index) => (
                              <div key={index} style={{ 
                                padding: '20px', 
                                backgroundColor: '#fff',
                                border: '1px solid var(--s-border)',
                                borderRadius: 12,
                              }}>
                                <h3 style={{ 
                                  fontSize: 15, 
                                  fontWeight: 700, 
                                  color: 'var(--s-text)', 
                                  margin: '0 0 12px',
                                  lineHeight: 1.4,
                                  fontFamily: 'var(--s-font)',
                                }}>
                                  {item.question}
                                </h3>
                                <p style={{ 
                                  fontSize: 14, 
                                  color: 'var(--s-text2)', 
                                  lineHeight: 1.7, 
                                  margin: 0,
                                  fontFamily: 'var(--s-font)',
                                }}>
                                  {item.answer || item.reponse}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {product.testimonials && product.testimonials.length > 0 && (
                        <div style={{ marginTop: 32, marginBottom: 32 }}>
                          <TestimonialsCarousel testimonials={product.testimonials} autoPlay={true} />
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Related Products ───────────────────────────────────────────────── */}
      {showRelatedProducts && related.length > 0 && (
        <section style={{ maxWidth: 1200, margin: '64px auto 0', padding: '0 24px' }}>
          <h2 style={{
            fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 800, color: 'var(--s-text)',
            margin: '0 0 24px', letterSpacing: '-0.02em', fontFamily: 'var(--s-font)',
          }}>
            Vous aimerez aussi
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            {related.map(p => <RelatedCard key={p._id} product={p} prefix={prefix} store={store} subdomain={store?.subdomain} />)}
          </div>
        </section>
      )}

      {showStickyOrderBar && product && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70,
          padding: '10px 14px calc(env(safe-area-inset-bottom, 0px) + 10px)',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid var(--s-border)',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(10px)',
          animation: 'slide-up 0.2s ease-out',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}>{product.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: 'var(--s-primary)', fontFamily: 'var(--s-font)' }}>
                {fmt(product.price, product.currency || store?.currency || 'XAF')}
              </p>
            </div>
            <button
              onClick={openOrderModal}
              disabled={!inStock}
              style={{
                border: 'none', borderRadius: 999, padding: '14px 20px',
                backgroundColor: inStock ? 'var(--s-primary)' : '#d1d5db', color: '#fff',
                fontSize: 14, fontWeight: 800, fontFamily: 'var(--s-font)',
                cursor: inStock ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
              }}
            >
              Commander
            </button>
          </div>
        </div>
      )}

      <StorefrontFooter store={store} />

      {/* Quick Order Modal */}
      {product && (
        <QuickOrderModal
          isOpen={showOrderModal}
          product={product}
          store={store}
          subdomain={subdomain}
          onClose={() => setShowOrderModal(false)}
        />
      )}
    </div>
  );
};

export default StoreProductPage;
