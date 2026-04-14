import { prisma } from "@/db/client"
import { Prisma } from "@prisma/client"

export async function getPaymentsDomain() {
  return await prisma.payment.findMany({
    orderBy: { paymentDate: "desc" },
    include: {
      company: { select: { legalName: true } },
      client: { select: { fullName: true } },
      _count: {
        select: { tickets: true }
      }
    }
  })
}

export type PaymentSummary = Prisma.PromiseReturnType<typeof getPaymentsDomain>[0]
