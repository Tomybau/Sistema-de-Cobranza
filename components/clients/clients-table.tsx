"use client"

import { useMemo, useTransition } from "react"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { MoreHorizontal, Pencil, Trash2, Star } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  softDeleteClientAction,
  setPrimaryClientAction,
} from "@/app/(dashboard)/companies/[id]/clients/actions"
import type { Client } from "@prisma/client"

interface ClientsTableProps {
  data: Client[]
  companyId: string
}

function RowActions({
  client,
  companyId,
}: {
  client: Client
  companyId: string
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSetPrimary() {
    startTransition(async () => {
      const result = await setPrimaryClientAction(client.id, companyId)
      if (result.success) toast.success(result.message)
      else toast.error(result.error)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await softDeleteClientAction(client.id, companyId)
      if (result.success) toast.success(result.message ?? "Contacto eliminado")
      else toast.error(result.error)
      setDeleteOpen(false)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Acciones</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/companies/${companyId}/clients/${client.id}/edit`} />}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          {!client.isPrimary && (
            <DropdownMenuItem onClick={handleSetPrimary} disabled={isPending}>
              <Star className="mr-2 h-4 w-4" />
              Establecer como principal
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {client.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará el contacto de la empresa.
              {client.isPrimary &&
                " Como es el contacto principal, la empresa quedará sin contacto principal asignado."}
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

export function ClientsTable({ data, companyId }: ClientsTableProps) {
  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Nombre",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.fullName}</span>
            {row.original.isPrimary && (
              <Badge variant="default" className="text-xs py-0">
                Principal
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Rol",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">
            {String(getValue() ?? "—")}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => (
          <a
            href={`mailto:${getValue()}`}
            className="text-sm hover:underline"
          >
            {String(getValue())}
          </a>
        ),
      },
      {
        accessorKey: "phone",
        header: "Teléfono",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {String(getValue() ?? "—")}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Creado",
        cell: ({ getValue }) =>
          format(new Date(getValue() as string), "dd MMM yyyy", { locale: es }),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <RowActions client={row.original} companyId={companyId} />
        ),
      },
    ],
    [companyId]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No hay contactos registrados para esta empresa.
        </p>
      </div>
    )
  }

  return (
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
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
