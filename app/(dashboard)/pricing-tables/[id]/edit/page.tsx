import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PricingTableForm } from "@/components/pricing-tables/pricing-table-form"
import { updatePricingTableAction } from "@/app/(dashboard)/pricing-tables/actions"
import { getPricingTableById } from "@/domain/pricing_tables/queries"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditPricingTablePage({ params }: Props) {
  const { id } = await params
  const table = await getPricingTableById(id)
  if (!table) notFound()

  const boundAction = updatePricingTableAction.bind(null, id)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <Link
          href={`/pricing-tables/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          {table.name}
        </Link>
        <h1 className="text-xl font-semibold">Editar tabla de precios</h1>
      </div>

      <PricingTableForm
        defaultValues={table}
        action={boundAction}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
