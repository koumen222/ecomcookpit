import React from 'react';

const HeroSection = ({ config, theme }) => {
  const { title, subtitle, ctaText, bgImage } = config || {};
  
  return (
    <section 
      className="relative py-20 px-4 text-center"
      style={{
        backgroundColor: theme?.backgroundColor || '#f9fafb',
        backgroundImage: bgImage ? `url(${bgImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {bgImage && <div className="absolute inset-0 bg-black/40" />}
      
      <div className="relative max-w-4xl mx-auto">
        <h1 
          className="text-4xl md:text-6xl font-black mb-4"
          style={{ 
            color: bgImage ? '#fff' : (theme?.textColor || '#111'),
            fontFamily: theme?.fontFamily || 'inherit'
          }}
        >
          {title || 'Bienvenue dans notre boutique'}
        </h1>
        
        {subtitle && (
          <p 
            className="text-lg md:text-xl mb-8 opacity-90"
            style={{ color: bgImage ? '#fff' : (theme?.textColor || '#111') }}
          >
            {subtitle}
          </p>
        )}
        
        {ctaText && (
          <a
            href="#products"
            className="inline-block px-8 py-4 rounded-xl font-bold text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            style={{ 
              backgroundColor: theme?.ctaColor || '#0F6B4F',
              borderRadius: theme?.borderRadius || '0.75rem'
            }}
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  );
};

export default HeroSection;
