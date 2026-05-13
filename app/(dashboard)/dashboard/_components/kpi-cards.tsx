"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, AlertTriangle, Percent, DollarSign } from "lucide-react"
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
  if (value === null) return null
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value.toFixed(1)}%`
}

type Accent = "brand" | "ok" | "bad" | "neutral"

const accentBorder: Record<Accent, string> = {
  brand: "border-l-primary",
  ok:    "border-l-ok",
  bad:   "border-l-bad",
  neutral: "border-l-border",
}

const accentIcon: Record<Accent, string> = {
  brand:   "text-primary",
  ok:      "text-ok",
  bad:     "text-bad",
  neutral: "text-muted-foreground",
}

interface CardConfig {
  title: string
  value: string
  icon: React.ElementType
  accent: Accent
  delta?: number | null
  deltaText?: string
  isPositiveGood?: boolean
}

export function KpiCards({ data }: KpiCardsProps) {
  const cards: CardConfig[] = [
    {
      title: "Facturado este mes",
      value: formatCurrency(data.billedThisMonth),
      icon: DollarSign,
      accent: "brand",
      delta: data.deltas.billed,
      deltaText: "vs mes anterior",
    },
    {
      title: "Cobrado este mes",
      value: formatCurrency(data.collectedThisMonth),
      icon: DollarSign,
      accent: "ok",
      delta: data.deltas.collected,
      deltaText: "vs mes anterior",
      isPositiveGood: true,
    },
    {
      title: "Tickets vencidos",
      value: data.overdueCount.toString(),
      icon: AlertTriangle,
      accent: data.overdueCount > 0 ? "bad" : "neutral",
    },
    {
      title: "Tasa de cobro",
      value: `${data.collectionRate.toFixed(1)}%`,
      icon: Percent,
      accent: "neutral",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const delta = card.delta !== undefined ? formatDelta(card.delta ?? null) : null
        const deltaPositive =
          card.delta != null &&
          ((card.delta > 0 && card.isPositiveGood) ||
            (card.delta < 0 && !card.isPositiveGood))
        const deltaIsNeutral = card.delta === 0 || card.delta == null

        return (
          <Card
            key={card.title}
            className={cn(
              "border-l-4",
              accentBorder[card.accent]
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={cn("h-4 w-4 shrink-0", accentIcon[card.accent])} />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-semibold tracking-tight num",
                card.accent === "bad" && data.overdueCount > 0 && "text-bad"
              )}>
                {card.value}
              </div>
              {delta !== null && (
                <p className={cn(
                  "text-xs mt-1 flex items-center gap-1",
                  deltaIsNeutral
                    ? "text-muted-foreground"
                    : deltaPositive
                    ? "text-ok"
                    : "text-bad"
                )}>
                  {!deltaIsNeutral && (
                    deltaPositive
                      ? <TrendingUp className="h-3 w-3" />
                      : <TrendingDown className="h-3 w-3" />
                  )}
                  {delta}{" "}
                  {card.deltaText && (
                    <span className="text-muted-foreground">{card.deltaText}</span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
