"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { registerPayment, cancelPayment, RegisterPaymentInput } from "@/domain/payments/handlers"
import { headers } from "next/headers"
import { getStorage } from "@/lib/storage"
import { randomUUID } from "crypto"

export type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string }

const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024 // 5MB

export async function createPaymentAction(
  input: Omit<RegisterPaymentInput, "createdById" | "ipAddress" | "userAgent">,
  attachmentFile?: File | null
): Promise<ActionResult> {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return { success: false, error: "No autorizado." }
  }

  const h = await headers()
  const ipAddress = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined
  const userAgent = h.get("user-agent") ?? undefined

  // Handle optional file attachment
  let attachmentKey: string | undefined
  let attachmentName: string | undefined

  if (attachmentFile && attachmentFile.size > 0) {
    if (!ALLOWED_ATTACHMENT_TYPES.includes(attachmentFile.type)) {
      return { success: false, error: `Tipo de archivo no soportado: ${attachmentFile.type}` }
    }
    if (attachmentFile.size > MAX_ATTACHMENT_SIZE) {
      return { success: false, error: "El comprobante supera el límite de 5MB." }
    }
    const ext = attachmentFile.name.split(".").pop() ?? "bin"
    attachmentKey = `payments/${randomUUID()}.${ext}`
    attachmentName = attachmentFile.name
    const buffer = Buffer.from(await attachmentFile.arrayBuffer())
    const storage = getStorage()
    await storage.save(attachmentKey, buffer, attachmentFile.type)
  }

  try {
    await registerPayment({
      ...input,
      createdById: userId,
      ipAddress,
      userAgent,
      attachmentKey,
      attachmentName,
    })
    
    revalidatePath("/payments")
    revalidatePath("/tickets") // depending on which ticket pages show payment statuses
    
    // Also revalidate specific company/client if necessary
    if (input.companyId) {
      revalidatePath(`/companies/${input.companyId}`)
    }

    return { success: true }
  } catch (error) {
    console.error("[createPaymentAction] Error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Error al registrar pago." 
    }
  }
}

export async function cancelPaymentAction(
  paymentId: string
): Promise<ActionResult> {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return { success: false, error: "No autorizado." }
  }

  const h = await headers()
  const ipAddress = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined
  const userAgent = h.get("user-agent") ?? undefined

  try {
    await cancelPayment(paymentId, userId, ipAddress, userAgent)

    revalidatePath("/payments")
    revalidatePath(`/payments/${paymentId}`)
    revalidatePath("/tickets")

    return { success: true }
  } catch (error) {
    console.error("[cancelPaymentAction] Error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Error al cancelar pago." 
    }
  }
}

export async function getClientTicketsAction(clientId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autorizado")

  const { prisma } = await import("@/db/client")
  
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { companyId: true, company: { select: { legalName: true } } }
  })

  if (!client) throw new Error("Cliente no encontrado")

  const tickets = await prisma.billingTicket.findMany({
    where: {
      contract: { companyId: client.companyId },
      status: { in: ["PENDING", "PARTIAL"] }
    },
    include: {
      contract: { select: { title: true } },
      contractItem: { select: { name: true } }
    },
    orderBy: { dueDate: "asc" }
  })

  return {
    tickets,
    companyId: client.companyId,
    companyName: client.company.legalName
  }
}
