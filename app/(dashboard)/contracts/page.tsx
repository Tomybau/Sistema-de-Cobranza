export const dynamic = "force-dynamic"

import { listContracts } from "@/domain/contracts/queries"
import { ContractsTable } from "@/components/contracts/contracts-table"

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
