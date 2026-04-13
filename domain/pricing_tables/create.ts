import { prisma } from "@/db/client";
import { pricingTableSchema, type PricingTableFormValues } from "./schemas";
import { toDecimal } from "@/lib/money";
import { createAuditLog } from "@/domain/audit";

export async function createPricingTable(
  data: PricingTableFormValues,
  userId: string,
  contractId?: string | null
) {
  const parsed = pricingTableSchema.parse(data);

  const newTable = await prisma.pricingTable.create({
    data: {
      name: parsed.name,
      description: parsed.description,
      contractId: contractId ?? null,
      tiers: {
        create: parsed.tiers.map((tier) => ({
          fromQuantity: toDecimal(tier.fromQuantity),
          toQuantity: tier.toQuantity ? toDecimal(tier.toQuantity) : null,
          unitPrice: toDecimal(tier.unitPrice),
          flatFee: tier.flatFee ? toDecimal(tier.flatFee) : null,
        })),
      },
    },
    include: {
      tiers: true,
    },
  });

  await createAuditLog(prisma, {
    action: "pricing_table.create",
    entityType: "PricingTable",
    entityId: newTable.id,
    afterData: newTable,
    userId,
  });

  return newTable;
}
