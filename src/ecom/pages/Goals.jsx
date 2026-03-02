import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney';
import ecomApi from '../services/ecommApi';

// Helper pour obtenir le numéro de semaine ISO-8601
const getWeekNumber = (d) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
};

// Helper pour naviguer entre les semaines
const addWeeks = (year, week, delta) => {
  // Créer une date au milieu de la semaine demandée
  const d = new Date(year, 0, 1 + (week - 1) * 7 + 3);
  d.setDate(d.getDate() + delta * 7);
  return {
    year: d.getFullYear(),
    week: getWeekNumber(d)
  };
};

const Goals = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const isAdmin = user?.role === 'ecom_admin' || user?.role === 'super_admin';
  const isCloseuse = user?.role === 'ecom_closeuse';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [goals, setGoals] = useState([]);
  const [products, setProducts] = useState([]);
  const [closeuses, setCloseuses] = useState([]);
  const [currentStats, setCurrentStats] = useState({});
  const [globalOrdersCount, setGlobalOrdersCount] = useState(0);
  const [period, setPeriod] = useState({
    periodType: 'weekly',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    week: getWeekNumber(new Date()),
    day: new Date().toISOString().split('T')[0]
  });

  const [newGoal, setNewSource] = useState({
    type: 'revenue',
    targetValue: '',
    product: '',
    periodType: 'weekly',
    deliveryCount: '',
    closeuseId: ''
  });

  const fetchCloseuses = async () => {
    try {
      const res = await ecomApi.get('/users?role=ecom_closeuse&isActive=true');
      if (res.data.success) {
        setCloseuses(res.data.data.users || []);
      }
    } catch (error) {
      console.error('Erreur chargement closeuses:', error);
    }
  };

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const [goalsRes, productsRes] = await Promise.all([
        ecomApi.get('/goals', {
          params: {
            periodType: period.periodType,
            year: period.year,
            month: period.month,
            week: period.week,
            day: period.day
          }
        }),
        ecomApi.get('/products')
      ]);

      if (goalsRes.data.success) {
        setGoals(goalsRes.data.data.goals);
      }
      if (productsRes.data.success) {
        setProducts(productsRes.data.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement objectifs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeForPeriod = () => {
    if (period.periodType === 'daily') {
      return { date: period.day };
    }

    if (period.periodType === 'monthly') {
      const startDate = new Date(period.year, period.month - 1, 1);
      const endDate = new Date(period.year, period.month, 0);
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
    }

    const jan4 = new Date(Date.UTC(period.year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const isoWeek1Monday = new Date(jan4);
    isoWeek1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

    const start = new Date(isoWeek1Monday);
    start.setUTCDate(isoWeek1Monday.getUTCDate() + (period.week - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    return {
      startDate: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())).toISOString().split('T')[0],
      endDate: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())).toISOString().split('T')[0]
    };
  };

  const fetchGlobalOrdersCount = async () => {
    try {
      const params = getDateRangeForPeriod();
      const res = await ecomApi.get('/reports/overview', { params });
      const kpis = res.data?.data?.kpis || {};
      setGlobalOrdersCount(kpis.totalOrdersDelivered || 0);
    } catch (error) {
      setGlobalOrdersCount(0);
    }
  };

  useEffect(() => {
    fetchGoals();
    fetchGlobalOrdersCount();
  }, [period]);

  useEffect(() => {
    if (isAdmin) fetchCloseuses();
  }, [isAdmin]);

  // Fonction pour calculer automatiquement le CA cible
  const calculateRevenueTarget = (deliveryCount, productPrice) => {
    if (!deliveryCount || !productPrice) return '';
    const count = parseInt(deliveryCount);
    const price = parseInt(productPrice);
    return (count * price).toString();
  };

  // Mettre à jour automatiquement le targetValue quand deliveryCount ou produit change
  const handleDeliveryCountChange = (value) => {
    setNewSource({
      ...newGoal,
      deliveryCount: value,
      targetValue: newGoal.type === 'revenue' && value && newGoal.product
        ? calculateRevenueTarget(value, products.find(p => p.name === newGoal.product)?.sellingPrice || 0)
        : newGoal.targetValue
    });
  };

  const handleProductChange = (productName) => {
    setNewSource({
      ...newGoal,
      product: productName,
      targetValue: newGoal.type === 'revenue' && newGoal.deliveryCount && productName
        ? calculateRevenueTarget(newGoal.deliveryCount, products.find(p => p.name === productName)?.sellingPrice || 0)
        : newGoal.targetValue
    });
  };

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!newGoal.targetValue) return;
    try {
      setSaving(true);
      const res = await ecomApi.post('/goals', {
        ...newGoal,
        year: period.year,
        month: period.month,
        weekNumber: period.week,
        day: period.day
      });
      if (res.data.success) {
        setNewSource({ type: 'revenue', targetValue: '', product: '', periodType: period.periodType, closeuseId: '' });

        // Afficher une notification si l'objectif a été divisé automatiquement
        if (res.data.data.autoDivided) {
          const { weekly, daily } = res.data.data.autoDivided;
          alert(`✅ Objectif mensuel enregistré!\n\n🔄 Division automatique effectuée:\n• ${weekly} objectif${weekly > 1 ? 's' : ''} hebdomadaire${weekly > 1 ? 's' : ''}\n• ${daily} objectif${daily > 1 ? 's' : ''} quotidien${daily > 1 ? 's' : ''}\n\nVous pouvez maintenant suivre votre progression jour par jour et semaine par semaine.`);
        }

        await fetchGoals();
      }
    } catch (error) {
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const changePeriod = (delta) => {
    if (period.periodType === 'daily') {
      const d = new Date(period.day);
      d.setDate(d.getDate() + delta);
      setPeriod({ ...period, day: d.toISOString().split('T')[0] });
    } else if (period.periodType === 'monthly') {
      let m = period.month + delta;
      let y = period.year;
      if (m > 12) { m = 1; y++; }
      if (m < 1) { m = 12; y--; }
      setPeriod({ ...period, month: m, year: y });
    } else {
      setPeriod(prev => {
        const next = addWeeks(prev.year, prev.week, delta);
        return { ...prev, ...next };
      });
    }
  };

  const periodLabels = {
    daily: 'Journalier',
    weekly: 'Hebdomadaire',
    monthly: 'Mensuel'
  };

  const goalTypes = [
    { value: 'revenue', label: 'Chiffre d\'affaires (Livré)', unit: 'XAF' },
    { value: 'orders', label: 'Nombre de commandes', unit: 'Cmds' },
    { value: 'delivery_rate', label: 'Taux de livraison', unit: '%' },
  ];

  if (loading && !goals.length) return (
    <div className="p-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-3" />
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-3 py-4 sm:p-6 max-w-6xl mx-auto">

      {/* ── Header mobile-first ─────────────────────────── */}
      {isCloseuse && (
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">👋 Bonjour {user?.name || ''}</h2>
          <p className="text-xs text-gray-500">Vos performances {periodLabels[period.periodType]?.toLowerCase() || 'hebdomadaire'}s</p>
          {goals.some(g => g.progress >= 100) && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">🏆 Dépassé</span>
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">🔥 En feu</span>
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">📈 Positif</span>
            </div>
          )}
        </div>
      )}

      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 truncate">
              {isCloseuse ? '🎯 Mes Objectifs' : 'Objectifs'}
            </h1>
            <p className="text-[11px] sm:text-sm text-gray-500 mt-0.5 truncate">
              {isCloseuse ? 'Performances personnelles' : 'Fixez et suivez vos buts'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="sm:hidden flex-shrink-0 w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 active:scale-95 transition-transform"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            </button>
          )}
        </div>

        {/* Sélecteur de période — scroll horizontal sur mobile */}
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-xl p-0.5 shadow-sm flex-shrink-0">
            {['daily', 'weekly', 'monthly'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod({ ...period, periodType: p })}
                className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all ${period.periodType === p ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {period.periodType === p ? periodLabels[p] : periodLabels[p].slice(0, 4) + '.'}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 min-w-0">
            <button onClick={() => changePeriod(-1)} className="p-2 hover:bg-gray-50 text-gray-500 active:bg-gray-100 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex-1 text-center px-1 py-1.5 text-xs sm:text-sm font-semibold text-gray-700 truncate">
              {period.periodType === 'daily' && new Date(period.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              {period.periodType === 'weekly' && `S${period.week} · ${period.year}`}
              {period.periodType === 'monthly' && new Date(period.year, period.month - 1).toLocaleString('fr-FR', { month: 'short', year: 'numeric' })}
            </div>
            <button onClick={() => changePeriod(1)} className="p-2 hover:bg-gray-50 text-gray-500 active:bg-gray-100 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Résumé des Objectifs — mobile-first ────────── */}
      {goals.length > 0 && (
        <div className="mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
          <h2 className="text-xs sm:text-sm font-bold text-gray-800 mb-3 sm:mb-4">
            {isCloseuse ? 'Résumé de mes performances' : 'Résumé des Objectifs'}
          </h2>

          {/* Cartes KPI — scroll horizontal sur mobile */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
            {/* CA */}
            {(() => {
              const revenueGoals = goals.filter(g => g.type === 'revenue');
              const totalTarget = revenueGoals.reduce((sum, g) => sum + g.targetValue, 0);
              const totalCurrent = revenueGoals.reduce((sum, g) => sum + g.currentValue, 0);
              const avgProgress = revenueGoals.length > 0 ? revenueGoals.reduce((sum, g) => sum + g.progress, 0) / revenueGoals.length : 0;
              return revenueGoals.length > 0 && (
                <div className={`snap-start flex-shrink-0 w-[75vw] sm:w-auto rounded-xl p-3 sm:p-4 border transition-all ${avgProgress >= 100 ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-600 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">CA</p>
                    <span className={`ml-auto text-[10px] sm:text-xs font-bold ${avgProgress >= 100 ? 'text-emerald-600' : 'text-emerald-600'}`}>{avgProgress.toFixed(0)}%</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 truncate">{fmt(totalCurrent)}</p>
                  <p className="text-[10px] text-gray-400 truncate">sur {fmt(totalTarget)}</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${avgProgress >= 100 ? 'bg-emerald-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(avgProgress, 100)}%` }}></div>
                  </div>
                </div>
              );
            })()}

            {/* Commandes */}
            {(() => {
              const ordersGoals = goals.filter(g => g.type === 'orders');
              const totalTarget = ordersGoals.reduce((sum, g) => sum + g.targetValue, 0);
              const realProgress = totalTarget > 0 ? (globalOrdersCount / totalTarget) * 100 : 0;
              return ordersGoals.length > 0 && (
                <div className="snap-start flex-shrink-0 w-[75vw] sm:w-auto bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-600 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 11-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">Commandes</p>
                    <span className={`ml-auto text-[10px] sm:text-xs font-bold ${realProgress >= 100 ? 'text-emerald-600' : 'text-emerald-600'}`}>{realProgress.toFixed(0)}%</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-gray-900">{globalOrdersCount}</p>
                  <p className="text-[10px] text-gray-400">sur {totalTarget}</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${realProgress >= 100 ? 'bg-emerald-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(realProgress, 100)}%` }}></div>
                  </div>
                </div>
              );
            })()}

            {/* Taux de Livraison */}
            {(() => {
              const deliveryGoals = goals.filter(g => g.type === 'delivery_rate');
              const avgProgress = deliveryGoals.length > 0 ? deliveryGoals.reduce((sum, g) => sum + g.progress, 0) / deliveryGoals.length : 0;
              const avgCurrent = deliveryGoals.length > 0 ? deliveryGoals.reduce((sum, g) => sum + g.currentValue, 0) / deliveryGoals.length : 0;
              return deliveryGoals.length > 0 && (
                <div className="snap-start flex-shrink-0 w-[75vw] sm:w-auto bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-700 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">Livraison</p>
                    <span className={`ml-auto text-[10px] sm:text-xs font-bold ${avgProgress >= 100 ? 'text-emerald-600' : 'text-emerald-700'}`}>{avgProgress.toFixed(0)}%</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-gray-900">{avgCurrent.toFixed(1)}%</p>
                  <p className="text-[10px] text-gray-400">Moyenne objectifs</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${avgProgress >= 100 ? 'bg-emerald-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(avgProgress, 100)}%` }}></div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Stats globales compactes */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              {isCloseuse ? (
                <>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">🎯 Assignés</p>
                    <p className="text-base font-black text-gray-900">{goals.length}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">✅ Atteints</p>
                    <p className="text-base font-black text-emerald-600">{goals.filter(g => g.progress >= 100).length}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">📦 Validées</p>
                    <p className="text-base font-black text-emerald-600">
                      {goals.filter(g => g.type === 'orders').reduce((acc, g) => acc + (g.currentDeliveries || g.currentValue || 0), 0) ||
                        goals.filter(g => g.type === 'revenue').reduce((acc, g) => acc + (g.currentDeliveries || 0), 0)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">💰 Commission</p>
                    <p className="text-sm font-black text-amber-600 truncate">
                      {fmt(
                        (goals.filter(g => g.type === 'orders').reduce((acc, g) => acc + (g.currentDeliveries || g.currentValue || 0), 0) ||
                          goals.filter(g => g.type === 'revenue').reduce((acc, g) => acc + (g.currentDeliveries || 0), 0)) * 1000
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Total</p>
                    <p className="text-base font-black text-gray-900">{goals.length}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Atteints</p>
                    <p className="text-base font-black text-emerald-600">{goals.filter(g => g.progress >= 100).length}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">En cours</p>
                    <p className="text-base font-black text-emerald-600">{goals.filter(g => g.progress < 100).length}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Moyenne</p>
                    <p className="text-base font-black text-gray-900">
                      {(goals.reduce((sum, g) => sum + g.progress, 0) / (goals.length || 1)).toFixed(0)}%
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Formulaire Admin — bottom sheet mobile / sidebar desktop ── */}
      {isAdmin && showForm && (
        <div className="fixed inset-0 z-50 sm:hidden" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h2 className="text-sm font-bold text-gray-800 mb-4">Fixer un objectif</h2>
            <form onSubmit={(e) => { handleAddGoal(e); setShowForm(false); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Période</label>
                  <select value={newGoal.periodType} onChange={e => setNewSource({ ...newGoal, periodType: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    <option value="daily">Jour</option>
                    <option value="weekly">Semaine</option>
                    <option value="monthly">Mois</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Type</label>
                  <select value={newGoal.type} onChange={e => setNewSource({ ...newGoal, type: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    {goalTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              {newGoal.type === 'revenue' && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Nb livraisons</label>
                  <input type="number" placeholder="Ex: 50" value={newGoal.deliveryCount} onChange={e => handleDeliveryCountChange(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Produit</label>
                <select value={newGoal.product} onChange={e => handleProductChange(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                  <option value="">Tous les produits</option>
                  {products.map(p => <option key={p._id} value={p.name}>{p.name} ({fmt(p.sellingPrice)})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Closeuse</label>
                <select value={newGoal.closeuseId} onChange={e => setNewSource({ ...newGoal, closeuseId: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                  <option value="">Global</option>
                  {closeuses.map(c => <option key={c._id} value={c._id}>{c.name || c.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Valeur cible {newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product && '(auto)'}</label>
                <div className="relative">
                  <input type="number" placeholder="0" value={newGoal.targetValue} onChange={e => setNewSource({ ...newGoal, targetValue: e.target.value })} disabled={newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product} className={`w-full pl-3 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm ${newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product ? 'bg-emerald-50 border-emerald-400' : ''}`} />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{goalTypes.find(t => t.value === newGoal.type)?.unit}</div>
                </div>
                {newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product && (
                  <p className="text-[10px] text-emerald-600 mt-1 font-semibold">💡 {newGoal.deliveryCount} × {fmt(products.find(p => p.name === newGoal.product)?.sellingPrice || 0)} = {fmt(newGoal.targetValue)}</p>
                )}
              </div>
              <button type="submit" disabled={saving || !newGoal.targetValue} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        {/* Formulaire desktop — hidden on mobile (bottom sheet above) */}
        {isAdmin && (
          <div className="hidden sm:block lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-6">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Fixer un objectif</h2>
              <form onSubmit={handleAddGoal} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Période</label>
                  <select value={newGoal.periodType} onChange={e => setNewSource({ ...newGoal, periodType: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm">
                    <option value="daily">Journalier</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Type</label>
                  <select value={newGoal.type} onChange={e => setNewSource({ ...newGoal, type: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm">
                    {goalTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {newGoal.type === 'revenue' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Nombre de livraisons</label>
                    <input type="number" placeholder="Ex: 50" value={newGoal.deliveryCount} onChange={e => handleDeliveryCountChange(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm" />
                    <p className="text-[10px] text-gray-400 mt-1">CA calculé automatiquement</p>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Produit (Optionnel)</label>
                  <select value={newGoal.product} onChange={e => handleProductChange(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm">
                    <option value="">Tous les produits</option>
                    {products.map(p => <option key={p._id} value={p.name}>{p.name} ({fmt(p.sellingPrice)})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Closeuse (Optionnel)</label>
                  <select value={newGoal.closeuseId} onChange={e => setNewSource({ ...newGoal, closeuseId: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm">
                    <option value="">Tous (Objectif global)</option>
                    {closeuses.map(c => <option key={c._id} value={c._id}>{c.name || c.email}</option>)}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Si défini, visible uniquement par cette closeuse.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Valeur cible {newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product && '(calculé)'}
                  </label>
                  <div className="relative">
                    <input type="number" placeholder={newGoal.type === 'revenue' ? "0 ou calculer" : "0"} value={newGoal.targetValue} onChange={e => setNewSource({ ...newGoal, targetValue: e.target.value })} disabled={newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product} className={`w-full pl-3 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm ${newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product ? 'bg-emerald-50 border-emerald-400' : ''}`} />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{goalTypes.find(t => t.value === newGoal.type)?.unit}</div>
                  </div>
                  {newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product && (
                    <p className="text-[10px] text-emerald-600 mt-1 font-semibold">💡 {newGoal.deliveryCount} × {fmt(products.find(p => p.name === newGoal.product)?.sellingPrice || 0)} = {fmt(newGoal.targetValue)}</p>
                  )}
                </div>
                <button type="submit" disabled={saving || !newGoal.targetValue} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Enregistrer l\'objectif'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Liste des Objectifs — mobile-first ──────────── */}
        <div className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {goals.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 sm:p-12 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="text-sm font-bold text-gray-900">Aucun objectif défini</h3>
              <p className="text-xs text-gray-500 mt-1">Commencez par fixer vos buts.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Grouper les objectifs par produit */}
              {(() => {
                // Regrouper les objectifs par produit
                const goalsByProduct = goals.reduce((acc, goal) => {
                  const productKey = goal.product || 'global';
                  if (!acc[productKey]) {
                    acc[productKey] = {
                      product: goal.product,
                      goals: [],
                      summary: {
                        revenue: { target: 0, current: 0, count: 0, deliveries: 0, currentDeliveries: 0 },
                        orders: { target: 0, current: 0, count: 0, deliveries: 0, currentDeliveries: 0 },
                        delivery_rate: { target: 0, current: 0, count: 0, deliveries: 0, currentDeliveries: 0 }
                      }
                    };
                  }

                  acc[productKey].goals.push(goal);

                  // Mettre à jour le résumé
                  if (goal.type === 'revenue') {
                    acc[productKey].summary.revenue.target += goal.targetValue;
                    acc[productKey].summary.revenue.current += goal.currentValue;
                    acc[productKey].summary.revenue.count++;
                    if (goal.deliveryCount) acc[productKey].summary.revenue.deliveries += goal.deliveryCount;
                    if (goal.currentDeliveries) acc[productKey].summary.revenue.currentDeliveries += goal.currentDeliveries;
                  } else if (goal.type === 'orders') {
                    acc[productKey].summary.orders.target += goal.targetValue;
                    acc[productKey].summary.orders.current += goal.currentValue;
                    acc[productKey].summary.orders.count++;
                    if (goal.deliveryCount) acc[productKey].summary.orders.deliveries += goal.deliveryCount;
                    if (goal.currentDeliveries) acc[productKey].summary.orders.currentDeliveries += goal.currentDeliveries;
                  } else if (goal.type === 'delivery_rate') {
                    acc[productKey].summary.delivery_rate.target += goal.targetValue;
                    acc[productKey].summary.delivery_rate.current += goal.currentValue;
                    acc[productKey].summary.delivery_rate.count++;
                    if (goal.deliveryCount) acc[productKey].summary.delivery_rate.deliveries += goal.deliveryCount;
                    if (goal.currentDeliveries) acc[productKey].summary.delivery_rate.currentDeliveries += goal.currentDeliveries;
                  }

                  return acc;
                }, {});

                return Object.entries(goalsByProduct).map(([productKey, productData]) => {
                  const hasRevenue = productData.summary.revenue.count > 0;
                  const hasOrders = productData.summary.orders.count > 0;
                  const hasDelivery = productData.summary.delivery_rate.count > 0;

                  return (
                    <div key={productKey} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      {/* En-tête du produit */}
                      <div className="bg-gray-50 p-3 sm:p-4 border-b border-gray-100">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100 flex-shrink-0">
                              {productData.product ? (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                                {productData.product || 'Tous les produits'}
                              </h3>
                              <p className="text-[10px] sm:text-xs text-gray-400">
                                {productData.goals.length} obj. {periodLabels[period.periodType]?.toLowerCase()?.slice(0, 5) || 'hebdo'}.
                              </p>
                            </div>
                          </div>

                          {/* Mini résumé du produit */}
                          <div className="flex gap-2 sm:gap-4 text-center flex-shrink-0">
                            {hasRevenue && (
                              <div>
                                <p className="text-[10px] sm:text-xs text-gray-400 uppercase font-semibold">CA</p>
                                <p className="text-xs sm:text-sm font-black text-emerald-600 truncate max-w-[80px] sm:max-w-none">
                                  {fmt(productData.summary.revenue.current)}
                                </p>
                                {productData.summary.revenue.deliveries > 0 && (
                                  <p className="text-[10px] text-emerald-500">
                                    {productData.summary.revenue.currentDeliveries || 0}/{productData.summary.revenue.deliveries}
                                  </p>
                                )}
                              </div>
                            )}
                            {hasOrders && (
                              <div>
                                <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-bold">Cmds</p>
                                <p className="text-xs sm:text-sm font-black text-emerald-600">
                                  {productData.summary.orders.current}
                                </p>
                                {productData.summary.orders.deliveries > 0 && (
                                  <p className="text-[10px] text-emerald-600">
                                    {productData.summary.orders.currentDeliveries || 0}/{productData.summary.orders.deliveries}
                                  </p>
                                )}
                              </div>
                            )}
                            {hasDelivery && (
                              <div className="hidden sm:block">
                                <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-bold">Livr.</p>
                                <p className="text-xs sm:text-sm font-black text-emerald-700">
                                  {productData.summary.delivery_rate.count > 0
                                    ? (productData.summary.delivery_rate.current / productData.summary.delivery_rate.count).toFixed(1) + '%'
                                    : '0%'
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Liste des objectifs du produit */}
                      <div className="p-3 sm:p-4 space-y-3">
                        {productData.goals.map(goal => {
                          const typeInfo = goalTypes.find(t => t.value === goal.type);
                          const isRevenue = goal.type === 'revenue';
                          const isRate = goal.type === 'delivery_rate';
                          const progress = Math.min(goal.progress, 100);

                          return (
                            <div key={goal._id} className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
                              {/* Header compact */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isRevenue ? 'bg-emerald-50 text-emerald-600' :
                                    isRate ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-50 text-emerald-600'
                                    }`}>
                                    {isRevenue ? (
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    ) : isRate ? (
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 11-8 0v4M5 9h14l1 12H4L5 9z" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                                      {isCloseuse && typeInfo?.value === 'revenue' ? "Mon CA" : typeInfo?.label}
                                    </h4>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter truncate">
                                      {isCloseuse ? "Mon objectif" : "Objectif"} {periodLabels[goal.periodType]?.toLowerCase() || 'hebdomadaire'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className={`text-xs sm:text-sm font-black ${goal.progress >= 100 ? 'text-emerald-600' : 'text-emerald-600'}`}>
                                    {goal.progress.toFixed(1)}%
                                  </span>
                                  {isAdmin && (
                                    <button onClick={async () => {
                                      if (!window.confirm('Supprimer cet objectif ?')) return;
                                      try {
                                        await ecomApi.delete(`/goals/${goal._id}`);
                                        fetchGoals();
                                      } catch (error) {
                                        alert('Erreur suppression');
                                      }
                                    }} className="p-1 text-gray-300 hover:text-red-500 active:text-red-600 transition-colors">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Actuel / Cible — compact */}
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="bg-white rounded-lg p-2.5 border border-gray-100">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Actuel</p>
                                  <p className="text-base sm:text-lg font-black text-gray-900 truncate">
                                    {isRevenue ? fmt(goal.currentValue) : isRate ? `${goal.currentValue.toFixed(1)}%` : goal.currentValue}
                                  </p>
                                </div>
                                <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-100">
                                  <p className="text-[10px] font-bold text-emerald-500 uppercase mb-0.5">
                                    {isCloseuse ? 'Mon Obj.' : 'Cible'}
                                  </p>
                                  <p className="text-base sm:text-lg font-black text-emerald-600 truncate">
                                    {isRevenue ? fmt(goal.targetValue) : isRate ? `${goal.targetValue}%` : goal.targetValue}
                                  </p>
                                </div>
                              </div>

                              {/* Livraisons — compact */}
                              {goal.deliveryCount && (
                                <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200 mb-3">
                                  <div className="grid grid-cols-3 gap-1 text-center">
                                    <div>
                                      <p className="text-[10px] text-emerald-600 uppercase font-bold">Faites</p>
                                      <p className="text-base font-black text-emerald-700">{goal.currentDeliveries || 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-gray-500 uppercase font-bold">Prévues</p>
                                      <p className="text-base font-black text-gray-700">{goal.deliveryCount}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-emerald-600 uppercase font-bold">Reste</p>
                                      <p className="text-base font-black text-emerald-700">
                                        {Math.max(0, goal.deliveryCount - (goal.currentDeliveries || 0))}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-2">
                                    <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 transition-all duration-1000"
                                        style={{ width: `${Math.min(100, ((goal.currentDeliveries || 0) / goal.deliveryCount) * 100)}%` }}
                                      ></div>
                                    </div>
                                    <p className="text-[10px] text-emerald-600 mt-1 text-center">
                                      {((goal.currentDeliveries || 0) / goal.deliveryCount * 100).toFixed(0)}% livré
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Barre de progression principale */}
                              <div className="w-full bg-gray-100 rounded-full h-1.5 sm:h-2 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-1000 ${goal.progress >= 100 ? 'bg-emerald-500' : 'bg-emerald-600'}`}
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default Goals;
