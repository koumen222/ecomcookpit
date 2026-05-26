import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi';
import { useMoney } from '../hooks/useMoney';
import { getContextualError } from '../utils/errorMessages';

const I = {
  back: 'M15 19l-7-7 7-7',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  package: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  cash: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  check: 'M5 13l4 4L19 7',
  x: 'M6 18L18 6M6 6l12 12',
  alert: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  truck: 'M8 14H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2h-3m-4 0v3a2 2 0 01-2 2H8a2 2 0 01-2-2v-3m4 0h-4'
};

const Ico = ({d, className="w-5 h-5", ...props}) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d}/>
  </svg>
);

export default function SourcingStats() {
  const navigate = useNavigate();
  const { fmt: formatMoney } = useMoney();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get('/sourcing/stats');
      setStats(res.data.data);
      setError('');
    } catch (err) {
      setError(getContextualError(err, 'load_stats'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <Ico d={I.alert} className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-red-900 mb-2">Erreur de chargement</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button onClick={loadStats} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { orders, payment, toPlan, products, financial } = stats;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 lg:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/ecom/sourcing')} aria-label="Retour au sourcing" className="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:scale-95 text-gray-400 hover:text-gray-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1">
              <Ico d={I.back} className="w-5 h-5" aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Ico d={I.chart} className="w-6 h-6 text-primary-600" />
                Statistiques Sourcing
              </h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">Vue d'ensemble complète des commandes et paiements</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Vue d'ensemble commandes */}
        <section aria-labelledby="overview-title">
          <h2 id="overview-title" className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Ico d={I.package} className="w-5 h-5 text-gray-400" aria-hidden="true" />
            Vue d'ensemble
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={I.package} label="Total" value={orders.total} color="blue" />
            <StatCard icon={I.truck} label="En transit" value={orders.inTransit} color="orange" />
            <StatCard icon={I.check} label="Reçues" value={orders.received} color="emerald" />
            <StatCard icon={I.x} label="Annulées" value={orders.cancelled} color="red" />
          </div>
        </section>

        {/* Montant à prévoir */}
        <section aria-labelledby="toplan-title">
          <h2 id="toplan-title" className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Ico d={I.alert} className="w-5 h-5 text-orange-500" aria-hidden="true" />
            Montant à prévoir
            <span className="text-sm font-medium text-gray-400">(commandes en transit, impayées)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chine</p>
                <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center" aria-hidden="true">
                  <Ico d={I.cash} className="w-4 h-4 text-orange-600" />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900 tabular-nums mb-3">{formatMoney(toPlan.china.total)}</p>
              <div className="space-y-1.5 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-500">Achat</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(toPlan.china.purchase)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-500">Transport</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(toPlan.china.transport)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium pt-1 border-t border-gray-100">
                  <span className="text-gray-400">{toPlan.china.orders} commande{toPlan.china.orders > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Local</p>
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center" aria-hidden="true">
                  <Ico d={I.cash} className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900 tabular-nums mb-3">{formatMoney(toPlan.local.total)}</p>
              <div className="pt-3 border-t border-gray-100">
                <span className="text-xs font-medium text-gray-400">{toPlan.local.orders} commande{toPlan.local.orders > 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-purple-100 uppercase tracking-wide">Total à prévoir</p>
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center" aria-hidden="true">
                  <Ico d={I.chart} className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-black text-white tabular-nums mb-3">{formatMoney(toPlan.grandTotal)}</p>
              <div className="pt-3 border-t border-white/20">
                <span className="text-xs font-medium text-purple-100">{toPlan.china.orders + toPlan.local.orders} commande{(toPlan.china.orders + toPlan.local.orders) > 1 ? 's' : ''} en attente</span>
              </div>
            </div>
          </div>
        </section>

        {/* Paiements Chine + Local — côte à côte */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chine */}
          <section aria-labelledby="china-title" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <h2 id="china-title" className="text-base font-bold text-gray-900 flex items-center gap-2">
              Paiements Chine
              <span className="ml-auto text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{payment.china.total} commandes</span>
            </h2>
            <div className="space-y-2">
              <PaymentStatusRow label="Entièrement payé" value={payment.china.fullyPaid} total={payment.china.total} color="emerald" />
              <PaymentStatusRow label="Partiellement payé" value={payment.china.partiallyPaid} total={payment.china.total} color="yellow" />
              <PaymentStatusRow label="Non payé" value={payment.china.unpaid} total={payment.china.total} color="red" />
            </div>
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Achat Chine</p>
              <AmountRow label="Total" value={formatMoney(payment.china.amounts.totalPurchase)} />
              <AmountRow label="Payé" value={formatMoney(payment.china.amounts.paidPurchase)} color="emerald" />
              <AmountRow label="Impayé" value={formatMoney(payment.china.amounts.unpaidPurchase)} color="red" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">Transport</p>
              <AmountRow label="Total" value={formatMoney(payment.china.amounts.totalTransport)} />
              <AmountRow label="Payé" value={formatMoney(payment.china.amounts.paidTransport)} color="emerald" />
              <AmountRow label="Impayé" value={formatMoney(payment.china.amounts.unpaidTransport)} color="red" />
            </div>
          </section>

          {/* Local */}
          <section aria-labelledby="local-title" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <h2 id="local-title" className="text-base font-bold text-gray-900 flex items-center gap-2">
              Paiements Local
              <span className="ml-auto text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{payment.local.total} commandes</span>
            </h2>
            <div className="space-y-2">
              <PaymentStatusRow label="Payé" value={payment.local.paid} total={payment.local.total} color="emerald" />
              <PaymentStatusRow label="Non payé" value={payment.local.unpaid} total={payment.local.total} color="red" />
            </div>
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Montants</p>
              <AmountRow label="Total" value={formatMoney(payment.local.amounts.total)} />
              <AmountRow label="Payé" value={formatMoney(payment.local.amounts.paid)} color="emerald" />
              <AmountRow label="Impayé" value={formatMoney(payment.local.amounts.unpaid)} color="red" />
            </div>
          </section>
        </div>

        {/* Produits */}
        <section aria-labelledby="products-title">
          <h2 id="products-title" className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Ico d={I.package} className="w-5 h-5 text-gray-400" aria-hidden="true" />
            Statistiques Produits
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={I.package} label="Total produits" value={products.total} color="blue" />
            <StatCard icon={I.package} label="Stock total" value={products.totalStock} color="purple" />
            <StatCard icon={I.cash} label="Valeur stock" value={formatMoney(products.totalStockValue)} color="emerald" />
            <StatCard icon={I.alert} label="Stock faible" value={products.lowStock} color="orange" />
          </div>
          {products.lowStockProducts && products.lowStockProducts.length > 0 && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2 text-sm">
                <Ico d={I.alert} className="w-4 h-4" aria-hidden="true" />
                Produits en stock faible
              </h3>
              <div className="space-y-2">
                {products.lowStockProducts.map(p => (
                  <div key={p._id} className="flex justify-between items-center text-sm bg-white rounded-xl p-3 border border-orange-100">
                    <span className="font-semibold text-gray-900">{p.name}</span>
                    <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full tabular-nums">
                      {p.stock} / {p.reorderThreshold}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Résumé financier */}
        <section aria-labelledby="financial-title">
          <h2 id="financial-title" className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Ico d={I.cash} className="w-5 h-5 text-gray-400" aria-hidden="true" />
            Résumé Financier
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={I.cash} label="Total investi" value={formatMoney(financial.totalInvested)} color="blue" />
            <StatCard icon={I.check} label="Total payé" value={formatMoney(financial.totalPaid)} color="emerald" />
            <StatCard icon={I.alert} label="Total impayé" value={formatMoney(financial.totalUnpaid)} color="red" />
            <StatCard icon={I.chart} label="Profit potentiel" value={formatMoney(financial.totalPotentialProfit)} color="purple" />
          </div>
        </section>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const cfg = {
    blue:    { bg: 'bg-white border-gray-100', badge: 'bg-blue-100', icon: 'text-blue-600' },
    emerald: { bg: 'bg-white border-gray-100', badge: 'bg-primary-100', icon: 'text-primary-600' },
    orange:  { bg: 'bg-white border-gray-100', badge: 'bg-orange-100', icon: 'text-orange-600' },
    red:     { bg: 'bg-white border-gray-100', badge: 'bg-red-100', icon: 'text-red-600' },
    purple:  { bg: 'bg-white border-gray-100', badge: 'bg-purple-100', icon: 'text-purple-600' },
    yellow:  { bg: 'bg-white border-gray-100', badge: 'bg-yellow-100', icon: 'text-yellow-600' },
  };
  const c = cfg[color] || cfg.blue;

  return (
    <div className={`${c.bg} border rounded-2xl p-4 shadow-sm flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`w-7 h-7 rounded-lg ${c.badge} flex items-center justify-center`} aria-hidden="true">
          <Ico d={icon} className={`w-4 h-4 ${c.icon}`} />
        </div>
      </div>
      <p className="text-2xl font-black text-gray-900 tabular-nums leading-tight">{value}</p>
    </div>
  );
}

function AmountRow({ label, value, color }) {
  const textColor = color === 'emerald' ? 'text-primary-700' : color === 'red' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className={`font-bold tabular-nums ${textColor}`}>{value}</span>
    </div>
  );
}

function PaymentStatusRow({ label, value, total, color }) {
  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  const barColor = { emerald: 'bg-primary-400', yellow: 'bg-amber-400', red: 'bg-rose-400' };
  const textColor = { emerald: 'text-primary-700', yellow: 'text-amber-700', red: 'text-rose-700' };

  return (
    <div className="py-1.5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${textColor[color]}`}>{value} <span className="text-gray-400 font-normal">({percentage}%)</span></span>
      </div>
      <div
        className="w-full bg-gray-100 rounded-full h-2"
        role="progressbar"
        aria-valuenow={parseFloat(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={`h-2 rounded-full ${barColor[color]} transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
