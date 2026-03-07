import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
// ❌ CACHE DÉSACTIVÉ
// import { getCache, setCache } from '../utils/cacheUtils.js';
import WhatsAppInstanceSelector from '../components/WhatsAppInstanceSelector.jsx';
// WhatsAppConfigModal supprimé

const IconFillLoader = ({ backgroundClassName = 'bg-gray-50' }) => {
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf;
    let start;
    const durationMs = 1200;
    const tick = (t) => {
      if (!start) start = t;
      const elapsed = t - start;
      const progress = (elapsed % durationMs) / durationMs;
      setP(Math.min(100, Math.round(progress * 100)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`w-full h-full min-h-screen ${backgroundClassName} flex items-center justify-center`}>
      <div className="relative w-20 h-20">
        <img
          src="/icon.png"
          alt="Loading"
          className="w-20 h-20 object-contain opacity-20"
        />
        <div
          className="absolute inset-0 overflow-hidden transition-all duration-200 ease-out"
          style={{ clipPath: `inset(${100 - p}% 0 0 0)` }}
        >
          <img
            src="/icon.png"
            alt="Loading"
            className="w-20 h-20 object-contain"
          />
        </div>
      </div>
    </div>
  );
};

const statusLabels = { draft: 'Brouillon', scheduled: 'Programmée', sending: 'En cours', sent: 'Envoyée', paused: 'En pause', failed: 'Échouée', interrupted: 'Interrompue' };
const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-emerald-100 text-emerald-700',
  sending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-green-100 text-green-700',
  paused: 'bg-orange-100 text-orange-700',
  failed: 'bg-red-100 text-red-700',
  interrupted: 'bg-purple-100 text-purple-700'
};
const typeLabels = { relance_pending: 'Relance en attente', relance_cancelled: 'Relance annulés', promo: 'Promotion', followup: 'Suivi livraison', custom: 'Personnalisée' };

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

const Badge = ({ status }) => {
  const color = statusColors[status] || statusColors.draft;
  const label = statusLabels[status] || statusLabels.draft;
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
};

const Spin = () => (
  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    Chargement...
  </div>
);

const Dlg = ({ open, onClose, title, children, w = 'max-w-xl' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${w} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

const CampaignsList = () => {
  const { user } = useEcomAuth();
  const navigate = useNavigate();
  const { fmt } = useMoney(); // 🆕 Hook pour formater les montants
  const isAdmin = user?.role === 'ecom_admin';
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sending, setSending] = useState(null);
  const [showProgress, setShowProgress] = useState(null);
  const [sendProgress, setSendProgress] = useState(null);
  const [isPausing, setIsPausing] = useState(false);

  // 🆕 États pour l'aperçu à une personne
  const [showPreview, setShowPreview] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [previewSending, setPreviewSending] = useState(false);
  
  // États pour la sélection d'instance
  const [showInstanceSelector, setShowInstanceSelector] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState(null);
  const [instances, setInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);

  const fetchCampaigns = async (useCache = true) => {
    try {
      const res = await ecomApi.get('/campaigns');
      setCampaigns(res.data.data.campaigns || []);
      setStats(res.data.data.stats || {});
    } catch (err) {
      console.error('Erreur fetchCampaigns:', err);
      setError('Erreur chargement campagnes');
    }
  };

  useEffect(() => { fetchCampaigns().finally(() => setLoading(false)); }, []);

  
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  if (loading) {
    return <IconFillLoader />;
  }


  const handleSend = async (id, instanceId = null) => {
    if (selectedClient && showPreview === id) {
      if (!confirm(`Envoyer le message uniquement à ${selectedClient.firstName} ${selectedClient.lastName} ?`)) return;
      setSending(id);
      try {
        const response = await ecomApi.post('/campaigns/preview-send', { messageTemplate: previewData.messageTemplate, clientId: selectedClient._id });
        if (response.data.success) {
          setSuccess(`Message envoyé à ${selectedClient.firstName} ${selectedClient.lastName} !`);
          setShowPreview(null); setSelectedClient(null);
        } else { setError(response.data.message || 'Erreur lors de l\'envoi'); }
      } catch (err) { setError('Erreur lors de l\'envoi du message'); }
      finally { setSending(null); }
      return;
    }

    // Si aucune instance n'est sélectionnée, afficher le sélecteur
    if (!instanceId) {
      setPendingCampaignId(id);
      setLoadingInstances(true);
      try {
        const res = await ecomApi.get('/integrations/whatsapp');
        const activeInstances = (res.data.data || []).filter(i => i.status === 'connected' || i.isActive);
        if (activeInstances.length === 0) {
          setError('Aucune instance WhatsApp connectée. Configurez une instance dans les paramètres.');
          return;
        }
        setInstances(activeInstances);
        setShowInstanceSelector(true);
      } catch (err) {
        setError('Erreur lors du chargement des instances WhatsApp');
      } finally {
        setLoadingInstances(false);
      }
      return;
    }

    setSending(id);
    setShowProgress(id);
    setSendProgress({ sent: 0, failed: 0, skipped: 0, total: 0, campaignName: '', instance: '', status: 'starting', log: [] });
    setIsPausing(false);

    try {
      const baseUrl = ecomApi.defaults.baseURL;
      const token = localStorage.getItem('ecomToken');
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      const wsId = workspace?._id || workspace?.id;

      const response = await fetch(`${baseUrl}/marketing/campaigns/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ workspaceId: wsId, instanceId })
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.message || 'Erreur envoi');
        setSending(null); setShowProgress(null); setSendProgress(null);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastEventType = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop();

        for (const rawEvent of events) {
          const lines = rawEvent.split('\n');
          let eventType = 'message';
          let eventData = null;
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) { try { eventData = JSON.parse(line.slice(6)); } catch {} }
          }
          lastEventType = eventType;
          if (!eventData) continue;

          if (eventType === 'start') {
            console.log('📡 SSE start:', eventData);
            setSendProgress(p => ({ ...p, total: eventData.total, campaignName: eventData.campaignName, instance: eventData.instance, status: 'sending' }));
          } else if (eventType === 'progress') {
            const { sent, failed, skipped, total, index, current } = eventData;
            console.log(`📡 SSE progress: ${index}/${total} - ${current.name} (${current.status})`);
            setSendProgress(p => ({
              ...p, sent, failed, skipped, total, status: 'sending', currentIndex: index,
              log: [{ ...current, index, ts: Date.now() }, ...(p.log || [])].slice(0, 50)
            }));
          } else if (eventType === 'paused') {
            console.log('📡 SSE paused:', eventData);
            setSendProgress(p => ({ ...p, sent: eventData.sent, failed: eventData.failed, skipped: eventData.skipped, status: 'paused' }));
            setIsPausing(false);
          } else if (eventType === 'done') {
            console.log('📡 SSE done:', eventData);
            setSendProgress(p => ({ ...p, sent: eventData.sent, failed: eventData.failed, skipped: eventData.skipped, total: eventData.total, status: 'done' }));
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSendProgress(p => p ? { ...p, status: 'interrupted' } : null);
      }
    } finally {
      setSending(null);
      fetchCampaigns();
    }
  };

  const handlePause = async (id) => {
    setIsPausing(true);
    try {
      await ecomApi.post(`marketing/campaigns/${id}/pause`);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur pause');
      setIsPausing(false);
    }
  };

  const handleResume = async (id) => {
    try {
      await ecomApi.post(`marketing/campaigns/${id}/resume`);
      setSuccess('Campagne prête. Relance en cours...');
      fetchCampaigns();
      setTimeout(() => handleSend(id), 500);
    } catch (err) { setError(err.response?.data?.message || 'Erreur reprise'); }
  };

  const handleRestart = async (id) => {
    if (!confirm('Relancer la campagne depuis le début ?')) return;
    try {
      await ecomApi.post(`marketing/campaigns/${id}/restart`);
      fetchCampaigns();
      setTimeout(() => handleSend(id), 500);
    } catch (err) { setError(err.response?.data?.message || 'Erreur relance'); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer la campagne "${name}" ?`)) return;
    try {
      await ecomApi.delete(`/campaigns/${id}`);
      setSuccess('Campagne supprimée');
      fetchCampaigns();
    } catch { setError('Erreur suppression'); }
  };

  // Fonction pour charger l'aperçu d'une campagne
  const handlePreview = async (campaignId) => {
    try {
      const res = await ecomApi.post(`/campaigns/${campaignId}/preview`, {});
      setPreviewData(res.data.data);
      setShowPreview(campaignId);
      setSelectedClient(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur chargement aperçu');
    }
  };

  // Fonction pour envoyer un aperçu à une personne spécifique
  const handlePreviewSend = async (client) => {
    if (!showPreview || !previewData) return;
    
    // Sélectionner cette personne
    setSelectedClient(client);
    
    setPreviewSending(true);
    try {
      const response = await ecomApi.post('/campaigns/preview-send', {
        messageTemplate: previewData.messageTemplate,
        clientId: client._id
      });
      
      if (response.data.success) {
        setSuccess(`Message d'aperçu envoyé à ${client.firstName} ${client.lastName} !`);
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Erreur envoi aperçu';
      setError(errorMsg);
    } finally {
      setPreviewSending(false);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {success && <div className="mb-3 p-2.5 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200 flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>{success}</div>}
      {error && <div className="mb-3 p-2.5 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">{error}</div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Marketing</h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.total || 0} campagne{(stats.total || 0) > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/ecom/campaigns/stats" className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition text-sm font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            Statistiques
          </Link>
          <Link to="/ecom/campaigns/new" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Nouvelle campagne
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {[
          { label: 'Brouillons', value: stats.draft || 0, color: 'text-gray-600', bg: 'bg-gray-50' },
          { label: 'Programmées', value: stats.scheduled || 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'En cours', value: stats.sending || 0, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Envoyées', value: stats.sent || 0, color: 'text-green-600', bg: 'bg-green-50' }
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-lg p-3 text-center`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 uppercase font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Campaigns list */}
      {campaigns.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
          </div>
          <p className="text-gray-500 text-sm mb-1">Aucune campagne</p>
          <p className="text-gray-400 text-xs mb-3">Créez votre première campagne de relance WhatsApp</p>
          <Link to="/ecom/campaigns/new" className="inline-block text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            Créer une campagne
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map(c => (
            <div key={c._id} className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/campaigns/${c._id}/edit`} className="text-sm font-semibold text-gray-900 hover:text-emerald-600 truncate">{c.name}</Link>
                    <Badge status={c.status} />
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{typeLabels[c.type] || c.type}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      {c.stats?.targeted || 0} ciblés
                    </span>
                    {c.stats?.sent > 0 && (
                      <span className="text-green-600 font-medium">{c.stats.sent} envoyés</span>
                    )}
                    {c.stats?.failed > 0 && (
                      <span className="text-red-500">{c.stats.failed} échoués</span>
                    )}
                    <span>{fmtDate(c.createdAt)}</span>
                    {c.scheduledAt && <span className="text-emerald-600">Programmée: {fmtDate(c.scheduledAt)}</span>}
                  </div>
                  {c.messageTemplate && (
                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 italic">"{c.messageTemplate.substring(0, 120)}{c.messageTemplate.length > 120 ? '...' : ''}"</p>
                  )}
                  {(c.tags || []).length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {c.tags.map(t => <span key={t} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800">{t}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(c.status === 'draft' || c.status === 'scheduled') && (
                    <>
                      <button onClick={() => handlePreview(c._id)} disabled={sending === c._id} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs font-medium disabled:opacity-50 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        Aperçu
                      </button>
                      <button onClick={() => handleSend(c._id)} disabled={sending === c._id} className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs font-medium disabled:opacity-50 flex items-center gap-1">
                        {sending === c._id ? (<><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Envoi...</>) : (<><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>{c.status === 'scheduled' ? 'Envoyer maintenant' : 'Envoyer'}</>)}
                      </button>
                    </>
                  )}
                  {c.status === 'sending' && (
                    <button onClick={() => handlePause(c._id)} disabled={isPausing} className="px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-xs font-medium flex items-center gap-1 disabled:opacity-60">
                      {isPausing ? (<><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Arrêt...</>) : (<><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</>)}
                    </button>
                  )}
                  {['paused', 'interrupted', 'failed'].includes(c.status) && (
                    <>
                      <button onClick={() => handleResume(c._id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-medium flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
                        Reprendre
                      </button>
                      <button onClick={() => handleRestart(c._id)} className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-xs font-medium flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Relancer
                      </button>
                    </>
                  )}
                  {c.status === 'sent' && (
                    <>
                      <Link to={`/ecom/campaigns/${c._id}`} className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition text-xs font-medium flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                        Activité
                      </Link>
                      <button onClick={() => handleRestart(c._id)} className="px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition text-xs font-medium flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Relancer
                      </button>
                    </>
                  )}
                  <Link to={`/ecom/campaigns/${c._id}/edit`} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </Link>
                  {isAdmin && (
                    <button onClick={() => handleDelete(c._id, c.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      
      {/* 🆕 Modale d'aperçu */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Aperçu de la campagne</h3>
                  <p className="text-sm opacity-90 mt-1">
                    {previewData.clients?.length || 0} client{previewData.clients?.length > 1 ? 's' : ''} ciblé{previewData.clients?.length > 1 ? 's' : ''}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowPreview(null);
                    setSelectedClient(null); // 🆕 Réinitialiser la sélection
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Message template */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <p className="text-sm font-medium text-gray-700 mb-2">Message template:</p>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{previewData.messageTemplate}</p>
              </div>
            </div>
            
            {/* Liste des clients */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">Clients ciblés</p>
                <p className="text-xs text-gray-500">Cliquez sur "Aperçu" pour envoyer à une seule personne</p>
              </div>
              
              {/* 🆕 Indication de personne sélectionnée */}
              {selectedClient && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span className="text-sm font-medium text-green-800">
                        {selectedClient.firstName} {selectedClient.lastName} sélectionné(e)
                      </span>
                    </div>
                    <button
                      onClick={() => handleSend(showPreview)}
                      disabled={sending === showPreview}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      {sending === showPreview ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Envoi...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                          </svg>
                          Envoyer
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              <div className="max-h-96 overflow-y-auto space-y-2">
                {previewData.clients?.map(client => (
                  <div 
                    key={client._id} 
                    className={`flex items-center gap-3 p-3 rounded-lg transition cursor-pointer ${
                      selectedClient?._id === client._id 
                        ? 'bg-green-50 border border-green-200' 
                        : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedClient(client)}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{client.firstName} {client.lastName}</p>
                      <p className="text-sm text-gray-500">{client.phone}</p>
                      {client.city && <p className="text-xs text-gray-400">{client.city}</p>}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Empêcher la sélection du client
                        handlePreviewSend(client);
                      }}
                      disabled={previewSending}
                      className={`px-3 py-1.5 rounded-lg transition text-xs font-medium disabled:opacity-50 flex items-center gap-1 ${
                        selectedClient?._id === client._id
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-emerald-700 text-white hover:bg-emerald-800'
                      }`}
                    >
                      {previewSending ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Envoi...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                          </svg>
                          {selectedClient?._id === client._id ? 'Envoyer' : 'Aperçu'}
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal Configuration WhatsApp supprimé */}

      {/* ═══ MODAL PROGRESSION EN TEMPS RÉEL ═══ */}
      {showProgress && sendProgress && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className={`px-5 py-4 flex items-center justify-between ${
              sendProgress.status === 'done' ? 'bg-green-600' :
              sendProgress.status === 'paused' ? 'bg-orange-500' :
              sendProgress.status === 'interrupted' ? 'bg-purple-600' :
              'bg-emerald-600'
            } text-white`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {sendProgress.status === 'sending' && <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse flex-shrink-0"></div>}
                  {sendProgress.status === 'done' && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
                  {sendProgress.status === 'paused' && <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>}
                  {sendProgress.status === 'interrupted' && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
                  <h3 className="font-semibold text-sm truncate">
                    {sendProgress.status === 'starting' ? 'Préparation...' :
                     sendProgress.status === 'sending' ? `Envoi ${sendProgress.currentIndex || 0}/${sendProgress.total || '?'} — ${sendProgress.campaignName}` :
                     sendProgress.status === 'done' ? `Campagne terminée — ${sendProgress.campaignName}` :
                     sendProgress.status === 'paused' ? `Campagne en pause — ${sendProgress.campaignName}` :
                     `Campagne interrompue — ${sendProgress.campaignName}`}
                  </h3>
                </div>
                {sendProgress.instance && <p className="text-xs opacity-80 mt-0.5">Via : {sendProgress.instance}</p>}
              </div>
              {(sendProgress.status === 'done' || sendProgress.status === 'paused' || sendProgress.status === 'interrupted') && (
                <button onClick={() => { setShowProgress(null); setSendProgress(null); }} className="ml-3 p-1.5 hover:bg-white/20 rounded-lg transition flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{sendProgress.sent + sendProgress.skipped} / {sendProgress.total || '?'} traités</span>
                <span>{sendProgress.total > 0 ? Math.round(((sendProgress.sent + sendProgress.failed + sendProgress.skipped) / sendProgress.total) * 100) : 0}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sendProgress.status === 'done' ? 'bg-green-500' :
                    sendProgress.status === 'paused' ? 'bg-orange-400' :
                    sendProgress.status === 'interrupted' ? 'bg-purple-500' :
                    'bg-emerald-500'
                  }`}
                  style={{ width: sendProgress.total > 0 ? `${Math.round(((sendProgress.sent + sendProgress.failed + sendProgress.skipped) / sendProgress.total) * 100)}%` : '0%' }}
                />
              </div>
              {/* Counters */}
              <div className="flex gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                  <span className="text-gray-600"><span className="font-semibold text-green-700">{sendProgress.sent}</span> envoyés</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"></span>
                  <span className="text-gray-600"><span className="font-semibold text-gray-600">{sendProgress.skipped}</span> ignorés</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"></span>
                  <span className="text-gray-600"><span className="font-semibold text-red-600">{sendProgress.failed}</span> échecs</span>
                </div>
                {sendProgress.status === 'sending' && sendProgress.total > 0 && (
                  <div className="ml-auto text-xs text-gray-400">
                    ~{Math.round(((sendProgress.total - sendProgress.sent - sendProgress.failed - sendProgress.skipped) * 1.5) / 60)}min restantes
                  </div>
                )}
              </div>
            </div>

            {/* Live log */}
            <div className="flex-1 overflow-y-auto px-5 pb-2 min-h-0">
              <p className="text-xs font-medium text-gray-500 mb-2 sticky top-0 bg-white py-1">Journal d'envoi</p>
              <div className="space-y-1">
                {(sendProgress.log || []).map((entry, i) => (
                  <div key={i} className={`flex items-start gap-2 py-1.5 px-2 rounded-lg text-xs ${
                    entry.status === 'sent' ? 'bg-green-50' :
                    entry.status === 'failed' ? 'bg-red-50' :
                    'bg-gray-50'
                  }`}>
                    <span className="text-gray-400 flex-shrink-0 font-mono w-10">
                      #{entry.index || ''}
                    </span>
                    <span className="flex-shrink-0 mt-0.5">
                      {entry.status === 'sent' ? '✅' : entry.status === 'failed' ? '❌' : '⏭️'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{entry.name}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-gray-500 text-[10px]">{entry.phone}</span>
                    </div>
                    <span className={`text-xs flex-shrink-0 ${
                      entry.status === 'sent' ? 'text-green-600' :
                      entry.status === 'failed' ? 'text-red-500' :
                      'text-gray-400'
                    }`}>{entry.reason}</span>
                  </div>
                ))}
                {sendProgress.status === 'sending' && (
                  <div className="flex items-center gap-2 py-2 px-2 text-xs text-gray-400">
                    <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                    Envoi en cours...
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions */}
            {sendProgress.status === 'sending' && (
              <div className="px-5 py-3 border-t bg-gray-50">
                <button onClick={() => handlePause(showProgress)} disabled={isPausing} className="w-full py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {isPausing ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Arrêt en cours après ce message...</>) : (<><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Mettre en pause</>)}
                </button>
              </div>
            )}
            {sendProgress.status === 'done' && (
              <div className="px-5 py-3 border-t bg-gray-50">
                <div className="text-center text-sm text-green-700 font-medium">
                  ✅ Campagne envoyée avec succès ! {sendProgress.sent} message{sendProgress.sent > 1 ? 's' : ''} délivrés.
                </div>
              </div>
            )}
            {sendProgress.status === 'paused' && (
              <div className="px-5 py-3 border-t bg-orange-50 text-center text-sm text-orange-700 font-medium">
                ⏸️ Campagne en pause. Utilisez "Reprendre" pour continuer.
              </div>
            )}
            {sendProgress.status === 'interrupted' && (
              <div className="px-5 py-3 border-t bg-purple-50 text-center text-sm text-purple-700 font-medium">
                ⚡ Campagne interrompue. Utilisez "Reprendre" pour relancer.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de sélection d'instance WhatsApp */}
      <Dlg open={showInstanceSelector} onClose={() => { setShowInstanceSelector(false); setPendingCampaignId(null); }} title="Sélectionner une instance WhatsApp" w="max-w-md">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Choisissez l'instance WhatsApp à utiliser pour envoyer cette campagne :</p>
          
          {loadingInstances ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : instances.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Aucune instance WhatsApp connectée</p>
              <Link to="/ecom/settings/whatsapp" className="text-sm text-emerald-600 hover:text-emerald-700 mt-2 inline-block">
                Configurer une instance →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {instances.map(instance => (
                <button
                  key={instance._id}
                  onClick={() => {
                    setShowInstanceSelector(false);
                    handleSend(pendingCampaignId, instance._id);
                    setPendingCampaignId(null);
                  }}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition text-left group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <p className="font-semibold text-gray-900 truncate">
                          {instance.customName || instance.instanceName}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        Instance: {instance.instanceName}
                      </p>
                      {instance.defaultPart && (
                        <p className="text-xs text-emerald-600 mt-1">
                          Part par défaut: {instance.defaultPart}%
                        </p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Dlg>
    </div>
  );
};

export default CampaignsList;
