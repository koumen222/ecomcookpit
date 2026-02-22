import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Activity, Target, RotateCcw, TrendingDown,
  MousePointerClick, CheckCircle2, CreditCard, BarChart3,
  Eye, Clock, Zap, Building2, FolderKanban, Shield,
  AlertCircle, Crown, Briefcase, Package, Truck, Calculator,
  TrendingUp, ArrowUpRight, ArrowDownRight, Loader2
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import { analyticsApi } from '../services/analytics.js';

const roleLabels = {
  super_admin: 'Super Admin',
  ecom_admin: 'Admin',
  ecom_closeuse: 'Closeuse',
  ecom_compta: 'Comptable',
  ecom_livreur: 'Livreur'
};

const KpiCard = ({ value, label, sub, accent, trend, trendUp, icon: Icon }) => (
  <div className="group relative bg-white rounded-2xl border border-slate-200/60 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/5 hover:border-slate-300 hover:-translate-y-1 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors" />}
      </div>
      <p className={`text-3xl font-black tracking-tight ${accent || 'text-slate-900'} mb-2`}>{value}</p>
      <div className="flex items-center justify-between min-h-[20px]">
        {sub && <p className="text-xs text-slate-500 font-medium">{sub}</p>}
        {trend !== undefined && trend !== null && (
          <span className={`inline-flex items-center gap-1 text-xs font-bold ${trendUp ? 'text-emerald-600' : 'text-rose-500'}`}>
            {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </span>
        )}
      </div>
    </div>
  </div>
);

const FunnelStep = ({ label, count, rate, dropRate, isLast, color, icon: Icon }) => (
  <div className="flex-1 min-w-[160px]">
    <div className={`rounded-2xl border-2 p-5 ${color} transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default`}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-4 h-4 opacity-60" />}
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      </div>
      <p className="text-xl sm:text-3xl font-black mb-0.5 sm:mb-1">{count.toLocaleString()}</p>
      <p className="text-sm font-semibold opacity-80">{rate}% du total</p>
    </div>
    {!isLast && dropRate !== undefined && (
      <div className="flex items-center justify-center my-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200">
          <TrendingDown className="w-3 h-3" />
          {dropRate}% drop
        </div>
      </div>
    )}
  </div>
);

const MiniBar = ({ value, max, color = 'bg-violet-500' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
      <div
        className={`h-full rounded-full ${color} transition-all duration-700 ease-out shadow-sm`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

const Badge = ({ children, className = '', icon: Icon }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ring-1 ring-inset ${className}`}>
    {Icon && <Icon className="w-3 h-3" />}
    {children}
  </span>
);

const SectionTitle = ({ icon: Icon, title, subtitle, gradient }) => (
  <div className="flex items-center gap-4 mb-6">
    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg shadow-slate-900/10`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 font-medium mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [stats, setStats] = useState({});
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('30d');

  const fetchAll = async (r) => {
    const currentRange = r || range;
    try {
      const [usersRes, wsRes, overviewRes, funnelRes, secRes] = await Promise.allSettled([
        ecomApi.get('/super-admin/users', { params: { limit: 1000 } }),
        ecomApi.get('/super-admin/workspaces'),
        analyticsApi.getOverview(currentRange),
        analyticsApi.getFunnel(currentRange),
        ecomApi.get('/super-admin/security-info'),
      ]);
      if (usersRes.status === 'fulfilled') { setUsers(usersRes.value.data.data.users); setStats(usersRes.value.data.data.stats); }
      if (wsRes.status === 'fulfilled') setWorkspaces(wsRes.value.data.data.workspaces);
      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data.data);
      if (funnelRes.status === 'fulfilled') setFunnel(funnelRes.value.data.data);
      if (secRes.status === 'fulfilled') setSecurity(secRes.value.data.data);
    } catch { setError('Erreur chargement des donnees'); }
  };

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) fetchAll(range);
  }, [range]);

  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  const kpis = overview?.kpis || {};
  const trends = overview?.trends || {};
  const funnelSteps = funnel?.funnel || [];
  const dropoffs = funnel?.dropoffs || [];
  const secStats = security?.stats || {};

  const totalMembers = useMemo(() => workspaces.reduce((s, w) => s + (w.memberCount || 0), 0), [workspaces]);
  const activeWs = useMemo(() => workspaces.filter(w => w.isActive).length, [workspaces]);
  const neverLoggedIn = useMemo(() => users.filter(u => !u.lastLogin).length, [users]);
  const noWorkspace = useMemo(() => users.filter(u => !u.workspaceId).length, [users]);
  const activationRate = stats.totalUsers ? Math.round(((stats.totalActive || 0) / stats.totalUsers) * 100) : 0;
  const churnRate = kpis.retention7d !== undefined ? (100 - kpis.retention7d) : (100 - activationRate);

  const roleCounts = useMemo(() => {
    const map = {};
    (stats.byRole || []).forEach(r => { map[r._id] = r.count; });
    return map;
  }, [stats]);

  const now = new Date();
  const newUsersDay = useMemo(() => users.filter(u => new Date(u.createdAt) > new Date(now - 86400000)).length, [users]);
  const newUsersWeek = useMemo(() => users.filter(u => new Date(u.createdAt) > new Date(now - 7 * 86400000)).length, [users]);
  const newUsersMonth = useMemo(() => users.filter(u => new Date(u.createdAt) > new Date(now - 30 * 86400000)).length, [users]);

  const dailySignups = trends.dailySignups || [];
  const signupTrend = useMemo(() => {
    if (dailySignups.length < 2) return null;
    const half = Math.floor(dailySignups.length / 2);
    const first = dailySignups.slice(0, half).reduce((s, d) => s + d.count, 0);
    const second = dailySignups.slice(half).reduce((s, d) => s + d.count, 0);
    if (first === 0) return second > 0 ? '+100%' : '0%';
    const pct = Math.round(((second - first) / first) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }, [dailySignups]);
  const signupTrendUp = signupTrend ? signupTrend.startsWith('+') : false;

  const funnelColors = [
    'bg-violet-50 border-violet-200 text-violet-900',
    'bg-sky-50 border-sky-200 text-sky-900',
    'bg-teal-50 border-teal-200 text-teal-900',
    'bg-emerald-50 border-emerald-200 text-emerald-900',
    'bg-amber-50 border-amber-200 text-amber-900',
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
        <p className="text-sm text-slate-600 font-semibold">Chargement du dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Overview Global</h1>
            <p className="text-sm text-slate-600 font-medium mt-2">Executive dashboard — vision claire en 10 secondes</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={range} onChange={(e) => setRange(e.target.value)}
              className="px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 cursor-pointer transition-all">
              <option value="24h">Dernières 24h</option>
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="90d">90 derniers jours</option>
            </select>
            <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20" icon={Activity}>Live</Badge>
          </div>
        </div>

        <div>
          <SectionTitle icon={TrendingUp} title="KPIs Croissance" subtitle="Acquisition, engagement & retention utilisateurs" gradient="from-violet-600 to-purple-600" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard value={stats.totalUsers || 0} label="Total Utilisateurs" accent="text-slate-900" sub={`${stats.totalActive || 0} actifs`} icon={Users} />
            <KpiCard
              value={kpis.signups ?? newUsersMonth}
              label="Nouveaux Inscrits"
              accent="text-violet-600"
              sub={range === '24h' ? 'Dernières 24h' : range === '7d' ? '7 jours' : range === '90d' ? '90 jours' : '30 jours'}
              trend={signupTrend}
              trendUp={signupTrendUp}
              icon={UserPlus}
            />
            <KpiCard
              value={kpis.dau ?? 0}
              label="DAU"
              accent="text-emerald-600"
              sub={`WAU: ${kpis.wau ?? 0} · MAU: ${kpis.mau ?? 0}`}
              icon={Activity}
            />
            <KpiCard value={`${activationRate}%`} label="Taux d'Activation" accent="text-sky-600" sub={`${stats.totalActive || 0} / ${stats.totalUsers || 0}`} icon={Target} />
            <KpiCard value={`${kpis.retention7d ?? 0}%`} label="Retention 7j" accent="text-teal-600" sub="Utilisateurs retenus" icon={RotateCcw} />
            <KpiCard value={`${churnRate}%`} label="Taux de Churn" accent="text-rose-600" sub={`${neverLoggedIn} jamais connectes`} icon={TrendingDown} />
          </div>
        </div>

        <div>
          <SectionTitle icon={MousePointerClick} title="KPIs Conversion" subtitle="Funnel reel: visiteurs → inscrits → actives → workspace" gradient="from-rose-600 to-pink-600" />
          {funnelSteps.length > 0 ? (
            <div>
              <div className="flex flex-wrap gap-3 mb-4">
                {funnelSteps.map((step, i) => {
                  const icons = [Eye, UserPlus, CheckCircle2, Building2, Zap];
                  return (
                    <FunnelStep
                      key={step.step}
                      label={step.step}
                      count={step.count}
                      rate={step.rate}
                      dropRate={dropoffs[i]?.dropRate}
                      isLast={i === funnelSteps.length - 1}
                      color={funnelColors[i] || funnelColors[0]}
                      icon={icons[i]}
                    />
                  );
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KpiCard value={`${kpis.conversionSignup ?? 0}%`} label="Visites → Inscriptions" accent="text-violet-600" icon={MousePointerClick} />
                <KpiCard value={`${kpis.conversionActivation ?? 0}%`} label="Inscrits → Workspace" accent="text-sky-600" icon={CheckCircle2} />
                <KpiCard value={`${kpis.bounceRate ?? 0}%`} label="Taux de Rebond" accent="text-amber-600" icon={TrendingDown} />
                <KpiCard
                  value={kpis.totalSessions ?? 0}
                  label="Sessions Totales"
                  accent="text-slate-900"
                  sub={`${kpis.uniqueVisitors ?? 0} visiteurs uniques`}
                  icon={Activity}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard value={`${kpis.conversionSignup ?? 0}%`} label="Visites → Inscriptions" accent="text-violet-600" icon={MousePointerClick} />
              <KpiCard value={`${kpis.conversionActivation ?? 0}%`} label="Inscrits → Workspace" accent="text-sky-600" icon={CheckCircle2} />
              <KpiCard value={`${kpis.bounceRate ?? 0}%`} label="Taux de Rebond" accent="text-amber-600" icon={TrendingDown} />
              <KpiCard value={kpis.totalSessions ?? 0} label="Sessions Totales" accent="text-slate-900" sub={`${kpis.uniqueVisitors ?? 0} visiteurs uniques`} icon={Activity} />
            </div>
          )}
        </div>

        <div>
          <SectionTitle icon={BarChart3} title="KPIs Trafic & Engagement" subtitle="Pages vues, duree de session, activite" gradient="from-sky-600 to-blue-600" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard value={kpis.totalPageViews ?? 0} label="Pages Vues" accent="text-slate-900" icon={Eye} />
            <KpiCard value={`${kpis.avgSessionDuration ?? 0}s`} label="Duree Moy. Session" accent="text-sky-600" icon={Clock} />
            <KpiCard value={kpis.uniqueVisitors ?? 0} label="Visiteurs Uniques" accent="text-violet-600" icon={Users} />
            <KpiCard value={kpis.activatedUsers ?? 0} label="Utilisateurs Actives" accent="text-emerald-600" sub="Avec workspace" icon={CheckCircle2} />
            <KpiCard value={kpis.workspacesCreated ?? 0} label="Workspaces Crees" accent="text-teal-600" sub={`Sur la periode`} icon={Building2} />
            <KpiCard value={noWorkspace} label="Sans Workspace" accent="text-amber-600" sub="Inscrits orphelins" icon={AlertCircle} />
          </div>
        </div>

        <div>
          <SectionTitle icon={Shield} title="KPIs Operationnels" subtitle="Sante de la plateforme, equipes & securite" gradient="from-amber-600 to-orange-600" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard value={workspaces.length} label="Workspaces" accent="text-violet-600" sub={`${activeWs} actifs`} icon={Building2} />
            <KpiCard value={totalMembers} label="Membres Total" accent="text-sky-600" sub={`${workspaces.length > 0 ? (totalMembers / workspaces.length).toFixed(1) : 0} moy/ws`} icon={Users} />
            <KpiCard value={secStats.totalAuditLogs ?? 0} label="Actions Tracees" accent="text-slate-900" sub="Audit logs" icon={Shield} />
            <KpiCard value={secStats.last24hActions ?? 0} label="Actions 24h" accent="text-emerald-600" icon={Zap} />
            <KpiCard value={secStats.failedLoginsLast24h ?? 0} label="Echecs Login 24h" accent="text-rose-600" icon={AlertCircle} />
            <KpiCard value={neverLoggedIn} label="Jamais Connectes" accent="text-amber-600" sub={`${stats.totalUsers ? Math.round((neverLoggedIn / stats.totalUsers) * 100) : 0}% du total`} icon={TrendingDown} />
          </div>
        </div>

        <div>
          <SectionTitle icon={Users} title="Repartition par Role" subtitle="Distribution des utilisateurs par type de compte" gradient="from-slate-700 to-slate-900" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(roleLabels).map(([role, label]) => {
              const count = roleCounts[role] || 0;
              const pct = stats.totalUsers ? Math.round((count / stats.totalUsers) * 100) : 0;
              const colors = {
                super_admin: { bg: 'bg-rose-50 border-rose-200', bar: 'bg-rose-500', text: 'text-rose-700', icon: Crown },
                ecom_admin: { bg: 'bg-violet-50 border-violet-200', bar: 'bg-violet-500', text: 'text-violet-700', icon: Briefcase },
                ecom_closeuse: { bg: 'bg-sky-50 border-sky-200', bar: 'bg-sky-500', text: 'text-sky-700', icon: Package },
                ecom_compta: { bg: 'bg-emerald-50 border-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-700', icon: Calculator },
                ecom_livreur: { bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-500', text: 'text-amber-700', icon: Truck },
              }[role] || { bg: 'bg-slate-50 border-slate-200', bar: 'bg-slate-500', text: 'text-slate-700', icon: Users };
              const IconComponent = colors.icon;
              return (
                <div key={role} className={`rounded-2xl border-2 p-5 ${colors.bg} transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}>
                  <div className="flex items-center gap-2 mb-3">
                    <IconComponent className={`w-4 h-4 ${colors.text}`} />
                    <p className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>{label}</p>
                  </div>
                  <p className="text-xl sm:text-3xl font-black text-slate-900">{count}</p>
                  <div className="mt-2">
                    <MiniBar value={count} max={stats.totalUsers || 1} color={colors.bar} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{pct}% du total</p>
                </div>
              );
            })}
          </div>
        </div>

        {dailySignups.length > 0 && (
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-md">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Inscriptions Quotidiennes</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Tendance sur la periode selectionnee</p>
                </div>
              </div>
              <Badge className="bg-violet-50 text-violet-700 ring-violet-600/20" icon={TrendingUp}>{dailySignups.length} jours</Badge>
            </div>

            <div className="relative h-64 bg-gradient-to-b from-slate-50/50 to-white rounded-xl p-6 border border-slate-100">
              <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0.05" />
                  </linearGradient>
                  <filter id="shadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2" />
                  </filter>
                </defs>

                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={200 - (y * 2)}
                    x2="800"
                    y2={200 - (y * 2)}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}

                {(() => {
                  const max = Math.max(...dailySignups.map(x => x.count), 1);
                  const points = dailySignups.map((d, i) => {
                    const x = (i / (dailySignups.length - 1)) * 800;
                    const y = 200 - ((d.count / max) * 180);
                    return `${x},${y}`;
                  }).join(' ');

                  const areaPoints = `0,200 ${points} 800,200`;

                  return (
                    <>
                      {/* Area fill */}
                      <polygon
                        points={areaPoints}
                        fill="url(#areaGradient)"
                      />

                      {/* Line */}
                      <polyline
                        points={points}
                        fill="none"
                        stroke="rgb(139, 92, 246)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#shadow)"
                      />

                      {/* Data points */}
                      {dailySignups.map((d, i) => {
                        const x = (i / (dailySignups.length - 1)) * 800;
                        const y = 200 - ((d.count / max) * 180);
                        return (
                          <g key={i}>
                            <circle
                              cx={x}
                              cy={y}
                              r="5"
                              fill="white"
                              stroke="rgb(139, 92, 246)"
                              strokeWidth="3"
                              className="transition-all duration-200 hover:r-7 cursor-pointer"
                            />
                            <circle
                              cx={x}
                              cy={y}
                              r="20"
                              fill="transparent"
                              className="cursor-pointer"
                            >
                              <title>{d.count} inscriptions — {d._id}</title>
                            </circle>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>

              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between py-6 pr-2 text-[10px] font-bold text-slate-400">
                {(() => {
                  const max = Math.max(...dailySignups.map(x => x.count), 1);
                  return [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0].map((val, i) => (
                    <span key={i}>{val}</span>
                  ));
                })()}
              </div>
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between mt-4 px-6">
              <div className="text-xs font-bold text-slate-600">
                {dailySignups[0]?._id}
              </div>
              {dailySignups.length > 2 && (
                <div className="text-xs font-bold text-slate-400">
                  {dailySignups[Math.floor(dailySignups.length / 2)]?._id}
                </div>
              )}
              <div className="text-xs font-bold text-slate-600">
                {dailySignups[dailySignups.length - 1]?._id}
              </div>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
              <div className="text-center">
                <p className="text-2xl font-black text-violet-600">{dailySignups.reduce((s, d) => s + d.count, 0)}</p>
                <p className="text-xs font-bold text-slate-500 mt-1">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-600">{Math.max(...dailySignups.map(d => d.count))}</p>
                <p className="text-xs font-bold text-slate-500 mt-1">Peak</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-sky-600">{Math.round(dailySignups.reduce((s, d) => s + d.count, 0) / dailySignups.length)}</p>
                <p className="text-xs font-bold text-slate-500 mt-1">Moyenne</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-md">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Resume Executif</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Snapshot de la plateforme</p>
              </div>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20" icon={Activity}>Temps reel</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-violet-600" />
                <p className="text-xs font-black text-violet-700 uppercase tracking-wider">Croissance</p>
              </div>
              <p className="text-2xl font-black text-slate-900 mb-2">{stats.totalUsers || 0} users</p>
              <p className="text-xs text-slate-600 font-semibold">+{kpis.signups ?? newUsersMonth} inscrits · DAU {kpis.dau ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 border-2 border-sky-200 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-center gap-2 mb-3">
                <MousePointerClick className="w-5 h-5 text-sky-600" />
                <p className="text-xs font-black text-sky-700 uppercase tracking-wider">Conversion</p>
              </div>
              <p className="text-2xl font-black text-slate-900 mb-2">{kpis.conversionSignup ?? 0}%</p>
              <p className="text-xs text-slate-600 font-semibold">Visite→Inscription · {kpis.conversionActivation ?? 0}% activation</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-emerald-600" />
                <p className="text-xs font-black text-emerald-700 uppercase tracking-wider">Engagement</p>
              </div>
              <p className="text-2xl font-black text-slate-900 mb-2">{kpis.totalPageViews ?? 0} pages</p>
              <p className="text-xs text-slate-600 font-semibold">{kpis.totalSessions ?? 0} sessions · {kpis.avgSessionDuration ?? 0}s moy</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-amber-600" />
                <p className="text-xs font-black text-amber-700 uppercase tracking-wider">Operations</p>
              </div>
              <p className="text-2xl font-black text-slate-900 mb-2">{workspaces.length} workspaces</p>
              <p className="text-xs text-slate-600 font-semibold">{totalMembers} membres · {secStats.last24hActions ?? 0} actions/24h</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SuperAdminDashboard;
