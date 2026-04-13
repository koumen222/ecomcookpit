import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { storeManageApi } from '../services/storeApi.js';
import RichTextEditor from '../components/RichTextEditor.jsx';
import { normalizeHomepageSections } from '../utils/homepageSections.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ICÔNES DISPONIBLES
// ═══════════════════════════════════════════════════════════════════════════════
const AVAILABLE_ICONS = [
  { id: 'truck', label: '🚚 Livraison' },
  { id: 'shield', label: '🛡️ Sécurité' },
  { id: 'package', label: '📦 Colis' },
  { id: 'timer', label: '⏱️ Rapide' },
  { id: 'badge-check', label: '✅ Vérifié' },
  { id: 'shield-check', label: '🔒 Protégé' },
  { id: 'message-circle', label: '💬 Message' },
  { id: 'phone', label: '📞 Téléphone' },
  { id: 'credit-card', label: '💳 Paiement' },
  { id: 'percent', label: '% Promo' },
  { id: 'gift', label: '🎁 Cadeau' },
  { id: 'heart', label: '❤️ Favori' },
  { id: 'star', label: '⭐ Étoile' },
  { id: 'users', label: '👥 Clients' },
  { id: 'globe', label: '🌍 Monde' },
  { id: 'map-pin', label: '📍 Lieu' },
  { id: 'rotate-ccw', label: '🔄 Retour' },
  { id: 'zap', label: '⚡ Énergie' },
  { id: 'sparkles', label: '✨ Premium' },
  { id: 'leaf', label: '🍃 Naturel' },
  { id: 'shopping-bag', label: '🛍️ Shopping' },
  { id: 'mail', label: '📧 Email' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES DE SECTIONS SUPPORTÉES (même structure que PublicStorefront)
// ═══════════════════════════════════════════════════════════════════════════════
const SECTION_TYPES = {
  hero: { label: 'Hero / Bannière', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>, color: 'bg-purple-100 text-purple-700' },
  badges: { label: 'Badges de confiance', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>, color: 'bg-blue-100 text-blue-700' },
  products: { label: 'Produits', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>, color: 'bg-green-100 text-green-700' },
  features: { label: 'Avantages', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>, color: 'bg-yellow-100 text-yellow-700' },
  testimonials: { label: 'Témoignages', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>, color: 'bg-pink-100 text-pink-700' },
  faq: { label: 'FAQ', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: 'bg-orange-100 text-orange-700' },
  contact: { label: 'Contact', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>, color: 'bg-teal-100 text-teal-700' },
  cta: { label: 'Appel à l\'action', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, color: 'bg-red-100 text-red-700' },
  image_text: { label: 'Image + Texte', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, color: 'bg-cyan-100 text-cyan-700' },
  banner: { label: 'Bannière promo', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>, color: 'bg-amber-100 text-amber-700' },
  gallery: { label: 'Galerie images', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>, color: 'bg-violet-100 text-violet-700' },
  newsletter: { label: 'Newsletter', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>, color: 'bg-emerald-100 text-emerald-700' },
  text: { label: 'Texte libre', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>, color: 'bg-indigo-100 text-indigo-700' },
  spacer: { label: 'Espacement', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>, color: 'bg-gray-100 text-gray-600' },
  custom: { label: 'Section personnalisée', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>, color: 'bg-gray-100 text-gray-700' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS DE BASE
// ═══════════════════════════════════════════════════════════════════════════════

const Field = ({ label, value, onChange, multiline, rich, type = 'text', placeholder, hint }) => (
  <div>
    <label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</label>
    {rich ? (
      <RichTextEditor
        value={value || ''}
        onChange={onChange}
        minHeight={100}
        maxHeight={280}
        placeholder={placeholder || `${label}…`}
      />
    ) : multiline ? (
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent resize-none"
      />
    ) : (
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
      />
    )}
    {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
  </div>
);

const IconSelect = ({ value, onChange }) => (
  <div>
    <label className="text-xs font-semibold text-gray-600 mb-1 block">Icône</label>
    <select
      value={value || 'star'}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
    >
      {AVAILABLE_ICONS.map(ic => (
        <option key={ic.id} value={ic.id}>{ic.label}</option>
      ))}
    </select>
  </div>
);

// ─── Items List Editor (pour badges, features, FAQ, testimonials) ────────────
const ItemsEditor = ({ items = [], onChange, renderItem, newItem, label = 'Élément', max = 10 }) => {
  const updateItem = (idx, updated) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...updated };
    onChange(next);
  };

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const moveItem = (idx, dir) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= items.length) return;
    const next = [...items];
    [next[idx], next[ni]] = [next[ni], next[idx]];
    onChange(next);
  };

  const addItem = () => {
    if (items.length >= max) return;
    onChange([...items, { ...newItem }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{label}s ({items.length})</p>
        {items.length < max && (
          <button
            onClick={addItem}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0F6B4F] bg-[#E6F2ED] rounded-lg hover:bg-[#D1E8DC] transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
          </button>
        )}
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="relative bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-gray-400 uppercase">{label} {idx + 1}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
              </button>
              <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-100 transition">
                <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          {renderItem(item, idx, (updated) => updateItem(idx, updated))}
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-xs text-gray-400">Aucun {label.toLowerCase()}</p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION CARD
// ═══════════════════════════════════════════════════════════════════════════════

const SectionCard = ({
  section,
  index,
  total,
  onMove,
  onToggle,
  onEdit,
  onDelete,
  isActive,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
}) => {
  const typeInfo = SECTION_TYPES[section.type] || SECTION_TYPES.custom;
  const itemCount = section.config?.items?.length;
  const title = section.config?.title || typeInfo.label;
  
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        onDragStart?.(section.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragOver?.(section.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop?.(section.id);
      }}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border transition-all cursor-pointer ${
        isActive
          ? 'border-[#3b82f6] bg-[#eff6ff] shadow-sm'
          : section.visible !== false
            ? 'border-transparent bg-white hover:border-gray-200 hover:bg-gray-50'
            : 'border-transparent opacity-60 bg-gray-50/70'
      } ${isDragging ? 'opacity-50 scale-[0.99]' : ''} ${isDragOver ? 'ring-2 ring-[#3b82f6] ring-offset-1' : ''}`}
      onClick={() => onSelect?.(section)}
    >
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition flex-shrink-0">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
          </svg>
        </div>

        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${typeInfo.color}`}>
          {typeInfo.icon}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[12px] font-semibold text-gray-900 truncate">{title}</p>
            {section.visible === false && (
              <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-500 flex-shrink-0">
                Masquée
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-gray-400 font-medium truncate">
            {typeInfo.label}{itemCount ? ` · ${itemCount} éléments` : ''}
          </p>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onMove(index, -1); }}
            disabled={index === 0}
            className="hidden group-hover:inline-flex p-1 rounded-md hover:bg-gray-100 disabled:opacity-30 transition"
            title="Monter"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMove(index, 1); }}
            disabled={index === total - 1}
            className="hidden group-hover:inline-flex p-1 rounded-md hover:bg-gray-100 disabled:opacity-30 transition"
            title="Descendre"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(section.id); }}
            className={`relative w-9 h-5 rounded-full transition-colors ${section.visible !== false ? 'bg-[#111827]' : 'bg-gray-300'}`}
            title={section.visible !== false ? 'Masquer' : 'Afficher'}
          >
            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${section.visible !== false ? 'translate-x-4' : ''}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(section.id); }}
            className="hidden group-hover:inline-flex p-1 rounded-md hover:bg-red-50 transition"
            title="Supprimer"
          >
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
          <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION EDITOR MODAL — Édition complète de chaque type
// ═══════════════════════════════════════════════════════════════════════════════
const SectionEditor = ({ section, onSave, onClose, inline = false }) => {
  const [config, setConfig] = useState(JSON.parse(JSON.stringify(section?.config || {})));
  const typeInfo = SECTION_TYPES[section?.type] || SECTION_TYPES.custom;

  const updateField = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));
  const updateItems = (items) => setConfig(prev => ({ ...prev, items }));

  const handleSave = () => {
    onSave({ ...section, config });
    onClose();
  };

  // ─── Hero ──────────────────────────────────────────────────────────────
  const renderHero = () => (
    <>
      <Field label="Titre principal" value={config.title} onChange={v => updateField('title', v)} placeholder="Ex: Bienvenue chez Ma Boutique" />
      <Field label="Sous-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} rich />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Texte du bouton" value={config.ctaText} onChange={v => updateField('ctaText', v)} placeholder="Voir nos produits" />
        <Field label="Lien du bouton" value={config.ctaLink} onChange={v => updateField('ctaLink', v)} placeholder="/products" />
      </div>
      <Field label="Image de fond (URL)" value={config.backgroundImage} onChange={v => updateField('backgroundImage', v)} placeholder="https://..." hint="Laissez vide pour le dégradé par défaut" />
      {config.backgroundImage && (
        <div className="rounded-xl overflow-hidden border border-gray-200 h-32">
          <img src={config.backgroundImage} alt="Aperçu" className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
        </div>
      )}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Alignement du texte</label>
        <div className="flex gap-2">
          {['left', 'center', 'right'].map(a => (
            <button key={a} onClick={() => updateField('alignment', a)} className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border-2 transition ${config.alignment === a ? 'border-[#0F6B4F] bg-[#E6F2ED] text-[#0F6B4F]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {a === 'left' ? 'Gauche' : a === 'center' ? 'Centre' : 'Droite'}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  // ─── Badges ────────────────────────────────────────────────────────────
  const renderBadges = () => (
    <ItemsEditor
      items={config.items || []}
      onChange={updateItems}
      label="Badge"
      max={8}
      newItem={{ icon: 'shield', title: 'Nouveau badge', desc: 'Description du badge' }}
      renderItem={(item, idx, update) => (
        <div className="space-y-2">
          <IconSelect value={item.icon} onChange={v => update({ icon: v })} />
          <Field label="Titre" value={item.title} onChange={v => update({ title: v })} placeholder="Ex: Livraison rapide" />
          <Field label="Description" value={item.desc} onChange={v => update({ desc: v })} placeholder="Ex: Livré en 24-48h" />
        </div>
      )}
    />
  );

  // ─── Products ──────────────────────────────────────────────────────────
  const renderProducts = () => (
    <>
      <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} placeholder="Nos Produits" />
      <Field label="Sous-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} placeholder="Découvrez notre sélection" />
      <Field label="Nombre de produits affichés" type="number" value={config.homepageLimit || config.limit || 6} onChange={v => { updateField('homepageLimit', v); updateField('limit', v); }} hint="Nombre maximum de produits sur la page d'accueil" />
    </>
  );

  // ─── Features ──────────────────────────────────────────────────────────
  const renderFeatures = () => (
    <>
      <Field label="Titre de la section" value={config.title} onChange={v => updateField('title', v)} placeholder="Pourquoi nous choisir ?" />
      <Field label="Sous-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} placeholder="Des avantages uniques" />
      <ItemsEditor
        items={config.items || []}
        onChange={updateItems}
        label="Avantage"
        max={8}
        newItem={{ icon: 'star', title: 'Nouvel avantage', desc: 'Description de l\'avantage' }}
        renderItem={(item, idx, update) => (
          <div className="space-y-2">
            <IconSelect value={item.icon} onChange={v => update({ icon: v })} />
            <Field label="Titre" value={item.title} onChange={v => update({ title: v })} />
            <Field label="Description" value={item.desc} onChange={v => update({ desc: v })} multiline />
          </div>
        )}
      />
    </>
  );

  // ─── Testimonials ─────────────────────────────────────────────────────
  const renderTestimonials = () => (
    <>
      <Field label="Titre de la section" value={config.title} onChange={v => updateField('title', v)} placeholder="Ce que disent nos clients" />
      <ItemsEditor
        items={config.items || []}
        onChange={updateItems}
        label="Témoignage"
        max={10}
        newItem={{ name: '', location: '', content: '', rating: 5 }}
        renderItem={(item, idx, update) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nom" value={item.name} onChange={v => update({ name: v })} placeholder="Nom du client" />
              <Field label="Ville / Pays" value={item.location} onChange={v => update({ location: v })} placeholder="Ex: Abidjan, CI" />
            </div>
            <Field label="Avis" value={item.content} onChange={v => update({ content: v })} multiline placeholder="Le témoignage du client..." />
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Note</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => update({ rating: star })} className={`text-xl transition ${(item.rating || 5) >= star ? 'text-yellow-400' : 'text-gray-300'}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
            <Field label="Image (URL)" value={item.image} onChange={v => update({ image: v })} placeholder="https://... (optionnel)" hint="Photo du client (optionnel)" />
          </div>
        )}
      />
    </>
  );

  // ─── FAQ ───────────────────────────────────────────────────────────────
  const renderFaq = () => (
    <>
      <Field label="Titre de la section" value={config.title} onChange={v => updateField('title', v)} placeholder="Questions fréquentes" />
      <Field label="Sous-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} placeholder="Tout ce que vous devez savoir" />
      <ItemsEditor
        items={config.items || []}
        onChange={updateItems}
        label="Question"
        max={15}
        newItem={{ question: '', answer: '' }}
        renderItem={(item, idx, update) => (
          <div className="space-y-2">
            <Field label="Question" value={item.question} onChange={v => update({ question: v })} placeholder="Ex: Quels sont les délais de livraison ?" />
            <Field label="Réponse" value={item.answer || item.reponse} onChange={v => update({ answer: v })} multiline placeholder="La réponse à cette question..." />
          </div>
        )}
      />
    </>
  );

  // ─── Contact ───────────────────────────────────────────────────────────
  const renderContact = () => (
    <>
      <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} placeholder="Contactez-nous" />
      <Field label="Sous-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} rich />
      <div className="grid grid-cols-2 gap-3">
        <Field label="WhatsApp" value={config.whatsapp} onChange={v => updateField('whatsapp', v)} placeholder="+225 07 XX XX XX XX" hint="Numéro avec indicatif pays" />
        <Field label="Téléphone" value={config.phone} onChange={v => updateField('phone', v)} placeholder="+225 07 XX XX XX XX" />
      </div>
      <Field label="Email" value={config.email} onChange={v => updateField('email', v)} placeholder="contact@maboutique.com" />
      <Field label="Adresse" value={config.address} onChange={v => updateField('address', v)} placeholder="Abidjan, Côte d'Ivoire" />
    </>
  );

  // ─── CTA ───────────────────────────────────────────────────────────────
  const renderCta = () => (
    <>
      <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} placeholder="Prêt à commander ?" />
      <Field label="Contenu" value={config.content} onChange={v => updateField('content', v)} rich />
      <Field label="Texte du bouton" value={config.ctaText} onChange={v => updateField('ctaText', v)} placeholder="Commander maintenant" />
      <Field label="Lien" value={config.link || config.ctaLink} onChange={v => { updateField('link', v); updateField('ctaLink', v); }} placeholder="/products" />
    </>
  );

  // ─── Text ──────────────────────────────────────────────────────────────
  const renderText = () => (
    <>
      <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} placeholder="Titre de la section" />
      <Field label="Contenu" value={config.content} onChange={v => updateField('content', v)} rich />
      <Field label="Couleur de fond" value={config.backgroundColor} onChange={v => updateField('backgroundColor', v)} placeholder="#ffffff" hint="Code hex (ex: #f3f4f6)" />
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Alignement</label>
        <div className="flex gap-2">
          {['left', 'center', 'right'].map(a => (
            <button key={a} onClick={() => updateField('alignment', a)} className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border-2 transition ${(config.alignment || 'left') === a ? 'border-[#0F6B4F] bg-[#E6F2ED] text-[#0F6B4F]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {a === 'left' ? 'Gauche' : a === 'center' ? 'Centre' : 'Droite'}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  // ─── Image + Texte ─────────────────────────────────────────────────────
  const renderImageText = () => (
    <>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Disposition</label>
        <div className="flex gap-2">
          {[{ v: 'text_left', l: '📝 Texte à gauche' }, { v: 'text_right', l: '🖼️ Image à gauche' }].map(o => (
            <button key={o.v} onClick={() => updateField('layout', o.v)} className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border-2 transition ${(config.layout || 'text_left') === o.v ? 'border-[#0F6B4F] bg-[#E6F2ED] text-[#0F6B4F]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>
      <Field label="Sur-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} placeholder="EX: QUI SOMMES-NOUS" hint="Petit texte au-dessus du titre (optionnel)" />
      <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} placeholder="Notre Histoire" />
      <Field label="Contenu" value={config.content} onChange={v => updateField('content', v)} rich />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Texte du bouton" value={config.ctaText} onChange={v => updateField('ctaText', v)} placeholder="En savoir plus" />
        <Field label="Lien du bouton" value={config.ctaLink} onChange={v => updateField('ctaLink', v)} placeholder="/products" />
      </div>
      <Field label="Image (URL)" value={config.image} onChange={v => updateField('image', v)} placeholder="https://..." hint="L'image affichée à côté du texte" />
      {config.image && (
        <div className="rounded-xl overflow-hidden border border-gray-200 h-32">
          <img src={config.image} alt="Aperçu" className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
        </div>
      )}
      <ItemsEditor
        items={config.items || []}
        onChange={updateItems}
        label="Point clé"
        max={6}
        newItem={{ icon: 'star', title: 'Avantage' }}
        renderItem={(item, idx, update) => (
          <div className="grid grid-cols-2 gap-2">
            <IconSelect value={item.icon} onChange={v => update({ icon: v })} />
            <Field label="Texte" value={item.title} onChange={v => update({ title: v })} />
          </div>
        )}
      />
    </>
  );

  // ─── Banner Promo ──────────────────────────────────────────────────────
  const renderBanner = () => (
    <>
      <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} placeholder="🔥 Offre spéciale — Livraison GRATUITE !" />
      <Field label="Contenu" value={config.content} onChange={v => updateField('content', v)} rich />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Texte du bouton" value={config.ctaText} onChange={v => updateField('ctaText', v)} placeholder="En profiter" />
        <Field label="Lien du bouton" value={config.ctaLink} onChange={v => updateField('ctaLink', v)} placeholder="/products" />
      </div>
      <Field label="Image de fond (URL)" value={config.backgroundImage} onChange={v => updateField('backgroundImage', v)} placeholder="https://... (optionnel)" hint="Laissez vide pour le dégradé par défaut" />
    </>
  );

  // ─── Gallery ───────────────────────────────────────────────────────────
  const renderGallery = () => (
    <>
      <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} placeholder="Notre galerie" />
      <Field label="Sous-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} placeholder="Découvrez nos produits en images" />
      <ItemsEditor
        items={config.images || []}
        onChange={imgs => setConfig(prev => ({ ...prev, images: imgs }))}
        label="Image"
        max={12}
        newItem={{ url: '', alt: '' }}
        renderItem={(item, idx, update) => (
          <div className="space-y-2">
            <Field label="URL de l'image" value={item.url} onChange={v => update({ url: v })} placeholder="https://..." />
            <Field label="Légende" value={item.alt} onChange={v => update({ alt: v })} placeholder="Description de l'image" />
            {item.url && (
              <div className="rounded-lg overflow-hidden border border-gray-200 h-20">
                <img src={item.url} alt={item.alt || ''} className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
              </div>
            )}
          </div>
        )}
      />
    </>
  );

  // ─── Newsletter ────────────────────────────────────────────────────────
  const renderNewsletter = () => (
    <>
      <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} placeholder="Restez informé(e) !" />
      <Field label="Sous-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} rich />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placeholder email" value={config.placeholder} onChange={v => updateField('placeholder', v)} placeholder="Votre adresse email" />
        <Field label="Texte du bouton" value={config.buttonText} onChange={v => updateField('buttonText', v)} placeholder="S'inscrire" />
      </div>
    </>
  );

  // ─── Spacer ────────────────────────────────────────────────────────────
  const renderSpacer = () => (
    <>
      <Field label="Hauteur (px)" type="number" value={config.height || 40} onChange={v => updateField('height', v)} hint="Hauteur de l'espacement en pixels" />
      <Field label="Couleur de fond" value={config.backgroundColor} onChange={v => updateField('backgroundColor', v)} placeholder="transparent" hint="Code hex ou 'transparent'" />
    </>
  );

  // ─── Custom ────────────────────────────────────────────────────────────
  const renderCustom = () => (
    <>
      <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} />
      <Field label="Contenu" value={config.content} onChange={v => updateField('content', v)} rich />
    </>
  );

  const renderers = {
    hero: renderHero,
    badges: renderBadges,
    products: renderProducts,
    features: renderFeatures,
    testimonials: renderTestimonials,
    faq: renderFaq,
    contact: renderContact,
    cta: renderCta,
    image_text: renderImageText,
    banner: renderBanner,
    gallery: renderGallery,
    newsletter: renderNewsletter,
    text: renderText,
    spacer: renderSpacer,
    custom: renderCustom,
  };

  const renderFields = renderers[section?.type] || renderCustom;
  const isWide = ['badges', 'features', 'testimonials', 'faq', 'image_text', 'gallery'].includes(section?.type);

  const content = (
      <div className={`bg-white rounded-2xl ${inline ? 'border border-gray-200 h-full' : 'shadow-2xl border border-gray-200'} w-full ${inline ? 'max-w-none' : isWide ? 'max-w-2xl' : 'max-w-md'} ${inline ? 'flex-1' : 'max-h-[90vh]'} flex flex-col`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
              {typeInfo.icon}
            </span>
            <h3 className="text-sm font-bold text-gray-900">Modifier : {typeInfo.label}</h3>
          </div>
          {onClose ? (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : <div className="w-8" />}
        </div>
        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {renderFields()}
        </div>
        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          {onClose ? (
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
              Annuler
            </button>
          ) : (
            <div className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-400 bg-gray-50 rounded-xl text-center">
              Sauvegarde automatique active
            </div>
          )}
          <button onClick={handleSave} className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-[#0F6B4F] rounded-xl hover:bg-[#0A5740] transition">
            {inline ? 'Appliquer' : 'Enregistrer'}
          </button>
        </div>
      </div>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      {content}
    </div>
  );
};

// ─── Add Section Modal ───────────────────────────────────────────────────────
const AddSectionModal = ({ onAdd, onClose }) => {
  const types = Object.entries(SECTION_TYPES);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Ajouter une section</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-2">
          {types.map(([type, info]) => (
            <button
              key={type}
              onClick={() => { onAdd(type); onClose(); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-transparent hover:border-[#4D9F82] transition ${info.color}`}
            >
              <span className="text-xl">{info.icon}</span>
              <span className="text-sm font-semibold">{info.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const BoutiquePages = () => {
  const [sections, setSections] = useState([]);
  const [storeUrl, setStoreUrl] = useState(null);
  const [storeSubdomain, setStoreSubdomain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [iframeKey, setIframeKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarMode, setSidebarMode] = useState('sections');
  const [dragFromId, setDragFromId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const saveTimer = useRef(null);
  const previewViewportRef = useRef(null);
  const previewIframeRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);

  const cloneSections = useCallback((value) => {
    try {
      return JSON.parse(JSON.stringify(value || []));
    } catch {
      return Array.isArray(value) ? [...value] : [];
    }
  }, []);

  const sectionsAreEqual = useCallback((left, right) => {
    return JSON.stringify(left || []) === JSON.stringify(right || []);
  }, []);

  const syncActiveSection = useCallback((nextSections, currentActiveId = activeSection?.id) => {
    const nextActive = currentActiveId
      ? nextSections.find((section) => section.id === currentActiveId) || nextSections[0] || null
      : nextSections[0] || null;

    setActiveSection(nextActive);

    if (!nextActive) {
      setSidebarMode('sections');
    }
  }, [activeSection?.id]);

  // Load sections
  useEffect(() => {
    const load = async () => {
      try {
        const [pagesRes, configRes] = await Promise.all([
          storeManageApi.getPages(),
          storeManageApi.getStoreConfig(),
        ]);
        
        const data = pagesRes.data?.data || pagesRes.data;
        if (Array.isArray(data?.sections)) {
          const normalized = normalizeHomepageSections(data.sections) || [];
          setSections(normalized);
          setActiveSection(normalized[0] || null);
        } else {
          setSections([]);
          setActiveSection(null);
        }

        setSidebarMode('sections');
    setSidebarOpen(true);
    setUndoStack([]);
    setRedoStack([]);
        
        const subdomain = configRes.data?.data?.subdomain;
        if (subdomain) {
          setStoreSubdomain(subdomain);
          setStoreUrl(`https://${subdomain}.scalor.net`);
        } else {
          setStoreSubdomain(null);
        }
      } catch (err) {
        console.error('Failed to load pages:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const autoSave = useCallback((nextSections) => {
    clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        await storeManageApi.updatePages({ sections: nextSections });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2200);
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('error');
      }
    }, 450);
  }, []);

  const openEditor = useCallback((section) => {
    setActiveSection(section);
    setSidebarMode('editor');
    setSidebarOpen(true);
  }, []);

  const openLibrary = useCallback(() => {
    setSidebarMode('library');
    setSidebarOpen(true);
  }, []);

  const backToSections = useCallback(() => {
    setSidebarMode('sections');
  }, []);

  // Move section
  const handleMove = useCallback((index, direction) => {
    setSections(prev => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      setUndoStack((stack) => [...stack, cloneSections(prev)]);
      setRedoStack([]);
      autoSave(next);
      return next;
    });
    setSaveStatus('saving');
  }, [autoSave, cloneSections]);

  // Toggle visibility
  const handleToggle = useCallback((id) => {
    setSections(prev => {
      const next = prev.map(s => 
        s.id === id ? { ...s, visible: s.visible === false ? true : false } : s
      );
      if (sectionsAreEqual(prev, next)) return prev;
      setUndoStack((stack) => [...stack, cloneSections(prev)]);
      setRedoStack([]);
      autoSave(next);
      return next;
    });
  }, [autoSave, cloneSections, sectionsAreEqual]);

  // Update section
  const handleUpdate = useCallback((updated) => {
    setSections(prev => {
      const next = prev.map(s => s.id === updated.id ? updated : s);
      if (sectionsAreEqual(prev, next)) return prev;
      setUndoStack((stack) => [...stack, cloneSections(prev)]);
      setRedoStack([]);
      autoSave(next);
      return next;
    });
    setActiveSection(updated);
  }, [autoSave, cloneSections, sectionsAreEqual]);

  // Delete section
  const handleDelete = useCallback((id) => {
    if (!confirm('Supprimer cette section ?')) return;
    setSections(prev => {
      const next = prev.filter(s => s.id !== id);
      if (sectionsAreEqual(prev, next)) return prev;
      setUndoStack((stack) => [...stack, cloneSections(prev)]);
      setRedoStack([]);
      autoSave(next);
      if (activeSection?.id === id) {
        setActiveSection(next[0] || null);
        setSidebarMode(next[0] ? 'editor' : 'sections');
      }
      return next;
    });
  }, [activeSection?.id, autoSave, cloneSections, sectionsAreEqual]);

  const handleDragDrop = useCallback((fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setSections((prev) => {
      const fromIndex = prev.findIndex((section) => section.id === fromId);
      const toIndex = prev.findIndex((section) => section.id === toId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      setUndoStack((stack) => [...stack, cloneSections(prev)]);
      setRedoStack([]);
      autoSave(next);
      return next;
    });
  }, [autoSave, cloneSections]);

  const handleDragStart = useCallback((id) => {
    setDragFromId(id);
  }, []);

  const handleDragOver = useCallback((id) => {
    if (id !== dragFromId) {
      setDragOverId(id);
    }
  }, [dragFromId]);

  const handleDragEnd = useCallback(() => {
    setDragFromId(null);
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((toId) => {
    handleDragDrop(dragFromId, toId);
    setDragFromId(null);
    setDragOverId(null);
  }, [dragFromId, handleDragDrop]);

  // Add section with proper defaults
  const handleAdd = useCallback((type) => {
    const id = `${type}-${Date.now()}`;
    const typeInfo = SECTION_TYPES[type];
    const defaults = {
      hero: { title: 'Bienvenue', subtitle: '', ctaText: 'Voir nos produits', ctaLink: '/products', backgroundImage: '', alignment: 'center' },
      badges: { items: [{ icon: 'truck', title: 'Livraison rapide', desc: 'Livré en 24-48h' }, { icon: 'shield', title: 'Paiement sécurisé', desc: '100% sécurisé' }, { icon: 'rotate-ccw', title: 'Retours faciles', desc: 'Satisfait ou remboursé' }] },
      products: { title: 'Nos Produits', subtitle: '', homepageLimit: 6, limit: 6 },
      features: { title: 'Pourquoi nous choisir ?', subtitle: '', items: [{ icon: 'star', title: 'Qualité Premium', desc: 'Des produits de qualité' }] },
      testimonials: { title: 'Avis clients', items: [{ name: '', location: '', content: '', rating: 5 }] },
      faq: { title: 'Questions fréquentes', subtitle: '', items: [{ question: '', answer: '' }] },
      contact: { title: 'Contactez-nous', subtitle: '', whatsapp: '', phone: '', email: '', address: '' },
      cta: { title: 'Prêt à commander ?', content: '', ctaText: 'Commander', link: '/products' },
      image_text: { layout: 'text_left', title: 'Notre Histoire', subtitle: '', content: '', ctaText: 'En savoir plus', ctaLink: '/products', image: '', items: [] },
      banner: { title: '🔥 Offre spéciale !', content: '', ctaText: 'En profiter', ctaLink: '/products', backgroundImage: '' },
      gallery: { title: 'Notre galerie', subtitle: '', images: [] },
      newsletter: { title: 'Restez informé(e) !', subtitle: '', placeholder: 'Votre adresse email', buttonText: "S'inscrire" },
      text: { title: '', content: '', backgroundColor: '#ffffff', alignment: 'left' },
      spacer: { height: 40, backgroundColor: 'transparent' },
      custom: { title: typeInfo.label, content: '' },
    };
    const newSection = {
      id,
      type,
      visible: true,
      config: defaults[type] || { title: typeInfo.label },
    };
    setSections(prev => {
      const next = [...prev, newSection];
      setUndoStack((stack) => [...stack, cloneSections(prev)]);
      setRedoStack([]);
      autoSave(next);
      return next;
    });
    setActiveSection(newSection);
    setSidebarMode('editor');
    setSidebarOpen(true);
  }, [autoSave, cloneSections]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previousSections = cloneSections(undoStack[undoStack.length - 1]);
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, cloneSections(sections)]);
    setSections(previousSections);
    syncActiveSection(previousSections);
    autoSave(previousSections);
    setSaveStatus('saving');
  }, [autoSave, cloneSections, sections, syncActiveSection, undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextSections = cloneSections(redoStack[redoStack.length - 1]);
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, cloneSections(sections)]);
    setSections(nextSections);
    syncActiveSection(nextSections);
    autoSave(nextSections);
    setSaveStatus('saving');
  }, [autoSave, cloneSections, redoStack, sections, syncActiveSection]);

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      await storeManageApi.updatePages({ sections });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      alert('Erreur lors de la sauvegarde');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Regenerate with AI
  const handleRegenerate = async () => {
    if (!confirm('Régénérer la page d\'accueil avec l\'IA ? Cela remplacera les sections actuelles.')) return;
    setRegenerating(true);
    try {
      const res = await storeManageApi.regenerateHomepage();
      const newSections = res.data?.sections;
      if (Array.isArray(newSections) && newSections.length > 0) {
        const normalizedSections = normalizeHomepageSections(newSections) || [];
        if (!sectionsAreEqual(sections, normalizedSections)) {
          setUndoStack((stack) => [...stack, cloneSections(sections)]);
          setRedoStack([]);
        }
        setSections(normalizedSections);
        setActiveSection(normalizedSections[0] || null);
        await storeManageApi.updatePages({ sections: normalizedSections });
        setSaveStatus('saved');
        setSidebarOpen(false);
      }
    } catch (err) {
      alert('Erreur lors de la régénération');
    } finally {
      setRegenerating(false);
    }
  };

  const previewFrameSize = useMemo(() => {
    if (previewDevice === 'mobile') return { width: 390, height: 844 };
    if (previewDevice === 'tablet') return { width: 834, height: 1112 };
    return { width: 1440, height: 980 };
  }, [previewDevice]);

  useLayoutEffect(() => {
    const element = previewViewportRef.current;
    if (!element) return undefined;

    const updateScale = () => {
      const rect = element.getBoundingClientRect();
      const availableWidth = Math.max(rect.width - 24, 320);
      const availableHeight = Math.max(rect.height - 24, 320);
      const nextScale = Math.min(
        availableWidth / previewFrameSize.width,
        availableHeight / previewFrameSize.height,
        1
      );
      setPreviewScale(Number.isFinite(nextScale) ? nextScale : 1);
    };

    updateScale();

    const observer = new ResizeObserver(() => updateScale());
    observer.observe(element);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [previewFrameSize, sidebarOpen]);

  const previewSrc = useMemo(() => {
    if (!storeSubdomain) return null;
    return `/store/${storeSubdomain}?builderPreview=${iframeKey}`;
  }, [storeSubdomain, iframeKey]);

  const pushPreviewSections = useCallback((nextSections = sections) => {
    const iframeWindow = previewIframeRef.current?.contentWindow;
    if (!iframeWindow) return;

    iframeWindow.postMessage(
      {
        type: 'storefront-builder:update-sections',
        sections: nextSections,
      },
      window.location.origin
    );
  }, [sections]);

  useEffect(() => {
    if (!previewSrc) return;
    pushPreviewSections(sections);
  }, [sections, previewSrc, pushPreviewSections]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#0F6B4F] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen min-h-0 w-full bg-[#f3f4f6] flex flex-col overflow-hidden">
      <div className="h-14 border-b border-gray-200 bg-white px-4 lg:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/ecom/boutique"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50"
            title="Retour au dashboard boutique"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSidebarOpen((current) => !current)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50"
              title={sidebarOpen ? 'Fermer le panneau' : 'Ouvrir le panneau'}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
              </svg>
            </button>
            <div className="h-9 w-px bg-gray-200" />
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              title="Retour en arrière"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l-4-4m0 0l4-4m-4 4h11a4 4 0 110 8h-1" />
              </svg>
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              title="Aller en avant"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 14l4-4m0 0l-4-4m4 4H8a4 4 0 100 8h1" />
              </svg>
            </button>
            <div className="h-9 w-px bg-gray-200" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Page d'accueil</p>
            <p className="text-[11px] text-gray-400 truncate">Builder boutique style Shopify</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center bg-gray-100 rounded-xl p-1">
              {['desktop', 'tablet', 'mobile'].map((device) => (
                <button
                  key={device}
                  onClick={() => setPreviewDevice(device)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${previewDevice === device ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablette' : 'Mobile'}
                </button>
              ))}
          </div>
          {storeUrl && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Voir
            </a>
          )}
          <button
            onClick={() => {
              setPreviewLoading(true);
              setIframeKey((current) => current + 1);
            }}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
          >
            Recharger
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white transition shadow-sm ${
              saveStatus === 'saved' ? 'bg-green-500' : saveStatus === 'error' ? 'bg-red-500' : 'bg-[#111827] hover:bg-[#000000]'
            } disabled:opacity-60`}
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Enregistrement...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Sauvegardé
              </>
            ) : (
              <>Sauvegarder</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full bg-[#f3f4f6]">
          {sidebarOpen && (
            <aside className="w-full max-w-[284px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
              {sidebarMode === 'editor' && activeSection ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 bg-white">
                    <button
                      onClick={backToSections}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Sections
                    </button>
                    <p className="text-xs font-bold text-gray-800 truncate">{SECTION_TYPES[activeSection.type]?.label || 'Section'}</p>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-200 transition"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 p-3">
                    <SectionEditor
                      section={activeSection}
                      onSave={handleUpdate}
                      inline
                      onClose={backToSections}
                    />
                  </div>
                </>
              ) : sidebarMode === 'library' ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 bg-white">
                    <button
                      onClick={backToSections}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Retour
                    </button>
                    <p className="text-xs font-bold text-gray-800">Bibliothèque de sections</p>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-200 transition"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                      <svg className="w-4 h-4 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-[11px] text-amber-800">Ajoutez les sections dans le modèle de votre page d'accueil puis réorganisez-les dans la liste.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {Object.entries(SECTION_TYPES).map(([type, info]) => (
                        <button
                          key={type}
                          onClick={() => handleAdd(type)}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition hover:border-[#4D9F82] hover:shadow-sm ${info.color}`}
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80">{info.icon}</span>
                          <span className="text-sm font-semibold">{info.label}</span>
                          <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="border-b border-gray-200 bg-white flex-shrink-0">
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">Page d'accueil</p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                    <div className="px-4 py-3 space-y-1">
                      <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] text-gray-500 hover:bg-gray-50 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        En-tête
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50/80">
                        <div className="flex items-center justify-between px-2.5 py-2 border-b border-gray-200/80">
                          <div>
                            <p className="text-[12px] font-semibold text-gray-800">Modèle</p>
                            <p className="text-[10px] text-gray-400">{sections.length} sections</p>
                          </div>
                          <button
                            onClick={openLibrary}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[#2563eb] hover:bg-blue-50 transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Ajouter une section
                          </button>
                        </div>
                        <div className="p-2 space-y-1.5">
                          {sections.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-5 text-center text-xs text-gray-400">
                              Aucune section dans le modèle.
                            </div>
                          ) : (
                            sections.map((section, idx) => (
                              <SectionCard
                                key={section.id}
                                section={section}
                                index={idx}
                                total={sections.length}
                                onMove={handleMove}
                                onToggle={handleToggle}
                                onEdit={openEditor}
                                onDelete={handleDelete}
                                isActive={activeSection?.id === section.id}
                                onSelect={openEditor}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onDragEnd={handleDragEnd}
                                isDragging={dragFromId === section.id}
                                isDragOver={dragOverId === section.id && dragFromId !== section.id}
                              />
                            ))
                          )}
                          <button
                            onClick={openLibrary}
                            className="w-full flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-[12px] font-medium text-[#2563eb] hover:bg-blue-50 hover:border-blue-200 transition"
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current">+</span>
                            Ajouter une section
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] text-gray-500 hover:bg-gray-50 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M6 10h12M8 14h8M10 18h4" />
                        </svg>
                        Pied de page
                      </div>
                    </div>
                    <div className="px-2 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 sticky bottom-0 bg-white/95 backdrop-blur">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRegenerate}
                          disabled={regenerating}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-60"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          IA
                        </button>
                        <button
                          onClick={() => setSidebarOpen(false)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-200 transition"
                        >
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </aside>
          )}

          <div className="flex-1 min-w-0 bg-[#eceff3] p-3 lg:p-4 overflow-hidden relative">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Ouvrir le panneau
              </button>
            )}

            <div className="h-full rounded-[20px] bg-white shadow-lg overflow-hidden border border-gray-200 flex flex-col">
              <div className="h-10 bg-[#f7f7f8] border-b border-gray-200 flex items-center px-3 gap-2 select-none shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white rounded px-2 py-1 text-[10px] text-gray-400 font-mono border border-gray-200 truncate">
                  {previewSrc ? `${window.location.origin}${previewSrc}` : 'Aperçu indisponible'}
                </div>
              </div>

              <div ref={previewViewportRef} className="flex-1 bg-[#eceff3] overflow-hidden p-3 lg:p-4">
                {previewSrc ? (
                  <div className="h-full w-full flex items-start justify-center overflow-auto">
                    <div
                      className="relative"
                      style={{
                        width: `${previewFrameSize.width * previewScale}px`,
                        height: `${previewFrameSize.height * previewScale}px`,
                        minWidth: `${previewFrameSize.width * previewScale}px`,
                      }}
                    >
                      {previewLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[16px] border border-gray-200 bg-white/92 backdrop-blur-sm shadow-sm">
                          <div className="flex flex-col items-center gap-3 text-center px-6">
                            <div className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-[#0F6B4F] animate-spin" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Chargement de l'aperçu</p>
                              <p className="text-xs text-gray-500 mt-1">La page d'accueil se charge dans le canvas builder.</p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div
                        style={{
                          width: `${previewFrameSize.width}px`,
                          height: `${previewFrameSize.height}px`,
                          transform: `scale(${previewScale})`,
                          transformOrigin: 'top left',
                        }}
                      >
                        <iframe
                          ref={previewIframeRef}
                          key={iframeKey}
                          src={previewSrc}
                          title="Aperçu boutique"
                          onLoad={() => {
                            setPreviewLoading(false);
                            pushPreviewSections(sections);
                          }}
                          className="rounded-[16px] border border-gray-200 bg-white shadow-sm"
                          style={{ width: `${previewFrameSize.width}px`, height: `${previewFrameSize.height}px` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full min-h-[640px] flex items-center justify-center bg-white rounded-[20px] border border-gray-200">
                    <div className="max-w-md text-center px-8">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5h18M7 3v4m10-4v4M6 9h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2z" />
                        </svg>
                      </div>
                      <p className="text-base font-semibold text-gray-900">Aperçu indisponible</p>
                      <p className="mt-2 text-sm text-gray-500">Configurez d'abord un sous-domaine pour afficher votre page d'accueil dans un canvas professionnel.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default BoutiquePages;
