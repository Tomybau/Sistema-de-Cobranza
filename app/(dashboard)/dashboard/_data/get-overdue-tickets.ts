import { prisma } from "@/db/client"
import { BillingTicketStatus } from "@prisma/client"
import { differenceInDays } from "date-fns"
import { TZDate } from "@date-fns/tz"

const TIMEZONE = process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires"

export type OverdueTicketData = {
  id: string
  ticketNumber: string
  clientName: string
  companyName: string
  totalAmount: number
  dueDate: string // ISO string
  daysOverdue: number
}

export async function getOverdueTickets({ companyId }: { companyId?: string }): Promise<OverdueTicketData[]> {
  const companyFilter = companyId ? { contract: { companyId } } : {}

  const tickets = await prisma.billingTicket.findMany({
    where: {
      ...companyFilter,
      status: BillingTicketStatus.OVERDUE,
    },
    include: {
      contract: {
        include: {
          company: true,
          // Need client info. Client is related to Company. It could be the primary client of the company.
          // Wait, the prompt says "client, company". A Contract has a company. The company has clients.
          // Let's get the primary client of the company.
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
  })

  // We need clients to find the primary one for the ticket's company
  const companyIds = Array.from(new Set(tickets.map((t) => t.contract.companyId)))
  const clients = await prisma.client.findMany({
    where: { companyId: { in: companyIds }, isPrimary: true },
  })

  const now = new Date()
  const zonedNow = new TZDate(now, TIMEZONE)

  return tickets.map((t) => {
    const zonedDueDate = new TZDate(t.dueDate, TIMEZONE)
    const daysOverdue = differenceInDays(zonedNow, zonedDueDate)
    const primaryClient = clients.find((c) => c.companyId === t.contract.companyId)

    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      clientName: primaryClient?.fullName || "Sin contacto",
      companyName: t.contract.company.legalName,
      totalAmount: t.amount.toNumber(),
      dueDate: t.dueDate.toISOString(),
      daysOverdue: Math.max(0, daysOverdue),
    }
  })
}
