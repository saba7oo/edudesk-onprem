-- Migration 5: isDeptAdmin, managerId, visibleToRoles, dept_admin_departments, useful_links
-- Compatible with MySQL 5.7+ (no IF NOT EXISTS on ALTER TABLE)
-- Uses information_schema checks via PREPARE/EXECUTE for safe re-runs.

-- ── 1. users: isDeptAdmin ─────────────────────────────────────
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='isDeptAdmin');
SET @s = IF(@col=0,'ALTER TABLE `users` ADD COLUMN `isDeptAdmin` BOOLEAN NOT NULL DEFAULT false','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 2. users: managerId ───────────────────────────────────────
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='managerId');
SET @s = IF(@col=0,'ALTER TABLE `users` ADD COLUMN `managerId` VARCHAR(191) NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 3. users: managerId foreign key ──────────────────────────
SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='users' AND CONSTRAINT_NAME='users_managerId_fkey');
SET @s = IF(@fk=0,
  'ALTER TABLE `users` ADD CONSTRAINT `users_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 4. tickets: manager approval fields ──────────────────────
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND COLUMN_NAME='managerApprovalStatus');
SET @s = IF(@col=0,
  "ALTER TABLE `tickets` ADD COLUMN `managerApprovalStatus` ENUM('PENDING','APPROVED','REJECTED') NULL",
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND COLUMN_NAME='managerApprovalRequestedAt');
SET @s = IF(@col=0,'ALTER TABLE `tickets` ADD COLUMN `managerApprovalRequestedAt` DATETIME(3) NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND COLUMN_NAME='managerApprovalRespondedAt');
SET @s = IF(@col=0,'ALTER TABLE `tickets` ADD COLUMN `managerApprovalRespondedAt` DATETIME(3) NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND COLUMN_NAME='managerApprovalNote');
SET @s = IF(@col=0,'ALTER TABLE `tickets` ADD COLUMN `managerApprovalNote` LONGTEXT NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND COLUMN_NAME='managerNotifiedAt');
SET @s = IF(@col=0,'ALTER TABLE `tickets` ADD COLUMN `managerNotifiedAt` DATETIME(3) NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND COLUMN_NAME='requestedManagerId');
SET @s = IF(@col=0,'ALTER TABLE `tickets` ADD COLUMN `requestedManagerId` VARCHAR(191) NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- tickets: requestedManagerId index
SET @idx = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND INDEX_NAME='tickets_requestedManagerId_idx');
SET @s = IF(@idx=0,'ALTER TABLE `tickets` ADD INDEX `tickets_requestedManagerId_idx` (`requestedManagerId`)','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- tickets: requestedManagerId foreign key
SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND CONSTRAINT_NAME='tickets_requestedManagerId_fkey');
SET @s = IF(@fk=0,
  'ALTER TABLE `tickets` ADD CONSTRAINT `tickets_requestedManagerId_fkey` FOREIGN KEY (`requestedManagerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 5. kb_articles: visibleToRoles ───────────────────────────
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='kb_articles' AND COLUMN_NAME='visibleToRoles');
SET @s = IF(@col=0,"ALTER TABLE `kb_articles` ADD COLUMN `visibleToRoles` VARCHAR(191) NULL DEFAULT 'ALL'",'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 6. dept_admin_departments table ──────────────────────────
CREATE TABLE IF NOT EXISTS `dept_admin_departments` (
  `id`         VARCHAR(191) NOT NULL,
  `adminId`    VARCHAR(191) NOT NULL,
  `department` VARCHAR(191) NOT NULL,
  `tenantId`   VARCHAR(191) NOT NULL,
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `dept_admin_departments_adminId_department_key` (`adminId`, `department`),
  INDEX        `dept_admin_departments_adminId_idx`  (`adminId`),
  INDEX        `dept_admin_departments_tenantId_idx` (`tenantId`),
  PRIMARY KEY  (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='dept_admin_departments' AND CONSTRAINT_NAME='dept_admin_departments_adminId_fkey');
SET @s = IF(@fk=0,
  'ALTER TABLE `dept_admin_departments` ADD CONSTRAINT `dept_admin_departments_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 7. useful_links table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `useful_links` (
  `id`          VARCHAR(191) NOT NULL,
  `tenantId`    VARCHAR(191) NOT NULL,
  `title`       VARCHAR(191) NOT NULL,
  `url`         LONGTEXT     NOT NULL,
  `icon`        VARCHAR(191) NULL,
  `description` LONGTEXT     NULL,
  `order`       INTEGER      NOT NULL DEFAULT 0,
  `isActive`    BOOLEAN      NOT NULL DEFAULT true,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX         `useful_links_tenantId_idx` (`tenantId`),
  PRIMARY KEY   (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='useful_links' AND CONSTRAINT_NAME='useful_links_tenantId_fkey');
SET @s = IF(@fk=0,
  'ALTER TABLE `useful_links` ADD CONSTRAINT `useful_links_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
