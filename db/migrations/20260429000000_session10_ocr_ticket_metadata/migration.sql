-- Session 10: OCR extendido + metadata de tickets
-- Todos los ALTER usan IF NOT EXISTS / IF EXISTS para ser idempotentes

-- ClientType enum
DO $$ BEGIN
  CREATE TYPE "ClientType" AS ENUM ('LEGAL_REP', 'BILLING_CONTACT', 'GENERAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Company: tipo de ID fiscal
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "taxIdType" TEXT;

-- Client: tipo de contacto estructurado
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "clientType" "ClientType" NOT NULL DEFAULT 'GENERAL';

-- Contract: fecha de firma y co-contratantes (para contratos multi-empresa)
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "signatureDate" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "coContractors" JSONB;

-- ContractItem: etiquetas de hitos (INSTALLMENT) y nota de desglose de monto
ALTER TABLE "ContractItem" ADD COLUMN IF NOT EXISTS "milestoneLabels" JSONB;
ALTER TABLE "ContractItem" ADD COLUMN IF NOT EXISTS "breakdownNote" TEXT;

-- BillingTicket: descripción del hito y desglose del monto
ALTER TABLE "BillingTicket" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "BillingTicket" ADD COLUMN IF NOT EXISTS "breakdownNote" TEXT;
