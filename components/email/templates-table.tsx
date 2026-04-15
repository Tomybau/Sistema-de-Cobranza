"use client"

import { useMemo, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowUpDown, Edit, Trash } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { deleteEmailTemplateAction, setDefaultTemplateAction } from "@/app/actions/email-templates"

interface TemplatesTableProps {
  data: any[] // From getEmailTemplates
}

export function TemplatesTable({ data }: TemplatesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "company_legalName", desc: false },
    { id: "name", desc: false },
  ])
  const [filter, setFilter] = useState("")

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro de que desea eliminar este template?")) return
    const res = await deleteEmailTemplateAction(id)
    if (res.success) {
      toast.success("Template eliminado")
    } else {
      toast.error(res.error)
    }
  }

  const handleSetDefault = async (id: string, companyId: string) => {
    const res = await setDefaultTemplateAction(id, companyId)
    if (res.success) {
      toast.success("Establecido como default")
    } else {
      toast.error(res.error)
    }
  }

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nombre",
        cell: ({ row }) => (
          <span className="font-medium text-sm">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "company.legalName",
        id: "company_legalName",
        header: "Empresa",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.company.legalName}</span>
        ),
      },
      {
        accessorKey: "subject",
        header: "Asunto (Subject)",
        cell: ({ getValue }) => {
          const val = String(getValue())
          return <span className="text-muted-foreground text-xs truncate max-w-[200px] block">{val}</span>
        },
      },
      {
        accessorKey: "isDefault",
        header: "Por Defecto",
        cell: ({ row }) => (
          row.original.isDefault ? <Badge variant="secondary">Default</Badge> : null
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Creado",
        cell: ({ getValue }) =>
          format(new Date(getValue() as string | Date), "dd MMM yyyy", { locale: es }),
      },
      {
        id: "actions",
        header: () => <span className="block text-right">Acciones</span>,
        cell: ({ row }) => {
          return (
            <div className="flex items-center justify-end gap-2">
              {!row.original.isDefault && (
                <Button 
                  variant="outline" 
                  size="sm"
                  title="Establecer como default"
                  onClick={() => handleSetDefault(row.original.id, row.original.companyId)}
                >
                  Set Default
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href={`/email-templates/${row.original.id}/edit`}>
                  <Edit className="h-4 w-4" />
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(row.original.id)}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
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
  })

  const filteredRows = useMemo(() => {
    let rows = table.getRowModel().rows
    if (filter) {
      const lower = filter.toLowerCase()
      rows = rows.filter(r => 
        r.original.name.toLowerCase().includes(lower) || 
        r.original.company.legalName.toLowerCase().includes(lower)
      )
    }
    return rows
  }, [table.getRowModel().rows, filter])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Buscar por nombre o empresa..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="rounded-md border bg-card">
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
                <TableRow key={row.id}>
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
                  No hay templates registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground mr-2 text-right">
        {filteredRows.length} template(s)
      </p>
    </div>
  )
}
