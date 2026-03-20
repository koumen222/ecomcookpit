# SCALOR — Documentation Technique Complète

> **Version** : 1.0.0 | **Dernière mise à jour** : Mars 2026  
> **Stack** : React 18 + Vite 5 / Node.js 22 + Express 4 / MongoDB 8 / Redis  
> **Déploiement** : Netlify (frontend) + Railway (backend)

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture globale](#2-architecture-globale)
3. [Stack technique](#3-stack-technique)
4. [Structure du projet](#4-structure-du-projet)
5. [Backend — Architecture détaillée](#5-backend--architecture-détaillée)
   - 5.1 [Server & Middleware](#51-server--middleware)
   - 5.2 [Routes API (51 endpoints)](#52-routes-api-51-endpoints)
   - 5.3 [Modèles MongoDB (44 modèles)](#53-modèles-mongodb-44-modèles)
   - 5.4 [Services métier (34 services)](#54-services-métier-34-services)
   - 5.5 [Middleware personnalisés](#55-middleware-personnalisés)
   - 5.6 [Configuration](#56-configuration)
6. [Frontend — Architecture détaillée](#6-frontend--architecture-détaillée)
   - 6.1 [Point d'entrée & Routing](#61-point-dentrée--routing)
   - 6.2 [Pages (100+)](#62-pages-100)
   - 6.3 [Composants réutilisables (50+)](#63-composants-réutilisables-50)
   - 6.4 [Contexts & Hooks](#64-contexts--hooks)
   - 6.5 [Services frontend (9)](#65-services-frontend-9)
7. [Authentification & Sécurité](#7-authentification--sécurité)
   - 7.1 [Système JWT](#71-système-jwt)
   - 7.2 [Rôles & permissions](#72-rôles--permissions)
   - 7.3 [Mesures de sécurité](#73-mesures-de-sécurité)
8. [Base de données](#8-base-de-données)
   - 8.1 [Multi-tenancy](#81-multi-tenancy)
   - 8.2 [Schémas principaux détaillés](#82-schémas-principaux-détaillés)
   - 8.3 [Stratégie d'indexation](#83-stratégie-dindexation)
9. [Temps réel — Socket.io](#9-temps-réel--socketio)
10. [Intégrations externes](#10-intégrations-externes)
11. [Cache & Performance](#11-cache--performance)
12. [Déploiement & Infrastructure](#12-déploiement--infrastructure)
13. [Variables d'environnement](#13-variables-denvironnement)
14. [Workflows métier](#14-workflows-métier)
15. [Développement local](#15-développement-local)

---

## 1. Vue d'ensemble

**SCALOR** (anciennement EcomCookpit) est une plateforme SaaS multi-tenant de gestion e-commerce conçue pour les marchés francophones africains (Cameroun, Côte d'Ivoire, Sénégal, etc.).

### Fonctionnalités principales

| Domaine | Description |
|---------|-------------|
| **Gestion des commandes** | Réception multi-source (Shopify, Google Sheets, boutique, webhook, WhatsApp), suivi des statuts, attribution aux livreurs |
| **Gestion d'équipe** | Système multi-rôles (Admin, Closeuses, Comptables, Livreurs) avec permissions granulaires |
| **Contrôle financier** | Transactions, budgets, commissions, analyse de rentabilité |
| **Engagement client** | Automatisation WhatsApp, campagnes mass, agent IA conversationnel |
| **Outils de vente** | Recherche produit, sourcing Alibaba avec IA, gestion des stocks |
| **Boutique publique** | Génération automatique de vitrine multi-tenant (`{subdomain}.scalor.net`) |
| **Analytics** | Rapports quotidiens, performance équipe, insights financiers |
| **IA intégrée** | Génération de pages produit, copywriting, analyse d'images, agent conversationnel |

---

## 2. Architecture globale

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENTS                                │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Dashboard │  │ Boutique     │  │ Apps mobiles (PWA)     │  │
│  │ SPA React │  │ publique     │  │ Service Worker offline │  │
│  │ Vite 5    │  │ SSR/SPA      │  │ Push notifications     │  │
│  └─────┬─────┘  └──────┬───────┘  └──────────┬─────────────┘  │
│        │               │                     │                │
└────────┼───────────────┼─────────────────────┼────────────────┘
         │               │                     │
    HTTPS/WSS        HTTPS              Web Push (VAPID)
         │               │                     │
┌────────┼───────────────┼─────────────────────┼────────────────┐
│        ▼               ▼                     ▼                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                   API GATEWAY                          │   │
│  │            Express 4 + Socket.io                       │   │
│  │        (CORS, Helmet, Compression, JWT)                │   │
│  └───────────┬────────────────┬───────────────────────────┘   │
│              │                │                                │
│   ┌──────────▼──────┐ ┌──────▼───────────┐                   │
│   │   REST API      │ │   WebSocket      │                   │
│   │   51 routes     │ │   2 namespaces   │                   │
│   │   34 services   │ │   (main + store) │                   │
│   └──────────┬──────┘ └──────────────────┘                   │
│              │                                                │
│   ┌──────────▼────────────────────────────────────────────┐   │
│   │              COUCHE DONNÉES                           │   │
│   │  ┌──────────┐  ┌─────────┐  ┌──────────────────┐     │   │
│   │  │ MongoDB  │  │  Redis  │  │  Cloudflare R2   │     │   │
│   │  │ Atlas    │  │  Cache  │  │  (S3-compatible)  │     │   │
│   │  │ 44 modèles│ │  60s TTL│  │  Images/Fichiers │     │   │
│   │  └──────────┘  └─────────┘  └──────────────────┘     │   │
│   └───────────────────────────────────────────────────────┘   │
│                           BACKEND                             │
└───────────────────────────────────────────────────────────────┘
         │               │               │               │
    ┌────▼────┐   ┌──────▼─────┐  ┌─────▼──────┐  ┌────▼─────┐
    │ Shopify │   │ WhatsApp   │  │  OpenAI /  │  │  Resend  │
    │ OAuth + │   │ Evolution  │  │  Groq LLM  │  │  Email   │
    │ Webhooks│   │ API / Green│  │  GPT-5.2   │  │          │
    └─────────┘   └────────────┘  └────────────┘  └──────────┘
```

---

## 3. Stack technique

### Frontend

| Technologie | Version | Rôle |
|-------------|---------|------|
| **React** | 18.2.0 | Framework UI |
| **React Router** | 6.20.0 | Routing SPA |
| **Vite** | 5.4.21 | Build tool (HMR, code splitting, gzip/brotli) |
| **Tailwind CSS** | 3.4.19 | Styling utility-first |
| **Axios** | 1.13.2 | Client HTTP |
| **Socket.io-client** | 4.8.3 | WebSocket temps réel |
| **lucide-react** | — | Icônes |
| **react-markdown** | — | Rendu Markdown |
| **react-dnd** | — | Drag-and-drop (page builder) |
| **papaparse** | — | Import/export CSV |
| **xlsx** | — | Import/export Excel |
| **PostHog** | — | Product analytics |

### Backend

| Technologie | Version | Rôle |
|-------------|---------|------|
| **Node.js** | ≥22.11.0 | Runtime |
| **Express** | 4.18.2 | Framework HTTP |
| **Mongoose** | 8.8.4 | ODM pour MongoDB |
| **Socket.io** | 4.8.3 | WebSocket server |
| **jsonwebtoken** | — | JWT auth |
| **bcryptjs** | — | Hachage mots de passe |
| **OpenAI SDK** | — | IA (GPT-5.2, gpt-image-1) |
| **Groq SDK** | — | IA alternative |
| **Resend** | 3.5.0 | Service email transactionnel |
| **web-push** | — | Push notifications VAPID |
| **Sharp** | 0.33.5 | Traitement d'images |
| **AWS S3 SDK** | — | Stockage Cloudflare R2 |
| **ioredis** | — | Client Redis optimisé |
| **node-cron** | — | Tâches planifiées |
| **Helmet** | — | Sécurité HTTP |

### Infrastructure

| Service | Rôle |
|---------|------|
| **MongoDB Atlas** | Base de données principale |
| **Redis** | Cache de données (optionnel) |
| **Cloudflare R2** | Stockage objets (images, fichiers) |
| **Railway** | Hébergement backend |
| **Netlify** | Hébergement frontend |
| **Cloudflare** | CDN, DNS, domaines personnalisés |

---

## 4. Structure du projet

```
scalor/
│
├── Backend/                          # API Node.js/Express
│   ├── server.js                     # Point d'entrée serveur
│   ├── package.json                  # Dépendances backend
│   ├── Dockerfile                    # Image Docker
│   │
│   ├── config/                       # Modules de configuration
│   │   ├── database.js              # Connexion MongoDB (pool, heartbeat 30s)
│   │   ├── r2.js                    # Stockage Cloudflare R2 (S3-compatible)
│   │   ├── redisOptimized.js        # Redis (cluster, pipeline, multi-get)
│   │   ├── queryOptimizer.js        # Optimisation requêtes (prévention N+1)
│   │   └── push.js                  # Configuration VAPID push
│   │
│   ├── models/                       # 44 schémas Mongoose
│   ├── controllers/                  # 5 contrôleurs principaux
│   ├── routes/                       # 51 fichiers de routes
│   ├── services/                     # 34 services métier
│   ├── middleware/                    # 9 middleware personnalisés
│   ├── scripts/                      # Scripts de migration & utilitaires
│   ├── utils/                        # Fonctions utilitaires
│   └── docs/                         # Documentation technique backend
│
├── src/                              # Frontend React SPA
│   ├── main.jsx                     # Point d'entrée React
│   ├── ecom/
│   │   ├── App.jsx                  # Routing principal & layouts
│   │   ├── pages/                   # 100+ composants pages
│   │   ├── components/              # 50+ composants UI réutilisables
│   │   ├── contexts/                # React Contexts (Currency, Theme)
│   │   ├── hooks/                   # Hooks personnalisés
│   │   ├── services/                # 9 clients API frontend
│   │   ├── utils/                   # Helpers
│   │   ├── data/                    # Données statiques, constantes
│   │   ├── styles/                  # CSS global + base Tailwind
│   │   └── livreur/                 # Pages spécifiques livreurs
│   ├── lib/
│   │   └── api.js                   # Client Axios principal
│   └── utils/
│       └── analytics.js             # Tracking analytics
│
├── public/                           # Assets statiques
│   ├── sw-optimized.js              # Service Worker (offline + cache)
│   ├── manifest.json                # Manifest PWA
│   └── assets/, icons/, img/        # Ressources visuelles
│
├── scripts/                          # Scripts utilitaires
├── docs/                             # Documentation API
│
├── vite.config.js                   # Configuration Vite
├── tailwind.config.js               # Configuration Tailwind
├── postcss.config.js                # Configuration PostCSS
├── netlify.toml                     # Déploiement Netlify
├── railway.toml                     # Déploiement Railway
├── nixpacks.toml                    # Configuration NixPacks
└── package.json                     # Dépendances frontend
```

---

## 5. Backend — Architecture détaillée

### 5.1 Server & Middleware

**Fichier** : `Backend/server.js`

Le serveur Express charge les middleware dans l'ordre suivant :

```
1. CORS          → Origines autorisées : *.scalor.net, *.scalor.app, localhost:*
2. Helmet        → Headers de sécurité HTTP
3. Compression   → Gzip/Brotli (désactivé pour les routes SSE)
4. JSON Parser   → Limite 10 MB, capture du body brut pour webhooks
5. Cookie Parser → Parsing des cookies
6. Subdomain     → Extraction sous-domaine (req.subdomain, req.isApiDomain)
7. Path Normalize→ Rétro-compatibilité des chemins API
8. UTF-8 Enforce → Forçage charset UTF-8
9. Cache Headers → Statique: 1 an, HTML: 1 heure
```

**Endpoints système** :
- `GET /health` — Vérification santé serveur
- `GET /debug-encoding` — Test encodage

### 5.2 Routes API (51 endpoints)

#### Authentification & Utilisateurs

| Méthode(s) | Route | Description |
|------------|-------|-------------|
| POST | `/api/ecom/auth/register` | Inscription |
| POST | `/api/ecom/auth/login` | Connexion (email/password ou Google) |
| POST | `/api/ecom/auth/reset-password` | Réinitialisation mot de passe |
| GET/PUT | `/api/ecom/users` | Gestion des utilisateurs |
| CRUD | `/api/ecom/super-admin` | Actions super-administrateur |
| CRUD | `/api/ecom/super-admin/push` | Push notifications admin |

#### Gestion Commerciale

| Mount | Fichier route | Description |
|-------|---------------|-------------|
| `/api/ecom/products` | products.js | CRUD produits, prix, statut |
| `/api/ecom/orders` | orders.js | CRUD commandes, statuts, attributions |
| `/api/ecom/clients` | clients.js | CRM clients |
| `/api/ecom/stock` | stock.js | Gestion des stocks |
| `/api/ecom/stock-locations` | stockLocations.js | Emplacements d'entrepôt |
| `/api/ecom/transactions` | transactions.js | Écritures financières |
| `/api/ecom/goals` | goals.js | Objectifs de vente |
| `/api/ecom/reports` | reports.js | Rapports quotidiens |
| `/api/ecom/decisions` | decisions.js | Décisions budget pub |
| `/api/ecom/assignments` | assignments.js | Attributions closeuses/produits/villes |

#### Communication & Marketing

| Mount | Fichier route | Description |
|-------|---------------|-------------|
| `/api/ecom/campaigns` | campaigns.js | Campagnes WhatsApp |
| `/api/ecom/marketing` | marketing.js | Outils marketing |
| `/api/ecom/messages` | messages.js | Messagerie d'équipe |
| `/api/ecom/dm` | dm.js | Messages directs |
| `/api/ecom/notifications` | notifications.js | Centre de notifications |
| `/api/ecom/notification-preferences` | notificationPreferences.js | Préférences notifications |
| `/api/ecom/push` | push.js | Abonnements push |
| `/api/ecom/support` | support.js | Tickets de support |

#### IA & Automatisation

| Mount | Fichier route | Description |
|-------|---------------|-------------|
| `/api/ecom/agent` | agent.js | Agent IA conversationnel |
| `/api/ecom/agent/commands` | agentCommands.js | Commandes agent |
| `/api/ecom/alibaba-import` | alibabaImport.js | Scraping Alibaba (SSE) |
| `/api/ai/product-generator` | productPageGenerator.js | Génération pages IA (SSE) |
| `/api/ecom/products-research` | productResearch.js | Recherche produit IA |

#### Boutique Publique

| Mount | Fichier route | Description |
|-------|---------------|-------------|
| `/api/ecom/store-products` | storeProducts.js | Catalogue boutique |
| `/api/ecom/store-orders` | storeOrders.js | Commandes boutique |
| `/api/ecom/store-manage` | storeManagement.js | Configuration boutique |
| `/api/ecom/store` | storeAdmin.js | Administration boutique |
| `/api/public/store` | publicStore.js | API publique visiteurs |
| `/api/store` | storeApi.js | API unifiée boutique (via api.scalor.net) |

#### Intégrations Externes

| Mount | Fichier route | Description |
|-------|---------------|-------------|
| `/api/ecom/shopify` | shopify.js | OAuth Shopify |
| `/api/webhooks/shopify` | shopifyWebhooks.js | Webhooks Shopify (orders/create) |
| `/webhook/orders` | orderWebhook.js | Webhook générique commandes |
| `/api/ecom/integrations/whatsapp` | whatsappConfig.js | Config instances WhatsApp |
| `/api/ecom/v1/external/whatsapp` | externalWhatsapp.js | WhatsApp externe |
| `/api/ecom/auto-sync` | autoSync.js | Auto-sync Google Sheets |
| `/api/ecom/import` | import.js | Import données |
| `/api/ecom/webhooks` | webhooks.js | Webhooks génériques |

#### Utilitaires

| Mount | Fichier route | Description |
|-------|---------------|-------------|
| `/api/ecom/workspaces` | workspaces.js | Gestion workspaces multi-tenant |
| `/api/ecom/analytics` | analytics.js | Tracking événements |
| `/api/ecom/media-upload` | mediaUpload.js | Upload fichiers médias |
| `/api/ecom/media` | media.js | Bibliothèque médias |
| `/api/ecom/upload` | upload.js | Upload fichiers |
| `/api/ecom/contact` | contact.js | Formulaires de contact |
| `/api/ecom/sourcing` | sourcing.js | Données fournisseurs |
| `/api/ecom/sourcing/stats` | sourcingStats.js | Statistiques sourcing |
| `/api/ecom/diagnostics` | diagnostics.js | Diagnostics système |
| `/api/ecom/ecore` | ecore.js | Opérations e-commerce core |
| `/api/ecom/test` | test.js | Endpoints de test |

---

### 5.3 Modèles MongoDB (44 modèles)

#### Liste complète

| # | Modèle | Collection | Domaine |
|---|--------|------------|---------|
| 1 | `Order` | orders | Commerce |
| 2 | `Product` | products | Commerce |
| 3 | `Client` | clients | CRM |
| 4 | `StoreProduct` | storeproducts | Boutique |
| 5 | `StoreOrder` | storeorders | Boutique |
| 6 | `DailyReport` | dailyreports | Rapports |
| 7 | `Campaign` | campaigns | Marketing |
| 8 | `Transaction` | transactions | Finance |
| 9 | `Budget` | budgets | Finance |
| 10 | `Goal` | goals | Objectifs |
| 11 | `Decision` | decisions | Décisions |
| 12 | `EcomUser` | ecomusers | Utilisateurs |
| 13 | `Workspace` | workspaces | Multi-tenant |
| 14 | `WorkspaceSettings` | workspacesettings | Configuration |
| 15 | `CloseuseAssignment` | closeuseassignments | Attribution |
| 16 | `StockLocation` | stocklocations | Stock |
| 17 | `StockOrder` | stockorders | Stock |
| 18 | `Supplier` | suppliers | Sourcing |
| 19 | `SupplierOrder` | supplierorders | Sourcing |
| 20 | `ProductConfig` | productconfigs | Produits |
| 21 | `ProductResearch` | productresearches | Recherche |
| 22 | `AgentConversation` | agentconversations | IA |
| 23 | `AgentMessage` | agentmessages | IA |
| 24 | `RitaActivity` | ritaactivities | IA Agent |
| 25 | `RitaConfig` | ritaconfigs | IA Agent |
| 26 | `WhatsAppInstance` | whatsappinstances | WhatsApp |
| 27 | `WhatsAppLog` | whatsapplogs | WhatsApp |
| 28 | `WhatsAppOrder` | whatsapporders | WhatsApp |
| 29 | `ShopifyStore` | shopifystores | Shopify |
| 30 | `OrderSource` | ordersources | Intégrations |
| 31 | `ImportHistory` | importhistories | Import |
| 32 | `AnalyticsEvent` | analyticsevents | Analytics |
| 33 | `AnalyticsSession` | analyticssessions | Analytics |
| 34 | `Notification` | notifications | Notifications |
| 35 | `NotificationLog` | notificationlogs | Notifications |
| 36 | `UserNotificationPreferences` | usernotificationpreferences | Notifications |
| 37 | `Subscription` | subscriptions | Push |
| 38 | `PushAutomation` | pushautomations | Push |
| 39 | `PushScheduledNotification` | pushschedulednotifications | Push |
| 40 | `PushTemplate` | pushtemplates | Push |
| 41 | `Message` | messages | Messaging |
| 42 | `DirectMessage` | directmessages | Messaging |
| 43 | `Channel` | channels | Messaging |
| 44 | `EmailCampaign` | emailcampaigns | Email |
| 45 | `PasswordResetToken` | passwordresettokens | Auth |
| 46 | `SupportConversation` | supportconversations | Support |

---

### 5.4 Services métier (34 services)

| Service | Fichier | Description |
|---------|---------|-------------|
| **Agent IA** | `agentService.js` | Intégration OpenAI pour agent conversationnel client |
| **Agent Images** | `agentImageService.js` | Analyse d'images pour réponses agent |
| **Agent Cron** | `agentCronService.js` | Tâches planifiées agent |
| **Rita Agent** | `ritaAgentService.js` | Service agent Rita (livreur) |
| **Rita Boss Report** | `ritaBossReportService.js` | Rapports manager pour Rita |
| **Rita Cron** | `ritaCronService.js` | Jobs planifiés Rita |
| **WhatsApp** | `whatsappService.js` | Envoi de messages & gestion d'instances |
| **WhatsApp Simple** | `simpleWhatsappService.js` | Provider WhatsApp simplifié |
| **Evolution API** | `evolutionApiService.js` | Provider Evolution API WhatsApp |
| **Shopify Orders** | `shopifyOrderService.js` | Synchronisation commandes Shopify |
| **Shopify WhatsApp** | `shopifyWhatsappService.js` | Auto-confirmation Shopify via WhatsApp |
| **Push** | `pushService.js` | Notifications push web (VAPID) |
| **Push Scheduler** | `pushSchedulerService.js` | Notifications push planifiées |
| **Notification Helper** | `notificationHelper.js` | Fonctions helper notifications |
| **Email** | `emailService.js` | Intégration Resend (invitations, reset, alertes) |
| **Alibaba Import** | `alibabaImportService.js` | Scraping produits Alibaba (SSE) |
| **Alibaba Scraper** | `alibabaScraper.js` | Web scraping avec Scrape.do |
| **Product Page Gen** | `productPageGeneratorService.js` | Génération pages produit IA (SSE) |
| **Order Webhook** | `orderWebhookService.js` | Traitement webhooks commandes |
| **Auto Sync** | `autoSyncService.js` | Sync automatique Google Sheets |
| **Google Sheets Import** | `googleSheetsImport.js` | Import Google Sheets |
| **Google Sheets Polling** | `googleSheetsPolling.js` | Polling Google Sheets |
| **Order Cache** | `orderCacheService.js` | Cache des commandes |
| **Stock** | `stockService.js` | Gestion inventaire |
| **Socket** | `socketService.js` | Configuration Socket.io temps réel |
| **Cloudflare Images** | `cloudflareImagesService.js` | Optimisation images Cloudflare |
| **Image Optimizer** | `imageOptimizer.js` | Traitement & optimisation images |
| **Business Rules** | `businessRules.js` | Calculs des règles métier |
| **Calculations** | `calculations.js` | Calculs financiers |
| **Memory Cache** | `memoryCache.js` | Cache mémoire (fallback si Redis absent) |
| **Message Limit** | `messageLimitService.js` | Rate limiting messages |
| **Worker Pool** | `workerPool.js` | Pool de threads pour tâches CPU-intensives |
| **Compute Worker** | `computeWorker.js` | Worker thread calculs lourds |
| **NanoBanana** | `nanoBananaService.js` | Service NanoBanana |

---

### 5.5 Middleware personnalisés

| Middleware | Fichier | Description |
|-----------|---------|-------------|
| **Auth JWT** | `ecomAuth.js` | Validation JWT, extraction user, résolution workspace |
| **Store Auth** | `storeAuth.js` | Authentification spécifique boutique publique |
| **Subdomain** | `subdomain.js` | Extraction sous-domaine depuis `Host` header |
| **Workspace Resolver** | `workspaceResolver.js` | Résolution workspace via header `X-Workspace-Id` |
| **Validation** | `validation.js` | Validation des requêtes (body, params, query) |
| **Security** | `security.js` | Vérifications de sécurité additionnelles |
| **Compression** | `compressionMiddleware.js` | Gzip/Brotli (seuil 1KB, désactivé SSE) |
| **Cache Helper** | `cacheHelper.js` | Helpers d'intégration cache Redis |
| **Request Logger** | `requestLogger.js` | Logging requêtes HTTP (verbose en dev) |

---

### 5.6 Configuration

| Module | Fichier | Détails |
|--------|---------|---------|
| **MongoDB** | `config/database.js` | Connection pooling, health checks, auto-reconnect (heartbeat 30s) |
| **Redis** | `config/redisOptimized.js` | Cluster support, pipeline, multi-get/multi-set, pool size 10 |
| **R2 Storage** | `config/r2.js` | Client AWS S3 configuré pour Cloudflare R2 |
| **Query Optimizer** | `config/queryOptimizer.js` | Prévention N+1, stratégies eager loading |
| **Push** | `config/push.js` | Configuration VAPID pour web push |

---

## 6. Frontend — Architecture détaillée

### 6.1 Point d'entrée & Routing

**`src/main.jsx`** — Monte l'application React dans le DOM.

**`src/ecom/App.jsx`** — Routing principal avec React Router v6 :

```
<BrowserRouter>
  <EcomAuthProvider>         ← État authentification
    <CurrencyProvider>       ← Support multi-devises
      <ThemeProvider>        ← Thème dynamique
        <Routes>
          /ecom/login        → LoginPage
          /ecom/register     → RegisterPage
          /ecom/dashboard/*  → <ProtectedRoute> → DashboardRedirect
          /ecom/admin/*      → <ProtectedRoute role="ecom_admin">
          /ecom/closeuse/*   → <ProtectedRoute role="ecom_closeuse">
          /ecom/compta/*     → <ProtectedRoute role="ecom_compta">
          /ecom/livreur/*    → <ProtectedRoute role="ecom_livreur">
          /ecom/super-admin/*→ <ProtectedRoute role="super_admin">
          /store/*           → Public storefront (aucune auth)
        </Routes>
      </ThemeProvider>
    </CurrencyProvider>
  </EcomAuthProvider>
</BrowserRouter>
```

**Protection des routes** :
- `ProtectedRoute` — Vérifie JWT + rôle autorisé
- `DashboardRedirect` — Redirige vers le dashboard du rôle actif
- `RootRedirect` — Landing page vs. dashboard si déjà connecté

### 6.2 Pages (100+)

#### Pages Administrateur (`ecom_admin`)

| Page | Fichier | Description |
|------|---------|-------------|
| Dashboard | `AdminDashboard.jsx` | Tableau de bord principal, KPIs |
| Produits | `ProductsList.jsx`, `ProductForm.jsx` | Catalogue produits |
| Commandes | `OrdersList.jsx`, `OrderDetail.jsx` | Gestion commandes |
| Clients | `ClientsList.jsx` | CRM clientèle |
| Rapports | `ReportsList.jsx` | Rapports de vente quotidiens |
| Transactions | `TransactionsList.jsx` | Comptabilité |
| Stock | `StockManagement.jsx` | Gestion inventaire |
| Équipe | `UsersList.jsx` | Gestion utilisateurs |
| Campagnes | `CampaignsList.jsx`, `CampaignForm.jsx`, `CampaignDetail.jsx` | Campagnes WhatsApp |
| Marketing | `Marketing.jsx` | Outils marketing |
| Chat | `TeamChat.jsx` | Messagerie d'équipe |
| Agent IA | `AgentDashboard.jsx` | Tableau de bord agent IA |
| Recherche | `ProductResearchList.jsx`, `ProductFinder.jsx` | Recherche produit IA |
| Sourcing | Pages sourcing Alibaba | Import fournisseurs |

#### Pages Boutique (store builder)

| Page | Description |
|------|-------------|
| `StoreSetup.jsx` | Assistant création boutique |
| `BoutiqueDashboard.jsx` | Tableau de bord boutique |
| `BoutiqueTheme.jsx` | Constructeur de thème (couleurs, polices, layout) |
| `BoutiquePages.jsx` | Gestion des pages/sections |
| `BoutiquePayments.jsx` | Configuration paiement |
| `PublicStorefront.jsx` | Vitrine boutique côté visiteur |

#### Pages Closeuse (`ecom_closeuse`)

| Page | Description |
|------|-------------|
| `CloseuseDashboard.jsx` | Vue quotidienne, objectifs |
| `CloseuseProduits.jsx` | Produits assignés |
| `CloseuseReports.jsx` | Saisie rapports quotidiens |

#### Pages Comptable (`ecom_compta`)

| Page | Description |
|------|-------------|
| `ComptaDashboard.jsx` | Dashboard financier |
| `ComptaTransactions.jsx` | Écritures comptables |

#### Pages Livreur (`ecom_livreur`)

| Page | Description |
|------|-------------|
| `LivreurDashboard.jsx` | Dashboard livraisons |
| `LivreurDeliveries.jsx` | Liste livraisons assignées |
| `LivreurEarningsPage.jsx` | Suivi des gains |

#### Pages Super Admin (`super_admin`)

| Page | Description |
|------|-------------|
| `SuperAdminDashboard.jsx` | Vue globale plateforme |
| `SuperAdminUsers.jsx` | Gestion utilisateurs plateforme |
| `SuperAdminWorkspaces.jsx` | Gestion workspaces |
| `SuperAdminPushCenter.jsx` | Centre push notifications |
| `SuperAdminAnalytics.jsx` | Analytics plateforme |

### 6.3 Composants réutilisables (50+)

| Catégorie | Composants |
|-----------|------------|
| **Layout** | `EcomLayout`, `BoutiqueLayout` |
| **Page Builder** | `PageBuilder`, `PageBuilderFixed`, `VisualSiteBuilder`, `EnhancedVisualBuilder` |
| **Modales** | `AlibabaImportModal`, `ProductPageGeneratorModal`, `QuickOrderModal`, `WhatsAppSendModal`, `NotificationModal` |
| **Sélecteurs** | `CurrencySelector`, `WhatsAppInstanceSelector`, `WorkspaceSwitcher` |
| **Données** | `OrderCard`, `ProductCard`, `Money`, `KPICards`, `FinancialSummary` |
| **Formulaires** | `OrderForm`, `ProductImport`, `ProductSearch` |
| **Boutique** | Composants storefront (Hero, Catalogue, Checkout) |
| **Utilitaires** | `ChatWidget`, `GlobalSearch`, `ThemeTest`, `TopLoader` |

### 6.4 Contexts & Hooks

**Contexts React** :

| Context | Fichier | Rôle |
|---------|---------|------|
| `CurrencyContext` | `contexts/CurrencyContext.jsx` | Support multi-devises (50+ monnaies africaines + internationales) |
| `ThemeContext` | `contexts/ThemeContext.jsx` | Thème dynamique avec CSS variables |
| Auth (via hook) | `hooks/useEcomAuth.js` | État d'authentification |

**Hooks personnalisés** :

| Hook | Rôle |
|------|------|
| `useEcomAuth` | Logique d'authentification (login, logout, user state) |
| `usePosthogPageViews` | Tracking analytics PostHog |
| `useSubdomain` | Détection sous-domaine pour multi-boutique |

### 6.5 Services frontend (9)

| Service | Fichier | Rôle |
|---------|---------|------|
| **API principale** | `ecommApi.js` | Client Axios avec intercepteur JWT pour toutes les requêtes authentifiées |
| **API publique** | `publicApi.js` | Client non-authentifié pour boutique publique |
| **Store API** | `storeApi.js` | API gestion boutique (`storeManageApi` auth + `publicStoreApi` public) |
| **Marketing API** | `marketingApi.js` | API campagnes & tracking marketing |
| **Analytics** | `analytics.js` | Tracking événements utilisateur (désactivé en dev) |
| **PostHog** | `posthog.js` | Intégration PostHog analytics |
| **Performance** | `PerformanceMonitor.js` | Collecte métriques performance temps réel |
| **Logger** | `prodLogger.js` | Logging production (requêtes/réponses API) |
| **Sons** | `soundService.js` | Lecture audio (notifications sonores) |

---

## 7. Authentification & Sécurité

### 7.1 Système JWT

**Format du token** :

```
Authorization: Bearer [prefix:]<jwt>
```

Préfixes supportés :
- `ecom:` — Token standard
- `perm:` — Token permanent (expire en 365 jours)
- Aucun préfixe — JWT brut (format 3 parties)

**Payload JWT** :

```json
{
  "id": "userId (ObjectId)",
  "email": "user@example.com",
  "role": "ecom_admin",
  "workspaceId": "workspaceId (ObjectId)",
  "deviceId": "device_xxxxx",
  "type": "permanent|regular"
}
```

**Flux d'authentification** :

```
1. Extraction token depuis header "Authorization: Bearer {token}"
2. Suppression préfixe (ecom: / perm:) si présent
3. Vérification signature JWT avec ECOM_JWT_SECRET
4. Récupération user depuis cache (TTL 60s) ou MongoDB
5. Validation accès workspace via header "X-Workspace-Id" ou body
6. Injection dans req : req.user, req.ecomUser, req.workspaceId, req.ecomUserRole
```

**Cache utilisateur** :
- TTL de 60 secondes par utilisateur (réduit les requêtes MongoDB)
- Nettoyage automatique toutes les 5 minutes
- Invalidation au logout : `invalidateUserCache(userId)`

**Middleware disponibles** :
- `requireEcomAuth` — Impose l'authentification JWT
- `requireEcomRole(role)` — Contrôle d'accès basé sur le rôle
- `requireEcomPermission(permission)` — Contrôle par permission

### 7.2 Rôles & permissions

| Rôle | Code | Accès |
|------|------|-------|
| **Super Admin** | `super_admin` | Contrôle total plateforme (Scalor team) |
| **Admin** | `ecom_admin` | Propriétaire/manager de l'organisation |
| **Closeuse** | `ecom_closeuse` | Représentante commerciale |
| **Comptable** | `ecom_compta` | Gestion financière |
| **Livreur** | `ecom_livreur` | Agent de livraison |

**Hiérarchie d'accès** :

```
super_admin ──► Toutes les fonctions de tous les workspaces
ecom_admin  ──► Toutes les fonctions de son workspace
ecom_closeuse → Produits assignés, rapports, commandes propres
ecom_compta ──► Transactions, budgets, rapports financiers
ecom_livreur ─► Livraisons assignées, suivi GPS, gains
```

### 7.3 Mesures de sécurité

| Mesure | Implémentation |
|--------|----------------|
| **Hachage mots de passe** | bcryptjs (salt: 12 rounds) |
| **Headers HTTP** | Helmet (CSP, HSTS, X-Frame-Options, etc.) |
| **CORS** | Origines whitelist (*.scalor.net, *.scalor.app, localhost) |
| **Vérification webhook** | HMAC Shopify, tokens workspace |
| **Variables secrètes** | Toutes via variables d'environnement |
| **Validation tenant** | Header `X-Workspace-Id` vérifié à chaque requête |
| **Rate limiting** | Limitation messages WhatsApp par service |
| **Compression** | Désactivée pour SSE (prévention buffer overflow) |

---

## 8. Base de données

### 8.1 Multi-tenancy

L'isolation des données est garantie par le champ `workspaceId` présent sur **toutes les collections métier** :

```javascript
// Chaque requête est scopée au workspace
Order.find({ workspaceId: req.workspaceId, status: 'pending' })
Product.find({ workspaceId: req.workspaceId, isActive: true })
Client.find({ workspaceId: req.workspaceId })
```

Le middleware `workspaceResolver` injecte automatiquement `req.workspaceId` depuis :
1. Le header `X-Workspace-Id`
2. Le workspace principal de l'utilisateur
3. Le body de la requête (`workspaceId`)

### 8.2 Schémas principaux détaillés

#### Order (Commande)

```javascript
{
  // ── Identification ──
  workspaceId:    ObjectId,     // Workspace (indexed)
  orderId:        String,       // Identifiant commande
  date:           Date,         // Date commande
  source:         enum ['google_sheets', 'manual', 'boutique', 'shopify', 'webhook', 'rita'],

  // ── Client ──
  clientName:     String,       // Nom client
  clientPhone:    String,       // Téléphone brut
  clientPhoneNormalized: String,// Téléphone normalisé (indexed)

  // ── Détails commande ──
  product:        String,       // Nom produit
  quantity:       Number,       // Quantité
  price:          Number,       // Prix
  currency:       String,       // Devise
  city:           String,       // Ville
  address:        String,       // Adresse complète
  status:         String,       // Statut (default: 'pending')
  tags:           [String],     // Tags de catégorisation
  notes:          String,       // Notes internes

  // ── Livraison ──
  assignedLivreur:        ObjectId,  // Livreur assigné
  readyForDelivery:       Boolean,   // Prêt à livrer (indexed)
  deliveryLocation:       String,    // Lieu de livraison
  deliveryTime:           String,    // Créneau
  deliveryStartedAt:      Date,      // Début livraison
  deliveryStartLat/Lng:   Number,    // GPS départ
  deliveryEndLat/Lng:     Number,    // GPS arrivée
  deliveryEndAddress:     String,    // Adresse arrivée
  deliveryDistanceKm:     Number,    // Distance calculée
  deliveryCostFcfa:       Number,    // Coût livraison
  deliveryNote:           String,    // Note livreur
  nonDeliveryReason:      String,    // Raison non-livraison

  // ── Système d'offres de livraison ──
  deliveryOfferMode:      enum ['none', 'broadcast', 'targeted'],
  deliveryOfferTargetLivreur: ObjectId,
  deliveryOfferSentAt:    Date,
  deliveryOfferExpiresAt: Date,
  deliveryOfferEscalatedAt: Date,
  deliveryOfferRefusedBy: [ObjectId],

  // ── Suivi ──
  whatsappNotificationSent:    Boolean,
  whatsappNotificationSentAt:  Date,
  statusModifiedManually:      Boolean,
  statusModifiedAt:            Date,
  rawData:                     Mixed,    // Données brutes webhook
  storeOrderId:                ObjectId, // Ref StoreOrder

  // ── Timestamps ──
  createdAt:  Date,
  updatedAt:  Date
}
```

#### Product (Produit)

```javascript
{
  workspaceId:      ObjectId,   // Workspace (indexed)
  name:             String,     // Nom (max 100, required)
  status:           enum ['test', 'stable', 'winner', 'pause', 'stop'], // default: 'test'

  // ── Pricing ──
  sellingPrice:     Number,     // Prix de vente (required)
  productCost:      Number,     // Coût produit (required)
  deliveryCost:     Number,     // Coût livraison (required)
  avgAdsCost:       Number,     // Coût pub moyen (default: 0)

  // ── Stock ──
  stock:            Number,     // Quantité en stock (required)
  reorderThreshold: Number,     // Seuil de réapprovisionnement (default: 10)

  // ── Statut ──
  isActive:         Boolean,    // Actif (default: true)
  createdBy:        ObjectId,   // Créateur (ref: EcomUser)
}

// Méthodes
product.getMargin()       // → sellingPrice - productCost - deliveryCost
product.isLowStock()      // → stock <= reorderThreshold
product.getProfitPerUnit() // → idem margin
product.roi               // → virtual: ROI en pourcentage
```

#### EcomUser (Utilisateur)

```javascript
{
  // ── Auth ──
  email:       String,    // Unique, lowercase, required
  password:    String,    // Haché bcrypt (minlength 6, conditionnel si !googleId)
  googleId:    String,    // Google OAuth (sparse unique)

  // ── Profil ──
  name:        String,
  phone:       String,
  avatar:      String,    // URL avatar

  // ── Rôle legacy ──
  role:        enum ['super_admin', 'ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur', null],

  // ── Workspace principal ──
  workspaceId: ObjectId,

  // ── Multi-workspace ──
  workspaces: [{
    workspaceId: ObjectId,
    role:        enum ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'],
    joinedAt:    Date,
    invitedBy:   ObjectId,
    status:      enum ['active', 'pending', 'suspended']
  }],

  // ── Statut ──
  isActive:    Boolean,   // default: true
  lastLogin:   Date,
  currency:    String,    // Devise préférée (XAF, XOF, NGN, GHS, KES, USD, EUR, etc.)

  // ── Device ──
  deviceToken: String,
  deviceInfo:  { deviceId, userAgent, platform, lastSeen },
}

// Méthodes d'instance
user.comparePassword(candidatePassword)     // Comparaison hash
user.addWorkspace(workspaceId, role, by)    // Ajout workspace
user.hasWorkspaceAccess(workspaceId)        // Vérification accès
user.getRoleInWorkspace(workspaceId)        // Rôle dans workspace
user.getActiveWorkspaces()                  // Workspaces actifs
user.leaveWorkspace(workspaceId)            // Quitter workspace
user.getPermissions()                       // Tableau des permissions
user.hasPermission(permission)              // Vérifier permission
```

#### Workspace

```javascript
{
  name:       String,       // Nom organisation (required)
  slug:       String,       // Slug unique auto-généré
  owner:      ObjectId,     // Propriétaire (ref: EcomUser, required)
  inviteCode: String,       // Code d'invitation (hex unique)
  settings:   Mixed,        // { currency: 'XOF', businessType: 'ecommerce' }
  subdomain:  String,       // Sous-domaine boutique (unique, sparse)

  // ── Configuration boutique ──
  storeSettings: {
    isStoreEnabled:   Boolean,
    storeName:        String,
    storeDescription: String,
    storeLogo:        String,   // URL
    storeBanner:      String,   // URL
    storePhone:       String,
    storeWhatsApp:    String,
    storeThemeColor:  String,   // Hex (default: '#0F6B4F')
    storeCurrency:    String,   // default: 'XAF'
  },
  storeTheme:          Mixed,   // { colors, fonts, borders, template }
  storePages:          Mixed,   // Sections de pages ordonnées
  storePixels:         Mixed,   // GA, Facebook Pixel, etc.
  storePayments:       Mixed,   // Providers paiement (Stripe, Wave, etc.)
  storeDomains:        Mixed,   // Domaines personnalisés
  storeDeliveryZones:  Mixed,   // { countries: [], zones: [{city, cost}] }

  // ── Webhooks ──
  shopifyWebhookToken: String,  // Token webhook Shopify (unique, sparse)
  orderWebhookToken:   String,  // Token webhook générique (unique, sparse)
  orderWebhookFilters: Mixed,   // Filtres (ville, produit)

  // ── Auto-confirmation WhatsApp ──
  whatsappAutoConfirm:     Boolean,   // default: false
  whatsappOrderTemplate:   String,    // Variables: {{first_name}}, {{order_number}}, etc.
  whatsappAutoInstanceId:  ObjectId,  // Instance WhatsApp utilisée
  whatsappAutoImageUrl:    String,
  whatsappAutoAudioUrl:    String,

  // ── Invitations ──
  invites: [{
    token:     String,
    createdBy: ObjectId,
    expiresAt: Date,       // 7 jours
    used:      Boolean,
    usedBy:    ObjectId,
    usedAt:    Date
  }],

  isActive: Boolean,
}
```

### 8.3 Stratégie d'indexation

#### Index composites Order (collection la plus sollicitée)

```javascript
// Filtrage par statut + date
{ workspaceId: 1, status: 1, date: -1 }

// Filtrage par ville + statut
{ workspaceId: 1, city: 1, status: 1 }

// Filtrage par produit + statut
{ workspaceId: 1, product: 1, status: 1 }

// Pagination avec filtre
{ workspaceId: 1, date: -1, status: 1 }

// Requêtes de polling (commandes modifiées récemment)
{ workspaceId: 1, updatedAt: -1 }

// Tracking par source
{ workspaceId: 1, source: 1, date: -1 }

// Filtrage par tags
{ workspaceId: 1, tags: 1, status: 1 }

// Recherche full-text
{ clientName: 'text', clientPhone: 'text', city: 'text', product: 'text', address: 'text' }
// clientName pondéré 10x
```

#### Index Product

```javascript
{ status: 1, isActive: 1 }     // Filtrage statut
{ stock: 1 }                    // Requêtes stock bas
{ name: 'text', status: 'text' } // Recherche full-text
```

#### Index Workspace

```javascript
{ owner: 1 }
{ subdomain: 1 }                           // Unique sparse
{ subdomain: 1, isActive: 1, 'storeSettings.isStoreEnabled': 1 } // Lookup boutique
```

---

## 9. Temps réel — Socket.io

### Configuration

```javascript
{
  cors: {
    origin: ['*.scalor.net', '*.scalor.app', 'localhost:*', '*.ecomcookpit.site']
  },
  transports: ['websocket', 'polling'],  // WebSocket prioritaire
  pingTimeout: 120000,                   // 2 min
  pingInterval: 30000,                   // 30s
  connectTimeout: 45000,                 // 45s
  maxHttpBufferSize: 1048576,            // 1 MB
  perMessageDeflate: { threshold: 1024 } // Compression > 1KB
}
```

### Namespace principal (`/`)

**Authentification** : JWT token requis à la connexion.

**Rooms** :
- `user:{userId}` — Notifications personnelles
- `workspace:{workspaceId}` — Événements workspace
- `conversation:{convKey}` — Conversation 1:1

**Événements client → serveur** :

| Événement | Payload | Description |
|-----------|---------|-------------|
| `conversation:join` | `{ recipientId }` | Rejoindre une conversation |
| `conversation:leave` | `{ recipientId }` | Quitter une conversation |
| `typing:start` | `{ recipientId }` | Indicateur "en train d'écrire" (timeout 5s) |
| `typing:stop` | `{ recipientId }` | Arrêt indicateur |
| `message:read` | `{ messageIds, senderId }` | Accusés de lecture |

**Événements serveur → client** :

| Événement | Payload | Description |
|-----------|---------|-------------|
| `typing:start` | `{ userId, userName, conversationKey }` | Diffusion typing |
| `typing:stop` | `{ userId, userName, conversationKey }` | Arrêt typing |
| `message:status` | `{ messageIds, status, readBy, readAt }` | Statut messages |
| `message:new` | Message complet | Nouveau message |

**Helpers serveur** :

```javascript
isUserOnline(userId)                    // Vérifie si l'utilisateur a un socket actif
getOnlineUsersInWorkspace(workspaceId)  // Liste des utilisateurs en ligne
emitNewMessage(message, recipientId)    // Broadcast nouveau message
```

### Namespace `/store-live`

**Authentification** : Aucune (public).

**Usage** : Mise à jour en temps réel du thème boutique pour les visiteurs.

| Événement | Direction | Description |
|-----------|-----------|-------------|
| `store:join` | Client → Serveur | Rejoindre le room d'une boutique (`{ subdomain }`) |
| `theme:broadcast` | Client → Serveur | Admin diffuse un thème (`{ subdomain, theme, token }`) |
| `theme:update` | Serveur → Client | Mise à jour thème diffusée à tous les visiteurs |

---

## 10. Intégrations externes

### WhatsApp

| Provider | Service | Endpoint |
|----------|---------|----------|
| **Evolution API** | `evolutionApiService.js` | `EVOLUTION_API_URL/message/sendText/{instanceName}` |
| **Green API** | `whatsappService.js` | Via `GREEN_API_ID_INSTANCE` |
| **Simple WhatsApp** | `simpleWhatsappService.js` | Provider simplifié |

**Fonctionnalités** :
- Multi-instance (chaque workspace peut avoir plusieurs numéros)
- Historique messages (`WhatsAppLog`)
- Campagnes de masse avec filtres (ville, produit, statut client)
- Agent IA pour conversations client
- Auto-confirmation commandes Shopify
- Normalisation & validation numéros de téléphone

**Modèle `WhatsAppInstance`** :

```javascript
{
  instanceName:    String,
  instanceToken:   String,
  status:          String,
  isActive:        Boolean,
  whatsappNumber:  String,
  workspaceId:     ObjectId
}
```

### Shopify

**Flux OAuth** :
```
1. Admin clique "Connecter Shopify"
2. Redirection vers Shopify OAuth → SHOPIFY_REDIRECT_URI
3. Callback avec access_token
4. Enregistrement webhook orders/create
5. Commandes Shopify créées automatiquement dans SCALOR
6. Auto-confirmation WhatsApp optionnelle
```

**Fichiers** :
- `shopifyController.js` — Gestion OAuth
- `shopifyWebhookController.js` — Traitement webhook
- `shopifyOrderService.js` — Sync commandes
- `shopifyWhatsappService.js` — Confirmation WhatsApp
- `ShopifyStore.js` — Modèle boutique Shopify connectée

### Paiements

| Provider | Usage | Configuration |
|----------|-------|---------------|
| **Monetbil** | Paiement mobile (Afrique) | `MONETBIL_SERVICE_KEY`, `MONETBIL_SERVICE_SECRET` |
| **Lygos** | Paiement régional | `LYGOS_API_KEY`, `LYGOS_BASE_URL` |
| **Wave/Orange Money** | Via configuration boutique | `storePayments` dans Workspace |

### Intelligence Artificielle

| Service | Provider | Modèle | Usage |
|---------|----------|--------|-------|
| **Agent conversationnel** | OpenAI | GPT-5.2 | Support client WhatsApp, analyse d'intent/sentiment |
| **Génération pages produit** | OpenAI | GPT-5.2 | Copywriting produit (SSE streaming) |
| **Génération d'images** | OpenAI | gpt-image-1 | Images produit IA |
| **Recherche produit** | OpenAI + Groq | Variable | Analyse & scoring produits |
| **Scraping Alibaba** | Scrape.do | — | Extraction données produits Alibaba |

### Email

| Provider | Service | Usages |
|----------|---------|--------|
| **Resend** | `emailService.js` | Invitations workspace, reset mot de passe, alertes, notifications |

### Stockage

| Service | Type | Usage |
|---------|------|-------|
| **Cloudflare R2** | Objet (S3-compatible) | Images produits, profils, pièces jointes |
| **Cloudflare Images** | CDN images | Optimisation & livraison images |

### Analytics

| Service | Domaine | Usage |
|---------|---------|-------|
| **PostHog** | Product analytics | Comportement utilisateur frontend |
| **Analytics custom** | Interne | Événements, sessions (AnalyticsEvent, AnalyticsSession) |

---

## 11. Cache & Performance

### Redis (optionnel mais recommandé)

**Configuration** (`config/redisOptimized.js`) :
- Pool de connexions (taille: 10)
- Support cluster (multi-nœuds)
- Pipeline pour opérations batch
- Multi-get / multi-set pour efficacité
- Expiration TTL configurable
- Pattern refresh automatique
- Fallback `memoryCache.js` si Redis absent

### Métriques de performance

| Métrique | Avant | Après optimisation | Gain |
|----------|-------|-------------------|------|
| Temps réponse API | 500ms–2s | 50–200ms | **8–20x** |
| Chargement initial | 5–8s | 1.5–2.5s | **3–4x** |
| Chargement récurrent | 2–3s | 0.3–0.5s | **5–10x** |
| Taille bundle | 800KB | 320KB | **-60%** |
| Réseau (gzip) | 200–400KB | 40–80KB | **-80%** |

### Optimisations frontend (Vite)

```javascript
// vite.config.js - Code splitting
manualChunks: {
  'react-core':    ['react', 'react-dom'],
  'react-router':  ['react-router-dom'],
  'network':       ['axios', 'socket.io-client'],
  'ui-icons':      ['lucide-react'],
  'markdown':      ['react-markdown'],
  'excel':         ['xlsx']
}

// Assets < 4KB inlinés directement
// Compression Gzip + Brotli en production
// Service Worker : offline + stale-while-revalidate
```

### Optimisations backend

- **Query Optimizer** : Prévention N+1, eager loading
- **Compression middleware** : Gzip/Brotli (seuil 1KB)
- **Cache utilisateur** : TTL 60s dans `ecomAuth.js`
- **Worker Pool** : Threads dédiées pour calculs lourds
- **Image optimizer** : Sharp pour redimensionnement/transcodage

---

## 12. Déploiement & Infrastructure

### Frontend — Netlify

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"

# SPA fallback
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Backend — Railway

```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "cd Backend && node server.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### Docker

```dockerfile
# Backend/Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```

### Architecture de domaines

```
scalor.net           → Frontend SPA (Netlify)
api.scalor.net       → Backend API (Railway)
{subdomain}.scalor.net → Boutique publique (résolu côté frontend)
```

---

## 13. Variables d'environnement

### Variables requises

| Variable | Service | Description |
|----------|---------|-------------|
| `MONGO_URI` / `MONGODB_URI` | MongoDB | URI de connexion MongoDB Atlas |
| `ECOM_JWT_SECRET` | Auth | Secret pour signer les JWT |
| `SESSION_SECRET` | Express | Secret session |

### Variables de services

| Variable | Service | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | OpenAI | Clé API OpenAI (GPT-5.2, gpt-image-1) |
| `GROQ_API_KEY` | Groq | Clé API Groq LLM |
| `RESEND_API_KEY` | Resend | Clé API email transactionnel |
| `EMAIL_FROM` | Resend | Adresse expéditeur |

### Variables WhatsApp

| Variable | Service | Description |
|----------|---------|-------------|
| `EVOLUTION_API_URL` | Evolution API | URL de l'instance Evolution |
| `EVOLUTION_ADMIN_TOKEN` | Evolution API | Token admin |
| `GREEN_API_ID_INSTANCE` | Green API | Instance ID |
| `GREEN_API_TOKEN_INSTANCE` | Green API | Token instance |

### Variables stockage

| Variable | Service | Description |
|----------|---------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare R2 | ID compte Cloudflare |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 | Clé d'accès |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 | Clé secrète |
| `R2_BUCKET_NAME` | Cloudflare R2 | Nom du bucket |
| `R2_ENDPOINT` | Cloudflare R2 | URL endpoint S3 |
| `R2_PUBLIC_URL` | Cloudflare R2 | URL publique des fichiers |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Images | ID compte |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Images | Token API |

### Variables paiement

| Variable | Service | Description |
|----------|---------|-------------|
| `MONETBIL_SERVICE_KEY` | Monetbil | Clé service |
| `MONETBIL_SERVICE_SECRET` | Monetbil | Secret service |
| `LYGOS_API_KEY` | Lygos | Clé API |
| `LYGOS_BASE_URL` | Lygos | URL base API |

### Variables auth externe

| Variable | Service | Description |
|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth | Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Client secret |
| `SHOPIFY_API_KEY` | Shopify | API Key |
| `SHOPIFY_API_SECRET` | Shopify | API Secret |
| `SHOPIFY_REDIRECT_URI` | Shopify | URI callback OAuth |

### Variables push

| Variable | Service | Description |
|----------|---------|-------------|
| `VAPID_PUBLIC_KEY` | Web Push | Clé publique VAPID |
| `VAPID_PRIVATE_KEY` | Web Push | Clé privée VAPID |
| `VAPID_SUBJECT` | Web Push | Contact VAPID (mailto:) |

### Variables frontend

| Variable | Service | Description |
|----------|---------|-------------|
| `VITE_BACKEND_URL` | Vite | URL backend pour dev (`http://localhost:8080`) |
| `FRONTEND_URL` | Express | URL frontend pour CORS |
| `BACKEND_URL` | Config | URL backend |

---

## 14. Workflows métier

### Cycle de vie d'une commande

```
                    ┌─────────────┐
                    │   SOURCES   │
                    ├─────────────┤
                    │ • Shopify   │
                    │ • Boutique  │
                    │ • G. Sheets │
                    │ • Webhook   │
                    │ • Manuel    │
                    │ • Rita (IA) │
                    └──────┬──────┘
                           ▼
                    ┌──────────────┐
                    │   pending    │ ← Statut initial
                    └──────┬───┬──┘
                           │   │
              ┌────────────┘   └────────────┐
              ▼                             ▼
      ┌──────────────┐             ┌──────────────┐
      │  confirmed   │             │  cancelled   │
      └──────┬───────┘             └──────────────┘
             ▼
      ┌──────────────┐
      │   shipped    │ ← readyForDelivery = true
      └──────┬───┬───┘
             │   │
    ┌────────┘   └────────┐
    ▼                     ▼
┌──────────┐      ┌──────────┐
│ delivered│      │  failed  │
└──────────┘      └──────────┘
```

### Système d'attribution livraison

```
1. Commande marquée "readyForDelivery"
2. Choix du mode d'offre :
   a. broadcast → Offre envoyée à TOUS les livreurs
   b. targeted  → Offre envoyée à UN livreur spécifique
3. deliveryOfferSentAt → timestamp, offre expire à deliveryOfferExpiresAt
4. Si ciblé et refusé → deliveryOfferRefusedBy[] → escalade broadcast
5. Livreur accepte → assignedLivreur renseigné
6. Livraison démarrée → GPS tracking (lat/lng départ)
7. Livraison terminée → GPS arrivée, distance calculée, coût FCFA
8. Statut final : 'delivered' ou 'failed' (+ nonDeliveryReason)
```

### Campagnes WhatsApp

```
1. Admin crée une campagne (type, filtres cibles)
2. Snapshot des destinataires (gelé à la création)
3. Types de campagnes :
   - Relance pending    (réengagement)
   - Relance cancelled  (win-back)
   - Promo ville/produit
   - Followup (post-livraison)
   - Custom
4. Ciblage : statut client, ville, produit, date, prix, sélection manuelle
5. Envoi progressif avec suivi (sendProgress)
6. Historique dans WhatsAppLog
```

### Agent IA (Rita)

```
1. Client envoie un message WhatsApp
2. Agent analyse l'intent :
   - greeting, confirmation, question, objection, complaint, etc.
3. Analyse du sentiment (positive, negative, neutral)
4. Score de confiance
5. Génération de réponse via OpenAI GPT-5.2
6. Si image reçue → analyse d'image pour recommandation produit
7. Logique de relance automatique
8. États : active, paused, completed, deactivated
```

### Boutique publique

```
1. Admin active la boutique dans StoreSetup
2. Choix du sous-domaine → {subdomain}.scalor.net
3. Configuration :
   - Thème (couleurs, polices, layout)
   - Pages/sections (hero, produits, témoignages, FAQ)
   - Paiement (providers configurés)
   - Zones de livraison (pays, villes, coûts)
   - Pixels tracking (GA, FB)
4. Produits publiés dans StoreProduct
5. Visiteur accède à la boutique
6. Commande → StoreOrder → Order (auto-sync)
7. Confirmation WhatsApp optionnelle
8. Live preview via Socket.io /store-live
```

---

## 15. Développement local

### Prérequis

- **Node.js** ≥ 22.11.0
- **npm** ≥ 10
- **MongoDB** (local ou Atlas)
- **Redis** (optionnel, recommandé)

### Installation

```bash
# Cloner le projet
git clone <repo-url> scalor
cd scalor

# Frontend
npm install

# Backend
cd Backend
npm install
```

### Configuration

Créer un fichier `.env` à la racine avec les variables nécessaires (voir section 13).

### Lancement

```bash
# Terminal 1 — Backend (port 8080)
cd Backend
npm run dev

# Terminal 2 — Frontend (port 5173)
npm run dev
```

Le proxy Vite redirige automatiquement :
- `/api/*` → `http://localhost:8080`
- `/socket.io/*` → `http://localhost:8080` (WebSocket)

### Scripts utilitaires

```bash
# Backend
node Backend/scripts/setupIndexes.js              # Créer les index MongoDB
node Backend/scripts/diagnose.js                   # Diagnostics performance
node Backend/scripts/migratePhoneNormalization.js  # Migration téléphones
node Backend/create-super-admin.js                 # Créer un super admin

# Frontend
npm run build     # Build production
npm run preview   # Preview build local
```

### Structure des URLs locales

| URL | Service |
|-----|---------|
| `http://localhost:5173` | Frontend React (Vite dev server) |
| `http://localhost:8080` | Backend API Express |
| `http://localhost:8080/health` | Health check |
| `http://localhost:5173/ecom/login` | Page de connexion |
| `http://localhost:5173/ecom/admin/dashboard` | Dashboard admin |

---

> **Document généré automatiquement** — SCALOR v1.0.0 — Mars 2026
