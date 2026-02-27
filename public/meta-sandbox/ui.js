/**
 * Gestion de l'interface utilisateur - Meta Ads Manager Style
 */

/**
 * Charger et afficher le dashboard
 */
function loadDashboard() {
  const campaigns = simulateAllCampaigns();
  
  // Sauvegarder les campagnes mises à jour
  campaigns.forEach(campaign => {
    updateCampaign(campaign.id, {
      metrics: campaign.metrics,
      status: campaign.status,
      fatigue: campaign.fatigue
    });
  });
  
  // Mettre à jour les stats globales
  updateGlobalStats(campaigns);
  
  // Afficher le tableau
  displayCampaignsTable(campaigns);
  
  // Afficher les messages du coach
  displayCoachMessage(campaigns);
}

/**
 * Mettre à jour les statistiques globales
 */
function updateGlobalStats(campaigns) {
  const totalBudget = campaigns.reduce((sum, c) => sum + (c.dailyBudget || 0), 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.metrics.impressions || 0), 0);
  const totalReach = campaigns.reduce((sum, c) => sum + (c.metrics.impressions || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.metrics.clicks || 0), 0);
  const totalOrders = campaigns.reduce((sum, c) => sum + (c.metrics.orders || 0), 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + (c.metrics.revenue || 0), 0);
  
  const avgCTR = campaigns.length > 0 
    ? (campaigns.reduce((sum, c) => sum + (c.metrics.ctr || 0), 0) / campaigns.length).toFixed(2)
    : 0;
  
  const avgCPC = totalClicks > 0
    ? Math.round(totalBudget / totalClicks)
    : 0;
  
  if (document.getElementById('totalBudget')) {
    document.getElementById('totalBudget').textContent = totalBudget.toLocaleString() + ' FCFA';
  }
  if (document.getElementById('totalImpressions')) {
    document.getElementById('totalImpressions').textContent = totalImpressions.toLocaleString();
  }
  if (document.getElementById('totalReach')) {
    document.getElementById('totalReach').textContent = totalReach.toLocaleString();
  }
  if (document.getElementById('totalClicks')) {
    document.getElementById('totalClicks').textContent = totalClicks.toLocaleString();
  }
  if (document.getElementById('avgCTR')) {
    document.getElementById('avgCTR').textContent = avgCTR + '%';
  }
  if (document.getElementById('avgCPC')) {
    document.getElementById('avgCPC').textContent = avgCPC.toLocaleString() + ' FCFA';
  }
  if (document.getElementById('totalOrders')) {
    document.getElementById('totalOrders').textContent = totalOrders.toLocaleString();
  }
  if (document.getElementById('totalRevenue')) {
    document.getElementById('totalRevenue').textContent = totalRevenue.toLocaleString() + ' FCFA';
  }
  
  // Mettre à jour le badge de comptage
  if (document.getElementById('campaignsCount')) {
    document.getElementById('campaignsCount').textContent = campaigns.length;
  }
  if (document.getElementById('tableCount')) {
    document.getElementById('tableCount').textContent = `(${campaigns.length})`;
  }
}

/**
 * Afficher le tableau des campagnes
 */
function displayCampaignsTable(campaigns) {
  const tbody = document.getElementById('campaignsTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (campaigns.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
          <p style="margin-bottom: 16px;">Aucune campagne créée</p>
          <button class="btn-create" onclick="window.location.href='create.html'">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm.5 4.5a.5.5 0 0 0-1 0v3h-3a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3v-3z"/>
            </svg>
            Créer une campagne
          </button>
        </td>
      </tr>
    `;
    return;
  }
  
  campaigns.forEach(campaign => {
    const row = document.createElement('tr');
    const m = campaign.metrics;
    
    row.innerHTML = `
      <td class="checkbox-col">
        <input type="checkbox" class="checkbox">
      </td>
      <td class="name-col">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <strong style="color: var(--text-primary);">${campaign.name}</strong>
          <small style="color: var(--text-secondary); font-size: 13px;">${getObjectiveLabel(campaign.objective)}</small>
        </div>
      </td>
      <td>
        <span class="status-badge status-${campaign.status.toLowerCase()}">
          ${getStatusLabel(campaign.status)}
        </span>
      </td>
      <td>${campaign.dailyBudget.toLocaleString()} FCFA</td>
      <td>${m.impressions.toLocaleString()}</td>
      <td>${m.impressions.toLocaleString()}</td>
      <td>${m.clicks.toLocaleString()}</td>
      <td>${m.ctr}%</td>
      <td>${m.cpc.toLocaleString()} FCFA</td>
      <td>${m.orders}</td>
      <td>${m.revenue.toLocaleString()} FCFA</td>
      <td class="actions-col">
        <button class="icon-btn" onclick="deleteCampaignById('${campaign.id}')" title="Supprimer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
          </svg>
        </button>
      </td>
    `;
    
    tbody.appendChild(row);
  });
}

/**
 * Obtenir le label de l'objectif
 */
function getObjectiveLabel(objective) {
  const labels = {
    'conversion': 'Conversion',
    'traffic': 'Trafic',
    'messages': 'Messages'
  };
  return labels[objective] || objective;
}

/**
 * Obtenir le label du statut
 */
function getStatusLabel(status) {
  const labels = {
    'Learning': 'Apprentissage',
    'Active': 'Actif',
    'Paused': 'En pause',
    'Fatigued': 'Fatigué'
  };
  return labels[status] || status;
}

/**
 * Afficher le message du coach
 */
function displayCoachMessage(campaigns) {
  const coachSection = document.getElementById('coachSection');
  const coachMessage = document.getElementById('coachMessage');
  
  if (!coachSection || !coachMessage) return;
  
  const message = generateCoachMessage(campaigns);
  coachMessage.textContent = message;
  coachSection.style.display = campaigns.length > 0 ? 'block' : 'none';
}

/**
 * Supprimer une campagne
 */
function deleteCampaignById(campaignId) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) {
    deleteCampaign(campaignId);
    loadDashboard();
  }
}

/**
 * Avancer d'un jour
 */
function advanceOneDay() {
  advanceDay();
  loadDashboard();
  const currentDay = getCurrentDay();
  alert(`⏭ Jour ${currentDay} - Les campagnes ont été mises à jour !`);
}

// Initialisation
if (document.getElementById('campaignsTableBody')) {
  // On est sur le dashboard
  loadDashboard();
  
  // Bouton avancer d'un jour
  const advanceBtn = document.getElementById('advanceDayBtn');
  if (advanceBtn) {
    advanceBtn.addEventListener('click', advanceOneDay);
  }
}
