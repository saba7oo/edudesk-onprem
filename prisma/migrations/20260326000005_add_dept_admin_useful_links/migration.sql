-- Migration 5: isDeptAdmin, managerId, visibleToRoles, dept_admin_departments, useful_links
-- Uses IF NOT EXISTS / IF EXISTS so re-running is safe on partially-migrated servers.

-- 1. users: isDeptAdmin flag + managerId (manager approval/notification)
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `isDeptAdmin` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS `managerId`   VARCHAR(191) NULL;

-- 2. users: foreign key for managerId (self-referential)
-- Only add if the constraint does not already exist
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME        = 'users'
    AND CONSTRAINT_NAME   = 'users_managerId_fkey'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE `users` ADD CONSTRAINT `users_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. tickets: manager approval fields
ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `managerApprovalStatus`      ENUM('PENDING','APPROVED','REJECTED') NULL,
  ADD COLUMN IF NOT EXISTS `managerApprovalRequestedAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `managerApprovalRespondedAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `managerApprovalNote`        LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `managerNotifiedAt`          DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `requestedManagerId`         VARCHAR(191) NULL;

-- tickets: index on requestedManagerId
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'tickets'
    AND INDEX_NAME   = 'tickets_requestedManagerId_idx'
);
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE `tickets` ADD INDEX `tickets_requestedManagerId_idx` (`requestedManagerId`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tickets: foreign key for requestedManagerId
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME        = 'tickets'
    AND CONSTRAINT_NAME   = 'tickets_requestedManagerId_fkey'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE `tickets` ADD CONSTRAINT `tickets_requestedManagerId_fkey` FOREIGN KEY (`requestedManagerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. kb_articles: visibleToRoles column
ALTER TABLE `kb_articles`
  ADD COLUMN IF NOT EXISTS `visibleToRoles` VARCHAR(191) NULL DEFAULT 'ALL';

-- 5. dept_admin_departments table
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

-- dept_admin_departments: foreign key
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME        = 'dept_admin_departments'
    AND CONSTRAINT_NAME   = 'dept_admin_departments_adminId_fkey'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE `dept_admin_departments` ADD CONSTRAINT `dept_admin_departments_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. useful_links table
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

-- useful_links: foreign key
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME        = 'useful_links'
    AND CONSTRAINT_NAME   = 'useful_links_tenantId_fkey'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE `useful_links` ADD CONSTRAINT `useful_links_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
