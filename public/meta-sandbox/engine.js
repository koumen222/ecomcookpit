/**
 * Moteur de simulation Facebook Ads
 * Simule le comportement des campagnes avec logique de fatigue, scaling, etc.
 */

/**
 * Calculer les métriques d'une campagne
 */
function calculateCampaignMetrics(campaign) {
  const currentDay = getCurrentDay();
  const daysRunning = currentDay - campaign.dayCreated + 1;
  
  // Facteurs de base
  const baseCPM = getBaseCPM(campaign.country);
  const baseCTR = getBaseCTR(campaign);
  const baseCVR = getBaseCVR(campaign);
  
  // Facteur de fatigue (augmente avec le temps)
  const fatigueFactor = Math.min(campaign.fatigue / 100, 0.5);
  
  // Facteur d'apprentissage (améliore avec le temps jusqu'à un certain point)
  const learningFactor = Math.min(daysRunning / 7, 1.2);
  
  // Calcul CPM (augmente avec la fatigue)
  const cpm = baseCPM * (1 + fatigueFactor * 0.3);
  
  // Calcul CTR (diminue avec la fatigue, améliore avec l'apprentissage)
  const ctr = baseCTR * (1 - fatigueFactor * 0.4) * learningFactor;
  
  // Calcul CPC
  const cpc = cpm / (ctr * 1000);
  
  // Budget dépensé aujourd'hui
  const dailySpend = campaign.dailyBudget;
  
  // Calcul des impressions
  const impressions = (dailySpend / cpm) * 1000;
  
  // Calcul des clics
  const clicks = Math.floor(impressions * (ctr / 100));
  
  // Calcul des conversions
  const cvr = baseCVR * (1 - fatigueFactor * 0.3) * learningFactor;
  const orders = Math.floor(clicks * (cvr / 100));
  
  // Calcul du revenu (prix moyen 15000 FCFA)
  const averageOrderValue = 15000;
  const revenue = orders * averageOrderValue;
  
  // Calcul du profit
  const profit = revenue - dailySpend;
  
  // Mise à jour de la fatigue
  const newFatigue = Math.min(campaign.fatigue + (daysRunning > 3 ? 2 : 1), 100);
  
  // Déterminer le statut
  let status = campaign.status;
  if (daysRunning <= 3) {
    status = 'Learning';
  } else if (profit > 0 && ctr > 1) {
    status = 'Active';
  } else if (profit < 0 && daysRunning > 5) {
    status = 'Paused';
  } else if (newFatigue > 80) {
    status = 'Fatigued';
  }
  
  return {
    cpm: Math.round(cpm),
    ctr: parseFloat(ctr.toFixed(2)),
    cpc: parseFloat(cpc.toFixed(2)),
    clicks: clicks,
    orders: orders,
    revenue: revenue,
    profit: profit,
    fatigue: newFatigue,
    status: status,
    impressions: Math.floor(impressions)
  };
}

/**
 * Obtenir le CPM de base selon le pays
 */
function getBaseCPM(country) {
  const cpmRates = {
    'Cameroun': 800,
    'Sénégal': 750,
    'Côte d\'Ivoire': 700
  };
  return cpmRates[country] || 750;
}

/**
 * Obtenir le CTR de base selon la qualité
 */
function getBaseCTR(campaign) {
  // Score combiné (hook + creative + offer)
  const combinedScore = (campaign.hookScore + campaign.creaScore + campaign.offerScore) / 3;
  
  // CTR de base selon le type de ciblage
  let baseCTR = 1.5;
  if (campaign.targeting === 'broad') {
    baseCTR = 1.2;
  } else if (campaign.targeting === 'interests') {
    baseCTR = 1.8;
  } else if (campaign.targeting === 'retargeting') {
    baseCTR = 2.5;
  }
  
  // Ajuster selon le score de qualité
  return baseCTR * (0.5 + combinedScore);
}

/**
 * Obtenir le CVR de base selon la qualité
 */
function getBaseCVR(campaign) {
  // Score combiné
  const combinedScore = (campaign.hookScore + campaign.creaScore + campaign.offerScore) / 3;
  
  // CVR de base
  let baseCVR = 2.0;
  if (campaign.objective === 'conversion') {
    baseCVR = 2.5;
  } else if (campaign.objective === 'traffic') {
    baseCVR = 1.5;
  } else if (campaign.objective === 'messages') {
    baseCVR = 3.0;
  }
  
  // Ajuster selon le score de qualité
  return baseCVR * (0.4 + combinedScore * 0.6);
}

/**
 * Générer un message de coach
 */
function generateCoachMessage(campaigns) {
  const activeCampaigns = campaigns.filter(c => c.status === 'Active' || c.status === 'Learning');
  const profitableCampaigns = campaigns.filter(c => c.metrics.profit > 0);
  const fatiguedCampaigns = campaigns.filter(c => c.status === 'Fatigued');
  
  const messages = [];
  
  if (profitableCampaigns.length > 0) {
    const bestCampaign = profitableCampaigns.reduce((best, current) => 
      current.metrics.profit > best.metrics.profit ? current : best
    );
    messages.push(`🎯 Excellente nouvelle ! Votre campagne "${bestCampaign.name}" génère ${bestCampaign.metrics.profit.toLocaleString()} FCFA de profit. Pensez à augmenter le budget de 20% pour scaler.`);
  }
  
  if (fatiguedCampaigns.length > 0) {
    messages.push(`⚠️ Attention : ${fatiguedCampaigns.length} campagne(s) montrent des signes de fatigue. Pensez à créer de nouvelles créatives ou à faire une pause.`);
  }
  
  if (activeCampaigns.length === 0) {
    messages.push(`💡 Aucune campagne active. Créez une nouvelle campagne pour commencer à générer des ventes !`);
  }
  
  if (activeCampaigns.length > 0 && profitableCampaigns.length === 0) {
    messages.push(`📊 Vos campagnes sont en phase d'apprentissage. Laissez-les tourner encore quelques jours pour que l'algorithme optimise.`);
  }
  
  return messages.length > 0 ? messages.join('\n\n') : '✅ Tout va bien ! Continuez à monitorer vos campagnes.';
}

/**
 * Simuler toutes les campagnes
 */
function simulateAllCampaigns() {
  const campaigns = getCampaigns();
  const currentDay = getCurrentDay();
  
  return campaigns.map(campaign => {
    const metrics = calculateCampaignMetrics(campaign);
    return {
      ...campaign,
      metrics: metrics,
      status: metrics.status,
      fatigue: metrics.fatigue
    };
  });
}









