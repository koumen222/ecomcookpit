// Currency configuration
export const currencies = {
  // Afrique Centrale
  XAF: { code: 'XAF', name: 'Franc CFA (CEMAC)', symbol: 'FCFA', locale: 'fr-FR', flag: '🇨🇲', region: 'Afrique Centrale' },
  
  // Afrique de l'Ouest
  XOF: { code: 'XOF', name: 'Franc CFA (UEMOA)', symbol: 'CFA', locale: 'fr-FR', flag: '🇸🇳', region: 'Afrique de l\'Ouest' },
  NGN: { code: 'NGN', name: 'Naira Nigérian', symbol: '₦', locale: 'en-NG', flag: '🇳🇬', region: 'Afrique de l\'Ouest' },
  GHS: { code: 'GHS', name: 'Cedi Ghanéen', symbol: 'GH₵', locale: 'en-GH', flag: '🇬🇭', region: 'Afrique de l\'Ouest' },
  GNF: { code: 'GNF', name: 'Franc Guinéen', symbol: 'FG', locale: 'fr-GN', flag: '🇬🇳', region: 'Afrique de l\'Ouest' },
  LRD: { code: 'LRD', name: 'Dollar Libérien', symbol: 'L$', locale: 'en-LR', flag: '🇱🇷', region: 'Afrique de l\'Ouest' },
  SLL: { code: 'SLL', name: 'Leone Sierra-Léonais', symbol: 'Le', locale: 'en-SL', flag: '🇸🇱', region: 'Afrique de l\'Ouest' },
  
  // Afrique du Nord
  MAD: { code: 'MAD', name: 'Dirham Marocain', symbol: 'DH', locale: 'ar-MA', flag: '🇲🇦', region: 'Afrique du Nord' },
  TND: { code: 'TND', name: 'Dinar Tunisien', symbol: 'DT', locale: 'ar-TN', flag: '🇹🇳', region: 'Afrique du Nord' },
  DZD: { code: 'DZD', name: 'Dinar Algérien', symbol: 'DA', locale: 'ar-DZ', flag: '🇩🇿', region: 'Afrique du Nord' },
  EGP: { code: 'EGP', name: 'Livre Égyptienne', symbol: 'E£', locale: 'ar-EG', flag: '🇪🇬', region: 'Afrique du Nord' },
  LYD: { code: 'LYD', name: 'Dinar Libyen', symbol: 'LD', locale: 'ar-LY', flag: '🇱🇾', region: 'Afrique du Nord' },
  
  // Afrique de l'Est
  KES: { code: 'KES', name: 'Shilling Kenyan', symbol: 'KSh', locale: 'en-KE', flag: '🇰🇪', region: 'Afrique de l\'Est' },
  UGX: { code: 'UGX', name: 'Shilling Ougandais', symbol: 'USh', locale: 'en-UG', flag: '🇺�', region: 'Afrique de l\'Est' },
  TZS: { code: 'TZS', name: 'Shilling Tanzanien', symbol: 'TSh', locale: 'en-TZ', flag: '🇹🇿', region: 'Afrique de l\'Est' },
  RWF: { code: 'RWF', name: 'Franc Rwandais', symbol: 'FRw', locale: 'en-RW', flag: '🇷🇼', region: 'Afrique de l\'Est' },
  BIF: { code: 'BIF', name: 'Franc Burundais', symbol: 'FBu', locale: 'fr-BI', flag: '🇧🇮', region: 'Afrique de l\'Est' },
  ETB: { code: 'ETB', name: 'Birr Éthiopien', symbol: 'Br', locale: 'am-ET', flag: '🇪🇹', region: 'Afrique de l\'Est' },
  SOS: { code: 'SOS', name: 'Shilling Somalien', symbol: 'S', locale: 'so-SO', flag: '��', region: 'Afrique de l\'Est' },
  SDG: { code: 'SDG', name: 'Livre Soudanaise', symbol: 'SD', locale: 'ar-SD', flag: '🇸🇩', region: 'Afrique de l\'Est' },
  SSP: { code: 'SSP', name: 'Livre Sud-Soudanaise', symbol: 'SS£', locale: 'en-SS', flag: '🇸🇸', region: 'Afrique de l\'Est' },
  ERN: { code: 'ERN', name: 'Nakfa Érythréen', symbol: 'Nfk', locale: 'en-ER', flag: '🇪🇷', region: 'Afrique de l\'Est' },
  DJF: { code: 'DJF', name: 'Franc Djiboutien', symbol: 'Fdj', locale: 'fr-DJ', flag: '🇩🇯', region: 'Afrique de l\'Est' },
  
  // Afrique Australe
  ZAR: { code: 'ZAR', name: 'Rand Sud-Africain', symbol: 'R', locale: 'en-ZA', flag: '🇿🇦', region: 'Afrique Australe' },
  BWP: { code: 'BWP', name: 'Pula Botswanais', symbol: 'P', locale: 'en-BW', flag: '🇼', region: 'Afrique Australe' },
  NAD: { code: 'NAD', name: 'Dollar Namibien', symbol: 'N$', locale: 'en-NA', flag: '🇳🇦', region: 'Afrique Australe' },
  ZMW: { code: 'ZMW', name: 'Kwacha Zambien', symbol: 'K', locale: 'en-ZM', flag: '��', region: 'Afrique Australe' },
  MZN: { code: 'MZN', name: 'Metical Mozambicain', symbol: 'MT', locale: 'pt-MZ', flag: '🇲🇿', region: 'Afrique Australe' },
  MWK: { code: 'MWK', name: 'Kwacha Malawi', symbol: 'MK', locale: 'en-MW', flag: '🇲🇼', region: 'Afrique Australe' },
  SZL: { code: 'SZL', name: 'Lilangeni Eswatini', symbol: 'E', locale: 'en-SZ', flag: '🇸🇿', region: 'Afrique Australe' },
  LSL: { code: 'LSL', name: 'Loti Lesothan', symbol: 'L', locale: 'en-LS', flag: '🇱🇸', region: 'Afrique Australe' },
  
  // Autres pays d'Afrique
  CDF: { code: 'CDF', name: 'Franc Congolais (RDC)', symbol: 'FC', locale: 'fr-CD', flag: '🇨�', region: 'Afrique Centrale' },
  AOA: { code: 'AOA', name: 'Kwanza Angolais', symbol: 'Kz', locale: 'pt-AO', flag: '🇦🇴', region: 'Afrique Australe' },
  ZWL: { code: 'ZWL', name: 'Dollar Zimbabwéen', symbol: 'Z$', locale: 'en-ZW', flag: '🇿🇼', region: 'Afrique Australe' },
  
  // Internationales
  USD: { code: 'USD', name: 'Dollar US', symbol: '$', locale: 'en-US', flag: '🇺🇸', region: 'International' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', locale: 'fr-FR', flag: '🇪🇺', region: 'International' },
  GBP: { code: 'GBP', name: 'Livre Sterling', symbol: '£', locale: 'en-GB', flag: '🇬🇧', region: 'International' },
  CAD: { code: 'CAD', name: 'Dollar Canadien', symbol: 'C$', locale: 'en-CA', flag: '🇨🇦', region: 'International' },
  CNY: { code: 'CNY', name: 'Yuan Chinois', symbol: '¥', locale: 'zh-CN', flag: '🇨🇳', region: 'International' },
};

// Get currency info
export const getCurrencyInfo = (code) => {
  return currencies[code] || currencies.XAF;
};

// Format money based on currency
export const formatMoney = (amount, currencyCode = 'XAF') => {
  const currency = getCurrencyInfo(currencyCode);
  
  if (amount === undefined || amount === null) return '-';
  
  const num = parseFloat(amount);
  if (isNaN(num)) return '-';
  
  // Use no decimal places for all currencies (whole numbers only)
  const fractionDigits = 0;
  
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(num);
  } catch (e) {
    // Fallback
    return `${currency.symbol} ${num.toFixed(fractionDigits)}`;
  }
};

// Format number only (no currency symbol)
export const formatNumber = (amount, currencyCode = 'XAF') => {
  if (amount === undefined || amount === null) return '-';
  
  const num = parseFloat(amount);
  if (isNaN(num)) return '-';
  
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

import { useCurrency } from '../contexts/CurrencyContext.jsx';

// ... existing currency config ...

// Hook to use currency from auth context - AUTO CONVERT
export const useUserCurrency = () => {
  const currencyContext = useCurrency?.();
  
  if (!currencyContext) {
    // Fallback si pas dans le provider
    return {
      code: 'XAF',
      symbol: 'FCFA',
      format: (amount) => formatMoney(amount, 'XAF'),
      formatNumber: (amount) => formatNumber(amount, 'XAF'),
      convert: (amount) => parseFloat(amount || 0)
    };
  }
  
  return currencyContext;
};

// Format global qui convertit automatiquement depuis XAF (devise par défaut du backend)
export const useFormatMoney = () => {
  const { format } = useUserCurrency();
  return (amount, fromCurrency = 'XAF') => format(amount, fromCurrency);
};
