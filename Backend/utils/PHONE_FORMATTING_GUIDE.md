# Guide de Formatage des Numéros de Téléphone

## 🌍 Formatage Multi-Pays Automatique

Le système détecte et formate automatiquement les numéros de téléphone pour **tous les pays supportés** (160+ pays).

## ✅ Formats Acceptés

### Avec Indicatif International
```
+2376XXXXXXXX  ✅ Format international complet
2376XXXXXXXX   ✅ Sans le +
002376XXXXXXXX ✅ Avec préfixe 00
```

### Sans Indicatif (Détection Automatique)

Le système détecte automatiquement le pays basé sur des patterns :

#### 🇨🇲 Cameroun (+237)
- `6XXXXXXXX` (9 chiffres commençant par 6) → `2376XXXXXXXX`

#### 🇫🇷 France (+33)
- `06XXXXXXXX` (10 chiffres commençant par 0) → `336XXXXXXXX`
- `07XXXXXXXX` (10 chiffres commençant par 0) → `337XXXXXXXX`

#### 🇨🇮 Côte d'Ivoire (+225)
- `07XXXXXXXX` (10 chiffres commençant par 0) → `2257XXXXXXXX`
- `05XXXXXXXX` (10 chiffres commençant par 0) → `2255XXXXXXXX`

#### 🇸🇳 Sénégal (+221)
- `7XXXXXXXX` (9 chiffres commençant par 7) → `2217XXXXXXXX`

#### 🇺🇸 USA/Canada (+1)
- `5551234567` (10 chiffres) → `15551234567`

## 🧹 Nettoyage Automatique

Le système supprime automatiquement :
- ✅ Espaces : `+237 6 12 34 56 78` → `2376XXXXXXXX`
- ✅ Tirets : `+237-6-12-34-56-78` → `2376XXXXXXXX`
- ✅ Parenthèses : `+237 (6) 12 34 56 78` → `2376XXXXXXXX`
- ✅ Points : `+237.6.12.34.56.78` → `2376XXXXXXXX`
- ✅ Préfixe 00 : `002376XXXXXXXX` → `2376XXXXXXXX`

## 📋 Pays Supportés (160+)

### Afrique
- 🇨🇲 Cameroun (+237)
- 🇨🇮 Côte d'Ivoire (+225)
- 🇸🇳 Sénégal (+221)
- 🇲🇱 Mali (+223)
- 🇧🇫 Burkina Faso (+226)
- 🇳🇪 Niger (+227)
- 🇹🇬 Togo (+228)
- 🇧🇯 Bénin (+229)
- 🇬🇦 Gabon (+241)
- 🇨🇬 Congo Brazzaville (+242)
- 🇨🇩 Congo RDC (+243)
- 🇿🇦 Afrique du Sud (+27)
- 🇲🇦 Maroc (+212)
- 🇩🇿 Algérie (+213)
- 🇹🇳 Tunisie (+216)
- 🇬🇭 Ghana (+233)
- 🇳🇬 Nigéria (+234)
- ... et 30+ autres pays africains

### Europe
- 🇫🇷 France (+33)
- 🇧🇪 Belgique (+32)
- 🇨🇭 Suisse (+41)
- 🇬🇧 Royaume-Uni (+44)
- 🇮🇹 Italie (+39)
- 🇪🇸 Espagne (+34)
- 🇩🇪 Allemagne (+49)
- 🇳🇱 Pays-Bas (+31)
- 🇵🇹 Portugal (+351)
- ... et 20+ autres pays européens

### Amériques
- 🇺🇸 USA/Canada (+1)
- 🇧🇷 Brésil (+55)
- 🇲🇽 Mexique (+52)
- 🇦🇷 Argentine (+54)
- 🇨🇱 Chili (+56)
- 🇨🇴 Colombie (+57)
- ... et 10+ autres pays

### Asie & Océanie
- 🇨🇳 Chine (+86)
- 🇮🇳 Inde (+91)
- 🇯🇵 Japon (+81)
- 🇰🇷 Corée du Sud (+82)
- 🇦🇺 Australie (+61)
- 🇦🇪 Émirats Arabes (+971)
- 🇸🇦 Arabie Saoudite (+966)
- ... et 40+ autres pays

## 🚫 Numéros Rejetés

- ❌ Moins de 8 chiffres
- ❌ Numéros vides ou null
- ❌ Indicatif non reconnu sans pattern détectable
- ❌ Longueur invalide pour le pays détecté

## 📊 Logs de Debug

Lors de l'envoi d'une campagne, vous verrez :

```
🧹 [SEND] Nettoyage et formatage des X numéros de téléphone...
✅ [SEND] X numéros valides après formatage
❌ [SEND] X numéros invalides rejetés
🚫 [SEND] Numéros invalides: [liste des numéros rejetés]
```

## 💡 Recommandations

1. **Toujours inclure l'indicatif pays** pour éviter les ambiguïtés
2. **Format recommandé** : `+2376XXXXXXXX` (avec le +)
3. **Éviter les formats locaux** si possible (ex: `06...` pour la France)
4. **Vérifier les logs** en cas de rejet pour identifier les numéros problématiques

## 🔧 API de Formatage

```javascript
import { formatInternationalPhone } from './utils/phoneUtils.js';

const result = formatInternationalPhone('6 12 34 56 78');
// {
//   success: true,
//   formatted: '2376XXXXXXXX',
//   display: '+2376XXXXXXXX',
//   countryInfo: { code: 'CM', name: 'Cameroun', ... },
//   prefix: '237',
//   nationalNumber: '6XXXXXXXX'
// }
```

## ⚙️ Configuration

Pour modifier le pays par défaut ou ajouter des patterns personnalisés, éditer :
- `Backend/utils/phoneUtils.js` (lignes 214-264)
