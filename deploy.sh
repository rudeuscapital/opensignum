#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# Open Signum Copilot — VPS Deploy Script
# ══════════════════════════════════════════════════════════════════════════════
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh                        # Full setup (first time)
#   ./deploy.sh update                 # Pull & rebuild
#   ./deploy.sh logs                   # View logs (follow)
#   ./deploy.sh stop                   # Stop app
#   ./deploy.sh restart                # Restart app
#   ./deploy.sh status                 # Health check
#   ./deploy.sh backup                 # Backup .env
#   ./deploy.sh ssl-renew              # Renew SSL certificate
#   ./deploy.sh cleanup                # Remove old Docker images
#   DOMAIN=example.com ./deploy.sh     # Setup with domain + SSL
#   REPO=user/repo ./deploy.sh         # Setup with specific repo
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

APP_NAME="open-signum-copilot"
APP_DIR="/opt/$APP_NAME"
DOMAIN="${DOMAIN:-}"
REPO="${REPO:-}"
PORT="${PORT:-4321}"
BACKUP_DIR="/opt/backups/$APP_NAME"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

# ── Health check ──────────────────────────────────────────────────────────────
health_check() {
    local max_attempts=10
    local attempt=1
    info "Waiting for app to start..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" 2>/dev/null | grep -q "200\|302"; then
            log "App is running on port $PORT."
            return 0
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    warn "App did not respond after ${max_attempts} attempts."
    warn "Check logs: ./deploy.sh logs"
    return 1
}

# ── Commands ──────────────────────────────────────────────────────────────────
case "${1:-setup}" in

update)
    log "Pulling latest changes..."
    cd "$APP_DIR"
    git pull --ff-only || { warn "git pull failed — trying reset"; git fetch origin; git reset --hard origin/main; }
    docker compose up -d --build --remove-orphans
    health_check
    log "Updated and restarted."
    exit 0
    ;;

logs)
    docker logs -f --tail 100 "$APP_NAME"
    exit 0
    ;;

stop)
    docker compose -f "$APP_DIR/docker-compose.yml" down
    log "Stopped."
    exit 0
    ;;

restart)
    docker compose -f "$APP_DIR/docker-compose.yml" restart
    health_check
    log "Restarted."
    exit 0
    ;;

status)
    echo ""
    info "Container status:"
    docker ps --filter "name=$APP_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    info "Health check:"
    if health_check; then
        log "All systems operational."
    fi
    echo ""
    info "Disk usage:"
    docker system df 2>/dev/null || true
    echo ""
    if [ -n "$DOMAIN" ] || [ -f "/etc/nginx/sites-available/$APP_NAME" ]; then
        info "SSL certificate:"
        certbot certificates 2>/dev/null | grep -A3 "Certificate Name" || warn "No SSL cert found"
    fi
    exit 0
    ;;

backup)
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    if [ -f "$APP_DIR/.env" ]; then
        cp "$APP_DIR/.env" "$BACKUP_DIR/.env.$TIMESTAMP"
        log "Backed up .env to $BACKUP_DIR/.env.$TIMESTAMP"
    else
        warn "No .env file found"
    fi
    exit 0
    ;;

ssl-renew)
    certbot renew --quiet
    nginx -t && systemctl reload nginx
    log "SSL certificates renewed."
    exit 0
    ;;

cleanup)
    info "Removing unused Docker images..."
    docker image prune -af --filter "until=72h"
    docker builder prune -af --filter "until=72h"
    log "Cleanup complete."
    docker system df
    exit 0
    ;;

setup)
    log "Starting full VPS setup..."
    ;;

*)
    echo ""
    echo "  Open Signum Copilot — Deploy Script"
    echo ""
    echo "  Usage: ./deploy.sh <command>"
    echo ""
    echo "  Commands:"
    echo "    setup       Full setup (first time, default)"
    echo "    update      Pull latest code & rebuild"
    echo "    restart     Restart the container"
    echo "    stop        Stop the container"
    echo "    logs        View container logs (follow)"
    echo "    status      Health check & system info"
    echo "    backup      Backup .env file"
    echo "    ssl-renew   Renew SSL certificates"
    echo "    cleanup     Remove old Docker images"
    echo ""
    echo "  Environment variables:"
    echo "    DOMAIN=example.com   Set domain for Nginx + SSL"
    echo "    REPO=user/repo       Git repo to clone"
    echo "    PORT=4321            App port (default: 4321)"
    echo ""
    exit 1
    ;;
esac

# ══════════════════════════════════════════════════════════════════════════════
# FULL SETUP
# ══════════════════════════════════════════════════════════════════════════════

# 1. Check root
if [ "$(id -u)" -ne 0 ]; then
    err "This script must be run as root (use sudo)"
fi

# 2. Fix broken apt mirrors (common on cloud VPS)
fix_apt_mirrors() {
    local fixed=false
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
        [ -f "$f" ] || continue
        if grep -q "mirror.repository.id\|broken-mirror\|mirror\..*\.id" "$f" 2>/dev/null; then
            sed -i 's|http://mirror\.[a-zA-Z0-9._-]*/ubuntu|http://archive.ubuntu.com/ubuntu|g' "$f"
            fixed=true
        fi
    done
    if [ "$fixed" = true ]; then
        warn "Fixed broken apt mirror — switched to archive.ubuntu.com"
    fi
}

log "Checking apt sources..."
fix_apt_mirrors

log "Installing system packages..."
apt-get update -qq 2>/dev/null || {
    warn "apt-get update failed — attempting mirror fix..."
    # Force replace all mirrors with official Ubuntu mirror
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
        [ -f "$f" ] || continue
        sed -i -E 's|https?://[a-zA-Z0-9._-]+/(ubuntu)|http://archive.ubuntu.com/\1|g' "$f"
    done
    apt-get update -qq || err "apt-get update failed after mirror fix. Check /etc/apt/sources.list manually."
}
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw > /dev/null 2>&1

# 3. Docker (if not installed)
if ! command -v docker &> /dev/null; then
    log "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log "Docker installed."
else
    log "Docker already installed ($(docker --version | awk '{print $3}'))."
fi

# Ensure docker compose is available
if ! docker compose version &> /dev/null; then
    err "Docker Compose plugin not found. Install: apt-get install docker-compose-plugin"
fi

# 4. Firewall
log "Configuring firewall..."
ufw allow OpenSSH > /dev/null 2>&1
ufw allow 'Nginx Full' > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
log "Firewall configured (SSH + Nginx)."

# 5. Clone or update repo
if [ -d "$APP_DIR" ]; then
    warn "App directory exists — pulling latest..."
    cd "$APP_DIR"
    git pull --ff-only || true
elif [ -n "$REPO" ]; then
    log "Cloning $REPO..."
    git clone "https://github.com/$REPO.git" "$APP_DIR"
else
    echo ""
    warn "No repo found at $APP_DIR"
    echo ""
    echo "  Option 1: Set REPO variable"
    echo "    REPO=username/open-signum-copilot ./deploy.sh"
    echo ""
    echo "  Option 2: Clone manually"
    echo "    git clone <your-repo-url> $APP_DIR"
    echo "    ./deploy.sh"
    echo ""
    read -p "Press Enter after cloning (or Ctrl+C to abort)..."
fi

cd "$APP_DIR"

# 6. Environment file
if [ ! -f .env ]; then
    log "Creating .env from template..."
    if [ -f .env.example ]; then
        cp .env.example .env
        # Generate a random session secret
        SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 64)
        sed -i "s/change-me-to-a-random-string/$SESSION_SECRET/" .env
        log "Generated random SESSION_SECRET."
        echo ""
        warn "Edit .env to add your API keys:"
        echo "    nano $APP_DIR/.env"
        echo ""
        read -p "Press Enter after editing .env..."
    else
        err ".env.example not found in $APP_DIR"
    fi
else
    log ".env already exists."
fi

# Sanitize .env — remove unicode chars that break Docker env_file parser
sed -i 's/[─═]//g' .env 2>/dev/null || true

# Verify .env has required keys
if ! grep -q "^GROQ_API_KEY=.\+" .env 2>/dev/null; then
    warn "GROQ_API_KEY is not set in .env — AI features will not work."
    echo "    Edit: nano $APP_DIR/.env"
fi
if ! grep -q "^SESSION_SECRET=.\+" .env 2>/dev/null; then
    warn "SESSION_SECRET is not set in .env"
fi

# Show loaded env vars (masked)
info "Environment:"
grep -v '^#' .env | grep -v '^$' | while IFS='=' read -r key val; do
    echo "    $key=${val:0:8}..."
done

# 7. Build & start with Docker
log "Building and starting container..."
docker compose up -d --build --remove-orphans

health_check

# 8. Nginx reverse proxy
if [ -n "$DOMAIN" ]; then
    log "Configuring Nginx for $DOMAIN..."

    # Step 1: HTTP-only config (so certbot can verify domain)
    cat > /etc/nginx/sites-available/$APP_NAME <<NGINX_CONF
server {
    listen 80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # Static assets (long cache)
    location /_astro/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # SSR app
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
NGINX_CONF

    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # Test and reload
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        log "Nginx configured (HTTP)."
    else
        warn "Nginx config test failed — check: nginx -t"
        nginx -t
    fi

    # Step 2: SSL with Let's Encrypt (certbot modifies nginx config automatically)
    log "Obtaining SSL certificate for $DOMAIN..."
    if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect; then
        log "SSL configured."
    else
        warn "SSL setup failed — site is running on HTTP only."
        warn "Retry later: certbot --nginx -d $DOMAIN"
    fi

    # Auto-renewal cron
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
        (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
        log "SSL auto-renewal cron added (daily at 3am)."
    fi
else
    warn "No DOMAIN set — skipping Nginx/SSL."
    echo "  To add later: DOMAIN=yourdomain.com ./deploy.sh setup"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Open Signum Copilot deployed successfully!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
if [ -n "$DOMAIN" ]; then
    echo "  URL:     https://$DOMAIN"
else
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "your-server-ip")
    echo "  URL:     http://$PUBLIC_IP:$PORT"
fi
echo ""
echo "  Commands:"
echo "    ./deploy.sh update      Pull & rebuild"
echo "    ./deploy.sh restart     Restart container"
echo "    ./deploy.sh logs        View logs"
echo "    ./deploy.sh status      Health check"
echo "    ./deploy.sh stop        Stop app"
echo "    ./deploy.sh backup      Backup .env"
echo "    ./deploy.sh cleanup     Remove old images"
echo ""
