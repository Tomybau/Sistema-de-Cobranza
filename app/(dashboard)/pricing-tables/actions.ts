"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createPricingTable } from "@/domain/pricing_tables/create"
import { updatePricingTable } from "@/domain/pricing_tables/update"
import {
  deletePricingTable,
  PricingTableInUseError,
} from "@/domain/pricing_tables/delete"
import type { PricingTableFormValues } from "@/domain/pricing_tables/schemas"

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string }

async function getUserId() {
  const session = await auth()
  return session?.user?.id
}

export async function createPricingTableAction(
  contractId: string | null,
  data: PricingTableFormValues
): Promise<ActionResult> {
  const userId = await getUserId()
  try {
    await createPricingTable(data, userId ?? "", contractId)
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message }
    throw e
  }
  if (contractId) {
    redirect(`/contracts/${contractId}?success=Tabla+de+precios+creada`)
  }
  redirect("/pricing-tables?success=Tabla+de+precios+creada+correctamente")
}

export async function updatePricingTableAction(
  id: string,
  data: PricingTableFormValues
): Promise<ActionResult> {
  const userId = await getUserId()
  try {
    await updatePricingTable(id, data, userId ?? "")
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message }
    throw e
  }
  redirect(`/pricing-tables/${id}?success=Tabla+de+precios+actualizada+correctamente`)
}

export async function deletePricingTableAction(
  id: string
): Promise<ActionResult> {
  const userId = await getUserId()
  try {
    await deletePricingTable(id, userId ?? "")
  } catch (e) {
    if (e instanceof PricingTableInUseError) {
      return { success: false, error: e.message }
    }
    if (e instanceof Error) return { success: false, error: e.message }
    throw e
  }
  revalidatePath("/pricing-tables")
  redirect("/pricing-tables?success=Tabla+de+precios+eliminada+correctamente")
}
