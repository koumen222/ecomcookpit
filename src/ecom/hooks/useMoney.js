import { useCurrency } from '../contexts/CurrencyContext.jsx';
import { getCurrencyInfo } from '../utils/currency.js';

// Helper to clean amount value (hors du hook pour éviter les re-créations)
const cleanAmount = (amount) => {
  if (amount === null || amount === undefined) return 0;
  // Remove Google Sheets apostrophe prefix and any non-numeric chars except . and ,
  const cleaned = String(amount).replace(/^'+/, '').replace(/[^0-9.,]/g, '');
  return Number(cleaned) || 0;
};

// Hook simple pour formater les montants dans la devise de l'utilisateur
export const useMoney = () => {
  try {
    const context = useCurrency();
    const code = context.code;
    return {
      // Formater un montant (conversion depuis fromCurrency vers devise utilisateur)
      fmt: (amount, fromCurrency) => context.format(cleanAmount(amount), fromCurrency || code),

      // Formater en compact (K, M) pour mobile
      fmtCompact: (amount, fromCurrency) => {
        const converted = context.convert(cleanAmount(amount), fromCurrency || code);
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
      convert: (amount, fromCurrency) => context.convert(cleanAmount(amount), fromCurrency || code),

      // Infos de la devise
      currency: code,
      symbol: context.symbol
    };
  } catch (error) {
    console.warn('⚠️ CurrencyContext non disponible, utilisation du fallback');

    // Fallback robuste — lire la devise de l'utilisateur depuis localStorage
    let userCurrency = 'XAF';
    try {
      const stored = JSON.parse(localStorage.getItem('ecomUser') || '{}');
      if (stored?.currency) userCurrency = stored.currency;
    } catch (_) {}
    const info = getCurrencyInfo(userCurrency);

    return {
      fmt: (amount) => {
        const num = cleanAmount(amount);
        return `${num.toLocaleString('fr-FR')} ${info.symbol}`;
      },

      fmtCompact: (amount) => {
        const num = cleanAmount(amount);
        const abs = Math.abs(num);
        if (abs >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + `M ${info.symbol}`;
        if (abs >= 1_000) return (num / 1_000).toFixed(1).replace('.0', '') + `K ${info.symbol}`;
        return `${num.toLocaleString('fr-FR')} ${info.symbol}`;
      },

      fmtRaw: (amount) => {
        const num = cleanAmount(amount);
        return `${num.toLocaleString('fr-FR')} ${info.symbol}`;
      },

      convert: (amount) => cleanAmount(amount),

      currency: userCurrency,
      symbol: info.symbol
    };
  }
};

export default useMoney;
