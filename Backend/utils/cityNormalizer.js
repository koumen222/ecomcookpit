/**
 * Normalisation des noms de villes
 * Regroupe toutes les variations (Douala, douala, DOUALA) en une forme canonique
 */

// Mapping des villes connues vers leur forme canonique
const CANONICAL_CITIES = {
  // Cameroun
  'douala': 'Douala',
  'yaoundé': 'Yaoundé',
  'yaounde': 'Yaoundé',
  'buea': 'Buea',
  'bamenda': 'Bamenda',
  'garoua': 'Garoua',
  'maroua': 'Maroua',
  'bafoussam': 'Bafoussam',
  'ngaoundéré': 'Ngaoundéré',
  'ngaoundere': 'Ngaoundéré',
  'bertoua': 'Bertoua',
  'kribi': 'Kribi',
  'limbé': 'Limbé',
  'limbe': 'Limbé',
  'edéa': 'Edéa',
  'edea': 'Edéa',
  'kumba': 'Kumba',
  'nkongsamba': 'Nkongsamba',
  'loum': 'Loum',
  'dschang': 'Dschang',
  'ebolowa': 'Ebolowa',
  'sangmelima': 'Sangmelima',
  'mbalmayo': 'Mbalmayo',
  'obala': 'Obala',
  'bafang': 'Bafang',
  'mbouda': 'Mbouda',
  'foumban': 'Foumban',
  'tiko': 'Tiko',
  'kumbo': 'Kumbo',
  'mamfe': 'Mamfe',
  
  // Côte d'Ivoire
  'abidjan': 'Abidjan',
  'yamoussoukro': 'Yamoussoukro',
  'bouaké': 'Bouaké',
  'bouake': 'Bouaké',
  'daloa': 'Daloa',
  'san-pedro': 'San-Pedro',
  'san pedro': 'San-Pedro',
  'korhogo': 'Korhogo',
  'man': 'Man',
  'divo': 'Divo',
  'gagnoa': 'Gagnoa',
  'soubré': 'Soubré',
  'soubre': 'Soubré',
  'abengourou': 'Abengourou',
  'agboville': 'Agboville',
  'grand-bassam': 'Grand-Bassam',
  'grand bassam': 'Grand-Bassam',
  
  // Sénégal
  'dakar': 'Dakar',
  'thiès': 'Thiès',
  'thies': 'Thiès',
  'kaolack': 'Kaolack',
  'saint-louis': 'Saint-Louis',
  'saint louis': 'Saint-Louis',
  'ziguinchor': 'Ziguinchor',
  'touba': 'Touba',
  'mbour': 'Mbour',
  'rufisque': 'Rufisque',
  'kolda': 'Kolda',
  'tambacounda': 'Tambacounda',
  
  // Bénin
  'cotonou': 'Cotonou',
  'porto-novo': 'Porto-Novo',
  'porto novo': 'Porto-Novo',
  'parakou': 'Parakou',
  'djougou': 'Djougou',
  'bohicon': 'Bohicon',
  'kandi': 'Kandi',
  'abomey': 'Abomey',
  'natitingou': 'Natitingou',
  'lokossa': 'Lokossa',
  'ouidah': 'Ouidah',
  
  // Togo
  'lomé': 'Lomé',
  'lome': 'Lomé',
  'sokodé': 'Sokodé',
  'sokode': 'Sokodé',
  'kara': 'Kara',
  'atakpamé': 'Atakpamé',
  'atakpame': 'Atakpamé',
  'kpalimé': 'Kpalimé',
  'kpalime': 'Kpalimé',
  'bassar': 'Bassar',
  'tsévié': 'Tsévié',
  'tsevie': 'Tsévié',
  'aného': 'Aného',
  'aneo': 'Aného',
  
  // Mali
  'bamako': 'Bamako',
  'sikasso': 'Sikasso',
  'mopti': 'Mopti',
  'koutiala': 'Koutiala',
  'kayes': 'Kayes',
  'ségou': 'Ségou',
  'segou': 'Ségou',
  'gao': 'Gao',
  'kidal': 'Kidal',
  'tombouctou': 'Tombouctou',
  
  // Burkina Faso
  'ouagadougou': 'Ouagadougou',
  'bobo-dioulasso': 'Bobo-Dioulasso',
  'bobo dioulasso': 'Bobo-Dioulasso',
  'koudougou': 'Koudougou',
  'ouahigouya': 'Ouahigouya',
  'banfora': 'Banfora',
  'dédougou': 'Dédougou',
  'dedougou': 'Dédougou',
  'kaya': 'Kaya',
  'tenkodogo': 'Tenkodogo',
  'fada': 'Fada',
  
  // Niger
  'niamey': 'Niamey',
  'zinder': 'Zinder',
  'maradi': 'Maradi',
  'agadez': 'Agadez',
  'tahoua': 'Tahoua',
  'dosso': 'Dosso',
  'diffa': 'Diffa',
  'tillabéri': 'Tillabéri',
  'tillaberi': 'Tillabéri',
  
  // Guinée
  'conakry': 'Conakry',
  'nzérékoré': 'Nzérékoré',
  'nzerekore': 'Nzérékoré',
  'kankan': 'Kankan',
  'kindia': 'Kindia',
  'labé': 'Labé',
  'labe': 'Labé',
  'mamou': 'Mamou',
  'boké': 'Boké',
  'boke': 'Boké',
  'siguiri': 'Siguiri',
  
  // RDC
  'kinshasa': 'Kinshasa',
  'lubumbashi': 'Lubumbashi',
  'mbuji-mayi': 'Mbuji-Mayi',
  'mbuji mayi': 'Mbuji-Mayi',
  'kananga': 'Kananga',
  'kisangani': 'Kisangani',
  'goma': 'Goma',
  'bukavu': 'Bukavu',
  'likasi': 'Likasi',
  'kolwezi': 'Kolwezi',
  'matadi': 'Matadi',
  'boma': 'Boma',
  'mbandaka': 'Mbandaka',
  'kikwit': 'Kikwit',
  'uvira': 'Uvira',
  'butembo': 'Butembo',
  'beni': 'Beni',
  'tshikapa': 'Tshikapa',
};

/**
 * Normalise un nom de ville
 * @param {string} cityName - Nom de ville brut
 * @returns {string} - Nom de ville normalisé
 */
function normalizeCity(cityName) {
  if (!cityName || typeof cityName !== 'string') return '';
  
  // Nettoyer: trim, supprimer espaces multiples
  let cleaned = cityName.trim().replace(/\s+/g, ' ');
  
  // Chercher dans le mapping (insensible à la casse)
  const lowerCleaned = cleaned.toLowerCase();
  
  if (CANONICAL_CITIES[lowerCleaned]) {
    return CANONICAL_CITIES[lowerCleaned];
  }
  
  // Si pas dans le mapping, capitaliser proprement
  // "douala akwa" -> "Douala Akwa"
  // "YAOUNDE" -> "Yaounde"
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Déduplique et normalise une liste de villes
 * @param {string[]} cities - Liste de villes brutes
 * @returns {string[]} - Liste de villes normalisées et dédupliquées, triées
 */
function deduplicateCities(cities) {
  if (!Array.isArray(cities)) return [];
  
  const normalized = new Set();
  
  for (const city of cities) {
    const norm = normalizeCity(city);
    if (norm) normalized.add(norm);
  }
  
  return Array.from(normalized).sort((a, b) => a.localeCompare(b, 'fr'));
}

export { normalizeCity, deduplicateCities, CANONICAL_CITIES };
export default { normalizeCity, deduplicateCities, CANONICAL_CITIES };
