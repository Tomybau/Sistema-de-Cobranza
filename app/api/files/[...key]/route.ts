import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getStorage } from "@/lib/storage"

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new NextResponse("No autorizado", { status: 401 })
  }

  const { key } = await params
  const fileKey = key.join("/")

  // Solo servir archivos de uploads conocidas
  if (!fileKey.startsWith("contracts/") && !fileKey.startsWith("payments/")) {
    return new NextResponse("Acceso no permitido", { status: 403 })
  }

  try {
    const storage = getStorage()
    const buffer = await storage.getBuffer(fileKey)

    const ext = fileKey.split(".").pop()?.toLowerCase() ?? ""
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream"

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileKey.split("/").pop()}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return new NextResponse("Archivo no encontrado", { status: 404 })
  }
}
