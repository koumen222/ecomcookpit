---
description: Agent Frontend React (Cloudflare Pages-ready) — config env, auth flow, fetch wrapper, gestion erreurs
---

# 🖥️ Agent Frontend React

## Mission
Développer et maintenir le frontend React déployé sur Cloudflare Pages. Garantir le bon fonctionnement de l'auth, des appels API, et de la gestion d'erreurs.

## Contexte technique
- **Framework** : React + Vite
- **Deploy** : Cloudflare Pages (build `npm run build`, output `dist/`)
- **Styling** : TailwindCSS
- **API** : Proxy via Cloudflare Workers vers Railway backend
- **Base URL API** : `/api/ecom` (relatif — le proxy gère le forwarding)

## Configuration Cloudflare Pages

### Variables d'environnement (Cloudflare Dashboard)
```
VITE_GOOGLE_CLIENT_ID=559924689181-rpkv8ji3029kvrtsvt3qceusmsh1i4p2.apps.googleusercontent.com
VITE_API_BASE_URL=https://plateforme-backend-production-2ec6.up.railway.app
```

### Important
- Les variables `VITE_*` sont injectées au **build time** (pas runtime)
- Après changement d'une variable → **rebuild obligatoire** sur Cloudflare
- Le fichier `_redirects` ou `_routes.json` gère le proxy vers Railway

## Auth Flow complet

### 1. Login (email/password)
```
User → Login form → POST /api/ecom/auth/login
                   → Backend vérifie credentials
                   → Retourne { token, user, workspace }
                   → Frontend stocke dans localStorage + dispatch LOGIN_SUCCESS
                   → Redirect vers dashboard
```

### 2. Login Google
```
User → Clic bouton Google → GSI prompt
     → Google retourne credential (id_token)
     → Frontend POST /api/ecom/auth/google { credential }
     → Backend vérifie id_token avec google-auth-library
     → Retourne { token, user, workspace }
     → Frontend stocke + redirect
```

### 3. Refresh automatique
```
Requête API → 401 → Intercepteur axios
            → POST /api/ecom/auth/refresh (token en header)
            → Nouveau token → Rejoue la requête originale
            → Si refresh échoue → Logout + redirect /ecom/login
```

## Fetch Wrapper — `ecommApi.js`

### Conventions obligatoires
1. **Toujours** utiliser `ecomApi` (instance axios) — jamais `fetch` ou `axios` direct
2. Le `workspaceId` est injecté automatiquement par l'intercepteur request
3. Le token est ajouté automatiquement via `Authorization: Bearer`
4. Les erreurs 401 déclenchent un refresh automatique

### Ajouter un nouveau service API
```javascript
// Dans ecommApi.js
export const newResourceApi = {
  getAll: (params = {}) => ecomApi.get('/new-resource', { params }),
  getById: (id) => ecomApi.get(`/new-resource/${id}`),
  create: (data) => ecomApi.post('/new-resource', data),
  update: (id, data) => ecomApi.put(`/new-resource/${id}`, data),
  delete: (id) => ecomApi.delete(`/new-resource/${id}`),
};
```

## Gestion des erreurs — Pattern standard
```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');

const fetchData = async () => {
  setLoading(true);
  setError('');
  try {
    const res = await someApi.getAll();
    setData(res.data.data);
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Erreur inconnue';
    setError(msg);
    console.error('❌ [Component] Erreur:', msg);
  } finally {
    setLoading(false);
  }
};
```

## Stockage du token
- **Méthode actuelle** : `localStorage.setItem('ecomToken', token)`
- **Clés** : `ecomToken`, `ecomUser`, `ecomWorkspace`
- **Alternative cookie httpOnly** : nécessite que le backend set le cookie avec `res.cookie('token', jwt, { httpOnly: true, secure: true, sameSite: 'lax' })` — le frontend n'a alors plus besoin de stocker le token

## Règles de dev
1. Les pages sont dans `ecom-frontend/src/ecom/pages/`
2. Les hooks custom dans `ecom-frontend/src/ecom/hooks/`
3. Toujours utiliser `useEcomAuth()` pour accéder à l'état auth
4. Pas de `console.log` en prod sauf pour le debug critique (préfixer avec `[Module]`)
5. TailwindCSS pour le styling — pas de CSS modules
