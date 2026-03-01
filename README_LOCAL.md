# 🚀 Démarrage Local EcomCookpit

## Configuration rapide

### 1. Variables d'environnement

**Backend (Backend/.env.local) :**
```bash
# Copiez et configurez les variables nécessaires
cp Backend/.env.local Backend/.env
```

Variables requises pour le product generator :
- `OPENAI_API_KEY` : Clé OpenAI (nécessaire pour GPT-5.2 et gpt-image-1)
- `SCRAPE_DO_TOKEN` : Token Scrape.do pour scraper Alibaba
- `MONGO_URI` : Votre base de données MongoDB
- `GOOGLE_CLIENT_ID` : Client ID Google OAuth

**Frontend (.env.local) :**
```bash
# Déjà configuré pour utiliser le backend local
VITE_API_URL=http://localhost:8080/api/ecom
VITE_BACKEND_URL=http://localhost:8080
```

### 2. Démarrage rapide

**Windows :**
```bash
start-local.bat
```

**Mac/Linux :**
```bash
chmod +x start-local.sh
./start-local.sh
```

**Ou manuellement :**

Terminal 1 (Backend) :
```bash
cd Backend
npm install
npm run dev
```

Terminal 2 (Frontend) :
```bash
npm install
npm run dev
```

### 3. Accès

- 📱 Frontend : http://localhost:5173
- 🔧 Backend : http://localhost:8080
- 📚 API Docs : http://localhost:8080/api/ecom/diagnostics

## Product Generator Local

Le product generator utilise maintenant :
- **GPT-5.2** pour l'analyse et copywriting
- **gpt-image-1** pour les images marketing
- **5 benefits** avec images générées automatiquement

## Dépannage

**Backend ne démarre pas :**
- Vérifiez que le port 8080 est libre
- Configurez les variables d'environnement dans `Backend/.env`

**Frontend ne se connecte pas :**
- Assurez-vous que le backend fonctionne sur http://localhost:8080
- Vérifiez le fichier `.env.local` à la racine

**Product Generator ne fonctionne pas :**
- Vérifiez `OPENAI_API_KEY` dans `Backend/.env`
- Vérifiez `SCRAPE_DO_TOKEN` pour le scraping Alibaba

## Développement

Le proxy Vite est configuré pour rediriger :
- `/api/*` → `http://localhost:8080/api/*`
- `/socket.io` → `http://localhost:8080/socket.io`

Le CORS est configuré pour autoriser `http://localhost:5173`.
