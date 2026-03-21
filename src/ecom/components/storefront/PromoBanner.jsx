import React from 'react';

const PromoBanner = ({ config, theme }) => {
  const { text, bgColor = '#EF4444' } = config || {};
  
  if (!text) return null;
  
  return (
    <div 
      className="py-4 px-4 text-center"
      style={{ backgroundColor: bgColor }}
    >
      <p 
        className="text-white font-bold text-sm md:text-base"
        style={{ fontFamily: theme?.fontFamily || 'inherit' }}
      >
        {text}
      </p>
    </div>
  );
};

export default PromoBanner;
