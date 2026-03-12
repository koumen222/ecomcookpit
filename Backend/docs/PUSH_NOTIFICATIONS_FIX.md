# 🔧 Fix: Push Notifications Base64URL Error

## ❌ Problème

Erreur répétée lors de l'envoi de notifications push :

```
Error: use maximum of 32 characters from the URL or filename-safe Base64 characters set
```

### Origine de l'erreur

- **Bibliothèque**: `web-push`
- **Fichier**: `Backend/services/pushService.js`
- **Fonction**: `sendNotification()`
- **Ligne**: 81-95 (appel à `webpush.sendNotification()`)

## 🔍 Cause racine

Le problème vient des **clés `auth` et `p256dh`** des subscriptions push qui sont mal formatées.

### Format requis

Les clés doivent être en **Base64URL** :
- ✅ Caractères autorisés : `A-Z`, `a-z`, `0-9`, `-`, `_`
- ❌ Caractères interdits : `+`, `/`, `=` (padding)
- 📏 Longueur attendue :
  - `auth` : ~22 caractères (16 bytes)
  - `p256dh` : ~87 caractères (65 bytes)

### Problème identifié

Les subscriptions étaient stockées avec des clés en **Base64 standard** :
- Contiennent `+` et `/` au lieu de `-` et `_`
- Contiennent du padding `=` à la fin
- Provoquent l'erreur lors de l'envoi

## ✅ Solution implémentée

### 1. Utilitaire de validation (`Backend/utils/vapidUtils.js`)

Nouveau fichier créé avec les fonctions :

- **`base64ToBase64Url()`** : Convertit Base64 → Base64URL
- **`validateAndNormalizeAuth()`** : Valide et normalise la clé `auth`
- **`validateAndNormalizeP256dh()`** : Valide et normalise la clé `p256dh`
- **`validateAndNormalizeSubscription()`** : Valide un subscription complet

### 2. Normalisation à la sauvegarde (`Backend/routes/push.js`)

Modification de la route `POST /api/ecom/push/subscribe` :

```javascript
// Normaliser les clés en Base64URL (sans padding)
const normalizedKeys = {
  p256dh: base64ToBase64Url(keys.p256dh),
  auth: base64ToBase64Url(keys.auth)
};
```

**Impact** : Tous les nouveaux subscriptions sont automatiquement normalisés.

### 3. Validation avant envoi (`Backend/services/pushService.js`)

Modification des fonctions `sendPushNotification()` et `sendPushNotificationToUser()` :

```javascript
// Valider et normaliser le subscription (Base64URL)
const normalizedSub = validateAndNormalizeSubscription({
  endpoint: subscription.endpoint,
  keys: {
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth
  }
});

await webpush.sendNotification(normalizedSub, payload, options);
```

**Impact** : Protection contre les subscriptions mal formatés + suppression automatique des subscriptions invalides.

### 4. Suppression automatique des subscriptions invalides

Amélioration de la gestion d'erreurs :

```javascript
// Si l'abonnement est invalide (410) ou mal formaté, le supprimer
if (error.statusCode === 410 || 
    error.message?.includes('Base64') || 
    error.message?.includes('32 characters')) {
  await Subscription.findByIdAndDelete(subscription._id).catch(() => {});
}
```

**Impact** : Nettoyage automatique de la base de données.

## 🔄 Migration des données existantes

### Script de migration créé

**Fichier** : `Backend/scripts/fixPushSubscriptions.js`

**Fonctionnalités** :
- ✅ Normalise toutes les clés existantes en Base64URL
- ✅ Valide chaque subscription
- ✅ Supprime les subscriptions invalides
- ✅ Affiche un rapport détaillé

### Exécution du script

```bash
# Depuis la racine du projet
node Backend/scripts/fixPushSubscriptions.js
```

**Résultat attendu** :
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

## 🧪 Tests

### 1. Tester l'envoi de notifications

```bash
# Via l'API
POST /api/ecom/push/test
Authorization: Bearer <token>
```

### 2. Vérifier les logs

Rechercher dans les logs :
- ✅ `✅ Notification push envoyée avec succès`
- ❌ `❌ Erreur envoi à l'abonné` (ne devrait plus apparaître)

### 3. Vérifier la base de données

```javascript
// Toutes les clés doivent être en Base64URL
db.subscriptions.find({}).forEach(sub => {
  console.log('auth:', sub.keys.auth);
  console.log('p256dh:', sub.keys.p256dh);
  // Ne doit contenir ni +, ni /, ni =
});
```

## 📋 Checklist de déploiement

- [ ] Exécuter le script de migration : `node Backend/scripts/fixPushSubscriptions.js`
- [ ] Vérifier que toutes les subscriptions sont normalisées
- [ ] Redémarrer le serveur backend
- [ ] Tester l'envoi de notifications via `/api/ecom/push/test`
- [ ] Surveiller les logs pour confirmer l'absence d'erreurs
- [ ] Demander aux utilisateurs de se réabonner si nécessaire

## 🔐 Configuration VAPID

### Vérifier les clés VAPID dans `.env`

```bash
# Les clés VAPID doivent aussi être en Base64URL
VAPID_PUBLIC_KEY=<clé_publique_base64url>
VAPID_PRIVATE_KEY=<clé_privée_base64url>
VAPID_SUBJECT=mailto:contact@example.com
```

### Générer de nouvelles clés VAPID (si nécessaire)

```javascript
// Utiliser web-push CLI
npx web-push generate-vapid-keys

// Ou en Node.js
import webpush from 'web-push';
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
```

**Important** : Les clés générées par `web-push` sont déjà en Base64URL ✅

## 📚 Références

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Base64URL Encoding](https://datatracker.ietf.org/doc/html/rfc4648#section-5)
- [web-push NPM](https://www.npmjs.com/package/web-push)

## 🎯 Résultat final

Après l'application de ce fix :

✅ **Plus d'erreur "32 characters"**  
✅ **Notifications push fonctionnelles**  
✅ **Subscriptions automatiquement normalisées**  
✅ **Nettoyage automatique des subscriptions invalides**  
✅ **Base de données propre**

---

**Date de création** : 2026-03-12  
**Auteur** : Cascade AI  
**Version** : 1.0
