"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { cancelPaymentAction } from "@/app/actions/payments"
import { Button } from "@/components/ui/button"
import { XCircle } from "lucide-react"
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
import { toast } from "sonner"

export function CancelPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const handleCancel = () => {
    startTransition(async () => {
      const res = await cancelPaymentAction(paymentId)
      if (!res.success) {
        toast.error(res.error)
      } else {
        toast.success("Pago cancelado correctamente")
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger 
        render={<Button variant="destructive" size="sm" />}
      >
        <span className="flex items-center">
          <XCircle className="w-4 h-4 mr-2" />
          Cancelar Pago
        </span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Está seguro de cancelar el pago?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción revertirá los montos asignados a los tickets vinculados,
            devolviéndolos a su estado anterior. El comprobante quedará marcado
            como Cancelado. No se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Atrás</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault()
              handleCancel()
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Cancelando..." : "Sí, Cancelar pago"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
