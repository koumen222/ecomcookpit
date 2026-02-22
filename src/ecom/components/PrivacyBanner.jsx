import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyBanner = () => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const consent = localStorage.getItem('ecom_privacy_consent');
    if (!consent) {
      // Petit délai pour ne pas afficher immédiatement
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('ecom_privacy_consent', JSON.stringify({
      accepted: true,
      date: new Date().toISOString(),
      version: '1.0'
    }));
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('ecom_privacy_consent', JSON.stringify({
      accepted: false,
      date: new Date().toISOString(),
      version: '1.0'
    }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] animate-slide-up">
      <div className="bg-[#12121a] border-t border-white/10 shadow-2xl shadow-black/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Icon + Text */}
            <div className="flex items-start gap-3 flex-1">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Protection de vos données</h3>
                <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
                  Ecom Cockpit utilise uniquement des cookies essentiels pour votre authentification. 
                  Aucun cookie publicitaire ni outil de tracking tiers n'est utilisé. 
                  Vos données sont chiffrées et isolées par espace de travail.{' '}
                  <button 
                    onClick={() => navigate('/ecom/privacy')} 
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition"
                  >
                    Politique de confidentialité complète
                  </button>
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={handleDecline}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
              >
                Refuser
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg transition shadow-lg shadow-blue-600/20"
              >
                J'accepte
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PrivacyBanner;
