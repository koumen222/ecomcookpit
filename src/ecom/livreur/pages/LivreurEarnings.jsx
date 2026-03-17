import React, { useEffect, useState } from 'react';
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  Package,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { livreurApi } from '../services/livreurApi.js';

export default function LivreurEarnings() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await livreurApi.getStats();
      setStats(res.data?.data || null);
    } catch {
      setError('Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-4 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-white text-2xl font-bold">Montant encaissé</h1>
          <button
            onClick={loadStats}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white active:scale-95"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="h-20 bg-white/10 rounded-2xl animate-pulse" />
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5">
            <p className="text-violet-200 text-sm mb-1">Total encaissé (cumulé)</p>
            <p className="text-white text-4xl font-bold">
              {fmt(stats?.allTime?.collected)} <span className="text-2xl font-medium opacity-80">FCFA</span>
            </p>
            <p className="text-violet-200 text-sm mt-2">
              {stats?.allTime?.delivered || 0} livraison{(stats?.allTime?.delivered || 0) > 1 ? 's' : ''} au total
            </p>
          </div>
        )}
      </div>

      <div className="px-4 py-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && stats && (
          <>
            {/* Period cards */}
            <div className="grid grid-cols-2 gap-3">
              <PeriodCard
                title="Ce mois"
                icon={<TrendingUp size={20} className="text-indigo-500" />}
                amount={fmt(stats.thisMonth?.collected)}
                deliveries={stats.thisMonth?.delivered || 0}
                bg="bg-indigo-50"
              />
              <PeriodCard
                title="Cette semaine"
                icon={<CheckCircle2 size={20} className="text-emerald-500" />}
                amount={fmt(stats.thisWeek?.collected)}
                deliveries={stats.thisWeek?.delivered || 0}
                bg="bg-emerald-50"
              />
            </div>

            {/* Summary table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Résumé</h2>
              </div>
              <div className="divide-y divide-gray-50">
                <SummaryRow
                  label="Livraisons en cours"
                  value={stats.inProgress || 0}
                  icon={<Package size={16} className="text-amber-500" />}
                />
                <SummaryRow
                  label="Courses disponibles"
                  value={stats.available || 0}
                  icon={<Package size={16} className="text-indigo-500" />}
                />
                <SummaryRow
                  label="Total livraisons"
                  value={stats.allTime?.delivered || 0}
                  icon={<CheckCircle2 size={16} className="text-green-500" />}
                  highlight
                />
              </div>
            </div>

            {/* Info card */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Wallet size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-800 font-semibold text-sm">Montant encaissé</p>
                  <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                    Total des prix des commandes collectés auprès des clients lors de vos livraisons.
                    Ce montant est à remettre à votre gestionnaire.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PeriodCard({ title, icon, amount, deliveries, bg }) {
  return (
    <div className={`${bg} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-semibold text-gray-700">{title}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{amount}</p>
      <p className="text-xs text-gray-500 mt-0.5">{deliveries} livraison{deliveries > 1 ? 's' : ''}</p>
    </div>
  );
}

function SummaryRow({ label, value, icon, highlight }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${highlight ? 'bg-green-50/50' : ''}`}>
      {icon}
      <span className={`flex-1 text-sm ${highlight ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`font-bold text-base ${highlight ? 'text-green-600' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}
