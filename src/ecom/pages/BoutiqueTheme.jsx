import React, { useState, useEffect, useCallback } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useTheme } from '../contexts/ThemeContext';
import api from '../../lib/api';

// ── Template previews ────────────────────────────────────────────────────────
const TEMPLATE_ICONS = {
  classic: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
  ),
  premium: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  ),
  minimal: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" /></svg>
  ),
};

const TEMPLATES = [
  { id: 'classic', name: 'Classique', desc: 'Layout standard e-commerce, fiable et professionnel' },
  { id: 'premium', name: 'Premium', desc: 'Design haut-de-gamme avec grandes images et espacement' },
  { id: 'minimal', name: 'Minimal', desc: 'Design épuré, focalisé sur les produits' },
];

const FONTS = [
  { id: 'inter', name: 'Inter', family: 'Inter, sans-serif' },
  { id: 'poppins', name: 'Poppins', family: 'Poppins, sans-serif' },
  { id: 'dm-sans', name: 'DM Sans', family: '"DM Sans", sans-serif' },
  { id: 'montserrat', name: 'Montserrat', family: 'Montserrat, sans-serif' },
  { id: 'playfair', name: 'Playfair Display', family: '"Playfair Display", serif' },
  { id: 'space-grotesk', name: 'Space Grotesk', family: '"Space Grotesk", sans-serif' },
];

const RADIUS_OPTIONS = [
  { id: 'none', label: 'Aucun', value: '0' },
  { id: 'sm', label: 'Petit', value: '0.375rem' },
  { id: 'md', label: 'Moyen', value: '0.75rem' },
  { id: 'lg', label: 'Grand', value: '1rem' },
  { id: 'xl', label: 'Arrondi', value: '1.5rem' },
  { id: 'full', label: 'Pilule', value: '9999px' },
];

const SECTION_TOGGLES = [
  { key: 'showReviews', label: 'Avis clients', desc: 'Section témoignages et étoiles' },
  { key: 'showFaq', label: 'Section FAQ', desc: 'Questions fréquentes sur la page produit' },
  { key: 'showStockCounter', label: 'Compteur de stock', desc: 'Afficher le nombre de pièces restantes' },
  { key: 'showPromoBanner', label: 'Bannière promo', desc: 'Bandeau promotionnel en haut de page' },
  { key: 'showTrustBadges', label: 'Badges de confiance', desc: 'Livraison, retour, paiement sécurisé' },
  { key: 'showRelatedProducts', label: 'Produits similaires', desc: 'Recommandations en bas de page produit' },
  { key: 'showWhatsappButton', label: 'Bouton WhatsApp', desc: 'Commander via WhatsApp' },
  { key: 'showBenefits', label: 'Liste bénéfices', desc: 'Points forts du produit en vert' },
];

const ColorPicker = ({ label, value, onChange }) => (
  <div className="flex items-center gap-3">
    <div className="relative">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded-xl border-2 border-gray-200 cursor-pointer appearance-none"
        style={{ backgroundColor: value }}
      />
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs text-gray-500 font-mono bg-transparent border-none p-0 focus:ring-0 w-24"
      />
    </div>
  </div>
);

const Toggle = ({ checked, onChange, label, desc }) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#0F6B4F]' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  </div>
);

const BoutiqueTheme = () => {
  const { workspace } = useEcomAuth();
  const { theme, updateTheme: updateGlobalTheme, loading: themeLoading } = useTheme();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local theme state for real-time preview
  const [localTheme, setLocalTheme] = useState(theme);

  // Update local theme when global theme changes
  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  const updateTheme = useCallback((key, value) => {
    const newTheme = { ...localTheme, [key]: value };
    setLocalTheme(newTheme);
    // Update global theme immediately for real-time preview
    updateGlobalTheme(newTheme, false); // Don't persist yet
    setSaved(false);
  }, [localTheme, updateGlobalTheme]);

  const updateSection = useCallback((key, value) => {
    const newTheme = { ...localTheme, sections: { ...localTheme.sections, [key]: value } };
    setLocalTheme(newTheme);
    // Update global theme immediately for real-time preview
    updateGlobalTheme(newTheme, false); // Don't persist yet
    setSaved(false);
  }, [localTheme, updateGlobalTheme]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateGlobalTheme(localTheme, true); // Persist to backend
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Thème & Apparence</h1>
          <p className="text-sm text-gray-500 mt-0.5">Personnalisez le look de votre boutique</p>
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

      {/* ── 1. Template Selection ──────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Template</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => updateTheme('template', t.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                localTheme.template === t.id
                  ? 'border-[#0F6B4F] bg-[#E6F2ED] shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 mb-3">{TEMPLATE_ICONS[t.id]}</span>
              <p className="text-sm font-bold text-gray-900">{t.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
              {localTheme.template === t.id && (
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold text-[#0A5740] bg-[#C0DDD2] rounded-full">ACTIF</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── 2. Colors ─────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Couleurs</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ColorPicker label="Couleur principale" value={localTheme.primaryColor} onChange={(v) => updateTheme('primaryColor', v)} />
          <ColorPicker label="Couleur CTA" value={localTheme.ctaColor} onChange={(v) => updateTheme('ctaColor', v)} />
          <ColorPicker label="Fond" value={localTheme.backgroundColor} onChange={(v) => updateTheme('backgroundColor', v)} />
          <ColorPicker label="Texte" value={localTheme.textColor} onChange={(v) => updateTheme('textColor', v)} />
        </div>

        {/* Live preview bar */}
        <div className="mt-5 p-4 rounded-xl border border-gray-200" style={{ backgroundColor: localTheme.backgroundColor }}>
          <p className="text-sm font-bold mb-2" style={{ color: localTheme.textColor, fontFamily: FONTS.find(f => f.id === localTheme.font)?.family }}>
            Aperçu en temps réel
          </p>
          <p className="text-xs mb-3" style={{ color: localTheme.textColor + 'AA' }}>
            Voici à quoi ressemblera votre texte sur votre boutique.
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-xs font-bold text-white rounded-lg" style={{ backgroundColor: localTheme.primaryColor, borderRadius: RADIUS_OPTIONS.find(r => r.id === localTheme.borderRadius)?.value }}>
              Bouton principal
            </button>
            <button className="px-4 py-2 text-xs font-bold text-white rounded-lg" style={{ backgroundColor: localTheme.ctaColor, borderRadius: RADIUS_OPTIONS.find(r => r.id === localTheme.borderRadius)?.value }}>
              Acheter
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. Typography ─────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Typographie</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FONTS.map(f => (
            <button
              key={f.id}
              onClick={() => updateTheme('font', f.id)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                localTheme.font === f.id
                  ? 'border-[#0F6B4F] bg-[#E6F2ED]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-lg font-bold text-gray-900 mb-0.5" style={{ fontFamily: f.family }}>{f.name}</p>
              <p className="text-xs text-gray-500" style={{ fontFamily: f.family }}>Aa Bb Cc 123</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── 4. Border Radius ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Coins arrondis (Border Radius)</h2>
        <div className="flex flex-wrap gap-3">
          {RADIUS_OPTIONS.map(r => (
            <button
              key={r.id}
              onClick={() => updateTheme('borderRadius', r.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all min-w-[80px] ${
                localTheme.borderRadius === r.id
                  ? 'border-[#0F6B4F] bg-[#E6F2ED]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div
                className="w-12 h-8 bg-[#E6F2ED] border-2 border-[#0F6B4F]"
                style={{ borderRadius: r.value }}
              />
              <span className="text-xs font-medium text-gray-700">{r.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── 5. Sections Toggle ────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Sections de la boutique</h2>
        <p className="text-xs text-gray-500 mb-4">Activez ou désactivez les sections visibles sur votre boutique</p>
        <div className="divide-y divide-gray-100">
          {SECTION_TOGGLES.map(s => (
            <Toggle
              key={s.key}
              label={s.label}
              desc={s.desc}
              checked={localTheme.sections[s.key] ?? true}
              onChange={(v) => updateSection(s.key, v)}
            />
          ))}
        </div>
      </section>

    </div>
  );
};

export default BoutiqueTheme;
