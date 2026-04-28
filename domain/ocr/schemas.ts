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
  reasoning: z.string().nullable(),
})

export const ocrContractResultSchema = z.object({
  client: z.object({
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    taxId: z.string().nullable(),
    address: z.string().nullable(),
  }),
  contract: z.object({
    name: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
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
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
})

export type OcrPricingTier = z.infer<typeof ocrPricingTierSchema>
export type OcrContractResult = z.infer<typeof ocrContractResultSchema>
export type OcrContractItem = z.infer<typeof ocrContractItemSchema>
