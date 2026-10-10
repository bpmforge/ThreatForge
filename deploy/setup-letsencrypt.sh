#!/bin/bash
#
# Setup Let's Encrypt SSL certificates using certbot
#
# Usage:
#   ./deploy/setup-letsencrypt.sh your-domain.com [email@example.com]
#

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" ]]; then
    echo "Usage: $0 <domain> [email]"
    echo "Example: $0 flowthreat.example.com admin@example.com"
    exit 1
fi

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt-get update -qq
    apt-get install -y -qq certbot
fi

# Stop nginx if running (to free port 80)
docker compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

# Get certificate
echo "Obtaining certificate for: $DOMAIN"
if [[ -n "$EMAIL" ]]; then
    certbot certonly --standalone -d "$DOMAIN" -d "www.$DOMAIN" \
        --non-interactive --agree-tos --email "$EMAIL"
else
    certbot certonly --standalone -d "$DOMAIN" -d "www.$DOMAIN" \
        --non-interactive --agree-tos --register-unsafely-without-email
fi

# Copy certificates to nginx directory
CERT_DIR="./nginx/certs"
mkdir -p "$CERT_DIR"

cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/"
cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/"

chmod 600 "$CERT_DIR/privkey.pem"
chmod 644 "$CERT_DIR/fullchain.pem"

echo ""
echo "Certificates installed to $CERT_DIR"
echo ""

# Setup auto-renewal
echo "Setting up automatic renewal..."
cat > /etc/cron.d/certbot-renew <<EOF
0 3 * * * root certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/$DOMAIN/*.pem $PWD/$CERT_DIR/ && docker compose -f $PWD/docker-compose.prod.yml restart nginx"
EOF

echo "Auto-renewal configured (runs daily at 3 AM)"
echo ""
echo "Start the application with:"
echo "  docker compose -f docker-compose.prod.yml up -d"
