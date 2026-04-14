import { prisma } from "@/db/client"
import { Prisma, PaymentMethod } from "@prisma/client"
import { validateAndCalculateAllocations, PaymentAllocationInput } from "./calculate"
import { createAuditLog } from "@/domain/audit"

export interface RegisterPaymentInput {
  companyId: string
  clientId: string
  grossAmount: string
  method: PaymentMethod
  paymentDate: Date
  reference?: string
  notes?: string
  allocations: PaymentAllocationInput[]
  createdById: string
  ipAddress?: string
  userAgent?: string
}

export async function registerPayment(input: RegisterPaymentInput) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch tickets to validate
    const ticketIds = input.allocations.map(a => a.ticketId)
    const tickets = await tx.billingTicket.findMany({
      where: { id: { in: ticketIds } },
      select: { id: true, amount: true, paidAmount: true, status: true }
    })

    // 2. Validate and calculate allocations
    const processed = validateAndCalculateAllocations(
      input.grossAmount,
      input.allocations,
      tickets
    )

    // 3. Create Payment
    // Use an epoch-based number if no sequence exists
    const paymentNumber = `PAY-${Date.now()}`
    
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        companyId: input.companyId,
        clientId: input.clientId,
        grossAmount: new Prisma.Decimal(input.grossAmount),
        method: input.method,
        paymentDate: input.paymentDate,
        reference: input.reference,
        notes: input.notes,
        status: "PROCESSED",
        createdById: input.createdById,
      }
    })

    // 4. Create PaymentTickets & Update BillingTickets
    for (const alloc of processed) {
      await tx.paymentTicket.create({
        data: {
          paymentId: payment.id,
          billingTicketId: alloc.ticketId,
          allocatedAmount: alloc.allocatedAmount
        }
      })

      await tx.billingTicket.update({
        where: { id: alloc.ticketId },
        data: {
          paidAmount: alloc.newPaidAmount,
          status: alloc.newStatus,
          ...(alloc.newStatus === "PAID" ? { paidAt: new Date() } : {})
        }
      })
    }

    // 5. Audit Log (cast tx to any for prisma compat layer inside createAuditLog)
    await createAuditLog(tx as any, {
      userId: input.createdById,
      action: "payment.create",
      entityType: "Payment",
      entityId: payment.id,
      afterData: { 
        paymentNumber,
        grossAmount: input.grossAmount,
        allocations: processed 
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    })

    return payment
  })
}

export async function cancelPayment(paymentId: string, userId: string, ipAddress?: string, userAgent?: string) {
  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { tickets: true }
    })

    if (!payment) throw new Error("Payment not found")
    if (payment.status === "CANCELLED") throw new Error("Payment is already cancelled")

    // Update payment
    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "CANCELLED" }
    })

    // Revert allocations
    for (const pt of payment.tickets) {
      const ticket = await tx.billingTicket.findUnique({
        where: { id: pt.billingTicketId }
      })
      if (!ticket) continue

      const newPaidAmount = ticket.paidAmount.sub(pt.allocatedAmount)
      const newStatus = newPaidAmount.equals(new Prisma.Decimal(0)) ? "PENDING" : "PARTIAL"

      await tx.billingTicket.update({
        where: { id: pt.billingTicketId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          ...(newStatus === "PENDING" || newStatus === "PARTIAL" ? { paidAt: null } : {})
        }
      })
    }
    
    // Audit log
    await createAuditLog(tx as any, {
      userId,
      action: "payment.cancel",
      entityType: "Payment",
      entityId: payment.id,
      beforeData: { status: "PROCESSED" },
      afterData: { status: "CANCELLED" },
      ipAddress,
      userAgent
    })

    return updatedPayment
  })
}
