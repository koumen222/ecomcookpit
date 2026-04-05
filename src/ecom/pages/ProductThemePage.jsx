import React, { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Check, Paintbrush, Eye } from 'lucide-react';
import { storeManageApi } from '../services/storeApi';
import { useStore } from '../contexts/StoreContext.jsx';

// ── 3 Layout Themes ───────────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'classic',
    name: 'Classique',
    desc: 'Galerie à gauche, infos à droite — le standard e-commerce.',
    badge: 'Par défaut',
  },
  {
    id: 'landing',
    name: 'Landing Page',
    desc: 'Images pleine largeur en haut, contenu de vente en dessous — page de vente unique.',
    badge: 'Conversions +',
  },
  {
    id: 'magazine',
    name: 'Magazine',
    desc: 'Image héro plein écran avec infos en superposition — look éditorial premium.',
    badge: 'Premium',
  },
];

// ── Classique preview ─────────────────────────────────────────────────────────
const ClassicPreview = ({ selected }) => (
  <div style={{ padding: 12, background: '#fff', borderRadius: 12 }}>
    {/* Nav */}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #eee' }}>
      <div style={{ width: 30, height: 5, borderRadius: 3, background: '#0F6B4F' }} />
      <div style={{ display: 'flex', gap: 3 }}>
        {[1,2,3].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#ccc' }} />)}
      </div>
    </div>
    {/* 2-column layout */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {/* Left: gallery */}
      <div>
        <div style={{ paddingBottom: '100%', borderRadius: 8, background: 'linear-gradient(135deg, #f0f0f0, #e0e0e0)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        </div>
        {/* Thumbnails */}
        <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ flex: 1, paddingBottom: '100%', borderRadius: 4, background: i===1 ? '#d4e8d6' : '#f0f0f0', border: i===1 ? '1.5px solid #0F6B4F' : '1px solid #eee' }} />
          ))}
        </div>
      </div>
      {/* Right: info */}
      <div style={{ padding: '2px 0' }}>
        <div style={{ width: '60%', height: 4, borderRadius: 2, background: '#0F6B4F', opacity: 0.3, marginBottom: 5 }} />
        <div style={{ width: '90%', height: 6, borderRadius: 3, background: '#222', opacity: 0.7, marginBottom: 3 }} />
        <div style={{ width: '70%', height: 6, borderRadius: 3, background: '#222', opacity: 0.7, marginBottom: 6 }} />
        <div style={{ width: '40%', height: 4, borderRadius: 2, background: '#888', opacity: 0.5, marginBottom: 8 }} />
        {/* Price */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8 }}>
          <div style={{ width: 35, height: 7, borderRadius: 3, background: '#0F6B4F' }} />
          <div style={{ width: 22, height: 5, borderRadius: 2, background: '#ccc' }} />
        </div>
        {/* CTA */}
        <div style={{ width: '100%', height: 16, borderRadius: 6, background: '#0F6B4F' }}>
          <div style={{ width: '60%', height: 3, borderRadius: 2, background: '#fff', opacity: 0.8, margin: '0 auto', transform: 'translateY(6.5px)' }} />
        </div>
        {/* Benefits */}
        {[1,2,3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4e8d6', border: '1px solid #0F6B4F' }} />
            <div style={{ width: `${55 + i * 10}%`, height: 3, borderRadius: 2, background: '#ddd' }} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Landing Page preview ──────────────────────────────────────────────────────
const LandingPreview = ({ selected }) => (
  <div style={{ padding: 12, background: '#fff', borderRadius: 12 }}>
    {/* Nav */}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #eee' }}>
      <div style={{ width: 30, height: 5, borderRadius: 3, background: '#0F6B4F' }} />
      <div style={{ display: 'flex', gap: 3 }}>
        {[1,2,3].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#ccc' }} />)}
      </div>
    </div>
    {/* Full-width hero image */}
    <div style={{ width: '100%', paddingBottom: '50%', borderRadius: 10, background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)', position: 'relative', marginBottom: 8 }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F6B4F" strokeWidth="1.5" opacity="0.4">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    </div>
    {/* Title + price centered */}
    <div style={{ textAlign: 'center', marginBottom: 8 }}>
      <div style={{ width: '70%', height: 7, borderRadius: 3, background: '#222', opacity: 0.7, margin: '0 auto 4px' }} />
      <div style={{ width: '45%', height: 4, borderRadius: 2, background: '#888', opacity: 0.4, margin: '0 auto 6px' }} />
      <div style={{ width: 40, height: 8, borderRadius: 4, background: '#0F6B4F', margin: '0 auto' }} />
    </div>
    {/* Full-width CTA */}
    <div style={{ width: '100%', height: 18, borderRadius: 999, background: '#0F6B4F', marginBottom: 8 }}>
      <div style={{ width: '40%', height: 3, borderRadius: 2, background: '#fff', opacity: 0.8, margin: '0 auto', transform: 'translateY(7.5px)' }} />
    </div>
    {/* Content sections */}
    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ flex: 1, padding: '6px 4px', borderRadius: 6, background: '#f8f8f8', textAlign: 'center' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0F6B4F', opacity: 0.2, margin: '0 auto 3px' }} />
          <div style={{ width: '80%', height: 3, borderRadius: 2, background: '#ddd', margin: '0 auto' }} />
        </div>
      ))}
    </div>
    {/* Description block */}
    <div style={{ background: '#f8f8f8', borderRadius: 6, padding: 6 }}>
      {[1,2,3].map(i => <div key={i} style={{ width: `${70 + i * 8}%`, height: 3, borderRadius: 2, background: '#ddd', marginBottom: 3 }} />)}
    </div>
  </div>
);

// ── Magazine preview ──────────────────────────────────────────────────────────
const MagazinePreview = ({ selected }) => (
  <div style={{ padding: 12, background: '#fff', borderRadius: 12 }}>
    {/* Full-bleed hero */}
    <div style={{
      width: '100%', paddingBottom: '75%', borderRadius: 12,
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
      position: 'relative', marginBottom: -20, overflow: 'hidden',
    }}>
      {/* Nav overlay */}
      <div style={{ position: 'absolute', top: 6, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', zIndex: 2 }}>
        <div style={{ width: 24, height: 4, borderRadius: 2, background: '#fff', opacity: 0.7 }} />
        <div style={{ display: 'flex', gap: 3 }}>
          {[1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', opacity: 0.5 }} />)}
        </div>
      </div>
      {/* Center icon */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1" opacity="0.25">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
      {/* Gradient overlay */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }} />
    </div>
    {/* Floating info card */}
    <div style={{
      position: 'relative', zIndex: 2, margin: '0 6px',
      background: '#fff', borderRadius: 12, padding: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid #eee',
    }}>
      <div style={{ width: '80%', height: 6, borderRadius: 3, background: '#222', opacity: 0.8, marginBottom: 4 }} />
      <div style={{ width: '55%', height: 4, borderRadius: 2, background: '#888', opacity: 0.4, marginBottom: 6 }} />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ width: 35, height: 7, borderRadius: 3, background: '#0F6B4F' }} />
        <div style={{ width: 22, height: 5, borderRadius: 2, background: '#ccc' }} />
        <div style={{ width: 18, height: 8, borderRadius: 4, background: '#fee2e2' }} />
      </div>
      <div style={{ width: '100%', height: 16, borderRadius: 8, background: '#0F6B4F' }}>
        <div style={{ width: '50%', height: 3, borderRadius: 2, background: '#fff', opacity: 0.8, margin: '0 auto', transform: 'translateY(6.5px)' }} />
      </div>
    </div>
  </div>
);

const PREVIEW_MAP = { classic: ClassicPreview, landing: LandingPreview, magazine: MagazinePreview };

// ── Main Page ─────────────────────────────────────────────────────────────────
const ProductThemePage = () => {
  const [currentTheme, setCurrentTheme] = useState('classic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [originalTheme, setOriginalTheme] = useState('classic');
  const { activeStore } = useStore();

  const storeSubdomain = activeStore?.subdomain || activeStore?.storeSettings?.subdomain || '';

  useEffect(() => {
    (async () => {
      try {
        const res = await storeManageApi.getStoreConfig();
        const raw = res.data?.data || res.data || {};
        const config = raw.storeSettings?.productPageConfig || raw.productPageConfig || {};
        const saved = config.theme || 'classic';
        setCurrentTheme(saved);
        setOriginalTheme(saved);
      } catch (e) {
        console.error('Failed to load theme:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelect = useCallback((themeId) => {
    setCurrentTheme(themeId);
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await storeManageApi.getStoreConfig();
      const raw = res.data?.data || res.data || {};
      const existingConfig = raw.storeSettings?.productPageConfig || raw.productPageConfig || {};
      await storeManageApi.updateStoreConfig({
        productPageConfig: { ...existingConfig, theme: currentTheme },
      });
      setOriginalTheme(currentTheme);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save theme:', e);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = currentTheme !== originalTheme;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-violet-500" />
          </div>
          <span className="text-sm font-medium text-gray-500">Chargement…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                <Paintbrush size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
                  Thème Page Produit
                </h1>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium">
                  Choisis comment ta page produit s'affiche aux clients
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {storeSubdomain && (
                <a href={`https://${storeSubdomain}.scalor.net`} target="_blank" rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition">
                  <Eye size={14} /> Voir ma boutique
                </a>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  saved ? 'bg-green-500 shadow-green-200'
                    : hasChanges ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-200'
                    : 'bg-gray-400'
                }`}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
                {saving ? 'Sauvegarde…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Theme cards */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {THEMES.map((theme) => {
            const isSelected = currentTheme === theme.id;
            const Preview = PREVIEW_MAP[theme.id];
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelect(theme.id)}
                className={`text-left rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                  isSelected
                    ? 'border-violet-500 shadow-xl shadow-violet-100/60 ring-2 ring-violet-200 scale-[1.02]'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
                }`}
                style={{ background: '#fafafa' }}
              >
                {/* Preview */}
                <div className="relative">
                  {isSelected && (
                    <div className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-300">
                      <Check size={16} color="#fff" strokeWidth={3} />
                    </div>
                  )}
                  <Preview selected={isSelected} />
                </div>

                {/* Info */}
                <div className="px-4 pt-3 pb-4 bg-white border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[15px] font-extrabold ${isSelected ? 'text-violet-700' : 'text-gray-800'}`}>
                      {theme.name}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {theme.badge}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{theme.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sticky save bar when changes */}
        {hasChanges && (
          <div className="fixed bottom-0 left-0 right-0 lg:left-[240px] z-30 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-2xl"
            style={{ animation: 'slideUp 0.3s ease-out' }}>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-sm font-semibold text-gray-700 truncate">
                  Layout modifié : <span className="text-violet-600">{THEMES.find(t => t.id === currentTheme)?.name}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setCurrentTheme(originalTheme); setSaved(false); }}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-violet-200">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductThemePage;
