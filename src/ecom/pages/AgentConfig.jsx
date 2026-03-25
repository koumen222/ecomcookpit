import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Save, ChevronDown, Send, RotateCcw, Bell, Settings, Bot, MessageSquare, Sparkles, Package, BarChart3, Warehouse, UserCog, Headphones, Clock, Mail, Phone, Building2, MapPin, Zap, ShieldCheck, Globe2, Target, AlertTriangle, Users, MessageCircle, TrendingUp, Eye, Star, Trash2, Plus, Image, Video, X, Download } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const ACCENT = '#0F6B4F';

// ─── Tabs ───
const TABS = [
  { id: 'identity', label: 'Identité', icon: Bot },
  { id: 'intelligence', label: 'Intelligence', icon: Sparkles },
  { id: 'sales-rules', label: 'Vente', icon: Target },
  { id: 'products', label: 'Produits', icon: Package },
  { id: 'stock', label: 'Stock', icon: Warehouse },
  { id: 'admin-profile', label: 'Profil Admin', icon: UserCog },
  { id: 'testimonials', label: 'Témoignages', icon: Star },
  { id: 'admin-pilotage', label: 'Pilotage', icon: Headphones },
  { id: 'analytics', label: 'Analytiques', icon: BarChart3 },
  { id: 'contacts', label: 'Contacts', icon: Users },
];

const TONE_OPTIONS = [
  { value: 'warm', label: '🤗 Tutoiement chaleureux', desc: 'Naturelle, humaine, proche du client' },
  { value: 'professional', label: '💼 Tutoiement professionnel', desc: 'Sérieuse, crédible, claire' },
  { value: 'formal', label: '🤝 Vouvoiement respectueux', desc: 'Polie, courtoise, relation premium' },
  { value: 'humorous', label: '😄 Humoristique légère', desc: 'Ajoute des blagues courtes sans perdre le sérieux' },
  { value: 'persuasive', label: '🔥 Persuasive', desc: 'Orientée closing, enthousiaste' },
];

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'fr_en', label: '🇫🇷🇬🇧 FR + EN (auto-détection)' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'ar', label: '🇸🇦 العربية' },
];

const CLIENT_TYPES = [
  { value: 'curieux', label: '🤔 Curieux', desc: 'Pose des questions, explore', strategy: 'Informer, montrer la valeur, proposer un visuel' },
  { value: 'acheteur', label: '💰 Acheteur', desc: 'Prêt à acheter, décidé', strategy: 'Faciliter, confirmer vite, proposer la commande' },
  { value: 'hesitant', label: '😰 Hésitant', desc: 'Intéressé mais freiné', strategy: 'Rassurer, témoignages, offre limitée' },
  { value: 'revendeur', label: '📦 Revendeur', desc: 'Achète en gros pour revendre', strategy: 'Prix de gros, conditions spéciales, suivi VIP' },
];

const SPECIAL_CASES_DEFAULT = [
  { trigger: 'ask_price', label: 'Demande de prix', reaction: 'Donner le prix + bénéfices + proposer un visuel', enabled: true },
  { trigger: 'how_it_works', label: 'Comment ça marche ?', reaction: 'Expliquer clairement + proposer une démo', enabled: true },
  { trigger: 'mention_budget', label: 'Mentionne un budget', reaction: 'Adapter la proposition + proposer une solution dans le budget', enabled: true },
  { trigger: 'hesitation', label: 'Client hésite', reaction: 'Poser une question pour comprendre le blocage', enabled: true },
  { trigger: 'too_expensive', label: 'Trouve cher', reaction: 'Justifier la valeur + comparer avec les alternatives', enabled: true },
  { trigger: 'bulk_order', label: 'Grande quantité', reaction: 'Basculer en mode revendeur + proposer tarifs de gros', enabled: true },
  { trigger: 'reseller', label: 'Client revendeur', reaction: 'Offre de gros + poser des questions business', enabled: true },
  { trigger: 'silent', label: 'Client silencieux', reaction: 'Relance naturelle et douce', enabled: true },
  { trigger: 'lang_switch', label: 'Change de langue', reaction: "S'adapter immédiatement à la langue du client", enabled: true },
];

const AUTONOMY_LEVELS = [
  { level: 1, label: 'Assistante', desc: 'Répond aux questions simples uniquement', color: 'bg-blue-100 text-blue-700' },
  { level: 2, label: 'Conseillère', desc: 'Recommande des produits et qualifie les leads', color: 'bg-cyan-100 text-cyan-700' },
  { level: 3, label: 'Commerciale', desc: "Gère les objections et pousse à l'achat", color: 'bg-emerald-100 text-emerald-700' },
  { level: 4, label: 'Négociatrice', desc: 'Conclut des ventes de façon autonome', color: 'bg-amber-100 text-amber-700' },
  { level: 5, label: 'Chasseuse', desc: 'Mode offensif : closing agressif, upsell', color: 'bg-red-100 text-red-700' },
];

const MODES_CONFIG = [
  { id: 'client', label: '👤 Mode Client', subtitle: 'Vente & Support', desc: 'Rita parle au client : chaleureuse, naturelle, persuasive. Suit la logique Comprendre → Répondre → Valeur → Question.', color: 'border-emerald-400 bg-emerald-50/60', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' },
  { id: 'boss', label: '🧑‍💼 Mode Boss', subtitle: 'Analyse & Rapports', desc: 'Rita parle au boss : professionnelle, analytique, directe. Analyse les conversations, explique les erreurs, propose des améliorations.', color: 'border-blue-400 bg-blue-50/60', iconBg: 'bg-blue-100', iconColor: 'text-blue-700' },
  { id: 'execution', label: '⚙️ Mode Exécution', subtitle: 'Actions Boss', desc: 'Le boss donne une instruction, Rita comprend, adapte et exécute intelligemment. Elle ne copie jamais le message du boss.', color: 'border-amber-400 bg-amber-50/60', iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
];

const RESPONSE_MODE_OPTIONS = [
  { value: 'text', label: 'Texte uniquement' },
  { value: 'voice', label: 'Voix uniquement' },
  { value: 'both', label: 'Texte + voix' },
];

const TTS_PROVIDER_OPTIONS = [
  { value: 'elevenlabs', label: 'Voix réaliste' },
  { value: 'fishaudio', label: 'Voix ultra réaliste' },
];

const ELEVENLABS_VOICES = [
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Michelle', gender: '♀', lang: 'FR/EN', desc: 'Chaleureuse, naturelle, commerciale' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Rita', gender: '♀', lang: 'FR', desc: 'Douce, persuasive, élégante' },
];

const FISH_AUDIO_VOICES = [
  { id: '13f7f6e260f94079b9d51c961fa6c9e2', name: 'Michelle', gender: '♀', lang: 'FR/EN', desc: 'Voix féminine chaleureuse, naturelle' },
  { id: '14b22748e04a48a58f92fbcde088ee50', name: 'Rita', gender: '♀', lang: 'FR', desc: 'Séduisante, persuasive' },
];

const OFFER_TRIGGER_OPTIONS = [
  { value: 'hesitation', label: 'Client hésitant' },
  { value: 'price_objection', label: 'Objection prix' },
  { value: 'bulk_interest', label: 'Demande de quantité' },
  { value: 'follow_up', label: 'Relance' },
  { value: 'closing', label: 'Avant closing' },
];

const getInstanceStatusLabel = (status) => {
  switch (status) {
    case 'connected':
    case 'active':
      return 'Connectée';
    case 'configured':
      return 'Configurée';
    case 'disconnected':
      return 'Déconnectée';
    default:
      return 'Non vérifiée';
  }
};

// ─── Reusable UI Components ───

const Field = ({ label, hint, required, children }) => (
  <div>
    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      {hint && <span className="text-[10px] text-gray-400 font-normal normal-case tracking-normal ml-1">({hint})</span>}
    </label>
    {children}
  </div>
);

const Toggle = ({ enabled, onChange, label, description }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-semibold text-gray-700">{label}</p>
      {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
    </div>
    <button type="button" onClick={() => onChange(!enabled)}
      className={`relative w-[44px] h-[26px] rounded-full transition-all duration-200 flex-shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-gray-200 hover:bg-gray-300'}`}>
      <span className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${enabled ? 'left-[21px]' : 'left-[3px]'}`} />
    </button>
  </div>
);

const SelectDropdown = ({ value, onChange, options, placeholder = 'Sélectionner...' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={open ? 'relative z-[120]' : 'relative z-10'}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-white transition-all">
        <span className="truncate">{selected ? selected.label : <span className="text-gray-400">{placeholder}</span>}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-[130] top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-xl py-1 max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-top-1">
          {options.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3.5 py-2 text-[13px] hover:bg-gray-50 transition-colors ${opt.value === value ? 'text-emerald-700 font-semibold bg-emerald-50/50' : 'text-gray-600'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───
export default function AgentConfig() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('identity');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [instances, setInstances] = useState([]);
  const [instanceSwitching, setInstanceSwitching] = useState(false);
  const [instanceSwitchStatus, setInstanceSwitchStatus] = useState(null);

  // Chat simulator
  const [simMessages, setSimMessages] = useState([]);
  const [simInput, setSimInput] = useState('');
  const [simTyping, setSimTyping] = useState(false);
  const simEndRef = useRef(null);

  // Voice preview
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const currentAudioRef = useRef(null);

  const previewVoice = async (voiceId) => {
    if (playingVoiceId === voiceId) {
      // Stop current playback
      if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
      setPlayingVoiceId(null);
      return;
    }
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    setPlayingVoiceId(voiceId);
    try {
      const model = config.fishAudioModel || 's2-pro';
      const res = await ecomApi.get(`/v1/external/whatsapp/preview-voice-fish?referenceId=${voiceId}&model=${model}`);
      if (!res.data.success) throw new Error('Preview failed');
      const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
      currentAudioRef.current = audio;
      audio.onended = () => { setPlayingVoiceId(null); currentAudioRef.current = null; };
      audio.onerror = () => { setPlayingVoiceId(null); currentAudioRef.current = null; };
      audio.play();
    } catch {
      setPlayingVoiceId(null);
    }
  };

  const previewElevenLabsVoice = async (voiceId) => {
    if (playingVoiceId === voiceId) {
      if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
      setPlayingVoiceId(null);
      return;
    }
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    setPlayingVoiceId(voiceId);
    try {
      const res = await ecomApi.get(`/v1/external/whatsapp/preview-voice?voiceId=${voiceId}`);
      if (!res.data.success) throw new Error('Preview failed');
      const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
      currentAudioRef.current = audio;
      audio.onended = () => { setPlayingVoiceId(null); currentAudioRef.current = null; };
      audio.onerror = () => { setPlayingVoiceId(null); currentAudioRef.current = null; };
      audio.play();
    } catch {
      setPlayingVoiceId(null);
    }
  };

  // Product editing
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [mediaUploadingByProduct, setMediaUploadingByProduct] = useState({});

  // Analytics
  const [activityData, setActivityData] = useState(null);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Contacts
  const [contactsList, setContactsList] = useState([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [config, setConfig] = useState({
    enabled: false,
    instanceId: '',
    agentName: 'Rita',
    agentRole: 'Vendeuse WhatsApp IA',
    language: 'fr',
    toneStyle: 'warm',
    useEmojis: true,
    signMessages: false,
    responseDelay: 3,
    welcomeMessage: "Bonjour 👌 quel produit vous intéresse ?",
    fallbackMessage: "Je transmets votre demande à mon responsable. Un instant s'il vous plaît 🙏",
    autoLanguageDetection: true,
    autonomyLevel: 3,
    canCloseDeals: false,
    canSendPaymentLinks: false,
    requireHumanApproval: true,
    followUpEnabled: false,
    followUpDelay: 24,
    followUpMessage: "Bonjour 😊 je reviens vers vous pour savoir si vous êtes toujours intéressé(e) ?",
    followUpMaxRelances: 3,
    followUpRelanceMessages: [],
    followUpOffer: '',
    escalateAfterMessages: 10,
    productCatalog: [],
    stockManagementEnabled: false,
    stockEntries: [],
    businessHoursOnly: false,
    businessHoursStart: '08:00',
    businessHoursEnd: '20:00',
    personality: { description: '', mannerisms: [], forbiddenPhrases: [], tonalGuidelines: '' },
    conversationExamples: [],
    behaviorRules: [],
    pricingNegotiation: { enabled: false, allowDiscount: false, maxDiscountPercent: 0, negotiationStyle: 'firm', priceIsFinal: true },
    responseMode: 'text',
    ttsProvider: 'elevenlabs',
    voiceMode: false,
    mixedVoiceReplyChance: 65,
    elevenlabsApiKey: '',
    elevenlabsVoiceId: 'cgSgspJ2msm6clMCkdW9',
    elevenlabsModel: 'eleven_v3',
    voiceStylePreset: 'balanced',
    fishAudioApiKey: '',
    fishAudioReferenceId: '13f7f6e260f94079b9d51c961fa6c9e2',
    fishAudioModel: 's2-pro',
    commercialOffersEnabled: false,
    commercialOffers: [],
    bossNotifications: false,
    bossPhone: '',
    bossEscalationEnabled: false,
    bossEscalationTimeoutMin: 30,
    notifyOnOrder: true,
    notifyOnScheduled: true,
    dailySummary: true,
    dailySummaryTime: '20:00',
    adminName: '',
    adminEmail: '',
    businessName: '',
    businessCity: '',
    businessDescription: '',
    // 3 Modes
    modeClientEnabled: true,
    modeBossEnabled: true,
    modeExecutionEnabled: true,
    // Vente intelligente
    salesLogic: 'understand_respond_value_question',
    neverForceSale: true,
    alwaysAnswerFirst: true,
    noSpam: true,
    naturalConversation: true,
    // Détection client
    detectClientType: true,
    detectInterestLevel: true,
    // Cas spéciaux
    specialCases: SPECIAL_CASES_DEFAULT,
    // Boss mode config
    bossAnalyzeConversations: true,
    bossExplainErrors: true,
    bossSuggestImprovements: true,
    // Execution mode config
    executionAdaptMessage: true,
    executionNeverCopy: true,
    // Auto-amélioration
    autoImproveEnabled: true,
    // Témoignages
    testimonialsEnabled: false,
    testimonials: [],
  });

  const [savedConfig, setSavedConfig] = useState(null);

  const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
  const userId = user._id || user.id;
  const [instanceError, setInstanceError] = useState(null);
  const [ritaRequestForm, setRitaRequestForm] = useState({
    contactName: user?.name || '',
    phoneNumber: '',
    businessName: '',
    reason: ''
  });
  const [ritaRequestSubmitting, setRitaRequestSubmitting] = useState(false);
  const [ritaRequestStatus, setRitaRequestStatus] = useState(null);
  const instanceOptions = instances.map((instance) => ({
    value: instance._id,
    label: `${instance.customName || instance.instanceName || 'Instance WhatsApp'} · ${getInstanceStatusLabel(instance.status)}`,
  }));
  const selectedInstance = instances.find((instance) => instance._id === config.instanceId);

  const set = useCallback((field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const loadInstances = async () => {
    try {
      setInstanceError(null);
      const { data } = await ecomApi.get(`/v1/external/whatsapp/instances?userId=${userId}`);
      if (data.success) {
        setInstances(data.instances || []);
      } else {
        setInstanceError(data.error || 'Échec du chargement des instances');
      }
    } catch (err) {
      console.error('[AgentConfig] Erreur chargement instances:', err);
      setInstanceError(err.response?.data?.error || err.message || 'Erreur réseau');
    }
  };

  // ─── Load ───
  useEffect(() => {
    const load = async () => {
      try {
        const [configRes] = await Promise.all([
          ecomApi.get(`/v1/external/whatsapp/rita-config?userId=${userId}`),
          loadInstances(),
        ]);
        if (configRes.data.success && configRes.data.config) {
          let loadedConfig = configRes.data.config;
          console.log("FRONT PRODUCTS:", (loadedConfig.productCatalog || []).map(p => ({ name: p.name, price: p.price })));
          
          // Migration: Converter 'product' -> 'productName' et ajouter 'rating' par défaut
          if (loadedConfig.testimonials?.length) {
            loadedConfig.testimonials = loadedConfig.testimonials.map(t => ({
              ...t,
              productName: t.productName || t.product || '', // Migration
              rating: t.rating || 5, // Ajouter rating par défaut
              // Supprimer l'ancien champ après migration
            }));
          }
          
          setConfig(prev => ({ ...prev, ...loadedConfig }));
          setSavedConfig(loadedConfig);
          setSimMessages([{
            role: 'agent',
            text: loadedConfig.welcomeMessage || "Bonjour ! Comment puis-je vous aider ?",
            time: '14:30',
          }]);
        }
      } catch (error) {
        console.error('[AgentConfig] Erreur chargement:', error);
      }
      finally { setLoading(false); }
    };
    if (userId) load();
    else setLoading(false);
  }, [userId]);

  useEffect(() => { simEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [simMessages, simTyping]);

  // ─── Save ───
  const handleSave = async () => {
    if (config.enabled && !config.instanceId) {
      setSaveStatus('error');
      alert('Sélectionnez une instance WhatsApp précise avant d\'activer Rita.');
      return;
    }

    setSaving(true);
    setSaveStatus(null);
    try {
      const { data } = await ecomApi.post('/v1/external/whatsapp/rita-config', { userId, config });
      if (!data.success) { setSaveStatus('error'); return; }
      await ecomApi.post('/v1/external/whatsapp/activate', {
        userId, enabled: config.enabled, instanceId: config.instanceId || undefined,
      });
      setSaveStatus('success');
      const savedFromServer = data.config || config;
      setConfig(prev => ({ ...prev, ...savedFromServer }));
      setSavedConfig(savedFromServer);
      setHasChanges(false);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch { setSaveStatus('error'); }
    finally { setSaving(false); }
  };

  const handleInstanceChange = async (instanceId) => {
    set('instanceId', instanceId);
    setInstanceSwitchStatus(null);

    // If Rita is active, apply the instance switch immediately.
    if (!config.enabled) return;

    setInstanceSwitching(true);
    try {
      await ecomApi.post('/v1/external/whatsapp/activate', {
        userId,
        enabled: true,
        instanceId,
      });
      setInstanceSwitchStatus('success');
    } catch {
      setInstanceSwitchStatus('error');
    } finally {
      setInstanceSwitching(false);
    }
  };

  const handleReset = () => {
    if (savedConfig) {
      setConfig(prev => ({ ...prev, ...savedConfig }));
      setHasChanges(false);
    }
  };

  const handleRitaAccessRequest = async (e) => {
    e.preventDefault();
    setRitaRequestSubmitting(true);
    setRitaRequestStatus(null);
    try {
      const { data } = await ecomApi.post('/workspaces/rita-access-request', ritaRequestForm);
      if (!data.success) {
        setRitaRequestStatus({ type: 'error', message: data.message || 'Impossible d\'envoyer la demande.' });
        return;
      }
      setRitaRequestStatus({ type: 'success', message: data.message || 'Demande envoyee avec succes.' });
      setRitaRequestForm((prev) => ({ ...prev, reason: '' }));
    } catch (err) {
      setRitaRequestStatus({ type: 'error', message: err.response?.data?.message || 'Erreur serveur, reessayez.' });
    } finally {
      setRitaRequestSubmitting(false);
    }
  };

  // ─── Chat simulator ───
  const handleSimSend = async () => {
    if (!simInput.trim() || simTyping) return;
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const userText = simInput.trim();
    setSimMessages(prev => [...prev, { role: 'user', text: userText, time: now }]);
    setSimInput('');
    setSimTyping(true);
    try {
      const apiMessages = [...simMessages, { role: 'user', text: userText }]
        .filter(m => m.text)
        .map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text }));
      const { data } = await ecomApi.post('/v1/external/whatsapp/test-chat', { userId, messages: apiMessages });
      const nowResp = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setSimTyping(false);
      if (data.success && data.reply) {
        setSimMessages(prev => [...prev, { role: 'agent', text: data.reply, time: nowResp }]);
      } else {
        setSimMessages(prev => [...prev, { role: 'agent', text: "⚠️ Pas de réponse de l'IA", time: nowResp }]);
      }
    } catch (err) {
      setSimTyping(false);
      setSimMessages(prev => [...prev, { role: 'agent', text: `❌ ${err.response?.data?.error || err.message}`, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    }
  };

  // ─── Product helpers ───
  const addProduct = () => {
    const newP = { name: '', price: '', description: '', category: '', images: [], videos: [], features: [], faq: [], objections: [], inStock: true, quantityOffers: [] };
    set('productCatalog', [...config.productCatalog, newP]);
    setEditingProduct(config.productCatalog.length);
  };
  const updateProduct = (idx, field, val) => {
    const updated = config.productCatalog.map((p, i) => i === idx ? { ...p, [field]: val } : p);
    set('productCatalog', updated);
  };
  const removeProduct = (idx) => {
    set('productCatalog', config.productCatalog.filter((_, i) => i !== idx));
    if (editingProduct === idx) setEditingProduct(null);
  };

  const updateProductMediaList = (productIndex, field, updater) => {
    const currentList = config.productCatalog?.[productIndex]?.[field] || [];
    const nextList = typeof updater === 'function' ? updater(currentList) : updater;
    updateProduct(productIndex, field, nextList);
  };

  const handleProductMediaUpload = async (productIndex, field, files) => {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;

    setMediaUploadingByProduct(prev => ({ ...prev, [`${productIndex}:${field}`]: true }));

    try {
      const uploadedUrls = [];

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);

        const { data } = await ecomApi.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const mediaUrl = data?.mediaUrl || data?.url;
        if (data?.success && mediaUrl) {
          uploadedUrls.push(mediaUrl);
        }
      }

      if (uploadedUrls.length) {
        updateProductMediaList(productIndex, field, existing => [...existing, ...uploadedUrls]);
      }
    } catch (error) {
      alert(`Erreur upload ${field === 'images' ? 'image' : 'vidéo'}: ${error.response?.data?.message || error.response?.data?.error || error.message}`);
    } finally {
      setMediaUploadingByProduct(prev => ({ ...prev, [`${productIndex}:${field}`]: false }));
    }
  };

  const removeProductMedia = (productIndex, field, mediaIndex) => {
    updateProductMediaList(productIndex, field, existing => existing.filter((_, index) => index !== mediaIndex));
  };

  // ─── Testimonial management ───
  const [testimonialUploading, setTestimonialUploading] = useState({});

  const addTestimonial = () => {
    set('testimonials', [...(config.testimonials || []), { clientName: '', text: '', productName: '', images: [], videos: [], rating: 5 }]);
  };

  const updateTestimonial = (idx, field, value) => {
    const updated = [...(config.testimonials || [])];
    updated[idx] = { ...updated[idx], [field]: value };
    set('testimonials', updated);
  };

  const removeTestimonial = (idx) => {
    set('testimonials', (config.testimonials || []).filter((_, i) => i !== idx));
  };

  const handleTestimonialMediaUpload = async (idx, field, files) => {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;
    setTestimonialUploading(prev => ({ ...prev, [`${idx}:${field}`]: true }));
    try {
      const uploadedUrls = [];
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await ecomApi.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const mediaUrl = data?.mediaUrl || data?.url;
        if (data?.success && mediaUrl) uploadedUrls.push(mediaUrl);
      }
      if (uploadedUrls.length) {
        const updated = [...(config.testimonials || [])];
        updated[idx] = { ...updated[idx], [field]: [...(updated[idx]?.[field] || []), ...uploadedUrls] };
        set('testimonials', updated);
      }
    } catch (error) {
      alert(`Erreur upload: ${error.response?.data?.message || error.message}`);
    } finally {
      setTestimonialUploading(prev => ({ ...prev, [`${idx}:${field}`]: false }));
    }
  };

  const removeTestimonialMedia = (idx, field, mediaIdx) => {
    const updated = [...(config.testimonials || [])];
    updated[idx] = { ...updated[idx], [field]: (updated[idx]?.[field] || []).filter((_, i) => i !== mediaIdx) };
    set('testimonials', updated);
  };

  const addProductQuantityOffer = (productIndex) => {
    const offers = config.productCatalog?.[productIndex]?.quantityOffers || [];
    updateProduct(productIndex, 'quantityOffers', [
      ...offers,
      { minQuantity: offers.length + 1, unitPrice: '', totalPrice: '', label: '' },
    ]);
  };

  const updateProductQuantityOffer = (productIndex, offerIndex, field, value) => {
    const offers = config.productCatalog?.[productIndex]?.quantityOffers || [];
    const updatedOffers = offers.map((offer, idx) => {
      if (idx !== offerIndex) return offer;
      if (field === 'minQuantity') return { ...offer, minQuantity: Math.max(1, parseInt(value, 10) || 1) };
      return { ...offer, [field]: value };
    });
    updateProduct(productIndex, 'quantityOffers', updatedOffers);
  };

  const removeProductQuantityOffer = (productIndex, offerIndex) => {
    const offers = config.productCatalog?.[productIndex]?.quantityOffers || [];
    updateProduct(productIndex, 'quantityOffers', offers.filter((_, idx) => idx !== offerIndex));
  };

  // ─── Stock helpers ───
  const addStockEntry = () => {
    set('stockEntries', [...(config.stockEntries || []), { productName: '', quantity: 0, alertThreshold: 5 }]);
  };
  const updateStockEntry = (idx, field, val) => {
    const updated = (config.stockEntries || []).map((s, i) => i === idx ? { ...s, [field]: val } : s);
    set('stockEntries', updated);
  };
  const removeStockEntry = (idx) => {
    set('stockEntries', (config.stockEntries || []).filter((_, i) => i !== idx));
  };

  const addCommercialOffer = () => {
    set('commercialOffers', [
      ...(config.commercialOffers || []),
      { title: '', appliesTo: '', trigger: 'hesitation', benefit: '', message: '', conditions: '', active: true },
    ]);
  };

  const updateCommercialOffer = (idx, field, value) => {
    const updated = (config.commercialOffers || []).map((offer, index) => index === idx ? { ...offer, [field]: value } : offer);
    set('commercialOffers', updated);
  };

  const removeCommercialOffer = (idx) => {
    set('commercialOffers', (config.commercialOffers || []).filter((_, index) => index !== idx));
  };

  // ─── Analytics ───
  const fetchAnalytics = useCallback(async (days) => {
    setAnalyticsLoading(true);
    try {
      const { data } = await ecomApi.get(`/v1/external/whatsapp/rita-activity?userId=${userId}&days=${days}`);
      if (data.success) setActivityData(data);
    } catch { /* ignore */ }
    finally { setAnalyticsLoading(false); }
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics(analyticsDays);
  }, [activeTab, analyticsDays, fetchAnalytics]);

  const fetchContacts = useCallback(async (page = 1) => {
    setContactsLoading(true);
    try {
      const { data } = await ecomApi.get(`/v1/external/whatsapp/rita-contacts?userId=${userId}&page=${page}&limit=50`);
      if (data.success) {
        setContactsList(data.contacts || []);
        setContactsTotal(data.total || 0);
        setContactsPage(page);
      }
    } catch { /* ignore */ }
    finally { setContactsLoading(false); }
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'contacts') fetchContacts(1);
  }, [activeTab, fetchContacts]);

  const exportContactsCSV = () => {
    const base = (ecomApi.defaults.baseURL || '').replace(/\/$/, '');
    const url = `${base}/v1/external/whatsapp/rita-contacts/export?userId=${userId}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rita-contacts.csv';
    a.click();
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-600 flex items-center justify-center mb-4 shadow-lg animate-pulse">
          <Bot className="w-7 h-7 text-white" />
        </div>
        <p className="text-sm text-gray-400">Chargement de la configuration...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-gray-50/50 pb-20">

      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="py-3">
            <nav className="flex items-center gap-1.5 text-[12px] text-gray-400">
              <button onClick={() => navigate('/ecom/dashboard')} className="hover:text-gray-600 transition-colors">Dashboard</button>
              <span>›</span>
              <button onClick={() => navigate('/ecom/whatsapp/service')} className="hover:text-gray-600 transition-colors">WhatsApp Service</button>
              <span>›</span>
              <span className="text-gray-600 font-medium">IA Management</span>
            </nav>
          </div>

          {/* Title bar */}
          <div className="flex items-center justify-between pb-4">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">Paramètres de l'IA</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">Personnalisez l'identité et le comportement de votre agent intelligent.</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleReset} disabled={!hasChanges}
                className="px-4 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold text-white rounded-xl disabled:opacity-50 transition-all shadow-sm hover:shadow-md"
                style={{ background: ACCENT }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Sauvegarder
              </button>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-0 border-b-0 -mb-px">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all ${
                    isActive
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                  }`}>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ─── TAB: IDENTITÉ ─── */}
        {activeTab === 'identity' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Identity card */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-visible">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-emerald-600" />
                    </span>
                    Identité de l'Agent
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <Toggle
                      enabled={config.enabled}
                      onChange={v => set('enabled', v)}
                      label="Activer Rita sur cette instance"
                      description="Active l'agent Rita et l'attache à l'instance WhatsApp choisie ci-dessous"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nom de l'agent" required>
                      <input value={config.agentName} onChange={e => set('agentName', e.target.value)}
                        placeholder="Rita" className="ac-input" />
                    </Field>
                    <Field label="Rôle de l'agent">
                      <input value={config.agentRole} onChange={e => set('agentRole', e.target.value)}
                        placeholder="Vendeuse WhatsApp IA" className="ac-input" />
                    </Field>
                  </div>
                  <Field label="Langue principale">
                    <SelectDropdown value={config.language} onChange={v => set('language', v)} options={LANGUAGE_OPTIONS} />
                  </Field>
                  <Field label="Instance WhatsApp Rita" hint="obligatoire pour l'activation">
                    {instanceOptions.length > 0 ? (
                      <SelectDropdown
                        value={config.instanceId}
                        onChange={handleInstanceChange}
                        options={instanceOptions}
                        placeholder="Choisir l'instance utilisée par Rita"
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-[12px] text-gray-500 space-y-2">
                        <p>{instanceError ? `Erreur: ${instanceError}` : 'Aucune instance WhatsApp disponible. Créez ou connectez une instance avant d\'activer Rita.'}</p>
                        <button type="button" onClick={loadInstances} className="text-emerald-600 hover:text-emerald-700 font-semibold underline">
                          Recharger les instances
                        </button>
                      </div>
                    )}
                  </Field>
                  {config.instanceId && (
                    <div className="flex items-center gap-2 text-[12px] text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>
                        Instance sélectionnée pour Rita : {selectedInstance?.customName || selectedInstance?.instanceName || 'Instance WhatsApp'}
                      </span>
                    </div>
                  )}
                  {config.enabled && instanceSwitching && (
                    <div className="text-[12px] text-blue-600">Changement d'instance Rita en cours...</div>
                  )}
                  {config.enabled && instanceSwitchStatus === 'success' && (
                    <div className="text-[12px] text-emerald-600">Instance Rita changée avec succès.</div>
                  )}
                  {config.enabled && instanceSwitchStatus === 'error' && (
                    <div className="text-[12px] text-red-600">Impossible de changer l'instance Rita maintenant.</div>
                  )}
                </div>
              </div>

              {/* Gestion des langues */}
              <div className="relative z-20 bg-white rounded-2xl border border-gray-200 overflow-visible">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Globe2 className="w-4 h-4 text-blue-600" />
                    </span>
                    Gestion des Langues
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Rita détecte automatiquement la langue du client et s'adapte</p>
                </div>
                <div className="p-6 space-y-3">
                  <Toggle enabled={config.autoLanguageDetection} onChange={v => set('autoLanguageDetection', v)}
                    label="Détection automatique de langue"
                    description="Rita répond dans la langue du client (jamais de mélange)" />
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Règles linguistiques</p>
                    {[
                      { emoji: '🇫🇷', rule: 'Client parle français → Réponse 100% français' },
                      { emoji: '🇬🇧', rule: 'Client parle anglais → Réponse 100% anglais' },
                      { emoji: '🚫', rule: 'Ne jamais mélanger les langues dans une réponse' },
                      { emoji: '🔀', rule: 'Si le client mélange → Choisir la langue dominante' },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px] text-gray-500">
                        <span>{r.emoji}</span>
                        <span>{r.rule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Automated messages card */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                    </span>
                    Messages Automatisés
                  </h2>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Message de bienvenue</label>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Actif</span>
                    </div>
                    <textarea value={config.welcomeMessage} onChange={e => set('welcomeMessage', e.target.value)} rows={3}
                      placeholder="Bonjour ! Je suis Sarah, votre assistante virtuelle..."
                      className="ac-textarea" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Message de transfert humain</label>
                      <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Optionnel</span>
                    </div>
                    <textarea value={config.fallbackMessage} onChange={e => set('fallbackMessage', e.target.value)} rows={2}
                      placeholder="Je transmets votre demande à l'un de nos conseillers..."
                      className="ac-textarea" />
                  </div>
                </div>
              </div>

              {/* Personnalité */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-purple-600" />
                    </span>
                    Personnalité de Rita
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Définissez sa présence, sa façon de parler et ce qu'elle doit éviter.</p>
                </div>
                <div className="p-6 space-y-4">
                  <Field label="Description de personnalité">
                    <textarea
                      value={config.personality?.description || ''}
                      onChange={e => set('personality', { ...(config.personality || {}), description: e.target.value })}
                      rows={3}
                      placeholder="Ex: vendeuse professionnelle, chaleureuse, rapide, très humaine, basée au Cameroun"
                      className="ac-textarea"
                    />
                  </Field>
                  <Field label="Lignes de ton">
                    <textarea
                      value={config.personality?.tonalGuidelines || ''}
                      onChange={e => set('personality', { ...(config.personality || {}), tonalGuidelines: e.target.value })}
                      rows={3}
                      placeholder="Ex: phrases courtes, ton rassurant, orientée résultat, jamais robotique"
                      className="ac-textarea"
                    />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Expressions à utiliser" hint="une par ligne">
                      <textarea
                        value={(config.personality?.mannerisms || []).join('\n')}
                        onChange={e => set('personality', {
                          ...(config.personality || {}),
                          mannerisms: e.target.value.split('\n').map(v => v.trim()).filter(Boolean),
                        })}
                        rows={4}
                        placeholder="Ex: D'accord\nJe vous explique\nOn peut faire comme ceci"
                        className="ac-textarea"
                      />
                    </Field>
                    <Field label="Phrases interdites" hint="une par ligne">
                      <textarea
                        value={(config.personality?.forbiddenPhrases || []).join('\n')}
                        onChange={e => set('personality', {
                          ...(config.personality || {}),
                          forbiddenPhrases: e.target.value.split('\n').map(v => v.trim()).filter(Boolean),
                        })}
                        rows={4}
                        placeholder="Ex: Veuillez patienter\nQuel produit ?\nJe suis une IA"
                        className="ac-textarea"
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Parameters card */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-base">⚙️</span>
                    Paramètres
                  </h2>
                </div>
                <div className="p-5 space-y-5">
                  {/* Tone selector */}
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Ton de la voix</label>
                    <div className="space-y-1.5">
                      {TONE_OPTIONS.map(t => (
                        <button key={t.value} onClick={() => set('toneStyle', t.value)} type="button"
                          className={`w-full text-left px-3 py-2.5 text-[12px] rounded-lg border transition-all ${
                            config.toneStyle === t.value
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}>
                          <span className="font-semibold">{t.label}</span>
                          <span className="text-[10px] text-gray-400 ml-1.5">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Response delay slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Délai de réponse (sec)</label>
                      <span className="text-[13px] font-bold text-gray-700">{config.responseDelay}s</span>
                    </div>
                    <input type="range" min="0" max="15" value={config.responseDelay}
                      onChange={e => set('responseDelay', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
                      style={{ accentColor: ACCENT }} />
                  </div>

                  {/* Toggle: Emojis */}
                  <Toggle enabled={config.useEmojis} onChange={v => set('useEmojis', v)}
                    label="Utiliser des Emojis"
                    description="Ajoute des caractères aux réponses" />

                  {/* Toggle: AI Signature */}
                  <Toggle enabled={config.signMessages} onChange={v => set('signMessages', v)}
                    label="Signature IA"
                    description="Mentionner qu'il s'agit d'une IA" />
                </div>
              </div>

              {/* Voix */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-base">🎙️</span>
                    Voix
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Mode de réponse</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'text',  icon: '💬',    label: 'Texte',  desc: 'Messages écrits uniquement' },
                        { value: 'voice', icon: '🎙️',   label: 'Vocal',  desc: 'Notes audio uniquement' },
                        { value: 'both',  icon: '💬🎙️', label: 'Mixte',  desc: 'Vocal pour les longues réponses' },
                      ].map(m => {
                        const isActive = (config.responseMode || 'text') === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => set('responseMode', m.value)}
                            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-all ${
                              isActive
                                ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                                : 'border-gray-200 bg-gray-50 hover:border-emerald-200 hover:bg-emerald-50/40'
                            }`}
                          >
                            <span className="text-xl">{m.icon}</span>
                            <span className={`text-[12px] font-bold ${isActive ? 'text-emerald-700' : 'text-gray-700'}`}>{m.label}</span>
                            <span className="text-[10px] text-gray-400 leading-tight">{m.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {config.responseMode !== 'text' && (
                    <>
                      <Field label="Fournisseur voix">
                        <SelectDropdown
                          value={config.ttsProvider || 'elevenlabs'}
                          onChange={v => set('ttsProvider', v)}
                          options={TTS_PROVIDER_OPTIONS}
                        />
                      </Field>

                      {config.responseMode === 'both' && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Chance de réponse vocale</label>
                            <span className="text-[13px] font-bold text-gray-700">{config.mixedVoiceReplyChance || 0}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={config.mixedVoiceReplyChance || 0}
                            onChange={e => set('mixedVoiceReplyChance', parseInt(e.target.value) || 0)}
                            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
                            style={{ accentColor: ACCENT }}
                          />
                        </div>
                      )}

                      {config.ttsProvider === 'elevenlabs' ? (
                        <>
                          <Field label="Voix réaliste">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              {ELEVENLABS_VOICES.map(voice => {
                                const isSelected = config.elevenlabsVoiceId === voice.id;
                                const isPlaying = playingVoiceId === voice.id;
                                const isLoadingPreview = isPlaying && !currentAudioRef.current;
                                return (
                                  <div
                                    key={voice.id}
                                    onClick={() => set('elevenlabsVoiceId', voice.id)}
                                    className={`relative flex items-start gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-all ${
                                      isSelected
                                        ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                                        : 'border-gray-200 bg-gray-50 hover:border-emerald-200 hover:bg-emerald-50/40'
                                    }`}
                                  >
                                    <span className="text-base mt-0.5">🎙️</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[12px] font-semibold text-gray-800 leading-tight">{voice.name} <span className="font-normal text-gray-400">{voice.gender}</span></p>
                                      <p className="text-[10px] text-gray-500 truncate">{voice.desc}</p>
                                      <p className="text-[10px] font-mono text-gray-400">{voice.lang}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); previewElevenLabsVoice(voice.id); }}
                                      title={isPlaying ? 'Arrêter' : 'Écouter un extrait'}
                                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                        isPlaying
                                          ? 'bg-emerald-500 text-white animate-pulse'
                                          : 'bg-gray-200 text-gray-500 hover:bg-emerald-100 hover:text-emerald-600'
                                      }`}
                                    >
                                      {isLoadingPreview ? (
                                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                      ) : isPlaying ? (
                                        <span className="text-[8px] font-bold">■</span>
                                      ) : (
                                        <span className="text-[8px] font-bold ml-0.5">▶</span>
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-1">
                              <p className="text-[10px] text-gray-400 mb-1">Ou saisissez un Voice ID custom :</p>
                              <input
                                value={config.elevenlabsVoiceId || ''}
                                onChange={e => set('elevenlabsVoiceId', e.target.value)}
                                placeholder="cgSgspJ2msm6clMCkdW9"
                                className="ac-input font-mono text-[11px]"
                              />
                            </div>
                          </Field>
                          <Field label="Modèle ElevenLabs">
                            <input
                              value={config.elevenlabsModel || ''}
                              onChange={e => set('elevenlabsModel', e.target.value)}
                              placeholder="eleven_v3"
                              className="ac-input"
                            />
                          </Field>
                        </>
                      ) : (
                        <>
                          <Field label="Voix ultra réaliste">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              {FISH_AUDIO_VOICES.map(voice => {
                                const isSelected = config.fishAudioReferenceId === voice.id;
                                const isPlaying = playingVoiceId === voice.id;
                                const isLoadingPreview = isPlaying && !currentAudioRef.current;
                                return (
                                  <div
                                    key={voice.id}
                                    onClick={() => set('fishAudioReferenceId', voice.id)}
                                    className={`relative flex items-start gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-all ${
                                      isSelected
                                        ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                                        : 'border-gray-200 bg-gray-50 hover:border-emerald-200 hover:bg-emerald-50/40'
                                    }`}
                                  >
                                    <span className="text-base mt-0.5">🎙️</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[12px] font-semibold text-gray-800 leading-tight">{voice.name} <span className="font-normal text-gray-400">{voice.gender}</span></p>
                                      <p className="text-[10px] text-gray-500 truncate">{voice.desc}</p>
                                      <p className="text-[10px] font-mono text-gray-400">{voice.lang}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); previewVoice(voice.id); }}
                                      title={isPlaying ? 'Arrêter' : 'Écouter un extrait'}
                                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                        isPlaying
                                          ? 'bg-emerald-500 text-white animate-pulse'
                                          : 'bg-gray-200 text-gray-500 hover:bg-emerald-100 hover:text-emerald-600'
                                      }`}
                                    >
                                      {isLoadingPreview ? (
                                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                      ) : isPlaying ? (
                                        <span className="text-[8px] font-bold">■</span>
                                      ) : (
                                        <span className="text-[8px] font-bold ml-0.5">▶</span>
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-1">
                              <p className="text-[10px] text-gray-400 mb-1">Ou saisissez un ID custom :</p>
                              <input
                                value={config.fishAudioReferenceId || ''}
                                onChange={e => set('fishAudioReferenceId', e.target.value)}
                                placeholder="Reference voice id"
                                className="ac-input font-mono text-[11px]"
                              />
                            </div>
                          </Field>
                          <Field label="Modèle Fish Audio">
                            <input
                              value={config.fishAudioModel || ''}
                              onChange={e => set('fishAudioModel', e.target.value)}
                              placeholder="s2-pro"
                              className="ac-input"
                            />
                          </Field>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Chat preview card */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f4f3a, #1a7a5a)' }}>
                <div className="px-5 py-3.5">
                  <h3 className="text-[13px] font-bold text-white/90 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    APERÇU DU CHAT
                  </h3>
                </div>
                <div className="px-4 pb-2 max-h-[280px] overflow-y-auto space-y-2.5" style={{ scrollbarWidth: 'none' }}>
                  {simMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-emerald-500 text-white rounded-br-md'
                          : 'bg-white/15 text-white/90 rounded-bl-md'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {simTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white/15 text-white/60 px-4 py-2.5 rounded-2xl rounded-bl-md text-[12px]">
                        <span className="animate-pulse">● ● ●</span>
                      </div>
                    </div>
                  )}
                  <div ref={simEndRef} />
                </div>
                {/* Chat input */}
                <div className="px-4 pb-4 pt-2">
                  <div className="flex gap-2">
                    <input value={simInput} onChange={e => setSimInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSimSend()}
                      placeholder="Tester une question..."
                      className="flex-1 px-3 py-2 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/15 rounded-xl outline-none focus:border-white/30" />
                    <button onClick={handleSimSend} disabled={simTyping}
                      className="w-9 h-9 flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-xl transition-colors disabled:opacity-40">
                      <Send className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
                <button onClick={() => navigate('/ecom/whatsapp/service?tab=rita')}
                  className="w-full py-3 text-[11px] font-bold text-white/70 hover:text-white uppercase tracking-wider border-t border-white/10 transition-colors">
                  Tester l'Agent →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: INTELLIGENCE ─── */}
        {activeTab === 'intelligence' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">

              {/* 3 Modes de fonctionnement */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-purple-600" />
                    </span>
                    3 Modes de Fonctionnement
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Rita fonctionne avec 3 modes distincts selon l'interlocuteur</p>
                </div>
                <div className="p-6 space-y-3">
                  {MODES_CONFIG.map(mode => (
                    <div key={mode.id}
                      className={`flex items-start gap-4 px-4 py-4 rounded-xl border-2 transition-all ${mode.color}`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${mode.iconBg}`}>
                        <span className="text-lg">{mode.label.split(' ')[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-[13px]">{mode.label}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/60 text-gray-500">{mode.subtitle}</span>
                        </div>
                        <p className="text-[11.5px] text-gray-500 mt-1 leading-relaxed">{mode.desc}</p>
                      </div>
                      <Toggle
                        enabled={config[`mode${mode.id.charAt(0).toUpperCase() + mode.id.slice(1)}Enabled`]}
                        onChange={v => set(`mode${mode.id.charAt(0).toUpperCase() + mode.id.slice(1)}Enabled`, v)}
                        label="" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Autonomy Level */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900">Niveau d'autonomie</h2>
                  <p className="text-[12px] text-gray-400 mt-0.5">Contrôlez jusqu'où Rita peut aller sans intervention humaine</p>
                </div>
                <div className="p-6 space-y-2.5">
                  {AUTONOMY_LEVELS.map(lvl => (
                    <button key={lvl.level} onClick={() => set('autonomyLevel', lvl.level)} type="button"
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                        config.autonomyLevel === lvl.level
                          ? 'border-emerald-400 bg-emerald-50/60 shadow-sm'
                          : 'border-gray-100 bg-gray-50/40 hover:border-gray-200'
                      }`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${lvl.color}`}>{lvl.level}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-[13px]">{lvl.label}</p>
                        <p className="text-[11.5px] text-gray-400 mt-0.5">{lvl.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        config.autonomyLevel === lvl.level ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      }`}>
                        {config.autonomyLevel === lvl.level && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Détection & Analyse Client */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-cyan-600" />
                    </span>
                    Analyse Avant Chaque Réponse
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Rita analyse chaque message pour adapter sa stratégie</p>
                </div>
                <div className="p-6 space-y-3">
                  <Toggle enabled={config.detectClientType} onChange={v => set('detectClientType', v)}
                    label="Détecter le type de client"
                    description="Identifier si le client est curieux, acheteur, hésitant ou revendeur" />
                  <Toggle enabled={config.detectInterestLevel} onChange={v => set('detectInterestLevel', v)}
                    label="Évaluer le niveau d'intérêt"
                    description="Mesurer l'intérêt (faible / moyen / élevé) pour adapter la pression" />

                  {config.detectClientType && (
                    <div className="pt-2 space-y-2">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Types de clients détectés</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {CLIENT_TYPES.map(ct => (
                          <div key={ct.value} className="p-3 bg-gray-50 rounded-xl">
                            <p className="text-[12px] font-bold text-gray-700">{ct.label}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{ct.desc}</p>
                            <p className="text-[10px] text-emerald-600 mt-1 font-medium">→ {ct.strategy}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Follow-up */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900">Relances automatiques</h2>
                </div>
                <div className="p-6 space-y-3">
                  <Toggle enabled={config.followUpEnabled} onChange={v => set('followUpEnabled', v)}
                    label="Activer les relances" description="Rita relance naturellement les prospects silencieux" />
                  {config.followUpEnabled && (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Relancer après" hint="heures">
                          <input type="number" value={config.followUpDelay} onChange={e => set('followUpDelay', parseInt(e.target.value) || 24)} min="1" className="ac-input" />
                        </Field>
                        <Field label="Max relances">
                          <input type="number" value={config.followUpMaxRelances} onChange={e => set('followUpMaxRelances', parseInt(e.target.value) || 3)} min="1" max="10" className="ac-input" />
                        </Field>
                      </div>
                      <Field label="Message de relance">
                        <textarea value={config.followUpMessage} onChange={e => set('followUpMessage', e.target.value)} rows={2} className="ac-textarea" />
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Permissions */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900">Permissions</h2>
                </div>
                <div className="p-5 space-y-1">
                  <Toggle enabled={config.canCloseDeals} onChange={v => set('canCloseDeals', v)}
                    label="Confirmer des commandes" description="Valider une vente sans intervention humaine" />
                  <Toggle enabled={config.canSendPaymentLinks} onChange={v => set('canSendPaymentLinks', v)}
                    label="Liens de paiement" description="Envoyer automatiquement le lien de checkout" />
                  <Toggle enabled={config.requireHumanApproval} onChange={v => set('requireHumanApproval', v)}
                    label="Validation humaine" description="Notifier avant d'envoyer une offre" />
                </div>
              </div>

              {/* Comportement humain */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-sm">🧠</span>
                    Comportement Humain
                  </h2>
                </div>
                <div className="p-5 space-y-1">
                  <Toggle enabled={config.naturalConversation} onChange={v => set('naturalConversation', v)}
                    label="Discussion naturelle" description="S'adapter au ton du client, être fluide" />
                  <Toggle enabled={config.autoImproveEnabled} onChange={v => set('autoImproveEnabled', v)}
                    label="Auto-amélioration" description="Rita analyse et améliore ses réponses après chaque conversation" />
                </div>
              </div>

              {/* Business hours */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900">Disponibilité</h2>
                </div>
                <div className="p-5 space-y-3">
                  <Toggle enabled={config.businessHoursOnly} onChange={v => set('businessHoursOnly', v)}
                    label="Heures de bureau uniquement" description="Réponses différentes hors horaires" />
                  {config.businessHoursOnly && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <Field label="Début">
                        <input type="time" value={config.businessHoursStart} onChange={e => set('businessHoursStart', e.target.value)} className="ac-input" />
                      </Field>
                      <Field label="Fin">
                        <input type="time" value={config.businessHoursEnd} onChange={e => set('businessHoursEnd', e.target.value)} className="ac-input" />
                      </Field>
                    </div>
                  )}
                </div>
              </div>

              {/* Auto-amélioration */}
              {config.autoImproveEnabled && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-[12px] font-semibold text-emerald-700 mb-1">🔁 Auto-amélioration active</p>
                  <p className="text-[11px] text-emerald-600 leading-relaxed">
                    Après chaque conversation, Rita :<br/>
                    1. Analyse si elle a bien compris<br/>
                    2. Vérifie si elle a été naturelle<br/>
                    3. Évalue sa performance de vente<br/>
                    4. Garde en mémoire les bonnes pratiques
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: VENTE (Règles & Cas Spéciaux) ─── */}
        {activeTab === 'sales-rules' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">

              {/* Règles de vente intelligente */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    </span>
                    Règles de Vente Intelligente
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Les règles que Rita respecte en permanence</p>
                </div>
                <div className="p-6 space-y-1">
                  <Toggle enabled={config.alwaysAnswerFirst} onChange={v => set('alwaysAnswerFirst', v)}
                    label="Toujours répondre avant de vendre"
                    description="Rita répond aux questions du client avant de proposer un achat" />
                  <Toggle enabled={config.neverForceSale} onChange={v => set('neverForceSale', v)}
                    label="Ne jamais forcer la vente"
                    description="Rita ne pressure jamais le client, elle crée une discussion naturelle" />
                  <Toggle enabled={config.noSpam} onChange={v => set('noSpam', v)}
                    label="Anti-spam"
                    description="Ne jamais envoyer d'images ou d'infos inutiles en masse" />
                  <Toggle enabled={config.naturalConversation} onChange={v => set('naturalConversation', v)}
                    label="Conversation naturelle"
                    description="Rester dans une discussion humaine, fluide et naturelle" />
                </div>
              </div>

              {/* Logique de vente */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                    </span>
                    Logique de Vente
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">La séquence que Rita suit pour chaque interaction client</p>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    {[
                      { step: '1', label: 'Comprendre', desc: "Identifier l'intention", color: 'bg-blue-50 text-blue-700 border-blue-200' },
                      { step: '→', label: '', desc: '', color: '' },
                      { step: '2', label: 'Répondre', desc: 'Répondre clairement', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                      { step: '→', label: '', desc: '', color: '' },
                      { step: '3', label: 'Valeur', desc: 'Ajouter de la valeur', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                      { step: '→', label: '', desc: '', color: '' },
                      { step: '4', label: 'Question', desc: 'Poser une question', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                    ].map((s, i) => s.label ? (
                      <div key={i} className={`flex-1 min-w-[100px] p-3 rounded-xl border ${s.color} text-center`}>
                        <div className="text-[16px] font-bold">{s.step}</div>
                        <div className="text-[12px] font-semibold mt-0.5">{s.label}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">{s.desc}</div>
                      </div>
                    ) : (
                      <span key={i} className="text-gray-300 text-lg font-bold">→</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Offres commerciales */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Bell className="w-4 h-4 text-amber-600" />
                      </span>
                      Offres Commerciales
                    </h2>
                    <p className="text-[12px] text-gray-400 mt-1">Promotions, bonus et arguments que Rita peut proposer au bon moment.</p>
                  </div>
                  <Toggle enabled={config.commercialOffersEnabled} onChange={v => set('commercialOffersEnabled', v)} label="" />
                </div>
                {config.commercialOffersEnabled && (
                  <div className="p-6 space-y-4">
                    <Field label="Offre de relance globale">
                      <textarea
                        value={config.followUpOffer || ''}
                        onChange={e => set('followUpOffer', e.target.value)}
                        rows={2}
                        placeholder="Ex: pour aujourd'hui seulement, livraison offerte ou bonus inclus"
                        className="ac-textarea"
                      />
                    </Field>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={addCommercialOffer}
                        className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        style={{ color: ACCENT, background: 'rgba(15,107,79,0.08)' }}
                      >
                        + Ajouter une offre
                      </button>
                    </div>

                    {(config.commercialOffers || []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-[12px] text-gray-400">
                        Aucune offre configurée.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(config.commercialOffers || []).map((offer, idx) => (
                          <div key={idx} className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50/60">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[13px] font-bold text-gray-800">Offre {idx + 1}</p>
                              <div className="flex items-center gap-2">
                                <Toggle enabled={offer.active !== false} onChange={v => updateCommercialOffer(idx, 'active', v)} label="" />
                                <button type="button" onClick={() => removeCommercialOffer(idx)} className="text-[12px] text-red-500 hover:text-red-700">
                                  Supprimer
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Field label="Titre">
                                <input value={offer.title || ''} onChange={e => updateCommercialOffer(idx, 'title', e.target.value)} className="ac-input" />
                              </Field>
                              <Field label="Déclencheur">
                                <SelectDropdown
                                  value={offer.trigger || 'hesitation'}
                                  onChange={v => updateCommercialOffer(idx, 'trigger', v)}
                                  options={OFFER_TRIGGER_OPTIONS}
                                />
                              </Field>
                            </div>
                            <Field label="S'applique à">
                              <input value={offer.appliesTo || ''} onChange={e => updateCommercialOffer(idx, 'appliesTo', e.target.value)} placeholder="Tous les produits / produit spécifique / clients revendeurs" className="ac-input" />
                            </Field>
                            <Field label="Bénéfice client">
                              <input value={offer.benefit || ''} onChange={e => updateCommercialOffer(idx, 'benefit', e.target.value)} placeholder="Réduction, bonus, livraison, cadeau" className="ac-input" />
                            </Field>
                            <Field label="Message à utiliser">
                              <textarea value={offer.message || ''} onChange={e => updateCommercialOffer(idx, 'message', e.target.value)} rows={2} className="ac-textarea" />
                            </Field>
                            <Field label="Conditions">
                              <textarea value={offer.conditions || ''} onChange={e => updateCommercialOffer(idx, 'conditions', e.target.value)} rows={2} className="ac-textarea" />
                            </Field>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cas spéciaux */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    </span>
                    Gestion des Cas Spéciaux
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Comment Rita réagit à chaque situation particulière</p>
                </div>
                <div className="p-6 space-y-2">
                  {(config.specialCases || SPECIAL_CASES_DEFAULT).map((sc, idx) => (
                    <div key={sc.trigger} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                      sc.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-gray-700">{sc.label}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">→ {sc.reaction}</p>
                      </div>
                      <Toggle enabled={sc.enabled} onChange={v => {
                        const updated = [...(config.specialCases || SPECIAL_CASES_DEFAULT)];
                        updated[idx] = { ...updated[idx], enabled: v };
                        set('specialCases', updated);
                      }} label="" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Résumé des règles actives */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900">État des Règles</h2>
                </div>
                <div className="p-5 space-y-2.5">
                  {[
                    { label: 'Répondre avant vendre', active: config.alwaysAnswerFirst },
                    { label: 'Pas de forcing', active: config.neverForceSale },
                    { label: 'Anti-spam', active: config.noSpam },
                    { label: 'Discussion naturelle', active: config.naturalConversation },
                    { label: 'Détection client', active: config.detectClientType },
                    { label: 'Niveau d\'intérêt', active: config.detectInterestLevel },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-2.5 text-[12px]">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                      <span className={`font-medium ${r.active ? 'text-gray-700' : 'text-gray-400'}`}>{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-[12px] font-semibold text-emerald-700 mb-1">🎯 Objectif Final</p>
                <p className="text-[11px] text-emerald-600 leading-relaxed">
                  Rita est une vendeuse intelligente, autonome et performante.
                  Son objectif : vendre efficacement, créer une bonne expérience client et s'améliorer chaque jour.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900">Prix & Négociation</h2>
                </div>
                <div className="p-5 space-y-3">
                  <Toggle enabled={config.pricingNegotiation?.enabled} onChange={v => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), enabled: v })}
                    label="Activer la négociation"
                    description="Permet à Rita de gérer les discussions prix selon vos règles" />
                  {config.pricingNegotiation?.enabled && (
                    <>
                      <Toggle enabled={config.pricingNegotiation?.allowDiscount} onChange={v => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), allowDiscount: v })}
                        label="Autoriser des remises"
                        description="Rita peut proposer une remise dans la limite fixée" />
                      <Field label="Remise maximum" hint="%">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={config.pricingNegotiation?.maxDiscountPercent || 0}
                          onChange={e => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), maxDiscountPercent: parseInt(e.target.value) || 0 })}
                          className="ac-input"
                        />
                      </Field>
                      <Toggle enabled={config.pricingNegotiation?.priceIsFinal} onChange={v => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), priceIsFinal: v })}
                        label="Prix final"
                        description="Rita rappelle que le prix reste ferme hors cas prévus" />
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-[12px] font-semibold text-blue-700 mb-1">💡 Conseil Pro</p>
                <p className="text-[11px] text-blue-600 leading-relaxed">
                  Gardez toutes les règles activées pour une vente optimale.
                  Désactivez un cas spécial uniquement si vous voulez que Rita l'ignore.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: PRODUITS ─── */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-gray-900">Catalogue Produits</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">{config.productCatalog.length} produit{config.productCatalog.length !== 1 ? 's' : ''} configuré{config.productCatalog.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={addProduct}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-bold text-white rounded-xl transition-all shadow-sm hover:shadow-md"
                style={{ background: ACCENT }}>
                + Ajouter un produit
              </button>
            </div>

            {config.productCatalog.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-[14px] font-semibold text-gray-500">Aucun produit</p>
                <p className="text-[12px] text-gray-400 mt-1">Ajoutez vos produits pour que l'agent puisse les recommander</p>
              </div>
            ) : (
              <div className="space-y-3">
                {config.productCatalog.map((product, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <button onClick={() => setEditingProduct(editingProduct === idx ? null : idx)} type="button"
                      className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[16px]">
                          {product.images?.length > 0 ? '🖼️' : '📦'}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-gray-900">{product.name || 'Produit sans nom'}</p>
                          <p className="text-[12px] text-gray-400">{product.price || 'Prix non défini'}{product.category ? ` · ${product.category}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.inStock !== false ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                          {product.inStock !== false ? 'En stock' : 'Rupture'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${editingProduct === idx ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {editingProduct === idx && (
                      <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Nom du produit" required>
                            <input value={product.name} onChange={e => updateProduct(idx, 'name', e.target.value)} className="ac-input" />
                          </Field>
                          <Field label="Prix">
                            <input value={product.price} onChange={e => updateProduct(idx, 'price', e.target.value)} placeholder="15000 FCFA" className="ac-input" />
                          </Field>
                          <Field label="Catégorie">
                            <input value={product.category || ''} onChange={e => updateProduct(idx, 'category', e.target.value)} className="ac-input" />
                          </Field>
                          <Field label="En stock">
                            <Toggle enabled={product.inStock !== false} onChange={v => updateProduct(idx, 'inStock', v)} label="" />
                          </Field>
                        </div>
                        <Field label="Description">
                          <textarea value={product.description || ''} onChange={e => updateProduct(idx, 'description', e.target.value)} rows={3} className="ac-textarea" />
                        </Field>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[13px] font-bold text-amber-800">Offres de quantité</p>
                              <p className="text-[11px] text-amber-700">Exemple: 1 = 10 000 FCFA, 2 = 15 000 FCFA</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addProductQuantityOffer(idx)}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-semibold hover:bg-amber-700 transition-colors"
                            >
                              + Ajouter palier
                            </button>
                          </div>

                          {(product.quantityOffers || []).length === 0 ? (
                            <p className="text-[11px] text-amber-700">Aucun palier configuré.</p>
                          ) : (
                            <div className="space-y-2">
                              {(product.quantityOffers || []).map((offer, offerIdx) => (
                                <div key={offerIdx} className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-xl border border-amber-100 bg-white p-3">
                                  <Field label="Qté min">
                                    <input
                                      type="number"
                                      min="1"
                                      value={offer.minQuantity || 1}
                                      onChange={e => updateProductQuantityOffer(idx, offerIdx, 'minQuantity', e.target.value)}
                                      className="ac-input"
                                    />
                                  </Field>
                                  <Field label="Prix total">
                                    <input
                                      value={offer.totalPrice || ''}
                                      onChange={e => updateProductQuantityOffer(idx, offerIdx, 'totalPrice', e.target.value)}
                                      placeholder="15000 FCFA"
                                      className="ac-input"
                                    />
                                  </Field>
                                  <Field label="Prix unitaire (optionnel)">
                                    <input
                                      value={offer.unitPrice || ''}
                                      onChange={e => updateProductQuantityOffer(idx, offerIdx, 'unitPrice', e.target.value)}
                                      placeholder="7500 FCFA"
                                      className="ac-input"
                                    />
                                  </Field>
                                  <div className="flex items-end">
                                    <button
                                      type="button"
                                      onClick={() => removeProductQuantityOffer(idx, offerIdx)}
                                      className="w-full px-3 py-2 rounded-lg border border-red-200 text-red-600 text-[11px] font-semibold hover:bg-red-50 transition-colors"
                                    >
                                      Retirer
                                    </button>
                                  </div>
                                  <div className="md:col-span-4">
                                    <Field label="Libellé (optionnel)">
                                      <input
                                        value={offer.label || ''}
                                        onChange={e => updateProductQuantityOffer(idx, offerIdx, 'label', e.target.value)}
                                        placeholder="Pack découverte"
                                        className="ac-input"
                                      />
                                    </Field>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[13px] font-bold text-gray-800">Images du produit</p>
                                <p className="text-[11px] text-gray-400">Upload direct ou ajout par URL.</p>
                              </div>
                              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={async (e) => {
                                    await handleProductMediaUpload(idx, 'images', e.target.files);
                                    e.target.value = '';
                                  }}
                                />
                                Upload images
                              </label>
                            </div>
                            {mediaUploadingByProduct[`${idx}:images`] && (
                              <div className="text-[11px] text-emerald-600">Upload des images en cours...</div>
                            )}
                            {(product.images || []).length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {(product.images || []).map((url, imageIndex) => (
                                  <div key={imageIndex} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-square">
                                    <img src={url} alt={`Produit ${imageIndex + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
                                      <a href={url} target="_blank" rel="noreferrer" className="text-[10px] text-white underline">Voir</a>
                                      <button type="button" onClick={() => removeProductMedia(idx, 'images', imageIndex)} className="text-[10px] text-white bg-black/30 px-2 py-1 rounded-md">
                                        Retirer
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <Field label="URLs images" hint="une par ligne">
                              <textarea
                                value={(product.images || []).join('\n')}
                                onChange={e => updateProduct(idx, 'images', e.target.value.split('\n').filter(u => u.trim()))}
                                rows={3}
                                className="ac-textarea text-[12px]"
                                placeholder="https://..."
                              />
                            </Field>
                          </div>

                          <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[13px] font-bold text-gray-800">Vidéos du produit</p>
                                <p className="text-[11px] text-gray-400">Ajoutez les vidéos de démonstration ou de preuve.</p>
                              </div>
                              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">
                                <input
                                  type="file"
                                  accept="video/*"
                                  multiple
                                  className="hidden"
                                  onChange={async (e) => {
                                    await handleProductMediaUpload(idx, 'videos', e.target.files);
                                    e.target.value = '';
                                  }}
                                />
                                Upload vidéos
                              </label>
                            </div>
                            {mediaUploadingByProduct[`${idx}:videos`] && (
                              <div className="text-[11px] text-blue-600">Upload des vidéos en cours...</div>
                            )}
                            {(product.videos || []).length > 0 && (
                              <div className="space-y-2">
                                {(product.videos || []).map((url, videoIndex) => (
                                  <div key={videoIndex} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[12px] font-medium text-gray-700 truncate">Vidéo {videoIndex + 1}</p>
                                      <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 truncate block hover:underline">
                                        {url}
                                      </a>
                                    </div>
                                    <button type="button" onClick={() => removeProductMedia(idx, 'videos', videoIndex)} className="text-[11px] text-red-500 hover:text-red-700">
                                      Retirer
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <Field label="URLs vidéos" hint="une par ligne">
                              <textarea
                                value={(product.videos || []).join('\n')}
                                onChange={e => updateProduct(idx, 'videos', e.target.value.split('\n').filter(u => u.trim()))}
                                rows={3}
                                className="ac-textarea text-[12px]"
                                placeholder="https://..."
                              />
                            </Field>
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button onClick={() => removeProduct(idx)}
                            className="text-[12px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                            Supprimer ce produit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: STOCK ─── */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900">Gestion du Stock</h2>
                  <p className="text-[12px] text-gray-400 mt-0.5">L'agent adapte ses réponses en fonction du stock disponible</p>
                </div>
                <Toggle enabled={config.stockManagementEnabled} onChange={v => set('stockManagementEnabled', v)} label="" />
              </div>
              {config.stockManagementEnabled && (
                <div className="p-6 space-y-4">
                  <div className="flex justify-end">
                    <button onClick={addStockEntry}
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors" style={{ color: ACCENT, background: 'rgba(15,107,79,0.08)' }}>
                      + Ajouter une entrée
                    </button>
                  </div>
                  {(config.stockEntries || []).length === 0 ? (
                    <p className="text-center text-[13px] text-gray-400 py-6">Aucune entrée de stock. Ajoutez vos produits pour activer le suivi.</p>
                  ) : (
                    <div className="space-y-2">
                      {(config.stockEntries || []).map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <input value={entry.productName || ''} onChange={e => updateStockEntry(idx, 'productName', e.target.value)}
                            placeholder="Nom du produit" className="ac-input flex-1 !bg-white" />
                          <input type="number" value={entry.quantity || 0} onChange={e => updateStockEntry(idx, 'quantity', parseInt(e.target.value) || 0)}
                            className="ac-input w-20 !bg-white text-center" min="0" />
                          <button onClick={() => removeStockEntry(idx)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: PROFIL ADMIN ─── */}
        {activeTab === 'admin-profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Coordonnées Admin */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <UserCog className="w-4 h-4 text-blue-600" />
                    </span>
                    Coordonnées de l'Administrateur
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Informations utilisées par Rita pour vous contacter et personnaliser les interactions</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nom de l'admin" required>
                      <div className="relative">
                        <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input value={config.adminName} onChange={e => set('adminName', e.target.value)}
                          placeholder="ex: Mohamed Diallo" className="ac-input !pl-10" />
                      </div>
                    </Field>
                    <Field label="Téléphone admin (WhatsApp)" required>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input value={config.bossPhone} onChange={e => set('bossPhone', e.target.value)}
                          placeholder="ex: +225 07 00 00 00" className="ac-input !pl-10" />
                      </div>
                    </Field>
                  </div>
                  <Field label="Email de l'admin">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" value={config.adminEmail} onChange={e => set('adminEmail', e.target.value)}
                        placeholder="ex: admin@monshop.com" className="ac-input !pl-10" />
                    </div>
                  </Field>
                </div>
              </div>

              {/* Informations Business */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-purple-600" />
                    </span>
                    Informations du Business
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Rita utilise ces informations pour mieux représenter votre marque</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nom du business / boutique" required>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input value={config.businessName} onChange={e => set('businessName', e.target.value)}
                          placeholder="ex: Zendo Store" className="ac-input !pl-10" />
                      </div>
                    </Field>
                    <Field label="Ville / Localisation">
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input value={config.businessCity} onChange={e => set('businessCity', e.target.value)}
                          placeholder="ex: Abidjan, Côte d'Ivoire" className="ac-input !pl-10" />
                      </div>
                    </Field>
                  </div>
                  <Field label="Description de l'activité" hint="courte présentation pour Rita">
                    <textarea value={config.businessDescription} onChange={e => set('businessDescription', e.target.value)}
                      rows={3} className="ac-textarea"
                      placeholder="ex: Boutique en ligne de cosmétiques naturels. Nous livrons dans toute la Côte d'Ivoire..." />
                  </Field>
                </div>
              </div>
            </div>

            {/* Sidebar résumé */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900">Résumé du Profil</h2>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <UserCog className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 truncate">{config.adminName || 'Non renseigné'}</p>
                      <p className="text-[11px] text-gray-400 truncate">{config.bossPhone || 'Aucun téléphone'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 truncate">{config.businessName || 'Non renseigné'}</p>
                      <p className="text-[11px] text-gray-400 truncate">{config.businessCity || 'Aucune ville'}</p>
                    </div>
                  </div>
                  {config.adminEmail && (
                    <div className="flex items-center gap-2 p-2 text-[12px] text-gray-500">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{config.adminEmail}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-[12px] font-semibold text-amber-700 mb-1">💡 Pourquoi ces infos ?</p>
                <p className="text-[11px] text-amber-600 leading-relaxed">
                  Rita utilise votre nom et numéro pour les escalades et notifications.
                  Les infos business enrichissent ses réponses clients et renforcent la crédibilité.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: TÉMOIGNAGES ─── */}
        {activeTab === 'testimonials' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Star className="w-4 h-4 text-amber-600" />
                    </span>
                    Témoignages Clients
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">
                    Rita utilisera ces témoignages pour convaincre les clients hésitants. 
                    Ajoutez des photos/vidéos pour plus d'impact.
                  </p>
                </div>
                <Toggle enabled={config.testimonialsEnabled} onChange={v => set('testimonialsEnabled', v)} label="Activer" />
              </div>

              {config.testimonialsEnabled && (
                <div className="p-6 space-y-4">
                  <p className="text-[12px] text-gray-500 bg-amber-50 border border-amber-100 rounded-xl p-3">
                    💡 Quand un client hésite ou ne répond plus après le prix, Rita enverra automatiquement un témoignage pertinent avec sa photo/vidéo pour rassurer et convaincre.
                  </p>

                  {(config.testimonials || []).map((t, idx) => {
                    const selectedProduct = (config.productCatalog || []).find(p => p.name === t.productName);
                    return (
                      <div key={idx} className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <span className="text-[12px] font-bold text-gray-500">Témoignage #{idx + 1}</span>
                          <button onClick={() => removeTestimonial(idx)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Product Selection */}
                        <div>
                          <label className="text-[12px] font-semibold text-gray-600 mb-2 block">
                            🎯 Produit (sélection directe du catalogue)
                          </label>
                          <select value={t.productName || ''} onChange={e => updateTestimonial(idx, 'productName', e.target.value)}
                            className="w-full ac-input">
                            <option value="">-- Choisir un produit --</option>
                            {(config.productCatalog || []).map(p => (
                              <option key={p.name} value={p.name}>
                                {p.name} {p.price ? `• ${p.price}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Product Preview */}
                        {selectedProduct && (
                          <div className="bg-white rounded-lg border border-emerald-200 p-3 flex gap-3">
                            {selectedProduct.images?.[0] && (
                              <img src={selectedProduct.images[0]} alt="" className="w-20 h-20 rounded-lg object-cover" />
                            )}
                            <div className="flex-1 text-[11px]">
                              <p className="font-bold text-gray-900">{selectedProduct.name}</p>
                              {selectedProduct.price && <p className="text-emerald-600 font-semibold">{selectedProduct.price}</p>}
                              {selectedProduct.description && <p className="text-gray-500 line-clamp-2 mt-1">{selectedProduct.description}</p>}
                            </div>
                          </div>
                        )}

                        {/* Client & Rating */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Nom du client">
                            <input value={t.clientName || ''} onChange={e => updateTestimonial(idx, 'clientName', e.target.value)}
                              placeholder="ex: Marie D." className="ac-input" />
                          </Field>
                          <Field label="Note (1-5 étoiles)">
                            <select value={t.rating || 5} onChange={e => updateTestimonial(idx, 'rating', parseInt(e.target.value))}
                              className="ac-input">
                              {[1, 2, 3, 4, 5].map(n => (
                                <option key={n} value={n}>{n} {'⭐'.repeat(n)}</option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        {/* Flexible Content */}
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-[11px] text-amber-700">
                          💡 <strong>Flexible:</strong> Vous pouvez avoir du texte seul, des images seules, ou une combinaison. 
                          Tous les champs sont optionnels.
                        </div>

                        {/* Text */}
                        <Field label="Texte du témoignage (optionnel)">
                          <textarea value={t.text || ''} onChange={e => updateTestimonial(idx, 'text', e.target.value)}
                            placeholder="ex: J'ai essayé ce produit et en 2 semaines ma peau a vraiment changé ! Je recommande fortement..."
                            rows={2} className="ac-input text-[13px]" />
                        </Field>

                        {/* Images */}
                        <div>
                          <label className="text-[12px] font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                            <Image className="w-3.5 h-3.5" /> Photos du témoignage (optionnel)
                          </label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {(t.images || []).map((url, imgIdx) => (
                              <div key={imgIdx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                                <button onClick={() => removeTestimonialMedia(idx, 'images', imgIdx)}
                                  className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-100 transition-colors">
                            <input type="file" accept="image/*" multiple className="hidden"
                              onChange={async (e) => { await handleTestimonialMediaUpload(idx, 'images', e.target.files); e.target.value = ''; }} />
                            <Plus className="w-3 h-3" /> Ajouter photos
                          </label>
                          {testimonialUploading[`${idx}:images`] && <span className="text-[11px] text-emerald-600 ml-2">Upload en cours...</span>}
                        </div>

                        {/* Videos */}
                        <div>
                          <label className="text-[12px] font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                            <Video className="w-3.5 h-3.5" /> Vidéos du témoignage (optionnel)
                          </label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {(t.videos || []).map((url, vidIdx) => (
                              <div key={vidIdx} className="relative group flex items-center gap-2 px-2 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-[11px]">
                                <Video className="w-3.5 h-3.5 text-gray-500" />
                                <span className="text-gray-600 max-w-[120px] truncate">{url.split('/').pop()}</span>
                                <button onClick={() => removeTestimonialMedia(idx, 'videos', vidIdx)}
                                  className="text-red-400 hover:text-red-600 transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                            <input type="file" accept="video/*" multiple className="hidden"
                              onChange={async (e) => { await handleTestimonialMediaUpload(idx, 'videos', e.target.files); e.target.value = ''; }} />
                            <Plus className="w-3 h-3" /> Ajouter vidéos
                          </label>
                          {testimonialUploading[`${idx}:videos`] && <span className="text-[11px] text-blue-600 ml-2">Upload en cours...</span>}
                        </div>
                      </div>
                    );
                  })}

                  <button onClick={addTestimonial}
                    className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-[13px] font-semibold text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Ajouter un témoignage
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: PILOTAGE (Admin-Rita Interaction) ─── */}
        {activeTab === 'admin-pilotage' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">

              {/* Mode Boss — Analyse */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <span className="text-sm">🧑‍💼</span>
                    </span>
                    Mode Boss — Analyse
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Quand vous parlez à Rita, elle est professionnelle, analytique et directe</p>
                </div>
                <div className="p-6 space-y-1">
                  <Toggle enabled={config.bossAnalyzeConversations} onChange={v => set('bossAnalyzeConversations', v)}
                    label="Analyser les conversations"
                    description="Rita peut analyser et résumer les conversations clients pour vous" />
                  <Toggle enabled={config.bossExplainErrors} onChange={v => set('bossExplainErrors', v)}
                    label="Expliquer les erreurs"
                    description="Rita identifie et explique ses erreurs de vente" />
                  <Toggle enabled={config.bossSuggestImprovements} onChange={v => set('bossSuggestImprovements', v)}
                    label="Proposer des améliorations"
                    description="Rita suggère des améliorations pour les prochaines conversations" />
                </div>
                <div className="px-6 pb-6">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-[11px] text-blue-600 leading-relaxed">
                      <span className="font-semibold text-blue-700">En Mode Boss :</span> Rita ne vend pas. Elle vous répond avec des analyses claires, des chiffres et des recommandations concrètes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mode Exécution Boss */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-600" />
                    </span>
                    Mode Exécution Boss
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Quand vous donnez une instruction, Rita l'exécute intelligemment</p>
                </div>
                <div className="p-6 space-y-3">
                  <Toggle enabled={config.executionAdaptMessage} onChange={v => set('executionAdaptMessage', v)}
                    label="Adapter les messages"
                    description="Rita reformule vos instructions en un message naturel pour le client" />
                  <Toggle enabled={config.executionNeverCopy} onChange={v => set('executionNeverCopy', v)}
                    label="Ne jamais copier-coller"
                    description="Rita ne copie jamais le message du boss tel quel, elle l'adapte" />

                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Exemples d'exécution</p>
                    {[
                      { boss: '"Envoie la photo"', rita: '"Je vous envoie la photo 👍 vous en pensez quoi ?"' },
                      { boss: '"Relance le client"', rita: '"Bonjour 😊 je reviens vers vous pour savoir si vous êtes toujours intéressé"' },
                      { boss: '"Envoie fichier"', rita: 'Envoi + message naturel d\'accompagnement' },
                    ].map((ex, i) => (
                      <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="flex-1">
                          <p className="text-[11px] text-gray-400">Boss dit :</p>
                          <p className="text-[12px] font-medium text-gray-600">{ex.boss}</p>
                        </div>
                        <div className="text-gray-300 self-center">→</div>
                        <div className="flex-1">
                          <p className="text-[11px] text-emerald-500">Rita envoie :</p>
                          <p className="text-[12px] font-medium text-emerald-700">{ex.rita}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-amber-600" />
                    </span>
                    Notifications Admin
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Contrôlez quand Rita vous envoie des alertes sur WhatsApp</p>
                </div>
                <div className="p-6 space-y-1">
                  <Toggle enabled={config.bossNotifications} onChange={v => set('bossNotifications', v)}
                    label="Activer les notifications"
                    description="Recevoir les alertes importantes sur votre WhatsApp" />
                  {config.bossNotifications && (
                    <div className="space-y-1 pt-1">
                      <Toggle enabled={config.notifyOnOrder} onChange={v => set('notifyOnOrder', v)}
                        label="Nouvelle commande"
                        description="Être notifié à chaque commande confirmée par Rita" />
                      <Toggle enabled={config.notifyOnScheduled} onChange={v => set('notifyOnScheduled', v)}
                        label="Rendez-vous / Relances"
                        description="Être alerté quand un suivi est planifié" />
                    </div>
                  )}
                </div>
              </div>

              {/* Escalade */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <Headphones className="w-4 h-4 text-red-500" />
                    </span>
                    Escalade vers l'Admin
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Quand Rita ne sait pas répondre, elle vous passe la main</p>
                </div>
                <div className="p-6 space-y-3">
                  <Toggle enabled={config.bossEscalationEnabled} onChange={v => set('bossEscalationEnabled', v)}
                    label="Activer l'escalade automatique"
                    description="Rita transfère au boss quand la situation dépasse son niveau" />
                  {config.bossEscalationEnabled && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Timeout d'escalade" hint="minutes">
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="number" value={config.bossEscalationTimeoutMin}
                              onChange={e => set('bossEscalationTimeoutMin', parseInt(e.target.value) || 30)}
                              min="5" max="180" className="ac-input !pl-10" />
                          </div>
                        </Field>
                        <Field label="Escalader après X messages" hint="sans résolution">
                          <input type="number" value={config.escalateAfterMessages}
                            onChange={e => set('escalateAfterMessages', parseInt(e.target.value) || 10)}
                            min="3" max="50" className="ac-input" />
                        </Field>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          <span className="font-semibold text-gray-600">Comment ça marche :</span> Si Rita ne parvient pas à résoudre la demande après <strong>{config.escalateAfterMessages}</strong> messages
                          ou si le client attend plus de <strong>{config.bossEscalationTimeoutMin} min</strong> sans réponse satisfaisante, elle vous envoie un résumé de la conversation sur votre WhatsApp.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Résumé quotidien */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-emerald-600" />
                    </span>
                    Résumé Quotidien
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Recevez un récap chaque jour de l'activité de Rita</p>
                </div>
                <div className="p-6 space-y-3">
                  <Toggle enabled={config.dailySummary} onChange={v => set('dailySummary', v)}
                    label="Recevoir le résumé quotidien"
                    description="Rita vous envoie un bilan de la journée (messages, commandes, escalades)" />
                  {config.dailySummary && (
                    <Field label="Heure d'envoi du résumé">
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="time" value={config.dailySummaryTime}
                          onChange={e => set('dailySummaryTime', e.target.value)}
                          className="ac-input !pl-10" />
                      </div>
                    </Field>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Status card */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900">État du pilotage</h2>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { label: 'Mode Boss', active: config.modeBossEnabled, icon: UserCog },
                    { label: 'Mode Exécution', active: config.modeExecutionEnabled, icon: Zap },
                    { label: 'Notifications', active: config.bossNotifications, icon: Bell },
                    { label: 'Escalade auto', active: config.bossEscalationEnabled, icon: Headphones },
                    { label: 'Résumé quotidien', active: config.dailySummary, icon: BarChart3 },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-3 p-2.5 rounded-lg">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.active ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                          <Icon className={`w-4 h-4 ${item.active ? 'text-emerald-600' : 'text-gray-400'}`} />
                        </div>
                        <span className="text-[13px] font-medium text-gray-700 flex-1">{item.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          {item.active ? 'ACTIF' : 'INACTIF'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!config.bossPhone && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <p className="text-[12px] font-semibold text-red-700 mb-1">⚠️ Numéro admin manquant</p>
                  <p className="text-[11px] text-red-600 leading-relaxed">
                    Pour recevoir les notifications et escalades, renseignez votre numéro WhatsApp dans l'onglet <strong>Profil Admin</strong>.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-[12px] font-semibold text-blue-700 mb-1">🎯 Conseil</p>
                <p className="text-[11px] text-blue-600 leading-relaxed">
                  Pour un bon équilibre, activez les notifications sur commandes et le résumé quotidien.
                  L'escalade automatique est recommandée quand l'autonomie de Rita est à 3 ou plus.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: ANALYTIQUES ─── */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            {/* Period selector */}
            <div className="flex gap-2">
              {[{ v: 1, l: "Aujourd'hui" }, { v: 7, l: '7 jours' }, { v: 30, l: '30 jours' }].map(p => (
                <button key={p.v} onClick={() => setAnalyticsDays(p.v)}
                  className={`px-4 py-2 text-[12px] font-semibold rounded-xl transition-all ${
                    analyticsDays === p.v ? 'text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  style={analyticsDays === p.v ? { background: ACCENT } : {}}>
                  {p.l}
                </button>
              ))}
            </div>

            {analyticsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : !activityData ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-[14px] text-gray-500">Aucune donnée disponible</p>
              </div>
            ) : (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Messages reçus', value: activityData.stats?.messagesReceived || 0, color: '#3b82f6', bg: 'bg-blue-50' },
                    { label: 'Réponses', value: activityData.stats?.messagesReplied || 0, color: ACCENT, bg: 'bg-emerald-50' },
                    { label: 'Commandes', value: activityData.stats?.ordersConfirmed || 0, color: '#8b5cf6', bg: 'bg-purple-50' },
                    { label: 'Clients uniques', value: activityData.stats?.uniqueClients || 0, color: '#f59e0b', bg: 'bg-amber-50' },
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-2xl p-5 text-center`}>
                      <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-medium">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Recent activity */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-[15px] font-bold text-gray-900">Activité récente</h2>
                  </div>
                  <div className="p-6">
                    {(activityData.recent || []).length === 0 ? (
                      <p className="text-center text-[13px] text-gray-400 py-6">Aucune activité pour cette période</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                        {(activityData.recent || []).map((a, i) => {
                          const LABELS = {
                            message_received: { label: 'Message reçu', emoji: '💬', bg: 'bg-blue-50 text-blue-700' },
                            message_replied: { label: 'Réponse', emoji: '📤', bg: 'bg-emerald-50 text-emerald-700' },
                            order_confirmed: { label: 'Commande', emoji: '📦', bg: 'bg-purple-50 text-purple-700' },
                            vocal_transcribed: { label: 'Vocal', emoji: '🎤', bg: 'bg-amber-50 text-amber-700' },
                          };
                          const info = LABELS[a.type] || { label: a.type, emoji: '•', bg: 'bg-gray-50 text-gray-600' };
                          return (
                            <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${info.bg}`}>
                              <span className="text-sm">{info.emoji}</span>
                              <span className="text-[12px] font-medium flex-1">{info.label}{a.customerName ? ` — ${a.customerName}` : ''}</span>
                              <span className="text-[10px] opacity-50">
                                {new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}{' '}
                                {new Date(a.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── TAB: CONTACTS ─── */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">Liste des contacts Rita</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">{contactsTotal} contact{contactsTotal !== 1 ? 's' : ''} enregistré{contactsTotal !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={exportContactsCSV}
                className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white rounded-xl shadow-sm hover:opacity-90 transition-all"
                style={{ background: ACCENT }}>
                <Download className="w-4 h-4" />
                Exporter CSV
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : contactsList.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-[14px] text-gray-500">Aucun contact enregistré</p>
                  <p className="text-[12px] text-gray-400 mt-1">Les contacts s'enregistrent automatiquement dès le premier message reçu</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">N°</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Téléphone</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Nom</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Ville</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Messages</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Commandé</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Premier contact</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Dernier message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactsList.map((c, i) => (
                        <tr key={c.clientNumber} className={`border-b border-gray-50 hover:bg-gray-50/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/20'}`}>
                          <td className="px-4 py-3 font-mono text-gray-400">#{c.clientNumber}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{c.phone}</td>
                          <td className="px-4 py-3 text-gray-600">{c.nom || c.pushName || <span className="text-gray-300 italic">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600">{c.ville || <span className="text-gray-300 italic">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600">{c.messageCount}</td>
                          <td className="px-4 py-3">
                            {c.hasOrdered
                              ? <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px]">✓ Oui</span>
                              : <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[11px]">Non</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {c.firstMessageAt ? new Date(c.firstMessageAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {contactsTotal > 50 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  disabled={contactsPage === 1}
                  onClick={() => fetchContacts(contactsPage - 1)}
                  className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  ← Précédent
                </button>
                <span className="text-[12px] text-gray-500">Page {contactsPage} / {Math.ceil(contactsTotal / 50)}</span>
                <button
                  disabled={contactsPage >= Math.ceil(contactsTotal / 50)}
                  onClick={() => fetchContacts(contactsPage + 1)}
                  className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Suivant →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ BOTTOM SAVE BAR ═══ */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)] z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-[13px] font-medium text-gray-600">Modifications non enregistrées</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleReset}
                className="px-4 py-2 text-[13px] font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Réinitialiser
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-[13px] font-bold text-white rounded-xl disabled:opacity-50 transition-all"
                style={{ background: ACCENT }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Enregistrer maintenant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save status toast */}
      {saveStatus && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-[13px] font-semibold shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
          saveStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {saveStatus === 'success' ? '✅ Configuration enregistrée' : '❌ Erreur lors de la sauvegarde'}
        </div>
      )}

      {/* ═══ STYLES ═══ */}
      <style>{`
        .ac-input {
          width: 100%;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 450;
          color: #1f2937;
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          outline: none;
          transition: all .2s cubic-bezier(.4,0,.2,1);
        }
        .ac-input:hover { border-color: #d1d5db; background: #fff; }
        .ac-input:focus { border-color: ${ACCENT}; box-shadow: 0 0 0 3px rgba(15,107,79,0.1); background: #fff; }
        .ac-input::placeholder { color: #9ca3af; font-weight: 400; }
        .ac-textarea {
          width: 100%;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 450;
          color: #1f2937;
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          outline: none;
          transition: all .2s cubic-bezier(.4,0,.2,1);
          resize: vertical;
        }
        .ac-textarea:hover { border-color: #d1d5db; background: #fff; }
        .ac-textarea:focus { border-color: ${ACCENT}; box-shadow: 0 0 0 3px rgba(15,107,79,0.1); background: #fff; }
        .ac-textarea::placeholder { color: #9ca3af; font-weight: 400; }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: ${ACCENT};
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px; height: 18px;
          border-radius: 50%;
          background: ${ACCENT};
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  );
}
