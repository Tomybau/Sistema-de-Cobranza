import { z } from "zod"

export const ocrPricingTierSchema = z.object({
  fromQuantity: z.number(),
  toQuantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  flatFee: z.number().nullable(),
  label: z.string().nullable(),
})

export const ocrContractItemSchema = z.object({
  type: z.enum([
    "RECURRING_FIXED",
    "RECURRING_VARIABLE",
    "ONE_TIME",
    "INSTALLMENT",
    "UNKNOWN",
  ]),
  name: z.string(),
  description: z.string().nullable(),
  fixedAmount: z.number().nullable(),
  totalAmount: z.number().nullable(),
  installments: z.number().nullable(),
  durationMonths: z.number().nullable(),
  billingDayOfMonth: z.number().nullable(),
  quotaLimit: z.number().nullable(),
  quotaUnit: z.string().nullable(),
  pricingTableName: z.string().nullable(),
  pricingTiers: z.array(ocrPricingTierSchema).nullable(),
  // Plan de cuotas con porcentaje por hito (INSTALLMENT)
  installmentPlan: z.array(
    z.object({
      label: z.string(),       // descripción del hito ("Firma del contrato", etc.)
      percentage: z.number(),  // % del totalAmount que se cobra en esta cuota
    })
  ).nullable(),
  breakdownNote: z.string().nullable(), // composición del monto total (si es bundle)
  // Mensualidad implícita que se activa cuando termina la parte prepagada de un INSTALLMENT
  impliedRecurring: z.object({
    fixedAmount: z.number(),
    billingDayOfMonth: z.number().nullable(),
    activatesAfterMonths: z.number(),   // N meses desde startDate del contrato
    quotaLimit: z.number().nullable(),
    quotaUnit: z.string().nullable(),
  }).nullable(),
  reasoning: z.string().nullable(),
})

export const ocrCoContractorSchema = z.object({
  companyName: z.string(),
  taxId: z.string().nullable(),
  taxIdType: z.string().nullable(),
  sharePercent: z.number().nullable(), // porcentaje de facturación (ej: 46 para 46%)
})

export const ocrContractResultSchema = z.object({
  client: z.object({
    name: z.string(),                    // razón social de la empresa cliente
    email: z.string().nullable(),
    phone: z.string().nullable(),
    taxId: z.string().nullable(),
    taxIdType: z.string().nullable(),    // "RTN", "Ficha Electrónica", "RUC", etc.
    address: z.string().nullable(),
    signatoryName: z.string().nullable(), // nombre del firmante (rep. legal)
    signatoryId: z.string().nullable(),   // cédula/DNI del firmante
    billingContact: z.object({
      name: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
    }).nullable(),                        // contacto de cobros si es diferente al firmante
  }),
  contract: z.object({
    name: z.string(),
    contractNumber: z.string().nullable(), // número de contrato si está explícito
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    signatureDate: z.string().nullable(),  // fecha de firma
    billingCycle: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).nullable(),
    currency: z.string().nullable(),
    lateFeePct: z.number().nullable(),
    paymentTermsDays: z.number().nullable(),
    jurisdiction: z.string().nullable(),
    notes: z.string().nullable(),
  }),
  items: z.array(ocrContractItemSchema),
  overagePricingTable: z
    .object({
      name: z.string().nullable(),
      unit: z.string().nullable(),
      tiers: z.array(ocrPricingTierSchema),
    })
    .nullable(),
  coContractors: z.array(ocrCoContractorSchema).nullable(), // para contratos multi-empresa
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
})

export type OcrPricingTier = z.infer<typeof ocrPricingTierSchema>
export type OcrContractResult = z.infer<typeof ocrContractResultSchema>
export type OcrContractItem = z.infer<typeof ocrContractItemSchema>
export type OcrCoContractor = z.infer<typeof ocrCoContractorSchema>
export type OcrInstallmentPlanEntry = { label: string; percentage: number }
