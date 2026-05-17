-- Session 11: Plan de cuotas con porcentajes por hito (installmentPlan)
-- Idempotente: ADD COLUMN IF NOT EXISTS

ALTER TABLE "ContractItem" ADD COLUMN IF NOT EXISTS "installmentPlan" JSONB;
