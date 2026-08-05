# SCALOR — Documentation Technique Complète

> **Version** : 2.0.0 | **Dernière mise à jour** : 5 août 2026 (remplace la v1.0.0 de mars 2026)
> **Stack** : React 18 + Vite 5 (SPA) & Next.js 15 (Cloudflare Workers) / Node.js 22 + Express 4 / MongoDB 8 / Redis
> **Déploiement** : VPS Contabo (PM2 + Caddy) · Cloudflare Workers (OpenNext) · RunPod Serverless (GPU)

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture globale](#2-architecture-globale)
3. [Écosystème & dépôts](#3-écosystème--dépôts)
4. [Stack technique](#4-stack-technique)
5. [Structure du projet](#5-structure-du-projet)
6. [Backend — Architecture détaillée](#6-backend--architecture-détaillée)
   - 6.1 [Server & Middleware](#61-server--middleware)
   - 6.2 [Routes API (~90 fichiers, 89 montages)](#62-routes-api)
   - 6.3 [Modèles MongoDB (98 modèles)](#63-modèles-mongodb-98-modèles)
   - 6.4 [Services métier (84 services)](#64-services-métier-84-services)
   - 6.5 [Middleware personnalisés (13)](#65-middleware-personnalisés)
   - 6.6 [Configuration](#66-configuration)
   - 6.7 [Tâches de fond (crons)](#67-tâches-de-fond-crons)
7. [Frontends — SPA React & scalor-next](#7-frontends--spa-react--scalor-next)
8. [Authentification & Sécurité](#8-authentification--sécurité)
9. [Base de données](#9-base-de-données)
10. [Temps réel — Socket.io](#10-temps-réel--socketio)
11. [Intégrations externes](#11-intégrations-externes)
12. [Cache & Performance](#12-cache--performance)
13. [Déploiement & Infrastructure](#13-déploiement--infrastructure)
14. [Variables d'environnement](#14-variables-denvironnement)
15. [Workflows métier](#15-workflows-métier)
16. [Développement local](#16-développement-local)

---

## 1. Vue d'ensemble

**SCALOR** (anciennement EcomCookpit) est une plateforme SaaS multi-tenant de gestion e-commerce conçue pour les marchés francophones africains (Cameroun, Côte d'Ivoire, Sénégal, etc.), centrée sur le modèle COD (paiement à la livraison) avec équipes de closeuses et livreurs.

Depuis la v1.0.0 (mars 2026), le produit s'est fortement étendu : le backend est passé de 51 à ~90 fichiers de routes, de 44 à 98 modèles et de 34 à 84 services ; l'infrastructure a quitté Netlify/Railway pour un VPS auto-géré + Cloudflare Workers ; et quatre nouveaux dépôts ont rejoint l'écosystème (frontend Next.js, app mobile Expo, liens courts, endpoints GPU RunPod).

### Fonctionnalités principales

| Domaine | Description |
|---------|-------------|
| **Gestion des commandes** | Réception multi-source (Shopify, Google Sheets, boutique, webhook, WhatsApp/Rita), statuts étendus (`pending, confirmed, called, shipped, delivered, postponed, unreachable, returned, cancelled` + statuts personnalisés), attribution aux livreurs (broadcast/ciblé) |
| **Gestion d'équipe** | Multi-rôles : Admin, Closeuses, Comptables, Livreurs, Service client, Super admin — permissions granulaires |
| **Contrôle financier** | Transactions, budgets, commissions, rentabilité |
| **Facturation SaaS** | Plans & essais (PlanConfig/PlanPayment), paiement MoneyFusion & KPay, cron de récupération de crédits |
| **Engagement client** | Automatisation WhatsApp (Evolution API / Green API), campagnes de masse, agent IA Rita (flows, relances, statuts WhatsApp, animation de groupes), campagnes email (SMTP Postfix auto-hébergé + Resend) |
| **Outils de vente** | Recherche produit IA, sourcing Alibaba (Scrape.do), stocks multi-emplacements, offres quantité, codes promo |
| **Boutique publique** | Vitrine multi-tenant `{subdomain}.scalor.net` (SSR/ISR via scalor-next) + domaines custom marchands (TLS à la demande via Caddy) |
| **Creative Center** | Génération IA de pages produit, images (gpt-image-1, Gemini/Nano Banana, KIE), vidéos (fal.ai, montage auto, traduction/doublage vidéo), lip-sync & avatars parlants self-host (RunPod MuseTalk / InfiniteTalk), système de crédits + sessions invité |
| **Affiliation & liens** | Programme d'affiliation (codes `SCL…`/`LNK…`/`AFF…`), raccourcisseur `scalor.net/s/{slug}` avec analytics de clics |
| **Analytics** | Rapports quotidiens, performance équipe, analytics boutique, PostHog |
| **API publique** | `/api/v1` (Scalor Public API), API WhatsApp SaaS (`/api/scalor/*`), API provider |
| **Support & tickets** | Tickets internes avec dispatch automatique vers Claude Code via GitHub Actions (`GITHUB_DISPATCH_*`) |
| **Mobile** | App Expo (admin / closeuse / livreur), push Expo + Web Push |

---

## 2. Architecture globale

```
                                   Cloudflare DNS (zone scalor.net)
                                              │
        ┌─────────────── proxifié (orange) ───┴──── DNS only (gris) ───────────────┐
        ▼                                                                          ▼
┌──────────────────────────────┐                          ┌───────────────────────────────────────────┐
│  Cloudflare Worker           │                          │  VPS Contabo (89.117.58.183)              │
│  « scalornext » (OpenNext)   │                          │                                           │
│  scalor.net, www.scalor.net, │   fetch api.scalor.net   │  ┌─────────────────────────────────────┐  │
│  *.scalor.net (boutiques)    │ ───────────────────────► │  │ Caddy (Docker, caddy-proxy)         │  │
│  ├─ middleware Host→/sites/… │                          │  │  api.scalor.net → backend prod      │  │
│  ├─ ISR boutiques (R2 cache) │                          │  │  api-staging.scalor.net → staging   │  │
│  └─ D1 « scalor-board »      │                          │  │  domaines custom → on-demand TLS    │  │
└──────────────────────────────┘                          │  │  labs.scalor.net → sclabs (systemd) │  │
        ▲                                                 │  └───────────────┬─────────────────────┘  │
        │ HTTPS                                           │                  ▼                        │
┌───────┴───────┐   HTTPS/WSS (api.scalor.net)            │  ┌─────────────────────────────────────┐  │
│ scalor-mobile │ ───────────────────────────────────────►│  │ Express 4 (PM2 « scalor-backend »)  │  │
│ (Expo RN)     │                                         │  │  Node 22 · port 8080                │  │
└───────────────┘                                         │  │  API REST (89 montages)             │  │
                                                          │  │  Socket.io (2 namespaces)           │  │
   Dashboard SPA React (Vite) ── servie par Express ──────│  │  SPA Vite buildée (dist/)           │  │
   (fallback storefront + legacy)                         │  │  Crons (12 tâches de fond)          │  │
                                                          │  └──────┬──────────────────────────────┘  │
                                                          └─────────┼─────────────────────────────────┘
                    ┌────────────────┬────────────────┬─────────────┼──────────────┬──────────────┐
                    ▼                ▼                ▼             ▼              ▼              ▼
              ┌──────────┐    ┌───────────┐    ┌───────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐
              │ MongoDB  │    │   Redis   │    │ Cloudflare│  │ RunPod   │  │ WhatsApp  │  │ LLMs     │
              │ Atlas    │    │  (cache)  │    │ R2 + Imgs │  │ MuseTalk │  │ Evolution │  │ OpenAI   │
              │ 98 mod.  │    │           │    │ (S3-like) │  │ Infinite │  │ Green API │  │ Groq/KIE │
              └──────────┘    └───────────┘    └───────────┘  │ Talk GPU │  └───────────┘  │ Gemini   │
                                                              └──────────┘                 │ DeepSeek │
              + Shopify (OAuth/webhooks) · Resend + Postfix (mail.scalor.net)              │ fal.ai   │
              + MoneyFusion / KPay · Meta CAPI · Telegram · Expo Push · PostHog            └──────────┘
```

Règle DNS importante : `scalor.net`, `www` et les sous-domaines boutiques sont **proxifiés** (nuage orange) vers le Worker `scalornext` ; `api`, `api-staging` et `mail` restent en **DNS only** (gris) pour atteindre directement le VPS.

---

## 3. Écosystème & dépôts

Le dossier de travail `~/scale` regroupe l'ensemble des codebases :

| Dépôt | Rôle | Stack | Déploiement |
|-------|------|-------|-------------|
| **ecomcookpit** | Cœur : API + SPA dashboard + storefront fallback | Express 4 / Node 22 · React 18 + Vite 5 | VPS (PM2 `scalor-backend`) via scripts SSH ; alternative Docker (ghcr.io/koumen222/ecomcookpit) |
| **ecomcookpit/caddy-proxy** | Entrée réseau du VPS : TLS wildcard + on-demand TLS domaines custom | Caddy 2 (Docker) | docker-compose sur le VPS |
| **scalor-next** | Frontend plateforme + boutiques SSR/ISR + kanban `/board` | Next.js 15 · React 19 · shadcn/Radix · i18next | Cloudflare Workers via `@opennextjs/cloudflare` (D1, R2) |
| **scalor-mobile** | App mobile terrain (admin/closeuse/livreur) | Expo SDK 57 · expo-router · TS strict | EAS Build (preview → api-staging, production → api) |
| **scalor-links** | Raccourcisseur `scalor.net/s/{slug}` + analytics clics | Patch backend (routes) + route handler Next | S'installe dans ecomcookpit & scalor-next (`install.sh`) |
| **sclabs** | App satellite `labs.scalor.net` (paiement MoneyFusion, KIE) | Next.js 16 · MongoDB direct | systemd `sclabs.service` sur le même VPS, derrière Caddy |
| **musetalk-runpod** | Lip-sync vidéo (MuseTalk v1.5) | Python handler serverless · RTX 4090 | RunPod Serverless + Network Volume + R2 |
| **infinitetalk-runpod** | Avatar parlant complet (Wan2.1-I2V-14B + InfiniteTalk) | Python handler serverless · GPU 48 GB | RunPod Serverless + Network Volume + R2 |
| **musetalk-src / infinitetalk-src** | Clones des repos officiels (référence de build) | — | Non déployés (source des images Docker) |

Scripts opérationnels à la racine de `~/scale` : `deploy-ecomcookpit-prod.sh`, `deploy-ecomcookpit-staging.sh` (SSH → git pull → build → pm2 restart), `deploy-infinitetalk-vps.sh` (build image GPU sur le VPS → Docker Hub), `diagnose-vps.sh`.

---

## 4. Stack technique

### Frontend SPA (ecomcookpit)

| Technologie | Version | Rôle |
|-------------|---------|------|
| **React** | 18.2 | Framework UI |
| **React Router** | 6.20 | Routing SPA |
| **Vite** | 5.4 | Build (HMR, code splitting, gzip/brotli) |
| **Tailwind CSS** | 3.4 | Styling |
| **@tanstack/react-query** | 5.x | Data fetching/cache |
| **Axios** | 1.13 | Client HTTP |
| **Socket.io-client** | 4.8 | Temps réel |
| **react-dnd / @dnd-kit** | — | Drag-and-drop (page builder) |
| **Quill / react-quill** | 2.x | Éditeur riche |
| **recharts** | 3.x | Graphiques |
| **papaparse / xlsx** | — | Import/export CSV & Excel |
| **PostHog** | — | Product analytics |
| **sharp / ffmpeg-static** | — | Outils médias (build/scripts) |

### Frontend scalor-next

| Technologie | Version | Rôle |
|-------------|---------|------|
| **Next.js** | 15.3 | App Router, SSR/ISR |
| **React** | 19 | UI |
| **@opennextjs/cloudflare** | 1.x | Build & runtime Workers |
| **wrangler** | 4.x | Déploiement Cloudflare |
| **shadcn/ui + Radix** | — | Composants |
| **i18next / react-i18next** | — | i18n (FR expédié) |
| **react-hook-form + zod** | — | Formulaires & validation |
| **D1 (`BOARD_DB`)** | — | Kanban IA `/board` |

### Backend

| Technologie | Version | Rôle |
|-------------|---------|------|
| **Node.js** | ≥22.11 | Runtime |
| **Express** | 4.18 | Framework HTTP |
| **Mongoose** | 8.8 | ODM MongoDB |
| **Socket.io** | 4.8 | WebSocket server |
| **jsonwebtoken / bcryptjs** | — | Auth JWT + hachage |
| **express-rate-limit** | 8.x | Rate limiting (login, OTP, API) |
| **OpenAI SDK** | 4.x | GPT-5.2, gpt-image-1 |
| **@google/generative-ai** | — | Gemini (Nano Banana, extraction produit) |
| **groq-sdk** | — | LLM Groq |
| **Resend** | 3.5 | Email transactionnel |
| **nodemailer** | — | SMTP Postfix auto-hébergé (marketing) |
| **web-push** | — | Push VAPID |
| **Sharp / gifenc / ffmpeg-static** | — | Traitement images & médias |
| **AWS SDK S3 (+presigner, lib-storage)** | 3.x | Cloudflare R2 |
| **node-cron** | — | Tâches planifiées |
| **geoip-lite** | — | Géolocalisation clics (liens courts) |
| **multer / multer-s3** | — | Uploads |
| **Helmet / compression / cors / cookie-parser** | — | HTTP hardening |

### Infrastructure

| Service | Rôle |
|---------|------|
| **VPS Contabo** (89.117.58.183) | Backend Express (PM2), Caddy, sclabs, builds Docker GPU |
| **Cloudflare Workers** | Frontend scalor-next (OpenNext) |
| **Cloudflare** | DNS, CDN, D1, R2, Images, domaines custom |
| **MongoDB Atlas** | Base de données principale |
| **Redis** | Cache (optionnel, fallback mémoire) |
| **Cloudflare R2** | Stockage objets (images, vidéos générées, fichiers) |
| **RunPod Serverless** | GPU à la demande (MuseTalk, InfiniteTalk) |
| **mail.scalor.net** | Postfix SMTP auto-hébergé (campagnes marketing) |
| **EAS (Expo)** | Builds mobiles Android/iOS |
| ~~Netlify / Railway~~ | **Abandonnés** (v1.0.0) — le nom de variable Caddy `RAILWAY_BACKEND` est un héritage |

---

## 5. Structure du projet

```
ecomcookpit/
│
├── Backend/                          # API Node.js/Express
│   ├── server.js                     # Point d'entrée (CORS, limiteurs, montage routes, crons)
│   ├── package.json                  # Dépendances backend
│   ├── Dockerfile                    # Image backend seule
│   │
│   ├── config/                       # 7 modules de configuration
│   │   ├── loadEnv.js               # Chargement .env (importé en premier)
│   │   ├── database.js              # Connexion MongoDB (pool, heartbeat 30s)
│   │   ├── r2.js                    # Cloudflare R2 (S3-compatible)
│   │   ├── redisOptimized.js        # Redis (cluster, pipeline, multi-get)
│   │   ├── queryOptimizer.js        # Prévention N+1
│   │   ├── push.js                  # VAPID web push
│   │   └── creativePricing.js       # Tarifs crédits Creative Center
│   │
│   ├── models/                       # 98 schémas Mongoose
│   ├── controllers/                  # Contrôleurs (Shopify, etc.)
│   ├── routes/                       # ~90 fichiers de routes (89 montages)
│   ├── services/                     # 84 services métier
│   ├── middleware/                   # 13 middleware personnalisés
│   ├── core/                         # Noyau (notifications/mailer, otpMailer…)
│   ├── scripts/                      # Migrations & utilitaires
│   ├── utils/                        # Helpers
│   ├── deploy/                       # Outils de déploiement
│   ├── uploads/                      # Fichiers statiques servis sur /uploads
│   └── docs/                         # Docs backend (HYBRID_MODE, MIGRATION_GUIDE…)
│
├── src/                              # Frontend React SPA (dashboard legacy + storefront)
│   ├── main.jsx
│   ├── ecom/                        # App, pages (100+), composants, contexts, hooks, services
│   ├── lib/api.js                   # Client Axios principal
│   └── styles/, utils/
│
├── caddy-proxy/                      # Reverse proxy du VPS
│   ├── Caddyfile                    # api, api-staging, wildcard, on-demand TLS
│   ├── docker-compose.yml
│   └── setup.sh
│
├── dist/                             # Build Vite (servi par Express / copié dans l'image)
├── public/                           # Assets statiques + Service Worker + manifest PWA
├── docs/                             # Documentation API
├── Dockerfile                        # Image multi-stage front+back (ghcr)
├── docker-compose.prod.yml           # Déploiement conteneurisé (alternative à PM2)
├── vite.config.js / tailwind.config.js / postcss.config.js
├── netlify.toml / nixpacks.toml      # ⚠️ Legacy (Netlify/Railway abandonnés)
└── package.json
```

> **Note** : `netlify.toml`, `nixpacks.toml` et les références Railway subsistent dans le dépôt mais ne correspondent plus au déploiement réel (voir §13).

---

## 6. Backend — Architecture détaillée

### 6.1 Server & Middleware

**Fichier** : `Backend/server.js`

Ordre réel de chargement des middleware (vérifié dans le code) :

```
 1. trust proxy = 1        → req.ip réelle derrière Caddy/Cloudflare (rate-limit fiable)
 2. CORS                   → whitelist + wildcards (*.scalor.net, *.scalor.app,
                             *.ecomcookpit.pages.dev, *.up.railway.app, localhost:*) ;
                             les domaines custom marchands sont acceptés au niveau CORS,
                             l'authentification fait foi ensuite
 3. securityHeaders        → middleware/security.js
 4. GET /api/version       → BUILD_VERSION (no-store) : le frontend détecte un nouveau
                             deploy et affiche la bannière « Recharger » (anti ChunkLoadError)
 5. Rate limiters dédiés   → /api/ecom/auth/login, /forgot-password, /send-otp (par IP)
 6. Rate limiter générique → /api/* — EXEMPTIONS webhooks : external/whatsapp/incoming,
                             /api/webhooks/shopify/*, /api/scalor/webhooks/*, tout chemin
                             */incoming, /api/ecom/auth/* (limiteur dédié) — jamais de 429
                             pour Evolution API / Shopify
 7. Logger                 → verbeux hors production (ENABLE_VERBOSE_LOGGING)
 8. Compression            → gzip niveau 6, seuil 1 KB — DÉSACTIVÉE pour les routes SSE
                             (alibaba-import, product-generator)
 9. Helmet                 → CSP off, COOP same-origin-allow-popups, CORP cross-origin
10. Cache headers          → assets statiques : 1 an immutable ; HTML : no-cache
                             (les pages produit doivent se rafraîchir immédiatement)
11. express.json 10 MB     → rawBody capturé pour vérification HMAC des webhooks
                             (/api/webhooks/*, /webhook/orders/*, /api/ecom/kpay/webhook)
12. urlencoded + cookies
13. extractSubdomain       → GLOBAL : req.subdomain, req.isApiDomain, req.isStoreDomain
14. Normalisation chemins  → /api/ecom/api/ecom/* → /api/ecom/* (bundles obsolètes)
15. UTF-8 forcé            → Content-Type JSON sur routes API (hors SSE)
16. Montage des routes     → 89 montages (table §6.2) puis /uploads statique
17. publicStorefront (/)   → fallback boutiques par sous-domaine — monté EN DERNIER
18. Error handler + 404    → ré-appliquent les headers CORS (réponses d'erreur incluses)
```

**Timeouts serveur** (requêtes IA longues) : `headersTimeout=0`, `requestTimeout=25 min`, `keepAliveTimeout=65 s`.

**Endpoints système** : `GET /health` (healthcheck PM2/Docker/Caddy), `GET /api/version`, `GET /debug-encoding`.

**Toggle** : `ENABLE_BACKGROUND_JOBS=false` désactive tous les crons (utile en staging).

### 6.2 Routes API

~90 fichiers dans `Backend/routes/`, **89 montages** déclarés dans `server.js` (table vérifiée) + le fallback storefront. `affiliate.js` est monté deux fois ; `dashboardProducts.js` existe mais n'apparaît pas dans la table de montage (sous-router ou orphelin — à vérifier).

#### Plateforme e-commerce (`/api/ecom/*`)

| Montage | Fichier | Domaine |
|---------|---------|---------|
| `/api/ecom/auth` | auth.js | Authentification (login, register, OTP, refresh, Google) |
| `/api/ecom/users` | users.js | Gestion utilisateurs |
| `/api/ecom/workspaces` | workspaces.js | Multi-tenant |
| `/api/ecom/products` | products.js | Catalogue interne |
| `/api/ecom/products-research` | productResearch.js | Recherche produit IA |
| `/api/ecom/orders` | orders.js | Commandes (fichier le plus gros : ~224 KB) |
| `/api/ecom/clients` | clients.js | CRM |
| `/api/ecom/stock` / `/stock-locations` | stock.js, stockLocations.js | Inventaire multi-emplacements |
| `/api/ecom/transactions` | transactions.js | Finance |
| `/api/ecom/goals` / `/reports` / `/decisions` | goals.js, reports.js, decisions.js | Pilotage |
| `/api/ecom/assignments` | assignments.js | Attributions closeuses/produits/villes |
| `/api/ecom/import` / `/auto-sync` | import.js, autoSync.js | Imports & Google Sheets |
| `/api/ecom/quantity-offers` | quantityOffers.js | Offres par quantité |
| `/api/ecom/collections` / `/media-library` | collections.js, mediaLibrary.js | Catalogue enrichi |
| `/api/ecom/promo-codes` | promoCodes.js | Codes promo (super admin) |
| `/api/ecom/sourcing` / `/sourcing/stats` | sourcing.js, sourcingStats.js | Fournisseurs |
| `/api/ecom/billing` | billing.js | Plans & paiements MoneyFusion |
| `/api/ecom/diagnostics` / `/test` | diagnostics.js, test.js | Outils |

#### Communication & marketing

| Montage | Fichier | Domaine |
|---------|---------|---------|
| `/api/ecom/campaigns` | campaigns.js | Campagnes WhatsApp |
| `/api/ecom/marketing` | marketing.js | Outils marketing + campagnes email |
| `/api/ecom/messages` / `/dm` | messages.js, dm.js | Messagerie d'équipe |
| `/api/ecom/notifications` / `/notification-preferences` | notifications.js, notificationPreferences.js | Notifications |
| `/api/ecom/push` | push.js | Web Push + Expo push (subscribe-expo) |
| `/api/ecom/support` / `/tickets` | support.js, tickets.js | Support + tickets (dispatch Claude Code) |
| `/api/ecom/contact` | contact.js | Formulaires |
| `/api/ecom/telegram` | telegram.js | Bot Telegram |
| `/api/ecom/analytics` | analytics.js | Tracking événements |

#### Agent IA Rita & WhatsApp

| Montage | Fichier | Domaine |
|---------|---------|---------|
| `/api/ecom/agent` / `/agent/commands` / `/agents` | agent.js, agentCommands.js, agents.js | Agent conversationnel |
| `/api/ecom/rita` | ritaConfig.js **et** ritaFollowUp.js | Config Rita + relances |
| `/api/ecom/v1/rita-flows` / `/v1/rita-status` | ritaFlows.js, ritaStatus.js | Flows & statuts WhatsApp |
| `/api/ecom/v1/external/whatsapp` | externalWhatsapp.js | Intégration WhatsApp externe (webhook Evolution — ~187 KB) |
| `/api/ecom/integrations/whatsapp` | whatsappConfig.js | Config instances |
| `/api/ecom/whatsapp-orders` | whatsappOrders.js | Commandes via WhatsApp |

#### Creative Center & IA générative

| Montage | Fichier | Domaine |
|---------|---------|---------|
| `/api/ai/product-generator` | productPageGenerator.js | Génération pages produit (SSE, ~192 KB) |
| `/api/ecom/ai/creative-generator` | creativeGenerator.js | Images/vidéos publicitaires |
| `/api/ecom/builder-ai` | builderAi.js | Builder AI chat (~225 KB) |
| `/api/ecom/video-translation` | videoTranslation.js | Traduction/doublage vidéo |
| `/api/ecom/auto-montage` | autoMontage.js | Montage vidéo automatique |
| `/api/ecom/alibaba-import` | alibabaImport.js | Scraping Alibaba (SSE) |
| `/api/ecom/guest` | guestSession.js | Essai Creative Center sans compte + claim |
| `/api/ecom/media-upload` / `/media` / `/upload` | mediaUpload.js, media.js, upload.js | Médias |

#### Boutiques & storefront

| Montage | Fichier | Domaine |
|---------|---------|---------|
| `/api/ecom/store-products` / `/store-orders` | storeProducts.js, storeOrders.js | Catalogue & commandes boutique |
| `/api/ecom/store-manage` / `/store` / `/stores` | storeManagement.js, storeAdmin.js, stores.js | Administration boutique |
| `/api/ecom/store-analytics` | storeAnalytics.js | Analytics boutique |
| `/api/store` | storeApi.js | **API boutique unifiée** (consommée par scalor-next : resolve-domain, ISR…) |
| `/api/public/store` | publicStore.js | API publique visiteurs |
| `/api/ecom/public` | publicLeaderboard.js | Classement « Top vendeurs » (landing, sans auth) |
| `/api/orders/skelor` | skolerOrders.js | Checkout `*.scalor.net` → table commandes principale |
| `/` (fallback, monté en dernier) | publicStorefront.js | Vitrine par sous-domaine + SPA fallback |

#### Paiements & affiliation

| Montage | Fichier | Domaine |
|---------|---------|---------|
| `/api/ecom/scalor-pay` | scalorPay.js | Wallet ScalorPay |
| `/api/ecom/kpay` | kpay.js | Paiement KPay (webhook HMAC) |
| `/api/ecom/affiliates` **et** `/api/affiliate` | affiliate.js | Affiliation (dashboard + tracking public `r/{code}`) |
| `/s` | shortLinks.js | Redirection liens courts (302, public) |
| `/api/ecom/links` | shortLinksAdmin.js | Gestion liens courts (+ UI `/api/ecom/links/ui`) |

#### Intégrations & webhooks

| Montage | Fichier | Domaine |
|---------|---------|---------|
| `/api/ecom/shopify` | shopify.js | OAuth Shopify |
| `/api/webhooks/shopify` | shopifyWebhooks.js | Webhook orders/create (HMAC) |
| `/webhook/orders` | orderWebhook.js | Webhook générique `/webhook/orders/:token` |
| `/api/ecom/webhooks` | webhooks.js | Webhooks internes |
| `/api/ecom/ecore` | ecore.js | Opérations e-commerce core |
| `/api/caddy` | caddyDomain.js | Validation on-demand TLS (`check-domain`, appelé par Caddy) |

#### Super admin & plateforme

| Montage | Fichier | Domaine |
|---------|---------|---------|
| `/api/ecom/super-admin` | superAdmin.js | Administration plateforme (~182 KB) |
| `/api/ecom/super-admin/mail-server` | mailServerAdmin.js | Gestion du serveur mail Postfix |
| `/api/ecom/super-admin/push` | superAdminPush.js | Push plateforme |
| `/api/provider` | provider.js | API provider (indépendante d'ecomAuth) |

#### Scalor SaaS WhatsApp API & API publique

| Montage | Fichier | Domaine |
|---------|---------|---------|
| `/api/scalor/auth` / `/instance` / `/message` / `/webhooks` / `/dashboard` | scalorAuth.js, scalorInstance.js, scalorMessage.js, scalorWebhook.js, scalorDashboard.js | Produit API WhatsApp (clés API, instances, envoi) |
| `/api/v1` | scalorPublicApi.js | API publique v1 client-facing |

### 6.3 Modèles MongoDB (98 modèles)

44 → **98 modèles** depuis la v1. Liste complète groupée par domaine (noms de fichiers dans `Backend/models/`) :

| Domaine | Modèles |
|---------|---------|
| **Commerce** | Order, Product, ProductConfig, ProductResearch, Client, OrderSource, ImportHistory, QuantityOffer, Collection, PromoCode, StockLocation, StockOrder, Supplier, SupplierOrder |
| **Boutique** | Store, StoreProduct, StoreOrder, StoreAnalytics, StoreAuditLog, StoreVisitorPresence |
| **Multi-tenant & users** | Workspace, WorkspaceSettings, EcomUser, CloseuseAssignment, PasswordResetToken, GuestSession |
| **Facturation & crédits** | PlanConfig, PlanPayment, PlatformPaymentConfig, GenerationPayment, GenerationPricingConfig, GenerationTask, CreativeAsset, CreativeCreditLedger, CreativePricingConfig, FeatureUsageLog, Subscription |
| **Paiement** | ScalorPayWallet, ScalorPayTransaction |
| **Rita / Agent IA** | Agent, AgentConversation, AgentMessage, RitaActivity, RitaConfig, RitaContact, RitaConversationMemory, RitaFlow, RitaFollowUpCampaign, RitaStatusSchedule |
| **WhatsApp** | WhatsAppInstance, WhatsAppLog, WhatsAppOrder, Channel |
| **Scalor API (SaaS WhatsApp)** | ScalorUser, ScalorInstance, ScalorApiKey, ScalorMessageLog, ScalorAgentAction |
| **Shopify** | ShopifyStore |
| **Affiliation** | AffiliateUser, AffiliateConfig, AffiliateLink, AffiliateClick, AffiliateVisit, AffiliateConversion, AffiliatePayout |
| **Liens courts** | ShortLink, ShortLinkClick |
| **Médias & IA générative** | GeneratedMedia, MontageJob, AutoMontageJob, VideoTranslationJob, ProductPageGenerationLog |
| **Notifications & push** | Notification, NotificationLog, UserNotificationPreferences, PushAutomation, PushScheduledNotification, PushTemplate, ExpoPushToken |
| **Email** | EmailCampaign, EmailCampaignRecipientLog, EmailSendLog, NewsletterSubscriber |
| **Messagerie interne** | Message, DirectMessage |
| **Pilotage** | DailyReport, Goal, Decision, Budget, Campaign, Transaction |
| **Analytics** | AnalyticsEvent, AnalyticsSession |
| **Support** | SupportConversation, Ticket |
| **Divers** | TelegramBot, Provider |

### 6.4 Services métier (84 services)

34 → **84 services** depuis la v1. Groupés par domaine :

| Domaine | Services |
|---------|----------|
| **Agent IA & Rita** | agentService (~47 KB), agentImageService, agentCronService, agentWhatsappService, ritaAgentService (~236 KB — le plus gros du backend), ritaFlowEngine, ritaFollowUpService, ritaStatusService, ritaBossReportService, ritaCronService, ritaGroupAnimatorService, ritaWebhookSyncService, scalorAgentActionService, scalorAgentBlockParser |
| **WhatsApp** | whatsappService, evolutionApiService, simpleWhatsappService, whatsappHostService, scalorEvolutionService, shopifyWhatsappService, messageLimitService |
| **IA générative — texte/LLM** | deepseekChatService, kieChatService, geminiProductExtractor, contentTranslationService |
| **IA générative — images** | openaiImageService, geminiImageService, kieImageService, nanoBananaService, imageOptimizer, cloudflareImagesService |
| **IA générative — vidéo/audio** | falVideoService, videoMontageService (~50 KB), autoEditService (~65 KB), videoTranslationService, lipSyncService (RunPod MuseTalk/InfiniteTalk), musicPresetsService, creativeFinalVideoService, ebookPdfService |
| **Crédits & facturation** | creativeCredits, generationCreditService, billingPricing, creditRecoveryCron, workspacePlanService, trialExpiryCronService, kpayService, scalorPayService |
| **Commandes & imports** | orderWebhookService, orderCacheService, orderLimitNotificationService, googleSheetsImport, googleSheetsPolling, autoSyncService, alibabaImportService, alibabaScraper, productCloneService, productPageGeneratorService (~193 KB), skolerOrderService, shopifyOrderService, storeSheetSync, catalogStockSync, stockService, promoCodeService |
| **Notifications & email** | notificationHelper, pushService (Web Push + Expo), expoPushService, pushSchedulerService, emailService, postponedReminderCron, reportGenerationService, reportSchedulerService, ticketDispatchService |
| **Affiliation & liens** | affiliateService |
| **Infra & divers** | socketService, memoryCache, workerPool, computeWorker, businessRules, calculations, authProvisioningService, googleAuthService, cloudflareCustomHostnames (Cloudflare for SaaS), metaCapi (Meta Conversions API), telegramService |

### 6.5 Middleware personnalisés

9 → **13 middleware** dans `Backend/middleware/` :

| Middleware | Fichier | Description |
|-----------|---------|-------------|
| **Auth JWT** | `ecomAuth.js` | Validation JWT, cache user 60 s, résolution workspace |
| **Guest Auth** | `guestAuth.js` | Sessions invité Creative Center (essai sans compte) |
| **Provider Auth** | `providerAuth.js` | Auth API provider (indépendante) |
| **Scalor Auth** | `scalorAuth.js` | Auth API WhatsApp SaaS (clés API) |
| **Store Auth** | `storeAuth.js` | Auth boutique publique |
| **Plan Limits** | `planLimits.js` | Quotas par plan (commandes, features) — 15 KB |
| **Workspace Resolver** | `workspaceResolver.js` | Résolution `X-Workspace-Id` |
| **Subdomain** | `subdomain.js` | `req.subdomain`, `req.isApiDomain`, `req.isStoreDomain` |
| **Security** | `security.js` | Headers + rate limiters (login, OTP, API) — 20 KB |
| **Validation** | `validation.js` | Validation body/params/query |
| **Compression** | `compressionMiddleware.js` | Gzip (seuil 1 KB, désactivé SSE) |
| **Cache Helper** | `cacheHelper.js` | Intégration cache Redis |
| **Request Logger** | `requestLogger.js` | Logging HTTP |

### 6.6 Configuration

| Module | Fichier | Détails |
|--------|---------|---------|
| **Env loader** | `config/loadEnv.js` | Chargement .env — premier import de server.js |
| **MongoDB** | `config/database.js` | Pooling, health checks, heartbeat 30 s |
| **Redis** | `config/redisOptimized.js` | Cluster, pipeline, multi-get/set, pool 10 |
| **R2** | `config/r2.js` | Client S3 pour Cloudflare R2 |
| **Query Optimizer** | `config/queryOptimizer.js` | Prévention N+1 |
| **Push** | `config/push.js` | VAPID |
| **Creative Pricing** | `config/creativePricing.js` | Tarification crédits IA |

### 6.7 Tâches de fond (crons)

Démarrées au boot si `ENABLE_BACKGROUND_JOBS ≠ false` (liste vérifiée dans server.js) :

| Tâche | Service | Fréquence / déclenchement |
|-------|---------|---------------------------|
| Agent cron jobs | agentCronService | planifié |
| Rappels commandes reportées | postponedReminderCron | planifié |
| Rapport boss Rita | ritaBossReportService | planifié |
| Génération auto des rapports quotidiens | reportSchedulerService | planifié |
| Relances Rita | ritaCronService | planifié |
| Statuts WhatsApp Rita | ritaStatusService | planifié |
| Expiration essais & plans (email + push) | trialExpiryCronService | planifié |
| **Récupération de crédits** | creditRecoveryCron | **toutes les 5 min** — garantit qu'aucun paiement validé ne reste sans crédits si webhook/polling échouent |
| Animateur de groupes WhatsApp | ritaGroupAnimatorService | tick toutes les 60 s |
| Sync webhooks Rita (reconnect + health) | ritaWebhookSyncService | démarrage +5 s, puis fond |
| Auto-sync Google Sheets | googleSheetsImport | planifié (le polling Sheets est désactivé, remplacé par webhooks) |
| Push planifiés + automations | pushSchedulerService | planifié |

---

## 7. Frontends — SPA React & scalor-next

Deux frontends coexistent pendant la migration SPA → Next :

| | **SPA React (ecomcookpit/src)** | **scalor-next** |
|---|---|---|
| Rôle actuel | Dashboard historique + fallback storefront servi par Express | Plateforme `scalor.net` + boutiques `*.scalor.net` en SSR/ISR + `/board` |
| Rendu | CSR (SPA) | SSR/ISR (revalidate 60 s pour les boutiques) |
| Hébergement | Buildée dans `dist/`, servie par le backend (PM2/Docker) ; ancien déploiement Cloudflare Pages (`ecomcookpit.pages.dev`) encore référencé par le Caddyfile pour `natureafrique.site` | Cloudflare Worker `scalornext` (routes `scalor.net/*`, `www`, `*.scalor.net/*`) |
| SEO boutiques | Faible (CSR) | Title/OG/sitemap/robots rendus serveur — Lighthouse SEO > 90 visé |

### 7.1 SPA React (inchangé dans ses grandes lignes)

- `src/main.jsx` → `src/ecom/App.jsx` : React Router v6, providers (`EcomAuthProvider`, `CurrencyProvider`, `ThemeProvider`)
- Protection : `ProtectedRoute` (JWT + rôle), `DashboardRedirect`, `RootRedirect`
- Espaces par rôle : `/ecom/admin/*`, `/ecom/closeuse/*`, `/ecom/compta/*`, `/ecom/livreur/*`, `/ecom/super-admin/*`, `/store/*` (public)
- 100+ pages, 50+ composants (PageBuilder/VisualSiteBuilder, modales Alibaba/ProductPageGenerator, storefront…)
- Services frontend : `ecommApi.js` (Axios + intercepteurs JWT/workspaceId/retry), `publicApi.js`, `storeApi.js`, `marketingApi.js`, `posthog.js`, `soundService.js`, etc.

### 7.2 scalor-next (nouveau)

- **App Router** Next 15 ; UI shadcn/Radix ; i18next (FR expédié) ; React Query ; socket.io-client vers `api.scalor.net` (inchangé)
- **`middleware.ts` multi-tenant** (réplique serveur de `useSubdomain.js`) :
  - `scalor.net`, `www`, `localhost`, `*.workers.dev`… → plateforme (pas de rewrite)
  - `koumen.scalor.net/…` → rewrite interne `/sites/koumen/…`
  - Domaine custom → résolution `GET /api/store/resolve-domain/{hostname}` (cache 10 min) → `/sites/{sub}/…`
  - Sous-domaines ignorés : `www`, `api`, `staging`, `api-staging`
  - Codes affiliés `scalor.net/SCL…|LNK…|AFF…` → redirect 307 vers `api.scalor.net/api/affiliate/r/{code}` (query préservée)
  - `/sites` inaccessible en direct (404)
- **Scalor Board** : kanban IA sur `/board`, base **D1** `scalor-board` (binding `BOARD_DB`, migrations dans `migrations/board/`)
- **Cache ISR durable** : bucket R2 `scalor-next-cache` (binding `NEXT_INC_CACHE_R2_BUCKET`) — sans lui, chaque miss ISR retombe en SSR
- **Liens courts** : `app/s/[slug]/route.ts` relaie vers l'API et renvoie le 302

### 7.3 scalor-mobile (nouveau)

- Expo SDK 57, expo-router, TypeScript strict — consomme la **même API** (`/api/ecom`), mêmes contrats que le web (enveloppe `{success, data}`, injection `workspaceId`, statuts)
- Espaces par rôle : `(admin)` dashboard/commandes/produits/stats, `(closeuse)` file de confirmation priorisée + commissions, `(livreur)` offres avec compte à rebours (poll 10 s), courses, revenus
- Auth : SecureStore(token) + AsyncStorage(user/workspace), refresh 401 single-flight, retry cold-start
- Push : socket en foreground ; **push distant Expo** app fermée (`ExpoPushToken`, `expoPushService`, `POST /push/subscribe-expo`) — sons portés par les canaux Android / payload iOS
- Builds EAS : `preview` → api-staging, `production` → api.scalor.net

---

## 8. Authentification & Sécurité

### 8.1 Système JWT

**Format** : `Authorization: Bearer [prefix:]<jwt>` — préfixes `ecom:` (standard), `perm:` (permanent 365 j), ou JWT brut.

**Payload** : `{ id, email, role, workspaceId, deviceId, type }`.

**Flux** :
```
1. Extraction token → suppression préfixe
2. Vérification signature (ECOM_JWT_SECRET)
3. User depuis cache (TTL 60 s) ou MongoDB
4. Validation workspace via X-Workspace-Id / body
5. Injection req.user, req.ecomUser, req.workspaceId, req.ecomUserRole
```

**Middlewares** : `requireEcomAuth`, `requireEcomRole(role)`, `requireEcomPermission(permission)` + les auth spécialisées : `guestAuth` (sessions invité Creative Center), `providerAuth`, `scalorAuth` (clés API SaaS WhatsApp), `storeAuth` (boutique), `planLimits` (quotas par plan).

### 8.2 Rôles & permissions

| Rôle | Code | Accès |
|------|------|-------|
| **Super Admin** | `super_admin` | Plateforme entière (équipe Scalor) |
| **Admin** | `ecom_admin` | Tout son workspace |
| **Closeuse** | `ecom_closeuse` | Produits assignés, file de confirmation, commandes propres |
| **Comptable** | `ecom_compta` | Transactions, budgets, rapports financiers |
| **Livreur** | `ecom_livreur` | Livraisons assignées, GPS, gains |
| **Service client** | `service_client` | Dashboard/commandes (lecture-action support) — ajouté depuis la v1 |

Multi-workspace : un utilisateur porte un tableau `workspaces[{workspaceId, role, status}]` et peut changer de workspace (header `X-Workspace-Id`).

### 8.3 Mesures de sécurité

| Mesure | Implémentation |
|--------|----------------|
| Hachage mots de passe | bcryptjs (12 rounds) |
| Headers HTTP | Helmet + `middleware/security.js` (COOP `same-origin-allow-popups` pour Google OAuth popup) |
| CORS | Whitelist + wildcards ; domaines custom laissés passer au CORS, **l'auth fait foi** |
| **Rate limiting** | express-rate-limit : limiteurs dédiés login / forgot-password / OTP (IP) + limiteur générique `/api/*` avec exemptions webhooks |
| Webhooks | Vérification HMAC (Shopify, KPay, webhook générique) sur `req.rawBody` |
| Multi-tenant | `workspaceId` vérifié sur chaque requête |
| On-demand TLS | Caddy `ask` → `/api/caddy/check-domain?token=…` (token partagé `CADDY_AUTH_TOKEN`) : seuls les domaines validés en base obtiennent un certificat |
| Secrets | Variables d'environnement uniquement (`.env` jamais commité) |
| Liens courts | IP jamais stockée en clair (hash salé tronqué `SHORTLINK_IP_SALT`) |

---

## 9. Base de données

### 9.1 Multi-tenancy

Inchangé depuis la v1 : isolation par `workspaceId` présent sur toutes les collections métier, injecté par `workspaceResolver` (header `X-Workspace-Id` → workspace principal → body).

```javascript
Order.find({ workspaceId: req.workspaceId, status: 'pending' })
```

### 9.2 Schémas principaux

Les schémas détaillés `Order`, `Product`, `EcomUser`, `Workspace` documentés en v1 restent structurellement valides (statuts de commande étendus, cf. §15). S'y ajoutent notamment :

- **Billing** : `PlanConfig` (définition des plans), `PlanPayment` / `GenerationPayment` (paiements MoneyFusion/KPay), `CreativeCreditLedger` (livre de crédits IA), `FeatureUsageLog`
- **Boutique** : `Store` (extraction progressive de la config boutique hors de `Workspace`), `StoreVisitorPresence` (visiteurs temps réel), `StoreAuditLog`
- **Affiliation** : `AffiliateUser` → `AffiliateLink` → `AffiliateClick`/`AffiliateVisit` → `AffiliateConversion` → `AffiliatePayout`
- **Liens courts** : `ShortLink` (slug base58 6 car.), `ShortLinkClick` (jour, pays geoip, appareil, source, ipHash, bots de preview à part)
- **Rita** : `RitaFlow` (flows conversationnels), `RitaFollowUpCampaign`, `RitaStatusSchedule`, `RitaConversationMemory`, `RitaContact`
- **Jobs IA** : `GenerationTask`, `MontageJob`, `AutoMontageJob`, `VideoTranslationJob`, `GeneratedMedia`

### 9.3 Stratégie d'indexation

Inchangée dans son principe (v1 §8.3) : index composites `{workspaceId, status, date}`, `{workspaceId, city|product|tags, status}`, `{workspaceId, updatedAt}`, recherche full-text pondérée sur Order ; index sparse uniques sur `Workspace.subdomain` et tokens webhook.

---

## 10. Temps réel — Socket.io

Initialisé par `services/socketService.js` sur le serveur HTTP partagé (`initSocketServer(server)`).

### Namespace principal (`/`) — authentifié JWT

**Rooms** : `user:{userId}`, `workspace:{workspaceId}`, `conversation:{convKey}`.

| Direction | Événements |
|-----------|-----------|
| Client → serveur | `conversation:join/leave`, `typing:start/stop`, `message:read` |
| Serveur → client | `typing:start/stop`, `message:status`, `message:new`, `notification:new` |

`notification:new` est consommé par le web **et** par l'app mobile (bannière locale + sons : ka-ching nouvelle commande, alarme en boucle côté livreur).

**Helpers** : `isUserOnline(userId)`, `getOnlineUsersInWorkspace(workspaceId)`, `emitNewMessage(message, recipientId)`.

### Namespace `/store-live` — public

Mise à jour temps réel du thème boutique : `store:join {subdomain}`, `theme:broadcast {subdomain, theme, token}` (admin), `theme:update` (diffusion visiteurs). Sert aussi la présence visiteurs (`StoreVisitorPresence`).

**Transports** : websocket prioritaire, fallback polling ; pingTimeout 120 s ; compression per-message > 1 KB.

---

## 11. Intégrations externes

### WhatsApp

| Provider | Service | Rôle |
|----------|---------|------|
| **Evolution API** | `evolutionApiService.js`, `scalorEvolutionService.js` | Provider principal multi-instances ; webhook entrant `/api/ecom/v1/external/whatsapp/incoming` (exempt de rate-limit) |
| **Green API** | `whatsappService.js` | Provider alternatif (`GREEN_API_*`) |
| **Simple** | `simpleWhatsappService.js` | Provider simplifié |

Multi-instance par workspace, logs (`WhatsAppLog`), campagnes de masse filtrées, auto-confirmation Shopify, limites d'envoi (`messageLimitService`), produit API SaaS revendu via `/api/scalor/*` (instances, clés API, envoi de messages).

### Intelligence artificielle

| Usage | Provider / modèle | Service |
|-------|-------------------|---------|
| Agent Rita & chat | **KIE** (`api.kie.ai`, GPT-5.2, prioritaire), OpenAI, DeepSeek, Groq | `kieChatService`, `agentService`, `deepseekChatService` |
| Pages produit (SSE) | OpenAI GPT-5.2 | `productPageGeneratorService` |
| Images | gpt-image-1, **Gemini Nano Banana Pro** (`gemini-3-pro-image-preview`, fallback), KIE | `openaiImageService`, `geminiImageService`, `nanoBananaService`, `kieImageService` |
| Vidéos publicitaires | **fal.ai** | `falVideoService` |
| Montage / auto-edit | ffmpeg + presets musique | `videoMontageService`, `autoEditService`, `musicPresetsService` |
| Traduction / doublage vidéo | pipeline dédié | `videoTranslationService` |
| **Lip-sync** | RunPod Serverless **MuseTalk v1.5** (RTX 4090, ~0,02–0,04 $/vidéo) | `lipSyncService` |
| **Avatar parlant** | RunPod Serverless **InfiniteTalk + Wan2.1-I2V-14B** (GPU 48 GB) | `lipSyncService` (2ᵉ endpoint) |
| Extraction produit | Gemini | `geminiProductExtractor` |
| Scraping Alibaba | Scrape.do | `alibabaScraper`, `alibabaImportService` |

Les deux endpoints RunPod partagent la même mécanique : poids sur Network Volume, entrée `{image/video_url, audio_url}`, sortie mp4 uploadé sur **R2** `{ video_url, r2_key, duration_s, inference_time_s }`, débit de crédits avant soumission + refund automatique sur échec.

### Paiements

| Provider | Usage |
|----------|-------|
| **MoneyFusion** | Upgrade de plans & achats de crédits (`/api/ecom/billing`, cron de récupération de crédits toutes les 5 min) |
| **KPay** | Paiements (`/api/ecom/kpay`, webhook HMAC sur rawBody) |
| **ScalorPay** | Wallet interne (`ScalorPayWallet`/`ScalorPayTransaction`) |
| Wave / OM / providers boutique | Via `storePayments` du Workspace |
| Monetbil / Lygos | Héritage v1 — présents en config |

### Email

| Canal | Provider | Détails |
|-------|----------|---------|
| **Marketing** (campagnes) | **Postfix auto-hébergé** `mail.scalor.net:587` | TOUJOURS via SMTP quel que soit `EMAIL_PROVIDER` ; espacement min 3 s entre envois ; administrable via `/api/ecom/super-admin/mail-server` |
| **Transactionnel** (OTP, reset, notifications) | **Resend** (`EMAIL_PROVIDER=resend`) | `core/notifications/mailer.js` + canal OTP dédié `otpMailer.js` ; fallback SMTP si clé absente ; ~2 req/s max |

### Autres

| Service | Usage |
|---------|-------|
| **Shopify** | OAuth + webhook `orders/create` (HMAC `SHOPIFY_WEBHOOK_SECRET`), sync commandes, auto-confirmation WhatsApp |
| **Google Sheets** | Import + auto-sync (webhooks temps réel, polling désactivé) |
| **Cloudflare** | R2 (stockage), Images (CDN), Custom Hostnames / for SaaS (`cloudflareCustomHostnames`), D1 (board), Workers |
| **Meta CAPI** | Conversions API (`metaCapi.js`) |
| **Telegram** | Bot de messagerie (`TelegramBot`, `telegramService`) |
| **Expo Push** | Push mobile app fermée (`https://exp.host`, zéro dépendance) |
| **GitHub Actions** | Dispatch des tickets vers Claude Code (`GITHUB_DISPATCH_TOKEN/REPO`, PR base `dev`, callback `TICKET_CALLBACK_SECRET`) |
| **PostHog** | Product analytics (web + next) |
| **geoip-lite** | Pays des clics liens courts |

---

## 12. Cache & Performance

### Redis (optionnel, recommandé)

`config/redisOptimized.js` : pool 10 connexions, support cluster, pipeline, multi-get/multi-set, TTL configurable, fallback `memoryCache.js` si absent. Cache utilisateur JWT 60 s dans `ecomAuth.js` ; cache commandes (`orderCacheService`).

### Optimisations frontend (Vite)

Code splitting par chunks (`react-core`, `network`, `ui-icons`, `markdown`, `excel`), assets < 4 KB inlinés, gzip + brotli (`vite-plugin-compression`), Service Worker PWA. Côté scalor-next : ISR 60 s + cache R2 durable, rendu edge Workers.

### Optimisations backend

Query Optimizer (anti N+1), compression gzip seuil 1 KB (hors SSE), worker pool (`workerPool.js`, `computeWorker.js`) pour calculs lourds, Sharp pour images, timeouts longs dédiés aux générations IA (25 min), exemptions rate-limit pour webhooks à fort débit.

### Métriques de référence (campagne d'optimisation v1 — toujours d'actualité comme baseline)

| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| Temps réponse API | 500 ms–2 s | 50–200 ms | 8–20× |
| Chargement initial | 5–8 s | 1,5–2,5 s | 3–4× |
| Bundle | 800 KB | 320 KB | −60 % |

---

## 13. Déploiement & Infrastructure

> ⚠️ **Changement majeur vs v1.0.0** : Netlify (frontend) et Railway (backend) sont **abandonnés**. La production tourne sur un VPS Contabo auto-géré + Cloudflare Workers. Les fichiers `netlify.toml`, `nixpacks.toml` et les URLs `*.up.railway.app` encore présents dans le dépôt sont des vestiges (la variable Caddy `RAILWAY_BACKEND` a conservé son nom mais pointe vers le backend actuel).

### 13.1 Vue d'ensemble

| Composant | Où | Comment |
|-----------|----|---------|
| Backend Express (prod) | VPS Contabo `89.117.58.183` | PM2, process **`scalor-backend`**, port 8080 |
| Backend staging | même VPS | branche staging dédiée, exposé via `api-staging.scalor.net` (`$STAGING_BACKEND` dans Caddy) |
| Reverse proxy | même VPS | **Caddy 2 en Docker** (`ecomcookpit/caddy-proxy`) |
| Frontend plateforme + boutiques | Cloudflare Workers | Worker **`scalornext`** (OpenNext) ; staging : Worker `scalornext-staging` sur `staging.scalor.net` |
| SPA legacy | servie par Express (`dist/`) | + ancien déploiement Pages `ecomcookpit.pages.dev` (encore cible de `natureafrique.site`) |
| sclabs | même VPS | systemd `sclabs.service`, `/var/www/sclabs/current`, env `/etc/sclabs/sclabs.env` |
| GPU IA | RunPod Serverless | 2 endpoints (MuseTalk, InfiniteTalk) + Network Volumes |
| Mail | `mail.scalor.net` | Postfix (marketing) |
| Mobile | EAS | APK/IPA preview & production |

### 13.2 Déploiement backend — voie active (PM2 + SSH)

Scripts lancés **depuis le Mac** (`~/scale/deploy-ecomcookpit-{prod,staging}.sh`) :

```
ssh root@89.117.58.183
  → localise le repo via pm2 jlist (cwd du process scalor-backend)
  → git fetch/checkout/pull --ff-only origin <branche>   (token GitHub lu localement,
    transmis via SSH, jamais écrit sur le VPS)
  → npm ci && npm run build          # build Vite (frontend SPA)
  → npm ci --prefix Backend          # deps backend
  → pm2 restart scalor-backend --update-env && pm2 save
```

- Prod : branche passée en argument (défaut dans le script) ; vérification : `curl https://api.scalor.net/health`
- Staging : branche `staging-backend-*` ; vérification : `curl https://api-staging.scalor.net/health`
- Cette voie a été choisie explicitement contre GitHub Actions/GHCR (insensible aux blocages de facturation GitHub)

### 13.3 Déploiement backend — voie conteneurisée (alternative)

- `Dockerfile` multi-stage racine : build Vite (stage frontend, args `VITE_*`) → runtime Node 22-alpine dans `/app/Backend`, SPA copiée dans `Backend/client/build`, healthcheck `/health`
- `docker-compose.prod.yml` : image `ghcr.io/koumen222/ecomcookpit:latest`, port 8080, volume nommé `ecomcookpit_uploads` monté sur `/app/Backend/uploads`, logs json-file 20 M×5, `pull_policy: always`

### 13.4 Caddy (caddy-proxy)

```
api.scalor.net            → reverse_proxy {$RAILWAY_BACKEND}   # backend prod
api-staging.scalor.net    → reverse_proxy {$STAGING_BACKEND}   # backend staging
*.scalor.net              → certs wildcard fichiers (fullchain.cer + key)
natureafrique.site        → proxy vers ecomcookpit.pages.dev   # legacy Pages
rehoboth-market.scalor.net→ redirect 308 vers radia.scalor.net
https:// (tout le reste)  → on_demand TLS + proxy backend      # domaines custom marchands
```

- **On-demand TLS** : `ask {$CADDY_ASK_URL}?token={$CADDY_AUTH_TOKEN}` → `GET /api/caddy/check-domain` (route `caddyDomain.js`) — Caddy n'émet un certificat que si le domaine est enregistré dans un workspace
- Headers COOP/COEP relâchés (`same-origin-allow-popups`) pour le popup Google OAuth
- Env : `RAILWAY_BACKEND`, `STAGING_BACKEND`, `CADDY_ASK_URL`, `CADDY_AUTH_TOKEN`, `CF_API_TOKEN` (DNS), `ACME_EMAIL`

### 13.5 Frontend scalor-next (Cloudflare Workers)

```bash
npm run deploy            # build:production + opennextjs-cloudflare deploy
npm run deploy:staging    # Worker scalornext-staging (--keep-vars), staging.scalor.net
```

- Routes Worker : `scalor.net/*`, `www.scalor.net/*`, `*.scalor.net/*` (zone scalor.net) — **uniquement les enregistrements DNS proxifiés** ; `api`, `api-staging`, `mail` restent DNS-only vers le VPS
- Bindings : assets `.open-next/assets`, D1 `BOARD_DB` (scalor-board), R2 ISR `scalor-next-cache` (à activer), `WORKER_SELF_REFERENCE`
- Variables `NEXT_PUBLIC_*` injectées au build (`build:production` / `build:staging`)
- Interdits en build déployé : `NEXT_SKIP_TYPECHECK`, `NEXT_SKIP_TRACING`, `NEXT_SKIP_MINIFY`, `NEXT_USE_WASM_SWC`

### 13.6 Endpoints GPU RunPod

| | MuseTalk (lip-sync) | InfiniteTalk (avatar parlant) |
|---|---|---|
| Image | `morgan222/musetalk-runpod` (build via `build.sh` + `musetalk-src`) | `morgan222/infinitetalk-runpod` (build sur le VPS via `deploy-infinitetalk-vps.sh`) |
| GPU | RTX 4090 24 GB | 48 GB PRO (24 GB possible en `INFINITETALK_LOW_VRAM`) |
| Volume | ~25 GB (poids MuseTalk v1.5, whisper, dwpose…) | ≥120 GB (Wan2.1-I2V-14B + wav2vec + InfiniteTalk) |
| Workers | min 0 / max selon charge, idle 60–120 s | min 0 / max 2, idle 90 s, FlashBoot, timeout 3600 s |
| Entrée | `{video_url, audio_url}` | `{image_url, audio_url, size 480/720, sample_steps, seed}` |
| Sortie | mp4 → R2 `{video_url, r2_key, duration_s, inference_time_s}` | idem |
| Env | `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_BASE_URL` | idem + `INFINITETALK_STEPS` |
| Côté backend | `RUNPOD_API_KEY` + endpoint ID ; débit crédits avant soumission, refund auto sur FAILED/CANCELLED/TIMED_OUT | `RUNPOD_INFINITETALK_ENDPOINT_ID` |

### 13.7 Architecture de domaines

```
scalor.net, www           → Worker scalornext (plateforme, landing, dashboard Next)
{subdomain}.scalor.net    → Worker scalornext (boutique SSR/ISR via /sites/{sub})
api.scalor.net            → VPS Caddy → Express prod (API + SPA legacy + storefront fallback)
api-staging.scalor.net    → VPS Caddy → Express staging
staging.scalor.net        → Worker scalornext-staging
labs.scalor.net           → VPS Caddy → sclabs (systemd :3000)
mail.scalor.net           → Postfix (SMTP marketing)
domaine-custom.com        → VPS Caddy (on-demand TLS) → backend → storefront
scalor.net/s/{slug}       → Worker (route handler) → API /s/{slug} → 302
scalor.net/SCL{code}      → Worker (middleware) → 307 api.scalor.net/api/affiliate/r/{code}
```

---

## 14. Variables d'environnement

Référence : `Backend/.env.example` (état réel août 2026).

### Cœur

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas |
| `ECOM_JWT_SECRET` | Signature JWT |
| `PORT` (8080), `NODE_ENV`, `APP_ENV` | Serveur |
| `CORS_ORIGINS` | Origines additionnelles (séparées par virgules) |
| `ENABLE_BACKGROUND_JOBS` | `false` = désactive les crons (staging) |
| `ENABLE_VERBOSE_LOGGING`, `DEBUG_CORS` | Debug |
| `BUILD_VERSION` / `GIT_COMMIT` | Détection de nouveau deploy (`/api/version`) |

### Stockage & images

| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `R2_CDN_URL` | Cloudflare R2 |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Cloudflare Images |

### IA

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | GPT-5.2, gpt-image-1 |
| `KIE_API_KEY`, `KIE_BASE_URL` (api.kie.ai), `KIE_MODEL_PATH` (/gpt-5-2/v1/chat/completions), `KIE_REASONING_EFFORT`, `KIE_TIMEOUT_MS` | Provider prioritaire chat Rita |
| `GEMINI_API_KEY` (prioritaire) / `NANOBANANA_API_KEY` (alias legacy), `GEMINI_IMAGE_MODEL` | Images Gemini / Nano Banana Pro |
| `GROQ_API_KEY` | Groq LLM |
| `SCRAPE_DO_TOKEN` | Scraping Alibaba |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` (MuseTalk), `RUNPOD_INFINITETALK_ENDPOINT_ID` | GPU serverless |

### Email

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` (mail.scalor.net), `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASS`, `SMTP_MIN_SEND_GAP_MS` (3000) | Postfix marketing |
| `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `ADMIN_EMAIL` | Identité expéditeur |
| `EMAIL_PROVIDER` (resend), `RESEND_API_KEY`, `RESEND_MIN_SEND_GAP_MS` (600) | Transactionnel |
| `OTP_EMAIL_PROVIDER`, `OTP_EMAIL_FROM`, `OTP_REPLY_TO` | Canal OTP dédié |

### WhatsApp & messaging

| Variable | Description |
|----------|-------------|
| `EVOLUTION_API_URL`, `EVOLUTION_ADMIN_TOKEN` | Evolution API |
| `GREEN_API_ID_INSTANCE`, `GREEN_API_TOKEN_INSTANCE` | Green API |

### Auth & intégrations

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_IDS` (liste) | Google OAuth (web prod/staging/local) |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_REDIRECT_URI`, `SHOPIFY_WEBHOOK_SECRET` | Shopify |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push (Base64URL sans padding) |

### Tickets → Claude Code

| Variable | Description |
|----------|-------------|
| `GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_REPO` (koumen222/ecomcookpit) | Dispatch GitHub Actions |
| `PUBLIC_BACKEND_URL`, `TICKET_CALLBACK_SECRET`, `TICKET_PR_BASE` (dev) | Callback & PR |

### Liens courts

| Variable | Description |
|----------|-------------|
| `SHORTLINK_BASE_URL` (https://scalor.net/s), `SHORTLINK_FALLBACK_URL`, `SHORTLINK_IP_SALT` | Défauts corrects |

### Frontends

| Variable | Description |
|----------|-------------|
| `VITE_API_URL`, `VITE_BACKEND_URL`, `VITE_STORE_API_URL`, `VITE_SCALOR_API_URL`, `VITE_SOCKET_URL`, `VITE_APP_ENV`, `VITE_GOOGLE_CLIENT_ID`, `VITE_POSTHOG_*` | SPA (build args Docker / .env) |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_STORE_API_URL`, `NEXT_PUBLIC_SCALOR_API_URL`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_POSTHOG_*`, `NEXT_PUBLIC_BUILD_VERSION` | scalor-next (build-time) |
| `EXPO_PUBLIC_API_URL` | scalor-mobile (défaut selon profil EAS) |

---

## 15. Workflows métier

### Cycle de vie d'une commande (statuts étendus)

```
SOURCES : Shopify · Boutique · Google Sheets · Webhook · Manuel · Rita (WhatsApp)
   │
   ▼
pending ──► called ──► confirmed ──► shipped ──► delivered
   │           │           │            │
   │           ▼           │            ├──► returned
   │       postponed       │            └──► failed (+ nonDeliveryReason)
   │           │           │
   ├──► unreachable        │
   └──► cancelled ◄────────┘
(+ statuts personnalisés par workspace, tolérés par l'API)
```

### Attribution livraison

Inchangé v1 : `readyForDelivery` → offre `broadcast` ou `targeted` (expiration, escalade broadcast si refus) → acceptation → GPS départ/arrivée, distance, coût FCFA → `delivered`/`failed`. Côté mobile : compte à rebours sur l'offre, poll 10 s, alarme sonore en boucle tant qu'une course attend.

### Campagnes WhatsApp

Inchangé v1 : snapshot des destinataires à la création, types (relance pending/cancelled, promo, follow-up, custom), ciblage (statut, ville, produit, date, prix), envoi progressif (`sendProgress`), historique `WhatsAppLog`.

### Agent IA Rita (étendu)

```
Message client WhatsApp (webhook Evolution → /v1/external/whatsapp/incoming)
→ analyse intent + sentiment (KIE GPT-5.2 prioritaire, fallback OpenAI/DeepSeek)
→ mémoire de conversation (RitaConversationMemory) + flows (RitaFlow / ritaFlowEngine)
→ réponse (texte, image analysée si reçue) · actions structurées (scalorAgentActionService)
→ relances automatiques (ritaFollowUpService, ritaCronService)
→ statuts WhatsApp programmés (ritaStatusService) · animation de groupes (60 s)
→ rapport quotidien au boss (ritaBossReportService)
```

### Crédits IA & facturation

```
Achat (MoneyFusion/KPay) → PlanPayment/GenerationPayment → crédits (CreativeCreditLedger)
Génération (image/vidéo/lip-sync) → débit AVANT soumission → job (GenerationTask/MontageJob…)
Échec (FAILED/CANCELLED/TIMED_OUT) → refund automatique
Filet de sécurité : creditRecoveryCron (5 min) ré-applique tout paiement validé non crédité
Essai sans compte : guestSession → claim à l'inscription
```

### Liens courts & affiliation

```
scalor.net/s/{slug} → Worker → API /s/{slug} → 302 (query préservée)
                                └─ log async ShortLinkClick (pays, appareil, source, ipHash ;
                                   bots de preview WhatsApp/FB comptés à part)
scalor.net/SCL{code} → middleware Next → 307 /api/affiliate/r/{code} → tracking → redirect
```

### Boutique publique

Inchangé v1 dans le fond (setup → sous-domaine → thème/pages/paiement/zones → StoreProduct → commande → StoreOrder → Order → confirmation WhatsApp), avec en plus : rendu SSR/ISR par scalor-next (`/sites/{sub}`), sitemap/robots par boutique, présence visiteurs temps réel, domaines custom via Caddy on-demand TLS.

### Tickets → Claude Code

```
Ticket créé (dashboard) → ticketDispatchService → GitHub Actions workflow_dispatch
→ Claude Code corrige → PR vers la branche `dev` → callback (TICKET_CALLBACK_SECRET)
```

---

## 16. Développement local

### Prérequis

Node ≥ 22.11, npm ≥ 10, MongoDB (local ou Atlas), Redis optionnel.

### Lancement

```bash
# Backend (port 8080)
cd ecomcookpit/Backend && npm install && npm run dev   # nodemon

# SPA (port 5173) — proxy /api et /socket.io vers :8080
cd ecomcookpit && npm install && npm run dev

# scalor-next (port 3000)
cd scalor-next && npm install && npm run dev           # next dev --turbopack

# preview Workers local (runtime réel)
cd scalor-next && npm run preview                      # localhost:8787
# tester une boutique : curl -H "Host: <sub>.scalor.net" http://localhost:8787/

# mobile
cd scalor-mobile && npm install && npx expo start      # QR Expo Go
EXPO_PUBLIC_API_URL=https://api-staging.scalor.net npx expo start  # pointer le staging
```

### Scripts utilitaires

```bash
node Backend/scripts/setupIndexes.js               # index MongoDB
node Backend/create-super-admin.js                 # super admin
node Backend/scripts/migratePhoneNormalization.js  # migration téléphones
node scalor-links/test/selftest.js                 # 34 tests liens courts
bash ~/scale/diagnose-vps.sh                       # diagnostic VPS
```

### URLs locales

| URL | Service |
|-----|---------|
| `http://localhost:8080` | API Express (+ `/health`) |
| `http://localhost:5173` | SPA Vite |
| `http://localhost:3000` | scalor-next (dev) |
| `http://localhost:8787` | scalor-next (preview Workers) |

---

## Annexe — Écarts connus / dette documentaire

- `netlify.toml`, `nixpacks.toml`, URLs `*.up.railway.app` (CORS, Caddy `.env.example`) : vestiges de l'infra v1 — sans effet en production, à nettoyer.
- `RAILWAY_BACKEND` (Caddy) : nom hérité ; vérifier la valeur réelle dans `caddy-proxy/.env` sur le VPS (doit pointer vers le backend PM2 local).
- `dashboardProducts.js` (routes) : présent mais absent de la table de montage de `server.js` — sous-router ou orphelin, à vérifier.
- Les deux scripts de déploiement (prod & staging) ciblent le même nom de process PM2 `scalor-backend` alors que Caddy distingue `$RAILWAY_BACKEND` et `$STAGING_BACKEND` : confirmer le nom du process staging sur le VPS (`pm2 list`).
- Migration SPA → scalor-next en cours : le dashboard existe dans les deux frontends ; `natureafrique.site` pointe encore vers l'ancien déploiement Pages.
- `Backend/server.js.bak-links`, `*.orphan-bak`, captures d'écran dans `Backend/` : fichiers de travail à purger du dépôt.

---

> **Document mis à jour le 5 août 2026** — SCALOR v2.0.0. Compteurs (routes/modèles/services/middleware) vérifiés contre le système de fichiers ; table de montage des routes extraite de `Backend/server.js` ; infra vérifiée contre `deploy-ecomcookpit-*.sh`, `caddy-proxy/Caddyfile`, `wrangler.jsonc`, `docker-compose.prod.yml` et les README de l'écosystème.
