import type { Metadata } from "next"
import { prisma } from "@/db/client"
import { PaymentsTable } from "@/components/payments/payments-table"
import { getPaymentsDomain } from "@/domain/payments/queries"
import { PaymentSheet } from "@/components/payments/payment-sheet"
import { ExportCsvButton } from "@/components/shared/export-csv-button"
import { exportPaymentsCsv } from "@/app/actions/export"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pagos | Sistema de Cobranza",
  description: "Gestión de cobros y pagos",
}

export default async function PaymentsPage() {
  const [data, clients] = await Promise.all([
    getPaymentsDomain(),
    prisma.client.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fullName: true,
        company: { select: { legalName: true } },
      },
      orderBy: { fullName: "asc" },
    }),
  ])

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: `${c.fullName} (${c.company.legalName})`,
  }))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pagos</h1>
          <p className="text-sm text-muted-foreground">Registro y control de cobros</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton action={exportPaymentsCsv} />
          <PaymentSheet clients={clientOptions} />
        </div>
      </div>

      <PaymentsTable data={data} />
    </div>
  )
}
