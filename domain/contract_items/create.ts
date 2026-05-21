import { prisma } from "@/db/client"
import { Prisma } from "@prisma/client"
import { contractItemSchema, type ContractItemFormValues, type PricingTierInput } from "./schemas"
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
    super("La tabla de precios no es válida.")
    this.name = "PricingTableNotFoundError"
  }
}

function tiersCreateData(tiers: PricingTierInput[]) {
  return tiers.map((t) => ({
    fromQuantity: toDecimal(t.fromQuantity),
    toQuantity: t.toQuantity ? toDecimal(t.toQuantity) : null,
    unitPrice: toDecimal(t.unitPrice),
    flatFee: t.flatFee ? toDecimal(t.flatFee) : null,
  }))
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

  const startDate =
    parsed.startDate && parsed.startDate !== ""
      ? new Date(parsed.startDate)
      : null
  const endDate =
    parsed.endDate && parsed.endDate !== "" ? new Date(parsed.endDate) : null

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.contractItem.create({
      data: {
        contractId,
        type: parsed.type,
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
        totalAmount:
          parsed.type === "ONE_TIME" || parsed.type === "INSTALLMENT"
            ? toDecimal(parsed.totalAmount)
            : null,
        installments:
          parsed.type === "INSTALLMENT" ? parsed.installments : null,
        installmentPlan:
          parsed.type === "INSTALLMENT" && parsed.installmentPlan?.length
            ? parsed.installmentPlan
            : Prisma.JsonNull,
      },
    })

    if (parsed.type === "RECURRING_VARIABLE") {
      await tx.pricingTable.create({
        data: {
          contractItem: { connect: { id: created.id } },
          name: parsed.pricingTableName?.trim() || `Tabla — ${parsed.name}`,
          tiers: { create: tiersCreateData(parsed.pricingTiers) },
        },
      })
    }

    return created
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
