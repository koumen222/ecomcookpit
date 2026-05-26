import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2, Users, CheckCircle2, XCircle, Copy, Calendar,
  Mail, Power, PowerOff, AlertCircle, Search, Bell, BellOff,
  Crown, Zap, RefreshCw, TrendingUp, Shield, BarChart3,
  ChevronDown, ChevronUp, Activity, Clock, FileText,
  MessageSquare, Settings, Package, ArrowUpRight
} from 'lucide-react';
import SuperAdminShell from '../components/SuperAdminShell.jsx';
import ecomApi from '../services/ecommApi.js';
import { CenteredSpinner } from '../components/Skeleton.jsx';
import { getContextualError } from '../utils/errorMessages';

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_PLANS = [
  { key: 'free',    displayName: 'Gratuit', priceRegular: 0,     currency: 'FCFA', order: 0 },
  { key: 'starter', displayName: 'Scalor',  priceRegular: 5000,  currency: 'FCFA', order: 1 },
  { key: 'pro',     displayName: 'Pro',     priceRegular: 10000, currency: 'FCFA', order: 2 },
  { key: 'ultra',   displayName: 'Ultra',   priceRegular: 15000, currency: 'FCFA', order: 3 },
];

const PLAN_META = {
  free:    { color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', label: 'Gratuit'  },
  starter: { color: '#059669', bg: '#d1fae5', border: '#6ee7b7', label: 'Scalor'   },
  pro:     { color: '#2563eb', bg: '#dbeafe', border: '#93c5fd', label: 'Pro'      },
  ultra:   { color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', label: 'Ultra'    },
};

const NAV_ITEMS = [
  { to: '/ecom/super-admin',                       label: 'Dashboard',    icon: BarChart3     },
  { to: '/ecom/super-admin/users',                 label: 'Utilisateurs', icon: Users         },
  { to: '/ecom/super-admin/workspaces',            label: 'Workspaces',   icon: Building2     },
  { to: '/ecom/super-admin/analytics',             label: 'Analytics',    icon: Activity      },
  { to: '/ecom/super-admin/product-page-history',  label: 'Pages IA',     icon: FileText      },
  { to: '/ecom/super-admin/activity',              label: 'Activité',     icon: Clock         },
  { to: '/ecom/super-admin/push',                  label: 'Push',         icon: Bell          },
  { to: '/ecom/super-admin/whatsapp-postulations', label: 'WhatsApp',     icon: MessageSquare },
  { to: '/ecom/super-admin/feature-analytics',     label: 'Features',     icon: Zap           },
  { to: '/ecom/super-admin/settings',              label: 'Config',       icon: Settings      },
];

const FILTER_TABS = [
  { value: 'all',      label: 'Tous'    },
  { value: 'active',   label: 'Actifs'  },
  { value: 'inactive', label: 'Inactifs'},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

const planLabel = (plan) => {
  // accepts either a key string or a full plan object
  const p = typeof plan === 'string' ? FALLBACK_PLANS.find(x => x.key === plan) : plan;
  if (!p || Number(p.priceRegular || 0) === 0) return p?.displayName ?? 'Gratuit';
  return `${p.displayName} — ${fmt(p.priceRegular)} ${p.currency || 'FCFA'}/mois`;
};

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

// ─── Sub-components ───────────────────────────────────────────────────────────

const PlanBadge = ({ plan }) => {
  const m = PLAN_META[plan] || PLAN_META.free;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border"
      style={{ color: m.color, background: m.bg, borderColor: m.border }}>
      <Crown className="w-3 h-3" />
      {m.label}
    </span>
  );
};

const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
    active ? 'text-primary-700 bg-primary-50 border-primary-200' : 'text-amber-700 bg-amber-50 border-amber-200'
  }`}>
    {active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
    {active ? 'Actif' : 'Inactif'}
  </span>
);

const KpiCard = ({ label, value, sub, icon: Icon, accent = '#059669', accentLight = '#d1fae5' }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
    <div className="flex items-center justify-between">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentLight }}>
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
    </div>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1 font-medium">{sub}</p>}
    </div>
  </div>
);

// ─── Workspace card ───────────────────────────────────────────────────────────

const WorkspaceCard = ({
  ws, availablePlans, planDraft, onUpdatePlanDraft,
  onSetPlan, onToggle, onSubscriptionWarning, onCopy, onUpdateGenerations,
  savingPlan,
}) => {
  const [expanded, setExpanded]     = useState(false);
  const [editingGen, setEditingGen] = useState(false);
  const [freeGen, setFreeGen]       = useState(String(ws.freeGenerationsRemaining || 0));
  const [paidGen, setPaidGen]       = useState(String(ws.paidGenerationsRemaining || 0));
  const [imgCredits, setImgCredits] = useState(String(ws.creativeCreditsRemaining || 0));

  const selectedPlan     = planDraft?.plan || ws.plan || 'free';
  const selectedDuration = Number(planDraft?.durationMonths || 1);
  const planConfig       = availablePlans.find(p => p.key === selectedPlan) || FALLBACK_PLANS.find(p => p.key === selectedPlan);
  const warn             = ws.subscriptionWarning;
  const warnActive       = warn?.active;

  const noticeLabel = warnActive
    ? (warn.variant === 'downgraded'   ? 'Désactiver annonce plan gratuit'
    :  warn.variant === 'plan_updated' ? 'Désactiver annonce mise à jour'
    :                                   'Désactiver alerte renouvellement')
    : 'Activer alerte renouvellement';

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 ${ws.isActive ? 'border-slate-200' : 'border-amber-200'}`}>
      {/* top stripe */}
      <div className={`h-1 ${ws.isActive ? 'bg-gradient-to-r from-primary-500 to-teal-400' : 'bg-gradient-to-r from-amber-400 to-red-400'}`} />

      <div className="p-5">
        {/* ── Row 1: identity ── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-slate-500" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base truncate leading-tight">{ws.name}</h3>
            </div>
            <p className="text-[11px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded inline-block ml-10">{ws.slug}</p>
          </div>
          <StatusBadge active={ws.isActive} />
        </div>

        {/* ── Row 2: quick stats ── */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center bg-slate-50 rounded-xl py-2.5 px-1 border border-slate-100">
            <p className="text-lg font-extrabold text-slate-900 leading-none">{ws.memberCount || 0}</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Membres</p>
          </div>
          <div className="text-center bg-violet-50 rounded-xl py-2.5 px-1 border border-violet-100">
            <p className="text-lg font-extrabold text-violet-700 leading-none">{ws.freeGenerationsRemaining || 0}</p>
            <p className="text-[10px] text-violet-500 font-semibold mt-0.5">Gen. libres</p>
          </div>
          <div className="text-center bg-indigo-50 rounded-xl py-2.5 px-1 border border-indigo-100">
            <p className="text-lg font-extrabold text-indigo-700 leading-none">{ws.paidGenerationsRemaining || 0}</p>
            <p className="text-[10px] text-indigo-500 font-semibold mt-0.5">Gen. payées</p>
          </div>
        </div>

        {/* ── Row 3: meta ── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            <span className="font-medium truncate max-w-[160px]">{ws.owner?.email || 'N/A'}</span>
          </span>
          <span className="text-slate-200">·</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {fmtDate(ws.createdAt)}
          </span>
        </div>

        {/* ── Row 4: plan + invite code ── */}
        <div className="flex items-center justify-between mb-4">
          <PlanBadge plan={ws.plan || 'free'} />
          {ws.planExpiresAt && (
            <span className="text-[10px] text-slate-400 font-medium">
              expire {fmtDate(ws.planExpiresAt)}
            </span>
          )}
          <button
            onClick={() => onCopy(ws.inviteCode)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-2.5 py-1 rounded-lg transition"
          >
            <Copy className="w-3 h-3" />
            {ws.inviteCode}
          </button>
        </div>

        {/* ── Actions strip ── */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => onToggle(ws._id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border transition-all ${
              ws.isActive
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100'
            }`}
          >
            {ws.isActive ? <><PowerOff className="w-3.5 h-3.5" /> Désactiver</> : <><Power className="w-3.5 h-3.5" /> Réactiver</>}
          </button>
          <button
            onClick={() => onSubscriptionWarning(ws._id, warnActive)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border transition-all ${
              warnActive
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
            }`}
          >
            {warnActive ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{warnActive ? 'Alerte off' : 'Alerte on'}</span>
            <span className="sm:hidden">{warnActive ? 'Off' : 'On'}</span>
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>Gérer</span>
          </button>
        </div>

        {/* ── Expandable panel ── */}
        {expanded && (
          <div className="border-t border-slate-100 pt-4 space-y-4">

            {/* Plan selector */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crown className="w-3 h-3" /> Définir le plan
              </p>
              <div className="flex gap-2 mb-2">
                <select
                  value={selectedPlan}
                  onChange={(e) => onUpdatePlanDraft(ws._id, 'plan', e.target.value)}
                  className="flex-1 text-xs font-bold border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {availablePlans.map(p => (
                    <option key={p.key} value={p.key}>{planLabel(p)}</option>
                  ))}
                </select>
                <select
                  value={String(selectedDuration)}
                  onChange={(e) => onUpdatePlanDraft(ws._id, 'durationMonths', Number(e.target.value))}
                  disabled={selectedPlan === 'free'}
                  className="w-24 text-xs font-bold border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-40"
                >
                  <option value="1">1 mois</option>
                  <option value="3">3 mois</option>
                  <option value="6">6 mois</option>
                  <option value="12">12 mois</option>
                </select>
              </div>
              <button
                onClick={() => onSetPlan(ws._id)}
                disabled={!!savingPlan}
                className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition disabled:opacity-50"
              >
                {savingPlan
                  ? 'Application…'
                  : selectedPlan === 'free'
                    ? 'Mettre au plan gratuit'
                    : `Appliquer ${planConfig?.displayName ?? selectedPlan} · ${selectedDuration} mois`}
              </button>
            </div>

            {/* Generations */}
            <div className="rounded-xl bg-violet-50 border border-violet-200 p-3">
              <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Crédits IA
              </p>
              {editingGen ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-violet-600 font-semibold mb-1">Pages gratuites</p>
                      <input type="number" min="0" value={freeGen} onChange={e => setFreeGen(e.target.value)}
                        className="w-full text-xs border border-violet-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-violet-600 font-semibold mb-1">Pages payées</p>
                      <input type="number" min="0" value={paidGen} onChange={e => setPaidGen(e.target.value)}
                        className="w-full text-xs border border-violet-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-pink-600 font-semibold mb-1">Images créatives</p>
                      <input type="number" min="0" value={imgCredits} onChange={e => setImgCredits(e.target.value)}
                        className="w-full text-xs border border-pink-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { onUpdateGenerations(ws._id, freeGen, paidGen, imgCredits); setEditingGen(false); }}
                      className="flex-1 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 transition">Valider</button>
                    <button onClick={() => {
                        setEditingGen(false);
                        setFreeGen(String(ws.freeGenerationsRemaining||0));
                        setPaidGen(String(ws.paidGenerationsRemaining||0));
                        setImgCredits(String(ws.creativeCreditsRemaining||0));
                      }}
                      className="flex-1 py-1.5 bg-white border border-violet-200 text-violet-600 rounded-lg text-xs font-bold hover:bg-violet-50 transition">Annuler</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-violet-500 font-medium">Pages gratuites</span>
                    <span className="font-bold text-primary-600">{ws.freeGenerationsRemaining || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-violet-500 font-medium">Pages payées</span>
                    <span className="font-bold text-violet-700">{ws.paidGenerationsRemaining || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-pink-500 font-medium">Images créatives</span>
                    <span className="font-bold text-pink-700">{ws.creativeCreditsRemaining || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-3">
                    <span className="text-violet-500 font-medium">Pages utilisées</span>
                    <span className="font-bold text-slate-600">{ws.totalGenerations || 0}</span>
                  </div>
                  <button onClick={() => setEditingGen(true)}
                    className="w-full py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-200 transition">
                    Modifier les crédits
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const SuperAdminWorkspaces = () => {
  const location = useLocation();
  const [workspaces,      setWorkspaces]      = useState([]);
  const [availablePlans,  setAvailablePlans]  = useState(FALLBACK_PLANS);
  const [planDrafts,      setPlanDrafts]      = useState({});
  const [savingPlans,     setSavingPlans]     = useState({});
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState('');
  const [searchTerm,      setSearchTerm]      = useState('');
  const [filterTab,       setFilterTab]       = useState('all');

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchWorkspaces = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res   = await ecomApi.get('/super-admin/workspaces');
      const items = res.data.data.workspaces || [];
      setWorkspaces(items);
      setPlanDrafts(Object.fromEntries(
        items.map(ws => [ws._id, { plan: ws.plan || 'free', durationMonths: 1 }])
      ));
    } catch (err) { setError(getContextualError(err, 'load_dashboard')); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const res   = await ecomApi.get('/super-admin/plans');
      const plans = (res.data.plans || [])
        .filter(p => ['free','starter','pro','ultra'].includes(p.key))
        .sort((a, b) => Number(a.order||0) - Number(b.order||0));
      if (plans.length) setAvailablePlans(plans);
    } catch { /* keep fallback */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchWorkspaces(), fetchPlans()]);
  }, [fetchWorkspaces, fetchPlans]);

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error)   { const t = setTimeout(() => setError(''),   4000); return () => clearTimeout(t); } }, [error]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleToggle = async (wsId) => {
    try { const r = await ecomApi.put(`/super-admin/workspaces/${wsId}/toggle`); setSuccess(r.data.message); fetchWorkspaces(true); }
    catch (err) { setError(getContextualError(err, 'update_settings')); }
  };

  const handleSubscriptionWarning = async (wsId, currentlyActive) => {
    try { const r = await ecomApi.put(`/super-admin/workspaces/${wsId}/subscription-warning`, { active: !currentlyActive }); setSuccess(r.data.message); fetchWorkspaces(true); }
    catch (err) { setError(getContextualError(err, 'update_settings')); }
  };

  const updatePlanDraft = (wsId, field, value) => {
    setPlanDrafts(prev => {
      const cur = prev[wsId] || { plan: 'free', durationMonths: 1 };
      if (field === 'plan' && value === 'free') return { ...prev, [wsId]: { plan: 'free', durationMonths: 1 } };
      return { ...prev, [wsId]: { ...cur, [field]: value } };
    });
  };

  const handleSetPlan = async (wsId) => {
    const draft    = planDrafts[wsId] || { plan: 'free', durationMonths: 1 };
    const plan     = draft.plan || 'free';
    const months   = plan === 'free' ? 1 : Number(draft.durationMonths || 1);
    const cfg      = availablePlans.find(p => p.key === plan);
    setSavingPlans(prev => ({ ...prev, [wsId]: true }));
    try {
      await ecomApi.patch(`/super-admin/workspaces/${wsId}/plan`, { plan, durationMonths: months });
      setSuccess(plan === 'free' ? 'Plan gratuit appliqué' : `Plan ${cfg?.displayName ?? plan} appliqué pour ${months} mois`);
      await fetchWorkspaces(true);
    } catch (err) { setError(getContextualError(err, 'update_settings')); }
    finally { setSavingPlans(prev => ({ ...prev, [wsId]: false })); }
  };

  const handleUpdateGenerations = async (wsId, free, paid, creative) => {
    try {
      const r = await ecomApi.patch(`/super-admin/workspaces/${wsId}/generations`, {
        freeGenerations: parseInt(free) || 0,
        paidGenerations: parseInt(paid) || 0,
        creativeCredits: parseInt(creative) || 0,
      });
      setSuccess(r.data.message || 'Crédits mis à jour');
      fetchWorkspaces(true);
    } catch (err) { setError(getContextualError(err, 'update_settings')); }
  };

  const copyCode = (code) => { navigator.clipboard?.writeText(code); setSuccess('Code copié !'); };

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalActive   = useMemo(() => workspaces.filter(w => w.isActive).length,                      [workspaces]);
  const totalInactive = useMemo(() => workspaces.filter(w => !w.isActive).length,                     [workspaces]);
  const totalMembers  = useMemo(() => workspaces.reduce((s, w) => s + (w.memberCount || 0), 0),       [workspaces]);
  const avgMembers    = useMemo(() => workspaces.length ? (totalMembers / workspaces.length).toFixed(1) : '0', [workspaces, totalMembers]);

  const filtered = useMemo(() => {
    let list = workspaces;
    if (filterTab === 'active')   list = list.filter(w => w.isActive);
    if (filterTab === 'inactive') list = list.filter(w => !w.isActive);
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      list = list.filter(w =>
        w.name?.toLowerCase().includes(t) ||
        w.slug?.toLowerCase().includes(t) ||
        w.owner?.email?.toLowerCase().includes(t)
      );
    }
    return list;
  }, [workspaces, filterTab, searchTerm]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <CenteredSpinner message="Chargement des espaces…" />;

  return (
    <SuperAdminShell
      title="Gestion des espaces"
      subtitle={`${workspaces.length} espaces · ${totalMembers} membres · ${totalActive} actifs`}
      icon={Building2}
      success={success}
      error={error}
      refreshing={refreshing}
      onRefresh={() => fetchWorkspaces(true)}
    >
      <div className="space-y-5">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total espaces"    value={workspaces.length.toLocaleString()} sub={`${totalActive} actifs · ${totalInactive} inactifs`} icon={Building2}   accent="#059669" accentLight="#d1fae5" />
          <KpiCard label="Espaces actifs"   value={totalActive.toLocaleString()}       sub={`${Math.round((totalActive/Math.max(workspaces.length,1))*100)}% du total`}    icon={CheckCircle2} accent="#2563eb" accentLight="#dbeafe" />
          <KpiCard label="Total membres"    value={totalMembers.toLocaleString()}       sub={`${avgMembers} moy. par espace`}  icon={Users}       accent="#7c3aed" accentLight="#ede9fe" />
          <KpiCard label="Espaces inactifs" value={totalInactive.toLocaleString()}     sub="Désactivés manuellement"          icon={XCircle}     accent="#f59e0b" accentLight="#fef3c7" />
        </div>

        {/* ── Search + filter row ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, slug ou email propriétaire…"
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {FILTER_TABS.map(tab => (
              <button key={tab.value} onClick={() => setFilterTab(tab.value)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filterTab === tab.value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                {tab.label}
                <span className={`ml-1.5 text-[10px] font-black ${filterTab === tab.value ? 'text-slate-300' : 'text-slate-400'}`}>
                  {tab.value === 'all'      ? workspaces.length
                  : tab.value === 'active'  ? totalActive
                  :                           totalInactive}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Results info ── */}
        {(searchTerm || filterTab !== 'all') && (
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span><strong className="text-slate-700">{filtered.length}</strong> espace{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}</span>
            {(searchTerm || filterTab !== 'all') && (
              <button onClick={() => { setSearchTerm(''); setFilterTab('all'); }}
                className="text-primary-600 font-bold hover:underline ml-1">Réinitialiser</button>
            )}
          </div>
        )}

        {/* ── Grid ── */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center shadow-sm">
            <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-base font-extrabold text-slate-400">
              {searchTerm ? `Aucun résultat pour "${searchTerm}"` : 'Aucun espace'}
            </p>
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition">
                Réinitialiser
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(ws => (
              <WorkspaceCard
                key={ws._id}
                ws={ws}
                availablePlans={availablePlans}
                planDraft={planDrafts[ws._id]}
                onUpdatePlanDraft={updatePlanDraft}
                onSetPlan={handleSetPlan}
                onToggle={handleToggle}
                onSubscriptionWarning={handleSubscriptionWarning}
                onCopy={copyCode}
                onUpdateGenerations={handleUpdateGenerations}
                savingPlan={savingPlans[ws._id]}
              />
            ))}
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
};

export default SuperAdminWorkspaces;
