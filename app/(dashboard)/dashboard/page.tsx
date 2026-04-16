import { Suspense } from "react"
import { prisma } from "@/db/client"
import { KpiCards } from "./_components/kpi-cards"
import { RevenueChart } from "./_components/revenue-chart"
import { TicketStatusChart } from "./_components/ticket-status-chart"
import { OverdueTable } from "./_components/overdue-table"
import { RecentPayments } from "./_components/recent-payments"
import { CompanyFilter } from "./_components/company-filter"
import { Skeleton } from "@/components/ui/skeleton"

import { getDashboardKpis } from "./_data/get-kpis"
import { getRevenueByMonth } from "./_data/get-revenue-by-month"
import { getTicketStatusSummary } from "./_data/get-ticket-status-summary"
import { getOverdueTickets } from "./_data/get-overdue-tickets"
import { getRecentPayments } from "./_data/get-recent-payments"

export const dynamic = "force-dynamic"

interface DashboardPageProps {
  searchParams: Promise<{ companyId?: string }>
}

async function CompaniesDropdown() {
  const companiesData = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  })
  
  return (
    <CompanyFilter
      companies={companiesData.map(c => ({ id: c.id, name: c.legalName }))}
    />
  )
}

async function KpisSection({ companyId }: { companyId?: string }) {
  const data = await getDashboardKpis({ companyId })
  return <KpiCards data={data} />
}

async function RevenueChartsSection({ companyId }: { companyId?: string }) {
  const data = await getRevenueByMonth({ companyId })
  return <RevenueChart data={data} />
}

async function TicketStatusSection({ companyId }: { companyId?: string }) {
  const data = await getTicketStatusSummary({ companyId })
  return <TicketStatusChart data={data} />
}

async function OverdueTableSection({ companyId }: { companyId?: string }) {
  const data = await getOverdueTickets({ companyId })
  return <OverdueTable data={data} />
}

async function RecentPaymentsSection({ companyId }: { companyId?: string }) {
  const data = await getRecentPayments({ companyId })
  return <RecentPayments data={data} />
}

export default async function DashboardPage(props: DashboardPageProps) {
  // En Next.js 15, searchParams es asíncrono
  const searchParams = await props.searchParams
  const companyId = searchParams?.companyId

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resumen general de facturación y cobranza
          </p>
        </div>
        
        <Suspense fallback={<Skeleton className="h-10 w-[220px]" />}>
          <CompaniesDropdown />
        </Suspense>
      </div>

      <div className="space-y-6">
        <Suspense fallback={<Skeleton className="h-[120px] w-full" />}>
          <KpisSection companyId={companyId} />
        </Suspense>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <Suspense fallback={<Skeleton className="h-[400px] col-span-full lg:col-span-4" />}>
            <RevenueChartsSection companyId={companyId} />
          </Suspense>
          
          <Suspense fallback={<Skeleton className="h-[400px] col-span-full lg:col-span-3" />}>
            <TicketStatusSection companyId={companyId} />
          </Suspense>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <Suspense fallback={<Skeleton className="h-[400px] col-span-full lg:col-span-4" />}>
            <OverdueTableSection companyId={companyId} />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-[400px] col-span-full lg:col-span-3" />}>
            <RecentPaymentsSection companyId={companyId} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
