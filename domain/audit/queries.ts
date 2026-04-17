import { prisma } from "@/db/client"

export type { AuditLogRow, AuditEntityType } from "./types"
export { AUDIT_ENTITY_TYPES } from "./types"

export interface AuditLogFilters {
  entityType?: string
  userId?: string
  dateFrom?: Date
  dateTo?: Date
  page?: number
  pageSize?: number
}

export async function listAuditLogs(filters: AuditLogFilters = {}) {
  const { entityType, userId, dateFrom, dateTo, page = 1, pageSize = 50 } = filters
  const skip = (page - 1) * pageSize

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(userId ? { userId } : {}),
    ...((dateFrom || dateTo)
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    rows: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      beforeData: r.beforeData as unknown,
      afterData: r.afterData as unknown,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt,
      user: r.user
        ? { id: r.user.id, name: r.user.name, email: r.user.email }
        : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getAuditLogUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  })
  return users
}
