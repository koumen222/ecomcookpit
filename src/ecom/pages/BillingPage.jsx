import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { getCurrentPlan, createCheckout, getPaymentStatus, getPaymentHistory, activateTrial } from '../services/billingApi.js';
import { Package, Bot, Zap, Clock, CheckCircle2, CalendarDays, CreditCard, Shield, RefreshCw, MessageCircle, AlertTriangle, Lock, Gift, Globe } from 'lucide-react';

// ─── Country phone codes ────────────────────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: '+237', flag: '🇨🇲', country: 'Cameroun' },
  { code: '+221', flag: '🇸🇳', country: 'Sénégal' },
  { code: '+225', flag: '🇨🇮', country: "Côte d'Ivoire" },
  { code: '+223', flag: '🇲🇱', country: 'Mali' },
  { code: '+226', flag: '🇧🇫', country: 'Burkina Faso' },
  { code: '+229', flag: '🇧🇯', country: 'Bénin' },
  { code: '+228', flag: '🇹🇬', country: 'Togo' },
  { code: '+227', flag: '🇳🇪', country: 'Niger' },
  { code: '+224', flag: '🇬🇳', country: 'Guinée' },
  { code: '+234', flag: '🇳🇬', country: 'Nigeria' },
  { code: '+233', flag: '🇬🇭', country: 'Ghana' },
  { code: '+231', flag: '🇱🇷', country: 'Liberia' },
  { code: '+33',  flag: '🇫🇷', country: 'France' },
  { code: '+32',  flag: '🇧🇪', country: 'Belgique' },
  { code: '+41',  flag: '🇨🇭', country: 'Suisse' },
  { code: '+1',   flag: '🇨🇦', country: 'Canada' },
  { code: '+1',   flag: '🇺🇸', country: 'États-Unis' },
];

// ─── Plan definitions ───────────────────────────────────────────────────────────────────────
const PLAN_TIERS = [
  {
    id: 'free',
    name: 'Gratuit',
    tagline: 'Démarrez sans frais',
    icon: <Gift className="w-full h-full" />,
    gradient: 'from-gray-400 to-gray-500',
    accent: 'gray',
    ring: 'ring-gray-300/20',
    btnClass: 'bg-gray-600 hover:bg-gray-700 shadow-gray-500/25',
    free: true,
    features: [
      { text: '50 commandes / mois', included: true },
      { text: '50 clients max', included: true },
      { text: '10 produits max', included: true },
      { text: 'Tableau de bord basique', included: true },
      { text: '1 boutique en ligne', included: true },
      { text: '1 utilisateur', included: true },
      { text: 'Agent IA WhatsApp', included: false },
      { text: 'Génération de pages IA', included: false },
      { text: 'Support prioritaire', included: false },
    ],
    durations: [
      { id: 'free', label: 'Gratuit', price: 0, months: 1, saving: null, perMonth: 0 },
    ],
  },
  {
    id: 'starter',
    name: 'Scalor',
    tagline: 'Gestion complète de vos commandes',
    icon: <Package className="w-full h-full" />,
    gradient: 'from-emerald-500 to-teal-600',
    accent: 'emerald',
    ring: 'ring-emerald-500/20',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25',
    features: [
      { text: 'Commandes illimitées', included: true },
      { text: 'Gestion clients complète', included: true },
      { text: 'Catalogue produits illimité', included: true },
      { text: 'Tableau de bord analytique', included: true },
      { text: 'Boutique en ligne personnalisée', included: true },
      { text: 'Notifications & suivi livraisons', included: true },
      { text: 'Agent IA WhatsApp', included: false },
      { text: 'Génération de pages IA', included: false },
    ],
    durations: [
      { id: 'starter_1',  label: 'Mensuel',  price: 5000,   months: 1,  saving: null, perMonth: 5000 },
      { id: 'starter_12', label: 'Annuel',   price: 45000,  months: 12, saving: 25,   perMonth: 3750 },
    ],
  },
  {
    id: 'pro',
    name: 'Scalor + IA',
    tagline: 'Vendez automatiquement sur WhatsApp',
    icon: <Bot className="w-full h-full" />,
    gradient: 'from-blue-600 to-indigo-700',
    accent: 'blue',
    ring: 'ring-blue-500/20',
    btnClass: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25',
    popular: true,
    features: [
      { text: 'Tout Scalor inclus', included: true },
      { text: '1 agent IA commercial WhatsApp', included: true, highlight: true },
      { text: '1 numéro WhatsApp connecté', included: true, highlight: true },
      { text: '1 000 messages / jour', included: true },
      { text: '50 000 messages / mois', included: true },
      { text: 'Réponses automatiques 24h/7j', included: true },
      { text: 'Support prioritaire', included: true },
      { text: 'Génération de pages IA', included: false },
    ],
    durations: [
      { id: 'pro_1',  label: 'Mensuel',  price: 10000, months: 1,  saving: null, perMonth: 10000 },
      { id: 'pro_12', label: 'Annuel',   price: 90000, months: 12, saving: 25,   perMonth: 7500 },
    ],
  },
  {
    id: 'ultra',
    name: 'Scalor IA Pro',
    tagline: 'La puissance maximale pour scaler',
    icon: <Zap className="w-full h-full" />,
    gradient: 'from-slate-800 to-slate-950',
    accent: 'slate',
    ring: 'ring-slate-500/20',
    btnClass: 'bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-slate-950 shadow-slate-500/25',
    features: [
      { text: 'Tout Scalor + IA inclus', included: true },
      { text: '5 agents IA actifs simultanés', included: true, highlight: true },
      { text: '5 numéros WhatsApp connectés', included: true, highlight: true },
      { text: 'Messages illimités', included: true, highlight: true },
      { text: '10 crédits page produit IA / mois', included: true, highlight: true },
      { text: 'Gestion multi-boutiques', included: true },
      { text: 'Support 24/7 dédié', included: true },
      { text: 'API & webhooks', included: true },
    ],
    durations: [
      { id: 'ultra_1',  label: 'Mensuel',  price: 15000,  months: 1,  saving: null, perMonth: 15000 },
      { id: 'ultra_12', label: 'Annuel',   price: 140000, months: 12, saving: 22,   perMonth: 11667 },
    ],
  },
];

const ALL_PLANS = PLAN_TIERS.flatMap(tier =>
  tier.durations.map(d => ({ ...d, tier: tier.id }))
);

// Helpers
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function formatAmount(n) {
  return new Intl.NumberFormat('fr-FR').format(n);
}
function daysLeft(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / 86400000));
}

// SVG icons
const CheckIcon = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const XIcon = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const ArrowLeftIcon = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

// CheckoutModal
function CheckoutModal({ plan, tier, onClose, onSuccess, workspaceId, userName, userCountry }) {
  const [country, setCountry] = useState(
    COUNTRY_CODES.find(c => c.country === userCountry) ? userCountry : 'Cameroun'
  );
  const [phoneLocal, setPhoneLocal] = useState('');
  const [clientName, setClientName] = useState(userName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedCode = COUNTRY_CODES.find(c => c.country === country);
  const dialCode = selectedCode?.code || '+237';
  const flag = selectedCode?.flag || '🌍'; // flags stay as emoji (country flags)
  const fullPhone = phoneLocal ? `${dialCode}${phoneLocal.replace(/^0+/, '')}` : '';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!clientName.trim() || clientName.trim().length < 2) { setError('Nom complet requis (min. 2 caractères).'); return; }
    if (!phoneLocal.trim() || phoneLocal.trim().length < 7) { setError('Numéro valide requis (min. 7 chiffres).'); return; }

    setLoading(true);
    try {
      const result = await createCheckout({ plan: plan.id, phone: fullPhone, clientName: clientName.trim(), workspaceId });
      if (!result.success) { setError(result.message || "Erreur lors de l'initialisation."); setLoading(false); return; }
      if (result.paymentUrl) { onSuccess(result.mfToken); window.location.href = result.paymentUrl; }
      else { setError('URL de paiement manquante.'); setLoading(false); }
    } catch (err) {
      setError(err?.response?.data?.message || 'Une erreur est survenue.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className={`bg-gradient-to-br ${tier.gradient} px-6 pt-6 pb-7 text-white relative`}>
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition">
            <XIcon />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center p-2.5">{tier.icon}</div>
            <div>
              <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest">Abonnement</p>
              <h2 className="text-lg font-black">{tier.name} — {plan.label}</h2>
            </div>
          </div>
          <div className="bg-white/15 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs">Total à payer</p>
              <div className="flex items-baseline gap-2">
                {plan.oldPrice && <span className="text-lg text-white/40 line-through">{formatAmount(plan.oldPrice)}</span>}
                <p className="text-2xl font-black">{formatAmount(plan.price)} FCFA</p>
              </div>
              {plan.saving && <p className="text-white/60 text-xs mt-0.5">Soit {formatAmount(plan.perMonth)} FCFA/mois · -{plan.saving}%</p>}
            </div>
            {plan.oldPrice && <div className="bg-red-500 text-white font-black text-xs px-2.5 py-1 rounded-full shadow">PROMO</div>}
            {!plan.oldPrice && plan.saving && <div className="bg-white text-orange-600 font-black text-sm px-3 py-1 rounded-full shadow">-{plan.saving}%</div>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nom complet</label>
            <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Votre nom"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition bg-gray-50/50" required />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Numéro Mobile Money</label>
            <select value={country} onChange={e => setCountry(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition bg-gray-50/50 mb-2 appearance-none">
              {COUNTRY_CODES.map((c, i) => <option key={i} value={c.country}>{c.flag} {c.country} ({c.code})</option>)}
            </select>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-bold text-gray-600 flex-shrink-0">
                <span>{flag}</span><span>{dialCode}</span>
              </div>
              <input type="tel" inputMode="numeric" value={phoneLocal} onChange={e => setPhoneLocal(e.target.value.replace(/\D/g, ''))}
                placeholder="6 XX XX XX XX" className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition bg-gray-50/50" required />
            </div>
            {fullPhone && <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1"><CheckIcon className="w-3.5 h-3.5" /> {fullPhone}</p>}
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />{error}
            </div>
          )}
          <button type="submit" disabled={loading || !phoneLocal || !clientName}
            className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${tier.btnClass}`}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Redirection…
              </span>
            ) : `Payer ${formatAmount(plan.price)} FCFA`}
          </button>
          <div className="flex items-center justify-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Paiement sécurisé</span><span>·</span><span>Activation instantanée</span><span>·</span><span>MoneyFusion</span>
          </div>
        </form>
      </div>
    </div>
  );
}

// PlanCard
function PlanCard({ tier, isAnnual, onCheckout, currentPlan, isActive }) {
  const duration = tier.free ? tier.durations[0] : (isAnnual ? tier.durations[1] : tier.durations[0]);
  const isCurrentPlan = tier.free ? (currentPlan === 'free' || (!isActive && !['starter','pro','ultra'].includes(currentPlan))) : (currentPlan === tier.id && isActive);

  return (
    <div className={`relative flex flex-col rounded-2xl border transition-all duration-300 bg-white overflow-hidden h-full
      ${tier.popular ? 'border-blue-200 shadow-xl shadow-blue-500/10 ring-1 ring-blue-100' : 'border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300'}`}>

      {tier.popular && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center py-1.5 text-[11px] font-bold uppercase tracking-widest">
          Le plus populaire
        </div>
      )}

      <div className="p-6 pb-0 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 text-gray-700">{tier.icon}</span>
              <h3 className="text-lg font-black text-gray-900">{tier.name}</h3>
            </div>
            <p className="text-sm text-gray-500">{tier.tagline}</p>
          </div>
        </div>

        <div className="mb-6">
          {tier.free ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-gray-900">0</span>
                <span className="text-sm font-medium text-gray-400">FCFA</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Pour toujours, avec des limites</p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                {duration.oldPrice && (
                  <span className="text-lg font-bold text-gray-300 line-through">{formatAmount(isAnnual ? Math.round(duration.oldPrice / duration.months) : duration.oldPrice)}</span>
                )}
                <span className="text-4xl font-black text-gray-900">{formatAmount(duration.perMonth)}</span>
                <span className="text-sm font-medium text-gray-400">FCFA/mois</span>
              </div>
              {duration.oldPrice && (
                <p className="text-xs text-red-500 font-bold mt-1">🔥 Offre valable 24h — prix réduit !</p>
              )}
              {isAnnual && duration.saving && (
                <p className="text-xs text-emerald-600 font-semibold mt-1">
                  {formatAmount(duration.price)} FCFA/an · Économisez {duration.saving}%
                </p>
              )}
              {!isAnnual && <p className="text-xs text-gray-400 mt-1">Facturation mensuelle, sans engagement</p>}
            </>
          )}
        </div>

        <div className="space-y-2.5 pb-6">
          {tier.features.map((f, i) => (
            <div key={i} className={`flex items-start gap-2.5 text-[13px] ${f.included ? (f.highlight ? 'text-gray-900 font-semibold' : 'text-gray-600') : 'text-gray-300'}`}>
              {f.included
                ? <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-px ${f.highlight ? 'bg-blue-100' : 'bg-gray-100'}`}><CheckIcon className={`w-3 h-3 ${f.highlight ? 'text-blue-600' : 'text-gray-500'}`} /></div>
                : <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-px bg-gray-50"><XIcon className="w-3 h-3 text-gray-300" /></div>
              }
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 pt-0">
        {isCurrentPlan ? (
          <div className="w-full py-3 rounded-xl text-center text-sm font-bold text-gray-400 bg-gray-100 border border-gray-200">
            Plan actuel
          </div>
        ) : tier.free ? (
          <div className="w-full py-3 rounded-xl text-center text-sm font-bold text-gray-500 bg-gray-50 border border-gray-200">
            Plan de base
          </div>
        ) : (
          <button onClick={() => onCheckout(duration)}
            className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-all shadow-lg hover:shadow-xl active:scale-[0.98] ${tier.btnClass}`}>
            Commencer avec {tier.name}
          </button>
        )}
      </div>
    </div>
  );
}

// StatusBadge
function StatusBadge({ status }) {
  const cfg = {
    paid:      { label: 'Payé',       cls: 'bg-emerald-50 text-emerald-700' },
    pending:   { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
    failure:   { label: 'Échoué',     cls: 'bg-red-50 text-red-700' },
    'no paid': { label: 'Non payé',   cls: 'bg-gray-100 text-gray-600' },
  }[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${cfg.cls}`}>{cfg.label}</span>;
}

// Main BillingPage
export default function BillingPage() {
  const { user } = useEcomAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
  const workspaceId = workspace?._id || workspace?.id;
  const userCountry = workspace?.country || 'Cameroun';

  const [planInfo, setPlanInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState(null);
  const [directCheckoutLoading, setDirectCheckoutLoading] = useState(false);
  const [directCheckoutError, setDirectCheckoutError] = useState('');
  const [isAnnual, setIsAnnual] = useState(false);
  const [pendingToken, setPendingToken] = useState(() => sessionStorage.getItem('mf_pending_token') || null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!location.state?.selectedPlan) return;
    const incoming = location.state.selectedPlan;
    const tierName = incoming.includes('ultra') ? 'ultra' : incoming.includes('pro') ? 'pro' : 'starter';
    const tier = PLAN_TIERS.find(t => t.id === tierName);
    const plan = ALL_PLANS.find(p => p.id === incoming) || tier?.durations[0];
    if (tier && plan) handleDirectCheckout({ ...plan, tier: tierName });
  }, [location.state]);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [planRes, histRes] = await Promise.all([getCurrentPlan(workspaceId), getPaymentHistory(workspaceId)]);
      if (planRes.success) setPlanInfo(planRes);
      if (histRes.success) setHistory(histRes.payments || []);
    } catch (e) { console.error('[billing] load error:', e); }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!pendingToken) return;
    const interval = setInterval(async () => {
      try {
        const res = await getPaymentStatus(pendingToken);
        if (res.status === 'paid') { clearInterval(interval); sessionStorage.removeItem('mf_pending_token'); setPendingToken(null); await load(); navigate('/ecom/agent-ia'); }
        else if (res.status === 'failure' || res.status === 'no paid') { clearInterval(interval); sessionStorage.removeItem('mf_pending_token'); setPendingToken(null); load(); }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingToken, load, navigate]);

  async function handleActivateTrial() {
    setTrialLoading(true);
    try { await activateTrial(workspaceId); window.location.reload(); }
    catch { setTrialLoading(false); }
  }

  // Direct checkout — skip modal, use user phone/name
  const handleDirectCheckout = useCallback(async (duration) => {
    if (!duration?.id || duration?.id === 'free') {
      setDirectCheckoutError('Ce plan ne nécessite pas de paiement.');
      return;
    }
    const phone = user?.phone?.trim();
    const name = user?.name?.trim() || user?.email?.split('@')[0] || 'Client';
    if (!phone || phone.length < 7) {
      // Fallback: show modal if no phone on profile
      const tier = PLAN_TIERS.find(t => t.id === (duration.tier || duration.id?.split('_')[0]));
      setCheckout({ plan: { ...duration, tier: duration.tier || tier?.id }, tier });
      return;
    }
    setDirectCheckoutLoading(true);
    setDirectCheckoutError('');
    try {
      const result = await createCheckout({ plan: duration.id, phone, clientName: name, workspaceId });
      if (!result.success) { setDirectCheckoutError(result.message || 'Erreur'); setDirectCheckoutLoading(false); return; }
      if (result.paymentUrl) {
        sessionStorage.setItem('mf_pending_token', result.mfToken);
        setPendingToken(result.mfToken);
        window.location.href = result.paymentUrl;
      } else { setDirectCheckoutError('URL de paiement manquante.'); setDirectCheckoutLoading(false); }
    } catch (err) {
      setDirectCheckoutError(err?.response?.data?.message || 'Erreur de paiement.');
      setDirectCheckoutLoading(false);
    }
  }, [user, workspaceId]);

  const currentPlan = planInfo?.plan || 'free';
  const isActivePaid = planInfo?.isActive && ['starter', 'pro', 'ultra'].includes(currentPlan);
  const isTrial = planInfo?.trial?.active;
  const trialDays = isTrial ? daysLeft(planInfo.trial.endsAt) : 0;
  const trialUsed = planInfo?.trial?.used;

  return (
    <div className="min-h-screen bg-[#fafbfc]">

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/ecom/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition">
              <ArrowLeftIcon />
              <span className="text-sm font-medium hidden sm:inline">Retour</span>
            </Link>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <span className="text-white font-black text-xs">S</span>
              </div>
              <span className="font-black text-gray-900 text-lg tracking-tight hidden sm:inline">Scalor</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {history.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)} className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition px-3 py-2 rounded-lg hover:bg-gray-100">
                Historique
              </button>
            )}
            {isActivePaid && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-700">{PLAN_TIERS.find(t => t.id === currentPlan)?.name || 'Actif'}</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Pending Payment Banner */}
      {pendingToken && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 text-sm text-amber-800">
            <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <span><strong>Vérification du paiement en cours…</strong> Votre plan sera activé automatiquement.</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
           VIEW A: Subscribed / Trial user → "Mon abonnement" dashboard
           ══════════════════════════════════════════════════════════════════ */}
      {(isActivePaid || isTrial) && !loading ? (() => {
        const activeTier = PLAN_TIERS.find(t => t.id === currentPlan) || PLAN_TIERS[1];
        const remainingDays = isActivePaid ? daysLeft(planInfo?.planExpiresAt) : trialDays;
        const expiryDate = isActivePaid ? planInfo?.planExpiresAt : planInfo?.trial?.endsAt;
        const upgradeTiers = PLAN_TIERS.filter(t => t.id !== currentPlan);

        return (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-20">

            {/* Current plan compact card */}
            <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-r ${activeTier.gradient} px-5 py-4 text-white shadow-lg mb-8`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center p-2 flex-shrink-0">{activeTier.icon}</div>
                  <div className="min-w-0">
                    <h2 className="text-base font-black truncate">{activeTier.name}</h2>
                    <p className="text-white/60 text-[11px]">{isTrial ? `Essai · ${trialDays}j restant${trialDays > 1 ? 's' : ''}` : `Expire ${formatDate(expiryDate)}`}</p>
                  </div>
                </div>
                {isTrial ? (
                  <button onClick={() => document.getElementById('upgrade-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-4 py-1.5 bg-white text-gray-900 font-bold text-xs rounded-lg hover:bg-white/90 transition flex-shrink-0">
                    Choisir un plan →
                  </button>
                ) : (
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-black">{remainingDays}j</p>
                    <p className="text-white/50 text-[10px]">restants</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              {[
                { label: 'Plan', value: activeTier.name, icon: <span className="w-5 h-5 text-slate-500">{activeTier.icon}</span> },
                { label: 'Statut', value: isTrial ? 'Essai' : 'Actif', icon: isTrial ? <Clock className="w-5 h-5 text-slate-500" /> : <CheckCircle2 className="w-5 h-5 text-slate-500" /> },
                { label: 'Jours restants', value: String(remainingDays), icon: <CalendarDays className="w-5 h-5 text-slate-500" /> },
                { label: 'Paiements', value: String(history.length), icon: <CreditCard className="w-5 h-5 text-slate-500" /> },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                  <div>{s.icon}</div>
                  <div>
                    <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">{s.label}</p>
                    <p className="text-lg font-black text-gray-900">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Upgrade section */}
            <div id="upgrade-section" className="pt-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-gray-900">{isTrial ? 'Choisissez votre plan' : 'Changer de plan'}</h2>
                <p className="text-gray-500 text-sm mt-2">{isTrial ? 'Votre essai gratuit prend fin bientôt. Choisissez un plan pour continuer.' : 'Passez à un plan supérieur ou changez d\'offre à tout moment.'}</p>
              </div>

              {/* Billing toggle */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <span className={`text-sm font-semibold transition ${!isAnnual ? 'text-gray-900' : 'text-gray-400'}`}>Mensuel</span>
                <button onClick={() => setIsAnnual(!isAnnual)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${isAnnual ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${isAnnual ? 'translate-x-7' : ''}`} />
                </button>
                <span className={`text-sm font-semibold transition ${isAnnual ? 'text-gray-900' : 'text-gray-400'}`}>Annuel</span>
                {isAnnual && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Jusqu'à -25%</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {PLAN_TIERS.map(tier => (
                  <PlanCard
                    key={tier.id}
                    tier={tier}
                    isAnnual={isAnnual}
                    currentPlan={currentPlan}
                    isActive={isActivePaid}
                    onCheckout={duration => handleDirectCheckout({ ...duration, tier: tier.id })}
                  />
                ))}
              </div>
            </div>

            {/* Full features list */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-10">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Fonctionnalités incluses</h3>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {activeTier.features.map((f, i) => (
                  <div key={i} className={`flex items-center gap-2.5 text-[13px] ${f.included ? 'text-gray-700' : 'text-gray-300'}`}>
                    {f.included
                      ? <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><CheckIcon className="w-3 h-3 text-emerald-600" /></div>
                      : <div className="w-5 h-5 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0"><XIcon className="w-3 h-3 text-gray-300" /></div>
                    }
                    <span className={f.highlight ? 'font-semibold' : ''}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment history inline */}
            {history.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Derniers paiements</h3>
                <div className="space-y-3">
                  {history.slice(0, 3).map(p => (
                    <div key={p._id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-bold text-gray-900 capitalize">{p.plan} — {p.durationMonths} mois</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-black text-gray-900">{formatAmount(p.amount)} FCFA</p>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  ))}
                </div>
                {history.length > 3 && (
                  <button onClick={() => setShowHistory(true)} className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 transition">
                    Voir tout l'historique ({history.length})
                  </button>
                )}
              </div>
            )}

          </div>
        );
      })()

      /* ══════════════════════════════════════════════════════════════════
         VIEW B: Non-subscribed user → Full landing / pricing page
         ══════════════════════════════════════════════════════════════════ */
      : (
        <>
          {/* Hero Section */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white via-blue-50/30 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-100/40 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-8 text-center">
              <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
                Le plan parfait pour<br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">développer votre business</span>
              </h1>
              <p className="text-gray-500 text-base sm:text-lg mt-4 max-w-2xl mx-auto leading-relaxed">
                Commencez gratuitement, passez à l'échelle quand vous êtes prêt. Tous les plans incluent un essai gratuit de 7 jours.
              </p>

              {/* Current plan status bar */}
              {!loading && (
                <div className="mt-8 inline-flex items-center gap-3 bg-white border border-gray-200 rounded-full px-5 py-2.5 shadow-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                  <span className="text-sm text-gray-500">Plan gratuit</span>
                  {!trialUsed && (
                    <button onClick={handleActivateTrial} disabled={trialLoading}
                      className="text-sm font-bold text-blue-600 hover:text-blue-700 transition disabled:opacity-50">
                      {trialLoading ? 'Activation…' : '→ Essai gratuit 7 jours'}
                    </button>
                  )}
                </div>
              )}

              {/* Billing toggle */}
              <div className="mt-8 flex items-center justify-center gap-3">
                <span className={`text-sm font-semibold transition ${!isAnnual ? 'text-gray-900' : 'text-gray-400'}`}>Mensuel</span>
                <button onClick={() => setIsAnnual(!isAnnual)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${isAnnual ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${isAnnual ? 'translate-x-7' : ''}`} />
                </button>
                <span className={`text-sm font-semibold transition ${isAnnual ? 'text-gray-900' : 'text-gray-400'}`}>
                  Annuel
                </span>
                {isAnnual && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Jusqu'à -25%</span>}
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 pb-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              {PLAN_TIERS.map(tier => (
                <PlanCard
                  key={tier.id}
                  tier={tier}
                  isAnnual={isAnnual}
                  currentPlan={currentPlan}
                  isActive={isActivePaid}
                  onCheckout={duration => handleDirectCheckout({ ...duration, tier: tier.id })}
                />
              ))}
            </div>

            {/* Comparison table (desktop) */}
            <div className="hidden lg:block mt-20">
              <h2 className="text-2xl font-black text-gray-900 text-center mb-10">Comparaison détaillée</h2>
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-5 text-gray-500 font-medium w-[40%]">Fonctionnalité</th>
                      {PLAN_TIERS.map(t => (
                        <th key={t.id} className="px-4 py-5 text-center">
                          <span className="text-base font-black text-gray-900">{t.name}</span>
                          <p className="text-xs text-gray-400 font-normal mt-0.5">{formatAmount((isAnnual ? t.durations[1] : t.durations[0]).perMonth)} FCFA/mois</p>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { label: 'Commandes', values: ['Illimitées', 'Illimitées', 'Illimitées'] },
                      { label: 'Produits', values: ['Illimités', 'Illimités', 'Illimités'] },
                      { label: 'Boutique en ligne', values: [true, true, true] },
                      { label: 'Tableau de bord', values: [true, true, true] },
                      { label: 'Agent IA WhatsApp', values: [false, '1 agent', '5 agents'] },
                      { label: 'Numéros WhatsApp', values: [false, '1', '5'] },
                      { label: 'Messages / jour', values: ['—', '1 000', '∞'] },
                      { label: 'Messages / mois', values: ['—', '50 000', '∞'] },
                      { label: 'Génération pages IA', values: [false, false, '10/mois'] },
                      { label: 'Multi-boutiques', values: [false, false, true] },
                      { label: 'Support', values: ['Standard', 'Prioritaire', '24/7 dédié'] },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-3.5 text-gray-700 font-medium">{row.label}</td>
                        {row.values.map((val, j) => (
                          <td key={j} className="px-4 py-3.5 text-center">
                            {val === true ? <CheckIcon className="w-5 h-5 text-emerald-500 mx-auto" />
                              : val === false ? <span className="text-gray-300">—</span>
                              : <span className="text-gray-700 font-semibold text-sm">{val}</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Trust / Reassurance */}
            <div className="mt-20 grid sm:grid-cols-4 gap-6">
              {[
                { icon: <Zap className="w-7 h-7 text-amber-500" />, title: 'Activation instantanée', desc: 'Votre plan est actif dès confirmation du paiement Mobile Money.' },
                { icon: <Shield className="w-7 h-7 text-emerald-500" />, title: 'Paiement 100% sécurisé', desc: 'Orange Money, MTN MoMo, Wave, Flooz via MoneyFusion.' },
                { icon: <RefreshCw className="w-7 h-7 text-blue-500" />, title: 'Sans engagement', desc: 'Changez ou annulez votre plan à tout moment, sans frais cachés.' },
                { icon: <MessageCircle className="w-7 h-7 text-violet-500" />, title: 'Support réactif', desc: 'Notre équipe répond en moins de 24h à toutes vos questions.' },
              ].map(item => (
                <div key={item.title} className="text-center">
                  <div className="mb-3 flex justify-center">{item.icon}</div>
                  <h3 className="font-bold text-gray-900 text-sm">{item.title}</h3>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* FAQ */}
            <div className="mt-20 max-w-3xl mx-auto">
              <h2 className="text-2xl font-black text-gray-900 text-center mb-8">Questions fréquentes</h2>
              <div className="space-y-4">
                {[
                  { q: 'Puis-je changer de plan à tout moment ?', a: "Oui. Votre plan actuel reste actif jusqu'à expiration, et le nouveau plan prend le relais. Pas de frais de changement." },
                  { q: 'Quels moyens de paiement acceptez-vous ?', a: 'Nous acceptons Orange Money, MTN Mobile Money, Wave, Flooz et tous les opérateurs pris en charge par MoneyFusion dans plus de 15 pays africains.' },
                  { q: "L'essai gratuit est-il sans engagement ?", a: "Absolument. L'essai de 7 jours vous donne accès aux fonctionnalités Pro sans entrer de numéro de paiement. Aucun prélèvement automatique." },
                  { q: "Qu'est-ce que les crédits de génération de pages IA ?", a: "Avec le plan Scalor IA Pro, vous recevez 10 crédits par mois pour générer des pages produit professionnelles avec l'IA. Chaque crédit = 1 page complète avec images, textes et formulaire." },
                  { q: "Que se passe-t-il quand mon abonnement expire ?", a: 'Vous repassez automatiquement au plan gratuit. Vos données sont conservées et vous pouvez réactiver votre plan à tout moment.' },
                ].map(({ q, a }) => (
                  <details key={q} className="group bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <summary className="flex items-center justify-between px-6 py-4 cursor-pointer select-none hover:bg-gray-50 transition">
                      <span className="font-semibold text-gray-900 text-sm pr-4">{q}</span>
                      <span className="text-gray-400 group-open:rotate-45 transition-transform text-xl font-light flex-shrink-0">+</span>
                    </summary>
                    <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">{a}</div>
                  </details>
                ))}
              </div>
            </div>

            {/* CTA bottom */}
            <div className="mt-20 text-center bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 sm:p-16 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.15),transparent_70%)] pointer-events-none" />
              <div className="relative">
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Prêt à scaler votre business ?</h2>
                <p className="text-gray-400 text-base mb-8 max-w-lg mx-auto">Rejoignez les entrepreneurs qui automatisent leurs ventes avec Scalor. Commencez votre essai gratuit aujourd'hui.</p>
                {!trialUsed && (
                  <button onClick={handleActivateTrial} disabled={trialLoading}
                    className="px-8 py-4 bg-white text-gray-900 font-black text-sm rounded-xl hover:bg-gray-100 transition shadow-xl disabled:opacity-50">
                    {trialLoading ? 'Activation…' : <span className="flex items-center gap-2"><Gift className="w-4 h-4" /> Commencer l'essai gratuit — 7 jours</span>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <span className="text-white font-black text-[10px]">S</span>
            </div>
            <span className="font-semibold text-gray-500">Scalor</span>
            <span>© 2025</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Paiements sécurisés par MoneyFusion</span>
          </div>
        </div>
      </footer>

      {/* Payment History Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="font-black text-gray-900">Historique des paiements</h3>
              <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition"><XIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">Aucun paiement</p>
              ) : history.map(p => (
                <div key={p._id} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 capitalize">{p.plan} — {p.durationMonths} mois</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.createdAt)} · {p.paymentMethod || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{formatAmount(p.amount)} FCFA</p>
                    <div className="mt-1"><StatusBadge status={p.status} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal — fallback si pas de téléphone */}
      {checkout && (
        <CheckoutModal
          plan={checkout.plan}
          tier={checkout.tier}
          workspaceId={workspaceId}
          userName={user?.name || ''}
          userCountry={userCountry}
          onClose={() => setCheckout(null)}
          onSuccess={token => { sessionStorage.setItem('mf_pending_token', token); setPendingToken(token); }}
        />
      )}

      {/* Direct checkout loading overlay */}
      {directCheckoutLoading && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4">
            <div className="w-12 h-12 border-4 border-gray-200 rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: '#0F6B4F' }} />
            <p className="text-sm font-semibold text-gray-900">Redirection vers le paiement...</p>
            <p className="text-xs text-gray-500 mt-1">Veuillez patienter</p>
          </div>
        </div>
      )}

      {/* Direct checkout error toast */}
      {directCheckoutError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-3 max-w-md">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{directCheckoutError}</span>
          <button onClick={() => setDirectCheckoutError('')} className="ml-2 text-white/70 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}
