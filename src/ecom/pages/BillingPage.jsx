import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { getCurrentPlan, createCheckout, getPaymentStatus, getPaymentHistory, activateTrial } from '../services/billingApi.js';

// ─── Country phone codes ──────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: '+237', flag: '🇨🇲', country: 'Cameroun' },
  { code: '+221', flag: '🇸🇳', country: 'Sénégal' },
  { code: '+225', flag: '🇨🇮', country: 'Côte d\'Ivoire' },
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

// ─── Plan definitions ─────────────────────────────────────────────────────────
const PLAN_TIERS = [
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Parfait pour démarrer',
    color: 'from-emerald-500 to-emerald-700',
    accentColor: 'emerald',
    textAccent: 'text-emerald-600',
    bgAccent: 'bg-emerald-50',
    borderAccent: 'border-emerald-500',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700',
    features: [
      { text: '1 agent IA actif', highlight: false },
      { text: '1 numéro WhatsApp connecté', highlight: false },
      { text: '1 000 messages / jour', highlight: false },
      { text: '50 000 messages / mois', highlight: false },
      { text: 'Catalogue produits illimité', highlight: false },
      { text: 'Réponses automatiques 24h/7j', highlight: false },
      { text: 'Support prioritaire', highlight: false },
    ],
    durations: [
      { id: 'pro_1',  label: 'Mensuel', shortLabel: '1 mois',  price: 6000,  months: 1,  saving: null,  perMonth: 6000 },
      { id: 'pro_12', label: 'Annuel',  shortLabel: '12 mois', price: 55000, months: 12, saving: '24%', perMonth: 4583 },
    ],
  },
  {
    id: 'ultra',
    name: 'Ultra',
    tagline: 'Pour scaler sans limites',
    badge: 'Recommandé',
    color: 'from-amber-500 to-orange-600',
    accentColor: 'amber',
    textAccent: 'text-amber-600',
    bgAccent: 'bg-amber-50',
    borderAccent: 'border-amber-500',
    btnClass: 'bg-amber-500 hover:bg-amber-600',
    features: [
      { text: '5 agents IA actifs', highlight: true },
      { text: '5 numéros WhatsApp', highlight: true },
      { text: 'Messages illimités ∞', highlight: true },
      { text: 'Gestion multi-boutiques', highlight: false },
      { text: 'Campagnes de relance avancées', highlight: false },
      { text: 'API & webhooks', highlight: false },
      { text: 'Support 24/7 dédié', highlight: false },
    ],
    durations: [
      { id: 'ultra_1',  label: 'Mensuel', shortLabel: '1 mois',  price: 15000,  months: 1,  saving: null,  perMonth: 15000 },
      { id: 'ultra_12', label: 'Annuel',  shortLabel: '12 mois', price: 140000, months: 12, saving: '22%', perMonth: 11667 },
    ],
  },
];

const ALL_PLANS = PLAN_TIERS.flatMap(tier =>
  tier.durations.map(d => ({ ...d, tier: tier.id }))
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function formatAmount(n) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}
function daysLeft(dateStr) {
  if (!dateStr) return 0;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    paid:      { label: 'Payé',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    pending:   { label: 'En attente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    failure:   { label: 'Échoué',     cls: 'bg-red-100 text-red-700 border-red-200' },
    'no paid': { label: 'Non payé',   cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  }[status] || { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── CheckoutModal ────────────────────────────────────────────────────────────
function CheckoutModal({ plan, tier, onClose, onSuccess, workspaceId, userName, userCountry }) {
  const [country, setCountry] = useState(
    COUNTRY_CODES.find(c => c.country === userCountry) ? userCountry : 'Cameroun'
  );
  const [phoneLocal, setPhoneLocal] = useState('');
  const [clientName, setClientName] = useState(userName || '');
  const [step, setStep] = useState(1); // 1=form, 2=confirming
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedCode = COUNTRY_CODES.find(c => c.country === country);
  const dialCode = selectedCode?.code || '+237';
  const flag = selectedCode?.flag || '🌍';
  const fullPhone = phoneLocal
    ? `${dialCode}${phoneLocal.replace(/^0+/, '')}`
    : '';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!clientName.trim() || clientName.trim().length < 2) {
      setError('Veuillez entrer votre nom complet (minimum 2 caractères).');
      return;
    }
    if (!phoneLocal.trim() || phoneLocal.trim().length < 7) {
      setError('Veuillez entrer un numéro valide (minimum 7 chiffres).');
      return;
    }

    setLoading(true);
    try {
      const result = await createCheckout({
        plan: plan.id,
        phone: fullPhone,
        clientName: clientName.trim(),
        workspaceId,
      });

      if (!result.success) {
        setError(result.message || 'Erreur lors de l\'initialisation du paiement.');
        setLoading(false);
        return;
      }

      if (result.paymentUrl) {
        onSuccess(result.mfToken);
        window.location.href = result.paymentUrl;
      } else {
        setError('URL de paiement manquante. Veuillez réessayer.');
        setLoading(false);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  }

  const isUltra = tier.id === 'ultra';
  const gradientHeader = isUltra ? 'from-amber-500 to-orange-600' : 'from-emerald-500 to-emerald-700';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className={`bg-gradient-to-br ${gradientHeader} px-6 pt-6 pb-8 text-white relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl font-black">
              {isUltra ? '⚡' : '🚀'}
            </div>
            <div>
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Abonnement</p>
              <h2 className="text-xl font-black">Plan {tier.name} — {plan.label}</h2>
            </div>
          </div>

          {/* Price summary */}
          <div className="bg-white/15 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white/80 text-xs mb-0.5">Total à payer</p>
              <p className="text-2xl font-black">{formatAmount(plan.price)}</p>
              {plan.saving && (
                <p className="text-white/70 text-xs mt-0.5">
                  Soit {formatAmount(plan.perMonth)}/mois · Économie {plan.saving}
                </p>
              )}
            </div>
            {plan.saving && (
              <div className="bg-white text-amber-600 font-black text-sm px-3 py-1.5 rounded-full">
                -{plan.saving}
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Nom complet
            </label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Koumen Morgan"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 transition"
              required
            />
          </div>

          {/* Phone with country */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Numéro Mobile Money
            </label>

            {/* Country select */}
            <div className="mb-2">
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 transition bg-white appearance-none"
              >
                {COUNTRY_CODES.map((c, i) => (
                  <option key={i} value={c.country}>
                    {c.flag} {c.country} — {c.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone input */}
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 flex-shrink-0 min-w-[80px]">
                <span className="text-lg">{flag}</span>
                <span className="text-sm font-bold text-gray-700">{dialCode}</span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                value={phoneLocal}
                onChange={e => setPhoneLocal(e.target.value.replace(/\D/g, ''))}
                placeholder="6 XX XX XX XX"
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 transition"
                required
              />
            </div>

            {fullPhone ? (
              <p className="text-xs font-semibold text-emerald-600 mt-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Numéro : {fullPhone}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-2">Orange Money, MTN, Wave, Flooz…</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !phoneLocal || !clientName}
            className={`w-full py-4 rounded-xl font-black text-white text-base transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${isUltra ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Redirection vers le paiement…
              </span>
            ) : (
              `Payer ${formatAmount(plan.price)} →`
            )}
          </button>

          <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Paiement sécurisé
            </span>
            <span>·</span>
            <span>Activation instantanée</span>
            <span>·</span>
            <span>MoneyFusion</span>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────
function PlanCard({ tier, selectedDurationId, onSelectDuration, onCheckout }) {
  const activeDuration = tier.durations.find(d => d.id === selectedDurationId) || tier.durations[0];
  const isSelected = tier.durations.some(d => d.id === selectedDurationId);

  return (
    <div className={`relative flex flex-col rounded-3xl border-2 transition-all duration-200 overflow-hidden
      ${isSelected ? `${tier.borderAccent} shadow-2xl` : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}
    >
      {/* Badge */}
      {tier.badge && (
        <div className="absolute top-4 right-4 bg-amber-500 text-white text-xs font-black px-3 py-1 rounded-full">
          ⭐ {tier.badge}
        </div>
      )}

      {/* Gradient header */}
      <div className={`bg-gradient-to-br ${tier.color} px-8 pt-8 pb-6 text-white`}>
        <h3 className="text-3xl font-black mb-1">{tier.name}</h3>
        <p className="text-white/80 text-sm">{tier.tagline}</p>

        {/* Duration toggle */}
        <div className="flex gap-2 mt-5 bg-white/15 p-1 rounded-xl">
          {tier.durations.map(d => (
            <button
              key={d.id}
              onClick={() => onSelectDuration(d)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                activeDuration.id === d.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {d.label}
              {d.saving && (
                <span className={`ml-1.5 text-xs font-black ${activeDuration.id === d.id ? 'text-emerald-600' : 'text-white/90'}`}>
                  -{d.saving}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Price */}
        <div className="mt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black">{formatAmount(activeDuration.price)}</span>
          </div>
          <p className="text-white/70 text-sm mt-1">
            {activeDuration.months > 1
              ? `${formatAmount(activeDuration.perMonth)}/mois · facturé annuellement`
              : 'facturé mensuellement'
            }
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="flex-1 px-8 py-6 bg-white space-y-3">
        {tier.features.map((f, i) => (
          <div key={i} className={`flex items-center gap-3 text-sm ${f.highlight ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${f.highlight ? tier.bgAccent : 'bg-gray-100'}`}>
              <svg className={`w-3 h-3 ${f.highlight ? tier.textAccent : 'text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            {f.text}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-8 pb-8 bg-white">
        <button
          onClick={() => onCheckout(activeDuration)}
          className={`w-full py-4 rounded-xl font-black text-white text-sm transition-all shadow-lg ${tier.btnClass}`}
        >
          Choisir {tier.name} {activeDuration.label} →
        </button>
      </div>
    </div>
  );
}

// ─── CurrentPlanCard ──────────────────────────────────────────────────────────
function CurrentPlanCard({ planInfo, loading, onUpgrade, onRenew, pendingToken, onActivateTrial }) {
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState(null);

  const plan = planInfo?.plan;
  const isActive = planInfo?.isActive;
  const isPro = plan === 'pro' && isActive;
  const isUltra = plan === 'ultra' && isActive;
  const isTrial = planInfo?.trial?.active;
  const trialUsed = planInfo?.trial?.used;
  const trialDays = isTrial ? daysLeft(planInfo.trial.endsAt) : 0;
  const isExpired = (plan === 'pro' || plan === 'ultra') && !isActive;

  async function handleTrial() {
    setTrialLoading(true);
    setTrialError(null);
    try {
      await onActivateTrial();
    } catch (e) {
      setTrialError(e?.response?.data?.message || 'Impossible d\'activer l\'essai');
      setTrialLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border-2 border-gray-200 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
      </div>
    );
  }

  // ── Active paid plan ──
  if (isPro || isUltra) {
    const tier = isUltra ? PLAN_TIERS[1] : PLAN_TIERS[0];
    const days = daysLeft(planInfo.planExpiresAt);
    const urgent = days <= 7;

    return (
      <div className={`rounded-2xl border-2 p-6 ${isUltra ? 'border-amber-400 bg-amber-50' : 'border-emerald-500 bg-emerald-50'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${isUltra ? 'bg-amber-100' : 'bg-emerald-100'}`}>
              {isUltra ? '⚡' : '🚀'}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className={`text-xl font-black ${isUltra ? 'text-amber-700' : 'text-emerald-700'}`}>Plan {tier.name}</h3>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full text-white ${isUltra ? 'bg-amber-500' : 'bg-emerald-600'}`}>ACTIF</span>
              </div>
              <p className={`text-sm ${urgent ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                {urgent ? `⚠️ Expire dans ${days} jour${days > 1 ? 's' : ''} — ` : ''}
                Expire le {formatDate(planInfo.planExpiresAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onRenew}
            className={`text-sm font-bold px-5 py-2.5 rounded-xl text-white transition ${isUltra ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            Renouveler
          </button>
        </div>

        {/* Limits summary */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Agents', value: isUltra ? '5' : '1' },
            { label: 'WhatsApp', value: isUltra ? '5' : '1' },
            { label: 'Messages/jour', value: isUltra ? '∞' : '1 000' },
            { label: 'Messages/mois', value: isUltra ? '∞' : '50 000' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-xl p-3 text-center">
              <p className={`text-lg font-black ${isUltra ? 'text-amber-600' : 'text-emerald-600'}`}>{item.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {pendingToken && <PendingPaymentBanner />}
      </div>
    );
  }

  // ── Trial active ──
  if (isTrial) {
    const urgent = trialDays <= 1;
    const color = trialDays > 3 ? 'blue' : trialDays > 1 ? 'amber' : 'red';
    const colorMap = {
      blue:  { bg: 'bg-blue-50',  border: 'border-blue-300',  text: 'text-blue-700',  btn: 'bg-blue-600 hover:bg-blue-700' },
      amber: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', btn: 'bg-amber-500 hover:bg-amber-600' },
      red:   { bg: 'bg-red-50',   border: 'border-red-300',   text: 'text-red-700',   btn: 'bg-red-600 hover:bg-red-700' },
    }[color];

    return (
      <div className={`rounded-2xl border-2 p-6 ${colorMap.bg} ${colorMap.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl">⏱️</div>
            <div>
              <h3 className={`text-xl font-black ${colorMap.text}`}>Essai gratuit en cours</h3>
              <p className={`text-sm font-semibold mt-0.5 ${urgent ? 'text-red-600' : colorMap.text}`}>
                {urgent ? '⚠️ Dernier jour ! ' : ''}{trialDays} jour{trialDays > 1 ? 's' : ''} restant{trialDays > 1 ? 's' : ''}
                {' · '}expire le {formatDate(planInfo.trial.endsAt)}
              </p>
            </div>
          </div>
          <button onClick={onUpgrade} className={`text-sm font-bold px-5 py-2.5 rounded-xl text-white transition ${colorMap.btn}`}>
            Passer au Pro →
          </button>
        </div>
        {pendingToken && <PendingPaymentBanner />}
      </div>
    );
  }

  // ── Expired ──
  if (isExpired) {
    return (
      <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl">❌</div>
            <div>
              <h3 className="text-xl font-black text-red-700">Abonnement expiré</h3>
              <p className="text-sm text-red-600 mt-0.5">
                Votre plan {plan} a expiré le {formatDate(planInfo.planExpiresAt)}. Vous êtes repassé au plan gratuit.
              </p>
            </div>
          </div>
          <button onClick={onRenew} className="text-sm font-bold px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition">
            Renouveler maintenant →
          </button>
        </div>
        {pendingToken && <PendingPaymentBanner />}
      </div>
    );
  }

  // ── Free plan ──
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">🆓</div>
          <div>
            <h3 className="text-xl font-black text-gray-900">Plan Gratuit</h3>
            <p className="text-sm text-gray-500 mt-0.5">Fonctionnalités limitées — passez à Pro pour vendre sur WhatsApp</p>
          </div>
        </div>
        {!trialUsed && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleTrial}
              disabled={trialLoading}
              className="text-sm font-bold px-5 py-2.5 rounded-xl border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-60"
            >
              {trialLoading ? 'Activation…' : '🎁 Essai 3 jours gratuit'}
            </button>
            <button onClick={onUpgrade} className="text-sm font-bold px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition">
              Passer au Pro →
            </button>
          </div>
        )}
        {trialUsed && (
          <button onClick={onUpgrade} className="text-sm font-bold px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition">
            Passer au Pro →
          </button>
        )}
      </div>
      {trialError && <p className="mt-3 text-sm text-red-600 font-medium">{trialError}</p>}
      {pendingToken && <PendingPaymentBanner />}
    </div>
  );
}

function PendingPaymentBanner() {
  return (
    <div className="mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
      <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span><strong>Vérification du paiement en cours…</strong> Votre plan sera activé automatiquement dès confirmation.</span>
    </div>
  );
}

// ─── Main BillingPage ─────────────────────────────────────────────────────────
export default function BillingPage() {
  const { user } = useEcomAuth();
  const location = useLocation();

  const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
  const workspaceId = workspace?._id || workspace?.id;
  const userCountry = workspace?.country || 'Cameroun';

  const [planInfo, setPlanInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState(null); // { plan, tier }
  const [selectedDurationIds, setSelectedDurationIds] = useState({
    pro: 'pro_1',
    ultra: 'ultra_1',
  });
  const [pendingToken, setPendingToken] = useState(
    () => sessionStorage.getItem('mf_pending_token') || null
  );

  // Handle inbound plan selection from UpgradeWall
  useEffect(() => {
    if (!location.state?.selectedPlan) return;
    const incoming = location.state.selectedPlan;
    const tierName = incoming.includes('ultra') ? 'ultra' : 'pro';
    const tier = PLAN_TIERS.find(t => t.id === tierName);
    const plan = ALL_PLANS.find(p => p.id === incoming) || tier?.durations[0];
    if (tier && plan) {
      setSelectedDurationIds(prev => ({ ...prev, [tierName]: plan.id }));
      setCheckout({ plan, tier });
    }
  }, [location.state]);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [planRes, histRes] = await Promise.all([
        getCurrentPlan(workspaceId),
        getPaymentHistory(workspaceId),
      ]);
      if (planRes.success) setPlanInfo(planRes);
      if (histRes.success) setHistory(histRes.payments || []);
    } catch (e) {
      console.error('[billing] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  // Poll pending payment
  const navigate = useNavigate();
  useEffect(() => {
    if (!pendingToken) return;
    const interval = setInterval(async () => {
      try {
        const res = await getPaymentStatus(pendingToken);
        if (res.status === 'paid') {
          clearInterval(interval);
          sessionStorage.removeItem('mf_pending_token');
          setPendingToken(null);
          await load();
          navigate('/ecom/agent-ia');
        } else if (res.status === 'failure' || res.status === 'no paid') {
          clearInterval(interval);
          sessionStorage.removeItem('mf_pending_token');
          setPendingToken(null);
          load();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingToken, load, navigate]);

  function handleCheckoutSuccess(token) {
    sessionStorage.setItem('mf_pending_token', token);
    setPendingToken(token);
  }

  async function handleActivateTrial() {
    await activateTrial(workspaceId);
    window.location.reload();
  }

  const isActivePaid = planInfo?.isActive && (planInfo?.plan === 'pro' || planInfo?.plan === 'ultra');

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900">Abonnement</h1>
        <p className="text-gray-500 mt-1">Gérez votre plan et vos paiements</p>
      </div>

      {/* Current Plan */}
      <CurrentPlanCard
        planInfo={planInfo}
        loading={loading}
        pendingToken={pendingToken}
        onUpgrade={() => window.scrollTo({ top: 400, behavior: 'smooth' })}
        onRenew={() => window.scrollTo({ top: 400, behavior: 'smooth' })}
        onActivateTrial={handleActivateTrial}
      />

      {/* Plan Selection */}
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900">
              {isActivePaid ? 'Changer de plan' : 'Choisissez votre plan'}
            </h2>
            <p className="text-gray-500 text-sm mt-1">Annulez à tout moment. Activation immédiate après paiement.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {PLAN_TIERS.map(tier => (
            <PlanCard
              key={tier.id}
              tier={tier}
              selectedDurationId={selectedDurationIds[tier.id]}
              onSelectDuration={duration => setSelectedDurationIds(prev => ({ ...prev, [tier.id]: duration.id }))}
              onCheckout={duration => setCheckout({ plan: { ...duration, tier: tier.id }, tier })}
            />
          ))}
        </div>
      </div>

      {/* FAQ / Reassurance */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: '⚡', title: 'Activation instantanée', desc: 'Votre plan est actif dès confirmation du paiement.' },
          { icon: '🔒', title: 'Paiement sécurisé', desc: 'Via MoneyFusion. Orange Money, MTN, Wave acceptés.' },
          { icon: '💬', title: 'Support réactif', desc: 'Une question ? Notre équipe répond en moins de 24h.' },
        ].map(item => (
          <div key={item.title} className="bg-gray-50 rounded-2xl p-5 flex items-start gap-3">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">{item.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Payment History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-xl font-black text-gray-900 mb-4">Historique des paiements</h2>
          <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Date', 'Plan', 'Durée', 'Montant', 'Méthode', 'Statut'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map(p => (
                  <tr key={p._id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3.5 text-gray-600">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3.5 font-bold text-gray-900 capitalize">{p.plan}</td>
                    <td className="px-4 py-3.5 text-gray-600">{p.durationMonths} mois</td>
                    <td className="px-4 py-3.5 font-bold text-gray-900">{formatAmount(p.amount)}</td>
                    <td className="px-4 py-3.5 text-gray-600 capitalize">{p.paymentMethod || '—'}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkout && (
        <CheckoutModal
          plan={checkout.plan}
          tier={checkout.tier}
          workspaceId={workspaceId}
          userName={user?.name || ''}
          userCountry={userCountry}
          onClose={() => setCheckout(null)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
}
