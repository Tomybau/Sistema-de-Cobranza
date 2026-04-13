"use client"

import { useMemo, useState, useTransition } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { PricingTableListItem } from "@/domain/pricing_tables/queries"
import { deletePricingTableAction } from "@/app/(dashboard)/pricing-tables/actions"

interface PricingTablesTableProps {
  data: PricingTableListItem[]
}

export function PricingTablesTable({ data }: PricingTablesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const columns = useMemo<ColumnDef<PricingTableListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Nombre
            <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/pricing-tables/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.getValue("name")}
          </Link>
        ),
      },
      {
        accessorKey: "description",
        header: "Descripción",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">
            {String(getValue() ?? "—")}
          </span>
        ),
      },
      {
        id: "tiersCount",
        header: "Rangos",
        accessorFn: (row) => row.tiers.length,
        cell: ({ getValue }) => (
          <span className="text-sm">{String(getValue())}</span>
        ),
      },
      {
        id: "itemsCount",
        header: "Items vinculados",
        accessorFn: (row) => row._count.items,
        cell: ({ getValue }) => (
          <span className="text-sm">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Creada",
        cell: ({ getValue }) =>
          format(new Date(getValue() as string), "dd MMM yyyy", { locale: es }),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/pricing-tables/${row.original.id}`}>Ver</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/pricing-tables/${row.original.id}/edit`}>
                  Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteId(row.original.id)}
              >
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
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

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      const result = await deletePricingTableAction(deleteId)
      if (!result.success) {
        toast.error(result.error)
      }
      setDeleteId(null)
    })
  }

  return (
    <>
      <div className="space-y-3">
        <Input
          placeholder="Buscar tablas..."
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
                      : "No hay tablas de precios registradas."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} tabla
          {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
        </p>
      </div>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tabla de precios?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente y no se puede deshacer. Si la tabla está
              en uso por algún item de contrato, la eliminación será rechazada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
