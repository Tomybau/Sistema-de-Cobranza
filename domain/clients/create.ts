import { prisma } from "@/db/client"
import type { Client } from "@prisma/client"
import { normalizeClientInput, type ClientFormValues } from "./schemas"

export class CompanyNotFoundError extends Error {
  constructor() {
    super("La empresa no existe o fue eliminada")
    this.name = "CompanyNotFoundError"
  }
}

/**
 * Crea un cliente dentro de una empresa.
 * Si isPrimary = true, desactiva isPrimary en todos los demás clientes de la empresa
 * en la misma transacción.
 */
export async function createClient(
  companyId: string,
  data: ClientFormValues
): Promise<Client> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
  })
  if (!company) throw new CompanyNotFoundError()

  const normalized = normalizeClientInput(data)

  return prisma.$transaction(async (tx) => {
    if (normalized.isPrimary) {
      await tx.client.updateMany({
        where: { companyId, deletedAt: null },
        data: { isPrimary: false },
      })
    }
    return tx.client.create({
      data: { ...normalized, companyId },
    })
  })
}
