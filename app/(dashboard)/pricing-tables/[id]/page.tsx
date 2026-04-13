export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Pencil } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getPricingTableById } from "@/domain/pricing_tables/queries"
import { formatMoney } from "@/lib/money"
import { DeletePricingTableButton } from "./_components/delete-pricing-table-button"

interface Props {
  params: Promise<{ id: string }>
}

export default async function PricingTableDetailPage({ params }: Props) {
  const { id } = await params
  const table = await getPricingTableById(id)
  if (!table) notFound()

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/pricing-tables"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Tablas de precios
          </Link>
          <h1 className="text-xl font-semibold">{table.name}</h1>
          {table.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {table.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/pricing-tables/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          <DeletePricingTableButton tableId={id} tableName={table.name} />
        </div>
      </div>

      {/* Tiers */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Rangos de precios ({table.tiers.length})
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desde (qty)</TableHead>
                <TableHead>Hasta (qty)</TableHead>
                <TableHead>Precio unitario</TableHead>
                <TableHead>Fee fijo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.tiers.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell className="font-mono">
                    {tier.fromQuantity.toString()}
                  </TableCell>
                  <TableCell className="font-mono">
                    {tier.toQuantity?.toString() ?? (
                      <span className="text-muted-foreground">Sin límite</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {tier.unitPrice.toString()}
                  </TableCell>
                  <TableCell className="font-mono">
                    {tier.flatFee?.toString() ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Linked items */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Usada en ({table.items.length} item
          {table.items.length !== 1 ? "s" : ""})
        </h2>
        {table.items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Esta tabla no está vinculada a ningún item de contrato todavía.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Contrato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Link
                        href={`/contracts/${item.contract.id}`}
                        className="hover:underline text-sm"
                      >
                        {item.contract.contractNumber} — {item.contract.title}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Creada el{" "}
        {format(new Date(table.createdAt), "dd 'de' MMMM 'de' yyyy", {
          locale: es,
        })}
      </p>
    </div>
  )
}
