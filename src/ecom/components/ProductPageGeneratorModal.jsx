import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle, AlertCircle, Upload,
  Image as ImageIcon, Copy, ExternalLink, Zap, Package, ArrowRight, ArrowLeft, Star,
  Globe, FileText, Search, Layers, Shield, Smartphone, Megaphone, Crown,
  Users, AlertTriangle, User, Phone, Target, Lock, Clock3, RefreshCw
} from 'lucide-react';
import TestimonialsCarousel from './TestimonialsCarousel';

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
    heroVisual: 'Scène maison vivante avec produit utilisé dans un vrai contexte du quotidien.',
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

function FinalPagePreview({ product, templateTheme, selectedTemplate }) {
  if (!product) return null;

  const descriptionTitleColor = templateTheme.primary;
  const descriptionContentColor = templateTheme.text;

  const gallery = [
    ...(product.heroImage ? [{ url: product.heroImage, alt: product.title || 'Hero' }] : []),
    ...(product.heroPosterImage ? [{ url: product.heroPosterImage, alt: `Affiche ${product.title || 'Produit'}` }] : []),
    ...(product.beforeAfterImage ? [{ url: product.beforeAfterImage, alt: 'Avant / Après' }] : []),
    ...((product.realPhotos || []).map((url, index) => ({ url, alt: `Photo ${index + 1}` }))),
    ...((product.angles || []).filter((angle) => angle.poster_url).map((angle, index) => ({ url: angle.poster_url, alt: angle.titre_angle || `Angle ${index + 1}` }))),
  ].filter((image, index, array) => image?.url && array.findIndex((entry) => entry.url === image.url) === index);

  const stats = Array.isArray(product.stats_bar) ? product.stats_bar.slice(0, 3) : [];
  const benefits = Array.isArray(product.benefits_bullets) ? product.benefits_bullets.slice(0, 4) : [];
  const conversionBlocks = Array.isArray(product.conversion_blocks) ? product.conversion_blocks.slice(0, 4) : [];
  const testimonials = Array.isArray(product.testimonials) ? product.testimonials : [];
  const faq = Array.isArray(product.faq) ? product.faq.slice(0, 5) : [];

  return (
    <div className="overflow-hidden rounded-[32px] border border-[#e6dacc] bg-[linear-gradient(180deg,#fffdf9_0%,#f8f2ea_100%)] shadow-[0_24px_80px_rgba(96,72,45,0.12)]">
      <div className="flex items-center justify-between border-b border-[#eadfd2] bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(249,241,233,0.96))] px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[18px] text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
            style={{ background: descriptionTitleColor }}
          >
            {(product.title || 'P').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-black text-[#1f1915]">Boutique preview</p>
            <p className="text-[11px] text-[#756556]">Rendu final avec la direction visuelle {selectedTemplate.label.toLowerCase()}</p>
          </div>
        </div>
        <div className="rounded-full border border-[#dfd2c5] bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold text-[#665647]">
          Page finale
        </div>
      </div>

      <div className="max-h-[72vh] overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_38%),#f7f0e8]">
        <div
          className="mx-auto w-full max-w-[980px]"
          style={{
            background: '#ffffff',
            color: descriptionContentColor,
          }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6" style={{ borderColor: `${templateTheme.accent}24`, backgroundColor: 'rgba(255,251,247,0.92)' }}>
            <div className="text-sm font-black" style={{ color: descriptionContentColor }}>Ma boutique</div>
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm" style={{ borderColor: `${descriptionTitleColor}33`, color: descriptionTitleColor, backgroundColor: `${descriptionTitleColor}08` }}>
              <Package className="h-3.5 w-3.5" />
              1 produit au panier
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="border-b lg:border-b-0 lg:border-r bg-[linear-gradient(180deg,rgba(255,251,247,0.84),rgba(255,255,255,1))]" style={{ borderColor: `${templateTheme.accent}20` }}>
              <div className="aspect-square w-full overflow-hidden bg-white">
                {gallery[0]?.url ? (
                  <img src={gallery[0].url} alt={gallery[0].alt} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300">
                    <ImageIcon className="h-12 w-12" />
                  </div>
                )}
              </div>
              {gallery.length > 1 && (
                <div className="grid grid-cols-4 gap-2 border-t bg-white p-3" style={{ borderColor: `${templateTheme.accent}18` }}>
                  {gallery.slice(1, 5).map((image, index) => (
                    <div key={`${image.url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: `${templateTheme.accent}20` }}>
                      <img src={image.url} alt={image.alt} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6 lg:p-8">
              <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] shadow-sm" style={{ backgroundColor: `${descriptionTitleColor}10`, color: descriptionTitleColor }}>
                <Sparkles className="h-3.5 w-3.5" />
                {selectedTemplate.label}
              </div>
              <h1 className="mt-4 text-3xl font-black leading-[1.02] tracking-[-0.03em] text-[#1f1915] sm:text-4xl">{product.title}</h1>
              {product.hero_slogan && (
                <p className="mt-3 text-sm font-medium leading-6 sm:text-base" style={{ color: `${descriptionContentColor}CC` }}>{product.hero_slogan}</p>
              )}
              {product.hero_baseline && (
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: descriptionTitleColor }}>{product.hero_baseline}</p>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border bg-white px-4 py-3 shadow-sm" style={{ borderColor: `${descriptionTitleColor}26` }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Titres description</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-white/70 shadow-sm" style={{ backgroundColor: descriptionTitleColor }} />
                    <span className="text-xs font-semibold" style={{ color: descriptionTitleColor }}>{descriptionTitleColor}</span>
                  </div>
                </div>
                <div className="rounded-[22px] border bg-white px-4 py-3 shadow-sm" style={{ borderColor: `${descriptionContentColor}14` }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Contenu description</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-white/70 shadow-sm" style={{ backgroundColor: descriptionContentColor }} />
                    <span className="text-xs font-semibold" style={{ color: descriptionContentColor }}>{descriptionContentColor}</span>
                  </div>
                </div>
              </div>

              {(product.urgency_badge || product.hero_cta) && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {product.urgency_badge && (
                    <span className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: `${descriptionTitleColor}40`, backgroundColor: `${descriptionTitleColor}14`, color: descriptionContentColor }}>
                      {product.urgency_badge}
                    </span>
                  )}
                  {product.hero_cta && (
                    <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: descriptionTitleColor }}>
                      {product.hero_cta}
                    </span>
                  )}
                </div>
              )}

              {stats.length > 0 && (
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {stats.map((stat, index) => (
                    <div key={`${stat}-${index}`} className="rounded-[22px] px-3 py-3 text-center text-xs font-bold text-white shadow-[0_12px_24px_rgba(0,0,0,0.08)]" style={{ background: descriptionTitleColor }}>
                      {stat}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 rounded-[28px] border bg-[linear-gradient(180deg,#ffffff,#fbf6ef)] p-5 shadow-[0_16px_38px_rgba(88,64,38,0.08)]" style={{ borderColor: `${templateTheme.accent}20` }}>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-black" style={{ color: descriptionTitleColor }}>Prix</span>
                  <span className="text-sm font-semibold text-gray-500">Paiement à la livraison</span>
                </div>
                <button
                  type="button"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[20px] px-4 py-3.5 text-sm font-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.12)]"
                  style={{ background: descriptionTitleColor }}
                >
                  <ArrowRight className="h-4 w-4" />
                  {product.hero_cta || templateTheme.cta}
                </button>
              </div>

              {benefits.length > 0 && (
                <div className="mt-6 rounded-[28px] border p-5 shadow-sm" style={{ borderColor: `${templateTheme.accent}20`, backgroundColor: templateTheme.surface }}>
                  <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: descriptionTitleColor }}>Bénéfices</p>
                  <div className="mt-3 space-y-2.5">
                    {benefits.map((benefit, index) => (
                      <div key={`${benefit}-${index}`} className="flex items-start gap-3 rounded-[20px] px-3.5 py-3" style={{ backgroundColor: `${descriptionTitleColor}08` }}>
                        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: descriptionTitleColor }}>✓</span>
                        <span className="text-sm" style={{ color: `${descriptionContentColor}D9` }}>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

            <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            {conversionBlocks.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {conversionBlocks.map((block, index) => (
                  <div key={`${block.text}-${index}`} className="rounded-[24px] border bg-white px-4 py-4 shadow-[0_14px_32px_rgba(83,60,35,0.06)]" style={{ borderColor: `${templateTheme.accent}18` }}>
                    <div className="text-lg">{block.icon}</div>
                    <p className="mt-2 text-sm font-semibold" style={{ color: descriptionContentColor }}>{block.text}</p>
                  </div>
                ))}
              </div>
            )}

            {product.problem_section && (
              <section className="rounded-[28px] border p-5 shadow-sm" style={{ borderColor: `${templateTheme.accent}20`, backgroundColor: `${templateTheme.primary}08` }}>
                <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: descriptionTitleColor }}>Problème</p>
                {product.problem_section.title && <h3 className="mt-2 text-xl font-black" style={{ color: descriptionTitleColor }}>{product.problem_section.title}</h3>}
                <div className="mt-3 space-y-2.5">
                  {(product.problem_section.pain_points || []).map((point, index) => (
                    <div key={`${point}-${index}`} className="flex items-start gap-3 text-sm" style={{ color: `${descriptionContentColor}D0` }}>
                      <span style={{ color: descriptionTitleColor }}>•</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {product.solution_section && (
              <section className="rounded-[28px] border bg-white p-5 shadow-sm" style={{ borderColor: `${templateTheme.accent}20` }}>
                <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: descriptionTitleColor }}>Solution</p>
                {product.solution_section.title && <h3 className="mt-2 text-xl font-black" style={{ color: descriptionTitleColor }}>{product.solution_section.title}</h3>}
                {product.solution_section.description && <p className="mt-3 text-sm leading-7" style={{ color: `${descriptionContentColor}C9` }}>{product.solution_section.description}</p>}
              </section>
            )}

            {testimonials.length > 0 && (
              <section className="rounded-[28px] border bg-white p-4 shadow-sm sm:p-5" style={{ borderColor: `${templateTheme.accent}20` }}>
                <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: descriptionTitleColor }}>Avis clients</p>
                <div className="mt-3">
                  <TestimonialsCarousel
                    testimonials={testimonials.map((t) => ({
                      name: t.name,
                      location: t.location,
                      text: t.text,
                      rating: t.rating || 5,
                      verified: t.verified !== false,
                      date: t.date,
                    }))}
                    autoPlay={false}
                  />
                </div>
              </section>
            )}

            {faq.length > 0 && (
              <section className="rounded-[28px] border bg-white p-5 shadow-sm" style={{ borderColor: `${templateTheme.accent}20` }}>
                <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: descriptionTitleColor }}>Questions fréquentes</p>
                <div className="mt-3 space-y-3">
                  {faq.map((item, index) => (
                    <div key={`${item.question}-${index}`} className="rounded-[18px] border px-4 py-3" style={{ borderColor: `${templateTheme.accent}20`, backgroundColor: `${descriptionTitleColor}05` }}>
                      <p className="text-sm font-bold" style={{ color: descriptionTitleColor }}>{item.question}</p>
                      <p className="mt-1 text-sm leading-6" style={{ color: `${descriptionContentColor}C9` }}>{item.reponse}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="border-t px-4 py-4 text-center text-xs text-gray-500 sm:px-6" style={{ borderColor: `${templateTheme.accent}24` }}>
            Aperçu storefront généré avec la direction visuelle {selectedTemplate.label.toLowerCase()}.
          </div>
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

const ProductPageGeneratorModal = ({ onClose, onApply, pageMode = false }) => {
  const [phase, setPhase] = useState('input');
  const [step, setStep] = useState(1); // 1: Base info, 2: Copywriting, 3: Advanced (optional)
  const [productSubstep, setProductSubstep] = useState(1);
  const [inputMode, setInputMode] = useState('url'); // 'url' ou 'description'
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [visualTemplate, setVisualTemplate] = useState('beauty');
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
  const [selectedPack, setSelectedPack] = useState(null); // 'unit' | 'pack3'
  const [pricing, setPricing] = useState({ unit: 500, pack3: 1000 });
  
  // États copywriting simplifiés
  const [tone, setTone] = useState('urgence');
  const [targetGender, setTargetGender] = useState('auto');
  const [targetAgeRange, setTargetAgeRange] = useState('auto');
  const [targetProfile, setTargetProfile] = useState('auto');
  const [mainProblem, setMainProblem] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageGenerationMode, setImageGenerationMode] = useState('ad_4_5');
  
  // AI Store Builder states
  const [buildStep, setBuildStep] = useState(0); // 0-4
  const [buildProgress, setBuildProgress] = useState(0); // 0-100
  const [buildMessage, setBuildMessage] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [imageJobId, setImageJobId] = useState(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const readerRef = useRef(null);
  const isGeneratingRef = useRef(false);

  const isValidUrl = url.trim().length > 10 && (url.startsWith('http://') || url.startsWith('https://'));
  const hasValidDescription = description.trim().length > 20;
  const hasRequiredPhotos = photos.length > 0;
  const totalProductSubsteps = PRODUCT_SUBSTEPS.length;
  const selectedTemplate = VISUAL_TEMPLATES.find((template) => template.id === visualTemplate) || VISUAL_TEMPLATES[0];
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
    setTemplateTheme(nextTheme);
    setHeroVisualDirection(nextTheme.heroVisual || '');
    setDecorationDirection(nextTheme.decorationVisual || '');
  }, [visualTemplate]);

  // Poll for background image generation
  useEffect(() => {
    if (!imageJobId || phase !== 'preview') return;
    setImagesLoading(true);
    let cancelled = false;
    const token = localStorage.getItem('ecomToken');
    const wsId = localStorage.getItem('workspaceId');

    const poll = async () => {
      try {
        const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/images/${imageJobId}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(wsId ? { 'X-Workspace-Id': wsId } : {})
          }
        });
        if (!resp.ok || cancelled) return;
        const data = await resp.json();
        if (cancelled) return;

        if (data.status === 'done' || data.status === 'error') {
          // Merge images into product
          setProduct(prev => {
            if (!prev) return prev;
            const imgs = data.images || {};
            const newAngles = prev.angles?.map((a, i) => {
              const bgAngle = imgs.angles?.find(ba => ba.index === i + 1);
              return bgAngle ? { ...a, poster_url: bgAngle.poster_url } : a;
            }) || [];
            const peoplePhotos = Array.isArray(imgs.peoplePhotos) ? imgs.peoplePhotos : (prev.peoplePhotos || []);
            const beforeAfterImages = Array.isArray(imgs.beforeAfterImages) ? imgs.beforeAfterImages : (prev.beforeAfterImages || []);
            const socialProofImages = Array.isArray(imgs.socialProofImages)
              ? imgs.socialProofImages
              : [...peoplePhotos, ...beforeAfterImages].filter((value, index, array) => value && array.indexOf(value) === index);
            const descriptionGifs = Array.isArray(imgs.descriptionGifs) ? imgs.descriptionGifs : (prev.descriptionGifs || []);
            const allImages = [
              ...peoplePhotos,
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
          return; // Stop polling
        }

        // Still generating — poll again in 4s
        if (!cancelled) setTimeout(poll, 4000);
      } catch {
        if (!cancelled) setTimeout(poll, 6000);
      }
    };

    // Start first poll after 5s (images take time)
    const timer = setTimeout(poll, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [imageJobId, phase]);

  // Fetch credit info on mount
  useEffect(() => {
    const token = localStorage.getItem('ecomToken');
    const wsId = localStorage.getItem('workspaceId');
    if (!token || !wsId) return;
    fetch(`${API_ORIGIN}/api/ai/product-generator/info`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(wsId ? { 'X-Workspace-Id': wsId } : {})
      }
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.generations) {
          setGenerationsInfo(data.generations);
        }
      })
      .catch(() => {});
  }, []);

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
    
    setPhase('loading');
    setStepLabel('Génération en cours...');
    setError('');
    setProduct(null);
    setBuildStep(0);
    setBuildProgress(0);
    setBuildMessage('');
    setShowConfetti(false);
    isGeneratingRef.current = true;

    const token = localStorage.getItem('ecomToken');
    const wsId = localStorage.getItem('workspaceId');

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
    
    formData.append('withImages', 'true');
    formData.append('imageGenerationMode', imageGenerationMode);
    formData.append('imageAspectRatio', imageGenerationMode === 'ad_4_5' ? '4:5' : '1:1');
    formData.append('marketingApproach', marketingApproach);
    formData.append('visualTemplate', visualTemplate);
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
    const safetyTimer = setTimeout(() => {
      controller.abort();
      setError('Timeout: La génération a pris trop de temps (25 minutes max)');
      setPhase('input');
    }, 1500000);

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
          
          // Gérer le cas de limite atteinte
          if (errorData.limitReached) {
            setLimitReached(true);
            setGenerationsInfo({
              freeRemaining: 0,
              paidRemaining: 0,
              totalUsed: errorData.totalGenerations || 0
            });
            if (errorData.pricing) setPricing(errorData.pricing);
            setSelectedPack('unit');
            setError(errorData.message || 'Limite de générations atteinte');
            setPhase('input');
            clearTimeout(safetyTimer);
            abortRef.current = null;
            isGeneratingRef.current = false;
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

        // Store product in state but DON'T switch to preview yet
        setProduct(result.product);

        // If there's an image job, wait for all images before showing preview
        if (result.imageJobId) {
          setBuildProgress(70);
          setBuildMessage('Génération des images en cours...');

          // Poll until all images are done
          const pollImages = () => new Promise((resolve) => {
            const doPoll = async () => {
              try {
                const imgResp = await fetch(`${API_ORIGIN}/api/ai/product-generator/images/${result.imageJobId}`, {
                  headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(wsId ? { 'X-Workspace-Id': wsId } : {})
                  }
                });
                if (!imgResp.ok) { setTimeout(doPoll, 4000); return; }
                const imgData = await imgResp.json();

                // Update progress based on images received
                const totalExpected = 7;
                const done = (imgData.progress || 0);
                const pct = Math.min(95, 70 + Math.round((done / totalExpected) * 25));
                setBuildProgress(pct);
                const msgs = [
                  'Création de l\'image principale...',
                  'Génération des visuels marketing...',
                  'Design des posters produit...',
                  'Retouches et optimisation...',
                  'Assemblage des visuels...',
                  'Finalisation des images...',
                  'Dernières retouches...'
                ];
                setBuildMessage(msgs[Math.min(done, msgs.length - 1)] || 'Génération des images...');

                if (imgData.status === 'done' || imgData.status === 'error') {
                  resolve(imgData);
                  return;
                }
                setTimeout(doPoll, 4000);
              } catch {
                setTimeout(doPoll, 6000);
              }
            };
            // First poll after 5s
            setTimeout(doPoll, 5000);
          });

          const imgResult = await pollImages();

          // Merge images into product
          const imgs = imgResult.images || {};
          setProduct(prev => {
            if (!prev) return prev;
            const newAngles = prev.angles?.map((a, i) => {
              const bgAngle = imgs.angles?.find(ba => ba.index === i + 1);
              return bgAngle ? { ...a, poster_url: bgAngle.poster_url } : a;
            }) || [];
            const peoplePhotos = Array.isArray(imgs.peoplePhotos) ? imgs.peoplePhotos : (prev.peoplePhotos || []);
            const beforeAfterImages = Array.isArray(imgs.beforeAfterImages) ? imgs.beforeAfterImages : (prev.beforeAfterImages || []);
            const socialProofImages = Array.isArray(imgs.socialProofImages)
              ? imgs.socialProofImages
              : [...peoplePhotos, ...beforeAfterImages].filter((value, index, array) => value && array.indexOf(value) === index);
            const descriptionGifs = Array.isArray(imgs.descriptionGifs) ? imgs.descriptionGifs : (prev.descriptionGifs || []);
            const allImages = [
              ...peoplePhotos,
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
        }

        // NOW show confetti and switch to preview (all images are ready)
        setBuildProgress(100);
        setBuildMessage('Votre page est prête.');
        setShowConfetti(true);

        setTimeout(() => {
          setShowConfetti(false);
          setPhase('preview');
          setActiveTab('page');
        }, 2000);
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
        errorMessage = `Erreur OpenAI: ${error.message}`;
      } else if (error.message.includes('NanoBanana')) {
        errorMessage = `Erreur NanoBanana: ${error.message}`;
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
      clearTimeout(safetyTimer);
      abortRef.current = null;
      isGeneratingRef.current = false;
    }
  };

  const handleBuyGeneration = async () => {
    if (!paymentPhone || paymentPhone.trim().length < 8) {
      alert('Veuillez saisir un numéro de téléphone valide');
      return;
    }
    if (!paymentName || paymentName.trim().length < 2) {
      alert('Veuillez saisir votre nom');
      return;
    }

    setPaymentLoading(true);
    
    try {
      const token = localStorage.getItem('ecomToken');
      const wsId = localStorage.getItem('workspaceId');

      const response = await fetch(`${API_ORIGIN}/api/ecom/billing/buy-generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(wsId ? { 'X-Workspace-Id': wsId } : {})
        },
        body: JSON.stringify({
          quantity: selectedPack === 'pack3' ? 3 : 1,
          phone: paymentPhone.trim(),
          clientName: paymentName.trim(),
          workspaceId: wsId
        })
      });

      const result = await response.json();

      if (result.success && result.paymentUrl) {
        // Ouvrir la page de paiement MoneyFusion
        window.open(result.paymentUrl, '_blank');
        
        // Fermer le modal et rafraîchir ou afficher un message
        alert('✅ Paiement initié ! Une fois le paiement confirmé, tes générations seront créditées automatiquement.');
        
        // Reset le formulaire
        setShowPaymentForm(false);
        setPaymentPhone('');
        setPaymentName('');
        setLimitReached(false);
        setError('');
      } else {
        throw new Error(result.message || 'Erreur lors de l\'initialisation du paiement');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('❌ Erreur: ' + error.message);
    } finally {
      setPaymentLoading(false);
    }
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
    if (product.angles?.length) {
      descHtml += `<div style="margin:32px 0;color:${themeTextToken};">`;
      product.angles.slice(0, 5).forEach((angle, idx) => {
        descHtml += `<div style="margin-bottom:40px;padding-bottom:40px;${idx < product.angles.length - 1 ? `border-bottom:1px solid ${themeBorderToken};` : ''}">`;
        // H3 bold title
        descHtml += `<h3 style="font-size:20px;font-weight:800;color:${themePrimaryToken};margin:0 0 12px;line-height:1.3;"><strong>${angle.titre_angle}</strong></h3>`;
        // 3-4 line description
        const explication = angle.explication || angle.message_principal || '';
        if (explication) {
          descHtml += `<p style="font-size:15px;line-height:1.75;color:${themeMutedToken};margin:0 0 16px;">${explication}</p>`;
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

    const pushUniqueImage = (target, url, alt, type) => {
      if (!url || target.find((image) => image.url === url)) return;
      target.push({ url, alt, order: target.length, type });
    };

    // Social proof images only for the dedicated carousel.
    if (product.peoplePhotos?.length) {
      product.peoplePhotos.forEach((imgUrl, i) => {
        pushUniqueImage(socialProofImages, imgUrl, `${product.title || 'Produit'} — client ${i + 1}`, 'social-proof-lifestyle');
      });
    }

    // Hero visuals only: keep the generated hero simple and editable.
    if (product.heroImage) {
      pushUniqueImage(productImages, product.heroImage, product.title || 'Image Hero principale', 'hero');
    }
    if (product.heroPosterImage) {
      pushUniqueImage(productImages, product.heroPosterImage, `Affiche — ${product.title || 'Produit'}`, 'hero-poster');
    }

    // Social proof before/after visuals go only to the social proof carousel.
    if (product.beforeAfterImages?.length) {
      product.beforeAfterImages.forEach((imgUrl, i) => {
        pushUniqueImage(socialProofImages, imgUrl, `Avant / Après ${i + 1} — Résultats visibles`, 'social-proof-before-after');
      });
    } else if (product.beforeAfterImage) {
      pushUniqueImage(socialProofImages, product.beforeAfterImage, 'Avant / Après - Résultats visibles', 'social-proof-before-after');
    }
    
    const finalSocialProofImages = (product.socialProofImages || []).length
      ? (product.socialProofImages || []).reduce((acc, url, index) => {
          pushUniqueImage(acc, url, `${product.title || 'Produit'} — preuve sociale ${index + 1}`, 'social-proof');
          return acc;
        }, [])
      : socialProofImages;
    
    onApply({
      name: product.title || '',
      description: descHtml,
      images: productImages,
      currency: product.currency || '',
      targetMarket: product.targetMarket || product.country || '',
      country: product.country || '',
      city: product.city || '',
      locale: product.locale || '',
      _pageData: {
        ...product,
        socialProofImages: finalSocialProofImages.map((image) => image.url),
        descriptionGifs: descriptionGifs.map((gif) => gif.url),
        heroVisualDirection: heroVisualDirection.trim(),
        decorationDirection: decorationDirection.trim(),
      }
    });
  };

  const handleRestart = () => {
    setPhase('input');
    setStep(1);
    setProductSubstep(1);
    setProduct(null);
    setError('');
    setLimitReached(false);
    setActiveTab('page');
    setBuildStep(0);
    setBuildProgress(0);
    setBuildMessage('');
    setShowConfetti(false);
  };

  return (
    <div className={pageMode ? 'relative min-h-screen overflow-hidden bg-[#f4efe7]' : 'fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-black/50 backdrop-blur-sm'}>
      {pageMode && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,107,79,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(212,128,63,0.18),transparent_28%),linear-gradient(180deg,#f7f2eb_0%,#efe5d7_48%,#f4efe7_100%)]" />
          <div className="pointer-events-none absolute left-[-120px] top-24 h-72 w-72 rounded-full bg-[#0F6B4F]/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-[-120px] h-80 w-80 rounded-full bg-[#D4803F]/10 blur-3xl" />
        </>
      )}
      <div className={pageMode ? 'relative z-10 mx-auto grid min-h-screen w-full max-w-[1480px] gap-6 px-4 py-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:px-8' : 'flex h-full w-full items-stretch justify-stretch'}>
        {pageMode && (
          <aside className="hidden lg:flex lg:flex-col lg:gap-5">
            <div className="overflow-hidden rounded-[32px] border border-white/60 bg-[#0E2B24] text-white shadow-[0_24px_80px_rgba(12,38,31,0.24)]">
              <div className="border-b border-white/10 px-6 py-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Product Studio
                </div>
                <h1 className="mt-4 text-[28px] font-black leading-[1.05] tracking-[-0.03em]">Crée une page produit qui vend avant même la première pub.</h1>
                <p className="mt-3 text-sm leading-6 text-white/74">
                  Structure, visuels, angles marketing et preuve sociale dans un seul flux, pensé pour des creatives e-commerce africaines plus fortes.
                </p>
              </div>

              <div className="space-y-4 px-6 py-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Template</p>
                    <p className="mt-2 text-sm font-bold text-white">{selectedTemplate.label}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Méthode</p>
                    <p className="mt-2 text-sm font-bold text-white">{marketingApproach}</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Ce que tu génères</p>
                  <div className="mt-4 space-y-3">
                    {[
                      'Hero orienté conversion avec produit fidèle',
                      'Affiches bénéfices et preuve sociale',
                      'Description enrichie avec GIFs et visuels dynamiques',
                      'FAQ, avis, angles marketing et structure finale',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm text-white/82">
                        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/12 text-[11px] font-bold text-white">+</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#D0A27B]/30 bg-[#E8C8AA]/10 p-4 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Ciblage</p>
                  <p className="mt-2 text-sm font-bold text-white">{targetAvatarSummary || 'Auto selon le produit'}</p>
                  <p className="mt-2 text-xs leading-5 text-white/68">L’IA adapte automatiquement le casting, l’âge apparent et la mise en scène au produit et à tes choix.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_18px_60px_rgba(73,52,31,0.08)] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A6855]">Direction visuelle</p>
                  <p className="mt-1 text-sm font-bold text-[#1F1A17]">{templateTheme.hero}</p>
                </div>
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: templateTheme.primary }} />
                  <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: templateTheme.accent }} />
                  <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: templateTheme.text }} />
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#6D5D4E]">{templateTheme.subline}</p>
            </div>
          </aside>
        )}
        <div className={pageMode ? 'relative flex min-h-[calc(100vh-3rem)] w-full flex-col overflow-hidden rounded-[36px] border border-white/70 bg-[rgba(255,251,246,0.84)] shadow-[0_30px_90px_rgba(100,74,47,0.14)] backdrop-blur-xl' : 'relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl'}>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={pageMode ? 'absolute right-6 top-6 z-20 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-white text-slate-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-slate-900 sm:right-8' : 'absolute right-6 top-6 z-20 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700'}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex min-h-0 flex-1 flex-col">

          {/* Header */}
          {pageMode ? (
            <div className="relative overflow-hidden border-b border-[#e4d8ca] px-5 py-5 sm:px-6 lg:px-8">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,248,241,0.65)_45%,rgba(242,231,218,0.65)_100%)]" />
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#0F6B4F]/8 blur-3xl" />
              <div className="absolute bottom-0 left-12 h-24 w-24 rounded-full bg-[#D4803F]/10 blur-2xl" />
              <div className="relative">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-2 rounded-full border border-[#d9ccbf] bg-white/86 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b4a3c] transition hover:bg-white"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Retour catalogue
                      </button>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#0F6B4F] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
                        <Sparkles className="h-3.5 w-3.5" />
                        Generator Studio
                      </span>
                    </div>

                    <h2 className="mt-4 max-w-2xl text-[32px] font-black leading-[1.02] tracking-[-0.04em] text-[#1c1713] sm:text-[42px]">
                      Génère une page produit, ses visuels et ses angles de vente dans un seul workflow.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6a5a4b] sm:text-[15px]">
                      Source produit, photos réelles, méthode copywriting, ciblage et rendu final boutique. Tout est centralisé ici dans une interface pensée comme un vrai studio créatif.
                    </p>

                    {phase === 'input' && (
                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        {visibleSteps.map((s) => (
                          <div key={s.num} className={`rounded-[24px] border p-4 transition ${
                            step === s.num
                              ? 'border-[#0F6B4F]/30 bg-[#0F6B4F] text-white shadow-[0_18px_50px_rgba(15,107,79,0.18)]'
                              : step > s.num
                              ? 'border-[#96C7B5] bg-[#E6F2ED] text-[#0A5740]'
                              : 'border-[#e4d8ca] bg-white/82 text-[#8a7767]'
                          }`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                                  step === s.num
                                    ? 'bg-white text-[#0F6B4F]'
                                    : step > s.num
                                    ? 'bg-[#0F6B4F] text-white'
                                    : 'bg-[#efe3d5] text-[#7e6c5d]'
                                }`}>
                                  {step > s.num ? '✓' : s.num}
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-75">Étape</p>
                                  <p className="text-sm font-bold">{s.label}</p>
                                </div>
                              </div>
                              <span className="rounded-full border border-current/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">{s.progress}</span>
                            </div>
                            <p className="mt-3 text-xs leading-5 opacity-80">{s.details.join(' • ')}</p>
                            {step === s.num && <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] opacity-90">Maintenant: {s.currentDetail}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:w-[360px] xl:grid-cols-1">
                    <div className="rounded-[24px] border border-white/80 bg-white/78 p-4 shadow-[0_12px_35px_rgba(80,60,35,0.08)] backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b7762]">Template actif</p>
                      <p className="mt-2 text-base font-black text-[#1f1915]">{selectedTemplate.label}</p>
                      <p className="mt-2 text-xs leading-5 text-[#6b5a4b]">{templateTheme.vibe}</p>
                    </div>
                    <div className="rounded-[24px] border border-white/80 bg-white/78 p-4 shadow-[0_12px_35px_rgba(80,60,35,0.08)] backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b7762]">Méthode</p>
                      <p className="mt-2 text-base font-black text-[#1f1915]">{marketingApproach}</p>
                      <p className="mt-2 text-xs leading-5 text-[#6b5a4b]">Le texte et les visuels suivent la logique choisie du début à la fin.</p>
                    </div>
                    <div className="rounded-[24px] border border-[#b9dccf] bg-[#E6F2ED] p-4 shadow-[0_12px_35px_rgba(15,107,79,0.10)]">
                      <div className="flex items-center gap-2 text-[#0A5740]">
                        <Zap className="h-4.5 w-4.5" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Crédits</p>
                      </div>
                      <p className="mt-2 text-2xl font-black text-[#0A5740]">{generationsInfo?.remaining || 0}</p>
                      <p className="mt-1 text-xs text-[#2e6f59]">crédit{(generationsInfo?.remaining || 0) > 1 ? 's' : ''} disponible{(generationsInfo?.remaining || 0) > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
              </div>
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

        <div className={pageMode ? 'flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.36))]' : 'flex-1 overflow-y-auto'}>

          {/* ─── INPUT PHASE ─── */}
          {phase === 'input' && (
            <div className="p-6 space-y-5">

              {/* ÉTAPE 1: Informations produit */}
              {step === 1 && (
                <>
                  {/* Template de page produit */}
                  {productSubstep === 1 && (
                  <div className="rounded-[30px] border border-[#e3d7ca] bg-[linear-gradient(180deg,rgba(255,255,255,0.90),rgba(249,242,234,0.88))] p-5 shadow-[0_16px_40px_rgba(86,63,39,0.08)] sm:p-6">
                    <label className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Layers className="h-4 w-4 text-slate-700" />
                      Template visuel
                    </label>
                    <p className="text-xs text-gray-500 mb-3">Choisis le type de produit — chaque template a son propre style d'images et de mise en page</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {VISUAL_TEMPLATES.map(t => {
                        const previewTheme = buildTemplateTheme(t.id);
                        return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setVisualTemplate(t.id)}
                          className={`w-[160px] min-w-[160px] flex-shrink-0 overflow-hidden rounded-[20px] border text-left transition-all duration-200 ${
                            visualTemplate === t.id
                              ? `${t.border} shadow-[0_16px_38px_rgba(70,55,38,0.14)] scale-[1.02]`
                              : 'border-[#e4d8ca] bg-white/85 hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <div
                            className="relative aspect-[6/4] overflow-hidden"
                            style={{
                              background: `linear-gradient(160deg, ${previewTheme.primary} 0%, ${previewTheme.accent} 58%, ${previewTheme.background} 100%)`,
                            }}
                          >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.22),transparent_28%)]" />
                            <div className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white backdrop-blur-sm">
                              <t.icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="absolute inset-x-2.5 bottom-2.5 rounded-[14px] border border-white/20 bg-black/20 p-2 text-white backdrop-blur-md">
                              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70">Template</p>
                              <p className="mt-0.5 text-[11px] font-bold leading-tight">{t.label}</p>
                            </div>
                            <div className="absolute -right-4 top-10 h-16 w-16 rounded-full border border-white/15 bg-white/10" />
                            <div className="absolute bottom-12 left-3 h-10 w-10 rounded-[12px] border border-white/15 bg-white/10 rotate-12" />
                          </div>
                        </button>
                      )})}
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                      <div
                        className="overflow-hidden rounded-[24px] border shadow-[0_16px_36px_rgba(79,60,38,0.08)]"
                        style={{
                          backgroundColor: '#ffffff',
                          borderColor: templateTheme.accent,
                        }}
                      >
                        <div
                          className="p-3.5"
                          style={{
                            background: `linear-gradient(135deg, ${templateTheme.primary} 0%, ${templateTheme.accent} 100%)`,
                            color: '#ffffff',
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">Aperçu</p>
                              <h3 className="mt-1 text-sm font-black leading-snug">{templateTheme.hero}</h3>
                              <p className="mt-1 line-clamp-2 text-[11px] text-white/80">{templateTheme.subline}</p>
                            </div>
                            <span className="rounded-full border border-white/25 px-2 py-1 text-[10px] font-semibold text-white/85">
                              {selectedTemplate.label}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3 p-3.5" style={{ color: templateTheme.text }}>
                          <div className="rounded-[16px] border p-3" style={{ backgroundColor: templateTheme.surface, borderColor: `${templateTheme.accent}55` }}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-bold">Bloc hero</p>
                                <p className="mt-0.5 text-[11px] opacity-70">Titre, bénéfice et CTA</p>
                              </div>
                              <div className="flex gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: templateTheme.primary }} />
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: templateTheme.accent }} />
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              <div className="h-2 w-20 rounded-full opacity-80" style={{ backgroundColor: `${templateTheme.primary}33` }} />
                              <div className="h-3 w-full rounded-full opacity-90" style={{ backgroundColor: `${templateTheme.text}20` }} />
                              <button
                                type="button"
                                className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                                style={{ backgroundColor: templateTheme.primary }}
                              >
                                {templateTheme.cta}
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 text-[10px] font-medium opacity-85">
                            <span className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${templateTheme.primary}10` }}>Bénéfices</span>
                            <span className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${templateTheme.accent}30` }}>Visuels</span>
                            <span className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${templateTheme.text}10` }}>FAQ</span>
                          </div>
                        </div>
                      </div>

                        <div className="rounded-[24px] border border-[#e4d8ca] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(249,242,234,0.9))] p-4 shadow-[0_16px_36px_rgba(79,60,38,0.07)]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-gray-900">Direction visuelle</p>
                          <button
                            type="button"
                            onClick={() => {
                              const nextTheme = buildTemplateTheme(visualTemplate);
                              setTemplateTheme(nextTheme);
                              setHeroVisualDirection(nextTheme.heroVisual || '');
                              setDecorationDirection(nextTheme.decorationVisual || '');
                            }}
                              className="rounded-xl border border-[#dbcfc2] bg-white/80 px-3 py-1.5 text-[11px] font-medium text-gray-700 transition hover:bg-white"
                          >
                            Réinitialiser
                          </button>
                        </div>

                        <div className="mt-3 space-y-3">
                            <label className="block rounded-[18px] border border-[#e6dbd0] bg-white/78 px-3 py-3 shadow-sm">
                            <span className="block text-[11px] font-semibold text-gray-800">Visuel hero</span>
                            <input
                              type="text"
                              value={heroVisualDirection}
                              onChange={(event) => setHeroVisualDirection(event.target.value)}
                              placeholder="Ex: portrait premium, produit en gros plan, lumière chaude"
                              className="mt-2 w-full border-0 bg-transparent p-0 text-xs text-gray-900 outline-none placeholder:text-gray-400"
                            />
                          </label>

                            <label className="block rounded-[18px] border border-[#e6dbd0] bg-white/78 px-3 py-3 shadow-sm">
                            <span className="block text-[11px] font-semibold text-gray-800">Visuel décorations</span>
                            <input
                              type="text"
                              value={decorationDirection}
                              onChange={(event) => setDecorationDirection(event.target.value)}
                              placeholder="Ex: halos doux, lignes tech, cadres mode, textures maison"
                              className="mt-2 w-full border-0 bg-transparent p-0 text-xs text-gray-900 outline-none placeholder:text-gray-400"
                            />
                          </label>

                          <div className="grid grid-cols-2 gap-2">
                            {[
                              ['primary', 'Titres description'],
                              ['text', 'Contenu description'],
                            ].map(([key, label]) => (
                              <label key={key} className="rounded-[18px] border border-[#e6dbd0] bg-white/78 p-2.5 text-center shadow-sm">
                                <input
                                  type="color"
                                  value={templateTheme[key]}
                                  onChange={(event) => handleThemeChange(key, event.target.value)}
                                  className="mx-auto h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                                />
                                <span className="mt-1 block text-[10px] font-medium text-gray-700">{label}</span>
                              </label>
                            ))}
                          </div>

                          <div className="rounded-[18px] border border-[#e6dbd0] bg-white/72 px-3 py-3 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Résumé</p>
                            <p className="mt-1 text-xs font-semibold text-gray-900">{selectedTemplate.label}</p>
                            <p className="mt-1 text-[11px] text-gray-600">Titres description : {templateTheme.primary}</p>
                            <p className="mt-1 text-[11px] text-gray-600">Contenu description : {templateTheme.text}</p>
                            {heroVisualDirection.trim() && <p className="mt-1 text-[11px] text-gray-600">Hero : {heroVisualDirection.trim()}</p>}
                            {decorationDirection.trim() && <p className="mt-1 text-[11px] text-gray-600">Décors : {decorationDirection.trim()}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Source + contenu source */}
                  {productSubstep === 2 && (
                  <div className="space-y-4 rounded-[30px] border border-[#e3d7ca] bg-[linear-gradient(180deg,rgba(255,255,255,0.90),rgba(249,242,234,0.88))] p-5 shadow-[0_16px_40px_rgba(86,63,39,0.08)] sm:p-6">
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Globe className="h-4 w-4 text-slate-700" />
                        Source du produit
                      </label>
                      <div className="flex gap-2 rounded-[18px] border border-[#e4d8ca] bg-white/82 p-1.5 shadow-sm">
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
                      <div className="rounded-[22px] border border-[#e4d8ca] bg-white/84 p-4 shadow-sm">
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
                      <div className="rounded-[22px] border border-[#e4d8ca] bg-white/84 p-4 shadow-sm">
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
                  <div className="rounded-[30px] border border-[#e3d7ca] bg-[linear-gradient(180deg,rgba(255,255,255,0.90),rgba(249,242,234,0.88))] p-5 shadow-[0_16px_40px_rgba(86,63,39,0.08)] sm:p-6">
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
                        dragOver ? 'border-[#0F6B4F] bg-[#E6F2ED]' : 'border-gray-200 hover:border-[#96C7B5] hover:bg-[#E6F2ED]/60'
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
                          <div key={i} className="relative group aspect-square rounded-[18px] overflow-hidden bg-gray-100 border border-[#dfd4c8] shadow-sm">
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
              {step === 2 && (
                <>
                  {/* 3 Méthodes Copywriting */}
                  <div className="rounded-[30px] border border-[#e3d7ca] bg-[linear-gradient(180deg,rgba(255,255,255,0.90),rgba(249,242,234,0.88))] p-5 shadow-[0_16px_40px_rgba(86,63,39,0.08)] sm:p-6">
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
                              : 'border-[#e4d8ca] hover:border-[#96C7B5] bg-white/84'
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
              {step === 3 && (
                <>
                  {/* Header */}
                  <div className="text-center space-y-2 mb-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-stone-200 bg-stone-50">
                      <Star className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-bold text-slate-800">Optionnel</span>
                    </div>
                    <p className="text-xs text-gray-500">Ces infos aident l'IA a mieux cibler ta page produit</p>
                  </div>

                  <div className="space-y-3 rounded-[28px] border border-[#e3d7ca] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(249,242,234,0.9))] p-5 mb-4 shadow-[0_16px_40px_rgba(86,63,39,0.07)]">
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
                            className={`rounded-[20px] border p-4 text-left transition ${isActive ? 'border-[#96C7B5] bg-[#E6F2ED] shadow-sm' : 'border-[#e4d8ca] bg-white/82 hover:border-[#D8CFC4] hover:bg-white'}`}
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
                  <div className="space-y-4 rounded-[28px] border border-[#e3d7ca] bg-[linear-gradient(180deg,rgba(255,251,246,0.92),rgba(242,234,225,0.76))] p-5 shadow-[0_16px_40px_rgba(86,63,39,0.07)]">
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
                              className={`rounded-[20px] border px-3 py-3 text-left transition ${isActive ? 'border-[#96C7B5] bg-[#E6F2ED] shadow-sm' : 'border-[#e4d8ca] bg-white/86 hover:border-[#D8CFC4]'}`}
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
                          className="w-full rounded-[16px] border border-[#ddd1c5] bg-white px-3 py-2.5 text-sm focus:border-[#96C7B5] focus:outline-none focus:ring-2 focus:ring-scalor-green"
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
                          className="w-full rounded-[16px] border border-[#ddd1c5] bg-white px-3 py-2.5 text-sm focus:border-[#96C7B5] focus:outline-none focus:ring-2 focus:ring-scalor-green"
                        >
                          {TARGET_PROFILE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-dashed border-[#96C7B5] bg-white px-3 py-3 shadow-sm">
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
                        className="w-full px-3 py-2.5 border border-[#ddd1c5] rounded-[16px] text-sm focus:outline-none focus:ring-2 focus:ring-scalor-green focus:border-[#96C7B5] resize-none bg-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">Quel probleme ton produit resout ?</p>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className={`p-4 rounded-xl border ${
                  limitReached 
                    ? 'bg-[#EDE8E2] border-[#D8CFC4]' 
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
                      <button type="button" onClick={() => setShowPaymentForm(true)}
                        className="px-4 py-2 bg-scalor-copper text-white font-bold rounded-xl hover:bg-scalor-copper-dark transition text-sm shadow-lg whitespace-nowrap">
                        Acheter des crédits
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-700 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                  )}
                </div>
              )}

              {/* ─── MODAL ACHAT CRÉDITS ─── */}
              {showPaymentForm && limitReached && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowPaymentForm(false); }}>
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                  <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="px-6 py-4 bg-scalor-copper text-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold">Acheter des crédits</h3>
                            <p className="text-xs text-white/80">1 crédit = 1 page produit IA complète</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setShowPaymentForm(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      {/* Pack selection */}
                      <div className="grid gap-3">
                        <button type="button" onClick={() => setSelectedPack('unit')}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${selectedPack === 'unit' ? 'border-[#D4803F] bg-[#EDE8E2] shadow-md' : 'border-gray-200 bg-white hover:border-[#D8CFC4]'}`}>
                          <div className="w-11 h-11 rounded-full bg-[#EDE8E2] flex items-center justify-center shrink-0">
                            <Zap className="w-5 h-5 text-scalor-copper" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">1 crédit</p>
                            <p className="text-xs text-gray-500">1 page produit complète avec visuels IA</p>
                          </div>
                          <span className="text-base font-extrabold text-scalor-copper">{pricing.unit} FCFA</span>
                        </button>
                        <button type="button" onClick={() => setSelectedPack('pack3')}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all relative ${selectedPack === 'pack3' ? 'border-[#96C7B5] bg-[#E6F2ED] shadow-md' : 'border-gray-200 bg-white hover:border-[#96C7B5]'}`}>
                          <span className="absolute -top-2.5 right-4 text-[10px] font-bold bg-scalor-green text-white px-2.5 py-0.5 rounded-full shadow">MEILLEURE OFFRE</span>
                          <div className="w-11 h-11 rounded-full bg-[#E6F2ED] flex items-center justify-center shrink-0">
                            <Zap className="w-5 h-5 text-scalor-green" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">Pack 3 crédits</p>
                            <p className="text-xs text-gray-500">Économise {pricing.unit * 3 - pricing.pack3} FCFA — soit {Math.round(pricing.pack3 / 3)} FCFA/page</p>
                          </div>
                          <span className="text-base font-extrabold text-scalor-green">{pricing.pack3} FCFA</span>
                        </button>
                      </div>

                      {/* Formulaire paiement */}
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-700"><Phone className="h-3.5 w-3.5 text-scalor-copper" />Numéro de téléphone</label>
                          <input type="tel" value={paymentPhone} onChange={(e) => setPaymentPhone(e.target.value)}
                            placeholder="Ex: 0707070707"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-scalor-copper focus:border-[#D4803F]" />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-700"><User className="h-3.5 w-3.5 text-scalor-copper" />Votre nom</label>
                          <input type="text" value={paymentName} onChange={(e) => setPaymentName(e.target.value)}
                            placeholder="Ex: Jean Dupont"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-scalor-copper focus:border-[#D4803F]" />
                        </div>
                      </div>

                      {/* Bouton payer */}
                      <button type="button" onClick={handleBuyGeneration} disabled={paymentLoading || !selectedPack}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-scalor-copper text-white font-bold rounded-xl hover:bg-scalor-copper-dark transition text-sm disabled:opacity-50 shadow-lg">
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
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── AI STORE BUILDER PHASE ─── */}
          {phase === 'loading' && (
            <div className={pageMode ? 'relative min-h-[620px] overflow-hidden px-8 py-10' : 'p-8 flex flex-col items-center justify-center gap-8 min-h-[500px] relative overflow-hidden'}>
              {pageMode && (
                <div className="pointer-events-none absolute inset-0 px-6 py-8">
                  <div className="mx-auto h-full w-full max-w-4xl rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,241,232,0.92))] shadow-[0_24px_70px_rgba(92,66,39,0.10)]" />
                </div>
              )}
              {/* Confetti effect */}
              {showConfetti && (
                <div className="absolute inset-0 pointer-events-none z-50">
                  {[...Array(50)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `-20px`,
                        animation: `fall ${1 + Math.random() * 2}s linear forwards`,
                        animationDelay: `${Math.random() * 0.5}s`
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: ['#ec4899', '#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'][Math.floor(Math.random() * 6)],
                          transform: `rotate(${Math.random() * 360}deg)`
                        }}
                      />
                    </div>
                  ))}
                  <style dangerouslySetInnerHTML={{
                    __html: `
                      @keyframes fall {
                        to {
                          transform: translateY(600px) rotate(720deg);
                          opacity: 0;
                        }
                      }
                    `
                  }} />
                </div>
              )}

              {/* Main icon animation */}
              <div className="relative z-10">
                <div className={pageMode ? 'relative flex h-28 w-28 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0F6B4F,#14855F)] shadow-[0_22px_60px_rgba(15,107,79,0.26)]' : 'w-24 h-24 rounded-full bg-[#E6F2ED] flex items-center justify-center relative'}>
                  <div className="absolute inset-0 rounded-full border-4 border-[#96C7B5] animate-ping opacity-20" />
                  <Sparkles className={pageMode ? 'h-14 w-14 text-white animate-pulse' : 'w-12 h-12 text-scalor-green animate-pulse'} />
                </div>
              </div>

              {/* Step title */}
              <div className="text-center space-y-2 relative z-10">
                <h3 className={pageMode ? 'text-3xl font-black tracking-[-0.03em] text-[#1c1713]' : 'text-2xl font-black text-gray-900'}>
                  {[
                    'Analyse de votre produit',
                    'Génération du contenu marketing',
                    'Design de la page',
                    'Finalisation'
                  ][Math.min(buildStep, 3)] || 'Finalisation'}
                </h3>
                
                {/* Typing effect message */}
                <p className={pageMode ? 'h-6 text-base font-medium text-[#6c5b4b]' : 'text-base text-gray-600 font-medium h-6'}>
                  <TypingText text={buildMessage} />
                </p>
              </div>

              {/* Progress bar */}
              <div className={pageMode ? 'relative z-10 w-full max-w-xl space-y-2' : 'w-full max-w-md space-y-2'}>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-scalor-green">Progression</span>
                  <span className="text-scalor-green">{Math.round(buildProgress)}%</span>
                </div>
                <div className={pageMode ? 'h-4 overflow-hidden rounded-full bg-[#e7ddd2] shadow-inner' : 'h-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full overflow-hidden shadow-inner'}>
                  <div
                    className={`h-full bg-gradient-to-r from-[#0A5740] via-[#0F6B4F] to-[#14855F] rounded-full transition-all duration-500 ease-out relative overflow-hidden ${pageMode ? 'shadow-[0_8px_24px_rgba(15,107,79,0.24)]' : ''}`}
                    style={{ width: `${buildProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/30 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Steps indicators */}
              <div className="relative z-10 flex items-center justify-center gap-3">
                {[0, 1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`flex items-center gap-2 transition-all duration-300 ${
                      step === buildStep
                        ? 'scale-110'
                        : step < buildStep
                        ? 'opacity-50'
                        : 'opacity-30'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                        step < buildStep
                          ? 'bg-scalor-green text-white'
                          : step === buildStep
                          ? `${pageMode ? 'bg-[#D4803F] text-white shadow-[0_12px_30px_rgba(212,128,63,0.30)]' : 'bg-scalor-copper text-white shadow-lg'}`
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {step < buildStep ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        step + 1
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Cancel button */}
              <button
                type="button"
                onClick={() => { 
                  abortRef.current?.abort(); 
                  setPhase('input');
                  setBuildStep(0);
                  setBuildProgress(0);
                  setBuildMessage('');
                  setShowConfetti(false);
                }}
                className={pageMode ? 'relative z-10 mt-4 text-sm text-[#8a7767] underline transition hover:text-[#5d4c3e]' : 'text-sm text-gray-400 hover:text-gray-600 underline transition mt-4'}
              >
                Annuler
              </button>
            </div>
          )}

          {/* ─── PREVIEW PHASE ─── */}
          {phase === 'preview' && product && (
            <div className="p-6 space-y-5">

              {/* Success Banner */}
              <div className={pageMode ? 'rounded-[28px] border border-[#cfe5dc] bg-[linear-gradient(135deg,#edf8f3,#f7fbf7)] p-5 shadow-[0_14px_40px_rgba(15,107,79,0.08)]' : 'rounded-xl border-2 border-[#96C7B5] bg-[#E6F2ED] p-4'}>
                <div className="flex items-center gap-3">
                  <div className={pageMode ? 'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0A5740,#14855F)] shadow-[0_14px_34px_rgba(15,107,79,0.20)]' : 'w-12 h-12 rounded-full bg-scalor-green flex items-center justify-center shrink-0'}>
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
              <div className={pageMode ? 'flex gap-1.5 rounded-[20px] border border-[#e3d7ca] bg-white/80 p-1.5 shadow-[0_10px_28px_rgba(90,65,40,0.05)]' : 'flex gap-1 p-1 bg-gray-100 rounded-xl'}>
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
                        : `${pageMode ? 'rounded-2xl text-[#7a6958] hover:bg-[#f5efe7] hover:text-[#1f1813]' : 'text-gray-500 hover:text-gray-700'}`
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
                    <div className="flex items-center gap-3 rounded-xl border border-[#D8CFC4] bg-[#EDE8E2] p-3">
                      <Loader2 className="w-4 h-4 text-[#C56A2D] animate-spin shrink-0" />
                      <span className="text-sm font-medium text-[#A85824]">
                        Les images sont en cours de génération en arrière-plan...
                      </span>
                    </div>
                  )}
                  {/* Hero photo avec textes */}
                  {product.heroImage && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <ImagePreview src={product.heroImage} label="Image HERO principale" className="w-full aspect-square" />
                      {(product.hero_headline || product.hero_slogan || product.hero_baseline) && (
                        <div className="border-t border-gray-200 bg-[#EDE8E2]/60 p-4">
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
                  <div className="p-4 bg-[#EDE8E2]/50 rounded-xl border border-[#D8CFC4]">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{product.title}</h3>
                      <CopyButton text={product.title} />
                    </div>
                    {/* CTA + Badge urgence */}
                    {(product.hero_cta || product.urgency_badge) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {product.urgency_badge && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">
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
                        <div key={i} className="p-3 bg-[#EDE8E2]/50 rounded-xl border border-[#D8CFC4] text-center">
                          <p className="text-xs font-bold text-[#0A5740] leading-tight">{stat}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Problem / Solution */}
                  {product.problem_section && (
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-600"><AlertTriangle className="h-3.5 w-3.5" />Problème</p>
                      {product.problem_section.title && (
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <p className="text-sm font-bold text-gray-900">{product.problem_section.title}</p>
                          <CopyButton text={product.problem_section.title} />
                        </div>
                      )}
                      <div className="space-y-2">
                        {(product.problem_section.pain_points || []).map((point, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-red-800">
                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {product.solution_section && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-600"><CheckCircle className="h-3.5 w-3.5" />Solution</p>
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
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700"><Sparkles className="h-3.5 w-3.5" />Bénéfices ({product.benefits_bullets.length})</p>
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
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-orange-600"><Package className="h-3.5 w-3.5" />Offre</p>
                      <div className="space-y-2">
                        {product.offer_block.offer_label && (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-orange-800">{product.offer_block.offer_label}</p>
                            <CopyButton text={product.offer_block.offer_label} />
                          </div>
                        )}
                        {product.offer_block.guarantee_text && (
                          <div className="flex items-start justify-between gap-2">
                            <p className="flex flex-1 items-start gap-2 text-sm text-gray-700"><Lock className="mt-0.5 h-4 w-4 text-orange-700" />{product.offer_block.guarantee_text}</p>
                            <CopyButton text={product.offer_block.guarantee_text} />
                          </div>
                        )}
                        {product.offer_block.countdown && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 rounded-lg text-xs text-orange-700 font-medium">
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
                    <div className="p-4 bg-[#FBF4EE] rounded-xl border border-[#E2B28F]">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-scalor-copper"><Zap className="h-3.5 w-3.5" />Urgence psychologique</p>
                      <div className="space-y-2 text-sm">
                        {product.urgency_elements.stock_limited && (
                          <div className="flex items-center gap-2 text-[#8B4A20]">
                            <Package className="h-4 w-4" />
                            <span>Stock limité activé</span>
                          </div>
                        )}
                        {product.urgency_elements.social_proof_count && (
                          <div className="flex items-center gap-2 text-[#8B4A20]">
                            <Star className="h-4 w-4" />
                            <span>{product.urgency_elements.social_proof_count}</span>
                          </div>
                        )}
                        {product.urgency_elements.quick_result && (
                          <div className="flex items-center gap-2 text-[#8B4A20]">
                            <Clock3 className="h-4 w-4" />
                            <span>{product.urgency_elements.quick_result}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Conversion Blocks */}
                  {product.conversion_blocks?.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-green-700"><Zap className="h-3.5 w-3.5" />Blocs conversion ({product.conversion_blocks.length})</p>
                      <div className="grid grid-cols-2 gap-2">
                        {product.conversion_blocks.map((block, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-green-100">
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
                      <div key={i} className="mb-3 border border-gray-100 rounded-xl overflow-hidden">
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
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-600"><CheckCircle className="h-3.5 w-3.5" />Raisons d'acheter</p>
                      <div className="space-y-2">
                        {product.raisons_acheter.map((r, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-emerald-500 font-bold text-sm mt-0.5">✓</span>
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
                      <div className="p-3 bg-[#EDE8E2]/50">
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
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-scalor-copper"><Star className="h-3.5 w-3.5" />{product.testimonials.length} témoignages clients</p>
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
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-600"><CheckCircle className="h-3.5 w-3.5" />{product.raisons_acheter.length} raisons d'acheter</p>
                      {product.raisons_acheter.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 mb-2 bg-emerald-50 rounded-lg border border-emerald-100">
                          <span className="text-emerald-500 font-bold">{i + 1}.</span>
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
                  {((product.socialProofImages || []).length > 0 || (product.peoplePhotos || []).length > 0 || product.beforeAfterImage || product.beforeAfterImages?.length) && (
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0A5740]"><Users className="h-3.5 w-3.5" />Preuve sociale générée</p>
                      <div className="grid grid-cols-2 gap-3">
                        {((product.socialProofImages || []).length > 0
                          ? product.socialProofImages
                          : [
                              ...(product.peoplePhotos || []),
                              ...((product.beforeAfterImages?.length ? product.beforeAfterImages : (product.beforeAfterImage ? [product.beforeAfterImage] : []))),
                            ]
                        ).map((imgUrl, i) => (
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
        <div className={pageMode ? 'border-t border-[#e4d8ca] bg-[linear-gradient(180deg,rgba(255,250,244,0.88),rgba(245,236,226,0.92))] px-6 py-4 shadow-[0_-14px_40px_rgba(104,76,46,0.06)] backdrop-blur-sm shrink-0' : 'px-6 py-4 border-t border-gray-100 shrink-0'}>
          {phase === 'input' && (
            <>
              {/* Info générations restantes */}
              {generationsInfo && !pageMode && (
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
                  <div className="rounded-2xl border border-[#d8cab9] bg-white/72 px-4 py-3 text-xs leading-5 text-[#6d5b4a] md:max-w-[340px]">
                    {step < 3
                      ? 'Renseigne le produit, définis la méthode puis affine le ciblage avant de lancer la génération.'
                      : 'Tout est prêt. Lance la génération pour produire la page, les visuels et les blocs marketing.'}
                  </div>
                )}
                {(step > 1 || productSubstep > 1) && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className={pageMode ? 'min-w-[180px] py-3 border border-[#cdbca8] bg-white/86 text-[#5d4d40] rounded-2xl font-semibold text-sm hover:bg-white transition flex items-center justify-center gap-2' : 'flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition flex items-center justify-center gap-2'}
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
                      disabled={!canGenerate() || (generationsInfo !== null && (generationsInfo?.remaining || 0) <= 0)}
                      className={`w-full py-3 text-white font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg ${pageMode ? 'rounded-2xl bg-[linear-gradient(135deg,#0A5740,#14855F)] hover:brightness-105' : 'bg-scalor-green rounded-xl hover:bg-scalor-green-dark'}`}
                    >
                      <Sparkles className="w-4 h-4" />
                      Générer ma page produit
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {phase === 'preview' && (
            <div className="space-y-3">
              {/* Info message */}
              <div className={pageMode ? 'rounded-2xl border border-[#cfe5dc] bg-[#eef8f3] px-4 py-3' : 'px-4 py-2 bg-[#E6F2ED] border border-[#96C7B5] rounded-lg'}>
                <p className="text-xs text-[#0A5740] text-center">
                  Explorez l'aperçu ci-dessus, puis cliquez sur <strong>"Utiliser cette page"</strong> pour l'ajouter à votre boutique.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRestart}
                  className={pageMode ? 'flex-1 py-3 border border-[#cdbca8] bg-white/86 text-[#5d4d40] rounded-2xl font-medium text-sm hover:bg-white transition' : 'flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 hover:border-gray-300 transition'}
                >
                  <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4" />Recommencer</span>
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className={pageMode ? 'flex-[2] py-3.5 rounded-2xl bg-[linear-gradient(135deg,#C56A2D,#D4803F)] text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-[0_18px_40px_rgba(197,106,45,0.28)] hover:brightness-105' : 'flex-[2] py-3.5 bg-scalor-copper text-white rounded-xl font-bold text-sm hover:bg-scalor-copper-dark transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]'}
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
  );
};

export default ProductPageGeneratorModal;
