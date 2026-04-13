import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { ContractForm } from "@/components/contracts/contract-form"
import { updateContractAction } from "@/app/(dashboard)/contracts/actions"
import { getContractById } from "@/domain/contracts/queries"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditContractPage({ params }: Props) {
  const { id } = await params
  const contract = await getContractById(id)
  if (!contract) notFound()

  const boundAction = updateContractAction.bind(null, id)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <Link
          href={`/contracts/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          {contract.contractNumber} — {contract.title}
        </Link>
        <h1 className="text-xl font-semibold">Editar contrato</h1>
        {contract.status === "ACTIVE" && (
          <p className="text-sm text-muted-foreground mt-1">
            Moneda y fecha de inicio bloqueadas — el contrato está activo.
          </p>
        )}
      </div>

      <ContractForm
        defaultValues={contract}
        action={boundAction}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
