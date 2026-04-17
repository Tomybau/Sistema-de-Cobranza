// Tipos de auditoría — sin imports de Prisma/DB para que puedan usarse en Client Components

export interface AuditLogRow {
  id: string
  action: string
  entityType: string
  entityId: string
  beforeData: unknown
  afterData: unknown
  ipAddress: string | null
  createdAt: Date
  user: { id: string; name: string; email: string } | null
}

export const AUDIT_ENTITY_TYPES = [
  "Company",
  "Client",
  "Contract",
  "ContractItem",
  "BillingTicket",
  "Payment",
  "EmailTemplate",
  "EmailLog",
  "PricingTable",
] as const

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]
