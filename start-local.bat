@echo off
echo 🚀 Démarrage de l'environnement local EcomCookpit...

REM Vérifier si Node.js est installé
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js n'est pas installé. Veuillez installer Node.js d'abord.
    pause
    exit /b 1
)

REM Vérifier si le dossier Backend existe
if not exist "Backend" (
    echo ❌ Dossier Backend non trouvé. Veuillez vous assurer d'être dans le bon répertoire.
    pause
    exit /b 1
)

REM Démarrer le backend en arrière-plan
echo 🔧 Démarrage du backend (port 8080)...
cd Backend
call npm install
start /B npm run dev
cd ..

REM Attendre que le backend démarre
echo ⏳ Attente du démarrage du backend...
timeout /t 5 /nobreak >nul

REM Démarrer le frontend
echo 🎨 Démarrage du frontend (port 5173)...
call npm install
start npm run dev

echo.
echo ✅ Environnement local démarré !
echo 📱 Frontend: http://localhost:5173
echo 🔧 Backend:  http://localhost:8080
echo.
echo Pour arrêter, fermez les fenêtres de terminal
pause
