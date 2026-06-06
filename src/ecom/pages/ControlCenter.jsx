import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  FileText,
  MapPin,
  Megaphone,
  Package,
  PackageCheck,
  Plus,
  RotateCcw,
  Save,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';

const STORAGE_KEY = 'scalor_control_center_v1';
const PROFIT_TARGET = 4000;
const CITIES = ['Douala', 'Yaoundé'];
const OFFER_TYPES = ['simple', '1 acheté = 1 offert'];
const ORDER_STATUSES = [
  'Nouvelle',
  'Appelée',
  'Confirmée',
  'Stock réservé',
  'Remise au livreur',
  'Livrée encaissée',
  'Non livrée',
  'Annulée',
  'À relancer',
  'Rupture stock',
];
const AD_DECISIONS = ['Augmenter', 'Garder', 'Réduire', 'Couper', 'Tester autre créa'];
const DELIVERY_STATUSES = ['En cours', 'Terminé', 'Problème', 'Retours à récupérer', 'Argent à récupérer'];
const TEAM_ROLES = [
  'Responsable Closing & Stock',
  'Closeuse principale',
  'Closeuse secondaire',
  'Comptable',
  'Livreur Douala',
  'Agence Yaoundé',
];

const today = () => new Date().toISOString().slice(0, 10);

const createInitialData = () => ({
  products: [
    { id: 'prd-gel', name: 'Gel exfoliant', price: 12500, cost: 3500, offer: '1 acheté = 1 offert', deliveryCost: 1500, teamFees: 900 },
    { id: 'prd-deo', name: 'Déo', price: 15000, cost: 2000, offer: '1 acheté = 1 offert', deliveryCost: 1500, teamFees: 900 },
    { id: 'prd-mullein', name: 'Mullein', price: 12900, cost: 3000, offer: 'simple', deliveryCost: 1500, teamFees: 900 },
    { id: 'prd-magnesium', name: 'Magnésium', price: 11900, cost: 2500, offer: 'simple', deliveryCost: 1500, teamFees: 900 },
  ],
  stockRows: [
    { id: 'stk-1', date: today(), city: 'Douala', productId: 'prd-gel', stockStart: 80, entries: 0, courierOut: 18, delivered: 11, returns: 3, finalReal: 65, responsible: 'Responsable stock' },
    { id: 'stk-2', date: today(), city: 'Yaoundé', productId: 'prd-gel', stockStart: 28, entries: 0, courierOut: 12, delivered: 7, returns: 2, finalReal: 18, responsible: 'Agence Yaoundé' },
    { id: 'stk-3', date: today(), city: 'Douala', productId: 'prd-deo', stockStart: 64, entries: 0, courierOut: 20, delivered: 14, returns: 3, finalReal: 47, responsible: 'Responsable stock' },
    { id: 'stk-4', date: today(), city: 'Yaoundé', productId: 'prd-deo', stockStart: 0, entries: 0, courierOut: 0, delivered: 0, returns: 0, finalReal: 0, responsible: 'Agence Yaoundé' },
    { id: 'stk-5', date: today(), city: 'Douala', productId: 'prd-mullein', stockStart: 26, entries: 0, courierOut: 9, delivered: 5, returns: 1, finalReal: 18, responsible: 'Responsable stock' },
    { id: 'stk-6', date: today(), city: 'Yaoundé', productId: 'prd-magnesium', stockStart: 8, entries: 0, courierOut: 4, delivered: 2, returns: 0, finalReal: 4, responsible: 'Agence Yaoundé' },
  ],
  orders: [
    { id: 'ord-1', date: today(), clientName: 'Client Douala 01', phone: '690000001', city: 'Douala', district: 'Akwa', productId: 'prd-deo', amount: 15000, closer: 'Amina', status: 'Livrée encaissée', stockReserved: true, carrier: 'Livreur Douala', deliveryDate: today(), deliveryResult: 'Livrée', cashCollected: 15000, problem: '' },
    { id: 'ord-2', date: today(), clientName: 'Client Yaoundé 02', phone: '690000002', city: 'Yaoundé', district: 'Mvan', productId: 'prd-gel', amount: 12500, closer: 'Prisca', status: 'Confirmée', stockReserved: true, carrier: 'Agence Yaoundé', deliveryDate: today(), deliveryResult: 'Prévue', cashCollected: 0, problem: '' },
    { id: 'ord-3', date: today(), clientName: 'Client Douala 03', phone: '690000003', city: 'Douala', district: 'Bonamoussadi', productId: 'prd-mullein', amount: 12900, closer: 'Amina', status: 'Livrée encaissée', stockReserved: true, carrier: 'Livreur Douala', deliveryDate: today(), deliveryResult: 'Livrée', cashCollected: 12900, problem: '' },
  ],
  ads: [
    { id: 'ad-1', date: today(), productId: 'prd-deo', city: 'Douala', budget: 18000, generated: 12, confirmed: 8, delivered: 6, revenue: 90000, decision: 'Augmenter', note: 'Bon coût livré' },
    { id: 'ad-2', date: today(), productId: 'prd-gel', city: 'Yaoundé', budget: 14000, generated: 8, confirmed: 5, delivered: 2, revenue: 25000, decision: 'Réduire', note: 'Stock à surveiller' },
    { id: 'ad-3', date: today(), productId: 'prd-magnesium', city: 'Yaoundé', budget: 6000, generated: 4, confirmed: 2, delivered: 0, revenue: 0, decision: 'Couper', note: 'Pas de vente livrée' },
  ],
  deliveries: [
    { id: 'del-1', date: today(), city: 'Douala', carrier: 'Livreur Douala', productId: 'prd-deo', received: 14, delivered: 11, returns: 2, expectedCash: 165000, cashCollected: 165000, problem: '', status: 'Terminé' },
    { id: 'del-2', date: today(), city: 'Yaoundé', carrier: 'Agence Yaoundé', productId: 'prd-gel', received: 8, delivered: 3, returns: 3, expectedCash: 62500, cashCollected: 37500, problem: 'Retours à confirmer', status: 'Retours à récupérer' },
  ],
  finances: [
    { id: 'fin-1', date: today(), revenue: 127900, adsSpent: 38000, productCost: 25500, deliveryPaid: 12000, salaries: 7000, transport: 3000, misc: 2000, cashAvailable: 40400, cashPub: 12000, cashStock: 15000, cashDelivery: 5000, cashSalaries: 4000, cashProfit: 4400 },
  ],
  team: [
    { id: 'team-1', name: 'Amina', role: 'Closeuse principale', city: 'Douala', dailyGoal: 12, handled: 18, confirmed: 11, delivered: 8, revenue: 119000, problems: '' },
    { id: 'team-2', name: 'Prisca', role: 'Closeuse secondaire', city: 'Yaoundé', dailyGoal: 8, handled: 11, confirmed: 5, delivered: 2, revenue: 25000, problems: 'Relances en retard' },
    { id: 'team-3', name: 'Livreur Douala', role: 'Livreur Douala', city: 'Douala', dailyGoal: 12, handled: 14, confirmed: 14, delivered: 11, revenue: 165000, problems: '' },
  ],
  report: {
    date: today(),
    revenue: 0,
    realProfit: 0,
    adsSpent: 0,
    generated: 0,
    confirmed: 0,
    delivered: 0,
    deliveryRate: 0,
    winnerProduct: '',
    productToCut: '',
    productToReorder: '',
    criticalStock: '',
    mainProblem: '',
    tomorrowDecision: '',
  },
});

const emptyProductForm = () => ({
  name: '',
  price: '',
  cost: '',
  offer: 'simple',
  deliveryCost: '1500',
  teamFees: '900',
});

const emptyStockForm = () => ({
  date: today(),
  city: 'Douala',
  productId: '',
  stockStart: '',
  entries: '0',
  courierOut: '0',
  delivered: '0',
  returns: '0',
  finalReal: '',
  responsible: '',
});

const emptyOrderForm = () => ({
  date: today(),
  clientName: '',
  phone: '',
  city: 'Douala',
  district: '',
  productId: '',
  amount: '',
  closer: '',
  status: 'Nouvelle',
  carrier: '',
  deliveryDate: today(),
  deliveryResult: '',
  cashCollected: '0',
  problem: '',
});

const emptyAdForm = () => ({
  date: today(),
  productId: '',
  city: 'Douala',
  budget: '',
  generated: '',
  confirmed: '',
  delivered: '',
  revenue: '',
  decision: 'Garder',
  note: '',
});

const emptyDeliveryForm = () => ({
  date: today(),
  city: 'Douala',
  carrier: '',
  productId: '',
  received: '',
  delivered: '',
  returns: '0',
  expectedCash: '',
  cashCollected: '',
  problem: '',
  status: 'En cours',
});

const emptyFinanceForm = () => ({
  date: today(),
  revenue: '',
  adsSpent: '',
  productCost: '',
  deliveryPaid: '',
  salaries: '',
  transport: '0',
  misc: '0',
  cashAvailable: '',
});

const emptyTeamForm = () => ({
  name: '',
  role: 'Closeuse principale',
  city: 'Douala',
  dailyGoal: '',
  handled: '',
  confirmed: '',
  delivered: '',
  revenue: '',
  problems: '',
});

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return `${Math.round(asNumber(value)).toLocaleString('fr-FR')} FCFA`;
}

function percent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function productName(products, productId) {
  return products.find((product) => product.id === productId)?.name || 'Produit inconnu';
}

function isReservedStatus(status) {
  return ['Confirmée', 'Stock réservé', 'Remise au livreur', 'Livrée encaissée'].includes(status);
}

function stockTheory(row) {
  return asNumber(row.stockStart) + asNumber(row.entries) - asNumber(row.courierOut) + asNumber(row.returns);
}

function stockGap(row) {
  return asNumber(row.finalReal) - stockTheory(row);
}

function stockStatus(row) {
  const finalStock = asNumber(row.finalReal);
  const base = Math.max(asNumber(row.stockStart) + asNumber(row.entries), 1);
  const ratio = finalStock / base;
  if (finalStock <= 0) return { label: 'Rupture', tone: 'red' };
  if (ratio <= 0.3 || finalStock <= 5) return { label: 'Rouge', tone: 'red' };
  if (ratio <= 0.6 || finalStock <= 15) return { label: 'Orange', tone: 'orange' };
  return { label: 'Vert', tone: 'green' };
}

function stockPubDecision(row) {
  const status = stockStatus(row);
  if (status.label === 'Rupture' || status.tone === 'red') return { label: 'Coupée', tone: 'red' };
  if (status.tone === 'orange') return { label: 'Réduite', tone: 'orange' };
  return { label: 'Autorisée', tone: 'green' };
}

function deliveryRateFrom(received, delivered) {
  const total = asNumber(received);
  if (!total) return 0;
  return (asNumber(delivered) / total) * 100;
}

function teamPerformance(member) {
  const goal = Math.max(asNumber(member.dailyGoal), 1);
  const deliveredRate = (asNumber(member.delivered) / goal) * 100;
  if (deliveredRate >= 90) return { label: 'Excellente', tone: 'green' };
  if (deliveredRate >= 65) return { label: 'Correcte', tone: 'orange' };
  if (deliveredRate >= 40) return { label: 'À surveiller', tone: 'orange' };
  return { label: 'Faible', tone: 'red' };
}

function Badge({ children, tone = 'gray' }) {
  const classes = {
    green: 'border-green-200 bg-green-50 text-green-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    gray: 'border-gray-200 bg-gray-50 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${classes[tone] || classes.gray}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone === 'green' ? 'bg-green-500' : tone === 'orange' ? 'bg-orange-500' : tone === 'red' ? 'bg-red-500' : 'bg-gray-400'}`} />
      {children}
    </span>
  );
}

function KpiCard({ title, value, detail, tone = 'gray', icon: Icon }) {
  const toneClasses = {
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
    gray: 'bg-gray-100 text-gray-700',
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-gray-500">{title}</p>
          <p className="mt-2 text-xl font-bold text-gray-900 tabular-nums">{value}</p>
          {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
        </div>
        {Icon && (
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${toneClasses[tone] || toneClasses.gray}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Input({ label, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      <input
        {...props}
        className="min-h-[40px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
      />
    </label>
  );
}

function Select({ label, className = '', children, ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      <select
        {...props}
        className="min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
      >
        {children}
      </select>
    </label>
  );
}

function TableShell({ children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">{children}</table>
      </div>
    </div>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th className={`whitespace-nowrap bg-gray-50 px-3 py-3 text-${align} text-[11px] font-bold uppercase text-gray-500`}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', className = '' }) {
  return <td className={`whitespace-nowrap px-3 py-3 text-${align} ${className}`}>{children}</td>;
}

export default function ControlCenter() {
  const [data, setData] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...createInitialData(), ...JSON.parse(stored) };
    } catch {
      return createInitialData();
    }
    return createInitialData();
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingProductId, setEditingProductId] = useState(null);
  const [editingStockId, setEditingStockId] = useState(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
  const [adForm, setAdForm] = useState(emptyAdForm);
  const [deliveryForm, setDeliveryForm] = useState(emptyDeliveryForm);
  const [financeForm, setFinanceForm] = useState(emptyFinanceForm);
  const [teamForm, setTeamForm] = useState(emptyTeamForm);

  const { products, stockRows, orders, ads, deliveries, finances, team, report } = data;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const derived = useMemo(() => {
    const stockByProduct = new Map();
    const stockByProductCity = new Map();

    stockRows.forEach((row) => {
      const finalStock = asNumber(row.finalReal);
      stockByProduct.set(row.productId, (stockByProduct.get(row.productId) || 0) + finalStock);
      stockByProductCity.set(`${row.productId}:${row.city}`, (stockByProductCity.get(`${row.productId}:${row.city}`) || 0) + finalStock);
    });

    const adsByProduct = new Map();
    ads.forEach((ad) => {
      const current = adsByProduct.get(ad.productId) || { budget: 0, delivered: 0 };
      current.budget += asNumber(ad.budget);
      current.delivered += asNumber(ad.delivered);
      adsByProduct.set(ad.productId, current);
    });

    const productRows = products.map((product) => {
      const physicalStock = stockByProduct.get(product.id) || 0;
      const possibleSales = product.offer === '1 acheté = 1 offert' ? Math.floor(physicalStock / 2) : physicalStock;
      const grossMargin = asNumber(product.price) - asNumber(product.cost);
      const adStats = adsByProduct.get(product.id) || { budget: 0, delivered: 0 };
      const adCostDelivered = adStats.delivered > 0 ? adStats.budget / adStats.delivered : null;
      const pubMaxIdeal = Math.max(0, grossMargin - asNumber(product.deliveryCost) - asNumber(product.teamFees) - PROFIT_TARGET);
      const netProfit = adCostDelivered == null
        ? grossMargin - asNumber(product.deliveryCost) - asNumber(product.teamFees)
        : grossMargin - adCostDelivered - asNumber(product.deliveryCost) - asNumber(product.teamFees);

      let rentability = { label: 'À surveiller', tone: 'orange' };
      let decision = { label: 'Garder', tone: 'gray' };

      if (physicalStock <= 0) {
        rentability = { label: 'Inactif', tone: 'gray' };
        decision = { label: 'Couper', tone: 'red' };
      } else if (adCostDelivered == null) {
        rentability = netProfit >= PROFIT_TARGET ? { label: 'À surveiller', tone: 'orange' } : { label: 'Non rentable', tone: 'red' };
        decision = { label: 'Garder', tone: 'gray' };
      } else if (netProfit >= PROFIT_TARGET) {
        rentability = { label: 'Rentable', tone: 'green' };
        decision = possibleSales <= 5 ? { label: 'Réduire', tone: 'orange' } : { label: 'Pousser', tone: 'green' };
      } else if (netProfit >= 2500) {
        rentability = { label: 'À surveiller', tone: 'orange' };
        decision = { label: 'Réduire', tone: 'orange' };
      } else {
        rentability = { label: 'Non rentable', tone: 'red' };
        decision = { label: 'Couper', tone: 'red' };
      }

      return {
        ...product,
        physicalStock,
        possibleSales,
        grossMargin,
        pubMaxIdeal,
        adCostDelivered,
        netProfit,
        rentability,
        decision,
      };
    });

    const todayOrders = orders.filter((order) => order.date === today());
    const todayAds = ads.filter((ad) => ad.date === today());
    const deliveredOrders = todayOrders.filter((order) => order.status === 'Livrée encaissée' && asNumber(order.cashCollected) > 0);
    const collectedRevenue = deliveredOrders.reduce((sum, order) => sum + asNumber(order.cashCollected), 0);
    const adSpent = todayAds.reduce((sum, ad) => sum + asNumber(ad.budget), 0);
    const confirmedOrders = todayOrders.filter((order) => ['Confirmée', 'Stock réservé', 'Remise au livreur', 'Livrée encaissée'].includes(order.status)).length;
    const deliveryRate = confirmedOrders ? (deliveredOrders.length / confirmedOrders) * 100 : 0;
    const latestFinance = finances[finances.length - 1];
    const realProfit = latestFinance
      ? asNumber(latestFinance.revenue) - asNumber(latestFinance.adsSpent) - asNumber(latestFinance.productCost) - asNumber(latestFinance.deliveryPaid) - asNumber(latestFinance.salaries) - asNumber(latestFinance.transport) - asNumber(latestFinance.misc)
      : productRows.reduce((sum, row) => sum + Math.max(0, row.netProfit) * Math.max(0, deliveredOrders.filter((order) => order.productId === row.id).length), 0);

    const productsToCut = productRows.filter((row) => row.decision.label === 'Couper');
    const productsToReorder = productRows.filter((row) => row.physicalStock > 0 && row.possibleSales <= 5);
    const productToPush = [...productRows].filter((row) => row.decision.label === 'Pousser').sort((a, b) => b.netProfit - a.netProfit)[0];
    const productToReduce = [...productRows].filter((row) => row.decision.label === 'Réduire').sort((a, b) => a.netProfit - b.netProfit)[0];
    const productToCut = productsToCut[0];

    const cityStockTotals = CITIES.map((city) => ({
      city,
      stock: stockRows.filter((row) => row.city === city).reduce((sum, row) => sum + asNumber(row.finalReal), 0),
      delivered: deliveries.filter((row) => row.city === city).reduce((sum, row) => sum + asNumber(row.delivered), 0),
      received: deliveries.filter((row) => row.city === city).reduce((sum, row) => sum + asNumber(row.received), 0),
    }));
    const priorityCity = cityStockTotals
      .filter((city) => city.stock > 0)
      .sort((a, b) => deliveryRateFrom(b.received, b.delivered) - deliveryRateFrom(a.received, a.delivered))[0]?.city || 'Douala';

    const cashAvailable = latestFinance?.cashAvailable ?? Math.max(0, collectedRevenue - adSpent);
    const maxAdBudget = Math.max(0, Math.min(asNumber(cashAvailable) * 0.35, productRows.reduce((sum, row) => sum + (row.decision.label === 'Pousser' ? row.pubMaxIdeal * 4 : 0), 0)));
    const mainProblem = productsToCut.length
      ? 'Produit non rentable ou sans stock'
      : productsToReorder.length
        ? 'Stock sous le seuil de sécurité'
        : deliveryRate < 60
          ? 'Livraison faible'
          : 'Aucun blocage majeur';

    const recommendation = productToCut
      ? `Couper ${productToCut.name} et concentrer le cash sur ${productToPush?.name || 'le produit rentable'}.`
      : productsToReorder[0]
        ? `Recommander ${productsToReorder[0].name} avant de scaler.`
        : productToPush
          ? `Augmenter prudemment ${productToPush.name} sans dépasser ${money(maxAdBudget)}.`
          : 'Garder les budgets stables jusqu’à connaître le coût pub livré.';

    return {
      stockByProduct,
      stockByProductCity,
      productRows,
      collectedRevenue,
      realProfit,
      adSpent,
      generatedOrders: todayAds.reduce((sum, ad) => sum + asNumber(ad.generated), 0),
      confirmedOrders,
      deliveredOrders: deliveredOrders.length,
      deliveryRate,
      stockOut: productRows.filter((row) => row.physicalStock <= 0).length,
      productsToCut,
      productsToReorder,
      cashAvailable,
      productToPush,
      productToReduce,
      productToCut,
      priorityCity,
      maxAdBudget,
      mainProblem,
      recommendation,
    };
  }, [ads, deliveries, finances, orders, products, stockRows]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'stock', label: 'Stock', icon: PackageCheck },
    { id: 'orders', label: 'Commandes', icon: ShoppingCart },
    { id: 'ads', label: 'Publicités', icon: Megaphone },
    { id: 'deliveries', label: 'Livraisons', icon: Truck },
    { id: 'finances', label: 'Finances', icon: Wallet },
    { id: 'team', label: 'Équipe', icon: Users },
    { id: 'report', label: 'Rapport du jour', icon: FileText },
  ];

  const updateData = (recipe) => {
    setData((current) => {
      const next = typeof recipe === 'function' ? recipe(current) : recipe;
      return next;
    });
  };

  const resetDemoData = () => {
    const next = createInitialData();
    setData(next);
    setProductForm(emptyProductForm());
    setStockForm(emptyStockForm());
    setOrderForm(emptyOrderForm());
    setAdForm(emptyAdForm());
    setDeliveryForm(emptyDeliveryForm());
    setFinanceForm(emptyFinanceForm());
    setTeamForm(emptyTeamForm());
    setEditingProductId(null);
    setEditingStockId(null);
  };

  const submitProduct = (event) => {
    event.preventDefault();
    const payload = {
      id: editingProductId || uid('prd'),
      name: productForm.name.trim(),
      price: asNumber(productForm.price),
      cost: asNumber(productForm.cost),
      offer: productForm.offer,
      deliveryCost: asNumber(productForm.deliveryCost),
      teamFees: asNumber(productForm.teamFees),
    };
    if (!payload.name || !payload.price) return;
    updateData((current) => ({
      ...current,
      products: editingProductId
        ? current.products.map((product) => (product.id === editingProductId ? payload : product))
        : [...current.products, payload],
    }));
    setProductForm(emptyProductForm());
    setEditingProductId(null);
  };

  const editProduct = (product) => {
    setProductForm({
      name: product.name,
      price: product.price.toString(),
      cost: product.cost.toString(),
      offer: product.offer,
      deliveryCost: (product.deliveryCost || 0).toString(),
      teamFees: (product.teamFees || 0).toString(),
    });
    setEditingProductId(product.id);
  };

  const submitStock = (event) => {
    event.preventDefault();
    const payload = {
      id: editingStockId || uid('stk'),
      ...stockForm,
      stockStart: asNumber(stockForm.stockStart),
      entries: asNumber(stockForm.entries),
      courierOut: asNumber(stockForm.courierOut),
      delivered: asNumber(stockForm.delivered),
      returns: asNumber(stockForm.returns),
      finalReal: asNumber(stockForm.finalReal),
    };
    if (!payload.productId) return;
    updateData((current) => ({
      ...current,
      stockRows: editingStockId
        ? current.stockRows.map((row) => (row.id === editingStockId ? payload : row))
        : [...current.stockRows, payload],
    }));
    setStockForm(emptyStockForm());
    setEditingStockId(null);
  };

  const editStock = (row) => {
    setStockForm({
      date: row.date,
      city: row.city,
      productId: row.productId,
      stockStart: row.stockStart.toString(),
      entries: row.entries.toString(),
      courierOut: row.courierOut.toString(),
      delivered: row.delivered.toString(),
      returns: row.returns.toString(),
      finalReal: row.finalReal.toString(),
      responsible: row.responsible,
    });
    setEditingStockId(row.id);
  };

  const submitOrder = (event) => {
    event.preventDefault();
    const product = products.find((item) => item.id === orderForm.productId);
    const payload = {
      id: uid('ord'),
      ...orderForm,
      amount: asNumber(orderForm.amount || product?.price),
      cashCollected: asNumber(orderForm.cashCollected),
      stockReserved: isReservedStatus(orderForm.status),
    };
    if (!payload.clientName || !payload.productId) return;
    updateData((current) => ({ ...current, orders: [...current.orders, payload] }));
    setOrderForm(emptyOrderForm());
  };

  const updateOrderStatus = (id, status) => {
    updateData((current) => ({
      ...current,
      orders: current.orders.map((order) => (
        order.id === id ? { ...order, status, stockReserved: isReservedStatus(status) } : order
      )),
    }));
  };

  const submitAd = (event) => {
    event.preventDefault();
    const payload = {
      id: uid('ad'),
      ...adForm,
      budget: asNumber(adForm.budget),
      generated: asNumber(adForm.generated),
      confirmed: asNumber(adForm.confirmed),
      delivered: asNumber(adForm.delivered),
      revenue: asNumber(adForm.revenue),
    };
    if (!payload.productId) return;
    updateData((current) => ({ ...current, ads: [...current.ads, payload] }));
    setAdForm(emptyAdForm());
  };

  const submitDelivery = (event) => {
    event.preventDefault();
    const payload = {
      id: uid('del'),
      ...deliveryForm,
      received: asNumber(deliveryForm.received),
      delivered: asNumber(deliveryForm.delivered),
      returns: asNumber(deliveryForm.returns),
      expectedCash: asNumber(deliveryForm.expectedCash),
      cashCollected: asNumber(deliveryForm.cashCollected),
    };
    if (!payload.carrier || !payload.productId) return;
    updateData((current) => ({ ...current, deliveries: [...current.deliveries, payload] }));
    setDeliveryForm(emptyDeliveryForm());
  };

  const submitFinance = (event) => {
    event.preventDefault();
    const cash = asNumber(financeForm.cashAvailable);
    const payload = {
      id: uid('fin'),
      ...financeForm,
      revenue: asNumber(financeForm.revenue),
      adsSpent: asNumber(financeForm.adsSpent),
      productCost: asNumber(financeForm.productCost),
      deliveryPaid: asNumber(financeForm.deliveryPaid),
      salaries: asNumber(financeForm.salaries),
      transport: asNumber(financeForm.transport),
      misc: asNumber(financeForm.misc),
      cashAvailable: cash,
      cashPub: Math.round(cash * 0.3),
      cashStock: Math.round(cash * 0.35),
      cashDelivery: Math.round(cash * 0.1),
      cashSalaries: Math.round(cash * 0.1),
      cashProfit: Math.max(0, Math.round(cash * 0.15)),
    };
    updateData((current) => ({ ...current, finances: [...current.finances, payload] }));
    setFinanceForm(emptyFinanceForm());
  };

  const submitTeam = (event) => {
    event.preventDefault();
    const payload = {
      id: uid('team'),
      ...teamForm,
      dailyGoal: asNumber(teamForm.dailyGoal),
      handled: asNumber(teamForm.handled),
      confirmed: asNumber(teamForm.confirmed),
      delivered: asNumber(teamForm.delivered),
      revenue: asNumber(teamForm.revenue),
    };
    if (!payload.name) return;
    updateData((current) => ({ ...current, team: [...current.team, payload] }));
    setTeamForm(emptyTeamForm());
  };

  const generateReport = () => {
    const nextReport = {
      date: today(),
      revenue: derived.collectedRevenue,
      realProfit: derived.realProfit,
      adsSpent: derived.adSpent,
      generated: derived.generatedOrders,
      confirmed: derived.confirmedOrders,
      delivered: derived.deliveredOrders,
      deliveryRate: derived.deliveryRate,
      winnerProduct: derived.productToPush?.name || '',
      productToCut: derived.productToCut?.name || '',
      productToReorder: derived.productsToReorder[0]?.name || '',
      criticalStock: derived.productsToReorder.map((product) => product.name).join(', '),
      mainProblem: derived.mainProblem,
      tomorrowDecision: derived.recommendation,
    };
    updateData((current) => ({ ...current, report: nextReport }));
    setActiveTab('report');
  };

  const reportSummary = `Aujourd’hui, le business a encaissé ${money(report.revenue)}, dépensé ${money(report.adsSpent)} en publicité, livré ${report.delivered} commandes, avec un bénéfice estimé de ${money(report.realProfit)}. Le produit le plus rentable est ${report.winnerProduct || 'à confirmer'}. Le produit à couper ou réduire est ${report.productToCut || 'aucun'}. La priorité de demain est ${report.tomorrowDecision || derived.recommendation}`;

  return (
    <div className="min-h-full bg-gray-50 px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-primary-600">Pilotage COD Cameroun</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Centre de contrôle</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateReport}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              Rapport du jour
            </button>
            <button
              type="button"
              onClick={resetDemoData}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Réinitialiser
            </button>
          </div>
        </header>

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard title="CA encaissé aujourd’hui" value={money(derived.collectedRevenue)} detail="Ventes livrées et encaissées" icon={Wallet} tone="green" />
              <KpiCard title="Bénéfice estimé" value={money(derived.realProfit)} detail={`Objectif net: ${money(PROFIT_TARGET)} / vente`} icon={TrendingUp} tone={derived.realProfit >= 0 ? 'green' : 'red'} />
              <KpiCard title="Budget pub dépensé" value={money(derived.adSpent)} detail="Dépenses du jour" icon={Megaphone} tone="orange" />
              <KpiCard title="Commandes générées" value={derived.generatedOrders.toLocaleString('fr-FR')} detail={`${derived.confirmedOrders} confirmées`} icon={ShoppingCart} tone="gray" />
              <KpiCard title="Commandes livrées" value={derived.deliveredOrders.toLocaleString('fr-FR')} detail={`Taux livraison ${percent(derived.deliveryRate)}`} icon={Truck} tone={derived.deliveryRate >= 70 ? 'green' : 'orange'} />
              <KpiCard title="Produits en rupture" value={derived.stockOut.toLocaleString('fr-FR')} detail="Stock final à zéro" icon={AlertTriangle} tone={derived.stockOut ? 'red' : 'green'} />
              <KpiCard title="Produits à couper" value={derived.productsToCut.length.toLocaleString('fr-FR')} detail="Non rentable ou sans stock" icon={Ban} tone={derived.productsToCut.length ? 'red' : 'green'} />
              <KpiCard title="Cash disponible" value={money(derived.cashAvailable)} detail="Dernière caisse finance" icon={Wallet} tone="green" />
              <KpiCard title="Stock à recommander" value={derived.productsToReorder.length.toLocaleString('fr-FR')} detail="Sous le seuil de sécurité" icon={Package} tone={derived.productsToReorder.length ? 'orange' : 'green'} />
              <KpiCard title="Budget pub max" value={money(derived.maxAdBudget)} detail="Décision prudente du jour" icon={TrendingUp} tone="green" />
            </div>

            <Panel title="Décision du jour">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Produit à pousser', derived.productToPush?.name || 'À confirmer', derived.productToPush ? 'green' : 'gray'],
                  ['Produit à réduire', derived.productToReduce?.name || 'Aucun', derived.productToReduce ? 'orange' : 'gray'],
                  ['Produit à couper', derived.productToCut?.name || 'Aucun', derived.productToCut ? 'red' : 'green'],
                  ['Ville prioritaire', derived.priorityCity, 'green'],
                  ['Budget pub max du jour', money(derived.maxAdBudget), 'green'],
                  ['Problème principal', derived.mainProblem, derived.mainProblem === 'Aucun blocage majeur' ? 'green' : 'orange'],
                  ['Décision recommandée', derived.recommendation, derived.productToCut ? 'red' : 'green'],
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
                    <div className="mt-2">
                      <Badge tone={tone}>{value}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-5">
            <Panel title={editingProductId ? 'Modifier un produit' : 'Ajouter un produit'}>
              <form onSubmit={submitProduct} className="grid gap-3 md:grid-cols-6">
                <Input label="Nom du produit" value={productForm.name} onChange={(event) => setProductForm((form) => ({ ...form, name: event.target.value }))} className="md:col-span-2" required />
                <Input label="Prix de vente" type="number" value={productForm.price} onChange={(event) => setProductForm((form) => ({ ...form, price: event.target.value }))} required />
                <Input label="Coût produit" type="number" value={productForm.cost} onChange={(event) => setProductForm((form) => ({ ...form, cost: event.target.value }))} required />
                <Select label="Offre" value={productForm.offer} onChange={(event) => setProductForm((form) => ({ ...form, offer: event.target.value }))}>
                  {OFFER_TYPES.map((offer) => <option key={offer}>{offer}</option>)}
                </Select>
                <div className="flex items-end gap-2">
                  <button type="submit" className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {editingProductId ? 'Enregistrer' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </Panel>

            <Panel title="Produits">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Nom du produit</Th>
                    <Th align="right">Prix de vente</Th>
                    <Th align="right">Coût produit</Th>
                    <Th>Offre</Th>
                    <Th align="right">Stock physique</Th>
                    <Th align="right">Ventes possibles</Th>
                    <Th align="right">Marge brute</Th>
                    <Th align="right">Pub max idéale</Th>
                    <Th>Rentabilité</Th>
                    <Th>Décision</Th>
                    <Th align="center">Action</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {derived.productRows.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <Td className="font-semibold text-gray-900">{product.name}</Td>
                      <Td align="right" className="tabular-nums">{money(product.price)}</Td>
                      <Td align="right" className="tabular-nums">{money(product.cost)}</Td>
                      <Td>{product.offer}</Td>
                      <Td align="right" className="font-semibold tabular-nums">{product.physicalStock}</Td>
                      <Td align="right" className="font-semibold tabular-nums">{product.possibleSales}</Td>
                      <Td align="right" className="tabular-nums">{money(product.grossMargin)}</Td>
                      <Td align="right" className="tabular-nums">{money(product.pubMaxIdeal)}</Td>
                      <Td><Badge tone={product.rentability.tone}>{product.rentability.label}</Badge></Td>
                      <Td><Badge tone={product.decision.tone}>{product.decision.label}</Badge></Td>
                      <Td align="center">
                        <button type="button" onClick={() => editProduct(product)} title="Modifier le produit" aria-label="Modifier le produit" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-primary-50 hover:text-primary-700">
                          <Edit3 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="space-y-5">
            <Panel title={editingStockId ? 'Modifier un stock' : 'Modifier le stock'}>
              <form onSubmit={submitStock} className="grid gap-3 md:grid-cols-6">
                <Input label="Date" type="date" value={stockForm.date} onChange={(event) => setStockForm((form) => ({ ...form, date: event.target.value }))} />
                <Select label="Ville" value={stockForm.city} onChange={(event) => setStockForm((form) => ({ ...form, city: event.target.value }))}>
                  {CITIES.map((city) => <option key={city}>{city}</option>)}
                </Select>
                <Select label="Produit" value={stockForm.productId} onChange={(event) => setStockForm((form) => ({ ...form, productId: event.target.value }))} className="md:col-span-2" required>
                  <option value="">Choisir</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </Select>
                <Input label="Stock début" type="number" value={stockForm.stockStart} onChange={(event) => setStockForm((form) => ({ ...form, stockStart: event.target.value }))} required />
                <Input label="Entrées" type="number" value={stockForm.entries} onChange={(event) => setStockForm((form) => ({ ...form, entries: event.target.value }))} />
                <Input label="Sorties livreur" type="number" value={stockForm.courierOut} onChange={(event) => setStockForm((form) => ({ ...form, courierOut: event.target.value }))} />
                <Input label="Livrés" type="number" value={stockForm.delivered} onChange={(event) => setStockForm((form) => ({ ...form, delivered: event.target.value }))} />
                <Input label="Retours" type="number" value={stockForm.returns} onChange={(event) => setStockForm((form) => ({ ...form, returns: event.target.value }))} />
                <Input label="Stock final réel" type="number" value={stockForm.finalReal} onChange={(event) => setStockForm((form) => ({ ...form, finalReal: event.target.value }))} required />
                <Input label="Responsable" value={stockForm.responsible} onChange={(event) => setStockForm((form) => ({ ...form, responsible: event.target.value }))} />
                <div className="flex items-end">
                  <button type="submit" className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {editingStockId ? 'Enregistrer' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </Panel>

            <Panel title="Stock par ville">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Ville</Th>
                    <Th>Produit</Th>
                    <Th align="right">Début</Th>
                    <Th align="right">Entrées</Th>
                    <Th align="right">Sorties</Th>
                    <Th align="right">Livrés</Th>
                    <Th align="right">Retours</Th>
                    <Th align="right">Final réel</Th>
                    <Th align="right">Théorique</Th>
                    <Th align="right">Écart</Th>
                    <Th>Responsable</Th>
                    <Th>Statut</Th>
                    <Th>Décision pub</Th>
                    <Th align="center">Action</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {stockRows.map((row) => {
                    const status = stockStatus(row);
                    const pubDecision = stockPubDecision(row);
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <Td>{row.date}</Td>
                        <Td>{row.city}</Td>
                        <Td className="font-semibold text-gray-900">{productName(products, row.productId)}</Td>
                        <Td align="right">{row.stockStart}</Td>
                        <Td align="right">{row.entries}</Td>
                        <Td align="right">{row.courierOut}</Td>
                        <Td align="right">{row.delivered}</Td>
                        <Td align="right">{row.returns}</Td>
                        <Td align="right" className="font-bold">{row.finalReal}</Td>
                        <Td align="right">{stockTheory(row)}</Td>
                        <Td align="right" className={stockGap(row) !== 0 ? 'font-semibold text-orange-600' : 'text-gray-500'}>{stockGap(row)}</Td>
                        <Td>{row.responsible || '-'}</Td>
                        <Td><Badge tone={status.tone}>{status.label}</Badge></Td>
                        <Td><Badge tone={pubDecision.tone}>{pubDecision.label}</Badge></Td>
                        <Td align="center">
                          <button type="button" onClick={() => editStock(row)} title="Modifier la ligne de stock" aria-label="Modifier la ligne de stock" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-primary-50 hover:text-primary-700">
                            <Edit3 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-5">
            <Panel title="Ajouter une commande">
              <form onSubmit={submitOrder} className="grid gap-3 md:grid-cols-6">
                <Input label="Date" type="date" value={orderForm.date} onChange={(event) => setOrderForm((form) => ({ ...form, date: event.target.value }))} />
                <Input label="Nom client" value={orderForm.clientName} onChange={(event) => setOrderForm((form) => ({ ...form, clientName: event.target.value }))} required />
                <Input label="Téléphone" value={orderForm.phone} onChange={(event) => setOrderForm((form) => ({ ...form, phone: event.target.value }))} />
                <Select label="Ville" value={orderForm.city} onChange={(event) => setOrderForm((form) => ({ ...form, city: event.target.value }))}>
                  {CITIES.map((city) => <option key={city}>{city}</option>)}
                </Select>
                <Input label="Quartier" value={orderForm.district} onChange={(event) => setOrderForm((form) => ({ ...form, district: event.target.value }))} />
                <Select label="Produit" value={orderForm.productId} onChange={(event) => {
                  const product = products.find((item) => item.id === event.target.value);
                  setOrderForm((form) => ({ ...form, productId: event.target.value, amount: product?.price?.toString() || form.amount }));
                }} required>
                  <option value="">Choisir</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </Select>
                <Input label="Montant" type="number" value={orderForm.amount} onChange={(event) => setOrderForm((form) => ({ ...form, amount: event.target.value }))} />
                <Input label="Closeuse" value={orderForm.closer} onChange={(event) => setOrderForm((form) => ({ ...form, closer: event.target.value }))} />
                <Select label="Statut commande" value={orderForm.status} onChange={(event) => setOrderForm((form) => ({ ...form, status: event.target.value }))}>
                  {ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </Select>
                <Input label="Livreur / agence" value={orderForm.carrier} onChange={(event) => setOrderForm((form) => ({ ...form, carrier: event.target.value }))} />
                <Input label="Date livraison prévue" type="date" value={orderForm.deliveryDate} onChange={(event) => setOrderForm((form) => ({ ...form, deliveryDate: event.target.value }))} />
                <Input label="Argent encaissé" type="number" value={orderForm.cashCollected} onChange={(event) => setOrderForm((form) => ({ ...form, cashCollected: event.target.value }))} />
                <Input label="Résultat livraison" value={orderForm.deliveryResult} onChange={(event) => setOrderForm((form) => ({ ...form, deliveryResult: event.target.value }))} className="md:col-span-2" />
                <Input label="Problème" value={orderForm.problem} onChange={(event) => setOrderForm((form) => ({ ...form, problem: event.target.value }))} className="md:col-span-2" />
                <div className="flex items-end">
                  <button type="submit" className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Ajouter
                  </button>
                </div>
              </form>
            </Panel>

            <Panel title="Commandes">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Client</Th>
                    <Th>Téléphone</Th>
                    <Th>Ville</Th>
                    <Th>Quartier</Th>
                    <Th>Produit</Th>
                    <Th align="right">Montant</Th>
                    <Th>Closeuse</Th>
                    <Th>Statut</Th>
                    <Th>Stock réservé</Th>
                    <Th>Livreur / agence</Th>
                    <Th>Livraison prévue</Th>
                    <Th>Résultat</Th>
                    <Th align="right">Argent encaissé</Th>
                    <Th>Problème</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <Td>{order.date}</Td>
                      <Td className="font-semibold text-gray-900">{order.clientName}</Td>
                      <Td>{order.phone}</Td>
                      <Td>{order.city}</Td>
                      <Td>{order.district}</Td>
                      <Td>{productName(products, order.productId)}</Td>
                      <Td align="right">{money(order.amount)}</Td>
                      <Td>{order.closer || '-'}</Td>
                      <Td>
                        <select value={order.status} onChange={(event) => updateOrderStatus(order.id, event.target.value)} className="min-h-[36px] rounded-lg border border-gray-300 bg-white px-2 text-xs font-semibold">
                          {ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </Td>
                      <Td><Badge tone={order.stockReserved ? 'green' : 'gray'}>{order.stockReserved ? 'Oui' : 'Non'}</Badge></Td>
                      <Td>{order.carrier || '-'}</Td>
                      <Td>{order.deliveryDate}</Td>
                      <Td>{order.deliveryResult || '-'}</Td>
                      <Td align="right" className={asNumber(order.cashCollected) > 0 ? 'font-bold text-green-700' : 'text-gray-500'}>{money(order.cashCollected)}</Td>
                      <Td>{order.problem || '-'}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {activeTab === 'ads' && (
          <div className="space-y-5">
            <Panel title="Ajouter une dépense pub">
              <form onSubmit={submitAd} className="grid gap-3 md:grid-cols-6">
                <Input label="Date" type="date" value={adForm.date} onChange={(event) => setAdForm((form) => ({ ...form, date: event.target.value }))} />
                <Select label="Produit" value={adForm.productId} onChange={(event) => setAdForm((form) => ({ ...form, productId: event.target.value }))} required>
                  <option value="">Choisir</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </Select>
                <Select label="Ville ciblée" value={adForm.city} onChange={(event) => setAdForm((form) => ({ ...form, city: event.target.value }))}>
                  {CITIES.map((city) => <option key={city}>{city}</option>)}
                </Select>
                <Input label="Budget dépensé" type="number" value={adForm.budget} onChange={(event) => setAdForm((form) => ({ ...form, budget: event.target.value }))} />
                <Input label="Commandes générées" type="number" value={adForm.generated} onChange={(event) => setAdForm((form) => ({ ...form, generated: event.target.value }))} />
                <Input label="Commandes confirmées" type="number" value={adForm.confirmed} onChange={(event) => setAdForm((form) => ({ ...form, confirmed: event.target.value }))} />
                <Input label="Commandes livrées" type="number" value={adForm.delivered} onChange={(event) => setAdForm((form) => ({ ...form, delivered: event.target.value }))} />
                <Input label="CA encaissé" type="number" value={adForm.revenue} onChange={(event) => setAdForm((form) => ({ ...form, revenue: event.target.value }))} />
                <Select label="Décision" value={adForm.decision} onChange={(event) => setAdForm((form) => ({ ...form, decision: event.target.value }))}>
                  {AD_DECISIONS.map((decision) => <option key={decision}>{decision}</option>)}
                </Select>
                <Input label="Note" value={adForm.note} onChange={(event) => setAdForm((form) => ({ ...form, note: event.target.value }))} className="md:col-span-2" />
                <div className="flex items-end">
                  <button type="submit" className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Ajouter
                  </button>
                </div>
              </form>
            </Panel>

            <Panel title="Publicités">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Produit</Th>
                    <Th>Ville ciblée</Th>
                    <Th align="right">Budget</Th>
                    <Th align="right">Générées</Th>
                    <Th align="right">Confirmées</Th>
                    <Th align="right">Livrées</Th>
                    <Th align="right">CA encaissé</Th>
                    <Th align="right">Coût / commande</Th>
                    <Th align="right">Coût / vente livrée</Th>
                    <Th>Décision</Th>
                    <Th>Note</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {ads.map((ad) => {
                    const costPerOrder = asNumber(ad.generated) ? asNumber(ad.budget) / asNumber(ad.generated) : null;
                    const costPerDelivered = asNumber(ad.delivered) ? asNumber(ad.budget) / asNumber(ad.delivered) : null;
                    const hasVerifiedStock = (derived.stockByProductCity.get(`${ad.productId}:${ad.city}`) || 0) > 0;
                    let tone = 'gray';
                    let decision = ad.decision;
                    if (!hasVerifiedStock) {
                      tone = 'red';
                      decision = 'Couper';
                    } else if (costPerDelivered == null) {
                      tone = 'gray';
                      decision = 'Garder';
                    } else if (costPerDelivered <= 2500) {
                      tone = 'green';
                      decision = 'Augmenter';
                    } else if (costPerDelivered <= 3500) {
                      tone = 'orange';
                      decision = 'Garder';
                    } else if (costPerDelivered <= 4500) {
                      tone = 'orange';
                      decision = 'Réduire';
                    } else {
                      tone = 'red';
                      decision = 'Couper';
                    }
                    return (
                      <tr key={ad.id} className="hover:bg-gray-50">
                        <Td>{ad.date}</Td>
                        <Td className="font-semibold text-gray-900">{productName(products, ad.productId)}</Td>
                        <Td>{ad.city}</Td>
                        <Td align="right">{money(ad.budget)}</Td>
                        <Td align="right">{ad.generated}</Td>
                        <Td align="right">{ad.confirmed}</Td>
                        <Td align="right">{ad.delivered}</Td>
                        <Td align="right">{money(ad.revenue)}</Td>
                        <Td align="right">{costPerOrder == null ? '-' : money(costPerOrder)}</Td>
                        <Td align="right">{costPerDelivered == null ? '-' : money(costPerDelivered)}</Td>
                        <Td><Badge tone={tone}>{decision}</Badge></Td>
                        <Td>{!hasVerifiedStock ? 'Stock ville non vérifié' : ad.note || '-'}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {activeTab === 'deliveries' && (
          <div className="space-y-5">
            <Panel title="Suivre une livraison">
              <form onSubmit={submitDelivery} className="grid gap-3 md:grid-cols-6">
                <Input label="Date" type="date" value={deliveryForm.date} onChange={(event) => setDeliveryForm((form) => ({ ...form, date: event.target.value }))} />
                <Select label="Ville" value={deliveryForm.city} onChange={(event) => setDeliveryForm((form) => ({ ...form, city: event.target.value }))}>
                  {CITIES.map((city) => <option key={city}>{city}</option>)}
                </Select>
                <Input label="Livreur / agence" value={deliveryForm.carrier} onChange={(event) => setDeliveryForm((form) => ({ ...form, carrier: event.target.value }))} required />
                <Select label="Produit" value={deliveryForm.productId} onChange={(event) => setDeliveryForm((form) => ({ ...form, productId: event.target.value }))} required>
                  <option value="">Choisir</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </Select>
                <Input label="Colis reçus" type="number" value={deliveryForm.received} onChange={(event) => setDeliveryForm((form) => ({ ...form, received: event.target.value }))} />
                <Input label="Livrés" type="number" value={deliveryForm.delivered} onChange={(event) => setDeliveryForm((form) => ({ ...form, delivered: event.target.value }))} />
                <Input label="Retours" type="number" value={deliveryForm.returns} onChange={(event) => setDeliveryForm((form) => ({ ...form, returns: event.target.value }))} />
                <Input label="Argent attendu" type="number" value={deliveryForm.expectedCash} onChange={(event) => setDeliveryForm((form) => ({ ...form, expectedCash: event.target.value }))} />
                <Input label="Argent encaissé" type="number" value={deliveryForm.cashCollected} onChange={(event) => setDeliveryForm((form) => ({ ...form, cashCollected: event.target.value }))} />
                <Select label="Statut" value={deliveryForm.status} onChange={(event) => setDeliveryForm((form) => ({ ...form, status: event.target.value }))}>
                  {DELIVERY_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </Select>
                <Input label="Problème" value={deliveryForm.problem} onChange={(event) => setDeliveryForm((form) => ({ ...form, problem: event.target.value }))} className="md:col-span-2" />
                <div className="flex items-end">
                  <button type="submit" className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Ajouter
                  </button>
                </div>
              </form>
            </Panel>

            <Panel title="Livraisons">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Ville</Th>
                    <Th>Livreur / agence</Th>
                    <Th>Produit</Th>
                    <Th align="right">Colis reçus</Th>
                    <Th align="right">Livrés</Th>
                    <Th align="right">Retours</Th>
                    <Th align="right">Argent attendu</Th>
                    <Th align="right">Argent encaissé</Th>
                    <Th align="right">Écart argent</Th>
                    <Th>Taux</Th>
                    <Th>Problème</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {deliveries.map((delivery) => {
                    const rate = deliveryRateFrom(delivery.received, delivery.delivered);
                    const gap = asNumber(delivery.cashCollected) - asNumber(delivery.expectedCash);
                    return (
                      <tr key={delivery.id} className="hover:bg-gray-50">
                        <Td>{delivery.date}</Td>
                        <Td>{delivery.city}</Td>
                        <Td className="font-semibold text-gray-900">{delivery.carrier}</Td>
                        <Td>{productName(products, delivery.productId)}</Td>
                        <Td align="right">{delivery.received}</Td>
                        <Td align="right">{delivery.delivered}</Td>
                        <Td align="right">{delivery.returns}</Td>
                        <Td align="right">{money(delivery.expectedCash)}</Td>
                        <Td align="right">{money(delivery.cashCollected)}</Td>
                        <Td align="right" className={gap < 0 ? 'font-bold text-red-600' : 'font-semibold text-green-700'}>{money(gap)}</Td>
                        <Td><Badge tone={rate >= 70 ? 'green' : rate >= 50 ? 'orange' : 'red'}>{percent(rate)}</Badge></Td>
                        <Td>{delivery.problem || '-'}</Td>
                        <Td><Badge tone={delivery.status === 'Terminé' ? 'green' : delivery.status === 'En cours' ? 'orange' : 'red'}>{delivery.status}</Badge></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {activeTab === 'finances' && (
          <div className="space-y-5">
            <Panel title="Ajouter une ligne finance">
              <form onSubmit={submitFinance} className="grid gap-3 md:grid-cols-6">
                <Input label="Date" type="date" value={financeForm.date} onChange={(event) => setFinanceForm((form) => ({ ...form, date: event.target.value }))} />
                <Input label="CA encaissé" type="number" value={financeForm.revenue} onChange={(event) => setFinanceForm((form) => ({ ...form, revenue: event.target.value }))} />
                <Input label="Pub dépensée" type="number" value={financeForm.adsSpent} onChange={(event) => setFinanceForm((form) => ({ ...form, adsSpent: event.target.value }))} />
                <Input label="Coût produits vendus" type="number" value={financeForm.productCost} onChange={(event) => setFinanceForm((form) => ({ ...form, productCost: event.target.value }))} />
                <Input label="Livraison payée" type="number" value={financeForm.deliveryPaid} onChange={(event) => setFinanceForm((form) => ({ ...form, deliveryPaid: event.target.value }))} />
                <Input label="Salaires / commissions" type="number" value={financeForm.salaries} onChange={(event) => setFinanceForm((form) => ({ ...form, salaries: event.target.value }))} />
                <Input label="Transport" type="number" value={financeForm.transport} onChange={(event) => setFinanceForm((form) => ({ ...form, transport: event.target.value }))} />
                <Input label="Divers" type="number" value={financeForm.misc} onChange={(event) => setFinanceForm((form) => ({ ...form, misc: event.target.value }))} />
                <Input label="Cash disponible" type="number" value={financeForm.cashAvailable} onChange={(event) => setFinanceForm((form) => ({ ...form, cashAvailable: event.target.value }))} />
                <div className="flex items-end">
                  <button type="submit" className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Ajouter
                  </button>
                </div>
              </form>
            </Panel>

            <Panel title="Finances">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th align="right">CA encaissé</Th>
                    <Th align="right">Pub</Th>
                    <Th align="right">Produits</Th>
                    <Th align="right">Livraison</Th>
                    <Th align="right">Salaires</Th>
                    <Th align="right">Transport</Th>
                    <Th align="right">Divers</Th>
                    <Th align="right">Bénéfice réel</Th>
                    <Th align="right">Cash dispo</Th>
                    <Th align="right">Caisse pub</Th>
                    <Th align="right">Caisse stock</Th>
                    <Th align="right">Caisse livraison</Th>
                    <Th align="right">Caisse salaires</Th>
                    <Th align="right">Caisse profit</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {finances.map((finance) => {
                    const profit = asNumber(finance.revenue) - asNumber(finance.adsSpent) - asNumber(finance.productCost) - asNumber(finance.deliveryPaid) - asNumber(finance.salaries) - asNumber(finance.transport) - asNumber(finance.misc);
                    return (
                      <tr key={finance.id} className="hover:bg-gray-50">
                        <Td>{finance.date}</Td>
                        <Td align="right">{money(finance.revenue)}</Td>
                        <Td align="right">{money(finance.adsSpent)}</Td>
                        <Td align="right">{money(finance.productCost)}</Td>
                        <Td align="right">{money(finance.deliveryPaid)}</Td>
                        <Td align="right">{money(finance.salaries)}</Td>
                        <Td align="right">{money(finance.transport)}</Td>
                        <Td align="right">{money(finance.misc)}</Td>
                        <Td align="right" className={profit >= 0 ? 'font-bold text-green-700' : 'font-bold text-red-600'}>{money(profit)}</Td>
                        <Td align="right" className="font-bold text-gray-900">{money(finance.cashAvailable)}</Td>
                        <Td align="right">{money(finance.cashPub)}</Td>
                        <Td align="right">{money(finance.cashStock)}</Td>
                        <Td align="right">{money(finance.cashDelivery)}</Td>
                        <Td align="right">{money(finance.cashSalaries)}</Td>
                        <Td align="right">{money(finance.cashProfit)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-5">
            <Panel title="Ajouter un membre">
              <form onSubmit={submitTeam} className="grid gap-3 md:grid-cols-6">
                <Input label="Nom" value={teamForm.name} onChange={(event) => setTeamForm((form) => ({ ...form, name: event.target.value }))} required />
                <Select label="Rôle" value={teamForm.role} onChange={(event) => setTeamForm((form) => ({ ...form, role: event.target.value }))} className="md:col-span-2">
                  {TEAM_ROLES.map((role) => <option key={role}>{role}</option>)}
                </Select>
                <Select label="Ville" value={teamForm.city} onChange={(event) => setTeamForm((form) => ({ ...form, city: event.target.value }))}>
                  {CITIES.map((city) => <option key={city}>{city}</option>)}
                </Select>
                <Input label="Objectif journalier" type="number" value={teamForm.dailyGoal} onChange={(event) => setTeamForm((form) => ({ ...form, dailyGoal: event.target.value }))} />
                <Input label="Commandes traitées" type="number" value={teamForm.handled} onChange={(event) => setTeamForm((form) => ({ ...form, handled: event.target.value }))} />
                <Input label="Confirmées" type="number" value={teamForm.confirmed} onChange={(event) => setTeamForm((form) => ({ ...form, confirmed: event.target.value }))} />
                <Input label="Livrées" type="number" value={teamForm.delivered} onChange={(event) => setTeamForm((form) => ({ ...form, delivered: event.target.value }))} />
                <Input label="CA généré" type="number" value={teamForm.revenue} onChange={(event) => setTeamForm((form) => ({ ...form, revenue: event.target.value }))} />
                <Input label="Problèmes" value={teamForm.problems} onChange={(event) => setTeamForm((form) => ({ ...form, problems: event.target.value }))} className="md:col-span-2" />
                <div className="flex items-end">
                  <button type="submit" className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Ajouter
                  </button>
                </div>
              </form>
            </Panel>

            <Panel title="Équipe">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Nom</Th>
                    <Th>Rôle</Th>
                    <Th>Ville</Th>
                    <Th align="right">Objectif</Th>
                    <Th align="right">Traitées</Th>
                    <Th align="right">Confirmées</Th>
                    <Th align="right">Livrées</Th>
                    <Th align="right">CA généré</Th>
                    <Th>Problèmes</Th>
                    <Th>Performance</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {team.map((member) => {
                    const perf = teamPerformance(member);
                    return (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <Td className="font-semibold text-gray-900">{member.name}</Td>
                        <Td>{member.role}</Td>
                        <Td>{member.city}</Td>
                        <Td align="right">{member.dailyGoal}</Td>
                        <Td align="right">{member.handled}</Td>
                        <Td align="right">{member.confirmed}</Td>
                        <Td align="right" className="font-bold">{member.delivered}</Td>
                        <Td align="right">{money(member.revenue)}</Td>
                        <Td>{member.problems || '-'}</Td>
                        <Td><Badge tone={perf.tone}>{perf.label}</Badge></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-5">
            <Panel
              title="Rapport du jour"
              action={(
                <button type="button" onClick={generateReport} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  Générer
                </button>
              )}
            >
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['Date', report.date],
                  ['CA encaissé', money(report.revenue)],
                  ['Bénéfice réel', money(report.realProfit)],
                  ['Budget pub dépensé', money(report.adsSpent)],
                  ['Commandes générées', report.generated],
                  ['Commandes confirmées', report.confirmed],
                  ['Commandes livrées', report.delivered],
                  ['Taux de livraison', percent(report.deliveryRate)],
                  ['Produit gagnant', report.winnerProduct || '-'],
                  ['Produit à couper', report.productToCut || '-'],
                  ['Produit à recommander', report.productToReorder || '-'],
                  ['Stock critique', report.criticalStock || '-'],
                  ['Problème principal', report.mainProblem || '-'],
                  ['Décision de demain', report.tomorrowDecision || '-'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
                    <p className="mt-2 text-sm font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Résumé automatique">
              <div className="rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm font-medium leading-6 text-primary-900">
                {reportSummary}
              </div>
            </Panel>

            <Panel title="Règles business actives">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Pas de stock vérifié = pas de pub', CheckCircle2],
                  ['Commande confirmée = stock réservé', PackageCheck],
                  ['Vente = livré + argent encaissé', Wallet],
                  ['Rentabilité nette avant volume', TrendingUp],
                  ['Coût pub par vente livrée prioritaire', Megaphone],
                  ['Stock sous 30 % = recommander', AlertTriangle],
                ].map(([label, Icon]) => (
                  <div key={label} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{label}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        <footer className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <MapPin className="h-4 w-4 text-primary-700" aria-hidden="true" />
              Douala / Yaoundé
            </div>
            <p className="mt-1 text-xs text-gray-500">Les décisions pub sont calculées par ville et produit.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <TrendingDown className="h-4 w-4 text-red-600" aria-hidden="true" />
              Coupure rapide
            </div>
            <p className="mt-1 text-xs text-gray-500">Les badges rouges signalent les produits, villes ou livreurs à arrêter.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <TrendingUp className="h-4 w-4 text-green-600" aria-hidden="true" />
              Objectif net
            </div>
            <p className="mt-1 text-xs text-gray-500">Le seuil de rentabilité est fixé à {money(PROFIT_TARGET)} par vente.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
