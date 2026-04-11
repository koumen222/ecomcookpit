/**
 * Currency conversion utility for backend revenue calculations.
 * All rates are relative to XAF (1 XAF = X target currency).
 */

// Taux de conversion approximatifs (base XAF/FCFA)
export const conversionRates = {
  XAF: 1,
  XOF: 1,
  CDF: 3.5,
  NGN: 1.35,
  GHS: 0.0095,
  GNF: 15,
  LRD: 0.28,
  SLL: 0.28,
  MAD: 0.015,
  TND: 0.0046,
  DZD: 0.22,
  EGP: 0.083,
  LYD: 0.0074,
  KES: 0.22,
  UGX: 6.2,
  TZS: 4.5,
  RWF: 1.8,
  BIF: 3.6,
  ETB: 0.094,
  SOS: 0.10,
  SDG: 0.093,
  SSP: 1.1,
  ERN: 0.26,
  DJF: 0.30,
  ZAR: 0.030,
  BWP: 0.022,
  NAD: 0.030,
  ZMW: 0.038,
  MZN: 0.11,
  MWK: 1.5,
  SZL: 0.030,
  LSL: 0.030,
  AOA: 1.5,
  ZWL: 5.0,
  USD: 0.0016,
  EUR: 0.0015,
  GBP: 0.0013,
  CAD: 0.0022,
  CNY: 0.012,
};

/**
 * Convert an amount from one currency to another.
 * @param {number} amount
 * @param {string} fromCurrency - source currency code
 * @param {string} toCurrency - target currency code
 * @returns {number}
 */
export function convertCurrency(amount, fromCurrency, toCurrency) {
  if (!amount || isNaN(amount)) return 0;
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return amount;

  const fromRate = conversionRates[fromCurrency] || 1;
  const toRate = conversionRates[toCurrency] || 1;

  // Convert to XAF first, then to target
  const amountInXAF = amount / fromRate;
  return amountInXAF * toRate;
}
