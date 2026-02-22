import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, MousePointerClick, Globe, FileText, Users,
  Activity, Clock, Eye, Target, RotateCcw, TrendingDown, Smartphone,
  Monitor, Tablet, Chrome, MapPin, ArrowUpRight, ArrowDownRight,
  Loader2, AlertCircle, CheckCircle2, Crown, Briefcase, Package,
  Calculator, Truck, Zap, Calendar
} from 'lucide-react';
import { analyticsApi } from '../services/analytics.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'conversion', label: 'Conversion', icon: TrendingUp },
  { id: 'traffic', label: 'Traffic', icon: Globe },
  { id: 'countries', label: 'Countries', icon: MapPin },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'activity', label: 'Users Activity', icon: Users },
];

const RANGES = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
];

const countryNames = {
  CM: 'Cameroun', CI: "Côte d'Ivoire", SN: 'Sénégal', CD: 'RD Congo', GA: 'Gabon',
  BF: 'Burkina Faso', ML: 'Mali', GN: 'Guinée', TG: 'Togo', BJ: 'Bénin',
  NE: 'Niger', TD: 'Tchad', CG: 'Congo', CF: 'Centrafrique', GQ: 'Guinée Éq.',
  FR: 'France', BE: 'Belgique', CH: 'Suisse', CA: 'Canada', US: 'États-Unis',
  MA: 'Maroc', TN: 'Tunisie', DZ: 'Algérie', NG: 'Nigeria', GH: 'Ghana',
  KE: 'Kenya', ZA: 'Afrique du Sud', GB: 'Royaume-Uni', DE: 'Allemagne',
};

function formatDuration(seconds) {
  if (!seconds || seconds < 1) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatNumber(n) {
  if (n === null || n === undefined) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

// ─── Mini bar chart (pure CSS) ───
const MiniBar = ({ value, max, color = 'bg-violet-500' }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 rounded-full h-2.5 shadow-inner">
      <div className={`${color} h-2.5 rounded-full transition-all duration-700 ease-out shadow-sm`} style={{ width: `${pct}%` }} />
    </div>
  );
};

// ─── KPI Card ───
const KpiCard = ({ label, value, sub, color = 'text-slate-900', icon: Icon }) => (
  <div className="group bg-white rounded-2xl border-2 border-slate-200 p-4 sm:p-6 flex flex-col gap-1.5 sm:gap-2 transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 overflow-hidden">
    <div className="flex items-center justify-between mb-0.5 sm:mb-1 gap-1">
      <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{label}</span>
      {Icon && typeof Icon === 'string' ? <span className="text-sm flex-shrink-0">{Icon}</span> : Icon && <Icon className="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors flex-shrink-0" />}
    </div>
    <p className={`text-xl sm:text-3xl font-black tracking-tight ${color} truncate`}>{value}</p>
    {sub && <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">{sub}</p>}
  </div>
);

// ─── Funnel step ───
const FunnelStep = ({ step, count, rate, isLast, dropRate, lost }) => (
  <div className="flex flex-col items-center flex-1 min-w-[120px]">
    <div className="bg-white border border-gray-200/80 rounded-2xl p-5 w-full text-center shadow-sm transition-all duration-200 hover:shadow-lg hover:shadow-gray-200/50">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">{step}</p>
      <p className="text-2xl font-semibold text-gray-900 tracking-tight">{formatNumber(count)}</p>
      <p className="text-xs text-violet-600 font-semibold mt-1.5">{rate}%</p>
    </div>
    {!isLast && (
      <div className="flex flex-col items-center my-2.5">
        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        {lost > 0 && (
          <span className="text-[10px] text-rose-500 font-semibold mt-0.5">-{formatNumber(lost)} ({dropRate}%)</span>
        )}
      </div>
    )}
  </div>
);

// ─── Spinner ───
const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
      <p className="text-sm text-slate-600 font-semibold">Chargement des analytics...</p>
    </div>
  </div>
);

// ─── Empty state ───
const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
    <BarChart3 className="w-16 h-16 mb-4 text-slate-300" />
    <p className="text-base font-black text-slate-400">{message || 'Aucune donnée disponible'}</p>
    <p className="text-sm mt-2 text-slate-400">Les données apparaîtront dès que du trafic sera enregistré.</p>
  </div>
);

/* ─── Section Card wrapper ─── */
const SectionCard = ({ title, children, className = '', icon: Icon }) => (
  <div className={`bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-lg ${className}`}>
    {title && (
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b-2 border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 flex-shrink-0" />}
          <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">{title}</h3>
        </div>
      </div>
    )}
    <div className="p-4 sm:p-6">{children}</div>
  </div>
);

const SuperAdminAnalytics = () => {
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data stores per tab
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [countries, setCountries] = useState(null);
  const [pages, setPages] = useState(null);
  const [activity, setActivity] = useState(null);
  const [activityPage, setActivityPage] = useState(1);

  const loadTab = useCallback(async (t, r, p) => {
    setLoading(true);
    setError(null);
    try {
      switch (t) {
        case 'overview': {
          const res = await analyticsApi.getOverview(r);
          setOverview(res.data.data);
          break;
        }
        case 'conversion': {
          const res = await analyticsApi.getFunnel(r);
          setFunnel(res.data.data);
          break;
        }
        case 'traffic': {
          const res = await analyticsApi.getTraffic(r);
          setTraffic(res.data.data);
          break;
        }
        case 'countries': {
          const res = await analyticsApi.getCountries(r);
          setCountries(res.data.data);
          break;
        }
        case 'pages': {
          const res = await analyticsApi.getPages(r);
          setPages(res.data.data);
          break;
        }
        case 'activity': {
          const res = await analyticsApi.getUsersActivity(r, p || 1);
          setActivity(res.data.data);
          break;
        }
      }
    } catch (err) {
      console.error('Analytics load error:', err);
      setError('Impossible de charger les données analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTab(tab, range, activityPage);
  }, [tab, range, activityPage, loadTab]);

  // ═══════════════════════════════════
  // OVERVIEW TAB
  // ═══════════════════════════════════
  const renderOverview = () => {
    if (!overview) return <EmptyState message="Aucune donnée pour cette période" />;
    const k = overview.kpis;
    return (
      <div className="space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard label="Sessions" value={formatNumber(k.totalSessions)} icon={Activity} />
          <KpiCard label="Visiteurs uniques" value={formatNumber(k.uniqueVisitors)} icon={Users} />
          <KpiCard label="Pages vues" value={formatNumber(k.totalPageViews)} icon={Eye} />
          <KpiCard label="Durée moy." value={formatDuration(k.avgSessionDuration)} icon={Clock} />
          <KpiCard label="Taux de rebond" value={`${k.bounceRate}%`} icon={TrendingDown} color={k.bounceRate > 60 ? 'text-rose-600' : 'text-emerald-600'} />
          <KpiCard label="Inscriptions" value={formatNumber(k.signups)} icon={Users} color="text-sky-600" />
          <KpiCard label="Activés" value={formatNumber(k.activatedUsers)} sub={`${k.conversionActivation}% des inscrits`} icon={CheckCircle2} color="text-emerald-600" />
          <KpiCard label="Workspaces créés" value={formatNumber(k.workspacesCreated)} icon={Package} color="text-violet-600" />
          <KpiCard label="Conv. inscription" value={`${k.conversionSignup}%`} sub="visiteur → compte" icon={TrendingUp} color="text-sky-600" />
          <KpiCard label="Rétention 7j" value={`${k.retention7d}%`} icon={RotateCcw} color={k.retention7d > 30 ? 'text-emerald-600' : 'text-amber-600'} />
        </div>

        {/* DAU / WAU / MAU */}
        <SectionCard title="Utilisateurs actifs">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="text-center">
              <p className="text-xl sm:text-3xl font-semibold text-sky-600 tracking-tight">{formatNumber(k.dau)}</p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium mt-1">DAU (24h)</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-3xl font-semibold text-violet-600 tracking-tight">{formatNumber(k.wau)}</p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium mt-1">WAU (7j)</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-3xl font-semibold text-purple-600 tracking-tight">{formatNumber(k.mau)}</p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium mt-1">MAU (30j)</p>
            </div>
          </div>
        </SectionCard>

        {/* Daily trends */}
        {overview.trends?.dailySessions?.length > 0 && (
          <SectionCard title="Sessions par jour">
            <div className="flex items-end gap-1 h-32">
              {overview.trends.dailySessions.map((d, i) => {
                const maxSessions = Math.max(...overview.trends.dailySessions.map(x => x.sessions));
                const h = maxSessions > 0 ? Math.max(4, (d.sessions / maxSessions) * 100) : 4;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-violet-500 rounded-t-sm hover:bg-violet-600 transition-colors cursor-default"
                      style={{ height: `${h}%` }}
                    />
                    <div className="hidden group-hover:block absolute -top-9 bg-gray-900 text-white text-[10px] px-2.5 py-1.5 rounded-lg whitespace-nowrap z-10 shadow-lg">
                      {d.date}: {d.sessions} sessions
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-gray-400">{overview.trends.dailySessions[0]?.date}</span>
              <span className="text-[10px] text-gray-400">{overview.trends.dailySessions[overview.trends.dailySessions.length - 1]?.date}</span>
            </div>
          </SectionCard>
        )}

        {/* Daily signups trend */}
        {overview.trends?.dailySignups?.length > 0 && (
          <SectionCard title="Inscriptions par jour" icon={TrendingUp}>
            <div className="flex items-end gap-1 h-24">
              {overview.trends.dailySignups.map((d, i) => {
                const maxSignups = Math.max(...overview.trends.dailySignups.map(x => x.count));
                const h = maxSignups > 0 ? Math.max(4, (d.count / maxSignups) * 100) : 4;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-emerald-500 rounded-t-sm hover:bg-emerald-600 transition-colors cursor-default"
                      style={{ height: `${h}%` }}
                    />
                    <div className="hidden group-hover:block absolute -top-9 bg-gray-900 text-white text-[10px] px-2.5 py-1.5 rounded-lg whitespace-nowrap z-10 shadow-lg">
                      {d._id}: {d.count} inscriptions
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════
  // CONVERSION TAB
  // ═══════════════════════════════════
  const renderConversion = () => {
    if (!funnel) return <EmptyState message="Aucune donnée de conversion" />;
    const { funnel: steps, dropoffs } = funnel;
    return (
      <div className="space-y-6">
        {/* Funnel visualization */}
        <SectionCard title="Funnel de conversion">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 items-stretch">
            {steps?.map((s, i) => (
              <FunnelStep
                key={s.step}
                step={s.step}
                count={s.count}
                rate={s.rate}
                isLast={i === steps.length - 1}
                dropRate={dropoffs?.[i]?.dropRate}
                lost={dropoffs?.[i]?.lost}
              />
            ))}
          </div>
        </SectionCard>

        {/* Drop-off analysis */}
        {dropoffs?.length > 0 && (
          <SectionCard title="Analyse des abandons">
            <div className="space-y-4">
              {dropoffs.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-600 font-medium">{d.from} → {d.to}</span>
                      <span className={`font-semibold ${d.dropRate > 50 ? 'text-rose-600' : d.dropRate > 30 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        -{d.dropRate}%
                      </span>
                    </div>
                    <MiniBar value={d.dropRate} max={100} color={d.dropRate > 50 ? 'bg-rose-500' : d.dropRate > 30 ? 'bg-amber-400' : 'bg-emerald-500'} />
                  </div>
                  <span className="text-xs text-gray-400 w-16 text-right">-{formatNumber(d.lost)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Conversion rates summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {steps && steps.length >= 5 && (
            <>
              <div className="bg-sky-50/60 border border-sky-200/60 rounded-2xl p-5 text-center transition-all duration-200 hover:shadow-lg hover:shadow-sky-100/50">
                <p className="text-[11px] text-sky-600 font-medium uppercase tracking-wider">Visite → Inscription</p>
                <p className="text-xl sm:text-3xl font-semibold text-sky-700 mt-2 tracking-tight">
                  {steps[0].count > 0 ? Math.round((steps[1].count / steps[0].count) * 100) : 0}%
                </p>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-5 text-center transition-all duration-200 hover:shadow-lg hover:shadow-emerald-100/50">
                <p className="text-[11px] text-emerald-600 font-medium uppercase tracking-wider">Inscription → Activation</p>
                <p className="text-xl sm:text-3xl font-semibold text-emerald-700 mt-2 tracking-tight">
                  {steps[1].count > 0 ? Math.round((steps[3].count / steps[1].count) * 100) : 0}%
                </p>
              </div>
              <div className="bg-violet-50/60 border border-violet-200/60 rounded-2xl p-5 text-center transition-all duration-200 hover:shadow-lg hover:shadow-violet-100/50">
                <p className="text-[11px] text-violet-600 font-medium uppercase tracking-wider">Activation → Actif</p>
                <p className="text-xl sm:text-3xl font-semibold text-violet-700 mt-2 tracking-tight">
                  {steps[3].count > 0 ? Math.round((steps[4].count / steps[3].count) * 100) : 0}%
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // TRAFFIC TAB
  // ═══════════════════════════════════
  const renderTraffic = () => {
    if (!traffic) return <EmptyState message="Aucune donnée de trafic" />;
    const { byDevice, byBrowser, byOS, hourly, byReferrer } = traffic;
    return (
      <div className="space-y-6">
        {/* By Device & Browser */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Par appareil">
            {byDevice?.length > 0 ? (
              <div className="space-y-4">
                {byDevice.map(d => {
                  const total = byDevice.reduce((a, b) => a + b.sessions, 0);
                  const pct = total > 0 ? Math.round((d.sessions / total) * 100) : 0;
                  const icons = { desktop: '🖥️', mobile: '📱', tablet: '📟', unknown: '❓' };
                  return (
                    <div key={d._id} className="flex items-center gap-3">
                      <span className="text-lg">{icons[d._id] || '❓'}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-medium text-gray-700 capitalize">{d._id || 'Unknown'}</span>
                          <span className="text-gray-500">{d.sessions} ({pct}%)</span>
                        </div>
                        <MiniBar value={d.sessions} max={byDevice[0]?.sessions || 1} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-xs text-gray-400">Aucune donnée</p>}
          </SectionCard>

          <SectionCard title="Par navigateur">
            {byBrowser?.length > 0 ? (
              <div className="space-y-4">
                {byBrowser.map(b => (
                  <div key={b._id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-gray-700">{b._id || 'Unknown'}</span>
                        <span className="text-gray-500">{b.sessions}</span>
                      </div>
                      <MiniBar value={b.sessions} max={byBrowser[0]?.sessions || 1} color="bg-sky-500" />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-400">Aucune donnée</p>}
          </SectionCard>
        </div>

        {/* By OS & Hourly */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Par système">
            {byOS?.length > 0 ? (
              <div className="space-y-4">
                {byOS.map(o => (
                  <div key={o._id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-gray-700">{o._id || 'Unknown'}</span>
                        <span className="text-gray-500">{o.sessions}</span>
                      </div>
                      <MiniBar value={o.sessions} max={byOS[0]?.sessions || 1} color="bg-emerald-500" />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-400">Aucune donnée</p>}
          </SectionCard>

          <SectionCard title="Heures d'activité">
            {hourly?.length > 0 ? (
              <>
                <div className="flex items-end gap-0.5 h-24">
                  {Array.from({ length: 24 }, (_, h) => {
                    const entry = hourly.find(x => x._id === h);
                    const val = entry?.sessions || 0;
                    const maxH = Math.max(...hourly.map(x => x.sessions));
                    const height = maxH > 0 ? Math.max(2, (val / maxH) * 100) : 2;
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center group relative">
                        <div
                          className="w-full bg-amber-400 rounded-t-sm hover:bg-amber-500 transition-colors"
                          style={{ height: `${height}%` }}
                        />
                        <div className="hidden group-hover:block absolute -top-9 bg-gray-900 text-white text-[10px] px-2.5 py-1.5 rounded-lg z-10 shadow-lg">
                          {h}h: {val}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-gray-400">0h</span>
                  <span className="text-[10px] text-gray-400">12h</span>
                  <span className="text-[10px] text-gray-400">23h</span>
                </div>
              </>
            ) : <p className="text-xs text-gray-400">Aucune donnée</p>}
          </SectionCard>
        </div>

        {/* Referrers */}
        {byReferrer?.length > 0 && (
          <SectionCard title="Sources de trafic">
            <div className="space-y-3">
              {byReferrer.map(r => (
                <div key={r._id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-gray-700 truncate max-w-[250px]">{r._id}</span>
                      <span className="text-gray-500">{r.sessions}</span>
                    </div>
                    <MiniBar value={r.sessions} max={byReferrer[0]?.sessions || 1} color="bg-purple-500" />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════
  // COUNTRIES TAB
  // ═══════════════════════════════════
  const renderCountries = () => {
    if (!countries?.countries?.length) return <EmptyState message="Aucune donnée géographique" />;
    const data = countries.countries;
    const maxSessions = data[0]?.sessions || 1;
    return (
      <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Top pays</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">#</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pays</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sessions</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Utilisateurs</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Inscriptions</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Conversion</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Durée moy.</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Rebond</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-gray-400 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={c.country} className={`border-b border-gray-50 transition-colors hover:bg-gray-50/80 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-5 py-3.5 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {countryNames[c.country] || c.country}
                  </td>
                  <td className="px-5 py-3.5 text-right text-gray-700">{formatNumber(c.sessions)}</td>
                  <td className="px-5 py-3.5 text-right text-gray-700">{formatNumber(c.uniqueUsers)}</td>
                  <td className="px-5 py-3.5 text-right text-gray-700">{formatNumber(c.signups)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`font-semibold ${c.conversionRate > 5 ? 'text-emerald-600' : c.conversionRate > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {c.conversionRate}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-gray-500">{formatDuration(c.avgDuration)}</td>
                  <td className="px-5 py-3.5 text-right text-gray-500">{c.bounceRate}%</td>
                  <td className="px-5 py-3.5">
                    <MiniBar value={c.sessions} max={maxSessions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // PAGES TAB
  // ═══════════════════════════════════
  const renderPages = () => {
    if (!pages?.pages?.length) return <EmptyState message="Aucune donnée de pages" />;
    const data = pages.pages;
    const maxViews = data[0]?.views || 1;
    return (
      <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Pages les plus visitées</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">#</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Page</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Vues</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sessions</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Utilisateurs</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Entrées</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sorties</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Taux sortie</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-gray-400 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p, i) => (
                <tr key={p.page} className={`border-b border-gray-50 transition-colors hover:bg-gray-50/80 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-5 py-3.5 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-900 max-w-[200px] truncate" title={p.page}>
                    {p.page}
                  </td>
                  <td className="px-5 py-3.5 text-right text-gray-700 font-semibold">{formatNumber(p.views)}</td>
                  <td className="px-5 py-3.5 text-right text-gray-500">{formatNumber(p.sessions)}</td>
                  <td className="px-5 py-3.5 text-right text-gray-500">{formatNumber(p.uniqueUsers)}</td>
                  <td className="px-5 py-3.5 text-right text-gray-500">{formatNumber(p.entries)}</td>
                  <td className="px-5 py-3.5 text-right text-gray-500">{formatNumber(p.exits)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`font-semibold ${p.exitRate > 50 ? 'text-rose-500' : 'text-gray-500'}`}>
                      {p.exitRate}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <MiniBar value={p.views} max={maxViews} color="bg-sky-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // USERS ACTIVITY TAB
  // ═══════════════════════════════════
  const renderActivity = () => {
    if (!activity) return <EmptyState message="Aucune donnée d'activité" />;
    const { recentLogins, activeByRole, noWorkspace, inactiveWorkspaces, totalWorkspaces, pagination } = activity;

    const roleLabels = {
      super_admin: 'Super Admin', ecom_admin: 'Admin', ecom_closeuse: 'Closeuse',
      ecom_compta: 'Comptable', ecom_livreur: 'Livreur', null: 'Sans rôle'
    };
    const roleBadge = {
      super_admin: 'bg-rose-50 text-rose-700 ring-rose-600/10',
      ecom_admin: 'bg-violet-50 text-violet-700 ring-violet-600/10',
      ecom_closeuse: 'bg-sky-50 text-sky-700 ring-sky-600/10',
      ecom_compta: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
      ecom_livreur: 'bg-amber-50 text-amber-700 ring-amber-600/10',
      null: 'bg-gray-50 text-gray-600 ring-gray-200'
    };

    return (
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Connexions" value={formatNumber(activity.totalLogins)} icon="🔑" />
          <KpiCard label="Sans workspace" value={formatNumber(noWorkspace)} icon="⚠️" color="text-amber-600" />
          <KpiCard label="Workspaces inactifs" value={formatNumber(inactiveWorkspaces)} sub={`/ ${totalWorkspaces} total`} icon="💤" color="text-gray-500" />
          <KpiCard label="Actifs par rôle" value={activeByRole?.length || 0} icon="📊" />
        </div>

        {/* Active by role */}
        {activeByRole?.length > 0 && (
          <SectionCard title="Utilisateurs actifs par rôle">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {activeByRole.map(r => (
                <div key={r.role || 'null'} className="flex items-center gap-3 p-3.5 bg-gray-50/80 rounded-xl">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ring-1 ring-inset ${roleBadge[r.role] || roleBadge[null]}`}>
                    {roleLabels[r.role] || r.role || 'Sans rôle'}
                  </span>
                  <span className="text-lg font-semibold text-gray-900">{r.count}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Recent logins table */}
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Dernières connexions</h3>
          </div>
          {recentLogins?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Rôle</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pays</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Appareil</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Navigateur</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogins.map((l, i) => (
                    <tr key={i} className={`border-b border-gray-50 transition-colors hover:bg-gray-50/80 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                        {new Date(l.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{l.email || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ring-1 ring-inset ${roleBadge[l.role] || roleBadge[null]}`}>
                          {roleLabels[l.role] || l.role || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{countryNames[l.country] || l.country || '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500 capitalize">{l.device || '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{l.browser || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400 text-sm">Aucune connexion récente</div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Page {pagination.page} / {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="px-4 py-2 text-xs font-medium border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  ← Précédent
                </button>
                <button
                  onClick={() => setActivityPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={pagination.page >= pagination.pages}
                  className="px-4 py-2 text-xs font-medium border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Suivant →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════
  const renderContent = () => {
    if (loading) return <Spinner />;
    if (error) return (
      <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-10 text-center shadow-lg">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <p className="text-base font-bold text-rose-700 mb-4">{error}</p>
        <button
          onClick={() => loadTab(tab, range, activityPage)}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all duration-300 shadow-md hover:shadow-lg"
        >
          <RotateCcw className="w-4 h-4" />
          Réessayer
        </button>
      </div>
    );

    switch (tab) {
      case 'overview': return renderOverview();
      case 'conversion': return renderConversion();
      case 'traffic': return renderTraffic();
      case 'countries': return renderCountries();
      case 'pages': return renderPages();
      case 'activity': return renderActivity();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20 flex-shrink-0">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">Analytics</h1>
              <p className="text-sm text-slate-600 font-medium mt-2">Vue globale et détaillée de la plateforme</p>
            </div>
          </div>

          {/* Range selector */}
          <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl border-2 border-slate-200">
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${range === r.value
                  ? 'bg-white text-slate-900 shadow-md ring-2 ring-violet-500/20'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                  }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b-2 border-slate-200">
          {TABS.map(t => {
            const TabIcon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); if (t.id === 'activity') setActivityPage(1); }}
                className={`relative flex items-center gap-2 px-5 py-3 text-sm font-bold whitespace-nowrap rounded-t-xl transition-all duration-300 ${tab === t.id
                  ? 'text-slate-900 bg-white border-2 border-b-0 border-slate-200 -mb-0.5'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <TabIcon className="w-4 h-4" />
                {t.label}
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 to-purple-600 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
};

export default SuperAdminAnalytics;
