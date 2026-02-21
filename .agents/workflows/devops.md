---
description: Agent DevOps — scripts build, health endpoint, runbook deploy Cloudflare Pages + Railway
---

# 🚀 Agent DevOps

## Mission
Maintenir les scripts de build, les endpoints de santé, et le runbook de déploiement pour Cloudflare Pages (frontend) et Railway (backend).

## 1. Health Endpoints

### Backend — `/api/ecom/auth/health` (déjà implémenté)
```javascript
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is running',
    timestamp: new Date().toISOString(),
    env: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasJwtSecret: !!process.env.ECOM_JWT_SECRET,
      hasMongoUri: !!process.env.MONGODB_URI,
      nodeEnv: process.env.NODE_ENV || 'development',
    }
  });
});
```

### Vérification rapide
```bash
# Prod
curl https://plateforme-backend-production-2ec6.up.railway.app/api/ecom/auth/health

# Local
curl http://localhost:3000/api/ecom/auth/health
```

## 2. Scripts de build

### Frontend (Cloudflare Pages)
```json
// ecom-frontend/package.json
{
  "scripts": {
    "dev": "vite --port 5173",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**Cloudflare Pages settings** :
- Build command : `npm run build`
- Build output directory : `dist`
- Root directory : `ecom-frontend`
- Node.js version : `18` (ou `20`)

### Backend (Railway)
```json
// backend/package.json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

**Railway settings** :
- Start command : `npm start`
- Root directory : `backend`
- Pas besoin de build command

## 3. Runbook Deploy

### 🟡 Deploy Frontend (Cloudflare Pages)

#### Méthode 1 : Auto (Git push)
```bash
# Tout commit sur main déclenche un build sur Cloudflare Pages
git add .
git commit -m "feat: description du changement"
git push origin main
# → Cloudflare Pages détecte le push et build automatiquement
# → Vérifier sur https://dash.cloudflare.com/
```

#### Méthode 2 : Manual (Wrangler)
```bash
cd ecom-frontend
npm run build
npx wrangler pages deploy dist --project-name=ecomcockpit
```

#### Variables d'env à vérifier (Cloudflare Dashboard)
```
VITE_GOOGLE_CLIENT_ID=559924689181-rpkv8ji3029kvrtsvt3qceusmsh1i4p2.apps.googleusercontent.com
```

### 🟣 Deploy Backend (Railway)

#### Méthode : Auto (Git push)
```bash
# Railway détecte les changements dans /backend et redéploie
git add .
git commit -m "fix: description"
git push origin main
# → Railway rebuild automatiquement
```

#### Variables d'env à vérifier (Railway Dashboard)
```
PORT=3000                    # (Railway l'injecte, mais bon à avoir)
MONGODB_URI=mongodb+srv://...
ECOM_JWT_SECRET=<secret-fort>
GOOGLE_CLIENT_ID=559924689181-rpkv8ji3029kvrtsvt3qceusmsh1i4p2.apps.googleusercontent.com
RESEND_API_KEY=re_...
NODE_ENV=production
```

## 4. Checklist pré-deploy

### Frontend
- [ ] `npm run build` réussit sans erreur
- [ ] Pas de `console.log` de debug restant
- [ ] Variables `VITE_*` correctes dans Cloudflare
- [ ] Proxy `/api/*` configuré vers Railway

### Backend
- [ ] `npm start` démarre sans crash
- [ ] `process.env.PORT` est utilisé (pas hardcodé)
- [ ] `trust proxy` activé
- [ ] Health endpoint répond
- [ ] Variables d'env Railway toutes définies
- [ ] MongoDB Atlas whitelist IP inclut `0.0.0.0/0` (Railway IPs dynamiques)

## 5. Monitoring post-deploy

### Vérifications immédiates (dans les 5 min post-deploy)
```bash
# 1. Health check backend
curl -s https://plateforme-backend-production-2ec6.up.railway.app/api/ecom/auth/health | jq .

# 2. Frontend accessible
curl -s -o /dev/null -w "%{http_code}" https://ecomcookpit.site

# 3. API accessible depuis le frontend (CORS OK)
curl -s -H "Origin: https://ecomcookpit.site" \
  https://plateforme-backend-production-2ec6.up.railway.app/api/ecom/auth/health \
  -I | grep -i "access-control"
```

### Si problème
1. **502 Railway** → Vérifier les logs Railway, souvent `PORT` pas bindé
2. **CORS bloqué** → Vérifier la whitelist dans le backend
3. **Build fail Cloudflare** → Vérifier les logs de build, souvent node_modules ou version Node
4. **Auth Google 403** → Vérifier les Authorized JavaScript Origins dans Google Cloud Console
