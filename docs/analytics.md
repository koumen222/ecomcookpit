# PostHog Analytics — Ecom Cockpit

## Architecture

```
src/ecom/services/posthog.js    ← Module unique (init, identify, track, reset, consent)
src/ecom/hooks/usePosthogPageViews.js ← Hook React Router (pageview + page_duration)
```

PostHog est intégré **à côté** de l'analytics backend existant (`services/analytics.js`).  
Si `VITE_POSTHOG_KEY` n'est pas défini, tout est **no-op** : aucun crash, aucun appel réseau.

---

## Variables d'environnement

| Variable | Obligatoire | Défaut | Description |
|---|---|---|---|
| `VITE_POSTHOG_KEY` | Oui (sinon désactivé) | — | Clé projet PostHog (`phc_...`) |
| `VITE_POSTHOG_HOST` | Non | `https://app.posthog.com` | URL de l'instance PostHog |

Ajouter dans `.env.local` ou `.env.production` :

```env
VITE_POSTHOG_KEY=phc_VOTRE_CLE_ICI
VITE_POSTHOG_HOST=https://app.posthog.com
```

> Pour CRA (si migration future) : `REACT_APP_POSTHOG_KEY` et `REACT_APP_POSTHOG_HOST` sont aussi supportés.

---

## Ce qui est tracké automatiquement

| # | Métrique | Comment |
|---|---|---|
| 1 | **Visites / sessions** | PostHog crée automatiquement des sessions |
| 2 | **Session duration** | Calculé par PostHog via `capture_pageleave: true` |
| 3 | **Pageviews** | `$pageview` envoyé à chaque changement de route (`usePosthogPageViews`) |
| 4 | **Temps par page** | Event custom `page_duration` avec `{ path, durationMs, durationSec, workspaceId }` |
| 5 | **Clics / heatmaps** | `autocapture: true` — PostHog capture les clics, inputs, etc. |
| 6 | **Rétention / cohortes** | Configuré dans le dashboard PostHog via les events `login_success`, `$pageview` |
| 7 | **Pays / ville / device** | Automatique côté PostHog (GeoIP sur l'IP du client) |

---

## Events custom envoyés

| Event | Quand | Props |
|---|---|---|
| `login_success` | Login email / Google | `{ workspaceId, method? }` |
| `register_success` | Inscription | `{ workspaceId }` |
| `workspace_created` | Création workspace | `{ workspaceId }` |
| `workspace_joined` | Rejoindre workspace | `{ workspaceId }` |
| `page_duration` | Changement de route / fermeture | `{ path, durationMs, durationSec, workspaceId }` |
| `$pageview` | Chaque route | `{ $current_url, path }` |

---

## Identification utilisateur

Après chaque login / register / chargement de profil :

```js
posthog.identify(user._id, { email, name, role })
posthog.group('workspace', workspace._id, { name, plan, workspaceId })
```

Au **logout** : `posthog.reset()` — le prochain utilisateur sera anonyme.

---

## Groupes (multi-workspace)

PostHog group analytics est utilisé avec le type `workspace`.  
Cela permet dans le dashboard PostHog de :
- Filtrer les métriques **par workspace**
- Voir la rétention / usage **par workspace**
- Comparer les plans (free vs pro, etc.)

Le group est mis à jour automatiquement quand l'utilisateur :
- Se connecte
- Crée un workspace
- Rejoint un workspace

---

## Privacy & sécurité

### Masquage automatique
- Les champs `type="password"` sont masqués dans les session recordings
- Les éléments avec `data-ph-no-capture` sont **exclus** du recording

### Sanitization des propriétés
Les clés contenant `password`, `token`, `credit_card`, `card_number`, `cvv`, `secret` sont **automatiquement supprimées** de tous les events.

### Exclure un élément de l'autocapture
Ajouter l'attribut sur n'importe quel élément HTML :

```html
<input type="text" data-ph-no-capture />
<div data-ph-no-capture>Contenu sensible</div>
```

### Consentement (bandeau cookies)
- Si l'utilisateur **accepte** → `posthog.opt_in_capturing()`
- Si l'utilisateur **refuse** → `posthog.opt_out_capturing()`
- Le bandeau existant (`PrivacyBanner.jsx`) est déjà branché.

### Do Not Track
`respect_dnt: true` — si le navigateur a DNT activé, PostHog ne capture rien.

---

## API du module `posthog.js`

```js
import {
  initAnalytics,    // Appeler 1 fois au démarrage (main.jsx)
  identifyUser,     // Appeler après login (user, workspace)
  track,            // Envoyer un event custom (event, props)
  resetAnalytics,   // Appeler au logout
  setConsent,       // Activer/désactiver (true/false)
  getPosthog,       // Accès direct à l'instance posthog (escape hatch)
} from './services/posthog.js';
```

### Tracker un event custom depuis n'importe quel composant

```js
import { track } from '../services/posthog.js';

// Exemple
track('product_added', { productId: '123', price: 29.99 });
track('report_exported', { format: 'pdf', reportId: '456' });
```

---

## FAQ

### PostHog ne track rien en dev ?
Vérifier que `VITE_POSTHOG_KEY` est défini dans `.env.local`. Sans cette variable, le module est **entièrement no-op**.

### Double-init ?
Impossible : un guard `_initialized` empêche toute ré-initialisation.

### Ça casse la build si je n'ai pas la clé ?
Non. Sans `VITE_POSTHOG_KEY`, toutes les fonctions sont des no-ops silencieux. Un `console.warn` est affiché une seule fois.

### Comment voir les heatmaps ?
Activer **Session Recording** dans le dashboard PostHog (Settings → Session Recording). L'autocapture + recordings sont pré-configurés côté client.

### Comment ajouter un nouvel event ?
```js
import { track } from '../services/posthog.js';
track('mon_event', { clé: 'valeur' });
```
C'est tout. L'event apparaîtra automatiquement dans PostHog.
