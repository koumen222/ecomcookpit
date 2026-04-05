import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const S = {
  delivered: { label:'Livrée',      color:'#10B981', bg:'#ecfdf5', text:'#065f46' },
  confirmed: { label:'Confirmée',   color:'#3B82F6', bg:'#eff6ff', text:'#1e40af' },
  pending:   { label:'En attente',  color:'#F59E0B', bg:'#fffbeb', text:'#92400e' },
  called:    { label:'Appelée',     color:'#8B5CF6', bg:'#f5f3ff', text:'#6b21a8' },
  shipped:   { label:'Expédiée',    color:'#0EA5E9', bg:'#f0f9ff', text:'#0369a1' },
  postponed: { label:'Reportée',    color:'#EC4899', bg:'#fdf2f8', text:'#9d174d' },
  unreachable:{ label:'Injoignable',color:'#94A3B8', bg:'#f8fafc', text:'#475569' },
  returned:  { label:'Retour',      color:'#F97316', bg:'#fff7ed', text:'#9a3412' },
  cancelled: { label:'Annulée',     color:'#EF4444', bg:'#fef2f2', text:'#991b1b' },
};
const ORDER = ['delivered','confirmed','pending','called','shipped','postponed','unreachable','returned','cancelled'];
const PERIODS = [{k:'today',l:"Aujourd'hui"},{k:'week',l:'Semaine'},{k:'month',l:'Mois'},{k:'30days',l:'30j'}];
const GOAL = 80;

const getBadge = r => {
  if(r>=80) return {emoji:'🏆',label:'Champion',color:'#F59E0B'};
  if(r>=60) return {emoji:'🥇',label:'Expert',   color:'#94A3B8'};
  if(r>=40) return {emoji:'🥈',label:'Confirmée',color:'#CD7F32'};
  if(r>=20) return {emoji:'🥉',label:'En progrès',color:'#10B981'};
  return           {emoji:'🌱',label:'Débutante', color:'#6EE7B7'};
};

const SparkLine = ({data,color='#10B981'}) => {
  if(!data||data.length<2) return null;
  const W=400,H=64,p=6;
  const vals=data.map(d=>d.total);
  const max=Math.max(...vals,1);
  const pts=vals.map((v,i)=>[p+(i/(vals.length-1))*(W-p*2), H-p-(v/max)*(H-p*2)]);
  const path=pts.map((pt,i)=>(i===0?`M${pt[0]},${pt[1]}`:`L${pt[0]},${pt[1]}`)).join(' ');
  const area=`${path} L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H} Z`;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{height:64}}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)"/>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r={data[i].isToday?5:2.5}
          fill={data[i].isToday?color:'#fff'} stroke={color} strokeWidth="1.5"/>
      ))}
    </svg>
  );
};

export default function CloseuseDashboard() {
  const {user} = useEcomAuth();
  const {fmt,symbol} = useMoney();
  const [loading,setLoading] = useState(true);
  const [period,setPeriod] = useState('today');
  const [allOrders,setAllOrders] = useState([]);
  const [weekOrders,setWeekOrders] = useState([]);
  const [commissions,setCommissions] = useState(null);
  const [assignment,setAssignment] = useState(null);
  const [stats,setStats] = useState({total:0,delivered:0,confirmed:0,pending:0,called:0,cancelled:0,returned:0,unreachable:0,shipped:0,postponed:0,deliveryRate:0,todayDelivered:0,todayTotal:0,prevWeekDelivered:0,prevWeekTotal:0});

  if(!user?.workspaceId) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-4xl mb-4">🏢</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Aucun espace configuré</h2>
        <Link to="/ecom/workspace-setup" className="inline-block px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold">Créer un espace</Link>
      </div>
    </div>
  );

  useEffect(()=>{load();},[]);

  const load = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const w7 = new Date(Date.now()-7*86400000).toISOString().split('T')[0];
      const w14 = new Date(Date.now()-14*86400000).toISOString().split('T')[0];
      const [r1,r2,r3,r4,r5] = await Promise.all([
        ecomApi.get('/orders?limit=300'),
        ecomApi.get(`/orders?limit=500&startDate=${w7}&endDate=${today}`),
        ecomApi.get(`/orders?limit=500&startDate=${w14}&endDate=${w7}`),
        ecomApi.get('/orders/my-commissions?period=month').catch(()=>null),
        ecomApi.get('/assignments/my').catch(()=>null),
      ]);
      const orders = r1.data.data.orders||[];
      const week = r2.data.data.orders||[];
      const prev = r3.data.data.orders||[];
      setAllOrders(orders); setWeekOrders(week);
      if(r4?.data?.success) setCommissions(r4.data.data);
      if(r5?.data?.success) setAssignment(r5.data.data);
      const cb=(arr,k)=>arr.filter(o=>o.status===k).length;
      const del=cb(orders,'delivered');
      const todayArr=orders.filter(o=>new Date(o.date).toISOString().split('T')[0]===today);
      setStats({
        total:orders.length, delivered:del,
        confirmed:cb(orders,'confirmed'), pending:cb(orders,'pending'),
        called:cb(orders,'called'), cancelled:cb(orders,'cancelled'),
        returned:cb(orders,'returned'), unreachable:cb(orders,'unreachable'),
        shipped:cb(orders,'shipped'), postponed:cb(orders,'postponed'),
        deliveryRate:orders.length>0?Math.round((del/orders.length)*100):0,
        todayDelivered:todayArr.filter(o=>o.status==='delivered').length,
        todayTotal:todayArr.length,
        prevWeekDelivered:cb(prev,'delivered'), prevWeekTotal:prev.length,
      });
    } catch(e){console.error(e);}
    finally{setLoading(false);}
  };

  if(loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-emerald-500 animate-spin"/>
        <p className="text-sm text-gray-400">Chargement…</p>
      </div>
    </div>
  );

  const firstName = user?.name?.split(' ')[0]||user?.email?.split('@')[0]||'toi';
  const badge = getBadge(stats.deliveryRate);
  const prevRate = stats.prevWeekTotal>0?Math.round((stats.prevWeekDelivered/stats.prevWeekTotal)*100):0;
  const delta = stats.deliveryRate-prevRate;
  const rateColor = stats.deliveryRate>=GOAL?'#10B981':stats.deliveryRate>=50?'#F59E0B':'#EF4444';
  const goalPct = Math.min(100,Math.round((stats.deliveryRate/GOAL)*100));

  const today = new Date().toISOString().split('T')[0];
  const periodOrders = (() => {
    if(period==='today') return allOrders.filter(o=>new Date(o.date).toISOString().split('T')[0]===today);
    if(period==='week') return weekOrders;
    const ago = new Date(Date.now()-(period==='30days'?30:30)*86400000).toISOString().split('T')[0];
    return allOrders.filter(o=>new Date(o.date).toISOString().split('T')[0]>=ago);
  })();
  const periodDel = periodOrders.filter(o=>o.status==='delivered').length;
  const periodRate = periodOrders.length>0?Math.round((periodDel/periodOrders.length)*100):0;

  const trend = Array.from({length:7},(_,i)=>{
    const d = new Date(Date.now()-(6-i)*86400000);
    const k = d.toISOString().split('T')[0];
    const day = weekOrders.filter(o=>new Date(o.date).toISOString().split('T')[0]===k);
    return {label:d.toLocaleDateString('fr-FR',{weekday:'short'}),total:day.length,delivered:day.filter(o=>o.status==='delivered').length,isToday:i===6};
  });

  const topProducts = (() => {
    const map={};
    allOrders.filter(o=>o.status==='delivered').forEach(o=>{const n=o.product||'Inconnu';map[n]=(map[n]||0)+1;});
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,4);
  })();

  const recentOrders = allOrders.slice(0,5);

  // Commission display
  const commRate = commissions?.commissionRate ?? assignment?.commission ?? 0;
  const commType = commissions?.commissionType ?? assignment?.commissionType ?? 'fixed';
  const totalComm = commissions?.totalCommission ?? 0;
  const commLabel = commRate>0
    ? (commType==='percentage' ? `${commRate}% du CA` : `${fmt(commRate)} / livraison`)
    : 'Non configurée';

  return (
    <div className="min-h-screen" style={{background:'#F8FAFC'}}>
      <div style={{maxWidth:860,margin:'0 auto',padding:'20px 16px 40px'}}>

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mb-1">
              {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
            </p>
            <h1 className="text-2xl font-black text-gray-900">Bonjour {firstName} 👋</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {period==='today'?"Aujourd'hui":period==='week'?'Cette semaine':period==='30days'?'30 derniers jours':'Ce mois'}
            </p>
          </div>
          {/* Badge niveau */}
          <div className="flex flex-col items-center bg-white border border-gray-100 rounded-2xl px-3 py-2 shadow-sm flex-shrink-0">
            <span className="text-2xl">{badge.emoji}</span>
            <span className="text-[10px] font-bold text-gray-600 mt-0.5">{badge.label}</span>
          </div>
        </div>

        {/* ── PERIOD TABS ── */}
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 mb-5 shadow-sm w-fit">
          {PERIODS.map(p=>(
            <button key={p.k} onClick={()=>setPeriod(p.k)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${period===p.k?'bg-emerald-600 text-white shadow':'text-gray-500 hover:text-gray-700'}`}>
              {p.l}
            </button>
          ))}
        </div>

        {/* ── HERO STATS ROW ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {/* Commandes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Commandes</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
            </div>
            <p className="text-3xl font-black text-gray-900 leading-none">{periodOrders.length}</p>
            <p className="text-xs text-gray-400 mt-1">{periodDel} livrées</p>
          </div>

          {/* Taux */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Taux</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:`${rateColor}18`}}>
                <svg className="w-4 h-4" style={{color:rateColor}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>
            <p className="text-3xl font-black leading-none" style={{color:rateColor}}>{periodRate}%</p>
            <p className="text-xs text-gray-400 mt-1">objectif {GOAL}%</p>
          </div>

          {/* Commission */}
          <div className="col-span-2 sm:col-span-1 rounded-2xl border shadow-sm p-4 relative overflow-hidden" style={{background:'linear-gradient(135deg,#065f46 0%,#047857 100%)',borderColor:'#047857'}}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wide">Commission</span>
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>
            <p className="text-2xl font-black text-white leading-none">{fmt(totalComm)}</p>
            <p className="text-xs text-emerald-300 mt-1">{commLabel}</p>
            <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/5"/>
          </div>

          {/* Aujourd'hui */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Aujourd'hui</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
            </div>
            <p className="text-3xl font-black text-gray-900 leading-none">{stats.todayDelivered}</p>
            <p className="text-xs text-gray-400 mt-1">/ {stats.todayTotal} reçues</p>
          </div>
        </div>

        {/* ── OBJECTIF PROGRESS ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Progression objectif</h3>
              <p className="text-xs text-gray-400">Objectif livraison : {GOAL}%</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black leading-none" style={{color:rateColor}}>{stats.deliveryRate}%</p>
              {delta!==0&&(
                <p className={`text-[11px] font-semibold mt-0.5 ${delta>0?'text-emerald-600':'text-red-400'}`}>
                  {delta>0?'↑':'↓'} {Math.abs(delta)}% vs sem. passée
                </p>
              )}
            </div>
          </div>
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
            <div className="absolute inset-0 h-full rounded-full transition-all duration-700"
              style={{width:`${stats.deliveryRate}%`,background:`linear-gradient(90deg,${rateColor}88,${rateColor})`}}/>
            <div className="absolute top-0 h-full w-0.5 bg-gray-400/60" style={{left:`${GOAL}%`}}/>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0%</span>
            <span className="font-semibold text-gray-500">🎯 {GOAL}%</span>
            <span>100%</span>
          </div>
        </div>

        {/* ── SPARKLINE ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-800">Activité 7 jours</h3>
            <span className="text-xs text-gray-400">{weekOrders.filter(o=>o.status==='delivered').length} livrées</span>
          </div>
          <SparkLine data={trend} color="#10B981"/>
          <div className="flex justify-between mt-1.5">
            {trend.map((d,i)=>(
              <div key={i} className="flex flex-col items-center flex-1">
                <span className={`text-[10px] font-medium capitalize ${d.isToday?'text-emerald-600 font-bold':'text-gray-400'}`}>{d.label}</span>
                <span className={`text-[10px] font-black ${d.isToday?'text-emerald-600':'text-gray-500'}`}>{d.total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── STATUTS + TOP PRODUITS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

          {/* Statuts */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Répartition statuts</h3>
            <div className="space-y-2.5">
              {ORDER.filter(s=>(stats[s]||0)>0).map(s=>{
                const meta=S[s];
                const count=stats[s]||0;
                const pct=stats.total>0?Math.round((count/stats.total)*100):0;
                return(
                  <div key={s} className="flex items-center gap-2.5">
                    <span className="text-[11px] font-semibold w-20 flex-shrink-0 truncate" style={{color:meta.text}}>{meta.label}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${pct}%`,background:meta.color}}/>
                    </div>
                    <span className="text-xs font-black text-gray-700 w-5 text-right">{count}</span>
                  </div>
                );
              })}
              {ORDER.every(s=>!(stats[s]||0))&&(
                <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p>
              )}
            </div>
          </div>

          {/* Top produits */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">🏅 Top produits</h3>
            {topProducts.length===0?(
              <p className="text-sm text-gray-400 text-center py-4">Aucune livraison</p>
            ):(
              <div className="space-y-3">
                {topProducts.map(([name,count],i)=>{
                  const max=topProducts[0]?.[1]||1;
                  const medals=['🥇','🥈','🥉','4.'];
                  return(
                    <div key={name} className="flex items-center gap-2.5">
                      <span className="text-sm w-5 flex-shrink-0 text-center">{medals[i]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate mb-1">{name}</p>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{width:`${(count/max)*100}%`}}/>
                        </div>
                      </div>
                      <span className="text-xs font-black text-emerald-600 flex-shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── COMMANDES RÉCENTES ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">Commandes récentes</h3>
            <Link to="/ecom/orders" className="text-xs text-emerald-600 font-semibold hover:text-emerald-700">Voir tout →</Link>
          </div>
          {recentOrders.length===0?(
            <p className="text-sm text-gray-400 text-center py-6">Aucune commande</p>
          ):(
            <div className="space-y-1">
              {recentOrders.map(order=>{
                const meta=S[order.status]||{bg:'#f8fafc',text:'#475569',label:order.status};
                return(
                  <div key={order._id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                      style={{background:meta.bg,color:meta.text}}>
                      {(order.clientName||order.clientPhone||'?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate leading-tight">{order.clientName||order.clientPhone||'—'}</p>
                      <p className="text-xs text-gray-400 truncate">{order.product||'—'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{background:meta.bg,color:meta.text}}>{meta.label}</span>
                      {order.price>0&&<span className="text-xs text-gray-400 font-medium">{fmt(order.price)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── QUICK ACTIONS ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {to:'/ecom/orders',emoji:'📦',label:'Commandes',sub:'Gérer',color:'#0A5740'},
            {to:'/ecom/commissions',emoji:'💰',label:'Commissions',sub:'Mes gains',color:'#D97706'},
            {to:'/ecom/reports/new',emoji:'📝',label:'Rapport',sub:'Saisir',color:'#7C3AED'},
          ].map(({to,emoji,label,sub,color})=>(
            <Link key={to} to={to}
              className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-0.5"
                style={{background:`${color}12`}}>
                {emoji}
              </div>
              <p className="text-xs font-bold text-gray-900">{label}</p>
              <p className="text-[10px] text-gray-400">{sub}</p>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
