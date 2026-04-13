import { prisma } from "@/db/client"
import { contractItemSchema, type ContractItemFormValues } from "./schemas"
import { toDecimal } from "@/lib/money"
import { createAuditLog } from "@/domain/audit"

export class ContractNotFoundError extends Error {
  constructor() {
    super("El contrato no existe o fue eliminado.")
    this.name = "ContractNotFoundError"
  }
}

export class PricingTableNotFoundError extends Error {
  constructor() {
    super("La tabla de precios seleccionada no existe.")
    this.name = "PricingTableNotFoundError"
  }
}

export async function addContractItem(
  contractId: string,
  data: ContractItemFormValues,
  userId?: string
) {
  const parsed = contractItemSchema.parse(data)

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, deletedAt: null },
  })
  if (!contract) throw new ContractNotFoundError()

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

  const item = await prisma.contractItem.create({
    data: {
      contractId,
      type: parsed.type,
      name: parsed.name,
      description: parsed.description ?? null,
      isActive: parsed.isActive,
      startDate,
      endDate,
      // RECURRING_FIXED
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
      // RECURRING_VARIABLE
      pricingTableId:
        parsed.type === "RECURRING_VARIABLE" ? parsed.pricingTableId : null,
      // ONE_TIME / INSTALLMENT
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
    action: "contract_item.create",
    entityType: "ContractItem",
    entityId: item.id,
    afterData: { ...item, contractId },
  })

  return item
}
