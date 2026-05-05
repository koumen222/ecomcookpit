import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, Loader2,
  ExternalLink, Copy, Check, Bot, Smartphone, Zap, Send,
  Eye, EyeOff, X, Globe, MessageSquare, Package,
  QrCode, BarChart3, Wifi, WifiOff, Settings, Megaphone, Users, ChevronDown,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';

const ACCENT = '#0F6B4F';
const ACCENT_LIGHT = 'rgba(15,107,79,0.08)';

const WhatsAppBrandLogo = ({ className = 'h-8 w-8' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <circle cx="16" cy="16" r="16" fill="#25D366" />
    <path fill="#FFF" d="M23.18 8.68A10.1 10.1 0 0 0 7.36 20.84L6 26l5.29-1.34a10.07 10.07 0 0 0 4.81 1.23h.01c5.57 0 10.12-4.53 10.12-10.1 0-2.7-1.05-5.23-3.05-7.11Zm-7.07 15.5h-.01a8.38 8.38 0 0 1-4.28-1.17l-.31-.18-3.14.8.83-3.06-.2-.32a8.4 8.4 0 1 1 7.11 3.93Zm4.6-6.28c-.25-.13-1.48-.73-1.71-.81-.22-.08-.38-.13-.54.13-.16.24-.62.8-.76.96-.14.16-.29.18-.54.06-.25-.13-1.06-.39-2.01-1.24-.75-.67-1.26-1.49-1.41-1.74-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.54-1.29-.74-1.76-.2-.49-.4-.42-.54-.43l-.46-.01c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.08s.9 2.42 1.03 2.58c.13.17 1.76 2.68 4.26 3.77.59.25 1.05.41 1.41.52.59.19 1.14.16 1.57.1.48-.07 1.48-.6 1.69-1.17.21-.57.21-1.05.15-1.15-.07-.1-.24-.16-.49-.29Z" />
  </svg>
);

const MetaBusinessLogo = ({ className = 'h-8 w-8' }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <rect width="64" height="64" rx="18" fill="#EFF6FF" />
    <path fill="#0866FF" d="M30.77 18.88c-4.11 0-7.25 1.8-10.07 5.83l-7.74 11.11c-1.37 1.97-1.43 4.55-.15 6.58 1.17 1.86 3.18 2.96 5.38 2.96 3.1 0 5.49-1.35 7.8-4.39l4.24-5.58 3.91 5.57c2.8 3.99 5.94 5.78 10.17 5.78 4.13 0 7.22-1.76 9.2-5.23 1.73-3.04 1.67-7.14-.16-10.18l-2.8-4.67h-6.24l3.74 6.24c.84 1.4.88 3.23.11 4.59-.78 1.37-2 2.01-3.85 2.01-2.18 0-3.71-.95-5.61-3.66l-5.7-8.12 6.04-7.95c1.83-2.4 3.28-3.42 4.87-3.42 1.45 0 2.45.56 3.17 1.76.74 1.24.71 2.85-.08 4.18l-1.01 1.7h6.27l.07-.12c1.64-2.8 1.67-6.21.07-8.88-1.86-3.1-4.84-4.67-8.87-4.67-4.05 0-7.04 1.56-9.99 5.21l-3.18 4-2.97-4.03c-2.8-3.8-5.83-5.49-9.83-5.49Zm-12.36 20.4c-.93 1.21-1.92 1.73-3.33 1.73-.8 0-1.38-.31-1.77-.92-.42-.67-.37-1.59.14-2.32l7.74-11.1c2-2.87 4.08-4.16 6.75-4.16 2.16 0 3.77.92 5.58 3.37l2.5 3.38-6.2 8.17-4.3-5.89h-6.21l7.23 9.88-2.13 2.86Z" />
  </svg>
);

const WEBHOOK_EVENTS = [
  { id: 'MESSAGES_UPSERT',   label: 'Messages reçus' },
  { id: 'MESSAGES_UPDATE',   label: 'Statuts messages' },
  { id: 'SEND_MESSAGE',      label: 'Messages envoyés' },
  { id: 'CONNECTION_UPDATE', label: 'Connexion' },
  { id: 'QRCODE_UPDATED',    label: 'QR Code' },
  { id: 'CONTACTS_UPSERT',   label: 'Nouveaux contacts' },
];

// ─── Composant Relances par Produit ─────────────────────────────────────────
const RelancesTab = ({ instances, userId }) => {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [message, setMessage] = useState('');
  const [selectedInstance, setSelectedInstance] = useState('');
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const connectedInstances = instances.filter(i => i.status === 'connected' || i.status === 'active');

  useEffect(() => {
    ecomApi.get('/v1/external/whatsapp/campaign-products')
      .then(({ data }) => { if (data.success) setProducts(data.products || []); })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    if (!selectedProduct) { setPreviewCount(null); return; }
    setPreviewLoading(true);
    setPreviewCount(null);
    const t = setTimeout(() => {
      ecomApi.get(`/v1/external/whatsapp/campaign-preview?productName=${encodeURIComponent(selectedProduct)}`)
        .then(({ data }) => { if (data.success) setPreviewCount(data.count); })
        .catch(() => {})
        .finally(() => setPreviewLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [selectedProduct]);

  const handleLaunch = async () => {
    if (!selectedProduct || !message.trim()) return;
    setError('');
    setResult(null);
    setLaunching(true);
    try {
      const payload = { productName: selectedProduct, message: message.trim() };
      if (selectedInstance) payload.instanceId = selectedInstance;
      const { data } = await ecomApi.post('/v1/external/whatsapp/campaign-launch', payload);
      if (data.success) setResult(data);
      else setError(data.error || 'Erreur lors du lancement');
    } catch (e) {
      setError(e.response?.data?.error || 'Erreur lors du lancement');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[24px] border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-emerald-50 via-white to-white" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">Relances Automatiques par Produit</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Recontactez massivement (mais un par un) tous les clients ayant manifesté de l'intérêt ou commandé un produit spécifique.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm space-y-5">

        {/* Sélection produit */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
            Sélectionnez le produit
          </label>
          {loadingProducts ? (
            <div className="flex items-center gap-2 text-[13px] text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement des produits...
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedProduct}
                onChange={e => { setSelectedProduct(e.target.value); setResult(null); setError(''); }}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-[13px] font-medium text-gray-800 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              >
                <option value="">-- Choisir un produit du catalogue --</option>
                {products.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          )}
          {selectedProduct && (
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-gray-500">
              <Users className="w-3.5 h-3.5" />
              {previewLoading ? (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Calcul...</span>
              ) : previewCount !== null ? (
                <span><strong className="text-emerald-700">{previewCount}</strong> client{previewCount !== 1 ? 's' : ''} ciblé{previewCount !== 1 ? 's' : ''}</span>
              ) : null}
            </div>
          )}
        </div>

        {/* Instance */}
        {connectedInstances.length > 1 && (
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
              Instance WhatsApp à utiliser
            </label>
            <div className="relative">
              <select
                value={selectedInstance}
                onChange={e => setSelectedInstance(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-[13px] font-medium text-gray-800 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              >
                <option value="">-- Instance connectée automatique --</option>
                {connectedInstances.map(i => (
                  <option key={i._id} value={i._id}>{i.instanceName}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        )}

        {/* Message */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
            Message WhatsApp de relance
            <span className="ml-1 font-normal text-gray-400">(Sera envoyé à tous les clients concernés)</span>
          </label>
          <textarea
            value={message}
            onChange={e => { setMessage(e.target.value); setResult(null); setError(''); }}
            rows={4}
            placeholder="Bonjour, suite à votre achat, nous avons une offre..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none"
          />
          <p className="text-[11px] text-gray-400 mt-1">{message.length} caractère{message.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Anti-spam notice */}
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500 mt-0.5" />
          <p className="text-[12px] text-amber-800">
            <strong>Envoi progressif anti-spam :</strong> L'envoi est progressif pour protéger votre numéro contre les signalements WhatsApp. Un délai aléatoire (4–10 secondes) est appliqué entre chaque message.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Success result */}
        {result && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <div>
              <p className="text-[13px] font-semibold text-emerald-800">Campagne lancée avec succès</p>
              <p className="text-[12px] text-emerald-700 mt-0.5">
                {result.total} message{result.total !== 1 ? 's' : ''} en cours d'envoi de façon progressive. Vous pouvez fermer cette page.
              </p>
            </div>
          </div>
        )}

        {/* Launch button */}
        <button
          onClick={handleLaunch}
          disabled={!selectedProduct || !message.trim() || launching || !!result}
          className="w-full flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[14px] font-semibold text-white shadow-sm shadow-emerald-200 transition hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: ACCENT }}
        >
          {launching ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Lancement en cours...</>
          ) : (
            <><Send className="w-4 h-4" /> Lancer la campagne de relance</>
          )}
        </button>
      </div>
    </div>
  );
};

const WhatsAppService = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'instances';
  const ritaPanel = searchParams.get('ritaPanel') || '';
  const setTab = (tab, extra = {}) => {
    const nextParams = { tab, ...extra };
    Object.keys(nextParams).forEach(key => {
      if (nextParams[key] === '' || nextParams[key] == null) delete nextParams[key];
    });
    setSearchParams(nextParams);
  };

  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showTokens, setShowTokens] = useState({});
  const [webhookPanels, setWebhookPanels] = useState({});


  // ─── Modal création d'instance ───
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState('form'); // 'form' | 'scanning' | 'success'
  const [createData, setCreateData] = useState({ name: '', serviceType: 'whatsapp-baileys' });
  const [createdInstance, setCreatedInstance] = useState(null);

  // ─── QR code ───
  const [qrCode, setQrCode] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [qrPolling, setQrPolling] = useState(false);
  const qrIntervalRef = useRef(null);

  // ─── Stats ───
  const [messageStats, setMessageStats] = useState({});
  const [dashboardStats, setDashboardStats] = useState(null);

  const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
  const userId = user._id || user.id;
  const canAccessRitaAgent = user?.role === 'super_admin' || (user?.role === 'ecom_admin' && user?.canAccessRitaAgent !== false);

  useEffect(() => { loadInstances(); loadDashboardStats(); }, []);
  useEffect(() => { instances.forEach(inst => loadMessageStats(inst._id)); }, [instances.length]);
  useEffect(() => { return () => { if (qrIntervalRef.current) clearInterval(qrIntervalRef.current); }; }, []);
  useEffect(() => {
    // Legacy links with ?tab=rita now point to the dedicated IA page.
    if (activeTab === 'rita') navigate('/ecom/whatsapp/agent-config', { replace: true });
  }, [activeTab, navigate]);

  // ═══ Data loaders ═══
  const loadInstances = async () => {
    try { setLoading(true); setError(''); const { data } = await ecomApi.get(`/v1/external/whatsapp/instances?userId=${userId}`); setInstances(data.success ? data.instances || [] : []); }
    catch (err) { setInstances([]); setError(err.response?.data?.error || 'Impossible de charger les instances'); } finally { setLoading(false); }
  };
  const loadDashboardStats = async () => {
    try { const { data } = await ecomApi.get('/v1/external/whatsapp/dashboard-stats'); if (data.success) setDashboardStats(data.stats); } catch {}
  };
  const loadMessageStats = async (instanceId) => {
    try { const { data } = await ecomApi.get(`/v1/external/whatsapp/instances/${instanceId}/message-stats`); if (data.success) setMessageStats(prev => ({ ...prev, [instanceId]: data.stats })); } catch {}
  };

  const refreshAllStatuses = async () => {
    try { setLoading(true); setError(''); const { data } = await ecomApi.post('/v1/external/whatsapp/refresh-status', { userId }); if (data.success) setInstances(data.instances || []); }
    catch { setError('Erreur lors de la synchronisation'); } finally { setLoading(false); }
  };

  const STATUS_MAP = {
    connected:    { label: 'Connecté',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
    active:       { label: 'Actif',      dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
    configured:   { label: 'Configuré',  dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',    ring: 'ring-blue-200'    },
    disconnected: { label: 'Déconnecté', dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',     ring: 'ring-red-200'     },
  };
  const getStatus = (s) => STATUS_MAP[s] || { label: 'Non vérifié', dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100', ring: 'ring-gray-200' };

  const copyToClipboard = (text, id) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };

  // ═══ Instance actions ═══
  const testConnection = async (instance) => {
    setTestResults(prev => ({ ...prev, [instance._id]: { loading: true } }));
    try {
      const { data } = await ecomApi.post('/v1/external/whatsapp/verify-instance', { instanceId: instance._id });
      setTestResults(prev => ({ ...prev, [instance._id]: { loading: false, success: data.success, message: data.success ? 'Connectée' : (data.error || data.message) } }));
      if (data.status) setInstances(prev => prev.map(i => i._id === instance._id ? { ...i, status: data.status } : i));
    } catch { setTestResults(prev => ({ ...prev, [instance._id]: { loading: false, success: false, message: 'Injoignable' } })); }
  };

  const deleteInstance = async (instance) => {
    if (!confirm(`Supprimer "${instance.customName || instance.instanceName}" ?\nCette action est irréversible.`)) return;
    try {
      const { data } = await ecomApi.delete(`/v1/external/whatsapp/instances/${instance._id}?userId=${userId}`);
      if (data.success) { setInstances(prev => prev.filter(i => i._id !== instance._id)); loadDashboardStats(); }
      else setError(data.error || 'Erreur suppression');
    } catch (err) { setError(err.response?.data?.error || err.message || 'Erreur serveur'); }
  };

  // ═══ Création d'instance ═══
  const SERVICE_TYPES = [
    { id: 'whatsapp-baileys', label: 'WhatsApp', desc: 'Connexion via QR code (gratuit)', logo: WhatsAppBrandLogo, color: 'emerald' },
    { id: 'business-api',     label: 'Business API', desc: 'API officielle Meta (entreprise)', logo: MetaBusinessLogo, color: 'blue' },
  ];

  const openCreateModal = () => {
    setShowCreateModal(true);
    setCreateStep('form');
    setCreateData({ name: '', serviceType: 'whatsapp-baileys' });
    setCreatedInstance(null);
    setQrCode(null);
    setPairingCode(null);
    setError('');
  };
  const closeCreateModal = () => {
    setShowCreateModal(false);
    if (qrIntervalRef.current) { clearInterval(qrIntervalRef.current); qrIntervalRef.current = null; }
    setQrPolling(false);
  };

  const handleCreateInstance = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      const { data } = await ecomApi.post('/v1/external/whatsapp/create-instance', {
        customName: createData.name || undefined,
        serviceType: createData.serviceType,
      });
      if (data.success) {
        setCreatedInstance(data.data);
        if (data.qrcode) {
          setQrCode(data.qrcode);
          setPairingCode(data.pairingCode || null);
          setCreateStep('scanning');
          startQrPolling(data.data.id);
        } else {
          setCreateStep('scanning');
          fetchQrCode(data.data.id);
        }
        loadInstances();
        loadDashboardStats();
      } else { setError(data.error || 'Erreur lors de la création'); }
    } catch (err) { setError(err.response?.data?.error || err.message || 'Erreur serveur'); }
    finally { setSubmitting(false); }
  };

  const fetchQrCode = async (instanceId, forceRefresh = false) => {
    try {
      const suffix = forceRefresh ? '?refresh=1' : '';
      const { data } = await ecomApi.get(`/v1/external/whatsapp/instances/${instanceId}/qrcode${suffix}`);
      if (data.success && data.connected) {
        onInstanceConnected();
      } else if (data.success && data.qrcode) {
        setQrCode(data.qrcode);
        setPairingCode(data.pairingCode || null);
        startQrPolling(instanceId);
      } else {
        setError(data.error || 'Impossible de récupérer le QR code');
      }
    } catch (err) { setError(err.response?.data?.error || 'Erreur QR code'); }
  };

  const startQrPolling = (instanceId) => {
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    setQrPolling(true);
    qrIntervalRef.current = setInterval(async () => {
      try {
        const { data } = await ecomApi.get(`/v1/external/whatsapp/instances/${instanceId}/connection-status`);
        if (data.success && data.status === 'connected') onInstanceConnected();
      } catch {}
    }, 3000);
    setTimeout(() => { if (qrIntervalRef.current) { clearInterval(qrIntervalRef.current); qrIntervalRef.current = null; setQrPolling(false); } }, 120000);
  };

  const onInstanceConnected = () => {
    if (qrIntervalRef.current) { clearInterval(qrIntervalRef.current); qrIntervalRef.current = null; }
    setQrPolling(false);
    setCreateStep('success');
    setSuccessMsg('WhatsApp connecté avec succès ! 🎉');
    loadInstances();
    loadDashboardStats();
  };

  const refreshQr = async () => {
    if (!createdInstance?.id) return;
    setQrCode(null);
    fetchQrCode(createdInstance.id, true);
  };

  // ─── Open QR code for existing disconnected instance ───
  const openQrForInstance = async (instance) => {
    setCreatedInstance({ id: instance._id, instanceName: instance.instanceName, customName: instance.customName });
    setShowCreateModal(true);
    setCreateStep('scanning');
    setQrCode(null);
    setError('');
    fetchQrCode(instance._id);
  };

  // ═══ Webhook panel logic ═══
  const updateWh = (instId, patch) => setWebhookPanels(prev => ({ ...prev, [instId]: { ...prev[instId], ...patch } }));
  const toggleWebhookPanel = async (inst) => {
    const cur = webhookPanels[inst._id];
    if (cur?.open) { updateWh(inst._id, { open: false }); return; }
    updateWh(inst._id, { open: true, loading: true, saving: false, error: '', saved: false, config: { enabled: false, url: '', events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] } });
    try {
      const { data } = await ecomApi.get(`/v1/external/whatsapp/instances/${inst._id}/webhook?userId=${userId}`);
      if (data.success && data.data) updateWh(inst._id, { loading: false, config: { enabled: !!data.data.enabled, url: data.data.url || '', events: data.data.events || ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] } });
      else updateWh(inst._id, { loading: false });
    } catch { updateWh(inst._id, { loading: false }); }
  };
  const saveWebhookConfig = async (inst) => {
    const wh = webhookPanels[inst._id]; if (!wh) return;
    updateWh(inst._id, { saving: true, error: '', saved: false });
    try {
      const { data } = await ecomApi.post(`/v1/external/whatsapp/instances/${inst._id}/webhook`, { userId, ...wh.config });
      if (data.success) { updateWh(inst._id, { saving: false, saved: true }); setTimeout(() => updateWh(inst._id, { saved: false }), 3000); }
      else updateWh(inst._id, { saving: false, error: data.error || 'Erreur' });
    } catch (err) { updateWh(inst._id, { saving: false, error: err.response?.data?.error || err.message || 'Erreur serveur' }); }
  };

  const connectedCount = instances.filter(i => i.status === 'connected' || i.status === 'active').length;

  const TABS = [
    { id: 'instances', label: 'Instances', icon: Smartphone, count: instances.length },
    { id: 'relances', label: 'Relances', icon: Megaphone },
  ];

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-5">

      {/* Page Header */}
      <div className="relative overflow-hidden rounded-[30px] border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-100/60 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-emerald-50 via-white to-white" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm shadow-emerald-100">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500">
                    {instances.length} instance{instances.length !== 1 ? 's' : ''} · {connectedCount} en ligne
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">WhatsApp Service</h1>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 sm:text-[15px]">
                  Gérez vos instances WhatsApp sans surcharge d’information.
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap xl:w-auto xl:justify-end">
            <button onClick={refreshAllStatuses} disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Synchroniser
            </button>
            <button onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:brightness-95"
              style={{ background: ACCENT }}>
              <Plus className="h-4 w-4" />
              Créer une instance
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-[24px] border border-gray-100 bg-white p-2 shadow-sm sm:p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex gap-2 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setTab(tab.id)}
                className={`relative flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-semibold transition whitespace-nowrap ${active ? 'bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${active ? 'bg-white text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/ecom/whatsapp/agent-config')}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-[12px] font-semibold text-violet-700 transition hover:bg-violet-100 whitespace-nowrap"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Configurer Rita IA</span>
          </button>
        </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {/* ═══ Modal Création d'Instance ═══ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeCreateModal}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT_LIGHT }}>
                  {createStep === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> :
                   createStep === 'scanning' ? <QrCode className="w-5 h-5" style={{ color: ACCENT }} /> :
                   <Plus className="w-5 h-5" style={{ color: ACCENT }} />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-[15px]">
                    {createStep === 'success' ? 'Instance connectée !' : createStep === 'scanning' ? 'Scanner le QR Code' : 'Créer une instance'}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {createStep === 'success' ? 'Votre WhatsApp est maintenant lié' : createStep === 'scanning' ? 'Ouvrez WhatsApp → Appareils connectés → Scanner' : 'Configurez votre nouvelle connexion WhatsApp'}
                  </p>
                </div>
              </div>
              <button onClick={closeCreateModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step: Form */}
            {createStep === 'form' && (
              <form onSubmit={handleCreateInstance} className="p-6 space-y-5">
                {/* Nom de l'instance */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-semibold text-gray-700">Nom de l'instance</label>
                  <input
                    type="text"
                    value={createData.name}
                    onChange={e => setCreateData(d => ({ ...d, name: e.target.value }))}
                    placeholder="ex: Mon WhatsApp Business"
                    className="field-input"
                    autoFocus
                  />
                  <p className="text-[11px] text-gray-400">Un nom pour identifier cette connexion (optionnel)</p>
                </div>

                {/* Type de service */}
                <div className="space-y-2">
                  <label className="block text-[13px] font-semibold text-gray-700">Type de service</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SERVICE_TYPES.map(svc => {
                      const selected = createData.serviceType === svc.id;
                      const Logo = svc.logo;
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => setCreateData(d => ({ ...d, serviceType: svc.id }))}
                          className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                            selected
                              ? `border-${svc.color}-500 bg-${svc.color}-50 ring-2 ring-${svc.color}-200`
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          {selected && (
                            <span className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-${svc.color}-500 text-white flex items-center justify-center`}>
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                            <Logo className="h-8 w-8" />
                          </div>
                          <p className={`text-[13px] font-semibold ${selected ? `text-${svc.color}-800` : 'text-gray-900'}`}>{svc.label}</p>
                          <p className={`text-[11px] mt-0.5 ${selected ? `text-${svc.color}-600` : 'text-gray-400'}`}>{svc.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button type="button" onClick={closeCreateModal}
                    className="px-4 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    Annuler
                  </button>
                  <button type="submit" disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white rounded-lg disabled:opacity-50 transition-all shadow-sm"
                    style={{ background: ACCENT }}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {submitting ? 'Création en cours...' : 'Créer l\'instance'}
                  </button>
                </div>
              </form>
            )}

            {/* Step: Scanning QR */}
            {createStep === 'scanning' && (
              <div className="p-6 space-y-5">
                {createdInstance && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                    <Smartphone className="w-5 h-5 text-gray-400" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">{createdInstance.customName || createdInstance.instanceName}</p>
                      <p className="text-[11px] text-gray-400 font-mono truncate">{createdInstance.instanceName}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center gap-4">
                  {qrCode ? (
                    <>
                      <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
                        <img
                          src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                          alt="QR Code WhatsApp"
                          className="w-60 h-60 object-contain"
                        />
                      </div>

                      {pairingCode && (
                        <div className="text-center space-y-1">
                          <p className="text-[11px] text-gray-400">Ou entrez ce code manuellement :</p>
                          <div className="flex items-center gap-2 justify-center">
                            <code className="text-lg font-bold tracking-[0.3em] text-gray-900 bg-gray-50 px-5 py-2.5 rounded-xl border border-gray-200">
                              {pairingCode}
                            </code>
                            <button onClick={() => copyToClipboard(pairingCode, 'pairing')}
                              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                              {copiedId === 'pairing' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {qrPolling && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                          </span>
                          <span className="text-[12px] font-medium text-emerald-700">En attente de la connexion...</span>
                        </div>
                      )}

                      <button onClick={refreshQr}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Rafraîchir le QR code
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <Loader2 className="w-10 h-10 animate-spin text-gray-300" />
                      <p className="text-sm text-gray-400">Génération du QR code...</p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step: Success */}
            {createStep === 'success' && (
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">Connexion réussie ! 🎉</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Votre instance <strong>{createdInstance?.customName || createdInstance?.instanceName}</strong> est maintenant connectée à WhatsApp.
                  </p>
                </div>
                <button onClick={closeCreateModal}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all"
                  style={{ background: ACCENT }}>
                  <CheckCircle className="w-4 h-4" />
                  Terminé
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Instances */}
      {activeTab === 'instances' && (
        <div className="space-y-4">

          {/* Dashboard Stats */}
          {dashboardStats && instances.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total instances', value: dashboardStats.totalInstances, icon: Smartphone, sub: `${dashboardStats.connected} connectée${dashboardStats.connected > 1 ? 's' : ''}`, accent: 'emerald' },
                { label: "Messages aujourd'hui", value: dashboardStats.totalSentToday, icon: Send, sub: `sur ${dashboardStats.totalDailyLimit} max`, accent: 'blue' },
                { label: 'Messages ce mois', value: dashboardStats.totalSentMonth, icon: BarChart3, sub: `sur ${dashboardStats.totalMonthlyLimit} max`, accent: 'violet' },
                { label: 'Hors ligne', value: dashboardStats.disconnected, icon: WifiOff, sub: dashboardStats.disconnected > 0 ? 'à reconnecter' : 'tout est OK', accent: dashboardStats.disconnected > 0 ? 'red' : 'gray' },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                      <div className={`w-7 h-7 rounded-lg bg-${stat.accent}-50 flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 text-${stat.accent}-500`} />
                      </div>
                    </div>
                    <p className={`text-2xl font-bold text-${stat.accent}-600`}>{stat.value}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{stat.sub}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <span className="ml-2.5 text-sm text-gray-400">Chargement...</span>
            </div>
          )}

          {/* Empty */}
          {!loading && instances.length === 0 && (
            <div className="overflow-hidden rounded-[30px] border border-gray-100 bg-white shadow-sm">
              <div className="relative overflow-hidden px-6 py-12 text-center sm:px-8 sm:py-14">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-white" />
                <div className="relative mx-auto max-w-lg">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 shadow-sm shadow-emerald-100">
                    <Smartphone className="h-8 w-8" />
                  </div>
                  <h2 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Aucune instance WhatsApp</h2>
                  <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-[15px]">
                    Créez votre première instance pour connecter votre WhatsApp et commencer à envoyer des messages.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button onClick={openCreateModal}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:brightness-95"
                      style={{ background: ACCENT }}>
                      <Plus className="h-4 w-4" />
                      Créer une instance
                    </button>
                    <button
                      onClick={() => navigate('/ecom/whatsapp/agent-config')}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                    >
                      <Bot className="h-4 w-4" />
                      Configurer Rita IA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instance Cards */}
          {!loading && instances.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {instances.map((inst) => {
                const st = getStatus(inst.status);
                const test = testResults[inst._id];
                const wh = webhookPanels[inst._id];
                const stats = messageStats[inst._id];
                const isConnected = inst.status === 'connected' || inst.status === 'active';
                return (
                  <div key={inst._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gray-300 transition-all group">
                    <div className={`h-[3px] ${isConnected ? 'bg-emerald-500' : inst.status === 'configured' ? 'bg-blue-400' : 'bg-red-400'}`} />
                    <div className="p-5 space-y-4">

                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${st.bg}`}>
                            {isConnected ? <Wifi className={`w-5 h-5 ${st.text}`} /> : <WifiOff className={`w-5 h-5 ${st.text}`} />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-[14px] truncate leading-tight">
                              {inst.customName || inst.instanceName}
                            </p>
                            <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5">{inst.instanceName}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${isConnected ? 'animate-pulse' : ''}`} />
                          {st.label}
                        </span>
                      </div>

                      {/* Quotas / Message Stats */}
                      {stats && (
                        <div className="space-y-3 p-3.5 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                              <BarChart3 className="w-3 h-3" />
                              Quotas
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              stats.plan === 'plus' ? 'bg-purple-100 text-purple-700' :
                              stats.plan === 'pro' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-200 text-gray-600'
                            }`}>
                              {stats.plan === 'free' ? 'Gratuit' : stats.plan === 'pro' ? 'Pro' : 'Plus'}
                            </span>
                          </div>

                          {/* Daily */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-500">Aujourd'hui</span>
                              <span className="font-bold text-gray-800">{stats.messagesSentToday} <span className="text-gray-400 font-normal">/ {stats.dailyLimit}</span></span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${
                                stats.messagesSentToday >= stats.dailyLimit ? 'bg-red-500' :
                                stats.messagesSentToday / stats.dailyLimit > 0.8 ? 'bg-orange-500' : 'bg-emerald-500'
                              }`} style={{ width: `${Math.min(100, (stats.messagesSentToday / stats.dailyLimit) * 100)}%` }} />
                            </div>
                          </div>

                          {/* Monthly */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-500">Ce mois</span>
                              <span className="font-bold text-gray-800">{stats.messagesSentThisMonth} <span className="text-gray-400 font-normal">/ {stats.monthlyLimit}</span></span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${
                                stats.messagesSentThisMonth >= stats.monthlyLimit ? 'bg-red-500' :
                                stats.messagesSentThisMonth / stats.monthlyLimit > 0.8 ? 'bg-orange-500' : 'bg-emerald-500'
                              }`} style={{ width: `${Math.min(100, (stats.messagesSentThisMonth / stats.monthlyLimit) * 100)}%` }} />
                            </div>
                          </div>

                          {stats.limitExceeded && (
                            <div className="space-y-2 px-2.5 py-2 bg-red-50 border border-red-100 rounded-lg">
                              <div className="flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                <p className="text-[10px] text-red-700 font-medium">Limite de messages atteinte</p>
                              </div>
                              <p className="text-[10px] text-red-700">Ce quota est lié au compte Rita. Passez à une offre supérieure pour continuer.</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
                                  <p className="text-[9px] font-bold uppercase text-amber-700">Pro</p>
                                  <p className="text-[10px] text-amber-700">1 000/jour · 50 000/mois</p>
                                </div>
                                <div className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5">
                                  <p className="text-[9px] font-bold uppercase text-violet-700">Plus</p>
                                  <p className="text-[10px] text-violet-700">5 000/jour · 200 000/mois</p>
                                </div>
                              </div>
                              {canAccessRitaAgent ? (
                                <button
                                  type="button"
                                  onClick={() => navigate('/ecom/whatsapp/agent-config')}
                                  className="w-full text-[10px] font-semibold px-2 py-1.5 rounded-md bg-white border border-red-200 text-red-700 hover:bg-red-100 transition-colors"
                                >
                                  Voir les offres Rita
                                </button>
                              ) : (
                                <p className="text-[10px] text-red-700">Demandez au Super Admin d'activer une offre Pro ou Plus.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Not connected → Scan QR button prominent */}
                      {!isConnected && (
                        <button onClick={() => openQrForInstance(inst)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors">
                          <QrCode className="w-4 h-4" />
                          Scanner le QR code pour connecter
                        </button>
                      )}

                      {/* Token */}
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Token</span>
                        <div className="flex items-center gap-1.5">
                          <code className="text-[12px] text-gray-600 font-mono">
                            {showTokens[inst._id] ? inst.instanceToken : '••••••••••••'}
                          </code>
                          <button onClick={() => setShowTokens(p => ({ ...p, [inst._id]: !p[inst._id] }))}
                            className="text-gray-400 hover:text-gray-600 p-0.5 rounded">
                            {showTokens[inst._id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => copyToClipboard(inst.instanceToken, inst._id + 't')}
                            className="text-gray-400 hover:text-gray-600 p-0.5 rounded">
                            {copiedId === inst._id + 't' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Test result */}
                      {test && !test.loading && test.message && (
                        <div className={`text-[11px] font-medium px-3 py-2 rounded-lg ${test.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                          {test.success ? '✓ ' : '✗ '}{test.message}
                        </div>
                      )}

                      {/* Webhook panel */}
                      {wh?.open && (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] font-semibold text-gray-800 flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-blue-400" /> Webhook
                            </p>
                            <button onClick={() => updateWh(inst._id, { open: false })} className="text-gray-400 hover:text-gray-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {wh.loading ? (
                            <div className="flex items-center gap-2 py-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                              <span className="text-[11px] text-gray-400">Chargement...</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] text-gray-600">Activer</span>
                                <button onClick={() => updateWh(inst._id, { config: { ...wh.config, enabled: !wh.config?.enabled } })} type="button"
                                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${wh.config?.enabled ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                                  <span className={`absolute top-[3px] w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all ${wh.config?.enabled ? 'left-[19px]' : 'left-[3px]'}`} />
                                </button>
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-gray-600 mb-1">URL du webhook</label>
                                <input value={wh.config?.url || ''} onChange={e => updateWh(inst._id, { config: { ...wh.config, url: e.target.value } })}
                                  placeholder="https://votre-serveur.com/webhook" className="field-input text-[12px]" />
                              </div>
                              <div>
                                <p className="text-[11px] font-medium text-gray-600 mb-1.5">Événements</p>
                                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                                  {WEBHOOK_EVENTS.map(ev => (
                                    <label key={ev.id} className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer select-none">
                                      <input type="checkbox" checked={(wh.config?.events || []).includes(ev.id)}
                                        onChange={e => {
                                          const evts = e.target.checked ? [...(wh.config?.events || []), ev.id] : (wh.config?.events || []).filter(x => x !== ev.id);
                                          updateWh(inst._id, { config: { ...wh.config, events: evts } });
                                        }} className="w-3 h-3 cursor-pointer accent-emerald-500" />
                                      {ev.label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <button onClick={() => saveWebhookConfig(inst)} disabled={wh.saving}
                                className="w-full py-1.5 text-[12px] font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: ACCENT }}>
                                {wh.saving ? 'Sauvegarde...' : 'Enregistrer'}
                              </button>
                              {wh.error && <p className="text-[11px] text-red-600">{wh.error}</p>}
                              {wh.saved && <p className="text-[11px] text-emerald-600 font-medium">✓ Webhook configuré</p>}
                            </>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-[11px] text-gray-300">
                          {inst.createdAt ? `Créé le ${new Date(inst.createdAt).toLocaleDateString('fr-FR')}` : ''}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => testConnection(inst)} disabled={test?.loading}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                              test?.success === true ? 'bg-emerald-50 text-emerald-700' :
                              test?.success === false ? 'bg-red-50 text-red-600' :
                              'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            } disabled:opacity-50`}>
                            {test?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                            {test?.loading ? 'Test...' : test?.success === true ? 'OK' : test?.success === false ? 'Erreur' : 'Tester'}
                          </button>
                          <button onClick={() => toggleWebhookPanel(inst)} title="Webhook"
                            className={`p-1.5 rounded-lg transition-colors ${wh?.open ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}>
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteInstance(inst)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'relances' && (
        <RelancesTab instances={instances} userId={userId} />
      )}

      <style>{`
        .field-input {
          width: 100%;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 450;
          color: #1f2937;
          background: #fafbfc;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          outline: none;
          transition: all .2s cubic-bezier(.4,0,.2,1);
          -webkit-appearance: none;
        }
        .field-input:hover {
          border-color: #d1d5db;
          background: #fff;
        }
        .field-input:focus {
          border-color: #a78bfa;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.12);
          background: #fff;
        }
        .field-input::placeholder {
          color: #9ca3af;
          font-weight: 400;
        }
        textarea.field-input { resize: vertical; }
        .rita-select-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #1f2937;
          background: #fafbfc;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          outline: none;
          cursor: pointer;
          transition: all .2s cubic-bezier(.4,0,.2,1);
          -webkit-appearance: none;
        }
        .rita-select-trigger:hover {
          border-color: #d1d5db;
          background: #fff;
        }
        .rita-select-trigger:focus-visible {
          border-color: #a78bfa;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.15);
          background: #fff;
        }
        .rita-select-open {
          border-color: #a78bfa;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.15);
          background: #fff;
        }
        .rita-select-dropdown {
          position: absolute;
          z-index: 130;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          max-height: 300px;
          overflow-y: auto;
          background: white;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 14px;
          box-shadow: 0 12px 40px -8px rgba(0,0,0,0.12), 0 4px 16px -4px rgba(0,0,0,0.06);
          padding: 4px;
          animation: ritaDropIn .18s cubic-bezier(.2,0,0,1);
        }
        .rita-select-dropdown-up {
          animation: ritaDropInUp .18s cubic-bezier(.2,0,0,1);
        }
        @keyframes ritaDropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ritaDropInUp {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .rita-select-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          border-radius: 10px;
          cursor: pointer;
          transition: background .1s;
        }
        .rita-select-option:hover,
        .rita-select-option-focused {
          background: #f5f3ff;
        }
        .rita-select-option-active {
          color: #7c3aed;
          font-weight: 600;
          background: #f5f3ff;
        }
        .rita-select-dropdown::-webkit-scrollbar { width: 6px; }
        .rita-select-dropdown::-webkit-scrollbar-track { background: transparent; }
        .rita-select-dropdown::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 3px; }
        .rita-section-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .rita-section-nav::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

/* ── Reusable UI ── */
const Alert = ({ type, message, onClose }) => {
  const styles = {
    error:   'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  const icons = {
    error:   <AlertCircle className="w-4 h-4 flex-shrink-0" />,
    success: <CheckCircle className="w-4 h-4 flex-shrink-0" />,
    warning: <AlertCircle className="w-4 h-4 flex-shrink-0" />,
  };
  return (
    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm rounded-lg border ${styles[type]}`}>
      {icons[type]}
      <span className="flex-1 font-medium text-[13px]">{message}</span>
      {onClose && <button onClick={onClose} className="opacity-50 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>}
    </div>
  );
};

const Field = ({ label, hint, required, children }) => (
  <div className="space-y-1.5">
    <label className="flex items-baseline gap-1.5 text-[13px] font-semibold text-gray-700">
      {label}{required && <span className="text-red-400 text-[11px]">*</span>}
      {hint && <span className="text-[11.5px] text-gray-400 font-normal">({hint})</span>}
    </label>
    {children}
  </div>
);

const ToggleRow = ({ enabled, onChange, label, desc }) => (
  <div className="flex items-center justify-between gap-4 py-1.5 group">
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-semibold text-gray-700 leading-tight group-hover:text-gray-900 transition-colors">{label}</p>
      {desc && <p className="text-[11.5px] text-gray-400 mt-0.5 leading-snug">{desc}</p>}
    </div>
    <button onClick={() => onChange(!enabled)} type="button"
      role="switch" aria-checked={enabled} aria-label={label}
      className={`relative w-[44px] h-[26px] rounded-full transition-all duration-200 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 ${enabled ? 'bg-emerald-500' : 'bg-gray-200 hover:bg-gray-300'}`}>
      <span className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${enabled ? 'left-[21px]' : 'left-[3px]'}`} />
    </button>
  </div>
);

const CustomSelect = ({ value, onChange, options, placeholder = 'Sélectionner...' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focused, setFocused] = useState(-1);
  const [openUpward, setOpenUpward] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(300);
  const ref = React.useRef(null);
  const listRef = React.useRef(null);
  const selected = options.find(o => o.value === value);

  const updateMenuPlacement = () => {
    if (!ref.current || typeof window === 'undefined') return;

    const rect = ref.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const shouldOpenUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
    const availableSpace = shouldOpenUpward ? spaceAbove : spaceBelow;

    setOpenUpward(shouldOpenUpward);
    setMenuMaxHeight(Math.max(160, Math.min(340, availableSpace)));
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault(); setIsOpen(true); setFocused(options.findIndex(o => o.value === value)); return;
    }
    if (!isOpen) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setFocused(prev => Math.min(prev + 1, options.length - 1)); break;
      case 'ArrowUp': e.preventDefault(); setFocused(prev => Math.max(prev - 1, 0)); break;
      case 'Enter': e.preventDefault(); if (focused >= 0) { onChange(options[focused].value); setIsOpen(false); } break;
      case 'Escape': setIsOpen(false); break;
    }
  };

  useEffect(() => {
    if (isOpen && focused >= 0 && listRef.current) {
      const el = listRef.current.children[focused];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [focused, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPlacement();
    const handleViewportChange = () => updateMenuPlacement();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen]);

  return (
    <div ref={ref} className={isOpen ? 'relative z-[120]' : 'relative z-10'} onKeyDown={handleKeyDown}>
      <button type="button" onClick={() => {
        if (!isOpen) updateMenuPlacement();
        setIsOpen(!isOpen);
        setFocused(options.findIndex(o => o.value === value));
      }}
        className={`rita-select-trigger ${isOpen ? 'rita-select-open' : ''}`}
        role="combobox" aria-expanded={isOpen} aria-haspopup="listbox">
        <span className="flex items-center gap-2 flex-1 min-w-0 truncate">
          {selected ? selected.label : <span className="text-gray-400">{placeholder}</span>}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          className={`rita-select-dropdown ${openUpward ? 'rita-select-dropdown-up' : ''}`}
          role="listbox"
          ref={listRef}
          style={{
            maxHeight: `${menuMaxHeight}px`,
            top: openUpward ? 'auto' : 'calc(100% + 4px)',
            bottom: openUpward ? 'calc(100% + 4px)' : 'auto',
          }}
        >
          {options.map((opt, i) => (
            <div key={opt.value} role="option" aria-selected={opt.value === value}
              className={`rita-select-option ${opt.value === value ? 'rita-select-option-active' : ''} ${focused === i ? 'rita-select-option-focused' : ''}`}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              onMouseEnter={() => setFocused(i)}>
              <span className="flex-1 min-w-0 truncate">{opt.label}</span>
              {opt.value === value && (
                <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Rita Rapport Section ── */
const ACTIVITY_LABELS = {
  message_received: { label: 'Message reçu', emoji: '💬', color: 'text-blue-600 bg-blue-50' },
  message_replied: { label: 'Réponse envoyée', emoji: '📤', color: 'text-emerald-600 bg-emerald-50' },
  order_confirmed: { label: 'Commande confirmée', emoji: '📦', color: 'text-purple-600 bg-purple-50' },
  vocal_transcribed: { label: 'Vocal transcrit', emoji: '🎤', color: 'text-amber-600 bg-amber-50' },
  vocal_sent: { label: 'Note vocale', emoji: '🔊', color: 'text-pink-600 bg-pink-50' },
  image_sent: { label: 'Image envoyée', emoji: '📸', color: 'text-cyan-600 bg-cyan-50' },
  escalation: { label: 'Escalade', emoji: '⚠️', color: 'text-red-600 bg-red-50' },
};

const RitaRapportSection = ({ userId }) => {
  const [activityData, setActivityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(1);

  const fetchActivity = async (d) => {
    setLoading(true);
    try {
      const { data } = await ecomApi.get(`/v1/external/whatsapp/rita-activity?userId=${userId}&days=${d}`);
      if (data.success) setActivityData(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userId) fetchActivity(days); }, [userId, days]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  if (!activityData) return <div className="text-center py-8 text-gray-400 text-[13px]">Aucune donnée disponible</div>;

  const { stats, recent } = activityData;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-2">
        {[{ v: 1, l: "Aujourd'hui" }, { v: 7, l: '7 jours' }, { v: 30, l: '30 jours' }].map(p => (
          <button key={p.v} onClick={() => setDays(p.v)}
            className={`px-3 py-1.5 text-[12px] rounded-lg font-medium transition-all ${days === p.v ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
            {p.l}
          </button>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Messages reçus', value: stats.messagesReceived, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Réponses', value: stats.messagesReplied, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Commandes', value: stats.ordersConfirmed, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Clients uniques', value: stats.uniqueClients, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {(stats.vocalsTranscribed > 0 || stats.vocalsSent > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-amber-600">{stats.vocalsTranscribed}</div>
            <div className="text-[11px] text-gray-500">Vocaux transcrits</div>
          </div>
          <div className="bg-pink-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-pink-600">{stats.vocalsSent}</div>
            <div className="text-[11px] text-gray-500">Notes vocales</div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <h4 className="text-[13px] font-semibold text-gray-700 mb-2">Activité récente</h4>
        {recent.length === 0 ? (
          <p className="text-[12px] text-gray-400 py-4 text-center">Aucune activité pour cette période</p>
        ) : (
          <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
            {recent.map((a, i) => {
              const info = ACTIVITY_LABELS[a.type] || { label: a.type, emoji: '•', color: 'text-gray-600 bg-gray-50' };
              const time = new Date(a.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              const dateStr = new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
              return (
                <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${info.color}`}>
                  <span className="text-base flex-shrink-0">{info.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-medium">{info.label}</span>
                    {a.customerName && <span className="text-[11px] ml-1.5 opacity-70">— {a.customerName}</span>}
                    {a.product && <span className="text-[11px] ml-1.5 opacity-70">· {a.product}</span>}
                    {a.price && <span className="text-[11px] ml-1 font-semibold">· {a.price}</span>}
                  </div>
                  <span className="text-[10px] opacity-50 flex-shrink-0">{dateStr} {time}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Rita IA ── */
const RITA_SECTIONS = [
  { id: 'identity',     label: 'Identité',     emoji: '🤖' },
  { id: 'intelligence', label: 'Intelligence',  emoji: '🧠' },
  { id: 'products',     label: 'Produits',      emoji: '🛒' },
  { id: 'stock',        label: 'Stock',         emoji: '📦' },
  { id: 'knowledge',    label: 'Connaissances', emoji: '📚' },
  { id: 'personality',  label: 'Personnalité',  emoji: '🎭' },
  { id: 'sales',        label: 'Vente',         emoji: '💰' },
  { id: 'offers',       label: 'Offres',        emoji: '🎁' },
  { id: 'messages',     label: 'Messages',      emoji: '💬' },
  { id: 'availability', label: 'Dispo',         emoji: '⏰' },
  { id: 'voice',        label: 'Vocal',         emoji: '🎙️' },
];

const AUTONOMY_LEVELS = [
  { level: 1, label: 'Assistante',   desc: "Répond aux questions simples uniquement",                    color: 'bg-blue-100 text-blue-700' },
  { level: 2, label: 'Conseillère',  desc: 'Recommande des produits et qualifie les leads',              color: 'bg-cyan-100 text-cyan-700' },
  { level: 3, label: 'Commerciale',  desc: "Gère les objections et pousse à l'achat",                   color: 'bg-emerald-100 text-emerald-700' },
  { level: 4, label: 'Négociatrice', desc: 'Conclut des ventes de façon autonome et gère les relances', color: 'bg-amber-100 text-amber-700' },
  { level: 5, label: 'Chasseuse',    desc: 'Mode offensif : qualification, closing agressif, upsell',   color: 'bg-red-100 text-red-700' },
];

const OFFER_TRIGGER_OPTIONS = [
  { value: 'first-contact', label: 'Premier contact' },
  { value: 'hesitation', label: 'Quand le client hésite' },
  { value: 'price-objection', label: 'Objection sur le prix' },
  { value: 'follow-up', label: 'Relance prospect silencieux' },
  { value: 'upsell', label: 'Upsell après intérêt confirmé' },
  { value: 'last-chance', label: 'Dernière chance / urgence' },
];

const RitaIATab = ({ instances, externalPanel = null, onExternalPanelChange }) => {
  const [activeSection, setActiveSection] = useState('identity');
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const [topPanel, setTopPanel] = useState(null);

  const [config, setConfig] = useState({
    enabled: false,
    instanceId: '',
    agentName: 'Rita',
    agentRole: 'Commerciale IA',
    language: 'fr',
    toneStyle: 'warm',
    useEmojis: true,
    signMessages: false,
    responseDelay: 2,
    welcomeMessage: "Bonjour 👌 quel produit vous intéresse ?",
    fallbackMessage: "Merci pour votre message ! Je vérifie et reviens vers vous très vite 🙏",
    autonomyLevel: 3,
    canCloseDeals: true,
    canSendPaymentLinks: false,
    requireHumanApproval: false,
    followUpEnabled: false,
    followUpDelay: 24,
    followUpMessage: "Bonjour ! Avez-vous eu le temps de réfléchir à notre offre ? Je suis là pour répondre à vos questions 😊",
    followUpMaxRelances: 3,
    followUpRelanceMessages: [],
    followUpOffer: '',
    escalateAfterMessages: 10,
    // Témoignages
    testimonialsEnabled: false,
    testimonials: [],
    businessContext: '',
    products: '',
    faq: '',
    usefulLinks: '',
    competitiveAdvantages: '',
    autoReplyKeywords: [],
    qualificationQuestions: ['Quel est votre budget ?', 'Pour quand en avez-vous besoin ?'],
    closingTechnique: 'soft',
    objectionsHandling: '',
    commercialOffersEnabled: false,
    commercialOffers: [],
    // Pricing negotiation
    pricingNegotiation: { enabled: false, allowDiscount: false, maxDiscountPercent: 0, negotiationStyle: 'firm', priceIsFinal: true, discountConditions: '', refusalMessage: '', globalNote: '' },
    // Auto language detection
    autoLanguageDetection: true,
    businessHoursOnly: false,
    businessHoursStart: '08:00',
    businessHoursEnd: '20:00',
    // Stock management
    stockManagementEnabled: false,
    stockEntries: [],
    // Structured product catalog
    productCatalog: [],
    // Personality
    personality: { description: '', mannerisms: [], forbiddenPhrases: [], tonalGuidelines: '' },
    conversationExamples: [],
    behaviorRules: [],
    // Vocal
    responseMode: 'text',
    voiceMode: false,
    mixedVoiceReplyChance: 65,
    elevenlabsApiKey: '',
    elevenlabsVoiceId: '9ZATEeixBigmezesCGAk',
    elevenlabsModel: 'eleven_v3',
    voiceStylePreset: 'balanced',
    // Fish.audio (Voix Avancée)
    ttsProvider: 'elevenlabs',
    fishAudioApiKey: '',
    fishAudioReferenceId: '13f7f6e260f94079b9d51c961fa6c9e2',
    fishAudioModel: 's2-pro',
    fishAudioVoices: [],
    // Notifications boss
    bossNotifications: false,
    bossPhone: '',
    notifyOnOrder: true,
    notifyOnScheduled: true,
    dailySummary: true,
    dailySummaryTime: '20:00',
    // Escalade boss
    bossEscalationEnabled: false,
    bossEscalationTimeoutMin: 30,
    // Messages d'accusé de réception de commande
    orderConfirmationMessage: 'Bonjour {{first_name}} 👋\n\nJ\'espère que vous allez bien !\n\nIci le service client Zendo.\n\nNous accusons réception de votre commande n°{{order_number}} ✅\n\nLe produit {{product}} coûte {{price}} FCFA l\'unité pour une quantité de {{quantity}}.\n\nNous pouvons vous livrer aujourd\'hui (si la commande est passée avant 16h) ou demain (si elle est passée après 16h) 🙏🏼',
    orderConfirmationMessageNonDeliverable: 'Bonjour {{first_name}} 👋\n\nNous avons bien reçu votre commande n°{{order_number}} ✅\n\nLe produit {{product}} coûte {{price}} FCFA l\'unité pour une quantité de {{quantity}}.\n\nMalheureusement, nous ne livrons pas encore dans votre ville ({{city}}). Nous vous contacterons dès que la livraison sera disponible dans votre zone. 🙏',
    enableCityRouting: false,
    deliverableZones: [],
  });

  const [simMessages, setSimMessages] = useState([]);
  const [simInput, setSimInput] = useState('');
  const [simTyping, setSimTyping] = useState(false);
  const simEndRef = React.useRef(null);
  const [newKw, setNewKw] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [editingProduct, setEditingProduct] = useState(null); // index or null
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState(new Set()); // multi-select indexes
  const [newDeliverableZone, setNewDeliverableZone] = useState('');
  const [newMannerism, setNewMannerism] = useState('');
  const [newForbidden, setNewForbidden] = useState('');
  const [previewingVoice, setPreviewingVoice] = useState(null); // voiceId en cours de preview
  const [creatingFishVoice, setCreatingFishVoice] = useState(false);
  const [fishVoiceName, setFishVoiceName] = useState('');
  const [fishVoiceDescription, setFishVoiceDescription] = useState('');
  const [fishVoiceSamples, setFishVoiceSamples] = useState([]);
  const [fishVoiceTexts, setFishVoiceTexts] = useState(['']);
  const [fishVoiceStatus, setFishVoiceStatus] = useState(null);
  const [testingBoss, setTestingBoss] = useState(false);
  const [testBossResult, setTestBossResult] = useState(null); // { ok, msg }

  const handleTestBossNotif = async () => {
    const phone = (config.bossPhone || '').replace(/\D/g, '');
    if (!phone || phone.length < 8) {
      setTestBossResult({ ok: false, msg: 'Entrez d\'abord le numéro WhatsApp du boss.' });
      return;
    }
    setTestingBoss(true); setTestBossResult(null);
    try {
      const { data } = await ecomApi.post('/v1/external/whatsapp/test-boss-notification', { userId, bossPhone: phone });
      setTestBossResult({ ok: data.success, msg: data.success ? `✅ Message test envoyé au ${phone}` : (data.error || 'Erreur inconnue') });
    } catch (e) {
      setTestBossResult({ ok: false, msg: e?.response?.data?.error || 'Erreur de connexion' });
    } finally {
      setTestingBoss(false);
      setTimeout(() => setTestBossResult(null), 6000);
    }
  };

  const playVoicePreview = async (voiceId, e) => {
    e.stopPropagation();
    if (previewingVoice === voiceId) return;
    setPreviewingVoice(voiceId);
    try {
      const preset = config.voiceStylePreset || 'balanced';
      const { data } = await ecomApi.get(`/v1/external/whatsapp/preview-voice?voiceId=${voiceId}&voiceStylePreset=${preset}`);
      if (data.success && data.audio) {
        const bytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { setPreviewingVoice(null); URL.revokeObjectURL(url); };
        audio.onerror = () => { setPreviewingVoice(null); URL.revokeObjectURL(url); };
        audio.play();
      } else { setPreviewingVoice(null); }
    } catch { setPreviewingVoice(null); }
  };

  const playFishPreview = async (referenceId) => {
    if (!referenceId || previewingVoice === referenceId) return;
    setPreviewingVoice(referenceId);
    try {
      const params = new URLSearchParams({
        referenceId,
        model: config.fishAudioModel || 's2-pro',
        userId,
      });
      const headers = (config.fishAudioApiKey || '').trim()
        ? { 'x-fish-audio-api-key': config.fishAudioApiKey.trim() }
        : undefined;
      const { data } = await ecomApi.get(`/v1/external/whatsapp/preview-voice-fish?${params}`, { headers });
      if (data.success && data.audio) {
        const bytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { setPreviewingVoice(null); URL.revokeObjectURL(url); };
        audio.onerror = () => { setPreviewingVoice(null); URL.revokeObjectURL(url); };
        audio.play();
      } else {
        setPreviewingVoice(null);
      }
    } catch (err) {
      setFishVoiceStatus({ type: 'error', msg: err?.response?.data?.error || 'Erreur de prévisualisation Fish.audio.' });
      setPreviewingVoice(null);
    }
  };

  const handleFishSampleChange = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 3);
    setFishVoiceSamples(files);
    setFishVoiceTexts(prev => {
      const next = files.map((_, index) => prev[index] || '');
      return next.length ? next : [''];
    });
  };

  const setFishText = (index, value) => {
    setFishVoiceTexts(prev => prev.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const handleCreateFishVoice = async () => {
    if (!fishVoiceName.trim()) {
      setFishVoiceStatus({ type: 'error', msg: 'Donne un nom à ta voix.' });
      return;
    }
    if (!(config.fishAudioApiKey || '').trim() && !config.fishAudioApiKeyConfigured) {
      setFishVoiceStatus({ type: 'error', msg: 'Ajoute une clé API Fish.audio ou configure-la côté serveur avant de créer une voix.' });
      return;
    }
    if (!fishVoiceSamples.length) {
      setFishVoiceStatus({ type: 'error', msg: 'Ajoute au moins un échantillon audio.' });
      return;
    }

    setCreatingFishVoice(true);
    setFishVoiceStatus(null);
    try {
      const fd = new FormData();
      fd.append('userId', userId);
      fd.append('title', fishVoiceName.trim());
      fd.append('description', fishVoiceDescription.trim());
      if ((config.fishAudioApiKey || '').trim()) {
        fd.append('fishAudioApiKey', config.fishAudioApiKey.trim());
      }
      fishVoiceSamples.forEach(file => fd.append('voices', file));
      fishVoiceTexts.filter(Boolean).forEach(text => fd.append('texts', text.trim()));

      const { data } = await ecomApi.post('/v1/external/whatsapp/fish-voice', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!data.success) {
        setFishVoiceStatus({ type: 'error', msg: data.error || 'Création de voix échouée.' });
        return;
      }

      setConfig(prev => ({
        ...prev,
        ...data.config,
        ttsProvider: 'fishaudio',
        fishAudioReferenceId: data.voice.id,
        fishAudioApiKeyConfigured: true,
      }));
      setFishVoiceStatus({ type: 'success', msg: `Voix créée: ${data.voice.name}` });
      setFishVoiceName('');
      setFishVoiceDescription('');
      setFishVoiceSamples([]);
      setFishVoiceTexts(['']);
    } catch (err) {
      setFishVoiceStatus({ type: 'error', msg: err?.response?.data?.error || 'Erreur de création Fish.audio.' });
    } finally {
      setCreatingFishVoice(false);
    }
  };

  const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
  const userId = user._id || user.id;

  useEffect(() => { loadConfig(); }, []);
  useEffect(() => { simEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [simMessages, simTyping]);
  
  // Auto-sélectionner la première instance si aucune n'est sélectionnée
  useEffect(() => {
    if (instances.length > 0 && !config.instanceId) {
      const firstInstance = instances[0];
      set('instanceId', firstInstance._id);
    }
  }, [instances.length, config.instanceId]);

  const loadConfig = async () => {
    try {
      const { data } = await ecomApi.get(`/v1/external/whatsapp/rita-config?userId=${userId}`);
      if (data.success && data.config) {
        setConfig(prev => ({ ...prev, ...data.config }));
        setConfigSaved(true);
        setShowConfig(false);
        setSimMessages([{ role: 'agent', text: data.config.welcomeMessage || 'Bonjour ma chérie 👋 Tu cherches quel produit exactement ?', time: '14:30' }]);
      } else {
        setSimMessages([{ role: 'agent', text: "Bonjour ma chérie 👋 Tu cherches quel produit exactement ?", time: '14:30' }]);
      }
    } catch {
      setSimMessages([{ role: 'agent', text: "Bonjour ma chérie 👋 Tu cherches quel produit exactement ?", time: '14:30' }]);
    } finally { setLoadingConfig(false); }
  };

  const handleSave = async (overrideEnabled) => {
    const effectiveConfig = overrideEnabled !== undefined ? { ...config, enabled: overrideEnabled } : config;
    
    // Validation: si Rita est activé, une instance doit être sélectionnée
    if (effectiveConfig.enabled && !effectiveConfig.instanceId) {
      setSaveStatus({ type: 'error', message: 'Veuillez sélectionner une instance WhatsApp avant d\'activer Rita IA.' });
      setTimeout(() => setSaveStatus(null), 5000);
      return;
    }
    
    // Validation: vérifier que l'instance sélectionnée existe toujours
    if (effectiveConfig.instanceId && !instances.find(i => i._id === effectiveConfig.instanceId)) {
      setSaveStatus({ type: 'error', message: 'L\'instance sélectionnée n\'existe plus. Veuillez en sélectionner une autre.' });
      setTimeout(() => setSaveStatus(null), 5000);
      return;
    }
    
    setSaving(true); setSaveStatus(null);
    try {
      const { data } = await ecomApi.post('/v1/external/whatsapp/rita-config', { userId, config: effectiveConfig });
      if (!data.success) { setSaveStatus({ type: 'error', message: 'Erreur lors de la sauvegarde de la configuration.' }); return; }

      const { data: whData } = await ecomApi.post('/v1/external/whatsapp/activate', {
        userId,
        enabled: effectiveConfig.enabled,
        instanceId: effectiveConfig.instanceId || undefined,
      });
      const count = whData.configured ?? 0;
      setSaveStatus({ type: 'success', count });
      setConfigSaved(true);
      setShowConfig(false);
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) { 
      setSaveStatus({ type: 'error', message: err?.response?.data?.error || 'Erreur lors de la sauvegarde.' }); 
    }
    finally { setSaving(false); }
  };

  const toggleEnabled = async () => {
    const next = !config.enabled;
    set('enabled', next);
    await handleSave(next);
  };

  const set = (field, value) => setConfig(prev => ({ ...prev, [field]: value }));

  const addKw = () => {
    const kw = newKw.trim();
    if (kw && !config.autoReplyKeywords.includes(kw)) {
      set('autoReplyKeywords', [...config.autoReplyKeywords, kw]);
      setNewKw('');
    }
  };

  const addQuestion = () => {
    const q = newQuestion.trim();
    if (q) { set('qualificationQuestions', [...config.qualificationQuestions, q]); setNewQuestion(''); }
  };

  const addCommercialOffer = () => {
    const nextOffer = {
      title: '',
      appliesTo: '',
      trigger: 'hesitation',
      benefit: '',
      message: '',
      conditions: '',
      active: true,
    };
    set('commercialOffers', [...(config.commercialOffers || []), nextOffer]);
  };

  const updateCommercialOffer = (idx, field, value) => {
    const updated = (config.commercialOffers || []).map((offer, offerIdx) => (
      offerIdx === idx ? { ...offer, [field]: value } : offer
    ));
    set('commercialOffers', updated);
  };

  const removeCommercialOffer = (idx) => {
    set('commercialOffers', (config.commercialOffers || []).filter((_, offerIdx) => offerIdx !== idx));
  };

  const buildOfferFollowUpText = (offer) => {
    const parts = [offer?.benefit, offer?.message, offer?.conditions ? `Conditions: ${offer.conditions}` : '']
      .map(part => (part || '').trim())
      .filter(Boolean);
    return parts.join(' — ');
  };

  // ─── Product catalog helpers ───
  const addProduct = () => {
    const newP = { name: '', price: '', description: '', category: '', images: [], videos: [], features: [], faq: [], objections: [], inStock: true, minPrice: '', maxDiscountPercent: 0, priceNote: '' };
    set('productCatalog', [...config.productCatalog, newP]);
    setEditingProduct(config.productCatalog.length);
  };

  const toggleSelectProduct = (idx) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedProducts.size === config.productCatalog.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(config.productCatalog.map((_, i) => i)));
    }
  };
  const deleteSelectedProducts = () => {
    if (selectedProducts.size === 0) return;
    const updated = config.productCatalog.filter((_, i) => !selectedProducts.has(i));
    set('productCatalog', updated);
    setSelectedProducts(new Set());
    setEditingProduct(null);
  };

  const parseBulkProducts = () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      // Supporte séparateurs : | ; , (tab)
      const sep = line.includes('|') ? '|' : line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
      const parts = line.split(sep).map(p => p.trim());
      const name = parts[0] || '';
      if (!name) continue;
      parsed.push({
        name,
        price: parts[1] || '',
        category: parts[2] || '',
        description: parts[3] || '',
        images: [], videos: [], features: [], faq: [], objections: [], inStock: true, minPrice: '', maxDiscountPercent: 0, priceNote: '',
      });
    }
    if (!parsed.length) return;
    set('productCatalog', [...config.productCatalog, ...parsed]);
    setBulkImportResult(parsed.length);
    setBulkText('');
    setTimeout(() => { setBulkImportResult(null); setShowBulkImport(false); }, 2000);
  };
  const updateProduct = (idx, field, val) => {
    const updated = config.productCatalog.map((p, i) => i === idx ? { ...p, [field]: val } : p);
    set('productCatalog', updated);
  };
  const removeProduct = (idx) => {
    set('productCatalog', config.productCatalog.filter((_, i) => i !== idx));
    if (editingProduct === idx) setEditingProduct(null);
    else if (editingProduct > idx) setEditingProduct(editingProduct - 1);
    setSelectedProducts(prev => {
      const next = new Set();
      prev.forEach(i => { if (i !== idx) next.add(i > idx ? i - 1 : i); });
      return next;
    });
  };
  const addProductFaq = (idx) => {
    const p = config.productCatalog[idx];
    updateProduct(idx, 'faq', [...(p.faq || []), { question: '', answer: '' }]);
  };
  const updateProductFaq = (pIdx, fIdx, field, val) => {
    const p = config.productCatalog[pIdx];
    const faq = p.faq.map((f, i) => i === fIdx ? { ...f, [field]: val } : f);
    updateProduct(pIdx, 'faq', faq);
  };
  const removeProductFaq = (pIdx, fIdx) => {
    updateProduct(pIdx, 'faq', config.productCatalog[pIdx].faq.filter((_, i) => i !== fIdx));
  };
  const addProductObjection = (idx) => {
    const p = config.productCatalog[idx];
    updateProduct(idx, 'objections', [...(p.objections || []), { objection: '', response: '' }]);
  };
  const updateProductObjection = (pIdx, oIdx, field, val) => {
    const p = config.productCatalog[pIdx];
    const obj = p.objections.map((o, i) => i === oIdx ? { ...o, [field]: val } : o);
    updateProduct(pIdx, 'objections', obj);
  };
  const removeProductObjection = (pIdx, oIdx) => {
    updateProduct(pIdx, 'objections', config.productCatalog[pIdx].objections.filter((_, i) => i !== oIdx));
  };
  const addProductImage = (idx) => {
    const p = config.productCatalog[idx];
    updateProduct(idx, 'images', [...(p.images || []), '']);
  };
  const updateProductImage = (pIdx, iIdx, val) => {
    const imgs = config.productCatalog[pIdx].images.map((url, i) => i === iIdx ? val : url);
    updateProduct(pIdx, 'images', imgs);
  };
  const removeProductImage = (pIdx, iIdx) => {
    updateProduct(pIdx, 'images', config.productCatalog[pIdx].images.filter((_, i) => i !== iIdx));
  };
  const addProductVideo = (idx) => {
    const p = config.productCatalog[idx];
    updateProduct(idx, 'videos', [...(p.videos || []), '']);
  };
  const updateProductVideo = (pIdx, vIdx, val) => {
    const vids = config.productCatalog[pIdx].videos.map((url, i) => i === vIdx ? val : url);
    updateProduct(pIdx, 'videos', vids);
  };
  const removeProductVideo = (pIdx, vIdx) => {
    updateProduct(pIdx, 'videos', config.productCatalog[pIdx].videos.filter((_, i) => i !== vIdx));
  };
  const addProductFeature = (idx, feat) => {
    if (!feat.trim()) return;
    const p = config.productCatalog[idx];
    updateProduct(idx, 'features', [...(p.features || []), feat.trim()]);
  };
  const removeProductFeature = (pIdx, fIdx) => {
    updateProduct(pIdx, 'features', config.productCatalog[pIdx].features.filter((_, i) => i !== fIdx));
  };

  // ─── Personality helpers ───
  const setPersonality = (field, val) => set('personality', { ...config.personality, [field]: val });
  const addMannerism = () => {
    const m = newMannerism.trim();
    if (m) { setPersonality('mannerisms', [...(config.personality.mannerisms || []), m]); setNewMannerism(''); }
  };
  const addForbidden = () => {
    const f = newForbidden.trim();
    if (f) { setPersonality('forbiddenPhrases', [...(config.personality.forbiddenPhrases || []), f]); setNewForbidden(''); }
  };
  const addConversationExample = () => {
    set('conversationExamples', [...config.conversationExamples, { customer: '', agent: '' }]);
  };
  const updateConvExample = (idx, field, val) => {
    const updated = config.conversationExamples.map((e, i) => i === idx ? { ...e, [field]: val } : e);
    set('conversationExamples', updated);
  };
  const removeConvExample = (idx) => {
    set('conversationExamples', config.conversationExamples.filter((_, i) => i !== idx));
  };
  const addBehaviorRule = () => {
    set('behaviorRules', [...config.behaviorRules, { situation: '', reaction: '' }]);
  };
  const updateBehaviorRule = (idx, field, val) => {
    const updated = config.behaviorRules.map((r, i) => i === idx ? { ...r, [field]: val } : r);
    set('behaviorRules', updated);
  };
  const removeBehaviorRule = (idx) => {
    set('behaviorRules', config.behaviorRules.filter((_, i) => i !== idx));
  };

  const handleSimSend = async () => {
    if (!simInput.trim() || simTyping) return;
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const userText = simInput.trim();
    setSimMessages(prev => [...prev, { role: 'user', text: userText, time: now }]);
    setSimInput('');
    setSimTyping(true);

    try {
      // Construire l'historique pour l'API (sans les timestamps)
      const apiMessages = [...simMessages, { role: 'user', text: userText }]
        .filter(m => m.text)
        .map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text }));

      const { data } = await ecomApi.post('/v1/external/whatsapp/test-chat', {
        userId,
        messages: apiMessages,
      });

      const nowResp = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setSimTyping(false);

      if (data.success && data.reply) {
        setSimMessages(prev => [...prev, { role: 'agent', text: data.reply, time: nowResp }]);
      } else {
        setSimMessages(prev => [...prev, { role: 'agent', text: '⚠️ Erreur : aucune réponse de l\'IA. Vérifiez la configuration.', time: nowResp }]);
      }
    } catch (err) {
      const nowResp = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setSimTyping(false);
      setSimMessages(prev => [...prev, { role: 'agent', text: `❌ Erreur : ${err.response?.data?.error || err.message}`, time: nowResp }]);
    }
  };

  const resetSim = () => {
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setSimMessages([{ role: 'agent', text: config.welcomeMessage || 'Bonjour ma chérie 👋 Tu cherches quel produit exactement ?', time: now }]);
    setSimTyping(false);
  };

  const autonomyInfo = AUTONOMY_LEVELS.find(a => a.level === config.autonomyLevel) || AUTONOMY_LEVELS[2];

  // Compteur de champs remplis
  const totalSteps = 7;
  const filledSteps = [
    config.agentName && config.agentRole,
    config.autonomyLevel > 0,
    config.productCatalog?.length > 0,
    config.businessContext || config.products || config.faq,
    config.conversationExamples?.length > 0 || config.personality?.description,
    config.qualificationQuestions.length > 0 || config.objectionsHandling,
    true, // disponibilité = toujours OK
  ].filter(Boolean).length;
  const progressPct = Math.round((filledSteps / totalSteps) * 100);

  useEffect(() => {
    if (externalPanel === 'notifications' || externalPanel === 'rapport') {
      setTopPanel(externalPanel);
      return;
    }
    setTopPanel(null);
  }, [externalPanel]);

  if (loadingConfig) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-purple-200/60 animate-pulse">
          <Bot className="w-7 h-7 text-white" />
        </div>
        <span className="text-[13px] text-gray-400 font-medium">Chargement de Rita...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ═══════════ AGENT STATUS BANNER ═══════════ */}
      <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${configSaved && config.enabled ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/50' : configSaved ? 'border-gray-200/80 bg-white' : 'border-purple-200/80 bg-gradient-to-r from-purple-50/60 via-white to-indigo-50/40'}`}>
        {configSaved && config.enabled && <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />}
        {!configSaved && <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-400 via-indigo-500 to-purple-400" />}

        <div className="px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Agent avatar + info */}
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-lg ${configSaved && config.enabled ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200/60' : 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-200/60'}`}>
                {config.agentName?.[0]?.toUpperCase() || 'R'}
                {configSaved && config.enabled && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
                    <CheckCircle className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-bold text-gray-900">{config.agentName || 'Rita'}</h2>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${autonomyInfo.color}`}>{autonomyInfo.label}</span>
                  {configSaved && config.enabled ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Actif
                    </span>
                  ) : configSaved ? (
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Pause</span>
                  ) : (
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">Non configuré</span>
                  )}
                </div>
                <p className="text-[11.5px] text-gray-400 mt-0.5">
                  {config.agentRole || 'Agent commercial IA'} · {config.language === 'fr' ? '🇫🇷' : config.language === 'en' ? '🇬🇧' : config.language === 'fr_en' ? '🇫🇷🇬🇧' : config.language === 'es' ? '🇪🇸' : '🇲🇦'} {config.language === 'fr' ? 'Français' : config.language === 'en' ? 'English' : config.language === 'fr_en' ? 'FR + EN' : config.language === 'es' ? 'Español' : 'العربية'}
                  {configSaved && ` · ${instances.length} instance${instances.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {configSaved && (
                <div className="flex items-center gap-2 text-[12px] text-gray-500">
                  <span className="text-[11px] font-medium">{config.enabled ? 'On' : 'Off'}</span>
                  <button onClick={toggleEnabled} disabled={saving} type="button"
                    role="switch" aria-checked={config.enabled} aria-label={config.enabled ? 'Désactiver' : 'Activer'}
                    className={`relative w-[48px] h-[28px] rounded-full transition-all duration-200 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 ${config.enabled ? 'bg-emerald-500' : 'bg-gray-200 hover:bg-gray-300'}`}>
                    <span className={`absolute top-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-md transition-all duration-200 ${config.enabled ? 'left-[23px]' : 'left-[3px]'}`} />
                  </button>
                </div>
              )}
              {/* Save status */}
              <div className="flex items-center gap-2">
                {saveStatus?.type === 'success' && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Enregistré
                  </span>
                )}
                {saveStatus?.type === 'error' && (
                  <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1" title={saveStatus?.message}>
                    <AlertCircle className="w-3 h-3" />
                    {saveStatus?.message || 'Erreur'}
                  </span>
                )}
                <button onClick={() => handleSave()} disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white rounded-xl disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {saving ? 'Sauvegarde...' : configSaved ? 'Sauvegarder' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {topPanel === 'notifications' && (
        <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/40 flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold text-gray-900 flex items-center gap-2"><span>🔔</span> Notifications boss</p>
              <p className="text-[11.5px] text-gray-400 mt-0.5">Alerte WhatsApp et rapport quotidien envoyés au responsable.</p>
            </div>
            <button
              type="button"
              onClick={() => onExternalPanelChange?.(null)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Fermer
            </button>
          </div>
          <div className="p-5 space-y-4">
            <ToggleRow enabled={config.bossNotifications} onChange={v => set('bossNotifications', v)}
              label="Activer les notifications boss"
              desc="Rita envoie des alertes WhatsApp au responsable (commandes confirmées, rapport quotidien)" />
            {config.bossNotifications && (
              <>
                <Field label="Numéro WhatsApp du boss" hint="Format international ex: 237699887766">
                  <div className="flex gap-2">
                    <input type="tel" value={config.bossPhone || ''} onChange={e => { set('bossPhone', e.target.value); setTestBossResult(null); }}
                      placeholder="237699887766" className="field-input flex-1" />
                    <button onClick={handleTestBossNotif} disabled={testingBoss}
                      className="px-3 py-2 text-[12px] font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5 transition-all">
                      {testingBoss ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Test...</> : '📤 Tester'}
                    </button>
                  </div>
                  {testBossResult && (
                    <p className={`mt-1.5 text-[11.5px] font-medium ${testBossResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                      {testBossResult.msg}
                    </p>
                  )}
                </Field>
                <div className="space-y-2 pt-1">
                  <ToggleRow enabled={config.notifyOnOrder} onChange={v => set('notifyOnOrder', v)}
                    label="Notification à chaque commande"
                    desc="Rita prévient le boss dès qu'une commande est confirmée avec tous les détails" />
                  <ToggleRow enabled={config.notifyOnScheduled} onChange={v => set('notifyOnScheduled', v)}
                    label="Notification commande planifiée"
                    desc="Alerte quand un client programme une livraison à une date précise" />
                  <ToggleRow enabled={config.dailySummary} onChange={v => set('dailySummary', v)}
                    label="Rapport quotidien automatique"
                    desc="Résumé WhatsApp en fin de journée : commandes, messages, CA du jour" />
                </div>
                {config.dailySummary && (
                  <Field label="Heure du rapport quotidien">
                    <input type="time" value={config.dailySummaryTime || '20:00'} onChange={e => set('dailySummaryTime', e.target.value)}
                      className="field-input" />
                  </Field>
                )}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <p className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5">🤝 Escalade — questions sans réponse</p>
                  <ToggleRow enabled={config.bossEscalationEnabled} onChange={v => set('bossEscalationEnabled', v)}
                    label="Demander au boss si Rita ne sait pas"
                    desc="Quand Rita n'a pas de réponse précise, elle alerte le boss. Sa réponse est renvoyée automatiquement au client." />
                  {config.bossEscalationEnabled && (
                    <Field label="Délai avant que Rita improvise (minutes)" hint="Si le boss ne répond pas dans ce délai, Rita improvise">
                      <input type="number" min={5} max={120} value={config.bossEscalationTimeoutMin || 30}
                        onChange={e => set('bossEscalationTimeoutMin', Math.max(5, parseInt(e.target.value) || 30))}
                        className="field-input w-28" />
                    </Field>
                  )}
                </div>
                <div className="px-4 py-3 bg-purple-50 border border-purple-100 rounded-lg">
                  <p className="text-[12px] text-purple-700">
                    📱 Rita enverra les notifications via la même instance WhatsApp connectée. Assurez-vous que le numéro du boss est correct.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {topPanel === 'rapport' && (
        <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] p-1">
          <div className="px-4 pt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold text-gray-900 flex items-center gap-2"><span>📊</span> Rapport Rita</p>
              <p className="text-[11.5px] text-gray-400 mt-0.5">Vue d'activité et performances de l'agent.</p>
            </div>
            <button
              type="button"
              onClick={() => onExternalPanelChange?.(null)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Fermer
            </button>
          </div>
          <RitaRapportSection userId={userId} />
        </div>
      )}

      {/* ═══════════ PROGRESS BAR (only before first save) ═══════════ */}
      {!configSaved && (
        <div className="bg-white border border-gray-200/80 rounded-2xl px-5 py-3.5 shadow-[0_1px_6px_-2px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold text-gray-600">Progression</p>
            <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* ═══════════ MAIN LAYOUT: NAV + CONTENT (ALWAYS VISIBLE) ═══════════ */}
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-visible shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">

        {/* ── Section Navigation (pill tabs, always visible) ── */}
        <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/30">
          <div className="flex gap-1 overflow-x-auto rita-section-nav">
            {RITA_SECTIONS.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap rounded-xl transition-all duration-200
                  ${activeSection === s.id
                    ? 'text-purple-700 bg-white shadow-sm ring-1 ring-black/[0.04]'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-white/60'}`}>
                <span className="text-[13px] leading-none">{s.emoji}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Section Content ── */}
        <div className="p-5 sm:p-6">

            {/* Identité */}
            {activeSection === 'identity' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nom de l'agent" required>
                    <input value={config.agentName} onChange={e => set('agentName', e.target.value)} placeholder="Rita" className="field-input" />
                  </Field>
                  <Field label="Rôle affiché au client">
                    <input value={config.agentRole} onChange={e => set('agentRole', e.target.value)} placeholder="Commerciale IA" className="field-input" />
                  </Field>
                  <Field label="Langue principale">
                    <CustomSelect
                      value={config.language}
                      onChange={v => set('language', v)}
                      options={[
                        { value: 'fr', label: '🇫🇷 Français' },
                        { value: 'en', label: '🇬🇧 English' },
                        { value: 'fr_en', label: '🇫🇷🇬🇧 Français + English (auto)' },
                        { value: 'es', label: '🇪🇸 Español' },
                        { value: 'ar', label: '🇲🇦 العربية' },
                      ]}
                    />
                  </Field>
                  <div className="col-span-full">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <button type="button" onClick={() => set('autoLanguageDetection', !config.autoLanguageDetection)}
                        role="switch" aria-checked={config.autoLanguageDetection !== false}
                        className={`relative w-[44px] h-[26px] rounded-full transition-all duration-200 ${config.autoLanguageDetection !== false ? 'bg-emerald-500' : 'bg-gray-200 hover:bg-gray-300'}`}>
                        <span className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${config.autoLanguageDetection !== false ? 'left-[21px]' : 'left-[3px]'}`} />
                      </button>
                      <div>
                        <span className="text-[12px] text-gray-700 font-medium">🌍 Détection automatique de langue</span>
                        <p className="text-[10px] text-gray-400">Si le client change de langue en cours de conversation, Rita s'adapte automatiquement</p>
                      </div>
                    </label>
                  </div>
                  <Field label="Ton de communication">
                    <CustomSelect
                      value={config.toneStyle}
                      onChange={v => set('toneStyle', v)}
                      options={[
                        { value: 'warm', label: '🤗 Tutoiement chaleureux' },
                        { value: 'professional', label: '💼 Tutoiement professionnel' },
                        { value: 'casual', label: '😎 Tutoiement décontracté' },
                        { value: 'formal', label: '🤝 Vouvoiement respectueux' },
                        { value: 'luxury', label: '✨ Vouvoiement premium' },
                        { value: 'humorous', label: '😄 Humoristique légère' },
                        { value: 'persuasive', label: '🎯 Persuasif et direct' },
                      ]}
                    />
                  </Field>
                  <Field label="Délai avant de répondre" hint="secondes">
                    <input type="number" value={config.responseDelay} onChange={e => set('responseDelay', parseInt(e.target.value) || 0)} min="0" max="30" className="field-input" />
                  </Field>
                  <Field label="Instance WhatsApp" required>
                    <CustomSelect
                      value={config.instanceId}
                      onChange={v => set('instanceId', v)}
                      placeholder="Sélectionner une instance..."
                      options={instances.map(inst => ({ value: inst._id, label: inst.customName || inst.instanceName }))}
                    />
                    {instances.length === 0 && <p className="text-[11px] text-amber-600 mt-1.5">⚠️ Ajoutez une instance dans l'onglet Instances d'abord.</p>}
                    {instances.length > 0 && !config.instanceId && <p className="text-[11px] text-amber-600 mt-1.5">⚠️ Sélectionnez une instance pour activer Rita IA.</p>}
                    {config.instanceId && !instances.find(i => i._id === config.instanceId) && <p className="text-[11px] text-red-600 mt-1.5">⚠️ L'instance sélectionnée n'existe plus. Veuillez en sélectionner une autre.</p>}
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 pt-1">
                  <ToggleRow enabled={config.useEmojis} onChange={v => set('useEmojis', v)} label="Utiliser des emojis" desc="Rend les messages plus chaleureux et humains" />
                  <ToggleRow enabled={config.signMessages} onChange={v => set('signMessages', v)} label="Signer les messages" desc={`Ajoute — ${config.agentName || 'Rita'} en fin de message`} />
                </div>
                <div className="space-y-3">
                  <Field label="Message d'accueil">
                    <textarea value={config.welcomeMessage} onChange={e => set('welcomeMessage', e.target.value)} rows={3}
                      placeholder="Bonjour ! Je suis Rita 👋 Comment puis-je vous aider ?"
                      className="field-input" style={{ resize: 'none' }} />
                  </Field>
                  <Field label="Message de transfert humain" hint="quand Rita passe la main">
                    <textarea value={config.fallbackMessage} onChange={e => set('fallbackMessage', e.target.value)} rows={2}
                      placeholder="Je transfère votre demande à un conseiller..."
                      className="field-input" style={{ resize: 'none' }} />
                  </Field>
                </div>
              </div>
            )}

            {/* Intelligence */}
            {activeSection === 'intelligence' && (
              <div className="space-y-6">
                <div>
                  <p className="text-[14px] font-bold text-gray-900 mb-0.5">Niveau d'autonomie</p>
                  <p className="text-[12px] text-gray-400 mb-4">Contrôlez jusqu'où Rita peut aller sans intervention humaine</p>
                  <div className="space-y-2.5">
                    {AUTONOMY_LEVELS.map(lvl => (
                      <button key={lvl.level} onClick={() => set('autonomyLevel', lvl.level)}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 text-left transition-all duration-200 ${
                          config.autonomyLevel === lvl.level ? 'border-purple-400 bg-purple-50/70 shadow-sm shadow-purple-100' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                        }`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-transform duration-200 ${config.autonomyLevel === lvl.level ? 'scale-110' : ''} ${lvl.color}`}>{lvl.level}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-[13px]">{lvl.label}</span>
                            {config.autonomyLevel === lvl.level && <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2.5 py-0.5 rounded-full">Actif</span>}
                          </div>
                          <p className="text-[12px] text-gray-400 mt-0.5">{lvl.desc}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all duration-200 flex items-center justify-center ${config.autonomyLevel === lvl.level ? 'border-purple-500 bg-purple-500' : 'border-gray-300'}`}>
                          {config.autonomyLevel === lvl.level && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5 space-y-3">
                  <p className="text-[14px] font-bold text-gray-900 mb-3">Permissions</p>
                  <ToggleRow enabled={config.canCloseDeals} onChange={v => set('canCloseDeals', v)} label="Peut confirmer des commandes" desc="Rita peut valider et enregistrer une vente sans intervention humaine" />
                  <ToggleRow enabled={config.canSendPaymentLinks} onChange={v => set('canSendPaymentLinks', v)} label="Peut envoyer des liens de paiement" desc="Envoie automatiquement le lien de checkout au client" />
                  <ToggleRow enabled={config.requireHumanApproval} onChange={v => set('requireHumanApproval', v)} label="Validation humaine avant offre commerciale" desc="Notifie un agent avant d'envoyer un prix ou une offre" />
                </div>

                <div className="border-t border-gray-100 pt-5 space-y-3">
                  <p className="text-[14px] font-bold text-gray-900 mb-3">Relances automatiques</p>
                  <ToggleRow enabled={config.followUpEnabled} onChange={v => set('followUpEnabled', v)} label="Activer les relances" desc="Rita relance automatiquement les prospects silencieux" />
                  {config.followUpEnabled && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Relancer après" hint="heures sans réponse">
                          <input type="number" value={config.followUpDelay} onChange={e => set('followUpDelay', parseInt(e.target.value) || 24)} min="1" className="field-input" />
                        </Field>
                        <Field label="Nombre max de relances" hint="par prospect">
                          <input type="number" value={config.followUpMaxRelances} onChange={e => set('followUpMaxRelances', parseInt(e.target.value) || 3)} min="1" max="10" className="field-input" />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Escalader après" hint="messages sans réponse">
                          <input type="number" value={config.escalateAfterMessages} onChange={e => set('escalateAfterMessages', parseInt(e.target.value) || 10)} min="1" className="field-input" />
                        </Field>
                      </div>
                      <Field label="Message de relance (1ère relance)">
                        <textarea value={config.followUpMessage} onChange={e => set('followUpMessage', e.target.value)} rows={2}
                          placeholder="Bonjour ! Tu as eu le temps de réfléchir ?"
                          className="field-input" style={{ resize: 'none' }} />
                      </Field>
                      <Field label="Messages de relance personnalisés" hint="un par ligne, dans l'ordre des relances">
                        <textarea
                          value={(config.followUpRelanceMessages || []).join('\n')}
                          onChange={e => set('followUpRelanceMessages', e.target.value.split('\n').filter(m => m.trim()))}
                          rows={4}
                          placeholder={"Hey ! Tu as eu le temps de voir ? 😊\nUne cliente vient de commander le même, elle est ravie !\nDernière relance, je ne veux pas te déranger 🙏"}
                          className="field-input text-xs" style={{ resize: 'vertical' }} />
                      </Field>
                      <Field label="Offre spéciale dernière relance" hint="optionnel — proposé en dernière chance">
                        <input value={config.followUpOffer || ''} onChange={e => set('followUpOffer', e.target.value)}
                          placeholder="Livraison gratuite si tu commandes aujourd'hui !"
                          className="field-input" />
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Catalogue Produits ─── */}
            {activeSection === 'products' && (
              <div className="space-y-4">
                <div className="px-4 py-3 bg-purple-50/80 border border-purple-100 rounded-2xl text-[12px] text-purple-800 flex gap-2.5 items-start">
                  <span className="flex-shrink-0 text-sm mt-0.5">🛒</span>
                  <span>Ajoutez vos produits avec tous les détails : prix, description, images, vidéos, FAQ et objections. Plus c'est complet, plus l'agent est efficace.</span>
                </div>

                {/* ── Barre multi-sélection ── */}
                {config.productCatalog.length > 0 && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-[12px] text-gray-500 hover:text-gray-700">
                      <input type="checkbox"
                        checked={selectedProducts.size > 0 && selectedProducts.size === config.productCatalog.length}
                        ref={el => { if (el) el.indeterminate = selectedProducts.size > 0 && selectedProducts.size < config.productCatalog.length; }}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 accent-purple-600" />
                      {selectedProducts.size === 0 ? 'Tout sélectionner' : `${selectedProducts.size} sélectionné${selectedProducts.size > 1 ? 's' : ''}`}
                    </label>
                    {selectedProducts.size > 0 && (
                      <button onClick={deleteSelectedProducts}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-[11px] font-semibold transition-colors">
                        <Trash2 className="w-3 h-3" />
                        Supprimer la sélection
                      </button>
                    )}
                  </div>
                )}

                {config.productCatalog.map((product, pIdx) => (
                  <div key={pIdx} className={`border rounded-xl overflow-hidden bg-white transition-colors ${selectedProducts.has(pIdx) ? 'border-purple-400 ring-1 ring-purple-200' : 'border-gray-200'}`}>
                    {/* Product header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer"
                      onClick={() => setEditingProduct(editingProduct === pIdx ? null : pIdx)}>
                      <input type="checkbox" checked={selectedProducts.has(pIdx)}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleSelectProduct(pIdx)}
                        className="w-4 h-4 accent-purple-600 flex-shrink-0" />
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 text-[12px] font-bold flex items-center justify-center flex-shrink-0">
                        {pIdx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{product.name || 'Nouveau produit'}</p>
                        <p className="text-[11px] text-gray-400">
                          {product.price ? `${product.price}` : 'Prix non défini'}
                          {product.category ? ` · ${product.category}` : ''}
                          {product.images?.length ? ` · 📸 ${product.images.length}` : ''}
                          {product.videos?.length ? ` · 🎬 ${product.videos.length}` : ''}
                          {product.faq?.length ? ` · ${product.faq.length} FAQ` : ''}
                          {product.objections?.length ? ` · ${product.objections.length} obj.` : ''}
                          {!product.inStock ? ' · 🔴 Rupture' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-gray-400">{editingProduct === pIdx ? '▲' : '▼'}</span>
                        <button onClick={e => { e.stopPropagation(); removeProduct(pIdx); }}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Product expanded details */}
                    {editingProduct === pIdx && (
                      <div className="p-4 space-y-4">
                        {/* Basic info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Nom du produit" required>
                            <input value={product.name} onChange={e => updateProduct(pIdx, 'name', e.target.value)}
                              placeholder="Sérum Éclat" className="field-input" />
                          </Field>
                          <Field label="Prix" hint="avec devise">
                            <input value={product.price} onChange={e => updateProduct(pIdx, 'price', e.target.value)}
                              placeholder="15 000 FCFA" className="field-input" />
                          </Field>
                          <Field label="Catégorie">
                            <input value={product.category} onChange={e => updateProduct(pIdx, 'category', e.target.value)}
                              placeholder="Soins visage" className="field-input" />
                          </Field>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <button type="button" onClick={() => updateProduct(pIdx, 'inStock', !product.inStock)}
                                role="switch" aria-checked={product.inStock} aria-label="En stock"
                                className={`relative w-[44px] h-[26px] rounded-full transition-all duration-200 ${product.inStock ? 'bg-emerald-500' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                <span className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${product.inStock ? 'left-[21px]' : 'left-[3px]'}`} />
                              </button>
                              <span className="text-[12px] text-gray-600 font-medium">{product.inStock ? '🟢 En stock' : '🔴 Rupture'}</span>
                            </label>
                          </div>
                        </div>

                        {/* Pricing negotiation per product */}
                        {config.pricingNegotiation?.enabled && (
                          <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-3">
                            <p className="text-[12px] font-semibold text-amber-700">💰 Négociation prix</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Field label="Dernier prix" hint="prix plancher">
                                <input value={product.minPrice || ''} onChange={e => updateProduct(pIdx, 'minPrice', e.target.value)}
                                  placeholder="ex: 12 000 FCFA" className="field-input text-xs" />
                              </Field>
                              <Field label="Réduction max %" hint="0 = pas de réduction">
                                <input type="number" min="0" max="100" value={product.maxDiscountPercent || 0}
                                  onChange={e => updateProduct(pIdx, 'maxDiscountPercent', parseInt(e.target.value) || 0)}
                                  className="field-input text-xs" />
                              </Field>
                              <Field label="Note prix" hint="consigne spécifique">
                                <input value={product.priceNote || ''} onChange={e => updateProduct(pIdx, 'priceNote', e.target.value)}
                                  placeholder="ex: Offrir livraison si ≥2" className="field-input text-xs" />
                              </Field>
                            </div>
                          </div>
                        )}

                        <Field label="Description">
                          <textarea value={product.description} onChange={e => updateProduct(pIdx, 'description', e.target.value)}
                            rows={2} placeholder="Anti-taches, illuminateur de teint, résultats visibles en 2 semaines"
                            className="field-input text-xs" style={{ resize: 'vertical' }} />
                        </Field>

                        {/* Features */}
                        <div>
                          <p className="text-[12px] font-semibold text-gray-700 mb-2">Caractéristiques</p>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {(product.features || []).map((f, fIdx) => (
                              <span key={fIdx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-medium border border-emerald-100">
                                {f}
                                <button onClick={() => removeProductFeature(pIdx, fIdx)} className="text-emerald-400 hover:text-red-500 ml-0.5">×</button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input placeholder="ex: 100% naturel, Sans paraben..."
                              className="field-input flex-1 text-xs"
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProductFeature(pIdx, e.target.value); e.target.value = ''; } }} />
                            <button onClick={e => { const input = e.currentTarget.previousElementSibling; addProductFeature(pIdx, input.value); input.value = ''; }}
                              className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex-shrink-0" style={{ background: '#7c3aed' }}>+</button>
                          </div>
                        </div>

                        {/* Images */}
                        <div>
                          <p className="text-[12px] font-semibold text-gray-700 mb-2">📸 Photos du produit</p>
                          {(product.images || []).map((url, iIdx) => (
                            <div key={iIdx} className="flex gap-2 mb-2 items-center">
                              <input value={url} onChange={e => updateProductImage(pIdx, iIdx, e.target.value)}
                                placeholder="https://exemple.com/photo-produit.jpg"
                                className="field-input flex-1 text-xs font-mono" />
                              {url && <img src={url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0" onError={e => e.target.style.display = 'none'} />}
                              <button onClick={() => removeProductImage(pIdx, iIdx)}
                                className="text-gray-300 hover:text-red-500 flex-shrink-0">×</button>
                            </div>
                          ))}
                          <div className="flex items-center gap-3 mt-1">
                            <button onClick={() => addProductImage(pIdx)}
                              className="text-[11px] font-medium text-purple-600 hover:text-purple-800">+ URL</button>
                            <span className="text-gray-300 text-[11px]">|</span>
                            <label className="text-[11px] font-medium text-emerald-600 hover:text-emerald-800 cursor-pointer flex items-center gap-1">
                              <input type="file" accept="image/*" className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const fd = new FormData();
                                  fd.append('image', file);
                                  try {
                                    const { data } = await ecomApi.post('/v1/external/whatsapp/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                    if (data.success && data.url) {
                                      const existingImages = product.images || [];
                                      updateProduct(pIdx, 'images', [...existingImages, data.url]);
                                    }
                                  } catch (err) {
                                    alert('Erreur upload: ' + (err.response?.data?.error || err.message));
                                  }
                                  e.target.value = '';
                                }} />
                              📤 Uploader une photo
                            </label>
                          </div>
                        </div>

                        {/* Videos */}
                        <div>
                          <p className="text-[12px] font-semibold text-gray-700 mb-2">🎬 Vidéos du produit</p>
                          <p className="text-[10px] text-gray-400 mb-2">Rita envoie la vidéo quand le client hésite ou veut voir le produit en action.</p>
                          {(product.videos || []).map((url, vIdx) => (
                            <div key={vIdx} className="flex gap-2 mb-2 items-center">
                              <input value={url} onChange={e => updateProductVideo(pIdx, vIdx, e.target.value)}
                                placeholder="https://exemple.com/video-produit.mp4"
                                className="field-input flex-1 text-xs font-mono" />
                              {url && (
                                <a href={url} target="_blank" rel="noreferrer"
                                  className="text-[10px] text-blue-500 hover:underline flex-shrink-0">▶</a>
                              )}
                              <button onClick={() => removeProductVideo(pIdx, vIdx)}
                                className="text-gray-300 hover:text-red-500 flex-shrink-0">×</button>
                            </div>
                          ))}
                          <div className="flex items-center gap-3 mt-1">
                            <button onClick={() => addProductVideo(pIdx)}
                              className="text-[11px] font-medium text-purple-600 hover:text-purple-800">+ URL vidéo</button>
                            <span className="text-gray-300 text-[11px]">|</span>
                            <label className="text-[11px] font-medium text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1">
                              <input type="file" accept="video/*" className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const fd = new FormData();
                                  fd.append('video', file);
                                  try {
                                    const { data } = await ecomApi.post('/v1/external/whatsapp/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                    if (data.success && data.url) {
                                      const existingVideos = product.videos || [];
                                      updateProduct(pIdx, 'videos', [...existingVideos, data.url]);
                                    }
                                  } catch (err) {
                                    alert('Erreur upload vidéo: ' + (err.response?.data?.error || err.message));
                                  }
                                  e.target.value = '';
                                }} />
                              📤 Uploader une vidéo
                            </label>
                          </div>
                        </div>

                        {/* Per-product FAQ */}
                        <div>
                          <p className="text-[12px] font-semibold text-gray-700 mb-2">❓ FAQ de ce produit</p>
                          {(product.faq || []).map((f, fIdx) => (
                            <div key={fIdx} className="border border-gray-100 rounded-lg p-3 mb-2 bg-gray-50 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Q{fIdx + 1}</span>
                                <input value={f.question} onChange={e => updateProductFaq(pIdx, fIdx, 'question', e.target.value)}
                                  placeholder="Question fréquente sur ce produit..."
                                  className="field-input flex-1 text-xs" />
                                <button onClick={() => removeProductFaq(pIdx, fIdx)} className="text-gray-300 hover:text-red-500">×</button>
                              </div>
                              <div className="flex items-start gap-2 pl-8">
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded mt-1">R</span>
                                <textarea value={f.answer} onChange={e => updateProductFaq(pIdx, fIdx, 'answer', e.target.value)}
                                  placeholder="Réponse que Rita doit donner..."
                                  rows={2} className="field-input flex-1 text-xs" style={{ resize: 'none' }} />
                              </div>
                            </div>
                          ))}
                          <button onClick={() => addProductFaq(pIdx)}
                            className="text-[11px] font-medium text-purple-600 hover:text-purple-800">+ Ajouter une FAQ</button>
                        </div>

                        {/* Per-product objections */}
                        <div>
                          <p className="text-[12px] font-semibold text-gray-700 mb-2">🛡️ Objections de ce produit</p>
                          {(product.objections || []).map((o, oIdx) => (
                            <div key={oIdx} className="border border-gray-100 rounded-lg p-3 mb-2 bg-gray-50 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">Obj</span>
                                <input value={o.objection} onChange={e => updateProductObjection(pIdx, oIdx, 'objection', e.target.value)}
                                  placeholder="ex: C'est trop cher"
                                  className="field-input flex-1 text-xs" />
                                <button onClick={() => removeProductObjection(pIdx, oIdx)} className="text-gray-300 hover:text-red-500">×</button>
                              </div>
                              <div className="flex items-start gap-2 pl-8">
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded mt-1">→</span>
                                <textarea value={o.response} onChange={e => updateProductObjection(pIdx, oIdx, 'response', e.target.value)}
                                  placeholder="Réponse pour contrer cette objection..."
                                  rows={2} className="field-input flex-1 text-xs" style={{ resize: 'none' }} />
                              </div>
                            </div>
                          ))}
                          <button onClick={() => addProductObjection(pIdx)}
                            className="text-[11px] font-medium text-purple-600 hover:text-purple-800">+ Ajouter une objection</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* ── Import en masse ── */}
                {showBulkImport && (
                  <div className="border-2 border-dashed border-emerald-300 rounded-xl p-4 bg-emerald-50 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-bold text-emerald-800">📋 Import en masse</p>
                        <p className="text-[11px] text-emerald-600 mt-0.5">Une ligne = un produit. Format : <strong>Nom | Prix | Catégorie | Description</strong></p>
                        <p className="text-[10px] text-emerald-500 mt-0.5">Séparateurs acceptés : | ; , ou tabulation. Seul le Nom est obligatoire.</p>
                      </div>
                      <button onClick={() => setShowBulkImport(false)} className="text-emerald-400 hover:text-emerald-700 text-lg leading-none flex-shrink-0">×</button>
                    </div>
                    <textarea
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      rows={8}
                      placeholder={`Sérum Éclat | 15000 FCFA | Soins visage | Anti-taches, résultats en 2 semaines\nCrème Hydratante | 8000 FCFA | Soins corps | Hydratation 24h\nHuile de Baobab | 12000 FCFA | Cheveux\nSavon Karité | 3500 FCFA | Savons\n...`}
                      className="w-full text-[12px] font-mono border border-emerald-200 rounded-lg p-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      style={{ resize: 'vertical' }}
                    />
                    <div className="flex items-center gap-3">
                      <button onClick={parseBulkProducts}
                        disabled={!bulkText.trim()}
                        className="flex-1 py-2 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-40"
                        style={{ background: '#059669' }}>
                        {bulkImportResult ? `✅ ${bulkImportResult} produit${bulkImportResult > 1 ? 's' : ''} importé${bulkImportResult > 1 ? 's' : ''} !` : `Importer ${bulkText.trim() ? bulkText.split('\n').filter(l => l.trim()).length : 0} produit(s)`}
                      </button>
                      <button onClick={() => setBulkText('')} className="px-3 py-2 text-[11px] text-gray-400 hover:text-red-500">Vider</button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={addProduct}
                    className="flex-1 py-3 border-2 border-dashed border-purple-200 rounded-xl text-[13px] font-semibold text-purple-600 hover:bg-purple-50 hover:border-purple-300 transition-all flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Ajouter un produit
                  </button>
                  <button onClick={() => setShowBulkImport(v => !v)}
                    className={`px-4 py-3 border-2 border-dashed rounded-xl text-[13px] font-semibold transition-all flex items-center gap-2 flex-shrink-0 ${
                      showBulkImport ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600'
                    }`}>
                    📋 Import liste
                  </button>
                </div>
              </div>
            )}

            {/* Connaissances */}
            {activeSection === 'stock' && (
              <div className="space-y-5">
                <ToggleRow enabled={config.stockManagementEnabled} onChange={v => set('stockManagementEnabled', v)}
                  label="Gestion de stock par ville"
                  desc="Rita vérifiera le stock dans la ville du client avant de confirmer une livraison" />

                {config.stockManagementEnabled && (
                  <div className="space-y-4">
                    {/* Info box */}
                    <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-[12px] text-blue-800 leading-relaxed">
                      <strong>Comment ça marche :</strong> Ajoutez le stock de chaque produit par ville. Quand un client demande une livraison, Rita vérifiera automatiquement si le produit est disponible dans sa ville avant de confirmer.
                    </div>

                    {/* Add stock entry form */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                      <p className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
                        <span>➕</span> Ajouter du stock
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <Field label="Produit" required>
                          <select
                            id="stock-product-select"
                            className="field-input"
                            defaultValue=""
                          >
                            <option value="" disabled>Choisir un produit...</option>
                            {config.productCatalog?.filter(p => p.name).map((p, i) => (
                              <option key={i} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Ville" required>
                          <input id="stock-city-input" placeholder="Ex: Douala, Yaoundé..." className="field-input" />
                        </Field>
                        <Field label="Quantité" required>
                          <input id="stock-qty-input" type="number" min="0" placeholder="0" className="field-input" />
                        </Field>
                        <Field label="Notes">
                          <input id="stock-notes-input" placeholder="Optionnel" className="field-input" />
                        </Field>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const productName = document.getElementById('stock-product-select')?.value;
                          const city = document.getElementById('stock-city-input')?.value?.trim();
                          const quantity = parseInt(document.getElementById('stock-qty-input')?.value) || 0;
                          const notes = document.getElementById('stock-notes-input')?.value?.trim() || '';
                          if (!productName || !city) return;
                          const existing = (config.stockEntries || []).findIndex(e => e.productName === productName && e.city.toLowerCase() === city.toLowerCase());
                          let updated;
                          if (existing >= 0) {
                            updated = [...config.stockEntries];
                            updated[existing] = { ...updated[existing], quantity, notes };
                          } else {
                            updated = [...(config.stockEntries || []), { productName, city, quantity, notes }];
                          }
                          set('stockEntries', updated);
                          document.getElementById('stock-product-select').value = '';
                          document.getElementById('stock-city-input').value = '';
                          document.getElementById('stock-qty-input').value = '';
                          document.getElementById('stock-notes-input').value = '';
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white rounded-xl transition-colors"
                        style={{ background: ACCENT }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Ajouter / Mettre à jour
                      </button>
                    </div>

                    {/* Stock entries table */}
                    {config.stockEntries?.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                          <p className="text-[13px] font-semibold text-gray-800">
                            📦 Stock actuel ({config.stockEntries.length} entrée{config.stockEntries.length > 1 ? 's' : ''})
                          </p>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {/* Group by product */}
                          {(() => {
                            const grouped = {};
                            (config.stockEntries || []).forEach((e, idx) => {
                              if (!grouped[e.productName]) grouped[e.productName] = [];
                              grouped[e.productName].push({ ...e, _idx: idx });
                            });
                            return Object.entries(grouped).map(([productName, entries]) => (
                              <div key={productName} className="">
                                <div className="px-4 py-2.5 bg-purple-50/50">
                                  <p className="text-[12px] font-bold text-purple-700">🛒 {productName}</p>
                                </div>
                                {entries.map(entry => (
                                  <div key={entry._idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <span className="text-[12px] font-medium text-gray-700 min-w-[100px]">📍 {entry.city}</span>
                                      <span className={`text-[12px] font-bold px-2 py-0.5 rounded-md ${
                                        entry.quantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                      }`}>
                                        {entry.quantity > 0 ? `${entry.quantity} unité${entry.quantity > 1 ? 's' : ''}` : 'Rupture'}
                                      </span>
                                      {entry.notes && <span className="text-[11px] text-gray-400 truncate">{entry.notes}</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          const newQty = prompt('Nouvelle quantité :', entry.quantity);
                                          if (newQty !== null && !isNaN(parseInt(newQty))) {
                                            const updated = [...config.stockEntries];
                                            updated[entry._idx] = { ...updated[entry._idx], quantity: Math.max(0, parseInt(newQty)) };
                                            set('stockEntries', updated);
                                          }
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Modifier la quantité"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                      </button>
                                      <button
                                        onClick={() => {
                                          const updated = config.stockEntries.filter((_, i) => i !== entry._idx);
                                          set('stockEntries', updated);
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Supprimer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {(!config.stockEntries || config.stockEntries.length === 0) && (
                      <div className="text-center py-8 text-gray-400">
                        <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="text-[13px] font-medium">Aucun stock configuré</p>
                        <p className="text-[11px] mt-1">Ajoutez le stock de vos produits par ville pour que Rita puisse vérifier la disponibilité</p>
                      </div>
                    )}

                    {/* No products warning */}
                    {(!config.productCatalog || config.productCatalog.filter(p => p.name).length === 0) && (
                      <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-[12px] text-amber-800">
                        ⚠️ Vous devez d'abord ajouter des produits dans l'onglet <strong>Produits</strong> avant de configurer le stock.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'knowledge' && (
              <div className="space-y-4">
                <div className="px-4 py-3 bg-amber-50/80 border border-amber-100 rounded-2xl text-[12px] text-amber-800 flex gap-2.5 items-start">
                  <span className="flex-shrink-0 text-sm mt-0.5">💡</span>
                  <span>Plus votre base est complète et structurée, plus Rita sera précise et convaincante.</span>
                </div>
                <Field label="Contexte business" hint="qui vous êtes, votre positionnement">
                  <textarea value={config.businessContext} onChange={e => set('businessContext', e.target.value)} rows={4}
                    placeholder={"Boutique de cosmétiques naturels\nProduits 100% naturels sans paraben\nLivraison dans toute la CI en 24-48h"}
                    className="field-input" style={{ resize: 'vertical' }} />
                </Field>
                <Field label="Catalogue produits" hint="noms, prix, descriptions, cibles">
                  <textarea value={config.products} onChange={e => set('products', e.target.value)} rows={6}
                    placeholder={"- Sérum Éclat : 15 000 FCFA — anti-taches, illuminateur\n- Crème Hydratante : 8 500 FCFA — 24h hydratation\n- Huile de Baobab : 12 000 FCFA — anti-âge, bestseller"}
                    className="field-input font-mono text-xs leading-relaxed" style={{ resize: 'vertical' }} />
                </Field>
                <Field label="FAQ — Questions / Réponses fréquentes">
                  <textarea value={config.faq} onChange={e => set('faq', e.target.value)} rows={6}
                    placeholder={"Q: Comment payer ?\nR: Orange Money, Wave, MTN Money.\n\nQ: Livraison partout ?\nR: Oui, toute la CI. Gratuit dès 25 000 FCFA."}
                    className="field-input font-mono text-xs leading-relaxed" style={{ resize: 'vertical' }} />
                </Field>
                <Field label="Avantages concurrentiels">
                  <textarea value={config.competitiveAdvantages} onChange={e => set('competitiveAdvantages', e.target.value)} rows={3}
                    placeholder="Seule boutique certifiée bio en CI, garantie 30 jours, livraison express 4h..."
                    className="field-input" style={{ resize: 'none' }} />
                </Field>

                {/* ── Témoignages clients ── */}
                <div className="border-t border-gray-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-bold text-gray-900">🗣️ Témoignages clients</p>
                    <ToggleRow enabled={config.testimonialsEnabled} onChange={v => set('testimonialsEnabled', v)} label="Activer" desc="" />
                  </div>
                  <p className="text-[11px] text-gray-500">Rita utilisera ces témoignages pour rassurer les clients hésitants et augmenter les conversions.</p>
                  {config.testimonialsEnabled && (
                    <div className="space-y-3">
                      {(config.testimonials || []).map((t, i) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-xl space-y-2 relative">
                          <button onClick={() => set('testimonials', config.testimonials.filter((_, j) => j !== i))}
                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-sm">×</button>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={t.clientName} onChange={e => {
                              const updated = [...config.testimonials];
                              updated[i] = { ...updated[i], clientName: e.target.value };
                              set('testimonials', updated);
                            }} placeholder="Nom du client" className="field-input text-xs" />
                            <input value={t.product} onChange={e => {
                              const updated = [...config.testimonials];
                              updated[i] = { ...updated[i], product: e.target.value };
                              set('testimonials', updated);
                            }} placeholder="Produit concerné (optionnel)" className="field-input text-xs" />
                          </div>
                          <textarea value={t.text} onChange={e => {
                            const updated = [...config.testimonials];
                            updated[i] = { ...updated[i], text: e.target.value };
                            set('testimonials', updated);
                          }} rows={2} placeholder="Le produit est top, je suis trop contente de mon achat !"
                            className="field-input text-xs" style={{ resize: 'none' }} />
                        </div>
                      ))}
                      <button onClick={() => set('testimonials', [...(config.testimonials || []), { clientName: '', text: '', product: '' }])}
                        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-[12px] text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                        + Ajouter un témoignage
                      </button>
                    </div>
                  )}
                </div>
                <Field label="Liens utiles" hint="site, Instagram, catalogue PDF...">
                  <textarea value={config.usefulLinks} onChange={e => set('usefulLinks', e.target.value)} rows={2}
                    placeholder={"Site: https://monsite.ci\nInstagram: @maboutique"}
                    className="field-input font-mono text-xs" style={{ resize: 'none' }} />
                </Field>
                <div>
                  <Field label="Mots-clés déclencheurs">
                    <div className="flex gap-2 mt-1">
                      <input value={newKw} onChange={e => setNewKw(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKw())}
                        placeholder="ex: prix, commander, livraison..."
                        className="field-input flex-1" />
                      <button onClick={addKw} className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex-shrink-0" style={{ background: ACCENT }}>
                        Ajouter
                      </button>
                    </div>
                  </Field>
                  {config.autoReplyKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {config.autoReplyKeywords.map(kw => (
                        <span key={kw} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-[11px] font-medium">
                          {kw}
                          <button onClick={() => set('autoReplyKeywords', config.autoReplyKeywords.filter(k => k !== kw))} className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Personnalité ─── */}
            {activeSection === 'personality' && (
              <div className="space-y-5">
                <div className="px-4 py-3 bg-pink-50/80 border border-pink-100 rounded-2xl text-[12px] text-pink-800 flex gap-2.5 items-start">
                  <span className="flex-shrink-0 text-sm mt-0.5">🎭</span>
                  <span>Personnalisez le ton, les expressions et les réactions de votre agent. Ajoutez des exemples de conversations pour qu'il copie exactement votre style.</span>
                </div>

                {/* Description personnalité */}
                <Field label="Description de la personnalité" hint="décrivez qui est votre agent en quelques lignes">
                  <textarea value={config.personality?.description || ''} onChange={e => setPersonality('description', e.target.value)}
                    rows={3} placeholder="Vendeuse camerounaise chaleureuse, toujours souriante, elle tutoie les clientes et les appelle 'ma chérie' ou 'maman'. Elle est directe mais jamais agressive."
                    className="field-input text-xs" style={{ resize: 'vertical' }} />
                </Field>

                {/* Tonal guidelines */}
                <Field label="Guide de ton détaillé" hint="comment parler, quel niveau de familiarité, quels registres">
                  <textarea value={config.personality?.tonalGuidelines || ''} onChange={e => setPersonality('tonalGuidelines', e.target.value)}
                    rows={3} placeholder={"Toujours tutoyer les clientes\nUtiliser des expressions camerounaises naturelles\nNe jamais faire de phrases trop longues\nParler comme sur WhatsApp: simple, direct, chaleureux"}
                    className="field-input text-xs" style={{ resize: 'vertical' }} />
                </Field>

                {/* Mannerisms / tics de langage */}
                <div>
                  <p className="text-[12px] font-semibold text-gray-700 mb-1">💬 Expressions typiques / tics de langage</p>
                  <p className="text-[11px] text-gray-400 mb-2">L'agent utilisera naturellement ces phrases dans ses réponses</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(config.personality?.mannerisms || []).map((m, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-[11px] font-medium border border-purple-100">
                        "{m}"
                        <button onClick={() => setPersonality('mannerisms', config.personality.mannerisms.filter((_, idx) => idx !== i))} className="text-purple-400 hover:text-red-500 ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={newMannerism} onChange={e => setNewMannerism(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMannerism())}
                      placeholder="ex: D'accord maman, Je check ça, C'est bon ma chérie"
                      className="field-input flex-1 text-xs" />
                    <button onClick={addMannerism} className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex-shrink-0" style={{ background: '#7c3aed' }}>+</button>
                  </div>
                </div>

                {/* Forbidden phrases */}
                <div>
                  <p className="text-[12px] font-semibold text-gray-700 mb-1">🚫 Expressions interdites</p>
                  <p className="text-[11px] text-gray-400 mb-2">L'agent ne doit JAMAIS utiliser ces mots ou phrases</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(config.personality?.forbiddenPhrases || []).map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-[11px] font-medium border border-red-100">
                        "{f}"
                        <button onClick={() => setPersonality('forbiddenPhrases', config.personality.forbiddenPhrases.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={newForbidden} onChange={e => setNewForbidden(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addForbidden())}
                      placeholder="ex: En tant qu'IA, Je suis un assistant, Cordialement"
                      className="field-input flex-1 text-xs" />
                    <button onClick={addForbidden} className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex-shrink-0 bg-red-500 hover:bg-red-600">+</button>
                  </div>
                </div>

                {/* Conversation examples */}
                <div>
                  <p className="text-[14px] font-bold text-gray-900 mb-0.5">💡 Exemples de conversations</p>
                  <p className="text-[12px] text-gray-400 mb-3">Montrez à l'agent comment répondre. Il imitera ce ton et cette énergie.</p>
                  {config.conversationExamples.map((ex, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-3 mb-3 bg-gray-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-400">Exemple {i + 1}</span>
                        <button onClick={() => removeConvExample(i)} className="text-gray-300 hover:text-red-500 text-xs">×</button>
                      </div>
                      <div className="flex gap-2 items-start">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1 flex-shrink-0">Client</span>
                        <input value={ex.customer} onChange={e => updateConvExample(i, 'customer', e.target.value)}
                          placeholder="C'est combien le Sérum Éclat ?"
                          className="field-input flex-1 text-xs" />
                      </div>
                      <div className="flex gap-2 items-start">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded mt-1 flex-shrink-0">Agent</span>
                        <input value={ex.agent} onChange={e => updateConvExample(i, 'agent', e.target.value)}
                          placeholder="Le Sérum Éclat c'est 15 000 FCFA ma chérie 👍 Tu veux seulement ça ?"
                          className="field-input flex-1 text-xs" />
                      </div>
                    </div>
                  ))}
                  <button onClick={addConversationExample}
                    className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-[12px] font-semibold text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2">
                    <Plus className="w-3.5 h-3.5" /> Ajouter un exemple
                  </button>
                </div>

                {/* Behavior rules */}
                <div>
                  <p className="text-[14px] font-bold text-gray-900 mb-0.5">📋 Règles de comportement</p>
                  <p className="text-[12px] text-gray-400 mb-3">Définissez exactement comment l'agent doit réagir dans chaque situation</p>
                  {config.behaviorRules.map((rule, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-3 mb-3 bg-gray-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-400">Règle {i + 1}</span>
                        <button onClick={() => removeBehaviorRule(i)} className="text-gray-300 hover:text-red-500 text-xs">×</button>
                      </div>
                      <div className="flex gap-2 items-start">
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded mt-1 flex-shrink-0">Si</span>
                        <input value={rule.situation} onChange={e => updateBehaviorRule(i, 'situation', e.target.value)}
                          placeholder="le client demande un produit qui n'existe pas"
                          className="field-input flex-1 text-xs" />
                      </div>
                      <div className="flex gap-2 items-start">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded mt-1 flex-shrink-0">→</span>
                        <input value={rule.reaction} onChange={e => updateBehaviorRule(i, 'reaction', e.target.value)}
                          placeholder="proposer les produits similaires disponibles et demander une précision"
                          className="field-input flex-1 text-xs" />
                      </div>
                    </div>
                  ))}
                  <button onClick={addBehaviorRule}
                    className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-[12px] font-semibold text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2">
                    <Plus className="w-3.5 h-3.5" /> Ajouter une règle
                  </button>
                </div>
              </div>
            )}

            {/* Stratégie vente */}
            {activeSection === 'sales' && (
              <div className="space-y-6">
                <div>
                  <p className="text-[14px] font-bold text-gray-900 mb-0.5">Questions de qualification</p>
                  <p className="text-[12px] text-gray-400 mb-3">Rita pose ces questions pour comprendre le prospect</p>
                  <div className="space-y-2">
                    {config.qualificationQuestions.map((q, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <p className="text-[13px] text-gray-700 flex-1">{q}</p>
                        <button onClick={() => set('qualificationQuestions', config.qualificationQuestions.filter((_, idx) => idx !== i))}
                          className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 text-base leading-none">×</button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addQuestion())}
                        placeholder="Ex: Pour qui achetez-vous ?"
                        className="field-input flex-1" />
                      <button onClick={addQuestion} className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex-shrink-0" style={{ background: ACCENT }}>
                        Ajouter
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[14px] font-bold text-gray-900 mb-0.5">Technique de closing</p>
                  <p className="text-[12px] text-gray-400 mb-3">Comment Rita amène le prospect à décider</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: 'soft',         label: '🤝 Approche douce',   desc: 'Propose sans pression, respecte le rythme du prospect' },
                      { id: 'urgency',      label: '⏰ Urgence et Rareté', desc: "Crée un sentiment d'urgence : stock limité, offre qui expire" },
                      { id: 'social-proof', label: '⭐ Preuve sociale',    desc: 'Cite des avis clients, témoignages, chiffres de vente' },
                      { id: 'value',        label: '💎 Arguments valeur',  desc: 'Met en avant les bénéfices et ROI plutôt que le prix' },
                    ].map(ct => (
                      <button key={ct.id} onClick={() => set('closingTechnique', ct.id)}
                        className={`text-left px-4 py-3.5 rounded-2xl border-2 transition-all duration-200 ${
                          config.closingTechnique === ct.id ? 'border-purple-400 bg-purple-50/70 shadow-sm shadow-purple-100' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                        }`}>
                        <p className="font-semibold text-gray-800 text-[13px]">{ct.label}</p>
                        <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{ct.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[14px] font-bold text-gray-900 mb-0.5">Gestion des objections</p>
                  <p className="text-[12px] text-gray-400 mb-2">Réponses prêtes pour les freins à l'achat courants</p>
                  <textarea value={config.objectionsHandling} onChange={e => set('objectionsHandling', e.target.value)} rows={7}
                    placeholder={"C'est trop cher : Nos produits sont faits pour durer. Livraison gratuite incluse !\n\nJ'ai besoin d'y réfléchir : Notre stock est limité. Voulez-vous que je réserve votre commande ?\n\nJe trouve moins cher ailleurs : Nos produits sont certifiés avec un SAV premium."}
                    className="field-input font-mono text-xs leading-relaxed" style={{ resize: 'vertical' }} />
                </div>

                {/* Négociation des prix */}
                <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-bold text-gray-900">💰 Négociation des prix</p>
                      <p className="text-[12px] text-gray-400">Configure comment Rita gère les demandes de réduction</p>
                    </div>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <button type="button" onClick={() => set('pricingNegotiation', { ...config.pricingNegotiation, enabled: !config.pricingNegotiation?.enabled })}
                        role="switch" aria-checked={config.pricingNegotiation?.enabled || false}
                        className={`relative w-[44px] h-[26px] rounded-full transition-all duration-200 ${config.pricingNegotiation?.enabled ? 'bg-amber-500' : 'bg-gray-200 hover:bg-gray-300'}`}>
                        <span className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${config.pricingNegotiation?.enabled ? 'left-[21px]' : 'left-[3px]'}`} />
                      </button>
                    </label>
                  </div>

                  {config.pricingNegotiation?.enabled && (
                    <div className="space-y-4 pt-2 border-t border-amber-100">
                      {/* Prix final ou négociable */}
                      <div>
                        <p className="text-[12px] font-semibold text-gray-700 mb-2">Politique de prix</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button type="button" onClick={() => set('pricingNegotiation', { ...config.pricingNegotiation, priceIsFinal: true, allowDiscount: false })}
                            className={`text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                              config.pricingNegotiation?.priceIsFinal ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
                            }`}>
                            <p className="font-semibold text-[13px] text-gray-800">🔒 Prix fixe (dernier prix)</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">Rita ne négocie pas. Le prix affiché est le dernier prix.</p>
                          </button>
                          <button type="button" onClick={() => set('pricingNegotiation', { ...config.pricingNegotiation, priceIsFinal: false, allowDiscount: true })}
                            className={`text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                              !config.pricingNegotiation?.priceIsFinal ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
                            }`}>
                            <p className="font-semibold text-[13px] text-gray-800">🤝 Prix négociable</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">Rita peut accorder des réductions selon tes règles.</p>
                          </button>
                        </div>
                      </div>

                      {/* Si prix négociable */}
                      {config.pricingNegotiation?.allowDiscount && (
                        <div className="space-y-3">
                          <p className="text-[12px] font-semibold text-gray-700 mb-1">Style de négociation</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'firm', label: '💪 Ferme', desc: 'Réduction rare, seulement si le client insiste' },
                              { id: 'flexible', label: '🤝 Flexible', desc: 'Ouvert à la discussion, propose à mi-chemin' },
                              { id: 'generous', label: '🎁 Généreux', desc: 'Accorde facilement la réduction max' },
                            ].map(s => (
                              <button key={s.id} type="button" onClick={() => set('pricingNegotiation', { ...config.pricingNegotiation, negotiationStyle: s.id })}
                                className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                                  config.pricingNegotiation?.negotiationStyle === s.id ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
                                }`}>
                                <p className="font-semibold text-[12px] text-gray-800">{s.label}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{s.desc}</p>
                              </button>
                            ))}
                          </div>

                          <Field label="Réduction globale max %" hint="s'applique à tous les produits sans config spécifique">
                            <input type="number" min="0" max="100" value={config.pricingNegotiation?.maxDiscountPercent || 0}
                              onChange={e => set('pricingNegotiation', { ...config.pricingNegotiation, maxDiscountPercent: parseInt(e.target.value) || 0 })}
                              className="field-input text-xs w-32" />
                          </Field>

                          <Field label="Conditions de réduction" hint="quand autoriser une réduction">
                            <textarea value={config.pricingNegotiation?.discountConditions || ''} rows={2}
                              onChange={e => set('pricingNegotiation', { ...config.pricingNegotiation, discountConditions: e.target.value })}
                              placeholder="ex: Si le client achète 2 produits ou plus. Si le client est un ancien client."
                              className="field-input text-xs" style={{ resize: 'vertical' }} />
                          </Field>
                        </div>
                      )}

                      <Field label="Message de refus personnalisé" hint="quand le client demande une réduction impossible">
                        <input value={config.pricingNegotiation?.refusalMessage || ''}
                          onChange={e => set('pricingNegotiation', { ...config.pricingNegotiation, refusalMessage: e.target.value })}
                          placeholder="ex: C'est déjà notre meilleur prix, on ne peut pas descendre plus bas 🙏"
                          className="field-input text-xs" />
                      </Field>

                      <Field label="Note globale sur les prix" hint="instructions spéciales pour Rita sur les prix">
                        <textarea value={config.pricingNegotiation?.globalNote || ''} rows={2}
                          onChange={e => set('pricingNegotiation', { ...config.pricingNegotiation, globalNote: e.target.value })}
                          placeholder="ex: Ne jamais descendre en dessous du dernier prix. Proposer la livraison gratuite à la place d'une réduction."
                          className="field-input text-xs" style={{ resize: 'vertical' }} />
                      </Field>

                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-100/50 border border-amber-200 rounded-lg">
                        <span className="text-amber-600 text-sm">💡</span>
                        <p className="text-[11px] text-amber-700">Tu peux aussi configurer le <strong>dernier prix</strong> et la <strong>réduction max</strong> par produit dans l'onglet <strong>🛒 Produits</strong>.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Disponibilité */}
            {activeSection === 'offers' && (
              <div className="space-y-5">
                <div className="px-4 py-3 bg-emerald-50/80 border border-emerald-100 rounded-2xl text-[12px] text-emerald-800 flex gap-2.5 items-start">
                  <span className="flex-shrink-0 text-sm mt-0.5">🎁</span>
                  <span>Créez ici les offres commerciales que Rita a le droit d'utiliser. Elle ne proposera que les offres actives et respectera vos conditions.</span>
                </div>

                <ToggleRow
                  enabled={config.commercialOffersEnabled}
                  onChange={v => set('commercialOffersEnabled', v)}
                  label="Activer la gestion des offres"
                  desc="Rita peut proposer des offres pré-configurées selon le contexte commercial"
                />

                {config.commercialOffersEnabled && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-white border border-gray-200 rounded-2xl">
                      <div>
                        <p className="text-[13px] font-semibold text-gray-900">Offres commerciales actives</p>
                        <p className="text-[12px] text-gray-500 mt-0.5">
                          {(config.commercialOffers || []).filter(offer => offer.active).length} active(s) sur {(config.commercialOffers || []).length}
                          {config.requireHumanApproval ? ' · validation humaine toujours active' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addCommercialOffer}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white rounded-xl transition-colors"
                        style={{ background: ACCENT }}>
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter une offre
                      </button>
                    </div>

                    {(config.commercialOffers || []).length === 0 && (
                      <div className="px-4 py-5 border border-dashed border-gray-200 rounded-2xl bg-gray-50/70 text-center">
                        <p className="text-[13px] font-semibold text-gray-700">Aucune offre configurée</p>
                        <p className="text-[12px] text-gray-400 mt-1">Ajoutez vos promotions, bonus ou avantages pour que Rita puisse les proposer au bon moment.</p>
                      </div>
                    )}

                    {(config.commercialOffers || []).map((offer, offerIdx) => (
                      <div key={offerIdx} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                          <div>
                            <p className="text-[13px] font-semibold text-gray-900">{offer.title || `Offre ${offerIdx + 1}`}</p>
                            <p className="text-[11px] text-gray-400">
                              {OFFER_TRIGGER_OPTIONS.find(opt => opt.value === offer.trigger)?.label || 'Déclencheur non défini'}
                              {offer.appliesTo ? ` · ${offer.appliesTo}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${offer.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                              {offer.active ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeCommercialOffer(offerIdx)}
                              className="text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Nom de l'offre">
                              <input
                                value={offer.title || ''}
                                onChange={e => updateCommercialOffer(offerIdx, 'title', e.target.value)}
                                placeholder="Ex: Livraison offerte aujourd'hui"
                                className="field-input" />
                            </Field>
                            <Field label="Produit ou audience ciblée">
                              <input
                                value={offer.appliesTo || ''}
                                onChange={e => updateCommercialOffer(offerIdx, 'appliesTo', e.target.value)}
                                placeholder="Ex: Montre connectée / prospects tièdes"
                                className="field-input" />
                            </Field>
                            <Field label="Déclencheur principal">
                              <CustomSelect
                                value={offer.trigger || 'hesitation'}
                                onChange={v => updateCommercialOffer(offerIdx, 'trigger', v)}
                                options={OFFER_TRIGGER_OPTIONS}
                              />
                            </Field>
                            <div className="flex items-end">
                              <ToggleRow
                                enabled={offer.active !== false}
                                onChange={v => updateCommercialOffer(offerIdx, 'active', v)}
                                label="Offre active"
                                desc="Rita ignore automatiquement les offres inactives"
                              />
                            </div>
                          </div>

                          <Field label="Avantage proposé">
                            <input
                              value={offer.benefit || ''}
                              onChange={e => updateCommercialOffer(offerIdx, 'benefit', e.target.value)}
                              placeholder="Ex: -10% / Livraison gratuite / 1 accessoire offert"
                              className="field-input" />
                          </Field>

                          <Field label="Conditions d'application" hint="quand Rita peut vraiment la proposer">
                            <textarea
                              value={offer.conditions || ''}
                              onChange={e => updateCommercialOffer(offerIdx, 'conditions', e.target.value)}
                              rows={2}
                              placeholder="Ex: uniquement si le client bloque sur le prix ou commande avant 18h"
                              className="field-input text-xs" style={{ resize: 'vertical' }} />
                          </Field>

                          <Field label="Message ou angle commercial" hint="comment Rita présente l'offre au client">
                            <textarea
                              value={offer.message || ''}
                              onChange={e => updateCommercialOffer(offerIdx, 'message', e.target.value)}
                              rows={3}
                              placeholder="Ex: Si tu confirmes aujourd'hui, je peux t'ajouter la livraison gratuite 🙏"
                              className="field-input text-xs" style={{ resize: 'vertical' }} />
                          </Field>

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3.5 py-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-[11px] text-gray-500">Astuce: vous pouvez réutiliser une offre comme offre de dernière relance en un clic.</p>
                            <button
                              type="button"
                              onClick={() => set('followUpOffer', buildOfferFollowUpText(offer))}
                              className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-white transition-colors">
                              Utiliser en dernière relance
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Disponibilité */}
            {activeSection === 'voice' && (
              <div className="space-y-5">
                {/* Mode de réponse: text / voice / both */}
                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl space-y-3">
                  <p className="text-[14px] font-bold text-gray-900">🎚️ Mode de réponse</p>
                  <p className="text-[12px] text-gray-500">Choisissez comment Rita répond aux clients sur WhatsApp</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'text', icon: '💬', label: 'Texte', desc: 'Messages écrits uniquement' },
                      { value: 'voice', icon: '🎙️', label: 'Vocal', desc: 'Notes audio uniquement' },
                      { value: 'both', icon: '💬🎙️', label: 'Mixte', desc: 'Vocal pour les longues explications' },
                    ].map(m => (
                      <button key={m.value} type="button"
                        onClick={() => { set('responseMode', m.value); set('voiceMode', m.value !== 'text'); }}
                        className={`flex flex-col items-center gap-2 px-3 py-5 rounded-2xl border-2 transition-all duration-200 ${
                          (config.responseMode || 'text') === m.value
                            ? 'border-purple-500 bg-purple-50/70 shadow-sm shadow-purple-100 scale-[1.02]'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}>
                        <span className="text-2xl">{m.icon}</span>
                        <p className={`text-[13px] font-bold ${(config.responseMode || 'text') === m.value ? 'text-purple-700' : 'text-gray-700'}`}>{m.label}</p>
                        <p className="text-[10px] text-gray-400 text-center leading-tight">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                  {(config.responseMode === 'both') && (
                    <div className="space-y-3 mt-2">
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <span className="text-emerald-500 text-sm">✅</span>
                        <p className="text-[11px] text-emerald-700">Rita envoie plus souvent un <strong>vocal</strong> pour les réponses longues, explications, mise en confiance et confirmations importantes, puis garde le <strong>texte</strong> pour les réponses plus rapides.</p>
                      </div>

                      <div className="p-4 bg-white border border-purple-100 rounded-xl space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-bold text-gray-900">Présence du vocal en mode mixte</p>
                            <p className="text-[11px] text-gray-500">Plus la valeur est haute, plus Rita bascule facilement en vocal.</p>
                          </div>
                          <div className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-[12px] font-bold">
                            {config.mixedVoiceReplyChance ?? 65}%
                          </div>
                        </div>

                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={config.mixedVoiceReplyChance ?? 65}
                          onChange={e => set('mixedVoiceReplyChance', Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 65)))}
                          className="w-full accent-purple-600"
                        />

                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={config.mixedVoiceReplyChance ?? 65}
                            onChange={e => set('mixedVoiceReplyChance', Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                            className="field-input w-24"
                          />
                          <p className="text-[11px] text-gray-500">0% = quasi tout en texte, 100% = vocal presque systématique quand le mode mixte est actif.</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {(config.responseMode === 'voice') && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg mt-2">
                      <span className="text-amber-500 text-sm">⚠️</span>
                      <p className="text-[11px] text-amber-700">En mode vocal seul, si la génération audio échoue, Rita basculera automatiquement en texte.</p>
                    </div>
                  )}
                </div>

                {/* ElevenLabs config — pré-configuré */}
                <div className="space-y-4">

                  {/* ── Sélection du fournisseur TTS ── */}
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
                    <p className="text-[14px] font-bold text-gray-900">🔊 Fournisseur vocal</p>
                    <p className="text-[12px] text-gray-500">Choisissez le moteur de synthèse vocale pour Rita</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'elevenlabs', icon: '🎙️', label: 'ElevenLabs', desc: 'Voix standard — pré-configuré, 70+ langues' },
                        { value: 'fishaudio', icon: '🐟', label: 'Voix Avancée', desc: 'Fish.audio S2-Pro — clonage vocal haute fidélité' },
                      ].map(p => (
                        <button key={p.value} type="button"
                          onClick={() => set('ttsProvider', p.value)}
                          className={`flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border-2 transition-all duration-200 ${
                            (config.ttsProvider || 'elevenlabs') === p.value
                              ? 'border-indigo-500 bg-indigo-50/70 shadow-sm shadow-indigo-100 scale-[1.02]'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                          }`}>
                          <span className="text-2xl">{p.icon}</span>
                          <p className={`text-[13px] font-bold ${(config.ttsProvider || 'elevenlabs') === p.value ? 'text-indigo-700' : 'text-gray-700'}`}>{p.label}</p>
                          <p className="text-[10px] text-gray-400 text-center leading-tight">{p.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Fish.audio (Voix Avancée) config ── */}
                  {(config.ttsProvider === 'fishaudio') && (
                    <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-xl space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🐟</span>
                        <div>
                          <p className="text-[14px] font-bold text-gray-900">Fish.audio — Voix Avancée</p>
                          <p className="text-[11px] text-gray-500">Clonage vocal haute fidélité avec le modèle S2-Pro</p>
                        </div>
                      </div>

                      <div className="p-4 bg-white border border-cyan-100 rounded-xl space-y-3">
                        <div>
                          <p className="text-[13px] font-semibold text-gray-900">Créer ma voix</p>
                          <p className="text-[11px] text-gray-500">Upload 1 à 3 audios, clique sur créer, puis utilise ta voix directement dans Rita.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="text-[12px] font-medium text-gray-700 mb-1 block">Nom de la voix</label>
                            <input
                              type="text"
                              value={fishVoiceName}
                              onChange={e => setFishVoiceName(e.target.value)}
                              placeholder="Ex: Voix Morgan"
                              className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="text-[12px] font-medium text-gray-700 mb-1 block">Description</label>
                            <input
                              type="text"
                              value={fishVoiceDescription}
                              onChange={e => setFishVoiceDescription(e.target.value)}
                              placeholder="Ex: Voix posée et chaleureuse"
                              className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="text-[12px] font-medium text-gray-700 mb-1 block">Échantillons audio</label>
                            <input
                              type="file"
                              accept="audio/*"
                              multiple
                              onChange={handleFishSampleChange}
                              className="w-full px-3 py-2 text-[12px] border border-dashed border-cyan-300 rounded-lg bg-cyan-50/40 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-cyan-500 file:text-white"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Formats: mp3, wav, m4a. 10 à 30 secondes recommandées par sample.</p>
                          </div>

                          {fishVoiceSamples.map((sample, index) => (
                            <div key={`${sample.name}-${index}`}>
                              <label className="text-[11px] font-medium text-gray-700 mb-1 block">Transcript optionnel — {sample.name}</label>
                              <textarea
                                value={fishVoiceTexts[index] || ''}
                                onChange={e => setFishText(index, e.target.value)}
                                rows={2}
                                placeholder="Texte prononcé dans cet audio pour améliorer la qualité"
                                className="w-full px-3 py-2 text-[12px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent resize-none"
                              />
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={handleCreateFishVoice}
                            disabled={creatingFishVoice}
                            className={`w-full px-4 py-3 rounded-xl text-[13px] font-semibold transition-all ${
                              creatingFishVoice
                                ? 'bg-cyan-300 text-white cursor-not-allowed'
                                : 'bg-cyan-600 text-white hover:bg-cyan-700'
                            }`}
                          >
                            {creatingFishVoice ? 'Création en cours...' : 'Créer ma voix'}
                          </button>

                          {fishVoiceStatus && (
                            <div className={`px-3 py-2 rounded-lg text-[11px] border ${
                              fishVoiceStatus.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-red-50 border-red-200 text-red-700'
                            }`}>
                              {fishVoiceStatus.msg}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <p className="text-[12px] font-medium text-emerald-800">API Fish.audio intégrée directement</p>
                            <p className="text-[10px] text-emerald-700 mt-1">Aucune clé à saisir ici. Rita utilise automatiquement l'API Fish.audio configurée côté serveur.</p>
                          </div>
                        </div>

                        <div>
                          <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                            <p className="text-[12px] font-medium text-slate-800">Sélection par cartes de voix</p>
                            <p className="text-[10px] text-slate-600 mt-1">Le choix de la voix se fait directement dans la liste ci-dessous. Le champ technique Reference ID a été retiré.</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[12px] font-medium text-gray-700 mb-2">Voix disponibles</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                              {
                                id: '13f7f6e260f94079b9d51c961fa6c9e2',
                                name: 'Michelle',
                                desc: 'Modèle Fish.audio · Femme · FR · Voix avancée par défaut',
                                badge: '✨ Par défaut',
                              },
                              {
                                id: '3846aca8ddb64a5a82ab2e097844861d',
                                name: 'Richard',
                                desc: 'Modèle Fish.audio · Homme · FR · Voix avancée',
                                badge: '🆕 Intégrée',
                              },
                              {
                                id: '14b22748e04a48a58f92fbcde088ee50',
                                name: 'Ebilove',
                                desc: 'Voix clonée Fish.audio · Femme · FR · Voix avancée',
                                badge: '⭐ Intégrée',
                              },
                              ...((config.fishAudioVoices || []).map(voice => ({
                                id: voice.id,
                                name: voice.name,
                                desc: `${voice.description || 'Voix personnalisée'}${voice.state ? ` · ${voice.state}` : ''}`,
                                badge: 'Ma voix',
                              }))),
                            ].map(voice => (
                              <button
                                key={voice.id}
                                type="button"
                                onClick={() => set('fishAudioReferenceId', voice.id)}
                                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition-all duration-200 ${
                                  (config.fishAudioReferenceId || '13f7f6e260f94079b9d51c961fa6c9e2') === voice.id
                                    ? 'border-cyan-400 bg-cyan-50 shadow-sm shadow-cyan-100'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                }`}
                              >
                                <span className="text-lg">🐟</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className={`text-[13px] font-semibold ${
                                      (config.fishAudioReferenceId || '13f7f6e260f94079b9d51c961fa6c9e2') === voice.id
                                        ? 'text-cyan-700'
                                        : 'text-gray-800'
                                    }`}>{voice.name}</p>
                                    <span className="text-[9px] bg-cyan-100 text-cyan-700 font-bold px-1.5 py-0.5 rounded-full">{voice.badge}</span>
                                  </div>
                                  <p className="text-[11px] text-gray-400">{voice.desc}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playFishPreview(voice.id);
                                  }}
                                  className={`ml-auto flex-shrink-0 p-1.5 rounded-full transition-colors ${
                                    previewingVoice === voice.id
                                      ? 'bg-cyan-500 text-white animate-pulse'
                                      : 'bg-gray-100 hover:bg-cyan-100 text-gray-500 hover:text-cyan-600'
                                  }`}
                                  title="Écouter cette voix"
                                >
                                  {previewingVoice === voice.id ? <span className="text-[10px] font-bold">▶</span> : <span className="text-[10px]">▶</span>}
                                </button>
                                {(config.fishAudioReferenceId || '13f7f6e260f94079b9d51c961fa6c9e2') === voice.id && (
                                  <CheckCircle className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[12px] font-medium text-gray-700 mb-1 block">Modèle</label>
                          <select
                            value={config.fishAudioModel || 's2-pro'}
                            onChange={e => set('fishAudioModel', e.target.value)}
                            className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-white"
                          >
                            <option value="s2-pro">S2-Pro ⭐ (meilleur qualité)</option>
                            <option value="s2">S2 (standard)</option>
                          </select>
                        </div>

                        {/* Bouton preview Fish.audio */}
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            playFishPreview(config.fishAudioReferenceId || '13f7f6e260f94079b9d51c961fa6c9e2');
                          }}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                            previewingVoice === (config.fishAudioReferenceId || '13f7f6e260f94079b9d51c961fa6c9e2')
                              ? 'bg-cyan-500 text-white animate-pulse'
                              : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                          }`}
                        >
                          <span>{previewingVoice === (config.fishAudioReferenceId || '13f7f6e260f94079b9d51c961fa6c9e2') ? '🔊' : '▶'}</span>
                          {previewingVoice === (config.fishAudioReferenceId || '13f7f6e260f94079b9d51c961fa6c9e2') ? 'Lecture en cours...' : 'Écouter la voix sélectionnée'}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 px-3 py-2 bg-cyan-100/60 border border-cyan-200 rounded-lg">
                        <span className="text-cyan-600 text-sm">💡</span>
                        <p className="text-[11px] text-cyan-800">Fish.audio permet de cloner n'importe quelle voix avec une fidélité exceptionnelle. Idéal pour donner une vraie identité vocale à votre agent.</p>
                      </div>
                    </div>
                  )}

                  {/* ── ElevenLabs config (affiché seulement si ElevenLabs sélectionné) ── */}
                  {(config.ttsProvider || 'elevenlabs') === 'elevenlabs' && (<>
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <span className="text-emerald-500 text-sm">&#10003;</span>
                    <p className="text-xs text-emerald-700">
                      <strong>ElevenLabs pré-configuré</strong> &mdash; le mode vocal fonctionne directement. Vous pouvez personnaliser la voix et le modèle ci-dessous.
                    </p>
                  </div>

                  <Field label="Modèle TTS" hint="eleven_v3 recommandé — 70+ langues dont français, arabe, wolof…">
                    <CustomSelect
                      value={config.elevenlabsModel || 'eleven_v3'}
                      onChange={v => set('elevenlabsModel', v)}
                      options={[
                        { value: 'eleven_v3', label: 'Eleven v3 ⭐ (meilleur · 70+ langues · émotions)' },
                        { value: 'eleven_flash_v2_5', label: 'Eleven Flash v2.5 (rapide · 32 langues)' },
                        { value: 'eleven_multilingual_v2', label: 'Eleven Multilingual v2 (classique)' },
                      ]}
                    />
                  </Field>

                  <div className="p-4 bg-white border border-purple-100 rounded-xl space-y-3">
                    <div>
                      <p className="text-[13px] font-semibold text-gray-900">Rendu vocal</p>
                      <p className="text-[11px] text-gray-500">Choisissez si Rita doit avoir une voix plus neutre ou plus réelle dans l'agent WhatsApp.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'balanced', label: 'Standard', desc: 'Stable, clair, polyvalent' },
                        { value: 'natural', label: 'Voix plus réelle', desc: 'Plus naturel, plus humain' },
                      ].map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => set('voiceStylePreset', option.value)}
                          className={`flex flex-col items-start gap-1 px-3 py-3 rounded-xl border-2 transition-all duration-200 ${
                            (config.voiceStylePreset || 'balanced') === option.value
                              ? 'border-purple-500 bg-purple-50/70 shadow-sm shadow-purple-100'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <p className={`text-[13px] font-bold ${(config.voiceStylePreset || 'balanced') === option.value ? 'text-purple-700' : 'text-gray-800'}`}>{option.label}</p>
                          <p className="text-[11px] text-gray-500 text-left leading-tight">{option.desc}</p>
                        </button>
                      ))}
                    </div>
                    {(config.voiceStylePreset || 'balanced') === 'natural' && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <span className="text-emerald-500 text-sm">🎧</span>
                        <p className="text-[11px] text-emerald-700">Le preset <strong>Voix plus réelle</strong> augmente le réalisme et la proximité de Rita pour les réponses vocales WhatsApp.</p>
                      </div>
                    )}
                  </div>

                  {/* Voix présélectionnées */}
                  <div>
                    <p className="text-[12px] font-medium text-gray-500 mb-2">Voix de Rita (cliquer pour sélectionner)</p>
                    <p className="text-[11px] text-purple-600 font-semibold mb-2">🌍 Voix africaines prioritaires</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { id: '9ZATEeixBigmezesCGAk', name: 'Rita ⭐', desc: 'Voix personnalisée · FR · Accent africain naturel — 🇨🇲🇨🇮🇸🇳', badge: '✨ Par défaut' },
                        { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', desc: 'Femme · FR · Chaleureux — 🇨🇮🇨🇲🇸🇳' },
                        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', desc: 'Femme · FR/EN · Doux — 🇨🇲🇲🇦🇸🇳' },
                        { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Aminata', desc: 'Femme · FR · Dynamique — 🇸🇳🇨🇮🇧🇯' },
                        { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', desc: 'Femme · Multilingual · Naturel — 🌍' },
                        { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Kofi', desc: 'Homme · FR · Posé — 🇨🇲🇬🇦🇨🇩' },
                        { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', desc: 'Homme · Multilingual · Posé — 🌍' },
                        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', desc: 'Homme · Multilingual · Pro' },
                      ].map(v => (
                        <button key={v.id} type="button"
                          onClick={() => set('elevenlabsVoiceId', v.id)}
                          className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition-all duration-200 ${
                            config.elevenlabsVoiceId === v.id
                              ? 'border-purple-400 bg-purple-50/70 shadow-sm shadow-purple-100'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                          }`}>
                          <span className="text-lg">🎙️</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-[13px] font-semibold ${
                                config.elevenlabsVoiceId === v.id ? 'text-purple-700' : 'text-gray-800'
                              }`}>{v.name}</p>
                              {v.badge && <span className="text-[9px] bg-purple-100 text-purple-600 font-bold px-1.5 py-0.5 rounded-full">{v.badge}</span>}
                            </div>
                            <p className="text-[11px] text-gray-400">{v.desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => playVoicePreview(v.id, e)}
                            className={`ml-auto flex-shrink-0 p-1.5 rounded-full transition-colors ${
                              previewingVoice === v.id
                                ? 'bg-purple-500 text-white animate-pulse'
                                : 'bg-gray-100 hover:bg-purple-100 text-gray-500 hover:text-purple-600'
                            }`}
                            title="Écouter cette voix">
                            {previewingVoice === v.id
                              ? <span className="text-[10px] font-bold">▶</span>
                              : <span className="text-[10px]">▶</span>
                            }
                          </button>
                          {config.elevenlabsVoiceId === v.id && (
                            <CheckCircle className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  </>)}

                  <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <p className="text-[12px] text-amber-700">
                      ⚠️ En mode vocal, Rita envoie une <strong>note audio</strong> et ne répond plus en texte.
                      Si la génération échoue, elle bascule automatiquement en texte.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Messages d'accusé de réception ─── */}
            {activeSection === 'messages' && (
              <div className="space-y-5">
                {/* Chips variables */}
                <div className="px-4 py-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                  <p className="text-[12px] font-semibold text-indigo-700 mb-2">📌 Variables disponibles — cliquez pour copier</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      '{{first_name}}',
                      '{{order_number}}',
                      '{{product}}',
                      '{{price}}',
                      '{{quantity}}',
                      '{{city}}',
                      '{{client_name}}',
                    ].map(v => (
                      <button key={v}
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText(v); }}
                        className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 text-[11px] font-mono rounded-lg hover:bg-indigo-100 transition-colors duration-150 select-all"
                        title="Cliquer pour copier">
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message villes livrables */}
                <div>
                  <label className="block text-[13px] font-semibold text-gray-800 mb-1">✅ Message — villes où vous livrez</label>
                  <p className="text-[11px] text-gray-400 mb-2">Envoyé automatiquement à la réception d'une commande dans une ville livrable</p>
                  <textarea
                    value={config.orderConfirmationMessage}
                    onChange={e => set('orderConfirmationMessage', e.target.value)}
                    rows={8}
                    className="field-input font-mono text-[12px] leading-relaxed"
                    style={{ resize: 'vertical' }}
                    placeholder={'Bonjour {{first_name}} 👋\n\nNous accusons réception de votre commande n°{{order_number}} ✅\n...'}
                  />
                </div>

                {/* Toggle routage par ville */}
                <div className="px-4 py-3 bg-amber-50/80 border border-amber-100 rounded-2xl">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => set('enableCityRouting', !config.enableCityRouting)}
                      role="switch"
                      aria-checked={config.enableCityRouting}
                      className={`relative flex-shrink-0 w-[44px] h-[26px] rounded-full transition-all duration-200 ${
                        config.enableCityRouting ? 'bg-amber-500' : 'bg-gray-200 hover:bg-gray-300'
                      }`}>
                      <span className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                        config.enableCityRouting ? 'left-[21px]' : 'left-[3px]'
                      }`} />
                    </button>
                    <div>
                      <span className="text-[12px] text-gray-800 font-semibold">🗺️ Activer le routage par ville</span>
                      <p className="text-[11px] text-gray-500 mt-0.5">Si actif : villes configurées ci-dessous → message livrable · autres villes → message non-livrable</p>
                    </div>
                  </label>

                  {config.enableCityRouting && (
                    <div className="mt-4 space-y-3">
                      <p className="text-[12px] font-semibold text-gray-700">🏙️ Villes où vous livrez</p>
                      <div className="flex flex-wrap gap-2">
                        {(config.deliverableZones || []).map((zone, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-200 text-amber-800 text-[12px] font-medium rounded-full">
                            {zone}
                            <button
                              type="button"
                              onClick={() => set('deliverableZones', config.deliverableZones.filter((_, idx) => idx !== i))}
                              className="text-amber-400 hover:text-red-500 transition-colors duration-150 leading-none font-bold ml-0.5">
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newDeliverableZone}
                          onChange={e => setNewDeliverableZone(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const v = newDeliverableZone.trim();
                              if (v && !config.deliverableZones.includes(v)) {
                                set('deliverableZones', [...(config.deliverableZones || []), v]);
                                setNewDeliverableZone('');
                              }
                            }
                          }}
                          placeholder="Ex : Yaoundé, Douala..."
                          className="field-input flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const v = newDeliverableZone.trim();
                            if (v && !config.deliverableZones.includes(v)) {
                              set('deliverableZones', [...(config.deliverableZones || []), v]);
                              setNewDeliverableZone('');
                            }
                          }}
                          className="px-4 py-2 bg-amber-500 text-white text-[12px] font-medium rounded-xl hover:bg-amber-600 transition-colors duration-150">
                          + Ajouter
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message villes non livrables */}
                {config.enableCityRouting && (
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-800 mb-1">🚫 Message — villes hors zone de livraison</label>
                      <p className="text-[11px] text-gray-400 mb-2">Envoyé automatiquement si la ville de la commande n'est pas dans votre liste de villes livrables. Utilisez <code className="bg-gray-100 px-1 rounded">{'{{city}}'}</code> pour afficher la ville.</p>
                    <textarea
                      value={config.orderConfirmationMessageNonDeliverable}
                      onChange={e => set('orderConfirmationMessageNonDeliverable', e.target.value)}
                      rows={7}
                      className="field-input font-mono text-[12px] leading-relaxed"
                      style={{ resize: 'vertical' }}
                      placeholder={'Bonjour {{first_name}} 👋\n\nNous ne livrons pas encore dans votre ville ({{city}})...'}
                    />
                  </div>
                )}
              </div>
            )}

            {activeSection === 'availability' && (
              <div className="space-y-4">
                <ToggleRow enabled={config.businessHoursOnly} onChange={v => set('businessHoursOnly', v)}
                  label="Restreindre aux heures d'ouverture"
                  desc="Hors horaires, Rita envoie le message de transfert et se met en veille" />
                {config.businessHoursOnly && (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <Field label="Ouverture"><input type="time" value={config.businessHoursStart} onChange={e => set('businessHoursStart', e.target.value)} className="field-input" /></Field>
                    <Field label="Fermeture"><input type="time" value={config.businessHoursEnd} onChange={e => set('businessHoursEnd', e.target.value)} className="field-input" /></Field>
                  </div>
                )}
                <div className="mt-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-[12px] text-gray-500">
                  Rita est configurée en {autonomyInfo.label} · {config.followUpEnabled ? `Relances après ${config.followUpDelay}h.` : 'Relances désactivées.'} {config.canCloseDeals ? 'Peut conclure des ventes.' : ''}
                </div>
              </div>
            )}

          </div>
        </div>

      {/* ─── Agent Actif + Test section (shown only after save) ─── */}
      {configSaved && !showConfig && (
        <div className="space-y-4">

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Statut', value: config.enabled ? 'Actif' : 'En pause', color: config.enabled ? 'text-emerald-600' : 'text-gray-400', icon: config.enabled ? '🟢' : '⏸️' },
              { label: 'Autonomie', value: autonomyInfo.label, color: 'text-purple-600', icon: '🧠' },
              { label: 'Instances', value: `${instances.length}`, color: 'text-blue-600', icon: '📱' },
              { label: 'Technique', value: config.closingTechnique === 'soft' ? 'Douce' : config.closingTechnique === 'urgency' ? 'Urgence' : config.closingTechnique === 'social-proof' ? 'Sociale' : 'Valeur', color: 'text-amber-600', icon: '🎯' },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-200/80 rounded-2xl px-4 py-3.5 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.05)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-shadow duration-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">{s.icon}</span>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</span>
                </div>
                <p className={`text-[15px] font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Knowledge summary */}
          {(config.businessContext || config.products || config.faq || config.productCatalog?.length > 0) && (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <p className="text-[13px] font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-base">📚</span> Base de connaissances
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {config.businessContext && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-gray-500 mb-1">Contexte</p>
                    <p className="text-[12px] text-gray-700 line-clamp-2">{config.businessContext}</p>
                  </div>
                )}
                {config.productCatalog?.length > 0 && (
                  <div className="bg-purple-50 rounded-lg px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-purple-600 mb-1">🛒 Produits</p>
                    <p className="text-[12px] text-gray-700">{config.productCatalog.length} produit{config.productCatalog.length > 1 ? 's' : ''} configuré{config.productCatalog.length > 1 ? 's' : ''}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{config.productCatalog.filter(p => p.images?.length).length} avec photos · {config.productCatalog.reduce((n, p) => n + (p.faq?.length || 0), 0)} FAQ</p>
                  </div>
                )}
                {config.products && !config.productCatalog?.length && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-gray-500 mb-1">Produits</p>
                    <p className="text-[12px] text-gray-700 line-clamp-2">{config.products}</p>
                  </div>
                )}
                {config.faq && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-gray-500 mb-1">FAQ</p>
                    <p className="text-[12px] text-gray-700 line-clamp-2">{config.faq}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Simulator */}
          <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <Send className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-gray-900">Tester l'agent</p>
                  <p className="text-[11px] text-gray-400">Simulez une conversation comme un vrai client WhatsApp</p>
                </div>
              </div>
              <button onClick={resetSim} className="text-[12px] font-medium text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                ↺ Recommencer
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

              {/* Left: Agent info panel */}
              <div className="bg-[radial-gradient(circle_at_top,_rgba(236,253,245,0.9),_rgba(249,250,251,0.95)_45%,_rgba(255,255,255,1)_100%)] p-5 space-y-4 lg:order-1">
                <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Style conversation</p>
                  <p className="mt-2 text-[13px] leading-6 text-gray-700">Rita doit répondre comme une vendeuse camerounaise: simple, rassurante, sans blabla, sans signature à la fin.</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Identité</p>
                    <p className="mt-2 text-[14px] font-semibold text-gray-900">{config.agentName || 'Rita'}</p>
                    <p className="text-[12px] text-gray-500">{config.agentRole || 'Conseillère commerciale'} · {config.language === 'fr' ? 'Français' : config.language}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <p className="text-[10px] font-semibold text-gray-400">Ton</p>
                      <p className="mt-1 text-[12px] text-gray-700">Naturel</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <p className="text-[10px] font-semibold text-gray-400">Signature</p>
                      <p className="mt-1 text-[12px] text-gray-700">Désactivée</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Règle critique</p>
                  <p className="mt-2 text-[13px] leading-6 text-amber-900">Pas d'invention sur le prix, la livraison, le stock ou les produits. Si l'info manque, Rita doit vérifier ou demander une précision.</p>
                </div>
              </div>

              {/* Chat area */}
              <div className="lg:order-2">
                {/* WhatsApp header */}
                <div className="px-4 py-3 bg-[linear-gradient(135deg,#075E54_0%,#0b7a6d_100%)] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-300 to-teal-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
                    {config.agentName?.[0]?.toUpperCase() || 'R'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[14px] font-semibold">{config.agentName || 'Rita'}</p>
                    <p className="text-emerald-200 text-[11px]">{simTyping ? 'en train d\'écrire...' : 'vendeuse en ligne'}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 bg-white/15 text-white border border-white/10">Chat test</span>
                </div>

                {/* Chat messages */}
                <div className="h-[420px] overflow-y-auto px-4 py-4 bg-[linear-gradient(180deg,#efeae2_0%,#f5efe6_100%)] flex flex-col gap-3 relative">
                  <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0f172a 0.6px, transparent 0.6px)', backgroundSize: '18px 18px' }} />
                  <div className="text-center flex-shrink-0">
                    <span className="inline-block px-3 py-1 bg-white/85 text-[10px] text-gray-500 rounded-lg shadow-sm backdrop-blur-sm relative z-10">Simulation client WhatsApp</span>
                  </div>
                  {simMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} flex-shrink-0 relative z-10`}>
                      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm border ${msg.role === 'user' ? 'bg-[#dcf8c6] border-emerald-100 rounded-tr-sm' : 'bg-white border-white/70 rounded-tl-sm'}`}>
                        {msg.role === 'agent' && (
                          <p className="text-[10px] font-semibold text-emerald-700 mb-1">
                            {config.agentName || 'Rita'}
                          </p>
                        )}
                        <p className="text-[13px] text-gray-800 leading-6">{msg.text}</p>
                        <p className="text-[9px] text-gray-400 mt-1 text-right">{msg.time}</p>
                      </div>
                    </div>
                  ))}
                  {simTyping && (
                    <div className="flex justify-start flex-shrink-0 relative z-10">
                      <div className="bg-white rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm border border-white/70">
                        <p className="text-[10px] font-semibold text-emerald-700 mb-1">{config.agentName || 'Rita'}</p>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '180ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '360ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={simEndRef} />
                </div>

                {/* Quick replies */}
                <div className="px-3 py-2 border-t border-gray-100 bg-[#f8f8f8] flex gap-1.5 overflow-x-auto">
                  {["Vous avez ça ?", "C'est combien ?", "Vous livrez sur Akwa ?", "Ok je prends", "Vous avez aussi un savon ?"].map(s => (
                    <button key={s} onClick={() => setSimInput(s)}
                      className="flex-shrink-0 px-2.5 py-1 bg-white border border-gray-200 text-[11px] text-gray-600 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors whitespace-nowrap">
                      {s}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="px-3 py-2.5 bg-[#f0f0f0] flex items-center gap-2">
                  <input value={simInput} onChange={e => setSimInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSimSend()}
                    placeholder="Tapez un message comme un client..."
                    className="flex-1 bg-white rounded-full px-4 py-2 text-[13px] outline-none border border-transparent focus:border-gray-300" />
                  <button onClick={handleSimSend} disabled={!simInput.trim() || simTyping}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-opacity disabled:opacity-40"
                    style={{ background: '#075E54' }}>
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default WhatsAppService;
