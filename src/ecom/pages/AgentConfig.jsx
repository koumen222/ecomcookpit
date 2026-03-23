import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Save, ChevronDown, Send, RotateCcw, Bell, Settings, Bot, MessageSquare, Sparkles, Package, BarChart3, Warehouse, UserCog, Headphones, Clock, Mail, Phone, Building2, MapPin, Zap, ShieldCheck, Globe2, Target, AlertTriangle, Users, MessageCircle, TrendingUp, Eye } from 'lucide-react';
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
  { id: 'admin-pilotage', label: 'Pilotage', icon: Headphones },
  { id: 'analytics', label: 'Analytiques', icon: BarChart3 },
];

const TONE_OPTIONS = [
  { value: 'warm', label: '🤗 Chaleureuse', desc: 'Naturelle, humaine, amicale' },
  { value: 'professional', label: '💼 Professionnelle', desc: 'Sérieuse mais accessible' },
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
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-white transition-all">
        <span className="truncate">{selected ? selected.label : <span className="text-gray-400">{placeholder}</span>}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-xl py-1 max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-top-1">
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

  // Chat simulator
  const [simMessages, setSimMessages] = useState([]);
  const [simInput, setSimInput] = useState('');
  const [simTyping, setSimTyping] = useState(false);
  const simEndRef = useRef(null);

  // Product editing
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState(new Set());

  // Analytics
  const [activityData, setActivityData] = useState(null);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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
    welcomeMessage: "Bonjour ! 😊 Bienvenue chez nous. Comment puis-je vous aider aujourd'hui ?",
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
  });

  const [savedConfig, setSavedConfig] = useState(null);

  const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
  const userId = user._id || user.id;

  const set = useCallback((field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  // ─── Load ───
  useEffect(() => {
    const load = async () => {
      try {
        const [configRes, instRes] = await Promise.all([
          ecomApi.get(`/v1/external/whatsapp/rita-config?userId=${userId}`),
          ecomApi.get(`/v1/external/whatsapp/instances?userId=${userId}`),
        ]);
        if (configRes.data.success && configRes.data.config) {
          setConfig(prev => ({ ...prev, ...configRes.data.config }));
          setSavedConfig(configRes.data.config);
          setSimMessages([{
            role: 'agent',
            text: configRes.data.config.welcomeMessage || "Bonjour ! Comment puis-je vous aider ?",
            time: '14:30',
          }]);
        }
        if (instRes.data.success) setInstances(instRes.data.instances || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, [userId]);

  useEffect(() => { simEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [simMessages, simTyping]);

  // ─── Save ───
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const { data } = await ecomApi.post('/v1/external/whatsapp/rita-config', { userId, config });
      if (!data.success) { setSaveStatus('error'); return; }
      await ecomApi.post('/v1/external/whatsapp/activate', {
        userId, enabled: config.enabled, instanceId: config.instanceId || undefined,
      });
      setSaveStatus('success');
      setSavedConfig({ ...config });
      setHasChanges(false);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch { setSaveStatus('error'); }
    finally { setSaving(false); }
  };

  const handleReset = () => {
    if (savedConfig) {
      setConfig(prev => ({ ...prev, ...savedConfig }));
      setHasChanges(false);
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
    const newP = { name: '', price: '', description: '', category: '', images: [], videos: [], features: [], faq: [], objections: [], inStock: true };
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
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-emerald-600" />
                    </span>
                    Identité de l'Agent
                  </h2>
                </div>
                <div className="p-6 space-y-4">
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
                </div>
              </div>

              {/* Gestion des langues */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
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
                        <Field label="URLs images" hint="une par ligne">
                          <textarea
                            value={(product.images || []).join('\n')}
                            onChange={e => updateProduct(idx, 'images', e.target.value.split('\n').filter(u => u.trim()))}
                            rows={2} className="ac-textarea text-[12px]" placeholder="https://..." />
                        </Field>
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
