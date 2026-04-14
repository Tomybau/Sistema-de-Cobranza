/*
  Warnings:

  - You are about to drop the column `amount` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `registeredById` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `amountApplied` on the `PaymentTicket` table. All the data in the column will be lost.
  - Added the required column `clientId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `grossAmount` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `allocatedAmount` to the `PaymentTicket` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PROCESSED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_registeredById_fkey";

-- AlterTable
ALTER TABLE "BillingTicket" ADD COLUMN     "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "amount",
DROP COLUMN "registeredById",
ADD COLUMN     "clientId" TEXT NOT NULL,
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "grossAmount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PROCESSED';

-- AlterTable
ALTER TABLE "PaymentTicket" DROP COLUMN "amountApplied",
ADD COLUMN     "allocatedAmount" DECIMAL(12,2) NOT NULL;

-- CreateIndex
CREATE INDEX "Payment_companyId_idx" ON "Payment"("companyId");

-- CreateIndex
CREATE INDEX "Payment_clientId_idx" ON "Payment"("clientId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
