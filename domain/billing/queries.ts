import { prisma } from "@/db/client"
import type { BillingTicketStatus } from "@prisma/client"

export async function listBillingTicketsByContract(contractId: string) {
  const rows = await prisma.billingTicket.findMany({
    where: { contractId },
    include: {
      contractItem: { select: { id: true, name: true, type: true } },
    },
    orderBy: [{ periodStart: "desc" }, { dueDate: "desc" }],
  })

  return rows.map((r) => ({
    id: r.id,
    ticketNumber: r.ticketNumber,
    contractItemId: r.contractItemId,
    itemName: r.contractItem.name,
    itemType: r.contractItem.type,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    issueDate: r.issueDate,
    dueDate: r.dueDate,
    amount: r.amount.toString(),
    currency: r.currency,
    variableQuantity: r.variableQuantity?.toString() ?? null,
    status: r.status as BillingTicketStatus,
    paidAt: r.paidAt,
    cancelledAt: r.cancelledAt,
    installmentNum: null as number | null, // not stored on ticket — derived from ticketNumber if needed
  }))
}

export type BillingTicketListItem = Awaited<ReturnType<typeof listBillingTicketsByContract>>[number]

/**
 * Returns existing ticket refs for idempotency checks (excludes CANCELLED).
 * Used by the generate function to determine which tickets already exist.
 */
export async function getExistingTicketRefs(contractId: string) {
  const rows = await prisma.billingTicket.findMany({
    where: {
      contractId,
      status: { not: "CANCELLED" },
    },
    select: { ticketNumber: true, contractItemId: true },
  })

  return rows.map((r) => ({
    ticketNumber: r.ticketNumber,
    contractItemId: r.contractItemId,
    installmentNum: null as number | null,
  }))
}

// ─── listAllBillingTickets ────────────────────────────────────────────────────

export async function listAllBillingTickets(filters?: {
  status?: BillingTicketStatus[]
  contractId?: string
  companyId?: string
  dueDateFrom?: Date
  dueDateTo?: Date
}) {
  const rows = await prisma.billingTicket.findMany({
    where: {
      ...(filters?.status?.length ? { status: { in: filters.status } } : {}),
      ...(filters?.contractId ? { contractId: filters.contractId } : {}),
      ...(filters?.companyId
        ? { contract: { companyId: filters.companyId } }
        : {}),
      ...(filters?.dueDateFrom || filters?.dueDateTo
        ? {
            dueDate: {
              ...(filters?.dueDateFrom ? { gte: filters.dueDateFrom } : {}),
              ...(filters?.dueDateTo ? { lte: filters.dueDateTo } : {}),
            },
          }
        : {}),
    },
    include: {
      contract: {
        select: {
          id: true,
          contractNumber: true,
          title: true,
          company: { select: { id: true, legalName: true } },
        },
      },
      contractItem: { select: { id: true, name: true, type: true } },
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
  })

  return rows.map((r) => ({
    id: r.id,
    ticketNumber: r.ticketNumber,
    contractId: r.contractId,
    contractNumber: r.contract.contractNumber,
    contractTitle: r.contract.title,
    companyId: r.contract.company.id,
    companyName: r.contract.company.legalName,
    contractItemId: r.contractItemId,
    itemName: r.contractItem.name,
    itemType: r.contractItem.type,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    issueDate: r.issueDate,
    dueDate: r.dueDate,
    amount: r.amount.toString(),
    currency: r.currency,
    variableQuantity: r.variableQuantity?.toString() ?? null,
    status: r.status as BillingTicketStatus,
    notes: r.notes,
    paidAt: r.paidAt,
    cancelledAt: r.cancelledAt,
    createdAt: r.createdAt,
  }))
}

export type BillingTicketSummary = Awaited<
  ReturnType<typeof listAllBillingTickets>
>[number]

// ─── getBillingTicketById ─────────────────────────────────────────────────────

export async function getBillingTicketById(id: string) {
  const row = await prisma.billingTicket.findUnique({
    where: { id },
    include: {
      contract: {
        select: {
          id: true,
          contractNumber: true,
          title: true,
          company: { select: { id: true, legalName: true } },
        },
      },
      contractItem: { select: { id: true, name: true, type: true } },
      payments: {
        include: {
          payment: {
            select: {
              id: true,
              paymentNumber: true,
              amount: true,
              currency: true,
              paymentDate: true,
              method: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!row) return null

  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    contractId: row.contractId,
    contractNumber: row.contract.contractNumber,
    contractTitle: row.contract.title,
    companyId: row.contract.company.id,
    companyName: row.contract.company.legalName,
    contractItemId: row.contractItemId,
    itemName: row.contractItem.name,
    itemType: row.contractItem.type,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    amount: row.amount.toString(),
    currency: row.currency,
    variableQuantity: row.variableQuantity?.toString() ?? null,
    status: row.status as BillingTicketStatus,
    notes: row.notes,
    paidAt: row.paidAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    payments: row.payments.map((pt) => ({
      id: pt.id,
      paymentId: pt.paymentId,
      paymentNumber: pt.payment.paymentNumber,
      paymentDate: pt.payment.paymentDate,
      method: pt.payment.method,
      amountApplied: pt.amountApplied.toString(),
      currency: pt.payment.currency,
    })),
  }
}

export type BillingTicketDetail = NonNullable<
  Awaited<ReturnType<typeof getBillingTicketById>>
>
