#!/bin/bash
#
# ThreatForge - Server Setup Script
# Run this on a fresh Linux server to prepare for deployment
#
# Requirements:
#   - Ubuntu 22.04+ or Debian 12+
#   - 4GB RAM minimum
#   - 60GB disk
#   - Root or sudo access
#
# Usage:
#   curl -fsSL your-gitea-server/path/to/setup-server.sh | sudo bash
#   # Or locally:
#   sudo ./deploy/setup-server.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use sudo)"
fi

log "Starting ThreatForge server setup..."

# =============================================================================
# System Updates
# =============================================================================
log "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# =============================================================================
# Install Docker
# =============================================================================
if command -v docker &> /dev/null; then
    log "Docker already installed: $(docker --version)"
else
    log "Installing Docker..."
    apt-get install -y -qq ca-certificates curl gnupg

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    log "Docker installed: $(docker --version)"
fi

# =============================================================================
# Configure Docker for low-memory systems
# =============================================================================
log "Configuring Docker for low-memory system..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

systemctl restart docker

# =============================================================================
# Setup Swap (important for 4GB RAM systems)
# =============================================================================
if [[ ! -f /swapfile ]]; then
    log "Creating 2GB swap file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log "Swap enabled"
else
    log "Swap already configured"
fi

# Set swappiness for better performance
sysctl vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf

# =============================================================================
# Install additional tools
# =============================================================================
log "Installing additional tools..."
apt-get install -y -qq \
    git \
    htop \
    ncdu \
    ufw \
    fail2ban \
    unattended-upgrades

# =============================================================================
# Configure Firewall
# =============================================================================
log "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log "Firewall configured (SSH, HTTP, HTTPS allowed)"

# =============================================================================
# Configure Fail2Ban
# =============================================================================
log "Configuring Fail2Ban..."
systemctl enable fail2ban
systemctl start fail2ban

# =============================================================================
# Create application directory
# =============================================================================
APP_DIR="/opt/threatforge"
log "Creating application directory: $APP_DIR"
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/nginx/certs"
mkdir -p "$APP_DIR/nginx/logs"
mkdir -p "$APP_DIR/backups"

# =============================================================================
# Create deploy user
# =============================================================================
if id "deploy" &>/dev/null; then
    log "Deploy user already exists"
else
    log "Creating deploy user..."
    useradd -m -s /bin/bash -G docker deploy
    log "Deploy user created and added to docker group"
fi

chown -R deploy:deploy "$APP_DIR"

# =============================================================================
# Setup automatic security updates
# =============================================================================
log "Configuring automatic security updates..."
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================================================="
log "Server setup complete!"
echo "============================================================================="
echo ""
echo "Next steps:"
echo "  1. Clone the repository:"
echo "     cd $APP_DIR"
echo "     git clone <your-fork-url> ."
echo ""
echo "  2. Configure environment:"
echo "     cp .env.prod.example .env.prod"
echo "     nano .env.prod  # Edit with your values"
echo ""
echo "  3. Setup SSL certificates (choose one):"
echo "     # Option A: Self-signed (for testing)"
echo "     ./deploy/generate-self-signed-cert.sh"
echo ""
echo "     # Option B: Let's Encrypt (for production)"
echo "     ./deploy/setup-letsencrypt.sh your-domain.com"
echo ""
echo "  4. Start the application:"
echo "     docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "  5. View logs:"
echo "     docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "System info:"
echo "  - RAM: $(free -h | awk '/^Mem:/ {print $2}')"
echo "  - Disk: $(df -h / | awk 'NR==2 {print $4}') available"
echo "  - Swap: $(free -h | awk '/^Swap:/ {print $2}')"
echo ""
