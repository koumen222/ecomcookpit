/**
 * Utilitaire pour la gestion des numéros de téléphone internationaux
 * Supporte tous les pays avec indicatifs internationaux
 */

// Mapping des indicatifs pays les plus courants avec leurs longueurs
const COUNTRY_PHONE_PATTERNS = {
  // Afrique
  '237': { code: 'CM', name: 'Cameroun', minLength: 8, maxLength: 9 },
  '225': { code: 'CI', name: 'Côte d\'Ivoire', minLength: 8, maxLength: 10 },
  '221': { code: 'SN', name: 'Sénégal', minLength: 9, maxLength: 9 },
  '223': { code: 'ML', name: 'Mali', minLength: 8, maxLength: 8 },
  '226': { code: 'BF', name: 'Burkina Faso', minLength: 8, maxLength: 8 },
  '227': { code: 'NE', name: 'Niger', minLength: 8, maxLength: 8 },
  '228': { code: 'TG', name: 'Togo', minLength: 8, maxLength: 8 },
  '229': { code: 'BJ', name: 'Bénin', minLength: 8, maxLength: 8 },
  '241': { code: 'GA', name: 'Gabon', minLength: 7, maxLength: 8 },
  '242': { code: 'CG', name: 'Congo Brazzaville', minLength: 9, maxLength: 9 },
  '243': { code: 'CD', name: 'Congo RDC', minLength: 9, maxLength: 9 },
  '240': { code: 'GQ', name: 'Guinée Équatoriale', minLength: 9, maxLength: 9 },
  '244': { code: 'AO', name: 'Angola', minLength: 9, maxLength: 9 },
  '245': { code: 'GW', name: 'Guinée-Bissau', minLength: 7, maxLength: 9 },
  '246': { code: 'IO', name: 'Territoire britannique', minLength: 7, maxLength: 7 },
  '247': { code: 'AC', name: 'Ascension', minLength: 4, maxLength: 4 },
  '248': { code: 'SC', name: 'Seychelles', minLength: 7, maxLength: 7 },
  '249': { code: 'SD', name: 'Soudan', minLength: 9, maxLength: 9 },
  '250': { code: 'RW', name: 'Rwanda', minLength: 9, maxLength: 9 },
  '251': { code: 'ET', name: 'Éthiopie', minLength: 9, maxLength: 9 },
  '252': { code: 'SO', name: 'Somalie', minLength: 8, maxLength: 8 },
  '253': { code: 'DJ', name: 'Djibouti', minLength: 8, maxLength: 8 },
  '254': { code: 'KE', name: 'Kenya', minLength: 9, maxLength: 9 },
  '255': { code: 'TZ', name: 'Tanzanie', minLength: 9, maxLength: 9 },
  '256': { code: 'UG', name: 'Ouganda', minLength: 9, maxLength: 9 },
  '257': { code: 'BI', name: 'Burundi', minLength: 8, maxLength: 8 },
  '258': { code: 'MZ', name: 'Mozambique', minLength: 9, maxLength: 9 },
  '260': { code: 'ZM', name: 'Zambie', minLength: 9, maxLength: 9 },
  '261': { code: 'MG', name: 'Madagascar', minLength: 9, maxLength: 9 },
  '262': { code: 'RE', name: 'Réunion', minLength: 9, maxLength: 9 },
  '263': { code: 'ZW', name: 'Zimbabwe', minLength: 9, maxLength: 9 },
  '264': { code: 'NA', name: 'Namibie', minLength: 9, maxLength: 9 },
  '265': { code: 'MW', name: 'Malawi', minLength: 9, maxLength: 9 },
  '266': { code: 'LS', name: 'Lesotho', minLength: 8, maxLength: 8 },
  '267': { code: 'BW', name: 'Botswana', minLength: 8, maxLength: 8 },
  '268': { code: 'SZ', name: 'Eswatini', minLength: 8, maxLength: 8 },
  '269': { code: 'KM', name: 'Comores', minLength: 7, maxLength: 7 },
  '27': { code: 'ZA', name: 'Afrique du Sud', minLength: 9, maxLength: 9 },
  '212': { code: 'MA', name: 'Maroc', minLength: 9, maxLength: 9 },
  '213': { code: 'DZ', name: 'Algérie', minLength: 9, maxLength: 9 },
  '216': { code: 'TN', name: 'Tunisie', minLength: 8, maxLength: 8 },
  '218': { code: 'LY', name: 'Libye', minLength: 9, maxLength: 9 },
  '220': { code: 'GM', name: 'Gambie', minLength: 7, maxLength: 7 },
  '231': { code: 'LR', name: 'Libéria', minLength: 7, maxLength: 9 },
  '232': { code: 'SL', name: 'Sierra Leone', minLength: 8, maxLength: 8 },
  '233': { code: 'GH', name: 'Ghana', minLength: 9, maxLength: 9 },
  '234': { code: 'NG', name: 'Nigéria', minLength: 10, maxLength: 10 },
  '235': { code: 'TD', name: 'Tchad', minLength: 8, maxLength: 8 },
  '236': { code: 'CF', name: 'Centrafrique', minLength: 8, maxLength: 8 },

  // Europe
  '33': { code: 'FR', name: 'France', minLength: 9, maxLength: 9 },
  '32': { code: 'BE', name: 'Belgique', minLength: 9, maxLength: 9 },
  '41': { code: 'CH', name: 'Suisse', minLength: 9, maxLength: 9 },
  '352': { code: 'LU', name: 'Luxembourg', minLength: 9, maxLength: 9 },
  '44': { code: 'GB', name: 'Royaume-Uni', minLength: 10, maxLength: 10 },
  '39': { code: 'IT', name: 'Italie', minLength: 9, maxLength: 10 },
  '34': { code: 'ES', name: 'Espagne', minLength: 9, maxLength: 9 },
  '49': { code: 'DE', name: 'Allemagne', minLength: 10, maxLength: 11 },
  '31': { code: 'NL', name: 'Pays-Bas', minLength: 9, maxLength: 9 },
  '351': { code: 'PT', name: 'Portugal', minLength: 9, maxLength: 9 },
  '43': { code: 'AT', name: 'Autriche', minLength: 10, maxLength: 11 },
  '46': { code: 'SE', name: 'Suède', minLength: 9, maxLength: 9 },
  '45': { code: 'DK', name: 'Danemark', minLength: 8, maxLength: 8 },
  '47': { code: 'NO', name: 'Norvège', minLength: 8, maxLength: 8 },
  '358': { code: 'FI', name: 'Finlande', minLength: 9, maxLength: 10 },
  '48': { code: 'PL', name: 'Pologne', minLength: 9, maxLength: 9 },
  '420': { code: 'CZ', name: 'Tchéquie', minLength: 9, maxLength: 9 },
  '421': { code: 'SK', name: 'Slovaquie', minLength: 9, maxLength: 9 },
  '36': { code: 'HU', name: 'Hongrie', minLength: 9, maxLength: 9 },
  '40': { code: 'RO', name: 'Roumanie', minLength: 9, maxLength: 9 },
  '30': { code: 'GR', name: 'Grèce', minLength: 10, maxLength: 10 },
  '357': { code: 'CY', name: 'Chypre', minLength: 8, maxLength: 8 },
  '356': { code: 'MT', name: 'Malte', minLength: 8, maxLength: 8 },
  '353': { code: 'IE', name: 'Irlande', minLength: 9, maxLength: 9 },
  '354': { code: 'IS', name: 'Islande', minLength: 7, maxLength: 9 },
  '372': { code: 'EE', name: 'Estonie', minLength: 8, maxLength: 8 },
  '371': { code: 'LV', name: 'Lettonie', minLength: 8, maxLength: 8 },
  '370': { code: 'LT', name: 'Lituanie', minLength: 8, maxLength: 8 },

  // Amériques
  '1': { code: 'US', name: 'États-Unis/Canada', minLength: 10, maxLength: 10 },
  '55': { code: 'BR', name: 'Brésil', minLength: 10, maxLength: 11 },
  '52': { code: 'MX', name: 'Mexique', minLength: 10, maxLength: 10 },
  '54': { code: 'AR', name: 'Argentine', minLength: 10, maxLength: 10 },
  '56': { code: 'CL', name: 'Chili', minLength: 9, maxLength: 9 },
  '57': { code: 'CO', name: 'Colombie', minLength: 10, maxLength: 10 },
  '51': { code: 'PE', name: 'Pérou', minLength: 9, maxLength: 9 },
  '58': { code: 'VE', name: 'Venezuela', minLength: 10, maxLength: 10 },
  '593': { code: 'EC', name: 'Équateur', minLength: 9, maxLength: 9 },
  '591': { code: 'BO', name: 'Bolivie', minLength: 8, maxLength: 8 },
  '595': { code: 'PY', name: 'Paraguay', minLength: 9, maxLength: 9 },
  '598': { code: 'UY', name: 'Uruguay', minLength: 8, maxLength: 8 },
  '592': { code: 'GY', name: 'Guyana', minLength: 7, maxLength: 7 },

  // Asie
  '86': { code: 'CN', name: 'Chine', minLength: 11, maxLength: 11 },
  '91': { code: 'IN', name: 'Inde', minLength: 10, maxLength: 10 },
  '81': { code: 'JP', name: 'Japon', minLength: 10, maxLength: 10 },
  '82': { code: 'KR', name: 'Corée du Sud', minLength: 10, maxLength: 10 },
  '62': { code: 'ID', name: 'Indonésie', minLength: 10, maxLength: 11 },
  '60': { code: 'MY', name: 'Malaisie', minLength: 9, maxLength: 10 },
  '65': { code: 'SG', name: 'Singapour', minLength: 8, maxLength: 8 },
  '66': { code: 'TH', name: 'Thaïlande', minLength: 9, maxLength: 9 },
  '84': { code: 'VN', name: 'Vietnam', minLength: 9, maxLength: 9 },
  '63': { code: 'PH', name: 'Philippines', minLength: 10, maxLength: 10 },
  '95': { code: 'MM', name: 'Myanmar', minLength: 8, maxLength: 10 },
  '880': { code: 'BD', name: 'Bangladesh', minLength: 10, maxLength: 10 },
  '92': { code: 'PK', name: 'Pakistan', minLength: 10, maxLength: 10 },
  '90': { code: 'TR', name: 'Turquie', minLength: 10, maxLength: 10 },
  '971': { code: 'AE', name: 'Émirats Arabes', minLength: 9, maxLength: 9 },
  '966': { code: 'SA', name: 'Arabie Saoudite', minLength: 9, maxLength: 9 },
  '972': { code: 'IL', name: 'Israël', minLength: 9, maxLength: 9 },
  '98': { code: 'IR', name: 'Iran', minLength: 10, maxLength: 10 },
  '964': { code: 'IQ', name: 'Irak', minLength: 10, maxLength: 10 },
  '962': { code: 'JO', name: 'Jordanie', minLength: 9, maxLength: 9 },
  '961': { code: 'LB', name: 'Liban', minLength: 7, maxLength: 8 },
  '963': { code: 'SY', name: 'Syrie', minLength: 9, maxLength: 9 },
  '965': { code: 'KW', name: 'Koweït', minLength: 8, maxLength: 8 },
  '974': { code: 'QA', name: 'Qatar', minLength: 8, maxLength: 8 },
  '968': { code: 'OM', name: 'Oman', minLength: 8, maxLength: 8 },
  '973': { code: 'BH', name: 'Bahreïn', minLength: 8, maxLength: 8 },
  '976': { code: 'MN', name: 'Mongolie', minLength: 8, maxLength: 8 },
  '86': { code: 'CN', name: 'Chine', minLength: 11, maxLength: 11 },
  '852': { code: 'HK', name: 'Hong Kong', minLength: 8, maxLength: 8 },
  '853': { code: 'MO', name: 'Macao', minLength: 8, maxLength: 8 },
  '886': { code: 'TW', name: 'Taïwan', minLength: 9, maxLength: 9 },
  '850': { code: 'KP', name: 'Corée du Nord', minLength: 10, maxLength: 10 },
  '91': { code: 'IN', name: 'Inde', minLength: 10, maxLength: 10 },
  '94': { code: 'LK', name: 'Sri Lanka', minLength: 9, maxLength: 9 },
  '93': { code: 'AF', name: 'Afghanistan', minLength: 9, maxLength: 9 },
  '95': { code: 'MM', name: 'Myanmar', minLength: 8, maxLength: 10 },

  // Océanie
  '61': { code: 'AU', name: 'Australie', minLength: 9, maxLength: 9 },
  '64': { code: 'NZ', name: 'Nouvelle-Zélande', minLength: 9, maxLength: 10 },
  '675': { code: 'PG', name: 'Papouasie', minLength: 8, maxLength: 8 },
  '679': { code: 'FJ', name: 'Fidji', minLength: 7, maxLength: 7 },
  '677': { code: 'SB', name: 'Salomon', minLength: 7, maxLength: 7 },
  '678': { code: 'VU', name: 'Vanuatu', minLength: 7, maxLength: 7 },
  '682': { code: 'CK', name: 'Îles Cook', minLength: 5, maxLength: 5 },
  '683': { code: 'NU', name: 'Niue', minLength: 4, maxLength: 4 },
  '690': { code: 'TK', name: 'Tokelau', minLength: 5, maxLength: 5 },
  '691': { code: 'FM', name: 'Micronésie', minLength: 7, maxLength: 7 },
  '692': { code: 'MH', name: 'Marshall', minLength: 7, maxLength: 7 },
  '680': { code: 'PW', name: 'Palaos', minLength: 7, maxLength: 7 },
  '674': { code: 'NR', name: 'Nauru', minLength: 7, maxLength: 7 },
  '673': { code: 'BN', name: 'Brunei', minLength: 7, maxLength: 7 },
  '672': { code: 'NF', name: 'Norfolk', minLength: 6, maxLength: 6 },
  '671': { code: 'GU', name: 'Guam', minLength: 7, maxLength: 7 },
  '670': { code: 'TL', name: 'Timor-Leste', minLength: 8, maxLength: 8 },

  // Moyen-Orient
  '20': { code: 'EG', name: 'Égypte', minLength: 10, maxLength: 10 },
};

/**
 * Nettoie et formate un numéro de téléphone international
 * @param {string} phone - Numéro de téléphone (peut contenir des espaces, +, etc.)
 * @returns {Object} Résultat avec success, formatted, countryInfo, error
 */
export function formatInternationalPhone(phone) {
  if (!phone) {
    return { success: false, error: 'Numéro vide', formatted: null };
  }

  // Convertir en string si nécessaire
  let cleaned = String(phone).trim();

  // Enlever les caractères spéciaux sauf le +
  cleaned = cleaned.replace(/\s/g, '');
  cleaned = cleaned.replace(/[\(\)\-\.]/g, '');

  // Garder uniquement les chiffres et le + initial
  let digits = cleaned;
  if (digits.startsWith('+')) {
    digits = digits.substring(1);
  }

  // Enlever le préfixe 00 international
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }

  // Nettoyer pour ne garder que les chiffres
  digits = digits.replace(/\D/g, '');

  if (digits.length < 8) {
    return { success: false, error: 'Numéro trop court (minimum 8 chiffres)', formatted: null };
  }

  // Détecter le pays par l'indicatif
  let countryInfo = null;
  let matchedPrefix = '';

  // Chercher le préfixe le plus long qui correspond (jusqu'à 4 chiffres)
  for (let len = 4; len >= 1; len--) {
    const prefix = digits.substring(0, len);
    if (COUNTRY_PHONE_PATTERNS[prefix]) {
      countryInfo = COUNTRY_PHONE_PATTERNS[prefix];
      matchedPrefix = prefix;
      break;
    }
  }

  // Si pas de pays trouvé, essayer de détecter automatiquement basé sur des patterns communs
  if (!countryInfo) {
    const possibleCountries = [];
    
    // Essayer de détecter le pays basé sur le premier chiffre et la longueur
    // Cameroun: 6XXXXXXXX (9 chiffres)
    if (digits.startsWith('6') && digits.length === 9) {
      possibleCountries.push({ prefix: '237', info: COUNTRY_PHONE_PATTERNS['237'] });
    }
    // France: commence par 0 ou 6/7 et fait 9-10 chiffres
    if ((digits.startsWith('0') || digits.startsWith('6') || digits.startsWith('7')) && (digits.length === 9 || digits.length === 10)) {
      possibleCountries.push({ prefix: '33', info: COUNTRY_PHONE_PATTERNS['33'] });
    }
    // Côte d'Ivoire: commence par 0 et fait 10 chiffres
    if (digits.startsWith('0') && digits.length === 10) {
      possibleCountries.push({ prefix: '225', info: COUNTRY_PHONE_PATTERNS['225'] });
    }
    // Sénégal: commence par 7 et fait 9 chiffres
    if (digits.startsWith('7') && digits.length === 9) {
      possibleCountries.push({ prefix: '221', info: COUNTRY_PHONE_PATTERNS['221'] });
    }
    // USA/Canada: 10 chiffres
    if (digits.length === 10) {
      possibleCountries.push({ prefix: '1', info: COUNTRY_PHONE_PATTERNS['1'] });
    }
    
    // Si un seul pays possible, l'utiliser
    if (possibleCountries.length === 1) {
      const country = possibleCountries[0];
      // Enlever le 0 initial si présent (format local)
      const localNumber = digits.startsWith('0') ? digits.substring(1) : digits;
      digits = country.prefix + localNumber;
      countryInfo = country.info;
      matchedPrefix = country.prefix;
    } else if (possibleCountries.length > 1) {
      // Plusieurs pays possibles - utiliser le premier (priorité Cameroun)
      const country = possibleCountries.find(c => c.prefix === '237') || possibleCountries[0];
      const localNumber = digits.startsWith('0') ? digits.substring(1) : digits;
      digits = country.prefix + localNumber;
      countryInfo = country.info;
      matchedPrefix = country.prefix;
    } else {
      // Aucun pays détecté
      return {
        success: false,
        error: 'Indicatif pays non reconnu. Assurez-vous d\'inclure l\'indicatif (ex: +237, +33, +1)',
        formatted: digits,
        possibleCountries: []
      };
    }
  }

  // Calculer la longueur sans l'indicatif
  const nationalNumber = digits.substring(matchedPrefix.length);

  // Vérifier la longueur
  if (nationalNumber.length < countryInfo.minLength || nationalNumber.length > countryInfo.maxLength) {
    return {
      success: false,
      error: `Format invalide pour ${countryInfo.name}. Longueur attendue: ${countryInfo.minLength}-${countryInfo.maxLength} chiffres après l'indicatif ${matchedPrefix}`,
      formatted: digits,
      countryInfo
    };
  }

  return {
    success: true,
    formatted: digits, // Format sans le + pour l'API WhatsApp
    display: `+${digits}`, // Format d'affichage
    countryInfo,
    prefix: matchedPrefix,
    nationalNumber
  };
}

/**
 * Valide si un numéro est un format WhatsApp valide (tous pays)
 * @param {string} phone - Numéro à valider
 * @returns {boolean} true si valide
 */
export function isValidWhatsAppNumber(phone) {
  const result = formatInternationalPhone(phone);
  return result.success;
}

/**
 * Nettoie un numéro pour l'API WhatsApp (juste les chiffres)
 * @param {string} phone - Numéro de téléphone
 * @returns {string} Numéro nettoyé ou vide si invalide
 */
export function cleanPhoneForWhatsApp(phone) {
  const result = formatInternationalPhone(phone);
  return result.success ? result.formatted : '';
}

/**
 * Détecte le pays depuis un numéro de téléphone
 * @param {string} phone - Numéro de téléphone
 * @returns {Object|null} Info du pays ou null
 */
export function detectCountryFromPhone(phone) {
  const result = formatInternationalPhone(phone);
  return result.countryInfo || null;
}

/**
 * Retourne la liste des pays supportés avec leurs indicatifs
 * @returns {Array} Liste des pays
 */
export function getSupportedCountries() {
  return Object.entries(COUNTRY_PHONE_PATTERNS).map(([prefix, info]) => ({
    prefix: `+${prefix}`,
    ...info
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export default {
  formatInternationalPhone,
  isValidWhatsAppNumber,
  cleanPhoneForWhatsApp,
  detectCountryFromPhone,
  getSupportedCountries,
  COUNTRY_PHONE_PATTERNS
};
