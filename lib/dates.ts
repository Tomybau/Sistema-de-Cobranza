/**
 * lib/dates.ts
 *
 * Date helpers for business logic. All period dates must go through
 * buildPeriodDate so the timezone is handled uniformly.
 */

/**
 * Builds a Date that unambiguously represents a billing period (year + month).
 *
 * Uses noon UTC on the 15th of the month — safely within the target month in
 * any UTC-12..+14 timezone, including America/Argentina/Buenos_Aires (UTC-3).
 *
 * Domain functions receive this Date and convert it via TZDate(date, APP_TIMEZONE)
 * to extract the correct local month.
 *
 * UI → action boundary rule: NEVER pass a Date object across the boundary.
 * Pass { year, month } and call buildPeriodDate on the server side.
 */
export function buildPeriodDate(year: number, month: number): Date {
  // month is 1-based (January = 1, December = 12)
  return new Date(Date.UTC(year, month - 1, 15, 12, 0, 0))
}

/** Returns { year, month } (1-based) for "today" in the app timezone. */
export function currentBillingPeriod(): { year: number; month: number } {
  const now = new Date()
  // Build the month/year from the server's perspective using APP_TIMEZONE.
  // Using Intl.DateTimeFormat is safe and doesn't require @date-fns/tz.
  const tz = process.env.APP_TIMEZONE ?? "America/Argentina/Buenos_Aires"
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
  })
  const parts = formatter.formatToParts(now)
  const year = Number(parts.find((p) => p.type === "year")?.value)
  const month = Number(parts.find((p) => p.type === "month")?.value)
  return { year, month }
}
