/**
 * Gestion des données - LocalStorage
 */

// Clé pour le stockage
const STORAGE_KEY = 'metaAdsSimulator_campaigns';
const STORAGE_DAY_KEY = 'metaAdsSimulator_currentDay';

/**
 * Récupérer toutes les campagnes
 */
function getCampaigns() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

/**
 * Sauvegarder une campagne
 */
function saveCampaign(campaign) {
  const campaigns = getCampaigns();
  campaigns.push(campaign);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
}

/**
 * Mettre à jour une campagne
 */
function updateCampaign(campaignId, updates) {
  const campaigns = getCampaigns();
  const index = campaigns.findIndex(c => c.id === campaignId);
  if (index !== -1) {
    campaigns[index] = { ...campaigns[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
    return campaigns[index];
  }
  return null;
}

/**
 * Supprimer une campagne
 */
function deleteCampaign(campaignId) {
  const campaigns = getCampaigns();
  const filtered = campaigns.filter(c => c.id !== campaignId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Obtenir le jour actuel
 */
function getCurrentDay() {
  const day = localStorage.getItem(STORAGE_DAY_KEY);
  return day ? parseInt(day) : 1;
}

/**
 * Avancer d'un jour
 */
function advanceDay() {
  const currentDay = getCurrentDay();
  localStorage.setItem(STORAGE_DAY_KEY, (currentDay + 1).toString());
  return currentDay + 1;
}

/**
 * Créer une nouvelle campagne
 */
function createCampaign(data) {
  return {
    id: Date.now().toString(),
    name: data.name,
    objective: data.objective,
    budget: data.budgetAmount,
    budgetType: data.budgetType,
    country: data.country,
    dailyBudget: data.dailyBudget,
    ageMin: data.ageMin,
    ageMax: data.ageMax,
    gender: data.gender,
    targeting: data.targeting,
    creativeType: data.creativeType,
    hookScore: getQualityScore(data.hookQuality),
    creaScore: getQualityScore(data.creativeQuality),
    offerScore: getQualityScore(data.offerQuality),
    fatigue: 0,
    status: 'Learning',
    dayCreated: getCurrentDay(),
    metrics: {
      cpm: 0,
      ctr: 0,
      cpc: 0,
      clicks: 0,
      orders: 0,
      revenue: 0,
      profit: 0
    }
  };
}

/**
 * Convertir qualité en score
 */
function getQualityScore(quality) {
  const scores = {
    'low': 0.3,
    'medium': 0.6,
    'high': 0.9
  };
  return scores[quality] || 0.5;
}









