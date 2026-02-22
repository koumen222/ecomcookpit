import { useState, useEffect } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Bandeau pour activer les notifications push
 * S'affiche automatiquement après la connexion si les notifs ne sont pas activées
 */
export default function PushNotificationBanner() {
  const { isSupported, isSubscribed, permission, loading, error, subscribeToPush, sendTestNotification } = usePushNotifications();
  const [visible, setVisible] = useState(false);
  const [activating, setActivating] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (loading || !isSupported) return;

    // Ne pas afficher si déjà abonné ou permission refusée définitivement
    if (isSubscribed || permission === 'denied') return;

    // Vérifier si l'utilisateur a déjà rejeté le bandeau
    const dismissed = localStorage.getItem('ecomPushDismissed');
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const daysSince = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 3) return; // Re-proposer après 3 jours
    }

    // Attendre un peu avant d'afficher
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [loading, isSupported, isSubscribed, permission]);

  const handleActivate = async () => {
    setActivating(true);
    const success = await subscribeToPush();
    setActivating(false);
    if (success) {
      setTestSent(true);
      // Envoyer une notification de test
      await sendTestNotification();
      setTimeout(() => setVisible(false), 3000);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('ecomPushDismissed', new Date().toISOString());
  };

  if (!visible) return null;

  // Affichage succès
  if (testSent) {
    return (
      <div className="fixed top-16 inset-x-0 z-40 flex justify-center px-4">
        <div className="bg-emerald-600 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-lg w-full animate-slide-down">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Notifications activées !</p>
            <p className="text-xs text-emerald-100">Vous recevrez les alertes en temps réel, comme une vraie app.</p>
          </div>
        </div>
      </div>
    );
  }

  // Permission refusée
  if (permission === 'denied') return null;

  return (
    <div className="fixed top-16 inset-x-0 z-40 flex justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-lg w-full animate-slide-down">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Activer les notifications</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Recevez les alertes commandes, stock et équipe en temps réel.
          </p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={handleActivate}
            disabled={activating}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {activating ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Activation...
              </>
            ) : (
              'Activer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
