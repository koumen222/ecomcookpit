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
            <button onClick={() => {
              const tutorialSection = document.querySelector('[data-tutorial-section]');
              if (tutorialSection) {
                tutorialSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
              className="w-full sm:w-auto px-10 py-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl font-semibold text-lg transition text-gray-700 flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Voir le tuto
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

      {/* TUTORIEL YOUTUBE */}
      <section data-tutorial-section className="py-20 sm:py-32 px-2 sm:px-4 bg-gradient-to-br from-emerald-50 via-white to-blue-50">
        <div className="max-w-5xl mx-auto">
          {/* TITRE ET SOUS-TITRE */}
          <div className="text-center mb-16 px-2 sm:px-4">
            <h2 className="text-3xl sm:text-4xl font-black mb-4 text-gray-900">
              Maîtrisez Scalor en 
              <span className="bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent"> 15 minutes</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
              Suivez notre tutoriel complet pour découvrir comment exploiter toute la puissance de Scalor et booster votre e-commerce
            </p>
          </div>

          {/* VIDÉO */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden mb-12 mx-4 sm:mx-8 lg:mx-auto">
            <div className="relative aspect-video">
              <iframe 
                src="https://www.youtube.com/embed/405eKEysE0Q?rel=0&modestbranding=1&playsinline=1"
                title="Tutoriel Complet Scalor"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>

          {/* CONTENU ET ACTIONS */}
          <div className="text-center px-2 sm:px-4">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                🎥 Découvrez toutes les fonctionnalités
              </h3>
              <p className="text-gray-600 text-lg leading-relaxed mb-6 max-w-3xl mx-auto">
                De la création de votre premier produit à l'envoi de campagnes WhatsApp par pays, 
                ce tutoriel vous guide à travers chaque étape pour transformer votre activité e-commerce.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <a 
                href="https://youtu.be/405eKEysE0Q" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-red-600/25 hover:shadow-red-600/40"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
                Ouvrir sur YouTube
              </a>
              <button 
                onClick={() => {
                  const iframe = document.querySelector('iframe');
                  if (iframe) {
                    iframe.src = iframe.src.replace('&autoplay=0', '&autoplay=1');
                  }
                }}
                className="inline-flex items-center justify-center px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-300 transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Relancer la vidéo
              </button>
            </div>

            {/* Stats sociales */}
            <div className="inline-flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <span className="font-medium">2.5K+ vues</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                  <path d="M12 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4z"/>
                  <circle cx="18.406" cy="5.594" r="1.44"/>
                </svg>
                <span className="font-medium">150+ likes</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span className="font-medium">4.9/5 étoiles</span>
              </div>
            </div>
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
