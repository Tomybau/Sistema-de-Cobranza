// domain/email/interpolate.ts
import { format } from "date-fns"
import { TZDate } from "@date-fns/tz"
import { Decimal } from "@prisma/client/runtime/library"

const TIMEZONE = process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires"

export interface InterpolationContext {
  client_name: string
  client_email: string
  company_name: string
  ticket_number: string
  ticket_amount: Decimal
  ticket_currency: string
  ticket_due_date: Date
  ticket_period_start: Date | null
  ticket_period_end: Date | null
  contract_name: string
  payment_link?: string
}

export type ValidationResult = {
  isValid: boolean
  invalidVariables: string[]
}

const AVAILABLE_VARIABLES = [
  "client_name",
  "client_email",
  "company_name",
  "ticket_number",
  "ticket_amount",
  "ticket_due_date",
  "ticket_period",
  "contract_name",
  "payment_link",
]

export function getAvailableVariables(): string[] {
  return AVAILABLE_VARIABLES
}

function formatPeriod(start: Date | null, end: Date | null): string {
  if (!start && !end) return "N/A"
  if (start && end) {
    return `${format(new TZDate(start, TIMEZONE), "MMM yyyy")} - ${format(new TZDate(end, TIMEZONE), "MMM yyyy")}`
  }
  const date = start || end
  return format(new TZDate(date!, TIMEZONE), "MMM yyyy")
}

function formatAmount(amount: Decimal, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`
}

export function interpolate(template: string, context: InterpolationContext): string {
  if (!template) return ""

  const variables: Record<string, string> = {
    client_name: context.client_name,
    client_email: context.client_email,
    company_name: context.company_name,
    ticket_number: context.ticket_number,
    ticket_amount: formatAmount(context.ticket_amount, context.ticket_currency),
    ticket_due_date: format(new TZDate(context.ticket_due_date, TIMEZONE), "dd/MM/yyyy"),
    ticket_period: formatPeriod(context.ticket_period_start, context.ticket_period_end),
    contract_name: context.contract_name,
    payment_link: context.payment_link || "",
  }

  let result = template
  for (const [key, value] of Object.entries(variables)) {
    // Reemplaza globalmente {{key}} con el valor
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g")
    result = result.replace(regex, value)
  }

  return result
}

export function validateTemplate(subject: string, bodyHtml: string): ValidationResult {
  const combined = `${subject} ${bodyHtml}`
  const matches = combined.match(/{{(.*?)}}/g) || []
  
  const invalidVariables: Set<string> = new Set()

  for (const match of matches) {
    // extrae "variable" de "{{ variable }}"
    const varName = match.replace(/[{}]/g, "").trim()
    if (!AVAILABLE_VARIABLES.includes(varName)) {
      invalidVariables.add(varName)
    }
  }

  return {
    isValid: invalidVariables.size === 0,
    invalidVariables: Array.from(invalidVariables),
  }
}
