"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { registerPayment, cancelPayment, RegisterPaymentInput } from "@/domain/payments/handlers"
import { headers } from "next/headers"

export type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string }

export async function createPaymentAction(
  input: Omit<RegisterPaymentInput, "createdById" | "ipAddress" | "userAgent">
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
    await registerPayment({
      ...input,
      createdById: userId,
      ipAddress,
      userAgent
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
