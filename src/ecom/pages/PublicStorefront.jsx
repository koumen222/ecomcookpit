import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShoppingCart, MessageCircle, ArrowRight, ShoppingBag, Star,
  ChevronDown, ChevronUp, Truck, ShieldCheck, Package, RotateCcw,
  Leaf, Heart, Sparkles, Zap, Gift, Users, Globe, Award, Clock,
  MapPin, Mail, X, ChevronRight,
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

// ─── EMOJI → LUCIDE mapping ───────────────────────────────────────────────────
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
};

// Single tint box — uses store primary color via CSS color-mix
const ICON_BG = 'color-mix(in srgb, var(--s-primary) 12%, white)';

function IconBox({ emoji, size = 22, bg, boxSize = 52, radius = 16 }) {
  const boxBg = bg || ICON_BG;
  const Icon = EMOJI_ICON_MAP[emoji] || EMOJI_ICON_MAP[emoji?.trim()];
  return (
    <div style={{
      width: boxSize, height: boxSize, borderRadius: radius, flexShrink: 0,
      backgroundColor: boxBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {Icon
        ? <Icon size={size} color="var(--s-primary)" strokeWidth={2} />
        : <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{emoji}</span>}
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

// ─── HERO ─────────────────────────────────────────────────────────────────────
const AiHeroSection = ({ cfg, store, prefix, products }) => {
  const heroImg = cfg.backgroundImage || null;
  const featuredProduct = products?.find(p => p.image) || null;
  const isSplit = !heroImg && featuredProduct;

  if (heroImg) {
    // Full-width image hero with flat dark overlay
    return (
      <section style={{
        padding: 'clamp(80px, 14vw, 140px) 24px clamp(64px, 10vw, 110px)',
        textAlign: cfg.alignment || 'center', position: 'relative', overflow: 'hidden',
        backgroundImage: `url(${heroImg})`, backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        {/* flat dark overlay — no gradient */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.52)', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <HeroContent cfg={cfg} prefix={prefix} />
        </div>
      </section>
    );
  }

  if (isSplit) {
    // Split: text left, product image right
    return (
      <section style={{
        backgroundColor: 'var(--s-primary)',
        position: 'relative', overflow: 'hidden',
        padding: 'clamp(60px, 10vw, 100px) 24px',
      }}>
        <div style={{ position: 'absolute', top: -80, left: -80, width: 320, height: 320, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 240, height: 240, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 48, position: 'relative', zIndex: 1 }}>
          {/* Text */}
          <div style={{ flex: '1 1 280px' }}>
            {store?.logo && (
              <img src={store.logo} alt={store.name} style={{ height: 48, width: 'auto', objectFit: 'contain', marginBottom: 28, filter: 'brightness(0) invert(1)' }} />
            )}
            <h1 style={{
              fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.05,
              margin: '0 0 20px', letterSpacing: '-0.035em', fontFamily: 'var(--s-font)',
              color: '#fff', textShadow: '0 2px 24px rgba(0,0,0,0.15)',
            }}>{cfg.title}</h1>
            {cfg.subtitle && (
              <p style={{
                fontSize: 'clamp(15px, 2vw, 19px)', lineHeight: 1.6, margin: '0 0 40px',
                color: 'rgba(255,255,255,0.88)', fontFamily: 'var(--s-font)',
              }}>{cfg.subtitle}</p>
            )}
            <a href={`${prefix}/products`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '16px 36px', borderRadius: 50,
                backgroundColor: '#fff', color: 'var(--s-primary)',
                fontWeight: 800, fontSize: 15, textDecoration: 'none',
                letterSpacing: '-0.01em', fontFamily: 'var(--s-font)',
                boxShadow: '0 6px 30px rgba(0,0,0,0.20)', transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 44px rgba(0,0,0,0.28)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(0,0,0,0.20)'; }}
            >{cfg.ctaText || 'Découvrir nos produits'} <ArrowRight size={17} /></a>
          </div>
          {/* Product image */}
          <div style={{ flex: '1 1 260px', maxWidth: 420, margin: '0 auto' }}>
            <div style={{
              borderRadius: 24, overflow: 'hidden', aspectRatio: '1/1',
              boxShadow: '0 24px 64px rgba(0,0,0,0.30)',
              border: '4px solid rgba(255,255,255,0.25)',
            }}>
              <img src={featuredProduct.image} alt={featuredProduct.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Gradient only
  return (
    <section style={{
      padding: 'clamp(80px, 13vw, 130px) 24px clamp(64px, 10vw, 110px)',
      textAlign: cfg.alignment || 'center', position: 'relative', overflow: 'hidden',
      backgroundColor: 'var(--s-primary)',
    }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 740, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {store?.logo && (
          <img src={store.logo} alt={store.name} style={{ height: 56, width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 32px', filter: 'brightness(0) invert(1)' }} />
        )}
        <HeroContent cfg={cfg} prefix={prefix} />
      </div>
    </section>
  );
};

const HeroContent = ({ cfg, prefix }) => (
  <div style={{ position: 'relative', zIndex: 1 }}>
    <h1 style={{
      fontSize: 'clamp(38px, 7vw, 72px)', fontWeight: 900, lineHeight: 1.04,
      margin: '0 0 22px', letterSpacing: '-0.035em', fontFamily: 'var(--s-font)',
      color: '#fff', textShadow: '0 2px 24px rgba(0,0,0,0.18)',
    }}>{cfg.title}</h1>
    {cfg.subtitle && (
      <p style={{
        fontSize: 'clamp(16px, 2.2vw, 20px)', lineHeight: 1.6, margin: '0 0 44px',
        color: 'rgba(255,255,255,0.88)', fontFamily: 'var(--s-font)', maxWidth: 580, marginLeft: 'auto', marginRight: 'auto',
      }}>{cfg.subtitle}</p>
    )}
    <a href={`${prefix}/products`}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 44px rgba(0,0,0,0.28)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(0,0,0,0.22)'; }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '17px 40px', borderRadius: 50,
        backgroundColor: '#fff', color: 'var(--s-primary)',
        fontWeight: 800, fontSize: 15.5, textDecoration: 'none',
        letterSpacing: '-0.01em', fontFamily: 'var(--s-font)',
        boxShadow: '0 6px 30px rgba(0,0,0,0.22)', transition: 'transform 0.15s, box-shadow 0.15s',
      }}>{cfg.ctaText || 'Découvrir'} <ArrowRight size={18} /></a>
  </div>
);

// ─── BADGES (trust strip) ──────────────────────────────────────────────────────
const AiBadgesSection = ({ cfg }) => (
  <section style={{ backgroundColor: '#fff', borderBottom: '1px solid #F3F4F6' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
      <div className="s-badges">
        {(cfg.items || []).map((badge, i) => (
          <div key={i} className="s-badge-item" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 20px' }}>
            <IconBox emoji={badge.icon} size={20} boxSize={46} radius={14} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>{badge.title}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--s-text2)', lineHeight: 1.4, fontFamily: 'var(--s-font)' }}>{badge.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

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
const AiTestimonialsSection = ({ cfg }) => (
  <section style={{ padding: 'clamp(56px, 9vw, 88px) 24px', backgroundColor: '#F9FAFB' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ fontSize: 'clamp(22px, 3.2vw, 34px)', fontWeight: 900, textAlign: 'center', color: 'var(--s-text)', margin: '0 0 44px', letterSpacing: '-0.025em', fontFamily: 'var(--s-font)' }}>
        {cfg.title || 'Ce que disent nos clients'}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {(cfg.items || []).map((t, i) => (
          <div key={i} style={{ backgroundColor: '#fff', borderRadius: 20, padding: '28px 26px', border: '1px solid #EBEBEB', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
              {Array.from({ length: t.rating || 5 }).map((_, j) => <Star key={j} size={15} fill="var(--s-primary)" color="var(--s-primary)" />)}
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#374151', margin: '0 0 20px', fontFamily: 'var(--s-font)', fontStyle: 'italic' }}>"{t.content || t.text}"</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, backgroundColor: 'var(--s-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff' }}>
                {(t.name || '?')[0]}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>{t.name}</p>
                {t.location && <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}>📍 {t.location}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

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

// ── Header ────────────────────────────────────────────────────────────────────
const StorefrontHeader = ({ store, cartCount, prefix }) => (
  <header style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'var(--s-bg)', borderBottom: '1px solid var(--s-border)', fontFamily: 'var(--s-font)' }}>
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <a href={`${prefix}/`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        {store?.logo ? (
          <img src={store.logo} alt={store?.name} style={{ height: 36, width: 'auto', maxWidth: 120, objectFit: 'contain' }} />
        ) : (
          <span style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'var(--s-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
            {(store?.name || 'S')[0].toUpperCase()}
          </span>
        )}
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--s-text)', letterSpacing: '-0.01em' }}>{store?.name}</span>
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {[
          { label: 'Accueil', href: `${prefix}/` },
          { label: 'Produits', href: `${prefix}/products` },
        ].map(link => (
          <a key={link.label} href={link.href} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            color: 'var(--s-text2)', textDecoration: 'none', fontFamily: 'var(--s-font)',
            transition: 'background 0.15s, color 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = 'var(--s-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--s-text2)'; }}
          >{link.label}</a>
        ))}
        <a href={`${prefix}/checkout`} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 40,
          border: '1.5px solid', borderColor: cartCount > 0 ? 'var(--s-primary)' : 'var(--s-border)',
          backgroundColor: cartCount > 0 ? 'var(--s-primary)' : 'transparent',
          color: cartCount > 0 ? '#fff' : 'var(--s-text)', textDecoration: 'none',
          fontWeight: 600, fontSize: 14, transition: 'all 0.2s', fontFamily: 'var(--s-font)', marginLeft: 8,
        }}>
          <ShoppingCart size={17} />
          {cartCount > 0 && <span>{cartCount}</span>}
        </a>
      </nav>
    </div>
  </header>
);

// ── Product Card ──────────────────────────────────────────────────────────────
const ProductCard = ({ product, prefix, store }) => {
  const [hovered, setHovered] = useState(false);
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const pct = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  return (
    <a href={`${prefix}/product/${product.slug}`} style={{ textDecoration: 'none' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{ backgroundColor: 'var(--s-bg)', overflow: 'hidden', border: '1px solid var(--s-border)', boxShadow: hovered ? '0 12px 36px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.05)', transform: hovered ? 'translateY(-3px)' : 'none', transition: 'box-shadow 0.25s, transform 0.25s' }}>
        <div style={{ position: 'relative', paddingBottom: '100%', backgroundColor: '#f4f4f5', overflow: 'hidden' }}>
          {product.image ? (
            <img src={product.image} alt={product.name} loading="eager" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: hovered ? 'scale(1.05)' : 'scale(1)', transition: 'transform 0.4s ease' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={40} style={{ color: '#d1d5db' }} />
            </div>
          )}
          {hasDiscount && <span style={{ position: 'absolute', top: 10, left: 10, backgroundColor: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>-{pct}%</span>}
          {product.stock === 0 && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: 20 }}>Rupture de stock</span>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 16px 18px' }}>
          {product.category && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--s-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{product.category}</span>}
          <p style={{ margin: '5px 0 10px', fontWeight: 600, fontSize: 14.5, color: 'var(--s-text)', lineHeight: 1.35, fontFamily: 'var(--s-font)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{product.name}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--s-primary)', fontFamily: 'var(--s-font)' }}>{fmt(product.price, product.currency || store?.currency || 'XAF')}</span>
            {hasDiscount && <span style={{ fontSize: 12, color: 'var(--s-text2)', textDecoration: 'line-through' }}>{fmt(product.compareAtPrice, product.currency || store?.currency || 'XAF')}</span>}
          </div>
        </div>
      </div>
    </a>
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
