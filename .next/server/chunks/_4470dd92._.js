module.exports=[5310,e=>e.a(async(t,n)=>{try{var a=e.i(89171),E=e.i(38895),s=e.i(33405),A=e.i(22734),T=t([E]);[E]=T.then?(await T)():T;let d="/tmp/edudesk-update.log",L="/tmp/edudesk-update.lock";async function r(){let{error:e}=await (0,E.requireAuth)(["TENANT_ADMIN"]);if(e)return e;let t=A.default.existsSync(L);return a.NextResponse.json({running:t})}async function i(){let{error:e}=await (0,E.requireAuth)(["TENANT_ADMIN"]);if(e)return e;if(A.default.existsSync(L))return a.NextResponse.json({error:"An update is already in progress"},{status:409});A.default.writeFileSync(d,""),A.default.writeFileSync(L,String(Date.now()));let t=`#!/bin/bash
set -e
LOG="${d}"
LOCK="${L}"
APP_DIR="/home/edudesk/edudesk"
REPO="saba7oo/edudesk-onprem"

log() { echo "$1" | tee -a "$LOG"; }
cleanup() { rm -f "$LOCK"; }
trap cleanup EXIT

log "▶ Pulling latest version..."

# Get latest version from raw package.json — no rate limit, no token needed
LATEST_TAG=$(curl -fsSLk "https://raw.githubusercontent.com/\${REPO}/main/package.json" --max-time 15 \\
  | node -pe "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); 'v'+d.version" 2>/dev/null)

if [ -z "$LATEST_TAG" ]; then
  log "✗ Could not fetch latest version from GitHub"
  exit 1
fi

# Download tarball
curl -fsSLk "https://github.com/\${REPO}/archive/refs/tags/\${LATEST_TAG}.tar.gz" \\
  -o /tmp/edudesk-update.tar.gz --max-time 120 >> "$LOG" 2>&1

# Extract and copy — .env / LICENSE.key / node_modules are gitignored so never in tarball
rm -rf /tmp/edudesk-update/
mkdir -p /tmp/edudesk-update
tar -xzf /tmp/edudesk-update.tar.gz -C /tmp/edudesk-update --strip-components=1
cp -a /tmp/edudesk-update/. "\${APP_DIR}/"
rm -rf /tmp/edudesk-update /tmp/edudesk-update.tar.gz

NEW_VERSION=$(node -p "require('\${APP_DIR}/package.json').version" 2>/dev/null || echo "unknown")
log "✓ Updated to v\${NEW_VERSION}"

cd "\${APP_DIR}"
log ""
log "▶ Installing packages..."
npm install --legacy-peer-deps -q >> "$LOG" 2>&1
log "✓ Packages ready"

log ""
log "▶ Running database migrations..."
PRISMA="./node_modules/.bin/prisma"
SCHEMA="--schema=prisma/schema.prisma"

$PRISMA generate $SCHEMA >> "$LOG" 2>&1 || true

# Idempotent SQL — safe to run on any install state (ignores already-exists errors)
run_sql() {
  echo "$1" | $PRISMA db execute $SCHEMA --stdin 2>&1 \\
    | grep -vi "already exists\\|Duplicate column\\|Duplicate key\\|Duplicate foreign key\\|Can't create table\\|Script executed" || true
}

run_sql "ALTER TABLE \`users\` ADD COLUMN \`adSyncLocked\` BOOLEAN NOT NULL DEFAULT false"
run_sql "ALTER TABLE \`users\` ADD COLUMN \`managerId\` VARCHAR(191) NULL"
run_sql "ALTER TABLE \`users\` ADD CONSTRAINT \`users_managerId_fkey\` FOREIGN KEY (\`managerId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE"
run_sql "ALTER TABLE \`categories\` ADD COLUMN \`type\` ENUM('NORMAL','DROPDOWN','TEXT_FIELD') NOT NULL DEFAULT 'NORMAL'"
run_sql "ALTER TABLE \`categories\` ADD COLUMN \`dropdownOptions\` TEXT NULL"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`categoryDetail\` VARCHAR(191) NULL"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`createdByAgentId\` VARCHAR(191) NULL"
run_sql "ALTER TABLE \`tickets\` ADD CONSTRAINT \`tickets_createdByAgentId_fkey\` FOREIGN KEY (\`createdByAgentId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`managerApprovalStatus\` ENUM('PENDING','APPROVED','REJECTED') NULL"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`managerApprovalRequestedAt\` DATETIME(3) NULL"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`managerApprovalRespondedAt\` DATETIME(3) NULL"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`managerApprovalNote\` TEXT NULL"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`managerNotifiedAt\` DATETIME(3) NULL"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`requestedManagerId\` VARCHAR(191) NULL"
run_sql "ALTER TABLE \`tickets\` ADD CONSTRAINT \`tickets_requestedManagerId_fkey\` FOREIGN KEY (\`requestedManagerId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE"
run_sql "CREATE TABLE IF NOT EXISTS \`email_templates\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`key\` VARCHAR(191) NOT NULL, \`name\` VARCHAR(191) NOT NULL, \`subject\` TEXT NOT NULL, \`body\` LONGTEXT NOT NULL, \`variables\` TEXT NULL, \`isDefault\` BOOLEAN NOT NULL DEFAULT false, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`email_templates_tenantId_key_key\`(\`tenantId\`, \`key\`), INDEX \`email_templates_tenantId_idx\`(\`tenantId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`email_templates\` ADD CONSTRAINT \`email_templates_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "CREATE TABLE IF NOT EXISTS \`email_actions\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`trigger\` VARCHAR(191) NOT NULL, \`templateId\` VARCHAR(191) NOT NULL, \`recipientType\` VARCHAR(191) NOT NULL, \`recipientValue\` VARCHAR(191) NULL, \`isEnabled\` BOOLEAN NOT NULL DEFAULT true, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`email_actions_tenantId_idx\`(\`tenantId\`), INDEX \`email_actions_trigger_idx\`(\`trigger\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`email_actions\` ADD CONSTRAINT \`email_actions_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "ALTER TABLE \`email_actions\` ADD CONSTRAINT \`email_actions_templateId_fkey\` FOREIGN KEY (\`templateId\`) REFERENCES \`email_templates\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "CREATE TABLE IF NOT EXISTS \`dept_admin_departments\` (\`id\` VARCHAR(191) NOT NULL, \`adminId\` VARCHAR(191) NOT NULL, \`department\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX \`dept_admin_departments_adminId_department_key\`(\`adminId\`, \`department\`), INDEX \`dept_admin_departments_adminId_idx\`(\`adminId\`), INDEX \`dept_admin_departments_tenantId_idx\`(\`tenantId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`dept_admin_departments\` ADD CONSTRAINT \`dept_admin_departments_adminId_fkey\` FOREIGN KEY (\`adminId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "ALTER TABLE \`users\` ADD COLUMN \`isDeptAdmin\` BOOLEAN NOT NULL DEFAULT false"
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
run_sql "ALTER TABLE \`notifications\` ADD CONSTRAINT \`notifications_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "ALTER TABLE \`notifications\` ADD CONSTRAINT \`notifications_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "ALTER TABLE \`tenant_branding\` ADD COLUMN \`loginHeadline\` TEXT NULL"
run_sql "ALTER TABLE \`tenant_branding\` ADD COLUMN \`loginSubtitle\` TEXT NULL"
run_sql "ALTER TABLE \`tenant_branding\` ADD COLUMN \`loginBannerImageUrl\` VARCHAR(767) NULL"
run_sql "ALTER TABLE \`tenant_branding\` ADD COLUMN \`loginButtons\` TEXT NULL"
run_sql "ALTER TABLE \`sla_configs\` MODIFY COLUMN \`responseHours\` FLOAT NOT NULL DEFAULT 0"
run_sql "ALTER TABLE \`sla_configs\` MODIFY COLUMN \`resolveHours\` FLOAT NOT NULL DEFAULT 0"
run_sql "CREATE TABLE IF NOT EXISTS \`working_hours\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`enabled\` BOOLEAN NOT NULL DEFAULT false, \`workDays\` TEXT NOT NULL, \`startHour\` FLOAT NOT NULL DEFAULT 9, \`endHour\` FLOAT NOT NULL DEFAULT 17, \`timezone\` VARCHAR(100) NOT NULL DEFAULT 'UTC', \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`working_hours_tenantId_key\`(\`tenantId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`working_hours\` ADD CONSTRAINT \`working_hours_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "ALTER TABLE \`ad_configs\` ADD COLUMN \`ldapManagerGroups\` TEXT NULL"
run_sql "ALTER TABLE \`ad_configs\` ADD COLUMN \`azureManagerGroups\` TEXT NULL"
run_sql "ALTER TABLE \`ad_configs\` ADD COLUMN \`googleManagerGroups\` TEXT NULL"
run_sql "ALTER TABLE \`tickets\` ADD COLUMN \`staffManagerId\` VARCHAR(191) NULL"
run_sql "ALTER TABLE \`tickets\` ADD CONSTRAINT \`tickets_staffManagerId_fkey\` FOREIGN KEY (\`staffManagerId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE"
run_sql "CREATE TABLE IF NOT EXISTS \`ola_configs\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`fromDepartment\` VARCHAR(191) NOT NULL, \`toDepartment\` VARCHAR(191) NOT NULL, \`priority\` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL, \`responseHours\` FLOAT NOT NULL, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`ola_configs_tenantId_fromDepartment_toDepartment_priority_key\`(\`tenantId\`,\`fromDepartment\`,\`toDepartment\`,\`priority\`), INDEX \`ola_configs_tenantId_idx\`(\`tenantId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`ola_configs\` ADD CONSTRAINT \`ola_configs_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "CREATE TABLE IF NOT EXISTS \`ola_logs\` (\`id\` VARCHAR(191) NOT NULL, \`ticketId\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`fromDepartment\` VARCHAR(191) NOT NULL, \`toDepartment\` VARCHAR(191) NOT NULL, \`priority\` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL, \`responseHours\` FLOAT NOT NULL, \`startedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`respondedAt\` DATETIME(3) NULL, \`breached\` BOOLEAN NOT NULL DEFAULT false, \`notifiedAt\` DATETIME(3) NULL, \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX \`ola_logs_ticketId_key\`(\`ticketId\`), INDEX \`ola_logs_tenantId_idx\`(\`tenantId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`ola_logs\` ADD CONSTRAINT \`ola_logs_ticketId_fkey\` FOREIGN KEY (\`ticketId\`) REFERENCES \`tickets\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"

# Resolve any failed Prisma migrations (schema already synced above)
MIGRATE_STATUS=$($PRISMA migrate status $SCHEMA 2>&1)
echo "$MIGRATE_STATUS" | grep -oE '[0-9]{14}_[a-zA-Z0-9_]+' | while read migration; do
  if echo "$MIGRATE_STATUS" | grep -A2 "$migration" | grep -q "failed"; then
    $PRISMA migrate resolve --applied "$migration" $SCHEMA 2>/dev/null || true
  fi
done
$PRISMA migrate deploy $SCHEMA >> "$LOG" 2>&1 || true

log "✓ Migrations applied"

log ""
log ""
log "RESTARTING"
rm -f "$LOCK"

# Restart must happen OUTSIDE the edudesk systemd cgroup, otherwise
# systemctl stop kills this script before restart can complete.
# Strategy: try three methods in order, log which one is used.

RESTART_SCHEDULED=0

# 1. systemd-run: creates a transient timer unit in systemd itself (survives cgroup teardown)
if [ $RESTART_SCHEDULED -eq 0 ] && command -v systemd-run >/dev/null 2>&1; then
  if systemd-run --no-ask-password --on-active=8 /bin/systemctl stop edudesk ';' sleep 3 ';' /bin/systemctl start edudesk >> "$LOG" 2>&1; then
    log "✓ Restart scheduled via systemd-run (8s)"
    RESTART_SCHEDULED=1
  else
    # Try simpler form
    if systemd-run --no-ask-password --on-active=8 /bin/systemctl restart edudesk >> "$LOG" 2>&1; then
      log "✓ Restart scheduled via systemd-run restart (8s)"
      RESTART_SCHEDULED=1
    else
      log "⚠ systemd-run failed, trying next method..."
    fi
  fi
fi

# 2. 'at' command: atd daemon owns the job, completely outside any service cgroup
if [ $RESTART_SCHEDULED -eq 0 ] && command -v at >/dev/null 2>&1 && systemctl is-active --quiet atd 2>/dev/null; then
  echo "/bin/systemctl stop edudesk; sleep 3; /bin/systemctl start edudesk" | at "now + 1 minute" >> "$LOG" 2>&1 && RESTART_SCHEDULED=1
  [ $RESTART_SCHEDULED -eq 1 ] && log "✓ Restart scheduled via at (1 min)"
fi

# 3. Write a restart script and launch via nohup with new process group (last resort)
if [ $RESTART_SCHEDULED -eq 0 ]; then
  log "⚠ Using background process fallback (manual restart may be needed if this fails)"
  RSTSCRIPT="/tmp/edudesk-do-restart.sh"
  echo '#!/bin/bash' > "$RSTSCRIPT"
  echo 'sleep 10' >> "$RSTSCRIPT"
  echo '/bin/systemctl stop edudesk 2>/dev/null; sleep 3; /bin/systemctl start edudesk' >> "$RSTSCRIPT"
  chmod +x "$RSTSCRIPT"
  nohup "$RSTSCRIPT" > /dev/null 2>&1 &
  disown $! 2>/dev/null || true
fi
`,n="/tmp/edudesk-update-run.sh";return A.default.writeFileSync(n,t,{mode:493}),(0,s.spawn)("bash",[n],{detached:!0,stdio:"ignore"}).unref(),a.NextResponse.json({started:!0})}e.s(["GET",()=>r,"POST",()=>i]),n()}catch(e){n(e)}},!1),25734,e=>e.a(async(t,n)=>{try{var a=e.i(47909),E=e.i(74017),s=e.i(96250),A=e.i(59756),T=e.i(61916),r=e.i(74677),i=e.i(69741),d=e.i(16795),L=e.i(87718),o=e.i(95169),N=e.i(47587),R=e.i(66012),l=e.i(70101),u=e.i(26937),c=e.i(70909),D=e.i(93695);e.i(52474);var C=e.i(220),I=e.i(5310),O=t([I]);[I]=O.then?(await O)():O;let p=new a.AppRouteRouteModule({definition:{kind:E.RouteKind.APP_ROUTE,page:"/api/system/update/route",pathname:"/api/system/update",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/system/update/route.ts",nextConfigOutput:"",userland:I}),{workAsyncStorage:m,workUnitAsyncStorage:S,serverHooks:f}=p;function U(){return(0,s.patchFetch)({workAsyncStorage:m,workUnitAsyncStorage:S})}async function _(e,t,n){p.isDev&&(0,A.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/system/update/route";a=a.replace(/\/index$/,"")||"/";let s=await p.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!s)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:I,params:O,nextConfig:U,parsedUrl:_,isDraftMode:m,prerenderManifest:S,routerServerContext:f,isOnDemandRevalidate:g,revalidateOnlyGenerated:M,resolvedPathname:h,clientReferenceManifest:y,serverActionsManifest:k}=s,F=(0,i.normalizeAppPath)(a),P=!!(S.dynamicRoutes[F]||S.routes[h]),H=async()=>((null==f?void 0:f.render404)?await f.render404(e,t,_,!1):t.end("This page could not be found"),null);if(P&&!m){let e=!!S.routes[h],t=S.dynamicRoutes[F];if(t&&!1===t.fallback&&!e){if(U.experimental.adapterPath)return await H();throw new D.NoFallbackError}}let v=null;!P||p.isDev||m||(v=h,v="/index"===v?"/":v);let q=!0===p.isDev||!P,b=P&&!q;k&&y&&(0,r.setManifestsSingleton)({page:a,clientReferenceManifest:y,serverActionsManifest:k});let B=e.method||"GET",w=(0,T.getTracer)(),$=w.getActiveScopeSpan(),x={params:O,prerenderManifest:S,renderOpts:{experimental:{authInterrupts:!!U.experimental.authInterrupts},cacheComponents:!!U.cacheComponents,supportsDynamicResponse:q,incrementalCache:(0,A.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:U.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,n,a,E)=>p.onRequestError(e,t,a,E,f)},sharedContext:{buildId:I}},V=new d.NodeNextRequest(e),G=new d.NodeNextResponse(t),X=L.NextRequestAdapter.fromNodeNextRequest(V,(0,L.signalFromNodeResponse)(t));try{let s=async e=>p.handle(X,x).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let n=w.getRootSpanAttributes();if(!n)return;if(n.get("next.span_type")!==o.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${n.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let E=n.get("next.route");if(E){let t=`${B} ${E}`;e.setAttributes({"next.route":E,"http.route":E,"next.span_name":t}),e.updateName(t)}else e.updateName(`${B} ${a}`)}),r=!!(0,A.getRequestMeta)(e,"minimalMode"),i=async A=>{var T,i;let d=async({previousCacheEntry:E})=>{try{if(!r&&g&&M&&!E)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await s(A);e.fetchMetrics=x.renderOpts.fetchMetrics;let T=x.renderOpts.pendingWaitUntil;T&&n.waitUntil&&(n.waitUntil(T),T=void 0);let i=x.renderOpts.collectedTags;if(!P)return await (0,R.sendResponse)(V,G,a,x.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,l.toNodeOutgoingHttpHeaders)(a.headers);i&&(t[c.NEXT_CACHE_TAGS_HEADER]=i),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let n=void 0!==x.renderOpts.collectedRevalidate&&!(x.renderOpts.collectedRevalidate>=c.INFINITE_CACHE)&&x.renderOpts.collectedRevalidate,E=void 0===x.renderOpts.collectedExpire||x.renderOpts.collectedExpire>=c.INFINITE_CACHE?void 0:x.renderOpts.collectedExpire;return{value:{kind:C.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:n,expire:E}}}}catch(t){throw(null==E?void 0:E.isStale)&&await p.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:b,isOnDemandRevalidate:g})},!1,f),t}},L=await p.handleResponse({req:e,nextConfig:U,cacheKey:v,routeKind:E.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:g,revalidateOnlyGenerated:M,responseGenerator:d,waitUntil:n.waitUntil,isMinimalMode:r});if(!P)return null;if((null==L||null==(T=L.value)?void 0:T.kind)!==C.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==L||null==(i=L.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});r||t.setHeader("x-nextjs-cache",g?"REVALIDATED":L.isMiss?"MISS":L.isStale?"STALE":"HIT"),m&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let o=(0,l.fromNodeOutgoingHttpHeaders)(L.value.headers);return r&&P||o.delete(c.NEXT_CACHE_TAGS_HEADER),!L.cacheControl||t.getHeader("Cache-Control")||o.get("Cache-Control")||o.set("Cache-Control",(0,u.getCacheControlHeader)(L.cacheControl)),await (0,R.sendResponse)(V,G,new Response(L.value.body,{headers:o,status:L.value.status||200})),null};$?await i($):await w.withPropagatedContext(e.headers,()=>w.trace(o.BaseServerSpan.handleRequest,{spanName:`${B} ${a}`,kind:T.SpanKind.SERVER,attributes:{"http.method":B,"http.target":e.url}},i))}catch(t){if(t instanceof D.NoFallbackError||await p.onRequestError(e,t,{routerKind:"App Router",routePath:F,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:b,isOnDemandRevalidate:g})},!1,f),P)throw t;return await (0,R.sendResponse)(V,G,new Response(null,{status:500})),null}}e.s(["handler",()=>_,"patchFetch",()=>U,"routeModule",()=>p,"serverHooks",()=>f,"workAsyncStorage",()=>m,"workUnitAsyncStorage",()=>S]),n()}catch(e){n(e)}},!1)];

//# sourceMappingURL=_4470dd92._.js.map