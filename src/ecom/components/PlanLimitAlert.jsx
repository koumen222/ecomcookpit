import React from 'react';
import { AlertCircle, Zap, Users, Crown } from 'lucide-react';

/**
 * PlanLimitAlert - Affiche des messages explicites quand les limites du plan sont atteintes
 *
 * Props:
 * - type: 'agent_limit' | 'plan_expired' | 'message_limit' | 'instance_limit'
 * - planType: 'free' | 'trial' | 'pro' | 'ultra'
 * - currentCount: nombre actuel (agents, messages, etc.)
 * - limit: limite du plan
 * - onUpgrade: callback au clic sur bouton upgrade
 * - onRenew: callback au clic sur bouton renouveler
 */
const PlanLimitAlert = ({ type, planType, currentCount, limit, onUpgrade, onRenew }) => {
  const configs = {
    agent_limit: {
      icon: Users,
      title: '❌ Limite d\'agents atteinte',
      severity: 'orange',
      getMessage: (limit, planType) => {
        const nextPlan = planType === 'free' ? 'Pro' : 'Ultra';
        const nextLimit = planType === 'free' ? 1 : (limit === 1 ? 5 : 10);
        return `Vous avez créé ${limit} agent${limit > 1 ? 's' : ''} maximum sur votre plan ${planType === 'free' ? 'gratuit' : planType}. Passez à ${nextPlan} pour créer jusqu'à ${nextLimit} agents.`;
      },
      button: { label: 'Passer au plan supérieur', icon: Zap, onClick: 'upgrade' }
    },
    plan_expired: {
      icon: AlertCircle,
      title: '❌ Votre abonnement a expiré',
      severity: 'red',
      getMessage: (limit, planType) => `Votre plan ${planType} a expiré et vous êtes revenu au plan gratuit. Les fonctionnalités sont maintenant limitées. Renouveler votre abonnement pour continuer.`,
      button: { label: 'Renouveler le plan', icon: Crown, onClick: 'renew' }
    },
    message_limit: {
      icon: AlertCircle,
      title: '⚠️ Limite de messages atteinte',
      severity: 'orange',
      getMessage: (limit, planType) => `Vous avez atteint la limite de ${limit} messages par jour sur votre plan ${planType}. Passez à Ultra pour des messages illimités.`,
      button: { label: 'Passer à Ultra', icon: Zap, onClick: 'upgrade' }
    },
    instance_limit: {
      icon: AlertCircle,
      title: '❌ Limite d\'instances atteinte',
      severity: 'orange',
      getMessage: (limit, planType) => `Vous avez créé ${limit} instance${limit > 1 ? 's' : ''} maximum sur votre plan ${planType}. Passez à un plan supérieur pour plus d'instances.`,
      button: { label: 'Voir les plans', icon: Crown, onClick: 'upgrade' }
    }
  };

  const config = configs[type] || configs.agent_limit;
  const Icon = config.icon;
  const ButtonIcon = config.button.icon;

  const severityStyles = {
    red: 'bg-red-50 border-red-200 text-red-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
  };

  const buttonColor = {
    red: 'bg-red-600 hover:bg-red-700',
    orange: 'bg-orange-600 hover:bg-orange-700',
  };

  const handleClick = () => {
    if (config.button.onClick === 'upgrade' && onUpgrade) {
      onUpgrade();
    } else if (config.button.onClick === 'renew' && onRenew) {
      onRenew();
    }
  };

  return (
    <div className={`border-2 rounded-2xl p-6 flex items-start gap-4 ${severityStyles[config.severity]}`}>
      <Icon className="w-6 h-6 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="font-bold mb-2">{config.title}</h3>
        <p className="text-sm mb-4 leading-relaxed">
          {config.getMessage(limit, planType)}
        </p>
        <button
          onClick={handleClick}
          className={`inline-flex items-center gap-2 px-4 py-2 ${buttonColor[config.severity]} text-white text-sm font-bold rounded-lg transition-colors`}
        >
          <ButtonIcon className="w-4 h-4" />
          {config.button.label}
        </button>
      </div>
    </div>
  );
};

export default PlanLimitAlert;
