import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/ecommApi';
import { needsStoreOnboarding } from '../utils/storeOnboarding.js';

// ─────────────────────────────────────────────────────────────────────────────
// /ecom/onboarding/boutique — RELAIS vers le wizard officiel de création de
// boutique (StoreCreationWizard). Conservé pour la compatibilité des liens :
// l'onboarding obligatoire utilise le wizard complet, pas un formulaire à part.
// Au passage, on confirme l'état serveur : si la boutique existe déjà, on va
// directement au dashboard.
// ─────────────────────────────────────────────────────────────────────────────

const StoreOnboarding = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.getProfile();
        const freshUser = res.data?.data?.user;
        if (cancelled) return;
        if (freshUser) {
          try { localStorage.setItem('ecomUser', JSON.stringify(freshUser)); } catch { /* noop */ }
          if (!needsStoreOnboarding(freshUser)) {
            navigate('/ecom/dashboard', { replace: true });
            return;
          }
        }
      } catch { /* profil injoignable : on laisse le wizard gérer */ }
      if (!cancelled) navigate('/ecom/boutique/wizard', { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#0F6B4F' }} />
    </div>
  );
};

export default StoreOnboarding;
