"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Clock, AlertTriangle, Percent } from "lucide-react"
import type { KPIData } from "../_data/get-kpis"
import { cn } from "@/lib/utils"

interface KpiCardsProps {
  data: KPIData
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDelta(value: number | null) {
  if (value === null) return "—"
  const prefix = value > 0 ? "↑" : value < 0 ? "↓" : ""
  return `${prefix} ${Math.abs(value).toFixed(1)}%`
}

export function KpiCards({ data }: KpiCardsProps) {
  const cards = [
    {
      title: "Facturado este mes",
      value: formatCurrency(data.billedThisMonth),
      icon: DollarSign,
      delta: data.deltas.billed,
      deltaText: "vs mes anterior",
    },
    {
      title: "Cobrado este mes",
      value: formatCurrency(data.collectedThisMonth),
      icon: DollarSign,
      delta: data.deltas.collected,
      deltaText: "vs mes anterior",
      isPositiveGood: true,
    },
    {
      title: "Tickets vencidos",
      value: data.overdueCount.toString(),
      icon: AlertTriangle,
      highlight: data.overdueCount > 0,
    },
    {
      title: "Tasa de cobro",
      value: `${data.collectionRate.toFixed(1)}%`,
      icon: Percent,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon
              className={cn(
                "h-4 w-4",
                card.highlight ? "text-destructive" : "text-muted-foreground"
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                card.highlight && "text-destructive"
              )}
            >
              {card.value}
            </div>
            {card.delta !== undefined && (
              <p
                className={cn(
                  "text-xs mt-1",
                  card.delta === null
                    ? "text-muted-foreground"
                    : (card.delta > 0 && card.isPositiveGood) || (card.delta < 0 && !card.isPositiveGood)
                    ? "text-emerald-500"
                    : card.delta === 0
                    ? "text-muted-foreground"
                    : "text-destructive"
                )}
              >
                {formatDelta(card.delta)} {card.deltaText && <span className="text-muted-foreground">{card.deltaText}</span>}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
