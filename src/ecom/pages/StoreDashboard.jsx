import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Eye, ShoppingCart, DollarSign, Users, 
  Package, Clock, ExternalLink, Download, RefreshCw,
  Monitor, Smartphone, Tablet, ArrowUp, ArrowDown,
  Calendar, TrendingDown, Activity, BarChart3, PieChart
} from 'lucide-react';
import ecomApi from '../services/ecommApi';
import { useEcomAuth } from '../hooks/useEcomAuth';

export default function StoreDashboard() {
  const navigate = useNavigate();
  const { workspace } = useEcomAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    loadDashboard();
  }, [period, workspace]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      console.log('📊 Loading dashboard for workspace:', workspace?._id, 'period:', period);
      const response = await ecomApi.get('/store-analytics/dashboard', {
        params: { 
          workspaceId: workspace?._id,
          period 
        }
      });
      console.log('✅ Dashboard data loaded:', response.data);
      setDashboardData(response.data);
    } catch (error) {
      console.error('❌ Erreur chargement dashboard:', error.response?.status, error.response?.data || error.message);
      // Initialiser avec des données vides pour éviter les erreurs d'affichage
      setDashboardData({
        analytics: {
          overview: {},
          topProducts: [],
          deviceStats: [],
          timeline: []
        },
        orders: {}
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const exportAnalytics = async () => {
    try {
      const response = await ecomApi.get('/store-analytics/export', {
        params: { workspaceId: workspace?._id },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Erreur export:', error);
      alert('Erreur lors de l\'export');
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('fr-FR').format(num || 0);
  };

  const formatCurrency = (amount) => {
    return `${formatNumber(amount)} FCFA`;
  };

  const getDeviceIcon = (device) => {
    switch(device) {
      case 'mobile': return <Smartphone size={20} />;
      case 'tablet': return <Tablet size={20} />;
      default: return <Monitor size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500 border-t-transparent mx-auto"></div>
          <p className="mt-6 text-lg font-medium text-gray-700">Chargement de votre boutique...</p>
          <p className="mt-2 text-sm text-gray-500">Analyse des données en cours</p>
        </div>
      </div>
    );
  }

  const analytics = dashboardData?.analytics?.overview || {};
  const orders = dashboardData?.orders || {};
  const timeline = dashboardData?.analytics?.timeline || [];
  const topProducts = dashboardData?.analytics?.topProducts || [];
  const deviceStats = dashboardData?.analytics?.deviceStats || [];
  
  // Calculer les tendances
  const calculateTrend = (current, previous) => {
    if (!previous || previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change).toFixed(1), isPositive: change >= 0 };
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <BarChart3 size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Dashboard Boutique</h1>
              <p className="text-xs text-gray-500">
                {period === '24h' ? 'Dernières 24h' : period === '7d' ? '7 derniers jours' : period === '30d' ? '30 jours' : '90 jours'}
              </p>
            </div>
          </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Période */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="24h">24h</option>
            <option value="7d">7 jours</option>
            <option value="30d">30 jours</option>
            <option value="90d">90 jours</option>
          </select>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            title="Actualiser"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={exportAnalytics}
            className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            title="Exporter CSV"
          >
            <Download size={16} />
          </button>
        </div>
        </div>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ShopifyMetricCard
          title="Visiteurs uniques"
          value={formatNumber(analytics.uniqueVisitors || 0)}
          subtitle={`${formatNumber(analytics.visitsToday || 0)} aujourd'hui`}
          trend={calculateTrend(analytics.uniqueVisitors, 0)}
          sparklineData={timeline}
          color="blue"
        />
        <ShopifyMetricCard
          title="Ventes totales"
          value={formatCurrency(orders.totalRevenue || 0)}
          trend={calculateTrend(orders.totalRevenue, 0)}
          sparklineData={timeline}
          color="green"
        />
        <ShopifyMetricCard
          title="Commandes"
          value={formatNumber(orders.total || 0)}
          subtitle={`${orders.delivered || 0} livrées`}
          trend={calculateTrend(orders.total, 0)}
          sparklineData={timeline}
          color="orange"
        />
        <ShopifyMetricCard
          title="Taux de conversion"
          value={`${analytics.conversionRate || 0}%`}
          subtitle={`${formatNumber(analytics.pageViews || 0)} pages vues`}
          trend={calculateTrend(analytics.conversionRate, 0)}
          sparklineData={timeline}
          color="purple"
        />
      </div>

      {/* Section Tâches et Suggestions - Style Shopify */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tâches à traiter */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Bonjour ! C'est parti.</h2>
            <button className="text-sm text-gray-500 hover:text-gray-700">Tout afficher</button>
          </div>
          <div className="space-y-3">
            <TaskCard
              icon="📦"
              title={`${orders.pending || 0} commande${(orders.pending || 0) > 1 ? 's' : ''} à traiter`}
              description="Confirmez et préparez vos commandes en attente"
              link="/ecom/store/orders"
            />
            <TaskCard
              icon="💰"
              title={`${orders.processing || 0} paiement${(orders.processing || 0) > 1 ? 's' : ''} à saisir`}
              description="Enregistrez les paiements reçus"
              link="/ecom/store/orders"
            />
          </div>
        </div>

        {/* Améliorez votre boutique */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Améliorez votre boutique</h2>
          <div className="space-y-4">
            <SuggestionCard
              title="Améliorez votre taux de conversion"
              description="Augmentez le pourcentage de visiteurs qui achètent quelque chose dans votre boutique en ligne."
              action="Première tâche: Automatisez vos paniers abandonnés"
              illustration="🎯"
            />
          </div>
        </div>
      </div>

      {/* Graphique de tendances */}
      {timeline && timeline.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={22} className="text-emerald-600" />
              Tendances
            </h2>
          </div>
          <SimpleLineChart data={timeline} />
        </div>
      )}



      {/* Visites par produit */}
      {dashboardData?.analytics?.visitsPerProduct?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Eye size={15} className="text-emerald-600" />
            </div>
            Visites par produit
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase">Produit</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase">Visites</th>
                  <th className="text-right py-2 pl-2 text-xs font-medium text-gray-500 uppercase">Visiteurs uniques</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.analytics.visitsPerProduct.map((p, i) => (
                  <tr key={p._id || i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-emerald-50 text-emerald-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="font-medium text-gray-800 truncate max-w-[200px]">{p.name || 'Sans nom'}</span>
                      </div>
                    </td>
                    <td className="text-right py-2.5 px-2 font-semibold text-gray-900">{formatNumber(p.visits)}</td>
                    <td className="text-right py-2.5 pl-2 text-gray-500">{formatNumber(p.uniqueVisitorCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats appareils & Top produits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Appareils */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Monitor size={18} className="text-blue-600" />
            </div>
            Appareils
          </h2>
          <div className="space-y-3">
            {deviceStats && deviceStats.length > 0 ? deviceStats.map((device, index) => {
              const total = deviceStats.reduce((sum, d) => sum + d.count, 0);
              const percentage = total > 0 ? ((device.count / total) * 100).toFixed(1) : 0;
              return (
                <div key={index} className="group hover:bg-gray-50 transition-colors rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                        {getDeviceIcon(device._id)}
                      </div>
                      <span className="font-semibold capitalize text-gray-900">{device._id || 'Inconnu'}</span>
                    </div>
                    <span className="font-bold text-blue-600 text-lg">{formatNumber(device.count)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{percentage}% du trafic</p>
                </div>
              );
            }) : (
              <div className="text-center py-8 text-gray-500">
                <Monitor size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            )}
          </div>
        </div>

        {/* Top produits */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package size={18} className="text-purple-600" />
            </div>
            Produits populaires
          </h2>
          <div className="space-y-3">
            {topProducts && topProducts.length > 0 ? topProducts.slice(0, 5).map((product, index) => (
              <div key={index} className="group hover:bg-gray-50 transition-colors rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-red-500' :
                      'bg-gradient-to-br from-purple-500 to-pink-600'
                    }`}>
                      #{index + 1}
                    </div>
                    <span className="font-medium text-gray-900 truncate">{product.name || 'Sans nom'}</span>
                  </div>
                  <div className="text-right ml-3">
                    <div className="font-bold text-purple-600 text-lg">{formatNumber(product.views)}</div>
                    <div className="text-xs text-gray-500">vues</div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-500">
                <Package size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun produit consulté</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// Composants helpers - Style Shopify
const ShopifyMetricCard = ({ title, value, subtitle, trend, sparklineData, color }) => {
  const trendColors = trend?.isPositive 
    ? 'text-green-600 bg-green-50' 
    : 'text-red-600 bg-red-50';
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {trend && trend.value > 0 && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${trendColors}`}>
            {trend.isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <MiniSparkline data={sparklineData} color={color} />
        )}
      </div>
    </div>
  );
};

const MiniSparkline = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  
  const groupedByDate = data.reduce((acc, item) => {
    const date = item._id?.date || item.date;
    if (!acc[date]) acc[date] = { date, total: 0 };
    acc[date].total += item.count || 0;
    return acc;
  }, {});
  
  const chartData = Object.values(groupedByDate).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const maxValue = Math.max(...chartData.map(d => d.total), 1);
  
  const colorMap = {
    blue: '#3b82f6',
    green: '#10b981',
    orange: '#f59e0b',
    purple: '#8b5cf6'
  };
  
  return (
    <svg width="80" height="32" className="opacity-60">
      <polyline
        fill="none"
        stroke={colorMap[color] || '#3b82f6'}
        strokeWidth="2"
        points={chartData.map((d, i) => {
          const x = (i / (chartData.length - 1)) * 80;
          const y = 32 - (d.total / maxValue) * 28;
          return `${x},${y}`;
        }).join(' ')}
      />
    </svg>
  );
};

const TaskCard = ({ icon, title, description, link }) => (
  <a href={link} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
    <div className="text-2xl">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 group-hover:text-emerald-600 transition-colors">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
    <ExternalLink size={16} className="text-gray-400 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
  </a>
);

const SuggestionCard = ({ title, description, action, illustration }) => (
  <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-3xl">{illustration}</span>
      </div>
      <p className="text-xs text-gray-600 mb-3">{description}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700">{action}</p>
        <button className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
          Démarrer
        </button>
      </div>
    </div>
  </div>
);

const ShopifyStatusCard = ({ label, count, color, icon }) => {
  const colorClasses = {
    amber: 'from-amber-500 to-orange-500',
    blue: 'from-blue-500 to-cyan-500',
    indigo: 'from-indigo-500 to-purple-500',
    purple: 'from-purple-500 to-pink-500',
    green: 'from-green-500 to-emerald-500',
    red: 'from-red-500 to-rose-500',
  };
  
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 border border-gray-200 text-center">
      <div className="text-xl mb-1">{icon}</div>
      <p className={`text-2xl font-bold bg-gradient-to-r ${colorClasses[color]} bg-clip-text text-transparent mb-0.5`}>
        {count || 0}
      </p>
      <p className="text-[10px] font-medium text-gray-500 leading-tight">{label}</p>
    </div>
  );
};

const SimpleLineChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  
  const groupedByDate = data.reduce((acc, item) => {
    const date = item._id.date;
    if (!acc[date]) acc[date] = { date, total: 0 };
    acc[date].total += item.count;
    return acc;
  }, {});
  
  const chartData = Object.values(groupedByDate).sort((a, b) => a.date.localeCompare(b.date));
  const maxValue = Math.max(...chartData.map(d => d.total), 1);
  
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between h-48 gap-2">
        {chartData.map((item, index) => {
          const height = (item.total / maxValue) * 100;
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="relative w-full">
                <div 
                  className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t-lg transition-all duration-300 group-hover:from-emerald-600 group-hover:to-teal-500 cursor-pointer"
                  style={{ height: `${height}%`, minHeight: '4px' }}
                  title={`${item.date}: ${item.total} événements`}
                >
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {item.total}
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-500 transform -rotate-45 origin-top-left mt-2">
                {new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gradient-to-r from-emerald-500 to-teal-400 rounded"></div>
          <span className="text-gray-600">Activité quotidienne</span>
        </div>
      </div>
    </div>
  );
};

const ConversionStep = ({ label, count, percentage, color }) => (
  <div className="flex items-center gap-4">
    <div className="w-32 text-sm font-medium text-gray-700">{label}</div>
    <div className="flex-1">
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-500 flex items-center justify-end pr-3`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          >
            {percentage > 10 && (
              <span className="text-white text-xs font-bold">{percentage.toFixed(1)}%</span>
            )}
          </div>
        </div>
        <span className="text-sm font-bold text-gray-700 w-16 text-right">
          {new Intl.NumberFormat('fr-FR').format(count)}
        </span>
      </div>
    </div>
  </div>
);

const StatusCard = ({ label, count, color }) => (
  <div className="p-4 bg-gray-50 rounded-lg text-center">
    <p className={`text-3xl font-bold ${color}`}>{count || 0}</p>
    <p className="text-sm text-gray-600 mt-1">{label}</p>
  </div>
);
