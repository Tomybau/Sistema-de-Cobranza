-- AlterTable: agregar campos de automatización a ContractItem
ALTER TABLE "ContractItem" ADD COLUMN "autoGenerate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractItem" ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractItem" ADD COLUMN "reminderDayOfMonth" INTEGER;

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BILLING_REMINDER', 'AUTO_GENERATED', 'AUTO_GENERATE_ERROR');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "contractId" TEXT,
    "contractItemId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
