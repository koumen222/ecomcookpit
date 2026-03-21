---
description: Agent Architecte SaaS — conventions multi-tenant, choix auth, structure repo (Cloudflare Pages + Railway)
---

# 🏗️ Agent Architecte SaaS

## Mission
Produire et maintenir le document `ARCH.md` à la racine du projet. Ce document est la source de vérité pour toute décision architecturale.

## Étapes

### 1. Analyser la structure existante
// turbo
```bash
# Lister la structure du projet
Get-ChildItem -Path "c:\Users\Morgan\Desktop\ecomcookpit" -Recurse -Depth 2 -Directory | Select-Object FullName
```

### 2. Générer / mettre à jour ARCH.md
Créer ou mettre à jour `ARCH.md` à la racine avec les sections suivantes :

```markdown
# ARCH.md — Ecom Cockpit

## Stack
- **Frontend** : React + Vite → déployé sur **Cloudflare Pages**
- **Backend** : Node.js + Express → déployé sur **Railway**
- **Base de données** : MongoDB Atlas
- **Auth** : JWT app + Google Sign-In (id_token vérifié côté backend)

## Multi-Tenant
- Chaque utilisateur appartient à un **Workspace** (collection `workspaces`)
- Le `workspaceId` est injecté dans chaque requête via middleware `requireEcomAuth`
- Isolation stricte : toute query Mongoose DOIT filtrer par `workspaceId`
- Pattern : `Model.find({ workspaceId: req.user.workspaceId, ... })`

## Rôles
| Rôle | Scope | Permissions |
|------|-------|-------------|
| `super_admin` | Global | Tout — cross-workspace |
| `ecom_admin` | Workspace | CRUD complet dans son workspace |
| `ecom_closeuse` | Workspace | Commandes (lecture/écriture) |
| `ecom_compta` | Workspace | Finance (lecture seule) |
| `ecom_livreur` | Workspace | Commandes (lecture) |

## Auth Flow
1. Login (email/password ou Google) → backend génère JWT (`ecom:xxx`)
2. Frontend stocke le token dans `localStorage` (clé `ecomToken`)
3. Chaque requête API ajoute `Authorization: Bearer <token>` via intercepteur axios
4. Backend vérifie le JWT dans `requireEcomAuth` middleware
5. Refresh automatique sur 401 via intercepteur response

## Structure du Repo
```
ecomcockpit/
├── ecom-frontend/          # React + Vite (Cloudflare Pages)
│   └── src/ecom/
│       ├── pages/           # Pages par rôle
│       ├── hooks/           # useEcomAuth, etc.
│       ├── services/        # ecommApi.js (axios)
│       └── components/      # Composants réutilisables
├── backend/                 # Express (Railway)
│   └── ecom/
│       ├── routes/          # auth.js, orders.js, etc.
│       ├── models/          # Mongoose schemas
│       ├── middleware/       # ecomAuth.js, validation.js
│       └── core/            # Services métier
└── .agents/workflows/       # Agents IA
```

## Conventions
- Routes API : `/api/ecom/<resource>`
- Env frontend : `VITE_*` (Vite)
- Env backend : pas de prefix
- Pas de `cd` dans les scripts — toujours `Cwd` explicite
- Tokens : préfixés `ecom:` (session) ou `perm:` (permanent)
```

### 3. Vérifier la cohérence
- Parcourir `backend/ecom/routes/` et vérifier que chaque route filtre bien par `workspaceId`
- Vérifier que `ecom-frontend/src/ecom/services/ecommApi.js` injecte bien le `workspaceId`
- Signaler toute incohérence trouvée

### 4. Output
- Fichier `ARCH.md` mis à jour à la racine
- Liste des incohérences éventuelles signalées dans la réponse
