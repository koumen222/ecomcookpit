import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

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
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [loadingKpi, setLoadingKpi] = useState(true);   // Phase 1 : KPIs
  const [loadingSecondary, setLoadingSecondary] = useState(true); // Phase 2 : reste
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); // Progression du chargement
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);

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

  // Animation de progression du chargement
  useEffect(() => {
    if (loadingKpi || loadingSecondary) {
      setShowLoadingScreen(true);
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 15;
        });
      }, 100);
      return () => clearInterval(interval);
    } else {
      setLoadingProgress(100);
      const t = setTimeout(() => {
        setLoadingProgress(0);
        setShowLoadingScreen(false);
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
      // Sélectionner la date de fin
      if (dateStr >= customStartDate) {
        setCustomEndDate(dateStr);
        setIsSelectingEnd(false);
      } else {
        // Si la date est avant la date de début, inverser
        setCustomEndDate(customStartDate);
        setCustomStartDate(dateStr);
        setIsSelectingEnd(false);
      }
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
      setShowLoadingScreen(true);
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

    const { startStr, endStr, prevStartStr } = buildDateRange(
      daysCount,
      isCustomRange ? customStartDate : null,
      isCustomRange ? customEndDate : null
    );

    // ── PHASE 1 : KPIs financiers + graphique (priorité max) ──────────────────
    try {
      const [financialRes, prevFinancialRes, dailyRes] = await Promise.all([
        ecomApi.get(`/reports/stats/financial?startDate=${startStr}&endDate=${endStr}`),
        ecomApi.get(`/reports/stats/financial?startDate=${prevStartStr}&endDate=${endStr}`),
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
      const [topProductsRes, stockAlertsRes, decisionsRes, dashStatsRes, goalsRes] = await Promise.all([
        ecomApi.get(`/reports/stats/products-ranking?startDate=${startStr}&endDate=${endStr}`).catch(() => ({ data: { data: [] } })),
        ecomApi.get('/stock/alerts').catch(() => ({ data: { data: { lowStockProducts: [], summary: { lowStockCount: 0 } } } })),
        ecomApi.get('/decisions/dashboard/overview').catch(() => ({ data: { data: {} } })),
        ecomApi.get(`/reports/dashboard/stats?period=${daysCount}`).catch(() => ({ data: { data: {} } })),
        ecomApi.get('/goals', { params: { periodType: 'monthly', year: new Date().getFullYear(), month: new Date().getMonth() + 1 } }).catch(() => ({ data: { data: [] } }))
      ]);

      const topProducts = (topProductsRes.data?.data || [])
        .sort((a, b) => (b.ordersDelivered || 0) - (a.ordersDelivered || 0))
        .slice(0, 5);

      const alertsData = stockAlertsRes.data?.data || {};
      const lowStockProducts = (alertsData.lowStockProducts || []).map(p => ({
        name: p.name || 'Produit sans nom',
        stock: p.actualStock ?? p.stock ?? 0,
        reorderThreshold: p.reorderThreshold || 5,
        urgency: p.urgency || (p.stock === 0 ? 'critical' : 'medium'),
        _id: p._id,
        productId: p._id
      }));

      const stockAlerts = {
        lowStockProducts,
        summary: alertsData.summary || { lowStockCount: lowStockProducts.length }
      };

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

  // Plus de skeleton pleine page — affichage immédiat de la structure

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

      {/* Écran de chargement minimaliste */}
      {showLoadingScreen && (
        <div className="fixed inset-0 bg-white z-40 flex items-center justify-center">
          <div className="relative">
            {/* Icône avec effet de remplissage */}
            <div className="relative w-20 h-20">
              {/* Icône en arrière-plan (grisée) */}
              <img 
                src="/icon.png" 
                alt="Loading" 
                className="w-20 h-20 object-contain opacity-20"
              />
              {/* Icône qui se remplit progressivement */}
              <div 
                className="absolute inset-0 overflow-hidden transition-all duration-300 ease-out"
                style={{ clipPath: `inset(${100 - Math.min(loadingProgress, 100)}% 0 0 0)` }}
              >
                <img 
                  src="/icon.png" 
                  alt="Loading" 
                  className="w-20 h-20 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

        {/* Message de bienvenue */}
        <div className="mb-4 flex justify-between items-end">
          <div>
            <p className="text-sm text-emerald-700 font-semibold">{getGreeting()}, {user?.name?.split(' ')[0] || 'Admin'} !</p>
            <h1 className="text-2xl font-bold text-gray-900">Vue d'ensemble</h1>
          </div>
          <div className="md:hidden bg-white px-3 py-1.5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-1.5 cursor-pointer" onClick={() => setShowDatePicker(true)}>
            <span className="text-sm font-semibold text-emerald-700">
              {timeRange === 'today' ? "Aujourd'hui" : timeRange === '7d' ? '7 jours' : timeRange === '30d' ? '30 jours' : timeRange === 'custom' && customStartDate ? `${new Date(customStartDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : '30 jours'}
            </span>
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
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
                onClick={() => { setTimeRange(period.id); setCustomStartDate(''); setCustomEndDate(''); }}
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
              {(customStartDate || customEndDate) && (
                <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-sm text-emerald-800">
                    {customStartDate && customEndDate
                      ? `Du ${new Date(customStartDate).toLocaleDateString('fr-FR')} au ${new Date(customEndDate).toLocaleDateString('fr-FR')}`
                      : customStartDate
                      ? `À partir du ${new Date(customStartDate).toLocaleDateString('fr-FR')}`
                      : ''}
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
                  Annuler
                </button>
                <button
                  onClick={() => {
                    if (customStartDate && customEndDate) {
                      setTimeRange('custom');
                      setShowDatePicker(false);
                    }
                  }}
                  disabled={!customStartDate || !customEndDate}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MOBILE ONLY : Bento KPI Grid ══ */}
        <div className="md:hidden mb-5 space-y-3">
          {/* Revenue — full width */}
          <div
            onClick={() => setSelectedMetric('revenue')}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="absolute top-0 right-0 p-4 opacity-[0.07]">
              <svg className="w-20 h-20 text-emerald-800" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
              </svg>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chiffre d'affaires</p>
            {loadingKpi ? (
              <div className="mt-2 h-8 w-40 bg-gray-200 rounded-lg animate-pulse" />
            ) : (
              <div className="mt-1 flex items-baseline gap-2">
                <h2 className="text-3xl font-bold text-emerald-700">{fmt(periodStats.totalRevenue)}</h2>
              </div>
            )}
            <div className={`mt-3 flex items-center gap-1.5 ${periodStats.revenueTrend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {periodStats.revenueTrend >= 0 ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
              )}
              <span className="text-xs font-bold">{formatTrend(periodStats.revenueTrend)} vs période préc.</span>
            </div>
          </div>

          {/* Net Profit + Delivery Rate — 2 cols */}
          <div className="grid grid-cols-2 gap-3">
            <div onClick={() => setSelectedMetric('profit')} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform cursor-pointer">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bénéfice Net</p>
              {loadingKpi ? (
                <div className="mt-2 h-6 w-24 bg-gray-200 rounded animate-pulse" />
              ) : (
                <div className="mt-2">
                  <h3 className={`text-lg font-bold ${periodStats.totalProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(periodStats.totalProfit)}</h3>
                  <p className={`text-[10px] font-semibold mt-0.5 ${periodStats.profitTrend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatTrend(periodStats.profitTrend)}</p>
                </div>
              )}
            </div>
            <div onClick={() => setSelectedMetric('deliveryRate')} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform cursor-pointer">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Taux Livraison</p>
              {loadingKpi ? (
                <div className="mt-2 h-6 w-20 bg-gray-200 rounded animate-pulse" />
              ) : (
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-bold ${periodStats.deliveryRate >= 75 ? 'text-gray-900' : periodStats.deliveryRate >= 50 ? 'text-orange-600' : 'text-red-600'}`}>{periodStats.deliveryRate.toFixed(1)}%</h3>
                    <p className={`text-[10px] font-semibold mt-0.5 ${periodStats.deliveryRateTrend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatTrend(periodStats.deliveryRateTrend)}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-200 flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full ${periodStats.deliveryRate >= 75 ? 'bg-emerald-500' : periodStats.deliveryRate >= 50 ? 'bg-orange-400' : 'bg-red-400'}`}></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Total Orders — full width dark */}
          <div onClick={() => setSelectedMetric('orders')} className="bg-emerald-800 rounded-2xl p-5 flex justify-between items-center active:scale-[0.98] transition-transform cursor-pointer">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Commandes Livrées</p>
              {loadingKpi ? (
                <div className="mt-1 h-10 w-20 bg-emerald-700 rounded animate-pulse" />
              ) : (
                <h3 className="text-4xl font-extrabold mt-1 text-white">{periodStats.totalOrders}</h3>
              )}
              <p className={`text-xs font-bold mt-1 ${periodStats.ordersTrend >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {periodStats.ordersTrend >= 0 ? '+' : ''}{periodStats.ordersTrend} vs période préc.
              </p>
            </div>
            <div className="bg-emerald-700/50 p-3 rounded-full">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>

          {/* Mini chart on mobile (collapsible) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">
              Évolution — {kpiCards.find(k => k.id === selectedMetric)?.title}
            </p>
            {loadingKpi ? (
              <div className="h-36 bg-gray-100 rounded-xl animate-pulse" />
            ) : <ChartContent data={stats.dailyFinancial || []} selectedMetric={selectedMetric} fmt={fmt} />}
          </div>
        </div>

        {/* Desktop: 4-col KPI cards + performance chart */}
        <div className="hidden md:block mb-6 space-y-6">
          <div className="grid grid-cols-4 gap-6">
            {kpiCards.map((card) => {
              const cardConfig = {
                revenue:      { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-700', trendBg: 'bg-emerald-50', trendColor: 'text-emerald-700', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                profit:       { iconBg: 'bg-blue-50',    iconColor: 'text-blue-700',    trendBg: 'bg-blue-50',    trendColor: 'text-blue-700',    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
                deliveryRate: { iconBg: 'bg-orange-50',  iconColor: 'text-orange-600',  trendBg: 'bg-orange-50',  trendColor: 'text-orange-600',  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8H3a2 2 0 00-2 2v8a2 2 0 002 2h2m14 0h2a2 2 0 002-2v-8a2 2 0 00-2-2h-2M5 8V5a2 2 0 012-2h10a2 2 0 012 2v3M5 8h14" /></svg> },
                orders:       { iconBg: 'bg-purple-50',  iconColor: 'text-purple-700',  trendBg: 'bg-purple-50',  trendColor: 'text-purple-700',  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
              };
              const s = cardConfig[card.id] || cardConfig.revenue;
              const isSelected = selectedMetric === card.id;
              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedMetric(card.id)}
                  className={`bg-white p-6 rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-1 border ${
                    isSelected ? 'border-emerald-400 shadow-md' : 'border-gray-100 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg ${s.iconBg} ${s.iconColor}`}>{s.icon}</div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      card.trendUp ? `${s.trendBg} ${s.trendColor}` : 'bg-red-50 text-red-600'
                    }`}>
                      {card.trend}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{card.title}</p>
                  {loadingKpi ? (
                    <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Performance Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Performance des revenus</h3>
                <p className="text-slate-400 text-sm mt-0.5">Évolution — {kpiCards.find(k => k.id === selectedMetric)?.title}</p>
              </div>
            </div>
            {loadingKpi ? (
              <div className="h-56 bg-gray-100 rounded-xl animate-pulse" />
            ) : <ChartContent data={stats.dailyFinancial || []} selectedMetric={selectedMetric} fmt={fmt} />}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          {/* Mobile: horizontal scroll style */}
          <div className="md:hidden">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-0.5">Actions Rapides</h2>
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {quickActions.map((action, i) => (
                <Link
                  key={i}
                  to={action.link}
                  className="flex-shrink-0 bg-white px-5 py-4 rounded-2xl flex flex-col items-center gap-2 shadow-sm border border-gray-100 active:scale-95 transition-transform"
                >
                  <div className={`w-12 h-12 rounded-full ${action.iconBg} flex items-center justify-center`}>
                    <span className={action.iconColor}>{action.icon}</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-800 whitespace-nowrap">{action.name}</span>
                </Link>
              ))}
            </div>
          </div>
          {/* Desktop: button row */}
          <div className="hidden md:flex flex-wrap gap-4">
            {quickActions.map((action, i) => (
              <Link
                key={i}
                to={action.link}
                className={`py-3 px-6 rounded-xl font-semibold flex items-center gap-3 transition-all hover:shadow-md ${
                  i === 0
                    ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-800'
                    : 'bg-white border-2 border-slate-100 text-gray-900 hover:bg-slate-50'
                }`}
              >
                <span className={i === 0 ? 'text-white' : action.iconColor}>{action.icon}</span>
                <span>{action.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Products & Stock Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top Products */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 lg:p-8 overflow-hidden lg:col-span-2">
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">� Top produits</h3>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Par nombre de ventes livrées</p>
              </div>
              <Link to="/ecom/stats/rapports" className="text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                <span>Voir tout</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            {/* Desktop: table column headers */}
            <div className="hidden md:flex items-center gap-4 px-3 pb-3 border-b border-slate-100 mt-1">
              <div className="w-10 flex-shrink-0" />
              <div className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produit</div>
              <div className="text-right flex-shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-44">CA &nbsp;/&nbsp; Bénéfice</div>
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
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 lg:p-8 overflow-hidden">
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
              <div className="min-w-0">
                <h3 className="text-base sm:text-xl font-bold text-gray-900">Alertes stock</h3>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Produits nécessitant réapprovisionnement</p>
              </div>
              {stats.stockAlerts.summary?.lowStockCount > 0 && (
                <span className="p-1.5 bg-red-100 text-red-600 rounded-lg flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M1 21L12 2l11 19H1zm11-3h2v-2h-2v2zm0-4h2v-4h-2v4z"/></svg>
                </span>
              )}
            </div>
            {stats.stockAlerts.summary?.lowStockCount > 0 && (
              <p className="hidden md:block text-xs font-bold text-red-600 mb-4">{stats.stockAlerts.summary.lowStockCount} alerte{stats.stockAlerts.summary.lowStockCount > 1 ? 's' : ''} active{stats.stockAlerts.summary.lowStockCount > 1 ? 's' : ''}</p>
            )}

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
                  <div key={i} className={`flex items-start gap-4 p-4 rounded-xl group transition-all ${
                    alert.urgency === 'critical' ? 'bg-red-50/60 hover:bg-red-50' :
                    alert.urgency === 'high'     ? 'bg-orange-50/60 hover:bg-orange-50' :
                                                   'bg-yellow-50/60 hover:bg-yellow-50'
                  }`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                      alert.urgency === 'critical' ? 'bg-white border border-red-200' :
                      alert.urgency === 'high'     ? 'bg-white border border-orange-200' :
                                                     'bg-white border border-yellow-200'
                    }`}>
                      <svg className={`w-5 h-5 ${alert.urgency === 'critical' ? 'text-red-500' : alert.urgency === 'high' ? 'text-orange-500' : 'text-yellow-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{alert.name}</p>
                      <p className={`text-xs font-bold mt-0.5 ${alert.urgency === 'critical' ? 'text-red-600' : alert.urgency === 'high' ? 'text-orange-600' : 'text-yellow-600'}`}>
                        {alert.stock === 0 ? 'Rupture de stock' : `Seulement ${alert.stock} unité${alert.stock > 1 ? 's' : ''} restante${alert.stock > 1 ? 's' : ''}`}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Seuil : {alert.reorderThreshold} unités</p>
                      <Link
                        to="/ecom/stock/orders/new"
                        state={{ productId: alert.productId || alert._id, productName: alert.name }}
                        className="mt-2 inline-block text-[11px] font-extrabold uppercase tracking-widest text-gray-500 hover:text-emerald-700 transition-colors"
                      >
                        Réapprovisionner →
                      </Link>
                    </div>
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

            <div className="mt-6 pt-6 border-t border-slate-50">
              <p className="text-xs text-slate-400 text-center font-medium">
                Prochain inventaire —{' '}
                <Link to="/ecom/stock" className="text-gray-700 hover:text-emerald-700 font-semibold transition-colors">
                  Voir le stock complet
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Objectifs */}
        <div className="mt-8 bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Objectifs du mois</h3>
            <Link to="/ecom/goals" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              <Link to="/ecom/goals" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                <span>Gérer</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
