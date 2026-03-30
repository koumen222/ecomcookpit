# 🎨 Configuration Google Imagen API pour Génération d'Images

## 📋 Vue d'ensemble

Le système utilise maintenant **Google Imagen 3** (le dernier modèle) via l'API NanoBanana pour générer toutes les images marketing des pages produit.

---

## 🔑 Clé API Configurée

**Clé API Google Imagen :** `AIzaSyBMhUariTC0fSNx1b9mKGkXzcslGnyWDpk`

Cette clé est configurée dans :
- `Backend/services/nanoBananaService.js` (hardcodée en fallback)
- `Backend/.env.example` (documentation)
- Variable d'environnement `NANOBANANA_API_KEY` (production)

---

## 🖼️ Types d'Images Générées

### 1. **Hero Image** (Image principale)
- Produit réel visible au premier plan
- Personne africaine authentique (si produit d'usage humain)
- Fond premium (blanc, beige, ou contexte chaleureux)
- Format carré 1:1, qualité 4K
- Cadrage serré plein cadre

### 2. **Avant/Après** (Transformation)
- Split-screen carré 1:1
- Personne africaine authentique (obligatoire)
- Gauche = AVANT (problème)
- Droite = APRÈS (résultat)
- Transformation réaliste et crédible

### 3. **4 Affiches Marketing** (Angles)
- Visuels illustratifs avec personnes africaines
- Produit visible ou résultat montré
- Court texte overlay en français (4-6 mots max)
- Format carré 1:1
- Style publicitaire scroll-stopping

---

## 🛠️ Fonctionnement Technique

### Architecture

```
ProductPageGeneratorModal (Frontend)
    ↓
productPageGeneratorService.js (Backend)
    ↓
analyzeWithVision() → Génère les prompts
    ↓
generatePosterImage() → Appelle NanoBanana
    ↓
nanoBananaService.js → Google Imagen 3
    ↓
Images générées et uploadées sur R2
```

### Paramètres de Génération

**Text-to-Image :**
```javascript
{
  prompt: "Description détaillée en anglais...",
  numImages: 1,
  type: 'TEXTTOIAMGE',
  image_size: '1:1',
  watermark: 'NanoBanana',
  model: 'google-imagen-3' // Dernier modèle
}
```

**Image-to-Image :**
```javascript
{
  prompt: "Description de la transformation...",
  numImages: 1,
  type: 'IMAGETOIAMGE',
  image_size: '1:1',
  imageUrls: ['https://...'], // Image de référence
  watermark: 'NanoBanana',
  model: 'google-imagen-3' // Dernier modèle
}
```

---

## 📊 Workflow de Génération

### Étape 1 : Création de la tâche
```bash
POST https://api.nanobananaapi.ai/api/v1/nanobanana/generate
Authorization: Bearer AIzaSyBMhUariTC0fSNx1b9mKGkXzcslGnyWDpk
```

**Réponse :**
```json
{
  "code": 200,
  "data": {
    "taskId": "abc123..."
  }
}
```

### Étape 2 : Polling du statut
```bash
GET https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=abc123
```

**Polling :**
- Intervalle : 2 secondes
- Max tentatives : 30 (60 secondes total)
- Timeout : 10 secondes par requête

### Étape 3 : Récupération de l'image
```json
{
  "code": 200,
  "data": {
    "successFlag": 1,
    "response": {
      "resultImageUrl": "https://..."
    }
  }
}
```

### Étape 4 : Téléchargement et conversion
- Téléchargement de l'image depuis l'URL
- Conversion en base64
- Upload vers Cloudflare R2
- Retour de l'URL finale

---

## 🎯 Prompts Optimisés pour Marché Africain

### Hero Image
```
High-converting ecommerce hero image for [PRODUCT]. 
Ultra realistic, 4K, advertising photography. 
Product clearly visible center/foreground. 
Include authentic Black African model (dark brown skin, natural hair, 
African features) with confident/satisfied expression. 
Clean premium background (white, beige, or warm contextual). 
Professional studio lighting, soft shadows, depth of field. 
Square 1:1, tight crop, full-bleed framing, ZERO empty margins.
No paragraphs, no CTA, no price. Scroll-stopping, trustworthy, premium.
```

### Avant/Après
```
Square 1:1 split-screen before/after transformation for [PRODUCT]. 
MANDATORY: authentic Black African person (dark brown skin, natural hair, 
African features, realistic skin). 
LEFT = BEFORE: person showing the problem/frustration this product solves. 
RIGHT = AFTER: same person showing the result — improvement, confidence, glow. 
Professional lighting, clean premium aesthetic, 4K quality. 
Small bold 'Avant'/'Après' label if helpful. 
No arrows, no heavy overlays. Convincing, high-conversion, scroll-stopping.
```

### Affiches Marketing
```
Scroll-stopping ecommerce ad image, square 1:1, ultra realistic, 4K. 
Authentic Black African model (dark brown skin, natural hair, African features) 
using or benefiting from [PRODUCT] in real-life scene. 
Product clearly visible or result shown. 
Clean premium background, professional lighting, soft shadows. 
Visual storytelling: problem → product → result. 
Bold French headline (4-5 words max, modern font) at top or bottom. 
No price, no phone, no CTA, no URL. Trustworthy, premium, high-conversion.
```

---

## ⚙️ Configuration Environnement

### Development (.env local)
```bash
NANOBANANA_API_KEY=AIzaSyBMhUariTC0fSNx1b9mKGkXzcslGnyWDpk
```

### Production (Railway/Render)
Ajouter la variable d'environnement :
```
NANOBANANA_API_KEY=AIzaSyBMhUariTC0fSNx1b9mKGkXzcslGnyWDpk
```

---

## 🚀 Utilisation

### Génération automatique
Lors de la génération d'un produit via le modal :
1. L'IA analyse le produit
2. Génère 7 prompts d'images optimisés
3. Appelle Google Imagen 3 pour chaque image
4. Upload les images sur R2
5. Associe les URLs au produit

### Temps de génération
- **Hero Image** : ~15-30 secondes
- **Avant/Après** : ~15-30 secondes
- **4 Affiches** : ~60-120 secondes (4 x 15-30s)
- **Total** : ~90-180 secondes pour toutes les images

---

## 📈 Avantages Google Imagen 3

### Qualité
- ✅ Réalisme photographique supérieur
- ✅ Meilleure compréhension des prompts complexes
- ✅ Génération de personnes africaines authentiques
- ✅ Respect des contraintes de composition

### Performance
- ✅ Génération rapide (15-30s par image)
- ✅ Haute résolution (4K)
- ✅ Cohérence visuelle entre les images

### Adaptation Marché Africain
- ✅ Peaux noires/marron réalistes
- ✅ Traits africains authentiques
- ✅ Contextes locaux crédibles
- ✅ Pas de biais occidental

---

## 🔍 Monitoring et Debug

### Logs de génération
```bash
🎨 Generating image with Google Imagen API (via NanoBanana)...
✅ NanoBanana task created: abc123...
⏳ Polling NanoBanana task abc123...
📊 Task abc123 successFlag: 1 (attempt 5/30)
✅ NanoBanana image generated: https://...
```

### Erreurs courantes

**Erreur : API key not configured**
→ Vérifier que `NANOBANANA_API_KEY` est définie

**Erreur : Task timeout**
→ Augmenter `maxAttempts` dans `pollNanoBananaTask()`

**Erreur : Invalid image URL**
→ Vérifier que l'upload R2 fonctionne correctement

---

## 📞 Support

Pour toute question sur la configuration Google Imagen API, contacter l'équipe technique Scalor.

**Dernière mise à jour :** Mars 2026
**Version API :** Google Imagen 3 (dernier modèle)
