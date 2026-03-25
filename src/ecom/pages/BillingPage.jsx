import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { getCurrentPlan, createCheckout, getPaymentStatus, getPaymentHistory } from '../services/billingApi.js';

// ─── Plan definitions ────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'pro_1',
    label: '1 mois',
    price: 6000,
    durationMonths: 1,
    saving: null
  },
  {
    id: 'pro_3',
    label: '3 mois',
    price: 16000,
    durationMonths: 3,
    saving: '11%'
  },
  {
    id: 'pro_6',
    label: '6 mois',
    price: 30000,
    durationMonths: 6,
    saving: '17%'
  },
  {
    id: 'pro_12',
    label: '12 mois',
    price: 55000,
    durationMonths: 12,
    saving: '24%'
  }
];

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
function CheckoutModal({ selectedPlan, onClose, onSuccess, workspaceId, userName }) {
  const [phone, setPhone] = useState('');
  const [clientName, setClientName] = useState(userName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!phone.trim() || phone.trim().length < 8) {
      setError('Entrez un numéro de téléphone valide (min. 8 chiffres).');
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
        phone: phone.trim(),
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
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Passer au plan Pro</h2>
              <p className="text-emerald-100 text-sm mt-0.5">
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
              placeholder="Jean Dupont"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Numéro Mobile Money
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Orange Money, MTN, Wave ou tout opérateur Mobile Money
            </p>
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
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl transition shadow-lg text-sm"
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

  const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
  const workspaceId = workspace?._id || workspace?.id;

  const [planInfo, setPlanInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(PLANS[0]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pendingToken, setPendingToken] = useState(
    () => sessionStorage.getItem('mf_pending_token') || null
  );

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
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Choisir une durée</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  selectedPlan.id === plan.id
                    ? 'border-emerald-600 bg-emerald-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-emerald-300'
                }`}
              >
                {plan.saving && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    -{plan.saving}
                  </span>
                )}
                <p className="font-bold text-gray-900 text-sm">{plan.label}</p>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  {formatAmount(plan.price)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {Math.round(plan.price / plan.durationMonths).toLocaleString('fr-FR')} FCFA/mois
                </p>
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCheckout(true)}
            className="mt-6 w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-lg"
          >
            Souscrire au plan Pro — {formatAmount(selectedPlan.price)}
          </button>
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
          onClose={() => setShowCheckout(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
}
