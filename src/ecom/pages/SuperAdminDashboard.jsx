import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Activity, TrendingUp, TrendingDown, Users, UserPlus, Eye, Zap,
  AlertCircle, RefreshCw, BarChart3, Clock, Target, Shield,
  Loader2, ArrowUpRight, ArrowDownRight, Building2, Globe,
  Smartphone, Monitor, Tablet, MousePointerClick, ChevronRight,
  CheckCircle2, Bell, LogIn, Layers, ArrowRight, RotateCcw,
  Crown, Briefcase, Package, Calculator, Truck, Settings,
  MessageSquare, FileText
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import { analyticsApi } from '../services/analytics.js';

// ─── Sub-Components ─────────────────────────────────────────────────────────

const Metric = ({ label, value, sub, icon: Icon, trend, trendUp, accent = 'text-slate-900' }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300">
    <div className="flex items-start justify-between mb-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      {Icon && <Icon className="w-4 h-4 text-slate-300" />}
    </div>
    <p className={`text-2xl font-extrabold tracking-tight ${accent}`}>{value}</p>
    <div className="flex items-center justify-between mt-1.5 min-h-[18px]">
      {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
      {trend != null && (
        <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </span>
      )}
    </div>
  </div>
);

const SectionHead = ({ icon: Icon, title, subtitle, color = 'from-emerald-600 to-teal-600', children }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
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

const ProgressBar = ({ value, max, color = 'bg-emerald-500' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const Sparkline = ({ data, width = 120, height = 32, color = '#059669' }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
      <polygon points={areaPoints} fill={color} fillOpacity="0.08" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const AreaChart = ({ data, dataKey, width = 800, height = 200, color = '#059669' }) => {
  if (!data || data.length < 2) return (
    <div className="flex items-center justify-center h-48 text-slate-300 text-sm">Pas assez de donnees</div>
  );
  const values = data.map(d => d[dataKey] || 0);
  const max = Math.max(...values, 1);
  const padL = 45, padR = 8, padT = 8, padB = 22;
  const cw = width - padL - padR, ch = height - padT - padB;
  const toX = i => padL + (i / (data.length - 1)) * cw;
  const toY = v => padT + ch - (v / max) * ch;
  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${toX(data.length - 1).toFixed(1)},${toY(0).toFixed(1)} L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`;
  const yTicks = [0, max * 0.25, max * 0.5, max * 0.75, max];
  const fmt = v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : Math.round(v);
  const labelInterval = Math.max(1, Math.floor(data.length / 7));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 200 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`area-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={toY(t)} x2={width - padR} y2={toY(t)} stroke="#f1f5f9" strokeWidth="1" />
          <text x={padL - 6} y={toY(t) + 3} textAnchor="end" fill="#94a3b8" fontSize="9" fontWeight="600">{fmt(t)}</text>
        </g>
      ))}
      <path d={areaPath} fill={`url(#area-${dataKey})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        if (i % labelInterval !== 0 && i !== data.length - 1) return null;
        const lbl = d.date || d._id || '';
        const short = lbl.length > 5 ? lbl.slice(5) : lbl;
        return <text key={i} x={toX(i)} y={height - 4} textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="600">{short}</text>;
      })}
      {values.map((v, i) => (
        <circle key={i} cx={toX(i)} cy={toY(v)} r="2.5" fill={color} stroke="white" strokeWidth="1.5">
          <title>{v}</title>
        </circle>
      ))}
    </svg>
  );
};

const DeviceIcon = ({ type }) => {
  const t = (type || '').toLowerCase();
  if (t.includes('mobile') || t.includes('phone')) return <Smartphone className="w-4 h-4" />;
  if (t.includes('tablet')) return <Tablet className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

const RoleBadge = ({ role }) => {
  const map = {
    super_admin: { label: 'Super Admin', cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Crown },
    ecom_admin: { label: 'Admin', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: Briefcase },
    ecom_closeuse: { label: 'Closeuse', cls: 'bg-sky-50 text-sky-700 ring-sky-200', icon: Package },
    ecom_compta: { label: 'Compta', cls: 'bg-violet-50 text-violet-700 ring-violet-200', icon: Calculator },
    ecom_livreur: { label: 'Livreur', cls: 'bg-orange-50 text-orange-700 ring-orange-200', icon: Truck },
  };
  const info = map[role] || { label: role || '—', cls: 'bg-slate-50 text-slate-600 ring-slate-200', icon: Users };
  const I = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ring-1 ring-inset ${info.cls}`}>
      <I className="w-3 h-3" />{info.label}
    </span>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({});
  const [workspaces, setWorkspaces] = useState([]);
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [countries, setCountries] = useState([]);
  const [pages, setPages] = useState([]);
  const [usersActivity, setUsersActivity] = useState(null);
  const [security, setSecurity] = useState(null);
  const [pushStats, setPushStats] = useState(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = { range };
      const results = await Promise.allSettled([
        ecomApi.get('/super-admin/users', { params: { limit: 1000 } }),
        ecomApi.get('/super-admin/workspaces'),
        analyticsApi.getOverview(params),
        analyticsApi.getFunnel(params),
        analyticsApi.getTraffic(params),
        analyticsApi.getCountries(params),
        analyticsApi.getPages(params),
        analyticsApi.getUsersActivity(params),
        ecomApi.get('/super-admin/security-info'),
        ecomApi.get('/super-admin/push/stats'),
      ]);
      const val = (r) => r.status === 'fulfilled' ? r.value?.data?.data : null;
      const uData = val(results[0]);
      if (uData) { setUsers(uData.users || []); setUserStats(uData.stats || {}); }
      const wsData = val(results[1]);
      if (wsData) setWorkspaces(wsData.workspaces || []);
      const ov = val(results[2]);
      if (ov) setOverview(ov);
      const fn = val(results[3]);
      if (fn) setFunnel(fn);
      const tr = val(results[4]);
      if (tr) setTraffic(tr);
      const co = val(results[5]);
      if (co) setCountries(co.countries || co || []);
      const pg = val(results[6]);
      if (pg) setPages(pg.pages || pg || []);
      const ua = val(results[7]);
      if (ua) setUsersActivity(ua);
      const sec = val(results[8]);
      if (sec) setSecurity(sec);
      const ps = val(results[9]);
      if (ps) setPushStats(ps);
      setError('');
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(() => fetchAll(true), 60000);
    return () => clearInterval(timerRef.current);
  }, [fetchAll]);

  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 6000); return () => clearTimeout(t); } }, [error]);

  // ─── Derived data ───────────────────────────────────────────────────────

  const kpis = overview?.kpis || {};
  const trends = overview?.trends || {};
  const dailySessions = trends.dailySessions || [];
  const dailySignups = trends.dailySignups || [];

  const totalMembers = useMemo(() => workspaces.reduce((s, w) => s + (w.memberCount || 0), 0), [workspaces]);
  const activeWs = useMemo(() => workspaces.filter(w => w.isActive).length, [workspaces]);
  const neverLoggedIn = useMemo(() => users.filter(u => !u.lastLogin).length, [users]);

  const activationRate = userStats.totalUsers ? Math.round(((userStats.totalActive || 0) / userStats.totalUsers) * 100) : 0;
  const churnRate = kpis.retention7d != null ? 100 - kpis.retention7d : 100 - activationRate;

  const roleCounts = useMemo(() => {
    const map = {};
    (userStats.byRole || []).forEach(r => { map[r._id] = r.count; });
    return map;
  }, [userStats]);

  const signupTrend = useMemo(() => {
    if (dailySignups.length < 4) return null;
    const half = Math.floor(dailySignups.length / 2);
    const first = dailySignups.slice(0, half).reduce((s, d) => s + d.count, 0);
    const second = dailySignups.slice(half).reduce((s, d) => s + d.count, 0);
    if (first === 0) return second > 0 ? '+100%' : '0%';
    const pct = Math.round(((second - first) / first) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }, [dailySignups]);

  const sessionSparkData = useMemo(() => dailySessions.map(d => d.sessions || 0), [dailySessions]);
  const signupSparkData = useMemo(() => dailySignups.map(d => d.count || 0), [dailySignups]);

  const funnelSteps = funnel?.funnel || [];
  const dropoffs = funnel?.dropoffs || [];
  const funnelIcons = [Eye, UserPlus, CheckCircle2, Building2, Zap];
  const funnelColors = [
    'border-emerald-200 bg-emerald-50 text-emerald-800',
    'border-sky-200 bg-sky-50 text-sky-800',
    'border-teal-200 bg-teal-50 text-teal-800',
    'border-violet-200 bg-violet-50 text-violet-800',
    'border-amber-200 bg-amber-50 text-amber-800',
  ];

  const deviceData = traffic?.byDevice || [];
  const browserData = (traffic?.byBrowser || []).slice(0, 6);
  const countryData = (Array.isArray(countries) ? countries : []).slice(0, 8);
  const topPages = (Array.isArray(pages) ? pages : []).slice(0, 8);
  const recentLogins = usersActivity?.recentLogins || [];
  const secStats = security?.stats || {};

  const rangeLabel = { '24h': '24h', '7d': '7 jours', '30d': '30 jours', '90d': '90 jours' }[range] || range;

  // ─── Loading ────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-3">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-500">Chargement du dashboard...</p>
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Super Admin</h1>
            <p className="text-sm text-slate-400 mt-1">Vue globale de la plateforme</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all"
              title="Actualiser"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <select
              value={range}
              onChange={e => setRange(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="24h">24 heures</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
              <option value="90d">90 jours</option>
            </select>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl ring-1 ring-emerald-200">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
            </span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex flex-wrap gap-1.5 bg-white rounded-2xl border border-slate-200/80 p-1.5">
          {[
            { to: '/ecom/super-admin', label: 'Dashboard', icon: BarChart3 },
            { to: '/ecom/super-admin/users', label: 'Utilisateurs', icon: Users },
            { to: '/ecom/super-admin/workspaces', label: 'Workspaces', icon: Building2 },
            { to: '/ecom/super-admin/analytics', label: 'Analytics', icon: Activity },
            { to: '/ecom/super-admin/activity', label: 'Activite', icon: Clock },
            { to: '/ecom/super-admin/push', label: 'Push', icon: Bell },
            { to: '/ecom/super-admin/whatsapp-postulations', label: 'WhatsApp', icon: MessageSquare },
            { to: '/ecom/whatsapp/instances', label: 'Instances', icon: Smartphone },
            { to: '/ecom/super-admin/whatsapp-logs', label: 'WA Logs', icon: FileText },
            { to: '/ecom/super-admin/settings', label: 'Config', icon: Settings },
          ].map(({ to, label, icon: NavIcon }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <NavIcon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* KPI Row 1: Growth */}
        <section>
          <SectionHead icon={TrendingUp} title="Croissance" subtitle="Acquisition & retention" color="from-emerald-600 to-teal-600" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Metric label="Utilisateurs" value={userStats.totalUsers || 0} sub={`${userStats.totalActive || 0} actifs`} icon={Users} />
            <Metric label="Nouveaux" value={kpis.signups ?? 0} sub={rangeLabel} icon={UserPlus} accent="text-emerald-700" trend={signupTrend} trendUp={signupTrend?.startsWith('+')} />
            <Metric label="DAU" value={kpis.dau ?? 0} sub={`WAU ${kpis.wau ?? 0} · MAU ${kpis.mau ?? 0}`} icon={Activity} accent="text-emerald-600" />
            <Metric label="Activation" value={`${activationRate}%`} sub={`${userStats.totalActive || 0}/${userStats.totalUsers || 0}`} icon={Target} accent="text-teal-600" />
            <Metric label="Retention 7j" value={`${kpis.retention7d ?? 0}%`} sub="Retenus" icon={RotateCcw} accent="text-teal-600" />
            <Metric label="Churn" value={`${churnRate}%`} sub={`${neverLoggedIn} jamais co.`} icon={TrendingDown} accent="text-amber-600" />
          </div>
        </section>

        {/* KPI Row 2: Engagement */}
        <section>
          <SectionHead icon={BarChart3} title="Engagement" subtitle="Sessions, pages vues & duree" color="from-sky-600 to-sky-700" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Metric label="Sessions" value={(kpis.totalSessions ?? 0).toLocaleString()} sub={`${kpis.uniqueVisitors ?? 0} uniques`} icon={Eye} />
            <Metric label="Pages vues" value={(kpis.totalPageViews ?? 0).toLocaleString()} icon={Layers} />
            <Metric label="Dur. moy." value={`${kpis.avgSessionDuration ?? 0}s`} icon={Clock} accent="text-sky-600" />
            <Metric label="Taux rebond" value={`${kpis.bounceRate ?? 0}%`} icon={TrendingDown} accent="text-amber-600" />
            <Metric label="Workspaces" value={workspaces.length} sub={`${activeWs} actifs`} icon={Building2} accent="text-violet-600" />
            <Metric label="Membres" value={totalMembers} sub={`${workspaces.length > 0 ? (totalMembers / workspaces.length).toFixed(1) : 0}/ws`} icon={Users} accent="text-slate-700" />
          </div>
        </section>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily Sessions */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <SectionHead icon={Activity} title="Sessions quotidiennes" color="from-emerald-600 to-emerald-700">
              <Sparkline data={sessionSparkData} color="#059669" />
            </SectionHead>
            <AreaChart data={dailySessions} dataKey="sessions" color="#059669" />
            {dailySessions.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-lg font-extrabold text-slate-800">{dailySessions.reduce((s, d) => s + (d.sessions || 0), 0).toLocaleString()}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-emerald-700">{Math.max(...dailySessions.map(d => d.sessions || 0))}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Peak</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-teal-600">{Math.round(dailySessions.reduce((s, d) => s + (d.sessions || 0), 0) / dailySessions.length)}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Moyenne</p>
                </div>
              </div>
            )}
          </div>

          {/* Daily Signups */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <SectionHead icon={UserPlus} title="Inscriptions quotidiennes" color="from-violet-600 to-violet-700">
              <Sparkline data={signupSparkData} color="#7c3aed" />
            </SectionHead>
            <AreaChart data={dailySignups} dataKey="count" color="#7c3aed" />
            {dailySignups.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-lg font-extrabold text-slate-800">{dailySignups.reduce((s, d) => s + (d.count || 0), 0)}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-violet-700">{Math.max(...dailySignups.map(d => d.count || 0))}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Peak</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-violet-600">{(dailySignups.reduce((s, d) => s + (d.count || 0), 0) / dailySignups.length).toFixed(1)}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Moyenne</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Conversion Funnel */}
        {funnelSteps.length > 0 && (
          <section>
            <SectionHead icon={MousePointerClick} title="Funnel de Conversion" subtitle="Visiteurs → Actifs" color="from-amber-500 to-orange-500" />
            <div className="flex flex-wrap gap-3">
              {funnelSteps.map((step, i) => {
                const Ic = funnelIcons[i] || Zap;
                return (
                  <React.Fragment key={step.step}>
                    <div className={`flex-1 min-w-[140px] rounded-2xl border-2 p-4 ${funnelColors[i] || funnelColors[0]} transition-all hover:shadow-md`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Ic className="w-3.5 h-3.5 opacity-60" />
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{step.step}</span>
                      </div>
                      <p className="text-2xl font-extrabold">{(step.count || 0).toLocaleString()}</p>
                      <p className="text-xs font-semibold opacity-70">{step.rate}%</p>
                    </div>
                    {i < funnelSteps.length - 1 && dropoffs[i] && (
                      <div className="flex items-center justify-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <ArrowRight className="w-4 h-4 text-slate-300" />
                          <span className="text-[9px] font-bold text-red-400">-{dropoffs[i].dropRate}%</span>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <Metric label="Visite → Inscription" value={`${kpis.conversionSignup ?? 0}%`} icon={MousePointerClick} accent="text-emerald-700" />
              <Metric label="Inscription → Workspace" value={`${kpis.conversionActivation ?? 0}%`} icon={CheckCircle2} accent="text-teal-600" />
              <Metric label="Taux de rebond" value={`${kpis.bounceRate ?? 0}%`} icon={TrendingDown} accent="text-amber-600" />
              <Metric label="Visiteurs uniques" value={(kpis.uniqueVisitors ?? 0).toLocaleString()} icon={Users} />
            </div>
          </section>
        )}

        {/* 3 Columns: Pages / Traffic / Countries */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Top Pages */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <SectionHead icon={Eye} title="Pages populaires" color="from-sky-600 to-sky-700" />
            <div className="space-y-2.5">
              {topPages.length > 0 ? topPages.map((p, i) => {
                const maxViews = topPages[0]?.views || 1;
                return (
                  <div key={p.page || i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[70%]">{p.page || '/'}</span>
                      <span className="text-[11px] font-bold text-slate-500">{(p.views || 0).toLocaleString()}</span>
                    </div>
                    <ProgressBar value={p.views || 0} max={maxViews} color="bg-sky-500" />
                  </div>
                );
              }) : <p className="text-sm text-slate-400 text-center py-6">Aucune donnee</p>}
            </div>
          </div>

          {/* Traffic by Device */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <SectionHead icon={Smartphone} title="Appareils" color="from-violet-600 to-violet-700" />
            <div className="space-y-3">
              {deviceData.length > 0 ? deviceData.map((d, i) => {
                const total = deviceData.reduce((s, x) => s + (x.sessions || 0), 0) || 1;
                const pct = Math.round(((d.sessions || 0) / total) * 100);
                return (
                  <div key={d._id || i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
                      <DeviceIcon type={d._id} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-700 capitalize">{d._id || 'Inconnu'}</span>
                        <span className="text-[11px] font-bold text-slate-500">{pct}%</span>
                      </div>
                      <ProgressBar value={d.sessions || 0} max={total} color="bg-violet-500" />
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-slate-400 text-center py-6">Aucune donnee</p>}
              {browserData.length > 0 && (
                <>
                  <div className="border-t border-slate-100 pt-3 mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Navigateurs</p>
                  </div>
                  {browserData.map((b, i) => (
                    <div key={b._id || i} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">{b._id || 'Autre'}</span>
                      <span className="text-[11px] font-bold text-slate-500">{(b.sessions || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Countries */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <SectionHead icon={Globe} title="Pays" color="from-teal-600 to-teal-700" />
            <div className="space-y-2.5">
              {countryData.length > 0 ? countryData.map((c, i) => {
                const maxSessions = countryData[0]?.sessions || 1;
                return (
                  <div key={c.country || i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700">{c.country || 'Inconnu'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{c.uniqueUsers || 0} u.</span>
                        <span className="text-[11px] font-bold text-slate-500">{(c.sessions || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <ProgressBar value={c.sessions || 0} max={maxSessions} color="bg-teal-500" />
                  </div>
                );
              }) : <p className="text-sm text-slate-400 text-center py-6">Aucune donnee</p>}
            </div>
          </div>
        </div>

        {/* Roles + Security + Push */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Roles */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <SectionHead icon={Shield} title="Roles" color="from-slate-700 to-slate-800" />
            <div className="space-y-3">
              {[
                { role: 'super_admin', label: 'Super Admin', color: 'bg-amber-500' },
                { role: 'ecom_admin', label: 'Admin', color: 'bg-emerald-500' },
                { role: 'ecom_closeuse', label: 'Closeuse', color: 'bg-sky-500' },
                { role: 'ecom_compta', label: 'Compta', color: 'bg-violet-500' },
                { role: 'ecom_livreur', label: 'Livreur', color: 'bg-orange-500' },
              ].map(({ role, label, color }) => {
                const count = roleCounts[role] || 0;
                const pct = userStats.totalUsers ? Math.round((count / userStats.totalUsers) * 100) : 0;
                return (
                  <div key={role} className="flex items-center gap-3">
                    <div className={`w-2 h-8 rounded-full ${color}`} />
                    <div className="flex-1">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs font-semibold text-slate-700">{label}</span>
                        <span className="text-[11px] font-bold text-slate-500">{count} <span className="text-slate-400">({pct}%)</span></span>
                      </div>
                      <ProgressBar value={count} max={userStats.totalUsers || 1} color={color} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <SectionHead icon={Shield} title="Securite" color="from-red-500 to-red-600" />
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold text-slate-800">{(secStats.totalAuditLogs ?? 0).toLocaleString()}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase mt-1">Audit logs</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold text-emerald-700">{secStats.last24hActions ?? 0}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase mt-1">Actions 24h</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold text-red-600">{secStats.failedLoginsLast24h ?? 0}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase mt-1">Echecs login</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold text-slate-700">{neverLoggedIn}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase mt-1">Jamais co.</p>
              </div>
            </div>
            {secStats.lastActivity && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
                Derniere activite: {new Date(secStats.lastActivity).toLocaleString('fr-FR')}
              </div>
            )}
          </div>

          {/* Push Stats */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <SectionHead icon={Bell} title="Notifications Push" color="from-amber-500 to-amber-600" />
            {pushStats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-slate-800">{pushStats.scheduled?.total ?? 0}</p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mt-1">Planifiees</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-emerald-700">{pushStats.deliveries?.successful ?? 0}</p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mt-1">Delivrees</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-red-500">{pushStats.deliveries?.failed ?? 0}</p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mt-1">Echecs</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-sky-600">{pushStats.subscriptions?.total ?? 0}</p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mt-1">Abonnes</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Zap className="w-3 h-3" />
                  {pushStats.automations?.enabled ?? 0}/{pushStats.automations?.total ?? 0} automations actives
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">Aucune donnee</p>
            )}
          </div>
        </div>

        {/* Recent Logins */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <SectionHead icon={LogIn} title="Connexions recentes" subtitle={`${usersActivity?.totalLogins ?? 0} connexions sur la periode`} color="from-slate-700 to-slate-800">
            <button
              onClick={() => navigate('/ecom/super-admin/users')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
            >
              Voir tous <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </SectionHead>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Utilisateur</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Pays</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Appareil</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentLogins.length > 0 ? recentLogins.slice(0, 15).map((login, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{login.name || login.email}</p>
                        {login.name && <p className="text-[10px] text-slate-400">{login.email}</p>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><RoleBadge role={login.role} /></td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <span className="text-xs text-slate-500">{login.country || login.city || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <span className="text-xs text-slate-500">{login.device ? `${login.device}${login.browser ? ` · ${login.browser}` : ''}` : '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-400">{login.date ? new Date(login.date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" className="px-3 py-8 text-center text-sm text-slate-400">Aucune connexion recente</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Workspaces Overview */}
        {workspaces.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <SectionHead icon={Building2} title="Workspaces" subtitle={`${workspaces.length} espaces · ${totalMembers} membres`} color="from-violet-600 to-violet-700" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {workspaces.slice(0, 8).map(ws => (
                <div key={ws._id} className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-slate-800 truncate">{ws.name || 'Sans nom'}</h4>
                    <span className={`w-2 h-2 rounded-full ${ws.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ws.memberCount || 0}</span>
                    {ws.createdAt && <span>{new Date(ws.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
              ))}
            </div>
            {workspaces.length > 8 && (
              <p className="text-center text-[11px] text-slate-400 font-semibold mt-3 pt-3 border-t border-slate-100">
                +{workspaces.length - 8} autres workspaces
              </p>
            )}
          </div>
        )}

        {/* Executive Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { title: 'Croissance', icon: TrendingUp, color: 'from-emerald-50 to-emerald-100 border-emerald-200', iconColor: 'text-emerald-700',
              line1: `${userStats.totalUsers || 0} utilisateurs`, line2: `+${kpis.signups ?? 0} · DAU ${kpis.dau ?? 0}` },
            { title: 'Conversion', icon: MousePointerClick, color: 'from-sky-50 to-sky-100 border-sky-200', iconColor: 'text-sky-700',
              line1: `${kpis.conversionSignup ?? 0}% signup`, line2: `${kpis.conversionActivation ?? 0}% activation` },
            { title: 'Engagement', icon: Zap, color: 'from-violet-50 to-violet-100 border-violet-200', iconColor: 'text-violet-700',
              line1: `${(kpis.totalPageViews ?? 0).toLocaleString()} pages`, line2: `${kpis.totalSessions ?? 0} sessions · ${kpis.avgSessionDuration ?? 0}s` },
            { title: 'Operations', icon: Shield, color: 'from-amber-50 to-amber-100 border-amber-200', iconColor: 'text-amber-700',
              line1: `${workspaces.length} workspaces`, line2: `${totalMembers} membres · ${secStats.last24hActions ?? 0} actions/24h` },
          ].map(card => (
            <div key={card.title} className={`rounded-2xl bg-gradient-to-br ${card.color} border-2 p-5 transition-all hover:shadow-md hover:-translate-y-0.5`}>
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                <p className={`text-[10px] font-bold uppercase tracking-wider ${card.iconColor}`}>{card.title}</p>
              </div>
              <p className="text-xl font-extrabold text-slate-900 mb-0.5">{card.line1}</p>
              <p className="text-[11px] text-slate-500 font-medium">{card.line2}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default SuperAdminDashboard;
