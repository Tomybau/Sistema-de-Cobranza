"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { ContractForm } from "@/components/contracts/contract-form"
import { OcrImportDialog } from "@/components/contracts/ocr-import-dialog"
import { PdfPreviewPane } from "@/components/contracts/pdf-preview-pane"
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

  const hasPreview = !!ocrDocument

  return (
    <div className={`p-6 space-y-6 ${hasPreview ? "max-w-[1600px]" : "max-w-3xl"}`}>
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={
              preselectedCompanyId
                ? `/companies/${preselectedCompanyId}?tab=contracts`
                : "/contracts"
            }
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {preselectedCompanyId ? "Volver a la empresa" : "Contratos"}
          </Link>
          <h1 className="text-xl font-semibold">Nuevo contrato</h1>
        </div>
        <OcrImportDialog onExtracted={handleExtracted} />
      </div>

      <div
        className={
          hasPreview
            ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start"
            : ""
        }
      >
        <ContractForm
          companies={companies}
          preselectedCompanyId={preselectedCompanyId}
          createFullAction={createContractFullAction}
          submitLabel="Crear contrato"
          ocrData={ocrData}
          ocrMatch={ocrMatch}
          ocrDocumentId={ocrDocument?.id ?? null}
        />
        {hasPreview && ocrDocument && (
          <div>
            <PdfPreviewPane
              fileUrl={ocrDocument.fileUrl}
              fileName={ocrDocument.fileName}
              mimeType={ocrDocument.mimeType}
            />
          </div>
        )}
      </div>
    </div>
  )
}
