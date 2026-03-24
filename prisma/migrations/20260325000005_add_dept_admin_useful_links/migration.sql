-- ══════════════════════════════════════════════════════════════
-- v3 additions: dept admin role, manager field, useful links
-- ══════════════════════════════════════════════════════════════

-- ── 1. users: isDeptAdmin flag + managerId ────────────────────
ALTER TABLE `users`
  ADD COLUMN `isDeptAdmin` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `managerId`   VARCHAR(191) NULL;

-- ── 2. CreateTable dept_admin_departments ─────────────────────
CREATE TABLE `dept_admin_departments` (
  `id`         VARCHAR(191) NOT NULL,
  `adminId`    VARCHAR(191) NOT NULL,
  `tenantId`   VARCHAR(191) NOT NULL,
  `department` VARCHAR(191) NOT NULL,
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `dept_admin_departments_adminId_idx`(`adminId`),
  INDEX `dept_admin_departments_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 3. CreateTable useful_links ───────────────────────────────
CREATE TABLE `useful_links` (
  `id`          VARCHAR(191) NOT NULL,
  `tenantId`    VARCHAR(191) NOT NULL,
  `title`       VARCHAR(191) NOT NULL,
  `url`         TEXT NOT NULL,
  `icon`        VARCHAR(191) NULL,
  `description` TEXT NULL,
  `order`       INT NOT NULL DEFAULT 0,
  `isActive`    BOOLEAN NOT NULL DEFAULT true,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL,

  INDEX `useful_links_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 4. Foreign keys ───────────────────────────────────────────
ALTER TABLE `users`
  ADD CONSTRAINT `users_managerId_fkey`
  FOREIGN KEY (`managerId`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `dept_admin_departments`
  ADD CONSTRAINT `dept_admin_departments_adminId_fkey`
  FOREIGN KEY (`adminId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `useful_links`
  ADD CONSTRAINT `useful_links_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
