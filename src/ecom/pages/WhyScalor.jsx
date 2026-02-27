import React from 'react';
import { useNavigate } from 'react-router-dom';

const WhyScalor = () => {
  const navigate = useNavigate();

  const advantages = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      title: 'Connexion à sa boutique en ligne',
      description: 'Connectez votre boutique en ligne existante et synchronisez automatiquement vos commandes, produits et clients. Compatible avec toutes les plateformes e-commerce populaires.',
      tags: ['Sync automatique', 'Multi-plateformes', 'Temps réel']
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Gestion des finances',
      description: 'Suivez vos revenus, dépenses et bénéfices en temps réel. Rapports financiers détaillés, calcul automatique des marges et du ROAS. Tableau de bord financier complet.',
      tags: ['Revenus', 'Dépenses', 'Bénéfices', 'ROAS']
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      title: 'Recherche de produits',
      description: 'Trouvez les produits gagnants pour votre boutique. Analysez les tendances du marché, évaluez la concurrence et identifiez les opportunités. Base de données de produits mise à jour.',
      tags: ['Tendances', 'Analyse marché', 'Produits gagnants']
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      title: 'Gestion de stock',
      description: 'Gérez votre inventaire en temps réel. Alertes de stock bas, commandes fournisseurs, suivi des arrivages. Historique complet des mouvements de stock pour une gestion optimale.',
      tags: ['Inventaire', 'Alertes', 'Fournisseurs', 'Mouvements']
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: 'Analyse business',
      description: 'Tableaux de bord avec tous vos KPIs clés. Analyse des performances par produit, par période, par source. Rapports détaillés pour prendre les meilleures décisions stratégiques.',
      tags: ['KPIs', 'Rapports', 'Performance', 'Décisions']
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* NAVBAR */}
      <nav className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button onClick={() => navigate('/ecom')} className="flex items-center gap-2">
              <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
            </button>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              <button 
                onClick={() => navigate('/ecom/why-scalor')}
                className="px-4 py-2 text-sm font-medium text-gray-900 hover:text-emerald-600 transition"
              >
                Pourquoi choisir Scalor ?
              </button>
              <button 
                onClick={() => navigate('/ecom')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                Fonctionnalités
              </button>
              <button 
                onClick={() => navigate('/ecom')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                Tarifs
              </button>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/ecom/login')}
                className="hidden sm:block px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                Connexion
              </button>
              <button 
                onClick={() => navigate('/ecom/register')}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm"
              >
                Commencer
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="py-16 sm:py-24 px-4 bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-6">
            Pourquoi choisir <span className="text-emerald-600">Scalor</span> ?
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            La plateforme tout-en-un conçue spécialement pour le e-commerce COD en Afrique. 
            Découvrez pourquoi des centaines d'e-commerçants nous font confiance.
          </p>
        </div>
      </section>

      {/* ADVANTAGES LIST */}
      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-12">
            {advantages.map((advantage, index) => (
              <div 
                key={index}
                className={`flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-8 items-center`}
              >
                {/* Icon & Title Column */}
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                      {advantage.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-3">
                        {advantage.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed mb-4">
                        {advantage.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {advantage.tags.map((tag, i) => (
                          <span 
                            key={i}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px h-32 bg-gray-200"></div>

                {/* Visual Placeholder */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full h-48 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl flex items-center justify-center">
                    <div className="text-emerald-600 opacity-20">
                      {advantage.icon}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-16 sm:py-20 px-4 bg-gradient-to-br from-emerald-600 to-emerald-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
            Prêt à transformer votre business ?
          </h2>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            Rejoignez les e-commerçants qui utilisent Scalor pour gérer leur activité. 
            Créez votre espace en 30 secondes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/ecom/register')}
              className="w-full sm:w-auto px-8 py-4 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold text-lg transition shadow-xl"
            >
              Créer mon espace gratuit
            </button>
            <button 
              onClick={() => navigate('/ecom/login')}
              className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white border-2 border-white/30 rounded-xl font-semibold text-lg transition backdrop-blur-sm"
            >
              Se connecter
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 py-12 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/ecom/privacy')} className="text-sm text-gray-600 hover:text-gray-900 transition">
                Confidentialité
              </button>
              <button onClick={() => navigate('/ecom/terms')} className="text-sm text-gray-600 hover:text-gray-900 transition">
                Conditions
              </button>
              <button onClick={() => navigate('/ecom')} className="text-sm text-gray-600 hover:text-gray-900 transition">
                Accueil
              </button>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center">
            <p className="text-sm text-gray-600">
              &copy; {new Date().getFullYear()} Scalor. Plateforme e-commerce pour l'Afrique.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WhyScalor;
