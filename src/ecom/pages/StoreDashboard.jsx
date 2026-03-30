import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Eye, ShoppingCart, DollarSign, Users, 
  Package, Clock, ExternalLink, Download, RefreshCw,
  Monitor, Smartphone, Tablet, ArrowUp, ArrowDown
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function StoreDashboard() {
  const navigate = useNavigate();
  const { currentWorkspace } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [realtimeData, setRealtimeData] = useState(null);

  useEffect(() => {
    loadDashboard();
    loadRealtime();
    
    // Actualiser les stats temps réel toutes les 30 secondes
    const interval = setInterval(loadRealtime, 30000);
    return () => clearInterval(interval);
  }, [period, currentWorkspace]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/ecom/store-analytics/dashboard', {
        params: { 
          workspaceId: currentWorkspace?._id,
          period 
        }
      });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRealtime = async () => {
    try {
      const response = await api.get('/ecom/store-analytics/realtime', {
        params: { workspaceId: currentWorkspace?._id }
      });
      setRealtimeData(response.data);
    } catch (error) {
      console.error('Erreur chargement temps réel:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDashboard(), loadRealtime()]);
    setRefreshing(false);
  };

  const exportAnalytics = async () => {
    try {
      const response = await api.get('/ecom/store-analytics/export', {
        params: { workspaceId: currentWorkspace?._id },
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  const analytics = dashboardData?.analytics?.overview || {};
  const orders = dashboardData?.orders || {};

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Dashboard Boutique</h1>
          <p className="text-gray-600 mt-1">Vue d'ensemble de votre boutique e-commerce</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Période */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="24h">Dernières 24h</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
          </select>

          {/* Boutons d'action */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            title="Actualiser"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={exportAnalytics}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
          >
            <Download size={18} />
            Exporter
          </button>

          <button
            onClick={() => window.open(`https://${currentWorkspace?.storeSubdomain}.scalor.net`, '_blank')}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition flex items-center gap-2"
          >
            <ExternalLink size={18} />
            Voir la boutique
          </button>
        </div>
      </div>

      {/* Stats temps réel */}
      {realtimeData && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock size={24} />
              Temps réel
            </h2>
            <span className="text-sm opacity-90">Mis à jour il y a quelques secondes</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={20} />
                <span className="text-sm opacity-90">Visiteurs actifs</span>
              </div>
              <div className="text-3xl font-bold">{realtimeData.activeVisitors}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye size={20} />
                <span className="text-sm opacity-90">Vues (24h)</span>
              </div>
              <div className="text-3xl font-bold">{formatNumber(realtimeData.pageViews24h)}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart size={20} />
                <span className="text-sm opacity-90">Commandes récentes</span>
              </div>
              <div className="text-3xl font-bold">{realtimeData.recentOrders?.length || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={<Eye className="text-blue-500" size={24} />}
          title="Visiteurs uniques"
          value={formatNumber(analytics.uniqueVisitors)}
          bgColor="bg-blue-50"
        />
        <MetricCard
          icon={<TrendingUp className="text-purple-500" size={24} />}
          title="Vues de pages"
          value={formatNumber(analytics.pageViews)}
          bgColor="bg-purple-50"
        />
        <MetricCard
          icon={<ShoppingCart className="text-orange-500" size={24} />}
          title="Commandes"
          value={formatNumber(orders.total)}
          subtitle={`${orders.delivered || 0} livrées`}
          bgColor="bg-orange-50"
        />
        <MetricCard
          icon={<DollarSign className="text-green-500" size={24} />}
          title="Chiffre d'affaires"
          value={formatCurrency(orders.totalRevenue)}
          subtitle={`Panier moyen: ${formatCurrency(orders.averageOrderValue)}`}
          bgColor="bg-green-50"
        />
      </div>

      {/* Tunnel de conversion */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold mb-6">🎯 Tunnel de conversion</h2>
        <div className="space-y-4">
          <ConversionStep
            label="Visiteurs"
            count={analytics.uniqueVisitors}
            percentage={100}
            color="bg-blue-500"
          />
          <ConversionStep
            label="Vues produits"
            count={analytics.productViews}
            percentage={(analytics.productViews / analytics.uniqueVisitors * 100) || 0}
            color="bg-purple-500"
          />
          <ConversionStep
            label="Ajouts au panier"
            count={analytics.addToCarts}
            percentage={(analytics.addToCarts / analytics.uniqueVisitors * 100) || 0}
            color="bg-orange-500"
          />
          <ConversionStep
            label="Checkouts"
            count={analytics.checkoutsStarted}
            percentage={(analytics.checkoutsStarted / analytics.uniqueVisitors * 100) || 0}
            color="bg-amber-500"
          />
          <ConversionStep
            label="Commandes"
            count={analytics.ordersPlaced}
            percentage={analytics.conversionRate || 0}
            color="bg-green-500"
          />
        </div>
        <div className="mt-6 p-4 bg-emerald-50 rounded-lg">
          <p className="text-sm text-emerald-800">
            <strong>Taux de conversion global:</strong> {analytics.conversionRate}%
          </p>
        </div>
      </div>

      {/* Stats appareils & Top produits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appareils */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold mb-6">📱 Appareils</h2>
          <div className="space-y-3">
            {dashboardData?.analytics?.deviceStats?.map((device, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getDeviceIcon(device._id)}
                  <span className="font-medium capitalize">{device._id || 'Unknown'}</span>
                </div>
                <span className="font-bold text-emerald-600">{formatNumber(device.count)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top produits */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold mb-6">🏆 Produits les plus vus</h2>
          <div className="space-y-3">
            {dashboardData?.analytics?.topProducts?.slice(0, 5).map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-300">#{index + 1}</span>
                  <span className="font-medium">{product.name || 'Sans nom'}</span>
                </div>
                <span className="font-bold text-purple-600">{formatNumber(product.views)} vues</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Statuts des commandes */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold mb-6">📦 Statuts des commandes</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatusCard label="En attente" count={orders.pending} color="text-amber-600" />
          <StatusCard label="Confirmées" count={orders.confirmed} color="text-blue-600" />
          <StatusCard label="En traitement" count={orders.processing} color="text-indigo-600" />
          <StatusCard label="Expédiées" count={orders.shipped} color="text-purple-600" />
          <StatusCard label="Livrées" count={orders.delivered} color="text-green-600" />
          <StatusCard label="Annulées" count={orders.cancelled} color="text-red-600" />
        </div>
      </div>
    </div>
  );
}

// Composants helpers
const MetricCard = ({ icon, title, value, subtitle, bgColor }) => (
  <div className="bg-white rounded-xl shadow-sm p-6">
    <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center mb-4`}>
      {icon}
    </div>
    <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
  </div>
);

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
