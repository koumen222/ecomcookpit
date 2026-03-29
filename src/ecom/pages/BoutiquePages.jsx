import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { storeManageApi } from '../services/storeApi.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES DE SECTIONS SUPPORTÉES (même structure que PublicStorefront)
// ═══════════════════════════════════════════════════════════════════════════════
const SECTION_TYPES = {
  hero: { label: 'Hero / Bannière', icon: '🏠', color: 'bg-purple-100 text-purple-700' },
  badges: { label: 'Badges de confiance', icon: '✅', color: 'bg-blue-100 text-blue-700' },
  products: { label: 'Produits', icon: '🛍️', color: 'bg-green-100 text-green-700' },
  features: { label: 'Avantages', icon: '⭐', color: 'bg-yellow-100 text-yellow-700' },
  testimonials: { label: 'Témoignages', icon: '💬', color: 'bg-pink-100 text-pink-700' },
  faq: { label: 'FAQ', icon: '❓', color: 'bg-orange-100 text-orange-700' },
  contact: { label: 'Contact', icon: '📞', color: 'bg-teal-100 text-teal-700' },
  cta: { label: 'Appel à l\'action', icon: '🎯', color: 'bg-red-100 text-red-700' },
  custom: { label: 'Section personnalisée', icon: '✨', color: 'bg-gray-100 text-gray-700' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SectionCard = ({ section, index, total, onMove, onToggle, onEdit, onDelete }) => {
  const typeInfo = SECTION_TYPES[section.type] || SECTION_TYPES.custom;
  
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
          <p className="text-sm font-semibold text-gray-900">{section.config?.title || typeInfo.label}</p>
          <p className="text-[10px] text-gray-400 uppercase font-medium">{typeInfo.label}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
            title="Monter"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
            title="Descendre"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(section)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Modifier"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(section.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 transition"
            title="Supprimer"
          >
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
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

// ─── Section Editor Modal ────────────────────────────────────────────────────
const SectionEditor = ({ section, onSave, onClose }) => {
  const [config, setConfig] = useState(section?.config || {});
  const typeInfo = SECTION_TYPES[section?.type] || SECTION_TYPES.custom;

  const updateField = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    onSave({ ...section, config });
    onClose();
  };

  // Render fields based on section type
  const renderFields = () => {
    switch (section?.type) {
      case 'hero':
        return (
          <>
            <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} />
            <Field label="Sous-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} multiline />
            <Field label="Texte du bouton" value={config.ctaText} onChange={v => updateField('ctaText', v)} />
            <Field label="Lien du bouton" value={config.ctaLink} onChange={v => updateField('ctaLink', v)} />
          </>
        );
      case 'products':
        return (
          <>
            <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} />
            <Field label="Sous-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} />
            <Field label="Nombre de produits" type="number" value={config.limit || 6} onChange={v => updateField('limit', parseInt(v) || 6)} />
          </>
        );
      case 'features':
      case 'badges':
        return (
          <>
            <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} />
            <p className="text-xs text-gray-500 italic">Les éléments individuels peuvent être modifiés dans l'éditeur avancé.</p>
          </>
        );
      case 'testimonials':
        return (
          <>
            <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} />
            <p className="text-xs text-gray-500 italic">Les témoignages seront éditables dans une version future.</p>
          </>
        );
      case 'faq':
        return (
          <>
            <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} />
            <p className="text-xs text-gray-500 italic">Les questions/réponses seront éditables dans une version future.</p>
          </>
        );
      case 'contact':
        return (
          <>
            <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} />
            <Field label="Sous-titre" value={config.subtitle} onChange={v => updateField('subtitle', v)} />
            <Field label="WhatsApp" value={config.whatsapp} onChange={v => updateField('whatsapp', v)} />
          </>
        );
      default:
        return (
          <>
            <Field label="Titre" value={config.title} onChange={v => updateField('title', v)} />
            <Field label="Contenu" value={config.content} onChange={v => updateField('content', v)} multiline />
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
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
        <div className="p-5 space-y-4">
          {renderFields()}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
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

const Field = ({ label, value, onChange, multiline, type = 'text' }) => (
  <div>
    <label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</label>
    {multiline ? (
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        rows={3}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent resize-none"
      />
    ) : (
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
      />
    )}
  </div>
);

// ─── Add Section Modal ───────────────────────────────────────────────────────
const AddSectionModal = ({ onAdd, onClose }) => {
  const types = Object.entries(SECTION_TYPES).filter(([k]) => k !== 'custom');
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md">
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

  // Add section
  const handleAdd = useCallback((type) => {
    const id = `${type}-${Date.now()}`;
    const typeInfo = SECTION_TYPES[type];
    const newSection = {
      id,
      type,
      visible: true,
      config: { title: typeInfo.label },
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
