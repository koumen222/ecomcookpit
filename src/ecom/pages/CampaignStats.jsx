import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';

const CampaignStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ecomApi.get('/campaigns/stats');
      setStats(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur chargement statistiques');
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
  const fmtNum = (n) => n?.toLocaleString('fr-FR') || '0';

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
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">📊 Statistiques des Campagnes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de l'activité WhatsApp</p>
        </div>
        <Link to="/ecom/campaigns" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Retour aux campagnes
        </Link>
      </div>

      {/* Vue d'ensemble */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total campagnes', value: stats.overview.totalCampaigns, icon: '📧', color: 'bg-gray-50 border-gray-200' },
          { label: 'Envoyées', value: stats.overview.sentCampaigns, icon: '✅', color: 'bg-green-50 border-green-200' },
          { label: 'Brouillons', value: stats.overview.draftCampaigns, icon: '📝', color: 'bg-emerald-50 border-emerald-200' },
          { label: 'Programmées', value: stats.overview.scheduledCampaigns, icon: '⏰', color: 'bg-emerald-50 border-emerald-200' },
          { label: 'Taux succès', value: `${stats.overview.successRate}%`, icon: '📈', color: 'bg-emerald-50 border-emerald-200' }
        ].map((s, i) => (
          <div key={i} className={`${s.color} border rounded-xl p-4 text-center`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-[10px] text-gray-500 uppercase font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Statistiques d'envoi */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Ciblés</p>
              <p className="text-2xl font-bold text-gray-900">{fmtNum(stats.overview.totalTargeted)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Envoyés</p>
              <p className="text-2xl font-bold text-green-600">{fmtNum(stats.overview.totalSent)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Échecs</p>
              <p className="text-2xl font-bold text-red-600">{fmtNum(stats.overview.totalFailed)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activité des 7 derniers jours */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">📅 Activité des 7 derniers jours</h2>
        <div className="space-y-2">
          {stats.recentActivity.activityByDay.reverse().map((day, i) => {
            const total = day.sent + day.failed;
            const successRate = total > 0 ? Math.round((day.sent / total) * 100) : 0;
            const dateObj = new Date(day.date);
            const dateLabel = dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
            
            return (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="min-w-[100px]">
                  <p className="text-xs font-medium text-gray-700">{dateLabel}</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      {total > 0 && (
                        <div 
                          className="h-full bg-green-500" 
                          style={{ width: `${successRate}%` }}
                        ></div>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-600 min-w-[40px] text-right">{successRate}%</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>{day.campaigns} campagne{day.campaigns > 1 ? 's' : ''}</span>
                    <span className="text-green-600">{day.sent} envoyés</span>
                    {day.failed > 0 && <span className="text-red-500">{day.failed} échecs</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campagnes par type */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">📂 Par type de campagne</h2>
          <div className="space-y-2">
            {stats.campaignsByType.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune campagne</p>
            ) : (
              stats.campaignsByType.map((type, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{typeLabels[type.type] || type.type}</p>
                    <p className="text-xs text-gray-500">{type.count} campagne{type.count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{type.successRate}%</p>
                    <p className="text-xs text-gray-500">{type.sent} / {type.sent + type.failed}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top 5 campagnes */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">🏆 Top 5 campagnes</h2>
          <div className="space-y-2">
            {stats.topCampaigns.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune campagne envoyée</p>
            ) : (
              stats.topCampaigns.map((campaign, i) => (
                <div key={campaign._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-emerald-600">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{campaign.name}</p>
                    <p className="text-xs text-gray-500">{fmtDate(campaign.sentAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">{campaign.sent}</p>
                    <p className="text-xs text-gray-500">{campaign.successRate}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Dernières campagnes */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mt-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">🕐 Dernières campagnes envoyées</h2>
        {stats.latestCampaigns.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune campagne envoyée</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Campagne</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Ciblés</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Envoyés</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Échecs</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.latestCampaigns.map(campaign => (
                  <tr key={campaign._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link to={`/ecom/campaigns/${campaign._id}`} className="font-medium text-gray-900 hover:text-emerald-600">
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{typeLabels[campaign.type] || campaign.type}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{campaign.targeted}</td>
                    <td className="px-3 py-2 text-right text-green-600 font-medium">{campaign.sent}</td>
                    <td className="px-3 py-2 text-right text-red-500">{campaign.failed}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{fmtDate(campaign.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignStats;
