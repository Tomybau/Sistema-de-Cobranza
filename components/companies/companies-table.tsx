"use client"

import { useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { useState } from "react"
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
import type { CompanyWithKpis } from "@/domain/companies/queries"
import { formatMoney } from "@/lib/money"

interface CompaniesTableProps {
  data: CompanyWithKpis[]
}

export function CompaniesTable({ data }: CompaniesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  const columns = useMemo<ColumnDef<CompanyWithKpis>[]>(
    () => [
      {
        accessorKey: "legalName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Razón social
            <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/companies/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.getValue("legalName")}
          </Link>
        ),
      },
      {
        accessorKey: "tradeName",
        header: "Nombre comercial",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{String(getValue() ?? "—")}</span>
        ),
      },
      {
        accessorKey: "taxId",
        header: "CUIT",
        cell: ({ getValue }) => (
          <span className="mono text-sm text-muted-foreground">{String(getValue() ?? "—")}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">{String(getValue() ?? "—")}</span>
        ),
      },
      {
        id: "contractsCount",
        header: "Contratos",
        accessorFn: (row) => row._count.contracts,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original._count.contracts} · {row.original._count.clients} contacto
            {row.original._count.clients !== 1 ? "s" : ""}
          </span>
        ),
      },
      {
        id: "totalBilled",
        header: () => <span className="block text-right">Facturado</span>,
        accessorFn: (row) => row.kpis.totalBilled,
        cell: ({ row }) => (
          <span className="block text-right text-sm tabular-nums">
            {formatMoney(row.original.kpis.totalBilled, "USD")}
          </span>
        ),
      },
      {
        id: "totalCollected",
        header: () => <span className="block text-right">Cobrado</span>,
        accessorFn: (row) => row.kpis.totalCollected,
        cell: ({ row }) => (
          <span className="block text-right text-sm tabular-nums text-ok">
            {formatMoney(row.original.kpis.totalCollected, "USD")}
          </span>
        ),
      },
      {
        id: "overdueAmount",
        header: () => <span className="block text-right">Mora</span>,
        accessorFn: (row) => row.kpis.overdueAmount,
        cell: ({ row }) => {
          const k = row.original.kpis
          if (k.overdueCount === 0) {
            return <span className="block text-right text-sm text-muted-foreground">—</span>
          }
          return (
            <span className="block text-right text-sm tabular-nums text-bad">
              {formatMoney(k.overdueAmount, "USD")}
              <span className="block text-[10px] font-normal">
                {k.overdueCount} ticket{k.overdueCount !== 1 ? "s" : ""}
              </span>
            </span>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar empresas..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-xs"
      />
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
                  {globalFilter
                    ? "No hay resultados para esa búsqueda."
                    : "No hay empresas registradas."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} empresa
        {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
