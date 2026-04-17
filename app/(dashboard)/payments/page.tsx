import type { Metadata } from "next"
import { PaymentsTable } from "@/components/payments/payments-table"
import { getPaymentsDomain } from "@/domain/payments/queries"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { ExportCsvButton } from "@/components/shared/export-csv-button"
import { exportPaymentsCsv } from "@/app/actions/export"

export const metadata: Metadata = {
  title: "Pagos | Sistema de Cobranza",
  description: "Gestión de cobros y pagos",
}

export default async function PaymentsPage() {
  const data = await getPaymentsDomain()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pagos</h2>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton action={exportPaymentsCsv} />
          <Button asChild>
            <Link href="/payments/new">
              <Plus className="mr-2 h-4 w-4" />
              Registrar Pago
            </Link>
          </Button>
        </div>
      </div>

      <PaymentsTable data={data} />
    </div>
  )
}
