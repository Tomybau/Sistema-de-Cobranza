import { z } from "zod"

export const clientSchema = z.object({
  fullName: z.string().min(1, "El nombre es requerido").max(200),
  role: z.string().max(100).optional().or(z.literal("")),
  email: z.string().email("Email inválido"),
  phone: z.string().max(50).optional().or(z.literal("")),
  // Llega como boolean desde RHF; la action normaliza FormData antes de parsear.
  isPrimary: z.boolean(),
})

export type ClientFormValues = z.infer<typeof clientSchema>

export function normalizeClientInput(data: ClientFormValues) {
  return {
    fullName: data.fullName,
    role: data.role || null,
    email: data.email,
    phone: data.phone || null,
    isPrimary: data.isPrimary,
  }
}
