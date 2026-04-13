"use server"

import { prisma } from "@/db/client"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { createAuditLog } from "@/domain/audit"

export type ActionResult =
  | { success: true }
  | { success: false; error: string }

async function getUserId() {
  const session = await auth()
  return session?.user?.id
}

export async function cancelTicketAction(
  ticketId: string
): Promise<ActionResult> {
  const userId = await getUserId()

  const ticket = await prisma.billingTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, ticketNumber: true },
  })

  if (!ticket) return { success: false, error: "Ticket no encontrado." }
  if (ticket.status === "PAID")
    return { success: false, error: "No se puede cancelar un ticket pagado." }
  if (ticket.status === "CANCELLED")
    return { success: false, error: "El ticket ya está cancelado." }

  const beforeStatus = ticket.status

  await prisma.$transaction(async (tx) => {
    await tx.billingTicket.update({
      where: { id: ticketId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    })
    await createAuditLog(tx as Parameters<typeof createAuditLog>[0], {
      userId,
      action: "ticket.cancel",
      entityType: "BillingTicket",
      entityId: ticketId,
      beforeData: { status: beforeStatus },
      afterData: { status: "CANCELLED", cancelledAt: new Date().toISOString() },
    })
  })

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath("/tickets")
  return { success: true }
}

export async function markTicketSentAction(
  ticketId: string
): Promise<ActionResult> {
  const userId = await getUserId()

  const ticket = await prisma.billingTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  })

  if (!ticket) return { success: false, error: "Ticket no encontrado." }
  if (ticket.status !== "PENDING")
    return {
      success: false,
      error:
        "Solo se pueden marcar como enviados los tickets en estado Pendiente.",
    }

  await prisma.$transaction(async (tx) => {
    await tx.billingTicket.update({
      where: { id: ticketId },
      data: { status: "SENT" },
    })
    await createAuditLog(tx as Parameters<typeof createAuditLog>[0], {
      userId,
      action: "ticket.mark_sent",
      entityType: "BillingTicket",
      entityId: ticketId,
      beforeData: { status: "PENDING" },
      afterData: { status: "SENT" },
    })
  })

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath("/tickets")
  return { success: true }
}
