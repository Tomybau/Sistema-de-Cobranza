import { prisma } from "@/db/client"
import { createAuditLog } from "@/domain/audit"

export class ContractItemNotFoundError extends Error {
  constructor() {
    super("El item no existe.")
    this.name = "ContractItemNotFoundError"
  }
}

export class ContractItemHasTicketsError extends Error {
  constructor() {
    super(
      "No se puede eliminar el item porque tiene tickets de cobro asociados."
    )
    this.name = "ContractItemHasTicketsError"
  }
}

/**
 * Hard delete para ContractItem.
 * Bloqueado si hay BillingTickets referenciando el item (Fase 4 en adelante).
 * En Sesión 3 no hay tickets, por lo que siempre procede.
 */
export async function deleteContractItem(id: string, userId?: string) {
  const existing = await prisma.contractItem.findUnique({ where: { id } })
  if (!existing) throw new ContractItemNotFoundError()

  const ticketCount = await prisma.billingTicket.count({
    where: { contractItemId: id },
  })
  if (ticketCount > 0) throw new ContractItemHasTicketsError()

  await prisma.contractItem.delete({ where: { id } })

  await createAuditLog(prisma, {
    userId,
    action: "contract_item.delete",
    entityType: "ContractItem",
    entityId: id,
    beforeData: existing,
  })
}
