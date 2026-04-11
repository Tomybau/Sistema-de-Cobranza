import { prisma } from "@/db/client"
import type { Company } from "@prisma/client"
import { normalizeCompanyInput, type CompanyFormValues } from "./schemas"

export class TaxIdAlreadyExistsError extends Error {
  constructor() {
    super("Ya existe una empresa con ese CUIT/taxId")
    this.name = "TaxIdAlreadyExistsError"
  }
}

/**
 * Crea una nueva empresa.
 * Verifica unicidad de taxId si se proporciona.
 * Lanza TaxIdAlreadyExistsError si ya existe.
 */
export async function createCompany(data: CompanyFormValues): Promise<Company> {
  const normalized = normalizeCompanyInput(data)

  if (normalized.taxId) {
    const existing = await prisma.company.findUnique({
      where: { taxId: normalized.taxId },
    })
    if (existing) throw new TaxIdAlreadyExistsError()
  }

  return prisma.company.create({ data: normalized })
}
