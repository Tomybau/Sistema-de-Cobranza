"use server"

import { auth } from "@/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { prisma } from "@/db/client"
import { createAuditLog } from "@/domain/audit"
import { companySchema } from "@/domain/companies/schemas"
import { createCompany, TaxIdAlreadyExistsError } from "@/domain/companies/create"
import {
  updateCompany,
  TaxIdAlreadyExistsError as UpdateTaxIdError,
  CompanyNotFoundError as UpdateNotFoundError,
} from "@/domain/companies/update"
import {
  softDeleteCompany,
  restoreCompany,
  CompanyNotFoundError,
  CompanyHasActiveContractsError,
} from "@/domain/companies/delete"

// Helper interno para extraer userId, ip y userAgent del request
async function getRequestContext() {
  const session = await auth()
  const h = await headers()
  return {
    userId: session?.user?.id,
    ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  }
}

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string }

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCompanyAction(
  formData: FormData
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData.entries())
  const parsed = companySchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const ctx = await getRequestContext()

  try {
    const company = await createCompany(parsed.data)
    await createAuditLog(prisma, {
      ...ctx,
      action: "company.create",
      entityType: "Company",
      entityId: company.id,
      afterData: company,
    })
  } catch (e) {
    if (e instanceof TaxIdAlreadyExistsError) {
      return { success: false, error: e.message }
    }
    throw e
  }

  redirect("/companies?success=Empresa+creada+correctamente")
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateCompanyAction(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData.entries())
  const parsed = companySchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const ctx = await getRequestContext()

  try {
    const { before, after } = await updateCompany(id, parsed.data)
    await createAuditLog(prisma, {
      ...ctx,
      action: "company.update",
      entityType: "Company",
      entityId: id,
      beforeData: before,
      afterData: after,
    })
  } catch (e) {
    if (e instanceof UpdateTaxIdError) {
      return { success: false, error: e.message }
    }
    if (e instanceof UpdateNotFoundError) {
      return { success: false, error: e.message }
    }
    throw e
  }

  redirect(`/companies/${id}?success=Empresa+actualizada+correctamente`)
}

// ── Soft delete ───────────────────────────────────────────────────────────────

export async function softDeleteCompanyAction(
  id: string
): Promise<ActionResult> {
  const ctx = await getRequestContext()

  try {
    const company = await softDeleteCompany(id)
    await createAuditLog(prisma, {
      ...ctx,
      action: "company.delete",
      entityType: "Company",
      entityId: id,
      beforeData: company,
    })
  } catch (e) {
    if (
      e instanceof CompanyNotFoundError ||
      e instanceof CompanyHasActiveContractsError
    ) {
      return { success: false, error: e.message }
    }
    throw e
  }

  revalidatePath("/companies")
  redirect("/companies?success=Empresa+eliminada+correctamente")
}

// ── Restore ───────────────────────────────────────────────────────────────────

export async function restoreCompanyAction(
  id: string
): Promise<ActionResult> {
  const ctx = await getRequestContext()

  try {
    const company = await restoreCompany(id)
    await createAuditLog(prisma, {
      ...ctx,
      action: "company.restore",
      entityType: "Company",
      entityId: id,
      afterData: company,
    })
  } catch (e) {
    if (e instanceof CompanyNotFoundError) {
      return { success: false, error: e.message }
    }
    throw e
  }

  revalidatePath("/companies")
  redirect("/companies?success=Empresa+restaurada+correctamente")
}

