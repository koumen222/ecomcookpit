---
description: Agent Sécurité — CORS, rate limit, validation, IDOR tenant leak, headers sécurité
---

# 🔒 Agent Sécurité

## Mission
Auditer et renforcer la sécurité de la plateforme. Prévenir les fuites de données cross-tenant (IDOR), configurer CORS, rate limiting, validation des inputs et headers de sécurité.

## 1. CORS Whitelist

### Configuration obligatoire (backend)
```javascript
import cors from 'cors';

const CORS_WHITELIST = [
  'https://ecomcookpit.site',          // Prod frontend
  'https://www.ecomcookpit.site',      // Prod www
  'http://localhost:5173',              // Dev frontend Vite
  'http://localhost:3000',              // Dev backend
];

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (mobile apps, curl, etc.)
    if (!origin || CORS_WHITELIST.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ [CORS] Origin bloqué: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
}));
```

### Vérification
```bash
curl -I -H "Origin: https://malicious.com" https://your-backend/api/ecom/auth/health
# Doit retourner SANS header Access-Control-Allow-Origin
```

## 2. Rate Limiting

### Configuration recommandée
```javascript
import rateLimit from 'express-rate-limit';

// Limite globale
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // 100 requêtes par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes. Réessayez dans 15 minutes.' }
});

// Limite stricte pour l'auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                     // 10 tentatives login
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' }
});

app.use('/api/', globalLimiter);
app.use('/api/ecom/auth/login', authLimiter);
app.use('/api/ecom/auth/google', authLimiter);
app.use('/api/ecom/auth/register', authLimiter);
```

## 3. Validation des inputs

### Règles
1. **TOUJOURS** valider côté serveur — ne JAMAIS faire confiance au frontend
2. Utiliser `express-validator` ou validation manuelle
3. Échapper les strings pour prévenir NoSQL injection

### Pattern anti-NoSQL injection
```javascript
// ❌ DANGEREUX — injection possible
const user = await User.findOne({ email: req.body.email });

// ✅ SÉCURISÉ — forcer le type string
const email = String(req.body.email || '').toLowerCase().trim();
const user = await User.findOne({ email });
```

### Validation ObjectId
```javascript
import mongoose from 'mongoose';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Dans le handler
if (!isValidId(req.params.id)) {
  return res.status(400).json({ success: false, message: 'ID invalide' });
}
```

## 4. IDOR — Prévention fuite multi-tenant

### Le risque
Un utilisateur du Workspace A modifie l'ID dans l'URL pour accéder aux données du Workspace B.

### Pattern de protection obligatoire
```javascript
// ✅ TOUJOURS vérifier que la ressource appartient au workspace de l'utilisateur
router.get('/:id', requireEcomAuth, async (req, res) => {
  const resource = await Model.findOne({
    _id: req.params.id,
    workspaceId: req.user.workspaceId  // ← OBLIGATOIRE
  });
  
  if (!resource) {
    return res.status(404).json({ success: false, message: 'Ressource non trouvée' });
  }
  // ...
});
```

### Audit IDOR — Vérification automatisée
Rechercher dans tous les fichiers routes les patterns dangereux :
```bash
# Trouver les findById sans workspaceId (potentiellement dangereux)
rg "findById\(" backend/ecom/routes/ --include "*.js" -n
# Chaque résultat DOIT être suivi d'une vérification workspaceId
```

## 5. Headers de sécurité

### Avec helmet
```javascript
import helmet from 'helmet';
app.use(helmet());
```

### Headers manuels (si pas helmet)
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
```

## 6. Checklist audit sécurité
- [ ] CORS configuré avec whitelist stricte
- [ ] Rate limiting sur routes d'auth
- [ ] Tous les endpoints protégés par `requireEcomAuth`
- [ ] Toutes les queries filtrent par `workspaceId`
- [ ] Pas de `findById` sans vérification tenant
- [ ] Inputs validés et typés côté serveur
- [ ] Tokens/passwords jamais loggés
- [ ] Headers de sécurité actifs
- [ ] Google id_token vérifié avec `google-auth-library` (pas juste décodé)
- [ ] JWT secret fort (pas la valeur par défaut)
