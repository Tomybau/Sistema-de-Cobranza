import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Company } from "@prisma/client"

interface CompanyOverviewProps {
  company: Company
}

function Field({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? <span className="text-muted-foreground italic">—</span>}</dd>
    </div>
  )
}

export function CompanyOverview({ company }: CompanyOverviewProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Datos legales</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Razón social" value={company.legalName} />
            <Field label="Nombre comercial" value={company.tradeName} />
            <Field label="CUIT / Tax ID" value={company.taxId} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2">
            <Field label="Email" value={company.email} />
            <Field label="Teléfono" value={company.phone} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Dirección</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-3">
            <Field label="Dirección" value={company.address} />
            <Field label="Ciudad" value={company.city} />
            <Field label="País" value={company.country} />
          </dl>
        </CardContent>
      </Card>

      {company.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{company.notes}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Creada el{" "}
        {format(new Date(company.createdAt), "dd 'de' MMMM 'de' yyyy", {
          locale: es,
        })}
        {company.updatedAt > company.createdAt && (
          <>
            {" · Actualizada el "}
            {format(new Date(company.updatedAt), "dd 'de' MMMM 'de' yyyy", {
              locale: es,
            })}
          </>
        )}
      </p>
    </div>
  )
}
