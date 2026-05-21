"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { ContractForm } from "@/components/contracts/contract-form"
import { OcrImportDialog } from "@/components/contracts/ocr-import-dialog"
import { PdfPreviewPane } from "@/components/contracts/pdf-preview-pane"
import { OcrContractReviewForm } from "@/components/contracts/ocr-contract-review-form"
import { createContractFullAction } from "@/app/(dashboard)/contracts/actions"
import type { OcrDocumentInfo } from "@/app/actions/contract-ocr"
import type { OcrContractResult } from "@/domain/ocr/schemas"
import type { ClientMatchResult } from "@/domain/ocr/match-client"

interface Props {
  companies: { id: string; legalName: string }[]
  preselectedCompanyId?: string
}

export function NewContractPageClient({ companies, preselectedCompanyId }: Props) {
  const [ocrData, setOcrData] = useState<OcrContractResult | null>(null)
  const [ocrMatch, setOcrMatch] = useState<ClientMatchResult | null>(null)
  const [ocrDocument, setOcrDocument] = useState<OcrDocumentInfo | null>(null)

  function handleExtracted(
    data: OcrContractResult,
    match: ClientMatchResult,
    document: OcrDocumentInfo
  ) {
    setOcrData(data)
    setOcrMatch(match)
    setOcrDocument(document)
  }

  function handleCancel() {
    setOcrData(null)
    setOcrMatch(null)
    setOcrDocument(null)
  }

  const backHref = preselectedCompanyId
    ? `/companies/${preselectedCompanyId}?tab=contracts`
    : "/contracts"
  const backLabel = preselectedCompanyId ? "Volver a la empresa" : "Contratos"

  // ── Modo OCR: split layout PDF | formulario unificado ────────────────────
  if (ocrData && ocrMatch && ocrDocument) {
    return (
      <div className="p-6 max-w-[1600px]">
        <div className="mb-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <h1 className="text-xl font-semibold">Nuevo contrato — revisión del documento</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verificá los datos extraídos contra el PDF original y corregí lo que sea necesario.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Columna izquierda: PDF */}
          <PdfPreviewPane
            fileUrl={ocrDocument.fileUrl}
            fileName={ocrDocument.fileName}
            mimeType={ocrDocument.mimeType}
          />

          {/* Columna derecha: formulario unificado */}
          <OcrContractReviewForm
            ocrData={ocrData}
            ocrMatch={ocrMatch}
            ocrDocumentId={ocrDocument.id}
            companies={companies}
            createFullAction={createContractFullAction}
            onCancel={handleCancel}
          />
        </div>
      </div>
    )
  }

  // ── Modo normal: formulario vacío + botón de importación ─────────────────
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <h1 className="text-xl font-semibold">Nuevo contrato</h1>
        </div>
        <OcrImportDialog onExtracted={handleExtracted} />
      </div>

      <ContractForm
        companies={companies}
        preselectedCompanyId={preselectedCompanyId}
        createFullAction={createContractFullAction}
        submitLabel="Crear contrato"
      />
    </div>
  )
}
