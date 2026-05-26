#!/bin/bash

echo "🚀 Démarrage de l'environnement local EcomCookpit..."

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js d'abord."
    exit 1
fi

# Vérifier si le dossier Backend existe
if [ ! -d "Backend" ]; then
    echo "❌ Dossier Backend non trouvé. Veuillez vous assurer d'être dans le bon répertoire."
    exit 1
fi

# Démarrer le backend en arrière-plan
echo "🔧 Démarrage du backend (port 8080)..."
cd Backend
npm install
npm run dev &
BACKEND_PID=$!
cd ..

# Attendre que le backend soit réellement prêt (health check)
echo "⏳ Attente du backend (health check sur http://localhost:8080/health)..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Backend prêt !"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "⚠️  Backend non disponible après ${MAX_RETRIES}s — le frontend démarrera quand même."
        echo "   Les requêtes API seront retentées automatiquement."
    fi
    sleep 1
done

# Démarrer le frontend
echo "🎨 Démarrage du frontend (port 5173)..."
npm install
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Environnement local démarré !"
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:8080"
echo ""
echo "Pour arrêter, appuyez sur Ctrl+C"

# Attendre Ctrl+C
trap "echo '🛑 Arrêt des serveurs...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
