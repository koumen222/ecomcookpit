import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Activity, TrendingUp, TrendingDown, Users, UserPlus, Eye, Zap,
  AlertCircle, RefreshCw, BarChart3, Clock, Target, Shield,
  Loader2, ArrowUpRight, ArrowDownRight, Building2, Globe,
  Smartphone, Monitor, Tablet, MousePointerClick, ChevronRight,
  CheckCircle2, Bell, LogIn, Layers, ArrowRight, RotateCcw,
  Crown, Briefcase, Package, Calculator, Truck, Settings,
  MessageSquare, FileText, WifiOff
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import SuperAdminShell from '../components/SuperAdminShell.jsx';
import { DashboardSkeleton, Shimmer, SkeletonKpi, SkeletonChart, SkeletonCard, SectionError } from '../components/Skeleton.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const RANGE_TABS = [
  { value: '24h', label: '24h' },
  { value: '7d',  label: '7j'  },
  { value: '30d', label: '30j' },
  { value: '90d', label: '90j' },
];

const NAV_ITEMS = [
  { to: '/ecom/super-admin',                           label: 'Dashboard',    icon: BarChart3     },
  { to: '/ecom/super-admin/users',                     label: 'Utilisateurs', icon: Users         },
  { to: '/ecom/super-admin/workspaces',                label: 'Workspaces',   icon: Building2     },
  { to: '/ecom/super-admin/analytics',                 label: 'Analytics',    icon: Activity      },
  { to: '/ecom/super-admin/product-page-history',      label: 'Pages IA',     icon: FileText      },
  { to: '/ecom/super-admin/activity',                  label: 'Activité',     icon: Clock         },
  { to: '/ecom/super-admin/push',                      label: 'Push',         icon: Bell          },
  { to: '/ecom/super-admin/whatsapp-postulations',     label: 'WhatsApp',     icon: MessageSquare },
  { to: '/ecom/super-admin/whatsapp-logs',             label: 'WA Logs',      icon: FileText      },
  { to: '/ecom/super-admin/scalor-whatsapp',           label: 'WA Scalor',    icon: MessageSquare },
  { to: '/ecom/super-admin/feature-analytics',         label: 'Features',     icon: Zap           },
  { to: '/ecom/super-admin/settings',                  label: 'Config',       icon: Settings      },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

const Spark = ({ data = [], color = '#059669', h = 36, w = 88 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 5) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity="0.12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const KpiCard = ({ label, value, sub, icon: Icon, trend, trendUp, spark, sparkColor = '#059669', accent = '#059669', accentLight = '#d1fae5', loading = false }) => {
  if (loading) return <SkeletonKpi />;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accentLight }}>
          {Icon && <Icon className="w-4 h-4" style={{ color: accent }} />}
        </div>
        {trend != null && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-lg ${trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1 font-medium">{sub}</p>}
        </div>
        {spark && spark.length > 1 && <Spark data={spark} color={sparkColor} />}
      </div>
    </div>
  );
};

const Bar = ({ value, max, color = '#059669' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
};

const AreaChart = ({ data, dataKey, color = '#059669', h = 180 }) => {
  if (!data || data.length < 2) return (
    <div className="flex flex-col items-center justify-center gap-2 bg-slate-50 rounded-xl" style={{ height: h }}>
      <BarChart3 className="w-5 h-5 text-slate-300" />
      <p className="text-xs text-slate-400 font-medium">Pas assez de données</p>
    </div>
  );
  const values = data.map(d => d[dataKey] || 0);
  const max = Math.max(...values, 1);
  const W = 800, H = h;
  const pL = 42, pR = 8, pT = 10, pB = 24;
  const cw = W - pL - pR, ch = H - pT - pB;
  const tx = i => pL + (i / (data.length - 1)) * cw;
  const ty = v => pT + ch - (v / max) * ch;
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${tx(i).toFixed(1)},${ty(v).toFixed(1)}`).join(' ');
  const area = `${line} L${tx(data.length - 1).toFixed(1)},${ty(0).toFixed(1)} L${tx(0).toFixed(1)},${ty(0).toFixed(1)} Z`;
  const fmt = v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : Math.round(v);
  const step = Math.max(1, Math.floor(data.length / 7));
  const uid = dataKey.replace(/[^a-z]/gi, '');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`ag-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const yv = ty(max * f);
        return (
          <g key={i}>
            <line x1={pL} y1={yv} x2={W - pR} y2={yv} stroke="#f1f5f9" strokeWidth="1" />
            <text x={pL - 5} y={yv + 3.5} textAnchor="end" fill="#94a3b8" fontSize="9" fontWeight="600">{fmt(max * f)}</text>
          </g>
        );
      })}
      <path d={area} fill={`url(#ag-${uid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        if (i % step !== 0 && i !== data.length - 1) return null;
        const lbl = (d.date || d._id || '').toString();
        const short = lbl.length > 5 ? lbl.slice(5) : lbl;
        return <text key={i} x={tx(i)} y={H - 5} textAnchor="middle" fill="#94a3b8" fontSize="8.5" fontWeight="600">{short}</text>;
      })}
      {values.map((v, i) => (
        <circle key={i} cx={tx(i)} cy={ty(v)} r="3" fill="white" stroke={color} strokeWidth="2">
          <title>{fmt(v)}</title>
        </circle>
      ))}
    </svg>
  );
};

const RoleBadge = ({ role }) => {
  const map = {
    super_admin:   { label: 'Super Admin', bg: '#fef3c7', color: '#92400e', icon: Crown      },
    ecom_admin:    { label: 'Admin',       bg: '#d1fae5', color: '#065f46', icon: Briefcase  },
    ecom_closeuse: { label: 'Closeuse',    bg: '#e0f2fe', color: '#075985', icon: Package    },
    ecom_compta:   { label: 'Compta',      bg: '#ede9fe', color: '#4c1d95', icon: Calculator },
    ecom_livreur:  { label: 'Livreur',     bg: '#ffedd5', color: '#7c2d12', icon: Truck      },
  };
  const info = map[role] || { label: role || '—', bg: '#f1f5f9', color: '#475569', icon: Users };
  const I = info.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: info.bg, color: info.color }}>
      <I className="w-3 h-3" />{info.label}
    </span>
  );
};

const SH = ({ icon: Icon, title, subtitle, color, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm" style={{ background: color }}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <h2 className="text-sm font-extrabold text-slate-800 tracking-tight">{title}</h2>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

const MiniStat = ({ label, value, color = '#059669', bg = '#ecfdf5' }) => (
  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: bg }}>
    <p className="text-xl font-extrabold" style={{ color }}>{value}</p>
    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
  </div>
);

// Section wrapper with loading/error states
const Section = ({ loading, error, onRetry, children, skeletonRows = 4, className = '' }) => {
  if (loading) return <SkeletonCard rows={skeletonRows} className={className} />;
  if (error) return (
    <div className={`bg-white rounded-2xl border border-slate-100 ${className}`}>
      <SectionError message={error} onRetry={onRetry} />
    </div>
  );
  return children;
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);

  // Per-endpoint data
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({});
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceSummary, setWorkspaceSummary] = useState({ totalWorkspaces: 0, totalActive: 0, totalMembers: 0 });
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [countries, setCountries] = useState([]);
  const [pages, setPages] = useState([]);
  const [usersActivity, setUsersActivity] = useState(null);
  const [security, setSecurity] = useState(null);
  const [pushStats, setPushStats] = useState(null);

  // Per-endpoint error tracking
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');

  // Section-level loading (for partial reload)
  const [sectionLoading, setSectionLoading] = useState({});

  // ─── Stale-while-revalidate cache key ───────────────────────────────────
  const CACHE_KEY = `dash_summary_${range}`;
  const CACHE_TTL = 60_000; // 60 s

  const applyData = useCallback((d) => {
    if (!d) return;
    if (d.users)      setUserStats(d.users.stats || {});
    if (d.workspaces) {
      setWorkspaces(d.workspaces.workspaces || []);
      setWorkspaceSummary({ totalWorkspaces: d.workspaces.totalWorkspaces || 0, totalActive: d.workspaces.totalActive || 0, totalMembers: d.workspaces.totalMembers || 0 });
    }
    if (d.overview)   setOverview(d.overview);
    if (d.funnel)     setFunnel(d.funnel);
    if (d.traffic)    setTraffic(d.traffic);
    if (d.countries)  setCountries(Array.isArray(d.countries) ? d.countries : []);
    if (d.pages)      setPages(Array.isArray(d.pages) ? d.pages : []);
    if (d.activity)   setUsersActivity(d.activity);
    if (d.security)   setSecurity(d.security);
    if (d.push)       setPushStats(d.push);
  }, []);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) {
      // Check sessionStorage for stale data — show it immediately
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_TTL * 5) { // accept up to 5 min stale for instant render
            applyData(data);
            setInitialLoading(false);
            setRefreshing(true); // signal background refresh
          }
        }
      } catch (_) {}
      if (initialLoading) setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const res = await ecomApi.get('/super-admin/dashboard-summary', { params: { range }, timeout: 60000 });
      const body = res.data;
      if (!body?.success) throw new Error(body?.message || 'Réponse invalide');

      const d = body.data;
      applyData(d);
      setErrors({});
      setGlobalError('');

      // Persist to sessionStorage for next mount
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: d }));
      } catch (_) {}

    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message || 'Erreur réseau';
      console.error('[Dashboard] dashboard-summary failed:', msg);

      if (status === 401) setGlobalError('Non authentifié — veuillez vous reconnecter.');
      else if (status === 403) setGlobalError('Accès refusé (403).');
      else if (err.code === 'ECONNABORTED' || msg.includes('timeout')) {
        setGlobalError('Le serveur met trop de temps à répondre. Vérifiez que le backend est démarré.');
        setErrors({ users: 'timeout', workspaces: 'timeout', overview: 'timeout' });
      } else {
        setGlobalError(msg);
      }
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [range, applyData]); // eslint-disable-line react-hooks/exhaustive-deps

  const retrySection = useCallback(() => fetchAll(true), [fetchAll]);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(() => fetchAll(true), 60000);
    return () => clearInterval(timerRef.current);
  }, [fetchAll]);

  // ─── Derived data ────────────────────────────────────────────────────────

  const kpis            = overview?.kpis   || {};
  const trends          = overview?.trends || {};
  const dailySessions   = trends.dailySessions || [];
  const dailySignups    = trends.dailySignups  || [];

  // Prefer backend-computed totals; fall back to client-side aggregation
  const totalMembers  = workspaceSummary.totalMembers || workspaces.reduce((s, w) => s + (w.memberCount || 0), 0);
  const activeWs      = workspaceSummary.totalActive  || workspaces.filter(w => w.isActive).length;
  // neverLoggedIn now comes from backend stat — no full user list needed
  const neverLoggedIn = userStats.neverLoggedIn ?? 0;

  const activationRate = userStats.totalUsers
    ? Math.round(((userStats.totalActive || 0) / userStats.totalUsers) * 100)
    : 0;
  const churnRate = kpis.retention7d != null ? 100 - kpis.retention7d : 100 - activationRate;

  const roleCounts = useMemo(() => {
    const map = {};
    (userStats.byRole || []).forEach(r => { map[r._id] = r.count; });
    return map;
  }, [userStats]);

  const signupTrend = useMemo(() => {
    if (dailySignups.length < 4) return null;
    const half = Math.floor(dailySignups.length / 2);
    const first  = dailySignups.slice(0, half).reduce((s, d) => s + d.count, 0);
    const second = dailySignups.slice(half).reduce((s, d) => s + d.count, 0);
    if (first === 0) return second > 0 ? '+100%' : null;
    const pct = Math.round(((second - first) / first) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }, [dailySignups]);

  const sessionSparkData = useMemo(() => dailySessions.map(d => d.sessions || 0), [dailySessions]);
  const signupSparkData  = useMemo(() => dailySignups.map(d => d.count || 0), [dailySignups]);

  const funnelSteps  = funnel?.funnel   || [];
  const dropoffs     = funnel?.dropoffs || [];
  const funnelIcons  = [Eye, UserPlus, CheckCircle2, Building2, Zap];

  const deviceData   = traffic?.byDevice || [];
  const browserData  = (traffic?.byBrowser || []).slice(0, 6);
  const countryData  = (Array.isArray(countries) ? countries : []).slice(0, 8);
  const topPages     = (Array.isArray(pages) ? pages : []).slice(0, 8);
  const recentLogins = usersActivity?.recentLogins || [];
  const secStats     = security?.stats || {};

  const rangeLabel = { '24h': '24h', '7d': '7 jours', '30d': '30 jours', '90d': '90 jours' }[range] || range;
  const analyticsOk = !errors.overview;
  const usersOk     = !errors.users;
  const wsOk        = !errors.workspaces;

  // ─── Initial loading screen (skeleton) ──────────────────────────────────

  if (initialLoading) return <DashboardSkeleton />;

  // ─── Render ──────────────────────────────────────────────────────────────

  const rangeActions = (
    <div className="flex items-center gap-1.5 p-0.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
      {RANGE_TABS.map(t => (
        <button key={t.value} onClick={() => setRange(t.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
          style={range === t.value
            ? { background: '#10b981', color: '#fff' }
            : { color: 'rgba(148,163,184,0.9)' }
          }>
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <SuperAdminShell
      title="Super Admin"
      subtitle={usersOk
        ? `${(userStats.totalUsers || 0).toLocaleString()} utilisateurs · ${workspaces.length} workspaces`
        : '⚠ Données partielles'
      }
      icon={BarChart3}
      error={globalError}
      refreshing={refreshing}
      onRefresh={() => fetchAll(true)}
      actions={rangeActions}
      maxWidth="1500px"
    >
      <div className="space-y-5">

        {/* Error pills for failed endpoints */}
        {Object.keys(errors).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(errors).map(([key, msg]) => (
              <div key={key} className="flex items-center gap-1.5 text-[11px] font-medium bg-red-50 text-red-600 border border-red-100 rounded-lg px-3 py-1.5">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span className="font-bold capitalize">{key}:</span> {msg}
              </div>
            ))}
          </div>
        )}

        {/* ── KPI — Croissance ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-5 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-extrabold text-slate-700">Croissance</h2>
            <span className="text-[10px] text-slate-400 font-medium">— {rangeLabel}</span>
            {errors.users && (
              <button onClick={() => retrySection('users')} className="ml-auto text-[11px] text-emerald-600 font-bold hover:underline flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Réessayer
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {sectionLoading.users || sectionLoading.overview ? Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />) : (
              <>
                <KpiCard label="Utilisateurs" value={(userStats.totalUsers || 0).toLocaleString()} sub={`${userStats.totalActive || 0} actifs`} icon={Users} accent="#059669" accentLight="#d1fae5" />
                <KpiCard label="Nouveaux" value={(kpis.signups ?? 0).toLocaleString()} sub={rangeLabel} icon={UserPlus} accent="#7c3aed" accentLight="#ede9fe" trend={signupTrend} trendUp={signupTrend?.startsWith('+')} spark={signupSparkData} sparkColor="#7c3aed" />
                <KpiCard label="DAU" value={(kpis.dau ?? 0).toLocaleString()} sub={`WAU ${kpis.wau ?? 0} · MAU ${kpis.mau ?? 0}`} icon={Activity} accent="#0ea5e9" accentLight="#e0f2fe" />
                <KpiCard label="Activation" value={`${activationRate}%`} sub={`${userStats.totalActive || 0}/${userStats.totalUsers || 0}`} icon={Target} accent="#0d9488" accentLight="#ccfbf1" />
                <KpiCard label="Rétention 7j" value={`${kpis.retention7d ?? 0}%`} sub="Retenus" icon={RotateCcw} accent="#2563eb" accentLight="#dbeafe" />
                <KpiCard label="Churn" value={`${churnRate}%`} sub={`${neverLoggedIn} jamais co.`} icon={TrendingDown} accent="#f59e0b" accentLight="#fef3c7" />
              </>
            )}
          </div>
        </section>

        {/* ── KPI — Engagement ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-5 rounded-full bg-sky-500" />
            <h2 className="text-sm font-extrabold text-slate-700">Engagement</h2>
            {errors.overview && !analyticsOk && (
              <span className="ml-auto text-[11px] text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Analytics: {errors.overview}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {sectionLoading.overview ? Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />) : (
              <>
                <KpiCard label="Sessions" value={(kpis.totalSessions ?? 0).toLocaleString()} sub={`${(kpis.uniqueVisitors ?? 0).toLocaleString()} uniques`} icon={Eye} accent="#059669" accentLight="#d1fae5" spark={sessionSparkData} sparkColor="#059669" />
                <KpiCard label="Pages vues" value={(kpis.totalPageViews ?? 0).toLocaleString()} icon={Layers} accent="#0ea5e9" accentLight="#e0f2fe" />
                <KpiCard label="Durée moy." value={`${kpis.avgSessionDuration ?? 0}s`} icon={Clock} accent="#7c3aed" accentLight="#ede9fe" />
                <KpiCard label="Taux rebond" value={`${kpis.bounceRate ?? 0}%`} icon={TrendingDown} accent="#f59e0b" accentLight="#fef3c7" />
                <KpiCard label="Workspaces" value={(workspaceSummary.totalWorkspaces || workspaces.length).toLocaleString()} sub={`${activeWs} actifs`} icon={Building2} accent="#8b5cf6" accentLight="#ede9fe" />
                <KpiCard label="Membres" value={totalMembers.toLocaleString()} sub={`${(workspaceSummary.totalWorkspaces || workspaces.length) > 0 ? (totalMembers / (workspaceSummary.totalWorkspaces || workspaces.length)).toFixed(1) : 0}/ws`} icon={Users} accent="#0d9488" accentLight="#ccfbf1" />
              </>
            )}
          </div>
        </section>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sectionLoading.overview ? (
            <><SkeletonChart /><SkeletonChart /></>
          ) : (
            <>
              {/* Sessions */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <SH icon={Activity} title="Sessions quotidiennes" color="#059669">
                  {dailySessions.length > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-extrabold text-slate-800">{dailySessions.reduce((s, d) => s + (d.sessions || 0), 0).toLocaleString()}</span>
                      <span className="text-slate-400">total</span>
                      <span className="font-bold text-emerald-700">↑ {Math.max(...dailySessions.map(d => d.sessions || 0), 0).toLocaleString()} peak</span>
                    </div>
                  )}
                </SH>
                <AreaChart data={dailySessions} dataKey="sessions" color="#059669" h={180} />
                {dailySessions.length > 1 && (
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-50">
                    {[
                      { label: 'Total',   val: dailySessions.reduce((s, d) => s + (d.sessions || 0), 0).toLocaleString(), color: '#1e293b' },
                      { label: 'Peak',    val: Math.max(...dailySessions.map(d => d.sessions || 0)).toLocaleString(), color: '#059669' },
                      { label: 'Moyenne', val: Math.round(dailySessions.reduce((s, d) => s + (d.sessions || 0), 0) / dailySessions.length).toLocaleString(), color: '#0d9488' },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-base font-extrabold" style={{ color: s.color }}>{s.val}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Signups */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <SH icon={UserPlus} title="Inscriptions quotidiennes" color="#7c3aed">
                  {dailySignups.length > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-extrabold text-slate-800">{dailySignups.reduce((s, d) => s + (d.count || 0), 0).toLocaleString()}</span>
                      <span className="text-slate-400">total</span>
                      {signupTrend && (
                        <span className={`font-bold ${signupTrend.startsWith('+') ? 'text-emerald-700' : 'text-red-500'}`}>{signupTrend}</span>
                      )}
                    </div>
                  )}
                </SH>
                <AreaChart data={dailySignups} dataKey="count" color="#7c3aed" h={180} />
                {dailySignups.length > 1 && (
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-50">
                    {[
                      { label: 'Total',   val: dailySignups.reduce((s, d) => s + (d.count || 0), 0).toLocaleString(), color: '#1e293b' },
                      { label: 'Peak',    val: Math.max(...dailySignups.map(d => d.count || 0)).toLocaleString(), color: '#7c3aed' },
                      { label: 'Moyenne', val: (dailySignups.reduce((s, d) => s + (d.count || 0), 0) / dailySignups.length).toFixed(1), color: '#8b5cf6' },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-base font-extrabold" style={{ color: s.color }}>{s.val}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Conversion Funnel ── */}
        {funnelSteps.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-5 rounded-full bg-amber-500" />
              <h2 className="text-sm font-extrabold text-slate-700">Funnel de Conversion</h2>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div className="flex flex-wrap gap-2 items-center">
                {funnelSteps.map((step, i) => {
                  const Ic = funnelIcons[i] || Zap;
                  const palettes = [
                    { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46', iconBg: '#d1fae5' },
                    { bg: '#eff6ff', border: '#93c5fd', text: '#1e3a8a', iconBg: '#dbeafe' },
                    { bg: '#f0fdf4', border: '#86efac', text: '#14532d', iconBg: '#dcfce7' },
                    { bg: '#faf5ff', border: '#c4b5fd', text: '#4c1d95', iconBg: '#ede9fe' },
                    { bg: '#fffbeb', border: '#fcd34d', text: '#78350f', iconBg: '#fef3c7' },
                  ];
                  const p = palettes[i % palettes.length];
                  return (
                    <React.Fragment key={step.step}>
                      <div className="flex-1 min-w-[120px] rounded-xl border-2 p-4 transition-all hover:shadow-md"
                        style={{ backgroundColor: p.bg, borderColor: p.border }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: p.iconBg }}>
                            <Ic className="w-3.5 h-3.5" style={{ color: p.text }} />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.text, opacity: 0.7 }}>{step.step}</span>
                        </div>
                        <p className="text-2xl font-extrabold" style={{ color: p.text }}>{(step.count || 0).toLocaleString()}</p>
                        <p className="text-xs font-bold mt-0.5" style={{ color: p.text, opacity: 0.6 }}>{step.rate}%</p>
                      </div>
                      {i < funnelSteps.length - 1 && (
                        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                          <ArrowRight className="w-4 h-4 text-slate-300" />
                          {dropoffs[i] && <span className="text-[9px] font-bold text-red-400">-{dropoffs[i].dropRate}%</span>}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-50">
                {[
                  { label: 'Visite → Inscription',     val: `${kpis.conversionSignup ?? 0}%`,            icon: MousePointerClick, color: '#059669', bg: '#d1fae5' },
                  { label: 'Inscription → Workspace',  val: `${kpis.conversionActivation ?? 0}%`,        icon: CheckCircle2,      color: '#0d9488', bg: '#ccfbf1' },
                  { label: 'Taux de rebond',            val: `${kpis.bounceRate ?? 0}%`,                 icon: TrendingDown,      color: '#f59e0b', bg: '#fef3c7' },
                  { label: 'Visiteurs uniques',         val: (kpis.uniqueVisitors ?? 0).toLocaleString(), icon: Users,             color: '#2563eb', bg: '#dbeafe' },
                ].map(c => (
                  <div key={c.label} className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: c.bg }}>
                    <c.icon className="w-4 h-4 flex-shrink-0" style={{ color: c.color }} />
                    <div>
                      <p className="text-sm font-extrabold" style={{ color: c.color }}>{c.val}</p>
                      <p className="text-[9px] font-semibold text-slate-500 mt-0.5">{c.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 3 Columns: Pages / Devices / Countries ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pages */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <SH icon={Eye} title="Pages populaires" color="#0ea5e9" />
            {errors.pages ? (
              <SectionError message={errors.pages} onRetry={() => retrySection('pages')} />
            ) : topPages.length > 0 ? (
              <div className="space-y-3">
                {topPages.map((p, i) => (
                  <div key={p.page || i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold bg-sky-50 text-sky-600 flex-shrink-0">{i + 1}</span>
                        <span className="text-xs font-semibold text-slate-700 truncate">{p.page || '/'}</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 ml-2 flex-shrink-0">{(p.views || 0).toLocaleString()}</span>
                    </div>
                    <Bar value={p.views || 0} max={topPages[0]?.views || 1} color="#0ea5e9" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-300 text-center py-8 font-medium">Aucune donnée</p>
            )}
          </div>

          {/* Devices */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <SH icon={Smartphone} title="Appareils & Navigateurs" color="#8b5cf6" />
            {errors.traffic ? (
              <SectionError message={errors.traffic} />
            ) : deviceData.length > 0 ? (
              <div className="space-y-3">
                {deviceData.map((d, i) => {
                  const total = deviceData.reduce((s, x) => s + (x.sessions || 0), 0) || 1;
                  const pct = Math.round(((d.sessions || 0) / total) * 100);
                  return (
                    <div key={d._id || i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 flex-shrink-0">
                        {(() => {
                          const t = (d._id || '').toLowerCase();
                          if (t.includes('mobile') || t.includes('phone')) return <Smartphone className="w-4 h-4" />;
                          if (t.includes('tablet')) return <Tablet className="w-4 h-4" />;
                          return <Monitor className="w-4 h-4" />;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-700 capitalize">{d._id || 'Inconnu'}</span>
                          <span className="text-[11px] font-bold text-slate-500">{pct}%</span>
                        </div>
                        <Bar value={d.sessions || 0} max={total} color="#8b5cf6" />
                      </div>
                    </div>
                  );
                })}
                {browserData.length > 0 && (
                  <div className="border-t border-slate-50 pt-3 mt-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Navigateurs</p>
                    <div className="space-y-1.5">
                      {browserData.map((b, i) => (
                        <div key={b._id || i} className="flex items-center justify-between">
                          <span className="text-xs text-slate-600">{b._id || 'Autre'}</span>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{(b.sessions || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-300 text-center py-8 font-medium">Aucune donnée</p>
            )}
          </div>

          {/* Countries */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <SH icon={Globe} title="Pays" color="#0d9488" />
            {errors.countries ? (
              <SectionError message={errors.countries} />
            ) : countryData.length > 0 ? (
              <div className="space-y-3">
                {countryData.map((c, i) => (
                  <div key={c.country || i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{getFlagEmoji(c.country)}</span>
                        <span className="text-xs font-semibold text-slate-700">{c.country || 'Inconnu'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{c.uniqueUsers || 0}u</span>
                        <span className="text-[11px] font-bold text-slate-500">{(c.sessions || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <Bar value={c.sessions || 0} max={countryData[0]?.sessions || 1} color="#0d9488" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-300 text-center py-8 font-medium">Aucune donnée</p>
            )}
          </div>
        </div>

        {/* ── 3 Columns: Roles / Security / Push ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Roles */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <SH icon={Shield} title="Répartition des rôles" color="#1e293b" />
            <div className="space-y-3">
              {[
                { role: 'super_admin',   label: 'Super Admin', color: '#f59e0b', bg: '#fef3c7' },
                { role: 'ecom_admin',    label: 'Admin',       color: '#059669', bg: '#d1fae5' },
                { role: 'ecom_closeuse', label: 'Closeuse',    color: '#0ea5e9', bg: '#e0f2fe' },
                { role: 'ecom_compta',   label: 'Compta',      color: '#8b5cf6', bg: '#ede9fe' },
                { role: 'ecom_livreur',  label: 'Livreur',     color: '#f97316', bg: '#ffedd5' },
              ].map(({ role, label, color, bg }) => {
                const count = roleCounts[role] || 0;
                const pct = userStats.totalUsers ? Math.round((count / userStats.totalUsers) * 100) : 0;
                return (
                  <div key={role} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                      <span className="text-xs font-extrabold" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-700">{label}</span>
                        <span className="text-[11px] font-bold text-slate-600">{count.toLocaleString()}</span>
                      </div>
                      <Bar value={count} max={userStats.totalUsers || 1} color={color} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <SH icon={Shield} title="Sécurité" color="#ef4444" />
            {errors.security ? (
              <SectionError message={errors.security} onRetry={() => retrySection('security')} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat label="Audit logs"  value={(secStats.totalAuditLogs ?? 0).toLocaleString()} color="#1e293b" bg="#f8fafc" />
                  <MiniStat label="Actions 24h" value={secStats.last24hActions ?? 0}                    color="#059669" bg="#ecfdf5" />
                  <MiniStat label="Échecs login" value={secStats.failedLoginsLast24h ?? 0}              color="#ef4444" bg="#fef2f2" />
                  <MiniStat label="Jamais co."  value={neverLoggedIn}                                   color="#64748b" bg="#f8fafc" />
                </div>
                {secStats.lastActivity && (
                  <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    Dernière activité : {new Date(secStats.lastActivity).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Push */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <SH icon={Bell} title="Notifications Push" color="#f59e0b" />
            {errors.push ? (
              <SectionError message={errors.push} />
            ) : pushStats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat label="Planifiées" value={pushStats.scheduled?.total ?? 0}        color="#1e293b" bg="#f8fafc" />
                  <MiniStat label="Délivrées"  value={pushStats.deliveries?.successful ?? 0}  color="#059669" bg="#ecfdf5" />
                  <MiniStat label="Échecs"     value={pushStats.deliveries?.failed ?? 0}       color="#ef4444" bg="#fef2f2" />
                  <MiniStat label="Abonnés"    value={pushStats.subscriptions?.total ?? 0}    color="#0ea5e9" bg="#e0f2fe" />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span><b className="text-slate-600">{pushStats.automations?.enabled ?? 0}</b>/{pushStats.automations?.total ?? 0} automations actives</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-300 text-center py-8 font-medium">Aucune donnée</p>
            )}
          </div>
        </div>

        {/* ── Recent Logins ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <SH icon={LogIn} title="Connexions récentes" subtitle={`${usersActivity?.totalLogins ?? 0} connexions sur la période`} color="#334155">
              <button onClick={() => navigate('/ecom/super-admin/users')}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors">
                Voir tous <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </SH>
          </div>
          {errors.activity ? (
            <div className="px-5 pb-5">
              <SectionError message={errors.activity} onRetry={() => retrySection('activity')} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-y border-slate-50" style={{ backgroundColor: '#f8fafc' }}>
                    {['Utilisateur', 'Rôle', 'Pays', 'Appareil', 'Date'].map((h, i) => (
                      <th key={h} className={`text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest ${i === 2 ? 'hidden sm:table-cell' : i === 3 ? 'hidden md:table-cell' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentLogins.length > 0 ? recentLogins.slice(0, 15).map((login, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {(login.name || login.email || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{login.name || login.email}</p>
                            {login.name && <p className="text-[10px] text-slate-400 truncate">{login.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><RoleBadge role={login.role} /></td>
                      <td className="px-4 py-3 hidden sm:table-cell"><span className="text-xs text-slate-500">{login.country || login.city || '—'}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-slate-500">{login.device ? `${login.device}${login.browser ? ` · ${login.browser}` : ''}` : '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {login.date ? new Date(login.date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-300 font-medium">Aucune connexion récente</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Workspaces ── */}
        {wsOk && workspaces.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <SH icon={Building2} title="Workspaces" subtitle={`${workspaces.length} espaces · ${totalMembers} membres`} color="#8b5cf6">
              <button onClick={() => navigate('/ecom/super-admin/workspaces')}
                className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors">
                Voir tous <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </SH>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
              {workspaces.slice(0, 12).map(ws => (
                <div key={ws._id} className="border border-slate-100 rounded-xl p-3.5 hover:border-violet-200 hover:shadow-sm transition-all group cursor-pointer"
                  onClick={() => navigate('/ecom/super-admin/workspaces')}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                      {(ws.name || 'W')[0].toUpperCase()}
                    </div>
                    <span className={`w-2 h-2 rounded-full mt-1 ${ws.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                  <p className="text-xs font-bold text-slate-800 truncate mb-1 group-hover:text-violet-700 transition-colors">{ws.name || 'Sans nom'}</p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Users className="w-3 h-3" /><span>{ws.memberCount || 0}</span>
                    {ws.plan && <span className="ml-auto font-bold text-violet-500 uppercase text-[9px]">{ws.plan}</span>}
                  </div>
                </div>
              ))}
            </div>
            {workspaces.length > 12 && (
              <p className="text-center text-[11px] text-slate-400 font-semibold mt-3 pt-3 border-t border-slate-50">
                +{workspaces.length - 12} autres workspaces
              </p>
            )}
          </div>
        )}

        {/* ── Executive Summary ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-2">
          {[
            { title: 'Croissance',  icon: TrendingUp,       gradient: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '#6ee7b7', accent: '#059669', l1: `${(userStats.totalUsers||0).toLocaleString()} utilisateurs`, l2: `+${kpis.signups??0} nouveaux · DAU ${kpis.dau??0}` },
            { title: 'Conversion',  icon: MousePointerClick, gradient: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '#93c5fd', accent: '#2563eb', l1: `${kpis.conversionSignup??0}% inscription`, l2: `${kpis.conversionActivation??0}% activation` },
            { title: 'Engagement',  icon: Zap,               gradient: 'linear-gradient(135deg,#faf5ff,#ede9fe)', border: '#c4b5fd', accent: '#7c3aed', l1: `${(kpis.totalPageViews??0).toLocaleString()} pages`, l2: `${kpis.totalSessions??0} sessions · ${kpis.avgSessionDuration??0}s` },
            { title: 'Opérations', icon: Shield,             gradient: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fcd34d', accent: '#d97706', l1: `${workspaces.length} workspaces`, l2: `${totalMembers} membres · ${secStats.last24hActions??0} actions/24h` },
          ].map(card => (
            <div key={card.title} className="rounded-2xl border-2 p-4 transition-all hover:shadow-md hover:-translate-y-0.5" style={{ background: card.gradient, borderColor: card.border }}>
              <div className="flex items-center gap-2 mb-2.5">
                <card.icon className="w-4 h-4" style={{ color: card.accent }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: card.accent }}>{card.title}</p>
              </div>
              <p className="text-base font-extrabold text-slate-900 leading-tight mb-1">{card.l1}</p>
              <p className="text-[11px] text-slate-500 font-medium">{card.l2}</p>
            </div>
          ))}
        </div>

      </div>
    </SuperAdminShell>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFlagEmoji(country) {
  const map = {
    'France': '🇫🇷', 'Cameroon': '🇨🇲', 'Cameroun': '🇨🇲', 'Senegal': '🇸🇳', 'Sénégal': '🇸🇳',
    'Ivory Coast': '🇨🇮', "Côte d'Ivoire": '🇨🇮', 'Nigeria': '🇳🇬', 'Benin': '🇧🇯', 'Bénin': '🇧🇯',
    'Togo': '🇹🇬', 'Mali': '🇲🇱', 'Burkina Faso': '🇧🇫', 'Guinea': '🇬🇳', 'Guinée': '🇬🇳',
    'Congo': '🇨🇬', 'Gabon': '🇬🇦', 'Ghana': '🇬🇭', 'United States': '🇺🇸', 'USA': '🇺🇸',
    'Canada': '🇨🇦', 'Belgium': '🇧🇪', 'Belgique': '🇧🇪', 'Switzerland': '🇨🇭', 'Suisse': '🇨🇭',
    'Morocco': '🇲🇦', 'Maroc': '🇲🇦', 'Algeria': '🇩🇿', 'Algérie': '🇩🇿', 'Tunisia': '🇹🇳', 'Tunisie': '🇹🇳',
  };
  return map[country] || '🌍';
}

export default SuperAdminDashboard;
