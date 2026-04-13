import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  affiliatePortalApi,
  clearAffiliateToken,
  getAffiliateToken
} from '../services/affiliatePortalApi.js';
import AffiliateLayout from '../components/AffiliateLayout.jsx';

const REFERRAL_BASE_URL = 'https://scalor.net/ecom/register';

const fmt = (n) => (n || 0).toLocaleString('fr-FR');

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  paid: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function AffiliateDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [affiliate, setAffiliate] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [conversions, setConversions] = useState([]);
  const [copied, setCopied] = useState(null);
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    const token = getAffiliateToken();
    if (!token) { navigate('/affiliate/login'); return; }
    setLoading(true);
    setError('');
    try {
      const [d, c] = await Promise.all([
        affiliatePortalApi.getDashboard(),
        affiliatePortalApi.getConversions({ page: 1, limit: 100 })
      ]);
      setAffiliate(d.data?.data?.affiliate || null);
      setKpis(d.data?.data?.kpis || null);
      setConversions(c.data?.data?.items || []);
    } catch (err) {
      if (err.response?.status === 401) { clearAffiliateToken(); navigate('/affiliate/login'); return; }
      setError(err.response?.data?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <AffiliateLayout affiliate={null}>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 animate-spin text-[#0F6B4F]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <p className="text-sm text-gray-500">Chargement...</p>
          </div>
        </div>
      </AffiliateLayout>
    );
  }

  const kpiCards = [
    { label: 'Inscriptions', value: fmt(kpis?.conversions), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>, color: 'bg-blue-50 text-blue-600' },
    { label: 'Paiements', value: fmt(kpis?.clicks), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, color: 'bg-purple-50 text-purple-600' },
    { label: 'Commissions (FCFA)', value: fmt(kpis?.totalCommissions), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: 'bg-[#0F6B4F]/10 text-[#0F6B4F]' },
  ];

  const referralUrl = affiliate ? `${REFERRAL_BASE_URL}?aff=${affiliate.referralCode}` : '';

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble' },
    { id: 'conversions', label: 'Conversions' },
  ];

  return (
    <AffiliateLayout affiliate={affiliate}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 ${kpi.color} rounded-lg flex items-center justify-center`}>
                  {kpi.icon}
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Referral link — always visible */}
        {affiliate && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-900">Votre lien de parrainage</h2>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#0F6B4F] bg-[#0F6B4F]/10 px-2 py-0.5 rounded-full">{affiliate.referralCode}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Partagez ce lien — vous gagnez <b>500 FCFA</b> par inscription et <b>50%</b> sur chaque paiement du filleul.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-900 text-emerald-300 rounded-lg p-3 break-all font-mono">{referralUrl}</code>
              <button
                onClick={() => copyToClipboard(referralUrl, 'primary')}
                className="flex-shrink-0 px-3 py-3 bg-[#0F6B4F] hover:bg-[#0a5040] text-white rounded-lg transition-colors"
              >
                {copied === 'primary' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab navigation */}
        <div className="border-b border-gray-200">
          <div className="flex gap-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-[#0F6B4F] text-[#0F6B4F]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Commission structure */}
            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Comment ça marche</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold">1</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Inscription via votre lien</p>
                    <p className="text-xs text-gray-600 mt-0.5">Vous gagnez <b>500 FCFA</b> pour chaque personne qui s'inscrit avec votre lien de parrainage.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold">2</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Paiement d'un abonnement</p>
                    <p className="text-xs text-gray-600 mt-0.5">Quand votre filleul souscrit à un plan, vous recevez <b>50%</b> du montant en commission.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent conversions */}
            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Dernières conversions</h3>
                <button onClick={() => setTab('conversions')} className="text-xs text-[#0F6B4F] font-medium hover:underline">Voir tout →</button>
              </div>
              <div className="p-4 space-y-2">
                {conversions.slice(0, 5).map((c) => (
                  <div key={c._id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{c.conversionType === 'signup' ? 'Inscription' : c.conversionType === 'payment' ? 'Paiement abonnement' : c.orderNumber || '—'}</p>
                      <p className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#0F6B4F]">{fmt(c.commissionAmount)} F</p>
                      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                    </div>
                  </div>
                ))}
                {conversions.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Aucune conversion.</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'conversions' && (
          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Toutes les conversions ({conversions.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {conversions.map((c) => (
                    <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{c.conversionType === 'signup' ? 'Inscription' : c.conversionType === 'payment' ? 'Paiement' : c.orderNumber || '—'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{c.orderAmount ? `${fmt(c.orderAmount)} F` : '—'}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-[#0F6B4F]">{fmt(c.commissionAmount)} F</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                  {conversions.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Aucune conversion enregistrée.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AffiliateLayout>
  );
}
