/**
 * domain/audit/index.ts
 *
 * Helper para escribir entradas al AuditLog.
 * Todas las operaciones auditables del sistema deben usar esta función.
 *
 * Uso desde un Server Action:
 *   import { headers } from "next/headers"
 *   const h = await headers()
 *   await createAuditLog(prisma, {
 *     userId: session.user.id,
 *     action: "company.create",
 *     entityType: "Company",
 *     entityId: company.id,
 *     afterData: company,
 *     ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
 *     userAgent: h.get("user-agent") ?? undefined,
 *   })
 */

import type { PrismaClient } from "@prisma/client"

export interface AuditLogParams {
  userId?: string
  action: string
  entityType: string
  entityId: string
  beforeData?: unknown
  afterData?: unknown
  ipAddress?: string
  userAgent?: string
}

export async function createAuditLog(
  prisma: PrismaClient,
  params: AuditLogParams
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeData: params.beforeData !== undefined
        ? (params.beforeData as Parameters<typeof prisma.auditLog.create>[0]["data"]["beforeData"])
        : undefined,
      afterData: params.afterData !== undefined
        ? (params.afterData as Parameters<typeof prisma.auditLog.create>[0]["data"]["afterData"])
        : undefined,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  })
}
