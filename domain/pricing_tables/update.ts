import { prisma } from "@/db/client";
import { pricingTableSchema, type PricingTableFormValues } from "./schemas";
import { toDecimal } from "@/lib/money";
import { createAuditLog } from "@/domain/audit";

export async function updatePricingTable(id: string, data: PricingTableFormValues, userId: string) {
  const parsed = pricingTableSchema.parse(data);

  const existingTable = await prisma.pricingTable.findUnique({
    where: { id },
    include: { tiers: true },
  });

  if (!existingTable) {
    throw new Error("Pricing Table not found");
  }

  // To update tiers cleanly: delete old tiers, create new ones.
  const [_, updatedTable] = await prisma.$transaction([
    prisma.pricingTier.deleteMany({ where: { pricingTableId: id } }),
    prisma.pricingTable.update({
      where: { id },
      data: {
        name: parsed.name,
        description: parsed.description,
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
    }),
  ]);

  await createAuditLog(prisma, {
    action: "pricing_table.update",
    entityType: "PricingTable",
    entityId: id,
    beforeData: existingTable,
    afterData: updatedTable,
    userId,
  });

  return updatedTable;
}
