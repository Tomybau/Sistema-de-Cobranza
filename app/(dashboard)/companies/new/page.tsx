export const dynamic = "force-dynamic"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { CompanyForm } from "@/components/companies/company-form"
import { createCompanyAction } from "@/app/(dashboard)/companies/actions"

export default function NewCompanyPage() {
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
        <h1 className="text-xl font-semibold">Nueva empresa</h1>
        <p className="text-sm text-muted-foreground">
          Completá los datos de la empresa cliente
        </p>
      </div>

      <CompanyForm action={createCompanyAction} submitLabel="Crear empresa" />
    </div>
  )
}
