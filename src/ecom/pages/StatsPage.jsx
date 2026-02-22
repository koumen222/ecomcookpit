import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { 
  ArrowLeft, TrendingUp, Package, Users, MapPin, DollarSign, 
  ShoppingCart, CheckCircle, RotateCcw, BarChart3, Calendar,
  RefreshCw, Award, Crown, Medal, Wallet, CreditCard, Truck,
  AlertCircle
} from 'lucide-react';

const IconCard = ({ icon: Icon, color, bgColor, size = 20 }) => (
  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgColor} shadow-sm`}>
    <Icon size={size} className={color} strokeWidth={2} />
  </div>
);

const RankBadge = ({ rank, color }) => {
  const icons = [Crown, Medal, Award];
  const Icon = icons[rank - 1] || Award;
  const colors = ['text-yellow-600 bg-yellow-100', 'text-gray-600 bg-gray-200', 'text-orange-600 bg-orange-100'];
  const colorClass = colors[rank - 1] || 'text-gray-500 bg-gray-100';
  
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
      {rank <= 3 ? <Icon size={14} /> : <span className="text-xs font-bold">{rank}</span>}
    </div>
  );
};

const SL = { pending: 'En attente', confirmed: 'Confirmé', shipped: 'Expédié', delivered: 'Livré', returned: 'Retour', cancelled: 'Annulé', unreachable: 'Injoignable', called: 'Appelé', postponed: 'Reporté' };

const SC = {
  pending: { bg: 'bg-yellow-500', light: 'bg-yellow-100', text: 'text-yellow-600', icon: Package },
  confirmed: { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-600', icon: CheckCircle },
  shipped: { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-600', icon: Truck },
  delivered: { bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-600', icon: CheckCircle },
  returned: { bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-600', icon: RotateCcw },
  cancelled: { bg: 'bg-red-500', light: 'bg-red-100', text: 'text-red-600', icon: RotateCcw },
  unreachable: { bg: 'bg-gray-500', light: 'bg-gray-100', text: 'text-gray-600', icon: Users },
  called: { bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-600', icon: Users },
  postponed: { bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-600', icon: Calendar }
};

const StatsPage = () => {
  const navigate = useNavigate();
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const isAdmin = user?.role === 'ecom_admin' || user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange === 'custom' && startDate) params.startDate = startDate;
      if (dateRange === 'custom' && endDate) params.endDate = endDate;
      if (dateRange === '7d') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.startDate = d.toISOString().split('T')[0];
      } else if (dateRange === '30d') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.startDate = d.toISOString().split('T')[0];
      } else if (dateRange === '90d') {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        params.startDate = d.toISOString().split('T')[0];
      }

      const res = await ecomApi.get('/orders/stats/detailed', { params });
      setStats(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur chargement statistiques');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateRange, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const deliveryRate = stats?.orderStats?.total ? ((stats.orderStats.delivered || 0) / stats.orderStats.total * 100).toFixed(1) : 0;
  const returnRate = stats?.orderStats?.total ? ((stats.orderStats.returned || 0) / stats.orderStats.total * 100).toFixed(1) : 0;
  const confirmationRate = stats?.orderStats?.total ? (((stats.orderStats.confirmed || 0) + (stats.orderStats.shipped || 0) + (stats.orderStats.delivered || 0)) / stats.orderStats.total * 100).toFixed(1) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle size={20} className="text-red-500" />
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ecom/orders')} className="p-2.5 hover:bg-gray-100 rounded-xl transition border border-gray-200 shadow-sm">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Statistiques globales</h1>
            <p className="text-sm text-gray-500">Vue d'ensemble de votre activité e-commerce</p>
          </div>
        </div>
        
        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="all">Tout le temps</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="custom">Personnalisé</option>
          </select>
          {dateRange === 'custom' && (
            <>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <span className="text-gray-400">→</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </>
          )}
          <button onClick={fetchStats} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm">
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Revenu total</span>
            <IconCard icon={Wallet} color="text-green-600" bgColor="bg-white" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(stats?.orderStats?.totalRevenue || 0)}</p>
          <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
            <CheckCircle size={12} /> {stats?.orderStats?.delivered || 0} livrées
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Commandes</span>
            <IconCard icon={ShoppingCart} color="text-blue-600" bgColor="bg-white" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.orderStats?.total || 0}</p>
          <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
            <Package size={12} /> {stats?.orderStats?.pending || 0} en attente
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Taux livraison</span>
            <IconCard icon={TrendingUp} color="text-purple-600" bgColor="bg-white" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{deliveryRate}%</p>
          <div className="w-full bg-purple-100 rounded-full h-2 mt-2">
            <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(deliveryRate, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Taux retour</span>
            <IconCard icon={RotateCcw} color="text-orange-600" bgColor="bg-white" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{returnRate}%</p>
          <div className="w-full bg-orange-100 rounded-full h-2 mt-2">
            <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${Math.min(returnRate, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Clients</span>
            <IconCard icon={Users} color="text-indigo-600" bgColor="bg-white" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.clientStats?.total || 0}</p>
          <p className="text-xs text-indigo-600 flex items-center gap-1 mt-1">
            <CheckCircle size={12} /> {stats?.clientStats?.delivered || 0} livrés
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Panier moyen</span>
            <IconCard icon={CreditCard} color="text-emerald-600" bgColor="bg-white" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(stats?.orderStats?.avgOrderValue || 0)}</p>
          <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
            <DollarSign size={12} /> par cmd livrée
          </p>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-gray-500" />
            Répartition par statut
          </h3>
          <div className="space-y-3">
            {Object.entries(SL).map(([key, label]) => {
              const count = stats?.orderStats?.[key] || 0;
              const percent = stats?.orderStats?.total ? ((count / stats.orderStats.total) * 100).toFixed(1) : 0;
              return (
                <div key={key} className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${SC[key].light}`}>
                    {React.createElement(SC[key].icon, { size: 16, className: SC[key].text })}
                  </div>
                  <span className="text-sm text-gray-600 flex-1">{label}</span>
                  <span className="text-sm font-semibold text-gray-900">{count}</span>
                  <span className="text-xs text-gray-400 w-12 text-right">{percent}%</span>
                  <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className={`${SC[key].bg} h-2 rounded-full transition-all`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Package size={18} className="text-gray-500" />
            Produits les plus vendus
          </h3>
          <div className="space-y-3">
            {(stats?.topProducts || []).slice(0, 8).map((p, i) => (
              <div key={i} className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors">
                <RankBadge rank={i + 1} />
                <span className="text-sm text-gray-700 flex-1 truncate" title={p._id}>{p._id || 'Non spécifié'}</span>
                <span className="text-sm font-semibold text-gray-900">{p.count}</span>
                <span className="text-xs text-green-600 font-medium">{fmt(p.revenue)}</span>
              </div>
            ))}
            {(!stats?.topProducts || stats.topProducts.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">Aucun produit</p>
            )}
          </div>
        </div>
      </div>

      {/* Cities and Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Cities */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-gray-500" />
            Villes principales
          </h3>
          <div className="space-y-3">
            {(stats?.topCities || []).slice(0, 10).map((c, i) => {
              const percent = stats?.orderStats?.total ? ((c.count / stats.orderStats.total) * 100).toFixed(1) : 0;
              return (
                <div key={i} className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors">
                  <RankBadge rank={i + 1} />
                  <span className="text-sm text-gray-700 flex-1 truncate">{c._id || 'Non spécifié'}</span>
                  <span className="text-sm font-semibold text-gray-900">{c.count}</span>
                  <span className="text-xs text-gray-400 w-12 text-right">{percent}%</span>
                  <div className="w-20 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
            {(!stats?.topCities || stats.topCities.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">Aucune ville</p>
            )}
          </div>
        </div>

        {/* Top Clients */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Users size={18} className="text-gray-500" />
            Meilleurs clients
          </h3>
          <div className="space-y-3">
            {(stats?.topClients || []).slice(0, 8).map((c, i) => (
              <div key={i} className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors">
                <RankBadge rank={i + 1} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.clientName || 'Client'}</p>
                  <p className="text-xs text-gray-400">{c.phone}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{c.orderCount} cmd</span>
                <span className="text-xs text-green-600 font-medium">{fmt(c.totalSpent)}</span>
              </div>
            ))}
            {(!stats?.topClients || stats.topClients.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">Aucun client</p>
            )}
          </div>
        </div>
      </div>

      {/* Products by Client and City */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Package size={18} className="text-gray-500" />
          Produits vendus par client et ville
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left py-2 px-2 w-8">#</th>
                <th className="text-left py-2 px-2">Client</th>
                <th className="text-left py-2 px-2">Produit</th>
                <th className="text-left py-2 px-2">Ville</th>
                <th className="text-right py-2 px-2">Qté</th>
                <th className="text-right py-2 px-2">Revenu</th>
                <th className="text-right py-2 px-2">Cmd</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.productsByClientCity || []).slice(0, 15).map((item, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                  <td className="py-2.5 px-2"><RankBadge rank={i + 1} /></td>
                  <td className="py-2.5 px-2">
                    <p className="text-sm font-medium text-gray-800 truncate max-w-[160px]" title={item._id?.client}>
                      {item._id?.client || 'Client inconnu'}
                    </p>
                    <p className="text-xs text-gray-400">{item.phone || 'N/A'}</p>
                  </td>
                  <td className="py-2.5 px-2">
                    <p className="text-sm text-gray-700 font-medium truncate max-w-[180px]" title={item._id?.product}>
                      {item._id?.product || 'Produit inconnu'}
                    </p>
                  </td>
                  <td className="py-2.5 px-2">
                    <p className="text-sm text-gray-600 truncate max-w-[120px] flex items-center gap-1" title={item._id?.city}>
                      <MapPin size={12} className="shrink-0" />
                      {item._id?.city || 'Ville inconnue'}
                    </p>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-sm font-semibold text-gray-900">{item.quantity}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-xs text-green-600 font-medium">{fmt(item.revenue)}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-xs text-gray-400">{item.orderCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!stats?.productsByClientCity || stats.productsByClientCity.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-8">Aucune donnée disponible</p>
          )}
        </div>
      </div>

      {/* Daily Trend */}
      {stats?.dailyTrend && stats.dailyTrend.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-500" />
            Évolution quotidienne (30 derniers jours)
          </h3>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-40 min-w-[600px]">
              {stats.dailyTrend.map((d, i) => {
                const maxCount = Math.max(...stats.dailyTrend.map(x => x.count));
                const height = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-gray-400">{d.count}</span>
                    <div className="w-full bg-blue-100 rounded-t" style={{ height: `${Math.max(height, 4)}%` }}>
                      <div className="w-full h-full bg-blue-500 rounded-t hover:bg-blue-600 transition" title={`${d._id}: ${d.count} commandes - ${fmt(d.revenue)}`}></div>
                    </div>
                    <span className="text-[8px] text-gray-400 -rotate-45 origin-top-left whitespace-nowrap">{new Date(d._id).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsPage;
