# Icônes PWA - Safitech

Ce dossier contient les icônes pour la PWA (Progressive Web App).

## Source
Image originale: ChatGPT_Image_15_févr._2026__22_02_01-removebg-preview.png

## Tailles générées:
- 72x72px - icon-72x72.png
- 96x96px - icon-96x96.png
- 128x128px - icon-128x128.png
- 144x144px - icon-144x144.png
- 152x152px - icon-152x152.png
- 192x192px - icon-192x192.png
- 384x384px - icon-384x384.png
- 512x512px - icon-512x512.png

## Pour un rendu parfait:

### Option 1: Utiliser Sharp (Node.js)
```bash
npm install sharp
node resize-icons.js
```

### Option 2: Outils en ligne
1. Allez sur https://www.pwabuilder.com/imageGenerator
2. Uploadez votre logo original
3. Téléchargez le pack complet
4. Remplacez les fichiers dans ce dossier

### Option 3: Photoshop/GIMP
1. Ouvrez l'image originale
2. Redimensionnez aux tailles requises
3. Assurez-vous que le logo reste visible
4. Exportez en PNG avec fond transparent

## Installation:
Les icônes sont automatiquement détectées par:
- manifest.json
- Service Worker
- Navigateurs mobiles

## Test:
1. Ouvrez le site sur mobile
2. Vous devriez voir "Ajouter à l'écran d'accueil"
3. L'icône apparaîtra sur votre téléphone comme une vraie app
