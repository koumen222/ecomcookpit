import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

// ── Palette ─────────────────────────────────────────────────────
const C = {
  blue: '#0F6B4F', indigo: '#0F6B4F', emerald: '#10b981',
  amber: '#f59e0b', red: '#ef4444', purple: '#C56A2D',
  orange: '#C56A2D', slate: '#64748b', cyan: '#0F6B4F'
};

// ── Score ring gauge ─────────────────────────────────────────────
const HealthGauge = ({ score, size = 160 }) => {
  const r = (size - 24) / 2;
  const circ = 2 * Math.PI * r;
  const progress = (Math.min(score, 100) / 100) * circ;
  const color = score >= 75 ? C.emerald : score >= 50 ? C.amber : score >= 25 ? C.orange : C.red;
  const label = score >= 75 ? 'Excellent' : score >= 50 ? 'Correct' : score >= 25 ? 'À risque' : 'Critique';
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="14"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - progress}
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
        <text x={size/2} y={size/2 - 8} textAnchor="middle" fill="#0f172a" fontSize="34" fontWeight="800">{score}</text>
        <text x={size/2} y={size/2 + 14} textAnchor="middle" fill="#94a3b8" fontSize="11">/100</text>
      </svg>
      <span className="text-xs font-bold mt-1 px-3 py-0.5 rounded-full" style={{ background: color + '20', color }}>{label}</span>
    </div>
  );
};

// ── Radar Chart ─────────────────────────────────────────────────
const RadarChart = ({ scores, size = 240 }) => {
  const cx = size / 2, cy = size / 2, r = (size - 70) / 2;
  const labels = [
    { key: 'finance', label: 'Finance' },
    { key: 'marketing', label: 'Marketing' },
    { key: 'stock', label: 'Stock' },
    { key: 'growth', label: 'Croissance' }
  ];
  const n = labels.length;
  const angle = (2 * Math.PI) / n;
  const pt = (i, val) => {
    const a = angle * i - Math.PI / 2;
    const d = (val / 100) * r;
    return { x: cx + d * Math.cos(a), y: cy + d * Math.sin(a) };
  };
  const dataPath = labels.map((l, i) => pt(i, scores[l.key] || 0))
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[25, 50, 75, 100].map(lv => {
        const path = labels.map((_, i) => pt(i, lv))
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
        return <path key={lv} d={path} fill={lv === 100 ? 'none' : 'none'} stroke={lv === 50 ? '#cbd5e1' : '#e2e8f0'} strokeWidth={lv === 50 ? 1.5 : 1} strokeDasharray={lv === 50 ? '4 3' : undefined} />;
      })}
      {labels.map((_, i) => { const p = pt(i, 100); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth="1" />; })}
      <path d={dataPath} fill="rgba(15,107,79,0.15)" stroke={C.indigo} strokeWidth="2.5" strokeLinejoin="round" />
      {labels.map((l, i) => { const p = pt(i, scores[l.key] || 0); return <circle key={i} cx={p.x} cy={p.y} r="5" fill={C.indigo} stroke="#fff" strokeWidth="2" />; })}
      {labels.map((l, i) => {
        const p = pt(i, 128);
        const val = scores[l.key] || 0;
        const col = val >= 75 ? C.emerald : val >= 50 ? C.amber : C.red;
        return (
          <g key={i}>
            <text x={p.x} y={p.y - 4} textAnchor="middle" fill="#374151" fontSize="10" fontWeight="700">{l.label}</text>
            <text x={p.x} y={p.y + 10} textAnchor="middle" fill={col} fontSize="11" fontWeight="800">{val}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Sparkline (mini line chart) ──────────────────────────────────
const Sparkline = ({ data, color = C.blue, h = 40, w = 120, fill = true }) => {
  if (!data || data.length < 2) return <div style={{ width: w, height: h }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 4) - 2
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = line + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {fill && <path d={area} fill={color} fillOpacity="0.1" />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} />
    </svg>
  );
};

// ── Bar chart SVG ────────────────────────────────────────────────
const BarChart = ({ data, color = C.blue, h = 80, w = '100%', label }) => {
  const vals = data.map(d => d.value || 0);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ width: w }}>
      {label && <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">{label}</p>}
      <div className="flex items-end gap-0.5" style={{ height: h }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end group relative" style={{ height: h }}>
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-700 hidden group-hover:block whitespace-nowrap bg-white px-1 rounded shadow z-10">{d.label}</div>
              <div style={{ height: `${pct}%`, background: color, borderRadius: '2px 2px 0 0', minHeight: 2, transition: 'height 0.6s ease' }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {data.length <= 12 && data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[8px] text-gray-400 truncate">{d.shortLabel || d.label}</span>
        ))}
      </div>
    </div>
  );
};

// ── Donut chart SVG ──────────────────────────────────────────────
const DonutChart = ({ segments, size = 100 }) => {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0) || 1;
  let offset = 0;
  const colors = [C.blue, C.emerald, C.amber, C.purple, C.red, C.cyan];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const el = (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={colors[i % colors.length]} strokeWidth="16"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset + circ * 0.25}
            transform={`rotate(-90 ${size/2} ${size/2})`} />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
};

// ── Progress bar ─────────────────────────────────────────────────
const ProgressBar = ({ value, max = 100, color = C.blue, label, sublabel, showPct = true }) => {
  const pct = Math.min(100, Math.max(0, (value / (max || 1)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        {label && <span className="text-xs font-medium text-gray-700">{label}</span>}
        {showPct && <span className="text-xs font-bold" style={{ color }}>{pct.toFixed(0)}%</span>}
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: color, transition: 'width 0.8s ease' }} className="h-full rounded-full" />
      </div>
      {sublabel && <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
  );
};

// ── Score computation ───────────────────────────────────────────
const computeScores = (kpis, stockOverview) => {
  if (!kpis) return { finance: 0, marketing: 0, stock: 0, growth: 0, global: 0 };
  const profitMargin = kpis.totalRevenue > 0 ? (kpis.totalProfit / kpis.totalRevenue) : 0;
  const finance = Math.min(100, Math.max(0, (profitMargin + 0.1) * 200));
  const roas = kpis.roas || 0;
  const marketing = Math.min(100, Math.max(0, (roas / 4) * 100));
  const totalProd = stockOverview?.totalProducts || 1;
  const oos = stockOverview?.outOfStockCount || 0;
  const stock = Math.min(100, ((totalProd - oos) / totalProd) * 100);
  const delivRate = (kpis.deliveryRate || 0) * 100;
  const growth = Math.min(100, Math.max(0, delivRate * 1.2));
  const global = Math.round(finance * 0.4 + marketing * 0.3 + stock * 0.2 + growth * 0.1);
  return { finance: Math.round(finance), marketing: Math.round(marketing), stock: Math.round(stock), growth: Math.round(growth), global };
};

// ── Section card ─────────────────────────────────────────────────
const Card = ({ title, icon, children, className = '', accent }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
    {title && (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
        {accent && <div className="w-1 h-4 rounded-full" style={{ background: accent }} />}
        <span className="text-sm">{icon}</span>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

// ── AI badge levels ──────────────────────────────────────────────
const LevelBadge = ({ level }) => {
  const map = { critical: [C.red, 'Critique'], high: [C.orange, 'Élevé'], medium: [C.amber, 'Moyen'], low: [C.blue, 'Faible'], positive: [C.emerald, 'Positif'] };
  const [col, lbl] = map[level] || map.medium;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: col + '20', color: col }}>{lbl}</span>;
};

// ── Action item ──────────────────────────────────────────────────
const ActionItem = ({ text, priority, index }) => {
  const colors = { '24h': [C.red, '🔴'], '7j': [C.amber, '🟡'], '30j': [C.blue, '🔵'] };
  const [col, emoji] = colors[priority] || colors['30j'];
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: col + '30', background: col + '08' }}>
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5" style={{ background: col }}>
        {index + 1}
      </div>
      <p className="text-sm font-medium text-gray-800 leading-relaxed">{text}</p>
    </div>
  );
};

const Data = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();

  const [overview, setOverview] = useState(null);
  const [txSummary, setTxSummary] = useState(null);
  const [stockOverview, setStockOverview] = useState(null);
  const [stockAlerts, setStockAlerts] = useState(null);
  const [productsStats, setProductsStats] = useState(null);
  const [stockLocationsSummary, setStockLocationsSummary] = useState(null);
  const [parsedAnalysis, setParsedAnalysis] = useState(null);
  const [aiRaw, setAiRaw] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const scores = useMemo(() => computeScores(overview?.kpis, stockOverview), [overview, stockOverview]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const params = { ...dateRange };
        const results = await Promise.allSettled([
          ecomApi.get('/reports/overview', { params }),
          ecomApi.get('/transactions/summary', { params }),
          ecomApi.get('/stock/overview'),
          ecomApi.get('/stock/alerts'),
          ecomApi.get('/products/stats/overview'),
          ecomApi.get('/stock-locations/summary')
        ]);
        const getData = (idx) => {
          const r = results[idx];
          if (!r || r.status !== 'fulfilled') return null;
          return r.value?.data?.data ?? null;
        };
        const overviewData = getData(0);
        setOverview(overviewData);
        setTxSummary(getData(1));
        setStockOverview(getData(2));
        setStockAlerts(getData(3));
        setProductsStats(getData(4));
        setStockLocationsSummary(getData(5));
        if (!overviewData && results[0]?.status === 'rejected') {
          setError(results[0].reason?.response?.data?.message || 'Impossible de charger les données');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Impossible de charger les données');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dateRange.startDate, dateRange.endDate]);

  const handleAnalyzeGlobal = async () => {
    try {
      setAnalyzing(true);
      setError('');
      setParsedAnalysis(null);
      setAiRaw('');
      const res = await ecomApi.post('/reports/analyze-global', { startDate: dateRange.startDate, endDate: dateRange.endDate }, { timeout: 120000 });
      const analysis = res.data?.data?.analysis || '';
      setAiRaw(analysis);
      try {
        const clean = analysis.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(clean);
        if (parsed.executive_summary || parsed.financial_analysis || parsed.strategic_plan) {
          setParsedAnalysis(parsed);
          setActiveTab('ai');
        }
      } catch { setParsedAnalysis(null); }
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'analyse IA");
    } finally { setAnalyzing(false); }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <div className="h-8 w-52 bg-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-slate-200 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const pct = (ratio) => `${((ratio || 0) * 100).toFixed(1)}%`;
  const num = (value) => (value || 0).toLocaleString('fr-FR');
  const kpis = overview?.kpis;
  const topProducts = overview?.topProducts || [];
  const daily = overview?.daily || [];
  const ordersByStatus = overview?.orders?.byStatus || [];

  // Sparkline data from daily
  const sparkRevenue = daily.slice(-14).map(d => d.revenue || 0);
  const sparkProfit = daily.slice(-14).map(d => d.profit || 0);
  const sparkOrders = daily.slice(-14).map(d => d.ordersDelivered || 0);

  // Forecasts (linear regression on last 14 days)
  const forecast = (arr) => {
    if (arr.length < 3) return null;
    const n = arr.length;
    const sumX = arr.reduce((s, _, i) => s + i, 0);
    const sumY = arr.reduce((s, v) => s + v, 0);
    const sumXY = arr.reduce((s, v, i) => s + i * v, 0);
    const sumX2 = arr.reduce((s, _, i) => s + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const nextMonth = (intercept + slope * (n + 29)) * 30;
    const trend = slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat';
    return { nextMonth: Math.max(0, nextMonth), trend, slope };
  };

  const fRevenue = forecast(sparkRevenue);
  const fProfit = forecast(sparkProfit);
  const fOrders = forecast(sparkOrders);

  // Bar chart data from top products
  const topProdBars = topProducts.slice(0, 8).map(p => ({ label: p.name, shortLabel: p.name?.slice(0, 6), value: p.revenue || 0 }));
  const topProfitBars = topProducts.slice(0, 8).map(p => ({ label: p.name, shortLabel: p.name?.slice(0, 6), value: Math.max(0, p.profit || 0) }));

  // Delivery rate chart by day
  const delivBars = daily.slice(-14).map((d, i) => ({ label: d._id, shortLabel: d._id?.slice(-5), value: (d.deliveryRate || 0) * 100 }));

  // Order status donut
  const statusDonut = ordersByStatus.slice(0, 6).map(s => ({ label: s.status, value: s.count || 0 }));

  // Trend arrow
  const TrendArrow = ({ trend, val }) => {
    if (!trend) return null;
    const up = trend === 'up';
    return <span className={`text-xs font-bold flex items-center gap-0.5 ${up ? 'text-emerald-600' : 'text-red-500'}`}>{up ? '▲' : '▼'}{val}</span>;
  };

  // ── Tab nav ──────────────────────────────────────────────────
  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
    { id: 'products', label: 'Produits', icon: '📦' },
    { id: 'stock', label: 'Stock', icon: '🏪' },
    { id: 'trends', label: 'Tendances', icon: '📈' },
    { id: 'forecast', label: 'Prévisions', icon: '🔮' },
    ...(parsedAnalysis || aiRaw ? [{ id: 'ai', label: 'Analyse IA', icon: '🤖' }] : [])
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Sticky top bar ──────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        {/* Row 1: Title + Controls */}
        <div className="px-4 lg:px-6 pt-3 pb-2 flex flex-wrap items-center gap-3">
          {/* Title */}
          <div className="flex items-center gap-2.5 mr-auto">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-gray-900 leading-tight">Business Intelligence</h1>
              <p className="text-[10px] text-gray-400 leading-tight">{dateRange.startDate} → {dateRange.endDate}</p>
            </div>
          </div>
          {/* Date presets */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {[{ label: '7j', days: 7 }, { label: '30j', days: 30 }, { label: '90j', days: 90 }].map(p => (
              <button key={p.days}
                onClick={() => setDateRange({ startDate: new Date(Date.now() - p.days * 86400000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] })}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-gray-600 hover:bg-white hover:shadow-sm transition">
                {p.label}
              </button>
            ))}
          </div>
          {/* Custom date range */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <input type="date" value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="text-xs text-gray-600 bg-transparent border-0 focus:outline-none w-28" />
            <span className="text-gray-300 text-xs font-bold">→</span>
            <input type="date" value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="text-xs text-gray-600 bg-transparent border-0 focus:outline-none w-28" />
          </div>
          {/* IA button */}
          <button onClick={handleAnalyzeGlobal} disabled={analyzing || !kpis}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
              analyzing || !kpis
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-sm hover:shadow-emerald-200 hover:shadow-md'
            }`}>
            {analyzing
              ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyse…</>
              : <>⚡ Analyser avec l'IA</>}
          </button>
        </div>
        {/* Row 2: Tabs */}
        <div className="px-4 lg:px-6 flex gap-0 overflow-x-auto scrollbar-hide border-t border-gray-50">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? 'border-emerald-700 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.id === 'ai' && parsedAnalysis && <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full ml-0.5" />}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 lg:px-6 py-5 max-w-screen-2xl mx-auto">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm font-medium flex items-center gap-2"><span>⚠️</span>{error}</div>}
        {!kpis && !loading && <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400 text-sm">Aucune donnée disponible pour cette période.</div>}

      {kpis && (
        <>
        {/* ════════════ TAB: VUE D'ENSEMBLE ════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-5">

            {/* KPI Strip — 2 cols mobile, 4 cols tablet, 4 cols desktop (2 rows) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Chiffre d\'affaires', value: fmt(kpis.totalRevenue), spark: sparkRevenue, color: C.blue, icon: '💰', trend: fRevenue?.trend },
                { label: 'Bénéfice net', value: fmt(kpis.totalProfit), spark: sparkProfit, color: kpis.totalProfit >= 0 ? C.emerald : C.red, icon: kpis.totalProfit >= 0 ? '📈' : '📉', trend: fProfit?.trend },
                { label: 'Coûts totaux', value: fmt(kpis.totalCost), spark: null, color: C.slate, icon: '🧾' },
                { label: 'ROAS', value: (kpis.roas || 0).toFixed(2) + 'x', spark: null, color: kpis.roas >= 3 ? C.emerald : kpis.roas >= 2 ? C.amber : C.red, icon: '🎯' },
                { label: 'Cmd. reçues', value: num(kpis.totalOrdersReceived), spark: sparkOrders, color: C.indigo, icon: '📥', trend: null },
                { label: 'Cmd. livrées', value: num(kpis.totalOrdersDelivered), spark: null, color: C.indigo, icon: '📦', trend: fOrders?.trend },
                { label: 'Taux livraison', value: pct(kpis.deliveryRate), spark: delivBars.map(d => d.value), color: kpis.deliveryRate >= 0.7 ? C.emerald : C.orange, icon: '🚚' },
                { label: 'Dépenses pub', value: fmt(kpis.totalAdSpend), spark: null, color: C.red, icon: '📣' }
              ].map((k, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2 min-h-[96px]">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{k.label}</p>
                    <span className="text-base leading-none">{k.icon}</span>
                  </div>
                  <p className="text-xl font-extrabold leading-none" style={{ color: k.color }}>{k.value}</p>
                  {k.spark && k.spark.length > 1
                    ? <Sparkline data={k.spark} color={k.color} h={28} w={100} />
                    : <div className="h-7" />}
                  {k.trend && (
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${k.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {k.trend === 'up' ? '▲ Hausse' : '▼ Baisse'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Score + Radar + Marges — equal height columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              {/* Health Score */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                  <div className="w-1 h-4 rounded-full" style={{ background: C.indigo }} />
                  <span className="text-sm">❤️</span>
                  <h3 className="text-sm font-bold text-gray-900">Score Santé Business</h3>
                </div>
                <div className="p-5 flex flex-col items-center flex-1 justify-between">
                  <HealthGauge score={scores.global} size={150} />
                  <div className="grid grid-cols-1 gap-2.5 mt-4 w-full">
                    {[
                      { label: 'Finance', value: scores.finance, color: C.emerald },
                      { label: 'Marketing', value: scores.marketing, color: C.blue },
                      { label: 'Stock', value: scores.stock, color: C.purple },
                      { label: 'Croissance', value: scores.growth, color: C.orange }
                    ].map(s => (
                      <ProgressBar key={s.label} value={s.value} max={100} color={s.color} label={s.label} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Radar */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                  <div className="w-1 h-4 rounded-full" style={{ background: C.blue }} />
                  <span className="text-sm">🎯</span>
                  <h3 className="text-sm font-bold text-gray-900">Radar Performance</h3>
                </div>
                <div className="p-4 flex items-center justify-center flex-1">
                  <RadarChart scores={scores} size={220} />
                </div>
              </div>

              {/* Financière */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                  <div className="w-1 h-4 rounded-full" style={{ background: C.emerald }} />
                  <span className="text-sm">💹</span>
                  <h3 className="text-sm font-bold text-gray-900">Répartition Financière</h3>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-center mb-4">
                    <DonutChart size={120} segments={[
                      { label: 'Bénéfice', value: Math.max(0, kpis.totalProfit || 0) },
                      { label: 'Coût prod', value: Math.max(0, (kpis.totalCost || 0) - (kpis.totalAdSpend || 0)) },
                      { label: 'Pub', value: Math.max(0, kpis.totalAdSpend || 0) }
                    ]} />
                  </div>
                  {/* Donut legend */}
                  <div className="flex justify-center gap-4 mb-4 text-[11px]">
                    {[{ label: 'Bénéfice', col: C.blue }, { label: 'Coûts', col: C.emerald }, { label: 'Pub', col: C.amber }].map(l => (
                      <span key={l.label} className="flex items-center gap-1 font-medium text-gray-600">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.col }} />{l.label}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-3 mt-auto">
                    {[
                      { label: 'Marge nette', value: kpis.totalRevenue > 0 ? ((kpis.totalProfit / kpis.totalRevenue) * 100).toFixed(1) + '%' : '–', color: C.blue },
                      { label: 'Ratio pub / CA', value: kpis.totalRevenue > 0 ? ((kpis.totalAdSpend / kpis.totalRevenue) * 100).toFixed(1) + '%' : '–', color: C.red },
                      { label: 'Profit / commande', value: kpis.totalOrdersDelivered > 0 ? fmt(kpis.totalProfit / kpis.totalOrdersDelivered) : '–', color: C.emerald },
                      { label: 'CA / commande', value: kpis.totalOrdersDelivered > 0 ? fmt(kpis.totalRevenue / kpis.totalOrdersDelivered) : '–', color: C.indigo }
                    ].map((m, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-500">{m.label}</span>
                        <span className="text-sm font-extrabold" style={{ color: m.color }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Courbe tendance journalière */}
            {daily.length > 1 && (
              <Card title="Courbe de Tendance — CA · Profit · Pub" icon="📉" accent={C.blue}>
                <div className="w-full overflow-x-auto rounded-lg">
                  <div style={{ minWidth: Math.max(500, daily.slice(-30).length * 30) }}>
                    {(() => {
                      const d30 = daily.slice(-30);
                      const maxRev = Math.max(...d30.map(d => d.revenue || 0), 1);
                      const H = 120;
                      const W = Math.max(400, d30.length * 28);
                      const px = (i) => (i / (d30.length - 1)) * (W - 20) + 10;
                      const py = (v) => H - ((v / maxRev) * (H - 16)) - 4;
                      const mkPath = (key) => d30.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(d[key] || 0).toFixed(1)}`).join(' ');
                      const revPath = mkPath('revenue');
                      const profPath = mkPath('profit');
                      const adPath = mkPath('adSpend');
                      return (
                        <svg width={W} height={H + 24} viewBox={`0 0 ${W} ${H + 24}`}>
                          <path d={revPath + ` L${px(d30.length-1)},${H} L${px(0)},${H} Z`} fill={C.blue} fillOpacity="0.06" />
                          <path d={revPath} fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinejoin="round" />
                          <path d={profPath} fill="none" stroke={C.emerald} strokeWidth="2" strokeLinejoin="round" strokeDasharray="5 3" />
                          <path d={adPath} fill="none" stroke={C.red} strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3 3" />
                          {d30.map((d, i) => (
                            <text key={i} x={px(i)} y={H + 16} textAnchor="middle" fill="#94a3b8" fontSize="8">
                              {(d._id || '').slice(-5)}
                            </text>
                          ))}
                        </svg>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-[11px] font-semibold">
                  <span style={{ color: C.blue }}>━ CA</span>
                  <span style={{ color: C.emerald }}>╌ Profit</span>
                  <span style={{ color: C.red }}>╌ Pub</span>
                </div>
              </Card>
            )}

            {/* Commandes par statut */}
            {ordersByStatus.length > 0 && (
              <Card title="Commandes par Statut" icon="📋" accent={C.indigo}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 auto-rows-fr">
                  {ordersByStatus.map((s, i) => {
                    const colors = [C.blue, C.emerald, C.amber, C.red, C.purple, C.cyan];
                    const col = colors[i % colors.length];
                    const total = ordersByStatus.reduce((sum, x) => sum + (x.count || 0), 0);
                    const pctVal = total > 0 ? ((s.count / total) * 100).toFixed(0) : 0;
                    return (
                      <div key={s.status} className="rounded-xl p-3 border flex flex-col gap-1" style={{ borderColor: col + '30', background: col + '08' }}>
                        <p className="text-[10px] font-bold uppercase truncate" style={{ color: col }}>{s.status}</p>
                        <p className="text-2xl font-extrabold text-gray-900">{num(s.count)}</p>
                        <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                          <div style={{ width: `${pctVal}%`, background: col }} className="h-full rounded-full" />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{pctVal}% du total</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Transactions */}
            {txSummary && (
              <Card title="Trésorerie & Transactions" icon="💳" accent={C.emerald}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  <div className="text-center p-3 bg-emerald-50 rounded-xl">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Entrées</p>
                    <p className="text-lg font-extrabold text-emerald-700">{fmt(txSummary.totalIncome)}</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-xl">
                    <p className="text-[10px] font-bold text-red-600 uppercase">Sorties</p>
                    <p className="text-lg font-extrabold text-red-700">{fmt(txSummary.totalExpense)}</p>
                  </div>
                  <div className={`text-center p-3 rounded-xl ${(txSummary.balance || 0) >= 0 ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                    <p className={`text-[10px] font-bold uppercase ${(txSummary.balance || 0) >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>Solde</p>
                    <p className={`text-lg font-extrabold ${(txSummary.balance || 0) >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>{fmt(txSummary.balance)}</p>
                  </div>
                </div>
                {Array.isArray(txSummary.byCategory) && txSummary.byCategory.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead><tr className="border-b border-gray-100">{['Type', 'Catégorie', 'Total', 'Nb'].map(h => <th key={h} className="py-2 px-3 text-left font-semibold text-gray-400 uppercase">{h}</th>)}</tr></thead>
                      <tbody>
                        {txSummary.byCategory.slice(0, 10).map((c, idx) => (
                          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3 font-medium text-gray-700">{c._id?.type}</td>
                            <td className="py-2 px-3 text-gray-500">{c._id?.category}</td>
                            <td className="py-2 px-3 font-bold text-gray-900">{fmt(c.total)}</td>
                            <td className="py-2 px-3 text-gray-500">{num(c.count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ════════════ TAB: PRODUITS ════════════ */}
        {activeTab === 'products' && (
          <div className="space-y-5">
            {topProducts.length > 0 ? (
              <>
                {/* Bar charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card title="Top Produits — Chiffre d'affaires" icon="💰" accent={C.blue}>
                    <BarChart data={topProdBars} color={C.blue} h={100} />
                  </Card>
                  <Card title="Top Produits — Profit net" icon="📊" accent={C.emerald}>
                    <BarChart data={topProfitBars} color={C.emerald} h={100} />
                  </Card>
                </div>

                {/* Product cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {topProducts.map((p, i) => {
                    const rank = i + 1;
                    const rankColor = rank === 1 ? C.amber : rank === 2 ? C.slate : rank === 3 ? C.orange : C.blue;
                    const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100) : 0;
                    const roasCol = (p.roas || 0) >= 3 ? C.emerald : (p.roas || 0) >= 2 ? C.amber : C.red;
                    return (
                      <div key={p._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                        {/* Card header */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0" style={{ background: rankColor }}>
                            {rank}
                          </div>
                          <p className="text-sm font-bold text-gray-900 truncate flex-1 min-w-0">{p.name}</p>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: roasCol + '18', color: roasCol }}>
                            {(p.roas || 0).toFixed(1)}x
                          </span>
                        </div>
                        {/* KPI trio */}
                        <div className="grid grid-cols-3 divide-x divide-gray-50 border-b border-gray-50">
                          <div className="py-3 px-3 text-center">
                            <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">CA</p>
                            <p className="text-sm font-extrabold text-emerald-600 leading-tight">{fmt(p.revenue)}</p>
                          </div>
                          <div className="py-3 px-3 text-center">
                            <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Profit</p>
                            <p className={`text-sm font-extrabold leading-tight ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(p.profit)}</p>
                          </div>
                          <div className="py-3 px-3 text-center">
                            <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Pub</p>
                            <p className="text-sm font-extrabold text-orange-500 leading-tight">{fmt(p.adSpend)}</p>
                          </div>
                        </div>
                        {/* Progress bars */}
                        <div className="p-4 space-y-3 flex-1">
                          <ProgressBar value={(p.deliveryRate || 0) * 100} max={100}
                            color={(p.deliveryRate || 0) >= 0.7 ? C.emerald : C.orange}
                            label={`Livraison — ${num(p.ordersDelivered)} / ${num(p.ordersReceived)}`}
                            sublabel={`${((p.deliveryRate || 0) * 100).toFixed(1)}% de taux`} />
                          <ProgressBar value={Math.max(0, margin)} max={100}
                            color={margin >= 20 ? C.emerald : margin >= 10 ? C.amber : C.red}
                            label={`Marge nette — ${margin.toFixed(1)}%`}
                            showPct={false} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Full table */}
                <Card title="Tableau Complet des Produits" icon="📋" accent={C.slate}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead><tr className="border-b border-gray-100 bg-gray-50">
                        {['#', 'Produit', 'Reçues', 'Livrées', 'Taux', 'CA', 'Pub', 'Profit', 'ROAS', 'Marge'].map(h => (
                          <th key={h} className="py-2 px-3 text-left font-semibold text-gray-400 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {topProducts.map((p, i) => {
                          const mg = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={p._id} className="border-b border-gray-50 hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-gray-400">{i + 1}</td>
                              <td className="py-2 px-3 font-semibold text-gray-900 whitespace-nowrap max-w-[140px] truncate">{p.name}</td>
                              <td className="py-2 px-3 text-gray-600">{num(p.ordersReceived)}</td>
                              <td className="py-2 px-3 text-gray-600">{num(p.ordersDelivered)}</td>
                              <td className="py-2 px-3"><span className={`font-bold ${(p.deliveryRate || 0) >= 0.7 ? 'text-emerald-600' : 'text-orange-500'}`}>{pct(p.deliveryRate)}</span></td>
                              <td className="py-2 px-3 font-bold text-emerald-600 whitespace-nowrap">{fmt(p.revenue)}</td>
                              <td className="py-2 px-3 text-red-500 whitespace-nowrap">{fmt(p.adSpend)}</td>
                              <td className={`py-2 px-3 font-bold whitespace-nowrap ${(p.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(p.profit)}</td>
                              <td className="py-2 px-3"><span className={`font-bold ${(p.roas || 0) >= 3 ? 'text-emerald-600' : (p.roas || 0) >= 2 ? 'text-amber-500' : 'text-red-500'}`}>{(p.roas || 0).toFixed(2)}</span></td>
                              <td className="py-2 px-3"><span className={`font-bold ${parseFloat(mg) >= 20 ? 'text-emerald-600' : parseFloat(mg) >= 10 ? 'text-amber-500' : 'text-red-500'}`}>{mg}%</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Aucun produit disponible.</div>
            )}
          </div>
        )}

        {/* ════════════ TAB: STOCK ════════════ */}
        {activeTab === 'stock' && (
          <div className="space-y-5">
            {stockOverview && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Produits actifs', value: num(stockOverview.totalProducts), color: C.blue, icon: '📦' },
                  { label: 'Stock total', value: num(stockOverview.totalStock), color: C.indigo, icon: '🏪' },
                  { label: 'Valeur stock', value: fmt(stockOverview.totalStockValue), color: C.emerald, icon: '💰' },
                  { label: 'Ruptures', value: num(stockOverview.outOfStockCount), color: stockOverview.outOfStockCount > 0 ? C.red : C.emerald, icon: stockOverview.outOfStockCount > 0 ? '🚨' : '✅' }
                ].map((m, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
                    <span className="text-2xl leading-none">{m.icon}</span>
                    <p className="text-2xl font-extrabold mt-1" style={{ color: m.color }}>{m.value}</p>
                    <p className="text-xs text-gray-400 font-semibold">{m.label}</p>
                  </div>
                ))}
              </div>
            )}

            {stockOverview && (
              <Card title="Santé du Stock" icon="💊" accent={C.purple}>
                <div className="space-y-3">
                  <ProgressBar
                    value={(stockOverview.totalProducts || 0) - (stockOverview.outOfStockCount || 0)}
                    max={stockOverview.totalProducts || 1}
                    color={C.emerald}
                    label="Produits disponibles"
                    sublabel={`${(stockOverview.totalProducts || 0) - (stockOverview.outOfStockCount || 0)} / ${stockOverview.totalProducts} produits en stock`}
                  />
                  {stockAlerts?.summary && (
                    <>
                      <ProgressBar value={stockAlerts.summary.lowStockCount || 0} max={stockOverview.totalProducts || 1} color={C.amber} label="Stock bas" sublabel={`${stockAlerts.summary.lowStockCount} produits sous le seuil`} />
                      <ProgressBar value={stockAlerts.summary.delayedOrdersCount || 0} max={Math.max(1, stockAlerts.summary.delayedOrdersCount + 5)} color={C.red} label="Commandes en retard" sublabel={`${stockAlerts.summary.delayedOrdersCount} commandes fournisseur retardées`} />
                    </>
                  )}
                </div>
              </Card>
            )}

            {stockAlerts && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Array.isArray(stockAlerts.lowStockProducts) && stockAlerts.lowStockProducts.length > 0 && (
                  <Card title="Produits Stock Bas" icon="⚠️" accent={C.amber}>
                    <div className="space-y-2">
                      {stockAlerts.lowStockProducts.slice(0, 12).map(p => (
                        <div key={p._id}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700 truncate flex-1">{p.name}</span>
                            <span className="text-xs font-bold text-amber-600 ml-2">{num(p.stock)} / {num(p.reorderThreshold)}</span>
                          </div>
                          <ProgressBar value={p.stock} max={p.reorderThreshold || 1} color={C.amber} showPct={false} />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {Array.isArray(stockAlerts.delayedOrders) && stockAlerts.delayedOrders.length > 0 && (
                  <Card title="Commandes Fournisseur en Retard" icon="🚚" accent={C.red}>
                    <div className="space-y-2">
                      {stockAlerts.delayedOrders.slice(0, 10).map(o => (
                        <div key={o._id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                          <span className="text-xs font-medium text-gray-700 truncate">{o.productId?.name || o.productName || 'Produit'}</span>
                          <span className="text-xs font-bold text-red-600 ml-2 whitespace-nowrap">+{num(o.delayDays)} j</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {stockLocationsSummary?.totals && (
              <Card title="Emplacements de Stock" icon="📍" accent={C.cyan}>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Qté totale', value: num(stockLocationsSummary.totals.totalQuantity) },
                    { label: 'Valeur', value: fmt(stockLocationsSummary.totals.totalValue) },
                    { label: 'Villes', value: num(stockLocationsSummary.totals.citiesCount) },
                    { label: 'Agences', value: num(stockLocationsSummary.totals.agenciesCount) }
                  ].map((m, i) => (
                    <div key={i} className="text-center p-2 bg-slate-50 rounded-xl">
                      <p className="text-base font-extrabold text-gray-900">{m.value}</p>
                      <p className="text-[10px] text-gray-400">{m.label}</p>
                    </div>
                  ))}
                </div>
                {Array.isArray(stockLocationsSummary.byCity) && stockLocationsSummary.byCity.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Top villes</p>
                    {stockLocationsSummary.byCity.slice(0, 8).map(c => (
                      <div key={c._id} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-28 truncate">{c._id || 'N/A'}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div style={{ width: `${Math.min(100, (c.totalQuantity / (stockLocationsSummary.totals.totalQuantity || 1)) * 100)}%`, background: C.cyan }} className="h-full rounded-full" />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-16 text-right">{num(c.totalQuantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ════════════ TAB: TENDANCES ════════════ */}
        {activeTab === 'trends' && (
          <div className="space-y-5">
            {daily.length > 1 ? (
              <>
                <Card title="Évolution Journalière Complète" icon="📈" accent={C.blue}>
                  <div className="w-full overflow-x-auto rounded-lg">
                    <div style={{ minWidth: Math.max(560, daily.slice(-30).length * 30) }}>
                      {(() => {
                        const d30 = daily.slice(-30);
                        const maxRev = Math.max(...d30.map(d => d.revenue || 0), 1);
                        const H = 160;
                        const W = Math.max(500, d30.length * 28);
                        const px = (i) => (i / (d30.length - 1)) * (W - 20) + 10;
                        const py = (v) => H - ((v / maxRev) * (H - 20)) - 4;
                        const mkPath = (key) => d30.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(d[key] || 0).toFixed(1)}`).join(' ');
                        return (
                          <svg width={W} height={H + 30} viewBox={`0 0 ${W} ${H + 30}`}>
                            {[0, 0.25, 0.5, 0.75, 1].map(lv => (
                              <line key={lv} x1="0" y1={py(maxRev * lv)} x2={W} y2={py(maxRev * lv)} stroke="#f1f5f9" strokeWidth="1" />
                            ))}
                            <path d={mkPath('revenue') + ` L${px(d30.length-1)},${H} L${px(0)},${H} Z`} fill={C.blue} fillOpacity="0.07" />
                            <path d={mkPath('revenue')} fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinejoin="round" />
                            <path d={mkPath('profit')} fill="none" stroke={C.emerald} strokeWidth="2" strokeLinejoin="round" strokeDasharray="6 3" />
                            <path d={mkPath('adSpend')} fill="none" stroke={C.red} strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3 3" />
                            {d30.map((d, i) => <text key={i} x={px(i)} y={H + 20} textAnchor="middle" fill="#94a3b8" fontSize="8">{(d._id || '').slice(-5)}</text>)}
                            {d30.map((d, i) => <circle key={i} cx={px(i)} cy={py(d.revenue || 0)} r="3" fill={C.blue} fillOpacity="0.6" />)}
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2 text-[11px] font-semibold">
                    <span style={{ color: C.blue }}>━ CA</span>
                    <span style={{ color: C.emerald }}>╌ Profit</span>
                    <span style={{ color: C.red }}>╌ Pub</span>
                  </div>
                </Card>

                <Card title="Taux de Livraison par Jour" icon="🚚" accent={C.emerald}>
                  <BarChart data={delivBars} color={C.emerald} h={100} />
                </Card>

                <Card title="Données Journalières Détaillées" icon="📋" accent={C.slate}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead><tr className="border-b border-gray-100 bg-gray-50">
                        {['Date', 'Reçues', 'Livrées', 'Taux', 'CA', 'Pub', 'Profit', 'ROAS'].map(h => (
                          <th key={h} className="py-2 px-3 text-left font-semibold text-gray-400 uppercase">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {daily.slice(-31).reverse().map((d) => (
                          <tr key={d._id} className="border-b border-gray-50 hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium text-gray-700 whitespace-nowrap">{d._id}</td>
                            <td className="py-2 px-3 text-gray-600">{num(d.ordersReceived)}</td>
                            <td className="py-2 px-3 text-gray-600">{num(d.ordersDelivered)}</td>
                            <td className="py-2 px-3"><span className={`font-bold ${(d.deliveryRate || 0) >= 0.7 ? 'text-emerald-600' : 'text-orange-500'}`}>{pct(d.deliveryRate)}</span></td>
                            <td className="py-2 px-3 font-bold text-emerald-600 whitespace-nowrap">{fmt(d.revenue)}</td>
                            <td className="py-2 px-3 text-red-500 whitespace-nowrap">{fmt(d.adSpend)}</td>
                            <td className={`py-2 px-3 font-bold whitespace-nowrap ${(d.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(d.profit)}</td>
                            <td className="py-2 px-3"><span className={`font-bold ${(d.roas || 0) >= 3 ? 'text-emerald-600' : (d.roas || 0) >= 2 ? 'text-amber-500' : 'text-red-500'}`}>{(d.roas || 0).toFixed(2)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Pas assez de données journalières pour afficher les tendances.</div>
            )}
          </div>
        )}

        {/* ════════════ TAB: PRÉVISIONS ════════════ */}
        {activeTab === 'forecast' && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-emerald-50 to-emerald-50 rounded-2xl px-5 py-4 border border-emerald-100 flex items-center gap-3">
              <span className="text-2xl">🔮</span>
              <div>
                <p className="text-xs font-extrabold text-emerald-700 uppercase tracking-wide">Méthode de prévision</p>
                <p className="text-sm text-emerald-800 mt-0.5">Régression linéaire sur les 14 derniers jours · Projection sur 30 jours calendaires</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'CA Projeté — mois prochain', value: fRevenue ? fmt(fRevenue.nextMonth) : 'Données insuf.', trend: fRevenue?.trend, color: C.blue, icon: '💰', current: fmt(kpis.totalRevenue) },
                { label: 'Profit Projeté — mois prochain', value: fProfit ? fmt(fProfit.nextMonth) : 'Données insuf.', trend: fProfit?.trend, color: C.emerald, icon: '📈', current: fmt(kpis.totalProfit) },
                { label: 'Commandes Projetées', value: fOrders ? num(Math.round(fOrders.nextMonth)) : 'Données insuf.', trend: fOrders?.trend, color: C.indigo, icon: '📦', current: num(kpis.totalOrdersDelivered) }
              ].map((f, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl leading-none">{f.icon}</span>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide leading-tight">{f.label}</p>
                  </div>
                  <p className="text-3xl font-extrabold leading-none" style={{ color: f.color }}>{f.value}</p>
                  <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
                    {f.trend && (
                      <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                        f.trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>{f.trend === 'up' ? '▲ Hausse' : '▼ Baisse'}</span>
                    )}
                    <span className="text-xs text-gray-400">Actuel : {f.current}</span>
                  </div>
                </div>
              ))}
            </div>

            {daily.length > 1 && (
              <Card title="Courbe de Tendance + Prévision" icon="🔮" accent={C.indigo}>
                {(() => {
                  const d14 = daily.slice(-14);
                  const W = 500, H = 140;
                  const revData = d14.map(d => d.revenue || 0);
                  const maxVal = Math.max(...revData, 1);
                  const allPts = [...revData];
                  if (fRevenue) {
                    const { slope, nextMonth } = fRevenue;
                    const dailyForecast = nextMonth / 30;
                    for (let k = 1; k <= 7; k++) allPts.push(Math.max(0, revData[revData.length - 1] + slope * k));
                  }
                  const maxAll = Math.max(...allPts, maxVal);
                  const px = (i, total) => (i / (total - 1)) * (W - 20) + 10;
                  const py = (v) => H - ((v / maxAll) * (H - 20)) - 4;
                  const histPath = revData.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i, allPts.length).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
                  const forecastPts = fRevenue ? allPts.slice(revData.length - 1) : [];
                  const forecastPath = forecastPts.length > 1 ? forecastPts.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(revData.length - 1 + i, allPts.length).toFixed(1)},${py(v).toFixed(1)}`).join(' ') : '';
                  return (
                    <div className="overflow-x-auto">
                      <svg width={W} height={H + 30} viewBox={`0 0 ${W} ${H + 30}`}>
                        {[0, 0.5, 1].map(lv => <line key={lv} x1="0" y1={py(maxAll * lv)} x2={W} y2={py(maxAll * lv)} stroke="#f1f5f9" strokeWidth="1" />)}
                        <path d={histPath + ` L${px(revData.length-1, allPts.length)},${H} L${px(0, allPts.length)},${H} Z`} fill={C.blue} fillOpacity="0.07" />
                        <path d={histPath} fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinejoin="round" />
                        {forecastPath && <path d={forecastPath} fill="none" stroke={C.indigo} strokeWidth="2" strokeLinejoin="round" strokeDasharray="6 4" opacity="0.7" />}
                        <line x1={px(revData.length - 1, allPts.length)} y1="0" x2={px(revData.length - 1, allPts.length)} y2={H} stroke={C.indigo} strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
                        {d14.map((d, i) => <text key={i} x={px(i, allPts.length)} y={H + 20} textAnchor="middle" fill="#94a3b8" fontSize="7">{(d._id || '').slice(-5)}</text>)}
                      </svg>
                    </div>
                  );
                })()}
                <div className="flex gap-4 mt-2 text-[11px] font-semibold">
                  <span style={{ color: C.blue }}>━ Historique</span>
                  <span style={{ color: C.indigo }}>╌ Prévision</span>
                </div>
              </Card>
            )}

            <Card title="Actions Recommandées pour le Mois Prochain" icon="🎯" accent={C.orange}>
              <div className="space-y-2">
                {[
                  fRevenue?.trend === 'down' && { text: 'Le CA est en baisse — réviser les budgets publicitaires et relancer les produits en perte de vitesse.', type: 'warning' },
                  fRevenue?.trend === 'up' && { text: 'Le CA est en croissance — scaler les campagnes des produits performants pour maximiser la dynamique.', type: 'success' },
                  fProfit?.trend === 'down' && { text: 'La marge se comprime — analyser les coûts produit et réduire les dépenses pub à faible ROAS.', type: 'warning' },
                  (kpis.roas || 0) < 2 && { text: `ROAS actuel de ${(kpis.roas || 0).toFixed(2)}x — en dessous du seuil rentable. Couper les campagnes non performantes.`, type: 'critical' },
                  (kpis.deliveryRate || 0) < 0.7 && { text: `Taux de livraison de ${pct(kpis.deliveryRate)} — identifier les causes de non-livraison (retours, refus) et agir.`, type: 'warning' },
                  (stockOverview?.outOfStockCount || 0) > 0 && { text: `${stockOverview.outOfStockCount} produits en rupture de stock — réapprovisionner avant le prochain cycle de commandes.`, type: 'critical' },
                  { text: 'Consolider les données de ce mois et fixer des objectifs réalistes basés sur les prévisions calculées.', type: 'info' }
                ].filter(Boolean).map((action, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border text-sm font-medium ${
                    action.type === 'critical' ? 'bg-red-50 border-red-100 text-red-700' :
                    action.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                    action.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                    'bg-emerald-50 border-emerald-100 text-emerald-700'
                  }`}>
                    <span className="flex-shrink-0 mt-0.5">
                      {action.type === 'critical' ? '🔴' : action.type === 'warning' ? '🟡' : action.type === 'success' ? '🟢' : '🔵'}
                    </span>
                    {action.text}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ════════════ TAB: ANALYSE IA ════════════ */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {!parsedAnalysis && !aiRaw && !analyzing && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 px-6 text-center">
                <p className="text-5xl mb-4">⚡</p>
                <p className="text-base font-bold text-gray-800 mb-2">Aucune analyse IA générée</p>
                <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">Lancez une analyse stratégique complète alimentée par l'IA pour visualiser les insights de vos données.</p>
                <button onClick={handleAnalyzeGlobal} disabled={analyzing || !kpis}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white text-sm font-bold rounded-xl hover:shadow-md hover:shadow-emerald-200 transition">
                  Lancer l'analyse IA
                </button>
              </div>
            )}

            {analyzing && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">Analyse IA en cours…</p>
                <p className="text-xs text-gray-400 mt-1">Cela peut prendre jusqu'à 2 minutes</p>
              </div>
            )}

            {parsedAnalysis && (
              <>
                {/* Executive Summary */}
                {parsedAnalysis.executive_summary && (() => {
                  const es = parsedAnalysis.executive_summary;
                  const hscore = es.health_score ?? scores.global;
                  const riskCol = { critical: C.red, high: C.orange, medium: C.amber, low: C.blue }[es.risk_level] || C.amber;
                  return (
                    <div className="bg-gradient-to-br from-slate-900 to-emerald-900 rounded-2xl p-5 text-white">
                      <div className="flex items-start gap-4 flex-wrap">
                        <div className="flex-shrink-0">
                          <HealthGauge score={hscore} size={130} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-extrabold">Résumé Exécutif</h2>
                            {es.risk_level && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: riskCol + '40', color: '#fff' }}>Risque {es.risk_level}</span>}
                            {es.growth_status && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/80">{es.growth_status}</span>}
                          </div>
                          {es.main_problem && (
                            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3">
                              <p className="text-[10px] font-bold text-red-300 uppercase mb-1">Problème Principal</p>
                              <p className="text-sm text-white/90">{es.main_problem}</p>
                            </div>
                          )}
                          {es.main_opportunity && (
                            <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-3">
                              <p className="text-[10px] font-bold text-emerald-300 uppercase mb-1">Opportunité Principale</p>
                              <p className="text-sm text-white/90">{es.main_opportunity}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Finance + Marketing */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {parsedAnalysis.financial_analysis && (() => {
                    const fa = parsedAnalysis.financial_analysis;
                    return (
                      <Card title="Analyse Financière" icon="💰" accent={C.emerald}>
                        {fa.diagnosis && <p className="text-sm text-gray-700 mb-3 leading-relaxed">{fa.diagnosis}</p>}
                        {fa.hidden_losses && (
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
                            <p className="text-xs font-bold text-amber-600 uppercase mb-1">⚠️ Pertes Cachées</p>
                            <p className="text-sm text-amber-700">{fa.hidden_losses}</p>
                          </div>
                        )}
                        {Array.isArray(fa.recommendations) && fa.recommendations.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-bold text-gray-400 uppercase">Recommandations</p>
                            {fa.recommendations.map((r, i) => (
                              <div key={i} className="flex items-start gap-2 p-2 bg-emerald-50 rounded-lg">
                                <span className="text-emerald-500 font-bold flex-shrink-0">{i + 1}.</span>
                                <p className="text-xs text-gray-700">{r}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })()}

                  {parsedAnalysis.marketing_analysis && (() => {
                    const ma = parsedAnalysis.marketing_analysis;
                    return (
                      <Card title="Analyse Marketing" icon="📢" accent={C.blue}>
                        {ma.performance_status && <p className="text-sm text-gray-700 mb-3 leading-relaxed">{ma.performance_status}</p>}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {ma.cpa_diagnosis && (
                            <div className="bg-emerald-50 rounded-xl p-2.5">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase">CPA</p>
                              <p className="text-xs text-emerald-700 mt-0.5">{ma.cpa_diagnosis}</p>
                            </div>
                          )}
                          {ma.roas_diagnosis && (
                            <div className="bg-emerald-50 rounded-xl p-2.5">
                              <p className="text-[10px] font-bold text-emerald-700 uppercase">ROAS</p>
                              <p className="text-xs text-emerald-800 mt-0.5">{ma.roas_diagnosis}</p>
                            </div>
                          )}
                        </div>
                        {Array.isArray(ma.recommendations) && ma.recommendations.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-bold text-gray-400 uppercase">Recommandations</p>
                            {ma.recommendations.map((r, i) => (
                              <div key={i} className="flex items-start gap-2 p-2 bg-emerald-50 rounded-lg">
                                <span className="text-emerald-600 font-bold flex-shrink-0">{i + 1}.</span>
                                <p className="text-xs text-gray-700">{r}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })()}
                </div>

                {/* Products + Stock */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {parsedAnalysis.product_analysis && (() => {
                    const pa = parsedAnalysis.product_analysis;
                    const getName = (p) => typeof p === 'string' ? p : p?.name || JSON.stringify(p);
                    return (
                      <Card title="Analyse Produits IA" icon="📦" accent={C.purple}>
                        {pa.products_to_scale?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1.5">🚀 Scaler maintenant</p>
                            <div className="space-y-1">
                              {pa.products_to_scale.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                  <span className="w-4 h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0">{i+1}</span>
                                  <span className="text-xs font-medium text-emerald-700">{getName(p)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {pa.products_to_stop?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold text-red-600 uppercase mb-1.5">🛑 Arrêter</p>
                            <div className="space-y-1">
                              {pa.products_to_stop.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                                  <span className="w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0">{i+1}</span>
                                  <span className="text-xs font-medium text-red-700">{getName(p)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {pa.at_risk_products?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-orange-600 uppercase mb-1.5">⚠️ À surveiller</p>
                            <div className="space-y-1">
                              {pa.at_risk_products.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-100">
                                  <span className="w-4 h-4 bg-orange-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0">{i+1}</span>
                                  <span className="text-xs font-medium text-orange-700">{getName(p)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })()}

                  {parsedAnalysis.stock_analysis && (() => {
                    const sa = parsedAnalysis.stock_analysis;
                    const getStr = (v) => typeof v === 'string' ? v : v?.name || JSON.stringify(v);
                    return (
                      <Card title="Analyse Stock IA" icon="🏪" accent={C.red}>
                        {sa.critical_stock?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold text-red-600 uppercase mb-1.5">🔴 Stock critique</p>
                            {sa.critical_stock.map((s, i) => (
                              <div key={i} className="px-3 py-2 mb-1 bg-red-50 rounded-lg border border-red-100 text-xs font-medium text-red-700">{getStr(s)}</div>
                            ))}
                          </div>
                        )}
                        {sa.reorder_recommendations?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1.5">🔄 Réapprovisionner</p>
                            {sa.reorder_recommendations.map((r, i) => (
                              <div key={i} className="flex items-start gap-2 px-3 py-2 mb-1 bg-emerald-50 rounded-lg border border-emerald-100">
                                <span className="text-emerald-600 font-bold flex-shrink-0">→</span>
                                <p className="text-xs text-emerald-700">{getStr(r)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })()}
                </div>

                {/* Strategic Plan */}
                {parsedAnalysis.strategic_plan && (() => {
                  const sp = parsedAnalysis.strategic_plan;
                  return (
                    <Card title="Plan d'Action Stratégique" icon="🎯" accent={C.orange}>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { key: 'immediate_actions_24h', label: '⏰ Dans 24h', col: C.red, bg: 'bg-red-50 border-red-100' },
                          { key: 'actions_7_days', label: '📅 Cette semaine', col: C.amber, bg: 'bg-amber-50 border-amber-100' },
                          { key: 'actions_30_days', label: '📆 Ce mois', col: C.blue, bg: 'bg-emerald-50 border-emerald-100' }
                        ].map(({ key, label, col, bg }) => sp[key]?.length > 0 && (
                          <div key={key} className={`rounded-2xl p-4 border ${bg}`}>
                            <p className="text-xs font-extrabold uppercase mb-3" style={{ color: col }}>{label}</p>
                            <div className="space-y-2">
                              {sp[key].map((a, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white flex-shrink-0 mt-0.5" style={{ background: col }}>{i+1}</div>
                                  <p className="text-xs text-gray-700 leading-relaxed">{a}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })()}

                {/* Alerts */}
                {Array.isArray(parsedAnalysis.alerts) && parsedAnalysis.alerts.length > 0 && (
                  <Card title="Alertes Critiques" icon="🚨" accent={C.red}>
                    <div className="space-y-2">
                      {parsedAnalysis.alerts.map((alert, i) => {
                        const msg = typeof alert === 'string' ? alert : alert?.message || JSON.stringify(alert);
                        const lvl = alert?.level || 'high';
                        const col = { critical: C.red, high: C.orange, medium: C.amber, low: C.blue }[lvl] || C.orange;
                        return (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: col + '10', border: `1px solid ${col}30` }}>
                            <span className="flex-shrink-0 mt-0.5">🔔</span>
                            <p className="text-sm font-medium" style={{ color: col }}>{msg}</p>
                            <LevelBadge level={lvl} />
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </>
            )}

            {/* Fallback texte */}
            {aiRaw && !parsedAnalysis && (
              <Card title="Analyse IA (texte brut)" icon="🤖" accent={C.indigo}>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiRaw}</div>
              </Card>
            )}
          </div>
        )}

        </>
      )}
      </div>
    </div>
  );
};

export default Data;
