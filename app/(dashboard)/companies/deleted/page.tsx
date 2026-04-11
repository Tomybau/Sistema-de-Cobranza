import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { listDeletedCompanies } from "@/domain/companies/queries"
import { RestoreCompanyButton } from "./_components/restore-company-button"

export default async function DeletedCompaniesPage() {
  const companies = await listDeletedCompanies()

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Empresas
        </Link>
        <h1 className="text-xl font-semibold">Empresas eliminadas</h1>
        <p className="text-sm text-muted-foreground">
          Empresas con soft delete. Los datos y contratos se preservan.
        </p>
      </div>

      {companies.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay empresas eliminadas.
        </p>
      ) : (
        <div className="space-y-2">
          {companies.map((company) => (
            <div
              key={company.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <p className="font-medium text-sm">{company.legalName}</p>
                <p className="text-xs text-muted-foreground">
                  {company.taxId && `CUIT: ${company.taxId} · `}
                  Eliminada el{" "}
                  {format(new Date(company.deletedAt!), "dd 'de' MMMM 'de' yyyy", {
                    locale: es,
                  })}
                </p>
              </div>
              <RestoreCompanyButton companyId={company.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
