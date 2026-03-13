CREATE TABLE IF NOT EXISTS `smtp_configs` (
  `id`            VARCHAR(191) NOT NULL,
  `tenantId`      VARCHAR(191) NOT NULL,
  `host`          VARCHAR(191) NOT NULL DEFAULT '',
  `port`          INT          NOT NULL DEFAULT 587,
  `secure`        TINYINT(1)   NOT NULL DEFAULT 0,
  `username`      VARCHAR(191) NOT NULL DEFAULT '',
  `password`      VARCHAR(191) NOT NULL DEFAULT '',
  `fromEmail`     VARCHAR(191) NOT NULL DEFAULT '',
  `fromName`      VARCHAR(191) NOT NULL DEFAULT 'EduDesk Helpdesk',
  `replyTo`       VARCHAR(191) NULL,
  `isEnabled`     TINYINT(1)   NOT NULL DEFAULT 0,
  `isVerified`    TINYINT(1)   NOT NULL DEFAULT 0,
  `lastTestedAt`  DATETIME(3)  NULL,
  `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `smtp_configs_tenantId_key` (`tenantId`),
  CONSTRAINT `smtp_configs_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
