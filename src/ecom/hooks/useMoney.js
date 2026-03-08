import { useCurrency } from '../contexts/CurrencyContext.jsx';

// Hook simple pour formater les montants dans la devise de l'utilisateur
export const useMoney = () => {
  // Helper to clean amount value
  const cleanAmount = (amount) => {
    if (amount === null || amount === undefined) return 0;
    // Remove Google Sheets apostrophe prefix and any non-numeric chars except . and ,
    const cleaned = String(amount).replace(/^'+/, '').replace(/[^0-9.,]/g, '');
    return Number(cleaned) || 0;
  };

  try {
    const context = useCurrency();
    return {
      // Formater un montant (conversion automatique depuis XAF par défaut)
      fmt: (amount, fromCurrency = 'XAF') => context.format(cleanAmount(amount), fromCurrency),
      
      // Formater en compact (K, M) pour mobile
      fmtCompact: (amount, fromCurrency = 'XAF') => {
        const converted = context.convert(cleanAmount(amount), fromCurrency);
        const num = Number(converted);
        if (isNaN(num)) return `0 ${context.symbol}`;
        const abs = Math.abs(num);
        if (abs >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + `M ${context.symbol}`;
        if (abs >= 1_000) return (num / 1_000).toFixed(1).replace('.0', '') + `K ${context.symbol}`;
        return `${num.toLocaleString('fr-FR')} ${context.symbol}`;
      },
      
      // Formater sans conversion (déjà dans la devise cible)
      fmtRaw: (amount) => context.formatRaw(cleanAmount(amount)),
      
      // Convertir un montant
      convert: (amount, fromCurrency = 'XAF') => context.convert(cleanAmount(amount), fromCurrency),
      
      // Infos de la devise
      currency: context.code,
      symbol: context.symbol
    };
  } catch (error) {
    console.warn('⚠️ CurrencyContext non disponible, utilisation du fallback');
    
    // Fallback robuste si le contexte n'est pas disponible
    return {
      fmt: (amount, fromCurrency = 'XAF') => {
        const num = cleanAmount(amount);
        return `${num.toLocaleString('fr-FR')} FCFA`;
      },
      
      // Formater en compact (K, M) pour mobile
      fmtCompact: (amount) => {
        const num = cleanAmount(amount);
        const abs = Math.abs(num);
        if (abs >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + 'M FCFA';
        if (abs >= 1_000) return (num / 1_000).toFixed(1).replace('.0', '') + 'K FCFA';
        return `${num.toLocaleString('fr-FR')} FCFA`;
      },
      
      fmtRaw: (amount) => {
        const num = cleanAmount(amount);
        return `${num.toLocaleString('fr-FR')} FCFA`;
      },
      
      convert: (amount) => cleanAmount(amount),
      
      currency: 'XAF',
      symbol: 'FCFA'
    };
  }
};

export default useMoney;
