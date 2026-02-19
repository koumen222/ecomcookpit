import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useEcomAuth();
  const [mode, setMode] = useState('create');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    workspaceName: '',
    inviteCode: '',
    selectedRole: 'ecom_closeuse',
    acceptPrivacy: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordChecks = [
    { label: '8+ caractères', valid: formData.password.length >= 8 },
    { label: 'Majuscule (A-Z)', valid: /[A-Z]/.test(formData.password) },
    { label: 'Minuscule (a-z)', valid: /[a-z]/.test(formData.password) },
    { label: 'Chiffre (0-9)', valid: /[0-9]/.test(formData.password) },
    { label: 'Symbole (!@#...)', valid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) },
  ];
  const passwordStrength = passwordChecks.filter(c => c.valid).length;

  const canProceedStep1 = formData.name.trim().length >= 2 && formData.phone.trim().length >= 6 && formData.email.includes('@');
  const canProceedStep2 = passwordStrength === 5 && formData.password === formData.confirmPassword;
  const canSubmit = formData.acceptPrivacy && (mode === 'create' ? formData.workspaceName.trim().length >= 2 : formData.inviteCode.trim().length > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        acceptPrivacy: formData.acceptPrivacy
      };

      if (mode === 'create') {
        payload.workspaceName = formData.workspaceName.trim();
      } else {
        payload.inviteCode = formData.inviteCode.trim();
        payload.selectedRole = formData.selectedRole;
      }

      await register(payload);
      navigate('/ecom/dashboard');
    } catch (error) {
      setError(error.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const nextStep = () => { setError(''); setStep(s => Math.min(s + 1, 3)); };
  const prevStep = () => { setError(''); setStep(s => Math.max(s - 1, 1)); };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex relative overflow-hidden">
      {/* Left side — Branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-600/15 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-20 right-10 w-72 h-72 bg-indigo-600/15 rounded-full blur-[100px]"></div>
        </div>
        <div className="relative">
          <button onClick={() => navigate('/ecom')} className="group">
            <img src="/ecom-logo (1).png" alt="Ecom Cockpit" className="h-16 object-contain group-hover:opacity-80 transition" />
          </button>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Gérez votre business<br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">comme un pro.</span>
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-sm mb-8">
            Rejoignez des centaines d'e-commerçants qui utilisent Ecom Cockpit pour centraliser commandes, clients et finances.
          </p>
          <div className="flex flex-wrap gap-3">
            {['Commandes', 'Clients', 'Finances', 'Marketing', 'Stock', 'Équipe'].map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                {f}
              </span>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Données chiffrées & protégées
          </div>
          <span className="text-gray-700">•</span>
          <span className="text-xs text-gray-500">Zéro cookie publicitaire</span>
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
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Créer votre compte</h1>
            <p className="mt-1 text-gray-400 text-sm">Étape {step} sur 3 — {step === 1 ? 'Vos informations' : step === 2 ? 'Sécurité' : 'Votre espace'}</p>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-blue-600' : 'bg-gray-800'}`}></div>
            ))}
          </div>

          {/* Form card */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 sm:p-7 backdrop-blur-sm">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2 mb-5">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* ═══ STEP 1: Informations personnelles ═══ */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom complet</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </span>
                      <input name="name" type="text" required placeholder="Votre nom et prénom" value={formData.name} onChange={handleInputChange}
                        className="block w-full pl-10 pr-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Numéro de téléphone</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </span>
                      <input name="phone" type="tel" required placeholder="+237 6XX XXX XXX" value={formData.phone} onChange={handleInputChange}
                        className="block w-full pl-10 pr-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Adresse email</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </span>
                      <input name="email" type="email" autoComplete="email" required placeholder="votre@email.com" value={formData.email} onChange={handleInputChange}
                        className="block w-full pl-10 pr-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                    </div>
                  </div>

                  <button type="button" onClick={nextStep} disabled={!canProceedStep1}
                    className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                    Continuer
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </button>
                </div>
              )}

              {/* ═══ STEP 2: Mot de passe ═══ */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Mot de passe</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </span>
                      <input name="password" type={showPassword ? 'text' : 'password'} required placeholder="Créez un mot de passe sécurisé" value={formData.password} onChange={handleInputChange}
                        className="block w-full pl-10 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                      </button>
                    </div>
                    {/* Password strength */}
                    {formData.password && (
                      <div className="mt-3">
                        <div className="flex gap-1 mb-2">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition ${i <= passwordStrength ? (passwordStrength <= 2 ? 'bg-red-500' : passwordStrength <= 3 ? 'bg-yellow-500' : 'bg-emerald-500') : 'bg-gray-800'}`}></div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {passwordChecks.map((c, i) => (
                            <span key={i} className={`text-[10px] flex items-center gap-1 ${c.valid ? 'text-emerald-400' : 'text-gray-600'}`}>
                              {c.valid ? '✓' : '○'} {c.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirmer le mot de passe</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </span>
                      <input name="confirmPassword" type="password" required placeholder="Retapez le mot de passe" value={formData.confirmPassword} onChange={handleInputChange}
                        className="block w-full pl-10 pr-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                    </div>
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="text-red-400 text-xs mt-1.5">Les mots de passe ne correspondent pas</p>
                    )}
                    {formData.confirmPassword && formData.password === formData.confirmPassword && (
                      <p className="text-emerald-400 text-xs mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        Mots de passe identiques
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button type="button" onClick={prevStep} className="px-4 py-3 rounded-xl text-sm font-medium text-gray-400 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                    </button>
                    <button type="button" onClick={nextStep} disabled={!canProceedStep2}
                      className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                      Continuer
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ STEP 3: Workspace + Privacy ═══ */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Mode selector */}
                  <div className="flex rounded-xl bg-gray-800 p-1 mb-2">
                    <button type="button" onClick={() => { setMode('create'); setError(''); }}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${mode === 'create' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
                      Créer un espace
                    </button>
                    <button type="button" onClick={() => { setMode('join'); setError(''); }}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${mode === 'join' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
                      Rejoindre une équipe
                    </button>
                  </div>

                  {mode === 'create' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom de votre espace</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </span>
                        <input name="workspaceName" type="text" required placeholder="Ex: Ma Boutique, Mon Business..." value={formData.workspaceName} onChange={handleInputChange}
                          className="block w-full pl-10 pr-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500">Vous pourrez inviter votre équipe ensuite</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Code d'invitation</label>
                        <input name="inviteCode" type="text" required placeholder="Collez le code reçu de votre admin" value={formData.inviteCode} onChange={handleInputChange}
                          className="block w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono tracking-wider transition" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Votre rôle</label>
                        <select name="selectedRole" value={formData.selectedRole} onChange={handleInputChange}
                          className="block w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition">
                          <option value="ecom_closeuse">Closeuse</option>
                          <option value="ecom_compta">Comptable</option>
                          <option value="ecom_livreur">Livreur</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* Privacy acceptance */}
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" name="acceptPrivacy" checked={formData.acceptPrivacy} onChange={handleInputChange}
                        className="mt-0.5 w-5 h-5 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer" />
                      <div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          J'accepte la{' '}
                          <button type="button" onClick={() => window.open('/privacy', '_blank')} className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium transition">
                            politique de confidentialité
                          </button>
                          {' '}et je consens au traitement sécurisé de mes données.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[
                            { 
                              icon: (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              ), 
                              text: 'Mot de passe chiffré' 
                            },
                            { 
                              icon: (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              ), 
                              text: 'Zéro tracking' 
                            },
                            { 
                              icon: (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                              ), 
                              text: 'Actions auditées' 
                            },
                          ].map((b, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[10px] text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              {b.icon} {b.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button type="button" onClick={prevStep} className="px-4 py-3 rounded-xl text-sm font-medium text-gray-400 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                    </button>
                    <button type="submit" disabled={loading || !canSubmit}
                      className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Création en cours...
                        </span>
                      ) : (
                        <>
                          {mode === 'create' ? 'Créer mon espace' : 'Rejoindre l\'équipe'}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-800"></div>
            <span className="text-xs text-gray-500">déjà un compte ?</span>
            <div className="flex-1 h-px bg-gray-800"></div>
          </div>

          <button onClick={() => navigate('/ecom/login')}
            className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-medium text-gray-300 transition text-center">
            Se connecter
          </button>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-gray-600">
            <span>&copy; {new Date().getFullYear()} Ecom Cockpit</span>
            <span>•</span>
            <button onClick={() => navigate('/ecom/privacy')} className="text-gray-500 hover:text-gray-300 transition">Confidentialité</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
