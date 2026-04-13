import { getDashboardKpis } from "@/domain/dashboard/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Clock, AlertTriangle, FileText } from "lucide-react"

export const dynamic = "force-dynamic"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function DashboardPage() {
  const kpis = await getDashboardKpis()

  const cards = [
    {
      title: "Facturado este mes",
      value: formatCurrency(kpis.totalBilledThisMonth),
      icon: DollarSign,
      description: "Total emitido en el período actual",
    },
    {
      title: "Pendiente de cobro",
      value: formatCurrency(kpis.totalPending),
      icon: Clock,
      description: "Tickets en estado PENDING o SENT",
    },
    {
      title: "En mora",
      value: formatCurrency(kpis.totalOverdue),
      icon: AlertTriangle,
      description: "Vencidos sin pago registrado",
      highlight: kpis.totalOverdue > 0,
    },
    {
      title: "Contratos activos",
      value: kpis.activeContractsCount.toString(),
      icon: FileText,
      description: "Contratos en estado ACTIVE",
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de cobranza del sistema
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ title, value, icon: Icon, description, highlight }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {title}
              </CardTitle>
              <Icon
                className={`h-4 w-4 ${highlight ? "text-destructive" : "text-muted-foreground"}`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${highlight ? "text-destructive" : ""}`}
              >
                {value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Tendencia de facturación</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Próximamente — gráfico de tendencia mensual
        </CardContent>
      </Card>
    </div>
  )
}
