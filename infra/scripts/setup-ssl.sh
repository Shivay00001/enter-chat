#!/bin/bash
# ============================================
# SSL certificate setup using Let's Encrypt
# Run once on server setup, then auto-renews via cron
# ============================================

set -euo pipefail

DOMAIN="enterchat.app"
EMAIL="admin@enterchat.app"
WEBROOT="/var/www/certbot"

echo "🔒 Setting up SSL certificates for $DOMAIN..."

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    apt-get update && apt-get install -y certbot
fi

# Create webroot directory
mkdir -p $WEBROOT

# Request certificate (includes www + api + ws subdomains)
certbot certonly \
    --webroot \
    --webroot-path=$WEBROOT \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN \
    -d api.$DOMAIN \
    -d ws.$DOMAIN

# Set up auto-renewal cron (runs twice daily)
echo "⏰ Setting up auto-renewal cron..."
(crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet --post-hook 'nginx -s reload'") | crontab -

echo "✅ SSL certificates installed and auto-renewal configured!"
echo ""
echo "Domain mapping:"
echo "  enterchat.app      → Website (Privacy Policy, Terms, etc.)"
echo "  api.enterchat.app  → REST API Gateway"
echo "  ws.enterchat.app   → WebSocket Gateway"
echo ""
echo "Next: Update DNS A records to point all domains to your server IP."
