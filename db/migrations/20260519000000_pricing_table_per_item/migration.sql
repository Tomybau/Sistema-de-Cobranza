-- PricingTable 1:1 con ContractItem (Session 12, plan D)
-- Antes: PricingTable era per-contract; varios ContractItem podían referenciar la misma tabla via pricingTableId.
-- Después: cada PricingTable pertenece a exactamente un ContractItem (contractItemId, UNIQUE, NOT NULL).
-- La columna ContractItem.pricingTableId desaparece (relación inversa 1:1 desde el lado PricingTable).
-- Tablas compartidas se clonan (tabla + tiers) para preservar datos.

-- Paso 1: agregar columna nullable
ALTER TABLE "PricingTable" ADD COLUMN IF NOT EXISTS "contractItemId" TEXT;

-- Paso 2: migración de datos en PL/pgSQL
DO $$
DECLARE
  pt_row RECORD;
  item_row RECORD;
  first BOOLEAN;
  new_pt_id TEXT;
  new_tier_id TEXT;
BEGIN
  -- Para cada PricingTable existente
  FOR pt_row IN SELECT id, name, description FROM "PricingTable" LOOP
    first := TRUE;
    FOR item_row IN SELECT id FROM "ContractItem" WHERE "pricingTableId" = pt_row.id LOOP
      IF first THEN
        -- Primer item: asigna la tabla original
        UPDATE "PricingTable" SET "contractItemId" = item_row.id WHERE id = pt_row.id;
        first := FALSE;
      ELSE
        -- Items adicionales: clonar tabla + tiers, reasignar pricingTableId del item
        new_pt_id := 'pt_clone_' || substr(md5(random()::text || pt_row.id || item_row.id), 1, 20);
        INSERT INTO "PricingTable" (id, "contractItemId", name, description, "createdAt", "updatedAt")
        VALUES (new_pt_id, item_row.id, pt_row.name, pt_row.description, NOW(), NOW());
        -- clonar tiers
        FOR new_tier_id IN
          SELECT 'pt_tier_' || substr(md5(random()::text || t.id), 1, 20)
          FROM "PricingTier" t WHERE t."pricingTableId" = pt_row.id
        LOOP
          NULL; -- placeholder (los tiers se insertan abajo con SELECT)
        END LOOP;
        INSERT INTO "PricingTier" (id, "pricingTableId", "fromQuantity", "toQuantity", "unitPrice", "flatFee", "createdAt")
        SELECT
          'pt_tier_' || substr(md5(random()::text || id || item_row.id), 1, 20),
          new_pt_id,
          "fromQuantity",
          "toQuantity",
          "unitPrice",
          "flatFee",
          NOW()
        FROM "PricingTier" WHERE "pricingTableId" = pt_row.id;
        UPDATE "ContractItem" SET "pricingTableId" = new_pt_id WHERE id = item_row.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Paso 3: borrar PricingTables huérfanas (sin item asociado)
DELETE FROM "PricingTier" WHERE "pricingTableId" IN (
  SELECT id FROM "PricingTable" WHERE "contractItemId" IS NULL
);
DELETE FROM "PricingTable" WHERE "contractItemId" IS NULL;

-- Paso 4: NOT NULL + UNIQUE + FK en PricingTable.contractItemId
ALTER TABLE "PricingTable" ALTER COLUMN "contractItemId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "PricingTable_contractItemId_key" ON "PricingTable"("contractItemId");
ALTER TABLE "PricingTable"
  ADD CONSTRAINT "PricingTable_contractItemId_fkey"
  FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Paso 5: quitar columna pricingTableId de ContractItem
ALTER TABLE "ContractItem" DROP CONSTRAINT IF EXISTS "ContractItem_pricingTableId_fkey";
ALTER TABLE "ContractItem" DROP COLUMN IF EXISTS "pricingTableId";

-- Paso 6: quitar contractId de PricingTable (queda redundante: se infiere via contractItem.contractId)
ALTER TABLE "PricingTable" DROP CONSTRAINT IF EXISTS "PricingTable_contractId_fkey";
ALTER TABLE "PricingTable" DROP COLUMN IF EXISTS "contractId";
