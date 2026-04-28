"use client"

import { useState } from "react"
import { ExternalLink, Maximize2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PdfPreviewPaneProps {
  fileUrl: string
  fileName: string
  mimeType: string
}

function isPdf(mimeType: string) {
  return mimeType === "application/pdf"
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/")
}

function ViewerBody({
  fileUrl,
  fileName,
  mimeType,
  className,
}: PdfPreviewPaneProps & { className?: string }) {
  if (isPdf(mimeType)) {
    return (
      <iframe
        src={`${fileUrl}#toolbar=1&navpanes=0&view=FitH`}
        className={className}
        title={fileName}
      />
    )
  }
  if (isImage(mimeType)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fileUrl}
        alt={fileName}
        className={`${className ?? ""} object-contain bg-muted`}
      />
    )
  }
  return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      Tipo de archivo no soportado para vista previa.{" "}
      <a className="ml-2 underline" href={fileUrl} target="_blank" rel="noreferrer">
        Abrir
      </a>
    </div>
  )
}

export function PdfPreviewPane({ fileUrl, fileName, mimeType }: PdfPreviewPaneProps) {
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <>
      <div className="sticky top-4 rounded-md border bg-card overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <Badge variant="outline" className="text-xs uppercase shrink-0">
            {isPdf(mimeType) ? "PDF" : isImage(mimeType) ? "Imagen" : "Archivo"}
          </Badge>
          <span className="text-xs text-muted-foreground truncate flex-1" title={fileName}>
            {fileName}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Pantalla completa"
            onClick={() => setFullscreen(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Abrir en pestaña nueva"
            asChild
          >
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
        <ViewerBody
          fileUrl={fileUrl}
          fileName={fileName}
          mimeType={mimeType}
          className="w-full h-[80vh] border-0"
        />
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 py-2 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs uppercase">
                {isPdf(mimeType) ? "PDF" : isImage(mimeType) ? "Imagen" : "Archivo"}
              </Badge>
              <span className="truncate">{fileName}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" asChild>
                <a href={fileUrl} target="_blank" rel="noreferrer" title="Abrir en pestaña">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </DialogTitle>
          </DialogHeader>
          <ViewerBody
            fileUrl={fileUrl}
            fileName={fileName}
            mimeType={mimeType}
            className="w-full flex-1 border-0"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
