# Scripts de Migration

## migratePaymentFields.js

Ce script ajoute les champs de paiement aux anciennes commandes StockOrder qui n'ont pas ces champs.

### Quand l'utiliser?

- Après avoir ajouté les champs `paidPurchase`, `paidTransport`, et `paid` au modèle StockOrder
- Si des commandes existantes ne s'affichent plus à cause des nouveaux champs

### Comment l'exécuter?

```bash
cd Backend
node scripts/migratePaymentFields.js
```

### Que fait le script?

1. Connexion à la base de données MongoDB
2. Recherche de toutes les commandes sans les champs de paiement
3. Ajout des champs avec des valeurs par défaut (`false`)
4. Affichage du résumé de la migration

### Valeurs par défaut appliquées

- `paidPurchase: false` (pour Chine)
- `paidTransport: false` (pour Chine) 
- `paid: false` (pour Local)

Après la migration, toutes les anciennes commandes s'afficheront correctement et pourront être modifiées pour définir les statuts de paiement.

---

## fixPushSubscriptions.js

Ce script corrige les clés Base64URL des subscriptions push pour éviter l'erreur "use maximum of 32 characters from the URL or filename-safe Base64 characters set".

### Quand l'utiliser?

- Si vous rencontrez l'erreur "32 characters" lors de l'envoi de notifications push
- Après avoir mis à jour le code de gestion des push notifications
- Pour nettoyer les subscriptions existantes avec des clés mal formatées

### Comment l'exécuter?

```bash
cd Backend
node scripts/fixPushSubscriptions.js
```

### Que fait le script?

1. Connexion à la base de données MongoDB
2. Récupération de toutes les subscriptions push
3. Normalisation des clés `auth` et `p256dh` en Base64URL
4. Validation de chaque subscription
5. Suppression des subscriptions invalides
6. Affichage d'un rapport détaillé

### Format Base64URL requis

- ✅ Caractères autorisés : `A-Z`, `a-z`, `0-9`, `-`, `_`
- ❌ Caractères interdits : `+`, `/`, `=` (padding)
- 📏 Longueur attendue :
  - `auth` : ~22 caractères (16 bytes)
  - `p256dh` : ~87 caractères (65 bytes)

### Résultat attendu

```
📊 RÉSUMÉ DE LA MIGRATION
============================================================
✅ Déjà valides:      X
🔧 Corrigées:         Y
🗑️ Supprimées:        Z
❌ Erreurs:           0
📊 Total:             N
============================================================
```

Après la migration, toutes les notifications push fonctionneront correctement sans erreur Base64URL.
