import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';

const CampaignForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [waStatus, setWaStatus] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'custom',
    messageTemplate: '',
    targetFilters: { clientStatus: [], city: [], product: [], tag: '', minOrders: 0, maxOrders: 0, orderStatus: [], orderCity: [], orderAddress: '', orderProduct: [], orderDateFrom: '', orderDateTo: '', orderSourceId: '', orderMinPrice: 0, orderMaxPrice: 0 },
    scheduledAt: '',
    tags: ''
  });
  const [templates, setTemplates] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [showPhoneList, setShowPhoneList] = useState(false);
  const [copied, setCopied] = useState(false);
  // 🆕 États pour les fonctionnalités anti-spam
  const [spamAnalysis, setSpamAnalysis] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [previewSending, setPreviewSending] = useState(false);
  const [previewClient, setPreviewClient] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ cities: [], products: [], addresses: [] });

  useEffect(() => {
    if (!isEdit) {
      ecomApi.get('/workspaces/whatsapp-config')
        .then(res => setWaStatus(res.data.data?.whatsappConfig?.status || 'none'))
        .catch(() => setWaStatus('none'));
    }
  }, [isEdit]);

  useEffect(() => {
    ecomApi.get('/campaigns/templates').then(res => setTemplates(res.data.data)).catch(() => {});
    ecomApi.get('/campaigns/filter-options').then(res => setFilterOptions(res.data.data)).catch(() => {});
    if (isEdit) {
      ecomApi.get(`/campaigns/${id}`).then(res => {
        const c = res.data.data;
        setFormData({
          name: c.name || '',
          type: c.type || 'custom',
          messageTemplate: c.messageTemplate || '',
          targetFilters: { clientStatus: '', city: '', product: '', tag: '', minOrders: 0, maxOrders: 0, orderStatus: '', orderCity: '', orderAddress: '', orderProduct: '', orderDateFrom: '', orderDateTo: '', orderSourceId: '', orderMinPrice: 0, orderMaxPrice: 0, ...(c.targetFilters || {}) },
          scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString().slice(0, 16) : '',
          tags: (c.tags || []).join(', ')
        });
      }).catch(() => setError('Campagne introuvable')).finally(() => setFetchLoading(false));
    }
  }, [id, isEdit]);

  const hasAnyFilter = (filters) => {
    const tf = filters || formData.targetFilters;
    return (
      (tf.orderStatus || []).length > 0 ||
      (tf.orderCity || []).length > 0 ||
      (tf.orderProduct || []).length > 0 ||
      !!tf.orderDateFrom ||
      !!tf.orderDateTo ||
      (tf.orderMinPrice > 0) ||
      (tf.orderMaxPrice > 0)
    );
  };

  const handlePreview = async () => {
    if (!hasAnyFilter()) {
      setPreview({ count: 0, clients: [], hint: 'Sélectionnez au moins un filtre' });
      setSelectedClients(new Set());
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await ecomApi.post('/campaigns/preview', { targetFilters: formData.targetFilters });
      setPreview(res.data.data);
      // Sélectionner tous par défaut
      setSelectedClients(new Set(res.data.data.clients.map(c => c._id)));
    } catch { setError('Erreur prévisualisation'); }
    finally { setPreviewLoading(false); }
  };

  const toggleClient = (id) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectSingleClient = (clientId) => {
    setSelectedClients(new Set([clientId]));
  };

  const selectAllClients = () => {
    if (!preview) return;
    setSelectedClients(new Set(preview.clients.map(c => c._id)));
  };

  const deselectAllClients = () => {
    setSelectedClients(new Set());
  };

  const toggleAllClients = () => {
    if (!preview) return;
    if (selectedClients.size === preview.clients.length) {
      deselectAllClients();
    } else {
      selectAllClients();
    }
  };

  const getSelectedPhones = () => {
    if (!preview) return [];
    return preview.clients.filter(c => selectedClients.has(c._id)).map(c => c.phone).filter(Boolean);
  };

  const copyPhones = () => {
    const phones = getSelectedPhones().join('\n');
    navigator.clipboard.writeText(phones).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // Toggle un item dans un filtre array
  const toggleArrayFilter = (key, value) => {
    setFormData(prev => {
      const cur = prev.targetFilters[key] || [];
      const arr = Array.isArray(cur) ? cur : [cur].filter(Boolean);
      const next = arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];
      return { ...prev, targetFilters: { ...prev.targetFilters, [key]: next } };
    });
  };

  const quickFilter = (status) => {
    setFormData(prev => {
      const cur = prev.targetFilters.orderStatus || [];
      const arr = Array.isArray(cur) ? cur : [cur].filter(Boolean);
      const next = arr.includes(status) ? arr.filter(x => x !== status) : [...arr, status];
      return { ...prev, targetFilters: { ...prev.targetFilters, orderStatus: next } };
    });
    setTimeout(() => handlePreview(), 200);
  };

  const resetFilters = () => {
    setFormData(prev => ({
      ...prev,
      targetFilters: { 
        clientStatus: [], 
        city: [], 
        product: [], 
        tag: '', 
        minOrders: 0, 
        maxOrders: 0, 
        orderStatus: [], 
        orderCity: [], 
        orderAddress: '', 
        orderProduct: [], 
        orderDateFrom: '', 
        orderDateTo: '', 
        orderSourceId: '', 
        orderMinPrice: 0, 
        orderMaxPrice: 0 
      }
    }));
    setTimeout(() => handlePreview(), 200);
  };

  const applyTemplate = (tpl) => {
    setFormData(prev => ({
      ...prev,
      name: prev.name || tpl.name,
      type: tpl.type || 'custom',
      messageTemplate: tpl.message,
      targetFilters: { ...prev.targetFilters, ...tpl.targetFilters }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!formData.name.trim() || !formData.messageTemplate.trim()) {
      setError('Nom et message requis');
      setLoading(false);
      return;
    }
    try {
      const payload = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        scheduledAt: formData.scheduledAt || null,
        // Envoyer les clients sélectionnés manuellement
        selectedClientIds: selectedClients.size > 0 ? Array.from(selectedClients) : []
      };
      if (isEdit) {
        await ecomApi.put(`/campaigns/${id}`, payload);
      } else {
        await ecomApi.post('/campaigns', payload);
      }
      navigate('/ecom/campaigns');
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Erreur enregistrement';
      
      // 🆕 Gérer les erreurs anti-spam spécifiques
      if (err.response?.data?.spamAnalysis) {
        setError(`Message rejeté pour risque de spam: ${errorMsg}`);
        setSpamAnalysis(err.response.data.spamAnalysis);
      } else {
        setError(errorMsg);
      }
    } finally { setLoading(false); }
  };

  // 🆕 Fonction pour tester un message
  const handleTestMessage = async () => {
    if (!formData.messageTemplate.trim()) {
      setError('Message requis pour le test');
      return;
    }
    
    try {
      // Utiliser le premier client du preview comme test
      const testClient = preview?.clients?.[0] || {
        firstName: 'Aminata',
        lastName: 'Koné',
        phone: '+225 07 00 00 00',
        city: 'Abidjan',
        totalOrders: 3,
        totalSpent: 45000
      };
      
      const response = await ecomApi.post('/campaigns/test-message', {
        messageTemplate: formData.messageTemplate,
        clientData: testClient
      });
      
      setTestResult(response.data);
      setSpamAnalysis(response.data.analysis);
      
    } catch (error) {
      setError('Erreur lors du test du message');
      console.error('Test message error:', error);
    }
  };

  // 🆕 Fonction pour envoyer un aperçu à une personne spécifique
  const handlePreviewSend = async (client) => {
    if (!formData.messageTemplate.trim()) {
      setError('Message requis pour l\'aperçu');
      return;
    }
    
    setPreviewSending(true);
    setPreviewClient(client._id);
    
    try {
      const response = await ecomApi.post('/campaigns/preview-send', {
        messageTemplate: formData.messageTemplate,
        clientId: client._id
      });
      
      if (response.data.success) {
        setSuccess(`Message d'aperçu envoyé à ${client.firstName} ${client.lastName} !`);
      } else {
        setError(response.data.message);
      }
      
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Erreur envoi aperçu';
      
      // Gérer les erreurs anti-spam
      if (error.response?.data?.analysis) {
        setError(`Message rejeté: ${errorMsg}`);
        setSpamAnalysis(error.response.data.analysis);
      } else {
        setError(errorMsg);
      }
    } finally {
      setPreviewSending(false);
      setPreviewClient(null);
    }
  };

  const updateFilter = (key, value) => {
    setFormData(prev => ({ ...prev, targetFilters: { ...prev.targetFilters, [key]: value } }));
  };

  // 🆕 Fonction simple d'analyse anti-spam côté client
  const analyzeSpamRisk = (message) => {
    if (!message || typeof message !== 'string') {
      return { score: 0, risk: 'LOW', warnings: [], recommendations: [] };
    }

    let riskScore = 0;
    const warnings = [];
    const recommendations = [];
    
    // Mots déclencheurs de spam
    const spamTriggers = [
      'GRATUIT', 'PROMOTION', 'OFFRE SPÉCIALE',
      'CLIQUEZ ICI', 'URGENT', 'LIMITÉ',
      'ACHETEZ MAINTENANT', '100% GRATUIT',
      'GAGNEZ', 'CONCOURS', 'BONUS',
      'ARGENT RAPIDE', 'DEVENEZ RICHE',
      'MULTI-LEVEL', 'MARKETING',
      'LIEN SPONSORISÉ', 'PUBLICITÉ'
    ];
    
    // Vérifier les mots déclencheurs
    spamTriggers.forEach(trigger => {
      if (message.toUpperCase().includes(trigger)) {
        riskScore += 10;
        warnings.push(`Mot déclencheur: ${trigger}`);
      }
    });
    
    // Vérifier les formats problématiques
    if (message === message.toUpperCase() && message.length > 20) {
      riskScore += 5;
      warnings.push('Message entièrement en majuscules');
      recommendations.push('✍️ Utiliser une casse normale (mixte)');
    }
    
    if ((message.match(/!/g) || []).length > 2) {
      riskScore += 5;
      warnings.push('Trop de points d\'exclamation');
      recommendations.push('📝 Limiter à 1-2 points d\'exclamation maximum');
    }
    
    if ((message.match(/\?/g) || []).length > 2) {
      riskScore += 3;
      warnings.push('Trop de points d\'interrogation');
    }
    
    // Vérifier les caractères répétitifs
    if (message.match(/(.)\1{3,}/)) {
      riskScore += 5;
      warnings.push('Caractères répétitifs détectés');
    }
    
    // Vérifier la longueur
    if (message.length > 500) {
      riskScore += 3;
      warnings.push('Message trop long (>500 caractères)');
      recommendations.push('✂️ Raccourcir le message (<300 caractères idéalement)');
    }
    
    if (message.length < 15) {
      riskScore += 2;
      warnings.push('Message très court (<15 caractères)');
    }
    
    // Vérifier les liens multiples
    const linkCount = (message.match(/https?:\/\//g) || []).length;
    if (linkCount > 1) {
      riskScore += 8;
      warnings.push('Multiples liens détectés');
    }
    
    // Recommandations générales
    if (riskScore > 15) {
      recommendations.push('⚠️ Message à haut risque - Réécrire complètement');
    } else if (riskScore > 8) {
      recommendations.push('🔥 Message à risque moyen - Modifier avant envoi');
    }
    
    return {
      score: riskScore,
      risk: riskScore > 15 ? 'HIGH' : riskScore > 8 ? 'MEDIUM' : 'LOW',
      warnings,
      recommendations
    };
  };

  const renderPreviewMessage = () => {
    if (!formData.messageTemplate) return '';
    return formData.messageTemplate
      .replace(/\{firstName\}/g, 'Aminata')
      .replace(/\{lastName\}/g, 'Koné')
      .replace(/\{fullName\}/g, 'Aminata Koné')
      .replace(/\{phone\}/g, '+225 07 00 00 00')
      .replace(/\{city\}/g, 'Abidjan')
      .replace(/\{product\}/g, 'Crème visage')
      .replace(/\{totalOrders\}/g, '3')
      .replace(/\{totalSpent\}/g, '45000')
      .replace(/\{price\}/g, '15000')
      .replace(/\{orderDate\}/g, '11/02/2026')
      .replace(/\{status\}/g, 'En attente')
      .replace(/\{lastContact\}/g, '05/02/2026');
  };

  const variables = [
    { var: '{firstName}', label: 'Prénom' },
    { var: '{lastName}', label: 'Nom' },
    { var: '{fullName}', label: 'Nom complet' },
    { var: '{phone}', label: 'Téléphone' },
    { var: '{city}', label: 'Ville' },
    { var: '{product}', label: 'Produits' },
    { var: '{totalOrders}', label: 'Nb commandes' },
    { var: '{totalSpent}', label: 'Total dépensé' },
    { var: '{price}', label: 'Prix' },
    { var: '{orderDate}', label: 'Date commande' },
    { var: '{status}', label: 'Statut' },
    { var: '{lastContact}', label: 'Dernier contact' }
  ];

  const insertVariable = (v) => {
    setFormData(prev => ({ ...prev, messageTemplate: prev.messageTemplate + v }));
  };

  if (fetchLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );

  if (!isEdit && waStatus === 'pending') return (
    <div className="p-6 max-w-lg mx-auto mt-12">
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-amber-800 mb-2">Création de campagne bloquée</h2>
        <p className="text-sm text-amber-700 mb-1">Votre postulation WhatsApp est <strong>en attente d'approbation</strong>.</p>
        <p className="text-sm text-amber-600 mb-6">Vous pourrez créer des campagnes une fois que votre numéro WhatsApp aura été approuvé par l'équipe (délai : 24-48h).</p>
        <Link to="/ecom/campaigns" className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Retour au Marketing
        </Link>
      </div>
    </div>
  );

  const inputClass = "block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{isEdit ? 'Modifier la campagne' : 'Nouvelle campagne'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Créez une campagne de relance WhatsApp personnalisée</p>
        </div>
        <button onClick={() => navigate('/ecom/campaigns')} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">Annuler</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

        {/* Templates rapides */}
        {!isEdit && templates.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-emerald-50 rounded-xl p-4 border border-emerald-100">
            <p className="text-sm font-semibold text-gray-800 mb-2">Templates rapides</p>
            <div className="flex flex-wrap gap-2">
              {templates.map(tpl => (
                <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                  className="px-3 py-1.5 bg-white text-xs font-medium text-emerald-800 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition">
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Infos de base */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Informations</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Nom de la campagne *</label>
              <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Ex: Relance clients janvier" />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))} className={inputClass}>
                <option value="custom">Personnalisée</option>
                <option value="relance_pending">Relance en attente</option>
                <option value="relance_cancelled">Relance annulés</option>
                <option value="promo">Promotion</option>
                <option value="followup">Suivi livraison</option>
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className={labelClass}>Tags (séparés par virgules)</label>
              <input type="text" value={formData.tags} onChange={e => setFormData(p => ({ ...p, tags: e.target.value }))} className={inputClass} placeholder="relance, janvier, promo..." />
            </div>
            <div>
              <label className={labelClass}>Programmer l'envoi</label>
              <input type="datetime-local" value={formData.scheduledAt} onChange={e => setFormData(p => ({ ...p, scheduledAt: e.target.value }))} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Ciblage */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Ciblage des clients</h2>
            <button type="button" onClick={handlePreview} disabled={previewLoading}
              className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-xs font-medium disabled:opacity-50 flex items-center gap-1">
              {previewLoading ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Chargement...</> : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> Prévisualiser</>}
            </button>
          </div>
          {/* Ciblage par commande */}
          <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-2">Ciblage par commande</p>

          {/* Statuts — multi-select chips */}
          <div className="mb-3">
            <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Statuts commande <span className="text-gray-400">(plusieurs possibles)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { v: 'pending', l: 'En attente', c: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
                { v: 'confirmed', l: 'Confirmé', c: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
                { v: 'shipped', l: 'Expédié', c: 'bg-teal-50 border-teal-300 text-teal-700' },
                { v: 'delivered', l: 'Livré', c: 'bg-green-50 border-green-300 text-green-700' },
                { v: 'returned', l: 'Retour', c: 'bg-orange-50 border-orange-300 text-orange-700' },
                { v: 'cancelled', l: 'Annulé', c: 'bg-red-50 border-red-300 text-red-600' },
                { v: 'unreachable', l: 'Injoignable', c: 'bg-gray-50 border-gray-300 text-gray-600' },
                { v: 'called', l: 'Appelé', c: 'bg-sky-50 border-sky-300 text-sky-700' },
                { v: 'postponed', l: 'Reporté', c: 'bg-amber-50 border-amber-300 text-amber-700' },
              ].map(({ v, l, c }) => {
                const selected = (formData.targetFilters.orderStatus || []).includes(v);
                return (
                  <button key={v} type="button"
                    onClick={() => { toggleArrayFilter('orderStatus', v); setTimeout(handlePreview, 200); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                      selected ? `${c} ring-2 ring-offset-1 ring-current shadow-sm` : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}>
                    {selected && <span className="mr-0.5">✓</span>}{l}
                  </button>
                );
              })}
            </div>
            {(formData.targetFilters.orderStatus || []).length > 0 && (
              <p className="text-[10px] text-emerald-600 mt-1 font-medium">
                {(formData.targetFilters.orderStatus).length} statut{(formData.targetFilters.orderStatus).length > 1 ? 's' : ''} sélectionné{(formData.targetFilters.orderStatus).length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Villes + Produits + Adresse — dropdowns avec checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">

            {/* Villes — dropdown checkbox */}
            <div className="relative">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Villes</label>
              <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                  {filterOptions.cities.length === 0 && (
                    <p className="text-[10px] text-gray-400 p-2">Aucune ville disponible</p>
                  )}
                  {filterOptions.cities.map(c => {
                    const sel = (formData.targetFilters.orderCity || []).includes(c);
                    return (
                      <label key={c} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors ${ sel ? 'bg-emerald-50' : '' }`}>
                        <input type="checkbox" checked={sel}
                          onChange={() => { toggleArrayFilter('orderCity', c); setTimeout(handlePreview, 200); }}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 flex-shrink-0" />
                        <span className={`text-xs ${ sel ? 'font-semibold text-emerald-800' : 'text-gray-700' }`}>{c}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {(formData.targetFilters.orderCity || []).length > 0 && (
                <p className="text-[10px] text-emerald-600 mt-1 font-medium">
                  {(formData.targetFilters.orderCity).length} ville{(formData.targetFilters.orderCity).length > 1 ? 's' : ''} sélectionnée{(formData.targetFilters.orderCity).length > 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Produits — dropdown checkbox */}
            <div className="relative">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Produits</label>
              <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                  {filterOptions.products.length === 0 && (
                    <p className="text-[10px] text-gray-400 p-2">Aucun produit disponible</p>
                  )}
                  {filterOptions.products.map(p => {
                    const sel = (formData.targetFilters.orderProduct || []).includes(p);
                    return (
                      <label key={p} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors ${ sel ? 'bg-violet-50' : '' }`}>
                        <input type="checkbox" checked={sel}
                          onChange={() => { toggleArrayFilter('orderProduct', p); setTimeout(handlePreview, 200); }}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500 flex-shrink-0" />
                        <span className={`text-xs ${ sel ? 'font-semibold text-violet-800' : 'text-gray-700' } truncate`} title={p}>{p}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {(formData.targetFilters.orderProduct || []).length > 0 && (
                <p className="text-[10px] text-violet-600 mt-1 font-medium">
                  {(formData.targetFilters.orderProduct).length} produit{(formData.targetFilters.orderProduct).length > 1 ? 's' : ''} sélectionné{(formData.targetFilters.orderProduct).length > 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Adresse</label>
              <select value={formData.targetFilters.orderAddress || ''} onChange={e => updateFilter('orderAddress', e.target.value)} className={inputClass}>
                <option value="">Toutes</option>
                {(filterOptions.addresses || []).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Date début</label>
              <input type="date" value={formData.targetFilters.orderDateFrom} onChange={e => updateFilter('orderDateFrom', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Date fin</label>
              <input type="date" value={formData.targetFilters.orderDateTo} onChange={e => updateFilter('orderDateTo', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Prix min</label>
              <input type="number" min="0" value={formData.targetFilters.orderMinPrice} onChange={e => updateFilter('orderMinPrice', parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Prix max</label>
              <input type="number" min="0" value={formData.targetFilters.orderMaxPrice} onChange={e => updateFilter('orderMaxPrice', parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
          </div>

          {/* Raccourcis relances */}
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
            <span className="text-[10px] text-gray-400 font-medium self-center mr-1">Relances rapides :</span>
            {[
              { key: 'pending', label: 'En attente' },
              { key: 'unreachable', label: 'Injoignables' },
              { key: 'called', label: 'Appelés' },
              { key: 'postponed', label: 'Reportés' },
              { key: 'confirmed', label: 'Confirmés' },
              { key: 'cancelled', label: 'Annulés' },
            ].map(f => {
              const isActive = (formData.targetFilters.orderStatus || []).includes(f.key);
              return (
                <button key={f.key} type="button" onClick={() => quickFilter(f.key)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition ${
                    isActive
                      ? 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}>
                  {isActive ? '✓ ' : ''}{f.label}
                </button>
              );
            })}
            <button type="button" onClick={resetFilters}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition">
              Réinitialiser
            </button>
          </div>

          {/* Preview results */}
          {preview && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={selectedClients.size === preview.clients.length && preview.clients.length > 0} onChange={toggleAllClients}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-800">{selectedClients.size}/{preview.count} sélectionné{selectedClients.size > 1 ? 's' : ''}</span>
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* 🆕 Boutons de sélection rapide */}
                  {preview.clients.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => selectSingleClient(preview.clients[0]._id)}
                        className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-[10px] font-medium hover:bg-emerald-200 transition"
                        disabled={selectedClients.size === 1 && selectedClients.has(preview.clients[0]._id)}
                      >
                        {selectedClients.size === 1 && selectedClients.has(preview.clients[0]._id) ? '1er sélectionné' : 'Sélectionner 1er'}
                      </button>
                      <button
                        type="button"
                        onClick={selectedClients.size === preview.clients.length ? deselectAllClients : selectAllClients}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-medium hover:bg-gray-200 transition"
                      >
                        {selectedClients.size === preview.clients.length ? 'Désélectionner' : 'Sélectionner tout'}
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => setShowPhoneList(!showPhoneList)}
                    className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-medium hover:bg-gray-200 transition">
                    {showPhoneList ? 'Masquer' : 'Voir'} numéros
                  </button>
                  <button type="button" onClick={copyPhones}
                    className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium hover:bg-emerald-200 transition">
                    {copied ? 'Copié !' : 'Copier numéros'}
                  </button>
                </div>
              </div>

              {/* Client list with checkboxes */}
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {preview.clients.map(c => (
                  <div key={c._id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition text-xs ${selectedClients.has(c._id) ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'}`}>
                    <input type="checkbox" checked={selectedClients.has(c._id)} onChange={() => toggleClient(c._id)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 flex-shrink-0" />
                    <span className="font-medium text-gray-800 min-w-[100px]">{c.firstName} {c.lastName}</span>
                    <span className="text-gray-500 font-mono">{c.phone}</span>
                    {c.address && <span className="text-gray-400 text-[10px] truncate max-w-[120px]" title={c.address}>📍 {c.address}</span>}
                    {c.city && <span className="text-gray-400">· {c.city}</span>}
                    {(c.tags || []).map(t => (
                      <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        t === 'Client' ? 'bg-emerald-100 text-emerald-700' :
                        t === 'En attente' ? 'bg-amber-100 text-amber-700' :
                        t === 'Annulé' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{t}</span>
                    ))}
                    {(c.products || []).length > 0 && <span className="text-[9px] text-emerald-600">{(c.products || []).join(', ')}</span>}
                    
                    {/* 🆕 Bouton d'aperçu par personne - Amélioré */}
                    <button
                      type="button"
                      onClick={() => {
                        // 🆕 Sélectionner automatiquement cette personne si pas déjà sélectionnée
                        if (!selectedClients.has(c._id)) {
                          selectSingleClient(c._id);
                        }
                        // Envoyer l'aperçu
                        handlePreviewSend(c);
                      }}
                      disabled={previewSending === c._id || !formData.messageTemplate.trim()}
                      className={`ml-auto px-3 py-1.5 rounded-lg text-[10px] font-medium transition flex items-center gap-1 ${
                        selectedClients.has(c._id) 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' 
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {previewSending === c._id ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Envoi...
                        </>
                      ) : (
                        <>
                          {selectedClients.has(c._id) ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                              Envoyer
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                              </svg>
                              {selectedClients.size === 0 ? 'Aperçu' : 'Aperçu'}
                            </>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {/* Phone list */}
              {showPhoneList && selectedClients.size > 0 && (
                <div className="mt-2 p-2.5 bg-gray-900 rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-gray-400 font-medium">{getSelectedPhones().length} numéros</span>
                    <button type="button" onClick={copyPhones} className="text-[10px] text-emerald-500 hover:text-emerald-400 font-medium">{copied ? 'Copié !' : 'Copier tout'}</button>
                  </div>
                  <div className="text-xs text-green-400 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {getSelectedPhones().join('\n')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message template */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Message WhatsApp</h2>
            {/* 🆕 Bouton de test anti-spam */}
            <button type="button" onClick={handleTestMessage}
              className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition text-xs font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              Tester anti-spam
            </button>
          </div>
          
          <div className="flex flex-wrap gap-1.5 mb-2">
            {variables.map(v => (
              <button key={v.var} type="button" onClick={() => insertVariable(v.var)}
                className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium hover:bg-emerald-100 transition">
                {v.label} <code className="ml-0.5 text-emerald-600">{v.var}</code>
              </button>
            ))}
          </div>
          <textarea
            rows={6}
            value={formData.messageTemplate}
            onChange={e => {
              setFormData(p => ({ ...p, messageTemplate: e.target.value }));
              // 🆕 Analyser le message en temps réel
              if (e.target.value.trim()) {
                const analysis = analyzeSpamRisk(e.target.value);
                setSpamAnalysis(analysis);
              } else {
                setSpamAnalysis(null);
              }
            }}
            className={inputClass}
            placeholder="Bonjour {firstName} 👋&#10;&#10;Votre message personnalisé ici..."
          />
          
          {/* 🆕 Affichage de l'analyse anti-spam */}
          {spamAnalysis && (
            <div className={`mt-3 p-3 rounded-lg border ${
              spamAnalysis.risk === 'HIGH' ? 'bg-red-50 border-red-200' :
              spamAnalysis.risk === 'MEDIUM' ? 'bg-yellow-50 border-yellow-200' :
              'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase mb-1.5">
                  {spamAnalysis.risk === 'HIGH' ? '⚠️ Risque spam élevé' :
                   spamAnalysis.risk === 'MEDIUM' ? '⚠️ Risque spam moyen' :
                   '✅ Faible risque spam'}
                </p>
                <span className="text-[10px] font-mono">Score: {spamAnalysis.score}</span>
              </div>
              
              {spamAnalysis.warnings.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-medium text-gray-700 mb-1">Warnings:</p>
                  <ul className="text-[9px] text-gray-600 space-y-0.5">
                    {spamAnalysis.warnings.map((warning, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-red-500">•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {spamAnalysis.recommendations.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-gray-700 mb-1">Recommandations:</p>
                  <ul className="text-[9px] text-gray-600 space-y-0.5">
                    {spamAnalysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-green-500">→</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* 🆕 Résultat du test */}
          {testResult && (
            <div className={`mt-3 p-3 rounded-lg border ${
              testResult.analysis.validated ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-[10px] font-semibold mb-2">{testResult.verdict}</p>
              <div className="text-xs text-gray-600 space-y-1">
                <p>Risque: <span className={`font-medium ${
                  testResult.analysis.risk === 'HIGH' ? 'text-red-600' :
                  testResult.analysis.risk === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
                }`}>{testResult.analysis.risk}</span></p>
                <p>Score: <span className="font-mono">{testResult.analysis.score}</span></p>
                <p>Longueur: {testResult.analysis.length} caractères</p>
                <p>Mots: {testResult.analysis.wordCount}</p>
              </div>
              {testResult.personalizedMessage && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-[10px] font-medium text-gray-700 mb-1">Message personnalisé:</p>
                  <div className="bg-white rounded p-2 text-xs text-gray-800 whitespace-pre-wrap">
                    {testResult.personalizedMessage}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {formData.messageTemplate && (
            <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-[10px] font-semibold text-green-700 uppercase mb-1.5">Aperçu du message</p>
              <div className="bg-white rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap shadow-sm border border-green-100">
                {renderPreviewMessage()}
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium disabled:opacity-50">
            {loading ? 'Enregistrement...' : (isEdit ? 'Enregistrer les modifications' : 'Créer la campagne')}
          </button>
          <button type="button" onClick={() => navigate('/ecom/campaigns')}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
};

export default CampaignForm;
