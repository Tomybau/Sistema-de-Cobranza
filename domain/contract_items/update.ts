import { prisma } from "@/db/client"
import { contractItemSchema, type ContractItemFormValues } from "./schemas"
import { toDecimal } from "@/lib/money"
import { createAuditLog } from "@/domain/audit"

export class ContractItemNotFoundError extends Error {
  constructor() {
    super("El item no existe.")
    this.name = "ContractItemNotFoundError"
  }
}

export class PricingTableNotFoundError extends Error {
  constructor() {
    super("La tabla de precios seleccionada no existe.")
    this.name = "PricingTableNotFoundError"
  }
}

export async function updateContractItem(
  id: string,
  data: ContractItemFormValues,
  userId?: string
) {
  const parsed = contractItemSchema.parse(data)

  const existing = await prisma.contractItem.findUnique({ where: { id } })
  if (!existing) throw new ContractItemNotFoundError()

  if (parsed.type !== existing.type) {
    throw new Error("No se puede cambiar el tipo de un item existente.")
  }

  if (parsed.type === "RECURRING_VARIABLE") {
    const pt = await prisma.pricingTable.findUnique({
      where: { id: parsed.pricingTableId },
    })
    if (!pt) throw new PricingTableNotFoundError()
  }

  const startDate =
    parsed.startDate && parsed.startDate !== ""
      ? new Date(parsed.startDate)
      : null
  const endDate =
    parsed.endDate && parsed.endDate !== "" ? new Date(parsed.endDate) : null

  const updated = await prisma.contractItem.update({
    where: { id },
    data: {
      name: parsed.name,
      description: parsed.description ?? null,
      isActive: parsed.isActive,
      startDate,
      endDate,
      fixedAmount:
        parsed.type === "RECURRING_FIXED"
          ? toDecimal(parsed.fixedAmount)
          : null,
      billingDayOfMonth:
        parsed.type === "RECURRING_FIXED" ||
        parsed.type === "RECURRING_VARIABLE" ||
        parsed.type === "INSTALLMENT"
          ? parsed.billingDayOfMonth
          : null,
      pricingTableId:
        parsed.type === "RECURRING_VARIABLE" ? parsed.pricingTableId : null,
      totalAmount:
        parsed.type === "ONE_TIME" || parsed.type === "INSTALLMENT"
          ? toDecimal(parsed.totalAmount)
          : null,
      installments:
        parsed.type === "INSTALLMENT" ? parsed.installments : null,
    },
  })

  await createAuditLog(prisma, {
    userId,
    action: "contract_item.update",
    entityType: "ContractItem",
    entityId: id,
    beforeData: existing,
    afterData: updated,
  })

  return updated
}

export async function toggleContractItemActive(id: string, userId?: string) {
  const existing = await prisma.contractItem.findUnique({ where: { id } })
  if (!existing) throw new ContractItemNotFoundError()

  const updated = await prisma.contractItem.update({
    where: { id },
    data: { isActive: !existing.isActive },
  })

  await createAuditLog(prisma, {
    userId,
    action: "contract_item.toggle_active",
    entityType: "ContractItem",
    entityId: id,
    beforeData: { isActive: existing.isActive },
    afterData: { isActive: updated.isActive },
  })

  return updated
}
