import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import api from '../../lib/api';
import { storeManageApi } from '../services/storeApi.js';
import StoreCreationWizard from './StoreCreationWizard.jsx';

const StatCard = ({ label, value, sub, icon, color }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
        <span style={{ color }}>{icon}</span>
      </div>
    </div>
    <p className="text-2xl font-black text-gray-900">{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
);

const BoutiqueDashboard = () => {
  const { workspace } = useEcomAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);
  const [hasStore, setHasStore] = useState(null); // null=loading, true/false
  const [storeUrl, setStoreUrl] = useState(null);

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n || 0);
  const currency = workspace?.storeSettings?.storeCurrency || 'XAF';

  useEffect(() => {
    const load = async () => {
      try {
        // Check if store exists
        const configRes = await storeManageApi.getStoreConfig().catch(() => null);
        const subdomain = configRes?.data?.data?.subdomain;
        const storeUrlFromApi = configRes?.data?.data?.storeUrl;
        setHasStore(!!subdomain);
        
        if (storeUrlFromApi) {
          setStoreUrl(storeUrlFromApi);
        } else if (subdomain) {
          setStoreUrl(`https://${subdomain}.scalor.net`);
        }

        if (!subdomain) { setLoading(false); return; }

        const [statsRes, ordersRes] = await Promise.all([
          api.get('/store/analytics/summary').catch(() => ({ data: {} })),
          api.get('/store/orders?limit=5&sort=-createdAt').catch(() => ({ data: { data: { orders: [] } } })),
        ]);
        setStats(statsRes.data?.data || statsRes.data || {});
        setRecentOrders(ordersRes.data?.data?.orders || []);
      } catch {
        setHasStore(true); // assume store exists on error to not block
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Show wizard if no store configured
  if (!loading && hasStore === false) {
    return <StoreCreationWizard onComplete={() => setHasStore(true)} />;
  }

  const skeleton = (
    <div className="animate-pulse space-y-6 p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
      </div>
      <div className="h-64 bg-gray-100 rounded-2xl" />
    </div>
  );

  if (loading) return skeleton;

  const todaySales = stats?.todaySales || stats?.totalRevenue || 0;
  const totalOrders = stats?.todayOrders || stats?.totalOrders || 0;
  const conversionRate = stats?.conversionRate || 0;
  const topProduct = stats?.topProduct || null;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">

      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard Boutique</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de votre boutique en ligne</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Ventes aujourd'hui"
          value={`${fmt(todaySales)} ${currency}`}
          sub="Revenus du jour"
          color="#0F6B4F"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Commandes"
          value={fmt(totalOrders)}
          sub="Total des commandes"
          color="#2563EB"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
        />
        <StatCard
          label="Taux conversion"
          value={`${(conversionRate * 100).toFixed(1)}%`}
          sub="Visiteurs → Clients"
          color="#059669"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
        />
        <StatCard
          label="Produit top"
          value={topProduct?.name || '—'}
          sub={topProduct ? `${fmt(topProduct.sales || 0)} ventes` : 'Aucune vente'}
          color="#F59E0B"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ajouter produit', href: '/ecom/boutique/products/new', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>, color: 'bg-[#E6F2ED] text-[#0A5740] border-[#96C7B5]' },
          { label: 'Voir commandes', href: '/ecom/boutique/orders', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Modifier pages', href: '/ecom/boutique/pages', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>, color: 'bg-purple-50 text-purple-700 border-purple-200' },
          { label: 'Configurer pixel', href: '/ecom/boutique/pixel', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>, color: 'bg-green-50 text-green-700 border-green-200' },
        ].map(a => (
          <Link key={a.label} to={a.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition hover:shadow-md ${a.color}`}>
            {a.icon}
            {a.label}
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Dernières commandes</h2>
          <Link to="/ecom/boutique/orders" className="text-xs font-semibold text-[#0F6B4F] hover:text-[#0A5740] transition">
            Voir tout →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400">Aucune commande pour le moment</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentOrders.map((order, i) => (
              <div key={order._id || i} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                  #{String(order.orderNumber || i + 1).slice(-3)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{order.customerName || order.customer?.name || 'Client'}</p>
                  <p className="text-xs text-gray-400">{order.items?.length || 0} articles</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{fmt(order.totalAmount || order.total)} {currency}</p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{order.status || 'nouveau'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default BoutiqueDashboard;
