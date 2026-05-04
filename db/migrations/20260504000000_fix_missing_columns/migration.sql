-- Fix: columnas presentes en schema.prisma pero ausentes en migraciones anteriores.
-- Todas las operaciones usan IF NOT EXISTS para ser idempotentes.

-- 1. Enum ClientType (faltaba en el init)
DO $$ BEGIN
  CREATE TYPE "ClientType" AS ENUM ('LEGAL_REP', 'BILLING_CONTACT', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Company.taxIdType
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "taxIdType" TEXT;

-- 3. Client.clientType
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "clientType" "ClientType" NOT NULL DEFAULT 'GENERAL';

-- 4. Contract.signatureDate y Contract.coContractors
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "signatureDate" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "coContractors" JSONB;

-- 5. ContractItem.milestoneLabels y ContractItem.breakdownNote
ALTER TABLE "ContractItem" ADD COLUMN IF NOT EXISTS "milestoneLabels" JSONB;
ALTER TABLE "ContractItem" ADD COLUMN IF NOT EXISTS "breakdownNote" TEXT;

-- 6. BillingTicket.description y BillingTicket.breakdownNote
ALTER TABLE "BillingTicket" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "BillingTicket" ADD COLUMN IF NOT EXISTS "breakdownNote" TEXT;
