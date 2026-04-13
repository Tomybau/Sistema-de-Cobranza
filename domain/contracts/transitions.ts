import type { ContractStatus } from "@prisma/client"

type Transition = {
  allowed: boolean
  reason?: string
  warn?: string
}

const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["SUSPENDED", "ENDED", "CANCELLED"],
  SUSPENDED: ["ACTIVE", "ENDED", "CANCELLED"],
  ENDED: [],
  CANCELLED: [],
}

export function checkStatusTransition(
  current: ContractStatus,
  next: ContractStatus
): Transition {
  if (current === next) {
    return { allowed: false, reason: "El contrato ya tiene ese estado." }
  }

  const allowed = ALLOWED_TRANSITIONS[current].includes(next)
  if (!allowed) {
    return {
      allowed: false,
      reason: `No se puede pasar de ${current} a ${next}.`,
    }
  }

  const warn =
    current === "ACTIVE"
      ? "Este cambio afectará la generación futura de tickets. Confirmá la acción."
      : undefined

  return { allowed: true, warn }
}

export function getAllowedTransitions(current: ContractStatus): ContractStatus[] {
  return ALLOWED_TRANSITIONS[current]
}
