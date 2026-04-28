-- Add quota and duration fields to ContractItem
-- These come from OCR-extracted contracts (e.g., "mensualidad incluye 2500 conversaciones por 15 meses")

ALTER TABLE "ContractItem"
  ADD COLUMN "quotaLimit" DECIMAL(12,4),
  ADD COLUMN "quotaUnit" TEXT,
  ADD COLUMN "durationMonths" INTEGER;
