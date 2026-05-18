import cron from "node-cron"
import { prisma } from "@/db/client"
import { generateBillingTickets } from "@/domain/billing/generate"
import { createNotification } from "@/domain/notifications/create"
import { buildPeriodDate, currentBillingPeriod } from "@/lib/dates"

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Argentina/Buenos_Aires"

/**
 * Job diario a las 07:00 (hora local del servidor).
 *
 * 1. Auto-generación: contratos con items RECURRING_FIXED con autoGenerate=true
 *    → genera el ticket del mes corriente si no existe.
 *
 * 2. Recordatorios: contratos con items que tienen reminderEnabled=true
 *    y reminderDayOfMonth == hoy → crea una Notification in-app.
 */
export function startBillingCron() {
  // "0 7 * * *" = todos los días a las 07:00 (hora del proceso, ajustada a APP_TIMEZONE via TZ env)
  cron.schedule("0 7 * * *", runDailyJob, {
    timezone: APP_TIMEZONE,
  })

  console.log("[billing-cron] Iniciado — corre diario a las 07:00", APP_TIMEZONE)
}

async function runDailyJob() {
  console.log("[billing-cron] Ejecutando job diario:", new Date().toISOString())

  try {
    await runAutoGenerate()
    await runReminders()
  } catch (err) {
    console.error("[billing-cron] Error en job diario:", err)
  }
}

// ─── Auto-generación de tickets fijos ─────────────────────────────────────────

async function runAutoGenerate() {
  const { year, month } = currentBillingPeriod()
  const periodDate = buildPeriodDate(year, month)

  // Contratos activos con al menos un item RECURRING_FIXED con autoGenerate=true
  const contracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      items: {
        some: {
          type: "RECURRING_FIXED",
          isActive: true,
          autoGenerate: true,
        },
      },
    },
    select: { id: true, contractNumber: true, company: { select: { legalName: true } } },
  })

  for (const contract of contracts) {
    try {
      const result = await generateBillingTickets(
        contract.id,
        periodDate,
        {},
        {}
        // sin userId — operación de sistema
      )

      if (result.inserted > 0) {
        await createNotification({
          type: "AUTO_GENERATED",
          title: `${result.inserted} ticket${result.inserted !== 1 ? "s" : ""} generado${result.inserted !== 1 ? "s" : ""} automáticamente`,
          body: `Contrato ${contract.contractNumber} — ${contract.company.legalName} · Período ${month}/${year}`,
          link: "/tickets",
          contractId: contract.id,
        })
        console.log(
          `[billing-cron] Auto-generados ${result.inserted} tickets — ${contract.contractNumber}`
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[billing-cron] Error auto-generando ${contract.contractNumber}:`, msg)

      await createNotification({
        type: "AUTO_GENERATE_ERROR",
        title: `Error al auto-generar tickets — ${contract.contractNumber}`,
        body: msg,
        link: `/contracts/${contract.id}`,
        contractId: contract.id,
      }).catch(() => {
        // silenciar error secundario de notificación
      })
    }
  }
}

// ─── Recordatorios de generación manual ───────────────────────────────────────

async function runReminders() {
  const today = new Date()
  // Día del mes en timezone local del servidor (node-cron ya corre en APP_TIMEZONE)
  const todayDay = today.getDate()
  const { year, month } = currentBillingPeriod()

  // Items con recordatorio para hoy
  const items = await prisma.contractItem.findMany({
    where: {
      isActive: true,
      reminderEnabled: true,
      reminderDayOfMonth: todayDay,
      contract: {
        status: "ACTIVE",
        deletedAt: null,
      },
    },
    include: {
      contract: {
        select: {
          id: true,
          contractNumber: true,
          company: { select: { legalName: true } },
        },
      },
    },
  })

  for (const item of items) {
    // No recordar si ya hay ticket generado para este período (por ticketNumber)
    const { generateTicketNumber } = await import("@/domain/billing/ticket-number")
    const periodDate = buildPeriodDate(year, month)

    const expectedNumber = generateTicketNumber(
      item.contract.contractNumber,
      periodDate,
      item.type,
      item.id
    )

    const alreadyExists = await prisma.billingTicket.findUnique({
      where: { ticketNumber: expectedNumber },
      select: { id: true },
    })

    if (alreadyExists) continue

    await createNotification({
      type: "BILLING_REMINDER",
      title: `Recordatorio: generar ticket de ${item.name}`,
      body: `${item.contract.company.legalName} — Contrato ${item.contract.contractNumber} · Período ${month}/${year}`,
      link: "/tickets",
      contractId: item.contract.id,
      contractItemId: item.id,
    })

    console.log(
      `[billing-cron] Recordatorio creado — ${item.contract.contractNumber} / ${item.name}`
    )
  }
}
