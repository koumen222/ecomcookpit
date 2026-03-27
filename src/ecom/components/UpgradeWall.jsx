import { useState } from 'react';
import { Zap, Star, ArrowRight, Clock, CheckCircle, X } from 'lucide-react';
import { activateTrial } from '../services/billingApi.js';
import { useNavigate } from 'react-router-dom';

const PLANS = [
  {
    key: 'pro',
    label: 'Pro',
    price: '6 000',
    period: 'mois',
    color: 'from-ecom-primary to-primary-600',
    border: 'border-ecom-primary',
    features: ['1 agent IA', '1 instance WhatsApp', 'Ventes automatiques 24h/7j', 'Support prioritaire'],
    cta: 'Passer Pro',
  },
  {
    key: 'ultra',
    label: 'Ultra',
    price: '15 000',
    period: 'mois',
    color: 'from-scalor-copper to-scalor-copper-light',
    border: 'border-scalor-copper',
    badge: 'Recommandé',
    features: ['5 agents IA', '5 instances WhatsApp', '5 numéros simultanés', 'Tout illimité'],
    cta: 'Passer Ultra',
  },
];

export default function UpgradeWall({ onDismiss, workspaceId, trialUsed = false }) {
  const navigate = useNavigate();
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [trialError, setTrialError] = useState(null);

  const handleTrial = async () => {
    try {
      setActivatingTrial(true);
      setTrialError(null);
      await activateTrial(workspaceId);
      // Reload page to apply new trial status
      window.location.reload();
    } catch (err) {
      setTrialError(err?.response?.data?.message || 'Impossible d\'activer l\'essai');
      setActivatingTrial(false);
    }
  };

  const handleUpgrade = (plan) => {
    navigate('/ecom/billing', { state: { selectedPlan: plan } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-scalor-green-dark via-scalor-green to-scalor-green-light px-8 py-8 text-white">
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Zap className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold">Accédez à Rita IA</h2>
          </div>
          <p className="text-white/90 text-sm">
            Vendez automatiquement sur WhatsApp 24h/7j avec votre commercial IA personnalisé.
          </p>

          {!trialUsed && (
            <button
              onClick={handleTrial}
              disabled={activatingTrial}
              className="mt-5 inline-flex items-center gap-2 px-6 py-3 bg-white text-scalor-green-dark font-bold rounded-xl hover:bg-white/90 transition-all shadow-lg disabled:opacity-60"
            >
              <Clock className="w-4 h-4" />
              {activatingTrial ? 'Activation...' : 'Essai gratuit 3 jours — Commencer maintenant'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {trialUsed && (
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-sm text-white/80">
              <Clock className="w-4 h-4" />
              Essai gratuit terminé — Passez à un plan payant
            </div>
          )}
          {trialError && (
            <p className="mt-2 text-sm text-red-200">{trialError}</p>
          )}
        </div>

        {/* Plans */}
        <div className="p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative rounded-2xl border-2 ${plan.border} p-6 flex flex-col gap-4`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-scalor-copper text-white text-xs font-bold rounded-full">
                    {plan.badge}
                  </span>
                )}
                <div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-extrabold text-scalor-black">{plan.price}</span>
                    <span className="text-sm text-scalor-black/60">FCFA/{plan.period}</span>
                  </div>
                  <p className="text-sm font-semibold text-scalor-black/70">{plan.label}</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-scalor-black/80">
                      <CheckCircle className="w-4 h-4 text-ecom-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(plan.key)}
                  className={`w-full py-3 px-4 bg-gradient-to-r ${plan.color} text-white font-bold rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg`}
                >
                  <Star className="w-4 h-4" />
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
