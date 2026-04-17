import { PHONE_CODES } from './phoneCodes.js';

export const DEFAULT_STORE_COUNTRY = 'Cameroun';

const COUNTRY_CITY_PRESETS = {
  'Cameroun': ['Douala', 'Yaounde', 'Bafoussam', 'Bamenda', 'Garoua', 'Maroua', 'Ngaoundere', 'Bertoua', 'Kribi', 'Limbe'],
  "Cote d'Ivoire": ['Abidjan', 'Bouake', 'Yamoussoukro', 'San-Pedro', 'Daloa', 'Korhogo', 'Man', 'Divo', 'Gagnoa', 'Abengourou'],
  'Senegal': ['Dakar', 'Thies', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Mbour', 'Rufisque', 'Tambacounda', 'Richard-Toll', 'Louga'],
  'Gabon': ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Moanda', 'Lambarene', 'Mouila', 'Tchibanga'],
  'Congo': ['Brazzaville', 'Pointe-Noire', 'Dolisie', 'Nkayi', 'Owando', 'Ouesso', 'Impfondo'],
  'RDC': ['Kinshasa', 'Lubumbashi', 'Mbuji-Mayi', 'Kananga', 'Kisangani', 'Goma', 'Bukavu', 'Tshikapa', 'Kolwezi'],
  'Mali': ['Bamako', 'Sikasso', 'Mopti', 'Koutiala', 'Segou', 'Kayes', 'Gao', 'Kati'],
  'Guinee': ['Conakry', 'Nzerekore', 'Kankan', 'Kindia', 'Labe', 'Mamou', 'Boke', 'Siguiri'],
  'Togo': ['Lome', 'Kara', 'Sokode', 'Atakpame', 'Kpalime', 'Dapaong', 'Tsevie'],
  'Benin': ['Cotonou', 'Porto-Novo', 'Parakou', 'Abomey-Calavi', 'Djougou', 'Bohicon', 'Natitingou'],
  'Burkina Faso': ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Ouahigouya', 'Banfora', 'Dedougou', 'Kaya'],
  'Niger': ['Niamey', 'Zinder', 'Maradi', 'Tahoua', 'Agadez', 'Dosso', 'Diffa'],
  'Tchad': ["N'Djamena", 'Moundou', 'Sarh', 'Abeche', 'Kelo', 'Koumra'],
  'Mauritanie': ['Nouakchott', 'Nouadhibou', 'Rosso', 'Kaedi', 'Zouerat', 'Kiffa'],
  'Nigeria': ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano'],
  'Ghana': ['Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Cape Coast'],
  'Maroc': ['Casablanca', 'Rabat', 'Marrakech', 'Fes', 'Tanger'],
  'Tunisie': ['Tunis', 'Sfax', 'Sousse', 'Nabeul', 'Bizerte'],
  'Algerie': ['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida'],
  'France': ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Lille'],
  'Belgique': ['Bruxelles', 'Liege', 'Anvers', 'Charleroi', 'Gand'],
  'Suisse': ['Geneve', 'Lausanne', 'Zurich', 'Berne', 'Bale'],
  'USA / Canada': ['Montreal', 'Toronto', 'New York', 'Atlanta', 'Ottawa'],
};

const COUNTRY_PHONE_PLACEHOLDERS = {
  'Cameroun': '6XX XXX XXX',
  "Cote d'Ivoire": '07 XX XX XX XX',
  'Senegal': '77 123 45 67',
  'Gabon': '06 12 34 56',
  'Congo': '06 123 45 67',
  'RDC': '099 123 4567',
  'Nigeria': '0801 234 5678',
  'Ghana': '024 123 4567',
  'France': '06 12 34 56 78',
  'Belgique': '0470 12 34 56',
  'Suisse': '078 123 45 67',
  'USA / Canada': '(514) 555-1234',
};

const COUNTRY_ADDRESS_PLACEHOLDERS = {
  'USA / Canada': 'Street, area, landmark...',
  'France': 'Rue, batiment, code postal...',
  'Belgique': 'Rue, batiment, code postal...',
  'Suisse': 'Rue, batiment, code postal...',
};

const COUNTRY_ALIASES = {
  cameroun: 'Cameroun',
  cameroon: 'Cameroun',
  "cote d ivoire": "Cote d'Ivoire",
  "cote d'ivoire": "Cote d'Ivoire",
  "côte d ivoire": "Cote d'Ivoire",
  "côte d'ivoire": "Cote d'Ivoire",
  'ivory coast': "Cote d'Ivoire",
  senegal: 'Senegal',
  gabon: 'Gabon',
  congo: 'Congo',
  'rd congo': 'RDC',
  'dr congo': 'RDC',
  'congo rdc': 'RDC',
  'congo kinshasa': 'RDC',
  rdc: 'RDC',
  mali: 'Mali',
  guinee: 'Guinee',
  guinea: 'Guinee',
  togo: 'Togo',
  benin: 'Benin',
  burkina: 'Burkina Faso',
  'burkina faso': 'Burkina Faso',
  niger: 'Niger',
  tchad: 'Tchad',
  chad: 'Tchad',
  mauritanie: 'Mauritanie',
  mauritania: 'Mauritanie',
  nigeria: 'Nigeria',
  ghana: 'Ghana',
  maroc: 'Maroc',
  morocco: 'Maroc',
  tunisie: 'Tunisie',
  tunisia: 'Tunisie',
  algerie: 'Algerie',
  algeria: 'Algerie',
  france: 'France',
  belgique: 'Belgique',
  belgium: 'Belgique',
  suisse: 'Suisse',
  switzerland: 'Suisse',
  'usa canada': 'USA / Canada',
  'usa / canada': 'USA / Canada',
  usa: 'USA / Canada',
  canada: 'USA / Canada',
};

const normalizeCountryToken = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const dedupeStrings = (values = []) => {
  const seen = new Set();
  const next = [];
  values.forEach((value) => {
    const normalized = normalizeCountryToken(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    next.push(value);
  });
  return next;
};

export function normalizeCountryName(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  const normalized = normalizeCountryToken(trimmed);
  if (!normalized) return '';

  if (COUNTRY_ALIASES[normalized]) {
    return COUNTRY_ALIASES[normalized];
  }

  const phoneCodeMatch = PHONE_CODES.find((entry) => normalizeCountryToken(entry.name) === normalized);
  if (phoneCodeMatch) {
    return phoneCodeMatch.name;
  }

  return trimmed;
}

export function resolveStoreCountry(storeOrCountry) {
  if (!storeOrCountry) return '';
  if (typeof storeOrCountry === 'string') {
    return normalizeCountryName(storeOrCountry);
  }

  return normalizeCountryName(
    storeOrCountry.country
      || storeOrCountry.storeCountry
      || storeOrCountry.storeSettings?.country
      || storeOrCountry.storeSettings?.storeCountry
      || ''
  );
}

export function resolveFormCountries(configuredCountries = [], storeCountry = '') {
  const normalizedConfigured = dedupeStrings(
    (Array.isArray(configuredCountries) ? configuredCountries : [])
      .map((country) => normalizeCountryName(country))
      .filter(Boolean)
  );

  if (normalizedConfigured.length > 0) {
    return normalizedConfigured;
  }

  const resolvedStoreCountry = resolveStoreCountry(storeCountry);
  return resolvedStoreCountry ? [resolvedStoreCountry] : [DEFAULT_STORE_COUNTRY];
}

export function getPrimaryCountry(configuredCountries = [], storeCountry = '') {
  return resolveFormCountries(configuredCountries, storeCountry)[0] || DEFAULT_STORE_COUNTRY;
}

export function resolvePopularCitiesMap(existingMap = {}, countries = []) {
  const next = { ...(existingMap || {}) };

  resolveFormCountries(countries).forEach((country) => {
    if (!Array.isArray(next[country]) || next[country].length === 0) {
      next[country] = COUNTRY_CITY_PRESETS[country] || [];
    }
  });

  return next;
}

export function getPopularCitiesForCountry(country, customMap = {}) {
  const canonicalCountry = normalizeCountryName(country);
  if (!canonicalCountry) return [];

  const presetCities = COUNTRY_CITY_PRESETS[canonicalCountry] || [];
  const customCities = Array.isArray(customMap?.[canonicalCountry]) ? customMap[canonicalCountry] : [];

  return dedupeStrings([...customCities, ...presetCities]);
}

export function getPopularCitiesForCountries(countries = [], customMap = {}) {
  return dedupeStrings(
    resolveFormCountries(countries).flatMap((country) => getPopularCitiesForCountry(country, customMap))
  );
}

export function findMatchingCountryOption(targetCountry, options = []) {
  const canonicalTarget = normalizeCountryName(targetCountry);
  if (!canonicalTarget) return '';

  return options.find((option) => normalizeCountryName(option) === canonicalTarget) || '';
}

export function getCountryFormPlaceholders(country) {
  const canonicalCountry = normalizeCountryName(country) || DEFAULT_STORE_COUNTRY;
  const cities = getPopularCitiesForCountry(canonicalCountry);
  const cityExample = cities[0] || 'Votre ville';

  return {
    phone: COUNTRY_PHONE_PLACEHOLDERS[canonicalCountry] || '6XX XXX XXX',
    city: `Ex : ${cityExample}`,
    address: COUNTRY_ADDRESS_PLACEHOLDERS[canonicalCountry] || 'Quartier, rue, repere...',
  };
}

export function resolveOrderFormContext({ store, generalConfig = {} }) {
  const storeCountry = resolveStoreCountry(store);
  const countries = resolveFormCountries(generalConfig?.countries, storeCountry);
  const primaryCountry = getPrimaryCountry(generalConfig?.countries, storeCountry);
  const popularCities = resolvePopularCitiesMap(generalConfig?.popularCities, countries);

  return {
    storeCountry,
    countries,
    primaryCountry,
    popularCities,
    placeholders: getCountryFormPlaceholders(primaryCountry),
  };
}

export function resolveSelectedOrderCountry({ explicitCountry = '', configuredCountries = [], storeCountry = '' }) {
  return normalizeCountryName(explicitCountry) || getPrimaryCountry(configuredCountries, storeCountry);
}

export function buildStorefrontOrderWhatsappMessage({
  storeName = '',
  orderNumber = '',
  totalLabel = '',
  customerName = '',
  displayPhone = '',
  country = '',
  city = '',
  address = '',
  notes = '',
  deliveryType = '',
}) {
  const intro = storeName
    ? `Je viens de passer une commande sur ${storeName}.`
    : 'Je viens de passer une commande sur votre boutique.';

  const details = [
    orderNumber ? `📦 *Commande N° ${orderNumber}*` : '',
    totalLabel ? `💰 *Montant : ${totalLabel}*` : '',
    customerName ? `👤 Nom : ${customerName}` : '',
    displayPhone ? `📞 Téléphone : ${displayPhone}` : '',
    country ? `🌍 Pays : ${country}` : '',
    city ? `📍 Ville : ${city}` : '',
    address ? `🏠 Adresse : ${address}` : '',
    notes ? `📝 Notes : ${notes}` : '',
    deliveryType === 'livraison' ? '🚚 Mode : Livraison (paiement a la reception)' : '',
    deliveryType === 'expedition' ? '📦 Mode : Expedition (paiement avant envoi)' : '',
  ].filter(Boolean);

  return [
    'Bonjour ! 👋',
    intro,
    details.join('\n'),
    'Merci de confirmer ma commande ! 🙏',
  ].filter(Boolean).join('\n\n');
}