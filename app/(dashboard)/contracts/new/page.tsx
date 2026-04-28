export const dynamic = "force-dynamic"

import { listCompanies } from "@/domain/companies/queries"
import { NewContractPageClient } from "./_client"

interface Props {
  searchParams: Promise<{ companyId?: string }>
}

export default async function NewContractPage({ searchParams }: Props) {
  const { companyId } = await searchParams
  const companies = await listCompanies()

  return <NewContractPageClient companies={companies} preselectedCompanyId={companyId} />
}
