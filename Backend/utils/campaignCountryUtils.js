/**
 * Utilitaires pour gérer les campagnes par indicatif pays
 * Permet de grouper et filtrer les destinataires par pays
 */

import { formatInternationalPhone, detectCountryFromPhone, normalizePhone } from './phoneUtils.js';

/**
 * Groupe les destinataires par pays en fonction de leur numéro de téléphone
 * @param {Array} recipients - Liste des destinataires avec phone, client, orderData
 * @returns {Object} Destinataires groupés par code pays
 */
export function groupRecipientsByCountry(recipients) {
  const countryGroups = {};
  const invalidPhones = [];

  for (const recipient of recipients) {
    if (!recipient.phone) {
      invalidPhones.push({ ...recipient, reason: 'no_phone' });
      continue;
    }

    // Normaliser et formater le numéro
    const phoneCheck = formatInternationalPhone(recipient.phone);
    
    if (!phoneCheck.success) {
      invalidPhones.push({ ...recipient, reason: 'invalid_phone', error: phoneCheck.error });
      continue;
    }

    const countryCode = phoneCheck.countryInfo?.code || 'UNKNOWN';
    const countryName = phoneCheck.countryInfo?.name || 'Pays inconnu';
    const prefix = phoneCheck.prefix;

    // Créer le groupe pays s'il n'existe pas
    if (!countryGroups[countryCode]) {
      countryGroups[countryCode] = {
        countryCode,
        countryName,
        prefix,
        recipients: [],
        phoneFormat: phoneCheck.formatted.substring(0, prefix.length) // Format pour ce pays
      };
    }

    // Ajouter le destinataire au groupe avec le numéro formaté
    countryGroups[countryCode].recipients.push({
      ...recipient,
      cleanPhone: phoneCheck.formatted,
      phoneDisplay: phoneCheck.display,
      countryInfo: phoneCheck.countryInfo
    });
  }

  // Trier les pays par nombre de destinataires (décroissant)
  const sortedGroups = Object.entries(countryGroups)
    .sort(([,a], [,b]) => b.recipients.length - a.recipients.length)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  return {
    countries: sortedGroups,
    invalidPhones,
    summary: {
      totalRecipients: recipients.length,
      validRecipients: recipients.length - invalidPhones.length,
      invalidCount: invalidPhones.length,
      countryCount: Object.keys(sortedGroups).length
    }
  };
}

/**
 * Filtre les destinataires par pays spécifiques
 * @param {Array} recipients - Liste des destinataires
 * @param {Array} countryCodes - Codes pays à garder (ex: ['CM', 'FR', 'CI'])
 * @returns {Array} Destinataires filtrés
 */
export function filterRecipientsByCountry(recipients, countryCodes) {
  if (!countryCodes || countryCodes.length === 0) {
    return recipients;
  }

  const filtered = [];
  
  for (const recipient of recipients) {
    const phoneCheck = formatInternationalPhone(recipient.phone);
    
    if (phoneCheck.success && countryCodes.includes(phoneCheck.countryInfo?.code)) {
      filtered.push({
        ...recipient,
        cleanPhone: phoneCheck.formatted,
        phoneDisplay: phoneCheck.display,
        countryInfo: phoneCheck.countryInfo
      });
    }
  }

  return filtered;
}

/**
 * Exclut les destinataires de certains pays
 * @param {Array} recipients - Liste des destinataires
 * @param {Array} excludeCountryCodes - Codes pays à exclure
 * @returns {Array} Destinataires filtrés
 */
export function excludeRecipientsByCountry(recipients, excludeCountryCodes) {
  if (!excludeCountryCodes || excludeCountryCodes.length === 0) {
    return recipients;
  }

  const filtered = [];
  
  for (const recipient of recipients) {
    const phoneCheck = formatInternationalPhone(recipient.phone);
    
    if (phoneCheck.success && !excludeCountryCodes.includes(phoneCheck.countryInfo?.code)) {
      filtered.push({
        ...recipient,
        cleanPhone: phoneCheck.formatted,
        phoneDisplay: phoneCheck.display,
        countryInfo: phoneCheck.countryInfo
      });
    }
  }

  return filtered;
}

/**
 * Génère un rapport d'analyse des destinataires par pays
 * @param {Object} countryGroups - Résultat de groupRecipientsByCountry
 * @returns {Object} Rapport détaillé
 */
export function generateCountryReport(countryGroups) {
  const report = {
    overview: countryGroups.summary,
    countries: [],
    recommendations: []
  };

  // Analyser chaque pays
  for (const [countryCode, group] of Object.entries(countryGroups.countries)) {
    const countryData = {
      countryCode,
      countryName: group.countryName,
      prefix: group.prefix,
      recipientCount: group.recipients.length,
      percentage: Math.round((group.recipients.length / countryGroups.summary.validRecipients) * 100),
      samplePhones: group.recipients.slice(0, 3).map(r => r.phoneDisplay),
      recommendedAction: getRecommendationForCountry(group)
    };
    
    report.countries.push(countryData);
  }

  // Générer des recommandations
  report.recommendations = generateRecommendations(report.countries);

  return report;
}

/**
 * Détermine la meilleure action pour un pays donné
 * @param {Object} countryGroup - Groupe pays
 * @returns {string} Recommandation
 */
function getRecommendationForCountry(countryGroup) {
  const count = countryGroup.recipients.length;
  
  if (count === 0) return 'Aucun destinataire';
  if (count < 5) return 'Test - petit groupe';
  if (count < 20) return 'Envoi direct recommandé';
  if (count < 50) return 'Envoi avec délai étendu';
  return 'Envoi par lots recommandé';
}

/**
 * Génère des recommandations globales basées sur l'analyse
 * @param {Array} countries - Liste des pays analysés
 * @returns {Array} Liste de recommandations
 */
function generateRecommendations(countries) {
  const recommendations = [];
  
  // Pays avec le plus de destinataires
  const topCountry = countries[0];
  if (topCountry && topCountry.recipientCount > 10) {
    recommendations.push(`Prioriser l'envoi vers ${topCountry.countryName} (${topCountry.recipientCount} contacts)`);
  }

  // Pays avec peu de destinataires
  const smallCountries = countries.filter(c => c.recipientCount > 0 && c.recipientCount < 5);
  if (smallCountries.length > 0) {
    recommendations.push(`${smallCountries.length} pays avec moins de 5 contacts - envisager un envoi groupé`);
  }

  // Recommandation de timing
  const totalRecipients = countries.reduce((sum, c) => sum + c.recipientCount, 0);
  if (totalRecipients > 100) {
    recommendations.push('Grand volume - prévoir un envoi échelonné par pays');
  }

  // Pays africains prioritaires
  const africanCountries = countries.filter(c => 
    ['CM', 'CI', 'SN', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GA', 'CG', 'CD'].includes(c.countryCode)
  );
  if (africanCountries.length > 0) {
    recommendations.push(`Focalisation sur ${africanCountries.length} pays africains prioritaires`);
  }

  return recommendations;
}

/**
 * Convertit les filtres de pays de l'interface en codes pays
 * @param {Array} countryFilters - Filtres depuis le frontend
 * @returns {Array} Codes pays valides
 */
export function parseCountryFilters(countryFilters) {
  if (!countryFilters || !Array.isArray(countryFilters)) {
    return [];
  }

  // Support de différents formats: codes pays, préfixes, noms
  const validCodes = [];
  
  for (const filter of countryFilters) {
    const filterStr = String(filter).trim().toUpperCase();
    
    // Si c'est déjà un code pays (2-3 lettres)
    if (/^[A-Z]{2,3}$/.test(filterStr)) {
      validCodes.push(filterStr);
    }
    // Si c'est un préfixe (ex: +237, 237)
    else if (/^\+?\d{1,4}$/.test(filterStr)) {
      const prefix = filterStr.replace('+', '');
      // Convertir le préfixe en code pays (nécessite une table de conversion)
      const countryCode = getCountryCodeFromPrefix(prefix);
      if (countryCode) validCodes.push(countryCode);
    }
    // Si c'est un nom de pays (ex: "Cameroun")
    else {
      const countryCode = getCountryCodeFromName(filterStr);
      if (countryCode) validCodes.push(countryCode);
    }
  }

  return [...new Set(validCodes)]; // Dédupliquer
}

/**
 * Obtient le code pays depuis un préfixe téléphonique
 * @param {string} prefix - Préfixe téléphonique
 * @returns {string|null} Code pays
 */
function getCountryCodeFromPrefix(prefix) {
  const prefixToCountry = {
    '237': 'CM', '225': 'CI', '221': 'SN', '223': 'ML', '226': 'BF',
    '227': 'NE', '228': 'TG', '229': 'BJ', '241': 'GA', '242': 'CG',
    '243': 'CD', '33': 'FR', '32': 'BE', '41': 'CH', '44': 'GB',
    '212': 'MA', '213': 'DZ', '216': 'TN', '1': 'US', '55': 'BR'
  };
  
  return prefixToCountry[prefix] || null;
}

/**
 * Obtient le code pays depuis un nom de pays
 * @param {string} name - Nom du pays
 * @returns {string|null} Code pays
 */
function getCountryCodeFromName(name) {
  const nameToCountry = {
    'CAMEROUN': 'CM', 'CÔTE D\'IVOIRE': 'CI', 'SENÉGAL': 'SN',
    'MALI': 'ML', 'BURKINA FASO': 'BF', 'NIGER': 'NE', 'TOGO': 'TG',
    'BÉNIN': 'BJ', 'GABON': 'GA', 'CONGO': 'CG', 'RDC': 'CD',
    'FRANCE': 'FR', 'BELGIQUE': 'BE', 'SUISSE': 'CH', 'MAROC': 'MA',
    'ALGÉRIE': 'DZ', 'TUNISIE': 'TN', 'ÉTATS-UNIS': 'US', 'BRÉSIL': 'BR'
  };
  
  return nameToCountry[name.toUpperCase()] || null;
}

export default {
  groupRecipientsByCountry,
  filterRecipientsByCountry,
  excludeRecipientsByCountry,
  generateCountryReport,
  parseCountryFilters
};
