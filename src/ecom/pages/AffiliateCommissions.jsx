import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  affiliatePortalApi,
  clearAffiliateToken,
  getAffiliateToken
} from '../services/affiliatePortalApi.js';
import AffiliateLayout from '../components/AffiliateLayout.jsx';

const fmt = (n) => (n || 0).toLocaleString('fr-FR');

const statusLabels = { pending: 'En attente', approved: 'Approuvée', paid: 'Payée', rejected: 'Rejetée' };
const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  paid: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function AffiliateCommissions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [affiliate, setAffiliate] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [conversions, setConversions] = useState([]);

  const load = useCallback(async () => {
    const token = getAffiliateToken();
    if (!token) { navigate('/affiliate/login'); return; }
    setLoading(true);
    setError('');
    try {
      const [d, c] = await Promise.all([
        affiliatePortalApi.getDashboard(),
        affiliatePortalApi.getConversions({ page: 1, limit: 200 })
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

  // Group conversions by month
  const monthlyData = conversions.reduce((acc, c) => {
    const d = new Date(c.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = { key, label, total: 0, pending: 0, approved: 0, paid: 0, rejected: 0, count: 0 };
    acc[key].total += Number(c.commissionAmount || 0);
    acc[key][c.status] = (acc[key][c.status] || 0) + Number(c.commissionAmount || 0);
    acc[key].count += 1;
    return acc;
  }, {});
  const months = Object.values(monthlyData).sort((a, b) => b.key.localeCompare(a.key));

  // Commission rate display
  const commissionDisplay = affiliate
    ? affiliate.commissionType === 'percentage'
      ? `${affiliate.commissionValue}% par vente`
      : `${fmt(affiliate.commissionValue)} FCFA par vente`
    : '—';

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

  return (
    <AffiliateLayout affiliate={affiliate}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-[#0F6B4F]/10 text-[#0F6B4F] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <p className="text-xl font-bold text-[#0F6B4F]">{fmt(kpis?.totalCommissions)} <span className="text-sm font-medium">F</span></p>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">Total commissions</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <p className="text-xl font-bold text-amber-700">{fmt(kpis?.pendingCommissions)} <span className="text-sm font-medium">F</span></p>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">En attente</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <p className="text-xl font-bold text-emerald-700">{fmt(kpis?.approvedCommissions)} <span className="text-sm font-medium">F</span></p>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">Approuvées</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
            </div>
            <p className="text-xl font-bold text-blue-700">{fmt(kpis?.paidCommissions)} <span className="text-sm font-medium">F</span></p>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">Payées</p>
          </div>
        </div>

        {/* Commission rate info */}
        <div className="bg-gradient-to-r from-[#0F6B4F] to-[#0a5040] rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/70 font-medium">Votre taux de commission</p>
              <p className="text-2xl font-bold mt-1">{commissionDisplay}</p>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>

        {/* Monthly breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Historique mensuel</h3>
          </div>
          {months.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {months.map(m => (
                <div key={m.key} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 capitalize">{m.label}</p>
                    <p className="text-xs text-gray-500">{m.count} conversion{m.count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                    {m.pending > 0 && <span className={`px-2 py-1 rounded-full font-medium ${statusColors.pending}`}>{fmt(m.pending)} F en attente</span>}
                    {m.approved > 0 && <span className={`px-2 py-1 rounded-full font-medium ${statusColors.approved}`}>{fmt(m.approved)} F approuvées</span>}
                    {m.paid > 0 && <span className={`px-2 py-1 rounded-full font-medium ${statusColors.paid}`}>{fmt(m.paid)} F payées</span>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-bold text-[#0F6B4F]">{fmt(m.total)} F</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Aucune commission enregistrée.</p>
          )}
        </div>

        {/* Recent conversions with commissions */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Détail des commissions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commande</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Vente</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {conversions.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{c.orderNumber || c.orderId || '—'}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{fmt(c.orderAmount)} F</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {c.commissionType === 'percentage' ? `${c.commissionValue}%` : 'Fixe'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-[#0F6B4F]">{fmt(c.commissionAmount)} F</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
                {conversions.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Aucune commission enregistrée.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AffiliateLayout>
  );
}
