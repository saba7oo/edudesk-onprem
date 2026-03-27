#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  EduDesk OnPrem — Setup Script
#  CloudTitans © 2026
#
#  Run once on a fresh Ubuntu server to install everything.
#  Requires: Ubuntu 20.04+ | Root or sudo access
#
#  Install command (run as root):
#    apt install -y git && \
#    git clone https://github.com/saba7oo/edudesk-onprem.git /tmp/edudesk-setup && \
#    bash /tmp/edudesk-setup/setup.sh --key /path/to/LICENSE.key
#
#  Flags:
#    --key  /path/to/LICENSE.key  — License key file (skips interactive prompt)
#    --ssl  selfsigned            — Self-signed (internal / no DNS)
#    --ssl  letsencrypt           — Let's Encrypt (public domain)
#    --ssl  commercial            — Your own SSL certificate
#    --upgrade-ssl                — Replace/renew SSL certificate
# ══════════════════════════════════════════════════════════════

set -e

APP_DIR="/home/edudesk/edudesk"
BACKUP_DIR="/home/edudesk/backups"
SELFSIGNED_CERT="/etc/ssl/certs/edudesk-selfsigned.crt"
SELFSIGNED_KEY="/etc/ssl/private/edudesk-selfsigned.key"
COMMERCIAL_DIR="/etc/ssl/edudesk"
COMMERCIAL_CERT="$COMMERCIAL_DIR/edudesk.crt"
COMMERCIAL_KEY="$COMMERCIAL_DIR/edudesk.key"

# ── CloudTitans public key (hardcoded — safe to ship) ─────────
EDUDESK_PUBLIC_KEY='-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAo64q4Lqis/wecZOyxdtp
GZ/zjexdyYhPs6UqhwvXbHpU6DCNRweqSr2zKiYIEHqzgKB6ESNOMmrBgBW3mtll
MBV3HQx6OA+C5JnZI7P9Hq7WxD0DPtHPdOwyJhp5uFsvGPfPOhSmutTX9d136w4P
bHsuAf2B0OQtsNXC/F4IpEABko6YQuNMe1Cr0RZccNHcjkPqKsRHjygNhr0QcTBH
NAxg8rIbWQvNTMqIgkzkTLBR8HoNrTPhDThME05gndED0lPzYFA8pP6W8yOHdVZG
3Ri3vnzOxcH9/IvbWbsB4+bb6R9k6hb34NmGP6CW56/jsQra3FzittlZ8rhetoSA
9QIDAQAB
-----END PUBLIC KEY-----'
export EDUDESK_PUBLIC_KEY

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Parse flags ───────────────────────────────────────────────
UPGRADE_SSL=false
SSL_MODE=""

LICENSE_PATH_ARG=""
DOMAIN_ARG=""
DB_PASS_ARG=""
ARGS=("$@")
for i in "${!ARGS[@]}"; do
  case "${ARGS[$i]}" in
    --upgrade-ssl) UPGRADE_SSL=true ;;
    --ssl)
      next=$((i+1))
      if [ -n "${ARGS[$next]}" ]; then SSL_MODE="${ARGS[$next]}"; fi
      ;;
    --key)
      next=$((i+1))
      if [ -n "${ARGS[$next]}" ]; then LICENSE_PATH_ARG="${ARGS[$next]}"; fi
      ;;
    --domain)
      next=$((i+1))
      if [ -n "${ARGS[$next]}" ]; then DOMAIN_ARG="${ARGS[$next]}"; fi
      ;;
    --db-pass)
      next=$((i+1))
      if [ -n "${ARGS[$next]}" ]; then DB_PASS_ARG="${ARGS[$next]}"; fi
      ;;
  esac
done

# ── Helper: collect and validate commercial cert files ────────
collect_commercial_certs() {
  echo ""
  echo -e "  ${BOLD}Commercial SSL Certificate${NC}"
  echo -e "  Provide the paths to your certificate files on this server."
  echo ""
  echo -e "  ${CYAN}Tip:${NC} Upload your files first via SCP:"
  echo -e "  ${CYAN}  scp your-domain.crt root@<server-ip>:/root/${NC}"
  echo -e "  ${CYAN}  scp your-domain.key root@<server-ip>:/root/${NC}"
  echo ""

  while true; do
    read -e -p "  Path to certificate file (.crt / .pem): " CERT_SRC
    if [ ! -f "$CERT_SRC" ]; then
      echo -e "  ${RED}❌ File not found: $CERT_SRC${NC}"
    else
      break
    fi
  done

  while true; do
    read -e -p "  Path to private key file (.key / .pem): " KEY_SRC
    if [ ! -f "$KEY_SRC" ]; then
      echo -e "  ${RED}❌ File not found: $KEY_SRC${NC}"
    else
      break
    fi
  done

  # Optional CA bundle (intermediate chain)
  read -e -p "  Path to CA bundle / chain file (leave blank if already bundled in cert): " CABUNDLE_SRC
  echo ""

  # ── Verify cert matches private key ───────────────────────
  echo -e "${BOLD}   Verifying certificate matches private key...${NC}"
  CERT_MOD=$(openssl x509 -noout -modulus -in "$CERT_SRC" 2>/dev/null | md5sum | cut -d' ' -f1)
  KEY_MOD=$(openssl rsa  -noout -modulus -in "$KEY_SRC"  2>/dev/null | md5sum | cut -d' ' -f1)

  if [ "$CERT_MOD" != "$KEY_MOD" ]; then
    echo -e "   ${RED}❌ Certificate and private key do NOT match!${NC}"
    echo -e "   ${RED}   Make sure you are using the correct key for this certificate.${NC}"
    exit 1
  fi
  echo -e "   ${GREEN}✓ Certificate matches private key${NC}"

  # ── Verify cert is for the right domain ───────────────────
  CERT_CN=$(openssl x509 -noout -subject -in "$CERT_SRC" 2>/dev/null | grep -oP 'CN\s*=\s*\K[^,/]+' | head -1)
  CERT_SAN=$(openssl x509 -noout -ext subjectAltName -in "$CERT_SRC" 2>/dev/null || true)

  echo -e "   ${GREEN}✓ Certificate CN: $CERT_CN${NC}"

  # Warn if domain doesn't appear to match (soft warning — wildcard certs, etc.)
  if [[ "$CERT_CN" != "$DOMAIN" && "$CERT_CN" != "*."* && ! "$CERT_SAN" =~ "$DOMAIN" ]]; then
    echo ""
    echo -e "   ${YELLOW}⚠️  Certificate CN ($CERT_CN) does not exactly match domain ($DOMAIN).${NC}"
    echo -e "   ${YELLOW}   This may be fine for wildcard certs (e.g. *.university.edu).${NC}"
    echo -e "   ${YELLOW}   If this is wrong, Ctrl+C now and provide the correct certificate.${NC}"
    echo ""
    read -p "  Press ENTER to continue anyway, or Ctrl+C to cancel: "
  fi

  # ── Install certs to standard location ─────────────────────
  mkdir -p "$COMMERCIAL_DIR"
  chmod 700 "$COMMERCIAL_DIR"

  # If CA bundle provided, concatenate: cert + bundle = full chain
  if [ -n "$CABUNDLE_SRC" ] && [ -f "$CABUNDLE_SRC" ]; then
    cat "$CERT_SRC" "$CABUNDLE_SRC" > "$COMMERCIAL_CERT"
    echo -e "   ${GREEN}✓ Certificate + CA bundle combined${NC}"
  else
    cp "$CERT_SRC" "$COMMERCIAL_CERT"
  fi

  cp "$KEY_SRC" "$COMMERCIAL_KEY"
  chmod 600 "$COMMERCIAL_KEY"

  echo -e "   ${GREEN}✓ Certificates installed to $COMMERCIAL_DIR${NC}"
}

# ══════════════════════════════════════════════════════════════
#  --upgrade-ssl MODE — Replace existing SSL certificate
# ══════════════════════════════════════════════════════════════
if [ "$UPGRADE_SSL" = true ]; then
  echo ""
  echo -e "${BOLD}${CYAN}════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}   EduDesk — SSL Certificate Upgrade        ${NC}"
  echo -e "${BOLD}${CYAN}════════════════════════════════════════════${NC}"
  echo ""

  # Read domain from existing .env
  if [ -f "$APP_DIR/.env" ]; then
    DOMAIN=$(grep '^APP_DOMAIN=' "$APP_DIR/.env" | cut -d'=' -f2)
  fi
  if [ -z "$DOMAIN" ]; then
    read -p "  Domain name: " DOMAIN
  else
    echo -e "   Detected domain: ${BOLD}$DOMAIN${NC}"
  fi

  echo ""
  echo -e "  ${BOLD}Upgrade to which SSL type?${NC}"
  echo ""
  echo -e "  ${CYAN}[1]${NC} Let's Encrypt  — Free, auto-renewing (DNS must point here)"
  echo -e "  ${CYAN}[2]${NC} Commercial SSL — Your own certificate (DigiCert, Comodo, etc.)"
  echo -e "  ${CYAN}[3]${NC} Renew commercial cert — Replace expired/expiring commercial cert"
  echo ""
  read -p "  Enter choice [1, 2 or 3]: " UPGRADE_CHOICE
  echo ""

  case "$UPGRADE_CHOICE" in
    1) UPGRADE_TARGET="letsencrypt" ;;
    2|3) UPGRADE_TARGET="commercial" ;;
    *) echo -e "${RED}❌ Invalid choice.${NC}"; exit 1 ;;
  esac

  if [ "$UPGRADE_TARGET" = "letsencrypt" ]; then
    read -p "  Admin email for Let's Encrypt: " EMAIL
    echo ""
    echo -e "${YELLOW}  ⚠️  DNS A record for ${BOLD}$DOMAIN${NC}${YELLOW} must point to this server.${NC}"
    echo -e "${YELLOW}  ⚠️  Ports 80 and 443 must be open.${NC}"
    echo ""
    read -p "  Press ENTER when DNS is ready: "

    # Install certbot if missing
    if ! command -v certbot &> /dev/null; then
      echo -e "${BOLD}📦 Installing Certbot...${NC}"
      apt-get install -y certbot python3-certbot-nginx -qq
    fi

    # Reset nginx to plain HTTP so certbot can take over
    cat > /etc/nginx/sites-available/edudesk << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
    }
}
EOF
    nginx -t -q && systemctl reload nginx

    echo -e "${BOLD}🔒 Obtaining Let's Encrypt certificate...${NC}"
    certbot --nginx \
      -d "$DOMAIN" \
      --email "$EMAIL" \
      --agree-tos \
      --non-interactive \
      --redirect \
      -q

    # Clean up old self-signed or commercial certs
    rm -f "$SELFSIGNED_CERT" "$SELFSIGNED_KEY"
    rm -f "$COMMERCIAL_CERT" "$COMMERCIAL_KEY"

    sed -i "s|SSL_MODE=.*|SSL_MODE=letsencrypt|" "$APP_DIR/.env" 2>/dev/null || true

  else
    # Commercial upgrade
    collect_commercial_certs

    # Update nginx to use new commercial cert
    cat > /etc/nginx/sites-available/edudesk << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate     $COMMERCIAL_CERT;
    ssl_certificate_key $COMMERCIAL_KEY;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
    }
}
EOF
    nginx -t -q && systemctl reload nginx

    # Clean up old self-signed certs if they existed
    rm -f "$SELFSIGNED_CERT" "$SELFSIGNED_KEY"

    sed -i "s|SSL_MODE=.*|SSL_MODE=commercial|" "$APP_DIR/.env" 2>/dev/null || true
  fi

  sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://$DOMAIN|" "$APP_DIR/.env" 2>/dev/null || true
  systemctl restart edudesk 2>/dev/null || true

  echo ""
  echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${GREEN}   ✅ SSL certificate updated!              ${NC}"
  echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
  echo ""
  echo -e "   🌐 URL : ${BOLD}https://$DOMAIN${NC}"
  echo ""
  exit 0
fi

# ══════════════════════════════════════════════════════════════
# FULL SETUP
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${CYAN}════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}   EduDesk OnPrem — Setup Wizard            ${NC}"
echo -e "${BOLD}${CYAN}   CloudTitans © 2026                       ${NC}"
echo -e "${BOLD}${CYAN}════════════════════════════════════════════${NC}"
echo ""

# ══════════════════════════════════════════════════════════════
# STEP 1 — Collect Information
# ══════════════════════════════════════════════════════════════
echo -e "${BOLD}📋 Please provide the following information:${NC}"
echo ""

if [ -n "$DOMAIN_ARG" ]; then
  DOMAIN="$DOMAIN_ARG"
else
  read -p "  Domain name (e.g. helpdesk.university.edu): " DOMAIN
fi

# ── SSL Mode selection ─────────────────────────────────────────
if [ -z "$SSL_MODE" ]; then
  echo ""
  echo -e "  ${BOLD}Which SSL certificate type?${NC}"
  echo ""
  echo -e "  ${CYAN}[1]${NC} Self-signed   — Internal use / DNS not ready"
  echo -e "      (Browser will show a security warning — expected)"
  echo -e "  ${CYAN}[2]${NC} Let's Encrypt — Free, auto-renewing (DNS must point here)"
  echo -e "  ${CYAN}[3]${NC} Commercial    — Your own certificate (DigiCert, Comodo, etc.)"
  echo ""
  read -p "  Enter choice [1, 2 or 3]: " SSL_CHOICE
  echo ""

  case "$SSL_CHOICE" in
    1) SSL_MODE="selfsigned" ;;
    2) SSL_MODE="letsencrypt" ;;
    3) SSL_MODE="commercial" ;;
    *) echo -e "${RED}❌ Invalid choice. Run the script again.${NC}"; exit 1 ;;
  esac
fi

# Email only needed for Let's Encrypt
EMAIL=""
if [ "$SSL_MODE" = "letsencrypt" ]; then
  read -p "  Admin email (for SSL certificate):          " EMAIL
fi

if [ -n "$LICENSE_PATH_ARG" ]; then
  LICENSE_PATH="$LICENSE_PATH_ARG"
else
  read -e -p "  Path to your LICENSE.key file:              " LICENSE_PATH
fi

echo ""
if [ -n "$DB_PASS_ARG" ]; then
  DB_PASS="$DB_PASS_ARG"
else
  read -s -p "  Choose a MySQL password for EduDesk:       " DB_PASS
  echo ""
  read -s -p "  Confirm MySQL password:                    " DB_PASS_CONFIRM
  echo ""
  if [ "$DB_PASS" != "$DB_PASS_CONFIRM" ]; then
    echo -e "${RED}❌ Passwords do not match. Please run the script again.${NC}"
    exit 1
  fi
fi

# Validate license file exists
if [ ! -f "$LICENSE_PATH" ]; then
  echo -e "${RED}❌ LICENSE.key file not found at: $LICENSE_PATH${NC}"
  exit 1
fi

echo ""
echo -e "  ${BOLD}Summary:${NC}"
echo -e "   Domain   : ${BOLD}$DOMAIN${NC}"
case "$SSL_MODE" in
  selfsigned)  echo -e "   SSL Type : ${BOLD}Self-signed (internal)${NC}" ;;
  letsencrypt) echo -e "   SSL Type : ${BOLD}Let's Encrypt${NC}" ;;
  commercial)  echo -e "   SSL Type : ${BOLD}Commercial certificate${NC}" ;;
esac
echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 2 — Install System Dependencies
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}📦 Installing system dependencies...${NC}"

apt-get update -qq

# Node.js 20
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  echo "   Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs -qq
fi
echo -e "   ${GREEN}✓${NC} Node.js $(node -v)"

# Git
if ! command -v git &> /dev/null; then
  apt-get install -y git -qq
fi
echo -e "   ${GREEN}✓${NC} Git $(git --version | awk '{print $3}')"

# Nginx
if ! command -v nginx &> /dev/null; then
  apt-get install -y nginx -qq
fi
echo -e "   ${GREEN}✓${NC} Nginx"

# Certbot — only for Let's Encrypt
if [ "$SSL_MODE" = "letsencrypt" ]; then
  if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot python3-certbot-nginx -qq
  fi
  echo -e "   ${GREEN}✓${NC} Certbot"
fi

# openssl
if ! command -v openssl &> /dev/null; then
  apt-get install -y openssl -qq
fi
echo -e "   ${GREEN}✓${NC} OpenSSL"

# MySQL
if ! command -v mysql &> /dev/null; then
  apt-get install -y mysql-server -qq
fi
echo -e "   ${GREEN}✓${NC} MySQL"

# systemd is built into every modern Linux — nothing to install
echo -e "   ${GREEN}✓${NC} systemd $(systemctl --version | head -1 | awk '{print $2}')"

echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 3 — Validate License
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}🔍 Validating license...${NC}"

LICENSE_RESULT=$(node -e "
const crypto = require('crypto');
const fs     = require('fs');

const PUBLIC_KEY = process.env.EDUDESK_PUBLIC_KEY;

try {
  const license   = JSON.parse(fs.readFileSync('$LICENSE_PATH', 'utf8'));
  const { signature, ...payload } = license;
  const verify    = crypto.createVerify('RSA-SHA256');
  verify.update(JSON.stringify(payload));
  const valid     = verify.verify(PUBLIC_KEY, signature, 'base64');

  if (!valid) { console.log('INVALID'); process.exit(1); }

  if (license.type === 'DEMO' && license.trialEndsAt) {
    const today = new Date().toISOString().split('T')[0];
    if (today > license.trialEndsAt) { console.log('EXPIRED'); process.exit(1); }
  }

  console.log([
    'VALID',
    license.type,
    license.licensee,
    license.domain,
    license.issuedAt,
    license.trialEndsAt || '',
    license.updatesUntil || '',
  ].join('|'));
} catch(e) {
  console.log('ERROR:' + e.message);
  process.exit(1);
}
" 2>&1)

if [[ "$LICENSE_RESULT" == "INVALID" ]]; then
  echo -e "${RED}❌ License is invalid or tampered. Contact support@ctitans.com${NC}"
  exit 1
elif [[ "$LICENSE_RESULT" == "EXPIRED" ]]; then
  echo -e "${RED}❌ Trial license has expired. Contact support@ctitans.com to purchase.${NC}"
  exit 1
elif [[ "$LICENSE_RESULT" == ERROR* ]]; then
  echo -e "${RED}❌ License error: ${LICENSE_RESULT}${NC}"
  exit 1
fi

LICENSE_TYPE=$(echo "$LICENSE_RESULT"     | cut -d'|' -f2)
LICENSE_LICENSEE=$(echo "$LICENSE_RESULT" | cut -d'|' -f3)
LICENSE_DOMAIN=$(echo "$LICENSE_RESULT"   | cut -d'|' -f4)
LICENSE_ISSUED=$(echo "$LICENSE_RESULT"   | cut -d'|' -f5)
LICENSE_TRIAL=$(echo "$LICENSE_RESULT"    | cut -d'|' -f6)
LICENSE_UPDATES=$(echo "$LICENSE_RESULT"  | cut -d'|' -f7)

echo -e "${GREEN}✅ License valid${NC}"
echo -e "   Licensee : ${BOLD}$LICENSE_LICENSEE${NC}"
echo -e "   Type     : ${BOLD}$LICENSE_TYPE${NC}"
echo -e "   Domain   : ${BOLD}$LICENSE_DOMAIN${NC}"

# Warn if domain mismatch on PRODUCTION
if [ "$LICENSE_TYPE" == "PRODUCTION" ] && [ "$LICENSE_DOMAIN" != "$DOMAIN" ] && [ "$LICENSE_DOMAIN" != "edudesk.local" ]; then
  echo ""
  echo -e "${RED}❌ Domain mismatch!${NC}"
  echo -e "   License issued for : ${BOLD}$LICENSE_DOMAIN${NC}"
  echo -e "   You entered        : ${BOLD}$DOMAIN${NC}"
  echo -e "   Contact support@ctitans.com"
  exit 1
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 4 — Clone Repository
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}📥 Cloning EduDesk...${NC}"

if [ -d "$APP_DIR" ] && [ ! -f "$APP_DIR/package.json" ]; then
  echo -e "${YELLOW}   Removing incomplete installation...${NC}"
  rm -rf $APP_DIR
fi

if [ ! -d "$APP_DIR" ]; then
  mkdir -p /home/edudesk
  git clone https://github.com/saba7oo/edudesk-onprem.git $APP_DIR -q
  echo -e "${GREEN}✅ Repository cloned${NC}"
else
  echo -e "${YELLOW}ℹ️  Directory already exists, skipping clone${NC}"
fi

cd $APP_DIR
echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 6 — Configure MySQL
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}🗄️  Configuring MySQL...${NC}"

systemctl start mysql
systemctl enable mysql -q

mysql -u root << EOF
CREATE DATABASE IF NOT EXISTS edudesk
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'edudesk'@'localhost'
  IDENTIFIED BY '$DB_PASS';

GRANT ALL PRIVILEGES ON edudesk.* TO 'edudesk'@'localhost';

FLUSH PRIVILEGES;
EOF

mkdir -p $BACKUP_DIR
echo -e "${GREEN}✅ Database 'edudesk' created${NC}"
echo -e "${GREEN}✅ MySQL user 'edudesk' ready${NC}"

# Verify MySQL access
echo -n "   Verifying MySQL access..."
if mysql -u edudesk -p"$DB_PASS" edudesk -e "SELECT 1;" &>/dev/null 2>&1; then
  echo -e " ${GREEN}✓${NC}"
else
  echo -e " ${RED}✗${NC}"
  echo -e "${RED}❌ Cannot connect to MySQL with edudesk credentials.${NC}"
  echo "   Check that MySQL is running and the password is correct."
  exit 1
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 7 — Configure Nginx
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}⚙️  Configuring Nginx...${NC}"

if [ "$SSL_MODE" = "letsencrypt" ]; then
  # Plain HTTP — certbot will rewrite this with SSL block
  cat > /etc/nginx/sites-available/edudesk << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
    }
}
EOF
else
  # Self-signed or commercial: write full SSL block now
  # Cert paths differ between modes — set them here
  if [ "$SSL_MODE" = "selfsigned" ]; then
    NGINX_CERT="$SELFSIGNED_CERT"
    NGINX_KEY="$SELFSIGNED_KEY"
  else
    NGINX_CERT="$COMMERCIAL_CERT"
    NGINX_KEY="$COMMERCIAL_KEY"
  fi

  cat > /etc/nginx/sites-available/edudesk << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate     $NGINX_CERT;
    ssl_certificate_key $NGINX_KEY;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
    }
}
EOF
fi

ln -sf /etc/nginx/sites-available/edudesk /etc/nginx/sites-enabled/edudesk
rm -f /etc/nginx/sites-enabled/default

# For letsencrypt: reload now (plain HTTP config, no cert needed yet)
# For selfsigned/commercial: skip reload — cert doesn't exist yet, STEP 8 will reload
if [ "$SSL_MODE" = "letsencrypt" ]; then
  nginx -t -q && systemctl reload nginx
fi
echo -e "${GREEN}✅ Nginx configured${NC}"

echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 8 — SSL Certificate
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}🔒 Configuring SSL certificate...${NC}"

case "$SSL_MODE" in

  selfsigned)
    echo -e "   Generating self-signed certificate (valid 10 years)..."
    openssl req -x509 -nodes -days 3650 \
      -newkey rsa:2048 \
      -keyout "$SELFSIGNED_KEY" \
      -out "$SELFSIGNED_CERT" \
      -subj "/C=US/ST=State/L=City/O=EduDesk/CN=$DOMAIN" \
      2>/dev/null
    chmod 600 "$SELFSIGNED_KEY"
    nginx -t -q && systemctl reload nginx
    echo -e "${GREEN}✅ Self-signed certificate generated${NC}"
    echo ""
    echo -e "   ${YELLOW}ℹ️  Browsers will show a security warning — expected for self-signed.${NC}"
    echo -e "   ${YELLOW}   Users click 'Advanced → Proceed' on first visit.${NC}"
    ;;

  letsencrypt)
    echo ""
    echo -e "${YELLOW}  ⚠️  DNS A record for ${BOLD}$DOMAIN${NC}${YELLOW} must point to this server's IP.${NC}"
    echo -e "${YELLOW}  ⚠️  Ports 80 and 443 must be open in your firewall.${NC}"
    echo ""
    read -p "  Press ENTER when DNS is ready: "
    certbot --nginx \
      -d "$DOMAIN" \
      --email "$EMAIL" \
      --agree-tos \
      --non-interactive \
      --redirect \
      -q
    echo -e "${GREEN}✅ SSL certificate obtained (auto-renewal enabled)${NC}"
    ;;

  commercial)
    collect_commercial_certs
    nginx -t -q && systemctl reload nginx
    echo -e "${GREEN}✅ Commercial SSL certificate installed${NC}"
    echo ""
    echo -e "   ${CYAN}ℹ️  To renew when your certificate expires:${NC}"
    echo -e "   ${BOLD}   sudo bash setup.sh --upgrade-ssl${NC}"
    ;;

esac

echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 9 — Configure Application
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}📝 Configuring application...${NC}"

NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Write .env directly — no template file needed
cat > $APP_DIR/.env << EOF
# ── Application ───────────────────────────────────────────────
APP_DOMAIN=$DOMAIN
NEXTAUTH_URL=https://$DOMAIN
NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# ── Database ──────────────────────────────────────────────────
DATABASE_URL=mysql://edudesk:$DB_PASS@localhost:3306/edudesk

# ── License ───────────────────────────────────────────────────
LICENSE_KEY_PATH=./LICENSE.key
LICENSE_TYPE=$LICENSE_TYPE
LICENSE_DOMAIN=$LICENSE_DOMAIN
LICENSE_ISSUED_AT=$LICENSE_ISSUED
LICENSE_TRIAL_ENDS=$LICENSE_TRIAL

# ── SSL ───────────────────────────────────────────────────────
SSL_MODE=$SSL_MODE

# ── OnPrem mode ───────────────────────────────────────────────
NEXT_PUBLIC_MODE=onprem
EOF

cp $LICENSE_PATH $APP_DIR/LICENSE.key

echo -e "${GREEN}✅ .env configured${NC}"
echo -e "${GREEN}✅ LICENSE.key installed${NC}"

echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 10 — Install Packages & Migrate
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}📦 Installing packages...${NC}"
cd $APP_DIR
npm install --legacy-peer-deps -q
echo -e "${GREEN}✅ Packages installed${NC}"

echo ""
echo -e "${BOLD}🗃️  Running database migrations...${NC}"
# Pin to prisma v5 — v7 dropped schema.prisma datasource url support
npm install prisma@"^5.11.0" ts-node@"^10.9.2" --no-save --legacy-peer-deps -q 2>/dev/null
./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma
# Safety net: push any schema additions not covered by a migration file
./node_modules/.bin/prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>/dev/null || true
echo -e "${GREEN}✅ Database migrated${NC}"

echo ""
echo -e "${BOLD}🌱 Seeding default tenant...${NC}"
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' ./node_modules/.bin/ts-node --project tsconfig.json prisma/seed.onprem.ts
echo -e "${GREEN}✅ Default tenant created${NC}"

echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 11 — Start Application
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}🚀 Starting EduDesk...${NC}"

# Create systemd service so EduDesk starts on boot and picks up .env reliably
cat > /etc/systemd/system/edudesk.service << SVCEOF
[Unit]
Description=EduDesk On-Prem Helpdesk
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=10
EnvironmentFile=-$APP_DIR/.env

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable edudesk -q
systemctl restart edudesk

echo -e "${GREEN}✅ EduDesk started (auto-starts on server reboot)${NC}"

echo ""
echo -e "${BOLD}⏳ Waiting for application to be ready...${NC}"
for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Application is responding${NC}"
    break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo -e "${YELLOW}⚠️  Taking longer than expected. Check logs: journalctl -u edudesk -n 50${NC}"
  fi
done

# ══════════════════════════════════════════════════════════════
# DONE
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}   ✅ EduDesk OnPrem is ready!              ${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "   🌐 URL      : ${BOLD}https://$DOMAIN${NC}"
echo -e "   📧 Login    : ${BOLD}admin@edudesk.local${NC}"
echo -e "   🔑 Password : ${BOLD}changeme123${NC}"
echo ""
echo -e "   ${YELLOW}⚠️  Change your password immediately after first login!${NC}"
echo ""

case "$SSL_MODE" in
  selfsigned)
    echo -e "   ${YELLOW}⚠️  Self-signed SSL: browsers show a security warning.${NC}"
    echo -e "   ${YELLOW}   Click 'Advanced → Proceed' to continue.${NC}"
    echo -e "   ${YELLOW}   Upgrade to trusted SSL when DNS is ready:${NC}"
    echo -e "   ${BOLD}${CYAN}   sudo bash setup.sh --upgrade-ssl${NC}"
    echo ""
    ;;
  commercial)
    echo -e "   ${CYAN}ℹ️  Commercial SSL installed.${NC}"
    echo -e "   ${CYAN}   To renew when your certificate expires:${NC}"
    echo -e "   ${BOLD}${CYAN}   sudo bash setup.sh --upgrade-ssl${NC}"
    echo ""
    ;;
esac

echo -e "   Useful commands:"
echo -e "   ${CYAN}journalctl -u edudesk -f${NC}           — View logs"
echo -e "   ${CYAN}systemctl restart edudesk${NC}         — Restart"
echo -e "   ${CYAN}bash update.sh${NC}                    — Update to latest"
echo -e "   ${CYAN}sudo bash setup.sh --upgrade-ssl${NC}  — Replace SSL certificate"
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo -e "   Powered by CloudTitans © 2026 · EduDesk v3.0"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo ""
