-- AlterTable: resettable SLA window start
ALTER TABLE `sla_logs` ADD COLUMN `slaStartAt` DATETIME(3) NULL;

-- CreateTable: immutable per-agent SLA breach attribution
CREATE TABLE `sla_breach_events` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL,
    `breachedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sla_breach_events_tenantId_idx`(`tenantId`),
    INDEX `sla_breach_events_agentId_idx`(`agentId`),
    INDEX `sla_breach_events_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sla_breach_events` ADD CONSTRAINT `sla_breach_events_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
