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

export interface BillingContractItem {
  id: string
  type: "RECURRING_FIXED" | "RECURRING_VARIABLE" | "ONE_TIME" | "INSTALLMENT"
  name: string
  fixedAmount: string | null
  pricingTableId: string | null
  pricingTable: BillingPricingTable | null
  totalAmount: string | null
  installments: number | null
  billingDayOfMonth: number | null
  isActive: boolean
  startDate: Date | null
  endDate: Date | null
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
  periodStart: Date | null // null for ONE_TIME
  periodEnd: Date | null
  issueDate: Date
  dueDate: Date
  amount: string | null // null = NEEDS_QUANTITY; Decimal string when ready
  currency: string
  pricingTableId: string | null
  installmentNum: number | null
  status: TicketDraftStatus
}
