#!/bin/bash
# ─── Caddy Reverse Proxy VPS Setup ──────────────────────────────────
# Run this on a fresh Ubuntu/Debian VPS (Hetzner, OVH, DigitalOcean...)
# 
# Prerequisites:
#   - A VPS with a public IP
#   - Ports 80 and 443 open in firewall
#   - Docker installed
#
# Usage:
#   1. SSH into your VPS
#   2. git clone your repo (or just copy the caddy-proxy/ folder)
#   3. Edit .env with your values
#   4. Run: bash setup.sh

set -e

echo "🚀 Caddy Reverse Proxy Setup"
echo "============================="

# ── Install Docker if not present ──
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installed"
fi

# ── Install Docker Compose plugin if not present ──
if ! docker compose version &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    apt-get update && apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose installed"
fi

# ── Create .env if not exists ──
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Your Railway backend URL (Railway app)
RAILWAY_BACKEND=https://ecomcookpit-production-0ec4.up.railway.app

# URL Caddy calls to validate domains (your Railway API)
CADDY_ASK_URL=https://api.scalor.net/api/caddy/check-domain

# Email for Let's Encrypt certificates
ACME_EMAIL=admin@scalor.net

# Optional: shared secret between Caddy and backend (leave empty to disable)
# CADDY_AUTH_TOKEN=your-secret-token-here
EOF
    echo "⚠️  Edit .env with your values, then run this script again."
    exit 0
fi

# ── Open firewall ports ──
if command -v ufw &> /dev/null; then
    echo "🔒 Opening firewall ports 80, 443..."
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 443/udp  # HTTP/3
fi

# ── Start Caddy ──
echo "🚀 Starting Caddy reverse proxy..."
docker compose up -d

echo ""
echo "✅ Caddy is running!"
echo ""
echo "📋 Next steps:"
echo "   1. Note your VPS public IP: $(curl -s ifconfig.me 2>/dev/null || echo '<your-vps-ip>')"
echo "   2. Update your app's DNS instructions to point custom domains to this IP"
echo "   3. Customers create an A record: @ → <VPS_IP>"
echo "   4. Caddy auto-provisions SSL certificates on first request"
echo ""
echo "📊 Check logs:  docker compose logs -f"
echo "🔄 Restart:     docker compose restart"
echo "🛑 Stop:        docker compose down"
