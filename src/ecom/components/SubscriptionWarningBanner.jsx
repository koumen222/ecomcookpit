import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SubscriptionWarningBanner = ({ warning }) => {
  const [hoursLeft, setHoursLeft] = useState(0);
  const [hidden, setHidden] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!warning?.deadline) return;

    const calc = () => {
      const diff = new Date(warning.deadline) - new Date();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
    };

    setHoursLeft(calc());
    const interval = setInterval(() => setHoursLeft(calc()), 60000);
    return () => clearInterval(interval);
  }, [warning?.deadline]);

  if (!warning?.active || hidden) return null;

  const isExpired = hoursLeft <= 0;
  const isCritical = hoursLeft <= 6;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] ${
        isExpired
          ? 'bg-gradient-to-r from-red-700 to-red-800'
          : isCritical
            ? 'bg-gradient-to-r from-red-600 to-red-700'
            : 'bg-gradient-to-r from-red-500 to-red-600'
      } text-white shadow-lg`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
            isExpired ? 'bg-white/20 animate-pulse' : 'bg-white/15'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">
              {isExpired ? '⚠️ Accès suspendu — Renouvelez votre abonnement' : '⚠️ Renouvellement requis'}
            </p>
            <p className="text-xs text-white/80 truncate">
              {warning.message || 'Votre abonnement expire bientôt. Renouvelez pour garder l\'accès.'}
              {!isExpired && (
                <span className="ml-2 inline-flex items-center gap-1 font-bold text-white">
                  <Clock className="w-3 h-3" />
                  {hoursLeft}h restantes
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigate('/ecom/billing')}
            className="px-4 py-1.5 bg-white text-red-700 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
          >
            Renouveler maintenant
          </button>
          <button onClick={() => setHidden(true)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionWarningBanner;
