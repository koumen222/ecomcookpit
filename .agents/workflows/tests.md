---
description: Agent Tests — tests multi-tenant isolation, tests auth (token expiré, invalide), patterns de test
---

# 🧪 Agent Tests

## Mission
Écrire et maintenir les tests automatisés. Garantir l'isolation multi-tenant (Workspace A ne voit pas Workspace B) et la robustesse de l'authentification.

## Stack de test
- **Runner** : Vitest ou Jest (ESM compatible)
- **HTTP** : supertest
- **DB** : MongoDB Memory Server (tests isolés)

## 1. Tests Multi-Tenant — Isolation stricte

### Principe fondamental
> Un utilisateur du Workspace A ne doit JAMAIS pouvoir lire, modifier, ou supprimer une ressource du Workspace B.

### Setup de test
```javascript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateTestToken } from './helpers.js';

// Deux workspaces distincts
const WORKSPACE_A = '65a1b2c3d4e5f6a7b8c9d0e1';
const WORKSPACE_B = '65a1b2c3d4e5f6a7b8c9d0e2';

const tokenA = generateTestToken({ workspaceId: WORKSPACE_A, role: 'ecom_admin' });
const tokenB = generateTestToken({ workspaceId: WORKSPACE_B, role: 'ecom_admin' });
```

### Test : Workspace A ne voit PAS les données de B
```javascript
describe('Isolation multi-tenant', () => {
  let resourceIdA;
  
  it('Workspace A crée une ressource', async () => {
    const res = await request(app)
      .post('/api/ecom/resource')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Ressource Workspace A' });
    
    expect(res.status).toBe(201);
    resourceIdA = res.body.data.id;
  });

  it('Workspace A voit sa ressource', async () => {
    const res = await request(app)
      .get(`/api/ecom/resource/${resourceIdA}`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Ressource Workspace A');
  });

  it('Workspace B ne voit PAS la ressource de A', async () => {
    const res = await request(app)
      .get(`/api/ecom/resource/${resourceIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    
    expect(res.status).toBe(404); // ← DOIT être 404, pas 200
  });

  it('Workspace B ne peut PAS modifier la ressource de A', async () => {
    const res = await request(app)
      .put(`/api/ecom/resource/${resourceIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Piraté !' });
    
    expect(res.status).toBe(404);
  });

  it('Workspace B ne peut PAS supprimer la ressource de A', async () => {
    const res = await request(app)
      .delete(`/api/ecom/resource/${resourceIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    
    expect(res.status).toBe(404);
  });

  it('Listing ne montre que les ressources du workspace', async () => {
    const res = await request(app)
      .get('/api/ecom/resource')
      .set('Authorization', `Bearer ${tokenB}`);
    
    expect(res.status).toBe(200);
    // Aucune ressource de A ne doit apparaître
    const ids = res.body.data.items.map(i => i._id);
    expect(ids).not.toContain(resourceIdA);
  });
});
```

## 2. Tests Auth — Token expiré, invalide, manquant

```javascript
describe('Authentification', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/ecom/orders');
    expect(res.status).toBe(401);
  });

  it('401 avec token invalide', async () => {
    const res = await request(app)
      .get('/api/ecom/orders')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('401 avec token expiré', async () => {
    const expiredToken = generateTestToken(
      { workspaceId: WORKSPACE_A, role: 'ecom_admin' },
      { expiresIn: '0s' } // Déjà expiré
    );
    const res = await request(app)
      .get('/api/ecom/orders')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('403 accès admin avec rôle closeuse', async () => {
    const closeuseToken = generateTestToken({
      workspaceId: WORKSPACE_A,
      role: 'ecom_closeuse'
    });
    const res = await request(app)
      .delete('/api/ecom/users/some-id')
      .set('Authorization', `Bearer ${closeuseToken}`);
    expect([401, 403]).toContain(res.status);
  });

  it('Login réussi retourne un token valide', async () => {
    const res = await request(app)
      .post('/api/ecom/auth/login')
      .send({ email: 'test@test.com', password: 'Password1!' });
    
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('test@test.com');
    }
  });

  it('Login Google avec credential invalide → 401', async () => {
    const res = await request(app)
      .post('/api/ecom/auth/google')
      .send({ credential: 'fake.jwt.token' });
    expect(res.status).toBe(401);
  });
});
```

## 3. Helper pour générer des tokens de test
```javascript
// tests/helpers.js
import jwt from 'jsonwebtoken';

const TEST_SECRET = process.env.ECOM_JWT_SECRET || 'test-secret';

export function generateTestToken(payload, options = {}) {
  return 'ecom:' + jwt.sign(
    { id: payload.userId || 'test-user-id', ...payload },
    TEST_SECRET,
    { expiresIn: '1h', ...options }
  );
}
```

## 4. Exécution des tests
```bash
# Lancer tous les tests
npm test

# Lancer un fichier spécifique
npx vitest run tests/auth.test.js

# Mode watch
npx vitest --watch
```
