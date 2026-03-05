import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { getCache, setCache } from '../utils/cacheUtils.js';
import WhatsAppConfigModal from '../components/WhatsAppConfigModal.jsx';

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

const statusLabels = { draft: 'Brouillon', scheduled: 'Programmée', sending: 'En cours', sent: 'Envoyée', paused: 'Pause', failed: 'Échouée' };
const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-emerald-100 text-emerald-700',
  sending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-green-100 text-green-700',
  paused: 'bg-orange-100 text-orange-700',
  failed: 'bg-red-100 text-red-700'
};
const typeLabels = { relance_pending: 'Relance en attente', relance_cancelled: 'Relance annulés', promo: 'Promotion', followup: 'Suivi livraison', custom: 'Personnalisée' };

const CampaignsList = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney(); // 🆕 Hook pour formater les montants
  const isAdmin = user?.role === 'ecom_admin';
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sending, setSending] = useState(null);
  
  // États config WhatsApp
  const [waConfig, setWaConfig] = useState(null);
  const [showWhatsAppConfig, setShowWhatsAppConfig] = useState(false);

  // États pour sélection service WhatsApp avant envoi
  const [showServiceSelector, setShowServiceSelector] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [whatsappInstances, setWhatsappInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);

  // 🆕 États pour l'aperçu à une personne
  const [showPreview, setShowPreview] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [previewSending, setPreviewSending] = useState(false);

  const fetchCampaigns = async (useCache = true) => {
    try {
      // Charger depuis le cache si disponible
      if (useCache) {
        const cached = getCache('campaigns_list');
        if (cached) {
          setCampaigns(cached.campaigns);
          setStats(cached.stats);
          setLoading(false);
          return;
        }
      }

      const res = await ecomApi.get('/campaigns');
      setCampaigns(res.data.data.campaigns);
      setStats(res.data.data.stats);
      
      // Sauvegarder dans le cache
      setCache('campaigns_list', { campaigns: res.data.data.campaigns, stats: res.data.data.stats });
    } catch { setError('Erreur chargement campagnes'); }
  };

  useEffect(() => { fetchCampaigns().finally(() => setLoading(false)); }, []);

  // Charger la configuration WhatsApp
  const loadWhatsAppConfig = async () => {
    try {
      const response = await ecomApi.get('/whatsapp-config');
      if (response.data.success) {
        setWaConfig(response.data.config);
      } else {
        setWaConfig({ isConfigured: false, status: 'inactive' });
      }
    } catch (err) {
      setWaConfig({ isConfigured: false, status: 'inactive' });
    }
  };

  useEffect(() => {
    loadWhatsAppConfig();
    loadWhatsAppInstances();
  }, []);

  // Charger les instances WhatsApp sauvegardées
  const loadWhatsAppInstances = async () => {
    try {
      setLoadingInstances(true);
      const response = await ecomApi.get('/whatsapp-instances');
      if (response.data.success) {
        setWhatsappInstances(response.data.instances);
      }
    } catch (err) {
      console.error('Erreur chargement instances WhatsApp:', err);
    } finally {
      setLoadingInstances(false);
    }
  };

  // Gérer la configuration WhatsApp sauvegardée
  const handleWhatsAppConfigSaved = () => {
    setShowWhatsAppConfig(false);
    loadWhatsAppConfig(); // Recharger la config
    loadWhatsAppInstances(); // Recharger les instances
    setSuccess('Instance WhatsApp ajoutée avec succès !');
  };

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  if (loading) {
    return <IconFillLoader />;
  }


  const handleSend = async (id) => {
    // 🆕 Si une personne est sélectionnée, envoyer seulement à cette personne
    if (selectedClient && showPreview === id) {
      if (!confirm(`Envoyer le message uniquement à ${selectedClient.firstName} ${selectedClient.lastName} ?`)) return;
      
      setSending(id);
      try {
        const response = await ecomApi.post('/campaigns/preview-send', {
          messageTemplate: previewData.messageTemplate,
          clientId: selectedClient._id
        });
        
        if (response.data.success) {
          setSuccess(`Message envoyé à ${selectedClient.firstName} ${selectedClient.lastName} !`);
          // Fermer la modale après envoi réussi
          setShowPreview(null);
          setSelectedClient(null);
        } else {
          setError(response.data.message);
        }
      } catch (err) { 
        setError(err.response?.data?.message || 'Erreur envoi'); 
      } finally { 
        setSending(null); 
      }
    } else {
      // Afficher le modal de sélection de service WhatsApp
      setPendingCampaignId(id);
      setShowServiceSelector(true);
    }
  };

  const handleConfirmSend = async () => {
    if (!selectedInstanceId) {
      setError('Veuillez sélectionner une instance WhatsApp');
      return;
    }

    const campaign = campaigns.find(c => c._id === pendingCampaignId);
    const isScheduled = campaign?.status === 'scheduled';
    
    const confirmMessage = isScheduled 
      ? `Cette campagne est programmée. Envoyer maintenant annulera la programmation et enverra à tous les clients ciblés. Continuer ?`
      : 'Envoyer cette campagne maintenant ? Les messages WhatsApp seront envoyés à tous les clients ciblés.';
      
    if (!confirm(confirmMessage)) return;
    
    setSending(pendingCampaignId);
    setShowServiceSelector(false);
    
    try {
      const res = await ecomApi.post(`/campaigns/${pendingCampaignId}/send`, {
        whatsappInstanceId: selectedInstanceId
      }, { timeout: 300000 });
      setSuccess(res.data.message);
      fetchCampaigns(); // Rafraîchir pour voir le changement de statut
    } catch (err) { 
      setError(err.response?.data?.message || 'Erreur envoi'); 
    } finally { 
      setSending(null); 
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer la campagne "${name}" ?`)) return;
    try {
      await ecomApi.delete(`/campaigns/${id}`);
      setSuccess('Campagne supprimée');
      fetchCampaigns();
    } catch { setError('Erreur suppression'); }
  };

  // 🆕 Fonction pour charger l'aperçu d'une campagne
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

  // 🆕 Fonction pour envoyer un aperçu à une personne spécifique
  const handlePreviewSend = async (client) => {
    if (!showPreview || !previewData) return;
    
    // 🆕 Sélectionner cette personne
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

      {/* Bannière Configuration WhatsApp */}
      {waConfig && !waConfig.isConfigured && (
        <div className="mb-6 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <h2 className="text-2xl font-bold">🚀 Configurez votre WhatsApp</h2>
                </div>
                <p className="text-white/90 text-sm mb-3 max-w-2xl">
                  <strong>Connectez votre WhatsApp</strong> avec ZeChat. Messages envoyés depuis votre numéro pour plus de confiance.
                </p>
                <div className="flex gap-2 mb-3">
                  <span className="text-xs bg-white/20 px-2 py-1 rounded">⚡ 1 min</span>
                  <span className="text-xs bg-white/20 px-2 py-1 rounded">📈 +40% réponse</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => setShowWhatsAppConfig(true)}
                    className="px-4 py-2 bg-white text-green-600 font-semibold rounded-lg hover:bg-gray-100 transition text-sm"
                  >
                    Configurer ZeChat
                  </button>
                  <a 
                    href="https://servicewhstapps.pages.dev/docs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white/20 text-white font-medium rounded-lg hover:bg-white/30 transition border border-white/30 text-sm"
                  >
Voir la documentation                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


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
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[c.status]}`}>{statusLabels[c.status]}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{typeLabels[c.type] || c.type}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
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
                      {/* 🆕 Bouton Aperçu */}
                      <button 
                        onClick={() => handlePreview(c._id)} 
                        disabled={sending === c._id}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        Aperçu
                      </button>
                      
                      {/* Bouton Envoyer (existant) */}
                      <button onClick={() => handleSend(c._id)} disabled={sending === c._id}
                        className={`px-3 py-1.5 rounded-lg transition text-xs font-medium disabled:opacity-50 flex items-center gap-1 ${
                          c.status === 'scheduled' 
                            ? 'bg-orange-600 text-white hover:bg-orange-700' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {sending === c._id ? (
                          <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Envoi...</>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                            {c.status === 'scheduled' ? 'Envoyer maintenant' : 'Envoyer'}
                          </>
                        )}
                      </button>
                    </>
                  )}
                  {c.status === 'sent' && (
                    <Link to={`/ecom/campaigns/${c._id}`} className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition text-xs font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                      </svg>
                      Activité
                    </Link>
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

      {/* Modal Sélection Instance WhatsApp */}
      {showServiceSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Sélectionner une instance WhatsApp</h2>
              <p className="text-sm text-gray-600 mb-4">
                Choisissez l'instance WhatsApp à utiliser pour cette campagne
              </p>
              
              <div className="space-y-4">
                {loadingInstances ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Chargement...</p>
                  </div>
                ) : whatsappInstances.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      Aucune instance WhatsApp configurée. Veuillez d'abord ajouter une instance.
                    </p>
                    <button
                      onClick={() => {
                        setShowServiceSelector(false);
                        setShowWhatsAppConfig(true);
                      }}
                      className="mt-3 w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm"
                    >
                      Ajouter une instance
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Instance WhatsApp
                      </label>
                      <select
                        value={selectedInstanceId}
                        onChange={(e) => setSelectedInstanceId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">-- Sélectionner une instance --</option>
                        {whatsappInstances.map((instance) => (
                          <option key={instance._id} value={instance._id}>
                            {instance.name} ({instance.instanceId}) - {instance.status === 'active' ? '✓ Active' : '✗ Inactive'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-700">
                        💡 Gérez vos instances dans{' '}
                        <button 
                          onClick={() => {
                            setShowServiceSelector(false);
                            setShowWhatsAppConfig(true);
                          }}
                          className="underline font-semibold"
                        >
                          la configuration
                        </button>
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowServiceSelector(false);
                    setPendingCampaignId(null);
                    setSelectedInstanceId('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmSend}
                  disabled={!selectedInstanceId || whatsappInstances.length === 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Envoyer la campagne
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuration WhatsApp */}
      {showWhatsAppConfig && (
        <WhatsAppConfigModal
          onClose={() => setShowWhatsAppConfig(false)}
          onConfigSaved={handleWhatsAppConfigSaved}
        />
      )}
    </div>
  );
};

export default CampaignsList;
