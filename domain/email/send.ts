// domain/email/send.ts
import { PrismaClient, EmailLogStatus } from "@prisma/client"
import { resend } from "@/lib/resend"
import { interpolate, InterpolationContext } from "./interpolate"

const prisma = new PrismaClient()

export type SendResult = {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendTicketEmail(ticketId: string, templateId: string): Promise<SendResult> {
  const ticket = await prisma.billingTicket.findUnique({
    where: { id: ticketId },
    include: {
      contract: {
        include: { company: true }
      },
      contractItem: true,
      emailLogs: {
        where: { templateId, status: EmailLogStatus.SENT }
      }
    }
  })

  if (!ticket) throw new Error("Ticket no encontrado")
  if (ticket.status === "CANCELLED" || ticket.status === "DRAFT" as any) {
    throw new Error("No se puede enviar email para tickets en estado inválido (DRAFT/CANCELLED)")
  }
  
  if (ticket.emailLogs && ticket.emailLogs.length > 0) {
    throw new Error("Ya existe un email enviado con este template para este ticket.")
  }

  const template = await prisma.emailTemplate.findUnique({
    where: { id: templateId }
  })

  if (!template) throw new Error("Template no encontrado")

  if (template.companyId !== ticket.contract.companyId) {
    throw new Error("El template no pertenece a la misma compañía del ticket")
  }

  // Find primary client for the company
  const client = await prisma.client.findFirst({
    where: { companyId: ticket.contract.companyId, deletedAt: null, isPrimary: true },
    orderBy: { createdAt: 'asc' }
  })

  if (!client) throw new Error("No existe un cliente principal al cual enviarle el correo")
  
  // Log entry - first mark as PENDING
  const emailLog = await prisma.emailLog.create({
    data: {
      ticketId,
      templateId,
      toEmail: client.email,
      subject: template.subject, // we will interpolate this later actually, 
      status: EmailLogStatus.PENDING,
    }
  })

  try {
    const context: InterpolationContext = {
      client_name: client.fullName,
      client_email: client.email,
      company_name: ticket.contract.company.legalName,
      ticket_number: ticket.ticketNumber,
      ticket_amount: ticket.amount,
      ticket_currency: ticket.currency,
      ticket_due_date: ticket.dueDate,
      ticket_period_start: ticket.periodStart,
      ticket_period_end: ticket.periodEnd,
      contract_name: ticket.contract.title,
    }

    const subjectInterpolated = interpolate(template.subject, context)
    const bodyHtmlInterpolated = interpolate(template.bodyHtml, context)

    // update subject in log realistically
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { subject: subjectInterpolated }
    })

    const fromEmail = process.env.RESEND_FROM_EMAIL || "test@test.com"
    const fromName = process.env.RESEND_FROM_NAME || "Sistema de Cobranza"

    const response = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [client.email],
      subject: subjectInterpolated,
      html: bodyHtmlInterpolated,
    })

    if (response.error) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailLogStatus.FAILED,
          errorMessage: response.error.message,
        }
      })
      
      return { success: false, error: response.error.message }
    } else {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailLogStatus.SENT,
          sentAt: new Date(),
          resendMessageId: response.data!.id,
        }
      })
      
      // Update the ticket status to SENT if it was PENDING
      if (ticket.status === "PENDING") {
        await prisma.billingTicket.update({
          where: { id: ticket.id },
          data: { status: "SENT" }
        })
      }
      
      return { success: true, messageId: response.data!.id }
    }
  } catch (error: any) {
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: EmailLogStatus.FAILED,
        errorMessage: error.message || "Unknown error",
      }
    })
    
    return { success: false, error: error.message || "Unknown error" }
  }
}
