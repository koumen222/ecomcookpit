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
    periodType: 'monthly',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    week: getWeekNumber(new Date()),
    day: new Date().toISOString().split('T')[0]
  });

  const [newGoal, setNewSource] = useState({
    type: 'revenue',
    targetValue: '',
    product: '',
    periodType: 'monthly',
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
    <div className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="h-7 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Objectifs</h1>
                <p className="text-sm text-gray-500">{goals.length} objectif{goals.length !== 1 ? 's' : ''} · {goals.filter(g => g.progress >= 100).length} atteint{goals.filter(g => g.progress >= 100).length !== 1 ? 's' : ''}</p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={period.periodType}
                  onChange={e => setPeriod({ ...period, periodType: e.target.value })}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                >
                  <option value="daily">Jour</option>
                  <option value="weekly">Semaine</option>
                  <option value="monthly">Mois</option>
                </select>

                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button onClick={() => changePeriod(-1)} className="px-2.5 py-2 hover:bg-gray-50 transition-colors border-r border-gray-200">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="px-3 py-2 text-sm font-medium text-gray-700 min-w-[60px] text-center">
                    {period.periodType === 'daily' && new Date(period.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    {period.periodType === 'weekly' && `S${period.week}`}
                    {period.periodType === 'monthly' && new Date(period.year, period.month - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
                  </span>
                  <button onClick={() => changePeriod(1)} className="px-2.5 py-2 hover:bg-gray-50 transition-colors border-l border-gray-200">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-scalor-green text-white text-sm font-medium rounded-lg hover:bg-scalor-green-dark transition-colors"
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

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* KPI Cards */}
          {goals.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const revenueGoals = goals.filter(g => g.type === 'revenue');
                const totalCurrent = revenueGoals.reduce((sum, g) => sum + g.currentValue, 0);
                const totalTarget = revenueGoals.reduce((sum, g) => sum + g.targetValue, 0);
                const avgProgress = revenueGoals.length > 0 ? revenueGoals.reduce((sum, g) => sum + g.progress, 0) / revenueGoals.length : 0;
                return revenueGoals.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">Chiffre d'Affaires</span>
                      <span className="text-sm font-semibold text-gray-900">{avgProgress.toFixed(0)}%</span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900 mb-1">{fmt(totalCurrent)}</p>
                    <p className="text-xs text-gray-400 mb-3">sur {fmt(totalTarget)}</p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(avgProgress, 100)}%` }}></div>
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const ordersGoals = goals.filter(g => g.type === 'orders');
                const totalTarget = ordersGoals.reduce((sum, g) => sum + g.targetValue, 0);
                const progress = totalTarget > 0 ? (globalOrdersCount / totalTarget) * 100 : 0;
                return ordersGoals.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">Commandes livrées</span>
                      <span className="text-sm font-semibold text-gray-900">{progress.toFixed(0)}%</span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900 mb-1">{globalOrdersCount}</p>
                    <p className="text-xs text-gray-400 mb-3">sur {totalTarget}</p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }}></div>
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
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">Taux de livraison</span>
                      <span className="text-sm font-semibold text-gray-900">{avgProgress.toFixed(0)}%</span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900 mb-1">{avgCurrent.toFixed(1)}%</p>
                    <p className="text-xs text-gray-400 mb-3">objectif {avgTarget.toFixed(0)}%</p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(avgProgress, 100)}%` }}></div>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">Taux de réussite</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {((goals.filter(g => g.progress >= 100).length / goals.length) * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-2xl font-semibold text-gray-900 mb-1">{goals.filter(g => g.progress >= 100).length}/{goals.length}</p>
                <p className="text-xs text-gray-400 mb-3">objectifs atteints</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${(goals.filter(g => g.progress >= 100).length / goals.length) * 100}%` }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Liste des objectifs */}
          {goals.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <p className="text-sm font-medium text-gray-900">Aucun objectif défini</p>
              <p className="text-sm text-gray-500 mt-1">Commencez par fixer vos buts pour cette période.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
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
                    <div key={productKey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      {/* En-tête du produit */}
                      <div className="px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm">
                              {productData.product || 'Tous les produits'}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {productData.goals.length} objectif{productData.goals.length > 1 ? 's' : ''} · {periodLabels[period.periodType]?.toLowerCase() || 'hebdomadaire'}
                            </p>
                          </div>

                          <div className="flex gap-5 text-right flex-shrink-0">
                            {hasRevenue && (
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide">CA</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {fmt(productData.summary.revenue.current)}
                                </p>
                                {productData.summary.revenue.deliveries > 0 && (
                                  <p className="text-xs text-gray-500">
                                    {productData.summary.revenue.currentDeliveries || 0}/{productData.summary.revenue.deliveries} livr.
                                  </p>
                                )}
                              </div>
                            )}
                            {hasOrders && (
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide">Cmds</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {productData.summary.orders.current}
                                </p>
                                {productData.summary.orders.deliveries > 0 && (
                                  <p className="text-xs text-gray-500">
                                    {productData.summary.orders.currentDeliveries || 0}/{productData.summary.orders.deliveries} livr.
                                  </p>
                                )}
                              </div>
                            )}
                            {hasDelivery && (
                              <div className="hidden sm:block">
                                <p className="text-xs text-gray-400 uppercase tracking-wide">Livr.</p>
                                <p className="text-sm font-semibold text-gray-900">
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
                      <div className="divide-y divide-gray-100">
                        {productData.goals.map(goal => {
                          const typeInfo = goalTypes.find(t => t.value === goal.type);
                          const isRevenue = goal.type === 'revenue';
                          const isRate = goal.type === 'delivery_rate';

                          return (
                            <div key={goal._id} className="px-5 py-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="min-w-0">
                                  <h4 className="font-medium text-gray-900 text-sm">
                                    {isCloseuse && typeInfo?.value === 'revenue' ? "Mon CA" : typeInfo?.label}
                                  </h4>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {isCloseuse ? "Mon objectif" : "Objectif"} {periodLabels[goal.periodType]?.toLowerCase() || 'hebdomadaire'}
                                  </p>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <span className={`text-sm font-semibold ${goal.progress >= 100 ? 'text-primary-600' : 'text-gray-900'}`}>
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
                                    }} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Valeurs + barre */}
                              <div className="flex items-center gap-4 mb-2">
                                <div className="flex-1">
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${goal.progress >= 100 ? 'bg-primary-500' : 'bg-gray-900'}`}
                                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                                <div className="flex items-baseline gap-1 text-sm flex-shrink-0">
                                  <span className="font-semibold text-gray-900">
                                    {isRevenue ? fmt(goal.currentValue) : isRate ? `${goal.currentValue.toFixed(1)}%` : goal.currentValue}
                                  </span>
                                  <span className="text-gray-400">/</span>
                                  <span className="text-gray-500">
                                    {isRevenue ? fmt(goal.targetValue) : isRate ? `${goal.targetValue.toFixed(0)}%` : goal.targetValue}
                                  </span>
                                </div>
                              </div>

                              {/* Livraisons */}
                              {goal.deliveryCount && (
                                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100">
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                    <span>{goal.currentDeliveries || 0}/{goal.deliveryCount} livraisons</span>
                                  </div>
                                  <span className="text-xs text-gray-400">
                                    reste {Math.max(0, goal.deliveryCount - (goal.currentDeliveries || 0))}
                                  </span>
                                </div>
                              )}
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

      {/* Modal */}
      {isAdmin && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Nouvel objectif</h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              <form id="goal-form" onSubmit={(e) => { handleAddGoal(e); setShowForm(false); }} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Période</label>
                    <select value={newGoal.periodType} onChange={e => setNewSource({ ...newGoal, periodType: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none">
                      <option value="daily">Journalier</option>
                      <option value="weekly">Hebdomadaire</option>
                      <option value="monthly">Mensuel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                    <select value={newGoal.type} onChange={e => setNewSource({ ...newGoal, type: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none">
                      {goalTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                {newGoal.type === 'revenue' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Produit</label>
                      <select value={newGoal.product} onChange={e => handleProductChange(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none">
                        <option value="">Sélectionner un produit</option>
                        {products.map(p => (
                          <option key={p._id} value={p.name}>
                            {p.name} — {fmt(p.sellingPrice)}/unité
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de livraisons</label>
                      <input
                        type="number"
                        placeholder="Ex: 50"
                        value={newGoal.deliveryCount}
                        onChange={e => handleDeliveryCountChange(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                      {newGoal.deliveryCount && newGoal.product && (
                        <p className="text-xs text-gray-500 mt-1.5">
                          {newGoal.deliveryCount} x {fmt(products.find(p => p.name === newGoal.product)?.sellingPrice || 0)} = {fmt(newGoal.targetValue)}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Valeur cible {newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product && '(auto)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0"
                      value={newGoal.targetValue}
                      onChange={e => setNewSource({ ...newGoal, targetValue: e.target.value })}
                      disabled={newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product}
                      className={`w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none ${newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product ? 'bg-gray-50 text-gray-500' : ''}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{goalTypes.find(t => t.value === newGoal.type)?.unit}</span>
                  </div>
                  {newGoal.type === 'revenue' && !newGoal.product && (
                    <p className="text-xs text-gray-500 mt-1.5">Sélectionnez un produit pour le calcul automatique</p>
                  )}
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button
                type="submit"
                form="goal-form"
                disabled={saving || !newGoal.targetValue}
                className="flex-1 px-4 py-2.5 bg-scalor-green text-white rounded-lg text-sm font-medium hover:bg-scalor-green-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Enregistrement...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Goals;
