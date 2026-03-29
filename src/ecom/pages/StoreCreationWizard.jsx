import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check, ArrowRight, ArrowLeft, Loader2, Store, Palette, MapPin,
  Sparkles, Users, MessageSquare, ChevronRight, Zap, Crown,
  Leaf, Target, TrendingUp, Heart, Globe2, Phone, Upload, X
} from 'lucide-react';
import { storeManageApi } from '../services/storeApi.js';
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

// ── AUDIENCE STRUCTURÉE ─────────────────────────────────────────────────────────
const AUDIENCE = {
  gender: {
    label: 'Genre',
    multiSelect: true,
    options: [
      { value: 'femmes', label: 'Femmes' },
      { value: 'hommes', label: 'Hommes' },
      { value: 'enfants', label: 'Enfants' },
      { value: 'mixte', label: 'Tous' },
    ]
  },
  ageRange: {
    label: 'Tranche d\'âge',
    multiSelect: true,
    options: [
      { value: '18-25', label: '18-25 ans' },
      { value: '25-35', label: '25-35 ans' },
      { value: '35-50', label: '35-50 ans' },
      { value: '50+', label: '50+' },
      { value: 'tous', label: 'Tous âges' },
    ]
  },
  region: {
    label: 'Zone géographique',
    multiSelect: true,
    options: [
      { value: 'cameroun', label: 'Cameroun' },
      { value: 'afrique-centrale', label: 'Afrique Centrale' },
      { value: 'afrique-ouest', label: 'Afrique de l\'Ouest' },
      { value: 'maghreb', label: 'Maghreb' },
      { value: 'europe', label: 'Europe' },
      { value: 'amerique', label: 'Amérique' },
      { value: 'diaspora', label: 'Diaspora africaine' },
      { value: 'international', label: 'International' },
    ]
  },
  origin: {
    label: 'Origine / Culture (optionnel)',
    multiSelect: true,
    options: [
      { value: 'africaine', label: 'Africaine' },
      { value: 'afro-diaspora', label: 'Afro-diaspora' },
      { value: 'europeenne', label: 'Européenne' },
      { value: 'arabe', label: 'Arabe' },
      { value: 'asiatique', label: 'Asiatique' },
      { value: 'mixte', label: 'Multiculturelle' },
      { value: 'autre', label: 'Autre' },
    ]
  }
};

const TONES = [
  { value: 'premium', label: 'Premium & Luxe', icon: Crown, color: '#D4AF37', desc: 'Élégance, exclusivité, raffinement', gradient: 'from-amber-500 to-yellow-600' },
  { value: 'naturel', label: 'Naturel & Authentique', icon: Leaf, color: '#22C55E', desc: 'Bio, écologique, bien-être', gradient: 'from-green-500 to-emerald-600' },
  { value: 'dynamique', label: 'Moderne & Dynamique', icon: Zap, color: '#8B5CF6', desc: 'Énergique, innovant, jeune', gradient: 'from-violet-500 to-purple-600' },
  { value: 'confiance', label: 'Pro & Confiance', icon: Target, color: '#3B82F6', desc: 'Sérieux, fiable, expert', gradient: 'from-blue-500 to-indigo-600' },
  { value: 'tendance', label: 'Tendance & Viral', icon: TrendingUp, color: '#F43F5E', desc: 'Hype, influenceur, buzz', gradient: 'from-rose-500 to-pink-600' },
  { value: 'chaleureux', label: 'Chaleureux & Proche', icon: Heart, color: '#F97316', desc: 'Familial, accessible, sympathique', gradient: 'from-orange-500 to-amber-600' },
];

const CURRENCIES = [
  { code: 'XAF', label: 'Franc CFA', symbol: 'FCFA', region: 'Afrique Centrale' },
  { code: 'XOF', label: 'Franc CFA', symbol: 'FCFA', region: 'Afrique Ouest' },
  { code: 'EUR', label: 'Euro', symbol: '€', region: 'Europe' },
  { code: 'USD', label: 'Dollar US', symbol: '$', region: 'International' },
  { code: 'MAD', label: 'Dirham', symbol: 'DH', region: 'Maroc' },
  { code: 'GNF', label: 'Franc Guinéen', symbol: 'GNF', region: 'Guinée' },
];

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
  { num: 1, title: 'Votre boutique', subtitle: 'Nom et type de produits' },
  { num: 2, title: 'Votre audience', subtitle: 'Cible et style de communication' },
  { num: 3, title: 'Votre identité', subtitle: 'Logo et couleurs' },
  { num: 4, title: 'Vos coordonnées', subtitle: 'Contact et localisation' },
  { num: 5, title: 'Finalisez', subtitle: 'Description et génération' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS UI
// ═══════════════════════════════════════════════════════════════════════════════

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

const MultiSelectChip = ({ selected, onClick, children, color }) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      px-4 py-2.5 rounded-full border-2 font-medium text-sm transition-all duration-200
      ${selected
        ? 'border-gray-900 bg-gray-900 text-white shadow-lg'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      }
    `}
  >
    {children}
  </button>
);

const MultiSelectDropdown = ({ label, options, values = [], onChange, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (val) => {
    if (values.includes(val)) {
      onChange(values.filter(v => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const selectedLabels = values.map(v => options.find(o => o.value === v)?.label).filter(Boolean);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl text-left text-sm font-medium flex items-center justify-between transition-all ${
          error ? 'border-red-300' : isOpen ? 'border-gray-900 bg-white' : 'border-transparent hover:bg-gray-100'
        }`}
      >
        <span className={values.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
          {values.length === 0 ? `Sélectionner ${label.toLowerCase()}` : selectedLabels.join(', ')}
        </span>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition"
            >
              <input
                type="checkbox"
                checked={values.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-2 focus:ring-gray-900"
              />
              <span className="text-sm font-medium text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
};

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
  const [searchParams] = useSearchParams();
  const isResetMode = searchParams.get('reset') === 'true';

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    storeName: '',
    subdomain: '',
    productType: '',
    // Audience structurée (multi-sélection)
    audience: {
      gender: [],
      ageRange: [],
      region: [],
      origin: [],
    },
    tone: '',
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
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // ── Charger données existantes ────────────────────────────────────────────────
  useEffect(() => {
    const loadExisting = async () => {
      if (isResetMode) { setLoading(false); return; }
      try {
        const res = await storeManageApi.getStoreConfig();
        const data = res.data?.data || res.data;
        const s = data?.storeSettings || {};

        if (s?.storeName) {
          const existingSub = data.subdomain || '';
          setOriginalSubdomain(existingSub);
          setForm(prev => ({
            ...prev,
            storeName: s.storeName || '',
            subdomain: existingSub,
            productType: s.productType || '',
            audience: s.audience || { gender: [], ageRange: [], region: [], origin: [] },
            tone: s.tone || '',
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
  }, [isResetMode]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: '' }));
  };

  const slugify = (str) =>
    str.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);

  const handleStoreName = (val) => {
    set('storeName', val);
    if (!form.subdomain || form.subdomain === slugify(form.storeName)) {
      set('subdomain', slugify(val));
    }
  };

  const setAudience = (key, val) => {
    const currentValues = form.audience[key] || [];
    let newValues;

    if (currentValues.includes(val)) {
      // Retirer si déjà sélectionné
      newValues = currentValues.filter(v => v !== val);
    } else {
      // Ajouter si pas encore sélectionné
      newValues = [...currentValues, val];
    }

    setForm(p => ({
      ...p,
      audience: { ...p.audience, [key]: newValues }
    }));
    setErrors(p => ({ ...p, [key]: '' }));
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

  // ── Validation ────────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.storeName.trim()) e.storeName = 'Donnez un nom à votre boutique';
      if (!form.subdomain || form.subdomain.length < 3) e.subdomain = '3 caractères minimum';
      if (subdomainStatus === 'taken') e.subdomain = 'Cette URL est déjà utilisée';
      if (!form.productType) e.productType = 'Sélectionnez une catégorie';
    }
    if (step === 2) {
      if (!form.audience.gender || form.audience.gender.length === 0) e.gender = 'Sélectionnez au moins un genre';
      if (!form.audience.ageRange || form.audience.ageRange.length === 0) e.ageRange = 'Sélectionnez au moins une tranche d\'âge';
      if (!form.audience.region || form.audience.region.length === 0) e.region = 'Sélectionnez au moins une zone';
      // origin est optionnel
      if (!form.tone) e.tone = 'Choisissez votre style';
    }
    if (step === 4) {
      if (!form.storeWhatsApp.trim()) e.storeWhatsApp = 'Ajoutez un numéro WhatsApp';
    }
    // Étape 5 : pas de validation obligatoire, description optionnelle
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate()) {
      setStep(s => Math.min(5, s + 1));
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const back = () => {
    setStep(s => Math.max(1, s - 1));
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Soumission ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const emptyStore = createEmptyStore({
        storeName: form.storeName,
        storeDescription: form.storeDescription,
        storeLogo: form.storeLogo,
        currency: form.storeCurrency,
        whatsapp: form.storeWhatsApp,
      });

      // Étape 1 : Sous-domaine
      setSavingStep('Création de votre boutique...');
      if (!isEditMode || isResetMode) {
        await storeManageApi.setSubdomain(form.subdomain);
      }

      // Étape 2 : Config boutique
      setSavingStep('Enregistrement de vos informations...');
      await storeManageApi.updateStoreConfig({
        storeName: form.storeName,
        storeDescription: form.storeDescription,
        storeLogo: form.storeLogo,
        storeThemeColor: form.themeColor,
        storeCurrency: form.storeCurrency,
        storeWhatsApp: form.storeWhatsApp,
        isStoreEnabled: true,
        productType: form.productType,
        audience: form.audience,
        tone: form.tone,
        city: form.city,
        country: form.country,
      });

      // Étape 3 : Thème
      try {
        await storeManageApi.updateTheme({ ...emptyStore.theme, primaryColor: form.themeColor });
      } catch {}

      // Étape 4 : Génération IA de la page d'accueil (nouveau)
      if (!isEditMode || isResetMode) {
        setSavingStep("L'IA construit votre page d'accueil...");
        try {
          const genRes = await storeManageApi.generateHomepage();
          const sections = genRes.data?.sections;
          if (Array.isArray(sections) && sections.length > 0) {
            await storeManageApi.updatePages({ sections });
          } else {
            await storeManageApi.updatePages({ sections: [] });
          }
        } catch {
          await storeManageApi.updatePages({ sections: [] });
        }
      }

      setSavingStep('Votre boutique est prête !');
      onComplete?.();
      
      // Redirection directe vers la boutique publique
      const storeUrl = `https://${form.subdomain}.scalor.net`;
      
      // Petit délai pour laisser voir le message de succès
      setTimeout(() => {
        window.open(storeUrl, '_blank');
        navigate('/ecom/boutique');
      }, 1500);
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Une erreur est survenue' });
    } finally {
      setSaving(false);
      setSavingStep('');
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDU PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 overflow-auto">
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
                {isEditMode ? 'Modification' : `Étape ${step}/5`}
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
          <ProgressBar current={step} total={5} />
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
        {/* ÉTAPE 2 : Votre audience */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-violet-500/30 mb-2">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Définissez votre audience</h1>
              <p className="text-gray-500">Précisez les caractéristiques de vos clients</p>
            </div>

            <Card className="p-6 space-y-6">
              <MultiSelectDropdown
                label={AUDIENCE.gender.label}
                options={AUDIENCE.gender.options}
                values={form.audience.gender}
                onChange={(v) => setForm(p => ({ ...p, audience: { ...p.audience, gender: v } }))}
                error={errors.gender}
              />

              <MultiSelectDropdown
                label={AUDIENCE.ageRange.label}
                options={AUDIENCE.ageRange.options}
                values={form.audience.ageRange}
                onChange={(v) => setForm(p => ({ ...p, audience: { ...p.audience, ageRange: v } }))}
                error={errors.ageRange}
              />

              <MultiSelectDropdown
                label={AUDIENCE.region.label}
                options={AUDIENCE.region.options}
                values={form.audience.region}
                onChange={(v) => setForm(p => ({ ...p, audience: { ...p.audience, region: v } }))}
                error={errors.region}
              />

              <MultiSelectDropdown
                label={AUDIENCE.origin.label}
                options={AUDIENCE.origin.options}
                values={form.audience.origin}
                onChange={(v) => setForm(p => ({ ...p, audience: { ...p.audience, origin: v } }))}
              />
            </Card>

            {/* Style de communication */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Style de communication</h3>
              {errors.tone && <p className="text-sm text-red-600 font-medium">{errors.tone}</p>}
              <div className="grid gap-3">
                {TONES.map(tone => {
                  const Icon = tone.icon;
                  return (
                    <SelectableCard
                      key={tone.value}
                      selected={form.tone === tone.value}
                      onClick={() => set('tone', tone.value)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tone.gradient} flex items-center justify-center shadow-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900">{tone.label}</p>
                          <p className="text-sm text-gray-500">{tone.desc}</p>
                        </div>
                        <ChevronRight className={`w-5 h-5 transition-transform ${form.tone === tone.value ? 'text-gray-900 rotate-90' : 'text-gray-300'}`} />
                      </div>
                    </SelectableCard>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 3 : Votre identité */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl shadow-lg shadow-pink-500/30 mb-2">
                <Palette className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Créez votre identité</h1>
              <p className="text-gray-500">Logo et couleurs de votre marque</p>
            </div>

            <Card className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-800">Logo de votre boutique</label>
                <p className="text-xs text-gray-500">Optionnel — Vous pourrez l'ajouter plus tard</p>

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

                {/* Preview */}
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
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 4 : Contact */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/30 mb-2">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Vos coordonnées</h1>
              <p className="text-gray-500">Comment vos clients vous contacteront</p>
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
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 5 : Finalisation avec Aperçu */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 5 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg shadow-amber-500/30 mb-2">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Votre boutique est prête !</h1>
              <p className="text-gray-500">Vérifiez les informations et lancez la création</p>
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
                  <p className="text-gray-400 uppercase tracking-wider mb-1">Style</p>
                  <p className="font-semibold">{TONES.find(t => t.value === form.tone)?.label || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wider mb-1">Audience</p>
                  <p className="font-semibold">
                    {form.audience.gender?.map(g => AUDIENCE.gender.options.find(o => o.value === g)?.label).join(', ') || '—'}
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
                    En cliquant sur "Créer ma boutique", notre IA génère automatiquement une page d'accueil professionnelle adaptée à votre activité. Vous serez redirigé vers votre nouvelle boutique !
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

          {step < 5 ? (
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
  );
};

export default StoreCreationWizard;
