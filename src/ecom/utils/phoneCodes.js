/**
 * Country phone codes for African + international markets.
 * Used in store order forms to prefix phone numbers for WhatsApp delivery.
 */
export const PHONE_CODES = [
  { code: '+237', country: 'CM', label: '🇨🇲 +237', name: 'Cameroun' },
  { code: '+225', country: 'CI', label: '🇨🇮 +225', name: 'Côte d\'Ivoire' },
  { code: '+221', country: 'SN', label: '🇸🇳 +221', name: 'Sénégal' },
  { code: '+228', country: 'TG', label: '🇹🇬 +228', name: 'Togo' },
  { code: '+229', country: 'BJ', label: '🇧🇯 +229', name: 'Bénin' },
  { code: '+226', country: 'BF', label: '🇧🇫 +226', name: 'Burkina Faso' },
  { code: '+223', country: 'ML', label: '🇲🇱 +223', name: 'Mali' },
  { code: '+224', country: 'GN', label: '🇬🇳 +224', name: 'Guinée' },
  { code: '+222', country: 'MR', label: '🇲🇷 +222', name: 'Mauritanie' },
  { code: '+227', country: 'NE', label: '🇳🇪 +227', name: 'Niger' },
  { code: '+235', country: 'TD', label: '🇹🇩 +235', name: 'Tchad' },
  { code: '+241', country: 'GA', label: '🇬🇦 +241', name: 'Gabon' },
  { code: '+242', country: 'CG', label: '🇨🇬 +242', name: 'Congo' },
  { code: '+243', country: 'CD', label: '🇨🇩 +243', name: 'RD Congo' },
  { code: '+240', country: 'GQ', label: '🇬🇶 +240', name: 'Guinée Éq.' },
  { code: '+236', country: 'CF', label: '🇨🇫 +236', name: 'Centrafrique' },
  { code: '+234', country: 'NG', label: '🇳🇬 +234', name: 'Nigeria' },
  { code: '+233', country: 'GH', label: '🇬🇭 +233', name: 'Ghana' },
  { code: '+212', country: 'MA', label: '🇲🇦 +212', name: 'Maroc' },
  { code: '+216', country: 'TN', label: '🇹🇳 +216', name: 'Tunisie' },
  { code: '+213', country: 'DZ', label: '🇩🇿 +213', name: 'Algérie' },
  { code: '+33',  country: 'FR', label: '🇫🇷 +33',  name: 'France' },
  { code: '+32',  country: 'BE', label: '🇧🇪 +32',  name: 'Belgique' },
  { code: '+41',  country: 'CH', label: '🇨🇭 +41',  name: 'Suisse' },
  { code: '+1',   country: 'US', label: '🇺🇸 +1',   name: 'USA / Canada' },
];

/**
 * Map store currency → default phone code.
 */
const CURRENCY_TO_CODE = {
  XAF:  '+237',  // FCFA CEMAC → Cameroun par défaut
  FCFA: '+237',
  XOF:  '+225',  // FCFA UEMOA → Côte d'Ivoire par défaut
  CDF:  '+243',  // Franc congolais
  NGN:  '+234',  // Naira
  GHS:  '+233',  // Cedi
  GNF:  '+224',  // Franc guinéen → Guinée
  MAD:  '+212',  // Dirham
  TND:  '+216',  // Dinar tunisien
  DZD:  '+213',  // Dinar algérien
  MGA:  '+261',  // Ariary → Madagascar
  RWF:  '+250',  // Franc rwandais
  KES:  '+254',  // Shilling kenyan
  UGX:  '+256',  // Shilling ougandais
  TZS:  '+255',  // Shilling tanzanien
  ZAR:  '+27',   // Rand → Afrique du Sud
  EUR:  '+33',   // Euro → France par défaut
  USD:  '+1',
};

/**
 * Map country name (as used in form config) → phone code.
 * Keys are stored in lowercase AND accent-stripped for robust matching.
 */
const COUNTRY_NAME_TO_CODE = {};
const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
PHONE_CODES.forEach(c => {
  const lower = c.name.toLowerCase();
  COUNTRY_NAME_TO_CODE[lower] = c.code;
  // Also add accent-stripped version for resilient lookup
  const stripped = stripAccents(lower);
  if (stripped !== lower) COUNTRY_NAME_TO_CODE[stripped] = c.code;
});
// Common aliases
Object.assign(COUNTRY_NAME_TO_CODE, {
  'cameroon': '+237', 'ivory coast': '+225', "cote d'ivoire": '+225',
  'senegal': '+221', 'togo': '+228', 'benin': '+229', 'burkina': '+226',
  'mali': '+223', 'guinea': '+224', 'guinee': '+224', 'mauritania': '+222', 'niger': '+227',
  'chad': '+235', 'gabon': '+241', 'congo': '+242', 'dr congo': '+243',
  'drc': '+243', 'equatorial guinea': '+240', 'central african republic': '+236',
  'guinee eq.': '+240', 'guinee equatoriale': '+240',
  'nigeria': '+234', 'ghana': '+233', 'morocco': '+212', 'tunisia': '+216',
  'algeria': '+213', 'algerie': '+213', 'france': '+33', 'belgium': '+32', 'switzerland': '+41',
  'usa': '+1', 'canada': '+1', 'usa / canada': '+1',
  'rd congo': '+243', 'guinée éq.': '+240', 'centrafrique': '+236',
});

/**
 * Get phone code from a country name (as configured in form builder).
 * Returns null if no match found.
 */
export function getPhoneCodeByCountryName(countryName) {
  if (!countryName) return null;
  const key = countryName.toLowerCase().trim();
  return COUNTRY_NAME_TO_CODE[key] || COUNTRY_NAME_TO_CODE[stripAccents(key)] || null;
}

/**
 * Get the default phone code based on store currency.
 */
export function getDefaultPhoneCode(currency) {
  return CURRENCY_TO_CODE[currency] || CURRENCY_TO_CODE[currency?.toUpperCase()] || '+237';
}

/**
 * Get default phone code from configured countries (form builder), falling back to currency.
 */
export function getDefaultPhoneCodeFromConfig(countries, currency) {
  if (countries?.length) {
    const code = getPhoneCodeByCountryName(countries[0]);
    if (code) return code;
  }
  return getDefaultPhoneCode(currency);
}

/**
 * Build the full phone number by prepending the country code if needed.
 * Avoids double-prefixing if user already typed the code.
 */
export function buildFullPhone(phoneCode, rawPhone) {
  const phone = (rawPhone || '').trim().replace(/\s+/g, '');
  if (!phone) return '';
  // Already has a + → user typed full international number, use as-is
  if (phone.startsWith('+')) return phone;
  // Already starts with the code digits (without +) → prepend +
  const codeDigits = phoneCode.replace('+', '');
  if (phone.startsWith(codeDigits)) return '+' + phone;
  // Local number → prepend country code
  // Remove leading 0 (local format) before prepending
  const cleaned = phone.startsWith('0') ? phone.substring(1) : phone;
  return phoneCode + cleaned;
}
