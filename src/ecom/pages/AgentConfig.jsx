import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Save, ChevronDown, Send, RotateCcw, Bell, Settings, Bot, MessageSquare, Sparkles, Package, BarChart3, Warehouse, UserCog, Headphones, Clock, Mail, Phone, Building2, MapPin, Zap, ShieldCheck, Globe2, Target, AlertTriangle, Users, MessageCircle, TrendingUp, Eye, Star, Trash2, Plus, Image, Video, X, Download, Upload, FileText, ToggleLeft, ToggleRight, Radio, PlayCircle, Truck, Megaphone, Smile, Briefcase, Crown, Flame, Mic, Type, Volume2 } from 'lucide-react';
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
  { value: 'warm', label: 'Tutoiement chaleureux', desc: 'Naturelle, humaine, proche du client', Icon: Smile },
  { value: 'professional', label: 'Tutoiement professionnel', desc: 'Sérieuse, crédible, claire', Icon: Briefcase },
  { value: 'formal', label: 'Vouvoiement respectueux', desc: 'Polie, courtoise, relation premium', Icon: Crown },
  { value: 'humorous', label: 'Humoristique légère', desc: 'Ajoute des blagues courtes sans perdre le sérieux', Icon: MessageCircle },
  { value: 'persuasive', label: 'Persuasive', desc: 'Orientée closing, enthousiaste', Icon: Flame },
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
  { level: 3, label: 'Commerciale', desc: "Gère les objections et pousse à l'achat", color: 'bg-primary-100 text-primary-700' },
  { level: 4, label: 'Négociatrice', desc: 'Conclut des ventes de façon autonome', color: 'bg-amber-100 text-amber-700' },
  { level: 5, label: 'Chasseuse', desc: 'Mode offensif : closing agressif, upsell', color: 'bg-red-100 text-red-700' },
];

const MODES_CONFIG = [
  { id: 'client', label: '👤 Mode Client', subtitle: 'Vente & Support', desc: 'Rita parle au client : chaleureuse, naturelle, persuasive. Suit la logique Comprendre → Répondre → Valeur → Question.', color: 'border-primary-400 bg-primary-50/60', iconBg: 'bg-primary-100', iconColor: 'text-primary-700' },
  { id: 'boss', label: '🧑‍💼 Mode Boss', subtitle: 'Analyse & Rapports', desc: 'Rita parle au boss : professionnelle, analytique, directe. Analyse les conversations, explique les erreurs, propose des améliorations.', color: 'border-blue-400 bg-blue-50/60', iconBg: 'bg-blue-100', iconColor: 'text-blue-700' },
  { id: 'execution', label: '⚙️ Mode Exécution', subtitle: 'Actions Boss', desc: 'Le boss donne une instruction, Rita comprend, adapte et exécute intelligemment. Elle ne copie jamais le message du boss.', color: 'border-amber-400 bg-amber-50/60', iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
];

const RESPONSE_MODE_OPTIONS = [
  { value: 'text', label: 'Texte uniquement' },
  { value: 'voice', label: 'Voix uniquement' },
  { value: 'both', label: 'Texte + voix' },
];

const TTS_PROVIDER_OPTIONS = [
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

const isInstanceConnected = (status) => ['connected', 'active', 'open'].includes(status);

const getInstanceStatusLabel = (status) => {
  switch (status) {
    case 'connected':
    case 'active':
    case 'open':
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
      className={`relative self-end sm:self-auto w-[44px] h-[26px] rounded-full transition-all duration-200 flex-shrink-0 ${enabled ? 'bg-primary-500' : 'bg-gray-200 hover:bg-gray-300'}`}>
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
              className={`w-full text-left px-3.5 py-2 text-[13px] hover:bg-gray-50 transition-colors ${opt.value === value ? 'text-primary-700 font-semibold bg-primary-50/50' : 'text-gray-600'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Accordion field — opens modal on click ───
const AccordionField = ({ icon, label, badge, badgeColor = 'emerald', value, onChange, placeholder, rows = 6, hint }) => {
  const [open, setOpen] = useState(false);
  const preview = typeof value === 'string'
    ? (value.trim() ? value.replace(/\n/g, ' · ').slice(0, 72) + (value.length > 72 ? '…' : '') : null)
    : null;

  return (
    <>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors bg-white hover:bg-gray-50"
        >
          {icon && <span className="text-[16px] flex-shrink-0">{icon}</span>}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
              {label}
              {hint && <span className="text-[10px] text-gray-400 font-normal">{hint}</span>}
            </p>
            <p className="text-[11px] truncate mt-0.5 text-gray-400 italic">
              {preview || 'Non renseigné — cliquez pour éditer'}
            </p>
          </div>
          {badge && (
            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              badgeColor === 'emerald' ? 'bg-primary-100 text-primary-700'
              : badgeColor === 'gray' ? 'bg-gray-100 text-gray-500'
              : 'bg-amber-100 text-amber-700'
            }`}>{badge}</span>
          )}
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400" />
        </button>
      </div>
      <TextEditModal
        open={open}
        title={label}
        value={value}
        placeholder={placeholder}
        rows={rows}
        multiline={true}
        onClose={() => setOpen(false)}
        onConfirm={val => onChange({ target: { value: val } })}
      />
    </>
  );
};

// ─── Auto-growing textarea ───
const AutoTextarea = ({ value, onChange, placeholder, rows = 3, expandedRows = 9, className }) => {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={focused ? expandedRows : rows}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`${className} transition-all duration-300`}
    />
  );
};

// ─── Text Edit Modal ───
const TextEditModal = ({ open, title, value, placeholder, rows = 6, onClose, onConfirm, multiline = true }) => {
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setDraft(value || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, value]);

  if (!open) return null;

  const handleConfirm = () => { onConfirm(draft); onClose(); };
  const handleKeyDown = (e) => {
    if (!multiline && e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-[14px] font-bold text-gray-900">{title || 'Modifier'}</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          {multiline ? (
            <textarea
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={placeholder}
              rows={rows}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 text-[13px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent leading-relaxed"
            />
          ) : (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={placeholder}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 text-[13px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
            />
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
            Annuler
          </button>
          <button type="button" onClick={handleConfirm}
            className="px-5 py-2 text-[13px] font-bold text-white rounded-xl shadow-sm transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#0F6B4F' }}>
            ✓ Valider
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal-backed text input ───
const ModalInput = ({ value, onChange, placeholder, label, className, type = 'text', disabled, style, ...rest }) => {
  const [open, setOpen] = useState(false);
  const displayVal = value ?? '';
  const isEmpty = !displayVal.toString().trim();

  if (type !== 'text' && type !== 'email' && type !== 'tel' && type !== 'url') {
    return <input value={value ?? ''} onChange={onChange} placeholder={placeholder} type={type} className={className} disabled={disabled} style={style} {...rest} />;
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`${className || 'ac-input'} text-left truncate w-full ${isEmpty ? 'text-gray-400' : 'text-gray-800'}`}
        style={style}
      >
        {isEmpty ? (placeholder || 'Cliquer pour saisir…') : displayVal}
      </button>
      <TextEditModal
        open={open}
        title={label || placeholder}
        value={displayVal}
        placeholder={placeholder}
        multiline={false}
        onClose={() => setOpen(false)}
        onConfirm={val => onChange({ target: { value: val } })}
      />
    </>
  );
};

// ─── Modal-backed textarea ───
const ModalTextarea = ({ value, onChange, placeholder, label, rows = 6, className, style, ...rest }) => {
  const [open, setOpen] = useState(false);
  const displayVal = value ?? '';
  const isEmpty = !displayVal.toString().trim();
  const preview = displayVal.replace(/\n/g, ' · ').slice(0, 90) + (displayVal.length > 90 ? '…' : '');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${className || 'ac-textarea'} text-left w-full ${isEmpty ? 'text-gray-400 italic' : 'text-gray-700'}`}
        style={{ minHeight: '2.5rem', ...style }}
      >
        {isEmpty ? (placeholder || 'Cliquer pour saisir…') : preview}
      </button>
      <TextEditModal
        open={open}
        title={label || placeholder}
        value={displayVal}
        placeholder={placeholder}
        rows={rows}
        multiline={true}
        onClose={() => setOpen(false)}
        onConfirm={val => onChange({ target: { value: val } })}
      />
    </>
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

  // Store import modal
  const [showStoreImport, setShowStoreImport] = useState(false);
  const [storeImportProducts, setStoreImportProducts] = useState([]);
  const [storeImportLoading, setStoreImportLoading] = useState(false);
  const [storeImportSearch, setStoreImportSearch] = useState('');
  const [storeImportSelected, setStoreImportSelected] = useState(new Set());
  const [storeImportPage, setStoreImportPage] = useState(1);
  const [storeImportTotal, setStoreImportTotal] = useState(0);

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
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Broadcast composer
  const [bcSelectedGroups, setBcSelectedGroups] = useState(new Set());
  const [bcMessage, setBcMessage] = useState('');
  const [bcMediaUrl, setBcMediaUrl] = useState('');
  const [bcCaption, setBcCaption] = useState('');
  const [bcScheduleAt, setBcScheduleAt] = useState('');
  const [bcSending, setBcSending] = useState(false);
  const [bcResult, setBcResult] = useState(null);
  const [openedGroup, setOpenedGroup] = useState(null); // { id, name, participants }
  const [groupSearch, setGroupSearch] = useState('');
  const [groupView, setGroupView] = useState('list'); // 'list' | 'campaigns'
  const [campaigns, setCampaigns] = useState([]);
  const [campaignForm, setCampaignForm] = useState({ name: '', message: '', mediaUrl: '', caption: '', scheduleAt: '', groupJids: [], repeat: false, repeatDays: [], repeatHour: '09:00' });
  const [campaignMediaUploading, setCampaignMediaUploading] = useState(false);
  const [campaignEditing, setCampaignEditing] = useState(null); // index ou null
  const [campaignSaving, setCampaignSaving] = useState(false);

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
  const [focusedDescIdx, setFocusedDescIdx] = useState(null);
  const [productFormTab, setProductFormTab] = useState('info');
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
    personalityDescription: '',
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

        // Migration: personality.description → personalityDescription (champ plat)
        if (!loadedConfig.personalityDescription && loadedConfig.personality) {
          const p = loadedConfig.personality;
          loadedConfig.personalityDescription = typeof p === 'string' ? p : (p?.description || '');
        }

        // Migration: Converter 'product' -> 'productName' et ajouter 'rating' par défaut
        if (loadedConfig.testimonials?.length) {
          loadedConfig.testimonials = loadedConfig.testimonials.map(t => ({
            ...t,
            productName: t.productName || t.product || '',
            rating: t.rating || 5,
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

  // Auto-sélectionner la première instance connectée si aucune n'est choisie
  useEffect(() => {
    if (instances.length === 0 || config.instanceId) return;
    const connected = instances.find(i => isInstanceConnected(i.status)) || instances[0];
    if (connected?._id) {
      set('instanceId', connected._id);
    }
  }, [instances]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setShowStoreImport(false);
    setShowImport(false);
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

  // ─── Store import helpers ───
  const fetchStoreImportProducts = useCallback(async (search = '', page = 1) => {
    setStoreImportLoading(true);
    try {
      const res = await ecomApi.get('/store-products', { params: { search, page, limit: 24 } });
      const data = res.data?.data || res.data || {};
      const products = Array.isArray(data) ? data : (data.products || data.items || []);
      const total = data.total || data.totalCount || products.length;
      setStoreImportProducts(products);
      setStoreImportTotal(total);
    } catch (e) {
      setStoreImportProducts([]);
      setStoreImportTotal(0);
    } finally {
      setStoreImportLoading(false);
    }
  }, []);

  const openStoreImport = () => {
    setShowStoreImport(true);
    setStoreImportSearch('');
    setStoreImportSelected(new Set());
    setStoreImportPage(1);
    fetchStoreImportProducts('', 1);
  };

  const stripHtml = (html) => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const confirmStoreImport = () => {
    const toAdd = storeImportProducts
      .filter(p => storeImportSelected.has(p._id || p.id))
      .map(p => ({
        name: p.name || '',
        price: p.price != null ? String(p.price) : '',
        description: stripHtml(p.description),
        category: p.category || '',
        images: (p.images || []).map(img => (typeof img === 'string' ? img : (img.url || img.src || ''))).filter(Boolean),
        videos: [],
        features: Array.isArray(p.features) ? p.features.map(f => (typeof f === 'string' ? f : (f.text || f.value || ''))) : [],
        faq: Array.isArray(p.faq) ? p.faq.map(f => ({ question: f.question || '', answer: f.answer || '' })) : [],
        objections: [],
        inStock: p.stock > 0 || p.inStock !== false,
        quantityOffers: [],
      }));
    if (!toAdd.length) return;
    setConfig(prev => ({ ...prev, productCatalog: [...(prev.productCatalog || []), ...toAdd] }));
    setHasChanges(true);
    setShowStoreImport(false);
    setStoreImportSelected(new Set());
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

  // ─── Product multi-select ───
  const toggleSelectProduct = (idx) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedProducts.size === config.productCatalog.length) setSelectedProducts(new Set());
    else setSelectedProducts(new Set(config.productCatalog.map((_, i) => i)));
  };
  const deleteSelectedProducts = () => {
    const remaining = config.productCatalog.filter((_, i) => !selectedProducts.has(i));
    set('productCatalog', remaining);
    setSelectedProducts(new Set());
    setEditingProduct(null);
  };

  // ─── Product features/faq/objections helpers ───
  const addProductFeature = (idx, val) => {
    if (!val?.trim()) return;
    updateProduct(idx, 'features', [...(config.productCatalog[idx]?.features || []), val.trim()]);
  };
  const removeProductFeature = (idx, fIdx) => {
    updateProduct(idx, 'features', (config.productCatalog[idx]?.features || []).filter((_, i) => i !== fIdx));
  };
  const addProductFaq = (idx) => {
    updateProduct(idx, 'faq', [...(config.productCatalog[idx]?.faq || []), { question: '', answer: '' }]);
  };
  const updateProductFaq = (idx, fIdx, field, val) => {
    const updated = (config.productCatalog[idx]?.faq || []).map((f, i) => i === fIdx ? { ...f, [field]: val } : f);
    updateProduct(idx, 'faq', updated);
  };
  const removeProductFaq = (idx, fIdx) => {
    updateProduct(idx, 'faq', (config.productCatalog[idx]?.faq || []).filter((_, i) => i !== fIdx));
  };
  const addProductObjection = (idx) => {
    updateProduct(idx, 'objections', [...(config.productCatalog[idx]?.objections || []), { objection: '', response: '' }]);
  };
  const updateProductObjection = (idx, oIdx, field, val) => {
    const updated = (config.productCatalog[idx]?.objections || []).map((o, i) => i === oIdx ? { ...o, [field]: val } : o);
    updateProduct(idx, 'objections', updated);
  };
  const removeProductObjection = (idx, oIdx) => {
    updateProduct(idx, 'objections', (config.productCatalog[idx]?.objections || []).filter((_, i) => i !== oIdx));
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
    setGroupsLoading(true);
    try {
      const [cfgRes, grpRes, ritaRes] = await Promise.all([
        ecomApi.get('/v1/rita-flows/config', { params: { userId } }).catch(() => ({ data: { config: null } })),
        ecomApi.get('/v1/rita-flows/groups/list', { params: { userId } }).catch(e => { console.error('groups/list error:', e.response?.data || e.message); return { data: { groups: [] } }; }),
        ecomApi.get('/v1/external/whatsapp/rita-config', { params: { userId } }).catch(() => ({ data: { config: null } })),
      ]);
      setGroupConfig(cfgRes.data.config || { enabled: false, flows: [], groups: [], settings: {} });
      setWhatsappGroups(grpRes.data.groups || []);
      setGroupProducts((ritaRes.data.config?.productCatalog || []).map(p => p.name));
    } catch (err) {
      console.error('Erreur chargement groupes:', err);
      setGroupConfig({ enabled: false, flows: [], groups: [], settings: {} });
    } finally {
      setGroupsLoading(false);
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

  // Campagnes groupes — persistées en localStorage par userId
  const getCampaignKey = () => `group_campaigns_${userId}`;
  const loadCampaigns = () => {
    try { return JSON.parse(localStorage.getItem(getCampaignKey()) || '[]'); } catch { return []; }
  };
  const saveCampaignsToStorage = (list) => { try { localStorage.setItem(getCampaignKey(), JSON.stringify(list)); } catch {} };

  const openCampaigns = () => {
    setCampaigns(loadCampaigns());
    setCampaignEditing(null);
    setCampaignForm({ name: '', message: '', mediaUrl: '', caption: '', scheduleAt: '', groupJids: [], repeat: false, repeatDays: [], repeatHour: '09:00' });
    setGroupView('campaigns');
  };

  const saveCampaign = () => {
    if (!campaignForm.name.trim()) return setGroupMsg({ ok: false, text: 'Donnez un nom à la campagne.' });
    if (!campaignForm.message.trim() && !campaignForm.mediaUrl.trim()) return setGroupMsg({ ok: false, text: 'Ajoutez un message ou un média.' });
    if (!campaignForm.groupJids.length) return setGroupMsg({ ok: false, text: 'Sélectionnez au moins un groupe.' });
    setCampaignSaving(true);
    const current = loadCampaigns();
    if (campaignEditing !== null) {
      current[campaignEditing] = { ...campaignForm, updatedAt: new Date().toISOString() };
    } else {
      current.push({ ...campaignForm, createdAt: new Date().toISOString(), sent: false });
    }
    saveCampaignsToStorage(current);
    setCampaigns(current);
    setCampaignEditing(null);
    setCampaignForm({ name: '', message: '', mediaUrl: '', caption: '', scheduleAt: '', groupJids: [] });
    setCampaignSaving(false);
    setGroupMsg({ ok: true, text: '✅ Campagne enregistrée' });
    setTimeout(() => setGroupMsg(null), 3000);
  };

  const deleteCampaign = (i) => {
    const current = loadCampaigns();
    current.splice(i, 1);
    saveCampaignsToStorage(current);
    setCampaigns([...current]);
  };

  const sendCampaign = async (i) => {
    const c = campaigns[i];
    if (!c) return;
    if (!c.message?.trim() && !c.mediaUrl?.trim()) return setGroupMsg({ ok: false, text: 'Aucun message dans cette campagne.' });
    if (!c.groupJids?.length) return setGroupMsg({ ok: false, text: 'Aucun groupe dans cette campagne.' });
    setBcSending(true);
    try {
      const { data } = await ecomApi.post('/v1/rita-flows/groups/broadcast', {
        userId,
        groupJids: c.groupJids,
        message: c.message?.trim() || undefined,
        mediaUrl: c.mediaUrl?.trim() || undefined,
        caption: c.caption?.trim() || undefined,
        scheduleAt: (!c.repeat && c.scheduleAt) ? c.scheduleAt : undefined,
      });
      if (data.success && data.sent > 0) {
        setGroupMsg({ ok: true, text: `✅ Envoyée dans ${data.sent} groupe(s)` });
        const current = loadCampaigns();
        current[i] = { ...current[i], sent: true, sentAt: new Date().toISOString() };
        saveCampaignsToStorage(current);
        setCampaigns([...current]);
      } else {
        setGroupMsg({ ok: false, text: data.firstError || data.error || 'Échec envoi' });
      }
    } catch (e) {
      setGroupMsg({ ok: false, text: e.response?.data?.error || e.message });
    } finally {
      setBcSending(false);
      setTimeout(() => setGroupMsg(null), 4000);
    }
  };

  const sendBroadcast = async (targetJids) => {
    const jids = targetJids || [...bcSelectedGroups];
    if (!jids.length) return setGroupMsg({ ok: false, text: 'Sélectionnez au moins un groupe.' });
    if (!bcMessage.trim() && !bcMediaUrl.trim()) return setGroupMsg({ ok: false, text: 'Rédigez un message ou ajoutez un média.' });
    setBcSending(true);
    setBcResult(null);
    try {
      const { data } = await ecomApi.post('/v1/rita-flows/groups/broadcast', {
        userId,
        groupJids: jids,
        message: bcMessage.trim() || undefined,
        mediaUrl: bcMediaUrl.trim() || undefined,
        caption: bcCaption.trim() || undefined,
        scheduleAt: bcScheduleAt || undefined,
      });
      setBcResult(data);
      if (data.success) {
        if (data.sent > 0) {
          setGroupMsg({ ok: true, text: data.scheduled ? `✅ Programmé` : `✅ Envoyé dans ${data.sent} groupe(s)` });
          setBcMessage(''); setBcMediaUrl(''); setBcCaption(''); setBcScheduleAt('');
          setBcSelectedGroups(new Set());
        } else {
          setGroupMsg({ ok: false, text: `Échec envoi : ${data.firstError || 'erreur inconnue'}` });
        }
      } else {
        setGroupMsg({ ok: false, text: data.error || 'Erreur envoi' });
      }
    } catch (e) {
      setGroupMsg({ ok: false, text: e.response?.data?.error || e.message });
    } finally {
      setBcSending(false);
      setTimeout(() => setGroupMsg(null), 4000);
    }
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
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-600 flex items-center justify-center mb-4 shadow-lg animate-pulse">
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
                      ? 'border-primary-600 text-primary-700'
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
            <div className="lg:col-span-2 space-y-5">

              {/* ── Hero Profile Card ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Header: avatar + name + toggle all in one clean row */}
                <div className="px-5 py-4 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #0b3d2e 0%, #0f6b4f 60%, #1a9c70 100%)' }}>
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-[20px] font-black text-white select-none border-2 border-white/30"
                    style={{ background: 'rgba(255,255,255,0.15)' }}
                  >
                    {(config.agentName || 'R').charAt(0).toUpperCase()}
                  </div>
                  {/* Name + role subtitle */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-[15px] leading-tight truncate">
                      {config.agentName || 'Nom de l\'agent'}
                    </p>
                    <p className="text-white/60 text-[12px] truncate">
                      {config.agentRole || 'Rôle non défini'}
                    </p>
                  </div>
                  {/* Activation toggle */}
                  <button
                    type="button"
                    onClick={() => set('enabled', !config.enabled)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all flex-shrink-0 ${
                      config.enabled
                        ? 'bg-white/20 text-white border border-white/30'
                        : 'bg-black/20 text-white/60 border border-white/10'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${config.enabled ? 'bg-primary-400' : 'bg-white/30'}`} />
                    {config.enabled ? 'Actif' : 'Inactif'}
                    <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${config.enabled ? 'bg-primary-500' : 'bg-white/20'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </span>
                  </button>
                </div>

                {/* Fields */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nom de l'agent" required>
                      <ModalInput
                        value={config.agentName}
                        onChange={e => set('agentName', e.target.value)}
                        placeholder="Rita"
                        label="Nom de l'agent"
                        className="ac-input"
                      />
                    </Field>
                    <Field label="Rôle">
                      <ModalInput
                        value={config.agentRole}
                        onChange={e => set('agentRole', e.target.value)}
                        placeholder="Vendeuse WhatsApp IA"
                        label="Rôle"
                        className="ac-input"
                      />
                    </Field>
                  </div>
                  <Field label="Langue principale">
                    <SelectDropdown value={config.language} onChange={v => set('language', v)} options={LANGUAGE_OPTIONS} />
                  </Field>
                </div>
              </div>

              {/* ── WhatsApp Instance ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-gray-900 flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                    </span>
                    WhatsApp
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold ${config.enabled ? 'text-primary-600' : 'text-gray-400'}`}>
                      {config.enabled ? 'Agent actif' : 'Agent inactif'}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  {instances.length === 0 ? (
                    <div className="flex flex-col items-center py-6 gap-2">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-1">
                        <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-[13px] font-semibold text-gray-600">{instanceError || 'Aucune instance connectée'}</p>
                      <p className="text-[12px] text-gray-400 text-center max-w-[260px]">
                        Connectez un numéro WhatsApp dans l'onglet <strong>Service WhatsApp</strong> pour activer l'agent.
                      </p>
                      <button type="button" onClick={loadInstances} className="mt-2 text-[12px] font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-4 py-1.5 rounded-full transition-colors">
                        ↻ Recharger
                      </button>
                    </div>
                  ) : instances.length === 1 ? (
                    <div className="flex items-center gap-3 px-1">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ring-4 ${isInstanceConnected(selectedInstance?.status) ? 'bg-primary-400 ring-primary-100' : 'bg-gray-300 ring-gray-100'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-gray-800 truncate">
                          {selectedInstance?.customName || selectedInstance?.instanceName || 'Instance WhatsApp'}
                        </p>
                        <p className="text-[11px] text-gray-400">{isInstanceConnected(selectedInstance?.status) ? '● Connectée et prête' : '○ Hors ligne'}</p>
                      </div>
                      <span className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${isInstanceConnected(selectedInstance?.status) ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                        {isInstanceConnected(selectedInstance?.status) ? '✓ Prête' : 'Déconnectée'}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-gray-400 mb-2 font-semibold uppercase tracking-wider">Choisir l'instance active</p>
                      {instances.map(inst => (
                        <button
                          key={inst._id}
                          type="button"
                          onClick={() => handleInstanceChange(inst._id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                            config.instanceId === inst._id
                              ? 'border-primary-400 bg-primary-50 shadow-sm'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isInstanceConnected(inst.status) ? 'bg-primary-400' : 'bg-gray-300'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-gray-800 truncate">
                              {inst.customName || inst.instanceName || 'Instance WhatsApp'}
                            </p>
                            <p className="text-[11px] text-gray-400">{isInstanceConnected(inst.status) ? 'Connectée' : 'Déconnectée'}</p>
                          </div>
                          {config.instanceId === inst._id && (
                            <span className="text-[11px] font-bold text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full flex-shrink-0">✓ Sélectionnée</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {instanceSwitching && <p className="mt-3 text-[12px] text-blue-600 text-center">Changement en cours…</p>}
                  {instanceSwitchStatus === 'success' && <p className="mt-3 text-[12px] text-primary-600 text-center">Instance changée ✓</p>}
                  {instanceSwitchStatus === 'error' && <p className="mt-3 text-[12px] text-red-500 text-center">Impossible de changer l'instance.</p>}
                </div>
              </div>

              {/* ── Personnalité + Messages — 2 champs essentiels ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-purple-600" />
                  </span>
                  <div>
                    <h2 className="text-[14px] font-bold text-gray-900">Personnalité &amp; Messages</h2>
                    <p className="text-[11px] text-gray-400">Cliquez sur un champ pour l'éditer.</p>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <AccordionField
                    icon="📝"
                    label="Description de l'agent"
                    value={config.personalityDescription || ''}
                    onChange={e => set('personalityDescription', e.target.value)}
                    placeholder={"Vendeuse professionnelle, chaleureuse, très humaine.\nElle ne se présente jamais comme une IA.\nElle parle avec naturel, comme une vraie personne de confiance.\nElle utilise le prénom du client quand elle le connaît."}
                    rows={8}
                  />
                  <AccordionField
                    icon="👋"
                    label="Message de bienvenue"
                    badge="Premier message"
                    badgeColor="emerald"
                    value={config.welcomeMessage}
                    onChange={e => set('welcomeMessage', e.target.value)}
                    placeholder={"Bonjour ! Je suis Rita, votre assistante.\nComment puis-je vous aider aujourd'hui ? 😊"}
                    rows={5}
                  />
                </div>
              </div>

            </div>

            {/* ── Right column ── */}
            <div className="space-y-4">

              {/* ── Comportement ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center"><Settings size={14} className="text-gray-600" /></span>
                  <h2 className="text-[13px] font-bold text-gray-900">Comportement</h2>
                </div>
                <div className="p-4 space-y-4">

                  {/* Ton — grille compacte 2+3 */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Ton</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {TONE_OPTIONS.map(t => {
                        const active = config.toneStyle === t.value;
                        return (
                          <button key={t.value} type="button" onClick={() => set('toneStyle', t.value)}
                            className={`flex items-center gap-1.5 text-left px-2.5 py-2 rounded-lg border text-[11px] transition-all leading-tight ${
                              active
                                ? 'border-primary-400 bg-primary-50 text-primary-800 font-semibold'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                            }`}>
                            <t.Icon size={13} className="flex-shrink-0" />
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Délai de réponse */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Délai de réponse</p>
                      <span className="text-[13px] font-bold text-primary-700 tabular-nums">{config.responseDelay}s</span>
                    </div>
                    <div className="relative">
                      <input type="range" min="0" max="15" value={config.responseDelay}
                        onChange={e => set('responseDelay', parseInt(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{ accentColor: ACCENT }} />
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] text-gray-300">0s</span>
                        <span className="text-[9px] text-gray-300">15s</span>
                      </div>
                    </div>
                  </div>

                  {/* Toggles compacts */}
                  <div className="space-y-0 divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                    {[
                      { key: 'useEmojis', Icon: Smile, label: 'Emojis dans les réponses' },
                      { key: 'signMessages', Icon: Bot, label: 'Mentionner que c\'est une IA' },
                    ].map(({ key, Icon: ToggleIcon, label }) => (
                      <div key={key} className="flex items-center justify-between px-3 py-2.5 bg-white">
                        <span className="text-[12px] text-gray-600 flex items-center gap-2">
                          <ToggleIcon size={14} className="text-gray-400" />{label}
                        </span>
                        <button type="button" onClick={() => set(key, !config[key])}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${config[key] ? 'bg-primary-500' : 'bg-gray-200'}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${config[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Voix ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center"><Mic size={14} className="text-purple-600" /></span>
                  <h2 className="text-[13px] font-bold text-gray-900">Voix</h2>
                </div>
                <div className="p-4 space-y-4">
                  {/* Mode selector — 3 pills */}
                  <div className="grid grid-cols-3 gap-1.5 bg-gray-100 p-1 rounded-xl">
                    {[
                      { value: 'text', Icon: Type, label: 'Texte' },
                      { value: 'voice', Icon: Mic, label: 'Vocal' },
                      { value: 'both', Icon: Volume2, label: 'Mixte' },
                    ].map(m => {
                      const isActive = (config.responseMode || 'text') === m.value;
                      return (
                        <button key={m.value} type="button" onClick={() => set('responseMode', m.value)}
                          className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] font-semibold transition-all ${
                            isActive ? 'bg-white shadow-sm text-primary-700' : 'text-gray-400 hover:text-gray-600'
                          }`}>
                          <m.Icon size={16} />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {config.responseMode !== 'text' && (
                    <div className="space-y-3">
                      {/* Provider pills */}
                      <div className="flex gap-2">
                        {TTS_PROVIDER_OPTIONS.map(p => (
                          <button key={p.value} type="button" onClick={() => set('ttsProvider', p.value)}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                              (config.ttsProvider || 'elevenlabs') === p.value
                                ? 'border-primary-400 bg-primary-50 text-primary-700'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}>
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {/* Voix disponibles */}
                      <div className="space-y-1.5">
                        {(config.ttsProvider === 'fishaudio' ? FISH_AUDIO_VOICES : ELEVENLABS_VOICES).map(voice => {
                          const isEL = config.ttsProvider !== 'fishaudio';
                          const isSelected = isEL ? config.elevenlabsVoiceId === voice.id : config.fishAudioReferenceId === voice.id;
                          const isPlaying = playingVoiceId === voice.id;
                          return (
                            <div key={voice.id}
                              onClick={() => set(isEL ? 'elevenlabsVoiceId' : 'fishAudioReferenceId', voice.id)}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-primary-400 bg-primary-50'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] flex-shrink-0 ${isSelected ? 'bg-primary-100' : 'bg-gray-100'}`}>
                                {voice.gender}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold text-gray-800">{voice.name}</p>
                                <p className="text-[10px] text-gray-400 truncate">{voice.desc}</p>
                              </div>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); isEL ? previewElevenLabsVoice(voice.id) : previewVoice(voice.id); }}
                                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                                  isPlaying ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-primary-100 hover:text-primary-600'
                                }`}>
                                {isPlaying
                                  ? <span className="text-[8px] font-bold">■</span>
                                  : <span className="text-[8px] font-bold ml-0.5">▶</span>}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Mixte slider */}
                      {config.responseMode === 'both' && (
                        <div>
                          <div className="flex justify-between mb-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fréquence vocale</p>
                            <span className="text-[11px] font-bold text-primary-700">{config.mixedVoiceReplyChance || 0}%</span>
                          </div>
                          <input type="range" min="0" max="100" value={config.mixedVoiceReplyChance || 0}
                            onChange={e => set('mixedVoiceReplyChance', parseInt(e.target.value) || 0)}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ accentColor: ACCENT }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Chat preview ── */}
              <div className="rounded-2xl overflow-hidden border border-primary-900/20" style={{ background: 'linear-gradient(160deg, #0a3528 0%, #0f5c42 50%, #147a58 100%)' }}>
                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-2.5 border-b border-white/10">
                  <div className="w-8 h-8 rounded-full bg-primary-400/20 flex items-center justify-center text-[13px] font-black text-white">
                    {(config.agentName || 'R').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-white leading-none">{config.agentName || 'Rita'}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                      <span className="text-[10px] text-white/50">En ligne</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Aperçu</span>
                </div>

                {/* Messages */}
                <div className="px-3 py-3 max-h-[240px] overflow-y-auto space-y-2" style={{ scrollbarWidth: 'none' }}>
                  {simMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[84%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary-500 text-white rounded-br-sm'
                          : 'bg-white/12 text-white/90 rounded-bl-sm'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {simTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white/12 px-3.5 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                        {[0, 1, 2].map(d => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/50"
                            style={{ animation: `pulse 1.2s ease-in-out ${d * 0.2}s infinite` }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={simEndRef} />
                </div>

                {/* Input */}
                <div className="px-3 pb-3 pt-1">
                  <div className="flex gap-2 bg-white/10 rounded-xl px-3 py-1.5">
                    <input value={simInput} onChange={e => setSimInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSimSend()}
                      placeholder="Testez une question…"
                      className="flex-1 bg-transparent text-[12px] text-white placeholder-white/30 outline-none" />
                    <button onClick={handleSimSend} disabled={simTyping}
                      className="w-7 h-7 flex items-center justify-center bg-primary-500 hover:bg-primary-400 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0">
                      <Send className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>

                <button onClick={() => navigate('/ecom/whatsapp/service?tab=rita')}
                  className="w-full py-2.5 text-[11px] font-bold text-white/50 hover:text-white/80 tracking-wider border-t border-white/10 transition-colors">
                  Ouvrir le vrai chat →
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
                <div className="px-6 pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-violet-500" />
                    </span>
                    <h2 className="text-[14px] font-bold text-gray-900">3 Modes de Fonctionnement</h2>
                  </div>
                  <p className="text-[11.5px] text-gray-400 ml-9">Rita adapte sa personnalité selon l'interlocuteur</p>
                </div>
                <div className="px-4 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'client',    Icon: Users,    label: 'Mode Client',    subtitle: 'Vente & Support',    desc: 'Chaleureuse, naturelle, persuasive. Logique Comprendre → Valeur → Question.', accent: '#05976D', bg: '#f0fdf8', pill: 'bg-primary-100 text-primary-700' },
                    { id: 'boss',      Icon: BarChart3, label: 'Mode Boss',      subtitle: 'Analyse & Rapports', desc: 'Professionnelle, analytique, directe. Analyse les conversations et propose des améliorations.', accent: '#2563eb', bg: '#eff6ff', pill: 'bg-blue-100 text-blue-700' },
                    { id: 'execution', Icon: Settings,  label: 'Mode Exécution', subtitle: 'Actions Boss',        desc: 'Comprend, adapte et exécute les instructions intelligemment sans copier.', accent: '#d97706', bg: '#fffbeb', pill: 'bg-amber-100 text-amber-700' },
                  ].map(mode => {
                    const key = `mode${mode.id.charAt(0).toUpperCase() + mode.id.slice(1)}Enabled`;
                    const active = !!config[key];
                    return (
                      <button key={mode.id} type="button" onClick={() => set(key, !active)}
                        className="relative text-left rounded-xl border-2 transition-all duration-200 overflow-hidden group"
                        style={{ borderColor: active ? mode.accent : '#e5e7eb', background: active ? mode.bg : '#fafafa' }}>
                        {/* top accent bar */}
                        <div className="h-1 w-full transition-all duration-200" style={{ background: active ? mode.accent : '#e5e7eb' }} />
                        <div className="px-4 pt-3 pb-4 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: active ? `${mode.accent}18` : '#f3f4f6' }}>
                              <mode.Icon className="w-4 h-4" style={{ color: active ? mode.accent : '#9ca3af' }} />
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? mode.pill : 'bg-gray-100 text-gray-400'}`}>
                              {active ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-[13px]" style={{ color: active ? mode.accent : '#374151' }}>{mode.label}</p>
                            <p className="text-[10.5px] font-medium text-gray-400 mt-0.5">{mode.subtitle}</p>
                          </div>
                          <p className="text-[11px] text-gray-500 leading-relaxed">{mode.desc}</p>
                          {/* toggle dot */}
                          <div className="mt-1 flex items-center gap-1.5">
                            <div className="w-7 h-4 rounded-full flex items-center px-0.5 transition-all duration-200"
                              style={{ background: active ? mode.accent : '#d1d5db' }}>
                              <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${active ? 'translate-x-3' : 'translate-x-0'}`} />
                            </div>
                            <span className="text-[10.5px] text-gray-400">{active ? 'Activé' : 'Désactivé'}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Autonomy Level */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                      <Target className="w-3.5 h-3.5 text-orange-500" />
                    </span>
                    <h2 className="text-[14px] font-bold text-gray-900">Niveau d'autonomie</h2>
                  </div>
                  <p className="text-[11.5px] text-gray-400 ml-6">Contrôlez jusqu'où Rita peut aller sans intervention humaine</p>
                </div>
                <div className="px-6 pb-6">
                  {/* Slider visuel 5 niveaux */}
                  <div className="flex items-end gap-1.5 mb-4">
                    {AUTONOMY_LEVELS.map((lvl, i) => {
                      const active = config.autonomyLevel === lvl.level;
                      const filled = lvl.level <= config.autonomyLevel;
                      const gradients = ['#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444'];
                      const barH = [28, 36, 44, 52, 60];
                      return (
                        <button key={lvl.level} type="button" onClick={() => set('autonomyLevel', lvl.level)}
                          className="flex-1 flex flex-col items-center gap-1.5 group">
                          <div className="w-full rounded-md transition-all duration-200"
                            style={{ height: barH[i], background: filled ? gradients[i] : '#e5e7eb', opacity: filled ? 1 : 0.5,
                              boxShadow: active ? `0 0 0 2px white, 0 0 0 4px ${gradients[i]}` : 'none' }} />
                          <span className="text-[9.5px] font-semibold transition-colors" style={{ color: filled ? gradients[i] : '#9ca3af' }}>
                            {lvl.level}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Label du niveau actif */}
                  {(() => {
                    const cur = AUTONOMY_LEVELS.find(l => l.level === config.autonomyLevel);
                    const colors = ['#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444'];
                    const bgs = ['#eff6ff','#ecfeff','#f0fdf4','#fffbeb','#fef2f2'];
                    const i = (cur?.level || 1) - 1;
                    return (
                      <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: bgs[i], border: `1px solid ${colors[i]}30` }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ background: colors[i] }}>{cur?.level}</div>
                        <div>
                          <p className="font-bold text-[13px]" style={{ color: colors[i] }}>{cur?.label}</p>
                          <p className="text-[11.5px] text-gray-500 mt-0.5">{cur?.desc}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Détection & Analyse Client */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center">
                      <Eye className="w-3.5 h-3.5 text-cyan-500" />
                    </span>
                    <h2 className="text-[14px] font-bold text-gray-900">Analyse Avant Chaque Réponse</h2>
                  </div>
                  <p className="text-[11.5px] text-gray-400 ml-9">Rita analyse chaque message pour adapter sa stratégie</p>
                </div>
                <div className="px-4 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'detectClientType',    Icon: Users,       label: 'Type de client',   desc: 'Curieux, acheteur, hésitant ou revendeur',         color: '#0891b2', bg: '#ecfeff' },
                    { key: 'detectInterestLevel', Icon: TrendingUp,  label: "Niveau d'intérêt", desc: 'Faible / moyen / élevé → adapter la pression',     color: '#7c3aed', bg: '#f5f3ff' },
                  ].map(item => {
                    const active = !!config[item.key];
                    return (
                      <button key={item.key} type="button" onClick={() => set(item.key, !active)}
                        className="relative text-left rounded-xl border-2 p-4 transition-all duration-200"
                        style={{ borderColor: active ? item.color : '#e5e7eb', background: active ? item.bg : '#fafafa' }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: active ? `${item.color}18` : '#f3f4f6' }}>
                            <item.Icon className="w-4 h-4" style={{ color: active ? item.color : '#9ca3af' }} />
                          </span>
                          <div className="w-8 h-4.5 rounded-full flex items-center px-0.5 transition-all duration-200 mt-0.5"
                            style={{ background: active ? item.color : '#d1d5db', height: 18 }}>
                            <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${active ? 'translate-x-3' : 'translate-x-0'}`} />
                          </div>
                        </div>
                        <p className="font-bold text-[12.5px]" style={{ color: active ? item.color : '#374151' }}>{item.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Follow-up */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Header toggle */}
                <button type="button" onClick={() => set('followUpEnabled', !config.followUpEnabled)}
                  className="w-full flex items-center gap-4 px-6 py-4 border-b border-gray-100 hover:bg-gray-50/50 transition-colors text-left">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: config.followUpEnabled ? '#fdf4ff' : '#f3f4f6' }}>
                    <MessageSquare className="w-4 h-4" style={{ color: config.followUpEnabled ? '#a855f7' : '#9ca3af' }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13.5px] text-gray-900">Relances & Suivi Clients</p>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">Rita relance automatiquement les prospects silencieux</p>
                  </div>
                  {/* big pill toggle */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <span className={`text-[11px] font-bold ${config.followUpEnabled ? 'text-purple-600' : 'text-gray-400'}`}>
                      {config.followUpEnabled ? 'Activé' : 'Désactivé'}
                    </span>
                    <div className="w-10 h-6 rounded-full flex items-center px-0.5 transition-all duration-200"
                      style={{ background: config.followUpEnabled ? '#a855f7' : '#d1d5db' }}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${config.followUpEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </button>

                {config.followUpEnabled && (
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Délai */}
                      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                        <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Relancer après</p>
                        <div className="flex items-baseline gap-1.5">
                          <input type="number" value={config.followUpDelay}
                            onChange={e => set('followUpDelay', parseInt(e.target.value) || 24)}
                            min="1" className="w-16 text-[20px] font-bold text-gray-900 bg-transparent border-none outline-none p-0" />
                          <span className="text-[12px] text-gray-400 font-medium">heures</span>
                        </div>
                      </div>
                      {/* Max relances */}
                      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                        <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Max relances</p>
                        <div className="flex items-center gap-2 mt-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button" onClick={() => set('followUpMaxRelances', n)}
                              className="w-7 h-7 rounded-lg text-[12px] font-bold transition-all"
                              style={{
                                background: config.followUpMaxRelances === n ? '#a855f7' : '#e5e7eb',
                                color: config.followUpMaxRelances === n ? '#fff' : '#6b7280'
                              }}>{n}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Message */}
                    <div>
                      <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Message de relance</p>
                      <ModalTextarea value={config.followUpMessage}
                        onChange={e => set('followUpMessage', e.target.value)}
                        rows={5}
                        label="Message de relance"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[12.5px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
                    </div>
                  </div>
                )}
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
                    <span className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-primary-600" />
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

              {/* Groupe WhatsApmp */}
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
                    <Field label="Lien du groupe" hint="Lien d'invitation WhatsApp (https://...)">
                      <ModalInput
                        value={config.whatsappGroupLink || ''}
                        onChange={e => set('whatsappGroupLink', e.target.value)}
                        placeholder="https://..."
                        label="Lien du groupe WhatsApp"
                        className="ac-input"
                      />
                    </Field>
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
                      <ModalTextarea
                        value={config.followUpOffer || ''}
                        onChange={e => set('followUpOffer', e.target.value)}
                        rows={4}
                        placeholder="Ex: pour aujourd'hui seulement, livraison offerte ou bonus inclus"
                        label="Offre de relance globale"
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
                                <ModalInput value={offer.title || ''} onChange={e => updateCommercialOffer(idx, 'title', e.target.value)} label="Titre de l'offre" className="ac-input" />
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
                              <ModalInput value={offer.appliesTo || ''} onChange={e => updateCommercialOffer(idx, 'appliesTo', e.target.value)} placeholder="Tous les produits / produit spécifique / clients revendeurs" label="S'applique à" className="ac-input" />
                            </Field>
                            <Field label="Bénéfice client">
                              <ModalInput value={offer.benefit || ''} onChange={e => updateCommercialOffer(idx, 'benefit', e.target.value)} placeholder="Réduction, bonus, livraison, cadeau" label="Bénéfice client" className="ac-input" />
                            </Field>
                            <Field label="Message à utiliser">
                              <ModalTextarea value={offer.message || ''} onChange={e => updateCommercialOffer(idx, 'message', e.target.value)} rows={4} label="Message à utiliser" className="ac-textarea" />
                            </Field>
                            <Field label="Conditions">
                              <ModalTextarea value={offer.conditions || ''} onChange={e => updateCommercialOffer(idx, 'conditions', e.target.value)} rows={3} label="Conditions" className="ac-textarea" />
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
              {/* Prix & Négociation */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-bold text-gray-900">💰 Prix & Négociation</h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">Configure comment Rita gère les demandes de réduction</p>
                  </div>
                  <button type="button"
                    onClick={() => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), enabled: !config.pricingNegotiation?.enabled })}
                    className={`relative w-[44px] h-[26px] rounded-full transition-all duration-200 flex-shrink-0 ${config.pricingNegotiation?.enabled ? 'bg-primary-500' : 'bg-gray-200 hover:bg-gray-300'}`}>
                    <span className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${config.pricingNegotiation?.enabled ? 'left-[21px]' : 'left-[3px]'}`} />
                  </button>
                </div>

                {config.pricingNegotiation?.enabled && (
                  <div className="p-5 space-y-4">

                    {/* Politique de prix */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Politique de prix</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button"
                          onClick={() => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), priceIsFinal: true, allowDiscount: false })}
                          className={`text-left px-3 py-3 rounded-xl border-2 transition-all duration-200 ${
                            config.pricingNegotiation?.priceIsFinal ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                          }`}>
                          <p className="font-semibold text-[12px] text-gray-800">🔒 Prix fixe</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Rita ne négocie pas. Le prix affiché est le dernier prix.</p>
                        </button>
                        <button type="button"
                          onClick={() => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), priceIsFinal: false, allowDiscount: true })}
                          className={`text-left px-3 py-3 rounded-xl border-2 transition-all duration-200 ${
                            !config.pricingNegotiation?.priceIsFinal ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                          }`}>
                          <p className="font-semibold text-[12px] text-gray-800">🤝 Prix négociable</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Rita peut accorder des réductions selon tes règles.</p>
                        </button>
                      </div>
                    </div>

                    {/* Si prix négociable */}
                    {config.pricingNegotiation?.allowDiscount && (
                      <div className="space-y-4 pt-3 border-t border-gray-100">

                        {/* Style de négociation */}
                        <div>
                          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Style de négociation</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'firm', label: '💪 Ferme', desc: 'Réduction rare, seulement si insistance' },
                              { id: 'flexible', label: '🤝 Flexible', desc: 'Ouvert à la discussion, à mi-chemin' },
                              { id: 'generous', label: '🎁 Généreux', desc: 'Accorde facilement la réduction max' },
                            ].map(s => (
                              <button key={s.id} type="button"
                                onClick={() => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), negotiationStyle: s.id })}
                                className={`text-left px-2.5 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                                  config.pricingNegotiation?.negotiationStyle === s.id ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                                }`}>
                                <p className="font-semibold text-[11px] text-gray-800">{s.label}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{s.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Remise max */}
                        <Field label="Remise maximum" hint="%">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={config.pricingNegotiation?.maxDiscountPercent || 0}
                            onChange={e => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), maxDiscountPercent: parseInt(e.target.value) || 0 })}
                            className="ac-input w-28"
                          />
                        </Field>

                        {/* Conditions de réduction */}
                        <Field label="Conditions de réduction" hint="quand autoriser une réduction">
                          <ModalTextarea
                            value={config.pricingNegotiation?.discountConditions || ''}
                            onChange={e => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), discountConditions: e.target.value })}
                            placeholder="ex: Si le client achète 2 produits ou plus. Si le client est un ancien client."
                            rows={4}
                            label="Conditions de réduction"
                            className="ac-textarea"
                          />
                        </Field>
                      </div>
                    )}

                    {/* Message de refus */}
                    <Field label="Message de refus" hint="quand le client demande une réduction impossible">
                      <ModalInput
                        value={config.pricingNegotiation?.refusalMessage || ''}
                        onChange={e => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), refusalMessage: e.target.value })}
                        placeholder="ex: C'est déjà notre meilleur prix 🙏"
                        label="Message de refus"
                        className="ac-input"
                      />
                    </Field>

                    {/* Note globale */}
                    <Field label="Note globale sur les prix" hint="instructions spéciales pour Rita">
                      <ModalTextarea
                        value={config.pricingNegotiation?.globalNote || ''}
                        onChange={e => set('pricingNegotiation', { ...(config.pricingNegotiation || {}), globalNote: e.target.value })}
                        placeholder="ex: Ne jamais descendre en dessous du dernier prix. Proposer la livraison gratuite à la place d'une réduction."
                        rows={4}
                        label="Note globale sur les prix"
                        className="ac-textarea"
                      />
                    </Field>

                    <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-amber-500 text-sm mt-0.5">💡</span>
                      <p className="text-[11px] text-amber-700 leading-snug">Tu peux aussi configurer le <strong>dernier prix</strong> et la <strong>réduction max</strong> par produit dans l'onglet <strong>Produits</strong>.</p>
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Store Import Modal ─── */}
        {showStoreImport && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[6vh] pb-4 px-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: 'min(90vh, 700px)' }}>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}15` }}>
                  <Package className="w-5 h-5" style={{ color: ACCENT }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-bold text-gray-900">Importer depuis le store</h3>
                  <p className="text-[12px] text-gray-400">Sélectionnez des produits à ajouter au catalogue Rita</p>
                </div>
                <button onClick={() => setShowStoreImport(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search */}
              <div className="px-5 py-3 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={storeImportSearch}
                  onChange={e => {
                    setStoreImportSearch(e.target.value);
                    setStoreImportPage(1);
                    fetchStoreImportProducts(e.target.value, 1);
                  }}
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': `${ACCENT}40` }}
                />
              </div>

              {/* Product grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {storeImportLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
                  </div>
                ) : storeImportProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Package className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="text-[13px] font-semibold text-gray-400">Aucun produit trouvé</p>
                    <p className="text-[11px] text-gray-300 mt-1">Essayez une autre recherche ou ajoutez des produits dans votre store</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {storeImportProducts.map(p => {
                      const pid = p._id || p.id;
                      const selected = storeImportSelected.has(pid);
                      const thumb = (p.images?.[0]?.url || p.images?.[0]?.src || p.images?.[0] || '');
                      return (
                        <button
                          key={pid}
                          onClick={() => {
                            setStoreImportSelected(prev => {
                              const next = new Set(prev);
                              if (next.has(pid)) next.delete(pid); else next.add(pid);
                              return next;
                            });
                          }}
                          className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${selected ? 'shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
                          style={selected ? { borderColor: ACCENT, background: `${ACCENT}05` } : {}}
                        >
                          {/* Thumbnail */}
                          <div className="aspect-square bg-gray-50 overflow-hidden">
                            {thumb ? (
                              <img src={thumb} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-8 h-8 text-gray-200" />
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="p-2.5">
                            <p className="text-[12px] font-semibold text-gray-900 leading-tight line-clamp-2">{p.name || 'Sans nom'}</p>
                            {p.price != null && (
                              <p className="text-[11px] font-bold mt-1" style={{ color: ACCENT }}>{Number(p.price).toLocaleString('fr-FR')} FCFA</p>
                            )}
                            {p.category && (
                              <p className="text-[10px] text-gray-400 mt-0.5 truncate">{p.category}</p>
                            )}
                          </div>
                          {/* Check badge */}
                          {selected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ background: ACCENT }}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
                <span className="text-[12px] text-gray-400">
                  {storeImportSelected.size > 0
                    ? <span className="font-semibold" style={{ color: ACCENT }}>{storeImportSelected.size} produit{storeImportSelected.size > 1 ? 's' : ''} sélectionné{storeImportSelected.size > 1 ? 's' : ''}</span>
                    : 'Sélectionnez des produits'}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowStoreImport(false)}
                    className="px-4 py-2 text-[12px] font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
                    Annuler
                  </button>
                  <button
                    onClick={confirmStoreImport}
                    disabled={storeImportSelected.size === 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    style={{ background: ACCENT }}>
                    <Plus className="w-3.5 h-3.5" />
                    Importer {storeImportSelected.size > 0 ? `(${storeImportSelected.size})` : ''}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: LIVRAISON & EXPÉDITIONS ─── */}
        {activeTab === 'delivery' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Livraison */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)' }}>
                <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)' }}>
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                      <MapPin className="w-5 h-5 text-white" />
                    </span>
                    <div>
                      <h2 className="text-[16px] font-bold text-white tracking-tight">Configuration Livraison</h2>
                      <p className="text-[12px] text-blue-100 mt-0.5">Tarifs, zones et délais que Rita mentionnera aux clients</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Frais de livraison" hint="ex: 500 FCFA, gratuit">
                      <ModalInput value={config.deliveryFee || ''} onChange={e => set('deliveryFee', e.target.value)} placeholder="ex: 500 FCFA" label="Frais de livraison" className="ac-input" />
                    </Field>
                    <Field label="Délai estimé" hint="ex: 24h, 2-3 jours">
                      <ModalInput value={config.deliveryDelay || ''} onChange={e => set('deliveryDelay', e.target.value)} placeholder="ex: 24 heures" label="Délai estimé" className="ac-input" />
                    </Field>
                  </div>

                  <Field label="Informations complémentaires" hint="optionnel">
                    <ModalTextarea value={config.deliveryInfo || ''} onChange={e => set('deliveryInfo', e.target.value)} placeholder="ex: Paiement à la livraison, vérification avant paiement" rows={4} label="Informations complémentaires" className="ac-textarea" />
                  </Field>

                  {/* Zones header + add button */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="text-[13px] font-bold text-gray-800">Zones de livraison</span>
                      {(config.deliveryZones || []).length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                          {(config.deliveryZones || []).length}
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => { const z = [...(config.deliveryZones || [])]; z.push({ city: '', fee: '', delay: '' }); set('deliveryZones', z); }}
                      className="text-[12px] font-semibold px-4 py-2 rounded-xl transition-all duration-200 hover:shadow-md"
                      style={{ color: '#fff', background: 'linear-gradient(135deg, #0F6B4F, #10b981)' }}>
                      + Ajouter une zone
                    </button>
                  </div>

                  {(config.deliveryZones || []).length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-blue-200 p-8 text-center" style={{ background: 'rgba(59,130,246,0.03)' }}>
                      <MapPin className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                      <p className="text-[13px] font-medium text-gray-400">Aucune zone configurée</p>
                      <p className="text-[11px] text-gray-300 mt-1">Ajoutez vos premières zones de livraison</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(config.deliveryZones || []).map((zone, idx) => (
                        <div key={idx} className="rounded-xl border border-blue-100 p-4 transition-all duration-200 hover:shadow-md hover:border-blue-200" style={{ background: 'linear-gradient(135deg, #fff 0%, #eff6ff 100%)' }}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>{idx + 1}</span>
                              <span className="text-[12px] font-bold text-gray-700">{zone.city || 'Nouvelle zone'}</span>
                            </div>
                            <button type="button" onClick={() => set('deliveryZones', (config.deliveryZones || []).filter((_, i) => i !== idx))}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500 transition-all duration-200 text-[14px]">✕</button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Field label="Ville/Zone">
                              <ModalInput value={zone.city || ''} onChange={e => { const z = [...(config.deliveryZones || [])]; z[idx].city = e.target.value; set('deliveryZones', z); }} placeholder="ex: Douala" label="Ville/Zone" className="ac-input" />
                            </Field>
                            <Field label="Tarif">
                              <ModalInput value={zone.fee || ''} onChange={e => { const z = [...(config.deliveryZones || [])]; z[idx].fee = e.target.value; set('deliveryZones', z); }} placeholder="ex: 500 FCFA" label="Tarif" className="ac-input" />
                            </Field>
                            <Field label="Délai">
                              <ModalInput value={zone.delay || ''} onChange={e => { const z = [...(config.deliveryZones || [])]; z[idx].delay = e.target.value; set('deliveryZones', z); }} placeholder="ex: 24h" label="Délai" className="ac-input" />
                            </Field>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Expéditions */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)' }}>
                <div className="px-6 py-5 flex items-center justify-between gap-3" style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 50%, #f97316 100%)' }}>
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                      <Package className="w-5 h-5 text-white" />
                    </span>
                    <div>
                      <h2 className="text-[16px] font-bold text-white tracking-tight">Expéditions</h2>
                      <p className="text-[12px] text-orange-100 mt-0.5">Villes hors zone — livraison via agence</p>
                    </div>
                  </div>
                  <Toggle enabled={config.expeditionEnabled} onChange={v => set('expeditionEnabled', v)} label="" />
                </div>
                {config.expeditionEnabled && (
                  <div className="p-6 space-y-5">
                    {/* Villes éligibles */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        <span className="text-[13px] font-bold text-gray-800">Villes éligibles</span>
                        {(config.expeditionCities || []).length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #f97316, #c2410c)' }}>
                            {(config.expeditionCities || []).length}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400">Cochez les villes où vous pouvez expédier vos produits</p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {(CITIES_BY_COUNTRY[config.businessCountry || 'CM'] || CITIES_BY_COUNTRY.CM).map((city) => {
                          const isChecked = (config.expeditionCities || []).includes(city);
                          return (
                            <label key={city}
                              className="flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all duration-200"
                              style={isChecked ? { borderColor: '#f97316', background: 'linear-gradient(135deg, #fff7ed, #ffedd5)' } : { borderColor: '#e5e7eb', background: '#fff' }}
                            >
                              <input type="checkbox" checked={isChecked}
                                onChange={(e) => { const u = e.target.checked ? [...(config.expeditionCities || []), city] : (config.expeditionCities || []).filter(c => c !== city); set('expeditionCities', u); }}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500" />
                              <span className={`text-[12px] font-medium ${isChecked ? 'text-orange-800' : 'text-gray-600'}`}>{city}</span>
                            </label>
                          );
                        })}
                      </div>

                      {(config.expeditionCities || []).length > 0 && (
                        <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', border: '1px solid #fed7aa' }}>
                          <p className="text-[11px] text-orange-700">
                            <span className="font-bold">{(config.expeditionCities || []).length} ville(s) sélectionnée(s) :</span> {(config.expeditionCities || []).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Mobile Money */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span className="text-[13px] font-bold text-gray-800">Comptes Mobile Money</span>
                        </div>
                        <button type="button" onClick={() => { const u = { ...config.paymentCoordinates, mobileMoney: [...(config.paymentCoordinates?.mobileMoney || []), { provider: 'Orange Money', number: '', accountName: '' }] }; set('paymentCoordinates', u); }}
                          className="text-[12px] font-semibold px-4 py-2 rounded-xl transition-all duration-200 hover:shadow-md"
                          style={{ color: '#fff', background: 'linear-gradient(135deg, #0F6B4F, #10b981)' }}>
                          + Ajouter compte
                        </button>
                      </div>

                      {(config.paymentCoordinates?.mobileMoney || []).length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-orange-200 p-8 text-center" style={{ background: 'rgba(249,115,22,0.03)' }}>
                          <Phone className="w-8 h-8 text-orange-300 mx-auto mb-2" />
                          <p className="text-[13px] font-medium text-gray-400">Aucun compte configuré</p>
                          <p className="text-[11px] text-gray-300 mt-1">Ajoutez Orange Money, MTN MoMo, etc.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(config.paymentCoordinates?.mobileMoney || []).map((mm, idx) => (
                            <div key={idx} className="rounded-xl border border-amber-100 p-4 transition-all duration-200 hover:shadow-md" style={{ background: 'linear-gradient(135deg, #fff 0%, #fffbeb 100%)' }}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>{idx + 1}</span>
                                  <span className="text-[12px] font-bold text-gray-700">{mm.provider || 'Compte'}</span>
                                </div>
                                <button type="button" onClick={() => { const u = { ...config.paymentCoordinates }; u.mobileMoney = u.mobileMoney.filter((_, i) => i !== idx); set('paymentCoordinates', u); }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500 transition-all duration-200 text-[14px]">✕</button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Field label="Opérateur">
                                  <select value={mm.provider || 'Orange Money'} onChange={e => { const u = { ...config.paymentCoordinates }; u.mobileMoney[idx].provider = e.target.value; set('paymentCoordinates', u); }} className="ac-input">
                                    <option value="Orange Money">Orange Money</option>
                                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                                    <option value="Express Union">Express Union</option>
                                  </select>
                                </Field>
                                <Field label="Numéro">
                                  <ModalInput value={mm.number || ''} onChange={e => { const u = { ...config.paymentCoordinates }; u.mobileMoney[idx].number = e.target.value; set('paymentCoordinates', u); }} placeholder="ex: 690123456" label="Numéro Mobile Money" className="ac-input" />
                                </Field>
                                <Field label="Nom du compte">
                                  <ModalInput value={mm.accountName || ''} onChange={e => { const u = { ...config.paymentCoordinates }; u.mobileMoney[idx].accountName = e.target.value; set('paymentCoordinates', u); }} placeholder="ex: Jean KOUMEN" label="Nom du compte" className="ac-input" />
                                </Field>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    <Field label="Instructions spéciales (optionnel)" hint="Instructions pour Rita concernant les expéditions">
                      <ModalTextarea value={config.expeditionInstructions || ''} onChange={e => set('expeditionInstructions', e.target.value)} placeholder="ex: Toujours demander confirmation du point de retrait avant d'envoyer les coordonnées" rows={4} label="Instructions spéciales expédition" className="ac-textarea" />
                    </Field>

                    {/* Flow info */}
                    <div className="rounded-xl p-5 space-y-3" style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '1px solid #fed7aa' }}>
                      <p className="text-[13px] font-bold text-orange-800 flex items-center gap-2">📦 Comment ça fonctionne</p>
                      <div className="space-y-2">
                        {[
                          { n: '1', t: 'Rita détecte si le client est dans une ville hors zone' },
                          { n: '2', t: "Elle propose l'expédition avec les coordonnées de paiement" },
                          { n: '3', t: 'Le client confirme sa ville et le point de retrait' },
                          { n: '4', t: 'Rita envoie les coordonnées Mobile Money + montant total' },
                          { n: '5', t: 'Après paiement, vous expédiez via votre agence' },
                        ].map((s) => (
                          <div key={s.n} className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #f97316, #c2410c)' }}>{s.n}</span>
                            <span className="text-[12px] text-orange-700 leading-relaxed pt-0.5">{s.t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Récapitulatif */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
                <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
                  <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-slate-300" />
                    Récapitulatif
                  </h2>
                </div>
                <div className="p-5 space-y-3">
                  <div className="rounded-xl p-4 transition-all duration-200 hover:shadow-md" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe' }}>
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                        <MapPin className="w-4 h-4 text-white" />
                      </span>
                      <div className="flex-1">
                        <p className="text-[12px] font-bold text-blue-900">Livraison locale</p>
                        <p className="text-[11px] text-blue-700 mt-0.5">
                          {config.deliveryFee ? `${config.deliveryFee}` : 'Non configuré'}
                          {config.deliveryDelay && ` • ${config.deliveryDelay}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(59,130,246,0.15)' }}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: (config.deliveryZones || []).length > 0 ? '#22c55e' : '#d1d5db' }}></span>
                        <span className="text-[10px] font-semibold text-blue-700">
                          {(config.deliveryZones || []).length} zone{(config.deliveryZones || []).length > 1 ? 's' : ''} configurée{(config.deliveryZones || []).length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl p-4 transition-all duration-200 hover:shadow-md" style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '1px solid #fed7aa' }}>
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f97316, #c2410c)' }}>
                        <Package className="w-4 h-4 text-white" />
                      </span>
                      <div className="flex-1">
                        <p className="text-[12px] font-bold text-orange-900">Expéditions</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: config.expeditionEnabled ? '#22c55e' : '#ef4444' }}></span>
                          <span className="text-[11px] text-orange-700">{config.expeditionEnabled ? 'Activé' : 'Désactivé'}</span>
                        </div>
                      </div>
                    </div>
                    {config.expeditionEnabled && (
                      <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid rgba(249,115,22,0.15)' }}>
                        <div className="flex items-center gap-2">
                          <Globe2 className="w-3 h-3 text-orange-500" />
                          <span className="text-[10px] font-semibold text-orange-700">{(config.expeditionCities || []).length} ville{(config.expeditionCities || []).length > 1 ? 's' : ''} éligible{(config.expeditionCities || []).length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-orange-500" />
                          <span className="text-[10px] font-semibold text-orange-700">{(config.paymentCoordinates?.mobileMoney || []).length} compte{(config.paymentCoordinates?.mobileMoney || []).length > 1 ? 's' : ''} Mobile Money</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Conseil */}
              <div className="rounded-2xl p-5 space-y-3" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', border: '1px solid #a7f3d0' }}>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F6B4F, #10b981)' }}>
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </span>
                  <p className="text-[13px] font-bold text-primary-800">Conseil</p>
                </div>
                <p className="text-[11px] text-primary-700 leading-relaxed">
                  Configurez les zones de livraison locale pour Douala/Yaoundé, et activez les expéditions pour les autres villes du Cameroun.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: PRODUITS ─── */}
        {activeTab === 'products' && (
          <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">

            {/* ══ LEFT — Product list ══ */}
            <div className="lg:w-[300px] flex-shrink-0 flex flex-col gap-3">

              {/* List header */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <h2 className="text-[14px] font-bold text-gray-900">
                    Catalogue
                    <span className="ml-2 text-[11px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {config.productCatalog.length}
                    </span>
                  </h2>
                </div>
                <button onClick={() => setShowImport(!showImport)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Importer CSV">
                  <Upload className="w-3.5 h-3.5" />
                </button>
                <button onClick={openStoreImport}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-bold transition-all hover:opacity-90 active:scale-95 border"
                  style={{ color: ACCENT, borderColor: ACCENT, background: `${ACCENT}10` }}
                  title="Importer depuis le store Scalor">
                  <Package className="w-3.5 h-3.5" />
                  Store
                </button>
                <button onClick={addProduct}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[12px] font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                  style={{ background: ACCENT }}>
                  <Plus className="w-3.5 h-3.5" />
                  Nouveau
                </button>
              </div>

              {showImport && (
                <ProductImportLocal
                  onImportSuccess={(importedProducts) => {
                    const newProducts = importedProducts.map(p => ({
                      name: p.name, price: p.price, category: p.category || '',
                      description: p.description || '', inStock: p.inStock !== false,
                      images: [], videos: [], features: [], faq: [], objections: [], quantityOffers: []
                    }));
                    setConfig(prev => ({ ...prev, productCatalog: [...(prev.productCatalog || []), ...newProducts] }));
                    setHasChanges(true);
                    setShowImport(false);
                  }}
                  onClose={() => setShowImport(false)}
                />
              )}

              {/* Multi-select bar */}
              {selectedProducts.size > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-red-700">{selectedProducts.size} sélectionné{selectedProducts.size > 1 ? 's' : ''}</span>
                  <button onClick={deleteSelectedProducts}
                    className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-800 transition-colors">
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </button>
                </div>
              )}

              {/* Product list */}
              {config.productCatalog.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
                    <Package className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-[13px] font-semibold text-gray-500">Catalogue vide</p>
                  <p className="text-[11px] text-gray-400 mt-1 mb-4 max-w-[180px]">Ajoutez vos produits pour que Rita puisse les recommander</p>
                  <button onClick={addProduct}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white rounded-xl shadow-sm"
                    style={{ background: ACCENT }}>
                    <Plus className="w-3.5 h-3.5" /> Premier produit
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto lg:pr-0.5">
                  {config.productCatalog.map((product, idx) => (
                    <div key={idx}
                      onClick={() => { setEditingProduct(editingProduct === idx ? null : idx); setProductFormTab('info'); }}
                      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                        editingProduct === idx
                          ? 'bg-primary-600 shadow-md'
                          : 'bg-white border border-gray-100 hover:border-primary-200 hover:bg-primary-50/40 hover:shadow-sm'
                      }`}>

                      {/* Checkbox */}
                      <input type="checkbox"
                        checked={selectedProducts.has(idx)}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleSelectProduct(idx)}
                        className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ accentColor: ACCENT }}
                      />

                      {/* Thumbnail */}
                      <div className={`w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-[12px] font-bold transition-all ${
                        editingProduct === idx ? 'bg-white/20 text-white' : 'bg-primary-50 text-primary-700'
                      }`}>
                        {product.images?.[0]
                          ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                          : idx + 1}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] font-semibold truncate leading-tight ${editingProduct === idx ? 'text-white' : 'text-gray-800'}`}>
                          {product.name || <span className="italic opacity-60">Sans nom</span>}
                        </p>
                        <p className={`text-[11px] truncate mt-0.5 ${editingProduct === idx ? 'text-primary-100' : 'text-gray-400'}`}>
                          {product.price || '—'}
                          {product.inStock === false && <span className="ml-1">· 🔴</span>}
                        </p>
                      </div>

                      {/* Delete */}
                      <button onClick={e => { e.stopPropagation(); removeProduct(idx); }}
                        className={`flex-shrink-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                          editingProduct === idx ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                        }`}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* Bottom add */}
                  <button onClick={addProduct}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-1 rounded-xl border-2 border-dashed border-gray-200 text-[12px] font-semibold text-gray-400 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Ajouter un produit
                  </button>
                </div>
              )}
            </div>

            {/* ══ RIGHT — Edit panel ══ */}
            {editingProduct !== null && config.productCatalog[editingProduct] ? (() => {
              const product = config.productCatalog[editingProduct];
              const idx = editingProduct;
              return (
                <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">

                  {/* Panel header */}
                  <div className="px-5 pt-4 pb-0 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-gray-900 truncate">{product.name || 'Nouveau produit'}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {product.price && <span className="font-semibold text-primary-600">{product.price}</span>}
                          {product.category && <span> · {product.category}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button type="button" onClick={() => updateProduct(idx, 'inStock', !(product.inStock !== false))}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                            product.inStock !== false
                              ? 'text-primary-700 bg-primary-50 border-primary-200 hover:bg-primary-100'
                              : 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'
                          }`}>
                          {product.inStock !== false ? '🟢 En stock' : '🔴 Rupture'}
                        </button>
                        <button onClick={() => setEditingProduct(null)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Section tabs */}
                    <div className="flex gap-0.5 -mb-px">
                      {[
                        { id: 'info',    label: 'Infos',    emoji: '📝' },
                        { id: 'medias',  label: 'Médias',   emoji: '📸' },
                        { id: 'vente',   label: 'Vente',    emoji: '💰' },
                        { id: 'contenu', label: 'Contenu',  emoji: '📖' },
                      ].map(tab => (
                        <button key={tab.id} type="button"
                          onClick={() => setProductFormTab(tab.id)}
                          className={`px-3.5 py-2 text-[12px] font-semibold rounded-t-lg border-b-2 transition-all ${
                            productFormTab === tab.id
                              ? 'text-primary-700 border-primary-500 bg-primary-50/50'
                              : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'
                          }`}>
                          <span className="mr-1">{tab.emoji}</span>{tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Panel body */}
                  <div className="flex-1 p-5 space-y-4 overflow-y-auto">

                    {/* ── TAB: INFOS ── */}
                    {productFormTab === 'info' && (
                      <div className="space-y-4">
                        <Field label="Nom du produit" required>
                          <ModalInput value={product.name} onChange={e => updateProduct(idx, 'name', e.target.value)}
                            placeholder="Sérum Éclat" label="Nom du produit" className="ac-input" />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Prix" hint="avec devise">
                            <ModalInput value={product.price} onChange={e => updateProduct(idx, 'price', e.target.value)}
                              placeholder="15 000 FCFA" label="Prix" className="ac-input" />
                          </Field>
                          <Field label="Catégorie">
                            <ModalInput value={product.category || ''} onChange={e => updateProduct(idx, 'category', e.target.value)}
                              placeholder="Soins visage" label="Catégorie" className="ac-input" />
                          </Field>
                        </div>
                        <Field label="Description">
                          <ModalTextarea value={product.description || ''} onChange={e => updateProduct(idx, 'description', e.target.value)}
                            rows={6}
                            placeholder="Anti-taches, illuminateur de teint, résultats visibles en 2 semaines…"
                            label="Description du produit"
                            className="ac-textarea"
                          />
                        </Field>

                        {/* Caractéristiques */}
                        <div>
                          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Caractéristiques clés</p>
                          <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                            {(product.features || []).map((f, fIdx) => (
                              <span key={fIdx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-[11px] font-medium border border-primary-100">
                                {f}
                                <button type="button" onClick={() => removeProductFeature(idx, fIdx)} className="text-primary-400 hover:text-red-500 leading-none text-base">×</button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input id={`feat-input-${idx}`} placeholder="ex: 100% naturel, Sans paraben…"
                              className="ac-input flex-1 text-xs"
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProductFeature(idx, e.target.value); e.target.value = ''; } }} />
                            <button type="button"
                              onClick={() => { const el = document.getElementById(`feat-input-${idx}`); addProductFeature(idx, el.value); el.value = ''; }}
                              className="px-3 py-1.5 text-sm font-bold text-white rounded-lg flex-shrink-0"
                              style={{ background: ACCENT }}>+</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── TAB: MÉDIAS ── */}
                    {productFormTab === 'medias' && (
                      <div className="space-y-5">
                        {/* Images */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[13px] font-bold text-gray-800">Photos du produit</p>
                            <label className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 cursor-pointer transition-colors border border-primary-100">
                              <input type="file" accept="image/*" multiple className="hidden"
                                onChange={async (e) => { await handleProductMediaUpload(idx, 'images', e.target.files); e.target.value = ''; }} />
                              {mediaUploadingByProduct[`${idx}:images`]
                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Upload…</>
                                : <><Image className="w-3 h-3" /> Ajouter</>}
                            </label>
                          </div>
                          {(product.images || []).length === 0 ? (
                            <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50 transition-all cursor-pointer">
                              <input type="file" accept="image/*" multiple className="hidden"
                                onChange={async (e) => { await handleProductMediaUpload(idx, 'images', e.target.files); e.target.value = ''; }} />
                              <Image className="w-5 h-5 mb-1" />
                              <span className="text-[11px] font-medium">Cliquer pour uploader</span>
                            </label>
                          ) : (
                            <div className="grid grid-cols-4 gap-2">
                              {(product.images || []).map((url, imageIndex) => (
                                <div key={imageIndex} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                                  <button type="button" onClick={() => removeProductMedia(idx, 'images', imageIndex)}
                                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[11px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                                    ×
                                  </button>
                                </div>
                              ))}
                              <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50 transition-all cursor-pointer">
                                <input type="file" accept="image/*" multiple className="hidden"
                                  onChange={async (e) => { await handleProductMediaUpload(idx, 'images', e.target.files); e.target.value = ''; }} />
                                <Plus className="w-5 h-5" />
                              </label>
                            </div>
                          )}
                        </div>

                        {/* Vidéos */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-[13px] font-bold text-gray-800">Vidéos du produit</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">Rita envoie la vidéo quand le client hésite ou veut voir le produit en action</p>
                            </div>
                            <label className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors border border-blue-100">
                              <input type="file" accept="video/*" multiple className="hidden"
                                onChange={async (e) => { await handleProductMediaUpload(idx, 'videos', e.target.files); e.target.value = ''; }} />
                              {mediaUploadingByProduct[`${idx}:videos`]
                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Upload…</>
                                : <><Video className="w-3 h-3" /> Ajouter</>}
                            </label>
                          </div>
                          {(product.videos || []).length === 0 ? (
                            <p className="text-[11px] text-gray-400 py-2">Aucune vidéo ajoutée</p>
                          ) : (
                            <div className="space-y-1.5">
                              {(product.videos || []).map((url, videoIndex) => (
                                <div key={videoIndex} className="flex items-center gap-2 px-3 py-2.5 bg-blue-50/50 border border-blue-100 rounded-xl">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <PlayCircle className="w-4 h-4 text-blue-500" />
                                  </div>
                                  <span className="text-[11px] text-gray-600 flex-1 truncate font-medium">Vidéo {videoIndex + 1}</span>
                                  <a href={url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:text-blue-700 font-semibold">Voir ▶</a>
                                  <button type="button" onClick={() => removeProductMedia(idx, 'videos', videoIndex)}
                                    className="text-gray-300 hover:text-red-500 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── TAB: VENTE ── */}
                    {productFormTab === 'vente' && (
                      <div className="space-y-5">

                        {/* Négociation par produit */}
                        {config.pricingNegotiation?.enabled ? (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm">💰</span>
                              </div>
                              <p className="text-[13px] font-bold text-amber-800">Négociation prix</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <Field label="Dernier prix" hint="plancher">
                                <ModalInput value={product.minPrice || ''} onChange={e => updateProduct(idx, 'minPrice', e.target.value)}
                                  placeholder="12 000 FCFA" label="Dernier prix plancher" className="ac-input text-xs" />
                              </Field>
                              <Field label="Remise max" hint="%">
                                <input type="number" min="0" max="100" value={product.maxDiscountPercent || 0}
                                  onChange={e => updateProduct(idx, 'maxDiscountPercent', parseInt(e.target.value) || 0)}
                                  className="ac-input text-xs" />
                              </Field>
                              <Field label="Note prix">
                                <ModalInput value={product.priceNote || ''} onChange={e => updateProduct(idx, 'priceNote', e.target.value)}
                                  placeholder="ex: offrir livraison si ≥2" label="Note prix" className="ac-input text-xs" />
                              </Field>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                            <span className="text-sm">💡</span>
                            <p className="text-[11px] text-gray-500 leading-snug">Activez <strong>Prix & Négociation</strong> dans la sidebar pour configurer les règles de remise par produit.</p>
                          </div>
                        )}

                        {/* Offres de quantité */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-[13px] font-bold text-gray-800">Paliers de quantité</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">Réductions automatiques selon la quantité commandée</p>
                            </div>
                            <button type="button" onClick={() => addProductQuantityOffer(idx)}
                              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-colors">
                              <Plus className="w-3 h-3" /> Palier
                            </button>
                          </div>
                          {(product.quantityOffers || []).length === 0 ? (
                            <div className="flex items-center gap-2.5 px-3.5 py-3 border-2 border-dashed border-gray-200 rounded-xl">
                              <span className="text-gray-300 text-lg">📦</span>
                              <p className="text-[11px] text-gray-400">Aucun palier — les clients paient le prix standard</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {(product.quantityOffers || []).map((offer, offerIdx) => (
                                <div key={offerIdx} className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Palier {offerIdx + 1}</span>
                                    <button type="button" onClick={() => removeProductQuantityOffer(idx, offerIdx)}
                                      className="text-gray-300 hover:text-red-500 transition-colors">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Field label="Qté minimum">
                                      <input type="number" min="1" value={offer.minQuantity || 1}
                                        onChange={e => updateProductQuantityOffer(idx, offerIdx, 'minQuantity', e.target.value)}
                                        className="ac-input text-xs" />
                                    </Field>
                                    <Field label="Prix unitaire">
                                      <ModalInput value={offer.unitPrice || ''} onChange={e => updateProductQuantityOffer(idx, offerIdx, 'unitPrice', e.target.value)}
                                        placeholder="7 500 FCFA" label="Prix unitaire" className="ac-input text-xs" />
                                    </Field>
                                    <Field label="Prix total">
                                      <ModalInput value={offer.totalPrice || ''} onChange={e => updateProductQuantityOffer(idx, offerIdx, 'totalPrice', e.target.value)}
                                        placeholder="15 000 FCFA" label="Prix total" className="ac-input text-xs" />
                                    </Field>
                                    <Field label="Libellé">
                                      <ModalInput value={offer.label || ''} onChange={e => updateProductQuantityOffer(idx, offerIdx, 'label', e.target.value)}
                                        placeholder="Pack découverte" label="Libellé du palier" className="ac-input text-xs" />
                                    </Field>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── TAB: CONTENU ── */}
                    {productFormTab === 'contenu' && (
                      <div className="space-y-5">

                        {/* FAQ */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-[13px] font-bold text-gray-800">FAQ</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">Questions fréquentes et réponses de Rita</p>
                            </div>
                            <button type="button" onClick={() => addProductFaq(idx)}
                              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-100 transition-colors">
                              <Plus className="w-3 h-3" /> FAQ
                            </button>
                          </div>
                          {(product.faq || []).length === 0 ? (
                            <p className="text-[11px] text-gray-400 py-1">Aucune FAQ configurée</p>
                          ) : (
                            <div className="space-y-2">
                              {(product.faq || []).map((f, fIdx) => (
                                <div key={fIdx} className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-50/60 border-b border-gray-100">
                                    <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">Q</span>
                                    <ModalInput value={f.question} onChange={e => updateProductFaq(idx, fIdx, 'question', e.target.value)}
                                      placeholder="Question du client…" label="Question FAQ" className="ac-input flex-1 text-xs bg-transparent border-0 px-0 py-0 focus:ring-0" />
                                    <button type="button" onClick={() => removeProductFaq(idx, fIdx)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                  <div className="flex items-start gap-2 px-3 py-2">
                                    <span className="w-5 h-5 rounded-md bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">R</span>
                                    <ModalTextarea value={f.answer} onChange={e => updateProductFaq(idx, fIdx, 'answer', e.target.value)}
                                      placeholder="Réponse de Rita…" rows={4} label="Réponse FAQ"
                                      className="ac-textarea flex-1 text-xs" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Objections */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-[13px] font-bold text-gray-800">Objections</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">Comment Rita répond aux blocages clients</p>
                            </div>
                            <button type="button" onClick={() => addProductObjection(idx)}
                              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-100 transition-colors">
                              <Plus className="w-3 h-3" /> Objection
                            </button>
                          </div>
                          {(product.objections || []).length === 0 ? (
                            <p className="text-[11px] text-gray-400 py-1">Aucune objection configurée</p>
                          ) : (
                            <div className="space-y-2">
                              {(product.objections || []).map((o, oIdx) => (
                                <div key={oIdx} className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                                  <div className="flex items-center gap-2 px-3 py-2 bg-orange-50/60 border-b border-gray-100">
                                    <span className="w-5 h-5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 shrink-0">!</span>
                                    <ModalInput value={o.objection} onChange={e => updateProductObjection(idx, oIdx, 'objection', e.target.value)}
                                      placeholder="ex: C'est trop cher…" label="Objection client" className="ac-input flex-1 text-xs bg-transparent border-0 px-0 py-0 focus:ring-0" />
                                    <button type="button" onClick={() => removeProductObjection(idx, oIdx)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                  <div className="flex items-start gap-2 px-3 py-2">
                                    <span className="w-5 h-5 rounded-md bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">→</span>
                                    <ModalTextarea value={o.response} onChange={e => updateProductObjection(idx, oIdx, 'response', e.target.value)}
                                      placeholder="Réponse de Rita…" rows={4} label="Réponse à l'objection"
                                      className="ac-textarea flex-1 text-xs" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            })() : (
              config.productCatalog.length > 0 && (
                <div className="flex-1 hidden lg:flex flex-col items-center justify-center text-center gap-3 bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                    <Package className="w-5 h-5 text-gray-300" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-gray-500">Sélectionnez un produit</p>
                    <p className="text-[11px] text-gray-400 mt-1">Cliquez sur un produit dans la liste pour l'éditer</p>
                  </div>
                </div>
              )
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
                          <ModalInput value={entry.productName || ''} onChange={e => updateStockEntry(idx, 'productName', e.target.value)}
                            placeholder="Nom du produit" label="Nom du produit" className="ac-input flex-1 !bg-white" />
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
                        <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <ModalInput value={config.adminName} onChange={e => set('adminName', e.target.value)}
                          placeholder="ex: Mohamed Diallo" label="Nom de l'admin" className="ac-input !pl-10" />
                      </div>
                    </Field>
                    <Field label="Téléphone admin (WhatsApp)" required>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <ModalInput value={config.bossPhone} onChange={e => set('bossPhone', e.target.value)}
                          placeholder="ex: +225 07 00 00 00" label="Téléphone admin" className="ac-input !pl-10" />
                      </div>
                    </Field>
                  </div>
                  <Field label="Email de l'admin">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <ModalInput type="email" value={config.adminEmail} onChange={e => set('adminEmail', e.target.value)}
                        placeholder="ex: admin@monshop.com" label="Email admin" className="ac-input !pl-10" />
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
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <ModalInput value={config.businessName} onChange={e => set('businessName', e.target.value)}
                          placeholder="ex: Zendo Store" label="Nom du business" className="ac-input !pl-10" />
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
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <ModalInput value={config.businessCity} onChange={e => set('businessCity', e.target.value)}
                        placeholder="ex: Douala, Yaoundé, Abidjan..." label="Ville / Localisation" className="ac-input !pl-10" />
                    </div>
                  </Field>
                  <Field label="Description de l'activité" hint="courte présentation pour Rita">
                    <ModalTextarea value={config.businessDescription} onChange={e => set('businessDescription', e.target.value)}
                      rows={5} label="Description de l'activité"
                      placeholder="ex: Boutique en ligne de cosmétiques naturels. Nous livrons dans toute la Côte d'Ivoire..."
                      className="ac-textarea" />
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
                          <div className="bg-white rounded-lg border border-primary-200 p-3 flex flex-col sm:flex-row gap-3">
                            {selectedProduct.images?.[0] && (
                              <img src={selectedProduct.images[0]} alt="" className="w-20 h-20 rounded-lg object-cover" />
                            )}
                            <div className="flex-1 text-[11px]">
                              <p className="font-bold text-gray-900">{selectedProduct.name}</p>
                              {selectedProduct.price && <p className="text-primary-600 font-semibold">{selectedProduct.price}</p>}
                              {selectedProduct.description && <p className="text-gray-500 line-clamp-2 mt-1">{selectedProduct.description}</p>}
                            </div>
                          </div>
                        )}

                        {/* Client & Rating */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Nom du client">
                            <ModalInput value={t.clientName || ''} onChange={e => updateTestimonial(idx, 'clientName', e.target.value)}
                              placeholder="ex: Marie D." label="Nom du client" className="ac-input" />
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
                          <ModalTextarea value={t.text || ''} onChange={e => updateTestimonial(idx, 'text', e.target.value)}
                            placeholder="ex: J'ai essayé ce produit et en 2 semaines ma peau a vraiment changé ! Je recommande fortement..."
                            rows={5} label="Texte du témoignage" className="ac-textarea" />
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
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-primary-700 bg-primary-50 border border-primary-200 rounded-lg cursor-pointer hover:bg-primary-100 transition-colors">
                            <input type="file" accept="image/*" multiple className="hidden"
                              onChange={async (e) => { await handleTestimonialMediaUpload(idx, 'images', e.target.files); e.target.value = ''; }} />
                            <Plus className="w-3 h-3" /> Ajouter photos
                          </label>
                          {testimonialUploading[`${idx}:images`] && <span className="text-[11px] text-primary-600 ml-2">Upload en cours...</span>}
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
                    className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-[13px] font-semibold text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/30 transition-all flex items-center justify-center gap-2">
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
                    </div>
                  )}
                </div>
              </div>

              {/* Résumé quotidien */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-primary-600" />
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
              {!config.bossPhone && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <p className="text-[12px] font-semibold text-red-700 mb-1">⚠️ Numéro admin manquant</p>
                  <p className="text-[11px] text-red-600 leading-relaxed">
                    Pour recevoir les notifications et escalades, renseignez votre numéro WhatsApp dans l'onglet <strong>Profil Admin</strong>.
                  </p>
                </div>
              )}
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
                    { label: 'Réponses', value: activityData.stats?.messagesReplied || 0, color: ACCENT, bg: 'bg-primary-50' },
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
                            message_replied: { label: 'Réponse', emoji: '📤', bg: 'bg-primary-50 text-primary-700' },
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
                          <td className="px-4 py-3 font-mono text-gray-400">sc1-{c.clientNumber}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{c.phone}</td>
                          <td className="px-4 py-3 text-gray-600">{c.nom || c.pushName || <span className="text-gray-300 italic">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600">{c.ville || <span className="text-gray-300 italic">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600">{c.messageCount}</td>
                          <td className="px-4 py-3">
                            {c.hasOrdered
                              ? <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 font-semibold text-[11px]">✓ Oui</span>
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

                <div className={`rounded-xl border p-3 text-[12px] ${config.instanceId ? 'border-primary-100 bg-primary-50 text-primary-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                  {config.instanceId
                    ? `Ce statut sera publié avec l'instance WhatsApp actuellement sélectionnée pour Rita : ${selectedInstance?.customName || selectedInstance?.instanceName || 'Instance configurée'}.`
                    : 'Aucune instance WhatsApp Rita n\'est sélectionnée. Vous pouvez créer le statut maintenant, mais il faudra configurer une instance pour pouvoir le publier.'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">Nom</label>
                    <ModalInput type="text" value={statutForm.name} onChange={e => setStatutForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Statut produit phare du lundi"
                      label="Nom du statut"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200" />
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
                            className={`rounded-xl border px-3 py-3 text-left transition-colors ${!statutForm.mediaUrl ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}
                          >
                            <p className="text-[12px] font-semibold text-gray-700">Automatique</p>
                            <p className="text-[11px] text-gray-400 mt-1">Utiliser le premier média disponible du produit</p>
                          </button>

                          {statutProductMediaOptions.map((media) => (
                            <button
                              key={media.key}
                              type="button"
                              onClick={() => setStatutForm(p => ({ ...p, mediaUrl: media.url }))}
                              className={`rounded-xl border overflow-hidden text-left transition-colors ${statutForm.mediaUrl === media.url ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}
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
                    <ModalInput type="text" value={statutForm.mediaUrl} onChange={e => setStatutForm(p => ({ ...p, mediaUrl: e.target.value }))}
                      placeholder="https://..."
                      label="URL de l'image"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                )}

                {statutForm.type !== 'product' && (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">Texte / Légende</label>
                    <ModalTextarea rows={4} value={statutForm.caption} onChange={e => setStatutForm(p => ({ ...p, caption: e.target.value }))}
                      placeholder="Ex: 🔥 Notre produit phare en stock ! Contactez-nous pour commander."
                      label="Texte / Légende"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                )}

                {statutForm.type === 'product' && (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-gray-600">Texte personnalisé (optionnel)</label>
                    <ModalTextarea rows={3} value={statutForm.caption} onChange={e => setStatutForm(p => ({ ...p, caption: e.target.value }))}
                      placeholder="Laissez vide pour générer automatiquement depuis le produit"
                      label="Texte personnalisé du statut"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200" />
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
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200" />
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
                              ? 'text-white border-primary-600'
                              : 'text-gray-500 border-gray-200 hover:border-primary-300'
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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.type === 'product' ? 'bg-primary-50' : s.type === 'image' ? 'bg-blue-50' : 'bg-amber-50'}`}>
                      {s.type === 'product' ? <Package className="w-5 h-5 text-primary-600" />
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
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">{s.productName}</span>
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
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${s.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                      {/* Envoyer maintenant */}
                      <button onClick={() => sendNow(s)} disabled={statutSending === s._id}
                        title="Publier maintenant"
                        className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors">
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
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${config.firstMessageRulesEnabled ? 'bg-primary-600' : 'bg-gray-300'}`}
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
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
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
                              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
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
                              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 font-mono"
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
                      className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-[12px] font-semibold text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Ajouter une règle
                    </button>
                  </div>
                )}

                <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${config.firstMessageRulesEnabled ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
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
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${config.customInstructionsEnabled ? 'bg-primary-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${config.customInstructionsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Zone de texte */}
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-gray-700">Vos instructions</label>
                  <ModalTextarea
                    rows={14}
                    value={config.customInstructions}
                    onChange={e => set('customInstructions', e.target.value)}
                    placeholder={`Exemples d'instructions :\n\n- Ne jamais proposer de remise sur le produit X\n- Toujours demander si le client veut la version rouge ou noire avant de closer\n- Proposer systématiquement le produit B après que le client commande le produit A`}
                    label="Instructions personnalisées"
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] font-mono focus:outline-none focus:ring-2 transition-all ${
                      config.customInstructionsEnabled
                        ? 'border-primary-300 bg-white focus:ring-primary-200'
                        : 'border-gray-200 bg-gray-50 text-gray-400 focus:ring-gray-200'
                    }`}
                  />
                  <p className="text-[11px] text-gray-400">
                    {config.customInstructions?.length || 0} caractères · Écrivez en langage naturel, l'agent comprend vos instructions directement
                  </p>
                </div>

                {/* Info box */}
                <div className={`p-4 rounded-xl border text-[12px] space-y-1.5 ${config.customInstructionsEnabled ? 'bg-primary-50 border-primary-200 text-primary-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
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
          <div className="space-y-5">

            {/* Flash */}
            {groupMsg && (
              <div className={`text-[13px] px-4 py-2.5 rounded-xl font-medium ${groupMsg.ok ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-700'}`}>
                {groupMsg.text}
              </div>
            )}

            {!groupConfig ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* ── Tabs internes : Groupes / Campagnes ── */}
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {[{ id: 'list', label: '👥 Groupes' }, { id: 'campaigns', label: '📋 Campagnes' }].map(t => (
                    <button key={t.id} onClick={() => { setGroupView(t.id); setOpenedGroup(null); if (t.id === 'campaigns') openCampaigns(); }}
                      className={`flex-1 text-[13px] font-semibold py-2 rounded-lg transition ${groupView === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ── VUE CAMPAGNES ── */}
                {groupView === 'campaigns' && (
                  <div className="space-y-4">
                    {/* Formulaire nouvelle campagne */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-[15px] font-bold text-gray-900">
                          {campaignEditing !== null ? 'Modifier la campagne' : 'Nouvelle campagne'}
                        </h3>
                        {campaignEditing !== null && (
                          <button onClick={() => { setCampaignEditing(null); setCampaignForm({ name: '', message: '', mediaUrl: '', caption: '', scheduleAt: '', groupJids: [] }); }}
                            className="text-[12px] text-gray-400 hover:text-gray-600">Annuler</button>
                        )}
                      </div>
                      <div className="px-5 py-4 space-y-3">
                        <Field label="Nom de la campagne">
                          <ModalInput value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Ex: Promo weekend, Relance clients..." label="Nom de la campagne" className="ac-input" />
                        </Field>
                        <Field label="Message">
                          <ModalTextarea value={campaignForm.message} onChange={e => setCampaignForm(f => ({ ...f, message: e.target.value }))}
                            rows={6} placeholder="Rédigez votre message..." label="Message de la campagne" className="ac-textarea" />
                        </Field>

                        {/* Média : upload ou URL */}
                        <div className="space-y-2">
                          <p className="text-[12px] font-semibold text-gray-600">Image / Vidéo</p>
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer transition flex-shrink-0">
                              <input type="file" accept="image/*,video/*" className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setCampaignMediaUploading(true);
                                  const fd = new FormData(); fd.append('file', file);
                                  try {
                                    const { data } = await ecomApi.post('/v1/external/whatsapp/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                    if (data.url) setCampaignForm(f => ({ ...f, mediaUrl: data.url }));
                                  } catch { setGroupMsg({ ok: false, text: 'Erreur upload' }); }
                                  setCampaignMediaUploading(false);
                                  e.target.value = '';
                                }} />
                              {campaignMediaUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '📎 Upload'}
                            </label>
                            <ModalInput value={campaignForm.mediaUrl} onChange={e => setCampaignForm(f => ({ ...f, mediaUrl: e.target.value }))}
                              placeholder="ou coller URL..." label="URL du média" className="ac-input flex-1 text-[12px]" />
                            {campaignForm.mediaUrl && (
                              <button onClick={() => setCampaignForm(f => ({ ...f, mediaUrl: '', caption: '' }))}
                                className="text-gray-300 hover:text-red-400 transition text-lg flex-shrink-0">×</button>
                            )}
                          </div>
                          {campaignForm.mediaUrl && (
                            <div className="flex items-center gap-2">
                              {/\.(jpg|jpeg|png|webp|gif)$/i.test(campaignForm.mediaUrl) && (
                                <img src={campaignForm.mediaUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                              )}
                              <ModalInput value={campaignForm.caption} onChange={e => setCampaignForm(f => ({ ...f, caption: e.target.value }))}
                                placeholder="Légende (optionnel)..." label="Légende du média" className="ac-input flex-1 text-[12px]" />
                            </div>
                          )}
                        </div>

                        {/* Envoi ponctuel ou répétitif */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setCampaignForm(f => ({ ...f, repeat: false }))}
                              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition ${!campaignForm.repeat ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                              📅 Ponctuel
                            </button>
                            <button type="button" onClick={() => setCampaignForm(f => ({ ...f, repeat: true, scheduleAt: '' }))}
                              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition ${campaignForm.repeat ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                              🔁 Répétitif
                            </button>
                          </div>

                          {!campaignForm.repeat ? (
                            <input type="datetime-local" value={campaignForm.scheduleAt}
                              onChange={e => setCampaignForm(f => ({ ...f, scheduleAt: e.target.value }))}
                              className="ac-input" />
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[11px] text-gray-500">Jours d'envoi</p>
                              <div className="flex flex-wrap gap-1.5">
                                {['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'].map(d => {
                                  const active = campaignForm.repeatDays.includes(d);
                                  return (
                                    <button key={d} type="button"
                                      onClick={() => setCampaignForm(f => ({ ...f, repeatDays: active ? f.repeatDays.filter(x => x !== d) : [...f.repeatDays, d] }))}
                                      className={`text-[11px] px-2.5 py-1 rounded-full border transition font-medium ${active ? 'bg-primary-50 border-primary-400 text-primary-700' : 'bg-white border-gray-200 text-gray-400'}`}>
                                      {d.slice(0,2)}
                                    </button>
                                  );
                                })}
                                <button type="button" onClick={() => setCampaignForm(f => ({ ...f, repeatDays: ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'] }))}
                                  className="text-[10px] px-2 text-primary-600 hover:underline">Tous</button>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-[11px] text-gray-500 flex-shrink-0">Heure</p>
                                <input type="time" value={campaignForm.repeatHour}
                                  onChange={e => setCampaignForm(f => ({ ...f, repeatHour: e.target.value }))}
                                  className="ac-input w-32" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-gray-600 mb-2">Groupes destinataires</p>
                          {whatsappGroups.length === 0 ? (
                            <p className="text-[12px] text-gray-400">Chargez d'abord vos groupes dans l'onglet Groupes</p>
                          ) : (
                            <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                              {whatsappGroups.map(wg => {
                                const sel = campaignForm.groupJids.includes(wg.id);
                                return (
                                  <label key={wg.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${sel ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                                    <input type="checkbox" checked={sel}
                                      onChange={() => setCampaignForm(f => ({
                                        ...f,
                                        groupJids: sel ? f.groupJids.filter(id => id !== wg.id) : [...f.groupJids, wg.id]
                                      }))}
                                      className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                                    <span className="text-[13px] font-medium text-gray-800 truncate flex-1">{wg.name}</span>
                                    <span className="text-[10px] text-gray-400">{wg.participants} membres</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button onClick={saveCampaign} disabled={campaignSaving}
                          className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-40"
                          style={{ background: ACCENT }}>
                          {campaignSaving ? 'Enregistrement...' : '💾 Enregistrer la campagne'}
                        </button>
                      </div>
                    </div>

                    {/* Liste des campagnes */}
                    {campaigns.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[13px] font-semibold text-gray-700">{campaigns.length} campagne{campaigns.length > 1 ? 's' : ''} enregistrée{campaigns.length > 1 ? 's' : ''}</p>
                        {campaigns.map((c, i) => (
                          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-bold text-gray-900">{c.name}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {c.groupJids.length} groupe{c.groupJids.length > 1 ? 's' : ''}
                                  {c.scheduleAt ? ` · 📅 ${new Date(c.scheduleAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                                  {c.sent ? ' · ✅ Envoyée' : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => { setCampaignEditing(i); setCampaignForm({ name: c.name, message: c.message, mediaUrl: c.mediaUrl || '', caption: c.caption || '', scheduleAt: c.scheduleAt || '', groupJids: c.groupJids }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                  className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
                                  Modifier
                                </button>
                                <button onClick={() => sendCampaign(i)} disabled={bcSending}
                                  className="text-[11px] px-2.5 py-1 rounded-lg text-white transition disabled:opacity-40"
                                  style={{ background: ACCENT }}>
                                  {bcSending ? '...' : '📤 Envoyer'}
                                </button>
                                <button onClick={() => deleteCampaign(i)}
                                  className="text-[11px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-50 transition">
                                  ✕
                                </button>
                              </div>
                            </div>
                            {c.message && <p className="text-[12px] text-gray-500 line-clamp-2">{c.message}</p>}
                            {c.mediaUrl && (
                              <div className="flex items-center gap-2">
                                {/\.(jpg|jpeg|png|webp|gif)$/i.test(c.mediaUrl) && (
                                  <img src={c.mediaUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                                )}
                                <span className="text-[11px] text-blue-500 truncate">{c.mediaUrl}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── VUE GROUPES ── */}
                {groupView === 'list' && (
                <>
                {/* ── Vue détail groupe ouvert ── */}
                {openedGroup ? (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {/* Header avec retour */}
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                      <button onClick={() => { setOpenedGroup(null); setBcMessage(''); setBcMediaUrl(''); setBcCaption(''); setBcScheduleAt(''); }}
                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
                        <ChevronDown className="w-4 h-4 text-gray-600 rotate-90" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-bold text-gray-900 truncate">{openedGroup.name}</h3>
                        <p className="text-[11px] text-gray-400">{openedGroup.participants} membre{openedGroup.participants !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {/* Composer */}
                    <div className="px-5 py-4 space-y-3">
                      <ModalTextarea value={bcMessage} onChange={e => setBcMessage(e.target.value)}
                        rows={6} placeholder="Rédigez votre message..."
                        label="Message à envoyer"
                        className="ac-textarea w-full" />

                      {/* Upload ou URL média */}
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer transition">
                          <input type="file" accept="image/*,video/*" className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const fd = new FormData(); fd.append('file', file);
                              try {
                                const { data } = await ecomApi.post('/v1/external/whatsapp/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                if (data.url) setBcMediaUrl(data.url);
                              } catch { setBcMediaUrl(''); }
                              e.target.value = '';
                            }} />
                          📎 Fichier
                        </label>
                        <ModalInput value={bcMediaUrl} onChange={e => setBcMediaUrl(e.target.value)}
                          placeholder="ou coller URL image/vidéo..."
                          label="URL média"
                          className="ac-input flex-1 text-[12px]" />
                      </div>

                      {bcMediaUrl && (
                        <div className="flex items-center gap-2">
                          {/\.(jpg|jpeg|png|webp|gif)$/i.test(bcMediaUrl) && (
                            <img src={bcMediaUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                          )}
                          <ModalInput value={bcCaption} onChange={e => setBcCaption(e.target.value)}
                            placeholder="Légende (optionnel)..." label="Légende du média" className="ac-input flex-1 text-[12px]" />
                          <button onClick={() => { setBcMediaUrl(''); setBcCaption(''); }}
                            className="text-gray-300 hover:text-red-400 transition flex-shrink-0">×</button>
                        </div>
                      )}

                      <input type="datetime-local" value={bcScheduleAt} onChange={e => setBcScheduleAt(e.target.value)}
                        className="ac-input text-[12px]" />

                      <button onClick={() => sendBroadcast([openedGroup.id])}
                        disabled={bcSending || (!bcMessage.trim() && !bcMediaUrl.trim())}
                        className="w-full py-3 rounded-xl text-[14px] font-bold text-white disabled:opacity-40 transition"
                        style={{ background: ACCENT }}>
                        {bcSending ? 'Envoi...' : bcScheduleAt ? '📅 Programmer' : '📤 Envoyer dans ce groupe'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Vue liste groupes ── */
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-[15px] font-bold text-gray-900">Mes groupes WhatsApp</h3>
                        <p className="text-[12px] text-gray-400 mt-0.5">Cliquez sur un groupe pour envoyer</p>
                      </div>
                      <button onClick={loadGroupAnimation} disabled={groupsLoading}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition disabled:opacity-40 flex items-center gap-1">
                        {groupsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '↻ Rafraîchir'}
                      </button>
                    </div>

                    {/* Barre de recherche */}
                    {whatsappGroups.length > 0 && (
                      <div className="px-5 py-3 border-b border-gray-100">
                        <input
                          value={groupSearch}
                          onChange={e => setGroupSearch(e.target.value)}
                          placeholder="Rechercher un groupe..."
                          className="ac-input w-full text-[13px]"
                        />
                      </div>
                    )}

                    {groupsLoading ? (
                      <div className="px-5 py-10 flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        <span className="text-[13px] text-gray-400">Chargement des groupes...</span>
                      </div>
                    ) : whatsappGroups.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-[13px] text-gray-500">Aucun groupe trouvé</p>
                        <p className="text-[11px] text-gray-400 mt-1">Vérifiez que Rita est connectée à WhatsApp, puis rafraîchissez</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {whatsappGroups.filter(wg => wg.name.toLowerCase().includes(groupSearch.toLowerCase())).map(wg => (
                          <button key={wg.id} type="button"
                            onClick={() => setOpenedGroup(wg)}
                            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-primary-50/50 transition group">
                            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-[14px] flex-shrink-0">
                              👥
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-gray-900 truncate">{wg.name}</p>
                              <p className="text-[11px] text-gray-400">{wg.participants} membre{wg.participants !== 1 ? 's' : ''}</p>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-300 -rotate-90 group-hover:text-primary-500 transition" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Rejoindre via lien */}
                    <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                      <p className="text-[11px] text-gray-500 mb-2">Rejoindre un groupe via lien d'invitation</p>
                      <div className="flex gap-2">
                        <input type="text" value={groupInviteLink} onChange={e => setGroupInviteLink(e.target.value)}
                          placeholder="https://chat.whatsapp.com/..."
                          className="ac-input flex-1 text-[12px]"
                          onKeyDown={e => e.key === 'Enter' && joinGroupByInvite()} />
                        <button onClick={joinGroupByInvite} disabled={groupJoining || !groupInviteLink.trim()}
                          className="px-3 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-50 whitespace-nowrap"
                          style={{ background: ACCENT }}>
                          {groupJoining ? '...' : 'Rejoindre'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── SECTION 3 : Posts récurrents (config avancée) ── */}
                {groupConfig.groups?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-[15px] font-bold text-gray-900">Posts récurrents</h3>
                        <p className="text-[12px] text-gray-400 mt-0.5">Messages automatiques planifiés par groupe</p>
                      </div>
                      <button onClick={saveGroupConfig} disabled={groupSaving}
                        className="text-[12px] font-bold px-3 py-1.5 rounded-xl text-white disabled:opacity-50"
                        style={{ background: ACCENT }}>
                        {groupSaving ? '...' : 'Sauvegarder'}
                      </button>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {groupConfig.groups.map((group, gi) => {
                        const postsCount = group.scheduledPosts?.length || 0;
                        const isExpanded = groupExpandedIdx === gi;
                        return (
                          <div key={gi}>
                            <button type="button" onClick={() => setGroupExpandedIdx(isExpanded ? null : gi)}
                              className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-gray-50 transition">
                              <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-[14px] flex-shrink-0">
                                {group.role === 'clients' ? '🛒' : group.role === 'prospects' ? '🎯' : group.role === 'vip' ? '⭐' : '👥'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-gray-900 truncate">{group.name || group.groupJid}</p>
                                <p className="text-[11px] text-gray-400">{postsCount} post{postsCount !== 1 ? 's' : ''} planifié{postsCount !== 1 ? 's' : ''}</p>
                              </div>
                              <button onClick={e => { e.stopPropagation(); removeGroupFromAnimation(gi); }}
                                className="text-[11px] text-gray-300 hover:text-red-400 transition mr-1">Retirer</button>
                              <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {isExpanded && (
                              <div className="px-5 pb-5 space-y-3 bg-gray-50/30">
                                <div className="flex items-center justify-between pt-2">
                                  <p className="text-[12px] font-semibold text-gray-600">Posts planifiés</p>
                                  <button onClick={() => {
                                    const posts = [...(group.scheduledPosts || []), { type: 'text', content: '', productName: '', days: [], hour: '09:00', enabled: true }];
                                    updateManagedGroup(gi, { ...group, scheduledPosts: posts });
                                  }} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: ACCENT }}>
                                    + Ajouter
                                  </button>
                                </div>

                                {!postsCount && (
                                  <p className="text-[12px] text-gray-400 py-2">Aucun post planifié.</p>
                                )}

                                {(group.scheduledPosts || []).map((post, pi) => (
                                  <div key={pi} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <select value={post.type} onChange={e => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], type: e.target.value };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} className="text-[12px] border rounded-lg px-2 py-1.5 bg-gray-50">
                                        <option value="text">📝 Texte</option>
                                        <option value="image">🖼️ Image</option>
                                        <option value="product">🛍️ Produit</option>
                                      </select>
                                      <input type="time" value={post.hour || '09:00'} onChange={e => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], hour: e.target.value };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} className="text-[12px] border rounded-lg px-2 py-1.5" />
                                      <div className={`relative w-8 h-4 rounded-full cursor-pointer transition ml-auto ${post.enabled !== false ? 'bg-primary-500' : 'bg-gray-300'}`}
                                        onClick={() => {
                                          const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], enabled: !(post.enabled !== false) };
                                          updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                        }}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${post.enabled !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                      </div>
                                      <button onClick={() => {
                                        const ps = [...group.scheduledPosts]; ps.splice(pi, 1);
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} className="text-gray-300 hover:text-red-400 transition">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>

                                    {post.type === 'text' && (
                                      <textarea value={post.content || ''} onChange={e => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], content: e.target.value };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} rows={2} placeholder="Message..." className="ac-textarea" />
                                    )}
                                    {post.type === 'image' && (
                                      <input value={post.content || ''} onChange={e => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], content: e.target.value };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} placeholder="https://..." className="ac-input" />
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

                                    <div className="flex flex-wrap gap-1">
                                      {GA_DAYS.map(d => (
                                        <button key={d} onClick={() => {
                                          const days = (post.days || []).includes(d) ? post.days.filter(x => x !== d) : [...(post.days || []), d];
                                          const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], days };
                                          updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                        }}
                                          className={`text-[10px] px-1.5 py-0.5 rounded-full border transition ${(post.days || []).includes(d) ? 'bg-primary-50 border-primary-400 text-primary-700' : 'bg-white border-gray-200 text-gray-400'}`}>
                                          {d.slice(0, 2)}
                                        </button>
                                      ))}
                                      <button onClick={() => {
                                        const ps = [...group.scheduledPosts]; ps[pi] = { ...ps[pi], days: GA_DAYS.slice() };
                                        updateManagedGroup(gi, { ...group, scheduledPosts: ps });
                                      }} className="text-[10px] px-1.5 text-primary-600 hover:underline">Tous</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </>
                )}
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
                  <span className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                    <Send className="w-4 h-4 text-primary-600" />
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
                  <div className={`text-[13px] px-4 py-3 rounded-xl font-medium ${rpStatus.type === 'success' ? 'bg-primary-50 text-primary-700 border border-primary-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
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
          saveStatus === 'success' ? 'bg-primary-600 text-white' : 'bg-red-600 text-white'
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
