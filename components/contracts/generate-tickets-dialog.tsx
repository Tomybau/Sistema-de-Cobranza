"use client"

import { useState, useTransition, useEffect } from "react"
import { Ticket } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  previewTicketsAction,
  generateTicketsAction,
  type PreviewResult,
} from "@/app/(dashboard)/contracts/[id]/actions"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

// ─── Cálculo de precio client-side (espeja calculateVariableAmount del server) ─
type PricingTier = { fromQuantity: string; toQuantity: string | null; unitPrice: string; flatFee: string | null }

function calcPricePreview(tiers: PricingTier[], quantityStr: string): string | null {
  const qty = parseFloat(quantityStr)
  if (isNaN(qty) || qty < 0) return null
  if (qty === 0) return "0.00"
  const sorted = [...tiers].sort((a, b) => parseFloat(a.fromQuantity) - parseFloat(b.fromQuantity))
  if (sorted.length === 0) return null
  if (qty < parseFloat(sorted[0].fromQuantity)) return null
  let matching = sorted[sorted.length - 1]
  for (let i = sorted.length - 1; i >= 0; i--) {
    const tier = sorted[i]
    const from = parseFloat(tier.fromQuantity)
    if (qty >= from) {
      if (tier.toQuantity === null || qty <= parseFloat(tier.toQuantity)) {
        matching = tier; break
      }
    }
  }
  const price = parseFloat(matching.unitPrice) * qty + (matching.flatFee ? parseFloat(matching.flatFee) : 0)
  return price.toFixed(2)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
]

const TYPE_LABELS: Record<string, string> = {
  RECURRING_FIXED: "Fijo",
  RECURRING_VARIABLE: "Variable",
  ONE_TIME: "Único",
  INSTALLMENT: "Cuotas",
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  READY: "default",
  NEEDS_QUANTITY: "secondary",
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  contractId: string
  currency: string
  defaultYear: number
  defaultMonth: number
}

export function GenerateTicketsDialog({
  contractId,
  currency,
  defaultYear,
  defaultMonth,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(defaultYear)
  const [month, setMonth] = useState(defaultMonth)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [variableQuantities, setVariableQuantities] = useState<Record<string, string>>({})
  const [variableModes, setVariableModes] = useState<Record<string, "quantity" | "price">>({})
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [isLoadingPreview, startPreviewTransition] = useTransition()
  const [isGenerating, startGenerateTransition] = useTransition()

  // Load preview whenever period changes (while dialog is open)
  useEffect(() => {
    if (!open) return
    setPreview(null)
    startPreviewTransition(async () => {
      const result = await previewTicketsAction(contractId, year, month)
      setPreview(result)
      // Pre-select all items
      if (result.success) {
        setSelectedItemIds(new Set(result.drafts.map((d) => d.contractItemId)))
      }
    })
  }, [contractId, open, year, month])

  // Reset state when dialog closes
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setYear(defaultYear)
      setMonth(defaultMonth)
      setPreview(null)
      setVariableQuantities({})
      setVariableModes({})
      setSelectedItemIds(new Set())
    }
  }

  function toggleItem(contractItemId: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(contractItemId)) next.delete(contractItemId)
      else next.add(contractItemId)
      return next
    })
  }

  // VARIABLE drafts that still need a quantity
  const variableDrafts =
    preview?.success
      ? preview.drafts.filter((d) => d.status === "NEEDS_QUANTITY")
      : []

  // Can confirm: no selected NEEDS_QUANTITY draft is missing its quantity
  const selectedVariableDrafts = variableDrafts.filter((d) =>
    selectedItemIds.has(d.contractItemId)
  )
  const allQuantitiesFilled = selectedVariableDrafts.every(
    (d) => variableQuantities[d.contractItemId]?.trim()
  )

  const canConfirm =
    preview?.success &&
    selectedItemIds.size > 0 &&
    allQuantitiesFilled &&
    !isLoadingPreview &&
    !isGenerating

  function handleGenerate() {
    startGenerateTransition(async () => {
      const result = await generateTicketsAction(
        contractId, year, month, variableQuantities, variableModes,
        Array.from(selectedItemIds)
      )
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const msgs: string[] = []
      if (result.inserted > 0) msgs.push(`${result.inserted} ticket${result.inserted !== 1 ? "s" : ""} generado${result.inserted !== 1 ? "s" : ""}`)
      if (result.needsInput > 0) msgs.push(`${result.needsInput} variable${result.needsInput !== 1 ? "s" : ""} sin cantidad`)
      if (result.skipped > 0) msgs.push(`${result.skipped} omitido${result.skipped !== 1 ? "s" : ""} (ya existían)`)
      toast.success(msgs.join(" · ") || "Sin cambios")
      handleOpenChange(false)
      router.refresh()
    })
  }

  // Year range: current year ± 2
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} data-tour="generate-tickets">
        <Ticket className="mr-2 h-4 w-4" />
        Generar tickets
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Generar tickets de cobro</DialogTitle>
            <DialogDescription>
              Seleccioná el período y confirmá los montos antes de generar.
            </DialogDescription>
          </DialogHeader>

          {/* Period selector */}
          <div className="flex gap-2 shrink-0">
            <Select
              value={String(month)}
              onValueChange={(v) => v != null && setMonth(Number(v))}
              items={Object.fromEntries(MONTHS.map((m) => [String(m.value), m.label]))}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)} label={m.label}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(year)}
              onValueChange={(v) => v != null && setYear(Number(v))}
              items={Object.fromEntries(years.map((y) => [String(y), String(y)]))}
            >
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)} label={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview panel */}
          <div className="min-h-[6rem] max-h-[50vh] overflow-y-auto rounded-md border p-3 space-y-3 flex-1">
            {isLoadingPreview && (
              <p className="text-sm text-muted-foreground animate-pulse">Calculando...</p>
            )}

            {!isLoadingPreview && preview && !preview.success && (
              <p className="text-sm text-destructive">{preview.error}</p>
            )}

            {!isLoadingPreview && preview?.success && preview.drafts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {preview.skipped > 0
                  ? `Todos los tickets del período ya existen (${preview.skipped} omitido${preview.skipped !== 1 ? "s" : ""}).`
                  : "No hay tickets para generar en este período."}
              </p>
            )}

            {!isLoadingPreview &&
              preview?.success &&
              preview.drafts.map((draft) => {
                const isSelected = selectedItemIds.has(draft.contractItemId)
                const isVariable = draft.status === "NEEDS_QUANTITY"
                return (
                <div key={draft.ticketNumber} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleItem(draft.contractItemId)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={STATUS_BADGE[draft.status] ?? "outline"} className="text-xs shrink-0">
                        {TYPE_LABELS[draft.type] ?? draft.type}
                      </Badge>
                      <span className="font-medium truncate">{draft.itemName}</span>
                      {draft.installmentNum && (
                        <span className="text-muted-foreground text-xs">cuota {draft.installmentNum}</span>
                      )}
                    </div>
                    {draft.description && (
                      <div className="text-xs text-foreground/80 mt-0.5 font-medium">
                        {draft.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Vcto:{" "}
                      {format(new Date(draft.dueDate), "dd MMM yyyy", { locale: es })}
                    </div>
                    {draft.breakdownNote && (
                      <div className="text-xs text-muted-foreground bg-muted/60 rounded px-2 py-1 mt-1 font-mono leading-snug">
                        {draft.breakdownNote}
                      </div>
                    )}
                  </div>

                  {draft.status === "READY" && draft.amount !== null ? (
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatMoney(draft.amount, currency)}
                    </span>
                  ) : (
                    <div className="shrink-0 w-44 space-y-1.5">
                      {/* Toggle modo */}
                      <div className="flex rounded-md border overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => setVariableModes((p) => ({ ...p, [draft.contractItemId]: "quantity" }))}
                          className={cn(
                            "flex-1 px-2 py-1 transition-colors",
                            (variableModes[draft.contractItemId] ?? "quantity") === "quantity"
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted text-muted-foreground"
                          )}
                        >
                          Cantidad
                        </button>
                        <button
                          type="button"
                          onClick={() => setVariableModes((p) => ({ ...p, [draft.contractItemId]: "price" }))}
                          className={cn(
                            "flex-1 px-2 py-1 transition-colors",
                            variableModes[draft.contractItemId] === "price"
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted text-muted-foreground"
                          )}
                        >
                          Precio
                        </button>
                      </div>

                      {/* Input */}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={
                          variableModes[draft.contractItemId] === "price"
                            ? "Precio final"
                            : "Cantidad (ej: 1500)"
                        }
                        value={variableQuantities[draft.contractItemId] ?? ""}
                        onChange={(e) =>
                          setVariableQuantities((prev) => ({
                            ...prev,
                            [draft.contractItemId]: e.target.value,
                          }))
                        }
                      />

                      {/* Preview del precio calculado (solo en modo cantidad) */}
                      {(variableModes[draft.contractItemId] ?? "quantity") === "quantity" &&
                        variableQuantities[draft.contractItemId] &&
                        draft.pricingTiers && (() => {
                          const preview = calcPricePreview(
                            draft.pricingTiers!,
                            variableQuantities[draft.contractItemId]
                          )
                          return preview ? (
                            <p className="text-xs text-muted-foreground">
                              → {formatMoney(preview, currency)}
                            </p>
                          ) : null
                        })()}
                    </div>
                  )}
                </div>
              )
              })}

            {!isLoadingPreview && preview?.success && preview.skipped > 0 && preview.drafts.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1 border-t">
                {preview.skipped} ticket{preview.skipped !== 1 ? "s" : ""} omitido{preview.skipped !== 1 ? "s" : ""} (ya existen)
              </p>
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isGenerating}>
              Cancelar
            </Button>
            <Button onClick={handleGenerate} disabled={!canConfirm}>
              {isGenerating ? "Generando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
