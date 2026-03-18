import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  MapPin,
  Phone,
  Clock,
  ChevronRight,
  RefreshCw,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { livreurApi } from '../services/livreurApi.js';

export default function AvailableOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filterCity, setFilterCity] = useState('');
  const [search, setSearch] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 50 };
      if (filterCity.trim()) params.city = filterCity.trim();
      const res = await livreurApi.getAvailable(params);
      setOrders(res.data?.data || []);
    } catch {
      setError('Erreur lors du chargement des commandes.');
    } finally {
      setLoading(false);
    }
  }, [filterCity]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleAccept = async (orderId, e) => {
    e.stopPropagation();
    setAssigning(orderId);
    setError(null);
    try {
      await livreurApi.assignOrder(orderId);
      navigate('/ecom/livreur/deliveries');
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible d\'accepter cette course.');
    } finally {
      setAssigning(null);
    }
  };

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.clientName?.toLowerCase().includes(q) ||
      o.clientPhone?.includes(q) ||
      o.city?.toLowerCase().includes(q) ||
      o.address?.toLowerCase().includes(q) ||
      o.orderId?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Courses disponibles</h1>
          <button
            onClick={loadOrders}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
          >
            <RefreshCw size={18} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* City filter */}
        <div className="relative">
          <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filtrer par ville..."
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
            className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm outline-none"
          />
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Feedback */}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-green-700 text-sm">
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-red-600 text-sm">
            <XCircle size={18} />
            {error}
          </div>
        )}

        {/* Count */}
        <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
          {filtered.length} course{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={48} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Aucune course disponible</p>
            <p className="text-gray-400 text-sm mt-1">Revenez dans quelques instants</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <OrderAvailableCard
                key={order._id}
                order={order}
                onAccept={handleAccept}
                accepting={assigning === order._id}
                onView={() => navigate(`/ecom/livreur/delivery/${order._id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderAvailableCard({ order, onAccept, accepting, onView }) {
  const timeAgo = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `il y a ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    return `il y a ${Math.floor(hrs / 24)}j`;
  };

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      onClick={onView}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-xs font-mono text-gray-400">{order.orderId}</span>
            <h3 className="font-semibold text-gray-900 text-base mt-0.5">
              {order.clientName || 'Client'}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <Clock size={12} />
            {timeAgo(order.date || order.createdAt)}
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          {(order.address || order.city) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} className="text-indigo-400 shrink-0" />
              <span className="truncate">{order.address || order.city}</span>
            </div>
          )}
          {order.clientPhone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone size={14} className="text-indigo-400 shrink-0" />
              <span>{order.clientPhone}</span>
            </div>
          )}
          {order.product && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Package size={14} className="text-indigo-400 shrink-0" />
              <span className="truncate">{order.product}</span>
              {order.quantity && <span className="text-gray-400">x{order.quantity}</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => onAccept(order._id, e)}
            disabled={accepting}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-60 shadow-sm shadow-indigo-200"
          >
            {accepting ? 'Assignation...' : '✓ Accepter la course'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {order.price && (
        <div className="bg-indigo-50 px-4 py-2 border-t border-indigo-100">
          <p className="text-xs text-indigo-600 font-medium">
            Montant : {Number(order.price).toLocaleString('fr-FR')} FCFA
          </p>
        </div>
      )}
    </div>
  );
}
