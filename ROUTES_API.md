# Documentation des Routes API Backend

## Configuration

**Base URL Backend**: `https://plateforme-backend-production-2ec6.up.railway.app`  
**Préfixe API**: `/api/ecom`  
**Port Local Backend**: `8080`

En développement local, le proxy Vite redirige `/api` vers `http://localhost:8080`.

## Routes Disponibles

### 🔐 Authentification (`/api/ecom/auth`)
- `POST /auth/login` - Connexion
- `POST /auth/refresh` - Rafraîchir le token
- `POST /auth/register` - Inscription (admin)
- `GET /auth/me` - Profil utilisateur
- `PUT /auth/profile` - Mettre à jour le profil
- `PUT /auth/avatar` - Mettre à jour l'avatar
- `PUT /auth/change-password` - Changer le mot de passe
- `PUT /auth/currency` - Changer la devise
- `POST /auth/register-device` - Enregistrer un appareil
- `POST /auth/send-otp` - Envoyer un code OTP
- `POST /auth/verify-otp` - Vérifier un code OTP
- `POST /auth/google` - Connexion Google
- `POST /auth/create-workspace` - Créer un workspace
- `POST /auth/join-workspace` - Rejoindre un workspace
- `GET /auth/invite/:token` - Valider une invitation
- `POST /auth/accept-invite` - Accepter une invitation
- `POST /auth/generate-invite` - Générer un lien d'invitation

### 📦 Produits (`/api/ecom/products`)
- `GET /products` - Liste des produits
- `GET /products/:id` - Détail d'un produit
- `POST /products` - Créer un produit
- `PUT /products/:id` - Mettre à jour un produit
- `DELETE /products/:id` - Supprimer un produit
- `GET /products/stats/overview` - Statistiques produits

### 🔍 Recherche Produits (`/api/ecom/products-research`)
- `GET /products-research` - Liste des recherches
- `GET /products-research/:id` - Détail d'une recherche
- `POST /products-research` - Créer une recherche
- `PUT /products-research/:id` - Mettre à jour une recherche
- `DELETE /products-research/:id` - Supprimer une recherche

### 📊 Rapports (`/api/ecom/reports`)
- `GET /reports` - Liste des rapports
- `GET /reports/:id` - Détail d'un rapport
- `POST /reports` - Créer un rapport
- `PUT /reports/:id` - Mettre à jour un rapport
- `DELETE /reports/:id` - Supprimer un rapport
- `GET /reports/stats/financial` - Statistiques financières

### 📦 Stock (`/api/ecom/stock`)
- `GET /stock/orders` - Commandes de stock
- `GET /stock/orders/:id` - Détail d'une commande
- `POST /stock/orders` - Créer une commande
- `PUT /stock/orders/:id/receive` - Marquer comme reçue
- `PUT /stock/orders/:id/cancel` - Annuler une commande
- `GET /stock/alerts` - Alertes de stock
- `GET /stock/overview` - Vue d'ensemble du stock

### 📍 Emplacements Stock (`/api/ecom/stock-locations`)
- `GET /stock-locations` - Liste des emplacements
- `GET /stock-locations/:id` - Détail d'un emplacement
- `POST /stock-locations` - Créer un emplacement
- `PUT /stock-locations/:id` - Mettre à jour un emplacement
- `DELETE /stock-locations/:id` - Supprimer un emplacement

### ✅ Décisions (`/api/ecom/decisions`)
- `GET /decisions` - Liste des décisions
- `GET /decisions/:id` - Détail d'une décision
- `POST /decisions` - Créer une décision
- `PUT /decisions/:id/assign` - Assigner une décision
- `PUT /decisions/:id/complete` - Marquer comme complétée
- `PUT /decisions/:id/cancel` - Annuler une décision
- `GET /decisions/dashboard/overview` - Dashboard des décisions

### 🎯 Objectifs (`/api/ecom/goals`)
- `GET /goals` - Liste des objectifs
- `GET /goals/:id` - Détail d'un objectif
- `POST /goals` - Créer un objectif
- `PUT /goals/:id` - Mettre à jour un objectif
- `DELETE /goals/:id` - Supprimer un objectif
- `GET /goals/progress` - Progression des objectifs

### 💰 Transactions (`/api/ecom/transactions`)
- `GET /transactions` - Liste des transactions
- `GET /transactions/:id` - Détail d'une transaction
- `POST /transactions` - Créer une transaction
- `PUT /transactions/:id` - Mettre à jour une transaction
- `DELETE /transactions/:id` - Supprimer une transaction
- `GET /transactions/stats` - Statistiques financières
- `GET /transactions/export` - Exporter les transactions

### 👥 Utilisateurs (`/api/ecom/users`)
- `GET /users` - Liste des utilisateurs (admin)
- `GET /users/:id` - Détail d'un utilisateur (admin)
- `POST /users` - Créer un utilisateur (admin)
- `PUT /users/:id` - Modifier un utilisateur (admin)
- `PUT /users/:id/reset-password` - Réinitialiser le mot de passe (admin)
- `DELETE /users/:id` - Supprimer un utilisateur (admin)
- `GET /users/livreurs/list` - Liste des livreurs actifs

### 📥 Import (`/api/ecom/import`)
- `POST /import/validate` - Valider un spreadsheet
- `POST /import/preview` - Aperçu des données
- `POST /import/run` - Lancer l'import
- `GET /import/history` - Historique des imports
- `GET /import/history/:id` - Détail d'un import

### 🔔 Notifications Push (`/api/ecom/push`)
- `GET /push/vapid-public-key` - Clé publique VAPID
- `POST /push/subscribe` - S'abonner aux notifications
- `DELETE /push/unsubscribe` - Se désabonner
- `POST /push/test` - Envoyer une notification de test

### 🔔 Notifications (`/api/ecom/notifications`)
- `GET /notifications` - Liste des notifications
- `GET /notifications/unread-count` - Nombre de non-lues
- `PUT /notifications/:id/read` - Marquer comme lue
- `PUT /notifications/read-all` - Tout marquer comme lu
- `DELETE /notifications/:id` - Supprimer une notification

### ⚙️ Préférences Notifications (`/api/ecom/notification-preferences`)
- `GET /notification-preferences` - Obtenir les préférences
- `PUT /notification-preferences` - Mettre à jour les préférences

### 👔 Affectations (`/api/ecom/assignments`)
- `GET /assignments` - Liste des affectations
- `GET /assignments/closeuse/:id` - Affectation d'une closeuse
- `GET /assignments/my-assignments` - Mes affectations
- `POST /assignments` - Créer une affectation
- `PUT /assignments/:id` - Mettre à jour une affectation
- `DELETE /assignments/:id` - Supprimer une affectation
- `GET /assignments/sources` - Sources disponibles

### 📦 Commandes (`/api/ecom/orders`)
- `GET /orders` - Liste des commandes
- `GET /orders/:id` - Détail d'une commande
- `POST /orders` - Créer une commande
- `PUT /orders/:id` - Mettre à jour une commande
- `DELETE /orders/:id` - Supprimer une commande
- `GET /orders/stats` - Statistiques des commandes
- `GET /orders/export` - Exporter les commandes
- `PUT /orders/:id/status` - Mettre à jour le statut
- `PUT /orders/:id/assign` - Assigner un livreur

### 👤 Clients (`/api/ecom/clients`)
- `GET /clients` - Liste des clients
- `GET /clients/:id` - Détail d'un client
- `POST /clients` - Créer un client
- `PUT /clients/:id` - Mettre à jour un client
- `DELETE /clients/:id` - Supprimer un client
- `GET /clients/stats` - Statistiques clients

### 📧 Campagnes (`/api/ecom/campaigns`)
- `GET /campaigns` - Liste des campagnes
- `GET /campaigns/:id` - Détail d'une campagne
- `POST /campaigns` - Créer une campagne
- `PUT /campaigns/:id` - Mettre à jour une campagne
- `DELETE /campaigns/:id` - Supprimer une campagne
- `POST /campaigns/:id/send` - Envoyer une campagne
- `GET /campaigns/:id/stats` - Statistiques campagne

### 🏢 Workspaces (`/api/ecom/workspaces`)
- `GET /workspaces` - Liste des workspaces
- `GET /workspaces/:id` - Détail d'un workspace
- `PUT /workspaces/:id` - Mettre à jour un workspace
- `GET /workspaces/:id/members` - Membres du workspace
- `POST /workspaces/:id/invite` - Inviter un membre
- `DELETE /workspaces/:id/members/:userId` - Retirer un membre
- `GET /workspaces/:id/settings` - Paramètres du workspace
- `PUT /workspaces/:id/settings` - Mettre à jour les paramètres

### 💬 Messages (`/api/ecom/messages`)
- `GET /messages` - Liste des messages
- `POST /messages` - Envoyer un message
- `PUT /messages/:id/read` - Marquer comme lu
- `DELETE /messages/:id` - Supprimer un message

### 💬 Messages Directs (`/api/ecom/dm`)
- `GET /dm/conversations` - Liste des conversations
- `GET /dm/:userId` - Messages d'une conversation
- `POST /dm/send` - Envoyer un message direct
- `PUT /dm/:userId/read` - Marquer comme lu
- `GET /dm/unread-count` - Nombre de non-lus

### 📁 Médias (`/api/ecom/media`)
- `POST /media/upload` - Upload un média
- `DELETE /media/:key` - Supprimer un média

### 📧 Contact (`/api/ecom/contact`)
- `POST /contact` - Envoyer un message de contact

### 🤖 Agent (`/api/ecom/agent`)
- `GET /agent/conversations` - Conversations avec l'agent
- `GET /agent/conversations/:id/messages` - Messages d'une conversation
- `POST /agent/chat` - Envoyer un message à l'agent
- `POST /agent/conversations` - Créer une conversation
- `DELETE /agent/conversations/:id` - Supprimer une conversation
- `POST /agent/commands/execute` - Exécuter une commande agent

### 📊 Analytics (`/api/ecom/analytics`)
- `POST /analytics/events` - Tracker un événement
- `GET /analytics/sessions` - Sessions
- `GET /analytics/stats` - Statistiques
- `GET /analytics/dashboard` - Dashboard analytics

### 🔧 Marketing (`/api/ecom/marketing`)
- `GET /marketing/campaigns` - Liste des campagnes marketing
- `GET /marketing/campaigns/:id` - Détail d'une campagne
- `POST /marketing/campaigns` - Créer une campagne
- `PUT /marketing/campaigns/:id` - Mettre à jour une campagne
- `DELETE /marketing/campaigns/:id` - Supprimer une campagne
- `POST /marketing/campaigns/:id/send` - Envoyer une campagne
- `POST /marketing/campaigns/:id/test` - Tester une campagne
- `POST /marketing/campaigns/:id/duplicate` - Dupliquer une campagne
- `GET /marketing/campaigns/:id/results` - Résultats d'une campagne
- `GET /marketing/stats` - Statistiques marketing
- `POST /marketing/audience-preview` - Aperçu de l'audience

### 👑 Super Admin (`/api/ecom/super-admin`)
- `GET /super-admin/users` - Liste des utilisateurs
- `GET /super-admin/users/:id` - Détail d'un utilisateur
- `PUT /super-admin/users/:id` - Mettre à jour un utilisateur
- `DELETE /super-admin/users/:id` - Supprimer un utilisateur
- `GET /super-admin/workspaces` - Liste des workspaces
- `GET /super-admin/workspaces/:id` - Détail d'un workspace
- `PUT /super-admin/workspaces/:id` - Mettre à jour un workspace
- `DELETE /super-admin/workspaces/:id` - Supprimer un workspace
- `GET /super-admin/analytics` - Analytics super admin
- `GET /super-admin/whatsapp-postulations` - Postulations WhatsApp
- `PUT /super-admin/whatsapp-postulations/:id` - Mettre à jour une postulation

### 🔄 Auto-Sync (`/api/ecom/auto-sync`)
- `GET /auto-sync/config` - Configuration auto-sync
- `PUT /auto-sync/config` - Mettre à jour la configuration
- `POST /auto-sync/sync-now` - Lancer une synchronisation manuelle
- `GET /auto-sync/history` - Historique des synchronisations

### 🎯 Ecore (`/api/ecom/ecore`)
- `POST /ecore/analyze` - Analyser un produit
- `GET /ecore/suggestions` - Suggestions
- `GET /ecore/reports/:id` - Rapport ecore

## Utilisation dans le Frontend

Toutes les routes sont accessibles via les services exportés dans `ecommApi.js`:

```javascript
import { 
  authApi, 
  productsApi, 
  ordersApi, 
  clientsApi,
  // ... autres APIs
} from '@/services/ecommApi.js';

// Exemple d'utilisation
const orders = await ordersApi.getOrders({ status: 'pending' });
const product = await productsApi.getProduct(productId);
```

## Configuration Environnement

**Fichier `.env.production`**:
```
VITE_BACKEND_URL=https://plateforme-backend-production-2ec6.up.railway.app
VITE_API_BASE_URL=https://plateforme-backend-production-2ec6.up.railway.app
VITE_API_URL=https://plateforme-backend-production-2ec6.up.railway.app
```

**Développement local**: Le proxy Vite redirige automatiquement `/api` vers `http://localhost:8080`.
