/**
 * BoutiqueSettings — Unique page de configuration de la boutique.
 * Radical & minimal : nom, logo, 4 couleurs, 1 police, description. C'est tout.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import api from '../../lib/api';
import { ExternalLink, Check, Upload, Palette, Type, Store } from 'lucide-react';

const FONTS = [
  { id: 'inter',      name: 'Inter',      sample: 'Modern & Clean' },
  { id: 'poppins',    name: 'Poppins',    sample: 'Friendly & Bold' },
  { id: 'dm-sans',    name: 'DM Sans',    sample: 'Neutral & Sharp' },
  { id: 'montserrat', name: 'Montserrat', sample: 'Strong & Elegant' },
  { id: 'satoshi',    name: 'Satoshi',    sample: 'Future & Luxury' },
];

const FONT_FAMILIES = {
  inter:      'Inter, system-ui, sans-serif',
  poppins:    'Poppins, sans-serif',
  'dm-sans':  '"DM Sans", sans-serif',
  montserrat: 'Montserrat, sans-serif',
  satoshi:    '"Satoshi", Inter, system-ui, sans-serif',
};

const CURRENCIES = ['XAF', 'XOF', 'USD', 'EUR', 'GHS', 'NGN', 'MAD'];

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

// ── Section wrapper ──────────────────────────────────────────────────────────
const Section = ({ icon, title, desc, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
    <div className="flex items-start gap-3 mb-5">
      <span className="w-9 h-9 rounded-xl bg-[#E6F2ED] flex items-center justify-center text-[#0F6B4F] flex-shrink-0">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
    </div>
    {children}
  </div>
);

// ── Label + Input helper ─────────────────────────────────────────────────────
const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
  </div>
);

// ── Logo uploader ────────────────────────────────────────────────────────────
const LogoUploader = ({ value, onChange }) => {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = res.data?.data?.url || res.data?.url;
      if (url) { onChange(url); return; }
    } catch (_) {}
    // Fallback: data URL
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target.result);
    reader.readAsDataURL(file);
    setUploading(false);
  };

  return (
    <div className="flex items-center gap-5">
      <div
        onClick={() => ref.current?.click()}
        className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-[#4D9F82] transition overflow-hidden flex-shrink-0 bg-gray-50"
      >
        {uploading ? (
          <div className="w-5 h-5 border-2 border-[#0F6B4F] border-t-transparent rounded-full animate-spin" />
        ) : value ? (
          <img src={value} alt="Logo" className="w-full h-full object-contain p-1" />
        ) : (
          <Upload size={22} className="text-gray-300" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="px-4 py-2 text-xs font-bold text-[#0A5740] bg-[#E6F2ED] rounded-xl hover:bg-[#C0DDD2] transition"
        >
          {value ? 'Changer le logo' : 'Uploader un logo'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition"
          >
            Supprimer
          </button>
        )}
        <p className="text-[11px] text-gray-400">PNG, SVG ou WEBP recommandé</p>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
};

// ── Color picker row ─────────────────────────────────────────────────────────
const ColorPicker = ({ label, value, onChange }) => (
  <div className="flex items-center gap-3">
    <div className="relative flex-shrink-0">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded-xl cursor-pointer border-2 border-gray-200 p-0.5 bg-white"
      />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs font-mono text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 w-24 focus:ring-1 focus:ring-[#0F6B4F] focus:border-[#0F6B4F] outline-none"
      />
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const BoutiqueSettings = () => {
  const { workspace } = useEcomAuth();

  const [form, setForm] = useState({
    storeName: '',
    storeDescription: '',
    storeLogo: '',
    storePhone: '',
    storeWhatsApp: '',
    storeCurrency: 'XAF',
    isStoreEnabled: true,
    primaryColor: '#0F6B4F',
    accentColor: '#059669',
    backgroundColor: '#FFFFFF',
    textColor: '#111827',
    font: 'inter',
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subdomain, setSubdomain] = useState('');

  // Load existing settings on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, domainsRes] = await Promise.all([
          api.get('/store/settings'),
          api.get('/store/domains').catch(() => ({ data: {} })),
        ]);
        const s = settingsRes.data?.data || {};
        setForm(prev => ({
          ...prev,
          storeName:       s.storeName       || workspace?.name || '',
          storeDescription: s.storeDescription || '',
          storeLogo:       s.storeLogo        || '',
          storePhone:      s.storePhone       || '',
          storeWhatsApp:   s.storeWhatsApp    || '',
          storeCurrency:   s.storeCurrency    || 'XAF',
          isStoreEnabled:  s.isStoreEnabled   ?? true,
          primaryColor:    s.primaryColor     || s.storeThemeColor || '#0F6B4F',
          accentColor:     s.accentColor      || '#059669',
          backgroundColor: s.backgroundColor  || '#FFFFFF',
          textColor:       s.textColor        || '#111827',
          font:            s.font             || 'inter',
        }));
        setSubdomain(domainsRes.data?.data?.subdomain || '');
      } catch (err) {
        console.error('BoutiqueSettings load error:', err);
      }
    };
    load();
  }, [workspace]);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/store/settings', {
        ...form,
        storeThemeColor: form.primaryColor,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = subdomain
    ? (window.location.hostname === 'localhost'
        ? `/store/${subdomain}`
        : `https://${subdomain}.scalor.net`)
    : null;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ma Boutique</h1>
          <p className="text-sm text-gray-500 mt-0.5">Nom, logo, couleurs et police — c'est tout.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition"
            >
              <ExternalLink size={14} /> Voir la boutique
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition disabled:opacity-60 flex items-center gap-2 ${saved ? 'bg-green-500' : 'bg-[#0F6B4F] hover:bg-[#0A5740]'}`}
          >
            {saved ? (<><Check size={15} /> Sauvegardé</>) : saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* ── 1. Informations boutique ────────────────────────────────────── */}
      <Section
        icon={<Store size={18} />}
        title="Informations"
        desc="Le nom et la description que vos clients voient"
      >
        <div className="space-y-4">
          <Field label="Nom de la boutique *">
            <input
              type="text"
              value={form.storeName}
              onChange={(e) => set('storeName', e.target.value)}
              placeholder="Ma Super Boutique"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none transition"
            />
          </Field>

          <Field label="Description courte" hint="Affichée dans le hero de votre homepage et dans les métadonnées SEO">
            <textarea
              rows={3}
              value={form.storeDescription}
              onChange={(e) => set('storeDescription', e.target.value)}
              placeholder="Découvrez notre sélection de produits soigneusement choisis…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none resize-none transition"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Téléphone">
              <input
                type="tel"
                value={form.storePhone}
                onChange={(e) => set('storePhone', e.target.value)}
                placeholder="+237 6XX XXX XXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none transition"
              />
            </Field>
            <Field label="WhatsApp" hint="Activer le bouton 'Commander via WhatsApp'">
              <input
                type="tel"
                value={form.storeWhatsApp}
                onChange={(e) => set('storeWhatsApp', e.target.value)}
                placeholder="237600000000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none transition"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Devise">
              <select
                value={form.storeCurrency}
                onChange={(e) => set('storeCurrency', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none transition bg-white"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Boutique active">
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => set('isStoreEnabled', !form.isStoreEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.isStoreEnabled ? 'bg-[#0F6B4F]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isStoreEnabled ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm text-gray-600">{form.isStoreEnabled ? 'En ligne' : 'Hors ligne'}</span>
              </div>
            </Field>
          </div>
        </div>
      </Section>

      {/* ── 2. Logo ─────────────────────────────────────────────────────── */}
      <Section
        icon={<Upload size={18} />}
        title="Logo"
        desc="Affiché en header sur toutes les pages de votre boutique"
      >
        <LogoUploader value={form.storeLogo} onChange={(v) => set('storeLogo', v)} />
      </Section>

      {/* ── 3. Couleurs ─────────────────────────────────────────────────── */}
      <Section
        icon={<Palette size={18} />}
        title="Couleurs"
        desc="4 couleurs, injectées automatiquement partout dans votre boutique"
      >
        <div className="grid grid-cols-2 gap-5 mb-6">
          <ColorPicker label="Couleur principale" value={form.primaryColor} onChange={(v) => set('primaryColor', v)} />
          <ColorPicker label="Couleur accent" value={form.accentColor} onChange={(v) => set('accentColor', v)} />
          <ColorPicker label="Fond de page" value={form.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <ColorPicker label="Couleur du texte" value={form.textColor} onChange={(v) => set('textColor', v)} />
        </div>

        {/* Live preview */}
        <div
          className="rounded-2xl border border-gray-100 p-5 overflow-hidden"
          style={{ backgroundColor: form.backgroundColor, fontFamily: FONT_FAMILIES[form.font] }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: form.primaryColor }}>
            Aperçu
          </p>
          <p className="text-lg font-bold mb-1" style={{ color: form.textColor }}>
            {form.storeName || 'Nom de la boutique'}
          </p>
          <p className="text-sm mb-4" style={{ color: form.textColor + '99' }}>
            {form.storeDescription || 'La description de votre boutique apparaît ici.'}
          </p>
          <div className="flex gap-3 flex-wrap">
            <span className="px-5 py-2.5 rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: form.primaryColor }}>
              Voir les produits
            </span>
            <span className="px-5 py-2.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: form.accentColor + '18', color: form.accentColor }}>
              {fmt(15000, form.storeCurrency)}
            </span>
          </div>
        </div>
      </Section>

      {/* ── 4. Police ───────────────────────────────────────────────────── */}
      <Section
        icon={<Type size={18} />}
        title="Police"
        desc="Appliquée à l'ensemble de votre boutique"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FONTS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => set('font', f.id)}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                form.font === f.id
                  ? 'border-[#0F6B4F] bg-[#E6F2ED] shadow-sm'
                  : 'border-gray-100 hover:border-gray-200 bg-white'
              }`}
            >
              <p className="text-xl font-bold text-gray-900 leading-tight" style={{ fontFamily: FONT_FAMILIES[f.id] }}>
                {f.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: FONT_FAMILIES[f.id] }}>
                {f.sample}
              </p>
              {form.font === f.id && (
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-[#0A5740] bg-[#C0DDD2] px-2 py-0.5 rounded-full">
                  <Check size={10} /> Actif
                </span>
              )}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Bottom save ─────────────────────────────────────────────────── */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-8 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition disabled:opacity-60 flex items-center gap-2 ${saved ? 'bg-green-500' : 'bg-[#0F6B4F] hover:bg-[#0A5740]'}`}
        >
          {saved ? (<><Check size={15} /> Sauvegardé !</>) : saving ? 'Enregistrement…' : 'Sauvegarder les modifications'}
        </button>
      </div>
    </div>
  );
};

export default BoutiqueSettings;
