"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { sendTicketEmail } from "@/domain/email/send"

export type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string }

export async function sendTicketEmailAction(ticketId: string, templateId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "No autorizado." }
  }

  try {
    const result = await sendTicketEmail(ticketId, templateId)
    
    // Always revalidate the ticket page to show the new EmailLog and possibly updated status
    revalidatePath(`/tickets/${ticketId}`)
    revalidatePath("/tickets")
    
    if (result.success) {
      return { success: true }
    } else {
      return { success: false, error: result.error || "Error al enviar el email" }
    }
  } catch (error) {
    console.error("[sendTicketEmailAction] Error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Ocurrió un error inesperado al enviar." 
    }
  }
}
