export const dynamic = "force-dynamic"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { ContractForm } from "@/components/contracts/contract-form"
import { createContractAction } from "@/app/(dashboard)/contracts/actions"
import { listCompanies } from "@/domain/companies/queries"

interface Props {
  searchParams: Promise<{ companyId?: string }>
}

export default async function NewContractPage({ searchParams }: Props) {
  const { companyId } = await searchParams
  const companies = await listCompanies()

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <Link
          href={companyId ? `/companies/${companyId}?tab=contracts` : "/contracts"}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          {companyId ? "Volver a la empresa" : "Contratos"}
        </Link>
        <h1 className="text-xl font-semibold">Nuevo contrato</h1>
      </div>

      <ContractForm
        companies={companies}
        preselectedCompanyId={companyId}
        action={createContractAction}
        submitLabel="Crear contrato"
      />
    </div>
  )
}
