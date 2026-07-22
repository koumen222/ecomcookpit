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
  approved: 'bg-primary-100 text-primary-800',
  paid: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

const payoutStatusLabels = { pending: 'En traitement', paid: 'Payé', rejected: 'Rejeté' };
const payoutStatusColors = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-primary-100 text-primary-800',
  rejected: 'bg-red-100 text-red-800',
};

const METHOD_LABELS = {
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
  bank: 'Virement bancaire',
  other: 'Autre'
};

export default function AffiliateCommissions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [affiliate, setAffiliate] = useState(null);
  const [conversions, setConversions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [balance, setBalance] = useState(0);
  const [minPayout, setMinPayout] = useState(5000);
  const [statusFilter, setStatusFilter] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestForm, setRequestForm] = useState({ method: 'mtn_momo', phoneNumber: '', accountName: '' });
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');

  const load = useCallback(async () => {
    const token = getAffiliateToken();
    if (!token) { navigate('/affiliate/login'); return; }
    setLoading(true);
    setError('');
    try {
      const [me, c, p] = await Promise.all([
        affiliatePortalApi.me(),
        affiliatePortalApi.getConversions({ page: 1, limit: 200 }),
        affiliatePortalApi.getPayouts()
      ]);
      setAffiliate(me.data?.data?.affiliate || null);
      setConversions(c.data?.data?.items || []);
      const payoutData = p.data?.data || {};
      setPayouts(payoutData.payouts || []);
      setBalance(payoutData.balance || 0);
      setMinPayout(payoutData.minPayoutAmount ?? 5000);
      const saved = payoutData.savedMethod || {};
      setRequestForm((f) => ({
        method: saved.method || f.method,
        phoneNumber: saved.phoneNumber || f.phoneNumber,
        accountName: saved.accountName || f.accountName
      }));
    } catch (err) {
      if (err.response?.status === 401) { clearAffiliateToken(); navigate('/affiliate/login'); return; }
      setError(err.response?.data?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const hasPendingPayout = payouts.some((p) => p.status === 'pending');
  const canRequest = balance >= minPayout && !hasPendingPayout;

  const submitRequest = async (e) => {
    e.preventDefault();
    setRequesting(true);
    setRequestError('');
    setRequestSuccess('');
    try {
      const res = await affiliatePortalApi.requestPayout(requestForm);
      setRequestSuccess(res.data?.message || 'Demande de retrait enregistrée');
      setShowRequest(false);
      await load();
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Demande impossible');
    } finally {
      setRequesting(false);
    }
  };

  const totals = conversions.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + Number(c.commissionAmount || 0);
    return acc;
  }, {});

  const filtered = statusFilter ? conversions.filter((c) => c.status === statusFilter) : conversions;

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
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}
        {requestSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{requestSuccess}</div>
        )}

        {/* Solde + CTA retrait */}
        <div className="bg-gradient-to-r from-[#0F6B4F] to-[#0a5040] rounded-2xl p-5 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-white/70">Solde disponible</p>
              <p className="text-3xl font-bold mt-1">{fmt(balance)} FCFA</p>
              <p className="text-xs text-white/60 mt-1">Retrait minimum : {fmt(minPayout)} FCFA</p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <button
                onClick={() => setShowRequest((v) => !v)}
                disabled={!canRequest}
                className={`px-5 py-3 rounded-xl font-semibold text-sm transition-colors ${
                  canRequest
                    ? 'bg-white text-[#0F6B4F] hover:bg-gray-100'
                    : 'bg-white/20 text-white/60 cursor-not-allowed'
                }`}
              >
                Demander un retrait
              </button>
              {hasPendingPayout && (
                <p className="text-xs text-white/80">Un retrait est déjà en cours de traitement.</p>
              )}
              {!hasPendingPayout && balance < minPayout && (
                <p className="text-xs text-white/80">Encore {fmt(minPayout - balance)} FCFA avant de pouvoir retirer.</p>
              )}
            </div>
          </div>
        </div>

        {/* Formulaire de demande */}
        {showRequest && canRequest && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Demande de retrait — {fmt(balance)} FCFA</h3>
            <p className="text-xs text-gray-500 mb-4">Le retrait porte sur l'intégralité de votre solde approuvé. Traitement sous 72h ouvrées.</p>
            {requestError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{requestError}</div>
            )}
            <form onSubmit={submitRequest} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={requestForm.method}
                onChange={(e) => setRequestForm((f) => ({ ...f, method: e.target.value }))}
                className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="mtn_momo">MTN MoMo</option>
                <option value="orange_money">Orange Money</option>
                <option value="bank">Virement bancaire</option>
                <option value="other">Autre</option>
              </select>
              <input
                type="tel"
                placeholder={['bank', 'other'].includes(requestForm.method) ? 'Numéro de compte / référence' : 'Numéro Mobile Money (ex: 6XXXXXXXX)'}
                value={requestForm.phoneNumber}
                onChange={(e) => setRequestForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                required={['mtn_momo', 'orange_money'].includes(requestForm.method)}
                className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <input
                type="text"
                placeholder="Nom du bénéficiaire"
                value={requestForm.accountName}
                onChange={(e) => setRequestForm((f) => ({ ...f, accountName: e.target.value }))}
                className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <button
                type="submit"
                disabled={requesting}
                className="px-6 py-3 bg-[#0F6B4F] hover:bg-[#0a5040] text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {requesting ? 'Envoi...' : `Retirer ${fmt(balance)} FCFA`}
              </button>
            </form>
          </div>
        )}

        {/* Récap par statut */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {['pending', 'approved', 'paid', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`bg-white border rounded-xl p-4 text-left transition-all ${
                statusFilter === s ? 'border-[#0F6B4F] ring-1 ring-[#0F6B4F]' : 'border-gray-200 hover:shadow-sm'
              }`}
            >
              <p className="text-xl font-bold text-gray-900">{fmt(totals[s])} F</p>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">{statusLabels[s]}s</p>
            </button>
          ))}
        </div>

        {/* Historique des retraits */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Mes retraits</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Demandé le</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Méthode</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Référence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-5 py-3 text-sm text-gray-900">
                      {METHOD_LABELS[p.method] || p.method}
                      {p.phoneNumber && <span className="block text-xs text-gray-500 font-mono">{p.phoneNumber}</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-right font-bold text-gray-900">{fmt(p.amount)} F</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${payoutStatusColors[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {payoutStatusLabels[p.status] || p.status}
                      </span>
                      {p.adminNote && <span className="block text-xs text-gray-500 mt-0.5">{p.adminNote}</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{p.paymentReference || '—'}</td>
                  </tr>
                ))}
                {payouts.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">Aucun retrait pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Détail des commissions */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Détail des commissions {statusFilter ? `— ${statusLabels[statusFilter]}s` : ''}
            </h3>
            <span className="text-xs text-gray-500">{filtered.length} ligne{filtered.length > 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Base</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-5 py-3 text-sm text-gray-900 font-medium">
                      {c.conversionType === 'signup' ? 'Inscription filleul' : c.conversionType === 'payment' ? `Abonnement (${c.commissionValue}%)` : 'Commande'}
                    </td>
                    <td className="px-5 py-3 text-sm text-right text-gray-500">{c.orderAmount ? `${fmt(c.orderAmount)} F` : '—'}</td>
                    <td className="px-5 py-3 text-sm text-right font-bold text-[#0F6B4F]">+{fmt(c.commissionAmount)} F</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">Aucune commission{statusFilter ? ' avec ce statut' : ''}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AffiliateLayout>
  );
}
