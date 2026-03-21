# 🏗️ Provider System - Architecture & Implementation

## 📦 Fichiers Créés

### 1. **Modèle Provider**
📁 `Backend/models/Provider.js`

```javascript
// Structure complète du provider
- email (unique)
- password (hashé)
- apiKey & apiToken (authentication permanente)
- permissions (READ, WRITE, DELETE, MANAGE)
- instances[] (array of workspaces gérées)
- instanceLimit (quota par défaut: 10)
- status (pending, verified, active, suspended)
- metadata
```

**Méthodes utiles:**
- `comparePassword()` - Vérifier le mot de passe
- `generateNewApiToken()` - Créer un nouveau token
- `addInstance()` - Ajouter une instance
- `removeInstance()` - Retirer une instance

---

### 2. **Routes API Provider**
📁 `Backend/routes/provider.js`

**Endpoints publics (sans auth):**
- `POST /api/provider/register` - Enregistrement
- `POST /api/provider/verify-email/:token` - Vérification
- `POST /api/provider/login` - Connexion

**Endpoints protégés (Bearer Token requis):**
- `POST /api/provider/instances` - Créer une instance ➕
- `GET /api/provider/instances` - Lister les instances
- `GET /api/provider/instances/:id` - Détails
- `PUT /api/provider/instances/:id` - Modifier
- `DELETE /api/provider/instances/:id` - Supprimer ❌
- `POST /api/provider/refresh-token` - Rafraîchir le token
- `GET /api/provider/me` - Mes infos

---

### 3. **Middleware d'Authentification**
📁 `Backend/middleware/providerAuth.js`

**Middleware:**
- `requireProviderAuth` - Vérifier le Bearer Token
- `requireProviderPermission()` - Vérifier les permissions
- `logProviderAction()` - Logger les actions (audit)
- `requireInstanceAccess` - Vérifier l'accès à une instance

---

### 4. **Intégration dans le Server**
📁 `Backend/server.js` (modifié)

```javascript
// Ajout de la route provider au démarrage du serveur
['./routes/provider.js', '/api/provider'],
```

---

### 5. **Documentation**
📁 `Backend/docs/PROVIDER_SYSTEM.md` - Documentation complète
📁 `Backend/docs/PROVIDER_QUICKSTART.md` - Guide rapide
📁 `Backend/docs/PROVIDER_ARCHITECTURE.md` - Ce fichier

---

### 6. **Script de Test**
📁 `Backend/scripts/test-provider.js`

Script complet pour tester tous les endpoints:
```bash
node Backend/scripts/test-provider.js
```

---

## 🔄 Flux d'Authentification

```
┌─────────────────────────────────────────────────────────────┐
│ 1. REGISTRATION                                             │
│ POST /api/provider/register                                 │
│ → Crée le provider en status "pending"                      │
│ → Génère apiToken (prov_xxxxx)                              │
│ → Envoie email de vérification                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. EMAIL VERIFICATION                                       │
│ POST /api/provider/verify-email/:token                      │
│ → Valide le token                                           │
│ → Status: pending → active                                  │
│ → Email verified: true                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. LOGIN (Optionnel - token reçu lors du register)          │
│ POST /api/provider/login                                    │
│ → Valide email + password                                   │
│ → Retourne le token existant                                │
│ → Metà jour lastLogin                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. API CALLS (Toutes les opérations)                        │
│ Authorization: Bearer prov_xxxxx                            │
│ → requireProviderAuth middleware vérifie le token           │
│ → req.providerId est défini                                 │
│ → Toutes les opérations utilisent ce providerId             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Modèle de Données

### Provider Schema
```javascript
{
  // Identité
  email: "provider@company.com",
  password: "hashed_password",
  company: "Company Name",
  name: "John Doe",
  phone: "+1234567890",
  
  // API Authentication
  apiKey: "pk_xxx",
  apiToken: "prov_xxx",
  tokenExpiresAt: Date(+365 days),
  
  // Permissions
  permissions: ["instances:create", "instances:read", "instances:update", "instances:delete"],
  
  // Instances Management
  instances: [
    {
      workspaceId: ObjectId,
      createdAt: Date,
      status: "active|suspended|deleted"
    }
  ],
  
  // Quotas
  instanceLimit: 10,
  activeInstances: 5,
  
  // Status
  status: "pending|verified|active|suspended",
  isEmailVerified: true,
  
  // Audit
  lastLogin: Date,
  lastTokenRefresh: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔒 Sécurité

### Token Bearer
- Format: `Authorization: Bearer prov_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Validité: **1 an**
- Unique par provider
- Peut être rafraîchi: `POST /api/provider/refresh-token`

### Password Hashing
- Algorithme: **bcryptjs** (10 salt rounds)
- Stocké hashé en base de données

### Instance Isolation
- Chaque provider ne peut accéder que ses propres instances
- Vérification: `requireInstanceAccess` middleware
- Chaque instance = workspace complètement isolée

### Audit Trail
- Logging de toutes les actions via `logProviderAction`
- Possibilité d'ajouter une table d'audit

---

## 💻 Exemples d'Utilisation

### JavaScript/Node.js
```javascript
import axios from 'axios';

const provider = new ProviderClient('http://localhost:8080/api/provider');

// 1. Register
const { apiToken } = await provider.register({
  email: 'me@company.com',
  password: 'secure123',
  company: 'My Company',
  name: 'My Name'
});

// 2. Create Instance
const { instance } = await provider.createInstance(apiToken, {
  name: 'My Store',
  subdomain: 'mystore'
});

// 3. List Instances
const instances = await provider.listInstances(apiToken);

// 4. Update Instance
await provider.updateInstance(apiToken, instance.id, {
  name: 'Updated Name'
});
```

### Python
```python
import requests

API_URL = 'http://localhost:8080/api/provider'
token = None

# Register
response = requests.post(f'{API_URL}/register', json={
    'email': 'me@company.com',
    'password': 'secure123',
    'company': 'My Company',
    'name': 'My Name'
})
token = response.json()['provider']['apiToken']

# Create Instance
response = requests.post(
    f'{API_URL}/instances',
    json={'name': 'My Store', 'subdomain': 'mystore'},
    headers={'Authorization': f'Bearer {token}'}
)
print(response.json()['instance']['accessUrl'])
```

---

## 🎯 Cas d'Utilisation

### 1. **Agence Multiservices**
- ✅ Une agence gère 50 clients
- ✅ Chaque client = 1 instance indépendante
- ✅ Agence = 1 provider avec limite de 50 instances

### 2. **Revendeur SaaS**
- ✅ Revendeur crée des comptes pour ses clients
- ✅ Clients ne connaissent pas l'existence du revendeur
- ✅ Facturation centralisée chez le revendeur

### 3. **Intégration Externe**
- ✅ Système externe provisionne les instances via l'API
- ✅ Pas d'accès au panneau admin
- ✅ Gestion complète via API REST

### 4. **White Label**
- ✅ Votre branding sur chaque instance
- ✅ Vos clients ne savent pas c'est scalor.net
- ✅ Domaines personnalisés supportés

---

## 🚀 Déploiement

### Sur Localhost
```bash
cd Backend
node server.js
```

Serveur démarre sur `http://localhost:8080`

### En Production
```bash
# Via Railway
git push origin main

# Via Docker
docker build -t provider-api .
docker run -e MONGO_URI=... -p 8080:8080 provider-api
```

---

## 🔍 Monitoring & Logs

### Logs Importants
```javascript
// Chaque action provider est loggée
[PROVIDER ACTION] instances:create - Provider: 507f1f77bcf86cd799439011
[PROVIDER ACTION] instances:delete - Provider: 507f1f77bcf86cd799439011
```

### Erreurs à Surveiller
- Tentatives de login échouées → rate limiting?
- Tokens expirés → faire un refresh
- Quota atteint → upgrade plan?

---

## 📈 Évolutions Futures

- [ ] **Webhooks** - Notifier les providers des changements
- [ ] **Facturation** - Usage-based pricing par provider
- [ ] **Permissions granulaires** - Limiter les permissions par provider
- [ ] **Multi-admin** - Plusieurs utilisateurs par provider
- [ ] **2FA** - Double factor authentication
- [ ] **API Keys** - Clés alternatives au Bearer token
- [ ] **Rate Limiting** - Limiter le nombre d'appels API
- [ ] **Analytics** - Dashboard de performance

---

## 🧪 Testing

### Tests Unitaires (Jest)
```bash
npm test -- test/provider.test.js
```

### Tests d'Intégration
```bash
node Backend/scripts/test-provider.js
```

### Tests Manuels (cURL)
```bash
curl -X POST http://localhost:8080/api/provider/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com",...}'
```

---

## 📞 Support & Troubleshooting

### Problème: "No or invalid Authorization header"
**Solution**: Les endpoints protégés nécessitent un Bearer token:
```
Authorization: Bearer prov_xxxxx
```

### Problème: "Invalid or expired token"
**Solution**: Rafraîchissez votre token:
```bash
curl -X POST http://localhost:8080/api/provider/refresh-token \
  -H "Authorization: Bearer prov_xxxxx"
```

### Problème: "Email already registered"
**Solution**: Utilisez une autre email ou connectez-vous:
```bash
curl -X POST http://localhost:8080/api/provider/login \
  -d '{"email":"...","password":"..."}'
```

### Problème: Instances limit reached
**Solution**: Contactez support ou supprimez une instance:
```bash
curl -X DELETE http://localhost:8080/api/provider/instances/:id \
  -H "Authorization: Bearer prov_xxxxx"
```

---

## 📚 Ressources

- [PROVIDER_SYSTEM.md](./PROVIDER_SYSTEM.md) - Documentation API complète
- [PROVIDER_QUICKSTART.md](./PROVIDER_QUICKSTART.md) - Guide rapide
- [Backend Models](../models/Provider.js) - Code source du modèle
- [Backend Routes](../routes/provider.js) - Code source des routes
- [Middleware](../middleware/providerAuth.js) - Code source du middleware

---

**🎉 Le système Provider est maintenant opérationnel!**

Vous pouvez:
✅ Vous enregistrer comme provider
✅ Créer et gérer vos instances
✅ Utiliser l'API REST directement
✅ Isoler complètement vos applications
✅ Scalez votre business!

**Questions?** → support@scalor.net
