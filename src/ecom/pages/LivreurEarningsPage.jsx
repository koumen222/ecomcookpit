import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';
import { BarChart3, CalendarDays, Clock3, Lightbulb, MapPin, RefreshCw, Wallet } from 'lucide-react';

const LivreurEarningsPage = () => {
  const { user } = useEcomAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await ecomApi.get('/orders/livreur/stats');
      setStats(res.data?.data || null);
    } catch { setError('Erreur de chargement.'); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-amber-600 animate-spin" />
      <p className="text-sm text-gray-400">Chargement…</p>
    </div>
  );

  if (error) return (
    <div className="p-6 text-center">
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
    </div>
  );

  return (
    <div className="px-4 py-5 sm:p-8 max-w-[980px] mx-auto space-y-5 pb-28 lg:pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0F6B4F]">Revenus</p><h1 className="mt-1 text-2xl sm:text-3xl font-bold text-gray-950">Mes gains</h1>
          <p className="text-sm text-gray-400 mt-0.5">Récapitulatif de vos revenus</p>
        </div>
        <button onClick={loadStats} className="min-h-11 px-4 text-sm font-semibold bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition text-gray-700 flex items-center gap-2"><RefreshCw className="h-4 w-4"/>Actualiser</button>
      </div>

      {stats && (
        <>
          {/* Total cumulé */}
          <div className="relative overflow-hidden bg-[#073c2e] rounded-[28px] p-6 sm:p-8 text-white shadow-[0_20px_50px_-28px_rgba(7,60,46,.8)]">
            <Wallet className="absolute right-6 top-6 h-12 w-12 text-white/10"/>
            <p className="text-xs font-medium text-white/70 uppercase tracking-wider">Total cumulé</p>
            <p className="text-4xl font-black mt-2">{(stats.allTime?.amount || 0).toLocaleString('fr-FR')}</p>
            <p className="text-sm text-white/60 mt-1">FCFA</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-white/80">
              <span className="bg-white/20 px-2 py-1 rounded-lg">{stats.allTime?.delivered || 0} livraisons</span>
            </div>
          </div>

          {/* Aujourd'hui */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-[22px] p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider"><CalendarDays className="h-4 w-4"/>Aujourd'hui</p>
            </div>
            <p className="text-3xl font-black text-emerald-800">{(stats.today?.amount || 0).toLocaleString('fr-FR')}</p>
            <p className="text-xs text-emerald-700/60 mt-1">FCFA · {stats.today?.delivered || 0} livraison{(stats.today?.delivered || 0) !== 1 ? 's' : ''}</p>
          </div>

          {/* Détails par période */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ce mois */}
            <div className="bg-white rounded-[22px] border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ce mois</p>
                <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              </div>
              <p className="text-3xl font-black text-gray-900">{(stats.thisMonth?.amount || 0).toLocaleString('fr-FR')}</p>
              <p className="text-xs text-gray-400 mt-1">FCFA · {stats.thisMonth?.delivered || 0} livraison{(stats.thisMonth?.delivered || 0) !== 1 ? 's' : ''}</p>
            </div>

            {/* Cette semaine */}
            <div className="bg-white rounded-[22px] border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cette semaine</p>
                <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
              </div>
              <p className="text-3xl font-black text-gray-900">{(stats.thisWeek?.amount || 0).toLocaleString('fr-FR')}</p>
              <p className="text-xs text-gray-400 mt-1">FCFA · {stats.thisWeek?.delivered || 0} livraison{(stats.thisWeek?.delivered || 0) !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Dernières livraisons */}
          {(stats.recentDeliveries || []).length > 0 && (
            <div className="bg-white rounded-[24px] border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Clock3 className="h-5 w-5 text-[#0F6B4F]"/>Dernières livraisons</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {(stats.recentDeliveries || []).map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{d.clientName || 'Client'}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        {d.city || ''}{d.deliveryDistanceKm ? ` · ${d.deliveryDistanceKm} km` : ''}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-black text-primary-600">+{(d.deliveryCostFcfa || 0).toLocaleString('fr-FR')} FCFA</p>
                      <p className="text-[10px] text-gray-400">
                        {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statistiques */}
          <div className="bg-white rounded-[24px] border border-gray-200 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-4"><BarChart3 className="h-5 w-5 text-[#0F6B4F]"/>Statistiques</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total livrées', value: stats.allTime?.delivered || 0, color: 'text-primary-600' },
                { label: 'En cours', value: stats.inProgress || 0, color: 'text-indigo-600' },
                { label: 'Disponibles', value: stats.available || 0, color: 'text-amber-600' },
                { label: 'Mois en cours', value: stats.thisMonth?.delivered || 0, color: 'text-violet-600' },
              ].map((s, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-gray-50">
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Moyenne */}
          {stats.allTime?.delivered > 0 && (
            <div className="bg-white rounded-[24px] border border-gray-200 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3"><Lightbulb className="h-5 w-5 text-[#0F6B4F]"/>Revenu moyen par livraison</h2>
              <p className="text-3xl font-black text-[#0F6B4F]">
                {Math.round((stats.allTime?.amount || 0) / stats.allTime.delivered).toLocaleString('fr-FR')}
                <span className="text-sm font-medium text-gray-400 ml-1">FCFA</span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LivreurEarningsPage;
