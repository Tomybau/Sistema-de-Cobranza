import { Metadata } from "next"
import { prisma } from "@/db/client"
import { PaymentForm } from "@/components/payments/payment-form"

export const metadata: Metadata = {
  title: "Registrar Pago | Sistema de Cobranza",
  description: "Formulario de registro de pagos",
}

export default async function NewPaymentPage() {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      fullName: true,
      company: { select: { legalName: true } }
    },
    orderBy: { fullName: "asc" }
  })

  // Format array for the combobox / select
  const clientOptions = clients.map(c => ({
    id: c.id,
    name: `${c.fullName} (${c.company.legalName})`
  }))

  return (
    <div className="max-w-4xl mx-auto space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Registrar Pago</h2>
      </div>

      <PaymentForm clients={clientOptions} />
    </div>
  )
}
