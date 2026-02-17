import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const AdminDashboard = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    products: [],
    stockAlerts: [],
    financialStats: {},
    dailyFinancial: [],
    decisions: [],
    orders: [],
    recentActivity: []
  });
  const [timeRange, setTimeRange] = useState('14d');

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const daysCount = parseInt(timeRange) || 14;
      const [productsRes, alertsRes, financialRes, decisionsRes, ordersRes, dailyRes] = await Promise.all([
        ecomApi.get('/products?isActive=true'),
        ecomApi.get('/stock/alerts'),
        ecomApi.get('/reports/stats/financial'),
        ecomApi.get('/decisions/dashboard/overview'),
        ecomApi.get('/orders?limit=5'),
        ecomApi.get(`/reports/stats/financial/daily?days=${daysCount}`)
      ]);

      const financialData = financialRes.data?.data || {};
      const dailyFinancial = dailyRes.data?.data || [];

      // Generate recent activity from orders
      const recentOrders = ordersRes.data?.data?.orders || [];
      const activity = recentOrders.map(order => ({
        type: 'order',
        title: `Commande ${order.status}`,
        description: `${order.clientName} — ${order.product}`,
        time: order.date,
        amount: order.price * order.quantity,
        status: order.status
      }));

      setStats({
        products: productsRes.data?.data || [],
        stockAlerts: alertsRes.data?.data || [],
        financialStats: financialData,
        dailyFinancial,
        decisions: decisionsRes.data?.data || {},
        orders: recentOrders,
        recentActivity: activity
      });
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

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
      stable: 'bg-blue-100 text-blue-700 border-blue-200',
      winner: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      pause: 'bg-orange-100 text-orange-700 border-orange-200',
      stop: 'bg-red-100 text-red-700 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getOrderStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      shipped: 'bg-indigo-500',
      delivered: 'bg-emerald-500',
      cancelled: 'bg-red-500',
      returned: 'bg-orange-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const calculateProductMargin = (product) => {
    const sellingPrice = product.sellingPrice || 0;
    const totalCost = (product.productCost || 0) + (product.deliveryCost || 0) + (product.avgAdsCost || 0);
    return sellingPrice - totalCost;
  };

  const kpiCards = [
    {
      title: 'Chiffre d\'affaires',
      value: fmt(stats.financialStats.totalRevenue || 0),
      trend: '+12.5%',
      trendUp: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'blue',
      link: '/reports'
    },
    {
      title: 'Bénéfice net',
      value: fmt(stats.financialStats.totalProfit || 0),
      trend: '+8.2%',
      trendUp: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: 'emerald',
      link: '/reports'
    },
    {
      title: 'Produits actifs',
      value: stats.products.length,
      trend: '+3',
      trendUp: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: 'indigo',
      link: '/products'
    },
    {
      title: 'Commandes livrées',
      value: stats.financialStats.totalOrdersDelivered || 0,
      trend: stats.financialStats.deliveryRate ? formatPercent(stats.financialStats.deliveryRate) : '0%',
      trendUp: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'violet',
      link: '/orders'
    }
  ];

  const quickActions = [
    { 
      name: 'Nouveau produit', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ), 
      color: 'bg-blue-600 hover:bg-blue-700', 
      link: '/products/new' 
    },
    { 
      name: 'Nouvelle commande', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ), 
      color: 'bg-violet-600 hover:bg-violet-700', 
      link: '/orders' 
    },
    { 
      name: 'Ajouter stock', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ), 
      color: 'bg-emerald-600 hover:bg-emerald-700', 
      link: '/stock-locations' 
    },
    { 
      name: 'Transaction', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ), 
      color: 'bg-amber-600 hover:bg-amber-700', 
      link: '/transactions/new' 
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-indigo-400 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Chargement de votre cockpit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {getGreeting()}, <span className="text-blue-600">{user?.name || user?.email?.split('@')[0]}</span>
                <svg className="w-5 h-5 inline-block ml-1 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
              </h1>
              <p className="text-sm text-gray-500">Voici ce qui se passe dans votre business aujourd'hui</p>
            </div>
            <div className="flex items-center gap-3">
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="24h">24 heures</option>
                <option value="7d">7 jours</option>
                <option value="30d">30 jours</option>
                <option value="90d">3 mois</option>
              </select>
              <button 
                onClick={loadDashboardData}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-5 bg-blue-600 rounded-full"></span>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Actions rapides</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action, i) => (
              <Link
                key={i}
                to={action.link}
                className={`${action.color} text-white rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{action.icon}</span>
                  <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <p className="text-sm font-medium">{action.name}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpiCards.map((card, i) => (
            <Link
              key={i}
              to={card.link}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-${card.color}-100 text-${card.color}-600 flex items-center justify-center`}>
                  {card.icon}
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium ${card.trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.trendUp ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                  </svg>
                  {card.trend}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{card.value}</p>
              <p className="text-sm text-gray-500">{card.title}</p>
            </Link>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Chart Section - Revenue Trend */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Performance financière</h3>
                <p className="text-sm text-gray-500">Évolution du chiffre d'affaires et des bénéfices</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-xs text-gray-500">CA</span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500 ml-2"></span>
                  <span className="text-xs text-gray-500">Bénéfice</span>
                </div>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="7d">7 jours</option>
                  <option value="14d">14 jours</option>
                  <option value="30d">30 jours</option>
                  <option value="60d">60 jours</option>
                </select>
              </div>
            </div>
            
            {/* Real SVG Line Chart */}
            {(() => {
              const data = stats.dailyFinancial || [];
              if (data.length === 0) {
                return (
                  <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
                    Aucune donnée financière disponible
                  </div>
                );
              }

              const W = 600;
              const H = 200;
              const padL = 55;
              const padR = 15;
              const padT = 15;
              const padB = 30;
              const chartW = W - padL - padR;
              const chartH = H - padT - padB;

              const maxVal = Math.max(
                ...data.map(d => d.revenue),
                ...data.map(d => Math.abs(d.profit)),
                1
              );
              const yMax = Math.ceil(maxVal / 100) * 100 || 100;

              const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

              const toX = (i) => padL + i * xStep;
              const toY = (val) => padT + chartH - (val / yMax) * chartH;

              const buildPath = (key) => {
                return data.map((d, i) => {
                  const x = toX(i);
                  const y = toY(Math.max(d[key], 0));
                  return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' ');
              };

              const buildArea = (key) => {
                const lineParts = data.map((d, i) => {
                  const x = toX(i);
                  const y = toY(Math.max(d[key], 0));
                  return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                });
                const lastX = toX(data.length - 1);
                const firstX = toX(0);
                const baseY = toY(0);
                return `${lineParts.join(' ')} L${lastX.toFixed(1)},${baseY.toFixed(1)} L${firstX.toFixed(1)},${baseY.toFixed(1)} Z`;
              };

              const revenuePath = buildPath('revenue');
              const profitPath = buildPath('profit');
              const revenueArea = buildArea('revenue');
              const profitArea = buildArea('profit');

              const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

              const formatShort = (v) => {
                if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                return v.toFixed(0);
              };

              const labelInterval = Math.max(1, Math.floor(data.length / 7));

              return (
                <div className="relative">
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56" preserveAspectRatio="xMidYMid meet">
                    {/* Grid lines */}
                    {yTicks.map((tick, i) => (
                      <g key={i}>
                        <line
                          x1={padL} y1={toY(tick)} x2={W - padR} y2={toY(tick)}
                          stroke="#f3f4f6" strokeWidth="1"
                        />
                        <text x={padL - 8} y={toY(tick) + 3} textAnchor="end" fill="#9ca3af" fontSize="9">
                          {formatShort(tick)}
                        </text>
                      </g>
                    ))}

                    {/* Revenue area */}
                    <path d={revenueArea} fill="url(#revenueGrad)" opacity="0.15" />
                    {/* Profit area */}
                    <path d={profitArea} fill="url(#profitGrad)" opacity="0.12" />

                    {/* Revenue line */}
                    <path d={revenuePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Profit line */}
                    <path d={profitPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Data points - Revenue */}
                    {data.map((d, i) => (
                      <circle key={`r-${i}`} cx={toX(i)} cy={toY(Math.max(d.revenue, 0))} r="3" fill="#3b82f6" stroke="#fff" strokeWidth="1.5">
                        <title>{new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — CA: {fmt(d.revenue)}</title>
                      </circle>
                    ))}
                    {/* Data points - Profit */}
                    {data.map((d, i) => (
                      <circle key={`p-${i}`} cx={toX(i)} cy={toY(Math.max(d.profit, 0))} r="3" fill="#10b981" stroke="#fff" strokeWidth="1.5">
                        <title>{new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — Bénéfice: {fmt(d.profit)}</title>
                      </circle>
                    ))}

                    {/* X-axis labels */}
                    {data.map((d, i) => {
                      if (i % labelInterval !== 0 && i !== data.length - 1) return null;
                      const label = new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                      return (
                        <text key={`xl-${i}`} x={toX(i)} y={H - 5} textAnchor="middle" fill="#9ca3af" fontSize="9">
                          {label}
                        </text>
                      );
                    })}

                    {/* Gradients */}
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              );
            })()}

            {/* Financial Metrics */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-500 mb-1">Coûts totaux</p>
                <p className="text-lg font-bold text-red-600">{fmt(stats.financialStats.totalCost || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Taux de marge</p>
                <p className="text-lg font-bold text-blue-600">
                  {stats.financialStats.profitabilityRate?.toFixed(1) || 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">ROAS</p>
                <p className="text-lg font-bold text-violet-600">
                  {stats.financialStats.roas?.toFixed(2) || '0.00'}x
                </p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Activité récente</h3>
              <Link to="/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Voir tout
              </Link>
            </div>
            <div className="space-y-4">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.slice(0, 5).map((activity, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${getOrderStatusColor(activity.status)}`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{fmt(activity.amount)}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-400">
                          {new Date(activity.time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">Aucune activité récente</p>
              )}
            </div>
          </div>
        </div>

        {/* Products & Stock Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Top produits</h3>
                <p className="text-sm text-gray-500">Performance par marge générée</p>
              </div>
              <Link to="/products" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Tous les produits →
              </Link>
            </div>
            <div className="space-y-3">
              {stats.products.slice(0, 5).map((product, i) => {
                const margin = calculateProductMargin(product);
                const marginPercent = product.sellingPrice ? (margin / product.sellingPrice) * 100 : 0;
                return (
                  <div key={product._id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{product.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusColor(product.status)}`}>
                          {product.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>Stock: {product.stock}</span>
                        <span>•</span>
                        <span className={margin >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          Marge: {fmt(margin)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{fmt(product.sellingPrice || 0)}</p>
                      <p className="text-xs text-gray-500">{marginPercent.toFixed(0)}% marge</p>
                    </div>
                  </div>
                );
              })}
              {stats.products.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-3">Aucun produit actif</p>
                  <Link to="/products/new" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                    + Créer votre premier produit
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Stock Alerts */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Alertes stock</h3>
                <p className="text-sm text-gray-500">Produits nécessitant réapprovisionnement</p>
              </div>
              {stats.stockAlerts.summary?.lowStockCount > 0 && (
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                  {stats.stockAlerts.summary.lowStockCount} alertes
                </span>
              )}
            </div>
            
            {stats.stockAlerts.lowStockProducts?.length > 0 ? (
              <div className="space-y-3">
                {stats.stockAlerts.lowStockProducts.slice(0, 5).map((alert, i) => (
                  <div key={i} className={`flex items-center gap-4 p-4 rounded-xl border ${
                    alert.urgency === 'critical' ? 'bg-red-50 border-red-200' : 
                    alert.urgency === 'high' ? 'bg-orange-50 border-orange-200' : 
                    'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      alert.urgency === 'critical' ? 'bg-red-500 text-white' : 
                      alert.urgency === 'high' ? 'bg-orange-500 text-white' : 
                      'bg-yellow-500 text-white'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{alert.name}</p>
                      <p className="text-sm text-gray-500">
                        Stock: <span className="font-bold text-red-600">{alert.stock}</span> / Seuil: {alert.reorderThreshold}
                      </p>
                    </div>
                    <Link 
                      to="/stock/orders/new"
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                      Réapprovisionner
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">Tous les stocks sont au vert !</p>
                <p className="text-sm text-gray-400 mt-1">Aucun réapprovisionnement nécessaire</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <Link to="/stock" className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium py-2 rounded-lg hover:bg-blue-50 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Voir le rapport de stock complet
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Taux de conversion', value: '3.2%', trend: '+0.5%' },
            { label: 'Panier moyen', value: fmt(stats.financialStats.averageOrderValue || 0), trend: '+2.1%' },
            { label: 'Clients actifs', value: '156', trend: '+12' },
            { label: 'Retours', value: '2.4%', trend: '-0.3%' },
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
