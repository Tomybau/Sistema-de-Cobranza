import { prisma } from "@/db/client"
import { contractSchema, type ContractFormValues } from "./schemas"
import { toDecimal } from "@/lib/money"
import { isValidCurrency } from "@/lib/currencies"
import { createAuditLog } from "@/domain/audit"

export class ContractNumberAlreadyExistsError extends Error {
  constructor() {
    super("Ya existe un contrato con ese número.")
    this.name = "ContractNumberAlreadyExistsError"
  }
}

export class CompanyNotFoundError extends Error {
  constructor() {
    super("La empresa no existe o fue eliminada.")
    this.name = "CompanyNotFoundError"
  }
}

export async function createContract(data: ContractFormValues, userId?: string) {
  const parsed = contractSchema.parse(data)

  if (!isValidCurrency(parsed.currency)) {
    throw new Error("Moneda inválida.")
  }

  const company = await prisma.company.findFirst({
    where: { id: parsed.companyId, deletedAt: null },
  })
  if (!company) throw new CompanyNotFoundError()

  const existing = await prisma.contract.findUnique({
    where: { contractNumber: parsed.contractNumber },
  })
  if (existing) throw new ContractNumberAlreadyExistsError()

  const contract = await prisma.contract.create({
    data: {
      companyId: parsed.companyId,
      contractNumber: parsed.contractNumber,
      title: parsed.title,
      description: parsed.description ?? null,
      currency: parsed.currency,
      startDate: new Date(parsed.startDate),
      endDate: parsed.endDate && parsed.endDate !== "" ? new Date(parsed.endDate) : null,
      status: parsed.status,
      paymentTermsDays: parsed.paymentTermsDays,
      lateFeePercent: toDecimal(parsed.lateFeePercent),
      notes: parsed.notes ?? null,
    },
  })

  await createAuditLog(prisma, {
    userId,
    action: "contract.create",
    entityType: "Contract",
    entityId: contract.id,
    afterData: contract,
  })

  return contract
}
