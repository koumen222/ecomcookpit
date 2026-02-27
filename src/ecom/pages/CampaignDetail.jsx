import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const fetchCampaign = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ecomApi.get(`/campaigns/${id}`);
      setCampaign(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur chargement campagne');
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  }) : '-';

  const statusConfig = {
    sent: { label: 'Envoyé', color: 'bg-green-100 text-green-700', icon: '✅' },
    failed: { label: 'Échoué', color: 'bg-red-100 text-red-700', icon: '❌' },
    pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: '⏳' }
  };

  const typeLabels = {
    custom: 'Personnalisée',
    relance_pending: 'Relance en attente',
    relance_cancelled: 'Relance annulés',
    relance_unreachable: 'Relance injoignables',
    relance_called: 'Relance appelés',
    relance_postponed: 'Relance reportés',
    relance_returns: 'Relance retours',
    relance_confirmed_not_shipped: 'Relance confirmés non expédiés',
    promo_city: 'Promo ville',
    promo_product: 'Promo produit',
    followup_delivery: 'Suivi livraison',
    relance_reorder: 'Relance recommande',
    followup_shipping: 'Suivi expédition',
    promo: 'Promotion',
    followup: 'Suivi',
    whatsapp: 'WhatsApp'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
        <Link to="/ecom/campaigns" className="mt-4 inline-block text-emerald-600 hover:text-emerald-700">
          ← Retour aux campagnes
        </Link>
      </div>
    );
  }

  if (!campaign) return null;

  // Filtrer les résultats
  const results = campaign.results || [];
  const filteredResults = results.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchSearch = !searchQuery || 
      r.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone?.includes(searchQuery);
    return matchStatus && matchSearch;
  });

  const sentCount = results.filter(r => r.status === 'sent').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;
  const successRate = sentCount + failedCount > 0 
    ? Math.round((sentCount / (sentCount + failedCount)) * 100) 
    : 0;

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/ecom/campaigns" className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{campaign.name}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
              campaign.status === 'draft' ? 'bg-gray-100 text-gray-700' :
              campaign.status === 'scheduled' ? 'bg-emerald-100 text-emerald-700' :
              campaign.status === 'sending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {campaign.status === 'sent' ? 'Envoyée' :
               campaign.status === 'draft' ? 'Brouillon' :
               campaign.status === 'scheduled' ? 'Programmée' :
               campaign.status === 'sending' ? 'En cours' :
               'Échouée'}
            </span>
            <span className="text-xs text-gray-500">{typeLabels[campaign.type] || campaign.type}</span>
            {campaign.sentAt && (
              <span className="text-xs text-gray-500">Envoyée le {fmtDate(campaign.sentAt)}</span>
            )}
          </div>
        </div>
        <Link 
          to={`/ecom/campaigns/${campaign._id}/edit`}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Modifier
        </Link>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{campaign.stats?.targeted || 0}</div>
          <div className="text-xs text-gray-500 uppercase font-medium mt-1">Ciblés</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{sentCount}</div>
          <div className="text-xs text-gray-500 uppercase font-medium mt-1">Envoyés</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          <div className="text-xs text-gray-500 uppercase font-medium mt-1">Échecs</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{successRate}%</div>
          <div className="text-xs text-gray-500 uppercase font-medium mt-1">Taux succès</div>
        </div>
      </div>

      {/* Message template */}
      {campaign.messageTemplate && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">📝 Message envoyé</h2>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{campaign.messageTemplate}</p>
          </div>
        </div>
      )}

      {/* Filtres et recherche */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterStatus === 'all' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tous ({results.length})
            </button>
            <button
              onClick={() => setFilterStatus('sent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterStatus === 'sent' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ✅ Envoyés ({sentCount})
            </button>
            <button
              onClick={() => setFilterStatus('failed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterStatus === 'failed' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ❌ Échecs ({failedCount})
            </button>
            {pendingCount > 0 && (
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterStatus === 'pending' 
                    ? 'bg-yellow-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ⏳ En attente ({pendingCount})
              </button>
            )}
          </div>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Rechercher par nom ou téléphone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Liste des résultats */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">
            📊 Activité détaillée ({filteredResults.length} résultat{filteredResults.length > 1 ? 's' : ''})
          </h2>
        </div>
        
        {filteredResults.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
              </svg>
            </div>
            <p className="text-sm text-gray-500">Aucun résultat trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Téléphone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Erreur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredResults.map((result, idx) => {
                  const config = statusConfig[result.status] || statusConfig.pending;
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
                          <span>{config.icon}</span>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{result.clientName || 'Inconnu'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 font-mono">{result.phone || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-500">{fmtDate(result.sentAt)}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {result.error ? (
                          <div className="text-xs text-red-600 truncate" title={result.error}>
                            {result.error}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignDetail;
