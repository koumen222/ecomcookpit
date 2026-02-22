import { useCurrency } from '../contexts/CurrencyContext.jsx';

// Hook simple pour formater les montants dans la devise de l'utilisateur
export const useMoney = () => {
  try {
    const context = useCurrency();
    return {
      // Formater un montant (conversion automatique depuis XAF par défaut)
      fmt: (amount, fromCurrency = 'XAF') => context.format(amount, fromCurrency),
      
      // Formater en compact (K, M) pour mobile
      fmtCompact: (amount, fromCurrency = 'XAF') => {
        const converted = context.convert(amount, fromCurrency);
        const num = Number(converted);
        if (isNaN(num)) return '0';
        const abs = Math.abs(num);
        if (abs >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + 'M';
        if (abs >= 1_000) return (num / 1_000).toFixed(1).replace('.0', '') + 'K';
        return num.toLocaleString('fr-FR');
      },
      
      // Formater sans conversion (déjà dans la devise cible)
      fmtRaw: (amount) => context.formatRaw(amount),
      
      // Convertir un montant
      convert: (amount, fromCurrency = 'XAF') => context.convert(amount, fromCurrency),
      
      // Infos de la devise
      currency: context.code,
      symbol: context.symbol
    };
  } catch (error) {
    console.warn('⚠️ CurrencyContext non disponible, utilisation du fallback');
    
    // Fallback robuste si le contexte n'est pas disponible
    return {
      fmt: (amount, fromCurrency = 'XAF') => {
        if (amount === null || amount === undefined) return '0 FCFA';
        const num = Number(amount);
        if (isNaN(num)) return '0 FCFA';
        return `${num.toLocaleString('fr-FR')} FCFA`;
      },
      
      // Formater en compact (K, M) pour mobile
      fmtCompact: (amount) => {
        const num = Number(amount);
        if (isNaN(num)) return '0';
        const abs = Math.abs(num);
        if (abs >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + 'M';
        if (abs >= 1_000) return (num / 1_000).toFixed(1).replace('.0', '') + 'K';
        return num.toLocaleString('fr-FR');
      },
      
      fmtRaw: (amount) => {
        if (amount === null || amount === undefined) return '0 FCFA';
        const num = Number(amount);
        if (isNaN(num)) return '0 FCFA';
        return `${num.toLocaleString('fr-FR')} FCFA`;
      },
      
      convert: (amount) => {
        if (amount === null || amount === undefined) return 0;
        return Number(amount);
      },
      
      currency: 'XAF',
      symbol: 'FCFA'
    };
  }
};

export default useMoney;
