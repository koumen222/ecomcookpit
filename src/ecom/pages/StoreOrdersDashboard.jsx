import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Search, ChevronLeft, ChevronRight, Loader2, AlertCircle, Phone, MapPin, Clock } from 'lucide-react';
import { storeOrdersApi } from '../services/storeApi.js';

/**
 * StoreOrdersDashboard — Manage public store orders.
 * Features: pagination, status filter, status update, search.
 */

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'processing', label: 'En traitement' },
  { value: 'shipped', label: 'Expédiées' },
  { value: 'delivered', label: 'Livrées' },
  { value: 'cancelled', label: 'Annulées' }
];

const STATUS_COLORS = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-blue-50 text-blue-700',
  processing: 'bg-indigo-50 text-indigo-700',
  shipped: 'bg-purple-50 text-purple-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700'
};

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'En traitement',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée'
};

const StoreOrdersDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchOrders = useCallback(async (page = 1, status = '', searchTerm = '') => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (status) params.status = status;
      if (searchTerm) params.search = searchTerm;
      const res = await storeOrdersApi.getOrders(params);
      const data = res.data?.data;
      setOrders(data?.orders || []);
      setPagination(data?.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch {
      setError('Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(1, statusFilter, '');
  }, [fetchOrders, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders(1, statusFilter, search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, statusFilter, fetchOrders]);

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      await storeOrdersApi.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o =>
        o._id === orderId ? { ...o, status: newStatus } : o
      ));
    } catch {
      setError('Erreur lors de la mise à jour du statut');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatPrice = (amount, currency = 'XAF') => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + currency;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-emerald-600" />
          Commandes Boutique
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{pagination.total} commande{pagination.total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone, n° commande..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === opt.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500 mt-3 text-sm">Aucune commande</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order._id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              {/* Order header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{order.orderNumber}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                  {formatPrice(order.total, order.currency)}
                </span>
              </div>

              {/* Customer info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                <span className="font-medium">{order.customerName}</span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <a href={`tel:${order.phone}`} className="text-emerald-600 hover:underline">{order.phone}</a>
                </span>
                {order.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {order.city}
                  </span>
                )}
              </div>

              {/* Products */}
              <div className="flex flex-wrap gap-2">
                {order.products?.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                    {p.image && (
                      <img src={p.image} alt={p.name} className="w-6 h-6 rounded object-cover" loading="lazy" />
                    )}
                    <span className="text-xs text-gray-700">{p.name} x{p.quantity}</span>
                    <span className="text-xs text-gray-400">{formatPrice(p.price * p.quantity, order.currency)}</span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {order.notes && (
                <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg p-2">{order.notes}</p>
              )}

              {/* Status change */}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <span className="text-xs text-gray-500">Changer le statut:</span>
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order._id, e.target.value)}
                  disabled={updatingId === order._id}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="pending">En attente</option>
                  <option value="confirmed">Confirmée</option>
                  <option value="processing">En traitement</option>
                  <option value="shipped">Expédiée</option>
                  <option value="delivered">Livrée</option>
                  <option value="cancelled">Annulée</option>
                </select>
                {updatingId === order._id && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}

                {/* WhatsApp link */}
                {order.phone && (
                  <a
                    href={`https://wa.me/${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${order.customerName}, votre commande ${order.orderNumber} est ${STATUS_LABELS[order.status]?.toLowerCase() || order.status}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {pagination.page} sur {pagination.pages}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOrders(pagination.page - 1, statusFilter, search)}
              disabled={pagination.page <= 1}
              className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchOrders(pagination.page + 1, statusFilter, search)}
              disabled={pagination.page >= pagination.pages}
              className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreOrdersDashboard;
