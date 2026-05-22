-- Add autoRenew flag to ContractItem
-- When durationMonths is set:
--   autoRenew=false  → item stops generating tickets after durationMonths
--   autoRenew=true   → item continues generating tickets after durationMonths (committed period + renewal)
ALTER TABLE "ContractItem" ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN NOT NULL DEFAULT false;
