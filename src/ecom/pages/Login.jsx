import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const Login = () => {
  const navigate = useNavigate();
  const { login, googleLogin, registerDevice, isAuthenticated, loading: authLoading, user } = useEcomAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDevicePopup, setShowDevicePopup] = useState(false);
  const [registeringDevice, setRegisteringDevice] = useState(false);

  // Google Sign-In callback
  const handleGoogleCallback = useCallback(async (response) => {
    console.log('🔑 [Google Auth] Callback reçu:', {
      hasCredential: !!response?.credential,
      credentialLength: response?.credential?.length,
      clientId: response?.clientId,
      select_by: response?.select_by,
    });

    if (!response?.credential) {
      console.error('❌ [Google Auth] Pas de credential dans la réponse Google !');
      setError('Erreur Google : aucun token reçu. Vérifiez la configuration du Client ID.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await googleLogin(response.credential);
      console.log('✅ [Google Auth] Login réussi:', { user: result.data?.user?.email });
      const u = result.data?.user;
      if (u && !u.workspaceId && u.role !== 'super_admin') {
        navigate('/ecom/workspace-setup');
      } else {
        setShowDevicePopup(true);
      }
    } catch (err) {
      console.error('❌ [Google Auth] Erreur:', err);
      setError(err.message || 'Erreur de connexion Google');
    } finally {
      setLoading(false);
    }
  }, [googleLogin, navigate]);

  // Store callback in ref to avoid re-running the effect
  const googleCallbackRef = useRef(handleGoogleCallback);
  useEffect(() => { googleCallbackRef.current = handleGoogleCallback; }, [handleGoogleCallback]);

  // Load Google Identity Services — runs ONCE
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn('⚠️ [Google Auth] GOOGLE_CLIENT_ID non défini. Le bouton Google Sign-In ne sera pas affiché.');
      return;
    }
    console.log('🔄 [Google Auth] Chargement GSI... client_id =', GOOGLE_CLIENT_ID);
    console.log('🌐 [Google Auth] Origin actuel =', window.location.origin);

    // Wrapper stable qui appelle toujours la dernière version du callback
    const stableCallback = (response) => googleCallbackRef.current(response);

    const initGsi = () => {
      if (!window.google?.accounts?.id) return;
      console.log('✅ [Google Auth] GSI chargé, initialisation...');
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: stableCallback,
      });
      
      // Rendre le bouton Google après l'initialisation
      setTimeout(() => {
        const buttonContainer = document.getElementById('google-login-btn');
        if (buttonContainer) {
          window.google.accounts.id.renderButton(
            buttonContainer,
            { theme: 'filled_black', size: 'large', width: '100%', text: 'signin_with', shape: 'pill', locale: 'fr' }
          );
          console.log('✅ [Google Auth] Bouton Google rendu');
        }
      }, 500);
    };

    // If GSI already loaded (e.g. from Register page or Strict Mode re-run), just init
    if (window.google?.accounts?.id) {
      initGsi();
      return;
    }

    // Check if script tag already exists (avoid duplicates)
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      // Script exists but hasn't finished loading — wait for it
      existing.addEventListener('load', initGsi);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGsi;
    script.onerror = () => {
      console.error('❌ [Google Auth] Impossible de charger le script GSI');
    };
    document.head.appendChild(script);
    // Don't remove the script on cleanup — it's shared across pages
  }, []);

  // Rediriger automatiquement si déjà connecté
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (!user.workspaceId && user.role !== 'super_admin') {
        navigate('/ecom/workspace-setup', { replace: true });
        return;
      }
      const roleDashboardMap = {
        'super_admin': '/ecom/super-admin',
        'ecom_admin': '/ecom/dashboard/admin',
        'ecom_closeuse': '/ecom/dashboard/closeuse',
        'ecom_compta': '/ecom/dashboard/compta',
        'livreur': '/ecom/livreur'
      };
      const dashboardPath = roleDashboardMap[user.role] || '/ecom/dashboard';
      navigate(dashboardPath, { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Afficher un loader pendant la vérification de l'authentification
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Vérification de la session...</p>
        </div>
      </div>
    );
  }

  // Si déjà authentifié, ne pas afficher le formulaire (la redirection est en cours)
  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Redirection vers votre espace...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(formData.email, formData.password);
      // Afficher la popup d'enregistrement d'appareil
      setShowDevicePopup(true);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDevice = async () => {
    setRegisteringDevice(true);
    try {
      await registerDevice();
      setShowDevicePopup(false);
      navigate('/ecom/dashboard');
    } catch (error) {
      console.error('Erreur enregistrement appareil:', error);
      // Continuer vers le dashboard même si l'enregistrement échoue
      setShowDevicePopup(false);
      navigate('/ecom/dashboard');
    } finally {
      setRegisteringDevice(false);
    }
  };

  const handleSkipDevice = () => {
    setShowDevicePopup(false);
    navigate('/ecom/dashboard');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex relative overflow-hidden">
      {/* Left side — Branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-10 w-72 h-72 bg-blue-600/15 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-20 left-10 w-72 h-72 bg-purple-600/15 rounded-full blur-[100px]"></div>
        </div>
        <div className="relative">
          <button onClick={() => navigate('/ecom')} className="group">
            <img src="/ecom-logo (1).png" alt="Ecom Cockpit" className="h-16 object-contain group-hover:opacity-80 transition" />
          </button>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Bon retour<br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">parmi nous.</span>
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-sm mb-8">
            Retrouvez vos commandes, votre équipe et vos statistiques en un clic. Votre cockpit vous attend.
          </p>
          <div className="flex items-center gap-4">
            {[
              { number: '500+', label: 'Utilisateurs actifs' },
              { number: '50K+', label: 'Commandes traitées' },
              { number: '99.9%', label: 'Disponibilité' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-xl font-bold text-white">{stat.number}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Connexion sécurisée
          </div>
          <span className="text-gray-700">•</span>
          <span className="text-xs text-gray-500">Chiffrement AES-256</span>
          <span className="text-gray-700">•</span>
          <button onClick={() => navigate('/ecom/privacy')} className="text-xs text-gray-500 hover:text-gray-300 transition underline underline-offset-2">
            Confidentialité
          </button>
        </div>
      </div>

      {/* Right side — Form */}
      <div className="flex-1 flex flex-col justify-center py-8 px-6 sm:px-10 lg:px-20">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <button onClick={() => navigate('/ecom')} className="inline-block mb-4">
              <img src="/ecom-logo (1).png" alt="Ecom Cockpit" className="h-12 object-contain" />
            </button>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Se connecter</h1>
            <p className="mt-1 text-gray-400 text-sm">Accédez à votre espace de travail</p>
          </div>

          {/* Form card */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 sm:p-7 backdrop-blur-sm">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">Adresse email</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </span>
                  <input id="email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={handleInputChange} placeholder="votre@email.com"
                    className="block w-full pl-10 pr-3.5 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </span>
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={formData.password} onChange={handleInputChange} placeholder="Votre mot de passe"
                    className="block w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                  </button>
                </div>
                <div className="flex justify-end mt-1.5">
                  <button type="button" onClick={() => navigate('/ecom/forgot-password')} className="text-xs text-blue-400 hover:text-blue-300 font-medium transition">
                    Mot de passe oublié ?
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-blue-600/20">
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connexion en cours...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Se connecter
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </span>
                )}
              </button>
            </form>

            {/* Google Sign-In */}
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-gray-800"></div>
                <span className="text-xs text-gray-500">ou</span>
                <div className="flex-1 h-px bg-gray-800"></div>
              </div>
              {/* Google Sign-In button container */}
              <div id="google-login-btn" className="w-full mt-2"></div>
              
              {/* Fallback button */}
              <button
                id="google-login-fallback"
                type="button"
                onClick={() => {
                  // If GSI is already loaded, use prompt
                  if (window.google?.accounts?.id) {
                    try {
                      window.google.accounts.id.prompt((notification) => {
                        console.log('🔔 [Google Auth] Prompt notification:', notification);
                        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                          // One Tap not shown — re-render the button
                          window.google.accounts.id.renderButton(
                            document.getElementById('google-login-btn'),
                            { theme: 'filled_black', size: 'large', width: '100%', text: 'signin_with', shape: 'pill', locale: 'fr' }
                          );
                        }
                      });
                    } catch (e) {
                      console.error('❌ [Google Auth] Erreur prompt:', e);
                    }
                    return;
                  }

                  // GSI not loaded — load it now
                  console.log('🔄 [Google Auth] Chargement GSI à la demande...');
                  setError('');
                  const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
                  if (existingScript) existingScript.remove();

                  const script = document.createElement('script');
                  script.src = 'https://accounts.google.com/gsi/client';
                  script.async = true;
                  script.onload = () => {
                    if (window.google?.accounts?.id) {
                      console.log('✅ [Google Auth] GSI chargé à la demande');
                      window.google.accounts.id.initialize({
                        client_id: GOOGLE_CLIENT_ID,
                        callback: handleGoogleCallback,
                      });
                      window.google.accounts.id.prompt();
                    } else {
                      setError('Impossible de charger Google Sign-In. Désactivez votre bloqueur de pubs et réessayez.');
                    }
                  };
                  script.onerror = () => {
                    setError('Impossible de charger Google Sign-In. Vérifiez votre connexion internet.');
                  };
                  document.head.appendChild(script);
                }}
                className="w-full mt-2 flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-800 transition border border-gray-200/20 shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Se connecter avec Google
              </button>
            </div>

            {/* Security badge */}
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-600">
              <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Connexion sécurisée • Chiffrement de bout en bout • Zéro tracking
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-800"></div>
            <span className="text-xs text-gray-500">pas encore de compte ?</span>
            <div className="flex-1 h-px bg-gray-800"></div>
          </div>

          {/* Register links */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => navigate('/ecom/register')}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-medium text-gray-300 transition text-center flex flex-col items-center gap-1">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <span>Créer un espace</span>
            </button>
            <button onClick={() => alert('Pour rejoindre une équipe, demandez un lien d\'invitation à votre administrateur')}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-medium text-gray-300 transition text-center flex flex-col items-center gap-1">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span>Rejoindre une équipe</span>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-gray-600">
            <span>&copy; {new Date().getFullYear()} Ecom Cockpit</span>
            <span>•</span>
            <button onClick={() => navigate('/ecom/privacy')} className="text-gray-500 hover:text-gray-300 transition">Confidentialité</button>
          </div>
        </div>
      </div>

      {/* Popup d'enregistrement d'appareil */}
      {showDevicePopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full mx-auto shadow-2xl">
            {/* Icon */}
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">
                📱 Enregistrer cet appareil ?
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Ne plus jamais vous reconnecter sur cet appareil.<br />
                Votre session restera active même après fermeture du navigateur.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-2 mb-6">
              {[
                { icon: '✅', text: 'Connexion automatique à chaque visite' },
                { icon: '🔒', text: 'Session sécurisée et persistante' },
                { icon: '⚡', text: 'Accès instantané à votre espace' }
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-green-400">{benefit.icon}</span>
                  <span className="text-gray-300">{benefit.text}</span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSkipDevice}
                disabled={registeringDevice}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm font-medium text-gray-300 transition disabled:opacity-50"
              >
                Plus tard
              </button>
              <button
                onClick={handleRegisterDevice}
                disabled={registeringDevice}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {registeringDevice ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    📱 Enregistrer
                  </>
                )}
              </button>
            </div>

            {/* Note */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Vous pourrez révoquer l'accès à tout moment depuis vos paramètres
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
