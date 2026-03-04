import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft, Loader2, Store, Image, Globe, MessageCircle } from 'lucide-react';
import { storeManageApi } from '../services/storeApi.js';
import { storeProductsApi } from '../services/storeApi.js';
import { createEmptyStore, DEFAULT_EMPTY_STORE } from '../utils/storeDefaults.js';

const CURRENCIES = [
  { code: 'XAF', label: 'Franc CFA (XAF)', flag: '🇨🇲' },
  { code: 'EUR', label: 'Euro (€)', flag: '🇪🇺' },
  { code: 'USD', label: 'Dollar US ($)', flag: '🇺🇸' },
  { code: 'MAD', label: 'Dirham marocain (MAD)', flag: '🇲🇦' },
  { code: 'XOF', label: 'Franc CFA Ouest (XOF)', flag: '🌍' },
  { code: 'GNF', label: 'Franc guinéen (GNF)', flag: '🇬🇳' },
  { code: 'DZD', label: 'Dinar algérien (DZD)', flag: '🇩🇿' },
  { code: 'TND', label: 'Dinar tunisien (TND)', flag: '🇹🇳' },
];

const COLORS = ['#0F6B4F', '#1D4ED8', '#7C3AED', '#DC2626', '#EA580C', '#0891B2', '#DB2777', '#374151'];

const STEPS = [
  { num: 1, label: 'Nom & URL',    icon: Store },
  { num: 2, label: 'Logo & Style', icon: Image },
  { num: 3, label: 'Devise',       icon: Globe },
  { num: 4, label: 'Contact',      icon: MessageCircle },
];

// ── Field component ───────────────────────────────────────────────────────────
const Field = ({ label, hint, children, error }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
    {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
    {children}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

// ── Main Wizard ───────────────────────────────────────────────────────────────
const StoreCreationWizard = ({ onComplete }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    storeName: '',
    subdomain: '',
    storeLogo: '',
    themeColor: '#0F6B4F',
    storeCurrency: 'XAF',
    storeWhatsApp: '',
    storePhone: '',
    storeDescription: '',
  });

  const [subdomainStatus, setSubdomainStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | 'error'
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const debounceRef = useRef(null);

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: '' }));
  };

  // ── Auto-generate subdomain from store name ────────────────────────────────
  const handleStoreName = (val) => {
    set('storeName', val);
    if (!form.subdomain || form.subdomain === slugify(form.storeName)) {
      set('subdomain', slugify(val));
    }
  };

  const slugify = (str) =>
    str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30);

  // ── Check subdomain availability ──────────────────────────────────────────
  useEffect(() => {
    const sd = form.subdomain;
    if (!sd || sd.length < 3) { setSubdomainStatus(null); return; }
    setSubdomainStatus('checking');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await storeManageApi.checkSubdomain(sd);
        setSubdomainStatus(res.data?.data?.available ? 'available' : 'taken');
      } catch {
        setSubdomainStatus('error');
      }
    }, 500);
  }, [form.subdomain]);

  // ── Logo upload ───────────────────────────────────────────────────────────
  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setLogoPreview(URL.createObjectURL(file));
    try {
      const res = await storeProductsApi.uploadImages([file]);
      const url = res.data?.data?.[0]?.url || res.data?.urls?.[0];
      if (url) set('storeLogo', url);
    } catch {
      setErrors(p => ({ ...p, storeLogo: 'Erreur upload, réessayez' }));
    } finally {
      setLogoUploading(false);
    }
  };

  // ── Validation per step ───────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.storeName.trim()) e.storeName = 'Requis';
      if (!form.subdomain || form.subdomain.length < 3) e.subdomain = 'Minimum 3 caractères';
      if (subdomainStatus === 'taken') e.subdomain = 'Ce sous-domaine est déjà pris';
      if (subdomainStatus === 'checking') e.subdomain = 'Vérification en cours…';
    }
    if (step === 3 && !form.storeCurrency) e.storeCurrency = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(s => Math.min(4, s + 1)); };
  const back = () => setStep(s => Math.max(1, s - 1));

  // ── Final save ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Create empty store with user settings
      const emptyStore = createEmptyStore({
        storeName: form.storeName,
        storeDescription: form.storeDescription,
        storeLogo: form.storeLogo,
        currency: form.storeCurrency,
        whatsapp: form.storeWhatsApp,
        phone: form.storePhone,
      });

      // Set subdomain first
      await storeManageApi.setSubdomain(form.subdomain);
      
      // Update store config
      await storeManageApi.updateStoreConfig({
        storeName: form.storeName,
        storeDescription: form.storeDescription,
        storeLogo: form.storeLogo,
        storeThemeColor: form.themeColor,
        storeCurrency: form.storeCurrency,
        storeWhatsApp: form.storeWhatsApp,
        storePhone: form.storePhone,
        isStoreEnabled: true,
      });

      // ⬇️ CRUCIAL: initialiser storePages avec sections:[] pour que le builder
      // parte d'une page vierge (null = ancienne boutique avec sections par défaut)
      await storeManageApi.updatePages({ sections: [] });

      // Set the theme defaults
      try {
        await storeManageApi.updateTheme({
          ...emptyStore.theme,
          primaryColor: form.themeColor,
        });
      } catch (themeError) {
        console.warn('Theme initialization failed, will use defaults:', themeError);
      }

      onComplete?.();
      navigate('/ecom/boutique/builder');
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Erreur lors de la création' });
    } finally {
      setSaving(false);
    }
  };

  // ── Progress ──────────────────────────────────────────────────────────────
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#0F6B4F]/10 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-[#0F6B4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-gray-900">Créez votre boutique</h1>
          <p className="text-sm text-gray-500 mt-1">Quelques étapes pour démarrer</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-0">
            <div className="h-full bg-[#0F6B4F] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          {STEPS.map(s => {
            const done = step > s.num;
            const active = step === s.num;
            return (
              <div key={s.num} className="flex flex-col items-center gap-1.5 z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done    ? 'bg-[#0F6B4F] text-white shadow-md'
                  : active ? 'bg-white border-2 border-[#0F6B4F] text-[#0F6B4F] shadow-md'
                           : 'bg-white border-2 border-gray-200 text-gray-400'
                }`}>
                  {done ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-[10px] font-semibold ${active ? 'text-[#0F6B4F]' : 'text-gray-400'}`}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/60 p-8 space-y-6">

          {/* ── STEP 1: Nom & URL ── */}
          {step === 1 && (
            <>
              <div>
                <h2 className="text-lg font-black text-gray-900">Nom de votre boutique</h2>
                <p className="text-sm text-gray-500 mt-0.5">Ce nom sera affiché à vos clients</p>
              </div>
              <Field label="Nom de la boutique" error={errors.storeName}>
                <input
                  type="text"
                  value={form.storeName}
                  onChange={e => handleStoreName(e.target.value)}
                  placeholder="Ex : Ma Belle Boutique"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]/30 focus:border-[#0F6B4F] transition"
                  autoFocus
                />
              </Field>
              <Field label="URL de votre boutique" hint="Votre boutique sera accessible à cette adresse" error={errors.subdomain}>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#0F6B4F]/30 focus-within:border-[#0F6B4F] transition">
                  <span className="px-3 py-3 bg-gray-50 text-gray-400 text-xs font-mono border-r border-gray-200 whitespace-nowrap shrink-0">scalor.store/</span>
                  <input
                    type="text"
                    value={form.subdomain}
                    onChange={e => { set('subdomain', slugify(e.target.value)); }}
                    placeholder="ma-boutique"
                    className="flex-1 px-3 py-3 text-sm focus:outline-none font-mono"
                  />
                  <span className="px-3">
                    {subdomainStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                    {subdomainStatus === 'available' && <Check className="w-4 h-4 text-emerald-500" />}
                    {subdomainStatus === 'taken' && <span className="text-xs text-red-500 font-bold">Pris</span>}
                  </span>
                </div>
                {subdomainStatus === 'available' && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Disponible</p>
                )}
              </Field>
            </>
          )}

          {/* ── STEP 2: Logo & Couleur ── */}
          {step === 2 && (
            <>
              <div>
                <h2 className="text-lg font-black text-gray-900">Logo & Couleur</h2>
                <p className="text-sm text-gray-500 mt-0.5">Personnalisez l'apparence de votre boutique</p>
              </div>
              <Field label="Logo de la boutique" error={errors.storeLogo}>
                <label className={`flex flex-col items-center justify-center gap-3 h-36 border-2 border-dashed rounded-2xl cursor-pointer transition hover:border-[#0F6B4F] hover:bg-emerald-50/50 ${
                  logoPreview ? 'border-[#0F6B4F]/40' : 'border-gray-200'
                }`}>
                  {logoUploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-[#0F6B4F]" />
                  ) : logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="max-h-24 max-w-[80%] object-contain rounded-xl" />
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <Image className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-700">Cliquez pour importer</p>
                        <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, SVG — max 5MB</p>
                      </div>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                </label>
                {logoPreview && (
                  <button onClick={() => { setLogoPreview(null); set('storeLogo', ''); }}
                    className="mt-2 text-xs text-red-500 hover:underline">Supprimer</button>
                )}
              </Field>
              <Field label="Couleur principale">
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => set('themeColor', c)}
                      className={`w-9 h-9 rounded-xl transition hover:scale-110 ${form.themeColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                  <div className="relative">
                    <input type="color" value={form.themeColor} onChange={e => set('themeColor', e.target.value)}
                      className="w-9 h-9 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer p-0.5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-full h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow"
                    style={{ backgroundColor: form.themeColor }}>
                    Aperçu bouton
                  </div>
                </div>
              </Field>
            </>
          )}

          {/* ── STEP 3: Devise ── */}
          {step === 3 && (
            <>
              <div>
                <h2 className="text-lg font-black text-gray-900">Devise & Pays</h2>
                <p className="text-sm text-gray-500 mt-0.5">Choisissez la monnaie de vente</p>
              </div>
              <Field label="Devise" error={errors.storeCurrency}>
                <div className="grid grid-cols-2 gap-2">
                  {CURRENCIES.map(c => (
                    <button key={c.code} onClick={() => set('storeCurrency', c.code)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition ${
                        form.storeCurrency === c.code
                          ? 'border-[#0F6B4F] bg-emerald-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}>
                      <span className="text-lg">{c.flag}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{c.code}</p>
                        <p className="text-[10px] text-gray-400 truncate">{c.label.split(' (')[0]}</p>
                      </div>
                      {form.storeCurrency === c.code && <Check className="w-4 h-4 text-[#0F6B4F] ml-auto shrink-0" />}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {/* ── STEP 4: Contact & Description ── */}
          {step === 4 && (
            <>
              <div>
                <h2 className="text-lg font-black text-gray-900">Contact & Description</h2>
                <p className="text-sm text-gray-500 mt-0.5">Dernières informations sur votre boutique</p>
              </div>
              <Field label="Numéro WhatsApp" hint="Les clients pourront vous contacter directement">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#0F6B4F]/30 focus-within:border-[#0F6B4F] transition">
                  <span className="px-3 py-3 bg-gray-50 text-gray-500 text-sm border-r border-gray-200">📱</span>
                  <input type="tel" value={form.storeWhatsApp} onChange={e => set('storeWhatsApp', e.target.value)}
                    placeholder="+237 6XX XXX XXX"
                    className="flex-1 px-3 py-3 text-sm focus:outline-none" />
                </div>
              </Field>
              <Field label="Description de la boutique" hint="Décrivez ce que vous vendez (apparaît sur votre site)">
                <textarea
                  value={form.storeDescription}
                  onChange={e => set('storeDescription', e.target.value)}
                  placeholder="Nous vendons des produits de qualité livrés rapidement partout au Cameroun..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]/30 focus:border-[#0F6B4F] transition resize-none"
                />
              </Field>
              {errors.submit && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{errors.submit}</p>
              )}
            </>
          )}

        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6 gap-3">
          {step > 1 ? (
            <button onClick={back}
              className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
          ) : <div />}

          {step < 4 ? (
            <button onClick={next}
              className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl transition hover:opacity-90 hover:scale-105 shadow-lg ml-auto"
              style={{ backgroundColor: form.themeColor }}>
              Continuer
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white rounded-xl transition hover:opacity-90 shadow-lg ml-auto disabled:opacity-60"
              style={{ backgroundColor: form.themeColor }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Création…' : 'Lancer ma boutique 🚀'}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Vous pourrez modifier tout cela plus tard dans les paramètres
        </p>
      </div>
    </div>
  );
};

export default StoreCreationWizard;
