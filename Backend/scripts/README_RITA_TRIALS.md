# Script d'activation des essais Rita IA

## 📋 Description

Le script `activate-rita-trials.js` active automatiquement un **essai gratuit de 14 jours** pour tous les utilisateurs qui ont déjà activé Rita IA dans leur espace.

## 🎯 Fonctionnalités

1. **Détection automatique** : Trouve tous les utilisateurs avec `RitaConfig.enabled = true`
2. **Activation du trial** : Configure les champs trial du workspace :
   - `trialStartedAt` : Date actuelle
   - `trialEndsAt` : Date actuelle + 14 jours
   - `trialUsed` : true
3. **Email de bienvenue** : Envoie un email personnalisé à chaque utilisateur avec :
   - Confirmation de l'activation du trial
   - Durée de l'essai (14 jours)
   - Date d'expiration
   - Fonctionnalités de Rita IA
   - Lien vers la configuration

## 🚀 Utilisation

```bash
cd Backend
node scripts/activate-rita-trials.js
```

## 📊 Résultat

Le script affiche un rapport détaillé :

```
═══════════════════════════════════════
📊 RÉSUMÉ
═══════════════════════════════════════
✅ Succès        : 5
⚠️  Ignorés       : 3
❌ Erreurs       : 0
📋 Total configs : 8
═══════════════════════════════════════
```

## ✅ Cas traités

- ✅ **Succès** : Trial activé + email envoyé
- ⚠️ **Ignorés** : Trial déjà actif ou utilisateur sans email
- ❌ **Erreurs** : Problèmes lors du traitement

## 📧 Template email

Le script utilise le template `rita_trial_started` qui inclut :

- Message de bienvenue personnalisé
- Badge "Actif" pour Rita
- Liste des fonctionnalités
- Date d'expiration
- CTA vers la configuration
- Design Scalor (branding)

## 🔧 Configuration

- **Durée du trial** : 14 jours (modifiable via `TRIAL_DURATION_DAYS`)
- **Service email** : Resend (via `email.service.js`)
- **Base de données** : MongoDB (via `config/database.js`)

## ⚠️ Important

- Les utilisateurs avec un trial déjà actif sont **ignorés**
- Les utilisateurs sans email sont **ignorés**  
- Les workspaces sans propriétaire sont **ignorés**
- Le script peut être exécuté plusieurs fois sans problème (idempotent)

## 📝 Logs

Le script affiche en temps réel :
- Chaque utilisateur traité
- Status du trial (activé/ignoré)
- Envoi des emails
- Erreurs éventuelles
- Résumé final

## 🔗 Fichiers liés

- `Backend/core/notifications/email.service.js` - Service d'envoi d'emails
- `Backend/models/RitaConfig.js` - Modèle de configuration Rita
- `Backend/models/EcomUser.js` - Modèle utilisateur
- `Backend/models/Workspace.js` - Modèle workspace avec champs trial
