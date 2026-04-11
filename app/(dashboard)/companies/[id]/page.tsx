import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCompanyById } from "@/domain/companies/queries"
import { listClientsByCompany } from "@/domain/clients/queries"
import { CompanyOverview } from "./_components/company-overview"
import { DeleteCompanyButton } from "./_components/delete-company-button"
import { ClientsTable } from "@/components/clients/clients-table"

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; success?: string }>
}

export default async function CompanyDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab } = await searchParams

  const company = await getCompanyById(id)
  if (!company) notFound()

  const clients = await listClientsByCompany(id)

  return (
    <div className="p-6 space-y-6 max-w-5xl">
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
          <Button variant="outline" size="sm" render={<Link href={`/companies/${id}/edit`} />}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <DeleteCompanyButton companyId={id} companyName={company.legalName} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={tab ?? "overview"}>
        <TabsList>
          <TabsTrigger value="overview">Información</TabsTrigger>
          <TabsTrigger value="clients">
            Contactos
            {clients.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {clients.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <CompanyOverview company={company} />
        </TabsContent>

        <TabsContent value="clients" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Personas de contacto para envío de mails y comunicaciones
            </p>
            <Button size="sm" render={<Link href={`/companies/${id}/clients/new`} />}>
              Nuevo contacto
            </Button>
          </div>
          <ClientsTable data={clients} companyId={id} />
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <div className="flex items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No hay contratos todavía — disponible en Sesión 3
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
