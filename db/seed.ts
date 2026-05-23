/**
 * Seed de desarrollo — demo completo con 3 empresas, contratos variados,
 * tickets de múltiples meses, pagos (pagados / parciales / vencidos).
 *
 * SOLO se ejecuta si NODE_ENV === "development".
 */
import bcrypt from "bcryptjs"
import { PrismaClient, Prisma } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { addMonths, subMonths, startOfMonth, endOfMonth, addDays, format } from "date-fns"

if (process.env.NODE_ENV !== "development") {
  console.error("❌  Seed rechazado: NODE_ENV no es 'development'. Nunca ejecutes esto en producción.")
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ─── helpers ─────────────────────────────────────────────────────────────────

const d = (s: string) => new Date(s)
const dec = (n: number) => new Prisma.Decimal(n)
const now = new Date()
const mo = (offset: number) => startOfMonth(addMonths(now, offset))

let ticketSeq = 1
function tNum(prefix: string) {
  return `${prefix}-${String(ticketSeq++).padStart(4, "0")}`
}

async function main() {
  console.log("🌱  Iniciando seed de demo...")

  // ─── Limpiar datos seed anteriores ────────────────────────────────────────
  // Borramos en orden de dependencias para evitar FK violations
  await prisma.auditLog.deleteMany({})
  await prisma.paymentTicket.deleteMany({})
  await prisma.payment.deleteMany({})
  await prisma.emailLog.deleteMany({})
  await prisma.billingTicket.deleteMany({})
  await prisma.pricingTier.deleteMany({})
  await prisma.pricingTable.deleteMany({})
  await prisma.contractItem.deleteMany({})
  await prisma.contract.deleteMany({})
  await prisma.emailTemplate.deleteMany({})
  await prisma.client.deleteMany({})
  await prisma.company.deleteMany({})
  await prisma.session.deleteMany({})
  await prisma.user.deleteMany({})

  console.log("🧹  Base limpiada")

  // ─── 1. Admin ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("admin1234", 12)
  const admin = await prisma.user.create({
    data: {
      id: "seed-admin-id",
      email: "admin@cobranza.local",
      name: "Admin Demo",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  })
  console.log("✅  Usuario admin:", admin.email)

  // ─── 2. Empresas ──────────────────────────────────────────────────────────
  const tecsur = await prisma.company.create({
    data: {
      legalName: "Tecnologías del Sur S.A.",
      tradeName: "TecSur",
      taxId: "30-12345678-9",
      email: "admin@tecsur.com.ar",
      phone: "+54 11 4000-1234",
      address: "Av. Corrientes 1234, Piso 5",
      city: "Buenos Aires",
      country: "Argentina",
      notes: "Cliente desde 2023. Buen historial de pagos. Plataforma SaaS B2B.",
    },
  })

  const distinorte = await prisma.company.create({
    data: {
      legalName: "Distribuidora Norte S.R.L.",
      tradeName: "DistriNorte",
      taxId: "30-98765432-1",
      email: "contabilidad@distinorte.com.ar",
      phone: "+54 351 400-5678",
      address: "Bv. San Juan 890",
      city: "Córdoba",
      country: "Argentina",
      notes: "Distribuidor mayorista. Facturación variable según volumen. Tiene 2 meses en mora.",
    },
  })

  const constructora = await prisma.company.create({
    data: {
      legalName: "Constructora del Plata S.A.",
      tradeName: "ConPlata",
      taxId: "30-55443322-0",
      email: "pagos@conplata.com.ar",
      phone: "+54 11 5500-9900",
      address: "Reconquista 458",
      city: "Buenos Aires",
      country: "Argentina",
      notes: "Cliente nuevo. Implementación en progreso. Plan de cuotas activo.",
    },
  })
  console.log("✅  Empresas:", tecsur.tradeName, distinorte.tradeName, constructora.tradeName)

  // ─── 3. Contactos ─────────────────────────────────────────────────────────
  const cTecsur1 = await prisma.client.create({
    data: {
      companyId: tecsur.id,
      fullName: "Carlos Rodríguez",
      role: "CEO",
      clientType: "LEGAL_REP",
      email: "carlos@tecsur.com.ar",
      phone: "+54 11 9000-1234",
      isPrimary: true,
    },
  })
  const cTecsur2 = await prisma.client.create({
    data: {
      companyId: tecsur.id,
      fullName: "Sofía Martínez",
      role: "Administración",
      clientType: "BILLING_CONTACT",
      email: "sofia@tecsur.com.ar",
      phone: "+54 11 9000-5678",
      isPrimary: false,
    },
  })

  const cDistri1 = await prisma.client.create({
    data: {
      companyId: distinorte.id,
      fullName: "María López",
      role: "Directora Comercial",
      clientType: "LEGAL_REP",
      email: "mlopez@distinorte.com.ar",
      phone: "+54 351 9000-5678",
      isPrimary: true,
    },
  })
  const cDistri2 = await prisma.client.create({
    data: {
      companyId: distinorte.id,
      fullName: "Jorge Peralta",
      role: "Contador",
      clientType: "BILLING_CONTACT",
      email: "jperalta@distinorte.com.ar",
      phone: "+54 351 9001-5678",
      isPrimary: false,
    },
  })

  const cConstr1 = await prisma.client.create({
    data: {
      companyId: constructora.id,
      fullName: "Diego Fernández",
      role: "Gerente General",
      clientType: "LEGAL_REP",
      email: "dfernandez@conplata.com.ar",
      phone: "+54 11 9800-1234",
      isPrimary: true,
    },
  })
  console.log("✅  Contactos creados:", cTecsur1.fullName, cDistri1.fullName, cConstr1.fullName)

  // ─── 4. Contratos ─────────────────────────────────────────────────────────

  // 4a. TecSur — contrato recurrente fijo + variable (plataforma SaaS)
  const ctTecsur = await prisma.contract.create({
    data: {
      companyId: tecsur.id,
      contractNumber: "CONT-2024-001",
      title: "Plataforma SaaS — TecSur",
      description: "Servicio mensual de plataforma + soporte + consumo variable de API",
      currency: "USD",
      startDate: d("2024-01-01"),
      status: "ACTIVE",
      paymentTermsDays: 15,
      lateFeePercent: new Prisma.Decimal(2),
      signatureDate: d("2023-12-15"),
    },
  })

  // Items de TecSur
  const itemTecsurFijo = await prisma.contractItem.create({
    data: {
      contractId: ctTecsur.id,
      type: "RECURRING_FIXED",
      name: "Mensualidad base plataforma",
      description: "Acceso a módulos core, SLA 99.9%, hasta 50 usuarios",
      fixedAmount: new Prisma.Decimal(1200),
      billingDayOfMonth: 1,
      isActive: true,
      startDate: d("2024-01-01"),
    },
  })

  const itemTecsurVar = await prisma.contractItem.create({
    data: {
      contractId: ctTecsur.id,
      type: "RECURRING_VARIABLE",
      name: "Consumo API (llamadas/mes)",
      description: "Facturación variable según volumen de llamadas procesadas",
      billingDayOfMonth: 1,
      isActive: true,
      startDate: d("2024-01-01"),
    },
  })

  // Pricing table para el item variable de TecSur
  const ptTecsur = await prisma.pricingTable.create({
    data: {
      contractItemId: itemTecsurVar.id,
      name: "Tabla API TecSur 2024",
      description: "Rangos de consumo de API por mes",
      tiers: {
        create: [
          { fromQuantity: dec(0),      toQuantity: dec(10000),  unitPrice: dec(0.008), flatFee: dec(50) },
          { fromQuantity: dec(10001),  toQuantity: dec(50000),  unitPrice: dec(0.006), flatFee: dec(50) },
          { fromQuantity: dec(50001),  toQuantity: dec(200000), unitPrice: dec(0.004), flatFee: dec(50) },
          { fromQuantity: dec(200001), toQuantity: null,        unitPrice: dec(0.002), flatFee: dec(50) },
        ],
      },
    },
  })

  // 4b. DistriNorte — contrato con variable (volumen de entregas)
  const ctDistri = await prisma.contract.create({
    data: {
      companyId: distinorte.id,
      contractNumber: "CONT-2024-002",
      title: "Sistema de Logística — DistriNorte",
      description: "Módulo de logística y tracking. Facturación por bultos procesados.",
      currency: "ARS",
      startDate: d("2024-03-01"),
      status: "ACTIVE",
      paymentTermsDays: 10,
      lateFeePercent: new Prisma.Decimal(3),
      signatureDate: d("2024-02-20"),
    },
  })

  const itemDistriFijo = await prisma.contractItem.create({
    data: {
      contractId: ctDistri.id,
      type: "RECURRING_FIXED",
      name: "Plataforma logística",
      description: "Acceso base al sistema + soporte telefónico",
      fixedAmount: new Prisma.Decimal(180000),
      billingDayOfMonth: 1,
      isActive: true,
      startDate: d("2024-03-01"),
    },
  })

  const itemDistriVar = await prisma.contractItem.create({
    data: {
      contractId: ctDistri.id,
      type: "RECURRING_VARIABLE",
      name: "Bultos procesados",
      description: "Costo por bulto escaneado y rastreado",
      billingDayOfMonth: 1,
      isActive: true,
      startDate: d("2024-03-01"),
    },
  })

  await prisma.pricingTable.create({
    data: {
      contractItemId: itemDistriVar.id,
      name: "Tabla bultos DistriNorte",
      tiers: {
        create: [
          { fromQuantity: dec(0),      toQuantity: dec(5000),  unitPrice: dec(12),  flatFee: null },
          { fromQuantity: dec(5001),   toQuantity: dec(20000), unitPrice: dec(9),   flatFee: null },
          { fromQuantity: dec(20001),  toQuantity: null,       unitPrice: dec(6),   flatFee: null },
        ],
      },
    },
  })

  // 4c. Constructora del Plata — implementación en cuotas + mensualidad
  const ctConstr = await prisma.contract.create({
    data: {
      companyId: constructora.id,
      contractNumber: "CONT-2025-001",
      title: "Implementación + Soporte — ConPlata",
      description: "Implementación en 3 hitos + mensualidad de soporte a partir del mes 4",
      currency: "ARS",
      startDate: d("2025-02-01"),
      status: "ACTIVE",
      paymentTermsDays: 20,
      lateFeePercent: new Prisma.Decimal(1.5),
      signatureDate: d("2025-01-28"),
    },
  })

  const itemConstrImpl = await prisma.contractItem.create({
    data: {
      contractId: ctConstr.id,
      type: "INSTALLMENT",
      name: "Implementación en 3 hitos",
      description: "Proyecto de implementación del sistema contable",
      totalAmount: new Prisma.Decimal(900000),
      installments: 3,
      billingDayOfMonth: 1,
      isActive: true,
      startDate: d("2025-02-01"),
      breakdownNote: "Impl. módulos $900,000 en 3 hitos: firma, UAT, go-live",
      installmentPlan: [
        { label: "Hito 1 — Firma y kick-off", percentage: 40 },
        { label: "Hito 2 — UAT aprobado",     percentage: 30 },
        { label: "Hito 3 — Go-live",          percentage: 30 },
      ],
    },
  })

  const itemConstrSoporte = await prisma.contractItem.create({
    data: {
      contractId: ctConstr.id,
      type: "RECURRING_FIXED",
      name: "Soporte mensual post-implementación",
      description: "Soporte técnico y funcional, 8x5",
      fixedAmount: new Prisma.Decimal(120000),
      billingDayOfMonth: 1,
      isActive: true,
      startDate: d("2025-05-01"), // arranca mes 4 del contrato
      durationMonths: 24,
      autoRenew: false,
    },
  })
  console.log("✅  Contratos y items creados")

  // ─── 5. Tickets históricos ─────────────────────────────────────────────────
  // Generamos tickets de los últimos 4 meses y el mes actual

  // Helper: issue+due calculado desde periodo
  function makeDates(periodDate: Date, termsdays: number, dayOfMonth: number) {
    const issueDate = new Date(periodDate.getFullYear(), periodDate.getMonth(), dayOfMonth)
    const dueDate = addDays(issueDate, termsdays)
    const periodStart = startOfMonth(periodDate)
    const periodEnd = endOfMonth(periodDate)
    return { issueDate, dueDate, periodStart, periodEnd }
  }

  // ── TecSur: 5 meses de tickets (fijo + variable) ──────────────────────────
  const tecsurMonths = [-4, -3, -2, -1, 0]
  const tecsurTickets: Array<{ id: string; amount: Prisma.Decimal }> = []

  for (const offset of tecsurMonths) {
    const period = mo(offset)
    const { issueDate, dueDate, periodStart, periodEnd } = makeDates(period, 15, 1)

    // Fijo: $1,200 USD cada mes
    const tFijo = await prisma.billingTicket.create({
      data: {
        ticketNumber: tNum("TS-F"),
        contractId: ctTecsur.id,
        contractItemId: itemTecsurFijo.id,
        periodStart,
        periodEnd,
        issueDate,
        dueDate,
        amount: new Prisma.Decimal(1200),
        currency: "USD",
        status: offset < -1 ? "PAID" : offset === -1 ? "PAID" : "PENDING",
        paidAmount: offset < -1 ? new Prisma.Decimal(1200) : offset === -1 ? new Prisma.Decimal(1200) : new Prisma.Decimal(0),
        paidAt: offset < -1 ? addDays(dueDate, -3) : offset === -1 ? addDays(dueDate, -5) : null,
      },
    })

    // Variable: cantidad variable según mes
    const quantities: Record<number, number> = { [-4]: 38000, [-3]: 45000, [-2]: 52000, [-1]: 61000, 0: 0 }
    const qty = quantities[offset]
    const varAmount = qty > 0
      ? new Prisma.Decimal(50).add(new Prisma.Decimal(qty).mul(new Prisma.Decimal(qty <= 10000 ? 0.008 : qty <= 50000 ? 0.006 : 0.004)))
      : new Prisma.Decimal(0)

    if (qty > 0) {
      const tVar = await prisma.billingTicket.create({
        data: {
          ticketNumber: tNum("TS-V"),
          contractId: ctTecsur.id,
          contractItemId: itemTecsurVar.id,
          periodStart,
          periodEnd,
          issueDate,
          dueDate,
          amount: varAmount.toDecimalPlaces(2),
          currency: "USD",
          variableQuantity: new Prisma.Decimal(qty),
          status: offset < -1 ? "PAID" : offset === -1 ? "PAID" : "PENDING",
          paidAmount: offset < -1 ? varAmount.toDecimalPlaces(2) : offset === -1 ? varAmount.toDecimalPlaces(2) : new Prisma.Decimal(0),
          paidAt: offset < -1 ? addDays(dueDate, -2) : offset === -1 ? addDays(dueDate, -4) : null,
        },
      })
      if (offset === -1) tecsurTickets.push({ id: tVar.id, amount: varAmount.toDecimalPlaces(2) })
    }
    if (offset === -1) tecsurTickets.push({ id: tFijo.id, amount: new Prisma.Decimal(1200) })
  }

  // ── DistriNorte: 4 meses con OVERDUE en -2 y -3 ──────────────────────────
  const distriMonths = [-3, -2, -1, 0]
  const overdueTickets: Array<{ id: string; amount: Prisma.Decimal }> = []

  for (const offset of distriMonths) {
    const period = mo(offset)
    const { issueDate, dueDate, periodStart, periodEnd } = makeDates(period, 10, 1)

    // Fijo ARS
    const tFijo = await prisma.billingTicket.create({
      data: {
        ticketNumber: tNum("DN-F"),
        contractId: ctDistri.id,
        contractItemId: itemDistriFijo.id,
        periodStart,
        periodEnd,
        issueDate,
        dueDate: offset <= -2 ? addDays(period, 10) : dueDate,
        amount: new Prisma.Decimal(180000),
        currency: "ARS",
        status: offset === -3 ? "OVERDUE" : offset === -2 ? "OVERDUE" : offset === -1 ? "PARTIAL" : "PENDING",
        paidAmount: offset === -1 ? new Prisma.Decimal(90000) : new Prisma.Decimal(0),
        paidAt: null,
      },
    })

    // Variable ARS
    const distriQtys: Record<number, number> = { [-3]: 8200, [-2]: 11500, [-1]: 6800, 0: 0 }
    const qty = distriQtys[offset]
    if (qty > 0) {
      const unitPrice = qty <= 5000 ? 12 : qty <= 20000 ? 9 : 6
      const amount = new Prisma.Decimal(qty).mul(new Prisma.Decimal(unitPrice))

      const tVar = await prisma.billingTicket.create({
        data: {
          ticketNumber: tNum("DN-V"),
          contractId: ctDistri.id,
          contractItemId: itemDistriVar.id,
          periodStart,
          periodEnd,
          issueDate,
          dueDate: offset <= -2 ? addDays(period, 10) : dueDate,
          amount: amount.toDecimalPlaces(2),
          currency: "ARS",
          variableQuantity: new Prisma.Decimal(qty),
          status: offset === -3 ? "OVERDUE" : offset === -2 ? "OVERDUE" : offset === -1 ? "SENT" : "PENDING",
          paidAmount: new Prisma.Decimal(0),
        },
      })

      if (offset <= -2) overdueTickets.push({ id: tFijo.id, amount: new Prisma.Decimal(180000) })
    }
  }

  // ── Constructora: hitos de implementación + soporte ──────────────────────
  // Hito 1: 40% de $900,000 = $360,000 — PAID (feb 2025)
  const hito1 = await prisma.billingTicket.create({
    data: {
      ticketNumber: tNum("CP-I"),
      contractId: ctConstr.id,
      contractItemId: itemConstrImpl.id,
      periodStart: d("2025-02-01"),
      periodEnd: d("2025-02-28"),
      issueDate: d("2025-02-01"),
      dueDate: d("2025-02-21"),
      amount: new Prisma.Decimal(360000),
      currency: "ARS",
      description: "Hito 1 — Firma y kick-off",
      status: "PAID",
      paidAmount: new Prisma.Decimal(360000),
      paidAt: d("2025-02-18"),
    },
  })

  // Hito 2: 30% = $270,000 — PARTIAL (abonado parcialmente)
  const hito2 = await prisma.billingTicket.create({
    data: {
      ticketNumber: tNum("CP-I"),
      contractId: ctConstr.id,
      contractItemId: itemConstrImpl.id,
      periodStart: d("2025-03-01"),
      periodEnd: d("2025-03-31"),
      issueDate: d("2025-03-01"),
      dueDate: d("2025-03-21"),
      amount: new Prisma.Decimal(270000),
      currency: "ARS",
      description: "Hito 2 — UAT aprobado",
      status: "PARTIAL",
      paidAmount: new Prisma.Decimal(135000),
    },
  })

  // Hito 3: 30% = $270,000 — PENDING
  const hito3 = await prisma.billingTicket.create({
    data: {
      ticketNumber: tNum("CP-I"),
      contractId: ctConstr.id,
      contractItemId: itemConstrImpl.id,
      periodStart: d("2025-04-01"),
      periodEnd: d("2025-04-30"),
      issueDate: d("2025-04-01"),
      dueDate: d("2025-04-21"),
      amount: new Prisma.Decimal(270000),
      currency: "ARS",
      description: "Hito 3 — Go-live",
      status: "SENT",
      paidAmount: new Prisma.Decimal(0),
    },
  })

  // Soporte mayo 2025 — PENDING (primer mes)
  const soporteMay = await prisma.billingTicket.create({
    data: {
      ticketNumber: tNum("CP-S"),
      contractId: ctConstr.id,
      contractItemId: itemConstrSoporte.id,
      periodStart: d("2025-05-01"),
      periodEnd: d("2025-05-31"),
      issueDate: d("2025-05-01"),
      dueDate: d("2025-05-21"),
      amount: new Prisma.Decimal(120000),
      currency: "ARS",
      description: null,
      status: "PENDING",
      paidAmount: new Prisma.Decimal(0),
    },
  })
  console.log("✅  Tickets históricos generados")

  // ─── 6. Pagos ─────────────────────────────────────────────────────────────

  // Pago 1: TecSur — cubre mes -4 completo (fijo ya tiene paidAmount seteado arriba)
  // Los tickets anteriores a -1 ya están marcados PAID individualmente.
  // Creamos solo los payments y PaymentTickets para los meses -4, -3 (los más viejos).

  // Para simplificar: creamos payments agrupados
  // Payment TecSur mes -4
  const pay1 = await prisma.payment.create({
    data: {
      paymentNumber: "PAY-001",
      companyId: tecsur.id,
      clientId: cTecsur2.id,
      grossAmount: new Prisma.Decimal(1538), // aprox fijo + variable mes -4
      currency: "USD",
      paymentDate: addDays(mo(-4), 12),
      method: "BANK_TRANSFER",
      status: "PROCESSED",
      reference: "TRF-230401",
      notes: "Pago puntual. Transferencia bancaria.",
      createdById: admin.id,
    },
  })

  // Payment Constructora — hito 1
  const pay2 = await prisma.payment.create({
    data: {
      paymentNumber: "PAY-002",
      companyId: constructora.id,
      clientId: cConstr1.id,
      grossAmount: new Prisma.Decimal(360000),
      currency: "ARS",
      paymentDate: d("2025-02-18"),
      method: "BANK_TRANSFER",
      status: "PROCESSED",
      reference: "TRF-BNA-025",
      notes: "Hito 1 abonado en tiempo.",
      createdById: admin.id,
    },
  })
  await prisma.paymentTicket.create({
    data: { paymentId: pay2.id, billingTicketId: hito1.id, allocatedAmount: new Prisma.Decimal(360000) },
  })

  // Payment Constructora — pago parcial hito 2
  const pay3 = await prisma.payment.create({
    data: {
      paymentNumber: "PAY-003",
      companyId: constructora.id,
      clientId: cConstr1.id,
      grossAmount: new Prisma.Decimal(135000),
      currency: "ARS",
      paymentDate: d("2025-03-19"),
      method: "BANK_TRANSFER",
      status: "PROCESSED",
      reference: "TRF-BNA-031",
      notes: "Pago parcial. Saldo pendiente $135,000.",
      createdById: admin.id,
    },
  })
  await prisma.paymentTicket.create({
    data: { paymentId: pay3.id, billingTicketId: hito2.id, allocatedAmount: new Prisma.Decimal(135000) },
  })

  console.log("✅  Pagos registrados")

  // ─── 7. Email Templates ───────────────────────────────────────────────────
  await prisma.emailTemplate.createMany({
    data: [
      {
        companyId: tecsur.id,
        name: "Recordatorio de cobro — TecSur",
        subject: "Recordatorio: Factura {{ticket.number}} vence el {{ticket.dueDate}}",
        bodyHtml: `<p>Estimado/a {{client.name}},</p>
<p>Le recordamos que tiene una factura pendiente de pago por <strong>{{ticket.currency}} {{ticket.amount}}</strong> con vencimiento el <strong>{{ticket.dueDate}}</strong>.</p>
<p>Por favor, efectúe el pago antes de la fecha para evitar cargos adicionales.</p>
<p>Ante cualquier consulta, no dude en contactarnos.</p>
<p>Equipo de Antigravity</p>`,
        isDefault: true,
      },
      {
        companyId: distinorte.id,
        name: "Aviso de deuda vencida — DistriNorte",
        subject: "⚠️ Deuda vencida: {{ticket.number}} — {{company.name}}",
        bodyHtml: `<p>Estimado/a {{client.name}},</p>
<p>Le informamos que la factura <strong>{{ticket.number}}</strong> por <strong>{{ticket.currency}} {{ticket.amount}}</strong> se encuentra <strong>vencida</strong>.</p>
<p>Por favor, regularice su situación a la brevedad. Ante cualquier consulta comuníquese con nuestro equipo.</p>`,
        isDefault: true,
      },
      {
        companyId: constructora.id,
        name: "Recordatorio hito — ConPlata",
        subject: "Próximo hito de pago: {{ticket.description}}",
        bodyHtml: `<p>Estimado/a {{client.name}},</p>
<p>Le recordamos que el próximo hito de implementación <strong>{{ticket.description}}</strong> tiene vencimiento el <strong>{{ticket.dueDate}}</strong> por un importe de <strong>{{ticket.currency}} {{ticket.amount}}</strong>.</p>`,
        isDefault: false,
      },
    ],
  })
  console.log("✅  Email templates creados")

  // ─── Resumen ───────────────────────────────────────────────────────────────
  const counts = await Promise.all([
    prisma.company.count(),
    prisma.client.count(),
    prisma.contract.count(),
    prisma.contractItem.count(),
    prisma.billingTicket.count(),
    prisma.payment.count(),
    prisma.emailTemplate.count(),
  ])

  console.log("\n🎉  Seed demo completado:")
  console.log(`   Empresas:     ${counts[0]}`)
  console.log(`   Contactos:    ${counts[1]}`)
  console.log(`   Contratos:    ${counts[2]}`)
  console.log(`   Items:        ${counts[3]}`)
  console.log(`   Tickets:      ${counts[4]}`)
  console.log(`   Pagos:        ${counts[5]}`)
  console.log(`   Templates:    ${counts[6]}`)
  console.log("\n   Login: admin@cobranza.local / admin1234")
}

main()
  .catch((e) => {
    console.error("❌  Error en seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
