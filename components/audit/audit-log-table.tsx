"use client"

import { useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronDown, ChevronRight, ClipboardList } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AUDIT_ENTITY_TYPES, type AuditLogRow } from "@/domain/audit/types"
import Link from "next/link"

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

// Dot color per action verb
const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-ok",
  UPDATE: "bg-primary",
  DELETE: "bg-bad",
  SEND: "bg-warn",
  CANCEL: "bg-bad",
  MARK: "bg-ok",
  REGISTER: "bg-ok",
}

function actionDotColor(action: string): string {
  const verb = action.split("_")[0]
  return ACTION_COLOR[verb] ?? "bg-muted-foreground"
}

function actionBadgeVariant(
  action: string
): "default" | "secondary" | "outline" | "ok" | "warn" | "bad" | "pending" {
  const verb = action.split("_")[0]
  if (verb === "CREATE" || verb === "MARK" || verb === "REGISTER") return "ok"
  if (verb === "DELETE" || verb === "CANCEL") return "bad"
  if (verb === "SEND") return "warn"
  if (verb === "UPDATE") return "secondary"
  return "outline"
}

function EntityLink({ entityType, entityId }: { entityType: string; entityId: string }) {
  const base = ENTITY_ROUTES[entityType]
  if (!base) {
    return (
      <span className="mono text-xs text-muted-foreground">
        {entityId.slice(0, 10)}…
      </span>
    )
  }
  return (
    <Link
      href={`${base}/${entityId}`}
      className="mono text-xs text-primary hover:underline"
    >
      {entityId.slice(0, 10)}…
    </Link>
  )
}

function DetailToggle({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false)
  if (data === null || data === undefined) return null
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
        <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs mono whitespace-pre-wrap">
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

  const hasFilters = !!(currentEntityType || currentUserId || currentDateFrom || currentDateTo)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-lg border bg-card">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Entidad</p>
          <Select
            value={currentEntityType || "_all"}
            onValueChange={(v) =>
              onFilter({ entityType: !v || v === "_all" ? undefined : v, page: 1 })
            }
          >
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas</SelectItem>
              {AUDIT_ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
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
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
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
            className="w-[148px] h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Hasta</p>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[148px] h-8 text-sm"
          />
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="h-8"
          onClick={() => onFilter({ dateFrom, dateTo, page: 1 })}
        >
          Aplicar
        </Button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setDateFrom("")
              setDateTo("")
              onFilter({
                entityType: undefined,
                userId: undefined,
                dateFrom: undefined,
                dateTo: undefined,
                page: 1,
              })
            }}
          >
            Limpiar
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {total} registro{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Timeline */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <ClipboardList className="h-10 w-10 opacity-25" />
          <p className="text-sm font-medium">Sin registros de auditoría</p>
          <p className="text-xs">
            {hasFilters
              ? "Probá con otros filtros."
              : "Los cambios en entidades críticas aparecerán aquí."}
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Línea vertical continua */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

          <ul className="space-y-0">
            {rows.map((row, idx) => (
              <li key={row.id} className="relative flex gap-4 pb-0">
                {/* Dot */}
                <div className="relative z-10 mt-3 flex h-10 w-10 shrink-0 items-center justify-center">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${actionDotColor(row.action)}`}
                  />
                </div>

                {/* Content */}
                <div
                  className={`flex-1 py-3 ${idx < rows.length - 1 ? "border-b border-border/50" : ""}`}
                >
                  <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                    <Badge
                      variant={actionBadgeVariant(row.action)}
                      className="mono text-[10px] shrink-0"
                    >
                      {row.action}
                    </Badge>

                    <span className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{row.entityType}</span>
                      {" · "}
                      <EntityLink entityType={row.entityType} entityId={row.entityId} />
                    </span>

                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      <span
                        title={format(new Date(row.createdAt), "dd MMM yyyy HH:mm:ss", {
                          locale: es,
                        })}
                      >
                        {formatDistanceToNow(new Date(row.createdAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {row.user ? row.user.name : "Sistema"}
                    </span>
                    <span className="text-xs text-muted-foreground/50">·</span>
                    <span className="text-xs text-muted-foreground mono">
                      {format(new Date(row.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                    </span>
                  </div>

                  {row.afterData != null || row.beforeData != null ? (
                    <div className="mt-1.5">
                      <DetailToggle data={row.afterData ?? row.beforeData} />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>
            Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onFilter({ page: page - 1 })}
            >
              Anterior
            </Button>
            <span>Pág. {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onFilter({ page: page + 1 })}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
