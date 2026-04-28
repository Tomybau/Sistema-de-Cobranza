-- Restore Document/ExtractionResult stubs (dropped in a previous failed session)
-- Drop InboundDocument if it exists from a previous session
ALTER TABLE IF EXISTS "InboundDocument" DROP CONSTRAINT IF EXISTS "InboundDocument_companyId_fkey";
ALTER TABLE IF EXISTS "InboundDocument" DROP CONSTRAINT IF EXISTS "InboundDocument_matchedTicketId_fkey";
ALTER TABLE IF EXISTS "InboundDocument" DROP CONSTRAINT IF EXISTS "InboundDocument_reviewedBy_fkey";
DROP TABLE IF EXISTS "InboundDocument";
DROP TYPE IF EXISTS "InboundDocStatus";

-- Restore DocumentSource enum (if altered in previous session)
DROP TYPE IF EXISTS "DocumentSource";
CREATE TYPE "DocumentSource" AS ENUM ('MANUAL_UPLOAD', 'EMAIL_INGEST', 'DRIVE_INGEST', 'API');

-- Restore Document table (Phase 2 stub — kept for future use)
CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "type" TEXT NOT NULL,
    "source" "DocumentSource" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Document_contractId_idx" ON "Document"("contractId");
CREATE INDEX IF NOT EXISTS "Document_source_idx" ON "Document"("source");

-- Restore ExtractionResult table (Phase 2 stub — kept for future use)
DROP TYPE IF EXISTS "ExtractionStatus";
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING_VALIDATION', 'VALIDATED', 'REJECTED', 'CORRECTED');

CREATE TABLE IF NOT EXISTS "ExtractionResult" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelVersion" TEXT,
    "rawOutput" JSONB NOT NULL,
    "correctedOutput" JSONB,
    "confidence" DECIMAL(5,4),
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractionResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExtractionResult_documentId_idx" ON "ExtractionResult"("documentId");
CREATE INDEX IF NOT EXISTS "ExtractionResult_status_idx" ON "ExtractionResult"("status");

-- Session 9: Add OcrStatus enum
DROP TYPE IF EXISTS "OcrStatus";
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- Session 9: Add ContractDocument table
CREATE TABLE "ContractDocument" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "ocrRawText" TEXT,
    "ocrExtracted" JSONB,
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContractDocument_contractId_idx" ON "ContractDocument"("contractId");
CREATE INDEX "ContractDocument_ocrStatus_idx" ON "ContractDocument"("ocrStatus");

-- Session 9: Add attachment fields to Payment
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "attachmentKey" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;

-- Session 9: Foreign keys for ContractDocument
ALTER TABLE "ContractDocument"
  ADD CONSTRAINT "ContractDocument_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractDocument"
  ADD CONSTRAINT "ContractDocument_uploadedBy_fkey"
  FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
