import { prisma } from "@/db/client"
import { BillingTicketStatus } from "@prisma/client"
import { startOfMonth, subMonths, format } from "date-fns"
import { TZDate } from "@date-fns/tz"

const TIMEZONE = process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires"

export type RevenueMonthData = {
  month: string // "Nov", "Dic", etc.
  billed: number
  collected: number
}

export async function getRevenueByMonth({ companyId }: { companyId?: string }): Promise<RevenueMonthData[]> {
  const now = new Date()
  const zonedNow = new TZDate(now, TIMEZONE)
  
  // 6 months ago, start of that month
  const startDate = startOfMonth(subMonths(zonedNow, 5))

  const companyFilter = companyId ? { contract: { companyId } } : {}
  const companyFilterPayment = companyId ? { payment: { companyId } } : {}

  const tickets = await prisma.billingTicket.findMany({
    where: {
      ...companyFilter,
      createdAt: { gte: startDate },
      status: { not: BillingTicketStatus.CANCELLED },
    },
    select: { amount: true, createdAt: true },
  })

  const payments = await prisma.paymentTicket.findMany({
    where: {
      ...companyFilterPayment,
      payment: {
        ...(companyId ? { companyId } : {}),
        paymentDate: { gte: startDate },
        status: "PROCESSED",
      },
    },
    select: { allocatedAmount: true, payment: { select: { paymentDate: true } } },
  })

  // Initialize 6 months array
  const monthsData: Record<string, RevenueMonthData> = {}
  
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(zonedNow, i)
    // format to "MMM" (e.g., Nov, Dic) - note: standard date-fns locale is English if not provided, 
    // let's use standard format, prompt said "Nov", "Dic".
    const monthKey = format(d, "yyyy-MM")
    monthsData[monthKey] = {
      month: format(d, "MMM"), // will be short month name
      billed: 0,
      collected: 0,
    }
  }

  // Aggregate billed
  for (const t of tickets) {
    const tzDate = new TZDate(t.createdAt, TIMEZONE)
    const monthKey = format(tzDate, "yyyy-MM")
    if (monthsData[monthKey]) {
      monthsData[monthKey].billed += t.amount.toNumber()
    }
  }

  // Aggregate collected
  for (const p of payments) {
    const tzDate = new TZDate(p.payment.paymentDate, TIMEZONE)
    const monthKey = format(tzDate, "yyyy-MM")
    if (monthsData[monthKey]) {
      monthsData[monthKey].collected += p.allocatedAmount.toNumber()
    }
  }

  // Return strictly the array ordered chronologically
  return Object.keys(monthsData).sort().map((key) => monthsData[key])
}
