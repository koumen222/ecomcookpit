# 📄 API de Génération de Pages Produit Avancée

## Vue d'ensemble

Système de génération de pages produit e-commerce ultra-performantes avec copywriting optimisé pour la conversion, spécialement adapté au marché africain francophone.

---

## 🎯 Endpoint

```
POST /api/ai/product-generator
```

### Headers
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

---

## 📋 Paramètres de la requête

### **Paramètres de base**

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `url` | String | Conditionnel* | URL du produit Alibaba/AliExpress à analyser |
| `description` | String | Conditionnel* | Description directe du produit (si `skipScraping=true`) |
| `skipScraping` | Boolean | Non | `true` pour mode description directe, `false` pour scraping URL |
| `images` | File[] | Oui** | Photos du produit (min 1, max 8, 10MB chacune) |

*Un seul des deux est requis selon le mode  
**Au moins 1 image requise en mode `skipScraping=true`

---

### **Paramètres de copywriting avancé** ✨

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `marketingApproach` | String | `'AIDA'` | Approche marketing principale |
| `copywritingAngle` | String | `'PROBLEME_SOLUTION'` | Angle copywriting stratégique |
| `language` | String | `'français'` | Langue de génération |
| `tone` | String | `'urgence'` | Ton de communication |
| `targetAudience` | String | - | Description détaillée de la cible client |
| `customerReviews` | String | - | Avis clients bruts à reformater |
| `socialProofLinks` | String | - | Liens vers preuves sociales (TikTok, articles, etc.) |
| `mainOffer` | String | - | Offre principale à mettre en avant |
| `objections` | String | - | Objections courantes à lever dans la FAQ |
| `keyBenefits` | String | - | Points forts spécifiques à mettre en avant |

---

## 🎨 Valeurs acceptées

### **marketingApproach**

| Valeur | Description | Structure |
|--------|-------------|-----------|
| `AIDA` | Attention → Intérêt → Désir → Action | Accroche → Curiosité → Envie → CTA |
| `PAS` | Problème → Agitation → Solution | Identifier → Amplifier → Résoudre → Preuves |
| `BAB` | Before → After → Bridge | Avant → Après → Comment → Confiance |
| `FAB` | Features → Advantages → Benefits | Caractéristique → Avantage → Bénéfice → Différence |

---

### **copywritingAngle**

| Valeur | Nom | Description |
|--------|-----|-------------|
| `PROBLEME_SOLUTION` | **Problème → Solution** | Empathie avec la douleur, puis solution évidente |
| `PREUVE_SOCIALE` | **Preuve sociale** | Résultats clients, témoignages, stats, FOMO |
| `URGENCE` | **Urgence / Rareté** | Stock limité, offre temporaire, achat immédiat |
| `TRANSFORMATION` | **Transformation** | Avant/après émotionnel, nouveau style de vie |
| `AUTORITE` | **Autorité** | Expertise, certifications, recommandations |

---

### **tone**

| Valeur | Caractéristiques |
|--------|------------------|
| `urgence` | Stock limité, preuve sociale, résultats rapides, action immédiate |
| `premium` | Qualité exceptionnelle, attention aux détails, exclusivité |
| `fun` | Enjoué, dynamique, émojis, phrases courtes, énergie positive |
| `serieux` | Professionnel, crédibilité, faits, confiance, fiabilité |

---

## 📤 Exemple de requête complète

```javascript
const formData = new FormData();

// Paramètres de base
formData.append('url', 'https://www.alibaba.com/product/.../...');
formData.append('skipScraping', 'false');

// Images (min 1, max 8)
formData.append('images', imageFile1);
formData.append('images', imageFile2);
formData.append('images', imageFile3);

// Approche marketing
formData.append('marketingApproach', 'AIDA');
formData.append('copywritingAngle', 'PROBLEME_SOLUTION');

// Copywriting avancé
formData.append('language', 'français');
formData.append('tone', 'urgence');

formData.append('targetAudience', 
  'Femmes 28-45 ans, mamans actives qui manquent de temps, ' +
  'sensibles au naturel, pouvoir d\'achat moyen, zone urbaine'
);

formData.append('customerReviews', 
  'Avis 1: "Super produit, j\'adore!"\n' +
  'Avis 2: "Résultats visibles en 5 jours"\n' +
  'Avis 3: "Je recommande à 100%"'
);

formData.append('socialProofLinks', 
  'TikTok viral: https://tiktok.com/@user/video/123456\n' +
  'Article blog: https://beauteblog.com/mon-avis\n' +
  'Instagram: @beaute_naturelle (15k followers)'
);

formData.append('mainOffer', 
  '-40% aujourd\'hui seulement + Livraison gratuite sous 48h + ' +
  'Cadeau surprise pour toute commande'
);

formData.append('objections', 
  'Ça va tenir dans le temps ?\n' +
  'Est-ce que ça fonctionne vraiment ?\n' +
  'Et si ça ne me convient pas ?\n' +
  'C\'est sûr pour la peau noire ?'
);

formData.append('keyBenefits', 
  'Sans BPA, Certifié CE, Garantie 2 ans, Support 7j/7, ' +
  'Ingrédients 100% naturels, Adapté peaux noires'
);

// Envoi
const response = await fetch('/api/ai/product-generator', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
```

---

## 📥 Format de réponse JSON

```json
{
  "success": true,
  "product": {
    "title": "Titre produit optimisé SEO",
    
    "hero_headline": "PROMESSE PRINCIPALE FORTE",
    "hero_slogan": "Sous-titre transformation + bénéfice émotionnel",
    "hero_baseline": "Phrase de réassurance avec résultat rapide",
    "hero_cta": "Je commande maintenant",
    "urgency_badge": "🔥 Plus que 12 en stock",
    
    "heroImage": "https://...",
    "heroPosterImage": "https://...",
    "beforeAfterImage": "https://...",
    
    "problem_section": {
      "title": "Vous en avez assez de... ?",
      "pain_points": [
        "Point de douleur 1 - frustration concrète",
        "Point de douleur 2 - conséquence négative",
        "Point de douleur 3 - objection courante"
      ]
    },
    
    "solution_section": {
      "title": "La solution simple et efficace",
      "description": "3-4 phrases présentant le produit comme LA solution..."
    },
    
    "benefits_bullets": [
      "💐 Bénéfice concret 1",
      "💖 Bénéfice concret 2",
      "👩‍⚕️ Bénéfice concret 3",
      "💧 Bénéfice concret 4",
      "🛡️ Bénéfice concret 5",
      "⏱️ Bénéfice concret 6",
      "✅ Bénéfice concret 7"
    ],
    
    "angles": [
      {
        "titre_angle": "Phrase complète de 10-15 mots expliquant le bénéfice",
        "explication": "3-4 phrases concrètes et persuasives...",
        "message_principal": "Accroche mémorable",
        "promesse": "Transformation concrète",
        "poster_url": "https://...",
        "index": 1
      }
    ],
    
    "stats_bar": [
      "+5 000 clients satisfaits",
      "Résultats en 7 jours",
      "Satisfait ou remboursé 30j"
    ],
    
    "testimonials": [
      {
        "name": "Mireille K.",
        "location": "Douala, Cameroun",
        "rating": 5,
        "text": "Témoignage réaliste et spécifique...",
        "verified": true,
        "date": "Il y a 3 jours"
      }
    ],
    
    "faq": [
      {
        "question": "Question fréquente",
        "reponse": "Réponse rassurante et convaincante"
      }
    ],
    
    "offer_block": {
      "offer_label": "Offre de lancement — 20% de réduction",
      "guarantee_text": "Paiement à la livraison, retour sans questions",
      "countdown": true
    },
    
    "seo": {
      "meta_title": "Titre SEO optimisé (max 60 caractères)",
      "meta_description": "Description SEO (max 155 caractères)",
      "slug": "url-produit-optimisee"
    },
    
    "raisons_acheter": [
      "Fait concret sur la qualité",
      "Bénéfice pratique mesurable",
      "Avantage différenciant",
      "Garantie ou élément de sécurité"
    ],
    
    "reassurance": {
      "titre": "Notre Garantie Qualité",
      "texte": "2-3 phrases rassurantes...",
      "points": ["Point 1", "Point 2", "Point 3"]
    },
    
    "guide_utilisation": {
      "applicable": true,
      "titre": "Comment utiliser ce produit",
      "etapes": [
        {
          "numero": 1,
          "action": "Étape courte",
          "detail": "Détail pratique"
        }
      ]
    },
    
    "realPhotos": ["https://...", "https://..."],
    "allImages": ["https://...", "https://...", "https://..."],
    
    "sourceUrl": "https://alibaba.com/...",
    "createdByAI": true,
    "generatedAt": "2026-03-31T10:30:00.000Z"
  },
  
  "generations": {
    "freeRemaining": 2,
    "paidRemaining": 0,
    "totalUsed": 1
  }
}
```

---

## 🎯 Stratégies d'utilisation

### **Pour un produit de beauté/santé**
```javascript
{
  copywritingAngle: 'TRANSFORMATION',
  tone: 'urgence',
  targetAudience: 'Femmes 25-40 ans, peaux noires, zones urbaines',
  mainOffer: '-30% + Cadeau surprise',
  objections: 'Ça fonctionne sur peau noire ? Résultats en combien de temps ?'
}
```

### **Pour un produit tech/gadget**
```javascript
{
  copywritingAngle: 'PROBLEME_SOLUTION',
  tone: 'premium',
  marketingApproach: 'FAB',
  targetAudience: 'Hommes et femmes 30-50 ans, actifs, sensibles à l'innovation'
}
```

### **Pour un produit lifestyle/mode**
```javascript
{
  copywritingAngle: 'PREUVE_SOCIALE',
  tone: 'fun',
  socialProofLinks: 'TikTok viral + Instagram influenceurs',
  mainOffer: 'Achetez 2 = 1 offert'
}
```

### **Pour un produit premium/luxe**
```javascript
{
  copywritingAngle: 'AUTORITE',
  tone: 'premium',
  marketingApproach: 'FAB',
  keyBenefits: 'Certifié, Garantie 3 ans, Support premium'
}
```

---

## 🚨 Codes d'erreur

| Code | Message | Solution |
|------|---------|----------|
| 400 | Description requise (minimum 20 caractères) | Fournir une description plus détaillée |
| 400 | Au moins une photo requise en mode description | Ajouter au moins 1 image |
| 400 | URL Alibaba requise | Fournir une URL valide |
| 403 | Limite de générations atteinte | Acheter des générations supplémentaires |
| 429 | Génération déjà en cours | Attendre la fin de la génération en cours |
| 500 | Erreur lors de la génération | Vérifier les logs serveur |

---

## 💡 Bonnes pratiques

1. **Toujours fournir targetAudience** — Plus c'est précis, meilleures sont les conversions
2. **Intégrer de vrais avis clients** via `customerReviews` — L'IA les reformatera
3. **Utiliser socialProofLinks** pour les produits viraux — Renforce la crédibilité
4. **Définir mainOffer clairement** — L'offre sera répétée stratégiquement
5. **Lister TOUTES les objections** dans `objections` — Chacune sera adressée
6. **Choisir le bon angle** selon le type de produit :
   - Beauté/Santé → `TRANSFORMATION`
   - Tech/Gadget → `PROBLEME_SOLUTION`
   - Mode/Lifestyle → `PREUVE_SOCIALE`
   - Premium → `AUTORITE`
7. **Adapter le tone** au positionnement :
   - Produit accessible → `urgence` ou `fun`
   - Produit haut de gamme → `premium`
   - Produit médical/santé → `serieux`

---

## 🎨 Visuels générés

Le système génère automatiquement 7 types de visuels :

1. **Hero Image** — Photo lifestyle premium avec produit dominant
2. **Hero Poster** — Affiche publicitaire graphique style Apple
3. **Before/After** — Transformation split-screen avec personne africaine
4. **4 Affiches d'angles** — Visuels marketing avec texte overlay

Tous les visuels incluent **obligatoirement** des personnes africaines authentiques si des humains sont montrés.

---

## ⚡ Optimisations

- **Génération parallèle** de toutes les images (6-7 images en ~15-20s)
- **Compression automatique** en 1080x1100 JPEG 92%
- **Upload R2** avec CDN global
- **Lock anti-double génération** pour éviter les duplications
- **Système de quotas** (3 gratuits + payants)

---

## 📞 Support

Pour toute question sur l'API : support@ecomcockpit.com
