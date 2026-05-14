"use client"

import { useState, useRef, useTransition, useEffect } from "react"
import { FileUp, Loader2, Upload, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  uploadContractDocument,
  getOcrResult,
  type OcrDocumentInfo,
} from "@/app/actions/contract-ocr"
import type { OcrContractResult, OcrPricingTier } from "@/domain/ocr/schemas"
import type { ClientMatchResult } from "@/domain/ocr/match-client"

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  RECURRING_FIXED: "Fijo",
  RECURRING_VARIABLE: "Variable",
  ONE_TIME: "Único",
  INSTALLMENT: "Cuotas",
  UNKNOWN: "Desconocido",
}

// ─── Sub-componente: tabla de tiers ──────────────────────────────────────────

function PricingTierTable({ tiers }: { tiers: OcrPricingTier[] }) {
  const hasFlatFee = tiers.some((t) => t.flatFee != null)
  return (
    <table className="w-full text-xs border rounded overflow-hidden">
      <thead>
        <tr className="bg-muted/60 text-muted-foreground">
          <th className="text-left px-2 py-1 font-medium">Desde</th>
          <th className="text-left px-2 py-1 font-medium">Hasta</th>
          <th className="text-right px-2 py-1 font-medium">Precio unitario</th>
          {hasFlatFee && (
            <th className="text-right px-2 py-1 font-medium">Fee fijo</th>
          )}
        </tr>
      </thead>
      <tbody className="divide-y">
        {tiers.map((tier, i) => (
          <tr key={i}>
            <td className="px-2 py-1 tabular-nums">{tier.fromQuantity}</td>
            <td className="px-2 py-1 tabular-nums">
              {tier.toQuantity != null ? tier.toQuantity : "∞"}
            </td>
            <td className="px-2 py-1 text-right tabular-nums">
              {tier.unitPrice != null ? tier.unitPrice : "—"}
            </td>
            {hasFlatFee && (
              <td className="px-2 py-1 text-right tabular-nums">
                {tier.flatFee != null ? tier.flatFee : "—"}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
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

  // Datos extraídos — se guardan en review para que el usuario los vea
  const [extractedData, setExtractedData] = useState<OcrContractResult | null>(null)
  const [extractedMatch, setExtractedMatch] = useState<ClientMatchResult | null>(null)
  const [extractedDocument, setExtractedDocument] = useState<OcrDocumentInfo | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const docIdRef = useRef<string | null>(null)

  // Cleanup al cerrar
  useEffect(() => {
    if (!open) {
      stopPolling()
      setPhase("idle")
      setFile(null)
      setErrorMsg("")
      setExtractedData(null)
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

      if (!result.success) {
        setPhase("error")
        setErrorMsg(result.error)
        return
      }

      docIdRef.current = result.documentId
      setPhase("processing")

      // Poll cada 2s
      pollingRef.current = setInterval(async () => {
        if (!docIdRef.current) return

        const poll = await getOcrResult(docIdRef.current)

        if (poll.status === "DONE") {
          stopPolling()
          // Guardar datos y mostrar pantalla de revisión (NO cerrar aún)
          setExtractedData(poll.data)
          setExtractedMatch(poll.match)
          setExtractedDocument(poll.document)
          setPhase("review")
        } else if (poll.status === "FAILED") {
          stopPolling()
          setPhase("error")
          setErrorMsg(poll.error)
        }
      }, 2000)
    })
  }

  function handleApply() {
    if (!extractedData || !extractedMatch || !extractedDocument) return
    onExtracted(extractedData, extractedMatch, extractedDocument)
    setOpen(false)
  }

  const isProcessing = phase === "uploading" || phase === "processing"

  // ─── Items con tablas extraídas ────────────────────────────────────────────
  const itemsWithTables =
    extractedData?.items.filter(
      (item) => item.pricingTiers && item.pricingTiers.length > 0
    ) ?? []
  const hasOverageTable =
    (extractedData?.overagePricingTable?.tiers.length ?? 0) > 0

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
              ? "Revisá los datos extraídos. Las tablas de precios se muestran abajo para que puedas verificarlas antes de aplicar."
              : "Claude Vision extraerá los datos automáticamente. El formulario se pre-cargará para que puedas revisar y corregir."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Error ── */}
        {phase === "error" && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        {/* ── Cargando ── */}
        {isProcessing && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {phase === "uploading"
                ? "Subiendo archivo..."
                : "Analizando contrato con IA..."}
            </p>
          </div>
        )}

        {/* ── Selección de archivo ── */}
        {phase === "idle" && (
          <div className="space-y-4 py-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-md border border-dashed p-8 cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <FileUp className="h-8 w-8 text-muted-foreground" />
              {file ? (
                <p className="text-sm font-medium text-center">{file.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Click para seleccionar PDF, PNG o JPG (máx 10MB)
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Revisión de datos extraídos ── */}
        {phase === "review" && extractedData && (
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Cabecera: confianza + cliente */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{extractedData.client.name}</p>
                {extractedData.client.taxId && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {extractedData.client.taxId}
                  </p>
                )}
              </div>
              <Badge variant={CONFIDENCE_VARIANT[extractedData.confidence] ?? "outline"}>
                {CONFIDENCE_LABEL[extractedData.confidence] ?? extractedData.confidence}
              </Badge>
            </div>

            {/* Datos del contrato */}
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Contrato
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {extractedData.contract.name && (
                  <><span className="text-muted-foreground">Nombre</span><span>{extractedData.contract.name}</span></>
                )}
                {extractedData.contract.currency && (
                  <><span className="text-muted-foreground">Moneda</span><span className="font-mono">{extractedData.contract.currency}</span></>
                )}
                {extractedData.contract.startDate && (
                  <><span className="text-muted-foreground">Inicio</span><span>{extractedData.contract.startDate}</span></>
                )}
                {extractedData.contract.paymentTermsDays != null && (
                  <><span className="text-muted-foreground">Plazo de pago</span><span>{extractedData.contract.paymentTermsDays} días</span></>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Items extraídos ({extractedData.items.length})
              </p>
              {extractedData.items.map((item, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {ITEM_TYPE_LABEL[item.type] ?? item.type}
                    </Badge>
                    <span className="font-medium text-sm">{item.name}</span>
                    {item.fixedAmount != null && (
                      <span className="ml-auto text-sm tabular-nums font-medium">
                        {item.fixedAmount}
                      </span>
                    )}
                    {item.totalAmount != null && (
                      <span className="ml-auto text-sm tabular-nums font-medium">
                        {item.totalAmount}
                      </span>
                    )}
                  </div>

                  {/* Tabla de precios del item */}
                  {item.pricingTiers && item.pricingTiers.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Tabla de precios
                        {item.pricingTableName ? ` — ${item.pricingTableName}` : ""}
                      </p>
                      <PricingTierTable tiers={item.pricingTiers} />
                    </div>
                  )}

                  {/* Milestone labels para cuotas */}
                  {item.milestoneLabels && item.milestoneLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.milestoneLabels.map((label, j) => (
                        <span
                          key={j}
                          className="text-xs bg-muted rounded px-1.5 py-0.5"
                        >
                          Cuota {j + 1}: {label}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.breakdownNote && (
                    <p className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">
                      {item.breakdownNote}
                    </p>
                  )}
                </div>
              ))}

              {/* Tabla de excedentes separada */}
              {hasOverageTable && extractedData.overagePricingTable && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Variable</Badge>
                    <span className="font-medium text-sm">
                      {extractedData.overagePricingTable.name ?? "Tabla de excedentes"}
                    </span>
                    {extractedData.overagePricingTable.unit && (
                      <span className="text-xs text-muted-foreground">
                        por {extractedData.overagePricingTable.unit}
                      </span>
                    )}
                  </div>
                  <PricingTierTable tiers={extractedData.overagePricingTable.tiers} />
                </div>
              )}
            </div>

            {extractedData.confidence === "LOW" && (
              <div className="rounded-md bg-warn/10 border border-warn/30 p-3 text-sm text-warn">
                Confianza baja — revisá todos los campos antes de guardar el contrato.
              </div>
            )}
          </div>
        )}

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
