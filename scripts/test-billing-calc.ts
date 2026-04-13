/**
 * Manual verification script for domain/billing pure functions.
 * Run: npx tsx scripts/test-billing-calc.ts
 * (or: bun run scripts/test-billing-calc.ts)
 *
 * Not a test suite — exercises realistic scenarios and prints results for inspection.
 */

process.env.APP_TIMEZONE = "America/Argentina/Buenos_Aires"

import { calculateTicketsForContract, calculateVariableAmount } from "../domain/billing/calculate"
import type {
  BillingContract,
  BillingContractItem,
  ExistingTicketRef,
} from "../domain/billing/types"

const contract: BillingContract = {
  contractNumber: "CTR-2026-0001",
  paymentTermsDays: 15,
  currency: "USD",
  startDate: new Date("2026-01-01T00:00:00Z"),
  endDate: null,
}

const APRIL = new Date("2026-04-01T00:00:00Z")
const MAY   = new Date("2026-05-01T00:00:00Z")
const JUNE  = new Date("2026-06-01T00:00:00Z")
const JULY  = new Date("2026-07-01T00:00:00Z")
const issueDate = new Date("2026-04-13T00:00:00Z")

// ─── Items ───────────────────────────────────────────────────────────────────

const fixedItem: BillingContractItem = {
  id: "item-fixed-aabbcc",
  type: "RECURRING_FIXED",
  name: "Mensualidad básica",
  fixedAmount: "1500.00",
  pricingTableId: null,
  pricingTable: null,
  totalAmount: null,
  installments: null,
  billingDayOfMonth: 10,
  isActive: true,
  startDate: null,
  endDate: null,
}

const variableItem: BillingContractItem = {
  id: "item-var-ddeeff",
  type: "RECURRING_VARIABLE",
  name: "Consumo variable",
  fixedAmount: null,
  pricingTableId: "pt-001",
  pricingTable: {
    id: "pt-001",
    tiers: [
      { id: "t1", fromQuantity: "0", toQuantity: "100", unitPrice: "1.00", flatFee: null },
      { id: "t2", fromQuantity: "101", toQuantity: "500", unitPrice: "0.80", flatFee: "20.00" },
      { id: "t3", fromQuantity: "501", toQuantity: null,  unitPrice: "0.60", flatFee: "50.00" },
    ],
  },
  totalAmount: null,
  installments: null,
  billingDayOfMonth: 10,
  isActive: true,
  startDate: null,
  endDate: null,
}

const oneTimeItem: BillingContractItem = {
  id: "item-onetime-112233",
  type: "ONE_TIME",
  name: "Setup fee",
  fixedAmount: null,
  pricingTableId: null,
  pricingTable: null,
  totalAmount: "5000.00",
  installments: null,
  billingDayOfMonth: null,
  isActive: true,
  startDate: null,
  endDate: null,
}

const installmentItem: BillingContractItem = {
  id: "item-inst-998877",
  type: "INSTALLMENT",
  name: "Implementación (3 cuotas)",
  fixedAmount: null,
  pricingTableId: null,
  pricingTable: null,
  totalAmount: "9000.00",
  installments: 3,
  billingDayOfMonth: 10,
  isActive: true,
  startDate: new Date("2026-04-01T00:00:00Z"),
  endDate: null,
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function printDrafts(label: string, drafts: ReturnType<typeof calculateTicketsForContract>) {
  console.log(`\n${"─".repeat(60)}`)
  console.log(`ESCENARIO: ${label}`)
  if (drafts.length === 0) {
    console.log("  → Sin drafts (0 tickets)")
    return
  }
  for (const d of drafts) {
    console.log(`  [${d.status}] ${d.ticketNumber}`)
    console.log(`    item: ${d.itemName} | type: ${d.type}`)
    console.log(`    amount: ${d.amount ?? "NULL (necesita cantidad)"}`)
    console.log(`    issueDate: ${d.issueDate.toISOString()} | dueDate: ${d.dueDate.toISOString()}`)
    if (d.periodStart) console.log(`    period: ${d.periodStart.toISOString()} → ${d.periodEnd?.toISOString()}`)
    if (d.installmentNum) console.log(`    installmentNum: ${d.installmentNum}`)
  }
}

// ─── Escenario 1: RECURRING_FIXED, mes 1 → 1 ticket ─────────────────────────

const s1 = calculateTicketsForContract({
  contract,
  items: [fixedItem],
  periodDate: APRIL,
  issueDate,
  existingTickets: [],
})
printDrafts("1. FIXED, primera vez → 1 ticket", s1)

// ─── Escenario 2: RECURRING_FIXED, mes 1 otra vez → 0 tickets ────────────────

const s1Existing: ExistingTicketRef[] = s1.map((d) => ({
  ticketNumber: d.ticketNumber,
  contractItemId: d.contractItemId,
  installmentNum: d.installmentNum,
}))

const s2 = calculateTicketsForContract({
  contract,
  items: [fixedItem],
  periodDate: APRIL,
  issueDate,
  existingTickets: s1Existing,
})
printDrafts("2. FIXED, mismo mes otra vez → 0 tickets (idempotente)", s2)

// ─── Escenario 3: RECURRING_VARIABLE → NEEDS_QUANTITY ────────────────────────

const s3 = calculateTicketsForContract({
  contract,
  items: [variableItem],
  periodDate: APRIL,
  issueDate,
  existingTickets: [],
})
printDrafts("3. VARIABLE → amount=null, status=NEEDS_QUANTITY", s3)

// ─── Escenario 3b: calculateVariableAmount con distintas cantidades ───────────

console.log(`\n${"─".repeat(60)}`)
console.log("ESCENARIO 3b. calculateVariableAmount — tabla de precios por volumen")
const pt = variableItem.pricingTable!
const cases: [string, string][] = [
  ["0",   "→ 0 (zero)"],
  ["50",  "→ tier 1: 50 × 1.00 = 50.00"],
  ["150", "→ tier 2: 150 × 0.80 + 20.00 = 140.00"],
  ["600", "→ tier 3 (open): 600 × 0.60 + 50.00 = 410.00"],
]
for (const [qty, expected] of cases) {
  const result = calculateVariableAmount(pt, qty)
  console.log(`  qty=${qty}: ${result}  (esperado: ${expected})`)
}

// ─── Escenario 4: INSTALLMENT, 3 cuotas + mes 4 (nada) ───────────────────────

console.log(`\n${"─".repeat(60)}`)
console.log("ESCENARIO 4. INSTALLMENT — 3 cuotas + mes 4 sin tickets")
const instExisting: ExistingTicketRef[] = []

for (const [label, period] of [
  ["Mes 1 (abril)", APRIL],
  ["Mes 2 (mayo)", MAY],
  ["Mes 3 (junio)", JUNE],
  ["Mes 4 (julio, fuera de rango)", JULY],
] as [string, Date][]) {
  const result = calculateTicketsForContract({
    contract,
    items: [installmentItem],
    periodDate: period,
    issueDate,
    existingTickets: [...instExisting],
  })
  if (result.length > 0) {
    const d = result[0]
    console.log(`  ${label}: ${d.ticketNumber} | cuota ${d.installmentNum} | $${d.amount}`)
    instExisting.push({
      ticketNumber: d.ticketNumber,
      contractItemId: d.contractItemId,
      installmentNum: d.installmentNum,
    })
  } else {
    console.log(`  ${label}: → sin ticket`)
  }
}

// ─── Escenario 5: ONE_TIME — idempotente ──────────────────────────────────────

const s5a = calculateTicketsForContract({
  contract,
  items: [oneTimeItem],
  periodDate: APRIL,
  issueDate,
  existingTickets: [],
})
printDrafts("5a. ONE_TIME, primera vez → 1 ticket", s5a)

const s5Existing: ExistingTicketRef[] = s5a.map((d) => ({
  ticketNumber: d.ticketNumber,
  contractItemId: d.contractItemId,
  installmentNum: null,
}))
const s5b = calculateTicketsForContract({
  contract,
  items: [oneTimeItem],
  periodDate: MAY, // mes diferente — no importa, ya existe
  issueDate,
  existingTickets: s5Existing,
})
printDrafts("5b. ONE_TIME, segunda vez (mes diferente) → 0 tickets", s5b)

// ─── Escenario 6: period anterior a contract.startDate ───────────────────────

const s6 = calculateTicketsForContract({
  contract,
  items: [fixedItem],
  periodDate: new Date("2025-12-01T00:00:00Z"), // antes del contrato
  issueDate,
  existingTickets: [],
})
printDrafts("6. Period antes del inicio del contrato → 0 tickets", s6)

console.log(`\n${"─".repeat(60)}\nFin del script.\n`)
