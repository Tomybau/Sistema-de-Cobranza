export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { getBillingTicketById } from "@/domain/billing/queries"
import { formatMoney } from "@/lib/money"
import { CancelTicketButton } from "@/components/billing/cancel-ticket-button"
import { MarkSentButton } from "@/components/billing/mark-sent-button"
import { SendEmailDialog } from "@/components/email/send-email-dialog"
import { prisma } from "@/db/client"

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
  PARTIAL: "Parcial",
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING: "secondary",
  SENT: "default",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "outline",
  PARTIAL: "secondary",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function TicketDetailPage({ params }: Props) {
  const { id } = await params
  const ticket = await getBillingTicketById(id)
  if (!ticket) notFound()

  const canCancel =
    ticket.status !== "PAID" && ticket.status !== "CANCELLED"
  const canMarkSent = ticket.status === "PENDING"
  const isInvalidForEmail = ticket.status === "CANCELLED" || ticket.status === ("DRAFT" as any)

  const templates = await prisma.emailTemplate.findMany({
    where: { companyId: ticket.companyId },
    select: { id: true, name: true, subject: true, isDefault: true }
  })

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Tickets
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold font-mono">
              {ticket.ticketNumber}
            </h1>
            <Badge variant={STATUS_VARIANTS[ticket.status] ?? "outline"}>
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </Badge>
          </div>
        </div>
        {/* Acciones */}
        <div className="flex gap-2">
          <SendEmailDialog 
            ticketId={ticket.id} 
            templates={templates} 
            disabled={isInvalidForEmail}
          />
          {canMarkSent && <MarkSentButton ticketId={id} />}
          {canCancel && <CancelTicketButton ticketId={id} disabled={false} />}
        </div>
      </div>

      {/* Detalles del ticket */}
      <section className="rounded-md border p-4 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Detalles
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm">
          <div>
            <p className="text-muted-foreground">Empresa</p>
            <Link
              href={`/companies/${ticket.companyId}`}
              className="font-medium hover:underline"
            >
              {ticket.companyName}
            </Link>
          </div>
          <div>
            <p className="text-muted-foreground">Contrato</p>
            <Link
              href={`/contracts/${ticket.contractId}`}
              className="font-medium hover:underline"
            >
              {ticket.contractNumber} — {ticket.contractTitle}
            </Link>
          </div>
          <div>
            <p className="text-muted-foreground">Item</p>
            <p className="font-medium">{ticket.itemName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Período</p>
            <p className="font-medium">
              {ticket.periodStart
                ? format(new Date(ticket.periodStart), "MMM yyyy", {
                    locale: es,
                  })
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha de emisión</p>
            <p className="font-medium">
              {format(new Date(ticket.issueDate), "dd MMM yyyy", {
                locale: es,
              })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Vencimiento</p>
            <p className="font-medium">
              {format(new Date(ticket.dueDate), "dd MMM yyyy", {
                locale: es,
              })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Monto</p>
            <p className="font-medium tabular-nums">
              {formatMoney(ticket.amount, ticket.currency)}
            </p>
          </div>
          {ticket.variableQuantity && (
            <div>
              <p className="text-muted-foreground">Cantidad variable</p>
              <p className="font-medium tabular-nums">
                {ticket.variableQuantity}
              </p>
            </div>
          )}
          {ticket.notes && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-muted-foreground">Notas</p>
              <p>{ticket.notes}</p>
            </div>
          )}
          {ticket.paidAt && (
            <div>
              <p className="text-muted-foreground">Fecha de pago</p>
              <p className="font-medium">
                {format(new Date(ticket.paidAt), "dd MMM yyyy", {
                  locale: es,
                })}
              </p>
            </div>
          )}
          {ticket.cancelledAt && (
            <div>
              <p className="text-muted-foreground">Fecha de cancelación</p>
              <p className="font-medium">
                {format(new Date(ticket.cancelledAt), "dd MMM yyyy", {
                  locale: es,
                })}
              </p>
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* Emails enviados */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Emails enviados
          {ticket.emailLogs.length > 0 && (
            <span className="ml-2 normal-case font-normal text-foreground">
              ({ticket.emailLogs.length})
            </span>
          )}
        </h2>
        {ticket.emailLogs.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">
              No se han enviado correos para este ticket.
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Template</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asunto (Aprox)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ticket.emailLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2">
                      {log.sentAt ? format(new Date(log.sentAt), "dd MMM yyyy HH:mm", { locale: es }) : format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                    </td>
                    <td className="px-3 py-2 font-medium">{log.templateName}</td>
                    <td className="px-3 py-2">
                      <Badge variant={log.status === "SENT" ? "default" : log.status === "FAILED" ? "destructive" : "secondary"}>
                        {log.status === "SENT" ? "Enviado" : log.status === "FAILED" ? "Falló" : log.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">{log.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Separator />

      {/* Pagos aplicados */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Pagos aplicados
          {ticket.payments.length > 0 && (
            <span className="ml-2 normal-case font-normal text-foreground">
              ({ticket.payments.length})
            </span>
          )}
        </h2>
        {ticket.payments.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Sin pagos registrados.
            </p>
            {/* Placeholder: "Registrar pago" se agrega en Session 5 */}
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Número
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Fecha
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Método
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                    Importe aplicado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ticket.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {p.paymentNumber}
                    </td>
                    <td className="px-3 py-2">
                      {format(new Date(p.paymentDate), "dd MMM yyyy", {
                        locale: es,
                      })}
                    </td>
                    <td className="px-3 py-2">{p.method}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatMoney(p.amountApplied, p.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
