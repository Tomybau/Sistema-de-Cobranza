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
} from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

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
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING: "secondary",
  SENT: "default",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "outline",
  PARTIAL: "secondary",
}

// Custom filter fn so status column supports exact-match filtering
const exactFilter: FilterFn<BillingTicketSummary> = (
  row,
  columnId,
  filterValue
) => {
  if (!filterValue) return true
  return row.getValue(columnId) === filterValue
}

interface TicketsTableProps {
  data: BillingTicketSummary[]
}

export function TicketsTable({ data }: TicketsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "dueDate", desc: false },
  ])
  const [ticketFilter, setTicketFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const columns = useMemo<ColumnDef<BillingTicketSummary>[]>(
    () => [
      {
        accessorKey: "ticketNumber",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Número
            <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/tickets/${row.original.id}`}
            className="font-mono text-xs hover:underline"
          >
            {row.getValue("ticketNumber")}
          </Link>
        ),
      },
      {
        accessorKey: "companyName",
        header: "Empresa",
        cell: ({ row }) => (
          <Link
            href={`/companies/${row.original.companyId}`}
            className="hover:underline text-sm"
          >
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
          <span className="text-sm truncate max-w-[10rem] block">
            {String(getValue())}
          </span>
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
          <span className="block text-right tabular-nums font-medium text-sm">
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
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
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
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // Apply column-level filters directly
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
        <Select
          value={statusFilter}
          onValueChange={handleStatusFilterChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="PENDING">
              {STATUS_LABELS["PENDING"]}
            </SelectItem>
            <SelectItem value="SENT">{STATUS_LABELS["SENT"]}</SelectItem>
            <SelectItem value="PAID">{STATUS_LABELS["PAID"]}</SelectItem>
            <SelectItem value="OVERDUE">
              {STATUS_LABELS["OVERDUE"]}
            </SelectItem>
            <SelectItem value="CANCELLED">
              {STATUS_LABELS["CANCELLED"]}
            </SelectItem>
            <SelectItem value="PARTIAL">
              {STATUS_LABELS["PARTIAL"]}
            </SelectItem>
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
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
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
      </p>
    </div>
  )
}
