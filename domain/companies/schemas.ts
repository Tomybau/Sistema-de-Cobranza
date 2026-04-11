import { z } from "zod"

export const companySchema = z.object({
  legalName: z.string().min(1, "La razón social es requerida").max(200),
  tradeName: z.string().max(200).optional().or(z.literal("")),
  taxId: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
})

export type CompanyFormValues = z.infer<typeof companySchema>

// Normaliza strings vacíos a undefined/null para la BD
export function normalizeCompanyInput(data: CompanyFormValues) {
  return {
    legalName: data.legalName,
    tradeName: data.tradeName || null,
    taxId: data.taxId || null,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
    city: data.city || null,
    country: data.country || null,
    notes: data.notes || null,
  }
}
