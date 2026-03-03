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

const Ico = ({d, className="w-5 h-5"}) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
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
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
            <button onClick={() => navigate('/ecom/sourcing')} className="p-2 -ml-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition">
              <Ico d={I.back} className="w-5 h-5"/>
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Ico d={I.chart} className="w-6 h-6 text-emerald-600" />
                Statistiques Sourcing
              </h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">Vue d'ensemble complète des commandes et paiements</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Vue d'ensemble commandes */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">📦 Vue d'ensemble</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard icon={I.package} label="Total" value={orders.total} color="blue" />
            <StatCard icon={I.truck} label="En transit" value={orders.inTransit} color="orange" />
            <StatCard icon={I.check} label="Reçues" value={orders.received} color="emerald" />
            <StatCard icon={I.x} label="Annulées" value={orders.cancelled} color="red" />
          </div>
        </div>

        {/* Montant à prévoir */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">💰 Montant à prévoir (En transit)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                  <Ico d={I.cash} className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-orange-700">Chine</p>
                  <p className="text-lg font-bold text-orange-800">{formatMoney(toPlan.china.total)}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-orange-600">Achat:</span>
                  <span className="font-medium text-orange-800">{formatMoney(toPlan.china.purchase)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-600">Transport:</span>
                  <span className="font-medium text-orange-800">{formatMoney(toPlan.china.transport)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-orange-200">
                  <span className="text-orange-600">Commandes:</span>
                  <span className="font-medium text-orange-800">{toPlan.china.orders}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <Ico d={I.cash} className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-700">Local</p>
                  <p className="text-lg font-bold text-blue-800">{formatMoney(toPlan.local.total)}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between pt-1 border-t border-blue-200">
                  <span className="text-blue-600">Commandes:</span>
                  <span className="font-medium text-blue-800">{toPlan.local.orders}</span>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                  <Ico d={I.chart} className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-purple-700">Total</p>
                  <p className="text-lg font-bold text-purple-800">{formatMoney(toPlan.grandTotal)}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between pt-1 border-t border-purple-200">
                  <span className="text-purple-600">Total commandes:</span>
                  <span className="font-medium text-purple-800">{toPlan.china.orders + toPlan.local.orders}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statuts de paiement - Chine */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">🇨🇳 Paiements Chine ({payment.china.total} commandes)</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Statuts */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Statuts de paiement</h3>
              <div className="space-y-3">
                <PaymentStatusRow label="Entièrement payé" value={payment.china.fullyPaid} total={payment.china.total} color="emerald" />
                <PaymentStatusRow label="Partiellement payé" value={payment.china.partiallyPaid} total={payment.china.total} color="yellow" />
                <PaymentStatusRow label="Non payé" value={payment.china.unpaid} total={payment.china.total} color="red" />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Achat payé:</span>
                  <span className="font-bold text-gray-900">{payment.china.paidPurchase} commandes</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Transport payé:</span>
                  <span className="font-bold text-gray-900">{payment.china.paidTransport} commandes</span>
                </div>
              </div>
            </div>

            {/* Montants */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Montants détaillés</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Achat Chine</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total:</span>
                      <span className="font-bold text-gray-900">{formatMoney(payment.china.amounts.totalPurchase)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600">Payé:</span>
                      <span className="font-bold text-emerald-600">{formatMoney(payment.china.amounts.paidPurchase)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">Impayé:</span>
                      <span className="font-bold text-red-600">{formatMoney(payment.china.amounts.unpaidPurchase)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600 mb-2">Transport</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total:</span>
                      <span className="font-bold text-gray-900">{formatMoney(payment.china.amounts.totalTransport)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600">Payé:</span>
                      <span className="font-bold text-emerald-600">{formatMoney(payment.china.amounts.paidTransport)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">Impayé:</span>
                      <span className="font-bold text-red-600">{formatMoney(payment.china.amounts.unpaidTransport)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statuts de paiement - Local */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">🇨🇲 Paiements Local ({payment.local.total} commandes)</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Statuts de paiement</h3>
              <div className="space-y-3">
                <PaymentStatusRow label="Payé" value={payment.local.paid} total={payment.local.total} color="emerald" />
                <PaymentStatusRow label="Non payé" value={payment.local.unpaid} total={payment.local.total} color="red" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Montants</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-bold text-gray-900">{formatMoney(payment.local.amounts.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-600">Payé:</span>
                  <span className="font-bold text-emerald-600">{formatMoney(payment.local.amounts.paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600">Impayé:</span>
                  <span className="font-bold text-red-600">{formatMoney(payment.local.amounts.unpaid)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques produits */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">📦 Statistiques Produits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={I.package} label="Total produits" value={products.total} color="blue" />
            <StatCard icon={I.package} label="Stock total" value={products.totalStock} color="purple" />
            <StatCard icon={I.cash} label="Valeur stock" value={formatMoney(products.totalStockValue)} color="emerald" isAmount />
            <StatCard icon={I.alert} label="Stock faible" value={products.lowStock} color="orange" />
          </div>

          {products.lowStockProducts && products.lowStockProducts.length > 0 && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                <Ico d={I.alert} className="w-5 h-5" />
                Produits en stock faible
              </h3>
              <div className="space-y-2">
                {products.lowStockProducts.map(p => (
                  <div key={p._id} className="flex justify-between items-center text-sm bg-white rounded-lg p-3">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    <span className="text-orange-600 font-bold">Stock: {p.stock} / Seuil: {p.reorderThreshold}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Résumé financier */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">💵 Résumé Financier</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={I.cash} label="Total investi" value={formatMoney(financial.totalInvested)} color="blue" isAmount />
            <StatCard icon={I.check} label="Total payé" value={formatMoney(financial.totalPaid)} color="emerald" isAmount />
            <StatCard icon={I.alert} label="Total impayé" value={formatMoney(financial.totalUnpaid)} color="red" isAmount />
            <StatCard icon={I.chart} label="Profit potentiel" value={formatMoney(financial.totalPotentialProfit)} color="purple" isAmount />
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100'
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[color]} shadow-xs`}>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${colors[color].split(' ')[0]} ${colors[color].split(' ')[1]}`}>
          <Ico d={icon} className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function PaymentStatusRow({ label, value, total, color }) {
  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  
  const colors = {
    emerald: 'bg-emerald-400',
    yellow: 'bg-amber-400',
    red: 'bg-rose-400'
  };

  const textColors = {
    emerald: 'text-emerald-700',
    yellow: 'text-amber-700',
    red: 'text-rose-700'
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-gray-600">{label}</span>
          <span className={`text-xs font-bold ${textColors[color]}`}>{value} ({percentage}%)</span>
        </div>
        <div className="w-full bg-gray-50 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full ${colors[color]} transition-all duration-300`} style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
    </div>
  );
}
