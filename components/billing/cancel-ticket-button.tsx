"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cancelTicketAction } from "@/app/(dashboard)/tickets/[id]/actions"

interface CancelTicketButtonProps {
  ticketId: string
  disabled: boolean
}

export function CancelTicketButton({
  ticketId,
  disabled,
}: CancelTicketButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await cancelTicketAction(ticketId)
      if (result.success) {
        toast.success("Ticket cancelado")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size="sm"
            disabled={disabled || isPending}
          />
        }
      >
        Cancelar ticket
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar este ticket?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. El ticket quedará en estado
            Cancelado y no podrá usarse para registrar pagos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            variant="destructive"
            disabled={isPending}
          >
            {isPending ? "Cancelando..." : "Sí, cancelar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
