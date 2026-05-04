import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Save, ChevronDown, Send, RotateCcw, Bell, Settings, Bot, MessageSquare, Sparkles, Package, BarChart3, Warehouse, UserCog, Headphones, Clock, Mail, Phone, Building2, MapPin, Zap, ShieldCheck, Globe2, Target, AlertTriangle, Users, MessageCircle, TrendingUp, Eye, Star, Trash2, Plus, Image, Video, X, Download, Upload, FileText, ToggleLeft, ToggleRight, Radio, PlayCircle, Truck, Megaphone } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ProductImportLocal from '../components/ProductImportLocal.jsx';

const ACCENT = '#0F6B4F';

// ─── Tabs ───
const TABS = [
  { id: 'identity', label: 'Identité', icon: Bot },
  { id: 'intelligence', label: 'Intelligence', icon: Sparkles },
  { id: 'sales-rules', label: 'Vente', icon: Target },
  { id: 'delivery', label: 'Livraison', icon: Truck },
  { id: 'products', label: 'Produits', icon: Package },
  { id: 'stock', label: 'Stock', icon: Warehouse },
  { id: 'admin-profile', label: 'Profil Admin', icon: UserCog },
  { id: 'testimonials', label: 'Témoignages', icon: Star },
  { id: 'admin-pilotage', label: 'Pilotage', icon: Headphones },
  { id: 'analytics', label: 'Analytiques', icon: BarChart3 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'statuts', label: 'Statuts', icon: Radio },
  { id: 'instructions', label: 'Instructions', icon: FileText },
  { id: 'group-animation', label: 'Groupes', icon: Megaphone },
  { id: 'marketing', label: 'Relances', icon: Send },
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
  { id: 'e3a12335ddd040209a99002ee76b682f', name: 'Sophie', gender: '♀', lang: 'FR', desc: 'Douce, bienveillante, assistante' },
];

const OFFER_TRIGGER_OPTIONS = [
  { value: 'hesitation', label: 'Client hésitant' },
  { value: 'price_objection', label: 'Objection prix' },
  { value: 'bulk_interest', label: 'Demande de quantité' },
  { value: 'follow_up', label: 'Relance' },
  { value: 'closing', label: 'Avant closing' },
];

// Villes par pays pour les expéditions
const CITIES_BY_COUNTRY = {
  CM: [ // Cameroun
    'Yaoundé', 'Douala', 'Bafoussam', 'Bamenda', 'Garoua', 'Maroua', 
    'Ngaoundéré', 'Bertoua', 'Buéa', 'Kribi', 'Limbé', 'Edéa', 'Kumba', 
    'Ebolowa', 'Foumban', 'Nkongsamba', 'Mbouda', 'Dschang', 'Bafang'
  ],
  CD: [ // RDC
    'Kinshasa', 'Lubumbashi', 'Mbuji-Mayi', 'Kananga', 'Kisangani', 
    'Bukavu', 'Goma', 'Matadi', 'Kolwezi', 'Likasi', 'Mbandaka'
  ],
  SN: [ // Sénégal
    'Dakar', 'Thiès', 'Kaolack', 'Saint-Louis', 'Ziguinchor', 
    'Diourbel', 'Louga', 'Tambacounda', 'Mbour', 'Rufisque'
  ],
  CI: [ // Côte d'Ivoire
    'Abidjan', 'Bouaké', 'Yamoussoukro', 'Daloa', 'San-Pédro', 
    'Korhogo', 'Man', 'Gagnoa', 'Divo', 'Abengourou'
  ],
  BJ: [ // Bénin
    'Cotonou', 'Porto-Novo', 'Parakou', 'Djougou', 'Abomey-Calavi', 
    'Bohicon', 'Kandi', 'Lokossa', 'Ouidah', 'Natitingou'
  ],
  TG: [ // Togo
    'Lomé', 'Sokodé', 'Kara', 'Atakpamé', 'Kpalimé', 
    'Dapaong', 'Tsévié', 'Aného', 'Bassar'
  ],
};

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
  <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-semibold text-gray-700">{label}</p>
      {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
    </div>
    <button type="button" onClick={() => onChange(!enabled)}
      className={`relative self-end sm:self-auto w-[44px] h-[26px] rounded-full transition-all duration-200 flex-shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-gray-200 hover:bg-gray-300'}`}>
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
  const location = useLocation();
  const agent = location.state?.agent || null;
  const agentId = agent?._id || agent?.id || null;

  const [activeTab, setActiveTab] = useState('identity');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [instances, setInstances] = useState([]);
  const [instanceSwitching, setInstanceSwitching] = useState(false);
  const [instanceSwitchStatus, setInstanceSwitchStatus] = useState(null);
  const [showImport, setShowImport] = useState(false);

  // Group animation
  const [groupConfig, setGroupConfig] = useState(null);
  const [whatsappGroups, setWhatsappGroups] = useState([]);
  const [groupProducts, setGroupProducts] = useState([]);
  const [groupNewName, setGroupNewName] = useState('');
  const [groupCreating, setGroupCreating] = useState(false);
  const [groupSelectedAdd, setGroupSelectedAdd] = useState('');
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupMsg, setGroupMsg] = useState(null);
  const [groupExpandedIdx, setGroupExpandedIdx] = useState(null);
  const [groupInviteLink, setGroupInviteLink] = useState('');
  const [groupJoining, setGroupJoining] = useState(false);
  const [groupAddMode, setGroupAddMode] = useState('invite'); // 'invite' | 'existing' | 'create'

  // Chat simulator
  const [simMessages, setSimMessages] = useState([]);
  const [simInput, setSimInput] = useState('');
  const [simTyping, setSimTyping] = useState(false);
  const simEndRef = useRef(null);

  // Statuts WhatsApp
  const [statuts, setStatuts] = useState([]);
  const [statutsLoading, setStatutsLoading] = useState(false);
  const [statutSending, setStatutSending] = useState(null);
  const [statutSaving, setStatutSaving] = useState(false);
  const [showStatutForm, setShowStatutForm] = useState(false);
  const [editingStatut, setEditingStatut] = useState(null);
  const [statutForm, setStatutForm] = useState({
    name: '', type: 'product', caption: '', mediaUrl: '', productName: '',
    backgroundColor: '#0F6B4F', scheduleType: 'daily', sendTime: '09:00', weekDays: [],
  });

  const loadStatuts = useCallback(async () => {
    setStatutsLoading(true);
    try {
      if (agentId) {
        const [{ data: agentData }, { data: userData }] = await Promise.all([
          ecomApi.get(`/v1/rita-status/schedules?agentId=${agentId}`),
          ecomApi.get('/v1/rita-status/schedules'),
        ]);

        const mergedSchedules = [...(agentData?.schedules || []), ...(userData?.schedules || [])]
          .filter((schedule, index, array) => array.findIndex(item => item._id === schedule._id) === index);

        setStatuts(mergedSchedules);
      } else {
        const { data } = await ecomApi.get('/v1/rita-status/schedules');
        if (data.success) setStatuts(data.schedules || []);
      }
    } catch (error) {
      console.error('Error loading statuts:', error);
    }
    setStatutsLoading(false);
  }, [agentId]);

  const saveStatut = async () => {
    if (statutForm.type === 'product' && !statutForm.productName?.trim()) {
      alert('Sélectionnez un produit pour ce statut.');
      return;
    }

    if (statutForm.type === 'image' && !statutForm.mediaUrl?.trim()) {
      alert('Ajoutez une URL d\'image pour ce statut.');
      return;
    }

    if (statutForm.type !== 'product' && !statutForm.caption?.trim()) {
      alert('Ajoutez un texte pour ce statut.');
      return;
    }

    if (statutForm.scheduleType === 'weekly' && !(statutForm.weekDays || []).length) {
      alert('Sélectionnez au moins un jour de publication.');
      return;
    }

    const scopeAgentId = editingStatut ? editingStatut.agentId : agentId;

    setStatutSaving(true);
    try {
      const partialStatusConfig = {};
      if (config.instanceId) {
        partialStatusConfig.instanceId = config.instanceId;
      }
      if (statutForm.type === 'product') {
        partialStatusConfig.productCatalog = config.productCatalog || [];
      }
      if (Object.keys(partialStatusConfig).length > 0) {
        await syncRitaConfigPartial(partialStatusConfig);
      }

      const payload = {
        ...statutForm,
        name: statutForm.name?.trim() || 'Statut automatique',
        caption: statutForm.caption?.trim() || '',
        mediaUrl: statutForm.mediaUrl?.trim() || '',
        productName: statutForm.productName?.trim() || '',
        weekDays: statutForm.scheduleType === 'weekly' ? (statutForm.weekDays || []) : [],
        ...(scopeAgentId ? { agentId: scopeAgentId } : {}),
      };

      if (editingStatut) {
        await ecomApi.put(`/v1/rita-status/schedules/${editingStatut._id}`, payload);
      } else {
        await ecomApi.post('/v1/rita-status/schedules', payload);
      }
      setShowStatutForm(false);
      setEditingStatut(null);
      setStatutForm({ name: '', type: 'product', caption: '', mediaUrl: '', productName: '', backgroundColor: '#0F6B4F', scheduleType: 'daily', sendTime: '09:00', weekDays: [] });
      await loadStatuts();
    } catch (error) {
      console.error('Error saving statut:', error);
      alert(error?.response?.data?.error || 'Impossible d\'enregistrer le statut.');
    } finally {
      setStatutSaving(false);
    }
  };

  const deleteStatut = async (id) => {
    await ecomApi.delete(`/v1/rita-status/schedules/${id}`);
    loadStatuts();
  };

  const sendNow = async (schedule) => {
    if (!config.instanceId) {
      alert('Sélectionnez et sauvegardez une instance WhatsApp Rita avant de publier un statut.');
      return;
    }

    setStatutSending(schedule._id);
    try {
      const partialStatusConfig = { instanceId: config.instanceId };
      if (schedule.type === 'product') {
        partialStatusConfig.productCatalog = config.productCatalog || [];
      }
      await syncRitaConfigPartial(partialStatusConfig);

      const { data } = await ecomApi.post(`/v1/rita-status/schedules/${schedule._id}/send-now`);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Impossible de publier le statut maintenant.');
      }

      await loadStatuts();
    } catch (error) {
      console.error('Error sending statut now:', error);
      alert(error?.response?.data?.error || error.message || 'Impossible de publier le statut maintenant.');
    } finally {
      setStatutSending(null);
    }
  };

  const toggleStatut = async (s) => {
    await ecomApi.put(`/v1/rita-status/schedules/${s._id}`, { enabled: !s.enabled });
    loadStatuts();
  };

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
      const headers = (config.fishAudioApiKey || '').trim()
        ? { 'x-fish-audio-api-key': config.fishAudioApiKey.trim() }
        : undefined;
      const res = await ecomApi.get(`/v1/external/whatsapp/preview-voice-fish?referenceId=${voiceId}&model=${model}`, { headers });
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

  // Relances
  const [activeConversations, setActiveConversations] = useState([]);
  const [conversationsStats, setConversationsStats] = useState(null);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [relancingPhone, setRelancingPhone] = useState(null);
  const [relancingBulk, setRelancingBulk] = useState(false);

  // Marketing product follow-up states
  const [rpProduct, setRpProduct] = useState('');
  const [rpMessage, setRpMessage] = useState('');
  const [rpLoading, setRpLoading] = useState(false);
  const [rpStatus, setRpStatus] = useState(null);

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
    welcomeMessage: "Bonjour 👋 J'espère que vous allez bien ! Je suis là pour vous aider — lequel de nos produits vous a intéressé ?",
    fallbackMessage: "Merci pour votre message ! Je vérifie et reviens vers vous très vite 🙏",
    autoLanguageDetection: true,
    autonomyLevel: 3,
    canCloseDeals: true,
    canSendPaymentLinks: false,
    requireHumanApproval: false,
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
    deliveryFee: '',
    deliveryDelay: '',
    deliveryInfo: '',
    deliveryZones: [],
    // Expéditions
    expeditionEnabled: false,
    expeditionCities: [],
    paymentCoordinates: {
      mobileMoney: [],
      bankAccount: null,
    },
    expeditionInstructions: '',
    whatsappGroupLink: null,
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
    businessCountry: 'CM', // Code pays ISO (CM = Cameroun par défaut)
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
    // Instructions personnalisées
    customInstructionsEnabled: false,
    customInstructions: '',
    // Premier message
    firstMessageRulesEnabled: false,
    firstMessageRules: [],
  });

  const [savedConfig, setSavedConfig] = useState(null);

  const { user: authUser } = useEcomAuth();
  const userId = authUser?._id || authUser?.id;
  const [instanceError, setInstanceError] = useState(null);
  const [ritaRequestForm, setRitaRequestForm] = useState({
    contactName: authUser?.name || '',
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
  const selectedStatutProduct = (config.productCatalog || []).find((product) => product.name === statutForm.productName) || null;
  const statutProductMediaOptions = [
    ...((selectedStatutProduct?.images || []).filter(Boolean).map((url, index) => ({
      key: `image-${index}-${url}`,
      url,
      type: 'image',
      label: `Image ${index + 1}`,
    }))),
    ...((selectedStatutProduct?.videos || []).filter(Boolean).map((url, index) => ({
      key: `video-${index}-${url}`,
      url,
      type: 'video',
      label: `Vidéo ${index + 1}`,
    }))),
  ];

  const set = useCallback((field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const syncRitaConfigPartial = useCallback(async (partialConfig = {}) => {
    if (!partialConfig || Object.keys(partialConfig).length === 0) return false;

    const payload = agentId
      ? { agentId, config: partialConfig }
      : { userId, config: partialConfig };

    const { data } = await ecomApi.post('/v1/external/whatsapp/rita-config', payload);
    if (!data.success) {
      throw new Error(data.error || data.message || 'Impossible de synchroniser la configuration Rita.');
    }

    setSavedConfig(prev => ({ ...(prev || {}), ...partialConfig }));
    return true;
  }, [agentId, userId]);

  const syncRitaInstanceConfig = useCallback(async (instanceId = config.instanceId) => {
    if (!instanceId) return false;
    return syncRitaConfigPartial({ instanceId });
  }, [config.instanceId, syncRitaConfigPartial]);

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
      const errData = err.response?.data;
      let errorMsg = '❌ Erreur lors du chargement des instances WhatsApp';

      if (errData?.message) {
        errorMsg = `❌ ${errData.message}`;
      } else if (err.message) {
        errorMsg = `❌ ${err.message}`;
      }

      setInstanceError(errorMsg);
    }
  };

  // ─── Load ───
  const loadConfig = useCallback(async () => {
    try {
      // Utiliser agentId s'il existe, sinon userId (pour rétro-compatibilité)
      const endpoint = agentId
        ? `/v1/external/whatsapp/rita-config/${agentId}`
        : `/v1/external/whatsapp/rita-config`;

      const configRes = await ecomApi.get(endpoint);
      if (!configRes.data.success || !configRes.data.config) {
        console.warn('[AgentConfig] Aucune config Rita trouvée pour agentId:', agentId, '| response:', configRes.data);
      }
      if (configRes.data.success && configRes.data.config) {
        let loadedConfig = configRes.data.config;
        console.log("FRONT PRODUCTS:", (loadedConfig.productCatalog || []).map(p => ({ name: p.name, price: p.price })));

        // Migration: Converter 'product' -> 'productName' et ajouter 'rating' par défaut
        if (loadedConfig.testimonials?.length) {
          loadedConfig.testimonials = loadedConfig.testimonials.map(t => ({
            ...t,
            productName: t.productName || t.product || '', // Migration
            rating: t.rating || 5, // Ajouter rating par défaut
          }));
        }

        setConfig(prev => ({ ...prev, ...loadedConfig }));
        setSavedConfig(loadedConfig);
        setSimMessages([{
          role: 'agent',
          text: loadedConfig.welcomeMessage || "Bonjour 👋 J'espère que vous allez bien ! Je suis là pour vous aider — lequel de nos produits vous a intéressé ?",
          time: '14:30',
        }]);
      }
    } catch (error) {
      console.error('[AgentConfig] Erreur chargement:', error);
    }
  }, [agentId]);

  useEffect(() => {
    setLoading(true);
    if (agentId || userId) {
      Promise.all([loadConfig(), loadInstances()]).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [agentId, userId, loadConfig]);

  // Polling : re-fetch la config chaque 30s pour détecter les changements en DB
  // MAIS: ne pas surcharger si l'utilisateur a des changements non sauvegardés
  useEffect(() => {
    if ((!agentId && !userId) || hasChanges) return;
    const interval = setInterval(() => loadConfig(), 30000);
    return () => clearInterval(interval);
  }, [agentId, userId, loadConfig, hasChanges]);

  useEffect(() => { simEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [simMessages, simTyping]);

  // ─── Save ───
  const handleSave = async () => {
    if (config.enabled && !config.instanceId) {
      setSaveStatus('error');
      alert('❌ Sélectionnez une instance WhatsApp précise avant d\'activer Rita.');
      return;
    }

    setSaving(true);
    setSaveStatus(null);
    try {
      // Utiliser agentId s'il existe, sinon userId (pour rétro-compatibilité)
      const payload = agentId
        ? { agentId, config }
        : { userId, config };

      const { data } = await ecomApi.post('/v1/external/whatsapp/rita-config', payload);
      if (!data.success) {
        setSaveStatus('error');
        const errorMsg = data.message || 'Erreur lors de la sauvegarde de la configuration';
        alert(`❌ ${errorMsg}`);
        return;
      }

      await ecomApi.post('/v1/external/whatsapp/activate', {
        agentId: agentId || undefined,
        userId: userId || undefined,
        enabled: config.enabled,
        instanceId: config.instanceId || undefined,
      });
      setSaveStatus('success');
      const savedFromServer = data.config || config;
      setConfig(prev => ({ ...prev, ...savedFromServer }));
      setSavedConfig(savedFromServer);
      setHasChanges(false);
      // Afficher le message de succès pendant 2 secondes puis le masquer
      setTimeout(() => {
        setSaveStatus(null);
      }, 2000);
    } catch (error) {
      console.error('[AgentConfig] Erreur sauvegarde:', error);
      setSaveStatus('error');
      const errData = error.response?.data;
      let errorMsg = '❌ Erreur lors de la sauvegarde de la configuration';

      if (errData?.error === 'upgrade_required') {
        errorMsg = `❌ ${errData.message || 'Votre plan n\'autorise pas cette action. Veuillez passer à Pro.'}`;
      } else if (errData?.error === 'limit_reached') {
        errorMsg = `❌ ${errData.message || 'Limite atteinte. Passez à un plan supérieur.'}`;
      } else if (errData?.message) {
        errorMsg = `❌ ${errData.message}`;
      } else if (error.message) {
        errorMsg = `❌ ${error.message}`;
      }

      alert(errorMsg);
    }
    finally { setSaving(false); }
  };

  const handleInstanceChange = async (instanceId) => {
    set('instanceId', instanceId);
    setInstanceSwitchStatus(null);

    setInstanceSwitching(true);
    try {
      await syncRitaInstanceConfig(instanceId);

      if (config.enabled) {
        await ecomApi.post('/v1/external/whatsapp/activate', {
          agentId: agentId || undefined,
          userId: userId || undefined,
          enabled: true,
          instanceId,
        });
      }

      setInstanceSwitchStatus('success');
    } catch (error) {
      console.error('[AgentConfig] Erreur synchronisation instance Rita:', error);
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

  // ─── Relances ───
  const loadActiveConversations = async () => {
    if (!userId) return;
    setConversationsLoading(true);
    try {
      const { data } = await ecomApi.get(`/api/ecom/rita/conversations/active?userId=${userId}`);
      setActiveConversations(data.conversations || []);
      setConversationsStats(data.stats || null);
    } catch (error) {
      console.error('[AgentConfig] Erreur chargement conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  };

  const relanceSingleClient = async (clientPhone, customMessage = null) => {
    setRelancingPhone(clientPhone);
    try {
      const payload = {
        userId,
        clientPhone,
      };
      if (customMessage) payload.customMessage = customMessage;

      const { data } = await ecomApi.post('/api/ecom/rita/relance/single', payload);
      if (!data.success) {
        throw new Error(data.error || 'Échec de la relance');
      }
      alert(`✅ Client relancé avec succès !\n\n"${data.message}"`);
      await loadActiveConversations();
    } catch (error) {
      console.error('[AgentConfig] Erreur relance:', error);
      alert(`❌ ${error.response?.data?.error || error.message || 'Erreur lors de la relance'}`);
    } finally {
      setRelancingPhone(null);
    }
  };

  const relanceBulkClients = async (statusFilter = 'need_relance', maxRelance = 3) => {
    if (!confirm(`Voulez-vous vraiment relancer TOUS les clients en attente (statut: ${statusFilter}) ?\n\nCela peut prendre du temps si vous avez beaucoup de conversations.`)) {
      return;
    }
    setRelancingBulk(true);
    try {
      const payload = {
        userId,
        status: statusFilter,
        maxRelance,
      };

      const { data } = await ecomApi.post('/api/ecom/rita/relance/bulk', payload);
      if (!data.success) {
        throw new Error(data.error || 'Échec relance bulk');
      }
      alert(`✅ ${data.message}\n\n${data.successCount}/${data.count} clients relancés avec succès !`);
      await loadActiveConversations();
    } catch (error) {
      console.error('[AgentConfig] Erreur relance bulk:', error);
      alert(`❌ ${error.response?.data?.error || error.message || 'Erreur lors de la relance bulk'}`);
    } finally {
      setRelancingBulk(false);
    }
  };

  const handleRelanceProduct = async () => {
    if (!rpProduct || !rpMessage) {
      setRpStatus({ type: 'error', text: 'Veuillez sélectionner un produit et taper un message.' });
      return;
    }
    setRpLoading(true);
    setRpStatus(null);
    try {
      const { data } = await ecomApi.post('/api/ecom/rita/relance/product', {
        userId,
        productName: rpProduct,
        customMessage: rpMessage
      });
      if (data.success) {
        setRpStatus({ type: 'success', text: data.message });
      } else {
        setRpStatus({ type: 'error', text: data.error || 'Erreur lors de la relance.' });
      }
    } catch (err) {
      setRpStatus({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setRpLoading(false);
    }
  };

  const handleProductSelect = (val) => {
    setRpProduct(val);
    if (val) {
      setRpMessage(`Bonjour 👋,\n\nNous espérons que vous allez bien.\nNous vous recontactons suite à l'intérêt que vous avez porté à notre produit *${val}*.\n\nSouhaitez-vous échanger avec nous ou procéder à votre commande ?\nNous restons à votre entière disposition.`);
    } else {
      setRpMessage('');
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
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics(analyticsDays);
  }, [activeTab, analyticsDays, fetchAnalytics]);

  const fetchContacts = useCallback(async (page = 1) => {
    setContactsLoading(true);
    try {
      const { data } = await ecomApi.get('/v1/external/whatsapp/rita-contacts', {
        params: { page, limit: 50 },
      });
      if (data.success) {
        setContactsList(data.contacts || []);
        setContactsTotal(data.total || 0);
        setContactsPage(page);
      }
    } catch { /* ignore */ }
    finally { setContactsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'contacts') fetchContacts(1);
  }, [activeTab, fetchContacts]);

  useEffect(() => {
    if (activeTab === 'statuts') loadStatuts();
  }, [activeTab, loadStatuts]);

  // ─── Group Animation ───
  const loadGroupAnimation = useCallback(async () => {
    if (!userId) return;
    try {
      const [cfgRes, grpRes, ritaRes] = await Promise.all([
        ecomApi.get('/v1/rita-flows/config', { params: { userId } }).catch(() => ({ data: { config: null } })),
        ecomApi.get('/v1/rita-flows/groups/list', { params: { userId } }).catch(() => ({ data: { groups: [] } })),
        ecomApi.get('/v1/external/whatsapp/rita-config', { params: { userId } }).catch(() => ({ data: { config: null } })),
      ]);
      setGroupConfig(cfgRes.data.config || { enabled: false, flows: [], groups: [], settings: {} });
      setWhatsappGroups(grpRes.data.groups || []);
      setGroupProducts((ritaRes.data.config?.productCatalog || []).map(p => p.name));
    } catch (err) {
      console.error('Erreur chargement groupes:', err);
      setGroupConfig({ enabled: false, flows: [], groups: [], settings: {} });
    }
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'group-animation') loadGroupAnimation();
  }, [activeTab, loadGroupAnimation]);

  const saveGroupConfig = async () => {
    if (!groupConfig) return;
    setGroupSaving(true); setGroupMsg(null);
    try {
      await ecomApi.post('/v1/rita-flows/config', { userId, config: groupConfig });
      setGroupMsg({ ok: true, text: '✅ Animation sauvegardée !' });
      setTimeout(() => setGroupMsg(null), 3000);
    } catch {
      setGroupMsg({ ok: false, text: '❌ Erreur de sauvegarde' });
      setTimeout(() => setGroupMsg(null), 3000);
    } finally { setGroupSaving(false); }
  };

  const updateGroupConfig = (key, val) => setGroupConfig(prev => prev ? { ...prev, [key]: val } : prev);

  const updateManagedGroup = (gi, group) => {
    const groups = [...(groupConfig?.groups || [])];
    groups[gi] = group;
    updateGroupConfig('groups', groups);
  };

  const createNewGroup = async () => {
    if (!groupNewName.trim()) return;
    setGroupCreating(true);
    try {
      const { data } = await ecomApi.post('/v1/rita-flows/groups/create', { userId, name: groupNewName.trim() });
      if (data.success) {
        await loadGroupAnimation();
        setGroupNewName('');
      }
    } catch (err) { console.error(err); }
    finally { setGroupCreating(false); }
  };

  const addExistingGroupToAnimation = () => {
    if (!groupSelectedAdd || !groupConfig) return;
    const wa = whatsappGroups.find(g => g.id === groupSelectedAdd);
    if (!wa) return;
    if ((groupConfig.groups || []).some(g => g.groupJid === wa.id)) {
      setGroupMsg({ ok: false, text: 'Ce groupe est déjà géré.' });
      setTimeout(() => setGroupMsg(null), 3000);
      return;
    }
    updateGroupConfig('groups', [...(groupConfig.groups || []), { groupJid: wa.id, name: wa.name, inviteUrl: '', role: 'custom', autoCreated: false, scheduledPosts: [] }]);
    setGroupSelectedAdd('');
  };

  const joinGroupByInvite = async () => {
    if (!groupInviteLink.trim()) return;
    if (!groupInviteLink.includes('chat.whatsapp.com/')) {
      setGroupMsg({ ok: false, text: 'Collez un lien WhatsApp valide (chat.whatsapp.com/...)' });
      setTimeout(() => setGroupMsg(null), 3000);
      return;
    }
    setGroupJoining(true);
    try {
      const { data } = await ecomApi.post('/v1/rita-flows/groups/join', { userId, inviteLink: groupInviteLink.trim() });
      if (data.success) {
        await loadGroupAnimation();
        setGroupInviteLink('');
        setGroupMsg({ ok: true, text: `✅ Rita a rejoint le groupe "${data.group?.name || 'Groupe'}" !` });
        setTimeout(() => setGroupMsg(null), 4000);
      } else {
        setGroupMsg({ ok: false, text: data.error || 'Impossible de rejoindre le groupe' });
        setTimeout(() => setGroupMsg(null), 4000);
      }
    } catch (err) {
      setGroupMsg({ ok: false, text: err.response?.data?.error || 'Erreur en rejoignant le groupe' });
      setTimeout(() => setGroupMsg(null), 4000);
    } finally { setGroupJoining(false); }
  };

  const refreshGroupInvite = async (groupJid, gi) => {
    try {
      const { data } = await ecomApi.post('/v1/rita-flows/groups/invite-link', { userId, groupJid });
      if (data.success && data.inviteUrl) {
        const groups = [...(groupConfig?.groups || [])];
        groups[gi] = { ...groups[gi], inviteUrl: data.inviteUrl };
        updateGroupConfig('groups', groups);
        setGroupMsg({ ok: true, text: '🔗 Lien d\'invitation mis à jour !' });
        setTimeout(() => setGroupMsg(null), 3000);
      }
    } catch (err) {
      setGroupMsg({ ok: false, text: '❌ Erreur génération du lien' });
      setTimeout(() => setGroupMsg(null), 3000);
    }
  };

  const removeGroupFromAnimation = (gi) => {
    const groups = [...(groupConfig?.groups || [])];
    groups.splice(gi, 1);
    updateGroupConfig('groups', groups);
  };

  const GA_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const GA_ROLES = [
    { value: 'clients', label: '🛒 Clients' },
    { value: 'prospects', label: '🎯 Prospects' },
    { value: 'vip', label: '⭐ VIP' },
    { value: 'custom', label: '🔧 Personnalisé' },
  ];

  const exportContactsCSV = async () => {
    try {
      const response = await ecomApi.get('/v1/external/whatsapp/rita-contacts/export', {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'rita-contacts.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error exporting contacts CSV:', error);
      alert(error?.response?.data?.error || 'Impossible d\'exporter les contacts.');
    }
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
            <nav className="flex flex-wrap items-center gap-1.5 text-[12px] text-gray-400">
              <button onClick={() => {
                if (hasChanges && !window.confirm('Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?')) return;
                navigate('/ecom/agent-ia');
              }} className="hover:text-gray-600 transition-colors">Agent IA</button>
              <span>›</span>
              <span className="text-gray-600 font-medium">{agent?.name || 'Configuration'}</span>
            </nav>
          </div>

          {/* Title bar */}
          <div className="flex flex-col gap-4 pb-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 break-words">{agent?.name || 'Configuration Agent IA'}</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">Configurez les produits, messages et paramètres de votre agent.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3 w-full md:w-auto">
              <button onClick={handleReset} disabled={!hasChanges}
                className="w-full sm:w-auto px-4 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-5 py-2.5 text-[13px] font-bold text-white rounded-xl disabled:opacity-50 transition-all shadow-sm hover:shadow-md"
                style={{ background: ACCENT }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Sauvegarder
              </button>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-0 border-b-0 -mb-px overflow-x-auto whitespace-nowrap scrollbar-thin">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-[12px] sm:text-[13px] font-medium border-b-2 transition-all flex-shrink-0 ${
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
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
                      className={`flex flex-col sm:flex-row items-start gap-4 px-4 py-4 rounded-xl border-2 transition-all ${mode.color}`}>
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
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-purple-600" />
                    </span>
                    Relances & Suivi Clients
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Relances automatiques + Tableau de bord des conversations actives</p>
                </div>
                <div className="p-6 space-y-4">
                  <Toggle enabled={config.followUpEnabled} onChange={v => set('followUpEnabled', v)}
                    label="Activer les relances automatiques" description="Rita relance naturellement les prospects silencieux" />
                  {config.followUpEnabled && (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  <div className="border-t border-gray-100 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[13px] font-bold text-gray-900">Relances manuelles en un clic</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Tableau de bord des conversations actives et relances instantanées</p>
                      </div>
                      <button
                        type="button"
                        onClick={loadActiveConversations}
                        disabled={conversationsLoading}
                        className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                        style={{ color: '#0F6B4F', background: 'rgba(15,107,79,0.08)' }}
                      >
                        {conversationsLoading ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Chargement...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3 h-3" />
                            Actualiser
                          </>
                        )}
                      </button>
                    </div>

                    {/* Stats rapides */}
                    {conversationsStats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <p className="text-[20px] font-bold text-blue-700">{conversationsStats.total}</p>
                          <p className="text-[10px] text-blue-600 font-medium">Total</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 text-center">
                          <p className="text-[20px] font-bold text-amber-700">{conversationsStats.waitingResponse}</p>
                          <p className="text-[10px] text-amber-600 font-medium">En attente</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3 text-center">
                          <p className="text-[20px] font-bold text-red-700">{conversationsStats.needRelance}</p>
                          <p className="text-[10px] text-red-600 font-medium">À relancer</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-3 text-center">
                          <p className="text-[20px] font-bold text-emerald-700">{conversationsStats.ordered}</p>
                          <p className="text-[10px] text-emerald-600 font-medium">Commandés</p>
                        </div>
                      </div>
                    )}

                    {/* Bouton relance bulk */}
                    {activeConversations.length > 0 && (
                      <div className="mb-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => relanceBulkClients('need_relance', 3)}
                          disabled={relancingBulk || conversationsLoading}
                          className="text-[12px] font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {relancingBulk ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Relance en cours...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Relancer tous les clients en attente
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Tableau des conversations */}
                    {conversationsLoading ? (
                      <div className="rounded-xl border border-purple-100 bg-purple-50/20 p-8 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500 mb-2" />
                        <p className="text-[12px] text-purple-600 font-medium">Chargement des conversations...</p>
                      </div>
                    ) : activeConversations.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-purple-200 p-8 text-center">
                        <MessageSquare className="w-12 h-12 mx-auto text-purple-200 mb-3" />
                        <p className="text-[13px] font-bold text-gray-600 mb-1">Aucune conversation active</p>
                        <p className="text-[11px] text-gray-400">Les conversations avec Rita apparaîtront ici</p>
                        <button
                          type="button"
                          onClick={loadActiveConversations}
                          className="mt-3 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          style={{ color: '#0F6B4F', background: 'rgba(15,107,79,0.08)' }}
                        >
                          Actualiser
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {activeConversations.map((conv, idx) => {
                          const statusColors = {
                            waiting_response: 'bg-blue-50 text-blue-700 border-blue-200',
                            need_relance: 'bg-red-50 text-red-700 border-red-200',
                            abandoned: 'bg-gray-100 text-gray-600 border-gray-200',
                            pending: 'bg-amber-50 text-amber-700 border-amber-200',
                          };
                          const statusLabels = {
                            waiting_response: 'En attente',
                            need_relance: 'À relancer',
                            abandoned: 'Abandonné',
                            pending: 'En cours',
                          };
                          
                          return (
                            <div key={idx} className="rounded-lg border border-purple-100 bg-white p-3 hover:shadow-sm transition-shadow">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Phone className="w-3 h-3 text-gray-400" />
                                    <p className="text-[12px] font-bold text-gray-900">
                                      {conv.from.replace(/@.*$/, '')}
                                    </p>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColors[conv.status] || 'bg-gray-100 text-gray-600'}`}>
                                      {statusLabels[conv.status] || conv.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                    <span>💬 {conv.messageCount} messages</span>
                                    <span>🔄 {conv.relanceCount} relances</span>
                                    <span>⏱️ {Math.round(conv.hoursSinceLastActivity)}h</span>
                                    {conv.ordered && <span className="text-emerald-600 font-bold">✅ Commandé</span>}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => relanceSingleClient(conv.from.replace(/@.*$/, ''))}
                                  disabled={relancingPhone === conv.from || relancingBulk || conv.ordered}
                                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                  style={{ 
                                    color: conv.ordered ? '#6B7280' : '#0F6B4F', 
                                    background: conv.ordered ? '#F3F4F6' : 'rgba(15,107,79,0.08)' 
                                  }}
                                >
                                  {relancingPhone === conv.from ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Envoi...
                                    </>
                                  ) : conv.ordered ? (
                                    <>
                                      <ShieldCheck className="w-3 h-3" />
                                      Commandé
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-3 h-3" />
                                      Relancer
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Dernier message */}
                              {conv.history && conv.history.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-purple-50">
                                  <p className="text-[10px] text-gray-400 mb-0.5">Dernier message :</p>
                                  <p className="text-[11px] text-gray-600 line-clamp-2 italic">
                                    "{conv.history[conv.history.length - 1]?.content?.substring(0, 100)}..."
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Info box */}
                    <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/40 p-4">
                      <p className="text-[11px] text-purple-700 leading-relaxed">
                        <span className="font-bold text-purple-800">💡 Comment ça marche :</span> Rita classe automatiquement les conversations selon leur statut. 
                        Vous pouvez relancer un client individuellement ou tous les clients "À relancer" en un seul clic. 
                        Les messages sont générés par IA selon l'historique de chaque conversation.
                      </p>
                    </div>
                  </div>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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

              {/* Groupe WhatsApp */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-green-600" />
                    </span>
                    Groupe WhatsApp
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Rita promotionnera votre groupe auprès des clients intéressés</p>
                </div>
                <div className="p-6 space-y-4">
                  <Toggle
                    enabled={!!config.whatsappGroupLink}
                    onChange={v => set('whatsappGroupLink', v ? '' : null)}
                    label="Activer la promotion du groupe"
                    description="Rita proposera le groupe WhatsApp après commande confirmée ou lors d'intérêt"
                  />

                  {config.whatsappGroupLink !== null && (
                    <>
                      <Field label="Lien du groupe" hint="Lien d'invitation WhatsApp (https://...)">
                        <input
                          value={config.whatsappGroupLink || ''}
                          onChange={e => set('whatsappGroupLink', e.target.value)}
                          placeholder="https://..."
                          className="ac-input"
                        />
                      </Field>

                      <div className="rounded-xl border border-green-100 bg-green-50/40 p-4 space-y-2">
                        <p className="text-[12px] font-bold text-green-800">📋 Quand Rita proposera le groupe :</p>
                        <ul className="text-[11px] text-green-700 space-y-1 ml-4">
                          <li>✅ Après une commande confirmée (bonus fidélité)</li>
                          <li>✅ Quand le client montre de l'intérêt mais n'est pas prêt (ne pas partir)</li>
                          <li>✅ Quand le client demande à être informé des promos</li>
                          <li>⛔ JAMAIS au tout début de la conversation</li>
                          <li>⛔ JAMAIS plus d'une fois par conversation</li>
                        </ul>
                      </div>
                    </>
                  )}
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

        {/* ─── TAB: LIVRAISON & EXPÉDITIONS ─── */}
        {activeTab === 'delivery' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Livraison */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </span>
                    Configuration Livraison
                  </h2>
                  <p className="text-[12px] text-gray-400 mt-1">Tarifs, zones et délais de livraison que Rita mentionnera aux clients</p>
                </div>
                <div className="p-6 space-y-4">
                  <Field label="Frais de livraison" hint="ex: 500 FCFA, gratuit">
                    <input
                      value={config.deliveryFee || ''}
                      onChange={e => set('deliveryFee', e.target.value)}
                      placeholder="ex: 500 FCFA"
                      className="ac-input"
                    />
                  </Field>

                  <Field label="Délai estimé" hint="ex: 24h, 2-3 jours">
                    <input
                      value={config.deliveryDelay || ''}
                      onChange={e => set('deliveryDelay', e.target.value)}
                      placeholder="ex: 24 heures"
                      className="ac-input"
                    />
                  </Field>

                  <Field label="Informations complémentaires" hint="optionnel">
                    <textarea
                      value={config.deliveryInfo || ''}
                      onChange={e => set('deliveryInfo', e.target.value)}
                      placeholder="ex: Paiement à la livraison, vérification avant paiement"
                      rows={2}
                      className="ac-textarea"
                    />
                  </Field>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const updatedZones = [...(config.deliveryZones || [])];
                        updatedZones.push({ city: '', fee: '', delay: '' });
                        set('deliveryZones', updatedZones);
                      }}
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: '#0F6B4F', background: 'rgba(15,107,79,0.08)' }}
                    >
                      + Ajouter une zone
                    </button>
                  </div>

                  {(config.deliveryZones || []).length > 0 && (
                    <div className="space-y-2 rounded-xl bg-blue-50/40 p-4">
                      <p className="text-[12px] font-bold text-blue-900">Zones de livraison</p>
                      {(config.deliveryZones || []).map((zone, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border border-blue-100 bg-white p-3">
                          <Field label="Ville/Zone">
                            <input
                              value={zone.city || ''}
                              onChange={e => {
                                const updatedZones = [...(config.deliveryZones || [])];
                                updatedZones[idx].city = e.target.value;
                                set('deliveryZones', updatedZones);
                              }}
                              placeholder="ex: Douala"
                              className="ac-input"
                            />
                          </Field>
                          <Field label="Tarif">
                            <input
                              value={zone.fee || ''}
                              onChange={e => {
                                const updatedZones = [...(config.deliveryZones || [])];
                                updatedZones[idx].fee = e.target.value;
                                set('deliveryZones', updatedZones);
                              }}
                              placeholder="ex: 500 FCFA"
                              className="ac-input"
                            />
                          </Field>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <Field label="Délai">
                                <input
                                  value={zone.delay || ''}
                                  onChange={e => {
                                    const updatedZones = [...(config.deliveryZones || [])];
                                    updatedZones[idx].delay = e.target.value;
                                    set('deliveryZones', updatedZones);
                                  }}
                                  placeholder="ex: 24h"
                                  className="ac-input"
                                />
                              </Field>
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedZones = (config.deliveryZones || []).filter((_, i) => i !== idx);
                                  set('deliveryZones', updatedZones);
                                }}
                                className="px-2 py-2 text-red-500 hover:text-red-700 text-[12px] font-semibold mb-5"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Expéditions */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                        <Package className="w-4 h-4 text-orange-600" />
                      </span>
                      Expéditions (Villes Hors Zone)
                    </h2>
                    <p className="text-[12px] text-gray-400 mt-1">Pour les clients dans des villes où vous ne livrez pas directement</p>
                  </div>
                  <Toggle enabled={config.expeditionEnabled} onChange={v => set('expeditionEnabled', v)} label="" />
                </div>
                {config.expeditionEnabled && (
                  <div className="p-6 space-y-4">
                    {/* Villes éligibles - sous forme de checkboxes */}
                    <div className="space-y-3">
                      <label className="text-[12px] font-bold text-gray-700">Villes éligibles pour expédition</label>
                      <p className="text-[11px] text-gray-400">Cochez les villes où vous pouvez expédier vos produits</p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {(CITIES_BY_COUNTRY[config.businessCountry || 'CM'] || CITIES_BY_COUNTRY.CM).map((city) => {
                          const isChecked = (config.expeditionCities || []).includes(city);
                          return (
                            <label
                              key={city}
                              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                isChecked 
                                  ? 'border-orange-400 bg-orange-50' 
                                  : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...(config.expeditionCities || []), city]
                                    : (config.expeditionCities || []).filter(c => c !== city);
                                  set('expeditionCities', updated);
                                }}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                              />
                              <span className="text-[12px] font-medium text-gray-700">{city}</span>
                            </label>
                          );
                        })}
                      </div>

                      {(config.expeditionCities || []).length > 0 && (
                        <div className="rounded-lg border border-orange-100 bg-orange-50/40 p-3">
                          <p className="text-[11px] text-orange-700">
                            <span className="font-bold">{(config.expeditionCities || []).length} ville(s) sélectionnée(s) :</span> {(config.expeditionCities || []).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Coordonnées de paiement Mobile Money */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] font-bold text-gray-700">Coordonnées Mobile Money pour expéditions</label>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...config.paymentCoordinates,
                              mobileMoney: [...(config.paymentCoordinates?.mobileMoney || []), { provider: 'Orange Money', number: '', accountName: '' }]
                            };
                            set('paymentCoordinates', updated);
                          }}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          style={{ color: '#0F6B4F', background: 'rgba(15,107,79,0.08)' }}
                        >
                          + Ajouter compte
                        </button>
                      </div>

                      {(config.paymentCoordinates?.mobileMoney || []).length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-[12px] text-gray-400">
                          Aucun compte configuré. Ajoutez Orange Money, MTN Mobile Money, etc.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(config.paymentCoordinates?.mobileMoney || []).map((mm, idx) => (
                            <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border border-yellow-100 bg-yellow-50/30 p-3">
                              <Field label="Opérateur">
                                <select
                                  value={mm.provider || 'Orange Money'}
                                  onChange={e => {
                                    const updated = { ...config.paymentCoordinates };
                                    updated.mobileMoney[idx].provider = e.target.value;
                                    set('paymentCoordinates', updated);
                                  }}
                                  className="ac-input"
                                >
                                  <option value="Orange Money">Orange Money</option>
                                  <option value="MTN Mobile Money">MTN Mobile Money</option>
                                  <option value="Express Union">Express Union</option>
                                </select>
                              </Field>
                              <Field label="Numéro">
                                <input
                                  value={mm.number || ''}
                                  onChange={e => {
                                    const updated = { ...config.paymentCoordinates };
                                    updated.mobileMoney[idx].number = e.target.value;
                                    set('paymentCoordinates', updated);
                                  }}
                                  placeholder="ex: 690123456"
                                  className="ac-input"
                                />
                              </Field>
                              <div className="flex items-end gap-2">
                                <div className="flex-1">
                                  <Field label="Nom du compte">
                                    <input
                                      value={mm.accountName || ''}
                                      onChange={e => {
                                        const updated = { ...config.paymentCoordinates };
                                        updated.mobileMoney[idx].accountName = e.target.value;
                                        set('paymentCoordinates', updated);
                                      }}
                                      placeholder="ex: Jean KOUMEN"
                                      className="ac-input"
                                    />
                                  </Field>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...config.paymentCoordinates };
                                    updated.mobileMoney = updated.mobileMoney.filter((_, i) => i !== idx);
                                    set('paymentCoordinates', updated);
                                  }}
                                  className="px-2 py-2 text-red-500 hover:text-red-700 text-[12px] font-semibold mb-1"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Instructions personnalisées */}
                    <Field label="Instructions spéciales (optionnel)" hint="Instructions additionnelles pour Rita concernant les expéditions">
                      <textarea
                        value={config.expeditionInstructions || ''}
                        onChange={e => set('expeditionInstructions', e.target.value)}
                        placeholder="ex: Toujours demander confirmation du point de retrait avant d'envoyer les coordonnées"
                        rows={2}
                        className="ac-textarea"
                      />
                    </Field>

                    {/* Info box */}
                    <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 space-y-2">
                      <p className="text-[12px] font-bold text-orange-800">📦 Comment ça fonctionne :</p>
                      <ul className="text-[11px] text-orange-700 space-y-1 ml-4">
                        <li>1️⃣ Rita détecte si le client est dans une ville hors zone de livraison</li>
                        <li>2️⃣ Elle propose l'expédition avec les coordonnées de paiement</li>
                        <li>3️⃣ Le client confirme sa ville et le point de retrait</li>
                        <li>4️⃣ Rita envoie automatiquement les coordonnées Mobile Money avec le montant total</li>
                        <li>5️⃣ Après paiement confirmé, vous expédiez le colis via votre agence habituelle</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Récapitulatif */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900">Récapitulatif</h2>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50">
                    <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[12px] font-bold text-blue-900">Livraison locale</p>
                      <p className="text-[11px] text-blue-700 mt-1">
                        {config.deliveryFee ? `${config.deliveryFee}` : 'Non configuré'}
                        {config.deliveryDelay && ` • ${config.deliveryDelay}`}
                      </p>
                      <p className="text-[10px] text-blue-600 mt-1">
                        {(config.deliveryZones || []).length} zone{(config.deliveryZones || []).length > 1 ? 's' : ''} configurée{(config.deliveryZones || []).length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50/50">
                    <Package className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[12px] font-bold text-orange-900">Expéditions</p>
                      <p className="text-[11px] text-orange-700 mt-1">
                        {config.expeditionEnabled ? 'Activé' : 'Désactivé'}
                      </p>
                      {config.expeditionEnabled && (
                        <>
                          <p className="text-[10px] text-orange-600 mt-1">
                            {(config.expeditionAgencies || []).length} agence{(config.expeditionAgencies || []).length > 1 ? 's' : ''}
                          </p>
                          <p className="text-[10px] text-orange-600">
                            {(config.expeditionCities || []).length} ville{(config.expeditionCities || []).length > 1 ? 's' : ''} éligible{(config.expeditionCities || []).length > 1 ? 's' : ''}
                          </p>
                          <p className="text-[10px] text-orange-600">
                            {(config.paymentCoordinates?.mobileMoney || []).length} compte{(config.paymentCoordinates?.mobileMoney || []).length > 1 ? 's' : ''} Mobile Money
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Aide */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-[12px] font-semibold text-blue-700 mb-2">💡 Conseil</p>
                <p className="text-[11px] text-blue-600 leading-relaxed">
                  Configurez les zones de livraison locale pour Douala/Yaoundé, et activez les expéditions pour les autres villes du Cameroun.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: PRODUITS ─── */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-[16px] font-bold text-gray-900">Catalogue Produits</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">{config.productCatalog.length} produit{config.productCatalog.length !== 1 ? 's' : ''} configuré{config.productCatalog.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <button onClick={() => setShowImport(!showImport)}
                  className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-2.5 text-[13px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all shadow-sm hover:shadow-md">
                  <Upload className="w-4 h-4" />
                  Importer CSV
                </button>
                <button onClick={addProduct}
                  className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-2.5 text-[13px] font-bold text-white rounded-xl transition-all shadow-sm hover:shadow-md"
                  style={{ background: ACCENT }}>
                  + Ajouter un produit
                </button>
              </div>
            </div>

            {showImport && (
              <ProductImportLocal
                onImportSuccess={(importedProducts) => {
                  // Ajouter les produits importés au catalogue
                  const newProducts = importedProducts.map(p => ({
                    name: p.name,
                    price: p.price,
                    category: p.category || '',
                    description: p.description || '',
                    inStock: p.inStock !== false,
                    images: [],
                    quantityOffers: []
                  }));
                  setConfig(prev => ({
                    ...prev,
                    productCatalog: [...(prev.productCatalog || []), ...newProducts]
                  }));
                  setHasChanges(true);
                  setShowImport(false);
                }}
                onClose={() => setShowImport(false)}
              />
            )}

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
                      className="w-full px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-left hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[16px]">
                          {product.images?.length > 0 ? '🖼️' : '📦'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-gray-900 break-words">{product.name || 'Produit sans nom'}</p>
                          <p className="text-[12px] text-gray-400 break-words">{product.price || 'Prix non défini'}{product.category ? ` · ${product.category}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
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
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[13px] font-bold text-amber-800">Offres de quantité</p>
                              <p className="text-[11px] text-amber-700">Exemple: 1 = 10 000 FCFA, 2 = 15 000 FCFA</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addProductQuantityOffer(idx)}
                              className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-semibold hover:bg-amber-700 transition-colors"
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
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <input value={entry.productName || ''} onChange={e => updateStockEntry(idx, 'productName', e.target.value)}
                            placeholder="Nom du produit" className="ac-input flex-1 !bg-white" />
                          <input type="number" value={entry.quantity || 0} onChange={e => updateStockEntry(idx, 'quantity', parseInt(e.target.value) || 0)}
                            className="ac-input w-full sm:w-20 !bg-white text-center" min="0" />
                          <button onClick={() => removeStockEntry(idx)} className="self-end sm:self-auto text-gray-400 hover:text-red-500 transition-colors p-1">
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
                    <Field label="Pays" required>
                      <div className="relative">
                        <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select 
                          value={config.businessCountry || 'CM'} 
                          onChange={e => set('businessCountry', e.target.value)}
                          className="ac-input !pl-10"
                        >
                          <option value="CM">🇨🇲 Cameroun</option>
                          <option value="CD">🇨🇩 RD Congo</option>
                          <option value="SN">🇸🇳 Sénégal</option>
                          <option value="CI">🇨🇮 Côte d'Ivoire</option>
                          <option value="BJ">🇧🇯 Bénin</option>
                          <option value="TG">🇹🇬 Togo</option>
                        </select>
                      </div>
                    </Field>
                  </div>
                  <Field label="Ville / Localisation">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input value={config.businessCity} onChange={e => set('businessCity', e.target.value)}
                        placeholder="ex: Douala, Yaoundé, Abidjan..." className="ac-input !pl-10" />
                    </div>
                  </Field>
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
              <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
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
                                {p.name} {p.price ? ` • ${p.price}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Product Preview */}
                        {selectedProduct && (
                          <div className="bg-white rounded-lg border border-emerald-200 p-3 flex flex-col sm:flex-row gap-3">
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
                <p className="text-[14px] font-semibold text-gray-500">Aucune donnée disponible</p>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-gray-900">Liste des contacts Rita</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">{contactsTotal} contact{contactsTotal !== 1 ? 's' : ''} enregistré{contactsTotal !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={exportContactsCSV}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white rounded-xl shadow-sm hover:opacity-90 transition-all"
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
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
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

        {/* ─── TAB: STATUTS ─── */}
        {activeTab === 'statuts' && (
          <div className="space-y-6">
            {/* Header + bouton ajouter */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-gray-900">Statuts WhatsApp automatiques</h2>
                <p className="text-[12px] text-gray-500 mt-0.5">Planifiez des statuts avec images de vos produits — publiés automatiquement chaque jour</p>
              </div>
              <button
                onClick={() => { setEditingStatut(null); setStatutForm({ name: '', type: 'product', caption: '', mediaUrl: '', productName: '', backgroundColor: '#0F6B4F', scheduleType: 'daily', sendTime: '09:00', weekDays: [] }); setShowStatutForm(true); }}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white rounded-xl"
                style={{ background: ACCENT }}
              >
                <Plus className="w-4 h-4" /> Nouveau statut
              </button>
            </div>

            {/* Formulaire création/édition */}
            {showStatutForm && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                <h3 className="text-[14px] font-bold text-gray-900">{editingStatut ? 'Modifier le statut' : 'Nouveau statut'}</h3>

                <div className={`rounded-xl border p-3 text-[12px] ${config.instanceId ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                  {config.instanceId
                    ? `Ce statut sera publié avec l'instance WhatsApp actuellement sélectionnée pour Rita : ${selectedInstance?.customName || selectedInstance?.instanceName || 'Instance configurée'}.`
                    : 'Aucune instance WhatsApp Rita n\'est sélectionnée. Vous pouvez créer le statut maintenant, mais il faudra configurer une instance pour pouvoir le publier.'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">Nom</label>
                    <input type="text" value={statutForm.name} onChange={e => setStatutForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Statut produit phare du lundi"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">Type de contenu</label>
                    <select value={statutForm.type} onChange={e => setStatutForm(p => ({ ...p, type: e.target.value }))}
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none bg-white">
                      <option value="product">📦 Produit du catalogue (auto)</option>
                      <option value="image">🖼️ Image manuelle + texte</option>
                      <option value="text">💬 Texte uniquement</option>
                    </select>
                  </div>
                </div>

                {statutForm.type === 'product' && (
                  <div className="space-y-3">
                    <label className="text-[12px] font-semibold text-gray-600">Produit</label>
                    <select value={statutForm.productName} onChange={e => setStatutForm(p => ({ ...p, productName: e.target.value, mediaUrl: '' }))}
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none bg-white">
                      <option value="">— Choisir un produit —</option>
                      {(config.productCatalog || []).filter(p => p.name).map((p, i) => (
                        <option key={i} value={p.name}>{p.name}{p.price ? ` (${p.price})` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400">Choisissez le produit, personnalisez le texte si besoin, puis laissez le média en automatique ou sélectionnez une image / vidéo déjà uploadée.</p>

                    {statutForm.productName && (
                      <div className="space-y-2">
                        <label className="text-[12px] font-semibold text-gray-600">Média du produit</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <button
                            type="button"
                            onClick={() => setStatutForm(p => ({ ...p, mediaUrl: '' }))}
                            className={`rounded-xl border px-3 py-3 text-left transition-colors ${!statutForm.mediaUrl ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'}`}
                          >
                            <p className="text-[12px] font-semibold text-gray-700">Automatique</p>
                            <p className="text-[11px] text-gray-400 mt-1">Utiliser le premier média disponible du produit</p>
                          </button>

                          {statutProductMediaOptions.map((media) => (
                            <button
                              key={media.key}
                              type="button"
                              onClick={() => setStatutForm(p => ({ ...p, mediaUrl: media.url }))}
                              className={`rounded-xl border overflow-hidden text-left transition-colors ${statutForm.mediaUrl === media.url ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'}`}
                            >
                              <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden">
                                {media.type === 'video' ? (
                                  <video src={media.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                ) : (
                                  <img src={media.url} alt={media.label} className="h-full w-full object-cover" />
                                )}
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[12px] font-semibold text-gray-700 truncate">{media.label}</span>
                                <span className="text-[11px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                  {media.type === 'video' ? <Video className="w-3.5 h-3.5" /> : <Image className="w-3.5 h-3.5" />}
                                  {media.type === 'video' ? 'Vidéo' : 'Image'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>

                        {selectedStatutProduct && statutProductMediaOptions.length === 0 && (
                          <p className="text-[11px] text-amber-600">Ce produit n'a pas encore d'image ni de vidéo uploadée. Le statut utilisera seulement le texte personnalisé.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {statutForm.type === 'image' && (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">URL de l'image</label>
                    <input type="text" value={statutForm.mediaUrl} onChange={e => setStatutForm(p => ({ ...p, mediaUrl: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                )}

                {statutForm.type !== 'product' && (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">Texte / Légende</label>
                    <textarea rows={3} value={statutForm.caption} onChange={e => setStatutForm(p => ({ ...p, caption: e.target.value }))}
                      placeholder="Ex: 🔥 Notre produit phare en stock ! Contactez-nous pour commander."
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none" />
                  </div>
                )}

                {statutForm.type === 'product' && (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">Texte personnalisé (optionnel)</label>
                    <textarea rows={2} value={statutForm.caption} onChange={e => setStatutForm(p => ({ ...p, caption: e.target.value }))}
                      placeholder="Laissez vide pour générer automatiquement depuis le produit"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">Fréquence</label>
                    <select value={statutForm.scheduleType} onChange={e => setStatutForm(p => ({ ...p, scheduleType: e.target.value }))}
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none bg-white">
                      <option value="daily">Tous les jours</option>
                      <option value="weekly">Certains jours</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">Heure d'envoi</label>
                    <input type="time" value={statutForm.sendTime} onChange={e => setStatutForm(p => ({ ...p, sendTime: e.target.value }))}
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                  {statutForm.type === 'text' && (
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-gray-600">Couleur de fond</label>
                      <input type="color" value={statutForm.backgroundColor} onChange={e => setStatutForm(p => ({ ...p, backgroundColor: e.target.value }))}
                        className="w-full h-[38px] px-1 py-1 border border-gray-200 rounded-xl cursor-pointer" />
                    </div>
                  )}
                </div>

                {statutForm.scheduleType === 'weekly' && (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">Jours</label>
                    <div className="flex gap-2 flex-wrap">
                      {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d, i) => (
                        <button key={i}
                          onClick={() => setStatutForm(p => ({
                            ...p,
                            weekDays: p.weekDays.includes(i) ? p.weekDays.filter(x => x !== i) : [...p.weekDays, i]
                          }))}
                          className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-colors ${
                            statutForm.weekDays.includes(i)
                              ? 'text-white border-emerald-600'
                              : 'text-gray-500 border-gray-200 hover:border-emerald-300'
                          }`}
                          style={statutForm.weekDays.includes(i) ? { background: ACCENT } : {}}
                        >{d}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-gray-100">
                  <button onClick={saveStatut}
                    disabled={statutSaving}
                    className="w-full sm:w-auto px-5 py-2 text-[13px] font-bold text-white rounded-xl disabled:opacity-60"
                    style={{ background: ACCENT }}>
                    {statutSaving ? 'Enregistrement...' : editingStatut ? 'Enregistrer' : 'Créer'}
                  </button>
                  <button onClick={() => { setShowStatutForm(false); setEditingStatut(null); }}
                    className="w-full sm:w-auto px-4 py-2 text-[13px] font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Liste des statuts */}
            {statutsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : statuts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
                <Radio className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-[14px] font-semibold text-gray-500">Aucun statut planifié</p>
                <p className="text-[12px] text-gray-400 mt-1">Créez votre premier statut automatique avec les images de vos produits</p>
              </div>
            ) : (
              <div className="space-y-3">
                {statuts.map(s => (
                  <div key={s._id} className={`bg-white rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${s.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                    {/* Icône type */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.type === 'product' ? 'bg-emerald-50' : s.type === 'image' ? 'bg-blue-50' : 'bg-amber-50'}`}>
                      {s.type === 'product' ? <Package className="w-5 h-5 text-emerald-600" />
                        : s.type === 'image' ? <Image className="w-5 h-5 text-blue-600" />
                        : <MessageCircle className="w-5 h-5 text-amber-600" />}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900">{s.name || 'Sans titre'}</p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-0.5">
                        <span className="text-[11px] text-gray-400">
                          {s.scheduleType === 'daily' ? 'Tous les jours' : 'Certains jours'} à {s.sendTime}
                        </span>
                        {s.type === 'product' && s.productName && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">{s.productName}</span>
                        )}
                        {s.sentCount > 0 && (
                          <span className="text-[11px] text-gray-400">{s.sentCount} envois</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 flex-shrink-0 w-full sm:w-auto">
                      {/* Toggle */}
                      <button onClick={() => toggleStatut(s)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${s.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                      {/* Envoyer maintenant */}
                      <button onClick={() => sendNow(s)} disabled={statutSending === s._id}
                        title="Publier maintenant"
                        className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors">
                        {statutSending === s._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                      </button>
                      {/* Modifier */}
                      <button onClick={() => { setEditingStatut(s); setStatutForm({ name: s.name, type: s.type, caption: s.caption, mediaUrl: s.mediaUrl, productName: s.productName, backgroundColor: s.backgroundColor, scheduleType: s.scheduleType, sendTime: s.sendTime, weekDays: s.weekDays || [] }); setShowStatutForm(true); }}
                        className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors">
                        <Settings className="w-4 h-4" />
                      </button>
                      {/* Supprimer */}
                      <button onClick={() => deleteStatut(s._id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-[12px] text-blue-700 space-y-1">
              <p className="font-bold">Comment ça fonctionne :</p>
              <p>• <strong>Produit catalogue</strong> : choisissez une image ou vidéo déjà uploadée sur le produit, ou laissez le média automatique</p>
              <p>• <strong>Image manuelle</strong> : collez l'URL d'une image uploadée</p>
              <p>• Le statut est publié automatiquement à l'heure planifiée, chaque jour</p>
              <p>• Bouton ▶ pour tester et publier immédiatement</p>
            </div>
          </div>
        )}

        {/* ─── TAB: INSTRUCTIONS ─── */}
        {activeTab === 'instructions' && (
          <div className="space-y-6">

            {/* ── RÈGLES PREMIER MESSAGE ── */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                  <MessageSquare className="w-5 h-5" style={{ color: ACCENT }} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">Règles du premier message</h3>
                  <p className="text-[12px] text-gray-500">Définissez ce que l'agent envoie automatiquement quand un contact vous écrit pour la première fois</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Toggle */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <p className="text-[14px] font-semibold text-gray-800">Activer les règles du premier message</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                      {config.firstMessageRulesEnabled
                        ? '✅ Actif — vos règles s\'appliquent au premier contact'
                        : '⬜ Inactif — l\'agent accueille naturellement sans règle fixe'}
                    </p>
                  </div>
                  <button
                    onClick={() => set('firstMessageRulesEnabled', !config.firstMessageRulesEnabled)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${config.firstMessageRulesEnabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${config.firstMessageRulesEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Rules list */}
                {config.firstMessageRulesEnabled && (
                  <div className="space-y-3">
                    {(config.firstMessageRules || []).map((rule, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                const updated = (config.firstMessageRules || []).map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r);
                                set('firstMessageRules', updated);
                              }}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                            </button>
                            <select
                              value={rule.type}
                              onChange={e => {
                                const updated = (config.firstMessageRules || []).map((r, i) => i === idx ? { ...r, type: e.target.value, content: '' } : r);
                                set('firstMessageRules', updated);
                              }}
                              className="text-[12px] font-semibold border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
                            >
                              <option value="video">🎥 Vidéo</option>
                              <option value="image">🖼️ Image</option>
                              <option value="text">💬 Message texte</option>
                              <option value="catalog">📦 Catalogue produits</option>
                            </select>
                          </div>
                          <button
                            onClick={() => set('firstMessageRules', (config.firstMessageRules || []).filter((_, i) => i !== idx))}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {rule.type !== 'catalog' && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={rule.label || ''}
                              onChange={e => {
                                const updated = (config.firstMessageRules || []).map((r, i) => i === idx ? { ...r, label: e.target.value } : r);
                                set('firstMessageRules', updated);
                              }}
                              placeholder="Description courte (ex: Vidéo de présentation)"
                              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            />
                            <input
                              type="text"
                              value={rule.content || ''}
                              onChange={e => {
                                const updated = (config.firstMessageRules || []).map((r, i) => i === idx ? { ...r, content: e.target.value } : r);
                                set('firstMessageRules', updated);
                              }}
                              placeholder={
                                rule.type === 'video' ? 'URL de la vidéo (ex: https://...)' :
                                rule.type === 'image' ? 'URL de l\'image (ex: https://...)' :
                                'Message à envoyer au client'
                              }
                              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 font-mono"
                            />
                          </div>
                        )}
                        {rule.type === 'catalog' && (
                          <p className="text-[11px] text-gray-500 italic">L'agent enverra la liste complète de vos produits avec prix dès le premier contact.</p>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => set('firstMessageRules', [...(config.firstMessageRules || []), { type: 'text', content: '', label: '', enabled: true }])}
                      className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-[12px] font-semibold text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Ajouter une règle
                    </button>
                  </div>
                )}

                <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${config.firstMessageRulesEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                  <p className="font-bold">Exemples de règles :</p>
                  <p>• Vidéo : envoyer une vidéo de présentation du produit phare dès le premier message</p>
                  <p>• Image : envoyer une photo du catalogue ou d'une promo en cours</p>
                  <p>• Texte : accueillir avec un message personnalisé avant de poser des questions</p>
                  <p>• Catalogue : partager directement tous vos produits avec prix</p>
                </div>
              </div>
            </div>

            {/* ── INSTRUCTIONS PERSONNALISÉES ── */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                  <FileText className="w-5 h-5" style={{ color: ACCENT }} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">Instructions personnalisées</h3>
                  <p className="text-[12px] text-gray-500">Écrivez vos propres règles — elles remplacent le comportement par défaut quand activées</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Toggle activation */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <p className="text-[14px] font-semibold text-gray-800">Activer les instructions personnalisées</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                      {config.customInstructionsEnabled
                        ? '✅ Actif — vos instructions remplacent le comportement par défaut'
                        : '⬜ Inactif — l\'agent utilise le comportement standard'}
                    </p>
                  </div>
                  <button
                    onClick={() => set('customInstructionsEnabled', !config.customInstructionsEnabled)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${config.customInstructionsEnabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${config.customInstructionsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Zone de texte */}
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-gray-700">Vos instructions</label>
                  <textarea
                    rows={14}
                    value={config.customInstructions}
                    onChange={e => set('customInstructions', e.target.value)}
                    placeholder={`Exemples d'instructions que vous pouvez écrire :

- Ne jamais proposer de remise sur le produit X
- Toujours demander si le client veut la version rouge ou noire avant de closer
- Si le client mentionne le concurrent Y, répondre : "Nous sommes meilleurs parce que..."
- Proposer systématiquement le produit B après que le client commande le produit A
- Si le client demande la livraison à Bafoussam, dire que le délai est 48h
- Utiliser uniquement des emojis 👍 et 🙏 — pas d'autres emojis
- Ne jamais mentionner le prix avant d'avoir compris le besoin du client`}
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] font-mono resize-y focus:outline-none focus:ring-2 transition-all ${
                      config.customInstructionsEnabled
                        ? 'border-emerald-300 bg-white focus:ring-emerald-200'
                        : 'border-gray-200 bg-gray-50 text-gray-400 focus:ring-gray-200'
                    }`}
                    disabled={!config.customInstructionsEnabled}
                  />
                  <p className="text-[11px] text-gray-400">
                    {config.customInstructions?.length || 0} caractères · Écrivez en langage naturel, l'agent comprend vos instructions directement
                  </p>
                </div>

                {/* Info box */}
                <div className={`p-4 rounded-xl border text-[12px] space-y-1.5 ${config.customInstructionsEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  <p className="font-bold">Comment ça fonctionne :</p>
                  <p>• Quand <strong>activé</strong> : vos instructions ont la priorité maximale sur toutes les règles par défaut</p>
                  <p>• Quand <strong>désactivé</strong> : l'agent ignore ces instructions et applique le comportement standard</p>
                  <p>• Soyez précis : "Ne jamais baisser le prix" est mieux que "être ferme sur les prix"</p>
                  <p>• Vous pouvez mélanger règles de vente, réponses spécifiques, et comportements personnalisés</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: GROUP ANIMATION ─── */}
        {activeTab === 'group-animation' && (
          <div className="space-y-6">

            {/* Flash message */}
            {groupMsg && (
              <div className={`text-[13px] px-4 py-2.5 rounded-xl font-medium ${groupMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {groupMsg.text}
              </div>
            )}

            {!groupConfig ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { val: groupConfig.groups?.length || 0, label: 'Groupes gérés', color: 'text-gray-900' },
                    { val: (groupConfig.groups || []).reduce((s, g) => s + (g.scheduledPosts || []).filter(p => p.enabled !== false).length, 0), label: 'Posts actifs', color: 'text-emerald-600' },
                    { val: (groupConfig.groups || []).reduce((s, g) => s + (g.scheduledPosts || []).filter(p => p.enabled === false).length, 0), label: 'Posts en pause', color: 'text-gray-500' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white border rounded-xl p-4 text-center">
                      <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                      <p className="text-[11px] text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Ajouter un groupe */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Connecter un groupe à animer
                  </h3>

                  {/* Mode selector */}
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    {[
                      { id: 'invite', label: '🔗 Lien d\'invitation' },
                      { id: 'existing', label: '📱 Mes groupes' },
                      { id: 'create', label: '➕ Nouveau groupe' },
                    ].map(m => (
                      <button key={m.id} onClick={() => setGroupAddMode(m.id)}
                        className={`flex-1 text-[12px] font-semibold py-2 rounded-lg transition ${groupAddMode === m.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Mode: Coller un lien d'invitation */}
                  {groupAddMode === 'invite' && (
                    <div className="space-y-2">
                      <p className="text-[12px] text-gray-500">Collez le lien d'invitation WhatsApp et Rita rejoindra automatiquement le groupe.</p>
                      <div className="flex gap-2">
                        <input type="text" value={groupInviteLink} onChange={e => setGroupInviteLink(e.target.value)}
                          placeholder="https://chat.whatsapp.com/ABC123..."
                          className="ac-input flex-1" onKeyDown={e => e.key === 'Enter' && joinGroupByInvite()} />
                        <button onClick={joinGroupByInvite} disabled={groupJoining || !groupInviteLink.trim()}
                          className="px-4 py-2 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 transition whitespace-nowrap"
                          style={{ background: ACCENT }}>
                          {groupJoining ? 'Connexion...' : 'Rejoindre'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode: Sélectionner un groupe existant */}
                  {groupAddMode === 'existing' && (
                    <div className="space-y-2">
                      <p className="text-[12px] text-gray-500">Sélectionnez un groupe WhatsApp déjà présent sur votre instance.</p>
                      {whatsappGroups.filter(w => !(groupConfig.groups || []).some(g => g.groupJid === w.id)).length > 0 ? (
                        <div className="flex gap-2">
                          <select value={groupSelectedAdd} onChange={e => setGroupSelectedAdd(e.target.value)} className="ac-input flex-1">
                            <option value="">— Choisir un groupe —</option>
                            {whatsappGroups.filter(w => !(groupConfig.groups || []).some(g => g.groupJid === w.id)).map(g => (
                              <option key={g.id} value={g.id}>{g.name} ({g.participants} membres)</option>
                            ))}
                          </select>
                          <button onClick={addExistingGroupToAnimation} disabled={!groupSelectedAdd}
                            className="px-4 py-2 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 transition"
                            style={{ background: ACCENT }}>
                            Ajouter
                          </button>
                        </div>
                      ) : (
                        <p className="text-[12px] text-gray-400 italic py-2">Tous les groupes sont déjà connectés, ou aucun groupe n'est trouvé sur l'instance.</p>
                      )}
                    </div>
                  )}

                  {/* Mode: Créer un nouveau groupe */}
                  {groupAddMode === 'create' && (
                    <div className="space-y-2">
                      <p className="text-[12px] text-gray-500">Créez un nouveau groupe WhatsApp directement depuis Rita.</p>
                      <div className="flex gap-2">
                        <input type="text" value={groupNewName} onChange={e => setGroupNewName(e.target.value)}
                          placeholder="Ex: 🛒 Clients Premium"
                          className="ac-input flex-1" onKeyDown={e => e.key === 'Enter' && createNewGroup()} />
                        <button onClick={createNewGroup} disabled={groupCreating || !groupNewName.trim()}
                          className="px-4 py-2 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 transition"
                          style={{ background: ACCENT }}>
                          {groupCreating ? '...' : 'Créer'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Liste de tous les groupes WhatsApp avec checkbox */}
                {whatsappGroups.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Groupes sur votre WhatsApp
                      </h3>
                      <span className="text-[11px] text-gray-400">{whatsappGroups.length} groupe{whatsappGroups.length > 1 ? 's' : ''} trouvé{whatsappGroups.length > 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-[12px] text-gray-500">Cochez les groupes que Rita doit animer :</p>
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                      {whatsappGroups.map(wg => {
                        const isManaged = (groupConfig.groups || []).some(g => g.groupJid === wg.id);
                        return (
                          <label key={wg.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition ${isManaged ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'}`}>
                            <input type="checkbox" checked={isManaged} onChange={() => {
                              if (isManaged) {
                                // Retirer
                                const idx = (groupConfig.groups || []).findIndex(g => g.groupJid === wg.id);
                                if (idx !== -1) removeGroupFromAnimation(idx);
                              } else {
                                // Ajouter
                                updateGroupConfig('groups', [...(groupConfig.groups || []), { groupJid: wg.id, name: wg.name, inviteUrl: '', role: 'custom', autoCreated: false, scheduledPosts: [] }]);
                              }
                            }}
                              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[13px] font-medium text-gray-900 truncate block">{wg.name}</span>
                              <span className="text-[10px] text-gray-400">{wg.participants} membre{wg.participants > 1 ? 's' : ''}</span>
                            </div>
                            {isManaged && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium whitespace-nowrap">✓ Animé</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Groupes gérés */}
                {!(groupConfig.groups?.length) ? (
                  <div className="text-center py-12 bg-white border rounded-2xl">
                    <Megaphone className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-[15px] font-bold text-gray-700">Aucun groupe à animer</p>
                    <p className="text-[12px] text-gray-400 mt-1">Créez ou ajoutez un groupe pour que Rita l'anime automatiquement.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupConfig.groups.map((group, gi) => {
                      const postsCount = group.scheduledPosts?.length || 0;
                      const activeCount = (group.scheduledPosts || []).filter(p => p.enabled !== false).length;
                      const isExpanded = groupExpandedIdx === gi;
                      const roleObj = GA_ROLES.find(r => r.value === group.role);

                      return (
                        <div key={gi} className="bg-white border rounded-2xl overflow-hidden">
                          {/* Group header */}
                          <div className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition" onClick={() => setGroupExpandedIdx(isExpanded ? null : gi)}>
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">
                              {group.role === 'clients' ? '🛒' : group.role === 'prospects' ? '🎯' : group.role === 'vip' ? '⭐' : '👥'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[14px] font-bold text-gray-900 truncate">{group.name || group.groupJid}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">{roleObj?.label || group.role}</span>
                                <span className="text-[10px] text-gray-400">{postsCount} post{postsCount > 1 ? 's' : ''} • {activeCount} actif{activeCount > 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            <button onClick={e => { e.stopPropagation(); removeGroupFromAnimation(gi); }}
                              className="text-[11px] text-gray-400 hover:text-red-500 transition mr-2">Retirer</button>
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>

                          {isExpanded && (
                            <div className="px-5 pb-5 space-y-4 border-t">
                              {/* Actions */}
                              <div className="flex flex-wrap gap-2 pt-3">
                                <select value={group.role} onChange={e => updateManagedGroup(gi, { ...group, role: e.target.value })}
                                  className="text-[12px] border rounded-lg px-2 py-1.5 bg-gray-50 font-medium">
                                  {GA_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                                {group.inviteUrl ? (
                                  <button onClick={() => { navigator.clipboard.writeText(group.inviteUrl); setGroupMsg({ ok: true, text: '📋 Lien copié !' }); setTimeout(() => setGroupMsg(null), 2000); }}
                                    className="text-[12px] px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition font-medium">
                                    📋 Copier le lien
                                  </button>
                                ) : (
                                  <button onClick={() => refreshGroupInvite(group.groupJid, gi)}
                                    className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition font-medium">
                                    🔗 Générer lien d'invitation
                                  </button>
                                )}
                              </div>

                              {/* Invite URL */}
                              {group.inviteUrl && (
                                <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2">
                                  <span className="text-[11px] text-emerald-600 truncate flex-1">{group.inviteUrl}</span>
                                  <button onClick={() => refreshGroupInvite(group.groupJid, gi)}
                                    className="text-[10px] text-emerald-700 hover:underline font-medium whitespace-nowrap">🔄 Régénérer</button>
                                </div>
                              )}

                              {/* Scheduled Posts */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">📢 Posts planifiés</h5>
                                  <button onClick={() => {
                                    const posts = [...(group.scheduledPosts || []), { type: 'text', content: '', productName: '', days: [], hour: '09:00', enabled: true }];
                                    updateManagedGroup(gi, { ...group, scheduledPosts: posts });
                                  }}
                                    className="text-[12px] px-3 py-1 rounded-lg text-white font-medium transition" style={{ background: ACCENT }}>
                                    + Ajouter
                                  </button>
                                </div>

                                {!postsCount && (
                                  <div className="text-center py-6 bg-gray-50 rounded-xl">
                                    <p className="text-[11px] text-gray-400">Aucun post planifié. Rita peut animer ce groupe !</p>
                                  </div>
                                )}

                                {(group.scheduledPosts || []).map((post, pi) => (
                                  <div key={pi} className="bg-gray-50 border rounded-xl p-4 space-y-3">
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <select value={post.type} onChange={e => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], type: e.target.value };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} className="text-[12px] border rounded-lg px-3 py-1.5 bg-white font-medium">
                                        <option value="text">📝 Texte</option>
                                        <option value="image">🖼️ Image</option>
                                        <option value="product">🛍️ Produit</option>
                                      </select>
                                      <input type="time" value={post.hour || '09:00'} onChange={e => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], hour: e.target.value };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} className="text-[12px] border rounded-lg px-2 py-1.5" />
                                      <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                                        <div className={`relative w-9 h-5 rounded-full transition ${post.enabled !== false ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                          onClick={() => {
                                            const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], enabled: !(post.enabled !== false) };
                                            updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                          }}>
                                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${post.enabled !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                        </div>
                                        <span className="text-[11px] font-medium text-gray-600">{post.enabled !== false ? 'Actif' : 'Pause'}</span>
                                      </label>
                                      <button onClick={() => {
                                        const ps = [...group.scheduledPosts]; ps.splice(pi, 1);
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} className="text-gray-400 hover:text-red-500 transition">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>

                                    {post.type === 'text' && (
                                      <textarea value={post.content || ''} onChange={e => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], content: e.target.value };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} rows={2} placeholder="Message à envoyer..." className="ac-textarea" />
                                    )}
                                    {post.type === 'image' && (
                                      <input type="text" value={post.content || ''} onChange={e => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], content: e.target.value };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} placeholder="https://example.com/image.jpg" className="ac-input" />
                                    )}
                                    {post.type === 'product' && (
                                      <select value={post.productName || ''} onChange={e => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], productName: e.target.value };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} className="ac-input">
                                        <option value="">— Choisir un produit —</option>
                                        {groupProducts.map(p => <option key={p} value={p}>{p}</option>)}
                                      </select>
                                    )}

                                    {/* Days */}
                                    <div className="flex flex-wrap gap-1.5">
                                      {GA_DAYS.map(d => (
                                        <button key={d} onClick={() => {
                                          const days = (post.days || []).includes(d) ? post.days.filter(x => x !== d) : [...(post.days || []), d];
                                          const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], days };
                                          updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                        }}
                                          className={`text-[11px] px-2 py-0.5 rounded-full border transition font-medium ${(post.days || []).includes(d) ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-gray-200 text-gray-400'}`}>
                                          {d.charAt(0).toUpperCase() + d.slice(1, 3)}
                                        </button>
                                      ))}
                                      <button onClick={() => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], days: GA_DAYS.slice() };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} className="text-[10px] px-2 text-emerald-600 hover:underline font-medium">Tous</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Save button */}
                <div className="flex items-center justify-between">
                  <button onClick={saveGroupConfig} disabled={groupSaving}
                    className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 transition"
                    style={{ background: ACCENT }}>
                    {groupSaving ? 'Enregistrement...' : '💾 Sauvegarder l\'animation'}
                  </button>
                </div>

                {/* Info */}
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-[12px] text-blue-700 space-y-1">
                  <p className="font-bold">💡 Comment fonctionne l'animation ?</p>
                  <p>• <strong>Rejoindre un groupe</strong> : collez un lien d'invitation et Rita rejoint automatiquement le groupe.</p>
                  <p>• <strong>Programmer des produits</strong> : ajoutez des posts de type "Produit" → Rita envoie la fiche + photo aux jours/heures choisis.</p>
                  <p>• <strong>Calendrier automatique</strong> : choisissez les jours de la semaine et l'heure d'envoi pour chaque post.</p>
                  <p>• Rita vérifie toutes les minutes si un post doit être envoyé (fuseau Africa/Douala).</p>
                  <p>• Mettez un post en pause avec le toggle Actif/Pause sans le supprimer.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── TAB: MARKETING / RELANCES ─── */}
        {activeTab === 'marketing' && (
          <div className="space-y-6">
            
            {/* ─── AUTOPILOTE IA RELANCES ─── */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50/10">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </span>
                    Autopilote IA : Relances Autonomes
                  </h2>
                  <p className="text-[13px] text-gray-500 mt-1">Laissez l'IA relancer elle-même les clients inactifs en scannant leurs historiques.</p>
                </div>
                <Toggle
                  checked={config.autoRelanceEnabled || false}
                  onChange={(val) => updateConfig('autoRelanceEnabled', val)}
                />
              </div>

              {config.autoRelanceEnabled && (
                <div className="p-6 bg-blue-50/20 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label="Délai de silence (en heures)" hint="Attendre x h avant de relancer">
                      <input
                        type="number"
                        min="1"
                        max="72"
                        className="ac-input font-medium"
                        value={config.autoRelanceDelayHours === undefined ? 2 : config.autoRelanceDelayHours}
                        onChange={(e) => updateConfig('autoRelanceDelayHours', Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Maximum de relances" hint="Combien de fois max par client">
                      <input
                        type="number"
                        min="1"
                        max="3"
                        className="ac-input font-medium"
                        value={config.autoRelanceMaxCount === undefined ? 1 : config.autoRelanceMaxCount}
                        onChange={(e) => updateConfig('autoRelanceMaxCount', Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200/60">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[12px] text-amber-800 leading-relaxed font-medium">
                      Ce mode est 100% autonome. Il tourne en tâche de fond 24h/24 et consomme des crédits IA (Groq) pour analyser les conversations avant de créer la relance parfaite.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Send className="w-4 h-4 text-emerald-600" />
                  </span>
                  Relances Automatiques par Produit
                </h2>
                <p className="text-[13px] text-gray-500 mt-1">Recontactez massivement (mais un par un) tous les clients ayant manifesté de l'intérêt ou commandé un produit spécifique.</p>
              </div>
              <div className="p-6 space-y-5">
                <Field label="Sélectionnez le produit">
                  <select 
                    value={rpProduct} 
                    onChange={e => handleProductSelect(e.target.value)}
                    className="ac-input appearance-none bg-white font-medium"
                  >
                    <option value="">-- Choisir un produit du catalogue --</option>
                    {(config.productCatalog || []).map((p, idx) => (
                      <option key={idx} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Message WhatsApp de relance" hint="Sera envoyé à tous les clients concernés">
                  <textarea
                    value={rpMessage}
                    onChange={e => setRpMessage(e.target.value)}
                    placeholder="Bonjour, suite à votre achat, nous avons une offre..."
                    className="ac-textarea"
                    rows={4}
                  />
                </Field>

                {rpStatus && (
                  <div className={`text-[13px] px-4 py-3 rounded-xl font-medium ${rpStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {rpStatus.type === 'success' ? '✅ ' : '❌ '}{rpStatus.text}
                  </div>
                )}

                <div className="pt-2">
                  <button 
                    onClick={handleRelanceProduct} 
                    disabled={rpLoading || !rpProduct || !rpMessage}
                    className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-5 py-2.5 text-[13px] font-bold text-white rounded-xl disabled:opacity-50 transition-all shadow-sm"
                    style={{ background: ACCENT }}
                  >
                    {rpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Lancer la campagne de relance
                  </button>
                  <p className="text-[11px] text-gray-400 mt-2 italic">⚠️ L'envoi est progressif pour protéger votre numéro contre les signalements WhatsApp (anti-spam).</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ═══ BOTTOM SAVE BAR ═══ */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)] z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-[13px] font-medium text-gray-600">Modifications non enregistrées</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <button onClick={handleReset}
                className="w-full sm:w-auto px-4 py-2 text-[13px] font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Réinitialiser
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-5 py-2.5 text-[13px] font-bold text-white rounded-xl disabled:opacity-50 transition-all"
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
        <div className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 px-4 py-2.5 rounded-xl text-[13px] font-semibold shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
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
