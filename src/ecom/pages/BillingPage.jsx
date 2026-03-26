import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { getCurrentPlan, createCheckout, getPaymentStatus, getPaymentHistory } from '../services/billingApi.js';

// ─── Country phone codes ──────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: '+237', country: 'Cameroun', name: 'Cameroun' },
  { code: '+221', country: 'Sénégal', name: 'Sénégal' },
  { code: '+225', country: 'Côte d\'Ivoire', name: 'Côte d\'Ivoire' },
  { code: '+223', country: 'Mali', name: 'Mali' },
  { code: '+226', country: 'Burkina Faso', name: 'Burkina Faso' },
  { code: '+229', country: 'Bénin', name: 'Bénin' },
  { code: '+228', country: 'Togo', name: 'Togo' },
  { code: '+227', country: 'Niger', name: 'Niger' },
  { code: '+224', country: 'Guinée', name: 'Guinée' },
  { code: '+234', country: 'Nigeria', name: 'Nigeria' },
  { code: '+233', country: 'Ghana', name: 'Ghana' },
  { code: '+231', country: 'Liberia', name: 'Liberia' },
  { code: '+33', country: 'France', name: 'France' },
  { code: '+32', country: 'Belgique', name: 'Belgique' },
  { code: '+41', country: 'Suisse', name: 'Suisse' },
  { code: '+1', country: 'Canada', name: 'Canada' },
  { code: '+1', country: 'États-Unis', name: 'États-Unis' },
];

// ─── Plan definitions ────────────────────────────────────────────────────────
const PLAN_TIERS = [
  {
    id: 'pro',
    name: 'Pro',
    description: 'Parfait pour débuter avec l\'IA',
    color: 'from-ecom-primary to-primary-600',
    borderColor: 'border-ecom-primary',
    badgeColor: 'bg-primary-100 text-ecom-primary',
    features: [
      '1 agent IA',
      '1 instance WhatsApp',
      '1 000 messages/jour',
      '50 000 messages/mois',
      'Support prioritaire',
    ],
    durations: [
      { id: 'pro_1', label: 'Mensuel', price: 6000, months: 1, saving: null },
      { id: 'pro_12', label: 'Annuel', price: 55000, months: 12, saving: '24%' },
    ],
  },
  {
    id: 'ultra',
    name: 'Ultra',
    description: 'Pour les agences et entrepreneurs',
    color: 'from-scalor-copper to-scalor-copper-light',
    borderColor: 'border-scalor-copper',
    badgeColor: 'bg-scalor-copper/10 text-scalor-copper',
    badge: 'Recommandé',
    features: [
      '5 agents IA',
      '5 instances WhatsApp',
      'Messages illimités',
      'Gestion multi-comptes',
      'API & webhooks',
      'Support 24/7',
    ],
    durations: [
      { id: 'ultra_1', label: 'Mensuel', price: 15000, months: 1, saving: null },
      { id: 'ultra_12', label: 'Annuel', price: 140000, months: 12, saving: '22%' },
    ],
  },
];

const PLANS = PLAN_TIERS.flatMap(tier =>
  tier.durations.map(duration => ({
    ...duration,
    tier: tier.id,
  }))
);

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

function formatAmount(n) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}

function StatusBadge({ status }) {
  const cfg = {
    paid:     { label: 'Payé',     cls: 'bg-emerald-100 text-emerald-700' },
    pending:  { label: 'En attente', cls: 'bg-amber-100 text-amber-700' },
    failure:  { label: 'Échoué',   cls: 'bg-red-100 text-red-700' },
    'no paid':{ label: 'Non payé', cls: 'bg-gray-100 text-gray-600' }
  }[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────
function CheckoutModal({ selectedPlan, onClose, onSuccess, workspaceId, userName, userCountry }) {
  const [country, setCountry] = useState(userCountry || 'Cameroun');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [clientName, setClientName] = useState(userName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Obtenir le code pays sélectionné
  const selectedCountryCode = COUNTRY_CODES.find(c => c.country === country);
  const countryCode = selectedCountryCode?.code || '+237';

  // Numéro complet avec code pays
  const fullPhone = phoneLocal ? `${countryCode}${phoneLocal.replace(/^\+/, '').replace(/^0/, '')}` : '';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!phoneLocal.trim() || phoneLocal.trim().length < 7) {
      setError('Entrez un numéro de téléphone valide (min. 7 chiffres).');
      return;
    }
    if (!clientName.trim() || clientName.trim().length < 2) {
      setError('Entrez votre nom complet.');
      return;
    }

    setLoading(true);
    try {
      const result = await createCheckout({
        plan: selectedPlan.id,
        phone: fullPhone,
        clientName: clientName.trim(),
        workspaceId
      });

      if (!result.success) {
        setError(result.message || 'Erreur lors de l\'initialisation du paiement.');
        return;
      }

      // Redirect to MoneyFusion payment page
      if (result.paymentUrl) {
        onSuccess(result.mfToken);
        window.location.href = result.paymentUrl;
      } else {
        setError('URL de paiement manquante. Veuillez réessayer.');
      }
    } catch (err) {
      console.error('[checkout]', err);
      setError(
        err?.response?.data?.message ||
        'Une erreur est survenue. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${selectedPlan.tier === 'ultra' ? 'from-scalor-copper to-scalor-copper-light' : 'from-emerald-600 to-emerald-700'} px-6 py-5 text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Passer au plan {selectedPlan.tier === 'ultra' ? 'Ultra' : 'Pro'}</h2>
              <p className={`${selectedPlan.tier === 'ultra' ? 'text-scalor-copper-light/90' : 'text-emerald-100'} text-sm mt-0.5`}>
                {selectedPlan.label} — {formatAmount(selectedPlan.price)}
                {selectedPlan.saving && (
                  <span className="ml-2 bg-amber-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    -{selectedPlan.saving}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nom complet
            </label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Koumen Morgan"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Pays
            </label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
            >
              {COUNTRY_CODES.map((c, idx) => (
                <option key={idx} value={c.country}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Sélectionnez votre pays pour obtenir le bon indicatif
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Numéro Mobile Money
            </label>
            <div className="flex gap-2">
              <div className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 text-gray-600 font-semibold flex items-center flex-shrink-0">
                {countryCode}
              </div>
              <input
                type="tel"
                value={phoneLocal}
                onChange={e => setPhoneLocal(e.target.value.replace(/\D/g, ''))}
                placeholder="7XXXXXXXX"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Orange Money, MTN, Wave ou tout opérateur Mobile Money
            </p>
            {fullPhone && (
              <p className="text-xs text-emerald-600 font-semibold mt-2">
                📱 Numéro complet: {fullPhone}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
              {error}
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1.5">
            <div className="flex justify-between">
              <span>Plan Pro ({selectedPlan.label})</span>
              <span className="font-semibold text-gray-900">{formatAmount(selectedPlan.price)}</span>
            </div>
            {selectedPlan.saving && (
              <div className="flex justify-between text-emerald-600 text-xs">
                <span>Économie vs mensuel</span>
                <span className="font-medium">-{selectedPlan.saving}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 ${selectedPlan.tier === 'ultra' ? 'bg-scalor-copper hover:bg-scalor-copper-dark' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-60 text-white font-bold rounded-xl transition shadow-lg text-sm`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Redirection vers le paiement…
              </span>
            ) : (
              `Payer ${formatAmount(selectedPlan.price)}`
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            Paiement sécurisé via MoneyFusion — votre abonnement est activé instantanément après confirmation.
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── Main BillingPage ─────────────────────────────────────────────────────────
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
  const [selectedPlan, setSelectedPlan] = useState(PLAN_TIERS[0].durations[0]); // Pro Mensuel par défaut
  const [showCheckout, setShowCheckout] = useState(() => {
    // Auto-show checkout if a plan was selected from UpgradeWall
    return !!location.state?.selectedPlan;
  });
  const [pendingToken, setPendingToken] = useState(
    () => sessionStorage.getItem('mf_pending_token') || null
  );

  // Si un plan a été sélectionné depuis UpgradeWall, l'utiliser
  useEffect(() => {
    if (location.state?.selectedPlan) {
      const plan = location.state.selectedPlan;
      // Trouver le plan correspondant
      let foundPlan = PLANS.find(p => p.id === plan);

      // Si pas trouvé, essayer de deviner (pro_1, ultra_1, etc)
      if (!foundPlan) {
        const tierName = plan.includes('ultra') ? 'ultra' : 'pro';
        foundPlan = PLAN_TIERS.find(t => t.id === tierName)?.durations[0];
      }

      if (foundPlan) {
        setSelectedPlan(foundPlan);
      }
      setShowCheckout(true);
    }
  }, [location.state]);

  // Load plan + history
  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [planRes, histRes] = await Promise.all([
        getCurrentPlan(workspaceId),
        getPaymentHistory(workspaceId)
      ]);
      if (planRes.success) setPlanInfo(planRes);
      if (histRes.success) setHistory(histRes.payments || []);
    } catch (err) {
      console.error('[billing]', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  // Poll pending payment (after return from MoneyFusion)
  useEffect(() => {
    if (!pendingToken) return;
    const interval = setInterval(async () => {
      try {
        const res = await getPaymentStatus(pendingToken);
        if (res.status === 'paid') {
          clearInterval(interval);
          sessionStorage.removeItem('mf_pending_token');
          setPendingToken(null);
          load(); // refresh plan
        } else if (res.status === 'failure' || res.status === 'no paid') {
          clearInterval(interval);
          sessionStorage.removeItem('mf_pending_token');
          setPendingToken(null);
          load();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingToken, load]);

  function handleCheckoutSuccess(token) {
    sessionStorage.setItem('mf_pending_token', token);
    setPendingToken(token);
  }

  const isPro = planInfo?.plan === 'pro' && planInfo?.isActive;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Facturation & Abonnement</h1>
        <p className="text-gray-500 text-sm mt-1">
          Gérez votre plan Scalor et consultez vos paiements.
        </p>
      </div>

      {/* Current Plan Card */}
      <div className={`rounded-2xl p-6 border-2 ${
        isPro
          ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-white'
          : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-2xl font-black ${isPro ? 'text-emerald-700' : 'text-gray-900'}`}>
                Plan {loading ? '…' : isPro ? 'Pro ✨' : 'Gratuit'}
              </span>
              {isPro && (
                <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  ACTIF
                </span>
              )}
            </div>
            {isPro && planInfo?.planExpiresAt ? (
              <p className="text-sm text-gray-600">
                Expire le <strong>{formatDate(planInfo.planExpiresAt)}</strong>
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Accès aux fonctionnalités de base — passer au Pro pour débloquer WhatsApp & IA.
              </p>
            )}
          </div>
          {!isPro && (
            <button
              onClick={() => setShowCheckout(true)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow text-sm"
            >
              Passer au Pro
            </button>
          )}
        </div>

        {pendingToken && (
          <div className="mt-4 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
            <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Vérification du paiement en cours… Votre plan sera activé automatiquement.
          </div>
        )}
      </div>

      {/* Upgrade Plans (only if not pro) */}
      {!isPro && (
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Choisissez votre plan</h2>
            <p className="text-gray-600">Démarrez avec Pro ou passez à Ultra pour plus de capacités</p>
          </div>

          {/* Plan Cards */}
          <div className="grid lg:grid-cols-2 gap-8">
            {PLAN_TIERS.map(tier => (
              <div
                key={tier.id}
                className={`relative rounded-3xl border-2 p-8 transition-all ${
                  tier.borderColor
                } ${tier.id === selectedPlan.tier ? 'shadow-2xl scale-[1.02]' : 'hover:shadow-lg'}`}
              >
                {tier.badge && (
                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full font-bold text-sm ${tier.badgeColor}`}>
                    ⭐ {tier.badge}
                  </div>
                )}

                {/* Header */}
                <div className="mb-6">
                  <h3 className="text-3xl font-black text-gray-900">{tier.name}</h3>
                  <p className="text-gray-600 text-sm mt-1">{tier.description}</p>
                </div>

                {/* Duration Toggle */}
                <div className="mb-6 flex gap-2">
                  {tier.durations.map(duration => (
                    <button
                      key={duration.id}
                      onClick={() => setSelectedPlan(duration)}
                      className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${
                        selectedPlan.id === duration.id
                          ? `bg-gradient-to-r ${tier.color} text-white shadow-lg`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{duration.label}</span>
                      {duration.saving && (
                        <div className="text-xs mt-0.5 font-bold opacity-90">-{duration.saving}</div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Price */}
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-black bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>
                      {formatAmount(selectedPlan.id.startsWith(tier.id) ? selectedPlan.price : tier.durations[0].price)}
                    </span>
                  </div>
                  {selectedPlan.id.startsWith(tier.id) && selectedPlan.id !== `${tier.id}_1` && (
                    <p className="text-xs text-gray-500 mt-2">
                      {Math.round((selectedPlan.id.startsWith(tier.id) ? selectedPlan.price : tier.durations[0].price) / (selectedPlan.id.startsWith(tier.id) ? selectedPlan.months : tier.durations[0].months)).toLocaleString('fr-FR')} FCFA/mois
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-3">
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-gray-700">
                      <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </div>
                  ))}
                </div>

                {/* Bottom Button */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  {selectedPlan.tier === tier.id ? (
                    <button
                      onClick={() => setShowCheckout(true)}
                      className={`w-full py-3 px-6 rounded-xl font-bold transition-all ${
                        tier.id === 'ultra'
                          ? 'bg-scalor-copper hover:bg-scalor-copper-dark text-white'
                          : 'bg-ecom-primary hover:bg-ecom-primary-dark text-white'
                      }`}
                    >
                      Procéder au paiement
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedPlan(tier.durations[0])}
                      className="w-full py-3 px-6 rounded-xl font-bold transition-all bg-gray-100 hover:bg-gray-200 text-gray-900"
                    >
                      Sélectionner ce plan
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pro Features Summary */}
      <div className="bg-gray-50 rounded-2xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Ce qui est inclus dans le plan Pro</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            'Envoi de messages WhatsApp automatique',
            'Campagnes de relance WhatsApp',
            'Messages personnalisés avec variables',
            'Agent IA WhatsApp intelligent',
            'Réponses automatiques aux clients',
            'Qualification automatique des prospects',
            'Support prioritaire',
            'Accès anticipé aux nouvelles fonctionnalités'
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Payment History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Historique des paiements</h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Durée</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Méthode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map(p => (
                  <tr key={p._id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-700">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3 capitalize font-medium text-gray-900">{p.plan}</td>
                    <td className="px-4 py-3 text-gray-600">{p.durationMonths} mois</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatAmount(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{p.paymentMethod || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <CheckoutModal
          selectedPlan={selectedPlan}
          workspaceId={workspaceId}
          userName={user?.name || ''}
          userCountry={userCountry}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
}
