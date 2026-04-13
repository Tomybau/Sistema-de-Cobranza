export const dynamic = "force-dynamic"

import { listAllBillingTickets } from "@/domain/billing/queries"
import { TicketsTable } from "@/components/billing/tickets-table"

export default async function TicketsPage() {
  const tickets = await listAllBillingTickets()
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Tickets de cobro</h1>
        <p className="text-sm text-muted-foreground">
          Todos los tickets generados en el sistema.
        </p>
      </div>
      <TicketsTable data={tickets} />
    </div>
  )
}
