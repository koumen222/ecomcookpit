# Guide des Statuts de Commandes

## Statuts Supportés par le Système

Le système reconnaît automatiquement les statuts depuis Google Sheets en utilisant un mapping intelligent.

### 📋 Statuts Principaux

| Statut System | Variations Reconnues | Description |
|---------------|---------------------|-------------|
| **pending** | en attente, pending, nouveau, new, à traiter, en cours, processing, validation | Commande en attente de traitement |
| **confirmed** | confirmé, confirmed, validé, accepté, approuvé, confirm, valid, accept | Commande confirmée/prête |
| **shipped** | expédié, shipped, envoyé, en livraison, en route, en transit, transport | Commande expédiée |
| **delivered** | livré, delivered, reçu, remis, livraison terminée | Commande livrée au client |
| **returned** | retour, returned, remboursé, échange, refund | Commande retournée |
| **cancelled** | annulé, cancelled, abandonné, refusé, rejeté, cancel | Commande annulée |
| **unreachable** | injoignable, unreachable, non joignable, pas de réponse, contact impossible | Client injoignable |
| **called** | appelé, called, contacté, appel effectué, tentative appel | Client contacté par téléphone |
| **postponed** | reporté, postponed, différé, plus tard, ajourné | Commande reportée |

### 🔍 Détection Intelligente

Le système utilise deux méthodes de détection :

1. **Mapping Direct** : Reconnaissance exacte des variations
2. **Mots-clés** : Reconnaissance par fragments de texte

#### Exemples de Reconnaissance par Mots-clés

- `"Client appelé, pas de réponse"` → `called`
- `"En cours de livraison"` → `shipped`  
- `"Téléphone injoignable"` → `unreachable`
- `"Reporté demande client"` → `postponed`

### 🛠️ Résolution des Problèmes

#### Si tous les statuts apparaissent comme "pending"

1. **Vérifiez les logs de synchronisation** :
   ```bash
   # Dans les logs du backend, cherchez :
   ⚠️ Statut non reconnu
   🔍 Statut reconnu par mot-clé
   📊 Statistiques de mapping
   ```

2. **Identifiez les statuts non reconnus** dans les logs

3. **Ajoutez les variations manquantes** si nécessaire

#### Format des Statuts dans Google Sheets

- **Colonne statut** doit être nommée : "statut", "status", "état", "state", "livraison", "delivery"
- **Texte** : Insensible à la casse, accents gérés
- **Vide** : Si pas de statut → `pending` par défaut

### 📊 Statistiques de Synchronisation

Après chaque synchronisation, le système affiche :
```
📊 [sync_123] Statistiques de mapping des statuts:
   pending: 15 commandes
   confirmed: 8 commandes
   shipped: 12 commandes
   delivered: 25 commandes
⚠️ Statuts non reconnus (2): ["en attente de paiement", "traitement en cours"]
```

### 🔧 Personnalisation

Pour ajouter un nouveau statut ou variation :

1. **Éditez** `backend/ecom/routes/orders.js`
2. **Ajoutez** dans le `statusMap` :
   ```javascript
   'votre variation': 'votre_statut_system'
   ```
3. **Ou ajoutez** dans les `keywords` pour reconnaissance par fragments

### 🎯 Bonnes Pratiques

- **Standardisez** vos statuts dans Google Sheets
- **Utilisez** les variations supportées
- **Vérifiez** les logs après synchronisation
- **Testez** avec quelques lignes d'abord

### 📝 Exemple Concret

| Statut dans Sheet | Statut System | Log |
|------------------|---------------|-----|
| "En attente de paiement" | `pending` | ✅ Reconnu par mot-clé "attente" |
| "Livré ce matin" | `delivered` | ✅ Reconnu par mot-clé "livr" |
| "Client injoignable" | `unreachable` | ✅ Mapping direct |
| "STATUT INCONNU" | `pending` | ⚠️ Non reconnu, fallback vers pending |
