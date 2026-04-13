import { format } from "date-fns"
import { TZDate } from "@date-fns/tz"
import type { BillingContractItem } from "./types"

const TYPE_SHORT: Record<BillingContractItem["type"], string> = {
  RECURRING_FIXED: "FIXED",
  RECURRING_VARIABLE: "VAR",
  ONE_TIME: "ONETIME",
  INSTALLMENT: "INST",
}

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Argentina/Buenos_Aires"

/**
 * Generates a deterministic, unique ticket number.
 * Same inputs always produce the same output — key for idempotency.
 *
 * Format:
 *   RECURRING_FIXED:    {contractNumber}-{YYYYMM}-FIXED-{itemSuffix}
 *   RECURRING_VARIABLE: {contractNumber}-{YYYYMM}-VAR-{itemSuffix}
 *   ONE_TIME:           {contractNumber}-ONETIME-{itemSuffix}   (no period — generated once)
 *   INSTALLMENT:        {contractNumber}-{YYYYMM}-INST-{itemSuffix}-{cuota:02d}
 *
 * itemSuffix = last 6 chars of item.id (stable, differentiates items of same type in a contract)
 */
export function generateTicketNumber(
  contractNumber: string,
  periodDate: Date,
  itemType: BillingContractItem["type"],
  itemId: string,
  installmentNum?: number
): string {
  const suffix = itemId.slice(-6)
  const typeShort = TYPE_SHORT[itemType]

  if (itemType === "ONE_TIME") {
    return `${contractNumber}-ONETIME-${suffix}`
  }

  const yyyymm = format(new TZDate(periodDate, APP_TIMEZONE), "yyyyMM")

  if (itemType === "INSTALLMENT" && installmentNum !== undefined) {
    return `${contractNumber}-${yyyymm}-${typeShort}-${suffix}-${String(installmentNum).padStart(2, "0")}`
  }

  return `${contractNumber}-${yyyymm}-${typeShort}-${suffix}`
}
