# Guide de Migration - Fix UTF-8 Définitif

## ✅ Client API Centralisé

Le client API centralisé (`src/lib/api.js`) résout définitivement les problèmes d'encodage UTF-8.

### Pourquoi ce fix fonctionne

1. **Force `responseType: "text"`** - Empêche axios de deviner l'encodage
2. **Parse manuel avec `JSON.parse()`** - Contrôle total sur le décodage UTF-8
3. **Headers UTF-8 explicites** - Force `charset=utf-8` dans les requêtes
4. **Intercepteurs intégrés** - Gestion automatique du token et des erreurs 401

---

## 🔄 Migration des Appels API

### ❌ Avant (axios direct)

```javascript
import axios from 'axios';

const response = await axios.get('/api/ecom/products', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const data = response.data;
```

### ✅ Après (client API centralisé)

```javascript
import api from '@/lib/api';

const response = await api.get('/products');
const data = response.data;
```

---

## 📝 Exemples de Migration

### GET avec paramètres

```javascript
// ❌ Avant
const response = await axios.get('/api/ecom/orders', {
  params: { status: 'pending' },
  headers: { 'Authorization': `Bearer ${token}` }
});

// ✅ Après
const response = await api.get('/orders', {
  params: { status: 'pending' }
});
```

### POST avec données

```javascript
// ❌ Avant
const response = await axios.post('/api/ecom/products', productData, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// ✅ Après
const response = await api.post('/products', productData);
```

### PUT/PATCH

```javascript
// ❌ Avant
const response = await axios.put(`/api/ecom/products/${id}`, updates, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// ✅ Après
const response = await api.put(`/products/${id}`, updates);
```

### DELETE

```javascript
// ❌ Avant
const response = await axios.delete(`/api/ecom/products/${id}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// ✅ Après
const response = await api.delete(`/products/${id}`);
```

---

## 🔍 Migration fetch() vers API client

### ❌ Avant (fetch avec problèmes d'encodage)

```javascript
const response = await fetch('/api/ecom/data');
const data = await response.json(); // ⚠️ Peut mal décoder UTF-8
```

### ✅ Après (client API)

```javascript
import api from '@/lib/api';

const response = await api.get('/data');
const data = response.data;
```

---

## 🎯 Fichiers à Migrer

### Priorité HAUTE (contiennent des caractères accentués)
- [ ] `src/ecom/pages/TeamChat.jsx` (18 fetch)
- [ ] `src/ecom/components/ChatWidget.jsx` (10 fetch)
- [ ] `src/ecom/hooks/useMediaUpload.js` (2 fetch)
- [ ] `src/ecom/hooks/useDmUnread.js` (1 fetch)
- [ ] `src/ecom/hooks/useOrdersOptimized.js` (1 fetch)
- [ ] `src/ecom/services/analytics.js` (1 fetch)

### ✅ Déjà migrés
- [x] `src/ecom/services/impersonationApi.js` (7 axios → api)

---

## 🚀 Avantages du Client API

1. **Fix UTF-8 automatique** - Plus de `é` au lieu de `é`
2. **Token automatique** - Plus besoin de gérer manuellement
3. **Gestion 401 globale** - Redirection auto vers login
4. **Code plus propre** - Moins de boilerplate
5. **Maintenance centralisée** - Un seul endroit pour les configs

---

## ⚙️ Configuration

Le client API utilise les variables d'environnement :

```env
VITE_API_URL=/api/ecom  # Par défaut
```

Pour changer la baseURL, modifiez `src/lib/api.js`.

---

## 🔧 Personnalisation

### Ajouter des intercepteurs personnalisés

```javascript
// src/lib/api.js
api.interceptors.request.use((config) => {
  // Votre logique personnalisée
  return config;
});
```

### Gérer d'autres codes d'erreur

```javascript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      // Gérer les erreurs de permission
    }
    return Promise.reject(error);
  }
);
```
