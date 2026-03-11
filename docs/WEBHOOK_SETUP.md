# Configuration des Webhooks pour Notifications en Temps Réel

Ce guide explique comment configurer les webhooks pour recevoir des notifications de nouvelles commandes **sans polling**.

## 📋 Vue d'ensemble

Au lieu de vérifier périodiquement les Google Sheets (polling), le système utilise des **webhooks** :
- Google Apps Script détecte automatiquement les nouvelles lignes
- Envoie immédiatement une notification au backend
- Le backend crée la commande et envoie les notifications push à l'équipe

## 🚀 Installation

### Étape 1 : Récupérer l'ID de la source

1. Va dans l'interface admin
2. Menu **Commandes** > **Sources**
3. Copie l'**ID** de ta source Google Sheets (format : `69b1234567890abcdef`)

### Étape 2 : Configurer Google Apps Script

1. **Ouvre ton Google Sheet**
2. Menu **Extensions** > **Apps Script**
3. **Colle le code** depuis `docs/google-apps-script-webhook.js`
4. **Configure les variables** dans `CONFIG` :

```javascript
const CONFIG = {
  // URL de production
  BACKEND_URL: 'https://ton-backend.railway.app/api/ecom/webhooks/google-sheets',
  
  // OU URL locale pour tester
  // BACKEND_URL: 'http://localhost:8080/api/ecom/webhooks/google-sheets',
  
  // ID de ta source (copié depuis l'interface)
  SOURCE_ID: '69b1234567890abcdef',
  
  // Clé secrète (génère une chaîne aléatoire)
  SECRET_KEY: 'mon_secret_ultra_securise_123',
  
  // Nom de la feuille
  SHEET_NAME: 'Sheet1',
  
  // Première ligne de données (après en-têtes)
  FIRST_DATA_ROW: 2
};
```

5. **Sauvegarde** le script (Ctrl+S)

### Étape 3 : Installer le trigger automatique

1. Dans l'éditeur Apps Script, clique sur **Exécuter** > `installTrigger`
2. **Autorise** l'application (première fois seulement)
3. Le trigger est maintenant actif ✅

### Étape 4 : Tester le webhook

1. Dans l'éditeur Apps Script, clique sur **Exécuter** > `testWebhook`
2. Vérifie les logs : **Affichage** > **Journaux**
3. Tu devrais voir : `✅ Webhook envoyé avec succès`

### Étape 5 : Tester en conditions réelles

1. **Ajoute une nouvelle ligne** dans ton Google Sheet
2. Vérifie que :
   - La commande apparaît dans l'interface
   - Une notification push est envoyée à l'équipe
   - Les logs backend montrent : `📥 [WEBHOOK] Nouvelle commande reçue`

## 🔧 Configuration avancée

### Sécuriser le webhook avec une clé secrète

1. Génère une clé secrète forte :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Configure-la dans :
   - **Google Apps Script** : `CONFIG.SECRET_KEY`
   - **MongoDB** : Ajoute le champ `webhookSecret` à ta source

### Utiliser plusieurs feuilles

Si tu as plusieurs feuilles dans le même Google Sheet :

```javascript
const CONFIG = {
  SHEET_NAME: 'Commandes',  // Nom exact de la feuille
  // ...
};
```

### Déboguer les erreurs

Consulte les logs dans Google Apps Script :
1. Menu **Affichage** > **Journaux**
2. Ou **Affichage** > **Exécutions**

Logs backend :
```bash
# Cherche dans les logs du serveur
📥 [WEBHOOK] Nouvelle commande reçue
✅ [WEBHOOK] Nouvelle commande créée
📬 [WEBHOOK] Notifications envoyées
```

## 🔄 Désactiver le polling (optionnel)

Une fois les webhooks fonctionnels, tu peux désactiver le polling :

1. Va dans **MongoDB** ou l'interface admin
2. Trouve ta source dans la collection `ordersources`
3. Mets `pollingEnabled: false`

Ou garde les deux systèmes actifs pour plus de fiabilité.

## 📊 Avantages des webhooks

✅ **Instantané** : Notifications en temps réel (< 1 seconde)  
✅ **Économique** : Pas de requêtes inutiles toutes les 5 minutes  
✅ **Fiable** : Détection garantie de chaque nouvelle ligne  
✅ **Scalable** : Fonctionne avec des milliers de commandes  

## 🆘 Dépannage

### Le webhook ne se déclenche pas

- Vérifie que le trigger est installé : `installTrigger()`
- Vérifie le nom de la feuille dans `CONFIG.SHEET_NAME`
- Vérifie que tu ajoutes bien une **nouvelle ligne** (pas une modification)

### Erreur 404 ou 401

- Vérifie l'URL du backend dans `BACKEND_URL`
- Vérifie le `SOURCE_ID` (doit exister en base)
- Vérifie la `SECRET_KEY` (doit correspondre à celle en base)

### La commande n'apparaît pas

- Vérifie les logs backend
- Vérifie que le `workspaceId` de la source est correct
- Vérifie que les colonnes du Sheet correspondent au mapping

## 🔗 Routes disponibles

### POST `/api/ecom/webhooks/google-sheets/:sourceId`

Reçoit une nouvelle commande depuis Google Sheets.

**Body** :
```json
{
  "sourceId": "69b1234567890abcdef",
  "secretKey": "mon_secret",
  "order": {
    "Order ID": "CMD-001",
    "Full Name": "Jean Dupont",
    "Phone": "23566123456",
    "Product Name": "Produit XYZ",
    "Total Price": "15000",
    "City": "Douala",
    ...
  }
}
```

**Response** :
```json
{
  "success": true,
  "message": "Commande créée avec succès",
  "orderId": "69b1234567890abcdef",
  "orderNumber": "CMD-001"
}
```

### GET `/api/ecom/webhooks/test`

Test de santé du webhook endpoint.

**Response** :
```json
{
  "success": true,
  "message": "Webhook endpoint is working",
  "timestamp": "2026-03-11T16:41:00.000Z"
}
```

## 📝 Notes

- Les webhooks fonctionnent **en parallèle** du polling si activé
- Chaque nouvelle ligne déclenche **un seul** webhook
- Les modifications de lignes existantes sont **ignorées**
- Le système détecte automatiquement les doublons (même `orderId`)
