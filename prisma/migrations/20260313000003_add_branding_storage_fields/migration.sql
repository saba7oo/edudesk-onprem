-- Add missing columns to tenants table
ALTER TABLE `tenants`
  ADD COLUMN `brandingEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `adEnabled`       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `priorityConfig`  TEXT    NULL;

-- Add Google Workspace fields to ad_configs
ALTER TABLE `ad_configs`
  ADD COLUMN `googleDomain`             VARCHAR(191) NULL,
  ADD COLUMN `googleAdminEmail`         VARCHAR(191) NULL,
  ADD COLUMN `googleServiceAccountJson` TEXT         NULL;

-- CreateTable tenant_storage_configs
CREATE TABLE `tenant_storage_configs` (
  `id`                VARCHAR(191) NOT NULL,
  `tenantId`          VARCHAR(191) NOT NULL,
  `maxStorageMb`      INTEGER      NOT NULL DEFAULT 1024,
  `usedStorageBytes`  BIGINT       NOT NULL DEFAULT 0,
  `maxFileSizeMb`     INTEGER      NOT NULL DEFAULT 10,
  `allowedExtensions` TEXT         NULL,

  UNIQUE INDEX `tenant_storage_configs_tenantId_key`(`tenantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey tenant_storage_configs → tenants
ALTER TABLE `tenant_storage_configs`
  ADD CONSTRAINT `tenant_storage_configs_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable agent_departments
CREATE TABLE `agent_departments` (
  `id`         VARCHAR(191) NOT NULL,
  `agentId`    VARCHAR(191) NOT NULL,
  `department` VARCHAR(191) NOT NULL,
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `agent_departments_agentId_department_key`(`agentId`, `department`),
  INDEX `agent_departments_agentId_idx`(`agentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey agent_departments → users
ALTER TABLE `agent_departments`
  ADD CONSTRAINT `agent_departments_agentId_fkey`
  FOREIGN KEY (`agentId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
