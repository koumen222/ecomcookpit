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
  { value: 'sector', label: 'Adapté au secteur', desc: "L'icône suit d'abord votre activité" },
  { value: 'minimal', label: 'Minimal', desc: 'Très sobre, peu de traits, très net' },
  { value: 'geometric', label: 'Géométrique', desc: 'Construction précise et moderne' },
  { value: 'organic', label: 'Organique', desc: 'Courbes souples, rendu plus naturel' },
  { value: 'signature', label: 'Signature', desc: 'Éditorial, chic, plus mode' },
  { value: 'bold', label: 'Bold', desc: 'Plus franc, visible, mémorable' },
];

const LOGO_FLOW_OPTIONS = [
  {
    value: 'upload',
    label: "Oui, j'ai déjà un logo",
    desc: "Étape suivante: import de votre logo existant",
  },
  {
    value: 'generate',
    label: 'Non, je veux une proposition IA',
    desc: "Étape suivante: génération guidée avec votre direction créative",
  },
  {
    value: 'later',
    label: 'Pas maintenant',
    desc: "Étape suivante: le logo restera optionnel et vous pourrez passer",
  },
];

const PRODUCT_TYPE_LOGO_PRESETS = {
  beaute: {
    focus: 'des lignes fines, des pétales, des gouttes ou une silhouette élégante',
    avoid: "Évitez les icônes beauté trop génériques ou trop cheap.",
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
    focus: "des volumes rassurants, des lignes d'intérieur, d'équilibre et de confort",
    avoid: 'Évitez les maisons dessinées de manière enfantine.',
  },
  sante: {
    focus: "la clarté, la confiance, l'équilibre et la sensation de bien-être",
    avoid: "Évitez les croix médicales trop banales ou trop froides.",
  },
  enfants: {
    focus: 'des formes rondes, joyeuses, rassurantes et lisibles',
    avoid: 'Évitez les mascottes trop chargées ou trop infantiles.',
  },
  autre: {
    focus: "une identité premium simple, mémorable et polyvalente",
    avoid: "Évitez les icônes ecommerce génériques type panier ou curseur.",
  },
};

const STEPS = [
  { num: 1, title: 'Votre boutique', subtitle: 'Nom, URL et catégorie' },
  { num: 2, title: 'Direction visuelle', subtitle: 'Style, ton et couleurs' },
  { num: 3, title: 'Votre logo', subtitle: 'Génération ou import' },
  { num: 4, title: 'Finalisez', subtitle: 'Coordonnées et devise' },
  { num: 5, title: 'Vérification', subtitle: 'Aperçu et création' },
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
  const title = currentStep === 'done'
    ? "Votre boutique est prête"
    : isLogoStep
      ? 'Application du logo'
      : 'Création en cours...';
  const subtitle = currentStep === 'done'
    ? `${storeName || 'Votre boutique'} est prête à être utilisée.`
    : isLogoStep
      ? "Nous intégrons votre logo dans l'identité de la boutique."
      : "L'IA construit votre boutique sur mesure.";

  return (
    <div className="fixed inset-0 z-[100] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbf9_100%)] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl rounded-[32px] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(60,64,67,0.16),0_12px_36px_rgba(60,64,67,0.12)] overflow-hidden">
        <div className="relative border-b border-slate-100 px-8 py-10 sm:px-10">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-50 blur-3xl" />
          <div className="absolute bottom-8 right-10 h-3 w-3 rounded-full bg-primary-500/70" />
          <div className="relative text-center">
          {/* Show logo preview during logo step */}
          {isLogoStep && logoUrl ? (
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl overflow-hidden bg-white shadow-[0_12px_30px_rgba(15,107,79,0.14)] flex items-center justify-center p-3 border border-primary-100">
              <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            </div>
          ) : isLogoStep && !logoUrl ? (
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary-500 to-teal-600 flex items-center justify-center shadow-[0_14px_30px_rgba(15,107,79,0.22)]">
              <Wand2 className="w-10 h-10 text-white animate-pulse" />
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary-500 to-teal-600 flex items-center justify-center shadow-[0_14px_30px_rgba(15,107,79,0.22)]">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          )}
            <h2 className="text-3xl font-black tracking-tight text-slate-950 mb-2">
              {title}
            </h2>
            <p className="mx-auto max-w-lg text-sm leading-6 text-slate-500">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-8">
          <div className="space-y-3">
          {generationSteps.map((step, idx) => {
            const isDone = idx < safeCurrentIdx || currentStep === 'done';
            const isActive = idx === safeCurrentIdx && currentStep !== 'done';

            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-500 ${
                  isDone
                    ? 'border-primary-100 bg-primary-50'
                    : isActive
                      ? 'border-slate-200 bg-slate-50 shadow-[0_8px_22px_rgba(15,23,42,0.05)]'
                      : 'border-slate-100 bg-white'
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isDone
                    ? 'bg-primary-500 text-white'
                    : isActive
                      ? 'bg-primary-50 border-2 border-primary-400'
                      : 'bg-slate-100 text-slate-400'
                }`}>
                  {isDone ? (
                    <Check className="w-4 h-4" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                  )}
                </div>
                <span className={`text-sm font-semibold transition-colors duration-300 ${
                  isDone ? 'text-primary-700' : isActive ? 'text-slate-900' : 'text-slate-500'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
          </div>

          {currentStep !== 'done' && (
            <div className="mt-8">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-teal-500 transition-all duration-700 ease-out"
                style={{ width: `${Math.max(5, ((safeCurrentIdx + 0.5) / generationSteps.length) * 100)}%` }}
              />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>Progression de la création</span>
                <span>Cela peut prendre 30 à 60 secondes</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProgressBar = ({ current, total }) => (
  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-primary-500 to-teal-500 transition-all duration-700 ease-out"
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
          ${current > s.num ? 'bg-primary-500 text-white scale-90' : ''}
          ${current === s.num ? 'bg-primary-700 text-white ring-4 ring-gray-900/20 scale-110' : ''}
          ${current < s.num ? 'bg-gray-100 text-gray-400' : ''}
        `}>
          {current > s.num ? <Check className="w-4 h-4" /> : s.num}
        </div>
        {i < steps.length - 1 && (
          <div className={`w-8 h-0.5 mx-1 transition-colors duration-300 ${current > s.num ? 'bg-primary-500' : 'bg-gray-200'}`} />
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
        ? 'border-primary-700 bg-primary-50 shadow-lg shadow-primary-200/50'
        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
      }
      ${className}
    `}
  >
    {selected && (
      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-700 rounded-full flex items-center justify-center shadow-lg">
        <Check className="w-3.5 h-3.5 text-white" />
      </div>
    )}
    {children}
  </button>
);

const AccordionSection = ({ title, description, open, onToggle, children }) => (
  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-start justify-between gap-4 px-4 py-4 text-left hover:bg-gray-50 transition"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      </div>
      <ArrowRight className={`w-4 h-4 mt-0.5 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
    </button>
    {open && <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/60">{children}</div>}
  </div>
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
          focus:outline-none focus:bg-white focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10
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
        focus:outline-none focus:bg-white focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10
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
    logoFlowChoice: 'generate',
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

    // Max 3 stores -- block creation if limit reached
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
            logoFlowChoice: s.storeLogo ? 'upload' : 'generate',
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
  const selectedLogoFlowOption = LOGO_FLOW_OPTIONS.find((item) => item.value === form.logoFlowChoice) || LOGO_FLOW_OPTIONS[1];
  const sectorPreset = PRODUCT_TYPE_LOGO_PRESETS[form.productType] || PRODUCT_TYPE_LOGO_PRESETS.autre;
  const showCreativeAccordion = form.logoFlowChoice === 'generate';
  const showUploadAccordion = form.logoFlowChoice === 'upload';
  const showLaterAccordion = form.logoFlowChoice === 'later';
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
      // productType is optional -- defaults will be used
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
          // Silently continue -- the backend fallback sections are already saved,
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
  // ÉCRAN D'INTRO -- oblige l'utilisateur à cliquer pour lancer l'assistant IA
  // ═══════════════════════════════════════════════════════════════════════════════
  if (showIntro) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
          <section className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid lg:grid-cols-[1.12fr_0.88fr]">
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-scalor-green">
                  <Wand2 className="h-4 w-4" />
                  Assistant boutique
                </div>

                <div className="mt-8 max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Configuration guidée
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    Créez une boutique prête à vendre
                  </h1>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                    Configurez l'identité, le visuel et les informations essentielles en quelques minutes.
                    Vous pourrez tout ajuster avant publication.
                  </p>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setShowIntro(false)}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-scalor-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-scalor-green-dark"
                  >
                    Commencer la configuration
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/ecom/dashboard')}
                    className="inline-flex min-h-[46px] items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Retour au dashboard
                  </button>
                </div>
              </div>

              <aside className="border-t border-slate-200 bg-slate-50/70 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
                <p className="text-sm font-semibold text-slate-900">Ce que l'assistant prépare</p>

                <div className="mt-5 divide-y divide-slate-200">
                  {[
                    {
                      icon: Store,
                      label: 'Identité',
                      value: 'Nom, URL et catégorie',
                    },
                    {
                      icon: Palette,
                      label: 'Visuel',
                      value: 'Direction créative et logo',
                    },
                    {
                      icon: Zap,
                      label: 'Lancement',
                      value: 'Base prête à finaliser',
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-scalor-green ring-1 ring-slate-200">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                          <p className="mt-0.5 text-sm text-slate-600">{item.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 text-scalor-green" />
                  Base modifiable à tout moment
                </div>
              </aside>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDU PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-white flex">
      {/* Generation overlay */}
      {generationStep && (
        <GenerationOverlay
          currentStep={generationStep}
          storeName={form.storeName}
          logoUrl={generationLogoUrl || logoPreview}
          includeLogoStep={Boolean(form.storeLogo)}
        />
      )}

      {/* ── Left step rail (desktop) ── */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-gray-100 sticky top-0 h-screen bg-slate-50/60">
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Scalor</p>
          <p className="mt-0.5 text-sm font-bold text-gray-900">
            {isEditMode ? 'Modifier la boutique' : 'Nouvelle boutique'}
          </p>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          {STEPS.map(s => {
            const done = step > s.num;
            const active = step === s.num;
            const locked = step < s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => done && setStep(s.num)}
                disabled={locked}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  active
                    ? 'bg-white border border-gray-200 shadow-sm'
                    : done
                      ? 'hover:bg-white/80 cursor-pointer'
                      : 'opacity-40 cursor-default'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  done || active ? 'bg-primary-700 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {done ? <Check className="w-2.5 h-2.5" /> : s.num}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm leading-5 font-semibold truncate ${!locked ? 'text-gray-900' : 'text-gray-400'}`}>
                    {s.title}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">{s.subtitle}</p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
          <button
            type="button"
            onClick={() => navigate('/ecom/boutique')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quitter
          </button>
          {isEditMode && !isResetMode && (
            <button
              type="button"
              onClick={() => navigate('/ecom/boutique/wizard?reset=true')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:text-red-700 hover:bg-red-50 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Repartir à zéro
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div ref={containerRef} className="flex-1 flex flex-col min-h-screen overflow-auto bg-slate-50/50">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => navigate('/ecom/boutique')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Quitter
            </button>
            <p className="text-xs font-bold text-gray-900">Étape {step}/{STEPS.length}</p>
            <div className="w-14" />
          </div>
          <div className="h-0.5 bg-gray-100">
            <div className="h-full bg-primary-700 transition-all duration-500" style={{ width: `${(step / STEPS.length) * 100}%` }} />
          </div>
        </div>

        {/* Step header */}
        <div className="px-6 lg:px-10 pt-8 pb-2 w-full max-w-5xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
            {isEditMode ? 'Modification' : `Étape ${step} sur ${STEPS.length}`}
          </p>
          <h1 className="mt-1 text-xl font-bold text-gray-950">{STEPS[step - 1].title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{STEPS[step - 1].subtitle}</p>
        </div>

      {/* Step content */}
      <div className="flex-1 px-6 lg:px-10 py-6 pb-28 w-full max-w-5xl mx-auto">

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 1 : Votre boutique */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Identité */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Identité</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">Nom et adresse web</p>
              </div>
              <div className="px-5 py-5 space-y-5">
                <Input
                  label="Nom de la boutique"
                  placeholder="Ex: Glow Beauty, FitLife Store…"
                  value={form.storeName}
                  onChange={e => handleStoreName(e.target.value)}
                  error={errors.storeName}
                  icon={Store}
                  autoFocus
                />
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-800">Adresse (sous-domaine)</label>
                  <div className="flex items-stretch rounded-lg border border-gray-200 bg-gray-50 focus-within:border-primary-600 focus-within:bg-white transition-all overflow-hidden">
                    <input
                      type="text"
                      value={form.subdomain}
                      onChange={e => set('subdomain', slugify(e.target.value))}
                      placeholder="ma-boutique"
                      className="flex-1 px-4 py-3 bg-transparent text-sm font-mono focus:outline-none"
                    />
                    <span className="flex items-center px-4 text-gray-400 text-sm font-mono border-l border-gray-200 bg-gray-100">
                      .scalor.net
                    </span>
                    <span className="flex items-center px-3">
                      {subdomainStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                      {subdomainStatus === 'available' && <Check className="w-4 h-4 text-primary-500" />}
                      {subdomainStatus === 'taken' && <X className="w-4 h-4 text-red-500" />}
                    </span>
                  </div>
                  {errors.subdomain && <p className="text-xs text-red-600">{errors.subdomain}</p>}
                  {subdomainStatus === 'available' && !errors.subdomain && (
                    <p className="text-xs text-primary-600 flex items-center gap-1"><Check className="w-3 h-3" /> Disponible</p>
                  )}
                  {subdomainStatus === 'taken' && (
                    <p className="text-xs text-red-600">Ce sous-domaine est déjà utilisé</p>
                  )}
                </div>
              </div>
            </div>

            {/* Catégorie */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Catégorie</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">Que vendez-vous ?</p>
              </div>
              <div className="px-5 py-5">
                {errors.productType && <p className="mb-3 text-xs text-red-600">{errors.productType}</p>}
                <div className="grid gap-2 sm:grid-cols-2">
                  {PRODUCT_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => set('productType', type.value)}
                      className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                        form.productType === type.value
                          ? 'border-primary-700 bg-primary-700 text-white'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {form.productType === type.value && (
                        <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold leading-5 ${form.productType === type.value ? 'text-white' : 'text-gray-900'}`}>{type.label}</p>
                        <p className={`text-xs mt-0.5 ${form.productType === type.value ? 'text-white/70' : 'text-gray-500'}`}>{type.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 2 : Direction visuelle */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Ton de marque */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Identité</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">Ton de marque</p>
                <p className="mt-1 text-xs text-gray-500">{selectedTone.desc}</p>
              </div>
              <div className="px-5 py-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BRAND_TONES.map((tone) => {
                    const sel = form.tone === tone.value;
                    return (
                      <button
                        key={tone.value}
                        type="button"
                        onClick={() => set('tone', tone.value)}
                        className={`flex flex-col gap-0.5 p-3 rounded-lg border text-left transition-all ${
                          sel
                            ? 'border-primary-700 bg-primary-700 text-white'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`text-sm font-semibold ${sel ? 'text-white' : 'text-gray-900'}`}>{tone.label}</span>
                        <span className={`text-xs ${sel ? 'text-white/70' : 'text-gray-500'}`}>{tone.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Couleur principale */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Couleur</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">Couleur principale</p>
                </div>
                <span className="text-xs font-medium text-gray-500">{COLORS.find((c) => c.value === form.themeColor)?.name || form.themeColor}</span>
              </div>
              <div className="px-5 py-5">
                <div className="flex flex-wrap gap-3 items-center">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.name}
                      onClick={() => set('themeColor', c.value)}
                      className={`relative w-9 h-9 rounded-lg transition-all ${
                        form.themeColor === c.value ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                    >
                      {form.themeColor === c.value && (
                        <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                  <label className="relative w-9 h-9 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-gray-300 transition hover:border-gray-400 flex items-center justify-center" title="Couleur personnalisée">
                    <input
                      type="color"
                      value={form.themeColor}
                      onChange={e => set('themeColor', e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Palette className="w-4 h-4 text-gray-400 pointer-events-none" />
                  </label>
                </div>
                {/* Live preview strip */}
                <div className="mt-5 rounded-lg overflow-hidden border border-gray-100">
                  <div className="h-2" style={{ backgroundColor: form.themeColor }} />
                  <div className="bg-white px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: form.themeColor }}>
                      {(form.storeName || 'B').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{form.storeName || 'Votre boutique'}</p>
                      <p className="text-xs text-gray-400 truncate">{selectedProductType?.label || 'Boutique'}</p>
                    </div>
                    <button className="px-3 py-1.5 rounded-md text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: form.themeColor }}>
                      Commander
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Logo -- choix rapide */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Logo</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">Avez-vous un logo ?</p>
              </div>
              <div className="px-5 py-5">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { value: 'upload', label: "J'en ai un", sub: 'Import fichier' },
                    { value: 'generate', label: "Non, générer", sub: 'Logo IA' },
                    { value: 'later', label: "Plus tard", sub: 'Passer' },
                  ].map(opt => {
                    const sel = form.logoFlowChoice === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set('logoFlowChoice', opt.value)}
                        className={`flex flex-col gap-0.5 p-3 rounded-lg border text-center transition-all ${
                          sel
                            ? 'border-primary-700 bg-primary-700 text-white'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`text-sm font-semibold ${sel ? 'text-white' : 'text-gray-900'}`}>{opt.label}</span>
                        <span className={`text-xs ${sel ? 'text-white/70' : 'text-gray-500'}`}>{opt.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 3 : Logo */}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-5">

            {/* Direction IA — 2 colonnes */}
            {form.logoFlowChoice === 'generate' && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Direction IA</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">Style du logo</p>
                </div>
                <div className="p-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    {/* Colonne gauche: Type */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</p>
                      <div className="space-y-1.5">
                        {LOGO_VARIANTS.map((variant) => {
                          const sel = form.logoVariant === variant.value;
                          return (
                            <button
                              key={variant.value}
                              type="button"
                              onClick={() => set('logoVariant', variant.value)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                                sel ? 'border-primary-700 bg-primary-700' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sel ? 'bg-white' : 'bg-gray-300'}`} />
                              <div className="min-w-0">
                                <p className={`text-xs font-semibold leading-4 ${sel ? 'text-white' : 'text-gray-900'}`}>{variant.label}</p>
                                <p className={`text-[10px] leading-4 truncate ${sel ? 'text-white/60' : 'text-gray-400'}`}>{variant.desc}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Colonne droite: Style symbole */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Symbole</p>
                      <div className="space-y-1.5">
                        {LOGO_SYMBOL_STYLES.map((style) => {
                          const sel = form.logoSymbolStyle === style.value;
                          return (
                            <button
                              key={style.value}
                              type="button"
                              onClick={() => set('logoSymbolStyle', style.value)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                                sel ? 'border-primary-700 bg-primary-700' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sel ? 'bg-white' : 'bg-gray-300'}`} />
                              <div className="min-w-0">
                                <p className={`text-xs font-semibold leading-4 ${sel ? 'text-white' : 'text-gray-900'}`}>{style.label}</p>
                                <p className={`text-[10px] leading-4 truncate ${sel ? 'text-white/60' : 'text-gray-400'}`}>{style.desc}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {/* Idée libre */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <Input
                      label="Idée libre (optionnel)"
                      hint="Symbole, initiales, objet, signe distinctif"
                      placeholder="Ex: feuille, monogramme GL, eclair geometrique"
                      value={form.logoConcept}
                      onChange={e => set('logoConcept', e.target.value)}
                      icon={Wand2}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Générer + résultat */}
            {/* Génération + Upload en 2 colonnes */}
            {form.logoFlowChoice === 'generate' && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="grid divide-y divide-gray-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                  {/* Colonne gauche: Générer */}
                  <div className="p-5 space-y-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Génération IA</p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-900">Créer le logo</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateLogo}
                      disabled={logoGenerating || !form.storeName.trim()}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-700 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      {logoGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      {logoGenerating ? 'En cours...' : generatedLogo?.url ? 'Regénérer' : 'Générer'}
                    </button>

                    {logoGenerating && (
                      <div className="rounded-lg bg-gray-50 px-3 py-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{LOGO_GENERATION_MESSAGES[logoGenerationMessageIdx]}</p>
                          <p className="text-[10px] text-gray-500">{logoGenerationElapsedSec}s</p>
                        </div>
                      </div>
                    )}

                    {isGeneratedLogoOutdated && !logoGenerating && (
                      <p className="text-[10px] text-amber-600 font-semibold">Direction modifiée -- regénérez.</p>
                    )}

                    {generatedLogo?.url && (
                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 p-4 flex items-center justify-center" style={{ minHeight: '120px' }}>
                          <img src={generatedLogo.url} alt="Logo IA" className="max-h-24 max-w-full object-contain" />
                        </div>
                        <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between gap-2">
                          <p className="text-[10px] text-gray-400 truncate">
                            {(LOGO_VARIANTS.find((v) => v.value === (generatedLogo.variant || form.logoVariant)) || selectedLogoVariant).label}
                          </p>
                          <button
                            type="button"
                            onClick={() => { set('storeLogo', generatedLogo.url); setLogoPreview(generatedLogo.url); }}
                            className="px-2.5 py-1 rounded-md bg-primary-700 text-white text-[10px] font-bold shrink-0"
                          >
                            Utiliser
                          </button>
                        </div>
                      </div>
                    )}

                    {generatedLogo?.url && (
                      <button
                        type="button"
                        onClick={() => { setGeneratedLogo(null); setGenerationLogoUrl(null); setLogoPreview(null); set('storeLogo', ''); }}
                        className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Réinitialiser
                      </button>
                    )}

                    {errors.storeLogo && <p className="text-[10px] text-red-600">{errors.storeLogo}</p>}
                  </div>

                  {/* Colonne droite: Upload */}
                  <div className="p-5 space-y-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Fichier</p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-900">Importer un logo</p>
                    </div>
                    <label className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed cursor-pointer transition-all ${
                      logoPreview ? 'border-gray-300 bg-gray-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                    }`} style={{ minHeight: '148px' }}>
                      {logoUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                          <span className="text-xs text-gray-500">Upload...</span>
                        </div>
                      ) : logoPreview ? (
                        <>
                          <img src={logoPreview} alt="Logo" className="max-h-24 max-w-[80%] object-contain" />
                          <button
                            onClick={(e) => { e.preventDefault(); setGenerationLogoUrl(null); setLogoPreview(null); set('storeLogo', ''); }}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center px-3">
                          <Upload className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-xs font-semibold text-gray-700">Glissez ou cliquez</p>
                            <p className="text-[10px] text-gray-400">PNG, JPG, SVG · 5 Mo max</p>
                          </div>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Upload seul si pas generate */}
            {form.logoFlowChoice !== 'generate' && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Fichier</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">
                    {form.logoFlowChoice === 'upload' ? 'Importez votre logo' : 'Importer un logo (optionnel)'}
                  </p>
                </div>
                <div className="px-5 py-5">
                  {errors.storeLogo && <p className="mb-3 text-xs text-red-600">{errors.storeLogo}</p>}
                  <label className={`relative flex flex-col items-center justify-center h-36 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
                    logoPreview ? 'border-gray-300 bg-gray-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }`}>
                    {logoUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="text-sm text-gray-500">Upload en cours...</span>
                      </div>
                    ) : logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Logo" className="max-h-28 max-w-[80%] object-contain" />
                        <button
                          onClick={(e) => { e.preventDefault(); setGenerationLogoUrl(null); setLogoPreview(null); set('storeLogo', ''); }}
                          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <Upload className="w-6 h-6 text-gray-400" />
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Glissez ou cliquez</p>
                          <p className="text-xs text-gray-400">PNG, JPG, SVG · Max 5 Mo</p>
                        </div>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                  </label>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500">Logo optionnel -- cliquez <strong className="text-gray-700">Passer</strong> pour continuer sans logo.</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 4 : Finalisation */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="space-y-5">
            {/* Contact */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Contact</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">Coordonnées</p>
              </div>
              <div className="px-5 py-5 space-y-4">
                <Input
                  label="Numéro WhatsApp"
                  hint="Les clients vous contacteront sur ce numéro"
                  placeholder="+237 6XX XXX XXX"
                  value={form.storeWhatsApp}
                  onChange={e => set('storeWhatsApp', e.target.value)}
                  error={errors.storeWhatsApp}
                  icon={MessageSquare}
                />
                <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            </div>

            {/* Devise */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Finance</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">Devise de vente</p>
              </div>
              <div className="px-5 py-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CURRENCIES.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => set('storeCurrency', c.code)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                        form.storeCurrency === c.code
                          ? 'border-primary-700 bg-primary-700 text-white'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <p className={`text-sm font-bold ${form.storeCurrency === c.code ? 'text-white' : 'text-gray-900'}`}>{c.code}</p>
                      <p className={`text-[11px] mt-0.5 ${form.storeCurrency === c.code ? 'text-white/70' : 'text-gray-500'}`}>{c.region}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Présentation</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">Description <span className="font-normal text-gray-400">(optionnel)</span></p>
              </div>
              <div className="px-5 py-5">
                <Textarea
                  hint="Ce texte apparaîtra sur votre page d'accueil"
                  placeholder="Bienvenue chez nous ! Découvrez notre sélection de produits de qualité…"
                  rows={3}
                  value={form.storeDescription}
                  onChange={e => set('storeDescription', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ÉTAPE 5 : Vérification */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 5 && (
          <div className="space-y-5">
            {/* Aperçu boutique */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: form.themeColor }} />
              <div className="px-5 py-5 flex items-center gap-4">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-12 w-12 object-contain rounded-lg border border-gray-100 p-1" />
                ) : (
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-black text-white flex-shrink-0" style={{ backgroundColor: form.themeColor }}>
                    {form.storeName?.[0]?.toUpperCase() || 'S'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-gray-950 truncate">{form.storeName || 'Ma Boutique'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{PRODUCT_TYPES.find(p => p.value === form.productType)?.label || '--'}</p>
                </div>
              </div>
              <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-2">
                <Globe2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <p className="text-xs font-mono text-gray-600 truncate">
                  https://{form.subdomain || 'maboutique'}.scalor.net
                </p>
              </div>
            </div>

            {/* Récapitulatif */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Récapitulatif</p>
              </div>
              <dl className="divide-y divide-gray-100">
                {[
                  { label: 'Catégorie', value: PRODUCT_TYPES.find(p => p.value === form.productType)?.label || '--' },
                  { label: 'Couleur principale', value: (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border border-gray-200 inline-block" style={{ backgroundColor: form.themeColor }} />
                      {COLORS.find(c => c.value === form.themeColor)?.name || form.themeColor}
                    </span>
                  )},
                  { label: 'Ton de marque', value: BRAND_TONES.find(t => t.value === form.tone)?.label || '--' },
                  { label: 'Devise', value: form.storeCurrency || '--' },
                  { label: 'Pays', value: form.country || '--' },
                  { label: 'WhatsApp', value: form.storeWhatsApp || <span className="text-gray-400">Non renseigné</span> },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3">
                    <dt className="text-sm text-gray-500 shrink-0">{row.label}</dt>
                    <dd className="text-sm font-semibold text-gray-900 text-right">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Info création */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-start gap-3">
              <Zap className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-600 leading-5">
                En cliquant sur <strong className="text-gray-900">Créer ma boutique</strong>, l'IA génère automatiquement une page d'accueil adaptée à votre activité. L'opération prend environ 30 à 60 secondes.
              </p>
            </div>

            {errors.submit && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{errors.submit}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer nav bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 z-40">
        <div className="px-6 lg:px-10 py-3 flex items-center justify-between gap-4 w-full max-w-5xl mx-auto">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            {step === 3 && (
              <button
                type="button"
                onClick={skip}
                className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition"
              >
                Passer
              </button>
            )}

            {step < STEPS.length ? (
              <button
                type="button"
                onClick={next}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-primary-700 rounded-lg hover:bg-primary-800 transition"
              >
                Continuer
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-primary-700 rounded-lg hover:bg-primary-800 transition disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="max-w-[180px] truncate">{savingStep || 'Génération...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Créer ma boutique
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default StoreCreationWizard;
