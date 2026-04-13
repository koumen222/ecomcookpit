import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, RefreshCw, Download, Globe,
  Package, ShoppingCart, Zap, TrendingUp,
  ExternalLink, CreditCard, Youtube, Users, MessageCircle, Lightbulb,
  ChevronDown, ChevronLeft, ChevronRight, Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ecomApi from '../services/ecommApi';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useStore } from '../contexts/StoreContext.jsx';

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const getQuarterStart = (date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);

const isSameCalendarDay = (left, right) => {
  if (!left || !right) return false;
  return startOfDay(left).getTime() === startOfDay(right).getTime();
};

const formatRangeLabel = (start, end) => {
  const format = (date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!start || !end) return '';
  return isSameCalendarDay(start, end) ? format(start) : `${format(start)} - ${format(end)}`;
};

const getPresetSelection = (key, referenceDate = new Date()) => {
  const todayStart = startOfDay(referenceDate);
  const todayEnd = endOfDay(referenceDate);

  switch (key) {
    case 'today':
      return {
        key,
        type: 'range',
        start: todayStart,
        end: todayEnd,
        period: 'today',
        label: "Aujourd'hui",
      };
    case 'yesterday': {
      const yesterday = addDays(todayStart, -1);
      return {
        key,
        type: 'range',
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
        period: 'yesterday',
        label: 'Hier',
      };
    }
    case '7d':
      return {
        key,
        type: 'period',
        start: addDays(todayStart, -6),
        end: todayEnd,
        period: '7d',
        label: '7 derniers jours',
      };
    case '30d':
      return {
        key,
        type: 'period',
        start: addDays(todayStart, -29),
        end: todayEnd,
        period: '30d',
        label: '30 derniers jours',
      };
    case '90d':
      return {
        key,
        type: 'period',
        start: addDays(todayStart, -89),
        end: todayEnd,
        period: '90d',
        label: '90 derniers jours',
      };
    case 'quarter':
      return {
        key,
        type: 'range',
        start: startOfDay(getQuarterStart(referenceDate)),
        end: todayEnd,
        period: 'custom',
        label: 'Trimestre à ce jour',
      };
    default:
      return null;
  }
};

export default function StoreDashboard() {
  const { workspace } = useEcomAuth();
  const { activeStore } = useStore();
  const [storeUrl, setStoreUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [chartMetric, setChartMetric] = useState('visites');
  const [isChartCollapsed, setIsChartCollapsed] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [periodLabel, setPeriodLabel] = useState('7 derniers jours');

  useEffect(() => { loadDashboard(!dashboardData); }, [period, dateRange, workspace, activeStore?._id]);

  const loadDashboard = async (isInitial) => {
    try {
      if (isInitial) setLoading(true); else setRefreshing(true);
      const params = { workspaceId: workspace?._id };
      if (dateRange) {
        params.startDate = dateRange.start;
        params.endDate = dateRange.end;
        params.period = dateRange.period || period;
      }
      if (!params.period) params.period = period;
      const [response, configRes] = await Promise.all([
        ecomApi.get('/store-analytics/dashboard', { params }),
        ecomApi.get('/store-manage/config').catch(() => null),
      ]);
      setDashboardData(response.data);
      const subdomain = configRes?.data?.data?.subdomain;
      const storeUrlFromApi = configRes?.data?.data?.storeUrl;
      if (storeUrlFromApi) setStoreUrl(storeUrlFromApi);
      else if (subdomain) setStoreUrl(`https://${subdomain}.scalor.net`);
    } catch (error) {
      console.error('Erreur dashboard:', error);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const exportAnalytics = async () => {
    try {
      const response = await ecomApi.get('/store-analytics/export', { params: { workspaceId: workspace?._id }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) { console.error('Export error:', e); }
  };

  const n = (v) => new Intl.NumberFormat('fr-FR').format(v || 0);

  const analytics = dashboardData?.analytics?.overview || {};
  const orders = dashboardData?.orders || {};
  const timeline = dashboardData?.analytics?.timeline || [];
  const applyPreset = (key, label) => {
    setDateRange(null);
    setPeriod(key);
    setPeriodLabel(label);
    setDatePickerOpen(false);
  };

  const applyCustomRange = (start, end, options = {}) => {
    const normalizedStart = startOfDay(start);
    const normalizedEnd = endOfDay(end);
    let derivedPeriod = 'custom';
    if (isSameCalendarDay(normalizedStart, normalizedEnd)) {
      if (isSameCalendarDay(normalizedStart, new Date())) derivedPeriod = 'today';
      else if (isSameCalendarDay(normalizedStart, addDays(new Date(), -1))) derivedPeriod = 'yesterday';
      else derivedPeriod = 'custom';
    }
    const nextPeriod = options.period || derivedPeriod;

    setDateRange({
      start: normalizedStart.toISOString(),
      end: normalizedEnd.toISOString(),
      period: nextPeriod,
    });
    setPeriod(nextPeriod);
    setPeriodLabel(options.label || formatRangeLabel(normalizedStart, normalizedEnd));
    setDatePickerOpen(false);
  };

  if (loading) return (
    <div className="p-5 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-8 animate-pulse">
      <div className="flex items-center justify-between"><div className="h-6 w-36 bg-gray-200 rounded-lg" /><div className="h-8 w-48 bg-gray-100 rounded-lg" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 rounded-xl overflow-hidden">{[...Array(4)].map((_, i) => <div key={i} className="bg-white px-5 py-4 space-y-2"><div className="h-3 w-16 bg-gray-100 rounded" /><div className="h-6 w-20 bg-gray-200 rounded" /><div className="h-3 w-24 bg-gray-50 rounded" /></div>)}</div>
      <div className="bg-white rounded-xl border border-gray-200 h-52" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}</div>
    </div>
  );

  const processingCount = orders.processing || 0;

  const metrics = [
    { key: 'visites', label: 'Visiteurs', value: n(analytics.uniqueVisitors || 0), sub: `${n(analytics.visitsToday || 0)} aujourd'hui` },
    { key: 'revenus', label: 'Revenus', value: `${n(orders.totalRevenue || 0)} FCFA`, sub: `${n(orders.averageOrderValue || 0)} FCFA / commande` },
    { key: 'commandes', label: 'Commandes', value: n(orders.total || 0), sub: `${orders.delivered || 0} livrées` },
    { key: 'visites', label: 'Conversion', value: `${analytics.conversionRate || 0}%`, sub: `${n(analytics.pageViews || 0)} pages vues` },
  ];

  const chartData = chartMetric === 'visites'
    ? timeline
    : chartMetric === 'commandes'
      ? Object.entries(orders.dailyOrders || {}).map(([date, count]) => ({ date, total: count }))
      : Object.entries(orders.dailyRevenue || {}).map(([date, amount]) => ({ date, total: amount }));
  const chartMetricLabel = {
    visites: 'Visites',
    commandes: 'Commandes',
    revenus: 'Revenus',
  };

  const actions = [
    { icon: Package, label: 'Commandes', to: '/ecom/boutique/orders', count: orders.total || 0 },
    { icon: ShoppingCart, label: 'Nouveau produit', to: '/ecom/boutique/products/new' },
    { icon: Zap, label: 'Thème', to: '/ecom/boutique/theme' },
    { icon: TrendingUp, label: 'Campagne', to: '/ecom/campaigns/new' },
  ];

  return (
    <div className="p-5 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Vue d'ensemble</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(storeUrl || activeStore?.subdomain) && (
            <a href={storeUrl || `https://${activeStore.subdomain}.scalor.net`} target="_blank" rel="noopener noreferrer"
              className="text-[13px] font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition flex items-center gap-1.5">
              <Globe size={14} /> Boutique
            </a>
          )}
          <div className="h-5 w-px bg-gray-200 mx-1" />
          <div className="relative">
            <button onClick={() => setDatePickerOpen(!datePickerOpen)}
              className="flex min-w-[190px] items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
              <span className="flex items-center gap-2 min-w-0">
                <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                <span className="truncate">{periodLabel}</span>
              </span>
              <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
            </button>
            {datePickerOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDatePickerOpen(false)} />
                <DatePickerDropdown
                  onPreset={applyPreset}
                  onCustom={applyCustomRange}
                  onClose={() => setDatePickerOpen(false)}
                  activePeriod={period}
                  activeLabel={periodLabel}
                  selectedRange={dateRange}
                />
              </>
            )}
          </div>
          <button onClick={() => loadDashboard(false)} disabled={refreshing} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportAnalytics} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Alertes */}
      {processingCount > 0 && (
        <div className="flex gap-3">
          {processingCount > 0 && (
            <Link to="/ecom/boutique/orders" className="flex items-center gap-2 text-[13px] font-medium text-blue-700 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition">
              <CreditCard size={14} />
              {processingCount} paiement{processingCount > 1 ? 's' : ''}
              <ArrowRight size={12} className="ml-1 opacity-50" />
            </Link>
          )}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-emerald-100 rounded-xl shadow-[0_14px_30px_-20px_rgba(16,24,40,0.28)] overflow-hidden">
        {metrics.map((m, i) => (
          <button key={i} onClick={() => setChartMetric(m.key)}
            className={`bg-white px-5 py-4 text-left shadow-[0_8px_18px_-14px_rgba(16,24,40,0.28)] transition-all hover:bg-gray-50 hover:shadow-[0_16px_30px_-18px_rgba(16,24,40,0.34)] ${chartMetric === m.key ? 'ring-inset ring-1 ring-emerald-500' : ''}`}>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{m.label}</p>
            <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">{m.value}</p>
            {m.sub && <p className="text-[11px] text-gray-400 mt-0.5">{m.sub}</p>}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-emerald-100 shadow-[0_18px_36px_-24px_rgba(16,24,40,0.3)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-50">
          <div className="relative">
            <select
              value={chartMetric}
              onChange={(e) => setChartMetric(e.target.value)}
              className="appearance-none rounded-lg border border-emerald-100 bg-white py-1.5 pl-3 pr-8 text-[12px] font-medium text-gray-700 outline-none transition hover:bg-gray-50"
            >
              {Object.entries(chartMetricLabel).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <button
            onClick={() => setIsChartCollapsed((value) => !value)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
          >
            {isChartCollapsed ? 'Afficher' : 'Masquer'}
            <ChevronDown size={14} className={`transition-transform ${isChartCollapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
        {!isChartCollapsed && (chartData && chartData.length > 0 ? (
          <AreaChart
            data={chartData}
            unit={chartMetric === 'visites' ? 'visites' : chartMetric === 'commandes' ? 'commandes' : 'FCFA'}
            hourly={period === '24h'}
            rangeStart={dashboardData?.period?.start}
            rangeEnd={dashboardData?.period?.end}
            respectSelectedRange={Boolean(dashboardData?.period?.start && dashboardData?.period?.end)}
          />
        ) : (
          <div className="h-40 flex items-center justify-center text-[13px] text-gray-300">
            Aucune donnée
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((a, i) => (
          <Link key={i} to={a.to}
            className="group flex items-center gap-3 bg-white border border-emerald-100 rounded-xl px-4 py-3.5 shadow-[0_12px_24px_-18px_rgba(16,24,40,0.26)] hover:border-emerald-300 hover:shadow-[0_18px_32px_-20px_rgba(16,24,40,0.3)] transition">
            <a.icon size={16} className="text-gray-400 group-hover:text-gray-600 transition" />
            <span className="text-[13px] font-medium text-gray-700 group-hover:text-gray-900 transition">{a.label}</span>
            {a.count !== undefined && <span className="ml-auto text-[11px] font-semibold text-gray-400 tabular-nums">{a.count}</span>}
          </Link>
        ))}
      </div>

      {/* Produits — dynamique selon la métrique */}
      {(() => {
        const configs = {
          visites: {
            title: 'Produits les plus visités',
            data: dashboardData?.analytics?.visitsPerProduct || [],
            valueKey: 'visits',
            valueLabel: (p) => n(p.visits),
            subLabel: (p) => `${n(p.uniqueVisitorCount)} uniques`,
          },
          commandes: {
            title: 'Produits les plus vendus',
            data: dashboardData?.topProductsBySales || [],
            valueKey: 'sold',
            valueLabel: (p) => `${n(p.sold)} vendus`,
            subLabel: (p) => `${n(p.revenue)} FCFA`,
          },
          revenus: {
            title: 'Produits par revenu',
            data: dashboardData?.topProductsByRevenue || [],
            valueKey: 'revenue',
            valueLabel: (p) => `${n(p.revenue)} FCFA`,
            subLabel: (p) => `${n(p.sold)} vendus`,
          },
        };
        const cfg = configs[chartMetric];
        const items = cfg.data.slice(0, 5);
        const maxV = items[0]?.[cfg.valueKey] || 1;

        return (
          <div className="bg-white rounded-xl border border-emerald-100 shadow-[0_16px_34px_-24px_rgba(16,24,40,0.28)]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <p className="text-[13px] font-semibold text-gray-900">{cfg.title}</p>
              <Link to="/ecom/boutique/products" className="text-[12px] text-gray-400 hover:text-gray-600 transition">Voir tout</Link>
            </div>
            {items.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {items.map((p, i) => (
                  <div key={p._id || p.name || i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition">
                    <span className="text-[11px] font-semibold text-gray-300 w-4 text-right tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 truncate">{p.name || 'Sans nom'}</p>
                      <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(p[cfg.valueKey] / maxV) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[13px] font-semibold text-gray-900 tabular-nums">{cfg.valueLabel(p)}</p>
                      <p className="text-[10px] text-gray-400">{cfg.subLabel(p)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-[13px] text-gray-300">Aucune donnée disponible</div>
            )}
          </div>
        );
      })()}

      {/* Communauté */}
      <div className="bg-white rounded-xl border border-emerald-100 shadow-[0_16px_34px_-24px_rgba(16,24,40,0.28)] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[13px] font-semibold text-gray-900">Communauté</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Connectez-vous avec des créateurs, apprenez de nouvelles compétences et aidez à façonner l'avenir de Chariow.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {[
            { icon: Youtube, label: 'Rejoignez-nous sur Youtube', desc: 'Découvrez des vidéos pratiques pour apprendre à utiliser Chariow', href: 'https://youtube.com/@chariow', color: 'text-red-500' },
            { icon: Users, label: 'Rejoignez notre Hub', desc: "Rejoignez la communauté d'entraide des créateurs Chariow", href: '#', color: 'text-indigo-500' },
            { icon: Lightbulb, label: 'Partagez vos suggestions', desc: 'Vos suggestions nous aident à améliorer Chariow', href: '#', color: 'text-amber-500' },
            { icon: MessageCircle, label: 'Rejoignez-nous sur WhatsApp', desc: 'Rejoignez notre canal WhatsApp', href: '#', color: 'text-emerald-500' },
          ].map((c, i) => (
            <a key={i} href={c.href} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition">
              <c.icon size={18} className={`${c.color} mt-0.5 flex-shrink-0`} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-gray-800">{c.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{c.desc}</p>
              </div>
              <ArrowRight size={12} className="text-gray-300 mt-1 flex-shrink-0 ml-auto" />
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ─── Area Chart ─── */

const AreaChart = ({ data, unit, hourly, rangeStart, rangeEnd, respectSelectedRange }) => {
  const grouped = data.reduce((acc, item) => {
    const d = item._id?.date || item.date;
    if (!d) return acc;
    if (!acc[d]) acc[d] = { date: d, total: 0 };
    acc[d].total += item.count || item.total || 0;
    return acc;
  }, {});
  const buildBucketsFromRange = () => {
    if (!rangeStart || !rangeEnd) return [];

    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

    const cursor = new Date(start);
    const buckets = [];

    if (hourly) {
      cursor.setMinutes(0, 0, 0);
      end.setMinutes(59, 59, 999);
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}T${String(cursor.getHours()).padStart(2, '0')}`;
        buckets.push({ date: key, total: grouped[key]?.total || 0 });
        cursor.setHours(cursor.getHours() + 1);
      }
      return buckets;
    }

    cursor.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      buckets.push({ date: key, total: grouped[key]?.total || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
  };

  const rawPts = respectSelectedRange
    ? buildBucketsFromRange()
    : Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  if (!rawPts.length) return null;

  let pts = rawPts;
  if (!respectSelectedRange) {
    let firstNonZeroIndex = rawPts.findIndex((point) => point.total > 0);
    let lastNonZeroIndex = -1;
    for (let i = rawPts.length - 1; i >= 0; i -= 1) {
      if (rawPts[i].total > 0) {
        lastNonZeroIndex = i;
        break;
      }
    }

    if (firstNonZeroIndex === -1) firstNonZeroIndex = 0;
    if (lastNonZeroIndex === -1) lastNonZeroIndex = rawPts.length - 1;

    pts = rawPts.slice(firstNonZeroIndex, lastNonZeroIndex + 1);
  }
  if (!pts.length) return null;

  const chartPoints = pts.map((point) => ({
    ...point,
    label: hourly
      ? `${point.date.split('T')[1] || ''}h`
      : new Date(point.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
  }));
  const lineColor = '#28a8f5';
  const formatValue = (value) => unit === 'FCFA'
    ? `${new Intl.NumberFormat('fr-FR').format(value || 0)} FCFA`
    : new Intl.NumberFormat('fr-FR').format(value || 0);
  const formatAxisValue = (value) => new Intl.NumberFormat('fr-FR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0);
  const visibleTickIndexes = chartPoints.length <= 8
    ? chartPoints.map((_, index) => index)
    : [0, Math.floor((chartPoints.length - 1) / 3), Math.floor(((chartPoints.length - 1) * 2) / 3), chartPoints.length - 1];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-xl bg-gray-900 px-3 py-2 text-[11px] font-medium text-white shadow-lg">
        <div>{formatValue(payload[0].value)}</div>
        <div className="text-gray-400">{label}</div>
      </div>
    );
  };

  return (
    <div className="px-4 pb-2 pt-4">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsAreaChart data={chartPoints} margin={{ top: 8, right: 8, bottom: 18, left: 0 }}>
            <defs>
              <linearGradient id="dashboardAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={0}
              minTickGap={24}
              padding={{ left: 0, right: 0 }}
              ticks={visibleTickIndexes.map((index) => chartPoints[index]?.label).filter(Boolean)}
              tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={34}
              tickFormatter={formatAxisValue}
              tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="total"
              stroke={lineColor}
              strokeWidth={3}
              fill="url(#dashboardAreaFill)"
              isAnimationActive={false}
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: lineColor }}
              dot={false}
            />
          </RechartsAreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* ─── Date Picker Dropdown (Shopify-style) ─── */

const DAYS = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const DatePickerDropdown = ({ onPreset, onCustom, onClose, activePeriod, activeLabel, selectedRange }) => {
  const today = new Date();
  const initialPreset = selectedRange ? null : getPresetSelection(activePeriod === 'custom' ? '7d' : activePeriod) || getPresetSelection('7d');
  const initialStart = selectedRange?.start ? new Date(selectedRange.start) : initialPreset?.start || startOfDay(today);
  const initialEnd = selectedRange?.end ? new Date(selectedRange.end) : initialPreset?.end || endOfDay(today);
  const presetFromLabel = activeLabel === "Aujourd'hui"
    ? 'today'
    : activeLabel === 'Hier'
      ? 'yesterday'
      : activeLabel === 'Trimestre à ce jour'
        ? 'quarter'
        : 'custom';

  const [rightMonth, setRightMonth] = useState(initialEnd.getMonth());
  const [rightYear, setRightYear] = useState(initialEnd.getFullYear());
  const [selStart, setSelStart] = useState(initialStart);
  const [selEnd, setSelEnd] = useState(initialEnd);
  const [activePreset, setActivePreset] = useState(selectedRange ? presetFromLabel : initialPreset?.key || '7d');

  const leftMonth = rightMonth === 0 ? 11 : rightMonth - 1;
  const leftYear = rightMonth === 0 ? rightYear - 1 : rightYear;

  const prevMonth = () => {
    if (rightMonth === 0) { setRightMonth(11); setRightYear(rightYear - 1); }
    else setRightMonth(rightMonth - 1);
  };
  const nextMonth = () => {
    if (rightMonth === 11) { setRightMonth(0); setRightYear(rightYear + 1); }
    else setRightMonth(rightMonth + 1);
  };

  const getDays = (year, month) => {
    const first = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < first; i++) days.push(null);
    for (let d = 1; d <= count; d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const isToday = (d) => d && d.toDateString() === today.toDateString();
  const isFuture = (d) => d && d > today;
  const isInRange = (d) => {
    if (!d || !selStart) return false;
    if (!selEnd) return d.toDateString() === selStart.toDateString();
    return d >= selStart && d <= selEnd;
  };
  const isStart = (d) => d && selStart && d.toDateString() === selStart.toDateString();
  const isEnd = (d) => d && selEnd && d.toDateString() === selEnd.toDateString();

  const handleDayClick = (d) => {
    if (!d || isFuture(d)) return;
    setActivePreset('custom');
    if (!selStart || (selStart && selEnd)) {
      setSelStart(d);
      setSelEnd(null);
    } else {
      if (d < selStart) {
        setSelEnd(selStart);
        setSelStart(d);
      } else {
        setSelEnd(d);
      }
    }
  };

  const fmtInput = (d) => d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  const presetSections = [
    {
      title: null,
      items: [
        { key: 'today', label: "Aujourd'hui" },
        { key: 'yesterday', label: 'Hier' },
      ],
    },
    {
      title: 'Derniers',
      items: [
        { key: '7d', label: '7 derniers jours' },
        { key: '30d', label: '30 derniers jours' },
        { key: '90d', label: '90 derniers jours' },
      ],
    },
    {
      title: 'Trimestres',
      items: [
        { key: 'quarter', label: 'Trimestre à ce jour' },
      ],
    },
    {
      title: null,
      items: [
        { key: 'custom', label: 'Période personnalisée' },
      ],
    },
  ];

  const handlePreset = (key) => {
    setActivePreset(key);

    if (key === 'custom') {
      return;
    }

    const selection = getPresetSelection(key, today);
    if (!selection) return;

    setSelStart(selection.start);
    setSelEnd(selection.end);
    setRightMonth(selection.end.getMonth());
    setRightYear(selection.end.getFullYear());
  };

  const handleApply = () => {
    if (activePreset && activePreset !== 'custom') {
      const selection = getPresetSelection(activePreset, today);
      if (!selection) return;

      if (selection.type === 'period') {
        onPreset(selection.period, selection.label);
      } else {
        onCustom(selection.start, selection.end, { period: selection.period, label: selection.label });
      }
      return;
    }

    if (selStart && selEnd) onCustom(selStart, selEnd);
    else if (selStart) onCustom(selStart, selStart);
  };

  const renderCalendar = (year, month) => {
    const days = getDays(year, month);
    return (
      <div>
        <p className="text-[14px] font-semibold text-gray-900 text-center mb-4">{MONTHS[month]} {year}</p>
        <div className="grid grid-cols-7 gap-y-1">
          {DAYS.map((d) => <div key={d} className="text-[11px] font-medium text-gray-400 text-center py-1">{d}</div>)}
          {days.map((d, i) => (
            <button key={i} disabled={!d || isFuture(d)}
              onClick={() => handleDayClick(d)}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-[13px] transition-all
                ${!d ? 'pointer-events-none opacity-0' : ''}
                ${d && isFuture(d) ? 'text-gray-200 cursor-not-allowed' : ''}
                ${d && !isFuture(d) && !isInRange(d) ? 'text-gray-700 hover:bg-gray-100' : ''}
                ${isInRange(d) && !isStart(d) && !isEnd(d) ? 'bg-gray-100 text-gray-900 rounded-md' : ''}
                ${isStart(d) || isEnd(d) ? 'bg-gray-900 text-white font-semibold shadow-sm' : ''}
                ${isToday(d) && !isStart(d) && !isEnd(d) ? 'font-semibold text-gray-900 ring-1 ring-gray-300' : ''}
              `}>
              {d ? d.getDate() : ''}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-4 top-20 z-50 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[920px]">
      {/* Presets sidebar */}
      <div className="flex h-full flex-col sm:flex-row">
        <div className="border-b border-gray-100 px-3 py-3 sm:w-56 sm:border-b-0 sm:border-r sm:px-0 sm:py-4 flex-shrink-0">
          {presetSections.map((section) => (
            <div key={section.title || section.items[0].key} className="sm:mb-2">
              {section.title && <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{section.title}</p>}
              {section.items.map((item) => (
                <button key={item.key} onClick={() => handlePreset(item.key)}
                  className={`block w-full rounded-xl px-4 py-2.5 text-left text-[14px] transition sm:rounded-none
                    ${activePreset === item.key ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Calendar area */}
        <div className="flex-1 p-4 sm:p-5">
        {/* Date inputs */}
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-h-[44px] flex-1 items-center rounded-xl border border-gray-200 bg-white px-4 text-[14px] text-gray-700 shadow-sm">
            {fmtInput(selStart) || <span className="text-gray-300">Date de début</span>}
          </div>
          <ArrowRight size={16} className="hidden text-gray-300 sm:block flex-shrink-0" />
          <div className="flex min-h-[44px] flex-1 items-center rounded-xl border border-gray-200 bg-white px-4 text-[14px] text-gray-700 shadow-sm">
            {fmtInput(selEnd) || <span className="text-gray-300">Date de fin</span>}
          </div>
        </div>

        {/* Dual calendar */}
        <div className="flex items-start gap-3 sm:gap-6">
          <button onClick={prevMonth} className="mt-1 rounded-lg p-1.5 hover:bg-gray-100 transition">
            <ChevronLeft size={16} className="text-gray-400" />
          </button>
          <div className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-2">
            <div>{renderCalendar(leftYear, leftMonth)}</div>
            <div>{renderCalendar(rightYear, rightMonth)}</div>
          </div>
          <button onClick={nextMonth} className="mt-1 rounded-lg p-1.5 hover:bg-gray-100 transition">
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={handleApply} disabled={!selStart}
            className="rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800 transition disabled:opacity-30">
            Appliquer
          </button>
        </div>
      </div>
    </div>
      </div>
  );
};
