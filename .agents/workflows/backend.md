---
description: Agent Backend Express (Railway-ready) — endpoints, middleware tenant, sécurité, tests supertest
---

# ⚡ Agent Backend Express

## Mission
Développer et maintenir le backend Express déployé sur Railway. Garantir l'isolation multi-tenant, la sécurité, et la compatibilité Railway.

## Contexte technique
- **Runtime** : Node.js + Express (ESM — `import/export`)
- **Deploy** : Railway (auto-detect, `npm start`)
- **DB** : MongoDB Atlas via Mongoose
- **Base path** : `/api/ecom`
- **Auth** : JWT vérifié par middleware `requireEcomAuth`

## Checklist Railway obligatoire

### 1. Vérifier `process.env.PORT`
```javascript
// Le serveur DOIT écouter sur process.env.PORT (Railway l'injecte)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

### 2. Trust proxy
```javascript
// Railway est derrière un reverse proxy — obligatoire pour req.ip, rate limiting, etc.
app.set('trust proxy', 1);
```

### 3. Logs structurés
- Toujours préfixer les logs : `console.log('✅ [module] message')`
- Ne JAMAIS logger de tokens, passwords, ou données sensibles
- Railway capture stdout/stderr automatiquement

## Création d'un nouvel endpoint

### Template standard
```javascript
// GET /api/ecom/<resource> — Description
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { workspaceId } = req.user;  // TOUJOURS récupérer le workspaceId
    
    const data = await Model.find({ workspaceId, ...filters });
    
    res.json({
      success: true,
      data: { items: data, total: data.length }
    });
  } catch (error) {
    console.error('❌ [resource] Erreur:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});
```

### Règles strictes
1. **TOUJOURS** filtrer par `workspaceId` sauf pour les routes super_admin
2. **TOUJOURS** utiliser `requireEcomAuth` middleware sur les routes protégées
3. **TOUJOURS** retourner `{ success: boolean, data?: {}, message?: string }`
4. **JAMAIS** d'opérations cross-workspace sauf si `req.user.role === 'super_admin'`
5. Valider les inputs avec `express-validator` ou middleware custom
6. Utiliser `try/catch` sur chaque handler async

### Montage d'un nouveau router
```javascript
// Dans le fichier principal (server.js ou app.js)
import newRouter from './ecom/routes/newResource.js';
app.use('/api/ecom/new-resource', newRouter);
```

## Variables d'environnement requises (Railway)
```
PORT                    # Injecté par Railway
MONGODB_URI             # MongoDB Atlas connection string
ECOM_JWT_SECRET         # Secret JWT pour signer les tokens
GOOGLE_CLIENT_ID        # Pour vérification Google Sign-In
RESEND_API_KEY          # Pour envoi d'emails
NODE_ENV                # production
```

## Tests avec supertest
```javascript
import request from 'supertest';
import app from '../app.js';

describe('GET /api/ecom/resource', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/ecom/resource');
    expect(res.status).toBe(401);
  });

  it('should return data with valid token', async () => {
    const res = await request(app)
      .get('/api/ecom/resource')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```
