import { prisma } from "@/db/client"
import { BillingTicketStatus } from "@prisma/client"

export type TicketStatusSummaryData = {
  status: BillingTicketStatus
  count: number
  amount: number
}

export async function getTicketStatusSummary({ companyId }: { companyId?: string }): Promise<TicketStatusSummaryData[]> {
  const companyFilter = companyId ? { contract: { companyId } } : {}

  const grouped = await prisma.billingTicket.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { amount: true },
    where: {
      ...companyFilter,
    },
  })

  // Ensure all statuses are present in the result even if count is 0
  const allStatuses = Object.values(BillingTicketStatus)
  const result: TicketStatusSummaryData[] = allStatuses.map((status) => {
    const found = grouped.find((g) => g.status === status)
    return {
      status,
      count: found?._count?._all || 0,
      amount: found?._sum?.amount?.toNumber() || 0,
    }
  })

  return result
}
