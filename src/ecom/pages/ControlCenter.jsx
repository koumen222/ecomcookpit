import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  Megaphone,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import ecomApi, { productsApi, ordersApi, transactionsApi } from '../services/ecommApi.js';

/**
 * Centre de contrôle — branché sur les vraies données Scalor.
 *
 * Données lues (lecture seule) depuis le backend :
 *   • Produits      → GET /products              (sellingPrice, productCost, deliveryCost, avgAdsCost, stock, status)
 *   • Commandes     → GET /orders                (status, price, quantity, city, productId, assignedLivreur, closerId)
 *   • Finances      → GET /transactions          (type income/expense, category, amount)
 *   • Équipe        → GET /users/team/performance(stats par livreur / closeuse / comptable)
 *
 * Seul l'onglet « Publicités » garde une saisie manuelle (budget pub Facebook/TikTok),
 * que le backend Scalor ne stocke pas. Les métriques (commandes générées / confirmées /
 * livrées, coût par vente livrée) sont calculées à partir des vraies commandes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const ADS_STORAGE_KEY = 'scalor_cc_ads_v1';
const PROFIT_TARGET = 4000; // bénéfice net visé par vente livrée (FCFA)
const ORDERS_WINDOW_DAYS = 90; // historique chargé depuis le backend
const CONFIRMED_FUNNEL = ['confirmed', 'shipped', 'delivered']; // commande "confirmée" et au-delà
const AD_DECISIONS = ['Augmenter', 'Garder', 'Réduire', 'Couper', 'Tester autre créa'];

const PERIODS = [
  { id: 0, label: "Aujourd'hui" },
  { id: 7, label: '7 jours' },
  { id: 30, label: '30 jours' },
  { id: 90, label: '90 jours' },
];

const STATUS_LABELS = {
  pending: 'En attente',
  called: 'Appelée',
  confirmed: 'Confirmée',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  returned: 'Retour',
  cancelled: 'Annulée',
  unreachable: 'Injoignable',
  postponed: 'Reportée',
  reported: 'Reportée',
};

const STATUS_TONE = {
  delivered: 'green',
  confirmed: 'green',
  shipped: 'orange',
  called: 'orange',
  postponed: 'orange',
  reported: 'orange',
  pending: 'gray',
  returned: 'red',
  cancelled: 'red',
  unreachable: 'red',
};

const PRODUCT_STATUS_LABELS = {
  test: 'Test',
  stable: 'Stable',
  winner: 'Winner',
  pause: 'En pause',
  stop: 'Arrêté',
};

const CATEGORY_LABELS = {
  publicite: 'Publicité',
  produit: 'Achat produit',
  livraison: 'Frais de livraison',
  salaire: 'Salaire',
  abonnement: 'Abonnement / Outil',
  materiel: 'Matériel',
  transport: 'Transport',
  autre_depense: 'Autre dépense',
  vente: 'Vente',
  remboursement_client: 'Remboursement client',
  investissement: 'Investissement',
  autre_entree: 'Autre entrée',
};

const ROLE_LABELS = {
  ecom_admin: 'Admin',
  ecom_closeuse: 'Closeuse',
  ecom_livreur: 'Livreur',
  ecom_compta: 'Comptable',
  ecom_provider: 'Prestataire',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function orderDate(order) {
  return order?.date || order?.createdAt || null;
}

function dayKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function orderRevenue(order) {
  return asNumber(order?.price) * Math.max(1, asNumber(order?.quantity) || 1);
}

function periodStart(days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (days > 0) start.setDate(start.getDate() - (days - 1));
  return start;
}

function isWithin(value, startMs) {
  if (!value) return false;
  const t = new Date(value).getTime();
  return Number.isFinite(t) && t >= startMs;
}

// id d'une commande -> produit (par ObjectId puis par nom)
function matchOrderToProduct(order, products, byId, byName) {
  const pid = order.productId && (order.productId._id || order.productId);
  if (pid && byId.has(String(pid))) return byId.get(String(pid));
  const name = (order.product || '').trim().toLowerCase();
  if (name && byName.has(name)) return byName.get(name);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants UI
// ─────────────────────────────────────────────────────────────────────────────
function Badge({ children, tone = 'gray' }) {
  const classes = {
    green: 'border-green-200 bg-green-50 text-green-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    gray: 'border-gray-200 bg-gray-50 text-gray-600',
  };
  const dot = {
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${classes[tone] || classes.gray}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone] || dot.gray}`} />
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

function EmptyRow({ colSpan, label }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-gray-400">
        {label}
      </td>
    </tr>
  );
}

export default function ControlCenter() {
  // ── État données réelles ───────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [partialError, setPartialError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── État UI ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('dashboard');
  const [periodDays, setPeriodDays] = useState(0);

  // ── Pub manuelle (localStorage) ────────────────────────────────────────────
  const [ads, setAds] = useState(() => {
    try {
      const stored = localStorage.getItem(ADS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const emptyAdForm = useCallback(() => ({
    date: todayKey(),
    productId: '',
    city: '',
    budget: '',
    decision: 'Garder',
    note: '',
  }), []);
  const [adForm, setAdForm] = useState(emptyAdForm);

  useEffect(() => {
    try {
      localStorage.setItem(ADS_STORAGE_KEY, JSON.stringify(ads));
    } catch {
      /* quota plein : on ignore */
    }
  }, [ads]);

  // ── Chargement des données Scalor ──────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setPartialError(null);

    const startDate = periodStart(ORDERS_WINDOW_DAYS).toISOString().slice(0, 10);

    const results = await Promise.allSettled([
      productsApi.getProducts({ limit: 100 }),
      ordersApi.getOrders({ limit: 500, startDate }),
      transactionsApi.getTransactions({ limit: 500 }),
      ecomApi.get('/users/team/performance', { params: { period: ORDERS_WINDOW_DAYS } }),
    ]);

    const [pRes, oRes, tRes, teamRes] = results;
    const failed = [];

    if (pRes.status === 'fulfilled') setProducts(pRes.value?.data?.data || []);
    else failed.push('produits');

    if (oRes.status === 'fulfilled') setOrders(oRes.value?.data?.data?.orders || []);
    else failed.push('commandes');

    if (tRes.status === 'fulfilled') setTransactions(tRes.value?.data?.data?.transactions || []);
    else failed.push('finances');

    if (teamRes.status === 'fulfilled') setTeam(teamRes.value?.data?.data?.members || []);
    else failed.push('équipe');

    if (failed.length === results.length) {
      setError('Impossible de charger les données Scalor. Vérifiez votre connexion puis réessayez.');
    } else if (failed.length) {
      setPartialError(`Données partielles : échec du chargement de ${failed.join(', ')}.`);
    }

    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // ── Calculs dérivés ────────────────────────────────────────────────────────
  const startMs = useMemo(() => periodStart(periodDays).getTime(), [periodDays]);

  const productIndex = useMemo(() => {
    const byId = new Map();
    const byName = new Map();
    products.forEach((p) => {
      byId.set(String(p._id), p);
      if (p.name) byName.set(p.name.trim().toLowerCase(), p);
    });
    return { byId, byName };
  }, [products]);

  const scopedOrders = useMemo(
    () => orders.filter((o) => isWithin(orderDate(o), startMs)),
    [orders, startMs],
  );

  const scopedTransactions = useMemo(
    () => transactions.filter((t) => isWithin(t.date || t.createdAt, startMs)),
    [transactions, startMs],
  );

  const scopedAds = useMemo(
    () => ads.filter((a) => isWithin(`${a.date}T12:00:00`, startMs)),
    [ads, startMs],
  );

  // Produits : rentabilité & décision à partir des vraies économies produit
  const productRows = useMemo(() => {
    return products.map((p) => {
      const price = asNumber(p.sellingPrice);
      const cost = asNumber(p.productCost);
      const delivery = asNumber(p.deliveryCost);
      const adsCost = asNumber(p.avgAdsCost);
      const stock = asNumber(p.stock);
      const threshold = asNumber(p.reorderThreshold) || 10;
      const grossMargin = price - cost;
      const netProfit = price - cost - delivery - adsCost;

      let stockTone = 'green';
      let stockLabel = 'Vert';
      if (stock <= 0) {
        stockTone = 'red';
        stockLabel = 'Rupture';
      } else if (stock <= threshold) {
        stockTone = 'red';
        stockLabel = 'Bas';
      } else if (stock <= threshold * 2) {
        stockTone = 'orange';
        stockLabel = 'Moyen';
      }

      let rentability;
      let decision;
      if (p.isActive === false || p.status === 'pause') {
        rentability = { label: 'Inactif', tone: 'gray' };
        decision = { label: 'En pause', tone: 'gray' };
      } else if (p.status === 'stop') {
        rentability = { label: 'Arrêté', tone: 'red' };
        decision = { label: 'Couper', tone: 'red' };
      } else if (stock <= 0) {
        rentability = { label: 'Rupture', tone: 'red' };
        decision = { label: 'Recommander', tone: 'orange' };
      } else if (netProfit >= PROFIT_TARGET) {
        rentability = { label: 'Rentable', tone: 'green' };
        decision = stock <= threshold ? { label: 'Recommander', tone: 'orange' } : { label: 'Pousser', tone: 'green' };
      } else if (netProfit >= 2500) {
        rentability = { label: 'À surveiller', tone: 'orange' };
        decision = { label: 'Réduire', tone: 'orange' };
      } else {
        rentability = { label: 'Non rentable', tone: 'red' };
        decision = { label: 'Couper', tone: 'red' };
      }

      return {
        ...p,
        price,
        cost,
        delivery,
        adsCost,
        stock,
        threshold,
        grossMargin,
        netProfit,
        stockTone,
        stockLabel,
        rentability,
        decision,
      };
    });
  }, [products]);

  // Indicateurs commandes sur la période sélectionnée
  const derived = useMemo(() => {
    const generated = scopedOrders.length;
    const confirmedList = scopedOrders.filter((o) => CONFIRMED_FUNNEL.includes(o.status));
    const deliveredList = scopedOrders.filter((o) => o.status === 'delivered');
    const returnedList = scopedOrders.filter((o) => o.status === 'returned');
    const confirmed = confirmedList.length;
    const delivered = deliveredList.length;
    const collectedRevenue = deliveredList.reduce((sum, o) => sum + orderRevenue(o), 0);
    const deliveryRate = confirmed ? (delivered / confirmed) * 100 : 0;

    // Ventes livrées par produit (pour winner + bénéfice réel)
    const deliveredByProduct = new Map();
    deliveredList.forEach((o) => {
      const p = matchOrderToProduct(o, products, productIndex.byId, productIndex.byName);
      const key = p ? String(p._id) : `name:${(o.product || 'inconnu').toLowerCase()}`;
      deliveredByProduct.set(key, (deliveredByProduct.get(key) || 0) + 1);
    });

    const productRowsWithSales = productRows.map((row) => {
      const soldUnits = deliveredByProduct.get(String(row._id)) || 0;
      return { ...row, soldUnits, realProfit: Math.max(0, row.netProfit) * soldUnits };
    });

    const estimatedProfit = productRowsWithSales.reduce((sum, row) => sum + row.realProfit, 0);

    // Finances réelles (transactions de la période)
    let income = 0;
    let expense = 0;
    const byCategory = {};
    scopedTransactions.forEach((t) => {
      const amount = asNumber(t.amount);
      if (t.type === 'income') income += amount;
      else expense += amount;
      byCategory[t.category] = (byCategory[t.category] || 0) + amount;
    });
    const realNetProfit = income - expense;
    // Solde caisse = net cumulé sur les transactions chargées (récentes)
    const cashAvailable = transactions.reduce(
      (sum, t) => sum + (t.type === 'income' ? asNumber(t.amount) : -asNumber(t.amount)),
      0,
    );

    // Pub : saisie manuelle (décision utilisateur), repli sur transactions "publicite"
    const adSpentManual = scopedAds.reduce((sum, a) => sum + asNumber(a.budget), 0);
    const adSpent = adSpentManual || (byCategory.publicite || 0);

    // Listes de décision produit
    const productsToCut = productRowsWithSales.filter((r) => r.decision.label === 'Couper');
    const productsToReorder = productRowsWithSales.filter((r) => r.stock > 0 && r.stock <= r.threshold);
    const stockOut = productRowsWithSales.filter((r) => r.stock <= 0);
    const productToPush = [...productRowsWithSales]
      .filter((r) => r.decision.label === 'Pousser')
      .sort((a, b) => b.netProfit - a.netProfit)[0];
    const productToReduce = [...productRowsWithSales]
      .filter((r) => r.decision.label === 'Réduire')
      .sort((a, b) => a.netProfit - b.netProfit)[0];
    const winnerBySales = [...productRowsWithSales].sort((a, b) => b.soldUnits - a.soldUnits)[0];
    const productToCut = productsToCut[0];

    // Ville prioritaire (meilleur taux de livraison)
    const cityMap = new Map();
    scopedOrders.forEach((o) => {
      const city = (o.city || '—').trim() || '—';
      if (!cityMap.has(city)) cityMap.set(city, { city, confirmed: 0, delivered: 0, returned: 0, revenue: 0 });
      const entry = cityMap.get(city);
      if (CONFIRMED_FUNNEL.includes(o.status)) entry.confirmed += 1;
      if (o.status === 'delivered') {
        entry.delivered += 1;
        entry.revenue += orderRevenue(o);
      }
      if (o.status === 'returned') entry.returned += 1;
    });
    const cityRows = [...cityMap.values()].map((c) => ({
      ...c,
      rate: c.confirmed ? (c.delivered / c.confirmed) * 100 : 0,
    }));
    const priorityCity = [...cityRows].filter((c) => c.confirmed > 0).sort((a, b) => b.rate - a.rate)[0]?.city || '—';

    const maxAdBudget = Math.max(
      0,
      Math.min(
        cashAvailable * 0.35,
        productRowsWithSales.reduce(
          (sum, r) => sum + (r.decision.label === 'Pousser' ? Math.max(0, r.netProfit - PROFIT_TARGET) * 4 : 0),
          0,
        ),
      ),
    );

    const mainProblem = stockOut.length
      ? 'Produit en rupture de stock'
      : productsToCut.length
        ? 'Produit non rentable à couper'
        : productsToReorder.length
          ? 'Stock sous le seuil de sécurité'
          : deliveryRate && deliveryRate < 60
            ? 'Taux de livraison faible'
            : 'Aucun blocage majeur';

    const recommendation = productToCut
      ? `Couper ${productToCut.name} et concentrer le budget sur ${productToPush?.name || winnerBySales?.name || 'le produit rentable'}.`
      : productsToReorder[0]
        ? `Recommander ${productsToReorder[0].name} avant de scaler.`
        : productToPush
          ? `Pousser ${productToPush.name} sans dépasser ${money(maxAdBudget)} de budget pub.`
          : 'Garder les budgets stables et surveiller le coût pub par vente livrée.';

    return {
      generated,
      confirmed,
      delivered,
      returned: returnedList.length,
      collectedRevenue,
      deliveryRate,
      estimatedProfit,
      income,
      expense,
      byCategory,
      realNetProfit,
      cashAvailable,
      adSpent,
      adSpentManual,
      productRows: productRowsWithSales,
      productsToCut,
      productsToReorder,
      stockOut,
      productToPush,
      productToReduce,
      productToCut,
      winnerBySales,
      cityRows,
      priorityCity,
      maxAdBudget,
      mainProblem,
      recommendation,
    };
  }, [scopedOrders, scopedTransactions, scopedAds, transactions, products, productRows, productIndex]);

  // Équipe : répartition par rôle
  const teamByRole = useMemo(() => {
    const livreurs = team.filter((m) => m.role === 'ecom_livreur');
    const closeuses = team.filter((m) => m.role === 'ecom_closeuse');
    const comptas = team.filter((m) => m.role === 'ecom_compta');
    const others = team.filter((m) => !['ecom_livreur', 'ecom_closeuse', 'ecom_compta'].includes(m.role));
    return { livreurs, closeuses, comptas, others };
  }, [team]);

  // Villes connues (pour la saisie pub)
  const knownCities = useMemo(() => {
    const set = new Set();
    orders.forEach((o) => {
      const c = (o.city || '').trim();
      if (c) set.add(c);
    });
    return [...set].sort();
  }, [orders]);

  // Lignes pub enrichies par les vraies commandes
  const adRows = useMemo(() => {
    return [...ads]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((ad) => {
        const product = ad.productId ? productIndex.byId.get(String(ad.productId)) : null;
        const cityNorm = (ad.city || '').trim().toLowerCase();
        const matching = orders.filter((o) => {
          if (dayKey(orderDate(o)) !== ad.date) return false;
          if (cityNorm && (o.city || '').trim().toLowerCase() !== cityNorm) return false;
          if (ad.productId) {
            const p = matchOrderToProduct(o, products, productIndex.byId, productIndex.byName);
            return p && String(p._id) === String(ad.productId);
          }
          return true;
        });
        const generated = matching.length;
        const confirmed = matching.filter((o) => CONFIRMED_FUNNEL.includes(o.status)).length;
        const delivered = matching.filter((o) => o.status === 'delivered').length;
        const revenue = matching.filter((o) => o.status === 'delivered').reduce((s, o) => s + orderRevenue(o), 0);
        const budget = asNumber(ad.budget);
        const costPerOrder = generated ? budget / generated : null;
        const costPerDelivered = delivered ? budget / delivered : null;

        let tone = 'gray';
        let suggestion = ad.decision || 'Garder';
        if (costPerDelivered == null) {
          tone = 'gray';
          suggestion = generated ? 'À suivre' : 'Pas de commande';
        } else if (costPerDelivered <= 2500) {
          tone = 'green';
          suggestion = 'Augmenter';
        } else if (costPerDelivered <= 3500) {
          tone = 'orange';
          suggestion = 'Garder';
        } else if (costPerDelivered <= 4500) {
          tone = 'orange';
          suggestion = 'Réduire';
        } else {
          tone = 'red';
          suggestion = 'Couper';
        }

        return {
          ...ad,
          productName: product?.name || 'Tous produits',
          generated,
          confirmed,
          delivered,
          revenue,
          costPerOrder,
          costPerDelivered,
          tone,
          suggestion,
        };
      });
  }, [ads, orders, products, productIndex]);

  // ── Actions pub ────────────────────────────────────────────────────────────
  const submitAd = (event) => {
    event.preventDefault();
    const payload = {
      id: uid('ad'),
      date: adForm.date || todayKey(),
      productId: adForm.productId || '',
      city: adForm.city.trim(),
      budget: asNumber(adForm.budget),
      decision: adForm.decision,
      note: adForm.note.trim(),
    };
    if (!payload.budget) return;
    setAds((current) => [payload, ...current]);
    setAdForm(emptyAdForm());
  };

  const deleteAd = (id) => {
    setAds((current) => current.filter((a) => a.id !== id));
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'stock', label: 'Stock', icon: PackageCheck },
    { id: 'orders', label: 'Commandes', icon: ShoppingCart },
    { id: 'ads', label: 'Publicités', icon: Megaphone },
    { id: 'deliveries', label: 'Livraisons', icon: Truck },
    { id: 'finances', label: 'Finances', icon: Wallet },
    { id: 'team', label: 'Équipe', icon: Users },
    { id: 'report', label: 'Rapport', icon: FileText },
  ];

  const periodLabel = PERIODS.find((p) => p.id === periodDays)?.label || '';
  const reportSummary = `Sur la période « ${periodLabel} », le business a encaissé ${money(derived.collectedRevenue)} sur ${derived.delivered} commande(s) livrée(s) (taux ${percent(derived.deliveryRate)}), pour un bénéfice estimé de ${money(derived.estimatedProfit)}. Produit le plus vendu : ${derived.winnerBySales?.name || 'à confirmer'}. Produit à couper : ${derived.productToCut?.name || 'aucun'}. Priorité : ${derived.recommendation}`;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="h-7 w-7 animate-spin text-primary-600" aria-hidden="true" />
          <p className="text-sm font-semibold">Chargement des données Scalor…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => loadData(false)}
            className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-primary-600">Pilotage COD — données Scalor en direct</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Centre de contrôle</h1>
            {lastUpdated && (
              <p className="mt-1 text-xs text-gray-400">
                Mis à jour à {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 bg-white p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodDays(p.id)}
                  className={`min-h-[36px] rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    periodDays === p.id ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              Actualiser
            </button>
          </div>
        </header>

        {partialError && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {partialError}
          </div>
        )}

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

        {/* ─────────────── Tableau de bord ─────────────── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard title="CA encaissé" value={money(derived.collectedRevenue)} detail={`Livré & encaissé · ${periodLabel}`} icon={Wallet} tone="green" />
              <KpiCard title="Bénéfice estimé" value={money(derived.estimatedProfit)} detail={`Cible nette ${money(PROFIT_TARGET)} / vente`} icon={TrendingUp} tone={derived.estimatedProfit >= 0 ? 'green' : 'red'} />
              <KpiCard title="Budget pub dépensé" value={money(derived.adSpent)} detail={derived.adSpentManual ? 'Saisie manuelle' : 'Transactions « publicité »'} icon={Megaphone} tone="orange" />
              <KpiCard title="Commandes générées" value={derived.generated.toLocaleString('fr-FR')} detail={`${derived.confirmed} confirmées`} icon={ShoppingCart} tone="gray" />
              <KpiCard title="Commandes livrées" value={derived.delivered.toLocaleString('fr-FR')} detail={`Taux livraison ${percent(derived.deliveryRate)}`} icon={Truck} tone={derived.deliveryRate >= 70 ? 'green' : 'orange'} />
              <KpiCard title="Produits en rupture" value={derived.stockOut.length.toLocaleString('fr-FR')} detail="Stock à zéro" icon={AlertTriangle} tone={derived.stockOut.length ? 'red' : 'green'} />
              <KpiCard title="Produits à couper" value={derived.productsToCut.length.toLocaleString('fr-FR')} detail="Non rentable ou arrêté" icon={Ban} tone={derived.productsToCut.length ? 'red' : 'green'} />
              <KpiCard title="Stock à recommander" value={derived.productsToReorder.length.toLocaleString('fr-FR')} detail="Sous le seuil" icon={Package} tone={derived.productsToReorder.length ? 'orange' : 'green'} />
              <KpiCard title="Solde caisse" value={money(derived.cashAvailable)} detail="Net transactions récentes" icon={Wallet} tone={derived.cashAvailable >= 0 ? 'green' : 'red'} />
              <KpiCard title="Budget pub max" value={money(derived.maxAdBudget)} detail="Plafond prudent" icon={TrendingUp} tone="green" />
            </div>

            <Panel title="Décision du jour">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Produit à pousser', derived.productToPush?.name || 'À confirmer', derived.productToPush ? 'green' : 'gray'],
                  ['Produit à réduire', derived.productToReduce?.name || 'Aucun', derived.productToReduce ? 'orange' : 'gray'],
                  ['Produit à couper', derived.productToCut?.name || 'Aucun', derived.productToCut ? 'red' : 'green'],
                  ['Plus vendu', derived.winnerBySales?.name || '—', 'green'],
                  ['Ville prioritaire', derived.priorityCity, 'green'],
                  ['Budget pub max', money(derived.maxAdBudget), 'green'],
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

        {/* ─────────────── Produits ─────────────── */}
        {activeTab === 'products' && (
          <Panel title={`Produits (${productRows.length})`}>
            <TableShell>
              <thead>
                <tr>
                  <Th>Produit</Th>
                  <Th>Statut</Th>
                  <Th align="right">Prix</Th>
                  <Th align="right">Coût</Th>
                  <Th align="right">Livraison</Th>
                  <Th align="right">Coût pub moy.</Th>
                  <Th align="right">Marge brute</Th>
                  <Th align="right">Bénéfice net</Th>
                  <Th align="right">Stock</Th>
                  <Th align="right">Vendus</Th>
                  <Th>Rentabilité</Th>
                  <Th>Décision</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {derived.productRows.length === 0 && <EmptyRow colSpan={12} label="Aucun produit dans Scalor." />}
                {derived.productRows.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <Td className="font-semibold text-gray-900">{p.name}</Td>
                    <Td><Badge tone={p.status === 'winner' ? 'green' : p.status === 'stop' ? 'red' : p.status === 'pause' ? 'gray' : 'orange'}>{PRODUCT_STATUS_LABELS[p.status] || p.status}</Badge></Td>
                    <Td align="right" className="tabular-nums">{money(p.price)}</Td>
                    <Td align="right" className="tabular-nums">{money(p.cost)}</Td>
                    <Td align="right" className="tabular-nums">{money(p.delivery)}</Td>
                    <Td align="right" className="tabular-nums">{money(p.adsCost)}</Td>
                    <Td align="right" className="tabular-nums">{money(p.grossMargin)}</Td>
                    <Td align="right" className={`tabular-nums font-semibold ${p.netProfit >= PROFIT_TARGET ? 'text-green-700' : p.netProfit < 0 ? 'text-red-600' : 'text-gray-700'}`}>{money(p.netProfit)}</Td>
                    <Td align="right" className="font-semibold tabular-nums">{p.stock}</Td>
                    <Td align="right" className="tabular-nums">{p.soldUnits}</Td>
                    <Td><Badge tone={p.rentability.tone}>{p.rentability.label}</Badge></Td>
                    <Td><Badge tone={p.decision.tone}>{p.decision.label}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <p className="mt-3 text-xs text-gray-400">Vendus = commandes livrées sur « {periodLabel} ». Économies et stock proviennent de la fiche produit Scalor.</p>
          </Panel>
        )}

        {/* ─────────────── Stock ─────────────── */}
        {activeTab === 'stock' && (
          <Panel title="Stock par produit">
            <TableShell>
              <thead>
                <tr>
                  <Th>Produit</Th>
                  <Th align="right">Stock actuel</Th>
                  <Th align="right">Seuil</Th>
                  <Th align="right">Valeur stock</Th>
                  <Th align="right">Vendus ({periodLabel})</Th>
                  <Th>Statut stock</Th>
                  <Th>Décision pub</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {derived.productRows.length === 0 && <EmptyRow colSpan={7} label="Aucun produit dans Scalor." />}
                {derived.productRows.map((p) => {
                  const pubDecision =
                    p.stockTone === 'red' ? { label: 'Coupée', tone: 'red' } : p.stockTone === 'orange' ? { label: 'Réduite', tone: 'orange' } : { label: 'Autorisée', tone: 'green' };
                  return (
                    <tr key={p._id} className="hover:bg-gray-50">
                      <Td className="font-semibold text-gray-900">{p.name}</Td>
                      <Td align="right" className="font-bold tabular-nums">{p.stock}</Td>
                      <Td align="right" className="tabular-nums text-gray-500">{p.threshold}</Td>
                      <Td align="right" className="tabular-nums">{money(p.stock * p.price)}</Td>
                      <Td align="right" className="tabular-nums">{p.soldUnits}</Td>
                      <Td><Badge tone={p.stockTone}>{p.stockLabel}</Badge></Td>
                      <Td><Badge tone={pubDecision.tone}>{pubDecision.label}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
            <p className="mt-3 text-xs text-gray-400">Règle : stock ≤ seuil → pub coupée · stock ≤ 2× seuil → pub réduite. Seuil par défaut 10 si non défini sur la fiche produit.</p>
          </Panel>
        )}

        {/* ─────────────── Commandes ─────────────── */}
        {activeTab === 'orders' && (
          <Panel title={`Commandes — ${periodLabel} (${scopedOrders.length})`}>
            <TableShell>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Client</Th>
                  <Th>Téléphone</Th>
                  <Th>Ville</Th>
                  <Th>Produit</Th>
                  <Th align="right">Qté</Th>
                  <Th align="right">Montant</Th>
                  <Th>Statut</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {scopedOrders.length === 0 && <EmptyRow colSpan={8} label="Aucune commande sur cette période." />}
                {scopedOrders
                  .slice()
                  .sort((a, b) => new Date(orderDate(b)) - new Date(orderDate(a)))
                  .slice(0, 200)
                  .map((o) => (
                    <tr key={o._id} className="hover:bg-gray-50">
                      <Td>{dayKey(orderDate(o)) || '—'}</Td>
                      <Td className="font-semibold text-gray-900">{o.clientName || '—'}</Td>
                      <Td>{o.clientPhone || '—'}</Td>
                      <Td>{o.city || '—'}</Td>
                      <Td>{o.product || '—'}</Td>
                      <Td align="right">{o.quantity || 1}</Td>
                      <Td align="right" className="tabular-nums font-semibold">{money(orderRevenue(o))}</Td>
                      <Td><Badge tone={STATUS_TONE[o.status] || 'gray'}>{STATUS_LABELS[o.status] || o.status}</Badge></Td>
                    </tr>
                  ))}
              </tbody>
            </TableShell>
            {scopedOrders.length > 200 && <p className="mt-3 text-xs text-gray-400">200 commandes les plus récentes affichées sur {scopedOrders.length}.</p>}
          </Panel>
        )}

        {/* ─────────────── Publicités (hybride) ─────────────── */}
        {activeTab === 'ads' && (
          <div className="space-y-5">
            <div className="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-900">
              <Megaphone className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>Le budget pub Facebook/TikTok est saisi à la main (Scalor ne le stocke pas). Les commandes générées, confirmées, livrées et le coût par vente livrée sont calculés automatiquement à partir des vraies commandes du même jour, produit et ville.</span>
            </div>

            <Panel title="Ajouter une dépense pub">
              <form onSubmit={submitAd} className="grid gap-3 md:grid-cols-6">
                <Input label="Date" type="date" value={adForm.date} onChange={(e) => setAdForm((f) => ({ ...f, date: e.target.value }))} />
                <Select label="Produit" value={adForm.productId} onChange={(e) => setAdForm((f) => ({ ...f, productId: e.target.value }))}>
                  <option value="">Tous produits</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </Select>
                <Input label="Ville ciblée" list="cc-cities" value={adForm.city} onChange={(e) => setAdForm((f) => ({ ...f, city: e.target.value }))} placeholder="Toutes" />
                <datalist id="cc-cities">
                  {knownCities.map((c) => <option key={c} value={c} />)}
                </datalist>
                <Input label="Budget dépensé" type="number" value={adForm.budget} onChange={(e) => setAdForm((f) => ({ ...f, budget: e.target.value }))} required />
                <Select label="Décision" value={adForm.decision} onChange={(e) => setAdForm((f) => ({ ...f, decision: e.target.value }))}>
                  {AD_DECISIONS.map((d) => <option key={d}>{d}</option>)}
                </Select>
                <div className="flex items-end">
                  <button type="submit" className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Ajouter
                  </button>
                </div>
                <Input label="Note" value={adForm.note} onChange={(e) => setAdForm((f) => ({ ...f, note: e.target.value }))} className="md:col-span-6" />
              </form>
            </Panel>

            <Panel title="Publicités">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Produit</Th>
                    <Th>Ville</Th>
                    <Th align="right">Budget</Th>
                    <Th align="right">Générées</Th>
                    <Th align="right">Confirmées</Th>
                    <Th align="right">Livrées</Th>
                    <Th align="right">CA livré</Th>
                    <Th align="right">Coût / commande</Th>
                    <Th align="right">Coût / vente</Th>
                    <Th>Suggestion</Th>
                    <Th align="center">—</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {adRows.length === 0 && <EmptyRow colSpan={12} label="Aucune dépense pub saisie." />}
                  {adRows.map((ad) => (
                    <tr key={ad.id} className="hover:bg-gray-50">
                      <Td>{ad.date}</Td>
                      <Td className="font-semibold text-gray-900">{ad.productName}</Td>
                      <Td>{ad.city || 'Toutes'}</Td>
                      <Td align="right" className="tabular-nums">{money(ad.budget)}</Td>
                      <Td align="right" className="tabular-nums">{ad.generated}</Td>
                      <Td align="right" className="tabular-nums">{ad.confirmed}</Td>
                      <Td align="right" className="tabular-nums">{ad.delivered}</Td>
                      <Td align="right" className="tabular-nums">{money(ad.revenue)}</Td>
                      <Td align="right" className="tabular-nums">{ad.costPerOrder == null ? '—' : money(ad.costPerOrder)}</Td>
                      <Td align="right" className="tabular-nums">{ad.costPerDelivered == null ? '—' : money(ad.costPerDelivered)}</Td>
                      <Td><Badge tone={ad.tone}>{ad.suggestion}</Badge></Td>
                      <Td align="center">
                        <button type="button" onClick={() => deleteAd(ad.id)} title="Supprimer" aria-label="Supprimer la dépense pub" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {/* ─────────────── Livraisons ─────────────── */}
        {activeTab === 'deliveries' && (
          <div className="space-y-5">
            <Panel title="Livraisons par ville">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Ville</Th>
                    <Th align="right">Confirmées</Th>
                    <Th align="right">Livrées</Th>
                    <Th align="right">Retours</Th>
                    <Th align="right">CA livré</Th>
                    <Th>Taux livraison</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {derived.cityRows.length === 0 && <EmptyRow colSpan={6} label="Aucune commande sur cette période." />}
                  {derived.cityRows
                    .slice()
                    .sort((a, b) => b.delivered - a.delivered)
                    .map((c) => (
                      <tr key={c.city} className="hover:bg-gray-50">
                        <Td className="font-semibold text-gray-900">{c.city}</Td>
                        <Td align="right" className="tabular-nums">{c.confirmed}</Td>
                        <Td align="right" className="tabular-nums font-semibold">{c.delivered}</Td>
                        <Td align="right" className="tabular-nums">{c.returned}</Td>
                        <Td align="right" className="tabular-nums">{money(c.revenue)}</Td>
                        <Td><Badge tone={c.rate >= 70 ? 'green' : c.rate >= 50 ? 'orange' : 'red'}>{percent(c.rate)}</Badge></Td>
                      </tr>
                    ))}
                </tbody>
              </TableShell>
            </Panel>

            <Panel title="Performance des livreurs (90 derniers jours)">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Livreur</Th>
                    <Th align="right">Assignées</Th>
                    <Th align="right">Livrées</Th>
                    <Th align="right">Retours</Th>
                    <Th align="right">En cours</Th>
                    <Th align="right">CA livré</Th>
                    <Th>Taux</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {teamByRole.livreurs.length === 0 && <EmptyRow colSpan={7} label="Aucun livreur enregistré." />}
                  {teamByRole.livreurs.map((m) => {
                    const s = m.stats || {};
                    const rate = asNumber(s.deliveryRate);
                    return (
                      <tr key={m._id} className="hover:bg-gray-50">
                        <Td className="font-semibold text-gray-900">{m.name}</Td>
                        <Td align="right" className="tabular-nums">{asNumber(s.assigned)}</Td>
                        <Td align="right" className="tabular-nums font-semibold">{asNumber(s.delivered)}</Td>
                        <Td align="right" className="tabular-nums">{asNumber(s.returned)}</Td>
                        <Td align="right" className="tabular-nums">{asNumber(s.pending)}</Td>
                        <Td align="right" className="tabular-nums">{money(s.revenue)}</Td>
                        <Td><Badge tone={rate >= 70 ? 'green' : rate >= 50 ? 'orange' : 'red'}>{percent(rate)}</Badge></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {/* ─────────────── Finances ─────────────── */}
        {activeTab === 'finances' && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="Entrées" value={money(derived.income)} detail={`Transactions · ${periodLabel}`} icon={TrendingUp} tone="green" />
              <KpiCard title="Dépenses" value={money(derived.expense)} detail={`Dont pub ${money(derived.byCategory.publicite || 0)}`} icon={TrendingDown} tone="red" />
              <KpiCard title="Bénéfice réel" value={money(derived.realNetProfit)} detail="Entrées − dépenses" icon={Wallet} tone={derived.realNetProfit >= 0 ? 'green' : 'red'} />
              <KpiCard title="Solde caisse" value={money(derived.cashAvailable)} detail="Net transactions récentes" icon={Wallet} tone={derived.cashAvailable >= 0 ? 'green' : 'red'} />
            </div>

            <Panel title="Dépenses par catégorie">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Object.keys(derived.byCategory).length === 0 && <p className="text-sm text-gray-400">Aucune transaction sur cette période.</p>}
                {Object.entries(derived.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => (
                    <div key={cat} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs font-semibold uppercase text-gray-500">{CATEGORY_LABELS[cat] || cat}</p>
                      <p className="mt-1 text-sm font-bold text-gray-900 tabular-nums">{money(amount)}</p>
                    </div>
                  ))}
              </div>
            </Panel>

            <Panel title={`Transactions récentes — ${periodLabel}`}>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Catégorie</Th>
                    <Th>Description</Th>
                    <Th align="right">Montant</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {scopedTransactions.length === 0 && <EmptyRow colSpan={5} label="Aucune transaction sur cette période." />}
                  {scopedTransactions
                    .slice()
                    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
                    .slice(0, 100)
                    .map((t) => (
                      <tr key={t._id} className="hover:bg-gray-50">
                        <Td>{dayKey(t.date || t.createdAt) || '—'}</Td>
                        <Td><Badge tone={t.type === 'income' ? 'green' : 'red'}>{t.type === 'income' ? 'Entrée' : 'Dépense'}</Badge></Td>
                        <Td>{CATEGORY_LABELS[t.category] || t.category}</Td>
                        <Td className="max-w-[260px] truncate">{t.description || '—'}</Td>
                        <Td align="right" className={`tabular-nums font-semibold ${t.type === 'income' ? 'text-green-700' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</Td>
                      </tr>
                    ))}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {/* ─────────────── Équipe ─────────────── */}
        {activeTab === 'team' && (
          <div className="space-y-5">
            <Panel title="Closeuses (90 derniers jours)">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Nom</Th>
                    <Th align="right">Traitées</Th>
                    <Th align="right">Confirmées</Th>
                    <Th align="right">Annulées</Th>
                    <Th align="right">Injoignables</Th>
                    <Th align="right">CA confirmé</Th>
                    <Th>Taux confirmation</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {teamByRole.closeuses.length === 0 && <EmptyRow colSpan={7} label="Aucune closeuse enregistrée." />}
                  {teamByRole.closeuses.map((m) => {
                    const s = m.stats || {};
                    const rate = asNumber(s.confirmationRate);
                    return (
                      <tr key={m._id} className="hover:bg-gray-50">
                        <Td className="font-semibold text-gray-900">{m.name}</Td>
                        <Td align="right" className="tabular-nums">{asNumber(s.totalProcessed)}</Td>
                        <Td align="right" className="tabular-nums font-semibold">{asNumber(s.confirmed)}</Td>
                        <Td align="right" className="tabular-nums">{asNumber(s.cancelled)}</Td>
                        <Td align="right" className="tabular-nums">{asNumber(s.unreachable)}</Td>
                        <Td align="right" className="tabular-nums">{money(s.revenue)}</Td>
                        <Td><Badge tone={rate >= 60 ? 'green' : rate >= 40 ? 'orange' : 'red'}>{percent(rate)}</Badge></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </Panel>

            <Panel title="Comptables & autres membres">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Nom</Th>
                    <Th>Rôle</Th>
                    <Th align="right">Entrées</Th>
                    <Th align="right">Dépenses</Th>
                    <Th align="right">Solde net</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {[...teamByRole.comptas, ...teamByRole.others].length === 0 && <EmptyRow colSpan={5} label="Aucun autre membre." />}
                  {[...teamByRole.comptas, ...teamByRole.others].map((m) => {
                    const s = m.stats || {};
                    return (
                      <tr key={m._id} className="hover:bg-gray-50">
                        <Td className="font-semibold text-gray-900">{m.name}</Td>
                        <Td><Badge tone="gray">{ROLE_LABELS[m.role] || m.role}</Badge></Td>
                        <Td align="right" className="tabular-nums">{s.totalIncome != null ? money(s.totalIncome) : '—'}</Td>
                        <Td align="right" className="tabular-nums">{s.totalExpense != null ? money(s.totalExpense) : '—'}</Td>
                        <Td align="right" className="tabular-nums font-semibold">{s.netBalance != null ? money(s.netBalance) : '—'}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </Panel>
          </div>
        )}

        {/* ─────────────── Rapport ─────────────── */}
        {activeTab === 'report' && (
          <div className="space-y-5">
            <Panel title={`Rapport — ${periodLabel}`}>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['Période', periodLabel],
                  ['CA encaissé', money(derived.collectedRevenue)],
                  ['Bénéfice estimé', money(derived.estimatedProfit)],
                  ['Bénéfice réel (compta)', money(derived.realNetProfit)],
                  ['Budget pub dépensé', money(derived.adSpent)],
                  ['Commandes générées', derived.generated],
                  ['Commandes confirmées', derived.confirmed],
                  ['Commandes livrées', derived.delivered],
                  ['Taux de livraison', percent(derived.deliveryRate)],
                  ['Produit le plus vendu', derived.winnerBySales?.name || '—'],
                  ['Produit à couper', derived.productToCut?.name || '—'],
                  ['Stock critique', derived.productsToReorder.map((p) => p.name).join(', ') || '—'],
                  ['Problème principal', derived.mainProblem],
                  ['Ville prioritaire', derived.priorityCity],
                  ['Solde caisse', money(derived.cashAvailable)],
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
                  ['Stock ≤ seuil = pub coupée', CheckCircle2],
                  ['Commande confirmée = funnel actif', PackageCheck],
                  ['Vente = commande livrée', Wallet],
                  ['Rentabilité nette avant volume', TrendingUp],
                  ['Coût pub par vente livrée prioritaire', Megaphone],
                  ['Stock sous le seuil = recommander', AlertTriangle],
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
              Données en direct
            </div>
            <p className="mt-1 text-xs text-gray-500">Produits, commandes, finances et équipe proviennent de votre espace Scalor.</p>
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
