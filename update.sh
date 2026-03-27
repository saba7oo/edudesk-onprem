#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  EduDesk OnPrem — Update Script
#  CloudTitans © 2026
#
#  Run this when you want to update to the latest version.
#  Checks license, backs up database, pulls update, restarts.
#
#  Usage: bash update.sh
# ══════════════════════════════════════════════════════════════

set -e

APP_DIR="/home/edudesk/edudesk"
BACKUP_DIR="/home/edudesk/backups"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}   EduDesk OnPrem — Update                  ${NC}"
echo -e "${BOLD}${CYAN}════════════════════════════════════════════${NC}"
echo ""

# ── STEP 1: Check license subscription ───────────────────────
echo -e "${BOLD}🔍 Checking license...${NC}"

LICENSE_FILE="$APP_DIR/LICENSE.key"

if [ ! -f "$LICENSE_FILE" ]; then
  echo -e "${RED}❌ LICENSE.key not found at $LICENSE_FILE${NC}"
  exit 1
fi

UPDATE_CHECK=$(node -e "
const fs = require('fs');
try {
  const license      = JSON.parse(fs.readFileSync('$LICENSE_FILE', 'utf8'));
  const today        = new Date().toISOString().split('T')[0];
  const updatesUntil = license.updatesUntil;

  if (!updatesUntil) {
    // DEMO license — no updates
    console.log('DEMO');
  } else if (today > updatesUntil) {
    console.log('EXPIRED:' + updatesUntil);
  } else {
    const d        = new Date(updatesUntil);
    const daysLeft = Math.ceil((d - new Date()) / (1000*60*60*24));
    console.log('OK:' + updatesUntil + ':' + daysLeft);
  }
} catch(e) {
  console.log('ERROR:' + e.message);
}
")

if [[ "$UPDATE_CHECK" == "DEMO" ]]; then
  echo -e "${RED}❌ Demo licenses do not include updates.${NC}"
  echo -e "   Contact support@ctitans.com to purchase a full license."
  exit 1
elif [[ "$UPDATE_CHECK" == EXPIRED* ]]; then
  EXPIRED_DATE=$(echo "$UPDATE_CHECK" | cut -d: -f2)
  echo -e "${RED}❌ Update subscription expired on ${EXPIRED_DATE}.${NC}"
  echo -e "   Contact support@ctitans.com to renew."
  exit 1
elif [[ "$UPDATE_CHECK" == ERROR* ]]; then
  echo -e "${RED}❌ License error: ${UPDATE_CHECK}${NC}"
  exit 1
fi

UPDATES_UNTIL=$(echo "$UPDATE_CHECK" | cut -d: -f2)
DAYS_LEFT=$(echo "$UPDATE_CHECK"     | cut -d: -f3)
echo -e "${GREEN}✅ License valid — updates until $UPDATES_UNTIL ($DAYS_LEFT days remaining)${NC}"

# Warn if subscription expiring soon
if [ "$DAYS_LEFT" -le 30 ]; then
  echo -e "${YELLOW}⚠️  Subscription expires in $DAYS_LEFT days. Contact support@ctitans.com to renew.${NC}"
fi

echo ""

# ── STEP 2: Show current version ─────────────────────────────
CURRENT_VERSION=$(node -p "require('$APP_DIR/package.json').version" 2>/dev/null || echo "unknown")
echo -e "   Current version: ${BOLD}v$CURRENT_VERSION${NC}"

# ── STEP 3: Backup database ───────────────────────────────────
echo ""
echo -e "${BOLD}💾 Backing up database...${NC}"

mkdir -p $BACKUP_DIR

# Extract DB password from .env
DB_PASS=$(grep '^DATABASE_URL=' $APP_DIR/.env | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')

BACKUP_FILE="$BACKUP_DIR/edudesk-$(date +%Y%m%d-%H%M%S).sql"
mysqldump -u edudesk -p"$DB_PASS" edudesk > "$BACKUP_FILE"

echo -e "${GREEN}✅ Backup saved: $BACKUP_FILE${NC}"

# Keep only last 10 backups
ls -t $BACKUP_DIR/*.sql 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true

# ── STEP 4: Download latest version ──────────────────────────
echo ""
echo -e "${BOLD}📥 Downloading latest version...${NC}"

REPO="saba7oo/edudesk-onprem"

# Get latest tag from GitHub API (no git, no SSH)
LATEST_TAG=$(curl -fsSLk "https://api.github.com/repos/$REPO/tags" \
  --max-time 15 \
  | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))[0].name" 2>/dev/null)

if [ -z "$LATEST_TAG" ]; then
  echo -e "${RED}❌ Could not fetch latest version from GitHub.${NC}"
  exit 1
fi

echo -e "   Downloading ${BOLD}$LATEST_TAG${NC}..."

# Download tarball directly over HTTPS
curl -fsSLk "https://github.com/$REPO/archive/refs/tags/$LATEST_TAG.tar.gz" \
  -o /tmp/edudesk-update.tar.gz --max-time 120

# Extract to temp dir
rm -rf /tmp/edudesk-update/
mkdir -p /tmp/edudesk-update
tar -xzf /tmp/edudesk-update.tar.gz -C /tmp/edudesk-update --strip-components=1

# Sync into app dir — preserve .env and LICENSE.key
rsync -a \
  --exclude='.env' \
  --exclude='LICENSE.key' \
  --exclude='node_modules/' \
  /tmp/edudesk-update/ $APP_DIR/

# Cleanup
rm -rf /tmp/edudesk-update /tmp/edudesk-update.tar.gz

NEW_VERSION=$(node -p "require('$APP_DIR/package.json').version")
echo -e "${GREEN}✅ Updated to v$NEW_VERSION${NC}"

# ── STEP 5: Install packages ──────────────────────────────────
echo ""
echo -e "${BOLD}📦 Installing packages...${NC}"
npm install --legacy-peer-deps -q
echo -e "${GREEN}✅ Packages ready${NC}"

# ── STEP 6: Run migrations ────────────────────────────────────
echo ""
echo -e "${BOLD}🗃️  Running database migrations...${NC}"
npm install prisma@"^5.11.0" --no-save --legacy-peer-deps -q 2>/dev/null
./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma
# Safety net: push any schema additions not covered by a migration file
./node_modules/.bin/prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>/dev/null || true
echo -e "${GREEN}✅ Migrations applied${NC}"

# ── STEP 7: Restart app ───────────────────────────────────────
echo ""
echo -e "${BOLD}🔄 Restarting EduDesk...${NC}"
systemctl restart edudesk
sleep 3
if systemctl is-active --quiet edudesk; then
  echo -e "${GREEN}✅ EduDesk restarted successfully${NC}"
else
  echo -e "${RED}❌ EduDesk failed to start — check logs: journalctl -u edudesk -n 50${NC}"
  exit 1
fi

echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}   ✅ EduDesk updated to v$NEW_VERSION!     ${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "   ${CYAN}journalctl -u edudesk -f${NC}  — Check application logs"
echo ""
