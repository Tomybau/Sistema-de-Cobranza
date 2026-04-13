"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getAllowedTransitions } from "@/domain/contracts/transitions"
import { changeContractStatusAction } from "@/app/(dashboard)/contracts/actions"
import type { ContractStatus } from "@prisma/client"
import { useRouter } from "next/navigation"

const STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  ENDED: "Finalizado",
  CANCELLED: "Cancelado",
}

interface Props {
  contractId: string
  currentStatus: ContractStatus
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangeStatusDialog({
  contractId,
  currentStatus,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter()
  const [newStatus, setNewStatus] = useState<ContractStatus | "">("")
  const [isPending, startTransition] = useTransition()

  const allowed = getAllowedTransitions(currentStatus)
  const showWarning =
    currentStatus === "ACTIVE" && newStatus !== "" && newStatus !== currentStatus

  function handleConfirm() {
    if (!newStatus) return
    startTransition(async () => {
      const result = await changeContractStatusAction(
        contractId,
        newStatus as ContractStatus
      )
      if (!result.success) {
        toast.error(result.error)
      } else {
        toast.success("Estado actualizado correctamente")
        onOpenChange(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar estado del contrato</DialogTitle>
          <DialogDescription>
            Estado actual:{" "}
            <strong>{STATUS_LABELS[currentStatus]}</strong>
          </DialogDescription>
        </DialogHeader>

        {allowed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Este estado es terminal. No se puede cambiar.
          </p>
        ) : (
          <div className="space-y-3 py-2">
            <Select
              value={newStatus}
              onValueChange={(v) => v != null && setNewStatus(v as ContractStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná el nuevo estado" />
              </SelectTrigger>
              <SelectContent>
                {allowed.map((s) => (
                  <SelectItem key={s} value={s} label={STATUS_LABELS[s]}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showWarning && (
              <div className="rounded-md bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
                Este cambio afectará la generación futura de tickets. Confirmá
                la acción.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || !newStatus || allowed.length === 0}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
