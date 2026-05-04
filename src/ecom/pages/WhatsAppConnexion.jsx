import React, { useState, useEffect } from 'react';
import {
  MessageCircle, Plus, Trash2, RefreshCw,
  CheckCircle, AlertCircle, Loader2, ExternalLink,
  Copy, Check, Wifi, WifiOff, X
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const waStatus = (status) => {
  if (status === 'connected' || status === 'active')
    return { label: 'Connecté', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' };
  if (status === 'configured')
    return { label: 'Configuré', dot: 'bg-sky-400', badge: 'bg-sky-100 text-sky-700' };
  if (status === 'disconnected')
    return { label: 'Déconnecté', dot: 'bg-red-400', badge: 'bg-red-100 text-red-600' };
  return { label: 'Non vérifié', dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-500' };
};

const UsageBar = ({ used, limit, label }) => {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500 font-medium">{label}</span>
        <span className="font-bold text-gray-800">{used.toLocaleString('fr-FR')} <span className="font-normal text-gray-400">/ {limit.toLocaleString('fr-FR')}</span></span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const WhatsAppConnexion = () => {
  const [instances, setInstances]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [showAddForm, setShowAddForm]   = useState(false);
  const [copiedId, setCopiedId]         = useState(null);
  const [testResults, setTestResults]   = useState({});
  const [usageStats, setUsageStats]     = useState({});
  const [linkResult, setLinkResult]     = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [formData, setFormData]         = useState({ instanceName: '', instanceToken: '', customName: '', defaultPart: 50 });

  const user   = JSON.parse(localStorage.getItem('ecomUser') || '{}');
  const userId = user._id || user.id;

  useEffect(() => { loadInstances(); }, []);
  useEffect(() => { instances.forEach(i => fetchUsage(i._id)); }, [instances.length]);

  const loadInstances = async () => {
    try {
      setLoading(true); setError('');
      const res = await ecomApi.get(`/v1/external/whatsapp/instances?userId=${userId}`);
      if (res.data.success) setInstances(res.data.instances || []);
      else setInstances([]);
    } catch { setInstances([]);
    } finally { setLoading(false); }
  };

  const refreshAll = async () => {
    try {
      setLoading(true); setError('');
      const res = await ecomApi.post('/v1/external/whatsapp/refresh-status', { userId });
      if (res.data.success) setInstances(res.data.instances || []);
    } catch { setError('Erreur lors de la mise à jour');
    } finally { setLoading(false); }
  };

  const fetchUsage = async (id) => {
    try {
      const res = await ecomApi.get(`/v1/external/whatsapp/instances/${id}/usage?userId=${userId}`);
      if (res.data.success) setUsageStats(p => ({ ...p, [id]: res.data.usage }));
    } catch {}
  };

  const testConnection = async (instance) => {
    setTestResults(p => ({ ...p, [instance._id]: { loading: true } }));
    try {
      const res  = await ecomApi.post('/v1/external/whatsapp/verify-instance', { instanceId: instance._id });
      const data = res.data;
      setTestResults(p => ({ ...p, [instance._id]: {
        loading: false, success: data.success,
        message: data.success ? 'Connectée à WhatsApp' : (data.error || data.message),
        details: data.evolutionState ? `État : ${data.evolutionState}` : null,
      }}));
      if (data.status) setInstances(p => p.map(i => i._id === instance._id ? { ...i, status: data.status } : i));
      await fetchUsage(instance._id);
    } catch (e) {
      setTestResults(p => ({ ...p, [instance._id]: { loading: false, success: false, message: 'Impossible de joindre le serveur', details: e.message }}));
    }
  };

  const deleteInstance = async (instance) => {
    if (!confirm(`Supprimer "${instance.customName || instance.instanceName}" ?`)) return;
    try {
      const res = await ecomApi.delete(`/v1/external/whatsapp/instances/${instance._id}?userId=${userId}`);
      if (res.data.success) setInstances(p => p.filter(i => i._id !== instance._id));
      else setError(res.data.error || 'Erreur suppression');
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const handleLink = async (e) => {
    e.preventDefault(); setSubmitting(true); setError(''); setLinkResult(null);
    try {
      const res  = await ecomApi.post('/v1/external/whatsapp/link', { userId, ...formData });
      const data = res.data;
      if (data.success) {
        setFormData({ instanceName: '', instanceToken: '', customName: '', defaultPart: 50 });
        setShowAddForm(false);
        setLinkResult({ verified: data.verified, message: data.verificationMessage, status: data.data?.status });
        loadInstances();
      } else setError(data.error || "Erreur lors de la liaison");
    } catch (e) { setError(e.response?.data?.error || e.message);
    } finally { setSubmitting(false); }
  };

  const copy = (text, id) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };

  // Global stats
  const connected   = instances.filter(i => ['connected','active'].includes(i.status)).length;
  const offline     = instances.filter(i => i.status === 'disconnected').length;
  const totalDaily  = Object.values(usageStats).reduce((s,u) => s+(u?.dailyUsed||0), 0);
  const totalDailyL = Object.values(usageStats).reduce((s,u) => s+(u?.dailyLimit||0), 0) || 100;
  const totalMonthly  = Object.values(usageStats).reduce((s,u) => s+(u?.monthlyUsed||0), 0);
  const totalMonthlyL = Object.values(usageStats).reduce((s,u) => s+(u?.monthlyLimit||0), 0) || 5000;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Connexion WhatsApp</h1>
              <p className="text-[11px] text-gray-400">Instances ZenChat API</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshAll} disabled={loading}
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowAddForm(v => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition shadow-sm">
              {showAddForm ? <X className="w-4 h-4" /> : <><Plus className="w-4 h-4" /><span>Lier</span></>}
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Total</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{instances.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Connectées</p>
            <p className={`text-xl font-bold mt-0.5 ${connected > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{connected}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Hors ligne</p>
            <p className={`text-xl font-bold mt-0.5 ${offline > 0 ? 'text-red-500' : 'text-gray-400'}`}>{offline}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Msgs/jour</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{totalDaily}</p>
          </div>
        </div>

        {/* Global usage */}
        {instances.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Usage global</p>
            <UsageBar used={totalDaily} limit={totalDailyL} label="Messages aujourd'hui" />
            <UsageBar used={totalMonthly} limit={totalMonthlyL} label="Messages ce mois" />
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900">Nouvelle instance ZenChat</h2>
            <div className="px-3 py-2.5 bg-sky-50 border border-sky-100 rounded-xl text-xs text-sky-700">
              Pas encore de compte ZenChat ?{' '}
              <a href="https://zechat.site/" target="_blank" rel="noopener noreferrer"
                className="font-bold underline inline-flex items-center gap-0.5">
                S'inscrire gratuitement <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <form onSubmit={handleLink} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: 'instanceName', label: "Nom de l'instance", placeholder: 'ma_boutique_wa', type: 'text', required: true },
                { name: 'instanceToken', label: 'Token ZenChat', placeholder: 'Votre token secret', type: 'password', required: true },
                { name: 'customName', label: "Nom d'affichage", placeholder: 'Ex: Support Client', type: 'text' },
                { name: 'defaultPart', label: 'Part (%)', placeholder: '50', type: 'number' },
              ].map(f => (
                <div key={f.name}>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">{f.label}</label>
                  <input type={f.type} name={f.name} value={formData[f.name]} onChange={e => setFormData(p => ({ ...p, [f.name]: e.target.value }))}
                    placeholder={f.placeholder} required={f.required} min={f.name === 'defaultPart' ? 0 : undefined} max={f.name === 'defaultPart' ? 100 : undefined}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              ))}
              <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-2">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Liaison…</> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
        )}
        {linkResult && (
          <div className={`px-4 py-3 rounded-xl flex items-start gap-2 text-sm border ${
            linkResult.verified && linkResult.status === 'connected'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            {linkResult.verified && linkResult.status === 'connected'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-semibold">{linkResult.verified && linkResult.status === 'connected' ? 'Instance connectée !' : 'Instance enregistrée'}</p>
              {linkResult.message && <p className="text-xs opacity-80 mt-0.5">{linkResult.message}</p>}
            </div>
            <button onClick={() => setLinkResult(null)}><X className="w-4 h-4 opacity-50 hover:opacity-100" /></button>
          </div>
        )}

        {/* Instances */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-sm text-gray-500">Chargement…</p>
          </div>
        ) : instances.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Aucune instance connectée</p>
            <p className="text-xs text-gray-400 mt-1 mb-5">Liez votre compte WhatsApp via ZenChat pour commencer</p>
            <button onClick={() => setShowAddForm(true)}
              className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition">
              Lier ma première instance
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {instances.map(inst => {
              const st      = waStatus(inst.status);
              const usage   = usageStats[inst._id];
              const test    = testResults[inst._id];
              const isOff   = inst.status === 'disconnected';

              return (
                <div key={inst._id} className={`bg-white rounded-2xl border overflow-hidden ${isOff ? 'border-red-100' : 'border-gray-100'}`}>

                  {/* Card header */}
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isOff ? 'bg-red-50' : 'bg-emerald-50'}`}>
                      {isOff
                        ? <WifiOff className="w-4 h-4 text-red-400" />
                        : <Wifi className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{inst.customName || inst.instanceName}</p>
                      <p className="text-[11px] font-mono text-gray-400 truncate">{inst.instanceName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                      {inst.defaultPart !== undefined && (
                        <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">{inst.defaultPart}%</span>
                      )}
                      <button onClick={() => deleteInstance(inst)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-3.5 space-y-3">
                    {/* Token row */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Token</p>
                        <p className="text-xs font-mono text-gray-500 mt-0.5">••••••••••••</p>
                      </div>
                      <button onClick={() => copy(inst.instanceToken, inst._id+'tok')}
                        className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition">
                        {copiedId === inst._id+'tok' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Usage */}
                    {usage ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quotas</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            usage.plan === 'free' ? 'bg-gray-100 text-gray-500'
                            : usage.plan === 'premium' ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {usage.plan === 'free' ? 'Gratuit' : usage.plan === 'premium' ? 'Premium' : 'Illimité'}
                          </span>
                        </div>
                        <UsageBar used={usage.dailyUsed || 0} limit={usage.dailyLimit || 100} label="Aujourd'hui" />
                        <UsageBar used={usage.monthlyUsed || 0} limit={usage.monthlyLimit || 5000} label="Ce mois" />
                        {usage.limitExceeded && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="flex-1">Limite atteinte.</span>
                            <a href="https://zechat.site/" target="_blank" rel="noopener noreferrer"
                              className="font-bold underline flex items-center gap-0.5">
                              Passer Premium <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quotas</p>
                        <UsageBar used={0} limit={100} label="Aujourd'hui" />
                        <UsageBar used={0} limit={5000} label="Ce mois" />
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-gray-400">
                        Créé le {new Date(inst.createdAt || inst.updatedAt).toLocaleDateString('fr-FR')}
                      </p>
                      <button onClick={() => testConnection(inst)} disabled={test?.loading}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition disabled:opacity-50 bg-[#0F6B4F] text-white hover:bg-[#0a5740]">
                        {test?.loading
                          ? <><RefreshCw className="w-3 h-3 animate-spin" />Test…</>
                          : 'Tester la connexion'}
                      </button>
                    </div>

                    {/* Test result */}
                    {test && !test.loading && (
                      <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs border ${
                        test.success
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          : 'bg-red-50 border-red-100 text-red-700'
                      }`}>
                        {test.success
                          ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                        <div>
                          <p className="font-semibold">{test.message}</p>
                          {test.details && <p className="opacity-70 mt-0.5">{test.details}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppConnexion;
