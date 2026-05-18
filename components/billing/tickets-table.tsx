"use client"

import { useMemo, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type FilterFn,
  type RowSelectionState,
} from "@tanstack/react-table"
import { ArrowUpDown, Mail, X } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

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
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMoney } from "@/lib/money"
import type { BillingTicketSummary } from "@/domain/billing/queries"

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
  PARTIAL: "Parcial",
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive" | "ok" | "warn" | "bad" | "pending"
> = {
  PENDING: "pending",
  SENT: "secondary",
  PAID: "ok",
  OVERDUE: "bad",
  CANCELLED: "outline",
  PARTIAL: "warn",
}

const exactFilter: FilterFn<BillingTicketSummary> = (row, columnId, filterValue) => {
  if (!filterValue) return true
  return row.getValue(columnId) === filterValue
}

interface TicketsTableProps {
  data: BillingTicketSummary[]
}

export function TicketsTable({ data }: TicketsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "dueDate", desc: false }])
  const [ticketFilter, setTicketFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [isSendingBulk, setIsSendingBulk] = useState(false)

  const columns = useMemo<ColumnDef<BillingTicketSummary>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Seleccionar todo"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Seleccionar fila"
          />
        ),
        enableSorting: false,
        enableGlobalFilter: false,
        size: 40,
      },
      {
        accessorKey: "ticketNumber",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Número
            <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link href={`/tickets/${row.original.id}`} className="mono text-xs hover:underline">
            {row.getValue("ticketNumber")}
          </Link>
        ),
      },
      {
        accessorKey: "companyName",
        header: "Empresa",
        cell: ({ row }) => (
          <Link href={`/companies/${row.original.companyId}`} className="hover:underline text-sm">
            {row.getValue("companyName")}
          </Link>
        ),
      },
      {
        accessorKey: "contractTitle",
        header: "Contrato",
        cell: ({ row }) => (
          <Link
            href={`/contracts/${row.original.contractId}`}
            className="hover:underline text-sm truncate max-w-[12rem] block"
          >
            {row.getValue("contractTitle")}
          </Link>
        ),
      },
      {
        accessorKey: "itemName",
        header: "Item",
        cell: ({ getValue }) => (
          <span className="text-sm truncate max-w-[10rem] block">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "periodStart",
        header: "Período",
        cell: ({ getValue }) => {
          const v = getValue()
          if (!v) return <span className="text-muted-foreground">—</span>
          return format(new Date(v as string), "MMM yyyy", { locale: es })
        },
      },
      {
        accessorKey: "amount",
        header: () => <span className="block text-right">Monto</span>,
        cell: ({ row }) => (
          <span className="block text-right num font-medium text-sm">
            {formatMoney(row.getValue("amount"), row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Vcto.
            <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ getValue }) =>
          format(new Date(getValue() as string), "dd MMM yyyy", { locale: es }),
      },
      {
        accessorKey: "status",
        header: "Estado",
        filterFn: exactFilter,
        cell: ({ getValue }) => {
          const status = String(getValue())
          return (
            <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const ticketCol = table.getColumn("ticketNumber")
  const statusCol = table.getColumn("status")

  const handleTicketFilterChange = (value: string) => {
    setTicketFilter(value)
    ticketCol?.setFilterValue(value || undefined)
  }

  const handleStatusFilterChange = (value: string | null) => {
    const v = value ?? ""
    setStatusFilter(v)
    statusCol?.setFilterValue(v || undefined)
  }

  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length

  async function handleBulkSendReminder() {
    if (selectedCount === 0) return
    setIsSendingBulk(true)
    try {
      // Placeholder: en Tanda 3+ se conecta la action real de envío bulk
      await new Promise((r) => setTimeout(r, 800))
      toast.success(`Recordatorio enviado a ${selectedCount} ticket${selectedCount !== 1 ? "s" : ""}`)
      setRowSelection({})
    } catch {
      toast.error("Error al enviar recordatorios")
    } finally {
      setIsSendingBulk(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Buscar número de ticket..."
          value={ticketFilter}
          onChange={(e) => handleTicketFilterChange(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="PENDING" label={STATUS_LABELS["PENDING"]}>{STATUS_LABELS["PENDING"]}</SelectItem>
            <SelectItem value="SENT" label={STATUS_LABELS["SENT"]}>{STATUS_LABELS["SENT"]}</SelectItem>
            <SelectItem value="PAID" label={STATUS_LABELS["PAID"]}>{STATUS_LABELS["PAID"]}</SelectItem>
            <SelectItem value="OVERDUE" label={STATUS_LABELS["OVERDUE"]}>{STATUS_LABELS["OVERDUE"]}</SelectItem>
            <SelectItem value="CANCELLED" label={STATUS_LABELS["CANCELLED"]}>{STATUS_LABELS["CANCELLED"]}</SelectItem>
            <SelectItem value="PARTIAL" label={STATUS_LABELS["PARTIAL"]}>{STATUS_LABELS["PARTIAL"]}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="hover:bg-muted/50 data-[state=selected]:bg-primary/5"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {ticketFilter || statusFilter
                    ? "No hay resultados para esos filtros."
                    : "No hay tickets generados."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} ticket
        {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
        {selectedCount > 0 && (
          <span className="ml-2 text-primary">· {selectedCount} seleccionado{selectedCount !== 1 ? "s" : ""}</span>
        )}
      </p>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border bg-card shadow-lg px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedCount} ticket{selectedCount !== 1 ? "s" : ""} seleccionado{selectedCount !== 1 ? "s" : ""}
          </span>
          <div className="h-4 w-px bg-border" />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleBulkSendReminder}
            disabled={isSendingBulk}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            {isSendingBulk ? "Enviando..." : "Enviar recordatorio"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRowSelection({})}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
