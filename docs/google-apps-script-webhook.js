/**
 * SCRIPT GOOGLE APPS SCRIPT POUR WEBHOOK AUTOMATIQUE
 * 
 * Ce script envoie automatiquement une notification au backend
 * à chaque fois qu'une nouvelle ligne est ajoutée au Google Sheet
 * 
 * INSTALLATION:
 * 1. Ouvre ton Google Sheet
 * 2. Menu Extensions > Apps Script
 * 3. Colle ce code dans l'éditeur
 * 4. Configure les variables ci-dessous
 * 5. Sauvegarde et active le trigger onEdit
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION - À MODIFIER SELON TON INSTALLATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // URL de ton backend (production ou local)
  BACKEND_URL: 'https://ton-backend.railway.app/api/ecom/webhooks/google-sheets',
  
  // ID de la source (à récupérer depuis MongoDB ou l'interface)
  SOURCE_ID: 'REMPLACE_PAR_TON_SOURCE_ID',
  
  // Clé secrète pour sécuriser le webhook (optionnel mais recommandé)
  SECRET_KEY: 'REMPLACE_PAR_UNE_CLE_SECRETE',
  
  // Nom de la feuille à surveiller (par défaut la première)
  SHEET_NAME: 'Sheet1',
  
  // Ligne où commencent les données (après les en-têtes)
  FIRST_DATA_ROW: 2
};

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE - NE PAS MODIFIER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fonction appelée automatiquement quand une ligne est ajoutée
 */
function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    
    // Vérifier que c'est la bonne feuille
    if (sheet.getName() !== CONFIG.SHEET_NAME) {
      return;
    }
    
    const range = e.range;
    const row = range.getRow();
    
    // Ignorer les modifications sur les en-têtes
    if (row < CONFIG.FIRST_DATA_ROW) {
      return;
    }
    
    // Vérifier si c'est une nouvelle ligne (toute la ligne a été modifiée)
    const numColumns = sheet.getLastColumn();
    const rowData = sheet.getRange(row, 1, 1, numColumns).getValues()[0];
    
    // Vérifier qu'il y a des données
    const hasData = rowData.some(cell => cell !== null && cell !== '');
    if (!hasData) {
      return;
    }
    
    Logger.log('📥 Nouvelle ligne détectée à la ligne ' + row);
    
    // Envoyer le webhook
    sendWebhook(sheet, row, rowData);
    
  } catch (error) {
    Logger.log('❌ Erreur onEdit: ' + error.toString());
  }
}

/**
 * Fonction pour envoyer le webhook au backend
 */
function sendWebhook(sheet, row, rowData) {
  try {
    // Récupérer les en-têtes
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Créer l'objet commande avec les données de la ligne
    const order = {};
    headers.forEach((header, index) => {
      if (header) {
        order[header] = rowData[index];
      }
    });
    
    // Préparer le payload
    const payload = {
      sourceId: CONFIG.SOURCE_ID,
      secretKey: CONFIG.SECRET_KEY,
      order: order
    };
    
    // Options de la requête HTTP
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    // Envoyer la requête
    const url = CONFIG.BACKEND_URL + '/' + CONFIG.SOURCE_ID;
    Logger.log('📤 Envoi webhook vers: ' + url);
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode === 200) {
      Logger.log('✅ Webhook envoyé avec succès');
      Logger.log('Response: ' + responseText);
    } else {
      Logger.log('❌ Erreur webhook (code ' + responseCode + '): ' + responseText);
    }
    
  } catch (error) {
    Logger.log('❌ Erreur sendWebhook: ' + error.toString());
  }
}

/**
 * Fonction de test manuelle
 * Menu: Extensions > Apps Script > Exécuter > testWebhook
 */
function testWebhook() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  if (lastRow < CONFIG.FIRST_DATA_ROW) {
    Logger.log('❌ Aucune donnée à tester');
    return;
  }
  
  const numColumns = sheet.getLastColumn();
  const rowData = sheet.getRange(lastRow, 1, 1, numColumns).getValues()[0];
  
  Logger.log('🧪 Test webhook avec la dernière ligne (' + lastRow + ')');
  sendWebhook(sheet, lastRow, rowData);
}

/**
 * Installation du trigger automatique
 * Menu: Extensions > Apps Script > Exécuter > installTrigger
 */
function installTrigger() {
  // Supprimer les anciens triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Créer le nouveau trigger
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  
  Logger.log('✅ Trigger installé avec succès');
}
