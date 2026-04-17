export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PricingTablesTable } from "@/components/pricing-tables/pricing-tables-table"
import { listPricingTables } from "@/domain/pricing_tables/queries"

export const metadata: Metadata = {
  title: "Pricing Tables | Sistema de Cobranza",
  description: "Tablas de precios para items variables",
}

export default async function PricingTablesPage() {
  const tables = await listPricingTables()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tablas de precios</h1>
          <p className="text-sm text-muted-foreground">
            Definí los rangos de precio para items variables de contratos
          </p>
        </div>
        <Button asChild>
          <Link href="/pricing-tables/new">
            <Plus className="mr-2 h-4 w-4" />
            Nueva tabla
          </Link>
        </Button>
      </div>

      <PricingTablesTable data={tables} />
    </div>
  )
}
