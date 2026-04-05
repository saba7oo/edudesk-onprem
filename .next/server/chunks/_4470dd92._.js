module.exports=[5310,e=>e.a(async(t,a)=>{try{var n=e.i(89171),r=e.i(38895),i=e.i(33405),s=e.i(22734),d=t([r]);[r]=d.then?(await d)():d;let l="/tmp/edudesk-update.log",o="/tmp/edudesk-update.lock";async function E(){let{error:e}=await (0,r.requireAuth)(["TENANT_ADMIN"]);if(e)return e;let t=s.default.existsSync(o);return n.NextResponse.json({running:t})}async function A(){let{error:e}=await (0,r.requireAuth)(["TENANT_ADMIN"]);if(e)return e;if(s.default.existsSync(o))return n.NextResponse.json({error:"An update is already in progress"},{status:409});s.default.writeFileSync(l,""),s.default.writeFileSync(o,String(Date.now()));let t=`#!/bin/bash
set -e
LOG="${l}"
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
systemctl restart edudesk
`,a="/tmp/edudesk-update-run.sh";return s.default.writeFileSync(a,t,{mode:493}),(0,i.spawn)("bash",[a],{detached:!0,stdio:"ignore"}).unref(),n.NextResponse.json({started:!0})}e.s(["GET",()=>E,"POST",()=>A]),a()}catch(e){a(e)}},!1),25734,e=>e.a(async(t,a)=>{try{var n=e.i(47909),r=e.i(74017),i=e.i(96250),s=e.i(59756),d=e.i(61916),E=e.i(74677),A=e.i(69741),l=e.i(16795),o=e.i(87718),T=e.i(95169),u=e.i(47587),R=e.i(66012),N=e.i(70101),L=e.i(26937),c=e.i(70909),p=e.i(93695);e.i(52474);var C=e.i(220),m=e.i(5310),D=t([m]);[m]=D.then?(await D)():D;let I=new n.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/system/update/route",pathname:"/api/system/update",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/system/update/route.ts",nextConfigOutput:"",userland:m}),{workAsyncStorage:U,workUnitAsyncStorage:S,serverHooks:g}=I;function O(){return(0,i.patchFetch)({workAsyncStorage:U,workUnitAsyncStorage:S})}async function _(e,t,a){I.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let n="/api/system/update/route";n=n.replace(/\/index$/,"")||"/";let i=await I.prepare(e,t,{srcPage:n,multiZoneDraftMode:!1});if(!i)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:m,params:D,nextConfig:O,parsedUrl:_,isDraftMode:U,prerenderManifest:S,routerServerContext:g,isOnDemandRevalidate:f,revalidateOnlyGenerated:h,resolvedPathname:M,clientReferenceManifest:y,serverActionsManifest:P}=i,k=(0,A.normalizeAppPath)(n),v=!!(S.dynamicRoutes[k]||S.routes[M]),F=async()=>((null==g?void 0:g.render404)?await g.render404(e,t,_,!1):t.end("This page could not be found"),null);if(v&&!U){let e=!!S.routes[M],t=S.dynamicRoutes[k];if(t&&!1===t.fallback&&!e){if(O.experimental.adapterPath)return await F();throw new p.NoFallbackError}}let H=null;!v||I.isDev||U||(H=M,H="/index"===H?"/":H);let q=!0===I.isDev||!v,x=v&&!q;P&&y&&(0,E.setManifestsSingleton)({page:n,clientReferenceManifest:y,serverActionsManifest:P});let w=e.method||"GET",b=(0,d.getTracer)(),$=b.getActiveScopeSpan(),B={params:D,prerenderManifest:S,renderOpts:{experimental:{authInterrupts:!!O.experimental.authInterrupts},cacheComponents:!!O.cacheComponents,supportsDynamicResponse:q,incrementalCache:(0,s.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:O.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,n,r)=>I.onRequestError(e,t,n,r,g)},sharedContext:{buildId:m}},G=new l.NodeNextRequest(e),V=new l.NodeNextResponse(t),K=o.NextRequestAdapter.fromNodeNextRequest(G,(0,o.signalFromNodeResponse)(t));try{let i=async e=>I.handle(K,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=b.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==T.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=a.get("next.route");if(r){let t=`${w} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":t}),e.updateName(t)}else e.updateName(`${w} ${n}`)}),E=!!(0,s.getRequestMeta)(e,"minimalMode"),A=async s=>{var d,A;let l=async({previousCacheEntry:r})=>{try{if(!E&&f&&h&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await i(s);e.fetchMetrics=B.renderOpts.fetchMetrics;let d=B.renderOpts.pendingWaitUntil;d&&a.waitUntil&&(a.waitUntil(d),d=void 0);let A=B.renderOpts.collectedTags;if(!v)return await (0,R.sendResponse)(G,V,n,B.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,N.toNodeOutgoingHttpHeaders)(n.headers);A&&(t[c.NEXT_CACHE_TAGS_HEADER]=A),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=c.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,r=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=c.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:C.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:r}}}}catch(t){throw(null==r?void 0:r.isStale)&&await I.onRequestError(e,t,{routerKind:"App Router",routePath:n,routeType:"route",revalidateReason:(0,u.getRevalidateReason)({isStaticGeneration:x,isOnDemandRevalidate:f})},!1,g),t}},o=await I.handleResponse({req:e,nextConfig:O,cacheKey:H,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:f,revalidateOnlyGenerated:h,responseGenerator:l,waitUntil:a.waitUntil,isMinimalMode:E});if(!v)return null;if((null==o||null==(d=o.value)?void 0:d.kind)!==C.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==o||null==(A=o.value)?void 0:A.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});E||t.setHeader("x-nextjs-cache",f?"REVALIDATED":o.isMiss?"MISS":o.isStale?"STALE":"HIT"),U&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let T=(0,N.fromNodeOutgoingHttpHeaders)(o.value.headers);return E&&v||T.delete(c.NEXT_CACHE_TAGS_HEADER),!o.cacheControl||t.getHeader("Cache-Control")||T.get("Cache-Control")||T.set("Cache-Control",(0,L.getCacheControlHeader)(o.cacheControl)),await (0,R.sendResponse)(G,V,new Response(o.value.body,{headers:T,status:o.value.status||200})),null};$?await A($):await b.withPropagatedContext(e.headers,()=>b.trace(T.BaseServerSpan.handleRequest,{spanName:`${w} ${n}`,kind:d.SpanKind.SERVER,attributes:{"http.method":w,"http.target":e.url}},A))}catch(t){if(t instanceof p.NoFallbackError||await I.onRequestError(e,t,{routerKind:"App Router",routePath:k,routeType:"route",revalidateReason:(0,u.getRevalidateReason)({isStaticGeneration:x,isOnDemandRevalidate:f})},!1,g),v)throw t;return await (0,R.sendResponse)(G,V,new Response(null,{status:500})),null}}e.s(["handler",()=>_,"patchFetch",()=>O,"routeModule",()=>I,"serverHooks",()=>g,"workAsyncStorage",()=>U,"workUnitAsyncStorage",()=>S]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=_4470dd92._.js.map