import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import {
  affiliatePortalApi,
  affiliateTrackingUrl,
  clearAffiliateToken,
  getAffiliateToken
} from '../services/affiliatePortalApi.js';
import AffiliateLayout from '../components/AffiliateLayout.jsx';

const fmt = (n) => (n || 0).toLocaleString('fr-FR');

// Palette validée (CVD-safe sur fond clair) : bleu / ambre / teal
const SERIES_COLORS = {
  visits: '#2563EB',
  clicks: '#D97706',
  signups: '#0D9488',
  commissions: '#0D9488'
};

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

const PERIODS = [
  { days: 7, label: '7 j' },
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
];

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

const KpiCard = ({ label, value, suffix = '', accent = 'text-gray-900', sub = null }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
    <p className={`text-2xl font-bold ${accent}`}><AnimatedCounter value={value} />{suffix}</p>
    <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">{label}</p>
    {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
  </div>
);

const FunnelStep = ({ label, value, rate, isLast }) => (
  <div className="flex items-center gap-2 min-w-0">
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center flex-shrink-0">
      <p className="text-xl font-bold text-gray-900">{fmt(value)}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
    </div>
    {!isLast && (
      <div className="flex flex-col items-center px-1 flex-shrink-0">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        {rate !== null && <span className="text-[10px] text-gray-500 font-medium">{rate}%</span>}
      </div>
    )}
  </div>
);

const chartTooltipStyle = {
  fontSize: 12,
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
};

export default function AffiliateDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [affiliate, setAffiliate] = useState(null);
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);
  const [links, setLinks] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [days, setDays] = useState(30);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (periodDays) => {
    const token = getAffiliateToken();
    if (!token) { navigate('/affiliate/login'); return; }
    setLoading(true);
    setError('');
    try {
      const [me, s, ts, l, r, c] = await Promise.all([
        affiliatePortalApi.me(),
        affiliatePortalApi.getStatsSummary({ days: periodDays }),
        affiliatePortalApi.getStatsTimeseries({ days: periodDays }),
        affiliatePortalApi.getLinks(),
        affiliatePortalApi.getReferrals(),
        affiliatePortalApi.getConversions({ page: 1, limit: 20 })
      ]);
      setAffiliate(me.data?.data?.affiliate || null);
      setSummary(s.data?.data || null);
      setSeries(ts.data?.data?.series || []);
      setLinks(l.data?.data?.links || []);
      setReferrals(r.data?.data?.referrals || []);
      setConversions(c.data?.data?.items || []);
    } catch (err) {
      if (err.response?.status === 401) { clearAffiliateToken(); navigate('/affiliate/login'); return; }
      setError(err.response?.data?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(days); }, [load, days]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = (url) => {
    const msg = encodeURIComponent(`Rejoins Scalor, le SaaS e-commerce africain ! Inscris-toi avec mon lien et lance ton business : ${url}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  // Lien principal : URL de tracking /r/ du premier lien actif
  const mainLink = links.find((l) => l.isActive) || links[0] || null;
  const referralUrl = mainLink ? affiliateTrackingUrl(mainLink.code) : '';

  const funnel = summary?.funnel || {};
  const balance = summary?.balance || {};
  const lifetime = summary?.lifetime || {};
  const program = summary?.program || {};

  const chartData = series.map((d) => ({
    ...d,
    label: d.date?.slice(5) // MM-DD
  }));

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

        {/* Header avec lien de parrainage tracké */}
        <div className="bg-gradient-to-r from-[#0F6B4F] to-[#0a5040] rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <div>
                <h1 className="text-xl font-bold">Bienvenue, {affiliate?.name || 'Affilié'}</h1>
                <p className="text-sm text-white/70 mt-0.5">Votre lien tracké (visites, clics et conversions attribués pendant {program.attributionWindowDays || 60} jours)</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-white/10 rounded-full border border-white/20 self-start">
                Code {affiliate?.referralCode || '—'}
              </span>
            </div>
            {referralUrl ? (
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
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                  <button
                    onClick={() => shareWhatsApp(referralUrl)}
                    className="px-4 py-3 rounded-xl font-semibold text-sm bg-[#25D366] hover:bg-[#20BD5A] text-white transition-all duration-200"
                  >
                    WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/80">Créez votre premier lien dans l'onglet <Link to="/affiliate/links" className="underline font-semibold">Mes liens</Link>.</p>
            )}
          </div>
        </div>

        {/* Sélecteur de période */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Performance des {days} derniers jours</h2>
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  days === p.days ? 'bg-[#0F6B4F] text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Funnel */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-3">Funnel de conversion</p>
          <div className="flex items-center gap-2">
            <FunnelStep label="Clics" value={funnel.clicks} rate={null} />
            <FunnelStep label="Visites" value={funnel.visits} rate={null} />
            <FunnelStep label="Visiteurs uniques" value={funnel.uniqueVisitors} rate={funnel.clickToSignupRate} />
            <FunnelStep label="Inscriptions" value={funnel.signups} rate={funnel.signupToPaymentRate} />
            <FunnelStep label="Paiements" value={funnel.payments} isLast rate={null} />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Solde disponible (FCFA)" value={balance.available} accent="text-[#0F6B4F]" sub={`Retrait dès ${fmt(balance.minPayoutAmount)} F`} />
          <KpiCard label="Commissions période (FCFA)" value={funnel.periodCommissions} />
          <KpiCard label="CA généré période (FCFA)" value={funnel.revenue} />
          <KpiCard label="Commissions payées (FCFA)" value={lifetime.paidCommissions} />
        </div>

        {/* Graphique trafic & inscriptions */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Visites, clics et inscriptions par jour</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="visits" name="Visites" stroke={SERIES_COLORS.visits} fill={SERIES_COLORS.visits} fillOpacity={0.08} strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="clicks" name="Clics" stroke={SERIES_COLORS.clicks} fill={SERIES_COLORS.clicks} fillOpacity={0.08} strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="signups" name="Inscriptions" stroke={SERIES_COLORS.signups} fill={SERIES_COLORS.signups} fillOpacity={0.12} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique commissions (FCFA — axe séparé, jamais de double axe) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Commissions par jour (FCFA)</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${fmt(v)} F`, 'Commissions']} />
                <Bar dataKey="commissions" name="Commissions" fill={SERIES_COLORS.commissions} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filleuls */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Mes filleuls</h3>
            <span className="text-xs text-gray-500">{referrals.length} inscrit{referrals.length > 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Filleul</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Inscrit le</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Paiements</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">CA généré</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Mes commissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900">{r.name || '—'}</p>
                      <p className="text-xs text-gray-500 font-mono">{r.email}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{new Date(r.signedUpAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-5 py-3 text-sm text-right text-gray-900">{fmt(r.payments)}</td>
                    <td className="px-5 py-3 text-sm text-right text-gray-900">{fmt(r.revenue)} F</td>
                    <td className="px-5 py-3 text-sm text-right font-bold text-[#0F6B4F]">+{fmt(r.commissions)} F</td>
                  </tr>
                ))}
                {referrals.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">Aucun filleul pour le moment. Partagez votre lien pour commencer.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dernières commissions */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Dernières commissions</h3>
            <Link to="/affiliate/commissions" className="text-xs font-semibold text-[#0F6B4F] hover:underline">Tout voir + retraits →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {conversions.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-5 py-3 text-sm text-gray-900 font-medium">
                      {c.conversionType === 'signup' ? `Inscription (+${fmt(c.commissionAmount)} F)` : `Paiement abonnement (${c.commissionValue}%)`}
                    </td>
                    <td className="px-5 py-3 text-sm text-right font-bold text-[#0F6B4F]">+{fmt(c.commissionAmount)} F</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {conversions.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-500">Aucune commission pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Règles du programme (valeurs réelles de la config) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Règles du programme</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary-50 border border-primary-100">
              <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Inscription d'un filleul</p>
                <p className="text-xs text-[#0F6B4F] font-semibold">+{fmt(program.signupBonusAmount)} FCFA</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Chaque paiement d'abonnement</p>
                <p className="text-xs text-[#0F6B4F] font-semibold">{program.paymentCommissionPercent}% à vie</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Attribution last-click</p>
                <p className="text-xs text-[#0F6B4F] font-semibold">{program.attributionWindowDays} jours</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Retrait minimum : <span className="text-[#0F6B4F] font-bold">{fmt(balance.minPayoutAmount)} FCFA</span> — Orange Money, MTN MoMo ou virement, depuis l'onglet <Link to="/affiliate/commissions" className="underline">Commissions</Link>.</p>
        </div>
      </div>
    </AffiliateLayout>
  );
}
