import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, isStoreEnabled } from '../contexts/StoreContext.jsx';
import {
  Check, ArrowRight, ArrowLeft, Loader2, Store, Palette, MapPin,
  Sparkles, MessageSquare, ChevronRight, Zap,
  Globe2, Phone, Upload, X, Wand2, RefreshCw
} from 'lucide-react';
import { storeManageApi, storesApi } from '../services/storeApi.js';
import { storeProductsApi } from '../services/storeApi.js';
import { createEmptyStore } from '../utils/storeDefaults.js';
import { getErrorMessage } from '../utils/errorMessages.js';

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

const BRAND_TONES = [
  { value: 'premium', label: 'Premium', desc: 'Luxe, élégance, raffinement' },
  { value: 'naturel', label: 'Naturel', desc: 'Doux, sincère, authentique' },
  { value: 'dynamique', label: 'Dynamique', desc: 'Énergie, mouvement, impact' },
  { value: 'confiance', label: 'Confiance', desc: 'Sérieux, stabilité, crédibilité' },
  { value: 'tendance', label: 'Tendance', desc: 'Mode, lifestyle, contemporain' },
  { value: 'chaleureux', label: 'Chaleureux', desc: 'Accessible, humain, proche' },
];

const LOGO_VARIANTS = [
  { value: 'wordmark', label: 'Wordmark', desc: 'Le nom de la marque reste central' },
  { value: 'combination', label: 'Combiné', desc: 'Icône + nom lisible et polyvalent' },
  { value: 'emblem', label: 'Emblème', desc: 'Badge compact avec présence premium' },
  { value: 'monogram', label: 'Monogramme', desc: 'Initiales ou signe typographique fort' },
  { value: 'abstract', label: 'Abstrait', desc: 'Symbole moderne, distinctif et épuré' },
];

const LOGO_SYMBOL_STYLES = [
  { value: 'sector', label: 'Adapté au secteur', desc: 'L’icône suit d’abord votre activité' },
  { value: 'minimal', label: 'Minimal', desc: 'Très sobre, peu de traits, très net' },
  { value: 'geometric', label: 'Géométrique', desc: 'Construction précise et moderne' },
  { value: 'organic', label: 'Organique', desc: 'Courbes souples, rendu plus naturel' },
  { value: 'signature', label: 'Signature', desc: 'Éditorial, chic, plus mode' },
  { value: 'bold', label: 'Bold', desc: 'Plus franc, visible, mémorable' },
];

const PRODUCT_TYPE_LOGO_PRESETS = {
  beaute: {
    focus: 'des lignes fines, des pétales, des gouttes ou une silhouette élégante',
    avoid: 'Évitez les icônes beauté trop génériques ou trop cheap.',
  },
  fitness: {
    focus: 'des formes dynamiques, un sentiment de mouvement, de force ou de progression',
    avoid: 'Évitez les haltères clichées sans identité de marque.',
  },
  mode: {
    focus: 'des initiales fortes, des formes couture, un rendu éditorial et premium',
    avoid: 'Évitez les cintres ou sacs shopping trop littéraux.',
  },
  tech: {
    focus: 'des formes géométriques, modulaires, propres et futuristes',
    avoid: 'Évitez les puces électroniques ou éclairs trop stock.',
  },
  maison: {
    focus: 'des volumes rassurants, des lignes d’intérieur, d’équilibre et de confort',
    avoid: 'Évitez les maisons dessinées de manière enfantine.',
  },
  sante: {
    focus: 'la clarté, la confiance, l’équilibre et la sensation de bien-être',
    avoid: 'Évitez les croix médicales trop banales ou trop froides.',
  },
  enfants: {
    focus: 'des formes rondes, joyeuses, rassurantes et lisibles',
    avoid: 'Évitez les mascottes trop chargées ou trop infantiles.',
  },
  autre: {
    focus: 'une identité premium simple, mémorable et polyvalente',
    avoid: 'Évitez les icônes ecommerce génériques type panier ou curseur.',
  },
};

const STEPS = [
  { num: 1, title: 'Votre boutique', subtitle: 'Nom, URL et catégorie' },
  { num: 2, title: 'Direction visuelle', subtitle: 'Style, ton et couleurs' },
  { num: 3, title: 'Votre logo', subtitle: 'Génération ou import' },
  { num: 4, title: 'Finalisez', subtitle: 'Coordonnées et création' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS UI
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_GENERATION_STEPS = [
  { key: 'subdomain', label: 'Création de votre boutique' },
  { key: 'config', label: 'Enregistrement de vos informations' },
  { key: 'theme', label: 'Application du thème' },
  { key: 'homepage', label: "Génération de la page d'accueil par l'IA" },
  { key: 'images', label: 'Création des visuels personnalisés' },
  { key: 'verification', label: 'Vérification finale de la boutique' },
  { key: 'done', label: 'Votre boutique est prête !' },
];

const getGenerationSteps = ({ includeLogoStep = false } = {}) => {
  if (!includeLogoStep) return BASE_GENERATION_STEPS;

  return [
    BASE_GENERATION_STEPS[0],
    BASE_GENERATION_STEPS[1],
    BASE_GENERATION_STEPS[2],
    { key: 'logo', label: 'Application du logo' },
    ...BASE_GENERATION_STEPS.slice(3),
  ];
};

const LOGO_GENERATION_MESSAGES = [
  'Analyse du nom de boutique...',
  'Construction de la direction visuelle...',
  'Generation du logo IA en cours...',
  'Finalisation et optimisation du rendu...',
];

const GenerationOverlay = ({ currentStep, storeName, logoUrl, includeLogoStep = false }) => {
  const generationSteps = getGenerationSteps({ includeLogoStep });
  const currentIdx = generationSteps.findIndex((step) => step.key === currentStep);
  const safeCurrentIdx = currentIdx >= 0 ? currentIdx : 0;
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
            {currentStep === 'done' ? '🎉 Boutique créée !' : isLogoStep ? '🖼️ Préparation du logo...' : 'Création en cours...'}
          </h2>
          <p className="text-gray-400 text-sm">
            {currentStep === 'done'
              ? `${storeName || 'Votre boutique'} est prête`
              : isLogoStep
                ? 'Nous ajoutons votre logo à la boutique'
              : "L'IA construit votre boutique sur mesure"}
          </p>
        </div>

        <div className="space-y-3">
          {generationSteps.map((step, idx) => {
            const isDone = idx < safeCurrentIdx || currentStep === 'done';
            const isActive = idx === safeCurrentIdx && currentStep !== 'done';

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
                style={{ width: `${Math.max(5, ((safeCurrentIdx + 0.5) / generationSteps.length) * 100)}%` }}
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
  const { stores, loading: storesLoading, refreshStores, switchStore } = useStore();
  const [searchParams] = useSearchParams();
  const isResetMode = searchParams.get('reset') === 'true';
  // "nouvelle" mode = creating a new additional store (not editing the primary)
  const isNewStoreMode = searchParams.get('mode') === 'new' || window.location.pathname.includes('/boutique/nouvelle');

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState('');
  const [generationStep, setGenerationStep] = useState(null); // key from getGenerationSteps()
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
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
    tone: 'premium',
    logoVariant: 'wordmark',
    logoSymbolStyle: 'sector',
    logoConcept: '',
  });

  const [subdomainStatus, setSubdomainStatus] = useState(null);
  const [originalSubdomain, setOriginalSubdomain] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [generatedLogo, setGeneratedLogo] = useState(null);
  const [logoGenerating, setLogoGenerating] = useState(false);
  const [logoGenerationMessageIdx, setLogoGenerationMessageIdx] = useState(0);
  const [logoGenerationElapsedSec, setLogoGenerationElapsedSec] = useState(0);
  const [generationLogoUrl, setGenerationLogoUrl] = useState(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!logoGenerating) {
      setLogoGenerationMessageIdx(0);
      setLogoGenerationElapsedSec(0);
      return;
    }

    const startedAt = Date.now();
    const ticker = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setLogoGenerationElapsedSec(elapsed);
      setLogoGenerationMessageIdx(Math.min(LOGO_GENERATION_MESSAGES.length - 1, Math.floor(elapsed / 6)));
    }, 1000);

    return () => clearInterval(ticker);
  }, [logoGenerating]);

  // ── Charger données existantes ────────────────────────────────────────────────
  const initDoneRef = useRef(false);
  useEffect(() => {
    if (storesLoading) return;

    const hasAccessibleStore = stores.some(isStoreEnabled);
    if (!isNewStoreMode && !isResetMode && hasAccessibleStore) {
      navigate('/ecom/boutique', { replace: true });
    }
  }, [isNewStoreMode, isResetMode, navigate, stores, storesLoading]);

  useEffect(() => {
    // Wait for StoreContext to finish loading before deciding
    if (storesLoading) return;
    // Run only once
    if (initDoneRef.current) return;
    initDoneRef.current = true;

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
            tone: s.tone || 'premium',
            logoVariant: s.logoVariant || 'wordmark',
            logoSymbolStyle: s.logoSymbolStyle || 'sector',
            logoConcept: s.logoConcept || '',
          }));
          if (s.storeLogo) setLogoPreview(s.storeLogo);
          setSubdomainStatus('available');
          // Only treat as "edit mode" if the homepage was already AI-generated.
          // Otherwise the wizard must still run homepage generation on submit.
          if (data.hasHomepage) setIsEditMode(true);
          // Returning user with partial data → skip intro, go straight to form
          setShowIntro(false);
        }
        if (isNewStoreMode || isResetMode) setShowIntro(false);
      } catch (err) {
        console.log('Pas de boutique existante');
      } finally {
        setLoading(false);
      }
    };
    loadExisting();
  }, [isNewStoreMode, isResetMode, navigate, stores.length, storesLoading]);

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

  const selectedProductType = PRODUCT_TYPES.find((type) => type.value === form.productType) || null;
  const selectedTone = BRAND_TONES.find((item) => item.value === form.tone) || BRAND_TONES[0];
  const selectedLogoVariant = LOGO_VARIANTS.find((item) => item.value === form.logoVariant) || LOGO_VARIANTS[0];
  const selectedLogoSymbolStyle = LOGO_SYMBOL_STYLES.find((item) => item.value === form.logoSymbolStyle) || LOGO_SYMBOL_STYLES[0];
  const sectorPreset = PRODUCT_TYPE_LOGO_PRESETS[form.productType] || PRODUCT_TYPE_LOGO_PRESETS.autre;
  const isGeneratedLogoOutdated = Boolean(generatedLogo?.url) && (
    (generatedLogo.variant || 'wordmark') !== form.logoVariant ||
    (generatedLogo.tone || 'premium') !== form.tone ||
    (generatedLogo.symbolStyle || 'sector') !== form.logoSymbolStyle ||
    String(generatedLogo.concept || '').trim() !== String(form.logoConcept || '').trim() ||
    (generatedLogo.productType || '') !== (form.productType || '') ||
    (generatedLogo.themeColor || '') !== form.themeColor
  );

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
        setGenerationLogoUrl(null);
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
    setGenerationLogoUrl(null);
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
    setGeneratedLogo(null);
    try {
      const res = await storeManageApi.generateLogos({
        storeName: form.storeName,
        productType: form.productType,
        themeColor: form.themeColor,
        tone: form.tone,
        variant: form.logoVariant,
        symbolStyle: form.logoSymbolStyle,
        concept: form.logoConcept,
      });
      const logo = res.data?.data || null;
      setGeneratedLogo(logo ? { ...logo, themeColor: form.themeColor } : null);
      if (logo?.url) {
        setGenerationLogoUrl(logo.url);
        set('storeLogo', logo.url);
        setLogoPreview(logo.url);
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, storeLogo: error.response?.data?.message || 'La generation du logo a echoue. Verifiez la connexion et reessayez.' }));
    } finally {
      setLogoGenerating(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────────
  const validate = (skipping = false) => {
    const e = {};
    if (step === 1) {
      if (!form.storeName.trim()) e.storeName = 'Donnez un nom à votre boutique';
      if (!form.subdomain || form.subdomain.length < 3) e.subdomain = 'Sous-domaine: 3 caractères minimum';
      if (subdomainStatus === 'taken') e.subdomain = 'Ce sous-domaine est déjà utilisé';
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
    let redirectToBoutique = false;
    setSaving(true);
    setGenerationLogoUrl(form.storeLogo || null);
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
        tone: form.tone,
        logoVariant: form.logoVariant,
        logoSymbolStyle: form.logoSymbolStyle,
        logoConcept: form.logoConcept,
        city: form.city,
        country: form.country,
      });

      // Étape 3 : Thème
      setGenerationStep('theme');
      try {
        await storeManageApi.updateTheme({ ...emptyStore.theme, primaryColor: form.themeColor });
      } catch {}

      // Étape 3.5 : appliquer le logo seulement s'il a été choisi explicitement
      if (form.storeLogo) {
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

      redirectToBoutique = true;
      navigate('/ecom/boutique', { replace: true });
      return;
    } catch (err) {
      setErrors({ submit: getErrorMessage(err, 'Impossible de créer la boutique.') });
    } finally {
      if (!redirectToBoutique) {
        setSaving(false);
        setSavingStep('');
        setGenerationStep(null);
      }
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // ÉCRAN D'INTRO — oblige l'utilisateur à cliquer pour lancer l'assistant IA
  // ═══════════════════════════════════════════════════════════════════════════════
  if (showIntro) {
    return (
      <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f7fbf9_100%)] px-6 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center">
          <div className="w-full">
            <div className="relative overflow-hidden rounded-[32px] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(60,64,67,0.16),0_8px_24px_rgba(60,64,67,0.10)]">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-50 blur-3xl" />
              <div className="absolute bottom-8 right-8 h-3 w-3 rounded-full bg-scalor-green" />
              <div className="relative p-8 sm:p-10 lg:p-12">
                <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-scalor-green">
                    <Wand2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Assistant boutique</span>
                </div>

                <div className="mt-10 max-w-3xl">
                  <p className="text-sm font-medium text-scalor-green">Configuration guidée</p>
                  <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.45rem] lg:leading-[1.04]">
                    Créez une boutique claire, rapide et prête à publier.
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                    L'assistant installe l'essentiel de votre boutique avec une mise en place propre et légère.
                    Vous partez d'une base crédible, puis vous ajustez librement le contenu, le style et les détails.
                  </p>
                </div>

                <div className="mt-10 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: 'Identité',
                      value: 'Nom, URL et catégorie',
                    },
                    {
                      label: 'Visuel',
                      value: 'Direction créative puis logo',
                    },
                    {
                      label: 'Départ',
                      value: 'Prise en main en 2 minutes',
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-slate-200 bg-[#fbfcfe] p-4">
                      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-scalor-green">
                        {item.label}
                      </span>
                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setShowIntro(false)}
                    className="inline-flex items-center justify-center gap-3 rounded-full bg-scalor-green px-7 py-3.5 text-base font-semibold text-white transition hover:bg-scalor-green-dark"
                  >
                    <Wand2 className="h-5 w-5" />
                    Commencer
                    <ArrowRight className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/ecom/dashboard')}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Retour au dashboard
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-scalor-green" />
                    Base modifiable à tout moment
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-scalor-green" />
                    Mise en place sans surcharge visuelle
                  </div>
                </div>
              </div>
            </div>
          </div>
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
      {generationStep && (
        <GenerationOverlay
          currentStep={generationStep}
          storeName={form.storeName}
          logoUrl={generationLogoUrl || logoPreview}
          includeLogoStep={Boolean(form.storeLogo)}
        />
      )}

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
                <label className="block text-sm font-semibold text-gray-800">Votre sous-domaine</label>
                <div className="flex items-stretch bg-gray-50 rounded-xl border-2 border-transparent focus-within:border-gray-900 focus-within:bg-white transition-all">
                  <input
                    type="text"
                    value={form.subdomain}
                    onChange={e => set('subdomain', slugify(e.target.value))}
                    placeholder="ma-boutique"
                    className="flex-1 px-4 py-3.5 bg-transparent text-sm font-mono font-medium focus:outline-none"
                  />
                  <span className="flex items-center px-4 text-gray-400 text-sm font-mono bg-gray-100 border-l border-gray-200">
                    .scalor.net
                  </span>
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
        {/* ÉTAPE 2 : Direction visuelle */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl shadow-lg shadow-pink-500/30 mb-2">
                <Palette className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Définissez votre direction créative</h1>
              <p className="text-gray-500">Cadrez ici le style du logo et la couleur principale. La génération ou l'import du logo se feront à l'étape suivante.</p>
            </div>

            <Card className="p-6 space-y-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Direction adaptée à votre activité</p>
                <p className="mt-1 text-xs text-emerald-700 leading-5">
                  {selectedProductType
                    ? `Pour ${selectedProductType.label}, l'IA privilégiera ${sectorPreset.focus}. ${sectorPreset.avoid}`
                    : `Choisissez une catégorie à l'étape précédente pour guider encore mieux le logo. Sans secteur renseigné, la génération restera plus générique.`}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-gray-800">Type de logo</label>
                  <span className="text-xs text-gray-500">Choix actuel: {selectedLogoVariant.label}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {LOGO_VARIANTS.map((variant) => (
                    <SelectableCard
                      key={variant.value}
                      selected={form.logoVariant === variant.value}
                      onClick={() => set('logoVariant', variant.value)}
                    >
                      <p className="text-sm font-bold text-gray-900">{variant.label}</p>
                      <p className="mt-1 text-xs text-gray-500">{variant.desc}</p>
                    </SelectableCard>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-gray-800">Ton de marque</label>
                  <span className="text-xs text-gray-500">Choix actuel: {selectedTone.label}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {BRAND_TONES.map((tone) => (
                    <SelectableCard
                      key={tone.value}
                      selected={form.tone === tone.value}
                      onClick={() => set('tone', tone.value)}
                    >
                      <p className="text-sm font-bold text-gray-900">{tone.label}</p>
                      <p className="mt-1 text-xs text-gray-500">{tone.desc}</p>
                    </SelectableCard>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-gray-800">Style du symbole</label>
                  <span className="text-xs text-gray-500">Choix actuel: {selectedLogoSymbolStyle.label}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {LOGO_SYMBOL_STYLES.map((style) => (
                    <SelectableCard
                      key={style.value}
                      selected={form.logoSymbolStyle === style.value}
                      onClick={() => set('logoSymbolStyle', style.value)}
                    >
                      <p className="text-sm font-bold text-gray-900">{style.label}</p>
                      <p className="mt-1 text-xs text-gray-500">{style.desc}</p>
                    </SelectableCard>
                  ))}
                </div>
              </div>

              <Input
                label="Symbole ou idée à intégrer"
                hint="Optionnel. Exemple: feuille, éclair, couronne, monogramme GM, pétale minimal..."
                placeholder="Ex: feuille premium, éclair géométrique, double initiale"
                value={form.logoConcept}
                onChange={e => set('logoConcept', e.target.value)}
                icon={Wand2}
              />

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

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">Direction retenue</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[selectedLogoVariant.label, selectedTone.label, selectedLogoSymbolStyle.label].map((badge) => (
                    <span key={badge} className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-600 border border-gray-200">
                      {badge}
                    </span>
                  ))}
                  {selectedProductType && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      {selectedProductType.label}
                    </span>
                  )}
                </div>
                {form.logoConcept.trim() && (
                  <p className="mt-3 text-xs text-gray-600">
                    Idée intégrée: <span className="font-semibold text-gray-800">{form.logoConcept.trim()}</span>
                  </p>
                )}
              </div>

            </Card>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">La création du logo est maintenant une étape séparée.</p>
              <p className="mt-1 text-xs text-emerald-700">Vous définissez ici la direction créative et la couleur principale. À l'étape suivante, vous pourrez générer une proposition IA ou importer votre propre logo.</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 3 : Logo */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-900 to-emerald-700 rounded-2xl shadow-lg shadow-gray-900/20 mb-2">
                <Wand2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Créez ou importez votre logo</h1>
              <p className="text-gray-500">Cette étape reste optionnelle. Générez une proposition IA avec la direction choisie, ou ajoutez directement votre propre fichier.</p>
            </div>

            <Card className="p-6 space-y-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Direction active pour le logo</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[selectedLogoVariant.label, selectedTone.label, selectedLogoSymbolStyle.label].map((badge) => (
                    <span key={badge} className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 border border-emerald-100">
                      {badge}
                    </span>
                  ))}
                  {selectedProductType && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      {selectedProductType.label}
                    </span>
                  )}
                </div>
                {form.logoConcept.trim() && (
                  <p className="mt-3 text-xs text-emerald-700">
                    Idée à intégrer: <span className="font-semibold text-emerald-900">{form.logoConcept.trim()}</span>
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-800">Logo de votre boutique</label>
                <p className="text-xs text-gray-500">Cliquez pour générer une proposition IA avec cette direction, ou importez votre logo. Vous pouvez passer cette étape si vous souhaitez finaliser la boutique sans logo.</p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleGenerateLogo}
                    disabled={logoGenerating || !form.storeName.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {logoGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {logoGenerating
                      ? 'Generation en cours...'
                      : generatedLogo?.url && isGeneratedLogoOutdated
                        ? 'Relancer avec la nouvelle direction'
                        : generatedLogo?.url
                          ? 'Regenerer le logo IA'
                          : 'Generer mon logo IA'}
                  </button>
                  {generatedLogo?.url && (
                    <button
                      type="button"
                      onClick={() => {
                        setGeneratedLogo(null);
                        setGenerationLogoUrl(null);
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

                {isGeneratedLogoOutdated && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">La direction a changé depuis la dernière génération.</p>
                    <p className="mt-1 text-xs text-amber-700">Relancez la génération pour obtenir une proposition alignée avec les réglages actuels.</p>
                  </div>
                )}

                {logoGenerating && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                        <Wand2 className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-emerald-900">Creation du logo IA</p>
                        <p className="text-xs text-emerald-700 mt-1">{LOGO_GENERATION_MESSAGES[logoGenerationMessageIdx]}</p>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden">
                          <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '65%' }} />
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-2">
                          Temps ecoule: {logoGenerationElapsedSec}s. Le resultat sera affiche automatiquement des qu'il est pret.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {generatedLogo?.url && (
                  <div className="rounded-2xl border-2 border-gray-200 overflow-hidden bg-white">
                    <div className="aspect-square bg-gray-50 p-6 flex items-center justify-center">
                      <img src={generatedLogo.url} alt="Logo IA généré" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-800">Logo IA généré</p>
                        <p className="text-[11px] text-gray-500">
                          {(LOGO_VARIANTS.find((item) => item.value === (generatedLogo.variant || form.logoVariant)) || selectedLogoVariant).label}
                          {selectedProductType ? ` · ${selectedProductType.label}` : ''}
                          {isGeneratedLogoOutdated ? ' · direction modifiée' : ''}
                        </p>
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
                        onClick={(e) => { e.preventDefault(); setGenerationLogoUrl(null); setLogoPreview(null); set('storeLogo', ''); }}
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
            </Card>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Le logo reste optionnel.</p>
              <p className="mt-1 text-xs text-gray-600">Si vous passez cette étape, la boutique sera créée sans logo et vous pourrez en ajouter un plus tard depuis les réglages.</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 4 : Finalisation */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 4 && (
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
            {step === 3 && (
              <button
                onClick={skip}
                className="px-5 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 transition"
              >
                Passer le logo
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
