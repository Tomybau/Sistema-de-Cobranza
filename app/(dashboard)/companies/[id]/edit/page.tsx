import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { CompanyForm } from "@/components/companies/company-form"
import { getCompanyById } from "@/domain/companies/queries"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditCompanyPage({ params }: Props) {
  const { id } = await params

  const company = await getCompanyById(id)
  if (!company) notFound()

  // Bind el id a la action — Server Actions no reciben params de route directamente
  async function action(formData: FormData) {
    "use server"
    const { updateCompanyAction: ua } = await import(
      "@/app/(dashboard)/companies/actions"
    )
    return ua(id, formData)
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <Link
          href={`/companies/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          {company.legalName}
        </Link>
        <h1 className="text-xl font-semibold">Editar empresa</h1>
        <p className="text-sm text-muted-foreground">
          Modificá los datos de {company.legalName}
        </p>
      </div>

      <CompanyForm
        defaultValues={company}
        action={action}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
