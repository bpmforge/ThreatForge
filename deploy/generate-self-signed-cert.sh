#!/bin/bash
#
# Generate self-signed SSL certificate for testing
# NOT for production use!
#

set -euo pipefail

CERT_DIR="${1:-./nginx/certs}"
DOMAIN="${2:-localhost}"

mkdir -p "$CERT_DIR"

echo "Generating self-signed certificate for: $DOMAIN"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN,IP:127.0.0.1"

chmod 600 "$CERT_DIR/privkey.pem"
chmod 644 "$CERT_DIR/fullchain.pem"

echo "Certificate generated:"
echo "  - $CERT_DIR/fullchain.pem"
echo "  - $CERT_DIR/privkey.pem"
echo ""
echo "WARNING: This is a self-signed certificate for testing only!"
echo "For production, use Let's Encrypt or a trusted CA."
