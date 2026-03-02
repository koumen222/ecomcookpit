import React, { useEffect } from 'react';
import { useSubdomain, useStorefront } from '../hooks/useStorefront';
import HeroSection from '../components/storefront/HeroSection';
import FeaturedProducts from '../components/storefront/FeaturedProducts';
import PromoBanner from '../components/storefront/PromoBanner';
import Footer from '../components/storefront/Footer';

const PublicStorefront = () => {
  const subdomain = useSubdomain();
  const { store, products, loading, error } = useStorefront(subdomain);

  // Appliquer le thème dynamiquement
  useEffect(() => {
    if (store) {
      document.title = store.name || 'Boutique';
      
      // Appliquer la police globalement
      if (store.font) {
        document.body.style.fontFamily = getFontFamily(store.font);
      }
    }
  }, [store]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-[#0F6B4F] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement de la boutique...</p>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Boutique introuvable</h1>
          <p className="text-gray-600 mb-6">{error || 'Cette boutique n\'existe pas ou n\'est pas encore configurée.'}</p>
          <a 
            href="https://scalor.net" 
            className="inline-block px-6 py-3 bg-[#0F6B4F] text-white font-semibold rounded-xl hover:bg-[#0A5740] transition"
          >
            Créer ma boutique
          </a>
        </div>
      </div>
    );
  }

  // Récupérer les sections configurées (depuis storePages)
  const sections = store.sections || getDefaultSections();
  
  // Construire le thème
  const theme = {
    backgroundColor: store.backgroundColor || '#ffffff',
    textColor: store.textColor || '#111827',
    ctaColor: store.themeColor || '#0F6B4F',
    fontFamily: getFontFamily(store.font || 'inter'),
    borderRadius: getBorderRadius(store.borderRadius || 'md'),
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.backgroundColor }}>
      {/* Header avec logo et nom */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {store.logo ? (
              <img src={store.logo} alt={store.name} className="h-8 object-contain" />
            ) : (
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: theme.ctaColor + '20' }}
              >
                <svg className="w-5 h-5" style={{ color: theme.ctaColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            )}
            <span className="font-bold text-lg" style={{ color: theme.textColor, fontFamily: theme.fontFamily }}>
              {store.name}
            </span>
          </div>
          
          {store.whatsapp && (
            <a
              href={`https://wa.me/${store.whatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg font-semibold text-white text-sm hover:opacity-90 transition"
              style={{ backgroundColor: theme.ctaColor, borderRadius: theme.borderRadius }}
            >
              Commander
            </a>
          )}
        </div>
      </header>

      {/* Rendu dynamique des sections */}
      {sections.filter(s => s.enabled).map((section, idx) => {
        switch (section.type) {
          case 'hero':
            return <HeroSection key={idx} config={section.config} theme={theme} />;
          case 'featured_products':
            return <FeaturedProducts key={idx} config={section.config} products={products} currency={store.currency} theme={theme} />;
          case 'promo_banner':
            return <PromoBanner key={idx} config={section.config} theme={theme} />;
          case 'footer':
            return <Footer key={idx} store={store} theme={theme} />;
          default:
            return null;
        }
      })}
    </div>
  );
};

// Helpers
const getFontFamily = (fontId) => {
  const fonts = {
    inter: 'Inter, sans-serif',
    poppins: 'Poppins, sans-serif',
    'dm-sans': '"DM Sans", sans-serif',
    montserrat: 'Montserrat, sans-serif',
    playfair: '"Playfair Display", serif',
    'space-grotesk': '"Space Grotesk", sans-serif',
  };
  return fonts[fontId] || fonts.inter;
};

const getBorderRadius = (radiusId) => {
  const radii = {
    none: '0',
    sm: '0.375rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  };
  return radii[radiusId] || radii.md;
};

const getDefaultSections = () => [
  { type: 'hero', enabled: true, config: { title: 'Bienvenue', subtitle: '', ctaText: 'Voir nos produits' } },
  { type: 'featured_products', enabled: true, config: { count: 8, title: 'Nos Produits' } },
  { type: 'footer', enabled: true, config: {} },
];

export default PublicStorefront;
