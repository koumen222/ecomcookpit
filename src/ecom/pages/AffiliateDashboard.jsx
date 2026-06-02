import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  affiliatePortalApi,
  clearAffiliateToken,
  getAffiliateToken
} from '../services/affiliatePortalApi.js';
import AffiliateLayout from '../components/AffiliateLayout.jsx';

const REFERRAL_BASE_URL = 'https://scalor.net/ref';

const fmt = (n) => (n || 0).toLocaleString('fr-FR');

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-primary-100 text-primary-800',
  paid: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

const statusLabels = {
  pending: 'En attente',
  approved: 'Approuvé',
  paid: 'Payé',
  rejected: 'Rejeté',
};

function AnimatedCounter({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value || 0;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    prevValue.current = end;
  }, [value, duration]);

  return <>{fmt(display)}</>;
}

export default function AffiliateDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [affiliate, setAffiliate] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [conversions, setConversions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', operator: 'orange_money' });
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  // Simulation state (for demo purposes)
  const [simData, setSimData] = useState(() => {
    try {
      const saved = localStorage.getItem('scalor_affiliate_sim');
      return saved ? JSON.parse(saved) : { balance: 0, inscriptions: 0, clients: 0, monthCommissions: 0, history: [] };
    } catch { return { balance: 0, inscriptions: 0, clients: 0, monthCommissions: 0, history: [] }; }
  });

  useEffect(() => {
    localStorage.setItem('scalor_affiliate_sim', JSON.stringify(simData));
  }, [simData]);

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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = (url) => {
    const msg = encodeURIComponent(`Rejoins Scalor, le SaaS e-commerce africain ! Inscris-toi avec mon lien et lance ton business : ${url}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const simulate = (type, amount, commission) => {
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('fr-FR'),
      type,
      client: `Client-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      amount: commission,
      status: type === 'inscription' ? 'paid' : 'pending',
    };
    setSimData(prev => ({
      balance: prev.balance + commission,
      inscriptions: prev.inscriptions + (type === 'inscription' ? 1 : 0),
      clients: prev.clients + (type !== 'inscription' ? 1 : 0),
      monthCommissions: prev.monthCommissions + commission,
      history: [entry, ...prev.history].slice(0, 50),
    }));
  };

  const handleWithdraw = (e) => {
    e.preventDefault();
    const amount = parseInt(withdrawForm.amount);
    if (!amount || amount < 5000) {
      setWithdrawError('Minimum de retrait : 5 000 FCFA');
      return;
    }
    if (amount > (kpis?.totalCommissions || 0) + simData.balance) {
      setWithdrawError('Solde insuffisant');
      return;
    }
    setWithdrawError('');
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('fr-FR'),
      type: 'retrait',
      client: withdrawForm.operator === 'orange_money' ? 'Orange Money' : withdrawForm.operator === 'mtn' ? 'MTN MoMo' : 'Virement',
      amount: -amount,
      status: 'pending',
    };
    setSimData(prev => ({
      ...prev,
      balance: prev.balance - amount,
      history: [entry, ...prev.history].slice(0, 50),
    }));
    setWithdrawSuccess(`Retrait de ${fmt(amount)} FCFA en cours de traitement`);
    setWithdrawForm({ amount: '', operator: 'orange_money' });
    setTimeout(() => { setWithdrawSuccess(''); setShowWithdraw(false); }, 3000);
  };

  const referralCode = affiliate?.referralCode || 'SCL-XXXXX';
  const referralUrl = `${REFERRAL_BASE_URL}/${referralCode}`;
  const totalBalance = (kpis?.totalCommissions || 0) + simData.balance;
  const totalInscriptions = (kpis?.conversions || 0) + simData.inscriptions;
  const totalClients = simData.clients;
  const totalMonthCommissions = simData.monthCommissions;

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
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        {/* Header with referral link */}
        <div className="bg-gradient-to-r from-[#0F6B4F] to-[#0a5040] rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjMpIi8+PC9zdmc+')]" />
          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <div>
                <h1 className="text-xl font-bold">Bienvenue, {affiliate?.name || 'Affilié'}</h1>
                <p className="text-sm text-white/70 mt-0.5">Votre lien de parrainage</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-white/10 rounded-full border border-white/20 self-start">
                Affilié Scalor
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <code className="flex-1 text-sm bg-black/20 text-white rounded-xl p-3 break-all font-mono border border-white/10">
                {referralUrl}
              </code>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(referralUrl)}
                  className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                    copied ? 'bg-white text-[#0F6B4F]' : 'bg-white/20 hover:bg-white/30 text-white border border-white/20'
                  }`}
                >
                  {copied ? (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Copié !</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg> Copier</>
                  )}
                </button>
                <button
                  onClick={() => shareWhatsApp(referralUrl)}
                  className="px-4 py-3 rounded-xl font-semibold text-sm bg-[#25D366] hover:bg-[#20BD5A] text-white transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="w-9 h-9 bg-[#0F6B4F]/10 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-[#0F6B4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-2xl font-bold text-gray-900"><AnimatedCounter value={totalBalance} /></p>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">Solde disponible (FCFA)</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </div>
            <p className="text-2xl font-bold text-gray-900"><AnimatedCounter value={totalInscriptions} /></p>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">Inscriptions (x300 FCFA)</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </div>
            <p className="text-2xl font-bold text-gray-900"><AnimatedCounter value={totalClients} /></p>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">Clients actifs</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <p className="text-2xl font-bold text-gray-900"><AnimatedCounter value={totalMonthCommissions} /></p>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">Commissions ce mois (30%)</p>
          </div>
        </div>

        {/* Withdraw */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowWithdraw(!showWithdraw)}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-[#0F6B4F] hover:bg-[#0a5040] text-white transition-colors flex items-center gap-2 shadow-lg shadow-primary-600/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Demander un retrait
          </button>
        </div>

        {showWithdraw && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Demander un retrait</h3>
            {withdrawSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm mb-4">{withdrawSuccess}</div>
            )}
            {withdrawError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{withdrawError}</div>
            )}
            <form onSubmit={handleWithdraw} className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                placeholder="Montant (min 5 000 FCFA)"
                value={withdrawForm.amount}
                onChange={e => setWithdrawForm(f => ({ ...f, amount: e.target.value }))}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
              <select
                value={withdrawForm.operator}
                onChange={e => setWithdrawForm(f => ({ ...f, operator: e.target.value }))}
                className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="orange_money">Orange Money</option>
                <option value="mtn">MTN MoMo</option>
                <option value="virement">Virement bancaire</option>
              </select>
              <button type="submit" className="px-6 py-3 bg-[#0F6B4F] hover:bg-[#0a5040] text-white font-semibold rounded-xl text-sm transition-colors">
                Retirer
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2">Solde disponible : <span className="text-[#0F6B4F] font-bold">{fmt(totalBalance)} FCFA</span></p>
          </div>
        )}

        {/* Gains table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Historique des gains</h3>
            <span className="text-xs text-gray-500">{simData.history.length + conversions.length} transactions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {simData.history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-500">{item.date}</td>
                    <td className="px-5 py-3 text-sm text-gray-900 font-medium">
                      {item.type === 'inscription' && 'Inscription (+300 FCFA)'}
                      {item.type === 'commission' && 'Commission 30%'}
                      {item.type === 'retrait' && 'Retrait'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{item.client}</td>
                    <td className={`px-5 py-3 text-sm text-right font-bold ${item.amount > 0 ? 'text-[#0F6B4F]' : 'text-red-600'}`}>
                      {item.amount > 0 ? '+' : ''}{fmt(item.amount)} F
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[item.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[item.status] || item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {conversions.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-5 py-3 text-sm text-gray-900 font-medium">
                      {c.conversionType === 'signup' ? 'Inscription' : 'Commission'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{c.referredUser?.name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-right font-bold text-[#0F6B4F]">+{fmt(c.commissionAmount)} F</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {simData.history.length === 0 && conversions.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">Aucune transaction. Utilisez le simulateur ci-dessous.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Simulator */}
        <div className="bg-gray-100 border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Simulateur</span>
            <span className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">Démo</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => simulate('inscription', 0, 300)}
              className="px-4 py-3 bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-200 rounded-xl text-sm text-gray-700 hover:text-gray-900 transition-all duration-200 text-left"
            >
              <span className="block text-xs font-medium">+ Inscription</span>
              <span className="block text-[11px] text-[#0F6B4F] font-bold mt-0.5">+300 FCFA</span>
            </button>
            <button
              onClick={() => simulate('commission', 5000, 1500)}
              className="px-4 py-3 bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-200 rounded-xl text-sm text-gray-700 hover:text-gray-900 transition-all duration-200 text-left"
            >
              <span className="block text-xs font-medium">Achat 5 000F</span>
              <span className="block text-[11px] text-[#0F6B4F] font-bold mt-0.5">+1 500 FCFA (30%)</span>
            </button>
            <button
              onClick={() => simulate('commission', 10000, 3000)}
              className="px-4 py-3 bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-200 rounded-xl text-sm text-gray-700 hover:text-gray-900 transition-all duration-200 text-left"
            >
              <span className="block text-xs font-medium">Achat 10 000F</span>
              <span className="block text-[11px] text-[#0F6B4F] font-bold mt-0.5">+3 000 FCFA (30%)</span>
            </button>
            <button
              onClick={() => simulate('commission', 15000, 4500)}
              className="px-4 py-3 bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-200 rounded-xl text-sm text-gray-700 hover:text-gray-900 transition-all duration-200 text-left"
            >
              <span className="block text-xs font-medium">Achat 15 000F</span>
              <span className="block text-[11px] text-[#0F6B4F] font-bold mt-0.5">+4 500 FCFA (30%)</span>
            </button>
          </div>
          <button
            onClick={() => setSimData({ balance: 0, inscriptions: 0, clients: 0, monthCommissions: 0, history: [] })}
            className="mt-3 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Réinitialiser la simulation
          </button>
        </div>

        {/* Commission rules */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Règles de commission</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary-50 border border-primary-100">
              <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Inscription via lien</p>
                <p className="text-xs text-[#0F6B4F] font-semibold">+300 FCFA (immédiat)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Abonnement 5 000 FCFA/mois</p>
                <p className="text-xs text-[#0F6B4F] font-semibold">+1 500 FCFA/mois (30%)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-100">
              <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-lg flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Abonnement 10 000 FCFA/mois</p>
                <p className="text-xs text-[#0F6B4F] font-semibold">+3 000 FCFA/mois (30%)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-sm font-bold">4</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Abonnement 15 000 FCFA/mois</p>
                <p className="text-xs text-[#0F6B4F] font-semibold">+4 500 FCFA/mois (30%)</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Retrait minimum : <span className="text-[#0F6B4F] font-bold">5 000 FCFA</span> — via Orange Money, MTN MoMo ou virement.</p>
        </div>
      </div>
    </AffiliateLayout>
  );
}
