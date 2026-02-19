import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée',
  delivered: 'Livrée', returned: 'Retour', cancelled: 'Annulée',
  unreachable: 'Injoignable', called: 'Appelée', postponed: 'Reportée'
};
const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-400' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-400' },
  shipped: { bg: 'bg-indigo-100', text: 'text-indigo-700', bar: 'bg-indigo-400' },
  delivered: { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
  returned: { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-400' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-400' },
  unreachable: { bg: 'bg-gray-100', text: 'text-gray-600', bar: 'bg-gray-400' },
  called: { bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-400' },
  postponed: { bg: 'bg-pink-100', text: 'text-pink-700', bar: 'bg-pink-400' },
};

const getBadge = (rate) => {
  if (rate >= 80) return { label: '🏆 Champion', color: 'from-yellow-400 to-orange-400', msg: 'Performance exceptionnelle ! Continuez comme ça !' };
  if (rate >= 60) return { label: '🥇 Expert', color: 'from-green-400 to-emerald-500', msg: 'Très bon travail, vous êtes au top !' };
  if (rate >= 40) return { label: '🥈 Confirmée', color: 'from-blue-400 to-cyan-500', msg: 'Bonne progression, encore un effort !' };
  if (rate >= 20) return { label: '🥉 En progression', color: 'from-purple-400 to-violet-500', msg: 'Vous progressez bien, continuez !' };
  return { label: '🌱 Débutante', color: 'from-gray-400 to-slate-500', msg: 'Chaque commande livrée compte !' };
};

const CloseuseDashboard = () => {
  const { user } = useEcomAuth();
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [weekOrders, setWeekOrders] = useState([]);
  const [myAssignments, setMyAssignments] = useState({ orderSources: [], productAssignments: [] });
  const [stats, setStats] = useState({
    total: 0, delivered: 0, confirmed: 0, pending: 0,
    cancelled: 0, returned: 0, unreachable: 0, called: 0, postponed: 0, shipped: 0,
    deliveryRate: 0, todayDelivered: 0, todayTotal: 0,
  });

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const [ordersRes, weekRes, assignmentsRes] = await Promise.all([
        ecomApi.get('/orders?limit=200'),
        ecomApi.get(`/orders?limit=500&startDate=${weekAgo}&endDate=${today}`),
        ecomApi.get('/assignments/my-assignments'),
      ]);
      const orders = ordersRes.data.data.orders || [];
      const week = weekRes.data.data.orders || [];
      setMyAssignments(assignmentsRes.data.data || {});
      setAllOrders(orders);
      setWeekOrders(week);
      setRecentOrders(orders.slice(0, 8));
      const countBy = (arr, key) => arr.filter(o => o.status === key).length;
      const total = orders.length;
      const delivered = countBy(orders, 'delivered');
      const todayOrders = orders.filter(o => new Date(o.date).toISOString().split('T')[0] === today);
      setStats({
        total, delivered,
        confirmed: countBy(orders, 'confirmed'),
        pending: countBy(orders, 'pending'),
        cancelled: countBy(orders, 'cancelled'),
        returned: countBy(orders, 'returned'),
        unreachable: countBy(orders, 'unreachable'),
        called: countBy(orders, 'called'),
        postponed: countBy(orders, 'postponed'),
        shipped: countBy(orders, 'shipped'),
        deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        todayDelivered: todayOrders.filter(o => o.status === 'delivered').length,
        todayTotal: todayOrders.length,
      });
    } catch (error) {
      console.error('Erreur chargement dashboard closeuse:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildDailyTrend = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
      const dayOrders = weekOrders.filter(o => new Date(o.date).toISOString().split('T')[0] === key);
      days.push({ label, total: dayOrders.length, delivered: dayOrders.filter(o => o.status === 'delivered').length, isToday: i === 0 });
    }
    return days;
  };

  const buildTopProducts = () => {
    const map = {};
    allOrders.filter(o => o.status === 'delivered').forEach(o => {
      const name = o.product || 'Inconnu';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  const badge = getBadge(stats.deliveryRate);
  const dailyTrend = buildDailyTrend();
  const topProducts = buildTopProducts();
  const maxDayTotal = Math.max(...dailyTrend.map(d => d.total), 1);
  const maxProduct = topProducts[0]?.[1] || 1;
  const statusOrder = ['delivered','confirmed','pending','shipped','called','postponed','unreachable','returned','cancelled'];

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-5">

      {/* ── Header + Badge ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mon Dashboard 👩‍💼</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Bienvenue <strong>{user?.name?.split(' ')[0] || user?.email}</strong></p>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-gradient-to-r ${badge.color} text-white shadow-md self-start sm:self-auto`}>
          <span className="text-lg sm:text-xl">{badge.label.split(' ')[0]}</span>
          <div>
            <p className="font-bold text-xs sm:text-sm leading-none">{badge.label.split(' ').slice(1).join(' ')}</p>
            <p className="text-[10px] sm:text-xs text-white/80 mt-0.5">{badge.msg}</p>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 active:scale-[0.98] transition-transform">
          <p className="text-[10px] sm:text-xs text-gray-400 font-semibold uppercase tracking-wide">Total</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-0.5 sm:mt-1">{stats.total}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">commandes</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-sm border border-green-100 p-3 sm:p-4 active:scale-[0.98] transition-transform">
          <p className="text-[10px] sm:text-xs text-green-600 font-semibold uppercase tracking-wide">Livrées ✅</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-green-700 mt-0.5 sm:mt-1">{stats.delivered}</p>
          <p className="text-[10px] sm:text-xs text-green-500 mt-0.5">taux : {stats.deliveryRate}%</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-sm border border-blue-100 p-3 sm:p-4 active:scale-[0.98] transition-transform">
          <p className="text-[10px] sm:text-xs text-blue-600 font-semibold uppercase tracking-wide">Aujourd'hui</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-blue-700 mt-0.5 sm:mt-1">{stats.todayDelivered}</p>
          <p className="text-[10px] sm:text-xs text-blue-400 mt-0.5">/ {stats.todayTotal} reçues</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl shadow-sm border border-yellow-100 p-3 sm:p-4 active:scale-[0.98] transition-transform">
          <p className="text-[10px] sm:text-xs text-yellow-600 font-semibold uppercase tracking-wide">En attente ⏳</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-yellow-700 mt-0.5 sm:mt-1">{stats.pending}</p>
          <p className="text-[10px] sm:text-xs text-yellow-400 mt-0.5">à traiter</p>
        </div>
      </div>

      {/* ── Taux de livraison (jauge) ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">🎯 Taux de livraison global</h3>
          <span className="text-2xl font-extrabold text-green-600">{stats.deliveryRate}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
          <div
            className="h-4 rounded-full transition-all duration-700"
            style={{
              width: `${stats.deliveryRate}%`,
              background: stats.deliveryRate >= 60
                ? 'linear-gradient(90deg,#22c55e,#10b981)'
                : stats.deliveryRate >= 30
                ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                : 'linear-gradient(90deg,#ef4444,#f97316)'
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0%</span><span>Objectif 60%</span><span>100%</span>
        </div>
      </div>

      {/* ── Répartition par statut ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <h3 className="font-semibold text-gray-800 mb-4">📊 Répartition par statut</h3>
        <div className="space-y-2.5">
          {statusOrder.map(s => {
            const count = stats[s] || 0;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            const c = STATUS_COLORS[s] || { bg: 'bg-gray-100', text: 'text-gray-600', bar: 'bg-gray-400' };
            return (
              <div key={s} className="flex items-center gap-3">
                <span className={`text-xs font-medium w-24 shrink-0 ${c.text}`}>{STATUS_LABELS[s]}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-2.5 rounded-full ${c.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-700 w-8 text-right">{count}</span>
                <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tendance 7 jours ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <h3 className="font-semibold text-gray-800 mb-4">📈 Activité des 7 derniers jours</h3>
        <div className="flex items-end gap-2 h-28">
          {dailyTrend.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '80px' }}>
                <div
                  className="w-full rounded-t bg-green-400 transition-all duration-500"
                  style={{ height: `${maxDayTotal > 0 ? (day.delivered / maxDayTotal) * 80 : 0}px` }}
                  title={`${day.delivered} livrées`}
                />
                <div
                  className="w-full bg-blue-200 transition-all duration-500"
                  style={{ height: `${maxDayTotal > 0 ? ((day.total - day.delivered) / maxDayTotal) * 80 : 0}px` }}
                  title={`${day.total - day.delivered} autres`}
                />
              </div>
              <span className={`text-[10px] font-medium ${day.isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                {day.label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400 inline-block" /> Livrées</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 inline-block" /> Autres</span>
        </div>
      </div>

      {/* ── Top produits + Commandes récentes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">

        {/* Top produits livrés */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
          <h3 className="font-semibold text-gray-800 mb-4">🏅 Top produits livrés</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Aucune livraison encore</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-300 w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                      <div className="h-1.5 rounded-full bg-green-400" style={{ width: `${(count / maxProduct) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-green-600 shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commandes récentes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">🕐 Commandes récentes</h3>
            <Link to="/ecom/orders" className="text-xs text-blue-500 hover:underline">Voir tout →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Aucune commande</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.slice(0, 6).map(order => {
                const c = STATUS_COLORS[order.status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
                return (
                  <div key={order._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{order.clientName || order.clientPhone}</p>
                      <p className="text-xs text-gray-400 truncate">{order.product}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${c.bg} ${c.text}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Actions rapides ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <Link to="/ecom/orders" className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition">
          <span className="text-2xl">📦</span>
          <div><p className="font-semibold text-sm text-gray-800">Mes commandes</p><p className="text-xs text-gray-400">Gérer le statut</p></div>
        </Link>
        <Link to="/ecom/reports/new" className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-green-200 transition">
          <span className="text-2xl">📝</span>
          <div><p className="font-semibold text-sm text-gray-800">Rapport du jour</p><p className="text-xs text-gray-400">Saisir mes résultats</p></div>
        </Link>
        <Link to="/ecom/campaigns" className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-pink-200 transition">
          <span className="text-2xl">📣</span>
          <div><p className="font-semibold text-sm text-gray-800">Campagnes</p><p className="text-xs text-gray-400">Marketing</p></div>
        </Link>
      </div>

    </div>
  );
};

export default CloseuseDashboard;
