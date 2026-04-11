import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Save, Eye, EyeOff, Plus, Trash2, GripVertical,
  ChevronUp, ChevronDown, ChevronLeft, Settings, Code, Star, MessageSquare,
  HelpCircle, Zap, Image, Type, Layout, Copy, CheckCircle,
  AlertCircle, Loader2, Layers, Smartphone, Monitor, X,
  ChevronRight, Package, ShoppingCart, BarChart3, Box, Flame,
  Clock, Shield, Gift, FileText, Frown, Lightbulb, Link2,
  Pin, Rocket, MousePointerClick, Upload
} from 'lucide-react';
import { storeProductsApi, storeManageApi } from '../services/storeApi.js';
import { useStore } from '../contexts/StoreContext.jsx';
import defaultConfig from '../components/productSettings/defaultConfig.js';
import { formatMoney } from '../utils/currency.js';

// ─── Section metadata for the 20 productPageConfig sections ──────────────────
const SECTION_META = {
  heroSlogan:       { label: 'Slogan marketing IA',       desc: 'Slogan persuasif sous le titre',     icon: Type,         color: 'bg-green-100 text-green-700 border-green-200' },
  heroBaseline:     { label: 'Phrase de réassurance IA',   desc: 'Phrase de réassurance sous le titre', icon: CheckCircle,  color: 'bg-green-100 text-green-700 border-green-200' },
  reviews:          { label: 'Avis clients',              desc: 'Étoiles et nombre d\'avis',           icon: Star,         color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  productGallery:   { label: 'Photos du produit',         desc: 'Titre, photos et tailles',            icon: Image,        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  statsBar:         { label: 'Barre de stats sociales',   desc: 'Chiffres de preuve sociale',          icon: BarChart3,    color: 'bg-purple-100 text-purple-700 border-purple-200' },
  stockCounter:     { label: 'Compteur de stock',         desc: 'Stock restant urgence',               icon: Box,          color: 'bg-orange-100 text-orange-700 border-orange-200' },
  urgencyBadge:     { label: 'Badge d\'urgence',          desc: 'Badge d\'urgence IA',                 icon: Flame,        color: 'bg-red-100 text-red-700 border-red-200' },
  urgencyElements:  { label: 'Éléments d\'urgence',       desc: 'Stock limité, preuve sociale',        icon: Clock,        color: 'bg-red-100 text-red-700 border-red-200' },
  benefitsBullets:  { label: 'Bénéfices produit',         desc: 'Liste des bénéfices',                 icon: Zap,          color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  conversionBlocks: { label: 'Blocs de réassurance',      desc: 'Blocs de réassurance',                icon: Shield,       color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  offerBlock:       { label: 'Bloc garantie / offre',     desc: 'Garantie / offre spéciale',           icon: Gift,         color: 'bg-pink-100 text-pink-700 border-pink-200' },
  description:      { label: 'Description produit',       desc: 'Description complète',                icon: FileText,     color: 'bg-gray-100 text-gray-700 border-gray-200' },
  problemSection:   { label: 'Section Problème',          desc: 'Points de douleur client',            icon: Frown,        color: 'bg-rose-100 text-rose-700 border-rose-200' },
  solutionSection:  { label: 'Section Solution',          desc: 'Solution persuasive',                 icon: Lightbulb,    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  faq:              { label: 'Section FAQ',               desc: 'Questions fréquentes',                icon: HelpCircle,   color: 'bg-orange-100 text-orange-700 border-orange-200' },
  testimonials:     { label: 'Témoignages clients',       desc: 'Témoignages clients',                 icon: MessageSquare,color: 'bg-pink-100 text-pink-700 border-pink-200' },
  relatedProducts:  { label: 'Produits similaires',       desc: 'Produits similaires',                 icon: Link2,        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  stickyOrderBar:   { label: 'Barre de commande fixe',    desc: 'Barre fixe Commander',                icon: Pin,          color: 'bg-gray-100 text-gray-700 border-gray-200' },
  upsell:           { label: 'Upsell',                    desc: 'Produit de valeur supérieure',        icon: Rocket,       color: 'bg-violet-100 text-violet-700 border-violet-200' },
  orderBump:        { label: 'Order Bump',                desc: 'Produit complémentaire',              icon: ShoppingCart, color: 'bg-teal-100 text-teal-700 border-teal-200' },
};

// ─── Merge helpers (same as ProductSettingsPage) ─────────────────────────────
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const mergeSections = (stored) => {
  if (!stored?.length) return deepClone(defaultConfig.general.sections);
  const defaults = deepClone(defaultConfig.general.sections);
  const merged = stored.map(s => {
    const def = defaults.find(d => d.id === s.id);
    return def ? { ...def, ...s } : s;
  });
  defaults.forEach(d => { if (!merged.find(s => s.id === d.id)) merged.push(d); });
  return merged;
};

const mergeWithDefaults = (stored) => ({
  ...stored,
  general: {
    ...defaultConfig.general,
    ...(stored?.general || {}),
    sections: mergeSections(stored?.general?.sections),
  },
});

// ─── Editable section content schemas ────────────────────────────────────────
const EDITABLE_SECTIONS = {
  heroSlogan:      { fields: [{ key: 'text', label: 'Slogan marketing', placeholder: 'Ex: Découvrez le secret des pros…', type: 'text' }] },
  heroBaseline:    { fields: [{ key: 'text', label: 'Phrase de réassurance', placeholder: 'Ex: Résultats visibles en 7 jours', type: 'text' }] },
  urgencyBadge:    { fields: [{ key: 'text', label: 'Texte d\'urgence', placeholder: 'Ex: ⚡ Dernières pièces — 3 restants !', type: 'text' }] },
  statsBar:        { fields: 'stats' },
  productGallery:  { fields: 'productGallery' },
  benefitsBullets: { fields: 'list', label: 'Bénéfices', placeholder: 'Ex: Résultats en 7 jours' },
  problemSection:  { fields: [
    { key: 'title', label: 'Titre', placeholder: 'Ex: Le problème', type: 'text' },
    { key: 'painPoints', label: 'Points de douleur', type: 'list', placeholder: 'Ex: Maux de dos fréquents' },
  ]},
  solutionSection: { fields: [
    { key: 'title', label: 'Titre', placeholder: 'Ex: La solution', type: 'text' },
    { key: 'description', label: 'Description', placeholder: 'Paragraphe explicatif…', type: 'textarea' },
  ]},
  offerBlock:      { fields: [
    { key: 'offerLabel', label: 'Titre de l\'offre', placeholder: 'Ex: Offre spéciale', type: 'text' },
    { key: 'guaranteeText', label: 'Texte garantie', placeholder: 'Ex: Satisfait ou remboursé 30 jours', type: 'text' },
  ]},
  faq:             { fields: 'faq' },
  testimonials:    { fields: 'testimonials' },
  urgencyElements: { fields: [
    { key: 'stockLimited', label: 'Stock limité', type: 'checkbox' },
    { key: 'socialProofCount', label: 'Nombre preuve sociale', placeholder: 'Ex: 42', type: 'number' },
    { key: 'quickResult', label: 'Résultat rapide', placeholder: 'Ex: 7 jours', type: 'text' },
  ]},
  conversionBlocks: { fields: 'iconTextList', label: 'Blocs de réassurance', iconPlaceholder: '🚚', textPlaceholder: 'Livraison gratuite partout' },
  description:     { fields: [{ key: 'text', label: 'Description', placeholder: 'Description détaillée du produit…', type: 'textarea' }] },
  stockCounter:    { fields: [{ key: 'text', label: 'Texte stock', placeholder: 'Ex: ⚡ Plus que 5 en stock !', type: 'text' }] },
};

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 transition-all bg-white";

const DEFAULT_TESTIMONIALS = [
  { name: 'Thierry M.', location: 'Douala', rating: 5, text: 'Produit vraiment excellent ! J\'ai vu des résultats en moins d\'une semaine. Je recommande à 100%.', verified: true, date: 'Il y a 3 jours' },
  { name: 'Astride N.', location: 'Yaoundé', rating: 5, text: 'Avant j\'avais essayé plein de produits sans résultats. Depuis que j\'utilise celui-ci, la différence est flagrante !', verified: true, date: 'Il y a 5 jours' },
  { name: 'Rodrigue K.', location: 'Bafoussam', rating: 5, text: 'Super qualité, livraison rapide. Le produit dépasse mes attentes. Je vais en commander encore.', verified: true, date: 'Il y a 1 semaine' },
];

const PRODUCT_GALLERY_DEFAULTS = {
  title: 'Photos du produit',
  subtitle: 'Faites défiler les visuels avant de commander',
  showHeader: true,
  useProductImages: true,
  images: [],
  mainImageHeight: 420,
  thumbnailSize: 72,
};

const MAIN_IMAGE_HEIGHT_OPTIONS = [240, 320, 420, 520, 640, 760, 900];
const THUMBNAIL_SIZE_OPTIONS = [48, 56, 64, 72, 80, 96, 112, 128, 144, 160];

const normalizeToPreset = (value, presets, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  if (presets.includes(parsed)) return parsed;
  return presets.reduce((closest, current) => (
    Math.abs(current - parsed) < Math.abs(closest - parsed) ? current : closest
  ), presets[0]);
};

// ─── Resolve default content from product data (same logic as LivePreview) ──
const getDefaultContent = (sectionId, product) => {
  if (!product) return {};
  const pd = product._pageData || {};
  switch (sectionId) {
    case 'heroSlogan':
      return pd.hero_slogan ? { text: pd.hero_slogan } : {};
    case 'heroBaseline':
      return pd.hero_baseline ? { text: pd.hero_baseline } : {};
    case 'urgencyBadge':
      return pd.urgency_badge ? { text: pd.urgency_badge } : {};
    case 'statsBar':
      return pd.stats_bar?.length > 0 ? { stats: pd.stats_bar.slice(0, 3).map(s => ({ value: s.value || '', label: s.label || '' })) } : {};
    case 'productGallery':
      return PRODUCT_GALLERY_DEFAULTS;
    case 'benefitsBullets':
      return pd.benefits_bullets?.length > 0 ? { items: [...pd.benefits_bullets] } : {};
    case 'problemSection': {
      const ps = pd.problem_section;
      if (!ps) return {};
      return {
        ...(ps.title ? { title: ps.title } : {}),
        ...(ps.pain_points?.length > 0 ? { painPoints: [...ps.pain_points] } : {}),
      };
    }
    case 'solutionSection': {
      const ss = pd.solution_section;
      if (!ss) return {};
      return {
        ...(ss.title ? { title: ss.title } : {}),
        ...(ss.description ? { description: ss.description } : {}),
      };
    }
    case 'offerBlock': {
      const ob = pd.offer_block;
      if (!ob) return {};
      return {
        ...(ob.offer_label ? { offerLabel: ob.offer_label } : {}),
        ...(ob.guarantee_text ? { guaranteeText: ob.guarantee_text } : {}),
      };
    }
    case 'urgencyElements': {
      const ue = pd.urgency_elements;
      if (!ue) return {};
      return {
        stockLimited: ue.stock_limited || false,
        socialProofCount: ue.social_proof_count || 0,
        quickResult: ue.quick_result || '',
      };
    }
    case 'conversionBlocks':
      return pd.conversion_blocks?.length > 0 ? { items: pd.conversion_blocks.map(b => ({ icon: b.icon || '', text: b.text || '' })) } : {};
    case 'description':
      return product.description ? { text: product.description } : {};
    case 'stockCounter':
      return {};
    case 'faq': {
      const faqItems = (product.faq?.length > 0 ? product.faq : pd.faq?.length > 0 ? pd.faq : [])
        .map(f => ({ question: f.question || f.q || '', answer: f.answer || f.reponse || f.a || '' }));
      return faqItems.length > 0 ? { faqItems } : {};
    }
    case 'testimonials': {
      const raw = pd.testimonials?.length > 0
        ? pd.testimonials
        : product.testimonials?.length > 0
          ? product.testimonials
          : DEFAULT_TESTIMONIALS;
      const testimonials = raw.map(t => ({
        name: t.name || '', location: t.location || '',
        rating: t.rating || 5, text: t.text || t.content || '',
        verified: t.verified ?? true, date: t.date || '',
      }));
      return { items: testimonials };
    }
    default:
      return {};
  }
};

const SectionContentEditor = ({ section, onChange, product }) => {
  const schema = EDITABLE_SECTIONS[section.id];
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryUploadError, setGalleryUploadError] = useState('');
  if (!schema) return (
    <div className="text-[11px] text-gray-400 italic py-2">Contenu généré automatiquement par l'IA ou géré via les paramètres de la boutique.</div>
  );

  // Merge: saved content takes priority, fallback to product data
  // For testimonials: if no saved items, always load defaults so user can edit them
  const defaults = getDefaultContent(section.id, product);
  const savedContent = section.content || {};
  const content = section.id === 'testimonials'
    ? { ...defaults, ...(savedContent.items?.length > 0 ? savedContent : {}) }
    : { ...defaults, ...savedContent };
  const update = (key, val) => onChange({ ...section, content: { ...content, [key]: val } });

  if (schema.fields === 'stats') {
    const stats = content.stats || [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }];
    const updateStat = (i, key, val) => { const copy = [...stats]; copy[i] = { ...copy[i], [key]: val }; update('stats', copy); };
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-gray-500 mb-1">Statistiques (3 max)</div>
        {stats.slice(0, 3).map((st, i) => (
          <div key={i} className="flex gap-2">
            <input className={inputCls + " w-20 shrink-0"} value={st.value} onChange={e => updateStat(i, 'value', e.target.value)} placeholder="1200+" />
            <input className={inputCls + " flex-1"} value={st.label} onChange={e => updateStat(i, 'label', e.target.value)} placeholder="Clients satisfaits" />
          </div>
        ))}
        <div className="text-[10px] text-gray-400">Laissez vide pour utiliser les données IA</div>
      </div>
    );
  }

  if (schema.fields === 'list') {
    const items = content.items || [''];
    const updateItem = (i, val) => { const copy = [...items]; copy[i] = val; update('items', copy); };
    const addItem = () => update('items', [...items, '']);
    const removeItem = (i) => update('items', items.filter((_, idx) => idx !== i));
    return (
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-gray-500 mb-1">{schema.label || 'Éléments'}</div>
        {items.map((item, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <input className={inputCls + " flex-1"} value={item} onChange={e => updateItem(i, e.target.value)} placeholder={schema.placeholder} />
            {items.length > 1 && <button onClick={() => removeItem(i)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>}
          </div>
        ))}
        <button onClick={addItem} className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium hover:text-emerald-700 mt-1">
          <Plus size={12} /> Ajouter
        </button>
      </div>
    );
  }

  if (schema.fields === 'faq') {
    const items = content.faqItems || [{ question: '', answer: '' }];
    const updateFaq = (i, key, val) => { const copy = [...items]; copy[i] = { ...copy[i], [key]: val }; update('faqItems', copy); };
    const addFaq = () => update('faqItems', [...items, { question: '', answer: '' }]);
    const removeFaq = (i) => update('faqItems', items.filter((_, idx) => idx !== i));
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-gray-500 mb-1">Questions fréquentes</div>
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-gray-100 p-2 bg-gray-50/50 space-y-1.5">
            <div className="flex gap-1.5 items-center">
              <input className={inputCls + " flex-1"} value={item.question} onChange={e => updateFaq(i, 'question', e.target.value)} placeholder="Question…" />
              {items.length > 1 && <button onClick={() => removeFaq(i)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>}
            </div>
            <textarea className={inputCls + " resize-none"} rows={2} value={item.answer} onChange={e => updateFaq(i, 'answer', e.target.value)} placeholder="Réponse…" />
          </div>
        ))}
        <button onClick={addFaq} className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium hover:text-emerald-700 mt-1">
          <Plus size={12} /> Ajouter une question
        </button>
      </div>
    );
  }

  if (schema.fields === 'testimonials') {
    const items = content.items || [];
    const updateT = (i, key, val) => { const copy = [...items]; copy[i] = { ...copy[i], [key]: val }; update('items', copy); };
    const addT = () => update('items', [...items, { name: '', location: '', rating: 5, text: '', verified: true, date: 'Il y a 2 jours' }]);
    const removeT = (i) => update('items', items.filter((_, idx) => idx !== i));
    const dupT = (i) => update('items', [...items.slice(0, i + 1), { ...items[i] }, ...items.slice(i + 1)]);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-gray-700">{items.length} avis client{items.length !== 1 ? 's' : ''}</span>
          <button onClick={addT} className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
            <Plus size={11} /> Ajouter
          </button>
        </div>
        {items.map((t, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Avis header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center uppercase">
                  {(t.name || '?')[0]}
                </div>
                <span className="text-[11px] font-semibold text-gray-700">Avis #{i + 1}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => dupT(i)} className="p-1 text-gray-300 hover:text-blue-400 transition" title="Dupliquer"><Copy size={11} /></button>
                <button onClick={() => removeT(i)} className="p-1 text-gray-300 hover:text-red-400 transition"><Trash2 size={11} /></button>
              </div>
            </div>
            <div className="p-2.5 space-y-2">
              {/* Étoiles */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => updateT(i, 'rating', n)}
                      className={`transition-colors ${n <= (t.rating || 5) ? 'text-amber-400' : 'text-gray-200'}`}>
                      <Star size={15} fill="currentColor" />
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                  <input type="checkbox" checked={!!t.verified} onChange={e => updateT(i, 'verified', e.target.checked)}
                    className="w-3.5 h-3.5 accent-emerald-500" />
                  <span className="text-[10px] text-gray-500">Achat vérifié ✓</span>
                </label>
              </div>
              {/* Nom + Ville */}
              <div className="grid grid-cols-2 gap-1.5">
                <input className={inputCls} value={t.name || ''} onChange={e => updateT(i, 'name', e.target.value)} placeholder="Prénom Nom" />
                <input className={inputCls} value={t.location || ''} onChange={e => updateT(i, 'location', e.target.value)} placeholder="Ville, Pays" />
              </div>
              {/* Texte */}
              <textarea className={inputCls + ' resize-none'} rows={3} value={t.text || ''} onChange={e => updateT(i, 'text', e.target.value)} placeholder="Témoignage client…" />
              {/* Date */}
              <input className={inputCls} value={t.date || ''} onChange={e => updateT(i, 'date', e.target.value)} placeholder="Il y a 3 jours" />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <button onClick={addT} className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-[12px] text-gray-400 hover:border-emerald-300 hover:text-emerald-600 transition">
            + Ajouter un premier avis
          </button>
        )}
      </div>
    );
  }

  if (schema.fields === 'productGallery') {
    const gallery = { ...PRODUCT_GALLERY_DEFAULTS, ...content };
    const customImages = Array.isArray(gallery.images) ? gallery.images : [];
    const validCustomImages = customImages.filter((image) => image?.url);
    const productImages = Array.isArray(product?.images)
      ? product.images
          .map((image) => (typeof image === 'string'
            ? { url: image, alt: '' }
            : { url: image?.url || '', alt: image?.alt || '' }))
          .filter((image) => image.url)
      : [];
    const usingNativeImages = validCustomImages.length === 0 && gallery.useProductImages !== false && productImages.length > 0;
    const images = usingNativeImages ? productImages : customImages;
    const mainImageHeight = normalizeToPreset(gallery.mainImageHeight, MAIN_IMAGE_HEIGHT_OPTIONS, PRODUCT_GALLERY_DEFAULTS.mainImageHeight);
    const thumbnailSize = normalizeToPreset(gallery.thumbnailSize, THUMBNAIL_SIZE_OPTIONS, PRODUCT_GALLERY_DEFAULTS.thumbnailSize);
    const saveImages = (nextImages, nextUseProductImages = false) => {
      onChange({
        ...section,
        content: {
          ...content,
          ...gallery,
          images: nextImages,
          useProductImages: nextUseProductImages,
        },
      });
    };
    const updateImage = (index, key, val) => {
      const nextImages = [...images];
      nextImages[index] = { ...nextImages[index], [key]: val };
      saveImages(nextImages, false);
    };
    const addImage = () => saveImages([...images, { url: '', alt: '' }], false);
    const removeImage = (index) => saveImages(images.filter((_, idx) => idx !== index), false);
    const uploadImages = async (files, replaceIndex = null) => {
      if (!files?.length) return;
      setGalleryUploading(true);
      setGalleryUploadError('');
      try {
        const res = await storeProductsApi.uploadImages(Array.from(files));
        // Backend returns { success, data: [{ id, url, key, filename, size }] }
        const uploaded = res.data?.data || res.data?.urls || res.data?.images || [];
        const urls = (Array.isArray(uploaded) ? uploaded : [])
          .map(item => typeof item === 'string' ? item : item?.url)
          .filter(Boolean);
        if (!urls.length) {
          setGalleryUploadError('Aucune URL retournée par le serveur. Vérifiez la configuration Cloudflare Images.');
          return;
        }

        if (replaceIndex !== null && urls[0]) {
          updateImage(replaceIndex, 'url', urls[0]);
          return;
        }

        saveImages([...images, ...urls.map((url) => ({ url, alt: '' }))], false);
      } catch (error) {
        console.error('Gallery image upload failed:', error);
        const msg = error?.response?.data?.message || error?.message || 'Erreur inconnue';
        setGalleryUploadError(`Échec de l'upload : ${msg}`);
      } finally {
        setGalleryUploading(false);
      }
    };
    const moveImage = (index, direction) => {
      const target = index + direction;
      if (target < 0 || target >= images.length) return;
      const nextImages = [...images];
      [nextImages[index], nextImages[target]] = [nextImages[target], nextImages[index]];
      saveImages(nextImages, false);
    };
    return (
      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={gallery.showHeader !== false} onChange={e => update('showHeader', e.target.checked)} className="w-4 h-4 accent-emerald-500" />
          <span className="text-[12px] text-gray-600">Afficher le titre de la section</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] font-semibold text-gray-500 mb-1">Titre</div>
            <input className={inputCls} value={gallery.title || ''} onChange={e => update('title', e.target.value)} placeholder="Photos du produit" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 mb-1">Sous-titre</div>
            <input className={inputCls} value={gallery.subtitle || ''} onChange={e => update('subtitle', e.target.value)} placeholder="Faites défiler les visuels..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] font-semibold text-gray-500 mb-1">Hauteur image principale</div>
            <select className={inputCls} value={mainImageHeight} onChange={e => update('mainImageHeight', Number.parseInt(e.target.value, 10))}>
              {MAIN_IMAGE_HEIGHT_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 mb-1">Taille miniatures</div>
            <select className={inputCls} value={thumbnailSize} onChange={e => update('thumbnailSize', Number.parseInt(e.target.value, 10))}>
              {THUMBNAIL_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={gallery.useProductImages !== false} onChange={e => update('useProductImages', e.target.checked)} className="w-4 h-4 accent-emerald-500" />
          <span className="text-[12px] text-gray-600">Utiliser aussi les photos natives du produit</span>
        </label>
        <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-700">Photos personnalisées</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700 cursor-pointer hover:bg-emerald-100 transition">
                {galleryUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Uploader
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={galleryUploading}
                  onChange={async (e) => {
                    await uploadImages(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              <button onClick={addImage} className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium hover:text-emerald-700">
                <Plus size={12} /> Ajouter
              </button>
            </div>
          </div>
          {usingNativeImages && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[10px] text-blue-700">
              Les photos actuelles du produit sont chargées automatiquement ici. Si tu remplaces, supprimes ou réordonnes une image, la galerie passe en mode personnalisé.
            </div>
          )}
          {galleryUploadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[10px] text-red-700 flex items-center gap-1.5">
              <AlertCircle size={12} className="shrink-0" />
              <span>{galleryUploadError}</span>
              <button onClick={() => setGalleryUploadError('')} className="ml-auto p-0.5 text-red-400 hover:text-red-600"><X size={10} /></button>
            </div>
          )}
          {images.length === 0 && (
            <div className="text-[10px] text-gray-400">Uploadez vos images ou collez une URL. Si l'option ci-dessus est activée, elles seront ajoutées au carrousel; sinon elles remplaceront les photos produit.</div>
          )}
          {images.map((image, index) => (
            <div key={index} className="rounded-lg border border-gray-200 bg-white p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Photo #{index + 1}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveImage(index, -1)} disabled={index === 0} className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-25">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-25">
                    <ChevronDown size={12} />
                  </button>
                  <button onClick={() => removeImage(index)} className="p-1 text-gray-300 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {image.url && (
                <img src={image.url} alt={image.alt || `Photo ${index + 1}`} className="w-full h-28 rounded-lg border border-gray-200 object-cover bg-gray-50" />
              )}
              <input className={inputCls} value={image.url || ''} onChange={e => updateImage(index, 'url', e.target.value)} placeholder="https://..." />
              <label className="flex items-center justify-center gap-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-600 cursor-pointer hover:bg-gray-100 transition">
                {galleryUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Remplacer par upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={galleryUploading}
                  onChange={async (e) => {
                    await uploadImages(e.target.files, index);
                    e.target.value = '';
                  }}
                />
              </label>
              <input className={inputCls} value={image.alt || ''} onChange={e => updateImage(index, 'alt', e.target.value)} placeholder="Texte alternatif (optionnel)" />
            </div>
          ))}
        </div>
        <div className="text-[10px] text-gray-400">Les tailles sont limitées aux formats supportés pour garder une mise en page propre. Si aucune photo personnalisée n'est renseignée, la galerie affiche les images du produit.</div>
      </div>
    );
  }

  // ── Icon+Text list editor (conversionBlocks) ──
  if (schema.fields === 'iconTextList') {
    const items = content.items || [{ icon: '', text: '' }];
    const updateItem = (i, key, val) => { const copy = [...items]; copy[i] = { ...copy[i], [key]: val }; update('items', copy); };
    const addItem = () => update('items', [...items, { icon: '', text: '' }]);
    const removeItem = (i) => update('items', items.filter((_, idx) => idx !== i));
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-gray-500 mb-1">{schema.label || 'Éléments'}</div>
        {items.map((item, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <input className={inputCls + " w-12 text-center shrink-0"} value={item.icon || ''} onChange={e => updateItem(i, 'icon', e.target.value)} placeholder={schema.iconPlaceholder || '🚚'} />
            <input className={inputCls + " flex-1"} value={item.text || ''} onChange={e => updateItem(i, 'text', e.target.value)} placeholder={schema.textPlaceholder || 'Texte'} />
            {items.length > 1 && <button onClick={() => removeItem(i)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>}
          </div>
        ))}
        <button onClick={addItem} className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium hover:text-emerald-700 mt-1"><Plus size={12} /> Ajouter</button>
        <div className="text-[10px] text-gray-400">Laissez vide pour utiliser les données IA</div>
      </div>
    );
  }

  // Standard fields (text, textarea, nested list, checkbox, number)
  return (
    <div className="space-y-3">
      {schema.fields.map(field => {
        if (field.type === 'checkbox') {
          return (
            <label key={field.key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!content[field.key]} onChange={e => update(field.key, e.target.checked)} className="w-4 h-4 accent-emerald-500" />
              <span className="text-[12px] text-gray-600">{field.label}</span>
            </label>
          );
        }
        if (field.type === 'number') {
          return (
            <div key={field.key}>
              <div className="text-[11px] font-semibold text-gray-500 mb-1">{field.label}</div>
              <input type="number" min="0" className={inputCls + " w-28"} value={content[field.key] || ''} onChange={e => update(field.key, parseInt(e.target.value) || 0)} placeholder={field.placeholder} />
            </div>
          );
        }
        if (field.type === 'list') {
          const items = content[field.key] || [''];
          const updateItem = (i, val) => { const copy = [...items]; copy[i] = val; update(field.key, copy); };
          const addItem = () => update(field.key, [...items, '']);
          const removeItem = (i) => update(field.key, items.filter((_, idx) => idx !== i));
          return (
            <div key={field.key}>
              <div className="text-[11px] font-semibold text-gray-500 mb-1">{field.label}</div>
              {items.map((item, i) => (
                <div key={i} className="flex gap-1.5 items-center mb-1">
                  <input className={inputCls + " flex-1"} value={item} onChange={e => updateItem(i, e.target.value)} placeholder={field.placeholder} />
                  {items.length > 1 && <button onClick={() => removeItem(i)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>}
                </div>
              ))}
              <button onClick={addItem} className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium hover:text-emerald-700">
                <Plus size={12} /> Ajouter
              </button>
            </div>
          );
        }
        if (field.type === 'textarea') {
          return (
            <div key={field.key}>
              <div className="text-[11px] font-semibold text-gray-500 mb-1">{field.label}</div>
              <textarea className={inputCls + " resize-none"} rows={3} value={content[field.key] || ''}
                onChange={e => update(field.key, e.target.value)} placeholder={field.placeholder} />
            </div>
          );
        }
        return (
          <div key={field.key}>
            <div className="text-[11px] font-semibold text-gray-500 mb-1">{field.label}</div>
            <input className={inputCls} value={content[field.key] || ''}
              onChange={e => update(field.key, e.target.value)} placeholder={field.placeholder} />
          </div>
        );
      })}
      <div className="text-[10px] text-gray-400">Laissez vide pour utiliser les données IA</div>
    </div>
  );
};

// ─── Section type definitions ────────────────────────────────────────────────
const SECTION_TYPES = {
  hero: {
    label: 'Hero produit',
    icon: Layout,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    defaultConfig: {
      title: '',
      subtitle: '',
      badge: '',
      bgColor: '#ffffff',
      textColor: '#111827',
      showPrice: true,
      showCta: true,
      ctaText: 'Commander maintenant',
      ctaColor: '#0F6B4F',
    }
  },
  gallery: {
    label: 'Galerie images',
    icon: Image,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    defaultConfig: {
      layout: 'grid', // grid | carousel | masonry
      images: [],
    }
  },
  description: {
    label: 'Description',
    icon: Type,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    defaultConfig: {
      title: 'À propos du produit',
      content: '',
      showTitle: true,
    }
  },
  benefits: {
    label: 'Bénéfices',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    defaultConfig: {
      title: 'Pourquoi choisir ce produit ?',
      items: [
        { icon: '✓', text: 'Bénéfice 1', description: '' },
        { icon: '✓', text: 'Bénéfice 2', description: '' },
        { icon: '✓', text: 'Bénéfice 3', description: '' },
      ],
      layout: 'list', // list | grid | icons
    }
  },
  testimonials: {
    label: 'Avis clients',
    icon: Star,
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    defaultConfig: {
      title: 'Ce que disent nos clients',
      items: [
        { name: 'Marie D.', location: 'Douala', rating: 5, text: 'Produit excellent, je recommande !', verified: true, date: 'Il y a 3 jours', image: '' },
      ],
      showRating: true,
      showVerified: true,
    }
  },
  faq: {
    label: 'FAQ',
    icon: HelpCircle,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    defaultConfig: {
      title: 'Questions fréquentes',
      items: [
        { question: 'Comment utiliser ce produit ?', answer: 'Votre réponse ici...' },
        { question: 'Quels sont les délais de livraison ?', answer: 'Votre réponse ici...' },
      ]
    }
  },
  cta: {
    label: 'Appel à l\'action',
    icon: Zap,
    color: 'bg-red-100 text-red-700 border-red-200',
    defaultConfig: {
      title: 'Commandez maintenant !',
      subtitle: 'Livraison rapide · Paiement à la livraison',
      buttonText: 'Commander maintenant',
      buttonColor: '#0F6B4F',
      urgencyText: '',
      showCountdown: false,
    }
  },
  custom: {
    label: 'Section personnalisée',
    icon: Code,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    defaultConfig: {
      html: '<div style="padding:20px;">\n  <h2>Mon titre</h2>\n  <p>Mon contenu personnalisé</p>\n</div>',
      css: '/* Styles personnalisés */\n',
      js: '/* JavaScript personnalisé */\n',
    }
  }
};

// ─── Templates prédéfinis ────────────────────────────────────────────────────
const TEMPLATES = {
  skincare: {
    label: 'Skincare / Beauté',
    emoji: '💆',
    color: 'bg-rose-50 border-rose-200',
    sections: [
      { type: 'hero', config: { title: '', subtitle: 'Résultats visibles en 7 jours', badge: '⭐ #1 Bestseller', showPrice: true, showCta: true, ctaText: 'Commander maintenant', ctaColor: '#be185d', bgColor: '#fff1f2', textColor: '#1f2937' } },
      { type: 'gallery', config: { layout: 'carousel', images: [] } },
      { type: 'benefits', config: { title: 'Pourquoi notre formule est unique ?', items: [
        { icon: '🌿', text: 'Ingrédients naturels', description: '100% naturel, sans parabènes ni sulfates' },
        { icon: '🔬', text: 'Formule scientifique', description: 'Développée avec des dermatologues' },
        { icon: '✨', text: 'Résultats rapides', description: 'Visible dès la première semaine' },
        { icon: '🛡️', text: 'Testé dermatologiquement', description: 'Convient à tous types de peau' },
      ], layout: 'grid' } },
      { type: 'testimonials', config: { title: 'Elles ont adoré !', items: [
        { name: 'Aminata K.', location: 'Abidjan', rating: 5, text: 'Ma peau n\'a jamais été aussi belle. Résultats incroyables en 2 semaines !', verified: true, date: 'Il y a 5 jours', image: '' },
        { name: 'Fatou D.', location: 'Dakar', rating: 5, text: 'Je recommande à toutes mes amies. Ce produit a changé ma vie.', verified: true, date: 'Il y a 1 semaine', image: '' },
        { name: 'Christelle B.', location: 'Douala', rating: 5, text: 'Produit de qualité exceptionnelle. Ma peau brille de mille feux.', verified: true, date: 'Il y a 2 semaines', image: '' },
      ], showRating: true, showVerified: true } },
      { type: 'faq', config: { title: 'Vos questions', items: [
        { question: 'Ce produit convient-il à ma peau ?', answer: 'Notre formule est adaptée à tous types de peau, même les plus sensibles.' },
        { question: 'En combien de temps vais-je voir des résultats ?', answer: 'La majorité de nos clientes observent des changements visibles dès 7 jours d\'utilisation.' },
        { question: 'Puis-je l\'utiliser pendant la grossesse ?', answer: 'Nous vous conseillons de consulter votre médecin avant toute utilisation pendant la grossesse.' },
      ] } },
      { type: 'cta', config: { title: 'Transformez votre peau aujourd\'hui !', subtitle: 'Livraison rapide · Satisfaction garantie · Paiement à la livraison', buttonText: 'Commander maintenant', buttonColor: '#be185d', urgencyText: '🔥 Plus que 12 pièces en stock', showCountdown: false } }
    ]
  },
  fitness: {
    label: 'Fitness / Sport',
    emoji: '💪',
    color: 'bg-orange-50 border-orange-200',
    sections: [
      { type: 'hero', config: { title: '', subtitle: 'Boostez vos performances', badge: '🏆 Choix des champions', showPrice: true, showCta: true, ctaText: 'Je commande', ctaColor: '#ea580c', bgColor: '#fff7ed', textColor: '#1f2937' } },
      { type: 'gallery', config: { layout: 'grid', images: [] } },
      { type: 'benefits', config: { title: 'Vos résultats en 30 jours', items: [
        { icon: '⚡', text: 'Énergie maximale', description: 'Dopez votre énergie et votre endurance' },
        { icon: '💪', text: 'Muscles plus forts', description: 'Favorise la croissance musculaire' },
        { icon: '🔥', text: 'Brûle les graisses', description: 'Accélère votre métabolisme' },
        { icon: '🏃', text: 'Récupération rapide', description: 'Moins de courbatures, plus de séances' },
      ], layout: 'grid' } },
      { type: 'testimonials', config: { title: 'Ils ont transformé leur corps', items: [
        { name: 'Rodrigue M.', location: 'Douala', rating: 5, text: 'En 1 mois j\'ai perdu 5kg et gagné en masse musculaire. Incroyable !', verified: true, date: 'Il y a 4 jours', image: '' },
        { name: 'Kofi A.', location: 'Accra', rating: 5, text: 'Le meilleur complément que j\'ai essayé. Je vois la différence chaque semaine.', verified: true, date: 'Il y a 2 semaines', image: '' },
      ], showRating: true, showVerified: true } },
      { type: 'faq', config: { title: 'Questions fréquentes', items: [
        { question: 'Quand prendre ce produit ?', answer: 'Idéalement 30 minutes avant votre entraînement pour un maximum d\'énergie.' },
        { question: 'Est-ce que ce produit a des effets secondaires ?', answer: 'Notre formule est 100% naturelle et sans effets secondaires connus.' },
      ] } },
      { type: 'cta', config: { title: 'Commencez votre transformation !', subtitle: '✅ Résultats garantis · 🚚 Livraison rapide · 💳 Paiement à la livraison', buttonText: 'Commander maintenant', buttonColor: '#ea580c', urgencyText: '⏰ Offre limitée - 20% de réduction aujourd\'hui', showCountdown: false } }
    ]
  },
  gadget: {
    label: 'Gadget / Tech',
    emoji: '⚙️',
    color: 'bg-slate-50 border-slate-200',
    sections: [
      { type: 'hero', config: { title: '', subtitle: 'La technologie au service de votre quotidien', badge: '🔥 Tendance 2025', showPrice: true, showCta: true, ctaText: 'Commander maintenant', ctaColor: '#1d4ed8', bgColor: '#f8fafc', textColor: '#1f2937' } },
      { type: 'gallery', config: { layout: 'carousel', images: [] } },
      { type: 'description', config: { title: 'Spécifications techniques', content: '<ul><li>Matériaux premium</li><li>Batterie longue durée</li><li>Compatible tous appareils</li><li>Garantie 1 an</li></ul>', showTitle: true } },
      { type: 'benefits', config: { title: 'Pourquoi vous allez l\'adorer', items: [
        { icon: '🔋', text: 'Batterie longue durée', description: 'Jusqu\'à 30h d\'autonomie' },
        { icon: '📱', text: 'Compatible tous appareils', description: 'iOS, Android, Windows' },
        { icon: '🛡️', text: 'Construction robuste', description: 'Résistant aux chocs et à l\'eau' },
        { icon: '🎯', text: 'Facile à utiliser', description: 'Plug & Play, aucune configuration' },
      ], layout: 'grid' } },
      { type: 'testimonials', config: { title: 'Avis vérifiés', items: [
        { name: 'Jean-Pierre N.', location: 'Yaoundé', rating: 5, text: 'Produit de qualité supérieure. Livraison en 2 jours, emballage soigné.', verified: true, date: 'Il y a 3 jours', image: '' },
        { name: 'Ama S.', location: 'Accra', rating: 5, text: 'Exactement comme décrit. Je suis très satisfait de mon achat.', verified: true, date: 'Il y a 1 semaine', image: '' },
      ], showRating: true, showVerified: true } },
      { type: 'faq', config: { title: 'Questions fréquentes', items: [
        { question: 'Quelle est la garantie ?', answer: 'Chaque produit est garanti 1 an. En cas de défaut, nous le remplaçons gratuitement.' },
        { question: 'La livraison est-elle sécurisée ?', answer: 'Oui, tous nos colis sont emballés soigneusement et suivis en temps réel.' },
      ] } },
      { type: 'cta', config: { title: 'Passez commande maintenant !', subtitle: '📦 Stock limité · 🚚 Livraison express · 🔒 Paiement sécurisé', buttonText: 'Commander maintenant', buttonColor: '#1d4ed8', urgencyText: '🔥 78 personnes regardent ce produit', showCountdown: false } }
    ]
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const genId = () => `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const buildSection = (type) => ({
  id: genId(),
  type,
  visible: true,
  config: { ...SECTION_TYPES[type].defaultConfig }
});

// ─── Sub-editors ─────────────────────────────────────────────────────────────

const HeroEditor = ({ config, onChange }) => (
  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Badge (optionnel)</label>
      <input value={config.badge || ''} onChange={e => onChange({ ...config, badge: e.target.value })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="⭐ Bestseller" />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Sous-titre</label>
      <input value={config.subtitle || ''} onChange={e => onChange({ ...config, subtitle: e.target.value })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Votre accroche principale" />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Couleur fond</label>
        <div className="flex gap-2">
          <input type="color" value={config.bgColor || '#ffffff'} onChange={e => onChange({ ...config, bgColor: e.target.value })}
            className="w-10 h-9 border border-gray-200 rounded-lg cursor-pointer" />
          <input value={config.bgColor || '#ffffff'} onChange={e => onChange({ ...config, bgColor: e.target.value })}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-xs font-mono" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Couleur CTA</label>
        <div className="flex gap-2">
          <input type="color" value={config.ctaColor || '#0F6B4F'} onChange={e => onChange({ ...config, ctaColor: e.target.value })}
            className="w-10 h-9 border border-gray-200 rounded-lg cursor-pointer" />
          <input value={config.ctaColor || '#0F6B4F'} onChange={e => onChange({ ...config, ctaColor: e.target.value })}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-xs font-mono" />
        </div>
      </div>
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Texte bouton CTA</label>
      <input value={config.ctaText || 'Commander maintenant'} onChange={e => onChange({ ...config, ctaText: e.target.value })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
    </div>
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={config.showPrice !== false} onChange={e => onChange({ ...config, showPrice: e.target.checked })} className="rounded" />
        Afficher le prix
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={config.showCta !== false} onChange={e => onChange({ ...config, showCta: e.target.checked })} className="rounded" />
        Afficher le CTA
      </label>
    </div>
  </div>
);

const BenefitsEditor = ({ config, onChange }) => {
  const updateItem = (idx, field, val) => {
    const items = [...(config.items || [])];
    items[idx] = { ...items[idx], [field]: val };
    onChange({ ...config, items });
  };
  const addItem = () => onChange({ ...config, items: [...(config.items || []), { icon: '✓', text: '', description: '' }] });
  const removeItem = (idx) => onChange({ ...config, items: (config.items || []).filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Titre de section</label>
        <input value={config.title || ''} onChange={e => onChange({ ...config, title: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Disposition</label>
        <select value={config.layout || 'list'} onChange={e => onChange({ ...config, layout: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="list">Liste</option>
          <option value="grid">Grille 2 colonnes</option>
          <option value="icons">Icônes centrées</option>
        </select>
      </div>
      <div className="space-y-2">
        {(config.items || []).map((item, idx) => (
          <div key={idx} className="flex gap-2 items-start bg-gray-50 p-2 rounded-lg">
            <input value={item.icon || ''} onChange={e => updateItem(idx, 'icon', e.target.value)}
              className="w-12 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center" placeholder="✓" />
            <div className="flex-1 space-y-1">
              <input value={item.text || ''} onChange={e => updateItem(idx, 'text', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" placeholder="Titre du bénéfice" />
              <input value={item.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-500" placeholder="Description (optionnel)" />
            </div>
            <button onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button onClick={addItem} className="w-full flex items-center justify-center gap-1 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition">
          <Plus className="w-4 h-4" /> Ajouter un bénéfice
        </button>
      </div>
    </div>
  );
};

const TestimonialsEditor = ({ config, onChange }) => {
  const updateItem = (idx, field, val) => {
    const items = [...(config.items || [])];
    items[idx] = { ...items[idx], [field]: val };
    onChange({ ...config, items });
  };
  const addItem = () => onChange({ ...config, items: [...(config.items || []), { name: '', location: '', rating: 5, text: '', verified: false, date: '', image: '' }] });
  const removeItem = (idx) => onChange({ ...config, items: (config.items || []).filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Titre de section</label>
        <input value={config.title || ''} onChange={e => onChange({ ...config, title: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={config.showRating !== false} onChange={e => onChange({ ...config, showRating: e.target.checked })} className="rounded" />
          Afficher les étoiles
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={config.showVerified !== false} onChange={e => onChange({ ...config, showVerified: e.target.checked })} className="rounded" />
          Badge vérifié
        </label>
      </div>
      <div className="space-y-3">
        {(config.items || []).map((item, idx) => (
          <div key={idx} className="bg-gray-50 p-3 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-600">Avis #{idx + 1}</span>
              <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={item.name || ''} onChange={e => updateItem(idx, 'name', e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" placeholder="Nom" />
              <input value={item.location || ''} onChange={e => updateItem(idx, 'location', e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" placeholder="Ville" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={item.rating || 5} onChange={e => updateItem(idx, 'rating', Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} étoiles</option>)}
              </select>
              <input value={item.date || ''} onChange={e => updateItem(idx, 'date', e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" placeholder="Il y a 3 jours" />
            </div>
            <textarea value={item.text || ''} onChange={e => updateItem(idx, 'text', e.target.value)}
              rows={2} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none" placeholder="Texte de l'avis..." />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!item.verified} onChange={e => updateItem(idx, 'verified', e.target.checked)} className="rounded" />
              Achat vérifié
            </label>
          </div>
        ))}
        <button onClick={addItem} className="w-full flex items-center justify-center gap-1 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-pink-400 hover:text-pink-600 transition">
          <Plus className="w-4 h-4" /> Ajouter un avis
        </button>
      </div>
    </div>
  );
};

const FaqEditor = ({ config, onChange }) => {
  const updateItem = (idx, field, val) => {
    const items = [...(config.items || [])];
    items[idx] = { ...items[idx], [field]: val };
    onChange({ ...config, items });
  };
  const addItem = () => onChange({ ...config, items: [...(config.items || []), { question: '', answer: '' }] });
  const removeItem = (idx) => onChange({ ...config, items: (config.items || []).filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Titre de section</label>
        <input value={config.title || ''} onChange={e => onChange({ ...config, title: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="space-y-2">
        {(config.items || []).map((item, idx) => (
          <div key={idx} className="bg-gray-50 p-3 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-600">Q&A #{idx + 1}</span>
              <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <input value={item.question || ''} onChange={e => updateItem(idx, 'question', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" placeholder="Question..." />
            <textarea value={item.answer || ''} onChange={e => updateItem(idx, 'answer', e.target.value)}
              rows={2} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none" placeholder="Réponse..." />
          </div>
        ))}
        <button onClick={addItem} className="w-full flex items-center justify-center gap-1 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 transition">
          <Plus className="w-4 h-4" /> Ajouter une question
        </button>
      </div>
    </div>
  );
};

const CtaEditor = ({ config, onChange }) => (
  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Titre principal</label>
      <input value={config.title || ''} onChange={e => onChange({ ...config, title: e.target.value })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Sous-titre</label>
      <input value={config.subtitle || ''} onChange={e => onChange({ ...config, subtitle: e.target.value })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Texte du bouton</label>
      <input value={config.buttonText || ''} onChange={e => onChange({ ...config, buttonText: e.target.value })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Couleur du bouton</label>
      <div className="flex gap-2">
        <input type="color" value={config.buttonColor || '#0F6B4F'} onChange={e => onChange({ ...config, buttonColor: e.target.value })}
          className="w-10 h-9 border border-gray-200 rounded-lg cursor-pointer" />
        <input value={config.buttonColor || '#0F6B4F'} onChange={e => onChange({ ...config, buttonColor: e.target.value })}
          className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-xs font-mono" />
      </div>
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Texte d'urgence (optionnel)</label>
      <input value={config.urgencyText || ''} onChange={e => onChange({ ...config, urgencyText: e.target.value })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="🔥 Offre limitée - Stock épuisé rapidement" />
    </div>
  </div>
);

const DescriptionEditor = ({ config, onChange }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={config.showTitle !== false} onChange={e => onChange({ ...config, showTitle: e.target.checked })} className="rounded" />
        Afficher un titre
      </label>
    </div>
    {config.showTitle !== false && (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Titre</label>
        <input value={config.title || ''} onChange={e => onChange({ ...config, title: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
    )}
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Contenu (HTML supporté)</label>
      <textarea value={config.content || ''} onChange={e => onChange({ ...config, content: e.target.value })}
        rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-y" placeholder="<p>Votre description...</p>" />
    </div>
  </div>
);

const CustomEditor = ({ config, onChange }) => {
  const [tab, setTab] = useState('html');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {['html', 'css', 'js'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-md text-xs font-bold uppercase transition ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'html' && (
        <textarea value={config.html || ''} onChange={e => onChange({ ...config, html: e.target.value })}
          rows={10} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono resize-y bg-gray-900 text-green-400" placeholder="<div>Votre HTML...</div>" />
      )}
      {tab === 'css' && (
        <textarea value={config.css || ''} onChange={e => onChange({ ...config, css: e.target.value })}
          rows={10} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono resize-y bg-gray-900 text-blue-400" placeholder="/* Votre CSS... */" />
      )}
      {tab === 'js' && (
        <textarea value={config.js || ''} onChange={e => onChange({ ...config, js: e.target.value })}
          rows={10} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono resize-y bg-gray-900 text-yellow-400" placeholder="// Votre JavaScript..." />
      )}
      <p className="text-xs text-gray-400">Le code sera injecté directement dans la page produit publique.</p>
    </div>
  );
};

const GalleryEditor = ({ config, onChange }) => (
  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Disposition</label>
      <select value={config.layout || 'carousel'} onChange={e => onChange({ ...config, layout: e.target.value })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
        <option value="carousel">Carrousel</option>
        <option value="grid">Grille</option>
        <option value="masonry">Masonry</option>
      </select>
    </div>
    <p className="text-xs text-gray-400 bg-gray-50 p-2 rounded-lg">Les images du produit seront utilisées automatiquement. Modifiez-les dans l'éditeur principal du produit.</p>
  </div>
);

// ─── Section preview renderers ───────────────────────────────────────────────
const HeroPreview = ({ config, product, design = {}, button = {} }) => {
  const btnColor = config.ctaColor || design.buttonColor || '#0F6B4F';
  const btnRadius = design.borderRadius || '12px';
  const btnText = config.ctaText || button.text || 'Commander maintenant';
  return (
    <div style={{ background: config.bgColor || design.backgroundColor || '#ffffff', color: config.textColor || design.textColor || '#111827' }}
      className="px-6 py-10 text-center">
      {config.badge && <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 mb-3">{config.badge}</span>}
      <h1 className="text-2xl font-extrabold mb-2">{product?.name || 'Nom du produit'}</h1>
      {config.subtitle && <p className="text-sm opacity-80 mb-4">{config.subtitle}</p>}
      {config.showPrice !== false && product?.price && (
        <div className="flex items-center justify-center gap-2 mb-4">
          {product.compareAtPrice && <span className="line-through text-sm opacity-50">{formatMoney(product.compareAtPrice, product.currency || 'XAF')}</span>}
          <span className="text-xl font-extrabold">{formatMoney(product.price, product.currency || 'XAF')}</span>
        </div>
      )}
      {config.showCta !== false && (
        <button style={{ background: btnColor, borderRadius: btnRadius, fontWeight: design.fontWeight || '600' }}
          className="px-6 py-2.5 text-white font-bold text-sm shadow-sm">
          {btnText}
        </button>
      )}
    </div>
  );
};

const GalleryPreview = ({ config, product }) => {
  const imgs = product?.images?.length > 0 ? product.images : [{ url: '', alt: '' }];
  return (
    <div className="px-6 py-6">
      <div className={`gap-2 ${config.layout === 'grid' ? 'grid grid-cols-2' : 'flex overflow-x-auto'}`}>
        {imgs.slice(0, 4).map((img, i) => (
          <div key={i} className="aspect-square bg-gray-100 rounded-xl overflow-hidden flex-shrink-0" style={{ minWidth: config.layout !== 'grid' ? '160px' : undefined }}>
            {img.url ? <img src={img.url} alt={img.alt} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Image className="w-8 h-8" /></div>}
          </div>
        ))}
      </div>
    </div>
  );
};

const DescriptionPreview = ({ config }) => (
  <div className="px-6 py-6">
    {config.showTitle !== false && config.title && <h2 className="text-lg font-bold text-gray-900 mb-3">{config.title}</h2>}
    {config.content ? <div className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: config.content }} /> : <p className="text-sm text-gray-400 italic">Contenu vide</p>}
  </div>
);

const BenefitsPreview = ({ config }) => (
  <div className="px-6 py-6">
    {config.title && <h2 className="text-lg font-bold text-gray-900 mb-4">{config.title}</h2>}
    <div className={config.layout === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
      {(config.items || []).map((item, i) => (
        <div key={i} className={`flex gap-3 ${config.layout === 'icons' ? 'flex-col items-center text-center' : 'items-start'}`}>
          <span className="text-xl flex-shrink-0">{item.icon || '✓'}</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{item.text}</p>
            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const TestimonialsPreview = ({ config }) => (
  <div className="px-6 py-6">
    {config.title && <h2 className="text-lg font-bold text-gray-900 mb-4">{config.title}</h2>}
    <div className="space-y-3">
      {(config.items || []).map((item, i) => (
        <div key={i} className="bg-gray-50 rounded-xl p-4">
          {config.showRating !== false && <div className="text-yellow-400 text-sm mb-1">{'★'.repeat(item.rating || 5)}{'☆'.repeat(5 - (item.rating || 5))}</div>}
          <p className="text-sm text-gray-700 mb-2 italic">"{item.text}"</p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{(item.name || '?')[0]}</div>
            <div>
              <p className="text-xs font-semibold text-gray-900">{item.name}{config.showVerified !== false && item.verified && <span className="text-emerald-500 ml-1">✓</span>}</p>
              {item.location && <p className="text-[10px] text-gray-400">{item.location}{item.date ? ` · ${item.date}` : ''}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const FaqPreview = ({ config }) => {
  const [open, setOpen] = React.useState(null);
  return (
    <div className="px-6 py-6">
      {config.title && <h2 className="text-lg font-bold text-gray-900 mb-4">{config.title}</h2>}
      <div className="space-y-2">
        {(config.items || []).map((item, i) => (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50">
              {item.question}
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && <div className="px-4 pb-3 text-sm text-gray-600">{item.answer}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

const CtaPreview = ({ config, design = {}, button = {} }) => {
  const btnColor = config.buttonColor || design.buttonColor || '#0F6B4F';
  const btnRadius = design.borderRadius || '12px';
  const btnText = config.buttonText || button.text || 'Commander maintenant';
  return (
    <div className="px-6 py-8 text-center bg-gray-50">
      {config.title && <h2 className="text-xl font-extrabold text-gray-900 mb-2">{config.title}</h2>}
      {config.subtitle && <p className="text-sm text-gray-500 mb-4">{config.subtitle}</p>}
      {config.urgencyText && <p className="text-sm font-semibold text-red-600 mb-3">{config.urgencyText}</p>}
      <button style={{ background: btnColor, borderRadius: btnRadius, fontWeight: design.fontWeight || '600' }}
        className="px-6 py-2.5 text-white font-bold text-sm shadow-sm">
        {btnText}
        {button.subtext && <span className="block text-[10px] font-normal opacity-80 mt-0.5">{button.subtext}</span>}
      </button>
    </div>
  );
};

const CustomPreview = ({ config }) => (
  <div className="px-6 py-6">
    {config.css && <style>{config.css}</style>}
    <div dangerouslySetInnerHTML={{ __html: config.html || '<p style="color:#999">Section personnalisée vide</p>' }} />
  </div>
);

const SectionPreview = ({ section, product, storeConfig }) => {
  const cfg = section.config || {};
  const design = storeConfig?.design || {};
  const button = storeConfig?.button || {};
  switch (section.type) {
    case 'hero': return <HeroPreview config={cfg} product={product} design={design} button={button} />;
    case 'gallery': return <GalleryPreview config={cfg} product={product} />;
    case 'description': return <DescriptionPreview config={cfg} />;
    case 'benefits': return <BenefitsPreview config={cfg} />;
    case 'testimonials': return <TestimonialsPreview config={cfg} />;
    case 'faq': return <FaqPreview config={cfg} />;
    case 'cta': return <CtaPreview config={cfg} design={design} button={button} />;
    case 'custom': return <CustomPreview config={cfg} />;
    default: return <div className="px-6 py-4 text-sm text-gray-400">Section inconnue</div>;
  }
};

// ─── Section config editor router ────────────────────────────────────────────
const SectionConfigEditor = ({ section, onChange }) => {
  const cfg = section.config || {};
  const update = (newCfg) => onChange({ ...section, config: newCfg });

  switch (section.type) {
    case 'hero': return <HeroEditor config={cfg} onChange={update} />;
    case 'gallery': return <GalleryEditor config={cfg} onChange={update} />;
    case 'description': return <DescriptionEditor config={cfg} onChange={update} />;
    case 'benefits': return <BenefitsEditor config={cfg} onChange={update} />;
    case 'testimonials': return <TestimonialsEditor config={cfg} onChange={update} />;
    case 'faq': return <FaqEditor config={cfg} onChange={update} />;
    case 'cta': return <CtaEditor config={cfg} onChange={update} />;
    case 'custom': return <CustomEditor config={cfg} onChange={update} />;
    default: return <p className="text-sm text-gray-400">Aucun éditeur disponible</p>;
  }
};

// ─── Section card (list item) ────────────────────────────────────────────────
const ConfigSectionCard = ({ section, index, total, onMove, onToggle, isActive, onClick }) => {
  const meta = SECTION_META[section.id] || { label: section.label, desc: '', icon: Layers, color: 'bg-gray-100 text-gray-700 border-gray-200' };
  const Icon = meta.icon;

  return (
    <div
      className={`group bg-white rounded-xl border-2 transition-all cursor-pointer ${
        isActive ? 'border-[#0F6B4F] shadow-md' : section.enabled !== false ? 'border-gray-200 hover:border-[#4D9F82]' : 'border-gray-100 opacity-60'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color.split(' ').slice(0, 2).join(' ')}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{meta.label}</p>
          <p className="text-[11px] text-gray-400 truncate">{meta.desc}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onMove(index, -1); }} disabled={index === 0}
            className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition" title="Monter">
            <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button onClick={e => { e.stopPropagation(); onMove(index, 1); }} disabled={index === total - 1}
            className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition" title="Descendre">
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button onClick={e => { e.stopPropagation(); onToggle(section.id); }}
            className="p-1 rounded-lg hover:bg-gray-100 transition" title={section.enabled !== false ? 'Masquer' : 'Afficher'}>
            {section.enabled !== false ? <Eye className="w-3.5 h-3.5 text-gray-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────
const ProductPageBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/ecom/boutique') ? '/ecom/boutique' : '/ecom/store';
  const { activeStore } = useStore();

  const [product, setProduct] = useState(null);
  const [sections, setSections] = useState([]);
  const [builderEnabled, setBuilderEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saved' | 'error' | null
  const [activeSection, setActiveSection] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'mobile' | 'tablet' | 'desktop'
  const [storeConfig, setStoreConfig] = useState(null); // productPageConfig from store settings
  const [configSections, setConfigSections] = useState([]); // the 20 sections from productPageConfig
  const [activeConfigSection, setActiveConfigSection] = useState(null);
  const [error, setError] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [storeSubdomain, setStoreSubdomain] = useState(''); // fallback subdomain from config API
  const iframeRef = useRef(null);

  // Compute merged config for LivePreview
  const mergedConfig = (() => {
    const base = mergeWithDefaults(storeConfig);
    return { ...base, general: { ...base.general, sections: configSections } };
  })();

  const subdomain = activeStore?.subdomain || storeSubdomain;

  // postMessage live preview — Shopify-style: parent → iframe, no server round-trip
  const broadcastLive = useCallback((updatedConfig, updatedSections) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const liveConfig = {
      ...mergeWithDefaults(updatedConfig),
      general: {
        ...mergeWithDefaults(updatedConfig).general,
        sections: updatedSections,
      },
    };
    iframe.contentWindow.postMessage(
      { type: 'PAGE_PREVIEW_UPDATE', payload: liveConfig },
      '*'
    );
  }, []);

  // Load product + store config
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [productRes, configRes] = await Promise.all([
          storeProductsApi.getProduct(id),
          storeManageApi.getStoreConfig().catch(() => null),
        ]);
        const p = productRes.data?.data || productRes.data;
        setProduct(p);
        const pb = p?.pageBuilder;
        if (pb?.enabled && Array.isArray(pb.sections) && pb.sections.length > 0) {
          setSections(pb.sections);
          setBuilderEnabled(true);
        }
        // Load store productPageConfig & init configSections
        if (configRes) {
          const raw = configRes.data?.data || configRes.data || {};
          const ppc = raw.storeSettings?.productPageConfig || raw.productPageConfig || null;
          setStoreConfig(ppc);
          const merged = mergeWithDefaults(ppc);
          setConfigSections(merged.general.sections);
          // Extract subdomain as fallback for iframe preview
          if (raw.subdomain) setStoreSubdomain(raw.subdomain);
        } else {
          setConfigSections(mergeWithDefaults(null).general.sections);
        }
      } catch (err) {
        setError('Impossible de charger le produit');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Auto-save pageBuilder with debounce
  const saveTimer = useRef(null);
  const autoSave = useCallback((newSections, enabled) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await storeProductsApi.savePageBuilder(id, { enabled, sections: newSections });
        setSaveStatus('saved');
        setIframeKey(k => k + 1);
        setTimeout(() => setSaveStatus(null), 2000);
      } catch {
        setSaveStatus('error');
      }
    }, 1200);
  }, [id]);

  // Auto-save productPageConfig sections with debounce
  // IMPORTANT: Only save general.sections — never overwrite form/design/button/conversion
  const configSaveTimer = useRef(null);
  const autoSaveConfig = useCallback((newConfigSections) => {
    // Broadcast live immediately (debounced 150ms)
    broadcastLive(storeConfig, newConfigSections);
    clearTimeout(configSaveTimer.current);
    configSaveTimer.current = setTimeout(async () => {
      try {
        // Preserve existing config — only update general.sections
        const existing = storeConfig || {};
        const updatedConfig = {
          ...existing,
          general: {
            ...(existing.general || {}),
            sections: newConfigSections,
          },
        };
        await storeManageApi.updateStoreConfig({ productPageConfig: updatedConfig });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch {
        setSaveStatus('error');
      }
    }, 1200);
  }, [storeConfig, broadcastLive]);

  // Config section handlers
  const handleConfigMove = useCallback((index, direction) => {
    setConfigSections(prev => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      autoSaveConfig(next);
      return next;
    });
  }, [autoSaveConfig]);

  const handleConfigDragDrop = useCallback((fromIndex, toIndex) => {
    setConfigSections(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      autoSaveConfig(next);
      return next;
    });
  }, [autoSaveConfig]);

  const handleConfigToggle = useCallback((sectionId) => {
    setConfigSections(prev => {
      const next = prev.map(s => s.id === sectionId ? { ...s, enabled: !s.enabled } : s);
      autoSaveConfig(next);
      return next;
    });
  }, [autoSaveConfig]);

  const handleConfigContentChange = useCallback((updatedSection) => {
    setConfigSections(prev => {
      const next = prev.map(s => s.id === updatedSection.id ? updatedSection : s);
      autoSaveConfig(next);
      return next;
    });
  }, [autoSaveConfig]);

  const updateSections = useCallback((newSections) => {
    setSections(newSections);
    autoSave(newSections, builderEnabled);
  }, [autoSave, builderEnabled]);

  const handleMove = useCallback((index, direction) => {
    setSections(prev => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      autoSave(next, builderEnabled);
      return next;
    });
  }, [autoSave, builderEnabled]);

  const handleToggle = useCallback((sectionId) => {
    setSections(prev => {
      const next = prev.map(s => s.id === sectionId ? { ...s, visible: s.visible === false ? true : false } : s);
      autoSave(next, builderEnabled);
      return next;
    });
  }, [autoSave, builderEnabled]);

  const handleDelete = useCallback((sectionId) => {
    if (!confirm('Supprimer cette section ?')) return;
    setSections(prev => {
      const next = prev.filter(s => s.id !== sectionId);
      autoSave(next, builderEnabled);
      if (activeSection?.id === sectionId) setActiveSection(null);
      return next;
    });
  }, [autoSave, builderEnabled, activeSection]);

  const handleUpdateSection = useCallback((updated) => {
    setSections(prev => {
      const next = prev.map(s => s.id === updated.id ? updated : s);
      autoSave(next, builderEnabled);
      return next;
    });
    setActiveSection(updated);
  }, [autoSave, builderEnabled]);

  const handleAddSection = useCallback((type) => {
    const newSection = buildSection(type);
    setSections(prev => {
      const next = [...prev, newSection];
      autoSave(next, builderEnabled);
      return next;
    });
    setActiveSection(newSection);
    setShowAddModal(false);
  }, [autoSave, builderEnabled]);

  const handleApplyTemplate = useCallback((templateKey) => {
    const tpl = TEMPLATES[templateKey];
    if (!tpl) return;
    if (!confirm(`Appliquer le template "${tpl.label}" ? Les sections actuelles seront remplacées.`)) return;
    const newSections = tpl.sections.map(s => ({ ...s, id: genId(), visible: true }));
    setSections(newSections);
    autoSave(newSections, true);
    setBuilderEnabled(true);
    setShowTemplates(false);
    setActiveSection(null);
  }, [autoSave]);

  const handleToggleBuilder = useCallback(async (enabled) => {
    setBuilderEnabled(enabled);
    try {
      await storeProductsApi.savePageBuilder(id, { enabled, sections });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [id, sections]);

  const handleManualSave = async () => {
    setSaving(true);
    try {
      await storeProductsApi.savePageBuilder(id, { enabled: builderEnabled, sections });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F6B4F]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error}</p>
        <button onClick={() => navigate(`${basePath}/products`)} className="mt-4 px-4 py-2 bg-gray-100 rounded-lg text-sm">Retour</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      {/* ─── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => navigate(`${basePath}/products/${id}/edit`)}
          className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0F6B4F]" />
            <span className="text-sm font-bold text-gray-900 truncate">Page Builder</span>
            {product?.name && <span className="text-xs text-gray-400 truncate hidden sm:block">· {product.name}</span>}
          </div>
        </div>

        {/* Builder toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 hidden sm:block">Builder actif</span>
          <button onClick={() => handleToggleBuilder(!builderEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors ${builderEnabled ? 'bg-[#0F6B4F]' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${builderEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Templates */}
        <button onClick={() => setShowTemplates(!showTemplates)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          <Copy className="w-4 h-4" />
          <span className="hidden sm:block">Templates</span>
        </button>

        {/* Preview device toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setPreviewDevice('desktop')}
            className={`p-1.5 rounded-md transition ${previewDevice === 'desktop' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
            <Monitor className="w-4 h-4" />
          </button>
          <button onClick={() => setPreviewDevice('tablet')}
            className={`p-1.5 rounded-md transition ${previewDevice === 'tablet' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            title="Tablette">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg>
          </button>
          <button onClick={() => setPreviewDevice('mobile')}
            className={`p-1.5 rounded-md transition ${previewDevice === 'mobile' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        {/* Save */}
        <button onClick={handleManualSave} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition shadow-sm ${
            saveStatus === 'saved' ? 'bg-green-500' : saveStatus === 'error' ? 'bg-red-500' : 'bg-[#0F6B4F] hover:bg-[#0A5740]'
          } disabled:opacity-60`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveStatus === 'saved' ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span className="hidden sm:block">{saving ? 'Enregistrement...' : saveStatus === 'saved' ? 'Sauvegardé' : 'Sauvegarder'}</span>
        </button>
      </div>

      {/* ─── Templates overlay ───────────────────────────────────────────── */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Templates de page produit</h3>
                <p className="text-xs text-gray-500 mt-0.5">Prêts en 30 secondes, personnalisables à 100%</p>
              </div>
              <button onClick={() => setShowTemplates(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 gap-3">
              {Object.entries(TEMPLATES).map(([key, tpl]) => (
                <button key={key} onClick={() => handleApplyTemplate(key)}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left hover:shadow-md transition ${tpl.color}`}>
                  <span className="text-3xl">{tpl.emoji}</span>
                  <div>
                    <p className="font-bold text-gray-900">{tpl.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tpl.sections.length} sections préconfigurées · Personnalisable</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                </button>
              ))}
              <button onClick={() => { setSections([]); setBuilderEnabled(true); setShowTemplates(false); }}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-gray-200 text-left hover:border-[#4D9F82] hover:bg-green-50 transition">
                <span className="text-3xl">⬜</span>
                <div>
                  <p className="font-bold text-gray-900">Page vierge</p>
                  <p className="text-xs text-gray-500 mt-0.5">Construire de zéro avec vos propres sections</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main layout: Shopify-style sidebar + iframe preview ────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR (Shopify-style: sections list OR section editor) ── */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">

          {activeConfigSection ? (() => {
            /* ── SECTION EDITOR (inline, replaces list) ── */
            const sec = configSections.find(s => s.id === activeConfigSection);
            if (!sec) return null;
            const meta = SECTION_META[sec.id] || { label: sec.label, desc: '', icon: Layers, color: 'bg-gray-100 text-gray-700 border-gray-200' };
            const SectionIcon = meta.icon;
            return (
              <>
                {/* Back button header */}
                <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                  <button onClick={() => setActiveConfigSection(null)}
                    className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-900 font-medium transition">
                    <ChevronLeft className="w-4 h-4" />
                    Sections
                  </button>
                  <span className="text-gray-300 text-sm">·</span>
                  <span className="text-[12px] font-semibold text-gray-800 truncate flex items-center gap-1.5"><SectionIcon className="w-3.5 h-3.5" /> {meta.label}</span>
                  <div className="ml-auto">
                    <button onClick={() => handleConfigToggle(sec.id)}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${sec.enabled !== false ? 'bg-[#0F6B4F]' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sec.enabled !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {/* Editor content */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4">
                    <SectionContentEditor
                      section={sec}
                      onChange={handleConfigContentChange}
                      product={product}
                    />
                  </div>
                </div>
              </>
            );
          })() : (
            /* ── SECTIONS LIST ── */
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900">Sections</h2>
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {configSections.filter(s => s.enabled !== false).length}/{configSections.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {configSections.map((section, idx) => {
                  const meta = SECTION_META[section.id] || { label: section.id, desc: '', icon: Layers, color: 'bg-gray-100 text-gray-700' };
                  const SectionIcon = meta.icon;
                  const isEnabled = section.enabled !== false;
                  return (
                    <div key={section.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', idx.toString()); e.currentTarget.classList.add('opacity-50'); }}
                      onDragEnd={e => { e.currentTarget.classList.remove('opacity-50'); }}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('ring-2', 'ring-[#0F6B4F]'); }}
                      onDragLeave={e => { e.currentTarget.classList.remove('ring-2', 'ring-[#0F6B4F]'); }}
                      onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('ring-2', 'ring-[#0F6B4F]'); const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(fromIdx) && fromIdx !== idx) handleConfigDragDrop(fromIdx, idx); }}
                      className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-all border ${
                        isEnabled
                          ? 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                          : 'border-transparent opacity-50 hover:opacity-70 hover:bg-gray-50'
                      }`}
                      onClick={() => setActiveConfigSection(section.id)}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${meta.color.split(' ').slice(0, 2).join(' ')}`}>
                        <SectionIcon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-gray-800 truncate">{meta.label}</p>
                        {!isEnabled && <p className="text-[10px] text-gray-400">Masquée</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); handleConfigMove(idx, -1); }} disabled={idx === 0}
                          className="p-1 rounded hover:bg-gray-200 disabled:opacity-20">
                          <ChevronUp className="w-3 h-3 text-gray-500" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleConfigMove(idx, 1); }} disabled={idx === configSections.length - 1}
                          className="p-1 rounded hover:bg-gray-200 disabled:opacity-20">
                          <ChevronDown className="w-3 h-3 text-gray-500" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleConfigToggle(section.id); }}
                          className="p-1 rounded hover:bg-gray-200">
                          {isEnabled ? <Eye className="w-3 h-3 text-gray-500" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                        </button>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </>
          )}

        </div>

        {/* ── RIGHT: iframe live preview ────────────────��─────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {(() => {
            const slug = product?.slug;
            const iframeSrc = subdomain && slug ? `/store/${subdomain}/product/${slug}` : null;
            const deviceConfig = {
              desktop: { width: '100%', label: null },
              tablet:  { width: '768px', label: 'Tablette — 768px' },
              mobile:  { width: '390px', label: 'Mobile — 390px' },
            };
            const { width, label } = deviceConfig[previewDevice] || deviceConfig.desktop;

            if (!iframeSrc) {
              return (
                <div className="flex-1 bg-gray-50 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="text-4xl mb-3">🏪</div>
                    <p className="text-sm font-medium">Aperçu indisponible</p>
                    <p className="text-xs mt-1">{!subdomain ? 'Aucun sous-domaine configuré' : 'Aucun produit chargé'}</p>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex-1 bg-[#e8eaed] flex flex-col overflow-hidden">
                {label && (
                  <div className="flex justify-center pt-2 pb-1 text-xs text-gray-400 font-medium select-none">{label}</div>
                )}
                <div className="flex-1 flex items-start justify-center overflow-auto p-3 pt-1">
                  <div
                    className="shadow-xl rounded-t-lg overflow-hidden bg-white"
                    style={{ width, maxWidth: '100%', height: previewDevice === 'desktop' ? 'calc(100vh - 120px)' : 'calc(100vh - 140px)' }}
                  >
                    {/* Browser chrome */}
                    <div className="h-8 bg-gray-100 border-b border-gray-200 flex items-center px-3 gap-2 select-none shrink-0">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                      </div>
                      <div className="flex-1 bg-white rounded px-2 py-0.5 text-[10px] text-gray-400 font-mono border border-gray-200 truncate">
                        {subdomain}.scalor.net/product/{slug}
                      </div>
                      <button onClick={() => setIframeKey(k => k + 1)}
                        className="p-1 hover:bg-gray-200 rounded transition" title="Rafraîchir">
                        <svg className="w-3 h-3 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                      </button>
                    </div>

                    <iframe
                      key={iframeKey}
                      ref={iframeRef}
                      src={iframeSrc}
                      title="Aperçu page produit"
                      className="block w-full border-0"
                      style={{ height: 'calc(100% - 32px)' }}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      onLoad={() => broadcastLive(storeConfig, configSections)}
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default ProductPageBuilder;
