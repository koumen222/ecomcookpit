import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  scalorGetDashboard, scalorCreateInstance, scalorGetQrCode,
  scalorDeleteInstance, scalorDisconnectInstance, scalorRestartInstance,
  scalorCreateApiKey, scalorDeleteApiKey, scalorLoginFromEcom,
  getScalorToken, setScalorSession, clearScalorSession,
  scalorSendText, scalorListInstances, scalorGetMe,
  scalorGetMessageLogs, scalorSetWebhook
} from '../services/scalorApi';
import {
  loginProviderFromEcom,
  getProviderMe, listProviderInstances, createProviderInstance,
  deleteProviderInstance, refreshProviderToken,
  providerStorage
} from '../services/providerApi';

/* ─────────────────────────── tiny helpers ─────────────────────────── */
const Badge = ({ color = 'gray', children }) => {
  const cls = {
    green: 'bg-emerald-100 text-emerald-700',
    red:   'bg-red-100 text-red-700',
    yellow:'bg-yellow-100 text-yellow-700',
    gray:  'bg-gray-100 text-gray-600',
    blue:  'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls[color] || cls.gray}`}>
      {children}
    </span>
  );
};

const statusColor = (s = '') => {
  if (s === 'connected' || s === 'open') return 'green';
  if (s === 'disconnected' || s === 'close') return 'red';
  if (s === 'connecting' || s === 'awaiting_qr') return 'yellow';
  return 'gray';
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>{children}</div>
);

const Btn = ({ onClick, disabled, variant = 'primary', size = 'sm', children, type = 'button', className = '' }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3.5 py-1.5 text-sm', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-[#0F6B4F] hover:bg-[#0d5c43] text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
    danger: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200',
    outline: 'border border-gray-200 hover:bg-gray-50 text-gray-700',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="space-y-1">
    {label && <label className="block text-xs font-medium text-gray-600">{label}</label>}
    <input
      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]/20 focus:border-[#0F6B4F]"
      {...props} />
  </div>
);

function normalizeProviderInstance(inst) {
  if (!inst) return null;
  return {
    id: String(inst.id || inst._id || ''),
    name: inst.name || inst.workspaceName || 'Instance',
    slug: inst.slug || '',
    subdomain: inst.subdomain || '',
    status: inst.status || 'active',
    createdAt: inst.createdAt,
    accessUrl: inst.accessUrl || (inst.subdomain ? `https://${inst.subdomain}.scalor.net` : null)
  };
}

const Alert = ({ type = 'error', msg, onClose }) => {
  if (!msg) return null;
  const cls = type === 'error'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${cls}`}>
      <span>{msg}</span>
      <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
    </div>
  );
};

const TABS = [
  { id: 'instances', label: 'Instances WhatsApp' },
  { id: 'api-keys',  label: 'Clés API' },
  { id: 'logs',      label: 'Logs' },
  { id: 'provider',  label: 'Provider' },
  { id: 'docs',      label: 'Référence API' },
];

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function DeveloperSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'instances');

  const changeTab = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab !== 'instances' ? { tab } : {}, { replace: true });
  };

  /* ── Scalor auth state ── */
  const [scalorToken, setScalorToken] = useState(() => getScalorToken());
  const [scalorUser, setScalorUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('scalor_user') || 'null'); } catch { return null; }
  });
  const [scalorAuthLoading, setScalorAuthLoading] = useState(!getScalorToken());
  const [scalorAuthError, setScalorAuthError]   = useState('');

  // Auto-init Scalor session from ecom JWT on mount (no manual login needed)
  useEffect(() => {
    if (getScalorToken()) return; // already have a token
    setScalorAuthLoading(true);
    scalorLoginFromEcom()
      .then(data => {
        setScalorToken(data.token);
        setScalorUser(data.user);
      })
      .catch(() => {
        // Silently fail — user will see a retry button
        setScalorAuthError('Impossible de récupérer la session Scalor automatiquement.');
      })
      .finally(() => setScalorAuthLoading(false));
  }, []);

  /* ── Scalor data ── */
  const [instances, setInstances]   = useState([]);
  const [apiKeys, setApiKeys]       = useState([]);
  const [logs, setLogs]             = useState([]);
  const [dashboard, setDashboard]   = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError]   = useState('');
  const [dataMsg, setDataMsg]       = useState('');

  /* ── Instance form / modal ── */
  const [showCreateInst, setShowCreateInst] = useState(false);
  const [instForm, setInstForm]       = useState({ displayName: '' });
  const [qrData, setQrData]           = useState(null); // { instanceId, qr }
  const [webhookEdit, setWebhookEdit] = useState(null); // { instanceId, url }

  /* ── API key form ── */
  const [showCreateKey, setShowCreateKey]   = useState(false);
  const [keyForm, setKeyForm]               = useState({ name: '', type: 'standard' });
  const [newRawKey, setNewRawKey]           = useState('');

  /* ── Provider state ── */
  const [provToken, setProvToken]       = useState(() => providerStorage.getToken());
  const [provProfile, setProvProfile]   = useState(() => providerStorage.getProfile());
  const [provInstances, setProvInstances] = useState([]);
  const [provLoading, setProvLoading]   = useState(false);
  const [provInitLoading, setProvInitLoading] = useState(!providerStorage.getToken());
  const [provError, setProvError]       = useState('');
  const [provMsg, setProvMsg]           = useState('');
  const [provInstForm, setProvInstForm] = useState({ name: '', subdomain: '', currency: 'XAF' });

  /* ───────────────────── Scalor data loaders ───────────────────── */
  const loadInstances = useCallback(async () => {
    if (!getScalorToken()) return;
    try {
      const res = await scalorListInstances();
      setInstances(res?.instances || res?.data?.instances || []);
    } catch { /* silent */ }
  }, []);

  const loadApiKeys = useCallback(async () => {
    if (!getScalorToken()) return;
    try {
      const res = await scalorGetMe();
      setApiKeys(res?.apiKeys || res?.data?.apiKeys || []);
    } catch { /* silent */ }
  }, []);

  const loadLogs = useCallback(async () => {
    if (!getScalorToken()) return;
    try {
      const res = await scalorGetMessageLogs();
      let loadedLogs = res?.logs || res?.data?.logs || [];

      // Fallback: dashboard recentMessages can still provide useful history
      // when message/log endpoint is unavailable in current backend runtime.
      if (!loadedLogs.length) {
        const dash = await scalorGetDashboard();
        loadedLogs = dash?.recentMessages || [];
      }

      setLogs(loadedLogs);
    } catch (err) {
      setLogs([]);
      setDataError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Impossible de charger les logs');
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!getScalorToken()) return;
    try {
      const res = await scalorGetDashboard();
      setDashboard(res?.data || res);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!scalorToken) return;
    loadInstances();
    loadApiKeys();
    loadDashboard();
  }, [scalorToken, loadInstances, loadApiKeys, loadDashboard]);

  useEffect(() => {
    if (scalorToken && activeTab === 'logs') loadLogs();
  }, [scalorToken, activeTab, loadLogs]);

  /* ───────────────────── Instance handlers ───────────────────── */
  const handleCreateInstance = async (e) => {
    e.preventDefault();
    if (!instForm.displayName.trim()) return;
    setDataLoading(true); setDataError(''); setDataMsg('');
    try {
      await scalorCreateInstance({ displayName: instForm.displayName.trim() });
      setDataMsg('Instance créée !');
      setInstForm({ displayName: '' });
      setShowCreateInst(false);
      await loadInstances();
    } catch (err) {
      setDataError(err.response?.data?.error || err.message);
    } finally { setDataLoading(false); }
  };

  const handleDeleteInstance = async (id) => {
    if (!confirm('Supprimer cette instance ?')) return;
    setDataLoading(true); setDataError('');
    try {
      await scalorDeleteInstance(id);
      setDataMsg('Instance supprimée.');
      await loadInstances();
    } catch (err) {
      setDataError(err.response?.data?.error || err.message);
    } finally { setDataLoading(false); }
  };

  const handleDisconnectInstance = async (id) => {
    setDataLoading(true); setDataError('');
    try {
      await scalorDisconnectInstance(id);
      setDataMsg('Instance déconnectée.');
      await loadInstances();
    } catch (err) {
      setDataError(err.response?.data?.error || err.message);
    } finally { setDataLoading(false); }
  };

  const handleRestartInstance = async (id) => {
    setDataLoading(true); setDataError('');
    try {
      await scalorRestartInstance(id);
      setDataMsg('Instance redémarrée.');
      await loadInstances();
    } catch (err) {
      setDataError(err.response?.data?.error || err.message);
    } finally { setDataLoading(false); }
  };

  const handleGetQr = async (id, forceRefresh = false) => {
    setDataError('');
    try {
      const res = await scalorGetQrCode(id, forceRefresh);
      setQrData({ instanceId: id, qr: res?.qrcode || res?.qrCode || res?.data?.qrcode || res?.data?.qrCode || res?.qr });
    } catch (err) {
      setDataError(err.response?.data?.error || err.message);
    }
  };

  const handleSetWebhook = async (e) => {
    e.preventDefault();
    if (!webhookEdit) return;
    setDataLoading(true); setDataError('');
    try {
      await scalorSetWebhook(webhookEdit.instanceId, { webhookUrl: webhookEdit.url });
      setDataMsg('Webhook mis à jour.');
      setWebhookEdit(null);
    } catch (err) {
      setDataError(err.response?.data?.error || err.message);
    } finally { setDataLoading(false); }
  };

  /* ───────────────────── API key handlers ───────────────────── */
  const handleCreateKey = async (e) => {
    e.preventDefault();
    setDataLoading(true); setDataError(''); setDataMsg('');
    try {
      const res = await scalorCreateApiKey({ name: keyForm.name, type: keyForm.type });
      setNewRawKey(res?.apiKey || res?.data?.apiKey || res?.rawKey || '');
      setDataMsg('Clé créée — copiez-la maintenant, elle ne sera plus visible.');
      setKeyForm({ name: '', type: 'standard' });
      setShowCreateKey(false);
      await loadApiKeys();
    } catch (err) {
      setDataError(err.response?.data?.error || err.message);
    } finally { setDataLoading(false); }
  };

  const handleDeleteKey = async (id) => {
    if (!confirm('Révoquer cette clé ?')) return;
    setDataLoading(true); setDataError('');
    try {
      await scalorDeleteApiKey(id);
      setDataMsg('Clé révoquée.');
      await loadApiKeys();
    } catch (err) {
      setDataError(err.response?.data?.error || err.message);
    } finally { setDataLoading(false); }
  };

  /* ───────────────────── Provider handlers ───────────────────── */
  const loadProviderDashboard = useCallback(async () => {
    if (!providerStorage.getToken()) return;
    setProvLoading(true);
    try {
      const [meRes, instRes] = await Promise.all([getProviderMe(), listProviderInstances()]);
      setProvProfile(meRes?.data || null);
      const rawInstances = instRes?.data?.instances || instRes?.instances || [];
      setProvInstances((rawInstances || []).map(normalizeProviderInstance).filter(Boolean));
    } catch (err) { setProvError(err.message); }
    finally { setProvLoading(false); }
  }, []);

  useEffect(() => {
    if (provToken) loadProviderDashboard();
  }, [provToken, loadProviderDashboard]);

  useEffect(() => {
    if (providerStorage.getToken()) {
      setProvInitLoading(false);
      return;
    }

    setProvInitLoading(true);
    loginProviderFromEcom()
      .then((res) => {
        setProvToken(res?.data?.token || '');
        setProvProfile(res?.data?.provider || null);
      })
      .catch((err) => {
        setProvError(err.message || 'Connexion provider automatique impossible');
      })
      .finally(() => setProvInitLoading(false));
  }, []);

  const handleProvCreateInst = async (e) => {
    e.preventDefault();
    if (!provInstForm.name.trim()) return;
    setProvLoading(true); setProvError(''); setProvMsg('');
    try {
      const created = await createProviderInstance({
        name: provInstForm.name.trim(),
        subdomain: provInstForm.subdomain.trim() || undefined,
        settings: { currency: provInstForm.currency, businessType: 'ecommerce', providerManaged: true }
      });

      const createdInstance = normalizeProviderInstance(created?.instance || created?.data?.instance);
      if (createdInstance?.id) {
        setProvInstances(prev => {
          const withoutDup = prev.filter(i => i.id !== createdInstance.id);
          return [createdInstance, ...withoutDup];
        });
      }

      setProvMsg('Instance créée !');
      setProvInstForm({ name: '', subdomain: '', currency: 'XAF' });
      await loadProviderDashboard();
    } catch (err) { setProvError(err.message); }
    finally { setProvLoading(false); }
  };

  const handleProvDeleteInst = async (instId) => {
    if (!confirm('Supprimer cette instance provider ?')) return;
    setProvLoading(true); setProvError(''); setProvMsg('');
    try {
      await deleteProviderInstance(instId);
      setProvMsg('Instance supprimée.');
      await loadProviderDashboard();
    } catch (err) { setProvError(err.message); }
    finally { setProvLoading(false); }
  };

  const handleProvLogout = () => {
    providerStorage.clear();
    setProvToken('');
    setProvProfile(null);
    setProvInstances([]);
  };

  /* ═══════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div className="space-y-5 pb-10">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Développeur</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gérez vos instances WhatsApp, clés API et intégrations via l'API Scalor v1.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-gray-100 pb-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => changeTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#0F6B4F] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Global alerts */}
      <Alert type="error"   msg={dataError} onClose={() => setDataError('')} />
      <Alert type="success" msg={dataMsg}   onClose={() => setDataMsg('')} />

      {/* Auto-init loading / error state */}
      {scalorAuthLoading && (
        <div className="flex items-center gap-3 text-sm text-gray-500 py-4">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-[#0F6B4F] rounded-full animate-spin" />
          Initialisation de la session API…
        </div>
      )}
      {!scalorAuthLoading && scalorAuthError && !scalorToken && (
        <Card className="p-5 flex items-center justify-between gap-4">
          <p className="text-sm text-red-600">{scalorAuthError}</p>
          <Btn variant="outline" onClick={() => {
            setScalorAuthError('');
            setScalorAuthLoading(true);
            scalorLoginFromEcom()
              .then(d => { setScalorToken(d.token); setScalorUser(d.user); })
              .catch(() => setScalorAuthError('Connexion échouée. Vérifiez le serveur.'))
              .finally(() => setScalorAuthLoading(false));
          }}>Réessayer</Btn>
        </Card>
      )}

      {/* ═══════════════ INSTANCES TAB ═══════════════ */}
      {activeTab === 'instances' && scalorToken && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Vos instances WhatsApp</h2>
              <p className="text-xs text-gray-400 mt-0.5">{instances.length} instance{instances.length > 1 ? 's' : ''}</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={loadInstances} disabled={dataLoading}>Rafraîchir</Btn>
              <Btn onClick={() => setShowCreateInst(true)}>+ Nouvelle instance</Btn>
            </div>
          </div>

          {/* Create form */}
          {showCreateInst && (
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Créer une instance</h3>
              <form onSubmit={handleCreateInstance} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-48">
                  <Input label="Nom de l'instance" placeholder="Ex: Support Client" required value={instForm.displayName}
                    onChange={e => setInstForm({ displayName: e.target.value })} />
                </div>
                <Btn type="submit" disabled={dataLoading}>
                  {dataLoading ? 'Création...' : 'Créer'}
                </Btn>
                <Btn variant="secondary" onClick={() => setShowCreateInst(false)}>Annuler</Btn>
              </form>
            </Card>
          )}

          {/* QR modal */}
          {qrData && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Scanner le QR code</h3>
                <div className="flex items-center gap-2">
                  <Btn variant="secondary" size="sm" onClick={() => handleGetQr(qrData.instanceId, true)}>Actualiser QR</Btn>
                  <Btn variant="secondary" size="sm" onClick={() => setQrData(null)}>Fermer</Btn>
                </div>
              </div>
              {qrData.qr ? (
                <img src={qrData.qr} alt="QR Code WhatsApp" className="w-48 h-48 mx-auto" />
              ) : (
                <p className="text-sm text-gray-500 text-center">QR en attente de génération…</p>
              )}
            </Card>
          )}

          {/* Webhook edit */}
          {webhookEdit && (
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Configurer le webhook</h3>
              <form onSubmit={handleSetWebhook} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-60">
                  <Input label="URL Webhook" type="url" placeholder="https://votre-serveur.com/webhook" required value={webhookEdit.url}
                    onChange={e => setWebhookEdit(w => ({ ...w, url: e.target.value }))} />
                </div>
                <Btn type="submit" disabled={dataLoading}>Enregistrer</Btn>
                <Btn variant="secondary" onClick={() => setWebhookEdit(null)}>Annuler</Btn>
              </form>
            </Card>
          )}

          {/* List */}
          <Card>
            {instances.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-gray-400 text-sm">Aucune instance — créez-en une pour commencer.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {instances.map(inst => (
                  <div key={inst._id || inst.instanceName} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">{inst.displayName || inst.instanceName}</p>
                          <Badge color={statusColor(inst.status)}>{inst.status || 'inconnu'}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-400">
                          <span className="font-mono">{inst.instanceName}</span>
                          {inst.phoneNumber && <span>Tel: {inst.phoneNumber}</span>}
                          {inst.webhookUrl && <span className="truncate max-w-48">Webhook: {inst.webhookUrl}</span>}
                          {inst.createdAt && <span>{new Date(inst.createdAt).toLocaleDateString('fr-FR')}</span>}
                        </div>
                        {(inst.messagesSentToday > 0 || inst.messagesSentThisMonth > 0) && (
                          <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                            <span>Aujourd'hui: <strong className="text-gray-600">{inst.messagesSentToday || 0}</strong> msg</span>
                            <span>Ce mois: <strong className="text-gray-600">{inst.messagesSentThisMonth || 0}</strong> msg</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <Btn variant="outline" size="sm" onClick={() => handleGetQr(inst._id)}>QR Code</Btn>
                        <Btn variant="outline" size="sm" onClick={() => setWebhookEdit({ instanceId: inst._id, url: inst.webhookUrl || '' })}>Webhook</Btn>
                        <Btn variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(inst._id); setDataMsg('ID copié : ' + inst._id); }}>Copier ID</Btn>
                        {(inst.status === 'connected' || inst.status === 'open') && (
                          <Btn variant="secondary" size="sm" onClick={() => handleDisconnectInstance(inst._id)}>Déconnecter</Btn>
                        )}
                        {(inst.status === 'disconnected' || inst.status === 'close' || inst.status === 'error') && (
                          <Btn variant="secondary" size="sm" onClick={() => handleRestartInstance(inst._id)}>Redémarrer</Btn>
                        )}
                        <Btn variant="danger" size="sm" onClick={() => handleDeleteInstance(inst._id)}>Supprimer</Btn>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══════════════ API KEYS TAB ═══════════════ */}
      {activeTab === 'api-keys' && scalorToken && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Clés API</h2>
              <p className="text-xs text-gray-400 mt-0.5">{apiKeys.length} clé{apiKeys.length > 1 ? 's' : ''} · max 5</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={loadApiKeys} disabled={dataLoading}>Rafraîchir</Btn>
              <Btn onClick={() => setShowCreateKey(true)}>+ Nouvelle clé</Btn>
            </div>
          </div>

          {/* Newly created key banner — show full raw key for copy */}
          {newRawKey && (
            <Card className="p-4 border-emerald-200 bg-emerald-50">
              <div className="flex items-start gap-3">
                <span className="text-emerald-600 text-lg mt-0.5">🔑</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-700 mb-1.5">Votre nouvelle clé API (copiez-la maintenant, elle ne sera plus visible) :</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-sm break-all bg-white rounded-lg px-3 py-2 border border-emerald-200 select-all">
                      {newRawKey}
                    </code>
                    <Btn variant="primary" size="sm"
                      onClick={() => { navigator.clipboard.writeText(newRawKey); setDataMsg('Clé copiée dans le presse-papier !'); }}>
                      Copier
                    </Btn>
                  </div>
                  <Btn variant="secondary" size="sm" className="mt-2"
                    onClick={() => setNewRawKey('')}>
                    J'ai copié, fermer
                  </Btn>
                </div>
              </div>
            </Card>
          )}

          {/* Create form */}
          {showCreateKey && (
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Créer une clé API</h3>
              <form onSubmit={handleCreateKey} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-40">
                  <Input label="Nom de la clé" placeholder="Ex: Production, Test, Webhook" required value={keyForm.name}
                    onChange={e => setKeyForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={keyForm.type} onChange={e => setKeyForm(f => ({ ...f, type: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]/20">
                    <option value="live">Live</option>
                    <option value="test">Test</option>
                  </select>
                </div>
                <Btn type="submit" disabled={dataLoading}>
                  {dataLoading ? 'Création...' : 'Créer'}
                </Btn>
                <Btn variant="secondary" onClick={() => setShowCreateKey(false)}>Annuler</Btn>
              </form>
            </Card>
          )}

          {/* Keys list */}
          <Card>
            {apiKeys.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-gray-400 text-sm">Aucune clé API — créez-en une pour commencer.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {apiKeys.map(key => (
                  <div key={key._id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{key.name || 'Clé sans nom'}</p>
                          <Badge color={key.isActive !== false ? 'green' : 'red'}>
                            {key.isActive !== false ? 'Active' : 'Révoquée'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-400">
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{key.keyPrefix}…</span>
                          {key.permissions?.length > 0 && (
                            <span>Permissions: {key.permissions.join(', ')}</span>
                          )}
                          {key.createdAt && (
                            <span>Créée le {new Date(key.createdAt).toLocaleDateString('fr-FR')}</span>
                          )}
                          {key.lastUsedAt && (
                            <span>Dernière utilisation: {new Date(key.lastUsedAt).toLocaleDateString('fr-FR')}</span>
                          )}
                          {key.expiresAt && (
                            <span className={new Date(key.expiresAt) < new Date() ? 'text-red-500' : ''}>
                              Expire le {new Date(key.expiresAt).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <Btn variant="outline" size="sm" onClick={() => {
                          navigator.clipboard.writeText(key.keyPrefix);
                          setDataMsg('Préfixe copié : ' + key.keyPrefix);
                        }}>Copier préfixe</Btn>
                        {key.isActive !== false && (
                          <Btn variant="danger" size="sm" onClick={() => handleDeleteKey(key._id)}>Révoquer</Btn>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══════════════ LOGS TAB ═══════════════ */}
      {activeTab === 'logs' && scalorToken && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Logs de messages</h2>
            <Btn variant="outline" onClick={loadLogs}>Rafraîchir</Btn>
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  {['Date','Instance','Numéro','Type','Statut','Durée'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Aucun log</td></tr>
                )}
                {logs.map(log => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {new Date(log.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.instanceId?.displayName || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.phoneNumber || log.recipientNumber || '-'}</td>
                    <td className="px-4 py-3"><Badge>{log.messageType}</Badge></td>
                    <td className="px-4 py-3">
                      <Badge color={log.status === 'sent' ? 'green' : log.status === 'failed' ? 'red' : 'yellow'}>
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{log.processingTime ? `${log.processingTime}ms` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ═══════════════ PROVIDER TAB ═══════════════ */}
      {activeTab === 'provider' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Provider Console</h2>
            {provToken && (
              <Btn variant="danger" size="sm" onClick={handleProvLogout}>Déconnexion provider</Btn>
            )}
          </div>

          <Alert type="error"   msg={provError} onClose={() => setProvError('')} />
          <Alert type="success" msg={provMsg}   onClose={() => setProvMsg('')} />

          {/* Not connected */}
          {!provToken && (
            <Card className="p-6 max-w-lg">
              {provInitLoading ? (
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-[#0F6B4F] rounded-full animate-spin" />
                  Initialisation automatique du Provider...
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Connexion automatique Provider indisponible.</p>
                  <Btn variant="outline" onClick={() => {
                    setProvError('');
                    setProvInitLoading(true);
                    loginProviderFromEcom()
                      .then((res) => {
                        setProvToken(res?.data?.token || '');
                        setProvProfile(res?.data?.provider || null);
                      })
                      .catch((err) => setProvError(err.message || 'Connexion provider automatique impossible'))
                      .finally(() => setProvInitLoading(false));
                  }}>
                    Réessayer
                  </Btn>
                </div>
              )}
            </Card>
          )}

          {/* Connected */}
          {provToken && (
            <div className="space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-xs text-gray-500 mb-1">Token</p>
                  <p className="font-mono text-sm text-gray-800 break-all">
                    {provToken.length > 24 ? `${provToken.slice(0,12)}…${provToken.slice(-8)}` : provToken}
                  </p>
                  <Btn variant="secondary" size="sm" className="mt-3"
                    onClick={async () => {
                      setProvLoading(true);
                      try { const r = await refreshProviderToken(); setProvToken(r?.data?.token || ''); setProvMsg('Token rafraîchi.'); }
                      catch (err) { setProvError(err.message); }
                      finally { setProvLoading(false); }
                    }}>
                    Rafraîchir token
                  </Btn>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-gray-500 mb-1">Entreprise</p>
                  <p className="font-semibold text-gray-900">{provProfile?.company || '-'}</p>
                  <p className="text-sm text-gray-500">{provProfile?.email || '-'}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-gray-500 mb-1">Instances</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {provInstances.length}
                    <span className="text-sm font-normal text-gray-400"> / {provProfile?.limits?.instanceLimit ?? 10}</span>
                  </p>
                </Card>
              </div>

              {/* Create instance */}
              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Créer une instance</h3>
                <form onSubmit={handleProvCreateInst} className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-40">
                    <Input label="Nom" required value={provInstForm.name}
                      onChange={e => setProvInstForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="flex-1 min-w-36">
                    <Input label="Subdomain (optionnel)" value={provInstForm.subdomain}
                      onChange={e => setProvInstForm(f => ({ ...f, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'') }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Devise</label>
                    <select value={provInstForm.currency}
                      onChange={e => setProvInstForm(f => ({ ...f, currency: e.target.value }))}
                      className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]/20">
                      {['XAF','XOF','USD','EUR'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <Btn type="submit" disabled={provLoading}>
                    {provLoading ? 'Création...' : '+ Créer'}
                  </Btn>
                </form>
              </Card>

              {/* Provider instances list */}
              <Card>
                <div className="flex items-center justify-between p-4 border-b border-gray-50">
                  <h3 className="font-semibold text-gray-900">Mes instances</h3>
                  <Btn variant="outline" size="sm" onClick={loadProviderDashboard} disabled={provLoading}>
                    Rafraîchir
                  </Btn>
                </div>
                <div className="divide-y divide-gray-50">
                  {provInstances.length === 0 && (
                    <div className="p-10 text-center text-gray-400 text-sm">Aucune instance provider.</div>
                  )}
                  {provInstances.map(inst => (
                    <div key={String(inst.id)} className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{inst.name}</p>
                          <p className="text-xs text-gray-400">slug: {inst.slug || '-'} · status: {inst.status || '-'}</p>
                          {inst.accessUrl && (
                            <a href={inst.accessUrl} target="_blank" rel="noreferrer"
                              className="text-xs text-[#0F6B4F] hover:underline mt-0.5 inline-block">
                              Ouvrir la boutique ↗
                            </a>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Btn variant="danger" size="sm" onClick={() => handleProvDeleteInst(inst.id)}>Supprimer</Btn>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ DOCS TAB ═══════════════ */}
      {activeTab === 'docs' && (
        <div className="space-y-5">
          <h2 className="font-semibold text-gray-900">Référence API v1</h2>

          {/* Base URL & Auth */}
          <Card className="p-6 space-y-5 text-sm">
            <div>
              <p className="font-semibold text-gray-700 mb-2">Base URL (API publique)</p>
              <code className="block bg-gray-50 rounded-xl px-4 py-3 text-[#0F6B4F] font-mono">
                https://api.scalor.net/api/v1
              </code>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-2">Authentification</p>
              <p className="text-gray-500 mb-2">Chaque requête doit contenir votre clé API dans le header Authorization :</p>
              <code className="block bg-gray-50 rounded-xl px-4 py-3 font-mono text-gray-700">
                Authorization: Bearer sk_live_xxxxxxxxxxxxxxxx
              </code>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-2">Exemple curl</p>
              <pre className="bg-gray-900 text-green-400 rounded-xl px-4 py-3 text-xs overflow-x-auto">
{`curl -X POST https://api.scalor.net/api/v1/message/send \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"instanceId": "...", "number": "237690000000", "text": "Bonjour !"}'`}
              </pre>
            </div>
          </Card>

          {/* Pricing */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">💰 Tarifs (FCFA / mois)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { plan: 'Starter', price: 'Gratuit', instances: '1', daily: '500', monthly: '10 000', rate: '30 req/min', highlight: false },
                { plan: 'Pro', price: '10 000 FCFA', instances: '5', daily: '5 000', monthly: '100 000', rate: '120 req/min', highlight: false },
                { plan: 'Business', price: '25 000 FCFA', instances: '20', daily: '50 000', monthly: '500 000', rate: '300 req/min', highlight: true },
                { plan: 'Enterprise', price: '50 000 FCFA', instances: 'Illimité', daily: 'Illimité', monthly: 'Illimité', rate: '600 req/min', highlight: false },
              ].map(p => (
                <div key={p.plan} className={`rounded-xl border p-4 space-y-2 ${p.highlight ? 'border-[#0F6B4F] bg-emerald-50/50 ring-1 ring-[#0F6B4F]/20' : 'border-gray-100'}`}>
                  <p className="font-semibold text-gray-900">{p.plan}</p>
                  <p className="text-lg font-bold text-[#0F6B4F]">{p.price}</p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>📱 {p.instances} instance{p.instances !== '1' ? 's' : ''}</p>
                    <p>📨 {p.daily} msg/jour</p>
                    <p>📊 {p.monthly} msg/mois</p>
                    <p>⚡ {p.rate}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* API Endpoints */}
          <Card className="p-6 space-y-4 text-sm">
            <h3 className="font-semibold text-gray-900">Endpoints</h3>

            {/* Account */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Compte</p>
              {[
                { method:'GET', path:'/account', desc:'Voir votre compte et usage courant.', body:null },
                { method:'GET', path:'/usage', desc:'Statistiques détaillées (30 derniers jours).', body:null },
              ].map(({ method, path, desc, body }) => (
                <div key={path} className="border border-gray-100 rounded-xl overflow-hidden mb-2">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50">
                    <Badge color={method === 'GET' ? 'blue' : method === 'POST' ? 'green' : method === 'DELETE' ? 'red' : 'yellow'}>{method}</Badge>
                    <code className="font-mono text-xs text-gray-700">{path}</code>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-gray-600">{desc}</p>
                    {body && <pre className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 overflow-x-auto mt-2">{body}</pre>}
                  </div>
                </div>
              ))}
            </div>

            {/* Instances */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Instances WhatsApp</p>
              {[
                { method:'POST', path:'/instance/create', desc:'Créer une instance WhatsApp.', body:'{ "name": "Support Client" }' },
                { method:'GET',  path:'/instance', desc:'Lister toutes vos instances.', body:null },
                { method:'GET',  path:'/instance/:id', desc:'Détails d\'une instance (avec statut live).', body:null },
                { method:'GET',  path:'/instance/:id/qrcode', desc:'Obtenir le QR code pour connecter WhatsApp.', body:null },
                { method:'DELETE', path:'/instance/:id', desc:'Supprimer une instance.', body:null },
                { method:'POST', path:'/instance/:id/disconnect', desc:'Déconnecter WhatsApp.', body:null },
                { method:'POST', path:'/instance/:id/restart', desc:'Redémarrer une instance.', body:null },
                { method:'PUT',  path:'/instance/:id/webhook', desc:'Configurer un webhook pour recevoir les événements.', body:'{ "url": "https://votre-serveur.com/webhook", "events": ["messages.upsert", "connection.update"] }' },
              ].map(({ method, path, desc, body }) => (
                <div key={method+path} className="border border-gray-100 rounded-xl overflow-hidden mb-2">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50">
                    <Badge color={method === 'GET' ? 'blue' : method === 'POST' ? 'green' : method === 'DELETE' ? 'red' : 'yellow'}>{method}</Badge>
                    <code className="font-mono text-xs text-gray-700">{path}</code>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-gray-600">{desc}</p>
                    {body && <pre className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 overflow-x-auto mt-2">{body}</pre>}
                  </div>
                </div>
              ))}
            </div>

            {/* Messages */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Messages</p>
              {[
                { method:'POST', path:'/message/send', desc:'Envoyer un message (texte, image, audio, vidéo, document).', body:'{ "instanceId": "...", "number": "237690000000", "text": "Bonjour !" }' },
                { method:'POST', path:'/message/send', desc:'Envoyer une image.', body:'{ "instanceId": "...", "number": "237...", "mediaUrl": "https://...", "caption": "Voici le produit" }' },
                { method:'POST', path:'/message/send', desc:'Envoyer un audio.', body:'{ "instanceId": "...", "number": "237...", "audioUrl": "https://..." }' },
                { method:'POST', path:'/message/send/bulk', desc:'Envoi en masse (max 100 messages).', body:'{ "instanceId": "...", "messages": [{ "number": "237...", "text": "Promo !" }] }' },
                { method:'POST', path:'/message/check-number', desc:'Vérifier si un numéro est sur WhatsApp.', body:'{ "instanceId": "...", "numbers": ["237690000000"] }' },
                { method:'GET',  path:'/message/logs', desc:'Historique des messages (paginé).', body:null },
              ].map(({ method, path, desc, body }, i) => (
                <div key={path+i} className="border border-gray-100 rounded-xl overflow-hidden mb-2">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50">
                    <Badge color={method === 'GET' ? 'blue' : 'green'}>{method}</Badge>
                    <code className="font-mono text-xs text-gray-700">{path}</code>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-gray-600">{desc}</p>
                    {body && <pre className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 overflow-x-auto mt-2">{body}</pre>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Start */}
          <Card className="p-6 space-y-4 text-sm">
            <h3 className="font-semibold text-gray-900">🚀 Démarrage rapide</h3>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-700 mb-1">1. Obtenez votre clé API</p>
                <p className="text-gray-500">Allez dans l'onglet "Clés API" et créez une clé. Copiez-la immédiatement.</p>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-1">2. Créez une instance</p>
                <pre className="bg-gray-900 text-green-400 rounded-xl px-4 py-3 text-xs overflow-x-auto">
{`curl -X POST https://api.scalor.net/api/v1/instance/create \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Mon Support"}'`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-1">3. Scannez le QR code</p>
                <pre className="bg-gray-900 text-green-400 rounded-xl px-4 py-3 text-xs overflow-x-auto">
{`curl https://api.scalor.net/api/v1/instance/INSTANCE_ID/qrcode \\
  -H "Authorization: Bearer sk_live_xxx"`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-1">4. Envoyez un message !</p>
                <pre className="bg-gray-900 text-green-400 rounded-xl px-4 py-3 text-xs overflow-x-auto">
{`curl -X POST https://api.scalor.net/api/v1/message/send \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"instanceId": "INSTANCE_ID", "number": "237690000000", "text": "Hello depuis Scalor API !"}'`}
                </pre>
              </div>
            </div>
          </Card>

          {/* Response format */}
          <Card className="p-6 space-y-4 text-sm">
            <h3 className="font-semibold text-gray-900">Format des réponses</h3>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-700 mb-1">✅ Succès</p>
                <pre className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 overflow-x-auto">
{`{
  "success": true,
  "messageId": "BAE5F4...",
  "type": "text",
  "status": "sent",
  "usage": { "today": 42, "dailyLimit": 5000, "month": 1200, "monthlyLimit": 100000 }
}`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-1">❌ Erreur</p>
                <pre className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 overflow-x-auto">
{`{
  "error": "daily_limit_exceeded",
  "message": "Daily limit reached (5000). Resets at midnight.",
  "limit": 5000,
  "used": 5000
}`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-1">🔒 Headers utiles</p>
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 space-y-1">
                  <p><code className="text-gray-800">X-RateLimit-Limit</code> — Nombre max de requêtes/min</p>
                  <p><code className="text-gray-800">X-RateLimit-Remaining</code> — Requêtes restantes</p>
                  <p><code className="text-gray-800">Retry-After</code> — Secondes avant de pouvoir réessayer (si 429)</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
