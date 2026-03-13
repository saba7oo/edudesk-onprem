-- ============================================================
-- EduDesk Migration v3
-- Features: File Attachments, Categories, Agent Permissions
-- Apply: npx prisma db push  (after updating schema.prisma)
--   OR run this SQL directly on your MySQL database
-- ============================================================

-- ── 1. ticket_attachments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ticket_attachments` (
  `id`           VARCHAR(191) NOT NULL,
  `ticketId`     VARCHAR(191) NOT NULL,
  `messageId`    VARCHAR(191) NULL,
  `uploaderId`   VARCHAR(191) NOT NULL,
  `tenantId`     VARCHAR(191) NOT NULL,
  `fileName`     VARCHAR(255) NOT NULL,
  `fileExt`      VARCHAR(20)  NOT NULL,
  `mimeType`     VARCHAR(100) NOT NULL,
  `sizeBytes`    INT          NOT NULL,
  `storagePath`  VARCHAR(500) NOT NULL,
  `downloadUrl`  VARCHAR(500) NOT NULL,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ta_ticketId` (`ticketId`),
  INDEX `ta_tenantId` (`tenantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. tenant_storage_configs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS `tenant_storage_configs` (
  `id`                VARCHAR(191) NOT NULL,
  `tenantId`          VARCHAR(191) NOT NULL,
  `maxStorageMb`      INT          NOT NULL DEFAULT 1024,
  `usedStorageBytes`  BIGINT       NOT NULL DEFAULT 0,
  `maxFileSizeMb`     INT          NOT NULL DEFAULT 10,
  `allowedExtensions` TEXT         NULL,
  `updatedAt`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `tsc_tenantId` (`tenantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. categories ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `categories` (
  `id`          VARCHAR(191) NOT NULL,
  `tenantId`    VARCHAR(191) NOT NULL,
  `parentId`    VARCHAR(191) NULL,
  `name`        VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `color`       VARCHAR(7)   NOT NULL DEFAULT '#2563EB',
  `icon`        VARCHAR(10)  NULL,
  `isActive`    TINYINT(1)   NOT NULL DEFAULT 1,
  `sortOrder`   INT          NOT NULL DEFAULT 0,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `cat_tenantId` (`tenantId`),
  INDEX `cat_parentId` (`parentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. agent_categories ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS `agent_categories` (
  `id`         VARCHAR(191) NOT NULL,
  `agentId`    VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,
  `tenantId`   VARCHAR(191) NOT NULL,
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ac_agentId_categoryId` (`agentId`, `categoryId`),
  INDEX `ac_agentId` (`agentId`),
  INDEX `ac_tenantId` (`tenantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. Add categoryId + categoryPath to tickets ───────────────
ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `categoryId`       VARCHAR(191) NULL AFTER `department`,
  ADD COLUMN IF NOT EXISTS `categoryPath`     VARCHAR(255) NULL AFTER `categoryId`,
  ADD COLUMN IF NOT EXISTS `attachmentCount`  INT NOT NULL DEFAULT 0 AFTER `tags`;

-- ── 6. Add attachmentCount to ticket_messages ─────────────────
ALTER TABLE `ticket_messages`
  ADD COLUMN IF NOT EXISTS `attachmentCount` INT NOT NULL DEFAULT 0 AFTER `isInternal`;
