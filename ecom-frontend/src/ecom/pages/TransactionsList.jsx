import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

/* ─── Constants ─── */
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
  { id:'previsions', label:'Prévisions IA', ico:'M13 10V3L4 14h7v7l9-11h-7z' },
];
const STATUS_LABELS = { pending:'En attente', confirmed:'Confirmée', shipped:'Expédiée', delivered:'Livrée', returned:'Retournée', no_answer:'Pas de réponse', cancelled:'Annulée' };
const SEV_CFG = { critical:{bg:'bg-red-50 border-red-200',text:'text-red-700',badge:'bg-red-100 text-red-700'}, warning:{bg:'bg-orange-50 border-orange-200',text:'text-orange-700',badge:'bg-orange-100 text-orange-700'}, info:{bg:'bg-blue-50 border-blue-200',text:'text-blue-700',badge:'bg-blue-100 text-blue-700'}, success:{bg:'bg-emerald-50 border-emerald-200',text:'text-emerald-700',badge:'bg-emerald-100 text-emerald-700'} };
const PRIO_CFG = { 'URGENT':'bg-red-100 text-red-700 border-red-200', 'IMPORTANT':'bg-orange-100 text-orange-700 border-orange-200', 'MOYEN TERME':'bg-blue-100 text-blue-700 border-blue-200' };
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

/* ─── SVG Icon System ─── */
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
};
const Ico = ({d, className='w-5 h-5'}) => <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d}/></svg>;
const NavIcon = ({d}) => <Ico d={d} className="w-[18px] h-[18px]"/>;

/* ─── Shared Components ─── */
const Card = ({children, className=''}) => <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>{children}</div>;

const Metric = ({label, value, mobileValue, sub, icon, color='text-gray-900', subColor, iconBg='bg-gray-100'}) => (
  <Card className="p-4 sm:p-5">
    <div className="flex items-start gap-3.5">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Ico d={icon} className="w-5 h-5 text-current opacity-70"/>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider leading-tight truncate whitespace-nowrap">{label}</p>
        {mobileValue ? (
          <>
            <p className={`text-[15px] font-bold mt-0.5 leading-tight whitespace-normal break-words tabular-nums sm:hidden ${color}`}>{mobileValue}</p>
            <p className={`text-2xl font-bold mt-0.5 truncate hidden sm:block ${color} tabular-nums`}>{value ?? '—'}</p>
          </>
        ) : (
          <p className={`text-[15px] sm:text-2xl font-bold mt-0.5 leading-tight whitespace-normal break-words tabular-nums ${color}`}>{value ?? '—'}</p>
        )}
        {sub && <p className={`text-[11px] mt-0.5 font-medium ${subColor||'text-gray-400'}`}>{sub}</p>}
      </div>
    </div>
  </Card>
);

const SectionTitle = ({children, action}) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">{children}</h3>
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
    success:'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger:'bg-red-50 text-red-700 border-red-200',
    warning:'bg-amber-50 text-amber-700 border-amber-200',
    default:'bg-gray-50 text-gray-600 border-gray-200',
    info:'bg-blue-50 text-blue-700 border-blue-200',
  }[variant]||'bg-gray-50 text-gray-600 border-gray-200';
  return <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md border ${cls}`}>{children}</span>;
};

/* ─── Period Helpers ─── */
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
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return { value:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label:d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}) };
  });
};

const fmtDateShort = d => d ? new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
const fmtDateFull = d => d ? new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '';
const arr = v => v > 0 ? '↑' : v < 0 ? '↓' : '→';
const varColor = v => v > 5 ? 'text-emerald-600' : v < -5 ? 'text-red-500' : 'text-gray-500';
const varColorInv = v => v > 5 ? 'text-red-500' : v < -5 ? 'text-emerald-600' : 'text-gray-500';

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */
const TransactionsList = () => {
  const { user } = useEcomAuth();
  const { fmt, fmtCompact } = useMoney();
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('month');
  const [customDates, setCustomDates] = useState({ startDate:'', endDate:'' });
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
    setLoading(true); setError('');
    const { startDate, endDate } = getPeriodDates(period, customDates);
    try {
      if (tab === 'overview') {
        const [sumRes, budRes, fcRes] = await Promise.all([
          ecomApi.get('/transactions/summary', { params:{ startDate, endDate } }).catch(()=>({data:{data:{}}})),
          ecomApi.get('/transactions/budgets').catch(()=>({data:{data:{budgets:[],summary:{}}}})),
          ecomApi.get('/transactions/forecast').catch(()=>({data:{data:{}}}))
        ]);
        setSummary(sumRes.data?.data||{}); setBudgets(budRes.data?.data?.budgets||[]);
        setBudgetSummary(budRes.data?.data?.summary||{}); setForecast(fcRes.data?.data||{});
      } else if (tab === 'transactions') {
        const params = { startDate, endDate };
        if (filters.type) params.type = filters.type;
        if (filters.category) params.category = filters.category;
        const [txRes, sumRes] = await Promise.all([
          ecomApi.get('/transactions', { params }),
          ecomApi.get('/transactions/summary', { params:{ startDate, endDate } })
        ]);
        setTransactions(txRes.data?.data?.transactions||[]); setSummary(sumRes.data?.data||{});
      } else if (tab === 'budgets') {
        const [res, prodRes] = await Promise.all([
          ecomApi.get('/transactions/budgets', { params:{ month: budgetMonth } }),
          ecomApi.get('/products').catch(()=>({data:{data:[]}}))
        ]);
        setBudgets(res.data?.data?.budgets||[]); setBudgetSummary(res.data?.data?.summary||{});
        const prodList = Array.isArray(prodRes.data?.data) ? prodRes.data.data
          : Array.isArray(prodRes.data?.data?.products) ? prodRes.data.data.products
          : Array.isArray(prodRes.data?.products) ? prodRes.data.products : [];
        setProducts(prodList);
      } else if (tab === 'analyse') {
        const res = await ecomApi.get('/transactions/accounting-summary', { params:{ startDate, endDate } });
        setAccountingSummary(res.data?.data||{});
      } else if (tab === 'previsions') {
        const res = await ecomApi.get('/transactions/forecast');
        setForecast(res.data?.data||{});
      }
    } catch { setError('Erreur de chargement'); }
    finally { setLoading(false); }
  }, [tab, period, customDates, filters, budgetMonth]);

  useEffect(()=>{ loadTab(); }, [loadTab]);

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette transaction ?')) return;
    try { await ecomApi.delete(`/transactions/${id}`); loadTab(); } catch { setError('Erreur suppression'); }
  };
  const handleBudgetSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...budgetForm, month: budgetForm.month || budgetMonth };
      if (editingBudget) await ecomApi.put(`/transactions/budgets/${editingBudget._id}`, payload);
      else await ecomApi.post('/transactions/budgets', payload);
      setShowBudgetForm(false); setEditingBudget(null);
      setBudgetForm({ name:'', category:'publicite', amount:'', productId:'', month:'' }); loadTab();
    } catch { setError('Erreur sauvegarde budget'); }
  };
  const handleDeleteBudget = async (id) => {
    if (!window.confirm('Supprimer ce budget ?')) return;
    try { await ecomApi.delete(`/transactions/budgets/${id}`); loadTab(); } catch { setError('Erreur suppression budget'); }
  };

  const bal = (summary.totalIncome||0) - (summary.totalExpense||0);
  const now = new Date();
  const { startDate: pStart, endDate: pEnd } = getPeriodDates(period, customDates);
  const periodLabel = PERIODS.find(p=>p.id===period)?.label || 'Période';
  const handlePeriod = (id) => { setPeriod(id); setShowCustom(id === 'custom'); };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">

        {/* Header */}
        <div className="mb-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Centre financier</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">{now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {tab === 'transactions' && (
                <Link to="/ecom/transactions/new" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition text-sm font-semibold">
                  <Ico d={I.plus} className="w-4 h-4"/>Nouvelle transaction
                </Link>
              )}
              {tab === 'budgets' && (
                <button onClick={()=>{setShowBudgetForm(true);setEditingBudget(null);setBudgetForm({name:'',category:'publicite',amount:'',productId:'',month:budgetMonth});loadProducts();}}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition text-sm font-semibold">
                  <Ico d={I.plus} className="w-4 h-4"/>Nouveau budget
                </button>
              )}
            </div>
          </div>

          {/* Period selector */}
          <div className="bg-white rounded-xl border border-gray-200/60 p-1.5 flex flex-wrap items-center gap-1">
            {PERIODS.filter(p=>p.id!=='custom').map(p=>(
              <button key={p.id} onClick={()=>handlePeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period===p.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}>{p.label}</button>
            ))}
            <button onClick={()=>handlePeriod('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                period==='custom' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}>
              <Ico d={I.cal} className="w-3.5 h-3.5"/>Personnalisé
            </button>
            {period !== 'custom' && (
              <span className="ml-auto text-[11px] text-gray-400 font-medium px-2 hidden sm:block">
                {fmtDateShort(pStart)} — {fmtDateFull(pEnd)}
              </span>
            )}
            {showCustom && (
              <div className="w-full flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 mt-1">
                <label className="text-[11px] font-medium text-gray-400">Du</label>
                <input type="date" value={customDates.startDate} onChange={e=>setCustomDates(p=>({...p,startDate:e.target.value}))}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:ring-2 focus:ring-gray-900/10"/>
                <label className="text-[11px] font-medium text-gray-400">Au</label>
                <input type="date" value={customDates.endDate} onChange={e=>setCustomDates(p=>({...p,endDate:e.target.value}))}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:ring-2 focus:ring-gray-900/10"/>
                <button onClick={()=>loadTab()} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition">Appliquer</button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-0.5 mb-5 bg-white rounded-xl border border-gray-200/60 p-1">
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap ${
                tab===n.id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <NavIcon d={n.ico}/>{n.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm font-medium flex items-center gap-2.5">
            <Ico d={I.alert} className="w-4 h-4 flex-shrink-0"/>{error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-72 gap-3">
            <div className="w-8 h-8 border-[2.5px] border-gray-900 border-t-transparent rounded-full animate-spin"/>
            <p className="text-sm text-gray-400 font-medium">Chargement…</p>
          </div>
        ) : (
          <>
            {tab === 'overview' && <OverviewTab summary={summary} budgets={budgets} budgetSummary={budgetSummary} forecast={forecast} fmt={fmt} fmtC={fmtCompact} setTab={setTab} periodLabel={periodLabel} pStart={pStart} pEnd={pEnd}/>}
            {tab === 'transactions' && <TransactionsTab transactions={transactions} summary={summary} balance={bal} filters={filters} setFilters={setFilters} handleDelete={handleDelete} fmt={fmt} fmtCompact={fmtCompact} periodLabel={periodLabel}/>}
            {tab === 'budgets' && <BudgetsTab budgets={budgets} budgetSummary={budgetSummary} showBudgetForm={showBudgetForm} setShowBudgetForm={setShowBudgetForm} editingBudget={editingBudget} setEditingBudget={setEditingBudget} budgetForm={budgetForm} setBudgetForm={setBudgetForm} handleBudgetSubmit={handleBudgetSubmit} handleDeleteBudget={handleDeleteBudget} products={products} fmt={fmt} fmtC={fmtCompact} budgetMonth={budgetMonth} setBudgetMonth={setBudgetMonth} loadProducts={loadProducts}/>}
            {tab === 'analyse' && <AnalyseTab accountingSummary={accountingSummary} fmt={fmt} fmtC={fmtCompact} periodLabel={periodLabel} pStart={pStart} pEnd={pEnd}/>}
            {tab === 'previsions' && <PrevisionsTab forecast={forecast} fmt={fmt} fmtC={fmtCompact}/>}
          </>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   OverviewTab
   ═══════════════════════════════════════════ */
const OverviewTab = ({ summary, budgets, forecast, fmt, fmtC, setTab, periodLabel, pStart, pEnd }) => {
  const bal = (summary.totalIncome||0) - (summary.totalExpense||0);
  const f = forecast;
  const score = f.healthScore||0;
  const scoreColor = score>=70?'text-emerald-600':score>=40?'text-amber-600':'text-red-500';
  const scoreStroke = score>=70?'#059669':score>=40?'#d97706':'#ef4444';
  const orders = f.orders||{};
  const topBudgets = budgets.slice(0,3);
  const alerts = (f.budgetAlerts||[]).slice(0,3);
  const recs = (f.recommendations||[]).slice(0,3);

  return (
    <div className="space-y-5">
      {/* Period banner */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-100/80 border border-gray-200/60 rounded-xl">
        <Ico d={I.cal} className="w-4 h-4 text-gray-400 flex-shrink-0"/>
        <span className="text-xs font-semibold text-gray-600">{periodLabel}</span>
        <span className="text-xs text-gray-400">{fmtDateShort(pStart)} — {fmtDateFull(pEnd)}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Entrées" value={fmt(summary.totalIncome)} mobileValue={fmtC(summary.totalIncome)} sub={`${summary.incomeCount||0} transactions`} icon={I.trend} color="text-emerald-600" iconBg="bg-emerald-50"/>
        <Metric label="Dépenses" value={fmt(summary.totalExpense)} mobileValue={fmtC(summary.totalExpense)} sub={`${summary.expenseCount||0} transactions`} icon={I.down} color="text-red-500" iconBg="bg-red-50"/>
        <Metric label="Solde net" value={fmt(bal)} mobileValue={fmtC(bal)} sub={bal>=0?'Excédentaire':'Déficitaire'} icon={I.wallet} color={bal>=0?'text-emerald-600':'text-red-500'} iconBg={bal>=0?'bg-emerald-50':'bg-red-50'}/>
        <Metric label="Score santé" value={`${score}/100`} sub={f.healthLabel||'—'} icon={I.heart} color={scoreColor} iconBg="bg-gray-100"/>
      </div>

      {/* Row 2: Score + Orders + Budgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <SectionTitle>Santé financière</SectionTitle>
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
                <div className="flex justify-between gap-4"><span>Dép./jour</span><span className="text-red-500 font-semibold">{fmtC(f.dailyExpenseRate)}</span></div>
                <div className="flex justify-between gap-4"><span>Ent./jour</span><span className="text-emerald-600 font-semibold">{fmtC(f.dailyIncomeRate)}</span></div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1.5 font-medium"><span>Avancement</span><span>{f.daysPassed||0}/{f.daysInMonth||30}j</span></div>
            <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-gray-900 transition-all" style={{width:`${f.daysInMonth>0?(f.daysPassed/f.daysInMonth*100):0}%`}}/></div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Commandes</SectionTitle>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-gray-900">{orders.thisMonth||0}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Total</p>
              {orders.growth!==undefined && <p className={`text-[10px] font-bold mt-0.5 ${varColor(orders.growth)}`}>{arr(orders.growth)} {Math.abs(orders.growth)}%</p>}
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-emerald-600 truncate">{fmtC(orders.revenueThisMonth)}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">CA</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-gray-900">{orders.deliveryRate||0}%</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Livraison</p>
            </div>
          </div>
          {(orders.byStatus||[]).length>0 && (
            <div className="space-y-1.5">
              {(orders.byStatus||[]).slice(0,4).map((s,idx)=>{
                const total = orders.thisMonth||1;
                const pct = Math.round(s.count/total*100);
                const colors = {delivered:'bg-emerald-500',pending:'bg-amber-400',confirmed:'bg-blue-500',shipped:'bg-indigo-500',returned:'bg-red-400',no_answer:'bg-orange-400',cancelled:'bg-gray-400'};
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-gray-500 truncate font-medium">{STATUS_LABELS[s.status]||s.status}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${colors[s.status]||'bg-gray-300'}`} style={{width:`${pct}%`}}/></div>
                    <span className="text-gray-600 font-semibold w-6 text-right">{s.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle action={<button onClick={()=>setTab('budgets')} className="text-xs text-gray-500 font-semibold hover:text-gray-900 transition">Tout voir</button>}>Budgets</SectionTitle>
          {topBudgets.length===0 ? (
            <EmptyState icon={I.target} title="Aucun budget défini" sub="Créez des budgets pour suivre vos dépenses"
              action={<button onClick={()=>setTab('budgets')} className="text-xs text-gray-900 font-semibold hover:underline">Créer un budget</button>}/>
          ) : (
            <div className="space-y-3">
              {topBudgets.map(b=>{
                const pct = b.percentage||0;
                const barColor = pct>100?'bg-red-500':pct>=70?'bg-amber-400':'bg-emerald-500';
                return (
                  <div key={b._id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 truncate">{b.name}</span>
                      <span className={`text-xs font-bold ${pct>100?'text-red-500':pct>=70?'text-amber-600':'text-emerald-600'}`}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5"><div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{width:`${Math.min(pct,100)}%`}}/></div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>{fmtC(b.totalSpent)}</span><span>{fmtC(b.amount)}</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Projections + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle action={<button onClick={()=>setTab('previsions')} className="text-xs text-gray-500 font-semibold hover:text-gray-900 transition">Analyse IA</button>}>Projections fin de mois</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            {[
              {label:'Dépenses', value:fmtC(f.projectedExpense), vs:f.expenseVsAvg, color:'text-red-500', bg:'bg-red-50', inv:true},
              {label:'Entrées', value:fmtC(f.projectedIncome), vs:f.incomeVsAvg, color:'text-emerald-600', bg:'bg-emerald-50'},
              {label:'Solde', value:fmtC(f.projectedBalance), color:(f.projectedBalance||0)>=0?'text-emerald-600':'text-red-500', bg:(f.projectedBalance||0)>=0?'bg-emerald-50':'bg-red-50', sub:`${f.daysLeft||0}j restants`},
            ].map((p,idx)=>(
              <div key={idx} className={`${p.bg} rounded-xl p-3 text-center`}>
                <p className="text-[10px] text-gray-500 font-semibold uppercase">{p.label}</p>
                <p className={`text-base font-bold mt-1 ${p.color}`}>{p.value}</p>
                {p.vs!==undefined && <p className={`text-[10px] font-bold ${p.inv?varColorInv(p.vs):varColor(p.vs)}`}>{p.vs>0?'+':''}{p.vs}% vs moy.</p>}
                {p.sub && <p className="text-[10px] text-gray-400">{p.sub}</p>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Alertes</SectionTitle>
          {alerts.length===0 && recs.length===0 ? (
            <EmptyState icon={I.check} title="Aucune alerte" sub="Tout est sous contrôle"/>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {alerts.map((a,idx)=>(
                <div key={`a${idx}`} className={`flex items-center gap-3 p-3 rounded-xl border ${a.severity==='critical'?'bg-red-50 border-red-200':'bg-amber-50 border-amber-200'}`}>
                  <Ico d={I.alert} className={`w-4 h-4 flex-shrink-0 ${a.severity==='critical'?'text-red-500':'text-amber-500'}`}/>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold ${a.severity==='critical'?'text-red-700':'text-amber-700'}`}>{a.name}</p>
                    <p className="text-[10px] text-gray-500">{a.percentage}% utilisé — Projeté : {a.projectedPercentage}%</p>
                  </div>
                </div>
              ))}
              {recs.map((r,idx)=>{
                const cfg = SEV_CFG[r.type]||SEV_CFG.info;
                return (
                  <div key={`r${idx}`} className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg}`}>
                    <Ico d={r.type==='critical'?I.alert:r.type==='warning'?I.alert:r.type==='success'?I.check:I.ai} className={`w-4 h-4 flex-shrink-0 ${cfg.text}`}/>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold ${cfg.text}`}>{r.title}</p>
                      <p className="text-[10px] text-gray-500 truncate">{r.action}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:'Nouvelle transaction', href:'/ecom/transactions/new', icon:I.plus, bg:'bg-gray-50 hover:bg-gray-100 border-gray-200'},
          {label:'Gérer les budgets', tab:'budgets', icon:I.target, bg:'bg-gray-50 hover:bg-gray-100 border-gray-200'},
          {label:'Voir l\'analyse', tab:'analyse', icon:I.chart, bg:'bg-gray-50 hover:bg-gray-100 border-gray-200'},
          {label:'Prévisions IA', tab:'previsions', icon:I.bolt, bg:'bg-gray-50 hover:bg-gray-100 border-gray-200'},
        ].map((a,idx)=>(
          a.href ? (
            <Link key={idx} to={a.href} className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${a.bg}`}>
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0"><Ico d={a.icon} className="w-4 h-4 text-gray-600"/></div>
              <span className="text-[13px] font-semibold text-gray-700">{a.label}</span>
            </Link>
          ) : (
            <button key={idx} onClick={()=>setTab(a.tab)} className={`flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${a.bg}`}>
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0"><Ico d={a.icon} className="w-4 h-4 text-gray-600"/></div>
              <span className="text-[13px] font-semibold text-gray-700">{a.label}</span>
            </button>
          )
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   TransactionsTab
   ═══════════════════════════════════════════ */
const TransactionsTab = ({ transactions, summary, balance, filters, setFilters, handleDelete, fmt, fmtCompact, periodLabel }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 sm:gap-3">
      <Metric label="Entrées" value={fmt(summary.totalIncome)} mobileValue={fmtCompact(summary.totalIncome)} sub={`${summary.incomeCount||0} opérations`} icon={I.trend} color="text-emerald-600" iconBg="bg-emerald-50"/>
      <Metric label="Dépenses" value={fmt(summary.totalExpense)} mobileValue={fmtCompact(summary.totalExpense)} sub={`${summary.expenseCount||0} opérations`} icon={I.down} color="text-red-500" iconBg="bg-red-50"/>
      <Metric label="Solde net" value={fmt(balance)} mobileValue={fmtCompact(balance)} sub={balance>=0?'Excédentaire':'Déficitaire'} icon={I.wallet} color={balance>=0?'text-emerald-600':'text-red-500'} iconBg={balance>=0?'bg-emerald-50':'bg-red-50'}/>
    </div>

    <Card className="p-3">
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
        <span className="ml-auto text-[11px] text-gray-400 font-medium hidden sm:block">{transactions.length} résultat{transactions.length!==1?'s':''} — {periodLabel}</span>
      </div>
    </Card>

    <Card className="overflow-hidden">
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
            <span className={`text-sm font-bold tabular-nums text-right justify-self-end ${tx.type==='income'?'text-emerald-600':'text-red-500'}`}>
              {tx.type==='income'?'+':'-'}{fmtCompact(tx.amount)}
            </span>
            <div className="flex items-center gap-1">
              <Link to={`/ecom/transactions/${tx._id}/edit`} className="p-1.5 rounded-lg hover:bg-gray-100 transition" title="Modifier"><Ico d={I.edit} className="w-3.5 h-3.5 text-gray-400"/></Link>
              <button onClick={()=>handleDelete(tx._id)} className="p-1.5 rounded-lg hover:bg-red-50 transition" title="Supprimer"><Ico d={I.trash} className="w-3.5 h-3.5 text-gray-400 hover:text-red-500"/></button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead><tr className="bg-gray-50/80">
            <th className="px-2 sm:px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-left">Date</th>
            <th className="px-2 sm:px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-left hidden sm:table-cell">Type</th>
            <th className="px-2 sm:px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-left hidden sm:table-cell">Cat</th>
            <th className="px-2 sm:px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-left hidden md:table-cell">Desc</th>
            <th className="px-2 sm:px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Montant</th>
            <th className="px-2 sm:px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.length===0 ? (
              <tr><td colSpan="6" className="px-6 py-16 text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><Ico d={I.wallet} className="w-5 h-5 text-gray-400"/></div>
                <p className="text-sm text-gray-500 font-medium">Aucune transaction sur cette période</p>
              </td></tr>
            ) : transactions.map(tx=>(
              <tr key={tx._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-2 sm:px-4 py-1.5 sm:py-3 whitespace-nowrap">
                  <Link to={`/ecom/transactions/${tx._id}`} className="text-sm font-medium text-gray-800 hover:text-gray-900">{new Date(tx.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</Link>
                </td>
                <td className="px-2 sm:px-4 py-1.5 sm:py-3 whitespace-nowrap hidden sm:table-cell">
                  <Badge variant={tx.type==='income'?'success':'danger'}>{tx.type==='income'?'Entrée':'Dépense'}</Badge>
                </td>
                <td className="px-2 sm:px-4 py-1.5 sm:py-3 text-sm text-gray-600 hidden sm:table-cell font-medium">{CAT[tx.category]||tx.category}</td>
                <td className="px-2 sm:px-4 py-1.5 sm:py-3 text-sm text-gray-400 max-w-[200px] truncate hidden md:table-cell">{tx.description||'—'}</td>
                <td className={`px-2 sm:px-4 py-1.5 sm:py-3 text-sm font-bold text-right tabular-nums ${tx.type==='income'?'text-emerald-600':'text-red-500'}`}>
                  <span className="sm:hidden">{tx.type==='income'?'+':'-'}{fmtCompact(tx.amount)}</span>
                  <span className="hidden sm:inline">{tx.type==='income'?'+':'-'}{fmt(tx.amount)}</span>
                </td>
                <td className="px-2 sm:px-4 py-1.5 sm:py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/ecom/transactions/${tx._id}/edit`} className="p-1.5 rounded-lg hover:bg-gray-100 transition" title="Modifier"><Ico d={I.edit} className="w-3.5 h-3.5 text-gray-400"/></Link>
                    <button onClick={()=>handleDelete(tx._id)} className="p-1.5 rounded-lg hover:bg-red-50 transition" title="Supprimer"><Ico d={I.trash} className="w-3.5 h-3.5 text-gray-400 hover:text-red-500"/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);

/* ═══════════════════════════════════════════
   BudgetsTab
   ═══════════════════════════════════════════ */
const budgetStatus = p => p>100?{badge:'Dépassé',variant:'danger',bar:'bg-red-500',dot:'bg-red-500'}:p>=70?{badge:'Attention',variant:'warning',bar:'bg-amber-400',dot:'bg-amber-400'}:{badge:'OK',variant:'success',bar:'bg-emerald-500',dot:'bg-emerald-500'};

const BudgetsTab = ({ budgets, budgetSummary, showBudgetForm, setShowBudgetForm, editingBudget, setEditingBudget, budgetForm, setBudgetForm, handleBudgetSubmit, handleDeleteBudget, products, fmt, fmtC, budgetMonth, setBudgetMonth, loadProducts }) => {
  const monthOptions = getMonthOptions();
  const currentMonthLabel = monthOptions.find(m=>m.value===budgetMonth)?.label || budgetMonth;
  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition";

  return (
    <div className="space-y-4">
      <Card className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Ico d={I.cal} className="w-4 h-4 text-gray-400"/>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Période</span>
          <select value={budgetMonth} onChange={e=>setBudgetMonth(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-gray-50 focus:ring-2 focus:ring-gray-900/10">
            {monthOptions.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <span className="text-[11px] text-gray-400 font-medium">{budgets.length} budget{budgets.length!==1?'s':''}</span>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Budget total" value={fmt(budgetSummary.totalBudget)} mobileValue={fmtC(budgetSummary.totalBudget)} icon={I.target} color="text-gray-900" iconBg="bg-gray-100"/>
        <Metric label="Dépensé" value={fmt(budgetSummary.totalSpent)} mobileValue={fmtC(budgetSummary.totalSpent)} icon={I.down} color="text-red-500" iconBg="bg-red-50"/>
        <Metric label="Restant" value={fmt(budgetSummary.totalRemaining)} mobileValue={fmtC(budgetSummary.totalRemaining)} icon={I.wallet} color={(budgetSummary.totalRemaining||0)>=0?'text-emerald-600':'text-red-500'} iconBg={(budgetSummary.totalRemaining||0)>=0?'bg-emerald-50':'bg-red-50'}/>
        <Metric label="Dépassements" value={`${budgetSummary.exceededCount||0}`} sub="budget(s) en alerte" icon={(budgetSummary.exceededCount||0)>0?I.alert:I.check} color={(budgetSummary.exceededCount||0)>0?'text-red-500':'text-emerald-600'} iconBg={(budgetSummary.exceededCount||0)>0?'bg-red-50':'bg-emerald-50'}/>
      </div>

      {showBudgetForm && (
        <Card className="p-5 border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 mb-4">{editingBudget?'Modifier le budget':'Nouveau budget'}</h3>
          <form onSubmit={handleBudgetSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Nom</label>
              <input required value={budgetForm.name} onChange={e=>setBudgetForm(p=>({...p,name:e.target.value}))} placeholder="Ex: Budget Pub" className={inputCls}/></div>
            <div><label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Mois</label>
              <select required value={budgetForm.month||budgetMonth} onChange={e=>setBudgetForm(p=>({...p,month:e.target.value}))} className={inputCls}>
                {monthOptions.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
              </select></div>
            <div><label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Catégorie</label>
              <select required value={budgetForm.category} onChange={e=>setBudgetForm(p=>({...p,category:e.target.value}))} className={inputCls}>
                {EXP_CATS.map(c=><option key={c} value={c}>{CAT[c]}</option>)}
              </select></div>
            <div><label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Montant limite</label>
              <input required type="number" min="1" value={budgetForm.amount} onChange={e=>setBudgetForm(p=>({...p,amount:e.target.value}))} placeholder="150 000" className={inputCls}/></div>
            <div className="sm:col-span-2"><label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Produit lié <span className="text-gray-300 normal-case">(optionnel)</span></label>
              <select value={budgetForm.productId||''} onChange={e=>setBudgetForm(p=>({...p,productId:e.target.value||null}))} className={inputCls}>
                <option value="">— Toute la catégorie —</option>
                {(products||[]).length===0 && <option disabled>Chargement des produits...</option>}
                {(products||[]).map(p=><option key={p._id} value={p._id}>{p.name}{p.status?' ('+p.status+')':''}</option>)}
              </select></div>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" onClick={()=>{setShowBudgetForm(false);setEditingBudget(null);}} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 font-medium transition">Annuler</button>
              <button type="submit" className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition">{editingBudget?'Enregistrer':'Créer'}</button>
            </div>
          </form>
        </Card>
      )}

      {budgets.length===0 ? (
        <Card className="p-0">
          <EmptyState icon={I.target} title={`Aucun budget pour ${currentMonthLabel}`} sub="Définissez des budgets pour suivre vos dépenses par catégorie"
            action={<button onClick={()=>{setShowBudgetForm(true);setBudgetForm({name:'',category:'publicite',amount:'',productId:'',month:budgetMonth});loadProducts();}} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition">Créer un budget</button>}/>
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
                      <p className="text-[10px] text-gray-400">{fmtC(Math.max(b.remaining,0))} restants — {b.transactionCount||0} tx</p>
                    </div>
                    <div className="flex gap-0.5">
                      <button onClick={()=>{setEditingBudget(b);setBudgetForm({name:b.name,category:b.category,amount:b.amount,productId:b.productId?._id||'',month:b.month||budgetMonth});setShowBudgetForm(true);loadProducts();}} className="p-1.5 rounded-lg hover:bg-gray-100 transition" title="Modifier">
                        <Ico d={I.edit} className="w-4 h-4 text-gray-400"/>
                      </button>
                      <button onClick={()=>handleDeleteBudget(b._id)} className="p-1.5 rounded-lg hover:bg-red-50 transition" title="Supprimer">
                        <Ico d={I.trash} className="w-4 h-4 text-gray-400 hover:text-red-500"/>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${cfg.bar}`} style={{width:`${Math.min(b.percentage,100)}%`}}/>
                </div>
                <div className="flex justify-between mt-1.5">
                  <p className="text-[10px] text-gray-400 font-medium">{b.percentage.toFixed(1)}% utilisé</p>
                  <p className="text-[10px] text-gray-400 font-medium sm:hidden">{fmtC(b.totalSpent)} / {fmtC(b.amount)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   AnalyseTab
   ═══════════════════════════════════════════ */
const RISK_CFG = { faible:{bg:'bg-emerald-50 border-emerald-200',text:'text-emerald-700',label:'Faible'}, moyen:{bg:'bg-amber-50 border-amber-200',text:'text-amber-700',label:'Moyen'}, 'élevé':{bg:'bg-orange-50 border-orange-200',text:'text-orange-700',label:'Élevé'}, critique:{bg:'bg-red-50 border-red-200',text:'text-red-700',label:'Critique'} };
const PRIO_ICON = { CRITIQUE:{bg:'bg-red-100',text:'text-red-700',icon:I.alert,border:'border-red-200'}, IMPORTANT:{bg:'bg-orange-100',text:'text-orange-700',icon:I.bolt,border:'border-orange-200'}, OPPORTUNITE:{bg:'bg-emerald-100',text:'text-emerald-700',icon:I.trend,border:'border-emerald-200'} };
const CAT_ICON = { finance:I.wallet, produit:I.box, operations:I.users, marketing:I.trend, stock:I.box };

const AnalyseTab = ({ accountingSummary, fmt, fmtC, periodLabel, pStart, pEnd }) => {
  const a = accountingSummary;
  const [report, setReport] = React.useState(null);
  const [reportLoading, setReportLoading] = React.useState(false);
  const [reportError, setReportError] = React.useState('');
  const [activeSection, setActiveSection] = React.useState(null);

  const expenses = (a.categoryBreakdown||[]).filter(c=>c._id.type==='expense');
  const income = (a.categoryBreakdown||[]).filter(c=>c._id.type==='income');
  const totalExp = expenses.reduce((s,e)=>s+e.total,0);
  const totalInc = income.reduce((s,ic)=>s+ic.total,0);
  const months = a.monthlyTrend||[];
  const monthLabels = [...new Set(months.map(m=>`${m._id.year}-${String(m._id.month).padStart(2,'0')}`))].sort();
  const lastBal = (a.lastMonth?.income||0)-(a.lastMonth?.expenses||0);
  const expColors = ['bg-red-500','bg-red-400','bg-orange-400','bg-amber-400','bg-yellow-400','bg-gray-400','bg-gray-300','bg-gray-200'];
  const incColors = ['bg-emerald-500','bg-emerald-400','bg-teal-400','bg-teal-300','bg-cyan-400','bg-cyan-300'];

  const getMonthData = (ml) => {
    const inc = months.find(m=>`${m._id.year}-${String(m._id.month).padStart(2,'0')}`===ml&&m._id.type==='income')?.total||0;
    const exp = months.find(m=>`${m._id.year}-${String(m._id.month).padStart(2,'0')}`===ml&&m._id.type==='expense')?.total||0;
    return { inc, exp, bal: inc - exp };
  };

  const generateReport = async () => {
    setReportLoading(true); setReportError('');
    try {
      const res = await ecomApi.post('/transactions/strategic-analysis', { startDate: pStart, endDate: pEnd });
      setReport(res.data?.data || null);
      setActiveSection('situation');
    } catch (err) {
      setReportError(err.response?.data?.message || err.message || 'Erreur lors de la génération du rapport');
    } finally { setReportLoading(false); }
  };

  const r = report?.analysis;
  const raw = report?.rawMetrics;
  const det = report?.details;

  const SECTIONS = [
    { id:'situation', label:'Situation globale', icon:I.heart },
    { id:'depenses', label:'Dépenses', icon:I.down },
    { id:'roi', label:'ROI & Rentabilité', icon:I.trend },
    { id:'operations', label:'Opérations', icon:I.users },
    { id:'risques', label:'Projections & Risques', icon:I.alert },
    { id:'recommandations', label:'Recommandations', icon:I.bolt },
  ];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Total entrées" value={fmt(a.totalIncome)} mobileValue={fmtC(a.totalIncome)} icon={I.trend} color="text-emerald-600" iconBg="bg-emerald-50"/>
        <Metric label="Total dépenses" value={fmt(a.totalExpenses)} mobileValue={fmtC(a.totalExpenses)} icon={I.down} color="text-red-500" iconBg="bg-red-50"/>
        <Metric label="Solde global" value={fmt(a.balance)} mobileValue={fmtC(a.balance)} icon={I.wallet} color={(a.balance||0)>=0?'text-emerald-600':'text-red-500'} iconBg={(a.balance||0)>=0?'bg-emerald-50':'bg-red-50'}/>
        <Metric label="Mois précédent" value={fmt(lastBal)} mobileValue={fmtC(lastBal)} sub={lastBal>=0?'Excédentaire':'Déficitaire'} icon={I.cal} color={lastBal>=0?'text-emerald-600':'text-red-500'} iconBg="bg-gray-100"/>
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
                      <span className="font-bold text-red-500 tabular-nums"><span className="sm:hidden">{fmtC(c.total)}</span><span className="hidden sm:inline">{fmt(c.total)}</span> <span className="text-gray-400 font-normal text-[10px]">({pct.toFixed(0)}%)</span></span>
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
                      <span className="font-bold text-emerald-600 tabular-nums"><span className="sm:hidden">{fmtC(c.total)}</span><span className="hidden sm:inline">{fmt(c.total)}</span> <span className="text-gray-400 font-normal text-[10px]">({pct.toFixed(0)}%)</span></span>
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
                    <div className="bg-emerald-400 rounded-sm" style={{width:`${inc/maxVal*50}%`}} title={`Entrées: ${fmt(inc)}`}/>
                    <div className="bg-red-300 rounded-sm" style={{width:`${exp/maxVal*50}%`}} title={`Dépenses: ${fmt(exp)}`}/>
                  </div>
                  <span className={`text-xs font-bold w-16 sm:w-24 text-right tabular-nums ${mBal>=0?'text-emerald-600':'text-red-500'}`}>{mBal>=0?'+':''}<span className="sm:hidden">{fmtC(mBal)}</span><span className="hidden sm:inline">{fmt(mBal)}</span></span>
                </div>
              );
            })}
            <div className="flex gap-4 mt-1 text-[10px] text-gray-400 ml-14">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-sm"/>Entrées</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-300 rounded-sm"/>Dépenses</span>
            </div>
          </div>
          <div className="overflow-x-auto border-t border-gray-100 pt-4">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {['Mois','Entrées','Dépenses','Solde'].map((h,idx)=>(
                  <th key={idx} className={`py-2 text-[11px] text-gray-400 font-bold uppercase ${idx>0?'text-right':'text-left'}`}>{h}</th>
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
                      <td className="py-2.5 text-right text-emerald-600 font-semibold tabular-nums"><span className="sm:hidden">{fmtC(inc)}</span><span className="hidden sm:inline">{fmt(inc)}</span></td>
                      <td className="py-2.5 text-right text-red-500 font-semibold tabular-nums"><span className="sm:hidden">{fmtC(exp)}</span><span className="hidden sm:inline">{fmt(exp)}</span></td>
                      <td className={`py-2.5 text-right font-bold tabular-nums ${mBal>=0?'text-emerald-600':'text-red-500'}`}><span className="sm:hidden">{fmtC(mBal)}</span><span className="hidden sm:inline">{fmt(mBal)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ═══ STRATEGIC REPORT ═══ */}
      <div className="border-t border-gray-200 pt-6 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center"><Ico d={I.ai} className="w-5 h-5 text-white"/></div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Rapport Stratégique IA</h2>
              <p className="text-[11px] text-gray-400 font-medium">Analyse complète par GPT-4o — {periodLabel}</p>
            </div>
          </div>
          <button onClick={generateReport} disabled={reportLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
            {reportLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Analyse en cours…</> : <><Ico d={I.ai} className="w-4 h-4"/>{report ? 'Régénérer le rapport' : 'Générer le rapport'}</>}
          </button>
        </div>

        {reportError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm font-medium flex items-center gap-2.5">
            <Ico d={I.alert} className="w-4 h-4 flex-shrink-0"/>{reportError}
          </div>
        )}

        {reportLoading && (
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-[3px] border-gray-900 border-t-transparent rounded-full animate-spin"/>
              <p className="text-sm text-gray-500 font-medium">Collecte des données et analyse en cours…</p>
              <p className="text-xs text-gray-400">Transactions, commandes, produits, budgets, campagnes, stocks</p>
            </div>
          </Card>
        )}

        {r && !reportLoading && (
          <div className="space-y-4">
            {/* Executive summary banner */}
            <Card className="p-0 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-5 py-4 sm:px-6">
                <p className="text-white text-sm font-medium leading-relaxed">{r.situation_globale?.resume_executif}</p>
              </div>
              {r.note_strategique && (
                <div className="px-5 py-3 sm:px-6 bg-amber-50 border-t border-amber-100 flex items-start gap-2.5">
                  <Ico d={I.bolt} className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"/>
                  <p className="text-sm text-amber-800 font-medium">{r.note_strategique}</p>
                </div>
              )}
            </Card>

            {/* Raw metrics row */}
            {raw && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3.5 text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Score santé</p>
                  <p className={`text-2xl font-black tabular-nums mt-0.5 ${raw.healthScore>=70?'text-emerald-600':raw.healthScore>=40?'text-amber-600':'text-red-500'}`}>{raw.healthScore}<span className="text-sm font-semibold text-gray-300">/100</span></p>
                </Card>
                <Card className="p-3.5 text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Taux livraison</p>
                  <p className={`text-2xl font-black tabular-nums mt-0.5 ${raw.deliveryRate>=60?'text-emerald-600':raw.deliveryRate>=40?'text-amber-600':'text-red-500'}`}>{raw.deliveryRate}%</p>
                </Card>
                <Card className="p-3.5 text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Burn rate / jour</p>
                  <p className="text-2xl font-black tabular-nums mt-0.5 text-gray-900"><span className="sm:hidden text-xl">{fmtC(raw.burnRate)}</span><span className="hidden sm:inline">{fmt(raw.burnRate)}</span></p>
                </Card>
                <Card className="p-3.5 text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Jours restants</p>
                  <p className="text-2xl font-black tabular-nums mt-0.5 text-gray-900">{raw.daysLeft}<span className="text-sm font-semibold text-gray-300">/{raw.daysInMonth}</span></p>
                </Card>
              </div>
            )}

            {/* Section tabs */}
            <div className="flex gap-1 bg-white rounded-xl border border-gray-200/60 p-1 overflow-x-auto no-scrollbar">
              {SECTIONS.map(s=>(
                <button key={s.id} onClick={()=>setActiveSection(activeSection===s.id?null:s.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    activeSection===s.id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}>
                  <Ico d={s.icon} className="w-3.5 h-3.5"/>{s.label}
                </button>
              ))}
            </div>

            {/* Section: Situation globale */}
            {activeSection==='situation' && r.situation_globale && (
              <Card className="p-5 space-y-4">
                <SectionTitle>Situation globale</SectionTitle>
                <p className="text-sm text-gray-700 leading-relaxed">{r.situation_globale.interpretation}</p>
                {(r.situation_globale.chiffres_cles||[]).length>0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {r.situation_globale.chiffres_cles.map((kpi,i)=>(
                      <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-gray-400 uppercase">{kpi.label}</span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${kpi.tendance==='hausse'?'bg-emerald-100 text-emerald-700':kpi.tendance==='baisse'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-600'}`}>{kpi.tendance}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{kpi.valeur}</p>
                        {kpi.commentaire && <p className="text-[11px] text-gray-500 mt-0.5">{kpi.commentaire}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {r.situation_globale.cash_flow_analyse && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5">
                    <p className="text-[11px] font-bold text-blue-600 uppercase mb-1">Analyse cash flow</p>
                    <p className="text-sm text-blue-800">{r.situation_globale.cash_flow_analyse}</p>
                  </div>
                )}
              </Card>
            )}

            {/* Section: Analyse des dépenses */}
            {activeSection==='depenses' && r.analyse_depenses && (
              <Card className="p-5 space-y-4">
                <SectionTitle>Analyse des dépenses</SectionTitle>
                <p className="text-sm text-gray-700 leading-relaxed">{r.analyse_depenses.synthese}</p>
                {r.analyse_depenses.categorie_critique && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3.5">
                    <p className="text-[11px] font-bold text-red-600 uppercase mb-1">Catégorie critique</p>
                    <p className="text-sm text-red-800">{r.analyse_depenses.categorie_critique}</p>
                  </div>
                )}
                {(r.analyse_depenses.anomalies||[]).length>0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Anomalies détectées</p>
                    <div className="space-y-1.5">
                      {r.analyse_depenses.anomalies.map((a2,i)=>(
                        <div key={i} className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                          <Ico d={I.alert} className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5"/>
                          <span className="text-sm text-orange-800">{a2}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(r.analyse_depenses.optimisations||[]).length>0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Optimisations possibles</p>
                    <div className="space-y-1.5">
                      {r.analyse_depenses.optimisations.map((o,i)=>(
                        <div key={i} className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                          <Ico d={I.check} className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5"/>
                          <span className="text-sm text-emerald-800">{o}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Section: ROI & Rentabilité */}
            {activeSection==='roi' && r.roi_rentabilite && (
              <Card className="p-5 space-y-4">
                <SectionTitle>ROI & Rentabilité</SectionTitle>
                <p className="text-sm text-gray-700 leading-relaxed">{r.roi_rentabilite.synthese}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {r.roi_rentabilite.produit_star?.nom && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Ico d={I.trend} className="w-4 h-4 text-emerald-600"/>
                        <span className="text-[11px] font-bold text-emerald-600 uppercase">Produit star</span>
                      </div>
                      <p className="text-sm font-bold text-emerald-900 mb-0.5">{r.roi_rentabilite.produit_star.nom}</p>
                      <p className="text-xs text-emerald-700">{r.roi_rentabilite.produit_star.raison}</p>
                      {r.roi_rentabilite.produit_star.action && <p className="text-xs text-emerald-600 mt-1 font-semibold">{r.roi_rentabilite.produit_star.action}</p>}
                    </div>
                  )}
                  {r.roi_rentabilite.produit_probleme?.nom && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Ico d={I.alert} className="w-4 h-4 text-red-600"/>
                        <span className="text-[11px] font-bold text-red-600 uppercase">Produit problématique</span>
                      </div>
                      <p className="text-sm font-bold text-red-900 mb-0.5">{r.roi_rentabilite.produit_probleme.nom}</p>
                      <p className="text-xs text-red-700">{r.roi_rentabilite.produit_probleme.raison}</p>
                      {r.roi_rentabilite.produit_probleme.action && <p className="text-xs text-red-600 mt-1 font-semibold">{r.roi_rentabilite.produit_probleme.action}</p>}
                    </div>
                  )}
                </div>
                {(r.roi_rentabilite.produits_a_surveiller||[]).length>0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Produits à surveiller</p>
                    {r.roi_rentabilite.produits_a_surveiller.map((p,i)=>(
                      <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-1.5">
                        <Ico d={I.clock} className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5"/>
                        <span className="text-sm text-amber-800"><strong>{p.nom}</strong> — {p.raison}</span>
                      </div>
                    ))}
                  </div>
                )}
                {r.roi_rentabilite.cout_acquisition_moyen && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Coût d'acquisition</p>
                    <p className="text-sm text-gray-700">{r.roi_rentabilite.cout_acquisition_moyen}</p>
                  </div>
                )}
                {r.roi_rentabilite.marge_nette_reelle && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Marge nette réelle</p>
                    <p className="text-sm text-gray-700">{r.roi_rentabilite.marge_nette_reelle}</p>
                  </div>
                )}
                {/* Product data table */}
                {det?.productData?.length>0 && (
                  <div className="overflow-x-auto border-t border-gray-100 pt-3 mt-2">
                    <table className="min-w-full text-xs">
                      <thead><tr className="border-b border-gray-100">
                        {['Produit','Cmd','Livrées','Taux livr.','Marge','ROI pub','Stock'].map((h,idx)=>(
                          <th key={idx} className={`py-2 text-[10px] text-gray-400 font-bold uppercase ${idx>0?'text-right':'text-left'} whitespace-nowrap px-2`}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {det.productData.map((p,i)=>(
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="py-2 px-2 font-medium text-gray-700 max-w-[140px] truncate">{p.name}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-gray-600">{p.orders}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-emerald-600 font-semibold">{p.delivered}</td>
                            <td className={`py-2 px-2 text-right tabular-nums font-semibold ${p.deliveryRate>=60?'text-emerald-600':p.deliveryRate>=40?'text-amber-600':'text-red-500'}`}>{p.deliveryRate}%</td>
                            <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-900">{fmtC(p.margin)}</td>
                            <td className={`py-2 px-2 text-right tabular-nums font-semibold ${p.roi>0?'text-emerald-600':'text-red-500'}`}>{p.roi}%</td>
                            <td className={`py-2 px-2 text-right tabular-nums ${p.stock!==null&&p.stock<10?'text-red-500 font-bold':'text-gray-600'}`}>{p.stock??'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {/* Section: Analyse opérationnelle */}
            {activeSection==='operations' && r.analyse_operationnelle && (
              <Card className="p-5 space-y-4">
                <SectionTitle>Analyse opérationnelle</SectionTitle>
                {r.analyse_operationnelle.impact_livraison && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5">
                    <p className="text-[11px] font-bold text-blue-600 uppercase mb-1">Impact taux de livraison</p>
                    <p className="text-sm text-blue-800">{r.analyse_operationnelle.impact_livraison}</p>
                  </div>
                )}
                {(r.analyse_operationnelle.performance_closeuses||[]).length>0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Performance closeuses / livreurs</p>
                    <div className="space-y-2">
                      {r.analyse_operationnelle.performance_closeuses.map((c,i)=>(
                        <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 min-w-[100px]">{c.nom}</span>
                          <span className="text-xs text-gray-600 flex-1">{c.verdict}</span>
                          {c.action && <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded flex-shrink-0">{c.action}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {r.analyse_operationnelle.ville_plus_rentable?.nom && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5">
                      <p className="text-[11px] font-bold text-emerald-600 uppercase mb-1">Ville la plus rentable</p>
                      <p className="text-sm font-bold text-emerald-900">{r.analyse_operationnelle.ville_plus_rentable.nom}</p>
                      <p className="text-xs text-emerald-700 mt-0.5">{r.analyse_operationnelle.ville_plus_rentable.raison}</p>
                    </div>
                  )}
                  {r.analyse_operationnelle.ville_problematique?.nom && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3.5">
                      <p className="text-[11px] font-bold text-red-600 uppercase mb-1">Ville problématique</p>
                      <p className="text-sm font-bold text-red-900">{r.analyse_operationnelle.ville_problematique.nom}</p>
                      <p className="text-xs text-red-700 mt-0.5">{r.analyse_operationnelle.ville_problematique.raison}</p>
                      {r.analyse_operationnelle.ville_problematique.action && <p className="text-xs text-red-600 mt-1 font-semibold">{r.analyse_operationnelle.ville_problematique.action}</p>}
                    </div>
                  )}
                </div>
                {r.analyse_operationnelle.segment_performant && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Segment le plus performant</p>
                    <p className="text-sm text-gray-700">{r.analyse_operationnelle.segment_performant}</p>
                  </div>
                )}
                {/* City data table */}
                {det?.cityData?.length>0 && (
                  <div className="overflow-x-auto border-t border-gray-100 pt-3 mt-2">
                    <table className="min-w-full text-xs">
                      <thead><tr className="border-b border-gray-100">
                        {['Ville','Commandes','CA','Taux livr.','Taux retour'].map((h,idx)=>(
                          <th key={idx} className={`py-2 text-[10px] text-gray-400 font-bold uppercase ${idx>0?'text-right':'text-left'} whitespace-nowrap px-2`}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {det.cityData.map((c,i)=>(
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="py-2 px-2 font-medium text-gray-700">{c.city}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-gray-600">{c.orders}</td>
                            <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-900">{fmtC(c.revenue)}</td>
                            <td className={`py-2 px-2 text-right tabular-nums font-semibold ${c.deliveryRate>=60?'text-emerald-600':'text-red-500'}`}>{c.deliveryRate}%</td>
                            <td className={`py-2 px-2 text-right tabular-nums font-semibold ${c.returnRate>25?'text-red-500':'text-gray-600'}`}>{c.returnRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {/* Section: Projections & Risques */}
            {activeSection==='risques' && r.projections_risques && (
              <Card className="p-5 space-y-4">
                <SectionTitle>Projections & Risques</SectionTitle>
                {r.projections_risques.score_risque_global && (() => {
                  const cfg = RISK_CFG[r.projections_risques.score_risque_global] || RISK_CFG.moyen;
                  return (
                    <div className={`${cfg.bg} border rounded-lg px-4 py-3 flex items-center gap-3`}>
                      <Ico d={I.shield} className={`w-5 h-5 ${cfg.text}`}/>
                      <div>
                        <p className={`text-xs font-bold uppercase ${cfg.text}`}>Niveau de risque global</p>
                        <p className={`text-lg font-black uppercase ${cfg.text}`}>{cfg.label}</p>
                      </div>
                    </div>
                  );
                })()}
                {r.projections_risques.projection_fin_mois && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Projection fin de mois</p>
                    <p className="text-sm text-gray-700">{r.projections_risques.projection_fin_mois}</p>
                  </div>
                )}
                {r.projections_risques.risque_perte && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3.5">
                    <p className="text-[11px] font-bold text-red-600 uppercase mb-1">Risque de perte</p>
                    <p className="text-sm text-red-800">{r.projections_risques.risque_perte}</p>
                  </div>
                )}
                {r.projections_risques.burn_rate_analyse && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3.5">
                    <p className="text-[11px] font-bold text-orange-600 uppercase mb-1">Analyse burn rate</p>
                    <p className="text-sm text-orange-800">{r.projections_risques.burn_rate_analyse}</p>
                  </div>
                )}
                {(r.projections_risques.ruptures_stock||[]).length>0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Ruptures de stock probables</p>
                    {r.projections_risques.ruptures_stock.map((s,i)=>(
                      <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-1.5">
                        <Ico d={I.box} className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5"/>
                        <span className="text-sm text-red-800">{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(r.projections_risques.desequilibre_budget||[]).length>0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Déséquilibres budgétaires</p>
                    {r.projections_risques.desequilibre_budget.map((b,i)=>(
                      <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-1.5">
                        <Ico d={I.target} className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5"/>
                        <span className="text-sm text-amber-800">{b}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Section: Recommandations stratégiques */}
            {activeSection==='recommandations' && (r.recommandations||[]).length>0 && (
              <Card className="p-5 space-y-3">
                <SectionTitle>Recommandations stratégiques</SectionTitle>
                {r.recommandations.map((rec,i)=>{
                  const cfg = PRIO_ICON[rec.priorite] || PRIO_ICON.IMPORTANT;
                  const catIcon = CAT_ICON[rec.categorie] || I.bolt;
                  return (
                    <div key={i} className={`border ${cfg.border} rounded-xl p-4 ${cfg.bg}/30`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                          <Ico d={cfg.icon} className={`w-4 h-4 ${cfg.text}`}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>{rec.priorite}</span>
                            {rec.categorie && (
                              <span className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1"><Ico d={catIcon} className="w-3 h-3"/>{rec.categorie}</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mb-0.5">{rec.action}</p>
                          {rec.impact && <p className="text-xs text-gray-500">{rec.impact}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        )}

        {!report && !reportLoading && !reportError && (
          <Card className="p-0">
            <EmptyState icon={I.ai} title="Rapport stratégique IA"
              sub="Analysez vos données financières, commandes, produits, budgets et campagnes avec GPT-4o pour obtenir un rapport stratégique complet avec recommandations actionnables."
              action={<button onClick={generateReport} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition flex items-center gap-2"><Ico d={I.ai} className="w-4 h-4"/>Lancer l'analyse</button>}/>
          </Card>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   PrevisionsTab
   ═══════════════════════════════════════════ */
const PrevisionsTab = ({ forecast, fmt, fmtC }) => {
  const f = forecast;
  const [aiAnalysis, setAiAnalysis] = React.useState(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState('');

  const score = f.healthScore||0;
  const scoreColor = score>=70?'text-emerald-600':score>=40?'text-amber-600':'text-red-500';
  const scoreStroke = score>=70?'#059669':score>=40?'#d97706':'#ef4444';
  const orders = f.orders||{};
  const recs = f.recommendations||[];
  const cats = f.categoryAnalysis||[];
  const prods = f.productAnalysis||[];
  const alerts = f.budgetAlerts||[];
  const weekly = f.weeklyTrend||[];
  const monthly = f.monthlyTrend||[];

  const runAi = React.useCallback(async () => {
    if (!f.healthScore && !f.projectedExpense) return;
    setAiLoading(true); setAiError(''); setAiAnalysis(null);
    try {
      const res = await ecomApi.post('/transactions/forecast/ai', { forecastData: f });
      if (res.data?.success) setAiAnalysis(res.data.analysis);
      else setAiError(res.data?.message||'Erreur analyse IA');
    } catch (e) { setAiError(e.response?.data?.message||'Erreur connexion IA'); }
    finally { setAiLoading(false); }
  }, [f.healthScore, f.projectedExpense]);

  React.useEffect(() => {
    if (f.healthScore!==undefined || f.projectedExpense!==undefined) runAi();
  }, [f.healthScore, f.projectedExpense]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Dép. projetées" value={fmt(f.projectedExpense)} mobileValue={fmtC(f.projectedExpense)} sub={f.expenseVsAvg!==undefined?`${arr(f.expenseVsAvg)} ${Math.abs(f.expenseVsAvg)}% vs moy.`:null} icon={I.down} color="text-red-500" subColor={varColorInv(f.expenseVsAvg||0)} iconBg="bg-red-50"/>
        <Metric label="Ent. projetées" value={fmt(f.projectedIncome)} mobileValue={fmtC(f.projectedIncome)} sub={f.incomeVsAvg!==undefined?`${arr(f.incomeVsAvg)} ${Math.abs(f.incomeVsAvg)}% vs moy.`:null} icon={I.trend} color="text-emerald-600" subColor={varColor(f.incomeVsAvg||0)} iconBg="bg-emerald-50"/>
        <Metric label="Solde projeté" value={fmt(f.projectedBalance)} mobileValue={fmtC(f.projectedBalance)} sub={`Marge: ${f.projectedIncome>0?Math.round((f.projectedIncome-(f.projectedExpense||0))/f.projectedIncome*100):0}%`} icon={I.wallet} color={(f.projectedBalance||0)>=0?'text-emerald-600':'text-red-500'} iconBg={(f.projectedBalance||0)>=0?'bg-emerald-50':'bg-red-50'}/>
        <Metric label="Jours restants" value={`${f.daysLeft||0}`} sub={`sur ${f.daysInMonth||30} jours`} icon={I.clock} color="text-gray-700" iconBg="bg-gray-100"/>
      </div>

      {/* AI Analysis */}
      <Card className="p-5 border-gray-200 bg-gradient-to-br from-gray-50 to-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center"><Ico d={I.ai} className="w-5 h-5 text-white"/></div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Analyse IA</h3>
              <p className="text-[10px] text-gray-400 font-medium">Analyse contextuelle automatique</p>
            </div>
          </div>
          <button onClick={runAi} disabled={aiLoading||!f.healthScore}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-lg text-xs font-semibold transition">
            {aiLoading ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/><span>Analyse...</span></> : <><Ico d={I.refresh} className="w-3.5 h-3.5"/><span>Relancer</span></>}
          </button>
        </div>

        {aiError && <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm font-medium mb-3 flex items-center gap-2"><Ico d={I.alert} className="w-4 h-4 flex-shrink-0"/>{aiError}</div>}

        {aiLoading && !aiAnalysis && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-8 h-8 border-[2.5px] border-gray-900 border-t-transparent rounded-full animate-spin"/>
            <p className="text-sm text-gray-600 font-semibold">Analyse en cours...</p>
            <p className="text-xs text-gray-400">10 à 20 secondes</p>
          </div>
        )}

        {aiAnalysis && (
          <div className="space-y-3">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Résumé exécutif</p>
              <p className="text-sm text-gray-800 leading-relaxed">{aiAnalysis.resume}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Diagnostic</p>
              <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysis.diagnostic}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {title:'Points forts', items:aiAnalysis.points_forts, bg:'bg-emerald-50 border-emerald-200', titleColor:'text-emerald-700', dot:'text-emerald-500', icon:I.check},
                {title:'Points faibles', items:aiAnalysis.points_faibles, bg:'bg-red-50 border-red-200', titleColor:'text-red-700', dot:'text-red-400', icon:I.alert},
                {title:'Opportunités', items:aiAnalysis.opportunites, bg:'bg-blue-50 border-blue-200', titleColor:'text-blue-700', dot:'text-blue-400', icon:I.bolt},
                {title:'Risques', items:aiAnalysis.risques, bg:'bg-amber-50 border-amber-200', titleColor:'text-amber-700', dot:'text-amber-500', icon:I.shield},
              ].map((s,idx)=>(
                <div key={idx} className={`border rounded-lg p-4 ${s.bg}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Ico d={s.icon} className={`w-3.5 h-3.5 ${s.titleColor}`}/>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${s.titleColor}`}>{s.title}</p>
                  </div>
                  <ul className="space-y-1.5">{(s.items||[]).map((p,j)=><li key={j} className="text-xs text-gray-700 flex gap-1.5"><span className={`${s.dot} flex-shrink-0`}>·</span>{p}</li>)}</ul>
                </div>
              ))}
            </div>
            {(aiAnalysis.actions_prioritaires||[]).length>0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Actions prioritaires</p>
                <div className="space-y-2">
                  {(aiAnalysis.actions_prioritaires||[]).map((a,idx)=>(
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border flex-shrink-0 mt-0.5 ${PRIO_CFG[a.priorite]||'bg-gray-100 text-gray-600 border-gray-200'}`}>{a.priorite}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800">{a.action}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Impact : {a.impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">Scénario optimiste</p>
                <p className="text-xs text-gray-700 leading-relaxed">{aiAnalysis.prevision_optimiste}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-2">Scénario pessimiste</p>
                <p className="text-xs text-gray-700 leading-relaxed">{aiAnalysis.prevision_pessimiste}</p>
              </div>
            </div>
            {aiAnalysis.conseil_expert && (
              <div className="bg-gray-900 rounded-lg p-4 flex items-start gap-3">
                <Ico d={I.ai} className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5"/>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Conseil d'expert</p>
                  <p className="text-sm font-medium text-white leading-relaxed">{aiAnalysis.conseil_expert}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!aiAnalysis && !aiLoading && !aiError && (
          <p className="text-xs text-gray-400 text-center py-3 font-medium">Chargement de l'analyse...</p>
        )}
      </Card>

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
                <div className="flex justify-between text-[11px] text-gray-400 mb-1.5 font-medium"><span>Moy. dép. 3m</span><span className="text-gray-700 font-semibold tabular-nums">{fmtC(f.avg3mExpense)}</span></div>
                <div className="flex justify-between gap-4"><span>Moy. ent. 3m</span><span className="text-gray-700 font-semibold tabular-nums">{fmtC(f.avg3mIncome)}</span></div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1.5 font-medium"><span>Avancement</span><span>{f.daysPassed||0}/{f.daysInMonth||30}j</span></div>
            <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-gray-900 transition-all" style={{width:`${f.daysInMonth>0?(f.daysPassed/f.daysInMonth*100):0}%`}}/></div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Rythme</SectionTitle>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center text-sm bg-red-50 rounded-lg px-3 py-2"><span className="text-gray-600 font-medium">Dépenses / jour</span><span className="font-bold text-red-500 tabular-nums">{fmtC(f.dailyExpenseRate||0)}</span></div>
            <div className="flex justify-between items-center text-sm bg-emerald-50 rounded-lg px-3 py-2"><span className="text-gray-600 font-medium">Entrées / jour</span><span className="font-bold text-emerald-600 tabular-nums">{fmtC(f.dailyIncomeRate||0)}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-gray-900">{orders.thisMonth||0}</p>
              <p className="text-[10px] text-gray-400 font-medium">Commandes</p>
              {orders.growth!==undefined && <p className={`text-[10px] font-bold ${varColor(orders.growth)}`}>{arr(orders.growth)} {Math.abs(orders.growth)}%</p>}
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-emerald-600 tabular-nums truncate">{fmtC(orders.revenueThisMonth)}</p>
              <p className="text-[10px] text-gray-400 font-medium">CA</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-gray-900">{orders.deliveryRate||0}%</p>
              <p className="text-[10px] text-gray-400 font-medium">Livraison</p>
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
                      <p className="text-[10px] text-gray-600 mb-1">{r.detail}</p>
                      <p className="text-[10px] font-bold text-gray-700">{r.action}</p>
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
                  {['Catégorie','Ce mois','Variation','Projeté'].map((h,idx)=><th key={idx} className={`py-2 text-[10px] text-gray-400 font-bold uppercase ${idx>0?'text-right':'text-left'}`}>{h}</th>)}
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
                  {['Produit','Cmd','CA','Livr.','Profit'].map((h,idx)=><th key={idx} className={`py-2 text-[10px] text-gray-400 font-bold uppercase ${idx>0?'text-right':'text-left'}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {prods.slice(0,8).map((p,idx)=>(
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-2.5">
                        <span className="text-xs text-gray-700 font-medium">{p.name}</span>
                        {p.status && <Badge variant={p.status==='winner'?'warning':p.status==='test'?'info':'default'}>{p.status}</Badge>}
                      </td>
                      <td className="py-2.5 text-right text-xs text-gray-700 font-semibold tabular-nums">{p.orders}</td>
                      <td className="py-2.5 text-right text-xs text-emerald-600 font-semibold tabular-nums">{fmtC(p.revenue)}</td>
                      <td className="py-2.5 text-right text-xs text-gray-500">{p.deliveryRate}%</td>
                      <td className={`py-2.5 text-right text-xs font-bold tabular-nums ${p.estimatedProfit>=0?'text-emerald-600':'text-red-500'}`}>{fmtC(p.estimatedProfit)}</td>
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
                      <p className="text-[10px] opacity-80">{CAT[a.category]||a.category} — {a.percentage}% utilisé — Projeté : {a.projectedPercentage}%</p>
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
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-medium"><span>Sem. {w.week}</span><span className={`font-bold ${w.balance>=0?'text-emerald-600':'text-red-500'}`}>{w.balance>=0?'+':''}{fmtC(w.balance)}</span></div>
                    <div className="flex gap-0.5 h-3">
                      <div className="bg-red-300 rounded-sm" style={{width:`${w.expenses/mx*50}%`}}/>
                      <div className="bg-emerald-400 rounded-sm" style={{width:`${w.income/mx*50}%`}}/>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-4 mt-1 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-300 rounded-sm"/>Dépenses</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-sm"/>Entrées</span>
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
                  {['Mois','Entrées','Dépenses','Marge'].map((h,idx)=><th key={idx} className={`py-2 text-[10px] text-gray-400 font-bold uppercase ${idx>0?'text-right':'text-left'}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {monthly.map((m,idx)=>{
                    const [y,mo]=m.month.split('-');
                    const label=new Date(+y,+mo-1,1).toLocaleDateString('fr-FR',{month:'short',year:'numeric'});
                    const mBal=m.income-m.expenses;
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-2.5 text-gray-700 capitalize font-medium text-xs">{label}</td>
                        <td className="py-2.5 text-right text-emerald-600 font-semibold text-xs tabular-nums">{fmtC(m.income)}</td>
                        <td className="py-2.5 text-right text-red-500 font-semibold text-xs tabular-nums">{fmtC(m.expenses)}</td>
                        <td className={`py-2.5 text-right font-bold text-xs ${mBal>=0?'text-emerald-600':'text-red-500'}`}>{m.margin}%</td>
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
                <p className="text-[10px] text-gray-500 font-medium">{STATUS_LABELS[s.status]||s.status}</p>
                <p className="text-[10px] text-gray-400 tabular-nums">{fmtC(s.revenue)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default TransactionsList;
