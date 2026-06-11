import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle, AlertCircle, Upload,
  Image as ImageIcon, Copy, ExternalLink, Zap, Package, ArrowRight, ArrowLeft, Star,
  Globe, FileText, Search, Layers, Shield, Smartphone, Megaphone, Crown,
  Users, AlertTriangle, User, Phone, Target, Lock, Clock3, RefreshCw, ChevronRight
} from 'lucide-react';
import TestimonialsCarousel from './TestimonialsCarousel';
import PaymentModalFrame from './PaymentModalFrame.jsx';
import InfographicsGeneratorPanel from './InfographicsGeneratorPanel.jsx';
import ErrorBanner from './ErrorBanner.jsx';
import DigitalProductEbookModal from './DigitalProductEbookModal.jsx';

// Product-generator is mounted at /api/ai/product-generator (outside /api/ecom).
// We must always use API origin only, never a base path like /api/ecom.
const API_ORIGIN = (() => {
  const raw = String(import.meta.env.VITE_BACKEND_URL || '').trim();

  // On scalor.net frontend, always target public API domain.
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }

  if (raw) {
    // Absolute URL -> keep origin only.
    if (/^https?:\/\//i.test(raw)) {
      try {
        return new URL(raw).origin;
      } catch {
        // fallthrough
      }
    }

    // Relative path env like /api/ecom should NOT be reused as base here.
    if (raw.startsWith('/')) {
      if (typeof window !== 'undefined') return window.location.origin;
      return 'https://api.scalor.net';
    }
  }

  return 'https://api.scalor.net';
})();

async function compressImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round((img.width || 1) * scale));
        const height = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          const baseName = file.name.replace(/\.[^.]+$/, '') || `image-${Date.now()}`;
          resolve(new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() }));
        }, 'image/webp', 0.82);
      };

      img.onerror = () => resolve(file);
      img.src = reader.result;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="p-1 text-gray-400 hover:text-scalor-green transition"
      title="Copier"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-scalor-green" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}


function ImagePreview({ src, label, className = '' }) {
  if (!src) return (
    <div className={`flex items-center justify-center bg-gray-100 rounded-xl border border-dashed border-gray-300 ${className}`}>
      <div className="text-center text-gray-400 p-4">
        <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
        <p className="text-xs">Image non disponible</p>
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      <div className={`relative rounded-xl overflow-hidden bg-gray-100 border border-gray-200 ${className}`}>
        <img src={src} alt={label || 'Product image'} className="w-full h-full object-cover" />
      </div>
      {label && <p className="text-xs font-medium text-gray-500 px-1">{label}</p>}
    </div>
  );
}

function GifPreview({ src, label, className = '' }) {
  if (!src) return null;
  return (
    <div className="space-y-2">
      <div className={`relative rounded-xl overflow-hidden bg-gray-100 border border-gray-200 ${className}`}>
        <img
          src={src}
          alt={label || 'GIF généré'}
          className="w-full h-full object-cover"
        />
      </div>
      {label && <p className="text-xs font-medium text-gray-500 px-1">{label}</p>}
    </div>
  );
}

// Typing effect component
function TypingText({ text }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(currentIndex + 1);
      }, 30); // 30ms par caractère pour effet fluide
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text]);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <span className="inline-block">
      {displayedText}
      <span className="inline-block w-0.5 h-4 bg-scalor-green ml-0.5 animate-pulse" />
    </span>
  );
}

const FASHION_SIZES_LETTER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const FASHION_SIZES_NUMERIC = ['36', '38', '40', '42', '44', '46', '48'];
const FASHION_SIZES_SHOES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];
const FASHION_COLORS = [
  { name: 'Noir', hex: '#000000' },
  { name: 'Blanc', hex: '#FFFFFF' },
  { name: 'Gris', hex: '#9CA3AF' },
  { name: 'Beige', hex: '#D6C7A8' },
  { name: 'Rouge', hex: '#DC2626' },
  { name: 'Rose', hex: '#EC4899' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Jaune', hex: '#EAB308' },
  { name: 'Vert', hex: '#16A34A' },
  { name: 'Bleu', hex: '#2563EB' },
  { name: 'Bleu marine', hex: '#1E3A8A' },
  { name: 'Violet', hex: '#7C3AED' },
  { name: 'Marron', hex: '#78350F' },
  { name: 'Doré', hex: '#D4AF37' },
  { name: 'Argenté', hex: '#C0C0C0' },
];
const FASHION_AVATAR_OPTIONS = [
  { value: 'female', label: 'Femme', icon: '👩', hint: 'Portée par une silhouette féminine' },
  { value: 'male', label: 'Homme', icon: '👨', hint: 'Portée par une silhouette masculine' },
];

const VISUAL_TEMPLATES = [
  { id: 'beauty', label: 'Beauté & Cosmétique', icon: Sparkles, desc: 'Crèmes, sérums, soins peau, cheveux, maquillage', border: 'border-slate-300', bg: 'bg-slate-50', iconWrap: 'bg-slate-100 text-slate-700' },
  { id: 'health', label: 'Santé & Nutrition', icon: Shield, desc: 'Compléments, vitamines, minceur, bien-être', border: 'border-slate-300', bg: 'bg-slate-50', iconWrap: 'bg-slate-100 text-slate-700' },
  { id: 'tech', label: 'Tech & Électronique', icon: Smartphone, desc: 'Gadgets, accessoires, appareils, audio', border: 'border-slate-300', bg: 'bg-slate-50', iconWrap: 'bg-slate-100 text-slate-700' },
  { id: 'fashion', label: 'Mode & Accessoires', icon: Crown, desc: 'Vêtements, bijoux, sacs, chaussures, wax', border: 'border-slate-300', bg: 'bg-slate-50', iconWrap: 'bg-slate-100 text-slate-700' },
  { id: 'home', label: 'Maison & Cuisine', icon: Package, desc: 'Déco, cuisine, électroménager, nettoyage', border: 'border-slate-300', bg: 'bg-slate-50', iconWrap: 'bg-slate-100 text-slate-700' },
  { id: 'general', label: 'Autre / Général', icon: Layers, desc: 'Tout type de produit - template polyvalent', border: 'border-slate-300', bg: 'bg-slate-50', iconWrap: 'bg-slate-100 text-slate-700' },
];

const TEMPLATE_THEME_PRESETS = {
  beauty: {
    vibe: 'Élégant, doux, avant/après et rassurance premium.',
    hero: 'Routine éclat en 7 jours',
    subline: 'Palette poudrée, sections soin, bénéfices et témoignages soignés.',
    heroVisual: 'Portrait premium avec produit en main, lumière douce et peau mise en valeur.',
    decorationVisual: 'Formes douces, halos légers, reflets glossy et détails beauté élégants.',
    primary: '#BE185D',
    accent: '#F9A8D4',
    background: '#FFF7FB',
    surface: '#FFFFFF',
    text: '#3F1D2E',
    cta: 'Découvrir le soin',
  },
  health: {
    vibe: 'Crédible, clair et axé résultats.',
    hero: 'Retrouvez votre équilibre naturellement',
    subline: 'Univers propre, confiance, preuves d’usage et bénéfices structurés.',
    heroVisual: 'Scène bien-être crédible avec produit visible, posture rassurante et résultat concret.',
    decorationVisual: 'Icônes simples, repères santé, ambiance clean et éléments naturels subtils.',
    primary: '#166534',
    accent: '#86EFAC',
    background: '#F3FFF7',
    surface: '#FFFFFF',
    text: '#16331F',
    cta: 'Commencer la cure',
  },
  tech: {
    vibe: 'Contrasté, moderne et orienté performance.',
    hero: 'La technologie qui simplifie tout',
    subline: 'Sections specs, gains immédiats et visuels très démonstratifs.',
    heroVisual: 'Packshot contrasté avec mise en situation moderne et produit ultra net.',
    decorationVisual: 'Lignes techniques, reflets lumineux, repères de performance et overlays propres.',
    primary: '#2563EB',
    accent: '#93C5FD',
    background: '#F4F8FF',
    surface: '#FFFFFF',
    text: '#14243F',
    cta: 'Voir la démo',
  },
  fashion: {
    vibe: 'Éditorial, statutaire et très visuel.',
    hero: 'Affirmez votre style instantanément',
    subline: 'Couleurs mode, storytelling, focus détails et silhouettes.',
    heroVisual: 'Silhouette éditoriale, pose mode naturelle et focus matière ou coupe.',
    decorationVisual: 'Cadres fins, détails lookbook, répétitions graphiques et ambiance magazine.',
    primary: '#7C3AED',
    accent: '#C4B5FD',
    background: '#FAF7FF',
    surface: '#FFFFFF',
    text: '#2E1A47',
    cta: 'Adopter le look',
  },
  home: {
    vibe: 'Chaleureux, pratique et orienté quotidien.',
    hero: 'Rendez votre maison plus simple à vivre',
    subline: 'Tons doux, démonstrations d’usage et bénéfices concrets.',
    heroVisual: 'Scène maison réaliste montrant le vrai problème résolu par le produit dans son contexte exact: salle de bain, WC, cuisine ou surface concernée, avec usage naturel et bénéfice visible.',
    decorationVisual: 'Textures chaleureuses, repères pratiques, pictos simples et ambiance conviviale.',
    primary: '#B45309',
    accent: '#FCD34D',
    background: '#FFF9EF',
    surface: '#FFFFFF',
    text: '#4A2B12',
    cta: 'Équiper ma maison',
  },
  general: {
    vibe: 'Polyvalent, équilibré et facile à adapter.',
    hero: 'Le template flexible pour tout produit',
    subline: 'Structure neutre, blocs conversion et palette sobre personnalisable.',
    heroVisual: 'Visuel produit clair, contexte réel et mise en avant immédiate du bénéfice principal.',
    decorationVisual: 'Décors sobres, repères e-commerce premium et éléments graphiques discrets.',
    primary: '#0F6B4F',
    accent: '#96C7B5',
    background: '#F5FBF8',
    surface: '#FFFFFF',
    text: '#18352C',
    cta: 'Voir l’offre',
  },
};

const buildTemplateTheme = (templateId) => ({
  templateId,
  ...(TEMPLATE_THEME_PRESETS[templateId] || TEMPLATE_THEME_PRESETS.general),
});

const buildGeneratedProductPageConfig = (templateTheme, product = {}, pageStyle = 'classic') => {
  const digitalConversion = product.productPageConfig?.conversion || null;
  return {
    pageStyle,
    design: {
      buttonColor: templateTheme.primary,
      ctaButtonColor: templateTheme.primary,
      badgeColor: templateTheme.accent,
      backgroundColor: templateTheme.background,
      textColor: templateTheme.text,
      fieldTextColor: templateTheme.text,
      fieldBgColor: templateTheme.surface,
    },
    button: {
      text: product.hero_cta || templateTheme.cta || 'Commander maintenant',
    },
    ...(digitalConversion ? { conversion: digitalConversion } : {}),
  };
};

function FinalPagePreview({ product, templateTheme, selectedTemplate }) {
  if (!product) return null;

  const accent = templateTheme.primary;
  const textDark = templateTheme.text || '#1C1917';
  const textSoft = `${textDark}AA`;
  const accentLight = `${accent}18`;
  const accentMid = `${accent}30`;
  const bgPage = '#FDFAF6';

  const beforeAfterGallery = Array.isArray(product.beforeAfterImages) && product.beforeAfterImages.length > 0
    ? product.beforeAfterImages.map((url, index) => ({ url, alt: `Avant / Après ${index + 1}` }))
    : (product.beforeAfterImage ? [{ url: product.beforeAfterImage, alt: 'Avant / Après' }] : []);

  const gallery = [
    ...(product.heroImage ? [{ url: product.heroImage, alt: product.title || 'Hero' }] : []),
    ...beforeAfterGallery,
    ...(product.heroPosterImage ? [{ url: product.heroPosterImage, alt: `Affiche ${product.title || 'Produit'}` }] : []),
    ...((product.angles || []).filter((angle) => angle.poster_url).map((angle, index) => ({ url: angle.poster_url, alt: angle.titre_angle || `Angle ${index + 1}` }))),
    ...((product.realPhotos || []).map((url, index) => ({ url, alt: `Photo ${index + 1}` }))),
  ].filter((image, index, array) => image?.url && array.findIndex((entry) => entry.url === image.url) === index);

  const stats = Array.isArray(product.stats_bar) ? product.stats_bar.slice(0, 3) : [];
  const benefits = Array.isArray(product.benefits_bullets) ? product.benefits_bullets.slice(0, 6) : [];
  const conversionBlocks = Array.isArray(product.conversion_blocks) ? product.conversion_blocks.slice(0, 4) : [];
  const testimonials = Array.isArray(product.testimonials) ? product.testimonials : [];
  const faq = Array.isArray(product.faq) ? product.faq.slice(0, 5) : [];
  const angles = (product.angles || []).filter(a => a.poster_url);

  // Extract ingredients / composition from product data
  const ingredients = Array.isArray(product.raisons_acheter) ? product.raisons_acheter.slice(0, 6) : [];

  // Clean formula: pain_points as negatives, benefits as positives
  const negatives = Array.isArray(product.problem_section?.pain_points) ? product.problem_section.pain_points.slice(0, 3) : [];
  const positives = benefits.slice(0, 3);

  const BENEFIT_ICONS = ['✨','💧','🌿','⚡','🛡️','🌟','💪','🔬','🎯','✅'];

  const panelStyle = {
    background: '#ffffff',
    border: `1.5px solid ${accentMid}`,
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  };

  const labelStyle = {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: accent,
    background: accentLight,
    borderRadius: '20px',
    padding: '3px 12px',
    marginBottom: '8px',
  };

  return (
    <div style={{ background: bgPage, borderRadius: '28px', overflow: 'hidden', border: `1.5px solid ${accentMid}`, boxShadow: '0 24px 80px rgba(15,23,42,0.10)' }}>
      {/* Browser bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#fff', borderBottom: `1px solid ${accentMid}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FCA5A5' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FDE68A' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6EE7B7' }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: textSoft }}>boutique-preview.scalor.app</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: accent, background: accentLight, padding: '2px 10px', borderRadius: 20 }}>{selectedTemplate.label}</div>
      </div>

      <div style={{ maxHeight: '72vh', overflowY: 'auto', padding: '20px' }}>
        {/* 2-column panel grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

          {/* ── Panel 1: Hero produit + headline + CTA ── */}
          <div style={panelStyle}>
            {/* Image */}
            <div style={{ aspectRatio: '1/1', background: accentLight, overflow: 'hidden' }}>
              {gallery[0]?.url
                ? <img src={gallery[0].url} alt={gallery[0].alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, opacity: 0.3 }}><ImageIcon style={{ width: 40, height: 40 }} /></div>
              }
            </div>
            <div style={{ padding: '16px' }}>
              {product.hero_headline && (
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 900, lineHeight: 1.2, color: textDark }}>
                  {product.hero_headline.split(' ').map((word, i) => (
                    i % 4 === 2 ? <span key={i} style={{ color: accent }}>{word} </span> : <span key={i}>{word} </span>
                  ))}
                </h2>
              )}
              {product.hero_slogan && <p style={{ margin: '6px 0 0', fontSize: 11, color: textSoft, lineHeight: 1.5 }}>{product.hero_slogan}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {product.urgency_badge && (
                  <span style={{ fontSize: 10, fontWeight: 800, background: accentLight, color: accent, borderRadius: 20, padding: '3px 10px', border: `1px solid ${accentMid}` }}>
                    {product.urgency_badge}
                  </span>
                )}
                <span style={{ fontSize: 10, fontWeight: 800, background: '#f0fdf4', color: '#15803d', borderRadius: 20, padding: '3px 10px', border: '1px solid #bbf7d0' }}>
                  Paiement à la livraison
                </span>
              </div>
              {product.hero_cta && (
                <button type="button" style={{ marginTop: 12, width: '100%', background: accent, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 0', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
                  {product.hero_cta}
                </button>
              )}
            </div>
          </div>

          {/* ── Panel 2: Bénéfices en grille d'icônes ── */}
          <div style={{ ...panelStyle, background: accentLight }}>
            {/* Model / poster image top half */}
            {(gallery[1]?.url || gallery[2]?.url) && (
              <div style={{ height: '160px', overflow: 'hidden', background: '#fff' }}>
                <img src={gallery[1]?.url || gallery[2]?.url} alt="visuel" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ padding: '14px' }}>
              <div style={labelStyle}>{benefits.length} bénéfices clés</div>
              <h3 style={{ margin: '4px 0 12px', fontSize: 15, fontWeight: 900, color: textDark }}>
                DANS <span style={{ color: accent }}>CHAQUE UTILISATION</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {benefits.slice(0, 6).map((b, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: 18 }}>{BENEFIT_ICONS[i] || '✅'}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: textDark, lineHeight: 1.3 }}>{b.replace(/^✓\s*/,'').slice(0, 28)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Panel 3: Composition / Ingrédients ── */}
          <div style={{ ...panelStyle, background: '#FFFBF5' }}>
            <div style={{ padding: '16px' }}>
              <div style={labelStyle}>Composition</div>
              <h3 style={{ margin: '4px 0 14px', fontSize: 15, fontWeight: 900, color: textDark }}>
                {product.solution_section?.title || 'FORMULE PUISSANTE'}
              </h3>
              {/* Product image center + ingredients around */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {gallery[0]?.url && (
                  <div style={{ flexShrink: 0, width: 80, height: 80, borderRadius: 14, overflow: 'hidden', border: `2px solid ${accentMid}` }}>
                    <img src={gallery[0].url} alt="produit" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(ingredients.length > 0 ? ingredients : benefits).slice(0, 4).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 10, padding: '5px 10px', border: `1px solid ${accentMid}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: textDark, lineHeight: 1.3 }}>{item.replace(/^[✓✅]\s*/,'').slice(0, 32)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {product.solution_section?.description && (
                <p style={{ margin: '12px 0 0', fontSize: 10, color: textSoft, lineHeight: 1.6 }}>{product.solution_section.description.slice(0, 120)}…</p>
              )}
            </div>
          </div>

          {/* ── Panel 4: Avant / Après ── */}
          <div style={panelStyle}>
            <div style={{ padding: '14px 14px 0' }}>
              <div style={labelStyle}>Résultats</div>
              <h3 style={{ margin: '4px 0 12px', fontSize: 15, fontWeight: 900, color: textDark }}>
                VISIBLE EN <span style={{ color: accent }}>QUELQUES JOURS !</span>
              </h3>
            </div>
            {beforeAfterGallery[0]?.url ? (
              <div style={{ margin: '0 14px 14px', borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${accentMid}` }}>
                <img src={beforeAfterGallery[0].url} alt="avant/après" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ margin: '0 14px 14px', borderRadius: 14, overflow: 'hidden', border: `1.5px dashed ${accentMid}`, height: 120, background: accentLight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 24 }}>🔄</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: accent }}>Avant / Après</span>
              </div>
            )}
            {/* Stat bar below */}
            {stats.length > 0 && (
              <div style={{ display: 'flex', gap: 6, padding: '0 14px 14px' }}>
                {stats.slice(0, 2).map((s, i) => (
                  <div key={i} style={{ flex: 1, background: accent, color: '#fff', borderRadius: 10, padding: '6px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, lineHeight: 1.3 }}>{s}</div>
                ))}
              </div>
            )}
          </div>

          {/* ── Panel 5: Usage / Zones + liste bullets ── */}
          <div style={panelStyle}>
            {/* Hero / model image */}
            {(gallery[2]?.url || gallery[1]?.url) && (
              <div style={{ height: '150px', overflow: 'hidden' }}>
                <img src={gallery[2]?.url || gallery[1]?.url} alt="usage" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ padding: '14px' }}>
              <div style={labelStyle}>Usage</div>
              <h3 style={{ margin: '4px 0 12px', fontSize: 15, fontWeight: 900, color: textDark }}>
                {product.hero_baseline || <><span style={{ color: accent }}>IDÉAL POUR</span> TOUTE LA FAMILLE</>}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(conversionBlocks.length > 0 ? conversionBlocks.map(b => b.text) : benefits).slice(0, 5).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0, boxShadow: `0 0 0 3px ${accentLight}` }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: textDark, lineHeight: 1.4 }}>{typeof item === 'string' ? item.replace(/^[✓✅]\s*/,'') : item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Panel 6: Formule propre / checklist ── */}
          <div style={{ ...panelStyle, background: '#F9FAFB' }}>
            <div style={{ padding: '16px' }}>
              <div style={labelStyle}>Formule</div>
              <h3 style={{ margin: '4px 0 14px', fontSize: 15, fontWeight: 900, color: textDark }}>
                PROPRE <span style={{ color: accent }}>& ÉTHIQUE</span>
              </h3>
              {/* Negatives */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
                {negatives.slice(0, 3).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>✕</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: textDark, lineHeight: 1.4 }}>{item.slice(0, 40)}</span>
                  </div>
                ))}
              </div>
              {/* Positives */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {positives.slice(0, 3).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>✓</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: textDark, lineHeight: 1.4 }}>{item.replace(/^[✓✅]\s*/,'').slice(0, 40)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Product image bottom */}
            {gallery[0]?.url && (
              <div style={{ margin: '0 14px 14px', borderRadius: 14, overflow: 'hidden', height: 80, border: `1px solid ${accentMid}` }}>
                <img src={gallery[0].url} alt="produit" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
          </div>
        </div>

        {/* ── Section témoignages (pleine largeur) ── */}
        {testimonials.length > 0 && (
          <div style={{ marginTop: 14, background: '#fff', borderRadius: 20, border: `1.5px solid ${accentMid}`, padding: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
            <div style={labelStyle}>Avis clients</div>
            <div style={{ marginTop: 4 }}>
              <TestimonialsCarousel
                testimonials={testimonials.map((t) => ({
                  name: t.name, location: t.location, text: t.text,
                  rating: t.rating || 5, verified: t.verified !== false, date: t.date,
                }))}
                autoPlay={false}
              />
            </div>
          </div>
        )}

        {/* ── FAQ ── */}
        {faq.length > 0 && (
          <div style={{ marginTop: 14, background: '#fff', borderRadius: 20, border: `1.5px solid ${accentMid}`, padding: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
            <div style={labelStyle}>Questions fréquentes</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {faq.map((item, i) => (
                <div key={i} style={{ borderRadius: 14, border: `1px solid ${accentMid}`, background: accentLight, padding: '10px 14px' }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: textDark }}>{item.question}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: textSoft, lineHeight: 1.6 }}>{item.reponse}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 10, color: textSoft, paddingBottom: 4 }}>
          Aperçu storefront · Direction visuelle {selectedTemplate.label.toLowerCase()}
        </div>
      </div>
    </div>
  );
}

const PRODUCT_SUBSTEPS = [
  { id: 1, label: 'Direction', title: 'Direction visuelle', description: 'Choisis l\'univers visuel des affiches et visuels générés. Le thème final de la page suivra celui de la boutique.', icon: Layers },
  { id: 2, label: 'Source', title: 'Source du produit', description: 'Choisis le mode puis ajoute le lien ou la description à analyser.', icon: Globe },
  { id: 3, label: 'Photos', title: 'Photos réelles du produit', description: 'Ajoute les photos réelles qui serviront de base aux visuels générés.', icon: Upload },
];

const COPYWRITING_APPROACHES = [
  {
    value: 'PAS',
    label: 'PAS',
    icon: Target,
    desc: 'Problème -> Agitation -> Solution',
    detail: 'Montre le problème, amplifie la douleur, puis présente ton produit comme la solution évidente.'
  },
  {
    value: 'AIDA',
    label: 'AIDA',
    icon: Zap,
    desc: 'Attention -> Intérêt -> Désir -> Action',
    detail: 'Capte l\'attention, éveille la curiosité, crée l\'envie et pousse à l\'achat.'
  },
  {
    value: 'BAB',
    label: 'BAB',
    icon: Sparkles,
    desc: 'Before -> After -> Bridge',
    detail: 'Montre la vie avant, peint la vie après, et le produit fait le pont entre les deux.'
  }
];

const COPYWRITING_SUBSTEPS = ['Méthode'];
const TARGETING_SUBSTEPS = ['Avatar', 'Problème'];

const TARGET_GENDER_OPTIONS = [
  { value: 'auto', label: 'Auto', hint: 'L’IA déduit selon le produit' },
  { value: 'female', label: 'Femme', hint: 'Audience majoritairement féminine' },
  { value: 'male', label: 'Homme', hint: 'Audience majoritairement masculine' },
  { value: 'mixed', label: 'Les deux', hint: 'Audience mixte / unisexe' },
];

const TARGET_AGE_OPTIONS = [
  { value: 'auto', label: 'Âge auto' },
  { value: '18-24', label: '18-24 ans' },
  { value: '25-34', label: '25-34 ans' },
  { value: '35-44', label: '35-44 ans' },
  { value: '45-54', label: '45-54 ans' },
  { value: '55+', label: '55 ans et plus' },
];

const TARGET_PROFILE_OPTIONS = [
  { value: 'auto', label: 'Profil auto' },
  { value: 'general', label: 'Grand public' },
  { value: 'urban_active', label: 'Actif urbain' },
  { value: 'parent', label: 'Parent / maman / papa' },
  { value: 'student', label: 'Étudiant / jeune actif' },
  { value: 'professional', label: 'Professionnel' },
  { value: 'sporty', label: 'Sportif / lifestyle actif' },
  { value: 'premium', label: 'Client premium' },
  { value: 'senior', label: 'Senior' },
];

const TARGET_GENDER_LABELS = {
  auto: '',
  female: 'femme',
  male: 'homme',
  mixed: 'hommes et femmes',
};

const TARGET_PROFILE_LABELS = {
  auto: '',
  general: 'grand public',
  urban_active: 'actif urbain',
  parent: 'parent actif',
  student: 'etudiant ou jeune actif',
  professional: 'professionnel',
  sporty: 'profil sportif et actif',
  premium: 'client premium',
  senior: 'senior',
};

function buildTargetAvatarSummary({ gender = 'auto', ageRange = 'auto', profile = 'auto' } = {}) {
  const parts = [
    TARGET_GENDER_LABELS[gender],
    ageRange !== 'auto' ? `${ageRange} ans` : '',
    TARGET_PROFILE_LABELS[profile],
  ].filter(Boolean);

  return parts.join(', ');
}

const IMAGE_GENERATION_MODES = [
  {
    id: 'standard',
    label: 'Visuels IA classiques',
    description: 'Le modèle génère les visuels dans un cadrage standard, plus polyvalent pour la boutique.',
  },
  {
    id: 'ad_4_5',
    label: 'Visuels IA en 4:5',
    description: 'Le modèle génère les visuels en vertical 4:5, plus adaptés aux creatives publicitaires.',
  },
];

const ProductPageGeneratorModal = ({ onClose, onApply, pageMode = false, initialTaskId = null, initialPageStyle = 'classic' }) => {
  const normalizedInitialPageStyle = ['classic', 'infographics', 'hero_page', 'hero'].includes(initialPageStyle)
    ? initialPageStyle
    : 'classic';
  // Helper to extract workspaceId from ecomWorkspace JSON in localStorage
  const getWsId = () => {
    try { const ws = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null'); return ws?._id || ws?.id || ''; }
    catch { return ''; }
  };
  const getAuthHeaders = () => {
    const token = localStorage.getItem('ecomToken');
    const wsId = getWsId();
    const h = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (wsId) h['X-Workspace-Id'] = wsId;
    return h;
  };

  const DRAFT_KEY = 'generatedProductDraft';
  const GENERATION_PAYMENT_TOKEN_KEY = 'mf_pending_generation_token';
  const GENERATION_PAYMENT_SESSION_KEY = 'mf_pending_generation_payment';
  const saveDraft = (productData, templateId) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ product: productData, visualTemplate: templateId, savedAt: Date.now() }));
    } catch {}
  };
  const loadDraft = () => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); }
    catch { return null; }
  };
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

  const [phase, setPhase] = useState('input');
  const [draftBanner, setDraftBanner] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem('generatedProductDraft') || 'null');
      return d?.product ? d : null;
    } catch { return null; }
  });
  const [step, setStep] = useState(1); // 1: Base info, 2: Copywriting, 3: Advanced (optional)
  const [pageStyle, setPageStyle] = useState(normalizedInitialPageStyle); // 'classic' | 'infographics' | 'hero_page' | 'hero'
  const [productSubstep, setProductSubstep] = useState(1);
  const [inputMode, setInputMode] = useState('url'); // 'url' ou 'description'
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [visualTemplate, setVisualTemplate] = useState('beauty');
  const [fashionAvatar, setFashionAvatar] = useState('female'); // 'female' | 'male'
  const [fashionSizes, setFashionSizes] = useState([]); // ['S','M','L','XL']
  const [fashionColors, setFashionColors] = useState([]); // [{name, hex}]
  const [fashionMinimalist, setFashionMinimalist] = useState(true);

  // ── Hero image builder (mode gratuit — canvas only, no AI) ────────────────
  const heroCanvasRef = useRef(null);
  const [heroFile, setHeroFile] = useState(null);       // File
  const [heroImg, setHeroImg] = useState(null);         // HTMLImageElement
  const [heroName, setHeroName] = useState('');
  const [heroTagline, setHeroTagline] = useState('');
  const [heroPrice, setHeroPrice] = useState('');
  const [heroCta, setHeroCta] = useState('Commander maintenant');
  const [heroBadge, setHeroBadge] = useState('Livraison gratuite');
  const [heroAccent, setHeroAccent] = useState('#0F6B4F');
  const [heroDragOver, setHeroDragOver] = useState(false);
  const [customPrimaryColor, setCustomPrimaryColor] = useState(null); // null = suit le template, hex = couleur custom
  const [templateTheme, setTemplateTheme] = useState(() => buildTemplateTheme('beauty'));
  const [heroVisualDirection, setHeroVisualDirection] = useState(() => buildTemplateTheme('beauty').heroVisual || '');
  const [decorationDirection, setDecorationDirection] = useState(() => buildTemplateTheme('beauty').decorationVisual || '');
  const [marketingApproach, setMarketingApproach] = useState('PAS'); // PAS, AIDA, BAB
  const [currentStep, setCurrentStep] = useState(0);
  const [stepLabel, setStepLabel] = useState('');
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('page');
  const [dragOver, setDragOver] = useState(false);
  const [generationsInfo, setGenerationsInfo] = useState(null); // { remaining, totalUsed }
  const [limitReached, setLimitReached] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentName, setPaymentName] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentChecking, setPaymentChecking] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState('');
  const [paymentStatusError, setPaymentStatusError] = useState('');
  const [pendingGenerationToken, setPendingGenerationToken] = useState(() => sessionStorage.getItem(GENERATION_PAYMENT_TOKEN_KEY) || null);
  const [pendingGenerationPayment, setPendingGenerationPayment] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(GENERATION_PAYMENT_SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const [selectedPack, setSelectedPack] = useState(null); // 'unit' | 'pack3'
  const [pricing, setPricing] = useState({ unit: 1000, pack3: 2500 });
  
  // États copywriting simplifiés
  const [tone, setTone] = useState('urgence');
  const [targetGender, setTargetGender] = useState('auto');
  const [targetAgeRange, setTargetAgeRange] = useState('auto');
  const [targetProfile, setTargetProfile] = useState('auto');
  const [mainProblem, setMainProblem] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageGenerationMode, setImageGenerationMode] = useState('standard');
  
  // AI Store Builder states
  const [buildStep, setBuildStep] = useState(0); // 0-4
  const [buildProgress, setBuildProgress] = useState(0); // 0-100
  const [buildMessage, setBuildMessage] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [imageJobId, setImageJobId] = useState(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  // État d'échec image — si la génération se termine sans aucune image, on
  // affiche un message + retry au lieu d'aller en preview avec des placeholders.
  const [imageGenerationFailed, setImageGenerationFailed] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [digitalProductLoading, setDigitalProductLoading] = useState(false);
  const [digitalProductNotice, setDigitalProductNotice] = useState('');
  const [showDigitalProductModal, setShowDigitalProductModal] = useState(false);
  const [digitalProductError, setDigitalProductError] = useState('');
  const [digitalProductResult, setDigitalProductResult] = useState(null);
  const [infographicsTaskResult, setInfographicsTaskResult] = useState(null);
  const [backgroundTasks, setBackgroundTasks] = useState([]);
  const [showTaskList, setShowTaskList] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const readerRef = useRef(null);
  const isGeneratingRef = useRef(false);
  const taskPollRef = useRef(null);
  const zeroCreditPromptRef = useRef(false);

  const isValidUrl = url.trim().length > 10 && (url.startsWith('http://') || url.startsWith('https://'));
  const hasValidDescription = description.trim().length > 20;
  const hasRequiredPhotos = photos.length > 0;
  const totalProductSubsteps = PRODUCT_SUBSTEPS.length;
  const selectedTemplate = VISUAL_TEMPLATES.find((template) => template.id === visualTemplate) || VISUAL_TEMPLATES[0];
  const usesStandardProductGenerator = ['classic', 'hero_page'].includes(pageStyle);
  const targetAvatarSummary = buildTargetAvatarSummary({
    gender: targetGender,
    ageRange: targetAgeRange,
    profile: targetProfile,
  });
  const visibleSteps = [
    {
      num: 1,
      label: 'Produit',
      details: PRODUCT_SUBSTEPS.map((substep) => substep.label),
      currentDetail: PRODUCT_SUBSTEPS[productSubstep - 1]?.label,
      progress: `${productSubstep}/${PRODUCT_SUBSTEPS.length}`,
    },
    {
      num: 2,
      label: 'Copywriting',
      details: COPYWRITING_SUBSTEPS,
      currentDetail: marketingApproach || COPYWRITING_SUBSTEPS[0],
      progress: '1/1',
    },
    {
      num: 3,
      label: 'Ciblage',
      details: TARGETING_SUBSTEPS,
      currentDetail: targetAvatarSummary || mainProblem.trim() ? 'Personnalisation' : TARGETING_SUBSTEPS[0],
      progress: '2/2',
    },
  ];
  // Bloquer le scroll du body quand le modal est ouvert
  useEffect(() => {
    if (pageMode) return undefined;

    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [pageMode]);

  useEffect(() => {
    const nextTheme = buildTemplateTheme(visualTemplate);
    setTemplateTheme(prev => ({
      ...nextTheme,
      primary: customPrimaryColor || nextTheme.primary,
      accent: customPrimaryColor ? customPrimaryColor + '66' : nextTheme.accent,
    }));
    setHeroVisualDirection(nextTheme.heroVisual || '');
    setDecorationDirection(nextTheme.decorationVisual || '');
  }, [visualTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (customPrimaryColor) {
      setTemplateTheme(prev => ({
        ...prev,
        primary: customPrimaryColor,
        accent: customPrimaryColor + '66',
      }));
    } else {
      const base = buildTemplateTheme(visualTemplate);
      setTemplateTheme(prev => ({ ...prev, primary: base.primary, accent: base.accent }));
    }
  }, [customPrimaryColor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for background image generation
  useEffect(() => {
    if (!imageJobId || (phase !== 'preview' && phase !== 'loading')) return;
    setImagesLoading(true);
    let cancelled = false;
    const authHeaders = getAuthHeaders();
    const pollStart = Date.now();
    const MAX_POLL_MS = 60 * 60 * 1000; // 60 min — aligné sur le timeout backend "illimité" : on attend la fin de génération au lieu d'abandonner

    const finishPoll = (data) => {
      // Merge whatever images arrived (may be partial or empty on error/timeout)
      const imgs = (data && data.images) || {};

      // ── Compte d'images réellement reçues — détecte "0 images générées"
      const receivedCount = (data?.generatedImageCount ?? [
        imgs.heroImage,
        ...(imgs.beforeAfterImages || []),
        ...(imgs.socialProofImages || []),
        ...((imgs.angles || []).map((a) => a?.poster_url).filter(Boolean)),
      ].filter(Boolean).length);

      const missingCount = data?.missingImageCount ?? 0;

      // Si AUCUNE image générée OU s'il manque des images attendues → on ne va PAS
      // en preview avec des placeholders vides : on reste sur l'écran de chargement
      // transformé en état d'échec, avec retry.
      // Also treat timeout (data === null) with no images as a failure.
      const generationCompletelyFailed =
        (!data && receivedCount === 0) ||
        ((data?.status === 'partial_failure' || data?.status === 'error' || data?.status === 'not_found')
        && (receivedCount === 0 || missingCount > 0));

      setProduct(prev => {
        if (!prev) return prev;
        const newAngles = prev.angles?.map((a, i) => {
          const bgAngle = imgs.angles?.find(ba => ba.index === i + 1);
          return bgAngle ? { ...a, poster_url: bgAngle.poster_url, flashType: bgAngle.flashType || a?.flashType || null } : a;
        }) || [];
        const peoplePhotos = Array.isArray(imgs.peoplePhotos) ? imgs.peoplePhotos : (prev.peoplePhotos || []);
        const beforeAfterImages = Array.isArray(imgs.beforeAfterImages) ? imgs.beforeAfterImages : (prev.beforeAfterImages || []);
        const socialProofImages = Array.isArray(imgs.socialProofImages)
          ? imgs.socialProofImages
          : (prev.socialProofImages || []);
        const descriptionGifs = Array.isArray(imgs.descriptionGifs) ? imgs.descriptionGifs : (prev.descriptionGifs || []);
        const allImages = [
          ...peoplePhotos,
          ...socialProofImages,
          ...(imgs.heroImage ? [imgs.heroImage] : []),
          ...(imgs.heroPosterImage ? [imgs.heroPosterImage] : []),
          ...beforeAfterImages,
          ...newAngles.map(a => a.poster_url).filter(Boolean)
        ];
        return {
          ...prev,
          heroImage: imgs.heroImage || prev.heroImage,
          heroPosterImage: imgs.heroPosterImage || prev.heroPosterImage || newAngles.find(a => a.poster_url)?.poster_url || null,
          beforeAfterImage: imgs.beforeAfterImage || prev.beforeAfterImage,
          beforeAfterImages,
          angles: newAngles,
          peoplePhotos,
          socialProofImages,
          descriptionGifs,
          allImages: [...(prev.allImages || []), ...allImages].filter((v, i, a) => v && a.indexOf(v) === i),
        };
      });
      setImagesLoading(false);
      setImageJobId(null);
      // Save draft with whatever images we got
      setProduct(prev2 => { if (prev2) saveDraft(prev2, visualTemplate); return prev2; });

      // ── BUG FIX : si AUCUNE image n'a été générée, on reste sur l'écran loading
      // avec un état d'erreur clair + retry. On NE célèbre PAS avec confettis,
      // on NE va PAS en preview avec des placeholders vides.
      if (generationCompletelyFailed) {
        setBuildProgress(100);
        setBuildMessage('');
        setShowConfetti(false);
        setImageGenerationFailed({
          message: data?.errorMessage || (!data
            ? "La génération d'images prend plus de temps que prévu. Vous pouvez réessayer ou revenir plus tard — le contenu texte est sauvegardé."
            : "Aucune image n'a pu être générée. Le service de génération est peut-être indisponible, ou la photo source ne permet pas la génération image-to-image."),
          status: data?.status || 'timeout',
        });
        return; // ← important : on reste en phase 'loading' avec l'état d'échec
      }

      // Sinon, on continue normalement vers preview
      setImageGenerationFailed(null);
      setBuildProgress(100);
      setBuildMessage('Votre page est prête.');
      setShowConfetti(true);
      setTimeout(() => {
        setShowConfetti(false);
        setPhase('preview');
        setActiveTab('page');
      }, 2000);
    };

    const poll = async () => {
      if (cancelled) return;

      // Hard timeout — stop after MAX_POLL_MS and show whatever text/images we have
      if (Date.now() - pollStart > MAX_POLL_MS) {
        console.warn('⏱️ Image polling timeout — showing page with available content');
        finishPoll(null);
        return;
      }

      try {
        const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/images/${imageJobId}`, {
          headers: authHeaders
        });
        if (!resp.ok || cancelled) {
          if (!cancelled) setTimeout(poll, 4000);
          return;
        }
        const data = await resp.json();
        if (cancelled) return;

        // Terminal statuses: done, partial_failure (0 images), error, or not_found
        if (data.status === 'done' || data.status === 'partial_failure' || data.status === 'error' || data.status === 'not_found') {
          finishPoll(data);
          return; // Stop polling
        }

        // Still generating — update progress bar and poll again in 3s
        if (!cancelled) {
          if (data.total > 0) {
            const imgProgress = Math.min(98, 90 + Math.round((data.progress / data.total) * 8));
            setBuildProgress(imgProgress);
          }
          const elapsed = Math.floor((Date.now() - pollStart) / 1000);
          if (elapsed < 30) setBuildMessage('Génération des visuels en cours...');
          else if (elapsed < 60) setBuildMessage('Création des images marketing...');
          else setBuildMessage('Finalisation des visuels...');
          setTimeout(poll, 3000);
        }
      } catch {
        if (!cancelled) setTimeout(poll, 4000);
      }
    };

    // Start first poll after 2s (images take time to start generating)
    const timer = setTimeout(poll, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [imageJobId, phase]);

  // Fetch background tasks on mount & poll active ones
  useEffect(() => {
    const authHeaders = getAuthHeaders();
    if (!authHeaders.Authorization) return;

    const fetchTasks = async () => {
      try {
        const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks`, {
          headers: authHeaders,
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.success) setBackgroundTasks(data.tasks || []);
      } catch {}
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handler: continue generation in background
  const handleContinueInBackground = () => {
    // Stop polling images in foreground — backend continues generating
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    // Navigate to Generations page where user can track progress
    if (onClose) onClose();
  };

  // Handler: load completed task into preview
  const handleLoadTask = async (taskId) => {
    try {
      const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${taskId}`, {
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error('Erreur chargement');
      const data = await resp.json();
      if (data.success && data.task?.product) {
        if (data.task.product.layout === 'infographics' || data.task.product.pageStyle === 'infographics') {
          setInfographicsTaskResult(data.task.product.infographicsResult || data.task.product);
          setPageStyle('infographics');
          setShowTaskList(false);
          setPhase('input');
          setActiveTab('page');
          return;
        }

        if (data.task.product.pageStyle === 'premium'
          || data.task.product.layout === 'premium_product_page'
          || data.task.product.theme === 'premium_product'
          || data.task.product.premium_page) {
          setError('Cette génération est une page produit premium. Ouvre-la avec le générateur premium séparé.');
          setShowTaskList(false);
          return;
        }

        setInfographicsTaskResult(null);
        setPageStyle('classic');
        setProduct(data.task.product);
        if (data.task.product.visualTemplate) {
          setVisualTemplate(data.task.product.visualTemplate);
        }
        setShowTaskList(false);
        setCurrentTaskId(taskId);

        // ── Décision : preview OU loading + polling ──
        // Si la tâche est encore en cours OU s'il manque des images attendues, on
        // reste sur l'écran de chargement et on reprend le polling au lieu de
        // montrer un preview avec des placeholders "Affiche non générée".
        const taskStatus = data.task.status;
        const isStillGenerating = ['pending', 'generating_text', 'generating_images'].includes(taskStatus);
        const imgs = data.task.images || {};
        const generatedCount = [
          imgs.heroImage,
          ...(imgs.beforeAfterImages || []),
          ...(imgs.socialProofImages || []),
          ...((imgs.angles || []).map((a) => a?.poster_url).filter(Boolean)),
        ].filter(Boolean).length;
        const totalAngles = (data.task.product.angles || []).length;
        const expectedMin = (data.task.product.heroImage ? 1 : 0) + totalAngles; // estimation
        const hasMissingImages = generatedCount < expectedMin;

        if (isStillGenerating || (data.task.imageJobId && hasMissingImages)) {
          // Reprend le polling sur l'écran de chargement
          setPhase('loading');
          setBuildStep(4);
          setBuildProgress(isStillGenerating ? 80 : 90);
          setBuildMessage(isStillGenerating ? 'Génération en cours...' : 'Finalisation des visuels...');
          setImageGenerationFailed(null);
          if (data.task.imageJobId) {
            setImageJobId(data.task.imageJobId);
          }
        } else {
          // Task vraiment terminée → preview
          setPhase('preview');
          setActiveTab('page');
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Auto-load a specific task on mount (from GenerationsPage)
  useEffect(() => {
    if (initialTaskId) {
      handleLoadTask(initialTaskId);
    }
  }, [initialTaskId]);

  // Validation des étapes
  const isStep1Valid = () => {
    if (inputMode === 'url') {
      return isValidUrl && hasRequiredPhotos;
    } else {
      return hasValidDescription && hasRequiredPhotos;
    }
  };

  const isCurrentProductSubstepValid = () => {
    if (productSubstep === 2) {
      return inputMode === 'url' ? isValidUrl : hasValidDescription;
    }

    if (productSubstep === 3) {
      return hasRequiredPhotos;
    }

    return true;
  };

  const isStep2Valid = () => {
    return true; // Copywriting angle et tone ont des valeurs par défaut
  };

  const isStep3Valid = () => {
    return true; // Étape 3 est optionnelle
  };

  const canGenerate = () => {
    return isStep1Valid() && isStep2Valid();
  };

  const remainingCredits = Number(generationsInfo?.remaining || 0);
  const hasNoCredits = generationsInfo !== null && remainingCredits <= 0;

  const fetchGenerationsInfo = useCallback(async () => {
    const authHeaders = getAuthHeaders();
    if (!authHeaders.Authorization) return null;

    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/info`, {
        headers: authHeaders,
      });
      if (!response.ok) return null;

      const data = await response.json();
      if (data.success && data.generations) {
        setGenerationsInfo(data.generations);
        if (data.generations.pricing) {
          setPricing(data.generations.pricing);
        }
        return data.generations;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const clearPendingGenerationPayment = useCallback(() => {
    sessionStorage.removeItem(GENERATION_PAYMENT_TOKEN_KEY);
    sessionStorage.removeItem(GENERATION_PAYMENT_SESSION_KEY);
    setPendingGenerationToken(null);
    setPendingGenerationPayment(null);
    setPaymentChecking(false);
  }, []);

  const resumePendingGenerationPayment = useCallback(() => {
    if (!pendingGenerationPayment?.paymentUrl) {
      setPaymentStatusError('Impossible de relancer le paiement le service. Réessaie depuis le pack.');
      return false;
    }

    setPaymentStatusError('');
    const popup = window.open(pendingGenerationPayment.paymentUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.href = pendingGenerationPayment.paymentUrl;
    }
    return true;
  }, [pendingGenerationPayment]);

  const handleGenerationPaymentConfirmed = useCallback(async () => {
    clearPendingGenerationPayment();
    zeroCreditPromptRef.current = false;
    setLimitReached(false);
    setShowPaymentForm(false);
    setPaymentStatusError('');
    setPaymentPhone('');
    setPaymentName('');
    setSelectedPack(null);
    setError('');
    setPaymentNotice('Paiement confirmé. Tes crédits ont été ajoutés automatiquement.');
    await fetchGenerationsInfo();
  }, [clearPendingGenerationPayment, fetchGenerationsInfo]);

  const checkPendingGenerationPayment = useCallback(async ({ silent = false } = {}) => {
    if (!pendingGenerationToken) return null;

    if (!silent) setPaymentChecking(true);

    try {
      const response = await fetch(`${API_ORIGIN}/api/ecom/billing/generation-status/${pendingGenerationToken}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error('Impossible de vérifier le paiement pour le moment.');
      }

      const result = await response.json();
      const status = result?.status || null;

      if (status === 'paid') {
        await handleGenerationPaymentConfirmed();
        return status;
      }

      if (status === 'failure' || status === 'no paid') {
        clearPendingGenerationPayment();
        setPaymentStatusError('Le paiement n\'a pas été confirmé. Réessaie ou choisis un autre moyen.');
        return status;
      }

      setPaymentStatusError('');
      return status;
    } catch (err) {
      if (!silent) {
        setPaymentStatusError(err?.message || 'Impossible de vérifier le paiement pour le moment.');
      }
      return null;
    } finally {
      if (!silent) setPaymentChecking(false);
    }
  }, [clearPendingGenerationPayment, handleGenerationPaymentConfirmed, pendingGenerationToken]);

  // Fetch credit info on mount
  useEffect(() => {
    fetchGenerationsInfo();
  }, [fetchGenerationsInfo]);

  useEffect(() => {
    if (!pendingGenerationToken) return undefined;

    setPaymentNotice('Paiement en attente de confirmation. Tes crédits seront ajoutés automatiquement dès validation.');
    const runCheck = () => checkPendingGenerationPayment({ silent: true });
    runCheck();
    const interval = window.setInterval(runCheck, 3000);
    return () => window.clearInterval(interval);
  }, [checkPendingGenerationPayment, pendingGenerationToken]);

  const openCreditsPaymentModal = useCallback((message = 'Tu n\'as plus de crédits. Achète un pack pour continuer.') => {
    zeroCreditPromptRef.current = true;
    setLimitReached(true);
    setSelectedPack((currentPack) => currentPack || 'unit');
    setPaymentStatusError('');
    setError(message);
    setShowPaymentForm(true);
  }, []);

  useEffect(() => {
    if (initialTaskId || phase !== 'input' || showPaymentForm || !hasNoCredits) return;
    if (pageStyle === 'hero_page') return; // hero mode is free, no credit prompt
    if (zeroCreditPromptRef.current) return;
    openCreditsPaymentModal('Tu n\'as plus de crédits. Choisis un pack pour lancer une nouvelle génération.');
  }, [hasNoCredits, initialTaskId, openCreditsPaymentModal, pageStyle, phase, showPaymentForm]);

  const handleNextStep = () => {
    if (step === 1) {
      if (!isCurrentProductSubstepValid()) return;

      if (productSubstep < totalProductSubsteps) {
        setProductSubstep((prev) => prev + 1);
        return;
      }

      if (isStep1Valid()) {
        setStep(2);
      }
    } else if (step === 2 && isStep2Valid()) {
      setStep(3);
    } else if (step === 3) {
      handleGenerate();
    }
  };

  const handlePrevStep = () => {
    if (step === 1 && productSubstep > 1) {
      setProductSubstep((prev) => prev - 1);
      return;
    }

    if (step === 2) {
      setStep(1);
      setProductSubstep(totalProductSubsteps);
      return;
    }

    if (step > 1) {
      setStep(step - 1);
    }
  };

  const addPhotos = useCallback(async (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 8);
    const optimized = await Promise.all(imgs.map((file) => compressImageFile(file)));
    setPhotos(prev => {
      const combined = [...prev, ...optimized];
      return combined.slice(0, 8);
    });
  }, []);

  const removePhoto = (index) => setPhotos(prev => prev.filter((_, i) => i !== index));

  const handleThemeChange = (key, value) => {
    setTemplateTheme((prev) => ({ ...prev, [key]: value }));
  };

  // AI Store Builder progression
  useEffect(() => {
    if (phase !== 'loading') return;

    const steps = [
      {
        step: 0,
        title: 'Analyse de votre produit',
        messages: [
          'Détection des bénéfices clés…',
          'Analyse du marché africain…',
          'Identification des angles marketing…'
        ],
        progressRange: [0, 30],
        duration: 15000 // 15s
      },
      {
        step: 1,
        title: 'Génération du contenu marketing',
        messages: [
          'Création du titre accrocheur…',
          'Rédaction des bénéfices…',
          'Optimisation pour la conversion…',
          'Génération des témoignages clients…'
        ],
        progressRange: [30, 60],
        duration: 25000 // 25s
      },
      {
        step: 2,
        title: 'Design de la page',
        messages: [
          'Création du design…',
          'Ajout des sections de conversion…',
          'Génération des visuels marketing…',
          'Optimisation mobile…'
        ],
        progressRange: [60, 85],
        duration: 30000 // 30s
      },
      {
        step: 3,
        title: 'Finalisation',
        messages: [
          'Assemblage final…',
          'Vérification qualité…',
          'Préparation de votre page…'
        ],
        progressRange: [85, 95],
        duration: 20000 // 20s - ne va jamais à 100% pour laisser l'API finir
      }
    ];

    const currentStepData = steps[buildStep];
    if (!currentStepData) return;

    let messageIndex = 0;
    let startProgress = currentStepData.progressRange[0];
    const endProgress = currentStepData.progressRange[1];
    const progressIncrement = (endProgress - startProgress) / currentStepData.messages.length;

    // Set initial message
    setBuildMessage(currentStepData.messages[0]);
    
    const messageInterval = setInterval(() => {
      messageIndex++;
      if (messageIndex < currentStepData.messages.length) {
        setBuildMessage(currentStepData.messages[messageIndex]);
        setBuildProgress(startProgress + (progressIncrement * messageIndex));
      } else {
        clearInterval(messageInterval);
      }
    }, currentStepData.duration / currentStepData.messages.length);

    const stepTimeout = setTimeout(() => {
      if (buildStep < 3) {
        setBuildStep(buildStep + 1);
        setBuildProgress(endProgress);
      } else {
        // Dernière étape - on reste à 95% en attendant que l'API finisse
        setBuildProgress(95);
        setBuildMessage('Presque terminé...');
        // Pas de confetti ici - il apparaîtra quand l'API répondra
      }
    }, currentStepData.duration);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(stepTimeout);
    };
  }, [phase, buildStep]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addPhotos(e.dataTransfer.files);
  };

  const handleGenerate = async () => {
    // Validation selon le mode
    if (inputMode === 'url' && (!isValidUrl || photos.length === 0)) return;
    if (inputMode === 'description' && !hasValidDescription) return;
    // Hero page mode is free — skip credit check
    if (pageStyle !== 'hero_page' && hasNoCredits) {
      openCreditsPaymentModal('Tu n\'as plus de crédits. Choisis un pack pour payer et débloquer la génération.');
      return;
    }
    
    setPhase('loading');
    setStepLabel('Génération en cours...');
    setError('');
    setPaymentNotice('');
    setProduct(null);
    setBuildStep(0);
    setBuildProgress(0);
    setBuildMessage('');
    setShowConfetti(false);
    isGeneratingRef.current = true;

    const token = localStorage.getItem('ecomToken');
    const wsId = getWsId();

    const formData = new FormData();
    
    // Mode URL Produit (Amazon, Alibaba, AliExpress, etc.)
    if (inputMode === 'url') {
      formData.append('url', url.trim());
    }
    // Mode description directe
    else {
      formData.append('description', description.trim());
      formData.append('skipScraping', 'true');
    }
    
    formData.append('withImages', 'true'); // hero_page still generates the hero image via AI
    formData.append('pageStyle', pageStyle);
    if (pageStyle === 'hero_page') formData.append('heroMode', 'true');
    formData.append('imageGenerationMode', imageGenerationMode);
    formData.append('imageAspectRatio', imageGenerationMode === 'ad_4_5' ? '4:5' : '1:1');
    formData.append('marketingApproach', marketingApproach);
    formData.append('visualTemplate', visualTemplate);
    formData.append('themeColor', templateTheme.primary);
    if (customPrimaryColor) formData.append('customThemeColor', customPrimaryColor);
    if (visualTemplate === 'fashion') {
      formData.append('fashionAvatar', fashionAvatar);
      formData.append('fashionMinimalist', fashionMinimalist ? 'true' : 'false');
      if (fashionSizes.length) formData.append('fashionSizes', JSON.stringify(fashionSizes));
      if (fashionColors.length) formData.append('fashionColors', JSON.stringify(fashionColors));
    }
    if (heroVisualDirection.trim()) formData.append('heroVisualDirection', heroVisualDirection.trim());
    if (decorationDirection.trim()) formData.append('decorationDirection', decorationDirection.trim());
    // Paramètres copywriting simplifiés
    formData.append('tone', tone);
    formData.append('language', 'français');
    if (targetAvatarSummary) formData.append('targetAvatar', targetAvatarSummary);
    formData.append('targetGender', targetGender);
    formData.append('targetAgeRange', targetAgeRange);
    formData.append('targetProfile', targetProfile);
    if (mainProblem.trim()) formData.append('mainProblem', mainProblem.trim());
    
    photos.forEach(f => formData.append('images', f));
    
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      console.log('🚀 Starting Product Page Generation:', { url: url.trim(), photosCount: photos.length });
      
      const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(wsId ? { 'X-Workspace-Id': wsId } : {})
        },
        body: formData
      });

      if (!resp.ok) {
        let errorMessage;
        try {
          const errorData = await resp.json();

          // Token expiré ou invalide
          if (resp.status === 401) {
            setPhase('input');
            abortRef.current = null;
            isGeneratingRef.current = false;
            setError('Session expirée. Reconnecte-toi et réessaie.');
            return;
          }

          // Gérer le cas de limite atteinte
          if (errorData.limitReached) {
            setLimitReached(true);
            setGenerationsInfo({
              remaining: 0,
              freeRemaining: 0,
              paidRemaining: 0,
              totalUsed: errorData.totalGenerations || 0
            });
            if (errorData.pricing) setPricing(errorData.pricing);
            setPhase('input');
            abortRef.current = null;
            isGeneratingRef.current = false;
            openCreditsPaymentModal(errorData.message || 'Tu n\'as plus de crédits. Achète un pack pour continuer.');
            return;
          }

          errorMessage = errorData.message || errorData.error || `Erreur HTTP ${resp.status}`;
        } catch {
          errorMessage = `Erreur HTTP ${resp.status}: ${resp.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await resp.json();
      
      if (result.success && result.product) {
        console.log('✅ Text generated, waiting for images...');
        
        // Mettre à jour les infos de génération
        if (result.generations) {
          setGenerationsInfo(result.generations);
        }

        // Store product (text is ready — show preview immediately regardless of images)
        setProduct(result.product);
        // Save text-only draft immediately so generation is never lost
        saveDraft(result.product, visualTemplate);
        setDraftBanner(null); // clear any old draft banner since we have a live generation

        // Store taskId for background tracking
        if (result.taskId) setCurrentTaskId(result.taskId);

        if (result.imageJobId) {
          // Images are being generated — stay in loading, poller will transition to preview when done
          setImageJobId(result.imageJobId);
          setBuildStep(4);
          setBuildProgress(90);
          setBuildMessage('Génération des visuels en cours...');
        } else {
          // No images to wait for — go to preview immediately
          setBuildProgress(100);
          setBuildMessage('Votre page est prête.');
          setShowConfetti(true);
          setTimeout(() => {
            setShowConfetti(false);
            setPhase('preview');
            setActiveTab('page');
          }, 2000);
        }
      } else {
        throw new Error(result.message || result.error || 'Erreur: Aucun produit généré');
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⚠️ Product generation aborted by user or timeout');
        if (!error.message.includes('Timeout')) {
          setError('Génération annulée');
          setPhase('input');
          // Réinitialiser les states d'animation
          setBuildStep(0);
          setBuildProgress(0);
          setBuildMessage('');
          setShowConfetti(false);
        }
        return;
      }
      
      console.error('❌ Product generation error:', error);
      
      // Clear, explicit error messages
      let errorMessage = error.message;
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage = 'Erreur de connexion: impossible de contacter le serveur. Vérifiez votre connexion internet.';
      } else if (error.message.includes('OpenAI')) {
        errorMessage = `Erreur du service: ${error.message}`;
      } else if (error.message.includes('NanoBanana')) {
        errorMessage = `Erreur du service: ${error.message}`;
      } else if (error.message.includes('Scraping')) {
        errorMessage = `Erreur Scraping: ${error.message}`;
      } else if (!error.message.startsWith('Erreur')) {
        errorMessage = `Erreur: ${error.message}`;
      }
      
      setError(errorMessage);
      setPhase('input');
      // Réinitialiser les states d'animation
      setBuildStep(0);
      setBuildProgress(0);
      setBuildMessage('');
      setShowConfetti(false);
    } finally {
      abortRef.current = null;
      isGeneratingRef.current = false;
    }
  };

  const handleBuyGeneration = async () => {
    if (!paymentPhone || paymentPhone.trim().length < 8) {
      setPaymentStatusError('Veuillez saisir un numéro de téléphone valide');
      return;
    }
    if (!paymentName || paymentName.trim().length < 2) {
      setPaymentStatusError('Veuillez saisir votre nom');
      return;
    }

    setPaymentLoading(true);
    setPaymentStatusError('');
    setPaymentNotice('');
    
    try {
      const wsId = getWsId();
      const authHeaders = getAuthHeaders();

      const response = await fetch(`${API_ORIGIN}/api/ecom/billing/buy-generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          quantity: selectedPack === 'pack3' ? 3 : 1,
          phone: paymentPhone.trim(),
          clientName: paymentName.trim(),
          workspaceId: wsId
        })
      });

      const result = await response.json();

      if (result.success && result.paymentUrl && result.mfToken) {
        const pendingPayment = {
          mfToken: result.mfToken,
          paymentUrl: result.paymentUrl,
          amount: result.amount || (selectedPack === 'pack3' ? pricing.pack3 : pricing.unit),
          quantity: result.quantity || (selectedPack === 'pack3' ? 3 : 1),
        };
        sessionStorage.setItem(GENERATION_PAYMENT_TOKEN_KEY, result.mfToken);
        sessionStorage.setItem(GENERATION_PAYMENT_SESSION_KEY, JSON.stringify(pendingPayment));
        setPendingGenerationToken(result.mfToken);
        setPendingGenerationPayment(pendingPayment);
        setPaymentNotice('Paiement initié. Finalise le paiement dans la fenêtre ouverte pour recevoir tes crédits.');
        const popup = window.open(pendingPayment.paymentUrl, '_blank', 'noopener,noreferrer');
        if (!popup) {
          window.location.href = pendingPayment.paymentUrl;
        }
      } else {
        throw new Error(result.message || 'Erreur lors de l\'initialisation du paiement');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentStatusError(error?.message || 'Erreur lors du paiement');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleInfographicsGenerated = (result) => {
    if (!result?.infographics?.length) {
      setError('Aucune infographie générée. Vérifie le quota image et réessaie.');
      return;
    }
    const productImages = result.infographics
      .filter(i => i?.url)
      .map((i, idx) => ({ url: i.url, alt: `${result.productName || 'Produit'} — slide ${idx + 1}`, type: 'infographic' }));

    onApply({
      name: result.productName || 'Produit',
      description: result.productDescription || '',
      images: productImages,
      country: result.country || '',
      targetMarket: result.country || '',
      productPageConfig: {
        theme: 'infographics',
        infographics: result.infographics,
        infographicsForm: result.form,
      },
      _pageData: {
        pageStyle: 'infographics',
        layout: 'infographics',
        country: result.country || '',
        infographicsResult: result,
      },
    });
    clearDraft();
    setDraftBanner(null);
  };

  const handleApply = () => {
    if (!product) return;

    const descriptionTitleColor = templateTheme.primary;
    const descriptionContentColor = templateTheme.text;
    const descriptionAccentColor = templateTheme.accent;
    const descriptionSurfaceColor = templateTheme.surface;
    const themePrimaryToken = `var(--s-primary, ${descriptionTitleColor})`;
    const themeTextToken = `var(--s-text, ${descriptionContentColor})`;
    const themeMutedToken = `var(--s-text2, ${descriptionContentColor}CC)`;
    const themeSurfaceToken = `var(--s-bg, ${descriptionSurfaceColor})`;
    const themeSoftBackground = `color-mix(in srgb, ${themePrimaryToken} 8%, white)`;
    const themeSoftBorder = `color-mix(in srgb, ${themePrimaryToken} 18%, white)`;
    const themeBorderToken = `var(--s-border, ${descriptionAccentColor}40)`;
    const descriptionGifs = Array.isArray(product.descriptionGifs) ? product.descriptionGifs.filter((entry) => entry?.url) : [];

    const renderDescriptionGifBlock = (gif, index) => {
      if (!gif?.url) return '';
      const title = gif.title || `Démo ${index + 1}`;
      return `
        <div style="margin:24px 0 0;padding:18px;border:1px solid ${themeSoftBorder};border-radius:18px;background:${themeSoftBackground};">
          <p style="margin:0 0 12px;font-size:13px;font-weight:800;color:${themePrimaryToken};letter-spacing:0.02em;text-transform:uppercase;">${title}</p>
          <img src="${gif.url}" alt="${title}" style="width:100%;aspect-ratio:16 / 9;object-fit:cover;display:block;border-radius:14px;background:#000;" />
        </div>`;
    };
    
    // Build rich HTML description: 5 angles (H3 + desc + image) → testimonials → FAQ
    let descHtml = '';

    // ── Intro description (courte, sans images markdown) ─────────────────────

    // ── 5 Arguments marketing : H3 gras + description 3-4 lignes + image ─────
    const descriptionAngles = Array.isArray(product.angles)
      ? product.angles.filter((angle) => angle?.poster_url && angle?.flashType !== 'social_proof')
      : [];

    if (descriptionAngles.length) {
      descHtml += `<div style="margin:32px 0;color:${themeTextToken};">`;
      descriptionAngles.slice(0, 5).forEach((angle, idx) => {
        descHtml += `<div style="margin-bottom:40px;padding-bottom:40px;${idx < descriptionAngles.length - 1 ? `border-bottom:1px solid ${themeBorderToken};` : ''}">`;
        // H3 bold title
        descHtml += `<h3 style="font-size:20px;font-weight:800;color:${themePrimaryToken};margin:0 0 12px;line-height:1.3;"><strong>${angle.titre_angle}</strong></h3>`;
        // 3-4 line description
        const textParts = [angle.message_principal, angle.explication, angle.promesse]
          .map((value) => String(value || '').trim())
          .filter(Boolean)
          .filter((value, index, array) => array.indexOf(value) === index);
        const descriptionText = textParts.join(' ');
        if (descriptionText) {
          descHtml += `<p style="font-size:15px;line-height:1.78;color:${themeMutedToken};margin:0 0 16px;">${descriptionText}</p>`;
        }
        // Image UGC (also in carousel)
        if (angle.poster_url) {
          descHtml += `<img src="${angle.poster_url}" alt="${angle.titre_angle}" style="width:100%;aspect-ratio:1 / 1;object-fit:cover;display:block;margin:0;"/>`;
        }
        if (descriptionGifs[idx] && idx < 2) {
          descHtml += renderDescriptionGifBlock(descriptionGifs[idx], idx);
        }
        descHtml += `</div>`;
      });
      descHtml += `</div>`;
    }

    // ── Témoignages clients ───────────────────────────────────────────────────
    // NOTE: Les témoignages ne sont PAS inclus dans le HTML de description.
    // Ils sont sauvegardés dans product.testimonials et seront automatiquement
    // affichés en carrousel par StoreProductPage.jsx via VerifiedTestimonialsCarousel.
    // Cela évite d'avoir du HTML statique et permet un affichage dynamique et interactif.

    // ── Raisons d'acheter ──────────────────────────────────────────────────────
    if (product.raisons_acheter?.length) {
      descHtml += `<div style="margin:32px 0;padding:24px;background:${themeSoftBackground};border-radius:16px;border:1px solid ${themeSoftBorder};">`;
      descHtml += `<h3 style="font-size:18px;font-weight:800;color:${themePrimaryToken};margin:0 0 16px;"><strong>✅ Pourquoi choisir ce produit ?</strong></h3>`;
      descHtml += `<ul style="margin:0;padding:0;list-style:none;">`;
      product.raisons_acheter.forEach(r => {
        descHtml += `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:14px;color:${themeTextToken};"><span style="margin-top:2px;flex-shrink:0;color:${themePrimaryToken};">✓</span><span>${r}</span></li>`;
      });
      descHtml += `</ul></div>`;
    }

    // ── Guide d'utilisation (si applicable) ───────────────────────────────────
    if (product.guide_utilisation?.applicable !== false && product.guide_utilisation?.etapes?.length) {
      const g = product.guide_utilisation;
      descHtml += `<div style="margin:40px 0;padding:28px;background:${themeSoftBackground};border-radius:20px;border:1px solid ${themeSoftBorder};">`;
      descHtml += `<h3 style="font-size:20px;font-weight:800;color:${themePrimaryToken};margin:0 0 20px;"><strong>📋 ${g.titre || 'Comment utiliser ce produit'}</strong></h3>`;
      descHtml += `<div style="display:flex;flex-direction:column;gap:14px;">`;
      g.etapes.forEach((e) => {
        descHtml += `<div style="display:flex;align-items:flex-start;gap:14px;">`;
        descHtml += `<div style="min-width:32px;height:32px;border-radius:50%;background:${themePrimaryToken};color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${e.numero}</div>`;
        descHtml += `<div><p style="margin:0 0 4px;font-weight:700;font-size:15px;color:${themePrimaryToken};">${e.action}</p>`;
        if (e.detail) descHtml += `<p style="margin:0;font-size:13px;color:${themeTextToken};line-height:1.5;">${e.detail}</p>`;
        descHtml += `</div></div>`;
      });
      descHtml += `</div></div>`;
    }

    // ── Garantie / Réassurance ─────────────────────────────────────────────────
    if (product.reassurance?.titre) {
      const r = product.reassurance;
      descHtml += `<div style="margin:40px 0;padding:28px;background:${themeSurfaceToken};border-radius:20px;border:1px solid ${themeBorderToken};">`;
      descHtml += `<h3 style="font-size:20px;font-weight:800;color:${themePrimaryToken};margin:0 0 12px;"><strong>🛡️ ${r.titre}</strong></h3>`;
      if (r.texte) descHtml += `<p style="font-size:15px;color:${themeTextToken};line-height:1.7;margin:0 0 16px;">${r.texte}</p>`;
      if (r.points?.length) {
        descHtml += `<ul style="margin:0;padding:0;list-style:none;">`;
        r.points.forEach(p => {
          descHtml += `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:14px;color:${themeTextToken};font-weight:600;"><span style="flex-shrink:0;color:${themePrimaryToken};">✅</span><span>${p}</span></li>`;
        });
        descHtml += `</ul>`;
      }
      descHtml += `</div>`;
    }
    
    const productImages = [];
    const socialProofImages = [];
    const beforeAfterImages = Array.isArray(product.beforeAfterImages) && product.beforeAfterImages.length > 0
      ? product.beforeAfterImages
      : (product.beforeAfterImage ? [product.beforeAfterImage] : []);
    const generatedProductPageConfig = buildGeneratedProductPageConfig(templateTheme, product, pageStyle);

    const pushUniqueImage = (target, url, alt, type) => {
      if (!url || target.find((image) => image.url === url)) return;
      target.push({ url, alt, order: target.length, type });
    };

    // Main carousel order: hero, before/after, then generated visuals.
    if (product.heroImage) {
      pushUniqueImage(productImages, product.heroImage, product.title || 'Image Hero principale', 'hero');
    }
    beforeAfterImages.forEach((imgUrl, index) => {
      pushUniqueImage(productImages, imgUrl, `Avant / Après ${index + 1} — Résultats visibles`, 'social-proof-before-after');
    });
    if (product.heroPosterImage) {
      pushUniqueImage(productImages, product.heroPosterImage, `Affiche — ${product.title || 'Produit'}`, 'hero-poster');
    }

    if (product.angles?.length) {
      product.angles.forEach((angle, index) => {
        if (angle?.poster_url) {
          pushUniqueImage(productImages, angle.poster_url, angle.titre_angle || `${product.title || 'Produit'} — argument ${index + 1}`, 'angle-poster');
        }
      });
    }

    if ((product.socialProofImages || []).length) {
      (product.socialProofImages || []).forEach((url, index) => {
        pushUniqueImage(socialProofImages, url, `${product.title || 'Produit'} — preuve sociale ${index + 1}`, 'social-proof');
      });
    }
    
    const finalSocialProofImages = socialProofImages.slice(0, 1);
    
    onApply({
      name: product.title || '',
      description: descHtml,
      images: productImages,
      currency: product.currency || '',
      targetMarket: product.targetMarket || product.country || '',
      country: product.country || '',
      city: product.city || '',
      locale: product.locale || '',
      productPageConfig: generatedProductPageConfig,
      _pageData: {
        ...product,
        visualTemplate: visualTemplate,
        visualTemplateLabel: selectedTemplate.label,
        socialProofImages: finalSocialProofImages.map((image) => image.url),
        descriptionGifs: descriptionGifs.map((gif) => gif.url),
        heroVisualDirection: heroVisualDirection.trim(),
        decorationDirection: decorationDirection.trim(),
        ...(visualTemplate === 'fashion' ? {
          fashionConfig: {
            avatar: fashionAvatar,
            minimalist: fashionMinimalist,
            sizes: fashionSizes,
            colors: fashionColors,
          }
        } : {}),
      },
      ...(visualTemplate === 'fashion' && (fashionSizes.length || fashionColors.length) ? {
        variants: [
          ...(fashionSizes.length ? [{ name: 'Taille', options: fashionSizes.map(s => s.startsWith('p') ? s.slice(1) : s) }] : []),
          ...(fashionColors.length ? [{ name: 'Couleur', options: fashionColors.map(c => c.name), swatches: fashionColors }] : []),
        ],
      } : {})
    });
    // Clear draft after successful apply
    clearDraft();
    setDraftBanner(null);
  };

  const openDigitalProductModal = () => {
    if (!currentTaskId) {
      setError('Recharge cette génération depuis le Studio pour créer le produit digital.');
      return;
    }
    setDigitalProductError('');
    setDigitalProductResult(null);
    setShowDigitalProductModal(true);
  };

  const handleGenerateDigitalProduct = async (brief = {}) => {
    if (!currentTaskId) {
      setDigitalProductError('Recharge cette génération depuis le Studio pour créer le produit digital.');
      return;
    }

    setDigitalProductLoading(true);
    setDigitalProductNotice('');
    setDigitalProductError('');
    setDigitalProductResult(null);
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${currentTaskId}/digital-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ brief }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Impossible de générer le produit digital');
      }

      const nextProduct = data.product || {
        ...product,
        ebook: data.ebook,
        digitalProduct: data.digitalProduct || product.digitalProduct,
      };
      setProduct(nextProduct);
      saveDraft(nextProduct, visualTemplate);
      setActiveTab('page');
      setDigitalProductResult({
        ebook: data.ebook,
        digitalProduct: data.digitalProduct,
        pdf: data.ebook?.pdf,
      });
      setDigitalProductNotice('Produit digital généré et ajouté à cette page.');
    } catch (digitalError) {
      setDigitalProductError(digitalError.message || 'Erreur lors de la génération du produit digital');
    } finally {
      setDigitalProductLoading(false);
    }
  };

  const handleRestart = () => {
    setProduct(null);
    setInfographicsTaskResult(null);
    setError('');
    setLimitReached(false);
    setActiveTab('page');
    setShowConfetti(false);
    handleGenerate();
  };

  // ── Hero image builder helpers ─────────────────────────────────────────────

  const handleHeroFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setHeroFile(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setHeroImg(img);
    img.src = url;
  };

  // Draw hero composite image onto canvas
  useEffect(() => {
    const canvas = heroCanvasRef.current;
    if (!canvas) return;
    const SIZE = 1080;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background
    if (heroImg) {
      // Cover-fit the image
      const iw = heroImg.naturalWidth, ih = heroImg.naturalHeight;
      const scale = Math.max(SIZE / iw, SIZE / ih);
      const sw = iw * scale, sh = ih * scale;
      const sx = (SIZE - sw) / 2, sy = (SIZE - sh) / 2;
      ctx.drawImage(heroImg, sx, sy, sw, sh);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, SIZE, SIZE);
    }

    // Gradient overlay (bottom 65%)
    const grad = ctx.createLinearGradient(0, SIZE * 0.28, 0, SIZE);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.45, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const accent = heroAccent || '#0F6B4F';
    const PAD = 58;

    // ── Top badge ──────────────────────────────────────────────────────────
    if (heroBadge) {
      const badgeTxt = heroBadge.toUpperCase();
      ctx.font = 'bold 26px Arial';
      const bw = ctx.measureText(badgeTxt).width + 44;
      const bh = 48;
      const bx = PAD, by = PAD;
      ctx.fillStyle = accent;
      _roundRect(ctx, bx, by, bw, bh, 24);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Arial';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeTxt, bx + 22, by + bh / 2);
    }

    // ── Price badge (top-right) ──────────────────────────────────────────
    if (heroPrice) {
      ctx.font = 'bold 38px Arial';
      const priceTxt = heroPrice;
      const pw = ctx.measureText(priceTxt).width + 56;
      const ph = 64;
      const px = SIZE - PAD - pw, py = PAD;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      _roundRect(ctx, px, py, pw, ph, 32);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.font = 'bold 34px Arial';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(priceTxt, px + pw / 2, py + ph / 2);
      ctx.textAlign = 'left';
    }

    // ── Headline ──────────────────────────────────────────────────────────
    const headline = heroName || 'Nom du produit';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'alphabetic';
    const headlineLines = _wrapText(ctx, headline, 'bold 74px Arial', SIZE - PAD * 2 - 40);
    let ty = SIZE - PAD - 220;
    if (heroCta) ty -= 100;
    if (heroTagline) ty -= 60;
    headlineLines.forEach((line) => {
      ctx.font = 'bold 74px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, PAD, ty);
      ty += 88;
    });

    // ── Tagline ────────────────────────────────────────────────────────────
    if (heroTagline) {
      ctx.font = '34px Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(heroTagline.slice(0, 68), PAD, ty + 6);
      ty += 52;
    }

    // ── CTA button ────────────────────────────────────────────────────────
    if (heroCta) {
      ty += 24;
      const ctaTxt = heroCta;
      ctx.font = 'bold 30px Arial';
      const cw = ctx.measureText(ctaTxt).width + 80;
      const ch = 72;
      ctx.fillStyle = accent;
      _roundRect(ctx, PAD, ty, cw, ch, 36);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaTxt, PAD + 40, ty + ch / 2);
      ctx.textBaseline = 'alphabetic';

      // "Paiement à la livraison" beside CTA
      ctx.font = 'bold 22px Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('✓ Paiement à la livraison', PAD + cw + 24, ty + ch / 2 + 8);
    }

  }, [heroImg, heroName, heroTagline, heroPrice, heroCta, heroBadge, heroAccent]);

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function _wrapText(ctx, text, font, maxWidth) {
    ctx.font = font;
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3);
  }

  const downloadHero = () => {
    const canvas = heroCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `hero-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <>
    <div className={pageMode ? 'min-h-screen bg-white' : 'fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-black/50 backdrop-blur-sm'}>
      <div className={pageMode ? 'mx-auto min-h-screen w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8' : 'flex h-full w-full items-stretch justify-stretch'}>
        <div className={pageMode ? 'relative flex min-h-[calc(100vh-3rem)] w-full flex-col overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm' : 'relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl'}>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={pageMode ? 'absolute right-5 top-5 z-20 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900' : 'absolute right-6 top-6 z-20 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700'}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex min-h-0 flex-1 flex-col">

          {/* Header */}
          {pageMode ? (
            <div className="border-b border-gray-200 px-5 py-5 sm:px-6 lg:px-7">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Retour catalogue
                </button>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#0F6B4F] px-3 py-1.5 text-xs font-semibold text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                  Générateur de page produit
                </span>
                {pageStyle === 'hero_page' ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary-300 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Gratuit
                  </span>
                ) : generationsInfo && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#96C7B5] bg-[#E6F2ED] px-3 py-1.5 text-xs font-semibold text-[#0A5740]">
                    <Zap className="h-3.5 w-3.5" />
                    {generationsInfo.remaining || 0} crédit{(generationsInfo?.remaining || 0) > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="mt-4 max-w-3xl">
                <h2 className="text-[28px] font-black leading-tight tracking-[-0.03em] text-black sm:text-[34px]">
                  Crée une page produit simple, propre et prête à publier.
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Produit, copywriting, ciblage, puis génération.
                </p>
              </div>

              {phase === 'input' && (
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {visibleSteps.map((s) => (
                    <div
                      key={s.num}
                      className={`rounded-2xl border px-4 py-3 ${
                        step === s.num
                          ? 'border-[#96C7B5] bg-[#E6F2ED]'
                          : step > s.num
                          ? 'border-gray-200 bg-gray-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step >= s.num ? 'bg-[#0F6B4F] text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {step > s.num ? '✓' : s.num}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                          <p className="text-xs text-gray-500">Etape {s.num}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-black text-gray-900 leading-tight">Générateur de page produit IA</h2>
                      <p className="mt-0.5 text-xs text-gray-600">Crée une page produit claire, simple et prête à publier.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {generationsInfo && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 shadow-sm">
                      <Zap className="w-5 h-5 text-violet-600" />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-[11px] font-bold">
                          <span className="text-violet-600">{generationsInfo.remaining || 0} crédit{(generationsInfo.remaining || 0) > 1 ? 's' : ''}</span>
                        </div>
                        <span className="text-[10px] text-violet-600">crédits restants</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        <div className={pageMode ? 'flex-1 overflow-y-auto bg-white' : 'flex-1 overflow-y-auto'}>

          {/* ─── INPUT PHASE ─── */}
          {phase === 'input' && (
            <div className="p-6 space-y-5">

              {/* Sélecteur style de page */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-gray-400" />
                  <label className="text-sm font-bold text-gray-900">Style de page</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => { setPageStyle('classic'); setInfographicsTaskResult(null); }}
                    className={`text-left rounded-xl border-2 px-4 py-3 transition ${pageStyle === 'classic' ? 'border-scalor-green bg-[#E6F2ED]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  >
                    <p className="text-sm font-bold text-gray-900">Classique</p>
                    <p className="text-xs text-gray-500 mt-0.5">Hero, bénéfices, avis, FAQ, blocs conversion</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageStyle('infographics')}
                    className={`text-left rounded-xl border-2 px-4 py-3 transition ${pageStyle === 'infographics' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  >
                    <p className="text-sm font-bold text-gray-900">Infographies 9:16</p>
                    <p className="text-xs text-gray-500 mt-0.5">Pile d'infographies verticales + formulaire minimal</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPageStyle('hero_page'); setInfographicsTaskResult(null); }}
                    className={`relative text-left rounded-xl border-2 px-4 py-3 transition ${pageStyle === 'hero_page' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  >
                    <span className="absolute -top-2 -right-2 text-[10px] font-black bg-primary-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">Gratuit</span>
                    <p className="text-sm font-bold text-gray-900">Page Complète — Image réduite</p>
                    <p className="text-xs text-gray-500 mt-0.5">Page IA complète + hero généré par IA — sans images d'angles ni GIFs</p>
                  </button>
                </div>
              </div>

              {/* ── Hero Image Builder (gratuit, canvas) ────────────────────────────── */}
              {pageStyle === 'hero' && (
                <div className="rounded-2xl border border-primary-200 bg-white overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-5 py-4 bg-primary-50 border-b border-primary-100">
                    <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Image Hero — Gratuit</p>
                      <p className="text-xs text-primary-700">Compose une image 1080×1080 avec ta photo + texte. Aucun crédit requis.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                    {/* Left: form */}
                    <div className="p-5 space-y-4 border-r border-gray-100">

                      {/* Photo upload */}
                      <div>
                        <label className="text-xs font-bold text-gray-700 mb-1.5 block">Photo du produit</label>
                        <div
                          onDragOver={(e) => { e.preventDefault(); setHeroDragOver(true); }}
                          onDragLeave={() => setHeroDragOver(false)}
                          onDrop={(e) => { e.preventDefault(); setHeroDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleHeroFile(f); }}
                          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition p-4 ${heroDragOver ? 'border-primary-500 bg-primary-50' : heroImg ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                          style={{ minHeight: 120 }}
                          onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=(e)=>{ if(e.target.files[0]) handleHeroFile(e.target.files[0]); }; inp.click(); }}
                        >
                          {heroImg ? (
                            <div className="flex items-center gap-3 w-full">
                              <img src={heroImg.src} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-800 truncate">{heroFile?.name || 'Image chargée'}</p>
                                <button type="button" className="text-[11px] text-primary-600 font-semibold mt-0.5" onClick={(e)=>{ e.stopPropagation(); setHeroFile(null); setHeroImg(null); }}>Changer d'image</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-6 h-6 text-gray-400" />
                              <p className="text-xs text-gray-500 text-center">Glisse ta photo ici ou <span className="text-primary-600 font-semibold">clique pour choisir</span></p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Text fields */}
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { label: 'Nom du produit', val: heroName, set: setHeroName, ph: 'Ex: Sérum éclat naturel', max: 48 },
                          { label: 'Accroche / Tagline', val: heroTagline, set: setHeroTagline, ph: 'Ex: Résultat visible en 7 jours', max: 68 },
                          { label: 'Prix', val: heroPrice, set: setHeroPrice, ph: 'Ex: 14 900 FCFA', max: 24 },
                          { label: 'Texte du bouton CTA', val: heroCta, set: setHeroCta, ph: 'Commander maintenant', max: 36 },
                          { label: 'Badge promo (en haut)', val: heroBadge, set: setHeroBadge, ph: 'Ex: Livraison gratuite', max: 32 },
                        ].map(({ label, val, set, ph, max }) => (
                          <div key={label}>
                            <label className="text-[11px] font-semibold text-gray-600 mb-1 block">{label}</label>
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => set(e.target.value.slice(0, max))}
                              placeholder={ph}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                            />
                          </div>
                        ))}

                        {/* Accent color */}
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">Couleur accent</label>
                          <div className="flex items-center gap-3">
                            <input type="color" value={heroAccent} onChange={(e) => setHeroAccent(e.target.value)} className="w-10 h-10 rounded-xl border-2 border-gray-200 cursor-pointer p-0.5" />
                            {['#0F6B4F','#1877F2','#DC2626','#7C3AED','#B45309','#000000'].map(c => (
                              <button key={c} type="button" onClick={() => setHeroAccent(c)} className="w-8 h-8 rounded-full border-2 transition" style={{ backgroundColor: c, borderColor: heroAccent === c ? '#fff' : 'transparent', boxShadow: heroAccent === c ? `0 0 0 2px ${c}` : 'none' }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: canvas preview + download */}
                    <div className="p-5 flex flex-col items-center gap-4 bg-gray-50">
                      <p className="text-xs font-bold text-gray-600 self-start">Aperçu (1080×1080)</p>
                      <canvas
                        ref={heroCanvasRef}
                        style={{ width: '100%', maxWidth: 340, aspectRatio: '1/1', borderRadius: 16, border: '1.5px solid #e5e7eb', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}
                      />
                      <button
                        type="button"
                        onClick={downloadHero}
                        className="w-full max-w-[340px] flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition"
                        style={{ backgroundColor: '#0F6B4F' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0A5740'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0F6B4F'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Télécharger PNG (1080×1080)
                      </button>
                      <p className="text-[11px] text-gray-400 text-center max-w-[300px]">Image haute résolution prête pour Facebook Ads, TikTok ou votre boutique. 100% gratuit, aucun crédit.</p>
                    </div>
                  </div>
                </div>
              )}

              {pageStyle === 'infographics' && (
                <InfographicsGeneratorPanel
                  onGenerated={handleInfographicsGenerated}
                  onCancel={pageMode ? undefined : onClose}
                  onContinueInBackground={handleContinueInBackground}
                  initialResult={infographicsTaskResult}
                  onResetPreview={() => setInfographicsTaskResult(null)}
                />
              )}

              {/* Background tasks indicator */}
              {backgroundTasks.length > 0 && (
                <div
                  className="flex items-center justify-between rounded-xl border border-[#96C7B5] bg-[#E6F2ED] px-4 py-3 cursor-pointer transition hover:bg-[#D1E8DD]"
                  onClick={() => setShowTaskList(!showTaskList)}
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Sparkles className="w-5 h-5 text-[#0F6B4F]" />
                      {backgroundTasks.some(t => !['done', 'error'].includes(t.status)) && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-400 rounded-full animate-pulse" />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-[#0A5740]">
                      {backgroundTasks.filter(t => !['done', 'error'].includes(t.status)).length > 0
                        ? `${backgroundTasks.filter(t => !['done', 'error'].includes(t.status)).length} génération(s) en cours`
                        : 'Générations terminées'}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-[#0F6B4F] transition-transform ${showTaskList ? 'rotate-90' : ''}`} />
                </div>
              )}

              {/* Task list panel */}
              {showTaskList && backgroundTasks.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden shadow-sm">
                  {backgroundTasks.map(task => (
                    <div key={task._id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{task.productName || 'Produit'}</p>
                        <p className="text-xs text-gray-500">
                          {task.status === 'done' ? '✅ Terminé' :
                           task.status === 'error' ? '❌ Erreur' :
                           `⏳ ${task.currentStep || 'En cours'} — ${task.progressPercent || 0}%`}
                        </p>
                      </div>
                      {task.status === 'done' && (
                        <button
                          type="button"
                          onClick={() => handleLoadTask(task._id)}
                          className="ml-3 shrink-0 rounded-lg bg-[#0F6B4F] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0A5740]"
                        >
                          {task.product?.layout === 'infographics' ? 'Voir le résultat' : 'Voir la page'}
                        </button>
                      )}
                      {task.status === 'error' && (
                        <div className="ml-3 flex items-center gap-2 shrink-0">
                          {task.product && (
                            <button
                              type="button"
                              onClick={() => handleLoadTask(task._id)}
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                            >
                              {task.product?.layout === 'infographics' ? 'Ouvrir résultat' : 'Ouvrir contenu'}
                            </button>
                          )}
                          <span className="text-xs text-red-500">{task.errorMessage || 'Erreur'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Draft restore banner */}
              {draftBanner && (
                <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">💾</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-900 truncate">Génération sauvegardée : &ldquo;{draftBanner.product?.title || 'Page produit'}&rdquo;</p>
                      <p className="text-xs text-amber-700">Reprend là où tu t&apos;es arrêté</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setProduct(draftBanner.product);
                        if (draftBanner.visualTemplate) setVisualTemplate(draftBanner.visualTemplate);
                        setDraftBanner(null);
                        setPhase('preview');
                        setActiveTab('page');
                      }}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition"
                    >
                      Reprendre
                    </button>
                    <button
                      type="button"
                      onClick={() => { clearDraft(); setDraftBanner(null); }}
                      className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
                    >
                      Ignorer
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 1: Informations produit */}
              {usesStandardProductGenerator && step === 1 && (
                <>
                  {/* Template de page produit */}
                  {productSubstep === 1 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Layers className="h-4 w-4 text-gray-400" />
                      <label className="text-sm font-semibold text-gray-800">Template visuel</label>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">Choisie le type de produit — chaque template a son propre style d'images</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {VISUAL_TEMPLATES.map(t => {
                        const isActive = visualTemplate === t.id;
                        const previewTheme = buildTemplateTheme(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setVisualTemplate(t.id)}
                            className="group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-150"
                            style={isActive
                              ? { borderColor: previewTheme.primary, backgroundColor: previewTheme.primary }
                              : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                            }
                            onMouseEnter={!isActive ? (e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.backgroundColor = '#f9fafb'; } : undefined}
                            onMouseLeave={!isActive ? (e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#fff'; } : undefined}
                          >
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                              style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : `${previewTheme.primary}18` }}
                            >
                              <t.icon
                                className="h-4 w-4"
                                style={{ color: isActive ? '#fff' : previewTheme.primary }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold leading-tight" style={{ color: isActive ? '#fff' : '#1f2937' }}>{t.label}</p>
                              <p className="mt-0.5 truncate text-[10px] leading-tight" style={{ color: isActive ? 'rgba(255,255,255,0.6)' : '#9ca3af' }}>{t.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-3 text-[11px] text-gray-400">
                      Le template sert uniquement de point de départ visuel. La page et les visuels restent générés dynamiquement.
                    </p>

                    {/* Couleur de thème personnalisée */}
                    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0" style={{ background: templateTheme.primary }} />
                          <span className="text-xs font-semibold text-gray-800">Couleur de votre thème</span>
                        </div>
                        {customPrimaryColor && (
                          <button
                            type="button"
                            onClick={() => setCustomPrimaryColor(null)}
                            className="text-[10px] text-gray-400 hover:text-red-500 transition underline"
                          >
                            Réinitialiser
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mb-3">
                        Les images générées adopteront automatiquement cette couleur — fonds, accents et ambiance visuelle.
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <input
                            type="color"
                            value={customPrimaryColor || templateTheme.primary}
                            onChange={e => setCustomPrimaryColor(e.target.value)}
                            className="w-10 h-10 rounded-xl border-2 border-gray-200 cursor-pointer p-0.5"
                            style={{ backgroundColor: customPrimaryColor || templateTheme.primary }}
                          />
                        </div>
                        <input
                          type="text"
                          value={customPrimaryColor || templateTheme.primary}
                          onChange={e => {
                            const v = e.target.value;
                            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setCustomPrimaryColor(v.length === 7 ? v : null);
                          }}
                          placeholder="#000000"
                          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono text-gray-700 focus:outline-none focus:border-gray-400"
                        />
                        {/* Palettes rapides */}
                        <div className="flex gap-1.5 flex-shrink-0">
                          {['#0F6B4F','#2563EB','#7C3AED','#DC2626','#D97706','#BE185D','#0891B2','#000000'].map(hex => (
                            <button
                              key={hex}
                              type="button"
                              title={hex}
                              onClick={() => setCustomPrimaryColor(hex)}
                              className="w-6 h-6 rounded-full border-2 transition flex-shrink-0"
                              style={{
                                background: hex,
                                borderColor: customPrimaryColor === hex ? '#374151' : 'transparent',
                                outline: customPrimaryColor === hex ? '2px solid #374151' : 'none',
                                outlineOffset: '1px',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {visualTemplate === 'fashion' && (
                      <div className="mt-5 rounded-[24px] border-2 border-purple-100 bg-gradient-to-br from-purple-50/60 to-pink-50/40 p-5">
                        <div className="flex items-center gap-2 mb-1">
                          <Crown className="h-4 w-4 text-purple-700" />
                          <h4 className="text-sm font-bold text-purple-900">Configuration Mode & Vêtements</h4>
                        </div>
                        <p className="text-xs text-purple-700/80 mb-4">L'IA habillera l'avatar avec les photos de vêtements que tu fournis. Page produit minimaliste dédiée.</p>

                        {/* Avatar gender */}
                        <div className="mb-5">
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-purple-800">Avatar / Mannequin</label>
                          <div className="grid grid-cols-2 gap-2">
                            {FASHION_AVATAR_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setFashionAvatar(opt.value)}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${fashionAvatar === opt.value ? 'border-purple-500 bg-white shadow-sm' : 'border-transparent bg-white/60 hover:border-purple-200'}`}
                              >
                                <span className="text-2xl">{opt.icon}</span>
                                <span className="text-xs font-semibold text-gray-800">{opt.label}</span>
                                <span className="text-[10px] text-gray-500 leading-tight text-center">{opt.hint}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Tailles */}
                        <div className="mb-5">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-purple-800">Tailles disponibles</label>
                            <span className="text-[10px] text-gray-500">{fashionSizes.length} sélectionnée{fashionSizes.length > 1 ? 's' : ''}</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-gray-500 w-14">LETTRES</span>
                              {FASHION_SIZES_LETTER.map(s => {
                                const active = fashionSizes.includes(s);
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setFashionSizes(prev => active ? prev.filter(x => x !== s) : [...prev, s])}
                                    className={`min-w-[40px] px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 transition ${active ? 'border-purple-500 bg-purple-500 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'}`}
                                  >{s}</button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-gray-500 w-14">EU</span>
                              {FASHION_SIZES_NUMERIC.map(s => {
                                const active = fashionSizes.includes(s);
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setFashionSizes(prev => active ? prev.filter(x => x !== s) : [...prev, s])}
                                    className={`min-w-[40px] px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 transition ${active ? 'border-purple-500 bg-purple-500 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'}`}
                                  >{s}</button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-gray-500 w-14">POINTURE</span>
                              {FASHION_SIZES_SHOES.map(s => {
                                const key = `p${s}`;
                                const active = fashionSizes.includes(key);
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFashionSizes(prev => active ? prev.filter(x => x !== key) : [...prev, key])}
                                    className={`min-w-[40px] px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 transition ${active ? 'border-purple-500 bg-purple-500 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'}`}
                                  >{s}</button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Couleurs */}
                        <div className="mb-5">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-purple-800">Couleurs disponibles</label>
                            <span className="text-[10px] text-gray-500">{fashionColors.length} sélectionnée{fashionColors.length > 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {FASHION_COLORS.map(c => {
                              const active = fashionColors.some(x => x.hex === c.hex);
                              return (
                                <button
                                  key={c.hex}
                                  type="button"
                                  onClick={() => setFashionColors(prev => active ? prev.filter(x => x.hex !== c.hex) : [...prev, c])}
                                  className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border-2 text-xs font-medium transition ${active ? 'border-purple-500 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-purple-300'}`}
                                >
                                  <span className="w-5 h-5 rounded-full border border-gray-200" style={{ background: c.hex }} />
                                  <span className="text-gray-700">{c.name}</span>
                                  {active && <span className="text-purple-600 text-sm leading-none">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Style minimaliste */}
                        <label className="flex items-start gap-3 p-3 bg-white rounded-xl border-2 border-purple-100 cursor-pointer hover:border-purple-300 transition">
                          <input
                            type="checkbox"
                            checked={fashionMinimalist}
                            onChange={e => setFashionMinimalist(e.target.checked)}
                            className="mt-0.5 w-4 h-4 accent-purple-600"
                          />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-gray-800">Page produit minimaliste</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Layout éditorial épuré : focus silhouette, détails matière, moins de sections marketing. Recommandé pour la mode.</p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Source + contenu source */}
                  {productSubstep === 2 && (
                  <div className="space-y-4 rounded-[30px] border border-gray-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:p-6">
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Globe className="h-4 w-4 text-slate-700" />
                        Source du produit
                      </label>
                      <div className="flex gap-2 rounded-[18px] border border-gray-200 bg-gray-50 p-1.5 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setInputMode('url')}
                          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                            inputMode === 'url'
                                ? 'rounded-2xl bg-[#0F6B4F] text-white shadow-[0_10px_22px_rgba(15,107,79,0.16)]'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Lien du produit
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputMode('description')}
                          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                            inputMode === 'description'
                                ? 'rounded-2xl bg-[#0F6B4F] text-white shadow-[0_10px_22px_rgba(15,107,79,0.16)]'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Description directe
                          </span>
                        </button>
                      </div>
                    </div>

                    {inputMode === 'url' ? (
                      <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm">
                        <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Globe className="h-4 w-4 text-slate-700" />
                          Lien du produit (Amazon, Alibaba, AliExpress, etc.)
                        </label>
                        <div className="relative">
                          <input
                            type="url"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="https://www.amazon.com/.../... ou https://www.alibaba.com/..."
                            className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-scalor-green focus:border-[#96C7B5]"
                          />
                          {url && (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-scalor-green">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm">
                        <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <FileText className="h-4 w-4 text-slate-700" />
                          Description du produit
                        </label>
                        <textarea
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder="Décris ton produit ici... (ex: Gélules de Graviola bio, 60 capsules de 600mg, extrait naturel de feuilles de corossol, riche en antioxydants, aide à renforcer le système immunitaire...)"
                          rows={5}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-scalor-green focus:border-[#96C7B5] resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Minimum 20 caractères • Décris les bénéfices, caractéristiques et usages du produit
                        </p>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Photo Upload */}
                  {productSubstep === 3 && (
                  <div className="rounded-[30px] border border-gray-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:p-6">
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Upload className="h-4 w-4 text-slate-700" />
                      Tes vraies photos du produit <span className="font-normal text-gray-500">(3–8 recommandées)</span>
                    </label>
                    <div
                      onDrop={handleDrop}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative rounded-[24px] border-2 border-dashed p-6 text-center cursor-pointer transition ${
                        dragOver ? 'border-[#0F6B4F] bg-[#E6F2ED]' : 'border-gray-200 hover:border-[#96C7B5] hover:bg-gray-50'
                      }`}
                    >
                      <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-600">Glisse tes photos ici ou <span className="text-scalor-green">clique pour sélectionner</span></p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — max 10MB chaque — jusqu'à 8 photos</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={e => addPhotos(e.target.files)}
                      />
                    </div>

                    {photos.length > 0 && (
                      <div className="mt-4 grid grid-cols-4 gap-3">
                        {photos.map((photo, i) => (
                          <div key={i} className="relative group aspect-square rounded-[18px] overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">
                            <img
                              src={URL.createObjectURL(photo)}
                              alt={`Photo ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); removePhoto(i); }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            {i === 0 && (
                              <div className="absolute bottom-0 left-0 right-0 bg-scalor-green/90 text-white text-xs text-center py-0.5">Hero</div>
                            )}
                          </div>
                        ))}
                        {photos.length < 8 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-[18px] border-2 border-dashed border-gray-200 hover:border-[#96C7B5] flex items-center justify-center text-gray-400 hover:text-scalor-green transition bg-white/75"
                          >
                            <Upload className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </>
              )}

              {/* ÉTAPE 2: Méthode Copywriting (simplifié) */}
              {usesStandardProductGenerator && step === 2 && (
                <>
                  {/* 3 Méthodes Copywriting */}
                  <div className="rounded-[30px] border border-gray-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:p-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Choisis ta méthode copywriting
                    </label>
                    <p className="text-xs text-gray-500 mb-3">La méthode choisie pilote tout : texte, images, structure de la page</p>
                    <div className="grid grid-cols-1 gap-3">
                      {COPYWRITING_APPROACHES.map(approach => (
                        <button
                          key={approach.value}
                          type="button"
                          onClick={() => setMarketingApproach(approach.value)}
                          className={`p-4 rounded-[22px] border text-left transition ${
                            marketingApproach === approach.value
                              ? 'border-[#96C7B5] bg-[#E6F2ED] shadow-[0_14px_28px_rgba(15,107,79,0.10)]'
                              : 'border-gray-200 hover:border-[#96C7B5] bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                <approach.icon className="h-4 w-4" />
                              </span>
                              <span className={`text-base font-bold ${
                                marketingApproach === approach.value ? 'text-[#0A5740]' : 'text-gray-900'
                              }`}>
                                {approach.label}
                              </span>
                            </div>
                            {marketingApproach === approach.value && (
                              <CheckCircle className="w-5 h-5 text-scalor-green" />
                            )}
                          </div>
                          <p className="text-xs font-medium text-gray-600 mb-1">{approach.desc}</p>
                          <p className="text-xs text-gray-400 leading-relaxed">{approach.detail}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                </>
              )}

              {/* ÉTAPE 3: Paramètres avancés (simplifié) */}
              {usesStandardProductGenerator && step === 3 && (
                <>
                  {/* Header */}
                  <div className="text-center space-y-2 mb-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-stone-200 bg-stone-50">
                      <Star className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-bold text-slate-800">Optionnel</span>
                    </div>
                    <p className="text-xs text-gray-500">Ces infos aident l'IA a mieux cibler ta page produit</p>
                  </div>

                  <div className="space-y-3 rounded-[28px] border border-gray-200 bg-white p-5 mb-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-scalor-green" />
                        Visuels de la page
                      </label>
                      <p className="text-xs text-gray-500">Choisis le type de visuels que le modèle doit générer pour cette page produit.</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {IMAGE_GENERATION_MODES.map((mode) => {
                        const isActive = imageGenerationMode === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setImageGenerationMode(mode.id)}
                            className={`rounded-[20px] border p-4 text-left transition ${isActive ? 'border-[#96C7B5] bg-[#E6F2ED] shadow-sm' : 'border-gray-200 bg-white hover:border-[#96C7B5] hover:bg-gray-50'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{mode.label}</p>
                                <p className="mt-1 text-xs leading-5 text-gray-500">{mode.description}</p>
                              </div>
                              <div className={`mt-0.5 h-4 w-4 rounded-full border ${isActive ? 'border-[#0F6B4F] bg-[#0F6B4F]' : 'border-stone-300 bg-white'}`} />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {imageGenerationMode === 'ad_4_5' && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Le modèle gardera une composition verticale 4:5 sur les visuels générés pour le hero, les affiches et les images marketing.
                      </div>
                    )}
                  </div>

                  {/* Avatar cible */}
                  <div className="space-y-4 rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-scalor-green" />
                        Avatar client cible
                      </label>
                      <p className="text-xs text-gray-500">Choisis le genre, l’âge et le profil sans devoir tout écrire à la main.</p>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold text-gray-700">Genre</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TARGET_GENDER_OPTIONS.map((option) => {
                          const isActive = targetGender === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setTargetGender(option.value)}
                              className={`rounded-[20px] border px-3 py-3 text-left transition ${isActive ? 'border-[#96C7B5] bg-[#E6F2ED] shadow-sm' : 'border-gray-200 bg-white hover:border-[#96C7B5]'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                                  <p className="mt-1 text-xs text-gray-500">{option.hint}</p>
                                </div>
                                <div className={`mt-0.5 h-4 w-4 rounded-full border ${isActive ? 'border-[#0F6B4F] bg-[#0F6B4F]' : 'border-stone-300 bg-white'}`} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Tranche d’âge</label>
                        <select
                          value={targetAgeRange}
                          onChange={(e) => setTargetAgeRange(e.target.value)}
                          className="w-full rounded-[16px] border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-[#96C7B5] focus:outline-none focus:ring-2 focus:ring-scalor-green"
                        >
                          {TARGET_AGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Profil</label>
                        <select
                          value={targetProfile}
                          onChange={(e) => setTargetProfile(e.target.value)}
                          className="w-full rounded-[16px] border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-[#96C7B5] focus:outline-none focus:ring-2 focus:ring-scalor-green"
                        >
                          {TARGET_PROFILE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-dashed border-[#96C7B5] bg-gray-50 px-3 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Résumé avatar</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{targetAvatarSummary || 'Auto selon le produit et les photos'}</p>
                    </div>

                    {/* Probleme principal */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-scalor-green" />
                        Problème principal
                      </label>
                      <textarea
                        value={mainProblem}
                        onChange={(e) => setMainProblem(e.target.value)}
                        placeholder="Ex: Peau terne avec des taches, perte de confiance en soi..."
                        rows={2}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-[16px] text-sm focus:outline-none focus:ring-2 focus:ring-scalor-green focus:border-[#96C7B5] resize-none bg-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">Quel probleme ton produit resout ?</p>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className={`p-4 rounded-xl border ${
                  limitReached 
                    ? 'bg-white border-gray-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  {limitReached ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-scalor-copper flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900">Tu n'as plus de crédits</h3>
                        <p className="text-xs text-gray-500">Achète des crédits pour générer des pages produit IA.</p>
                      </div>
                      <button type="button" onClick={() => openCreditsPaymentModal('Tu n\'as plus de crédits. Choisis un pack pour acheter de nouveaux crédits.')}
                        className="px-4 py-2 bg-scalor-copper text-white font-bold rounded-xl hover:bg-scalor-copper-dark transition text-sm shadow-lg whitespace-nowrap">
                        Acheter des crédits
                      </button>
                    </div>
                  ) : error.includes('Session expirée') ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900">Session expirée</h3>
                        <p className="text-xs text-gray-500">Reconnecte-toi pour continuer à générer des pages.</p>
                      </div>
                      <button type="button" onClick={() => { window.location.href = '/ecom/login'; }}
                        className="px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition text-sm shadow-lg whitespace-nowrap">
                        Se reconnecter
                      </button>
                    </div>
                  ) : (
                    <ErrorBanner message={error} onDismiss={() => setError('')} />
                  )}
                </div>
              )}

              {paymentNotice && (
                <div className="rounded-xl border border-[#96C7B5] bg-[#E6F2ED] px-4 py-3 text-sm text-[#0A5740]">
                  {paymentNotice}
                </div>
              )}

              {/* ─── MODAL ACHAT CRÉDITS ─── */}
              {showPaymentForm && limitReached && (
                <PaymentModalFrame
                  onClose={() => setShowPaymentForm(false)}
                  eyebrow="Credits IA"
                  title="Acheter des credits"
                  subtitle="Rechargez vos credits de generation pour reprendre la creation de pages produit sans quitter le modal."
                  icon={<Zap className="h-full w-full" />}
                  headerClassName="bg-gradient-to-br from-[#8E471D] via-[#C56A2D] to-[#E18A44]"
                  maxWidthClassName="max-w-md"
                  summary={{
                    label: pendingGenerationToken ? 'Recharge en attente' : 'Pack selectionne',
                    value: `${pendingGenerationPayment?.amount || (selectedPack === 'pack3' ? pricing.pack3 : pricing.unit)} FCFA`,
                    meta: pendingGenerationToken
                      ? `${pendingGenerationPayment?.quantity || 1} credit${(pendingGenerationPayment?.quantity || 1) > 1 ? 's' : ''} en attente de confirmation`
                      : selectedPack === 'pack3'
                        ? 'Pack 3 credits avec economie integree'
                        : '1 credit = 1 page produit IA complete',
                    badge: pendingGenerationToken ? 'En attente' : selectedPack === 'pack3' ? 'Pack 3' : '1 credit',
                  }}
                  footerItems={[
                    { label: 'Credits ajoutes automatiquement' },
                    { label: 'Relance MoneyFusion incluse' },
                    { label: 'Verification sans rechargement' },
                  ]}
                >
                    <div className="space-y-4">
                      {pendingGenerationToken ? (
                        <>
                          <div className="rounded-xl border border-[#96C7B5] bg-[#E6F2ED] p-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/80">
                                <Loader2 className="h-4 w-4 animate-spin text-scalor-green" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-[#0A5740]">Paiement en attente de confirmation</p>
                                <p className="mt-1 text-xs text-[#0A5740]/80">Finalise le paiement dans la fenêtre MoneyFusion ouverte. Dès que le prestataire confirme, tes crédits seront ajoutés automatiquement ici.</p>
                                {pendingGenerationPayment?.amount ? (
                                  <p className="mt-2 text-xs font-semibold text-[#0A5740]">
                                    Recharge en attente: {pendingGenerationPayment.amount} FCFA pour {pendingGenerationPayment.quantity || 1} crédit{(pendingGenerationPayment.quantity || 1) > 1 ? 's' : ''}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {paymentStatusError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                              {paymentStatusError}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={resumePendingGenerationPayment}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-scalor-green text-white font-bold rounded-xl hover:bg-scalor-green-dark transition text-sm disabled:opacity-40"
                          >
                            {pendingGenerationPayment?.amount ? (
                              <><Zap className="w-4 h-4" /> Continuer le paiement {pendingGenerationPayment.amount} FCFA</>
                            ) : (
                              <><Zap className="w-4 h-4" /> Continuer le paiement</>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => checkPendingGenerationPayment()}
                            disabled={paymentChecking}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold transition hover:bg-gray-50 text-sm disabled:opacity-50"
                          >
                            {paymentChecking ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Vérification...</>
                            ) : (
                              <><RefreshCw className="w-4 h-4" /> Vérifier le statut</>
                            )}
                          </button>

                          <p className="text-xs text-center text-gray-400">
                            Le bouton principal relance MoneyFusion avec le montant de recharge. Le statut peut aussi être vérifié sans recharger la page.
                          </p>
                        </>
                      ) : (
                        <>
                          {/* Pack selection */}
                          <div className="grid gap-2">
                            <button type="button" onClick={() => setSelectedPack('unit')}
                              className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${selectedPack === 'unit' ? 'border-scalor-green bg-scalor-green text-white' : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400'}`}>
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selectedPack === 'unit' ? 'bg-white/15' : 'bg-scalor-green/10'}`}>
                                <Zap className={`w-4 h-4 ${selectedPack === 'unit' ? 'text-white' : 'text-scalor-green'}`} />
                              </div>
                              <div className="flex-1">
                                <p className={`text-sm font-bold ${selectedPack === 'unit' ? 'text-white' : 'text-gray-900'}`}>1 crédit</p>
                                <p className={`text-xs ${selectedPack === 'unit' ? 'text-white/70' : 'text-gray-500'}`}>1 page produit complète avec visuels IA</p>
                              </div>
                              <span className={`text-sm font-bold ${selectedPack === 'unit' ? 'text-white' : 'text-gray-900'}`}>{pricing.unit} FCFA</span>
                            </button>
                            <button type="button" onClick={() => setSelectedPack('pack3')}
                              className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all relative ${selectedPack === 'pack3' ? 'border-scalor-green bg-scalor-green text-white' : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400'}`}>
                              <span className="absolute -top-2.5 right-4 text-[10px] font-bold bg-scalor-green text-white px-2.5 py-0.5 rounded-full">MEILLEURE OFFRE</span>
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selectedPack === 'pack3' ? 'bg-white/15' : 'bg-scalor-green/10'}`}>
                                <Zap className={`w-4 h-4 ${selectedPack === 'pack3' ? 'text-white' : 'text-scalor-green'}`} />
                              </div>
                              <div className="flex-1">
                                <p className={`text-sm font-bold ${selectedPack === 'pack3' ? 'text-white' : 'text-gray-900'}`}>Pack 3 crédits</p>
                                <p className={`text-xs ${selectedPack === 'pack3' ? 'text-white/70' : 'text-gray-500'}`}>Économise {pricing.unit * 3 - pricing.pack3} FCFA sur 3 crédits</p>
                              </div>
                              <span className={`text-sm font-bold ${selectedPack === 'pack3' ? 'text-white' : 'text-gray-900'}`}>{pricing.pack3} FCFA</span>
                            </button>
                          </div>

                          {/* Formulaire paiement */}
                          <div className="space-y-3 pt-1">
                            <div>
                              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500"><Phone className="h-3.5 w-3.5 text-scalor-green" />Numéro de téléphone</label>
                              <input type="tel" value={paymentPhone} onChange={(e) => setPaymentPhone(e.target.value)}
                                placeholder="Ex: 0707070707"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-scalor-green focus:border-scalor-green" />
                            </div>
                            <div>
                              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500"><User className="h-3.5 w-3.5 text-scalor-green" />Votre nom</label>
                              <input type="text" value={paymentName} onChange={(e) => setPaymentName(e.target.value)}
                                placeholder="Ex: Jean Dupont"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-scalor-green focus:border-scalor-green" />
                            </div>
                          </div>

                          {paymentStatusError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                              {paymentStatusError}
                            </div>
                          )}

                          {/* Bouton payer */}
                          <button type="button" onClick={handleBuyGeneration} disabled={paymentLoading || !selectedPack}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-scalor-green text-white font-bold rounded-xl hover:bg-scalor-green-dark transition text-sm disabled:opacity-40">
                            {paymentLoading ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
                            ) : (
                              <><Zap className="w-4 h-4" /> Payer {selectedPack === 'pack3' ? pricing.pack3 : pricing.unit} FCFA</>
                            )}
                          </button>

                          {(generationsInfo?.totalUsed || 0) > 0 && (
                            <p className="text-xs text-center text-gray-400">
                              Tu as déjà généré {generationsInfo.totalUsed} page{generationsInfo.totalUsed > 1 ? 's' : ''} produit.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                </PaymentModalFrame>
              )}
            </div>
          )}

          {/* ─── AI GENERATION LOADING PHASE ─── */}
          {phase === 'loading' && (() => {
            const STEPS = [
              { icon: Search,     label: 'Analyse',     desc: 'Analyse du produit' },
              { icon: Zap,        label: 'Contenu',     desc: 'Rédaction marketing' },
              { icon: Layers,     label: 'Design',      desc: 'Mise en page' },
              { icon: CheckCircle,label: 'Finalisation',desc: 'Vérification finale' },
              { icon: ImageIcon,  label: 'Visuels',     desc: 'Génération des images' },
            ];
            const activeStep = Math.min(buildStep, STEPS.length - 1);
            return (
              <div className="relative flex flex-col items-center justify-center bg-white min-h-[640px] w-full select-none px-6">
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes spin-slow { to { transform: rotate(360deg) } }
                  @keyframes pulse-dot { 0%,100%{opacity:.4;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
                  @keyframes shimmer-light { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
                  @keyframes fade-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
                  @keyframes confetti-fall { to{transform:translateY(700px) rotate(720deg);opacity:0} }
                ` }} />

                {/* Confetti — uniquement à la fin */}
                {showConfetti && (
                  <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                    {[...Array(50)].map((_, i) => (
                      <div key={i} className="absolute" style={{
                        left: `${Math.random() * 100}%`, top: -12,
                        animation: `confetti-fall ${1.4 + Math.random() * 2}s linear forwards`,
                        animationDelay: `${Math.random() * 0.6}s`,
                      }}>
                        <div style={{
                          width: i % 3 === 0 ? 7 : 4, height: i % 3 === 0 ? 7 : 4,
                          borderRadius: i % 2 === 0 ? '50%' : 2,
                          background: ['#0F6B4F','#14a373','#34d399','#fbbf24','#60a5fa','#f472b6'][i % 6],
                          transform: `rotate(${Math.random()*360}deg)`,
                        }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Carte centrale — épurée, Material/Linear style */}
                <div className="relative w-full max-w-[480px] text-center" style={{ animation: 'fade-up 0.4s ease forwards' }}>

                  {/* Spinner OU icône d'erreur selon l'état */}
                  <div className="relative inline-flex items-center justify-center mb-7" style={{ width: 80, height: 80 }}>
                    {imageGenerationFailed ? (
                      <div className="flex items-center justify-center w-full h-full rounded-full bg-red-50 border-2 border-red-200">
                        <AlertCircle className="w-9 h-9 text-red-500" />
                      </div>
                    ) : (
                      <>
                        <svg width="80" height="80" viewBox="0 0 80 80" style={{ animation: 'spin-slow 1.4s linear infinite' }}>
                          <circle cx="40" cy="40" r="34" fill="none" stroke="#E5E7EB" strokeWidth="4" />
                          <circle
                            cx="40" cy="40" r="34"
                            fill="none"
                            stroke="#0F6B4F"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray="60 213"
                          />
                        </svg>
                        <Sparkles
                          className="absolute"
                          style={{ width: 26, height: 26, color: '#0F6B4F' }}
                        />
                      </>
                    )}
                  </div>

                  {/* Badge état */}
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-4 ${
                    imageGenerationFailed ? 'bg-red-50' : 'bg-primary-50'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${imageGenerationFailed ? 'bg-red-500' : 'bg-primary-500'}`}
                         style={imageGenerationFailed ? undefined : { animation: 'pulse-dot 1.4s ease-in-out infinite' }} />
                    <span className={`text-[11px] font-semibold tracking-wide uppercase ${
                      imageGenerationFailed ? 'text-red-700' : 'text-primary-700'
                    }`}>
                      {imageGenerationFailed ? 'Échec génération images' : 'IA en cours'}
                    </span>
                  </div>

                  {/* Titre — soit étape en cours, soit message d'erreur */}
                  <h2 className="text-[22px] font-bold text-gray-900 mb-2 leading-tight tracking-tight">
                    {imageGenerationFailed
                      ? "Les images n'ont pas pu être générées"
                      : (['Analyse de votre produit','Génération du contenu','Construction de la page','Finalisation','Génération des visuels'][activeStep] || 'Préparation')
                    }
                  </h2>

                  {/* Sous-titre — soit message dynamique, soit détail erreur */}
                  <p className={`text-sm min-h-[22px] mb-7 ${imageGenerationFailed ? 'text-red-700' : 'text-gray-500'}`}>
                    {imageGenerationFailed
                      ? imageGenerationFailed.message
                      : <TypingText text={buildMessage} />
                    }
                  </p>

                  {/* Barre de progression — masquée en cas d'échec */}
                  {!imageGenerationFailed && (
                    <div className="w-full mb-7">
                      <div className="flex items-center justify-between text-[11px] font-medium text-gray-400 mb-1.5">
                        <span>Progression</span>
                        <span className="text-gray-900 font-semibold">{Math.round(buildProgress)}%</span>
                      </div>
                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${buildProgress}%`,
                            background: 'linear-gradient(90deg, #0F6B4F, #14a373)',
                            transition: 'width 0.6s ease',
                          }}
                        >
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', animation: 'shimmer-light 1.8s infinite' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Liste étapes — masquée en cas d'échec */}
                  {!imageGenerationFailed && (
                  <div className="w-full text-left space-y-2 mb-8">
                    {STEPS.map((s, i) => {
                      const Icon = s.icon;
                      const done = i < activeStep;
                      const active = i === activeStep;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                            active ? 'bg-primary-50/70' : done ? 'opacity-100' : 'opacity-50'
                          }`}
                        >
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            done ? 'bg-primary-600' : active ? 'bg-white ring-2 ring-primary-600' : 'bg-gray-100'
                          }`}>
                            {done
                              ? <CheckCircle className="w-4 h-4 text-white" />
                              : active
                                ? <Icon className="w-3.5 h-3.5 text-primary-600" />
                                : <Icon className="w-3.5 h-3.5 text-gray-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-semibold ${done ? 'text-gray-900' : active ? 'text-primary-700' : 'text-gray-500'}`}>
                              {s.label}
                            </p>
                            <p className="text-[11px] text-gray-400 truncate">{s.desc}</p>
                          </div>
                          {active && (
                            <Loader2 className="w-3.5 h-3.5 text-primary-600 animate-spin shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  )}

                  {/* Actions — adapté selon l'état (génération en cours OU échec) */}
                  {imageGenerationFailed ? (
                    <div className="flex flex-col items-stretch gap-2 pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          // Retry — relance la génération depuis le début, sans recharger texte
                          setImageGenerationFailed(null);
                          setBuildStep(4);
                          setBuildProgress(80);
                          setBuildMessage('Nouvelle tentative...');
                          // Si on a un taskId, on retry juste les images via l'endpoint dédié
                          if (currentTaskId) {
                            try {
                              const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${currentTaskId}/retry`, {
                                method: 'POST',
                                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                              });
                              const data = await resp.json();
                              if (data.success && data.task?.imageJobId) {
                                setImageJobId(data.task.imageJobId);
                                return;
                              }
                              setImageGenerationFailed({
                                message: data.message || 'Impossible de relancer la génération. Recommencez depuis le début.',
                                status: 'error',
                              });
                            } catch {
                              setImageGenerationFailed({
                                message: 'Erreur réseau pendant la nouvelle tentative.',
                                status: 'error',
                              });
                            }
                          } else {
                            // Pas de taskId → repart en mode input (l'utilisateur cliquera Générer)
                            setPhase('input');
                            setBuildStep(0);
                            setBuildProgress(0);
                            setBuildMessage('');
                          }
                        }}
                        className="px-5 py-3 rounded-xl bg-[#0F6B4F] text-white text-sm font-bold hover:bg-[#0A5740] transition shadow-[0_4px_14px_rgba(15,107,79,0.25)] flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Réessayer la génération d'images
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // L'utilisateur veut quand même voir le contenu texte sans images
                          setImageGenerationFailed(null);
                          setPhase('preview');
                          setActiveTab('page');
                        }}
                        className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition"
                      >
                        Voir quand même le contenu texte
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          abortRef.current?.abort();
                          setImageGenerationFailed(null);
                          setPhase('input');
                          setBuildStep(0);
                          setBuildProgress(0);
                          setBuildMessage('');
                          setShowConfetti(false);
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600 transition px-2 py-2"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleContinueInBackground}
                        className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 hover:border-gray-300 transition"
                      >
                        Continuer en arrière-plan
                      </button>
                      <button
                        type="button"
                        onClick={() => { abortRef.current?.abort(); setPhase('input'); setBuildStep(0); setBuildProgress(0); setBuildMessage(''); setShowConfetti(false); }}
                        className="text-xs text-gray-400 hover:text-gray-600 transition px-2 py-2"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ─── PREVIEW PHASE ─── */}
          {phase === 'preview' && product && (
            <div className="p-6 space-y-5">

              {/* Success Banner */}
              <div className={pageMode ? 'rounded-[28px] border border-[#cfe5dc] bg-white p-5 shadow-[0_14px_40px_rgba(15,107,79,0.06)]' : 'rounded-xl border-2 border-[#96C7B5] bg-[#E6F2ED] p-4'}>
                <div className="flex items-center gap-3">
                  <div className={pageMode ? 'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0A5740] shadow-[0_14px_34px_rgba(15,107,79,0.18)]' : 'w-12 h-12 rounded-full bg-scalor-green flex items-center justify-center shrink-0'}>
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className={pageMode ? 'mb-1 text-lg font-black text-[#0A5740]' : 'text-base font-bold text-[#0A5740] mb-1'}>Génération terminée avec succès</h3>
                    <p className={pageMode ? 'text-sm leading-6 text-[#2e6f59]' : 'text-sm text-[#0F6B4F]'}>
                      Voici l'aperçu de votre page produit générée par IA. Explorez les onglets ci-dessous puis cliquez sur <strong>"Appliquer"</strong> pour l'utiliser.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className={pageMode ? 'flex gap-1.5 rounded-[20px] border border-gray-200 bg-white p-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]' : 'flex gap-1 p-1 bg-gray-100 rounded-xl'}>
                {[
                  { id: 'page', label: 'Page', icon: Package },
                  { id: 'final', label: 'Finale', icon: Smartphone },
                  { id: 'affiches', label: 'Affiches', icon: ImageIcon },
                  { id: 'faq', label: 'FAQ + Avis', icon: Star },
                  { id: 'images', label: 'Photos', icon: ImageIcon }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-medium transition ${
                      activeTab === id
                        ? `${pageMode ? 'rounded-2xl bg-[#0F6B4F] text-white shadow-[0_12px_24px_rgba(15,107,79,0.18)]' : 'bg-white text-[#0A5740] shadow-sm ring-1 ring-[#96C7B5]'}`
                        : `${pageMode ? 'rounded-2xl text-gray-500 hover:bg-gray-100 hover:text-gray-900' : 'text-gray-500 hover:text-gray-700'}`
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'final' && (
                <FinalPagePreview product={product} templateTheme={templateTheme} selectedTemplate={selectedTemplate} />
              )}

              {/* Tab: Page (overview) */}
              {activeTab === 'page' && (
                <div className="space-y-4">
                  {/* Images loading banner */}
                  {imagesLoading && (
                    <div className="flex items-center gap-3 rounded-xl border border-[#96C7B5] bg-white p-3">
                      <Loader2 className="w-4 h-4 text-scalor-green animate-spin shrink-0" />
                      <span className="text-sm font-medium text-[#0A5740]">
                        Les images sont en cours de génération en arrière-plan...
                      </span>
                    </div>
                  )}
                  {/* Hero photo avec textes */}
                  {product.heroImage && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <ImagePreview src={product.heroImage} label="Image HERO principale" className="w-full aspect-square" />
                      {(product.hero_headline || product.hero_slogan || product.hero_baseline) && (
                        <div className="border-t border-gray-200 bg-white p-4">
                          {product.hero_headline && (
                            <p className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-1"><Megaphone className="h-4 w-4 text-scalor-green" />{product.hero_headline}</p>
                          )}
                          {product.hero_slogan && (
                            <p className="flex items-center gap-2 text-sm text-[#0F6B4F] italic mb-1"><Sparkles className="h-4 w-4" />{product.hero_slogan}</p>
                          )}
                          {product.hero_baseline && (
                            <p className="text-xs text-gray-600">{product.hero_baseline}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hero Poster (affiche graphique) */}
                  {product.heroPosterImage && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <ImagePreview src={product.heroPosterImage} label="Affiche publicitaire hero" className="w-full aspect-square" />
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                        <p className="text-xs text-gray-500">🎨 Visuel affiche — idéal pour publicités Facebook/Instagram</p>
                      </div>
                    </div>
                  )}

                  {/* Titre */}
                  <div className="p-4 bg-white rounded-xl border border-gray-200">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{product.title}</h3>
                      <CopyButton text={product.title} />
                    </div>
                    {/* CTA + Badge urgence */}
                    {(product.hero_cta || product.urgency_badge) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {product.urgency_badge && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#E6F2ED] text-[#0A5740] text-xs font-bold rounded-full border border-[#96C7B5]">
                            {product.urgency_badge}
                          </span>
                        )}
                        {product.hero_cta && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-scalor-green text-white text-xs font-bold rounded-full">
                            <ArrowRight className="h-3.5 w-3.5" />
                            {product.hero_cta}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stats Bar */}
                  {product.stats_bar?.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {product.stats_bar.map((stat, i) => (
                        <div key={i} className="p-3 bg-white rounded-xl border border-gray-200 text-center">
                          <p className="text-xs font-bold text-[#0A5740] leading-tight">{stat}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Problem / Solution */}
                  {product.problem_section && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><AlertTriangle className="h-3.5 w-3.5" />Problème</p>
                      {product.problem_section.title && (
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <p className="text-sm font-bold text-gray-900">{product.problem_section.title}</p>
                          <CopyButton text={product.problem_section.title} />
                        </div>
                      )}
                      <div className="space-y-2">
                        {(product.problem_section.pain_points || []).map((point, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0A5740]" />
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {product.solution_section && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><CheckCircle className="h-3.5 w-3.5" />Solution</p>
                      {product.solution_section.title && (
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-bold text-gray-900">{product.solution_section.title}</p>
                          <CopyButton text={product.solution_section.title} />
                        </div>
                      )}
                      {product.solution_section.description && (
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-700 leading-relaxed flex-1">{product.solution_section.description}</p>
                          <CopyButton text={product.solution_section.description} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Benefits Bullets */}
                  {product.benefits_bullets?.length > 0 && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><Sparkles className="h-3.5 w-3.5" />Bénéfices ({product.benefits_bullets.length})</p>
                      <div className="space-y-2">
                        {product.benefits_bullets.map((benefit, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-base flex-shrink-0">{benefit.match(/^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u)?.[0] || '•'}</span>
                            <span>{benefit.replace(/^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]\s*/u, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offer Block */}
                  {product.offer_block && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><Package className="h-3.5 w-3.5" />Offre</p>
                      <div className="space-y-2">
                        {product.offer_block.offer_label && (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-gray-900">{product.offer_block.offer_label}</p>
                            <CopyButton text={product.offer_block.offer_label} />
                          </div>
                        )}
                        {product.offer_block.guarantee_text && (
                          <div className="flex items-start justify-between gap-2">
                            <p className="flex flex-1 items-start gap-2 text-sm text-gray-700"><Lock className="mt-0.5 h-4 w-4 text-[#0A5740]" />{product.offer_block.guarantee_text}</p>
                            <CopyButton text={product.offer_block.guarantee_text} />
                          </div>
                        )}
                        {product.offer_block.countdown && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-[#E6F2ED] rounded-lg text-xs text-[#0A5740] font-medium">
                            <Clock3 className="h-3.5 w-3.5" />
                            Compte à rebours activé
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SEO */}
                  {product.seo && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-600"><Search className="h-3.5 w-3.5" />SEO</p>
                      <div className="space-y-3">
                        {product.seo.meta_title && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Meta title ({product.seo.meta_title.length}/60)</p>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-800 flex-1">{product.seo.meta_title}</p>
                              <CopyButton text={product.seo.meta_title} />
                            </div>
                          </div>
                        )}
                        {product.seo.meta_description && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Meta description ({product.seo.meta_description.length}/155)</p>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-gray-700 flex-1">{product.seo.meta_description}</p>
                              <CopyButton text={product.seo.meta_description} />
                            </div>
                          </div>
                        )}
                        {product.seo.slug && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">URL slug</p>
                            <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200">
                              <code className="text-xs text-scalor-green font-mono">/products/{product.seo.slug}</code>
                              <CopyButton text={product.seo.slug} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Urgency Elements */}
                  {product.urgency_elements && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><Zap className="h-3.5 w-3.5" />Urgence psychologique</p>
                      <div className="space-y-2 text-sm">
                        {product.urgency_elements.stock_limited && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Package className="h-4 w-4" />
                            <span>Stock limité activé</span>
                          </div>
                        )}
                        {product.urgency_elements.social_proof_count && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Star className="h-4 w-4" />
                            <span>{product.urgency_elements.social_proof_count}</span>
                          </div>
                        )}
                        {product.urgency_elements.quick_result && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Clock3 className="h-4 w-4" />
                            <span>{product.urgency_elements.quick_result}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Conversion Blocks */}
                  {product.conversion_blocks?.length > 0 && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><Zap className="h-3.5 w-3.5" />Blocs conversion ({product.conversion_blocks.length})</p>
                      <div className="grid grid-cols-2 gap-2">
                        {product.conversion_blocks.map((block, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <span className="text-lg">{block.icon}</span>
                            <span className="text-xs font-medium text-gray-700">{block.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4 Angles marketing */}
                  <div>
                    <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><Target className="h-3.5 w-3.5" />4 arguments marketing</p>
                    {(product.angles || []).map((angle, i) => (
                      <div key={i} className="mb-3 border border-gray-200 rounded-xl overflow-hidden bg-white">
                        {angle.poster_url && (
                          <ImagePreview src={angle.poster_url} label={`Visuel angle ${i + 1}`} className="w-full aspect-square" />
                        )}
                        <div className="p-4">
                          <h4 className="text-sm font-bold text-gray-800 mb-2">{angle.titre_angle}</h4>
                          {angle.explication && (
                            <p className="text-sm text-gray-600 mb-2 leading-relaxed">{angle.explication}</p>
                          )}
                          <p className="flex items-center gap-2 text-sm text-[#0F6B4F] font-medium italic mb-1"><Target className="h-4 w-4" />{angle.message_principal}</p>
                          {angle.promesse && (
                            <p className="flex items-center gap-2 text-xs text-gray-500 italic"><Sparkles className="h-3.5 w-3.5" />{angle.promesse}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Raisons d'acheter */}
                  {product.raisons_acheter?.length > 0 && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><CheckCircle className="h-3.5 w-3.5" />Raisons d'acheter</p>
                      <div className="space-y-2">
                        {product.raisons_acheter.map((r, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-scalor-green font-bold text-sm mt-0.5">✓</span>
                            <p className="text-sm text-gray-700">{r}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Affiches publicitaires */}
              {activeTab === 'affiches' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 font-medium">5 visuels d'angles marketing, simples et sans surcharge de texte</p>
                  {!imagesLoading && (product.angles || []).every(a => !a.poster_url) && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <ImageIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700">Les affiches nécessitent une photo du produit. Relancez la génération en uploadant une photo ou en fournissant une URL contenant une image.</p>
                    </div>
                  )}
                  {(product.angles || []).map((angle, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                      {angle.poster_url ? (
                        <div className="bg-gray-50">
                          <img src={angle.poster_url} alt={angle.titre_angle} className="w-full aspect-square object-cover" />
                        </div>
                      ) : imagesLoading ? (
                        <div className="p-6 bg-gray-50 text-center">
                          <Loader2 className="w-6 h-6 mx-auto mb-2 text-gray-300 animate-spin" />
                          <p className="text-xs text-gray-400">Génération en cours...</p>
                        </div>
                      ) : (
                        <div className="p-6 bg-gray-50 text-center">
                          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-xs text-gray-400">Affiche non générée</p>
                        </div>
                      )}
                        <div className="p-3 bg-white">
                        <p className="text-sm font-semibold text-gray-800 mb-1">{angle.titre_angle}</p>
                        <p className="text-xs text-[#0F6B4F] italic">{angle.message_principal}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: FAQ + Avis */}
              {activeTab === 'faq' && (
                <div className="space-y-4">
                  {/* Témoignages en Carrousel */}
                  {product.testimonials?.length > 0 && (
                    <div>
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><Star className="h-3.5 w-3.5" />{product.testimonials.length} témoignages clients</p>
                      <div className="-mx-2">
                        <TestimonialsCarousel 
                          testimonials={product.testimonials.map(t => ({
                            name: t.name,
                            location: t.location,
                            text: t.text,
                            rating: t.rating || 5,
                            verified: t.verified !== false,
                            date: t.date
                          }))}
                          autoPlay={false}
                        />
                      </div>
                    </div>
                  )}

                  {/* FAQ */}
                  <div>
                    <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-600"><AlertCircle className="h-3.5 w-3.5" />FAQ - 5 questions</p>
                    <div className="space-y-2">
                      {(product.faq || []).map((item, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 bg-gray-50 flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-800">{item.question}</p>
                            <CopyButton text={`${item.question}\n${item.reponse}`} />
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-sm text-gray-600">{item.reponse}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Raisons d'acheter */}
                  {product.raisons_acheter?.length > 0 && (
                    <div>
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><CheckCircle className="h-3.5 w-3.5" />{product.raisons_acheter.length} raisons d'acheter</p>
                      {product.raisons_acheter.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 mb-2 bg-white rounded-lg border border-gray-200">
                          <span className="text-scalor-green font-bold">{i + 1}.</span>
                          <div className="flex-1 flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-700">{r}</p>
                            <CopyButton text={r} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Photos */}
              {activeTab === 'images' && (
                <div className="space-y-4">
                  {/* Images loading indicator */}
                  {imagesLoading && (
                    <div className="flex items-center gap-3 rounded-xl border border-[#96C7B5] bg-[#E6F2ED] p-3">
                      <Loader2 className="w-4 h-4 text-scalor-green animate-spin" />
                      <span className="text-sm font-medium text-[#0A5740]">
                        Images en cours de génération... Elles apparaîtront ici automatiquement.
                      </span>
                    </div>
                  )}
                  {/* Visuels IA galerie principale */}
                  {(product.heroImage || product.heroPosterImage) && (
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><ImageIcon className="h-3.5 w-3.5" />Visuels galerie principale</p>
                      <div className="grid grid-cols-2 gap-3">
                        {product.heroImage && (
                          <div>
                            <ImagePreview src={product.heroImage} label="Hero — Showcase produit" className="aspect-square" />
                            <p className="text-xs text-center text-gray-400 mt-1">1ère image galerie</p>
                          </div>
                        )}
                        {product.heroPosterImage && (
                          <div>
                            <ImagePreview src={product.heroPosterImage} label="Affiche Hero" className="aspect-square" />
                            <p className="text-xs text-center text-gray-400 mt-1">Affiche publicitaire</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {(product.socialProofImages || []).length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><Users className="h-3.5 w-3.5" />Preuve sociale générée</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(product.socialProofImages || []).map((imgUrl, i) => (
                          <div key={`sp-${i}`}>
                            <ImagePreview src={imgUrl} label={`Preuve sociale ${i + 1}`} className="aspect-square" />
                            <p className="text-xs text-center text-gray-400 mt-1">Carré 1:1 pour le carousel</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Photos réelles */}
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">{(product.realPhotos || []).length} photos réelles uploadées</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(product.realPhotos || []).map((imgUrl, i) => (
                        <ImagePreview
                          key={i}
                          src={imgUrl}
                          label={i === 0 ? 'Photo principale' : `Photo ${i + 1}`}
                          className="aspect-square"
                        />
                      ))}
                    </div>
                  </div>
                  {/* Affiches générées */}
                  {(product.angles || []).some(a => a.poster_url) && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Affiches publicitaires IA</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(product.angles || []).filter(a => a.poster_url).map((angle, i) => (
                          <ImagePreview
                            key={i}
                            src={angle.poster_url}
                            label={angle.titre_angle}
                            className="aspect-square"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {(product.descriptionGifs || []).length > 0 && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">GIFs dans la description</p>
                        <p className="text-xs text-gray-500 mt-1">2 clips générés automatiquement et injectés dans la description finale.</p>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {(product.descriptionGifs || []).map((gif, index) => (
                          <GifPreview
                            key={`${gif.url || 'gif'}-${index}`}
                            src={gif.url}
                            label={gif.title || `GIF ${index + 1}`}
                            className="w-full aspect-video"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
              <div className={pageMode ? 'border-t border-gray-200 bg-white px-6 py-4 shadow-[0_-14px_40px_rgba(15,23,42,0.04)] backdrop-blur-sm shrink-0' : 'px-6 py-4 border-t border-gray-100 shrink-0'}>
          {phase === 'input' && usesStandardProductGenerator && (
            <>
              {/* Info générations restantes / mode gratuit */}
              {pageStyle === 'hero_page' && !pageMode && (
                <div className="mb-3 rounded-lg border border-primary-200 bg-primary-50 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary-600 shrink-0" />
                    <span className="font-medium text-primary-800">Mode gratuit — page complète + hero IA, sans images d'angles ni GIFs</span>
                  </div>
                </div>
              )}
              {pageStyle !== 'hero_page' && generationsInfo && !pageMode && (
                <div className="mb-3 rounded-lg border border-[#96C7B5] bg-[#E6F2ED] p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-scalor-green" />
                      <span className="font-medium text-gray-700">
                        Crédits restants :
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-bold">
                      <span className="inline-flex items-center gap-1.5 text-scalor-green"><Zap className="h-4 w-4" />{generationsInfo.remaining || 0} crédit{(generationsInfo.remaining || 0) > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {generationsInfo.totalUsed > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Tu as déjà généré {generationsInfo.totalUsed} page{generationsInfo.totalUsed > 1 ? 's' : ''} avec succès.
                    </p>
                  )}
                </div>
              )}
              
              {/* Navigation buttons */}
              <div className={pageMode ? 'flex flex-col gap-3 md:flex-row md:items-center' : 'flex items-center gap-3'}>
                {pageMode && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600 md:max-w-[340px]">
                    {step < 3
                      ? 'Renseigne le produit, définis la méthode puis affine le ciblage avant de lancer la génération.'
                      : pageStyle === 'hero_page'
                        ? 'Tout est prêt. La génération est gratuite — page complète + hero IA, sans images d\'angles.'
                        : 'Tout est prêt. Lance la génération pour produire la page, les visuels et les blocs marketing.'}
                  </div>
                )}
                {(step > 1 || productSubstep > 1) && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className={pageMode ? 'min-w-[180px] py-3 border border-gray-200 bg-white text-gray-700 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition flex items-center justify-center gap-2' : 'flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition flex items-center justify-center gap-2'}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Précédent
                  </button>
                )}
                
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={step === 1 && !isCurrentProductSubstepValid()}
                    className={`py-3 text-white font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg ${pageMode ? 'rounded-2xl bg-[linear-gradient(135deg,#0A5740,#14855F)] hover:brightness-105' : 'bg-scalor-green rounded-xl hover:bg-scalor-green-dark'} ${step === 1 ? 'w-full' : 'flex-[2]'}`}
                  >
                    <Sparkles className="w-4 h-4" />
                    {step === 1 && (productSubstep < totalProductSubsteps ? 'Suivant' : 'Suivant : Copywriting')}
                    {step === 2 && 'Suivant : Ciblage'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  /* Step 3: Single generation button */
                  <div className={`${step === 1 ? 'w-full' : 'flex-[2]'}`}>
                    <button
                      type="button"
                      onClick={() => handleGenerate()}
                      disabled={!canGenerate()}
                      className={`w-full py-3 text-white font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg ${pageMode ? 'rounded-2xl bg-[linear-gradient(135deg,#0A5740,#14855F)] hover:brightness-105' : 'bg-scalor-green rounded-xl hover:bg-scalor-green-dark'}`}
                    >
                      {(hasNoCredits && pageStyle !== 'hero_page') ? <Zap className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                      {(hasNoCredits && pageStyle !== 'hero_page') ? 'Acheter des crédits' : pageStyle === 'hero_page' ? 'Générer — Gratuit' : 'Générer ma page produit'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {phase === 'preview' && (
            <div className="space-y-3">
              {/* Info message — clean, neutre */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
                <p className="text-xs text-gray-700 text-center">
                  Aperçu ci-dessus. Cliquez sur <strong className="text-primary-700">"Utiliser cette page"</strong> pour l'appliquer à votre produit.
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-emerald-950">Produit digital lié</p>
                    {product?.ebook ? (
                      <p className="mt-0.5 text-xs font-bold text-emerald-700 truncate">{product.ebook.title || "Ebook généré"}</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-emerald-700">{"Génère l’ebook uniquement après avoir obtenu la page produit."}</p>
                    )}
                    {digitalProductNotice && (
                      <p className="mt-1 text-xs font-semibold text-emerald-800">{digitalProductNotice}</p>
                    )}
                  </div>
                  {product?.ebook && (
                    <span className="flex-shrink-0 px-2 py-0.5 bg-emerald-200 text-emerald-800 text-[10px] font-black rounded-full">Actif</span>
                  )}
                </div>
                {product?.ebook?.pdf?.url && (
                  <a href={product.ebook.pdf.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-600 hover:underline">Voir le PDF</a>
                )}
                <button
                  type="button"
                  onClick={openDigitalProductModal}
                  disabled={digitalProductLoading || !currentTaskId}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {digitalProductLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {product?.ebook ? "Régénérer l'ebook" : "Produit digital de ce produit"}
                  <span className="ml-1 px-1.5 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-full leading-none border border-white/30">3 crédits</span>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRestart}
                  className="flex-1 py-3 border border-gray-200 bg-white text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 hover:border-gray-300 transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Recommencer
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-[2] py-3.5 rounded-xl bg-[#0F6B4F] text-white font-bold text-sm transition flex items-center justify-center gap-2 hover:bg-[#0A5740] shadow-[0_4px_14px_rgba(15,107,79,0.25)] hover:shadow-[0_6px_20px_rgba(15,107,79,0.35)]"
                >
                  <CheckCircle className="w-5 h-5" />
                  Utiliser cette page
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  </div>
    <DigitalProductEbookModal
      open={showDigitalProductModal}
      productName={product?.title || product?.name || ''}
      existingEbook={product?.ebook || null}
      loading={digitalProductLoading}
      error={digitalProductError}
      generatedResult={digitalProductResult}
      onClose={() => {
        if (!digitalProductLoading) {
          setShowDigitalProductModal(false);
          setDigitalProductResult(null);
        }
      }}
      onGenerate={handleGenerateDigitalProduct}
      onRegenerate={() => setDigitalProductResult(null)}
      onSave={() => { setShowDigitalProductModal(false); setDigitalProductResult(null); }}
    />
    </>
  );
};

export default ProductPageGeneratorModal;
