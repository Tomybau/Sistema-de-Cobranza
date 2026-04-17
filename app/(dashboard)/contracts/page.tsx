export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { listContracts } from "@/domain/contracts/queries"
import { ContractsTable } from "@/components/contracts/contracts-table"

export const metadata: Metadata = {
  title: "Contratos | Sistema de Cobranza",
  description: "Contratos activos y archivados del sistema",
}

export default async function ContractsPage() {
  const contracts = await listContracts()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Contratos</h1>
        <p className="text-sm text-muted-foreground">
          Todos los contratos del sistema
        </p>
      </div>

      <ContractsTable data={contracts} showCompany={true} />
    </div>
  )
}
