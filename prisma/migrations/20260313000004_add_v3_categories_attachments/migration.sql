-- ══════════════════════════════════════════════════════════════
-- v3 Schema additions: categories, attachments, free-form
-- departments, agent permissions, ticket/kb enhancements
-- ══════════════════════════════════════════════════════════════

-- ── 1. department_configs: icon column + free-form department ─
ALTER TABLE `department_configs`
  ADD COLUMN `icon` VARCHAR(191) NULL;

ALTER TABLE `department_configs`
  MODIFY COLUMN `department` VARCHAR(191) NOT NULL;

-- ── 2. kb_articles: visibleToRoles + free-form department ─────
ALTER TABLE `kb_articles`
  ADD COLUMN `visibleToRoles` VARCHAR(191) NULL DEFAULT 'ALL';

ALTER TABLE `kb_articles`
  MODIFY COLUMN `department` VARCHAR(191) NULL;

-- ── 3. tickets: categoryId, categoryPath, attachmentCount ─────
--    + free-form department (was ENUM)
ALTER TABLE `tickets`
  ADD COLUMN `categoryId`    VARCHAR(191) NULL,
  ADD COLUMN `categoryPath`  VARCHAR(191) NULL,
  ADD COLUMN `attachmentCount` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `tickets`
  MODIFY COLUMN `department` VARCHAR(191) NOT NULL;

-- Index for categoryId on tickets
CREATE INDEX `tickets_categoryId_idx` ON `tickets`(`categoryId`);

-- ── 4. ticket_messages: attachmentCount ───────────────────────
ALTER TABLE `ticket_messages`
  ADD COLUMN `attachmentCount` INTEGER NOT NULL DEFAULT 0;

-- ── 5. CreateTable categories ─────────────────────────────────
CREATE TABLE `categories` (
  `id`          VARCHAR(191) NOT NULL,
  `tenantId`    VARCHAR(191) NOT NULL,
  `parentId`    VARCHAR(191) NULL,
  `department`  VARCHAR(191) NULL,
  `name`        VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `color`       VARCHAR(191) NOT NULL DEFAULT '#2563EB',
  `icon`        VARCHAR(191) NULL,
  `isActive`    BOOLEAN      NOT NULL DEFAULT true,
  `sortOrder`   INTEGER      NOT NULL DEFAULT 0,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL,

  INDEX `categories_tenantId_idx`(`tenantId`),
  INDEX `categories_parentId_idx`(`parentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 6. CreateTable agent_categories ──────────────────────────
CREATE TABLE `agent_categories` (
  `id`         VARCHAR(191) NOT NULL,
  `agentId`    VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,
  `tenantId`   VARCHAR(191) NOT NULL,
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `agent_categories_agentId_categoryId_key`(`agentId`, `categoryId`),
  INDEX `agent_categories_agentId_idx`(`agentId`),
  INDEX `agent_categories_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 7. CreateTable ticket_attachments ────────────────────────
CREATE TABLE `ticket_attachments` (
  `id`          VARCHAR(191) NOT NULL,
  `ticketId`    VARCHAR(191) NOT NULL,
  `messageId`   VARCHAR(191) NULL,
  `uploaderId`  VARCHAR(191) NOT NULL,
  `tenantId`    VARCHAR(191) NOT NULL,
  `fileName`    VARCHAR(191) NOT NULL,
  `fileExt`     VARCHAR(191) NOT NULL,
  `mimeType`    VARCHAR(191) NOT NULL,
  `sizeBytes`   INTEGER      NOT NULL,
  `storagePath` VARCHAR(191) NOT NULL,
  `downloadUrl` VARCHAR(191) NOT NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ticket_attachments_ticketId_idx`(`ticketId`),
  INDEX `ticket_attachments_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 8. Foreign keys ───────────────────────────────────────────

ALTER TABLE `categories`
  ADD CONSTRAINT `categories_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `categories`
  ADD CONSTRAINT `categories_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `agent_categories`
  ADD CONSTRAINT `agent_categories_agentId_fkey`
  FOREIGN KEY (`agentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `agent_categories`
  ADD CONSTRAINT `agent_categories_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tickets`
  ADD CONSTRAINT `tickets_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ticket_attachments`
  ADD CONSTRAINT `ticket_attachments_ticketId_fkey`
  FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ticket_attachments`
  ADD CONSTRAINT `ticket_attachments_messageId_fkey`
  FOREIGN KEY (`messageId`) REFERENCES `ticket_messages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ticket_attachments`
  ADD CONSTRAINT `ticket_attachments_uploaderId_fkey`
  FOREIGN KEY (`uploaderId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
