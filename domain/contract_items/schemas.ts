import { z } from "zod"

const moneyRegex = /^\d+(\.\d{1,2})?$/
const quantityRegex = /^\d+(\.\d{1,4})?$/

const commonFields = {
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  isActive: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}

export const pricingTierInputSchema = z
  .object({
    id: z.string().optional(),
    fromQuantity: z.string().regex(quantityRegex, "Cantidad inválida"),
    toQuantity: z
      .string()
      .regex(quantityRegex, "Cantidad inválida")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    unitPrice: z.string().regex(quantityRegex, "Precio inválido"),
    flatFee: z
      .string()
      .regex(quantityRegex, "Fee inválido")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((v) => {
    if (v.toQuantity !== undefined) {
      return Number(v.fromQuantity) < Number(v.toQuantity)
    }
    return true
  }, { message: "'Hasta' debe ser mayor a 'Desde'", path: ["toQuantity"] })

export type PricingTierInput = z.infer<typeof pricingTierInputSchema>

const tiersArraySchema = z
  .array(pricingTierInputSchema)
  .min(1, "Debe definir al menos un rango")
  .refine((tiers) => {
    let prevTo: number | undefined
    for (let i = 0; i < tiers.length; i++) {
      const from = Number(tiers[i].fromQuantity)
      const to = tiers[i].toQuantity !== undefined ? Number(tiers[i].toQuantity) : undefined
      if (i > 0) {
        if (prevTo === undefined) return false
        if (from < prevTo) return false
      }
      prevTo = to
    }
    return true
  }, "Los rangos deben estar en orden ascendente y sin superponerse")

export const recurringFixedItemSchema = z.object({
  ...commonFields,
  type: z.literal("RECURRING_FIXED"),
  fixedAmount: z
    .string()
    .regex(moneyRegex, "Ingresá un monto válido (ej: 1500.00)"),
  billingDayOfMonth: z.coerce
    .number()
    .int()
    .min(1, "Mínimo día 1")
    .max(28, "Máximo día 28"),
})

export const recurringVariableItemSchema = z.object({
  ...commonFields,
  type: z.literal("RECURRING_VARIABLE"),
  pricingTableName: z.string().optional(),
  pricingTiers: tiersArraySchema,
  billingDayOfMonth: z.coerce
    .number()
    .int()
    .min(1, "Mínimo día 1")
    .max(28, "Máximo día 28"),
})

export const oneTimeItemSchema = z.object({
  ...commonFields,
  type: z.literal("ONE_TIME"),
  totalAmount: z
    .string()
    .regex(moneyRegex, "Ingresá un monto válido (ej: 5000.00)"),
})

export const installmentPlanEntrySchema = z.object({
  label: z.string().min(1, "El hito no puede estar vacío"),
  percentage: z.number().min(0.01).max(100),
})

export const installmentItemSchema = z.object({
  ...commonFields,
  type: z.literal("INSTALLMENT"),
  totalAmount: z
    .string()
    .regex(moneyRegex, "Ingresá un monto válido (ej: 9000.00)"),
  installments: z.coerce
    .number()
    .int()
    .min(2, "Mínimo 2 cuotas")
    .max(60, "Máximo 60 cuotas"),
  billingDayOfMonth: z.coerce
    .number()
    .int()
    .min(1, "Mínimo día 1")
    .max(28, "Máximo día 28"),
  installmentPlan: z.array(installmentPlanEntrySchema).nullable().optional(),
})

export const contractItemSchema = z.discriminatedUnion("type", [
  recurringFixedItemSchema,
  recurringVariableItemSchema,
  oneTimeItemSchema,
  installmentItemSchema,
])

export type ContractItemFormValues = z.infer<typeof contractItemSchema>

// Flat schema for the client-side form (pre-validation, all fields optional)
export const contractItemFlatSchema = z.object({
  type: z.enum(["RECURRING_FIXED", "RECURRING_VARIABLE", "ONE_TIME", "INSTALLMENT"] as const),
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  isActive: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  fixedAmount: z.string().optional(),
  billingDayOfMonth: z.number().optional(),
  pricingTableName: z.string().optional(),
  pricingTiers: z.array(pricingTierInputSchema).optional(),
  totalAmount: z.string().optional(),
  installments: z.number().optional(),
  installmentPlan: z.array(installmentPlanEntrySchema).nullable().optional(),
})

export type ContractItemFlatValues = z.infer<typeof contractItemFlatSchema>
