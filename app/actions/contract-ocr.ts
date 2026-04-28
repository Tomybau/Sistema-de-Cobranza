"use server"

import { auth } from "@/auth"
import { prisma } from "@/db/client"
import { getStorage } from "@/lib/storage"
import { extractContractFromFile } from "@/domain/ocr/extract-contract"
import { matchClient, type ClientMatchResult } from "@/domain/ocr/match-client"
import type { OcrContractResult } from "@/domain/ocr/schemas"
import { randomUUID } from "crypto"

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// ─── Upload + kick off OCR ────────────────────────────────────────────────────

export async function uploadContractDocument(
  formData: FormData
): Promise<{ success: true; documentId: string } | { success: false; error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "No autorizado." }

  // Verificar que el userId existe en la DB (el JWT puede tener un ID stale)
  let uploaderId = session.user.id
  const userExists = await prisma.user.findUnique({
    where: { id: uploaderId },
    select: { id: true },
  })
  if (!userExists) {
    // Fallback: primer admin activo
    const fallback = await prisma.user.findFirst({
      where: { isActive: true },
      select: { id: true },
    })
    if (!fallback) return { success: false, error: "No hay usuarios activos en el sistema." }
    uploaderId = fallback.id
  }

  const file = formData.get("file") as File | null
  if (!file) return { success: false, error: "No se proporcionó un archivo." }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { success: false, error: `Tipo de archivo no soportado: ${file.type}` }
  }
  if (file.size > MAX_SIZE) {
    return { success: false, error: "El archivo supera el límite de 10MB." }
  }

  const ext = file.name.split(".").pop() ?? "bin"
  const storageKey = `contracts/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const storage = getStorage()
  await storage.save(storageKey, buffer, file.type)

  const doc = await prisma.contractDocument.create({
    data: {
      storageKey,
      fileName: file.name,
      mimeType: file.type,
      ocrStatus: "PENDING",
      uploadedBy: uploaderId,
    },
  })

  // Disparar OCR en background (fire-and-forget, no bloquea response)
  runOcr(doc.id, buffer, file.type).catch((err) => {
    console.error("[contract-ocr] OCR background error:", err)
  })

  return { success: true, documentId: doc.id }
}

async function runOcr(
  documentId: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  await prisma.contractDocument.update({
    where: { id: documentId },
    data: { ocrStatus: "PROCESSING" },
  })

  try {
    const extracted = await extractContractFromFile(buffer, mimeType)

    await prisma.contractDocument.update({
      where: { id: documentId },
      data: {
        ocrStatus: "DONE",
        ocrExtracted: extracted as object,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    await prisma.contractDocument.update({
      where: { id: documentId },
      data: {
        ocrStatus: "FAILED",
        ocrRawText: `Error: ${msg}`,
      },
    })
  }
}

// ─── Poll OCR result ──────────────────────────────────────────────────────────

export type OcrDocumentInfo = {
  id: string
  fileUrl: string
  fileName: string
  mimeType: string
}

export type OcrPollResult =
  | { status: "PENDING" | "PROCESSING" }
  | { status: "FAILED"; error: string }
  | {
      status: "DONE"
      data: OcrContractResult
      match: ClientMatchResult
      document: OcrDocumentInfo
    }

export async function getOcrResult(documentId: string): Promise<OcrPollResult> {
  const session = await auth()
  if (!session?.user?.id) return { status: "FAILED", error: "No autorizado." }

  const doc = await prisma.contractDocument.findUnique({
    where: { id: documentId },
  })

  if (!doc) return { status: "FAILED", error: "Documento no encontrado." }

  if (doc.ocrStatus === "PENDING" || doc.ocrStatus === "PROCESSING") {
    return { status: doc.ocrStatus }
  }

  if (doc.ocrStatus === "FAILED") {
    return { status: "FAILED", error: doc.ocrRawText ?? "Error en OCR." }
  }

  // DONE
  const data = doc.ocrExtracted as OcrContractResult
  const match = await matchClient(data.client)
  const storage = getStorage()

  return {
    status: "DONE",
    data,
    match,
    document: {
      id: doc.id,
      fileUrl: storage.getUrl(doc.storageKey),
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    },
  }
}

// ─── Link document to contract once created ───────────────────────────────────

export async function linkDocumentToContract(
  documentId: string,
  contractId: string
): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) return

  await prisma.contractDocument.updateMany({
    where: { id: documentId, uploadedBy: session.user.id },
    data: { contractId },
  })
}
