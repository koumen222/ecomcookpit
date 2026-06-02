import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
// ❌ CACHE DÉSACTIVÉ
// import { getCache, setCache } from '../utils/cacheUtils.js';
import WhatsAppInstanceSelector from '../components/WhatsAppInstanceSelector.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
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
const SC = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  scheduled: 'bg-gray-100 text-gray-700 border-gray-200',
  sending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  sent: 'bg-green-50 text-green-700 border-green-100',
  paused: 'bg-orange-50 text-orange-700 border-orange-100',
  failed: 'bg-red-50 text-red-700 border-red-100',
  interrupted: 'bg-gray-100 text-gray-600 border-gray-200',
};

// Couleurs par défaut pour les statuts de commandes personnalisés
const defaultOrderStatusColorMap = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  confirmed: 'bg-primary-50 text-primary-700 border-primary-100',
  shipped: 'bg-primary-50 text-primary-800 border-primary-100',
  delivered: 'bg-green-50 text-green-700 border-green-100',
  returned: 'bg-orange-50 text-orange-700 border-orange-100',
  cancelled: 'bg-red-50 text-red-700 border-red-100',
  unreachable: 'bg-red-50 text-red-700 border-red-100',
  called: 'bg-blue-50 text-blue-700 border-blue-100',
  postponed: 'bg-purple-50 text-purple-700 border-purple-100',
  reported: 'bg-purple-50 text-purple-700 border-purple-100'
};

const typeLabels = { relance_pending: 'Relance en attente', relance_cancelled: 'Relance annulés', promo: 'Promotion', followup: 'Suivi livraison', custom: 'Personnalisée' };

const typeToneClasses = {
  relance_pending: 'bg-gray-100 text-gray-600 border-gray-200',
  relance_cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  promo: 'bg-green-50 text-green-700 border-green-100',
  followup: 'bg-gray-100 text-gray-600 border-gray-200',
  custom: 'bg-gray-100 text-gray-600 border-gray-200',
};

const campaignProgressColor = {
  done: 'bg-green-500',
  paused: 'bg-orange-400',
  interrupted: 'bg-gray-400',
  reconnecting: 'bg-yellow-500',
  sending: 'bg-gray-900',
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

const getCampaignTone = (status) => campaignToneMap[status] || campaignToneMap.draft;
const getTypeTone = (type) => typeToneClasses[type] || typeToneClasses.custom;
const compactMessage = (message, limit = 180) => {
  if (!message) return '';
  return message.length > limit ? `${message.slice(0, limit).trim()}...` : message;
};

const Badge = ({ status }) => {
  const cls = SC[status] || SC.draft;
  const label = statusLabels[status] || status;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${cls}`}>{label}</span>;
};

const Spin = () => (
  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
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
  const location = useLocation();
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
  const [pausingCampaignId, setPausingCampaignId] = useState(null);
  const [isProgressMinimized, setIsProgressMinimized] = useState(false);
  const [availableOrderStatuses, setAvailableOrderStatuses] = useState([]);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('all');

  // 🆕 États pour l'aperçu à une personne
  const [showPreview, setShowPreview] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [previewSending, setPreviewSending] = useState(false);
  const [showInstanceSelector, setShowInstanceSelector] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState(null);
  const [pendingInstanceId, setPendingInstanceId] = useState(null); // instance déjà connue (reprise)
  const [instances, setInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');

  const closePreviewModal = () => {
    setShowPreview(null);
    setPreviewData(null);
    setSelectedClient(null);
    setPreviewSending(false);
    setManualPhone('');
    setManualName('');
  };

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

  const fetchAvailableStatuses = async () => {
    try {
      const res = await ecomApi.get('/orders/available-statuses');
      setAvailableOrderStatuses(res.data.data.statuses || []);
    } catch (err) {
      console.error('Erreur fetch available-statuses:', err);
      // Fallback to default statuses
      setAvailableOrderStatuses(['pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled', 'unreachable', 'called', 'postponed', 'reported']);
    }
  };

  useEffect(() => {
    fetchCampaigns().finally(() => setLoading(false));
    fetchAvailableStatuses();
    const onStoreSwitch = () => { setLoading(true); fetchCampaigns().finally(() => setLoading(false)); };
    window.addEventListener('scalor:store-switch', onStoreSwitch);
    return () => window.removeEventListener('scalor:store-switch', onStoreSwitch);
  }, []);
  
  // Force refresh when coming from campaign creation
  useEffect(() => {
    if (location.state?.refresh) {
      console.log('🔄 Refreshing campaigns list after creation');
      fetchCampaigns();
      // Clear the state to avoid re-fetching on every render
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  if (loading) {
    return <IconFillLoader />;
  }


  const loadInstances = async () => {
    try {
      setLoadingInstances(true);
      const user = (() => { try { return JSON.parse(localStorage.getItem('ecomUser') || '{}'); } catch { return {}; } })();
      const userId = user._id || user.id;
      const response = await ecomApi.get(`/v1/external/whatsapp/instances?userId=${userId}`);
      const list = response.data.success ? (response.data.instances || []) : [];
      setInstances(list);
      return list;
    } catch (err) {
      setError('Erreur chargement instances WhatsApp');
      return [];
    } finally {
      setLoadingInstances(false);
    }
  };

  const refreshInstancesStatus = async () => {
    try {
      setLoadingInstances(true);
      const user = (() => { try { return JSON.parse(localStorage.getItem('ecomUser') || '{}'); } catch { return {}; } })();
      const userId = user._id || user.id;
      const res = await ecomApi.post('/v1/external/whatsapp/refresh-status', { userId });
      const list = res.data?.instances || [];
      setInstances(list);
      return list;
    } catch {
      setError("Impossible d'actualiser les statuts");
      return instances;
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleSend = async (id) => {
    if ((selectedClient || manualPhone.trim()) && showPreview === id) {
      const targetLabel = manualPhone.trim()
        ? `${manualName.trim() || 'Destinataire'} (${manualPhone.trim()})`
        : `${selectedClient.firstName} ${selectedClient.lastName}`;
      if (!confirm(`Envoyer le message uniquement à ${targetLabel} ?`)) return;
      setSending(id);
      try {
        const payload = {
          messageTemplate: previewData.messageTemplate,
          media: previewData.media
        };
        if (manualPhone.trim()) {
          payload.manualPhone = manualPhone.trim();
          payload.manualName = manualName.trim();
        } else {
          payload.clientId = selectedClient._id;
        }
        const response = await ecomApi.post('/campaigns/preview-send', payload);
        if (response.data.success) {
          setSuccess(`Message envoyé à ${targetLabel} !`);
          closePreviewModal();
        } else { setError(response.data.message || 'Erreur lors de l\'envoi'); }
      } catch (err) { setError('Erreur lors de l\'envoi du message'); }
      finally { setSending(null); }
      return;
    }

    // Charger les instances WhatsApp
    setPendingCampaignId(id);
    setLoadingInstances(true);
    try {
      const user = (() => { try { return JSON.parse(localStorage.getItem('ecomUser') || '{}'); } catch { return {}; } })();
      const userId = user._id || user.id;
      const response = await ecomApi.get(`/v1/external/whatsapp/instances?userId=${userId}`);
      const loadedInstances = response.data.success ? (response.data.instances || []) : [];
      setInstances(loadedInstances);

      // Auto-sélection si une seule instance
      if (loadedInstances.length === 1) {
        setPendingCampaignId(null);
        await startSendStream(id, loadedInstances[0]._id);
      } else {
        setShowInstanceSelector(true);
      }
    } catch (err) {
      setError('Erreur chargement instances WhatsApp');
      setPendingCampaignId(null);
    } finally {
      setLoadingInstances(false);
    }
  };

  // Lance le streaming SSE pour une campagne + instance données
  const startSendStream = async (id, instanceId) => {
    setSending(id);
    setShowProgress(id);
    setIsProgressMinimized(false);
    setSendProgress({ sent: 0, failed: 0, skipped: 0, total: 0, campaignName: '', instance: '', status: 'starting', log: [] });
    setPausingCampaignId(null);

    try {
      const baseUrl = ecomApi.defaults.baseURL;
      const token = localStorage.getItem('ecomToken');
      const workspace = (() => { try { return JSON.parse(localStorage.getItem('ecomWorkspace') || 'null'); } catch { return null; } })();
      const wsId = workspace?._id || workspace?.id;

      const response = await fetch(`${baseUrl}/marketing/campaigns/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ workspaceId: wsId, whatsappInstanceId: instanceId })
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.message || err.error || 'Erreur envoi');
        setSending(null); setShowProgress(null); setSendProgress(null);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
          if (!eventData) continue;

          if (eventType === 'start') {
            setSendProgress(p => ({ ...p, total: eventData.total, campaignName: eventData.campaignName, instance: eventData.instance, status: 'sending' }));
          } else if (eventType === 'substep') {
            const { name, phone, step, status, error } = eventData;
            setSendProgress(p => ({
              ...p,
              currentSubstep: { name, phone, step, status },
              log: [{ type: 'substep', name, phone, step, status, error, ts: Date.now() }, ...(p.log || [])].slice(0, 100)
            }));
          } else if (eventType === 'progress') {
            const { sent, failed, skipped, total, index, current } = eventData;
            setSendProgress(p => ({
              ...p, sent, failed, skipped, total, status: 'sending', currentIndex: index,
              log: [{ ...current, index, ts: Date.now() }, ...(p.log || [])].slice(0, 50)
            }));
          } else if (eventType === 'paused') {
            setSendProgress(p => ({ ...p, sent: eventData.sent, failed: eventData.failed, skipped: eventData.skipped, status: 'paused', batchPause: null }));
            setPausingCampaignId(null);
          } else if (eventType === 'done') {
            setSendProgress(p => ({ ...p, sent: eventData.sent, failed: eventData.failed, skipped: eventData.skipped, total: eventData.total, status: 'done', batchPause: null }));
          } else if (eventType === 'batch_pause') {
            if (eventData.status === 'done') {
              setSendProgress(p => ({ ...p, batchPause: null }));
            } else {
              setSendProgress(p => ({ ...p, batchPause: { remainingMin: eventData.remainingMin, totalMin: eventData.totalMin } }));
            }
          } else if (eventType === 'resume') {
            setSendProgress(p => ({ ...p, batchPause: null, status: 'sending', sent: eventData.sent, failed: eventData.failed, skipped: eventData.skipped }));
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Ne pas marquer "interrupted" immédiatement — la campagne continue peut-être en arrière-plan
        // Vérifier le vrai statut depuis la DB après un court délai
        console.warn('[Campaign] Stream coupé:', err.message, '— vérification statut en cours...');
        setTimeout(async () => {
          try {
            await fetchCampaigns();
            // fetchCampaigns va mettre à jour la liste, on peut vérifier si la campagne est toujours "sending"
          } catch {}
        }, 2000);
        // Afficher juste un warning, pas une interruption
        setSendProgress(p => p ? { ...p, status: 'reconnecting' } : null);
      }
    } finally {
      setSending(null);
      fetchCampaigns();
      // Ne pas effacer sendProgress ici — l'utilisateur doit fermer manuellement le modal/widget
    }
  };

  const handleInstanceSelected = async (instance) => {
    const id = pendingCampaignId;
    if (!id || !instance) return;
    setShowInstanceSelector(false);
    setPendingCampaignId(null);
    await startSendStream(id, instance._id);
  };

  const handlePause = async (id) => {
    setPausingCampaignId(id);
    try {
      await ecomApi.post(`/marketing/campaigns/${id}/pause`);
      setSuccess('Pause demandée, arrêt après le message en cours...');
      // Rafraîchir la liste après quelques secondes pour refléter le nouveau statut
      setTimeout(() => fetchCampaigns(), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur pause');
    } finally {
      // Toujours réinitialiser le spinner — si le flux SSE est actif,
      // l'événement "paused" le réinitialisera également (sans effet secondaire)
      setPausingCampaignId(null);
    }
  };

  const handleResume = async (id) => {
    try {
      await ecomApi.post(`/marketing/campaigns/${id}/resume`);
      setPendingCampaignId(id);
      const list = await loadInstances();
      if (list.length === 1) {
        setPendingCampaignId(null);
        await startSendStream(id, list[0]._id);
      } else {
        setShowInstanceSelector(true);
      }
    } catch (err) { setError(err.response?.data?.message || 'Erreur reprise'); }
  };

  const handleForceReset = async (id) => {
    try {
      await ecomApi.post(`/marketing/campaigns/${id}/force-reset`);
      await fetchCampaigns();
    } catch (err) { setError(err.response?.data?.message || 'Erreur reset'); }
  };

  const handleRestart = async (id) => {
    if (!confirm('Relancer la campagne depuis le début ?')) return;
    try {
      await ecomApi.post(`/marketing/campaigns/${id}/restart`);
      setPendingCampaignId(id);
      const list = await loadInstances();
      if (list.length === 1) {
        setPendingCampaignId(null);
        await startSendStream(id, list[0]._id);
      } else {
        setShowInstanceSelector(true);
      }
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
      setPreviewSending(false);
      setManualPhone('');
      setManualName('');
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


  const totalTargeted = campaigns.reduce((sum, c) => sum + (c.stats?.targeted || c.recipientSnapshotIds?.length || c.selectedClientIds?.length || 0), 0);
  const totalSentCount = campaigns.reduce((sum, c) => sum + (c.stats?.sent || 0), 0);
  const liveCount = campaigns.filter(c => c.status === 'sending').length;
  const pausedCount = campaigns.filter(c => c.status === 'paused').length;

  const statusFilterOptions = [
    { key: 'all', label: 'Toutes', count: campaigns.length },
    ...['draft', 'scheduled', 'sending', 'paused', 'sent', 'failed', 'interrupted'].map(s => ({
      key: s, label: statusLabels[s] || s, count: campaigns.filter(c => c.status === s).length
    }))
  ].filter(o => o.key === 'all' || o.count > 0 || campaignStatusFilter === o.key);

  const filteredCampaigns = campaignStatusFilter === 'all'
    ? campaigns
    : campaigns.filter(c => c.status === campaignStatusFilter);

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {success && (
        <div className="mb-4 flex items-center gap-2.5 p-3 bg-green-50 text-green-800 rounded-xl text-sm border border-green-100">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          {success}
        </div>
      )}
      <ErrorBanner message={error} onDismiss={() => setError('')} className="mb-4" />

      {!(showProgress && sendProgress && !isProgressMinimized) && (<>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Campagnes</h1>
            <p className="text-sm text-gray-400 mt-0.5">Relances et diffusions WhatsApp</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/ecom/campaigns/stats" className="h-10 px-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              <span className="hidden sm:inline">Stats</span>
            </Link>
            <Link to="/ecom/campaigns/new" className="h-10 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4"/></svg>
              <span>Campagne</span>
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total', value: stats.total || 0 },
            { label: 'En cours', value: liveCount, active: liveCount > 0 },
            { label: 'Envoyés', value: totalSentCount, green: true },
            { label: 'En pause', value: pausedCount },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 font-medium mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.green ? 'text-green-600' : s.active ? 'text-yellow-600' : 'text-gray-900'}`}>
                {typeof s.value === 'number' ? s.value.toLocaleString('fr-FR') : s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Filtres statut */}
        {campaigns.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex flex-wrap gap-1.5">
              {statusFilterOptions.map(opt => {
                const active = campaignStatusFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setCampaignStatusFilter(opt.key)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${active ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    {opt.label}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>{opt.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
          </div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Aucune campagne</p>
          <p className="text-sm text-gray-400 mb-4">Créez votre première campagne de relance WhatsApp.</p>
          <Link to="/ecom/campaigns/new" className="inline-flex items-center gap-2 h-10 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4"/></svg>
            Créer une campagne
          </Link>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-gray-800 mb-1">Aucune campagne dans ce segment</p>
          <p className="text-sm text-gray-400 mb-4">Changez le filtre pour voir d'autres campagnes.</p>
          <button onClick={() => setCampaignStatusFilter('all')} className="h-9 px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">Tout afficher</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.map(c => {
            const targetedCount = c.stats?.targeted || c.recipientSnapshotIds?.length || c.selectedClientIds?.length || 0;
            const sentCount = c.stats?.sent || 0;
            const failedCount = c.stats?.failed || 0;
            const processedCount = sentCount + failedCount;
            const pct = targetedCount > 0 ? Math.min(100, Math.round((processedCount / targetedCount) * 100)) : 0;

            return (
              <article key={c._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
                {/* accent line */}
                <div className={`h-1 w-full ${c.status === 'sent' ? 'bg-green-500' : c.status === 'sending' ? 'bg-yellow-400' : c.status === 'paused' ? 'bg-orange-400' : c.status === 'failed' || c.status === 'interrupted' ? 'bg-red-400' : 'bg-gray-200'}`}/>

                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Link to={`/ecom/campaigns/${c._id}/edit`} className="text-base font-bold text-gray-900 hover:text-gray-600 transition-colors truncate">
                          {c.name}
                        </Link>
                        <Badge status={c.status} />
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${typeToneClasses[c.type] || typeToneClasses.custom}`}>
                          {typeLabels[c.type] || c.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{fmtDate(c.createdAt)}{c.scheduledAt ? ` · Programmée: ${fmtDate(c.scheduledAt)}` : ''}</p>
                    </div>
                  </div>

                  {/* Stats 4 blocs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Ciblés</p>
                      <p className="text-xl font-bold text-gray-900">{targetedCount}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="text-[10px] font-semibold text-green-500 uppercase tracking-wide mb-1">Envoyés</p>
                      <p className="text-xl font-bold text-green-700">{sentCount}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Échecs</p>
                      <p className="text-xl font-bold text-red-500">{failedCount}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Progression</p>
                      <p className="text-xl font-bold text-gray-900">{pct}%</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {targetedCount > 0 && (
                    <div className="mb-4">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${c.status === 'sent' ? 'bg-green-500' : c.status === 'paused' ? 'bg-orange-400' : 'bg-gray-900'}`}
                          style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>{processedCount} traités</span>
                        <span>{targetedCount - processedCount} restants</span>
                      </div>
                    </div>
                  )}

                  {/* Message preview */}
                  {c.messageTemplate && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100 mb-4">
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">"{compactMessage(c.messageTemplate, 120)}"</p>
                    </div>
                  )}

                  {/* Tags */}
                  {(c.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {c.tags.map(t => <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{t}</span>)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                    {(c.status === 'draft' || c.status === 'scheduled') && (<>
                      <button onClick={() => handlePreview(c._id)} disabled={sending === c._id} className="h-9 px-3 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-gray-200 transition-colors disabled:opacity-50">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        Aperçu
                      </button>
                      <button onClick={() => handleSend(c._id)} disabled={sending === c._id} className="h-9 px-3 bg-green-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-green-700 transition-colors disabled:opacity-50">
                        {sending === c._id ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/> Envoi...</> : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>{c.status === 'scheduled' ? 'Envoyer maintenant' : 'Envoyer'}</>}
                      </button>
                    </>)}

                    {c.status === 'sending' && sending === c._id && (
                      <button onClick={() => handlePause(c._id)} disabled={pausingCampaignId === c._id} className="h-9 px-3 bg-orange-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-orange-600 transition-colors disabled:opacity-60">
                        {pausingCampaignId === c._id ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/> Arrêt...</> : <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>}
                      </button>
                    )}

                    {c.status === 'sending' && sending !== c._id && (<>
                      <button onClick={() => handleResume(c._id)} className="h-9 px-3 bg-gray-900 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-gray-800 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
                        Reprendre
                      </button>
                      <button onClick={() => handleForceReset(c._id)} className="h-9 px-3 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-gray-200 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12"/></svg>
                        Forcer l'arrêt
                      </button>
                    </>)}

                    {['paused', 'interrupted', 'failed'].includes(c.status) && (<>
                      <button onClick={() => handleResume(c._id)} className="h-9 px-3 bg-gray-900 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-gray-800 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
                        Reprendre
                      </button>
                      <button onClick={() => handleRestart(c._id)} className="h-9 px-3 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-gray-200 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Relancer
                      </button>
                    </>)}

                    {c.status === 'sent' && (<>
                      <Link to={`/ecom/campaigns/${c._id}`} className="h-9 px-3 bg-green-50 text-green-700 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-green-100 transition-colors border border-green-100">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                        Activité
                      </Link>
                      <button onClick={() => handleRestart(c._id)} className="h-9 px-3 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-gray-200 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Relancer
                      </button>
                    </>)}

                    {c.status !== 'sending' && (
                      <Link to={`/ecom/campaigns/${c._id}/edit`} className="h-9 px-3 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium flex items-center hover:bg-gray-50 transition-colors">
                        Modifier
                      </Link>
                    )}
                    {isAdmin && c.status !== 'sending' && (
                      <button onClick={() => handleDelete(c._id, c.name)} className="h-9 w-9 flex items-center justify-center bg-gray-50 border border-gray-200 text-red-400 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      </>)}


      {/* Modal aperçu */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={closePreviewModal}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"/>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Aperçu campagne</h3>
                <p className="text-xs text-gray-400">{previewData.clients?.length || 0} destinataire{(previewData.clients?.length || 0) > 1 ? 's' : ''} ciblé{(previewData.clients?.length || 0) > 1 ? 's' : ''}</p>
              </div>
              <button onClick={closePreviewModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden grid xl:grid-cols-[340px,minmax(0,1fr)]">
              {/* Colonne gauche — message + envoi manuel */}
              <div className="overflow-y-auto border-b xl:border-b-0 xl:border-r border-gray-100 p-5 space-y-4 bg-gray-50">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</p>
                    <span className="text-xs text-gray-400">{previewData.messageTemplate?.length || 0} car.</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 bg-gray-50 rounded-lg p-3">{previewData.messageTemplate}</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Envoi manuel</p>
                  <div className="space-y-2.5">
                    <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Nom du destinataire" className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"/>
                    <input type="tel" inputMode="numeric" value={manualPhone} onChange={e => { setManualPhone(e.target.value); setSelectedClient(null); }} placeholder="Numéro WhatsApp" className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"/>
                    <button onClick={() => handleSend(showPreview)} disabled={sending === showPreview || !manualPhone.trim()} className="w-full h-10 bg-gray-900 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-40 transition-colors">
                      {sending === showPreview && manualPhone.trim() ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Envoi...</> : <>Envoyer à ce numéro</>}
                    </button>
                  </div>
                </div>

                {(selectedClient || manualPhone.trim()) && (
                  <div className="bg-green-50 rounded-xl border border-green-100 p-4">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Sélection active</p>
                    <p className="text-sm font-semibold text-green-900">
                      {manualPhone.trim() ? `${manualName.trim() || 'Destinataire'} (${manualPhone.trim()})` : `${selectedClient.firstName} ${selectedClient.lastName}`}
                    </p>
                    <button onClick={() => handleSend(showPreview)} disabled={sending === showPreview} className="mt-3 w-full h-10 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-40 transition-colors">
                      {sending === showPreview ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>}
                      {sending === showPreview ? 'Envoi...' : 'Envoyer'}
                    </button>
                  </div>
                )}
              </div>

              {/* Colonne droite — liste clients */}
              <div className="overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clients ciblés</p>
                  <span className="text-xs text-gray-400">{previewData.clients?.length || 0} profil{(previewData.clients?.length || 0) > 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2">
                  {previewData.clients?.map(client => {
                    const isSel = selectedClient?._id === client._id && !manualPhone.trim();
                    return (
                      <div key={client._id} onClick={() => { setSelectedClient(client); setManualPhone(''); }} className={`rounded-xl border p-3 cursor-pointer transition-colors ${isSel ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{client.firstName} {client.lastName}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{client.phone}{client.city ? ` · ${client.city}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={e => { e.stopPropagation(); setSelectedClient(client); setManualPhone(''); }} className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors ${isSel ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                              {isSel ? 'Choisi' : 'Choisir'}
                            </button>
                            <button onClick={e => { e.stopPropagation(); handlePreviewSend(client); }} disabled={previewSending} className="h-7 px-2.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center gap-1">
                              {previewSending ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
                              Test
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal instance WhatsApp */}
      {showInstanceSelector && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => { setShowInstanceSelector(false); setPendingCampaignId(null); }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden"/>
            <div className="px-5 pt-4 pb-2 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-gray-900">Envoyer la campagne</h2>
                <p className="text-xs text-gray-400">Choisissez l'instance WhatsApp</p>
              </div>
              <button onClick={() => { setShowInstanceSelector(false); setPendingCampaignId(null); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="px-5 py-4 max-h-[55vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {instances.length > 0 ? `${instances.length} instance${instances.length > 1 ? 's' : ''}` : 'Instances'}
                </p>
                <button onClick={refreshInstancesStatus} disabled={loadingInstances} className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1 disabled:opacity-40">
                  <svg className={`w-3.5 h-3.5 ${loadingInstances ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Actualiser
                </button>
              </div>

              {loadingInstances && instances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/>
                  <p className="text-xs text-gray-400">Chargement...</p>
                </div>
              ) : instances.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Aucune instance</p>
                  <p className="text-xs text-gray-400 mb-4">Connectez WhatsApp pour envoyer des campagnes</p>
                  <a href="/ecom/whatsapp/service" className="inline-flex items-center gap-1.5 h-9 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
                    Configurer WhatsApp
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {instances.map(instance => {
                    const isReady = instance.status === 'connected' || instance.status === 'active';
                    return (
                      <button key={instance._id} onClick={() => isReady && handleInstanceSelected(instance)} disabled={!isReady}
                        className={`w-full p-3 rounded-xl border text-left transition-colors ${isReady ? 'border-gray-200 hover:border-gray-900 hover:bg-gray-50 cursor-pointer' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isReady ? 'bg-green-50' : 'bg-gray-100'}`}>
                            <svg className={`w-4 h-4 ${isReady ? 'text-green-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{instance.customName || instance.instanceName}</p>
                            <p className="text-[10px] text-gray-400 font-mono truncate">{instance.instanceName}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 flex-shrink-0 ${isReady ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-red-400'}`}/>
                            {isReady ? 'Connecté' : 'Hors ligne'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">Vous pouvez mettre en pause à tout moment</p>
              <button onClick={() => { setShowInstanceSelector(false); setPendingCampaignId(null); }} className="h-8 px-3 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Widget progression minimisé */}
      {showProgress && sendProgress && isProgressMinimized && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl cursor-pointer text-white max-w-xs w-full ${
            sendProgress.status === 'done' ? 'bg-green-600' :
            sendProgress.status === 'paused' ? 'bg-orange-500' :
            sendProgress.status === 'interrupted' || sendProgress.status === 'reconnecting' ? 'bg-gray-700' :
            'bg-gray-900'
          }`}
          onClick={() => setIsProgressMinimized(false)}
        >
          {sendProgress.status === 'sending' && <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse flex-shrink-0"></div>}
          {sendProgress.status === 'reconnecting' && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"></div>}
          {sendProgress.status === 'done' && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
          {sendProgress.status === 'paused' && <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>}
          {sendProgress.status === 'interrupted' && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{sendProgress.campaignName || 'Campagne'}</p>
            <p className="text-[11px] opacity-80">
              {sendProgress.status === 'sending'
                ? sendProgress.batchPause
                  ? `⏳ Pause anti-spam — reprise dans ${sendProgress.batchPause.remainingMin}min`
                  : `${sendProgress.currentIndex || 0}/${sendProgress.total || '?'} envoyés`
                : sendProgress.status === 'done' ? 'Terminée'
                : sendProgress.status === 'paused' ? 'En pause'
                : sendProgress.status === 'reconnecting' ? 'Connexion perdue — envoi en cours...'
                : 'Interrompue'}
            </p>
          </div>
          {sendProgress.total > 0 && (
            <div className="w-10 h-10 flex-shrink-0 relative">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                <circle cx="18" cy="18" r="15" fill="none" stroke="white" strokeWidth="3"
                  strokeDasharray={`${Math.round(((sendProgress.sent + sendProgress.failed + sendProgress.skipped) / sendProgress.total) * 94)} 94`}/>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
                {Math.round(((sendProgress.sent + sendProgress.failed + sendProgress.skipped) / sendProgress.total) * 100)}%
              </span>
            </div>
          )}
          {/* Expand icon */}
          <svg className="w-4 h-4 flex-shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"/></svg>
          {/* Reprendre button when interrupted / Rafraîchir when reconnecting */}
          {sendProgress.status === 'interrupted' && showProgress && (
            <button
              onClick={(e) => { e.stopPropagation(); handleResume(showProgress); }}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition flex-shrink-0"
            >
              Reprendre
            </button>
          )}
          {/* Close button when terminal */}
          {['done', 'paused', 'interrupted', 'reconnecting'].includes(sendProgress.status) && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowProgress(null); setSendProgress(null); setIsProgressMinimized(false); }}
              className="p-1 hover:bg-white/30 rounded-full transition flex-shrink-0"
              title="Fermer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      )}

      {/* Panel progression */}
      {showProgress && sendProgress && !isProgressMinimized && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setIsProgressMinimized(true)} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 h-9 px-3 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 19l-7-7 7-7"/></svg>
              Retour aux campagnes
            </button>
            <span className="text-xs text-gray-400 hidden sm:block">La campagne continue en arrière-plan si vous quittez</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-10rem)]">
            <div className={`px-5 py-4 flex items-center justify-between text-white ${
              sendProgress.status === 'done' ? 'bg-green-600' :
              sendProgress.status === 'paused' ? 'bg-orange-500' :
              sendProgress.status === 'interrupted' || sendProgress.status === 'reconnecting' ? 'bg-gray-700' :
              'bg-gray-900'
            }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {sendProgress.status === 'sending' && <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse flex-shrink-0"></div>}
                  {sendProgress.status === 'done' && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
                  {sendProgress.status === 'paused' && <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>}
                  {(sendProgress.status === 'interrupted' || sendProgress.status === 'reconnecting') && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
                  <h3 className="font-semibold text-sm truncate">
                    {sendProgress.status === 'starting' ? 'Préparation...' :
                     sendProgress.status === 'sending' && sendProgress.batchPause ? `⏳ Pause anti-spam — reprise dans ${sendProgress.batchPause.remainingMin}min — ${sendProgress.campaignName}` :
                     sendProgress.status === 'sending' ? `Envoi ${sendProgress.currentIndex || 0}/${sendProgress.total || '?'} — ${sendProgress.campaignName}` :
                     sendProgress.status === 'done' ? `Campagne terminée — ${sendProgress.campaignName}` :
                     sendProgress.status === 'paused' ? `Campagne en pause — ${sendProgress.campaignName}` :
                     sendProgress.status === 'reconnecting' ? `Connexion perdue — ${sendProgress.campaignName}` :
                     `Campagne interrompue — ${sendProgress.campaignName}`}
                  </h3>
                </div>
                {sendProgress.instance && <p className="text-xs opacity-80 mt-0.5">Via : {sendProgress.instance}</p>}
              </div>
              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                {/* Minimize button — always visible while progress modal is open */}
                <button onClick={() => setIsProgressMinimized(true)} title="Réduire" className="p-1.5 hover:bg-white/20 rounded-lg transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/></svg>
                </button>
                {(['done', 'paused', 'interrupted'].includes(sendProgress.status)) && (
                  <button onClick={() => { setShowProgress(null); setSendProgress(null); setIsProgressMinimized(false); }} title="Fermer" className="p-1.5 hover:bg-white/20 rounded-lg transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
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
                    sendProgress.status === 'interrupted' ? 'bg-gray-500' :
                    'bg-gray-900'
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
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 sticky top-0 bg-white py-1.5">Journal</p>
              <div className="space-y-1">
                {(sendProgress.log || []).map((entry, i) =>
                  entry.type === 'substep' ? (
                    <div key={i} className={`flex items-center gap-2 py-1 px-2 pl-5 rounded text-[11px] ${
                      entry.status === 'sending' ? 'bg-gray-50 text-gray-700' :
                      entry.status === 'done' ? 'bg-green-50 text-green-700' :
                      'bg-red-50 text-red-600'
                    }`}>
                      <span className="font-medium">{entry.step === 'text' ? 'Texte' : 'Image'}</span>
                      <span className="text-gray-300 mx-0.5">—</span>
                      <span className="truncate flex-1 text-gray-500">{entry.name}</span>
                      <span className="flex-shrink-0 flex items-center gap-1">
                        {entry.status === 'sending' && <div className="w-2.5 h-2.5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"/>}
                        <span>{entry.status === 'sending' ? 'en cours...' : entry.status === 'done' ? 'envoyé' : (entry.error || 'échec')}</span>
                      </span>
                    </div>
                  ) : (
                  <div key={i} className={`flex items-start gap-2 py-1.5 px-2 rounded-lg text-xs ${
                    entry.status === 'sent' ? 'bg-green-50' :
                    entry.status === 'failed' ? 'bg-red-50' :
                    'bg-gray-50'
                  }`}>
                    <span className="text-gray-400 flex-shrink-0 font-mono w-10">#{entry.index || ''}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{entry.name}</span>
                      <span className="text-gray-300 mx-1">·</span>
                      <span className="text-gray-400 text-[10px]">{entry.phone}</span>
                    </div>
                    <span className={`text-xs flex-shrink-0 ${entry.status === 'sent' ? 'text-green-600' : entry.status === 'failed' ? 'text-red-500' : 'text-gray-400'}`}>{entry.reason}</span>
                  </div>
                  )
                )}
                {sendProgress.status === 'sending' && (
                  <div className={`flex items-center gap-2 py-2 px-2 rounded-lg text-xs ${sendProgress.batchPause ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-400'}`}>
                    <div className={`w-3 h-3 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0 ${sendProgress.batchPause ? 'border-orange-500' : 'border-gray-500'}`}/>
                    {sendProgress.batchPause
                      ? `Pause anti-spam — reprise dans ${sendProgress.batchPause.remainingMin} min (${sendProgress.batchPause.totalMin} min au total)`
                      : sendProgress.currentSubstep?.status === 'sending'
                        ? (sendProgress.currentSubstep.step === 'text' ? 'Envoi du texte...' : "Envoi de l'image...")
                        : 'Envoi en cours...'}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            {sendProgress.status === 'sending' && pausingCampaignId !== showProgress && (
              <div className="px-5 py-3 border-t border-gray-100">
                <button onClick={() => handlePause(showProgress)} className="w-full h-10 bg-orange-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Mettre en pause
                </button>
              </div>
            )}
            {sendProgress.status === 'sending' && pausingCampaignId === showProgress && (
              <div className="px-5 py-3 border-t border-gray-100 bg-orange-50 flex items-center justify-center gap-2 text-sm text-orange-700 font-medium">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/>
                Arrêt en cours après ce message...
              </div>
            )}
            {sendProgress.status === 'done' && (
              <div className="px-5 py-3 border-t border-gray-100 text-center text-sm text-green-700 font-medium">
                Campagne envoyée — {sendProgress.sent} message{sendProgress.sent > 1 ? 's' : ''} délivrés.
              </div>
            )}
            {sendProgress.status === 'paused' && (
              <div className="px-5 py-3 border-t border-gray-100 bg-orange-50 text-center text-sm text-orange-700 font-medium">
                Campagne en pause. Utilisez "Reprendre" pour continuer.
              </div>
            )}
            {sendProgress.status === 'reconnecting' && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-col gap-2">
                <p className="text-sm text-gray-700 font-medium">Connexion perdue — vérifiez le statut.</p>
                <div className="flex gap-2">
                  <button onClick={async () => { await fetchCampaigns(); setSendProgress(null); setShowProgress(null); }} className="flex-1 h-9 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors">Rafraîchir</button>
                  {showProgress && <button onClick={async () => { await handleForceReset(showProgress); setSendProgress(null); setShowProgress(null); }} className="flex-1 h-9 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors">Forcer l'arrêt</button>}
                  {showProgress && <button onClick={() => handleResume(showProgress)} className="flex-1 h-9 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors">Reprendre</button>}
                </div>
              </div>
            )}
            {sendProgress.status === 'interrupted' && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                <p className="text-sm text-gray-700 font-medium">Campagne interrompue.</p>
                {showProgress && <button onClick={() => handleResume(showProgress)} className="h-9 px-4 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0">Reprendre</button>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsList;
