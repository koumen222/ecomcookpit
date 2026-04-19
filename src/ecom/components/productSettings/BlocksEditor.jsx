import React, { useMemo, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, ChevronDown, ChevronUp, Plus, Trash2, Star, Upload, Loader2, AlertCircle, X, Image } from 'lucide-react';
import { storeProductsApi } from '../../services/storeApi.js';

const SECTION_META = {
  heroSlogan:       { icon: '✍️', desc: 'Sous-titre marketing généré par IA' },
  heroBaseline:     { icon: '✅', desc: 'Phrase de réassurance sous le titre' },
  reviews:          { icon: '⭐', desc: 'Étoiles et nombre d\'avis' },
  orderForm:        { icon: '🛒', desc: 'Bouton / Formulaire de commande' },
  productGallery:   { icon: '🖼️', desc: 'Titre, photos et tailles de la galerie' },
  statsBar:         { icon: '📊', desc: 'Chiffres de preuve sociale' },
  stockCounter:     { icon: '📦', desc: 'Stock restant urgence' },
  urgencyBadge:     { icon: '🔥', desc: 'Badge d\'urgence IA' },
  urgencyElements:  { icon: '⏰', desc: 'Stock limité, preuve sociale' },
  benefitsBullets:  { icon: '💥', desc: 'Liste des bénéfices' },
  conversionBlocks: { icon: '🛡️', desc: 'Blocs de réassurance' },
  offerBlock:       { icon: '🎁', desc: 'Garantie / offre spéciale' },
  description:      { icon: '📝', desc: 'Description complète' },
  problemSection:   { icon: '😰', desc: 'Points de douleur client' },
  solutionSection:  { icon: '💡', desc: 'Solution persuasive' },
  faq:              { icon: '❓', desc: 'Questions fréquentes' },
  testimonials:     { icon: '💬', desc: 'Témoignages clients' },
  relatedProducts:  { icon: '🔗', desc: 'Produits similaires' },
  stickyOrderBar:   { icon: '📌', desc: 'Barre fixe Commander' },
  upsell:           { icon: '🚀', desc: 'Produit de valeur supérieure' },
  orderBump:        { icon: '🛒', desc: 'Produit complémentaire' },
};

// ── Which sections have editable content ──────────────────────────────────────
const EDITABLE_SECTIONS = {
  heroSlogan:      { fields: [{ key: 'text', label: 'Slogan marketing', placeholder: 'Ex: Découvrez le secret des pros…', type: 'text' }] },
  heroBaseline:    { fields: [{ key: 'text', label: 'Phrase de réassurance', placeholder: 'Ex: Résultats visibles en 7 jours', type: 'text' }] },
  urgencyBadge:    { fields: [{ key: 'text', label: 'Texte d\'urgence', placeholder: 'Ex: ⚡ Dernières pièces — 3 restants !', type: 'text' }] },
  statsBar:        { fields: 'stats' },
  productGallery:  { fields: 'productGallery' },
  benefitsBullets: { fields: 'list', label: 'Bénéfices', placeholder: 'Ex: Résultats en 7 jours' },
  problemSection:  { fields: [
    { key: 'title', label: 'Titre', placeholder: 'Ex: Le problème', type: 'text' },
    { key: 'painPoints', label: 'Points', type: 'list', placeholder: 'Ex: Maux de dos fréquents' },
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

// ── Inline content editor for a section ───────────────────────────────────────
const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 transition-all bg-white";

const EMPTY_TESTIMONIAL = { name: '', location: '', rating: 5, text: '', verified: true, date: '', image: '' };

// Helper component for a single testimonial card with avatar upload
const BlocksTestimonialCard = ({ t, i, updateT, removeT }) => {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await storeProductsApi.uploadImages([file]);
      const uploaded = res.data?.data || res.data?.urls || res.data?.images || [];
      const url = (Array.isArray(uploaded) ? uploaded : []).map(item => typeof item === 'string' ? item : item?.url).filter(Boolean)[0];
      if (url) updateT(i, 'image', url);
    } catch (err) {
      console.error('Testimonial avatar upload failed:', err);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="rounded-lg border border-gray-100 p-2.5 bg-gray-50/50 space-y-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Avis #{i + 1}</span>
        <button onClick={() => removeT(i)} className="p-0.5 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
      </div>
      {/* Avatar upload */}
      <div className="flex items-center gap-2">
        {t.image ? (
          <div className="relative group">
            <img src={t.image} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-gray-200" />
            <button type="button" onClick={() => updateT(i, 'image', '')}
              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
            <Image className="w-3.5 h-3.5 text-gray-400" />
          </div>
        )}
        <label className="flex items-center gap-1 px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          <span>{t.image ? 'Changer' : 'Photo'}</span>
          <input type="file" accept="image/*" className="hidden"
            onChange={e => handleUpload(e.target.files?.[0])} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input className={inputCls} value={t.name} onChange={e => updateT(i, 'name', e.target.value)} placeholder="Prénom Nom" />
        <input className={inputCls} value={t.location || ''} onChange={e => updateT(i, 'location', e.target.value)} placeholder="Ville" />
      </div>
      <textarea className={inputCls + ' resize-none'} rows={2} value={t.text} onChange={e => updateT(i, 'text', e.target.value)} placeholder="Texte du témoignage…" />
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map(n => (
            <button key={n} type="button" onClick={() => updateT(i, 'rating', n)}
              className={`transition-colors ${n <= (t.rating || 5) ? 'text-amber-400' : 'text-gray-200'}`}>
              <Star size={14} fill="currentColor" />
            </button>
          ))}
        </div>
        <input className={inputCls + ' flex-1'} value={t.date || ''} onChange={e => updateT(i, 'date', e.target.value)} placeholder="Ex: Il y a 2 jours" />
      </div>
    </div>
  );
};
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

const SectionContentEditor = ({ section, onChange }) => {
  const schema = EDITABLE_SECTIONS[section.id];
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryUploadError, setGalleryUploadError] = useState('');
  if (!schema) return (
    <div className="text-[11px] text-gray-400 italic py-1">Contenu généré automatiquement par l'IA</div>
  );

  const content = section.content || {};
  const update = (key, val) => onChange({ ...section, content: { ...content, [key]: val } });

  // ── Stats editor ──
  if (schema.fields === 'stats') {
    const stats = content.stats || [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }];
    const updateStat = (i, key, val) => {
      const copy = [...stats];
      copy[i] = { ...copy[i], [key]: val };
      update('stats', copy);
    };
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-gray-500 mb-1">Statistiques (3 max)</div>
        {stats.slice(0, 3).map((st, i) => (
          <div key={i} className="flex gap-2">
            <input className={inputCls + " w-20 shrink-0"} value={st.value} onChange={e => updateStat(i, 'value', e.target.value)}
              placeholder="1200+" />
            <input className={inputCls + " flex-1"} value={st.label} onChange={e => updateStat(i, 'label', e.target.value)}
              placeholder="Clients satisfaits" />
          </div>
        ))}
        <div className="text-[10px] text-gray-400">Laissez vide pour utiliser les données IA</div>
      </div>
    );
  }

  // ── List editor (benefits, pain points) ──
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
            <input className={inputCls + " flex-1"} value={item} onChange={e => updateItem(i, e.target.value)}
              placeholder={schema.placeholder} />
            {items.length > 1 && (
              <button onClick={() => removeItem(i)} className="p-1 text-gray-300 hover:text-red-400 transition-colors shrink-0"><Trash2 size={12} /></button>
            )}
          </div>
        ))}
        <button onClick={addItem} className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium hover:text-emerald-700 mt-1">
          <Plus size={12} /> Ajouter
        </button>
        <div className="text-[10px] text-gray-400">Laissez vide pour utiliser les données IA</div>
      </div>
    );
  }

  // ── FAQ editor ──
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
              <input className={inputCls + " flex-1"} value={item.question} onChange={e => updateFaq(i, 'question', e.target.value)}
                placeholder="Question…" />
              {items.length > 1 && (
                <button onClick={() => removeFaq(i)} className="p-1 text-gray-300 hover:text-red-400 transition-colors shrink-0"><Trash2 size={12} /></button>
              )}
            </div>
            <textarea className={inputCls + " resize-none"} rows={2} value={item.answer} onChange={e => updateFaq(i, 'answer', e.target.value)}
              placeholder="Réponse…" />
          </div>
        ))}
        <button onClick={addFaq} className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium hover:text-emerald-700 mt-1">
          <Plus size={12} /> Ajouter une question
        </button>
        <div className="text-[10px] text-gray-400">Laissez vide pour utiliser les données IA / produit</div>
      </div>
    );
  }

  // ── Testimonials editor ──
  if (schema.fields === 'testimonials') {
    const items = content.items || [];
    const updateT = (i, key, val) => { const copy = [...items]; copy[i] = { ...copy[i], [key]: val }; update('items', copy); };
    const addT = () => update('items', [...items, { ...EMPTY_TESTIMONIAL }]);
    const removeT = (i) => update('items', items.filter((_, idx) => idx !== i));
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-gray-500">Témoignages clients</span>
          <span className="text-[10px] text-gray-400">{items.length} ajouté{items.length !== 1 ? 's' : ''}</span>
        </div>
        {items.length === 0 && (
          <div className="text-[11px] text-gray-400 italic py-1 text-center">
            Aucun témoignage — les données IA / produit seront utilisées
          </div>
        )}
        {items.map((t, i) => (
          <BlocksTestimonialCard key={i} t={t} i={i} updateT={updateT} removeT={removeT} />
        ))}
        <button onClick={addT} className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium hover:text-emerald-700 mt-1">
          <Plus size={12} /> Ajouter un témoignage
        </button>
      </div>
    );
  }

  if (schema.fields === 'productGallery') {
    const gallery = { ...PRODUCT_GALLERY_DEFAULTS, ...content };
    const images = gallery.images || [];
    const mainImageHeight = normalizeToPreset(gallery.mainImageHeight, MAIN_IMAGE_HEIGHT_OPTIONS, PRODUCT_GALLERY_DEFAULTS.mainImageHeight);
    const thumbnailSize = normalizeToPreset(gallery.thumbnailSize, THUMBNAIL_SIZE_OPTIONS, PRODUCT_GALLERY_DEFAULTS.thumbnailSize);
    const updateImage = (index, key, val) => {
      const nextImages = [...images];
      nextImages[index] = { ...nextImages[index], [key]: val };
      update('images', nextImages);
    };
    const addImage = () => update('images', [...images, { url: '', alt: '' }]);
    const removeImage = (index) => update('images', images.filter((_, idx) => idx !== index));
    const uploadImages = async (files, replaceIndex = null) => {
      if (!files?.length) return;
      setGalleryUploading(true);
      setGalleryUploadError('');
      try {
        const res = await storeProductsApi.uploadImages(Array.from(files));
        const uploaded = res.data?.data || [];
        const urls = (Array.isArray(uploaded) ? uploaded : []).map(img => typeof img === 'string' ? img : img?.url).filter(Boolean);
        if (!urls.length) {
          setGalleryUploadError('Aucune URL retournée par le serveur.');
          return;
        }

        if (replaceIndex !== null && urls[0]) {
          updateImage(replaceIndex, 'url', urls[0]);
          return;
        }

        const nextImages = [
          ...images,
          ...urls.map((url) => ({ url, alt: '' })),
        ];
        update('images', nextImages);
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
      update('images', nextImages);
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

  // ── Standard fields (text, textarea, nested list, checkbox, number) ──
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
            {items.length > 1 && <button onClick={() => removeItem(i)} className="p-1 text-gray-300 hover:text-red-400 transition-colors shrink-0"><Trash2 size={12} /></button>}
          </div>
        ))}
        <button onClick={addItem} className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium hover:text-emerald-700 mt-1"><Plus size={12} /> Ajouter</button>
        <div className="text-[10px] text-gray-400">Laissez vide pour utiliser les données IA</div>
      </div>
    );
  }

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
                  <input className={inputCls + " flex-1"} value={item} onChange={e => updateItem(i, e.target.value)}
                    placeholder={field.placeholder} />
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="p-1 text-gray-300 hover:text-red-400 transition-colors shrink-0"><Trash2 size={12} /></button>
                  )}
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

// ── Sortable block with expandable content editor ─────────────────────────────
const SortableBlock = ({ section, index, onToggle, isExpanded, onExpand, onContentChange }) => {
  const meta = SECTION_META[section.id] || { icon: '📄', desc: '' };
  const hasEditor = !!EDITABLE_SECTIONS[section.id];
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border transition-all ${
        isDragging ? 'shadow-lg ring-2 ring-indigo-300/40' : ''
      } ${
        section.enabled
          ? 'border-emerald-200/60 bg-emerald-50/40 hover:bg-emerald-50/70'
          : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'
      }`}
    >
      <div className="group flex items-center gap-3 px-3.5 py-2.5">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1 -ml-1 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/70 transition-colors touch-none"
          tabIndex={-1}
        >
          <GripVertical size={14} className="text-gray-300 group-hover:text-gray-400" />
        </button>

        {/* Position */}
        <span className="w-5 h-5 rounded-md bg-white text-gray-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-gray-100 shadow-sm">
          {index + 1}
        </span>

        {/* Icon */}
        <span className="text-sm shrink-0">{meta.icon}</span>

        {/* Label + desc — clickable to expand */}
        <button
          onClick={() => hasEditor && section.enabled && onExpand(section.id)}
          className={`flex-1 min-w-0 text-left ${hasEditor && section.enabled ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span className={`text-[13px] font-semibold leading-tight block ${
            section.enabled ? 'text-gray-800' : 'text-gray-400'
          }`}>
            {section.label}
          </span>
          <span className="text-[10px] text-gray-400 leading-tight block mt-0.5 truncate">
            {meta.desc}
          </span>
        </button>

        {/* Expand indicator */}
        {hasEditor && section.enabled && (
          <button onClick={() => onExpand(section.id)} className="p-1 shrink-0 text-gray-300 hover:text-emerald-500 transition-colors">
            <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}

        {/* Toggle */}
        <button
          onClick={() => onToggle(section.id)}
          className={`relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
            section.enabled ? 'bg-emerald-500' : 'bg-gray-200'
          }`}
        >
          <span className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition duration-200 ${
            section.enabled ? 'translate-x-[18px]' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Expanded content editor */}
      {isExpanded && section.enabled && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100/60">
          <SectionContentEditor section={section} onChange={onContentChange} />
        </div>
      )}
    </div>
  );
};

const BlocksEditor = ({ sections, onChange }) => {
  const [expandedId, setExpandedId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const ids = useMemo(() => sections.map(s => s.id), [sections]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex(s => s.id === active.id);
    const newIdx = sections.findIndex(s => s.id === over.id);
    onChange(arrayMove(sections, oldIdx, newIdx));
  };

  const handleToggle = (id) => {
    onChange(sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const handleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleContentChange = (updatedSection) => {
    onChange(sections.map(s => s.id === updatedSection.id ? updatedSection : s));
  };

  const enabledCount = sections.filter(s => s.enabled).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">
            {enabledCount}/{sections.length} sections actives
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => onChange(sections.map(s => ({ ...s, enabled: true })))}
            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            <Eye size={11} className="inline mr-1" />Tout activer
          </button>
          <button
            onClick={() => onChange(sections.map(s => ({ ...s, enabled: false })))}
            className="text-[10px] font-medium text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <EyeOff size={11} className="inline mr-1" />Tout masquer
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {sections.map((section, index) => (
              <SortableBlock
                key={section.id}
                section={section}
                index={index}
                onToggle={handleToggle}
                isExpanded={expandedId === section.id}
                onExpand={handleExpand}
                onContentChange={handleContentChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default BlocksEditor;
