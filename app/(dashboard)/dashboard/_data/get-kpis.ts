import { prisma } from "@/db/client"
import { BillingTicketStatus } from "@prisma/client"
import { startOfMonth, subMonths, endOfMonth } from "date-fns"
import { TZDate } from "@date-fns/tz"

const TIMEZONE = process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires"

export type KPIData = {
  billedThisMonth: number
  collectedThisMonth: number
  overdueCount: number
  collectionRate: number // 0-100
  deltas: {
    billed: number | null
    collected: number | null
  }
}

export async function getDashboardKpis({ companyId }: { companyId?: string }): Promise<KPIData> {
  const now = new Date()
  const zonedNow = new TZDate(now, TIMEZONE)
  
  const currentMonthStart = startOfMonth(zonedNow)
  const currentMonthEnd = endOfMonth(zonedNow)
  
  const previousMonthStart = startOfMonth(subMonths(zonedNow, 1))
  const previousMonthEnd = endOfMonth(subMonths(zonedNow, 1))

  const companyFilter = companyId ? { contract: { companyId } } : {}
  const companyFilterPayment = companyId ? { payment: { companyId } } : {}

  // 1. Facturado este mes
  const billedThisMonthAgg = await prisma.billingTicket.aggregate({
    _sum: { amount: true },
    where: {
      ...companyFilter,
      createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
      status: { not: BillingTicketStatus.CANCELLED },
    },
  })
  const billedThisMonth = billedThisMonthAgg._sum.amount?.toNumber() || 0

  // 1b. Facturado mes anterior
  const billedPrevMonthAgg = await prisma.billingTicket.aggregate({
    _sum: { amount: true },
    where: {
      ...companyFilter,
      createdAt: { gte: previousMonthStart, lte: previousMonthEnd },
      status: { not: BillingTicketStatus.CANCELLED },
    },
  })
  const billedPrevMonth = billedPrevMonthAgg._sum.amount?.toNumber() || 0

  // 2. Cobrado este mes
  const collectedThisMonthAgg = await prisma.paymentTicket.aggregate({
    _sum: { allocatedAmount: true },
    where: {
      ...companyFilterPayment,
      payment: {
        ...(companyId ? { companyId } : {}),
        paymentDate: { gte: currentMonthStart, lte: currentMonthEnd },
        status: "PROCESSED",
      },
    },
  })
  const collectedThisMonth = collectedThisMonthAgg._sum.allocatedAmount?.toNumber() || 0

  // 2b. Cobrado mes anterior
  const collectedPrevMonthAgg = await prisma.paymentTicket.aggregate({
    _sum: { allocatedAmount: true },
    where: {
      ...companyFilterPayment,
      payment: {
        ...(companyId ? { companyId } : {}),
        paymentDate: { gte: previousMonthStart, lte: previousMonthEnd },
        status: "PROCESSED",
      },
    },
  })
  const collectedPrevMonth = collectedPrevMonthAgg._sum.allocatedAmount?.toNumber() || 0

  // 3. Tickets vencidos
  const overdueCount = await prisma.billingTicket.count({
    where: {
      ...companyFilter,
      status: BillingTicketStatus.OVERDUE,
    },
  })

  // 4. Tasa de cobro = (Cobrado / Facturado) * 100
  const collectionRate = billedThisMonth > 0 ? (collectedThisMonth / billedThisMonth) * 100 : 0

  // Deltas
  const billedDelta = billedPrevMonth > 0 ? ((billedThisMonth - billedPrevMonth) / billedPrevMonth) * 100 : null
  const collectedDelta = collectedPrevMonth > 0 ? ((collectedThisMonth - collectedPrevMonth) / collectedPrevMonth) * 100 : null

  return {
    billedThisMonth,
    collectedThisMonth,
    overdueCount,
    collectionRate,
    deltas: {
      billed: billedDelta,
      collected: collectedDelta,
    },
  }
}
