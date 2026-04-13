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

export default function AffiliateConversions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [affiliate, setAffiliate] = useState(null);
  const [conversions, setConversions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    const token = getAffiliateToken();
    if (!token) { navigate('/affiliate/login'); return; }
    setLoading(true);
    setError('');
    try {
      const [me, c] = await Promise.all([
        affiliatePortalApi.me(),
        affiliatePortalApi.getConversions({ page, limit: 30, status: statusFilter || undefined })
      ]);
      setAffiliate(me.data?.data || me.data?.affiliate || null);
      setConversions(c.data?.data?.items || []);
      setPagination(c.data?.data?.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      if (err.response?.status === 401) { clearAffiliateToken(); navigate('/affiliate/login'); return; }
      setError(err.response?.data?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [navigate, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totals = conversions.reduce((acc, c) => {
    acc.sales += Number(c.orderAmount || 0);
    acc.commissions += Number(c.commissionAmount || 0);
    return acc;
  }, { sales: 0, commissions: 0 });

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

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
            <p className="text-xs uppercase tracking-wide text-gray-500 mt-0.5">Total conversions</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900">{fmt(totals.sales)} <span className="text-sm font-medium text-gray-500">F</span></p>
            <p className="text-xs uppercase tracking-wide text-gray-500 mt-0.5">Ventes générées</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-[#0F6B4F]">{fmt(totals.commissions)} <span className="text-sm font-medium text-[#0F6B4F]/60">F</span></p>
            <p className="text-xs uppercase tracking-wide text-gray-500 mt-0.5">Commissions</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">Filtrer :</span>
          {['', 'pending', 'approved', 'paid', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[#0F6B4F] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s ? statusLabels[s] : 'Toutes'}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commande</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
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
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Aucune conversion{statusFilter ? ` avec le statut "${statusLabels[statusFilter]}"` : ''}.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Page {pagination.page} sur {pagination.pages} — {pagination.total} résultat{pagination.total > 1 ? 's' : ''}</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Précédent
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AffiliateLayout>
  );
}
