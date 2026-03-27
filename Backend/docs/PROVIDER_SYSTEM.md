# 🚀 Provider Management System

## Vue d'ensemble

Le système Provider permet à des fournisseurs externes de :
- ✅ S'enregistrer en tant que provider
- ✅ Créer et gérer leurs propres instances (workspaces) indépendantes
- ✅ Accéder via un **Bearer Token** permanent
- ✅ Avoir des permissions **READ/WRITE** complètes sur leurs instances
- ✅ Ne pas passer par l'API principale

---

## 🔐 Architecture

```
┌─────────────────────────────────────────┐
│     Provider System                      │
├─────────────────────────────────────────┤
│ • Modèle: Backend/models/Provider.js    │
│ • Routes: Backend/routes/provider.js    │
│ • Middleware: Backend/middleware/       │
│   providerAuth.js                       │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│   Instances (Workspaces)                │
│   - Créées rapidement                   │
│   - Isolées les unes des autres         │
│   - Gérées par le provider              │
└─────────────────────────────────────────┘
```

---

## 📋 Endpoints

### 1️⃣ Enregistrement

**POST** `/api/provider/register`

```bash
curl -X POST http://localhost:8080/api/provider/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "provider@example.com",
    "password": "secure_password_123",
    "company": "My Provider Company",
    "name": "John Doe",
    "phone": "+1234567890"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Provider registered successfully. Please verify your email.",
  "provider": {
    "id": "507f1f77bcf86cd799439011",
    "email": "provider@example.com",
    "company": "My Provider Company",
    "status": "pending",
    "apiToken": "prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
  }
}
```

---

### 2️⃣ Vérification Email

**POST** `/api/provider/verify-email/:token`

Récupérez le token du lien d'email. Le token est envoyé automatiquement par email.

```bash
curl -X POST http://localhost:8080/api/provider/verify-email/abc123def456 \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully. Your account is now active."
}
```

---

### 3️⃣ Login

**POST** `/api/provider/login`

```bash
curl -X POST http://localhost:8080/api/provider/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "provider@example.com",
    "password": "secure_password_123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "provider": {
      "id": "507f1f77bcf86cd799439011",
      "email": "provider@example.com",
      "company": "My Provider Company",
      "name": "John Doe",
      "status": "active",
      "stats": {
        "totalInstances": 2,
        "activeInstances": 2,
        "suspendedInstances": 0,
        "canCreateMoreInstances": true
      }
    },
    "token": "prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "tokenType": "Bearer"
  }
}
```

**⚠️ Sauvegardez ce token! C'est votre clé d'accès à l'API.**

---

### 4️⃣ Créer une Instance

**POST** `/api/provider/instances`

```bash
curl -X POST http://localhost:8080/api/provider/instances \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -d '{
    "name": "My First Store",
    "subdomain": "mystore",
    "settings": {
      "currency": "XAF",
      "businessType": "ecommerce"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Instance created successfully",
  "instance": {
    "id": "507f1f77bcf86cd799439012",
    "name": "My First Store",
    "slug": "my-first-store-1710864000",
    "subdomain": "mystore",
    "createdAt": "2024-03-20T10:00:00.000Z",
    "accessUrl": "https://mystore.scalor.net"
  }
}
```

**✅ Votre instance est maintenant accessible sur `https://mystore.scalor.net`**

---

### 5️⃣ Lister les Instances

**GET** `/api/provider/instances`

```bash
curl -X GET http://localhost:8080/api/provider/instances \
  -H "Authorization: Bearer prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalInstances": 2,
      "activeInstances": 2,
      "suspendedInstances": 0,
      "canCreateMoreInstances": true
    },
    "instances": [
      {
        "id": "507f1f77bcf86cd799439012",
        "name": "My First Store",
        "slug": "my-first-store-1710864000",
        "subdomain": "mystore",
        "status": "active",
        "createdAt": "2024-03-20T10:00:00.000Z",
        "accessUrl": "https://mystore.scalor.net"
      }
    ]
  }
}
```

---

### 6️⃣ Détails d'une Instance

**GET** `/api/provider/instances/:instanceId`

```bash
curl -X GET http://localhost:8080/api/provider/instances/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "My First Store",
    "slug": "my-first-store-1710864000",
    "subdomain": "mystore",
    "status": "active",
    "createdAt": "2024-03-20T10:00:00.000Z",
    "settings": {
      "currency": "XAF",
      "businessType": "ecommerce",
      "providerManaged": true
    },
    "storeSettings": {
      "isStoreEnabled": false,
      "storeName": "",
      "storeLogo": "",
      "storeThemeColor": "#0F6B4F"
    },
    "accessUrl": "https://mystore.scalor.net"
  }
}
```

---

### 7️⃣ Mettre à jour une Instance

**PUT** `/api/provider/instances/:instanceId`

```bash
curl -X PUT http://localhost:8080/api/provider/instances/507f1f77bcf86cd799439012 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -d '{
    "name": "My Updated Store Name",
    "storeSettings": {
      "isStoreEnabled": true,
      "storeName": "My Awesome Store",
      "storeDescription": "Welcome to our store!",
      "storeThemeColor": "#FF5733",
      "storeCurrency": "XAF"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Instance updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "My Updated Store Name",
    "settings": { ... },
    "storeSettings": { ... }
  }
}
```

---

### 8️⃣ Supprimer une Instance

**DELETE** `/api/provider/instances/:instanceId`

```bash
curl -X DELETE http://localhost:8080/api/provider/instances/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**Response:**
```json
{
  "success": true,
  "message": "Instance deleted successfully"
}
```

---

### 9️⃣ Rafraîchir le Token

**POST** `/api/provider/refresh-token`

```bash
curl -X POST http://localhost:8080/api/provider/refresh-token \
  -H "Authorization: Bearer prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "prov_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6",
    "expiresAt": "2025-03-20T10:00:00.000Z"
  }
}
```

**⚠️ Mettez à jour votre token d'accès avec le nouveau token!**

---

### 🔟 Mes Infos

**GET** `/api/provider/me`

```bash
curl -X GET http://localhost:8080/api/provider/me \
  -H "Authorization: Bearer prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "provider@example.com",
    "company": "My Provider Company",
    "name": "John Doe",
    "phone": "+1234567890",
    "status": "active",
    "permissions": [
      "instances:create",
      "instances:read",
      "instances:update",
      "instances:delete",
      "instances:manage"
    ],
    "stats": {
      "totalInstances": 2,
      "activeInstances": 2,
      "suspendedInstances": 0,
      "canCreateMoreInstances": true
    },
    "limits": {
      "instanceLimit": 10,
      "activeInstances": 2
    },
    "tokenInfo": {
      "expiresAt": "2025-03-20T10:00:00.000Z",
      "refreshCount": 3,
      "lastRefresh": "2024-03-15T08:30:00.000Z"
    },
    "createdAt": "2024-03-20T10:00:00.000Z"
  }
}
```

---

## 🔑 Authentification

Tous les endpoints (sauf register et verify-email) nécessitent une authentification Bearer Token.

### Format du Header:
```
Authorization: Bearer prov_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Erreurs d'authentification:

**401 - Missing Token:**
```json
{
  "success": false,
  "message": "No or invalid Authorization header. Use: Bearer <token>"
}
```

**401 - Token Expiré:**
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

---

## 📊 Limites et Quotas

Par défaut:
- **10 instances** par provider
- **1 an** de validité du token
- **Permissions illimitées** sur les instances créées

### Pour augmenter les limites:
Contactez support@scalor.net avec votre ID provider

---

## 🔄 Workflow Typique

```
1. REGISTER
   ↓
2. VERIFY EMAIL
   ↓
3. LOGIN → Obtenez votre token
   ↓
4. CREATE INSTANCE → Votre première boutique
   ↓
5. LIST INSTANCES → Vérifiez vos instances
   ↓
6. GET INSTANCE → Détails d'une instance
   ↓
7. UPDATE INSTANCE → Modifiez la configuration
   ↓
8. ACCESS STORE → https://yoursubdomain.scalor.net
```

---

## 💻 Exemples de Code

### JavaScript / Node.js

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:8080/api/provider';
let token = null;

// 1. Register
async function register() {
  const response = await axios.post(`${API_URL}/register`, {
    email: 'provider@example.com',
    password: 'secure_password_123',
    company: 'My Company',
    name: 'John Doe',
    phone: '+1234567890'
  });
  
  console.log('Registered:', response.data);
  token = response.data.provider.apiToken;
  return response.data;
}

// 2. Login
async function login() {
  const response = await axios.post(`${API_URL}/login`, {
    email: 'provider@example.com',
    password: 'secure_password_123'
  });
  
  console.log('Logged in:', response.data);
  token = response.data.data.token;
  return response.data;
}

// 3. Create Instance
async function createInstance(name, subdomain) {
  const response = await axios.post(
    `${API_URL}/instances`,
    {
      name,
      subdomain,
      settings: { currency: 'XAF' }
    },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  console.log('Instance created:', response.data);
  return response.data;
}

// 4. List Instances
async function listInstances() {
  const response = await axios.get(`${API_URL}/instances`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  console.log('Instances:', response.data.data.instances);
  return response.data;
}

// Usage
(async () => {
  await register();
  // await login(); // Si vous vous reconectez
  const { instance } = await createInstance('My Store', 'mystore');
  await listInstances();
})();
```

### Python

```python
import requests
import json

API_URL = 'http://localhost:8080/api/provider'
token = None

def register():
    global token
    response = requests.post(f'{API_URL}/register', json={
        'email': 'provider@example.com',
        'password': 'secure_password_123',
        'company': 'My Company',
        'name': 'John Doe'
    })
    
    data = response.json()
    token = data['provider']['apiToken']
    print(f"Registered: {json.dumps(data, indent=2)}")
    return data

def create_instance(name, subdomain):
    response = requests.post(
        f'{API_URL}/instances',
        json={'name': name, 'subdomain': subdomain},
        headers={'Authorization': f'Bearer {token}'}
    )
    
    data = response.json()
    print(f"Instance created: {json.dumps(data, indent=2)}")
    return data

def list_instances():
    response = requests.get(
        f'{API_URL}/instances',
        headers={'Authorization': f'Bearer {token}'}
    )
    
    data = response.json()
    print(f"Instances: {json.dumps(data['data']['instances'], indent=2)}")
    return data

# Usage
if __name__ == '__main__':
    register()
    create_instance('My Store', 'mystore')
    list_instances()
```

---

## 🛠️ Gestion des Erreurs

### Erreurs Courantes:

| Code | Message | Solution |
|------|---------|----------|
| 400 | Missing required fields | Vérifiez tous les champs obligatoires |
| 400 | This email is already registered | Utilisez une autre email |
| 401 | Invalid credentials | Vérifiez email/password |
| 403 | Provider account is suspended | Contactez support |
| 403 | Instance limit reached | Upgradez votre plan |
| 404 | Not found | Vérifiez l'ID de l'instance |
| 500 | Internal server error | Reportez à support@scalor.net |

---

## 📞 Support

Pour des questions ou des problèmes:
- **Email**: support@scalor.net
- **Documentation**: https://docs.scalor.net/provider
- **Status**: https://status.scalor.net

---

## 📝 Notes

- ✅ Tokens valides **1 an**
- ✅ Instances isolées et sécurisées
- ✅ API REST avec JSON
- ✅ HTTPS obligatoire en production
- ✅ Rate limiting: 100 requêtes/minute par provider

---

**Bienvenue dans le système Provider! 🎉**
