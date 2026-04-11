"use server"

import { auth } from "@/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { prisma } from "@/db/client"
import { createAuditLog } from "@/domain/audit"
import { clientSchema } from "@/domain/clients/schemas"
import { createClient, CompanyNotFoundError } from "@/domain/clients/create"
import {
  updateClient,
  ClientNotFoundError as UpdateClientNotFoundError,
} from "@/domain/clients/update"
import {
  softDeleteClient,
  setPrimaryClient,
  ClientNotFoundError,
} from "@/domain/clients/delete"

import type { ActionResult } from "@/app/(dashboard)/companies/actions"

async function getRequestContext() {
  const session = await auth()
  const h = await headers()
  return {
    userId: session?.user?.id,
    ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createClientAction(
  companyId: string,
  formData: FormData
): Promise<ActionResult> {
  // isPrimary en FormData llega como "on" o ausente — normalizar a boolean antes de parsear
  const raw = {
    ...Object.fromEntries(formData.entries()),
    isPrimary: formData.get("isPrimary") === "on",
  }
  const parsed = clientSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const ctx = await getRequestContext()

  try {
    const client = await createClient(companyId, parsed.data)
    await createAuditLog(prisma, {
      ...ctx,
      action: "client.create",
      entityType: "Client",
      entityId: client.id,
      afterData: client,
    })
  } catch (e) {
    if (e instanceof CompanyNotFoundError) {
      return { success: false, error: e.message }
    }
    throw e
  }

  revalidatePath(`/companies/${companyId}`)
  redirect(`/companies/${companyId}?tab=clients&success=Contacto+creado+correctamente`)
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateClientAction(
  clientId: string,
  companyId: string,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    ...Object.fromEntries(formData.entries()),
    isPrimary: formData.get("isPrimary") === "on",
  }
  const parsed = clientSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const ctx = await getRequestContext()

  try {
    const { before, after } = await updateClient(clientId, parsed.data)
    await createAuditLog(prisma, {
      ...ctx,
      action: "client.update",
      entityType: "Client",
      entityId: clientId,
      beforeData: before,
      afterData: after,
    })
  } catch (e) {
    if (e instanceof UpdateClientNotFoundError) {
      return { success: false, error: e.message }
    }
    throw e
  }

  revalidatePath(`/companies/${companyId}`)
  redirect(`/companies/${companyId}?tab=clients&success=Contacto+actualizado+correctamente`)
}

// ── Soft delete ───────────────────────────────────────────────────────────────

export async function softDeleteClientAction(
  clientId: string,
  companyId: string
): Promise<ActionResult> {
  const ctx = await getRequestContext()

  try {
    const client = await softDeleteClient(clientId)
    await createAuditLog(prisma, {
      ...ctx,
      action: "client.delete",
      entityType: "Client",
      entityId: clientId,
      beforeData: client,
      // Si era primary, el audit log queda registrado. La empresa queda sin primary.
      afterData: client.isPrimary
        ? { warning: "El contacto principal fue eliminado. La empresa quedó sin contacto principal." }
        : undefined,
    })
  } catch (e) {
    if (e instanceof ClientNotFoundError) {
      return { success: false, error: e.message }
    }
    throw e
  }

  revalidatePath(`/companies/${companyId}`)
  return { success: true, message: "Contacto eliminado" }
}

// ── Set primary ───────────────────────────────────────────────────────────────

export async function setPrimaryClientAction(
  clientId: string,
  companyId: string
): Promise<ActionResult> {
  const ctx = await getRequestContext()

  try {
    const client = await setPrimaryClient(clientId)
    await createAuditLog(prisma, {
      ...ctx,
      action: "client.set_primary",
      entityType: "Client",
      entityId: clientId,
      afterData: client,
    })
  } catch (e) {
    if (e instanceof ClientNotFoundError) {
      return { success: false, error: e.message }
    }
    throw e
  }

  revalidatePath(`/companies/${companyId}`)
  return { success: true, message: "Contacto establecido como principal" }
}
