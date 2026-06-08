import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, TrendingDown, Users, Eye,
  AlertCircle, BarChart3, Shield,
  Building2, Smartphone, ChevronRight,
  Crown, Briefcase, Package, Calculator, Truck, LogIn
} from 'lucide-react';
import ecomApi, { clearEcomGetCache } from '../services/ecommApi.js';
import SuperAdminShell from '../components/SuperAdminShell.jsx';
import { DashboardSkeleton, SkeletonKpi, SectionError } from '../components/Skeleton.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const RANGE_TABS = [
  { value: '24h', label: '24h' },
  { value: '7d',  label: '7j'  },
  { value: '30d', label: '30j' },
  { value: '90d', label: '90j' },
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

const KpiCard = ({ label, value, sub, icon: Icon, spark, sparkColor = '#059669', accent = '#059669', accentLight = '#d1fae5', loading = false }) => {
  if (loading) return <SkeletonKpi />;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3 shadow-sm transition-colors duration-200 hover:border-slate-300">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border" style={{ backgroundColor: accentLight, borderColor: accentLight }}>
          {Icon && <Icon className="w-4 h-4" style={{ color: accent }} />}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-950 leading-none">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1.5 font-medium">{sub}</p>}
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
      <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ background: `${color}12`, borderColor: `${color}24` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

const MiniStat = ({ label, value, color = '#059669' }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-xl font-bold" style={{ color }}>{value}</p>
    <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>
  </div>
);

const Panel = ({ children, className = '' }) => (
  <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
    {children}
  </section>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);

  // Per-endpoint data
  const [userStats, setUserStats] = useState({});
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceSummary, setWorkspaceSummary] = useState({ totalWorkspaces: 0, totalActive: 0, totalMembers: 0 });
  const [overview, setOverview] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [pages, setPages] = useState([]);
  const [usersActivity, setUsersActivity] = useState(null);

  // Per-endpoint error tracking
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');

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
    if (d.traffic)    setTraffic(d.traffic);
    if (d.pages)      setPages(Array.isArray(d.pages) ? d.pages : []);
    if (d.activity)   setUsersActivity(d.activity);
  }, []);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) {
      // 1. Check sessionStorage — show stale data immediately so the page isn't blank
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_TTL * 5) {
            applyData(data);
            setInitialLoading(false);
            setRefreshing(true);
          }
        }
      } catch (_) {}

      // 2. Fetch quick stats (just counts, responds in <300 ms) to populate KPIs instantly
      //    while the full summary loads in parallel.
      if (initialLoading) {
        ecomApi.get('/super-admin/dashboard-quick', { timeout: 5000 }).then(qr => {
          const q = qr.data?.data;
          if (!q) return;
          setWorkspaceSummary(prev => ({
            ...prev,
            totalWorkspaces: q.totalWorkspaces || prev.totalWorkspaces,
            totalActive:     q.activeWorkspaces || prev.totalActive,
          }));
          setUserStats(prev => ({ ...prev, totalUsers: q.totalUsers || prev.totalUsers }));
          setInitialLoading(false);
        }).catch(() => {});
      }

      if (initialLoading) setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      // silent=true means the user clicked "Actualiser" — bypass both caches
      if (silent) clearEcomGetCache();
      const params = silent ? { range, _bypassCache: 'true' } : { range };
      const res = await ecomApi.get('/super-admin/dashboard-summary', { params, timeout: 60000, _bypassCache: silent });
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

  // Prefer backend-computed totals; fall back to client-side aggregation
  const totalMembers  = workspaceSummary.totalMembers || workspaces.reduce((s, w) => s + (w.memberCount || 0), 0);
  const activeWs      = workspaceSummary.totalActive  || workspaces.filter(w => w.isActive).length;
  const activeSessions10d = kpis.activeSessions10d ?? 0;
  const inactiveSessions10d = kpis.inactiveSessions10d ?? 0;
  const totalOpenSessions = kpis.totalOpenSessions ?? (activeSessions10d + inactiveSessions10d);
  const churnRate = kpis.churnRate10d ?? 0;

  const roleCounts = useMemo(() => {
    const map = {};
    (userStats.byRole || []).forEach(r => { map[r._id] = r.count; });
    return map;
  }, [userStats]);

  const sessionSparkData = useMemo(() => dailySessions.map(d => d.sessions || 0), [dailySessions]);

  const deviceData   = traffic?.byDevice || [];
  const topPages     = (Array.isArray(pages) ? pages : []).slice(0, 8);
  const recentLogins = usersActivity?.recentLogins || [];

  const rangeLabel = { '24h': '24h', '7d': '7 jours', '30d': '30 jours', '90d': '90 jours' }[range] || range;
  const usersOk     = !errors.users;
  const wsOk        = !errors.workspaces;

  // ─── Initial loading screen (skeleton) ──────────────────────────────────

  if (initialLoading) return <DashboardSkeleton />;

  // ─── Render ──────────────────────────────────────────────────────────────

  const rangeActions = (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
      {RANGE_TABS.map(t => (
        <button key={t.value} onClick={() => setRange(t.value)}
          className={`min-h-[36px] rounded-md px-3 text-xs font-semibold transition-colors ${
            range === t.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}>
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
        : 'Données partielles'
      }
      icon={BarChart3}
      error={globalError}
      refreshing={refreshing}
      onRefresh={() => fetchAll(true)}
      actions={rangeActions}
      maxWidth="1500px"
    >
      <div className="space-y-6">
        {Object.keys(errors).length > 0 && (
          <Panel className="border-red-200 bg-red-50">
            <div className="flex flex-wrap items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="font-semibold">Données partielles</span>
              {Object.entries(errors).map(([key, msg]) => (
                <span key={key} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-red-600">
                  {key}: {msg}
                </span>
              ))}
            </div>
          </Panel>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Utilisateurs"
            value={(userStats.totalUsers || 0).toLocaleString()}
            sub={`${userStats.totalActive || 0} comptes actifs`}
            icon={Users}
            accent="#0f766e"
            accentLight="#ccfbf1"
          />
          <KpiCard
            label="Sessions"
            value={(kpis.totalSessions ?? 0).toLocaleString()}
            sub={`${(kpis.uniqueVisitors ?? 0).toLocaleString()} visiteurs uniques`}
            icon={Eye}
            accent="#2563eb"
            accentLight="#dbeafe"
            spark={sessionSparkData}
            sparkColor="#2563eb"
          />
          <KpiCard
            label="Churn sessions"
            value={`${churnRate}%`}
            sub={`${inactiveSessions10d.toLocaleString()} inactives depuis +10j`}
            icon={TrendingDown}
            accent="#b45309"
            accentLight="#fef3c7"
          />
          <KpiCard
            label="Workspaces"
            value={(workspaceSummary.totalWorkspaces || workspaces.length).toLocaleString()}
            sub={`${activeWs} actifs · ${totalMembers.toLocaleString()} membres`}
            icon={Building2}
            accent="#475569"
            accentLight="#f1f5f9"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <Panel>
            <SH icon={Activity} title="Trafic" subtitle={`Sessions quotidiennes sur ${rangeLabel}`} color="#2563eb">
              <span className="text-xs font-semibold text-slate-500">
                {(kpis.totalPageViews ?? 0).toLocaleString()} pages vues
              </span>
            </SH>
            <AreaChart data={dailySessions} dataKey="sessions" color="#2563eb" h={210} />
          </Panel>

          <Panel>
            <SH icon={Shield} title="Santé des sessions" subtitle="Churn basé sur l'inactivité réelle" color="#b45309" />
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">Sessions actives</span>
                  <span className="font-semibold text-slate-900">{activeSessions10d.toLocaleString()}</span>
                </div>
                <Bar value={activeSessions10d} max={totalOpenSessions || 1} color="#0f766e" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">Inactives +10j</span>
                  <span className="font-semibold text-slate-900">{inactiveSessions10d.toLocaleString()}</span>
                </div>
                <Bar value={inactiveSessions10d} max={totalOpenSessions || 1} color="#b45309" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <MiniStat label="Rétention 7j" value={`${kpis.retention7d ?? 0}%`} color="#2563eb" />
                <MiniStat label="Rebond" value={`${kpis.bounceRate ?? 0}%`} color="#b45309" />
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel>
            <SH icon={Eye} title="Pages populaires" subtitle="Top vues" color="#2563eb" />
            {errors.pages ? (
              <SectionError message={errors.pages} onRetry={() => retrySection('pages')} />
            ) : topPages.length > 0 ? (
              <div className="space-y-3">
                {topPages.slice(0, 6).map((p, i) => (
                  <div key={p.page || i}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-slate-700">{p.page || '/'}</span>
                      <span className="text-xs font-semibold text-slate-500">{(p.views || 0).toLocaleString()}</span>
                    </div>
                    <Bar value={p.views || 0} max={topPages[0]?.views || 1} color="#2563eb" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">Aucune donnée</p>
            )}
          </Panel>

          <Panel>
            <SH icon={Smartphone} title="Appareils" subtitle="Répartition des sessions" color="#475569" />
            {errors.traffic ? (
              <SectionError message={errors.traffic} />
            ) : deviceData.length > 0 ? (
              <div className="space-y-3">
                {deviceData.map((d, i) => {
                  const total = deviceData.reduce((s, x) => s + (x.sessions || 0), 0) || 1;
                  const pct = Math.round(((d.sessions || 0) / total) * 100);
                  return (
                    <div key={d._id || i}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium capitalize text-slate-700">{d._id || 'Inconnu'}</span>
                        <span className="font-semibold text-slate-500">{pct}%</span>
                      </div>
                      <Bar value={d.sessions || 0} max={total} color="#475569" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">Aucune donnée</p>
            )}
          </Panel>

          <Panel>
            <SH icon={Shield} title="Rôles" subtitle="Comptes par rôle" color="#0f766e" />
            <div className="space-y-3">
              {[
                { role: 'super_admin', label: 'Super Admin', color: '#475569' },
                { role: 'ecom_admin', label: 'Admin', color: '#0f766e' },
                { role: 'ecom_closeuse', label: 'Closeuse', color: '#2563eb' },
                { role: 'ecom_compta', label: 'Compta', color: '#7c3aed' },
                { role: 'ecom_livreur', label: 'Livreur', color: '#b45309' },
              ].map(({ role, label, color }) => {
                const count = roleCounts[role] || 0;
                return (
                  <div key={role}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{label}</span>
                      <span className="font-semibold text-slate-500">{count.toLocaleString()}</span>
                    </div>
                    <Bar value={count} max={userStats.totalUsers || 1} color={color} />
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel className="overflow-hidden p-0">
            <div className="px-4 pt-4">
              <SH icon={LogIn} title="Connexions récentes" subtitle={`${usersActivity?.totalLogins ?? 0} connexions sur ${rangeLabel}`} color="#334155">
                <button onClick={() => navigate('/ecom/super-admin/users')}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                  Voir tous <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </SH>
            </div>
            {errors.activity ? (
              <div className="px-4 pb-4">
                <SectionError message={errors.activity} onRetry={() => retrySection('activity')} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50">
                      {['Utilisateur', 'Rôle', 'Appareil', 'Date'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 ${i === 2 ? 'hidden md:table-cell' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogins.length > 0 ? recentLogins.slice(0, 8).map((login, i) => (
                      <tr key={i} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="max-w-[220px] truncate text-sm font-semibold text-slate-800">{login.name || login.email}</p>
                          {login.name && <p className="max-w-[220px] truncate text-xs text-slate-500">{login.email}</p>}
                        </td>
                        <td className="px-4 py-3"><RoleBadge role={login.role} /></td>
                        <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                          {login.device ? `${login.device}${login.browser ? ` · ${login.browser}` : ''}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-500">
                          {login.date ? new Date(login.date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="4" className="px-4 py-10 text-center text-sm text-slate-400">Aucune connexion récente</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel>
            <SH icon={Building2} title="Workspaces" subtitle={`${totalMembers.toLocaleString()} membres au total`} color="#475569">
              <button onClick={() => navigate('/ecom/super-admin/workspaces')}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                Gérer <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </SH>
            {wsOk && workspaces.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {workspaces.slice(0, 8).map(ws => (
                  <button key={ws._id} onClick={() => navigate('/ecom/super-admin/workspaces')}
                    className="flex min-h-[56px] w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{ws.name || 'Sans nom'}</p>
                      <p className="text-xs text-slate-500">{ws.memberCount || 0} membre{(ws.memberCount || 0) > 1 ? 's' : ''}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${ws.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {ws.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">Aucun workspace</p>
            )}
          </Panel>
        </div>
      </div>
    </SuperAdminShell>
  );
};

export default SuperAdminDashboard;
