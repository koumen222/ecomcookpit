import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';
import {
  Plus, Filter, X, Zap, Calendar,
  ChevronRight, ChevronDown, ArrowUp, ArrowDown,
  MoreHorizontal, CheckCircle2, AlertTriangle,
  Package, Crown, Medal, Award, ArrowRight,
} from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
//  DESIGN SYSTEM (strict)
//  spacing : 4 / 8 / 12 / 16 / 24 / 32 / 48
//  radius  : 12px (rounded-xl) / 16px (rounded-2xl)
//  text    : xs(12) / sm(14) / base(16) / lg(18) / xl(20) / 2xl(24) / 3xl(30) / 5xl(48)
//  colors  : gray-900 / 700 / 500 / 400 / 200 / 100 / 50
//            scalor-green / primary-500 (#0F6B4F) (accent unique)
//            red-600 (état négatif uniquement)
//  motion  : transition-all duration-200 ease-out
//  shadows : aucune ombre colorée, shadow-sm max
// ═════════════════════════════════════════════════════════════════════════════

const T = 'transition-all duration-200 ease-out';

// ─── Skeleton ──
const Skeleton = () => (
  <div className="px-4 sm:px-6 py-6 space-y-6 max-w-5xl mx-auto">
    <div className="h-10 w-32 bg-gray-100 rounded-xl animate-pulse" />
    <div className="h-32 bg-gray-50 rounded-2xl animate-pulse" />
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
      ))}
    </div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
    ))}
  </div>
);

// ─── Delta indicator (+12%) — neutral when 0/N/A ──
const Delta = ({ value, suffix = '%' }) => {
  if (value === null || value === undefined || !isFinite(value)) {
    return <span className="text-gray-400 text-xs tabular-nums">—</span>;
  }
  if (Math.abs(value) < 0.1) {
    return <span className="text-gray-400 text-xs tabular-nums">±0{suffix}</span>;
  }
  const positive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${positive ? 'text-primary-500' : 'text-red-600'}`}>
      {positive ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}
      {Math.abs(value).toFixed(value < 10 ? 1 : 0)}{suffix}
    </span>
  );
};

// ─── Compact stat — pas de boîte d'icône colorée ──
const Stat = ({ label, value, delta }) => (
  <div className="py-2.5">
    <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
    <div className="flex items-baseline gap-2">
      <p className="text-lg font-semibold text-gray-900 tabular-nums tracking-tight">{value}</p>
      {delta !== undefined && <Delta value={delta} />}
    </div>
  </div>
);

// ─── Period chip — minimaliste ──
const Chip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`shrink-0 px-3 h-8 inline-flex items-center text-sm font-medium rounded-full ${T} ${
      active
        ? 'bg-primary-500 text-white'
        : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    {children}
  </button>
);

// ─── Report row — hairline separator, no card-in-card ──
const ReportRow = ({ report, isAdmin, isCloseuse, fmt, onDelete }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const rate = report.ordersReceived > 0
    ? Math.round((report.ordersDelivered / report.ordersReceived) * 100)
    : 0;
  const profit = report.profit ?? ((report.revenue || 0) - (report.cost || 0));

  return (
    <div
      onClick={() => navigate(`/ecom/reports/${report._id}`)}
      className={`group flex items-center gap-4 px-4 sm:px-5 py-4 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 cursor-pointer ${T}`}
    >
      {/* Date — discret */}
      <div className="w-14 shrink-0 text-center">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {new Date(report.date).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
        </p>
        <p className="text-lg font-semibold text-gray-900 tabular-nums leading-none mt-0.5">
          {new Date(report.date).getDate()}
        </p>
      </div>

      {/* Product name + secondary info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {report.productId?.name || 'Produit inconnu'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
          {report.ordersDelivered}/{report.ordersReceived} livrées · {rate}%
        </p>
      </div>

      {/* Profit (or ratio for closeuse) — right aligned */}
      {!isCloseuse && (
        <div className="text-right shrink-0">
          <p className={`text-sm font-semibold tabular-nums ${profit >= 0 ? 'text-primary-500' : 'text-red-600'}`}>
            {profit >= 0 ? '+' : ''}{fmt(profit)}
          </p>
          <p className="text-xs text-gray-500 tabular-nums mt-0.5">{fmt(report.revenue || 0)}</p>
        </div>
      )}

      {/* Menu */}
      <div className="shrink-0 relative">
        {(isAdmin || isCloseuse) ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
              className={`w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 ${T}`}
              aria-label="Actions"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[160px]">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); navigate(`/ecom/reports/${report._id}/edit`); }}
                    className={`block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 ${T}`}
                  >
                    Modifier
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(report._id); }}
                    className={`block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100 ${T}`}
                  >
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition" />
        )}
      </div>
    </div>
  );
};

// ─── Rank badge inline (top 3 lists) ──
const Rank = ({ n }) => {
  if (n === 1) return <Crown size={12} className="text-amber-500" />;
  if (n === 2) return <Medal size={12} className="text-gray-400" />;
  return <Award size={12} className="text-orange-400" />;
};

// ─── Insights — minimal, no boxes ──
const InsightList = ({ title, link, items, render }) => (
  <div>
    <div className="flex items-center justify-between mb-3 px-1">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
      {link && (
        <Link to={link} className={`text-xs font-medium text-primary-500 hover:text-primary-600 inline-flex items-center gap-0.5 ${T}`}>
          Voir tout <ChevronRight size={11} />
        </Link>
      )}
    </div>
    {items.length === 0 ? (
      <p className="text-xs text-gray-400 px-1 py-3">Aucune donnée</p>
    ) : (
      <div className="space-y-px">{items.map(render)}</div>
    )}
  </div>
);

// ─── Sheet (mobile) / Modal (desktop) ──
const Sheet = ({ open, onClose, title, children, size = 'sm' }) => {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  const maxW = size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-gray-900/40"
        onClick={onClose}
        style={{ animation: 'fadeIn 200ms ease-out' }}
      />
      <div
        className={`relative w-full ${maxW} bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto`}
        style={{ animation: 'slideUp 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-9 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-6 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className={`w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 ${T}`}>
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═════════════════════════════════════════════════════════════════════════════
const ReportsList = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();

  const [reports, setReports] = useState([]);
  const [financialStats, setFinancialStats] = useState({});
  const [prevStats, setPrevStats] = useState(null); // For delta computation
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  // Auto report state
  const [autoModal, setAutoModal] = useState(false);
  const [autoDate, setAutoDate] = useState(new Date().toISOString().split('T')[0]);
  const [autoStartDate, setAutoStartDate] = useState('');
  const [autoEndDate, setAutoEndDate] = useState('');
  const [autoMode, setAutoMode] = useState('day');
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoResult, setAutoResult] = useState(null);
  const [autoStep, setAutoStep] = useState('config');
  const [autoProducts, setAutoProducts] = useState([]);
  const [autoMappings, setAutoMappings] = useState({});

  const [filter, setFilter] = useState({ dateStart: '', dateEnd: '', status: '', productId: '' });
  const [dateRangePreset, setDateRangePreset] = useState('all');

  const isAdmin = user?.role === 'ecom_admin';
  const isCloseuse = user?.role === 'ecom_closeuse';

  useEffect(() => { loadData(); }, [filter]);

  useEffect(() => {
    const onStoreSwitch = () => {
      setReports([]);
      setFinancialStats({});
      setPrevStats(null);
      setFilter({ dateStart: '', dateEnd: '', status: '', productId: '' });
      setDateRangePreset('all');
    };
    window.addEventListener('scalor:store-switch', onStoreSwitch);
    return () => window.removeEventListener('scalor:store-switch', onStoreSwitch);
  }, []);

  // Compute the previous-period date range for delta calculation
  const previousPeriodParams = useMemo(() => {
    if (!filter.dateStart || !filter.dateEnd) return null;
    const start = new Date(filter.dateStart);
    const end = new Date(filter.dateEnd);
    const ms = end.getTime() - start.getTime();
    const lengthDays = Math.max(1, Math.round(ms / 86400000) + 1);
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (lengthDays - 1) * 86400000);
    return {
      startDate: prevStart.toISOString().split('T')[0],
      endDate: prevEnd.toISOString().split('T')[0],
    };
  }, [filter.dateStart, filter.dateEnd]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (filter.dateStart) params.startDate = filter.dateStart;
      if (filter.dateEnd) params.endDate = filter.dateEnd;
      if (filter.status) params.status = filter.status;
      if (filter.productId) params.productId = filter.productId;

      // Current period (reports + stats) in parallel with previous period stats
      const [reportsRes, statsRes, prevStatsRes] = await Promise.all([
        ecomApi.get('/reports', { params }),
        ecomApi.get('/reports/stats/financial', { params }).catch(() => ({ data: { data: {} } })),
        previousPeriodParams
          ? ecomApi.get('/reports/stats/financial', { params: previousPeriodParams }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const reportsData = reportsRes.data?.data?.reports || [];
      setReports(Array.isArray(reportsData) ? reportsData : []);
      setFinancialStats(statsRes.data?.data || {});
      setPrevStats(prevStatsRes?.data?.data || null);
    } catch (e) {
      setError(getContextualError(e, 'load_stats'));
      console.error(e);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const setPeriodPreset = (key) => {
    setDateRangePreset(key);
    if (key === 'all') setFilter(p => ({ ...p, dateStart: '', dateEnd: '' }));
    else if (key === 'today') {
      const t = new Date().toISOString().split('T')[0];
      setFilter(p => ({ ...p, dateStart: t, dateEnd: t }));
    } else if (key === 'week') {
      const td = new Date();
      const wa = new Date(td.getTime() - 6 * 86400000);
      setFilter(p => ({ ...p, dateStart: wa.toISOString().split('T')[0], dateEnd: td.toISOString().split('T')[0] }));
    } else if (key === 'month') {
      const td = new Date();
      const fd = new Date(td.getFullYear(), td.getMonth(), 1);
      setFilter(p => ({ ...p, dateStart: fd.toISOString().split('T')[0], dateEnd: td.toISOString().split('T')[0] }));
    }
  };

  const openAutoModal = async () => {
    setAutoModal(true);
    setAutoResult(null);
    setAutoStep('config');
    setAutoMappings({});
    try {
      const res = await ecomApi.get('/products', { params: { isActive: true, limit: 500 } });
      const list = res.data?.data?.products || res.data?.data || [];
      setAutoProducts(Array.isArray(list) ? list : []);
    } catch { setAutoProducts([]); }
  };

  const generateAutoReports = async (extraMappings = {}) => {
    try {
      setAutoLoading(true);
      setAutoResult(null);
      const dateBody = autoMode === 'day'
        ? { date: autoDate }
        : { startDate: autoStartDate, endDate: autoEndDate };
      const allMappings = Object.entries({ ...autoMappings, ...extraMappings })
        .filter(([, v]) => v)
        .map(([orderProductName, productId]) => ({ orderProductName, productId }));
      const body = { ...dateBody, ...(allMappings.length > 0 ? { mappings: allMappings } : {}) };
      const res = await ecomApi.post('/reports/auto-generate', body);
      setAutoResult(res.data);
      const unmatched = res.data?.data?.unmatched || [];
      if (unmatched.length > 0 && autoStep === 'config') setAutoStep('assign');
      else { setAutoStep('done'); loadData(); }
    } catch (err) {
      setAutoResult({ success: false, message: getContextualError(err, 'load_stats') });
    } finally {
      setAutoLoading(false);
    }
  };

  const deleteReport = async (id) => {
    if (!confirm('Supprimer ce rapport ?')) return;
    try {
      await ecomApi.delete(`/reports/${id}`);
      loadData();
    } catch (e) {
      setError(getContextualError(e, 'delete_order'));
    }
  };

  // ─── Computed stats ──
  const totals = useMemo(() => {
    const totalReceived = reports.reduce((s, r) => s + (r.ordersReceived || 0), 0);
    const totalDelivered = reports.reduce((s, r) => s + (r.ordersDelivered || 0), 0);
    const totalAdSpend = reports.reduce((s, r) => s + (r.adSpend || 0), 0);
    const totalRevenue = financialStats.totalRevenue || reports.reduce((s, r) => s + (r.revenue || 0), 0);
    const totalProfit = financialStats.totalProfit || reports.reduce((s, r) => s + (r.profit || 0), 0);
    const totalProductCost = financialStats.totalProductCost || reports.reduce((s, r) => s + (r.productCost || 0), 0);
    const totalDeliveryCost = financialStats.totalDeliveryCost || reports.reduce((s, r) => s + (r.deliveryCost || 0), 0);
    const totalCost = financialStats.totalCost || reports.reduce((s, r) => s + (r.cost || 0), 0);
    const roas = financialStats.roas ?? (totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0);
    const deliveryRate = totalReceived > 0 ? ((totalDelivered / totalReceived) * 100) : 0;
    return { totalReceived, totalDelivered, totalAdSpend, totalRevenue, totalProfit, totalProductCost, totalDeliveryCost, totalCost, roas, deliveryRate };
  }, [reports, financialStats]);

  // ─── Deltas vs previous period ──
  const deltas = useMemo(() => {
    if (!prevStats) return { profit: null, revenue: null, deliveryRate: null, roas: null };
    const pct = (cur, prev) => (prev && prev !== 0) ? ((cur - prev) / Math.abs(prev)) * 100 : null;
    const prevDeliveryRate = (prevStats.totalOrdersReceived || 0) > 0
      ? ((prevStats.totalOrdersDelivered || 0) / prevStats.totalOrdersReceived) * 100
      : 0;
    return {
      profit: pct(totals.totalProfit, prevStats.totalProfit),
      revenue: pct(totals.totalRevenue, prevStats.totalRevenue),
      deliveryRate: totals.deliveryRate - prevDeliveryRate, // points, not %
      roas: pct(totals.roas, prevStats.roas),
    };
  }, [totals, prevStats]);

  const getReportProfit = (r) => {
    if ((r.profit || 0) !== 0) return r.profit || 0;
    const rev = r.revenue || 0, c = r.cost || 0;
    if (rev !== 0 || c !== 0) return rev - c;
    return -(r.adSpend || 0);
  };

  const topProfitDays = useMemo(() => {
    const map = reports.reduce((acc, r) => {
      const k = new Date(r.date).toISOString().split('T')[0];
      if (!acc[k]) acc[k] = { date: k, profit: 0, reports: 0, delivered: 0 };
      acc[k].profit += getReportProfit(r);
      acc[k].reports += 1;
      acc[k].delivered += r.ordersDelivered || 0;
      return acc;
    }, {});
    return Object.values(map).sort((a, b) => b.profit - a.profit).slice(0, 3);
  }, [reports]);

  const topAgencies = useMemo(() => {
    const map = reports.reduce((acc, r) => {
      (r.deliveries || []).forEach(d => {
        const name = (d.agencyName || '').trim();
        if (!name) return;
        if (!acc[name]) acc[name] = { agencyName: name, ordersDelivered: 0, deliveryCost: 0 };
        acc[name].ordersDelivered += d.ordersDelivered || 0;
        acc[name].deliveryCost += d.deliveryCost || 0;
      });
      return acc;
    }, {});
    return Object.values(map).map(a => ({
      ...a,
      avgCostPerDelivery: a.ordersDelivered > 0 ? a.deliveryCost / a.ordersDelivered : 0,
    })).sort((a, b) => b.ordersDelivered - a.ordersDelivered).slice(0, 3);
  }, [reports]);

  const topProducts = useMemo(() => {
    const map = reports.reduce((acc, r) => {
      const name = r.productId?.name || 'Produit inconnu';
      if (!acc[name]) acc[name] = { productName: name, ordersDelivered: 0, revenue: 0 };
      acc[name].ordersDelivered += r.ordersDelivered || 0;
      acc[name].revenue += r.revenue || 0;
      return acc;
    }, {});
    return Object.values(map).sort((a, b) => b.ordersDelivered - a.ordersDelivered).slice(0, 3);
  }, [reports]);

  const activeFiltersCount =
    (filter.status ? 1 : 0) +
    (filter.productId ? 1 : 0);

  const hasComparison = !!prevStats;
  const profitPositive = totals.totalProfit >= 0;

  if (loading) return <Skeleton />;

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* Inline animations (200ms ease-out everywhere) */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ─── Sticky Header — solide, hairline en bas ────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="py-3 flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Rapports</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(true)}
                className={`relative w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-700 ${T}`}
                aria-label="Filtres"
              >
                <Filter size={16} strokeWidth={2} />
                {activeFiltersCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full" />
                )}
              </button>
              <button
                onClick={openAutoModal}
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-100 ${T}`}
              >
                <Zap size={14} strokeWidth={2} />
                Auto
              </button>
              <Link
                to="/ecom/reports/new"
                className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 ${T}`}
              >
                <Plus size={15} strokeWidth={2.5} />
                <span className="hidden xs:inline">Nouveau</span>
              </Link>
            </div>
          </div>

          {/* Period chips */}
          <div className="pb-2.5 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-0.5 w-max">
              <Chip active={dateRangePreset === 'all'} onClick={() => setPeriodPreset('all')}>Tout</Chip>
              <Chip active={dateRangePreset === 'today'} onClick={() => setPeriodPreset('today')}>Aujourd'hui</Chip>
              <Chip active={dateRangePreset === 'week'} onClick={() => setPeriodPreset('week')}>7 jours</Chip>
              <Chip active={dateRangePreset === 'month'} onClick={() => setPeriodPreset('month')}>Ce mois</Chip>
              <button
                onClick={() => setShowFilters(true)}
                className={`shrink-0 px-3 h-8 inline-flex items-center gap-1 text-sm font-medium rounded-full ${T} ${
                  dateRangePreset === 'custom' ? 'bg-primary-500 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Calendar size={12} strokeWidth={2} /> Personnalisé
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {error && (
          <div className="mt-6 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-start gap-2 text-sm">
            <AlertTriangle size={15} className="shrink-0 text-red-500 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ═══ HERO METRIC — un seul chiffre dominant ═══════════════════════ */}
        {!isCloseuse && (
          <section className="pt-5 pb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Bénéfice net</p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className={`text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums leading-none ${profitPositive ? 'text-primary-500' : 'text-red-600'}`}>
                {profitPositive ? '+' : ''}{fmt(totals.totalProfit)}
              </h2>
              {hasComparison && <Delta value={deltas.profit} />}
            </div>
            <p className="text-sm text-gray-500 mt-1.5">
              {dateRangePreset === 'all' && 'Toute la période'}
              {dateRangePreset === 'today' && "Aujourd'hui"}
              {dateRangePreset === 'week' && '7 derniers jours'}
              {dateRangePreset === 'month' && 'Ce mois-ci'}
              {dateRangePreset === 'custom' && 'Période personnalisée'}
              {hasComparison && <span className="text-gray-400"> · vs période précédente</span>}
            </p>
          </section>
        )}

        {/* ═══ STATS COMPACT — pas de boîtes d'icônes ═══════════════════════ */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-0 sm:gap-8 border-y border-gray-100 divide-x divide-gray-100 sm:divide-x-0">
          {!isCloseuse && (
            <div className="px-4 sm:px-0">
              <Stat
                label="Chiffre d'affaires"
                value={fmt(totals.totalRevenue)}
                delta={hasComparison ? deltas.revenue : undefined}
              />
            </div>
          )}
          <div className="px-4 sm:px-0">
            <Stat
              label="Cmd livrées"
              value={`${totals.totalDelivered}`}
            />
          </div>
          <div className="px-4 sm:px-0">
            <Stat
              label="Taux livraison"
              value={`${totals.deliveryRate.toFixed(0)}%`}
              delta={hasComparison ? deltas.deliveryRate : undefined}
            />
          </div>
          {!isCloseuse && (
            <div className="px-4 sm:px-0">
              <Stat
                label="ROAS"
                value={totals.roas > 0 ? totals.roas.toFixed(2) : '—'}
                delta={hasComparison ? deltas.roas : undefined}
              />
            </div>
          )}
          {isCloseuse && (
            <div className="px-4 sm:px-0">
              <Stat
                label="Cmd reçues"
                value={`${totals.totalReceived}`}
              />
            </div>
          )}
        </section>

        {/* ═══ COST BREAKDOWN — barre minimaliste ═══════════════════════════ */}
        {totals.totalCost > 0 && !isCloseuse && (
          <section className="py-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Coûts</p>
              <p className="text-sm font-medium text-gray-900 tabular-nums">{fmt(totals.totalCost)}</p>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-gray-100">
              <div className="bg-gray-900" style={{ width: `${(totals.totalProductCost / totals.totalCost * 100)}%` }} />
              <div className="bg-gray-500" style={{ width: `${(totals.totalDeliveryCost / totals.totalCost * 100)}%` }} />
              <div className="bg-gray-300" style={{ width: `${(totals.totalAdSpend / totals.totalCost * 100)}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs">
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="w-1.5 h-1.5 bg-gray-900 rounded-full" />
                Produits <strong className="font-semibold text-gray-900 tabular-nums">{fmt(totals.totalProductCost)}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                Livraison <strong className="font-semibold text-gray-900 tabular-nums">{fmt(totals.totalDeliveryCost)}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                Publicité <strong className="font-semibold text-gray-900 tabular-nums">{fmt(totals.totalAdSpend)}</strong>
              </span>
            </div>
          </section>
        )}

        {/* ═══ INSIGHTS — accordion mobile, 3 cols desktop ══════════════════ */}
        <section className="py-5 border-b border-gray-100">
          <button
            onClick={() => setShowInsights(s => !s)}
            className={`lg:hidden w-full flex items-center justify-between mb-3 ${T}`}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Top 3</p>
            <ChevronDown size={14} className={`text-gray-400 ${T} ${showInsights ? 'rotate-180' : ''}`} />
          </button>
          <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${showInsights ? 'block' : 'hidden lg:grid'}`}>
            <InsightList
              title="Jours rentables"
              link="/ecom/reports/insights?tab=days"
              items={topProfitDays}
              render={(day, i) => (
                <div key={day.date} className={`flex items-center gap-3 py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg ${T}`}>
                  <span className="w-4 shrink-0 flex justify-center"><Rank n={i + 1} /></span>
                  <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">
                    {new Date(day.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-xs text-gray-400 tabular-nums">{day.delivered}</span>
                  <span className={`text-sm font-medium tabular-nums shrink-0 ${day.profit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {fmt(day.profit)}
                  </span>
                </div>
              )}
            />
            <InsightList
              title="Agences efficaces"
              link="/ecom/reports/insights?tab=agencies"
              items={topAgencies}
              render={(a, i) => (
                <div key={a.agencyName} className={`flex items-center gap-3 py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg ${T}`}>
                  <span className="w-4 shrink-0 flex justify-center"><Rank n={i + 1} /></span>
                  <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">{a.agencyName}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{a.ordersDelivered}</span>
                  <span className="text-sm font-medium text-gray-900 tabular-nums shrink-0">{fmt(a.avgCostPerDelivery)}</span>
                </div>
              )}
            />
            <InsightList
              title="Top produits"
              link="/ecom/stats-rapports"
              items={topProducts}
              render={(p, i) => (
                <div key={`${p.productName}-${i}`} className={`flex items-center gap-3 py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg ${T}`}>
                  <span className="w-4 shrink-0 flex justify-center"><Rank n={i + 1} /></span>
                  <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">{p.productName}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{p.ordersDelivered}</span>
                  <span className="text-sm font-medium text-gray-900 tabular-nums shrink-0">{fmt(p.revenue)}</span>
                </div>
              )}
            />
          </div>
        </section>

        {/* ═══ REPORTS LIST — table-like rows, hairlines ════════════════════ */}
        <section className="py-5">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tous les rapports</p>
            {reports.length > 0 && (
              <p className="text-xs text-gray-400 tabular-nums">{reports.length}</p>
            )}
          </div>

          {reports.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={28} className="text-gray-200 mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-sm font-medium text-gray-700 mb-1">Aucun rapport</p>
              <p className="text-sm text-gray-500 mb-6">
                {activeFiltersCount > 0 || dateRangePreset !== 'all'
                  ? 'Essayez d\'élargir vos filtres'
                  : 'Créez votre premier rapport pour commencer'}
              </p>
              <Link
                to="/ecom/reports/new"
                className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 ${T}`}
              >
                <Plus size={14} strokeWidth={2.5} /> Nouveau rapport
              </Link>
            </div>
          ) : (
            <div className="border-t border-gray-100">
              {reports.map(r => (
                <ReportRow
                  key={r._id}
                  report={r}
                  isAdmin={isAdmin}
                  isCloseuse={isCloseuse}
                  fmt={fmt}
                  onDelete={deleteReport}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ─── Mobile FAB (Auto) ──────────────────────────────────────────── */}
      <button
        onClick={openAutoModal}
        className={`sm:hidden fixed bottom-6 right-5 z-20 w-12 h-12 rounded-full bg-primary-500 text-white shadow-lg active:scale-95 flex items-center justify-center ${T}`}
        aria-label="Rapport automatique"
      >
        <Zap size={18} strokeWidth={2} />
      </button>

      {/* ═══ FILTERS SHEET ════════════════════════════════════════════════ */}
      <Sheet open={showFilters} onClose={() => setShowFilters(false)} title="Filtres">
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Date début</label>
            <input
              type="date"
              value={filter.dateStart}
              onChange={(e) => { setDateRangePreset('custom'); setFilter(p => ({ ...p, dateStart: e.target.value })); }}
              className={`w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 outline-none ${T}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Date fin</label>
            <input
              type="date"
              value={filter.dateEnd}
              onChange={(e) => { setDateRangePreset('custom'); setFilter(p => ({ ...p, dateEnd: e.target.value })); }}
              className={`w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 outline-none ${T}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Statut</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter(p => ({ ...p, status: e.target.value }))}
              className={`w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 outline-none bg-white ${T}`}
            >
              <option value="">Tous</option>
              <option value="validated">Validé</option>
              <option value="pending">En attente</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                setDateRangePreset('all');
                setFilter({ dateStart: '', dateEnd: '', status: '', productId: '' });
              }}
              className={`flex-1 h-10 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 ${T}`}
            >
              Réinitialiser
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className={`flex-1 h-10 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 ${T}`}
            >
              Appliquer
            </button>
          </div>
        </div>
      </Sheet>

      {/* ═══ AUTO REPORT SHEET ════════════════════════════════════════════ */}
      <Sheet
        open={autoModal}
        onClose={() => { setAutoModal(false); setAutoResult(null); }}
        title={
          autoStep === 'config' ? 'Rapport automatique' :
          autoStep === 'assign' ? 'Assigner les produits' :
          'Rapport généré'
        }
        size="md"
      >
        {autoStep === 'config' && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">Génère un rapport depuis les commandes livrées.</p>

            <div className="inline-flex p-1 bg-gray-100 rounded-full">
              <button onClick={() => setAutoMode('day')} className={`px-4 h-8 rounded-full text-sm font-medium ${T} ${autoMode === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Un jour</button>
              <button onClick={() => setAutoMode('range')} className={`px-4 h-8 rounded-full text-sm font-medium ${T} ${autoMode === 'range' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Période</button>
            </div>

            {autoMode === 'day' ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Date</label>
                <input type="date" value={autoDate} onChange={e => setAutoDate(e.target.value)} className={`w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 outline-none ${T}`} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Début</label>
                  <input type="date" value={autoStartDate} onChange={e => setAutoStartDate(e.target.value)} className={`w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 outline-none ${T}`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Fin</label>
                  <input type="date" value={autoEndDate} onChange={e => setAutoEndDate(e.target.value)} className={`w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 outline-none ${T}`} />
                </div>
              </div>
            )}

            {autoResult && !autoResult.success && (
              <div className="rounded-xl px-3 py-2.5 text-sm bg-red-50 border border-red-100 text-red-700">{autoResult.message}</div>
            )}

            <button
              onClick={() => generateAutoReports()}
              disabled={autoLoading || (autoMode === 'range' && (!autoStartDate || !autoEndDate))}
              className={`w-full h-11 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${T}`}
            >
              {autoLoading ? 'Analyse en cours...' : <>Générer <ArrowRight size={14} strokeWidth={2.5} /></>}
            </button>
          </div>
        )}

        {autoStep === 'assign' && (
          <div className="space-y-5">
            {autoResult?.message && (
              <p className="text-sm text-gray-500">{autoResult.message}</p>
            )}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {(autoResult?.data?.unmatched || []).map(item => (
                <div key={item.productName} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.totalDelivered} commande{item.totalDelivered > 1 ? 's' : ''} livrée{item.totalDelivered > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <select
                    value={autoMappings[item.productName] || ''}
                    onChange={e => setAutoMappings(p => ({ ...p, [item.productName]: e.target.value }))}
                    className={`w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:ring-0 outline-none bg-white ${T}`}
                  >
                    <option value="">— Ignorer —</option>
                    {autoProducts.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setAutoModal(false); setAutoResult(null); loadData(); }} className={`flex-1 h-10 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 ${T}`}>Fermer</button>
              <button
                onClick={() => generateAutoReports(autoMappings)}
                disabled={autoLoading}
                className={`flex-[2] h-10 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-40 ${T}`}
              >
                {autoLoading ? 'Génération...' : 'Confirmer'}
              </button>
            </div>
          </div>
        )}

        {autoStep === 'done' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} className="text-primary-500" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Rapport généré</p>
                <p className="text-xs text-gray-500 mt-0.5">{autoResult?.message}</p>
              </div>
            </div>
            {autoResult?.success && autoResult.data?.created?.length > 0 && (
              <div className="border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{autoResult.data.created.length} créé{autoResult.data.created.length > 1 ? 's' : ''}</p>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {autoResult.data.created.map((c, i) => (
                    <li key={i} className="text-sm text-gray-700 truncate">{c.productName}</li>
                  ))}
                </ul>
              </div>
            )}
            {autoResult?.success && autoResult.data?.updated?.length > 0 && (
              <div className="border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{autoResult.data.updated.length} mis à jour</p>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {autoResult.data.updated.map((c, i) => (
                    <li key={i} className="text-sm text-gray-700 truncate">{c.productName}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={() => { setAutoModal(false); setAutoResult(null); setAutoStep('config'); }}
              className={`w-full h-11 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 ${T}`}
            >
              Terminé
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
};

export default ReportsList;
