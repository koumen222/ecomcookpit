import React, { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ShoppingCart, MessageCircle, ArrowRight, ShoppingBag, Star,
  ChevronDown, ChevronUp, Truck, ShieldCheck, Package, RotateCcw,
  Leaf, Heart, Sparkles, Zap, Gift, Users, Globe, Award, Clock,
  MapPin, Mail, X, ChevronRight, Pencil, Phone, CreditCard, Headphones,
  ThumbsUp, BadgeCheck, Timer, Percent, RefreshCw, Shield, CheckCircle,
} from 'lucide-react';
import { useSubdomain } from '../hooks/useSubdomain';
import { prefetchStoreProduct, useStoreData } from '../hooks/useStoreData';
import { useStoreCart } from '../hooks/useStoreCart';
import { setDocumentMeta } from '../utils/pageMeta';
import { preloadStoreCheckoutRoute, preloadStoreProductRoute } from '../utils/routePrefetch';
import TestimonialsCarousel from '../components/TestimonialsCarousel';
import { EditModeProvider, useEditMode } from '../contexts/EditModeContext';
import { EditableWrapper, EditToolbar } from '../components/storefront/EditableWrapper';

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

// ─── ICON SYSTEM ────────────────────────────────────────────────────────────────
// Mapping d'identifiants d'icônes vers les composants Lucide
// Utilisé par le backend pour générer les sections sans emojis
const ICON_COMPONENTS = {
  // Livraison & Expédition
  truck: Truck,
  package: Package,
  timer: Timer,
  clock: Clock,
  
  // Confiance & Sécurité
  shield: Shield,
  'shield-check': ShieldCheck,
  'badge-check': BadgeCheck,
  'check-circle': CheckCircle,
  'thumbs-up': ThumbsUp,
  award: Award,
  
  // Communication
  phone: Phone,
  'message-circle': MessageCircle,
  mail: Mail,
  headphones: Headphones,
  
  // Paiement & Commerce
  'credit-card': CreditCard,
  percent: Percent,
  gift: Gift,
  'shopping-bag': ShoppingBag,
  
  // Nature & Bien-être
  leaf: Leaf,
  heart: Heart,
  sparkles: Sparkles,
  
  // Général
  zap: Zap,
  star: Star,
  users: Users,
  globe: Globe,
  'map-pin': MapPin,
  'rotate-ccw': RotateCcw,
  'refresh-cw': RefreshCw,
};

// Fallback: conversion emoji → icône (pour compatibilité avec les anciennes données)
const EMOJI_TO_ICON = {
  '🚚': 'truck', '🚛': 'truck', '🚀': 'zap',
  '💯': 'shield-check', '✅': 'check-circle', '🔒': 'shield',
  '📱': 'phone', '💬': 'message-circle', '📞': 'phone',
  '📦': 'package', '🛍️': 'shopping-bag', '📫': 'package',
  '🔄': 'rotate-ccw', '↩️': 'rotate-ccw', '🔃': 'refresh-cw',
  '🌿': 'leaf', '🌱': 'leaf', '🍃': 'leaf',
  '💆': 'heart', '💆‍♀️': 'heart', '❤️': 'heart', '💕': 'heart',
  '🌸': 'sparkles', '✨': 'sparkles', '💫': 'sparkles',
  '🌟': 'star', '⭐': 'star', '🏅': 'award',
  '⚡': 'zap', '💡': 'zap',
  '🎁': 'gift', '🎀': 'gift',
  '👥': 'users', '👤': 'users', '🤝': 'users',
  '🌍': 'globe', '🌐': 'globe', '🗺️': 'globe',
  '🏆': 'award', '🥇': 'award',
  '⏰': 'clock', '🕐': 'clock', '⏱️': 'timer',
  '📍': 'map-pin', '🗺': 'map-pin',
  '📧': 'mail', '✉️': 'mail',
  '💳': 'credit-card', '💰': 'credit-card',
  '👍': 'thumbs-up', '🤙': 'phone',
  '🎧': 'headphones', '📞': 'phone',
  '🔥': 'zap', '💥': 'sparkles',
  '%': 'percent', '🏷️': 'percent',
};

// Résoudre une icône (accepte emoji, identifiant, ou composant)
function resolveIcon(iconValue) {
  if (!iconValue) return null;
  
  // Si c'est déjà un composant React
  if (typeof iconValue === 'function') return iconValue;
  
  // Si c'est un identifiant d'icône
  if (ICON_COMPONENTS[iconValue]) return ICON_COMPONENTS[iconValue];
  
  // Si c'est un emoji, convertir en identifiant puis en composant
  const iconId = EMOJI_TO_ICON[iconValue] || EMOJI_TO_ICON[iconValue?.trim()];
  if (iconId) return ICON_COMPONENTS[iconId];
  
  return null;
}

// Single tint box — uses store primary color via CSS color-mix
const ICON_BG = 'color-mix(in srgb, var(--s-primary) 12%, white)';

/**
 * IconBox - Affiche une icône dans une boîte stylée
 * @param {string|function} icon - Identifiant d'icône, emoji (legacy), ou composant Lucide
 * @param {number} size - Taille de l'icône (défaut: 22)
 * @param {string} bg - Couleur de fond (défaut: teinte de la couleur primaire)
 * @param {number} boxSize - Taille de la boîte (défaut: 52)
 * @param {number} radius - Border radius (défaut: 16)
 */
function IconBox({ icon, emoji, size = 22, bg, boxSize = 52, radius = 16 }) {
  const boxBg = bg || ICON_BG;
  // Supporter l'ancienne prop "emoji" pour compatibilité
  const iconValue = icon || emoji;
  const Icon = resolveIcon(iconValue);
  
  return (
    <div style={{
      width: boxSize, height: boxSize, borderRadius: radius, flexShrink: 0,
      backgroundColor: boxBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {Icon ? (
        <Icon size={size} color="var(--s-primary)" strokeWidth={2} />
      ) : (
        // Fallback: afficher le texte brut si aucune icône trouvée
        <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{iconValue}</span>
      )}
    </div>
  );
}

// ─── ANNOUNCEMENT BAR ─────────────────────────────────────────────────────────
const AnnouncementBar = ({ store }) => {
  const [visible, setVisible] = useState(true);
  // Default announcement sans emojis - utilise des icônes intégrées
  const defaultAnnouncement = 'Livraison rapide · Paiement à la livraison · Retours faciles';
  const msg = store?.announcementText || defaultAnnouncement;
  if (!visible) return null;
  return (
    <div style={{
      background: 'var(--s-primary)', color: '#fff',
      fontSize: 13, fontWeight: 500, fontFamily: 'var(--s-font)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '9px 48px 9px 16px', textAlign: 'center',
      position: 'relative', lineHeight: 1.4, letterSpacing: '0.01em',
    }}>
      <Truck size={14} style={{ opacity: 0.9 }} />
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
            <Link to={`${prefix}/products`}
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
            >{cfg.ctaText || 'Découvrir nos produits'} <ArrowRight size={17} /></Link>
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
    <Link to={`${prefix}/products`}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 44px rgba(0,0,0,0.28)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(0,0,0,0.22)'; }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '17px 40px', borderRadius: 50,
        backgroundColor: '#fff', color: 'var(--s-primary)',
        fontWeight: 800, fontSize: 15.5, textDecoration: 'none',
        letterSpacing: '-0.01em', fontFamily: 'var(--s-font)',
        boxShadow: '0 6px 30px rgba(0,0,0,0.22)', transition: 'transform 0.15s, box-shadow 0.15s',
      }}>{cfg.ctaText || 'Découvrir'} <ArrowRight size={18} /></Link>
  </div>
);

// ─── BADGES (trust strip) ──────────────────────────────────────────────────────
const AiBadgesSection = ({ cfg }) => (
  <section style={{ backgroundColor: '#fff', borderBottom: '1px solid #F3F4F6' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
      <div className="s-badges">
        {(cfg.items || []).map((badge, i) => (
          <div key={i} className="s-badge-item" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 20px' }}>
            <IconBox icon={badge.icon} size={20} boxSize={46} radius={14} />
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
          ) : displayed.map(p => <ProductCard key={p._id} product={p} prefix={prefix} store={store} subdomain={store?.subdomain} />)}
        </div>
        {products.length > limit && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link to={`${prefix}/products`} style={{
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
            </Link>
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
            <IconBox icon={f.icon} size={22} boxSize={52} radius={16} />
            <h3 style={{ margin: '18px 0 10px', fontSize: 15.5, fontWeight: 700, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>{f.title}</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--s-text2)', lineHeight: 1.65, fontFamily: 'var(--s-font)' }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── TESTIMONIALS ──────────────────────────────────────────────────────────────
const AiTestimonialsSection = ({ cfg }) => {
  // Normaliser les données pour le composant TestimonialsCarousel
  const testimonials = (cfg.items || []).map(t => ({
    name: t.name,
    location: t.location,
    text: t.content || t.text,
    comment: t.content || t.text,
    rating: t.rating || 5,
    image: t.image,
    verified: t.verified !== false, // Par défaut vérifié
    date: t.date
  }));

  return (
    <section style={{ padding: 'clamp(56px, 9vw, 88px) 24px', backgroundColor: '#F9FAFB' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <TestimonialsCarousel testimonials={testimonials} autoPlay={true} />
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
  // Pre-filled WhatsApp message
  const waMessage = encodeURIComponent(`Bonjour ${storeName} ! Je suis intéressé(e) par vos produits et j'aimerais passer une commande.`);
  const waLink = whatsapp ? `https://wa.me/${whatsapp}?text=${waMessage}` : null;
  return (
    <section style={{ padding: 'clamp(64px, 10vw, 100px) 24px', textAlign: 'center', position: 'relative', overflow: 'hidden', backgroundColor: 'var(--s-primary)' }}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.025em', fontFamily: 'var(--s-font)' }}>
          {cfg.title || 'Parlez-nous maintenant'}
        </h2>
        {cfg.subtitle && <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', margin: '0 0 36px', lineHeight: 1.6, fontFamily: 'var(--s-font)' }}>{cfg.subtitle}</p>}
        {cfg.address && (
          <p style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--s-font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <MapPin size={14} /> {cfg.address}
          </p>
        )}
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

// Labels lisibles pour les types de sections
const SECTION_TYPE_LABELS = {
  hero: 'Hero',
  badges: 'Badges',
  features: 'Avantages',
  text: 'Texte',
  products: 'Produits',
  testimonials: 'Témoignages',
  faq: 'FAQ',
  contact: 'Contact',
  spacer: 'Espacement',
};

// ─── Section Renderer ─────────────────────────────────────────────────────────
const SectionRenderer = ({ section, store, products, prefix }) => {
  if (!section?.type) return null;
  const cfg = section.config || {};
  const sectionId = section.id || section.type;
  const sectionLabel = SECTION_TYPE_LABELS[section.type] || section.type;

  const renderSection = () => {
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

  return (
    <EditableWrapper
      sectionId={sectionId}
      sectionType={sectionLabel}
      sectionData={section}
      canReorder={section.type !== 'hero'}
      canDelete={section.type !== 'hero' && section.type !== 'products'}
      canHide={section.type !== 'hero'}
    >
      {renderSection()}
    </EditableWrapper>
  );
};

// ── Header Premium avec Glassmorphism ─────────────────────────────────────────
const StorefrontHeader = ({ store, cartCount, prefix }) => {
  const { isEditMode, canEdit, toggleEditMode } = useEditMode();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  const prevCartCount = React.useRef(cartCount);

  // Détecter le scroll pour l'effet glassmorphism
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animation du panier quand le nombre change
  useEffect(() => {
    if (cartCount > prevCartCount.current) {
      setCartBounce(true);
      const timer = setTimeout(() => setCartBounce(false), 300);
      return () => clearTimeout(timer);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  const navLinks = [
    { label: 'Accueil', href: `${prefix}/` },
    { label: 'Produits', href: `${prefix}/products` },
  ];

  return (
    <>
      <header 
        style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 50, 
          fontFamily: 'var(--s-font)',
          transition: 'all 0.3s ease',
          backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.85)' : 'var(--s-bg)',
          backdropFilter: scrolled ? 'blur(12px) saturate(180%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px) saturate(180%)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--s-border)',
          boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.06)' : 'none',
        }}
      >
        {/* Bannière Mode Édition */}
        {isEditMode && (
          <div style={{
            backgroundColor: '#3B82F6',
            color: '#fff',
            padding: '8px 24px',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <Pencil size={14} />
            Mode Édition actif — Survolez une section pour la modifier
          </div>
        )}

        <div style={{ 
          maxWidth: 1200, 
          margin: '0 auto', 
          padding: '0 24px', 
          height: scrolled ? 56 : 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          transition: 'height 0.3s ease',
        }}>
          {/* Logo */}
          <Link 
            to={`${prefix}/`} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12, 
              textDecoration: 'none',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {store?.logo ? (
              <img 
                src={store.logo} 
                alt={store?.name} 
                style={{ 
                  height: scrolled ? 32 : 36, 
                  width: 'auto', 
                  maxWidth: 120, 
                  objectFit: 'contain',
                  transition: 'height 0.3s ease',
                }} 
              />
            ) : (
              <span style={{ 
                width: scrolled ? 32 : 36, 
                height: scrolled ? 32 : 36, 
                borderRadius: 10, 
                backgroundColor: 'var(--s-primary)', 
                color: '#fff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 800, 
                fontSize: scrolled ? 14 : 16, 
                flexShrink: 0,
                transition: 'all 0.3s ease',
              }}>
                {(store?.name || 'S')[0].toUpperCase()}
              </span>
            )}
            <span style={{ 
              fontWeight: 700, 
              fontSize: scrolled ? 16 : 17, 
              color: 'var(--s-text)', 
              letterSpacing: '-0.01em',
              transition: 'font-size 0.3s ease',
            }}>
              {store?.name}
            </span>
          </Link>

          {/* Navigation Desktop */}
          <nav className="desktop-nav" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6,
          }}>
            {navLinks.map(link => (
              <Link 
                key={link.label} 
                to={link.href} 
                style={{
                  padding: '8px 16px', 
                  borderRadius: 8, 
                  fontSize: 14, 
                  fontWeight: 600,
                  color: 'var(--s-text2)', 
                  textDecoration: 'none', 
                  fontFamily: 'var(--s-font)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => { 
                  e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; 
                  e.currentTarget.style.color = 'var(--s-text)'; 
                }}
                onMouseLeave={e => { 
                  e.currentTarget.style.background = 'transparent'; 
                  e.currentTarget.style.color = 'var(--s-text2)'; 
                }}
              >
                {link.label}
              </Link>
            ))}
            
            {/* Bouton Mode Édition (visible pour owner) */}
            {canEdit && (
              <button
                onClick={toggleEditMode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: isEditMode ? '2px solid #3B82F6' : '1.5px solid var(--s-border)',
                  backgroundColor: isEditMode ? '#EFF6FF' : 'transparent',
                  color: isEditMode ? '#3B82F6' : 'var(--s-text2)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--s-font)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  if (!isEditMode) {
                    e.currentTarget.style.backgroundColor = '#F3F4F6';
                    e.currentTarget.style.borderColor = '#D1D5DB';
                  }
                }}
                onMouseLeave={e => {
                  if (!isEditMode) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--s-border)';
                  }
                }}
              >
                <Pencil size={14} />
                {isEditMode ? 'Édition' : 'Modifier'}
              </button>
            )}
            
            {/* Panier avec animation */}
            <Link 
              to={`${prefix}/checkout`} 
              style={{
                display: 'flex', 
                alignItems: 'center', 
                gap: 7, 
                padding: '8px 18px', 
                borderRadius: 40,
                border: '1.5px solid', 
                borderColor: cartCount > 0 ? 'var(--s-primary)' : 'var(--s-border)',
                backgroundColor: cartCount > 0 ? 'var(--s-primary)' : 'transparent',
                color: cartCount > 0 ? '#fff' : 'var(--s-text)', 
                textDecoration: 'none',
                fontWeight: 600, 
                fontSize: 14, 
                transition: 'all 0.2s ease', 
                fontFamily: 'var(--s-font)', 
                marginLeft: 8,
                transform: cartBounce ? 'scale(1.1)' : 'scale(1)',
              }} 
              onMouseEnter={e => {
                if (cartCount === 0) {
                  e.currentTarget.style.backgroundColor = '#F3F4F6';
                  e.currentTarget.style.borderColor = '#D1D5DB';
                } else {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={e => {
                if (cartCount === 0) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--s-border)';
                } else {
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
              onFocus={preloadStoreCheckoutRoute} 
              onTouchStart={preloadStoreCheckoutRoute}
            >
              <ShoppingCart size={17} />
              {cartCount > 0 && (
                <span style={{ 
                  minWidth: 18, 
                  textAlign: 'center',
                  animation: cartBounce ? 'cartPop 0.3s ease' : 'none',
                }}>
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Menu Hamburger Mobile */}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'none',
                padding: 8,
                borderRadius: 8,
                border: 'none',
                backgroundColor: mobileMenuOpen ? '#F3F4F6' : 'transparent',
                cursor: 'pointer',
                marginLeft: 8,
              }}
              aria-label="Menu"
            >
              <div style={{
                width: 20,
                height: 14,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  display: 'block',
                  width: '100%',
                  height: 2,
                  backgroundColor: 'var(--s-text)',
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  transform: mobileMenuOpen ? 'rotate(45deg) translateY(6px)' : 'none',
                }} />
                <span style={{
                  display: 'block',
                  width: '100%',
                  height: 2,
                  backgroundColor: 'var(--s-text)',
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  opacity: mobileMenuOpen ? 0 : 1,
                }} />
                <span style={{
                  display: 'block',
                  width: '100%',
                  height: 2,
                  backgroundColor: 'var(--s-text)',
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-6px)' : 'none',
                }} />
              </div>
            </button>
          </nav>
        </div>
      </header>

      {/* Menu Mobile Drawer */}
      {mobileMenuOpen && (
        <div 
          className="mobile-menu-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            top: isEditMode ? 108 : 64,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 40,
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div 
        className="mobile-menu-drawer"
        style={{
          position: 'fixed',
          top: isEditMode ? 108 : 64,
          right: 0,
          width: '280px',
          maxWidth: '80vw',
          height: `calc(100vh - ${isEditMode ? 108 : 64}px)`,
          backgroundColor: '#fff',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 45,
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {navLinks.map(link => (
          <Link 
            key={link.label} 
            to={link.href} 
            onClick={() => setMobileMenuOpen(false)}
            style={{
              padding: '14px 16px', 
              borderRadius: 12, 
              fontSize: 16, 
              fontWeight: 600,
              color: 'var(--s-text)', 
              textDecoration: 'none', 
              fontFamily: 'var(--s-font)',
              backgroundColor: '#F9FAFB',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {link.label}
          </Link>
        ))}
        
        <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid #E5E7EB' }}>
          <Link 
            to={`${prefix}/checkout`}
            onClick={() => setMobileMenuOpen(false)}
            style={{
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 10, 
              padding: '14px 20px', 
              borderRadius: 40,
              backgroundColor: 'var(--s-primary)',
              color: '#fff', 
              textDecoration: 'none',
              fontWeight: 700, 
              fontSize: 15, 
              fontFamily: 'var(--s-font)',
            }}
          >
            <ShoppingCart size={18} />
            Voir mon panier {cartCount > 0 && `(${cartCount})`}
          </Link>
        </div>
      </div>

      {/* Styles CSS pour responsive et animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cartPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @media (max-width: 768px) {
          .desktop-nav > a:not([href*="checkout"]) { display: none !important; }
          .desktop-nav > button { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu-overlay, .mobile-menu-drawer { display: none !important; }
        }
      `}</style>
    </>
  );
};

// ── Product Card ──────────────────────────────────────────────────────────────
const ProductCard = ({ product, prefix, store, subdomain }) => {
  const [hovered, setHovered] = useState(false);
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const pct = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const handlePrefetch = () => {
    preloadStoreProductRoute();
    if (subdomain && product?.slug) {
      prefetchStoreProduct(subdomain, product.slug);
    }
  };

  return (
    <Link to={`${prefix}/product/${product.slug}`} style={{ textDecoration: 'none' }}
      onMouseEnter={() => { setHovered(true); handlePrefetch(); }} onMouseLeave={() => setHovered(false)} onFocus={handlePrefetch} onTouchStart={handlePrefetch}>
      <div style={{ backgroundColor: 'var(--s-bg)', overflow: 'hidden', border: '1px solid var(--s-border)', boxShadow: hovered ? '0 12px 36px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.05)', transform: hovered ? 'translateY(-3px)' : 'none', transition: 'box-shadow 0.25s, transform 0.25s' }}>
        <div style={{ position: 'relative', paddingBottom: '100%', backgroundColor: '#f4f4f5', overflow: 'hidden' }}>
          {product.image ? (
            <img src={product.image} alt={product.name} loading="lazy" decoding="async" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: hovered ? 'scale(1.05)' : 'scale(1)', transition: 'transform 0.4s ease' }} />
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
    </Link>
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
              <Link key={link.label} to={link.href} style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}>
                {link.label}
              </Link>
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
        <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <ShoppingBag size={32} color="#9CA3AF" />
        </div>
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
            {filtered.map(p => <ProductCard key={p._id} product={p} prefix={prefix} store={store} subdomain={store?.subdomain} />)}
          </div>
        )}
      </div>
      <StorefrontFooter store={store} prefix={prefix} />
    </div>
  );
};

// ── Main Storefront ───────────────────────────────────────────────────────────
const PublicStorefrontInner = () => {
  const { subdomain: paramSubdomain } = useParams();
  const [searchParams] = useSearchParams();
  const { subdomain: detectedSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = paramSubdomain || detectedSubdomain;
  const prefix = isStoreDomain ? '' : (subdomain ? `/store/${subdomain}` : '');

  const { store, sections, products, loading, error } = useStoreData(subdomain);
  const { cartCount } = useStoreCart(subdomain);
  const { isEditMode } = useEditMode();
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
        <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <ShoppingBag size={32} color="#9CA3AF" />
        </div>
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
        sections.filter(s => isEditMode || s.visible !== false).map(section => (
          <SectionRenderer key={section.id || section.type} section={section} store={store} products={products} prefix={prefix} />
        ))
      ) : (
        <>
          {/* Fallback hero */}
          <section style={{ padding: 'clamp(56px, 10vw, 100px) 24px clamp(48px, 8vw, 80px)', textAlign: 'center', backgroundColor: 'var(--s-primary)' }}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <h1 style={{ fontSize: 'clamp(36px, 7vw, 60px)', fontWeight: 900, lineHeight: 1.08, color: '#fff', margin: '0 0 18px', letterSpacing: '-0.03em', fontFamily: 'var(--s-font)' }}>{store?.name}</h1>
              {store?.description && <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: 'rgba(255,255,255,0.85)', lineHeight: 1.65, margin: '0 0 40px', fontFamily: 'var(--s-font)' }}>{store.description}</p>}
              <Link to={`${prefix}/products`} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 34px', borderRadius: 40, backgroundColor: '#fff', color: 'var(--s-primary)', fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                Découvrir nos produits <ArrowRight size={17} />
              </Link>
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
              {filtered.slice(0, 3).map(p => <ProductCard key={p._id} product={p} prefix={prefix} store={store} subdomain={store?.subdomain} />)}
            </div>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '72px 20px' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <ShoppingBag size={28} color="#9CA3AF" />
                </div>
                <p style={{ color: 'var(--s-text2)', fontSize: 16 }}>Aucun produit disponible pour l'instant.</p>
              </div>
            )}
            {filtered.length > 3 && (
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <Link to={`${prefix}/products`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 40, border: '2px solid var(--s-primary)', color: 'var(--s-primary)', fontWeight: 700, fontSize: 14, textDecoration: 'none', fontFamily: 'var(--s-font)' }}>
                  Voir tous les produits <ChevronRight size={16} />
                </Link>
              </div>
            )}
          </section>
        </>
      )}

      <StorefrontFooter store={store} prefix={prefix} />
      
      {/* Toolbar d'édition (visible quand mode édition actif) */}
      <EditToolbar />
    </div>
  );
};

/**
 * PublicStorefront - Composant principal avec EditModeProvider
 * 
 * Le mode édition est activé via le paramètre URL ?edit=true
 * ou si l'utilisateur est authentifié comme propriétaire.
 */
const PublicStorefront = () => {
  const { subdomain: paramSubdomain } = useParams();
  const [searchParams] = useSearchParams();
  const { subdomain: detectedSubdomain } = useSubdomain();
  const subdomain = paramSubdomain || detectedSubdomain;
  
  // Vérifier si on est en mode édition via URL (pour le propriétaire connecté)
  const editParam = searchParams.get('edit') === 'true';
  
  // TODO: Intégrer avec useEcomAuth pour vérifier si l'utilisateur est le propriétaire
  // Pour l'instant, on permet l'édition si le paramètre ?edit=true est présent
  const isOwner = editParam;

  return (
    <EditModeProvider storeId={subdomain} isOwner={isOwner}>
      <PublicStorefrontInner />
    </EditModeProvider>
  );
};

export default PublicStorefront;
