import { prisma } from "@/db/client"
import { Prisma } from "@prisma/client"
import { contractItemSchema, type ContractItemFormValues, type PricingTierInput } from "./schemas"
import { toDecimal } from "@/lib/money"
import { createAuditLog } from "@/domain/audit"

export class ContractItemNotFoundError extends Error {
  constructor() {
    super("El item no existe.")
    this.name = "ContractItemNotFoundError"
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

export async function updateContractItem(
  id: string,
  data: ContractItemFormValues,
  userId?: string
) {
  const parsed = contractItemSchema.parse(data)

  const existing = await prisma.contractItem.findUnique({
    where: { id },
    include: { pricingTable: true },
  })
  if (!existing) throw new ContractItemNotFoundError()

  if (parsed.type !== existing.type) {
    throw new Error("No se puede cambiar el tipo de un item existente.")
  }

  const startDate =
    parsed.startDate && parsed.startDate !== ""
      ? new Date(parsed.startDate)
      : null
  const endDate =
    parsed.endDate && parsed.endDate !== "" ? new Date(parsed.endDate) : null

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.contractItem.update({
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
        totalAmount:
          parsed.type === "ONE_TIME" || parsed.type === "INSTALLMENT"
            ? toDecimal(parsed.totalAmount)
            : null,
        installments:
          parsed.type === "INSTALLMENT" ? parsed.installments : null,
        installmentPlan:
          parsed.type === "INSTALLMENT"
            ? (parsed.installmentPlan?.length ? parsed.installmentPlan : Prisma.JsonNull)
            : undefined,
      },
    })

    if (parsed.type === "RECURRING_VARIABLE") {
      const tableName = parsed.pricingTableName?.trim() || `Tabla — ${parsed.name}`
      if (existing.pricingTable) {
        // borrar tiers viejos y recrear
        await tx.pricingTier.deleteMany({ where: { pricingTableId: existing.pricingTable.id } })
        await tx.pricingTable.update({
          where: { id: existing.pricingTable.id },
          data: {
            name: tableName,
            tiers: { create: tiersCreateData(parsed.pricingTiers) },
          },
        })
      } else {
        await tx.pricingTable.create({
          data: {
            contractItem: { connect: { id } },
            name: tableName,
            tiers: { create: tiersCreateData(parsed.pricingTiers) },
          },
        })
      }
    }

    return result
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
