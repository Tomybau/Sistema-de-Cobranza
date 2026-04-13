export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Pencil } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { getContractById } from "@/domain/contracts/queries"
import { listPricingTables } from "@/domain/pricing_tables/queries"
import { listBillingTicketsByContract } from "@/domain/billing/queries"
import { formatMoney } from "@/lib/money"
import { currentBillingPeriod } from "@/lib/dates"
import { ContractItemsTable } from "@/components/contracts/contract-items-table"
import { ContractDetailActions } from "./_components/contract-detail-actions"
import { GenerateTicketsDialog } from "@/components/contracts/generate-tickets-dialog"

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  ENDED: "Finalizado",
  CANCELLED: "Cancelado",
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  SUSPENDED: "outline",
  ENDED: "outline",
  CANCELLED: "destructive",
}

const TICKET_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
  PARTIAL: "Parcial",
}

const TICKET_STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING: "secondary",
  SENT: "default",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "outline",
  PARTIAL: "secondary",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params
  const [contract, pricingTablesRaw, tickets] = await Promise.all([
    getContractById(id),
    listPricingTables({ contractId: id }),
    listBillingTicketsByContract(id),
  ])
  if (!contract) notFound()

  const pricingTables = pricingTablesRaw.map((pt) => ({
    id: pt.id,
    name: pt.name,
  }))

  const { year: defaultYear, month: defaultMonth } = currentBillingPeriod()

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/contracts"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Contratos
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{contract.title}</h1>
            <Badge variant={STATUS_VARIANTS[contract.status] ?? "outline"}>
              {STATUS_LABELS[contract.status] ?? contract.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">
            {contract.contractNumber}
          </p>
        </div>
        <ContractDetailActions
          contractId={id}
          contractStatus={contract.status}
        />
      </div>

      {/* Overview */}
      <section className="rounded-md border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Detalles del contrato
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/contracts/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm">
          <div>
            <p className="text-muted-foreground">Empresa</p>
            <Link
              href={`/companies/${contract.company.id}`}
              className="font-medium hover:underline"
            >
              {contract.company.legalName}
            </Link>
          </div>
          <div>
            <p className="text-muted-foreground">Moneda</p>
            <p className="font-medium">{contract.currency}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Inicio</p>
            <p className="font-medium">
              {format(new Date(contract.startDate), "dd MMM yyyy", {
                locale: es,
              })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Fin</p>
            <p className="font-medium">
              {contract.endDate
                ? format(new Date(contract.endDate), "dd MMM yyyy", {
                    locale: es,
                  })
                : "Sin fecha de fin"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Vencimiento</p>
            <p className="font-medium">{contract.paymentTermsDays} días</p>
          </div>
          <div>
            <p className="text-muted-foreground">% Mora</p>
            <p className="font-medium">
              {contract.lateFeePercent.toString()}%
            </p>
          </div>
          {contract.description && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-muted-foreground">Descripción</p>
              <p>{contract.description}</p>
            </div>
          )}
          {contract.notes && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-muted-foreground">Notas</p>
              <p>{contract.notes}</p>
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* Items */}
      <ContractItemsTable
        contractId={id}
        items={contract.items}
        currency={contract.currency}
        pricingTables={pricingTables}
      />

      <Separator />

      {/* Billing tickets */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Tickets de cobro
            {tickets.length > 0 && (
              <span className="ml-2 normal-case font-normal text-foreground">
                ({tickets.length})
              </span>
            )}
          </h2>
          <GenerateTicketsDialog
            contractId={id}
            currency={contract.currency}
            defaultYear={defaultYear}
            defaultMonth={defaultMonth}
          />
        </div>

        {tickets.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No hay tickets generados para este contrato.
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Número</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Período</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Monto</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Vcto.</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      <Link
                        href={`/tickets/${t.id}`}
                        className="hover:underline hover:text-foreground"
                      >
                        {t.ticketNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 max-w-[14rem] truncate">{t.itemName}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {t.periodStart
                        ? format(new Date(t.periodStart), "MMM yyyy", { locale: es })
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatMoney(t.amount, t.currency)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {format(new Date(t.dueDate), "dd MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={TICKET_STATUS_VARIANTS[t.status] ?? "outline"}
                        className="text-xs"
                      >
                        {TICKET_STATUS_LABELS[t.status] ?? t.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
