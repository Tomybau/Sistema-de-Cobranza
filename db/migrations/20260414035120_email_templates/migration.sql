/*
  Warnings:

  - You are about to drop the column `billingTicketId` on the `EmailLog` table. All the data in the column will be lost.
  - You are about to drop the column `bodyHtml` on the `EmailLog` table. All the data in the column will be lost.
  - You are about to drop the column `providerMessageId` on the `EmailLog` table. All the data in the column will be lost.
  - You are about to drop the column `sentById` on the `EmailLog` table. All the data in the column will be lost.
  - The `status` column on the `EmailLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `bodyText` on the `EmailTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `EmailTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `EmailTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `EmailTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `variables` on the `EmailTemplate` table. All the data in the column will be lost.
  - Added the required column `ticketId` to the `EmailLog` table without a default value. This is not possible if the table is not empty.
  - Made the column `templateId` on table `EmailLog` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `companyId` to the `EmailTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BOUNCED');

-- DropForeignKey
ALTER TABLE "EmailLog" DROP CONSTRAINT "EmailLog_billingTicketId_fkey";

-- DropForeignKey
ALTER TABLE "EmailLog" DROP CONSTRAINT "EmailLog_sentById_fkey";

-- DropForeignKey
ALTER TABLE "EmailLog" DROP CONSTRAINT "EmailLog_templateId_fkey";

-- DropIndex
DROP INDEX "EmailLog_billingTicketId_idx";

-- DropIndex
DROP INDEX "EmailLog_sentAt_idx";

-- DropIndex
DROP INDEX "EmailLog_status_idx";

-- DropIndex
DROP INDEX "EmailTemplate_key_key";

-- AlterTable
ALTER TABLE "EmailLog" DROP COLUMN "billingTicketId",
DROP COLUMN "bodyHtml",
DROP COLUMN "providerMessageId",
DROP COLUMN "sentById",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "resendMessageId" TEXT,
ADD COLUMN     "ticketId" TEXT NOT NULL,
ALTER COLUMN "templateId" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "EmailLogStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "sentAt" DROP NOT NULL,
ALTER COLUMN "sentAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmailTemplate" DROP COLUMN "bodyText",
DROP COLUMN "description",
DROP COLUMN "isActive",
DROP COLUMN "key",
DROP COLUMN "variables",
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "EmailStatus";

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "BillingTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
