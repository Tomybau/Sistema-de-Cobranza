import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CompaniesTable } from "@/components/companies/companies-table"
import { listCompanies } from "@/domain/companies/queries"

export default async function CompaniesPage() {
  const companies = await listCompanies()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Empresas</h1>
          <p className="text-sm text-muted-foreground">
            Gestioná las empresas clientes del sistema
          </p>
        </div>
        <Button render={<Link href="/companies/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva empresa
        </Button>
      </div>

      <CompaniesTable data={companies} />

      <div className="text-center">
        <Link
          href="/companies/deleted"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver empresas eliminadas
        </Link>
      </div>
    </div>
  )
}
