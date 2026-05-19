import { notFound } from "next/navigation"
import Link from "next/link"

export const dynamic = "force-dynamic"
import { ChevronLeft, Pencil, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getCompanyById, getCompanyKpis } from "@/domain/companies/queries"
import { listClientsByCompany } from "@/domain/clients/queries"
import { listContracts } from "@/domain/contracts/queries"
import { listAllBillingTickets } from "@/domain/billing/queries"
import { CompanyOverview } from "./_components/company-overview"
import { DeleteCompanyButton } from "./_components/delete-company-button"
import { ClientsTable } from "@/components/clients/clients-table"
import { ContractsTable } from "@/components/contracts/contracts-table"
import { formatMoney } from "@/lib/money"

interface Props {
  params: Promise<{ id: string }>
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params

  const company = await getCompanyById(id)
  if (!company) notFound()

  const [clients, contracts, kpis, tickets] = await Promise.all([
    listClientsByCompany(id),
    listContracts({ companyId: id }),
    getCompanyKpis(id),
    listAllBillingTickets({ companyId: id }),
  ])

  // Tickets agrupados por contrato (últimos 5)
  const ticketsByContract = new Map<string, typeof tickets>()
  for (const t of tickets) {
    if (!ticketsByContract.has(t.contractId)) ticketsByContract.set(t.contractId, [])
    ticketsByContract.get(t.contractId)!.push(t)
  }

  const currency = contracts[0]?.currency ?? "USD"

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/companies"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Empresas
          </Link>
          <h1 className="text-xl font-semibold">{company.legalName}</h1>
          {company.tradeName && (
            <p className="text-sm text-muted-foreground">{company.tradeName}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/companies/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          <DeleteCompanyButton companyId={id} companyName={company.legalName} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Facturado total</p>
          <p className="text-lg font-semibold num">{formatMoney(kpis.totalBilled, currency)}</p>
        </div>
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Cobrado total</p>
          <p className="text-lg font-semibold num text-ok">
            {formatMoney(kpis.totalCollected, currency)}
          </p>
        </div>
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Pendiente</p>
          <p className="text-lg font-semibold num">{formatMoney(kpis.pending, currency)}</p>
        </div>
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-0.5">En mora</p>
          <p
            className={`text-lg font-semibold num ${kpis.overdueCount > 0 ? "text-bad" : ""}`}
          >
            {formatMoney(kpis.overdueAmount, currency)}
            {kpis.overdueCount > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({kpis.overdueCount} ticket{kpis.overdueCount !== 1 ? "s" : ""})
              </span>
            )}
          </p>
        </div>
      </div>

      <Separator />

      {/* Contratos como árbol */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Contratos ({contracts.length})
          </h2>
          <Button size="sm" asChild>
            <Link href={`/contracts/new?companyId=${id}`}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nuevo contrato
            </Link>
          </Button>
        </div>

        {contracts.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Esta empresa no tiene contratos cargados.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((c) => {
              const ct = ticketsByContract.get(c.id) ?? []
              const recent = ct.slice(0, 5)
              return (
                <div key={c.id} className="rounded-md border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/contracts/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.title}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono">
                        {c.contractNumber} · {c._count.items} item{c._count.items !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/contracts/${c.id}`}>Ver contrato</Link>
                    </Button>
                  </div>
                  {recent.length > 0 ? (
                    <div className="rounded-md border overflow-hidden text-sm">
                      <table className="w-full">
                        <thead className="bg-muted/40 text-xs">
                          <tr>
                            <th className="text-left px-3 py-1.5">Ticket</th>
                            <th className="text-left px-3 py-1.5">Item</th>
                            <th className="text-right px-3 py-1.5">Monto</th>
                            <th className="text-left px-3 py-1.5">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {recent.map((t) => (
                            <tr key={t.id}>
                              <td className="px-3 py-1.5 font-mono text-xs">
                                <Link
                                  href={`/tickets/${t.id}`}
                                  className="hover:underline"
                                >
                                  {t.ticketNumber}
                                </Link>
                              </td>
                              <td className="px-3 py-1.5 truncate max-w-[12rem]">
                                {t.itemName}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                                {formatMoney(t.amount, t.currency)}
                              </td>
                              <td className="px-3 py-1.5 text-xs text-muted-foreground">
                                {t.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {ct.length > 5 && (
                        <p className="text-xs text-muted-foreground px-3 py-2 border-t bg-muted/20">
                          + {ct.length - 5} ticket{ct.length - 5 !== 1 ? "s" : ""} más en{" "}
                          <Link href={`/contracts/${c.id}`} className="underline">
                            el contrato
                          </Link>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin tickets generados.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <Separator />

      {/* Contactos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Contactos ({clients.length})
          </h2>
          <Button size="sm" asChild>
            <Link href={`/companies/${id}/clients/new`}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nuevo contacto
            </Link>
          </Button>
        </div>
        <ClientsTable data={clients} companyId={id} />
      </section>

      <Separator />

      {/* Información general */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Información general
        </h2>
        <CompanyOverview company={company} />
      </section>
    </div>
  )
}
