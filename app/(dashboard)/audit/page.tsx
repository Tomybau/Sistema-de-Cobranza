import type { Metadata } from "next"
import { Suspense } from "react"
import { listAuditLogs, getAuditLogUsers } from "@/domain/audit/queries"
import { AuditLogClient } from "./_components/audit-log-client"

export const metadata: Metadata = {
  title: "Auditoría | Sistema de Cobranza",
  description: "Registro de operaciones críticas del sistema",
}

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{
    entityType?: string
    userId?: string
    dateFrom?: string
    dateTo?: string
    page?: string
  }>
}

export default async function AuditPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10))
  const entityType = sp.entityType ?? ""
  const userId = sp.userId ?? ""
  const dateFrom = sp.dateFrom ?? ""
  const dateTo = sp.dateTo ?? ""

  const [result, users] = await Promise.all([
    listAuditLogs({
      entityType: entityType || undefined,
      userId: userId || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`) : undefined,
      page,
      pageSize: 50,
    }),
    getAuditLogUsers(),
  ])

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Registro append-only de operaciones críticas del sistema.
        </p>
      </div>
      <Suspense>
        <AuditLogClient
          rows={result.rows}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          totalPages={result.totalPages}
          users={users}
          currentEntityType={entityType}
          currentUserId={userId}
          currentDateFrom={dateFrom}
          currentDateTo={dateTo}
        />
      </Suspense>
    </div>
  )
}
