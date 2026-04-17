"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import type { PieLabelRenderProps } from "recharts"
import type { TicketStatusSummaryData } from "../_data/get-ticket-status-summary"
import { useMemo } from "react"
// Local type to avoid importing @prisma/client in the client bundle
type BillingTicketStatus = "PENDING" | "SENT" | "PAID" | "PARTIAL" | "OVERDUE" | "CANCELLED"

interface TicketStatusChartProps {
  data: TicketStatusSummaryData[]
}

const STATUS_COLORS: Record<BillingTicketStatus, string> = {
  PENDING: "var(--color-amber-500, #f59e0b)",
  SENT: "var(--color-blue-500, #3b82f6)",
  PAID: "var(--color-emerald-500, #10b981)",
  PARTIAL: "var(--color-teal-500, #14b8a6)",
  OVERDUE: "var(--color-red-500, #ef4444)",
  CANCELLED: "var(--color-slate-400, #94a3b8)",
}

const STATUS_LABELS: Record<BillingTicketStatus, string> = {
  PENDING: "Pendientes",
  SENT: "Enviados",
  PAID: "Pagados",
  PARTIAL: "Pago Parcial",
  OVERDUE: "Vencidos",
  CANCELLED: "Cancelados",
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: TicketStatusSummaryData & { name: string } }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: STATUS_COLORS[data.status as BillingTicketStatus] }}
          />
          <span className="font-semibold">{STATUS_LABELS[data.status as BillingTicketStatus]}</span>
        </div>
        <div className="text-muted-foreground mt-2 space-y-1">
          <p>Cantidad: <span className="font-medium text-foreground">{data.count}</span></p>
          <p>
            Monto:{" "}
            <span className="font-medium text-foreground">
              {new Intl.NumberFormat("es-AR", {
                style: "currency",
                currency: "ARS",
              }).format(data.amount)}
            </span>
          </p>
        </div>
      </div>
    )
  }
  return null
}

const renderCustomizedLabel = (props: PieLabelRenderProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as {
    cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number
  }
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const RADIAN = Math.PI / 180;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null; // Don't show labels for very small slices

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12" fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function TicketStatusChart({ data }: TicketStatusChartProps) {
  // Filter out statuses with 0 count and inject name for legend
  const chartData = useMemo(() => {
    return data
      .filter((d) => d.count > 0)
      .map((d) => ({
        ...d,
        name: STATUS_LABELS[d.status],
      }))
  }, [data])
  
  const totalCount = useMemo(() => chartData.reduce((acc, curr) => acc + curr.count, 0), [chartData])

  return (
    <Card className="col-span-full lg:col-span-3">
      <CardHeader>
        <CardTitle>Estado de Tickets</CardTitle>
        <CardDescription>Distribución actual</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            No hay tickets registrados
          </div>
        ) : (
          <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="name"
                  labelLine={false}
                  label={renderCustomizedLabel}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={STATUS_COLORS[entry.status as BillingTicketStatus]} 
                      className="stroke-background hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Total */}
            <div className="absolute top-[calc(50%-25px)] left-1/2 -transform-x-1/2 -translate-y-1/2 -translate-x-1/2 text-center pointer-events-none">
              <div className="text-3xl font-bold text-foreground">{totalCount}</div>
              <div className="text-xs text-muted-foreground uppercase mt-1">Tickets</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
