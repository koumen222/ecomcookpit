import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShoppingCart, MessageCircle, ArrowRight, ShoppingBag, Star,
  ChevronDown, ChevronUp, Truck, ShieldCheck, Package, RotateCcw,
  Leaf, Heart, Sparkles, Zap, Gift, Users, Globe, Award, Clock,
  MapPin, Mail, X, ChevronRight, DollarSign, CheckCircle,
  Search, Menu, Phone, Eye, Flame, Tag,
} from 'lucide-react';
import { useSubdomain } from '../hooks/useSubdomain';
import { useStoreData } from '../hooks/useStoreData';
import { useStoreCart } from '../hooks/useStoreCart';
import { setDocumentMeta } from '../utils/pageMeta';

const fmt = (n, cur = 'XAF') =>
  `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

const normalizeMetaText = (value = '') => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const truncateMetaText = (value = '', max = 180) => {
  if (!value || value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
};

const getStoreMetaImage = (store) => store?.logo || store?.banner || '/icon.png';

const getStoreMetaDescription = (store, fallback = '') => truncateMetaText(
  normalizeMetaText(fallback || store?.description || `Découvrez la boutique ${store?.name || 'Scalor'} en ligne.`),
  180,
);

// ─── ICON COMPONENTS mapping (string → Lucide Component) ─────────────────────
const ICON_COMPONENTS = {
  'truck': Truck,
  'check-circle': CheckCircle,
  'shield-check': ShieldCheck,
  'message-circle': MessageCircle,
  'rotate-ccw': RotateCcw,
  'star': Star,
  'dollar-sign': DollarSign,
  'heart': Heart,
  'package': Package,
  'leaf': Leaf,
  'sparkles': Sparkles,
  'zap': Zap,
  'gift': Gift,
  'users': Users,
  'globe': Globe,
  'award': Award,
  'clock': Clock,
  'map-pin': MapPin,
  'mail': Mail,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
};

// Legacy emoji support (for backward compatibility - will be removed later)
const EMOJI_ICON_MAP = {
  '🚚': Truck, '🚛': Truck, '🚀': Zap,
  '💯': ShieldCheck, '✅': ShieldCheck, '🔒': ShieldCheck,
  '📱': MessageCircle, '💬': MessageCircle, '📞': MessageCircle,
  '📦': Package, '🛍️': Package, '📫': Package,
  '🔄': RotateCcw, '↩️': RotateCcw, '🔃': RotateCcw,
  '🌿': Leaf, '🌱': Leaf, '🍃': Leaf,
  '💆': Heart, '💆‍♀️': Heart, '❤️': Heart, '💕': Heart,
  '🌸': Sparkles, '✨': Sparkles, '💫': Sparkles,
  '🌟': Star, '⭐': Star, '🏅': Award,
  '⚡': Zap, '💡': Zap,
  '🎁': Gift, '🎀': Gift,
  '👥': Users, '👤': Users, '🤝': Users,
  '🌍': Globe, '🌐': Globe, '🗺️': Globe,
  '🏆': Award, '🥇': Award,
  '⏰': Clock, '🕐': Clock, '⏱️': Clock,
  '📍': MapPin, '🗺': MapPin,
  '📧': Mail, '✉️': Mail,
  '💰': DollarSign,
  '🛡️': ShieldCheck,
};

// Single tint box — uses store primary color via CSS color-mix
const ICON_BG = 'color-mix(in srgb, var(--s-primary) 12%, white)';

function IconBox({ emoji, icon, size = 22, bg, boxSize = 52, radius = 16 }) {
  const boxBg = bg || ICON_BG;
  
  // Priority: 1) icon prop (string), 2) emoji (legacy)
  let Icon = null;
  if (icon && typeof icon === 'string') {
    // New way: string icon name like "truck", "shield-check"
    Icon = ICON_COMPONENTS[icon];
  } else if (emoji) {
    // Legacy way: emoji characters
    Icon = EMOJI_ICON_MAP[emoji] || EMOJI_ICON_MAP[emoji?.trim()];
  }
  
  return (
    <div style={{
      width: boxSize, height: boxSize, borderRadius: radius, flexShrink: 0,
      backgroundColor: boxBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {Icon
        ? <Icon size={size} color="var(--s-primary)" strokeWidth={2} />
        : <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{emoji || icon}</span>}
    </div>
  );
}

// ─── ANNOUNCEMENT BAR ─────────────────────────────────────────────────────────
const AnnouncementBar = ({ store }) => {
  const [visible, setVisible] = useState(true);
  const msg = store?.announcementText || '🚚 Livraison rapide · 💳 Paiement à la livraison · 🔄 Retours faciles';
  if (!visible) return null;
  return (
    <div style={{
      background: 'var(--s-primary)', color: '#fff',
      fontSize: 13, fontWeight: 500, fontFamily: 'var(--s-font)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '9px 48px 9px 16px', textAlign: 'center',
      position: 'relative', lineHeight: 1.4, letterSpacing: '0.01em',
    }}>
      <span>{msg}</span>
      <button onClick={() => setVisible(false)} style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
        padding: 4, display: 'flex', lineHeight: 1,
      }}><X size={14} /></button>
    </div>
  );
};

// ─── HERO PREMIUM ─────────────────────────────────────────────────────────────
const AiHeroSection = ({ cfg, store, prefix, products }) => {
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Entrance animation
    setIsVisible(true);
    
    // Parallax effect on scroll
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const heroImg = cfg.backgroundImage || null;
  const heroVideo = cfg.backgroundVideo || null;
  const featuredProduct = products?.find(p => p.image) || null;
  const isSplit = !heroImg && !heroVideo && featuredProduct;
  
  // Dynamic gradient overlay based on theme color
  const gradientOverlay = `linear-gradient(135deg, 
    rgba(15, 107, 79, 0.85) 0%, 
    rgba(15, 107, 79, 0.65) 50%,
    rgba(0, 0, 0, 0.75) 100%
  )`;

  if (heroImg || heroVideo) {
    // Full-width image/video hero with dynamic gradient overlay + parallax
    return (
      <section style={{
        padding: 'clamp(100px, 16vw, 160px) 24px clamp(80px, 12vw, 130px)',
        textAlign: cfg.alignment || 'center',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Background Image/Video with Parallax */}
        {heroVideo ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `translateY(${scrollY * 0.5}px) scale(1.1)`,
              transition: 'transform 0.1s ease-out',
            }}
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
        ) : (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${heroImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: `translateY(${scrollY * 0.5}px) scale(1.1)`,
            transition: 'transform 0.1s ease-out',
          }} />
        )}

        {/* Dynamic Gradient Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: gradientOverlay,
          zIndex: 0,
        }} />

        {/* Trust Badge Floating */}
        <div style={{
          position: 'absolute',
          top: 24,
          right: 24,
          zIndex: 2,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}>
          {(cfg.trustBadges || ['Livraison 24h', '+1000 clients']).map((badge, i) => (
            <div key={i} style={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              padding: '8px 16px',
              borderRadius: 50,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--s-primary)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              animation: 'fadeIn 0.6s ease-out forwards',
              animationDelay: `${i * 0.1}s`,
              opacity: 0,
            }}>
              {badge}
            </div>
          ))}
        </div>

        {/* Content with entrance animation */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 800,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <HeroContentPremium cfg={cfg} prefix={prefix} store={store} />
        </div>
      </section>
    );
  }

  if (isSplit) {
    // Split layout with product image
    return (
      <section style={{
        backgroundColor: 'var(--s-primary)',
        position: 'relative',
        overflow: 'hidden',
        padding: 'clamp(70px, 12vw, 120px) 24px',
        minHeight: '75vh',
        display: 'flex',
        alignItems: 'center',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -80, left: -80, width: 380, height: 380, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)', pointerEvents: 'none', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 280, height: 280, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', pointerEvents: 'none', filter: 'blur(30px)' }} />
        
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 60,
          position: 'relative',
          zIndex: 1,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s ease-out',
        }}>
          {/* Text */}
          <div style={{ flex: '1 1 320px' }}>
            {store?.logo && (
              <img src={store.logo} alt={store.name} style={{ height: 52, width: 'auto', objectFit: 'contain', marginBottom: 32, filter: 'brightness(0) invert(1)' }} />
            )}
            <h1 style={{
              fontSize: 'clamp(40px, 7vw, 72px)',
              fontWeight: 900,
              lineHeight: 1.05,
              margin: '0 0 24px',
              letterSpacing: '-0.04em',
              fontFamily: 'var(--s-font)',
              color: '#fff',
              textShadow: '0 4px 32px rgba(0,0,0,0.2)',
            }}>{cfg.title}</h1>
            {cfg.subtitle && (
              <p style={{
                fontSize: 'clamp(16px, 2.2vw, 21px)',
                lineHeight: 1.6,
                margin: '0 0 48px',
                color: 'rgba(255,255,255,0.90)',
                fontFamily: 'var(--s-font)',
              }}>{cfg.subtitle}</p>
            )}
            <HeroDoubleCTA cfg={cfg} prefix={prefix} />
          </div>
          
          {/* Product image */}
          <div style={{ flex: '1 1 300px', maxWidth: 480, margin: '0 auto' }}>
            <div style={{
              borderRadius: 32,
              overflow: 'hidden',
              aspectRatio: '1/1',
              boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
              border: '6px solid rgba(255,255,255,0.2)',
              transform: 'rotate(-2deg)',
              transition: 'transform 0.4s ease',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'rotate(0deg) scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'rotate(-2deg)'}
            >
              <img src={featuredProduct.image} alt={featuredProduct.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Gradient only - centered
  return (
    <section style={{
      padding: 'clamp(100px, 15vw, 150px) 24px clamp(80px, 12vw, 130px)',
      textAlign: cfg.alignment || 'center',
      position: 'relative',
      overflow: 'hidden',
      background: `linear-gradient(135deg, var(--s-primary) 0%, color-mix(in srgb, var(--s-primary) 80%, black) 100%)`,
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Animated blobs */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)', pointerEvents: 'none', filter: 'blur(60px)', animation: 'pulse 4s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', pointerEvents: 'none', filter: 'blur(50px)', animation: 'pulse 5s ease-in-out infinite' }} />
      
      <div style={{
        maxWidth: 820,
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {store?.logo && (
          <img src={store.logo} alt={store.name} style={{ height: 60, width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 36px', filter: 'brightness(0) invert(1)' }} />
        )}
        <HeroContentPremium cfg={cfg} prefix={prefix} store={store} />
      </div>
    </section>
  );
};

// Double CTA Component
const HeroDoubleCTA = ({ cfg, prefix }) => (
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
    {/* Primary CTA */}
    <a href={`${prefix}/products`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '18px 42px',
        borderRadius: 50,
        backgroundColor: '#fff',
        color: 'var(--s-primary)',
        fontWeight: 800,
        fontSize: 16,
        textDecoration: 'none',
        letterSpacing: '-0.01em',
        fontFamily: 'var(--s-font)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.35)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
      }}
    >
      {cfg.ctaText || 'Commander maintenant'}
      <ArrowRight size={18} strokeWidth={3} />
    </a>

    {/* Secondary CTA */}
    <a href={`${prefix}/`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '18px 36px',
        borderRadius: 50,
        backgroundColor: 'transparent',
        border: '2px solid rgba(255,255,255,0.4)',
        color: '#fff',
        fontWeight: 700,
        fontSize: 15,
        textDecoration: 'none',
        fontFamily: 'var(--s-font)',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
      }}
    >
      {cfg.secondaryCtaText || 'En savoir plus'}
    </a>
  </div>
);

// Premium Hero Content
const HeroContentPremium = ({ cfg, prefix, store }) => (
  <div>
    <h1 style={{
      fontSize: 'clamp(42px, 8vw, 84px)',
      fontWeight: 900,
      lineHeight: 1.02,
      margin: '0 0 26px',
      letterSpacing: '-0.04em',
      fontFamily: 'var(--s-font)',
      color: '#fff',
      textShadow: '0 4px 32px rgba(0,0,0,0.25)',
    }}>
      {cfg.title}
    </h1>
    {cfg.subtitle && (
      <p style={{
        fontSize: 'clamp(17px, 2.5vw, 22px)',
        lineHeight: 1.6,
        margin: '0 0 48px',
        color: 'rgba(255,255,255,0.92)',
        fontFamily: 'var(--s-font)',
        maxWidth: 640,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        {cfg.subtitle}
      </p>
    )}
    <HeroDoubleCTA cfg={cfg} prefix={prefix} />
  </div>
);

// ─── TRUST BADGES PREMIUM ─────────────────────────────────────────────────────
const AiBadgesSection = ({ cfg }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  
  return (
    <section style={{
      backgroundColor: '#fff',
      borderBottom: '1px solid #F0F0F0',
      padding: '32px 0',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
        {/* Mobile: horizontal scroll, Desktop: grid */}
        <div style={{
          display: 'flex',
          gap: 20,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
          className="hide-scrollbar"
        >
          {(cfg.items || []).map((badge, i) => (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                minWidth: 240,
                flex: '1 1 0',
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '24px 28px',
                borderRadius: 16,
                backgroundColor: hoveredIdx === i ? '#F9FAFB' : '#fff',
                border: `2px solid ${hoveredIdx === i ? 'var(--s-primary)' : '#F3F4F6'}`,
                transition: 'all 0.3s ease',
                scrollSnapAlign: 'start',
                cursor: 'pointer',
                transform: hoveredIdx === i ? 'translateY(-4px)' : 'none',
                boxShadow: hoveredIdx === i ? '0 12px 32px rgba(15, 107, 79, 0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {/* Icon with pulse animation */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                flexShrink: 0,
                backgroundColor: 'color-mix(in srgb, var(--s-primary) 12%, white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <IconBox emoji={badge.icon} size={24} boxSize={56} radius={14} bg="transparent" />
                {/* Pulse ring on hover */}
                {hoveredIdx === i && (
                  <div style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: 18,
                    border: '2px solid var(--s-primary)',
                    opacity: 0.3,
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }} />
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontWeight: 800,
                  fontSize: 14.5,
                  color: 'var(--s-text)',
                  fontFamily: 'var(--s-font)',
                  letterSpacing: '-0.01em',
                }}>
                  {badge.title}
                </p>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: 12.5,
                  color: 'var(--s-text2)',
                  lineHeight: 1.5,
                  fontFamily: 'var(--s-font)',
                }}>
                  {badge.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── PRODUCTS (homepage: max 3 + see all) ─────────────────────────────────────
const AiProductsSection = ({ cfg, products, prefix, store }) => {
  const limit = cfg.homepageLimit || 3;
  const displayed = products.slice(0, limit);
  return (
    <section id="products" style={{ backgroundColor: '#FAFAFA', padding: 'clamp(52px, 8vw, 80px) 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 900, color: 'var(--s-text)', margin: '0 0 10px', letterSpacing: '-0.025em', fontFamily: 'var(--s-font)' }}>
            {cfg.title || 'Nos Produits'}
          </h2>
          {cfg.subtitle && <p style={{ fontSize: 15, color: 'var(--s-text2)', margin: 0, fontFamily: 'var(--s-font)' }}>{cfg.subtitle}</p>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24, maxWidth: 820, margin: '0 auto' }}>
          {displayed.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '64px 20px', color: 'var(--s-text2)' }}>
              <ShoppingBag size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: 15 }}>Aucun produit pour l'instant.</p>
            </div>
          ) : displayed.map(p => <ProductCard key={p._id} product={p} prefix={prefix} store={store} />)}
        </div>
        {products.length > limit && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <a href={`${prefix}/products`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '13px 32px', borderRadius: 40,
              border: '2px solid var(--s-primary)', color: 'var(--s-primary)',
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
              fontFamily: 'var(--s-font)', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--s-primary)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--s-primary)'; }}
            >
              Voir tous les produits ({products.length}) <ChevronRight size={16} />
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

// ─── FEATURES (why us) ────────────────────────────────────────────────────────
const AiFeaturesSection = ({ cfg }) => (
  <section style={{ padding: 'clamp(56px, 9vw, 88px) 24px', backgroundColor: '#fff' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{ fontSize: 'clamp(22px, 3.2vw, 34px)', fontWeight: 900, color: 'var(--s-text)', margin: 0, letterSpacing: '-0.025em', fontFamily: 'var(--s-font)' }}>
          {cfg.title || 'Pourquoi nous choisir ?'}
        </h2>
        {cfg.subtitle && <p style={{ fontSize: 15, color: 'var(--s-text2)', margin: '10px 0 0', fontFamily: 'var(--s-font)' }}>{cfg.subtitle}</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
        {(cfg.items || []).map((f, i) => (
          <div key={i}
            style={{ backgroundColor: '#FAFAFA', borderRadius: 20, padding: '28px 24px', border: '1px solid #F0F0F0', transition: 'box-shadow 0.2s, transform 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
          >
            <IconBox emoji={f.icon} size={22} boxSize={52} radius={16} />
            <h3 style={{ margin: '18px 0 10px', fontSize: 15.5, fontWeight: 700, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>{f.title}</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--s-text2)', lineHeight: 1.65, fontFamily: 'var(--s-font)' }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── TESTIMONIALS ──────────────────────────────────────────────────────────────
// ─── TESTIMONIALS CAROUSEL PREMIUM ────────────────────────────────────────────
const AiTestimonialsSection = ({ cfg }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const items = cfg.items || [];
  
  // Auto-rotation every 5 seconds (pauses on hover)
  useEffect(() => {
    if (items.length <= 1 || isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % items.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [items.length, isPaused]);

  if (items.length === 0) return null;

  const goTo = (idx) => setCurrentIdx(idx);
  const goNext = () => setCurrentIdx((currentIdx + 1) % items.length);
  const goPrev = () => setCurrentIdx((currentIdx - 1 + items.length) % items.length);

  return (
    <section style={{
      padding: 'clamp(60px, 10vw, 96px) 24px',
      background: 'linear-gradient(to bottom, #F9FAFB 0%, #FFFFFF 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative blob */}
      <div style={{
        position: 'absolute',
        top: -60,
        right: -60,
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(15, 107, 79, 0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      
      <div style={{ maxWidth: 920, margin: '0 auto', position: 'relative' }}>
        {/* Title */}
        <h2 style={{
          fontSize: 'clamp(26px, 4vw, 40px)',
          fontWeight: 900,
          textAlign: 'center',
          color: 'var(--s-text)',
          margin: '0 0 56px',
          letterSpacing: '-0.03em',
          fontFamily: 'var(--s-font)',
        }}>
          {cfg.title || 'Ce que disent nos clients'}
        </h2>

        {/* Carousel Container */}
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          style={{
            position: 'relative',
            padding: '0 60px',
          }}
        >
          {/* Testimonial Card */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: 24,
            padding: 'clamp(32px, 5vw, 48px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
            border: '1px solid #F0F0F0',
            minHeight: 280,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            transition: 'transform 0.3s ease',
          }}>
            {/* Stars */}
            <div style={{
              display: 'flex',
              gap: 4,
              marginBottom: 24,
              justifyContent: 'center',
            }}>
              {Array.from({ length: items[currentIdx]?.rating || 5 }).map((_, j) => (
                <Star
                  key={j}
                  size={20}
                  fill="var(--s-primary)"
                  color="var(--s-primary)"
                  style={{
                    animation: `fadeIn 0.3s ease-out ${j * 0.05}s both`,
                  }}
                />
              ))}
            </div>

            {/* Quote */}
            <p style={{
              fontSize: 'clamp(16px, 2vw, 19px)',
              lineHeight: 1.8,
              color: '#374151',
              margin: '0 0 32px',
              fontFamily: 'var(--s-font)',
              fontStyle: 'italic',
              textAlign: 'center',
              maxWidth: 680,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}>
              "{items[currentIdx]?.content || items[currentIdx]?.text}"
            </p>

            {/* Author */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}>
              {/* Avatar */}
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'linear-gradient(135deg, var(--s-primary) 0%, color-mix(in srgb, var(--s-primary) 70%, black) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 18,
                color: '#fff',
                border: '3px solid #F9FAFB',
                boxShadow: '0 4px 12px rgba(15, 107, 79, 0.2)',
              }}>
                {(items[currentIdx]?.name || '?')[0].toUpperCase()}
              </div>
              
              <div style={{ textAlign: 'left' }}>
                <p style={{
                  margin: 0,
                  fontSize: 15.5,
                  fontWeight: 800,
                  color: 'var(--s-text)',
                  fontFamily: 'var(--s-font)',
                }}>
                  {items[currentIdx]?.name}
                </p>
                {items[currentIdx]?.location && (
                  <p style={{
                    margin: '2px 0 0',
                    fontSize: 13,
                    color: 'var(--s-text2)',
                    fontFamily: 'var(--s-font)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <MapPin size={12} />
                    {items[currentIdx].location}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          {items.length > 1 && (
            <>
              <button
                onClick={goPrev}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '2px solid #E5E7EB',
                  backgroundColor: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--s-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--s-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.backgroundColor = '#fff';
                }}
              >
                <ChevronRight size={20} color="currentColor" style={{ transform: 'rotate(180deg)' }} />
              </button>
              
              <button
                onClick={goNext}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '2px solid #E5E7EB',
                  backgroundColor: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--s-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--s-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.backgroundColor = '#fff';
                }}
              >
                <ChevronRight size={20} color="currentColor" />
              </button>
            </>
          )}
        </div>

        {/* Pagination Dots */}
        {items.length > 1 && (
          <div style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            marginTop: 40,
          }}>
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                style={{
                  width: i === currentIdx ? 32 : 10,
                  height: 10,
                  borderRadius: 5,
                  border: 'none',
                  backgroundColor: i === currentIdx ? 'var(--s-primary)' : '#D1D5DB',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: 0,
                }}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const AiFaqSection = ({ cfg }) => {
  const [open, setOpen] = useState(null);
  return (
    <section style={{ padding: 'clamp(56px, 9vw, 88px) 24px', backgroundColor: '#fff' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <h2 style={{ fontSize: 'clamp(22px, 3.2vw, 34px)', fontWeight: 900, textAlign: 'center', color: 'var(--s-text)', margin: '0 0 40px', letterSpacing: '-0.025em', fontFamily: 'var(--s-font)' }}>
          {cfg.title || 'Questions fréquentes'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(cfg.items || []).map((item, i) => (
            <div key={i} style={{ borderRadius: 14, border: '1.5px solid', overflow: 'hidden', borderColor: open === i ? 'var(--s-primary)' : '#E5E7EB', backgroundColor: open === i ? '#FAFFFE' : '#fff', transition: 'border-color 0.15s, background-color 0.15s' }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--s-text)', fontFamily: 'var(--s-font)', lineHeight: 1.4 }}>{item.question}</span>
                <span style={{ flexShrink: 0 }}>
                  {open === i ? <ChevronUp size={17} color="var(--s-primary)" /> : <ChevronDown size={17} color="#9CA3AF" />}
                </span>
              </button>
              {open === i && (
                <div style={{ padding: '0 22px 20px', fontSize: 14, color: '#4B5563', lineHeight: 1.7, fontFamily: 'var(--s-font)' }}>
                  {item.answer || item.reponse}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── CONTACT CTA ──────────────────────────────────────────────────────────────
const AiContactSection = ({ cfg, store }) => {
  const whatsapp = (cfg.whatsapp || store?.whatsapp || '').replace(/\D/g, '');
  const storeName = store?.name || 'la boutique';
  // Pre-filled WhatsApp message — user can add details after opening
  const waMessage = encodeURIComponent(`Bonjour ${storeName} ! 👋 Je suis intéressé(e) par vos produits et j'aimerais passer une commande.`);
  const waLink = whatsapp ? `https://wa.me/${whatsapp}?text=${waMessage}` : null;
  return (
    <section style={{ padding: 'clamp(64px, 10vw, 100px) 24px', textAlign: 'center', position: 'relative', overflow: 'hidden', backgroundColor: 'var(--s-primary)' }}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.025em', fontFamily: 'var(--s-font)' }}>
          {cfg.title || 'Parlez-nous maintenant'}
        </h2>
        {cfg.subtitle && <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', margin: '0 0 36px', lineHeight: 1.6, fontFamily: 'var(--s-font)' }}>{cfg.subtitle}</p>}
        {cfg.address && <p style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--s-font)' }}>📍 {cfg.address}</p>}
      </div>
    </section>
  );
};

// ─── TEXT (fallback) ──────────────────────────────────────────────────────────
const AiTextSection = ({ cfg }) => (
  <section style={{ padding: 'clamp(48px, 8vw, 72px) 24px', backgroundColor: cfg.backgroundColor || '#fff', textAlign: cfg.alignment || 'left' }}>
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {cfg.title && <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, color: 'var(--s-text)', margin: '0 0 20px', fontFamily: 'var(--s-font)' }}>{cfg.title}</h2>}
      {cfg.content && <p style={{ fontSize: 14.5, color: 'var(--s-text2)', lineHeight: 1.7, fontFamily: 'var(--s-font)', whiteSpace: 'pre-line' }}>{cfg.content.replace(/\*\*/g, '')}</p>}
    </div>
  </section>
);

const AiSpacerSection = ({ cfg }) => (
  <div style={{ height: cfg.height || 40, backgroundColor: cfg.backgroundColor || 'transparent' }} />
);

// ─── Section Renderer ─────────────────────────────────────────────────────────
const SectionRenderer = ({ section, store, products, prefix }) => {
  if (!section?.type) return null;
  const cfg = section.config || {};
  switch (section.type) {
    case 'hero':         return <AiHeroSection cfg={cfg} store={store} prefix={prefix} products={products} />;
    case 'badges':       return <AiBadgesSection cfg={cfg} />;
    case 'features':     return <AiFeaturesSection cfg={cfg} />;
    case 'text':         return <AiTextSection cfg={cfg} />;
    case 'products':     return <AiProductsSection cfg={cfg} products={products} prefix={prefix} store={store} />;
    case 'testimonials': return <AiTestimonialsSection cfg={cfg} />;
    case 'faq':          return <AiFaqSection cfg={cfg} />;
    case 'contact':      return <AiContactSection cfg={cfg} store={store} />;
    case 'spacer':       return <AiSpacerSection cfg={cfg} />;
    default:             return null;
  }
};

// ── Premium Header with glassmorphism ────────────────────────────────────────
const StorefrontHeader = ({ store, cartCount, prefix }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const whatsapp = (store?.whatsapp || '').replace(/\D/g, '');
  const waLink = whatsapp ? `https://wa.me/${whatsapp}` : null;

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, fontFamily: 'var(--s-font)',
        backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.85)' : 'var(--s-bg)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'rgba(0,0,0,0.06)' : 'var(--s-border)'}`,
        boxShadow: scrolled ? '0 4px 16px rgba(0,0,0,0.04)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          
          {/* Logo + Store Name */}
          <a href={`${prefix}/`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', minWidth: 0 }}>
            {store?.logo ? (
              <img src={store.logo} alt={store?.name} style={{ height: 40, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />
            ) : (
              <span style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'var(--s-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                {(store?.name || 'S')[0].toUpperCase()}
              </span>
            )}
            <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--s-text)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {store?.name}
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="hidden md:flex">
            {[
              { label: 'Accueil', href: `${prefix}/` },
              { label: 'Produits', href: `${prefix}/products` },
              { label: 'Contact', href: waLink, external: true },
            ].map(link => link.href ? (
              <a key={link.label} href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener noreferrer' : undefined}
                style={{
                  padding: '8px 16px', borderRadius: 10, fontSize: 14.5, fontWeight: 600,
                  color: 'var(--s-text2)', textDecoration: 'none', fontFamily: 'var(--s-font)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--s-primary)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--s-text2)'; }}
              >{link.label}</a>
            ) : null)}
          </nav>

          {/* Right Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            
            {/* Search Button (expandable) */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              style={{
                width: searchOpen ? 200 : 40, height: 40,
                borderRadius: searchOpen ? 20 : 10,
                border: '1.5px solid var(--s-border)',
                backgroundColor: searchOpen ? '#fff' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: searchOpen ? '0 12px' : 0,
                justifyContent: searchOpen ? 'flex-start' : 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              className="hidden md:flex"
            >
              <Search size={18} color="var(--s-text2)" />
              {searchOpen && (
                <input
                  type="text"
                  placeholder="Rechercher..."
                  autoFocus
                  style={{
                    border: 'none', outline: 'none', flex: 1,
                    fontSize: 14, color: 'var(--s-text)',
                    backgroundColor: 'transparent',
                  }}
                />
              )}
            </button>

            {/* Cart Button */}
            <a href={`${prefix}/checkout`} style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 50,
              border: '2px solid', borderColor: cartCount > 0 ? 'var(--s-primary)' : 'var(--s-border)',
              backgroundColor: cartCount > 0 ? 'var(--s-primary)' : 'transparent',
              color: cartCount > 0 ? '#fff' : 'var(--s-text)',
              textDecoration: 'none',
              fontWeight: 700, fontSize: 14, transition: 'all 0.25s',
              fontFamily: 'var(--s-font)',
              boxShadow: cartCount > 0 ? '0 4px 12px rgba(15, 107, 79, 0.25)' : 'none',
            }}
              onMouseEnter={e => {
                if (cartCount === 0) {
                  e.currentTarget.style.borderColor = 'var(--s-primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(15, 107, 79, 0.05)';
                }
              }}
              onMouseLeave={e => {
                if (cartCount === 0) {
                  e.currentTarget.style.borderColor = 'var(--s-border)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <ShoppingCart size={18} strokeWidth={2.5} />
              {cartCount > 0 && (
                <>
                  <span style={{ display: 'none' }} className="hidden sm:inline">Panier</span>
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 22, height: 22, borderRadius: '50%',
                    backgroundColor: '#EF4444', color: '#fff',
                    fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid #fff',
                  }}>{cartCount}</span>
                </>
              )}
            </a>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                width: 40, height: 40, borderRadius: 10,
                border: '1.5px solid var(--s-border)',
                backgroundColor: mobileMenuOpen ? 'var(--s-primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              className="flex md:hidden"
            >
              {mobileMenuOpen ? (
                <X size={20} color={mobileMenuOpen ? '#fff' : 'var(--s-text)'} />
              ) : (
                <Menu size={20} color="var(--s-text)" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed', top: 70, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 40,
          animation: 'fadeIn 0.2s ease',
        }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '0 0 24px 24px',
              padding: '24px 20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              animation: 'slideDown 0.3s ease',
            }}
          >
            {[
              { label: 'Accueil', href: `${prefix}/`, icon: <Globe size={20} /> },
              { label: 'Produits', href: `${prefix}/products`, icon: <ShoppingBag size={20} /> },
              { label: 'Contact WhatsApp', href: waLink, icon: <Phone size={20} />, external: true },
            ].map(link => link.href ? (
              <a key={link.label} href={link.href} target={link.external ? '_blank' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px', borderRadius: 12,
                  textDecoration: 'none', color: 'var(--s-text)',
                  fontSize: 16, fontWeight: 600,
                  marginBottom: 8,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ color: 'var(--s-primary)' }}>{link.icon}</span>
                {link.label}
              </a>
            ) : null)}
          </div>
        </div>
      )}
    </>
  );
};

// ── Product Card ──────────────────────────────────────────────────────────────
// ─── PRODUCT CARD PREMIUM ─────────────────────────────────────────────────────
const ProductCard = ({ product, prefix, store }) => {
  const [hovered, setHovered] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [wishlist, setWishlist] = useState(false);
  
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const pct = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  
  // Determine badge
  const isNew = product.isNew || false;
  const isHot = product.isHot || product.isFeatured || false;
  
  const handleQuickView = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickViewOpen(true);
  };
  
  const toggleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlist(!wishlist);
  };
  
  return (
    <>
      <a
        href={`${prefix}/product/${product.slug}`}
        style={{ textDecoration: 'none', position: 'relative', display: 'block' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid #F0F0F0',
          boxShadow: hovered ? '0 16px 48px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
          transform: hovered ? 'translateY(-6px)' : 'none',
          transition: 'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          {/* Image Container */}
          <div style={{
            position: 'relative',
            paddingBottom: '100%',
            backgroundColor: '#F9FAFB',
            overflow: 'hidden',
          }}>
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                loading="lazy"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: hovered ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            ) : (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <ShoppingBag size={48} style={{ color: '#D1D5DB' }} />
              </div>
            )}
            
            {/* Badges Container */}
            <div style={{
              position: 'absolute',
              top: 12,
              left: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              {hasDiscount && (
                <span style={{
                  backgroundColor: '#EF4444',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '5px 11px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                }}>
                  <Tag size={12} /> -{pct}%
                </span>
              )}
              
              {isNew && (
                <span style={{
                  backgroundColor: '#10B981',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '5px 11px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                }}>
                  <Sparkles size={12} /> NEW
                </span>
              )}
              
              {isHot && !isNew && (
                <span style={{
                  backgroundColor: '#F59E0B',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '5px 11px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                }}>
                  <Flame size={12} /> HOT
                </span>
              )}
            </div>
            
            {/* Out of stock overlay */}
            {product.stock === 0 && (
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(2px)',
              }}>
                <span style={{
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: '6px 16px',
                  borderRadius: 8,
                }}>
                  Rupture de stock
                </span>
              </div>
            )}
            
            {/* Hover Actions Overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.3s ease',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: 16,
              gap: 12,
              pointerEvents: hovered ? 'auto' : 'none',
            }}>
              {/* Quick View Button */}
              <button
                onClick={handleQuickView}
                style={{
                  backgroundColor: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'var(--s-primary)',
                  fontFamily: 'var(--s-font)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Eye size={16} /> Aperçu rapide
              </button>
              
              {/* Wishlist Button */}
              <button
                onClick={toggleWishlist}
                style={{
                  backgroundColor: wishlist ? '#EF4444' : '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Heart size={18} fill={wishlist ? '#fff' : 'none'} color={wishlist ? '#fff' : 'var(--s-primary)'} />
              </button>
            </div>
          </div>
          
          {/* Product Info */}
          <div style={{ padding: '16px 18px 20px' }}>
            {product.category && (
              <span style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: 'var(--s-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {product.category}
              </span>
            )}
            
            <p style={{
              margin: '6px 0 12px',
              fontWeight: 700,
              fontSize: 15,
              color: 'var(--s-text)',
              lineHeight: 1.4,
              fontFamily: 'var(--s-font)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: 42,
            }}>
              {product.name}
            </p>
            
            {/* Ratings (if available) */}
            {product.rating && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 10,
              }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={13}
                      fill={i < Math.floor(product.rating) ? '#F59E0B' : 'none'}
                      color={i < Math.floor(product.rating) ? '#F59E0B' : '#D1D5DB'}
                    />
                  ))}
                </div>
                {product.reviewCount && (
                  <span style={{
                    fontSize: 11,
                    color: 'var(--s-text2)',
                    fontFamily: 'var(--s-font)',
                  }}>
                    ({product.reviewCount})
                  </span>
                )}
              </div>
            )}
            
            {/* Price */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: 18,
                fontWeight: 900,
                color: 'var(--s-primary)',
                fontFamily: 'var(--s-font)',
              }}>
                {fmt(product.price, product.currency || store?.currency || 'XAF')}
              </span>
              {hasDiscount && (
                <span style={{
                  fontSize: 13,
                  color: '#9CA3AF',
                  textDecoration: 'line-through',
                  fontFamily: 'var(--s-font)',
                }}>
                  {fmt(product.compareAtPrice, product.currency || store?.currency || 'XAF')}
                </span>
              )}
            </div>
          </div>
        </div>
      </a>
      
      {/* Quick View Modal */}
      {quickViewOpen && (
        <QuickViewModal
          product={product}
          store={store}
          prefix={prefix}
          onClose={() => setQuickViewOpen(false)}
        />
      )}
    </>
  );
};

// ─── QUICK VIEW MODAL ─────────────────────────────────────────────────────────
const QuickViewModal = ({ product, store, prefix, onClose }) => {
  const { addToCart } = useStoreCart();
  const [quantity, setQuantity] = useState(1);
  
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  
  const handleAddToCart = () => {
    addToCart(product, quantity);
    onClose();
  };
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 24,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 20,
          maxWidth: 900,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          position: 'relative',
          animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#E5E7EB';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <X size={20} color="#374151" />
        </button>
        
        {/* Content */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 40,
          padding: 40,
        }}>
          {/* Image */}
          <div style={{
            position: 'relative',
            paddingBottom: '100%',
            backgroundColor: '#F9FAFB',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <ShoppingBag size={64} style={{ color: '#D1D5DB' }} />
              </div>
            )}
          </div>
          
          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {product.category && (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--s-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {product.category}
              </span>
            )}
            
            <h2 style={{
              fontSize: 'clamp(22px, 3vw, 28px)',
              fontWeight: 900,
              color: 'var(--s-text)',
              margin: 0,
              lineHeight: 1.3,
              fontFamily: 'var(--s-font)',
            }}>
              {product.name}
            </h2>
            
            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{
                fontSize: 32,
                fontWeight: 900,
                color: 'var(--s-primary)',
                fontFamily: 'var(--s-font)',
              }}>
                {fmt(product.price, product.currency || store?.currency || 'XAF')}
              </span>
              {hasDiscount && (
                <span style={{
                  fontSize: 18,
                  color: '#9CA3AF',
                  textDecoration: 'line-through',
                  fontFamily: 'var(--s-font)',
                }}>
                  {fmt(product.compareAtPrice, product.currency || store?.currency || 'XAF')}
                </span>
              )}
            </div>
            
            {/* Description */}
            {product.description && (
              <p style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: '#6B7280',
                margin: 0,
                fontFamily: 'var(--s-font)',
              }}>
                {product.description}
              </p>
            )}
            
            {/* Stock Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {product.stock > 0 ? (
                <>
                  <CheckCircle size={18} color="#10B981" />
                  <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#10B981',
                    fontFamily: 'var(--s-font)',
                  }}>
                    En stock ({product.stock} disponibles)
                  </span>
                </>
              ) : (
                <>
                  <X size={18} color="#EF4444" />
                  <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#EF4444',
                    fontFamily: 'var(--s-font)',
                  }}>
                    Rupture de stock
                  </span>
                </>
              )}
            </div>
            
            {/* Quantity Selector */}
            {product.stock > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginTop: 10,
              }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--s-text)',
                  fontFamily: 'var(--s-font)',
                }}>
                  Quantité:
                </span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '2px solid #E5E7EB',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    style={{
                      border: 'none',
                      backgroundColor: '#F9FAFB',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: 18,
                      fontWeight: 700,
                      color: 'var(--s-text)',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                  >
                    −
                  </button>
                  <span style={{
                    padding: '8px 24px',
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--s-text)',
                    minWidth: 60,
                    textAlign: 'center',
                    fontFamily: 'var(--s-font)',
                  }}>
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    style={{
                      border: 'none',
                      backgroundColor: '#F9FAFB',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: 18,
                      fontWeight: 700,
                      color: 'var(--s-text)',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: 12,
              marginTop: 20,
            }}>
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                style={{
                  flex: 1,
                  padding: '16px 24px',
                  backgroundColor: product.stock === 0 ? '#D1D5DB' : 'var(--s-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 15,
                  fontFamily: 'var(--s-font)',
                  cursor: product.stock === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'all 0.2s',
                  boxShadow: product.stock === 0 ? 'none' : '0 4px 12px rgba(15, 107, 79, 0.25)',
                }}
                onMouseEnter={e => {
                  if (product.stock > 0) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 107, 79, 0.3)';
                  }
                }}
                onMouseLeave={e => {
                  if (product.stock > 0) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 107, 79, 0.25)';
                  }
                }}
              >
                <ShoppingCart size={18} />
                {product.stock === 0 ? 'Rupture de stock' : 'Ajouter au panier'}
              </button>
              
              <a
                href={`${prefix}/product/${product.slug}`}
                style={{
                  padding: '16px 24px',
                  backgroundColor: '#F3F4F6',
                  color: 'var(--s-text)',
                  border: 'none',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  fontFamily: 'var(--s-font)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E5E7EB'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
              >
                Détails
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Footer ────────────────────────────────────────────────────────────────────
const StorefrontFooter = ({ store, prefix }) => {
  const navigationLinks = [
    { label: 'Accueil', href: `${prefix}/` },
    { label: 'Tous nos produits', href: `${prefix}/products` },
  ];

  return (
    <footer style={{ backgroundColor: 'var(--s-primary)', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--s-font)', marginTop: 0 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px 48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 48 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {store?.logo ? (
              <img src={store.logo} alt={store?.name} style={{ height: 32, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
            ) : (
              <span style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                {(store?.name || 'S')[0]}
              </span>
            )}
            <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{store?.name}</span>
          </div>
          {store?.description && (
            <p style={{ fontSize: 13, lineHeight: 1.65, margin: '0 0 20px', maxWidth: 260, color: 'rgba(255,255,255,0.6)' }}>{store.description}</p>
          )}
        </div>

        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#fff', margin: '0 0 18px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Navigation</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {navigationLinks.map(link => (
              <a key={link.label} href={link.href} style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}>
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#fff', margin: '0 0 18px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contact</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {store?.city && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'rgba(255,255,255,0.6)' }}>
                <MapPin size={14} style={{ flexShrink: 0 }} /> {store.city}{store.country ? `, ${store.country}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            © {new Date().getFullYear()} {store?.name}. Tous droits réservés.
          </p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Politique de confidentialité', href: '#' },
              { label: "Conditions d'utilisation", href: '#' },
            ].map(link => (
              <a key={link.label} href={link.href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}>
                {link.label}
              </a>
            ))}
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              Propulsé par{' '}
              <a href="https://scalor.net" target="_blank" rel="noreferrer" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
                Scalor
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export const StoreAllProducts = () => {
  const { subdomain: paramSubdomain } = useParams();
  const { subdomain: detectedSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = paramSubdomain || detectedSubdomain;
  const prefix = isStoreDomain ? '' : (subdomain ? `/store/${subdomain}` : '');

  const { store, products, error } = useStoreData(subdomain);
  const { cartCount } = useStoreCart(subdomain);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  useEffect(() => {
    if (!store?.name) return;
    const image = getStoreMetaImage(store);
    setDocumentMeta({
      title: `Produits — ${store.name}`,
      description: getStoreMetaDescription(store, `Découvrez tous les produits disponibles chez ${store.name}.`),
      image,
      icon: image,
      siteName: store.name,
      appTitle: store.name,
      type: 'website',
    });
  }, [store]);

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
        *{box-sizing:border-box}
        .s-badges{display:grid;grid-template-columns:1fr}
        .s-badge-item{border-bottom:1px solid #F3F4F6}
        .s-badge-item:last-child{border-bottom:none}
        @media(min-width:560px){.s-badges{grid-template-columns:repeat(2,1fr)}.s-badge-item{border-right:1px solid #F3F4F6;border-bottom:1px solid #F3F4F6}.s-badge-item:nth-child(2n){border-right:none}}
        @media(min-width:900px){.s-badges{grid-template-columns:repeat(4,1fr)}.s-badge-item{border-bottom:none;border-right:1px solid #F3F4F6}.s-badge-item:last-child{border-right:none}}
      `}</style>
      <AnnouncementBar store={store} />
      <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(32px, 6vw, 64px) 24px 80px' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: 'var(--s-text)', margin: '0 0 6px', letterSpacing: '-0.025em', fontFamily: 'var(--s-font)' }}>
            Tous nos produits
          </h1>
          <p style={{ fontSize: 14, color: 'var(--s-text2)', margin: 0 }}>{products.length} article{products.length !== 1 ? 's' : ''} disponible{products.length !== 1 ? 's' : ''}</p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" placeholder="Rechercher un produit..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 220px', padding: '11px 16px', borderRadius: 40, border: '1.5px solid var(--s-border)', fontSize: 14, fontFamily: 'var(--s-font)', color: 'var(--s-text)', backgroundColor: 'var(--s-bg)', outline: 'none' }}
          />
          {categories.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['all', ...categories].map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '8px 18px', borderRadius: 40, border: '1.5px solid', borderColor: activeCategory === cat ? 'var(--s-primary)' : '#E5E7EB', backgroundColor: activeCategory === cat ? 'var(--s-primary)' : '#fff', color: activeCategory === cat ? '#fff' : 'var(--s-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--s-font)', transition: 'all 0.15s' }}>
                  {cat === 'all' ? 'Tout voir' : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <ShoppingBag size={48} style={{ color: '#D1D5DB', marginBottom: 16 }} />
            <p style={{ fontSize: 16, color: 'var(--s-text2)' }}>Aucun produit trouvé.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
            {filtered.map(p => <ProductCard key={p._id} product={p} prefix={prefix} store={store} />)}
          </div>
        )}
      </div>
      <StorefrontFooter store={store} prefix={prefix} />
    </div>
  );
};

// ── Main Storefront ───────────────────────────────────────────────────────────
const PublicStorefront = () => {
  const { subdomain: paramSubdomain } = useParams();
  const { subdomain: detectedSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = paramSubdomain || detectedSubdomain;
  const prefix = isStoreDomain ? '' : (subdomain ? `/store/${subdomain}` : '');

  const { store, sections, products, loading, error } = useStoreData(subdomain);
  const { cartCount } = useStoreCart(subdomain);
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const filtered = activeCategory === 'all' ? products : products.filter(p => p.category === activeCategory);
  const hasSections = Array.isArray(sections) && sections.length > 0;

  useEffect(() => {
    if (!store?.name) return;
    const image = getStoreMetaImage(store);
    setDocumentMeta({
      title: store.name,
      description: getStoreMetaDescription(store),
      image,
      icon: image,
      siteName: store.name,
      appTitle: store.name,
      type: 'website',
    });
  }, [store]);

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
        *{box-sizing:border-box} body{margin:0;padding:0}
        .s-badges{display:grid;grid-template-columns:1fr}
        .s-badge-item{border-bottom:1px solid #F3F4F6}
        .s-badge-item:last-child{border-bottom:none}
        @media(min-width:560px){
          .s-badges{grid-template-columns:repeat(2,1fr)}
          .s-badge-item{border-right:1px solid #F3F4F6;border-bottom:1px solid #F3F4F6}
          .s-badge-item:nth-child(2n){border-right:none}
          .s-badge-item:nth-last-child(-n+2):nth-child(odd),.s-badge-item:last-child{border-bottom:none}
        }
        @media(min-width:900px){
          .s-badges{grid-template-columns:repeat(4,1fr)}
          .s-badge-item{border-bottom:none;border-right:1px solid #F3F4F6}
          .s-badge-item:last-child{border-right:none}
        }
      `}</style>

      <AnnouncementBar store={store} />
      <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />

      {hasSections ? (
        sections.filter(s => s.visible !== false).map(section => (
          <SectionRenderer key={section.id || section.type} section={section} store={store} products={products} prefix={prefix} />
        ))
      ) : (
        <>
          {/* Fallback hero */}
          <section style={{ padding: 'clamp(56px, 10vw, 100px) 24px clamp(48px, 8vw, 80px)', textAlign: 'center', backgroundColor: 'var(--s-primary)' }}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <h1 style={{ fontSize: 'clamp(36px, 7vw, 60px)', fontWeight: 900, lineHeight: 1.08, color: '#fff', margin: '0 0 18px', letterSpacing: '-0.03em', fontFamily: 'var(--s-font)' }}>{store?.name}</h1>
              {store?.description && <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: 'rgba(255,255,255,0.85)', lineHeight: 1.65, margin: '0 0 40px', fontFamily: 'var(--s-font)' }}>{store.description}</p>}
              <a href={`${prefix}/products`} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 34px', borderRadius: 40, backgroundColor: '#fff', color: 'var(--s-primary)', fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                Découvrir nos produits <ArrowRight size={17} />
              </a>
            </div>
          </section>

          {/* Fallback products — 3 max */}
          <section id="products" style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px 80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
              <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 30px)', fontWeight: 800, color: 'var(--s-text)', margin: 0, letterSpacing: '-0.02em', fontFamily: 'var(--s-font)' }}>Nos Produits</h2>
              {categories.length > 1 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['all', ...categories].map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '7px 17px', borderRadius: 40, border: '1.5px solid', borderColor: activeCategory === cat ? 'var(--s-primary)' : 'var(--s-border)', backgroundColor: activeCategory === cat ? 'var(--s-primary)' : 'transparent', color: activeCategory === cat ? '#fff' : 'var(--s-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--s-font)' }}>
                      {cat === 'all' ? 'Tout' : cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
              {filtered.slice(0, 3).map(p => <ProductCard key={p._id} product={p} prefix={prefix} store={store} />)}
            </div>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '72px 20px' }}>
                <p style={{ fontSize: 40, margin: '0 0 14px' }}>🛍️</p>
                <p style={{ color: 'var(--s-text2)', fontSize: 16 }}>Aucun produit disponible pour l'instant.</p>
              </div>
            )}
            {filtered.length > 3 && (
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <a href={`${prefix}/products`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 40, border: '2px solid var(--s-primary)', color: 'var(--s-primary)', fontWeight: 700, fontSize: 14, textDecoration: 'none', fontFamily: 'var(--s-font)' }}>
                  Voir tous les produits <ChevronRight size={16} />
                </a>
              </div>
            )}
          </section>
        </>
      )}

      <StorefrontFooter store={store} prefix={prefix} />
    </div>
  );
};

export default PublicStorefront;
