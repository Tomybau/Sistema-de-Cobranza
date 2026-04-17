"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import type { RevenueMonthData } from "../_data/get-revenue-by-month"

interface RevenueChartProps {
  data: RevenueMonthData[]
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">
              {new Intl.NumberFormat("es-AR", {
                style: "currency",
                currency: "ARS",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(entry.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card className="col-span-full lg:col-span-4">
      <CardHeader>
        <CardTitle>Ingresos vs Facturación</CardTitle>
        <CardDescription>Comparativa de los últimos 6 meses</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 10,
                right: 10,
                left: -20,
                bottom: 0,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickMargin={10}
                className="fill-muted-foreground"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value / 1000}k`}
                className="fill-muted-foreground"
              />
              <Tooltip cursor={{ fill: "var(--accent)" }} content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }}
                iconType="circle"
              />
              <Bar 
                dataKey="billed" 
                name="Facturado" 
                fill="var(--color-slate-500, #64748b)" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
              <Bar 
                dataKey="collected" 
                name="Cobrado" 
                fill="var(--color-emerald-500, #10b981)" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
