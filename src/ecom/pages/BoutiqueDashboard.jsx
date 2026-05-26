import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink, RefreshCw, Package, ShoppingCart,
  TrendingUp, Users, Globe, Settings, Zap,
  ChevronRight, Sparkles, BarChart3, Eye,
  ArrowUpRight, ArrowDownRight, CreditCard, Shield,
  Layout, Tag, MapPin, Cpu, Plus, Star,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, Tooltip, XAxis,
} from 'recharts';
import ecomApi from '../services/ecommApi.js';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { useStore } from '../contexts/StoreContext.jsx';
import StoreCreationWizard from './StoreCreationWizard.jsx';

/* ─── tiny helpers ─────────────────────────────────────────────────── */
const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n || 0);
const fmtPct = (n) => `${(+(n || 0)).toFixed(1)}%`;

function delta(cur, prev) {
  if (!prev) return null;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { pct: pct.toFixed(1), up: pct >= 0 };
}

/* ─── Micro sparkline ───────────────────────────────────────────────── */
const Spark = ({ data = [], color = '#0F6B4F' }) => (
  <ResponsiveContainer width="100%" height={44}>
    <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey="v"
        stroke={color}
        strokeWidth={1.8}
        fill={`url(#sg-${color.replace('#', '')})`}
        dot={false}
        isAnimationActive={false}
      />
    </AreaChart>
  </ResponsiveContainer>
);

/* ─── KPI card ──────────────────────────────────────────────────────── */
const KpiCard = ({ label, value, sub, spark, color, icon: Icon }) => {
  const d = spark && spark.length >= 2
    ? delta(spark[spark.length - 1].v, spark[spark.length - 2].v)
    : null;

  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 p-5 overflow-hidden group hover:border-gray-200 hover:shadow-md transition-all duration-200">
      {/* subtle bg glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${color}08 0%, transparent 70%)` }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
              <Icon size={15} style={{ color }} />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
          </div>
          {d && (
            <div className={`flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${d.up ? 'bg-primary-50 text-primary-600' : 'bg-red-50 text-red-500'}`}>
              {d.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(d.pct)}%
            </div>
          )}
        </div>
        <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {spark && spark.length > 1 && (
          <div className="mt-3 -mx-1">
            <Spark data={spark} color={color} />
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Status dot ─────────────────────────────────────────────────────── */
const StatusDot = ({ ok }) => (
  <span className={`inline-block w-1.5 h-1.5 rounded-full ${ok ? 'bg-primary-400' : 'bg-gray-300'}`} />
);

/* ─── Order badge ────────────────────────────────────────────────────── */
const STATUS_STYLES = {
  delivered:  'bg-primary-50 text-primary-700 border-primary-100',
  confirmed:  'bg-blue-50   text-blue-700   border-blue-100',
  pending:    'bg-amber-50  text-amber-700  border-amber-100',
  shipped:    'bg-violet-50 text-violet-700 border-violet-100',
  cancelled:  'bg-red-50    text-red-600    border-red-100',
  returned:   'bg-gray-50   text-gray-500   border-gray-200',
};
const StatusBadge = ({ status }) => {
  const cls = STATUS_STYLES[status] || 'bg-gray-50 text-gray-500 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${cls}`}>
      {status || 'nouveau'}
    </span>
  );
};

/* ─── Quick-action card ─────────────────────────────────────────────── */
const Action = ({ label, desc, href, icon: Icon, color }) => (
  <Link
    to={href}
    className="group flex items-center gap-3.5 bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 hover:shadow-md transition-all duration-200"
  >
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105" style={{ backgroundColor: color + '15' }}>
      <Icon size={18} style={{ color }} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-900 leading-tight">{label}</p>
      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{desc}</p>
    </div>
    <ChevronRight size={14} className="text-gray-300 shrink-0 transition-transform group-hover:translate-x-0.5" />
  </Link>
);

/* ─── Store health checklist ─────────────────────────────────────────── */
const CheckItem = ({ label, done, href }) => (
  <Link to={href} className="flex items-center gap-2.5 py-2 hover:opacity-80 transition-opacity group">
    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${done ? 'border-primary-500 bg-primary-500' : 'border-gray-200'}`}>
      {done && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
    <span className={`text-xs font-semibold ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{label}</span>
    {!done && <ChevronRight size={11} className="text-gray-300 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
  </Link>
);

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
const BoutiqueDashboard = () => {
  const { workspace } = useEcomAuth();
  const { activeStore, stores, loading: storeLoading } = useStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [hasStore, setHasStore] = useState(null);
  const [storeUrl, setStoreUrl] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  const currency = activeStore?.storeSettings?.storeCurrency
    || workspace?.storeSettings?.storeCurrency
    || 'XAF';

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. resolve store config
      const configRes = await ecomApi.get('/stores').catch(() => null);
      const storeList = configRes?.data?.data || [];
      const store = storeList[0] || null;
      const subdomain = store?.subdomain || activeStore?.subdomain;
      const hasHome = store?.hasHomepage ?? activeStore?.hasHomepage;

      if (!isMounted.current) return;

      setHasStore(!!(subdomain && hasHome !== false));

      const url = store?.storeUrl || store?.publicUrl
        || (subdomain ? `https://${subdomain}.scalor.net` : null);
      setStoreUrl(url);

      if (!subdomain) { setLoading(false); return; }

      // 2. parallel fetch analytics + orders
      const [analyticsRes, ordersRes] = await Promise.allSettled([
        ecomApi.get('/store-analytics/dashboard', { params: { period: '30d' } }),
        ecomApi.get('/store-orders', { params: { limit: 6, sort: '-createdAt' } }),
      ]);

      if (!isMounted.current) return;

      const aData = analyticsRes.status === 'fulfilled'
        ? analyticsRes.value?.data?.data || analyticsRes.value?.data || null
        : null;

      const oData = ordersRes.status === 'fulfilled'
        ? ordersRes.value?.data?.data?.orders
          || ordersRes.value?.data?.orders
          || []
        : [];

      setAnalytics(aData);
      setRecentOrders(oData);

      // summary from analytics
      if (aData) {
        setSummary({
          totalVisitors:   aData.analytics?.overview?.uniqueVisitors || aData.totalVisitors || 0,
          totalOrders:     aData.orders?.stats?.total || aData.totalOrders || 0,
          totalRevenue:    aData.orders?.stats?.totalRevenue || aData.totalRevenue || 0,
          conversionRate:  aData.analytics?.overview?.conversionRate || aData.conversionRate || 0,
          avgOrderValue:   aData.orders?.stats?.avgOrderValue || 0,
          todayRevenue:    aData.orders?.stats?.todayRevenue || 0,
          timeline:        aData.analytics?.timeline || [],
        });
      }
    } catch { /* silent */ } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => { load(); }, [activeStore?._id]);

  // ── show wizard if no store ────────────────────────────────────────
  if (!loading && !storeLoading && hasStore === false) {
    return <StoreCreationWizard onComplete={() => setHasStore(true)} />;
  }

  // ── skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-5 lg:p-7 max-w-7xl mx-auto space-y-5 animate-pulse">
        <div className="h-28 bg-gray-100 rounded-3xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-gray-100 rounded-2xl" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── build sparkline from timeline ─────────────────────────────────
  const tl = summary?.timeline || [];
  const revSpark = tl.map(d => ({ v: d.revenue || d.value || 0 }));
  const visSpark = tl.map(d => ({ v: d.visitors || d.visits || 0 }));

  // health checks
  const store = stores?.[0] || activeStore || null;
  const healthChecks = [
    { label: 'Boutique activée',      done: !!store?.isActive,                   href: '/ecom/boutique/settings' },
    { label: 'Logo & branding',       done: !!store?.storeSettings?.storeLogo,   href: '/ecom/boutique/settings' },
    { label: 'Page d\'accueil',       done: !!store?.hasHomepage,                href: '/ecom/boutique/pages' },
    { label: 'Paiements configurés',  done: !!(store?.storePayments && Object.keys(store.storePayments || {}).length > 0), href: '/ecom/boutique/payments' },
    { label: 'Domaine personnalisé',  done: !!store?.customDomain,               href: '/ecom/boutique/domains' },
    { label: 'Pixel & tracking',      done: !!store?.storePixels,               href: '/ecom/boutique/pixel' },
  ];
  const healthScore = Math.round((healthChecks.filter(h => h.done).length / healthChecks.length) * 100);

  const storeName = store?.name || store?.storeSettings?.storeName || 'Ma boutique';

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 lg:p-8">
        {/* decorative grid */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
        {/* green glow */}
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0F6B4F, transparent 70%)' }} />
        <div className="absolute -bottom-8 right-16 w-48 h-48 rounded-full opacity-10 blur-2xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #14B585, transparent 70%)' }} />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {/* store avatar */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F6B4F] to-[#14B585] flex items-center justify-center shadow-lg shadow-primary-900/40 shrink-0">
              {store?.storeSettings?.storeLogo ? (
                <img src={store.storeSettings.storeLogo} alt="" className="w-10 h-10 object-contain rounded-xl" />
              ) : (
                <span className="text-xl font-black text-white">{storeName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-white font-black text-lg lg:text-xl tracking-tight">{storeName}</h1>
                <div className="flex items-center gap-1 bg-primary-500/20 border border-primary-500/30 text-primary-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <span className="w-1 h-1 rounded-full bg-primary-400 animate-pulse" />
                  LIVE
                </div>
              </div>
              {storeUrl ? (
                <a href={storeUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors text-xs font-medium">
                  <Globe size={11} />
                  {storeUrl.replace('https://', '')}
                  <ExternalLink size={10} />
                </a>
              ) : (
                <span className="text-white/30 text-xs">Boutique en ligne</span>
              )}
            </div>
          </div>

          {/* right: score + actions */}
          <div className="flex items-center gap-3">
            {/* health score pill */}
            <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5">
              <div className="relative w-8 h-8">
                <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
                  <circle cx="16" cy="16" r="12" fill="none"
                    stroke={healthScore >= 80 ? '#10B981' : healthScore >= 50 ? '#F59E0B' : '#F87171'}
                    strokeWidth="3"
                    strokeDasharray={`${(healthScore / 100) * 75.4} 75.4`}
                    strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white">{healthScore}</span>
              </div>
              <div>
                <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Score</p>
                <p className="text-xs text-white font-bold">{healthScore >= 80 ? 'Excellent' : healthScore >= 50 ? 'À améliorer' : 'À configurer'}</p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>

            {storeUrl && (
              <a href={storeUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 bg-[#0F6B4F] hover:bg-[#0A5740] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-primary-900/30">
                <Eye size={13} />
                Voir la boutique
              </a>
            )}
          </div>
        </div>

        {/* bottom: quick nav tabs */}
        <div className="relative z-10 mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-2">
          {[
            { label: 'Produits',   href: '/ecom/boutique/products', icon: Package },
            { label: 'Commandes',  href: '/ecom/boutique/orders',   icon: ShoppingCart },
            { label: 'Pages',      href: '/ecom/boutique/pages',    icon: Layout },
            { label: 'Thème',      href: '/ecom/boutique/theme',    icon: Sparkles },
            { label: 'Domaines',   href: '/ecom/boutique/domains',  icon: Globe },
            { label: 'Paiements',  href: '/ecom/boutique/payments', icon: CreditCard },
            { label: 'Paramètres', href: '/ecom/boutique/settings', icon: Settings },
          ].map(({ label, href, icon: Icon }) => (
            <Link key={label} to={href}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/60 hover:text-white/90 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all">
              <Icon size={11} />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── KPI GRID ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Chiffre d'affaires"
          value={`${fmt(summary?.totalRevenue)} ${currency}`}
          sub="30 derniers jours"
          icon={TrendingUp}
          color="#0F6B4F"
          spark={revSpark}
        />
        <KpiCard
          label="Commandes"
          value={fmt(summary?.totalOrders)}
          sub="30 derniers jours"
          icon={ShoppingCart}
          color="#2563EB"
          spark={tl.map(d => ({ v: d.orders || 0 }))}
        />
        <KpiCard
          label="Visiteurs"
          value={fmt(summary?.totalVisitors)}
          sub="Visiteurs uniques 30j"
          icon={Users}
          color="#7C3AED"
          spark={visSpark}
        />
        <KpiCard
          label="Taux de conversion"
          value={fmtPct(summary?.conversionRate)}
          sub={`Panier moy. ${fmt(summary?.avgOrderValue)} ${currency}`}
          icon={Zap}
          color="#D97706"
          spark={[]}
        />
      </div>

      {/* ── MAIN ROW ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900">Dernières commandes</h2>
            </div>
            <Link to="/ecom/boutique/orders"
              className="flex items-center gap-1 text-xs font-semibold text-[#0F6B4F] hover:text-[#0A5740] transition-colors">
              Voir tout <ArrowUpRight size={12} />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <ShoppingCart size={20} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-400">Aucune commande</p>
              <p className="text-xs text-gray-300">Les commandes de votre boutique apparaîtront ici</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentOrders.map((order, i) => (
                <div key={order._id || i} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500 shrink-0">
                    #{String(order.orderNumber || order._id?.slice(-3) || i + 1).slice(-3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {order.customerName || order.customer?.name || 'Client'}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {order.items?.map(it => it.name || it.productName).join(', ') || order.product || '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm font-black text-gray-900">
                      {fmt(order.totalAmount || order.total || order.price)} {currency}
                    </p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: health + actions */}
        <div className="space-y-3">

          {/* Store health */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-primary-500" />
                <h3 className="text-sm font-bold text-gray-900">Santé boutique</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${healthScore}%`,
                      background: healthScore >= 80 ? '#10B981' : healthScore >= 50 ? '#F59E0B' : '#F87171'
                    }}
                  />
                </div>
                <span className="text-[11px] font-black text-gray-500">{healthScore}%</span>
              </div>
            </div>
            <div className="space-y-0.5">
              {healthChecks.map(h => (
                <CheckItem key={h.label} label={h.label} done={h.done} href={h.href} />
              ))}
            </div>
          </div>

          {/* Add product CTA */}
          <Link to="/ecom/boutique/products/new"
            className="group flex items-center gap-3 bg-gradient-to-r from-[#0F6B4F] to-[#14B585] rounded-2xl p-4 hover:shadow-lg hover:shadow-primary-900/20 transition-all">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Plus size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Ajouter un produit</p>
              <p className="text-white/60 text-[11px]">Développez votre catalogue</p>
            </div>
            <ChevronRight size={14} className="text-white/50 group-hover:translate-x-0.5 transition-transform" />
          </Link>

        </div>
      </div>

      {/* ── QUICK ACTIONS GRID ────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Accès rapide</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Action label="Produits"      desc="Gérer le catalogue"         href="/ecom/boutique/products"       icon={Package}    color="#0F6B4F" />
          <Action label="Commandes"     desc="Suivi des ventes"           href="/ecom/boutique/orders"         icon={ShoppingCart} color="#2563EB" />
          <Action label="Pages"         desc="Accueil, fiches produit"    href="/ecom/boutique/pages"          icon={Layout}     color="#7C3AED" />
          <Action label="Thème"         desc="Couleurs & typographie"     href="/ecom/boutique/theme"          icon={Sparkles}   color="#EC4899" />
          <Action label="Zones de livraison" desc="Tarifs & délais"       href="/ecom/boutique/delivery-zones" icon={MapPin}     color="#059669" />
          <Action label="Paiements"     desc="Moyens de paiement"        href="/ecom/boutique/payments"       icon={CreditCard} color="#D97706" />
          <Action label="Pixel & Tracking" desc="Facebook, TikTok…"      href="/ecom/boutique/pixel"          icon={Cpu}        color="#DC2626" />
          <Action label="Analyses"      desc="Visiteurs & conversions"   href="/ecom/boutique/analyses"       icon={BarChart3}  color="#0EA5E9" />
        </div>
      </div>

    </div>
  );
};

export default BoutiqueDashboard;
