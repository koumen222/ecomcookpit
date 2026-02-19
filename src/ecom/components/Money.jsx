import React from 'react';
import { useCurrency } from '../contexts/CurrencyContext.jsx';

// Composant pour afficher un montant converti dans la devise de l'utilisateur
const Money = ({ 
  amount, 
  fromCurrency = 'XAF',
  className = '',
  showOriginal = false 
}) => {
  const { format, code } = useCurrency();
  
  if (amount === undefined || amount === null || amount === '') {
    return <span className={className}>-</span>;
  }
  
  const formatted = format(amount, fromCurrency);
  
  if (!showOriginal || fromCurrency === code) {
    return <span className={className}>{formatted}</span>;
  }
  
  // Montre aussi le montant original
  return (
    <span className={className}>
      {formatted}
      <span className="text-gray-400 text-xs ml-1">
        ({fromCurrency} {amount})
      </span>
    </span>
  );
};

export default Money;
