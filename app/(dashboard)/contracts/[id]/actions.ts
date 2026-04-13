"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

import { addContractItem, ContractNotFoundError, PricingTableNotFoundError } from "@/domain/contract_items/create"
import { updateContractItem, toggleContractItemActive } from "@/domain/contract_items/update"
import { deleteContractItem, ContractItemHasTicketsError, ContractItemNotFoundError } from "@/domain/contract_items/delete"
import { contractItemSchema } from "@/domain/contract_items/schemas"
import type { ContractItemFlatValues } from "@/domain/contract_items/schemas"
import { generateBillingTickets, previewBillingTickets } from "@/domain/billing/generate"
import { buildPeriodDate } from "@/lib/dates"

export type ActionResult =
  | { success: true }
  | { success: false; error: string }

async function getUserId() {
  const session = await auth()
  return session?.user?.id
}

export async function addContractItemAction(
  contractId: string,
  data: ContractItemFlatValues
): Promise<ActionResult> {
  const userId = await getUserId()

  const parsed = contractItemSchema.safeParse(data)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  try {
    await addContractItem(contractId, parsed.data, userId)
  } catch (e) {
    if (
      e instanceof ContractNotFoundError ||
      e instanceof PricingTableNotFoundError
    ) {
      return { success: false, error: e.message }
    }
    throw e
  }

  revalidatePath(`/contracts/${contractId}`)
  return { success: true }
}

export async function updateContractItemAction(
  contractId: string,
  itemId: string,
  data: ContractItemFlatValues
): Promise<ActionResult> {
  const userId = await getUserId()

  const parsed = contractItemSchema.safeParse(data)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  try {
    await updateContractItem(itemId, parsed.data, userId)
  } catch (e) {
    if (e instanceof Error) {
      return { success: false, error: e.message }
    }
    throw e
  }

  revalidatePath(`/contracts/${contractId}`)
  return { success: true }
}

export async function deleteContractItemAction(
  contractId: string,
  itemId: string
): Promise<ActionResult> {
  const userId = await getUserId()

  try {
    await deleteContractItem(itemId, userId)
  } catch (e) {
    if (
      e instanceof ContractItemNotFoundError ||
      e instanceof ContractItemHasTicketsError
    ) {
      return { success: false, error: e.message }
    }
    throw e
  }

  revalidatePath(`/contracts/${contractId}`)
  return { success: true }
}

export async function toggleContractItemActiveAction(
  contractId: string,
  itemId: string
): Promise<ActionResult> {
  const userId = await getUserId()

  try {
    await toggleContractItemActive(itemId, userId)
  } catch (e) {
    if (e instanceof Error) {
      return { success: false, error: e.message }
    }
    throw e
  }

  revalidatePath(`/contracts/${contractId}`)
  return { success: true }
}

// ── Billing ticket actions ────────────────────────────────────────────────────

export type PreviewResult =
  | {
      success: true
      drafts: Array<{
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
      }>
      skipped: number
    }
  | { success: false; error: string }

export type GenerateTicketsResult =
  | { success: true; inserted: number; needsInput: number; skipped: number }
  | { success: false; error: string }

export async function previewTicketsAction(
  contractId: string,
  year: number,
  month: number
): Promise<PreviewResult> {
  try {
    const periodDate = buildPeriodDate(year, month)
    const result = await previewBillingTickets(contractId, periodDate)
    return { success: true, ...result }
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message }
    throw e
  }
}

export async function generateTicketsAction(
  contractId: string,
  year: number,
  month: number,
  variableQuantities: Record<string, string>
): Promise<GenerateTicketsResult> {
  const session = await auth()
  const userId = session?.user?.id

  try {
    const periodDate = buildPeriodDate(year, month)
    const result = await generateBillingTickets(contractId, periodDate, variableQuantities, userId)
    revalidatePath(`/contracts/${contractId}`)
    return {
      success: true,
      inserted: result.inserted,
      needsInput: result.needsInput.length,
      skipped: result.skipped,
    }
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message }
    throw e
  }
}
