import { prisma } from "@/db/client"
import type { Client } from "@prisma/client"

/**
 * Lista clientes no eliminados de una empresa, ordenados por isPrimary desc.
 */
export async function listClientsByCompany(companyId: string): Promise<Client[]> {
  return prisma.client.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { fullName: "asc" }],
  })
}

/**
 * Retorna un cliente por ID. Null si no existe o está eliminado.
 */
export async function getClientById(id: string): Promise<Client | null> {
  return prisma.client.findFirst({
    where: { id, deletedAt: null },
  })
}
