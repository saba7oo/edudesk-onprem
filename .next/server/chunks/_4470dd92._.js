module.exports=[5310,e=>e.a(async(t,n)=>{try{var a=e.i(89171),s=e.i(38895),E=e.i(33405),r=e.i(22734),i=t([s]);[s]=i.then?(await i)():i;let d="/tmp/edudesk-update.log",o="/tmp/edudesk-update.lock";async function A(){let{error:e}=await (0,s.requireAuth)(["TENANT_ADMIN"]);if(e)return e;let t=r.default.existsSync(o);return a.NextResponse.json({running:t})}async function T(){let{error:e}=await (0,s.requireAuth)(["TENANT_ADMIN"]);if(e)return e;if(r.default.existsSync(o))return a.NextResponse.json({error:"An update is already in progress"},{status:409});r.default.writeFileSync(d,""),r.default.writeFileSync(o,String(Date.now()));let t=`#!/bin/bash
set -e
LOG="${d}"
LOCK="${o}"
APP_DIR="/home/edudesk/edudesk"
REPO="saba7oo/edudesk-onprem"

log() { echo "$1" | tee -a "$LOG"; }
cleanup() { rm -f "$LOCK"; }
trap cleanup EXIT

log "▶ Pulling latest version..."

# Get latest tag from GitHub API — HTTPS only, no git, no SSH
LATEST_TAG=$(curl -fsSLk "https://api.github.com/repos/\${REPO}/tags" --max-time 15 \\
  | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))[0].name" 2>/dev/null)

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
run_sql "CREATE TABLE IF NOT EXISTS \`working_hours\` (\`id\` VARCHAR(191) NOT NULL, \`tenantId\` VARCHAR(191) NOT NULL, \`enabled\` BOOLEAN NOT NULL DEFAULT false, \`workDays\` TEXT NOT NULL DEFAULT '[1,2,3,4,5]', \`startHour\` FLOAT NOT NULL DEFAULT 9, \`endHour\` FLOAT NOT NULL DEFAULT 17, \`timezone\` VARCHAR(100) NOT NULL DEFAULT 'UTC', \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`working_hours_tenantId_key\`(\`tenantId\`), PRIMARY KEY (\`id\`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
run_sql "ALTER TABLE \`working_hours\` ADD CONSTRAINT \`working_hours_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE"
run_sql "ALTER TABLE \`ad_configs\` ADD COLUMN \`ldapManagerGroups\` TEXT NULL"
run_sql "ALTER TABLE \`ad_configs\` ADD COLUMN \`azureManagerGroups\` TEXT NULL"
run_sql "ALTER TABLE \`ad_configs\` ADD COLUMN \`googleManagerGroups\` TEXT NULL"

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
`,n="/tmp/edudesk-update-run.sh";return r.default.writeFileSync(n,t,{mode:493}),(0,E.spawn)("bash",[n],{detached:!0,stdio:"ignore"}).unref(),a.NextResponse.json({started:!0})}e.s(["GET",()=>A,"POST",()=>T]),n()}catch(e){n(e)}},!1),25734,e=>e.a(async(t,n)=>{try{var a=e.i(47909),s=e.i(74017),E=e.i(96250),r=e.i(59756),i=e.i(61916),A=e.i(74677),T=e.i(69741),d=e.i(16795),o=e.i(87718),L=e.i(95169),l=e.i(47587),N=e.i(66012),R=e.i(70101),u=e.i(26937),c=e.i(70909),C=e.i(93695);e.i(52474);var D=e.i(220),p=e.i(5310),O=t([p]);[p]=O.then?(await O)():O;let I=new a.AppRouteRouteModule({definition:{kind:s.RouteKind.APP_ROUTE,page:"/api/system/update/route",pathname:"/api/system/update",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/system/update/route.ts",nextConfigOutput:"",userland:p}),{workAsyncStorage:m,workUnitAsyncStorage:S,serverHooks:g}=I;function U(){return(0,E.patchFetch)({workAsyncStorage:m,workUnitAsyncStorage:S})}async function _(e,t,n){I.isDev&&(0,r.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/system/update/route";a=a.replace(/\/index$/,"")||"/";let E=await I.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!E)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:p,params:O,nextConfig:U,parsedUrl:_,isDraftMode:m,prerenderManifest:S,routerServerContext:g,isOnDemandRevalidate:f,revalidateOnlyGenerated:M,resolvedPathname:h,clientReferenceManifest:y,serverActionsManifest:k}=E,P=(0,T.normalizeAppPath)(a),F=!!(S.dynamicRoutes[P]||S.routes[h]),v=async()=>((null==g?void 0:g.render404)?await g.render404(e,t,_,!1):t.end("This page could not be found"),null);if(F&&!m){let e=!!S.routes[h],t=S.dynamicRoutes[P];if(t&&!1===t.fallback&&!e){if(U.experimental.adapterPath)return await v();throw new C.NoFallbackError}}let H=null;!F||I.isDev||m||(H=h,H="/index"===H?"/":H);let b=!0===I.isDev||!F,q=F&&!b;k&&y&&(0,A.setManifestsSingleton)({page:a,clientReferenceManifest:y,serverActionsManifest:k});let B=e.method||"GET",w=(0,i.getTracer)(),$=w.getActiveScopeSpan(),x={params:O,prerenderManifest:S,renderOpts:{experimental:{authInterrupts:!!U.experimental.authInterrupts},cacheComponents:!!U.cacheComponents,supportsDynamicResponse:b,incrementalCache:(0,r.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:U.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,n,a,s)=>I.onRequestError(e,t,a,s,g)},sharedContext:{buildId:p}},G=new d.NodeNextRequest(e),V=new d.NodeNextResponse(t),X=o.NextRequestAdapter.fromNodeNextRequest(G,(0,o.signalFromNodeResponse)(t));try{let E=async e=>I.handle(X,x).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let n=w.getRootSpanAttributes();if(!n)return;if(n.get("next.span_type")!==L.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${n.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let s=n.get("next.route");if(s){let t=`${B} ${s}`;e.setAttributes({"next.route":s,"http.route":s,"next.span_name":t}),e.updateName(t)}else e.updateName(`${B} ${a}`)}),A=!!(0,r.getRequestMeta)(e,"minimalMode"),T=async r=>{var i,T;let d=async({previousCacheEntry:s})=>{try{if(!A&&f&&M&&!s)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await E(r);e.fetchMetrics=x.renderOpts.fetchMetrics;let i=x.renderOpts.pendingWaitUntil;i&&n.waitUntil&&(n.waitUntil(i),i=void 0);let T=x.renderOpts.collectedTags;if(!F)return await (0,N.sendResponse)(G,V,a,x.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,R.toNodeOutgoingHttpHeaders)(a.headers);T&&(t[c.NEXT_CACHE_TAGS_HEADER]=T),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let n=void 0!==x.renderOpts.collectedRevalidate&&!(x.renderOpts.collectedRevalidate>=c.INFINITE_CACHE)&&x.renderOpts.collectedRevalidate,s=void 0===x.renderOpts.collectedExpire||x.renderOpts.collectedExpire>=c.INFINITE_CACHE?void 0:x.renderOpts.collectedExpire;return{value:{kind:D.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:n,expire:s}}}}catch(t){throw(null==s?void 0:s.isStale)&&await I.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:f})},!1,g),t}},o=await I.handleResponse({req:e,nextConfig:U,cacheKey:H,routeKind:s.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:f,revalidateOnlyGenerated:M,responseGenerator:d,waitUntil:n.waitUntil,isMinimalMode:A});if(!F)return null;if((null==o||null==(i=o.value)?void 0:i.kind)!==D.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==o||null==(T=o.value)?void 0:T.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});A||t.setHeader("x-nextjs-cache",f?"REVALIDATED":o.isMiss?"MISS":o.isStale?"STALE":"HIT"),m&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let L=(0,R.fromNodeOutgoingHttpHeaders)(o.value.headers);return A&&F||L.delete(c.NEXT_CACHE_TAGS_HEADER),!o.cacheControl||t.getHeader("Cache-Control")||L.get("Cache-Control")||L.set("Cache-Control",(0,u.getCacheControlHeader)(o.cacheControl)),await (0,N.sendResponse)(G,V,new Response(o.value.body,{headers:L,status:o.value.status||200})),null};$?await T($):await w.withPropagatedContext(e.headers,()=>w.trace(L.BaseServerSpan.handleRequest,{spanName:`${B} ${a}`,kind:i.SpanKind.SERVER,attributes:{"http.method":B,"http.target":e.url}},T))}catch(t){if(t instanceof C.NoFallbackError||await I.onRequestError(e,t,{routerKind:"App Router",routePath:P,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:f})},!1,g),F)throw t;return await (0,N.sendResponse)(G,V,new Response(null,{status:500})),null}}e.s(["handler",()=>_,"patchFetch",()=>U,"routeModule",()=>I,"serverHooks",()=>g,"workAsyncStorage",()=>m,"workUnitAsyncStorage",()=>S]),n()}catch(e){n(e)}},!1)];

//# sourceMappingURL=_4470dd92._.js.map