// ══════════════════════════════════════════════════════════════
//  EduDesk OnPrem — Default Tenant Seed
//  CloudTitans © 2026
//
//  Creates a single default tenant with:
//  - Tenant admin: admin@edudesk.local / changeme123
//  - Generic branding (customer changes via tenant-admin panel)
//  - Default SLA config
//  - Default departments
//
//  Run: npx prisma db seed
// ══════════════════════════════════════════════════════════════

import {
  PrismaClient,
  Role,
  Priority,
  LicensePlan,
  LicenseStatus,
  TenantStatus,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const hash   = (pw: string) => bcrypt.hashSync(pw, 10)

async function main() {
  console.log('')
  console.log('🌱 Seeding EduDesk OnPrem default tenant...')
  console.log('')

  // ── Default Tenant ───────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where:  { slug: 'edudesk' },
    update: { status: TenantStatus.ACTIVE },
    create: {
      name:   'EduDesk',
      slug:   'edudesk',
      domain: 'edudesk.local',
      status: TenantStatus.ACTIVE,
    },
  })
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.slug})`)

  // ── License (limits read from LICENSE.key at runtime) ────────
  await prisma.license.upsert({
    where:  { tenantId: tenant.id },
    update: {},
    create: {
      tenantId:        tenant.id,
      plan:            LicensePlan.PROFESSIONAL,
      status:          LicenseStatus.ACTIVE,
      maxUsers:        500,
      maxAgents:       10,
      maxDepartments:  10,
      maxKbArticles:   200,
      maxTicketsMonth: 5000,
      maxStorageMb:    5120,
      featureAd:              true,
      featureCustomBranding:  true,
      featureApi:             false,
      priceMonthly:    0,
      priceYearly:     0,
    },
  })
  console.log('  ✓ License record created')

  // ── Default Branding (customer updates via tenant-admin) ──────
  await prisma.tenantBranding.upsert({
    where:  { tenantId: tenant.id },
    update: {},
    create: {
      tenantId:       tenant.id,
      primaryColor:   '#2563EB',
      portalTitle:    'University Helpdesk',
      portalSubtitle: 'How can we help you today?',
      supportEmail:   'support@edudesk.local',
    },
  })
  console.log('  ✓ Default branding created')

  // ── Tenant Admin ──────────────────────────────────────────────
  await prisma.user.upsert({
    where:  { email: 'admin@edudesk.local' },
    update: { password: hash('changeme123'), tenantId: tenant.id },
    create: {
      tenantId:  tenant.id,
      email:     'admin@edudesk.local',
      name:      'Admin',
      password:  hash('changeme123'),
      role:      Role.TENANT_ADMIN,
      isActive:  true,
    },
  })
  console.log('  ✓ Tenant admin: admin@edudesk.local / changeme123')

  // ── Default SLA Config ────────────────────────────────────────
  for (const s of [
    { priority: Priority.CRITICAL, responseHours: 1,  resolveHours: 4  },
    { priority: Priority.HIGH,     responseHours: 4,  resolveHours: 24 },
    { priority: Priority.MEDIUM,   responseHours: 8,  resolveHours: 48 },
    { priority: Priority.LOW,      responseHours: 24, resolveHours: 72 },
  ]) {
    await prisma.slaConfig.upsert({
      where:  { tenantId_priority: { tenantId: tenant.id, priority: s.priority } },
      update: {},
      create: { tenantId: tenant.id, ...s },
    })
  }
  console.log('  ✓ Default SLA config created')

  // ── Default Departments ───────────────────────────────────────
  for (const d of [
    { department: 'IT',               label: 'IT Support',       email: 'it@edudesk.local'       },
    { department: 'STUDENT_SERVICES', label: 'Student Services', email: 'students@edudesk.local' },
    { department: 'FACILITIES',       label: 'Facilities',       email: 'facilities@edudesk.local'},
    { department: 'HR',               label: 'HR & Staff',       email: 'hr@edudesk.local'       },
  ]) {
    await prisma.departmentConfig.upsert({
      where:  { tenantId_department: { tenantId: tenant.id, department: d.department } },
      update: {},
      create: { tenantId: tenant.id, ...d },
    })
  }
  console.log('  ✓ Default departments created')

  console.log('')
  console.log('══════════════════════════════════════════════')
  console.log('  ✅ Seed complete!')
  console.log('')
  console.log('  Login URL : http://edudesk.local (or your domain)')
  console.log('  Email     : admin@edudesk.local')
  console.log('  Password  : changeme123')
  console.log('')
  console.log('  ⚠️  Change your password immediately after login!')
  console.log('══════════════════════════════════════════════')
  console.log('')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
