import { Metadata } from "next"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { prisma } from "@/db/client"
import { formatMoney } from "@/lib/money"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CancelPaymentButton } from "@/components/payments/cancel-payment-button"

export const metadata: Metadata = {
  title: "Detalle del Pago | Sistema de Cobranza",
}

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Transferencia",
  CHECK: "Cheque",
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta",
  OTHER: "Otro",
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      company: true,
      client: true,
      createdBy: { select: { name: true } },
      tickets: {
        include: {
          billingTicket: {
            include: { contractItem: true }
          }
        }
      }
    }
  })

  if (!payment) notFound()

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Comprobante {payment.paymentNumber}</h2>
          <p className="text-muted-foreground mt-1">
            Empresa: <Link href={`/companies/${payment.companyId}`} className="hover:underline text-primary">{payment.company.legalName}</Link>
          </p>
        </div>
        {payment.status === "PROCESSED" && (
          <CancelPaymentButton paymentId={payment.id} />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(payment.grossAmount.toString(), payment.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Método: {METHOD_LABELS[payment.method] ?? payment.method}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fecha de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {format(payment.paymentDate, "dd MMM yyyy", { locale: es })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mt-1">
              <Badge variant={payment.status === "PROCESSED" ? "default" : "destructive"} className="text-sm">
                {payment.status === "PROCESSED" ? "Procesado" : "Cancelado"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold truncate">
              {payment.reference || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              Por: {payment.createdBy.name}
            </p>
          </CardContent>
        </Card>
      </div>

      {payment.notes && (
        <Card>
          <CardContent className="pt-6">
            <h4 className="text-sm font-semibold mb-2">Notas</h4>
            <p className="text-sm text-muted-foreground">{payment.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tickets Imputados</CardTitle>
          <CardDescription>
            Detalle de la asignación del pago a los tickets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Ticket</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Estado Actual</TableHead>
                  <TableHead className="text-right">Monto Original</TableHead>
                  <TableHead className="text-right">Monto Asignado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.tickets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      No hay imputaciones registradas para este pago (ej. adelanto).
                    </TableCell>
                  </TableRow>
                )}
                {payment.tickets.map(pt => (
                  <TableRow key={pt.id}>
                    <TableCell>
                      <Link href={`/tickets/${pt.billingTicketId}`} className="font-mono text-sm hover:underline text-primary">
                        {pt.billingTicket.ticketNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[15rem] truncate text-sm">
                      {pt.billingTicket.contractItem.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {pt.billingTicket.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(pt.billingTicket.amount.toString(), pt.billingTicket.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(pt.allocatedAmount.toString(), payment.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
