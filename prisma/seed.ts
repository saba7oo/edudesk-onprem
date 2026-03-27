import { PrismaClient, Role, Priority, LicensePlan, LicenseStatus, TenantStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const hash = (pw: string) => bcrypt.hashSync(pw, 10)

async function main() {
  console.log('🌱 Seeding EduDesk v2...')

  // ── Super Admin (no tenant) ──────────────────────────────────
  await prisma.user.upsert({
    where:  { email: 'superadmin@edudesk.com' },
    update: { password: hash('SuperAdmin@1234') },
    create: { email: 'superadmin@edudesk.com', name: 'Platform Admin', password: hash('SuperAdmin@1234'), role: Role.SUPER_ADMIN, tenantId: null, isActive: true },
  })
  console.log('✓ Super admin: superadmin@edudesk.com / SuperAdmin@1234')

  // ── Greenwood University (Professional) ─────────────────────
  const t1 = await prisma.tenant.upsert({
    where:  { slug: 'greenwood' },
    update: { status: TenantStatus.ACTIVE },
    create: { name: 'Greenwood University', slug: 'greenwood', domain: 'helpdesk.greenwood.edu', status: TenantStatus.ACTIVE },
  })

  await prisma.license.upsert({
    where:  { tenantId: t1.id },
    update: {},
    create: { tenantId: t1.id, plan: LicensePlan.PROFESSIONAL, status: LicenseStatus.ACTIVE, maxUsers: 2000, maxAgents: 15, maxDepartments: 4, maxKbArticles: 500, maxTicketsMonth: 5000, maxStorageMb: 5120, featureAd: true, featureCustomBranding: true, featureApi: true, priceMonthly: 699, priceYearly: 6990 },
  })

  await prisma.tenantBranding.upsert({
    where:  { tenantId: t1.id },
    update: {},
    create: { tenantId: t1.id, primaryColor: '#1E40AF', portalTitle: 'Greenwood IT Helpdesk', portalSubtitle: 'How can we help you today?', supportEmail: 'it@greenwood.edu' },
  })

  await prisma.adConfig.upsert({
    where:  { tenantId: t1.id },
    update: {},
    create: { tenantId: t1.id, isEnabled: false, ldapUrl: 'ldap://ad.greenwood.edu', ldapBaseDn: 'DC=greenwood,DC=edu', ldapBindDn: 'CN=svc-edudesk,CN=Users,DC=greenwood,DC=edu', groupRoleMap: JSON.stringify({ 'IT-Admins': 'TENANT_ADMIN', 'Faculty': 'TEACHER', 'Staff': 'STAFF' }), autoProvision: true, autoDeactivate: true },
  })

  const g1users = [
    { email: 'admin@greenwood.edu',    name: 'Admin User',       role: Role.TENANT_ADMIN, pw: 'Admin@1234',   dept: 'IT'                                                                   },
    { email: 'mohammed@greenwood.edu', name: 'Mohammed K.',      role: Role.IT_AGENT,     pw: 'Agent@1234',   dept: 'IT'                                                                   },
    { email: 'layla@greenwood.edu',    name: 'Layla H.',         role: Role.IT_AGENT,     pw: 'Agent@1234',   dept: 'IT'                                                                   },
    { email: 'sara@greenwood.edu',     name: 'Sara Al-Rashid',   role: Role.STUDENT,      pw: 'Student@1234', dept: 'College:Engineering | Year:2021 | Location:Main Campus', studentId: 'STU-2021-0042' },
    { email: 'ahmed@greenwood.edu',    name: 'Ahmed Yilmaz',     role: Role.STUDENT,      pw: 'Student@1234', dept: 'College:Business | Year:2022 | Location:Main Campus',    studentId: 'STU-2022-0118' },
    { email: 'james@greenwood.edu',    name: 'Prof. James Osei', role: Role.TEACHER,      pw: 'Teacher@1234', dept: 'College:Engineering',                                    staffId: 'FAC-0019' },
    { email: 'fatima@greenwood.edu',   name: 'Fatima Al-Zahra',  role: Role.STAFF,        pw: 'Staff@1234',   dept: 'Administration',                                         staffId: 'STF-0007' },
  ]
  for (const u of g1users) {
    await prisma.user.upsert({
      where:  { email: u.email },
      update: { password: hash(u.pw), role: u.role, tenantId: t1.id },
      create: { tenantId: t1.id, email: u.email, name: u.name, password: hash(u.pw), role: u.role, department: u.dept, studentId: (u as any).studentId ?? null, staffId: (u as any).staffId ?? null, isActive: true },
    })
    console.log(`  ✓ ${u.email} (${u.role})`)
  }

  // SLA & departments for t1
  for (const s of [
    { priority: Priority.CRITICAL, responseHours: 1,  resolveHours: 4  },
    { priority: Priority.HIGH,     responseHours: 4,  resolveHours: 24 },
    { priority: Priority.MEDIUM,   responseHours: 8,  resolveHours: 48 },
    { priority: Priority.LOW,      responseHours: 24, resolveHours: 72 },
  ]) {
    await prisma.slaConfig.upsert({
      where:  { tenantId_priority: { tenantId: t1.id, priority: s.priority } },
      update: {},
      create: { tenantId: t1.id, ...s },
    })
  }
  for (const d of [
    { department: 'IT',               label: 'IT Support',       email: 'it@greenwood.edu'         },
    { department: 'STUDENT_SERVICES', label: 'Student Services', email: 'students@greenwood.edu'   },
    { department: 'FACILITIES',       label: 'Facilities',       email: 'facilities@greenwood.edu' },
    { department: 'HR',               label: 'HR & Staff',       email: 'hr@greenwood.edu'         },
  ]) {
    await prisma.departmentConfig.upsert({
      where:  { tenantId_department: { tenantId: t1.id, department: d.department } },
      update: {},
      create: { tenantId: t1.id, ...d },
    })
  }

  // Sample tickets
  const sara  = await prisma.user.findUnique({ where: { email: 'sara@greenwood.edu' } })
  const ahmed = await prisma.user.findUnique({ where: { email: 'ahmed@greenwood.edu' } })
  const agent = await prisma.user.findUnique({ where: { email: 'mohammed@greenwood.edu' } })
  if (await prisma.ticket.count({ where: { tenantId: t1.id } }) === 0) {
    const t = await prisma.ticket.create({ data: { tenantId: t1.id, title: 'Cannot access university email', description: 'My Outlook keeps saying the license has expired.', department: 'IT', priority: Priority.HIGH, submitterId: sara!.id, assigneeId: agent!.id, status: 'IN_PROGRESS' } })
    await prisma.slaLog.create({ data: { ticketId: t.id } })
    await prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: agent!.id, body: 'Hi Sara, looking into this now. Which device are you on?' } })
    const t2 = await prisma.ticket.create({ data: { tenantId: t1.id, title: 'Wi-Fi not working in Building C', description: 'Room 204 has been down since yesterday morning.', department: 'IT', priority: Priority.MEDIUM, submitterId: ahmed!.id } })
    await prisma.slaLog.create({ data: { ticketId: t2.id } })
    console.log('✓ Sample tickets')
  }

  // KB articles
  const admin = await prisma.user.findUnique({ where: { email: 'admin@greenwood.edu' } })
  for (const a of [
    { title: 'How to reset your university password', slug: 'reset-password', department: 'IT', body: 'Visit portal.greenwood.edu/reset and follow the steps.' },
    { title: 'Connecting to campus Wi-Fi',            slug: 'campus-wifi',    department: 'IT', body: 'Use your university credentials to connect to GreenWood-Secure.' },
  ]) {
    const exists = await prisma.kbArticle.findUnique({ where: { tenantId_slug: { tenantId: t1.id, slug: a.slug } } })
    if (!exists) await prisma.kbArticle.create({ data: { tenantId: t1.id, authorId: admin!.id, ...a, isPublished: true } })
  }
  console.log('✓ KB articles')

  // ── Springfield College (Starter / Trial) ───────────────────
  const t2 = await prisma.tenant.upsert({
    where:  { slug: 'springfield' },
    update: {},
    create: { name: 'Springfield College', slug: 'springfield', status: TenantStatus.ACTIVE },
  })
  await prisma.license.upsert({
    where:  { tenantId: t2.id },
    update: {},
    create: { tenantId: t2.id, plan: LicensePlan.STARTER, status: LicenseStatus.TRIAL, maxUsers: 500, maxAgents: 5, trialEndsAt: new Date(Date.now() + 30 * 86400000), priceMonthly: 299 },
  })
  await prisma.user.upsert({
    where:  { email: 'admin@springfield.edu' },
    update: { password: hash('Admin@1234'), tenantId: t2.id },
    create: { tenantId: t2.id, email: 'admin@springfield.edu', name: 'Springfield Admin', password: hash('Admin@1234'), role: Role.TENANT_ADMIN, isActive: true },
  })
  console.log('✓ Springfield tenant')

  console.log('\n✅ Seed complete!\n')
  console.log('Credentials:')
  console.log('  superadmin@edudesk.com    / SuperAdmin@1234  → /super-admin')
  console.log('  admin@greenwood.edu       / Admin@1234       → /dashboard  (TENANT_ADMIN)')
  console.log('  mohammed@greenwood.edu    / Agent@1234       → /dashboard  (IT_AGENT)')
  console.log('  sara@greenwood.edu        / Student@1234     → /portal')
  console.log('  ahmed@greenwood.edu       / Student@1234     → /portal')
  console.log('  james@greenwood.edu       / Teacher@1234     → /portal')
  console.log('  fatima@greenwood.edu      / Staff@1234       → /portal')
  console.log('  admin@springfield.edu     / Admin@1234       → /dashboard')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
