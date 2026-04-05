import React, { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Check, Paintbrush, Eye } from 'lucide-react';
import { storeManageApi } from '../services/storeApi';
import { useStore } from '../contexts/StoreContext.jsx';

// ── Theme definitions ─────────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'classic',
    name: 'Classique',
    emoji: '🛍️',
    desc: 'Fond blanc, vert professionnel — polyvalent pour tout type de produit',
    tags: ['E-commerce', 'Polyvalent'],
    colors: { bg: '#ffffff', text: '#111827', text2: '#6b7280', primary: '#0F6B4F', accent: '#10b981', border: '#e5e7eb', card: '#f9fafb' },
  },
  {
    id: 'dark-tech',
    name: 'Tech Sombre',
    emoji: '⚡',
    desc: 'Fond noir profond, bleu électrique — idéal pour gadgets, électronique, gaming',
    tags: ['Tech', 'Gaming', 'Audio'],
    colors: { bg: '#0a0f1e', text: '#ffffff', text2: '#a0aec0', primary: '#0066ff', accent: '#3385ff', border: '#1e2a3a', card: '#111827' },
  },
  {
    id: 'luxury-gold',
    name: 'Luxe Doré',
    emoji: '👑',
    desc: 'Crème chaud avec accents or — parfait pour mode, bijoux, accessoires haut de gamme',
    tags: ['Mode', 'Bijoux', 'Premium'],
    colors: { bg: '#faf7f2', text: '#2d1f0e', text2: '#7a6a52', primary: '#c9a84c', accent: '#d4b46e', border: '#e8e0d0', card: '#f5f0e8' },
  },
  {
    id: 'nature',
    name: 'Nature & Beauté',
    emoji: '🌿',
    desc: 'Ivoire doux avec vert profond — cosmétique naturelle, soins, bien-être',
    tags: ['Cosmétique', 'Soins', 'Bio'],
    colors: { bg: '#fffdf9', text: '#0d2b14', text2: '#5a7a60', primary: '#1a5c2a', accent: '#2e7d32', border: '#d4e8d6', card: '#f0f7f1' },
  },
  {
    id: 'health-energy',
    name: 'Santé & Énergie',
    emoji: '💪',
    desc: 'Blanc frais avec émeraude — nutrition, compléments alimentaires, sport',
    tags: ['Santé', 'Nutrition', 'Sport'],
    colors: { bg: '#ffffff', text: '#1a2e1b', text2: '#5a7a5e', primary: '#2e7d32', accent: '#e65100', border: '#c8e6c9', card: '#f1f8e9' },
  },
  {
    id: 'warm-home',
    name: 'Maison Chaleureux',
    emoji: '🏠',
    desc: 'Beige chaud avec terracotta — décoration, cuisine, électroménager',
    tags: ['Maison', 'Cuisine', 'Déco'],
    colors: { bg: '#f5f0e8', text: '#2d1a0e', text2: '#7a6252', primary: '#c0622a', accent: '#d4845a', border: '#e0d0c0', card: '#faf5eb' },
  },
  {
    id: 'rose-beauty',
    name: 'Rose Premium',
    emoji: '💄',
    desc: 'Rose doux et rose gold — maquillage, parfum, beauté premium',
    tags: ['Maquillage', 'Parfum', 'Beauté'],
    colors: { bg: '#fff5f5', text: '#3d1a2a', text2: '#8b6b7a', primary: '#c44569', accent: '#e55d87', border: '#f0d0d8', card: '#fff0f2' },
  },
  {
    id: 'minimalist',
    name: 'Minimaliste',
    emoji: '◼️',
    desc: 'Noir et blanc épuré — élégant et intemporel pour tout produit',
    tags: ['Minimal', 'Élégant', 'Universel'],
    colors: { bg: '#ffffff', text: '#000000', text2: '#555555', primary: '#000000', accent: '#333333', border: '#e0e0e0', card: '#f5f5f5' },
  },
];

// ── Mini product page preview ─────────────────────────────────────────────────
const ThemePreview = ({ theme, selected, onClick }) => {
  const c = theme.colors;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left rounded-2xl border-2 transition-all duration-300 overflow-hidden w-full ${
        selected
          ? 'border-emerald-500 shadow-xl shadow-emerald-100/50 ring-2 ring-emerald-200'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
      }`}
    >
      {/* Preview mockup */}
      <div style={{ background: c.bg, padding: '14px 12px 12px', minHeight: 170, position: 'relative' }}>
        {/* Selected badge */}
        {selected && (
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 5,
            width: 24, height: 24, borderRadius: '50%',
            background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
          }}>
            <Check size={14} color="#fff" strokeWidth={3} />
          </div>
        )}

        {/* Mini navbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10, paddingBottom: 5, borderBottom: `1px solid ${c.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: c.primary, opacity: 0.8 }} />
            <div style={{ width: 32, height: 4, borderRadius: 2, background: c.text, opacity: 0.3 }} />
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.text2, opacity: 0.3 }} />
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.text2, opacity: 0.3 }} />
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.text2, opacity: 0.3 }} />
          </div>
        </div>

        {/* Product image placeholder */}
        <div style={{
          width: '100%', paddingBottom: '60%', borderRadius: 10, position: 'relative',
          background: `linear-gradient(135deg, ${c.card}, ${c.border})`,
          marginBottom: 10, overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
          }}>
            <span style={{ fontSize: 26, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>{theme.emoji}</span>
          </div>
        </div>

        {/* Title bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <div style={{ width: '65%', height: 6, borderRadius: 3, background: c.text, opacity: 0.7 }} />
        </div>
        <div style={{ width: '45%', height: 4, borderRadius: 2, background: c.text2, opacity: 0.4, marginBottom: 8 }} />

        {/* Price row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div style={{ width: 45, height: 8, borderRadius: 4, background: c.primary }} />
          <div style={{ width: 30, height: 5, borderRadius: 2, background: c.text2, opacity: 0.25 }} />
          <div style={{ width: 22, height: 10, borderRadius: 5, background: '#fee2e2', opacity: 0.8 }} />
        </div>

        {/* CTA button */}
        <div style={{
          width: '100%', height: 24, borderRadius: 8,
          background: c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 2px 8px ${c.primary}30`,
        }}>
          <div style={{ width: '35%', height: 4, borderRadius: 2, background: '#fff', opacity: 0.9 }} />
        </div>

        {/* Trust badges */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              flex: 1, height: 14, borderRadius: 7,
              border: `1px solid ${c.border}`, background: c.card,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '50%', height: 3, borderRadius: 2, background: c.text2, opacity: 0.3 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Theme info */}
      <div style={{ padding: '12px 14px 14px', background: '#fff', borderTop: '1px solid #f3f4f6' }}>
        <div className="flex items-center gap-2.5 mb-1.5">
          <span style={{ fontSize: 20 }}>{theme.emoji}</span>
          <div className="flex-1 min-w-0">
            <span className={`text-[14px] font-extrabold block leading-tight ${selected ? 'text-emerald-700' : 'text-gray-800'}`}>
              {theme.name}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed mb-2">{theme.desc}</p>
        <div className="flex flex-wrap gap-1">
          {theme.tags.map(tag => (
            <span key={tag} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
              selected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const ProductThemePage = () => {
  const [currentTheme, setCurrentTheme] = useState('classic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [originalTheme, setOriginalTheme] = useState('classic');
  const { activeStore } = useStore();

  const storeSubdomain = activeStore?.subdomain || activeStore?.storeSettings?.subdomain || '';

  // Load current theme from backend
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
      // Get current config first, then merge theme
      const res = await storeManageApi.getStoreConfig();
      const raw = res.data?.data || res.data || {};
      const existingConfig = raw.storeSettings?.productPageConfig || raw.productPageConfig || {};

      const themeData = THEMES.find(t => t.id === currentTheme);

      await storeManageApi.updateStoreConfig({
        productPageConfig: {
          ...existingConfig,
          theme: currentTheme,
          // Sync design colors with theme
          design: {
            ...existingConfig.design,
            buttonColor: themeData?.colors.primary || existingConfig.design?.buttonColor,
            backgroundColor: themeData?.colors.bg || existingConfig.design?.backgroundColor,
            textColor: themeData?.colors.text || existingConfig.design?.textColor,
          },
        },
      });

      setOriginalTheme(currentTheme);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save theme:', e);
      alert('Erreur lors de la sauvegarde du thème');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = currentTheme !== originalTheme;
  const activeTheme = THEMES.find(t => t.id === currentTheme);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-violet-500" />
          </div>
          <span className="text-sm font-medium text-gray-500">Chargement du thème…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                <Paintbrush size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight leading-tight">
                  Thème Page Produit
                </h1>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium">
                  Choisis le style visuel de tes pages produit
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {storeSubdomain && (
                <a
                  href={`https://${storeSubdomain}.scalor.net`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition"
                >
                  <Eye size={14} /> Voir ma boutique
                </a>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  saved
                    ? 'bg-green-500 shadow-green-200'
                    : hasChanges
                    ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-200 hover:shadow-lg'
                    : 'bg-gray-400'
                }`}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
                {saving ? 'Sauvegarde…' : saved ? 'Enregistré ✓' : hasChanges ? 'Enregistrer' : 'Aucun changement'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active theme banner */}
      {activeTheme && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
          <div
            className="rounded-2xl p-4 sm:p-5 border transition-all duration-500"
            style={{
              background: `linear-gradient(135deg, ${activeTheme.colors.card}, ${activeTheme.colors.bg})`,
              borderColor: activeTheme.colors.border,
            }}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-2xl sm:text-3xl shrink-0"
                style={{
                  background: activeTheme.colors.primary + '15',
                  border: `2px solid ${activeTheme.colors.primary}30`,
                }}
              >
                {activeTheme.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-base sm:text-lg font-extrabold" style={{ color: activeTheme.colors.text }}>
                    {activeTheme.name}
                  </span>
                  {!hasChanges && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                      Actif
                    </span>
                  )}
                  {hasChanges && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                      Non sauvegardé
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm" style={{ color: activeTheme.colors.text2 }}>{activeTheme.desc}</p>
              </div>
              {/* Color swatches */}
              <div className="hidden sm:flex items-center gap-1.5">
                {[activeTheme.colors.primary, activeTheme.colors.bg, activeTheme.colors.text, activeTheme.colors.border].map((color, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-lg border border-gray-200 shadow-sm"
                    style={{ background: color }}
                    title={['Primaire', 'Fond', 'Texte', 'Bordure'][i]}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {THEMES.map((theme) => (
            <ThemePreview
              key={theme.id}
              theme={theme}
              selected={currentTheme === theme.id}
              onClick={() => handleSelect(theme.id)}
            />
          ))}
        </div>
      </div>

      {/* Unsaved changes sticky bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-[240px] z-30 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-2xl"
          style={{ animation: 'slideUp 0.3s ease-out' }}>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="text-sm font-semibold text-gray-700 truncate">
                Thème modifié : <span className="text-violet-600">{activeTheme?.name}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCurrentTheme(originalTheme); setSaved(false); }}
                className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-violet-200"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductThemePage;
