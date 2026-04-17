export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { listAllBillingTickets } from "@/domain/billing/queries"
import { TicketsTable } from "@/components/billing/tickets-table"
import { ExportCsvButton } from "@/components/shared/export-csv-button"
import { exportTicketsCsv } from "@/app/actions/export"

export const metadata: Metadata = {
  title: "Tickets | Sistema de Cobranza",
  description: "Tickets de cobro generados en el sistema",
}

export default async function TicketsPage() {
  const tickets = await listAllBillingTickets()
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tickets de cobro</h1>
          <p className="text-sm text-muted-foreground">
            Todos los tickets generados en el sistema.
          </p>
        </div>
        <ExportCsvButton action={exportTicketsCsv} />
      </div>
      <TicketsTable data={tickets} />
    </div>
  )
}
