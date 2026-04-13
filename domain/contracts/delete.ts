import { prisma } from "@/db/client"
import { createAuditLog } from "@/domain/audit"

export class ContractNotFoundError extends Error {
  constructor() {
    super("El contrato no existe o fue eliminado.")
    this.name = "ContractNotFoundError"
  }
}

export class ContractActiveError extends Error {
  constructor() {
    super("No se puede eliminar un contrato activo. Suspendelo o finalizalo primero.")
    this.name = "ContractActiveError"
  }
}

export async function softDeleteContract(id: string, userId?: string) {
  const existing = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) throw new ContractNotFoundError()

  if (existing.status === "ACTIVE") throw new ContractActiveError()

  const deleted = await prisma.contract.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  await createAuditLog(prisma, {
    userId,
    action: "contract.delete",
    entityType: "Contract",
    entityId: id,
    beforeData: existing,
  })

  return deleted
}
