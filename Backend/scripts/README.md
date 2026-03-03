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
