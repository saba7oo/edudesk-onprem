-- Migration: v3.0.32 — adSyncLocked, category type/dropdown, ticket fields, email_templates, email_actions
-- Safe idempotent: uses information_schema checks so it can run on both fresh and existing installs.

-- ── 1. users: adSyncLocked ────────────────────────────────────
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='adSyncLocked');
SET @s = IF(@col=0,'ALTER TABLE `users` ADD COLUMN `adSyncLocked` BOOLEAN NOT NULL DEFAULT false','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 2. categories: type ───────────────────────────────────────
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND COLUMN_NAME='type');
SET @s = IF(@col=0,"ALTER TABLE `categories` ADD COLUMN `type` ENUM('NORMAL','DROPDOWN','TEXT_FIELD') NOT NULL DEFAULT 'NORMAL'",'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 3. categories: dropdownOptions ───────────────────────────
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND COLUMN_NAME='dropdownOptions');
SET @s = IF(@col=0,'ALTER TABLE `categories` ADD COLUMN `dropdownOptions` TEXT NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 4. tickets: categoryDetail ────────────────────────────────
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND COLUMN_NAME='categoryDetail');
SET @s = IF(@col=0,'ALTER TABLE `tickets` ADD COLUMN `categoryDetail` VARCHAR(191) NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 5. tickets: createdByAgentId ──────────────────────────────
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND COLUMN_NAME='createdByAgentId');
SET @s = IF(@col=0,'ALTER TABLE `tickets` ADD COLUMN `createdByAgentId` VARCHAR(191) NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND CONSTRAINT_NAME='tickets_createdByAgentId_fkey');
SET @s = IF(@fk=0,
  'ALTER TABLE `tickets` ADD CONSTRAINT `tickets_createdByAgentId_fkey` FOREIGN KEY (`createdByAgentId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 6. email_templates table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS `email_templates` (
  `id`        VARCHAR(191) NOT NULL,
  `tenantId`  VARCHAR(191) NOT NULL,
  `key`       VARCHAR(191) NOT NULL,
  `name`      VARCHAR(191) NOT NULL,
  `subject`   TEXT NOT NULL,
  `body`      LONGTEXT NOT NULL,
  `variables` TEXT NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `email_templates_tenantId_key_key`(`tenantId`, `key`),
  INDEX `email_templates_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='email_templates' AND CONSTRAINT_NAME='email_templates_tenantId_fkey');
SET @s = IF(@fk=0,
  'ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 7. email_actions table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS `email_actions` (
  `id`             VARCHAR(191) NOT NULL,
  `tenantId`       VARCHAR(191) NOT NULL,
  `trigger`        VARCHAR(191) NOT NULL,
  `templateId`     VARCHAR(191) NOT NULL,
  `recipientType`  VARCHAR(191) NOT NULL,
  `recipientValue` VARCHAR(191) NULL,
  `isEnabled`      BOOLEAN NOT NULL DEFAULT true,
  `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `email_actions_tenantId_idx`(`tenantId`),
  INDEX `email_actions_trigger_idx`(`trigger`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='email_actions' AND CONSTRAINT_NAME='email_actions_tenantId_fkey');
SET @s = IF(@fk=0,
  'ALTER TABLE `email_actions` ADD CONSTRAINT `email_actions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='email_actions' AND CONSTRAINT_NAME='email_actions_templateId_fkey');
SET @s = IF(@fk=0,
  'ALTER TABLE `email_actions` ADD CONSTRAINT `email_actions_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `email_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
