import type { DraftItemInput, DraftPricingTier } from "@/app/(dashboard)/contracts/types"
import type {
  OcrContractItem,
  OcrContractResult,
  OcrPricingTier,
} from "@/domain/ocr/schemas"

function n(value: number | null | undefined): string | undefined {
  if (value == null || Number.isNaN(value)) return undefined
  return String(value)
}

function tiersToDraft(tiers: OcrPricingTier[]): DraftPricingTier[] {
  return tiers.map((t) => ({
    from: String(t.fromQuantity ?? 0),
    to: t.toQuantity != null ? String(t.toQuantity) : undefined,
    unitPrice: String(t.unitPrice ?? 0),
    flatFee: t.flatFee != null ? String(t.flatFee) : undefined,
  }))
}

function descriptionWithReasoning(item: OcrContractItem): string | undefined {
  const parts: string[] = []
  if (item.description) parts.push(item.description)
  if (item.reasoning) parts.push(`[OCR] ${item.reasoning}`)
  return parts.length ? parts.join(" — ") : undefined
}

function inferTypeFromShape(item: OcrContractItem): DraftItemInput["type"] {
  if (item.fixedAmount != null) return "RECURRING_FIXED"
  if (item.totalAmount != null && (item.installments ?? 0) > 1) return "INSTALLMENT"
  if (item.totalAmount != null) return "ONE_TIME"
  if (item.pricingTiers && item.pricingTiers.length > 0) return "RECURRING_VARIABLE"
  return "ONE_TIME"
}

function mapItem(item: OcrContractItem): DraftItemInput {
  const isUnknown = item.type === "UNKNOWN"
  const type: DraftItemInput["type"] =
    item.type === "UNKNOWN" ? inferTypeFromShape(item) : item.type

  const base: DraftItemInput = {
    type,
    name: item.name || "Ítem sin nombre",
    description: descriptionWithReasoning(item),
    needsReview: isUnknown,
    quotaLimit: n(item.quotaLimit),
    quotaUnit: item.quotaUnit ?? undefined,
    durationMonths: item.durationMonths ?? undefined,
  }

  if (type === "RECURRING_FIXED") {
    return {
      ...base,
      fixedAmount: n(item.fixedAmount),
      billingDayOfMonth: item.billingDayOfMonth ?? 1,
    }
  }
  if (type === "RECURRING_VARIABLE") {
    return {
      ...base,
      billingDayOfMonth: item.billingDayOfMonth ?? 1,
      newPricingTableName:
        item.pricingTableName?.trim() || `Tabla de precios — ${base.name}`,
      newPricingTableTiers:
        item.pricingTiers && item.pricingTiers.length > 0
          ? tiersToDraft(item.pricingTiers)
          : [{ from: "0", unitPrice: "0" }],
    }
  }
  if (type === "INSTALLMENT") {
    return {
      ...base,
      totalAmount: n(item.totalAmount),
      installments: item.installments ?? 2,
      billingDayOfMonth: item.billingDayOfMonth ?? 1,
    }
  }
  // ONE_TIME
  return {
    ...base,
    totalAmount: n(item.totalAmount),
  }
}

export function ocrResultToDraftItems(result: OcrContractResult): DraftItemInput[] {
  const items = result.items.map(mapItem)

  // overagePricingTable → RECURRING_VARIABLE adicional
  if (result.overagePricingTable && result.overagePricingTable.tiers.length > 0) {
    const overage = result.overagePricingTable
    items.push({
      type: "RECURRING_VARIABLE",
      name: overage.name?.trim() || "Excedentes sobre mensualidad",
      description: overage.unit ? `Cobro variable por ${overage.unit}` : undefined,
      billingDayOfMonth: 1,
      newPricingTableName:
        overage.name?.trim() ||
        (overage.unit ? `Tabla de excedentes — ${overage.unit}` : "Tabla de excedentes"),
      newPricingTableTiers: tiersToDraft(overage.tiers),
      quotaUnit: overage.unit ?? undefined,
      needsReview: false,
    })
  }

  return items
}
