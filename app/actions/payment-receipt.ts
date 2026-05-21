"use server"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { prisma } from "@/db/client"
import { resend } from "@/lib/resend"
import { formatMoney } from "@/lib/money"

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Transferencia bancaria",
  CHECK: "Cheque",
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta",
  OTHER: "Otro",
}

export type SendReceiptResult =
  | { success: true; sentTo: string[] }
  | { success: false; error: string }

function buildReceiptHtml(payment: {
  paymentNumber: string
  paymentDate: Date
  method: string
  reference: string | null
  notes: string | null
  currency: string
  company: { legalName: string }
  tickets: Array<{
    allocatedAmount: { toString(): string }
    billingTicket: {
      ticketNumber: string
      contractItem: { name: string }
      contract: { title: string }
    }
  }>
}) {
  const total = payment.tickets.reduce(
    (acc, pt) => acc + parseFloat(pt.allocatedAmount.toString()),
    0
  )
  const rows = payment.tickets
    .map(
      (pt) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-family:ui-monospace,monospace;font-size:13px;">${pt.billingTicket.ticketNumber}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;">${pt.billingTicket.contract.title}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;">${pt.billingTicket.contractItem.name}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-variant-numeric:tabular-nums;">${formatMoney(pt.allocatedAmount.toString(), payment.currency)}</td>
        </tr>
      `
    )
    .join("")
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:24px;">
      <div>
        <h1 style="margin:0;font-size:24px;">Comprobante de pago</h1>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">N° ${payment.paymentNumber}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-weight:600;">${format(payment.paymentDate, "dd 'de' MMMM 'de' yyyy", { locale: es })}</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${METHOD_LABELS[payment.method] ?? payment.method}</p>
      </div>
    </div>

    <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;">Empresa</p>
    <p style="margin:0 0 24px;font-weight:600;font-size:16px;">${payment.company.legalName}</p>

    ${payment.reference ? `<p style="margin:0 0 8px;color:#64748b;font-size:13px;">Referencia: <strong>${payment.reference}</strong></p>` : ""}

    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;text-transform:uppercase;color:#475569;padding:8px;border-bottom:1px solid #e2e8f0;letter-spacing:0.05em;">Ticket</th>
          <th style="text-align:left;font-size:11px;text-transform:uppercase;color:#475569;padding:8px;border-bottom:1px solid #e2e8f0;letter-spacing:0.05em;">Contrato</th>
          <th style="text-align:left;font-size:11px;text-transform:uppercase;color:#475569;padding:8px;border-bottom:1px solid #e2e8f0;letter-spacing:0.05em;">Item</th>
          <th style="text-align:right;font-size:11px;text-transform:uppercase;color:#475569;padding:8px;border-bottom:1px solid #e2e8f0;letter-spacing:0.05em;">Asignado</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td colspan="3" style="padding:16px 8px 0;border-top:2px solid #0f172a;font-weight:600;font-size:15px;">Total</td>
          <td style="padding:16px 8px 0;border-top:2px solid #0f172a;font-weight:600;font-size:15px;text-align:right;font-variant-numeric:tabular-nums;">${formatMoney(total, payment.currency)}</td>
        </tr>
      </tbody>
    </table>

    ${payment.notes ? `<p style="margin:24px 0 0;font-size:13px;color:#475569;"><strong>Notas:</strong> ${payment.notes}</p>` : ""}

    <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
      Comprobante emitido el ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}.
    </p>
  </div>
</body>
</html>`
}

export async function sendPaymentReceiptAction(paymentId: string): Promise<SendReceiptResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      company: true,
      tickets: {
        include: {
          billingTicket: {
            include: {
              contractItem: { select: { name: true } },
              contract: { select: { title: true } },
            },
          },
        },
      },
    },
  })

  if (!payment) return { success: false, error: "Pago no encontrado" }

  // Destinatarios: BILLING_CONTACT + primary + email de la company
  const contacts = await prisma.client.findMany({
    where: { companyId: payment.companyId, deletedAt: null },
    select: { email: true, isPrimary: true, clientType: true },
  })
  const recipients = new Set<string>()
  for (const c of contacts) {
    if (!c.email) continue
    if (c.clientType === "BILLING_CONTACT" || c.isPrimary) {
      recipients.add(c.email)
    }
  }
  if (recipients.size === 0 && payment.company.email) {
    recipients.add(payment.company.email)
  }
  if (recipients.size === 0) {
    return { success: false, error: "La empresa no tiene contactos con email." }
  }

  const html = buildReceiptHtml(payment)
  const subject = `Comprobante de pago ${payment.paymentNumber} — ${payment.company.legalName}`

  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@test.com"
  const fromName = process.env.RESEND_FROM_NAME || "Sistema de Cobranza"

  try {
    const res = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: Array.from(recipients),
      subject,
      html,
    })
    if (res.error) return { success: false, error: res.error.message }
    return { success: true, sentTo: Array.from(recipients) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Error al enviar" }
  }
}
