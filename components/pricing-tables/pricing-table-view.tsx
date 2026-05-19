import { formatMoney } from "@/lib/money"

export interface PricingTier {
  id?: string
  fromQuantity: string
  toQuantity: string | null
  unitPrice: string
  flatFee: string | null
}

interface PricingTableViewProps {
  tiers: PricingTier[]
  currency: string
  className?: string
}

export function PricingTableView({ tiers, currency, className }: PricingTableViewProps) {
  if (!tiers.length) {
    return <p className="text-sm text-muted-foreground">Sin rangos definidos.</p>
  }

  return (
    <div className={`rounded-md border overflow-hidden text-sm ${className ?? ""}`}>
      <table className="w-full">
        <thead className="bg-muted/40 text-xs">
          <tr>
            <th className="text-left px-3 py-1.5 font-medium">Desde</th>
            <th className="text-left px-3 py-1.5 font-medium">Hasta</th>
            <th className="text-right px-3 py-1.5 font-medium">Precio unitario</th>
            <th className="text-right px-3 py-1.5 font-medium">Fee fijo</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {tiers.map((tier, i) => (
            <tr key={tier.id ?? i}>
              <td className="px-3 py-1.5 tabular-nums">{formatNumber(tier.fromQuantity)}</td>
              <td className="px-3 py-1.5 tabular-nums">
                {tier.toQuantity === null ? "∞" : formatNumber(tier.toQuantity)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                {formatMoney(tier.unitPrice, currency)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                {tier.flatFee ? formatMoney(tier.flatFee, currency) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatNumber(value: string): string {
  const num = parseFloat(value)
  if (Number.isNaN(num)) return value
  return num.toLocaleString("es-AR", { maximumFractionDigits: 4 })
}
