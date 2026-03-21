# 🗑️ Scripts de Suppression des Boutiques

## Vue d'ensemble

Ce dossier contient des scripts pour supprimer toutes les boutiques et données associées de la plateforme e-commerce.

⚠️ **ATTENTION**: Ces scripts suppriment des données de manière IRRÉVERSIBLE. Utilisez-les avec précaution!

## 📁 Fichiers

### `deleteAllStores.js` - Script Principal
Script complet pour supprimer toutes les boutiques et leurs données associées.

### `testDelete.js` - Script de Test  
Script pour tester la suppression en mode dry-run (simulation).

## 🚀 Utilisation

### 1. Test en Mode Dry-Run (Recommandé)
```bash
# Tester sans rien supprimer
node scripts/deleteAllStores.js --dry-run

# Ou utiliser le script de test
node scripts/testDelete.js
```

### 2. Suppression Interactive
```bash
# Avec confirmation interactive
node scripts/deleteAllStores.js
```

### 3. Suppression Automatique
```bash
# Suppression directe (DANGEREUX!)
node scripts/deleteAllStores.js --confirm
node scripts/deleteAllStores.js --force
```

## 📊 Données Supprimées

Le script supprime toutes les données suivantes :

### 🏪 **Boutiques**
- ✅ Workspaces (boutiques)
- ✅ Paramètres des boutiques
- ✅ Configurations de thème

### 👥 **Utilisateurs**
- ✅ Utilisateurs e-commerce
- ✅ Propriétaires de boutiques

### 📦 **Produits**
- ✅ Produits des boutiques (StoreProduct)
- ✅ Produits internes (Product)
- ✅ Configurations produits

### 🛒 **Commandes**
- ✅ Commandes boutiques (StoreOrder)
- ✅ Commandes internes (Order)
- ✅ Historique des commandes

### 👤 **Clients**
- ✅ Base clients
- ✅ Données clients

### 📧 **Marketing**
- ✅ Campagnes email
- ✅ Campagnes marketing
- ✅ Automations

### 📊 **Analytics**
- ✅ Événements d'analytics
- ✅ Sessions utilisateurs
- ✅ Données de tracking

### 💰 **Finances**
- ✅ Transactions
- ✅ Historique des paiements

### 🔔 **Communications**
- ✅ Notifications
- ✅ Logs WhatsApp
- ✅ Historique des messages

## 🛡️ Sécurités

### Confirmations Multiples
- Confirmation interactive obligatoire
- Message d'avertissement détaillé
- Phrase de sécurité à saisir: `"SUPPRIMER TOUT"`

### Sauvegarde Automatique
- Création d'un fichier de sauvegarde des métadonnées
- Stockage dans `scripts/backups/`
- Horodatage des sauvegardes

### Logging Complet
- Log détaillé de toutes les opérations
- Fichier de log: `scripts/deletion-log.txt`
- Horodatage de chaque action
- Statistiques complètes

### Mode Dry-Run
- Test sans suppression réelle
- Comptage des documents à supprimer
- Validation du processus

## 📋 Exemples d'Utilisation

### Test Rapide
```bash
cd /path/to/ecomcookpit-main/scalor
node scripts/testDelete.js
```

### Suppression Complète
```bash
cd /path/to/ecomcookpit-main/scalor

# 1. Tester d'abord
node scripts/deleteAllStores.js --dry-run

# 2. Vérifier les logs
cat scripts/deletion-log.txt

# 3. Supprimer si tout est OK
node scripts/deleteAllStores.js
# Puis saisir "SUPPRIMER TOUT" quand demandé
```

## 📊 Sortie Exemple

```
╔══════════════════════════════════════════════════════════════╗
║                🗑️  SUPPRESSION DES BOUTIQUES                  ║
║                                                              ║
║  ⚠️  ATTENTION: Ce script supprime TOUTES les données       ║
║      des boutiques de manière IRRÉVERSIBLE!                 ║
╚══════════════════════════════════════════════════════════════╝

🔌 Connexion à MongoDB...
✅ Connecté à MongoDB
📊 Trouvé 5 boutiques à supprimer

🏪 Boutiques à supprimer:
   • Ma Boutique Test (test-store) - ID: 60f7b8c8d5f9a12345678901
   • Boutique Demo (demo-store) - ID: 60f7b8c8d5f9a12345678902

📦 Suppression des données associées...
✅ Produits boutique: 25 documents supprimés
✅ Commandes boutique: 10 documents supprimés
✅ Clients: 15 documents supprimés

👥 Suppression des utilisateurs...
✅ Utilisateurs: 5 supprimés

🏪 Suppression des boutiques...
✅ Boutiques (Workspaces): 5 documents supprimés

📈 RÉSUMÉ DE LA SUPPRESSION:
   🏪 Boutiques: 5
   👥 Utilisateurs: 5
   📦 Produits: 25
   🛒 Commandes: 10
   👤 Clients: 15
   📧 Campagnes: 8
   📊 Analytics: 150
   💰 Transactions: 12
   🔔 Notifications: 45
   💬 Logs WhatsApp: 30

🎯 TOTAL: 305 documents supprimés
✅ Suppression terminée avec succès!
```

## ⚠️ Précautions Importantes

### Avant d'Exécuter
1. **Sauvegarde complète** de la base de données
2. **Vérification** qu'aucun utilisateur n'est connecté
3. **Test en dry-run** pour valider le processus
4. **Confirmation** avec l'équipe

### Environnements
- ✅ **Development**: OK
- ⚠️ **Staging**: Avec précautions
- ❌ **Production**: Seulement en cas d'urgence

### Variables d'Environnement
```bash
# Optionnel: spécifier la base de données
export MONGODB_URI="mongodb://localhost:27017/ecom-cockpit"
```

## 🔄 Récupération

### En Cas d'Erreur
1. Vérifier les logs: `scripts/deletion-log.txt`
2. Consulter la sauvegarde: `scripts/backups/`
3. Restaurer depuis une sauvegarde complète si nécessaire

### Redémarrage Propre
Après suppression, pour redémarrer proprement:
```bash
# Redémarrer les services
npm run dev

# Ou redémarrer complètement
docker-compose restart  # si utilisation de Docker
```

## 🛠️ Maintenance

### Nettoyage des Logs
```bash
# Vider le fichier de log
> scripts/deletion-log.txt

# Nettoyer les sauvegardes anciennes
rm scripts/backups/backup-*.json
```

### Mise à Jour du Script
Si de nouveaux modèles sont ajoutés, mettre à jour:
1. Les imports dans `deleteAllStores.js`
2. Les appels `deleteCollection()` 
3. Les statistiques de suppression

## 📞 Support

En cas de problème:
1. Vérifier les logs d'erreur
2. Consulter la documentation MongoDB
3. Contacter l'équipe technique

---

**⚠️ Rappel**: Ces scripts sont DESTRUCTIFS et IRRÉVERSIBLES. Utilisez-les uniquement quand nécessaire et toujours avec précaution!
