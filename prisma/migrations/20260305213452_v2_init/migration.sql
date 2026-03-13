-- CreateTable
CREATE TABLE `tenants` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NULL,

    UNIQUE INDEX `tenants_slug_key`(`slug`),
    UNIQUE INDEX `tenants_domain_key`(`domain`),
    INDEX `tenants_slug_idx`(`slug`),
    INDEX `tenants_domain_idx`(`domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_branding` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `faviconUrl` VARCHAR(191) NULL,
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#2563EB',
    `secondaryColor` VARCHAR(191) NOT NULL DEFAULT '#1E3A5F',
    `accentColor` VARCHAR(191) NOT NULL DEFAULT '#3B82F6',
    `fontFamily` VARCHAR(191) NOT NULL DEFAULT 'Georgia, serif',
    `portalTitle` VARCHAR(191) NOT NULL DEFAULT 'IT Helpdesk',
    `portalSubtitle` VARCHAR(191) NOT NULL DEFAULT 'How can we help you today?',
    `welcomeMessage` TEXT NULL,
    `footerText` VARCHAR(191) NULL,
    `supportEmail` VARCHAR(191) NULL,
    `customCss` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_branding_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ad_configs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `provider` ENUM('LDAP', 'AZURE_AD', 'GOOGLE', 'SAML', 'NONE') NOT NULL DEFAULT 'NONE',
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `ldapUrl` VARCHAR(191) NULL,
    `ldapBaseDn` VARCHAR(191) NULL,
    `ldapBindDn` VARCHAR(191) NULL,
    `ldapBindPass` VARCHAR(191) NULL,
    `ldapUserFilter` VARCHAR(191) NULL DEFAULT '(&(objectClass=user)(mail={{email}}))',
    `ldapGroupFilter` VARCHAR(191) NULL,
    `groupRoleMap` TEXT NULL,
    `azureTenantId` VARCHAR(191) NULL,
    `azureClientId` VARCHAR(191) NULL,
    `azureClientSecret` VARCHAR(191) NULL,
    `samlEntryPoint` VARCHAR(191) NULL,
    `samlIssuer` VARCHAR(191) NULL,
    `samlCert` TEXT NULL,
    `autoProvision` BOOLEAN NOT NULL DEFAULT true,
    `autoDeactivate` BOOLEAN NOT NULL DEFAULT true,
    `syncSchedule` VARCHAR(191) NULL DEFAULT '0 */6 * * *',
    `lastSyncAt` DATETIME(3) NULL,
    `lastSyncStatus` VARCHAR(191) NULL,
    `lastSyncCount` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ad_configs_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `licenses` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `plan` ENUM('STARTER', 'PROFESSIONAL', 'DISTRICT', 'UNIVERSITY') NOT NULL DEFAULT 'STARTER',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'EXPIRED', 'TRIAL') NOT NULL DEFAULT 'TRIAL',
    `maxUsers` INTEGER NOT NULL DEFAULT 500,
    `maxAgents` INTEGER NOT NULL DEFAULT 5,
    `maxDepartments` INTEGER NOT NULL DEFAULT 2,
    `maxKbArticles` INTEGER NOT NULL DEFAULT 50,
    `maxTicketsMonth` INTEGER NOT NULL DEFAULT 1000,
    `maxStorageMb` INTEGER NOT NULL DEFAULT 1024,
    `currentUsers` INTEGER NOT NULL DEFAULT 0,
    `currentAgents` INTEGER NOT NULL DEFAULT 0,
    `currentKbCount` INTEGER NOT NULL DEFAULT 0,
    `ticketsThisMonth` INTEGER NOT NULL DEFAULT 0,
    `usedStorageMb` DOUBLE NOT NULL DEFAULT 0,
    `priceMonthly` DECIMAL(10, 2) NULL,
    `priceYearly` DECIMAL(10, 2) NULL,
    `billingEmail` VARCHAR(191) NULL,
    `trialEndsAt` DATETIME(3) NULL,
    `renewsAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `featureAd` BOOLEAN NOT NULL DEFAULT false,
    `featureCustomBranding` BOOLEAN NOT NULL DEFAULT false,
    `featureApi` BOOLEAN NOT NULL DEFAULT false,
    `featureAiBot` BOOLEAN NOT NULL DEFAULT false,
    `featureMultiLang` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NULL,

    UNIQUE INDEX `licenses_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `role` ENUM('SUPER_ADMIN', 'TENANT_ADMIN', 'IT_AGENT', 'TEACHER', 'STAFF', 'STUDENT') NOT NULL DEFAULT 'STUDENT',
    `department` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `staffId` VARCHAR(191) NULL,
    `adObjectId` VARCHAR(191) NULL,
    `adUpn` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isSsoUser` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_tenantId_idx`(`tenantId`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_adObjectId_idx`(`adObjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tickets` (
    `id` VARCHAR(191) NOT NULL,
    `ticketNumber` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `department` ENUM('IT', 'STUDENT_SERVICES', 'FACILITIES', 'HR') NOT NULL,
    `submitterId` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `dueAt` DATETIME(3) NULL,
    `tags` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tickets_ticketNumber_key`(`ticketNumber`),
    INDEX `tickets_tenantId_idx`(`tenantId`),
    INDEX `tickets_status_idx`(`status`),
    INDEX `tickets_department_idx`(`department`),
    INDEX `tickets_submitterId_idx`(`submitterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_messages` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_messages_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_activities` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `meta` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_activities_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sla_logs` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `firstResponseAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `responseBreached` BOOLEAN NOT NULL DEFAULT false,
    `resolveBreached` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sla_logs_ticketId_key`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kb_articles` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `department` ENUM('IT', 'STUDENT_SERVICES', 'FACILITIES', 'HR') NOT NULL,
    `tags` VARCHAR(191) NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `kb_articles_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `kb_articles_tenantId_slug_key`(`tenantId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `department_configs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `department` ENUM('IT', 'STUDENT_SERVICES', 'FACILITIES', 'HR') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `department_configs_tenantId_department_key`(`tenantId`, `department`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sla_configs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    `responseHours` INTEGER NOT NULL,
    `resolveHours` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sla_configs_tenantId_priority_key`(`tenantId`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NULL,
    `meta` TEXT NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_tenantId_idx`(`tenantId`),
    INDEX `audit_logs_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tenant_branding` ADD CONSTRAINT `tenant_branding_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ad_configs` ADD CONSTRAINT `ad_configs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `licenses` ADD CONSTRAINT `licenses_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_submitterId_fkey` FOREIGN KEY (`submitterId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_activities` ADD CONSTRAINT `ticket_activities_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_activities` ADD CONSTRAINT `ticket_activities_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sla_logs` ADD CONSTRAINT `sla_logs_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kb_articles` ADD CONSTRAINT `kb_articles_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kb_articles` ADD CONSTRAINT `kb_articles_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_configs` ADD CONSTRAINT `department_configs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sla_configs` ADD CONSTRAINT `sla_configs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
