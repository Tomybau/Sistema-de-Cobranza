/**
 * Crea plantillas de email de ejemplo para todas las empresas que no tengan ninguna.
 * Idempotente: no toca empresas que ya tienen templates.
 *
 * Uso: npm run db:seed-templates
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

const RECORDATORIO_SUBJECT =
  "Recordatorio: Factura {{ticket_number}} vence el {{ticket_due_date}}"

const RECORDATORIO_BODY = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #111827; background: #ffffff;">

  <p style="margin: 0 0 20px;">Estimado/a <strong>{{client_name}}</strong>,</p>

  <p style="margin: 0 0 24px; color: #374151;">
    Le recordamos que tiene una factura pendiente correspondiente al contrato
    <strong>{{contract_name}}</strong>. Le solicitamos que realice el pago
    antes del vencimiento para evitar cargos adicionales.
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 0 0 28px; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
    <thead>
      <tr style="background: #f9fafb;">
        <th colspan="2" style="padding: 12px 16px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
          Detalle de la factura
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6; width: 45%;">Número</td>
        <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f3f4f6;">{{ticket_number}}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Período</td>
        <td style="padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #f3f4f6;">{{ticket_period}}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Monto</td>
        <td style="padding: 12px 16px; font-size: 15px; font-weight: 700; border-bottom: 1px solid #f3f4f6;">{{ticket_amount}}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Vencimiento</td>
        <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #dc2626;">{{ticket_due_date}}</td>
      </tr>
    </tbody>
  </table>

  <p style="margin: 0 0 32px; font-size: 14px; color: #6b7280;">
    Si ya realizó el pago, por favor ignore este mensaje. Ante cualquier
    consulta no dude en responder a este correo.
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px;" />
  <p style="margin: 0; font-size: 13px; color: #9ca3af;">
    {{company_name}}
  </p>

</body>
</html>`

const MORA_SUBJECT =
  "Aviso de mora: Factura {{ticket_number}} vencida"

const MORA_BODY = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #111827; background: #ffffff;">

  <p style="margin: 0 0 20px;">Estimado/a <strong>{{client_name}}</strong>,</p>

  <p style="margin: 0 0 16px; color: #374151;">
    Le informamos que la siguiente factura se encuentra <strong style="color: #dc2626;">vencida</strong>
    y pendiente de pago:
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 0 0 28px; border-radius: 8px; overflow: hidden; border: 1px solid #fca5a5;">
    <thead>
      <tr style="background: #fef2f2;">
        <th colspan="2" style="padding: 12px 16px; text-align: left; font-size: 13px; color: #b91c1c; font-weight: 600; border-bottom: 1px solid #fca5a5;">
          Factura vencida
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6; width: 45%;">Número</td>
        <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f3f4f6;">{{ticket_number}}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Contrato</td>
        <td style="padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #f3f4f6;">{{contract_name}}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Monto</td>
        <td style="padding: 12px 16px; font-size: 15px; font-weight: 700; border-bottom: 1px solid #f3f4f6;">{{ticket_amount}}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Venció el</td>
        <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #dc2626;">{{ticket_due_date}}</td>
      </tr>
    </tbody>
  </table>

  <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
    Le solicitamos que regularice la situación a la brevedad posible.
    Para coordinar el pago o consultar sobre planes de regularización,
    responda a este correo.
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 20px;" />
  <p style="margin: 0; font-size: 13px; color: #9ca3af;">
    {{company_name}}
  </p>

</body>
</html>`

async function main() {
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    include: { emailTemplates: { select: { id: true } } },
    orderBy: { legalName: "asc" },
  })

  console.log(`Empresas encontradas: ${companies.length}`)

  const toCreate: Parameters<typeof prisma.emailTemplate.createMany>[0]["data"] = []

  for (const company of companies) {
    if (company.emailTemplates.length > 0) {
      console.log(`  ⏭  ${company.legalName} — ya tiene ${company.emailTemplates.length} template(s), sin cambios`)
      continue
    }

    toCreate.push(
      {
        companyId: company.id,
        name: "Recordatorio de cobro",
        subject: RECORDATORIO_SUBJECT,
        bodyHtml: RECORDATORIO_BODY,
        isDefault: true,
      },
      {
        companyId: company.id,
        name: "Aviso de mora",
        subject: MORA_SUBJECT,
        bodyHtml: MORA_BODY,
        isDefault: false,
      },
    )

    console.log(`  ➕  ${company.legalName}`)
  }

  if (toCreate.length > 0) {
    await prisma.emailTemplate.createMany({ data: toCreate })
  }

  console.log(`\nListo. Templates creados: ${toCreate.length}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
