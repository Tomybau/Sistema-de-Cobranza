"use server"

import { auth } from "@/auth"
import { prisma } from "@/db/client"
import { buildCsv } from "@/lib/csv"
import { format } from "date-fns"

function formatDate(date: Date | null | undefined) {
  if (!date) return ""
  return format(new Date(date), "yyyy-MM-dd HH:mm:ss")
}

export async function exportTicketsCsv(): Promise<{ csv: string; filename: string }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autorizado")

  const tickets = await prisma.billingTicket.findMany({
    include: {
      contract: {
        select: {
          contractNumber: true,
          title: true,
          company: { select: { legalName: true } },
        },
      },
      contractItem: { select: { name: true } },
    },
    orderBy: { dueDate: "desc" },
  })

  const headers = [
    "ticket_number",
    "empresa",
    "contrato_numero",
    "contrato_titulo",
    "item",
    "periodo_inicio",
    "periodo_fin",
    "fecha_emision",
    "fecha_vencimiento",
    "monto",
    "moneda",
    "cantidad_variable",
    "estado",
    "monto_pagado",
    "fecha_pago",
    "notas",
  ]

  const rows = tickets.map((t) => [
    t.ticketNumber,
    t.contract.company.legalName,
    t.contract.contractNumber,
    t.contract.title,
    t.contractItem.name,
    formatDate(t.periodStart),
    formatDate(t.periodEnd),
    formatDate(t.issueDate),
    formatDate(t.dueDate),
    t.amount.toString(),
    t.currency,
    t.variableQuantity?.toString() ?? "",
    t.status,
    t.paidAmount.toString(),
    formatDate(t.paidAt),
    t.notes ?? "",
  ])

  const csv = buildCsv(headers, rows)
  const filename = `tickets_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`

  return { csv, filename }
}

export async function exportPaymentsCsv(): Promise<{ csv: string; filename: string }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autorizado")

  const payments = await prisma.payment.findMany({
    where: { deletedAt: null },
    include: {
      company: { select: { legalName: true } },
      client: { select: { fullName: true, email: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { paymentDate: "desc" },
  })

  const headers = [
    "numero_pago",
    "empresa",
    "cliente",
    "email_cliente",
    "monto",
    "moneda",
    "metodo",
    "estado",
    "referencia",
    "fecha_pago",
    "registrado_por",
    "notas",
  ]

  const rows = payments.map((p) => [
    p.paymentNumber,
    p.company.legalName,
    p.client.fullName,
    p.client.email,
    p.grossAmount.toString(),
    p.currency,
    p.method,
    p.status,
    p.reference ?? "",
    formatDate(p.paymentDate),
    p.createdBy.name,
    p.notes ?? "",
  ])

  const csv = buildCsv(headers, rows)
  const filename = `payments_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`

  return { csv, filename }
}
