import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../contexts/StoreContext.jsx';
import {
  Check, ArrowRight, ArrowLeft, Loader2, Store, Palette, MapPin,
  Sparkles, MessageSquare, ChevronRight, Zap,
  Globe2, Phone, Upload, X, Wand2, RefreshCw
} from 'lucide-react';
import { storeManageApi, storesApi } from '../services/storeApi.js';
import { storeProductsApi } from '../services/storeApi.js';
import { createEmptyStore } from '../utils/storeDefaults.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DONNÉES
// ═══════════════════════════════════════════════════════════════════════════════

const PRODUCT_TYPES = [
  { value: 'beaute', label: 'Beauté & Soins', desc: 'Cosmétiques, skincare, maquillage' },
  { value: 'fitness', label: 'Fitness & Sport', desc: 'Équipements, vêtements sport' },
  { value: 'mode', label: 'Mode & Fashion', desc: 'Vêtements, accessoires, bijoux' },
  { value: 'tech', label: 'Tech & Gadgets', desc: 'Électronique, accessoires tech' },
  { value: 'maison', label: 'Maison & Déco', desc: 'Décoration, mobilier, rangement' },
  { value: 'sante', label: 'Bien-être & Santé', desc: 'Compléments, produits naturels' },
  { value: 'enfants', label: 'Enfants & Bébés', desc: 'Jouets, vêtements enfants' },
  { value: 'autre', label: 'Autre catégorie', desc: 'Produits divers' },
];

const CURRENCIES = [
  { code: 'XAF', label: 'Franc CFA', symbol: 'FCFA', region: 'Afrique Centrale' },
  { code: 'XOF', label: 'Franc CFA', symbol: 'FCFA', region: 'Afrique Ouest' },
  { code: 'NGN', label: 'Naira', symbol: '₦', region: 'Nigeria' },
  { code: 'GHS', label: 'Cedi', symbol: 'GH₵', region: 'Ghana' },
  { code: 'GNF', label: 'Franc Guinéen', symbol: 'GNF', region: 'Guinée' },
  { code: 'MAD', label: 'Dirham', symbol: 'DH', region: 'Maroc' },
  { code: 'EUR', label: 'Euro', symbol: '€', region: 'Europe' },
  { code: 'USD', label: 'Dollar US', symbol: '$', region: 'International' },
];

const COUNTRY_CURRENCY = {
  cameroun: 'XAF', gabon: 'XAF', congo: 'XAF', rdc: 'XAF',
  centrafrique: 'XAF', tchad: 'XAF', 'guinee equatoriale': 'XAF',
  senegal: 'XOF', mali: 'XOF', 'burkina faso': 'XOF', togo: 'XOF',
  benin: 'XOF', niger: 'XOF', 'cote d ivoire': 'XOF', "cote d'ivoire": 'XOF',
  'ivory coast': 'XOF', 'guinee bissau': 'XOF',
  nigeria: 'NGN',
  ghana: 'GHS',
  guinee: 'GNF',
  maroc: 'MAD',
  france: 'EUR', belgique: 'EUR',
  usa: 'USD', 'etats unis': 'USD', 'united states': 'USD',
};

const COLORS = [
  { value: '#0F6B4F', name: 'Émeraude' },
  { value: '#1D4ED8', name: 'Royal' },
  { value: '#7C3AED', name: 'Violet' },
  { value: '#DC2626', name: 'Rouge vif' },
  { value: '#EA580C', name: 'Orange' },
  { value: '#0891B2', name: 'Cyan' },
  { value: '#DB2777', name: 'Rose' },
  { value: '#000000', name: 'Noir' },
];

const STEPS = [
  { num: 1, title: 'Votre boutique', subtitle: 'Nom, URL et catégorie' },
  { num: 2, title: 'Votre identité', subtitle: 'Logo et couleurs' },
  { num: 3, title: 'Finalisez', subtitle: 'Coordonnées et création' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS UI
// ═══════════════════════════════════════════════════════════════════════════════

const GENERATION_STEPS = [
  { key: 'subdomain', label: 'Création de votre boutique' },
  { key: 'config', label: 'Enregistrement de vos informations' },
  { key: 'theme', label: 'Application du thème' },
  { key: 'logo', label: 'Génération du logo par l\'IA' },
  { key: 'homepage', label: "Génération de la page d'accueil par l'IA" },
  { key: 'images', label: 'Création des visuels personnalisés' },
  { key: 'verification', label: 'Vérification finale de la boutique' },
  { key: 'done', label: 'Votre boutique est prête !' },
];

const GenerationOverlay = ({ currentStep, storeName, logoUrl }) => {
  const currentIdx = GENERATION_STEPS.findIndex(s => s.key === currentStep);
  const isLogoStep = currentStep === 'logo';

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 flex items-center justify-center">
      <div className="max-w-md w-full mx-6">
        <div className="text-center mb-10">
          {/* Show logo preview during logo step */}
          {isLogoStep && logoUrl ? (
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl overflow-hidden bg-white shadow-lg shadow-emerald-500/30 flex items-center justify-center p-2">
              <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            </div>
          ) : isLogoStep && !logoUrl ? (
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Wand2 className="w-10 h-10 text-white animate-pulse" />
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          )}
          <h2 className="text-2xl font-bold text-white mb-2">
            {currentStep === 'done' ? '🎉 Boutique créée !' : isLogoStep ? '🎨 Création du logo...' : 'Création en cours...'}
          </h2>
          <p className="text-gray-400 text-sm">
            {currentStep === 'done'
              ? `${storeName || 'Votre boutique'} est prête`
              : isLogoStep
                ? 'Notre IA dessine votre logo avec un rendu professionnel'
              : "L'IA construit votre boutique sur mesure"}
          </p>
        </div>

        <div className="space-y-3">
          {GENERATION_STEPS.map((step, idx) => {
            const isDone = idx < currentIdx || currentStep === 'done';
            const isActive = idx === currentIdx && currentStep !== 'done';
            const isPending = idx > currentIdx && currentStep !== 'done';

            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${
                  isDone ? 'bg-emerald-500/10' : isActive ? 'bg-white/10' : 'bg-white/5'
                }`}
              >
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-emerald-500/20 border-2 border-emerald-400' : 'bg-white/10'
                }`}>
                  {isDone ? (
                    <Check className="w-4 h-4" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gray-500" />
                  )}
                </div>
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  isDone ? 'text-emerald-400' : isActive ? 'text-white' : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {currentStep !== 'done' && (
          <div className="mt-8">
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-700 ease-out"
                style={{ width: `${Math.max(5, ((currentIdx + 0.5) / GENERATION_STEPS.length) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              Cela peut prendre 30 à 60 secondes
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const ProgressBar = ({ current, total }) => (
  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 ease-out"
      style={{ width: `${(current / total) * 100}%` }}
    />
  </div>
);

const StepIndicator = ({ steps, current }) => (
  <div className="flex items-center justify-center gap-2 mb-2">
    {steps.map((s, i) => (
      <div key={s.num} className="flex items-center">
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300
          ${current > s.num ? 'bg-emerald-500 text-white scale-90' : ''}
          ${current === s.num ? 'bg-gray-900 text-white ring-4 ring-gray-900/20 scale-110' : ''}
          ${current < s.num ? 'bg-gray-100 text-gray-400' : ''}
        `}>
          {current > s.num ? <Check className="w-4 h-4" /> : s.num}
        </div>
        {i < steps.length - 1 && (
          <div className={`w-8 h-0.5 mx-1 transition-colors duration-300 ${current > s.num ? 'bg-emerald-500' : 'bg-gray-200'}`} />
        )}
      </div>
    ))}
  </div>
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 ${className}`}>
    {children}
  </div>
);

const SelectableCard = ({ selected, onClick, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      relative w-full text-left p-4 rounded-xl border-2 transition-all duration-200
      ${selected
        ? 'border-gray-900 bg-gray-50 shadow-lg shadow-gray-200/50'
        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
      }
      ${className}
    `}
  >
    {selected && (
      <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center shadow-lg">
        <Check className="w-3.5 h-3.5 text-white" />
      </div>
    )}
    {children}
  </button>
);

const Input = ({ label, hint, error, icon: Icon, ...props }) => (
  <div className="space-y-2">
    {label && <label className="block text-sm font-semibold text-gray-800">{label}</label>}
    {hint && <p className="text-xs text-gray-500">{hint}</p>}
    <div className="relative">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <input
        {...props}
        className={`
          w-full px-4 py-3.5 bg-gray-50 border-2 rounded-xl text-sm font-medium
          placeholder:text-gray-400 transition-all duration-200
          focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-4 focus:ring-gray-900/10
          ${Icon ? 'pl-12' : ''}
          ${error ? 'border-red-300 bg-red-50' : 'border-transparent'}
        `}
      />
    </div>
    {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
  </div>
);

const Textarea = ({ label, hint, error, ...props }) => (
  <div className="space-y-2">
    {label && <label className="block text-sm font-semibold text-gray-800">{label}</label>}
    {hint && <p className="text-xs text-gray-500">{hint}</p>}
    <textarea
      {...props}
      className={`
        w-full px-4 py-3.5 bg-gray-50 border-2 rounded-xl text-sm font-medium resize-none
        placeholder:text-gray-400 transition-all duration-200
        focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-4 focus:ring-gray-900/10
        ${error ? 'border-red-300 bg-red-50' : 'border-transparent'}
      `}
    />
    {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// WIZARD PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const StoreCreationWizard = ({ onComplete }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { stores, loading: storesLoading, refreshStores, switchStore } = useStore();
  const [searchParams] = useSearchParams();
  const isResetMode = searchParams.get('reset') === 'true';
  // "nouvelle" mode = creating a new additional store (not editing the primary)
  const isNewStoreMode = searchParams.get('mode') === 'new' || window.location.pathname.includes('/boutique/nouvelle');

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState('');
  const [generationStep, setGenerationStep] = useState(null); // key from GENERATION_STEPS
  const [creationResult, setCreationResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    storeName: '',
    subdomain: '',
    productType: '',
    storeLogo: '',
    themeColor: '#0F6B4F',
    storeWhatsApp: '',
    city: '',
    country: 'Cameroun',
    storeCurrency: 'XAF',
    storeDescription: '',
  });

  const [subdomainStatus, setSubdomainStatus] = useState(null);
  const [originalSubdomain, setOriginalSubdomain] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [generatedLogo, setGeneratedLogo] = useState(null);
  const [logoGenerating, setLogoGenerating] = useState(false);
  const [generationLogoUrl, setGenerationLogoUrl] = useState(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // ── Charger données existantes ────────────────────────────────────────────────
  const initDoneRef = useRef(false);
  useEffect(() => {
    // Wait for StoreContext to finish loading before deciding
    if (storesLoading) return;
    // Run only once
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    // If stores already exist, redirect away (unless new/reset mode)
    if (!isNewStoreMode && !isResetMode && stores.length > 0) {
      navigate('/ecom/boutique', { replace: true });
      return;
    }

    // Max 3 stores — block creation if limit reached
    if (isNewStoreMode && stores.length >= 3) {
      navigate('/ecom/boutique', { replace: true });
      return;
    }

    if (isResetMode) { setLoading(false); return; }

    const loadExisting = async () => {
      try {
        const res = await storeManageApi.getStoreConfig();
        const data = res.data?.data || res.data;
        const s = data?.storeSettings || {};

        if (s?.storeName && !isNewStoreMode) {
          const existingSub = data.subdomain || '';
          setOriginalSubdomain(existingSub);
          setForm(prev => ({
            ...prev,
            storeName: s.storeName || '',
            subdomain: existingSub,
            productType: s.productType || '',
            storeLogo: s.storeLogo || '',
            themeColor: s.storeThemeColor || '#0F6B4F',
            storeWhatsApp: s.storeWhatsApp || '',
            city: s.city || '',
            country: s.country || 'Cameroun',
            storeCurrency: s.storeCurrency || 'XAF',
            storeDescription: s.storeDescription || '',
          }));
          if (s.storeLogo) setLogoPreview(s.storeLogo);
          setSubdomainStatus('available');
          setIsEditMode(true);
        }
      } catch (err) {
        console.log('Pas de boutique existante');
      } finally {
        setLoading(false);
      }
    };
    loadExisting();
  }, [storesLoading]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const set = (key, val) => {
    setForm(p => {
      const next = { ...p, [key]: val };
      if (key === 'country') {
        const normalized = val.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const detectedCurrency = Object.entries(COUNTRY_CURRENCY).find(
          ([k]) => normalized === k || normalized.includes(k) || k.includes(normalized)
        )?.[1];
        if (detectedCurrency) next.storeCurrency = detectedCurrency;
      }
      return next;
    });
    setErrors(p => ({ ...p, [key]: '' }));
  };

  const slugify = (str) =>
    str.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);

  const handleStoreName = (val) => {
    const hasGeneratedSelection = generatedLogo?.url === form.storeLogo;
    set('storeName', val);
    if (!form.subdomain || form.subdomain === slugify(form.storeName)) {
      set('subdomain', slugify(val));
    }
    if (val.trim() !== String(form.storeName || '').trim()) {
      setGeneratedLogo(null);
      if (hasGeneratedSelection) {
        setLogoPreview(null);
        set('storeLogo', '');
      }
    }
  };

  // ── Vérification subdomain ────────────────────────────────────────────────────
  useEffect(() => {
    const sd = form.subdomain;
    if (!sd || sd.length < 3) { setSubdomainStatus(null); return; }
    if (isEditMode && sd === originalSubdomain) { setSubdomainStatus('available'); return; }

    setSubdomainStatus('checking');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await storeManageApi.checkSubdomain(sd);
        setSubdomainStatus(res.data?.data?.available ? 'available' : 'taken');
      } catch {
        setSubdomainStatus('error');
      }
    }, 400);
  }, [form.subdomain, isEditMode, originalSubdomain]);

  // ── Upload logo ───────────────────────────────────────────────────────────────
  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setGeneratedLogo(null);
    setLogoPreview(URL.createObjectURL(file));
    try {
      const res = await storeProductsApi.uploadImages([file]);
      const url = res.data?.data?.[0]?.url || res.data?.urls?.[0];
      if (url) set('storeLogo', url);
    } catch {
      setErrors(p => ({ ...p, storeLogo: 'Erreur, réessayez' }));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleGenerateLogo = async () => {
    if (!form.storeName.trim()) {
      setErrors((prev) => ({ ...prev, storeName: 'Donnez un nom à votre boutique avant de générer un logo' }));
      return;
    }

    setLogoGenerating(true);
    setErrors((prev) => ({ ...prev, storeLogo: '' }));
    try {
      const res = await storeManageApi.generateLogos({
        storeName: form.storeName,
        productType: form.productType,
        themeColor: form.themeColor,
        variant: 'wordmark',
      });
      const logo = res.data?.data || null;
      setGeneratedLogo(logo);
      if (logo?.url) {
        set('storeLogo', logo.url);
        setLogoPreview(logo.url);
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, storeLogo: error.response?.data?.message || 'Erreur lors de la génération du logo' }));
    } finally {
      setLogoGenerating(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────────
  const validate = (skipping = false) => {
    const e = {};
    if (step === 1) {
      if (!form.storeName.trim()) e.storeName = 'Donnez un nom à votre boutique';
      if (!form.subdomain || form.subdomain.length < 3) e.subdomain = '3 caractères minimum';
      if (subdomainStatus === 'taken') e.subdomain = 'Cette URL est déjà utilisée';
      // productType is optional — defaults will be used
    }
    // Étape 5 : pas de validation obligatoire, description optionnelle
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate()) {
      setStep(s => Math.min(STEPS.length, s + 1));
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const skip = () => {
    setStep(s => Math.min(STEPS.length, s + 1));
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => {
    setStep(s => Math.max(1, s - 1));
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Soumission ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setGenerationStep('subdomain');

    try {
      const emptyStore = createEmptyStore({
        storeName: form.storeName,
        storeDescription: form.storeDescription,
        storeLogo: form.storeLogo,
        currency: form.storeCurrency,
        whatsapp: form.storeWhatsApp,
      });

      // ── NEW STORE MODE: create a new Store document, then configure it ──────
      if (isNewStoreMode) {
        const createRes = await storesApi.createStore({
          name: form.storeName,
          subdomain: form.subdomain
        });
        const newStore = createRes.data?.data;
        if (newStore?._id) {
          // Set as active store in window so subsequent API calls target it
          window.__activeStoreId__ = newStore._id;
          switchStore(newStore);
        }
      }

      // Étape 1 : Sous-domaine
      if (!isEditMode || isResetMode || isNewStoreMode) {
        if (!isNewStoreMode) await storeManageApi.setSubdomain(form.subdomain);
      }

      // Étape 2 : Config boutique
      setGenerationStep('config');
      await storeManageApi.updateStoreConfig({
        storeName: form.storeName,
        storeDescription: form.storeDescription,
        storeLogo: form.storeLogo,
        storeThemeColor: form.themeColor,
        storeCurrency: form.storeCurrency,
        storeWhatsApp: form.storeWhatsApp,
        isStoreEnabled: true,
        productType: form.productType,
        city: form.city,
        country: form.country,
      });

      // Étape 3 : Thème
      setGenerationStep('theme');
      try {
        await storeManageApi.updateTheme({ ...emptyStore.theme, primaryColor: form.themeColor });
      } catch {}

      // Étape 3.5 : Génération du logo IA si pas encore de logo
      if (!form.storeLogo) {
        setGenerationStep('logo');
        setGenerationLogoUrl(null);
        try {
          const logoRes = await storeManageApi.generateLogos({
            storeName: form.storeName,
            productType: form.productType,
            themeColor: form.themeColor,
            variant: 'wordmark',
          });
          const logo = logoRes.data?.data || null;
          if (logo?.url) {
            setGenerationLogoUrl(logo.url);
            set('storeLogo', logo.url);
            setLogoPreview(logo.url);
            // Sauvegarder le logo dans la config
            await storeManageApi.updateStoreConfig({ storeLogo: logo.url });
          }
        } catch (logoErr) {
          console.warn('Logo AI generation failed:', logoErr.message);
        }
      } else {
        setGenerationStep('logo');
        setGenerationLogoUrl(form.storeLogo);
        await new Promise(r => setTimeout(r, 400));
      }

      // Étape 4 : Génération IA de la page d'accueil
      if (!isEditMode || isResetMode) {
        setGenerationStep('homepage');
        try {
          await storeManageApi.generateHomepage({
            storeName: form.storeName,
            storeDescription: form.storeDescription,
            productType: form.productType,
            productDescription: form.productDescription,
            city: form.city,
            country: form.country,
            storeWhatsApp: form.storeWhatsApp,
          });
        } catch {
          // Silently continue — the backend fallback sections are already saved,
          // or the storefront will use its default layout.
          console.warn('Homepage AI generation failed, storefront will use fallback');
        }
        // Images are generated in parallel server-side during generateHomepage,
        // so by the time we reach here everything (text + images) is ready.
        setGenerationStep('images');
        // Small pause so user sees the "images" step check off
        await new Promise(r => setTimeout(r, 800));
      }

      // Étape vérification : s'assurer que tout est bien créé
      setGenerationStep('verification');
      try {
        const verifyRes = await storeManageApi.getStoreConfig();
        const verifyData = verifyRes.data?.data;
        if (!verifyData?.subdomain) {
          throw new Error('Store not found after creation');
        }
      } catch {
        // On continue même si la vérification échoue
        console.warn('Store verification check returned no data, continuing anyway');
      }
      await new Promise(r => setTimeout(r, 500));

      // Step final : tout est prêt
      setGenerationStep('done');
      onComplete?.();

      // Refresh stores list & switch to the new store
      await refreshStores();
      if (isNewStoreMode) {
        const freshRes = await storesApi.getStores();
        const freshList = freshRes.data?.data || [];
        const newOne = freshList.find(s => s.subdomain === form.subdomain);
        if (newOne) {
          switchStore(newOne);
        }
      }

      const storeUrl = `https://${form.subdomain}.scalor.net`;
      const fallbackPath = !isEditMode && !isNewStoreMode ? '/ecom/dashboard/admin' : '/ecom/boutique';
      const requestedPath = typeof location.state?.from === 'string' ? location.state.from : '';
      const nextPath = requestedPath.startsWith('/ecom/dashboard') ? requestedPath : fallbackPath;
      setCreationResult({
        storeUrl,
        nextPath,
      });
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Une erreur est survenue' });
    } finally {
      setSaving(false);
      setSavingStep('');
      setGenerationStep(null);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (storesLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  if (creationResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/40 flex items-center justify-center px-6">
        <div className="max-w-xl w-full">
          <Card className="p-8 sm:p-10 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 mb-6">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-3">Votre boutique a ete creee</h1>
            <p className="text-gray-500 mb-6">
              Votre boutique est prete. Vous pouvez l'ouvrir maintenant ou revenir a votre espace d'administration.
            </p>

            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 mb-8">
              <p className="text-xs text-gray-500 mb-1">Adresse de votre boutique</p>
              <p className="font-mono text-sm font-bold text-emerald-600 break-all">{creationResult.storeUrl}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3">
              <a
                href={creationResult.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:from-emerald-600 hover:to-teal-700 transition shadow-lg shadow-emerald-500/30"
              >
                <Globe2 className="w-4 h-4" />
                Voir la boutique
              </a>
              <button
                type="button"
                onClick={() => navigate(creationResult.nextPath, { replace: true })}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                Retour au tableau de bord
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDU PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 overflow-auto">
      {/* Overlay plein écran pendant la génération */}
      {generationStep && <GenerationOverlay currentStep={generationStep} storeName={form.storeName} logoUrl={generationLogoUrl || logoPreview} />}

      {/* Header fixe */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/ecom/boutique')}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Quitter</span>
            </button>
            <div className="text-center">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                {isEditMode ? 'Modification' : `Étape ${step}/${STEPS.length}`}
              </p>
              <h2 className="text-sm font-bold text-gray-900">{STEPS[step - 1].title}</h2>
            </div>
            {isEditMode && !isResetMode ? (
              <button
                onClick={() => navigate('/ecom/boutique/wizard?reset=true')}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition"
              >
                Repartir à zéro
              </button>
            ) : (
              <div className="w-16" />
            )}
          </div>
          <ProgressBar current={step} total={STEPS.length} />
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-2xl mx-auto px-6 py-8 pb-32">

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 1 : Votre boutique */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/30 mb-2">
                <Store className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Comment s'appelle votre boutique ?</h1>
              <p className="text-gray-500">Le nom qui fera craquer vos clients</p>
            </div>

            <Card className="p-6 space-y-6">
              <Input
                label="Nom de la boutique"
                placeholder="Ex: Glow Beauty, FitLife Store..."
                value={form.storeName}
                onChange={e => handleStoreName(e.target.value)}
                error={errors.storeName}
                icon={Store}
                autoFocus
              />

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800">Votre URL unique</label>
                <div className="flex items-stretch bg-gray-50 rounded-xl border-2 border-transparent focus-within:border-gray-900 focus-within:bg-white transition-all">
                  <span className="flex items-center px-4 text-gray-400 text-sm font-mono bg-gray-100 rounded-l-xl border-r border-gray-200">
                    scalor.store/
                  </span>
                  <input
                    type="text"
                    value={form.subdomain}
                    onChange={e => set('subdomain', slugify(e.target.value))}
                    placeholder="ma-boutique"
                    className="flex-1 px-4 py-3.5 bg-transparent text-sm font-mono font-medium focus:outline-none"
                  />
                  <span className="flex items-center px-4">
                    {subdomainStatus === 'checking' && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
                    {subdomainStatus === 'available' && <Check className="w-5 h-5 text-emerald-500" />}
                    {subdomainStatus === 'taken' && <X className="w-5 h-5 text-red-500" />}
                  </span>
                </div>
                {errors.subdomain && <p className="text-xs text-red-600 font-medium">{errors.subdomain}</p>}
                {subdomainStatus === 'available' && !errors.subdomain && (
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> Disponible !
                  </p>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Que vendez-vous ?</h3>
              {errors.productType && <p className="text-sm text-red-600 font-medium">{errors.productType}</p>}
              <div className="grid grid-cols-2 gap-3">
                {PRODUCT_TYPES.map(type => (
                  <SelectableCard
                    key={type.value}
                    selected={form.productType === type.value}
                    onClick={() => set('productType', type.value)}
                  >
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{type.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{type.desc}</p>
                    </div>
                  </SelectableCard>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 2 : Votre identité */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl shadow-lg shadow-pink-500/30 mb-2">
                <Palette className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Choisissez votre logo maintenant</h1>
              <p className="text-gray-500">Ajoutez un logo puis choisissez la couleur principale de votre boutique</p>
            </div>

            <Card className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-800">Logo de votre boutique</label>
                <p className="text-xs text-gray-500">Importez votre logo ou cliquez pour générer une seule proposition IA à partir du nom de votre boutique.</p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleGenerateLogo}
                    disabled={logoGenerating || !form.storeName.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {logoGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {generatedLogo?.url ? 'Régénérer le logo IA' : 'Générer mon logo IA'}
                  </button>
                  {generatedLogo?.url && (
                    <button
                      type="button"
                      onClick={() => {
                        setGeneratedLogo(null);
                        setLogoPreview(null);
                        set('storeLogo', '');
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Réinitialiser
                    </button>
                  )}
                </div>

                {generatedLogo?.url && (
                  <div className="rounded-2xl border-2 border-gray-200 overflow-hidden bg-white">
                    <div className="aspect-square bg-gray-50 p-6 flex items-center justify-center">
                      <img src={generatedLogo.url} alt="Logo IA généré" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-800">Logo IA généré</p>
                        <p className="text-[11px] text-gray-500 capitalize">{generatedLogo.variant || 'wordmark'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          set('storeLogo', generatedLogo.url);
                          setLogoPreview(generatedLogo.url);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold"
                      >
                        Utiliser ce logo
                      </button>
                    </div>
                  </div>
                )}
                {errors.storeLogo && <p className="text-sm text-red-600 font-medium">{errors.storeLogo}</p>}

                <label className={`
                  relative flex flex-col items-center justify-center h-40 rounded-2xl border-2 border-dashed cursor-pointer
                  transition-all duration-200 overflow-hidden
                  ${logoPreview ? 'border-gray-300 bg-gray-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'}
                `}>
                  {logoUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                      <span className="text-sm text-gray-500">Upload en cours...</span>
                    </div>
                  ) : logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Logo" className="max-h-32 max-w-[80%] object-contain" />
                      <button
                        onClick={(e) => { e.preventDefault(); setLogoPreview(null); set('storeLogo', ''); }}
                        className="absolute top-3 right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <Upload className="w-6 h-6 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Glissez ou cliquez pour upload</p>
                        <p className="text-xs text-gray-400">PNG, JPG, SVG • Max 5 MB</p>
                      </div>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                </label>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-800">Couleur principale</label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => set('themeColor', c.value)}
                      className={`
                        group relative w-12 h-12 rounded-xl transition-all duration-200 hover:scale-110
                        ${form.themeColor === c.value ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:shadow-lg'}
                      `}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    >
                      {form.themeColor === c.value && (
                        <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                  <label className="relative w-12 h-12 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-gray-400 transition overflow-hidden">
                    <input
                      type="color"
                      value={form.themeColor}
                      onChange={e => set('themeColor', e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Palette className="w-5 h-5 text-gray-400" />
                    </div>
                  </label>
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-3">Aperçu</p>
                  <div className="flex items-center gap-3">
                    <button
                      className="px-6 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg transition hover:opacity-90"
                      style={{ backgroundColor: form.themeColor }}
                    >
                      Commander
                    </button>
                    <button
                      className="px-6 py-2.5 rounded-xl border-2 text-sm font-bold transition hover:bg-gray-50"
                      style={{ borderColor: form.themeColor, color: form.themeColor }}
                    >
                      Voir plus
                    </button>
                  </div>
                </div>
              </div>

            </Card>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">La génération du logo est maintenant manuelle.</p>
              <p className="mt-1 text-xs text-emerald-700">Vous pouvez importer votre propre logo, générer un seul logo IA, ou passer cette étape.</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 3 : Finalisation */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/30 mb-2">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Finalisez votre boutique</h1>
              <p className="text-gray-500">Ajoutez vos coordonnées puis lancez la création</p>
            </div>

            <Card className="p-6 space-y-6">
              <Input
                label="Numéro WhatsApp"
                hint="Les clients vous contacteront directement sur ce numéro"
                placeholder="+237 6XX XXX XXX"
                value={form.storeWhatsApp}
                onChange={e => set('storeWhatsApp', e.target.value)}
                error={errors.storeWhatsApp}
                icon={MessageSquare}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Ville"
                  placeholder="Douala"
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                />
                <Input
                  label="Pays"
                  placeholder="Cameroun"
                  value={form.country}
                  onChange={e => set('country', e.target.value)}
                />
              </div>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Devise de vente</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CURRENCIES.map(c => (
                  <SelectableCard
                    key={c.code}
                    selected={form.storeCurrency === c.code}
                    onClick={() => set('storeCurrency', c.code)}
                    className="text-center py-3"
                  >
                    <p className="font-bold text-gray-900">{c.code}</p>
                    <p className="text-xs text-gray-500 mt-1">{c.region}</p>
                  </SelectableCard>
                ))}
              </div>
            </div>

            <div className="text-center space-y-2 pt-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg shadow-amber-500/30 mb-2">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-gray-900">Vérifiez puis créez</h2>
              <p className="text-gray-500">Votre boutique sera générée automatiquement avec ces informations</p>
            </div>

            {/* ══ Aperçu visuel de la boutique ══ */}
            <Card className="overflow-hidden">
              <div 
                className="relative p-8 text-center"
                style={{ background: `linear-gradient(135deg, ${form.themeColor} 0%, ${form.themeColor}dd 100%)` }}
              >
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative z-10">
                  {logoPreview ? (
                    <img 
                      src={logoPreview} 
                      alt="Logo" 
                      className="h-16 w-auto mx-auto mb-4 object-contain brightness-0 invert drop-shadow-lg"
                    />
                  ) : (
                    <div 
                      className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-black"
                    >
                      {form.storeName?.[0]?.toUpperCase() || 'S'}
                    </div>
                  )}
                  <h2 className="text-2xl font-black text-white mb-2 drop-shadow-sm">
                    {form.storeName || 'Ma Boutique'}
                  </h2>
                  <p className="text-white/80 text-sm max-w-md mx-auto mb-6">
                    {form.storeDescription || `Bienvenue dans notre boutique ${PRODUCT_TYPES.find(p => p.value === form.productType)?.label || ''}`}
                  </p>
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full text-sm font-bold shadow-lg" style={{ color: form.themeColor }}>
                    <span>Découvrir nos produits</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
              
              {/* URL Preview */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Globe2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Votre boutique sera accessible sur</p>
                    <p className="font-mono text-sm font-bold text-emerald-600">
                      https://{form.subdomain || 'maboutique'}.scalor.net
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Description (optionnelle) */}
            <Card className="p-6">
              <Textarea
                label="Description de votre boutique"
                hint="Ce texte apparaîtra sur votre page d'accueil (optionnel)"
                placeholder="Bienvenue chez nous ! Découvrez notre sélection de produits de qualité..."
                rows={3}
                value={form.storeDescription}
                onChange={e => set('storeDescription', e.target.value)}
              />
            </Card>

            {/* Récapitulatif compact */}
            <Card className="p-5 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">Récapitulatif</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-gray-400 uppercase tracking-wider mb-1">Catégorie</p>
                  <p className="font-semibold">{PRODUCT_TYPES.find(p => p.value === form.productType)?.label || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wider mb-1">Couleur</p>
                  <p className="font-semibold">{form.themeColor || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wider mb-1">Pays</p>
                  <p className="font-semibold">
                    {form.country || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wider mb-1">Contact</p>
                  <p className="font-semibold text-emerald-400">{form.storeWhatsApp || '—'}</p>
                </div>
              </div>
            </Card>

            {/* Message de ce qui va se passer */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900">L'IA va créer votre boutique</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    En cliquant sur "Créer ma boutique", notre IA génère automatiquement une page d'accueil professionnelle adaptée à votre activité. Un message de confirmation s'affichera à la fin avec un bouton pour voir la boutique.
                  </p>
                </div>
              </div>
            </div>

            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700 font-medium">{errors.submit}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer fixe avec boutons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              onClick={back}
              className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={skip}
                className="px-5 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 transition"
              >
                Passer
              </button>
            )}

            {step < STEPS.length ? (
              <button
                onClick={next}
                className="flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition shadow-lg shadow-gray-900/30"
              >
                Continuer
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:from-emerald-600 hover:to-teal-700 transition shadow-lg shadow-emerald-500/30 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="max-w-[200px] truncate">{savingStep || 'Génération...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Créer ma boutique avec l'IA
                </>
              )}
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreCreationWizard;
