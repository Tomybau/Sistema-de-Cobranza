import { prisma } from "@/db/client"
import type { Client } from "@prisma/client"
import { normalizeClientInput, type ClientFormValues } from "./schemas"

export class ClientNotFoundError extends Error {
  constructor() {
    super("El contacto no existe o fue eliminado")
    this.name = "ClientNotFoundError"
  }
}

/**
 * Actualiza un cliente.
 * Si isPrimary = true, desactiva isPrimary en todos los demás clientes de la empresa.
 * Retorna { before, after } para el audit log.
 */
export async function updateClient(
  id: string,
  data: ClientFormValues
): Promise<{ before: Client; after: Client }> {
  const before = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  })
  if (!before) throw new ClientNotFoundError()

  const normalized = normalizeClientInput(data)

  const after = await prisma.$transaction(async (tx) => {
    if (normalized.isPrimary) {
      await tx.client.updateMany({
        where: { companyId: before.companyId, id: { not: id }, deletedAt: null },
        data: { isPrimary: false },
      })
    }
    return tx.client.update({ where: { id }, data: normalized })
  })

  return { before, after }
}
