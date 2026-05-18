import { prisma } from "@/db/client"
import { Prisma } from "@prisma/client"
import { addMonths } from "date-fns"
import { createAuditLog } from "@/domain/audit"
import { calculateTicketsForContract, calculateVariableAmount, computeTicketPeriod } from "./calculate"
import { getExistingTicketRefs } from "./queries"
import { generateTicketNumber } from "./ticket-number"
import type { BillingContractItem, BillingPricingTable, InstallmentPlanEntry, TicketDraft } from "./types"

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
  variableQuantities: Record<string, string>, // itemId → quantity o precio (según mode)
  variableModes: Record<string, "quantity" | "price">, // itemId → cómo interpretar el valor
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
      milestoneLabels: Array.isArray(item.milestoneLabels) ? (item.milestoneLabels as string[]) : null,
      installmentPlan: Array.isArray(item.installmentPlan) ? (item.installmentPlan as unknown as InstallmentPlanEntry[]) : null,
      breakdownNote: item.breakdownNote ?? null,
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
      const inputValue = variableQuantities[draft.contractItemId]
      const mode = variableModes[draft.contractItemId] ?? "quantity"

      if (inputValue !== undefined && inputValue !== "") {
        if (mode === "price") {
          // El usuario ingresó el precio final directamente
          const priceDecimal = new Prisma.Decimal(inputValue).toDecimalPlaces(2)
          readyDrafts.push({
            ...draft,
            amount: priceDecimal.toString(),
            status: "READY",
          })
        } else {
          // El usuario ingresó la cantidad — calcular precio desde la tabla
          const domainItem = domainItems.find((i) => i.id === draft.contractItemId)
          if (domainItem?.pricingTable) {
            const amount = calculateVariableAmount(domainItem.pricingTable, inputValue)
            readyDrafts.push({
              ...draft,
              amount,
              status: "READY",
            })
          } else {
            needsInputDrafts.push(draft)
          }
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
              draft.type === "RECURRING_VARIABLE" &&
              variableModes[draft.contractItemId] !== "price" &&
              variableQuantities[draft.contractItemId]
                ? new Prisma.Decimal(variableQuantities[draft.contractItemId])
                : null,
            description: draft.description ?? null,
            breakdownNote: draft.breakdownNote ?? null,
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

// ─── generateInstallmentsDirect ──────────────────────────────────────────────

export interface InstallmentSelection {
  contractItemId: string
  installmentNum: number
}

/**
 * Genera tickets de cuotas (INSTALLMENT) específicos seleccionados por el usuario.
 * No depende del período mensual — calcula la fecha a partir del installmentNum.
 * Idempotente: si el ticket ya existe, lo omite.
 */
export async function generateInstallmentsDirect(
  contractId: string,
  selections: InstallmentSelection[],
  userId?: string
): Promise<{ inserted: number; skipped: number }> {
  if (selections.length === 0) return { inserted: 0, skipped: 0 }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, deletedAt: null },
    include: {
      items: {
        where: {
          id: { in: selections.map((s) => s.contractItemId) },
          type: "INSTALLMENT",
          isActive: true,
        },
      },
    },
  })

  if (!contract) throw new Error("Contrato no encontrado o eliminado.")

  const existingRefs = await getExistingTicketRefs(contractId)
  const existingNumbers = new Set(existingRefs.map((r) => r.ticketNumber))

  const toInsert: Array<{
    ticketNumber: string
    contractItemId: string
    periodStart: Date
    periodEnd: Date
    issueDate: Date
    dueDate: Date
    amount: string
    description: string | null
    breakdownNote: string | null
    installmentNum: number
  }> = []

  const now = new Date()

  for (const sel of selections) {
    const item = contract.items.find((i) => i.id === sel.contractItemId)
    if (!item || !item.installments || !item.totalAmount || !item.billingDayOfMonth) continue

    const { installmentNum } = sel
    if (installmentNum < 1 || installmentNum > item.installments) continue

    const itemStart = item.startDate ?? contract.startDate
    const periodDate = addMonths(itemStart, installmentNum - 1)

    const ticketNumber = generateTicketNumber(
      contract.contractNumber,
      periodDate,
      "INSTALLMENT",
      item.id,
      installmentNum
    )

    if (existingNumbers.has(ticketNumber)) continue

    const period = computeTicketPeriod({
      billingDayOfMonth: item.billingDayOfMonth,
      paymentTermsDays: contract.paymentTermsDays,
      periodDate,
      issueDate: now,
    })

    const perInstallment = new Prisma.Decimal(item.totalAmount.toString())
      .div(item.installments)
      .toDecimalPlaces(2)

    const milestoneLabels = Array.isArray(item.milestoneLabels)
      ? (item.milestoneLabels as string[])
      : null

    toInsert.push({
      ticketNumber,
      contractItemId: item.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      issueDate: period.issueDate,
      dueDate: period.dueDate,
      amount: perInstallment.toString(),
      description: milestoneLabels?.[installmentNum - 1] ?? null,
      breakdownNote: item.breakdownNote ?? null,
      installmentNum,
    })
  }

  if (toInsert.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const draft of toInsert) {
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
            currency: contract.currency,
            description: draft.description,
            breakdownNote: draft.breakdownNote,
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
            type: "INSTALLMENT",
            installmentNum: draft.installmentNum,
            amount: draft.amount,
            dueDate: draft.dueDate,
          },
        })
      }
    })
  }

  const skipped = selections.length - toInsert.length
  return { inserted: toInsert.length, skipped }
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
    description: string | null
    breakdownNote: string | null
    pricingTiers: Array<{
      id: string
      fromQuantity: string
      toQuantity: string | null
      unitPrice: string
      flatFee: string | null
    }> | null
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
    milestoneLabels: Array.isArray(item.milestoneLabels) ? (item.milestoneLabels as string[]) : null,
    installmentPlan: Array.isArray(item.installmentPlan) ? (item.installmentPlan as unknown as InstallmentPlanEntry[]) : null,
    breakdownNote: item.breakdownNote ?? null,
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
      description: d.description,
      breakdownNote: d.breakdownNote,
      pricingTiers: d.type === "RECURRING_VARIABLE"
        ? (domainItems.find((i) => i.id === d.contractItemId)?.pricingTable?.tiers ?? null)
        : null,
    })),
    skipped,
  }
}
