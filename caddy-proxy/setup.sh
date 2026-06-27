#!/bin/bash
# ─── Scalor — Caddy Reverse Proxy Setup ──────────────────────────────────────
#
# À lancer UNE SEULE FOIS sur un VPS Ubuntu/Debian propre.
# Ce script installe Docker, configure Caddy, et démarre le proxy.
#
# Prérequis :
#   - VPS avec IP publique (Hetzner, OVH, DigitalOcean, Vultr...)
#   - Ports 80 et 443 ouverts dans le firewall
#   - DNS de scalor.net : enregistrement A  origin → cette IP VPS
#
# Usage :
#   1. SSH sur le VPS
#   2. git clone le repo (ou copier juste le dossier caddy-proxy/)
#   3. cd caddy-proxy/
#   4. Éditer .env avec les vraies valeurs
#   5. bash setup.sh

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Scalor — Caddy Reverse Proxy Setup     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Docker ──────────────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "📦 Installation de Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installé"
else
    echo "✅ Docker déjà présent ($(docker --version))"
fi

if ! docker compose version &> /dev/null; then
    echo "📦 Installation de Docker Compose..."
    apt-get update -q && apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose installé"
else
    echo "✅ Docker Compose déjà présent"
fi

# ── .env ─────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    echo ""
    echo "📝 Création du fichier .env..."
    cat > .env << 'EOF'
# Backend Railway — URL cible pour le proxy
RAILWAY_BACKEND=https://ecomcookpit-production-0ec4.up.railway.app

# URL que Caddy appelle pour valider un domaine avant d'émettre le certificat
CADDY_ASK_URL=https://api.scalor.net/api/caddy/check-domain

# Token partagé Caddy ↔ backend (doit correspondre à CADDY_AUTH_TOKEN dans Backend/.env)
CADDY_AUTH_TOKEN=CHANGE_ME_SAME_AS_BACKEND

# Token API Cloudflare avec les permissions Zone:Read et DNS:Edit sur scalor.net.
# Requis pour émettre le certificat wildcard *.scalor.net via DNS-01.
CF_API_TOKEN=CHANGE_ME_CLOUDFLARE_DNS_TOKEN

# Email Let's Encrypt
ACME_EMAIL=admin@scalor.net
EOF
    echo ""
    echo "⚠️  Fichier .env créé avec les valeurs par défaut."
    echo "   Vérifiez que RAILWAY_BACKEND, CADDY_AUTH_TOKEN et CF_API_TOKEN sont corrects."
    echo "   Relancez ce script quand c'est prêt."
    echo ""
    exit 0
fi

set -a
source .env
set +a

if [ -z "${CADDY_AUTH_TOKEN:-}" ] || [ "$CADDY_AUTH_TOKEN" = "CHANGE_ME_SAME_AS_BACKEND" ]; then
    echo "❌ CADDY_AUTH_TOKEN manquant dans .env"
    echo "   Mets le même token que CADDY_AUTH_TOKEN côté Backend/Railway."
    exit 1
fi

if [ -z "${CF_API_TOKEN:-}" ] || [ "$CF_API_TOKEN" = "CHANGE_ME_CLOUDFLARE_DNS_TOKEN" ]; then
    echo "❌ CF_API_TOKEN manquant dans .env"
    echo "   Crée un token Cloudflare avec Zone:Read + DNS:Edit sur scalor.net."
    echo "   Sans ce token, le TLS de *.scalor.net bloque les boutiques comme radia.scalor.net."
    exit 1
fi

echo "🔎 Vérification des permissions Cloudflare DNS..."
CF_ZONE_CHECK=$(curl -fsS -H "Authorization: Bearer ${CF_API_TOKEN}" \
    "https://api.cloudflare.com/client/v4/zones?name=scalor.net" 2>/dev/null || true)

if ! echo "$CF_ZONE_CHECK" | grep -q '"success":true'; then
    echo "❌ CF_API_TOKEN invalide ou incapable de lire la zone scalor.net."
    exit 1
fi

if ! echo "$CF_ZONE_CHECK" | grep -q '#dns_records:edit'; then
    echo "❌ CF_API_TOKEN n'a pas la permission DNS:Edit sur scalor.net."
    echo "   Permissions requises: Zone:Read + DNS:Edit pour la zone scalor.net."
    exit 1
fi

# ── Firewall ─────────────────────────────────────────────────────────────────
if command -v ufw &> /dev/null; then
    echo "🔒 Ouverture des ports 80 et 443..."
    ufw allow 80/tcp  2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    ufw allow 443/udp 2>/dev/null || true
    echo "✅ Ports ouverts"
fi

# ── Démarrage Caddy ───────────────────────────────────────────────────────────
echo ""
echo "🚀 Build et démarrage de Caddy..."
docker compose build --pull caddy
docker compose up -d --remove-orphans
echo ""

VPS_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s api.ipify.org 2>/dev/null || echo "<ip-du-vps>")

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║   ✅  Caddy est opérationnel !                                   ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "📌  IP de ce VPS : $VPS_IP"
echo ""
echo "─── DNS à configurer côté Scalor (scalor.net) ───────────────────────"
echo "   Chez Cloudflare (ou votre registrar pour scalor.net) :"
echo "   TYPE   NOM       VALEUR"
echo "   A      origin    $VPS_IP    ← proxy OFF (nuage gris)  [IP: 89.117.58.183]"
echo ""
echo "─── Instructions pour les clients Scalor ────────────────────────────"
echo "   Pour connecter votredomaine.com à Scalor :"
echo ""
echo "   RECOMMANDÉ — Enregistrement A (fonctionne partout, SSL automatique)"
echo "   TYPE    NOM   VALEUR"
echo "   A       @     $VPS_IP"
echo "   CNAME   www   votredomaine.com"
echo ""
echo ""
echo "─── Commandes utiles ────────────────────────────────────────────────"
echo "   Logs en temps réel : docker compose logs -f"
echo "   Redémarrer         : docker compose restart"
echo "   Arrêter            : docker compose down"
echo "   Mettre à jour      : docker compose build --pull caddy && docker compose up -d --remove-orphans"
echo ""
