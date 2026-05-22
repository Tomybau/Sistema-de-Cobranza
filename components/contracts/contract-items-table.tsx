"use client"

import { useState, useTransition } from "react"
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from "lucide-react"
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
import { PricingTableView } from "@/components/pricing-tables/pricing-table-view"
import {
  deleteContractItemAction,
  toggleContractItemActiveAction,
} from "@/app/(dashboard)/contracts/[id]/actions"
import { formatMoney } from "@/lib/money"
import { ITEM_TYPE_LABELS } from "@/lib/item-type-labels"
import type { ContractDetail } from "@/domain/contracts/queries"
import { cn } from "@/lib/utils"

type ContractItem = ContractDetail["items"][number]

const TYPE_LABELS = ITEM_TYPE_LABELS

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
}

export function ContractItemsTable({
  contractId,
  items,
  currency,
}: ContractItemsTableProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editItem, setEditItem] = useState<ContractItem | undefined>()
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  function hasDetails(item: ContractItem): boolean {
    return (
      !!item.description ||
      !!item.pricingTable ||
      item.type === "INSTALLMENT" ||
      !!item.startDate ||
      !!item.endDate ||
      !!item.breakdownNote
    )
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Items ({items.length})
          </h2>
          <Button size="sm" onClick={handleAdd} data-tour="add-item">
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar item
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Tipo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Monto / Pricing</TableHead>
                <TableHead className="hidden md:table-cell">Día facturación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => {
                  const isExpanded = expanded.has(item.id)
                  const canExpand = hasDetails(item)
                  return (
                    <>
                      <TableRow
                        key={item.id}
                        className={cn(
                          !item.isActive ? "opacity-60" : "",
                          canExpand ? "cursor-pointer" : "",
                          "hover:bg-muted/50"
                        )}
                        onClick={canExpand ? () => toggleExpand(item.id) : undefined}
                      >
                        <TableCell className="w-10">
                          {canExpand ? (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={TYPE_COLORS[item.type] ?? "outline"}>
                            {TYPE_LABELS[item.type] ?? item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm">
                          {renderAmount(item)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                          {item.billingDayOfMonth
                            ? `Día ${item.billingDayOfMonth}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.isActive ? "default" : "secondary"}>
                            {item.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
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
                      {isExpanded && canExpand && (
                        <TableRow
                          key={`${item.id}-expanded`}
                          className="bg-muted/20 hover:bg-muted/20"
                        >
                          <TableCell colSpan={7} className="py-4">
                            <ItemDetails item={item} currency={currency} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
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

// ─── Item details sub-row ───────────────────────────────────────────────────

interface InstallmentPlanEntry {
  label: string
  percentage: number
}

function ItemDetails({ item, currency }: { item: ContractItem; currency: string }) {
  const totalAmount = item.totalAmount ? parseFloat(item.totalAmount) : 0

  return (
    <div className="space-y-3 px-2">
      {item.description && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Descripción
          </p>
          <p className="text-sm">{item.description}</p>
        </div>
      )}

      {item.breakdownNote && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Desglose
          </p>
          <p className="text-sm">{item.breakdownNote}</p>
        </div>
      )}

      {(item.startDate || item.endDate) && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Vigencia
          </p>
          <p className="text-sm">
            {item.startDate
              ? `Desde ${new Date(item.startDate).toLocaleDateString("es-AR")}`
              : "Sin inicio"}
            {" — "}
            {item.endDate
              ? `hasta ${new Date(item.endDate).toLocaleDateString("es-AR")}`
              : "sin fin"}
          </p>
        </div>
      )}

      {item.pricingTable && item.pricingTable.tiers.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Tabla de precios — {item.pricingTable.name}
          </p>
          <PricingTableView tiers={item.pricingTable.tiers} currency={currency} />
        </div>
      )}

      {item.type === "INSTALLMENT" && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Plan de cuotas
          </p>
          {renderInstallmentPlan(item, totalAmount, currency)}
        </div>
      )}
    </div>
  )
}

function renderInstallmentPlan(
  item: ContractItem,
  totalAmount: number,
  currency: string
) {
  const plan = (item as { installmentPlan?: unknown }).installmentPlan
  const installments = item.installments ?? 0

  if (Array.isArray(plan) && plan.length > 0) {
    return (
      <div className="rounded-md border overflow-hidden text-sm">
        <table className="w-full">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">#</th>
              <th className="text-left px-3 py-1.5 font-medium">Hito</th>
              <th className="text-right px-3 py-1.5 font-medium">%</th>
              <th className="text-right px-3 py-1.5 font-medium">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(plan as InstallmentPlanEntry[]).map((entry, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-1.5">{entry.label}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{entry.percentage}%</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                  {formatMoney((totalAmount * entry.percentage) / 100, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (installments > 0) {
    const each = totalAmount / installments
    return (
      <p className="text-sm">
        {installments} cuotas iguales de{" "}
        <span className="font-medium">{formatMoney(each, currency)}</span>
      </p>
    )
  }

  return <p className="text-sm text-muted-foreground">—</p>
}
