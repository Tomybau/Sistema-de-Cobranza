/**
 * domain/dashboard/queries.ts
 * KPIs para el dashboard principal.
 */

import { prisma } from "@/db/client"
import { startOfMonth, endOfMonth } from "date-fns"

export interface DashboardKpis {
  totalBilledThisMonth: number
  totalPending: number
  totalOverdue: number
  activeContractsCount: number
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const [billedAgg, pendingAgg, overdueAgg, activeContracts] =
    await Promise.all([
      // Total facturado este mes
      prisma.billingTicket.aggregate({
        _sum: { amount: true },
        where: {
          issueDate: { gte: monthStart, lte: monthEnd },
        },
      }),
      // Total pendiente de cobro (PENDING o SENT)
      prisma.billingTicket.aggregate({
        _sum: { amount: true },
        where: {
          status: { in: ["PENDING", "SENT"] },
        },
      }),
      // Total en mora: OVERDUE, o dueDate pasada y no PAID/CANCELLED
      prisma.billingTicket.aggregate({
        _sum: { amount: true },
        where: {
          OR: [
            { status: "OVERDUE" },
            {
              dueDate: { lt: now },
              status: { notIn: ["PAID", "CANCELLED"] },
            },
          ],
        },
      }),
      // Contratos activos
      prisma.contract.count({
        where: {
          status: "ACTIVE",
          deletedAt: null,
        },
      }),
    ])

  return {
    totalBilledThisMonth: Number(billedAgg._sum.amount ?? 0),
    totalPending: Number(pendingAgg._sum.amount ?? 0),
    totalOverdue: Number(overdueAgg._sum.amount ?? 0),
    activeContractsCount: activeContracts,
  }
}
