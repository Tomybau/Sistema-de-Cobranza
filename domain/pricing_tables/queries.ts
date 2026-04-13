import { prisma } from "@/db/client"

function serializeTiers<T extends {
  fromQuantity: { toString(): string }
  toQuantity: { toString(): string } | null
  unitPrice: { toString(): string }
  flatFee: { toString(): string } | null
}>(tiers: T[]) {
  return tiers.map((t) => ({
    ...t,
    fromQuantity: t.fromQuantity.toString(),
    toQuantity: t.toQuantity?.toString() ?? null,
    unitPrice: t.unitPrice.toString(),
    flatFee: t.flatFee?.toString() ?? null,
  }))
}

export async function listPricingTables(options?: { contractId?: string }) {
  const rows = await prisma.pricingTable.findMany({
    where: options?.contractId ? { contractId: options.contractId } : undefined,
    include: {
      tiers: { orderBy: { fromQuantity: "asc" } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return rows.map((r) => ({ ...r, tiers: serializeTiers(r.tiers) }))
}

export type PricingTableListItem = Awaited<ReturnType<typeof listPricingTables>>[number]

export async function getPricingTableById(id: string) {
  const table = await prisma.pricingTable.findUnique({
    where: { id },
    include: {
      tiers: { orderBy: { fromQuantity: "asc" } },
      items: {
        where: { contract: { deletedAt: null } },
        include: {
          contract: {
            select: { id: true, contractNumber: true, title: true },
          },
        },
      },
    },
  })
  if (!table) return null
  return { ...table, tiers: serializeTiers(table.tiers) }
}

export type PricingTableDetail = NonNullable<Awaited<ReturnType<typeof getPricingTableById>>>
