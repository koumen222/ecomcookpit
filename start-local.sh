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

# Attendre que le backend démarre
echo "⏳ Attente du démarrage du backend..."
sleep 5

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
