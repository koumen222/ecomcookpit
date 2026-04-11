import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Calendar, Loader2, LayoutGrid, ShoppingBag,
  Truck, Users, Target, ChevronRight, Package, PhoneCall,
  MapPin, CheckCircle2, XCircle, MessageCircle, Eye, Globe,
  Monitor, Smartphone, Tablet, Chrome, Languages, FileText,
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { formatMoney } from '../utils/currency.js';

/**
 * StoreAnalytics — "Analyses de données" (orienté e-commerce COD Afrique).
 * Tabs: Résumé / Ventes / Commandes / Livraison / Clients.
 * Backed by /store-analytics/dashboard.
 */
const TABS = [
  { key: 'summary',   label: 'Résumé',    icon: LayoutGrid,  iconClass: 'text-primary-500' },
  { key: 'sales',     label: 'Ventes',    icon: ShoppingBag, iconClass: 'text-primary-600' },
  { key: 'orders',    label: 'Commandes', icon: Package,     iconClass: 'text-scalor-copper' },
  { key: 'delivery',  label: 'Livraison', icon: Truck,       iconClass: 'text-primary-500' },
  { key: 'visits',    label: 'Visites',   icon: Eye,         iconClass: 'text-primary-600' },
  { key: 'customers', label: 'Clients',   icon: Users,       iconClass: 'text-scalor-copper-light' },
];

const DATE_PRESETS = [
  { key: 'all', label: 'Tout l\'historique', compute: () => ({ start: new Date(2020, 0, 1), end: new Date() }) },
  { key: '1h',  label: 'Dernière heure',      compute: () => ({ start: new Date(Date.now() - 60 * 60 * 1000),         end: new Date() }) },
  { key: '24h', label: 'Dernières 24 heures', compute: () => ({ start: new Date(Date.now() - 24 * 60 * 60 * 1000),    end: new Date() }) },
  { key: 'today',     label: "Aujourd'hui",   compute: () => { const s = new Date(); s.setHours(0,0,0,0); return { start: s, end: new Date() }; } },
  { key: 'yesterday', label: 'Hier',          compute: () => { const s = new Date(); s.setDate(s.getDate()-1); s.setHours(0,0,0,0); const e = new Date(s); e.setHours(23,59,59,999); return { start: s, end: e }; } },
  { key: '7d',  label: '7 derniers jours',    compute: () => ({ start: new Date(Date.now() - 7  * 86400000), end: new Date() }) },
  { key: '30d', label: '30 derniers jours',   compute: () => ({ start: new Date(Date.now() - 30 * 86400000), end: new Date() }) },
  { key: '90d', label: '3 derniers mois',     compute: () => ({ start: new Date(Date.now() - 90 * 86400000), end: new Date() }) },
  { key: '12m', label: '12 derniers mois',    compute: () => ({ start: new Date(Date.now() - 365 * 86400000), end: new Date() }) },
  { key: 'mtd', label: 'Mois en cours',       compute: () => { const s = new Date(); s.setDate(1); s.setHours(0,0,0,0); return { start: s, end: new Date() }; } },
  { key: 'ytd', label: 'Année en cours',      compute: () => { const s = new Date(); s.setMonth(0, 1); s.setHours(0,0,0,0); return { start: s, end: new Date() }; } },
  { key: 'custom', label: 'Personnalisé' },
];

const fmtNumber   = (n) => new Intl.NumberFormat('fr-FR').format(n || 0);
const fmtPct      = (n) => `${Number.isFinite(n) ? (Math.round((n || 0) * 100) / 100) : 0}%`;
const fmtCompactCurrency = (v) => {
  const n = Math.abs(v || 0);
  if (n >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return `${Math.round(v || 0)}`;
};
const toDateInput = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const fmtDateLabel = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default function StoreAnalytics() {
  const { workspace } = useEcomAuth();
  const storedWorkspace = (() => {
    try {
      return JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    } catch {
      return null;
    }
  })();
  const workspaceId = workspace?._id || workspace?.id || storedWorkspace?._id || storedWorkspace?.id;

  const [activeTab, setActiveTab] = useState('summary');
  const [presetKey, setPresetKey] = useState('all');
  const [endDate, setEndDate]     = useState(toDateInput(new Date()));
  const [startDate, setStartDate] = useState(toDateInput(new Date(2020, 0, 1)));
  const [loading, setLoading]     = useState(false);
  const [data, setData]           = useState(null);
  const [salesDetails, setSalesDetails] = useState(null);
  const [boutiqueSalesDetails, setBoutiqueSalesDetails] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const pickerRef = useRef(null);

  // Store currency from API response (all revenues are already converted server-side)
  const storeCurrency = data?.storeCurrency
    || workspace?.storeSettings?.storeCurrency
    || storedWorkspace?.storeSettings?.storeCurrency
    || 'XAF';
  const fmtCurrency = (n) => formatMoney(n, storeCurrency);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setDatePickerOpen(false);
    };
    if (datePickerOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [datePickerOpen]);

  const applyPreset = (key) => {
    const preset = DATE_PRESETS.find(p => p.key === key);
    if (!preset || !preset.compute) { setPresetKey(key); return; }
    const { start, end } = preset.compute();
    setStartDate(toDateInput(start));
    setEndDate(toDateInput(end));
    setPresetKey(key);
    setDatePickerOpen(false);
  };

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [analyticsRes, salesRes] = await Promise.all([
          ecomApi.get('/store-analytics/dashboard', {
            params: { workspaceId, startDate, endDate },
          }),
          ecomApi.get('/orders/stats/detailed', {
            params: { workspaceId, startDate, endDate },
          }).catch(() => null),
        ]);
        const boutiqueOrdersRes = await ecomApi.get('/orders', {
          params: { workspaceId, startDate, endDate, sourceId: 'scalor', limit: 1000 },
        }).catch(() => null);
        if (cancelled) return;
        const payload = analyticsRes.data?.data || analyticsRes.data || {};
        const normalizedPayload = payload.analytics || payload.orders
          ? payload
          : {
              analytics: payload.analyticsData || payload.stats || payload.overview ? {
                overview: payload.overview || payload.analyticsData?.overview || {},
                timeline: payload.timeline || payload.analyticsData?.timeline || [],
                deviceStats: payload.deviceStats || payload.analyticsData?.deviceStats || [],
                visitsPerProduct: payload.visitsPerProduct || payload.analyticsData?.visitsPerProduct || [],
                topProducts: payload.topProducts || payload.analyticsData?.topProducts || [],
                dailyVisits: payload.dailyVisits || payload.analyticsData?.dailyVisits || [],
                countryStats: payload.countryStats || payload.analyticsData?.countryStats || [],
                cityStats: payload.cityStats || payload.analyticsData?.cityStats || [],
                browserStats: payload.browserStats || payload.analyticsData?.browserStats || [],
                languageStats: payload.languageStats || payload.analyticsData?.languageStats || [],
                topPages: payload.topPages || payload.analyticsData?.topPages || [],
                trafficSources: payload.trafficSources || payload.analyticsData?.trafficSources || [],
              } : { overview: {}, timeline: [], deviceStats: [], visitsPerProduct: [], topProducts: [] },
              orders: payload.orderStats || payload.orders || {},
              topProductsBySales: payload.topProductsBySales || [],
              topProductsByRevenue: payload.topProductsByRevenue || [],
              leastProductsBySales: payload.leastProductsBySales || [],
            };

        console.log('[ANALYTICS] API response:', JSON.stringify(normalizedPayload?.orders || {}, null, 2));
        console.log('[ANALYTICS] workspaceId:', workspaceId, 'dates:', startDate, '->', endDate);
        setData(normalizedPayload);
        setSalesDetails(salesRes?.data?.data || null);
        setBoutiqueSalesDetails(buildBoutiqueSalesDetails(boutiqueOrdersRes?.data?.data || null));
      } catch (err) {
        if (cancelled) return;
        console.error('Analytics load error', err);
        setData({ analytics: { overview: {}, timeline: [], deviceStats: [], visitsPerProduct: [], topProducts: [] }, orders: {} });
        setSalesDetails(null);
        setBoutiqueSalesDetails(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, startDate, endDate]);

  const overview = data?.analytics?.overview || {};
  const orders   = data?.orders || {};
  const timeline = data?.analytics?.timeline || [];
  const analytics = data?.analytics || {};
  const salesOrderStats = boutiqueSalesDetails?.orderStats || salesDetails?.orderStats || {};

  const normalizedTopSales = boutiqueSalesDetails?.topProductsBySales?.length
    ? boutiqueSalesDetails.topProductsBySales
    : (data?.topProductsBySales?.length ? data.topProductsBySales : (salesDetails?.topProducts || []).map((item) => ({
    name: item._id || 'Sans nom',
    sold: item.count || 0,
    revenue: item.revenue || 0,
  })));

  const normalizedTopRevenue = boutiqueSalesDetails?.topProductsByRevenue?.length
    ? boutiqueSalesDetails.topProductsByRevenue
    : (data?.topProductsByRevenue?.length ? data.topProductsByRevenue : (salesDetails?.topProducts || [])
    .map((item) => ({
      name: item._id || 'Sans nom',
      sold: item.count || 0,
      revenue: item.revenue || 0,
    }))
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0)));

  const normalizedLeastSales = boutiqueSalesDetails?.leastProductsBySales?.length
    ? boutiqueSalesDetails.leastProductsBySales
    : (data?.leastProductsBySales?.length ? data.leastProductsBySales : [...normalizedTopSales]
    .filter((item) => (item.sold || 0) > 0)
    .sort((a, b) => (a.sold || 0) - (b.sold || 0) || (b.revenue || 0) - (a.revenue || 0)));

  const salesTrendSeries = boutiqueSalesDetails?.salesTrendSeries || (salesDetails?.dailyTrend || []).map((point) => ({
    label: new Date(point._id).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    value: point.revenue || 0,
  }));

  const daily = useMemo(() => buildDailySeries(timeline, startDate, endDate, analytics.dailyVisits, orders), [timeline, startDate, endDate, analytics.dailyVisits, orders]);

  const kpi = {
    // Revenue (COD)
    potentialRevenue: orders.potentialRevenue ?? orders.totalRevenue ?? salesOrderStats.totalRevenue ?? 0,
    realizedRevenue:  orders.realizedRevenue  ?? salesOrderStats.totalRevenue ?? 0,
    averageBasket:    orders.averageOrderValue ?? salesOrderStats.avgOrderValue ?? 0,
    averageDelivered: orders.averageDeliveredValue ?? salesOrderStats.avgOrderValue ?? 0,
    shippingCost:     orders.shippingCost ?? 0,
    // Order counts
    totalOrders:      orders.total ?? salesOrderStats.total ?? 0,
    pending:          orders.pending ?? salesOrderStats.pending ?? 0,
    confirmed:        orders.confirmed ?? salesOrderStats.confirmed ?? 0,
    processing:       orders.processing ?? 0,
    shipped:          orders.shipped ?? salesOrderStats.shipped ?? 0,
    delivered:        orders.delivered ?? salesOrderStats.delivered ?? 0,
    cancelled:        orders.cancelled ?? salesOrderStats.cancelled ?? 0,
    // COD performance
    confirmationRate: orders.confirmationRate ?? 0,
    deliveryRate:     orders.deliveryRate ?? 0,
    cancellationRate: orders.cancellationRate ?? 0,
    // Customers
    uniqueCustomers:  orders.uniqueCustomers ?? 0,
    repeatCustomers:  orders.repeatCustomers ?? 0,
    repeatRate:       orders.repeatRate ?? 0,
    // Segments
    topCities:        orders.topCities || [],
    channelStats:     orders.channelStats || {},
    channelPerformance: boutiqueSalesDetails?.channelPerformance || orders.channelPerformance || [],
    topProductsBySales: normalizedTopSales,
    topProductsByRevenue: normalizedTopRevenue,
    leastProductsBySales: normalizedLeastSales,
    salesTrendSeries,
    // Traffic
    totalVisits:      overview.uniqueVisitors ?? 0,
    pageViews:        overview.pageViews ?? 0,
    productViews:     overview.productViews ?? 0,
    visitsToday:      overview.visitsToday ?? 0,
    conversionRate:   overview.conversionRate ?? 0,
    addToCarts:       overview.addToCarts ?? 0,
    checkouts:        overview.checkoutsStarted ?? 0,
    // Visit segments
    deviceStats:      analytics.deviceStats || [],
    countryStats:     analytics.countryStats || [],
    cityVisitStats:   analytics.cityStats || [],
    browserStats:     analytics.browserStats || [],
    languageStats:    analytics.languageStats || [],
    topPages:         analytics.topPages || [],
    trafficSources:   analytics.trafficSources || [],
    visitsPerProduct: analytics.visitsPerProduct || [],
  };

  const currentPreset = DATE_PRESETS.find(p => p.key === presetKey);
  const dateRangeLabel = presetKey !== 'custom' && currentPreset
    ? currentPreset.label
    : `${fmtDateLabel(startDate)} – ${fmtDateLabel(endDate)}`;

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-950">Analyses</h1>
        <p className="text-sm text-gray-500">Vue simple des ventes, commandes, livraisons et visites de la boutique.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setDatePickerOpen(v => !v)}
            className="w-full flex items-center gap-2.5 px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 hover:border-gray-300 transition"
          >
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="font-medium">{dateRangeLabel}</span>
            <span className="ml-auto text-xs text-gray-400 hidden sm:inline">
              {fmtDateLabel(startDate)} – {fmtDateLabel(endDate)}
            </span>
          </button>
          {datePickerOpen && (
            <div className="absolute z-30 mt-2 left-0 right-0 sm:right-auto sm:min-w-[560px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden flex flex-col sm:flex-row">
              {/* Presets sidebar */}
              <div className="w-full sm:w-60 bg-gray-50 p-2 sm:border-r border-gray-200">
                <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Périodes rapides</p>
                <ul className="space-y-0.5">
                  {DATE_PRESETS.map(p => {
                    const selected = p.key === presetKey;
                    return (
                      <li key={p.key}>
                        <button
                          onClick={() => applyPreset(p.key)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition ${
                            selected
                              ? 'bg-gray-900 text-white font-medium'
                              : 'text-gray-700 hover:bg-white'
                          }`}
                        >
                          {p.label}
                          {selected && <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {/* Custom range */}
              <div className="flex-1 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Plage personnalisée</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col text-xs text-gray-600">
                    Date de début
                    <input
                      type="date"
                      value={startDate}
                      max={endDate}
                      onChange={(e) => { setStartDate(e.target.value); setPresetKey('custom'); }}
                      className="mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </label>
                  <label className="flex flex-col text-xs text-gray-600">
                    Date de fin
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      max={toDateInput(new Date())}
                      onChange={(e) => { setEndDate(e.target.value); setPresetKey('custom'); }}
                      className="mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </label>
                </div>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setDatePickerOpen(false)}
                    className="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => setDatePickerOpen(false)}
                    className="px-4 py-2 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800"
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition ${
                active
                  ? 'border-gray-900 text-gray-950 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
        </div>
      </div>

      {/* ─── Tab content ────────────────────────────────────────── */}
      {loading && !data ? (
        <div className="flex items-center justify-center min-h-[40vh] bg-white border border-gray-200 rounded-xl">
          <Loader2 className="w-7 h-7 animate-spin text-gray-700" />
        </div>
      ) : (
        <>
          {activeTab === 'summary'   && <SummaryTab kpi={kpi} daily={daily} fmtCurrency={fmtCurrency} />}
          {activeTab === 'sales'     && <SalesTab kpi={kpi} daily={daily} fmtCurrency={fmtCurrency} />}
          {activeTab === 'orders'    && <OrdersTab kpi={kpi} />}
          {activeTab === 'delivery'  && <DeliveryTab kpi={kpi} fmtCurrency={fmtCurrency} />}
          {activeTab === 'visits'    && <VisitsTab kpi={kpi} daily={daily} />}
          {activeTab === 'customers' && <CustomersTab kpi={kpi} fmtCurrency={fmtCurrency} />}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  KPI Card
 * ═══════════════════════════════════════════════════════════════ */
const Card = ({ value, label, highlight = false, accent = 'default' }) => {
  const accents = {
    default: 'bg-white border-gray-200',
    green:   'bg-white border-gray-200',
    copper:  'bg-white border-gray-200',
  };
  return (
    <div className={`rounded-xl border p-4 min-h-[104px] ${accents[accent] || accents.default}`}>
      <p className={`text-2xl leading-tight font-semibold mb-1 text-gray-950 ${
        highlight ? 'text-gray-950' : ''
      }`}>
        {value}
      </p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
};

const SectionTitle = ({ children }) => (
  <h2 className="text-base font-semibold text-gray-950">
    {children}
  </h2>
);

const EmptyRow = ({ text = 'Aucune donnée disponible' }) => (
  <div className="bg-white border border-gray-200 rounded-xl py-10 flex items-center justify-center text-sm text-gray-400">
    {text}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
 *  Résumé tab — COD overview
 * ═══════════════════════════════════════════════════════════════ */
function SummaryTab({ kpi, daily, fmtCurrency }) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionTitle>Chiffre d'affaires COD</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card value={fmtCurrency(kpi.realizedRevenue)}  label="CA encaissé (livré)" accent="green" highlight />
          <Card value={fmtCurrency(kpi.potentialRevenue)} label="CA potentiel (toutes cmd.)" />
          <Card value={fmtCurrency(kpi.averageDelivered || kpi.averageBasket)} label="Panier moyen livré" />
          <Card value={fmtCurrency(kpi.shippingCost)}     label="Coût de livraison total" accent="copper" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Performance COD</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card value={fmtPct(kpi.confirmationRate)} label="Taux de confirmation" />
          <Card value={fmtPct(kpi.deliveryRate)}     label="Taux de livraison réussie" accent="green" />
          <Card value={fmtPct(kpi.cancellationRate)} label="Taux d'annulation" accent="copper" />
          <Card value={fmtPct(kpi.repeatRate)}       label="Clients récurrents" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Commandes</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card value={fmtNumber(kpi.totalOrders)} label="Total commandes" highlight />
          <Card value={fmtNumber(kpi.pending)}     label="À confirmer" accent="copper" />
          <Card value={fmtNumber(kpi.shipped)}     label="En livraison" />
          <Card value={fmtNumber(kpi.delivered)}   label="Livrées" accent="green" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Revenu encaissé quotidien</SectionTitle>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <AreaChart data={daily.series} color="#0F6B4F" fill="rgba(15,107,79,0.14)" yFormat={(v) => fmtCompactCurrency(v)} />
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Ventes tab — COD revenue
 * ═══════════════════════════════════════════════════════════════ */
function SalesTab({ kpi, daily, fmtCurrency }) {
  const realizedPct = kpi.potentialRevenue > 0
    ? (kpi.realizedRevenue / kpi.potentialRevenue) * 100
    : 0;

  const totalChannelOrders = kpi.channelPerformance.reduce((sum, channel) => sum + (channel.orders || 0), 0) || 1;
  const salesSeries = (daily.series || []).some((point) => (point.value || 0) > 0)
    ? daily.series
    : (kpi.salesTrendSeries || []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card value={fmtCurrency(kpi.realizedRevenue)}  label="CA encaissé (cash COD)" accent="green" highlight />
        <Card value={fmtCurrency(kpi.potentialRevenue)} label="CA potentiel" />
        <Card value={fmtCurrency(kpi.shippingCost)}     label="Coût de livraison" accent="copper" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card value={fmtCurrency(kpi.averageDelivered)} label="Panier moyen livré" />
        <Card value={fmtCurrency(kpi.averageBasket)}    label="Panier moyen commandé" />
        <Card value={fmtPct(realizedPct)}               label="% CA réellement encaissé" />
      </div>

      <section className="space-y-3">
        <SectionTitle>Revenu encaissé quotidien</SectionTitle>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <AreaChart data={salesSeries} color="#0F6B4F" fill="rgba(15,107,79,0.14)" yFormat={(v) => fmtCompactCurrency(v)} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-3">
          <SectionTitle>Produits les plus vendus</SectionTitle>
          <RankedCard
            items={kpi.topProductsBySales.map((product) => ({
              label: product.name || 'Sans nom',
              value: product.sold || 0,
              sub: `${fmtCurrency(product.revenue || 0)}`,
            }))}
            icon={Package}
            emptyText="Aucune vente produit"
          />
        </section>

        <section className="space-y-3">
          <SectionTitle>Produits les moins vendus</SectionTitle>
          <RankedCard
            items={kpi.leastProductsBySales.map((product) => ({
              label: product.name || 'Sans nom',
              value: product.sold || 0,
              sub: `${fmtCurrency(product.revenue || 0)}`,
            }))}
            icon={Package}
            emptyText="Pas assez de ventes pour comparer"
          />
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-3">
          <SectionTitle>Produits les plus rentables</SectionTitle>
          <RankedCard
            items={kpi.topProductsByRevenue.map((product) => ({
              label: product.name || 'Sans nom',
              value: product.revenue || 0,
              sub: `${fmtNumber(product.sold || 0)} unités`,
            }))}
            icon={ShoppingBag}
            emptyText="Aucun chiffre d'affaires produit"
            valueFormatter={(value) => fmtCurrency(value)}
          />
        </section>

        <section className="space-y-3">
          <SectionTitle>Ventes par canal</SectionTitle>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            {kpi.channelPerformance.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6">Aucune donnée par canal</div>
            ) : kpi.channelPerformance.map((channel) => (
              <div key={channel.channel} className="border border-gray-100 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formatChannelLabel(channel.channel)}</p>
                    <p className="text-xs text-gray-500">{fmtNumber(channel.orders)} commandes · {((channel.orders / totalChannelOrders) * 100).toFixed(0)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{fmtCurrency(channel.revenue)}</p>
                    <p className="text-xs text-gray-500">encaissé: {fmtCurrency(channel.deliveredRevenue)}</p>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded overflow-hidden">
                  <div className="h-full bg-gray-900" style={{ width: `${Math.min((channel.orders / totalChannelOrders) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Commandes tab — COD funnel
 * ═══════════════════════════════════════════════════════════════ */
function OrdersTab({ kpi }) {
  const total = kpi.totalOrders || 1;
  const steps = [
    { label: 'Nouvelles',     count: kpi.totalOrders,                              icon: Package,        color: '#6b7280' },
    { label: 'Confirmées',    count: kpi.totalOrders - kpi.pending,                icon: PhoneCall,      color: '#0F6B4F' },
    { label: 'En traitement', count: kpi.processing + kpi.shipped + kpi.delivered, icon: Package,        color: '#0F6B4F' },
    { label: 'Expédiées',     count: kpi.shipped + kpi.delivered,                  icon: Truck,          color: '#14855F' },
    { label: 'Livrées',       count: kpi.delivered,                                icon: CheckCircle2,   color: '#0A5740' },
  ];

  const whatsapp = kpi.channelStats?.whatsapp || 0;
  const store    = kpi.channelStats?.store || 0;
  const totalCh  = whatsapp + store || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card value={fmtNumber(kpi.totalOrders)} label="Total commandes" highlight />
        <Card value={fmtNumber(kpi.pending)}     label="À confirmer" accent="copper" />
        <Card value={fmtNumber(kpi.delivered)}   label="Livrées" accent="green" />
        <Card value={fmtNumber(kpi.cancelled)}   label="Annulées / refusées" accent="copper" />
      </div>

      <section className="space-y-3">
        <SectionTitle>Entonnoir COD</SectionTitle>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          {steps.map((s, i) => {
            const pct = (s.count / total) * 100;
            const Icon = s.icon;
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                    <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                    {s.label}
                  </span>
                  <span className="text-gray-500">{fmtNumber(s.count)} · {pct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%`, background: s.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Canal de commande</SectionTitle>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <ChannelRow
            icon={<MessageCircle className="w-4 h-4 text-[#25D366]" />}
            label="WhatsApp"
            count={whatsapp}
            pct={(whatsapp / totalCh) * 100}
            color="#25D366"
          />
          <ChannelRow
            icon={<LayoutGrid className="w-4 h-4 text-primary-600" />}
            label="Boutique en ligne"
            count={store}
            pct={(store / totalCh) * 100}
            color="#0F6B4F"
          />
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Livraison tab — zones + success
 * ═══════════════════════════════════════════════════════════════ */
function DeliveryTab({ kpi, fmtCurrency }) {
  const cities = kpi.topCities || [];
  const maxCount = Math.max(...cities.map(c => c.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card value={fmtPct(kpi.deliveryRate)}     label="Taux de livraison" accent="green" highlight />
        <Card value={fmtPct(kpi.cancellationRate)} label="Taux d'annulation" accent="copper" />
        <Card value={fmtNumber(kpi.shipped)}       label="En cours de livraison" />
        <Card value={fmtCurrency(kpi.shippingCost)} label="Frais totaux" />
      </div>

      <section className="space-y-3">
        <SectionTitle>Top zones de livraison</SectionTitle>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          {cities.length === 0 ? (
            <EmptyRow text="Aucune zone de livraison sur cette période" />
          ) : (
            <ul className="space-y-3">
              {cities.map((c, i) => {
                const success = c.count > 0 ? (c.delivered / c.count) * 100 : 0;
                return (
                  <li key={i}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1.5 font-medium text-gray-800">
                        <MapPin className="w-3.5 h-3.5 text-primary-600" />
                        {c.name}
                      </span>
                      <span className="text-gray-500">
                        {fmtNumber(c.count)} cmd · {fmtNumber(c.delivered)} livrées · {success.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded overflow-hidden relative">
                      <div
                        className="h-full"
                        style={{ width: `${(c.count / maxCount) * 100}%`, background: '#0F6B4F' }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Performance par statut</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatusCard icon={PhoneCall}    label="En attente"   count={kpi.pending}    tone="gray" />
          <StatusCard icon={CheckCircle2} label="Confirmées"   count={kpi.confirmed}  tone="green" />
          <StatusCard icon={Package}      label="En traitement" count={kpi.processing} tone="green" />
          <StatusCard icon={Truck}        label="Expédiées"    count={kpi.shipped}    tone="green" />
          <StatusCard icon={CheckCircle2} label="Livrées"      count={kpi.delivered}  tone="green" />
          <StatusCard icon={XCircle}      label="Annulées"     count={kpi.cancelled}  tone="copper" />
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Visites tab — traffic breakdown (country/city/device/referrer…)
 * ═══════════════════════════════════════════════════════════════ */
function VisitsTab({ kpi, daily }) {
  const deviceTotal = kpi.deviceStats.reduce((s, d) => s + (d.count || 0), 0) || 0;
  const getDevice = (name) => kpi.deviceStats.find(d => (d._id || '').toLowerCase() === name)?.count || 0;
  const desktop = getDevice('desktop');
  const mobile  = getDevice('mobile');
  const tablet  = getDevice('tablet');

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card value={fmtNumber(kpi.totalVisits)}  label="Visiteurs uniques" highlight />
        <Card value={fmtNumber(kpi.pageViews)}    label="Pages vues" />
        <Card value={fmtNumber(kpi.productViews)} label="Vues produit" accent="green" />
        <Card value={fmtNumber(kpi.visitsToday)}  label="Visites aujourd'hui" accent="copper" />
      </div>

      {/* Daily visits chart */}
      <section className="space-y-3">
        <SectionTitle>Visites quotidiennes</SectionTitle>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <AreaChart
            data={daily.visitSeries}
            color="#C56A2D"
            fill="rgba(197,106,45,0.18)"
            yFormat={(v) => `${Math.round(v)}`}
          />
        </div>
      </section>

      {/* Devices + Browsers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-3">
          <SectionTitle>Par type d'appareil</SectionTitle>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <DeviceLine icon={Monitor}    label="Ordinateur" count={desktop} total={deviceTotal} />
            <DeviceLine icon={Smartphone} label="Mobile"     count={mobile}  total={deviceTotal} />
            <DeviceLine icon={Tablet}     label="Tablette"   count={tablet}  total={deviceTotal} />
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Par navigateur</SectionTitle>
          <RankedCard
            items={kpi.browserStats.map(b => ({ label: b._id || 'Inconnu', value: b.count }))}
            icon={Chrome}
            emptyText="Aucun navigateur détecté"
          />
        </section>
      </div>

      {/* Countries + Cities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-3">
          <SectionTitle>Visites par pays</SectionTitle>
          <RankedCard
            items={kpi.countryStats.map(c => ({ label: c._id || 'Inconnu', value: c.count }))}
            icon={Globe}
            emptyText="Aucun pays détecté"
          />
        </section>

        <section className="space-y-3">
          <SectionTitle>Visites par ville</SectionTitle>
          <RankedCard
            items={kpi.cityVisitStats.map(c => ({ label: c._id || 'Inconnu', value: c.count }))}
            icon={MapPin}
            emptyText="Aucune ville détectée"
          />
        </section>
      </div>

      {/* Traffic sources + Languages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-3">
          <SectionTitle>Canal / Référent</SectionTitle>
          <RankedCard
            items={kpi.trafficSources.map(s => ({
              label: prettifyReferrer(s._id),
              value: s.count,
            }))}
            icon={Globe}
            emptyText="Aucun référent détecté"
          />
        </section>

        <section className="space-y-3">
          <SectionTitle>Par langue</SectionTitle>
          <RankedCard
            items={kpi.languageStats.map(l => ({ label: l._id || 'Inconnu', value: l.count }))}
            icon={Languages}
            emptyText="Aucune langue détectée"
          />
        </section>
      </div>

      {/* Top pages + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-3">
          <SectionTitle>Pages les plus vues</SectionTitle>
          <RankedCard
            items={kpi.topPages.map(p => ({ label: p._id || '/', value: p.count }))}
            icon={FileText}
            emptyText="Aucune page visitée"
          />
        </section>

        <section className="space-y-3">
          <SectionTitle>Produits les plus vus</SectionTitle>
          <RankedCard
            items={kpi.visitsPerProduct.slice(0, 8).map(p => ({
              label: p.name || 'Sans nom',
              value: p.visits,
              sub: `${fmtNumber(p.uniqueVisitorCount || 0)} visiteurs uniques`,
            }))}
            icon={Package}
            emptyText="Aucun produit consulté"
          />
        </section>
      </div>
    </div>
  );
}

const DeviceLine = ({ icon: Icon, label, count, total }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">
          <Icon className="w-4 h-4 text-primary-600" />
          {label}
        </span>
        <span className="text-gray-500">{fmtNumber(count)} · {pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: '#0F6B4F' }}
        />
      </div>
    </div>
  );
};

const RankedCard = ({ items, icon: Icon, emptyText = 'Aucune donnée', valueFormatter = fmtNumber }) => {
  if (!items || items.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl py-10 flex items-center justify-center text-sm text-gray-400">
        {emptyText}
      </div>
    );
  }
  const max = Math.max(...items.map(i => i.value), 1);
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      {items.slice(0, 8).map((it, i) => {
        const pct = (it.value / total) * 100;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
              <span className="flex items-center gap-1.5 text-gray-700 truncate min-w-0">
                {Icon && <Icon className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />}
                <span className="truncate font-medium" title={it.label}>{it.label}</span>
                {it.sub && <span className="text-[10px] text-gray-400 truncate">· {it.sub}</span>}
              </span>
              <span className="text-gray-500 flex-shrink-0 font-semibold">
                {valueFormatter(it.value)} <span className="text-gray-400 font-normal">· {pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full"
                style={{ width: `${(it.value / max) * 100}%`, background: '#0F6B4F' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

function prettifyReferrer(ref) {
  if (!ref) return 'Accès direct';
  try {
    const u = new URL(ref.startsWith('http') ? ref : `https://${ref}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return ref;
  }
}

function formatChannelLabel(channel) {
  const key = String(channel || '').toLowerCase();
  if (key === 'store') return 'Boutique en ligne';
  if (key === 'whatsapp') return 'WhatsApp';
  if (key === 'manual') return 'Ajout manuel';
  if (key === 'google_sheets') return 'Google Sheets';
  if (key === 'shopify') return 'Shopify';
  if (key === 'webhook') return 'Webhook';
  if (key === 'skelor') return 'Scalor Store';
  return channel || 'Canal inconnu';
}

/* ═══════════════════════════════════════════════════════════════
 *  Clients tab — COD customer loyalty
 * ═══════════════════════════════════════════════════════════════ */
function CustomersTab({ kpi, fmtCurrency }) {
  const [sub, setSub] = useState('all');
  const subs = [
    { key: 'all',       label: 'Tous les clients' },
    { key: 'new',       label: 'Nouveaux' },
    { key: 'returning', label: 'Récurrents' },
  ];
  const newCustomers = Math.max(0, kpi.uniqueCustomers - kpi.repeatCustomers);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card value={fmtNumber(kpi.uniqueCustomers)} label="Clients uniques" highlight />
        <Card value={fmtNumber(newCustomers)}        label="Nouveaux clients" />
        <Card value={fmtNumber(kpi.repeatCustomers)} label="Clients récurrents" accent="green" />
        <Card value={fmtPct(kpi.repeatRate)}         label="Taux de fidélité" />
      </div>

      <div className="flex items-center gap-1.5">
        {subs.map(s => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              sub === s.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <EmptyRow text="La liste détaillée des clients sera disponible prochainement" />

      <section className="space-y-3">
        <SectionTitle>Meilleures villes</SectionTitle>
        {kpi.topCities.length === 0 ? (
          <EmptyRow />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            {kpi.topCities.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-700 font-medium">
                  <MapPin className="w-4 h-4 text-primary-600" />
                  {c.name}
                </span>
                <span className="text-gray-500">{fmtNumber(c.count)} commandes · {fmtCurrency(c.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const ChannelRow = ({ icon, label, count, pct, color }) => (
  <div>
    <div className="flex items-center justify-between text-xs mb-1.5">
      <span className="flex items-center gap-1.5 font-medium text-gray-700">{icon}{label}</span>
      <span className="text-gray-500">{fmtNumber(count)} · {pct.toFixed(0)}%</span>
    </div>
    <div className="h-2 bg-gray-100 rounded overflow-hidden">
      <div className="h-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  </div>
);

const StatusCard = ({ icon: Icon, label, count, tone = 'gray' }) => {
  const tones = {
    gray:   'bg-white border-gray-200 text-gray-700',
    green:  'bg-white border-gray-200 text-gray-700',
    copper: 'bg-white border-gray-200 text-gray-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4" />
        <span className="text-xl font-bold">{fmtNumber(count)}</span>
      </div>
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
 *  Smooth area chart (SVG)
 * ═══════════════════════════════════════════════════════════════ */
function AreaChart({ data, color = '#10b981', fill = 'rgba(16,185,129,0.15)', yFormat = (v) => v }) {
  const W = 760;
  const H = 260;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  if (!data || data.length === 0) {
    return <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">Aucune donnée</div>;
  }

  const max = Math.max(...data.map(d => d.value), 1);
  const yTicks = 5;
  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padL + i * xStep,
    y: padT + innerH - (d.value / max) * innerH,
    label: d.label,
    value: d.value,
  }));

  // Smoothed path via quadratic midpoints
  const smoothPath = () => {
    if (points.length === 0) return '';
    let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      const mx = (points[i - 1].x + points[i].x) / 2;
      const my = (points[i - 1].y + points[i].y) / 2;
      path += ` Q ${points[i - 1].x.toFixed(1)},${points[i - 1].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    path += ` L ${points[points.length - 1].x.toFixed(1)},${points[points.length - 1].y.toFixed(1)}`;
    return path;
  };

  const linePath = smoothPath();
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)},${padT + innerH} L ${points[0].x.toFixed(1)},${padT + innerH} Z`;

  const xLabelEvery = Math.max(1, Math.floor(data.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = (max / yTicks) * i;
        const y = padT + innerH - (v / max) * innerH;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={padL - 6} y={y + 3} fontSize="10" textAnchor="end" fill="#9ca3af">{yFormat(v)}</text>
          </g>
        );
      })}

      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => {
        if (i % xLabelEvery !== 0 && i !== data.length - 1) return null;
        const x = padL + i * xStep;
        return (
          <text key={i} x={x} y={H - 10} fontSize="10" textAnchor="middle" fill="#9ca3af">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Helpers
 * ═══════════════════════════════════════════════════════════════ */
function buildDailySeries(timeline, startDate, endDate, dailyVisits = [], ordersData = {}) {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const useMonthlyBuckets = days > 120;
  const useWeeklyBuckets = !useMonthlyBuckets && days > 45;

  const toBucketKey = (dateLike) => {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return null;
    if (useMonthlyBuckets) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    if (useWeeklyBuckets) {
      const bucketStart = new Date(d);
      bucketStart.setHours(0, 0, 0, 0);
      bucketStart.setDate(bucketStart.getDate() - bucketStart.getDay());
      return toDateInput(bucketStart);
    }
    return toDateInput(d);
  };

  const toBucketLabel = (key) => {
    if (useMonthlyBuckets) {
      const [year, month] = key.split('-');
      const sample = new Date(Number(year), Number(month) - 1, 1);
      return sample.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    }
    const sample = new Date(key);
    if (useWeeklyBuckets) {
      return `Sem ${sample.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`;
    }
    return sample.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  // Aggregate timeline counts per day
  const byDate = {};
  const ordersByDate = {};
  (timeline || []).forEach((t) => {
    const d = t._id?.date || t.date;
    if (!d) return;
    const isOrder = t._id?.eventType === 'order_placed';
    const bucketKey = toBucketKey(d);
    if (!bucketKey) return;
    byDate[bucketKey] = (byDate[bucketKey] || 0) + (t.count || 0);
    if (isOrder) ordersByDate[bucketKey] = (ordersByDate[bucketKey] || 0) + (t.count || 0);
  });

  // Use real order revenue data from backend when available
  const dailyRevenue = Object.entries(ordersData.dailyRevenue || {}).reduce((acc, [key, value]) => {
    const bucketKey = toBucketKey(key);
    if (!bucketKey) return acc;
    acc[bucketKey] = (acc[bucketKey] || 0) + (value || 0);
    return acc;
  }, {});
  const dailyOrders  = Object.entries(ordersData.dailyOrders || {}).reduce((acc, [key, value]) => {
    const bucketKey = toBucketKey(key);
    if (!bucketKey) return acc;
    acc[bucketKey] = (acc[bucketKey] || 0) + (value || 0);
    return acc;
  }, {});

  // Prefer the dedicated dailyVisits aggregation (unique visitors) when provided.
  const visitsByDate = {};
  (dailyVisits || []).forEach((v) => {
    const d = v._id || v.date;
    if (!d) return;
    const bucketKey = toBucketKey(d);
    if (!bucketKey) return;
    visitsByDate[bucketKey] = (visitsByDate[bucketKey] || 0) + (v.uniqueCount ?? v.count ?? 0);
  });

  const bucketMap = new Map();
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = toBucketKey(cursor);
    if (key && !bucketMap.has(key)) {
      bucketMap.set(key, { label: toBucketLabel(key), value: 0, visits: 0, orders: 0 });
    }

    if (useMonthlyBuckets) {
      cursor.setMonth(cursor.getMonth() + 1, 1);
    } else if (useWeeklyBuckets) {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  for (const [key, point] of bucketMap.entries()) {
    point.value = dailyRevenue[key] || ordersByDate[key] || 0;
    point.visits = visitsByDate[key] ?? byDate[key] ?? 0;
    point.orders = dailyOrders[key] || ordersByDate[key] || 0;
  }

  const series = Array.from(bucketMap.values()).map(({ label, value, orders }) => ({ label, value, orders }));
  const visitSeries = Array.from(bucketMap.values()).map(({ label, visits }) => ({ label, value: visits }));
  return { series, visitSeries };
}

function buildBoutiqueSalesDetails(payload) {
  const orders = Array.isArray(payload?.orders) ? payload.orders : [];
  if (orders.length === 0) return null;

  const normalizeStatus = (status) => {
    const raw = String(status || '').trim().toLowerCase();
    if (raw.includes('livr') || raw === 'delivered' || raw === 'paid' || raw.includes('encaiss')) return 'delivered';
    if (raw.includes('annul') || raw.includes('cancel') || raw.includes('refus') || raw.includes('rejet')) return 'cancelled';
    if (raw.includes('exp') || raw.includes('ship') || raw.includes('route') || raw.includes('transit')) return 'shipped';
    if (raw.includes('confirm') || raw.includes('valid') || raw.includes('accept')) return 'confirmed';
    return 'pending';
  };

  const normalizeChannel = (order) => {
    const source = String(order.source || '').toLowerCase();
    const rawChannel = String(order.rawData?.channel || '').toLowerCase();
    if (rawChannel === 'whatsapp') return 'whatsapp';
    if (source === 'boutique' || source === 'skelor') return 'store';
    return source || 'store';
  };

  const normalized = orders.map((order) => {
    const status = normalizeStatus(order.status);
    const quantity = Number(order.quantity || 1);
    const unitPrice = Number(order.price || 0);
    const total = unitPrice * quantity;
    const dateValue = order.date || order.createdAt;
    return {
      ...order,
      status,
      quantity,
      total,
      channel: normalizeChannel(order),
      dateValue,
      productName: String(order.product || '').trim(),
    };
  });

  const deliveredOrders = normalized.filter((order) => order.status === 'delivered');
  const orderStats = normalized.reduce((acc, order) => {
    acc.total += 1;
    acc[order.status] = (acc[order.status] || 0) + 1;
    if (order.status === 'delivered') acc.totalRevenue += order.total;
    return acc;
  }, { total: 0, pending: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0, totalRevenue: 0 });
  orderStats.avgOrderValue = deliveredOrders.length > 0 ? orderStats.totalRevenue / deliveredOrders.length : 0;

  const productMap = normalized.reduce((acc, order) => {
    if (!order.productName) return acc;
    if (!acc[order.productName]) {
      acc[order.productName] = { name: order.productName, sold: 0, revenue: 0 };
    }
    acc[order.productName].sold += order.quantity;
    if (order.status === 'delivered') {
      acc[order.productName].revenue += order.total;
    }
    return acc;
  }, {});
  const allProducts = Object.values(productMap);

  const channelMap = normalized.reduce((acc, order) => {
    const key = order.channel || 'store';
    if (!acc[key]) {
      acc[key] = { channel: key, orders: 0, revenue: 0, deliveredRevenue: 0 };
    }
    acc[key].orders += 1;
    acc[key].revenue += order.total;
    if (order.status === 'delivered') acc[key].deliveredRevenue += order.total;
    return acc;
  }, {});

  const trendMap = deliveredOrders.reduce((acc, order) => {
    const date = new Date(order.dateValue);
    if (Number.isNaN(date.getTime())) return acc;
    const key = toDateInput(date);
    acc[key] = (acc[key] || 0) + order.total;
    return acc;
  }, {});

  return {
    orderStats,
    topProductsBySales: allProducts.sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 10),
    topProductsByRevenue: [...allProducts].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 10),
    leastProductsBySales: [...allProducts]
      .filter((item) => (item.sold || 0) > 0)
      .sort((a, b) => (a.sold || 0) - (b.sold || 0) || (b.revenue || 0) - (a.revenue || 0))
      .slice(0, 10),
    channelPerformance: Object.values(channelMap).sort((a, b) => (b.orders || 0) - (a.orders || 0)),
    salesTrendSeries: Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        label: new Date(key).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        value,
      })),
  };
}
