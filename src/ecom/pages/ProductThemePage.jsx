import React, { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Check, Paintbrush, Eye, Palette, Type, Square, ChevronDown, ChevronUp, Droplets } from 'lucide-react';
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
  <div style={{ padding: 8, background: '#fff', borderRadius: 12 }}>
    {/* Nav */}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #eee' }}>
      <div style={{ width: 30, height: 5, borderRadius: 3, background: '#0F6B4F' }} />
      <div style={{ display: 'flex', gap: 3 }}>
        {[1,2,3].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#ccc' }} />)}
      </div>
    </div>
    {/* 2-column layout */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {/* Left: gallery */}
      <div>
        <div style={{ paddingBottom: '75%', borderRadius: 6, background: 'linear-gradient(135deg, #f0f0f0, #e0e0e0)', position: 'relative' }}>
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
        {[1,2].map(i => (
          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#d4e8d6', border: '1px solid #0F6B4F' }} />
            <div style={{ width: `${55 + i * 10}%`, height: 2, borderRadius: 2, background: '#ddd' }} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Landing Page preview ──────────────────────────────────────────────────────
const LandingPreview = ({ selected }) => (
  <div style={{ padding: 8, background: '#fff', borderRadius: 12 }}>
    {/* Nav */}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #eee' }}>
      <div style={{ width: 30, height: 5, borderRadius: 3, background: '#0F6B4F' }} />
      <div style={{ display: 'flex', gap: 3 }}>
        {[1,2,3].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#ccc' }} />)}
      </div>
    </div>
    {/* Full-width hero image */}
    <div style={{ width: '100%', paddingBottom: '35%', borderRadius: 8, background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)', position: 'relative', marginBottom: 6 }}>
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
    <div style={{ background: '#f8f8f8', borderRadius: 6, padding: 5 }}>
      {[1,2].map(i => <div key={i} style={{ width: `${70 + i * 8}%`, height: 2, borderRadius: 2, background: '#ddd', marginBottom: 2 }} />)}
    </div>
  </div>
);

// ── Magazine preview ──────────────────────────────────────────────────────────
const MagazinePreview = ({ selected }) => (
  <div style={{ padding: 8, background: '#fff', borderRadius: 12 }}>
    {/* Full-bleed hero */}
    <div style={{
      width: '100%', paddingBottom: '55%', borderRadius: 12,
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
      position: 'relative', marginBottom: -16, overflow: 'hidden',
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
      background: '#fff', borderRadius: 10, padding: 8,
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

// ── Color presets ─────────────────────────────────────────────────────────────
const COLOR_PRESETS = [
  { id: 'emerald',  name: 'Émeraude',     accent: '#0F6B4F', bg: '#ffffff', text: '#1F2937', badge: '#EF4444' },
  { id: 'coral',    name: 'Corail',        accent: '#D94A1F', bg: '#ffffff', text: '#1F2937', badge: '#EF4444' },
  { id: 'ocean',    name: 'Océan',         accent: '#1565C0', bg: '#ffffff', text: '#1F2937', badge: '#E53935' },
  { id: 'rose',     name: 'Rose Premium',  accent: '#C44569', bg: '#FFF5F5', text: '#3D1A2A', badge: '#E91E63' },
  { id: 'gold',     name: 'Or Luxe',       accent: '#C9A84C', bg: '#FAF7F2', text: '#2D1F0E', badge: '#D4845A' },
  { id: 'nature',   name: 'Nature',        accent: '#2E7D32', bg: '#FFFDF9', text: '#0D2B14', badge: '#E65100' },
  { id: 'dark',     name: 'Tech Sombre',   accent: '#0066FF', bg: '#0A0F1E', text: '#FFFFFF', badge: '#FF4444' },
  { id: 'noir',     name: 'Noir Élégant',  accent: '#000000', bg: '#FFFFFF', text: '#000000', badge: '#EF4444' },
  { id: 'terracotta',name:'Terracotta',    accent: '#C0622A', bg: '#F5F0E8', text: '#2D1A0E', badge: '#D4845A' },
  { id: 'violet',   name: 'Violet Pro',    accent: '#7C3AED', bg: '#FFFFFF', text: '#1F2937', badge: '#EC4899' },
];

const FONT_OPTIONS = [
  { id: 'system',      name: 'Système (défaut)',  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: 'inter',       name: 'Inter',             family: '"Inter", sans-serif' },
  { id: 'poppins',     name: 'Poppins',           family: '"Poppins", sans-serif' },
  { id: 'montserrat',  name: 'Montserrat',        family: '"Montserrat", sans-serif' },
  { id: 'nunito',      name: 'Nunito',            family: '"Nunito", sans-serif' },
  { id: 'roboto',      name: 'Roboto',            family: '"Roboto", sans-serif' },
  { id: 'playfair',    name: 'Playfair Display',  family: '"Playfair Display", serif' },
  { id: 'lora',        name: 'Lora',              family: '"Lora", serif' },
];

const BORDER_STYLES = [
  { id: 'rounded',  name: 'Arrondi',   radius: '12px' },
  { id: 'pill',     name: 'Capsule',    radius: '999px' },
  { id: 'soft',     name: 'Doux',       radius: '8px' },
  { id: 'square',   name: 'Carré',      radius: '4px' },
  { id: 'none',     name: 'Aucun',      radius: '0px' },
];

// ── Color input ───────────────────────────────────────────────────────────────
const ColorInput = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>
    <div className="flex items-center gap-2">
      <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
        className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer appearance-none bg-transparent p-0.5" />
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200" />
    </div>
  </div>
);

// ── Collapsible section ───────────────────────────────────────────────────────
const DesignSection = ({ icon: Icon, title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition">
        <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
          <Icon size={16} className="text-violet-600" />
        </div>
        <span className="flex-1 text-sm font-bold text-gray-900">{title}</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const DEFAULT_DESIGN = {
  buttonColor: '#D94A1F', backgroundColor: '#ffffff', textColor: '#1F2937', badgeColor: '#EF4444',
  fontFamily: 'system', fontBase: 14, fontWeight: '600',
  borderRadius: '12px', shadow: true,
};

const ProductThemePage = () => {
  const [currentTheme, setCurrentTheme] = useState('classic');
  const [design, setDesign] = useState({ ...DEFAULT_DESIGN });
  const [originalData, setOriginalData] = useState({ theme: 'classic', design: { ...DEFAULT_DESIGN } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { activeStore } = useStore();

  const storeSubdomain = activeStore?.subdomain || activeStore?.storeSettings?.subdomain || '';

  useEffect(() => {
    (async () => {
      try {
        const res = await storeManageApi.getStoreConfig();
        const raw = res.data?.data || res.data || {};
        const config = raw.storeSettings?.productPageConfig || raw.productPageConfig || {};
        const savedTheme = config.theme || 'classic';
        const savedDesign = { ...DEFAULT_DESIGN, ...(config.design || {}) };
        setCurrentTheme(savedTheme);
        setDesign(savedDesign);
        setOriginalData({ theme: savedTheme, design: { ...savedDesign } });
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

  const updateDesign = useCallback((key, value) => {
    setDesign(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const applyColorPreset = useCallback((preset) => {
    setDesign(prev => ({ ...prev, buttonColor: preset.accent, backgroundColor: preset.bg, textColor: preset.text, badgeColor: preset.badge }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await storeManageApi.getStoreConfig();
      const raw = res.data?.data || res.data || {};
      const existingConfig = raw.storeSettings?.productPageConfig || raw.productPageConfig || {};
      await storeManageApi.updateStoreConfig({
        productPageConfig: { ...existingConfig, theme: currentTheme, design: { ...existingConfig.design, ...design } },
      });
      setOriginalData({ theme: currentTheme, design: { ...design } });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save theme:', e);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = currentTheme !== originalData.theme || JSON.stringify(design) !== JSON.stringify(originalData.design);

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
                <div className="px-3 pt-2 pb-2.5 bg-white border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[13px] font-extrabold ${isSelected ? 'text-violet-700' : 'text-gray-800'}`}>
                      {theme.name}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {theme.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-snug">{theme.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Design Customization ─────────────────────────────────────────── */}
        <div className="mt-10 space-y-4">
          <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <Palette size={18} className="text-violet-600" /> Design & Personnalisation
          </h2>

          {/* Color Presets */}
          <DesignSection icon={Droplets} title="Palette de couleurs" defaultOpen={true}>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-3 mb-5">
              {COLOR_PRESETS.map(p => {
                const isActive = design.buttonColor === p.accent && design.backgroundColor === p.bg;
                return (
                  <button key={p.id} type="button" onClick={() => applyColorPreset(p)}
                    className={`group flex flex-col items-center gap-1.5 transition ${isActive ? 'scale-110' : 'hover:scale-105'}`}>
                    <div className={`w-9 h-9 rounded-full border-2 transition shadow-sm ${isActive ? 'border-violet-500 ring-2 ring-violet-200' : 'border-gray-200 group-hover:border-gray-300'}`}
                      style={{ background: `linear-gradient(135deg, ${p.accent} 50%, ${p.bg} 50%)` }} />
                    <span className={`text-[9px] font-semibold ${isActive ? 'text-violet-600' : 'text-gray-500'}`}>{p.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <ColorInput label="Bouton / Accent" value={design.buttonColor} onChange={v => updateDesign('buttonColor', v)} />
              <ColorInput label="Fond de page" value={design.backgroundColor} onChange={v => updateDesign('backgroundColor', v)} />
              <ColorInput label="Texte principal" value={design.textColor} onChange={v => updateDesign('textColor', v)} />
              <ColorInput label="Badge promo" value={design.badgeColor} onChange={v => updateDesign('badgeColor', v)} />
            </div>
          </DesignSection>

          {/* Font */}
          <DesignSection icon={Type} title="Typographie">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Police</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FONT_OPTIONS.map(f => {
                    const isActive = design.fontFamily === f.id;
                    return (
                      <button key={f.id} type="button" onClick={() => updateDesign('fontFamily', f.id)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-left transition ${
                          isActive ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                        <span className="block text-sm font-bold" style={{ fontFamily: f.family }}>{f.name}</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: f.family }}>Aperçu texte</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Taille de base</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="12" max="18" value={design.fontBase} onChange={e => updateDesign('fontBase', Number(e.target.value))}
                      className="flex-1 accent-violet-600" />
                    <span className="text-xs font-bold text-gray-700 w-8 text-right">{design.fontBase}px</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Poids bouton</label>
                  <select value={design.fontWeight} onChange={e => updateDesign('fontWeight', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 bg-white">
                    <option value="400">Normal (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semi-bold (600)</option>
                    <option value="700">Bold (700)</option>
                    <option value="800">Extra-bold (800)</option>
                  </select>
                </div>
              </div>
            </div>
          </DesignSection>

          {/* Borders & Shadow */}
          <DesignSection icon={Square} title="Bordures & Ombres">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Style des bordures</label>
                <div className="flex flex-wrap gap-2">
                  {BORDER_STYLES.map(b => {
                    const isActive = design.borderRadius === b.radius;
                    return (
                      <button key={b.id} type="button" onClick={() => updateDesign('borderRadius', b.radius)}
                        className={`flex items-center gap-2 px-4 py-2.5 border-2 transition ${
                          isActive ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                        style={{ borderRadius: b.radius }}>
                        <div className="w-6 h-6 bg-violet-200" style={{ borderRadius: b.radius }} />
                        <span className={`text-xs font-bold ${isActive ? 'text-violet-700' : 'text-gray-600'}`}>{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="text-sm font-bold text-gray-900">Ombre portée</span>
                  <p className="text-[11px] text-gray-500">Ajoute une ombre subtile aux éléments clés</p>
                </div>
                <button type="button" onClick={() => updateDesign('shadow', !design.shadow)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${design.shadow ? 'bg-violet-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${design.shadow ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </DesignSection>

          {/* Live Preview */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Aperçu en direct</h3>
            <div className="rounded-xl border border-gray-100 p-6" style={{ backgroundColor: design.backgroundColor, fontFamily: FONT_OPTIONS.find(f => f.id === design.fontFamily)?.family }}>
              <h4 className="text-lg font-bold mb-1" style={{ color: design.textColor, fontSize: design.fontBase + 4 }}>Nom du produit</h4>
              <p className="text-sm mb-3" style={{ color: design.textColor, opacity: 0.6, fontSize: design.fontBase }}>Description courte de votre produit</p>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl font-extrabold" style={{ color: design.buttonColor }}>19 900 FCFA</span>
                <span className="text-xs text-white px-2 py-0.5 font-bold" style={{ backgroundColor: design.badgeColor, borderRadius: design.borderRadius }}> -30%</span>
              </div>
              <button className="px-6 py-3 text-white text-sm transition" style={{
                backgroundColor: design.buttonColor,
                borderRadius: design.borderRadius,
                fontWeight: design.fontWeight,
                boxShadow: design.shadow ? '0 4px 14px rgba(0,0,0,0.15)' : 'none',
              }}>
                Commander maintenant
              </button>
            </div>
          </div>
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
                  Modifications non enregistrées
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setCurrentTheme(originalData.theme); setDesign({ ...originalData.design }); setSaved(false); }}
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
