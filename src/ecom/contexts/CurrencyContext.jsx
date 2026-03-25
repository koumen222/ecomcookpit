import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { getCurrencyInfo, formatMoney } from '../utils/currency.js';

// Taux de conversion approximatifs (base XAF/FCFA)
// En production, ces taux devraient venir d'une API
export const conversionRates = {
  XAF: 1,
  XOF: 1,        // Même valeur que XAF
  CDF: 3.5,      // 1 FCFA = 3.5 CDF
  NGN: 1.35,     // 1 FCFA = 1.35 NGN
  GHS: 0.0095,   // 1 FCFA = 0.0095 GHS
  GNF: 15,       // 1 FCFA = 15 GNF
  LRD: 0.28,     // 1 FCFA = 0.28 LRD
  SLL: 0.28,     // 1 FCFA = 0.28 SLL
  MAD: 0.015,    // 1 FCFA = 0.015 MAD
  TND: 0.0046,   // 1 FCFA = 0.0046 TND
  DZD: 0.22,     // 1 FCFA = 0.22 DZD
  EGP: 0.083,    // 1 FCFA = 0.083 EGP
  LYD: 0.0074,   // 1 FCFA = 0.0074 LYD
  KES: 0.22,     // 1 FCFA = 0.22 KES
  UGX: 6.2,      // 1 FCFA = 6.2 UGX
  TZS: 4.5,      // 1 FCFA = 4.5 TZS
  RWF: 1.8,      // 1 FCFA = 1.8 RWF
  BIF: 3.6,      // 1 FCFA = 3.6 BIF
  ETB: 0.094,    // 1 FCFA = 0.094 ETB
  SOS: 0.10,     // 1 FCFA = 0.10 SOS
  SDG: 0.093,    // 1 FCFA = 0.093 SDG
  SSP: 1.1,      // 1 FCFA = 1.1 SSP
  ERN: 0.26,     // 1 FCFA = 0.26 ERN
  DJF: 0.30,     // 1 FCFA = 0.30 DJF
  ZAR: 0.030,    // 1 FCFA = 0.030 ZAR
  BWP: 0.022,    // 1 FCFA = 0.022 BWP
  NAD: 0.030,    // 1 FCFA = 0.030 NAD
  ZMW: 0.038,    // 1 FCFA = 0.038 ZMW
  MZN: 0.11,     // 1 FCFA = 0.11 MZN
  MWK: 1.5,      // 1 FCFA = 1.5 MWK
  SZL: 0.030,    // 1 FCFA = 0.030 SZL
  LSL: 0.030,    // 1 FCFA = 0.030 LSL
  AOA: 1.5,      // 1 FCFA = 1.5 AOA
  ZWL: 5.0,      // 1 FCFA = 5.0 ZWL (approximatif)
  USD: 0.0016,   // 1 FCFA = 0.0016 USD
  EUR: 0.0015,   // 1 FCFA = 0.0015 EUR
  GBP: 0.0013,   // 1 FCFA = 0.0013 GBP
  CAD: 0.0022,   // 1 FCFA = 0.0022 CAD
  CNY: 0.012     // 1 FCFA = 0.012 CNY
};

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const { user } = useEcomAuth();

  // Gestion robuste de la devise avec fallback
  const currencyCode = user?.currency || 'XAF';
  const currencyInfo = getCurrencyInfo(currencyCode);

  // Convertir un montant de la devise source vers la devise de l'utilisateur
  // useCallback garantit que la fonction capture toujours le bon currencyCode
  const convert = useCallback((amount, fromCurrency) => {
    if (!fromCurrency) fromCurrency = currencyCode;
    if (amount === undefined || amount === null) return null;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return null;

    // Si même devise, pas de conversion nécessaire
    if (fromCurrency === currencyCode) return numAmount;

    // Convertir d'abord en XAF (base)
    const baseRate = conversionRates[fromCurrency] || 1;
    const amountInXAF = numAmount / baseRate;

    // Puis convertir en devise cible
    const targetRate = conversionRates[currencyCode] || 1;
    return amountInXAF * targetRate;
  }, [currencyCode]);

  // Formater un montant dans la devise de l'utilisateur
  const format = useCallback((amount, fromCurrency) => {
    try {
      const converted = convert(amount, fromCurrency);
      return formatMoney(converted, currencyCode);
    } catch (error) {
      console.warn('⚠️ Erreur de formatage de devise:', error);
      return `${Number(amount || 0).toLocaleString('fr-FR')} ${currencyCode}`;
    }
  }, [currencyCode, convert]);

  // Formater sans conversion (montant déjà dans la devise cible)
  const formatRaw = useCallback((amount) => {
    try {
      return formatMoney(amount, currencyCode);
    } catch (error) {
      console.warn('⚠️ Erreur de formatage raw:', error);
      return `${Number(amount || 0).toLocaleString('fr-FR')} ${currencyCode}`;
    }
  }, [currencyCode]);

  const value = useMemo(() => ({
    code: currencyCode,
    ...currencyInfo,
    convert,
    format,
    formatRaw,
    rates: conversionRates
  }), [currencyCode, currencyInfo, convert, format, formatRaw]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency doit être utilisé dans un CurrencyProvider');
  }
  return context;
};

// Hook pour formater facilement les montants
export const useFormatMoney = () => {
  const { format, formatRaw } = useCurrency();
  return { format, formatRaw };
};
