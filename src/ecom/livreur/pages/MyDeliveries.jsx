import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck,
  MapPin,
  Phone,
  Package,
  ChevronRight,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useEcomAuth } from '../../hooks/useEcomAuth.jsx';
import { livreurApi } from '../services/livreurApi.js';

const STATUS_CONFIG = {
  confirmed: {
    label: 'Acceptée',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
    next: 'Confirmer la récupération',
    nextAction: 'pickup_confirmed',
    nextColor: 'bg-amber-500',
  },
  shipped: {
    label: 'En transit',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dot: 'bg-indigo-500',
    next: 'Marquer comme livré',
    nextAction: 'delivered',
    nextColor: 'bg-green-600',
  },
};

export default function MyDeliveries() {
  const { user } = useEcomAuth();
  const navigate = useNavigate();
  const localUser = user || JSON.parse(localStorage.getItem('ecomUser') || 'null');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // all | confirmed | shipped

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await livreurApi.getMyDeliveries(localUser?._id);
      const data = res.data?.data || [];
      // Keep only active deliveries
      setOrders(data.filter((o) => ['confirmed', 'shipped'].includes(o.status)));
    } catch {
      setError('Erreur lors du chargement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filtered =
    activeTab === 'all'
      ? orders
      : orders.filter((o) => o.status === activeTab);

  const tabs = [
    { id: 'all', label: 'Toutes', count: orders.length },
    { id: 'confirmed', label: 'Acceptées', count: orders.filter((o) => o.status === 'confirmed').length },
    { id: 'shipped', label: 'En transit', count: orders.filter((o) => o.status === 'shipped').length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-0 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Mes livraisons</h1>
          <button
            onClick={loadOrders}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95"
          >
            <RefreshCw size={18} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Truck size={48} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Aucune livraison active</p>
            <Link
              to="/ecom/livreur/available"
              className="mt-3 text-indigo-600 text-sm font-medium"
            >
              Accepter une course →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <ActiveDeliveryCard
                key={order._id}
                order={order}
                onClick={() => navigate(`/ecom/livreur/delivery/${order._id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveDeliveryCard({ order, onClick }) {
  const config = STATUS_CONFIG[order.status] || {
    label: order.status,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-400',
  };

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${config.color}`}>
              {config.label}
            </span>
          </div>
          <span className="text-xs font-mono text-gray-400">{order.orderId}</span>
        </div>
        <ChevronRight size={18} className="text-gray-300 mt-1" />
      </div>

      <h3 className="font-semibold text-gray-900 mb-2">
        {order.clientName || order.clientPhone}
      </h3>

      <div className="space-y-1.5">
        {(order.address || order.city) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={13} className="text-indigo-400 shrink-0" />
            <span className="truncate">{order.address || order.city}</span>
          </div>
        )}
        {order.clientPhone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone size={13} className="text-indigo-400 shrink-0" />
            {order.clientPhone}
          </div>
        )}
        {order.product && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Package size={13} className="text-indigo-400 shrink-0" />
            <span className="truncate">{order.product}</span>
          </div>
        )}
      </div>

      {config.next && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 font-medium">
            Prochaine action : <span className="text-gray-600">{config.next}</span>
          </p>
        </div>
      )}
    </button>
  );
}
