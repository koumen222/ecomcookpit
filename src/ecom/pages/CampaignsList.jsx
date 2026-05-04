import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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

// Couleurs par défaut pour les statuts de commandes personnalisés
const defaultOrderStatusColorMap = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  shipped: 'bg-emerald-50 text-emerald-800 border-emerald-100',
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
  relance_pending: 'bg-amber-50 text-amber-700 border-amber-200',
  relance_cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  promo: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  followup: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  custom: 'bg-slate-100 text-slate-700 border-slate-200'
};

const campaignToneMap = {
  draft: {
    accent: 'from-slate-400 to-slate-500',
    icon: 'bg-slate-100 text-slate-600',
    panel: 'border-slate-200 bg-slate-50/80',
    progress: 'from-slate-500 to-slate-600'
  },
  scheduled: {
    accent: 'from-emerald-400 to-emerald-500',
    icon: 'bg-emerald-100 text-emerald-700',
    panel: 'border-emerald-200 bg-emerald-50/70',
    progress: 'from-emerald-500 to-emerald-600'
  },
  sending: {
    accent: 'from-amber-400 to-orange-500',
    icon: 'bg-amber-100 text-amber-700',
    panel: 'border-amber-200 bg-amber-50/80',
    progress: 'from-amber-500 to-orange-500'
  },
  sent: {
    accent: 'from-green-400 to-green-500',
    icon: 'bg-green-100 text-green-700',
    panel: 'border-green-200 bg-green-50/80',
    progress: 'from-green-500 to-green-600'
  },
  paused: {
    accent: 'from-orange-400 to-orange-500',
    icon: 'bg-orange-100 text-orange-700',
    panel: 'border-orange-200 bg-orange-50/80',
    progress: 'from-orange-500 to-orange-600'
  },
  failed: {
    accent: 'from-red-400 to-red-500',
    icon: 'bg-red-100 text-red-700',
    panel: 'border-red-200 bg-red-50/80',
    progress: 'from-red-500 to-red-600'
  },
  interrupted: {
    accent: 'from-violet-400 to-violet-500',
    icon: 'bg-violet-100 text-violet-700',
    panel: 'border-violet-200 bg-violet-50/80',
    progress: 'from-violet-500 to-violet-600'
  }
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

const getCampaignTone = (status) => campaignToneMap[status] || campaignToneMap.draft;
const getTypeTone = (type) => typeToneClasses[type] || typeToneClasses.custom;
const compactMessage = (message, limit = 180) => {
  if (!message) return '';
  return message.length > limit ? `${message.slice(0, limit).trim()}...` : message;
};

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
      const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
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
      const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
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
      const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
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
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );

  const totalTargeted = campaigns.reduce((sum, campaign) => sum + (campaign.stats?.targeted || campaign.recipientSnapshotIds?.length || campaign.selectedClientIds?.length || 0), 0);
  const totalSentCount = campaigns.reduce((sum, campaign) => sum + (campaign.stats?.sent || 0), 0);
  const liveCount = campaigns.filter(campaign => campaign.status === 'sending').length;
  const pausedCount = campaigns.filter(campaign => campaign.status === 'paused').length;
  const summaryCards = [
    {
      label: 'Brouillons',
      value: stats.draft || 0,
      caption: 'Campagnes à finaliser',
      valueClassName: 'text-slate-700',
      chipClassName: 'bg-slate-100 text-slate-700 border-slate-200',
      accentClassName: 'from-slate-400 to-slate-500'
    },
    {
      label: 'Programmées',
      value: stats.scheduled || 0,
      caption: 'Déclenchement planifié',
      valueClassName: 'text-emerald-700',
      chipClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accentClassName: 'from-emerald-400 to-emerald-500'
    },
    {
      label: 'En cours',
      value: stats.sending || 0,
      caption: 'Diffusions actives',
      valueClassName: 'text-amber-700',
      chipClassName: 'bg-amber-50 text-amber-700 border-amber-200',
      accentClassName: 'from-amber-400 to-orange-500'
    },
    {
      label: 'Envoyées',
      value: stats.sent || 0,
      caption: 'Campagnes terminées',
      valueClassName: 'text-green-700',
      chipClassName: 'bg-green-50 text-green-700 border-green-200',
      accentClassName: 'from-green-400 to-green-500'
    }
  ];
  const statusFilterOptions = [
    { key: 'all', label: 'Toutes', count: campaigns.length },
    ...['draft', 'scheduled', 'sending', 'paused', 'sent', 'failed', 'interrupted'].map((status) => ({
      key: status,
      label: statusLabels[status] || status,
      count: campaigns.filter((campaign) => campaign.status === status).length
    }))
  ].filter((option) => option.key === 'all' || option.count > 0 || campaignStatusFilter === option.key);
  const filteredCampaigns = campaignStatusFilter === 'all'
    ? campaigns
    : campaigns.filter((campaign) => campaign.status === campaignStatusFilter);
  const activeFilterLabel = campaignStatusFilter === 'all'
    ? 'Toutes les campagnes'
    : statusLabels[campaignStatusFilter] || campaignStatusFilter;

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {success && <div className="mb-3 p-2.5 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200 flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>{success}</div>}
      {error && <div className="mb-3 p-2.5 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">{error}</div>}

      {!(showProgress && sendProgress && !isProgressMinimized) && (<>
      <div className="relative mb-5 overflow-hidden rounded-[30px] border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-100/60 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-emerald-50 via-white to-white" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Centre marketing
              </span>
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500">
                {stats.total || 0} campagne{(stats.total || 0) > 1 ? 's' : ''}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Marketing</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 sm:text-[15px]">
              Pilotez les relances, suivez les diffusions WhatsApp et repérez rapidement les campagnes à reprendre ou à optimiser.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {totalTargeted.toLocaleString('fr-FR')} ciblés
              </span>
              <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                {totalSentCount.toLocaleString('fr-FR')} envoyés
              </span>
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {liveCount} diffusion{liveCount > 1 ? 's' : ''} en cours
              </span>
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                {pausedCount} en pause
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap xl:w-auto xl:justify-end">
            <Link to="/ecom/campaigns/stats" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm shadow-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-50">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              Statistiques
            </Link>
            <Link to="/ecom/campaigns/new" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Nouvelle campagne
            </Link>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/80 p-4 shadow-sm">
              <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${card.accentClassName}`} />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{card.label}</p>
                  <p className={`mt-2 text-2xl font-bold sm:text-[30px] ${card.valueClassName}`}>{card.value}</p>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${card.chipClassName}`}>
                  {card.label}
                </span>
              </div>
              <p className="mt-3 text-xs text-gray-500">{card.caption}</p>
            </div>
          ))}
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-emerald-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
          </div>
          <p className="text-base font-semibold text-gray-800">Aucune campagne pour le moment</p>
          <p className="mt-2 text-sm text-gray-500">Créez votre première campagne de relance WhatsApp pour activer ce centre marketing.</p>
          <Link to="/ecom/campaigns/new" className="mt-5 inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
            Créer une campagne
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-gray-100 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Campagnes récentes</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">Suivi des diffusions</h2>
                <p className="mt-1 text-sm text-gray-500">Une vue plus lisible des brouillons, diffusions en cours et campagnes à relancer.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  {liveCount} en cours
                </span>
                <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  {pausedCount} en pause
                </span>
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500">
                  {filteredCampaigns.length} carte{filteredCampaigns.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-gray-100 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Filtrer la liste</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{activeFilterLabel}</p>
                <p className="mt-1 text-sm text-gray-500">Affiche seulement les campagnes du statut choisi.</p>
              </div>
              <div className="sm:hidden">
                <select
                  value={campaignStatusFilter}
                  onChange={(e) => setCampaignStatusFilter(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                >
                  {statusFilterOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label} ({option.count})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
              {statusFilterOptions.map((option) => {
                const isActive = campaignStatusFilter === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => setCampaignStatusFilter(option.key)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
                  >
                    <span>{option.label}</span>
                    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] ${isActive ? 'bg-white text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100 text-gray-400">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
              </div>
              <p className="text-base font-semibold text-gray-800">Aucune campagne dans ce segment</p>
              <p className="mt-2 text-sm text-gray-500">Changez le filtre pour revenir à une autre vue de vos campagnes.</p>
              <button onClick={() => setCampaignStatusFilter('all')} className="mt-5 inline-flex items-center justify-center rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                Voir toutes les campagnes
              </button>
            </div>
          ) : filteredCampaigns.map(c => {
            const targetedCount = c.stats?.targeted || c.recipientSnapshotIds?.length || c.selectedClientIds?.length || 0;
            const sentCount = c.stats?.sent || 0;
            const failedCount = c.stats?.failed || 0;
            const processedCount = sentCount + failedCount;
            const progressPercent = targetedCount > 0 ? Math.min(100, Math.round((processedCount / targetedCount) * 100)) : 0;
            const tone = getCampaignTone(c.status);

            return (
              <article key={c._id} className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className={`h-1.5 w-full bg-gradient-to-r ${tone.accent}`} />
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link to={`/ecom/campaigns/${c._id}/edit`} className="max-w-full break-words text-base font-semibold text-gray-900 transition hover:text-emerald-600 sm:text-lg">
                              {c.name}
                            </Link>
                            <Badge status={c.status} />
                            <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${getTypeTone(c.type)}`}>
                              {typeLabels[c.type] || c.type}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
                            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Ciblés</p>
                              <p className="mt-1 text-xl font-bold text-gray-900">{targetedCount}</p>
                            </div>
                            <div className="rounded-2xl border border-green-100 bg-green-50/80 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-500">Envoyés</p>
                              <p className="mt-1 text-xl font-bold text-green-700">{sentCount}</p>
                            </div>
                            <div className="rounded-2xl border border-red-100 bg-red-50/80 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-500">Échecs</p>
                              <p className="mt-1 text-xl font-bold text-red-600">{failedCount}</p>
                            </div>
                            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Créée</p>
                              <p className="mt-1 break-words text-sm font-semibold text-gray-900">{fmtDate(c.createdAt)}</p>
                            </div>
                          </div>

                          {c.messageTemplate && (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Aperçu message</p>
                                {c.scheduledAt && <span className="text-[11px] font-medium text-emerald-600">Programmée: {fmtDate(c.scheduledAt)}</span>}
                              </div>
                              <p className="mt-2 break-words text-sm leading-6 text-gray-600">"{compactMessage(c.messageTemplate)}"</p>
                            </div>
                          )}

                          {(c.tags || []).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {c.tags.map(t => <span key={t} className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{t}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 2xl:w-[280px] 2xl:flex-shrink-0">
                      <div className={`rounded-3xl border p-4 ${tone.panel}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Diffusion</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{progressPercent}% traité</p>
                          </div>
                          <span className="text-xs font-medium text-gray-500">{processedCount}/{targetedCount || 0}</span>
                        </div>
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/80">
                          <div className={`h-full rounded-full bg-gradient-to-r ${tone.progress}`} style={{ width: `${Math.max(progressPercent, targetedCount > 0 ? 8 : 0)}%` }} />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-2xl bg-white/70 px-3 py-2">
                            <p className="text-gray-400">Type</p>
                            <p className="mt-1 font-semibold text-gray-800">{typeLabels[c.type] || c.type}</p>
                          </div>
                          <div className="rounded-2xl bg-white/70 px-3 py-2">
                            <p className="text-gray-400">Statut</p>
                            <p className="mt-1 font-semibold text-gray-800">{statusLabels[c.status] || c.status}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 2xl:justify-end">
                        {(c.status === 'draft' || c.status === 'scheduled') && (
                          <>
                            <button onClick={() => handlePreview(c._id)} disabled={sending === c._id} className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                              Aperçu
                            </button>
                            <button onClick={() => handleSend(c._id)} disabled={sending === c._id} className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-green-600 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50">
                              {sending === c._id ? (<><div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div> Envoi...</>) : (<><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>{c.status === 'scheduled' ? 'Envoyer maintenant' : 'Envoyer'}</>)}
                            </button>
                          </>
                        )}

                        {c.status === 'sending' && (
                          <button onClick={() => handlePause(c._id)} disabled={pausingCampaignId === c._id} className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-orange-500 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60">
                            {pausingCampaignId === c._id ? (<><div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div> Arrêt...</>) : (<><svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</>)}
                          </button>
                        )}

                        {['paused', 'interrupted', 'failed'].includes(c.status) && (
                          <>
                            <button onClick={() => handleResume(c._id)} className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700">
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
                              Reprendre
                            </button>
                            <button onClick={() => handleRestart(c._id)} className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-gray-700 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-gray-800">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                              Relancer
                            </button>
                          </>
                        )}

                        {c.status === 'sent' && (
                          <>
                            <Link to={`/ecom/campaigns/${c._id}`} className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-emerald-100 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-200">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                              Activité
                            </Link>
                            <button onClick={() => handleRestart(c._id)} className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-gray-600 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-gray-700">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                              Relancer
                            </button>
                          </>
                        )}

                        {c.status !== 'sending' && (
                          <Link to={`/ecom/campaigns/${c._id}/edit`} className="inline-flex min-w-0 items-center justify-center rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                            Modifier
                          </Link>
                        )}

                        {isAdmin && c.status !== 'sending' && (
                          <button onClick={() => handleDelete(c._id, c.name)} className="inline-flex min-w-0 items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-100">
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      </>)}


      {/* 🆕 Modale d'aperçu */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm p-3 sm:p-4" onClick={closePreviewModal}>
          <div className="mx-auto flex max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-emerald-600 to-green-600 px-5 py-5 text-white sm:px-6">
              <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.18),_transparent_70%)]" />
              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">
                      Aperçu campagne
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                      {previewData.clients?.length || 0} cible{(previewData.clients?.length || 0) > 1 ? 's' : ''}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold sm:text-2xl">Tester avant diffusion</h3>
                  <p className="mt-2 max-w-2xl text-sm text-emerald-50/90">
                    Vérifiez le message, sélectionnez un destinataire précis puis envoyez un aperçu sans lancer toute la campagne.
                  </p>
                </div>
                <button
                  onClick={closePreviewModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/20"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 xl:grid-cols-[380px,minmax(0,1fr)]">
              <div className="max-h-[calc(90vh-120px)] overflow-y-auto border-b border-gray-100 bg-gray-50/80 p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <div className="space-y-4">
                  <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Message</p>
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                        {previewData.messageTemplate?.length || 0} caractères
                      </span>
                    </div>
                    <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{previewData.messageTemplate}</p>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Destinataire manuel</p>
                    <p className="mt-2 text-sm text-gray-500">Saisissez un numéro WhatsApp pour envoyer ce message à un contact précis hors de la liste.</p>
                    <div className="mt-4 grid gap-3">
                      <input
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Nom du destinataire"
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                      />
                      <input
                        type="text"
                        value={manualPhone}
                        onChange={(e) => {
                          setManualPhone(e.target.value);
                          setSelectedClient(null);
                        }}
                        placeholder="Numéro WhatsApp"
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                      />
                      <button
                        onClick={() => handleSend(showPreview)}
                        disabled={sending === showPreview || !manualPhone.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {sending === showPreview && manualPhone.trim() ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Envoi...
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                            </svg>
                            Envoyer à ce numéro
                          </>
                        )}
                      </button>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-green-200 bg-green-50 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green-600">Sélection active</p>
                        <p className="mt-2 break-words text-sm font-semibold text-green-900">
                          {manualPhone.trim()
                            ? `${manualName.trim() || 'Destinataire'} (${manualPhone.trim()})`
                            : selectedClient
                              ? `${selectedClient.firstName} ${selectedClient.lastName}`
                              : 'Aucun destinataire sélectionné'}
                        </p>
                        <p className="mt-1 text-xs text-green-700/80">
                          {manualPhone.trim()
                            ? 'Le message partira uniquement vers ce numéro.'
                            : selectedClient
                              ? 'Le message partira uniquement vers ce client ciblé.'
                              : 'Choisissez un client à droite ou saisissez un numéro manuel.'}
                        </p>
                      </div>
                      {(selectedClient || manualPhone.trim()) && (
                        <button
                          onClick={() => handleSend(showPreview)}
                          disabled={sending === showPreview}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                        >
                          {sending === showPreview ? (
                            <>
                              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                              Envoi...
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                              </svg>
                              Envoyer
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              <div className="min-h-0 bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Clients ciblés</p>
                    <h4 className="mt-1 text-lg font-bold text-gray-900">Choisir un destinataire</h4>
                    <p className="mt-1 text-sm text-gray-500">Cliquez sur une carte pour la sélectionner, ou utilisez “Aperçu test” pour un envoi rapide.</p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
                    {previewData.clients?.length || 0} profil{(previewData.clients?.length || 0) > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="mt-4 max-h-[calc(90vh-220px)] space-y-3 overflow-y-auto pr-1">
                  {previewData.clients?.map(client => {
                    const isSelected = selectedClient?._id === client._id && !manualPhone.trim();

                    return (
                      <div
                        key={client._id}
                        className={`rounded-3xl border p-4 transition ${isSelected ? 'border-green-200 bg-green-50/80 shadow-sm' : 'border-gray-100 bg-gray-50/70 hover:border-emerald-200 hover:bg-emerald-50/40'}`}
                        onClick={() => {
                          setSelectedClient(client);
                          setManualPhone('');
                        }}
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="max-w-full break-words text-sm font-semibold text-gray-900">{client.firstName} {client.lastName}</p>
                              {isSelected && (
                                <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700">
                                  Sélectionné
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-700">{client.phone}</span>
                              {client.city && <span>{client.city}</span>}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClient(client);
                                setManualPhone('');
                              }}
                              className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold transition ${isSelected ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'}`}
                            >
                              {isSelected ? 'Choisi' : 'Sélectionner'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewSend(client);
                              }}
                              disabled={previewSending}
                              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                            >
                              {previewSending ? (
                                <>
                                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                  </svg>
                                  Envoi...
                                </>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                  </svg>
                                  Aperçu test
                                </>
                              )}
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


      {/* Modal sélection instance WhatsApp */}
      {showInstanceSelector && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setShowInstanceSelector(false); setPendingCampaignId(null); }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header vert WhatsApp */}
            <div className="relative px-6 py-5 bg-gradient-to-br from-emerald-500 to-green-600 text-white">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold leading-tight">Envoyer la campagne</h2>
                  <p className="text-xs text-emerald-50/90 mt-0.5">Choisissez l'instance WhatsApp à utiliser</p>
                </div>
                <button
                  onClick={() => { setShowInstanceSelector(false); setPendingCampaignId(null); }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition flex-shrink-0"
                  aria-label="Fermer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {instances.length > 0 ? `${instances.length} instance${instances.length > 1 ? 's' : ''} disponible${instances.length > 1 ? 's' : ''}` : 'Instances'}
                </p>
                <button
                  onClick={refreshInstancesStatus}
                  disabled={loadingInstances}
                  className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-40"
                >
                  <svg className={`w-3.5 h-3.5 ${loadingInstances ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Actualiser
                </button>
              </div>

              {loadingInstances && instances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
                  <p className="text-xs text-gray-500">Chargement des instances…</p>
                </div>
              ) : instances.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700">Aucune instance configurée</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Connectez WhatsApp pour envoyer vos campagnes</p>
                  <a href="/ecom/whatsapp/service" className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium transition">
                    Configurer WhatsApp
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {instances.map(instance => {
                    const isReady = instance.status === 'connected' || instance.status === 'active';
                    return (
                      <button
                        key={instance._id}
                        onClick={() => isReady && handleInstanceSelected(instance)}
                        disabled={!isReady}
                        className={`group w-full p-3.5 rounded-xl border-2 text-left transition-all ${
                          isReady
                            ? 'border-gray-100 hover:border-emerald-400 hover:bg-emerald-50/60 hover:shadow-sm cursor-pointer'
                            : 'border-gray-100 bg-gray-50/50 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isReady ? 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-gray-100 text-gray-400'} transition-colors`}>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{instance.customName || instance.instanceName}</p>
                            <p className="text-[11px] text-gray-400 font-mono truncate">{instance.instanceName}</p>
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              isReady ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></span>
                              {isReady ? 'Connecté' : 'Déconnecté'}
                            </span>
                            {isReady && (
                              <svg className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Vous pouvez mettre en pause à tout moment
              </p>
              <button
                onClick={() => { setShowInstanceSelector(false); setPendingCampaignId(null); }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL PROGRESSION EN TEMPS RÉEL — MINIMISÉE ═══ */}
      {showProgress && sendProgress && isProgressMinimized && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl cursor-pointer text-white max-w-xs w-full ${
            sendProgress.status === 'done' ? 'bg-green-600' :
            sendProgress.status === 'paused' ? 'bg-orange-500' :
            sendProgress.status === 'interrupted' ? 'bg-purple-600' :
            sendProgress.status === 'reconnecting' ? 'bg-yellow-600' :
            'bg-emerald-600'
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

      {/* ═══ PAGE DE PROGRESSION — EN LIGNE, NON BLOQUANT ═══ */}
      {showProgress && sendProgress && !isProgressMinimized && (
        <div className="mb-4">
          {/* Barre de retour */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setIsProgressMinimized(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              Retour aux campagnes
            </button>
            <span className="text-[11px] text-gray-400 hidden sm:block">La campagne continue en arrière-plan si vous quittez</span>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-10rem)]">
            {/* Header */}
            <div className={`px-5 py-4 flex items-center justify-between ${
              sendProgress.status === 'done' ? 'bg-green-600' :
              sendProgress.status === 'paused' ? 'bg-orange-500' :
              sendProgress.status === 'interrupted' ? 'bg-purple-600' :
              sendProgress.status === 'reconnecting' ? 'bg-yellow-600' :
              'bg-emerald-600'
            } text-white`}>
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
                {(sendProgress.log || []).map((entry, i) =>
                  entry.type === 'substep' ? (
                    <div key={i} className={`flex items-center gap-2 py-1 px-2 pl-5 rounded text-[11px] ${
                      entry.status === 'sending' ? 'bg-blue-50 text-blue-700' :
                      entry.status === 'done' ? 'bg-green-50 text-green-700' :
                      'bg-red-50 text-red-600'
                    }`}>
                      <span className="flex-shrink-0">{entry.step === 'text' ? '💬' : '🖼️'}</span>
                      <span className="font-medium">{entry.step === 'text' ? 'Texte' : 'Image'}</span>
                      <span className="text-gray-400 mx-0.5">—</span>
                      <span className="truncate flex-1 text-gray-500">{entry.name}</span>
                      <span className="flex-shrink-0 flex items-center gap-1">
                        {entry.status === 'sending' && <div className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                        {entry.status === 'done' && '✅'}
                        {entry.status === 'failed' && '❌'}
                        <span>{entry.status === 'sending' ? 'en cours...' : entry.status === 'done' ? 'envoyé' : (entry.error || 'échec')}</span>
                      </span>
                    </div>
                  ) : (
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
                  )
                )}
                {sendProgress.status === 'sending' && (
                  <div className={`flex items-center gap-2 py-2 px-2 rounded-lg text-xs ${sendProgress.batchPause ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-400'}`}>
                    <div className={`w-3 h-3 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0 ${sendProgress.batchPause ? 'border-orange-500' : 'border-emerald-400'}`}></div>
                    {sendProgress.batchPause
                      ? `⏳ Pause anti-spam — reprise dans ${sendProgress.batchPause.remainingMin} min... (${sendProgress.batchPause.totalMin} min au total)`
                      : sendProgress.currentSubstep?.status === 'sending'
                        ? (sendProgress.currentSubstep.step === 'text' ? '💬 Envoi du texte en cours...' : '🖼️ Envoi de l\'image en cours...')
                        : 'Envoi en cours...'}
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions - Pause uniquement si en cours d'envoi */}
            {sendProgress.status === 'sending' && pausingCampaignId !== showProgress && (
              <div className="px-5 py-3 border-t bg-gray-50">
                <button onClick={() => handlePause(showProgress)} className="w-full py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition text-sm font-medium flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Mettre en pause
                </button>
              </div>
            )}
            {sendProgress.status === 'sending' && pausingCampaignId === showProgress && (
              <div className="px-5 py-3 border-t bg-orange-50">
                <div className="flex items-center justify-center gap-2 text-sm text-orange-700 font-medium">
                  <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                  Arrêt en cours après ce message...
                </div>
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
            {sendProgress.status === 'reconnecting' && (
              <div className="px-5 py-3 border-t bg-blue-50 flex items-center justify-between gap-3">
                <span className="text-sm text-blue-800 font-medium">
                  🔄 Connexion perdue — la campagne continue en arrière-plan.
                </span>
                <button
                  onClick={() => { fetchCampaigns(); setSendProgress(null); setShowProgress(null); }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex-shrink-0"
                >
                  Rafraîchir
                </button>
              </div>
            )}
            {sendProgress.status === 'interrupted' && (
              <div className="px-5 py-3 border-t bg-yellow-50 flex items-center justify-between gap-3">
                <span className="text-sm text-yellow-800 font-medium">
                  ⚡ Campagne interrompue.
                </span>
                {showProgress && (
                  <button
                    onClick={() => handleResume(showProgress)}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold rounded-lg transition flex-shrink-0"
                  >
                    ▶ Reprendre
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsList;
