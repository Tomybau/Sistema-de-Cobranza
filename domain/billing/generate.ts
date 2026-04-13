import { prisma } from "@/db/client"
import { Prisma } from "@prisma/client"
import { createAuditLog } from "@/domain/audit"
import { calculateTicketsForContract, calculateVariableAmount } from "./calculate"
import { getExistingTicketRefs } from "./queries"
import type { BillingContractItem, BillingPricingTable, TicketDraft } from "./types"

export interface GenerateResult {
  inserted: number
  needsInput: PickedDraft[] // VARIABLE drafts without a quantity — admin must input
  skipped: number           // tickets already existed (idempotent skips)
}

// Minimal shape returned to the caller for NEEDS_QUANTITY drafts
export interface PickedDraft {
  contractItemId: string
  itemName: string
  ticketNumber: string
  pricingTableId: string
}

/**
 * Loads the contract, calculates drafts, resolves VARIABLE amounts where
 * quantities are provided, and inserts all READY tickets in a single transaction.
 *
 * Idempotent: calling with the same contractId + periodDate twice will insert
 * 0 tickets on the second call (ticketNumber uniqueness in DB is the hard guard;
 * the domain calc is the soft guard that avoids even trying).
 */
export async function generateBillingTickets(
  contractId: string,
  periodDate: Date,
  variableQuantities: Record<string, string>, // itemId → quantity (Decimal string)
  userId?: string
): Promise<GenerateResult> {
  // ── 1. Load contract + items + pricing tiers ──────────────────────────────
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, deletedAt: null },
    include: {
      items: {
        where: { isActive: true },
        include: {
          pricingTable: {
            include: { tiers: { orderBy: { fromQuantity: "asc" } } },
          },
        },
      },
    },
  })

  if (!contract) throw new Error("Contrato no encontrado o eliminado.")

  // ── 2. Existing tickets (for idempotency) ─────────────────────────────────
  const existingRefs = await getExistingTicketRefs(contractId)
  const existingNumbers = new Set(existingRefs.map((r) => r.ticketNumber))

  // ── 3. Build domain-safe item shapes ──────────────────────────────────────
  const domainItems: BillingContractItem[] = contract.items.map((item) => {
    let pricingTable: BillingPricingTable | null = null
    if (item.pricingTable) {
      pricingTable = {
        id: item.pricingTable.id,
        tiers: item.pricingTable.tiers.map((t) => ({
          id: t.id,
          fromQuantity: t.fromQuantity.toString(),
          toQuantity: t.toQuantity?.toString() ?? null,
          unitPrice: t.unitPrice.toString(),
          flatFee: t.flatFee?.toString() ?? null,
        })),
      }
    }
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      fixedAmount: item.fixedAmount?.toString() ?? null,
      pricingTableId: item.pricingTableId ?? null,
      pricingTable,
      totalAmount: item.totalAmount?.toString() ?? null,
      installments: item.installments ?? null,
      billingDayOfMonth: item.billingDayOfMonth ?? null,
      isActive: item.isActive,
      startDate: item.startDate,
      endDate: item.endDate,
    }
  })

  // ── 4. Calculate drafts ───────────────────────────────────────────────────
  const allDrafts = calculateTicketsForContract({
    contract: {
      contractNumber: contract.contractNumber,
      paymentTermsDays: contract.paymentTermsDays,
      currency: contract.currency,
      startDate: contract.startDate,
      endDate: contract.endDate,
    },
    items: domainItems,
    periodDate,
    issueDate: new Date(),
    existingTickets: existingRefs,
  })

  // ── 5. Separate READY from NEEDS_QUANTITY ─────────────────────────────────
  const readyDrafts: TicketDraft[] = []
  const needsInputDrafts: TicketDraft[] = []

  for (const draft of allDrafts) {
    if (draft.status === "NEEDS_QUANTITY") {
      const qty = variableQuantities[draft.contractItemId]
      if (qty !== undefined && qty !== "") {
        // Resolve the amount using the pricing table
        const domainItem = domainItems.find((i) => i.id === draft.contractItemId)
        if (domainItem?.pricingTable) {
          const amount = calculateVariableAmount(domainItem.pricingTable, qty)
          readyDrafts.push({
            ...draft,
            amount,
            status: "READY",
          })
        } else {
          needsInputDrafts.push(draft)
        }
      } else {
        needsInputDrafts.push(draft)
      }
    } else {
      readyDrafts.push(draft)
    }
  }

  // ── 6. Compute skipped count ──────────────────────────────────────────────
  // Drafts that were skipped because their ticketNumber already existed
  // We re-run without existingRefs to get the full would-be list
  const wouldBeAll = calculateTicketsForContract({
    contract: {
      contractNumber: contract.contractNumber,
      paymentTermsDays: contract.paymentTermsDays,
      currency: contract.currency,
      startDate: contract.startDate,
      endDate: contract.endDate,
    },
    items: domainItems,
    periodDate,
    issueDate: new Date(),
    existingTickets: [],
  })
  const skipped = wouldBeAll.filter((d) => existingNumbers.has(d.ticketNumber)).length

  // ── 7. Insert in a single transaction ────────────────────────────────────
  if (readyDrafts.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const draft of readyDrafts) {
        if (draft.amount === null) continue // should not happen — all READY have amounts

        const ticket = await tx.billingTicket.create({
          data: {
            ticketNumber: draft.ticketNumber,
            contractId,
            contractItemId: draft.contractItemId,
            periodStart: draft.periodStart,
            periodEnd: draft.periodEnd,
            issueDate: draft.issueDate,
            dueDate: draft.dueDate,
            amount: new Prisma.Decimal(draft.amount),
            currency: draft.currency,
            variableQuantity:
              draft.type === "RECURRING_VARIABLE" && variableQuantities[draft.contractItemId]
                ? new Prisma.Decimal(variableQuantities[draft.contractItemId])
                : null,
            status: "PENDING",
          },
        })

        await createAuditLog(tx as Parameters<typeof createAuditLog>[0], {
          userId,
          action: "ticket.create",
          entityType: "BillingTicket",
          entityId: ticket.id,
          afterData: {
            ticketNumber: ticket.ticketNumber,
            contractId,
            contractItemId: draft.contractItemId,
            type: draft.type,
            amount: draft.amount,
            periodStart: draft.periodStart,
            periodEnd: draft.periodEnd,
            dueDate: draft.dueDate,
          },
        })
      }
    })
  }

  return {
    inserted: readyDrafts.length,
    needsInput: needsInputDrafts.map((d) => ({
      contractItemId: d.contractItemId,
      itemName: d.itemName,
      ticketNumber: d.ticketNumber,
      pricingTableId: d.pricingTableId!,
    })),
    skipped,
  }
}

/**
 * Computes a preview of what would be generated for a given period.
 * Pure read — no DB writes.
 */
export async function previewBillingTickets(
  contractId: string,
  periodDate: Date
): Promise<{
  drafts: Array<{
    contractItemId: string
    itemName: string
    type: string
    ticketNumber: string
    amount: string | null
    status: "READY" | "NEEDS_QUANTITY"
    installmentNum: number | null
    pricingTableId: string | null
    issueDate: string
    dueDate: string
  }>
  skipped: number
}> {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, deletedAt: null },
    include: {
      items: {
        where: { isActive: true },
        include: {
          pricingTable: {
            include: { tiers: { orderBy: { fromQuantity: "asc" } } },
          },
        },
      },
    },
  })

  if (!contract) return { drafts: [], skipped: 0 }

  const existingRefs = await getExistingTicketRefs(contractId)
  const existingNumbers = new Set(existingRefs.map((r) => r.ticketNumber))

  const domainItems: BillingContractItem[] = contract.items.map((item) => ({
    id: item.id,
    type: item.type,
    name: item.name,
    fixedAmount: item.fixedAmount?.toString() ?? null,
    pricingTableId: item.pricingTableId ?? null,
    pricingTable: item.pricingTable
      ? {
          id: item.pricingTable.id,
          tiers: item.pricingTable.tiers.map((t) => ({
            id: t.id,
            fromQuantity: t.fromQuantity.toString(),
            toQuantity: t.toQuantity?.toString() ?? null,
            unitPrice: t.unitPrice.toString(),
            flatFee: t.flatFee?.toString() ?? null,
          })),
        }
      : null,
    totalAmount: item.totalAmount?.toString() ?? null,
    installments: item.installments ?? null,
    billingDayOfMonth: item.billingDayOfMonth ?? null,
    isActive: item.isActive,
    startDate: item.startDate,
    endDate: item.endDate,
  }))

  const newDrafts = calculateTicketsForContract({
    contract: {
      contractNumber: contract.contractNumber,
      paymentTermsDays: contract.paymentTermsDays,
      currency: contract.currency,
      startDate: contract.startDate,
      endDate: contract.endDate,
    },
    items: domainItems,
    periodDate,
    issueDate: new Date(),
    existingTickets: existingRefs,
  })

  const wouldBeAll = calculateTicketsForContract({
    contract: {
      contractNumber: contract.contractNumber,
      paymentTermsDays: contract.paymentTermsDays,
      currency: contract.currency,
      startDate: contract.startDate,
      endDate: contract.endDate,
    },
    items: domainItems,
    periodDate,
    issueDate: new Date(),
    existingTickets: [],
  })
  const skipped = wouldBeAll.filter((d) => existingNumbers.has(d.ticketNumber)).length

  return {
    drafts: newDrafts.map((d) => ({
      contractItemId: d.contractItemId,
      itemName: d.itemName,
      type: d.type,
      ticketNumber: d.ticketNumber,
      amount: d.amount,
      status: d.status,
      installmentNum: d.installmentNum,
      pricingTableId: d.pricingTableId,
      issueDate: d.issueDate.toISOString(),
      dueDate: d.dueDate.toISOString(),
    })),
    skipped,
  }
}
