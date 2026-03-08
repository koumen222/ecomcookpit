# Générateur de Noms de Domaine - Documentation

## Overview

La fonctionnalité de génération automatique de noms de domaine permet de transformer le nom d'une boutique en un domaine web au format `nom-boutique.scalor.net`.

## Fonctionnalités

### 🚀 Génération Automatique
- Convertit automatiquement le nom de la boutique en sous-domaine URL-friendly
- Gère les caractères spéciaux et les accents
- Remplace les espaces par des tirets
- Limite à 30 caractères maximum

### ✅ Vérification de Disponibilité
- Vérifie en temps réel si le sous-domaine est disponible
- Ajoute automatiquement des suffixes numériques si le domaine est pris
- Gère les sous-domaines réservés (www, api, admin, etc.)

### 🌐 Format Standard
- Format: `{nom-boutique}.scalor.net`
- HTTPS automatique et gratuit
- Compatible avec toutes les fonctionnalités de la plateforme

## Implémentation Technique

### Backend (`Backend/routes/storeManagement.js`)

#### Nouvelle route: `POST /store-manage/generate-subdomain`

```javascript
// Corps de la requête
{
  "storeName": "Ma Belle Boutique"
}

// Réponse réussie
{
  "success": true,
  "data": {
    "subdomain": "ma-belle-boutique",
    "fullDomain": "ma-belle-boutique.scalor.net",
    "storeUrl": "https://ma-belle-boutique.scalor.net"
  }
}
```

#### Fonction de transformation

```javascript
function generateSubdomainFromStoreName(storeName) {
  return storeName
    .toLowerCase()
    .normalize('NFD')                    // Remove accents
    .replace(/[\u0300-\u036f]/g, '')     // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '')         // Keep only letters, numbers, spaces
    .replace(/\s+/g, '-')                 // Replace spaces with hyphens
    .replace(/-+/g, '-')                  // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')                // Remove leading/trailing hyphens
    .substring(0, 30);                    // Limit to 30 chars
}
```

### Frontend

#### Pages modifiées:
1. **`BoutiqueDomains.jsx`** - Page de configuration des domaines
2. **`StoreSetup.jsx`** - Page de configuration de la boutique

#### Nouvelle page de démo:
- **`DomainGeneratorDemo.jsx`** - Page de démonstration interactive

## Utilisation

### Dans BoutiqueDomains.jsx

L'utilisateur peut:
1. Cliquer sur "Générer depuis le nom"
2. Le système utilise le nom de la boutique configuré
3. Affiche le domaine généré et demande confirmation
4. Sauvegarde automatiquement si confirmé

### Dans StoreSetup.jsx

L'utilisateur peut:
1. Entrer le nom de sa boutique
2. Cliquer sur "Générer depuis le nom de la boutique"
3. Le sous-domaine est automatiquement rempli
4. Vérification de disponibilité en temps réel

### Via API Directe

```javascript
const response = await api.post('/store-manage/generate-subdomain', {
  storeName: 'Nom de ma boutique'
});

const { subdomain, fullDomain, storeUrl } = response.data.data;
```

## Exemples de Transformation

| Nom de la boutique | Domaine généré |
|-------------------|----------------|
| "Ma Belle Boutique" | `ma-belle-boutique.scalor.net` |
| "Café du Coin" | `cafe-du-coin.scalor.net` |
| "Électronique Plus" | `electronique-plus.scalor.net` |
| "Fashion Store" | `fashion-store.scalor.net` |
| "Librairie Paris" | `librairie-paris.scalor.net` |

## Gestion des Conflits

### Sous-domaines réservés
```
www, api, app, admin, dashboard, mail, ftp,
store, shop, scalor, help, support, docs, blog,
static, cdn, assets, dev, staging, test
```

### Stratégie de résolution
1. Si le domaine est réservé: ajoute `-1`, `-2`, etc.
2. Si le domaine est pris: ajoute `-1`, `-2`, etc.
3. Maximum 99 tentatives avant d'échouer

## Intégration avec le Workflow Existant

### 1. Création de boutique
- L'utilisateur entre le nom de sa boutique
- Le système peut générer automatiquement le domaine
- L'utilisateur peut modifier manuellement si souhaité

### 2. Import Alibaba
- Lors de l'import de produits, le nom peut être utilisé pour générer le domaine
- Intégration transparente avec le flux d'import existant

### 3. Configuration avancée
- L'utilisateur garde le contrôle manuel si nécessaire
- Possibilité de configurer des domaines personnalisés
- Gestion DNS et SSL automatique

## Sécurité et Validation

### Validation côté serveur
- Nettoyage des entrées utilisateur
- Vérification des caractères autorisés
- Protection contre les injections

### Rate limiting
- Limitation des requêtes de génération
- Protection contre les abus

## Tests

### Cas de test
1. **Noms simples**: "Boutique" → `boutique.scalor.net`
2. **Noms avec accents**: "Café" → `cafe.scalor.net`
3. **Noms avec caractères spéciaux**: "Ma&Boutique!" → `maboutique.scalor.net`
4. **Noms longs**: "Nom Très Long De Boutique" → `nom-tres-long-de-boutiqu.scalor.net`
5. **Domaines réservés**: "admin" → `admin-1.scalor.net`
6. **Domaines pris**: Simulation avec suffixe numérique

## Monitoring

### Métriques à surveiller
- Nombre de générations par jour
- Taux de succès vs échecs
- Temps de réponse moyen
- Domaines les plus populaires

## Évolutions Futures

### Améliorations possibles
1. **Suggestion intelligente**: Basée sur la catégorie de produits
2. **Validation SEO**: Intégration avec des outils SEO
3. **Domaines premium**: Offrir des extensions .com, .shop, etc.
4. **Analytics**: Intégration avec Google Analytics automatique

### Internationalisation
- Support de caractères internationaux (IDN)
- Gestion des noms dans différentes langues
- Adaptation culturelle des transformations

---

Cette fonctionnalité améliore significativement l'expérience utilisateur en automatisant la création de domaines professionnels pour les boutiques sur la plateforme Scalor.
