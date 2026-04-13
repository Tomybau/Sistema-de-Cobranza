"use client"

import { useState, useTransition, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  contractItemFlatSchema,
  type ContractItemFlatValues,
} from "@/domain/contract_items/schemas"
import {
  addContractItemAction,
  updateContractItemAction,
} from "@/app/(dashboard)/contracts/[id]/actions"
import type { ContractDetail } from "@/domain/contracts/queries"

type ContractItem = ContractDetail["items"][number]

const TYPE_LABELS = {
  RECURRING_FIXED: "Recurrente — monto fijo",
  RECURRING_VARIABLE: "Recurrente — tabla de precios",
  ONE_TIME: "Cargo único",
  INSTALLMENT: "Plan de cuotas",
}

interface ContractItemDrawerProps {
  contractId: string
  pricingTables: { id: string; name: string }[]
  editItem?: ContractItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContractItemDrawer({
  contractId,
  pricingTables,
  editItem,
  open,
  onOpenChange,
}: ContractItemDrawerProps) {
  const [isPending, startTransition] = useTransition()
  const isEditing = !!editItem

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ContractItemFlatValues>({
    resolver: zodResolver(contractItemFlatSchema),
    defaultValues: buildDefaults(editItem),
  })

  const itemType = watch("type")

  // Sync defaults when editItem changes
  useEffect(() => {
    reset(buildDefaults(editItem))
  }, [editItem, reset])

  function onSubmit(values: ContractItemFlatValues) {
    startTransition(async () => {
      const result = isEditing
        ? await updateContractItemAction(contractId, editItem!.id, values)
        : await addContractItemAction(contractId, values)

      if (!result.success) {
        toast.error(result.error)
      } else {
        toast.success(
          isEditing ? "Item actualizado" : "Item agregado al contrato"
        )
        onOpenChange(false)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Editar item" : "Agregar item al contrato"}
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 mt-4 pr-1"
        >
          {/* Tipo */}
          <div className="space-y-2">
            <Label>
              Tipo <span className="text-destructive">*</span>
            </Label>
            <Select
              value={itemType ?? "RECURRING_FIXED"}
              onValueChange={(v) =>
                v != null && setValue("type", v as ContractItemFlatValues["type"])
              }
              disabled={isPending || isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val} label={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                El tipo no se puede cambiar una vez creado el item.
              </p>
            )}
          </div>

          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="item-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="item-name"
              placeholder="Ej: Soporte mensual"
              disabled={isPending}
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="item-description">Descripción</Label>
            <Textarea
              id="item-description"
              rows={2}
              disabled={isPending}
              {...register("description")}
            />
          </div>

          {/* Campos condicionales por tipo */}
          {itemType === "RECURRING_FIXED" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fixedAmount">
                  Monto fijo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fixedAmount"
                  placeholder="1500.00"
                  disabled={isPending}
                  {...register("fixedAmount")}
                  aria-invalid={!!errors.fixedAmount}
                />
                {errors.fixedAmount && (
                  <p className="text-sm text-destructive">
                    {errors.fixedAmount.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingDayOfMonth">
                  Día de facturación (1-28){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="billingDayOfMonth"
                  type="number"
                  min={1}
                  max={28}
                  disabled={isPending}
                  {...register("billingDayOfMonth", { valueAsNumber: true })}
                  aria-invalid={!!errors.billingDayOfMonth}
                />
                {errors.billingDayOfMonth && (
                  <p className="text-sm text-destructive">
                    {errors.billingDayOfMonth.message}
                  </p>
                )}
              </div>
            </>
          )}

          {itemType === "RECURRING_VARIABLE" && (
            <>
              <div className="space-y-2">
                <Label>
                  Tabla de precios <span className="text-destructive">*</span>
                </Label>
                <Select
                  defaultValue={editItem?.pricingTableId ?? ""}
                  onValueChange={(v) => v != null && setValue("pricingTableId", v)}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná una tabla" />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingTables.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id} label={pt.name}>
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pricingTables.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay tablas para este contrato.{" "}
                    <a
                      href={`/pricing-tables/new?contractId=${contractId}`}
                      className="underline"
                    >
                      Crear tabla de precios
                    </a>
                    .
                  </p>
                )}
                {errors.pricingTableId && (
                  <p className="text-sm text-destructive">
                    {errors.pricingTableId.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingDayOfMonth-var">
                  Día de facturación (1-28){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="billingDayOfMonth-var"
                  type="number"
                  min={1}
                  max={28}
                  disabled={isPending}
                  {...register("billingDayOfMonth", { valueAsNumber: true })}
                  aria-invalid={!!errors.billingDayOfMonth}
                />
                {errors.billingDayOfMonth && (
                  <p className="text-sm text-destructive">
                    {errors.billingDayOfMonth.message}
                  </p>
                )}
              </div>
            </>
          )}

          {itemType === "ONE_TIME" && (
            <div className="space-y-2">
              <Label htmlFor="totalAmount">
                Monto total <span className="text-destructive">*</span>
              </Label>
              <Input
                id="totalAmount"
                placeholder="5000.00"
                disabled={isPending}
                {...register("totalAmount")}
                aria-invalid={!!errors.totalAmount}
              />
              {errors.totalAmount && (
                <p className="text-sm text-destructive">
                  {errors.totalAmount.message}
                </p>
              )}
            </div>
          )}

          {itemType === "INSTALLMENT" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="totalAmount-inst">
                  Monto total <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="totalAmount-inst"
                  placeholder="9000.00"
                  disabled={isPending}
                  {...register("totalAmount")}
                  aria-invalid={!!errors.totalAmount}
                />
                {errors.totalAmount && (
                  <p className="text-sm text-destructive">
                    {errors.totalAmount.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="installments">
                  Cantidad de cuotas (2-60){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="installments"
                  type="number"
                  min={2}
                  max={60}
                  disabled={isPending}
                  {...register("installments", { valueAsNumber: true })}
                  aria-invalid={!!errors.installments}
                />
                {errors.installments && (
                  <p className="text-sm text-destructive">
                    {errors.installments.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingDayOfMonth-inst">
                  Día de facturación (1-28){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="billingDayOfMonth-inst"
                  type="number"
                  min={1}
                  max={28}
                  disabled={isPending}
                  {...register("billingDayOfMonth", { valueAsNumber: true })}
                  aria-invalid={!!errors.billingDayOfMonth}
                />
                {errors.billingDayOfMonth && (
                  <p className="text-sm text-destructive">
                    {errors.billingDayOfMonth.message}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Fechas opcionales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-startDate">Inicio (opt.)</Label>
              <Input
                id="item-startDate"
                type="date"
                disabled={isPending}
                {...register("startDate")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-endDate">Fin (opt.)</Label>
              <Input
                id="item-endDate"
                type="date"
                disabled={isPending}
                {...register("endDate")}
              />
            </div>
          </div>

          {/* Activo */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="item-isActive"
              defaultChecked={editItem?.isActive ?? true}
              onCheckedChange={(checked) =>
                setValue("isActive", checked === true)
              }
              disabled={isPending}
            />
            <Label htmlFor="item-isActive">Activo</Label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Guardar cambios" : "Agregar item"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function buildDefaults(editItem?: ContractItem): ContractItemFlatValues {
  if (!editItem) {
    return {
      type: "RECURRING_FIXED",
      name: "",
      description: "",
      isActive: true,
      startDate: "",
      endDate: "",
      fixedAmount: "",
      billingDayOfMonth: 1,
      pricingTableId: "",
      totalAmount: "",
      installments: 2,
    }
  }
  return {
    type: editItem.type,
    name: editItem.name,
    description: editItem.description ?? "",
    isActive: editItem.isActive,
    startDate: toDateInput(editItem.startDate),
    endDate: toDateInput(editItem.endDate),
    fixedAmount: editItem.fixedAmount?.toString() ?? "",
    billingDayOfMonth: editItem.billingDayOfMonth ?? 1,
    pricingTableId: editItem.pricingTableId ?? "",
    totalAmount: editItem.totalAmount?.toString() ?? "",
    installments: editItem.installments ?? 2,
  }
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return ""
  return new Date(d).toISOString().split("T")[0]
}
