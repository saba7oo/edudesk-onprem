#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  EduDesk On-Prem — New Server Setup
#  Usage: curl -fsSL http://192.168.1.105:3000/install/setup.sh | bash
#  Run as root on a fresh Ubuntu/Debian server
# ══════════════════════════════════════════════════════════════

set -e

# ── Install server URL (change this if you have a domain) ─────
INSTALL_SERVER="http://192.168.1.105:3000"

# ── Colours ────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }
step() { echo -e "\n▶ $1..."; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EduDesk On-Prem Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 0. Must run as root ────────────────────────────────────────
[ "$EUID" -ne 0 ] && fail "Please run as root: sudo bash setup.sh"

# ── 1. Read config ─────────────────────────────────────────────
# All reads use </dev/tty so they work when piped via curl | bash
step "Configuration"

read -p "  Install directory [/home/edudesk/edudesk]: " INSTALL_DIR </dev/tty
INSTALL_DIR="${INSTALL_DIR:-/home/edudesk/edudesk}"

read -p "  App URL (e.g. https://helpdesk.university.edu): " APP_URL </dev/tty
[ -z "$APP_URL" ] && fail "APP_URL is required"

read -p "  Database host [localhost]: " DB_HOST </dev/tty
DB_HOST="${DB_HOST:-localhost}"

read -p "  Database name [edudesk]: " DB_NAME </dev/tty
DB_NAME="${DB_NAME:-edudesk}"

read -p "  Database user [edudesk]: " DB_USER </dev/tty
DB_USER="${DB_USER:-edudesk}"

read -s -p "  Database password: " DB_PASS </dev/tty
echo ""
[ -z "$DB_PASS" ] && fail "Database password is required"

read -s -p "  NextAuth secret (leave blank to auto-generate): " NEXTAUTH_SECRET </dev/tty
echo ""
if [ -z "$NEXTAUTH_SECRET" ]; then
  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  warn "Auto-generated NextAuth secret"
fi

DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:3306/${DB_NAME}"

ok "Configuration collected"

# ── 2. Install Node.js 20 (if not present) ─────────────────────
step "Checking Node.js"
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  step "Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  ok "Node.js $(node -v) installed"
else
  ok "Node.js $(node -v) already installed"
fi

# ── 3. Create system user ──────────────────────────────────────
step "Creating system user 'edudesk'"
if id "edudesk" &>/dev/null; then
  ok "User 'edudesk' already exists"
else
  useradd --system --create-home --shell /bin/bash edudesk
  ok "User 'edudesk' created"
fi

# ── 4. Download application package ───────────────────────────
step "Downloading EduDesk application"
mkdir -p "$INSTALL_DIR"

echo "  Fetching from ${INSTALL_SERVER}/install/edudesk-latest.tar.gz"
curl -fsSL --progress-bar "${INSTALL_SERVER}/install/edudesk-latest.tar.gz" \
  | tar -xz -C "$INSTALL_DIR"

chown -R edudesk:edudesk "$INSTALL_DIR"
ok "Application files ready"

# ── 5. Write .env ──────────────────────────────────────────────
step "Writing .env file"
cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL="${DATABASE_URL}"
NEXTAUTH_URL="${APP_URL}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXT_PUBLIC_MODE=onprem
NODE_ENV=production
INSTALL_SERVER_URL="${INSTALL_SERVER}"
EOF
chown edudesk:edudesk "$INSTALL_DIR/.env"
chmod 600 "$INSTALL_DIR/.env"
ok ".env written"

# ── 6. Install npm dependencies ────────────────────────────────
step "Installing dependencies"
cd "$INSTALL_DIR"
sudo -u edudesk npm ci --omit=dev
ok "Dependencies installed"

# ── 7. Generate Prisma client ──────────────────────────────────
step "Generating Prisma client"
sudo -u edudesk npm run generate
ok "Prisma client generated"

# ── 8. Run migrations ──────────────────────────────────────────
step "Running database migrations"
sudo -u edudesk npm run db:migrate
ok "Migrations applied"

# ── 9. Seed default tenant ─────────────────────────────────────
step "Seeding default tenant"
sudo -u edudesk npx prisma db seed --schema=prisma/schema.prisma
ok "Default tenant seeded"

# ── 10. Install systemd service ────────────────────────────────
step "Installing systemd service"
sed "s|/home/edudesk/edudesk|${INSTALL_DIR}|g" "$INSTALL_DIR/edudesk.service" \
  > /etc/systemd/system/edudesk.service
systemctl daemon-reload
systemctl enable edudesk
systemctl start edudesk
ok "Service installed and started"

# ── 11. Done ───────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}  ✅ Setup complete!${NC}"
echo ""
echo "  App URL  : ${APP_URL}"
echo "  Email    : admin@edudesk.local"
echo "  Password : changeme123"
echo ""
echo -e "${YELLOW}  ⚠  Change your password immediately after login!${NC}"
echo ""
echo "  Service logs:  journalctl -u edudesk -f"
echo "  Manual update: bash ${INSTALL_DIR}/update.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
