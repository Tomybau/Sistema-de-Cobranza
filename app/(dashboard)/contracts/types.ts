// Tipos compartidos entre actions (server) y componentes (client).
// Sin directiva "use server" ni "use client" — importable desde ambos lados.

export type NewCompanyInput = {
  legalName: string
  taxId?: string
  taxIdType?: string
  email?: string
  phone?: string
  address?: string
}

export type NewClientInput = {
  fullName: string
  email: string
  phone?: string
  role?: string
  clientType?: "LEGAL_REP" | "BILLING_CONTACT" | "GENERAL"
}

export type DraftPricingTier = {
  from: string
  to?: string
  unitPrice: string
  flatFee?: string
}

export type InstallmentPlanEntry = {
  label: string      // descripción del hito
  percentage: number // % del totalAmount
}

export type DraftItemInput = {
  type: "RECURRING_FIXED" | "RECURRING_VARIABLE" | "ONE_TIME" | "INSTALLMENT"
  name: string
  description?: string
  fixedAmount?: string
  billingDayOfMonth?: number
  totalAmount?: string
  installments?: number
  milestoneLabels?: string[]          // etiqueta por cuota (legado — sin porcentaje)
  installmentPlan?: InstallmentPlanEntry[]  // plan con porcentaje por hito (preferir)
  breakdownNote?: string               // composición del monto total
  newPricingTableName?: string
  newPricingTableTiers?: DraftPricingTier[]
  quotaLimit?: string
  quotaUnit?: string
  durationMonths?: number
  needsReview?: boolean
  startDate?: string               // ISO YYYY-MM-DD — ítem se activa a partir de esta fecha
}

export type CreateContractFullInput = {
  contract: {
    companyId?: string
    contractNumber: string
    title: string
    description?: string
    currency: string
    startDate: string
    endDate?: string
    status: string
    paymentTermsDays: number
    lateFeePercent: number
    notes?: string
  }
  companyMode: "existing" | "new"
  newCompany?: NewCompanyInput
  newClient?: NewClientInput
  items: DraftItemInput[]
  ocrDocumentId?: string | null
}

export type ActionResult =
  | { success: true; message?: string; id?: string }
  | { success: false; error: string }
