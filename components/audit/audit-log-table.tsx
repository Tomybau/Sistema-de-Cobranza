"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronDown, ChevronRight, ClipboardList } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AUDIT_ENTITY_TYPES, type AuditLogRow } from "@/domain/audit/types"
import Link from "next/link"

// Map entity type → route prefix
const ENTITY_ROUTES: Record<string, string | null> = {
  Company: "/companies",
  Client: null,
  Contract: "/contracts",
  ContractItem: null,
  BillingTicket: "/tickets",
  Payment: "/payments",
  EmailTemplate: "/email-templates",
  EmailLog: null,
  PricingTable: "/pricing-tables",
}

function EntityLink({ entityType, entityId }: { entityType: string; entityId: string }) {
  const base = ENTITY_ROUTES[entityType]
  if (!base) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {entityId.slice(0, 12)}…
      </span>
    )
  }
  return (
    <Link
      href={`${base}/${entityId}`}
      className="font-mono text-xs hover:underline text-primary"
    >
      {entityId.slice(0, 12)}…
    </Link>
  )
}

function DetailToggle({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false)
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Ver detalle
      </button>
      {open && (
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

interface AuditLogTableProps {
  rows: AuditLogRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  users: { id: string; name: string; email: string }[]
  // URL-driven filter state (passed from server component)
  currentEntityType: string
  currentUserId: string
  currentDateFrom: string
  currentDateTo: string
  onFilter: (params: {
    entityType?: string
    userId?: string
    dateFrom?: string
    dateTo?: string
    page?: number
  }) => void
}

export function AuditLogTable({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  users,
  currentEntityType,
  currentUserId,
  currentDateFrom,
  currentDateTo,
  onFilter,
}: AuditLogTableProps) {
  const [dateFrom, setDateFrom] = useState(currentDateFrom)
  const [dateTo, setDateTo] = useState(currentDateTo)

  function applyDateFilter() {
    onFilter({ dateFrom, dateTo, page: 1 })
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Entidad</p>
          <Select
            value={currentEntityType || "_all"}
            onValueChange={(v) =>
              onFilter({ entityType: !v || v === "_all" ? undefined : v, page: 1 })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas las entidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas</SelectItem>
              {AUDIT_ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Usuario</p>
          <Select
            value={currentUserId || "_all"}
            onValueChange={(v) =>
              onFilter({ userId: !v || v === "_all" ? undefined : v, page: 1 })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos los usuarios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Desde</p>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[160px]"
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Hasta</p>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[160px]"
          />
        </div>

        <Button variant="secondary" size="sm" onClick={applyDateFilter}>
          Aplicar fechas
        </Button>

        {(currentEntityType || currentUserId || currentDateFrom || currentDateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom("")
              setDateTo("")
              onFilter({ entityType: undefined, userId: undefined, dateFrom: undefined, dateTo: undefined, page: 1 })
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha/Hora</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/50 align-top">
                  <TableCell className="text-xs tabular-nums whitespace-nowrap">
                    {format(new Date(row.createdAt), "dd MMM yyyy HH:mm:ss", { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {row.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{row.entityType}</span>
                  </TableCell>
                  <TableCell>
                    <EntityLink entityType={row.entityType} entityId={row.entityId} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.user ? (
                      <span title={row.user.email}>{row.user.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Sistema</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <DetailToggle data={row.afterData ?? row.beforeData} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ClipboardList className="h-8 w-8 opacity-30" />
                    <p className="text-sm font-medium">Sin registros de auditoría</p>
                    <p className="text-xs">
                      Los cambios en entidades críticas aparecerán aquí.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total} registro{total !== 1 ? "s" : ""} en total
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onFilter({ page: page - 1 })}
            >
              Anterior
            </Button>
            <span>
              Pág. {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onFilter({ page: page + 1 })}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
