import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { getCompanyById } from "@/domain/companies/queries"
import { ClientForm } from "@/components/clients/client-form"

interface Props {
  params: Promise<{ id: string }>
}

export default async function NewClientPage({ params }: Props) {
  const { id } = await params

  const company = await getCompanyById(id)
  if (!company) notFound()

  async function action(formData: FormData) {
    "use server"
    const { createClientAction: ca } = await import(
      "@/app/(dashboard)/companies/[id]/clients/actions"
    )
    return ca(id, formData)
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <Link
          href={`/companies/${id}?tab=clients`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          {company.legalName}
        </Link>
        <h1 className="text-xl font-semibold">Nuevo contacto</h1>
        <p className="text-sm text-muted-foreground">
          Agregá un contacto a {company.legalName}
        </p>
      </div>

      <ClientForm action={action} submitLabel="Crear contacto" />
    </div>
  )
}
