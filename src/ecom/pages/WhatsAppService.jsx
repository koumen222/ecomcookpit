import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, Loader2,
  ExternalLink, Copy, Check, Bot, Smartphone, Zap, Send,
  Eye, EyeOff, X, Globe, MessageSquare, Package,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';

const ACCENT = '#0F6B4F';
const ACCENT_LIGHT = 'rgba(15,107,79,0.08)';

const WEBHOOK_EVENTS = [
  { id: 'MESSAGES_UPSERT',   label: 'Messages reçus' },
  { id: 'MESSAGES_UPDATE',   label: 'Statuts messages' },
  { id: 'SEND_MESSAGE',      label: 'Messages envoyés' },
  { id: 'CONNECTION_UPDATE', label: 'Connexion' },
  { id: 'QRCODE_UPDATED',    label: 'QR Code' },
  { id: 'CONTACTS_UPSERT',   label: 'Nouveaux contacts' },
];

const WhatsAppService = () => {
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [formData, setFormData] = useState({ instanceName: '', instanceToken: '', customName: '' });
  const [submitting, setSubmitting] = useState(false);
  const [linkResult, setLinkResult] = useState(null);
  const [showTokens, setShowTokens] = useState({});
  const [webhookPanels, setWebhookPanels] = useState({});
  const [orderCount, setOrderCount] = useState(0);

  const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
  const userId = user._id || user.id;

  useEffect(() => { loadInstances(); loadOrderCount(); }, []);

  const loadOrderCount = async () => {
    try {
      const { data } = await ecomApi.get('/v1/external/whatsapp/orders/stats');
      if (data.success) setOrderCount(data.stats?.pending || 0);
    } catch {}
  };

  const loadInstances = async () => {
    try {
      setLoading(true); setError('');
      const { data } = await ecomApi.get(`/v1/external/whatsapp/instances?userId=${userId}`);
      setInstances(data.success ? data.instances || [] : []);
    } catch { setInstances([]); } finally { setLoading(false); }
  };

  const refreshAllStatuses = async () => {
    try {
      setLoading(true); setError('');
      const { data } = await ecomApi.post('/v1/external/whatsapp/refresh-status', { userId });
      if (data.success) setInstances(data.instances || []);
    } catch { setError('Erreur lors de la synchronisation'); } finally { setLoading(false); }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const STATUS_MAP = {
    connected:    { label: 'Connecté',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    active:       { label: 'Actif',      dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    configured:   { label: 'Configuré',  dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50'    },
    disconnected: { label: 'Déconnecté', dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50'     },
  };
  const getStatus = (s) => STATUS_MAP[s] || { label: 'Non vérifié', dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100' };

  const handleLinkInstance = async (e) => {
    e.preventDefault(); setSubmitting(true); setError(''); setLinkResult(null);
    try {
      const { data } = await ecomApi.post('/v1/external/whatsapp/link', { userId, ...formData });
      if (data.success) {
        setFormData({ instanceName: '', instanceToken: '', customName: '' });
        setShowAddForm(false);
        setLinkResult({ verified: data.verified, message: data.verificationMessage, status: data.data?.status });
        loadInstances();
      } else { setError(data.error || 'Erreur lors de la liaison'); }
    } catch (err) { setError(err.response?.data?.error || err.message || 'Erreur serveur'); }
    finally { setSubmitting(false); }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const testConnection = async (instance) => {
    setTestResults(prev => ({ ...prev, [instance._id]: { loading: true } }));
    try {
      const { data } = await ecomApi.post('/v1/external/whatsapp/verify-instance', { instanceId: instance._id });
      setTestResults(prev => ({
        ...prev,
        [instance._id]: { loading: false, success: data.success, message: data.success ? 'Connectée' : (data.error || data.message) },
      }));
      if (data.status) setInstances(prev => prev.map(i => i._id === instance._id ? { ...i, status: data.status } : i));
    } catch {
      setTestResults(prev => ({ ...prev, [instance._id]: { loading: false, success: false, message: 'Injoignable' } }));
    }
  };

  const deleteInstance = async (instance) => {
    if (!confirm(`Supprimer "${instance.customName || instance.instanceName}" ?`)) return;
    try {
      const { data } = await ecomApi.delete(`/v1/external/whatsapp/instances/${instance._id}?userId=${userId}`);
      if (data.success) setInstances(prev => prev.filter(i => i._id !== instance._id));
      else setError(data.error || 'Erreur suppression');
    } catch (err) { setError(err.response?.data?.error || err.message || 'Erreur serveur'); }
  };

  const connectedCount = instances.filter(i => i.status === 'connected' || i.status === 'active').length;

  const updateWh = (instId, patch) =>
    setWebhookPanels(prev => ({ ...prev, [instId]: { ...prev[instId], ...patch } }));

  const toggleWebhookPanel = async (inst) => {
    const cur = webhookPanels[inst._id];
    if (cur?.open) { updateWh(inst._id, { open: false }); return; }
    updateWh(inst._id, { open: true, loading: true, saving: false, error: '', saved: false, config: { enabled: false, url: '', events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] } });
    try {
      const { data } = await ecomApi.get(`/v1/external/whatsapp/instances/${inst._id}/webhook?userId=${userId}`);
      if (data.success && data.data) {
        updateWh(inst._id, { loading: false, config: { enabled: !!data.data.enabled, url: data.data.url || '', events: data.data.events || ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] } });
      } else {
        updateWh(inst._id, { loading: false });
      }
    } catch { updateWh(inst._id, { loading: false }); }
  };

  const saveWebhookConfig = async (inst) => {
    const wh = webhookPanels[inst._id];
    if (!wh) return;
    updateWh(inst._id, { saving: true, error: '', saved: false });
    try {
      const { data } = await ecomApi.post(`/v1/external/whatsapp/instances/${inst._id}/webhook`, { userId, ...wh.config });
      if (data.success) {
        updateWh(inst._id, { saving: false, saved: true });
        setTimeout(() => updateWh(inst._id, { saved: false }), 3000);
      } else {
        updateWh(inst._id, { saving: false, error: data.error || 'Erreur' });
      }
    } catch (err) {
      updateWh(inst._id, { saving: false, error: err.response?.data?.error || err.message || 'Erreur serveur' });
    }
  };

  const TABS = [
    { id: 'instances', label: 'Instances', icon: Smartphone, count: instances.length },
    { id: 'rita',      label: 'Rita IA',   icon: Bot },
    { id: 'orders',   label: 'Commandes',  icon: Package, count: orderCount || undefined },
  ];

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-5">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: ACCENT_LIGHT }}>
            <MessageSquare className="w-[18px] h-[18px]" style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold text-gray-900 leading-tight">WhatsApp Service</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {instances.length} instance{instances.length !== 1 ? 's' : ''}{' · '}
              <span className="text-emerald-600 font-medium">{connectedCount} en ligne</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refreshAllStatuses} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-[7px] text-[13px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Synchroniser</span>
          </button>
          <button onClick={() => { setTab('instances'); setShowAddForm(true); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-[7px] text-[13px] font-semibold text-white rounded-lg transition-colors"
            style={{ background: ACCENT }}>
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap ${active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {tab.count}
                  </span>
                )}
                {active && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t" style={{ background: ACCENT }} />}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 pb-2 sm:pb-2">
          {[
            { id: 'notifications', label: 'Notifications', emoji: '🔔' },
            { id: 'rapport', label: 'Rapport', emoji: '📊' },
          ].map(item => {
            const active = activeTab === 'rita' && ritaPanel === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab('rita', { ritaPanel: item.id })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <span className="text-[13px] leading-none">{item.emoji}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerts */}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {linkResult && (
        <Alert
          type={linkResult.verified && linkResult.status === 'connected' ? 'success' : 'warning'}
          message={linkResult.verified && linkResult.status === 'connected' ? 'Instance connectée avec succès' : linkResult.message || 'Instance enregistrée'}
          onClose={() => setLinkResult(null)}
        />
      )}

      {/* Tab: Instances */}
      {activeTab === 'instances' && (
        <div className="space-y-4">

          {/* Add Form */}
          {showAddForm && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-900">Nouvelle instance ZenChat</span>
                </div>
                <button onClick={() => setShowAddForm(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleLinkInstance} className="p-5 space-y-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    Pas de compte ?{' '}
                    <a href="https://zechat.site/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Créer sur ZenChat</a>
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nom de l'instance" required>
                    <input type="text" name="instanceName" value={formData.instanceName} onChange={handleInputChange}
                      placeholder="ex: ma_boutique" required className="field-input" />
                  </Field>
                  <Field label="Token API" required>
                    <input type="password" name="instanceToken" value={formData.instanceToken} onChange={handleInputChange}
                      placeholder="Votre token" required className="field-input" />
                  </Field>
                  <Field label="Nom d'affichage" hint="optionnel">
                    <input type="text" name="customName" value={formData.customName} onChange={handleInputChange}
                      placeholder="ex: Support Client" className="field-input" />
                  </Field>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setShowAddForm(false)}
                    className="px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    Annuler
                  </button>
                  <button type="submit" disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                    style={{ background: ACCENT }}>
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {submitting ? 'Connexion...' : 'Connecter'}
                  </button>
                </div>
              </form>
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
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Aucune instance</p>
              <p className="text-xs text-gray-400 text-center max-w-xs mb-5">Liez une instance ZenChat API pour envoyer des messages WhatsApp.</p>
              <button onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg"
                style={{ background: ACCENT }}>
                <Plus className="w-3.5 h-3.5" /> Ajouter une instance
              </button>
            </div>
          )}

          {/* Instance Cards */}
          {!loading && instances.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {instances.map((inst) => {
                const st = getStatus(inst.status);
                const test = testResults[inst._id];
                const wh = webhookPanels[inst._id];
                const isConnected = inst.status === 'connected' || inst.status === 'active';
                return (
                  <div key={inst._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gray-300 transition-all">
                    <div className={`h-[3px] ${isConnected ? 'bg-emerald-500' : inst.status === 'configured' ? 'bg-blue-400' : 'bg-red-400'}`} />
                    <div className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${st.bg}`}>
                            <Smartphone className={`w-5 h-5 ${st.text}`} />
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

                      {/* Token */}
                      <div className="space-y-2">
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
                              <Globe className="w-3.5 h-3.5 text-blue-400" />
                              Webhook
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
                                <input
                                  value={wh.config?.url || ''}
                                  onChange={e => updateWh(inst._id, { config: { ...wh.config, url: e.target.value } })}
                                  placeholder="https://votre-serveur.com/webhook"
                                  className="field-input text-[12px]"
                                />
                              </div>
                              <div>
                                <p className="text-[11px] font-medium text-gray-600 mb-1.5">Événements</p>
                                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                                  {WEBHOOK_EVENTS.map(ev => (
                                    <label key={ev.id} className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer select-none">
                                      <input type="checkbox"
                                        checked={(wh.config?.events || []).includes(ev.id)}
                                        onChange={e => {
                                          const evts = e.target.checked
                                            ? [...(wh.config?.events || []), ev.id]
                                            : (wh.config?.events || []).filter(x => x !== ev.id);
                                          updateWh(inst._id, { config: { ...wh.config, events: evts } });
                                        }}
                                        className="w-3 h-3 cursor-pointer accent-emerald-500"
                                      />
                                      {ev.label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <button onClick={() => saveWebhookConfig(inst)} disabled={wh.saving}
                                className="w-full py-1.5 text-[12px] font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity"
                                style={{ background: ACCENT }}>
                                {wh.saving ? 'Sauvegarde...' : 'Enregistrer'}
                              </button>
                              {wh.error && <p className="text-[11px] text-red-600">{wh.error}</p>}
                              {wh.saved && <p className="text-[11px] text-emerald-600 font-medium">✓ Webhook configuré</p>}
                            </>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                        <span className="text-[11px] text-gray-300">
                          Modifié le {inst.updatedAt ? new Date(inst.updatedAt).toLocaleDateString('fr-FR') : '—'}
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
                          <button onClick={() => toggleWebhookPanel(inst)}
                            title="Configurer le webhook"
                            className={`p-1.5 rounded-lg transition-colors ${wh?.open ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}>
                            <Globe className="w-3.5 h-3.5" />
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

      {/* Tab: Rita IA */}
      {activeTab === 'rita' && (
        <RitaIATab
          instances={instances}
          externalPanel={ritaPanel || null}
          onExternalPanelChange={(panel) => setTab('rita', { ritaPanel: panel || '' })}
        />
      )}

      {/* Tab: Commandes */}
      {activeTab === 'orders' && <OrdersTab onCountChange={setOrderCount} />}

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
          z-index: 50;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          max-height: 260px;
          overflow-y: auto;
          background: white;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 14px;
          box-shadow: 0 12px 40px -8px rgba(0,0,0,0.12), 0 4px 16px -4px rgba(0,0,0,0.06);
          padding: 4px;
          animation: ritaDropIn .18s cubic-bezier(.2,0,0,1);
        }
        @keyframes ritaDropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
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
  const ref = React.useRef(null);
  const listRef = React.useRef(null);
  const selected = options.find(o => o.value === value);

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

  return (
    <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
      <button type="button" onClick={() => { setIsOpen(!isOpen); setFocused(options.findIndex(o => o.value === value)); }}
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
        <div className="rita-select-dropdown" role="listbox" ref={listRef}>
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
  { id: 'knowledge',    label: 'Connaissances', emoji: '📚' },
  { id: 'personality',  label: 'Personnalité',  emoji: '🎭' },
  { id: 'sales',        label: 'Vente',         emoji: '💰' },
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
    welcomeMessage: "Bonjour ma chérie 👋 Tu cherches quel produit exactement ?",
    fallbackMessage: 'Je transfère votre demande à un de nos conseillers. Il vous contactera dans les plus brefs délais.',
    autonomyLevel: 3,
    canCloseDeals: false,
    canSendPaymentLinks: false,
    requireHumanApproval: true,
    followUpEnabled: false,
    followUpDelay: 24,
    followUpMessage: "Bonjour ! Avez-vous eu le temps de réfléchir à notre offre ? Je suis là pour répondre à vos questions 😊",
    escalateAfterMessages: 10,
    businessContext: '',
    products: '',
    faq: '',
    usefulLinks: '',
    competitiveAdvantages: '',
    autoReplyKeywords: [],
    qualificationQuestions: ['Quel est votre budget ?', 'Pour quand en avez-vous besoin ?'],
    closingTechnique: 'soft',
    objectionsHandling: '',
    businessHoursOnly: false,
    businessHoursStart: '08:00',
    businessHoursEnd: '20:00',
    // Structured product catalog
    productCatalog: [],
    // Personality
    personality: { description: '', mannerisms: [], forbiddenPhrases: [], tonalGuidelines: '' },
    conversationExamples: [],
    behaviorRules: [],
    // Vocal
    responseMode: 'text',
    voiceMode: false,
    elevenlabsApiKey: '',
    elevenlabsVoiceId: '9ZATEeixBigmezesCGAk',
    elevenlabsModel: 'eleven_v3',
    // Notifications boss
    bossNotifications: false,
    bossPhone: '',
    notifyOnOrder: true,
    notifyOnScheduled: true,
    dailySummary: true,
    dailySummaryTime: '20:00',
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
  const [newMannerism, setNewMannerism] = useState('');
  const [newForbidden, setNewForbidden] = useState('');
  const [previewingVoice, setPreviewingVoice] = useState(null); // voiceId en cours de preview
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
      const { data } = await ecomApi.get(`/v1/external/whatsapp/preview-voice?voiceId=${voiceId}`);
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

  const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
  const userId = user._id || user.id;

  useEffect(() => { loadConfig(); }, []);
  useEffect(() => { simEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [simMessages, simTyping]);

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
    setSaving(true); setSaveStatus(null);
    try {
      const { data } = await ecomApi.post('/v1/external/whatsapp/rita-config', { userId, config: effectiveConfig });
      if (!data.success) { setSaveStatus({ type: 'error' }); return; }

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
    } catch { setSaveStatus({ type: 'error' }); }
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

  // ─── Product catalog helpers ───
  const addProduct = () => {
    const newP = { name: '', price: '', description: '', category: '', images: [], features: [], faq: [], objections: [], inStock: true };
    set('productCatalog', [...config.productCatalog, newP]);
    setEditingProduct(config.productCatalog.length);
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
        images: [], features: [], faq: [], objections: [], inStock: true,
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
                  {config.agentRole || 'Agent commercial IA'} · {config.language === 'fr' ? '🇫🇷' : config.language === 'en' ? '🇬🇧' : config.language === 'es' ? '🇪🇸' : '🇲🇦'} {config.language === 'fr' ? 'Français' : config.language === 'en' ? 'English' : config.language === 'es' ? 'Español' : 'العربية'}
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
                {saveStatus?.type === 'error' && <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Erreur</span>}
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
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">

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
                        { value: 'es', label: '🇪🇸 Español' },
                        { value: 'ar', label: '🇲🇦 العربية' },
                      ]}
                    />
                  </Field>
                  <Field label="Ton de communication">
                    <CustomSelect
                      value={config.toneStyle}
                      onChange={v => set('toneStyle', v)}
                      options={[
                        { value: 'warm', label: '😊 Chaleureux et Proche' },
                        { value: 'professional', label: '💼 Professionnel et Sérieux' },
                        { value: 'casual', label: '😎 Décontracté et Moderne' },
                        { value: 'persuasive', label: '🎯 Persuasif et Direct' },
                        { value: 'luxury', label: '✨ Premium et Exclusif' },
                      ]}
                    />
                  </Field>
                  <Field label="Délai avant de répondre" hint="secondes">
                    <input type="number" value={config.responseDelay} onChange={e => set('responseDelay', parseInt(e.target.value) || 0)} min="0" max="30" className="field-input" />
                  </Field>
                  <Field label="Instance WhatsApp">
                    <CustomSelect
                      value={config.instanceId}
                      onChange={v => set('instanceId', v)}
                      placeholder="Sélectionner une instance..."
                      options={instances.map(inst => ({ value: inst._id, label: inst.customName || inst.instanceName }))}
                    />
                    {instances.length === 0 && <p className="text-[11px] text-amber-600 mt-1.5">Ajoutez une instance dans l'onglet Instances d'abord.</p>}
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
                        <Field label="Escalader après" hint="messages sans réponse">
                          <input type="number" value={config.escalateAfterMessages} onChange={e => set('escalateAfterMessages', parseInt(e.target.value) || 10)} min="1" className="field-input" />
                        </Field>
                      </div>
                      <Field label="Message de relance">
                        <textarea value={config.followUpMessage} onChange={e => set('followUpMessage', e.target.value)} rows={3}
                          className="field-input" style={{ resize: 'none' }} />
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
                  <span>Ajoutez vos produits avec tous les détails : prix, description, images, FAQ et objections. Plus c'est complet, plus l'agent est efficace.</span>
                </div>

                {config.productCatalog.map((product, pIdx) => (
                  <div key={pIdx} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                    {/* Product header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer"
                      onClick={() => setEditingProduct(editingProduct === pIdx ? null : pIdx)}>
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 text-[12px] font-bold flex items-center justify-center flex-shrink-0">
                        {pIdx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{product.name || 'Nouveau produit'}</p>
                        <p className="text-[11px] text-gray-400">
                          {product.price ? `${product.price}` : 'Prix non défini'}
                          {product.category ? ` · ${product.category}` : ''}
                          {product.images?.length ? ` · ${product.images.length} photo${product.images.length > 1 ? 's' : ''}` : ''}
                          {product.faq?.length ? ` · ${product.faq.length} FAQ` : ''}
                          {product.objections?.length ? ` · ${product.objections.length} objection${product.objections.length > 1 ? 's' : ''}` : ''}
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
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg mt-2">
                      <span className="text-emerald-500 text-sm">✅</span>
                    <p className="text-[11px] text-emerald-700">Rita envoie un <strong>vocal</strong> quand la réponse est longue (explication, mise en confiance, présentation produit) et un <strong>texte</strong> pour les réponses courtes. Naturel et stratégique.</p>
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

                  <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <p className="text-[12px] text-amber-700">
                      ⚠️ En mode vocal, Rita envoie une <strong>note audio</strong> et ne répond plus en texte.
                      Si la génération échoue, elle bascule automatiquement en texte.
                    </p>
                  </div>
                </div>
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

/* ── Commandes WhatsApp (OrdersTab) ── */
const STATUS_LABELS = {
  pending:   { label: 'En attente', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  accepted:  { label: 'Acceptée',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  refused:   { label: 'Refusée',    bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  delivered: { label: 'Livrée',     bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  cancelled: { label: 'Annulée',    bg: 'bg-gray-50',    text: 'text-gray-600',    dot: 'bg-gray-400' },
};

const FILTER_TABS = [
  { id: '',         label: 'Toutes' },
  { id: 'pending',  label: 'En attente' },
  { id: 'accepted', label: 'Acceptées' },
  { id: 'refused',  label: 'Refusées' },
];

const OrdersTab = ({ onCountChange }) => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ pending: 0, accepted: 0, refused: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => { fetchAll(); }, [filter]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const qs = filter ? `?status=${filter}` : '';
      const [ordRes, stRes] = await Promise.all([
        ecomApi.get(`/v1/external/whatsapp/orders${qs}`),
        ecomApi.get('/v1/external/whatsapp/orders/stats'),
      ]);
      if (ordRes.data.success) setOrders(ordRes.data.orders || []);
      if (stRes.data.success) {
        setStats(stRes.data.stats || {});
        onCountChange?.(stRes.data.stats?.pending || 0);
      }
    } catch {} finally { setLoading(false); }
  };

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      const { data } = await ecomApi.patch(`/v1/external/whatsapp/orders/${id}`, { status });
      if (data.success) await fetchAll();
    } catch {} finally { setUpdatingId(null); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="space-y-5">

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',      value: stats.total,    color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'En attente', value: stats.pending,  color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Acceptées',  value: stats.accepted, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Refusées',   value: stats.refused,  color: 'text-red-700', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 border border-gray-100`}>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_TABS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              filter === f.id ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            style={filter === f.id ? { background: ACCENT } : undefined}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-400">Chargement...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
            <Package className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">Aucune commande</p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            Les commandes collectées par Rita apparaîtront ici.
          </p>
        </div>
      )}

      {/* Order cards */}
      {!loading && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map(order => {
            const st = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
            const isPending = order.status === 'pending';
            const isUpdating = updatingId === order._id;
            return (
              <div key={order._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                <div className="p-4 sm:p-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[15px] text-gray-900 leading-tight truncate">
                        {order.customerName || order.pushName || 'Client'}
                      </p>
                      <p className="text-[12px] text-gray-400 mt-0.5">{order.customerPhone}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${st.bg} ${st.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-[13px]">
                    <div>
                      <span className="text-gray-400 text-[11px] block">Produit</span>
                      <span className="font-medium text-gray-800">{order.productName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Prix</span>
                      <span className="font-semibold text-gray-900">{order.productPrice || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Ville</span>
                      <span className="text-gray-700">{order.customerCity || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Livraison</span>
                      <span className="text-gray-700">{order.deliveryDate || '—'}{order.deliveryTime ? ` à ${order.deliveryTime}` : ''}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Quantité</span>
                      <span className="text-gray-700">{order.quantity || 1}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Date</span>
                      <span className="text-gray-500 text-[12px]">{fmtDate(order.createdAt)} {fmtTime(order.createdAt)}</span>
                    </div>
                  </div>

                  {/* Conversation summary */}
                  {order.conversationSummary && (
                    <p className="mt-3 text-[12px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2 line-clamp-2">
                      {order.conversationSummary}
                    </p>
                  )}

                  {/* Actions */}
                  {isPending && (
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => updateStatus(order._id, 'accepted')}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50">
                        {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Accepter
                      </button>
                      <button
                        onClick={() => updateStatus(order._id, 'refused')}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50">
                        {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        Refuser
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WhatsAppService;
