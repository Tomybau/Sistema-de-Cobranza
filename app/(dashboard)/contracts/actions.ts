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

export type ActionResult =
  | { success: true; message?: string; id?: string }
  | { success: false; error: string }

async function getUserId() {
  const session = await auth()
  return session?.user?.id
}

export async function createContractAction(
  data: ContractFormValues
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
  redirect(`/contracts/${id}`)
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
