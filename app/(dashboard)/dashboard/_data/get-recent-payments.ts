import { prisma } from "@/db/client"
import { PaymentMethod } from "@prisma/client"

export type RecentPaymentData = {
  id: string
  clientName: string
  clientInitials: string
  amount: number
  method: PaymentMethod
  date: string // ISO string
}

export async function getRecentPayments({ companyId }: { companyId?: string }): Promise<RecentPaymentData[]> {
  const companyFilter = companyId ? { companyId } : {}

  const payments = await prisma.payment.findMany({
    where: {
      ...companyFilter,
      status: "PROCESSED",
    },
    include: {
      client: true,
    },
    orderBy: { paymentDate: "desc" },
    take: 5,
  })

  return payments.map((p) => {
    const defaultName = p.client?.fullName || "Sin nombre"
    const initials = defaultName.substring(0, 2).toUpperCase()

    return {
      id: p.id,
      clientName: defaultName,
      clientInitials: initials,
      amount: p.grossAmount.toNumber(),
      method: p.method,
      date: p.paymentDate.toISOString(),
    }
  })
}
