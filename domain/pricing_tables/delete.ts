import { prisma } from "@/db/client";
import { createAuditLog } from "@/domain/audit";

export class PricingTableInUseError extends Error {
  constructor() {
    super("No se puede eliminar la tabla de precios porque está en uso por uno o más items de contrato.");
    this.name = "PricingTableInUseError";
  }
}

export async function deletePricingTable(id: string, userId: string): Promise<void> {
  const inUseCount = await prisma.contractItem.count({
    where: { pricingTableId: id },
  });

  if (inUseCount > 0) {
    throw new PricingTableInUseError();
  }

  const existingTable = await prisma.pricingTable.findUnique({
    where: { id },
  });

  if (!existingTable) {
    throw new Error("Pricing Table not found");
  }

  await prisma.$transaction([
    prisma.pricingTier.deleteMany({ where: { pricingTableId: id } }),
    prisma.pricingTable.delete({ where: { id } }),
  ]);

  await createAuditLog(prisma, {
    action: "pricing_table.delete",
    entityType: "PricingTable",
    entityId: id,
    beforeData: existingTable,
    userId,
  });
}
