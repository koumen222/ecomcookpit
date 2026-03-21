import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  scalorGetDashboard, scalorCreateInstance, scalorGetQrCode,
  scalorDeleteInstance, scalorDisconnectInstance, scalorRestartInstance,
  scalorCreateApiKey, scalorDeleteApiKey, scalorGetMe,
  getScalorToken, clearScalorSession, scalorSendText,
  scalorSetWebhook
} from '../services/scalorApi';
import {
  loginProvider, registerProvider, verifyProviderEmail,
  getProviderMe, listProviderInstances, createProviderInstance,
  updateProviderInstance, deleteProviderInstance, refreshProviderToken,
  providerStorage, providerApiBaseUrl
} from '../services/providerApi';

// ═══════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════
const StatusBadge = ({ status }) => {
  const colors = {
    connected: 'bg-green-500/20 text-green-400 border-green-500/30',
    disconnected: 'bg-red-500/20 text-red-400 border-red-500/30',
    awaiting_qr: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    creating: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    deleted: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.disconnected}`}>
      {status}
    </span>
  );
};

// ═══════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════
const UsageBar = ({ label, current, max, color = 'green' }) => {
  const pct = max === -1 ? 0 : Math.min((current / max) * 100, 100);
  const isUnlimited = max === -1;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-mono">
          {current.toLocaleString()}{isUnlimited ? ' / ∞' : ` / ${max.toLocaleString()}`}
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full bg-${color}-500 transition-all`}
          style={{ width: `${isUnlimited ? 5 : pct}%` }}
        />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════
export default function ScalorDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [showCreateInstance, setShowCreateInstance] = useState(false);
  const [showQrCode, setShowQrCode] = useState(null);
  const [showSendMessage, setShowSendMessage] = useState(null);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [showWebhook, setShowWebhook] = useState(null);
  const [showApiDocs, setShowApiDocs] = useState(false);

  const [newInstanceName, setNewInstanceName] = useState('');
  const [qrData, setQrData] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyResult, setNewKeyResult] = useState(null);
  const [sendForm, setSendForm] = useState({ number: '', message: '' });
  const [sendResult, setSendResult] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');

  // ── Provider state ──────────────────────────────────────
  const [provToken, setProvToken] = useState(() => providerStorage.getToken());
  const [provProfile, setProvProfile] = useState(() => providerStorage.getProfile());
  const [provInstances, setProvInstances] = useState([]);
  const [provMode, setProvMode] = useState('login'); // login | register | verify
  const [provLoading, setProvLoading] = useState(false);
  const [provMsg, setProvMsg] = useState('');
  const [provError, setProvError] = useState('');
  const [provVerifyToken, setProvVerifyToken] = useState('');
  const [provLoginForm, setProvLoginForm] = useState({ email: '', password: '' });
  const [provRegForm, setProvRegForm] = useState({ email: '', password: '', name: '', company: '', phone: '' });
  const [provInstanceForm, setProvInstanceForm] = useState({ name: '', subdomain: '', currency: 'XAF' });
  const [provEditing, setProvEditing] = useState(null);

  const changeTab = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab !== 'overview' ? { tab } : {}, { replace: true });
  };

  // ── Provider helpers ────────────────────────────────────
  const loadProviderDashboard = useCallback(async () => {
    if (!providerStorage.getToken()) return;
    setProvLoading(true);
    try {
      const [meRes, instRes] = await Promise.all([getProviderMe(), listProviderInstances()]);
      setProvProfile(meRes?.data || null);
      setProvInstances(instRes?.data?.instances || []);
    } catch (e) {
      setProvError(e.message);
    } finally {
      setProvLoading(false);
    }
  }, []);

  useEffect(() => {
    if (provToken) loadProviderDashboard();
  }, [provToken, loadProviderDashboard]);

  const handleProvLogin = async (e) => {
    e.preventDefault();
    setProvLoading(true); setProvError(''); setProvMsg('');
    try {
      const res = await loginProvider(provLoginForm);
      const tok = res?.data?.token || '';
      setProvToken(tok);
      setProvProfile(res?.data?.provider || null);
      setProvMsg('Connecté en tant que Provider ✅');
      setProvLoginForm({ email: '', password: '' });
      await loadProviderDashboard();
    } catch (e) { setProvError(e.message); }
    finally { setProvLoading(false); }
  };

  const handleProvRegister = async (e) => {
    e.preventDefault();
    setProvLoading(true); setProvError(''); setProvMsg('');
    try {
      await registerProvider(provRegForm);
      setProvMsg('Compte créé. Vérifiez votre email puis connectez-vous.');
      setProvRegForm({ email: '', password: '', name: '', company: '', phone: '' });
      setProvMode('verify');
    } catch (e) { setProvError(e.message); }
    finally { setProvLoading(false); }
  };

  const handleProvVerify = async (e) => {
    e.preventDefault();
    setProvLoading(true); setProvError(''); setProvMsg('');
    try {
      await verifyProviderEmail(provVerifyToken.trim());
      setProvMsg('Email vérifié. Vous pouvez vous connecter.');
      setProvVerifyToken(''); setProvMode('login');
    } catch (e) { setProvError(e.message); }
    finally { setProvLoading(false); }
  };

  const handleProvCreateInstance = async (e) => {
    e.preventDefault();
    if (!provInstanceForm.name.trim()) return;
    setProvLoading(true); setProvError(''); setProvMsg('');
    try {
      await createProviderInstance({
        name: provInstanceForm.name.trim(),
        subdomain: provInstanceForm.subdomain.trim() || undefined,
        settings: { currency: provInstanceForm.currency, businessType: 'ecommerce', providerManaged: true }
      });
      setProvMsg('Instance créée !');
      setProvInstanceForm({ name: '', subdomain: '', currency: 'XAF' });
      await loadProviderDashboard();
    } catch (e) { setProvError(e.message); }
    finally { setProvLoading(false); }
  };

  const handleProvSaveEdit = async (instId) => {
    setProvLoading(true); setProvError(''); setProvMsg('');
    try {
      await updateProviderInstance(instId, { name: provInstanceForm.name.trim(), storeSettings: { storeName: provInstanceForm.name.trim() } });
      setProvMsg('Instance mise à jour.');
      setProvEditing(null);
      setProvInstanceForm({ name: '', subdomain: '', currency: 'XAF' });
      await loadProviderDashboard();
    } catch (e) { setProvError(e.message); }
    finally { setProvLoading(false); }
  };

  const handleProvDeleteInstance = async (instId) => {
    if (!confirm('Supprimer cette instance ?')) return;
    setProvLoading(true); setProvError(''); setProvMsg('');
    try {
      await deleteProviderInstance(instId);
      setProvMsg('Instance supprimée.');
      await loadProviderDashboard();
    } catch (e) { setProvError(e.message); }
    finally { setProvLoading(false); }
  };

  const handleProvLogout = () => {
    providerStorage.clear();
    setProvToken('');
    setProvProfile(null);
    setProvInstances([]);
    setProvMsg('');
  };

  const handleProvRefreshToken = async () => {
    setProvLoading(true); setProvError(''); setProvMsg('');
    try {
      const res = await refreshProviderToken();
      setProvToken(res?.data?.token || '');
      setProvMsg('Token rafraîchi.');
    } catch (e) { setProvError(e.message); }
    finally { setProvLoading(false); }
  };

  const loadDashboard = useCallback(async () => {
    try {
      const [dashData, meData] = await Promise.all([
        scalorGetDashboard(),
        scalorGetMe()
      ]);
      setDashboard(dashData);
      setUserInfo(meData);
    } catch (err) {
      if (err.response?.status === 401) {
        clearScalorSession();
        navigate('/scalor/login');
        return;
      }
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!getScalorToken()) {
      navigate('/scalor/login');
      return;
    }
    loadDashboard();
  }, [navigate, loadDashboard]);

  const handleLogout = () => {
    clearScalorSession();
    navigate('/scalor/login');
  };

  // ─── Instance Actions ─────────────────────────
  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) return;
    setActionLoading(true);
    try {
      await scalorCreateInstance(newInstanceName.trim());
      setNewInstanceName('');
      setShowCreateInstance(false);
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGetQr = async (instance) => {
    setShowQrCode(instance);
    setQrData(null);
    try {
      const data = await scalorGetQrCode(instance._id);
      setQrData(data);
    } catch (err) {
      setError(err.response?.data?.message || 'QR code failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette instance ? Cette action est irréversible.')) return;
    try {
      await scalorDeleteInstance(id);
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleDisconnect = async (id) => {
    try {
      await scalorDisconnectInstance(id);
      await loadDashboard();
    } catch {} 
  };

  const handleRestart = async (id) => {
    try {
      await scalorRestartInstance(id);
      await loadDashboard();
    } catch {}
  };

  // ─── API Key Actions ──────────────────────────
  const handleCreateKey = async () => {
    setActionLoading(true);
    try {
      const data = await scalorCreateApiKey(newKeyName || 'API Key');
      setNewKeyResult(data);
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!confirm('Révoquer cette clé API ?')) return;
    try {
      await scalorDeleteApiKey(keyId);
      await loadDashboard();
    } catch {}
  };

  // ─── Send Message ─────────────────────────────
  const handleSendMessage = async () => {
    if (!sendForm.number || !sendForm.message) return;
    setActionLoading(true);
    setSendResult(null);
    try {
      const data = await scalorSendText({
        instanceName: showSendMessage.instanceName,
        number: sendForm.number,
        message: sendForm.message
      });
      setSendResult(data);
      setSendForm({ number: '', message: '' });
    } catch (err) {
      setSendResult({ success: false, error: err.response?.data?.message || 'Send failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Webhook ──────────────────────────────────
  const handleSetWebhook = async () => {
    if (!webhookUrl) return;
    setActionLoading(true);
    try {
      await scalorSetWebhook(showWebhook._id, webhookUrl);
      setShowWebhook(null);
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Webhook update failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-green-400 text-xl animate-pulse">Chargement...</div>
      </div>
    );
  }

  const user = dashboard?.user;
  const instances = dashboard?.instances || [];
  const recentMessages = dashboard?.recentMessages || [];
  const apiKeys = userInfo?.apiKeys || [];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">
              <span className="text-green-400">Scalor</span> API
            </h1>
            <div className="hidden sm:flex gap-1">
              {['overview', 'instances', 'api-keys', 'logs', 'docs', 'provider'].map(tab => (
                <button
                  key={tab}
                  onClick={() => changeTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {tab === 'overview' ? '📊 Overview' :
                   tab === 'instances' ? '📱 Instances' :
                   tab === 'api-keys' ? '🔑 API Keys' :
                   tab === 'logs' ? '📋 Logs' :
                   tab === 'docs' ? '📖 Docs' : '🏢 Provider'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 hidden md:block">{user?.email}</span>
            <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded-full text-xs font-semibold uppercase">{user?.plan}</span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 text-sm">Déconnexion</button>
          </div>
        </div>
      </nav>

      {/* Mobile tabs */}
      <div className="sm:hidden flex overflow-x-auto gap-1 p-2 bg-gray-800 border-b border-gray-700">
        {['overview', 'instances', 'api-keys', 'logs', 'docs', 'provider'].map(tab => (
          <button
            key={tab}
            onClick={() => changeTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              activeTab === tab ? 'bg-green-600 text-white' : 'text-gray-400 bg-gray-700'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'instances' ? 'Instances' : tab === 'api-keys' ? 'API Keys' : tab === 'logs' ? 'Logs' : tab === 'docs' ? 'Docs' : 'Provider'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">✕</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ═══════ OVERVIEW TAB ═══════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Instances" value={instances.length} max={user?.maxInstances} icon="📱" />
              <StatCard label="Messages aujourd'hui" value={user?.messagesSentToday || 0} max={user?.dailyMessageLimit} icon="💬" />
              <StatCard label="Messages ce mois" value={user?.messagesSentThisMonth || 0} max={user?.monthlyMessageLimit} icon="📊" />
              <StatCard label="Total messages" value={dashboard?.totalMessages || 0} icon="📈" />
            </div>

            {/* Usage bars */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-white font-semibold mb-4">Utilisation</h3>
              <UsageBar label="Messages quotidiens" current={user?.messagesSentToday || 0} max={user?.dailyMessageLimit} />
              <UsageBar label="Messages mensuels" current={user?.messagesSentThisMonth || 0} max={user?.monthlyMessageLimit} />
              <UsageBar label="Instances" current={instances.length} max={user?.maxInstances} color="blue" />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setShowCreateInstance(true)}
                className="bg-green-600/10 border border-green-600/30 rounded-xl p-4 text-left hover:bg-green-600/20 transition-colors"
              >
                <span className="text-2xl">➕</span>
                <h4 className="text-green-400 font-semibold mt-2">Créer une instance</h4>
                <p className="text-gray-500 text-sm">Ajouter un nouveau numéro WhatsApp</p>
              </button>
              <button
                onClick={() => setActiveTab('api-keys')}
                className="bg-blue-600/10 border border-blue-600/30 rounded-xl p-4 text-left hover:bg-blue-600/20 transition-colors"
              >
                <span className="text-2xl">🔑</span>
                <h4 className="text-blue-400 font-semibold mt-2">Gérer les clés API</h4>
                <p className="text-gray-500 text-sm">Créer ou révoquer des clés</p>
              </button>
              <button
                onClick={() => setActiveTab('docs')}
                className="bg-purple-600/10 border border-purple-600/30 rounded-xl p-4 text-left hover:bg-purple-600/20 transition-colors"
              >
                <span className="text-2xl">📖</span>
                <h4 className="text-purple-400 font-semibold mt-2">Documentation API</h4>
                <p className="text-gray-500 text-sm">Guide d'intégration rapide</p>
              </button>
            </div>

            {/* Recent messages */}
            {recentMessages.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700">
                <h3 className="text-white font-semibold p-4 border-b border-gray-700">Messages récents</h3>
                <div className="divide-y divide-gray-700">
                  {recentMessages.slice(0, 10).map((msg, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${msg.status === 'sent' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-white font-mono">{msg.phoneNumber}</span>
                        <span className="text-gray-500 hidden md:block">{msg.contentPreview?.substring(0, 40)}...</span>
                      </div>
                      <span className="text-gray-500 text-xs">{new Date(msg.sentAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ INSTANCES TAB ═══════ */}
        {activeTab === 'instances' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Instances WhatsApp</h2>
              <button
                onClick={() => setShowCreateInstance(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium"
              >
                + Nouvelle instance
              </button>
            </div>

            {instances.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                <div className="text-5xl mb-4">📱</div>
                <h3 className="text-white text-lg font-semibold mb-2">Aucune instance</h3>
                <p className="text-gray-500 mb-4">Créez votre première instance WhatsApp pour commencer</p>
                <button
                  onClick={() => setShowCreateInstance(true)}
                  className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium"
                >
                  Créer une instance
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {instances.map(inst => (
                  <div key={inst._id} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-white font-semibold text-lg">{inst.displayName}</h3>
                        <p className="text-gray-500 text-xs font-mono">{inst.instanceName}</p>
                        {inst.phoneNumber && <p className="text-gray-400 text-sm mt-1">📞 {inst.phoneNumber}</p>}
                      </div>
                      <StatusBadge status={inst.status} />
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {inst.status === 'awaiting_qr' && (
                        <button onClick={() => handleGetQr(inst)} className="px-3 py-1.5 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 rounded-lg text-xs font-medium">
                          📲 Scanner QR
                        </button>
                      )}
                      {inst.status === 'connected' && (
                        <button onClick={() => { setShowSendMessage(inst); setSendResult(null); }} className="px-3 py-1.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg text-xs font-medium">
                          💬 Envoyer message
                        </button>
                      )}
                      <button onClick={() => { setShowWebhook(inst); setWebhookUrl(inst.webhookUrl || ''); }} className="px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg text-xs font-medium">
                        🔗 Webhook
                      </button>
                      {inst.status === 'connected' && (
                        <button onClick={() => handleDisconnect(inst._id)} className="px-3 py-1.5 bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 rounded-lg text-xs font-medium">
                          🔌 Déconnecter
                        </button>
                      )}
                      {inst.status === 'disconnected' && (
                        <button onClick={() => handleRestart(inst._id)} className="px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg text-xs font-medium">
                          🔄 Reconnecter
                        </button>
                      )}
                      <button onClick={() => handleDelete(inst._id)} className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-xs font-medium">
                        🗑️ Supprimer
                      </button>
                    </div>

                    <div className="flex gap-4 mt-3 text-xs text-gray-500">
                      <span>📤 {inst.messagesSentToday || 0} aujourd'hui</span>
                      <span>📊 {inst.messagesSentThisMonth || 0} ce mois</span>
                      {inst.webhookUrl && <span>🔗 Webhook actif</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════ API KEYS TAB ═══════ */}
        {activeTab === 'api-keys' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Clés API</h2>
              <button
                onClick={() => { setShowCreateKey(true); setNewKeyResult(null); setNewKeyName(''); }}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium"
              >
                + Nouvelle clé
              </button>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
              {apiKeys.map(key => (
                <div key={key._id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{key.name}</p>
                    <p className="text-gray-500 font-mono text-sm">{key.keyPrefix}••••••••••••</p>
                    <p className="text-gray-600 text-xs mt-1">
                      Créée {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsedAt && ` • Dernière utilisation ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${key.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {key.isActive ? 'Active' : 'Révoquée'}
                    </span>
                    {key.isActive && (
                      <button onClick={() => handleDeleteKey(key._id)} className="text-red-400 hover:text-red-300 text-sm">
                        Révoquer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ LOGS TAB ═══════ */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Historique des messages</h2>
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="text-left p-4">Statut</th>
                      <th className="text-left p-4">Numéro</th>
                      <th className="text-left p-4 hidden md:table-cell">Type</th>
                      <th className="text-left p-4 hidden lg:table-cell">Contenu</th>
                      <th className="text-left p-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {recentMessages.map((msg, i) => (
                      <tr key={i} className="text-gray-300">
                        <td className="p-4">
                          <span className={`w-2 h-2 rounded-full inline-block mr-2 ${msg.status === 'sent' ? 'bg-green-400' : 'bg-red-400'}`} />
                          {msg.status}
                        </td>
                        <td className="p-4 font-mono">{msg.phoneNumber}</td>
                        <td className="p-4 hidden md:table-cell">{msg.messageType}</td>
                        <td className="p-4 hidden lg:table-cell text-gray-500 truncate max-w-xs">{msg.contentPreview}</td>
                        <td className="p-4 text-gray-500 text-xs">{new Date(msg.sentAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recentMessages.length === 0 && (
                <div className="p-12 text-center text-gray-500">Aucun message envoyé</div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ PROVIDER TAB ═══════ */}
        {activeTab === 'provider' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Provider Console</h2>
              {provToken && (
                <button onClick={handleProvLogout} className="text-xs text-red-400 hover:text-red-300">
                  Déconnexion provider
                </button>
              )}
            </div>

            {provError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex justify-between">
                <span>{provError}</span>
                <button onClick={() => setProvError('')} className="text-red-400">✕</button>
              </div>
            )}
            {provMsg && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm flex justify-between">
                <span>{provMsg}</span>
                <button onClick={() => setProvMsg('')} className="text-green-400">✕</button>
              </div>
            )}

            {/* ── Not authenticated: compact login form ── */}
            {!provToken && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <div className="flex flex-wrap gap-2 mb-5">
                    {['login', 'register', 'verify'].map(m => (
                      <button key={m} onClick={() => setProvMode(m)}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                          provMode === m ? 'bg-white text-gray-900' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}>
                        {m === 'login' ? 'Connexion' : m === 'register' ? 'Inscription' : 'Vérification email'}
                      </button>
                    ))}
                  </div>

                  {provMode === 'login' && (
                    <form onSubmit={handleProvLogin} className="space-y-3">
                      <input required type="email" placeholder="Email" value={provLoginForm.email}
                        onChange={e => setProvLoginForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500 text-sm" />
                      <input required type="password" placeholder="Mot de passe" value={provLoginForm.password}
                        onChange={e => setProvLoginForm(f => ({ ...f, password: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500 text-sm" />
                      <button disabled={provLoading} type="submit"
                        className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 border border-gray-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50">
                        {provLoading ? 'Connexion...' : 'Connexion Provider'}
                      </button>
                    </form>
                  )}

                  {provMode === 'register' && (
                    <form onSubmit={handleProvRegister} className="space-y-3">
                      {[['company','Entreprise','text'],['name','Nom','text'],['email','Email','email'],['phone','Téléphone','tel'],['password','Mot de passe (6+ cars)','password']].map(([k,label,type]) => (
                        <input key={k} required={['company','name','email','password'].includes(k)}
                          type={type} placeholder={label} value={provRegForm[k]}
                          onChange={e => setProvRegForm(f => ({ ...f, [k]: e.target.value }))}
                          minLength={k === 'password' ? 6 : undefined}
                          className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500 text-sm" />
                      ))}
                      <button disabled={provLoading} type="submit"
                        className="w-full py-2.5 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50">
                        {provLoading ? 'Création...' : 'Créer compte Provider'}
                      </button>
                    </form>
                  )}

                  {provMode === 'verify' && (
                    <form onSubmit={handleProvVerify} className="space-y-3">
                      <input required placeholder="Token reçu par email" value={provVerifyToken}
                        onChange={e => setProvVerifyToken(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500 text-sm" />
                      <button disabled={provLoading} type="submit"
                        className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50">
                        {provLoading ? 'Vérification...' : 'Vérifier email'}
                      </button>
                    </form>
                  )}
                </div>

                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <h3 className="text-white font-semibold mb-3">Comment ça marche</h3>
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-400">
                    <li>Inscrivez votre entreprise provider.</li>
                    <li>Vérifiez l'email de validation.</li>
                    <li>Connectez-vous et recevez votre Bearer token.</li>
                    <li>Créez vos instances sans passer par l'API principale.</li>
                    <li>Gérez vos instances avec droits read/write.</li>
                  </ol>
                  <div className="mt-4 bg-gray-900 rounded-lg p-3 text-xs text-green-300 font-mono">
                    Authorization: Bearer prov_xxxxxxxxxxxxxxxxx
                  </div>
                  <div className="mt-2 text-xs text-gray-600">API: {providerApiBaseUrl()}</div>
                </div>
              </div>
            )}

            {/* ── Authenticated: full dashboard ── */}
            {provToken && (
              <div className="space-y-5">
                {/* Stats row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Token</p>
                    <p className="font-mono text-sm text-white break-all">
                      {provToken.length > 24 ? `${provToken.slice(0,12)}...${provToken.slice(-8)}` : provToken}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={handleProvRefreshToken} disabled={provLoading}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg disabled:opacity-50">
                        Refresh
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Entreprise</p>
                    <p className="text-white font-semibold">{provProfile?.company || '-'}</p>
                    <p className="text-gray-500 text-xs">{provProfile?.email || '-'}</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Instances</p>
                    <p className="text-2xl font-bold text-white">
                      {provProfile?.limits?.activeInstances ?? provProfile?.stats?.activeInstances ?? provInstances.length}
                      <span className="text-gray-600 text-sm font-normal"> / {provProfile?.limits?.instanceLimit ?? 10}</span>
                    </p>
                  </div>
                </div>

                {/* Create instance form */}
                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <h3 className="text-white font-semibold mb-4">Créer une nouvelle instance</h3>
                  <form onSubmit={handleProvCreateInstance} className="flex flex-wrap gap-3">
                    <input required placeholder="Nom instance" value={provInstanceForm.name}
                      onChange={e => setProvInstanceForm(f => ({ ...f, name: e.target.value }))}
                      className="flex-1 min-w-40 px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500 text-sm" />
                    <input placeholder="Subdomain (optionnel)" value={provInstanceForm.subdomain}
                      onChange={e => setProvInstanceForm(f => ({ ...f, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'') }))}
                      className="flex-1 min-w-36 px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500 text-sm" />
                    <select value={provInstanceForm.currency}
                      onChange={e => setProvInstanceForm(f => ({ ...f, currency: e.target.value }))}
                      className="px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500 text-sm">
                      {['XAF','XOF','USD','EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button disabled={provLoading} type="submit"
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg text-sm disabled:opacity-50">
                      {provLoading ? 'Création...' : '+ Créer instance'}
                    </button>
                  </form>
                </div>

                {/* Instances list */}
                <div className="bg-gray-800 rounded-xl border border-gray-700">
                  <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="text-white font-semibold">Mes instances</h3>
                    <button onClick={loadProviderDashboard} disabled={provLoading}
                      className="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded-lg">
                      Rafraîchir
                    </button>
                  </div>
                  <div className="divide-y divide-gray-700">
                    {provInstances.length === 0 && (
                      <div className="p-10 text-center text-gray-500 text-sm">Aucune instance</div>
                    )}
                    {provInstances.map(inst => (
                      <div key={inst.id} className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <p className="text-white font-semibold">{inst.name}</p>
                            <p className="text-gray-500 text-xs">slug: {inst.slug || '-'} • statut: {inst.status || '-'}</p>
                            {inst.accessUrl && (
                              <a href={inst.accessUrl} target="_blank" rel="noreferrer"
                                className="text-xs text-green-400 hover:underline mt-1 inline-block">
                                Ouvrir la boutique ↗
                              </a>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => { setProvEditing(inst.id); setProvInstanceForm({ name: inst.name||'', subdomain: inst.subdomain||'', currency: 'XAF' }); }}
                              className="px-3 py-1.5 border border-gray-600 text-gray-300 hover:text-white rounded-lg text-xs">
                              Modifier
                            </button>
                            <button onClick={() => handleProvDeleteInstance(inst.id)}
                              className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-xs">
                              Supprimer
                            </button>
                          </div>
                        </div>
                        {provEditing === inst.id && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <input value={provInstanceForm.name}
                              onChange={e => setProvInstanceForm(f => ({ ...f, name: e.target.value }))}
                              className="flex-1 min-w-40 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm" />
                            <button onClick={() => handleProvSaveEdit(inst.id)}
                              className="px-4 py-2 bg-white text-gray-900 font-semibold rounded-lg text-sm">Enregistrer</button>
                            <button onClick={() => setProvEditing(null)}
                              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm">Annuler</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ DOCS TAB ═══════ */}
        {activeTab === 'docs' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Documentation API</h2>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-6">
              <div>
                <h3 className="text-green-400 font-semibold mb-2">Base URL</h3>
                <code className="block bg-gray-900 p-3 rounded-lg text-green-300 text-sm">https://api.scalor.net/api/scalor</code>
              </div>

              <div>
                <h3 className="text-green-400 font-semibold mb-2">Authentification</h3>
                <p className="text-gray-400 text-sm mb-2">Ajoutez votre clé API dans le header Authorization :</p>
                <code className="block bg-gray-900 p-3 rounded-lg text-green-300 text-sm">
                  Authorization: Bearer sk_live_xxxxxxxxxxxxxx
                </code>
              </div>

              <div>
                <h3 className="text-green-400 font-semibold mb-2">Envoyer un message texte</h3>
                <pre className="bg-gray-900 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">{`POST /api/scalor/message/send/text
Content-Type: application/json
Authorization: Bearer sk_live_xxx

{
  "instanceName": "scalor_xxx_mon_instance",
  "number": "237691234567",
  "message": "Bonjour depuis Scalor API ! 🚀"
}`}</pre>
              </div>

              <div>
                <h3 className="text-green-400 font-semibold mb-2">Envoyer une image</h3>
                <pre className="bg-gray-900 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">{`POST /api/scalor/message/send/media
Content-Type: application/json
Authorization: Bearer sk_live_xxx

{
  "instanceName": "scalor_xxx_mon_instance",
  "number": "237691234567",
  "mediaUrl": "https://example.com/image.jpg",
  "caption": "Mon image",
  "fileName": "photo.jpg"
}`}</pre>
              </div>

              <div>
                <h3 className="text-green-400 font-semibold mb-2">Envoi en masse (bulk)</h3>
                <pre className="bg-gray-900 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">{`POST /api/scalor/message/send/bulk
Content-Type: application/json
Authorization: Bearer sk_live_xxx

{
  "instanceName": "scalor_xxx_mon_instance",
  "messages": [
    { "number": "237691234567", "message": "Promo -20% !" },
    { "number": "237698765432", "message": "Offre spéciale !" }
  ]
}`}</pre>
              </div>

              <div>
                <h3 className="text-green-400 font-semibold mb-2">Créer une instance</h3>
                <pre className="bg-gray-900 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">{`POST /api/scalor/instance/create
Content-Type: application/json
Authorization: Bearer sk_live_xxx

{
  "name": "mon_whatsapp"
}`}</pre>
              </div>

              <div>
                <h3 className="text-green-400 font-semibold mb-2">Récupérer le QR Code</h3>
                <pre className="bg-gray-900 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">{`GET /api/scalor/instance/{id}/qrcode
Authorization: Bearer sk_live_xxx`}</pre>
              </div>

              <div>
                <h3 className="text-green-400 font-semibold mb-2">Configurer un webhook</h3>
                <pre className="bg-gray-900 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">{`PUT /api/scalor/instance/{id}/webhook
Content-Type: application/json
Authorization: Bearer sk_live_xxx

{
  "url": "https://monsite.com/webhook",
  "events": ["messages.upsert", "connection.update"]
}`}</pre>
              </div>

              <div>
                <h3 className="text-green-400 font-semibold mb-2">Exemple cURL complet</h3>
                <pre className="bg-gray-900 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">{`curl -X POST https://api.scalor.net/api/scalor/message/send/text \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -d '{
    "instanceName": "scalor_xxx_boutique",
    "number": "237691234567",
    "message": "Votre commande est prête !"
  }'`}</pre>
              </div>

              <div>
                <h3 className="text-green-400 font-semibold mb-3">Limites par plan</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { plan: 'Starter', instances: '1', daily: '500', monthly: '10K', rate: '30/min' },
                    { plan: 'Pro', instances: '5', daily: '5K', monthly: '100K', rate: '120/min' },
                    { plan: 'Business', instances: '20', daily: '50K', monthly: '500K', rate: '300/min' },
                    { plan: 'Enterprise', instances: '∞', daily: '∞', monthly: '∞', rate: '600/min' },
                  ].map(p => (
                    <div key={p.plan} className="bg-gray-900 rounded-lg p-3 text-center">
                      <div className="text-green-400 font-semibold">{p.plan}</div>
                      <div className="text-gray-500 text-xs mt-2 space-y-1">
                        <div>{p.instances} instances</div>
                        <div>{p.daily} msg/jour</div>
                        <div>{p.monthly} msg/mois</div>
                        <div>{p.rate} requêtes</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ MODALS ═══════ */}

      {/* Create Instance Modal */}
      {showCreateInstance && (
        <Modal onClose={() => setShowCreateInstance(false)} title="Nouvelle instance WhatsApp">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom de l'instance</label>
              <input
                type="text"
                value={newInstanceName}
                onChange={e => setNewInstanceName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500"
                placeholder="ma_boutique"
                maxLength={30}
              />
              <p className="text-gray-500 text-xs mt-1">Lettres, chiffres, tirets et underscores uniquement</p>
            </div>
            <button
              onClick={handleCreateInstance}
              disabled={actionLoading || !newInstanceName.trim()}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {actionLoading ? 'Création...' : 'Créer l\'instance'}
            </button>
          </div>
        </Modal>
      )}

      {/* QR Code Modal */}
      {showQrCode && (
        <Modal onClose={() => setShowQrCode(null)} title={`QR Code — ${showQrCode.displayName}`}>
          <div className="text-center">
            {qrData?.qrcode ? (
              <>
                <img src={qrData.qrcode.startsWith('data:') ? qrData.qrcode : `data:image/png;base64,${qrData.qrcode}`} alt="QR Code" className="mx-auto w-64 h-64 rounded-lg" />
                <p className="text-gray-400 text-sm mt-4">Scannez ce QR code avec WhatsApp sur votre téléphone</p>
                {qrData.pairingCode && (
                  <p className="text-green-400 font-mono text-lg mt-2">Code: {qrData.pairingCode}</p>
                )}
              </>
            ) : (
              <div className="py-12 text-gray-400 animate-pulse">Chargement du QR code...</div>
            )}
          </div>
        </Modal>
      )}

      {/* Send Message Modal */}
      {showSendMessage && (
        <Modal onClose={() => setShowSendMessage(null)} title={`Envoyer — ${showSendMessage.displayName}`}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Numéro (format international)</label>
              <input
                type="text"
                value={sendForm.number}
                onChange={e => setSendForm(f => ({ ...f, number: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500"
                placeholder="237691234567"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Message</label>
              <textarea
                value={sendForm.message}
                onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500 resize-y"
                rows={4}
                placeholder="Votre message..."
              />
            </div>
            {sendResult && (
              <div className={`p-3 rounded-lg text-sm ${sendResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {sendResult.success ? `✅ Message envoyé ! ID: ${sendResult.messageId}` : `❌ ${sendResult.error}`}
              </div>
            )}
            <button
              onClick={handleSendMessage}
              disabled={actionLoading || !sendForm.number || !sendForm.message}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {actionLoading ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
        </Modal>
      )}

      {/* Webhook Modal */}
      {showWebhook && (
        <Modal onClose={() => setShowWebhook(null)} title={`Webhook — ${showWebhook.displayName}`}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">URL du webhook</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500"
                placeholder="https://monsite.com/webhook"
              />
              <p className="text-gray-500 text-xs mt-1">Les événements WhatsApp seront envoyés à cette URL via POST</p>
            </div>
            <button
              onClick={handleSetWebhook}
              disabled={actionLoading || !webhookUrl}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {actionLoading ? 'Mise à jour...' : 'Sauvegarder le webhook'}
            </button>
          </div>
        </Modal>
      )}

      {/* Create API Key Modal */}
      {showCreateKey && (
        <Modal onClose={() => setShowCreateKey(false)} title="Nouvelle clé API">
          {newKeyResult ? (
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                <p className="text-yellow-400 text-sm font-semibold mb-2">⚠️ Sauvegardez cette clé maintenant !</p>
                <code className="block bg-gray-900 p-3 rounded text-green-300 text-sm break-all">{newKeyResult.apiKey}</code>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(newKeyResult.apiKey); }}
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg"
              >
                📋 Copier la clé
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nom de la clé</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-green-500"
                  placeholder="Production API Key"
                />
              </div>
              <button
                onClick={handleCreateKey}
                disabled={actionLoading}
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {actionLoading ? 'Génération...' : 'Générer la clé'}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════

function StatCard({ label, value, max, icon }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {max !== undefined && max !== -1 && (
          <span className="text-gray-500 text-xs">/{max}</span>
        )}
      </div>
      <div className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-gray-500 text-sm">{label}</div>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
