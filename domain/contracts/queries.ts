import { prisma } from "@/db/client"
import type { ContractStatus } from "@prisma/client"

export async function listContracts(filters?: {
  status?: ContractStatus[]
  companyId?: string
}) {
  const rows = await prisma.contract.findMany({
    where: {
      deletedAt: null,
      ...(filters?.status?.length ? { status: { in: filters.status } } : {}),
      ...(filters?.companyId ? { companyId: filters.companyId } : {}),
    },
    include: {
      company: { select: { id: true, legalName: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return rows.map((r) => ({
    ...r,
    lateFeePercent: r.lateFeePercent.toString(),
  }))
}

export type ContractListItem = Awaited<ReturnType<typeof listContracts>>[number]

export async function getContractById(id: string) {
  const contract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
    include: {
      company: { select: { id: true, legalName: true, tradeName: true } },
      items: {
        include: {
          pricingTable: {
            include: {
              tiers: { orderBy: { fromQuantity: "asc" } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!contract) return null
  return {
    ...contract,
    lateFeePercent: contract.lateFeePercent.toString(),
    items: contract.items.map((item) => ({
      ...item,
      fixedAmount: item.fixedAmount?.toString() ?? null,
      totalAmount: item.totalAmount?.toString() ?? null,
      pricingTable: item.pricingTable
        ? {
            id: item.pricingTable.id,
            name: item.pricingTable.name,
            description: item.pricingTable.description,
            tiers: item.pricingTable.tiers.map((t) => ({
              id: t.id,
              fromQuantity: t.fromQuantity.toString(),
              toQuantity: t.toQuantity?.toString() ?? null,
              unitPrice: t.unitPrice.toString(),
              flatFee: t.flatFee?.toString() ?? null,
            })),
          }
        : null,
    })),
  }
}

export type ContractDetail = NonNullable<Awaited<ReturnType<typeof getContractById>>>
