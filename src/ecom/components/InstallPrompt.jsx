import { useState, useEffect } from 'react';

/**
 * Composant PWA Install Prompt
 * Affiche un bandeau pour installer l'app sur l'écran d'accueil du téléphone
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si déjà installé (mode standalone)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Vérifier si l'utilisateur a déjà rejeté l'installation
    const dismissed = localStorage.getItem('ecomInstallDismissed');
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const daysSince = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      // Re-proposer après 7 jours
      if (daysSince < 7) return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Détecter l'installation
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      localStorage.removeItem('ecomInstallDismissed');
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setIsInstallable(false);
      return true;
    }
    return false;
  };

  const dismiss = () => {
    setIsInstallable(false);
    localStorage.setItem('ecomInstallDismissed', new Date().toISOString());
  };

  return { isInstallable, isInstalled, install, dismiss };
}

export default function InstallPrompt() {
  const { isInstallable, install, dismiss } = useInstallPrompt();

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-0 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-sm">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-2xl p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold">Installer Ecom Cockpit</h3>
            <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">
              Ajoutez l'app sur votre écran d'accueil pour un accès rapide et des notifications en temps réel.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="text-white/60 hover:text-white p-1 -mt-1 -mr-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={dismiss}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            Plus tard
          </button>
          <button
            onClick={install}
            className="flex-1 px-3 py-2 text-xs font-bold rounded-lg bg-white text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Installer
          </button>
        </div>
      </div>
    </div>
  );
}
