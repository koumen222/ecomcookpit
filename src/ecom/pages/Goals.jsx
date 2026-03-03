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
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
        {/* Header moderne avec actions */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-20 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Objectifs</h1>
                    <p className="text-xs text-gray-500">Suivi de performance</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {goals.length} objectifs
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 rounded-full text-sm font-medium text-emerald-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {goals.filter(g => g.progress >= 100).length} atteints
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Sélecteur de période */}
                <div className="relative">
                  <select 
                    value={period.periodType} 
                    onChange={e => setPeriod({ ...period, periodType: e.target.value })} 
                    className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm"
                  >
                    <option value="daily">Aujourd'hui</option>
                    <option value="weekly">Cette semaine</option>
                    <option value="monthly">Ce mois</option>
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {/* Navigation période */}
                <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                  <button onClick={() => changePeriod(-1)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="px-3 py-1 border-l border-r border-gray-200">
                    <span className="text-sm font-semibold text-gray-700">
                      {period.periodType === 'daily' && new Date(period.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {period.periodType === 'weekly' && `S${period.week}`}
                      {period.periodType === 'monthly' && new Date(period.year, period.month - 1).toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                  </div>
                  <button onClick={() => changePeriod(1)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                {/* Bouton ajouter objectif */}
                {isAdmin && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg shadow-emerald-200/50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden sm:inline">Nouvel objectif</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* ── KPI Cards Modernes ────────── */}
        {goals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const revenueGoals = goals.filter(g => g.type === 'revenue');
              const totalCurrent = revenueGoals.reduce((sum, g) => sum + g.currentValue, 0);
              const totalTarget = revenueGoals.reduce((sum, g) => sum + g.targetValue, 0);
              const avgProgress = revenueGoals.length > 0 ? revenueGoals.reduce((sum, g) => sum + g.progress, 0) / revenueGoals.length : 0;
              return revenueGoals.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-white font-bold text-lg">{avgProgress.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-600 mb-1">Chiffre d'Affaires</h3>
                    <p className="text-2xl font-bold text-gray-900">{fmt(totalCurrent)}</p>
                    <p className="text-xs text-gray-500 mb-3">Objectif: {fmt(totalTarget)}</p>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(avgProgress, 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {(() => {
              const ordersGoals = goals.filter(g => g.type === 'orders');
              const totalTarget = ordersGoals.reduce((sum, g) => sum + g.targetValue, 0);
              const progress = totalTarget > 0 ? (globalOrdersCount / totalTarget) * 100 : 0;
              return ordersGoals.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 11-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </div>
                      <span className="text-white font-bold text-lg">{progress.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-600 mb-1">Commandes</h3>
                    <p className="text-2xl font-bold text-gray-900">{globalOrdersCount}</p>
                    <p className="text-xs text-gray-500 mb-3">Objectif: {totalTarget}</p>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {(() => {
              const deliveryGoals = goals.filter(g => g.type === 'delivery_rate');
              const avgCurrent = deliveryGoals.length > 0 ? deliveryGoals.reduce((sum, g) => sum + g.currentValue, 0) / deliveryGoals.length : 0;
              const avgTarget = deliveryGoals.length > 0 ? deliveryGoals.reduce((sum, g) => sum + g.targetValue, 0) / deliveryGoals.length : 0;
              const avgProgress = deliveryGoals.length > 0 ? deliveryGoals.reduce((sum, g) => sum + g.progress, 0) / deliveryGoals.length : 0;
              return deliveryGoals.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-white font-bold text-lg">{avgProgress.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-600 mb-1">Taux de Livraison</h3>
                    <p className="text-2xl font-bold text-gray-900">{avgCurrent.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mb-3">Objectif: {avgTarget.toFixed(1)}%</p>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(avgProgress, 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <div className="bg-white rounded-2xl border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-white font-bold text-lg">
                    {((goals.filter(g => g.progress >= 100).length / goals.length) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Objectifs Atteints</h3>
                <p className="text-2xl font-bold text-gray-900">{goals.filter(g => g.progress >= 100).length}</p>
                <p className="text-xs text-gray-500 mb-3">sur {goals.length} objectifs</p>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500" style={{ width: `${(goals.filter(g => g.progress >= 100).length / goals.length) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

                  
      {/* ── Liste des objectifs ────────── */}
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
                    <div key={productKey} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                      {/* En-tête du produit */}
                      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-200 shadow-sm flex-shrink-0">
                              {productData.product ? (
                                <span className="text-lg">📦</span>
                              ) : (
                                <span className="text-lg">🎯</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-gray-900 text-base truncate">
                                {productData.product || 'Tous les produits'}
                              </h3>
                              <p className="text-xs text-gray-600 font-medium">
                                {productData.goals.length} objectif{productData.goals.length > 1 ? 's' : ''} · {periodLabels[period.periodType]?.toLowerCase() || 'hebdomadaire'}
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
                            <div key={goal._id} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                              {/* Header compact */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 min-w-0">
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
                              <div className="grid grid-cols-2 gap-1.5 mb-2">
                                <div className="bg-white rounded-md p-1.5 border border-gray-100">
                                  <p className="text-[8px] font-medium text-gray-500">Actuel</p>
                                  <p className="text-sm font-bold text-gray-900 truncate">
                                    {isRevenue ? fmt(goal.currentValue) : isRate ? `${goal.currentValue.toFixed(1)}%` : goal.currentValue}
                                  </p>
                                </div>
                                <div className="bg-white rounded-md p-1.5 border border-gray-100">
                                  <p className="text-[8px] font-medium text-gray-500">Cible</p>
                                  <p className="text-sm font-bold text-gray-900 truncate">
                                    {isRevenue ? fmt(goal.targetValue) : isRate ? `${goal.targetValue.toFixed(1)}%` : goal.targetValue}
                                  </p>
                                </div>
                              </div>

                              {/* Livraisons — compact */}
                              {goal.deliveryCount && (
                                <div className="bg-emerald-50 rounded-md p-1.5 border border-emerald-200 mb-2">
                                  <div className="grid grid-cols-3 gap-1 text-center">
                                    <div>
                                      <p className="text-[8px] text-emerald-600 font-medium">Faites</p>
                                      <p className="text-sm font-bold text-emerald-700">{goal.currentDeliveries || 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-[8px] text-emerald-600 font-medium">Objectif</p>
                                      <p className="text-sm font-bold text-emerald-700">{goal.deliveryCount}</p>
                                    </div>
                                    <div>
                                      <p className="text-[8px] text-emerald-600 font-medium">Reste</p>
                                      <p className="text-sm font-bold text-emerald-700">{Math.max(0, goal.deliveryCount - (goal.currentDeliveries || 0))}</p>
                                    </div>
                                    <p className="text-[10px] text-emerald-600 mt-1 text-center">
                                      {((goal.currentDeliveries || 0) / goal.deliveryCount * 100).toFixed(0)}% livré
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Barre de progression principale */}
                              <div className="w-full bg-gray-50 rounded-full h-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${goal.progress >= 100 ? 'bg-emerald-400' : 'bg-emerald-300'}`}
                                  style={{ width: `${Math.min(goal.progress, 100)}%` }}
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

      {/* Popup Modal Moderne */}
      {isAdmin && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header du modal */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Créer un objectif</h2>
                    <p className="text-emerald-100 text-sm">Fixez vos buts de performance</p>
                  </div>
                </div>
                <button onClick={() => setShowForm(false)} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors backdrop-blur-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Contenu scrollable */}
            <div className="max-h-[60vh] overflow-y-auto">
              <form id="goal-form" onSubmit={(e) => { handleAddGoal(e); setShowForm(false); }} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Période
                  </label>
                  <select value={newGoal.periodType} onChange={e => setNewSource({ ...newGoal, periodType: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all">
                    <option value="daily">Journalier</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuel</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Type d'objectif
                  </label>
                  <select value={newGoal.type} onChange={e => setNewSource({ ...newGoal, type: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all">
                    {goalTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              
              {newGoal.type === 'revenue' && (
                <>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Produit
                    </label>
                    <select value={newGoal.product} onChange={e => handleProductChange(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all">
                      <option value="">Sélectionner un produit</option>
                      {products.map(p => (
                        <option key={p._id} value={p.name}>
                          {p.name} - {fmt(p.sellingPrice)} par unité
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 11-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      Nombre de livraisons
                    </label>
                    <input 
                      type="number" 
                      placeholder="Ex: 50" 
                      value={newGoal.deliveryCount} 
                      onChange={e => handleDeliveryCountChange(e.target.value)} 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
                    />
                    {newGoal.deliveryCount && newGoal.product && (
                      <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <p className="text-xs font-medium text-emerald-700">
                          💡 Calcul automatique: {newGoal.deliveryCount} × {fmt(products.find(p => p.name === newGoal.product)?.sellingPrice || 0)} = {fmt(newGoal.targetValue)}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Valeur cible {newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product && '(calculé automatiquement)'}
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    placeholder={newGoal.type === 'revenue' ? "0 ou calculer" : "0"} 
                    value={newGoal.targetValue} 
                    onChange={e => setNewSource({ ...newGoal, targetValue: e.target.value })} 
                    disabled={newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product} 
                    className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all ${newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : ''}`} 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">{goalTypes.find(t => t.value === newGoal.type)?.unit}</div>
                </div>
                {newGoal.type === 'revenue' && !newGoal.product && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Sélectionnez un produit pour calculer automatiquement
                  </p>
                )}
              </div>
              </form>
            </div>
            
            {/* Footer fixe avec boutons */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-4">
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                  Annuler
                </button>
                <button 
                  type="submit" 
                  form="goal-form"
                  disabled={saving || !newGoal.targetValue} 
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg shadow-emerald-200/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Enregistrement...
                    </span>
                  ) : (
                    'Créer l\'objectif'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Goals;
