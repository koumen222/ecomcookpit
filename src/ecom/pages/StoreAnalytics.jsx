import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Calendar, Filter, Info, Loader2, LayoutGrid, ShoppingBag,
  Truck, Users, Target, ChevronRight, Package, PhoneCall,
  MapPin, CheckCircle2, XCircle, MessageCircle, Eye, Globe,
  Monitor, Smartphone, Tablet, Chrome, Languages, FileText,
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';

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

const fmtCurrency = (n) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n || 0))} FCFA`;
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
  const workspaceId = workspace?._id;

  const [activeTab, setActiveTab] = useState('summary');
  const [presetKey, setPresetKey] = useState('30d');
  const [endDate, setEndDate]     = useState(toDateInput(new Date()));
  const [startDate, setStartDate] = useState(toDateInput(new Date(Date.now() - 30 * 86400000)));
  const [loading, setLoading]     = useState(false);
  const [data, setData]           = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const pickerRef = useRef(null);

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
        const res = await ecomApi.get('/store-analytics/dashboard', {
          params: { workspaceId, startDate, endDate },
        });
        if (cancelled) return;
        setData(res.data);
      } catch (err) {
        if (cancelled) return;
        console.error('Analytics load error', err);
        setData({ analytics: { overview: {}, timeline: [], deviceStats: [], visitsPerProduct: [], topProducts: [] }, orders: {} });
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

  const daily = useMemo(() => buildDailySeries(timeline, startDate, endDate, analytics.dailyVisits), [timeline, startDate, endDate, analytics.dailyVisits]);

  const kpi = {
    // Revenue (COD)
    potentialRevenue: orders.potentialRevenue ?? orders.totalRevenue ?? 0,
    realizedRevenue:  orders.realizedRevenue  ?? 0,  // delivered only (cash in hand)
    averageBasket:    orders.averageOrderValue ?? 0,
    averageDelivered: orders.averageDeliveredValue ?? 0,
    shippingCost:     orders.shippingCost ?? 0,
    // Order counts
    totalOrders:      orders.total ?? 0,
    pending:          orders.pending ?? 0,
    confirmed:        orders.confirmed ?? 0,
    processing:       orders.processing ?? 0,
    shipped:          orders.shipped ?? 0,
    delivered:        orders.delivered ?? 0,
    cancelled:        orders.cancelled ?? 0,
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
    <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-5">
      {/* ─── Date range + filter ───────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1" ref={pickerRef}>
          <button
            onClick={() => setDatePickerOpen(v => !v)}
            className="w-full flex items-center gap-2.5 px-4 py-3 bg-white border border-gray-200 rounded-full text-sm text-gray-800 hover:border-primary-300 hover:shadow-sm transition"
          >
            <Calendar className="w-4 h-4 text-primary-600" />
            <span className="font-medium">{dateRangeLabel}</span>
            <span className="ml-auto text-xs text-gray-400">
              {fmtDateLabel(startDate)} – {fmtDateLabel(endDate)}
            </span>
          </button>
          {datePickerOpen && (
            <div className="absolute z-30 mt-2 left-0 right-0 sm:right-auto sm:min-w-[560px] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden flex flex-col sm:flex-row">
              {/* Presets sidebar */}
              <div className="w-full sm:w-60 bg-scalor-sand-light/40 p-2 sm:border-r border-gray-100">
                <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Périodes rapides</p>
                <ul className="space-y-0.5">
                  {DATE_PRESETS.map(p => {
                    const selected = p.key === presetKey;
                    return (
                      <li key={p.key}>
                        <button
                          onClick={() => applyPreset(p.key)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                            selected
                              ? 'bg-primary-500 text-white font-semibold shadow-sm'
                              : 'text-gray-700 hover:bg-white hover:text-primary-700'
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
                    className="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => setDatePickerOpen(false)}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg text-xs font-semibold hover:bg-primary-600 shadow-sm"
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <button className="relative p-3 bg-white border border-gray-200 rounded-full hover:border-primary-300 hover:shadow-sm transition">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-scalor-copper rounded-full" />
        </button>
      </div>

      {/* ─── Tabs ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                active
                  ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/20'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-200 hover:text-primary-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : t.iconClass}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── Tab content ────────────────────────────────────────── */}
      {loading && !data ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {activeTab === 'summary'   && <SummaryTab kpi={kpi} daily={daily} />}
          {activeTab === 'sales'     && <SalesTab kpi={kpi} daily={daily} />}
          {activeTab === 'orders'    && <OrdersTab kpi={kpi} />}
          {activeTab === 'delivery'  && <DeliveryTab kpi={kpi} />}
          {activeTab === 'visits'    && <VisitsTab kpi={kpi} daily={daily} />}
          {activeTab === 'customers' && <CustomersTab kpi={kpi} />}
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
    default: 'bg-scalor-sand-light/50 hover:bg-scalor-sand-light',
    green:   'bg-primary-50 hover:bg-primary-100/70',
    copper:  'bg-orange-50 hover:bg-orange-100/60',
  };
  return (
    <div className={`rounded-2xl p-5 relative min-h-[118px] transition-colors ${accents[accent] || accents.default}`}>
      <p className={`text-[26px] leading-tight font-bold mb-2 text-scalor-black ${
        highlight ? 'ring-2 ring-primary-500 rounded-md px-2 -mx-2 inline-block' : ''
      }`}>
        {value}
      </p>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <Info className="w-3.5 h-3.5 text-gray-400/60 absolute bottom-4 right-4" />
    </div>
  );
};

const SectionTitle = ({ children }) => (
  <h2 className="text-[15px] font-semibold text-scalor-black flex items-center gap-2">
    <span className="w-1 h-5 bg-primary-500 rounded-full" />
    {children}
  </h2>
);

const EmptyRow = ({ text = 'Aucune donnée disponible' }) => (
  <div className="bg-white border border-gray-200 rounded-2xl py-10 flex items-center justify-center text-sm text-gray-400">
    {text}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
 *  Résumé tab — COD overview
 * ═══════════════════════════════════════════════════════════════ */
function SummaryTab({ kpi, daily }) {
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
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <AreaChart data={daily.series} color="#0F6B4F" fill="rgba(15,107,79,0.14)" yFormat={(v) => fmtCompactCurrency(v)} />
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Ventes tab — COD revenue
 * ═══════════════════════════════════════════════════════════════ */
function SalesTab({ kpi, daily }) {
  const realizedPct = kpi.potentialRevenue > 0
    ? (kpi.realizedRevenue / kpi.potentialRevenue) * 100
    : 0;

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
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <AreaChart data={daily.series} color="#0F6B4F" fill="rgba(15,107,79,0.14)" yFormat={(v) => fmtCompactCurrency(v)} />
        </div>
      </section>
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
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
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
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${s.color} 0%, #14855F 100%)` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Canal de commande</SectionTitle>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
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
function DeliveryTab({ kpi }) {
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
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
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
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(c.count / maxCount) * 100}%`, background: 'linear-gradient(90deg, #0F6B4F 0%, #14855F 100%)' }}
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
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
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
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
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
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0F6B4F 0%, #14855F 100%)' }}
        />
      </div>
    </div>
  );
};

const RankedCard = ({ items, icon: Icon, emptyText = 'Aucune donnée' }) => {
  if (!items || items.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl py-10 flex items-center justify-center text-sm text-gray-400">
        {emptyText}
      </div>
    );
  }
  const max = Math.max(...items.map(i => i.value), 1);
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
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
                {fmtNumber(it.value)} <span className="text-gray-400 font-normal">· {pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(it.value / max) * 100}%`, background: 'linear-gradient(90deg, #0F6B4F 0%, #14855F 100%)' }}
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

/* ═══════════════════════════════════════════════════════════════
 *  Clients tab — COD customer loyalty
 * ═══════════════════════════════════════════════════════════════ */
function CustomersTab({ kpi }) {
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
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              sub === s.key
                ? 'bg-scalor-black text-white shadow-sm'
                : 'text-gray-600 hover:bg-scalor-sand-light'
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
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
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
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  </div>
);

const StatusCard = ({ icon: Icon, label, count, tone = 'gray' }) => {
  const tones = {
    gray:   'bg-gray-50 text-gray-700',
    green:  'bg-primary-50 text-primary-700',
    copper: 'bg-orange-50 text-scalor-copper-dark',
  };
  return (
    <div className={`rounded-xl p-4 ${tones[tone]}`}>
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
function buildDailySeries(timeline, startDate, endDate, dailyVisits = []) {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);

  // Aggregate timeline counts per day
  const byDate = {};
  const ordersByDate = {};
  (timeline || []).forEach((t) => {
    const d = t._id?.date || t.date;
    if (!d) return;
    const isOrder = t._id?.eventType === 'order_placed';
    byDate[d] = (byDate[d] || 0) + (t.count || 0);
    if (isOrder) ordersByDate[d] = (ordersByDate[d] || 0) + (t.count || 0);
  });

  // Prefer the dedicated dailyVisits aggregation (unique visitors) when provided.
  const visitsByDate = {};
  (dailyVisits || []).forEach((v) => {
    const d = v._id || v.date;
    if (!d) return;
    visitsByDate[d] = v.uniqueCount ?? v.count ?? 0;
  });

  const series = [];
  const visitSeries = [];
  for (let i = 0; i < Math.min(days, 60); i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = toDateInput(d);
    const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    series.push({ label, value: ordersByDate[key] || 0 });
    visitSeries.push({
      label,
      value: visitsByDate[key] ?? byDate[key] ?? 0,
    });
  }
  return { series, visitSeries };
}
