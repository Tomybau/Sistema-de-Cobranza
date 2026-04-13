import { Prisma } from "@prisma/client"
import {
  startOfMonth,
  endOfMonth,
  addDays,
  differenceInCalendarMonths,
  setDate,
  getDaysInMonth,
  isBefore,
} from "date-fns"
import { TZDate } from "@date-fns/tz"
import type {
  BillingContract,
  BillingContractItem,
  BillingPricingTable,
  ExistingTicketRef,
  TicketDraft,
} from "./types"
import { generateTicketNumber } from "./ticket-number"

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Argentina/Buenos_Aires"

function inTZ(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE)
}

// TZDate carries timezone context — converting to plain Date preserves the UTC instant
function toUTC(tzDate: TZDate | Date): Date {
  return new Date(tzDate.getTime())
}

// ---------------------------------------------------------------------------
// computeTicketPeriod
// ---------------------------------------------------------------------------

export function computeTicketPeriod(params: {
  billingDayOfMonth: number
  paymentTermsDays: number
  periodDate: Date
  issueDate: Date
}): { periodStart: Date; periodEnd: Date; issueDate: Date; dueDate: Date } {
  const { billingDayOfMonth, paymentTermsDays, periodDate } = params

  const zonedPeriod = inTZ(periodDate)

  const periodStartTZ = startOfMonth(zonedPeriod)
  const periodEndTZ = endOfMonth(zonedPeriod)

  // Cap billingDayOfMonth to the last day of the month (handles Feb 28/29, months with 30 days)
  const daysInMonth = getDaysInMonth(zonedPeriod)
  const clampedDay = Math.min(billingDayOfMonth, daysInMonth)
  const issueDateTZ = setDate(zonedPeriod, clampedDay)
  const dueDateTZ = addDays(issueDateTZ, paymentTermsDays)

  return {
    periodStart: toUTC(periodStartTZ),
    periodEnd: toUTC(periodEndTZ),
    issueDate: toUTC(issueDateTZ),
    dueDate: toUTC(dueDateTZ),
  }
}

// ---------------------------------------------------------------------------
// calculateVariableAmount
//
// Flat-tier pricing: the matching tier determines the price for the full quantity.
// Progressive (cumulative) pricing is NOT implemented.
// ---------------------------------------------------------------------------

export function calculateVariableAmount(
  pricingTable: BillingPricingTable,
  quantity: string // Decimal serialized
): string {
  const qty = new Prisma.Decimal(quantity)

  if (qty.isZero()) return new Prisma.Decimal(0).toDecimalPlaces(2).toString()

  const sortedTiers = [...pricingTable.tiers].sort((a, b) =>
    new Prisma.Decimal(a.fromQuantity).comparedTo(new Prisma.Decimal(b.fromQuantity))
  )

  if (sortedTiers.length === 0) {
    console.warn(`[billing] PricingTable ${pricingTable.id} has no tiers. Returning 0.`)
    return new Prisma.Decimal(0).toDecimalPlaces(2).toString()
  }

  const firstTier = sortedTiers[0]
  if (qty.lessThan(new Prisma.Decimal(firstTier.fromQuantity))) {
    console.warn(
      `[billing] Quantity ${quantity} is below the lowest tier (${firstTier.fromQuantity}) ` +
        `in PricingTable ${pricingTable.id}. Returning 0.`
    )
    return new Prisma.Decimal(0).toDecimalPlaces(2).toString()
  }

  // Find the matching flat tier
  let matchingTierIndex = -1
  for (let i = sortedTiers.length - 1; i >= 0; i--) {
    const tier = sortedTiers[i]
    const from = new Prisma.Decimal(tier.fromQuantity)
    if (qty.greaterThanOrEqualTo(from)) {
      if (tier.toQuantity === null || qty.lessThanOrEqualTo(new Prisma.Decimal(tier.toQuantity))) {
        matchingTierIndex = i
        break
      }
    }
  }

  const matchingTier =
    matchingTierIndex >= 0
      ? sortedTiers[matchingTierIndex]
      : sortedTiers[sortedTiers.length - 1] // fallback: last tier (open-ended)

  if (matchingTierIndex < 0) {
    console.warn(
      `[billing] Quantity ${quantity} exceeds all bounded tiers in PricingTable ` +
        `${pricingTable.id}. Using last tier as open-ended.`
    )
  }

  const unitPrice = new Prisma.Decimal(matchingTier.unitPrice)
  const flatFee = matchingTier.flatFee
    ? new Prisma.Decimal(matchingTier.flatFee)
    : new Prisma.Decimal(0)

  return unitPrice.mul(qty).add(flatFee).toDecimalPlaces(2).toString()
}

// ---------------------------------------------------------------------------
// calculateTicketsForContract
// ---------------------------------------------------------------------------

export function calculateTicketsForContract(params: {
  contract: BillingContract
  items: BillingContractItem[]
  periodDate: Date
  issueDate: Date
  existingTickets: ExistingTicketRef[]
}): TicketDraft[] {
  const { contract, items, periodDate, issueDate, existingTickets } = params
  const drafts: TicketDraft[] = []

  const existingNumbers = new Set(existingTickets.map((t) => t.ticketNumber))

  const zonedPeriod = inTZ(periodDate)
  const zonedContractStart = inTZ(contract.startDate)

  for (const item of items) {
    if (!item.isActive) continue

    // Guard: period is before contract start (compare start-of-month in TZ)
    if (isBefore(startOfMonth(zonedPeriod), startOfMonth(zonedContractStart))) continue

    // Guard: period is before item start
    if (item.startDate) {
      const zonedItemStart = inTZ(item.startDate)
      if (isBefore(startOfMonth(zonedPeriod), startOfMonth(zonedItemStart))) continue
    }

    // Guard: period is after item end
    if (item.endDate) {
      const zonedItemEnd = inTZ(item.endDate)
      if (isBefore(endOfMonth(zonedItemEnd), startOfMonth(zonedPeriod))) continue
    }

    switch (item.type) {
      case "RECURRING_FIXED": {
        if (!item.billingDayOfMonth || !item.fixedAmount) continue
        const ticketNumber = generateTicketNumber(
          contract.contractNumber,
          periodDate,
          "RECURRING_FIXED",
          item.id
        )
        if (existingNumbers.has(ticketNumber)) break

        const period = computeTicketPeriod({
          billingDayOfMonth: item.billingDayOfMonth,
          paymentTermsDays: contract.paymentTermsDays,
          periodDate,
          issueDate,
        })

        drafts.push({
          contractItemId: item.id,
          itemName: item.name,
          type: "RECURRING_FIXED",
          ticketNumber,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          issueDate: period.issueDate,
          dueDate: period.dueDate,
          amount: new Prisma.Decimal(item.fixedAmount).toDecimalPlaces(2).toString(),
          currency: contract.currency,
          pricingTableId: null,
          installmentNum: null,
          status: "READY",
        })
        break
      }

      case "RECURRING_VARIABLE": {
        if (!item.billingDayOfMonth || !item.pricingTableId) continue
        const ticketNumber = generateTicketNumber(
          contract.contractNumber,
          periodDate,
          "RECURRING_VARIABLE",
          item.id
        )
        if (existingNumbers.has(ticketNumber)) break

        const period = computeTicketPeriod({
          billingDayOfMonth: item.billingDayOfMonth,
          paymentTermsDays: contract.paymentTermsDays,
          periodDate,
          issueDate,
        })

        drafts.push({
          contractItemId: item.id,
          itemName: item.name,
          type: "RECURRING_VARIABLE",
          ticketNumber,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          issueDate: period.issueDate,
          dueDate: period.dueDate,
          amount: null, // requires user input
          currency: contract.currency,
          pricingTableId: item.pricingTableId,
          installmentNum: null,
          status: "NEEDS_QUANTITY",
        })
        break
      }

      case "ONE_TIME": {
        if (!item.totalAmount) continue
        const ticketNumber = generateTicketNumber(
          contract.contractNumber,
          periodDate,
          "ONE_TIME",
          item.id
        )
        // ONE_TIME: skip if any ticket already exists for this item (regardless of period)
        const alreadyGenerated = existingTickets.some((t) => t.contractItemId === item.id)
        if (alreadyGenerated) break

        const zonedIssue = inTZ(issueDate)
        const dueDate = toUTC(addDays(zonedIssue, contract.paymentTermsDays))

        drafts.push({
          contractItemId: item.id,
          itemName: item.name,
          type: "ONE_TIME",
          ticketNumber,
          periodStart: null,
          periodEnd: null,
          issueDate,
          dueDate,
          amount: new Prisma.Decimal(item.totalAmount).toDecimalPlaces(2).toString(),
          currency: contract.currency,
          pricingTableId: null,
          installmentNum: null,
          status: "READY",
        })
        break
      }

      case "INSTALLMENT": {
        if (!item.totalAmount || !item.installments || !item.billingDayOfMonth) continue

        const itemStartDate = item.startDate ?? contract.startDate
        const zonedItemStart = inTZ(itemStartDate)

        // installmentNum is 1-based; calculated in TZ to avoid server-TZ artifacts
        const installmentNum =
          differenceInCalendarMonths(zonedPeriod, zonedItemStart) + 1

        if (installmentNum < 1 || installmentNum > item.installments) break

        const ticketNumber = generateTicketNumber(
          contract.contractNumber,
          periodDate,
          "INSTALLMENT",
          item.id,
          installmentNum
        )
        if (existingNumbers.has(ticketNumber)) break

        const period = computeTicketPeriod({
          billingDayOfMonth: item.billingDayOfMonth,
          paymentTermsDays: contract.paymentTermsDays,
          periodDate,
          issueDate,
        })

        // Decimal division — never JS /
        const perInstallment = new Prisma.Decimal(item.totalAmount)
          .div(item.installments)
          .toDecimalPlaces(2)

        drafts.push({
          contractItemId: item.id,
          itemName: item.name,
          type: "INSTALLMENT",
          ticketNumber,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          issueDate: period.issueDate,
          dueDate: period.dueDate,
          amount: perInstallment.toString(),
          currency: contract.currency,
          pricingTableId: null,
          installmentNum,
          status: "READY",
        })
        break
      }
    }
  }

  return drafts
}
