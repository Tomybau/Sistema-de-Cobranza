"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { Ticket, Building2, ChevronDown, ChevronRight } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatMoney } from "@/lib/money"
import { ITEM_TYPE_LABELS } from "@/lib/item-type-labels"
import {
  previewAllPendingAction,
  generateSelectedAction,
  type PendingContractGroup,
  type PendingContractData,
  type PreviewAllResult,
} from "@/app/(dashboard)/tickets/actions"

// ─── Helpers client-side ──────────────────────────────────────────────────────

type PricingTier = {
  fromQuantity: string
  toQuantity: string | null
  unitPrice: string
  flatFee: string | null
}

function calcPricePreview(tiers: PricingTier[], quantityStr: string): string | null {
  const qty = parseFloat(quantityStr)
  if (isNaN(qty) || qty < 0) return null
  if (qty === 0) return "0.00"
  const sorted = [...tiers].sort(
    (a, b) => parseFloat(a.fromQuantity) - parseFloat(b.fromQuantity)
  )
  if (sorted.length === 0) return null
  if (qty < parseFloat(sorted[0].fromQuantity)) return null
  let matching = sorted[sorted.length - 1]
  for (let i = sorted.length - 1; i >= 0; i--) {
    const t = sorted[i]
    if (
      qty >= parseFloat(t.fromQuantity) &&
      (t.toQuantity === null || qty <= parseFloat(t.toQuantity))
    ) {
      matching = t
      break
    }
  }
  const price =
    parseFloat(matching.unitPrice) * qty +
    (matching.flatFee ? parseFloat(matching.flatFee) : 0)
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

const TYPE_LABELS = ITEM_TYPE_LABELS

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface ContractSectionProps {
  contract: PendingContractData
  // Selección de drafts recurrentes
  selectedDrafts: Set<string>        // contractItemId
  onToggleDraft: (id: string) => void
  onToggleAllDrafts: (ids: string[], checked: boolean) => void
  // Selección de cuotas
  selectedInstallments: Set<string>  // `${contractItemId}-${installmentNum}`
  onToggleInstallment: (key: string) => void
  onToggleAllInstallments: (keys: string[], checked: boolean) => void
  // Variables
  variableQuantities: Record<string, string>
  variableModes: Record<string, "quantity" | "price">
  onQuantityChange: (itemId: string, value: string) => void
  onModeChange: (itemId: string, mode: "quantity" | "price") => void
}

function ContractSection({
  contract,
  selectedDrafts,
  onToggleDraft,
  onToggleAllDrafts,
  selectedInstallments,
  onToggleInstallment,
  onToggleAllInstallments,
  variableQuantities,
  variableModes,
  onQuantityChange,
  onModeChange,
}: ContractSectionProps) {
  const [expanded, setExpanded] = useState(true)

  const allDraftIds = contract.drafts.map((d) => d.contractItemId)
  const allInstKeys = contract.pendingInstallments.map(
    (i) => `${i.contractItemId}-${i.installmentNum}`
  )
  const allSelected =
    allDraftIds.every((id) => selectedDrafts.has(id)) &&
    allInstKeys.every((k) => selectedInstallments.has(k))
  const someSelected =
    allDraftIds.some((id) => selectedDrafts.has(id)) ||
    allInstKeys.some((k) => selectedInstallments.has(k))

  function handleToggleAll(checked: boolean) {
    onToggleAllDrafts(allDraftIds, checked)
    onToggleAllInstallments(allInstKeys, checked)
  }

  const totalItems = contract.drafts.length + contract.pendingInstallments.length

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Encabezado del contrato */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-muted/40 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <Checkbox
          checked={allSelected}
          data-state={someSelected && !allSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
          onClick={(e) => {
            e.stopPropagation()
            handleToggleAll(!allSelected)
          }}
        />
        <span className="text-sm font-medium flex-1 truncate">
          {contract.contractNumber} — {contract.title}
        </span>
        <Badge variant="outline" className="text-xs shrink-0">
          {totalItems} pendiente{totalItems !== 1 ? "s" : ""}
        </Badge>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="divide-y">
          {/* Drafts del período (RECURRING / ONE_TIME) */}
          {contract.drafts.map((draft) => {
            const isSelected = selectedDrafts.has(draft.contractItemId)
            const isVariable = draft.status === "NEEDS_QUANTITY"
            const mode = variableModes[draft.contractItemId] ?? "quantity"
            const quantity = variableQuantities[draft.contractItemId] ?? ""

            return (
              <div key={draft.ticketNumber} className="flex items-start gap-2 px-3 py-2.5">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleDraft(draft.contractItemId)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {TYPE_LABELS[draft.type] ?? draft.type}
                    </Badge>
                    <span className="text-sm font-medium truncate">{draft.itemName}</span>
                    {draft.installmentNum && (
                      <span className="text-xs text-muted-foreground">
                        cuota {draft.installmentNum}
                      </span>
                    )}
                  </div>
                  {draft.description && (
                    <p className="text-xs text-foreground/70 mt-0.5">{draft.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vcto: {format(new Date(draft.dueDate), "dd MMM yyyy", { locale: es })}
                  </p>
                </div>

                {!isVariable ? (
                  <span className="text-sm font-medium tabular-nums shrink-0">
                    {formatMoney(draft.amount!, contract.currency)}
                  </span>
                ) : (
                  <div className="shrink-0 w-44 space-y-1.5">
                    {/* Toggle modo */}
                    <div className="flex rounded-md border overflow-hidden text-xs">
                      <button
                        type="button"
                        onClick={() => onModeChange(draft.contractItemId, "quantity")}
                        className={cn(
                          "flex-1 px-2 py-1 transition-colors",
                          mode === "quantity"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted text-muted-foreground"
                        )}
                      >
                        Cantidad
                      </button>
                      <button
                        type="button"
                        onClick={() => onModeChange(draft.contractItemId, "price")}
                        className={cn(
                          "flex-1 px-2 py-1 transition-colors",
                          mode === "price"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted text-muted-foreground"
                        )}
                      >
                        Precio
                      </button>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={mode === "price" ? "Precio final" : "Cantidad (ej: 1500)"}
                      value={quantity}
                      onChange={(e) => onQuantityChange(draft.contractItemId, e.target.value)}
                    />
                    {mode === "quantity" && quantity && draft.pricingTiers && (() => {
                      const p = calcPricePreview(draft.pricingTiers!, quantity)
                      return p ? (
                        <p className="text-xs text-muted-foreground">
                          → {formatMoney(p, contract.currency)}
                        </p>
                      ) : null
                    })()}
                  </div>
                )}
              </div>
            )
          })}

          {/* Cuotas pendientes (INSTALLMENT) */}
          {contract.pendingInstallments.length > 0 && (
            <>
              {contract.drafts.length > 0 && (
                <div className="px-3 py-1.5 bg-muted/20">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Cuotas pendientes
                  </p>
                </div>
              )}
              {contract.pendingInstallments.map((inst) => {
                const key = `${inst.contractItemId}-${inst.installmentNum}`
                const isSelected = selectedInstallments.has(key)

                return (
                  <div key={key} className="flex items-start gap-2 px-3 py-2.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleInstallment(key)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-xs shrink-0">
                          Cuota {inst.installmentNum}/{inst.totalInstallments}
                        </Badge>
                        <span className="text-sm font-medium truncate">{inst.itemName}</span>
                      </div>
                      {inst.description && (
                        <p className="text-xs text-foreground/70 mt-0.5">{inst.description}</p>
                      )}
                      {inst.breakdownNote && (
                        <p className="text-xs text-muted-foreground bg-muted/60 rounded px-2 py-1 mt-1 font-mono leading-snug">
                          {inst.breakdownNote}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vcto: {format(new Date(inst.dueDate), "dd MMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums shrink-0">
                      {formatMoney(inst.amount, inst.currency)}
                    </span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Dialog principal ─────────────────────────────────────────────────────────

export function GenerateAllDialog() {
  const router = useRouter()
  const now = new Date()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [companyFilter, setCompanyFilter] = useState("")

  const [preview, setPreview] = useState<PreviewAllResult | null>(null)
  const [isLoadingPreview, startPreviewTransition] = useTransition()
  const [isGenerating, startGenerateTransition] = useTransition()

  // Estado de selección
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set())
  const [selectedInstallments, setSelectedInstallments] = useState<Set<string>>(new Set())
  const [variableQuantities, setVariableQuantities] = useState<Record<string, string>>({})
  const [variableModes, setVariableModes] = useState<Record<string, "quantity" | "price">>({})

  const loadPreview = useCallback(() => {
    setPreview(null)
    resetSelections()
    startPreviewTransition(async () => {
      const result = await previewAllPendingAction(year, month)
      setPreview(result)
      if (result.success) {
        // Pre-seleccionar todo excepto variables sin cantidad
        const drafts = new Set<string>()
        const insts = new Set<string>()
        for (const group of result.groups) {
          for (const contract of group.contracts) {
            for (const draft of contract.drafts) {
              if (draft.status === "READY") drafts.add(draft.contractItemId)
            }
            for (const inst of contract.pendingInstallments) {
              insts.add(`${inst.contractItemId}-${inst.installmentNum}`)
            }
          }
        }
        setSelectedDrafts(drafts)
        setSelectedInstallments(insts)
      }
    })
  }, [year, month])

  useEffect(() => {
    if (open) loadPreview()
  }, [open, loadPreview])

  function resetSelections() {
    setSelectedDrafts(new Set())
    setSelectedInstallments(new Set())
    setVariableQuantities({})
    setVariableModes({})
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setPreview(null)
      setCompanyFilter("")
      resetSelections()
    }
  }

  // Selección handlers
  function toggleDraft(itemId: string) {
    setSelectedDrafts((prev) => {
      const next = new Set(prev)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    })
  }

  function toggleAllDrafts(ids: string[], checked: boolean) {
    setSelectedDrafts((prev) => {
      const next = new Set(prev)
      for (const id of ids) checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  function toggleInstallment(key: string) {
    setSelectedInstallments((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAllInstallments(keys: string[], checked: boolean) {
    setSelectedInstallments((prev) => {
      const next = new Set(prev)
      for (const k of keys) checked ? next.add(k) : next.delete(k)
      return next
    })
  }

  // Grupos filtrados
  const filteredGroups =
    preview?.success && companyFilter
      ? preview.groups.filter((g) =>
          g.companyName.toLowerCase().includes(companyFilter.toLowerCase())
        )
      : preview?.success
      ? preview.groups
      : []

  // Contar seleccionados
  const totalSelected = selectedDrafts.size + selectedInstallments.size

  // Puede confirmar: hay algo seleccionado y no está cargando
  const canConfirm = totalSelected > 0 && !isLoadingPreview && !isGenerating

  function handleGenerate() {
    if (!preview?.success) return

    startGenerateTransition(async () => {
      // Armar los inputs por contrato
      const inputs = preview.groups.flatMap((group) =>
        group.contracts
          .map((contract) => {
            const selectedDraftItemIds = contract.drafts
              .filter((d) => selectedDrafts.has(d.contractItemId))
              .map((d) => d.contractItemId)

            const selectedInsts = contract.pendingInstallments
              .filter((i) =>
                selectedInstallments.has(`${i.contractItemId}-${i.installmentNum}`)
              )
              .map((i) => ({
                contractItemId: i.contractItemId,
                installmentNum: i.installmentNum,
              }))

            if (selectedDraftItemIds.length === 0 && selectedInsts.length === 0) return null

            return {
              contractId: contract.contractId,
              year,
              month,
              selectedDraftItemIds,
              variableQuantities,
              variableModes,
              selectedInstallments: selectedInsts,
            }
          })
          .filter(Boolean)
      ) as Parameters<typeof generateSelectedAction>[0]

      if (inputs.length === 0) {
        toast.info("Nada seleccionado para generar.")
        return
      }

      const result = await generateSelectedAction(inputs)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      const msgs: string[] = []
      if (result.inserted > 0)
        msgs.push(`${result.inserted} ticket${result.inserted !== 1 ? "s" : ""} generado${result.inserted !== 1 ? "s" : ""}`)
      if (result.needsInput > 0)
        msgs.push(`${result.needsInput} variable${result.needsInput !== 1 ? "s" : ""} sin cantidad`)
      if (result.skipped > 0)
        msgs.push(`${result.skipped} omitido${result.skipped !== 1 ? "s" : ""} (ya existían)`)

      toast.success(msgs.join(" · ") || "Sin cambios")
      handleOpenChange(false)
      router.refresh()
    })
  }

  const currentYear = now.getFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  return (
    <>
      <Button onClick={() => setOpen(true)} data-tour="generate-all">
        <Ticket className="mr-2 h-4 w-4" />
        Generar tickets
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Generar tickets de cobro</DialogTitle>
            <DialogDescription>
              Seleccioná período, filtrá por empresa y elegí qué tickets generar.
            </DialogDescription>
          </DialogHeader>

          {/* Controles */}
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Select
              value={String(month)}
              onValueChange={(v) => v != null && setMonth(Number(v))}
              items={Object.fromEntries(MONTHS.map((m) => [String(m.value), m.label]))}
            >
              <SelectTrigger className="flex-1 min-w-[130px]">
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

            <Input
              placeholder="Filtrar por empresa..."
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="flex-1 min-w-[160px]"
            />
          </div>

          {/* Panel de preview */}
          <div className="flex-1 overflow-y-auto space-y-3 min-h-[8rem]">
            {isLoadingPreview && (
              <p className="text-sm text-muted-foreground animate-pulse py-4 text-center">
                Calculando tickets pendientes...
              </p>
            )}

            {!isLoadingPreview && preview && !preview.success && (
              <p className="text-sm text-destructive py-4">{preview.error}</p>
            )}

            {!isLoadingPreview && preview?.success && filteredGroups.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {companyFilter
                  ? "Ninguna empresa coincide con el filtro."
                  : "No hay tickets pendientes para este período."}
              </p>
            )}

            {!isLoadingPreview &&
              filteredGroups.map((group) => (
                <div key={group.companyId} className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {group.companyName}
                  </div>
                  {group.contracts.map((contract) => (
                    <ContractSection
                      key={contract.contractId}
                      contract={contract}
                      selectedDrafts={selectedDrafts}
                      onToggleDraft={toggleDraft}
                      onToggleAllDrafts={toggleAllDrafts}
                      selectedInstallments={selectedInstallments}
                      onToggleInstallment={toggleInstallment}
                      onToggleAllInstallments={toggleAllInstallments}
                      variableQuantities={variableQuantities}
                      variableModes={variableModes}
                      onQuantityChange={(id, val) =>
                        setVariableQuantities((p) => ({ ...p, [id]: val }))
                      }
                      onModeChange={(id, mode) =>
                        setVariableModes((p) => ({ ...p, [id]: mode }))
                      }
                    />
                  ))}
                </div>
              ))}
          </div>

          <DialogFooter className="shrink-0 gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isGenerating}>
              Cancelar
            </Button>
            <Button onClick={handleGenerate} disabled={!canConfirm}>
              {isGenerating
                ? "Generando..."
                : `Generar ${totalSelected > 0 ? totalSelected : ""} ticket${totalSelected !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
