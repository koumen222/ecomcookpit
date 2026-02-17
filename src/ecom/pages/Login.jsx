import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';

const Login = () => {
  const navigate = useNavigate();
  const { login, registerDevice } = useEcomAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDevicePopup, setShowDevicePopup] = useState(false);
  const [registeringDevice, setRegisteringDevice] = useState(false);

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
            <button onClick={() => navigate('/ecom/register')}
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
