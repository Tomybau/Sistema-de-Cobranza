import { notFound } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { prisma } from "@/db/client"
import { formatMoney } from "@/lib/money"
import { AutoPrint } from "./_components/auto-print"

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Transferencia bancaria",
  CHECK: "Cheque",
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta de crédito",
  OTHER: "Otro",
}

interface Props {
  params: Promise<{ paymentId: string }>
  searchParams: Promise<{ print?: string }>
}

export default async function ReceiptPage({ params, searchParams }: Props) {
  const { paymentId } = await params
  const sp = await searchParams
  const autoPrint = sp.print === "1"

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      company: true,
      client: true,
      tickets: {
        include: {
          billingTicket: {
            include: {
              contractItem: { select: { name: true } },
              contract: { select: { contractNumber: true, title: true } },
            },
          },
        },
      },
    },
  })

  if (!payment) notFound()

  const total = payment.tickets.reduce(
    (acc, pt) => acc + parseFloat(pt.allocatedAmount.toString()),
    0
  )

  return (
    <html lang="es">
      <body className="receipt-body">
        <style>{`
          .receipt-body {
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            background: #f3f4f6;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt-wrap {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            padding: 48px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          }
          h1 { font-size: 28px; margin: 0; }
          h2 { font-size: 16px; margin: 0 0 8px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
          .muted { color: #64748b; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 24px; margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; padding: 8px; border-bottom: 1px solid #e2e8f0; letter-spacing: 0.05em; }
          td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .num { text-align: right; font-variant-numeric: tabular-nums; }
          .total-row td { border-top: 2px solid #0f172a; padding-top: 16px; font-weight: 600; font-size: 16px; }
          .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
          .actions { max-width: 800px; margin: 0 auto 16px; display: flex; gap: 8px; justify-content: flex-end; }
          .btn { padding: 8px 16px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; border: none; cursor: pointer; font-family: inherit; }
          @media print {
            .receipt-body { background: #fff; padding: 0; }
            .receipt-wrap { box-shadow: none; padding: 24px; max-width: none; border-radius: 0; }
            .actions { display: none !important; }
          }
        `}</style>

        <div className="actions">
          <button className="btn" onClick={undefined} type="button" {...({ "data-print": "true" } as any)}>
            Imprimir / Guardar PDF
          </button>
        </div>

        <div className="receipt-wrap">
          <div className="header">
            <div>
              <h1>Comprobante de pago</h1>
              <p className="muted" style={{ marginTop: 4 }}>
                Nº {payment.paymentNumber}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {format(new Date(payment.paymentDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
              <p className="muted" style={{ marginTop: 4 }}>
                {METHOD_LABELS[payment.method] ?? payment.method}
              </p>
            </div>
          </div>

          <div className="grid">
            <div>
              <h2>Empresa</h2>
              <p style={{ margin: 0, fontWeight: 600 }}>{payment.company.legalName}</p>
              {payment.company.taxId && (
                <p className="muted" style={{ marginTop: 4 }}>
                  {payment.company.taxIdType ?? "ID"}: {payment.company.taxId}
                </p>
              )}
              {payment.company.address && (
                <p className="muted" style={{ marginTop: 4 }}>{payment.company.address}</p>
              )}
            </div>
            <div>
              <h2>Datos del pago</h2>
              {payment.reference && (
                <p className="muted" style={{ margin: "0 0 4px" }}>
                  Referencia: <strong>{payment.reference}</strong>
                </p>
              )}
              {payment.client && (
                <p className="muted" style={{ margin: "0 0 4px" }}>
                  Contacto: {payment.client.fullName}
                </p>
              )}
            </div>
          </div>

          <h2>Tickets cubiertos</h2>
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Contrato</th>
                <th>Item</th>
                <th className="num">Monto asignado</th>
              </tr>
            </thead>
            <tbody>
              {payment.tickets.map((pt) => (
                <tr key={pt.id}>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>
                    {pt.billingTicket.ticketNumber}
                  </td>
                  <td>{pt.billingTicket.contract.title}</td>
                  <td>{pt.billingTicket.contractItem.name}</td>
                  <td className="num">
                    {formatMoney(pt.allocatedAmount.toString(), payment.currency)}
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={3}>Total</td>
                <td className="num">{formatMoney(total, payment.currency)}</td>
              </tr>
            </tbody>
          </table>

          {payment.notes && (
            <>
              <h2 style={{ marginTop: 32 }}>Notas</h2>
              <p style={{ margin: 0, fontSize: 14 }}>{payment.notes}</p>
            </>
          )}

          <div className="footer">
            Este comprobante fue emitido el{" "}
            {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })} por el sistema.
          </div>
        </div>

        <AutoPrint enabled={autoPrint} />
      </body>
    </html>
  )
}
