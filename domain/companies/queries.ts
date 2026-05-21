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

export interface CompanyKpis {
  totalBilled: number
  totalCollected: number
  pending: number
  overdueAmount: number
  overdueCount: number
}

export async function getCompanyKpis(companyId: string): Promise<CompanyKpis> {
  const [billedAgg, collectedAgg, overdueAgg, overdueCount] = await Promise.all([
    prisma.billingTicket.aggregate({
      _sum: { amount: true },
      where: { contract: { companyId }, status: { not: "CANCELLED" } },
    }),
    prisma.paymentTicket.aggregate({
      _sum: { allocatedAmount: true },
      where: { payment: { companyId, status: "PROCESSED" } },
    }),
    prisma.billingTicket.aggregate({
      _sum: { amount: true },
      where: { contract: { companyId }, status: "OVERDUE" },
    }),
    prisma.billingTicket.count({
      where: { contract: { companyId }, status: "OVERDUE" },
    }),
  ])

  const totalBilled = billedAgg._sum.amount?.toNumber() ?? 0
  const totalCollected = collectedAgg._sum.allocatedAmount?.toNumber() ?? 0
  return {
    totalBilled,
    totalCollected,
    pending: Math.max(0, totalBilled - totalCollected),
    overdueAmount: overdueAgg._sum.amount?.toNumber() ?? 0,
    overdueCount,
  }
}

export async function listCompaniesWithKpis() {
  const companies = await prisma.company.findMany({
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
  const kpis = await Promise.all(
    companies.map((c) => getCompanyKpis(c.id).then((k) => ({ companyId: c.id, ...k })))
  )
  const kpisById = new Map(kpis.map((k) => [k.companyId, k]))
  return companies.map((c) => ({
    ...c,
    kpis: kpisById.get(c.id) ?? {
      totalBilled: 0,
      totalCollected: 0,
      pending: 0,
      overdueAmount: 0,
      overdueCount: 0,
    },
  }))
}

export type CompanyWithKpis = Awaited<ReturnType<typeof listCompaniesWithKpis>>[number]
