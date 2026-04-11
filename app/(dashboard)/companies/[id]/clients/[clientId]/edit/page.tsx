import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { getCompanyById } from "@/domain/companies/queries"
import { getClientById } from "@/domain/clients/queries"
import { ClientForm } from "@/components/clients/client-form"

interface Props {
  params: Promise<{ id: string; clientId: string }>
}

export default async function EditClientPage({ params }: Props) {
  const { id, clientId } = await params

  const [company, client] = await Promise.all([
    getCompanyById(id),
    getClientById(clientId),
  ])

  if (!company || !client || client.companyId !== id) notFound()

  async function action(formData: FormData) {
    "use server"
    const { updateClientAction } = await import(
      "@/app/(dashboard)/companies/[id]/clients/actions"
    )
    return updateClientAction(clientId, id, formData)
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
        <h1 className="text-xl font-semibold">Editar contacto</h1>
        <p className="text-sm text-muted-foreground">
          Modificá los datos de {client.fullName}
        </p>
      </div>

      <ClientForm
        defaultValues={client}
        action={action}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
