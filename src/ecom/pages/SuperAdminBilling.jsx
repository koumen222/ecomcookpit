import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, TrendingUp, Users, Crown, Zap, Clock, AlertTriangle,
  CheckCircle2, XCircle, Loader2, RefreshCw, Search, Filter,
  ArrowUpRight, ArrowDownRight, CreditCard, Calendar, Phone,
  Building2, Mail, ChevronDown, ChevronRight, Eye, Download,
  BarChart3, PieChart, Activity, Shield, AlertCircle, Timer,
  Bell, Send
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n) {
  if (n == null) return '0';
  return n.toLocaleString('fr-FR');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDatetime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}

function daysAgo(d) {
  if (!d) return null;
  return Math.floor((new Date() - new Date(d)) / 86400000);
}

// ─── Mini-chart for revenue ──────────────────────────────────────────────────

function MiniBar({ data, height = 60, color = '#059669' }) {
  if (!data || data.length < 2) return <div className="h-16 flex items-center justify-center text-xs text-slate-300">Pas de donnees</div>;
  const max = Math.max(...data.map(d => d.total), 1);
  const barW = Math.max(8, Math.floor(280 / data.length) - 4);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5" title={`${d._id}: ${fmtMoney(d.total)} FCFA (${d.count} tx)`}>
          <div
            className="rounded-sm transition-all duration-500"
            style={{ width: barW, height: Math.max(3, (d.total / max) * height), backgroundColor: color, opacity: 0.8 }}
          />
          <span className="text-[8px] text-slate-400 leading-none">{d._id?.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accent = 'emerald', trend }) {
  const styles = {
    emerald: { ring: 'ring-emerald-100', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700' },
    blue:    { ring: 'ring-blue-100',    icon: 'bg-blue-100 text-blue-600',       val: 'text-blue-700' },
    amber:   { ring: 'ring-amber-100',   icon: 'bg-amber-100 text-amber-600',    val: 'text-amber-700' },
    red:     { ring: 'ring-red-100',     icon: 'bg-red-100 text-red-600',         val: 'text-red-700' },
    violet:  { ring: 'ring-violet-100',  icon: 'bg-violet-100 text-violet-600',   val: 'text-violet-700' },
    slate:   { ring: 'ring-slate-100',   icon: 'bg-slate-100 text-slate-500',     val: 'text-slate-700' },
  }[accent];
  return (
    <div className={`bg-white rounded-2xl p-5 ring-2 ${styles.ring} hover:shadow-md transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-[11px] font-bold flex items-center gap-0.5 ${trend.up ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend.label}
          </span>
        )}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-black ${styles.val} leading-none`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    paid:    { label: 'Payé',     cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-700',   icon: Clock },
    failure: { label: 'Echoué',   cls: 'bg-red-100 text-red-700',         icon: XCircle },
    'no paid': { label: 'Non payé', cls: 'bg-slate-100 text-slate-600',   icon: XCircle },
  };
  const info = map[status] || map.pending;
  const I = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${info.cls}`}>
      <I className="w-3 h-3" />{info.label}
    </span>
  );
}

function PlanBadge({ plan }) {
  const map = {
    free:    { label: 'Gratuit',       cls: 'bg-slate-100 text-slate-600' },
    starter: { label: 'Scalor',         cls: 'bg-emerald-100 text-emerald-700' },
    pro:     { label: 'Scalor + IA',    cls: 'bg-blue-100 text-blue-700' },
    ultra:   { label: 'Scalor IA Pro',  cls: 'bg-violet-100 text-violet-700' },
  };
  const info = map[plan] || map.free;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${info.cls}`}>
      {plan === 'ultra' && <Crown className="w-3 h-3" />}
      {(plan === 'pro' || plan === 'starter') && <Zap className="w-3 h-3" />}
      {info.label}
    </span>
  );
}

function PaymentTypeBadge({ type }) {
  const map = {
    plan: { label: 'Abonnement', cls: 'bg-blue-100 text-blue-700' },
    generation: { label: 'Credits pages', cls: 'bg-violet-100 text-violet-700' },
  };
  const info = map[type] || { label: 'Paiement', cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${info.cls}`}>
      {info.label}
    </span>
  );
}

function getPaymentMetaLabel(payment) {
  if (payment.paymentType === 'generation') {
    const qty = payment.quantity || 0;
    const unitPrice = payment.pricePerGeneration || 0;
    return `${qty} credit${qty > 1 ? 's' : ''}${unitPrice ? ` · ${fmtMoney(unitPrice)} F/u` : ''}`;
  }

  return `${payment.durationMonths || 0} mois`;
}

function getPaymentTypeLabel(type) {
  if (type === 'generation') return 'Credits pages produits';
  if (type === 'plan') return 'Abonnements';
  if (type === 'starter') return 'Plan Scalor';
  if (type === 'pro') return 'Plan Scalor + IA';
  if (type === 'ultra') return 'Plan Scalor IA Pro';
  return type || 'Autre';
}

function getPaymentMethodLabel(method) {
  if (!method) return 'Non renseignee';
  const map = {
    orange: 'Orange Money',
    mtn: 'MTN Money',
    moov: 'Moov Money',
    wave: 'Wave',
    card: 'Carte',
  };
  return map[String(method).toLowerCase()] || String(method);
}

function buildDefaultEmailDraft(templateKey, workspaceName, ownerName, hoursLeft = null, planName = '') {
  const greeting = ownerName ? `Bonjour ${ownerName},` : 'Bonjour,';

  if (templateKey === 'trial_expiring') {
    return {
      subject: `Votre essai Scalor expire bientot`,
      message: `${greeting}\n\nVotre essai gratuit pour ${workspaceName} expire bientot${hoursLeft ? `, dans environ ${hoursLeft}h` : ''}.\n\nPour continuer a utiliser vos fonctionnalites et garder vos agents actifs, passez a une offre payante depuis Scalor.\n\nCordialement,\nEquipe Scalor`
    };
  }

  if (templateKey === 'trial_expired') {
    return {
      subject: `Votre essai Scalor est termine`,
      message: `${greeting}\n\nVotre essai gratuit pour ${workspaceName} est termine. Certaines fonctionnalites ont ete desactivees.\n\nVous pouvez passer a une offre payante quand vous voulez pour reactiver votre compte.\n\nCordialement,\nEquipe Scalor`
    };
  }

  return {
    subject: `Votre plan ${planName || 'Scalor'} a expire`,
    message: `${greeting}\n\nVotre abonnement ${planName || 'Scalor'} pour ${workspaceName} a expire.\n\nRenouvelez votre offre pour continuer a utiliser les fonctionnalites payantes de Scalor.\n\nCordialement,\nEquipe Scalor`
  };
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ icon: Icon, title, subtitle, color = 'from-emerald-600 to-teal-600', children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm`}>
          <Icon className="w-[18px] h-[18px] text-white" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Tab buttons ──────────────────────────────────────────────────────────────

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
            active === t.id
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}{t.count != null ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

const SuperAdminBilling = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Filters
  const [tab, setTab] = useState('overview');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPayment, setExpandedPayment] = useState(null);
  const [sendingNotif, setSendingNotif] = useState(null); // 'wsId-channel'
  const [notifSuccess, setNotifSuccess] = useState('');
  const [deactivatingTrial, setDeactivatingTrial] = useState(null); // wsId
  const [emailComposer, setEmailComposer] = useState(null);

  const handleNotify = async (workspaceId, channel, templateKey, customEmail = null) => {
    const key = `${workspaceId}-${channel}`;
    setSendingNotif(key);
    setNotifSuccess('');
    try {
      const res = await ecomApi.post('/super-admin/notify-workspace', { workspaceId, channel, templateKey, customEmail });
      if (res.data?.success) {
        setNotifSuccess(`${channel === 'email' ? 'Email' : channel === 'push' ? 'Push' : 'Email + Push'} envoyé à ${res.data.email}`);
        setTimeout(() => setNotifSuccess(''), 4000);
      } else {
        const details = res.data?.results;
        const errMsg = details?.email?.error || details?.push?.error || res.data?.message || 'Erreur envoi notification';
        setError(errMsg);
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSendingNotif(null);
    }
  };

  const openEmailComposer = (workspace, templateKey) => {
    const ownerName = workspace?.owner?.name || '';
    const planName = workspace?.plan === 'pro' ? 'Pro' : workspace?.plan === 'ultra' ? 'Ultra' : 'Scalor';
    const hoursLeft = workspace?.trialEndsAt
      ? Math.max(1, Math.round((new Date(workspace.trialEndsAt) - new Date()) / (60 * 60 * 1000)))
      : null;

    setEmailComposer({
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      recipientEmail: workspace?.owner?.email || '',
      templateKey,
      ...buildDefaultEmailDraft(templateKey, workspace.name, ownerName, hoursLeft, planName),
    });
  };

  const sendComposedEmail = async () => {
    if (!emailComposer?.subject?.trim() || !emailComposer?.message?.trim()) {
      setError('Sujet et message requis');
      return;
    }

    await handleNotify(emailComposer.workspaceId, 'email', emailComposer.templateKey, {
      subject: emailComposer.subject,
      message: emailComposer.message,
    });
    setEmailComposer(null);
  };

  const handleDeactivateTrial = async (workspaceId, workspaceName) => {
    if (!confirm(`Êtes-vous sûr de vouloir désactiver l'essai gratuit de "${workspaceName}" ?\n\nCette action réinitialisera complètement l'essai.`)) {
      return;
    }
    
    setDeactivatingTrial(workspaceId);
    setNotifSuccess('');
    try {
      const res = await ecomApi.post('/super-admin/deactivate-trial', { workspaceId });
      if (res.data?.success) {
        setNotifSuccess(`✅ Essai désactivé pour ${workspaceName}`);
        setTimeout(() => setNotifSuccess(''), 4000);
        // Rafraîchir les données
        fetchData(true);
      } else {
        setError(res.data?.message || 'Erreur lors de la désactivation');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setDeactivatingTrial(null);
    }
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await ecomApi.get('/super-admin/billing', { params: { limit: 200 } });
      setData(res.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  // ─── Derived data ──────────────────────────────────────────────────────────

  const revenue = data?.revenue || {};
  const paymentsByType = data?.paymentsByType || [];
  const paymentMethods = data?.paymentMethods || [];
  const revenueByTypeMap = useMemo(() => {
    const entries = {};
    (revenue.byType || []).forEach(item => {
      entries[item._id] = item;
    });
    return entries;
  }, [revenue.byType]);
  const statusMap = useMemo(() => {
    const m = {};
    (data?.statusBreakdown || []).forEach(s => { m[s._id] = s; });
    return m;
  }, [data]);

  const planMap = useMemo(() => {
    const m = {};
    (data?.planDistribution || []).forEach(p => { m[p._id] = p.count; });
    return m;
  }, [data]);

  const filteredPayments = useMemo(() => {
    let list = data?.payments || [];
    if (paymentFilter !== 'all') {
      list = list.filter(p => p.status === paymentFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p =>
        (p.userId?.email || '').toLowerCase().includes(q) ||
        (p.userId?.name || '').toLowerCase().includes(q) ||
        (p.workspaceId?.name || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q) ||
        (p.clientName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, paymentFilter, searchTerm]);

  const filteredWorkspaces = useMemo(() => {
    let list = data?.workspaces || [];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(w =>
        (w.name || '').toLowerCase().includes(q) ||
        (w.owner?.email || '').toLowerCase().includes(q) ||
        (w.owner?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, searchTerm]);

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-emerald-700 animate-spin" />
          <p className="text-sm text-slate-600 font-semibold">Chargement des donnees facturation...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-sm text-slate-600">{error || 'Impossible de charger les donnees'}</p>
          <button onClick={() => fetchData()} className="text-sm font-bold text-emerald-600 hover:underline">Reessayer</button>
        </div>
      </div>
    );
  }

  const totalWs = (data.workspaces || []).length;
  const proCount = planMap.pro || 0;
  const ultraCount = planMap.ultra || 0;
  const freeCount = planMap.free || 0;
  const conversionRate = totalWs > 0 ? Math.round(((proCount + ultraCount) / totalWs) * 100) : 0;

  // Free plan workspaces count as "essais"
  const freeWorkspaces = (data.workspaces || []).filter(w => w.plan === 'free');
  const trialWorkspaces = data.activeTrials || [];
  const expiredTrials = data.expiredTrials || [];
  const totalEssais = trialWorkspaces.length + freeWorkspaces.length + expiredTrials.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">

        {/* Error toast */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-sm text-red-800 shadow-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Suivi Facturation</h1>
              <p className="text-sm text-slate-500">Paiements, abonnements et revenus en temps reel</p>
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white ring-2 ring-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:ring-emerald-300 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <KpiCard
            icon={DollarSign}
            label="Revenu total"
            value={`${fmtMoney(revenue.total)} F`}
            sub={`${revenue.paidCount || 0} paiement${(revenue.paidCount || 0) > 1 ? 's' : ''} confirmes · ${revenueByTypeMap.generation?.count || 0} achat${(revenueByTypeMap.generation?.count || 0) > 1 ? 's' : ''} credits`}
            accent="emerald"
          />
          <KpiCard
            icon={TrendingUp}
            label="Revenu 30j"
            value={`${fmtMoney(revenue.last30d?.total)} F`}
            sub={`${revenue.last30d?.count || 0} transactions`}
            accent="blue"
          />
          <KpiCard
            icon={CreditCard}
            label="Panier moyen"
            value={`${fmtMoney(revenue.avgAmount)} F`}
            sub="par transaction"
            accent="violet"
          />
          <KpiCard
            icon={Shield}
            label="Abonnes actifs"
            value={data.activeSubscriptions || 0}
            sub={`${proCount} Pro · ${ultraCount} Ultra (total)`}
            accent="emerald"
          />
          <KpiCard
            icon={Timer}
            label="Essais actifs"
            value={totalEssais}
            sub={`${freeWorkspaces.length} gratuit${freeWorkspaces.length > 1 ? 's' : ''} + ${trialWorkspaces.length} trial + ${expiredTrials.length} expirés`}
            accent="amber"
          />
          <KpiCard
            icon={Activity}
            label="Taux conversion"
            value={`${conversionRate}%`}
            sub={`${proCount + ultraCount}/${totalWs} workspaces`}
            accent={conversionRate > 10 ? 'emerald' : 'red'}
          />
        </div>

        {/* ── TABS ─────────────────────────────────────────────────────────── */}
        <Tabs
          tabs={[
            { id: 'overview', label: 'Vue globale' },
            { id: 'payments', label: 'Paiements', count: data.totalPayments },
            { id: 'subscriptions', label: 'Abonnements', count: data.activeSubscriptions },
            { id: 'trials', label: 'Essais', count: totalEssais },
            { id: 'workspaces', label: 'Tous les workspaces', count: totalWs },
          ]}
          active={tab}
          onChange={setTab}
        />

        {/* ── SEARCH BAR ───────────────────────────────────────────────────── */}
        {tab !== 'overview' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, telephone, workspace..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white ring-2 ring-slate-200 rounded-xl text-sm focus:ring-emerald-300 focus:outline-none transition-all"
            />
          </div>
        )}

        {/* ═══ TAB: OVERVIEW ═══════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <div className="space-y-6">

            {/* Revenue chart + plan distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue by month */}
              <div className="lg:col-span-2 bg-white rounded-2xl ring-2 ring-slate-100 p-6">
                <SectionHead icon={BarChart3} title="Revenu mensuel" subtitle="12 derniers mois" color="from-emerald-600 to-teal-600" />
                <MiniBar data={revenue.byMonth || []} height={55} />
              </div>

              {/* Plan distribution */}
              <div className="bg-white rounded-2xl ring-2 ring-slate-100 p-6">
                <SectionHead icon={PieChart} title="Repartition plans" color="from-violet-600 to-purple-600" />
                <div className="space-y-3 mt-4">
                  {[
                    { plan: 'free', label: 'Gratuit', count: freeCount, color: 'bg-slate-400' },
                    { plan: 'pro', label: 'Pro', count: proCount, color: 'bg-blue-500' },
                    { plan: 'ultra', label: 'Ultra', count: ultraCount, color: 'bg-violet-500' },
                  ].map(p => (
                    <div key={p.plan} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${p.color}`} />
                      <span className="text-sm font-semibold text-slate-700 flex-1">{p.label}</span>
                      <span className="text-sm font-black text-slate-800">{p.count}</span>
                      <span className="text-[11px] text-slate-400 w-12 text-right">
                        {totalWs > 0 ? Math.round((p.count / totalWs) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                  <div className="w-full h-3 rounded-full overflow-hidden bg-slate-100 flex mt-2">
                    {totalWs > 0 && (
                      <>
                        <div className="bg-slate-400 h-full transition-all" style={{ width: `${(freeCount / totalWs) * 100}%` }} />
                        <div className="bg-blue-500 h-full transition-all" style={{ width: `${(proCount / totalWs) * 100}%` }} />
                        <div className="bg-violet-500 h-full transition-all" style={{ width: `${(ultraCount / totalWs) * 100}%` }} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment status breakdown */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { status: 'paid', label: 'Payes', accent: 'emerald', icon: CheckCircle2 },
                { status: 'pending', label: 'En attente', accent: 'amber', icon: Clock },
                { status: 'failure', label: 'Echoues', accent: 'red', icon: XCircle },
                { status: 'no paid', label: 'Non payes', accent: 'slate', icon: XCircle },
              ].map(s => {
                const info = statusMap[s.status] || { count: 0, total: 0 };
                return (
                  <KpiCard
                    key={s.status}
                    icon={s.icon}
                    label={s.label}
                    value={info.count || 0}
                    sub={`${fmtMoney(info.total || 0)} F`}
                    accent={s.accent}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl ring-2 ring-slate-100 p-6">
                <SectionHead icon={CreditCard} title="Flux de paiements Scalor" subtitle="Tous les achats suivis dans la plateforme" color="from-slate-700 to-slate-900" />
                <div className="space-y-4 mt-4">
                  {paymentsByType.map(item => (
                    <div key={item._id} className="flex items-center gap-4">
                      {item._id === 'plan' || item._id === 'generation' ? (
                        <PaymentTypeBadge type={item._id} />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {getPaymentTypeLabel(item._id)}
                        </span>
                      )}
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-bold text-slate-700">{getPaymentTypeLabel(item._id)}</span>
                          <span className="text-lg font-black text-slate-800">{item.count}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
                          <span>{fmtMoney(item.total)} F engages</span>
                          <span>{data.totalPayments > 0 ? Math.round((item.count / data.totalPayments) * 100) : 0}% des paiements</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {paymentsByType.length === 0 && (
                    <p className="text-sm text-slate-400 italic">Aucun paiement enregistre</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl ring-2 ring-slate-100 p-6">
                <SectionHead icon={Phone} title="Methodes encaissees" subtitle="Paiements confirmes par canal de collecte" color="from-emerald-600 to-teal-600" />
                <div className="space-y-4 mt-4">
                  {paymentMethods.map(method => (
                    <div key={method._id} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{getPaymentMethodLabel(method._id)}</p>
                        <p className="text-xs text-slate-400">{method.count} transaction{method.count > 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-lg font-black text-emerald-700">{fmtMoney(method.total)} F</span>
                    </div>
                  ))}
                  {paymentMethods.length === 0 && (
                    <p className="text-sm text-slate-400 italic">Aucune methode payee enregistree pour le moment</p>
                  )}
                </div>
              </div>
            </div>

            {/* Notification success toast */}
            {notifSuccess && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                {notifSuccess}
              </div>
            )}

            {/* Expiring soon + Revenue by offer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expiring soon (paid plans + active trials) */}
              <div className="bg-white rounded-2xl ring-2 ring-orange-100 p-6">
                <SectionHead icon={AlertTriangle} title="Expirent bientôt" subtitle="Abonnements & essais" color="from-orange-500 to-amber-500" />
                {(() => {
                  const paidExpiring = (data.expiringSoon || []).map(ws => ({ ...ws, _kind: 'plan' }));
                  const trialsExpiring = trialWorkspaces.map(ws => ({ ...ws, _kind: 'trial' }));
                  const allExpiring = [...trialsExpiring, ...paidExpiring];
                  if (allExpiring.length === 0) {
                    return <p className="text-sm text-slate-400 italic mt-4">Aucun abonnement ou essai n'expire bientôt</p>;
                  }
                  return (
                    <div className="space-y-2 mt-4 max-h-[400px] overflow-y-auto">
                      {allExpiring.map(ws => {
                        const isTrial = ws._kind === 'trial';
                        const days = isTrial ? daysUntil(ws.trialEndsAt) : daysUntil(ws.planExpiresAt);
                        const tplKey = isTrial ? (days <= 0 ? 'trial_expired' : 'trial_expiring') : 'plan_expired';
                        return (
                          <div key={ws._id} className={`p-3 rounded-xl border ${isTrial ? 'bg-amber-50/50 border-amber-200' : 'bg-orange-50/50 border-orange-100'}`}>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{ws.name}</p>
                                <p className="text-[11px] text-slate-500">{ws.owner?.email}</p>
                              </div>
                              {isTrial ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">Essai</span>
                              ) : (
                                <PlanBadge plan={ws.plan} />
                              )}
                              <span className={`text-xs font-bold ${days <= 1 ? 'text-red-600' : 'text-orange-600'}`}>
                                {days}j
                              </span>
                            </div>
                            {/* Notify actions */}
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => openEmailComposer(ws, tplKey)}
                                disabled={sendingNotif === `${ws._id}-email`}
                                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                              >
                                <Mail className="w-3 h-3" />
                                Email
                              </button>
                              <button
                                onClick={() => handleNotify(ws._id, 'push', tplKey)}
                                disabled={sendingNotif === `${ws._id}-push`}
                                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
                              >
                                {sendingNotif === `${ws._id}-push` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                                Push
                              </button>
                              <button
                                onClick={() => handleNotify(ws._id, 'both', tplKey)}
                                disabled={sendingNotif === `${ws._id}-both`}
                                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                              >
                                {sendingNotif === `${ws._id}-both` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                Les 2
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Revenue by offer */}
              <div className="bg-white rounded-2xl ring-2 ring-slate-100 p-6">
                <SectionHead icon={DollarSign} title="Revenu par offre" subtitle="Plans et credits pages produits" color="from-blue-600 to-indigo-600" />
                <div className="space-y-4 mt-4">
                  {(revenue.byType || []).map(p => (
                    <div key={p._id} className="flex items-center gap-4">
                      {['starter', 'pro', 'ultra', 'free'].includes(p._id) ? <PlanBadge plan={p._id} /> : <PaymentTypeBadge type={p._id} />}
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{getPaymentTypeLabel(p._id)}</p>
                            <span className="text-lg font-black text-slate-800">{fmtMoney(p.total)} F</span>
                          </div>
                          <span className="text-xs text-slate-400">{p.count} tx</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 mt-1">
                          <div
                            className={`h-full rounded-full transition-all ${p._id === 'ultra' ? 'bg-violet-500' : p._id === 'generation' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${revenue.total > 0 ? (p.total / revenue.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(revenue.byType || []).length === 0 && (
                    <p className="text-sm text-slate-400 italic">Aucun revenu enregistre</p>
                  )}
                </div>
              </div>
            </div>

            {/* Expired paid plans */}
            {(data.expiredPaid || []).length > 0 && (
              <div className="bg-white rounded-2xl ring-2 ring-red-100 p-6">
                <SectionHead icon={AlertCircle} title="Plans expires" subtitle={`${data.expiredPaid.length} workspace(s) avec plan expire`} color="from-red-500 to-rose-500" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                  {(data.expiredPaid || []).map(ws => (
                    <div key={ws._id} className="flex items-center gap-3 p-3 rounded-xl bg-red-50/50 border border-red-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{ws.name}</p>
                        <p className="text-[11px] text-slate-500">{ws.owner?.email}</p>
                      </div>
                      <PlanBadge plan={ws.plan} />
                      <span className="text-[11px] text-red-500 font-bold">
                        Expire {fmtDate(ws.planExpiresAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: PAYMENTS ═══════════════════════════════════════════════ */}
        {tab === 'payments' && (
          <div className="space-y-4">
            {/* Status filter */}
            <Tabs
              tabs={[
                { id: 'all', label: 'Tous', count: data.totalPayments },
                { id: 'paid', label: 'Payes', count: statusMap.paid?.count || 0 },
                { id: 'pending', label: 'En attente', count: statusMap.pending?.count || 0 },
                { id: 'failure', label: 'Echoues', count: (statusMap.failure?.count || 0) + (statusMap['no paid']?.count || 0) },
              ]}
              active={paymentFilter}
              onChange={setPaymentFilter}
            />

            {/* Payments table */}
            <div className="bg-white rounded-2xl ring-2 ring-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Utilisateur</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Workspace</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Offre</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Montant</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Statut</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Telephone</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Aucun paiement trouve</td></tr>
                    ) : filteredPayments.map(p => (
                      <React.Fragment key={p._id}>
                        <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-bold text-slate-800 truncate max-w-[160px]">{p.clientName || p.userId?.name || '—'}</p>
                              <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{p.userId?.email || '—'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-700 truncate max-w-[120px]">{p.workspaceId?.name || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <PaymentTypeBadge type={p.paymentType} />
                              <div className="flex flex-wrap items-center gap-1.5">
                                {p.paymentType === 'plan' ? (
                                  <>
                                    <PlanBadge plan={p.plan} />
                                    <span className="text-[10px] text-slate-400">{p.durationMonths}m</span>
                                  </>
                                ) : (
                                  <span className="text-xs font-semibold text-slate-700">{getPaymentMetaLabel(p)}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-black text-slate-800">{fmtMoney(p.amount)} F</span>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                          <td className="px-4 py-3">
                            <span className="text-slate-600">{p.phone || '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-500 text-[12px]">{fmtDatetime(p.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedPayment(expandedPayment === p._id ? null : p._id)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                            >
                              {expandedPayment === p._id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                        {expandedPayment === p._id && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <p className="text-slate-400 font-semibold mb-1">Token MF</p>
                                  <p className="text-slate-700 font-mono text-[11px] break-all">{p.mfToken || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-semibold mb-1">N Transaction</p>
                                  <p className="text-slate-700">{p.transactionNumber || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-semibold mb-1">Methode</p>
                                  <p className="text-slate-700">{p.paymentMethod || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-semibold mb-1">Frais</p>
                                  <p className="text-slate-700">{fmtMoney(p.fees || 0)} F</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-semibold mb-1">Type</p>
                                  <div><PaymentTypeBadge type={p.paymentType} /></div>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-semibold mb-1">Applique le</p>
                                  <p className="text-slate-700">{fmtDatetime(p.appliedAt)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-semibold mb-1">Detail achat</p>
                                  <p className="text-slate-700">{getPaymentMetaLabel(p)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-semibold mb-1">Workspace plan actuel</p>
                                  <p>{p.workspaceId ? <PlanBadge plan={p.workspaceId.plan} /> : '—'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-semibold mb-1">Expire le</p>
                                  <p className="text-slate-700">{fmtDate(p.workspaceId?.planExpiresAt)}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: SUBSCRIPTIONS ══════════════════════════════════════════ */}
        {tab === 'subscriptions' && (
          <div className="space-y-4">
            <SectionHead icon={Crown} title="Abonnements actifs" subtitle={`${data.activeSubscriptions} abonnement(s) en cours`} color="from-blue-600 to-indigo-600" />

            <div className="bg-white rounded-2xl ring-2 ring-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Workspace</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Proprietaire</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Plan</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Expire le</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Jours restants</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkspaces
                      .filter(w => (w.plan === 'starter' || w.plan === 'pro' || w.plan === 'ultra') && w.planExpiresAt && new Date(w.planExpiresAt) > new Date())
                      .map(ws => {
                        const days = daysUntil(ws.planExpiresAt);
                        return (
                          <tr key={ws._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800">{ws.name}</p>
                              <p className="text-[11px] text-slate-400">{ws.slug}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-700">{ws.owner?.name || '—'}</p>
                              <p className="text-[11px] text-slate-400">{ws.owner?.email || '—'}</p>
                            </td>
                            <td className="px-4 py-3"><PlanBadge plan={ws.plan} /></td>
                            <td className="px-4 py-3">
                              <span className="text-slate-600">{fmtDate(ws.planExpiresAt)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-sm font-black ${days <= 3 ? 'text-red-600' : days <= 7 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                {days}j
                              </span>
                              {days <= 7 && (
                                <span className="ml-2 text-[10px] text-orange-500 font-bold">BIENTOT</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {ws.owner?.phone && (
                                <span className="text-slate-600 text-xs">{ws.owner.phone}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: TRIALS ═════════════════════════════════════════════════ */}
        {tab === 'trials' && (
          <div className="space-y-6">
            <SectionHead icon={Timer} title="Essais & Comptes gratuits" subtitle={`${totalEssais} compte(s) en essai ou plan gratuit`} color="from-amber-500 to-orange-500" />

            {/* Free plan accounts */}
            {freeWorkspaces.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">Gratuit</span>
                  {freeWorkspaces.length} compte{freeWorkspaces.length > 1 ? 's' : ''} gratuit{freeWorkspaces.length > 1 ? 's' : ''}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {freeWorkspaces.map(ws => (
                    <div key={ws._id} className="bg-white rounded-2xl ring-2 ring-slate-100 p-5 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate">{ws.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{ws.owner?.email}</p>
                        </div>
                        <PlanBadge plan="free" />
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Inscrit le {fmtDate(ws.createdAt)}
                        {ws.owner?.phone && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                            <Phone className="w-3 h-3" />
                            {ws.owner.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notification success toast */}
            {notifSuccess && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                {notifSuccess}
              </div>
            )}

            {/* Active trial period accounts */}
            {trialWorkspaces.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">Trial</span>
                  {trialWorkspaces.length} essai{trialWorkspaces.length > 1 ? 's' : ''} en cours
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trialWorkspaces.map(ws => {
                    const daysLeft = daysUntil(ws.trialEndsAt);
                    const totalDays = 3;
                    const elapsed = totalDays - (daysLeft || 0);
                    const pct = Math.min(100, Math.round((elapsed / totalDays) * 100));
                    const tplKey = daysLeft <= 0 ? 'trial_expired' : 'trial_expiring';
                    return (
                      <div key={ws._id} className="bg-white rounded-2xl ring-2 ring-amber-100 p-5 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-slate-800">{ws.name}</p>
                            <p className="text-[11px] text-slate-400">{ws.owner?.email}</p>
                          </div>
                          <span className={`text-lg font-black ${daysLeft <= 1 ? 'text-red-600' : 'text-amber-600'}`}>
                            {daysLeft}j
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Debut: {fmtDate(ws.trialStartedAt)}</span>
                            <span className="text-slate-400">Fin: {fmtDate(ws.trialEndsAt)}</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all ${daysLeft <= 1 ? 'bg-red-500' : 'bg-amber-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {ws.owner?.phone && (
                          <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500">
                            <Phone className="w-3 h-3" />
                            {ws.owner.phone}
                          </div>
                        )}

                        {/* Notify actions */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => openEmailComposer(ws, tplKey)}
                            disabled={sendingNotif === `${ws._id}-email`}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                          >
                            <Mail className="w-3 h-3" />
                            Email
                          </button>
                          <button
                            onClick={() => handleNotify(ws._id, 'push', tplKey)}
                            disabled={sendingNotif === `${ws._id}-push`}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
                          >
                            {sendingNotif === `${ws._id}-push` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                            Push
                          </button>
                          <button
                            onClick={() => handleNotify(ws._id, 'both', tplKey)}
                            disabled={sendingNotif === `${ws._id}-both`}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            {sendingNotif === `${ws._id}-both` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Les 2
                          </button>
                          <button
                            onClick={() => handleDeactivateTrial(ws._id, ws.name)}
                            disabled={deactivatingTrial === ws._id}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 ml-auto"
                            title="Désactiver l'essai gratuit"
                          >
                            {deactivatingTrial === ws._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                            Désactiver
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expired trial accounts */}
            {expiredTrials.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">Expiré</span>
                  {expiredTrials.length} essai{expiredTrials.length > 1 ? 's' : ''} expiré{expiredTrials.length > 1 ? 's' : ''}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {expiredTrials.map(ws => {
                    const daysExpired = Math.abs(daysUntil(ws.trialEndsAt) || 0);
                    return (
                      <div key={ws._id} className="bg-white rounded-2xl ring-2 ring-red-100 p-5 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 truncate">{ws.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{ws.owner?.email}</p>
                          </div>
                          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                            -{daysExpired}j
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-400">
                          <div className="flex justify-between">
                            <span>Debut: {fmtDate(ws.trialStartedAt)}</span>
                            <span>Fin: {fmtDate(ws.trialEndsAt)}</span>
                          </div>
                          {ws.trialExpiredNotifiedAt && (
                            <div className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              Notifié le {fmtDatetime(ws.trialExpiredNotifiedAt)}
                            </div>
                          )}
                          {!ws.trialExpiredNotifiedAt && ws.trialExpiryNotifiedAt && (
                            <div className="flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="w-3 h-3" />
                              Avertissement envoyé le {fmtDatetime(ws.trialExpiryNotifiedAt)}
                            </div>
                          )}
                        </div>

                        {ws.owner?.phone && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                            <Phone className="w-3 h-3" />
                            {ws.owner.phone}
                          </div>
                        )}

                        {/* Notify actions */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => openEmailComposer(ws, 'trial_expired')}
                            disabled={sendingNotif === `${ws._id}-email`}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                          >
                            <Mail className="w-3 h-3" />
                            Email
                          </button>
                          <button
                            onClick={() => handleNotify(ws._id, 'push', 'trial_expired')}
                            disabled={sendingNotif === `${ws._id}-push`}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
                          >
                            {sendingNotif === `${ws._id}-push` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                            Push
                          </button>
                          <button
                            onClick={() => handleNotify(ws._id, 'both', 'trial_expired')}
                            disabled={sendingNotif === `${ws._id}-both`}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            {sendingNotif === `${ws._id}-both` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Les 2
                          </button>
                          <button
                            onClick={() => handleDeactivateTrial(ws._id, ws.name)}
                            disabled={deactivatingTrial === ws._id}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 ml-auto"
                            title="Réinitialiser l'essai"
                          >
                            {deactivatingTrial === ws._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                            Réinitialiser
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {totalEssais === 0 && (
              <div className="bg-white rounded-2xl ring-2 ring-slate-100 p-12 text-center">
                <Timer className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Aucun compte gratuit ou essai en cours</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: ALL WORKSPACES ═════════════════════════════════════════ */}
        {tab === 'workspaces' && (
          <div className="space-y-4">
            <SectionHead icon={Building2} title="Tous les workspaces" subtitle={`${totalWs} workspace(s) enregistre(s)`} color="from-slate-600 to-slate-800" />

            <div className="bg-white rounded-2xl ring-2 ring-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Workspace</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Proprietaire</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Plan</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Statut</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Expiration</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Essai</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Inscription</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkspaces.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Aucun workspace trouve</td></tr>
                    ) : filteredWorkspaces.map(ws => {
                      const isPaid = ws.plan === 'starter' || ws.plan === 'pro' || ws.plan === 'ultra';
                      const isExpired = isPaid && ws.planExpiresAt && new Date(ws.planExpiresAt) <= new Date();
                      const isActive = isPaid && !isExpired;
                      const isTrial = ws.trialEndsAt && new Date(ws.trialEndsAt) > new Date() && !ws.trialUsed;
                      const days = daysUntil(ws.planExpiresAt);

                      return (
                        <tr key={ws._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800">{ws.name}</p>
                            <p className="text-[11px] text-slate-400">{ws.slug}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-700">{ws.owner?.name || '—'}</p>
                            <p className="text-[11px] text-slate-400">{ws.owner?.email}</p>
                            {ws.owner?.phone && <p className="text-[11px] text-slate-400">{ws.owner.phone}</p>}
                          </td>
                          <td className="px-4 py-3"><PlanBadge plan={ws.plan} /></td>
                          <td className="px-4 py-3">
                            {isActive && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" />Actif
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                                <XCircle className="w-3 h-3" />Expire
                              </span>
                            )}
                            {!isPaid && !isTrial && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                                Gratuit
                              </span>
                            )}
                            {isTrial && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                                <Clock className="w-3 h-3" />Essai
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isPaid ? (
                              <div>
                                <span className="text-slate-600 text-xs">{fmtDate(ws.planExpiresAt)}</span>
                                {days != null && (
                                  <span className={`ml-2 text-[11px] font-bold ${isExpired ? 'text-red-500' : days <= 7 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                    {isExpired ? `Expire il y a ${Math.abs(days)}j` : `${days}j`}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {ws.trialUsed ? (
                              <span className="text-[11px] text-slate-400">Utilise</span>
                            ) : ws.trialEndsAt ? (
                              <span className="text-[11px] text-amber-600 font-bold">{daysUntil(ws.trialEndsAt)}j restants</span>
                            ) : (
                              <span className="text-[11px] text-slate-300">Non utilise</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-500 text-xs">{fmtDate(ws.createdAt)}</span>
                            <span className="text-[11px] text-slate-400 ml-1">({daysAgo(ws.createdAt)}j)</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {emailComposer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl ring-1 ring-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Rédiger l’email</h3>
                <p className="text-sm text-slate-500 mt-1">Destinataire: {emailComposer.recipientEmail || '—'} · Workspace: {emailComposer.workspaceName}</p>
              </div>
              <button
                onClick={() => setEmailComposer(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
              >
                Fermer
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Sujet</label>
                <input
                  type="text"
                  value={emailComposer.subject}
                  onChange={(e) => setEmailComposer((prev) => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-4 py-3 bg-white ring-2 ring-slate-200 rounded-xl text-sm focus:ring-emerald-300 focus:outline-none transition-all"
                  placeholder="Sujet de l'email"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Message</label>
                <textarea
                  value={emailComposer.message}
                  onChange={(e) => setEmailComposer((prev) => ({ ...prev, message: e.target.value }))}
                  className="w-full min-h-[260px] px-4 py-3 bg-white ring-2 ring-slate-200 rounded-xl text-sm focus:ring-emerald-300 focus:outline-none transition-all resize-y"
                  placeholder="Tapez votre email ici, sans HTML"
                />
                <p className="text-xs text-slate-400 mt-2">Saisissez un texte simple. Scalor mettra automatiquement le message en forme dans l’email.</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setEmailComposer(null)}
                className="px-4 py-2 rounded-xl bg-white ring-2 ring-slate-200 text-slate-700 text-sm font-bold hover:ring-slate-300 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={sendComposedEmail}
                disabled={sendingNotif === `${emailComposer.workspaceId}-email`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {sendingNotif === `${emailComposer.workspaceId}-email` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Envoyer l’email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminBilling;
