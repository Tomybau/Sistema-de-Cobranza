export const dynamic = "force-dynamic"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PricingTableForm } from "@/components/pricing-tables/pricing-table-form"
import { createPricingTableAction } from "@/app/(dashboard)/pricing-tables/actions"

interface Props {
  searchParams: Promise<{ contractId?: string }>
}

export default async function NewPricingTablePage({ searchParams }: Props) {
  const { contractId } = await searchParams
  const backHref = contractId ? `/contracts/${contractId}` : "/pricing-tables"
  const backLabel = contractId ? "Volver al contrato" : "Tablas de precios"

  const boundAction = createPricingTableAction.bind(null, contractId ?? null)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <h1 className="text-xl font-semibold">Nueva tabla de precios</h1>
        {contractId && (
          <p className="text-sm text-muted-foreground mt-1">
            Esta tabla quedará asociada al contrato.
          </p>
        )}
      </div>

      <PricingTableForm action={boundAction} submitLabel="Crear tabla" />
    </div>
  )
}
