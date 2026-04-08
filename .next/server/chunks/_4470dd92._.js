module.exports=[5310,e=>e.a(async(t,a)=>{try{var n=e.i(89171),s=e.i(38895),i=e.i(33405),E=e.i(22734),r=t([s]);[s]=r.then?(await r)():r;let T="/tmp/edudesk-update.log",o="/tmp/edudesk-update.lock";async function A(){let{error:e}=await (0,s.requireAuth)(["TENANT_ADMIN"]);if(e)return e;let t=E.default.existsSync(o);return n.NextResponse.json({running:t})}async function d(){let{error:e}=await (0,s.requireAuth)(["TENANT_ADMIN"]);if(e)return e;if(E.default.existsSync(o))return n.NextResponse.json({error:"An update is already in progress"},{status:409});E.default.writeFileSync(T,""),E.default.writeFileSync(o,String(Date.now()));let t=`#!/bin/bash
set -e
LOG="${T}"
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
`,a="/tmp/edudesk-update-run.sh";return E.default.writeFileSync(a,t,{mode:493}),(0,i.spawn)("bash",[a],{detached:!0,stdio:"ignore"}).unref(),n.NextResponse.json({started:!0})}e.s(["GET",()=>A,"POST",()=>d]),a()}catch(e){a(e)}},!1),25734,e=>e.a(async(t,a)=>{try{var n=e.i(47909),s=e.i(74017),i=e.i(96250),E=e.i(59756),r=e.i(61916),A=e.i(74677),d=e.i(69741),T=e.i(16795),o=e.i(87718),l=e.i(95169),L=e.i(47587),R=e.i(66012),u=e.i(70101),N=e.i(26937),c=e.i(70909),p=e.i(93695);e.i(52474);var C=e.i(220),D=e.i(5310),I=t([D]);[D]=I.then?(await I)():I;let U=new n.AppRouteRouteModule({definition:{kind:s.RouteKind.APP_ROUTE,page:"/api/system/update/route",pathname:"/api/system/update",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/system/update/route.ts",nextConfigOutput:"",userland:D}),{workAsyncStorage:m,workUnitAsyncStorage:S,serverHooks:f}=U;function O(){return(0,i.patchFetch)({workAsyncStorage:m,workUnitAsyncStorage:S})}async function _(e,t,a){U.isDev&&(0,E.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let n="/api/system/update/route";n=n.replace(/\/index$/,"")||"/";let i=await U.prepare(e,t,{srcPage:n,multiZoneDraftMode:!1});if(!i)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:D,params:I,nextConfig:O,parsedUrl:_,isDraftMode:m,prerenderManifest:S,routerServerContext:f,isOnDemandRevalidate:g,revalidateOnlyGenerated:h,resolvedPathname:y,clientReferenceManifest:M,serverActionsManifest:k}=i,P=(0,d.normalizeAppPath)(n),v=!!(S.dynamicRoutes[P]||S.routes[y]),H=async()=>((null==f?void 0:f.render404)?await f.render404(e,t,_,!1):t.end("This page could not be found"),null);if(v&&!m){let e=!!S.routes[y],t=S.dynamicRoutes[P];if(t&&!1===t.fallback&&!e){if(O.experimental.adapterPath)return await H();throw new p.NoFallbackError}}let F=null;!v||U.isDev||m||(F=y,F="/index"===F?"/":F);let b=!0===U.isDev||!v,q=v&&!b;k&&M&&(0,A.setManifestsSingleton)({page:n,clientReferenceManifest:M,serverActionsManifest:k});let B=e.method||"GET",w=(0,r.getTracer)(),$=w.getActiveScopeSpan(),x={params:I,prerenderManifest:S,renderOpts:{experimental:{authInterrupts:!!O.experimental.authInterrupts},cacheComponents:!!O.cacheComponents,supportsDynamicResponse:b,incrementalCache:(0,E.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:O.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,n,s)=>U.onRequestError(e,t,n,s,f)},sharedContext:{buildId:D}},G=new T.NodeNextRequest(e),V=new T.NodeNextResponse(t),K=o.NextRequestAdapter.fromNodeNextRequest(G,(0,o.signalFromNodeResponse)(t));try{let i=async e=>U.handle(K,x).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=w.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==l.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let s=a.get("next.route");if(s){let t=`${B} ${s}`;e.setAttributes({"next.route":s,"http.route":s,"next.span_name":t}),e.updateName(t)}else e.updateName(`${B} ${n}`)}),A=!!(0,E.getRequestMeta)(e,"minimalMode"),d=async E=>{var r,d;let T=async({previousCacheEntry:s})=>{try{if(!A&&g&&h&&!s)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await i(E);e.fetchMetrics=x.renderOpts.fetchMetrics;let r=x.renderOpts.pendingWaitUntil;r&&a.waitUntil&&(a.waitUntil(r),r=void 0);let d=x.renderOpts.collectedTags;if(!v)return await (0,R.sendResponse)(G,V,n,x.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,u.toNodeOutgoingHttpHeaders)(n.headers);d&&(t[c.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==x.renderOpts.collectedRevalidate&&!(x.renderOpts.collectedRevalidate>=c.INFINITE_CACHE)&&x.renderOpts.collectedRevalidate,s=void 0===x.renderOpts.collectedExpire||x.renderOpts.collectedExpire>=c.INFINITE_CACHE?void 0:x.renderOpts.collectedExpire;return{value:{kind:C.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:s}}}}catch(t){throw(null==s?void 0:s.isStale)&&await U.onRequestError(e,t,{routerKind:"App Router",routePath:n,routeType:"route",revalidateReason:(0,L.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:g})},!1,f),t}},o=await U.handleResponse({req:e,nextConfig:O,cacheKey:F,routeKind:s.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:g,revalidateOnlyGenerated:h,responseGenerator:T,waitUntil:a.waitUntil,isMinimalMode:A});if(!v)return null;if((null==o||null==(r=o.value)?void 0:r.kind)!==C.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==o||null==(d=o.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});A||t.setHeader("x-nextjs-cache",g?"REVALIDATED":o.isMiss?"MISS":o.isStale?"STALE":"HIT"),m&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,u.fromNodeOutgoingHttpHeaders)(o.value.headers);return A&&v||l.delete(c.NEXT_CACHE_TAGS_HEADER),!o.cacheControl||t.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,N.getCacheControlHeader)(o.cacheControl)),await (0,R.sendResponse)(G,V,new Response(o.value.body,{headers:l,status:o.value.status||200})),null};$?await d($):await w.withPropagatedContext(e.headers,()=>w.trace(l.BaseServerSpan.handleRequest,{spanName:`${B} ${n}`,kind:r.SpanKind.SERVER,attributes:{"http.method":B,"http.target":e.url}},d))}catch(t){if(t instanceof p.NoFallbackError||await U.onRequestError(e,t,{routerKind:"App Router",routePath:P,routeType:"route",revalidateReason:(0,L.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:g})},!1,f),v)throw t;return await (0,R.sendResponse)(G,V,new Response(null,{status:500})),null}}e.s(["handler",()=>_,"patchFetch",()=>O,"routeModule",()=>U,"serverHooks",()=>f,"workAsyncStorage",()=>m,"workUnitAsyncStorage",()=>S]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=_4470dd92._.js.map