import React, { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { useStore } from '../contexts/StoreContext.jsx';

const ChartContent = React.memo(({ data, selectedMetric, fmt }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
        Aucune donnée disponible
      </div>
    );
  }
  const W = 800, H = 220, padL = 55, padR = 10, padT = 10, padB = 10;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...data.map(d => d[selectedMetric] || 0), 0.01);
  let yMax;
  if (selectedMetric === 'deliveryRate') { yMax = 1; }
  else if (maxVal <= 10) { yMax = Math.ceil(maxVal); }
  else if (maxVal <= 100) { yMax = Math.ceil(maxVal / 10) * 10; }
  else { yMax = Math.ceil(maxVal / 1000) * 1000; }
  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;
  const toX = (i) => padL + i * xStep;
  const toY = (val) => padT + chartH - (val / yMax) * chartH;
  const buildPath = () => data.map((d, i) => {
    const x = toX(i); const y = toY(Math.max(d[selectedMetric] || 0, 0));
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const buildArea = () => {
    const line = buildPath();
    return `${line} L${toX(data.length - 1).toFixed(1)},${toY(0).toFixed(1)} L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`;
  };
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];
  const formatShort = (v) => {
    if (selectedMetric === 'deliveryRate') return `${(v * 100).toFixed(0)}%`;
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return v.toFixed(0);
  };
  const labelInterval = Math.max(1, Math.floor(data.length / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F6B4F" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0F6B4F" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line x1={padL} y1={toY(tick)} x2={W - padR} y2={toY(tick)} stroke="#f3f4f6" strokeWidth="1" />
          <text x={padL - 6} y={toY(tick) + 4} textAnchor="end" fill="#9ca3af" fontSize="10">{formatShort(tick)}</text>
        </g>
      ))}
      <path d={buildArea()} fill="url(#areaGrad)" />
      <path d={buildPath()} fill="none" stroke="#0F6B4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        if (i % labelInterval !== 0 && i !== data.length - 1) return null;
        return (
          <text key={i} x={toX(i)} y={H} textAnchor="middle" fill="#9ca3af" fontSize="9">
            {new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </text>
        );
      })}
      {data.map((d, i) => {
        let tv;
        if (selectedMetric === 'deliveryRate') tv = `${(d[selectedMetric] * 100).toFixed(1)}%`;
        else if (selectedMetric === 'orders') tv = d[selectedMetric] || 0;
        else tv = fmt(d[selectedMetric] || 0);
        return (
          <circle key={i} cx={toX(i)} cy={toY(Math.max(d[selectedMetric] || 0, 0))} r="3" fill="#0F6B4F" stroke="#fff" strokeWidth="1.5">
            <title>{new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — {tv}</title>
          </circle>
        );
      })}
    </svg>
  );
});
ChartContent.displayName = 'ChartContent';

// Composant KPI Card mémorisé pour éviter re-renders inutiles
const KPICard = React.memo(({ card, isSelected, onClick, loadingKpi, isLastInRowMobile, isLastInRowDesktop, index }) => (
  <button
    onClick={onClick}
    className={`text-left px-4 py-3 sm:px-5 sm:py-4 transition-all relative ${
      isSelected ? 'bg-white' : 'bg-white hover:bg-gray-50'
    } ${!isLastInRowMobile ? 'border-r border-gray-200 md:border-r-0' : ''}
     ${!isLastInRowDesktop && index < 2 ? 'md:border-r md:border-gray-200' : ''}`}
  >
    {isSelected && (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-t"></div>
    )}
    <p className={`text-xs font-medium mb-0.5 sm:mb-1 ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
      {card.title}
    </p>
    <div className="flex items-baseline gap-1.5 sm:gap-2">
      {loadingKpi ? (
        <>
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
        </>
      ) : (
        <>
          <p className="text-lg sm:text-xl font-bold tabular-nums text-gray-900">{card.value}</p>
          <span className={`text-xs font-medium ${card.trendUp ? 'text-green-600' : 'text-red-500'}`}>
            {card.trend}
          </span>
        </>
      )}
    </div>
  </button>
));
KPICard.displayName = 'KPICard';

const DashboardSkeleton = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
      </div>
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mb-3" />
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-56 bg-gray-100 rounded-xl animate-pulse" />
      </div>
      {/* Bottom grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AdminDashboard = () => {
  const { user, workspace } = useEcomAuth();
  const { fmt } = useMoney();
  const { stores, loading: storesLoading } = useStore();
  const navigate = useNavigate();
  const [loadingKpi, setLoadingKpi] = useState(true);   // Phase 1 : KPIs
  const [loadingSecondary, setLoadingSecondary] = useState(true); // Phase 2 : reste
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); // Progression du chargement
  const loadingTimeoutRef = useRef(null);

  // NOTE: early return moved to main render to avoid Rules of Hooks violation
  const [stats, setStats] = useState({
    products: [],
    stockAlerts: [],
    financialStats: {},
    prevFinancialStats: {},
    dailyFinancial: [],
    decisions: [],
    orders: [],
    recentActivity: [],
    goals: []  // Sera rempli par l'API /goals
  });
  const [dashboardStats, setDashboardStats] = useState({
    conversionRate: '0',
    conversionTrend: '0',
    averageOrderValue: 0,
    avgOrderTrend: '0',
    activeClients: 0,
    activeClientsTrend: 0,
    returnRate: '0',
    returnRateTrend: '0',
    topProducts: []
  });
  const [timeRange, setTimeRange] = useState('today');
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  // CRITICAL: Create ref first, assign after function declaration
  const loadDashboardDataRef = useRef(null);

  // Animation de progression du chargement + timeout de sécurité anti-infinite-loading
  useEffect(() => {
    if (loadingKpi || loadingSecondary) {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 15;
        });
      }, 100);

      // Timeout de sécurité : forcer la fin du loading après 12s max
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = setTimeout(() => {
        setLoadingKpi(false);
        setLoadingSecondary(false);
        setLoadingProgress(100);
      }, 12000);

      return () => {
        clearInterval(interval);
        clearTimeout(loadingTimeoutRef.current);
      };
    } else {
      clearTimeout(loadingTimeoutRef.current);
      setLoadingProgress(100);
      const t = setTimeout(() => {
        setLoadingProgress(0);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [loadingKpi, loadingSecondary]);

  // Fonctions pour le calendrier
  const getCalendarDays = () => {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - (firstDay.getDay() + 6) % 7); // Ajuster pour commencer le lundi
    
    const days = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const isDateToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isDateSelected = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return dateStr === customStartDate || dateStr === customEndDate;
  };

  const isDateInRange = (date) => {
    if (!customStartDate || !customEndDate) return false;
    const dateStr = date.toISOString().split('T')[0];
    return dateStr >= customStartDate && dateStr <= customEndDate;
  };

  const isDateDisabled = (date) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  };

  const handleDateClick = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    if (!customStartDate || (customStartDate && customEndDate)) {
      // Commencer une nouvelle sélection
      setCustomStartDate(dateStr);
      setCustomEndDate('');
      setIsSelectingEnd(true);
    } else if (customStartDate && !customEndDate) {
      // Sélectionner la date de fin → appliquer immédiatement
      let start = customStartDate;
      let end = dateStr;
      if (dateStr < customStartDate) {
        start = dateStr;
        end = customStartDate;
      }
      setCustomStartDate(start);
      setCustomEndDate(end);
      setIsSelectingEnd(false);
      setTimeRange('custom');
      setShowDatePicker(false);
    }
  };

  const buildDateRange = (daysCount, customStart = null, customEnd = null) => {
    let startDate, endDate;
    
    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(endDate.getDate() - daysCount + 1);
    }
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    let prevStartDate, prevEndDate;
    if (daysCount === 1) {
      prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevStartDate = new Date(prevEndDate);
      prevStartDate.setHours(0, 0, 0, 0);
    } else {
      prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - daysCount + 1);
      prevStartDate.setHours(0, 0, 0, 0);
    }
    return {
      startStr, endStr,
      prevStartStr: prevStartDate.toISOString().split('T')[0],
      prevEndStr: prevEndDate.toISOString().split('T')[0]
    };
  };

  const loadDashboardData = async () => {
    // Track admin dashboard access
    import('../../utils/analytics.js').then(m => {
      const analytics = m.default;
      analytics.trackPageView('/ecom/dashboard/admin', {
        page_name: 'Admin Dashboard',
        category: 'admin',
        user_id: user?.id
      });
    }).catch(() => {});

    // NE JAMAIS afficher le loader pour les KPI après le premier chargement
    // Utiliser isRefreshing pour indiquer un refresh silencieux en arrière-plan
    const isFirstLoad = !stats.financialStats || Object.keys(stats.financialStats).length === 0;

    if (isFirstLoad) {
      setLoadingKpi(true);
      setLoadingSecondary(true);
      setLoadingProgress(5);
    } else {
      // Refresh silencieux : pas de loader, juste l'indicateur isRefreshing
      setIsRefreshing(true);
    }

    let daysCount;
    let isCustomRange = timeRange === 'custom' && customStartDate && customEndDate;

    if (isCustomRange) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      daysCount =
        timeRange === 'today' ? 1 :
        timeRange === '7d' ? 7 :
        timeRange === '30d' ? 30 :
        timeRange === '90d' ? 90 :
        timeRange === '365d' ? 365 :
        parseInt(timeRange) || 14;
    }

    const { startStr, endStr, prevStartStr, prevEndStr } = buildDateRange(
      daysCount,
      isCustomRange ? customStartDate : null,
      isCustomRange ? customEndDate : null
    );

    // ── PHASE 1 : KPIs financiers + graphique (priorité max) ──────────────────
    try {
      const [financialRes, prevFinancialRes, dailyRes] = await Promise.all([
        ecomApi.get(`/reports/stats/financial?startDate=${startStr}&endDate=${endStr}`),
        ecomApi.get(`/reports/stats/financial?startDate=${prevStartStr}&endDate=${prevEndStr}`),
        ecomApi.get(`/reports/stats/financial/daily?days=${daysCount}`).catch(() => ({ data: { data: [] } }))
      ]);
      const financialData = financialRes.data?.data || {};
      const prevFinancialData = prevFinancialRes.data?.data || {};
      const dailyFinancial = (dailyRes.data?.data || []).map(d => ({
        ...d,
        orders: d.ordersDelivered || 0,
        deliveryRate: d.ordersReceived > 0 ? d.ordersDelivered / d.ordersReceived : 0
      }));

      // Track successful data load
      if (isFirstLoad) {
        import('../../utils/analytics.js').then(m => {
          const analytics = m.default;
          analytics.trackAdminAction('dashboard_data_loaded', {
            time_range: timeRange,
            revenue: financialData.totalRevenue || 0,
            orders: financialData.ordersDelivered || 0
          });
        }).catch(() => {});
      }

      setStats(prev => ({ ...prev, financialStats: financialData, prevFinancialStats: prevFinancialData, dailyFinancial }));
    } catch (e) {
      console.error('KPI load error', e);
      // Track error
      import('../../utils/analytics.js').then(m => {
        const analytics = m.default;
        analytics.trackError(e, {
          context: 'admin_dashboard_kpi_load',
          time_range: timeRange
        });
      }).catch(() => {});
    } finally {
      if (isFirstLoad) {
        setLoadingKpi(false); // page visible immédiatement après KPIs + graphique
        setLoadingProgress(70);
      }
    }

    // ── PHASE 2 : reste en arrière-plan ───────────────────────────
    try {
      const [topProductsRes, stockLocationsRes, decisionsRes, dashStatsRes, goalsRes] = await Promise.all([
        ecomApi.get(`/reports/stats/products-ranking?startDate=${startStr}&endDate=${endStr}`).catch(() => ({ data: { data: [] } })),
        ecomApi.get('/stock-locations').catch(() => ({ data: { data: [] } })),
        ecomApi.get('/decisions/dashboard/overview').catch(() => ({ data: { data: {} } })),
        ecomApi.get(`/reports/dashboard/stats?period=${daysCount}&startDate=${startStr}&endDate=${endStr}`).catch(() => ({ data: { data: {} } })),
        ecomApi.get('/goals', { params: { periodType: 'monthly', year: new Date().getFullYear(), month: new Date().getMonth() + 1 } }).catch(() => ({ data: { data: [] } }))
      ]);

      const topProducts = (topProductsRes.data?.data || [])
        .sort((a, b) => (b.ordersDelivered || 0) - (a.ordersDelivered || 0))
        .slice(0, 5);

      const stockEntries = stockLocationsRes.data?.data || [];
      const LOW_THRESHOLD = 5;
      const lowStockProducts = stockEntries
        .map(entry => ({
          name: entry.productName || entry.name || 'Produit inconnu',
          stock: Math.max(0, (entry.quantity || 0) - (entry.sales || 0)),
          reorderThreshold: entry.reorderThreshold || LOW_THRESHOLD,
          urgency: Math.max(0, (entry.quantity || 0) - (entry.sales || 0)) === 0 ? 'critical'
            : Math.max(0, (entry.quantity || 0) - (entry.sales || 0)) <= 2 ? 'high' : 'medium',
          _id: entry._id,
          productId: entry.productId
        }))
        .filter(e => e.stock <= e.reorderThreshold)
        .sort((a, b) => a.stock - b.stock);

      const stockAlerts = { lowStockProducts, summary: { lowStockCount: lowStockProducts.length } };

      const goalsResponse = goalsRes.data?.data || {};
      const allGoals = goalsResponse.goals || [];

      // Agréger tous les objectifs par type pour créer 3 objectifs globaux
      const aggregateGoalsByType = (goals, type) => {
        const filtered = goals.filter(g => g.type === type);
        if (filtered.length === 0) return null;
        return {
          _id: `global_${type}`,
          type: type,
          targetValue: filtered.reduce((sum, g) => sum + (g.targetValue || 0), 0),
          currentValue: filtered.reduce((sum, g) => sum + (g.currentValue || 0), 0),
          periodType: 'monthly'
        };
      };
      
      const goalsData = [
        aggregateGoalsByType(allGoals, 'revenue'),
        aggregateGoalsByType(allGoals, 'ordersDelivered'),
        aggregateGoalsByType(allGoals, 'profit')
      ].filter(g => g !== null);
      
      console.log('🎯 Goals API Response:', goalsRes.data);
      console.log('🎯 Aggregated Global Goals:', goalsData);

      const dashStats = dashStatsRes.data?.data || {};
      const newDashStats = {
        conversionRate: dashStats.conversionRate || '0',
        conversionTrend: dashStats.conversionTrend || '0',
        averageOrderValue: dashStats.averageOrderValue || 0,
        avgOrderTrend: dashStats.avgOrderTrend || '0',
        activeClients: dashStats.activeClients || 0,
        activeClientsTrend: dashStats.activeClientsTrend || 0,
        returnRate: dashStats.returnRate || '0',
        returnRateTrend: dashStats.returnRateTrend || '0',
        topProducts: dashStats.topProducts || []
      };
      setDashboardStats(newDashStats);

      setStats(prev => {
        const newStats = {
          ...prev,
          products: topProducts,
          stockAlerts,
          decisions: decisionsRes.data?.data || {},
          goals: goalsData
        };
        console.log('📊 Updated stats.goals:', newStats.goals);
        return newStats;
      });

    } catch (error) {
      console.error('Erreur chargement secondaire:', error);
    } finally {
      if (isFirstLoad) {
        setLoadingSecondary(false);
        setLoadingProgress(90);
      }
      setIsRefreshing(false);
    }
  };

  // Assign function to ref after declaration to avoid TDZ
  loadDashboardDataRef.current = loadDashboardData;

  useEffect(() => {
    loadDashboardDataRef.current();
  }, [timeRange, customStartDate, customEndDate]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

  const getStatusColor = (status) => {
    const colors = {
      test: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      stable: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      winner: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      pause: 'bg-orange-100 text-orange-700 border-orange-200',
      stop: 'bg-red-100 text-red-700 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getOrderStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-emerald-600',
      shipped: 'bg-emerald-600',
      delivered: 'bg-emerald-500',
      cancelled: 'bg-red-500',
      returned: 'bg-orange-500',
      reported: 'bg-purple-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const calculateProductMargin = (product) => {
    const sellingPrice = product.sellingPrice || 0;
    const totalCost = (product.productCost || 0) + (product.deliveryCost || 0) + (product.avgAdsCost || 0);
    return sellingPrice - totalCost;
  };

  // KPI calculés uniquement depuis les rapports financiers
  const periodStats = React.useMemo(() => {
    const curr = stats.financialStats || {};
    const prev = stats.prevFinancialStats || {};

    const totalRevenue = curr.totalRevenue || 0;
    const totalProfit = curr.totalProfit || 0;
    const totalOrders = curr.totalOrdersDelivered || 0;
    const deliveryRate = curr.deliveryRate || 0;

    const prevRevenue = prev.totalRevenue || 0;
    const prevProfit = prev.totalProfit || 0;
    const prevOrders = prev.totalOrdersDelivered || 0;
    const prevDeliveryRate = prev.deliveryRate || 0;

    const calcPctChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / Math.abs(previous)) * 100;
    };

    return {
      totalRevenue,
      totalProfit,
      totalOrders,
      deliveryRate,
      revenueTrend: calcPctChange(totalRevenue, prevRevenue),
      profitTrend: calcPctChange(totalProfit, prevProfit),
      ordersTrend: totalOrders - prevOrders,
      deliveryRateTrend: deliveryRate - prevDeliveryRate
    };
  }, [stats.financialStats, stats.prevFinancialStats, timeRange]);

  // Formater le trend pour l'affichage
  const formatTrend = (value, isPercent = true) => {
    const sign = value >= 0 ? '+' : '';
    if (isPercent) return `${sign}${value.toFixed(1)}%`;
    return `${sign}${Math.round(value)}`;
  };

  // Mémoriser kpiCards pour éviter re-création à chaque render
  const kpiCards = React.useMemo(() => [
    {
      id: 'revenue',
      title: 'Chiffre d\'affaires',
      value: fmt(periodStats.totalRevenue),
      trend: formatTrend(periodStats.revenueTrend),
      trendUp: periodStats.revenueTrend >= 0,
      color: 'blue'
    },
    {
      id: 'profit',
      title: 'Bénéfice net',
      value: fmt(periodStats.totalProfit),
      trend: formatTrend(periodStats.profitTrend),
      trendUp: periodStats.profitTrend >= 0,
      color: 'emerald'
    },
    {
      id: 'deliveryRate',
      title: 'Taux de livraison',
      value: `${periodStats.deliveryRate.toFixed(1)}%`,
      trend: formatTrend(periodStats.deliveryRateTrend, true),
      trendUp: periodStats.deliveryRateTrend >= 0,
      color: 'orange'
    },
    {
      id: 'orders',
      title: 'Commandes livrées',
      value: periodStats.totalOrders,
      trend: formatTrend(periodStats.ordersTrend, false),
      trendUp: periodStats.ordersTrend >= 0,
      color: 'violet'
    }
  ], [periodStats, fmt]);

  const quickActions = [
    {
      name: 'Nouveau produit',
      description: 'Ajouter un article à votre boutique',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      link: '/ecom/products/new'
    },
    {
      name: 'Nouvelle commande',
      description: 'Créer une commande manuelle',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-700',
      link: '/ecom/orders'
    },
    {
      name: 'Ajouter stock',
      description: 'Mettre à jour l\'inventaire',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      link: '/ecom/stock/orders'
    }
  ];

  // Attendre le chargement de l'état boutique avant d'afficher le dashboard.
  if (storesLoading) {
    return <DashboardSkeleton />;
  }

  if (workspace?._id && stores.length === 0) {
    return <Navigate to="/ecom/boutique/wizard" replace state={{ from: '/ecom/dashboard/admin' }} />;
  }

  // Si pas de workspace — afficher CTA (ici pour respecter les Rules of Hooks)
  if (!user?.workspaceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun espace configuré</h2>
          <p className="text-gray-600 mb-6">
            {user?.role === 'ecom_admin'
              ? 'Créez votre propre espace pour commencer à utiliser Scalor.'
              : 'Rejoignez une équipe existante pour accéder aux données partagées.'}
          </p>
          <div className="space-y-3">
            <Link to="/ecom/workspace-setup" className="block w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition">
              Créer un espace
            </Link>
            {user?.role !== 'ecom_admin' && (
              <div className="p-3 bg-gray-100 rounded-lg text-xs text-gray-600">
                Pour rejoindre une équipe, demandez un lien d'invitation à votre administrateur
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">

      {/* Barre de progression subtile en haut */}
      {(loadingKpi || loadingSecondary) && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-40">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${Math.min(loadingProgress, 100)}%` }}
          />
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

        {/* Message de bienvenue */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">
            Bonjour, {user?.name?.split(' ')[0] || 'Admin'} ! 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Voici un aperçu de votre activité aujourd'hui.
          </p>
        </div>

        {/* Période selector - Style Shopify */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            <svg className="w-3.5 h-3.5 text-gray-500 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {[
              { id: 'today', label: 'Aujourd\'hui' },
              { id: '7d', label: '7 derniers jours' },
              { id: '30d', label: '30 derniers jours' },
              { id: '90d', label: '90 derniers jours' },
              { id: '365d', label: '365 derniers jours' },
            ].map(period => (
              <button
                key={period.id}
                onClick={() => { setTimeRange(period.id); setCustomStartDate(''); setCustomEndDate(''); setShowDatePicker(false); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  timeRange === period.id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {isRefreshing && timeRange === period.id
                  ? <span className="inline-block w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1 align-middle"></span>
                  : null}
                {period.label}
              </button>
            ))}
            <button
              onClick={() => {
                setShowDatePicker(true);
                setCurrentCalendarMonth(new Date());
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 ${
                timeRange === 'custom'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {timeRange === 'custom' && customStartDate && customEndDate
                ? `${new Date(customStartDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${new Date(customEndDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                : 'Personnaliser'}
            </button>
          </div>
        </div>

        {/* Modal de sélection de dates avec calendrier */}
        {showDatePicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDatePicker(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Sélectionner une période</h3>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Raccourcis rapides */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { id: 'today', label: "Aujourd'hui" },
                  { id: '7d', label: '7 jours' },
                  { id: '30d', label: '30 jours' },
                  { id: '90d', label: '90 jours' },
                  { id: '365d', label: '1 an' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setTimeRange(p.id); setCustomStartDate(''); setCustomEndDate(''); setShowDatePicker(false); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      timeRange === p.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Calendrier personnalisé */}
              <div className="mb-6">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => {
                        const newDate = new Date(currentCalendarMonth);
                        newDate.setMonth(newDate.getMonth() - 1);
                        setCurrentCalendarMonth(newDate);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h4 className="text-sm font-semibold text-gray-900">
                      {currentCalendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </h4>
                    <button
                      onClick={() => {
                        const newDate = new Date(currentCalendarMonth);
                        newDate.setMonth(newDate.getMonth() + 1);
                        setCurrentCalendarMonth(newDate);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
                    <div key={i} className="text-xs font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {getCalendarDays().map((date, index) => {
                    const isToday = isDateToday(date);
                    const isSelected = isDateSelected(date);
                    const isInRange = isDateInRange(date);
                    const isDisabled = isDateDisabled(date);
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleDateClick(date)}
                        disabled={isDisabled}
                        className={`
                          h-10 text-sm rounded-lg transition-all
                          ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100'}
                          ${isToday ? 'font-bold' : ''}
                          ${isSelected ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
                          ${isInRange && !isSelected ? 'bg-emerald-100 text-emerald-800' : ''}
                          ${!isDisabled && !isSelected && !isInRange ? 'text-gray-700' : ''}
                        `}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Résumé de la sélection */}
              {customStartDate && !customEndDate && (
                <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-sm text-emerald-800">
                    Sélectionnez la date de fin
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setShowDatePicker(false);
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bloc Shopify : KPI + Courbe dans un seul bloc blanc */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6">

          {/* KPI Row - style Shopify */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x-0 md:divide-x divide-gray-200 border-b border-gray-200">
            {kpiCards.map((card, i) => {
              const isSelected = selectedMetric === card.id;
              const isLastInRowMobile = (i + 1) % 2 === 0;
              const isLastInRowDesktop = (i + 1) % 4 === 0;
              return (
                <KPICard
                  key={card.id}
                  card={card}
                  isSelected={isSelected}
                  onClick={() => setSelectedMetric(card.id)}
                  loadingKpi={loadingKpi}
                  isLastInRowMobile={isLastInRowMobile}
                  isLastInRowDesktop={isLastInRowDesktop}
                  index={i}
                />
              );
            })}
          </div>

          {/* Séparateur */}
          <div className="border-t border-gray-200"></div>

          {/* Courbe - pleine largeur */}
          <div className="p-4">
            {loadingKpi ? (
              <div className="h-56 bg-gray-100 rounded-xl animate-pulse" />
            ) : <ChartContent data={stats.dailyFinancial || []} selectedMetric={selectedMetric} fmt={fmt} />}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickActions.map((action, i) => (
              <Link
                key={i}
                to={action.link}
                className="group bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className={`${action.iconBg} ${action.iconColor} w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0`}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{action.name}</h3>
                    <p className="text-xs text-gray-500">{action.description}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Products & Stock Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">� Top produits</h3>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Par nombre de ventes livrées</p>
              </div>
              <Link to="/ecom/stats/rapports" className="text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap flex-shrink-0">
                Voir tout →
              </Link>
            </div>
            <div className="space-y-2 sm:space-y-3">
              {loadingSecondary ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-200 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-32 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                    </div>
                  </div>
                ))
              ) : stats.products.slice(0, 5).map((product, i) => {
                const deliveryRate = product.ordersReceived > 0
                  ? ((product.ordersDelivered / product.ordersReceived) * 100).toFixed(0)
                  : 0;
                return (
                  <div key={product._id || i} className="flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-3 rounded-xl hover:bg-gray-50 transition">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="font-medium text-sm text-gray-900 truncate">{product.productName || 'Produit inconnu'}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] sm:text-xs text-gray-500">
                        <span className="text-emerald-600 font-medium">{product.ordersDelivered || 0} livrées</span>
                        <span>•</span>
                        <span>{deliveryRate}% livraison</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs sm:text-sm font-bold text-gray-900 whitespace-nowrap">{fmt(product.revenue || 0)}</p>
                      <p className={`text-[10px] sm:text-xs font-medium ${(product.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {(product.profit || 0) >= 0 ? '+' : ''}{fmt(product.profit || 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {!loadingSecondary && stats.products.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-3">Aucune donnée de vente disponible</p>
                  <Link to="/ecom/reports/new" className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">
                    + Créer un rapport
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Stock Alerts */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Alertes stock</h3>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Produits nécessitant réapprovisionnement</p>
              </div>
              {stats.stockAlerts.summary?.lowStockCount > 0 && (
                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap flex-shrink-0">
                  {stats.stockAlerts.summary.lowStockCount} alertes
                </span>
              )}
            </div>

            {loadingSecondary ? (
              <div className="space-y-2.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                    </div>
                    <div className="h-8 w-28 bg-gray-100 rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>
            ) : stats.stockAlerts.lowStockProducts?.length > 0 ? (
              <div className="space-y-2.5 sm:space-y-3">
                {stats.stockAlerts.lowStockProducts.slice(0, 5).map((alert, i) => (
                  <div key={i} className={`flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-4 p-3 sm:p-4 rounded-xl border ${alert.urgency === 'critical' ? 'bg-red-50 border-red-200' :
                      alert.urgency === 'high' ? 'bg-orange-50 border-orange-200' :
                        'bg-yellow-50 border-yellow-200'
                    }`}>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${alert.urgency === 'critical' ? 'bg-red-500 text-white' :
                        alert.urgency === 'high' ? 'bg-orange-500 text-white' :
                          'bg-yellow-500 text-white'
                      }`}>
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{alert.name}</p>
                      <p className="text-xs text-gray-500">
                        Stock: <span className="font-bold text-red-600">{alert.stock}</span> / Seuil: {alert.reorderThreshold}
                      </p>
                    </div>
                    <Link
                      to="/ecom/stock/orders/new"
                      className="w-full sm:w-auto text-center px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex-shrink-0"
                    >
                      Réapprovisionner
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm sm:text-base text-gray-500 font-medium">Tous les stocks sont au vert !</p>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">Aucun réapprovisionnement nécessaire</p>
              </div>
            )}

            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
              <Link to="/ecom/stock" className="flex items-center justify-center gap-2 text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 font-medium py-2 rounded-lg hover:bg-emerald-50 transition">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Voir le rapport de stock
              </Link>
            </div>
          </div>
        </div>

        {/* Objectifs */}
        <div className="mt-8 bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">🎯 Objectifs du mois</h3>
            <Link to="/ecom/goals" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              Gérer →
            </Link>
          </div>
          {loadingSecondary ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex justify-between mb-3">
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-32 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          ) : stats.goals.length > 0 ? (
            <div className="space-y-4">
              {stats.goals.map((goal, idx) => {
                const goalTypeLabels = {
                  revenue: 'Chiffre d\'affaires',
                  profit: 'Bénéfice global',
                  ordersDelivered: 'Nombre de livraisons',
                  orders: 'Commandes',
                  delivery_rate: 'Taux de livraison'
                };
                const current = goal.currentValue || 0;
                const target = goal.targetValue || 1;
                const progress = (current / target) * 100;
                
                return (
                  <div key={goal._id || idx} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{goalTypeLabels[goal.type] || goal.type}</p>
                        {goal.productId?.name && (
                          <p className="text-xs text-gray-500 mt-0.5">Produit: {goal.productId.name}</p>
                        )}
                        {goal.closeuseId?.name && (
                          <p className="text-xs text-gray-500 mt-0.5">Closeuse: {goal.closeuseId.name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {goal.type === 'delivery_rate' ? `${current.toFixed(1)}%` : 
                           goal.type === 'ordersDelivered' ? current : fmt(current)}
                        </p>
                        <p className="text-xs text-gray-500">
                          sur {goal.type === 'delivery_rate' ? `${target}%` : 
                               goal.type === 'ordersDelivered' ? target : fmt(target)}
                        </p>
                      </div>
                    </div>
                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                          progress >= 100 ? 'bg-emerald-500' :
                          progress >= 75 ? 'bg-emerald-600' :
                          progress >= 50 ? 'bg-yellow-500' :
                          'bg-orange-500'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className={`text-xs font-semibold ${
                        progress >= 100 ? 'text-emerald-600' :
                        progress >= 75 ? 'text-emerald-600' :
                        progress >= 50 ? 'text-yellow-600' :
                        'text-orange-600'
                      }`}>
                        {progress.toFixed(1)}% atteint
                      </p>
                      {progress >= 100 && (
                        <span className="text-xs text-emerald-600 font-semibold">✓ Objectif atteint</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 mb-3">Aucun objectif défini pour ce mois</p>
              <Link to="/ecom/goals" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                + Créer un objectif
              </Link>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Taux de conversion', value: `${dashboardStats.conversionRate}%`, trend: `${parseFloat(dashboardStats.conversionTrend) >= 0 ? '+' : ''}${dashboardStats.conversionTrend}%` },
            { label: 'Panier moyen', value: fmt(dashboardStats.averageOrderValue), trend: `${parseFloat(dashboardStats.avgOrderTrend) >= 0 ? '+' : ''}${dashboardStats.avgOrderTrend}%` },
            { label: 'Clients actifs', value: dashboardStats.activeClients.toString(), trend: `${dashboardStats.activeClientsTrend >= 0 ? '+' : ''}${dashboardStats.activeClientsTrend}` },
            { label: 'Retours', value: `${dashboardStats.returnRate}%`, trend: `${parseFloat(dashboardStats.returnRateTrend) >= 0 ? '+' : ''}${dashboardStats.returnRateTrend}%` },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <div className="flex items-end gap-2">
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                <span className="text-xs text-emerald-600 font-medium mb-0.5">{stat.trend}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
