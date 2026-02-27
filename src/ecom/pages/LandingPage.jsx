import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);

  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      title: 'Gestion des commandes',
      description: 'Suivez et gérez toutes vos commandes en temps réel'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      title: 'Gestion clients',
      description: 'Centralisez vos clients et prospects'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: 'Rapports & Analytics',
      description: 'Visualisez vos performances en un coup d\'œil'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Gestion financière',
      description: 'Suivez vos revenus et dépenses facilement'
    }
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* NAVBAR */}
      <nav className="w-full z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Scalor" className="h-9 object-contain" />
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <button onClick={() => navigate('/ecom/why-scalor')} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">
              Pourquoi choisir Scalor ?
            </button>
            <a href="#features" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Fonctionnalités</a>
            <button onClick={() => navigate('/ecom/tarifs')} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">
              Tarifs
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/ecom/login')} className="hidden sm:block px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition">
              Connexion
            </button>
            <button onClick={() => navigate('/ecom/register')} className="px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-600 rounded-xl transition shadow-lg shadow-emerald-600/20">
              Commencer gratuitement
            </button>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="sm:hidden p-2 text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="sm:hidden border-t border-gray-200 bg-white/95 backdrop-blur-xl px-4 py-4 space-y-2">
            <button onClick={() => { navigate('/ecom/why-scalor'); setMobileMenu(false); }} className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg">Pourquoi choisir Scalor ?</button>
            <a href="#features" onClick={() => setMobileMenu(false)} className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg">Fonctionnalités</a>
            <button onClick={() => { navigate('/ecom/tarifs'); setMobileMenu(false); }} className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg">Tarifs</button>
            <button onClick={() => navigate('/ecom/login')} className="block w-full text-left px-3 py-2 text-sm text-gray-600">Connexion</button>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative pt-16 pb-20 sm:pt-20 sm:pb-32 px-4">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute top-40 right-1/4 w-80 h-80 bg-emerald-700/10 rounded-full blur-[100px]"></div>
          <div className="absolute top-60 left-1/2 w-72 h-72 bg-emerald-700/8 rounded-full blur-[80px]"></div>
        </div>

        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-medium text-gray-700 mb-8">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            La plateforme #1 pour le e-commerce COD en Afrique
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-[1.1] mb-8 tracking-tight">
            Pilotez votre
            <br />
            <span className="bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-500 bg-clip-text text-transparent">
              empire e-commerce
            </span>
            <br />
            <span className="text-3xl sm:text-5xl lg:text-6xl text-gray-600">depuis un seul endroit</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            Commandes, clients, prospects, finances, stock, campagnes WhatsApp, rapports — <strong className="text-gray-900">tout est centralisé</strong>. 
            Votre équipe travaille ensemble, chacun avec son propre dashboard adapté à son rôle.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button onClick={() => navigate('/ecom/register')}
              className="w-full sm:w-auto px-10 py-4 text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-600 rounded-2xl font-bold text-lg transition shadow-2xl shadow-emerald-600/25 flex items-center justify-center gap-2">
              Créer mon espace gratuitement
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
            </button>
            <button onClick={() => navigate('/ecom/login')}
              className="w-full sm:w-auto px-10 py-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl font-semibold text-lg transition text-gray-700">
              J'ai déjà un compte
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              Gratuit pour commencer
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              Aucune carte requise
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              Prêt en 30 secondes
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 sm:py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4 text-gray-900">Fonctionnalités principales</h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">Tout ce dont vous avez besoin pour gérer votre e-commerce</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-emerald-200 transition">
                <div className="text-emerald-600 mb-4">{feature.icon}</div>
                <h3 className="font-bold text-lg mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 py-12 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/ecom/privacy')} className="text-sm text-gray-600 hover:text-gray-900 transition">Confidentialité</button>
              <button onClick={() => navigate('/ecom/terms')} className="text-sm text-gray-600 hover:text-gray-900 transition">Conditions</button>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center">
            <p className="text-sm text-gray-600">&copy; {new Date().getFullYear()} Scalor. Plateforme e-commerce pour l'Afrique.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
