import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { storeManageApi } from '../services/storeApi.js';
import RichTextEditor from '../components/RichTextEditor.jsx';

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

const SectionCard = ({ section, index, total, onMove, onToggle, onEdit, onDelete }) => {
  const typeInfo = SECTION_TYPES[section.type] || SECTION_TYPES.custom;
  const itemCount = section.config?.items?.length;
  
  return (
    <div className={`group bg-white rounded-xl border-2 transition-all ${
      section.visible !== false ? 'border-gray-200 hover:border-[#4D9F82]' : 'border-gray-100 opacity-60'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle */}
        <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
          </svg>
        </div>

        {/* Icon + label */}
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${typeInfo.color}`}>
          {typeInfo.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{section.config?.title || typeInfo.label}</p>
          <p className="text-[10px] text-gray-400 uppercase font-medium">
            {typeInfo.label}
            {itemCount ? ` · ${itemCount} éléments` : ''}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => onMove(index, -1)} disabled={index === 0} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition" title="Monter">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition" title="Descendre">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button onClick={() => onEdit(section)} className="p-1.5 rounded-lg hover:bg-[#E6F2ED] transition" title="Modifier">
            <svg className="w-4 h-4 text-[#0F6B4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={() => onDelete(section.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition" title="Supprimer">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>

        {/* Toggle visibility */}
        <button
          onClick={() => onToggle(section.id)}
          className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
            section.visible !== false ? 'bg-[#0F6B4F]' : 'bg-gray-300'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            section.visible !== false ? 'translate-x-5' : ''
          }`} />
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION EDITOR MODAL — Édition complète de chaque type
// ═══════════════════════════════════════════════════════════════════════════════
const SectionEditor = ({ section, onSave, onClose }) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl border border-gray-200 w-full ${isWide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] flex flex-col`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
              {typeInfo.icon}
            </span>
            <h3 className="text-sm font-bold text-gray-900">Modifier : {typeInfo.label}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {renderFields()}
        </div>
        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
            Annuler
          </button>
          <button onClick={handleSave} className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-[#0F6B4F] rounded-xl hover:bg-[#0A5740] transition">
            Enregistrer
          </button>
        </div>
      </div>
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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
          setSections(data.sections);
        }
        
        const subdomain = configRes.data?.data?.subdomain;
        if (subdomain) {
          setStoreUrl(`https://${subdomain}.scalor.net`);
        }
      } catch (err) {
        console.error('Failed to load pages:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Move section
  const handleMove = useCallback((index, direction) => {
    setSections(prev => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
    setSaved(false);
  }, []);

  // Toggle visibility
  const handleToggle = useCallback((id) => {
    setSections(prev => prev.map(s => 
      s.id === id ? { ...s, visible: s.visible === false ? true : false } : s
    ));
    setSaved(false);
  }, []);

  // Update section
  const handleUpdate = useCallback((updated) => {
    setSections(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSaved(false);
  }, []);

  // Delete section
  const handleDelete = useCallback((id) => {
    if (!confirm('Supprimer cette section ?')) return;
    setSections(prev => prev.filter(s => s.id !== id));
    setSaved(false);
  }, []);

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
    setSections(prev => [...prev, newSection]);
    setSaved(false);
  }, []);

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      await storeManageApi.updatePages({ sections });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Erreur lors de la sauvegarde');
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
        setSections(newSections);
        await storeManageApi.updatePages({ sections: newSections });
        setSaved(true);
      }
    } catch (err) {
      alert('Erreur lors de la régénération');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#0F6B4F] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ma Boutique</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez les sections de votre page d'accueil</p>
        </div>
        <div className="flex gap-2">
          {storeUrl && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0F6B4F] bg-[#E6F2ED] hover:bg-[#D1E8DC] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Voir ma boutique
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition shadow-md ${
              saved ? 'bg-green-500' : 'bg-[#0F6B4F] hover:bg-[#0A5740]'
            } disabled:opacity-60`}
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Enregistrement...
              </>
            ) : saved ? (
              <>✓ Sauvegardé</>
            ) : (
              <>Sauvegarder</>
            )}
          </button>
        </div>
      </div>

      {/* Store URL banner */}
      {storeUrl && (
        <div className="bg-gradient-to-r from-[#0F6B4F] to-[#0A5740] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-white text-center sm:text-left">
            <p className="text-xs font-medium opacity-80">Votre boutique en ligne</p>
            <p className="text-sm font-mono font-bold">{storeUrl}</p>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-4 py-2 bg-white/20 text-white text-sm font-semibold rounded-lg hover:bg-white/30 transition flex items-center gap-2 border border-white/30 disabled:opacity-60"
          >
            {regenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Régénération...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Régénérer avec l'IA
              </>
            )}
          </button>
        </div>
      )}

      {/* Info */}
      <div className="bg-[#E6F2ED] border border-[#96C7B5] rounded-2xl p-4 flex items-start gap-3">
        <svg className="w-4 h-4 text-[#0F6B4F] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-[#0A5740]">
          <strong>Organisez votre page</strong> en déplaçant les sections avec les flèches. 
          Activez/désactivez avec le toggle. Cliquez sur le crayon pour modifier le contenu.
        </p>
      </div>

      {/* Sections list */}
      {sections.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500 mb-4">Aucune section configurée</p>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-6 py-3 bg-[#0F6B4F] text-white rounded-xl font-semibold hover:bg-[#0A5740] transition"
          >
            {regenerating ? 'Génération en cours...' : 'Générer avec l\'IA'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map((section, idx) => (
            <SectionCard
              key={section.id}
              section={section}
              index={idx}
              total={sections.length}
              onMove={handleMove}
              onToggle={handleToggle}
              onEdit={setEditingSection}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add section button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-semibold text-gray-500 hover:border-[#4D9F82] hover:text-[#0F6B4F] hover:bg-[#E6F2ED] transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Ajouter une section
      </button>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-gray-200">
        <Link
          to="/ecom/boutique/theme"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-[#4D9F82] hover:bg-[#E6F2ED] transition"
        >
          <span className="text-lg">🎨</span>
          Modifier le thème
        </Link>
        <Link
          to="/ecom/boutique/products"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-[#4D9F82] hover:bg-[#E6F2ED] transition"
        >
          <span className="text-lg">📦</span>
          Gérer les produits
        </Link>
        <Link
          to="/ecom/boutique/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-[#4D9F82] hover:bg-[#E6F2ED] transition"
        >
          <span className="text-lg">⚙️</span>
          Paramètres
        </Link>
        <Link
          to="/ecom/boutique"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-[#4D9F82] hover:bg-[#E6F2ED] transition"
        >
          <span className="text-lg">📊</span>
          Dashboard
        </Link>
      </div>

      {/* Modals */}
      {editingSection && (
        <SectionEditor
          section={editingSection}
          onSave={handleUpdate}
          onClose={() => setEditingSection(null)}
        />
      )}

      {showAddModal && (
        <AddSectionModal
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

export default BoutiquePages;
