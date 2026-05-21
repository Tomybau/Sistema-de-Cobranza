"use client"

import { useState, useTransition } from "react"
import { Printer, Mail } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { sendPaymentReceiptAction } from "@/app/actions/payment-receipt"

export function ReceiptActions({ paymentId }: { paymentId: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handlePrint() {
    window.open(`/comprobantes/${paymentId}?print=1`, "_blank")
  }

  function handleSend() {
    startTransition(async () => {
      const result = await sendPaymentReceiptAction(paymentId)
      if (!result.success) {
        toast.error(result.error)
      } else {
        toast.success(`Comprobante enviado a ${result.sentTo.length} destinatario(s)`)
      }
      setConfirmOpen(false)
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="mr-1.5 h-4 w-4" />
        Comprobante / PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
        <Mail className="mr-1.5 h-4 w-4" />
        Enviar por mail
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar comprobante por mail</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará el comprobante a los contactos de facturación de la empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={isPending}>
              {isPending ? "Enviando…" : "Enviar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
