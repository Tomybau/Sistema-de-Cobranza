"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { prisma } from "@/db/client"
import { previewBillingTickets, generateBillingTickets, generateInstallmentsDirect } from "@/domain/billing/generate"
import { getPendingInstallmentsForContracts } from "@/domain/billing/queries"
import { buildPeriodDate } from "@/lib/dates"

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface PendingContractGroup {
  companyId: string
  companyName: string
  contracts: PendingContractData[]
}

export interface PendingContractData {
  contractId: string
  contractNumber: string
  title: string
  currency: string
  // Tickets del período seleccionado (RECURRING_FIXED, RECURRING_VARIABLE, ONE_TIME)
  drafts: PendingDraft[]
  skipped: number
  // Cuotas pendientes de INSTALLMENT (todas, sin filtro de período)
  pendingInstallments: PendingInstallment[]
}

export interface PendingDraft {
  contractItemId: string
  itemName: string
  type: string
  ticketNumber: string
  amount: string | null
  status: "READY" | "NEEDS_QUANTITY"
  installmentNum: number | null
  pricingTableId: string | null
  issueDate: string
  dueDate: string
  description: string | null
  breakdownNote: string | null
  pricingTiers: Array<{
    id: string
    fromQuantity: string
    toQuantity: string | null
    unitPrice: string
    flatFee: string | null
  }> | null
}

export interface PendingInstallment {
  contractItemId: string
  itemName: string
  installmentNum: number
  totalInstallments: number
  description: string | null
  amount: string
  currency: string
  dueDate: string
  breakdownNote: string | null
  ticketNumber: string
}

export type PreviewAllResult =
  | { success: true; groups: PendingContractGroup[]; totalItems: number }
  | { success: false; error: string }

// ─── previewAllPendingAction ──────────────────────────────────────────────────

export async function previewAllPendingAction(
  year: number,
  month: number
): Promise<PreviewAllResult> {
  try {
    const periodDate = buildPeriodDate(year, month)

    // Todos los contratos activos con su empresa
    const contracts = await prisma.contract.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: {
        company: { select: { id: true, legalName: true } },
      },
      orderBy: [{ company: { legalName: "asc" } }, { contractNumber: "asc" }],
    })

    if (contracts.length === 0) {
      return { success: true, groups: [], totalItems: 0 }
    }

    const contractIds = contracts.map((c) => c.id)

    // Preview recurrentes por período + cuotas pendientes (en paralelo)
    const [allInstallments, previewResults] = await Promise.all([
      getPendingInstallmentsForContracts(contractIds),
      Promise.all(
        contracts.map(async (c) => {
          const result = await previewBillingTickets(c.id, periodDate)
          return { contractId: c.id, ...result }
        })
      ),
    ])

    // Indexar installments por contrato
    const installmentsByContract = new Map<string, PendingInstallment[]>()
    for (const inst of allInstallments) {
      if (!installmentsByContract.has(inst.contractId)) {
        installmentsByContract.set(inst.contractId, [])
      }
      installmentsByContract.get(inst.contractId)!.push({
        contractItemId: inst.contractItemId,
        itemName: inst.itemName,
        installmentNum: inst.installmentNum,
        totalInstallments: inst.totalInstallments,
        description: inst.description,
        amount: inst.amount,
        currency: inst.currency,
        dueDate: inst.dueDate,
        breakdownNote: inst.breakdownNote,
        ticketNumber: inst.ticketNumber,
      })
    }

    // Agrupar por empresa
    const companyMap = new Map<string, PendingContractGroup>()

    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i]
      const preview = previewResults[i]
      const pendingInstallments = installmentsByContract.get(contract.id) ?? []

      // Omitir contratos sin nada pendiente
      if (preview.drafts.length === 0 && pendingInstallments.length === 0) continue

      const contractData: PendingContractData = {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        currency: contract.currency,
        drafts: preview.drafts as PendingDraft[],
        skipped: preview.skipped,
        pendingInstallments,
      }

      if (!companyMap.has(contract.companyId)) {
        companyMap.set(contract.companyId, {
          companyId: contract.companyId,
          companyName: contract.company.legalName,
          contracts: [],
        })
      }
      companyMap.get(contract.companyId)!.contracts.push(contractData)
    }

    const groups = Array.from(companyMap.values())
    const totalItems = groups.reduce(
      (sum, g) =>
        sum +
        g.contracts.reduce(
          (s, c) => s + c.drafts.length + c.pendingInstallments.length,
          0
        ),
      0
    )

    return { success: true, groups, totalItems }
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message }
    throw e
  }
}

// ─── generateSelectedAction ───────────────────────────────────────────────────

export interface ContractGenerationInput {
  contractId: string
  year: number
  month: number
  // IDs de los ContractItems recurrentes/one-time seleccionados (para filtrar)
  selectedDraftItemIds: string[]
  variableQuantities: Record<string, string>
  variableModes: Record<string, "quantity" | "price">
  // Cuotas de INSTALLMENT seleccionadas
  selectedInstallments: Array<{ contractItemId: string; installmentNum: number }>
}

export type GenerateSelectedResult =
  | { success: true; inserted: number; skipped: number; needsInput: number }
  | { success: false; error: string }

export async function generateSelectedAction(
  inputs: ContractGenerationInput[]
): Promise<GenerateSelectedResult> {
  const session = await auth()
  const userId = session?.user?.id

  try {
    let totalInserted = 0
    let totalSkipped = 0
    let totalNeedsInput = 0

    for (const input of inputs) {
      const periodDate = buildPeriodDate(input.year, input.month)

      // Generar tickets recurrentes/one-time (solo los seleccionados)
      if (input.selectedDraftItemIds.length > 0) {
        // Filtramos variableQuantities y variableModes a los seleccionados
        const filteredQuantities: Record<string, string> = {}
        const filteredModes: Record<string, "quantity" | "price"> = {}
        for (const itemId of input.selectedDraftItemIds) {
          if (input.variableQuantities[itemId] !== undefined) {
            filteredQuantities[itemId] = input.variableQuantities[itemId]
          }
          if (input.variableModes[itemId] !== undefined) {
            filteredModes[itemId] = input.variableModes[itemId]
          }
        }

        const result = await generateBillingTickets(
          input.contractId,
          periodDate,
          filteredQuantities,
          filteredModes,
          userId
        )

        // Solo contamos los insertados que estaban en selectedDraftItemIds
        // generateBillingTickets ya maneja idempotencia — contamos su resultado
        totalInserted += result.inserted
        totalSkipped += result.skipped
        totalNeedsInput += result.needsInput.length
      }

      // Generar cuotas seleccionadas
      if (input.selectedInstallments.length > 0) {
        const instResult = await generateInstallmentsDirect(
          input.contractId,
          input.selectedInstallments,
          userId
        )
        totalInserted += instResult.inserted
        totalSkipped += instResult.skipped
      }
    }

    revalidatePath("/tickets")
    return {
      success: true,
      inserted: totalInserted,
      skipped: totalSkipped,
      needsInput: totalNeedsInput,
    }
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message }
    throw e
  }
}
