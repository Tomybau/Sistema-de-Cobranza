"use client"

import { useState, useRef, useTransition, useEffect } from "react"
import { FileUp, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import type { OcrContractResult } from "@/domain/ocr/schemas"
import type { ClientMatchResult } from "@/domain/ocr/match-client"

interface OcrImportDialogProps {
  onExtracted: (
    data: OcrContractResult,
    match: ClientMatchResult,
    document: OcrDocumentInfo
  ) => void
}

type Phase = "idle" | "uploading" | "processing" | "done" | "error"

export function OcrImportDialog({ onExtracted }: OcrImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const docIdRef = useRef<string | null>(null)

  // Cleanup polling on unmount or dialog close
  useEffect(() => {
    if (!open) {
      stopPolling()
      setPhase("idle")
      setFile(null)
      setErrorMsg("")
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

      // Poll every 2s
      pollingRef.current = setInterval(async () => {
        if (!docIdRef.current) return

        const poll = await getOcrResult(docIdRef.current)

        if (poll.status === "DONE") {
          stopPolling()
          setPhase("done")
          setOpen(false)
          onExtracted(poll.data, poll.match, poll.document)
        } else if (poll.status === "FAILED") {
          stopPolling()
          setPhase("error")
          setErrorMsg(poll.error)
        }
        // PENDING / PROCESSING → keep polling
      }, 2000)
    })
  }

  const isProcessing = phase === "uploading" || phase === "processing"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload className="mr-2 h-4 w-4" />
        Importar desde PDF
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar contrato desde PDF o imagen</DialogTitle>
          <DialogDescription>
            Claude Vision extraerá los datos automáticamente. El formulario se
            pre-cargará para que puedas revisar y corregir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {phase === "error" && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          {isProcessing ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {phase === "uploading"
                  ? "Subiendo archivo..."
                  : "Analizando contrato con IA..."}
              </p>
            </div>
          ) : (
            <div>
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
        </div>

        <DialogFooter>
          <Button
            onClick={handleProcess}
            disabled={!file || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              "Procesar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
