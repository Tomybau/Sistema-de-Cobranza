"use client"

import { useState, useRef, useTransition, useEffect } from "react"
import { FileUp, Loader2, Upload, CheckCircle2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  uploadContractDocument,
  getOcrResult,
  type OcrDocumentInfo,
} from "@/app/actions/contract-ocr"
import type { OcrContractResult, OcrPricingTier, OcrContractItem } from "@/domain/ocr/schemas"
import type { ClientMatchResult } from "@/domain/ocr/match-client"

// ─── Constantes ───────────────────────────────────────────────────────────────

const CONFIDENCE_VARIANT: Record<string, "ok" | "warn" | "bad"> = {
  HIGH: "ok",
  MEDIUM: "warn",
  LOW: "bad",
}
const CONFIDENCE_LABEL: Record<string, string> = {
  HIGH: "Confianza alta",
  MEDIUM: "Confianza media",
  LOW: "Confianza baja",
}
const ITEM_TYPE_LABEL: Record<string, string> = {
  RECURRING_FIXED: "Fijo mensual",
  RECURRING_VARIABLE: "Variable (tabla)",
  ONE_TIME: "Único",
  INSTALLMENT: "Cuotas",
  UNKNOWN: "Desconocido",
}
const ITEM_TYPES = [
  "RECURRING_FIXED",
  "RECURRING_VARIABLE",
  "ONE_TIME",
  "INSTALLMENT",
  "UNKNOWN",
] as const

// ─── Helpers para editar state inmutable ─────────────────────────────────────

function numOrNull(v: string): number | null {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

// ─── Sub-componente: tabla de tiers editable ─────────────────────────────────

interface TierTableEditorProps {
  tiers: OcrPricingTier[]
  onChangeTier: (i: number, field: keyof OcrPricingTier, value: number | null | string) => void
  onAddTier: () => void
  onRemoveTier: (i: number) => void
}

function TierTableEditor({ tiers, onChangeTier, onAddTier, onRemoveTier }: TierTableEditorProps) {
  return (
    <div className="space-y-1">
      <div className="rounded border overflow-hidden text-xs">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/60 text-muted-foreground">
              <th className="text-left px-2 py-1 font-medium w-24">Desde</th>
              <th className="text-left px-2 py-1 font-medium w-24">Hasta (∞=vacío)</th>
              <th className="text-left px-2 py-1 font-medium w-28">Precio unitario</th>
              <th className="text-left px-2 py-1 font-medium w-24">Fee fijo</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {tiers.map((tier, i) => (
              <tr key={i}>
                <td className="px-1 py-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className="h-6 text-xs px-1.5"
                    value={tier.fromQuantity ?? ""}
                    onChange={(e) => onChangeTier(i, "fromQuantity", numOrNull(e.target.value) ?? 0)}
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className="h-6 text-xs px-1.5"
                    value={tier.toQuantity ?? ""}
                    placeholder="∞"
                    onChange={(e) => onChangeTier(i, "toQuantity", e.target.value === "" ? null : numOrNull(e.target.value))}
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className="h-6 text-xs px-1.5"
                    value={tier.unitPrice ?? ""}
                    placeholder="0"
                    onChange={(e) => onChangeTier(i, "unitPrice", numOrNull(e.target.value))}
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className="h-6 text-xs px-1.5"
                    value={tier.flatFee ?? ""}
                    placeholder="—"
                    onChange={(e) => onChangeTier(i, "flatFee", e.target.value === "" ? null : numOrNull(e.target.value))}
                  />
                </td>
                <td className="px-1 py-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveTier(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={onAddTier}
      >
        <Plus className="mr-1 h-3 w-3" />
        Agregar fila
      </Button>
    </div>
  )
}

// ─── Props / types ────────────────────────────────────────────────────────────

interface OcrImportDialogProps {
  onExtracted: (
    data: OcrContractResult,
    match: ClientMatchResult,
    document: OcrDocumentInfo
  ) => void
}

type Phase = "idle" | "uploading" | "processing" | "review" | "error"

// ─── Componente principal ────────────────────────────────────────────────────

export function OcrImportDialog({ onExtracted }: OcrImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [isPending, startTransition] = useTransition()

  // Copia editable de los datos extraídos
  const [editableData, setEditableData] = useState<OcrContractResult | null>(null)
  const [extractedMatch, setExtractedMatch] = useState<ClientMatchResult | null>(null)
  const [extractedDocument, setExtractedDocument] = useState<OcrDocumentInfo | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const docIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      stopPolling()
      setPhase("idle")
      setFile(null)
      setErrorMsg("")
      setEditableData(null)
      setExtractedMatch(null)
      setExtractedDocument(null)
      docIdRef.current = null
    }
    return () => stopPolling()
  }, [open])

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  function handleProcess() {
    if (!file) return
    startTransition(async () => {
      setPhase("uploading")
      const formData = new FormData()
      formData.append("file", file)
      const result = await uploadContractDocument(formData)
      if (!result.success) { setPhase("error"); setErrorMsg(result.error); return }
      docIdRef.current = result.documentId
      setPhase("processing")
      pollingRef.current = setInterval(async () => {
        if (!docIdRef.current) return
        const poll = await getOcrResult(docIdRef.current)
        if (poll.status === "DONE") {
          stopPolling()
          setEditableData(structuredClone(poll.data))
          setExtractedMatch(poll.match)
          setExtractedDocument(poll.document)
          setPhase("review")
        } else if (poll.status === "FAILED") {
          stopPolling(); setPhase("error"); setErrorMsg(poll.error)
        }
      }, 2000)
    })
  }

  function handleApply() {
    if (!editableData || !extractedMatch || !extractedDocument) return
    onExtracted(editableData, extractedMatch, extractedDocument)
    setOpen(false)
  }

  // ─── Helpers de mutación ─────────────────────────────────────────────────

  function updClient(field: keyof OcrContractResult["client"], value: string | null) {
    setEditableData((p) => p ? { ...p, client: { ...p.client, [field]: value || null } } : p)
  }

  function updContract(field: keyof OcrContractResult["contract"], value: string | number | null) {
    setEditableData((p) => p ? { ...p, contract: { ...p.contract, [field]: value } } : p)
  }

  function updItem(idx: number, updates: Partial<OcrContractItem>) {
    setEditableData((p) => {
      if (!p) return p
      const items = p.items.map((it, i) => i === idx ? { ...it, ...updates } : it)
      return { ...p, items }
    })
  }

  function updItemTier(itemIdx: number, tierIdx: number, field: keyof OcrPricingTier, value: number | null) {
    setEditableData((p) => {
      if (!p) return p
      const items = p.items.map((it, i) => {
        if (i !== itemIdx) return it
        const tiers = (it.pricingTiers ?? []).map((t, ti) =>
          ti === tierIdx ? { ...t, [field]: value } : t
        )
        return { ...it, pricingTiers: tiers }
      })
      return { ...p, items }
    })
  }

  function addItemTier(itemIdx: number) {
    setEditableData((p) => {
      if (!p) return p
      const items = p.items.map((it, i) => {
        if (i !== itemIdx) return it
        const tiers = [...(it.pricingTiers ?? []), { fromQuantity: 0, toQuantity: null, unitPrice: null, flatFee: null, label: null }]
        return { ...it, pricingTiers: tiers }
      })
      return { ...p, items }
    })
  }

  function removeItemTier(itemIdx: number, tierIdx: number) {
    setEditableData((p) => {
      if (!p) return p
      const items = p.items.map((it, i) => {
        if (i !== itemIdx) return it
        return { ...it, pricingTiers: (it.pricingTiers ?? []).filter((_, ti) => ti !== tierIdx) }
      })
      return { ...p, items }
    })
  }

  function updOverageTier(tierIdx: number, field: keyof OcrPricingTier, value: number | null) {
    setEditableData((p) => {
      if (!p || !p.overagePricingTable) return p
      const tiers = p.overagePricingTable.tiers.map((t, ti) =>
        ti === tierIdx ? { ...t, [field]: value } : t
      )
      return { ...p, overagePricingTable: { ...p.overagePricingTable, tiers } }
    })
  }

  function addOverageTier() {
    setEditableData((p) => {
      if (!p || !p.overagePricingTable) return p
      const tiers = [...p.overagePricingTable.tiers, { fromQuantity: 0, toQuantity: null, unitPrice: null, flatFee: null, label: null }]
      return { ...p, overagePricingTable: { ...p.overagePricingTable, tiers } }
    })
  }

  function removeOverageTier(tierIdx: number) {
    setEditableData((p) => {
      if (!p || !p.overagePricingTable) return p
      const tiers = p.overagePricingTable.tiers.filter((_, ti) => ti !== tierIdx)
      return { ...p, overagePricingTable: { ...p.overagePricingTable, tiers } }
    })
  }

  const isProcessing = phase === "uploading" || phase === "processing"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload className="mr-2 h-4 w-4" />
        Importar desde PDF
      </DialogTrigger>

      <DialogContent
        className={
          phase === "review"
            ? "sm:max-w-2xl flex flex-col max-h-[90vh]"
            : "sm:max-w-md"
        }
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Importar contrato desde PDF o imagen</DialogTitle>
          <DialogDescription>
            {phase === "review"
              ? "Revisá y corregí los datos extraídos antes de aplicar al formulario."
              : "Claude Vision extraerá los datos automáticamente. Podrás revisar y corregir antes de aplicar."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Error ── */}
        {phase === "error" && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        {/* ── Procesando ── */}
        {isProcessing && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {phase === "uploading" ? "Subiendo archivo..." : "Analizando contrato con IA..."}
            </p>
          </div>
        )}

        {/* ── Selección de archivo ── */}
        {phase === "idle" && (
          <div className="space-y-4 py-4">
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} className="hidden" />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-md border border-dashed p-8 cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <FileUp className="h-8 w-8 text-muted-foreground" />
              {file
                ? <p className="text-sm font-medium text-center">{file.name}</p>
                : <p className="text-sm text-muted-foreground text-center">Click para seleccionar PDF, PNG o JPG (máx 10MB)</p>
              }
            </div>
          </div>
        )}

        {/* ── Revisión y edición ── */}
        {phase === "review" && editableData && (
          <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">

            {/* Confianza */}
            <div className="flex items-center gap-2">
              <Badge variant={CONFIDENCE_VARIANT[editableData.confidence] ?? "outline"}>
                {CONFIDENCE_LABEL[editableData.confidence] ?? editableData.confidence}
              </Badge>
              {editableData.confidence === "LOW" && (
                <p className="text-xs text-warn">Revisá todos los campos con cuidado.</p>
              )}
            </div>

            {/* ── Cliente ── */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Nombre / Razón social</label>
                  <Input
                    value={editableData.client.name}
                    onChange={(e) => updClient("name", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Tax ID / CUIT</label>
                  <Input
                    value={editableData.client.taxId ?? ""}
                    onChange={(e) => updClient("taxId", e.target.value)}
                    className="h-8 text-sm font-mono"
                    placeholder="—"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Email</label>
                  <Input
                    value={editableData.client.email ?? ""}
                    onChange={(e) => updClient("email", e.target.value)}
                    className="h-8 text-sm"
                    placeholder="—"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Teléfono</label>
                  <Input
                    value={editableData.client.phone ?? ""}
                    onChange={(e) => updClient("phone", e.target.value)}
                    className="h-8 text-sm"
                    placeholder="—"
                  />
                </div>
              </div>
            </section>

            {/* ── Contrato ── */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contrato</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 space-y-0.5">
                  <label className="text-xs text-muted-foreground">Nombre del contrato</label>
                  <Input
                    value={editableData.contract.name}
                    onChange={(e) => updContract("name", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Moneda</label>
                  <Input
                    value={editableData.contract.currency ?? ""}
                    onChange={(e) => updContract("currency", e.target.value.toUpperCase())}
                    className="h-8 text-sm font-mono"
                    placeholder="USD / ARS / HNL"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Plazo de pago (días)</label>
                  <Input
                    type="number"
                    min="0"
                    value={editableData.contract.paymentTermsDays ?? ""}
                    onChange={(e) => updContract("paymentTermsDays", numOrNull(e.target.value))}
                    className="h-8 text-sm"
                    placeholder="—"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Fecha de inicio</label>
                  <Input
                    value={editableData.contract.startDate ?? ""}
                    onChange={(e) => updContract("startDate", e.target.value || null)}
                    className="h-8 text-sm"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Fecha de fin</label>
                  <Input
                    value={editableData.contract.endDate ?? ""}
                    onChange={(e) => updContract("endDate", e.target.value || null)}
                    className="h-8 text-sm"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>
            </section>

            {/* ── Items ── */}
            <section className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Items ({editableData.items.length})
              </p>

              {editableData.items.map((item, idx) => {
                const showPricingTiers =
                  item.type === "RECURRING_VARIABLE" ||
                  (item.pricingTiers && item.pricingTiers.length > 0)

                return (
                  <div key={idx} className="rounded-md border p-3 space-y-3 bg-card">
                    {/* Nombre + tipo */}
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                      <div className="space-y-0.5">
                        <label className="text-xs text-muted-foreground">Nombre del item</label>
                        <Input
                          value={item.name}
                          onChange={(e) => updItem(idx, { name: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-xs text-muted-foreground">Tipo</label>
                        <Select
                          value={item.type}
                          onValueChange={(v) => updItem(idx, { type: v as OcrContractItem["type"] })}
                        >
                          <SelectTrigger className="h-8 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_TYPES.map((t) => (
                              <SelectItem key={t} value={t} label={ITEM_TYPE_LABEL[t]} className="text-xs">
                                {ITEM_TYPE_LABEL[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Monto fijo */}
                    {(item.type === "RECURRING_FIXED" || item.fixedAmount != null) && (
                      <div className="space-y-0.5">
                        <label className="text-xs text-muted-foreground">Monto fijo mensual</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={item.fixedAmount ?? ""}
                          onChange={(e) => updItem(idx, { fixedAmount: numOrNull(e.target.value) })}
                          className="h-8 text-sm max-w-[160px]"
                          placeholder="0.00"
                        />
                      </div>
                    )}

                    {/* Monto total / cuotas */}
                    {(item.type === "ONE_TIME" || item.type === "INSTALLMENT" || item.totalAmount != null) && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <label className="text-xs text-muted-foreground">Monto total</label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.totalAmount ?? ""}
                            onChange={(e) => updItem(idx, { totalAmount: numOrNull(e.target.value) })}
                            className="h-8 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                        {(item.type === "INSTALLMENT" || (item.installments ?? 0) > 1) && (
                          <div className="space-y-0.5">
                            <label className="text-xs text-muted-foreground">Cuotas</label>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={item.installments ?? ""}
                              onChange={(e) => updItem(idx, { installments: numOrNull(e.target.value) })}
                              className="h-8 text-sm"
                              placeholder="2"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tabla de precios */}
                    {showPricingTiers && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground">Tabla de precios</label>
                          <Input
                            value={item.pricingTableName ?? ""}
                            onChange={(e) => updItem(idx, { pricingTableName: e.target.value || null })}
                            className="h-6 text-xs max-w-[200px]"
                            placeholder="Nombre de la tabla"
                          />
                        </div>
                        <TierTableEditor
                          tiers={item.pricingTiers ?? []}
                          onChangeTier={(ti, field, value) =>
                            updItemTier(idx, ti, field, value as number | null)
                          }
                          onAddTier={() => addItemTier(idx)}
                          onRemoveTier={(ti) => removeItemTier(idx, ti)}
                        />
                      </div>
                    )}

                    {/* Breakdown note */}
                    {item.breakdownNote && (
                      <div className="space-y-0.5">
                        <label className="text-xs text-muted-foreground">Desglose del monto</label>
                        <Input
                          value={item.breakdownNote}
                          onChange={(e) => updItem(idx, { breakdownNote: e.target.value || null })}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </section>

            {/* ── Tabla de excedentes ── */}
            {editableData.overagePricingTable && (
              <section className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tabla de excedentes
                </p>
                <div className="rounded-md border p-3 space-y-3 bg-card">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-xs text-muted-foreground">Nombre</label>
                      <Input
                        value={editableData.overagePricingTable.name ?? ""}
                        onChange={(e) =>
                          setEditableData((p) =>
                            p && p.overagePricingTable
                              ? { ...p, overagePricingTable: { ...p.overagePricingTable, name: e.target.value || null } }
                              : p
                          )
                        }
                        className="h-8 text-sm"
                        placeholder="Tabla de excedentes"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-xs text-muted-foreground">Unidad</label>
                      <Input
                        value={editableData.overagePricingTable.unit ?? ""}
                        onChange={(e) =>
                          setEditableData((p) =>
                            p && p.overagePricingTable
                              ? { ...p, overagePricingTable: { ...p.overagePricingTable, unit: e.target.value || null } }
                              : p
                          )
                        }
                        className="h-8 text-sm"
                        placeholder="mensajes, GB, usuarios..."
                      />
                    </div>
                  </div>
                  <TierTableEditor
                    tiers={editableData.overagePricingTable.tiers}
                    onChangeTier={(ti, field, value) => updOverageTier(ti, field, value as number | null)}
                    onAddTier={addOverageTier}
                    onRemoveTier={removeOverageTier}
                  />
                </div>
              </section>
            )}

          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="shrink-0 pt-2">
          {phase === "idle" && (
            <Button onClick={handleProcess} disabled={!file || isPending}>
              Procesar
            </Button>
          )}
          {phase === "review" && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleApply}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Aplicar al formulario
              </Button>
            </>
          )}
          {phase === "error" && (
            <Button variant="outline" onClick={() => setPhase("idle")}>
              Intentar de nuevo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
