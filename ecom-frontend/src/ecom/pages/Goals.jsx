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
  const isAdmin = user?.role === 'ecom_admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState([]);
  const [products, setProducts] = useState([]);
  const [currentStats, setCurrentStats] = useState({});
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
    deliveryCount: '' // Nouveau champ pour le nombre de livraisons
  });

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const [goalsRes, productsRes] = await Promise.all([
        ecomApi.get('/goals', { params: { 
          periodType: period.periodType,
          year: period.year, 
          month: period.month,
          week: period.week,
          day: period.day
        } }),
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

  useEffect(() => {
    fetchGoals();
  }, [period]);

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
        setNewSource({ type: 'revenue', targetValue: '', product: '', periodType: period.periodType });
        
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

  if (loading && !goals.length) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Objectifs de Performance</h1>
          <p className="text-sm text-gray-500 mt-1">Fixez et suivez vos buts par jour, semaine ou mois</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white border rounded-xl p-1 shadow-sm">
            {['daily', 'weekly', 'monthly'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod({ ...period, periodType: p })}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  period.periodType === p ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-white border rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => changePeriod(-1)} className="p-2 hover:bg-gray-50 text-gray-600 border-r transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50/50">
              {period.periodType === 'daily' && period.day}
              {period.periodType === 'weekly' && `Semaine ${period.week}, ${period.year}`}
              {period.periodType === 'monthly' && new Date(period.year, period.month - 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
            </div>
            <button onClick={() => changePeriod(1)} className="p-2 hover:bg-gray-50 text-gray-600 border-l transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Résumé des Objectifs */}
      {goals.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-emerald-50 rounded-2xl border border-blue-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Résumé des Objectifs {periodLabels[period.periodType]?.toLowerCase() || 'hebdomadaire'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Résumé Chiffre d'Affaires */}
            {(() => {
              const revenueGoals = goals.filter(g => g.type === 'revenue');
              const totalTarget = revenueGoals.reduce((sum, g) => sum + g.targetValue, 0);
              const totalCurrent = revenueGoals.reduce((sum, g) => sum + g.currentValue, 0);
              const avgProgress = revenueGoals.length > 0 ? revenueGoals.reduce((sum, g) => sum + g.progress, 0) / revenueGoals.length : 0;
              
              return revenueGoals.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase">Chiffre d'Affaires</p>
                      <p className="text-lg font-black text-gray-900">{fmt(totalCurrent)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Objectif: {fmt(totalTarget)}</span>
                      <span className={`font-bold ${avgProgress >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {avgProgress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          avgProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(avgProgress, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Résumé Commandes */}
            {(() => {
              const ordersGoals = goals.filter(g => g.type === 'orders');
              const totalTarget = ordersGoals.reduce((sum, g) => sum + g.targetValue, 0);
              const totalCurrent = ordersGoals.reduce((sum, g) => sum + g.currentValue, 0);
              const avgProgress = ordersGoals.length > 0 ? ordersGoals.reduce((sum, g) => sum + g.progress, 0) / ordersGoals.length : 0;
              
              return ordersGoals.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 11-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase">Commandes</p>
                      <p className="text-lg font-black text-gray-900">{totalCurrent}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Objectif: {totalTarget}</span>
                      <span className={`font-bold ${avgProgress >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {avgProgress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          avgProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(avgProgress, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Résumé Taux de Livraison */}
            {(() => {
              const deliveryGoals = goals.filter(g => g.type === 'delivery_rate');
              const avgProgress = deliveryGoals.length > 0 ? deliveryGoals.reduce((sum, g) => sum + g.progress, 0) / deliveryGoals.length : 0;
              const avgCurrent = deliveryGoals.length > 0 ? deliveryGoals.reduce((sum, g) => sum + g.currentValue, 0) / deliveryGoals.length : 0;
              
              return deliveryGoals.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase">Taux de Livraison</p>
                      <p className="text-lg font-black text-gray-900">{avgCurrent.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Moyenne des objectifs</span>
                      <span className={`font-bold ${avgProgress >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {avgProgress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          avgProgress >= 100 ? 'bg-emerald-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${Math.min(avgProgress, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Statistiques globales */}
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Total Objectifs</p>
                <p className="text-lg font-black text-gray-900">{goals.length}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Atteints</p>
                <p className="text-lg font-black text-emerald-600">{goals.filter(g => g.progress >= 100).length}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">En cours</p>
                <p className="text-lg font-black text-blue-600">{goals.filter(g => g.progress < 100).length}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Progression Moyenne</p>
                <p className="text-lg font-black text-gray-900">
                  {(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulaire - Seulement Admin */}
        {isAdmin && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Fixer un objectif</h2>
              <form onSubmit={handleAddGoal} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Période</label>
                  <select
                    value={newGoal.periodType}
                    onChange={e => setNewSource({ ...newGoal, periodType: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  >
                    <option value="daily">Journalier</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Type</label>
                  <select
                    value={newGoal.type}
                    onChange={e => setNewSource({ ...newGoal, type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  >
                    {goalTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                
                {/* Champ Nombre de livraisons - seulement pour les objectifs de type revenue */}
                {newGoal.type === 'revenue' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre de livraisons</label>
                    <input
                      type="number"
                      placeholder="Ex: 50"
                      value={newGoal.deliveryCount}
                      onChange={e => handleDeliveryCountChange(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">Le CA sera calculé automatiquement</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Produit (Optionnel)</label>
                  <select
                    value={newGoal.product}
                    onChange={e => handleProductChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  >
                    <option value="">Tous les produits</option>
                    {products.map(p => <option key={p._id} value={p.name}>{p.name} ({fmt(p.sellingPrice)})</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Valeur cible {newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product && '(calculé)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder={newGoal.type === 'revenue' ? "0 ou calculer avec livraisons" : "0"}
                      value={newGoal.targetValue}
                      onChange={e => setNewSource({ ...newGoal, targetValue: e.target.value })}
                      className={`w-full pl-4 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm ${
                        newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product ? 'bg-blue-50 border-blue-300' : ''
                      }`}
                      disabled={newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      {goalTypes.find(t => t.value === newGoal.type)?.unit}
                    </div>
                  </div>
                  {newGoal.type === 'revenue' && newGoal.deliveryCount && newGoal.product && (
                    <p className="text-xs text-blue-600 mt-1 font-semibold">
                      💡 {newGoal.deliveryCount} livraisons × {fmt(products.find(p => p.name === newGoal.product)?.sellingPrice || 0)} = {fmt(newGoal.targetValue)}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={saving || !newGoal.targetValue}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer l\'objectif'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Liste des Objectifs & Evolution */}
        <div className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {goals.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Aucun objectif défini</h3>
              <p className="text-sm text-gray-500 mt-1">Commencez par fixer vos buts pour cette semaine.</p>
            </div>
          ) : (
            <div className="space-y-8">
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
                    <div key={productKey} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      {/* En-tête du produit */}
                      <div className="bg-gradient-to-r from-blue-50 to-emerald-50 p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                              {productData.product ? (
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 text-lg">
                                {productData.product || 'Tous les produits'}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {productData.goals.length} objectif{productData.goals.length > 1 ? 's' : ''} {periodLabels[period.periodType]?.toLowerCase() || 'hebdomadaire'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Mini résumé du produit */}
                          <div className="flex gap-4 text-center">
                            {hasRevenue && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase font-bold">CA</p>
                                <p className="text-sm font-black text-emerald-600">
                                  {fmt(productData.summary.revenue.current)}
                                </p>
                                {productData.summary.revenue.deliveries > 0 && (
                                  <p className="text-xs text-emerald-500">
                                    {productData.summary.revenue.currentDeliveries || 0}/{productData.summary.revenue.deliveries} livr.
                                  </p>
                                )}
                              </div>
                            )}
                            {hasOrders && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase font-bold">Cmds</p>
                                <p className="text-sm font-black text-blue-600">
                                  {productData.summary.orders.current}
                                </p>
                                {productData.summary.orders.deliveries > 0 && (
                                  <p className="text-xs text-blue-500">
                                    {productData.summary.orders.currentDeliveries || 0}/{productData.summary.orders.deliveries} livr.
                                  </p>
                                )}
                              </div>
                            )}
                            {hasDelivery && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase font-bold">Livraison</p>
                                <p className="text-sm font-black text-purple-600">
                                  {productData.summary.delivery_rate.count > 0 
                                    ? (productData.summary.delivery_rate.current / productData.summary.delivery_rate.count).toFixed(1) + '%'
                                    : '0%'
                                  }
                                </p>
                                {productData.summary.delivery_rate.deliveries > 0 && (
                                  <p className="text-xs text-purple-500">
                                    {productData.summary.delivery_rate.currentDeliveries || 0}/{productData.summary.delivery_rate.deliveries} livr.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Liste des objectifs du produit */}
                      <div className="p-4 space-y-4">
                        {productData.goals.map(goal => {
                          const typeInfo = goalTypes.find(t => t.value === goal.type);
                          const isRevenue = goal.type === 'revenue';
                          const isRate = goal.type === 'delivery_rate';
                          const progress = Math.min(goal.progress, 100);
                          
                          return (
                            <div key={goal._id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    isRevenue ? 'bg-emerald-50 text-emerald-600' : 
                                    isRate ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                                  }`}>
                                    {isRevenue ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    ) : isRate ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 11-8 0v4M5 9h14l1 12H4L5 9z" />
                                      </svg>
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-gray-900 text-sm">
                                      {typeInfo?.label}
                                    </h4>
                                    <p className="text-xs text-gray-400 uppercase font-bold tracking-tighter">
                                      Objectif {periodLabels[goal.periodType]?.toLowerCase() || 'hebdomadaire'}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-black ${goal.progress >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
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
                                    }} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="bg-white rounded-lg p-3">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Actuel</p>
                                  <p className="text-lg font-black text-gray-900">
                                    {isRevenue ? fmt(goal.currentValue) : isRate ? `${goal.currentValue.toFixed(1)}%` : goal.currentValue}
                                  </p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                  <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Cible</p>
                                  <p className="text-lg font-black text-blue-600">
                                    {isRevenue ? fmt(goal.targetValue) : isRate ? `${goal.targetValue}%` : goal.targetValue}
                                  </p>
                                </div>
                              </div>

                              {/* Affichage du nombre de livraisons si disponible */}
                              {goal.deliveryCount && (
                                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 mb-3">
                                  <p className="text-[10px] font-bold text-emerald-600 uppercase mb-2">Livraisons</p>
                                  <div className="flex justify-between items-center">
                                    <div className="text-center">
                                      <p className="text-xs text-emerald-600 uppercase font-bold">Effectuées</p>
                                      <p className="text-lg font-black text-emerald-700">{goal.currentDeliveries || 0}</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs text-gray-500 uppercase font-bold">Prévues</p>
                                      <p className="text-lg font-black text-gray-700">{goal.deliveryCount}</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs text-blue-600 uppercase font-bold">Restantes</p>
                                      <p className="text-lg font-black text-blue-700">
                                        {Math.max(0, goal.deliveryCount - (goal.currentDeliveries || 0))}
                                      </p>
                                    </div>
                                  </div>
                                  {isRevenue && goal.product && (
                                    <p className="text-xs text-emerald-600 mt-2 text-center">
                                      {goal.currentDeliveries || 0} / {goal.deliveryCount} livraisons
                                    </p>
                                  )}
                                  {/* Barre de progression des livraisons */}
                                  <div className="mt-2">
                                    <div className="w-full bg-emerald-100 rounded-full h-2 overflow-hidden">
                                      <div 
                                        className="h-full bg-emerald-500 transition-all duration-1000"
                                        style={{ width: `${Math.min(100, ((goal.currentDeliveries || 0) / goal.deliveryCount) * 100)}%` }}
                                      ></div>
                                    </div>
                                    <p className="text-xs text-emerald-600 mt-1 text-center">
                                      {((goal.currentDeliveries || 0) / goal.deliveryCount * 100).toFixed(1)}% des livraisons effectuées
                                    </p>
                                  </div>
                                </div>
                              )}
                              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-1000 ${
                                    goal.progress >= 100 ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-blue-500 shadow-lg shadow-blue-200'
                                  }`}
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
  );
};

export default Goals;
