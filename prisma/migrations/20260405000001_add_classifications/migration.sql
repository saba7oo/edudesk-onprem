-- Migration: add_classifications — classifications table + classificationId on tickets

-- ── 1. classifications table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS `classifications` (
  `id`        VARCHAR(191) NOT NULL,
  `tenantId`  VARCHAR(191) NOT NULL,
  `name`      VARCHAR(191) NOT NULL,
  `isActive`  BOOLEAN      NOT NULL DEFAULT true,
  `sortOrder` INT          NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `classifications_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='classifications' AND CONSTRAINT_NAME='classifications_tenantId_fkey');
SET @s = IF(@fk=0,
  'ALTER TABLE `classifications` ADD CONSTRAINT `classifications_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── 2. tickets: classificationId ─────────────────────────────
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND COLUMN_NAME='classificationId');
SET @s = IF(@col=0,'ALTER TABLE `tickets` ADD COLUMN `classificationId` VARCHAR(191) NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='tickets' AND CONSTRAINT_NAME='tickets_classificationId_fkey');
SET @s = IF(@fk=0,
  'ALTER TABLE `tickets` ADD CONSTRAINT `tickets_classificationId_fkey` FOREIGN KEY (`classificationId`) REFERENCES `classifications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
