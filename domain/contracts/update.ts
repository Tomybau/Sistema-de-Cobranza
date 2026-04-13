import { prisma } from "@/db/client"
import { contractSchema, type ContractFormValues } from "./schemas"
import { checkStatusTransition } from "./transitions"
import { toDecimal } from "@/lib/money"
import { createAuditLog } from "@/domain/audit"
import type { ContractStatus } from "@prisma/client"

export class ContractNotFoundError extends Error {
  constructor() {
    super("El contrato no existe o fue eliminado.")
    this.name = "ContractNotFoundError"
  }
}

export class ContractNumberAlreadyExistsError extends Error {
  constructor() {
    super("Ya existe un contrato con ese número.")
    this.name = "ContractNumberAlreadyExistsError"
  }
}

export async function updateContract(
  id: string,
  data: ContractFormValues,
  userId?: string
) {
  const parsed = contractSchema.parse(data)

  const existing = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) throw new ContractNotFoundError()

  // currency y startDate bloqueados si está ACTIVE
  const finalCurrency =
    existing.status === "ACTIVE" ? existing.currency : parsed.currency
  const finalStartDate =
    existing.status === "ACTIVE" ? existing.startDate : new Date(parsed.startDate)

  // Verificar unicidad del contractNumber si cambió
  if (parsed.contractNumber !== existing.contractNumber) {
    const dup = await prisma.contract.findUnique({
      where: { contractNumber: parsed.contractNumber },
    })
    if (dup) throw new ContractNumberAlreadyExistsError()
  }

  const updated = await prisma.contract.update({
    where: { id },
    data: {
      contractNumber: parsed.contractNumber,
      title: parsed.title,
      description: parsed.description ?? null,
      currency: finalCurrency,
      startDate: finalStartDate,
      endDate: parsed.endDate && parsed.endDate !== "" ? new Date(parsed.endDate) : null,
      paymentTermsDays: parsed.paymentTermsDays,
      lateFeePercent: toDecimal(parsed.lateFeePercent),
      notes: parsed.notes ?? null,
    },
  })

  await createAuditLog(prisma, {
    userId,
    action: "contract.update",
    entityType: "Contract",
    entityId: id,
    beforeData: existing,
    afterData: updated,
  })

  return updated
}

export async function changeContractStatus(
  id: string,
  newStatus: ContractStatus,
  userId?: string
) {
  const existing = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) throw new ContractNotFoundError()

  const transition = checkStatusTransition(existing.status, newStatus)
  if (!transition.allowed) {
    throw new Error(transition.reason)
  }

  const updated = await prisma.contract.update({
    where: { id },
    data: { status: newStatus },
  })

  await createAuditLog(prisma, {
    userId,
    action: "contract.status_change",
    entityType: "Contract",
    entityId: id,
    beforeData: { status: existing.status },
    afterData: { status: newStatus },
  })

  return updated
}
