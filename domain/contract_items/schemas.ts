import { z } from "zod"

const moneyRegex = /^\d+(\.\d{1,2})?$/

const commonFields = {
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  isActive: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}

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
  pricingTableId: z.string().min(1, "Seleccioná una tabla de precios"),
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
  pricingTableId: z.string().optional(),
  totalAmount: z.string().optional(),
  installments: z.number().optional(),
})

export type ContractItemFlatValues = z.infer<typeof contractItemFlatSchema>
