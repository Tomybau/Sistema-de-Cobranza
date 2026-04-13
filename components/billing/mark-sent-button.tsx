"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { markTicketSentAction } from "@/app/(dashboard)/tickets/[id]/actions"

interface MarkSentButtonProps {
  ticketId: string
}

export function MarkSentButton({ ticketId }: MarkSentButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await markTicketSentAction(ticketId)
      if (result.success) {
        toast.success("Ticket marcado como enviado")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? "Marcando..." : "Marcar como enviado"}
    </Button>
  )
}
