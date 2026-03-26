import React, { useState, useEffect } from 'react';
import { Clock, Zap, X } from 'lucide-react';

const TrialBanner = ({ plan, trialEndsAt, onClose }) => {
  const [daysLeft, setDaysLeft] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!trialEndsAt) {
      setDaysLeft(0);
      return;
    }

    // Calculer les jours restants
    const calculateDaysLeft = () => {
      const now = new Date();
      const endDate = new Date(trialEndsAt);
      const diffTime = endDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    setDaysLeft(calculateDaysLeft());

    // Mettre à jour chaque minute pour une expérience en temps réel
    const interval = setInterval(() => {
      setDaysLeft(calculateDaysLeft());
    }, 60000); // 60 secondes

    return () => clearInterval(interval);
  }, [trialEndsAt]);

  // Ne pas afficher si le trial n'est pas actif ou si l'utilisateur a fermé
  if (!trialEndsAt || hidden || daysLeft < 0) {
    return null;
  }

  const isUrgent = daysLeft <= 2;
  const isWarning = daysLeft <= 7;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${
        isUrgent
          ? 'bg-gradient-to-r from-red-600 to-red-700'
          : isWarning
            ? 'bg-gradient-to-r from-amber-600 to-amber-700'
            : 'bg-gradient-to-r from-emerald-600 to-emerald-700'
      } text-white shadow-lg`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">
              🎉 Version Gratuite
              {daysLeft > 0 && ` — ${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`}
            </p>
            <p className="text-xs opacity-90">
              {daysLeft === 0
                ? 'Votre période d\'essai se termine aujourd\'hui'
                : daysLeft === 1
                  ? 'Votre période d\'essai se termine demain'
                  : `Profitez de toutes les fonctionnalités avant ${new Date(trialEndsAt).toLocaleDateString('fr-FR')}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/ecom/billing"
            className="px-4 py-2 bg-white text-emerald-700 font-bold rounded-lg hover:bg-gray-100 transition-colors text-sm flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Passer à un plan payant
          </a>
          <button
            onClick={() => setHidden(true)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Masquer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;
