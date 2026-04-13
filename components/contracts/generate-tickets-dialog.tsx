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
import {
  previewTicketsAction,
  generateTicketsAction,
  type PreviewResult,
} from "@/app/(dashboard)/contracts/[id]/actions"
import { formatMoney } from "@/lib/money"

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
  const [isLoadingPreview, startPreviewTransition] = useTransition()
  const [isGenerating, startGenerateTransition] = useTransition()

  // Load preview whenever period changes (while dialog is open)
  useEffect(() => {
    if (!open) return
    setPreview(null)
    startPreviewTransition(async () => {
      const result = await previewTicketsAction(contractId, year, month)
      setPreview(result)
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
    }
  }

  // VARIABLE drafts that still need a quantity
  const variableDrafts =
    preview?.success
      ? preview.drafts.filter((d) => d.status === "NEEDS_QUANTITY")
      : []

  // Can confirm: no NEEDS_QUANTITY draft is missing its quantity
  const allQuantitiesFilled = variableDrafts.every(
    (d) => variableQuantities[d.contractItemId]?.trim()
  )

  const canConfirm =
    preview?.success &&
    preview.drafts.length > 0 &&
    allQuantitiesFilled &&
    !isLoadingPreview &&
    !isGenerating

  function handleGenerate() {
    startGenerateTransition(async () => {
      const result = await generateTicketsAction(contractId, year, month, variableQuantities)
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
      <Button size="sm" onClick={() => setOpen(true)}>
        <Ticket className="mr-2 h-4 w-4" />
        Generar tickets
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generar tickets de cobro</DialogTitle>
            <DialogDescription>
              Seleccioná el período y confirmá los montos antes de generar.
            </DialogDescription>
          </DialogHeader>

          {/* Period selector */}
          <div className="flex gap-2">
            <Select
              value={String(month)}
              onValueChange={(v) => v != null && setMonth(Number(v))}
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
          <div className="min-h-[6rem] rounded-md border p-3 space-y-2">
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
              preview.drafts.map((draft) => (
                <div key={draft.ticketNumber} className="flex items-start gap-2 text-sm">
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
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Vcto:{" "}
                      {format(new Date(draft.dueDate), "dd MMM yyyy", { locale: es })}
                    </div>
                  </div>

                  {draft.status === "READY" && draft.amount !== null ? (
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatMoney(draft.amount, currency)}
                    </span>
                  ) : (
                    <div className="shrink-0 w-32">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Cantidad"
                        value={variableQuantities[draft.contractItemId] ?? ""}
                        onChange={(e) =>
                          setVariableQuantities((prev) => ({
                            ...prev,
                            [draft.contractItemId]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              ))}

            {!isLoadingPreview && preview?.success && preview.skipped > 0 && preview.drafts.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1 border-t">
                {preview.skipped} ticket{preview.skipped !== 1 ? "s" : ""} omitido{preview.skipped !== 1 ? "s" : ""} (ya existen)
              </p>
            )}
          </div>

          <DialogFooter>
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
