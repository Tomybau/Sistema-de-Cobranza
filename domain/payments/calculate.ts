import { Prisma } from "@prisma/client"

export interface PaymentAllocationInput {
  ticketId: string
  allocatedAmount: string // Decimal string
}

export interface TicketValidationData {
  id: string
  amount: Prisma.Decimal
  paidAmount: Prisma.Decimal
  status: string
}

export function validateAndCalculateAllocations(
  grossAmountInput: string,
  allocations: PaymentAllocationInput[],
  tickets: TicketValidationData[]
) {
  const grossAmount = new Prisma.Decimal(grossAmountInput)

  if (grossAmount.lessThanOrEqualTo(0)) {
    throw new Error("Gross amount must be greater than zero")
  }

  let totalAllocated = new Prisma.Decimal(0)
  const ticketMap = new Map<string, TicketValidationData>(
    tickets.map((t) => [t.id, t])
  )

  const processedAllocations: Array<{
    ticketId: string
    allocatedAmount: Prisma.Decimal
    newPaidAmount: Prisma.Decimal
    newStatus: "PAID" | "PARTIAL"
  }> = []

  for (const alloc of allocations) {
    const allocated = new Prisma.Decimal(alloc.allocatedAmount)
    if (allocated.lessThanOrEqualTo(0)) {
      throw new Error(`Allocated amount for ticket ${alloc.ticketId} must be greater than zero`)
    }

    totalAllocated = totalAllocated.add(allocated)

    const ticket = ticketMap.get(alloc.ticketId)
    if (!ticket) {
      throw new Error(`Ticket ${alloc.ticketId} not found`)
    }

    if (ticket.status === "CANCELLED") {
      throw new Error(`Cannot pay CANCELLED ticket ${alloc.ticketId}`)
    }

    const remainingBalance = ticket.amount.sub(ticket.paidAmount)
    if (allocated.greaterThan(remainingBalance)) {
      throw new Error(
        `Allocation ${allocated.toString()} exceeds remaining balance ${remainingBalance.toString()} for ticket ${ticket.id}`
      )
    }

    const newPaidAmount = ticket.paidAmount.add(allocated)
    const newStatus = newPaidAmount.equals(ticket.amount) ? "PAID" : "PARTIAL"

    processedAllocations.push({
      ticketId: ticket.id,
      allocatedAmount: allocated,
      newPaidAmount,
      newStatus,
    })
  }

  if (totalAllocated.greaterThan(grossAmount)) {
    throw new Error(
      `Total allocated (${totalAllocated.toString()}) exceeds gross amount (${grossAmount.toString()})`
    )
  }

  return processedAllocations
}
