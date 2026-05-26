import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
// ❌ CACHE DÉSACTIVÉ
// import { getCache, setCache, invalidatePrefix } from '../utils/cacheUtils.js';

const TransactionSkeleton = () => (
  <div className="space-y-3 py-2">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50">
          <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);

/* â”€â”€â”€ Constants â”€â”€â”€ */
const CAT = {
  publicite:'Publicité', produit:'Achat produit', livraison:'Livraison', salaire:'Salaire',
  abonnement:'Abonnement', materiel:'Matériel', transport:'Transport', autre_depense:'Autre dépense',
  vente:'Vente', remboursement_client:'Remboursement', investissement:'Investissement', autre_entree:'Autre entrée'
};
const EXP_CATS = ['publicite','produit','livraison','salaire','abonnement','materiel','transport','autre_depense'];
const NAV = [
  { id:'overview', label:'Vue d\'ensemble', ico:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id:'transactions', label:'Transactions', ico:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id:'budgets', label:'Budgets', ico:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id:'analyse', label:'Analyse', ico:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id:'previsions', label:'Prévisions', ico:'M13 10V3L4 14h7v7l9-11h-7z' },
];
const STATUS_LABELS = { pending:'En attente', confirmed:'Confirmée', shipped:'Expédiée', delivered:'Livrée', returned:'Retournée', no_answer:'Pas de réponse', cancelled:'Annulée' };
const SEV_CFG = { critical:{bg:'bg-red-50 border-red-200',text:'text-red-700',badge:'bg-red-100 text-red-700'}, warning:{bg:'bg-orange-50 border-orange-200',text:'text-orange-700',badge:'bg-orange-100 text-orange-700'}, info:{bg:'bg-primary-50 border-primary-200',text:'text-primary-700',badge:'bg-primary-100 text-primary-700'}, success:{bg:'bg-primary-50 border-primary-200',text:'text-primary-700',badge:'bg-primary-100 text-primary-700'} };
const PRIO_CFG = { 'URGENT':'bg-red-100 text-red-700 border-red-200', 'IMPORTANT':'bg-orange-100 text-orange-700 border-orange-200', 'MOYEN TERME':'bg-primary-100 text-primary-700 border-primary-200' };
const PERIODS = [
  { id:'today', label:"Aujourd'hui" },
  { id:'week', label:'Cette semaine' },
  { id:'month', label:'Ce mois' },
  { id:'last_month', label:'Mois dernier' },
  { id:'3months', label:'3 mois' },
  { id:'6months', label:'6 mois' },
  { id:'year', label:'Cette année' },
  { id:'custom', label:'Personnalisé' },
];

/* â”€â”€â”€ SVG Icon System â”€â”€â”€ */
const I = {
  up:    'M5 10l7-7m0 0l7 7m-7-7v18',
  down:  'M19 14l-7 7m0 0l-7-7m7 7V3',
  wallet:'M21 12a2.18 2.18 0 01-2 2h-2a2 2 0 010-4h2a2.18 2.18 0 012 2zM3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 01-2-2zm0 0a2 2 0 012-2h12',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0h6m2 0V5a2 2 0 012-2h2a2 2 0 012 2v14',
  heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  cal:   'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  target:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1',
  alert: 'M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  bolt:  'M13 10V3L4 14h7v7l9-11h-7z',
  box:   'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  edit:  'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  plus:  'M12 4v16m8-8H4',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  trend: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  refresh:'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  ai:    'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  shield:'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  close:'M6 18L18 6M6 6l12 12',
};
const Ico = ({d, className='w-5 h-5', ...props}) => <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" {...props}><path strokeLinecap="round" strokeLinejoin="round" d={d}/></svg>;
const NavIcon = ({d}) => <Ico d={d} className="w-[18px] h-[18px]" aria-hidden="true"/>;

/* â”€â”€â”€ Shared Components â”€â”€â”€ */
const Card = ({children, className=''}) => <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>{children}</div>;

const Metric = ({label, value, mobileValue, sub, icon, color='text-gray-900', subColor, iconBg='bg-gray-100'}) => (
  <Card className="p-4 sm:p-5">
    <div className="flex items-start gap-3.5">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Ico d={icon} className="w-5 h-5 text-current opacity-70"/>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight truncate whitespace-nowrap">{label}</p>
        {mobileValue ? (
          <>
            <p className={`text-[15px] font-bold mt-0.5 leading-tight whitespace-normal break-words tabular-nums sm:hidden ${color}`}>{mobileValue}</p>
            <p className={`text-2xl font-bold mt-0.5 truncate hidden sm:block ${color} tabular-nums`}>{value ?? '—'}</p>
          </>
        ) : (
          <p className={`text-[15px] sm:text-2xl font-bold mt-0.5 leading-tight whitespace-normal break-words tabular-nums ${color}`}>{value ?? '—'}</p>
        )}
        {sub && <p className={`text-xs mt-0.5 font-medium ${subColor||'text-gray-400'}`}>{sub}</p>}
      </div>
    </div>
  </Card>
);

const SectionTitle = ({children, action}) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest">{children}</h3>
    {action}
  </div>
);

const EmptyState = ({icon, title, sub, action}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3"><Ico d={icon} className="w-6 h-6 text-gray-400"/></div>
    <p className="text-sm font-semibold text-gray-500 mb-1">{title}</p>
    {sub && <p className="text-xs text-gray-400 mb-3 max-w-xs">{sub}</p>}
    {action}
  </div>
);

const Badge = ({children, variant='default'}) => {
  const cls = {
    success:'bg-primary-50 text-primary-700 border-primary-200',
    danger:'bg-red-50 text-red-700 border-red-200',
    warning:'bg-amber-50 text-amber-700 border-amber-200',
    default:'bg-gray-50 text-gray-600 border-gray-200',
    info:'bg-primary-50 text-primary-700 border-primary-200',
  }[variant]||'bg-gray-50 text-gray-600 border-gray-200';
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-md border ${cls}`}>{children}</span>;
};

/* â”€â”€â”€ Period Helpers â”€â”€â”€ */
const getPeriodDates = (preset, custom={}) => {
  const now = new Date();
  const f = d => d.toISOString().split('T')[0];
  const today = f(now);
  if (preset === 'today') return { startDate: today, endDate: today };
  if (preset === 'week') { const d = new Date(now); d.setDate(d.getDate() - d.getDay() + (d.getDay()===0?-6:1)); return { startDate: f(d), endDate: today }; }
  if (preset === 'month') return { startDate: f(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: today };
  if (preset === 'last_month') { const s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { startDate: f(s), endDate: f(e) }; }
  if (preset === '3months') { const d = new Date(now); d.setMonth(d.getMonth()-3); return { startDate: f(d), endDate: today }; }
  if (preset === '6months') { const d = new Date(now); d.setMonth(d.getMonth()-6); return { startDate: f(d), endDate: today }; }
  if (preset === 'year') return { startDate: f(new Date(now.getFullYear(), 0, 1)), endDate: today };
  return { startDate: custom.startDate||f(new Date(Date.now()-30*86400000)), endDate: custom.endDate||today };
};

const getMonthOptions = () => {
  const now = new Date();
  return Array.from({length:12},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
    return { value:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label:d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}) };
  });
};

const fmtDateShort = d => d ? new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
const fmtDateFull = d => d ? new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '';
const arr = v => v > 0 ? '↑' : v < 0 ? '↓' : '→';
const varColor = v => v > 5 ? 'text-primary-600' : v < -5 ? 'text-red-500' : 'text-gray-500';
const varColorInv = v => v > 5 ? 'text-red-500' : v < -5 ? 'text-primary-600' : 'text-gray-500';

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════════ */
const TransactionsList = () => {
  const { user } = useEcomAuth();
  const { fmt, fmtCompact } = useMoney();
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('month');
  const [customDates, setCustomDates] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0]
    };
  });
  const [showCustom, setShowCustom] = useState(false);
  const [budgetMonth, setBudgetMonth] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  });
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [filters, setFilters] = useState({ type:'', category:'' });
  const [budgets, setBudgets] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState({});
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetForm, setBudgetForm] = useState({ name:'', category:'publicite', amount:'', productId:'', month:'' });
  const [products, setProducts] = useState([]);
  const [accountingSummary, setAccountingSummary] = useState({});
  const [forecast, setForecast] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const res = await ecomApi.get('/products');
      const list = Array.isArray(res.data?.data) ? res.data.data
        : Array.isArray(res.data?.data?.products) ? res.data.data.products
        : Array.isArray(res.data?.products) ? res.data.products
        : [];
      setProducts(list);
    } catch { setProducts([]); }
  }, []);

  const loadTab = useCallback(async () => {
    const { startDate, endDate } = getPeriodDates(period, customDates);
    // ❌ CACHE DÉSACTIVÉ - Toujours charger depuis l'API
    setLoading(true); setError('');
    try {
      if (tab === 'overview') {
        const [sumRes, budRes, fcRes] = await Promise.all([
          ecomApi.get('/transactions/summary', { params:{ startDate, endDate } }).catch(()=>({data:{data:{}}})),
          ecomApi.get('/transactions/budgets').catch(()=>({data:{data:{budgets:[],summary:{}}}})),
          ecomApi.get('/transactions/forecast').catch(()=>({data:{data:{}}}))
        ]);
        const d = { summary: sumRes.data?.data||{}, budgets: budRes.data?.data?.budgets||[], budgetSummary: budRes.data?.data?.summary||{}, forecast: fcRes.data?.data||{} };
        // ❌ CACHE DÉSACTIVÉ
        setSummary(d.summary); setBudgets(d.budgets); setBudgetSummary(d.budgetSummary); setForecast(d.forecast);
      } else if (tab === 'transactions') {
        const params = { startDate, endDate };
        if (filters.type) params.type = filters.type;
        if (filters.category) params.category = filters.category;
        const [txRes, sumRes] = await Promise.all([
          ecomApi.get('/transactions', { params }),
          ecomApi.get('/transactions/summary', { params:{ startDate, endDate } })
        ]);
        const d = { transactions: txRes.data?.data?.transactions||[], summary: sumRes.data?.data||{} };
        // ❌ CACHE DÉSACTIVÉ
        setTransactions(d.transactions); setSummary(d.summary);
      } else if (tab === 'budgets') {
        const [res, prodRes] = await Promise.all([
          ecomApi.get('/transactions/budgets', { params:{ month: budgetMonth } }),
          ecomApi.get('/products').catch(()=>({data:{data:[]}}))
        ]);
        const prodList = Array.isArray(prodRes.data?.data) ? prodRes.data.data
          : Array.isArray(prodRes.data?.data?.products) ? prodRes.data.data.products
          : Array.isArray(prodRes.data?.products) ? prodRes.data.products : [];
        const d = { budgets: res.data?.data?.budgets||[], budgetSummary: res.data?.data?.summary||{}, products: prodList };
        // ❌ CACHE DÉSACTIVÉ
        setBudgets(d.budgets); setBudgetSummary(d.budgetSummary); setProducts(d.products);
      } else if (tab === 'analyse') {
        const res = await ecomApi.get('/transactions/accounting-summary', { params:{ startDate, endDate } });
        const d = { accountingSummary: res.data?.data||{} };
        // ❌ CACHE DÉSACTIVÉ
        setAccountingSummary(d.accountingSummary);
      } else if (tab === 'previsions') {
        const res = await ecomApi.get('/transactions/forecast');
        const d = { forecast: res.data?.data||{} };
        // ❌ CACHE DÉSACTIVÉ
        setForecast(d.forecast);
      }
    } catch (err) { setError(getContextualError(err, 'load_transactions')); }
    finally { setLoading(false); }
  }, [tab, period, customDates, filters, budgetMonth]);

  useEffect(()=>{ loadTab(); }, [loadTab]);

  useEffect(() => {
    const onStoreSwitch = () => {
      setTransactions([]);
      setSummary({});
      setBudgets([]);
      setBudgetSummary({});
      setAccountingSummary({});
      setForecast({});
      loadTab();
    };
    window.addEventListener('scalor:store-switch', onStoreSwitch);
    return () => window.removeEventListener('scalor:store-switch', onStoreSwitch);
  }, [loadTab]);

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette transaction ?')) return;
    try { await ecomApi.delete(`/transactions/${id}`); loadTab(); } catch (err) { setError(getContextualError(err, 'delete_transaction')); }
  };
  const handleBudgetSubmit = async (e) => {
    e.preventDefault();
    setBudgetError('');
    setBudgetSaving(true);
    try {
      const monthValue = budgetForm.month || budgetMonth;
      const [year, month] = monthValue.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const payload = {
        name: budgetForm.name,
        category: budgetForm.category,
        amount: Number(budgetForm.amount),
        productId: budgetForm.productId || null,
        month: monthValue,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      };
      
      if (editingBudget) await ecomApi.put(`/transactions/budgets/${editingBudget._id}`, payload);
      else await ecomApi.post('/transactions/budgets', payload);
      
      setShowBudgetForm(false); setEditingBudget(null);
      setBudgetForm({ name:'', category:'publicite', amount:'', productId:'', month:'' }); loadTab();
    } catch (err) { 
      console.error('Budget save error:', err);
      const msg = err.response?.data?.message || getContextualError(err, 'save_transaction');
      setBudgetError(msg);
    } finally {
      setBudgetSaving(false);
    }
  };
  const handleDeleteBudget = async (id) => {
    if (!window.confirm('Supprimer ce budget ?')) return;
    try {
      console.log('🗑️ Tentative de suppression du budget:', id);
      const response = await ecomApi.delete(`/transactions/budgets/${id}`);
      console.log('✅ Budget supprimé avec succès:', response);
      loadTab(); // Recharger la liste des budgets
    } catch (err) {
      console.error('❌ Erreur suppression budget:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Erreur lors de la suppression';
      setError(errorMessage);
    }
  };

  const bal = (summary.totalIncome||0) - (summary.totalExpense||0);
  const now = new Date();
  const { startDate: pStart, endDate: pEnd } = getPeriodDates(period, customDates);
  const periodLabel = PERIODS.find(p=>p.id===period)?.label || 'Période';
  const handlePeriod = (id) => { setPeriod(id); setShowCustom(id === 'custom'); };

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col lg:flex-row">

      {/* ══════════════════════════════════════════════════════════
          SIDEBAR — desktop only
          ══════════════════════════════════════════════════════════ */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-60 bg-white border-r border-gray-100 sticky top-0 h-screen overflow-y-auto flex-shrink-0 z-30">

        {/* Brand */}
        <div className="px-4 py-4 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Scalor</p>
          <h1 className="text-sm font-black text-gray-900 leading-tight">Centre financier</h1>
          <p className="text-xs text-gray-400 mt-0.5 capitalize leading-snug">
            {now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
          </p>
        </div>

        {/* Navigation */}
        <nav className="px-2 pt-3 pb-2 flex-shrink-0" role="tablist" aria-label="Vues">
          <p className="px-3 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vues</p>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)}
              role="tab"
              aria-selected={tab===n.id}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all mb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scalor-green focus-visible:ring-offset-1 ${
                tab===n.id
                  ? 'bg-scalor-green text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}>
              <Ico d={n.ico} className="w-4 h-4 flex-shrink-0" aria-hidden="true"/>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        {/* Period selector */}
        <div className="px-2 pt-2 pb-3 border-t border-gray-100 flex-shrink-0">
          <p className="px-3 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Période</p>
          {PERIODS.filter(p=>p.id!=='custom').map(p=>(
            <button key={p.id} onClick={()=>handlePeriod(p.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all mb-0.5 ${
                period===p.id
                  ? 'bg-emerald-50 text-scalor-green'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}>{p.label}</button>
          ))}
          <button onClick={()=>handlePeriod('custom')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              period==='custom' ? 'bg-emerald-50 text-scalor-green' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}>
            <Ico d={I.cal} className="w-3 h-3" aria-hidden="true"/>Personnalisé
          </button>
          {showCustom && (
            <div className="mt-1.5 px-1 space-y-1.5">
              <input type="date" value={customDates.startDate} onChange={e=>setCustomDates(p=>({...p,startDate:e.target.value}))}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:ring-2 focus:ring-primary-400 focus:border-primary-400"/>
              <input type="date" value={customDates.endDate} onChange={e=>setCustomDates(p=>({...p,endDate:e.target.value}))}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:ring-2 focus:ring-primary-400 focus:border-primary-400"/>
              <button onClick={()=>loadTab()}
                className="w-full px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition active:scale-95">
                Appliquer
              </button>
            </div>
          )}
        </div>

        {/* CTA — bottom of sidebar */}
        <div className="px-3 py-4 mt-auto border-t border-gray-100">
          <Link to="/ecom/transactions/new"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-scalor-green hover:bg-scalor-green-dark text-white rounded-xl text-sm font-semibold transition-all active:scale-95">
            <Ico d={I.plus} className="w-4 h-4" aria-hidden="true"/>Nouvelle transaction
          </Link>
          {tab === 'budgets' && (
            <button
              onClick={()=>{setBudgetError('');setShowBudgetForm(true);setEditingBudget(null);setBudgetForm({name:'',category:'publicite',amount:'',productId:'',month:budgetMonth});loadProducts();}}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 mt-2 bg-scalor-green hover:bg-scalor-green-dark text-white rounded-xl text-sm font-semibold transition-all active:scale-95">
              <Ico d={I.plus} className="w-4 h-4" aria-hidden="true"/>Nouveau budget
            </button>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════
          MAIN AREA
          ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Topbar ──────────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-100 px-4 sm:px-5 py-3 sticky top-0 z-20 flex items-center justify-between gap-3">

          {/* Left: title (mobile) / breadcrumb (desktop) */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden">
              <h1 className="text-base font-black text-gray-900 tracking-tight">Centre financier</h1>
            </div>
            <div className="hidden lg:flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-gray-900">{NAV.find(n=>n.id===tab)?.label}</h2>
              {period !== 'custom' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-500">
                  <Ico d={I.cal} className="w-3 h-3" aria-hidden="true"/>
                  {fmtDateShort(pStart)} — {fmtDateFull(pEnd)}
                </span>
              )}
            </div>
          </div>

          {/* Right: period pill + CTA */}
          <div className="flex items-center gap-2">
            {period !== 'custom' && (
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-semibold text-gray-500 lg:hidden">
                <Ico d={I.cal} className="w-3 h-3" aria-hidden="true"/>
                {fmtDateShort(pStart)} — {fmtDateFull(pEnd)}
              </span>
            )}
            <Link to="/ecom/transactions/new"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-scalor-green hover:bg-scalor-green-dark text-white rounded-lg text-sm font-medium transition-all active:scale-95">
              <Ico d={I.plus} className="w-4 h-4" aria-hidden="true"/>
              <span>Nouvelle transaction</span>
            </Link>
            {tab === 'budgets' && (
              <button
                onClick={()=>{setBudgetError('');setShowBudgetForm(true);setEditingBudget(null);setBudgetForm({name:'',category:'publicite',amount:'',productId:'',month:budgetMonth});loadProducts();}}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-scalor-green hover:bg-scalor-green-dark text-white rounded-lg text-sm font-medium transition-all active:scale-95">
                <Ico d={I.plus} className="w-4 h-4" aria-hidden="true"/>
                <span>Nouveau budget</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile: period row + tab row ────────────────────── */}
        <div className="lg:hidden bg-white border-b border-gray-100 px-4 py-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            {PERIODS.filter(p=>p.id!=='custom').map(p=>(
              <button key={p.id} onClick={()=>handlePeriod(p.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period===p.id ? 'bg-scalor-green text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                }`}>{p.label}</button>
            ))}
            <button onClick={()=>handlePeriod('custom')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                period==='custom' ? 'bg-scalor-green text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
              }`}>
              <Ico d={I.cal} className="w-3 h-3" aria-hidden="true"/>Personnalisé
            </button>
          </div>
          {showCustom && (
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={customDates.startDate} onChange={e=>setCustomDates(p=>({...p,startDate:e.target.value}))}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:ring-2 focus:ring-primary-400 focus:border-primary-400"/>
              <input type="date" value={customDates.endDate} onChange={e=>setCustomDates(p=>({...p,endDate:e.target.value}))}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:ring-2 focus:ring-primary-400 focus:border-primary-400"/>
              <button onClick={()=>loadTab()} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition">Appliquer</button>
            </div>
          )}
          <div className="flex flex-wrap gap-0.5" role="tablist">
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setTab(n.id)}
                role="tab"
                aria-selected={tab===n.id}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scalor-green ${
                  tab===n.id ? 'bg-scalor-green text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                <NavIcon d={n.ico}/>{n.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {error && (
            <div className="mx-4 sm:mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2.5 lg:mx-0 lg:rounded-none lg:border-x-0 lg:border-t-0">
              <Ico d={I.alert} className="w-4 h-4 flex-shrink-0" aria-hidden="true"/>{error}
            </div>
          )}
          <div className="p-4 sm:p-5 lg:p-0 space-y-3 lg:space-y-0">
            {loading ? (
              <TransactionSkeleton />
            ) : (
              <>
                {tab === 'overview'      && <OverviewTab summary={summary} budgets={budgets} budgetSummary={budgetSummary} forecast={forecast} fmt={fmt} fmtC={fmtCompact} setTab={setTab} periodLabel={periodLabel} pStart={pStart} pEnd={pEnd}/>}
                {tab === 'transactions'  && <TransactionsTab transactions={transactions} summary={summary} balance={bal} filters={filters} setFilters={setFilters} handleDelete={handleDelete} fmt={fmt} fmtCompact={fmtCompact} periodLabel={periodLabel}/>}
                {tab === 'budgets'       && <BudgetsTab budgets={budgets} budgetSummary={budgetSummary} showBudgetForm={showBudgetForm} setShowBudgetForm={setShowBudgetForm} editingBudget={editingBudget} setEditingBudget={setEditingBudget} budgetForm={budgetForm} setBudgetForm={setBudgetForm} handleBudgetSubmit={handleBudgetSubmit} handleDeleteBudget={handleDeleteBudget} products={products} fmt={fmt} fmtC={fmtCompact} budgetMonth={budgetMonth} setBudgetMonth={setBudgetMonth} loadProducts={loadProducts} budgetError={budgetError} setBudgetError={setBudgetError} budgetSaving={budgetSaving}/>}
                {tab === 'analyse'       && <AnalyseTab accountingSummary={accountingSummary} fmt={fmt} fmtC={fmtCompact} periodLabel={periodLabel} pStart={pStart} pEnd={pEnd}/>}
                {tab === 'previsions'    && <PrevisionsTab forecast={forecast} fmt={fmt} fmtC={fmtCompact}/>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   OverviewTab
   ═══════════════════════════════════════════════════════════════════════════ */
const OverviewTab = ({ summary, budgets, forecast, fmt, fmtC, setTab, periodLabel, pStart, pEnd }) => {
  const bal = (summary.totalIncome||0) - (summary.totalExpense||0);
  const f = forecast;
  const score = f.healthScore||0;
  const scoreColor = score>=70?'text-scalor-green':score>=40?'text-amber-600':'text-red-600';
  const scoreStroke = score>=70?'#0F6B4F':score>=40?'#d97706':'#dc2626';
  const orders = f.orders||{};
  const topBudgets = budgets.slice(0,3);
  const recs = (f.recommendations||[]).slice(0,3);

  return (
    <div className="space-y-5 py-1">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Entrées</p>
          <p className="text-xl font-semibold text-gray-900 tabular-nums">{fmtC(summary.totalIncome)}</p>
          <p className="text-xs text-gray-400 tabular-nums mt-0.5">{summary.incomeCount||0} transactions</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Dépenses</p>
          <p className="text-xl font-semibold text-gray-900 tabular-nums">{fmtC(summary.totalExpense)}</p>
          <p className="text-xs text-gray-400 tabular-nums mt-0.5">{summary.expenseCount||0} transactions</p>
        </div>
        <div className={`border rounded-lg p-4 ${bal>=0?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200'}`}>
          <p className="text-xs font-medium text-gray-500 mb-1">Solde net</p>
          <p className={`text-xl font-semibold tabular-nums ${bal>=0?'text-scalor-green':'text-red-600'}`}>{fmtC(bal)}</p>
          <p className={`text-xs mt-0.5 ${bal>=0?'text-scalor-green':'text-red-600'}`}>{bal>=0?'Excédent':'Déficit'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Santé financière</p>
          <div className="flex items-baseline gap-1">
            <p className={`text-xl font-semibold tabular-nums ${scoreColor}`}>{score}</p>
            <p className="text-xs text-gray-400">/100</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className="h-1.5 rounded-full transition-all" style={{width:`${score}%`,backgroundColor:scoreStroke}}/>
          </div>
        </div>
      </div>

      {/* Commandes + Avancement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Commandes ce mois</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">{orders.thisMonth||0}</p>
              {orders.growth!==undefined && <p className={`text-xs font-medium ${orders.growth>=0?'text-scalor-green':'text-red-600'}`}>{orders.growth>=0?'+':''}{orders.growth}%</p>}
            </div>
            <div>
              <p className="text-xs text-gray-400">CA</p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">{fmtC(orders.revenueThisMonth)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Livraison</p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">{orders.deliveryRate||0}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Avancement du mois</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-400">Dépenses / jour</p>
              <p className="text-base font-semibold text-gray-900 tabular-nums">{fmtC(f.dailyExpenseRate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Entrées / jour</p>
              <p className="text-base font-semibold text-gray-900 tabular-nums">{fmtC(f.dailyIncomeRate)}</p>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{f.daysPassed||0} / {f.daysInMonth||30} jours</span>
            <span className="font-medium">{Math.round(f.daysInMonth>0?(f.daysPassed/f.daysInMonth*100):0)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-gray-800 transition-all" style={{width:`${f.daysInMonth>0?(f.daysPassed/f.daysInMonth*100):0}%`}}/>
          </div>
        </div>
      </div>

      {/* Projections + Alertes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-900">Projections fin de mois</p>
            <button onClick={()=>setTab('previsions')} className="text-xs text-gray-400 hover:text-gray-700 transition">Voir tout</button>
          </div>
          <div className="space-y-2">
            {[
              {label:'Dépenses projetées', value:fmtC(f.projectedExpense), color:'text-red-600'},
              {label:'Entrées projetées', value:fmtC(f.projectedIncome), color:'text-scalor-green'},
              {label:'Solde projeté', value:fmtC(f.projectedBalance), color:(f.projectedBalance||0)>=0?'text-scalor-green':'text-red-600'},
            ].map((p,idx)=>(
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm text-gray-500">{p.label}</p>
                <p className={`text-sm font-semibold tabular-nums ${p.color}`}>{p.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Alertes</p>
          {recs.length===0 ? (
            <p className="text-sm text-gray-400">Aucune alerte</p>
          ) : (
            <div className="space-y-2">
              {recs.map((r,idx)=>{
                const isWarning = r.type==='critical'||r.type==='warning';
                return (
                  <div key={idx} className={`p-3 rounded-lg border ${isWarning?'bg-amber-50 border-amber-200':'bg-gray-50 border-gray-200'}`}>
                    <p className={`text-sm font-medium ${isWarning?'text-amber-800':'text-gray-700'}`}>{r.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.action}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Export Functions
   ═══════════════════════════════════════════════════════════════════════════ */
const exportToExcel = (transactions, periodLabel) => {
  const ws_data = [
    ['Date', 'Type', 'Catégorie', 'Description', 'Montant (FCFA)']
  ];
  
  transactions.forEach(tx => {
    ws_data.push([
      new Date(tx.date).toLocaleDateString('fr-FR'),
      tx.type === 'income' ? 'Entrée' : 'Dépense',
      CAT[tx.category] || tx.category,
      tx.description || '',
      tx.type === 'income' ? tx.amount : -tx.amount
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  
  const filename = `transactions_${periodLabel.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, filename);
};

const exportToCSV = (transactions, periodLabel) => {
  const csv_data = [
    ['Date', 'Type', 'Catégorie', 'Description', 'Montant (FCFA)']
  ];
  
  transactions.forEach(tx => {
    csv_data.push([
      new Date(tx.date).toLocaleDateString('fr-FR'),
      tx.type === 'income' ? 'Entrée' : 'Dépense',
      CAT[tx.category] || tx.category,
      tx.description || '',
      tx.type === 'income' ? tx.amount : -tx.amount
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(csv_data);
  const csv = Papa.unparse(csv_data);
  
  const filename = `transactions_${periodLabel.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

/* ═══════════════════════════════════════════════════════════════════════════
   TransactionsTab
   ═══════════════════════════════════════════════════════════════════════════ */
const TransactionsTab = ({ transactions, summary, balance, filters, setFilters, handleDelete, fmt, fmtCompact, periodLabel }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Calcul des alertes de trésorerie
  const totalIncome = summary?.totalIncome || 0;
  const totalExpense = summary?.totalExpense || 0;
  const cashBalance = balance || 0;
  const minCashRequired = totalIncome * 0.30;
  const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome * 100) : 0;
  const showCashAlert = totalIncome > 0 && cashBalance < minCashRequired;

  return (
  <div className="lg:border lg:border-gray-200 lg:bg-white space-y-3 lg:space-y-0">

    {/* ── KPI row — desktop tableau / mobile cards ── */}
    <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 sm:gap-3 lg:gap-0 lg:grid-cols-3 lg:divide-x lg:divide-gray-200 lg:border-b lg:border-gray-200">
      {[
        {label:'Entrées', value:fmt(summary.totalIncome), compact:fmtCompact(summary.totalIncome), sub:`${summary.incomeCount||0} opérations`, ico:I.trend, color:'text-primary-600', icoBg:'bg-primary-50'},
        {label:'Dépenses', value:fmt(summary.totalExpense), compact:fmtCompact(summary.totalExpense), sub:`${summary.expenseCount||0} opérations`, ico:I.down, color:'text-red-500', icoBg:'bg-red-50'},
        {label:'Solde net', value:fmt(balance), compact:fmtCompact(balance), sub:balance>=0?'Excédentaire':'Déficitaire', ico:I.wallet, color:balance>=0?'text-primary-600':'text-red-500', icoBg:balance>=0?'bg-primary-50':'bg-red-50'},
      ].map((k,i)=>(
        <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm lg:rounded-none lg:border-0 lg:shadow-none lg:p-5">
          <div className="hidden lg:block mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{k.label}</p>
          </div>
          <div className="flex items-start gap-3 lg:block">
            <div className={`w-9 h-9 rounded-xl ${k.icoBg} flex items-center justify-center flex-shrink-0 lg:hidden`}><Ico d={k.ico} className="w-[18px] h-[18px] text-current opacity-80" aria-hidden="true"/></div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider lg:hidden">{k.label}</p>
              <p className={`text-xl lg:text-2xl font-black tabular-nums mt-0.5 lg:mt-0 leading-tight ${k.color}`}><span className="lg:hidden">{k.compact}</span><span className="hidden lg:inline">{k.value}</span></p>
              <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
              <p className={`hidden lg:block text-xs tabular-nums mt-1 ${k.color} opacity-60`}>{k.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* ── Alerte trésorerie ── */}
    {showCashAlert && (
      <div className="bg-red-50 border border-red-200 lg:border-x-0 lg:border-t-0 lg:border-b-red-200 p-4 flex items-start gap-3 lg:rounded-none rounded-xl">
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 lg:w-8 lg:h-8 lg:rounded-lg">
          <Ico d={I.alert} className="w-4 h-4 text-red-600" aria-hidden="true"/>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-red-900 uppercase tracking-wide mb-1">Alerte : Déséquilibre financier critique</h4>
          <p className="text-xs text-red-700 leading-relaxed">
            Vos dépenses ({fmt(totalExpense)}) représentent <strong>{expenseRatio.toFixed(0)}%</strong> de vos entrées. Maintenir au moins <strong>30%</strong> des entrées en caisse.
            <span className="opacity-80 mt-0.5 block">Entrées: {fmt(totalIncome)} • Sorties: {fmt(totalExpense)} • Caisse: {fmt(cashBalance)} • Min. requis: {fmt(minCashRequired)}</span>
          </p>
        </div>
      </div>
    )}

    {/* ── Filtres / toolbar ── */}
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b-gray-200 lg:shadow-none lg:bg-gray-50/50">
      <div className="flex flex-wrap items-center gap-3">
        <select value={filters.type} onChange={e=>setFilters(p=>({...p,type:e.target.value}))} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium bg-gray-50 focus:ring-2 focus:ring-gray-900/10">
          <option value="">Tous les types</option><option value="expense">Dépenses</option><option value="income">Entrées</option>
        </select>
        <select value={filters.category} onChange={e=>setFilters(p=>({...p,category:e.target.value}))} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium bg-gray-50 focus:ring-2 focus:ring-gray-900/10">
          <option value="">Toutes catégories</option>
          {Object.entries(CAT).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        {(filters.type||filters.category) && (
          <button onClick={()=>setFilters({type:'',category:''})} className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-100 font-medium transition flex items-center gap-1">
            <Ico d={I.refresh} className="w-3 h-3"/>Réinitialiser
          </button>
        )}
        
        {/* Export dropdown */}
        <div className="relative ml-auto">
          <button 
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-100 font-medium transition flex items-center gap-1.5"
            disabled={transactions.length === 0}
          >
            <Ico d={I.box} className="w-3.5 h-3.5"/>Exporter
          </button>
          
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
              <button
                onClick={() => {
                  exportToExcel(transactions, periodLabel);
                  setShowExportMenu(false);
                }}
                className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 transition flex items-center gap-2"
                disabled={transactions.length === 0}
              >
                <span className="w-3 h-3 bg-green-100 rounded"></span>
                Excel (.xlsx)
              </button>
              <button
                onClick={() => {
                  exportToCSV(transactions, periodLabel);
                  setShowExportMenu(false);
                }}
                className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 transition flex items-center gap-2"
                disabled={transactions.length === 0}
              >
                <span className="w-3 h-3 bg-primary-100 rounded"></span>
                CSV (.csv)
              </button>
            </div>
          )}
        </div>
        
        <span className="text-xs text-gray-400 font-medium hidden sm:block">{transactions.length} résultat{transactions.length!==1?'s':''} — {periodLabel}</span>
      </div>
    </div>

    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm lg:rounded-none lg:border-0 lg:shadow-none">
      <div className="sm:hidden divide-y divide-gray-50">
        {transactions.length===0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><Ico d={I.wallet} className="w-5 h-5 text-gray-400"/></div>
            <p className="text-sm text-gray-500 font-medium">Aucune transaction sur cette période</p>
          </div>
        ) : transactions.map(tx => (
          <div key={tx._id} className="px-3 py-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <Link to={`/ecom/transactions/${tx._id}`} className="text-sm font-medium text-gray-800 hover:text-gray-900 whitespace-nowrap">
              {new Date(tx.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}
            </Link>
            <span className={`text-sm font-bold tabular-nums text-right justify-self-end ${tx.type==='income'?'text-primary-600':'text-red-500'}`}>
              {tx.type==='income'?'+':'-'}{fmtCompact(tx.amount)}
            </span>
            <div className="flex items-center gap-1">
              <Link to={`/ecom/transactions/${tx._id}/edit`} aria-label="Modifier" className="p-1.5 rounded-lg hover:bg-gray-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 active:scale-95"><Ico d={I.edit} className="w-3.5 h-3.5 text-gray-400" aria-hidden="true"/></Link>
              <button onClick={()=>handleDelete(tx._id)} aria-label="Supprimer" className="p-1.5 rounded-lg hover:bg-red-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 active:scale-95"><Ico d={I.trash} className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" aria-hidden="true"/></button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead><tr className="bg-gray-50">
            <th className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest text-left border-b border-gray-200">Date</th>
            <th className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest text-left hidden sm:table-cell border-b border-gray-200">Type</th>
            <th className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest text-left hidden sm:table-cell border-b border-gray-200">Catégorie</th>
            <th className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest text-left hidden md:table-cell border-b border-gray-200">Description</th>
            <th className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest text-right border-b border-gray-200">Montant</th>
            <th className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest text-center hidden lg:table-cell border-b border-gray-200">Soldé</th>
            <th className="px-4 py-2.5 border-b border-gray-200"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.length===0 ? (
              <tr><td colSpan="7" className="px-6 py-16 text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><Ico d={I.wallet} className="w-5 h-5 text-gray-400" aria-hidden="true"/></div>
                <p className="text-sm text-gray-500 font-medium">Aucune transaction sur cette période</p>
              </td></tr>
            ) : transactions.map((tx,idx)=>(
              <tr key={tx._id} className={`hover:bg-blue-50/30 transition-colors ${idx%2===0?'bg-white':'bg-gray-50/40'}`}>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link to={`/ecom/transactions/${tx._id}`} className="text-xs font-semibold text-gray-700 hover:text-gray-900 tabular-nums">{new Date(tx.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'})}</Link>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">
                  <Badge variant={tx.type==='income'?'success':'danger'}>{tx.type==='income'?'Entrée':'Dépense'}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-600 hidden sm:table-cell font-medium">{CAT[tx.category]||tx.category}</td>
                <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[200px] truncate hidden md:table-cell">{tx.description||'—'}</td>
                <td className={`px-4 py-2.5 text-xs font-black text-right tabular-nums ${tx.type==='income'?'text-primary-600':'text-red-500'}`}>
                  <span className="sm:hidden">{tx.type==='income'?'+':'-'}{fmtCompact(tx.amount)}</span>
                  <span className="hidden sm:inline">{tx.type==='income'?'+':'-'}{fmt(tx.amount)}</span>
                </td>
                <td className="px-4 py-2.5 text-center hidden lg:table-cell">
                  {tx.type === 'income' ? (
                    <input type="checkbox" checked={tx.isPaid || false}
                      onChange={async (e) => { try { await ecomApi.put(`/transactions/${tx._id}`, { isPaid: e.target.checked }); } catch {} }}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      aria-label={tx.isPaid ? 'Marquer comme non soldé' : 'Marquer comme soldé'}
                    />
                  ) : <span className="text-gray-200">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-0.5">
                    <Link to={`/ecom/transactions/${tx._id}/edit`} aria-label="Modifier" className="p-1.5 rounded hover:bg-gray-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 active:scale-95"><Ico d={I.edit} className="w-3.5 h-3.5 text-gray-400" aria-hidden="true"/></Link>
                    <button onClick={()=>handleDelete(tx._id)} aria-label="Supprimer" className="p-1.5 rounded hover:bg-red-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 active:scale-95"><Ico d={I.trash} className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" aria-hidden="true"/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   BudgetsTab
   ═══════════════════════════════════════════════════════════════════════════ */
const budgetStatus = p => p>100?{badge:'Dépassé',variant:'danger',bar:'bg-red-500',dot:'bg-red-500'}:p>=70?{badge:'Attention',variant:'warning',bar:'bg-amber-400',dot:'bg-amber-400'}:{badge:'OK',variant:'success',bar:'bg-primary-500',dot:'bg-primary-500'};

const BudgetsTab = ({ budgets, budgetSummary, showBudgetForm, setShowBudgetForm, editingBudget, setEditingBudget, budgetForm, setBudgetForm, handleBudgetSubmit, handleDeleteBudget, products, fmt, fmtC, budgetMonth, setBudgetMonth, loadProducts, budgetError, setBudgetError, budgetSaving }) => {
  const monthOptions = getMonthOptions();
  const currentMonthLabel = monthOptions.find(m=>m.value===budgetMonth)?.label || budgetMonth;
  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition";

  return (
    <div className="space-y-4">
      <Card className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Ico d={I.cal} className="w-4 h-4 text-gray-400"/>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Période</span>
          <select value={budgetMonth} onChange={e=>setBudgetMonth(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-gray-50 focus:ring-2 focus:ring-gray-900/10">
            {monthOptions.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <span className="text-xs text-gray-400 font-medium">{budgets.length} budget{budgets.length!==1?'s':''}</span>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Budget total" value={fmt(budgetSummary.totalBudget)} mobileValue={fmtC(budgetSummary.totalBudget)} icon={I.target} color="text-gray-900" iconBg="bg-gray-100"/>
        <Metric label="Dépensé" value={fmt(budgetSummary.totalSpent)} mobileValue={fmtC(budgetSummary.totalSpent)} icon={I.down} color="text-red-500" iconBg="bg-red-50"/>
        <Metric label="Restant" value={fmt(budgetSummary.totalRemaining)} mobileValue={fmtC(budgetSummary.totalRemaining)} icon={I.wallet} color={(budgetSummary.totalRemaining||0)>=0?'text-primary-600':'text-red-500'} iconBg={(budgetSummary.totalRemaining||0)>=0?'bg-primary-50':'bg-red-50'}/>
        <Metric label="Dépassements" value={`${budgetSummary.exceededCount||0}`} sub="budget(s) en alerte" icon={(budgetSummary.exceededCount||0)>0?I.alert:I.check} color={(budgetSummary.exceededCount||0)>0?'text-red-500':'text-primary-600'} iconBg={(budgetSummary.exceededCount||0)>0?'bg-red-50':'bg-primary-50'}/>
      </div>

      {showBudgetForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { if (!budgetSaving) { setShowBudgetForm(false); setEditingBudget(null); setBudgetError(''); } }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{editingBudget?'Modifier le budget':'Nouveau budget'}</h3>
              <button onClick={() => {setShowBudgetForm(false);setEditingBudget(null);setBudgetError('');}} aria-label="Fermer" className="text-gray-400 hover:text-gray-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded-lg p-0.5 active:scale-95">
                <Ico d={I.close} className="w-5 h-5" aria-hidden="true"/>
              </button>
            </div>
            
            <form onSubmit={handleBudgetSubmit} className="space-y-4">
              {budgetError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  {budgetError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                <input required value={budgetForm.name} onChange={e=>setBudgetForm(p=>({...p,name:e.target.value}))} placeholder="Ex: Budget Pub" className={inputCls}/>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mois</label>
                <select required value={budgetForm.month||budgetMonth} onChange={e=>setBudgetForm(p=>({...p,month:e.target.value}))} className={inputCls}>
                  {monthOptions.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Catégorie</label>
                <select required value={budgetForm.category} onChange={e=>setBudgetForm(p=>({...p,category:e.target.value}))} className={inputCls}>
                  {EXP_CATS.map(c=><option key={c} value={c}>{CAT[c]}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Montant limite</label>
                <input required type="number" min="1" value={budgetForm.amount} onChange={e=>setBudgetForm(p=>({...p,amount:e.target.value}))} placeholder="150 000" className={inputCls}/>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Produit lié (optionnel)</label>
                <select value={budgetForm.productId||''} onChange={e=>setBudgetForm(p=>({...p,productId:e.target.value||null}))} className={inputCls}>
                  <option value="">— Toute la catégorie —</option>
                  {(products||[]).length===0 && <option disabled>Chargement des produits...</option>}
                  {(products||[]).map(p=><option key={p._id} value={p._id}>{p.name}{p.status?' ('+p.status+')':''}</option>)}
                </select>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>{setShowBudgetForm(false);setEditingBudget(null);setBudgetError('');}} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium transition" disabled={budgetSaving}>
                  Annuler
                </button>
                <button type="submit" disabled={budgetSaving} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {budgetSaving && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
                  {budgetSaving ? 'Enregistrement...' : editingBudget ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {budgets.length===0 ? (
        <Card className="p-0">
          <EmptyState icon={I.target} title={`Aucun budget pour ${currentMonthLabel}`} sub="Définissez des budgets pour suivre vos dépenses par catégorie"
            action={<button onClick={()=>{setBudgetError('');setShowBudgetForm(true);setBudgetForm({name:'',category:'publicite',amount:'',productId:'',month:budgetMonth});loadProducts();}} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition">Créer un budget</button>}/>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.map(b=>{
            const cfg = budgetStatus(b.percentage);
            const prodName = b.productId?.name;
            return (
              <Card key={b._id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`}/>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                        <Badge variant={cfg.variant}>{cfg.badge}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-gray-400 font-medium">{CAT[b.category]||b.category}</p>
                        {prodName && <Badge variant="info">{prodName}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">{fmt(b.totalSpent)} <span className="text-gray-400 font-normal text-xs">/ {fmt(b.amount)}</span></p>
                      <p className="text-xs text-gray-400">{fmtC(Math.max(b.remaining,0))} restants — {b.transactionCount||0} tx</p>
                    </div>
                    <div className="flex gap-0.5">
                      <button onClick={()=>{setBudgetError('');setEditingBudget(b);setBudgetForm({name:b.name,category:b.category,amount:b.amount,productId:b.productId?._id||'',month:b.month||budgetMonth});setShowBudgetForm(true);loadProducts();}} aria-label="Modifier le budget" className="p-1.5 rounded-lg hover:bg-gray-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 active:scale-95">
                        <Ico d={I.edit} className="w-4 h-4 text-gray-400" aria-hidden="true"/>
                      </button>
                      <button onClick={()=>handleDeleteBudget(b._id)} aria-label="Supprimer le budget" className="p-1.5 rounded-lg hover:bg-red-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 active:scale-95">
                        <Ico d={I.trash} className="w-4 h-4 text-gray-400 hover:text-red-500" aria-hidden="true"/>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2" role="progressbar" aria-valuenow={Math.min(b.percentage,100)} aria-valuemin={0} aria-valuemax={100} aria-label={b.name}>
                  <div className={`h-2 rounded-full transition-all ${cfg.bar}`} style={{width:`${Math.min(b.percentage,100)}%`}}/>
                </div>
                <div className="flex justify-between mt-1.5">
                  <p className="text-xs text-gray-400 font-medium">{b.percentage.toFixed(1)}% utilisé</p>
                  <p className="text-xs text-gray-400 font-medium sm:hidden">{fmtC(b.totalSpent)} / {fmtC(b.amount)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   AnalyseTab
   ═══════════════════════════════════════════════════════════════════════════ */


const AnalyseTab = ({ accountingSummary, fmt, fmtC, periodLabel, pStart, pEnd }) => {
  const a = accountingSummary;

  const expenses = (a.categoryBreakdown||[]).filter(c=>c._id.type==='expense');
  const income = (a.categoryBreakdown||[]).filter(c=>c._id.type==='income');
  const totalExp = expenses.reduce((s,e)=>s+e.total,0);
  const totalInc = income.reduce((s,ic)=>s+ic.total,0);
  const months = a.monthlyTrend||[];
  const monthLabels = [...new Set(months.map(m=>`${m._id.year}-${String(m._id.month).padStart(2,'0')}`))].sort();
  const lastBal = (a.lastMonth?.income||0)-(a.lastMonth?.expenses||0);
  const expColors = ['bg-red-500','bg-red-400','bg-orange-400','bg-amber-400','bg-yellow-400','bg-gray-400','bg-gray-300','bg-gray-200'];
  const incColors = ['bg-primary-500','bg-primary-400','bg-teal-400','bg-teal-300','bg-cyan-400','bg-cyan-300'];

  const getMonthData = (ml) => {
    const inc = months.find(m=>`${m._id.year}-${String(m._id.month).padStart(2,'0')}`===ml&&m._id.type==='income')?.total||0;
    const exp = months.find(m=>`${m._id.year}-${String(m._id.month).padStart(2,'0')}`===ml&&m._id.type==='expense')?.total||0;
    return { inc, exp, bal: inc - exp };
  };

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Total entrées" value={fmt(a.totalIncome)} mobileValue={fmtC(a.totalIncome)} icon={I.trend} color="text-primary-600" iconBg="bg-primary-50"/>
        <Metric label="Total dépenses" value={fmt(a.totalExpenses)} mobileValue={fmtC(a.totalExpenses)} icon={I.down} color="text-red-500" iconBg="bg-red-50"/>
        <Metric label="Solde global" value={fmt(a.balance)} mobileValue={fmtC(a.balance)} icon={I.wallet} color={(a.balance||0)>=0?'text-primary-600':'text-red-500'} iconBg={(a.balance||0)>=0?'bg-primary-50':'bg-red-50'}/>
        <Metric label="Mois précédent" value={fmt(lastBal)} mobileValue={fmtC(lastBal)} sub={lastBal>=0?'Excédentaire':'Déficitaire'} icon={I.cal} color={lastBal>=0?'text-primary-600':'text-red-500'} iconBg="bg-gray-100"/>
      </div>


      {/* Category breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle>Dépenses par catégorie</SectionTitle>
          {expenses.length===0 ? <p className="text-sm text-gray-400 py-6 text-center">Aucune dépense enregistrée</p> : (
            <div className="space-y-3">
              {expenses.sort((x,y)=>y.total-x.total).map((c,idx)=>{
                const pct = totalExp>0?(c.total/totalExp*100):0;
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-700 font-medium">{CAT[c._id.category]||c._id.category}</span>
                      <span className="font-bold text-red-500 tabular-nums"><span className="sm:hidden">{fmtC(c.total)}</span><span className="hidden sm:inline">{fmt(c.total)}</span> <span className="text-gray-400 font-normal text-xs">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${expColors[idx]||'bg-gray-300'}`} style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle>Entrées par catégorie</SectionTitle>
          {income.length===0 ? <p className="text-sm text-gray-400 py-6 text-center">Aucune entrée enregistrée</p> : (
            <div className="space-y-3">
              {income.sort((x,y)=>y.total-x.total).map((c,idx)=>{
                const pct = totalInc>0?(c.total/totalInc*100):0;
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-700 font-medium">{CAT[c._id.category]||c._id.category}</span>
                      <span className="font-bold text-primary-600 tabular-nums"><span className="sm:hidden">{fmtC(c.total)}</span><span className="hidden sm:inline">{fmt(c.total)}</span> <span className="text-gray-400 font-normal text-xs">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${incColors[idx]||'bg-gray-300'}`} style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Monthly trend */}
      {monthLabels.length>0 && (
        <Card className="p-5">
          <SectionTitle>Tendance mensuelle</SectionTitle>
          <div className="mb-5 space-y-2">
            {monthLabels.slice(-6).map(ml=>{
              const { inc, exp, bal: mBal } = getMonthData(ml);
              const maxVal = Math.max(...monthLabels.slice(-6).map(l=>{ const d=getMonthData(l); return Math.max(d.inc,d.exp); }),1);
              const [y,mo]=ml.split('-');
              const label=new Date(+y,+mo-1,1).toLocaleDateString('fr-FR',{month:'short'});
              return (
                <div key={ml} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-10 capitalize font-medium">{label}</span>
                  <div className="flex-1 flex gap-0.5 h-3">
                    <div className="bg-primary-400 rounded-sm" style={{width:`${inc/maxVal*50}%`}} title={`Entrées: ${fmt(inc)}`}/>
                    <div className="bg-red-300 rounded-sm" style={{width:`${exp/maxVal*50}%`}} title={`Dépenses: ${fmt(exp)}`}/>
                  </div>
                  <span className={`text-xs font-bold w-16 sm:w-24 text-right tabular-nums ${mBal>=0?'text-primary-600':'text-red-500'}`}>{mBal>=0?'+':''}<span className="sm:hidden">{fmtC(mBal)}</span><span className="hidden sm:inline">{fmt(mBal)}</span></span>
                </div>
              );
            })}
            <div className="flex gap-4 mt-1 text-xs text-gray-400 ml-14">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-primary-400 rounded-sm"/>Entrées</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-300 rounded-sm"/>Dépenses</span>
            </div>
          </div>
          <div className="overflow-x-auto border-t border-gray-100 pt-4">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {['Mois','Entrées','Dépenses','Solde'].map((h,idx)=>(
                  <th key={idx} className={`py-2 text-xs text-gray-400 font-bold uppercase ${idx>0?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {monthLabels.map(ml=>{
                  const { inc, exp, bal: mBal } = getMonthData(ml);
                  const [y,mo]=ml.split('-');
                  const label=new Date(+y,+mo-1,1).toLocaleDateString('fr-FR',{month:'short',year:'numeric'});
                  return (
                    <tr key={ml} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 text-gray-700 capitalize font-medium">{label}</td>
                      <td className="py-2.5 text-right text-primary-600 font-semibold tabular-nums"><span className="sm:hidden">{fmtC(inc)}</span><span className="hidden sm:inline">{fmt(inc)}</span></td>
                      <td className="py-2.5 text-right text-red-500 font-semibold tabular-nums"><span className="sm:hidden">{fmtC(exp)}</span><span className="hidden sm:inline">{fmt(exp)}</span></td>
                      <td className={`py-2.5 text-right font-bold tabular-nums ${mBal>=0?'text-primary-600':'text-red-500'}`}><span className="sm:hidden">{fmtC(mBal)}</span><span className="hidden sm:inline">{fmt(mBal)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PrevisionsTab
   ═══════════════════════════════════════════════════════════════════════════ */
const PrevisionsTab = ({ forecast, fmt, fmtC }) => {
  const f = forecast;
  const score = f.healthScore||0;
  const scoreColor = score>=70?'text-primary-600':score>=40?'text-amber-600':'text-red-500';
  const scoreStroke = score>=70?'#059669':score>=40?'#d97706':'#ef4444';
  const orders = f.orders||{};
  const recs = f.recommendations||[];
  const cats = f.categoryAnalysis||[];
  const prods = f.productAnalysis||[];
  const alerts = f.budgetAlerts||[];
  const weekly = f.weeklyTrend||[];
  const monthly = f.monthlyTrend||[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Dép. projetées" value={fmt(f.projectedExpense)} mobileValue={fmtC(f.projectedExpense)} sub={f.expenseVsAvg!==undefined?`${arr(f.expenseVsAvg)} ${Math.abs(f.expenseVsAvg)}% vs moy.`:null} icon={I.down} color="text-red-500" subColor={varColorInv(f.expenseVsAvg||0)} iconBg="bg-red-50"/>
        <Metric label="Ent. projetées" value={fmt(f.projectedIncome)} mobileValue={fmtC(f.projectedIncome)} sub={f.incomeVsAvg!==undefined?`${arr(f.incomeVsAvg)} ${Math.abs(f.incomeVsAvg)}% vs moy.`:null} icon={I.trend} color="text-primary-600" subColor={varColor(f.incomeVsAvg||0)} iconBg="bg-primary-50"/>
        <Metric label="Solde projeté" value={fmt(f.projectedBalance)} mobileValue={fmtC(f.projectedBalance)} sub={`Marge: ${f.projectedIncome>0?Math.round((f.projectedIncome-(f.projectedExpense||0))/f.projectedIncome*100):0}%`} icon={I.wallet} color={(f.projectedBalance||0)>=0?'text-primary-600':'text-red-500'} iconBg={(f.projectedBalance||0)>=0?'bg-primary-50':'bg-red-50'}/>
        <Metric label="Jours restants" value={`${f.daysLeft||0}`} sub={`sur ${f.daysInMonth||30} jours`} icon={I.clock} color="text-gray-700" iconBg="bg-gray-100"/>
      </div>

      {/* Score + Rythme */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle>Score de santé</SectionTitle>
          <div className="flex items-center gap-5 mb-4">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f3f4f6" strokeWidth="3"/>
                <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={scoreStroke} strokeWidth="3" strokeDasharray={`${score}, 100`} strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center"><span className={`text-xl font-bold ${scoreColor}`}>{score}</span></div>
            </div>
            <div className="min-w-0">
              <p className={`text-base font-bold ${scoreColor}`}>{f.healthLabel||'—'}</p>
              <div className="mt-2 space-y-1 text-xs text-gray-400">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5 font-medium"><span>Moy. dép. 3m</span><span className="text-gray-700 font-semibold tabular-nums">{fmtC(f.avg3mExpense)}</span></div>
                <div className="flex justify-between gap-4"><span>Moy. ent. 3m</span><span className="text-gray-700 font-semibold tabular-nums">{fmtC(f.avg3mIncome)}</span></div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5 font-medium"><span>Avancement</span><span>{f.daysPassed||0}/{f.daysInMonth||30}j</span></div>
            <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-gray-900 transition-all" style={{width:`${f.daysInMonth>0?(f.daysPassed/f.daysInMonth*100):0}%`}}/></div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Rythme</SectionTitle>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center text-sm bg-red-50 rounded-lg px-3 py-2"><span className="text-gray-600 font-medium">Dépenses / jour</span><span className="font-bold text-red-500 tabular-nums">{fmtC(f.dailyExpenseRate||0)}</span></div>
            <div className="flex justify-between items-center text-sm bg-primary-50 rounded-lg px-3 py-2"><span className="text-gray-600 font-medium">Entrées / jour</span><span className="font-bold text-primary-600 tabular-nums">{fmtC(f.dailyIncomeRate||0)}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-gray-900">{orders.thisMonth||0}</p>
              <p className="text-xs text-gray-400 font-medium">Commandes</p>
              {orders.growth!==undefined && <p className={`text-xs font-bold ${varColor(orders.growth)}`}>{arr(orders.growth)} {Math.abs(orders.growth)}%</p>}
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-primary-600 tabular-nums truncate">{fmtC(orders.revenueThisMonth)}</p>
              <p className="text-xs text-gray-400 font-medium">CA</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-gray-900">{orders.deliveryRate||0}%</p>
              <p className="text-xs text-gray-400 font-medium">Livraison</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recommandations */}
      {recs.length>0 && (
        <Card className="p-5">
          <SectionTitle>Recommandations</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recs.map((r,idx)=>{
              const cfg=SEV_CFG[r.type]||SEV_CFG.info;
              return (
                <div key={idx} className={`border rounded-lg p-4 ${cfg.bg}`}>
                  <div className="flex items-start gap-3">
                    <Ico d={r.type==='critical'?I.alert:r.type==='warning'?I.alert:r.type==='success'?I.check:I.ai} className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.text}`}/>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1"><p className={`text-xs font-bold ${cfg.text}`}>{r.title}</p><Badge variant={r.type==='critical'?'danger':r.type==='warning'?'warning':r.type==='success'?'success':'info'}>{r.type}</Badge></div>
                      <p className="text-xs text-gray-600 mb-1">{r.detail}</p>
                      <p className="text-xs font-bold text-gray-700">{r.action}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Categories + Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cats.length>0 && (
          <Card className="p-5">
            <SectionTitle>Dépenses par catégorie</SectionTitle>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {['Catégorie','Ce mois','Variation','Projeté'].map((h,idx)=><th key={idx} className={`py-2 text-xs text-gray-400 font-bold uppercase ${idx>0?'text-right':'text-left'}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {cats.map((c,idx)=>(
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-2.5 text-gray-700 font-medium text-xs">{CAT[c.category]||c.category}</td>
                      <td className="py-2.5 text-right text-red-500 font-semibold text-xs tabular-nums">{fmtC(c.currentSpent)}</td>
                      <td className={`py-2.5 text-right font-bold text-xs ${varColorInv(c.variation)}`}>{arr(c.variation)} {Math.abs(c.variation)}%</td>
                      <td className="py-2.5 text-right text-gray-700 font-medium text-xs tabular-nums">{fmtC(c.projected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {prods.length>0 && (
          <Card className="p-5">
            <SectionTitle>Top produits</SectionTitle>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {['Produit','Cmd','CA','Livr.','Profit'].map((h,idx)=><th key={idx} className={`py-2 text-xs text-gray-400 font-bold uppercase ${idx>0?'text-right':'text-left'}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {prods.slice(0,8).map((p,idx)=>(
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-2.5">
                        <span className="text-xs text-gray-700 font-medium">{p.name}</span>
                        {p.status && <Badge variant={p.status==='winner'?'warning':p.status==='test'?'info':'default'}>{p.status}</Badge>}
                      </td>
                      <td className="py-2.5 text-right text-xs text-gray-700 font-semibold tabular-nums">{p.orders}</td>
                      <td className="py-2.5 text-right text-xs text-primary-600 font-semibold tabular-nums">{fmtC(p.revenue)}</td>
                      <td className="py-2.5 text-right text-xs text-gray-500">{p.deliveryRate}%</td>
                      <td className={`py-2.5 text-right text-xs font-bold tabular-nums ${p.estimatedProfit>=0?'text-primary-600':'text-red-500'}`}>{fmtC(p.estimatedProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Budget alerts */}
      {alerts.length>0 && (
        <Card className="p-5">
          <SectionTitle>Alertes budgets</SectionTitle>
          <div className="space-y-2">
            {alerts.map((a,idx)=>{
              const sev = a.severity==='critical'?'bg-red-50 border-red-200 text-red-700':a.severity==='high'?'bg-amber-50 border-amber-200 text-amber-700':'bg-yellow-50 border-yellow-200 text-yellow-700';
              return (
                <div key={idx} className={`border rounded-lg p-3.5 flex items-center justify-between ${sev}`}>
                  <div className="min-w-0 flex items-center gap-2.5">
                    <Ico d={I.alert} className="w-4 h-4 flex-shrink-0"/>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{a.name}{a.product && <span className="text-xs font-normal opacity-70 ml-1">{a.product}</span>}</p>
                      <p className="text-xs opacity-80">{CAT[a.category]||a.category} — {a.percentage}% utilisé — Projeté : {a.projectedPercentage}%</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold flex-shrink-0 ml-4 tabular-nums">{fmtC(a.spent)} / {fmtC(a.amount)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {weekly.length>0 && (
          <Card className="p-5">
            <SectionTitle>Tendance hebdomadaire</SectionTitle>
            <div className="space-y-2">
              {weekly.map((w,idx)=>{
                const mx=Math.max(...weekly.map(wk=>Math.max(wk.expenses,wk.income)),1);
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-xs text-gray-400 mb-1 font-medium"><span>Sem. {w.week}</span><span className={`font-bold ${w.balance>=0?'text-primary-600':'text-red-500'}`}>{w.balance>=0?'+':''}{fmtC(w.balance)}</span></div>
                    <div className="flex gap-0.5 h-3">
                      <div className="bg-red-300 rounded-sm" style={{width:`${w.expenses/mx*50}%`}}/>
                      <div className="bg-primary-400 rounded-sm" style={{width:`${w.income/mx*50}%`}}/>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-4 mt-1 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-300 rounded-sm"/>Dépenses</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-primary-400 rounded-sm"/>Entrées</span>
              </div>
            </div>
          </Card>
        )}

        {monthly.length>0 && (
          <Card className="p-5">
            <SectionTitle>Tendance mensuelle</SectionTitle>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {['Mois','Entrées','Dépenses','Marge'].map((h,idx)=><th key={idx} className={`py-2 text-xs text-gray-400 font-bold uppercase ${idx>0?'text-right':'text-left'}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {monthly.map((m,idx)=>{
                    const [y,mo]=m.month.split('-');
                    const label=new Date(+y,+mo-1,1).toLocaleDateString('fr-FR',{month:'short',year:'numeric'});
                    const mBal=m.income-m.expenses;
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-2.5 text-gray-700 capitalize font-medium text-xs">{label}</td>
                        <td className="py-2.5 text-right text-primary-600 font-semibold text-xs tabular-nums">{fmtC(m.income)}</td>
                        <td className="py-2.5 text-right text-red-500 font-semibold text-xs tabular-nums">{fmtC(m.expenses)}</td>
                        <td className={`py-2.5 text-right font-bold text-xs ${mBal>=0?'text-primary-600':'text-red-500'}`}>{m.margin}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Order status */}
      {(orders.byStatus||[]).length>0 && (
        <Card className="p-5">
          <SectionTitle>Répartition des commandes</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(orders.byStatus||[]).map((s,idx)=>(
              <div key={idx} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xl font-bold text-gray-900">{s.count}</p>
                <p className="text-xs text-gray-500 font-medium">{STATUS_LABELS[s.status]||s.status}</p>
                <p className="text-xs text-gray-400 tabular-nums">{fmtC(s.revenue)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default TransactionsList;
