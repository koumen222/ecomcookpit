import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const STATUS_LABELS = {
  pending:'En attente',confirmed:'Confirmée',shipped:'Expédiée',
  delivered:'Livrée',returned:'Retour',cancelled:'Annulée',
  unreachable:'Injoignable',called:'Appelée',postponed:'Reportée',
};
const STATUS_META = {
  delivered:{color:'#10B981',bg:'#ecfdf5',text:'#065f46'},
  confirmed:{color:'#0A5740',bg:'#eff6ff',text:'#053326'},
  pending:{color:'#F59E0B',bg:'#fffbeb',text:'#92400e'},
  shipped:{color:'#0F6B4F',bg:'#eef2ff',text:'#3730a3'},
  called:{color:'#14855F',bg:'#faf5ff',text:'#6b21a8'},
  postponed:{color:'#ec4899',bg:'#fdf2f8',text:'#9d174d'},
  unreachable:{color:'#94a3b8',bg:'#f8fafc',text:'#475569'},
  returned:{color:'#f97316',bg:'#fff7ed',text:'#9a3412'},
  cancelled:{color:'#EF4444',bg:'#fef2f2',text:'#991b1b'},
};
const STATUS_ORDER=['delivered','confirmed','pending','shipped','called','postponed','unreachable','returned','cancelled'];
const PERIODS=[{key:'today',label:"Aujourd'hui"},{key:'week',label:'Semaine'},{key:'month',label:'Mois'},{key:'30days',label:'30 jours'}];
const GOAL=80;

const getBadge=(rate)=>{
  if(rate>=80)return{emoji:'🏆',label:'Champion',streak:true};
  if(rate>=60)return{emoji:'🥇',label:'Expert',streak:true};
  if(rate>=40)return{emoji:'🥈',label:'Confirmée',streak:false};
  if(rate>=20)return{emoji:'🥉',label:'En progression',streak:false};
  return{emoji:'🌱',label:'Débutante',streak:false};
};

const NoWorkspace=({user})=>(
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="max-w-sm w-full text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-600 flex items-center justify-center mx-auto mb-5 text-3xl">🏢</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Aucun espace configuré</h2>
      <p className="text-sm text-gray-500 mb-6">{user?.role==='ecom_admin'?'Créez votre espace pour commencer.':'Rejoignez une équipe existante.'}</p>
      <Link to="/ecom/workspace-setup" className="block py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition">Créer un espace</Link>
    </div>
  </div>
);

const Loader=()=>(
  <div className="flex flex-col items-center justify-center h-64 gap-4">
    <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-emerald-600 animate-spin"/>
    <p className="text-sm text-gray-400 font-medium">Chargement du dashboard…</p>
  </div>
);

const SparkLine=({data,color='#0A5740'})=>{
  const W=420,H=80,pad=8;
  if(!data||data.length<2)return null;
  const vals=data.map(d=>d.total);
  const max=Math.max(...vals,1);
  const pts=vals.map((v,i)=>{
    const x=pad+(i/(vals.length-1))*(W-pad*2);
    const y=H-pad-(v/max)*(H-pad*2);
    return[x,y];
  });
  const path=pts.map((p,i)=>(i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`)).join(' ');
  const area=`${path} L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H} Z`;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{height:80}}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)"/>
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r={data[i].isToday?5:3} fill={data[i].isToday?color:'#fff'} stroke={color} strokeWidth="2"/>
      ))}
    </svg>
  );
};

const CloseuseDashboard=()=>{
  const{user}=useEcomAuth();
  const{fmt}=useMoney();
  const[loading,setLoading]=useState(true);
  const[period,setPeriod]=useState('today');
  const[recentOrders,setRecentOrders]=useState([]);
  const[allOrders,setAllOrders]=useState([]);
  const[weekOrders,setWeekOrders]=useState([]);
  const[commissions,setCommissions]=useState(null);
  const[stats,setStats]=useState({
    total:0,delivered:0,confirmed:0,pending:0,cancelled:0,returned:0,
    unreachable:0,called:0,postponed:0,shipped:0,deliveryRate:0,
    todayDelivered:0,todayTotal:0,prevWeekDelivered:0,prevWeekTotal:0,
  });

  if(!user?.workspaceId)return<NoWorkspace user={user}/>;

  useEffect(()=>{loadData();},[]);

  const loadData=async()=>{
    try{
      setLoading(true);
      const today=new Date().toISOString().split('T')[0];
      const weekAgo=new Date(Date.now()-7*86400000).toISOString().split('T')[0];
      const twoWeeks=new Date(Date.now()-14*86400000).toISOString().split('T')[0];
      const[r1,r2,r3,r4]=await Promise.all([
        ecomApi.get('/orders?limit=200'),
        ecomApi.get(`/orders?limit=500&startDate=${weekAgo}&endDate=${today}`),
        ecomApi.get(`/orders?limit=500&startDate=${twoWeeks}&endDate=${weekAgo}`),
        ecomApi.get('/orders/my-commissions?period=month').catch(()=>null),
      ]);
      const orders=r1.data.data.orders||[];
      const week=r2.data.data.orders||[];
      const prev=r3.data.data.orders||[];
      setAllOrders(orders);setWeekOrders(week);setRecentOrders(orders.slice(0,8));
      if(r4?.data?.success) setCommissions(r4.data.data);
      const cb=(arr,k)=>arr.filter(o=>o.status===k).length;
      const total=orders.length,delivered=cb(orders,'delivered');
      const todayArr=orders.filter(o=>new Date(o.date).toISOString().split('T')[0]===today);
      setStats({
        total,delivered,confirmed:cb(orders,'confirmed'),pending:cb(orders,'pending'),
        cancelled:cb(orders,'cancelled'),returned:cb(orders,'returned'),unreachable:cb(orders,'unreachable'),
        called:cb(orders,'called'),postponed:cb(orders,'postponed'),shipped:cb(orders,'shipped'),
        deliveryRate:total>0?Math.round((delivered/total)*100):0,
        todayDelivered:todayArr.filter(o=>o.status==='delivered').length,
        todayTotal:todayArr.length,
        prevWeekDelivered:cb(prev,'delivered'),prevWeekTotal:prev.length,
      });
    }catch(e){console.error(e);}finally{setLoading(false);}
  };

  const buildTrend=()=>Array.from({length:7},(_,i)=>{
    const d=new Date(Date.now()-(6-i)*86400000);
    const key=d.toISOString().split('T')[0];
    const label=d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'});
    const day=weekOrders.filter(o=>new Date(o.date).toISOString().split('T')[0]===key);
    return{label,total:day.length,delivered:day.filter(o=>o.status==='delivered').length,isToday:i===6};
  });

  const buildTop=()=>{
    const map={};
    allOrders.filter(o=>o.status==='delivered').forEach(o=>{const n=o.product||'Inconnu';map[n]=(map[n]||0)+1;});
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
  };

  if(loading)return<Loader/>;

  const badge=getBadge(stats.deliveryRate);
  const trend=buildTrend();
  const top=buildTop();
  const maxTop=top[0]?.[1]||1;
  const firstName=user?.name?.split(' ')[0]||user?.email?.split('@')[0]||'vous';
  const prevRate=stats.prevWeekTotal>0?Math.round((stats.prevWeekDelivered/stats.prevWeekTotal)*100):0;
  const delta=stats.deliveryRate-prevRate;
  const goalPct=Math.min(100,Math.round((stats.deliveryRate/GOAL)*100));
  const rateColor=stats.deliveryRate>=GOAL?'#10B981':stats.deliveryRate>=50?'#F59E0B':'#EF4444';

  const periodStats=(()=>{
    const today=new Date().toISOString().split('T')[0];
    if(period==='today'){const a=allOrders.filter(o=>new Date(o.date).toISOString().split('T')[0]===today);return{total:a.length,delivered:a.filter(o=>o.status==='delivered').length};}
    if(period==='week')return{total:weekOrders.length,delivered:weekOrders.filter(o=>o.status==='delivered').length};
    if(period==='30days'){const ago=new Date(Date.now()-30*86400000).toISOString().split('T')[0];const a=allOrders.filter(o=>new Date(o.date).toISOString().split('T')[0]>=ago);return{total:a.length,delivered:a.filter(o=>o.status==='delivered').length};}
    const ago=new Date(Date.now()-30*86400000).toISOString().split('T')[0];
    const a=allOrders.filter(o=>new Date(o.date).toISOString().split('T')[0]>=ago);
    return{total:a.length,delivered:a.filter(o=>o.status==='delivered').length};
  })();

  const kpis=[
    {label:'Commandes totales',value:periodStats.total,sub:'dans la période',iconBg:'#eff6ff',iconColor:'#0A5740',
      icon:<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>},
    {label:'Livrées',value:periodStats.delivered,sub:`Taux ${periodStats.total>0?Math.round((periodStats.delivered/periodStats.total)*100):0}%`,iconBg:'#ecfdf5',iconColor:'#10B981',
      icon:<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>},
    {label:'Commissions',value:commissions?fmt(commissions.totalCommission||0):'—',sub:commissions?`${commissions.deliveredCount||0} livrées`:'Ce mois',iconBg:'#fffbeb',iconColor:'#F59E0B',
      icon:<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>},
    {label:"Aujourd'hui",value:stats.todayDelivered,sub:`/ ${stats.todayTotal} reçues`,iconBg:'#faf5ff',iconColor:'#0F6B4F',
      icon:<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>},
    {label:'En attente',value:stats.pending,sub:'à traiter',iconBg:'#fff7ed',iconColor:'#ea580c',
      icon:<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>},
  ];

  const actions=[
    {to:'/ecom/orders',emoji:'📦',label:'Mes commandes',sub:'Gérer le statut',accent:'#0A5740'},
    {to:'/ecom/reports/new',emoji:'📝',label:'Rapport du jour',sub:'Saisir mes résultats',accent:'#10B981'},
    {to:'/ecom/campaigns',emoji:'📣',label:'Campagnes',sub:'Marketing & pub',accent:'#ec4899'},
  ];

  return(
    <div className="min-h-screen bg-gray-50">
      <div style={{maxWidth:900,margin:'0 auto',padding:'24px 16px'}}>

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wide">
              {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
            </p>
            <h1 className="text-2xl font-extrabold text-gray-900">Bonjour {firstName} 👋</h1>
            <p className="text-sm text-gray-500 mt-1">Voici vos performances {period==='today'?"aujourd'hui":period==='week'?'cette semaine':period==='30days'?'30 derniers jours':'ce mois'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
              {PERIODS.map(p=>(
                <button key={p.key} onClick={()=>setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period===p.key?'bg-emerald-600 text-white shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <span className="text-xl">{badge.emoji}</span>
              <div>
                <p className="text-xs font-bold text-gray-800 leading-none">{badge.label}</p>
                {badge.streak&&<p className="text-[10px] text-orange-500 font-semibold mt-0.5">🔥 En série</p>}
              </div>
            </div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          {kpis.map((k,i)=>(
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide leading-none">{k.label}</p>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:k.iconBg,color:k.iconColor}}>{k.icon}</div>
              </div>
              <p className="text-3xl font-black text-gray-900 leading-none mb-1">{k.value}</p>
              <p className="text-xs text-gray-400">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* DELIVERY RATE */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Taux de livraison global</h3>
              <p className="text-xs text-gray-400 mt-0.5">Objectif : {GOAL}%</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black leading-none" style={{color:rateColor}}>{stats.deliveryRate}%</p>
              {delta!==0&&(
                <p className={`text-xs font-semibold mt-0.5 ${delta>0?'text-emerald-600':'text-red-500'}`}>
                  {delta>0?'▲':'▼'} {Math.abs(delta)}% vs sem. passée
                </p>
              )}
            </div>
          </div>
          <div className="relative mb-1">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{width:`${stats.deliveryRate}%`,background:rateColor}}/>
            </div>
            <div className="absolute top-0 h-full flex items-center" style={{left:`${GOAL}%`,transform:'translateX(-50%)'}}>
              <div className="w-0.5 h-4 bg-gray-400 rounded-full -mt-1"/>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-4">
            <span>0%</span><span className="font-semibold text-gray-500">Objectif {GOAL}%</span><span>100%</span>
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-xl ${goalPct>=100?'bg-emerald-50':'bg-gray-50'}`}>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-600">Progression vers l'objectif</p>
              <div className="h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{width:`${goalPct}%`,background:goalPct>=100?'#10B981':'#0A5740'}}/>
              </div>
            </div>
            <p className="text-sm font-black" style={{color:goalPct>=100?'#10B981':'#0A5740'}}>{goalPct}%</p>
            {goalPct>=100&&<span className="text-lg">🎯</span>}
          </div>
        </div>

        {/* STATUS BREAKDOWN */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Répartition par statut</h3>
          <div className="space-y-3">
            {STATUS_ORDER.filter(s=>(stats[s]||0)>0).map(s=>{
              const count=stats[s]||0;
              const pct=stats.total>0?Math.round((count/stats.total)*100):0;
              const meta=STATUS_META[s]||{color:'#94a3b8',bg:'#f8fafc',text:'#475569'};
              return(
                <div key={s} className="flex items-center gap-3">
                  <span className="text-xs font-semibold w-24 flex-shrink-0" style={{color:meta.text}}>{STATUS_LABELS[s]}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:meta.color}}/>
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-6 text-right">{count}</span>
                  <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
            {STATUS_ORDER.every(s=>!(stats[s]||0))&&<p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p>}
          </div>
        </div>

        {/* 7-DAY CHART */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">Activité  7 derniers jours</h3>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"/>Total</span>
            </div>
          </div>
          <SparkLine data={trend} color="#0A5740"/>
          <div className="flex justify-between mt-2 px-1">
            {trend.map((d,i)=>(
              <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                <span className={`text-[10px] font-medium ${d.isToday?'text-emerald-600 font-bold':'text-gray-400'}`}>{d.label}</span>
                <span className={`text-[10px] font-bold ${d.isToday?'text-emerald-600':'text-gray-500'}`}>{d.total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TOP PRODUCTS + RECENT ORDERS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">🏅 Top produits livrés</h3>
            {top.length===0?(
              <p className="text-sm text-gray-400 text-center py-6">Aucune livraison encore</p>
            ):(
              <div className="space-y-3">
                {top.map(([name,count],i)=>{
                  const medals=['🥇','🥈','🥉'];
                  return(
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-base w-5 text-center flex-shrink-0">{medals[i]||`${i+1}.`}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate mb-1">{name}</p>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{width:`${(count/maxTop)*100}%`}}/>
                        </div>
                      </div>
                      <span className="text-xs font-black text-emerald-600 flex-shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">Commandes récentes</h3>
              <Link to="/ecom/orders" className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 transition">Voir tout </Link>
            </div>
            {recentOrders.length===0?(
              <p className="text-sm text-gray-400 text-center py-6">Aucune commande</p>
            ):(
              <div className="space-y-1">
                {recentOrders.slice(0,6).map(order=>{
                  const meta=STATUS_META[order.status]||{bg:'#f8fafc',text:'#475569'};
                  return(
                    <div key={order._id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate leading-tight">{order.clientName||order.clientPhone||''}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{order.product||''}</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{background:meta.bg,color:meta.text}}>
                        {STATUS_LABELS[order.status]||order.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              to:'/ecom/orders',
              icon:<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
              label:'Mes commandes',
              sub:'Gérer le statut',
              accent:'#0A5740'
            },
            {
              to:'/ecom/commissions',
              icon:<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
              label:'Mes commissions',
              sub:'Voir mes gains',
              accent:'#F59E0B'
            },
            {
              to:'/ecom/reports/new',
              icon:<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
              label:'Rapport du jour',
              sub:'Saisir mes résultats',
              accent:'#10B981'
            },
          ].map(({to,icon,label,sub,accent})=>(
            <Link key={to} to={to}
              className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:`${accent}15`,color:accent}}>
                {icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
};

export default CloseuseDashboard;
