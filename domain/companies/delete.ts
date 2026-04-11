import { prisma } from "@/db/client"
import type { Company } from "@prisma/client"

export class CompanyNotFoundError extends Error {
  constructor() {
    super("Empresa no encontrada")
    this.name = "CompanyNotFoundError"
  }
}

export class CompanyHasActiveContractsError extends Error {
  constructor() {
    super(
      "No se puede eliminar la empresa porque tiene contratos activos (DRAFT, ACTIVE o SUSPENDED). " +
      "Cerrá o cancelá los contratos antes de eliminar la empresa."
    )
    this.name = "CompanyHasActiveContractsError"
  }
}

/**
 * Soft delete de empresa.
 * Rechaza si la empresa tiene contratos en estado DRAFT, ACTIVE o SUSPENDED.
 * Los estados ENDED y CANCELLED no bloquean la operación.
 */
export async function softDeleteCompany(id: string): Promise<Company> {
  const company = await prisma.company.findFirst({
    where: { id, deletedAt: null },
  })
  if (!company) throw new CompanyNotFoundError()

  const activeContracts = await prisma.contract.count({
    where: {
      companyId: id,
      status: { in: ["DRAFT", "ACTIVE", "SUSPENDED"] },
      deletedAt: null,
    },
  })
  if (activeContracts > 0) throw new CompanyHasActiveContractsError()

  return prisma.company.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}

/**
 * Restaura una empresa eliminada (soft delete → null).
 */
export async function restoreCompany(id: string): Promise<Company> {
  const company = await prisma.company.findFirst({
    where: { id, deletedAt: { not: null } },
  })
  if (!company) throw new CompanyNotFoundError()

  return prisma.company.update({
    where: { id },
    data: { deletedAt: null },
  })
}
