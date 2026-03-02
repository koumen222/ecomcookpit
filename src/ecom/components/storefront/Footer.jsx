import React from 'react';

const Footer = ({ store, theme }) => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer 
      className="py-12 px-4 border-t"
      style={{ 
        backgroundColor: theme?.backgroundColor || '#f9fafb',
        borderColor: '#e5e7eb'
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Info boutique */}
          <div>
            <h3 
              className="font-bold text-lg mb-3"
              style={{ 
                color: theme?.textColor || '#111',
                fontFamily: theme?.fontFamily || 'inherit'
              }}
            >
              {store?.name || 'Ma Boutique'}
            </h3>
            {store?.description && (
              <p className="text-sm text-gray-600 mb-3">{store.description}</p>
            )}
            {store?.phone && (
              <p className="text-sm text-gray-600">
                <strong>Tél:</strong> {store.phone}
              </p>
            )}
          </div>
          
          {/* Contact */}
          <div>
            <h3 
              className="font-bold text-lg mb-3"
              style={{ 
                color: theme?.textColor || '#111',
                fontFamily: theme?.fontFamily || 'inherit'
              }}
            >
              Contact
            </h3>
            {store?.whatsapp && (
              <a 
                href={`https://wa.me/${store.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm mb-2 hover:underline"
                style={{ color: theme?.ctaColor || '#0F6B4F' }}
              >
                WhatsApp: {store.whatsapp}
              </a>
            )}
          </div>
          
          {/* Logo */}
          <div className="flex items-center justify-center md:justify-end">
            {store?.logo ? (
              <img src={store.logo} alt={store.name} className="h-12 object-contain" />
            ) : (
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: (theme?.ctaColor || '#0F6B4F') + '20' }}
              >
                <svg 
                  className="w-6 h-6" 
                  style={{ color: theme?.ctaColor || '#0F6B4F' }}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            )}
          </div>
        </div>
        
        <div className="border-t pt-6 text-center text-sm text-gray-500">
          <p>© {currentYear} {store?.name || 'Ma Boutique'}. Tous droits réservés.</p>
          <p className="mt-2 text-xs">
            Propulsé par <a href="https://scalor.net" className="hover:underline" style={{ color: theme?.ctaColor || '#0F6B4F' }}>Scalor</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
