// Pure types for billing domain — no Prisma imports, no side effects.
// Decimal values are serialized as strings to keep this module framework-agnostic.

export interface BillingPricingTier {
  id: string
  fromQuantity: string // Decimal serialized
  toQuantity: string | null
  unitPrice: string
  flatFee: string | null
}

export interface BillingPricingTable {
  id: string
  tiers: BillingPricingTier[]
}

// Un hito dentro de un plan de cuotas con porcentaje explícito
export interface InstallmentPlanEntry {
  label: string       // descripción del hito ("Firma del contrato", etc.)
  percentage: number  // porcentaje del totalAmount (ej: 30 → 30%)
}

export interface BillingContractItem {
  id: string
  type: "RECURRING_FIXED" | "RECURRING_VARIABLE" | "ONE_TIME" | "INSTALLMENT"
  name: string
  fixedAmount: string | null
  pricingTableId: string | null
  pricingTable: BillingPricingTable | null
  totalAmount: string | null
  installments: number | null
  milestoneLabels: string[] | null        // etiqueta por cuota (legado — sin porcentaje)
  installmentPlan: InstallmentPlanEntry[] | null  // plan con porcentaje por hito (preferir sobre milestoneLabels)
  breakdownNote: string | null             // composición del monto total
  billingDayOfMonth: number | null
  isActive: boolean
  startDate: Date | null
  endDate: Date | null
  durationMonths: number | null   // si está seteado y !autoRenew, corta tickets a partir de start + N meses
  autoRenew: boolean              // true = ignora cutoff por durationMonths
}

export interface BillingContract {
  contractNumber: string
  paymentTermsDays: number
  currency: string
  startDate: Date
  endDate: Date | null
}

export interface ExistingTicketRef {
  ticketNumber: string
  contractItemId: string
  installmentNum: number | null // null for non-INSTALLMENT tickets
}

export type TicketDraftStatus = "READY" | "NEEDS_QUANTITY"

export interface TicketDraft {
  contractItemId: string
  itemName: string
  type: BillingContractItem["type"]
  ticketNumber: string
  periodStart: Date | null
  periodEnd: Date | null
  issueDate: Date
  dueDate: Date
  amount: string | null
  currency: string
  pricingTableId: string | null
  installmentNum: number | null
  description: string | null    // etiqueta del hito (ej: "Firma del contrato")
  breakdownNote: string | null  // desglose del monto
  status: TicketDraftStatus
}
