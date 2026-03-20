import { useMemo, useCallback } from 'react';
import { useCurrency } from '../contexts/CurrencyContext.jsx';

// Helper to clean amount value (hors du hook pour éviter les re-créations)
const cleanAmount = (amount) => {
  if (amount === null || amount === undefined) return 0;
  // Remove Google Sheets apostrophe prefix and any non-numeric chars except . and ,
  const cleaned = String(amount).replace(/^'+/, '').replace(/[^0-9.,]/g, '');
  return Number(cleaned) || 0;
};

// Hook simple pour formater les montants dans la devise de l'utilisateur
export const useMoney = () => {
  let context = null;
  let hasContext = false;

  try {
    context = useCurrency();
    hasContext = true;
  } catch (error) {
    console.warn('⚠️ CurrencyContext non disponible, utilisation du fallback');
  }

  const code = hasContext ? context.code : 'XAF';
  const symbol = hasContext ? context.symbol : 'FCFA';

  // Memoïser les fonctions pour éviter les re-renders
  const fmt = useCallback((amount, fromCurrency = 'XAF') => {
    if (hasContext) {
      return context.format(cleanAmount(amount), fromCurrency);
    }
    const num = cleanAmount(amount);
    return `${num.toLocaleString('fr-FR')} FCFA`;
  }, [hasContext, context?.format]);

  const fmtCompact = useCallback((amount, fromCurrency = 'XAF') => {
    const num = hasContext
      ? Number(context.convert(cleanAmount(amount), fromCurrency))
      : cleanAmount(amount);

    if (isNaN(num)) return `0 ${symbol}`;
    const abs = Math.abs(num);
    if (abs >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + `M ${symbol}`;
    if (abs >= 1_000) return (num / 1_000).toFixed(1).replace('.0', '') + `K ${symbol}`;
    return `${num.toLocaleString('fr-FR')} ${symbol}`;
  }, [hasContext, context?.convert, symbol]);

  const fmtRaw = useCallback((amount) => {
    if (hasContext) {
      return context.formatRaw(cleanAmount(amount));
    }
    const num = cleanAmount(amount);
    return `${num.toLocaleString('fr-FR')} FCFA`;
  }, [hasContext, context?.formatRaw]);

  const convert = useCallback((amount, fromCurrency = 'XAF') => {
    if (hasContext) {
      return context.convert(cleanAmount(amount), fromCurrency);
    }
    return cleanAmount(amount);
  }, [hasContext, context?.convert]);

  return useMemo(() => ({
    fmt,
    fmtCompact,
    fmtRaw,
    convert,
    currency: code,
    symbol
  }), [fmt, fmtCompact, fmtRaw, convert, code, symbol]);
};

export default useMoney;
