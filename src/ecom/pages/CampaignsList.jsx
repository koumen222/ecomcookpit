import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const statusLabels = { draft: 'Brouillon', scheduled: 'Programmée', sending: 'En cours', sent: 'Envoyée', paused: 'Pause', failed: 'Échouée' };
const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
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
  
  // 🆕 États pour l'aperçu à une personne
  const [showPreview, setShowPreview] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [previewSending, setPreviewSending] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await ecomApi.get('/campaigns');
      setCampaigns(res.data.data.campaigns);
      setStats(res.data.data.stats);
    } catch { setError('Erreur chargement campagnes'); }
  };

  useEffect(() => { fetchCampaigns().finally(() => setLoading(false)); }, []);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

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
      // 🆕 Si personne n'est sélectionnée, envoyer à tout le monde
      // Trouver la campagne pour vérifier si elle est programmée
      const campaign = campaigns.find(c => c._id === id);
      const isScheduled = campaign?.status === 'scheduled';
      
      const confirmMessage = isScheduled 
        ? `Cette campagne est programmée. Envoyer maintenant annulera la programmation et enverra à tous les clients ciblés. Continuer ?`
        : 'Envoyer cette campagne maintenant ? Les messages WhatsApp seront envoyés à tous les clients ciblés.';
        
      if (!confirm(confirmMessage)) return;
      
      setSending(id);
      try {
        const res = await ecomApi.post(`/campaigns/${id}/send`, {}, { timeout: 300000 });
        setSuccess(res.data.message);
        fetchCampaigns(); // Rafraîchir pour voir le changement de statut
      } catch (err) { setError(err.response?.data?.message || 'Erreur envoi'); }
      finally { setSending(null); }
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
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
        <Link to="/campaigns/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nouvelle campagne
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {[
          { label: 'Brouillons', value: stats.draft || 0, color: 'text-gray-600', bg: 'bg-gray-50' },
          { label: 'Programmées', value: stats.scheduled || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
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
          <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
          </div>
          <p className="text-gray-500 text-sm mb-1">Aucune campagne</p>
          <p className="text-gray-400 text-xs mb-3">Créez votre première campagne de relance WhatsApp</p>
          <Link to="/campaigns/new" className="inline-block text-sm text-blue-600 hover:text-blue-700 font-medium">
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
                    <Link to={`/campaigns/${c._id}/edit`} className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate">{c.name}</Link>
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
                    {c.scheduledAt && <span className="text-blue-500">Programmée: {fmtDate(c.scheduledAt)}</span>}
                  </div>
                  {c.messageTemplate && (
                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 italic">"{c.messageTemplate.substring(0, 120)}{c.messageTemplate.length > 120 ? '...' : ''}"</p>
                  )}
                  {(c.tags || []).length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {c.tags.map(t => <span key={t} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">{t}</span>)}
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
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-medium disabled:opacity-50 flex items-center gap-1"
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
                  <Link to={`/campaigns/${c._id}/edit`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
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
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
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
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
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
    </div>
  );
};

export default CampaignsList;
