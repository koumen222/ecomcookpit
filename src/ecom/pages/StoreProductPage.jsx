import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, ShoppingCart, MessageCircle,
  ShoppingBag, Shield, RotateCcw, Truck, Check, Share2,
  ChevronDown, ChevronUp, Star,
} from 'lucide-react';
import { useSubdomain } from '../hooks/useSubdomain';
import { useStoreProduct, injectStoreCssVars, prefetchStoreProduct } from '../hooks/useStoreData';
import { useStoreCart } from '../hooks/useStoreCart';
import QuickOrderModal from '../components/QuickOrderModal';
import EmbeddedOrderForm from '../components/EmbeddedOrderForm';
import ProductBenefits from '../components/ProductBenefits';
import ConversionBlocks, { UrgencyBadge } from '../components/ConversionBlocks';
import ProductTestimonials from '../components/ProductTestimonials';
import { StorefrontHeader, StorefrontFooter } from '../components/StorefrontShared';
import StoreProductPageInfographics from '../components/StoreProductPageInfographics';
// socket.io-client chargé dynamiquement pour ne pas bloquer le rendu initial
import { setDocumentMeta } from '../utils/pageMeta';
import { trackStorefrontEvent } from '../utils/pixelTracking';
import { useStoreAnalytics } from '../hooks/useStoreAnalytics';
import { preloadStoreCheckoutRoute, preloadStoreProductRoute } from '../utils/routePrefetch';
import { getIconComponent } from '../components/productSettings/ButtonEditor';
import defaultConfig from '../components/productSettings/defaultConfig';
import { formatMoney } from '../utils/currency.js';
import { buildMergedProductPageConfig } from '../utils/productPageConfig.js';
import { captureAffiliateAttributionFromSearch } from '../utils/affiliateAttribution.js';

const fmt = (n, cur = 'XAF') => formatMoney(n, cur);

const COUNTRY_TESTIMONIALS = {
  Cameroun: [
    { name: "Thierry M.", location: "Douala", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine. Je recommande a 100%.", verified: true, date: "Il y a 3 jours" },
    { name: "Astride N.", location: "Yaoundé", rating: 5, text: "Avant j'avais essaye plein de produits sans resultats. Depuis que j'utilise celui-ci, la difference est flagrante !", verified: true, date: "Il y a 5 jours" },
    { name: "Rodrigue K.", location: "Bafoussam", rating: 5, text: "Super qualite, livraison rapide. Le produit depasse mes attentes. Je vais en commander encore.", verified: true, date: "Il y a 1 semaine" },
    { name: "Christelle B.", location: "Douala", rating: 5, text: "J'etais sceptique au depart mais apres 2 semaines je ne peux plus m'en passer. Resultats durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Paul E.", location: "Yaoundé", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant. Je recommande cette boutique.", verified: true, date: "Il y a 3 semaines" },
  ],
  "Cote d'Ivoire": [
    { name: "Fatou K.", location: "Abidjan", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Kouame A.", location: "Bouaké", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Aya D.", location: "Abidjan", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Seydou T.", location: "Yamoussoukro", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Marie L.", location: "Abidjan", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Senegal: [
    { name: "Aminata D.", location: "Dakar", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine. Je recommande.", verified: true, date: "Il y a 3 jours" },
    { name: "Ibrahima S.", location: "Thiès", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Fatou N.", location: "Dakar", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Moussa B.", location: "Mbour", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Aissatou F.", location: "Saint-Louis", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Ghana: [
    { name: "Kwame A.", location: "Accra", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Abena M.", location: "Kumasi", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Kofi D.", location: "Accra", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Ama T.", location: "Takoradi", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Yaw K.", location: "Tamale", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Togo: [
    { name: "Kossi M.", location: "Lomé", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Afi K.", location: "Kara", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Kodjo A.", location: "Lomé", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Akouavi D.", location: "Sokodé", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Yao T.", location: "Atakpamé", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Benin: [
    { name: "Ganiou A.", location: "Cotonou", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Fifame D.", location: "Porto-Novo", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Hospice K.", location: "Cotonou", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Aurore B.", location: "Parakou", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Léonce T.", location: "Abomey-Calavi", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Nigeria: [
    { name: "Chinedu O.", location: "Lagos", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Ngozi A.", location: "Abuja", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Emeka U.", location: "Lagos", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Blessing I.", location: "Port Harcourt", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Tunde B.", location: "Ibadan", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Gabon: [
    { name: "Steeve M.", location: "Libreville", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Ornella N.", location: "Port-Gentil", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Brice A.", location: "Libreville", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Chancelle O.", location: "Franceville", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Davy E.", location: "Oyem", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Mali: [
    { name: "Mamadou C.", location: "Bamako", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Fatoumata T.", location: "Sikasso", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Oumar D.", location: "Bamako", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Aïssata K.", location: "Ségou", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Boubacar S.", location: "Kayes", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  "Burkina Faso": [
    { name: "Wendkouni O.", location: "Ouagadougou", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Mariam Z.", location: "Bobo-Dioulasso", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Abdoulaye K.", location: "Ouagadougou", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Salamata S.", location: "Koudougou", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Hamidou T.", location: "Ouahigouya", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Guinee: [
    { name: "Alpha B.", location: "Conakry", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Mariama D.", location: "Kankan", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Mamadou S.", location: "Conakry", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Fatoumata C.", location: "Kindia", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Ibrahima K.", location: "Labé", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Congo: [
    { name: "Gloire M.", location: "Brazzaville", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Merveille N.", location: "Pointe-Noire", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Christ B.", location: "Brazzaville", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Grâce O.", location: "Dolisie", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Parfait K.", location: "Nkayi", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  RDC: [
    { name: "Patrick M.", location: "Kinshasa", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Carine L.", location: "Lubumbashi", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Jonathan K.", location: "Kinshasa", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Esther N.", location: "Goma", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "David B.", location: "Kisangani", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
};
COUNTRY_TESTIMONIALS.default = COUNTRY_TESTIMONIALS.Cameroun;

const getDefaultTestimonials = (country) => {
  if (!country) return COUNTRY_TESTIMONIALS.default;
  const key = Object.keys(COUNTRY_TESTIMONIALS).find(k => country.toLowerCase().includes(k.toLowerCase()));
  return COUNTRY_TESTIMONIALS[key] || COUNTRY_TESTIMONIALS.default;
};

const normalizeMetaText = (value = '') => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const truncateMetaText = (value = '', max = 180) => {
  if (!value || value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
};

// ── Hook : déclenche le rendu d'une section quand elle entre dans le viewport ─
const useInView = (rootMargin = '200px') => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [rootMargin]);
  return [ref, visible];
};

// Wrapper transparent : réserve l'espace via minHeight, monte le contenu au scroll
const LazySection = ({ children, minHeight = 80, style = {} }) => {
  const [ref, visible] = useInView('300px');
  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : minHeight, ...style }}>
      {visible ? children : null}
    </div>
  );
};

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const mergeProductSections = (stored) => {
  const defaults = deepClone(defaultConfig.general.sections);
  if (!stored?.length) return defaults;
  const merged = stored.map(section => {
    const def = defaults.find(item => item.id === section.id);
    return def ? { ...def, ...section } : section;
  });
  defaults.forEach(def => {
    if (!merged.find(section => section.id === def.id)) merged.push(def);
  });
  return merged;
};

const LEGACY_PRODUCT_GALLERY_TITLE = 'Ils nous font confiance';
const LEGACY_PRODUCT_GALLERY_SUBTITLE = 'Découvrez les retours de nos clients satisfaits';
const SOCIAL_PROOF_GALLERY_TITLE = 'Ces clients nous ont fait confiance';

const PRODUCT_GALLERY_DEFAULTS = {
  title: SOCIAL_PROOF_GALLERY_TITLE,
  subtitle: '',
  showHeader: true,
  useProductImages: true,
  images: [],
  mainImageHeight: 420,
  thumbnailSize: 72,
};

const normalizeProductGalleryConfig = (content = {}) => {
  const normalized = { ...PRODUCT_GALLERY_DEFAULTS, ...(content || {}) };
  const title = String(normalized.title || '').trim();
  const subtitle = String(normalized.subtitle || '').trim();
  const hasLegacyHeader = title === LEGACY_PRODUCT_GALLERY_TITLE
    && subtitle === LEGACY_PRODUCT_GALLERY_SUBTITLE;

  if (hasLegacyHeader) {
    normalized.title = SOCIAL_PROOF_GALLERY_TITLE;
    normalized.subtitle = '';
    normalized.showHeader = true;
  }

  return normalized;
};

const mergeGalleryImageEntries = (...lists) => {
  const seen = new Set();
  const merged = [];
  lists.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((entry, index) => {
      const url = typeof entry === 'string' ? entry : entry?.url;
      if (!url || seen.has(url)) return;
      seen.add(url);
      merged.push(typeof entry === 'string'
        ? { url, alt: '', order: merged.length }
        : { ...entry, url, alt: entry.alt || '', order: entry.order ?? merged.length ?? index });
    });
  });
  return merged.map((entry, index) => ({ ...entry, order: index }));
};

const resolveProductGalleryImages = (content = {}, fallbackImages = []) => {
  const customImages = (content.images || []).filter(image => image?.url);
  const shouldUseFallback = content.useProductImages !== false;
  if (customImages.length > 0) {
    return shouldUseFallback ? mergeGalleryImageEntries(customImages, fallbackImages) : customImages;
  }
  return shouldUseFallback ? fallbackImages : [];
};

const buildSocialProofGalleryImages = (product) => {
  const pageData = product?._pageData || {};
  const entries = [];
  const seen = new Set();
  const push = (entry, fallbackAlt) => {
    if (!entry) return;
    const url = typeof entry === 'string' ? entry : entry.url;
    if (!url || seen.has(url)) return;
    seen.add(url);
    entries.push(typeof entry === 'string' ? { url, alt: fallbackAlt } : { ...entry, url, alt: entry.alt || fallbackAlt });
  };

  (pageData.socialProofImages || []).forEach((image, index) => {
    push(image, `${product?.name || 'Produit'} — preuve sociale ${index + 1}`);
  });

  if (!entries.length) {
    (pageData.peoplePhotos || []).forEach((image, index) => {
      push(image, `${product?.name || 'Produit'} — client ${index + 1}`);
    });
    (pageData.beforeAfterImages?.length ? pageData.beforeAfterImages : (pageData.beforeAfterImage ? [pageData.beforeAfterImage] : [])).forEach((image, index) => {
      push(image, `${product?.name || 'Produit'} — avant/après ${index + 1}`);
    });
  }

  return entries;
};

const buildProductGalleryFallbackImages = (product) => buildSocialProofGalleryImages(product);

const clampDisplayAspectRatio = (ratio) => {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.max(0.68, Math.min(1.8, ratio));
};

const GALLERY_RATIO_PRESETS = {
  square: 1,
  portrait: 0.75,
  landscape: 1.33,
  wide: 1.78,
};

// ── Utilitaire compression d'image ───────────────────────────────────────────
// Ajoute des paramètres de resize/qualité pour les CDN qui les supportent
// (Cloudflare Image Resizing, Imgix, Cloudinary, Bunny, etc.)
const optimizeImageUrl = (url, { width = 800, quality = 80 } = {}) => {
  if (!url || typeof url !== 'string') return url;
  try {
    // Cloudinary : .../upload/... → .../upload/w_800,q_80,f_auto,...
    if (url.includes('res.cloudinary.com')) {
      return url.replace(/\/upload\//, `/upload/w_${width},q_${quality},f_auto,c_limit/`);
    }
    // Imgix : append w= et q=
    if (url.includes('.imgix.net') || url.includes('imgix.')) {
      const u = new URL(url);
      if (!u.searchParams.has('w')) u.searchParams.set('w', width);
      if (!u.searchParams.has('q')) u.searchParams.set('q', quality);
      u.searchParams.set('auto', 'format,compress');
      return u.toString();
    }
    // Bunny CDN : append ?width=&quality=
    if (url.includes('.b-cdn.net') || url.includes('bunnycdn')) {
      const u = new URL(url);
      if (!u.searchParams.has('width')) u.searchParams.set('width', width);
      if (!u.searchParams.has('quality')) u.searchParams.set('quality', quality);
      return u.toString();
    }
    // Supabase Storage : append ?width=&quality=
    if (url.includes('supabase.co/storage')) {
      const u = new URL(url);
      if (!u.searchParams.has('width')) u.searchParams.set('width', width);
      if (!u.searchParams.has('quality')) u.searchParams.set('quality', quality);
      return u.toString();
    }
    // R2/pub-xxx.r2.dev : pas de resize natif → retourner tel quel
    // (images déjà optimisées à l'upload en WebP 1200px q82)
    return url;
  } catch { return url; }
};
const ImageGallery = ({ images = [], design = {} }) => {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [ratios, setRatios] = useState({});
  const zoomEnabled = design.imageZoom !== false;
  const borderRadius = design.borderRadius || '12px';

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
      paddingBottom: '125%', position: 'relative',
      backgroundColor: '#f4f4f5', overflow: 'hidden', borderRadius,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ShoppingBag size={64} style={{ color: '#d1d5db' }} />
      </div>
    </div>
  );

  const activeSrc = images[active]?.url || images[active];
  const activeRatio = clampDisplayAspectRatio(ratios[activeSrc] || 1);
  const activeAspectRatio = GALLERY_RATIO_PRESETS[design.imageRatio] || activeRatio;

  return (
    <div>
      {/* Main image */}
      <div
        style={{
          position: 'relative', aspectRatio: activeAspectRatio,
          backgroundColor: '#f4f4f5', overflow: 'hidden', borderRadius,
          minHeight: 'min(280px, 70vw)',
          maxHeight: '75vh',
          cursor: zoomEnabled ? 'zoom-in' : 'default',
        }}
        onClick={zoomEnabled ? () => setZoomed(true) : undefined}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={optimizeImageUrl(activeSrc, { width: 900, quality: 82 })}
          alt={images[active]?.alt || ''}
          loading="eager"
          fetchpriority="high"
          decoding="async"
          sizes="(max-width: 768px) 100vw, 50vw"
          onLoad={(e) => {
            const img = e.currentTarget;
            const w = img.naturalWidth || 0;
            const h = img.naturalHeight || 0;
            if (!activeSrc || !w || !h) return;
            const r = w / h;
            if (!Number.isFinite(r) || r <= 0) return;
            setRatios((prev) => (prev[activeSrc] ? prev : { ...prev, [activeSrc]: r }));
          }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            // "Hero" doit afficher l'image complète (pas recadrée)
            objectFit: 'contain', objectPosition: 'center',
            transition: 'opacity 0.2s',
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
        <div className="thumb-track sf-no-scrollbar" style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', msOverflowStyle: 'none', maxWidth: '100%' }}>
          {images.map((img, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              flexShrink: 0, width: 60, height: 60, overflow: 'hidden', padding: 0,
              border: '2.5px solid',
              borderColor: i === active ? 'var(--s-primary)' : 'transparent',
              cursor: 'pointer', transition: 'border-color 0.15s',
              backgroundColor: '#f4f4f5',
              borderRadius,
            }}>
              <img
                src={optimizeImageUrl(img?.url || img, { width: 120, quality: 75 })} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom modal */}
      {zoomed && zoomEnabled && (
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
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius }}
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

const InlinePhotoCarousel = ({ images = [], accentColor = 'var(--s-primary)', config = {} }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [ratios, setRatios] = useState({});
  const gallery = { ...PRODUCT_GALLERY_DEFAULTS, ...config };
  const mainImageHeight = Math.max(220, Number.parseInt(gallery.mainImageHeight, 10) || 420);

  const canNavigate = images.length > 1;

  const goTo = (nextIndex) => {
    if (!images.length) return;
    if (nextIndex < 0) {
      setActiveIndex(images.length - 1);
      return;
    }
    if (nextIndex >= images.length) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex(nextIndex);
  };

  // Auto-scroll toutes les 3.5s, pause au survol / interaction manuelle
  useEffect(() => {
    if (!canNavigate || isPaused) return undefined;
    const id = setInterval(() => {
      setActiveIndex(i => (i + 1) % images.length);
    }, 3500);
    return () => clearInterval(id);
  }, [canNavigate, isPaused, images.length]);

  const pauseAndGo = (nextIndex) => {
    setIsPaused(true);
    goTo(nextIndex);
  };

  if (!images.length) return null;

  const activeImage = images[activeIndex] || images[0];
  const activeSrc = activeImage?.url || activeImage;
  const activeRatio = clampDisplayAspectRatio(ratios[activeSrc] || 1);

  const navButtonStyle = {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: '1px solid var(--s-border)',
    background: '#fff',
    color: 'var(--s-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    flexShrink: 0,
  };

  return (
    <div style={{ marginTop: 14 }}>
      {gallery.showHeader !== false && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {gallery.title && (
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>
                {gallery.title}
              </p>
            )}
            {gallery.subtitle && (
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}>
                {gallery.subtitle}
              </p>
            )}
          </div>
          {canNavigate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                aria-label="Image précédente"
                onClick={() => pauseAndGo(activeIndex - 1)}
                style={navButtonStyle}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="Image suivante"
                onClick={() => pauseAndGo(activeIndex + 1)}
                style={navButtonStyle}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        style={{
          position: 'relative',
          borderRadius: 'calc(var(--pp-card-radius) + 2px)',
          overflow: 'hidden',
          border: '1px solid var(--s-border)',
          background: '#fff',
        }}
      >
        <div style={{ position: 'relative', aspectRatio: activeRatio, minHeight: 'min(260px, 68vw)', maxHeight: `${mainImageHeight}px`, background: '#f4f4f5' }}>
          <img
            key={`${activeSrc}-${activeIndex}`}
            src={activeSrc}
            alt={activeImage.alt || 'Client satisfait'}
            loading={activeIndex === 0 ? 'eager' : 'lazy'}
            onLoad={(event) => {
              const img = event.currentTarget;
              const width = img.naturalWidth || 0;
              const height = img.naturalHeight || 0;
              if (!activeSrc || !width || !height) return;
              const ratio = width / height;
              if (!Number.isFinite(ratio) || ratio <= 0) return;
              setRatios((prev) => (prev[activeSrc] ? prev : { ...prev, [activeSrc]: ratio }));
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
            }}
          />
        </div>

        {canNavigate && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
            padding: '5px 9px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(4px)',
          }}>
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Aller à l'image ${i + 1}`}
                onClick={() => pauseAndGo(i)}
                style={{
                  width: i === activeIndex ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  border: 'none',
                  padding: 0,
                  background: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.55)',
                  cursor: 'pointer',
                  transition: 'width 0.25s, background 0.25s',
                }}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

// ── Product Reviews (Stars) ─────────────────────────────────────────────────
const ProductReviews = ({ rating = 4.5, reviewCount = 128 }) => {
  const displayCount = reviewCount > 0 ? reviewCount : 125;
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
        ({displayCount} avis)
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

    // Strip embedded <style> and <script> tags
    root.querySelectorAll('style, script').forEach(el => el.remove());

    // Strip class and style attributes to prevent injected CSS from overriding page styles
    root.querySelectorAll('[class], [style]').forEach(el => {
      el.removeAttribute('class');
      el.removeAttribute('style');
    });

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

// ── Stats Bar (social proof numbers) ─────────────────────────────────────────
const StatsBar = ({ stats = [], visualTheme = null }) => {
  if (!stats || stats.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
      {stats.map((stat, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: visualTheme?.primary || 'var(--s-primary)', fontFamily: 'var(--s-font)' }}>
            {stat.value}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}>
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Problem / Solution sections ───────────────────────────────────────────────
const ProblemSection = ({ section, visualTheme = null }) => {
  if (!section?.title && !section?.pain_points?.length) return null;
  return (
    <div style={{
      margin: '24px 0', padding: '22px 20px', borderRadius: 16,
      background: visualTheme?.softGradient || '#FFF7F7', border: `1px solid ${visualTheme?.softBorder || '#FECACA'}`,
      boxShadow: visualTheme?.shadow || 'none',
    }}>
      {section.title && (
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800, color: visualTheme?.text || '#991B1B', fontFamily: 'var(--s-font)', lineHeight: 1.3 }}>
          {section.title}
        </h3>
      )}
      {section.pain_points?.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {section.pain_points.map((point, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: visualTheme?.mutedText || '#7F1D1D', lineHeight: 1.6, fontFamily: 'var(--s-font)' }}>
              <span style={{ flexShrink: 0, marginTop: 2, color: visualTheme?.primary || '#991B1B' }}>●</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SolutionSection = ({ section, visualTheme = null }) => {
  if (!section?.title && !section?.description) return null;
  return (
    <div style={{
      margin: '16px 0 24px', padding: '22px 20px', borderRadius: 16,
      background: visualTheme?.softGradient || '#F0FDF4', border: `1px solid ${visualTheme?.softBorder || '#A7F3D0'}`,
      boxShadow: visualTheme?.shadow || 'none',
    }}>
      {section.title && (
        <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800, color: visualTheme?.text || '#14532D', fontFamily: 'var(--s-font)', lineHeight: 1.3 }}>
          {section.title}
        </h3>
      )}
      {section.description && (
        <p style={{ margin: 0, fontSize: 14.5, color: visualTheme?.mutedText || '#166534', lineHeight: 1.75, fontFamily: 'var(--s-font)' }}>
          {section.description}
        </p>
      )}
    </div>
  );
};

// ── Offer / Guarantee Block ────────────────────────────────────────────────────
const OfferBlock = ({ block, visualTheme = null }) => {
  const text = block?.guarantee_text || block?.hook;
  if (!text) return null;
  return (
    <p style={{ margin: '6px 0', fontSize: 12, color: visualTheme?.primary || 'var(--s-text2)', lineHeight: 1.4, fontWeight: 600, fontFamily: 'var(--s-font)', display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ flexShrink: 0 }}>✦</span>{text}
    </p>
  );
};

const ProductFaqAccordion = ({ items = [], visualTheme = null }) => {
  const [openIndex, setOpenIndex] = useState(null);

  if (!items.length) return null;

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--s-border)' }}>
      <h2 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 800, color: visualTheme?.primary || 'var(--s-section-faq, var(--s-primary))', fontFamily: 'var(--s-font)' }}>
        Questions fréquentes
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, index) => {
          const opened = openIndex === index;
          return (
            <div key={`${item.question}-${index}`} style={{ borderRadius: 14, border: '1px solid', overflow: 'hidden', borderColor: opened ? (visualTheme?.primary || 'var(--s-section-faq, var(--s-primary))') : (visualTheme?.softBorder || 'var(--s-section-faq-border, var(--s-border))'), background: opened ? (visualTheme?.softGradient || 'var(--s-section-faq-soft, #FAFFFE)') : (visualTheme?.surface || 'var(--s-bg)'), boxShadow: opened ? (visualTheme?.shadow || 'none') : 'none' }}>
              <button
                onClick={() => setOpenIndex(opened ? null : index)}
                style={{ width: '100%', padding: '18px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 700, color: opened ? (visualTheme?.primary || 'var(--s-section-faq, var(--s-primary))') : 'var(--s-text)', lineHeight: 1.45, fontFamily: 'var(--s-font)' }}>
                  {item.question}
                </span>
                <span style={{ flexShrink: 0, color: opened ? (visualTheme?.primary || 'var(--s-section-faq, var(--s-primary))') : 'var(--s-text2)' }}>
                  {opened ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>
              {opened && (
                <div style={{ padding: '0 18px 18px', fontSize: 14, color: visualTheme?.mutedText || 'var(--s-text2)', lineHeight: 1.7, fontFamily: 'var(--s-font)' }}>
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
const TrustBadges = ({ compact = false, accentColor = 'var(--s-section-trust, var(--s-primary))' }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, marginBottom: 4 }}>
    {[
      { icon: <Truck size={11} />, text: 'Livraison rapide' },
      { icon: <Shield size={11} />, text: 'Paiement sécurisé' },
      { icon: <RotateCcw size={11} />, text: 'Retours acceptés' },
    ].map(({ icon, text }) => (
      <div key={text} style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', borderRadius: 999,
        border: '1px solid var(--s-border)',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ color: accentColor, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}>{text}</span>
      </div>
    ))}
  </div>
);

const SPACING_PRESETS = {
  compact: {
    gap: '24px',
    mobileInfoPadding: '12px',
    desktopInfoPadding: '18px',
    landingPadding: '20px',
  },
  normal: {
    gap: '40px',
    mobileInfoPadding: '16px',
    desktopInfoPadding: '24px',
    landingPadding: '24px',
  },
  relaxed: {
    gap: '56px',
    mobileInfoPadding: '24px',
    desktopInfoPadding: '32px',
    landingPadding: '32px',
  },
};

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, seconds || 0);
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(safeSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
};

const withAlpha = (color, alphaHex, fallback) => {
  if (typeof color === 'string' && color.startsWith('#')) return `${color}${alphaHex}`;
  return fallback;
};

const buildAiVisualTheme = ({ store = null, design = {}, product = null } = {}) => {
  const primary = design?.ctaButtonColor || design?.buttonColor || store?.accentColor || store?.primaryColor || '#0f6b4f';
  const accent = design?.badgeColor || store?.accentColor || primary;
  const text = design?.textColor || store?.textColor || '#111827';
  const background = design?.backgroundColor || null;
  const surface = design?.fieldBgColor || '#FFFFFF';

  return {
    primary,
    accent,
    background,
    surface,
    text,
    gradient: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
    softGradient: null,
    border: withAlpha(accent, '40', 'rgba(15,107,79,0.18)'),
    softBorder: withAlpha(accent, '22', 'rgba(15,107,79,0.10)'),
    mutedText: withAlpha(text, 'B8', text),
    shadow: `0 18px 44px ${withAlpha(primary, '1E', 'rgba(15,107,79,0.12)')}`,
  };
};

const buildSectionVisualTheme = (sectionKey, { useTextAsTitle = false } = {}) => ({
  primary: `var(--s-section-${sectionKey}, var(--s-primary))`,
  accent: `var(--s-section-${sectionKey}, var(--s-primary))`,
  text: useTextAsTitle ? `var(--s-section-${sectionKey}, var(--s-text))` : 'var(--s-text)',
  mutedText: 'var(--s-text2)',
  gradient: `linear-gradient(135deg, var(--s-section-${sectionKey}, var(--s-primary)) 0%, var(--s-section-${sectionKey}, var(--s-primary)) 100%)`,
  softGradient: `var(--s-section-${sectionKey}-soft, var(--s-bg))`,
  border: `var(--s-section-${sectionKey}-border, var(--s-border))`,
  softBorder: `var(--s-section-${sectionKey}-border, var(--s-border))`,
  shadow: `var(--s-section-${sectionKey}-shadow, none)`,
  surface: 'var(--s-bg)',
});

const buildAiGalleryImages = (product) => {
  const seen = new Set();
  const gallery = [];
  const nativeProductImages = Array.isArray(product?.images) ? product.images : [];
  const pushImage = (entry, fallbackAlt = '') => {
    if (!entry) return;
    const rawUrl = typeof entry === 'string' ? entry : entry.url;
    if (!rawUrl || seen.has(rawUrl)) return;
    seen.add(rawUrl);
    gallery.push(typeof entry === 'string' ? { url: rawUrl, alt: fallbackAlt } : { ...entry, url: rawUrl, alt: entry.alt || fallbackAlt });
  };

  const pageData = product?._pageData || {};
  // Source de vérité unique: les images du produit dans l'ordre choisi par l'utilisateur.
  nativeProductImages.forEach((image, index) => {
    pushImage(image, index === 0 ? (product?.name || 'Image hero') : `${product?.name || 'Produit'} — image ${index + 1}`);
  });

  // Fallback minimal pour les anciens produits sans images natives.
  if (!gallery.length) {
    pushImage(pageData.heroImage, product?.name || 'Hero image');
    pushImage(pageData.heroPosterImage, product?.name || 'Affiche produit');
  }

  return gallery;
};

// ── Related Products ─────────────────────────────────────────────────────────
const RelatedCard = ({ product, prefix, store, subdomain }) => {
  const [hovered, setHovered] = useState(false);
  const displayCurrency = product?.currency || store?.currency || 'XAF';
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
        borderRadius: 'var(--pp-card-radius)', overflow: 'hidden', border: '1px solid var(--s-border)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'none', transition: 'all 0.2s',
      }}>
        <div style={{ paddingBottom: '125%', position: 'relative', backgroundColor: '#f4f4f5', overflow: 'hidden' }}>
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
            {fmt(product.price, displayCurrency)}
          </span>
        </div>
      </div>
    </Link>
  );
};


// ── Main ─────────────────────────────────────────────────────────────────────
const StoreProductPage = () => {
  const { subdomain: paramSubdomain, slug } = useParams();
  const location = useLocation();
  const { subdomain: detectedSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = paramSubdomain || detectedSubdomain;
  const prefix = isStoreDomain ? '' : (subdomain ? `/store/${subdomain}` : '');

  const { store, pixels, product, related, loading, error } = useStoreProduct(subdomain, slug);
  const { cartCount } = useStoreCart(subdomain);
  const { trackPageView, trackProductView, trackAddToCart } = useStoreAnalytics(subdomain);
  const effectiveCurrency = product?.currency || store?.currency || 'XAF';

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showStickyOrderBar, setShowStickyOrderBar] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({}); // { 'Taille': 'M', 'Couleur': 'Noir' }
  const ctaButtonsRef = useRef(null);
  const [livePageConfig, setLivePageConfig] = useState(null); // real-time override from page builder
  const [countdownSeconds, setCountdownSeconds] = useState(null);

  useEffect(() => {
    captureAffiliateAttributionFromSearch(location.search);
  }, [location.search]);

  // Inject pixel scripts and fire ViewContent when product loads
  useEffect(() => {
    if (!product || !pixels) return;
    trackStorefrontEvent({
      subdomain,
      pixels,
      eventName: 'PageView',
    });
    trackStorefrontEvent({
      subdomain,
      pixels,
      eventName: 'ViewContent',
      params: {
      content_ids: [product._id || product.slug || ''],
      content_name: product.name || '',
      value: product.price || 0,
      currency: effectiveCurrency,
      },
    });
    // Track product view in store analytics
    trackProductView(product._id || product.slug, product.name, product.price);
  }, [product, pixels, effectiveCurrency, subdomain, trackProductView]);

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

  // Preload de l'image hero dès qu'elle est connue (LCP)
  useEffect(() => {
    const heroUrl = product?.images?.[0]?.url || product?.images?.[0];
    if (!heroUrl || typeof heroUrl !== 'string') return;
    const existing = document.querySelector(`link[rel="preload"][data-hero-img]`);
    if (existing) { existing.href = heroUrl; return; }
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = heroUrl;
    link.setAttribute('data-hero-img', '1');
    link.fetchPriority = 'high';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, [product?.images]);

  // Écouter les changements de couleurs en temps réel via Socket.io (chargé après le rendu)
  useEffect(() => {
    if (!subdomain) return;
    let socket = null;
    let cancelled = false;

    // Délai de 2s après le rendu pour ne pas bloquer la peinture initiale
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const { io } = await import('socket.io-client');
        if (cancelled) return;
        const socketUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.scalor.net';
        socket = io(`${socketUrl}/store-live`, {
          transports: ['websocket', 'polling'],
          reconnection: true,
        });
        socket.on('connect', () => { socket.emit('store:join', { subdomain }); });
        socket.on('theme:update', (themeData) => { if (themeData) injectStoreCssVars(themeData); });
        socket.on('connect_error', () => {});
      } catch {}
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (socket) socket.disconnect();
    };
  }, [subdomain]);

  // Shopify-style postMessage listener — builder parent sends PAGE_PREVIEW_UPDATE
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'PAGE_PREVIEW_UPDATE' && event.data.payload) {
        setLivePageConfig(event.data.payload);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);


  const images = buildAiGalleryImages(product);
  const hasDiscount = product?.compareAtPrice && product.compareAtPrice > product.price;
  const pct = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const inStock = !product || product.stock > 0;
  const lowStock = product && product.stock > 0 && product.stock <= 5;
  const sectionToggles = store?.sectionToggles || {};
  const showWhatsappButton = (sectionToggles.showWhatsappButton ?? false) && !!store?.whatsapp;
  const showRelatedProductsFromStore = sectionToggles.showRelatedProducts ?? true;

  // ── productPageConfig — priority: livePreview > product-specific > store global ──
  const storePC = store?.productPageConfig || {};
  const productPC = product?.productPageConfig || {};
  const previewPC = livePageConfig || {};
  const baseProductPageConfig = buildMergedProductPageConfig(storePC, productPC);
  const liveMergedProductPageConfig = buildMergedProductPageConfig(baseProductPageConfig, previewPC);
  const productPageConfig = {
    ...liveMergedProductPageConfig,
    conversion: {
      ...(baseProductPageConfig.conversion || {}),
      ...(previewPC.conversion || {}),
      // Quantity offers from QuantityOffer model take highest priority
      ...(product?.quantityOffers?.length > 0 ? {
        offersEnabled: true,
        offers: product.quantityOffers,
        offerDesign: product.quantityOfferDesign || null,
      } : {}),
    },
  };
  const ppTheme = productPC?.theme || productPageConfig?.theme || store?.template || storePC?.theme || 'classic';
  const ppGeneral = productPageConfig?.general || {};
  const ppDesign = productPageConfig?.design || {};
  const ppButton = productPageConfig?.button || {};
  const ppConversion = productPageConfig?.conversion || {};
  const ppSections = mergeProductSections(ppGeneral.sections || []);
  const ppSectionOrder = ppSections.length > 0 ? ppSections : null;
  const sectionContentMap = Object.fromEntries(ppSections.map(s => [s.id, s.content || {}]));

  // Resolve button icon from config
  const CtaIcon = getIconComponent(ppButton.icon);
  const ctaAnimation = ppButton.animation || 'none';
  const ppFormType = ppGeneral.formType || 'popup';
  const spacingPreset = SPACING_PRESETS[ppDesign.spacing] || SPACING_PRESETS.normal;
  const aiVisualTheme = buildAiVisualTheme({ store, design: ppDesign, product });
  const socialProofTheme = buildSectionVisualTheme('socialProof');
  const benefitsTheme = buildSectionVisualTheme('benefits');
  const trustTheme = buildSectionVisualTheme('trust');
  const problemTheme = buildSectionVisualTheme('problem', { useTextAsTitle: true });
  const solutionTheme = buildSectionVisualTheme('solution', { useTextAsTitle: true });
  const faqTheme = buildSectionVisualTheme('faq');
  const ctaBtnColor = ppDesign.ctaButtonColor || ppDesign.buttonColor || aiVisualTheme?.primary || 'var(--s-primary)';
  const ctaBorderRadius = ppDesign.ctaBorderRadius || ppDesign.borderRadius || '14px';
  const ctaButtonStyle = ppDesign.buttonStyle || 'filled';
  const ctaFontSize = Number.parseInt(ppDesign.buttonFontSize, 10) || ((Number.parseInt(ppDesign.fontBase, 10) || 14) + 3);
  const ctaFontWeight = Number.parseInt(ppDesign.fontWeight, 10) || 700;
  const ctaShadow = ppDesign.shadow === false
    ? 'none'
    : (ppDesign.buttonShadow
      ? `0 ${ppDesign.buttonShadow}px ${Number.parseInt(ppDesign.buttonShadow, 10) * 2}px rgba(0,0,0,0.12)`
      : '0 4px 16px rgba(0,0,0,0.12)');
  const ctaTextColor = ppDesign.buttonTextColor
    || ((ctaButtonStyle === 'outline' || ctaButtonStyle === 'soft') ? ctaBtnColor : '#fff');
  const badgeColor = ppDesign.badgeColor || aiVisualTheme?.accent || 'var(--s-badge)';
  const badgeStyle = ppDesign.badgeStyle || 'filled';

  const resolveCtaStyle = (enabled, compact = false) => {
    const style = {
      width: compact ? 'auto' : '100%',
      maxWidth: '100%',
      padding: compact ? '14px 18px' : '16px 20px',
      borderRadius: ctaBorderRadius,
      cursor: enabled ? 'pointer' : 'not-allowed',
      display: 'flex',
      flexDirection: compact ? 'row' : 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: compact ? 8 : 4,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      fontFamily: 'var(--s-font)',
      boxShadow: enabled ? ctaShadow : 'none',
      minHeight: compact ? 44 : 52,
      position: 'relative',
      overflow: 'hidden',
      fontWeight: ctaFontWeight,
      fontSize: compact ? Math.max(13, ctaFontSize - 2) : ctaFontSize,
      fontStyle: ppDesign.buttonItalic ? 'italic' : 'normal',
    };

    if (!enabled) {
      return {
        ...style,
        backgroundColor: '#d1d5db',
        color: '#fff',
        border: 'none',
      };
    }

    if (ppDesign.buttonBorderWidth && Number.parseInt(ppDesign.buttonBorderWidth, 10) > 0) {
      style.border = `${ppDesign.buttonBorderWidth} solid ${ppDesign.buttonBorderColor || 'transparent'}`;
    } else if (ctaButtonStyle === 'outline') {
      style.border = `2px solid ${ctaBtnColor}`;
    } else {
      style.border = 'none';
    }

    if (ctaButtonStyle === 'outline') {
      style.backgroundColor = 'transparent';
      style.color = ppDesign.buttonTextColor || ctaBtnColor;
      style.boxShadow = 'none';
      return style;
    }

    if (ctaButtonStyle === 'soft') {
      style.backgroundColor = withAlpha(ctaBtnColor, '18', 'rgba(15,107,79,0.10)');
      style.color = ppDesign.buttonTextColor || ctaBtnColor;
      return style;
    }

    if (ctaButtonStyle === 'gradient') {
      style.background = `linear-gradient(135deg, ${ctaBtnColor}, ${ppDesign.buttonColor || 'var(--s-accent)'})`;
      style.color = ctaTextColor;
      return style;
    }

    style.background = aiVisualTheme?.gradient && !ppDesign.ctaButtonColor && !ppDesign.buttonColor ? aiVisualTheme.gradient : ctaBtnColor;
    style.color = ctaTextColor;
    return style;
  };

  const resolveBadgeStyle = (tone = 'primary') => {
    const currentColor = tone === 'warning' ? '#F59E0B' : tone === 'danger' ? badgeColor : 'var(--s-primary)';
    const softBackground = tone === 'warning'
      ? '#FEF3C7'
      : tone === 'danger'
        ? '#FEF2F2'
        : withAlpha(ctaBtnColor, '14', 'rgba(15,107,79,0.12)');
    const softText = tone === 'warning' ? '#B45309' : currentColor;

    if (badgeStyle === 'outline') {
      return {
        fontSize: 13,
        fontWeight: 700,
        color: currentColor,
        padding: '4px 12px',
        borderRadius: ctaBorderRadius,
        backgroundColor: 'transparent',
        border: `1px solid ${currentColor}`,
      };
    }

    if (badgeStyle === 'soft') {
      return {
        fontSize: 13,
        fontWeight: 700,
        color: softText,
        padding: '4px 12px',
        borderRadius: ctaBorderRadius,
        backgroundColor: softBackground,
      };
    }

    if (badgeStyle === 'ribbon') {
      return {
        fontSize: 13,
        fontWeight: 700,
        color: '#fff',
        padding: '4px 12px',
        borderRadius: '0 999px 999px 0',
        backgroundColor: currentColor,
      };
    }

    return {
      fontSize: 13,
      fontWeight: 700,
      color: '#fff',
      padding: '4px 12px',
      borderRadius: ctaBorderRadius,
      backgroundColor: currentColor,
    };
  };

  const resolveThemeInfoCardStyle = (tone = 'neutral') => {
    const tonePalette = {
      neutral: {
        background: aiVisualTheme?.softGradient || withAlpha(ctaBtnColor, '10', 'rgba(15,107,79,0.06)'),
        border: aiVisualTheme?.softBorder || withAlpha(ctaBtnColor, '22', 'rgba(15,107,79,0.16)'),
        text: aiVisualTheme?.text || 'var(--s-text)',
        muted: aiVisualTheme?.mutedText || 'var(--s-text2)',
        iconBackground: withAlpha(ctaBtnColor, '18', 'rgba(15,107,79,0.12)'),
        iconColor: aiVisualTheme?.primary || ctaBtnColor,
        shadow: aiVisualTheme?.shadow || 'none',
      },
      success: {
        background: 'linear-gradient(180deg, rgba(15,107,79,0.09) 0%, rgba(15,107,79,0.04) 100%)',
        border: 'rgba(15,107,79,0.20)',
        text: '#0f6b4f',
        muted: 'rgba(15,107,79,0.80)',
        iconBackground: 'rgba(15,107,79,0.12)',
        iconColor: '#0f6b4f',
        shadow: 'none',
      },
      warning: {
        background: 'linear-gradient(180deg, rgba(245,158,11,0.16) 0%, rgba(245,158,11,0.08) 100%)',
        border: 'rgba(245,158,11,0.26)',
        text: '#b45309',
        muted: 'rgba(180,83,9,0.78)',
        iconBackground: 'rgba(245,158,11,0.16)',
        iconColor: '#b45309',
        shadow: 'none',
      },
      danger: {
        background: 'linear-gradient(180deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.06) 100%)',
        border: 'rgba(239,68,68,0.18)',
        text: '#ef4444',
        muted: 'rgba(239,68,68,0.78)',
        iconBackground: 'rgba(239,68,68,0.10)',
        iconColor: '#ef4444',
        shadow: 'none',
      },
    };

    const palette = tonePalette[tone] || tonePalette.neutral;

    return {
      container: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
        borderRadius: ctaBorderRadius,
        background: palette.background,
        border: `1px solid ${palette.border}`,
        boxShadow: palette.shadow,
      },
      content: {
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flex: 1,
      },
      iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: palette.iconBackground,
        color: palette.iconColor,
      },
      title: {
        fontSize: 13,
        fontWeight: 800,
        color: palette.text,
        lineHeight: 1.3,
        fontFamily: 'var(--s-font)',
      },
      subtitle: {
        marginTop: 3,
        fontSize: 12,
        color: palette.muted,
        lineHeight: 1.45,
        fontFamily: 'var(--s-font)',
      },
      value: {
        flexShrink: 0,
        padding: '6px 10px',
        borderRadius: 999,
        background: palette.iconBackground,
        color: palette.text,
        fontSize: 13,
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'var(--s-font)',
      },
    };
  };

  // Build ordered enabled section IDs for rendering
  const sectionToggleOverrides = {
    reviews: ppDesign.showReviews,
    productGallery: ppDesign.showProductGallery,
    relatedProducts: ppDesign.showRelatedProducts ?? showRelatedProductsFromStore,
    stockCounter: ppDesign.showStockIndicator,
    stickyOrderBar: ppDesign.stickyAddToCart,
    trustBadges: ppDesign.showTrustBadges,
    shareButtons: ppDesign.showShareButtons,
    deliveryInfo: ppDesign.showDeliveryInfo,
    secureBadge: ppDesign.showSecureBadge,
    countdownBar: ppDesign.showCountdown,
  };

  const enabledSectionIds = (() => {
    const ids = ppSectionOrder
      ? ppSectionOrder.filter(s => s.enabled).map(s => s.id)
      : ['heroSlogan', 'heroBaseline', 'reviews', 'stockCounter', 'urgencyBadge', 'countdownBar',
        'orderForm', 'productGallery', 'trustBadges', 'secureBadge', 'deliveryInfo', 'shareButtons', 'statsBar',
         'urgencyElements', 'benefitsBullets', 'conversionBlocks', 'offerBlock', 'description',
         'problemSection', 'solutionSection', 'faq', 'testimonials', 'relatedProducts',
         'stickyOrderBar', 'upsell', 'orderBump'];

    const insertAfterMap = {
      countdownBar: 'urgencyBadge',
      productGallery: 'orderForm',
      trustBadges: 'orderForm',
      secureBadge: 'trustBadges',
      deliveryInfo: 'secureBadge',
      shareButtons: 'deliveryInfo',
    };

    Object.entries(sectionToggleOverrides).forEach(([sectionId, enabled]) => {
      const existingIndex = ids.indexOf(sectionId);
      if (enabled === false && existingIndex >= 0) {
        ids.splice(existingIndex, 1);
      }
      if (enabled === true && existingIndex === -1) {
        const anchor = insertAfterMap[sectionId];
        const anchorIndex = anchor ? ids.indexOf(anchor) : -1;
        if (anchorIndex >= 0) ids.splice(anchorIndex + 1, 0, sectionId);
        else ids.push(sectionId);
      }
    });

    return ids;
  })();

  const showStickyBar = enabledSectionIds.includes('stickyOrderBar');
  const showRelatedProductsSetting = enabledSectionIds.includes('relatedProducts');
  const showTestimonials = enabledSectionIds.includes('testimonials');
  const showCountdownBarSetting = enabledSectionIds.includes('countdownBar');
  const ctaAnimClass = ctaAnimation === 'pulse' ? 'pp-pulse' : ctaAnimation === 'bounce' ? 'pp-bounce' : ctaAnimation === 'shake' ? 'pp-shake' : ctaAnimation === 'glow' ? 'pp-glow' : '';
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = product?.name ? `${product.name} - ${shareUrl}` : shareUrl;

  const handleShare = async () => {
    if (!shareUrl || typeof navigator === 'undefined') return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product?.name || store?.name || 'Produit',
          text: product?.name || '',
          url: shareUrl,
        });
        return;
      }
    } catch {}

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {}
  };

  useEffect(() => {
    if (!showCountdownBarSetting) {
      setCountdownSeconds(null);
      return;
    }

    const initialSeconds = Math.max(60, (Number.parseInt(ppConversion.countdownMinutes, 10) || 15) * 60);
    setCountdownSeconds(initialSeconds);
    const timer = window.setInterval(() => {
      setCountdownSeconds((currentValue) => (currentValue > 0 ? currentValue - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [showCountdownBarSetting, ppConversion.countdownMinutes, product?._id]);

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
    trackAddToCart(product?._id || product?.slug, product?.name, product?.price);
    trackStorefrontEvent({
      subdomain,
      pixels,
      eventName: 'AddToCart',
      params: {
        content_ids: [product?._id || product?.slug || ''],
        content_name: product?.name || '',
        value: product?.price || 0,
        currency: effectiveCurrency,
      },
    });
  };

  if (loading && !product) return (
    <div style={{ minHeight: '100vh', background: 'var(--s-bg, #fff)', fontFamily: 'var(--s-font, sans-serif)' }}>
      <style>{`
        @keyframes skel-shine { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .skel { background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%); background-size:800px 100%; animation:skel-shine 1.4s ease infinite; border-radius:8px; }
      `}</style>
      {/* Header skeleton */}
      <div style={{ height: 60, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <div className="skel" style={{ width: 40, height: 40, borderRadius: 10 }} />
        <div className="skel" style={{ width: 120, height: 18 }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div className="skel" style={{ width: 64, height: 32, borderRadius: 8 }} />
        </div>
      </div>
      {/* Product skeleton */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px', display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        {/* Gallery placeholder */}
        <div className="skel" style={{ width: '100%', aspectRatio: '1/1', maxHeight: '70vw', borderRadius: 16 }} />
        {/* Info placeholder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skel" style={{ width: '80%', height: 32, borderRadius: 8 }} />
          <div className="skel" style={{ width: '55%', height: 22, borderRadius: 8 }} />
          <div className="skel" style={{ width: '40%', height: 36, borderRadius: 8, marginTop: 8 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <div className="skel" style={{ width: '100%', height: 14 }} />
            <div className="skel" style={{ width: '90%', height: 14 }} />
            <div className="skel" style={{ width: '70%', height: 14 }} />
          </div>
          <div className="skel" style={{ width: '100%', height: 56, borderRadius: 14, marginTop: 16 }} />
        </div>
      </div>
    </div>
  );

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

  if (ppTheme === 'infographics') {
    return (
      <StoreProductPageInfographics
        product={product}
        store={store}
        productPageConfig={productPageConfig}
        subdomain={subdomain}
      />
    );
  }

  return (
    <div className={ppTheme === 'landing' ? 'theme-landing-active' : ''} style={{
      minHeight: '100vh',
      background: 'var(--s-bg)',
      fontFamily: 'var(--s-font)',
      color: 'var(--s-text)',
      fontSize: 'var(--s-font-base)',
      overflowX: 'hidden',
      maxWidth: '100vw',
      width: '100%',
      '--pp-gap': spacingPreset.gap,
      '--pp-mobile-info-padding': spacingPreset.mobileInfoPadding,
      '--pp-desktop-info-padding': spacingPreset.desktopInfoPadding,
      '--pp-landing-padding': spacingPreset.landingPadding,
      '--pp-card-radius': ctaBorderRadius,
      '--ai-primary': aiVisualTheme?.primary || 'var(--s-primary)',
      '--ai-accent': aiVisualTheme?.accent || 'var(--s-accent, var(--s-primary))',
      '--ai-bg': aiVisualTheme?.background || 'var(--s-bg)',
      '--ai-surface': aiVisualTheme?.surface || '#ffffff',
      '--ai-text': aiVisualTheme?.text || 'var(--s-text)',
      '--ai-muted': aiVisualTheme?.mutedText || 'var(--s-text2)',
      '--ai-border': aiVisualTheme?.border || 'var(--s-border)',
      '--ai-soft-border': aiVisualTheme?.softBorder || 'var(--s-border)',
      '--ai-gradient': aiVisualTheme?.gradient || 'linear-gradient(135deg, var(--s-primary), var(--s-primary))',
      '--ai-soft-gradient': aiVisualTheme?.softGradient || 'var(--s-bg)',
      '--ai-shadow': aiVisualTheme?.shadow || '0 10px 30px rgba(0,0,0,0.08)',
    }}>
      <style>{`
        *{box-sizing:border-box} body{margin:0;padding:0}
        html,body{ overflow-x:hidden; max-width:100vw; }
        .sf-no-scrollbar { scrollbar-width:none; -ms-overflow-style:none; }
        .sf-no-scrollbar::-webkit-scrollbar { display:none; }
        img { max-width:100%; height:auto; }
        @keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        /* Button animations from product page config */
        .pp-pulse { animation: pp-pulse-kf 2s ease-in-out infinite; }
        .pp-bounce { animation: pp-bounce-kf 1s ease infinite; }
        .pp-shake { animation: pp-shake-kf 0.6s ease-in-out infinite; }
        .pp-glow { animation: pp-glow-kf 2s ease-in-out infinite; }
        @keyframes pp-pulse-kf { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
        @keyframes pp-bounce-kf { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes pp-shake-kf { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
        @keyframes pp-glow-kf { 0%,100%{box-shadow:0 0 5px rgba(255,255,255,0.2)} 50%{box-shadow:0 0 20px rgba(255,255,255,0.5)} }

        /* ═══ GLOBAL CONTAINMENT ═══ */
        .product-grid { overflow:hidden; width:100%; max-width:100%; }
        .product-gallery { overflow:hidden; max-width:100%; }
        .product-info { overflow:hidden; max-width:100%; word-wrap:break-word; overflow-wrap:break-word; }
        .product-info button { max-width:100%; }

        /* ═══ THEME: CLASSIC ═══ */
        .product-grid.theme-classic { display:grid; grid-template-columns:1fr; gap:0; align-items:start; }
        .theme-classic .product-gallery { position:relative; }
        .theme-classic .product-info { padding:var(--pp-mobile-info-padding) var(--pp-mobile-info-padding) 48px; }
        @media(min-width:769px){
          .product-grid.theme-classic { grid-template-columns:1fr 1fr; gap:var(--pp-gap); }
          .theme-classic .product-gallery { position:sticky; top:72px; max-height:75vh; overflow-y:auto; }
          .theme-classic .product-info { padding:0 var(--pp-desktop-info-padding) 48px 0; }
        }

        .ai-gallery-frame {
          position:relative;
          padding:12px;
          border-radius:calc(var(--pp-card-radius) + 10px);
          background:var(--ai-soft-gradient);
          border:1px solid var(--ai-soft-border);
          box-shadow:var(--ai-shadow);
          overflow:hidden;
        }
        .ai-gallery-frame::before {
          content:'';
          position:absolute;
          inset:-15% auto auto -10%;
          width:180px;
          height:180px;
          border-radius:999px;
          background:radial-gradient(circle, rgba(255,255,255,0.65) 0%, transparent 70%);
          pointer-events:none;
          opacity:0.7;
        }
        /* ═══ THEME: LANDING PAGE ═══ */
        .product-grid.theme-landing { display:flex; flex-direction:column; gap:0; background:var(--ai-bg, #fff); }
        .theme-landing .product-gallery { position:relative; width:100%; height:60vh; min-height:360px; overflow:hidden; }
        .theme-landing .product-gallery img { width:100%; height:100%; object-fit:cover; object-position:center; }
        .theme-landing .product-gallery .thumb-track, .theme-landing .product-gallery .dots-track { display:none !important; }
        .theme-landing .product-gallery button { display:none !important; } /* Hide gallery arrows on landing */
        .theme-landing .product-gallery::after {
          content:''; position:absolute; bottom:0; left:0; right:0; height:35vh;
          background:linear-gradient(to top, var(--ai-bg, #fff) 0%, rgba(255,255,255,0.8) 40%, transparent 100%); pointer-events:none; z-index:5;
        }
        .theme-landing .product-info {
          padding:0 var(--pp-landing-padding) 80px; max-width:850px; margin:0 auto; width:100%; position:relative; z-index:10; margin-top:-15vh;
        }
        /* Top-level header elements centered */
        .theme-landing h1, .theme-landing .price-wrapper, .theme-landing .hero-slogan, .theme-landing .hero-baseline { text-align:center !important; justify-content:center !important; }
        .theme-landing h1 { font-size:clamp(28px, 6vw, 64px) !important; margin-bottom:20px !important; line-height:1.05 !important; letter-spacing:-0.04em !important; }
        .theme-landing .price-wrapper span:first-child { font-size:clamp(24px, 7vw, 42px) !important; }
        /* Blocks */
        .theme-landing .ai-desc { text-align:left; margin-top:40px; background:var(--ai-bg, #fff); padding:0; }
        .theme-landing .ai-desc h3 { text-align:center; font-size:clamp(20px, 4vw, 28px) !important; margin:40px 0 24px !important; }
        .theme-landing .ai-desc p { font-size:clamp(14px, 2.5vw, 17px) !important; line-height:1.8 !important; }
        .theme-landing .ai-desc img { border-radius:16px; margin:32px 0 !important; box-shadow:0 12px 32px rgba(0,0,0,0.08); }
        .theme-landing .order-btn-wrapper button { min-height:64px !important; font-size:clamp(16px, 3vw, 20px) !important; border-radius:100px !important; }
        @media(min-width:769px){
          .theme-landing .product-gallery { height:75vh; min-height:500px; }
          .theme-landing .product-info { padding:0 calc(var(--pp-landing-padding) + 8px) 100px; margin-top:-20vh; }
        }
        /* Hide navbar completely for landing pages to remove distractions */
        .theme-landing-active .sf-header { display:none !important; }

        /* ═══ THEME: MAGAZINE ═══ */
        .product-grid.theme-magazine { display:flex; flex-direction:column; gap:0; position:relative; }
        .theme-magazine .product-gallery { position:relative; max-height:75vh; overflow:hidden; }
        .theme-magazine .product-gallery::after {
          content:''; position:absolute; bottom:0; left:0; right:0; height:40%;
          background:linear-gradient(transparent, var(--s-bg)); pointer-events:none;
        }
        .theme-magazine .product-info {
          position:relative; z-index:2; margin:-60px 12px 0; padding:24px var(--pp-mobile-info-padding) 48px;
          background:var(--ai-bg, var(--s-bg)); border-radius:var(--pp-card-radius) var(--pp-card-radius) 0 0;
          box-shadow:var(--ai-shadow);
        }
        @media(min-width:769px){
          .theme-magazine .product-gallery { max-height:80vh; }
          .theme-magazine .product-info {
            margin:-100px auto 0; max-width:720px; padding:40px calc(var(--pp-desktop-info-padding) + 16px) 60px;
            border-radius:var(--pp-card-radius) var(--pp-card-radius) 0 0; box-shadow:0 -12px 60px rgba(0,0,0,0.1);
          }
        }

        .ai-desc h2 { font-size:16px; font-weight:800; color:var(--s-text); margin:16px 0 8px; line-height:1.3; }
        .ai-desc h3 { font-size:15px; font-weight:800; color:var(--s-text); margin:12px 0 8px; line-height:1.3; }
        .ai-desc h2 strong, .ai-desc h3 strong { font-weight:800; }
        .ai-desc p { font-size:14px; line-height:1.75; color:var(--s-text2); margin:0 0 10px; word-wrap:break-word; overflow-wrap:break-word; }
        .ai-desc img { width:auto !important; max-width:100% !important; height:auto !important; aspect-ratio:auto !important; object-fit:contain !important; display:block; margin:0; }
        .ai-desc ul, .ai-desc ol { margin:0 0 10px; padding:0 0 0 16px; }
        .ai-desc ul { list-style:disc; }
        .ai-desc ul li, .ai-desc ol li { font-size:13.5px; line-height:1.6; color:var(--s-text2); margin-bottom:4px; }
        .ai-desc div { margin:0; padding:0; background:none !important; border:none !important; border-radius:0 !important; }
        .ai-desc section { margin:0 0 16px; padding:0; background:none !important; border:none !important; }
        .product-info.ai-themed {
          position: relative;
        }
        .product-info.ai-themed::before {
          content:'';
          position:absolute;
          inset:0;
          background:var(--ai-soft-gradient);
          border:1px solid var(--ai-soft-border);
          border-radius:calc(var(--pp-card-radius) + 8px);
          pointer-events:none;
          opacity:0.9;
        }
        .product-info.ai-themed::after {
          content:'';
          position:absolute;
          top:20px;
          right:16px;
          width:160px;
          height:160px;
          border-radius:999px;
          background:radial-gradient(circle, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 68%);
          opacity:0.55;
          pointer-events:none;
        }
        .product-info.ai-themed > * {
          position:relative;
          z-index:1;
        }
        @media(min-width:769px){
          .ai-desc h2 { font-size:18px; }
          .ai-desc h3 { font-size:16px; }
          .ai-desc p { font-size:14.5px; }
          .ai-desc ul li, .ai-desc ol li { font-size:14px; }
        }
        /* Mobile-specific fixes */
        @media(max-width:480px){
          .sf-nav-link { display:none !important; }
          .product-info h1 { font-size:clamp(22px, 6vw, 32px) !important; }
          .price-wrapper { flex-wrap:wrap !important; }
        }
        @media(max-width:360px){
          .product-info { padding-left:10px !important; padding-right:10px !important; }
        }
      `}</style>

      {/* Barre d'annonce défilante */}
      {store?.announcementEnabled && store?.announcement && (
        <div style={{
          backgroundColor: 'var(--s-primary)',
          color: '#fff',
          padding: '10px 0',
          overflow: 'hidden',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--s-font)',
          whiteSpace: 'nowrap',
        }}>
          <div style={{
            display: 'inline-block',
            animation: 'sp-marquee 18s linear infinite',
          }}>
            <span>{store.announcement}</span>
            <span style={{ padding: '0 60px' }}>✦</span>
            <span>{store.announcement}</span>
            <span style={{ padding: '0 60px' }}>✦</span>
          </div>
          <style>{`@keyframes sp-marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }`}</style>
        </div>
      )}

      <div className="sf-header">
        <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />
      </div>

      {/* Product Detail */}
      <div style={{ maxWidth: ppTheme === 'landing' || ppTheme === 'magazine' ? '100%' : 1200, margin: '0 auto', padding: '0', overflow: 'hidden', width: '100%' }}>
        <div className={`product-grid theme-${ppTheme}`}>
          {/* ── Gallery ────────────────────────────────────────────────────── */}
          <div className="product-gallery">
            <div className="ai-gallery-frame">
              <ImageGallery images={images} design={ppDesign} />
            </div>
          </div>

          {/* ── Right: Info ───────────────────────────────────────────────── */}
          <div className={`product-info ${aiVisualTheme ? 'ai-themed' : ''}`}>
            {product ? (
              <>
                {/* Name */}
                <h1 style={{
                  fontSize: `clamp(${Math.max(24, (Number.parseInt(ppDesign.fontBase, 10) || 14) + 12)}px, 4vw, ${Math.max(36, (Number.parseInt(ppDesign.fontBase, 10) || 14) + 24)}px)`, fontWeight: 900,
                  color: 'var(--s-text)', margin: '8px 0 8px',
                  lineHeight: 1.1, letterSpacing: '-0.03em', fontFamily: 'var(--s-font)',
                }}>
                  {product.name}
                </h1>

                {/* Hero slogan / baseline from AI or config content */}
                {enabledSectionIds.includes('heroSlogan') && (sectionContentMap.heroSlogan?.text || product._pageData?.hero_slogan) && (
                  <p className="hero-slogan" style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--s-text2)', fontFamily: 'var(--s-font)', lineHeight: 1.5 }}>
                    {sectionContentMap.heroSlogan?.text || product._pageData.hero_slogan}
                  </p>
                )}
                {enabledSectionIds.includes('heroBaseline') && (sectionContentMap.heroBaseline?.text || product._pageData?.hero_baseline) && (
                  <p className="hero-baseline" style={{ margin: '0 0 10px', fontSize: 13, color: aiVisualTheme?.primary || 'var(--s-primary)', fontWeight: 700, fontFamily: 'var(--s-font)' }}>
                    ✅ {sectionContentMap.heroBaseline?.text || product._pageData.hero_baseline}
                  </p>
                )}

                {/* Price — always shown */}
                <div className="price-wrapper" style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 900, color: aiVisualTheme?.primary || 'var(--s-primary)', fontFamily: 'var(--s-font)', letterSpacing: '-0.02em' }}>
                    {fmt(product.price, effectiveCurrency)}
                  </span>
                  {hasDiscount && (
                    <>
                      <span style={{ fontSize: 'clamp(13px, 3.5vw, 17px)', color: 'var(--s-text2)', textDecoration: 'line-through', fontFamily: 'var(--s-font)', whiteSpace: 'nowrap' }}>
                        {fmt(product.compareAtPrice, effectiveCurrency)}
                      </span>
                      <span style={{ ...resolveBadgeStyle('danger'), fontSize: 12, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                        -{pct}%
                      </span>
                    </>
                  )}
                </div>

                {/* Sections rendered in config order */}
                {enabledSectionIds.map(sectionId => {
                  switch (sectionId) {
                    case 'reviews': {
                      const revCustom = sectionContentMap.reviews || {};
                      const revRating = revCustom.rating || product.rating || 4.5;
                      const revCount = revCustom.reviewCount || product.reviewCount || 0;
                      return <ProductReviews key={sectionId} rating={revRating} reviewCount={revCount} />;
                    }

                    case 'orderForm': {
                      // Build variants from product.variants or _pageData.fashionConfig
                      const fashionConfig = product?._pageData?.fashionConfig;
                      const productVariants = product?.variants || (
                        fashionConfig && (fashionConfig.sizes?.length || fashionConfig.colors?.length) ? [
                          ...(fashionConfig.sizes?.length ? [{ name: 'Taille', options: fashionConfig.sizes.map(s => s.startsWith('p') ? s.slice(1) : s) }] : []),
                          ...(fashionConfig.colors?.length ? [{ name: 'Couleur', options: fashionConfig.colors.map(c => c.name), swatches: fashionConfig.colors }] : []),
                        ] : null
                      );
                      return (
                        <div key={sectionId} style={{ marginBottom: 20 }}>
                          {/* ── Variant selectors ── */}
                          {productVariants?.length > 0 && (
                            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {productVariants.map(variant => (
                                <div key={variant.name}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>{variant.name}</span>
                                    {selectedVariants[variant.name] && (
                                      <span style={{ fontSize: 12, fontWeight: 600, color: aiVisualTheme?.primary || 'var(--s-primary)' }}>{selectedVariants[variant.name]}</span>
                                    )}
                                  </div>
                                  {variant.swatches?.length ? (
                                    // Color swatches
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                      {variant.swatches.map(swatch => {
                                        const isSelected = selectedVariants[variant.name] === swatch.name;
                                        return (
                                          <button
                                            key={swatch.name}
                                            type="button"
                                            title={swatch.name}
                                            onClick={() => setSelectedVariants(prev => ({ ...prev, [variant.name]: isSelected ? undefined : swatch.name }))}
                                            style={{
                                              width: 32, height: 32, borderRadius: '50%',
                                              backgroundColor: swatch.hex,
                                              border: isSelected ? `3px solid ${aiVisualTheme?.primary || 'var(--s-primary)'}` : '3px solid transparent',
                                              outline: isSelected ? `2px solid ${aiVisualTheme?.primary || 'var(--s-primary)'}` : '2px solid #e5e7eb',
                                              outlineOffset: isSelected ? 2 : 1,
                                              cursor: 'pointer',
                                              transition: 'all 0.15s',
                                              boxSizing: 'border-box',
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    // Size pills
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                      {variant.options.map(option => {
                                        const isSelected = selectedVariants[variant.name] === option;
                                        return (
                                          <button
                                            key={option}
                                            type="button"
                                            onClick={() => setSelectedVariants(prev => ({ ...prev, [variant.name]: isSelected ? undefined : option }))}
                                            style={{
                                              padding: '5px 13px',
                                              borderRadius: 8,
                                              fontSize: 13,
                                              fontWeight: isSelected ? 700 : 500,
                                              cursor: 'pointer',
                                              transition: 'all 0.15s',
                                              border: `1.5px solid ${isSelected ? (aiVisualTheme?.primary || 'var(--s-primary)') : '#e5e7eb'}`,
                                              backgroundColor: isSelected ? (aiVisualTheme?.primary || 'var(--s-primary)') : '#fff',
                                              color: isSelected ? '#fff' : '#374151',
                                            }}
                                          >
                                            {option}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* ── CTA / Order form ── */}
                          <div className="order-btn-wrapper" ref={ctaButtonsRef}>
                          {ppFormType === 'embedded' && inStock ? (
                            <EmbeddedOrderForm
                              product={product}
                              subdomain={subdomain}
                              store={store}
                              productPageConfig={productPageConfig}
                            />
                          ) : (
                            <button
                              onClick={openOrderModal}
                              disabled={!inStock}
                              className={ctaAnimClass}
                              onMouseEnter={(e) => {
                                if (inStock) { e.currentTarget.style.transform = 'scale(1.02)'; if (ctaShadow !== 'none') e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }
                              }}
                              onMouseLeave={(e) => {
                                if (inStock) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = ctaShadow; }
                              }}
                              style={resolveCtaStyle(inStock)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <CtaIcon size={18} /> {ppButton.text || 'Commander maintenant'}
                              </div>
                              <span style={{ fontSize: '12px', opacity: 0.9, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Truck size={10} /> {ppButton.subtext || 'Paiement à la livraison'}
                              </span>
                            </button>
                          )}
                          </div>
                        </div>
                      );
                    }

                    case 'productGallery': {
                      const galleryConfig = normalizeProductGalleryConfig(sectionContentMap.productGallery || {});
                      const galleryImages = resolveProductGalleryImages(galleryConfig, buildProductGalleryFallbackImages(product));
                      return (
                        <LazySection key={sectionId} minHeight={180}>
                          <InlinePhotoCarousel
                            images={galleryImages}
                            config={galleryConfig}
                            accentColor={aiVisualTheme?.primary || 'var(--s-primary)'}
                          />
                        </LazySection>
                      );
                    }

                    case 'countdownBar':
                      if (countdownSeconds === null || !inStock) return null;
                      {
                        const countdownCardStyle = resolveThemeInfoCardStyle('danger');
                        return (
                          <div key={sectionId} style={{ marginBottom: 14 }}>
                            <div style={countdownCardStyle.container}>
                              <div style={countdownCardStyle.content}>
                                <div style={countdownCardStyle.iconWrap}>
                                  <span style={{ fontSize: 16, lineHeight: 1 }}>!</span>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={countdownCardStyle.title}>Offre limitée</div>
                                  <div style={countdownCardStyle.subtitle}>Cette offre spéciale expire bientôt.</div>
                                </div>
                              </div>
                              <span style={countdownCardStyle.value}>{formatCountdown(countdownSeconds)}</span>
                            </div>
                          </div>
                        );
                      }

                    case 'trustBadges':
                      return <TrustBadges key={sectionId} compact accentColor={trustTheme.primary} />;

                    case 'secureBadge':
                      return (
                        <div key={sectionId} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                          <Shield size={12} color={trustTheme.primary} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 11.5, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}>Paiement 100% sécurisé</span>
                        </div>
                      );

                    case 'deliveryInfo':
                      return (
                        <div key={sectionId} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                          <Truck size={12} color={trustTheme.primary} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 11.5, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}>Livraison 2–4 jours · Paiement à la livraison</span>
                        </div>
                      );

                    case 'shareButtons':
                      return (
                        <div key={sectionId} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          {showWhatsappButton && (
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '10px 14px', borderRadius: ctaBorderRadius,
                                backgroundColor: '#25D366', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700,
                              }}
                            >
                              <MessageCircle size={15} /> WhatsApp
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={handleShare}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 8,
                              padding: '10px 14px', borderRadius: ctaBorderRadius,
                              border: '1px solid var(--s-border)', backgroundColor: '#fff', color: 'var(--s-text)', fontSize: 13, fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Share2 size={15} /> Partager
                          </button>
                        </div>
                      );

                    case 'statsBar': {
                      const customStats = sectionContentMap.statsBar?.stats?.filter(st => st.value && st.label);
                      const statsData = customStats?.length > 0 ? customStats : product._pageData?.stats_bar;
                      return statsData?.length > 0
                        ? <StatsBar key={sectionId} stats={statsData} visualTheme={socialProofTheme} />
                        : null;
                    }

                    case 'stockCounter':
                      {
                        const stockTone = !inStock ? 'danger' : lowStock ? 'warning' : 'success';
                        const stockCardStyle = resolveThemeInfoCardStyle(stockTone);
                        const stockTitle = !inStock ? 'Rupture de stock' : lowStock ? `Plus que ${product.stock} en stock` : 'En stock';
                        const stockSubtitle = !inStock
                          ? 'Ce produit est temporairement indisponible.'
                          : lowStock
                            ? 'Les dernières unités sont disponibles.'
                            : 'Produit disponible immédiatement.';

                        return (
                          <div key={sectionId} style={{ marginBottom: 10 }}>
                            <div style={stockCardStyle.container}>
                              <div style={stockCardStyle.content}>
                                <div style={stockCardStyle.iconWrap}>
                                  <Check size={16} color={stockTone === 'danger' ? '#ef4444' : stockTone === 'warning' ? '#b45309' : '#0f6b4f'} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={stockCardStyle.title}>{stockTitle}</div>
                                  <div style={stockCardStyle.subtitle}>{stockSubtitle}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                    case 'urgencyBadge': {
                      const urgencyText = sectionContentMap.urgencyBadge?.text || product._pageData?.urgency_badge;
                      return urgencyText && inStock ? (
                        <div key={sectionId} style={{ marginBottom: 10 }}>
                          <span style={{ ...resolveBadgeStyle('danger'), boxShadow: aiVisualTheme?.shadow || 'none' }}>
                            {urgencyText}
                          </span>
                        </div>
                      ) : null;
                    }

                    case 'urgencyElements': {
                      const ueCustom = sectionContentMap.urgencyElements || {};
                      const ueAi = product._pageData?.urgency_elements;
                      const ueData = (ueCustom.stockLimited != null || ueCustom.socialProofCount || ueCustom.quickResult)
                        ? ueCustom
                        : ueAi;
                      return ueData ? (
                        <UrgencyBadge key={sectionId}
                          stockLimited={ueData.stockLimited ?? ueData.stock_limited}
                          socialProofCount={ueData.socialProofCount ?? ueData.social_proof_count}
                          quickResult={ueData.quickResult ?? ueData.quick_result}
                        />
                      ) : null;
                    }

                    case 'benefitsBullets': {
                      const customBullets = sectionContentMap.benefitsBullets?.items?.filter(Boolean);
                      const bulletsData = customBullets?.length > 0 ? customBullets : product._pageData?.benefits_bullets;
                      return bulletsData?.length > 0 ? (
                        <ProductBenefits key={sectionId} benefits={bulletsData} title="" compact accentColor={benefitsTheme.primary} borderColor={benefitsTheme.softBorder} surfaceColor={benefitsTheme.softGradient} textColor={benefitsTheme.text} />
                      ) : null;
                    }

                    case 'conversionBlocks': {
                      const cbCustom = sectionContentMap.conversionBlocks?.items?.filter(b => b?.text);
                      const cbData = cbCustom?.length > 0 ? cbCustom : product._pageData?.conversion_blocks;
                      return cbData?.length > 0 ? (
                        <ConversionBlocks key={sectionId} blocks={cbData} compact iconColor={trustTheme.primary} borderColor={trustTheme.softBorder} backgroundColor={trustTheme.softGradient} textColor={trustTheme.text} />
                      ) : null;
                    }

                    case 'offerBlock': {
                      const sc = sectionContentMap.offerBlock || {};
                      const aiBlock = product._pageData?.offer_block;
                      const mergedBlock = (aiBlock || sc.offerLabel || sc.guaranteeText) ? {
                        offer_label: sc.offerLabel || aiBlock?.offer_label || 'Offre spéciale',
                        guarantee_text: sc.guaranteeText || aiBlock?.guarantee_text,
                      } : null;
                      return mergedBlock ? <OfferBlock key={sectionId} block={mergedBlock} visualTheme={trustTheme} /> : null;
                    }

                    case 'description': {
                      const descCustom = sectionContentMap.description?.text?.trim();
                      const raw = descCustom || product.description?.toString().trim() || '';
                      return raw ? (
                        <div key={sectionId} style={{ borderTop: '1px solid var(--s-border)', marginTop: 8, paddingTop: 16, paddingBottom: 8 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--s-text)', fontFamily: 'var(--s-font)', marginBottom: 12 }}>
                            Description du produit
                          </div>
                          <ProductDescription content={raw} />
                        </div>
                      ) : null;
                    }

                    case 'problemSection': {
                      const sc = sectionContentMap.problemSection || {};
                      const aiSection = product._pageData?.problem_section;
                      const customPainPoints = sc.painPoints?.filter(Boolean);
                      const mergedSection = (aiSection || sc.title || customPainPoints?.length > 0) ? {
                        title: sc.title || aiSection?.title || 'Le problème',
                        pain_points: customPainPoints?.length > 0 ? customPainPoints : aiSection?.pain_points,
                      } : null;
                      return mergedSection ? <ProblemSection key={sectionId} section={mergedSection} visualTheme={problemTheme} /> : null;
                    }

                    case 'solutionSection': {
                      const sc = sectionContentMap.solutionSection || {};
                      const aiSection = product._pageData?.solution_section;
                      const mergedSection = (aiSection || sc.title || sc.description) ? {
                        title: sc.title || aiSection?.title || 'La solution',
                        description: sc.description || aiSection?.description,
                      } : null;
                      return mergedSection ? <SolutionSection key={sectionId} section={mergedSection} visualTheme={solutionTheme} /> : null;
                    }

                    case 'faq': {
                      const raw2 = product.description?.toString().trim() || '';
                      const hasHtml2 = raw2 && /<[^>]+>/.test(raw2);
                      const customFaq = sectionContentMap.faq?.faqItems?.filter(f => f.question && f.answer);
                      const faqItems = customFaq?.length > 0
                        ? customFaq
                        : product.faq?.length > 0
                          ? product.faq
                          : (hasHtml2 ? extractFaqItemsFromHtml(raw2) : []);
                      return faqItems.length > 0
                        ? <LazySection key={sectionId} minHeight={120}><ProductFaqAccordion items={faqItems} visualTheme={faqTheme} /></LazySection>
                        : null;
                    }

                    case 'upsell':
                    case 'orderBump':
                      // These are rendered inline (not standalone components yet)
                      return null;

                    // heroSlogan, heroBaseline, testimonials, relatedProducts, stickyOrderBar
                    // are rendered separately (outside this loop)
                    default:
                      return null;
                  }
                })}

              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Témoignages clients ── full-width ──────────────── */}
      {showTestimonials && (() => {
        // Priority: custom testimonials from builder > AI-generated > product > country defaults
        const testimonialsSection = productPageConfig?.general?.sections?.find(s => s.id === 'testimonials');
        const customT = testimonialsSection?.content?.items;
        const t = (customT?.length > 0)
          ? customT
          : product?._pageData?.testimonials?.length > 0
            ? product._pageData.testimonials
            : product?.testimonials?.length > 0
              ? product.testimonials
              : getDefaultTestimonials(product?.country || store?.country);
        const prodImg = product?.images?.[0]?.url || product?.images?.[0] || product?._pageData?.heroImage || null;
        const groupImg = product?._pageData?.testimonialsGroupImage || null;
        const socialImg = product?._pageData?.testimonialsSocialProofImage || null;
        return (
          <LazySection minHeight={200}>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', overflow: 'hidden' }}>
              <ProductTestimonials testimonials={t} productImage={prodImg} groupImage={groupImg} socialProofImage={socialImg} visualTheme={socialProofTheme} />
            </div>
          </LazySection>
        );
      })()}

      {/* ── Related Products ───────────────────────────────────────────────── */}
      {showRelatedProductsSetting && related.length > 0 && (
        <LazySection minHeight={180} style={{ maxWidth: 1200, margin: '48px auto 0', padding: '0 16px', overflow: 'hidden' }}>
          <section>
            <h2 style={{
              fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 800, color: 'var(--s-text)',
              margin: '0 0 20px', letterSpacing: '-0.02em', fontFamily: 'var(--s-font)',
            }}>
              Vous aimerez aussi
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(140px, 45%), 1fr))', gap: 12 }}>
              {related.map(p => <RelatedCard key={p._id} product={p} prefix={prefix} store={store} subdomain={store?.subdomain} />)}
            </div>
          </section>
        </LazySection>
      )}

      {showStickyBar && showStickyOrderBar && product && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70,
          padding: '10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)',
          background: aiVisualTheme?.background ? `linear-gradient(180deg, ${withAlpha(aiVisualTheme.background, 'F2', 'rgba(255,255,255,0.95)')} 0%, ${withAlpha(aiVisualTheme.surface, 'FA', 'rgba(255,255,255,0.98)')} 100%)` : 'rgba(255,255,255,0.96)',
          borderTop: `1px solid ${aiVisualTheme?.softBorder || 'var(--s-border)'}`,
          boxShadow: aiVisualTheme?.shadow || '0 -8px 24px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'slide-up 0.2s ease-out',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--s-text2)', fontFamily: 'var(--s-font)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 'clamp(14px, 3.5vw, 17px)', fontWeight: 800, color: aiVisualTheme?.primary || 'var(--s-primary)', fontFamily: 'var(--s-font)' }}>
                {fmt(product.price, effectiveCurrency)}
              </p>
            </div>
            <button
              onClick={() => {
                if (ppFormType === 'embedded') {
                  ctaButtonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                  openOrderModal();
                }
              }}
              disabled={!inStock}
              style={{ ...resolveCtaStyle(inStock, true), whiteSpace: 'nowrap', flexShrink: 0, maxWidth: '55%', fontSize: 'clamp(13px, 3vw, 16px)' }}
            >
              {ppButton.text || 'Commander'}
            </button>
          </div>
        </div>
      )}

      <StorefrontFooter store={store} prefix={prefix} />

      {/* Quick Order Modal */}
      {product && (
        <QuickOrderModal
          isOpen={showOrderModal}
          product={product}
          store={store}
          subdomain={subdomain}
          onClose={() => setShowOrderModal(false)}
          productPageConfig={productPageConfig}
          selectedVariants={selectedVariants}
        />
      )}
    </div>
  );
};

export default StoreProductPage;
