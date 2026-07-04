import telephoneData from 'country-telephone-data';

/**
 * Countries + international calling codes.
 * Source: country-telephone-data (MIT), normalized for Scalor forms.
 */

const rawCountries = Array.isArray(telephoneData?.allCountries)
  ? telephoneData.allCountries
  : [];

const PRIORITY_COUNTRIES = [
  'CM', 'CI', 'SN', 'TG', 'BJ', 'BF', 'ML', 'GN', 'MR', 'NE', 'TD',
  'GA', 'CG', 'CD', 'GQ', 'CF', 'NG', 'GH', 'MA', 'TN', 'DZ',
  'FR', 'BE', 'CH', 'US', 'CA'
];

const COUNTRY_NAME_OVERRIDES = {
  BF: 'Burkina Faso',
  BJ: 'Bénin',
  CD: 'RD Congo',
  CF: 'Centrafrique',
  CG: 'Congo',
  CI: "Côte d'Ivoire",
  CM: 'Cameroun',
  CV: 'Cap-Vert',
  GQ: 'Guinée équatoriale',
  GN: 'Guinée',
  GW: 'Guinée-Bissau',
  KR: 'Corée du Sud',
  KP: 'Corée du Nord',
  MA: 'Maroc',
  MR: 'Mauritanie',
  NE: 'Niger',
  SN: 'Sénégal',
  TD: 'Tchad',
  TG: 'Togo',
  TN: 'Tunisie',
  US: 'États-Unis',
  GB: 'Royaume-Uni',
  AE: 'Émirats arabes unis',
};

const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(['fr'], { type: 'region' })
  : null;

const stripAccents = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const normalizeLookupKey = (value = '') => stripAccents(value)
  .toLowerCase()
  .replace(/['’]/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function fallbackCountryName(rawName = '') {
  return String(rawName).replace(/\s*\([^)]*\)/g, '').trim();
}

function flagFromIso2(iso2 = '') {
  const code = String(iso2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return code
    .split('')
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join('');
}

function normalizeDialCode(dialCode = '') {
  const digits = String(dialCode).replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function getDisplayCountryName(rawCountry) {
  const iso = String(rawCountry.iso2 || '').toUpperCase();
  return COUNTRY_NAME_OVERRIDES[iso]
    || regionNames?.of(iso)
    || fallbackCountryName(rawCountry.name);
}

function priorityRank(countryCode) {
  const idx = PRIORITY_COUNTRIES.indexOf(String(countryCode).toUpperCase());
  return idx === -1 ? 999 : idx;
}

export const COUNTRY_PHONE_OPTIONS = rawCountries
  .map((country) => {
    const iso = String(country.iso2 || '').toUpperCase();
    const code = normalizeDialCode(country.dialCode);
    const name = getDisplayCountryName(country);
    const flag = flagFromIso2(iso);

    return {
      code,
      country: iso,
      flag,
      label: `${flag ? `${flag} ` : ''}${code}`,
      name,
      rawName: country.name || name,
    };
  })
  .filter((country) => country.country && country.code && country.name)
  .sort((a, b) => {
    const priority = priorityRank(a.country) - priorityRank(b.country);
    if (priority !== 0) return priority;
    return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  });

const uniquePhoneCodeMap = new Map();
COUNTRY_PHONE_OPTIONS.forEach((country) => {
  const current = uniquePhoneCodeMap.get(country.code);
  if (!current || priorityRank(country.country) < priorityRank(current.country)) {
    uniquePhoneCodeMap.set(country.code, country);
  }
});

export const PHONE_CODES = Array.from(uniquePhoneCodeMap.values()).sort((a, b) => {
  const priority = priorityRank(a.country) - priorityRank(b.country);
  if (priority !== 0) return priority;
  return a.code.localeCompare(b.code, 'fr', { numeric: true });
});
export const COUNTRY_OPTIONS = COUNTRY_PHONE_OPTIONS.map((country) => country.name);

/**
 * Map phone code -> currency.
 */
const CODE_TO_CURRENCY = {
  '+237': 'XAF',   // Cameroun
  '+225': 'XOF',   // Côte d'Ivoire
  '+221': 'XOF',   // Sénégal
  '+228': 'XOF',   // Togo
  '+229': 'XOF',   // Bénin
  '+226': 'XOF',   // Burkina Faso
  '+223': 'XOF',   // Mali
  '+224': 'GNF',   // Guinée
  '+222': 'MRU',   // Mauritanie
  '+227': 'XOF',   // Niger
  '+235': 'XAF',   // Tchad
  '+241': 'XAF',   // Gabon
  '+242': 'XAF',   // Congo
  '+243': 'CDF',   // RD Congo
  '+240': 'XAF',   // Guinée équatoriale
  '+236': 'XAF',   // Centrafrique
  '+234': 'NGN',   // Nigeria
  '+233': 'GHS',   // Ghana
  '+212': 'MAD',   // Maroc
  '+216': 'TND',   // Tunisie
  '+213': 'DZD',   // Algérie
  '+33':  'EUR',   // France
  '+32':  'EUR',   // Belgique
  '+41':  'CHF',   // Suisse
  '+1':   'USD',   // États-Unis / Canada
};

export function getCurrencyByPhoneCode(code) {
  return CODE_TO_CURRENCY[code] || null;
}

/**
 * Map store currency -> default phone code.
 */
const CURRENCY_TO_CODE = {
  XAF:  '+237',  // FCFA CEMAC -> Cameroun par défaut
  FCFA: '+237',
  XOF:  '+225',  // FCFA UEMOA -> Côte d'Ivoire par défaut
  CDF:  '+243',
  NGN:  '+234',
  GHS:  '+233',
  GNF:  '+224',
  MAD:  '+212',
  TND:  '+216',
  DZD:  '+213',
  MGA:  '+261',
  RWF:  '+250',
  KES:  '+254',
  UGX:  '+256',
  TZS:  '+255',
  ZAR:  '+27',
  EUR:  '+33',
  USD:  '+1',
};

const COUNTRY_NAME_TO_CODE = {};

function addCountryAlias(name, code) {
  const key = normalizeLookupKey(name);
  if (key && code && !COUNTRY_NAME_TO_CODE[key]) {
    COUNTRY_NAME_TO_CODE[key] = code;
  }
}

COUNTRY_PHONE_OPTIONS.forEach((country) => {
  addCountryAlias(country.name, country.code);
  addCountryAlias(country.rawName, country.code);
  addCountryAlias(country.country, country.code);
});

Object.entries({
  'cameroon': '+237',
  'cameroun': '+237',
  'ivory coast': '+225',
  "cote d'ivoire": '+225',
  'cote d ivoire': '+225',
  'côte d’ivoire': '+225',
  'congo rdc': '+243',
  'dr congo': '+243',
  'drc': '+243',
  'rdc': '+243',
  'rd congo': '+243',
  'congo brazzaville': '+242',
  'guinee eq': '+240',
  'guinee equatoriale': '+240',
  'guinée équatoriale': '+240',
  'centrafrique': '+236',
  'usa': '+1',
  'united states': '+1',
  'etats unis': '+1',
  'états-unis': '+1',
  'usa canada': '+1',
  'usa / canada': '+1',
}).forEach(([alias, code]) => addCountryAlias(alias, code));

export function findCountryPhoneOptionByName(countryName) {
  if (!countryName) return null;
  const code = getPhoneCodeByCountryName(countryName);
  const normalizedName = normalizeLookupKey(countryName);

  return COUNTRY_PHONE_OPTIONS.find((country) => (
    normalizeLookupKey(country.name) === normalizedName
    || normalizeLookupKey(country.rawName) === normalizedName
    || normalizeLookupKey(country.country) === normalizedName
  )) || COUNTRY_PHONE_OPTIONS.find((country) => country.code === code) || null;
}

export function getPhoneCodeByCountryName(countryName) {
  if (!countryName) return null;
  return COUNTRY_NAME_TO_CODE[normalizeLookupKey(countryName)] || null;
}

export function getDefaultPhoneCode(currency) {
  return CURRENCY_TO_CODE[currency] || CURRENCY_TO_CODE[currency?.toUpperCase()] || '+237';
}

export function getDefaultPhoneCodeFromConfig(countries, currency) {
  if (countries?.length) {
    const code = getPhoneCodeByCountryName(countries[0]);
    if (code) return code;
  }
  return getDefaultPhoneCode(currency);
}

const PHONE_LOCAL_LENGTH = {
  '+237': 9, '+225': 10, '+221': 9, '+228': 8, '+229': 10,
  '+226': 8, '+223': 8, '+224': 9, '+222': 8, '+227': 8,
  '+235': 8, '+241': 8, '+242': 9, '+243': 9, '+240': 9,
  '+236': 8, '+234': 10, '+233': 9, '+212': 9, '+216': 8,
  '+213': 9, '+33': 9, '+32': 9, '+41': 9, '+1': 10,
};

export function getPhoneLength(code) {
  return PHONE_LOCAL_LENGTH[code] || 15;
}

export function buildFullPhone(phoneCode, rawPhone) {
  const phone = (rawPhone || '').trim().replace(/\s+/g, '');
  if (!phone) return '';
  if (phone.startsWith('+')) return phone;

  const codeDigits = String(phoneCode || '').replace('+', '');
  if (codeDigits && phone.startsWith(codeDigits)) return `+${phone}`;

  const cleaned = phone.startsWith('0') ? phone.substring(1) : phone;
  return `${phoneCode || ''}${cleaned}`;
}
