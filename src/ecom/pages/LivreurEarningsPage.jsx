import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

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
    <div className="p-3 sm:p-6 max-w-[900px] mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">💰 Mes gains</h1>
          <p className="text-sm text-gray-400 mt-0.5">Récapitulatif de vos revenus</p>
        </div>
        <button onClick={loadStats} className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition text-gray-600">↻ Actualiser</button>
      </div>

      {stats && (
        <>
          {/* Total cumulé */}
          <div className="bg-gradient-to-br from-[#0F6B4F] to-[#0a5740] rounded-2xl p-6 text-white shadow-lg">
            <p className="text-xs font-medium text-white/70 uppercase tracking-wider">Total cumulé</p>
            <p className="text-4xl font-black mt-2">{(stats.allTime?.amount || 0).toLocaleString('fr-FR')}</p>
            <p className="text-sm text-white/60 mt-1">FCFA</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-white/80">
              <span className="bg-white/20 px-2 py-1 rounded-lg">{stats.allTime?.delivered || 0} livraisons</span>
            </div>
          </div>

          {/* Détails par période */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ce mois */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ce mois</p>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              </div>
              <p className="text-3xl font-black text-gray-900">{(stats.thisMonth?.amount || 0).toLocaleString('fr-FR')}</p>
              <p className="text-xs text-gray-400 mt-1">FCFA · {stats.thisMonth?.delivered || 0} livraison{(stats.thisMonth?.delivered || 0) !== 1 ? 's' : ''}</p>
            </div>

            {/* Cette semaine */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
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

          {/* Statistiques */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">📊 Statistiques</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total livrées', value: stats.allTime?.delivered || 0, color: 'text-emerald-600' },
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">💡 Revenu moyen par livraison</h2>
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
