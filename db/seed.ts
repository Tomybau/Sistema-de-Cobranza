/**
 * Seed de desarrollo.
 * SOLO se ejecuta si NODE_ENV === "development". Se niega en producción.
 */
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

if (process.env.NODE_ENV !== "development") {
  console.error("❌  Seed rechazado: NODE_ENV no es 'development'. Nunca ejecutes esto en producción.")
  process.exit(1)
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱  Iniciando seed de desarrollo...")

  // ── 1. Admin user ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("admin1234", 12)

  // Aseguramos que el usuario con ID dinámico anterior desaparezca para usar uno fijo
  await prisma.user.deleteMany({ where: { email: "admin@cobranza.local" } })

  const admin = await prisma.user.create({
    data: {
      id: "seed-admin-id",
      email: "admin@cobranza.local",
      name: "Admin Dev",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  })
  console.log("✅  User:", admin.email)

  // ── 2. Companies ─────────────────────────────────────────────────────────────
  const company1 = await prisma.company.upsert({
    where: { taxId: "30-12345678-9" },
    update: {},
    create: {
      legalName: "Tecnologías del Sur S.A.",
      tradeName: "TecSur",
      taxId: "30-12345678-9",
      email: "admin@tecsur.com.ar",
      phone: "+54 11 4000-1234",
      address: "Av. Corrientes 1234",
      city: "Buenos Aires",
      country: "Argentina",
      notes: "Cliente desde 2023. Buen historial de pagos.",
    },
  })

  const company2 = await prisma.company.upsert({
    where: { taxId: "30-98765432-1" },
    update: {},
    create: {
      legalName: "Distribuidora Norte S.R.L.",
      tradeName: "DistriNorte",
      taxId: "30-98765432-1",
      email: "contabilidad@distinorte.com.ar",
      phone: "+54 351 400-5678",
      address: "Bv. San Juan 890",
      city: "Córdoba",
      country: "Argentina",
    },
  })
  console.log("✅  Companies:", company1.tradeName, company2.tradeName)

  // ── 3. Clients ───────────────────────────────────────────────────────────────
  const client1 = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    update: {},
    create: {
      id: "seed-client-1",
      companyId: company1.id,
      fullName: "Carlos Rodríguez",
      role: "Owner",
      email: "carlos@tecsur.com.ar",
      phone: "+54 11 9000-1234",
      isPrimary: true,
    },
  })

  const client2 = await prisma.client.upsert({
    where: { id: "seed-client-2" },
    update: {},
    create: {
      id: "seed-client-2",
      companyId: company2.id,
      fullName: "María López",
      role: "Billing contact",
      email: "mlopez@distinorte.com.ar",
      phone: "+54 351 9000-5678",
      isPrimary: true,
    },
  })
  console.log("✅  Clients:", client1.fullName, client2.fullName)

  // ── 4. Contract con 2 items ───────────────────────────────────────────────────
  const contract = await prisma.contract.upsert({
    where: { contractNumber: "CONT-2024-001" },
    update: {},
    create: {
      companyId: company1.id,
      contractNumber: "CONT-2024-001",
      title: "Servicio de gestión mensual",
      description: "Contrato de servicios recurrentes para TecSur",
      currency: "ARS",
      startDate: new Date("2024-01-01"),
      status: "ACTIVE",
      paymentTermsDays: 15,
      items: {
        create: [
          {
            type: "RECURRING_FIXED",
            name: "Mensualidad base",
            description: "Servicio mensual fijo",
            fixedAmount: 150000,
            billingDayOfMonth: 1,
            isActive: true,
          },
          {
            type: "ONE_TIME",
            name: "Cuota de implementación",
            description: "Setup inicial del sistema",
            totalAmount: 300000,
            isActive: true,
          },
        ],
      },
    },
  })
  console.log("✅  Contract:", contract.contractNumber)

  // ── 5. Email template ─────────────────────────────────────────────────────────
  await prisma.emailTemplate.upsert({
    where: { id: "seed-template-reminder" },
    update: {},
    create: {
      id: "seed-template-reminder",
      companyId: company1.id,
      name: "Recordatorio de cobro",
      subject: "Recordatorio: Factura {{ticket.number}} vence el {{ticket.dueDate}}",
      bodyHtml: `<p>Estimado/a {{client.name}},</p>
<p>Le recordamos que tiene una factura pendiente de pago:</p>
<ul>
  <li><strong>Número:</strong> {{ticket.number}}</li>
  <li><strong>Monto:</strong> {{ticket.currency}} {{ticket.amount}}</li>
  <li><strong>Vencimiento:</strong> {{ticket.dueDate}}</li>
</ul>
<p>Por favor, efectúe el pago antes de la fecha de vencimiento para evitar cargos adicionales.</p>
<p>Ante cualquier consulta, no dude en contactarnos.</p>`,
      isDefault: true,
    },
  })
  console.log("✅  EmailTemplate: Recordatorio de cobro")

  console.log("\n🎉  Seed completado exitosamente.")
  console.log("   Login: admin@cobranza.local / admin1234")
}

main()
  .catch((e) => {
    console.error("❌  Error en seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
