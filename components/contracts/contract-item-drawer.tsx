"use client"

import { useState, useTransition, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2 } from "lucide-react"
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
import { cn } from "@/lib/utils"

type ContractItem = ContractDetail["items"][number]

interface PlanEntry {
  label: string
  percentage: number | ""
}

interface TierEntry {
  fromQuantity: string
  toQuantity: string
  unitPrice: string
  flatFee: string
}

const TYPE_LABELS = {
  RECURRING_FIXED: "Recurrente — monto fijo",
  RECURRING_VARIABLE: "Recurrente — tabla de precios",
  ONE_TIME: "Cargo único",
  INSTALLMENT: "Plan de cuotas",
}

interface ContractItemDrawerProps {
  contractId: string
  editItem?: ContractItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContractItemDrawer({
  contractId,
  editItem,
  open,
  onOpenChange,
}: ContractItemDrawerProps) {
  const [isPending, startTransition] = useTransition()
  const isEditing = !!editItem

  const [customPlanEnabled, setCustomPlanEnabled] = useState(false)
  const [planEntries, setPlanEntries] = useState<PlanEntry[]>([])
  const [tiers, setTiers] = useState<TierEntry[]>([])
  const [pricingTableName, setPricingTableName] = useState<string>("")

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
  const watchedInstallments = watch("installments") ?? 2
  const watchedTotalAmount = watch("totalAmount") ?? ""

  // Sync defaults when editItem changes
  useEffect(() => {
    reset(buildDefaults(editItem))
    const existingPlan = getExistingPlan(editItem)
    if (existingPlan) {
      setCustomPlanEnabled(true)
      setPlanEntries(existingPlan)
    } else {
      setCustomPlanEnabled(false)
      setPlanEntries([])
    }
    setTiers(getExistingTiers(editItem))
    setPricingTableName(editItem?.pricingTable?.name ?? "")
  }, [editItem, reset])

  // Resize plan entries when installments count changes
  useEffect(() => {
    if (!customPlanEnabled) return
    const n = Math.max(2, Math.min(60, Number(watchedInstallments) || 2))
    setPlanEntries((prev) => {
      if (prev.length === n) return prev
      if (prev.length < n) {
        return [
          ...prev,
          ...Array.from({ length: n - prev.length }, () => ({ label: "", percentage: "" as const })),
        ]
      }
      return prev.slice(0, n)
    })
  }, [watchedInstallments, customPlanEnabled])

  // When type changes to VARIABLE, initialize one empty tier if empty
  useEffect(() => {
    if (itemType === "RECURRING_VARIABLE" && tiers.length === 0) {
      setTiers([{ fromQuantity: "0", toQuantity: "", unitPrice: "0", flatFee: "" }])
    }
  }, [itemType, tiers.length])

  function handleToggleCustomPlan(enabled: boolean) {
    setCustomPlanEnabled(enabled)
    if (enabled) {
      const n = Math.max(2, Math.min(60, Number(watchedInstallments) || 2))
      setPlanEntries((prev) =>
        prev.length === n
          ? prev
          : Array.from({ length: n }, (_, i) => prev[i] ?? { label: "", percentage: "" as const })
      )
    }
  }

  function updatePlanEntry(index: number, field: keyof PlanEntry, value: string) {
    setPlanEntries((prev) =>
      prev.map((entry, i) =>
        i === index
          ? { ...entry, [field]: field === "percentage" ? (value === "" ? "" : Number(value)) : value }
          : entry
      )
    )
  }

  function updateTier(index: number, field: keyof TierEntry, value: string) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  function addTier() {
    setTiers((prev) => [...prev, { fromQuantity: "", toQuantity: "", unitPrice: "", flatFee: "" }])
  }

  function removeTier(index: number) {
    setTiers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const sumPercentages = planEntries.reduce(
    (acc, e) => acc + (typeof e.percentage === "number" ? e.percentage : 0),
    0
  )
  const planValid = !customPlanEnabled || (sumPercentages === 100 && planEntries.every((e) => e.label.trim()))

  const tiersValid =
    itemType !== "RECURRING_VARIABLE" ||
    (tiers.length > 0 && tiers.every((t) => t.fromQuantity !== "" && t.unitPrice !== ""))

  function calcAmount(pct: number | ""): string {
    const total = parseFloat(watchedTotalAmount)
    if (!total || typeof pct !== "number" || pct <= 0) return "—"
    return (total * pct / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function onSubmit(values: ContractItemFlatValues) {
    if (!planValid) {
      toast.error("La suma de porcentajes debe ser 100% y todos los hitos deben tener nombre.")
      return
    }
    if (!tiersValid) {
      toast.error("Completá los rangos de la tabla de precios.")
      return
    }

    const finalValues: ContractItemFlatValues = {
      ...values,
      pricingTableName: pricingTableName.trim() || undefined,
      pricingTiers:
        values.type === "RECURRING_VARIABLE"
          ? tiers.map((t) => ({
              fromQuantity: t.fromQuantity,
              toQuantity: t.toQuantity === "" ? undefined : t.toQuantity,
              unitPrice: t.unitPrice,
              flatFee: t.flatFee === "" ? undefined : t.flatFee,
            }))
          : undefined,
      installmentPlan:
        customPlanEnabled && planEntries.length > 0
          ? planEntries.map((e) => ({ label: e.label, percentage: Number(e.percentage) }))
          : null,
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateContractItemAction(contractId, editItem!.id, finalValues)
        : await addContractItemAction(contractId, finalValues)

      if (!result.success) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? "Item actualizado" : "Item agregado al contrato")
        onOpenChange(false)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>
            {isEditing ? "Editar item" : "Agregar item al contrato"}
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
              items={TYPE_LABELS}
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

          {/* ── Campos por tipo ── */}

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
                  <p className="text-sm text-destructive">{errors.fixedAmount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingDayOfMonth">
                  Día de facturación (1-28) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="billingDayOfMonth"
                  type="number"
                  min={1}
                  max={28}
                  disabled={isPending}
                  {...register("billingDayOfMonth", { valueAsNumber: true })}
                />
              </div>
            </>
          )}

          {itemType === "RECURRING_VARIABLE" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pricingTableName">
                  Nombre de la tabla (opcional)
                </Label>
                <Input
                  id="pricingTableName"
                  placeholder={`Tabla — ${watch("name") || "este item"}`}
                  value={pricingTableName}
                  onChange={(e) => setPricingTableName(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    Rangos de precio <span className="text-destructive">*</span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={addTier}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Rango
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_2rem] gap-2 text-xs text-muted-foreground pb-1">
                  <span>Desde</span>
                  <span>Hasta</span>
                  <span>Precio unit.</span>
                  <span>Fee fijo</span>
                  <span />
                </div>
                {tiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_1fr_1fr_1fr_2rem] gap-2 items-center"
                  >
                    <Input
                      placeholder="0"
                      value={tier.fromQuantity}
                      onChange={(e) => updateTier(idx, "fromQuantity", e.target.value)}
                      disabled={isPending}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="∞"
                      value={tier.toQuantity}
                      onChange={(e) => updateTier(idx, "toQuantity", e.target.value)}
                      disabled={isPending}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="0.00"
                      value={tier.unitPrice}
                      onChange={(e) => updateTier(idx, "unitPrice", e.target.value)}
                      disabled={isPending}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="0.00"
                      value={tier.flatFee}
                      onChange={(e) => updateTier(idx, "flatFee", e.target.value)}
                      disabled={isPending}
                      className="h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isPending || tiers.length === 1}
                      onClick={() => removeTier(idx)}
                      className="h-8 w-8 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingDayOfMonth-var">
                  Día de facturación (1-28) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="billingDayOfMonth-var"
                  type="number"
                  min={1}
                  max={28}
                  disabled={isPending}
                  {...register("billingDayOfMonth", { valueAsNumber: true })}
                />
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
                <p className="text-sm text-destructive">{errors.totalAmount.message}</p>
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
                  <p className="text-sm text-destructive">{errors.totalAmount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="installments">
                  Cantidad de cuotas (2-60) <span className="text-destructive">*</span>
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
                  <p className="text-sm text-destructive">{errors.installments.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingDayOfMonth-inst">
                  Día de facturación (1-28) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="billingDayOfMonth-inst"
                  type="number"
                  min={1}
                  max={28}
                  disabled={isPending}
                  {...register("billingDayOfMonth", { valueAsNumber: true })}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="custom-plan"
                  checked={customPlanEnabled}
                  onCheckedChange={(v) => handleToggleCustomPlan(v === true)}
                  disabled={isPending}
                />
                <Label htmlFor="custom-plan" className="cursor-pointer">
                  Cuotas con montos distintos
                </Label>
              </div>

              {customPlanEnabled && planEntries.length > 0 && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="grid grid-cols-[1fr_20px_72px_auto] gap-x-2 items-center mb-1">
                    <p className="text-xs font-medium text-muted-foreground">Hito</p>
                    <span />
                    <p className="text-xs font-medium text-muted-foreground text-center">%</p>
                    <p className="text-xs font-medium text-muted-foreground text-right">Monto</p>
                  </div>

                  {planEntries.map((entry, i) => (
                    <div key={i} className="grid grid-cols-[1fr_20px_72px_auto] gap-x-2 items-center">
                      <Input
                        placeholder={`Cuota ${i + 1}`}
                        value={entry.label}
                        onChange={(e) => updatePlanEntry(i, "label", e.target.value)}
                        disabled={isPending}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-center text-muted-foreground">—</span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        placeholder="0"
                        value={entry.percentage}
                        onChange={(e) => updatePlanEntry(i, "percentage", e.target.value)}
                        disabled={isPending}
                        className="h-8 text-sm text-center"
                      />
                      <span className="text-xs text-right tabular-nums text-muted-foreground min-w-[60px]">
                        {calcAmount(entry.percentage)}
                      </span>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-2 border-t mt-2">
                    <span className="text-xs text-muted-foreground">Total porcentaje</span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        sumPercentages === 100
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive"
                      )}
                    >
                      {sumPercentages.toFixed(2)}%
                      {sumPercentages !== 100 && (
                        <span className="ml-1 font-normal text-xs">(debe ser 100%)</span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Fechas opcionales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-startDate">Primera facturación (opt.)</Label>
              <Input
                id="item-startDate"
                type="date"
                disabled={isPending}
                {...register("startDate")}
              />
              <p className="text-xs text-muted-foreground">
                Si el contrato cubre los primeros meses, poné acá cuándo empieza a generarse este ítem.
              </p>
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
              onCheckedChange={(checked) => setValue("isActive", checked === true)}
              disabled={isPending}
            />
            <Label htmlFor="item-isActive">Activo</Label>
          </div>
          </div>

          <div className="flex gap-3 px-6 py-4 border-t bg-background">
            <Button type="submit" disabled={isPending || !planValid || !tiersValid}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getExistingPlan(item?: ContractItem): PlanEntry[] | null {
  if (!item) return null
  const plan = (item as { installmentPlan?: unknown }).installmentPlan
  if (!Array.isArray(plan) || plan.length === 0) return null
  return plan.map((entry: unknown) => {
    const e = entry as { label?: string; percentage?: number }
    return { label: e.label ?? "", percentage: e.percentage ?? "" }
  })
}

function getExistingTiers(item?: ContractItem): TierEntry[] {
  if (!item?.pricingTable?.tiers?.length) return []
  return item.pricingTable.tiers.map((t) => ({
    fromQuantity: t.fromQuantity,
    toQuantity: t.toQuantity ?? "",
    unitPrice: t.unitPrice,
    flatFee: t.flatFee ?? "",
  }))
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
      pricingTableName: "",
      pricingTiers: undefined,
      totalAmount: "",
      installments: 2,
      installmentPlan: null,
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
    pricingTableName: editItem.pricingTable?.name ?? "",
    pricingTiers: undefined,
    totalAmount: editItem.totalAmount?.toString() ?? "",
    installments: editItem.installments ?? 2,
    installmentPlan: null,
  }
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return ""
  return new Date(d).toISOString().split("T")[0]
}
