import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ChevronRight,
  RefreshCw,
  MapPin,
  Bell,
} from 'lucide-react';
import { useEcomAuth } from '../../hooks/useEcomAuth.jsx';
import { livreurApi } from '../services/livreurApi.js';

const statusLabel = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmé', color: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'En transit', color: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Livré', color: 'bg-green-100 text-green-800' },
  returned: { label: 'Retour', color: 'bg-orange-100 text-orange-800' },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800' },
};

export default function LivreurHome() {
  const { user } = useEcomAuth();
  const navigate = useNavigate();
  const localUser = user || JSON.parse(localStorage.getItem('ecomUser') || 'null');

  const [stats, setStats] = useState(null);
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, deliveriesRes] = await Promise.all([
        livreurApi.getStats(),
        livreurApi.getMyDeliveries(localUser?._id),
      ]);
      setStats(statsRes.data?.data || null);
      const all = deliveriesRes.data?.data || [];
      setRecentDeliveries(all.slice(0, 3));
    } catch (err) {
      setError('Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const firstName = localUser?.name?.split(' ')[0] || 'Livreur';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-indigo-200 text-sm">{greeting},</p>
            <h1 className="text-white text-2xl font-bold">{firstName} 👋</h1>
          </div>
          <button
            onClick={loadData}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <StatCard
            icon={<Package size={18} />}
            label="Disponibles"
            value={stats?.available ?? '—'}
            color="bg-white/10"
            textColor="text-white"
            onClick={() => navigate('/ecom/livreur/available')}
          />
          <StatCard
            icon={<Truck size={18} />}
            label="En cours"
            value={stats?.inProgress ?? '—'}
            color="bg-white/10"
            textColor="text-white"
            onClick={() => navigate('/ecom/livreur/deliveries')}
          />
          <StatCard
            icon={<CheckCircle2 size={18} />}
            label="Ce mois"
            value={stats?.thisMonth?.delivered ?? '—'}
            color="bg-white/10"
            textColor="text-white"
            onClick={() => navigate('/ecom/livreur/history')}
          />
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* CTA - Commandes disponibles */}
        <div
          className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform shadow-md"
          onClick={() => navigate('/ecom/livreur/available')}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <Bell size={22} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">
                {stats?.available
                  ? `${stats.available} course${stats.available > 1 ? 's' : ''} disponible${stats.available > 1 ? 's' : ''}`
                  : 'Voir les courses'}
              </p>
              <p className="text-emerald-100 text-xs">Accepter une nouvelle livraison</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-white/70" />
        </div>

        {/* Livraisons récentes */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 text-lg">Mes livraisons</h2>
            <Link
              to="/ecom/livreur/deliveries"
              className="text-sm text-indigo-600 font-medium"
            >
              Tout voir
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentDeliveries.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border border-dashed border-gray-200">
              <Truck size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Aucune livraison en cours</p>
              <Link
                to="/ecom/livreur/available"
                className="mt-3 inline-block text-indigo-600 text-sm font-medium"
              >
                Accepter une course →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDeliveries.map((order) => (
                <DeliveryCard key={order._id} order={order} />
              ))}
            </div>
          )}
        </section>

        {/* Gains rapides */}
        {stats && (
          <section>
            <h2 className="font-semibold text-gray-800 text-lg mb-3">Mes gains</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Ce mois</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">
                    {stats.thisMonth?.amount?.toLocaleString('fr-FR') || 0} FCFA
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Total</p>
                  <p className="text-lg font-semibold text-indigo-600 mt-0.5">
                    {stats.allTime?.amount?.toLocaleString('fr-FR') || 0} FCFA
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                <span className="text-gray-500">{stats.thisWeek?.delivered || 0} livraisons cette semaine</span>
                <Link to="/ecom/livreur/earnings" className="text-indigo-600 font-medium">
                  Détails →
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, textColor, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`${color} rounded-xl p-3 flex flex-col items-center gap-1 w-full active:scale-95 transition-transform`}
    >
      <span className={textColor}>{icon}</span>
      <span className={`text-xl font-bold ${textColor}`}>{value}</span>
      <span className={`text-[10px] ${textColor} opacity-80 leading-tight text-center`}>{label}</span>
    </button>
  );
}

function DeliveryCard({ order }) {
  const st = statusLabel[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600' };
  return (
    <Link
      to={`/ecom/livreur/delivery/${order._id}`}
      className="flex items-center gap-3 bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
        <Truck size={18} className="text-indigo-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm truncate">
          {order.clientName || order.clientPhone}
        </p>
        <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
          <MapPin size={11} />
          <span className="truncate">{order.address || order.city || 'Adresse non renseignée'}</span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
          {st.label}
        </span>
        <ChevronRight size={14} className="text-gray-300" />
      </div>
    </Link>
  );
}
