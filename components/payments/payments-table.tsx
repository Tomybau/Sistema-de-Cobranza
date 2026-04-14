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
import type { PaymentSummary } from "@/domain/payments/queries"

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Transferencia",
  CHECK: "Cheque",
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta",
  OTHER: "Otro",
}

const STATUS_LABELS: Record<string, string> = {
  PROCESSED: "Procesado",
  CANCELLED: "Cancelado",
}

interface PaymentsTableProps {
  data: PaymentSummary[]
}

export function PaymentsTable({ data }: PaymentsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "paymentDate", desc: true },
  ])
  const [companyFilter, setCompanyFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const columns = useMemo<ColumnDef<PaymentSummary>[]>(
    () => [
      {
        accessorKey: "paymentNumber",
        header: "Comprobante",
        cell: ({ row }) => (
          <Link
            href={`/payments/${row.original.id}`}
            className="font-mono text-xs hover:underline"
          >
            {row.getValue("paymentNumber")}
          </Link>
        ),
      },
      {
        accessorKey: "paymentDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Fecha
            <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ getValue }) =>
          format(new Date(getValue() as string | Date), "dd MMM yyyy", { locale: es }),
      },
      {
        accessorKey: "company.legalName",
        id: "company",
        header: "Empresa",
        cell: ({ row }) => (
          <Link
            href={`/companies/${row.original.companyId}`}
            className="hover:underline text-sm"
          >
            {row.original.company.legalName}
          </Link>
        ),
      },
      {
        accessorKey: "client.fullName",
        id: "client",
        header: "Cliente",
        cell: ({ row }) => <span className="text-sm">{row.original.client.fullName}</span>,
      },
      {
        accessorKey: "grossAmount",
        header: () => <span className="block text-right">Monto</span>,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums font-medium text-sm">
            {formatMoney(row.getValue("grossAmount"), row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "method",
        header: "Método",
        cell: ({ getValue }) => (
          <span className="text-sm">
            {METHOD_LABELS[String(getValue())] ?? String(getValue())}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        filterFn: "equals",
        cell: ({ getValue }) => {
          const status = String(getValue())
          return (
            <Badge variant={status === "PROCESSED" ? "default" : "outline"}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          )
        },
      },
      {
        accessorKey: "_count.tickets",
        header: () => <span className="block text-center">Tks</span>,
        cell: ({ row }) => (
          <span className="block text-center text-sm font-medium">
            {row.original._count.tickets}
          </span>
        ),
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
    // Note: not currently used extensively but available
  }

  const handleStatusFilterChange = (value: string | null) => {
    setStatusFilter(value ?? "")
  }

  // Basic manual global filter on company
  const filteredRows = useMemo(() => {
    let rows = table.getRowModel().rows
    
    if (companyFilter) {
      const lower = companyFilter.toLowerCase()
      rows = rows.filter(r => 
        r.original.company.legalName.toLowerCase().includes(lower) || 
        r.original.paymentNumber.toLowerCase().includes(lower)
      )
    }

    if (statusFilter) {
      rows = rows.filter(r => r.original.status === statusFilter)
    }

    return rows
  }, [table.getRowModel().rows, companyFilter, statusFilter])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Buscar empresa o recibo..."
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
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
            <SelectItem value="PROCESSED">{STATUS_LABELS["PROCESSED"]}</SelectItem>
            <SelectItem value="CANCELLED">{STATUS_LABELS["CANCELLED"]}</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => (
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
                  No hay pagos registrados con estos filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {filteredRows.length} pago{filteredRows.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
