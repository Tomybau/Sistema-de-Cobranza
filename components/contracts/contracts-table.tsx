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
import { ArrowUpDown, Plus } from "lucide-react"
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
import type { ContractListItem } from "@/domain/contracts/queries"

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  ENDED: "Finalizado",
  CANCELLED: "Cancelado",
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  SUSPENDED: "outline",
  ENDED: "outline",
  CANCELLED: "destructive",
}

interface ContractsTableProps {
  data: ContractListItem[]
  showCompany?: boolean
  newHref?: string
}

export function ContractsTable({
  data,
  showCompany = true,
  newHref = "/contracts/new",
}: ContractsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  const columns = useMemo<ColumnDef<ContractListItem>[]>(() => {
    const cols: ColumnDef<ContractListItem>[] = [
      {
        accessorKey: "contractNumber",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Nro.
            <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/contracts/${row.original.id}`}
            className="font-mono font-medium hover:underline text-sm"
          >
            {row.getValue("contractNumber")}
          </Link>
        ),
      },
      ...(showCompany
        ? [
            {
              id: "company",
              header: "Empresa",
              accessorFn: (row: ContractListItem) => row.company.legalName,
              cell: ({ row }: { row: { original: ContractListItem } }) => (
                <Link
                  href={`/companies/${row.original.company.id}`}
                  className="hover:underline text-sm"
                >
                  {row.original.company.legalName}
                </Link>
              ),
            } as ColumnDef<ContractListItem>,
          ]
        : []),
      {
        accessorKey: "title",
        header: "Título",
        cell: ({ getValue }) => (
          <span className="text-sm">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ getValue }) => {
          const status = String(getValue())
          return (
            <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          )
        },
      },
      {
        accessorKey: "startDate",
        header: "Inicio",
        cell: ({ getValue }) =>
          format(new Date(getValue() as string), "dd MMM yyyy", { locale: es }),
      },
      {
        accessorKey: "endDate",
        header: "Fin",
        cell: ({ getValue }) => {
          const v = getValue()
          if (!v) return <span className="text-muted-foreground">—</span>
          return format(new Date(v as string), "dd MMM yyyy", { locale: es })
        },
      },
      {
        id: "itemsCount",
        header: "Items",
        accessorFn: (row) => row._count.items,
        cell: ({ getValue }) => (
          <Badge variant="secondary">{String(getValue())}</Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Creado",
        cell: ({ getValue }) =>
          format(new Date(getValue() as string), "dd MMM yyyy", { locale: es }),
      },
    ]
    return cols
  }, [showCompany])

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
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Buscar contratos..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <Button size="sm" asChild>
          <Link href={newHref}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo contrato
          </Link>
        </Button>
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
                    : "No hay contratos registrados."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} contrato
        {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
