// Tipos compartidos entre actions (server) y componentes (client).
// Sin directiva "use server" ni "use client" — importable desde ambos lados.

export type NewCompanyInput = {
  legalName: string
  taxId?: string
  email?: string
  phone?: string
  address?: string
}

export type NewClientInput = {
  fullName: string
  email: string
  phone?: string
  role?: string
}

export type DraftPricingTier = {
  from: string
  to?: string
  unitPrice: string
  flatFee?: string
}

export type DraftItemInput = {
  type: "RECURRING_FIXED" | "RECURRING_VARIABLE" | "ONE_TIME" | "INSTALLMENT"
  name: string
  description?: string
  fixedAmount?: string
  billingDayOfMonth?: number
  totalAmount?: string
  installments?: number
  newPricingTableName?: string
  newPricingTableTiers?: DraftPricingTier[]
  quotaLimit?: string
  quotaUnit?: string
  durationMonths?: number
  needsReview?: boolean
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
