"use client"

import { useState, useTransition } from "react"
import { MoreHorizontal, Plus } from "lucide-react"
import { toast } from "sonner"
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
import { Badge } from "@/components/ui/badge"
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
import { ContractItemDrawer } from "./contract-item-drawer"
import {
  deleteContractItemAction,
  toggleContractItemActiveAction,
} from "@/app/(dashboard)/contracts/[id]/actions"
import { formatMoney } from "@/lib/money"
import type { ContractDetail } from "@/domain/contracts/queries"

type ContractItem = ContractDetail["items"][number]

const TYPE_LABELS: Record<string, string> = {
  RECURRING_FIXED: "Fijo",
  RECURRING_VARIABLE: "Variable",
  ONE_TIME: "Único",
  INSTALLMENT: "Cuotas",
}

const TYPE_COLORS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  RECURRING_FIXED: "default",
  RECURRING_VARIABLE: "secondary",
  ONE_TIME: "outline",
  INSTALLMENT: "outline",
}

interface ContractItemsTableProps {
  contractId: string
  items: ContractItem[]
  currency: string
  pricingTables: { id: string; name: string }[]
}

export function ContractItemsTable({
  contractId,
  items,
  currency,
  pricingTables,
}: ContractItemsTableProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editItem, setEditItem] = useState<ContractItem | undefined>()
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleEdit(item: ContractItem) {
    setEditItem(item)
    setDrawerOpen(true)
  }

  function handleAdd() {
    setEditItem(undefined)
    setDrawerOpen(true)
  }

  function handleToggle(itemId: string) {
    startTransition(async () => {
      const result = await toggleContractItemActiveAction(contractId, itemId)
      if (!result.success) {
        toast.error(result.error)
      }
    })
  }

  function handleDelete() {
    if (!deleteItemId) return
    startTransition(async () => {
      const result = await deleteContractItemAction(contractId, deleteItemId)
      if (!result.success) {
        toast.error(result.error)
      } else {
        toast.success("Item eliminado")
      }
      setDeleteItemId(null)
    })
  }

  function renderAmount(item: ContractItem): string {
    switch (item.type) {
      case "RECURRING_FIXED":
        return item.fixedAmount
          ? `${formatMoney(item.fixedAmount, currency)} / mes`
          : "—"
      case "RECURRING_VARIABLE":
        return item.pricingTable
          ? `Tabla: ${item.pricingTable.name}`
          : "Sin tabla"
      case "ONE_TIME":
        return item.totalAmount ? formatMoney(item.totalAmount, currency) : "—"
      case "INSTALLMENT":
        return item.totalAmount && item.installments
          ? `${formatMoney(item.totalAmount, currency)} en ${item.installments} cuotas`
          : "—"
      default:
        return "—"
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Items ({items.length})
          </h2>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar item
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Monto / Pricing</TableHead>
                <TableHead>Día facturación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => (
                  <TableRow
                    key={item.id}
                    className={
                      !item.isActive ? "opacity-60 hover:bg-muted/50" : "hover:bg-muted/50"
                    }
                  >
                    <TableCell>
                      <Badge variant={TYPE_COLORS[item.type] ?? "outline"}>
                        {TYPE_LABELS[item.type] ?? item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm">
                      {renderAmount(item)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.billingDayOfMonth
                        ? `Día ${item.billingDayOfMonth}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? "default" : "secondary"}>
                        {item.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(item.id)}>
                            {item.isActive ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteItemId(item.id)}
                          >
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-20 text-center text-muted-foreground text-sm"
                  >
                    Sin items. Agregá el primero con el botón de arriba.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ContractItemDrawer
        contractId={contractId}
        pricingTables={pricingTables}
        editItem={editItem}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) setEditItem(undefined)
        }}
      />

      <AlertDialog
        open={!!deleteItemId}
        onOpenChange={(open) => !open && setDeleteItemId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este item?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente. Si el item tiene tickets de cobro
              asociados, la eliminación será rechazada.
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
