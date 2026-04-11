import { prisma } from "@/db/client"
import type { Client } from "@prisma/client"

export class ClientNotFoundError extends Error {
  constructor() {
    super("El contacto no existe o fue eliminado")
    this.name = "ClientNotFoundError"
  }
}

/**
 * Soft delete de cliente.
 * Si el cliente eliminado era el principal, la empresa queda sin contacto principal.
 * Eso es válido — el caller debe auditar con un warning si el cliente era primary.
 */
export async function softDeleteClient(id: string): Promise<Client> {
  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  })
  if (!client) throw new ClientNotFoundError()

  return prisma.client.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}

/**
 * Establece un cliente como contacto principal de su empresa.
 * Desactiva isPrimary en todos los demás en una sola transacción.
 */
export async function setPrimaryClient(id: string): Promise<Client> {
  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  })
  if (!client) throw new ClientNotFoundError()

  return prisma.$transaction(async (tx) => {
    await tx.client.updateMany({
      where: { companyId: client.companyId, deletedAt: null },
      data: { isPrimary: false },
    })
    return tx.client.update({
      where: { id },
      data: { isPrimary: true },
    })
  })
}
