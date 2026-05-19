"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  createContract,
  ContractNumberAlreadyExistsError,
  CompanyNotFoundError,
} from "@/domain/contracts/create"
import {
  updateContract,
  changeContractStatus,
  ContractNotFoundError as UpdateNotFoundError,
  ContractNumberAlreadyExistsError as UpdateDupError,
} from "@/domain/contracts/update"
import {
  softDeleteContract,
  ContractNotFoundError as DeleteNotFoundError,
  ContractActiveError,
} from "@/domain/contracts/delete"
import type { ContractFormValues } from "@/domain/contracts/schemas"
import type { ContractStatus } from "@prisma/client"
import type {
  NewCompanyInput,
  NewClientInput,
  DraftItemInput,
  CreateContractFullInput,
  ActionResult,
} from "@/app/(dashboard)/contracts/types"

// Re-exportar desde types.ts (sin "use server") para que clientes puedan importar tipos
export type {
  NewCompanyInput,
  NewClientInput,
  DraftPricingTier,
  DraftItemInput,
  CreateContractFullInput,
  ActionResult,
} from "@/app/(dashboard)/contracts/types"

async function getUserId(): Promise<string | undefined> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return undefined
  const { prisma } = await import("@/db/client")
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (exists) return id
  const fallback = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } })
  return fallback?.id
}

export async function createContractAction(
  data: ContractFormValues,
  ocrDocumentId?: string
): Promise<ActionResult> {
  const userId = await getUserId()
  let id: string
  try {
    const contract = await createContract(data, userId)
    id = contract.id
  } catch (e) {
    if (
      e instanceof ContractNumberAlreadyExistsError ||
      e instanceof CompanyNotFoundError
    ) {
      return { success: false, error: e.message }
    }
    throw e
  }
  if (ocrDocumentId) {
    const { prisma } = await import("@/db/client")
    await prisma.contractDocument.updateMany({
      where: { id: ocrDocumentId },
      data: { contractId: id },
    })
  }
  redirect(`/contracts/${id}`)
}

// ─── Full contract creation (empresa+cliente+contrato+items) ─────────────────

export async function createContractFullAction(
  input: CreateContractFullInput
): Promise<ActionResult> {
  const userId = await getUserId()
  let newContractId: string | null = null

  try {
    const { prisma } = await import("@/db/client")
    const { toDecimal } = await import("@/lib/money")
    const { isValidCurrency } = await import("@/lib/currencies")

    newContractId = await prisma.$transaction(async (tx) => {
      // 1. Resolver companyId
      let companyId = input.contract.companyId ?? ""

      if (input.companyMode === "new") {
        const nc = input.newCompany
        if (!nc?.legalName?.trim()) throw new Error("La razón social es obligatoria")

        if (nc.taxId?.trim()) {
          const dup = await tx.company.findUnique({ where: { taxId: nc.taxId.trim() } })
          if (dup) throw new Error("Ya existe una empresa con ese CUIT/taxId")
        }

        const company = await tx.company.create({
          data: {
            legalName: nc.legalName.trim(),
            taxId: nc.taxId?.trim() || null,
            taxIdType: nc.taxIdType?.trim() || null,
            email: nc.email?.trim() || null,
            phone: nc.phone?.trim() || null,
            address: nc.address?.trim() || null,
          },
        })
        companyId = company.id

        if (input.newClient) {
          const nc2 = input.newClient
          if (!nc2.fullName?.trim()) throw new Error("El nombre del contacto es obligatorio")
          if (!nc2.email?.trim()) throw new Error("El email del contacto es obligatorio")
          await tx.client.create({
            data: {
              companyId,
              fullName: nc2.fullName.trim(),
              email: nc2.email.trim(),
              phone: nc2.phone?.trim() || null,
              role: nc2.role?.trim() || null,
              clientType: nc2.clientType ?? "GENERAL",
              isPrimary: true,
            },
          })
        }
      }

      if (!companyId) throw new Error("La empresa es obligatoria")

      const company = await tx.company.findFirst({ where: { id: companyId, deletedAt: null } })
      if (!company) throw new Error("La empresa no existe o fue eliminada")

      // 2. Validar contrato
      const cd = input.contract
      if (!cd.contractNumber?.trim()) throw new Error("El número de contrato es obligatorio")
      if (!cd.title?.trim()) throw new Error("El título del contrato es obligatorio")
      if (!cd.startDate) throw new Error("La fecha de inicio es obligatoria")
      if (!isValidCurrency(cd.currency)) throw new Error("Moneda inválida")

      const dupContract = await tx.contract.findUnique({ where: { contractNumber: cd.contractNumber } })
      if (dupContract) throw new Error("Ya existe un contrato con ese número")

      // 3. Crear contrato
      const contract = await tx.contract.create({
        data: {
          companyId,
          contractNumber: cd.contractNumber,
          title: cd.title,
          description: cd.description ?? null,
          currency: cd.currency,
          startDate: new Date(cd.startDate),
          endDate: cd.endDate && cd.endDate !== "" ? new Date(cd.endDate) : null,
          status: cd.status as ContractStatus,
          paymentTermsDays: cd.paymentTermsDays,
          lateFeePercent: toDecimal(cd.lateFeePercent),
          notes: cd.notes ?? null,
        },
      })

      // 4. Crear ítems + pricing tables (1:1 con item)
      for (const item of input.items) {
        if (item.type === "RECURRING_VARIABLE") {
          if (!item.newPricingTableTiers?.length) {
            throw new Error(`La tabla de precios de "${item.name}" necesita al menos un rango`)
          }
        }

        const createdItem = await tx.contractItem.create({
          data: {
            contractId: contract.id,
            type: item.type,
            name: item.name,
            description: item.description?.trim() || null,
            isActive: true,
            fixedAmount: item.fixedAmount?.trim() ? toDecimal(item.fixedAmount) : null,
            billingDayOfMonth: item.billingDayOfMonth ?? null,
            totalAmount: item.totalAmount?.trim() ? toDecimal(item.totalAmount) : null,
            installments: item.installments ?? null,
            milestoneLabels: item.milestoneLabels?.length ? item.milestoneLabels : undefined,
            installmentPlan: item.installmentPlan?.length ? item.installmentPlan : undefined,
            breakdownNote: item.breakdownNote?.trim() || null,
            quotaLimit: item.quotaLimit?.trim() ? toDecimal(item.quotaLimit) : null,
            quotaUnit: item.quotaUnit?.trim() || null,
            durationMonths: item.durationMonths ?? null,
          },
        })

        if (item.type === "RECURRING_VARIABLE" && item.newPricingTableTiers?.length) {
          await tx.pricingTable.create({
            data: {
              contractItem: { connect: { id: createdItem.id } },
              name: item.newPricingTableName?.trim() || `Tabla — ${item.name}`,
              tiers: {
                create: item.newPricingTableTiers.map((t) => ({
                  fromQuantity: toDecimal(t.from),
                  toQuantity: t.to?.trim() ? toDecimal(t.to) : null,
                  unitPrice: toDecimal(t.unitPrice),
                  flatFee: t.flatFee?.trim() ? toDecimal(t.flatFee) : null,
                })),
              },
            },
          })
        }
      }

      // 5. Vincular documento OCR
      if (input.ocrDocumentId) {
        await tx.contractDocument.updateMany({
          where: { id: input.ocrDocumentId },
          data: { contractId: contract.id },
        })
      }

      return contract.id
    })

  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message }
    throw e
  }

  // Audit log — no-throw: si falla (ej: userId stale) no bloquea la creación
  try {
    const { createAuditLog } = await import("@/domain/audit")
    const { prisma: p } = await import("@/db/client")
    await createAuditLog(p, {
      userId,
      action: "contract.create",
      entityType: "Contract",
      entityId: newContractId!,
      afterData: { id: newContractId, companyMode: input.companyMode },
    })
  } catch {
    // audit log failure is non-critical
  }

  redirect(`/contracts/${newContractId}`)
}

export async function updateContractAction(
  id: string,
  data: ContractFormValues
): Promise<ActionResult> {
  const userId = await getUserId()
  try {
    await updateContract(id, data, userId)
  } catch (e) {
    if (e instanceof UpdateNotFoundError || e instanceof UpdateDupError) {
      return { success: false, error: e.message }
    }
    throw e
  }
  redirect(`/contracts/${id}?success=Contrato+actualizado+correctamente`)
}

export async function changeContractStatusAction(
  id: string,
  newStatus: ContractStatus
): Promise<ActionResult> {
  const userId = await getUserId()
  try {
    await changeContractStatus(id, newStatus, userId)
  } catch (e) {
    if (e instanceof UpdateNotFoundError || e instanceof Error) {
      return { success: false, error: (e as Error).message }
    }
    throw e
  }
  revalidatePath(`/contracts/${id}`)
  return { success: true }
}

export async function softDeleteContractAction(
  id: string
): Promise<ActionResult> {
  const userId = await getUserId()
  try {
    await softDeleteContract(id, userId)
  } catch (e) {
    if (
      e instanceof DeleteNotFoundError ||
      e instanceof ContractActiveError
    ) {
      return { success: false, error: e.message }
    }
    throw e
  }
  revalidatePath("/contracts")
  redirect("/contracts?success=Contrato+eliminado+correctamente")
}
