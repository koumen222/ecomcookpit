import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, Loader2, Check, Paintbrush, Eye, Palette, Type, Square, ChevronDown, ChevronUp,
  Droplets, Layout, Zap, MousePointer2, Rows3, Image, ShoppingBag, Star, Truck, Shield,
  MessageCircle, Heart, Share2, Minus, Plus, ChevronRight, Clock, Award, Flame
} from 'lucide-react';
import { storeManageApi } from '../services/storeApi';
import { useStore } from '../contexts/StoreContext.jsx';

// ── 5 Layout Themes ───────────────────────────────────────────────────────────
const THEMES = [
  { id: 'classic', name: 'Classique', desc: 'Galerie à gauche, infos à droite — le standard e-commerce.', badge: 'Par défaut', icon: '🛍️' },
  { id: 'landing', name: 'Landing Page', desc: 'Images pleine largeur, contenu de vente en dessous — conversions max.', badge: 'Conversions +', icon: '🚀' },
  { id: 'magazine', name: 'Magazine', desc: 'Image héro plein écran avec overlay — look éditorial premium.', badge: 'Premium', icon: '✨' },
  { id: 'minimal', name: 'Minimal', desc: 'Design épuré, beaucoup de blanc, focus sur le produit.', badge: 'Élégant', icon: '🤍' },
  { id: 'bold', name: 'Bold', desc: "Couleurs vives, typographie impactante, appels à l'action forts.", badge: 'Impact', icon: '⚡' },
];

// ── Theme Previews ────────────────────────────────────────────────────────────
const ClassicPreview = () => (
  <div className="p-2 bg-white rounded-xl">
    <div className="flex justify-between mb-2 pb-1.5 border-b border-gray-100">
      <div className="w-7 h-1.5 rounded bg-violet-500" />
      <div className="flex gap-1">{[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-gray-300" />)}</div>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      <div>
        <div className="pb-[75%] rounded bg-gradient-to-br from-gray-100 to-gray-50 relative">
          <div className="absolute inset-0 flex items-center justify-center"><Image size={14} className="text-gray-300" /></div>
        </div>
        <div className="flex gap-1 mt-1">{[1,2,3,4].map(i => <div key={i} className={`flex-1 pb-[100%] rounded ${i===1?'bg-violet-100 border border-violet-300':'bg-gray-100'}`} />)}</div>
      </div>
      <div className="py-0.5 space-y-1">
        <div className="w-[60%] h-1 rounded bg-violet-300/40" />
        <div className="w-[90%] h-1.5 rounded bg-gray-700/60" />
        <div className="w-[70%] h-1.5 rounded bg-gray-700/60" />
        <div className="w-[40%] h-1 rounded bg-gray-400/40 mt-2" />
        <div className="flex gap-1 items-center mt-2"><div className="w-8 h-2 rounded bg-violet-600" /><div className="w-5 h-1.5 rounded bg-gray-300" /></div>
        <div className="w-full h-4 rounded-md bg-violet-600 mt-2" />
      </div>
    </div>
  </div>
);

const LandingPreview = () => (
  <div className="p-2 bg-white rounded-xl">
    <div className="flex justify-between mb-2 pb-1.5 border-b border-gray-100">
      <div className="w-7 h-1.5 rounded bg-violet-500" />
      <div className="flex gap-1">{[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-gray-300" />)}</div>
    </div>
    <div className="pb-[35%] rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 relative mb-1.5">
      <div className="absolute inset-0 flex items-center justify-center"><Image size={16} className="text-violet-300" /></div>
    </div>
    <div className="text-center mb-2">
      <div className="w-[70%] h-2 rounded bg-gray-700/60 mx-auto mb-1" />
      <div className="w-[45%] h-1 rounded bg-gray-400/40 mx-auto mb-1.5" />
      <div className="w-10 h-2 rounded bg-violet-600 mx-auto" />
    </div>
    <div className="w-full h-4 rounded-full bg-violet-600 mb-2" />
    <div className="flex gap-1">{[1,2,3].map(i => <div key={i} className="flex-1 p-1.5 rounded bg-gray-50 text-center"><div className="w-2.5 h-2.5 rounded-full bg-violet-200 mx-auto mb-1" /><div className="w-[80%] h-1 rounded bg-gray-200 mx-auto" /></div>)}</div>
  </div>
);

const MagazinePreview = () => (
  <div className="p-2 bg-white rounded-xl">
    <div className="pb-[55%] rounded-xl bg-gradient-to-b from-gray-800 to-gray-900 relative mb-[-12px] overflow-hidden">
      <div className="absolute top-1.5 left-2 right-2 flex justify-between z-10">
        <div className="w-6 h-1 rounded bg-white/50" />
        <div className="flex gap-1">{[1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-white/40" />)}</div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center"><Image size={18} className="text-white/20" /></div>
      <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />
    </div>
    <div className="relative z-10 mx-1.5 bg-white rounded-lg p-2 shadow border border-gray-100">
      <div className="w-[80%] h-1.5 rounded bg-gray-800/70 mb-1" />
      <div className="w-[55%] h-1 rounded bg-gray-400/40 mb-1.5" />
      <div className="flex gap-1 items-center mb-2"><div className="w-8 h-2 rounded bg-violet-600" /><div className="w-5 h-1.5 rounded bg-gray-300" /></div>
      <div className="w-full h-4 rounded-md bg-violet-600" />
    </div>
  </div>
);

const MinimalPreview = () => (
  <div className="p-2 bg-white rounded-xl">
    <div className="flex justify-between mb-3 pb-1.5 border-b border-gray-50">
      <div className="w-7 h-1.5 rounded bg-gray-900" />
      <div className="flex gap-1">{[1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-gray-300" />)}</div>
    </div>
    <div className="pb-[50%] rounded-sm bg-gray-50 relative mb-3">
      <div className="absolute inset-0 flex items-center justify-center"><Image size={16} className="text-gray-200" /></div>
    </div>
    <div className="space-y-1.5 px-1">
      <div className="w-[50%] h-1 rounded bg-gray-300" />
      <div className="w-[85%] h-2 rounded bg-gray-900/70" />
      <div className="w-10 h-2 rounded bg-gray-900 mt-2" />
      <div className="w-full h-[1px] bg-gray-100 my-2" />
      <div className="w-full h-4 rounded-none bg-gray-900 border border-gray-900" />
    </div>
  </div>
);

const BoldPreview = () => (
  <div className="p-2 bg-violet-600 rounded-xl">
    <div className="flex justify-between mb-2 pb-1.5 border-b border-white/20">
      <div className="w-7 h-1.5 rounded bg-yellow-400" />
      <div className="flex gap-1">{[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-white/50" />)}</div>
    </div>
    <div className="pb-[40%] rounded-xl bg-white/10 relative mb-2 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center"><Flame size={16} className="text-yellow-400/60" /></div>
      <div className="absolute top-1 left-1"><div className="px-1.5 py-0.5 rounded-full bg-red-500 text-[5px] text-white font-bold">-50%</div></div>
    </div>
    <div className="space-y-1 px-0.5">
      <div className="w-[80%] h-2 rounded bg-white/90" />
      <div className="w-[60%] h-1 rounded bg-white/40" />
      <div className="flex gap-1 items-center mt-1"><div className="w-10 h-2.5 rounded bg-yellow-400" /><div className="w-6 h-1.5 rounded bg-white/30 line-through" /></div>
      <div className="w-full h-5 rounded-xl bg-yellow-400 mt-1" />
    </div>
  </div>
);

const PREVIEW_MAP = { classic: ClassicPreview, landing: LandingPreview, magazine: MagazinePreview, minimal: MinimalPreview, bold: BoldPreview };

// ── Color presets ─────────────────────────────────────────────────────────────
const COLOR_PRESETS = [
  { id: 'emerald',    name: 'Émeraude',  accent: '#0F6B4F', bg: '#ffffff', text: '#1F2937', badge: '#EF4444', cta: '#0F6B4F' },
  { id: 'coral',      name: 'Corail',     accent: '#D94A1F', bg: '#ffffff', text: '#1F2937', badge: '#EF4444', cta: '#D94A1F' },
  { id: 'ocean',      name: 'Océan',      accent: '#1565C0', bg: '#ffffff', text: '#1F2937', badge: '#E53935', cta: '#1565C0' },
  { id: 'rose',       name: 'Rose',       accent: '#C44569', bg: '#FFF5F5', text: '#3D1A2A', badge: '#E91E63', cta: '#C44569' },
  { id: 'gold',       name: 'Or Luxe',    accent: '#C9A84C', bg: '#FAF7F2', text: '#2D1F0E', badge: '#D4845A', cta: '#B8941E' },
  { id: 'nature',     name: 'Nature',     accent: '#2E7D32', bg: '#FFFDF9', text: '#0D2B14', badge: '#E65100', cta: '#2E7D32' },
  { id: 'dark',       name: 'Sombre',     accent: '#0066FF', bg: '#0A0F1E', text: '#FFFFFF', badge: '#FF4444', cta: '#0066FF' },
  { id: 'noir',       name: 'Noir',       accent: '#000000', bg: '#FFFFFF', text: '#000000', badge: '#EF4444', cta: '#000000' },
  { id: 'terracotta', name: 'Terra',      accent: '#C0622A', bg: '#F5F0E8', text: '#2D1A0E', badge: '#D4845A', cta: '#C0622A' },
  { id: 'violet',     name: 'Violet',     accent: '#7C3AED', bg: '#FFFFFF', text: '#1F2937', badge: '#EC4899', cta: '#7C3AED' },
  { id: 'sky',        name: 'Ciel',       accent: '#0EA5E9', bg: '#F0F9FF', text: '#0C4A6E', badge: '#F97316', cta: '#0284C7' },
  { id: 'wine',       name: 'Vin',        accent: '#881337', bg: '#FFF1F2', text: '#4C0519', badge: '#BE123C', cta: '#9F1239' },
  { id: 'forest',     name: 'Forêt',      accent: '#14532D', bg: '#F0FDF4', text: '#052E16', badge: '#DC2626', cta: '#166534' },
  { id: 'sunset',     name: 'Sunset',     accent: '#EA580C', bg: '#FFFBEB', text: '#431407', badge: '#DC2626', cta: '#C2410C' },
  { id: 'slate',      name: 'Slate',      accent: '#475569', bg: '#F8FAFC', text: '#0F172A', badge: '#6366F1', cta: '#334155' },
];

const FONT_OPTIONS = [
  { id: 'system',        name: 'Système',          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: 'inter',         name: 'Inter',            family: '"Inter", sans-serif' },
  { id: 'poppins',       name: 'Poppins',          family: '"Poppins", sans-serif' },
  { id: 'montserrat',    name: 'Montserrat',       family: '"Montserrat", sans-serif' },
  { id: 'nunito',        name: 'Nunito',           family: '"Nunito", sans-serif' },
  { id: 'roboto',        name: 'Roboto',           family: '"Roboto", sans-serif' },
  { id: 'playfair',      name: 'Playfair Display', family: '"Playfair Display", serif' },
  { id: 'lora',          name: 'Lora',             family: '"Lora", serif' },
  { id: 'dm-sans',       name: 'DM Sans',          family: '"DM Sans", sans-serif' },
  { id: 'satoshi',       name: 'Satoshi',          family: '"Satoshi", sans-serif' },
  { id: 'outfit',        name: 'Outfit',           family: '"Outfit", sans-serif' },
  { id: 'space-grotesk', name: 'Space Grotesk',    family: '"Space Grotesk", sans-serif' },
];

const BORDER_STYLES = [
  { id: 'rounded', name: 'Arrondi',  radius: '12px' },
  { id: 'pill',    name: 'Capsule',  radius: '999px' },
  { id: 'soft',    name: 'Doux',     radius: '8px' },
  { id: 'square',  name: 'Carré',    radius: '4px' },
  { id: 'none',    name: 'Aucun',    radius: '0px' },
];

const BUTTON_STYLES = [
  { id: 'filled',   name: 'Rempli',   desc: 'Bouton plein coloré' },
  { id: 'outline',  name: 'Contour',  desc: 'Bordure avec fond transparent' },
  { id: 'soft',     name: 'Doux',     desc: 'Fond semi-transparent' },
  { id: 'gradient', name: 'Dégradé',  desc: 'Dégradé moderne' },
];

const BADGE_STYLES = [
  { id: 'filled',  name: 'Rempli' },
  { id: 'outline', name: 'Contour' },
  { id: 'soft',    name: 'Doux' },
  { id: 'ribbon',  name: 'Ruban' },
];

const IMAGE_RATIOS = [
  { id: 'square',    name: 'Carré',    ratio: '1:1' },
  { id: 'portrait',  name: 'Portrait', ratio: '3:4' },
  { id: 'landscape', name: 'Paysage',  ratio: '4:3' },
  { id: 'wide',      name: 'Large',    ratio: '16:9' },
];

const SPACING_OPTIONS = [
  { id: 'compact', name: 'Compact', value: 'compact' },
  { id: 'normal',  name: 'Normal',  value: 'normal' },
  { id: 'relaxed', name: 'Spacieux', value: 'relaxed' },
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

// ── Toggle ────────────────────────────────────────────────────────────────────
const Toggle = ({ label, desc, value, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <span className="text-sm font-bold text-gray-900">{label}</span>
      {desc && <p className="text-[11px] text-gray-500">{desc}</p>}
    </div>
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-violet-600' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const DEFAULT_DESIGN = {
  buttonColor: '#D94A1F', ctaButtonColor: '#D94A1F', backgroundColor: '#ffffff', textColor: '#1F2937', badgeColor: '#EF4444',
  fontFamily: 'system', fontBase: 14, fontWeight: '600',
  borderRadius: '12px', shadow: true,
  buttonStyle: 'filled', badgeStyle: 'filled',
  imageRatio: 'square', spacing: 'normal',
  showReviews: true, showTrustBadges: true, showShareButtons: true,
  showRelatedProducts: true, showQuantitySelector: true,
  showDeliveryInfo: true, showSecureBadge: true,
  showCountdown: false, showStockIndicator: true,
  stickyAddToCart: true, imageZoom: true,
};

const ProductThemePage = () => {
  const [currentTheme, setCurrentTheme] = useState('classic');
  const [design, setDesign] = useState({ ...DEFAULT_DESIGN });
  const [originalData, setOriginalData] = useState({ theme: 'classic', design: { ...DEFAULT_DESIGN } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('layout');
  const [colorTab, setColorTab] = useState('presets');
  const { activeStore } = useStore();

  const storeSubdomain = activeStore?.subdomain || activeStore?.storeSettings?.subdomain || '';

  const SECTIONS = [
    { id: 'layout', label: 'Mise en page', icon: Layout },
    { id: 'colors', label: 'Couleurs', icon: Droplets },
    { id: 'typo', label: 'Typographie', icon: Type },
    { id: 'buttons', label: 'Boutons & Styles', icon: MousePointer2 },
    { id: 'elements', label: 'Éléments', icon: Rows3 },
    { id: 'preview', label: 'Aperçu', icon: Eye },
  ];

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

  const handleSelect = useCallback((themeId) => { setCurrentTheme(themeId); setSaved(false); }, []);
  const updateDesign = useCallback((key, value) => { setDesign(prev => ({ ...prev, [key]: value })); setSaved(false); }, []);
  const applyColorPreset = useCallback((preset) => {
    setDesign(prev => ({ ...prev, buttonColor: preset.accent, ctaButtonColor: preset.cta || preset.accent, backgroundColor: preset.bg, textColor: preset.text, badgeColor: preset.badge }));
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

  const fontFamily = FONT_OPTIONS.find(f => f.id === design.fontFamily)?.family || 'sans-serif';

  const renderButtonPreview = (style, color, radius) => {
    const base = 'px-5 py-2.5 text-sm font-bold transition';
    switch (style) {
      case 'outline': return <button className={base} style={{ border: `2px solid ${color}`, color, borderRadius: radius, background: 'transparent' }}>Commander</button>;
      case 'soft': return <button className={base} style={{ background: color + '18', color, borderRadius: radius }}>Commander</button>;
      case 'gradient': return <button className={`${base} text-white`} style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, borderRadius: radius }}>Commander</button>;
      default: return <button className={`${base} text-white`} style={{ background: color, borderRadius: radius }}>Commander</button>;
    }
  };

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
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">Thème Page Produit</h1>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Personnalisez l'apparence de vos pages produits</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {storeSubdomain && (
                <a href={`https://${storeSubdomain}.scalor.net`} target="_blank" rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition">
                  <Eye size={14} /> Voir ma boutique
                </a>
              )}
              <button onClick={handleSave} disabled={saving || !hasChanges}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  saved ? 'bg-green-500 shadow-green-200' : hasChanges ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-200' : 'bg-gray-400'
                }`}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
                {saving ? 'Sauvegarde…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const isActive = activeSection === s.id;
              return (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    isActive ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}>
                  <Icon size={14} /> {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ═══ LAYOUT ═══ */}
        {activeSection === 'layout' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 mb-1">Mise en page</h2>
              <p className="text-sm text-gray-500">Choisissez le layout de votre page produit</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {THEMES.map((theme) => {
                const isSelected = currentTheme === theme.id;
                const Preview = PREVIEW_MAP[theme.id];
                return (
                  <button key={theme.id} type="button" onClick={() => handleSelect(theme.id)}
                    className={`text-left rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                      isSelected ? 'border-violet-500 shadow-xl shadow-violet-100/60 ring-2 ring-violet-200 scale-[1.02]' : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
                    }`} style={{ background: '#fafafa' }}>
                    <div className="relative">
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center shadow-lg">
                          <Check size={14} color="#fff" strokeWidth={3} />
                        </div>
                      )}
                      <Preview />
                    </div>
                    <div className="px-3 pt-2 pb-2.5 bg-white border-t border-gray-100">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm">{theme.icon}</span>
                        <span className={`text-[12px] font-extrabold ${isSelected ? 'text-violet-700' : 'text-gray-800'}`}>{theme.name}</span>
                      </div>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>{theme.badge}</span>
                      <p className="text-[10px] text-gray-500 leading-snug mt-1">{theme.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Image & Spacing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Image size={15} className="text-violet-600" /> Ratio des images</h3>
                <div className="grid grid-cols-2 gap-2">
                  {IMAGE_RATIOS.map(r => (
                    <button key={r.id} onClick={() => updateDesign('imageRatio', r.id)}
                      className={`p-3 rounded-xl border-2 text-left transition ${design.imageRatio === r.id ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className="text-xs font-bold text-gray-800">{r.name}</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{r.ratio}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Rows3 size={15} className="text-violet-600" /> Espacement</h3>
                <div className="grid grid-cols-3 gap-2">
                  {SPACING_OPTIONS.map(s => (
                    <button key={s.id} onClick={() => updateDesign('spacing', s.value)}
                      className={`p-3 rounded-xl border-2 text-center transition ${design.spacing === s.value ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className="text-xs font-bold text-gray-800">{s.name}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <Toggle label="Zoom image" desc="Activer le zoom au survol des images" value={design.imageZoom} onChange={v => updateDesign('imageZoom', v)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ COLORS ═══ */}
        {activeSection === 'colors' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 mb-1">Palette de couleurs</h2>
              <p className="text-sm text-gray-500">Sélectionnez un preset ou personnalisez chaque couleur</p>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
              {[{ id: 'presets', label: 'Presets', icon: Palette }, { id: 'custom', label: 'Personnaliser', icon: Droplets }].map(t => {
                const Icon = t.icon;
                const isActive = colorTab === t.id;
                return (
                  <button key={t.id} onClick={() => setColorTab(t.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${isActive ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>

            {colorTab === 'presets' && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-5 gap-3">
                  {COLOR_PRESETS.map(p => {
                    const isActive = design.buttonColor === p.accent && design.backgroundColor === p.bg;
                    return (
                      <button key={p.id} type="button" onClick={() => applyColorPreset(p)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${isActive ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                        <div className={`w-10 h-10 rounded-full border-2 shrink-0 shadow-sm ${isActive ? 'border-violet-500 ring-2 ring-violet-200' : 'border-gray-200'}`}
                          style={{ background: `linear-gradient(135deg, ${p.accent} 50%, ${p.bg} 50%)` }} />
                        <div className="min-w-0">
                          <span className={`block text-xs font-bold truncate ${isActive ? 'text-violet-700' : 'text-gray-800'}`}>{p.name}</span>
                          <div className="flex gap-1 mt-1">
                            <div className="w-3 h-3 rounded-full border border-gray-200" style={{ background: p.accent }} />
                            <div className="w-3 h-3 rounded-full border border-gray-200" style={{ background: p.bg }} />
                            <div className="w-3 h-3 rounded-full border border-gray-200" style={{ background: p.badge }} />
                          </div>
                        </div>
                        {isActive && <Check size={14} className="text-violet-600 shrink-0 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {colorTab === 'custom' && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <ColorInput label="Bouton principal" value={design.buttonColor} onChange={v => updateDesign('buttonColor', v)} />
                  <ColorInput label="Bouton CTA" value={design.ctaButtonColor || design.buttonColor} onChange={v => updateDesign('ctaButtonColor', v)} />
                  <ColorInput label="Fond de page" value={design.backgroundColor} onChange={v => updateDesign('backgroundColor', v)} />
                  <ColorInput label="Texte principal" value={design.textColor} onChange={v => updateDesign('textColor', v)} />
                  <ColorInput label="Badge promo" value={design.badgeColor} onChange={v => updateDesign('badgeColor', v)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TYPO ═══ */}
        {activeSection === 'typo' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 mb-1">Typographie</h2>
              <p className="text-sm text-gray-500">Police, taille et poids du texte</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Police</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {FONT_OPTIONS.map(f => {
                  const isActive = design.fontFamily === f.id;
                  return (
                    <button key={f.id} type="button" onClick={() => updateDesign('fontFamily', f.id)}
                      className={`px-4 py-3 rounded-xl border-2 text-left transition ${
                        isActive ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}>
                      <span className="block text-base font-bold text-gray-900" style={{ fontFamily: f.family }}>{f.name}</span>
                      <span className="block text-[11px] text-gray-400 mt-0.5" style={{ fontFamily: f.family }}>Aperçu du texte 123</span>
                      {isActive && <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full"><Check size={9} /> Actif</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Taille de base</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="12" max="18" value={design.fontBase} onChange={e => updateDesign('fontBase', Number(e.target.value))}
                    className="flex-1 accent-violet-600 h-2" />
                  <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">{design.fontBase}px</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Affecte la taille du texte de base</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Poids des boutons</label>
                <select value={design.fontWeight} onChange={e => updateDesign('fontWeight', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 bg-white">
                  <option value="400">Normal (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semi-bold (600)</option>
                  <option value="700">Bold (700)</option>
                  <option value="800">Extra-bold (800)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BUTTONS & STYLES ═══ */}
        {activeSection === 'buttons' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 mb-1">Boutons & Styles</h2>
              <p className="text-sm text-gray-500">Forme, style et apparence des boutons et badges</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Style des boutons</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BUTTON_STYLES.map(b => {
                  const isActive = design.buttonStyle === b.id;
                  return (
                    <button key={b.id} onClick={() => updateDesign('buttonStyle', b.id)}
                      className={`p-4 rounded-xl border-2 transition ${isActive ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="mb-2">{renderButtonPreview(b.id, design.buttonColor, design.borderRadius)}</div>
                      <span className="text-xs font-bold text-gray-800">{b.name}</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{b.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Bordures</h3>
              <div className="flex flex-wrap gap-2">
                {BORDER_STYLES.map(b => {
                  const isActive = design.borderRadius === b.radius;
                  return (
                    <button key={b.id} type="button" onClick={() => updateDesign('borderRadius', b.radius)}
                      className={`flex items-center gap-2 px-4 py-2.5 border-2 transition ${
                        isActive ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`} style={{ borderRadius: b.radius }}>
                      <div className="w-7 h-7 bg-violet-200" style={{ borderRadius: b.radius }} />
                      <span className={`text-xs font-bold ${isActive ? 'text-violet-700' : 'text-gray-600'}`}>{b.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Style des badges promo</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BADGE_STYLES.map(b => {
                  const isActive = design.badgeStyle === b.id;
                  const bdg = (() => {
                    switch (b.id) {
                      case 'outline': return <span className="text-xs font-bold px-3 py-1" style={{ border: `2px solid ${design.badgeColor}`, color: design.badgeColor, borderRadius: design.borderRadius }}>-30%</span>;
                      case 'soft': return <span className="text-xs font-bold px-3 py-1" style={{ background: design.badgeColor + '20', color: design.badgeColor, borderRadius: design.borderRadius }}>-30%</span>;
                      case 'ribbon': return <span className="text-xs font-bold text-white px-3 py-1" style={{ background: design.badgeColor, borderRadius: '0 8px 8px 0' }}>-30%</span>;
                      default: return <span className="text-xs font-bold text-white px-3 py-1" style={{ background: design.badgeColor, borderRadius: design.borderRadius }}>-30%</span>;
                    }
                  })();
                  return (
                    <button key={b.id} onClick={() => updateDesign('badgeStyle', b.id)}
                      className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 ${isActive ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      {bdg}
                      <span className="text-xs font-bold text-gray-700">{b.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <Toggle label="Ombre portée" desc="Ajoute une ombre subtile aux boutons et éléments clés" value={design.shadow} onChange={v => updateDesign('shadow', v)} />
            </div>
          </div>
        )}

        {/* ═══ ELEMENTS ═══ */}
        {activeSection === 'elements' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 mb-1">Éléments de la page</h2>
              <p className="text-sm text-gray-500">Activez ou désactivez les sections de votre page produit</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><ShoppingBag size={14} /> Achat</h3>
                <Toggle label="Sélecteur de quantité" desc="Permet de choisir la quantité avant l'ajout" value={design.showQuantitySelector} onChange={v => updateDesign('showQuantitySelector', v)} />
                <Toggle label="Bouton ajout sticky" desc="Le bouton d'ajout reste visible en scrollant" value={design.stickyAddToCart} onChange={v => updateDesign('stickyAddToCart', v)} />
                <Toggle label="Indicateur de stock" desc="Affiche le stock restant pour créer l'urgence" value={design.showStockIndicator} onChange={v => updateDesign('showStockIndicator', v)} />
                <Toggle label="Compte à rebours" desc="Timer d'urgence pour les offres limitées" value={design.showCountdown} onChange={v => updateDesign('showCountdown', v)} />
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Shield size={14} /> Confiance</h3>
                <Toggle label="Badges de confiance" desc="Sécurité, garantie, retours" value={design.showTrustBadges} onChange={v => updateDesign('showTrustBadges', v)} />
                <Toggle label="Infos livraison" desc="Délai et coût de livraison estimés" value={design.showDeliveryInfo} onChange={v => updateDesign('showDeliveryInfo', v)} />
                <Toggle label="Badge paiement sécurisé" desc="Icône de cadenas + texte sécurisé" value={design.showSecureBadge} onChange={v => updateDesign('showSecureBadge', v)} />
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Star size={14} /> Social</h3>
                <Toggle label="Avis clients" desc="Section avis et notes sur la page" value={design.showReviews} onChange={v => updateDesign('showReviews', v)} />
                <Toggle label="Boutons partage" desc="Partager sur WhatsApp, Facebook, etc." value={design.showShareButtons} onChange={v => updateDesign('showShareButtons', v)} />
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Layout size={14} /> Contenu</h3>
                <Toggle label="Produits similaires" desc="Affiche des produits recommandés en bas" value={design.showRelatedProducts} onChange={v => updateDesign('showRelatedProducts', v)} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ PREVIEW ═══ */}
        {activeSection === 'preview' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 mb-1">Aperçu en direct</h2>
              <p className="text-sm text-gray-500">Visualisez le rendu de votre page produit</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Browser chrome */}
              <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
                <div className="flex gap-1.5">{['bg-red-400','bg-yellow-400','bg-green-400'].map(c => <div key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}</div>
                <div className="flex-1 mx-8 bg-white rounded-md px-3 py-1 text-[10px] text-gray-400 text-center border border-gray-200">
                  {storeSubdomain ? `${storeSubdomain}.scalor.net/produit/exemple` : 'votre-boutique.scalor.net/produit/exemple'}
                </div>
              </div>

              <div className="p-6 sm:p-8" style={{ backgroundColor: design.backgroundColor, fontFamily }}>
                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 mb-6 text-xs" style={{ color: design.textColor + '80' }}>
                  <span>Accueil</span><ChevronRight size={12} /><span>Produits</span><ChevronRight size={12} /><span style={{ color: design.buttonColor }}>Sneakers Premium</span>
                </div>

                <div className={`${currentTheme === 'classic' || currentTheme === 'minimal' ? 'grid grid-cols-1 sm:grid-cols-2 gap-8' : ''}`}>
                  {/* Image */}
                  <div>
                    <div className={`${currentTheme === 'magazine' ? 'pb-[60%]' : 'pb-[100%]'} rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden`}
                      style={{ borderRadius: design.borderRadius }}>
                      <div className="absolute inset-0 flex items-center justify-center"><Image size={48} className="text-gray-200" /></div>
                      <div className="absolute top-3 left-0">
                        <span className="text-xs font-bold text-white px-3 py-1" style={{ background: design.badgeColor, borderRadius: design.badgeStyle === 'ribbon' ? '0 8px 8px 0' : design.borderRadius }}>-30%</span>
                      </div>
                      {design.showStockIndicator && (
                        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full">
                          <Flame size={12} className="text-orange-500" />
                          <span className="text-[10px] font-bold text-orange-600">Plus que 3 en stock</span>
                        </div>
                      )}
                    </div>
                    {(currentTheme === 'classic' || currentTheme === 'minimal') && (
                      <div className="flex gap-2 mt-3">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="flex-1 pb-[100%] bg-gray-100"
                            style={{ borderRadius: design.borderRadius, ...(i===1 ? { border: `2px solid ${design.buttonColor}` } : {}) }} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className={currentTheme === 'landing' || currentTheme === 'bold' ? 'text-center mt-6' : ''}>
                    {design.showReviews && (
                      <div className="flex items-center gap-1 mb-2" style={currentTheme === 'landing' || currentTheme === 'bold' ? { justifyContent: 'center' } : {}}>
                        {[1,2,3,4,5].map(i => <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />)}
                        <span className="text-xs ml-1" style={{ color: design.textColor + '80' }}>(127 avis)</span>
                      </div>
                    )}
                    <h1 className="text-xl sm:text-2xl font-extrabold mb-2" style={{ color: design.textColor, fontSize: design.fontBase + 8 }}>
                      Sneakers Premium Édition Limitée
                    </h1>
                    <p className="text-sm mb-4" style={{ color: design.textColor + '99', fontSize: design.fontBase }}>
                      Confort ultime, design moderne et matériaux premium pour un style incomparable.
                    </p>
                    <div className="flex items-center gap-3 mb-5" style={currentTheme === 'landing' || currentTheme === 'bold' ? { justifyContent: 'center' } : {}}>
                      <span className="text-2xl font-extrabold" style={{ color: design.buttonColor }}>29 900 FCFA</span>
                      <span className="text-sm line-through" style={{ color: design.textColor + '50' }}>42 000 FCFA</span>
                    </div>

                    {design.showCountdown && (
                      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ background: design.badgeColor + '10', ...(currentTheme === 'landing' || currentTheme === 'bold' ? { display: 'inline-flex' } : {}) }}>
                        <Clock size={14} style={{ color: design.badgeColor }} />
                        <span className="text-xs font-bold" style={{ color: design.badgeColor }}>Offre expire dans 02:45:30</span>
                      </div>
                    )}

                    {design.showQuantitySelector && (
                      <div className="flex items-center gap-3 mb-5" style={currentTheme === 'landing' || currentTheme === 'bold' ? { justifyContent: 'center' } : {}}>
                        <span className="text-xs font-semibold" style={{ color: design.textColor }}>Quantité</span>
                        <div className="flex items-center border rounded-lg" style={{ borderRadius: design.borderRadius, borderColor: design.textColor + '20' }}>
                          <button className="px-2.5 py-1.5"><Minus size={14} style={{ color: design.textColor }} /></button>
                          <span className="px-3 text-sm font-bold" style={{ color: design.textColor }}>1</span>
                          <button className="px-2.5 py-1.5"><Plus size={14} style={{ color: design.textColor }} /></button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 mb-5">
                      {renderButtonPreview(design.buttonStyle, design.ctaButtonColor || design.buttonColor, design.borderRadius)}
                    </div>

                    {design.showShareButtons && (
                      <div className="flex items-center gap-3 mb-5" style={currentTheme === 'landing' || currentTheme === 'bold' ? { justifyContent: 'center' } : {}}>
                        <button className="p-2 rounded-lg border" style={{ borderColor: design.textColor + '15' }}><Heart size={16} style={{ color: design.textColor + '60' }} /></button>
                        <button className="p-2 rounded-lg border" style={{ borderColor: design.textColor + '15' }}><Share2 size={16} style={{ color: design.textColor + '60' }} /></button>
                        <button className="p-2 rounded-lg border" style={{ borderColor: design.textColor + '15' }}><MessageCircle size={16} style={{ color: design.textColor + '60' }} /></button>
                      </div>
                    )}

                    {design.showTrustBadges && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                          { icon: <Truck size={16} />, label: 'Livraison rapide' },
                          { icon: <Shield size={16} />, label: 'Paiement sécurisé' },
                          { icon: <Award size={16} />, label: 'Garantie qualité' },
                        ].map((t, i) => (
                          <div key={i} className="flex flex-col items-center gap-1 p-2 rounded-lg" style={{ background: design.buttonColor + '08' }}>
                            <span style={{ color: design.buttonColor }}>{t.icon}</span>
                            <span className="text-[10px] font-semibold text-center" style={{ color: design.textColor + '80' }}>{t.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {design.showDeliveryInfo && (
                      <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: design.textColor + '10', borderRadius: design.borderRadius }}>
                        <Truck size={16} style={{ color: design.buttonColor }} />
                        <div>
                          <span className="text-xs font-bold" style={{ color: design.textColor }}>Livraison estimée : 2-4 jours</span>
                          <span className="block text-[10px]" style={{ color: design.textColor + '60' }}>Livraison gratuite à partir de 25 000 FCFA</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sticky save bar */}
        {hasChanges && (
          <div className="fixed bottom-0 left-0 right-0 lg:left-[240px] z-30 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-2xl"
            style={{ animation: 'slideUp 0.3s ease-out' }}>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-sm font-semibold text-gray-700 truncate">Modifications non enregistrées</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setCurrentTheme(originalData.theme); setDesign({ ...originalData.design }); setSaved(false); }}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Annuler</button>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-violet-200">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
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
