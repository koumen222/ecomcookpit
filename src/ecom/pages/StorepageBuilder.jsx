import React, {
  useState, useEffect, useCallback, useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft, Save, Check, Loader2, Eye, Monitor, Smartphone, Tablet,
  RefreshCw, ExternalLink, Plus, GripVertical, EyeOff, Trash2, Copy,
  ChevronLeft, ChevronRight, Image, X, Upload, AlertCircle, Layers,
  Type, Star, HelpCircle, Phone, Layout, Zap, ShoppingBag, AlignLeft,
  AlignCenter, AlignRight, ChevronDown, ChevronUp, Pencil, Undo2, Redo2,
} from 'lucide-react';
import { storeManageApi, storeProductsApi } from '../services/storeApi';
import ecomApi from '../services/ecommApi.js';
import BuilderAiChat from '../components/BuilderAiChat.jsx';
import { useStore } from '../contexts/StoreContext.jsx';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';

// ─── Section type registry ────────────────────────────────────────────────────

const SECTION_TYPES = {
  hero: {
    label: 'Hero Banner',
    icon: <Zap className="w-4 h-4" />,
    color: '#6366f1',
    category: 'Marketing',
    defaults: {
      title: 'Votre titre accrocheur',
      subtitle: 'Une description courte et percutante de votre offre',
      ctaText: 'Commander maintenant',
      ctaLink: '#products',
      backgroundImage: '',
      backgroundType: 'color',
      backgroundColor: '#0F6B4F',
      overlay: true,
      overlayOpacity: 50,
      alignment: 'center',
      minHeight: 500,
      textColor: '#ffffff',
    },
  },
  products: {
    label: 'Grille Produits',
    icon: <ShoppingBag className="w-4 h-4" />,
    color: '#10b981',
    category: 'E-commerce',
    defaults: {
      title: 'Nos Produits',
      subtitle: '',
      layout: 'grid',
      columns: 3,
      showPrice: true,
      showAddToCart: true,
      limit: 6,
      backgroundColor: '#ffffff',
    },
  },
  text: {
    label: 'Texte',
    icon: <Type className="w-4 h-4" />,
    color: '#3b82f6',
    category: 'Contenu',
    defaults: {
      title: 'Votre titre',
      content: 'Votre contenu ici...',
      alignment: 'left',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      padding: 'md',
    },
  },
  image_text: {
    label: 'Image + Texte',
    icon: <Image className="w-4 h-4" />,
    color: '#8b5cf6',
    category: 'Contenu',
    defaults: {
      title: 'Titre de section',
      content: 'Décrivez votre produit ou service ici.',
      image: '',
      imageAlt: '',
      layout: 'image-left',
      backgroundColor: '#ffffff',
      ctaText: '',
      ctaLink: '',
    },
  },
  gallery: {
    label: 'Galerie',
    icon: <Layers className="w-4 h-4" />,
    color: '#f59e0b',
    category: 'Contenu',
    defaults: {
      title: 'Galerie',
      images: [],
      columns: 3,
      backgroundColor: '#f9fafb',
    },
  },
  testimonials: {
    label: 'Témoignages',
    icon: <Star className="w-4 h-4" />,
    color: '#f59e0b',
    category: 'Social Proof',
    defaults: {
      title: 'Ce que disent nos clients',
      items: [
        { name: 'Marie K.', location: 'Douala', content: 'Service excellent, livraison rapide !', rating: 5 },
        { name: 'Jean P.', location: 'Yaoundé', content: 'Produits de qualité.', rating: 5 },
      ],
      layout: 'grid',
      showRating: true,
      backgroundColor: '#f9fafb',
    },
  },
  faq: {
    label: 'FAQ',
    icon: <HelpCircle className="w-4 h-4" />,
    color: '#ef4444',
    category: 'Support',
    defaults: {
      title: 'Questions fréquentes',
      items: [
        { question: 'Comment passer commande ?', answer: 'Commandez directement via le site ou WhatsApp.' },
        { question: 'Délais de livraison ?', answer: '24h à 72h selon votre zone géographique.' },
      ],
      backgroundColor: '#ffffff',
    },
  },
  contact: {
    label: 'Contact',
    icon: <Phone className="w-4 h-4" />,
    color: '#0891b2',
    category: 'Support',
    defaults: {
      title: 'Contactez-nous',
      subtitle: 'Une question ? Écrivez-nous !',
      whatsapp: '',
      email: '',
      address: '',
      backgroundColor: '#0F6B4F',
      textColor: '#ffffff',
    },
  },
  banner: {
    label: 'Bandeau CTA',
    icon: <AlignCenter className="w-4 h-4" />,
    color: '#ec4899',
    category: 'Marketing',
    defaults: {
      text: 'Offre spéciale — Livraison gratuite dès 10 000 FCFA',
      ctaText: 'En profiter',
      ctaLink: '#products',
      backgroundColor: '#fef3c7',
      textColor: '#92400e',
    },
  },
  spacer: {
    label: 'Espacement',
    icon: <Layout className="w-4 h-4" />,
    color: '#6b7280',
    category: 'Layout',
    defaults: {
      height: 60,
      backgroundColor: 'transparent',
    },
  },
  featured_collection: {
    label: 'Collection vedette',
    icon: <ShoppingBag className="w-4 h-4" />,
    color: '#10b981',
    category: 'E-commerce',
    defaults: { title: 'Notre collection', subtitle: '', category: '', limit: 4, backgroundColor: '#ffffff' },
  },
  announcement_bar: {
    label: "Barre d'annonces",
    icon: <AlignCenter className="w-4 h-4" />,
    color: '#f59e0b',
    category: 'Marketing',
    defaults: { text: '🚚 Livraison gratuite dès 15 000 FCFA — Paiement à la livraison', backgroundColor: '#1f2937', textColor: '#ffffff', link: '', linkText: '' },
  },
  rich_text: {
    label: 'Texte enrichi',
    icon: <Type className="w-4 h-4" />,
    color: '#3b82f6',
    category: 'Contenu',
    defaults: { title: '', subtitle: '', content: '', alignment: 'center', backgroundColor: '#ffffff', textColor: '#111827' },
  },
  multicolumn: {
    label: 'Multicolonne',
    icon: <Layout className="w-4 h-4" />,
    color: '#8b5cf6',
    category: 'Contenu',
    defaults: {
      title: 'Nos avantages',
      columns: 3,
      backgroundColor: '#ffffff',
      items: [
        { icon: '🚚', title: 'Livraison rapide', text: '24h à 72h partout au pays' },
        { icon: '💳', title: 'Paiement à la livraison', text: 'Payez en espèces à la réception' },
        { icon: '🔒', title: 'Achat sécurisé', text: 'Vos données sont protégées' },
      ],
    },
  },
  icon_bar: {
    label: 'Barre icônes',
    icon: <Star className="w-4 h-4" />,
    color: '#0891b2',
    category: 'Marketing',
    defaults: {
      backgroundColor: '#f9fafb',
      textColor: '#111827',
      items: [
        { icon: '🛡️', text: 'Qualité garantie' },
        { icon: '🚚', text: 'Livraison rapide' },
        { icon: '💬', text: 'Support 7j/7' },
        { icon: '↩️', text: 'Retour facile' },
      ],
    },
  },
  before_after: {
    label: 'Avant / Après',
    icon: <Image className="w-4 h-4" />,
    color: '#ec4899',
    category: 'Contenu',
    defaults: { title: 'Avant / Après', imageBefore: '', imageAfter: '', labelBefore: 'Avant', labelAfter: 'Après', backgroundColor: '#ffffff' },
  },
  video: {
    label: 'Vidéo',
    icon: <Zap className="w-4 h-4" />,
    color: '#ef4444',
    category: 'Contenu',
    defaults: { title: '', videoUrl: '', poster: '', backgroundColor: '#000000' },
  },
  pricing_table: {
    label: 'Tableau de prix',
    icon: <Star className="w-4 h-4" />,
    color: '#10b981',
    category: 'E-commerce',
    defaults: {
      title: 'Nos offres',
      backgroundColor: '#f9fafb',
      items: [
        { name: 'Starter', price: '5 000', currency: 'FCFA', period: '/mois', features: ['Feature 1', 'Feature 2'], cta: 'Choisir', highlight: false },
        { name: 'Pro', price: '15 000', currency: 'FCFA', period: '/mois', features: ['Feature 1', 'Feature 2', 'Feature 3'], cta: 'Choisir', highlight: true },
      ],
    },
  },
  ticker: {
    label: 'Ticker horizontal',
    icon: <AlignCenter className="w-4 h-4" />,
    color: '#6366f1',
    category: 'Marketing',
    defaults: { items: ['Livraison gratuite', 'Paiement à la livraison', 'Qualité garantie', 'Support 24/7'], backgroundColor: '#111827', textColor: '#ffffff', speed: 30 },
  },
  newsletter: {
    label: 'Newsletter',
    icon: <Phone className="w-4 h-4" />,
    color: '#6366f1',
    category: 'Marketing',
    defaults: { title: 'Restez informé', subtitle: 'Recevez nos offres en exclusivité', placeholder: 'Votre email', buttonText: "S'inscrire", backgroundColor: '' },
  },
};

const CATEGORIES = ['Marketing', 'E-commerce', 'Contenu', 'Social Proof', 'Support', 'Layout'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeSection(type) {
  return { id: genId(), type, visible: true, config: { ...SECTION_TYPES[type]?.defaults } };
}

// ─── Image uploader sub-component ────────────────────────────────────────────

const MEDIA_ACCEPT = 'image/*,image/gif,video/mp4,video/webm,video/quicktime';

function getBuilderMediaType(url) {
  if (!url) return 'image';
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.gif')) return 'gif';
  if (clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.mov')) return 'video';
  return 'image';
}

function MediaPreview({ src, className = 'w-full h-28 object-cover' }) {
  const type = getBuilderMediaType(src);
  if (type === 'video') return <video src={src} muted autoPlay loop playsInline className={className} />;
  return <img src={src} alt="" className={className} />;
}

function ImageUploader({ value, onChange, label = 'Image', aspectHint = '' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');
    if (!isMedia) { setError('Image, GIF ou vidéo requis'); return; }
    if (file.size > 50 * 1024 * 1024) { setError('Max 50 Mo'); return; }
    setError('');
    setUploading(true);
    try {
      const res = await storeProductsApi.uploadImages([file]);
      const url = res.data?.data?.[0]?.url;
      if (url) onChange(url);
      else setError('Upload échoué');
    } catch (e) {
      setError(e?.response?.data?.message || 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-medium text-gray-700">{label}{aspectHint && <span className="ml-1 text-gray-400">({aspectHint})</span>}</label>}
      {value ? (
        <div className="relative group rounded-lg overflow-hidden border border-gray-200">
          <MediaPreview src={value} />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
            <button onClick={() => inputRef.current?.click()} className="px-3 py-1.5 bg-white text-gray-900 text-xs font-medium rounded-lg hover:bg-gray-100">
              <Upload className="w-3 h-3 inline mr-1" />Changer
            </button>
            <button onClick={() => onChange('')} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600">
              <X className="w-3 h-3 inline mr-1" />Supprimer
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-indigo-400 hover:bg-indigo-50/30 transition text-gray-400 hover:text-indigo-600"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          <span className="text-xs font-medium">{uploading ? 'Upload...' : 'Image, GIF ou vidéo'}</span>
        </button>
      )}
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      <input ref={inputRef} type="file" accept={MEDIA_ACCEPT} className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  );
}

// ─── Hero background uploader — large drop zone ──────────────────────────────

function HeroBgUploader({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');
    if (!isMedia) { setError('Image, GIF ou vidéo requise'); return; }
    if (file.size > 100 * 1024 * 1024) { setError('Max 100 Mo'); return; }
    setError('');
    setUploading(true);
    try {
      const res = await storeProductsApi.uploadImages([file]);
      const url = res.data?.data?.[0]?.url;
      if (url) onChange(url);
      else setError('Upload échoué');
    } catch (e) {
      setError(e?.response?.data?.message || 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-700">
        Fond <span className="text-gray-400">(image, GIF ou vidéo — 1920×500 recommandé)</span>
      </label>
      {value ? (
        <div className="relative group rounded-xl overflow-hidden border-2 border-gray-200">
          <MediaPreview src={value} className="w-full h-36 object-cover" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-100 shadow-md"
            >
              <Upload className="w-3.5 h-3.5" />Changer
            </button>
            <button
              onClick={() => onChange('')}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600"
            >
              <X className="w-3.5 h-3.5" />Supprimer
            </button>
          </div>
          <div className="absolute top-2 left-2 bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {getBuilderMediaType(value) === 'video' ? 'Vidéo chargée' : 'Image chargée'}
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed transition flex flex-col items-center justify-center gap-2 py-8 ${
            dragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/20'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs font-semibold text-indigo-500">Upload en cours...</p>
            </>
          ) : dragging ? (
            <>
              <Upload className="w-8 h-8 text-indigo-500" />
              <p className="text-xs font-bold text-indigo-600">Relâchez pour uploader</p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Image className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-xs font-semibold text-gray-600">Cliquez ou glissez ici</p>
              <p className="text-[11px] text-gray-400">Image, GIF ou vidéo — max 100 Mo</p>
            </>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      <input ref={inputRef} type="file" accept={MEDIA_ACCEPT} className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  );
}

// ─── Section mini-preview (canvas thumbnail) ─────────────────────────────────

function SectionThumb({ section }) {
  const { type, config } = section;
  const meta = SECTION_TYPES[type];

  switch (type) {
    case 'hero':
      return (
        <div className="rounded overflow-hidden" style={{ background: config.backgroundImage ? `url(${config.backgroundImage}) center/cover` : config.backgroundColor || '#0F6B4F', minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: config.alignment === 'left' ? 'flex-start' : config.alignment === 'right' ? 'flex-end' : 'center' }}>
          {config.overlay && <div className="absolute inset-0 bg-black/30 rounded" />}
          <div className="relative p-3 text-center">
            <p className="text-white font-bold text-xs truncate">{config.title}</p>
            {config.ctaText && <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 text-white text-[10px] rounded">{config.ctaText}</span>}
          </div>
        </div>
      );
    case 'products':
      return (
        <div className="p-2" style={{ background: config.backgroundColor || '#fff' }}>
          <p className="text-xs font-semibold mb-1 truncate">{config.title}</p>
          <div className="grid grid-cols-3 gap-1">
            {[1,2,3].map(i => <div key={i} className="bg-gray-100 rounded h-6" />)}
          </div>
        </div>
      );
    case 'testimonials':
      return (
        <div className="p-2" style={{ background: config.backgroundColor || '#f9fafb' }}>
          <p className="text-xs font-semibold mb-1 truncate">{config.title}</p>
          <div className="flex gap-1">
            {[1,2].map(i => <div key={i} className="flex-1 bg-white border border-gray-100 rounded p-1"><div className="flex gap-0.5">{[1,2,3,4,5].map(s => <div key={s} className="w-1.5 h-1.5 rounded-full bg-yellow-400" />)}</div></div>)}
          </div>
        </div>
      );
    case 'faq':
      return (
        <div className="p-2" style={{ background: config.backgroundColor || '#fff' }}>
          <p className="text-xs font-semibold mb-1 truncate">{config.title}</p>
          {(config.items || []).slice(0, 2).map((item, i) => (
            <div key={i} className="flex items-center justify-between border-b border-gray-100 py-0.5">
              <span className="text-[10px] text-gray-600 truncate">{item.question}</span>
              <ChevronDown className="w-2.5 h-2.5 text-gray-400 flex-shrink-0 ml-1" />
            </div>
          ))}
        </div>
      );
    case 'banner':
      return (
        <div className="p-2 text-center rounded" style={{ background: config.backgroundColor || '#fef3c7' }}>
          <p className="text-[10px] font-medium truncate" style={{ color: config.textColor }}>{config.text}</p>
        </div>
      );
    case 'spacer':
      return <div className="bg-gray-100 rounded flex items-center justify-center" style={{ height: Math.min(config.height / 3, 32) }}><span className="text-[10px] text-gray-400">Espacement {config.height}px</span></div>;
    default:
      return (
        <div className="p-2" style={{ background: config.backgroundColor || '#fff' }}>
          <p className="text-xs font-semibold truncate">{config.title || meta?.label}</p>
          {config.content && <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">{config.content}</p>}
          {config.image && <img src={config.image} alt="" className="mt-1 w-full h-10 object-cover rounded" />}
        </div>
      );
  }
}

// ─── Sortable section card in canvas ─────────────────────────────────────────

function SectionCard({ section, isSelected, onSelect, onDelete, onDuplicate, onToggleVisible }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const meta = SECTION_TYPES[section.type];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(section.id)}
      className={`group relative rounded-xl border-2 cursor-pointer transition-all select-none overflow-hidden ${
        isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-lg'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      } ${!section.visible ? 'opacity-50' : ''}`}
    >
      {/* Header bar */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100'}`}>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-gray-200 text-gray-400"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="w-5 h-5 rounded flex items-center justify-center text-white flex-shrink-0" style={{ background: meta?.color || '#6b7280' }}>
          {meta?.icon}
        </div>
        <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{meta?.label || section.type}</span>
        {!section.visible && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Masqué</span>}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onToggleVisible(section.id)} className="p-1 rounded hover:bg-gray-200 text-gray-400" title={section.visible ? 'Masquer' : 'Afficher'}>
            {section.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onDuplicate(section.id)} className="p-1 rounded hover:bg-gray-200 text-gray-400" title="Dupliquer">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(section.id)} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500" title="Supprimer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Thumbnail preview */}
      <div className="relative bg-white" style={{ minHeight: 56 }}>
        <SectionThumb section={section} />
      </div>
    </div>
  );
}

// ─── Editor panels per section type ──────────────────────────────────────────

function FieldRow({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white';
const textareaCls = `${inputCls} resize-none`;

function AlignPicker({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[['left', <AlignLeft className="w-3.5 h-3.5" />], ['center', <AlignCenter className="w-3.5 h-3.5" />], ['right', <AlignRight className="w-3.5 h-3.5" />]].map(([v, icon]) => (
        <button key={v} onClick={() => onChange(v)} className={`flex-1 py-1.5 flex items-center justify-center rounded border text-sm transition ${value === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>{icon}</button>
      ))}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <FieldRow label={label}>
      <div className="flex gap-2 items-center">
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded border border-gray-200 cursor-pointer p-0.5" />
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={`${inputCls} font-mono`} placeholder="#000000" />
      </div>
    </FieldRow>
  );
}

// Repeatable list editor (testimonials items, faq items)
function RepeatableEditor({ items = [], onChange, fields, addLabel }) {
  const updateItem = (idx, key, val) => {
    const next = items.map((it, i) => i === idx ? { ...it, [key]: val } : it);
    onChange(next);
  };
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => onChange([...items, fields.reduce((a, f) => ({ ...a, [f.key]: f.default ?? '' }), {})]);

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-600">#{idx + 1}</span>
            <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          {fields.map((f) => (
            <FieldRow key={f.key} label={f.label}>
              {f.type === 'textarea' ? (
                <textarea value={item[f.key] || ''} onChange={(e) => updateItem(idx, f.key, e.target.value)} rows={2} className={textareaCls} />
              ) : f.type === 'number' ? (
                <input type="number" min={f.min} max={f.max} value={item[f.key] || ''} onChange={(e) => updateItem(idx, f.key, Number(e.target.value))} className={inputCls} />
              ) : (
                <input type="text" value={item[f.key] || ''} onChange={(e) => updateItem(idx, f.key, e.target.value)} className={inputCls} />
              )}
            </FieldRow>
          ))}
        </div>
      ))}
      <button onClick={addItem} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition flex items-center justify-center gap-1">
        <Plus className="w-3.5 h-3.5" />{addLabel}
      </button>
    </div>
  );
}

// Multi-image gallery editor
function GalleryEditor({ images = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const res = await storeProductsApi.uploadImages(Array.from(files));
      const uploaded = (res.data?.data || []).map((d) => ({ url: d.url, alt: '' }));
      onChange([...images, ...uploaded]);
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {images.map((img, idx) => (
          <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200">
            <MediaPreview src={img.url || img} className="w-full h-16 object-cover" />
            <button onClick={() => onChange(images.filter((_, i) => i !== idx))} className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className="h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-indigo-400 hover:bg-indigo-50/30 transition text-gray-400 hover:text-indigo-500">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span className="text-[10px]">Ajouter</span>
        </button>
      </div>
      <input ref={inputRef} type="file" accept={MEDIA_ACCEPT} multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}

function SectionEditor({ section, onChange }) {
  const { type, config } = section;
  const set = (key, val) => onChange({ ...section, config: { ...config, [key]: val } });
  const setMulti = (updates) => onChange({ ...section, config: { ...config, ...updates } });

  switch (type) {
    case 'hero':
      return (
        <div className="space-y-4">
          {/* Background image — first, most impactful */}
          <div className="border-b pb-4 space-y-3">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Arrière-plan</p>
            <FieldRow label="Type">
              <div className="flex gap-2">
                {[['color', 'Couleur'], ['image', 'Image']].map(([v, l]) => (
                  <button key={v} onClick={() => set('backgroundType', v)} className={`flex-1 py-2 text-xs rounded-lg border transition font-semibold ${config.backgroundType === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>{l}</button>
                ))}
              </div>
            </FieldRow>
            {config.backgroundType === 'image' ? (
              <>
                <HeroBgUploader
                  value={config.backgroundImage}
                  onChange={(v) => set('backgroundImage', v)}
                />
                <FieldRow label={`Assombrissement overlay : ${config.overlayOpacity ?? 50}%`}>
                  <input type="range" min={0} max={85} value={config.overlayOpacity ?? 50} onChange={(e) => set('overlayOpacity', Number(e.target.value))} className="w-full accent-indigo-600" />
                </FieldRow>
              </>
            ) : (
              <ColorField label="Couleur de fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
            )}
          </div>
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Sous-titre"><textarea value={config.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} rows={2} className={textareaCls} /></FieldRow>
          <FieldRow label="Texte du bouton CTA"><input type="text" value={config.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Lien du bouton"><input type="text" value={config.ctaLink || ''} onChange={(e) => set('ctaLink', e.target.value)} className={inputCls} placeholder="#products" /></FieldRow>
          <FieldRow label="Alignement"><AlignPicker value={config.alignment || 'center'} onChange={(v) => set('alignment', v)} /></FieldRow>
          <ColorField label="Couleur du texte" value={config.textColor} onChange={(v) => set('textColor', v)} />
          <FieldRow label={`Hauteur : ${config.minHeight || 500}px`}>
            <input type="range" min={200} max={900} step={50} value={config.minHeight || 500} onChange={(e) => set('minHeight', Number(e.target.value))} className="w-full accent-indigo-600" />
          </FieldRow>
        </div>
      );

    case 'products':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre de section"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Sous-titre"><input type="text" value={config.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Colonnes">
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button key={n} onClick={() => set('columns', n)} className={`flex-1 py-2 text-xs rounded border font-medium transition ${config.columns === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'}`}>{n} col.</button>
              ))}
            </div>
          </FieldRow>
          <FieldRow label={`Nombre de produits affichés : ${config.limit}`}>
            <input type="range" min={2} max={24} step={1} value={config.limit || 6} onChange={(e) => set('limit', Number(e.target.value))} className="w-full" />
          </FieldRow>
          <FieldRow label="Options">
            <div className="space-y-2">
              {[['showPrice', 'Afficher le prix'], ['showAddToCart', 'Bouton commander']].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!config[key]} onChange={(e) => set(key, e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </FieldRow>
          <ColorField label="Couleur de fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
        </div>
      );

    case 'text':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Contenu"><textarea value={config.content || ''} onChange={(e) => set('content', e.target.value)} rows={6} className={textareaCls} /></FieldRow>
          <FieldRow label="Alignement"><AlignPicker value={config.alignment || 'left'} onChange={(v) => set('alignment', v)} /></FieldRow>
          <ColorField label="Couleur de fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <ColorField label="Couleur du texte" value={config.textColor} onChange={(v) => set('textColor', v)} />
          <FieldRow label="Espacement intérieur">
            <div className="flex gap-2">
              {[['sm', 'Compact'], ['md', 'Normal'], ['lg', 'Large']].map(([v, l]) => (
                <button key={v} onClick={() => set('padding', v)} className={`flex-1 py-2 text-xs rounded border font-medium transition ${config.padding === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'}`}>{l}</button>
              ))}
            </div>
          </FieldRow>
        </div>
      );

    case 'image_text':
      return (
        <div className="space-y-4">
          <ImageUploader value={config.image} onChange={(v) => set('image', v)} label="Image" aspectHint="4:3 recommandé" />
          <FieldRow label="Texte alternatif image"><input type="text" value={config.imageAlt || ''} onChange={(e) => set('imageAlt', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Contenu"><textarea value={config.content || ''} onChange={(e) => set('content', e.target.value)} rows={4} className={textareaCls} /></FieldRow>
          <FieldRow label="Disposition">
            <div className="flex gap-2">
              {[['image-left', 'Image gauche'], ['image-right', 'Image droite']].map(([v, l]) => (
                <button key={v} onClick={() => set('layout', v)} className={`flex-1 py-2 text-xs rounded border font-medium transition ${config.layout === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'}`}>{l}</button>
              ))}
            </div>
          </FieldRow>
          <FieldRow label="Bouton CTA (optionnel)"><input type="text" value={config.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} className={inputCls} placeholder="Texte du bouton" /></FieldRow>
          {config.ctaText && <FieldRow label="Lien CTA"><input type="text" value={config.ctaLink || ''} onChange={(e) => set('ctaLink', e.target.value)} className={inputCls} placeholder="#products" /></FieldRow>}
          <ColorField label="Couleur de fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
        </div>
      );

    case 'gallery':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Colonnes">
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button key={n} onClick={() => set('columns', n)} className={`flex-1 py-2 text-xs rounded border font-medium transition ${config.columns === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'}`}>{n}</button>
              ))}
            </div>
          </FieldRow>
          <FieldRow label="Images">
            <GalleryEditor images={config.images || []} onChange={(v) => set('images', v)} />
          </FieldRow>
          <ColorField label="Couleur de fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
        </div>
      );

    case 'testimonials':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre de section"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Disposition">
            <div className="flex gap-2">
              {[['grid', 'Grille'], ['carousel', 'Carrousel']].map(([v, l]) => (
                <button key={v} onClick={() => set('layout', v)} className={`flex-1 py-2 text-xs rounded border font-medium transition ${config.layout === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'}`}>{l}</button>
              ))}
            </div>
          </FieldRow>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!config.showRating} onChange={(e) => set('showRating', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
            <span className="text-sm text-gray-700">Afficher les étoiles</span>
          </label>
          <ColorField label="Couleur de fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <FieldRow label="Témoignages">
            <RepeatableEditor
              items={config.items || []}
              onChange={(v) => set('items', v)}
              addLabel="Ajouter un témoignage"
              fields={[
                { key: 'name', label: 'Nom', default: '' },
                { key: 'location', label: 'Ville', default: '' },
                { key: 'content', label: 'Témoignage', type: 'textarea', default: '' },
                { key: 'rating', label: 'Note (1-5)', type: 'number', min: 1, max: 5, default: 5 },
              ]}
            />
          </FieldRow>
        </div>
      );

    case 'faq':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <ColorField label="Couleur de fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <FieldRow label="Questions / Réponses">
            <RepeatableEditor
              items={config.items || []}
              onChange={(v) => set('items', v)}
              addLabel="Ajouter une question"
              fields={[
                { key: 'question', label: 'Question', default: '' },
                { key: 'answer', label: 'Réponse', type: 'textarea', default: '' },
              ]}
            />
          </FieldRow>
        </div>
      );

    case 'contact':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Sous-titre"><input type="text" value={config.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Numéro WhatsApp"><input type="text" value={config.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} className={inputCls} placeholder="+237 6XX XXX XXX" /></FieldRow>
          <FieldRow label="Email"><input type="email" value={config.email || ''} onChange={(e) => set('email', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Adresse"><input type="text" value={config.address || ''} onChange={(e) => set('address', e.target.value)} className={inputCls} /></FieldRow>
          <ColorField label="Couleur de fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <ColorField label="Couleur du texte" value={config.textColor} onChange={(v) => set('textColor', v)} />
        </div>
      );

    case 'banner':
      return (
        <div className="space-y-4">
          <FieldRow label="Texte du bandeau"><textarea value={config.text || ''} onChange={(e) => set('text', e.target.value)} rows={2} className={textareaCls} /></FieldRow>
          <FieldRow label="Texte bouton"><input type="text" value={config.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Lien bouton"><input type="text" value={config.ctaLink || ''} onChange={(e) => set('ctaLink', e.target.value)} className={inputCls} /></FieldRow>
          <ColorField label="Couleur de fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <ColorField label="Couleur du texte" value={config.textColor} onChange={(v) => set('textColor', v)} />
        </div>
      );

    case 'spacer':
      return (
        <div className="space-y-4">
          <FieldRow label={`Hauteur : ${config.height}px`}>
            <input type="range" min={20} max={300} step={10} value={config.height || 60} onChange={(e) => set('height', Number(e.target.value))} className="w-full" />
          </FieldRow>
          <ColorField label="Couleur de fond" value={config.backgroundColor === 'transparent' ? '#ffffff' : config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
        </div>
      );

    case 'announcement_bar':
      return (
        <div className="space-y-4">
          <FieldRow label="Texte"><input type="text" value={config.text || ''} onChange={(e) => set('text', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Lien (optionnel)"><input type="text" value={config.link || ''} onChange={(e) => set('link', e.target.value)} className={inputCls} placeholder="https://..." /></FieldRow>
          <FieldRow label="Texte du lien"><input type="text" value={config.linkText || ''} onChange={(e) => set('linkText', e.target.value)} className={inputCls} /></FieldRow>
          <ColorField label="Fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <ColorField label="Texte" value={config.textColor} onChange={(v) => set('textColor', v)} />
        </div>
      );

    case 'rich_text':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Sous-titre"><input type="text" value={config.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Contenu"><textarea value={config.content || ''} onChange={(e) => set('content', e.target.value)} rows={6} className={textareaCls} /></FieldRow>
          <FieldRow label="Alignement"><AlignPicker value={config.alignment || 'center'} onChange={(v) => set('alignment', v)} /></FieldRow>
          <ColorField label="Fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <ColorField label="Texte" value={config.textColor} onChange={(v) => set('textColor', v)} />
        </div>
      );

    case 'featured_collection':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Sous-titre"><input type="text" value={config.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Catégorie (laisser vide = tous)"><input type="text" value={config.category || ''} onChange={(e) => set('category', e.target.value)} className={inputCls} placeholder="ex: robes" /></FieldRow>
          <FieldRow label={`Nombre de produits : ${config.limit || 4}`}>
            <input type="range" min={2} max={12} value={config.limit || 4} onChange={(e) => set('limit', Number(e.target.value))} className="w-full" />
          </FieldRow>
          <ColorField label="Fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
        </div>
      );

    case 'multicolumn':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Colonnes">
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button key={n} onClick={() => set('columns', n)} className={`flex-1 py-2 text-xs rounded border font-medium transition ${config.columns === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'}`}>{n}</button>
              ))}
            </div>
          </FieldRow>
          <ColorField label="Fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <FieldRow label="Éléments">
            <div className="space-y-3">
              {(config.items || []).map((item, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <input type="text" value={item.icon || ''} onChange={(e) => { const items = [...(config.items || [])]; items[i] = { ...items[i], icon: e.target.value }; set('items', items); }} className={inputCls} placeholder="Emoji ou icône" />
                  <input type="text" value={item.title || ''} onChange={(e) => { const items = [...(config.items || [])]; items[i] = { ...items[i], title: e.target.value }; set('items', items); }} className={inputCls} placeholder="Titre" />
                  <input type="text" value={item.text || ''} onChange={(e) => { const items = [...(config.items || [])]; items[i] = { ...items[i], text: e.target.value }; set('items', items); }} className={inputCls} placeholder="Description" />
                  <button onClick={() => { const items = (config.items || []).filter((_, j) => j !== i); set('items', items); }} className="text-xs text-red-500 hover:text-red-700">Supprimer</button>
                </div>
              ))}
              <button onClick={() => set('items', [...(config.items || []), { icon: '⭐', title: 'Nouveau', text: '' }])} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition">+ Ajouter un élément</button>
            </div>
          </FieldRow>
        </div>
      );

    case 'icon_bar':
      return (
        <div className="space-y-4">
          <ColorField label="Fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <ColorField label="Texte" value={config.textColor} onChange={(v) => set('textColor', v)} />
          <FieldRow label="Éléments">
            <div className="space-y-2">
              {(config.items || []).map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" value={item.icon || ''} onChange={(e) => { const items = [...(config.items || [])]; items[i] = { ...items[i], icon: e.target.value }; set('items', items); }} className={`${inputCls} w-16`} placeholder="🚚" />
                  <input type="text" value={item.text || ''} onChange={(e) => { const items = [...(config.items || [])]; items[i] = { ...items[i], text: e.target.value }; set('items', items); }} className={inputCls} placeholder="Texte" />
                  <button onClick={() => set('items', (config.items || []).filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => set('items', [...(config.items || []), { icon: '⭐', text: 'Avantage' }])} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition">+ Ajouter</button>
            </div>
          </FieldRow>
        </div>
      );

    case 'before_after':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <ImageUploader label="Image Avant" value={config.imageBefore} onChange={(v) => set('imageBefore', v)} />
          <ImageUploader label="Image Après" value={config.imageAfter} onChange={(v) => set('imageAfter', v)} />
          <FieldRow label="Label Avant"><input type="text" value={config.labelBefore || 'Avant'} onChange={(e) => set('labelBefore', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Label Après"><input type="text" value={config.labelAfter || 'Après'} onChange={(e) => set('labelAfter', e.target.value)} className={inputCls} /></FieldRow>
          <ColorField label="Fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
        </div>
      );

    case 'video':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre (optionnel)"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="URL vidéo (YouTube / MP4)"><input type="text" value={config.videoUrl || ''} onChange={(e) => set('videoUrl', e.target.value)} className={inputCls} placeholder="https://youtube.com/..." /></FieldRow>
          <ImageUploader label="Image poster (optionnel)" value={config.poster} onChange={(v) => set('poster', v)} />
          <ColorField label="Fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
        </div>
      );

    case 'pricing_table':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <ColorField label="Fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <FieldRow label="Offres">
            <div className="space-y-3">
              {(config.items || []).map((item, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <input type="text" value={item.name || ''} onChange={(e) => { const items = [...(config.items||[])]; items[i]={...items[i],name:e.target.value}; set('items',items); }} className={inputCls} placeholder="Nom de l'offre" />
                  <div className="flex gap-2">
                    <input type="text" value={item.price || ''} onChange={(e) => { const items=[...(config.items||[])]; items[i]={...items[i],price:e.target.value}; set('items',items); }} className={inputCls} placeholder="Prix" />
                    <input type="text" value={item.currency || 'FCFA'} onChange={(e) => { const items=[...(config.items||[])]; items[i]={...items[i],currency:e.target.value}; set('items',items); }} className={`${inputCls} w-20`} placeholder="Devise" />
                  </div>
                  <input type="text" value={item.cta || 'Choisir'} onChange={(e) => { const items=[...(config.items||[])]; items[i]={...items[i],cta:e.target.value}; set('items',items); }} className={inputCls} placeholder="Texte bouton" />
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={!!item.highlight} onChange={(e) => { const items=[...(config.items||[])]; items[i]={...items[i],highlight:e.target.checked}; set('items',items); }} />
                    Mettre en avant
                  </label>
                  <button onClick={() => set('items',(config.items||[]).filter((_,j)=>j!==i))} className="text-xs text-red-500">Supprimer</button>
                </div>
              ))}
              <button onClick={() => set('items',[...(config.items||[]),{name:'Offre',price:'0',currency:'FCFA',period:'/mois',features:[],cta:'Choisir',highlight:false}])} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition">+ Ajouter une offre</button>
            </div>
          </FieldRow>
        </div>
      );

    case 'ticker':
      return (
        <div className="space-y-4">
          <ColorField label="Fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <ColorField label="Texte" value={config.textColor} onChange={(v) => set('textColor', v)} />
          <FieldRow label={`Vitesse : ${config.speed || 30}s`}>
            <input type="range" min={10} max={80} value={config.speed || 30} onChange={(e) => set('speed', Number(e.target.value))} className="w-full" />
          </FieldRow>
          <FieldRow label="Messages">
            <div className="space-y-2">
              {(config.items || []).map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" value={item} onChange={(e) => { const items=[...(config.items||[])]; items[i]=e.target.value; set('items',items); }} className={inputCls} />
                  <button onClick={() => set('items',(config.items||[]).filter((_,j)=>j!==i))} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => set('items',[...(config.items||[]),'Nouveau message'])} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition">+ Ajouter</button>
            </div>
          </FieldRow>
        </div>
      );

    case 'newsletter':
      return (
        <div className="space-y-4">
          <FieldRow label="Titre"><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Sous-titre"><input type="text" value={config.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Placeholder"><input type="text" value={config.placeholder || ''} onChange={(e) => set('placeholder', e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="Texte bouton"><input type="text" value={config.buttonText || ''} onChange={(e) => set('buttonText', e.target.value)} className={inputCls} /></FieldRow>
          <ColorField label="Fond" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
        </div>
      );

    default:
      return <p className="text-sm text-gray-500">Éditeur non disponible pour ce type de section.</p>;
  }
}

// ─── Inline editable text component ─────────────────────────────────────────

function EditableText({ value, onChange, tag: Tag = 'span', className = '', style = {}, placeholder = 'Cliquez pour éditer...' }) {
  const ref = useRef(null);
  const [editing, setEditing] = useState(false);

  const handleBlur = () => {
    setEditing(false);
    const text = ref.current?.innerText || '';
    if (text !== value) onChange(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && Tag !== 'p') {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  };

  return (
    <Tag
      ref={ref}
      contentEditable={editing}
      suppressContentEditableWarning
      onClick={handleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${className} ${editing ? 'outline-none ring-2 ring-indigo-400 ring-offset-1 rounded px-1 bg-white/90' : 'cursor-pointer hover:ring-2 hover:ring-indigo-300/50 hover:ring-offset-1 rounded transition-all'}`}
      style={{ ...style, minWidth: '20px', display: 'inline-block' }}
    >
      {value || placeholder}
    </Tag>
  );
}

// ─── Live section renders (canvas preview — instantaneous) ───────────────────

const PADDING_MAP = { sm: '24px 32px', md: '48px 32px', lg: '80px 32px' };

function LiveHero({ config, selected, onUpdate }) {
  const bg = config.backgroundType === 'image' && config.backgroundImage
    ? `url(${config.backgroundImage}) center/cover no-repeat`
    : config.backgroundColor || '#0F6B4F';
  const align = config.alignment || 'center';
  return (
    <div
      className={`relative flex items-center overflow-hidden transition-shadow ${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
      style={{ background: bg, minHeight: config.minHeight || 400 }}
    >
      {config.backgroundImage && config.overlay && (
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(config.overlayOpacity ?? 50) / 100})` }} />
      )}
      <div className={`relative z-10 w-full px-8 py-12 ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`} style={{ color: config.textColor || '#fff' }}>
        <EditableText
          tag="h1"
          value={config.title}
          onChange={(v) => onUpdate('title', v)}
          className="text-4xl font-extrabold leading-tight mb-4"
          style={{ textShadow: config.backgroundImage ? '0 2px 12px rgba(0,0,0,.4)' : 'none' }}
          placeholder="Votre titre"
        />
        <EditableText
          tag="p"
          value={config.subtitle}
          onChange={(v) => onUpdate('subtitle', v)}
          className="text-lg opacity-90 mb-6 max-w-xl mx-auto"
          placeholder="Sous-titre..."
        />
        {config.ctaText && (
          <EditableText
            tag="span"
            value={config.ctaText}
            onChange={(v) => onUpdate('ctaText', v)}
            className="inline-block px-6 py-3 bg-white font-bold rounded-full text-sm"
            style={{ color: config.backgroundColor || '#0F6B4F' }}
          />
        )}
      </div>
    </div>
  );
}

function LiveProducts({ config, selected, onUpdate }) {
  const cols = config.columns || 3;
  const count = Math.min(config.limit || 6, 8);
  return (
    <div className={`py-12 px-8 ${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`} style={{ background: config.backgroundColor || '#fff' }}>
      <EditableText tag="h2" value={config.title} onChange={(v) => onUpdate('title', v)} className="text-2xl font-bold text-center mb-2" placeholder="Titre..." />
      <EditableText tag="p" value={config.subtitle} onChange={(v) => onUpdate('subtitle', v)} className="text-center text-gray-500 mb-8" placeholder="Sous-titre..." />
      <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 h-40 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-gray-300" />
            </div>
            <div className="p-3">
              <div className="h-3 bg-gray-200 rounded mb-2 w-3/4" />
              {config.showPrice && <div className="h-3 bg-gray-100 rounded w-1/3" />}
              {config.showAddToCart && <div className="mt-3 h-8 bg-indigo-100 rounded-lg" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveText({ config, selected, onUpdate }) {
  const align = config.alignment || 'left';
  const pad = PADDING_MAP[config.padding || 'md'] || PADDING_MAP.md;
  return (
    <div className={`${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`} style={{ background: config.backgroundColor || '#fff', padding: pad, textAlign: align, color: config.textColor || '#111827' }}>
      <EditableText tag="h2" value={config.title} onChange={(v) => onUpdate('title', v)} className="text-2xl font-bold mb-4" placeholder="Titre..." />
      <EditableText tag="p" value={config.content} onChange={(v) => onUpdate('content', v)} className="text-base leading-relaxed opacity-80 whitespace-pre-line" placeholder="Contenu..." />
    </div>
  );
}

function LiveImageText({ config, selected, onUpdate }) {
  const isLeft = (config.layout || 'image-left') === 'image-left';
  return (
    <div className={`py-12 px-8 ${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`} style={{ background: config.backgroundColor || '#fff' }}>
      <div className={`flex flex-col md:flex-row items-center gap-10 ${isLeft ? '' : 'md:flex-row-reverse'}`}>
        <div className="w-full md:w-1/2 rounded-2xl overflow-hidden shadow-md flex-shrink-0" style={{ minHeight: 220, background: '#f3f4f6' }}>
          {config.image ? (
            <img src={config.image} alt={config.imageAlt || ''} className="w-full h-64 object-cover" />
          ) : (
            <div className="h-64 flex items-center justify-center"><Image className="w-12 h-12 text-gray-300" /></div>
          )}
        </div>
        <div className="flex-1">
          <EditableText tag="h2" value={config.title} onChange={(v) => onUpdate('title', v)} className="text-2xl font-bold mb-4" placeholder="Titre..." />
          <EditableText tag="p" value={config.content} onChange={(v) => onUpdate('content', v)} className="text-gray-600 leading-relaxed" placeholder="Contenu..." />
          {config.ctaText && (
            <EditableText tag="span" value={config.ctaText} onChange={(v) => onUpdate('ctaText', v)} className="mt-6 inline-block px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg text-sm" />
          )}
        </div>
      </div>
    </div>
  );
}

function LiveGallery({ config, selected, onUpdate }) {
  const cols = config.columns || 3;
  const images = config.images || [];
  return (
    <div className={`py-10 px-8 ${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`} style={{ background: config.backgroundColor || '#f9fafb' }}>
      <EditableText tag="h2" value={config.title} onChange={(v) => onUpdate('title', v)} className="text-2xl font-bold text-center mb-8" placeholder="Titre..." />
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {images.length > 0 ? images.map((img, i) => (
          <div key={i} className="rounded-xl overflow-hidden shadow-sm" style={{ aspectRatio: '1' }}>
            <img src={img.url || img} alt={img.alt || ''} className="w-full h-full object-cover" />
          </div>
        )) : Array.from({ length: cols * 2 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-gray-200 flex items-center justify-center" style={{ aspectRatio: '1' }}>
            <Image className="w-6 h-6 text-gray-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveTestimonials({ config, selected, onUpdate }) {
  const items = config.items || [];
  return (
    <div className={`py-12 px-8 ${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`} style={{ background: config.backgroundColor || '#f9fafb' }}>
      <EditableText tag="h2" value={config.title} onChange={(v) => onUpdate('title', v)} className="text-2xl font-bold text-center mb-10" placeholder="Titre..." />
      <div className={`grid gap-5 ${config.layout === 'carousel' ? 'grid-cols-1 max-w-lg mx-auto' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        {items.map((item, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            {config.showRating && (
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className={`w-4 h-4 ${s < (item.rating || 5) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                ))}
              </div>
            )}
            <p className="text-gray-700 text-sm leading-relaxed mb-4">"{item.content}"</p>
            <p className="text-sm font-bold text-gray-900">{item.name}</p>
            {item.location && <p className="text-xs text-gray-400">{item.location}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveFaq({ config, selected, onUpdate }) {
  const [open, setOpen] = useState(null);
  const items = config.items || [];
  return (
    <div className={`py-12 px-8 ${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`} style={{ background: config.backgroundColor || '#fff' }}>
      <EditableText tag="h2" value={config.title} onChange={(v) => onUpdate('title', v)} className="text-2xl font-bold text-center mb-10" placeholder="Titre..." />
      <div className="max-w-2xl mx-auto space-y-2">
        {items.map((item, i) => (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="text-sm font-semibold text-gray-900">{item.question}</span>
              {open === i ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </button>
            {open === i && (
              <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">{item.answer}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveContact({ config, selected, onUpdate }) {
  return (
    <div className={`py-12 px-8 text-center ${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`} style={{ background: config.backgroundColor || '#0F6B4F', color: config.textColor || '#fff' }}>
      <EditableText tag="h2" value={config.title} onChange={(v) => onUpdate('title', v)} className="text-2xl font-bold mb-2" placeholder="Titre..." />
      <EditableText tag="p" value={config.subtitle} onChange={(v) => onUpdate('subtitle', v)} className="opacity-80 mb-8" placeholder="Sous-titre..." />
      <div className="flex flex-wrap justify-center gap-4">
        {config.whatsapp && (
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3">
            <Phone className="w-4 h-4" />
            <span className="text-sm font-medium">{config.whatsapp}</span>
          </div>
        )}
        {config.email && (
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3">
            <span className="text-sm font-medium">{config.email}</span>
          </div>
        )}
        {config.address && (
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3">
            <span className="text-sm font-medium">{config.address}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveBanner({ config, selected, onUpdate }) {
  return (
    <div className={`flex items-center justify-center gap-4 px-6 py-3 ${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`} style={{ background: config.backgroundColor || '#fef3c7' }}>
      <EditableText tag="p" value={config.text} onChange={(v) => onUpdate('text', v)} className="text-sm font-medium" style={{ color: config.textColor || '#92400e' }} placeholder="Texte du bandeau..." />
      {config.ctaText && (
        <EditableText tag="span" value={config.ctaText} onChange={(v) => onUpdate('ctaText', v)} className="text-xs font-bold px-3 py-1 rounded-full border" style={{ color: config.textColor || '#92400e', borderColor: config.textColor || '#92400e' }} />
      )}
    </div>
  );
}

function LiveSpacer({ config, selected }) {
  return (
    <div className={`${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`} style={{ height: config.height || 60, background: config.backgroundColor || 'transparent' }} />
  );
}

function LiveSectionRender({ section, selected, onClick, onFieldUpdate }) {
  const { type, config, visible } = section;
  if (!visible) {
    return (
      <div onClick={onClick} className={`relative cursor-pointer opacity-30 hover:opacity-50 transition ${selected ? 'ring-2 ring-inset ring-indigo-400' : ''}`}>
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100/50">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium bg-white px-3 py-1.5 rounded-full shadow"><EyeOff className="w-3 h-3" />Section masquée</div>
        </div>
        <div style={{ pointerEvents: 'none', minHeight: 48, background: '#f3f4f6' }} />
      </div>
    );
  }

  const props = { config, selected, onUpdate: (key, val) => onFieldUpdate(section.id, key, val) };
  let rendered;
  switch (type) {
    case 'hero':        rendered = <LiveHero {...props} />; break;
    case 'products':    rendered = <LiveProducts {...props} />; break;
    case 'text':        rendered = <LiveText {...props} />; break;
    case 'image_text':  rendered = <LiveImageText {...props} />; break;
    case 'gallery':     rendered = <LiveGallery {...props} />; break;
    case 'testimonials':rendered = <LiveTestimonials {...props} />; break;
    case 'faq':         rendered = <LiveFaq {...props} />; break;
    case 'contact':     rendered = <LiveContact {...props} />; break;
    case 'banner':      rendered = <LiveBanner {...props} />; break;
    case 'spacer':      rendered = <LiveSpacer {...props} />; break;
    default:
      rendered = <div className="p-6 bg-gray-50 text-sm text-gray-400 text-center">Section : {type}</div>;
  }

  return (
    <div className="relative cursor-pointer group/live">
      {rendered}
      {/* Hover overlay — click to select */}
      <div className={`absolute inset-0 border-2 rounded transition-all pointer-events-none ${selected ? 'border-indigo-500 bg-indigo-500/5' : 'border-transparent group-hover/live:border-indigo-300 group-hover/live:bg-indigo-500/[0.02]'}`} />
      {/* Hover edit hint */}
      {!selected && (
        <div className="absolute top-2 right-2 opacity-0 group-hover/live:opacity-100 transition-opacity pointer-events-none flex items-center gap-1 bg-white text-gray-700 text-[10px] font-semibold px-2 py-1 rounded-full shadow-md border border-gray-200 z-20">
          <Pencil className="w-2.5 h-2.5" />Modifier
        </div>
      )}
      {selected && (
        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full z-20 pointer-events-none flex items-center gap-1">
          <Pencil className="w-2.5 h-2.5" />
          {SECTION_TYPES[type]?.label || type}
        </div>
      )}
    </div>
  );
}

// ─── Sortable wrapper for live preview sections ─────────────────────────────

function SortableLiveSection({ section, selected, onClick, onFieldUpdate }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} onClick={onClick} {...attributes} className="relative group/sortlive">
      <LiveSectionRender
        section={section}
        selected={selected}
        onClick={onClick}
        onFieldUpdate={onFieldUpdate}
      />
      {/* Drag handle overlay — uses setActivatorNodeRef */}
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        className="absolute top-2 left-2 opacity-0 group-hover/sortlive:opacity-100 transition-opacity z-30 cursor-grab active:cursor-grabbing p-1.5 bg-white rounded-lg shadow-md border border-gray-200 text-gray-400 hover:text-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}

// ─── Add section panel ────────────────────────────────────────────────────────

function AddSectionPanel({ onAdd, onClose }) {
  const [cat, setCat] = useState('Marketing');

  const filtered = Object.entries(SECTION_TYPES).filter(([, meta]) => meta.category === cat);

  return (
    <div className="absolute inset-0 bg-white z-20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">Ajouter une section</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      {/* Category tabs */}
      <div className="flex overflow-x-auto gap-1 px-3 py-2 border-b border-gray-100 scrollbar-none">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full transition ${cat === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map(([type, meta]) => (
          <button
            key={type}
            onClick={() => { onAdd(type); onClose(); }}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition text-left group"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: meta.color }}>
              {meta.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700">{meta.label}</p>
            </div>
            <Plus className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 ml-auto flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const StorepageBuilder = () => {
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const { workspace } = useEcomAuth();

  const [sections, setSections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [device, setDevice] = useState('desktop');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [aiModel, setAiModel] = useState('claude-sonnet');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', content: 'Salut ! Je suis ton assistant IA pour la page boutique.\n\nExemples :\n- "Ajoute une section hero avec fond vert"\n- "Change le titre du hero en Nos Meilleures Ventes"\n- "Ajoute une section témoignages"\n- "Cache la section FAQ"' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMedias, setAiMedias] = useState([]); // [{ file, localUrl, uploadedUrl, type, name, placement }]
  const [aiMediaPlacement, setAiMediaPlacement] = useState('');
  const [aiRecording, setAiRecording] = useState(false);
  const [aiTranscribing, setAiTranscribing] = useState(false);
  const aiMediaRecorderRef = useRef(null);
  const aiAudioChunksRef = useRef([]);
  const aiInputRef = useRef(null);
  const aiEndRef = useRef(null);
  const aiFileRef = useRef(null);

  // ─ Undo / Redo history ─
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const MAX_HISTORY = 50;

  const pushHistory = useCallback((prev) => {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), prev];
    futureRef.current = [];
  }, []);

  const [, forceRender] = useState(0);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setSections((current) => {
      futureRef.current = [...futureRef.current, current];
      return prev;
    });
    setDirty(true);
    forceRender((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    setSections((current) => {
      historyRef.current = [...historyRef.current, current];
      return next;
    });
    setDirty(true);
    forceRender((n) => n + 1);
  }, []);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // Keyboard shortcut: Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const subdomain = activeStore?.subdomain || workspace?.subdomain || '';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // ─ Load ─
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await storeManageApi.getPages();
        const loaded = res.data?.data?.sections || [];
        setSections(loaded);
        historyRef.current = [];
        futureRef.current = [];
      } catch {
        setSections([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeStore?._id]);

  // ─ Mutations (all push to history) ─
  const addSection = useCallback((type) => {
    const sec = makeSection(type);
    setSections((prev) => {
      pushHistory(prev);
      return [...prev, sec];
    });
    setSelectedId(sec.id);
    setDirty(true);
    forceRender((n) => n + 1);
  }, [pushHistory]);

  const deleteSection = useCallback((id) => {
    if (!window.confirm('Supprimer cette section ?')) return;
    setSections((prev) => {
      pushHistory(prev);
      return prev.filter((s) => s.id !== id);
    });
    setSelectedId((sel) => sel === id ? null : sel);
    setDirty(true);
    forceRender((n) => n + 1);
  }, [pushHistory]);

  const duplicateSection = useCallback((id) => {
    setSections((prev) => {
      pushHistory(prev);
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], id: genId() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setDirty(true);
    forceRender((n) => n + 1);
  }, [pushHistory]);

  const toggleVisible = useCallback((id) => {
    setSections((prev) => {
      pushHistory(prev);
      return prev.map((s) => s.id === id ? { ...s, visible: !s.visible } : s);
    });
    setDirty(true);
    forceRender((n) => n + 1);
  }, [pushHistory]);

  const updateSelected = useCallback((updated) => {
    setSections((prev) => {
      pushHistory(prev);
      return prev.map((s) => s.id === updated.id ? updated : s);
    });
    setDirty(true);
    forceRender((n) => n + 1);
  }, [pushHistory]);

  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      pushHistory(prev);
      const from = prev.findIndex((s) => s.id === active.id);
      const to = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, from, to);
    });
    setDirty(true);
    forceRender((n) => n + 1);
  }, [pushHistory]);

  const onFieldUpdate = useCallback((sectionId, key, val) => {
    setSections((prev) => {
      pushHistory(prev);
      return prev.map((s) => s.id === sectionId ? { ...s, config: { ...s.config, [key]: val } } : s);
    });
    setDirty(true);
    forceRender((n) => n + 1);
  }, [pushHistory]);

  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages]);
  useEffect(() => { if (aiOpen && aiInputRef.current) aiInputRef.current.focus(); }, [aiOpen]);

  const handleAiFileAdd = useCallback(async (files) => {
    const toAdd = [];
    for (const file of Array.from(files)) {
      const isAudio = file.type.startsWith('audio/');
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isAudio && !isVideo && !isImage) continue;
      // Upload immediately via storeProductsApi
      let uploadedUrl = null;
      try {
        const res = await storeProductsApi.uploadImages([file]);
        uploadedUrl = res?.data?.urls?.[0] || res?.data?.data?.[0]?.url || null;
      } catch {}
      const localUrl = URL.createObjectURL(file);
      toAdd.push({ file, localUrl, uploadedUrl, type: isAudio ? 'audio' : isVideo ? 'video' : 'image', name: file.name, placement: '' });
    }
    setAiMedias(prev => [...prev, ...toAdd]);
  }, []);

  const toggleAiRecording = useCallback(async () => {
    if (aiRecording) {
      aiMediaRecorderRef.current?.stop();
      return;
    }
    try {
      // Contraintes audio maximisant la qualité pour Whisper
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,   // Whisper est entraîné sur 16kHz
          channelCount: 1,     // mono suffisant, réduit taille fichier
        },
      });

      // Priorité : webm/opus (le mieux supporté + bon pour Whisper)
      // Fallback : audio/mp4 (Safari), puis audio/webm sans codec
      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' :
        'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      aiAudioChunksRef.current = [];

      // Collecter les données toutes les 250ms pour éviter la perte en cas d'arrêt brutal
      recorder.ondataavailable = e => { if (e.data.size > 0) aiAudioChunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setAiRecording(false);
        const blob = new Blob(aiAudioChunksRef.current, { type: mimeType });
        if (blob.size < 1000) return; // trop court, ignorer
        setAiTranscribing(true);
        try {
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('opus') ? 'webm' : 'webm';
          const form = new FormData();
          form.append('audio', blob, `voice.${ext}`);
          const { data } = await ecomApi.post('/builder-ai/transcribe', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
          });
          if (data.success && data.text) {
            setAiInput(prev => prev ? prev + ' ' + data.text : data.text);
            setTimeout(() => { aiInputRef.current?.focus(); }, 50);
          } else if (data.message) {
            console.warn('[Transcription]', data.message);
          }
        } catch (err) {
          console.error('[Transcription] Erreur:', err?.response?.data || err.message);
        }
        setAiTranscribing(false);
      };

      aiMediaRecorderRef.current = recorder;
      recorder.start(250); // chunks toutes les 250ms
      setAiRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
    }
  }, [aiRecording]);

  const sendAiMessage = useCallback(async () => {
    const text = aiInput.trim();
    if ((!text && aiMedias.length === 0) || aiLoading) return;

    // Build user message display
    const mediaDesc = aiMedias.map(m => `[${m.type}: ${m.name}${m.placement ? ` → "${m.placement}"` : ''}]`).join(' ');
    const displayContent = [text, mediaDesc].filter(Boolean).join('\n');
    setAiMessages(prev => [...prev, { role: 'user', content: displayContent, medias: aiMedias }]);

    // Build enriched message for AI — images with uploaded URLs so AI can inject them
    const imageMedias = aiMedias.filter(m => m.type === 'image' && m.uploadedUrl);
    const otherMedias = aiMedias.filter(m => m.type !== 'image' || !m.uploadedUrl);

    let mediaContext = '';
    if (imageMedias.length > 0) {
      mediaContext += '\n\nImages jointes (URLs hébergées) :\n' + imageMedias.map(m =>
        `- URL: ${m.uploadedUrl}${m.placement ? ` → emplacement: "${m.placement}"` : ' (emplacement non précisé — utilise comme image principale)'}`
      ).join('\n');
      mediaContext += '\nPour chaque image, applique-la dans pageConfigPatch.premiumImages en utilisant l\'emplacement indiqué comme clé (ex: "hero" → premiumImages.hero, "problem" → premiumImages.problem, "carousel" → premiumImages.heroGallery).';
    }
    if (otherMedias.length > 0) {
      mediaContext += '\n\nAutres médias joints:\n' + otherMedias.map(m =>
        `- ${m.type}: ${m.uploadedUrl || m.localUrl}${m.placement ? ` (emplacement: "${m.placement}")` : ''}`
      ).join('\n');
    }

    const fullMessage = (text || (imageMedias.length > 0 ? 'Intègre cette image sur la page' : 'Analyse ce média')) + mediaContext;
    setAiInput('');
    setAiMedias([]);
    setAiLoading(true);

    try {
      const { data } = await ecomApi.post('/builder-ai/chat', {
        message: fullMessage,
        sections,
        model: aiModel,
        history: aiMessages.slice(-6),
      }, { timeout: 180000 });
      if (data.success) {
        if (data.sectionsPatch && Array.isArray(data.sectionsPatch)) {
          setSections(data.sectionsPatch);
          setDirty(true);
        }
        if (data.pageConfigPatch || data.themePatch) {
          setDirty(true);
        }
        setAiMessages(prev => [...prev, {
          role: 'assistant',
          content: (data.reply || 'Fait !') + (data.sectionsPatch ? '\n\n✅ Sections mises à jour.' : ''),
        }]);
      } else {
        setAiMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Erreur.' }]);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Erreur de connexion.';
      setAiMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiLoading, aiMessages, aiModel, aiMedias, sections]);

  // ─ Save ─
  const handleSave = async () => {
    setSaving(true);
    try {
      await storeManageApi.updatePages({ sections });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-500 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  // iframe container sizing per device
  const iframeContainerCls = device === 'mobile'
    ? 'w-[390px] mx-auto'
    : device === 'tablet'
    ? 'w-[768px] mx-auto'
    : 'w-full';

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition font-semibold">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-base font-bold text-gray-900">Theme Builder</h1>
          </div>
          {dirty && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Non publié</span>}
        </div>

        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Annuler (Ctrl+Z)"
              className={`p-2 rounded-md transition ${canUndo ? 'text-gray-700 hover:bg-white hover:shadow' : 'text-gray-300 cursor-not-allowed'}`}
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Rétablir (Ctrl+Shift+Z)"
              className={`p-2 rounded-md transition ${canRedo ? 'text-gray-700 hover:bg-white hover:shadow' : 'text-gray-300 cursor-not-allowed'}`}
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-5 bg-gray-200" />

          {/* Device switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {[
              { id: 'desktop', icon: <Monitor className="w-3.5 h-3.5" /> },
              { id: 'tablet', icon: <Tablet className="w-3.5 h-3.5" /> },
              { id: 'mobile', icon: <Smartphone className="w-3.5 h-3.5" /> },
            ].map(({ id, icon }) => (
              <button key={id} onClick={() => setDevice(id)} title={id} className={`p-2 rounded-md transition ${device === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{icon}</button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-200" />

          {subdomain && (
            <a href={`/store/${subdomain}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition" title="Ouvrir la boutique">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition shadow-sm ${saved ? 'bg-primary-500' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Publié !' : 'Publier'}
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel: sections list + inline editor ───────────────────── */}
        <div className="w-72 xl:w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 relative overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div>
              <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Sections</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{sections.length} section{sections.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setShowAddPanel(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-sm">
              <Plus className="w-3.5 h-3.5" />Ajouter
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">

            {/* Section list */}
            <div className="p-3 space-y-1.5">
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
                    <Layers className="w-6 h-6 text-indigo-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Page vide</p>
                  <p className="text-xs text-gray-400 mt-1">Ajoutez votre première section</p>
                  <button onClick={() => setShowAddPanel(true)} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition">
                    Commencer
                  </button>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    {sections.map((sec) => (
                      <React.Fragment key={sec.id}>
                        <SectionCard
                          section={sec}
                          isSelected={selectedId === sec.id}
                          onSelect={setSelectedId}
                          onDelete={deleteSection}
                          onDuplicate={duplicateSection}
                          onToggleVisible={toggleVisible}
                        />
                        {selectedId === sec.id && (
                          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden mb-1">
                            <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-indigo-100">
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded flex items-center justify-center text-white" style={{ background: SECTION_TYPES[sec.type]?.color || '#6b7280' }}>
                                  {SECTION_TYPES[sec.type]?.icon}
                                </div>
                                <p className="text-[11px] font-bold text-gray-800">{SECTION_TYPES[sec.type]?.label}</p>
                              </div>
                              <button onClick={() => setSelectedId(null)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400"><X className="w-3 h-3" /></button>
                            </div>
                            <div className="p-3">
                              <SectionEditor section={sec} onChange={updateSelected} />
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* Add section overlay */}
          {showAddPanel && <AddSectionPanel onAdd={addSection} onClose={() => setShowAddPanel(false)} />}
        </div>

        {/* ── Right: live inline preview ───────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className={`${iframeContainerCls} bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300`}>
            {/* Browser chrome */}
            <div className="h-9 bg-gray-50 border-b border-gray-200 flex items-center px-3 gap-2 flex-shrink-0">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white border border-gray-100 rounded px-2 py-0.5 text-[11px] text-gray-400 font-mono truncate">
                {subdomain ? `${window.location.origin}/store/${subdomain}` : 'Aperçu en direct'}
              </div>
              <span className="text-[10px] text-primary-600 font-semibold bg-primary-50 px-2 py-0.5 rounded-full flex-shrink-0">● Live</span>
            </div>

            {/* Inline rendered sections — click to select, drag to reorder */}
            <div className="min-h-[400px]">
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center px-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <Layers className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600">Aucune section</p>
                  <p className="text-xs text-gray-400 mt-1">Ajoutez des sections pour construire votre page</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    {sections.map((sec) => (
                      <SortableLiveSection
                        key={sec.id}
                        section={sec}
                        selected={selectedId === sec.id}
                        onClick={() => setSelectedId(sec.id)}
                        onFieldUpdate={onFieldUpdate}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── IA Flottante ──────────────────────────────────────────────────── */}
      <BuilderAiChat
        mode="storepage"
        context={{ sections }}
        onPatch={({ sectionsPatch }) => {
          if (sectionsPatch && Array.isArray(sectionsPatch)) {
            setSections(sectionsPatch);
            setDirty(true);
          }
        }}
      />
      {false /* dead code removed */ && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col w-[400px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-4rem)] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-bold">Assistant Builder IA</span>
            </div>
            <button onClick={() => setAiOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Sélecteur de modèle */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            {aiModel === 'gpt-5.4' ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 text-[#10a37f]" fill="currentColor">
                <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.4 14.069a4.504 4.504 0 0 1-2.059-6.173zm16.597 3.855-5.843-3.372 2.02-1.168a.076.076 0 0 1 .072 0l4.42 2.556a4.494 4.494 0 0 1-.676 8.105v-5.678a.795.795 0 0 0-.393-.443zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.419-2.549a4.494 4.494 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057v-5.57a4.494 4.494 0 0 1 7.375-3.453l-.142.08L8.704 9.93a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 text-[#C96442]" fill="currentColor">
                <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0H10.172L16.744 20.48H13.14L11.705 16.4H5.719l-1.435 4.08H.68L6.57 3.52zm4.132 9.959L8.719 7.582l-1.917 5.897h3.899z"/>
              </svg>
            )}
            <select
              value={aiModel}
              onChange={e => setAiModel(e.target.value)}
              className="flex-1 text-xs font-semibold text-gray-700 bg-transparent outline-none cursor-pointer"
            >
              <optgroup label="— Claude (Anthropic)">
                <option value="claude-sonnet">Claude Sonnet — rapide</option>
                <option value="claude-opus">Claude Opus — plus puissant</option>
              </optgroup>
              <optgroup label="— OpenAI">
                <option value="gpt-5.4">GPT-5.4</option>
              </optgroup>
            </select>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {aiMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Médias joints dans le message user */}
                {msg.medias?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-w-[85%]">
                    {msg.medias.map((m, mi) => (
                      <div key={mi} className="relative rounded-xl overflow-hidden border border-white/20 bg-indigo-500">
                        {m.type === 'image' && (
                          <img src={m.localUrl} alt={m.name} className="w-20 h-20 object-cover" />
                        )}
                        {m.type === 'audio' && (
                          <div className="flex items-center gap-1.5 px-2.5 py-2 text-white text-[10px]">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm-1 13V8l6 4-6 4z"/></svg>
                            <span className="truncate max-w-[80px]">{m.name}</span>
                          </div>
                        )}
                        {m.type === 'video' && (
                          <div className="flex items-center gap-1.5 px-2.5 py-2 text-white text-[10px]">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                            <span className="truncate max-w-[80px]">{m.name}</span>
                          </div>
                        )}
                        {m.placement && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1.5 py-0.5 truncate">→ {m.placement}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  <span className="text-xs text-gray-400">Génération en cours...</span>
                </div>
              </div>
            )}
            <div ref={aiEndRef} />
          </div>

          {/* Médias en attente */}
          {aiMedias.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex flex-wrap gap-2">
                {aiMedias.map((m, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white flex-shrink-0">
                    {m.type === 'image' ? (
                      <img src={m.localUrl} alt={m.name} className="w-14 h-14 object-cover" />
                    ) : (
                      <div className="w-14 h-14 flex flex-col items-center justify-center bg-indigo-50 text-indigo-600">
                        {m.type === 'audio'
                          ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm-1 13V8l6 4-6 4z"/></svg>
                          : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                        }
                        <span className="text-[9px] mt-0.5 px-1 truncate w-full text-center">{m.name.slice(0, 8)}</span>
                      </div>
                    )}
                    {/* Champ placement */}
                    <input
                      type="text"
                      value={m.placement}
                      onChange={e => setAiMedias(prev => prev.map((x, xi) => xi === i ? { ...x, placement: e.target.value } : x))}
                      placeholder="où ?"
                      className="absolute bottom-0 left-0 right-0 text-[9px] bg-black/60 text-white placeholder:text-white/60 border-0 outline-none px-1 py-0.5 w-full"
                    />
                    {/* Supprimer */}
                    <button
                      onClick={() => setAiMedias(prev => prev.filter((_, xi) => xi !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[10px] leading-none"
                    >×</button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">Cliquez sur "où ?" pour indiquer l'emplacement de chaque média</p>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-3 flex-shrink-0">
            {/* hidden file input */}
            <input
              ref={aiFileRef}
              type="file"
              accept="image/*,audio/*,video/*"
              multiple
              className="hidden"
              onChange={e => { handleAiFileAdd(e.target.files); e.target.value = ''; }}
            />
            <div className={`flex items-end gap-2 rounded-xl border bg-gray-50 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-100 transition ${aiRecording ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200 focus-within:border-indigo-400'}`}>
              {/* Bouton ajout média */}
              <button
                type="button"
                onClick={() => aiFileRef.current?.click()}
                className="flex-shrink-0 mb-0.5 text-gray-400 hover:text-indigo-500 transition"
                title="Joindre image, audio ou vidéo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <textarea
                ref={aiInputRef}
                value={aiTranscribing ? '⏳ Transcription en cours...' : aiInput}
                readOnly={aiTranscribing}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }}
                onPaste={e => {
                  const files = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/') || f.type.startsWith('audio/') || f.type.startsWith('video/'));
                  if (files.length > 0) { e.preventDefault(); handleAiFileAdd(files); }
                }}
                placeholder={aiRecording ? '🔴 Enregistrement vocal...' : 'Décris ce que tu veux créer ou modifier...'}
                rows={1}
                style={{ maxHeight: 80 }}
                className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none overflow-y-auto"
              />
              {/* Bouton micro */}
              <button
                type="button"
                onClick={toggleAiRecording}
                disabled={aiTranscribing}
                className={`flex-shrink-0 mb-0.5 rounded-lg p-1.5 transition disabled:opacity-40 ${
                  aiRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-gray-400 hover:text-red-500'
                }`}
                title={aiRecording ? 'Arrêter et transcrire' : 'Note vocale'}
              >
                <svg className="w-4 h-4" fill={aiRecording ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
                </svg>
              </button>
              <button
                onClick={sendAiMessage}
                disabled={(!aiInput.trim() && aiMedias.length === 0) || aiLoading || aiRecording || aiTranscribing}
                className={`flex-shrink-0 mb-0.5 rounded-lg p-1.5 text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${aiModel === 'gpt-5.4' ? 'bg-[#10a37f] hover:bg-[#0d8c6d]' : 'bg-[#C96442] hover:bg-[#b05538]'}`}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorepageBuilder;
