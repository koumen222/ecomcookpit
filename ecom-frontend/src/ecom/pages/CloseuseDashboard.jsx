import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

/* ─── Constantes ──────────────────────────────────────────────── */
const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  returned: 'Retour',
  cancelled: 'Annulée',
  unreachable: 'Injoignable',
  called: 'Appelée',
  postponed: 'Reportée',
};

const STATUS_META = {
  delivered:   { bg: '#dcfce7', text: '#15803d', bar: '#22c55e', icon: '✅' },
  confirmed:   { bg: '#dbeafe', text: '#1d4ed8', bar: '#3b82f6', icon: '✔️' },
  pending:     { bg: '#fef9c3', text: '#a16207', bar: '#eab308', icon: '⏳' },
  shipped:     { bg: '#e0e7ff', text: '#4338ca', bar: '#6366f1', icon: '🚚' },
  called:      { bg: '#f3e8ff', text: '#7e22ce', bar: '#a855f7', icon: '📞' },
  postponed:   { bg: '#fce7f3', text: '#be185d', bar: '#ec4899', icon: '📅' },
  unreachable: { bg: '#f1f5f9', text: '#475569', bar: '#94a3b8', icon: '📵' },
  returned:    { bg: '#ffedd5', text: '#c2410c', bar: '#f97316', icon: '↩️' },
  cancelled:   { bg: '#fee2e2', text: '#b91c1c', bar: '#ef4444', icon: '❌' },
};

const STATUS_ORDER = [
  'delivered', 'confirmed', 'pending', 'shipped',
  'called', 'postponed', 'unreachable', 'returned', 'cancelled',
];

/* ─── Badge de performance ───────────────────────────────────── */
const getBadge = (rate) => {
  if (rate >= 80) return { emoji: '🏆', label: 'Champion',       grad: 'linear-gradient(135deg,#f59e0b,#ef4444)', msg: 'Performance exceptionnelle !' };
  if (rate >= 60) return { emoji: '🥇', label: 'Expert',         grad: 'linear-gradient(135deg,#22c55e,#16a34a)', msg: 'Excellent travail, continuez !' };
  if (rate >= 40) return { emoji: '🥈', label: 'Confirmée',      grad: 'linear-gradient(135deg,#3b82f6,#0ea5e9)', msg: 'Bonne progression, encore un effort !' };
  if (rate >= 20) return { emoji: '🥉', label: 'En progression', grad: 'linear-gradient(135deg,#8b5cf6,#a855f7)', msg: 'Vous progressez, continuez !' };
  return          { emoji: '🌱', label: 'Débutante',             grad: 'linear-gradient(135deg,#64748b,#94a3b8)', msg: 'Chaque livraison compte !' };
};

/* ─── Composants UI légers ───────────────────────────────────── */
const KpiCard = ({ label, value, sub, gradient, labelColor, valueColor, subColor }) => (
  <div style={{
    background: gradient || '#fff',
    borderRadius: 20,
    padding: '16px 18px',
    boxShadow: '0 1px 6px rgba(0,0,0,.06)',
    border: '1px solid rgba(0,0,0,.06)',
    transition: 'transform .15s, box-shadow .15s',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.10)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,.06)'; }}
  >
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: labelColor || '#9ca3af', margin: 0 }}>{label}</p>
    <p style={{ fontSize: 34, fontWeight: 900, color: valueColor || '#111827', margin: '4px 0 2px', lineHeight: 1 }}>{value}</p>
    <p style={{ fontSize: 11, color: subColor || '#9ca3af', margin: 0 }}>{sub}</p>
  </div>
);

/* ─── Écran sans workspace ───────────────────────────────────── */
const NoWorkspace = ({ user }) => (
  <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
    <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>🏢</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Aucun espace configuré</h2>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        {user?.role === 'ecom_admin'
          ? 'Créez votre propre espace pour commencer à utiliser Ecom Cockpit.'
          : 'Rejoignez une équipe existante pour accéder aux données partagées.'}
      </p>
      <Link to="/ecom/workspace-setup" style={{ display: 'block', padding: '13px 0', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: '#fff', borderRadius: 12, fontWeight: 700, textDecoration: 'none', marginBottom: 12, fontSize: 15 }}>
        Créer un espace
      </Link>
      {user?.role !== 'ecom_admin' && (
        <p style={{ fontSize: 12, color: '#9ca3af', background: '#f1f5f9', borderRadius: 10, padding: '10px 14px' }}>
          Pour rejoindre une équipe, demandez un lien d'invitation à votre administrateur.
        </p>
      )}
    </div>
  </div>
);

/* ─── Loader ─────────────────────────────────────────────────── */
const Loader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, flexDirection: 'column', gap: 16 }}>
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      border: '4px solid #e5e7eb', borderTopColor: '#22c55e',
      animation: 'spin .8s linear infinite',
    }} />
    <p style={{ color: '#6b7280', fontSize: 14, fontWeight: 500 }}>Chargement du dashboard…</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   CloseuseDashboard
═══════════════════════════════════════════════════════════════ */
const CloseuseDashboard = () => {
  const { user } = useEcomAuth();
  const [loading, setLoading]         = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);
  const [allOrders, setAllOrders]     = useState([]);
  const [weekOrders, setWeekOrders]   = useState([]);
  const [stats, setStats]             = useState({
    total: 0, delivered: 0, confirmed: 0, pending: 0,
    cancelled: 0, returned: 0, unreachable: 0, called: 0,
    postponed: 0, shipped: 0, deliveryRate: 0,
    todayDelivered: 0, todayTotal: 0,
  });

  /* Guard : pas de workspace */
  if (!user?.workspaceId) return <NoWorkspace user={user} />;

  /* ── Data loading ──────────────────────────────────────────── */
  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const today   = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const [ordersRes, weekRes] = await Promise.all([
        ecomApi.get('/orders?limit=200'),
        ecomApi.get(`/orders?limit=500&startDate=${weekAgo}&endDate=${today}`),
      ]);
      const orders = ordersRes.data.data.orders || [];
      const week   = weekRes.data.data.orders   || [];
      setAllOrders(orders);
      setWeekOrders(week);
      setRecentOrders(orders.slice(0, 8));

      const countBy = (arr, key) => arr.filter(o => o.status === key).length;
      const total     = orders.length;
      const delivered = countBy(orders, 'delivered');
      const todayOrders = orders.filter(o => new Date(o.date).toISOString().split('T')[0] === today);
      setStats({
        total, delivered,
        confirmed:   countBy(orders, 'confirmed'),
        pending:     countBy(orders, 'pending'),
        cancelled:   countBy(orders, 'cancelled'),
        returned:    countBy(orders, 'returned'),
        unreachable: countBy(orders, 'unreachable'),
        called:      countBy(orders, 'called'),
        postponed:   countBy(orders, 'postponed'),
        shipped:     countBy(orders, 'shipped'),
        deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        todayDelivered: todayOrders.filter(o => o.status === 'delivered').length,
        todayTotal:  todayOrders.length,
      });
    } catch (err) {
      console.error('Erreur chargement dashboard closeuse:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Calculs dérivés ───────────────────────────────────────── */
  const buildDailyTrend = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
      const dayOrders = weekOrders.filter(o => new Date(o.date).toISOString().split('T')[0] === key);
      return { label, total: dayOrders.length, delivered: dayOrders.filter(o => o.status === 'delivered').length, isToday: i === 6 };
    });
  };

  const buildTopProducts = () => {
    const map = {};
    allOrders.filter(o => o.status === 'delivered').forEach(o => {
      const name = o.product || 'Inconnu';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  if (loading) return <Loader />;

  const badge       = getBadge(stats.deliveryRate);
  const dailyTrend  = buildDailyTrend();
  const topProducts = buildTopProducts();
  const maxDayTotal = Math.max(...dailyTrend.map(d => d.total), 1);
  const maxProduct  = topProducts[0]?.[1] || 1;

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '16px', maxWidth: 900, margin: '0 auto' }}>

      {/* ── En-tête ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111827', margin: 0 }}>Mon Dashboard 👩‍💼</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 13 }}>
            Bienvenue <strong style={{ color: '#374151' }}>{user?.name?.split(' ')[0] || user?.email}</strong>
          </p>
        </div>
        {/* Badge */}
        <div style={{
          background: badge.grad, color: '#fff', borderRadius: 16, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 14px rgba(0,0,0,.18)',
        }}>
          <span style={{ fontSize: 28 }}>{badge.emoji}</span>
          <div>
            <p style={{ fontWeight: 800, margin: 0, fontSize: 15, lineHeight: 1.2 }}>{badge.label}</p>
            <p style={{ margin: 0, fontSize: 11, opacity: .85 }}>{badge.msg}</p>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard
          label="Total commandes" value={stats.total} sub="dans votre historique"
          gradient="#fff" valueColor="#111827"
        />
        <KpiCard
          label="Livrées ✅" value={stats.delivered} sub={`Taux : ${stats.deliveryRate}%`}
          gradient="linear-gradient(135deg,#dcfce7,#bbf7d0)"
          labelColor="#16a34a" valueColor="#15803d" subColor="#22c55e"
        />
        <KpiCard
          label="Aujourd'hui 📅" value={stats.todayDelivered} sub={`/ ${stats.todayTotal} reçues`}
          gradient="linear-gradient(135deg,#dbeafe,#bfdbfe)"
          labelColor="#1d4ed8" valueColor="#1d4ed8" subColor="#3b82f6"
        />
        <KpiCard
          label="En attente ⏳" value={stats.pending} sub="à traiter"
          gradient="linear-gradient(135deg,#fef9c3,#fde68a)"
          labelColor="#a16207" valueColor="#854d0e" subColor="#ca8a04"
        />
      </div>

      {/* ── Taux de livraison ────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', border: '1px solid rgba(0,0,0,.06)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontWeight: 700, color: '#1f2937', margin: 0, fontSize: 15 }}>🎯 Taux de livraison global</h3>
          <span style={{ fontSize: 26, fontWeight: 900, color: stats.deliveryRate >= 60 ? '#16a34a' : stats.deliveryRate >= 30 ? '#d97706' : '#dc2626' }}>
            {stats.deliveryRate}%
          </span>
        </div>
        <div style={{ background: '#f1f5f9', borderRadius: 99, height: 14, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            height: '100%', borderRadius: 99, transition: 'width .8s cubic-bezier(.4,0,.2,1)',
            width: `${stats.deliveryRate}%`,
            background: stats.deliveryRate >= 60
              ? 'linear-gradient(90deg,#22c55e,#16a34a)'
              : stats.deliveryRate >= 30
              ? 'linear-gradient(90deg,#f59e0b,#f97316)'
              : 'linear-gradient(90deg,#ef4444,#f97316)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
          <span>0%</span><span>Objectif : 60%</span><span>100%</span>
        </div>
      </div>

      {/* ── Répartition par statut ───────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', border: '1px solid rgba(0,0,0,.06)', marginBottom: 16 }}>
        <h3 style={{ fontWeight: 700, color: '#1f2937', margin: '0 0 16px', fontSize: 15 }}>📊 Répartition par statut</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STATUS_ORDER.map(s => {
            const count = stats[s] || 0;
            const pct   = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            const meta  = STATUS_META[s] || { bg: '#f1f5f9', text: '#475569', bar: '#94a3b8', icon: '•' };
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, width: 90, flexShrink: 0, color: meta.text }}>{STATUS_LABELS[s]}</span>
                <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: meta.bar, width: `${pct}%`, transition: 'width .6s ease' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', width: 28, textAlign: 'right' }}>{count}</span>
                <span style={{ fontSize: 11, color: '#9ca3af', width: 32, textAlign: 'right' }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tendance 7 jours ─────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', border: '1px solid rgba(0,0,0,.06)', marginBottom: 16 }}>
        <h3 style={{ fontWeight: 700, color: '#1f2937', margin: '0 0 16px', fontSize: 15 }}>📈 Activité des 7 derniers jours</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
          {dailyTrend.map((day, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 76, gap: 2 }}>
                {/* barre livrées */}
                <div style={{
                  width: '100%', background: '#22c55e', borderRadius: '4px 4px 0 0',
                  height: `${(day.delivered / maxDayTotal) * 76}px`,
                  transition: 'height .5s ease', minHeight: day.delivered > 0 ? 3 : 0,
                }} title={`${day.delivered} livrées`} />
                {/* barre autres */}
                <div style={{
                  width: '100%', background: '#bfdbfe', borderRadius: day.delivered === 0 ? '4px 4px 0 0' : 0,
                  height: `${((day.total - day.delivered) / maxDayTotal) * 76}px`,
                  transition: 'height .5s ease', minHeight: (day.total - day.delivered) > 0 ? 3 : 0,
                }} title={`${day.total - day.delivered} autres`} />
              </div>
              <span style={{ fontSize: 10, fontWeight: day.isToday ? 700 : 500, color: day.isToday ? '#3b82f6' : '#9ca3af', textAlign: 'center' }}>
                {day.label}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#6b7280' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, background: '#22c55e', borderRadius: 3, display: 'inline-block' }} /> Livrées</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, background: '#bfdbfe', borderRadius: 3, display: 'inline-block' }} /> Autres</span>
        </div>
      </div>

      {/* ── Top produits + Commandes récentes ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginBottom: 20 }}>

        {/* Top produits */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', border: '1px solid rgba(0,0,0,.06)' }}>
          <h3 style={{ fontWeight: 700, color: '#1f2937', margin: '0 0 16px', fontSize: 15 }}>🏅 Top produits livrés</h3>
          {topProducts.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0', fontSize: 13 }}>Aucune livraison encore</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topProducts.map(([name, count], i) => {
                const medals = ['🥇','🥈','🥉'];
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{medals[i] || `${i+1}.`}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                      <div style={{ background: '#f1f5f9', borderRadius: 99, height: 6 }}>
                        <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#22c55e,#16a34a)', width: `${(count / maxProduct) * 100}%`, transition: 'width .6s ease' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Commandes récentes */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', border: '1px solid rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, color: '#1f2937', margin: 0, fontSize: 15 }}>🕐 Commandes récentes</h3>
            <Link to="/ecom/orders" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>Voir tout →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0', fontSize: 13 }}>Aucune commande</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentOrders.slice(0, 6).map(order => {
                const meta = STATUS_META[order.status] || { bg: '#f1f5f9', text: '#475569' };
                return (
                  <div key={order._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, transition: 'background .15s', cursor: 'default' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.clientName || order.clientPhone}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.product}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: meta.bg, color: meta.text, flexShrink: 0 }}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Actions rapides ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
        {[
          { to: '/ecom/orders',      emoji: '📦', label: 'Mes commandes',  sub: 'Gérer le statut',    hoverBorder: '#3b82f6' },
          { to: '/ecom/reports/new', emoji: '📝', label: 'Rapport du jour', sub: 'Saisir mes résultats', hoverBorder: '#22c55e' },
          { to: '/ecom/campaigns',   emoji: '📣', label: 'Campagnes',      sub: 'Marketing',           hoverBorder: '#ec4899' },
        ].map(({ to, emoji, label, sub, hoverBorder }) => (
          <Link key={to} to={to} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.05)', textDecoration: 'none', transition: 'box-shadow .2s, border-color .2s, transform .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = hoverBorder; e.currentTarget.style.boxShadow = `0 4px 14px rgba(0,0,0,.10)`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.05)'; e.currentTarget.style.transform = ''; }}
          >
            <span style={{ fontSize: 26 }}>{emoji}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{sub}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
};

export default CloseuseDashboard;
