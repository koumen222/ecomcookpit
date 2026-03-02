import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import api from '../../lib/api';

const SectionIcon = ({ type }) => {
  const props = { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' };
  if (type === 'hero') return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
  if (type === 'featured_products') return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
  if (type === 'promo_banner') return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
  if (type === 'reviews') return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
  if (type === 'faq') return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  if (type === 'cta') return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>;
  if (type === 'footer') return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>;
  return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" /></svg>;
};

const DEFAULT_SECTIONS = [
  { id: 'hero', type: 'hero', label: 'Hero / Bannière', enabled: true, config: { title: '', subtitle: '', ctaText: 'Voir nos produits', bgImage: '' } },
  { id: 'featured', type: 'featured_products', label: 'Produits vedettes', enabled: true, config: { count: 8, title: 'Nos Produits' } },
  { id: 'promo', type: 'promo_banner', label: 'Bannière promo', enabled: true, config: { text: '', bgColor: '#EF4444' } },
  { id: 'reviews', type: 'reviews', label: 'Avis clients', enabled: true, config: { title: 'Ce que disent nos clients' } },
  { id: 'faq', type: 'faq', label: 'FAQ', enabled: true, config: { title: 'Questions fréquentes', items: [] } },
  { id: 'cta', type: 'cta', label: 'Appel à l\'action', enabled: false, config: { title: '', buttonText: 'Commander', buttonUrl: '' } },
  { id: 'footer', type: 'footer', label: 'Footer', enabled: true, config: {} },
];

const SectionCard = ({ section, index, total, onMoveUp, onMoveDown, onToggle, onRemove, onEdit, dragging, onDragStart, onDragOver, onDrop }) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      className={`group bg-white rounded-xl border-2 transition-all ${
        dragging ? 'border-[#4D9F82] shadow-lg scale-[1.02] opacity-80' : 'border-gray-200 hover:border-gray-300'
      } ${!section.enabled ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle */}
        <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
          </svg>
        </div>

        {/* Icon + label */}
        <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
          <SectionIcon type={section.type} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{section.label}</p>
          <p className="text-[10px] text-gray-400 uppercase font-medium">{section.type}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
            title="Monter"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
            title="Descendre"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(index)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Modifier"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

        {/* Toggle */}
        <button
          onClick={() => onToggle(index)}
          className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${section.enabled ? 'bg-[#0F6B4F]' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${section.enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>
    </div>
  );
};

const SectionEditor = ({ section, onSave, onClose }) => {
  const [config, setConfig] = useState(section.config || {});

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{section.icon}</span>
            <h3 className="text-sm font-bold text-gray-900">Modifier : {section.label}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          {Object.entries(config).map(([key, value]) => {
            if (Array.isArray(value)) return null; // skip arrays for now
            return (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-600 mb-1 block capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                {typeof value === 'number' ? (
                  <input type="number" value={value} onChange={(e) => updateConfig(key, parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent" />
                ) : (
                  <input type="text" value={value} onChange={(e) => updateConfig(key, e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent" />
                )}
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
            Annuler
          </button>
          <button
            onClick={() => { onSave({ ...section, config }); onClose(); }}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-[#0F6B4F] rounded-xl hover:bg-[#0A5740] transition"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

const BoutiquePages = () => {
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [editingIdx, setEditingIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/store/pages');
        if (res.data?.data?.sections?.length) {
          setSections(res.data.data.sections);
        }
      } catch { /* defaults */ }
    };
    load();
  }, []);

  const moveUp = (idx) => {
    if (idx === 0) return;
    setSections(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
    setSaved(false);
  };

  const moveDown = (idx) => {
    setSections(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
    setSaved(false);
  };

  const toggle = (idx) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s));
    setSaved(false);
  };

  const updateSection = (updated) => {
    setSections(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSaved(false);
  };

  // Drag & drop handlers
  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) return;
    setSections(prev => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, item);
      return next;
    });
    setDragIdx(null);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/store/pages', { sections });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => {
    const id = `custom-${Date.now()}`;
    setSections(prev => [
      ...prev,
      { id, type: 'custom', label: 'Nouvelle section', icon: '📝', enabled: false, config: { title: '', content: '' } }
    ]);
    setSaved(false);
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pages & Sections</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organisez les sections de votre page d'accueil</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition shadow-md ${
            saved ? 'bg-green-500' : 'bg-[#0F6B4F] hover:bg-[#0A5740]'
          } disabled:opacity-60`}
        >
          {saving ? 'Enregistrement...' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>

      {/* Info */}
      <div className="bg-[#E6F2ED] border border-[#96C7B5] rounded-2xl p-4 flex items-start gap-3">
        <svg className="w-4 h-4 text-[#0F6B4F] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-xs text-[#0A5740]">
          <strong>Glissez-déposez</strong> les sections pour réorganiser votre page d'accueil. 
          Activez/désactivez avec le toggle. Cliquez sur l'icône crayon pour modifier le contenu.
        </p>
      </div>

      {/* Sections list */}
      <div className="space-y-2">
        {sections.map((section, idx) => (
          <SectionCard
            key={section.id}
            section={section}
            index={idx}
            total={sections.length}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onToggle={toggle}
            onEdit={setEditingIdx}
            dragging={dragIdx === idx}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {/* Add section */}
      <button
        onClick={addSection}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-semibold text-gray-500 hover:border-[#4D9F82] hover:text-[#0F6B4F] hover:bg-[#E6F2ED] transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Ajouter une section
      </button>

      {/* Section editor modal */}
      {editingIdx !== null && sections[editingIdx] && (
        <SectionEditor
          section={sections[editingIdx]}
          onSave={updateSection}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  );
};

export default BoutiquePages;
