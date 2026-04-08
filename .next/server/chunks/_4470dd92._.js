module.exports=[5310,e=>e.a(async(t,a)=>{try{var n=e.i(89171),E=e.i(38895),s=e.i(33405),i=e.i(22734),r=t([E]);[E]=r.then?(await r)():r;let d="/tmp/edudesk-update.log",l="/tmp/edudesk-update.lock";async function A(){let{error:e}=await (0,E.requireAuth)(["TENANT_ADMIN"]);if(e)return e;let t=i.default.existsSync(l);return n.NextResponse.json({running:t})}async function T(){let{error:e}=await (0,E.requireAuth)(["TENANT_ADMIN"]);if(e)return e;if(i.default.existsSync(l))return n.NextResponse.json({error:"An update is already in progress"},{status:409});i.default.writeFileSync(d,""),i.default.writeFileSync(l,String(Date.now()));let t=`#!/bin/bash
set -e
LOG="${d}"
LOCK="${l}"
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
log "RESTARTING"
rm -f "$LOCK"
# Restart from outside the service cgroup.
# Try systemd-run first (creates a transient timer in systemd, survives cgroup teardown).
# If unavailable, fall back to a background subshell with nohup.
if command -v systemd-run >/dev/null 2>&1; then
  systemd-run --on-active=5 /bin/systemctl restart edudesk 2>/dev/null \
    || (sleep 5 && /bin/systemctl restart edudesk) &
else
  (sleep 5 && /bin/systemctl restart edudesk) &
fi
`,a="/tmp/edudesk-update-run.sh";return i.default.writeFileSync(a,t,{mode:493}),(0,s.spawn)("bash",[a],{detached:!0,stdio:"ignore"}).unref(),n.NextResponse.json({started:!0})}e.s(["GET",()=>A,"POST",()=>T]),a()}catch(e){a(e)}},!1),25734,e=>e.a(async(t,a)=>{try{var n=e.i(47909),E=e.i(74017),s=e.i(96250),i=e.i(59756),r=e.i(61916),A=e.i(74677),T=e.i(69741),d=e.i(16795),l=e.i(87718),o=e.i(95169),L=e.i(47587),N=e.i(66012),u=e.i(70101),R=e.i(26937),c=e.i(70909),p=e.i(93695);e.i(52474);var C=e.i(220),D=e.i(5310),I=t([D]);[D]=I.then?(await I)():I;let U=new n.AppRouteRouteModule({definition:{kind:E.RouteKind.APP_ROUTE,page:"/api/system/update/route",pathname:"/api/system/update",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/system/update/route.ts",nextConfigOutput:"",userland:D}),{workAsyncStorage:m,workUnitAsyncStorage:S,serverHooks:f}=U;function O(){return(0,s.patchFetch)({workAsyncStorage:m,workUnitAsyncStorage:S})}async function _(e,t,a){U.isDev&&(0,i.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let n="/api/system/update/route";n=n.replace(/\/index$/,"")||"/";let s=await U.prepare(e,t,{srcPage:n,multiZoneDraftMode:!1});if(!s)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:D,params:I,nextConfig:O,parsedUrl:_,isDraftMode:m,prerenderManifest:S,routerServerContext:f,isOnDemandRevalidate:g,revalidateOnlyGenerated:M,resolvedPathname:h,clientReferenceManifest:y,serverActionsManifest:P}=s,k=(0,T.normalizeAppPath)(n),v=!!(S.dynamicRoutes[k]||S.routes[h]),F=async()=>((null==f?void 0:f.render404)?await f.render404(e,t,_,!1):t.end("This page could not be found"),null);if(v&&!m){let e=!!S.routes[h],t=S.dynamicRoutes[k];if(t&&!1===t.fallback&&!e){if(O.experimental.adapterPath)return await F();throw new p.NoFallbackError}}let H=null;!v||U.isDev||m||(H=h,H="/index"===H?"/":H);let b=!0===U.isDev||!v,q=v&&!b;P&&y&&(0,A.setManifestsSingleton)({page:n,clientReferenceManifest:y,serverActionsManifest:P});let B=e.method||"GET",x=(0,r.getTracer)(),w=x.getActiveScopeSpan(),$={params:I,prerenderManifest:S,renderOpts:{experimental:{authInterrupts:!!O.experimental.authInterrupts},cacheComponents:!!O.cacheComponents,supportsDynamicResponse:b,incrementalCache:(0,i.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:O.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,n,E)=>U.onRequestError(e,t,n,E,f)},sharedContext:{buildId:D}},V=new d.NodeNextRequest(e),G=new d.NodeNextResponse(t),K=l.NextRequestAdapter.fromNodeNextRequest(V,(0,l.signalFromNodeResponse)(t));try{let s=async e=>U.handle(K,$).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=x.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==o.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let E=a.get("next.route");if(E){let t=`${B} ${E}`;e.setAttributes({"next.route":E,"http.route":E,"next.span_name":t}),e.updateName(t)}else e.updateName(`${B} ${n}`)}),A=!!(0,i.getRequestMeta)(e,"minimalMode"),T=async i=>{var r,T;let d=async({previousCacheEntry:E})=>{try{if(!A&&g&&M&&!E)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await s(i);e.fetchMetrics=$.renderOpts.fetchMetrics;let r=$.renderOpts.pendingWaitUntil;r&&a.waitUntil&&(a.waitUntil(r),r=void 0);let T=$.renderOpts.collectedTags;if(!v)return await (0,N.sendResponse)(V,G,n,$.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,u.toNodeOutgoingHttpHeaders)(n.headers);T&&(t[c.NEXT_CACHE_TAGS_HEADER]=T),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==$.renderOpts.collectedRevalidate&&!($.renderOpts.collectedRevalidate>=c.INFINITE_CACHE)&&$.renderOpts.collectedRevalidate,E=void 0===$.renderOpts.collectedExpire||$.renderOpts.collectedExpire>=c.INFINITE_CACHE?void 0:$.renderOpts.collectedExpire;return{value:{kind:C.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:E}}}}catch(t){throw(null==E?void 0:E.isStale)&&await U.onRequestError(e,t,{routerKind:"App Router",routePath:n,routeType:"route",revalidateReason:(0,L.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:g})},!1,f),t}},l=await U.handleResponse({req:e,nextConfig:O,cacheKey:H,routeKind:E.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:g,revalidateOnlyGenerated:M,responseGenerator:d,waitUntil:a.waitUntil,isMinimalMode:A});if(!v)return null;if((null==l||null==(r=l.value)?void 0:r.kind)!==C.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(T=l.value)?void 0:T.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});A||t.setHeader("x-nextjs-cache",g?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),m&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let o=(0,u.fromNodeOutgoingHttpHeaders)(l.value.headers);return A&&v||o.delete(c.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||t.getHeader("Cache-Control")||o.get("Cache-Control")||o.set("Cache-Control",(0,R.getCacheControlHeader)(l.cacheControl)),await (0,N.sendResponse)(V,G,new Response(l.value.body,{headers:o,status:l.value.status||200})),null};w?await T(w):await x.withPropagatedContext(e.headers,()=>x.trace(o.BaseServerSpan.handleRequest,{spanName:`${B} ${n}`,kind:r.SpanKind.SERVER,attributes:{"http.method":B,"http.target":e.url}},T))}catch(t){if(t instanceof p.NoFallbackError||await U.onRequestError(e,t,{routerKind:"App Router",routePath:k,routeType:"route",revalidateReason:(0,L.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:g})},!1,f),v)throw t;return await (0,N.sendResponse)(V,G,new Response(null,{status:500})),null}}e.s(["handler",()=>_,"patchFetch",()=>O,"routeModule",()=>U,"serverHooks",()=>f,"workAsyncStorage",()=>m,"workUnitAsyncStorage",()=>S]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=_4470dd92._.js.map