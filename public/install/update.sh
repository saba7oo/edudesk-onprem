#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  EduDesk On-Prem — Manual Update
#  Usage: bash /home/edudesk/edudesk/update.sh
#  Run as root on the server
# ══════════════════════════════════════════════════════════════

set -e

INSTALL_DIR="${INSTALL_DIR:-/home/edudesk/edudesk}"

# Read install server URL from .env (set during initial setup)
INSTALL_SERVER=$(grep -E '^INSTALL_SERVER_URL=' "$INSTALL_DIR/.env" 2>/dev/null \
  | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs \
  || echo "http://192.168.1.105:3000")

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EduDesk Update"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Download latest package ─────────────────────────────────
echo ""
echo "▶ Downloading latest version..."
echo "  Source: ${INSTALL_SERVER}/install/edudesk-latest.tar.gz"
curl -fsSL --progress-bar "${INSTALL_SERVER}/install/edudesk-latest.tar.gz" \
  | tar -xz -C "$INSTALL_DIR"
NEW_VERSION=$(node -p "require('$INSTALL_DIR/package.json').version" 2>/dev/null || echo "unknown")
echo -e "${GREEN}  ✓ Downloaded v${NEW_VERSION}${NC}"

# ── 2. Install / update dependencies ──────────────────────────
echo ""
echo "▶ Installing dependencies..."
cd "$INSTALL_DIR"
npm ci --omit=dev
echo -e "${GREEN}  ✓ Dependencies ready${NC}"

# ── 3. Regenerate Prisma client ────────────────────────────────
echo ""
echo "▶ Generating Prisma client..."
npm run generate
echo -e "${GREEN}  ✓ Prisma client generated${NC}"

# ── 4. Apply database migrations ──────────────────────────────
echo ""
echo "▶ Running database migrations..."
npm run db:migrate
echo -e "${GREEN}  ✓ Migrations applied${NC}"

# ── 5. Restart service ─────────────────────────────────────────
echo ""
echo "▶ Restarting service..."
systemctl restart edudesk
echo -e "${GREEN}  ✓ Service restarted${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}  ✅ Update to v${NEW_VERSION} complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
