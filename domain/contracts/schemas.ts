import { z } from "zod"
import { CURRENCIES } from "@/lib/currencies"

export const contractSchema = z
  .object({
    companyId: z.string().min(1, "La empresa es obligatoria"),
    contractNumber: z.string().min(1, "El número de contrato es obligatorio"),
    title: z.string().min(1, "El título es obligatorio"),
    description: z.string().optional(),
    currency: z.enum(CURRENCIES, { error: "Moneda inválida" }),
    startDate: z.string().min(1, "La fecha de inicio es obligatoria"),
    endDate: z.string().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "SUSPENDED", "ENDED", "CANCELLED"] as const),
    // Números: se pasan como number desde el form (usando valueAsNumber o Number())
    paymentTermsDays: z.number().int().min(0, "Mínimo 0 días").max(90, "Máximo 90 días"),
    lateFeePercent: z.number().min(0, "Mínimo 0%").max(100, "Máximo 100%"),
    notes: z.string().optional(),
  })
  .refine(
    (val) => {
      if (val.endDate && val.endDate !== "") {
        return new Date(val.endDate) > new Date(val.startDate)
      }
      return true
    },
    {
      message: "La fecha de fin debe ser posterior a la fecha de inicio",
      path: ["endDate"],
    }
  )

export type ContractFormValues = z.infer<typeof contractSchema>
