import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ShoppingCart, MessageCircle, ArrowRight, ShoppingBag, Star,
  ChevronDown, ChevronUp, Truck, ShieldCheck, Package, RotateCcw,
  Leaf, Heart, Sparkles, Zap, Gift, Users, Globe, Award, Clock,
  MapPin, Mail, X, ChevronRight, Pencil, Phone, CreditCard, Headphones,
  ThumbsUp, BadgeCheck, Timer, Percent, RefreshCw, Shield, CheckCircle, Check, Menu,
} from 'lucide-react';
import { useSubdomain } from '../hooks/useSubdomain';
import { prefetchStoreProduct, useStoreData } from '../hooks/useStoreData';
import { useStoreCart } from '../hooks/useStoreCart';
import { setDocumentMeta } from '../utils/pageMeta';
import { preloadStoreCheckoutRoute, preloadStoreProductRoute } from '../utils/routePrefetch';
import { normalizeHomepageSections } from '../utils/homepageSections';
import { EditModeProvider, useEditMode } from '../contexts/EditModeContext';
import { EditableWrapper, EditToolbar } from '../components/storefront/EditableWrapper';
import { useStoreAnalytics } from '../hooks/useStoreAnalytics';
import { StorefrontFooter as SharedStorefrontFooter } from '../components/StorefrontShared';
import { formatMoney } from '../utils/currency.js';
import { trackStorefrontEvent } from '../utils/pixelTracking.js';

// Lazy load des sections below-the-fold pour performance
const TestimonialsCarousel = lazy(() => import('../components/TestimonialsCarousel'));

const fmt = (n, cur = 'XAF') => formatMoney(n, cur);

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

const RADIUS_MAP = {
  none: '0px',
  sm: '10px',
  md: '14px',
  lg: '18px',
  xl: '24px',
  full: '999px',
};

const SHADOW_MAP = {
  none: 'none',
  soft: '0 12px 32px rgba(15, 23, 42, 0.08)',
  medium: '0 18px 44px rgba(15, 23, 42, 0.12)',
  strong: '0 28px 64px rgba(15, 23, 42, 0.16)',
};

const resolveThemeRadius = (value, fallback = '20px') => {
  if (typeof value === 'number') return `${value}px`;
  if (!value) return fallback;

  const normalized = String(value).trim().toLowerCase();
  if (RADIUS_MAP[normalized]) return RADIUS_MAP[normalized];
  if (/^\d+$/.test(normalized)) return `${normalized}px`;

  return value;
};

const resolveThemeShadow = (value) => SHADOW_MAP[String(value || 'soft').trim().toLowerCase()] || SHADOW_MAP.soft;

const buildStorefrontThemeVars = (store) => {
  const design = store?.productPageConfig?.design || {};
  const buttonStyle = String(design.buttonStyle || '').trim().toLowerCase();
  const configuredButton = design.ctaButtonColor || design.buttonColor || null;

  let ctaBackground = configuredButton || 'var(--s-primary)';
  let ctaText = configuredButton ? '#ffffff' : '#ffffff';
  let ctaBorder = 'transparent';

  if (buttonStyle === 'outline') {
    ctaBackground = 'transparent';
    ctaText = 'var(--s-primary)';
    ctaBorder = 'var(--s-primary)';
  } else if (buttonStyle === 'soft') {
    ctaBackground = 'color-mix(in srgb, var(--s-primary) 12%, var(--s-bg))';
    ctaText = 'var(--s-primary)';
  } else if (buttonStyle === 'gradient') {
    ctaBackground = 'linear-gradient(135deg, var(--s-primary) 0%, var(--s-accent) 100%)';
    ctaText = '#ffffff';
  }

  return {
    '--sf-radius': resolveThemeRadius(design.borderRadius || store?.borderRadius || '20px'),
    '--sf-shadow': resolveThemeShadow(design.shadow),
    '--sf-surface': 'color-mix(in srgb, var(--s-bg) 94%, white)',
    '--sf-soft-surface': 'color-mix(in srgb, var(--s-primary) 6%, var(--s-bg))',
    '--sf-muted-surface': 'color-mix(in srgb, var(--s-primary) 4%, var(--s-bg))',
    '--sf-border': 'color-mix(in srgb, var(--s-primary) 16%, var(--s-border))',
    '--sf-cta-bg': ctaBackground,
    '--sf-cta-text': ctaText,
    '--sf-cta-border': ctaBorder,
  };
};

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
  '🎧': 'headphones',
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

// ─── EDITABLE TEXT ───────────────────────────────────────────────────────────
/**
 * EditableText - Texte éditable en mode édition
 * En mode normal: affiche le texte
 * En mode édition: affiche un input/textarea inline
 */
const EditableText = ({ 
  value, 
  onChange, 
  sectionId, 
  field,
  as = 'span', 
  multiline = false,
  placeholder = 'Cliquez pour éditer...',
  style = {},
  className = '',
}) => {
  const { isEditMode, updateSection } = useEditMode();
  const [localValue, setLocalValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (onChange) onChange(newValue);
    if (sectionId && field) {
      updateSection(sectionId, { [field]: newValue });
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
    }
    if (e.key === 'Escape') {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  // Mode lecture
  if (!isEditMode) {
    const Tag = as;
    return <Tag style={style} className={className}>{value}</Tag>;
  }

  // Mode édition - afficher input inline
  const editStyle = {
    ...style,
    cursor: 'text',
    outline: isEditing ? '2px solid var(--s-primary)' : '2px dashed rgba(0, 122, 255, 0.5)',
    outlineOffset: 4,
    borderRadius: 4,
    transition: 'outline-color 0.15s',
    minWidth: 50,
  };

  if (isEditing) {
    const inputStyle = {
      ...style,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      width: '100%',
      resize: multiline ? 'vertical' : 'none',
      fontFamily: 'inherit',
    };

    if (multiline) {
      return (
        <textarea
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{ ...inputStyle, minHeight: 60 }}
          className={className}
          autoFocus
        />
      );
    }

    return (
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={inputStyle}
        className={className}
        placeholder={placeholder}
        autoFocus
      />
    );
  }

  // Mode édition mais pas actif - clickable
  const Tag = as;
  return (
    <Tag 
      style={editStyle} 
      className={className}
      onClick={() => setIsEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setIsEditing(true)}
    >
      {localValue || <span style={{ opacity: 0.5 }}>{placeholder}</span>}
    </Tag>
  );
};

// ─── ANNOUNCEMENT BAR ─────────────────────────────────────────────────────────
const AnnouncementBar = ({ store }) => {
  const [visible, setVisible] = useState(true);
  const msg = String(store?.announcement || '').trim();
  if (!store?.announcementEnabled || !msg) return null;
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
                padding: '16px 36px', borderRadius: '999px',
                background: 'var(--sf-cta-bg)', color: 'var(--sf-cta-text)',
                border: '1px solid var(--sf-cta-border)',
                fontWeight: 800, fontSize: 15, textDecoration: 'none',
                letterSpacing: '-0.01em', fontFamily: 'var(--s-font)',
                boxShadow: 'var(--sf-shadow)', transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 18px 40px rgba(15, 23, 42, 0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--sf-shadow)'; }}
            >{cfg.ctaText || 'Découvrir nos produits'} <ArrowRight size={17} /></Link>
          </div>
          {/* Product image */}
          <div style={{ flex: '1 1 260px', maxWidth: 420, margin: '0 auto' }}>
            <div style={{
              borderRadius: 'var(--sf-radius)', overflow: 'hidden', aspectRatio: '1/1',
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

const HeroContent = ({ cfg, prefix, sectionId = 'hero' }) => {
  const { isEditMode, getSectionData } = useEditMode();
  
  // Obtenir les données avec les modifications en attente
  const data = getSectionData(sectionId, cfg);
  
  const titleStyle = {
    fontSize: 'clamp(38px, 7vw, 72px)', fontWeight: 900, lineHeight: 1.04,
    margin: '0 0 22px', letterSpacing: '-0.035em', fontFamily: 'var(--s-font)',
    color: '#fff', textShadow: '0 2px 24px rgba(0,0,0,0.18)',
  };
  
  const subtitleStyle = {
    fontSize: 'clamp(16px, 2.2vw, 20px)', lineHeight: 1.6, margin: '0 0 44px',
    color: 'rgba(255,255,255,0.88)', fontFamily: 'var(--s-font)', 
    maxWidth: 580, marginLeft: 'auto', marginRight: 'auto',
  };
  
  const ctaStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '17px 40px', borderRadius: '999px',
    background: 'var(--sf-cta-bg)', color: 'var(--sf-cta-text)',
    border: '1px solid var(--sf-cta-border)',
    fontWeight: 800, fontSize: 15.5, textDecoration: 'none',
    letterSpacing: '-0.01em', fontFamily: 'var(--s-font)',
    boxShadow: 'var(--sf-shadow)', transition: 'transform 0.15s, box-shadow 0.15s',
  };
  
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <EditableText
        value={data.title}
        sectionId={sectionId}
        field="title"
        as="h1"
        style={titleStyle}
        placeholder="Titre du hero..."
      />
      
      {(data.subtitle || isEditMode) && (
        <EditableText
          value={data.subtitle || ''}
          sectionId={sectionId}
          field="subtitle"
          as="p"
          style={subtitleStyle}
          placeholder="Sous-titre (optionnel)..."
          multiline
        />
      )}
      
      <Link 
        to={`${prefix}/products`}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 44px rgba(0,0,0,0.28)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(0,0,0,0.22)'; }}
        style={ctaStyle}
      >
        {isEditMode ? (
          <EditableText
            value={data.ctaText || 'Découvrir'}
            sectionId={sectionId}
            field="ctaText"
            as="span"
            style={{ fontWeight: 800, fontSize: 15.5 }}
            placeholder="Texte du bouton..."
          />
        ) : (
          data.ctaText || 'Découvrir'
        )}
        <ArrowRight size={18} />
      </Link>
    </div>
  );
};

// ─── BADGES (trust strip) ──────────────────────────────────────────────────────
const AiBadgesSection = ({ cfg }) => {
  const badges = cfg.items || [];
  const sectionRef = React.useRef(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);
  
  return (
    <section ref={sectionRef} style={{ 
      backgroundColor: 'var(--sf-surface)', 
      borderTop: '1px solid var(--sf-border)',
      borderBottom: '1px solid var(--sf-border)',
      padding: '32px 0',
      overflow: 'hidden',
    }}>
      <style>
        {`
          @keyframes scrollBadges {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          
          .s-badges-container {
            display: flex;
            animation: scrollBadges 30s linear infinite;
            animation-play-state: ${isVisible ? 'running' : 'paused'};
            width: fit-content;
          }
          
          .s-badges-container:hover {
            animation-play-state: paused;
          }
          
          .s-badge-item {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 0 32px;
            border-right: 1px solid #F0F0F0;
            transition: transform 0.2s;
          }
          
          .s-badge-item:hover {
            transform: scale(1.05);
          }
          
          @media (max-width: 768px) {
            .s-badge-item {
              padding: 0 24px;
            }
          }
        `}
      </style>
      
      <div style={{ position: 'relative' }}>
        {/* Gradient fade on edges */}
        <div style={{ 
          position: 'absolute', 
          left: 0, 
          top: 0, 
          bottom: 0, 
          width: 100, 
          background: 'linear-gradient(to right, var(--sf-surface), transparent)',
          zIndex: 1,
          pointerEvents: 'none',
        }} />
        <div style={{ 
          position: 'absolute', 
          right: 0, 
          top: 0, 
          bottom: 0, 
          width: 100, 
          background: 'linear-gradient(to left, var(--sf-surface), transparent)',
          zIndex: 1,
          pointerEvents: 'none',
        }} />
        
        <div style={{ overflow: 'hidden' }}>
          <div className="s-badges-container">
            {/* Duplicate badges for infinite scroll effect */}
            {[...badges, ...badges].map((badge, i) => (
              <div key={i} className="s-badge-item">
                <IconBox icon={badge.icon} size={20} boxSize={46} radius={14} />
                <div>
                  <p style={{ 
                    margin: 0, 
                    fontWeight: 700, 
                    fontSize: 13.5, 
                    color: 'var(--s-text)', 
                    fontFamily: 'var(--s-font)',
                    whiteSpace: 'nowrap',
                  }}>
                    {badge.title}
                  </p>
                  <p style={{ 
                    margin: '2px 0 0', 
                    fontSize: 12, 
                    color: 'var(--s-text2)', 
                    lineHeight: 1.4, 
                    fontFamily: 'var(--s-font)',
                    whiteSpace: 'nowrap',
                  }}>
                    {badge.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── PRODUCTS (homepage: max 3 + see all) ─────────────────────────────────────
const AiProductsSection = ({ cfg, products, prefix, store }) => {
  const limit = cfg.homepageLimit || 3;
  const displayed = products.slice(0, limit);
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  return (
    <section id="products" style={{ backgroundColor: 'var(--sf-muted-surface)', padding: 'clamp(52px, 8vw, 80px) 24px' }}>
      <style>{`
        .hp-catalog-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; -ms-overflow-style: none; }
        .hp-catalog-scroll::-webkit-scrollbar { display: none; }
        .hp-cat-card { flex-shrink: 0; text-decoration: none; transition: all 0.2s ease; display: block; }
        .hp-cat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 900, color: 'var(--s-text)', margin: '0 0 10px', letterSpacing: '-0.025em', fontFamily: 'var(--s-font)' }}>
            {cfg.title || 'Nos Produits'}
          </h2>
          {cfg.subtitle && <p style={{ fontSize: 15, color: 'var(--s-text2)', margin: 0, fontFamily: 'var(--s-font)' }}>{cfg.subtitle}</p>}
        </div>

        {/* Catalog categories */}
        {categories.length > 1 && (
          <div style={{ marginBottom: 32 }}>
            <div className="hp-catalog-scroll" style={{ justifyContent: categories.length <= 4 ? 'center' : 'flex-start' }}>
              {categories.map(cat => {
                const catProducts = products.filter(p => p.category === cat);
                const catImage = catProducts.find(p => p.image)?.image;
                return (
                  <Link
                    key={cat}
                    to={`${prefix}/products?category=${encodeURIComponent(cat)}`}
                    className="hp-cat-card"
                    style={{
                      width: 140, borderRadius: 'calc(var(--sf-radius) - 4px)', overflow: 'hidden',
                      backgroundColor: 'var(--sf-surface)', border: '1px solid var(--sf-border)',
                      boxShadow: 'var(--sf-shadow)',
                    }}
                  >
                    <div style={{
                      height: 80, width: '100%',
                      backgroundColor: catImage ? undefined : `color-mix(in srgb, var(--s-primary) 10%, white)`,
                      backgroundImage: catImage ? `url(${catImage})` : undefined,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {!catImage && <Package size={24} color="var(--s-primary)" style={{ opacity: 0.3 }} />}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--s-text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 3 }}>
                        {catProducts.length} article{catProducts.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Product grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24, maxWidth: 820, margin: '0 auto' }}>
          {displayed.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '64px 20px', color: 'var(--s-text2)' }}>
              <ShoppingBag size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: 15 }}>Aucun produit pour l'instant.</p>
            </div>
          ) : displayed.map(p => <MemoizedProductCard key={p._id} product={p} prefix={prefix} store={store} subdomain={store?.subdomain} />)}
        </div>
        {products.length > limit && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link to={`${prefix}/products`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '13px 32px', borderRadius: '999px',
              border: '1px solid var(--sf-cta-border)', color: 'var(--sf-cta-text)',
              background: 'var(--sf-cta-bg)',
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
              fontFamily: 'var(--s-font)', transition: 'all 0.15s', boxShadow: 'var(--sf-shadow)',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
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
  <section style={{ padding: 'clamp(56px, 9vw, 88px) 24px', backgroundColor: 'var(--sf-surface)' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{ fontSize: 'clamp(22px, 3.2vw, 34px)', fontWeight: 900, color: 'var(--s-text)', margin: 0, letterSpacing: '-0.025em', fontFamily: 'var(--s-font)' }}>
          {cfg.title || 'Pourquoi nous choisir ?'}
        </h2>
        {cfg.subtitle && <p style={{ fontSize: 15, color: 'var(--s-text2)', margin: '10px 0 0', fontFamily: 'var(--s-font)' }}>{cfg.subtitle}</p>}
      </div>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {cfg.image && (
          <div style={{ flex: '0 0 auto', width: 'min(320px, 100%)', margin: '0 auto' }}>
            <div style={{ width: '100%', borderRadius: 'var(--sf-radius)', overflow: 'hidden', boxShadow: 'var(--sf-shadow)', aspectRatio: '1/1', backgroundColor: 'var(--sf-muted-surface)' }}>
              <img
                src={cfg.image}
                alt={cfg.title || 'Pourquoi nous choisir'}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 280, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
          {(cfg.items || []).map((f, i) => (
            <div key={i}
              style={{ backgroundColor: 'var(--sf-muted-surface)', borderRadius: 'var(--sf-radius)', padding: '28px 24px', border: '1px solid var(--sf-border)', transition: 'box-shadow 0.2s, transform 0.2s', boxShadow: 'var(--sf-shadow)' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 18px 44px rgba(15, 23, 42, 0.12)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--sf-shadow)'; e.currentTarget.style.transform = 'none'; }}
            >
              <IconBox icon={f.icon} size={22} boxSize={52} radius={16} />
              <h3 style={{ margin: '18px 0 10px', fontSize: 15.5, fontWeight: 700, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--s-text2)', lineHeight: 1.65, fontFamily: 'var(--s-font)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
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
  const [heights, setHeights] = useState({});
  
  const toggleItem = (i) => {
    setOpen(open === i ? null : i);
  };
  
  return (
    <section style={{ padding: 'clamp(56px, 9vw, 88px) 24px', backgroundColor: 'var(--sf-muted-surface)' }}>
      <style>
        {`
          .faq-chevron {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .faq-chevron.open {
            transform: rotate(180deg);
          }
          
          .faq-answer {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                        padding 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                        opacity 0.3s ease;
            opacity: 0;
          }
          
          .faq-answer.open {
            max-height: 500px;
            opacity: 1;
          }
          
          .faq-item {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .faq-item:hover {
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
            transform: translateY(-2px);
          }
        `}
      </style>
      
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ 
            fontSize: 'clamp(26px, 3.8vw, 38px)', 
            fontWeight: 900, 
            color: 'var(--s-text)', 
            margin: '0 0 12px', 
            letterSpacing: '-0.03em', 
            fontFamily: 'var(--s-font)' 
          }}>
            {cfg.title || 'Questions fréquentes'}
          </h2>
          {cfg.subtitle && (
            <p style={{ 
              fontSize: 15.5, 
              color: 'var(--s-text2)', 
              margin: 0, 
              fontFamily: 'var(--s-font)' 
            }}>
              {cfg.subtitle}
            </p>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(cfg.items || []).map((item, i) => {
            const isOpen = open === i;
            
            return (
              <div 
                key={i} 
                className="faq-item"
                style={{ 
                  borderRadius: 16, 
                  border: '1.5px solid', 
                  overflow: 'hidden', 
                  borderColor: isOpen ? 'var(--s-primary)' : '#E5E7EB', 
                  backgroundColor: isOpen ? '#FFFFFF' : '#fff',
                  boxShadow: isOpen ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.02)',
                }}
              >
                <button 
                  onClick={() => toggleItem(i)} 
                  style={{ 
                    width: '100%', 
                    padding: '20px 24px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    textAlign: 'left', 
                    gap: 16 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                    <span style={{ 
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: isOpen ? 'var(--s-primary)' : '#F3F4F6',
                      color: isOpen ? '#fff' : 'var(--s-text2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'var(--s-font)',
                      transition: 'all 0.3s',
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ 
                      fontWeight: 600, 
                      fontSize: 15.5, 
                      color: 'var(--s-text)', 
                      fontFamily: 'var(--s-font)', 
                      lineHeight: 1.5,
                      paddingTop: 3,
                    }}>
                      {item.question}
                    </span>
                  </div>
                  <div className={`faq-chevron ${isOpen ? 'open' : ''}`} style={{ flexShrink: 0 }}>
                    <ChevronDown size={20} color={isOpen ? 'var(--s-primary)' : '#9CA3AF'} strokeWidth={2.5} />
                  </div>
                </button>
                
                <div className={`faq-answer ${isOpen ? 'open' : ''}`}>
                  <div style={{ 
                    padding: '0 24px 20px 66px', 
                    fontSize: 14.5, 
                    color: '#4B5563', 
                    lineHeight: 1.75, 
                    fontFamily: 'var(--s-font)',
                  }}>
                    {item.answer || item.reponse}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Optional CTA at the bottom */}
        {cfg.showContactCta !== false && (
          <div style={{ 
            marginTop: 40, 
            textAlign: 'center', 
            padding: '28px 24px',
            backgroundColor: 'var(--sf-surface)',
            borderRadius: 'var(--sf-radius)',
            border: '1px solid var(--sf-border)',
            boxShadow: 'var(--sf-shadow)',
          }}>
            <p style={{ 
              fontSize: 14.5, 
              color: 'var(--s-text2)', 
              margin: '0 0 16px',
              fontFamily: 'var(--s-font)',
            }}>
              Vous ne trouvez pas votre réponse ?
            </p>
            <p style={{ 
              fontSize: 15, 
              fontWeight: 600, 
              color: 'var(--s-text)', 
              margin: 0,
              fontFamily: 'var(--s-font)',
            }}>
              <MessageCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Contactez-nous directement
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

// ─── CONTACT CTA ──────────────────────────────────────────────────────────────
const AiContactSection = ({ cfg, store }) => {
  const whatsapp = (cfg.whatsapp || store?.whatsapp || '').replace(/\D/g, '');
  const phone = cfg.phone || store?.phone || '';
  const email = cfg.email || store?.email || '';
  const storeName = store?.name || 'la boutique';
  
  // Pre-filled WhatsApp message
  const waMessage = encodeURIComponent(`Bonjour ${storeName} ! Je suis intéressé(e) par vos produits et j'aimerais passer une commande.`);
  const waLink = whatsapp ? `https://wa.me/${whatsapp}?text=${waMessage}` : null;
  
  return (
    <section style={{ 
      padding: 'clamp(72px, 11vw, 120px) 24px', 
      textAlign: 'center', 
      position: 'relative', 
      overflow: 'hidden', 
      background: 'linear-gradient(135deg, var(--s-primary) 0%, color-mix(in srgb, var(--s-primary) 85%, black) 100%)',
    }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          
          .wa-button {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .wa-button:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }
          
          .wa-button:active {
            transform: translateY(-2px) scale(1);
          }
          
          .contact-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .contact-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          }
        `}
      </style>
      
      {/* Background decorations */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 250, height: 250, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      
      <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <h2 style={{ 
          fontSize: 'clamp(28px, 4vw, 44px)', 
          fontWeight: 900, 
          color: '#fff', 
          margin: '0 0 14px', 
          letterSpacing: '-0.03em', 
          fontFamily: 'var(--s-font)',
          textShadow: '0 2px 20px rgba(0,0,0,0.15)',
        }}>
          {cfg.title || 'Contactez-nous'}
        </h2>
        
        {cfg.subtitle && (
          <p style={{ 
            fontSize: 17, 
            color: 'rgba(255,255,255,0.9)', 
            margin: '0 0 44px', 
            lineHeight: 1.6, 
            fontFamily: 'var(--s-font)',
            maxWidth: 520,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            {cfg.subtitle}
          </p>
        )}
        
        {/* Main WhatsApp CTA */}
        {waLink && (
          <a 
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="wa-button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              padding: '20px 48px',
              borderRadius: 50,
              backgroundColor: '#25D366',
              color: '#fff',
              fontSize: 17,
              fontWeight: 800,
              textDecoration: 'none',
              fontFamily: 'var(--s-font)',
              boxShadow: '0 8px 32px rgba(37, 211, 102, 0.4)',
              border: 'none',
              cursor: 'pointer',
              marginBottom: 48,
            }}
          >
            <MessageCircle size={24} strokeWidth={2.5} />
            <span>Discuter sur WhatsApp</span>
          </a>
        )}
        
        {/* Alternative contact methods */}
        {(phone || email || cfg.address) && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 16,
            marginTop: 40,
          }}>
            {phone && (
              <a 
                href={`tel:${phone.replace(/\s/g, '')}`}
                className="contact-card"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 16,
                  padding: '24px 20px',
                  textDecoration: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <Phone size={24} color="#fff" style={{ marginBottom: 12 }} />
                <p style={{ 
                  margin: '0 0 4px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.7)', 
                  fontFamily: 'var(--s-font)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}>
                  Téléphone
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: 15, 
                  color: '#fff', 
                  fontWeight: 600,
                  fontFamily: 'var(--s-font)',
                }}>
                  {phone}
                </p>
              </a>
            )}
            
            {email && (
              <a 
                href={`mailto:${email}`}
                className="contact-card"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 16,
                  padding: '24px 20px',
                  textDecoration: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <Mail size={24} color="#fff" style={{ marginBottom: 12 }} />
                <p style={{ 
                  margin: '0 0 4px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.7)', 
                  fontFamily: 'var(--s-font)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}>
                  Email
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: 14, 
                  color: '#fff', 
                  fontWeight: 600,
                  fontFamily: 'var(--s-font)',
                  wordBreak: 'break-all',
                }}>
                  {email}
                </p>
              </a>
            )}
            
            {cfg.address && (
              <div 
                className="contact-card"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 16,
                  padding: '24px 20px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <MapPin size={24} color="#fff" style={{ marginBottom: 12 }} />
                <p style={{ 
                  margin: '0 0 4px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.7)', 
                  fontFamily: 'var(--s-font)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}>
                  Adresse
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: 14, 
                  color: '#fff', 
                  fontWeight: 600,
                  fontFamily: 'var(--s-font)',
                  lineHeight: 1.4,
                }}>
                  {cfg.address}
                </p>
              </div>
            )}
          </div>
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

// ─── IMAGE + TEXTE (layout flexible) ──────────────────────────────────────────
const AiImageTextSection = ({ cfg }) => {
  const isReversed = cfg.layout === 'image_left';
  return (
    <section style={{ padding: 'clamp(48px, 8vw, 80px) 24px', backgroundColor: cfg.backgroundColor || '#fff' }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
        gap: 'clamp(32px, 5vw, 60px)', alignItems: 'center',
        direction: isReversed ? 'rtl' : 'ltr',
      }}>
        <div style={{ direction: 'ltr' }}>
          {cfg.subtitle && <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--s-primary)', textTransform: 'uppercase', letterSpacing: 1.5, margin: '0 0 12px', fontFamily: 'var(--s-font)' }}>{cfg.subtitle}</p>}
          {cfg.title && <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: 'var(--s-text)', margin: '0 0 20px', lineHeight: 1.2, fontFamily: 'var(--s-font)' }}>{cfg.title}</h2>}
          {cfg.content && <p style={{ fontSize: 15, color: 'var(--s-text2)', lineHeight: 1.75, margin: '0 0 24px', fontFamily: 'var(--s-font)', whiteSpace: 'pre-line' }}>{cfg.content.replace(/\*\*/g, '')}</p>}
          {cfg.ctaText && (
            <a href={cfg.ctaLink || '/products'} style={{
              display: 'inline-block', padding: '14px 32px', borderRadius: 'var(--sf-radius, 12px)',
              backgroundColor: 'var(--s-primary)', color: 'var(--sf-cta-text, #fff)',
              fontSize: 15, fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--s-font)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}>{cfg.ctaText}</a>
          )}
          {cfg.items && cfg.items.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
              {cfg.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IconBox icon={item.icon} size={18} boxSize={36} radius={10} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>{item.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ direction: 'ltr' }}>
          {cfg.image ? (
            <div style={{
              width: '100%', borderRadius: 'var(--sf-radius, 16px)',
              aspectRatio: '1/1', backgroundColor: 'var(--sf-muted-surface)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.1)', overflow: 'hidden',
            }}>
              <img src={cfg.image} alt={cfg.title || ''} style={{
                width: '100%', height: '100%', objectFit: 'contain',
              }} loading="lazy" />
            </div>
          ) : (
            <div style={{
              width: '100%', aspectRatio: '1/1', borderRadius: 'var(--sf-radius, 16px)',
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--s-primary) 15%, white), color-mix(in srgb, var(--s-primary) 5%, white))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 48, opacity: 0.3 }}>🖼️</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// ─── BANNIÈRE PROMO / CTA ─────────────────────────────────────────────────────
const AiBannerSection = ({ cfg }) => (
  <section style={{
    padding: 'clamp(40px, 7vw, 72px) 24px',
    background: cfg.backgroundImage
      ? `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.35)), url(${cfg.backgroundImage}) center/cover no-repeat`
      : `linear-gradient(135deg, var(--s-primary), color-mix(in srgb, var(--s-primary) 70%, #000))`,
    textAlign: 'center',
  }}>
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {cfg.title && <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 900, color: '#fff', margin: '0 0 16px', fontFamily: 'var(--s-font)', textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{cfg.title}</h2>}
      {cfg.content && <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', lineHeight: 1.7, margin: '0 0 28px', fontFamily: 'var(--s-font)' }}>{cfg.content.replace(/\*\*/g, '')}</p>}
      {cfg.ctaText && (
        <a href={cfg.ctaLink || '/products'} style={{
          display: 'inline-block', padding: '16px 40px', borderRadius: 50,
          backgroundColor: '#fff', color: 'var(--s-primary)',
          fontSize: 15.5, fontWeight: 800, textDecoration: 'none', fontFamily: 'var(--s-font)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', transition: 'transform 0.2s',
        }}>{cfg.ctaText}</a>
      )}
    </div>
  </section>
);

// ─── GALERIE D'IMAGES ─────────────────────────────────────────────────────────
const AiGallerySection = ({ cfg }) => {
  const images = cfg.images || [];
  if (images.length === 0) return null;
  return (
    <section style={{ padding: 'clamp(48px, 8vw, 72px) 24px', backgroundColor: cfg.backgroundColor || '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {cfg.title && <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, color: 'var(--s-text)', margin: '0 0 12px', textAlign: 'center', fontFamily: 'var(--s-font)' }}>{cfg.title}</h2>}
        {cfg.subtitle && <p style={{ fontSize: 14.5, color: 'var(--s-text2)', margin: '0 0 32px', textAlign: 'center', fontFamily: 'var(--s-font)' }}>{cfg.subtitle}</p>}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${images.length <= 2 ? '300px' : '220px'}, 1fr))`,
          gap: 16,
        }}>
          {images.map((img, i) => (
            <div key={i} style={{ borderRadius: 'var(--sf-radius, 12px)', overflow: 'hidden', aspectRatio: '1', position: 'relative' }}>
              <img src={typeof img === 'string' ? img : img.url} alt={typeof img === 'string' ? '' : (img.alt || '')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
              {typeof img !== 'string' && img.caption && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--s-font)' }}>{img.caption}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── NEWSLETTER ───────────────────────────────────────────────────────────────
const AiNewsletterSection = ({ cfg }) => (
  <section style={{
    padding: 'clamp(48px, 8vw, 72px) 24px',
    background: cfg.backgroundColor || 'linear-gradient(135deg, color-mix(in srgb, var(--s-primary) 8%, white), color-mix(in srgb, var(--s-primary) 3%, white))',
  }}>
    <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      {cfg.title && <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: 'var(--s-text)', margin: '0 0 12px', fontFamily: 'var(--s-font)' }}>{cfg.title}</h2>}
      {cfg.subtitle && <p style={{ fontSize: 14.5, color: 'var(--s-text2)', margin: '0 0 24px', lineHeight: 1.6, fontFamily: 'var(--s-font)' }}>{cfg.subtitle}</p>}
      <div style={{ display: 'flex', gap: 10, maxWidth: 440, margin: '0 auto' }}>
        <input type="email" placeholder={cfg.placeholder || 'Votre adresse email'} style={{
          flex: 1, padding: '14px 18px', borderRadius: 'var(--sf-radius, 12px)',
          border: '2px solid #E5E7EB', fontSize: 14, fontFamily: 'var(--s-font)',
          outline: 'none',
        }} />
        <button style={{
          padding: '14px 24px', borderRadius: 'var(--sf-radius, 12px)', border: 'none',
          backgroundColor: 'var(--s-primary)', color: 'var(--sf-cta-text, #fff)',
          fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--s-font)',
          whiteSpace: 'nowrap',
        }}>{cfg.buttonText || "S'inscrire"}</button>
      </div>
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
  image_text: 'Image + Texte',
  banner: 'Bannière',
  gallery: 'Galerie',
  newsletter: 'Newsletter',
  products: 'Produits',
  testimonials: 'Témoignages',
  faq: 'FAQ',
  contact: 'Contact',
  spacer: 'Espacement',
};

const isLegacyStorySection = (section) => {
  const id = String(section?.id || '').trim().toLowerCase();
  const title = String(section?.config?.title || '').trim().toLowerCase();
  const subtitle = String(section?.config?.subtitle || '').trim().toLowerCase();

  return section?.type === 'image_text' && (
    id === 'image-text-1'
    || title.includes('notre histoire')
    || subtitle.includes('qui sommes-nous')
  );
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
      case 'image_text':   return <AiImageTextSection cfg={cfg} />;
      case 'banner':       return <AiBannerSection cfg={cfg} />;
      case 'gallery':      return <AiGallerySection cfg={cfg} />;
      case 'newsletter':   return <AiNewsletterSection cfg={cfg} />;
      case 'products':     return <AiProductsSection cfg={cfg} products={products} prefix={prefix} store={store} />;
      case 'testimonials': 
        return (
          <Suspense fallback={<div style={{ padding: '60px 0', textAlign: 'center', color: '#9CA3AF' }}>Chargement...</div>}>
            <AiTestimonialsSection cfg={cfg} />
          </Suspense>
        );
      case 'faq':          
        return (
          <Suspense fallback={<div style={{ padding: '60px 0', textAlign: 'center', color: '#9CA3AF' }}>Chargement...</div>}>
            <AiFaqSection cfg={cfg} />
          </Suspense>
        );
      case 'contact':      
        return (
          <Suspense fallback={<div style={{ padding: '60px 0', textAlign: 'center', color: '#9CA3AF' }}>Chargement...</div>}>
            <AiContactSection cfg={cfg} store={store} />
          </Suspense>
        );
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
          padding: '0 16px',
          height: scrolled ? 52 : 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'height 0.3s ease',
        }}>
          {/* Left zone: Hamburger (mobile) + Nav links (desktop) */}
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 0', minWidth: 0 }}>
            {/* Menu Hamburger — visible mobile only */}
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
                  display: 'block', width: '100%', height: 2,
                  backgroundColor: 'var(--s-text)', borderRadius: 2,
                  transition: 'all 0.3s ease',
                  transform: mobileMenuOpen ? 'rotate(45deg) translateY(6px)' : 'none',
                }} />
                <span style={{
                  display: 'block', width: '100%', height: 2,
                  backgroundColor: 'var(--s-text)', borderRadius: 2,
                  transition: 'all 0.3s ease',
                  opacity: mobileMenuOpen ? 0 : 1,
                }} />
                <span style={{
                  display: 'block', width: '100%', height: 2,
                  backgroundColor: 'var(--s-text)', borderRadius: 2,
                  transition: 'all 0.3s ease',
                  transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-6px)' : 'none',
                }} />
              </div>
            </button>

            {/* Desktop nav links */}
            <nav className="desktop-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {navLinks.map(link => (
                <Link
                  key={link.label}
                  to={link.href}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    color: 'var(--s-text2)', textDecoration: 'none', fontFamily: 'var(--s-font)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = 'var(--s-text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--s-text2)'; }}
                >
                  {link.label}
                </Link>
              ))}

              {/* Bouton Mode Édition (desktop only) */}
              {canEdit && (
                <button
                  onClick={toggleEditMode}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8,
                    border: isEditMode ? '2px solid #3B82F6' : '1.5px solid var(--s-border)',
                    backgroundColor: isEditMode ? '#EFF6FF' : 'transparent',
                    color: isEditMode ? '#3B82F6' : 'var(--s-text2)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--s-font)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { if (!isEditMode) { e.currentTarget.style.backgroundColor = '#F3F4F6'; e.currentTarget.style.borderColor = '#D1D5DB'; } }}
                  onMouseLeave={e => { if (!isEditMode) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--s-border)'; } }}
                >
                  <Pencil size={14} />
                  {isEditMode ? 'Édition' : 'Modifier'}
                </button>
              )}
            </nav>
          </div>

          {/* Center: Logo — always centered on mobile */}
          <Link
            to={`${prefix}/`}
            className="header-logo"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
              transition: 'transform 0.2s ease', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {store?.logo ? (
              <img
                src={store.logo} alt={store?.name}
                style={{ height: scrolled ? 30 : 34, width: 'auto', maxWidth: 120, objectFit: 'contain', transition: 'height 0.3s ease' }}
              />
            ) : (
              <span style={{
                width: scrolled ? 30 : 34, height: scrolled ? 30 : 34, borderRadius: 10,
                backgroundColor: 'var(--s-primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: scrolled ? 14 : 16, flexShrink: 0,
                transition: 'all 0.3s ease',
              }}>
                {(store?.name || 'S')[0].toUpperCase()}
              </span>
            )}
            <span className="header-store-name" style={{
              fontWeight: 700, fontSize: scrolled ? 16 : 17, color: 'var(--s-text)',
              letterSpacing: '-0.01em', transition: 'font-size 0.3s ease',
            }}>
              {store?.name}
            </span>
          </Link>

          {/* Right zone: Cart */}
          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 0', justifyContent: 'flex-end', minWidth: 0 }}>
            <Link
              to={`${prefix}/checkout`}
              className="header-cart-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 18px', borderRadius: 40,
                border: '1.5px solid',
                borderColor: cartCount > 0 ? 'var(--s-primary)' : 'var(--s-border)',
                backgroundColor: cartCount > 0 ? 'var(--s-primary)' : 'transparent',
                color: cartCount > 0 ? '#fff' : 'var(--s-text)', textDecoration: 'none',
                fontWeight: 600, fontSize: 14, transition: 'all 0.2s ease', fontFamily: 'var(--s-font)',
                transform: cartBounce ? 'scale(1.1)' : 'scale(1)',
              }}
              onMouseEnter={e => {
                if (cartCount === 0) { e.currentTarget.style.backgroundColor = '#F3F4F6'; e.currentTarget.style.borderColor = '#D1D5DB'; }
                else { e.currentTarget.style.transform = 'scale(1.05)'; }
              }}
              onMouseLeave={e => {
                if (cartCount === 0) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--s-border)'; }
                else { e.currentTarget.style.transform = 'scale(1)'; }
              }}
              onFocus={preloadStoreCheckoutRoute}
              onTouchStart={preloadStoreCheckoutRoute}
            >
              <ShoppingCart size={17} />
              {cartCount > 0 && (
                <span style={{ minWidth: 18, textAlign: 'center', animation: cartBounce ? 'cartPop 0.3s ease' : 'none' }}>
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
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
          .desktop-nav-links { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .header-store-name { display: none; }
          .header-logo { position: absolute; left: 50%; transform: translateX(-50%); }
          .header-cart-btn span { display: none; }
          .header-cart-btn { padding: 8px !important; border-radius: 50% !important; }
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
  
  // Check if product is new (created within last 7 days)
  const isNew = product.createdAt && (Date.now() - new Date(product.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
  
  const handlePrefetch = () => {
    preloadStoreProductRoute();
    if (subdomain && product?.slug) {
      prefetchStoreProduct(subdomain, product.slug);
    }
  };

  const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    border: '1px solid #F0F0F0',
    boxShadow: hovered ? '0 20px 60px rgba(0,0,0,0.12)' : '0 2px 12px rgba(0,0,0,0.04)',
    transform: hovered ? 'translateY(-6px)' : 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  const imageContainerStyle = {
    position: 'relative',
    paddingBottom: '100%',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  };

  const imageStyle = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: hovered ? 'scale(1.08)' : 'scale(1)',
    transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  const overlayStyle = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 40%)',
    opacity: hovered ? 1 : 0,
    transition: 'opacity 0.3s',
    pointerEvents: 'none',
  };

  const quickViewStyle = {
    position: 'absolute',
    bottom: hovered ? 16 : -40,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#fff',
    color: 'var(--s-primary)',
    padding: '10px 24px',
    borderRadius: 25,
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'var(--s-font)',
    border: 'none',
    cursor: 'pointer',
    opacity: hovered ? 1 : 0,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    whiteSpace: 'nowrap',
  };

  return (
    <Link 
      to={`${prefix}/product/${product.slug}`} 
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => { setHovered(true); handlePrefetch(); }} 
      onMouseLeave={() => setHovered(false)} 
      onFocus={handlePrefetch} 
      onTouchStart={handlePrefetch}
    >
      <div style={cardStyle}>
        <div style={imageContainerStyle}>
          {product.image ? (
            <img 
              src={product.image} 
              alt={product.name} 
              loading="lazy" 
              decoding="async" 
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" 
              style={imageStyle} 
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={40} style={{ color: '#D1D5DB' }} />
            </div>
          )}
          
          {/* Gradient overlay on hover */}
          <div style={overlayStyle} />
          
          {/* Badges */}
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hasDiscount && (
              <span style={{ 
                backgroundColor: '#EF4444', 
                color: '#fff', 
                fontSize: 11, 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: 20,
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
              }}>
                -{pct}%
              </span>
            )}
            {isNew && !hasDiscount && (
              <span style={{ 
                backgroundColor: 'var(--s-primary)', 
                color: '#fff', 
                fontSize: 11, 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: 20,
                boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)',
              }}>
                Nouveau
              </span>
            )}
          </div>
          
          {/* Stock overlay */}
          {product.stock === 0 && (
            <div style={{ 
              position: 'absolute', 
              inset: 0, 
              backgroundColor: 'rgba(0,0,0,0.4)', 
              backdropFilter: 'blur(2px)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <span style={{ 
                color: '#fff', 
                fontWeight: 700, 
                fontSize: 13, 
                backgroundColor: 'rgba(0,0,0,0.6)', 
                padding: '6px 16px', 
                borderRadius: 25 
              }}>
                Rupture de stock
              </span>
            </div>
          )}
          
          {/* Quick view button */}
          {product.stock > 0 && (
            <div style={quickViewStyle}>
              Voir le produit
            </div>
          )}
        </div>
        
        {/* Content */}
        <div style={{ padding: '16px 18px 20px' }}>
          {product.category && (
            <span style={{ 
              fontSize: 10.5, 
              fontWeight: 700, 
              color: 'var(--s-primary)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.08em',
              fontFamily: 'var(--s-font)',
            }}>
              {product.category}
            </span>
          )}
          
          <p style={{ 
            margin: '6px 0 12px', 
            fontWeight: 600, 
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
          
          {/* Rating (if available) */}
          {product.rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star 
                  key={i} 
                  size={12} 
                  fill={i < Math.floor(product.rating) ? 'var(--s-primary)' : 'none'}
                  color={i < Math.floor(product.rating) ? 'var(--s-primary)' : '#D1D5DB'}
                  strokeWidth={2}
                />
              ))}
              <span style={{ fontSize: 11, color: 'var(--s-text2)', marginLeft: 2 }}>
                ({product.reviewCount || 0})
              </span>
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ 
              fontSize: 17, 
              fontWeight: 800, 
              color: 'var(--s-primary)', 
              fontFamily: 'var(--s-font)' 
            }}>
              {fmt(product.price, store?.currency || product.currency || 'XAF')}
            </span>
            {hasDiscount && (
              <span style={{ 
                fontSize: 13, 
                color: '#9CA3AF', 
                textDecoration: 'line-through',
                fontFamily: 'var(--s-font)',
              }}>
                {fmt(product.compareAtPrice, store?.currency || product.currency || 'XAF')}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

// Memoize ProductCard to prevent unnecessary re-renders
const MemoizedProductCard = React.memo(ProductCard);

const CollectionProductCard = React.memo(({ product, prefix, store, subdomain }) => {
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPercent = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const productImage = product.image || product.images?.[0]?.url || '';

  const handlePrefetch = () => {
    preloadStoreProductRoute();
    if (subdomain && product?.slug) {
      prefetchStoreProduct(subdomain, product.slug);
    }
  };

  return (
    <Link
      to={`${prefix}/product/${product.slug}`}
      style={{ textDecoration: 'none', display: 'block', height: '100%' }}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      onTouchStart={handlePrefetch}
    >
      <article style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}>
        <div style={{ position: 'relative', aspectRatio: '1 / 1', backgroundColor: '#F8FAFC' }}>
          {productImage ? (
            <img
              src={productImage}
              alt={product.name}
              loading="lazy"
              decoding="async"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={34} style={{ color: '#CBD5E1' }} />
            </div>
          )}

          {hasDiscount && (
            <div style={{
              position: 'absolute',
              top: 12,
              left: 12,
              padding: '6px 10px',
              borderRadius: 999,
              backgroundColor: '#EF4444',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}>
              -{discountPercent}%
            </div>
          )}
        </div>

        <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {product.category && (
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--s-text2)' }}>
              {product.category}
            </div>
          )}

          <h3 style={{
            margin: 0,
            fontSize: 16,
            lineHeight: 1.35,
            fontWeight: 700,
            color: 'var(--s-text)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 44,
          }}>
            {product.name}
          </h3>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 21, fontWeight: 900, color: 'var(--s-text)' }}>
              {fmt(product.price, store?.currency || product.currency || 'XAF')}
            </span>
            {hasDiscount && (
              <span style={{ fontSize: 13, color: 'var(--s-text2)', textDecoration: 'line-through' }}>
                {fmt(product.compareAtPrice, store?.currency || product.currency || 'XAF')}
              </span>
            )}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '6px 10px',
              borderRadius: 999,
              backgroundColor: Number(product.stock || 0) > 0 ? 'color-mix(in srgb, var(--s-primary) 10%, white)' : '#FEF2F2',
              color: Number(product.stock || 0) > 0 ? 'var(--s-primary)' : '#DC2626',
            }}>
              {Number(product.stock || 0) > 0 ? 'En stock' : 'Rupture'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--s-primary)' }}>
              Voir le produit
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
});

// ── Mobile Bottom Navigation ──────────────────────────────────────────────────
const MobileBottomNav = ({ prefix, cartCount, store }) => {
  return (
    <>
      <style>
        {`
          .mobile-bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 40;
            background: #fff;
            border-top: 1px solid #E5E7EB;
            box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08);
            display: none;
          }
          
          @media (max-width: 768px) {
            .mobile-bottom-nav {
              display: block;
            }
          }
          
          .mobile-nav-item {
            transition: all 0.2s;
          }
          
          .mobile-nav-item:active {
            transform: scale(0.95);
          }
        `}
      </style>
      
      <nav className="mobile-bottom-nav">
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)',
          height: 64,
          padding: '0 8px',
        }}>
          {/* Home */}
          <Link 
            to={`${prefix}/`}
            className="mobile-nav-item"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              textDecoration: 'none',
              color: '#6B7280',
            }}
          >
            <div style={{ position: 'relative' }}>
              <ShoppingBag size={22} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--s-font)' }}>
              Accueil
            </span>
          </Link>
          
          {/* Products */}
          <Link 
            to={`${prefix}/products`}
            className="mobile-nav-item"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              textDecoration: 'none',
              color: '#6B7280',
            }}
          >
            <Package size={22} strokeWidth={2} />
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--s-font)' }}>
              Produits
            </span>
          </Link>
          
          {/* Cart */}
          <Link 
            to={`${prefix}/cart`}
            className="mobile-nav-item"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              textDecoration: 'none',
              color: '#6B7280',
            }}
          >
            <div style={{ position: 'relative' }}>
              <ShoppingCart size={22} strokeWidth={2} />
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -6,
                  right: -8,
                  backgroundColor: 'var(--s-primary)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: '50%',
                  minWidth: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  border: '2px solid #fff',
                }}>
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--s-font)' }}>
              Panier
            </span>
          </Link>
        </div>
      </nav>
    </>
  );
};

// ── Floating WhatsApp Button ──────────────────────────────────────────────────
const FloatingWhatsAppButton = ({ store }) => {
  const whatsapp = (store?.whatsapp || '').replace(/\D/g, '');
  const buttonRef = React.useRef(null);
  const [isVisible, setIsVisible] = React.useState(true);
  
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    if (buttonRef.current) observer.observe(buttonRef.current);
    return () => observer.disconnect();
  }, []);
  
  if (!whatsapp) return null;
  
  const storeName = store?.name || 'la boutique';
  const waMessage = encodeURIComponent(`Bonjour ${storeName} ! Je suis intéressé(e) par vos produits.`);
  const waLink = `https://wa.me/${whatsapp}?text=${waMessage}`;
  
  return (
    <>
      <style>
        {`
          @keyframes whatsapp-pulse {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.7);
            }
            50% {
              box-shadow: 0 0 0 12px rgba(37, 211, 102, 0);
            }
          }
          
          .whatsapp-float {
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 30;
            animation: whatsapp-pulse 2s infinite;
            animation-play-state: ${isVisible ? 'running' : 'paused'};
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .whatsapp-float:hover {
            transform: scale(1.1) translateY(-4px);
            box-shadow: 0 8px 32px rgba(37, 211, 102, 0.5);
          }
          
          .whatsapp-float:active {
            transform: scale(1.05);
          }
          
          @media (max-width: 768px) {
            .whatsapp-float {
              bottom: 88px;
              right: 16px;
            }
          }
        `}
      </style>
      
      <a 
        ref={buttonRef}
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-float"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: '#25D366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          boxShadow: '0 4px 24px rgba(37, 211, 102, 0.4)',
        }}
        aria-label="Contactez-nous sur WhatsApp"
      >
        <MessageCircle size={28} color="#fff" strokeWidth={2} />
      </a>
    </>
  );
};

// ── Footer ────────────────────────────────────────────────────────────────────
const StorefrontFooter = ({ store, prefix }) => {
  const navigationLinks = [
    { label: 'Accueil', href: `${prefix}/` },
    { label: 'Tous nos produits', href: `${prefix}/products` },
  ];
  
  const whatsapp = store?.whatsapp?.replace(/\D/g, '');
  const waLink = whatsapp ? `https://wa.me/${whatsapp}` : null;

  return (
    <footer style={{ 
      backgroundColor: '#1F2937', 
      color: 'rgba(255,255,255,0.7)', 
      fontFamily: 'var(--s-font)', 
      marginTop: 0,
      position: 'relative',
    }}>
      {/* Main footer content */}
      <div style={{ 
        maxWidth: 1200, 
        margin: '0 auto', 
        padding: 'clamp(56px, 8vw, 72px) 24px clamp(40px, 6vw, 56px)',
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '40px 48px',
      }}>
        {/* Column 1: Brand & Description */}
        <div style={{ gridColumn: window.innerWidth > 768 ? 'span 2' : 'span 1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {store?.logo ? (
              <img 
                src={store.logo} 
                alt={store?.name} 
                style={{ 
                  height: 40, 
                  width: 'auto', 
                  objectFit: 'contain', 
                  filter: 'brightness(0) invert(1)', 
                  opacity: 0.95,
                }} 
              />
            ) : (
              <span style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 10, 
                backgroundColor: 'var(--s-primary)', 
                color: '#fff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 800, 
                fontSize: 18,
              }}>
                {(store?.name || 'S')[0]}
              </span>
            )}
            <span style={{ 
              fontWeight: 800, 
              fontSize: 19, 
              color: '#fff',
              letterSpacing: '-0.01em',
            }}>
              {store?.name}
            </span>
          </div>
          
          {store?.description && (
            <p style={{ 
              fontSize: 14, 
              lineHeight: 1.7, 
              margin: '0 0 24px', 
              maxWidth: 400, 
              color: 'rgba(255,255,255,0.65)',
            }}>
              {store.description}
            </p>
          )}
          
          {/* Payment methods */}
          <div>
            <p style={{ 
              fontSize: 12, 
              fontWeight: 600, 
              color: 'rgba(255,255,255,0.5)', 
              margin: '0 0 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Paiement sécurisé
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { icon: <CreditCard size={16} />, label: 'Carte' },
                { icon: <MessageCircle size={16} />, label: 'Mobile Money' },
              ].map((method, i) => (
                <div 
                  key={i}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6,
                    padding: '6px 12px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  {method.icon}
                  <span>{method.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Navigation */}
        <div>
          <p style={{ 
            fontWeight: 700, 
            fontSize: 13.5, 
            color: '#fff', 
            margin: '0 0 20px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em',
          }}>
            Navigation
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {navigationLinks.map(link => (
              <Link 
                key={link.label} 
                to={link.href} 
                style={{ 
                  fontSize: 14, 
                  color: 'rgba(255,255,255,0.65)', 
                  textDecoration: 'none', 
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.paddingLeft = '8px';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                  e.currentTarget.style.paddingLeft = '0';
                }}
              >
                <ChevronRight size={14} />
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Column 3: Contact */}
        <div>
          <p style={{ 
            fontWeight: 700, 
            fontSize: 13.5, 
            color: '#fff', 
            margin: '0 0 20px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em',
          }}>
            Contact
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {store?.city && (
              <span style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 10, 
                fontSize: 14, 
                color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.6,
              }}>
                <MapPin size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{store.city}{store.country ? `, ${store.country}` : ''}</span>
              </span>
            )}
            {store?.phone && (
              <a 
                href={`tel:${store.phone.replace(/\s/g, '')}`}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 10, 
                  fontSize: 14, 
                  color: 'rgba(255,255,255,0.65)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
              >
                <Phone size={16} style={{ flexShrink: 0 }} />
                <span>{store.phone}</span>
              </a>
            )}
            {store?.email && (
              <a 
                href={`mailto:${store.email}`}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 10, 
                  fontSize: 14, 
                  color: 'rgba(255,255,255,0.65)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  wordBreak: 'break-all',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
              >
                <Mail size={16} style={{ flexShrink: 0 }} />
                <span>{store.email}</span>
              </a>
            )}
            {waLink && (
              <a 
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  fontSize: 14, 
                  color: '#fff',
                  textDecoration: 'none',
                  backgroundColor: '#25D366',
                  padding: '10px 18px',
                  borderRadius: 8,
                  fontWeight: 600,
                  marginTop: 8,
                  transition: 'all 0.2s',
                  width: 'fit-content',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#1FB855';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#25D366';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <MessageCircle size={16} />
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ 
        borderTop: '1px solid rgba(255,255,255,0.1)', 
        backgroundColor: 'rgba(0,0,0,0.2)',
      }}>
        <div style={{ 
          maxWidth: 1200, 
          margin: '0 auto',
          padding: '24px 24px',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: 16,
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: 13, 
            color: 'rgba(255,255,255,0.5)',
          }}>
            © {new Date().getFullYear()} {store?.name}. Tous droits réservés.
          </p>
          
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { label: 'Confidentialité', href: '#' },
              { label: 'Conditions', href: '#' },
            ].map(link => (
              <a 
                key={link.label} 
                href={link.href} 
                style={{ 
                  fontSize: 13, 
                  color: 'rgba(255,255,255,0.5)', 
                  textDecoration: 'none', 
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
              >
                {link.label}
              </a>
            ))}
            
            <span style={{ 
              fontSize: 13, 
              color: 'rgba(255,255,255,0.4)',
            }}>
              Propulsé par{' '}
              <a 
                href="https://scalor.net" 
                target="_blank" 
                rel="noreferrer" 
                style={{ 
                  color: 'var(--s-primary)', 
                  fontWeight: 700, 
                  textDecoration: 'none',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
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
  const [searchParams] = useSearchParams();
  const { subdomain: detectedSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = paramSubdomain || detectedSubdomain;
  const prefix = isStoreDomain ? '' : (subdomain ? `/store/${subdomain}` : '');

  const { store, products, pixels, footer, error } = useStoreData(subdomain);
  const { cartCount } = useStoreCart(subdomain);
  const { trackPageView } = useStoreAnalytics(subdomain);
  const [search, setSearch] = useState('');
  const initialCategory = searchParams.get('category') || 'all';
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState('featured');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [availability, setAvailability] = useState('all');
  const [priceRange, setPriceRange] = useState('all');

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const categoryCountMap = products.reduce((acc, product) => {
    if (!product.category) return acc;
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});
  const allPrices = products
    .map((product) => Number(product.price || 0))
    .filter((price) => Number.isFinite(price) && price >= 0);
  const minAvailablePrice = allPrices.length ? Math.min(...allPrices) : 0;
  const maxAvailablePrice = allPrices.length ? Math.max(...allPrices) : 0;
  const priceRanges = [
    { value: 'all', label: 'Tous les prix', matches: () => true },
    { value: 'under-10000', label: 'Moins de 10 000', matches: (price) => price < 10000 },
    { value: '10000-20000', label: '10 000 - 20 000', matches: (price) => price >= 10000 && price <= 20000 },
    { value: 'over-20000', label: 'Plus de 20 000', matches: (price) => price > 20000 },
  ];
  const activePriceFilter = priceRanges.find((range) => range.value === priceRange) || priceRanges[0];
  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const stock = Number(p.stock || 0);
    const matchAvailability = availability === 'all'
      || (availability === 'in-stock' && stock > 0)
      || (availability === 'out-of-stock' && stock <= 0);
    const price = Number(p.price || 0);
    const matchPrice = activePriceFilter.matches(price);
    return matchCat && matchSearch && matchAvailability && matchPrice;
  });
  const sortedProducts = [...filtered].sort((left, right) => {
    if (sortBy === 'price-asc') return Number(left.price || 0) - Number(right.price || 0);
    if (sortBy === 'price-desc') return Number(right.price || 0) - Number(left.price || 0);
    if (sortBy === 'name-asc') return String(left.name || '').localeCompare(String(right.name || ''), 'fr', { sensitivity: 'base' });
    if (sortBy === 'name-desc') return String(right.name || '').localeCompare(String(left.name || ''), 'fr', { sensitivity: 'base' });
    return 0;
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
    trackPageView();

    // Inject pixel scripts + fire PageView
    if (pixels) {
      trackStorefrontEvent({
        subdomain,
        pixels,
        eventName: 'PageView',
      });
    }
  }, [store?.name, pixels, subdomain, trackPageView]);

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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--s-bg)', fontFamily: 'var(--s-font-base, var(--s-font))', color: 'var(--s-text)', ...buildStorefrontThemeVars(store) }}>
      <style>{`
        *{box-sizing:border-box}
        .s-badges{display:grid;grid-template-columns:1fr}
        .s-badge-item{border-bottom:1px solid #F3F4F6}
        .s-badge-item:last-child{border-bottom:none}
        .store-products-shell{max-width:1280px;margin:0 auto;padding:44px 16px 88px}
        .store-collection-layout{display:grid;gap:24px;align-items:start}
        .store-filter-panel{background:#fff;border:1px solid rgba(15,23,42,0.08);border-radius:20px;padding:18px;box-shadow:0 10px 30px rgba(15,23,42,0.05)}
        .store-filter-sticky{display:none}
        .store-filter-sticky.is-open{display:block}
        .store-filter-list{display:flex;flex-direction:column;gap:8px}
        .store-filter-item{width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:12px;border:1px solid transparent;background:transparent;color:var(--s-text2);font-size:14px;font-weight:600;cursor:pointer;transition:all .18s ease}
        .store-filter-item:hover{background:#F8FAFC;color:var(--s-text)}
        .store-filter-item.active{background:color-mix(in srgb, var(--s-primary) 9%, white);border-color:color-mix(in srgb, var(--s-primary) 18%, #E2E8F0);color:var(--s-text)}
        .store-filter-note{font-size:12px;line-height:1.5;color:var(--s-text2)}
        .store-search-input::placeholder{color:#B4BAC5}
        .store-products-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
        .store-toolbar{display:flex;flex-direction:column;gap:12px;padding:16px 18px;border:1px solid rgba(15,23,42,0.08);border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,0.04)}
        @media(min-width:900px){.store-collection-layout{grid-template-columns:280px minmax(0,1fr)}.store-filter-sticky{display:block;position:sticky;top:110px}.store-toolbar{flex-direction:row;align-items:center;justify-content:space-between}.store-products-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(min-width:1180px){.store-products-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
        @media(min-width:560px){.s-badges{grid-template-columns:repeat(2,1fr)}.s-badge-item{border-right:1px solid #F3F4F6;border-bottom:1px solid #F3F4F6}.s-badge-item:nth-child(2n){border-right:none}}
        @media(min-width:900px){.s-badges{grid-template-columns:repeat(4,1fr)}.s-badge-item{border-bottom:none;border-right:1px solid #F3F4F6}.s-badge-item:last-child{border-right:none}}
      `}</style>
      <AnnouncementBar store={store} />
      <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />

      <div className="store-products-shell">
        <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--s-text2)' }}>
            Accueil / Produits
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, color: 'var(--s-text)', margin: 0, letterSpacing: '-0.04em', lineHeight: 0.98, fontFamily: 'var(--s-font)' }}>
              Tous nos produits
            </h1>
            <p style={{ fontSize: 15, color: 'var(--s-text2)', margin: 0, maxWidth: 760 }}>
              Une vraie page collection e-commerce avec filtres, tri et grille produit plus proche d'une boutique Shopify.
            </p>
          </div>
        </div>

        <div className="store-collection-layout">
          <aside className={`store-filter-sticky ${mobileFiltersOpen ? 'is-open' : ''}`}>
            <div className="store-filter-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--s-text2)' }}>Filtres</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--s-text)', marginTop: 4 }}>Collection</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  style={{ display: mobileFiltersOpen ? 'inline-flex' : 'none', border: 'none', background: 'transparent', color: 'var(--s-text2)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--s-text)', marginBottom: 8 }}>Recherche</div>
                <input
                  type="text"
                  placeholder="Rechercher un produit"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="store-search-input"
                  style={{ width: '100%', padding: '13px 14px', borderRadius: 14, border: '1px solid #E5E7EB', fontSize: 14, fontFamily: 'var(--s-font)', color: 'var(--s-text)', backgroundColor: '#fff', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--s-text)', marginBottom: 8 }}>Catégories</div>
                <div className="store-filter-list">
                  <button
                    type="button"
                    className={`store-filter-item ${activeCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('all')}
                  >
                    <span>Tous les produits</span>
                    <span>{products.length}</span>
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`store-filter-item ${activeCategory === cat ? 'active' : ''}`}
                      onClick={() => setActiveCategory(cat)}
                    >
                      <span>{cat}</span>
                      <span>{categoryCountMap[cat] || 0}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--s-text)', marginBottom: 8 }}>Disponibilité</div>
                <div className="store-filter-list">
                  {[
                    { value: 'all', label: 'Tout afficher' },
                    { value: 'in-stock', label: 'En stock' },
                    { value: 'out-of-stock', label: 'Rupture' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`store-filter-item ${availability === option.value ? 'active' : ''}`}
                      onClick={() => setAvailability(option.value)}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--s-text)', marginBottom: 8 }}>Prix</div>
                <div className="store-filter-list">
                  {priceRanges.map((range) => (
                    <button
                      key={range.value}
                      type="button"
                      className={`store-filter-item ${priceRange === range.value ? 'active' : ''}`}
                      onClick={() => setPriceRange(range.value)}
                    >
                      <span>{range.label}</span>
                    </button>
                  ))}
                </div>
                <div className="store-filter-note" style={{ marginTop: 10 }}>
                  Fourchette actuelle: {fmt(minAvailablePrice, store?.currency || 'XAF')} - {fmt(maxAvailablePrice, store?.currency || 'XAF')}
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 16, background: 'linear-gradient(180deg, color-mix(in srgb, var(--s-primary) 8%, white), #fff)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text)', marginBottom: 6 }}>Pourquoi acheter ici</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'var(--s-text2)' }}>
                  <div>Paiement flexible</div>
                  <div>Livraison suivie</div>
                  <div>Support boutique disponible</div>
                </div>
              </div>
            </div>
          </aside>

          <section>
            <div className="store-toolbar" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--s-text)' }}>
                  {sortedProducts.length} article{sortedProducts.length !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: 13, color: 'var(--s-text2)' }}>
                  {activeCategory === 'all' ? 'Toute la collection' : activeCategory}
                </div>
                {(availability !== 'all' || priceRange !== 'all' || search) && (
                  <div style={{ fontSize: 12, color: 'var(--s-text2)' }}>
                    {availability === 'in-stock' ? 'En stock uniquement' : availability === 'out-of-stock' ? 'Produits en rupture' : 'Tous statuts'}
                    {priceRange !== 'all' ? ` · ${activePriceFilter.label}` : ''}
                    {search ? ` · Recherche: ${search}` : ''}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen((value) => !value)}
                  style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid #E5E7EB', backgroundColor: '#fff', color: 'var(--s-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <Menu size={16} />
                  Filtres
                </button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid #E5E7EB', backgroundColor: '#fff', color: 'var(--s-text)', fontSize: 14, fontWeight: 600, outline: 'none', minWidth: 190 }}
                >
                  <option value="featured">Mis en avant</option>
                  <option value="price-asc">Prix croissant</option>
                  <option value="price-desc">Prix décroissant</option>
                  <option value="name-asc">Nom A-Z</option>
                  <option value="name-desc">Nom Z-A</option>
                </select>
                {(activeCategory !== 'all' || availability !== 'all' || priceRange !== 'all' || search) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('all');
                      setAvailability('all');
                      setPriceRange('all');
                      setSearch('');
                    }}
                    style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid #E5E7EB', backgroundColor: '#fff', color: 'var(--s-text2)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>

            {sortedProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <ShoppingBag size={48} style={{ color: '#D1D5DB', marginBottom: 16 }} />
                <p style={{ fontSize: 16, color: 'var(--s-text2)' }}>Aucun produit trouvé.</p>
                {(activeCategory !== 'all' || search) && (
                  <button onClick={() => { setActiveCategory('all'); setSearch(''); }} style={{
                    marginTop: 12, padding: '10px 24px', borderRadius: 40, border: 'none',
                    backgroundColor: 'var(--s-primary)', color: '#fff', fontSize: 14,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--s-font)',
                  }}>Réinitialiser</button>
                )}
              </div>
            ) : (
              <div className="store-products-grid">
                {sortedProducts.map((p) => (
                  <CollectionProductCard key={p._id} product={p} prefix={prefix} store={store} subdomain={store?.subdomain} />
                ))}
              </div>
            )}
          </section>
        </div>

      </div>
      <SharedStorefrontFooter store={store} prefix={prefix} footer={footer} />
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
  const isBuilderPreview = searchParams.get('builderPreview') !== null;

  const { store, sections, products, pixels: innerPixels, footer, legalPages, loading, error } = useStoreData(subdomain);
  const { cartCount } = useStoreCart(subdomain);
  const { isEditMode } = useEditMode();
  const [activeCategory, setActiveCategory] = useState('all');
  const [previewSections, setPreviewSections] = useState(null);

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const filtered = activeCategory === 'all' ? products : products.filter(p => p.category === activeCategory);
  const renderedSections = previewSections || sections;
  const hasSections = Array.isArray(renderedSections) && renderedSections.length > 0;

  useEffect(() => {
    if (!isBuilderPreview) return undefined;

    const handleBuilderMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || payload.type !== 'storefront-builder:update-sections') return;
      const normalizedSections = normalizeHomepageSections(payload.sections ?? null) || [];
      setPreviewSections(normalizedSections);
    };

    window.addEventListener('message', handleBuilderMessage);
    return () => window.removeEventListener('message', handleBuilderMessage);
  }, [isBuilderPreview]);

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

    // Inject pixel scripts + fire PageView
    if (innerPixels) {
      trackStorefrontEvent({
        subdomain,
        pixels: innerPixels,
        eventName: 'PageView',
      });
    }
  }, [store, innerPixels, subdomain]);

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
        renderedSections.filter(s => (isEditMode || s.visible !== false) && !isLegacyStorySection(s)).map(section => (
          <SectionRenderer key={section.id || section.type} section={section} store={store} products={products} prefix={prefix} />
        ))
      ) : (
        <>
          {/* Fallback hero */}
          <section style={{ padding: 'clamp(56px, 10vw, 100px) 24px clamp(48px, 8vw, 80px)', textAlign: 'center', backgroundColor: 'var(--s-primary)' }}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <h1 style={{ fontSize: 'clamp(36px, 7vw, 60px)', fontWeight: 900, lineHeight: 1.08, color: '#fff', margin: '0 0 18px', letterSpacing: '-0.03em', fontFamily: 'var(--s-font)' }}>{store?.name}</h1>
              {store?.description && <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: 'rgba(255,255,255,0.85)', lineHeight: 1.65, margin: '0 0 40px', fontFamily: 'var(--s-font)' }}>{store.description}</p>}
              <Link to={`${prefix}/products`} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 34px', borderRadius: '999px', background: 'var(--sf-cta-bg)', color: 'var(--sf-cta-text)', border: '1px solid var(--sf-cta-border)', fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: 'var(--sf-shadow)' }}>
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
                    <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '7px 17px', borderRadius: '999px', border: '1px solid', borderColor: activeCategory === cat ? 'var(--sf-cta-border)' : 'var(--sf-border)', background: activeCategory === cat ? 'var(--sf-cta-bg)' : 'var(--sf-surface)', color: activeCategory === cat ? 'var(--sf-cta-text)' : 'var(--s-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--s-font)' }}>
                      {cat === 'all' ? 'Tout' : cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
              {filtered.slice(0, 3).map(p => <MemoizedProductCard key={p._id} product={p} prefix={prefix} store={store} subdomain={store?.subdomain} />)}
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
                <Link to={`${prefix}/products`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: '999px', border: '1px solid var(--sf-cta-border)', background: 'var(--sf-cta-bg)', color: 'var(--sf-cta-text)', fontWeight: 700, fontSize: 14, textDecoration: 'none', fontFamily: 'var(--s-font)', boxShadow: 'var(--sf-shadow)' }}>
                  Voir tous les produits <ChevronRight size={16} />
                </Link>
              </div>
            )}
          </section>
        </>
      )}

      <SharedStorefrontFooter store={store} prefix={prefix} footer={footer} />
      
      {/* Mobile Bottom Navigation (visible uniquement sur mobile) */}
      <MobileBottomNav prefix={prefix} cartCount={cartCount} store={store} />
      
      {/* Floating WhatsApp Button */}
      <FloatingWhatsAppButton store={store} />
      
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

// ── Legal Page Component ─────────────────────────────────────────────────────
export const StoreLegalPage = () => {
  const { subdomain: paramSubdomain, pageType } = useParams();
  const { subdomain: detectedSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = paramSubdomain || detectedSubdomain;
  const prefix = isStoreDomain ? '' : (subdomain ? `/store/${subdomain}` : '');

  const { store, footer, legalPages, loading } = useStoreData(subdomain);
  const { cartCount } = useStoreCart(subdomain);

  const validPages = ['confidentialite', 'cgv', 'mentions', 'remboursement'];
  const page = validPages.includes(pageType) ? legalPages?.[pageType] : null;

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: 'var(--s-primary, #0F6B4F)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--s-bg, #fff)', fontFamily: 'var(--s-font, Inter, sans-serif)', color: 'var(--s-text, #111)' }}>
      <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(40px, 6vw, 80px) 20px' }}>
        {page ? (
          <>
            <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, marginBottom: 32, color: 'var(--s-text)' }}>
              {page.title}
            </h1>
            <div
              style={{ fontSize: 15, lineHeight: 1.8, color: '#374151' }}
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Page introuvable</h1>
            <p style={{ color: '#6B7280', marginBottom: 24 }}>Cette page légale n'est pas disponible.</p>
            <Link to={`${prefix}/`} style={{ color: 'var(--s-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Retour à l'accueil
            </Link>
          </div>
        )}
      </div>

      <SharedStorefrontFooter store={store} prefix={prefix} footer={footer} />
    </div>
  );
};

export default PublicStorefront;
