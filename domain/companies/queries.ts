import { prisma } from "@/db/client"
import type { Company } from "@prisma/client"

export interface CompanyListItem extends Company {
  _count: {
    clients: number
    contracts: number
  }
}

/**
 * Lista todas las empresas no eliminadas, con conteo de clientes y contratos activos.
 */
export async function listCompanies(): Promise<CompanyListItem[]> {
  return prisma.company.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: {
          clients: { where: { deletedAt: null } },
          contracts: { where: { status: "ACTIVE", deletedAt: null } },
        },
      },
    },
    orderBy: { legalName: "asc" },
  })
}

/**
 * Retorna una empresa por ID. Retorna null si no existe o está eliminada.
 */
export async function getCompanyById(id: string) {
  return prisma.company.findFirst({
    where: { id, deletedAt: null },
    include: {
      _count: {
        select: {
          clients: { where: { deletedAt: null } },
          contracts: { where: { deletedAt: null } },
        },
      },
    },
  })
}

/**
 * Lista empresas eliminadas (soft delete).
 */
export async function listDeletedCompanies(): Promise<Company[]> {
  return prisma.company.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
  })
}
