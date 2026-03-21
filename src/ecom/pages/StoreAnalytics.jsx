import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Package, ShoppingCart, DollarSign, TrendingUp, Eye, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { storeOrdersApi, storeManageApi } from '../services/storeApi.js';

/**
 * StoreAnalytics — Dashboard overview for the public store.
 * Shows product count, order count, revenue, and status breakdown.
 * Lightweight: single API call for stats.
 */
const StoreAnalytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [storeConfig, setStoreConfig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, configRes] = await Promise.all([
          storeOrdersApi.getStats(),
          storeManageApi.getStoreConfig()
        ]);
        setStats(statsRes.data?.data || {});
        setStoreConfig(configRes.data?.data || {});
      } catch {
        setError('Impossible de charger les statistiques');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR').format(amount || 0);
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'En attente',
      confirmed: 'Confirmées',
      processing: 'En traitement',
      shipped: 'Expédiées',
      delivered: 'Livrées',
      cancelled: 'Annulées'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
      processing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      shipped: 'bg-purple-50 text-purple-700 border-purple-200',
      delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      cancelled: 'bg-red-50 text-red-700 border-red-200'
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const storeUrl = storeConfig?.subdomain ? `https://${storeConfig.subdomain}.scalor.net` : null;
  const isStoreEnabled = storeConfig?.storeSettings?.isStoreEnabled;
  const currency = storeConfig?.storeSettings?.storeCurrency || 'XAF';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            Tableau de bord Boutique
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Vue d'ensemble de votre boutique en ligne
          </p>
        </div>
        <div className="flex items-center gap-2">
          {storeUrl && isStoreEnabled && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
            >
              <ExternalLink className="w-4 h-4" />
              Voir la boutique
            </a>
          )}
          <button
            onClick={() => navigate('/ecom/store/setup')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Paramètres
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Store status banner */}
      {!isStoreEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Eye className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Boutique désactivée</p>
            <p className="text-xs text-amber-600 mt-0.5">Activez votre boutique dans les paramètres pour qu'elle soit visible.</p>
          </div>
          <button
            onClick={() => navigate('/ecom/store/setup')}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition"
          >
            Configurer
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Package className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Produits</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.productCount || 0}</p>
          <p className="text-xs text-gray-500 mt-1">{stats?.publishedProductCount || 0} publiés</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <ShoppingCart className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Commandes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalOrders || 0}</p>
          <p className="text-xs text-gray-500 mt-1">total</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Revenus</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalRevenue)}</p>
          <p className="text-xs text-gray-500 mt-1">{currency}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Panier moyen</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.totalOrders > 0 ? formatCurrency(Math.round(stats.totalRevenue / stats.totalOrders)) : '0'}
          </p>
          <p className="text-xs text-gray-500 mt-1">{currency}</p>
        </div>
      </div>

      {/* Status Breakdown */}
      {stats?.byStatus?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Commandes par statut</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.byStatus.map((s) => (
              <div key={s.status} className={`border rounded-lg p-3 ${getStatusColor(s.status)}`}>
                <p className="text-xs font-medium uppercase">{getStatusLabel(s.status)}</p>
                <p className="text-lg font-bold mt-1">{s.count}</p>
                <p className="text-xs mt-0.5">{formatCurrency(s.revenue)} {currency}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/ecom/store/products')}
          className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-emerald-300 hover:shadow-sm transition"
        >
          <Package className="w-5 h-5 text-emerald-600 mb-2" />
          <p className="text-sm font-semibold text-gray-900">Gérer les produits</p>
          <p className="text-xs text-gray-500 mt-0.5">Ajouter, modifier, publier</p>
        </button>
        <button
          onClick={() => navigate('/ecom/store/orders')}
          className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-emerald-300 hover:shadow-sm transition"
        >
          <ShoppingCart className="w-5 h-5 text-emerald-600 mb-2" />
          <p className="text-sm font-semibold text-gray-900">Voir les commandes</p>
          <p className="text-xs text-gray-500 mt-0.5">Gérer les commandes clients</p>
        </button>
        <button
          onClick={() => navigate('/ecom/store/setup')}
          className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-emerald-300 hover:shadow-sm transition"
        >
          <Eye className="w-5 h-5 text-emerald-600 mb-2" />
          <p className="text-sm font-semibold text-gray-900">Paramètres boutique</p>
          <p className="text-xs text-gray-500 mt-0.5">Branding, domaine, contact</p>
        </button>
      </div>
    </div>
  );
};

export default StoreAnalytics;
