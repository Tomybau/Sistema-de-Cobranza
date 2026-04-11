import { prisma } from "@/db/client"
import type { Company } from "@prisma/client"
import { normalizeCompanyInput, type CompanyFormValues } from "./schemas"

export class CompanyNotFoundError extends Error {
  constructor() {
    super("Empresa no encontrada")
    this.name = "CompanyNotFoundError"
  }
}

export class TaxIdAlreadyExistsError extends Error {
  constructor() {
    super("Ya existe una empresa con ese CUIT/taxId")
    this.name = "TaxIdAlreadyExistsError"
  }
}

/**
 * Actualiza todos los campos de una empresa.
 * Estrategia: actualiza todo (no solo los campos cambiados) — el before/after en el AuditLog
 * captura qué cambió. Más simple y menos propenso a bugs de estado parcial.
 *
 * Retorna { before, after } para facilitar el audit log en el caller.
 */
export async function updateCompany(
  id: string,
  data: CompanyFormValues
): Promise<{ before: Company; after: Company }> {
  const before = await prisma.company.findFirst({
    where: { id, deletedAt: null },
  })
  if (!before) throw new CompanyNotFoundError()

  const normalized = normalizeCompanyInput(data)

  // Verifica unicidad de taxId si cambió
  if (normalized.taxId && normalized.taxId !== before.taxId) {
    const existing = await prisma.company.findUnique({
      where: { taxId: normalized.taxId },
    })
    if (existing) throw new TaxIdAlreadyExistsError()
  }

  const after = await prisma.company.update({
    where: { id },
    data: normalized,
  })

  return { before, after }
}
