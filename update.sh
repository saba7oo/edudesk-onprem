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

# Parse DATABASE_URL with Node.js — use regex so passwords with @ or special chars work
DB_CREDENTIALS=$(node -e "
  try {
    const line = require('fs').readFileSync('$APP_DIR/.env', 'utf8')
      .split('\n').find(l => l.startsWith('DATABASE_URL=')) || '';
    const url = line.replace(/^DATABASE_URL=[\"']?/, '').replace(/[\"']?\s*$/, '');
    // Regex: greedily capture password (allows @ inside), split on LAST @ before host
    const m = url.match(/^[^:]+:\/\/([^:]+):(.+)@([^:@\/]+)(?::\d+)?\/([^?]+)/);
    if (!m) throw new Error('no match');
    console.log(decodeURIComponent(m[1]) + '|' + decodeURIComponent(m[2]) + '|' + m[3] + '|' + m[4]);
  } catch(e) { console.log('||localhost|edudesk'); }
" 2>/dev/null)
DB_USER=$(echo "$DB_CREDENTIALS" | cut -d'|' -f1)
DB_PASS=$(echo "$DB_CREDENTIALS" | cut -d'|' -f2)
DB_HOST=$(echo "$DB_CREDENTIALS" | cut -d'|' -f3)
DB_NAME=$(echo "$DB_CREDENTIALS" | cut -d'|' -f4)

BACKUP_FILE="$BACKUP_DIR/edudesk-$(date +%Y%m%d-%H%M%S).sql"
if mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
  echo -e "${GREEN}✅ Backup saved: $BACKUP_FILE${NC}"
  # Keep only last 10 backups
  ls -t $BACKUP_DIR/*.sql 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
else
  echo -e "${YELLOW}⚠️  Backup skipped (mysqldump error — update will continue)${NC}"
  rm -f "$BACKUP_FILE"
fi

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

# Copy into app dir — .env / LICENSE.key / node_modules are gitignored so never in tarball
cp -a /tmp/edudesk-update/. $APP_DIR/

# Cleanup
rm -rf /tmp/edudesk-update /tmp/edudesk-update.tar.gz

NEW_VERSION=$(node -p "require('$APP_DIR/package.json').version")
echo -e "${GREEN}✅ Updated to v$NEW_VERSION${NC}"

# ── STEP 5: Install packages ──────────────────────────────────
echo ""
echo -e "${BOLD}📦 Installing packages...${NC}"
cd $APP_DIR
npm install --legacy-peer-deps --no-fund --no-audit -q
echo -e "${GREEN}✅ Packages ready${NC}"

# ── STEP 6: Run migrations ────────────────────────────────────
echo ""
echo -e "${BOLD}🗃️  Running database migrations...${NC}"
npm install prisma@"^5.11.0" --no-save --legacy-peer-deps --no-fund -q 2>/dev/null

PRISMA="./node_modules/.bin/prisma"
SCHEMA="--schema=prisma/schema.prisma"

# Helper: run a single SQL statement via prisma db execute (reads DATABASE_URL from .env)
# Ignores "already exists" / "duplicate" errors — safe to re-run on any install state
run_sql() {
  echo "$1" | $PRISMA db execute $SCHEMA --stdin 2>&1 | grep -vi "already exists\|Duplicate column\|Duplicate key\|Duplicate foreign key\|Can't create table\|Script executed" || true
}

run_sql "ALTER TABLE \`users\` ADD COLUMN \`adSyncLocked\` BOOLEAN NOT NULL DEFAULT false"
run_sql "ALTER TABLE \`categories\` ADD COLUMN \`type\` ENUM('NORMAL','DROPDOWN','TEXT_FIELD') NOT NULL DEFAULT 'NORMAL'"
run_sql "ALTER TABLE \`categories\` ADD COLUMN \`dropdownOptions\` TEXT NULL"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`categoryDetail\` VARCHAR(191) NULL"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`createdByAgentId\` VARCHAR(191) NULL"
run_sql "ALTER TABLE \`tickets\` ADD CONSTRAINT \`tickets_createdByAgentId_fkey\` FOREIGN KEY (\`createdByAgentId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE"
run_sql "CREATE TABLE IF NOT EXISTS \`email_templates\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`key\` VARCHAR(191) NOT NULL, \`name\` VARCHAR(191) NOT NULL, \`subject\` TEXT NOT NULL, \`body\` LONGTEXT NOT NULL, \`variables\` TEXT NULL, \`isDefault\` BOOLEAN NOT NULL DEFAULT false, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`email_templates_tenantId_key_key\`(\`tenantId\`, \`key\`), INDEX \`email_templates_tenantId_idx\`(\`tenantId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`email_templates\` ADD CONSTRAINT \`email_templates_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "CREATE TABLE IF NOT EXISTS \`email_actions\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`trigger\` VARCHAR(191) NOT NULL, \`templateId\` VARCHAR(191) NOT NULL, \`recipientType\` VARCHAR(191) NOT NULL, \`recipientValue\` VARCHAR(191) NULL, \`isEnabled\` BOOLEAN NOT NULL DEFAULT true, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`email_actions_tenantId_idx\`(\`tenantId\`), INDEX \`email_actions_trigger_idx\`(\`trigger\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`email_actions\` ADD CONSTRAINT \`email_actions_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "ALTER TABLE \`email_actions\` ADD CONSTRAINT \`email_actions_templateId_fkey\` FOREIGN KEY (\`templateId\`) REFERENCES \`email_templates\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "CREATE TABLE IF NOT EXISTS \`classifications\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`name\` VARCHAR(191) NOT NULL, \`isActive\` BOOLEAN NOT NULL DEFAULT true, \`sortOrder\` INT NOT NULL DEFAULT 0, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`classifications_tenantId_idx\`(\`tenantId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`classifications\` ADD CONSTRAINT \`classifications_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`classificationId\` VARCHAR(191) NULL"
run_sql "ALTER TABLE \`tickets\` ADD CONSTRAINT \`tickets_classificationId_fkey\` FOREIGN KEY (\`classificationId\`) REFERENCES \`classifications\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE"
run_sql "ALTER TABLE \`kb_articles\` ADD COLUMN \`attachments\` TEXT NULL"
run_sql "CREATE TABLE IF NOT EXISTS \`sla_configs\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`priority\` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL, \`responseHours\` INT NOT NULL, \`resolveHours\` INT NOT NULL, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`sla_configs_tenantId_priority_key\`(\`tenantId\`, \`priority\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`sla_configs\` ADD CONSTRAINT \`sla_configs_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "CREATE TABLE IF NOT EXISTS \`sla_logs\` (\`id\` VARCHAR(191) NOT NULL, \`ticketId\` VARCHAR(191) NOT NULL, \`firstResponseAt\` DATETIME(3) NULL, \`resolvedAt\` DATETIME(3) NULL, \`responseBreached\` BOOLEAN NOT NULL DEFAULT false, \`resolveBreached\` BOOLEAN NOT NULL DEFAULT false, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX \`sla_logs_ticketId_key\`(\`ticketId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`sla_logs\` ADD CONSTRAINT \`sla_logs_ticketId_fkey\` FOREIGN KEY (\`ticketId\`) REFERENCES \`tickets\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "CREATE TABLE IF NOT EXISTS \`notifications\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`userId\` VARCHAR(191) NOT NULL, \`title\` VARCHAR(191) NOT NULL, \`body\` VARCHAR(191) NOT NULL, \`ticketId\` VARCHAR(191) NULL, \`isRead\` BOOLEAN NOT NULL DEFAULT false, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX \`notifications_userId_idx\`(\`userId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`notifications\` ADD CONSTRAINT \`notifications_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "ALTER TABLE \`notifications\` ADD CONSTRAINT \`notifications_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "ALTER TABLE \`tenant_branding\` ADD COLUMN \`loginHeadline\` TEXT NULL"
run_sql "ALTER TABLE \`tenant_branding\` ADD COLUMN \`loginSubtitle\` TEXT NULL"
run_sql "ALTER TABLE \`tenant_branding\` ADD COLUMN \`loginBannerImageUrl\` VARCHAR(767) NULL"
run_sql "ALTER TABLE \`tenant_branding\` ADD COLUMN \`loginButtons\` TEXT NULL"
run_sql "ALTER TABLE \`sla_configs\` MODIFY COLUMN \`responseHours\` FLOAT NOT NULL DEFAULT 0"
run_sql "ALTER TABLE \`sla_configs\` MODIFY COLUMN \`resolveHours\` FLOAT NOT NULL DEFAULT 0"
run_sql "CREATE TABLE IF NOT EXISTS \`working_hours\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`enabled\` BOOLEAN NOT NULL DEFAULT false, \`workDays\` TEXT NOT NULL DEFAULT '[1,2,3,4,5]', \`startHour\` FLOAT NOT NULL DEFAULT 9, \`endHour\` FLOAT NOT NULL DEFAULT 17, \`timezone\` VARCHAR(100) NOT NULL DEFAULT 'UTC', \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`working_hours_tenantId_key\`(\`tenantId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`working_hours\` ADD CONSTRAINT \`working_hours_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"

echo -e "${GREEN}✅ Schema columns applied${NC}"

# Resolve any migrations stuck in failed state (schema already synced above)
MIGRATE_STATUS=$($PRISMA migrate status $SCHEMA 2>&1)
echo "$MIGRATE_STATUS" | grep -oE '[0-9]{14}_[a-zA-Z0-9_]+' | while read migration; do
  if echo "$MIGRATE_STATUS" | grep -A2 "$migration" | grep -q "failed"; then
    echo -e "${YELLOW}   Resolving failed migration: $migration${NC}"
    $PRISMA migrate resolve --applied "$migration" $SCHEMA 2>/dev/null || true
  fi
done

# Apply any remaining tracked migrations
MIGRATE_OUT=$($PRISMA migrate deploy $SCHEMA 2>&1)
MIGRATE_EXIT=$?
if [ $MIGRATE_EXIT -eq 0 ]; then
  echo -e "${GREEN}✅ Migrations applied${NC}"
elif echo "$MIGRATE_OUT" | grep -q "P3009"; then
  # Still has failed migrations — extract and resolve them, then retry
  echo "$MIGRATE_OUT" | grep -oE '`[0-9]{14}_[^`]+`' | tr -d '`' | while read migration; do
    echo -e "${YELLOW}   Resolving failed migration: $migration${NC}"
    $PRISMA migrate resolve --applied "$migration" $SCHEMA 2>/dev/null || true
  done
  $PRISMA migrate deploy $SCHEMA 2>&1 && \
    echo -e "${GREEN}✅ Migrations applied${NC}" || \
    echo -e "${YELLOW}⚠️  Some migrations could not be applied (schema was synced directly)${NC}"
else
  echo -e "${YELLOW}⚠️  migrate deploy: $MIGRATE_OUT${NC}"
fi

# ── STEP 7: Restart app ───────────────────────────────────────
echo ""
echo -e "${BOLD}🔄 Restarting EduDesk...${NC}"

# Stop first, wait until fully stopped, then start fresh
systemctl stop edudesk 2>/dev/null || true
sleep 3

systemctl start edudesk
sleep 5

if systemctl is-active --quiet edudesk; then
  echo -e "${GREEN}✅ EduDesk started successfully${NC}"
else
  # One more try
  echo -e "${YELLOW}⚠️  First start attempt failed, retrying...${NC}"
  systemctl restart edudesk
  sleep 5
  if systemctl is-active --quiet edudesk; then
    echo -e "${GREEN}✅ EduDesk restarted successfully${NC}"
  else
    echo -e "${RED}❌ EduDesk failed to start — check logs: journalctl -u edudesk -n 50${NC}"
    exit 1
  fi
fi

echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}   ✅ EduDesk updated to v$NEW_VERSION!     ${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "   ${CYAN}journalctl -u edudesk -f${NC}  — Check application logs"
echo ""
