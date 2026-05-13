"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { PaymentForm } from "./payment-form"

interface PaymentSheetProps {
  clients: { id: string; name: string }[]
}

export function PaymentSheet({ clients }: PaymentSheetProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleSuccess() {
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Registrar pago
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Registrar pago</SheetTitle>
            <SheetDescription>
              Cargá los datos del pago y asigná montos a los tickets pendientes.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 py-4">
            <PaymentForm clients={clients} onSuccess={handleSuccess} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
